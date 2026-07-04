let pharmacyBillItems=[];
let pharmacyStockRows=[];
let billAmountPaidEdited=false;
let currentPharmacyPatient=null;

async function renderPharmacyBilling(){
  const el=document.getElementById('pharmacyBillingView');
  el.innerHTML=`
    <div class="panel"><h2>Pharmacy Billing</h2><p>Import OPD/IPD patient, create bill and update stock.</p>
      <div class="grid" style="grid-template-columns:1fr 2fr auto">
        <div><label>Source</label><select id="phSource"><option>Walk-in</option><option>OPD</option><option>IPD</option></select></div>
        <div><label>Search Patient</label><input id="phSearch" placeholder="Name / mobile / UHID / visit ID / admission ID"></div>
        <div><label>&nbsp;</label><button type="button" id="phImport">Import</button></div>
      </div><div id="phMsg"></div>
    </div>
    <div class="panel"><h3>Bill Details</h3><div class="grid" style="grid-template-columns:repeat(3,1fr)">
      <div><label>Patient / Customer Name</label><input id="billPatientName" value="Walk-in"></div>
      <div><label>Patient Type</label><select id="billPatientType"><option>Walk-in</option><option>OPD</option><option>IPD</option><option>Staff</option></select></div>
      <div><label>Bill Date</label><input id="billDate" type="date" value="${todayISO()}"></div>
      <div><label>UHID</label><input id="billUhid" readonly></div>
      <div><label>Reference</label><input id="billRef" readonly></div>
      <div><label>Payment Mode</label><select id="billPaymentMode"><option>Cash</option><option>UPI</option><option>Bank</option><option>Credit</option></select></div>
      <div><label>Payment Status</label><select id="billPaymentStatus"><option>Paid</option><option>Due</option></select></div>
      <div><label>Amount Paid</label><input id="billAmountPaid" type="number" value="0" step="0.01"></div>
    </div></div>
    <div class="panel"><h3>Add Item</h3><div class="grid" style="grid-template-columns:repeat(4,1fr)">
      <div><label>Stock Item</label><select id="billStockSelect"><option value="">Loading...</option></select></div>
      <div><label>Available Qty</label><input id="billAvailableQty" readonly></div>
      <div><label>Sale Price</label><input id="billSalePrice" type="number" value="0" step="0.01"></div>
      <div><label>Quantity</label><input id="billQty" type="number" value="1"></div>
      <div><label>Line Total</label><input id="billLineTotal" readonly value="0"></div>
    </div><br><button id="addBillItemBtn" type="button">Add to Bill</button><div id="billingMessage"></div></div>
    <div class="panel table-wrap"><h3>Current Bill</h3><table><thead><tr><th>Item</th><th>Batch</th><th>Expiry</th><th>Qty</th><th>Rate</th><th>Total</th><th>Action</th></tr></thead><tbody id="billItemRows"></tbody></table><h3>Bill Total: <span id="billGrandTotal">₹0</span></h3><button id="saveBillBtn" type="button">Save Bill</button> <button id="clearBillBtn" type="button" class="secondary">Clear</button></div>
    <div class="grid cards" style="margin-top:16px"><div class="card"><span>Total Bills</span><strong id="salesCount">0</strong></div><div class="card"><span>Total Sales</span><strong id="salesValue">₹0</strong></div><div class="card"><span>Total Due</span><strong id="salesDue">₹0</strong></div></div>
    <div class="panel table-wrap"><h3>Recent Pharmacy Bills</h3><table><thead><tr><th>Date</th><th>Patient</th><th>Type</th><th>Total</th><th>Paid</th><th>Due</th><th>Mode</th><th>Status</th><th>Print</th></tr></thead><tbody id="salesRows"></tbody></table></div>`;
  pharmacyBillItems=[]; billAmountPaidEdited=false; currentPharmacyPatient=null;
  await loadBillingStock();
  document.getElementById('phImport').onclick=importPharmacyPatient;
  document.getElementById('phSearch').onkeydown=e=>{if(e.key==='Enter')importPharmacyPatient()};
  document.getElementById('phSource').onchange=()=>{if(document.getElementById('phSource').value==='Walk-in')clearPharmacyPatient()};
  document.getElementById('billStockSelect').onchange=selectBillingStock;
  document.getElementById('billQty').oninput=updateBillLineTotal;
  document.getElementById('billSalePrice').oninput=updateBillLineTotal;
  document.getElementById('billAmountPaid').oninput=()=>{billAmountPaidEdited=true;};
  document.getElementById('billPaymentStatus').onchange=()=>{if(document.getElementById('billPaymentStatus').value==='Due'){billAmountPaidEdited=true;document.getElementById('billAmountPaid').value=0;}else{billAmountPaidEdited=false;renderBillItems();}};
  document.getElementById('addBillItemBtn').onclick=addPharmacyBillItem;
  document.getElementById('saveBillBtn').onclick=savePharmacyBill;
  document.getElementById('clearBillBtn').onclick=clearPharmacyBill;
  renderBillItems(); await loadPharmacySales();
}
function clearPharmacyPatient(){currentPharmacyPatient=null;document.getElementById('billPatientName').value='Walk-in';document.getElementById('billPatientType').value='Walk-in';document.getElementById('billUhid').value='';document.getElementById('billRef').value='';document.getElementById('phMsg').innerHTML='';}
async function importPharmacyPatient(){
  const source=document.getElementById('phSource').value; const q=document.getElementById('phSearch').value.trim().toLowerCase(); const msg=document.getElementById('phMsg');
  if(source==='Walk-in'){clearPharmacyPatient();msg.innerHTML="<p class='success'>Walk-in selected.</p>";return;}
  if(!q){msg.innerHTML="<p class='error'>Enter search text.</p>";return;}
  if(source==='IPD'){
    const rows=await fetchAll('ipd_admission');
    const a=rows.find(r=>isActiveAdmission(r) && [r.admission_id,r.uhid,r.patient_name,r.mobile].join(' ').toLowerCase().includes(q));
    if(!a){msg.innerHTML="<p class='error'>No active IPD admission found.</p>";return;}
    currentPharmacyPatient={type:'IPD',ref:a.admission_id||String(a.id),uhid:a.uhid||'',name:a.patient_name||''};
    document.getElementById('billPatientName').value=a.patient_name||''; document.getElementById('billPatientType').value='IPD'; document.getElementById('billUhid').value=a.uhid||''; document.getElementById('billRef').value=a.admission_id||String(a.id); document.getElementById('billPaymentStatus').value='Due'; document.getElementById('billAmountPaid').value=0; billAmountPaidEdited=true;
    msg.innerHTML=`<div class='sync-box'><b>IPD patient imported</b><br>${a.patient_name||''} · ${a.uhid||''} · ${a.admission_id||''}</div>`;
  }else{
    const rows=await fetchAll('opd_visits');
    const v=rows.find(r=>[r.visit_id,r.uhid,r.patient_name,r.mobile].join(' ').toLowerCase().includes(q));
    if(!v){msg.innerHTML="<p class='error'>No OPD visit found.</p>";return;}
    currentPharmacyPatient={type:'OPD',ref:v.visit_id||'',uhid:v.uhid||'',name:v.patient_name||''};
    document.getElementById('billPatientName').value=v.patient_name||''; document.getElementById('billPatientType').value='OPD'; document.getElementById('billUhid').value=v.uhid||''; document.getElementById('billRef').value=v.visit_id||'';
    msg.innerHTML=`<div class='sync-box'><b>OPD patient imported</b><br>${v.patient_name||''} · ${v.uhid||''} · ${v.visit_id||''}</div>`;
  }
}
async function loadBillingStock(){const sel=document.getElementById('billStockSelect');const {data,error}=await db.from('pharmacy_stock').select('*').gt('quantity',0).order('medicine_name',{ascending:true});if(error){sel.innerHTML='<option value="">Stock load failed</option>';return;}pharmacyStockRows=data||[];sel.innerHTML='<option value="">Select stock</option>'+pharmacyStockRows.map(r=>`<option value="${r.id}">${r.medicine_name||''} | Batch ${r.batch_no||''} | Exp ${r.expiry_date||''} | Qty ${r.quantity||0}</option>`).join('');}
function selectBillingStock(){const id=document.getElementById('billStockSelect').value;const stock=pharmacyStockRows.find(r=>String(r.id)===String(id));if(!stock)return;document.getElementById('billAvailableQty').value=stock.quantity||0;document.getElementById('billSalePrice').value=stock.sale_price||0;updateBillLineTotal();}
function updateBillLineTotal(){const qty=Number(document.getElementById('billQty').value||0);const rate=Number(document.getElementById('billSalePrice').value||0);document.getElementById('billLineTotal').value=(qty*rate).toFixed(2);}
function addPharmacyBillItem(){const id=document.getElementById('billStockSelect').value;const stock=pharmacyStockRows.find(r=>String(r.id)===String(id));if(!stock){alert('Select stock first.');return;}const qty=Number(document.getElementById('billQty').value||0);const available=Number(stock.quantity||0);if(qty<=0){alert('Quantity should be more than 0.');return;}if(qty>available){alert('Quantity is more than available stock.');return;}const rate=Number(document.getElementById('billSalePrice').value||0);pharmacyBillItems.push({stock_id:stock.id,medicine_name:stock.medicine_name,batch_no:stock.batch_no,expiry_date:stock.expiry_date,purchase_price:Number(stock.purchase_price||0),sale_price:rate,quantity:qty,total:qty*rate,available_before:available});document.getElementById('billStockSelect').value='';document.getElementById('billAvailableQty').value='';document.getElementById('billSalePrice').value=0;document.getElementById('billQty').value=1;updateBillLineTotal();renderBillItems();}
function removeBillItem(i){pharmacyBillItems.splice(i,1);renderBillItems();}
function renderBillItems(){const body=document.getElementById('billItemRows');const total=pharmacyBillItems.reduce((s,r)=>s+Number(r.total||0),0);document.getElementById('billGrandTotal').textContent=money(total);const paid=document.getElementById('billAmountPaid');const status=document.getElementById('billPaymentStatus');if(paid&&status&&!billAmountPaidEdited&&status.value==='Paid')paid.value=total.toFixed(2);body.innerHTML=pharmacyBillItems.length?pharmacyBillItems.map((r,i)=>`<tr><td>${r.medicine_name||''}</td><td>${r.batch_no||''}</td><td>${r.expiry_date||''}</td><td>${r.quantity}</td><td>${money(r.sale_price)}</td><td>${money(r.total)}</td><td><button type="button" class="secondary" onclick="removeBillItem(${i})">Remove</button></td></tr>`).join(''):"<tr><td colspan='7'>No item added.</td></tr>";}
function clearPharmacyBill(){pharmacyBillItems=[];billAmountPaidEdited=false;clearPharmacyPatient();document.getElementById('billAmountPaid').value=0;renderBillItems();}
async function savePharmacyBill(){if(currentUser.role!=='pharmacy'){alert('Only Pharmacy Staff can create pharmacy bills.');return;}if(!pharmacyBillItems.length){alert('Add at least one item.');return;}const total=pharmacyBillItems.reduce((s,r)=>s+Number(r.total||0),0);const status=document.getElementById('billPaymentStatus').value;const paid=status==='Due'?0:Number(document.getElementById('billAmountPaid').value||0);const due=status==='Due'?total:Math.max(total-paid,0);const payload={patient_name:document.getElementById('billPatientName').value.trim()||'Walk-in',patient_type:document.getElementById('billPatientType').value,bill_date:document.getElementById('billDate').value,bill_amount:total,amount_paid:paid,amount_due:due,payment_status:status,payment_mode:document.getElementById('billPaymentMode').value,items_json:JSON.stringify(pharmacyBillItems),created_at:new Date().toISOString()};const msg=document.getElementById('billingMessage');const {data:sale,error:saleError}=await db.from('pharmacy_sales').insert([payload]).select().single();if(saleError){msg.innerHTML=`<p class="error">Bill save failed: ${saleError.message}</p>`;return;}for(const item of pharmacyBillItems){const newQty=Number(item.available_before||0)-Number(item.quantity||0);const {error:updateError}=await db.from('pharmacy_stock').update({quantity:newQty}).eq('id',item.stock_id);if(updateError){msg.innerHTML=`<p class="error">Bill saved, but stock update failed for ${item.medicine_name}: ${updateError.message}</p>`;return;}}if(currentPharmacyPatient?.type==='IPD'){await db.from('ipd_daily_charges').insert([{admission_id:currentPharmacyPatient.ref,uhid:currentPharmacyPatient.uhid,patient_name:currentPharmacyPatient.name,charge_date:document.getElementById('billDate').value||todayISO(),category:'Pharmacy Charge',description:`Pharmacy Bill PH-${sale.id}`,rate:total,quantity:1,amount:total,created_at:new Date().toISOString()}]);}msg.innerHTML=`<p class="success">Bill saved and stock updated. <button type="button" class="secondary" onclick="printPharmacyBill(${sale.id})">Print Bill</button></p>`;clearPharmacyBill();await loadBillingStock();await loadPharmacySales();}
async function loadPharmacySales(){const body=document.getElementById('salesRows');const {data,error}=await db.from('pharmacy_sales').select('*').order('created_at',{ascending:false});if(error){body.innerHTML=`<tr><td colspan='9' class='error'>${error.message}</td></tr>`;return;}const rows=data||[];document.getElementById('salesCount').textContent=rows.length;document.getElementById('salesValue').textContent=money(rows.reduce((s,r)=>s+Number(r.bill_amount||0),0));document.getElementById('salesDue').textContent=money(rows.reduce((s,r)=>s+Number(r.amount_due||0),0));body.innerHTML=rows.length?rows.slice(0,50).map(r=>`<tr><td>${r.bill_date||rowDate(r)}</td><td>${r.patient_name||''}</td><td>${r.patient_type||''}</td><td>${money(r.bill_amount||0)}</td><td>${money(r.amount_paid||0)}</td><td>${money(r.amount_due||0)}</td><td>${r.payment_mode||''}</td><td>${r.payment_status||''}</td><td><button class='secondary' onclick='printPharmacyBill(${r.id})'>Print</button></td></tr>`).join(''):"<tr><td colspan='9'>No pharmacy bills.</td></tr>";}
