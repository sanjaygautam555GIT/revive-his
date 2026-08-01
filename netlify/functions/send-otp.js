const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://eojhducbbiuafmhjqdtg.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.OTP_FROM_EMAIL || "Revive HealthScope <noreply@revivehealthscope.com>";
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

exports.handler = async (event) => {
  const origin = event.headers.origin || "";
  if (event.httpMethod === "OPTIONS") return response(204, {}, origin);
  if (event.httpMethod !== "POST") return response(405, { error: "Method not allowed." }, origin);

  const missing = [];
  if (!SERVICE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (missing.length) {
    console.error("Missing OTP environment variables:", missing.join(", "));
    return response(500, { error: `Missing Netlify environment variable: ${missing.join(", ")}. Redeploy after saving it.` }, origin);
  }

  try {
    const { username, password } = JSON.parse(event.body || "{}");
    const key = String(username || "").trim().toLowerCase();
    const code = String(password || "");
    if (!key || !code) return response(400, { error: "Username and password are required." }, origin);

    const users = await supabase(`app_users?username=eq.${encodeURIComponent(key)}&select=id,username,display_name,role,email,login_code,status,account_locked_until&limit=1`);
    const user = users?.[0];
    const locked = user?.account_locked_until && new Date(user.account_locked_until) > new Date();
    if (!user || locked || (user.status || "Active") !== "Active" || String(user.login_code || "") !== code) {
      return response(401, { error: locked ? "Account is temporarily locked." : "Invalid username or password." }, origin);
    }
    if (!user.email) return response(400, { error: "No approval email is configured for this account." }, origin);

    const recent = await supabase(`otp_verifications?email=eq.${encodeURIComponent(user.email)}&otp=like.${encodeURIComponent(`${key}:%`)}&order=created_at.desc&limit=1&select=created_at`);
    if (recent?.[0]?.created_at && Date.now() - new Date(recent[0].created_at).getTime() < 30000) {
      return response(429, { error: "Please wait 30 seconds before requesting another OTP." }, origin);
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const storedOtp = `${key}:${otpHash(key, otp)}`;

    await supabase("otp_verifications", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ email: user.email, otp: storedOtp, expires_at: expiresAt, verified: false })
    });

    const mail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${RESEND_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [user.email],
        subject: "Revive HealthScope login approval code",
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;border:1px solid #dbe6ea;border-radius:14px"><h2 style="color:#087f7a;margin-top:0">Revive HealthScope</h2><p>A login was requested for <strong>${key}</strong>.</p><p style="font-size:14px;color:#52606d">Use this one-time approval code:</p><div style="font-size:34px;letter-spacing:8px;font-weight:700;padding:18px;background:#eefaf8;border-radius:10px;text-align:center;color:#075e5b">${otp}</div><p style="font-size:13px;color:#667085">This code expires in 5 minutes. Do not share it unless you approve this login.</p></div>`
      })
    });
    const mailBody = await mail.json().catch(() => ({}));
    if (!mail.ok) throw new Error(mailBody?.message || "Email delivery failed.");

    return response(200, {
      ok: true,
      username: key,
      emailHint: user.email.replace(/^(.{2}).*(@.*)$/, "$1***$2"),
      expiresIn: 300
    }, origin);
  } catch (error) {
    console.error("send-otp", error);
    return response(500, { error: error.message || "Unable to send OTP. Please try again." }, origin);
  }
};
