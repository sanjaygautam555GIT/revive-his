const ROLE_LABELS={owner:"Hospital Admin",staff:"Hospital Staff",pharmacyOwner:"Pharmacy Admin",pharmacy:"Pharmacy Staff",accountant:"Accountant",doctor:"Doctor"};
const NAV_BY_ROLE={owner:["dashboard","patientSearch","cashReport","reports"],staff:["dashboard","opd","ipd","patientSearch"],pharmacyOwner:["pharmacyStock","purchaseRegister"],pharmacy:["pharmacyBilling"],accountant:["dashboard","expenses","purchaseRegister","cashReport","reports"],doctor:["doctorPortal"]};
let currentUser=null;

const ReviveOtpAuth=(()=>{
  const endpoint=name=>`/.netlify/functions/${name}`;
  let pendingUsername=sessionStorage.getItem("reviveOtpUsername")||"";
  let pendingPassword="";

  async function post(name,payload){
    const res=await fetch(endpoint(name),{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify(payload)
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||"Authentication request failed.");
    return data;
  }

  async function requestOtp(username,password){
    const key=String(username||"").trim().toLowerCase();
    if(!key||!password)throw new Error("Username and password are required.");
    const data=await post("send-otp",{username:key,password:String(password)});
    pendingUsername=key;
    pendingPassword=String(password);
    sessionStorage.setItem("reviveOtpUsername",key);
    return data;
  }

  async function verifyOtp(otp){
    if(!pendingUsername)throw new Error("Login request expired. Start again.");
    const data=await post("verify-otp",{username:pendingUsername,otp:String(otp||"")});
    currentUser=data.user;
    sessionStorage.setItem("reviveUser",JSON.stringify(currentUser));
    sessionStorage.setItem("reviveSessionToken",data.sessionToken||"");
    sessionStorage.removeItem("reviveOtpUsername");
    pendingUsername="";
    pendingPassword="";
    return currentUser;
  }

  async function resendOtp(){
    if(!pendingUsername||!pendingPassword)throw new Error("Enter username and password again to resend OTP.");
    return requestOtp(pendingUsername,pendingPassword);
  }

  function cancel(){
    pendingUsername="";
    pendingPassword="";
    sessionStorage.removeItem("reviveOtpUsername");
  }

  return {requestOtp,verifyOtp,resendOtp,cancel,get username(){return pendingUsername}};
})();

function login(){return null}
function restoreSession(){
  const raw=sessionStorage.getItem("reviveUser");
  const token=sessionStorage.getItem("reviveSessionToken");
  if(!raw||!token)return null;
  try{
    currentUser=JSON.parse(raw);
    if(currentUser?.role&&ROLE_LABELS[currentUser.role])currentUser.name=currentUser.name||ROLE_LABELS[currentUser.role];
    return currentUser;
  }catch{
    logout();
    return null;
  }
}
function logout(){
  currentUser=null;
  sessionStorage.removeItem("reviveUser");
  sessionStorage.removeItem("reviveSessionToken");
  sessionStorage.removeItem("reviveOtpUsername");
}
