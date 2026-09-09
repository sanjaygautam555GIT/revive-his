const VIEWS={doctorPortal:{title:"Doctor Portal",subtitle:"Assigned patients, daily notes and discharge",render:openDoctorPortal},doctorDashboard:{title:"Dashboard",subtitle:"Admissions and operative activity",render:openDoctorDashboardV3},currentlyAdmitted:{title:"Currently Admitted",subtitle:"Active inpatient clinical care",render:openCurrentlyAdmittedV3},doctorPatientSearch:{title:"Patient Search",subtitle:"Complete patient history",render:openDoctorPatientSearchRouteV3},dashboard:{title:"Dashboard",subtitle:"Owner command center",render:loadDashboard},patientSearch:{title:"Patient Search",subtitle:"Search records",render:renderPatientSearch},cashReport:{title:"Cash Report",subtitle:"Supabase daily cash book",render:renderCashReport},cashBook:{title:"Daily Financial Summary",subtitle:"Daily closing and finance summary",render:openCashBook},reports:{title:"Reports",subtitle:"Reports & Analytics Center",render:openReportsCenter},opd:{title:"OPD",subtitle:"Registration, visit and fee collection",render:openOPD},ipd:{title:"IPD Admission",subtitle:"Admission, bed and initial deposit",render:openIPD},ipdCharges:{title:"IPD Daily Charges",subtitle:"Day-wise inpatient billing",render:openIPDCharges},ipdBilling:{title:"IPD Billing",subtitle:"Final billing and discharge",render:openIPDBilling},diagnostics:{title:"Diagnostics",subtitle:"Lab ECG X-ray CT",render:openDiagnostics},doctorMaster:{title:"Doctor Master",subtitle:"Doctor fee presets",render:openDoctorMaster},userManagement:{title:"User Management",subtitle:"Owner-only login control",render:openUserManagement},pharmacyStock:{title:"Pharmacy Stock",subtitle:"Pharmacy owner only",render:renderPharmacyStock},purchaseRegister:{title:"Purchase Register",subtitle:"Pharmacy purchase and stock entry",render:renderPurchaseRegister},purchaseReturns:{title:"Purchase Returns",subtitle:"Expired, near-expiry and supplier returns",render:openPurchaseReturns},supplierMaster:{title:"Supplier Master",subtitle:"Supplier directory",render:renderSupplierMaster},pharmacyBilling:{title:"Pharmacy Billing",subtitle:"Pharmacy staff billing and stock deduction",render:openPharmacyBilling},pharmacyCustomerReturns:{title:"Medicine Return",subtitle:"Patient returns, refunds and stock restoration",render:openPharmacyCustomerReturns},expenses:{title:"Expenses",subtitle:"Hospital operating expenses",render:openExpenses}};
function ensureView(name){let v=document.getElementById(name+"View");if(!v){v=document.createElement("section");v.id=name+"View";v.className="view hidden";document.querySelector("main.main")?.appendChild(v)}return v}
function setVisibleView(name){Object.keys(VIEWS).forEach(k=>ensureView(k));document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));document.getElementById(name+"View")?.classList.remove("hidden")}
async function navigate(name){if(name==="dashboard"&&currentUser?.role!=="owner"){name=navForRole(currentUser.role)[0]}const v=VIEWS[name];if(!v)return;document.getElementById("pageTitle").textContent=v.title;document.getElementById("pageSubtitle").textContent=v.subtitle;setVisibleView(name);document.querySelectorAll("#mainNav button").forEach(b=>b.classList.toggle("active",b.dataset.view===name));await v.render()}
function navForRole(role){if(role==="owner")return ["dashboard","patientSearch","cashReport","reports","doctorMaster","userManagement"];const base=(NAV_BY_ROLE[role]||[]).slice().filter(x=>x!=="dashboard"&&x!=="doctorMaster"&&x!=="printCenter"&&x!=="userManagement"&&x!=="medicineMaster");if(role==="staff"&&!base.includes("ipdCharges")){const i=base.indexOf("ipd");base.splice(i>=0?i+1:base.length,0,"ipdCharges")}if(role==="staff"&&!base.includes("ipdBilling")){const i=base.indexOf("ipdCharges");base.splice(i>=0?i+1:base.length,0,"ipdBilling")}if(role==="staff"&&!base.includes("diagnostics")){const i=base.indexOf("ipdBilling");base.splice(i>=0?i+1:base.length,0,"diagnostics")}if(role==="pharmacyOwner"){if(!base.includes("purchaseReturns")){const i=base.indexOf("purchaseRegister");base.splice(i>=0?i+1:base.length,0,"purchaseReturns")}if(!base.includes("pharmacyCustomerReturns")){const i=base.indexOf("pharmacyStock");base.splice(i>=0?i+1:base.length,0,"pharmacyCustomerReturns")}if(!base.includes("supplierMaster")){base.push("supplierMaster")}}if(role==="pharmacy"&&!base.includes("pharmacyCustomerReturns")){const i=base.indexOf("pharmacyBilling");base.splice(i>=0?i+1:base.length,0,"pharmacyCustomerReturns")}if(role==="accountant"&&!base.includes("cashBook")){base.splice(1,0,"cashBook")}if(role==="accountant"&&!base.includes("supplierMaster")){base.splice(2,0,"supplierMaster")}if(role==="accountant"&&!base.includes("expenses")){base.splice(1,0,"expenses")}return base}
function buildNav(){const nav=document.getElementById("mainNav");nav.innerHTML="";navForRole(currentUser.role).forEach(k=>{const b=document.createElement("button");b.textContent=VIEWS[k].title;b.dataset.view=k;b.onclick=()=>navigate(k);nav.appendChild(b)})}
function showApp(){document.getElementById("landingPage")?.classList.add("hidden");document.getElementById("loginPage").classList.add("hidden");document.getElementById("appShell").classList.remove("hidden");document.getElementById("roleBadge").textContent=ROLE_LABELS[currentUser.role]||currentUser.name||"User";buildNav();navigate(navForRole(currentUser.role)[0]||"dashboard");startReviveRealtimeSync()}
function loadScriptOnce(src){return new Promise((resolve,reject)=>{if(document.querySelector(`script[src="${src}"]`)){resolve();return}const s=document.createElement("script");s.src=src;s.onload=resolve;s.onerror=reject;document.body.appendChild(s)})}
async function openDoctorPortal(){await loadScriptOnce("doctor-portal.js");await loadScriptOnce("doctor-vitals.js");await loadScriptOnce("doctor-intraop.js");window.applyIntraopDischargePatches?.();return renderDoctorPortal()}
async function openDoctorDashboardV3(){await loadScriptOnce("doctor-portal-nav-v3.js?v=20260827-3");return VIEWS.doctorDashboard.render===openDoctorDashboardV3?renderDoctorPortal():VIEWS.doctorDashboard.render()}
async function openCurrentlyAdmittedV3(){await loadScriptOnce("doctor-portal-nav-v3.js?v=20260827-3");return VIEWS.currentlyAdmitted.render===openCurrentlyAdmittedV3?renderDoctorPortal():VIEWS.currentlyAdmitted.render()}
async function openDoctorPatientSearchRouteV3(){await loadScriptOnce("doctor-portal-nav-v3.js?v=20260827-3");return VIEWS.doctorPatientSearch.render===openDoctorPatientSearchRouteV3?renderDoctorPortal():VIEWS.doctorPatientSearch.render()}
async function openPharmacyBilling(){await loadScriptOnce("pharmacy-billing.js");return renderPharmacyBilling()}
async function openPharmacyCustomerReturns(){await loadScriptOnce("pharmacy-customer-returns.js");return renderPharmacyCustomerReturns()}
async function openPurchaseReturns(){await loadScriptOnce("purchase-returns.js");return renderPurchaseReturns()}
async function openCashBook(){await loadScriptOnce("cash-book.js");return renderCashBook()}
async function openReportsCenter(){await loadScriptOnce("reports.js");return renderReportsCenter()}
async function openOPD(){await loadScriptOnce("opd.js");await loadScriptOnce("opd-delete.js");return renderOPD()}
async function openIPD(){await loadScriptOnce("ipd.js");return renderIPD()}
async function openIPDCharges(){await loadScriptOnce("ipd-charges.js");return renderIPDCharges()}
async function openIPDBilling(){await loadScriptOnce("ipd-billing.js");await loadScriptOnce("ipd-discharge-print.js");await loadScriptOnce("doctor-intraop.js");window.applyIntraopDischargePatches?.();return renderIPDBilling()}
async function openDiagnostics(){await loadScriptOnce("diagnostics.js");return renderDiagnostics()}
async function openDoctorMaster(){await loadScriptOnce("doctor-master.js");return renderDoctorMaster()}
async function openUserManagement(){await loadScriptOnce("user-management.js");return renderUserManagement()}
async function openExpenses(){await loadScriptOnce("expenses.js");await loadScriptOnce("expenses-schema-fix.js");return renderExpenses()}

const loginForm=document.getElementById("loginForm");
const credentialStep=document.getElementById("credentialStep");
const otpStep=document.getElementById("otpStep");
const loginError=document.getElementById("loginError");
const loginHelp=document.getElementById("loginHelp");
const sendOtpBtn=document.getElementById("sendOtpBtn");
const verifyOtpBtn=document.getElementById("verifyOtpBtn");

loginForm.addEventListener("submit",async e=>{
  e.preventDefault();loginError.textContent="";sendOtpBtn.disabled=true;sendOtpBtn.textContent="Sending OTP...";
  try{const result=await ReviveOtpAuth.requestOtp(document.getElementById("username").value,document.getElementById("password").value);credentialStep.classList.add("hidden");otpStep.classList.remove("hidden");document.getElementById("loginOtp").required=true;loginHelp.textContent=`Approval code sent to ${result.emailHint||"the configured email"}.`;document.getElementById("loginOtp").focus()}
  catch(err){loginError.textContent=err.message}
  finally{sendOtpBtn.disabled=false;sendOtpBtn.textContent="Send OTP"}
});
verifyOtpBtn.addEventListener("click",async()=>{loginError.textContent="";verifyOtpBtn.disabled=true;verifyOtpBtn.textContent="Verifying...";try{await ReviveOtpAuth.verifyOtp(document.getElementById("loginOtp").value);showApp()}catch(err){loginError.textContent=err.message}finally{verifyOtpBtn.disabled=false;verifyOtpBtn.textContent="Verify & Login"}});
document.getElementById("backToLoginBtn").addEventListener("click",()=>{ReviveOtpAuth.cancel();otpStep.classList.add("hidden");credentialStep.classList.remove("hidden");document.getElementById("loginOtp").required=false;document.getElementById("loginOtp").value="";loginError.textContent="";loginHelp.textContent="Enter your credentials to receive an email approval code."});
document.getElementById("loginOtp").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();verifyOtpBtn.click()}});
document.getElementById("logoutBtn").onclick=()=>{logout();location.reload()};
if(restoreSession())showApp();

// Realtime differential refresh: no timer and no whole-page reload.
let reviveRealtimeChannel=null;
let reviveRealtimeBusy=false;
let reviveRealtimePending=false;
function reviveUserIsEditing(){const el=document.activeElement;if(!el)return false;const tag=(el.tagName||"").toLowerCase();return tag==="input"||tag==="textarea"||tag==="select"||el.isContentEditable}
function reviveActiveViewName(){const active=document.querySelector("#mainNav button.active");return active?.dataset?.view||null}
function reviveNodeKey(node){if(node?.nodeType!==1)return null;return node.id||node.dataset?.id||node.dataset?.key||node.dataset?.patientId||node.dataset?.admissionId||null}
function reviveSyncAttributes(live,fresh){Array.from(live.attributes||[]).forEach(a=>{if(!fresh.hasAttribute(a.name))live.removeAttribute(a.name)});Array.from(fresh.attributes||[]).forEach(a=>{if(live.getAttribute(a.name)!==a.value)live.setAttribute(a.name,a.value)})}
function reviveMorph(live,fresh){
  if(!live||!fresh)return;
  if(live.nodeType!==fresh.nodeType){live.replaceWith(fresh.cloneNode(true));return}
  if(live.nodeType===3){if(live.nodeValue!==fresh.nodeValue)live.nodeValue=fresh.nodeValue;return}
  if(live.nodeType!==1)return;
  if(live.tagName!==fresh.tagName){live.replaceWith(fresh.cloneNode(true));return}
  reviveSyncAttributes(live,fresh);
  if(["INPUT","TEXTAREA","SELECT"].includes(live.tagName)){if(document.activeElement!==live){if(live.value!==fresh.value)live.value=fresh.value;if("checked" in live&&live.checked!==fresh.checked)live.checked=fresh.checked}return}
  const liveChildren=Array.from(live.childNodes), freshChildren=Array.from(fresh.childNodes);
  const keyed=new Map();liveChildren.forEach((n,i)=>{const k=reviveNodeKey(n);if(k)keyed.set(k,{n,i})});
  for(let i=0;i<freshChildren.length;i++){
    const f=freshChildren[i], key=reviveNodeKey(f);let l=live.childNodes[i];
    if(key){const hit=keyed.get(key);if(hit&&hit.n!==l){live.insertBefore(hit.n,l||null);l=hit.n}}
    if(!l){live.appendChild(f.cloneNode(true));continue}
    reviveMorph(l,f)
  }
  while(live.childNodes.length>freshChildren.length)live.removeChild(live.lastChild)
}
async function reviveDifferentialRefresh(){
  if(reviveRealtimeBusy||document.hidden||!currentUser){reviveRealtimePending=true;return}
  if(reviveUserIsEditing()){reviveRealtimePending=true;return}
  const name=reviveActiveViewName();if(!name||!VIEWS[name])return;
  const live=document.getElementById(name+"View");if(!live)return;
  reviveRealtimeBusy=true;
  const originalId=live.id;const sandbox=document.createElement("section");
  sandbox.id=originalId;sandbox.className=live.className;sandbox.style.cssText="position:fixed;left:-100000px;top:0;width:"+(live.offsetWidth||1200)+"px;visibility:hidden;pointer-events:none";
  live.id=originalId+"__live";document.querySelector("main.main")?.appendChild(sandbox);
  try{await VIEWS[name].render();sandbox.removeAttribute("style");reviveMorph(live,sandbox);live.removeAttribute("style");reviveRealtimePending=false}
  catch(err){console.warn("Revive realtime refresh skipped:",err)}
  finally{sandbox.remove();live.id=originalId;reviveRealtimeBusy=false}
}
function startReviveRealtimeSync(){
  if(reviveRealtimeChannel||!window.db&&!db)return;
  try{
    const client=typeof db!=="undefined"?db:window.db;
    reviveRealtimeChannel=client.channel("revive-live-sync").on("postgres_changes",{event:"*",schema:"public"},()=>reviveDifferentialRefresh()).subscribe();
  }catch(err){console.warn("Revive realtime unavailable:",err)}
}
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&reviveRealtimePending)reviveDifferentialRefresh()});
document.addEventListener("focusout",()=>{if(reviveRealtimePending)setTimeout(reviveDifferentialRefresh,250)});
