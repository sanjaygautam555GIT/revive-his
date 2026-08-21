const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://eojhducbbiuafmhjqdtg.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALLOWED_ORIGINS = new Set([
  "https://revivehealthscope.com",
  "https://www.revivehealthscope.com",
  "https://revivehospital.netlify.app"
]);

function response(statusCode, body, origin) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://revivehealthscope.com",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers": "content-type"
    },
    body: JSON.stringify(body)
  };
}

async function supabase(path, options = {}) {
  const result = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await result.text();
  const data = text ? JSON.parse(text) : null;
  if (!result.ok) throw new Error(data?.message || data?.hint || `Database request failed (${result.status})`);
  return data;
}

function otpHash(username, otp) {
  return crypto.createHmac("sha256", SERVICE_KEY).update(`${username}:${otp}`).digest("hex");
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

exports.handler = async (event) => {
  const origin = event.headers.origin || "";
  if (event.httpMethod === "OPTIONS") return response(204, {}, origin);
  if (event.httpMethod !== "POST") return response(405, { error: "Method not allowed." }, origin);
  if (!SERVICE_KEY) return response(500, { error: "OTP service is not configured." }, origin);

  try {
    const { username, otp } = JSON.parse(event.body || "{}");
    const key = String(username || "").trim().toLowerCase();
    const enteredOtp = String(otp || "").replace(/\D/g, "");
    if (!key || !/^\d{6}$/.test(enteredOtp)) return response(400, { error: "Enter the 6-digit OTP." }, origin);

    const users = await supabase(`app_users?username=eq.${encodeURIComponent(key)}&select=id,username,display_name,role,email,status,doctor_id&limit=1`);
    const user = users?.[0];
    if (!user || (user.status || "Active") !== "Active" || !user.email) return response(401, { error: "Login request is no longer valid." }, origin);

    const rows = await supabase(`otp_verifications?email=eq.${encodeURIComponent(user.email)}&otp=like.${encodeURIComponent(`${key}:%`)}&verified=eq.false&order=created_at.desc&limit=1&select=id,otp,expires_at,verified`);
    const record = rows?.[0];
    if (!record) return response(401, { error: "No active OTP was found. Request a new code." }, origin);
    if (new Date(record.expires_at).getTime() < Date.now()) return response(401, { error: "OTP expired. Request a new code." }, origin);

    const storedHash = String(record.otp || "").split(":").slice(1).join(":");
    const enteredHash = otpHash(key, enteredOtp);
    if (!safeEqual(storedHash, enteredHash)) return response(401, { error: "Incorrect OTP." }, origin);

    await supabase(`otp_verifications?id=eq.${encodeURIComponent(record.id)}`, {
      method: "PATCH",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({ verified: true })
    });

    await supabase(`app_users?id=eq.${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({ last_login: new Date().toISOString(), failed_login_attempts: 0 })
    }).catch(() => null);

    const sessionNonce = crypto.randomBytes(24).toString("hex");
    const issuedAt = Date.now();
    const payload = `${user.id}.${key}.${issuedAt}.${sessionNonce}`;
    const signature = crypto.createHmac("sha256", SERVICE_KEY).update(payload).digest("hex");

    return response(200, {
      ok: true,
      user: {
        id: user.id,
        username: key,
        role: user.role,
        name: user.display_name || key,
        doctor_id: user.doctor_id || null
      },
      sessionToken: `${payload}.${signature}`
    }, origin);
  } catch (error) {
    console.error("verify-otp", error);
    return response(500, { error: "Unable to verify OTP. Please try again." }, origin);
  }
};
