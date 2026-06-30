let ipdChargeState={admission:null,charges:[],wardRates:[]};
const DEFAULT_WARD_RATES={"General Ward":500,"Private Room":1500,"ICU":3000,"Emergency":1000};

function dateISOFromDate(d){return d.toISOString().slice(0,10)}
function ipdAdmissionStartISO(a){return (a.admission_date||a.created_at||todayISO()).slice(0,10)}
function ipdStayDays(a){
  const start=new Date(ipdAdmissionStartISO(a));
  const end=new Date(todayISO());
  return Math.max(1,Math.ceil((end-start)/(1000*60*60*24))+1);
}
function ipdStayDateList(a){
  const dates=[];
  const start=new Date(ipdAdmissionStartISO(a));
  const days=ipdStayDays(a);
  for(let i=0;i<days;i++){const d=new Date(start);d.setDate(d.getDate()+i);dates.push(dateISOFromDate(d));}
  return dates;
}
function existingBedChargeDates(){
  return new Set((ipdChargeState.charges||[]).filter(c=>c.category==="Bed Charge").map(c=>(c.charge_date||rowDate(c)||"").slice(0,10)).filter(Boolean));
}

async function renderIPDCharges(){
  const el=document.getElementById("ipdChargesView");
  el.innerHTML=`
    <div class="panel">
      <h2>IPD Daily Charges</h2>
      <p>Add day-wise IPD charges. Bed charge is generated from Ward/Bed Rate Master.</p>
      <div class="form-row"><div><label>Search Active Admission</label><input id="ipdChargeSearch" placeholder="Admission ID / UHID / patient name"></div><button id="ipdChargeSearchBtn">Search</button></div>
      <div id="ipdChargeSearchResult"></div>
    </div>

    <details class="panel" open>
      <summary><b>Ward / Bed Rate Master</b></summary>
      <p>Set daily bed rates once. Bed charge generator will use these rates.</p>
      <form id="wardRateForm" class="grid" style="grid-template-columns:repeat(4,1fr);margin-top:12px">
        <div><label>Ward / Room Type</label><select id="rateWardType"><option>General Ward</option><option>Private Room</option><option>ICU</option><option>Emergency</option></select></div>
        <div><label>Daily Rate</label><input id="rateAmount" type="number" value="500" step="0.01"></div>
        <div><label>Status</label><select id="rateStatus"><option>Active</option><option>Inactive</option></select></div>
        <div><label>&nbsp;</label><button type="submit">Save Rate</button></div>
      </form>
      <div id="wardRateMessage"></div>
      <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Ward Type</th><th>Daily Rate</th><th>Status</th></tr></thead><tbody id="wardRateRows"></tbody></table></div>
    </details>

    <div id="ipdChargeWorkspace" class="hidden">
      <div class="panel" id="ipdChargeAdmissionSummary"></div>
      <form class="panel" id="ipdChargeForm">
        <h3>Add Other Charges</h3>
        <div class="grid" style="grid-template-columns:repeat(5,1fr)">
          <div><label>Date</label><input id="chargeDate" type="date"></div>
          <div><label>Category</label><select id="chargeCategory"><option>Doctor Charge</option><option>OT Charge</option><option>Anaesthesia</option><option>Nursing Charge</option><option>Consumables</option><option>Procedure Charge</option><option>Lab Charge</option><option>Other</option></select></div>
          <div><label>Description</label><input id="chargeDescription" placeholder="Description"></div>
          <div><label>Rate</label><input id="chargeRate" type="number" value="0" step="0.01"></div>
          <div><label>Qty</label><input id="chargeQty" type="number" value="1" step="0.01"></div>
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
  document.getElementById("wardRateForm").onsubmit=saveWardRate;
  document.getElementById("rateWardType").onchange=()=>{document.getElementById("rateAmount").value=DEFAULT_WARD_RATES[document.getElementById("rateWardType").value]||500};
  await loadWardRates();
}

async function loadWardRates(){
  const body=document.getElementById("wardRateRows");
  const {data,error}=await db.from("ward_rate_master").select("*").order("ward_type",{ascending:true});
  if(error){body.innerHTML=`<tr><td colspan='3' class='error'>${error.message}</td></tr>`;return;}
  ipdChargeState.wardRates=data||[];
  body.innerHTML=ipdChargeState.wardRates.length?ipdChargeState.wardRates.map(r=>`<tr><td>${r.ward_type||""}</td><td>${money(r.daily_rate||0)}</td><td>${r.status||"Active"}</td></tr>`).join(""):"<tr><td colspan='3'>No ward rates saved. Defaults will be used.</td></tr>";
}

async function saveWardRate(e){
  e.preventDefault();
  const msg=document.getElementById("wardRateMessage");
  const wardType=document.getElementById("rateWardType").value;
  const payload={ward_type:wardType,daily_rate:safeNumber(document.getElementById("rateAmount").value),status:document.getElementById("rateStatus").value,created_at:new Date().toISOString()};
  const existing=ipdChargeState.wardRates.find(r=>r.ward_type===wardType);
  let error;
  if(existing){({error}=await db.from("ward_rate_master").update(payload).eq("id",existing.id));}
  else {({error}=await db.from("ward_rate_master").insert([payload]));}
  if(error){msg.innerHTML=`<p class='error'>Rate save failed: ${error.message}</p>`;return;}
  msg.innerHTML="<p class='success'>Ward rate saved.</p>";
  await loadWardRates();
  if(ipdChargeState.admission)renderChargeAdmissionSummary();
}

function getWardRate(wardType){
  const row=(ipdChargeState.wardRates||[]).find(r=>r.ward_type===wardType && (r.status||"Active")==="Active");
  return safeNumber(row?.daily_rate || DEFAULT_WARD_RATES[wardType] || 500);
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
  await loadIPDCharges();
  renderChargeAdmissionSummary();
}

function renderChargeAdmissionSummary(){
  const a=ipdChargeState.admission;
  const rate=getWardRate(a.ward_type||"General Ward");
  const days=ipdStayDays(a);
  const bedAmount=rate*days;
  const chargedDates=existingBedChargeDates();
  const missingDates=ipdStayDateList(a).filter(d=>!chargedDates.has(d));
  const pendingAmount=missingDates.length*rate;
  document.getElementById("ipdChargeAdmissionSummary").innerHTML=`
    <h3>Admission Summary</h3>
    <div class="grid" style="grid-template-columns:repeat(5,1fr)">
      <div><b>Admission</b><br>${a.admission_id||a.id||""}</div>
      <div><b>UHID</b><br>${a.uhid||""}</div>
      <div><b>Patient</b><br>${a.patient_name||""}</div>
      <div><b>Ward/Bed</b><br>${[a.ward_type,a.bed_no].filter(Boolean).join(" / ")}</div>
      <div><b>Stay</b><br>${days} day(s)</div>
      <div><b>Daily Rate</b><br>${money(rate)}</div>
      <div><b>Total Bed Charge</b><br>${money(bedAmount)}</div>
      <div><b>Pending Bed Days</b><br>${missingDates.length} day(s)</div>
      <div><b>Pending Amount</b><br>${money(pendingAmount)}</div>
      <div><label>&nbsp;</label><button type="button" class="secondary" onclick="autoCreateBedCharge()" ${missingDates.length?"":"disabled"}>Generate Missing Bed Charges</button></div>
    </div>`;
}

async function saveIPDCharge(e){
  e.preventDefault();
  const msg=document.getElementById("ipdChargeMessage");
  const a=ipdChargeState.admission;
  if(!a){msg.innerHTML="<p class='error'>Load admission first.</p>";return;}
  const rate=safeNumber(document.getElementById("chargeRate").value);
  const qty=safeNumber(document.getElementById("chargeQty").value)||1;
  const payload={admission_id:a.admission_id||String(a.id),uhid:a.uhid,patient_name:a.patient_name,charge_date:document.getElementById("chargeDate").value,category:document.getElementById("chargeCategory").value,description:document.getElementById("chargeDescription").value.trim()||document.getElementById("chargeCategory").value,rate,quantity:qty,amount:rate*qty,created_at:new Date().toISOString()};
  const {error}=await db.from("ipd_daily_charges").insert([payload]);
  if(error){msg.innerHTML=`<p class='error'>Charge save failed: ${error.message}</p>`;return;}
  msg.innerHTML="<p class='success'>Charge saved.</p>";
  document.getElementById("chargeDescription").value="";document.getElementById("chargeRate").value="0";document.getElementById("chargeQty").value="1";
  await loadIPDCharges();renderChargeAdmissionSummary();
}

async function autoCreateBedCharge(){
  const a=ipdChargeState.admission;
  const msg=document.getElementById("ipdChargeMessage");
  if(!a){return;}
  const rate=getWardRate(a.ward_type||"General Ward");
  const admissionId=a.admission_id||String(a.id);
  const chargedDates=existingBedChargeDates();
  const missingDates=ipdStayDateList(a).filter(d=>!chargedDates.has(d));
  if(!missingDates.length){if(msg)msg.innerHTML="<p class='success'>All bed charges are already generated up to today.</p>";return;}
  const rows=missingDates.map(d=>({admission_id:admissionId,uhid:a.uhid,patient_name:a.patient_name,charge_date:d,category:"Bed Charge",description:`Auto ${a.ward_type||"Ward"} charge`,rate,quantity:1,amount:rate,created_at:new Date().toISOString()}));
  const {error}=await db.from("ipd_daily_charges").insert(rows);
  if(error){if(msg)msg.innerHTML=`<p class='error'>Auto bed charge failed: ${error.message}</p>`;return;}
  if(msg)msg.innerHTML=`<p class='success'>Generated ${missingDates.length} missing bed charge day(s): ${money(rate*missingDates.length)}.</p>`;
  await loadIPDCharges();renderChargeAdmissionSummary();
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
