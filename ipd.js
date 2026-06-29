async function renderIPD(){
  const el=document.getElementById("ipdView");
  el.innerHTML=`
    <div class="panel">
      <h2>IPD Workflow V2</h2>
      <p>Admit patient, prevent duplicate bed allocation, collect deposit, and manage current admissions.</p>
      <div class="grid" style="grid-template-columns:1.4fr auto 1fr 1fr">
        <div><label>Search Patient</label><input id="ipdSearchTerm" placeholder="Search by Name / Mobile / UHID"></div>
        <div><label>&nbsp;</label><button type="button" id="ipdSearchBtn">Search Patient</button></div>
        <div><label>UHID</label><input id="ipdUhid" readonly placeholder="Select patient"></div>
        <div><label>Admission ID</label><input id="ipdAdmissionId" readonly placeholder="Auto after save"></div>
      </div>
      <div id="ipdSearchResult"></div>
    </div>

    <form id="ipdForm" class="panel">
      <h3>Patient Details</h3>
      <input type="hidden" id="ipdPatientId">
      <div class="grid" style="grid-template-columns:repeat(4,1fr)">
        <div><label>Patient Name</label><input id="ipdName" required></div>
        <div><label>Age</label><input id="ipdAge" type="number" min="0"></div>
        <div><label>Sex</label><select id="ipdSex"><option>Male</option><option>Female</option><option>Other</option></select></div>
        <div><label>Mobile</label><input id="ipdMobile" required></div>
      </div>
      <div><label>Address</label><input id="ipdAddress"></div>

      <h3>Admission Details</h3>
      <div class="grid" style="grid-template-columns:repeat(4,1fr)">
        <div><label>Admission Date</label><input id="ipdAdmissionDate" type="date"></div>
        <div><label>Department</label><select id="ipdDepartment"><option>Surgery</option><option>Oncosurgery</option><option>Gynecology</option><option>Gastro Surgery</option><option>Critical Care / ICU</option><option>General Medicine</option></select></div>
        <div><label>Consultant</label><input id="ipdConsultant" placeholder="Doctor name"></div>
        <div><label>Treatment Type</label><select id="ipdTreatmentType"><option>Operative</option><option>Conservative</option></select></div>
      </div>
      <div class="grid" style="grid-template-columns:repeat(3,1fr)">
        <div><label>Ward / Room Type</label><select id="ipdWardType"><option>General Ward</option><option>Private Room</option><option>ICU</option><option>Emergency</option></select></div>
        <div><label>Bed No</label><input id="ipdBedNo" placeholder="Required for bed check"></div>
        <div><label>Diagnosis / Indication</label><input id="ipdDiagnosis" placeholder="Admission diagnosis"></div>
      </div>

      <h3>Initial Deposit</h3>
      <div class="grid" style="grid-template-columns:repeat(4,1fr)">
        <div><label>Deposit Amount</label><input id="ipdDeposit" type="number" value="0" step="0.01"></div>
        <div><label>Payment Mode</label><select id="ipdPaymentMode"><option>Cash</option><option>UPI</option><option>Bank</option><option>Credit</option></select></div>
        <div><label>Deposit Date</label><input id="ipdDepositDate" type="date"></div>
        <div><label>Remarks</label><input id="ipdRemarks" placeholder="Optional"></div>
      </div>
      <br>
      <button type="submit">Save IPD Admission</button>
      <button type="button" class="secondary" id="ipdResetBtn">Clear Form</button>
      <div id="ipdMessage"></div>
    </form>

    <div class="panel table-wrap">
      <h3>Current IPD Admissions</h3>
      <table><thead><tr><th>Adm ID</th><th>UHID</th><th>Name</th><th>Department</th><th>Doctor</th><th>Ward/Bed</th><th>Treatment</th><th>Deposit</th><th>Status</th><th>Action</th></tr></thead><tbody id="ipdRows"></tbody></table>
    </div>
  `;
  document.getElementById("ipdAdmissionDate").value=todayISO();
  document.getElementById("ipdDepositDate").value=todayISO();
  document.getElementById("ipdSearchBtn").onclick=searchIPDPatient;
  document.getElementById("ipdSearchTerm").onkeydown=e=>{if(e.key==="Enter")searchIPDPatient()};
  document.getElementById("ipdForm").onsubmit=saveIPDAdmission;
  document.getElementById("ipdResetBtn").onclick=clearIPDForm;
  await loadIPDRegister();
}

async function searchIPDPatient(){
  const term=document.getElementById("ipdSearchTerm").value.trim();
  const q=term.toLowerCase();
  const msg=document.getElementById("ipdSearchResult");
  if(!term){msg.innerHTML="<p class='error'>Enter patient name, mobile or UHID to search.</p>";return;}
  const {data,error}=await db.from("patient").select("*").order("created_at",{ascending:false}).limit(500);
  if(error){msg.innerHTML=`<p class='error'>Search failed: ${error.message}</p>`;return;}
  const p=(data||[]).find(x=>[(x.name||x.patient_name||""),(x.mobile||""),(x.uhid||x.patient_id||"")].join(" ").toLowerCase().includes(q));
  if(!p){msg.innerHTML="<p class='error'>No patient found. Register patient in OPD first or enter details manually.</p>";document.getElementById("ipdMobile").value=term;return;}
  await loadPatientIntoIPD(p,msg);
}

async function loadPatientIntoIPD(p,msg){
  document.getElementById("ipdPatientId").value=p.id||"";
  document.getElementById("ipdUhid").value=p.uhid||p.patient_id||"";
  document.getElementById("ipdName").value=p.name||p.patient_name||"";
  document.getElementById("ipdAge").value=p.age||"";
  document.getElementById("ipdSex").value=p.sex||p.gender||"Male";
  document.getElementById("ipdMobile").value=p.mobile||"";
  document.getElementById("ipdAddress").value=p.address||"";
  const admissions=await fetchAll("ipd_admission");
  const uhid=p.uhid||p.patient_id||"";
  const prev=admissions.filter(v=>(v.uhid&&v.uhid===uhid)||(v.mobile&&v.mobile===p.mobile)||(v.patient_name&&v.patient_name===(p.name||p.patient_name)));
  msg.innerHTML=`<div class='sync-box'><b>Patient loaded</b><br>UHID: ${uhid||"-"} &nbsp; | &nbsp; Name: ${p.name||p.patient_name||"Patient"} &nbsp; | &nbsp; Age: ${p.age||"-"} &nbsp; | &nbsp; Previous IPD: ${prev.length}</div>`;
}

function generateAdmissionId(){return `IPD-${todayISO().replaceAll("-","")}-${String(Date.now()).slice(-4)}`}
function generateIPDUHID(){return `RVH-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`}

async function saveIPDAdmission(e){
  e.preventDefault();
  const msg=document.getElementById("ipdMessage");
  const name=document.getElementById("ipdName").value.trim();
  const mobile=document.getElementById("ipdMobile").value.trim();
  const wardType=document.getElementById("ipdWardType").value;
  const bedNo=document.getElementById("ipdBedNo").value.trim();
  if(!name||!mobile){msg.innerHTML="<p class='error'>Patient name and mobile are required.</p>";return;}
  if(!bedNo){msg.innerHTML="<p class='error'>Bed number is required for IPD admission.</p>";return;}

  const existing=await fetchAll("ipd_admission");
  const occupied=existing.find(r=>(r.status||"Admitted")!=="Discharged" && (r.ward_type||"")===wardType && String(r.bed_no||"").trim()===bedNo);
  if(occupied){msg.innerHTML=`<p class='error'>Bed already occupied: ${wardType} / ${bedNo} by ${occupied.patient_name||"another patient"}.</p>`;return;}

  let patientId=document.getElementById("ipdPatientId").value;
  let uhid=document.getElementById("ipdUhid").value || generateIPDUHID();
  const patientPayload={uhid,patient_id:uhid,name,patient_name:name,age:safeNumber(document.getElementById("ipdAge").value),sex:document.getElementById("ipdSex").value,mobile,address:document.getElementById("ipdAddress").value.trim(),department:document.getElementById("ipdDepartment").value,created_at:new Date().toISOString()};
  if(!patientId){
    const {data,error}=await db.from("patient").insert([patientPayload]).select().single();
    if(error){msg.innerHTML=`<p class='error'>Patient save failed: ${error.message}</p>`;return;}
    patientId=data.id;uhid=data.uhid||data.patient_id||uhid;
  }else{
    await db.from("patient").update(patientPayload).eq("id",patientId);
  }

  const admissionId=generateAdmissionId();
  const payload={admission_id:admissionId,uhid,patient_id:patientId,patient_name:name,age:safeNumber(document.getElementById("ipdAge").value),sex:document.getElementById("ipdSex").value,mobile,address:document.getElementById("ipdAddress").value.trim(),admission_date:document.getElementById("ipdAdmissionDate").value,department:document.getElementById("ipdDepartment").value,doctor:document.getElementById("ipdConsultant").value.trim(),consultant:document.getElementById("ipdConsultant").value.trim(),diagnosis:document.getElementById("ipdDiagnosis").value.trim(),treatment_type:document.getElementById("ipdTreatmentType").value,ward_type:wardType,bed_no:bedNo,advance:safeNumber(document.getElementById("ipdDeposit").value),deposit_amount:safeNumber(document.getElementById("ipdDeposit").value),payment_mode:document.getElementById("ipdPaymentMode").value,deposit_date:document.getElementById("ipdDepositDate").value,status:"Admitted",remarks:document.getElementById("ipdRemarks").value.trim(),created_at:new Date().toISOString()};
  const {error}=await db.from("ipd_admission").insert([payload]);
  if(error){msg.innerHTML=`<p class='error'>IPD admission save failed: ${error.message}</p>`;return;}
  document.getElementById("ipdPatientId").value=patientId;
  document.getElementById("ipdUhid").value=uhid;
  document.getElementById("ipdAdmissionId").value=admissionId;
  msg.innerHTML=`<p class='success'>IPD admission saved. UHID: ${uhid}, Admission: ${admissionId}</p>`;
  await loadIPDRegister();
}

async function dischargeIPD(id){
  if(!confirm("Mark this patient as discharged?"))return;
  const {error}=await db.from("ipd_admission").update({status:"Discharged",discharge_date:todayISO()}).eq("id",id);
  if(error){alert("Discharge failed: "+error.message);return;}
  await loadIPDRegister();
}

function clearIPDForm(){
  document.getElementById("ipdForm").reset();
  document.getElementById("ipdPatientId").value="";
  document.getElementById("ipdUhid").value="";
  document.getElementById("ipdAdmissionId").value="";
  document.getElementById("ipdSearchResult").innerHTML="";
  document.getElementById("ipdMessage").innerHTML="";
  document.getElementById("ipdAdmissionDate").value=todayISO();
  document.getElementById("ipdDepositDate").value=todayISO();
}

async function loadIPDRegister(){
  const body=document.getElementById("ipdRows");
  if(!body)return;
  const {data,error}=await db.from("ipd_admission").select("*").order("created_at",{ascending:false}).limit(50);
  if(error){body.innerHTML=`<tr><td colspan='10' class='error'>${error.message}</td></tr>`;return;}
  const rows=(data||[]).filter(r=>(r.status||"Admitted")!=="Discharged");
  body.innerHTML=rows.length?rows.map(r=>`<tr><td>${r.admission_id||r.id||""}</td><td>${r.uhid||""}</td><td>${r.patient_name||""}</td><td>${r.department||""}</td><td>${r.doctor||r.consultant||""}</td><td>${[r.ward_type,r.bed_no].filter(Boolean).join(" / ")}</td><td>${r.treatment_type||""}</td><td>${money(r.advance||r.deposit_amount||0)}</td><td>${r.status||"Admitted"}</td><td><button class="secondary" onclick="dischargeIPD(${r.id})">Discharge</button></td></tr>`).join(""):"<tr><td colspan='10'>No current IPD admissions.</td></tr>";
}
