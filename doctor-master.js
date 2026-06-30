async function renderDoctorMaster(){
  const el=document.getElementById("doctorMasterView");
  el.innerHTML=`
    <div class="panel">
      <h2>Doctor Master</h2>
      <p>Set doctor-wise OPD fee, IPD visit fee, and procedure fee.</p>
      <form id="doctorMasterForm">
        <div class="grid" style="grid-template-columns:repeat(5,1fr)">
          <div><label>Doctor Name</label><input id="doctorName" placeholder="Dr name" required></div>
          <div><label>Department</label><select id="doctorDepartment"><option>Surgery</option><option>Oncosurgery</option><option>Gynecology</option><option>Gastro Surgery</option><option>Critical Care / ICU</option><option>General Medicine</option><option>Other</option></select></div>
          <div><label>OPD Fee</label><input id="doctorOpdFee" type="number" value="500" step="0.01"></div>
          <div><label>IPD Visit Fee</label><input id="doctorIpdFee" type="number" value="500" step="0.01"></div>
          <div><label>Procedure Fee</label><input id="doctorProcedureFee" type="number" value="0" step="0.01"></div>
        </div>
        <div class="grid" style="grid-template-columns:1fr 4fr;margin-top:10px">
          <div><label>Status</label><select id="doctorStatus"><option>Active</option><option>Inactive</option></select></div>
          <div><label>Remarks</label><input id="doctorRemarks" placeholder="Optional"></div>
        </div>
        <br><button type="submit">Save Doctor</button>
        <div id="doctorMasterMessage"></div>
      </form>
    </div>
    <div class="panel table-wrap">
      <h3>Doctor List</h3>
      <table><thead><tr><th>Name</th><th>Department</th><th>OPD Fee</th><th>IPD Visit Fee</th><th>Procedure Fee</th><th>Status</th></tr></thead><tbody id="doctorRows"></tbody></table>
    </div>
  `;
  document.getElementById("doctorMasterForm").onsubmit=saveDoctorMaster;
  await loadDoctorMaster();
}

async function saveDoctorMaster(e){
  e.preventDefault();
  const msg=document.getElementById("doctorMasterMessage");
  const name=document.getElementById("doctorName").value.trim();
  if(!name){msg.innerHTML="<p class='error'>Doctor name is required.</p>";return;}
  const payload={doctor_name:name,department:document.getElementById("doctorDepartment").value,opd_fee:safeNumber(document.getElementById("doctorOpdFee").value),ipd_visit_fee:safeNumber(document.getElementById("doctorIpdFee").value),procedure_fee:safeNumber(document.getElementById("doctorProcedureFee").value),status:document.getElementById("doctorStatus").value,remarks:document.getElementById("doctorRemarks").value.trim(),created_at:new Date().toISOString()};
  const {error}=await db.from("doctor_master").insert([payload]);
  if(error){msg.innerHTML=`<p class='error'>Doctor save failed: ${error.message}</p>`;return;}
  msg.innerHTML="<p class='success'>Doctor saved.</p>";
  document.getElementById("doctorMasterForm").reset();
  document.getElementById("doctorOpdFee").value="500";
  document.getElementById("doctorIpdFee").value="500";
  document.getElementById("doctorProcedureFee").value="0";
  await loadDoctorMaster();
}

async function loadDoctorMaster(){
  const body=document.getElementById("doctorRows");
  const {data,error}=await db.from("doctor_master").select("*").order("doctor_name",{ascending:true});
  if(error){body.innerHTML=`<tr><td colspan='6' class='error'>${error.message}</td></tr>`;return;}
  body.innerHTML=(data||[]).length?(data||[]).map(d=>`<tr><td>${d.doctor_name||""}</td><td>${d.department||""}</td><td>${money(d.opd_fee||0)}</td><td>${money(d.ipd_visit_fee||0)}</td><td>${money(d.procedure_fee||0)}</td><td>${d.status||"Active"}</td></tr>`).join(""):"<tr><td colspan='6'>No doctors saved.</td></tr>";
}
