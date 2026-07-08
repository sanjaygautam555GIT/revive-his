let editingDoctorId=null;

async function renderDoctorMaster(){
  const el=document.getElementById("doctorMasterView");
  el.innerHTML=`
    <div class="panel">
      <h2>Doctor Master</h2>
      <p>Owner can add doctors and edit OPD fee shown in Staff OPD.</p>
      <form id="doctorMasterForm">
        <input type="hidden" id="doctorEditId">
        <div class="grid" style="grid-template-columns:repeat(5,1fr)">
          <div><label>Doctor Name</label><input id="doctorName" placeholder="Dr name" required></div>
          <div><label>Department</label><select id="doctorDepartment"><option>Surgery</option><option>Oncosurgery</option><option>Gynecology</option><option>Gastro Surgery</option><option>Anaesthesia & Critical Care</option><option>Critical Care / ICU</option><option>General Medicine</option><option>Other</option></select></div>
          <div><label>OPD Fee</label><input id="doctorOpdFee" type="number" value="500" step="0.01"></div>
          <div><label>IPD Visit Fee</label><input id="doctorIpdFee" type="number" value="500" step="0.01"></div>
          <div><label>Procedure Fee</label><input id="doctorProcedureFee" type="number" value="0" step="0.01"></div>
        </div>
        <div class="grid" style="grid-template-columns:1fr 4fr;margin-top:10px">
          <div><label>Status</label><select id="doctorStatus"><option>Active</option><option>Inactive</option></select></div>
          <div><label>Remarks</label><input id="doctorRemarks" placeholder="Optional"></div>
        </div>
        <br><button type="submit" id="doctorSaveBtn">Save Doctor</button>
        <button type="button" class="secondary hidden" id="doctorCancelEditBtn">Cancel Edit</button>
        <div id="doctorMasterMessage"></div>
      </form>
    </div>
    <div class="panel table-wrap">
      <h3>Doctor List</h3>
      <table><thead><tr><th>Name</th><th>Department</th><th>OPD Fee</th><th>IPD Visit Fee</th><th>Procedure Fee</th><th>Status</th><th>Action</th></tr></thead><tbody id="doctorRows"></tbody></table>
    </div>`;
  document.getElementById("doctorMasterForm").onsubmit=saveDoctorMaster;
  document.getElementById("doctorCancelEditBtn").onclick=clearDoctorForm;
  await loadDoctorMaster();
}

function doctorPayload(){
  return {
    doctor_name:document.getElementById("doctorName").value.trim(),
    department:document.getElementById("doctorDepartment").value,
    opd_fee:safeNumber(document.getElementById("doctorOpdFee").value),
    ipd_visit_fee:safeNumber(document.getElementById("doctorIpdFee").value),
    procedure_fee:safeNumber(document.getElementById("doctorProcedureFee").value),
    status:document.getElementById("doctorStatus").value,
    remarks:document.getElementById("doctorRemarks").value.trim()
  };
}

async function saveDoctorMaster(e){
  e.preventDefault();
  const msg=document.getElementById("doctorMasterMessage");
  const id=document.getElementById("doctorEditId").value;
  const payload=doctorPayload();
  if(!payload.doctor_name){msg.innerHTML="<p class='error'>Doctor name is required.</p>";return;}
  let result;
  if(id){
    result=await db.from("doctor_master").update(payload).eq("id",id);
  }else{
    result=await db.from("doctor_master").insert([{...payload,created_at:new Date().toISOString()}]);
  }
  if(result.error){msg.innerHTML=`<p class='error'>Doctor save failed: ${result.error.message}</p>`;return;}
  msg.innerHTML=id?"<p class='success'>Doctor fee updated. Staff OPD will use the new OPD fee.</p>":"<p class='success'>Doctor saved.</p>";
  clearDoctorForm(false);
  await loadDoctorMaster();
}

function editDoctor(id){
  const d=(window.doctorMasterRows||[]).find(x=>String(x.id)===String(id));
  if(!d)return;
  editingDoctorId=id;
  document.getElementById("doctorEditId").value=d.id;
  document.getElementById("doctorName").value=d.doctor_name||"";
  document.getElementById("doctorDepartment").value=d.department||"Surgery";
  document.getElementById("doctorOpdFee").value=safeNumber(d.opd_fee||0);
  document.getElementById("doctorIpdFee").value=safeNumber(d.ipd_visit_fee||0);
  document.getElementById("doctorProcedureFee").value=safeNumber(d.procedure_fee||0);
  document.getElementById("doctorStatus").value=d.status||"Active";
  document.getElementById("doctorRemarks").value=d.remarks||"";
  document.getElementById("doctorSaveBtn").textContent="Update Doctor Fee";
  document.getElementById("doctorCancelEditBtn").classList.remove("hidden");
  document.getElementById("doctorMasterMessage").innerHTML="<p class='success'>Editing doctor. Change OPD Fee and click Update.</p>";
  window.scrollTo({top:0,behavior:"smooth"});
}

function clearDoctorForm(clearMessage=true){
  editingDoctorId=null;
  document.getElementById("doctorMasterForm").reset();
  document.getElementById("doctorEditId").value="";
  document.getElementById("doctorOpdFee").value="500";
  document.getElementById("doctorIpdFee").value="500";
  document.getElementById("doctorProcedureFee").value="0";
  document.getElementById("doctorSaveBtn").textContent="Save Doctor";
  document.getElementById("doctorCancelEditBtn").classList.add("hidden");
  if(clearMessage)document.getElementById("doctorMasterMessage").innerHTML="";
}

async function loadDoctorMaster(){
  const body=document.getElementById("doctorRows");
  const {data,error}=await db.from("doctor_master").select("*").order("doctor_name",{ascending:true});
  if(error){body.innerHTML=`<tr><td colspan='7' class='error'>${error.message}</td></tr>`;return;}
  window.doctorMasterRows=data||[];
  body.innerHTML=window.doctorMasterRows.length?window.doctorMasterRows.map(d=>`<tr><td>${d.doctor_name||""}</td><td>${d.department||""}</td><td><b>${money(d.opd_fee||0)}</b></td><td>${money(d.ipd_visit_fee||0)}</td><td>${money(d.procedure_fee||0)}</td><td>${d.status||"Active"}</td><td><button class="secondary" type="button" onclick="editDoctor(${d.id})">Edit Fee</button></td></tr>`).join(""):"<tr><td colspan='7'>No doctors saved.</td></tr>";
}