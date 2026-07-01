async function renderPrintCenter(){
  const el=document.getElementById("printCenterView");
  el.innerHTML=`
    <div class="panel">
      <h2>Print Center</h2>
      <p>Search saved records and print OPD slip, diagnostics bill, pharmacy bill, or IPD final bill.</p>
      <div class="grid" style="grid-template-columns:1fr 2fr auto">
        <div><label>Print Type</label><select id="printType"><option value="opd">OPD Slip</option><option value="diagnostics">Diagnostics Bill</option><option value="pharmacy">Pharmacy Bill</option><option value="ipd">IPD Final Bill</option></select></div>
        <div><label>Search Bill / Patient</label><input id="printSearch" placeholder="Bill no / visit ID / admission ID / UHID / patient name / mobile"></div>
        <div><label>&nbsp;</label><button id="printSearchBtn">Search</button></div>
      </div>
      <div id="printSearchMessage"></div>
    </div>
    <div class="panel table-wrap">
      <h3>Search Results</h3>
      <table><thead><tr><th>Date</th><th>Ref No</th><th>Patient</th><th>UHID/Type</th><th>Total</th><th>Action</th></tr></thead><tbody id="printRows"></tbody></table>
    </div>
    <div class="panel" id="printPreviewPanel">
      <h3>Print Preview</h3>
      <div id="printPreview"><p>Select a record to preview.</p></div>
    </div>
  `;
  document.getElementById("printSearchBtn").onclick=searchPrintableBills;
  document.getElementById("printSearch").onkeydown=e=>{if(e.key==="Enter")searchPrintableBills()};
}

async function searchPrintableBills(){
  const type=document.getElementById("printType").value;
  const q=document.getElementById("printSearch").value.trim().toLowerCase();
  const body=document.getElementById("printRows");
  const msg=document.getElementById("printSearchMessage");
  if(!q){msg.innerHTML="<p class='error'>Enter search text.</p>";return;}
  if(type==="opd"){
    const rows=await fetchAll("opd_visits");
    const matches=rows.filter(r=>[r.visit_id,r.uhid,r.patient_name,r.mobile,r.consultant].join(" ").toLowerCase().includes(q)).slice(0,30);
    body.innerHTML=matches.length?matches.map(r=>`<tr><td>${r.visit_date||rowDate(r)}</td><td>${r.visit_id||""}</td><td>${r.patient_name||""}</td><td>${r.uhid||""}</td><td>${money(r.amount||0)}</td><td><button class='secondary' onclick='previewOPDSlip("${r.visit_id}")'>Preview</button></td></tr>`).join(""):"<tr><td colspan='6'>No OPD visit found.</td></tr>";
  }else if(type==="diagnostics"){
    const rows=await fetchAll("diagnostic_bills");
    const matches=rows.filter(r=>[r.bill_no,r.uhid,r.patient_name,r.mobile].join(" ").toLowerCase().includes(q)).slice(0,30);
    body.innerHTML=matches.length?matches.map(r=>`<tr><td>${r.billing_date||rowDate(r)}</td><td>${r.bill_no||""}</td><td>${r.patient_name||""}</td><td>${r.uhid||""}</td><td>${money(r.total_amount||0)}</td><td><button class='secondary' onclick='previewDiagnosticsBill("${r.bill_no}")'>Preview</button></td></tr>`).join(""):"<tr><td colspan='6'>No diagnostics bill found.</td></tr>";
  }else if(type==="pharmacy"){
    const rows=await fetchAll("pharmacy_sales");
    const matches=rows.filter(r=>[r.id,r.patient_name,r.patient_type,r.payment_mode,r.payment_status].join(" ").toLowerCase().includes(q)).slice(0,30);
    body.innerHTML=matches.length?matches.map(r=>`<tr><td>${r.bill_date||rowDate(r)}</td><td>PH-${r.id||""}</td><td>${r.patient_name||""}</td><td>${r.patient_type||""}</td><td>${money(r.bill_amount||0)}</td><td><button class='secondary' onclick='previewPharmacyBill(${r.id})'>Preview</button></td></tr>`).join(""):"<tr><td colspan='6'>No pharmacy bill found.</td></tr>";
  }else{
    const rows=await fetchAll("ipd_billing");
    const matches=rows.filter(r=>[r.bill_id,r.admission_id,r.uhid,r.patient_name].join(" ").toLowerCase().includes(q)).slice(0,30);
    body.innerHTML=matches.length?matches.map(r=>`<tr><td>${r.billing_date||rowDate(r)}</td><td>${r.bill_id||""}</td><td>${r.patient_name||""}</td><td>${r.uhid||""}</td><td>${money(r.total||r.gross_total||0)}</td><td><button class='secondary' onclick='previewIPDFinalBill("${r.bill_id}")'>Preview</button></td></tr>`).join(""):"<tr><td colspan='6'>No IPD bill found.</td></tr>";
  }
  msg.innerHTML="";
}

function billHeader(title){return `<h2 style="text-align:center;margin:0">Revive Hospital</h2><p style="text-align:center;margin:4px 0 0">${title}</p><hr>`}

async function previewOPDSlip(visitId){
  const visits=await fetchAll("opd_visits");
  const v=visits.find(x=>x.visit_id===visitId);
  if(!v){document.getElementById("printPreview").innerHTML="<p class='error'>OPD visit not found.</p>";return;}
  document.getElementById("printPreview").innerHTML=`
    <div id="printArea" class="print-bill">
      ${billHeader("OPD Slip")}
      <div class="grid" style="grid-template-columns:repeat(2,1fr)">
        <div><b>Visit ID:</b> ${v.visit_id||""}</div><div><b>Date:</b> ${v.visit_date||rowDate(v)}</div>
        <div><b>UHID:</b> ${v.uhid||""}</div><div><b>Patient:</b> ${v.patient_name||""}</div>
        <div><b>Age/Sex:</b> ${v.age||""} / ${v.sex||""}</div><div><b>Mobile:</b> ${v.mobile||""}</div>
        <div><b>Department:</b> ${v.department||""}</div><div><b>Consultant:</b> ${v.consultant||""}</div>
        <div><b>Visit Type:</b> ${v.visit_type||""}</div><div><b>Payment:</b> ${v.payment_mode||""}</div>
      </div>
      <h3 style="text-align:right">Amount: ${money(v.amount||0)}</h3>
    </div>
    <button onclick="printCurrentPreview()">Print</button>`;
}

async function previewDiagnosticsBill(billNo){
  const bills=await fetchAll("diagnostic_bills");
  const bill=bills.find(b=>b.bill_no===billNo);
  if(!bill){document.getElementById("printPreview").innerHTML="<p class='error'>Diagnostics bill not found.</p>";return;}
  const {data:items}=await db.from("diagnostic_bill_items").select("*").eq("bill_no",billNo);
  const rows=(items||[]).map((i,idx)=>`<tr><td>${idx+1}</td><td>${i.test_name||""}</td><td>${money(i.price||0)}</td><td>${i.quantity||1}</td><td>${money(i.amount||0)}</td></tr>`).join("");
  document.getElementById("printPreview").innerHTML=`
    <div id="printArea" class="print-bill">
      ${billHeader("Diagnostics Bill")}
      <div class="grid" style="grid-template-columns:repeat(2,1fr)">
        <div><b>Bill No:</b> ${bill.bill_no||""}</div><div><b>Date:</b> ${bill.billing_date||rowDate(bill)}</div>
        <div><b>Patient:</b> ${bill.patient_name||""}</div><div><b>UHID:</b> ${bill.uhid||""}</div>
        <div><b>Type:</b> ${bill.billing_type||""}</div><div><b>Payment:</b> ${bill.payment_mode||""}</div>
      </div><br>
      <table><thead><tr><th>#</th><th>Investigation</th><th>Rate</th><th>Qty</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <h3 style="text-align:right">Total: ${money(bill.total_amount||0)}</h3>
    </div>
    <button onclick="printCurrentPreview()">Print</button>`;
}

async function previewPharmacyBill(id){
  const sales=await fetchAll("pharmacy_sales");
  const bill=sales.find(b=>String(b.id)===String(id));
  if(!bill){document.getElementById("printPreview").innerHTML="<p class='error'>Pharmacy bill not found.</p>";return;}
  let items=[];try{items=JSON.parse(bill.items_json||"[]")}catch(e){items=[]}
  const rows=items.map((i,idx)=>`<tr><td>${idx+1}</td><td>${i.medicine_name||""}</td><td>${i.batch_no||""}</td><td>${i.expiry_date||""}</td><td>${i.quantity||0}</td><td>${money(i.sale_price||0)}</td><td>${money(i.total||0)}</td></tr>`).join("");
  document.getElementById("printPreview").innerHTML=`
    <div id="printArea" class="print-bill">
      ${billHeader("Pharmacy Bill")}
      <div class="grid" style="grid-template-columns:repeat(2,1fr)">
        <div><b>Bill No:</b> PH-${bill.id||""}</div><div><b>Date:</b> ${bill.bill_date||rowDate(bill)}</div>
        <div><b>Patient:</b> ${bill.patient_name||""}</div><div><b>Type:</b> ${bill.patient_type||""}</div>
        <div><b>Payment:</b> ${bill.payment_mode||""}</div><div><b>Status:</b> ${bill.payment_status||""}</div>
      </div><br>
      <table><thead><tr><th>#</th><th>Medicine</th><th>Batch</th><th>Expiry</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <h3 style="text-align:right">Total: ${money(bill.bill_amount||0)}</h3>
      <p style="text-align:right"><b>Paid:</b> ${money(bill.amount_paid||0)} &nbsp; <b>Due:</b> ${money(bill.amount_due||0)}</p>
    </div>
    <button onclick="printCurrentPreview()">Print</button>`;
}

async function previewIPDFinalBill(billId){
  const bills=await fetchAll("ipd_billing");
  const bill=bills.find(b=>b.bill_id===billId);
  if(!bill){document.getElementById("printPreview").innerHTML="<p class='error'>IPD bill not found.</p>";return;}
  const {data:items}=await db.from("ipd_bill_items").select("*").eq("bill_id",billId);
  const rows=(items||[]).map((i,idx)=>`<tr><td>${idx+1}</td><td>${i.category||""}</td><td>${i.description||""}</td><td>${money(i.rate||0)}</td><td>${i.quantity||1}</td><td>${money(i.amount||0)}</td></tr>`).join("");
  document.getElementById("printPreview").innerHTML=`
    <div id="printArea" class="print-bill">
      ${billHeader("IPD Final Bill")}
      <div class="grid" style="grid-template-columns:repeat(2,1fr)">
        <div><b>Bill No:</b> ${bill.bill_id||""}</div><div><b>Date:</b> ${bill.billing_date||rowDate(bill)}</div>
        <div><b>Admission:</b> ${bill.admission_id||""}</div><div><b>UHID:</b> ${bill.uhid||""}</div>
        <div><b>Patient:</b> ${bill.patient_name||""}</div><div><b>Payment:</b> ${bill.payment_mode||""}</div>
      </div><br>
      <table><thead><tr><th>#</th><th>Category</th><th>Description</th><th>Rate</th><th>Qty</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <h3 style="text-align:right">Gross: ${money(bill.gross_total||bill.total||0)}</h3>
      <p style="text-align:right"><b>Advance:</b> ${money(bill.advance||0)} &nbsp; <b>Balance:</b> ${money(bill.balance||0)} &nbsp; <b>Refund:</b> ${money(bill.refund||0)}</p>
    </div>
    <button onclick="printCurrentPreview()">Print</button>`;
}

function printCurrentPreview(){
  const content=document.getElementById("printArea")?.innerHTML||"";
  const w=window.open("","_blank","width=900,height=700");
  w.document.write(`<html><head><title>Print</title><style>body{font-family:Arial;padding:24px;color:#111}h2,p{margin-left:0;margin-right:0}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left;font-size:13px}th{background:#f3f4f6}.grid{display:grid;gap:8px}@media print{button{display:none}}</style></head><body>${content}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}
