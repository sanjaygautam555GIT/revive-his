let ipdChargeState={admission:null,charges:[]};

async function renderIPDCharges(){
  const el=document.getElementById("ipdChargesView");
  el.innerHTML=`
    <div class="panel">
      <h2>IPD Daily Charges</h2>
      <p>Add day-wise IPD charges including bed charge. Final IPD bill will import these charges automatically.</p>
      <div class="form-row"><div><label>Search Active Admission</label><input id="ipdChargeSearch" placeholder="Admission ID / UHID / patient name"></div><button id="ipdChargeSearchBtn">Search</button></div>
      <div id="ipdChargeSearchResult"></div>
    </div>

    <div id="ipdChargeWorkspace" class="hidden">
      <div class="panel" id="ipdChargeAdmissionSummary"></div>
      <form class="panel" id="ipdChargeForm">
        <h3>Add Daily Charge</h3>
        <div class="grid" style="grid-template-columns:repeat(5,1fr)">
          <div><label>Date</label><input id="chargeDate" type="date"></div>
          <div><label>Category</label><select id="chargeCategory"><option>Bed Charge</option><option>Doctor Charge</option><option>OT Charge</option><option>Anaesthesia</option><option>Nursing Charge</option><option>Consumables</option><option>Procedure Charge</option><option>Lab Charge</option><option>Other</option></select></div>
          <div><label>Description</label><input id="chargeDescription" placeholder="Description"></div>
          <div><label>Rate</label><input id="chargeRate" type="number" value="0" step="0.01"></div>
          <div><label>Qty / Days</label><input id="chargeQty" type="number" value="1" step="0.01"></div>
        </div>
        <br><button type="submit">Save Charge</button>
        <div id="ipdChargeMessage"></div>
      </form>
      <div class="panel table-wrap">
        <h3>Saved IPD Charges</h3>
        <table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Rate</th><th>Qty</th><th>Amount</th></tr></thead><tbody id="ipdChargeRows"></tbody></table>
      </div>
    </div>
  `;
  document.getElementById("chargeDate").value=todayISO();
  document.getElementById("ipdChargeSearchBtn").onclick=searchIPDChargeAdmission;
  document.getElementById("ipdChargeSearch").onkeydown=e=>{if(e.key==="Enter")searchIPDChargeAdmission()};
  document.getElementById("ipdChargeForm").onsubmit=saveIPDCharge;
}

async function searchIPDChargeAdmission(){
  const q=document.getElementById("ipdChargeSearch").value.trim().toLowerCase();
  const msg=document.getElementById("ipdChargeSearchResult");
  if(!q){msg.innerHTML="<p class='error'>Enter admission ID, UHID or patient name.</p>";return;}
  const rows=await fetchAll("ipd_admission");
  const active=rows.filter(r=>(r.status||"Admitted")!=="Discharged");
  const admission=active.find(r=>[r.admission_id,r.uhid,r.patient_name,r.mobile].join(" ").toLowerCase().includes(q));
  if(!admission){msg.innerHTML="<p class='error'>No active admission found.</p>";return;}
  ipdChargeState.admission=admission;
  document.getElementById("ipdChargeWorkspace").classList.remove("hidden");
  msg.innerHTML=`<p class='success'>Admission loaded: ${admission.patient_name||"Patient"}</p>`;
  renderChargeAdmissionSummary();
  await loadIPDCharges();
}

function renderChargeAdmissionSummary(){
  const a=ipdChargeState.admission;
  document.getElementById("ipdChargeAdmissionSummary").innerHTML=`
    <h3>Admission Summary</h3>
    <div class="grid" style="grid-template-columns:repeat(4,1fr)">
      <div><b>Admission</b><br>${a.admission_id||a.id||""}</div>
      <div><b>UHID</b><br>${a.uhid||""}</div>
      <div><b>Patient</b><br>${a.patient_name||""}</div>
      <div><b>Ward/Bed</b><br>${[a.ward_type,a.bed_no].filter(Boolean).join(" / ")}</div>
      <div><b>Admission Date</b><br>${a.admission_date||rowDate(a)||""}</div>
      <div><b>Doctor</b><br>${a.doctor||a.consultant||""}</div>
      <div><b>Diagnosis</b><br>${a.diagnosis||""}</div>
    </div>`;
}

async function saveIPDCharge(e){
  e.preventDefault();
  const msg=document.getElementById("ipdChargeMessage");
  const a=ipdChargeState.admission;
  if(!a){msg.innerHTML="<p class='error'>Load admission first.</p>";return;}
  const rate=safeNumber(document.getElementById("chargeRate").value);
  const qty=safeNumber(document.getElementById("chargeQty").value)||1;
  const category=document.getElementById("chargeCategory").value;
  const payload={admission_id:a.admission_id||String(a.id),uhid:a.uhid,patient_name:a.patient_name,charge_date:document.getElementById("chargeDate").value,category,description:document.getElementById("chargeDescription").value.trim()||category,rate,quantity:qty,amount:rate*qty,created_at:new Date().toISOString()};
  const {error}=await db.from("ipd_daily_charges").insert([payload]);
  if(error){msg.innerHTML=`<p class='error'>Charge save failed: ${error.message}</p>`;return;}
  msg.innerHTML="<p class='success'>Charge saved.</p>";
  document.getElementById("chargeDescription").value="";
  document.getElementById("chargeRate").value="0";
  document.getElementById("chargeQty").value="1";
  await loadIPDCharges();
}

async function loadIPDCharges(){
  const a=ipdChargeState.admission;
  const body=document.getElementById("ipdChargeRows");
  const admissionId=a.admission_id||String(a.id);
  const {data,error}=await db.from("ipd_daily_charges").select("*").eq("admission_id",admissionId).order("charge_date",{ascending:true});
  if(error){body.innerHTML=`<tr><td colspan='6' class='error'>${error.message}</td></tr>`;return;}
  ipdChargeState.charges=data||[];
  body.innerHTML=ipdChargeState.charges.length?ipdChargeState.charges.map(c=>`<tr><td>${c.charge_date||rowDate(c)}</td><td>${c.category||""}</td><td>${c.description||""}</td><td>${money(c.rate||0)}</td><td>${c.quantity||0}</td><td>${money(c.amount||0)}</td></tr>`).join(""):"<tr><td colspan='6'>No charges yet.</td></tr>";
}
