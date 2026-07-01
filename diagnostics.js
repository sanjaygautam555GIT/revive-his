let diagnosticsState={patient:null,admission:null,items:[],tests:[]};
const DEFAULT_DIAGNOSTICS=[
  ["CBC",250],["Hb",100],["ESR",150],["Platelet Count",150],["KFT",500],["LFT",500],["Electrolytes",500],["Lipid Profile",700],["HIV I & II",500],["HBsAg",400],["HCV",500],["VDRL",300],["RA Factor",500],["HbA1c",600],["RBS",100],["Blood Sugar Fasting",100],["Blood Sugar PP",100],["Troponin I",900],["CA 125",1500],["CA 19-9",2000],["CEA",1500],["AFP",1500],["LDH",400],["Beta-hCG",800],["Amylase",500],["Lipase",700],["CRP",500],["Urine Routine Microscopy",150],["Urine Culture",600],["Ascitic Fluid Analysis",700],["Pleural Fluid Analysis",700],["aPTT",400],["PT/INR",400],["BT/CT",150],["D-Dimer",1200],["ECG",300],["X-Ray",500],["CT",3000],["Others",0]
];

async function renderDiagnostics(){
  const el=document.getElementById("diagnosticsView");
  el.innerHTML=`
    <div class="panel">
      <h2>Diagnostics V1</h2>
      <p>Lab, ECG, X-ray and CT billing. IPD diagnostics automatically post to IPD Daily Charges.</p>
      <button type="button" id="seedDiagnosticsBtn" class="secondary">Load Default Tests</button>
      <div id="diagnosticsSeedMessage"></div>
    </div>

    <div class="panel">
      <h3>Diagnostics Test Master</h3>
      <form id="diagnosticTestForm">
        <div class="grid" style="grid-template-columns:2fr 1fr 1fr auto">
          <div><label>Test / Investigation Name</label><input id="diagTestName" placeholder="CBC / ECG / X-Ray" required></div>
          <div><label>Price</label><input id="diagTestPrice" type="number" value="0" step="0.01"></div>
          <div><label>Status</label><select id="diagTestStatus"><option>Active</option><option>Inactive</option></select></div>
          <div><label>&nbsp;</label><button type="submit">Save Test</button></div>
        </div>
      </form>
      <div id="diagnosticTestMessage"></div>
      <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Test Name</th><th>Price</th><th>Status</th></tr></thead><tbody id="diagnosticTestRows"></tbody></table></div>
    </div>

    <div class="panel">
      <h3>Diagnostics Billing</h3>
      <div class="grid" style="grid-template-columns:1.3fr auto 1fr 1fr">
        <div><label>Search Patient / Admission</label><input id="diagPatientSearch" placeholder="Name / mobile / UHID / admission ID"></div>
        <div><label>&nbsp;</label><button type="button" id="diagSearchBtn">Search</button></div>
        <div><label>Billing Type</label><select id="diagBillingType"><option>OPD</option><option>IPD</option></select></div>
        <div><label>Payment Mode</label><select id="diagPaymentMode"><option>Cash</option><option>UPI</option><option>Bank</option><option>Credit</option></select></div>
      </div>
      <div id="diagPatientResult"></div>
      <hr>
      <div class="grid" style="grid-template-columns:2fr 1fr 1fr auto">
        <div><label>Select Test</label><select id="diagTestSelect"></select></div>
        <div><label>Price</label><input id="diagItemPrice" type="number" value="0" step="0.01"></div>
        <div><label>Qty</label><input id="diagItemQty" type="number" value="1" step="0.01"></div>
        <div><label>&nbsp;</label><button type="button" id="addDiagItemBtn">Add</button></div>
      </div>
      <div id="otherDiagBox" class="hidden" style="margin-top:10px"><label>Other Test Name</label><input id="otherDiagName" placeholder="Enter test name"></div>
    </div>

    <div class="panel table-wrap">
      <h3>Selected Investigations</h3>
      <table><thead><tr><th>Test</th><th>Price</th><th>Qty</th><th>Amount</th><th>Action</th></tr></thead><tbody id="diagItemRows"></tbody></table>
      <h3>Total: <span id="diagTotal">₹0</span></h3>
      <button id="saveDiagnosticsBillBtn">Save Diagnostics Bill</button>
      <div id="diagnosticsBillMessage"></div>
    </div>

    <div class="panel table-wrap">
      <h3>Diagnostics Register</h3>
      <table><thead><tr><th>Bill No</th><th>Date</th><th>Patient</th><th>Type</th><th>Tests</th><th>Total</th><th>Mode</th></tr></thead><tbody id="diagnosticsRegisterRows"></tbody></table>
    </div>
  `;
  document.getElementById("seedDiagnosticsBtn").onclick=seedDiagnosticsTests;
  document.getElementById("diagnosticTestForm").onsubmit=saveDiagnosticTest;
  document.getElementById("diagSearchBtn").onclick=searchDiagnosticsPatient;
  document.getElementById("diagPatientSearch").onkeydown=e=>{if(e.key==="Enter")searchDiagnosticsPatient()};
  document.getElementById("diagTestSelect").onchange=applyDiagnosticTestPreset;
  document.getElementById("addDiagItemBtn").onclick=addDiagnosticItem;
  document.getElementById("saveDiagnosticsBillBtn").onclick=saveDiagnosticsBill;
  await loadDiagnosticTests();
  await loadDiagnosticsRegister();
}

async function seedDiagnosticsTests(){
  const msg=document.getElementById("diagnosticsSeedMessage");
  const existing=await fetchAll("diagnostic_test_master");
  const names=new Set(existing.map(x=>(x.test_name||"").toLowerCase()));
  const rows=DEFAULT_DIAGNOSTICS.filter(([n])=>!names.has(n.toLowerCase())).map(([test_name,price])=>({test_name,price,status:"Active",created_at:new Date().toISOString()}));
  if(!rows.length){msg.innerHTML="<p class='success'>Default tests already loaded.</p>";return;}
  const {error}=await db.from("diagnostic_test_master").insert(rows);
  if(error){msg.innerHTML=`<p class='error'>Default load failed: ${error.message}</p>`;return;}
  msg.innerHTML=`<p class='success'>${rows.length} default tests loaded.</p>`;
  await loadDiagnosticTests();
}

async function saveDiagnosticTest(e){
  e.preventDefault();
  const msg=document.getElementById("diagnosticTestMessage");
  const payload={test_name:document.getElementById("diagTestName").value.trim(),price:safeNumber(document.getElementById("diagTestPrice").value),status:document.getElementById("diagTestStatus").value,created_at:new Date().toISOString()};
  const {error}=await db.from("diagnostic_test_master").insert([payload]);
  if(error){msg.innerHTML=`<p class='error'>Save failed: ${error.message}</p>`;return;}
  msg.innerHTML="<p class='success'>Test saved.</p>";
  document.getElementById("diagnosticTestForm").reset();
  document.getElementById("diagTestPrice").value="0";
  await loadDiagnosticTests();
}

async function loadDiagnosticTests(){
  const body=document.getElementById("diagnosticTestRows");
  const select=document.getElementById("diagTestSelect");
  const {data,error}=await db.from("diagnostic_test_master").select("*").order("test_name",{ascending:true});
  if(error){if(body)body.innerHTML=`<tr><td colspan='3' class='error'>${error.message}</td></tr>`;return;}
  diagnosticsState.tests=data||[];
  const active=diagnosticsState.tests.filter(t=>(t.status||"Active")==="Active");
  if(body)body.innerHTML=diagnosticsState.tests.length?diagnosticsState.tests.map(t=>`<tr><td>${t.test_name||""}</td><td>${money(t.price||0)}</td><td>${t.status||"Active"}</td></tr>`).join(""):"<tr><td colspan='3'>No tests saved.</td></tr>";
  if(select)select.innerHTML=active.length?active.map(t=>`<option value="${t.id}">${t.test_name}</option>`).join(""):"<option value=''>No tests</option>";
  applyDiagnosticTestPreset();
}

function selectedDiagnosticTest(){
  const id=document.getElementById("diagTestSelect")?.value;
  return diagnosticsState.tests.find(t=>String(t.id)===String(id));
}
function applyDiagnosticTestPreset(){
  const t=selectedDiagnosticTest();
  const price=document.getElementById("diagItemPrice");
  const other=document.getElementById("otherDiagBox");
  if(price)price.value=safeNumber(t?.price||0);
  if(other)other.classList.toggle("hidden",(t?.test_name||"")!=="Others");
}

async function searchDiagnosticsPatient(){
  const term=document.getElementById("diagPatientSearch").value.trim().toLowerCase();
  const type=document.getElementById("diagBillingType").value;
  const msg=document.getElementById("diagPatientResult");
  diagnosticsState.patient=null;diagnosticsState.admission=null;
  if(!term){msg.innerHTML="<p class='error'>Enter patient or admission search.</p>";return;}
  if(type==="IPD"){
    const admissions=await fetchAll("ipd_admission");
    const a=admissions.find(r=>(r.status||"Admitted")!=="Discharged" && [r.admission_id,r.uhid,r.patient_name,r.mobile].join(" ").toLowerCase().includes(term));
    if(!a){msg.innerHTML="<p class='error'>No active IPD admission found.</p>";return;}
    diagnosticsState.admission=a;
    diagnosticsState.patient={uhid:a.uhid,patient_name:a.patient_name,name:a.patient_name,mobile:a.mobile};
    msg.innerHTML=`<div class='sync-box'><b>IPD loaded</b><br>${a.patient_name||"Patient"} · ${a.uhid||""} · ${a.admission_id||""}</div>`;
  }else{
    const patients=await fetchAll("patient");
    const p=patients.find(r=>[r.uhid,r.patient_id,r.name,r.patient_name,r.mobile].join(" ").toLowerCase().includes(term));
    if(!p){msg.innerHTML="<p class='error'>No patient found.</p>";return;}
    diagnosticsState.patient=p;
    msg.innerHTML=`<div class='sync-box'><b>Patient loaded</b><br>${p.name||p.patient_name||"Patient"} · ${p.uhid||p.patient_id||""}</div>`;
  }
}

function addDiagnosticItem(){
  const t=selectedDiagnosticTest();
  if(!t)return;
  const isOther=(t.test_name||"")==="Others";
  const name=isOther?(document.getElementById("otherDiagName").value.trim()||"Others"):t.test_name;
  const price=safeNumber(document.getElementById("diagItemPrice").value);
  const qty=safeNumber(document.getElementById("diagItemQty").value)||1;
  diagnosticsState.items.push({test_id:t.id,test_name:name,price,qty,amount:price*qty});
  document.getElementById("diagItemQty").value="1";
  if(document.getElementById("otherDiagName"))document.getElementById("otherDiagName").value="";
  renderDiagnosticItems();
}
function removeDiagnosticItem(i){diagnosticsState.items.splice(i,1);renderDiagnosticItems();}
function renderDiagnosticItems(){
  const body=document.getElementById("diagItemRows");
  const total=diagnosticsState.items.reduce((s,i)=>s+safeNumber(i.amount),0);
  body.innerHTML=diagnosticsState.items.length?diagnosticsState.items.map((i,idx)=>`<tr><td>${i.test_name}</td><td>${money(i.price)}</td><td>${i.qty}</td><td>${money(i.amount)}</td><td><button class='secondary' onclick='removeDiagnosticItem(${idx})'>Remove</button></td></tr>`).join(""):"<tr><td colspan='5'>No tests added.</td></tr>";
  document.getElementById("diagTotal").textContent=money(total);
}
function generateDiagnosticBillNo(){return `DIAG-${todayISO().replaceAll("-","")}-${String(Date.now()).slice(-4)}`}

async function saveDiagnosticsBill(){
  const msg=document.getElementById("diagnosticsBillMessage");
  const type=document.getElementById("diagBillingType").value;
  if(!diagnosticsState.patient){msg.innerHTML="<p class='error'>Load patient first.</p>";return;}
  if(!diagnosticsState.items.length){msg.innerHTML="<p class='error'>Add at least one test.</p>";return;}
  const total=diagnosticsState.items.reduce((s,i)=>s+safeNumber(i.amount),0);
  const billNo=generateDiagnosticBillNo();
  const p=diagnosticsState.patient;
  const master={bill_no:billNo,billing_date:todayISO(),billing_type:type,admission_id:diagnosticsState.admission?.admission_id||null,uhid:p.uhid||p.patient_id||"",patient_name:p.name||p.patient_name||"",mobile:p.mobile||"",total_amount:total,payment_mode:document.getElementById("diagPaymentMode").value,status:"Pending",created_at:new Date().toISOString()};
  const {error}=await db.from("diagnostic_bills").insert([master]);
  if(error){msg.innerHTML=`<p class='error'>Bill save failed: ${error.message}</p>`;return;}
  const items=diagnosticsState.items.map(i=>({bill_no:billNo,test_id:i.test_id,test_name:i.test_name,price:i.price,quantity:i.qty,amount:i.amount,created_at:new Date().toISOString()}));
  const {error:itemError}=await db.from("diagnostic_bill_items").insert(items);
  if(itemError){msg.innerHTML=`<p class='error'>Bill saved, items failed: ${itemError.message}</p>`;return;}
  if(type==="IPD"&&diagnosticsState.admission){
    const charge={admission_id:diagnosticsState.admission.admission_id||String(diagnosticsState.admission.id),uhid:diagnosticsState.admission.uhid,patient_name:diagnosticsState.admission.patient_name,charge_date:todayISO(),category:"Lab Charge",description:`Diagnostics: ${diagnosticsState.items.map(i=>i.test_name).join(", ")}`,rate:total,quantity:1,amount:total,created_at:new Date().toISOString()};
    await db.from("ipd_daily_charges").insert([charge]);
  }
  msg.innerHTML=`<p class='success'>Diagnostics bill saved: ${billNo}</p>`;
  diagnosticsState.items=[];renderDiagnosticItems();await loadDiagnosticsRegister();
}

async function loadDiagnosticsRegister(){
  const body=document.getElementById("diagnosticsRegisterRows");
  if(!body)return;
  const {data,error}=await db.from("diagnostic_bills").select("*").order("created_at",{ascending:false}).limit(50);
  if(error){body.innerHTML=`<tr><td colspan='7' class='error'>${error.message}</td></tr>`;return;}
  body.innerHTML=(data||[]).length?(data||[]).map(r=>`<tr><td>${r.bill_no||""}</td><td>${r.billing_date||rowDate(r)}</td><td>${r.patient_name||""}</td><td>${r.billing_type||""}</td><td>${r.status||"Pending"}</td><td>${money(r.total_amount||0)}</td><td>${r.payment_mode||""}</td></tr>`).join(""):"<tr><td colspan='7'>No diagnostics bills.</td></tr>";
}
