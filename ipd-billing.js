let ipdBillingState={admission:null,items:[]};

function ipdItemAmount(i){
  const amount=safeNumber(i.rate)*safeNumber(i.qty);
  return (i.category||"").toLowerCase()==="discount" ? -Math.abs(amount) : amount;
}

async function renderIPDBilling(){
  const el=document.getElementById("ipdBillingView");
  el.innerHTML=`
    <div class="panel">
      <h2>IPD Final Billing & Discharge</h2>
      <p>Final bill imports saved daily charges, adjusts advance, records balance/refund, and discharges patient.</p>
      <div class="form-row"><div><label>Search Admission ID / UHID / Patient Name</label><input id="ipdBillSearch" placeholder="Search active IPD admission"></div><button id="ipdBillSearchBtn">Search</button></div>
      <div id="ipdBillSearchResult"></div>
    </div>
    <div id="ipdBillWorkspace" class="hidden">
      <div class="panel" id="ipdAdmissionSummary"></div>
      <div class="panel">
        <h3>Add Extra Final Bill Item</h3>
        <p>Bed charge should be entered only in IPD Daily Charges.</p>
        <div class="grid" style="grid-template-columns:repeat(5,1fr)">
          <div><label>Category</label><select id="billItemCategory"><option>Doctor Charge</option><option>OT Charge</option><option>Anaesthesia</option><option>Nursing Charge</option><option>Consumables</option><option>Procedure Charge</option><option>Lab Charge</option><option>Discount</option><option>Other</option></select></div>
          <div><label>Description</label><input id="billItemDesc" placeholder="Extra charge / discount"></div>
          <div><label>Rate</label><input id="billItemRate" type="number" value="0" step="0.01"></div>
          <div><label>Qty / Days</label><input id="billItemQty" type="number" value="1" step="0.01"></div>
          <div><label>&nbsp;</label><button type="button" id="addBillItemBtn">Add Item</button></div>
        </div>
      </div>
      <div class="panel table-wrap">
        <h3>Final Bill Items</h3>
        <table><thead><tr><th>Category</th><th>Description</th><th>Rate</th><th>Qty</th><th>Amount</th><th>Source</th><th>Action</th></tr></thead><tbody id="ipdBillItemsRows"></tbody></table>
      </div>
      <div class="panel">
        <h3>Final Settlement</h3>
        <div class="grid cards" style="grid-template-columns:repeat(4,1fr)">
          <div class="card"><span>Gross Bill</span><strong id="ipdGrossBill">₹0</strong></div>
          <div class="card"><span>Advance Paid</span><strong id="ipdAdvancePaid">₹0</strong></div>
          <div class="card"><span>Balance Payable</span><strong id="ipdBalancePayable">₹0</strong></div>
          <div class="card"><span>Refund</span><strong id="ipdRefundAmount">₹0</strong></div>
        </div>
        <div class="grid" style="grid-template-columns:repeat(4,1fr);margin-top:12px">
          <div><label>Additional Payment</label><input id="ipdFinalPayment" type="number" value="0" step="0.01"></div>
          <div><label>Payment Mode</label><select id="ipdFinalPaymentMode"><option>Cash</option><option>UPI</option><option>Bank</option><option>Credit</option></select></div>
          <div><label>Billing Date</label><input id="ipdBillingDate" type="date"></div>
          <div><label>Remarks</label><input id="ipdBillingRemarks" placeholder="Optional"></div>
        </div>
        <br>
        <button id="saveIPDBillBtn">Save Final Bill & Discharge</button>
        <div id="ipdBillingMessage"></div>
      </div>
    </div>
  `;
  document.getElementById("ipdBillingDate").value=todayISO();
  document.getElementById("ipdBillSearchBtn").onclick=searchIPDBillingAdmission;
  document.getElementById("ipdBillSearch").onkeydown=e=>{if(e.key==="Enter")searchIPDBillingAdmission()};
  document.getElementById("addBillItemBtn").onclick=addIPDBillItem;
  document.getElementById("saveIPDBillBtn").onclick=saveIPDFinalBill;
  document.getElementById("ipdFinalPayment").oninput=renderIPDBillSummary;
}

async function searchIPDBillingAdmission(){
  const q=document.getElementById("ipdBillSearch").value.trim().toLowerCase();
  const msg=document.getElementById("ipdBillSearchResult");
  if(!q){msg.innerHTML="<p class='error'>Enter admission ID, UHID or patient name.</p>";return;}
  const rows=await fetchAll("ipd_admission");
  const active=rows.filter(r=>(r.status||"Admitted")!=="Discharged");
  const admission=active.find(r=>[r.admission_id,r.uhid,r.patient_name,r.mobile].join(" ").toLowerCase().includes(q));
  if(!admission){msg.innerHTML="<p class='error'>No active IPD admission found.</p>";return;}
  ipdBillingState={admission,items:[]};
  await importDailyChargesForBill(admission);
  document.getElementById("ipdBillWorkspace").classList.remove("hidden");
  msg.innerHTML=`<p class='success'>Admission loaded: ${admission.patient_name||"Patient"}. Daily charges imported.</p>`;
  renderIPDAdmissionSummary();
  renderIPDBillItems();
  renderIPDBillSummary();
}

async function importDailyChargesForBill(adm){
  const admissionId=adm.admission_id||String(adm.id);
  const {data,error}=await db.from("ipd_daily_charges").select("*").eq("admission_id",admissionId).order("charge_date",{ascending:true});
  if(error){ipdBillingState.items=[];return;}
  ipdBillingState.items=(data||[]).map(c=>({category:c.category||"Other",description:c.description||c.category||"Charge",rate:safeNumber(c.rate),qty:safeNumber(c.quantity)||1,source:"Daily Charges"}));
}

function renderIPDAdmissionSummary(){
  const a=ipdBillingState.admission;
  const start=new Date(a.admission_date||a.created_at||todayISO());
  const days=Math.max(1,Math.ceil((new Date(todayISO())-start)/(1000*60*60*24))+1);
  const advance=safeNumber(a.deposit_amount||a.advance);
  document.getElementById("ipdAdmissionSummary").innerHTML=`
    <h3>Admission Summary</h3>
    <div class="grid" style="grid-template-columns:repeat(4,1fr)">
      <div><b>Admission ID</b><br>${a.admission_id||a.id||""}</div>
      <div><b>UHID</b><br>${a.uhid||""}</div>
      <div><b>Patient</b><br>${a.patient_name||""}</div>
      <div><b>Doctor</b><br>${a.doctor||a.consultant||""}</div>
      <div><b>Department</b><br>${a.department||""}</div>
      <div><b>Admission Date</b><br>${a.admission_date||rowDate(a)}</div>
      <div><b>Stay</b><br>${days} day(s)</div>
      <div><b>Advance</b><br>${money(advance)}</div>
      <div><b>Ward/Bed</b><br>${[a.ward_type,a.bed_no].filter(Boolean).join(" / ")}</div>
      <div><b>Diagnosis</b><br>${a.diagnosis||""}</div>
    </div>`;
}

function addIPDBillItem(){
  const category=document.getElementById("billItemCategory").value;
  const description=document.getElementById("billItemDesc").value.trim()||category;
  const rate=safeNumber(document.getElementById("billItemRate").value);
  const qty=safeNumber(document.getElementById("billItemQty").value)||1;
  ipdBillingState.items.push({category,description,rate,qty,source:"Final Adjustment"});
  document.getElementById("billItemDesc").value="";
  document.getElementById("billItemRate").value="0";
  document.getElementById("billItemQty").value="1";
  renderIPDBillItems();renderIPDBillSummary();
}
function removeIPDBillItem(index){ipdBillingState.items.splice(index,1);renderIPDBillItems();renderIPDBillSummary();}
function renderIPDBillItems(){
  const body=document.getElementById("ipdBillItemsRows");
  body.innerHTML=ipdBillingState.items.length?ipdBillingState.items.map((i,idx)=>`<tr><td>${i.category}</td><td>${i.description}</td><td>${money(i.rate)}</td><td>${i.qty}</td><td>${money(ipdItemAmount(i))}</td><td>${i.source||"Manual"}</td><td><button class="secondary" onclick="removeIPDBillItem(${idx})">Remove</button></td></tr>`).join(""):"<tr><td colspan='7'>No daily charges imported. Add charges first in IPD Daily Charges or add final item here.</td></tr>";
}
function ipdBillTotals(){
  const gross=ipdBillingState.items.reduce((s,i)=>s+ipdItemAmount(i),0);
  const finalGross=Math.max(0,gross);
  const advance=safeNumber(ipdBillingState.admission?.deposit_amount||ipdBillingState.admission?.advance);
  const balance=Math.max(0,finalGross-advance);
  const refund=Math.max(0,advance-finalGross);
  return {gross:finalGross,advance,balance,refund};
}
function renderIPDBillSummary(){
  const t=ipdBillTotals();
  document.getElementById("ipdGrossBill").textContent=money(t.gross);
  document.getElementById("ipdAdvancePaid").textContent=money(t.advance);
  document.getElementById("ipdBalancePayable").textContent=money(t.balance);
  document.getElementById("ipdRefundAmount").textContent=money(t.refund);
  if(document.getElementById("ipdFinalPayment"))document.getElementById("ipdFinalPayment").value=t.balance.toFixed(2);
}
function generateIPDBillId(){return `IPDBILL-${todayISO().replaceAll("-","")}-${String(Date.now()).slice(-4)}`}
async function saveIPDFinalBill(){
  const msg=document.getElementById("ipdBillingMessage");
  const a=ipdBillingState.admission;
  if(!a){msg.innerHTML="<p class='error'>Load an admission first.</p>";return;}
  if(!ipdBillingState.items.length){msg.innerHTML="<p class='error'>No bill items found. Add daily charges first.</p>";return;}
  const t=ipdBillTotals();
  const billId=generateIPDBillId();
  const payment=safeNumber(document.getElementById("ipdFinalPayment").value);
  const billingDate=document.getElementById("ipdBillingDate").value||todayISO();
  const master={bill_id:billId,admission_id:a.admission_id||String(a.id),uhid:a.uhid,patient_name:a.patient_name,billing_date:billingDate,total:t.gross,gross_total:t.gross,advance:t.advance,balance:t.balance,refund:t.refund,final_payment:payment,payment_mode:document.getElementById("ipdFinalPaymentMode").value,remarks:document.getElementById("ipdBillingRemarks").value.trim(),created_at:new Date().toISOString()};
  const {error:billError}=await db.from("ipd_billing").insert([master]);
  if(billError){msg.innerHTML=`<p class='error'>Final bill save failed: ${billError.message}</p>`;return;}
  const items=ipdBillingState.items.map(i=>({bill_id:billId,admission_id:a.admission_id||String(a.id),category:i.category,description:i.description,rate:safeNumber(i.rate),quantity:safeNumber(i.qty),amount:ipdItemAmount(i),created_at:new Date().toISOString()}));
  const {error:itemError}=await db.from("ipd_bill_items").insert(items);
  if(itemError){msg.innerHTML=`<p class='error'>Bill saved, but items failed: ${itemError.message}</p>`;return;}
  if(payment>0){await db.from("ipd_payments").insert([{bill_id:billId,admission_id:a.admission_id||String(a.id),amount:payment,payment_mode:document.getElementById("ipdFinalPaymentMode").value,payment_date:billingDate,created_at:new Date().toISOString()}]);}
  const {error:dischargeError}=await db.from("ipd_admission").update({status:"Discharged",discharge_date:billingDate}).eq("id",a.id);
  if(dischargeError){msg.innerHTML=`<p class='error'>Bill saved, but discharge failed: ${dischargeError.message}</p>`;return;}
  msg.innerHTML=`<p class='success'>Final bill saved and patient discharged. Bill ID: ${billId}</p>`;
}
