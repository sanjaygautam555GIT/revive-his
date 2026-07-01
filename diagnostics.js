let diagnosticsState={patient:null,admission:null,items:[],tests:[]};
const DEFAULT_DIAGNOSTICS=[
  ["CBC",250],["Hb",100],["ESR",150],["Platelet Count",150],["KFT",500],["LFT",500],["Electrolytes",500],["Lipid Profile",700],["HIV I & II",500],["HBsAg",400],["HCV",500],["VDRL",300],["RA Factor",500],["HbA1c",600],["RBS",100],["Blood Sugar Fasting",100],["Blood Sugar PP",100],["Troponin I",900],["CA 125",1500],["CA 19-9",2000],["CEA",1500],["AFP",1500],["LDH",400],["Beta-hCG",800],["Amylase",500],["Lipase",700],["CRP",500],["Urine Routine Microscopy",150],["Urine Culture",600],["Ascitic Fluid Analysis",700],["Pleural Fluid Analysis",700],["aPTT",400],["PT/INR",400],["BT/CT",150],["D-Dimer",1200],["ECG",300],["X-Ray",500],["CT",3000],["Others",0]
];

async function renderDiagnostics(){
  const el=document.getElementById("diagnosticsView");
  el.innerHTML=`
    <div class="panel">
      <h2>Diagnostics Billing</h2>
      <p>Search/import patient, choose investigation, add to bill, and save.</p>
      <button type="button" id="seedDiagnosticsBtn" class="secondary">Load Default Investigations</button>
      <div id="diagnosticsSeedMessage"></div>
    </div>

    <div class="panel">
      <h3>1. Import Patient</h3>
      <div class="grid" style="grid-template-columns:1.5fr auto 1fr 1fr">
        <div><label>Search Patient / Admission</label><input id="diagPatientSearch" placeholder="Name / mobile / UHID / admission ID"></div>
        <div><label>&nbsp;</label><button type="button" id="diagSearchBtn">Import</button></div>
        <div><label>Billing Type</label><select id="diagBillingType"><option>OPD</option><option>IPD</option></select></div>
        <div><label>Payment Mode</label><select id="diagPaymentMode"><option>Cash</option><option>UPI</option><option>Bank</option><option>Credit</option></select></div>
      </div>
      <div id="diagPatientResult"></div>
    </div>

    <div class="panel">
      <h3>2. Choose Investigation</h3>
      <div class="grid" style="grid-template-columns:2fr 1fr 1fr auto">
        <div><label>Investigation</label><select id="diagTestSelect"></select></div>
        <div><label>Price</label><input id="diagItemPrice" type="number" value="0" step="0.01"></div>
        <div><label>Qty</label><input id="diagItemQty" type="number" value="1" step="0.01"></div>
        <div><label>&nbsp;</label><button type="button" id="addDiagItemBtn">Add</button></div>
      </div>
      <div id="otherDiagBox" class="hidden" style="margin-top:10px"><label>Other Investigation Name</label><input id="otherDiagName" placeholder="Enter name"></div>
    </div>

    <div class="panel table-wrap">
      <h3>3. Bill</h3>
      <table><thead><tr><th>Investigation</th><th>Price</th><th>Qty</th><th>Amount</th><th>Action</th></tr></thead><tbody id="diagItemRows"></tbody></table>
      <h2>Total: <span id="diagTotal">₹0</span></h2>
      <button id="saveDiagnosticsBillBtn">Save Bill</button>
      <div id="diagnosticsBillMessage"></div>
    </div>

    <div class="panel table-wrap">
      <h3>Recent Diagnostics Bills</h3>
      <table><thead><tr><th>Bill No</th><th>Date</th><th>Patient</th><th>Type</th><th>Total</th><th>Mode</th></tr></thead><tbody id="diagnosticsRegisterRows"></tbody></table>
    </div>
  `;
  document.getElementById("seedDiagnosticsBtn").onclick=seedDiagnosticsTests;
  document.getElementById("diagSearchBtn").onclick=searchDiagnosticsPatient;
  document.getElementById("diagPatientSearch").onkeydown=e=>{if(e.key==="Enter")searchDiagnosticsPatient()};
  document.getElementById("diagTestSelect").onchange=applyDiagnosticTestPreset;
  document.getElementById("addDiagItemBtn").onclick=addDiagnosticItem;
  document.getElementById("saveDiagnosticsBillBtn").onclick=saveDiagnosticsBill;
  await loadDiagnosticTests();
  renderDiagnosticItems();
  await loadDiagnosticsRegister();
}

async function seedDiagnosticsTests(){
  const msg=document.getElementById("diagnosticsSeedMessage");
  const existing=await fetchAll("diagnostic_test_master");
  const names=new Set(existing.map(x=>(x.test_name||"").toLowerCase()));
  const rows=DEFAULT_DIAGNOSTICS.filter(([n])=>!names.has(n.toLowerCase())).map(([test_name,price])=>({test_name,price,status:"Active",created_at:new Date().toISOString()}));
  if(!rows.length){msg.innerHTML="<p class='success'>Default investigations already loaded.</p>";return;}
  const {error}=await db.from("diagnostic_test_master").insert(rows);
  if(error){msg.innerHTML=`<p class='error'>Default load failed: ${error.message}</p>`;return;}
  msg.innerHTML=`<p class='success'>${rows.length} investigations loaded.</p>`;
  await loadDiagnosticTests();
}

async function loadDiagnosticTests(){
  const select=document.getElementById("diagTestSelect");
  const {data,error}=await db.from("diagnostic_test_master").select("*").order("test_name",{ascending:true});
  if(error){if(select)select.innerHTML="<option value=''>Create tables first</option>";return;}
  diagnosticsState.tests=(data||[]).filter(t=>(t.status||"Active")==="Active");
  if(select)select.innerHTML=diagnosticsState.tests.length?diagnosticsState.tests.map(t=>`<option value="${t.id}">${t.test_name}</option>`).join(""):"<option value=''>Click Load Default Investigations</option>";
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
    msg.innerHTML=`<div class='sync-box'><b>IPD Patient Imported</b><br>${a.patient_name||"Patient"} · ${a.uhid||""} · ${a.admission_id||""}</div>`;
  }else{
    const patients=await fetchAll("patient");
    const p=patients.find(r=>[r.uhid,r.patient_id,r.name,r.patient_name,r.mobile].join(" ").toLowerCase().includes(term));
    if(!p){msg.innerHTML="<p class='error'>No patient found.</p>";return;}
    diagnosticsState.patient=p;
    msg.innerHTML=`<div class='sync-box'><b>Patient Imported</b><br>${p.name||p.patient_name||"Patient"} · ${p.uhid||p.patient_id||""}</div>`;
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
  body.innerHTML=diagnosticsState.items.length?diagnosticsState.items.map((i,idx)=>`<tr><td>${i.test_name}</td><td>${money(i.price)}</td><td>${i.qty}</td><td>${money(i.amount)}</td><td><button class='secondary' onclick='removeDiagnosticItem(${idx})'>Remove</button></td></tr>`).join(""):"<tr><td colspan='5'>No investigations added.</td></tr>";
  document.getElementById("diagTotal").textContent=money(total);
}
function generateDiagnosticBillNo(){return `DIAG-${todayISO().replaceAll("-","")}-${String(Date.now()).slice(-4)}`}

async function saveDiagnosticsBill(){
  const msg=document.getElementById("diagnosticsBillMessage");
  const type=document.getElementById("diagBillingType").value;
  if(!diagnosticsState.patient){msg.innerHTML="<p class='error'>Import patient first.</p>";return;}
  if(!diagnosticsState.items.length){msg.innerHTML="<p class='error'>Add at least one investigation.</p>";return;}
  const total=diagnosticsState.items.reduce((s,i)=>s+safeNumber(i.amount),0);
  const billNo=generateDiagnosticBillNo();
  const p=diagnosticsState.patient;
  const master={bill_no:billNo,billing_date:todayISO(),billing_type:type,admission_id:diagnosticsState.admission?.admission_id||null,uhid:p.uhid||p.patient_id||"",patient_name:p.name||p.patient_name||"",mobile:p.mobile||"",total_amount:total,payment_mode:document.getElementById("diagPaymentMode").value,status:"Billed",created_at:new Date().toISOString()};
  const {error}=await db.from("diagnostic_bills").insert([master]);
  if(error){msg.innerHTML=`<p class='error'>Bill save failed: ${error.message}</p>`;return;}
  const items=diagnosticsState.items.map(i=>({bill_no:billNo,test_id:i.test_id,test_name:i.test_name,price:i.price,quantity:i.qty,amount:i.amount,created_at:new Date().toISOString()}));
  const {error:itemError}=await db.from("diagnostic_bill_items").insert(items);
  if(itemError){msg.innerHTML=`<p class='error'>Bill saved, items failed: ${itemError.message}</p>`;return;}
  if(type==="IPD"&&diagnosticsState.admission){
    const charge={admission_id:diagnosticsState.admission.admission_id||String(diagnosticsState.admission.id),uhid:diagnosticsState.admission.uhid,patient_name:diagnosticsState.admission.patient_name,charge_date:todayISO(),category:"Lab Charge",description:`Diagnostics: ${diagnosticsState.items.map(i=>i.test_name).join(", ")}`,rate:total,quantity:1,amount:total,created_at:new Date().toISOString()};
    await db.from("ipd_daily_charges").insert([charge]);
  }
  msg.innerHTML=`<p class='success'>Bill saved: ${billNo}</p>`;
  diagnosticsState.items=[];renderDiagnosticItems();await loadDiagnosticsRegister();
}

async function loadDiagnosticsRegister(){
  const body=document.getElementById("diagnosticsRegisterRows");
  if(!body)return;
  const {data,error}=await db.from("diagnostic_bills").select("*").order("created_at",{ascending:false}).limit(20);
  if(error){body.innerHTML=`<tr><td colspan='6' class='error'>${error.message}</td></tr>`;return;}
  body.innerHTML=(data||[]).length?(data||[]).map(r=>`<tr><td>${r.bill_no||""}</td><td>${r.billing_date||rowDate(r)}</td><td>${r.patient_name||""}</td><td>${r.billing_type||""}</td><td>${money(r.total_amount||0)}</td><td>${r.payment_mode||""}</td></tr>`).join(""):"<tr><td colspan='6'>No diagnostics bills.</td></tr>";
}
