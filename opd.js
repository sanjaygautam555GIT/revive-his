let opdDoctorMaster=[];

async function renderOPD(){
  const el=document.getElementById("opdView");
  el.innerHTML=`
    <div class="panel">
      <h2>OPD V2 – Registration & Fee Collection</h2>
      <p>Fast reception entry: search patient, register visit, collect consultation fee, and update OPD register.</p>
      <div class="grid" style="grid-template-columns:1.4fr auto 1fr 1fr">
        <div><label>Search Patient</label><input id="opdSearchTerm" placeholder="Search by Name / Mobile / UHID"></div>
        <div><label>&nbsp;</label><button type="button" id="opdSearchBtn">Search Patient</button></div>
        <div><label>UHID</label><input id="opdUhid" readonly placeholder="Auto after save"></div>
        <div><label>Visit ID</label><input id="opdVisitId" readonly placeholder="Auto after save"></div>
      </div>
      <div id="opdSearchResult"></div>
    </div>

    <form id="opdForm" class="panel">
      <h3>Patient Details</h3>
      <input type="hidden" id="opdPatientId">
      <div class="grid" style="grid-template-columns:repeat(4,1fr)">
        <div><label>Patient Name</label><input id="opdName" required></div>
        <div><label>Age</label><input id="opdAge" type="number" min="0"></div>
        <div><label>Sex</label><select id="opdSex"><option>Male</option><option>Female</option><option>Other</option></select></div>
        <div><label>Mobile</label><input id="opdMobile" required></div>
      </div>
      <div class="grid" style="grid-template-columns:1fr"><div><label>Address</label><input id="opdAddress"></div></div>
      <h3>Visit Details</h3>
      <div class="grid" style="grid-template-columns:repeat(3,1fr)">
        <div><label>Consultant</label><select id="opdConsultant"></select></div>
        <div><label>Department</label><input id="opdDepartment" readonly placeholder="Auto from consultant"></div>
        <div><label>Visit Type</label><select id="opdVisitType"><option>New</option><option>Follow-up</option></select></div>
      </div>
      <h3>Billing</h3>
      <div class="grid" style="grid-template-columns:repeat(4,1fr)">
        <div><label>Consultation Fee</label><input id="opdFee" type="number" value="500" step="0.01"></div>
        <div><label>Discount</label><input id="opdDiscount" type="number" value="0" step="0.01"></div>
        <div><label>Net Amount</label><input id="opdNetAmount" readonly></div>
        <div><label>Payment Mode</label><select id="opdPaymentMode"><option>Cash</option><option>UPI</option><option>Bank</option><option>Credit</option></select></div>
      </div><br>
      <button type="submit">Save OPD Visit</button>
      <button type="button" class="secondary" id="opdResetBtn">Clear Form</button>
      <div id="opdMessage"></div>
    </form>
    <div class="panel table-wrap">
      <h3>Today's OPD Register</h3>
      <table><thead><tr><th>Token</th><th>Visit ID</th><th>UHID</th><th>Name</th><th>Department</th><th>Doctor</th><th>Fee</th><th>Mode</th><th>Print</th></tr></thead><tbody id="opdRows"></tbody></table>
    </div>`;
  document.getElementById("opdSearchBtn").onclick=searchOPDPatient;
  document.getElementById("opdSearchTerm").onkeydown=e=>{if(e.key==="Enter")searchOPDPatient()};
  document.getElementById("opdForm").onsubmit=saveOPDVisit;
  document.getElementById("opdResetBtn").onclick=clearOPDForm;
  document.getElementById("opdConsultant").onchange=applyOPDDoctorPreset;
  ["opdFee","opdDiscount"].forEach(id=>document.getElementById(id).oninput=calculateOPDNet);
  await loadOPDDoctors();
  calculateOPDNet();
  await loadOPDRegister();
}

function doctorSortPriority(d){
  const n=String(d.doctor_name||"").toLowerCase();
  if(n.includes("sanjay"))return 0;
  return 1;
}

async function loadOPDDoctors(){
  const select=document.getElementById("opdConsultant");
  const {data,error}=await db.from("doctor_master").select("*").order("doctor_name",{ascending:true});
  if(error){opdDoctorMaster=[];select.innerHTML="<option value=''>Doctor master not loaded</option>";return;}
  opdDoctorMaster=(data||[]).filter(d=>(d.status||"Active")==="Active").sort((a,b)=>doctorSortPriority(a)-doctorSortPriority(b)||String(a.doctor_name||"").localeCompare(String(b.doctor_name||"")));
  select.innerHTML=opdDoctorMaster.length?opdDoctorMaster.map(d=>`<option value="${d.id}">${d.doctor_name}</option>`).join(""):"<option value=''>No active doctor</option>";
  applyOPDDoctorPreset();
}

function selectedOPDDoctor(){const id=document.getElementById("opdConsultant")?.value;return (opdDoctorMaster||[]).find(d=>String(d.id)===String(id));}
function applyOPDDoctorPreset(){const d=selectedOPDDoctor();const dept=document.getElementById("opdDepartment");const fee=document.getElementById("opdFee");if(dept)dept.value=d?.department||"";if(fee&&d)fee.value=safeNumber(d.opd_fee||500);calculateOPDNet();}
function calculateOPDNet(){const fee=safeNumber(document.getElementById("opdFee")?.value);const discount=safeNumber(document.getElementById("opdDiscount")?.value);const net=Math.max(0,fee-discount);const el=document.getElementById("opdNetAmount");if(el)el.value=net.toFixed(2);}
async function searchOPDPatient(){const term=document.getElementById("opdSearchTerm").value.trim();const q=term.toLowerCase();const msg=document.getElementById("opdSearchResult");if(!term){msg.innerHTML="<p class='error'>Enter patient name, mobile or UHID to search.</p>";return;}const {data,error}=await db.from("patient").select("*").order("created_at",{ascending:false}).limit(500);if(error){msg.innerHTML=`<p class='error'>Search failed: ${error.message}</p>`;return;}const p=(data||[]).find(x=>[(x.name||x.patient_name||""),(x.mobile||""),(x.uhid||x.patient_id||"")].join(" ").toLowerCase().includes(q));if(!p){msg.innerHTML="<p class='error'>No previous patient found. Enter new patient details.</p>";document.getElementById("opdMobile").value=term;return;}await loadPatientIntoOPD(p,msg);}
async function loadPatientIntoOPD(p,msg){document.getElementById("opdPatientId").value=p.id||"";document.getElementById("opdUhid").value=p.uhid||p.patient_id||"";document.getElementById("opdName").value=p.name||p.patient_name||"";document.getElementById("opdAge").value=p.age||"";document.getElementById("opdSex").value=p.sex||p.gender||"Male";document.getElementById("opdMobile").value=p.mobile||"";document.getElementById("opdAddress").value=p.address||"";const visits=await fetchAll("opd_visits");const uhid=p.uhid||p.patient_id||"";const patientVisits=visits.filter(v=>(v.uhid&&v.uhid===uhid)||(v.mobile&&v.mobile===p.mobile)||(v.patient_name&&v.patient_name===(p.name||p.patient_name)));const last=patientVisits.map(v=>v.visit_date||rowDate(v)).filter(Boolean).sort().slice(-1)[0]||"-";msg.innerHTML=`<div class='sync-box'><b>Existing patient loaded</b><br>UHID: ${uhid||"-"} &nbsp; | &nbsp; Name: ${p.name||p.patient_name||"Patient"} &nbsp; | &nbsp; Age: ${p.age||"-"} &nbsp; | &nbsp; Last Visit: ${last} &nbsp; | &nbsp; Total Visits: ${patientVisits.length}</div>`;}
function generateUHID(){return `RVH-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`}
function generateVisitId(){return `OPD-${todayISO().replaceAll("-","")}-${String(Date.now()).slice(-4)}`}
async function saveOPDVisit(e){e.preventDefault();calculateOPDNet();const msg=document.getElementById("opdMessage");const name=document.getElementById("opdName").value.trim();const mobile=document.getElementById("opdMobile").value.trim();const doctor=selectedOPDDoctor();if(!name||!mobile){msg.innerHTML="<p class='error'>Patient name and mobile are required.</p>";return;}if(!doctor){msg.innerHTML="<p class='error'>Please select consultant from Doctor Master.</p>";return;}let patientId=document.getElementById("opdPatientId").value;let uhid=document.getElementById("opdUhid").value || generateUHID();const department=doctor.department||document.getElementById("opdDepartment").value;const consultant=doctor.doctor_name;const patientPayload={uhid,patient_id:uhid,name,patient_name:name,age:safeNumber(document.getElementById("opdAge").value),sex:document.getElementById("opdSex").value,mobile,address:document.getElementById("opdAddress").value.trim(),department,amount:safeNumber(document.getElementById("opdNetAmount").value),payment_mode:document.getElementById("opdPaymentMode").value,created_at:new Date().toISOString()};if(!patientId){const {data,error}=await db.from("patient").insert([patientPayload]).select().single();if(error){msg.innerHTML=`<p class='error'>Patient save failed: ${error.message}</p>`;return;}patientId=data.id;uhid=data.uhid||data.patient_id||uhid;}else{await db.from("patient").update(patientPayload).eq("id",patientId);}const visitId=generateVisitId();const visitPayload={visit_id:visitId,uhid,patient_id:patientId,patient_name:name,age:safeNumber(document.getElementById("opdAge").value),sex:document.getElementById("opdSex").value,mobile,department,consultant,visit_type:document.getElementById("opdVisitType").value,fee:safeNumber(document.getElementById("opdFee").value),discount:safeNumber(document.getElementById("opdDiscount").value),amount:safeNumber(document.getElementById("opdNetAmount").value),payment_mode:document.getElementById("opdPaymentMode").value,status:"Registered",visit_date:todayISO(),created_at:new Date().toISOString()};const {error:visitError}=await db.from("opd_visits").insert([visitPayload]);if(visitError){msg.innerHTML=`<p class='error'>OPD visit save failed: ${visitError.message}</p>`;return;}document.getElementById("opdPatientId").value=patientId;document.getElementById("opdUhid").value=uhid;document.getElementById("opdVisitId").value=visitId;msg.innerHTML=`<p class='success'>OPD visit saved. UHID: ${uhid}, Visit: ${visitId} <button type="button" class="secondary" onclick="printOPDSlip('${visitId}')">Print Slip</button></p>`;await loadOPDRegister();}
function clearOPDForm(){document.getElementById("opdForm").reset();document.getElementById("opdPatientId").value="";document.getElementById("opdUhid").value="";document.getElementById("opdVisitId").value="";document.getElementById("opdSearchResult").innerHTML="";document.getElementById("opdMessage").innerHTML="";applyOPDDoctorPreset();calculateOPDNet();}
async function loadOPDRegister(){const body=document.getElementById("opdRows");if(!body)return;const {data,error}=await db.from("opd_visits").select("*").eq("visit_date",todayISO()).order("created_at",{ascending:true});if(error){body.innerHTML=`<tr><td colspan='9' class='error'>${error.message}</td></tr>`;return;}const rows=data||[];body.innerHTML=rows.length?rows.map((r,i)=>`<tr><td>${String(i+1).padStart(3,"0")}</td><td>${r.visit_id||""}</td><td>${r.uhid||""}</td><td>${r.patient_name||""}</td><td>${r.department||""}</td><td>${r.consultant||""}</td><td>${money(r.amount||0)}</td><td>${r.payment_mode||""}</td><td><button class='secondary' onclick="printOPDSlip('${r.visit_id}')">Print</button></td></tr>`).join(""):"<tr><td colspan='9'>No OPD visits today.</td></tr>";}
