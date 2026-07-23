const VIEWS={dashboard:{title:"Dashboard",subtitle:"Owner command center",render:loadDashboard},patientSearch:{title:"Patient Search",subtitle:"Search records",render:renderPatientSearch},cashReport:{title:"Cash Report",subtitle:"Supabase daily cash book",render:renderCashReport},cashBook:{title:"Daily Financial Summary",subtitle:"Daily closing and finance summary",render:openCashBook},reports:{title:"Reports",subtitle:"Reports & Analytics Center",render:openReportsCenter},opd:{title:"OPD",subtitle:"Registration, visit and fee collection",render:openOPD},ipd:{title:"IPD Admission",subtitle:"Admission, bed and initial deposit",render:openIPD},ipdCharges:{title:"IPD Daily Charges",subtitle:"Day-wise inpatient billing",render:openIPDCharges},ipdBilling:{title:"IPD Billing",subtitle:"Final billing and discharge",render:openIPDBilling},diagnostics:{title:"Diagnostics",subtitle:"Lab ECG X-ray CT",render:openDiagnostics},doctorMaster:{title:"Doctor Master",subtitle:"Doctor fee presets",render:openDoctorMaster},userManagement:{title:"User Management",subtitle:"Owner-only login control",render:openUserManagement},pharmacyStock:{title:"Pharmacy Stock",subtitle:"Pharmacy owner only",render:renderPharmacyStock},purchaseRegister:{title:"Purchase Register",subtitle:"Pharmacy purchase and stock entry",render:renderPurchaseRegister},supplierMaster:{title:"Supplier Master",subtitle:"Supplier directory",render:renderSupplierMaster},pharmacyBilling:{title:"Pharmacy Billing",subtitle:"Pharmacy staff billing and stock deduction",render:openPharmacyBilling},expenses:{title:"Expenses",subtitle:"Hospital operating expenses",render:openExpenses}};
function ensureView(name){let v=document.getElementById(name+"View");if(!v){v=document.createElement("section");v.id=name+"View";v.className="view hidden";document.querySelector("main.main")?.appendChild(v)}return v}
function setVisibleView(name){Object.keys(VIEWS).forEach(k=>ensureView(k));document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));document.getElementById(name+"View")?.classList.remove("hidden")}
async function navigate(name){if(name==="dashboard"&&currentUser?.role!=="owner"){name=navForRole(currentUser.role)[0]}const v=VIEWS[name];if(!v)return;document.getElementById("pageTitle").textContent=v.title;document.getElementById("pageSubtitle").textContent=v.subtitle;setVisibleView(name);document.querySelectorAll("#mainNav button").forEach(b=>b.classList.toggle("active",b.dataset.view===name));await v.render()}
function navForRole(role){
  if(role==="owner")return ["dashboard","patientSearch","cashReport","reports","doctorMaster","userManagement"];
  const base=(NAV_BY_ROLE[role]||[]).slice().filter(x=>x!=="dashboard"&&x!=="doctorMaster"&&x!=="printCenter"&&x!=="userManagement"&&x!=="medicineMaster");
  if(role==="staff"&&!base.includes("ipdCharges")){const i=base.indexOf("ipd");base.splice(i>=0?i+1:base.length,0,"ipdCharges")}
  if(role==="staff"&&!base.includes("ipdBilling")){const i=base.indexOf("ipdCharges");base.splice(i>=0?i+1:base.length,0,"ipdBilling")}
  if(role==="staff"&&!base.includes("diagnostics")){const i=base.indexOf("ipdBilling");base.splice(i>=0?i+1:base.length,0,"diagnostics")}
  if(role==="pharmacyOwner"&&!base.includes("supplierMaster")){base.push("supplierMaster")}
  if(role==="accountant"&&!base.includes("cashBook")){base.splice(1,0,"cashBook")}
  if(role==="accountant"&&!base.includes("supplierMaster")){base.splice(2,0,"supplierMaster")}
  if(role==="accountant"&&!base.includes("expenses")){base.splice(1,0,"expenses")}
  return base;
}
function buildNav(){const nav=document.getElementById("mainNav");nav.innerHTML="";navForRole(currentUser.role).forEach(k=>{const b=document.createElement("button");b.textContent=VIEWS[k].title;b.dataset.view=k;b.onclick=()=>navigate(k);nav.appendChild(b)})}
function showApp(){document.getElementById("loginPage").classList.add("hidden");document.getElementById("appShell").classList.remove("hidden");document.getElementById("roleBadge").textContent=ROLE_LABELS[currentUser.role];buildNav();navigate(navForRole(currentUser.role)[0]||"dashboard")}
function loadScriptOnce(src){return new Promise((resolve,reject)=>{if(document.querySelector(`script[src="${src}"]`)){resolve();return}const s=document.createElement("script");s.src=src;s.onload=resolve;s.onerror=reject;document.body.appendChild(s)})}
async function openPharmacyBilling(){await loadScriptOnce("pharmacy-billing.js");return renderPharmacyBilling()}
async function openCashBook(){await loadScriptOnce("cash-book.js");return renderCashBook()}
async function openReportsCenter(){await loadScriptOnce("reports.js");return renderReportsCenter()}
async function openOPD(){await loadScriptOnce("opd.js");await loadScriptOnce("opd-delete.js");return renderOPD()}
async function openIPD(){await loadScriptOnce("ipd.js");return renderIPD()}
async function openIPDCharges(){await loadScriptOnce("ipd-charges.js");return renderIPDCharges()}
async function openIPDBilling(){await loadScriptOnce("ipd-billing.js");return renderIPDBilling()}
async function openDiagnostics(){await loadScriptOnce("diagnostics.js");return renderDiagnostics()}
async function openDoctorMaster(){await loadScriptOnce("doctor-master.js");return renderDoctorMaster()}
async function openUserManagement(){await loadScriptOnce("user-management.js");return renderUserManagement()}
async function openExpenses(){await loadScriptOnce("expenses.js");return renderExpenses()}
async function appUsersLogin(username,code){
  try{
    const key=(username||"").trim().toLowerCase();
    const {data,error}=await db.from("app_users").select("*").eq("username",key).maybeSingle();
    if(error||!data)return null;
    if((data.status||"Active")!=="Active")return null;
    if(String(data.login_code||"")!==String(code||""))return null;
    currentUser={username:key,role:data.role,name:data.display_name||data.username};
    sessionStorage.setItem("reviveUser",JSON.stringify(currentUser));
    return currentUser;
  }catch(e){return null;}
}
document.getElementById("loginForm").addEventListener("submit",async e=>{e.preventDefault();const user=await appUsersLogin(document.getElementById("username").value,document.getElementById("password").value);if(!user){document.getElementById("loginError").textContent="Invalid username or password.";return}showApp()});
document.getElementById("logoutBtn").onclick=()=>{logout();location.reload()};
if(restoreSession())showApp();