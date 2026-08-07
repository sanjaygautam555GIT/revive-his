const PHARMACY_GSTIN='09AYCPG7076L1ZZ';
let pharmacyBillItems=[];
let pharmacyStockRows=[];
let currentPharmacyPatient=null;

function pharmacyBillTotals(){
  const subtotal=pharmacyBillItems.reduce((sum,item)=>sum+Number(item.total||0),0);
  const discount=Math.min(Math.max(Number(document.getElementById('billDiscount')?.value||0),0),subtotal);
  const net=Math.max(subtotal-discount,0);
  const final=Math.round(net);
  const roundOff=final-net;
  return {subtotal,discount,net,roundOff,final};
}

function formatPharmacyMoney(value){return `₹${Number(value||0).toFixed(2)}`;}

async function renderPharmacyBilling(){
  const el=document.getElementById('pharmacyBillingView');
  if(!el)return;
  pharmacyBillItems=[];
  pharmacyStockRows=[];
  currentPharmacyPatient=null;

  el.innerHTML=`
    <div class="panel">
      <div class="grid" style="grid-template-columns:1fr 2fr auto">
        <div><label>Source</label><select id="phSource"><option>Walk-in</option><option>OPD</option><option>IPD</option></select></div>
        <div><label>Search Patient</label><input id="phSearch" placeholder="Name / mobile / UHID / visit ID / admission ID"></div>
        <div><label>&nbsp;</label><button type="button" id="phImport">Import</button></div>
      </div>
      <div id="phMsg"></div>
    </div>

    <div class="panel">
      <h3>Bill Details</h3>
      <div class="grid" style="grid-template-columns:repeat(3,1fr)">
        <div><label>Patient / Customer Name</label><input id="billPatientName" value="Walk-in"></div>
        <div><label>Patient Type</label><select id="billPatientType"><option>Walk-in</option><option>OPD</option><option>IPD</option><option>Staff</option></select></div>
        <div><label>Bill Date</label><input id="billDate" type="date" value="${todayISO()}"></div>
        <div><label>UHID</label><input id="billUhid" readonly></div>
        <div><label>Reference</label><input id="billRef" readonly></div>
        <div><label>Mobile Number</label><input id="billMobile" inputmode="tel"></div>
        <div><label>Payment Mode</label><select id="billPaymentMode"><option>Cash</option><option>UPI</option><option>Bank</option></select></div>
        <div><label>Amount Paid</label><input id="billAmountPaid" type="number" value="0" min="0" step="0.01"></div>
      </div>
    </div>

    <div class="panel">
      <h3>Add Item</h3>
      <div class="grid" style="grid-template-columns:repeat(4,1fr)">
        <div><label>Stock Item</label><select id="billStockSelect"><option value="">Loading...</option></select></div>
        <div><label>Pack</label><input id="billPack" readonly></div>
        <div><label>Available Individual Units</label><input id="billAvailableQty" readonly></div>
        <div><label>Sale Price per Unit</label><input id="billSalePrice" type="number" value="0" min="0" step="0.01"></div>
        <div><label>Quantity to Sell</label><input id="billQty" type="number" value="1" min="1" step="1"></div>
        <div><label>Line Total</label><input id="billLineTotal" readonly value="0.00"></div>
      </div>
      <br><button id="addBillItemBtn" type="button">Add to Bill</button>
      <div id="billingMessage"></div>
    </div>

    <div class="panel table-wrap">
      <h3>Current Bill</h3>
      <table>
        <thead><tr><th>Item</th><th>Pack</th><th>Batch</th><th>Expiry</th><th>Units</th><th>Rate/Unit</th><th>Total</th><th>Action</th></tr></thead>
        <tbody id="billItemRows"></tbody>
      </table>

      <div id="pharmacyBillSummary" style="max-width:430px;margin:18px 0 18px auto;border:1px solid #dfe7f0;border-radius:12px;padding:14px">
        <div style="display:grid;grid-template-columns:1fr 150px;gap:10px;align-items:center">
          <b>Subtotal</b><span id="billSubtotal" style="text-align:right">₹0.00</span>
          <label for="billDiscount" style="margin:0;font-weight:700">Discount (₹)</label><input id="billDiscount" type="number" min="0" step="0.01" value="0">
          <b>Net Amount</b><span id="billNetAmount" style="text-align:right">₹0.00</span>
          <b>Round Off</b><span id="billRoundOff" style="text-align:right">+₹0.00</span>
          <b style="border-top:1px solid #ddd;padding-top:9px">Final Bill</b><b id="billFinalAmount" style="text-align:right;border-top:1px solid #ddd;padding-top:9px;font-size:20px">₹0</b>
        </div>
        <p style="margin:12px 0 0;color:#667085;font-size:13px">Full payment is required before generating the pharmacy bill.</p>
      </div>

      <button id="saveBillBtn" type="button">Save Bill</button>
      <button id="clearBillBtn" type="button" class="secondary">Clear</button>
    </div>

    <div class="grid cards" style="margin-top:16px">
      <div class="card"><span>Total Bills</span><strong id="salesCount">0</strong></div>
      <div class="card"><span>Total Sales</span><strong id="salesValue">₹0</strong></div>
    </div>

    <div class="panel table-wrap">
      <h3>Recent Pharmacy Bills</h3>
      <table><thead><tr><th>Date</th><th>Patient</th><th>Type</th><th>Total</th><th>Paid</th><th>Mode</th><th>Print</th></tr></thead><tbody id="salesRows"></tbody></table>
    </div>`;

  document.getElementById('phImport').onclick=importPharmacyPatient;
  document.getElementById('phSearch').onkeydown=e=>{if(e.key==='Enter')importPharmacyPatient();};
  document.getElementById('phSource').onchange=()=>{if(document.getElementById('phSource').value==='Walk-in')clearPharmacyPatient();};
  document.getElementById('billStockSelect').onchange=selectBillingStock;
  document.getElementById('billQty').oninput=updateBillLineTotal;
  document.getElementById('billSalePrice').oninput=updateBillLineTotal;
  document.getElementById('billDiscount').oninput=renderBillItems;
  document.getElementById('addBillItemBtn').onclick=addPharmacyBillItem;
  document.getElementById('saveBillBtn').onclick=savePharmacyBill;
  document.getElementById('clearBillBtn').onclick=clearPharmacyBill;

  renderBillItems();
  await Promise.all([loadBillingStock(),loadPharmacySales()]);
}

function clearPharmacyPatient(){
  currentPharmacyPatient=null;
  const fields={billPatientName:'Walk-in',billPatientType:'Walk-in',billUhid:'',billRef:'',billMobile:'',phSearch:''};
  Object.entries(fields).forEach(([id,value])=>{const e=document.getElementById(id);if(e)e.value=value;});
  const msg=document.getElementById('phMsg');if(msg)msg.innerHTML='';
}

async function importPharmacyPatient(){
  const source=document.getElementById('phSource').value;
  const q=document.getElementById('phSearch').value.trim().toLowerCase();
  const msg=document.getElementById('phMsg');
  if(source==='Walk-in'){clearPharmacyPatient();msg.innerHTML="<p class='success'>Walk-in selected.</p>";return;}
  if(!q){msg.innerHTML="<p class='error'>Enter search text.</p>";return;}
  try{
    if(source==='IPD'){
      const rows=await fetchAll('ipd_admission');
      const a=rows.find(r=>isActiveAdmission(r)&&[r.admission_id,r.uhid,r.patient_name,r.mobile].join(' ').toLowerCase().includes(q));
      if(!a){msg.innerHTML="<p class='error'>No active IPD admission found.</p>";return;}
      currentPharmacyPatient={type:'IPD',ref:a.admission_id||String(a.id),uhid:a.uhid||'',name:a.patient_name||''};
      document.getElementById('billPatientName').value=a.patient_name||'';
      document.getElementById('billPatientType').value='IPD';
      document.getElementById('billUhid').value=a.uhid||'';
      document.getElementById('billRef').value=a.admission_id||String(a.id);
      document.getElementById('billMobile').value=a.mobile||'';
      msg.innerHTML=`<div class='sync-box'><b>IPD patient imported</b><br>${a.patient_name||''} · ${a.uhid||''} · ${a.admission_id||''}</div>`;
    }else{
      const rows=await fetchAll('opd_visits');
      const v=rows.find(r=>[r.visit_id,r.uhid,r.patient_name,r.mobile].join(' ').toLowerCase().includes(q));
      if(!v){msg.innerHTML="<p class='error'>No OPD visit found.</p>";return;}
      currentPharmacyPatient={type:'OPD',ref:v.visit_id||'',uhid:v.uhid||'',name:v.patient_name||''};
      document.getElementById('billPatientName').value=v.patient_name||'';
      document.getElementById('billPatientType').value='OPD';
      document.getElementById('billUhid').value=v.uhid||'';
      document.getElementById('billRef').value=v.visit_id||'';
      document.getElementById('billMobile').value=v.mobile||'';
      msg.innerHTML=`<div class='sync-box'><b>OPD patient imported</b><br>${v.patient_name||''} · ${v.uhid||''} · ${v.visit_id||''}</div>`;
    }
  }catch(error){msg.innerHTML=`<p class='error'>Patient import failed: ${error.message}</p>`;}
}

async function loadBillingStock(){
  const sel=document.getElementById('billStockSelect');
  if(!sel)return;
  sel.innerHTML='<option value="">Loading...</option>';
  const {data,error}=await db.from('pharmacy_stock').select('*').gt('quantity',0).order('medicine_name',{ascending:true});
  if(error){sel.innerHTML='<option value="">Stock load failed</option>';return;}
  pharmacyStockRows=data||[];
  sel.innerHTML='<option value="">Select stock</option>'+pharmacyStockRows.map(r=>`<option value="${r.id}">${r.medicine_name||''} | Pack ${r.unit||'1x1'} | Batch ${r.batch_no||''} | Units ${r.quantity||0}</option>`).join('');
}

function selectBillingStock(){
  const id=document.getElementById('billStockSelect').value;
  const stock=pharmacyStockRows.find(r=>String(r.id)===String(id));
  if(!stock){document.getElementById('billPack').value='';document.getElementById('billAvailableQty').value='';document.getElementById('billSalePrice').value='0';updateBillLineTotal();return;}
  document.getElementById('billPack').value=stock.unit||'1x1';
  const already=pharmacyBillItems.filter(x=>String(x.stock_id)===String(stock.id)).reduce((s,x)=>s+Number(x.quantity||0),0);
  document.getElementById('billAvailableQty').value=Math.max(Number(stock.quantity||0)-already,0);
  document.getElementById('billSalePrice').value=Number(stock.sale_price||0).toFixed(2);
  updateBillLineTotal();
}

function updateBillLineTotal(){
  const qty=Math.max(Number(document.getElementById('billQty')?.value||0),0);
  const rate=Math.max(Number(document.getElementById('billSalePrice')?.value||0),0);
  const el=document.getElementById('billLineTotal');if(el)el.value=(qty*rate).toFixed(2);
}

function addPharmacyBillItem(){
  const stockId=document.getElementById('billStockSelect').value;
  const stock=pharmacyStockRows.find(r=>String(r.id)===String(stockId));
  if(!stock){alert('Select stock first.');return;}
  const qty=Number(document.getElementById('billQty').value||0);
  const rate=Number(document.getElementById('billSalePrice').value||0);
  const already=pharmacyBillItems.filter(x=>String(x.stock_id)===String(stock.id)).reduce((s,x)=>s+Number(x.quantity||0),0);
  const remaining=Math.max(Number(stock.quantity||0)-already,0);
  if(!Number.isFinite(qty)||qty<=0){alert('Quantity should be more than 0.');return;}
  if(qty>remaining){alert(`Only ${remaining} unit(s) are available.`);return;}
  if(!Number.isFinite(rate)||rate<0){alert('Enter a valid sale price.');return;}

  const existing=pharmacyBillItems.find(x=>String(x.stock_id)===String(stock.id)&&Number(x.sale_price)===rate);
  if(existing){existing.quantity+=qty;existing.total=existing.quantity*rate;}
  else pharmacyBillItems.push({stock_id:stock.id,medicine_name:stock.medicine_name||'',unit:stock.unit||'1x1',batch_no:stock.batch_no||'',expiry_date:stock.expiry_date||'',purchase_price:Number(stock.purchase_price||0),sale_price:rate,quantity:qty,total:qty*rate,available_before:Number(stock.quantity||0)});

  document.getElementById('billStockSelect').value='';
  document.getElementById('billPack').value='';
  document.getElementById('billAvailableQty').value='';
  document.getElementById('billSalePrice').value='0';
  document.getElementById('billQty').value='1';
  updateBillLineTotal();
  renderBillItems();
}

function removeBillItem(index){pharmacyBillItems.splice(index,1);renderBillItems();}

function renderBillItems(){
  const body=document.getElementById('billItemRows');
  if(!body)return;
  body.innerHTML=pharmacyBillItems.length?pharmacyBillItems.map((r,i)=>`<tr><td>${r.medicine_name}</td><td>${r.unit}</td><td>${r.batch_no}</td><td>${r.expiry_date}</td><td>${r.quantity}</td><td>${formatPharmacyMoney(r.sale_price)}</td><td>${formatPharmacyMoney(r.total)}</td><td><button type="button" class="secondary" onclick="removeBillItem(${i})">Remove</button></td></tr>`).join(''):"<tr><td colspan='8'>No item added.</td></tr>";

  const t=pharmacyBillTotals();
  const values={billSubtotal:formatPharmacyMoney(t.subtotal),billNetAmount:formatPharmacyMoney(t.net),billRoundOff:`${t.roundOff>=0?'+':''}${formatPharmacyMoney(t.roundOff)}`,billFinalAmount:`₹${t.final}`};
  Object.entries(values).forEach(([id,value])=>{const e=document.getElementById(id);if(e)e.textContent=value;});
  const paid=document.getElementById('billAmountPaid');if(paid)paid.value=t.final.toFixed(2);
}

function clearPharmacyBill(){
  pharmacyBillItems=[];
  clearPharmacyPatient();
  const discount=document.getElementById('billDiscount');if(discount)discount.value='0';
  const paid=document.getElementById('billAmountPaid');if(paid)paid.value='0';
  const message=document.getElementById('billingMessage');if(message)message.innerHTML='';
  renderBillItems();
}

async function savePharmacyBill(){
  if(currentUser?.role!=='pharmacy'){alert('Only Pharmacy Staff can create pharmacy bills.');return;}
  if(!pharmacyBillItems.length){alert('Add at least one item.');return;}
  const t=pharmacyBillTotals();
  if(t.final<=0){alert('Final bill amount must be greater than zero.');return;}
  const paid=Number(document.getElementById('billAmountPaid').value||0);
  if(Math.abs(paid-t.final)>0.009){alert(`Full payment of ₹${t.final} is required before generating the pharmacy bill.`);document.getElementById('billAmountPaid').focus();return;}

  const meta={__bill_meta:true,subtotal:t.subtotal,discount_amount:t.discount,net_amount:t.net,round_off:t.roundOff,final_bill:t.final,uhid:document.getElementById('billUhid').value||'',reference:document.getElementById('billRef').value||'',mobile:document.getElementById('billMobile').value||'',pharmacist:currentUser?.name||currentUser?.username||'',bill_time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})};
  const payload={patient_name:document.getElementById('billPatientName').value.trim()||'Walk-in',patient_type:document.getElementById('billPatientType').value,bill_date:document.getElementById('billDate').value,bill_amount:t.final,amount_paid:t.final,amount_due:0,payment_status:'Paid',payment_mode:document.getElementById('billPaymentMode').value,items_json:JSON.stringify([...pharmacyBillItems,meta]),created_at:new Date().toISOString()};
  const msg=document.getElementById('billingMessage');
  const saveBtn=document.getElementById('saveBillBtn');
  saveBtn.disabled=true;saveBtn.textContent='Saving...';
  try{
    const {data:sale,error:saleError}=await db.from('pharmacy_sales').insert([payload]).select().single();
    if(saleError)throw saleError;

    for(const item of pharmacyBillItems){
      const stock=pharmacyStockRows.find(r=>String(r.id)===String(item.stock_id));
      const currentQty=Number(stock?.quantity??item.available_before??0);
      const soldForStock=pharmacyBillItems.filter(x=>String(x.stock_id)===String(item.stock_id)).reduce((s,x)=>s+Number(x.quantity||0),0);
      if(pharmacyBillItems.findIndex(x=>String(x.stock_id)===String(item.stock_id))!==pharmacyBillItems.indexOf(item))continue;
      const newQty=Math.max(currentQty-soldForStock,0);
      const {error:updateError}=await db.from('pharmacy_stock').update({quantity:newQty}).eq('id',item.stock_id);
      if(updateError)throw new Error(`Bill saved, but stock update failed for ${item.medicine_name}: ${updateError.message}`);
    }

    if(currentPharmacyPatient?.type==='IPD'){
      const {error:chargeError}=await db.from('ipd_daily_charges').insert([{admission_id:currentPharmacyPatient.ref,uhid:currentPharmacyPatient.uhid,patient_name:currentPharmacyPatient.name,charge_date:document.getElementById('billDate').value||todayISO(),category:'Pharmacy Charge',description:`Pharmacy Bill PH-${sale.id}`,rate:t.final,quantity:1,amount:t.final,created_at:new Date().toISOString()}]);
      if(chargeError)console.warn('IPD charge sync failed',chargeError);
    }

    msg.innerHTML=`<p class="success">Payment received. Bill saved and stock updated. <button type="button" class="secondary" onclick="printPharmacyBill(${sale.id})">Print Bill</button></p>`;
    pharmacyBillItems=[];
    clearPharmacyPatient();
    document.getElementById('billDiscount').value='0';
    renderBillItems();
    await Promise.all([loadBillingStock(),loadPharmacySales()]);
  }catch(error){msg.innerHTML=`<p class="error">${error.message||'Unable to save pharmacy bill.'}</p>`;}
  finally{saveBtn.disabled=false;saveBtn.textContent='Save Bill';}
}

async function loadPharmacySales(){
  const body=document.getElementById('salesRows');
  if(!body)return;
  body.innerHTML="<tr><td colspan='7'>Loading...</td></tr>";
  const {data,error}=await db.from('pharmacy_sales').select('*').order('created_at',{ascending:false});
  if(error){body.innerHTML=`<tr><td colspan='7' class='error'>${error.message}</td></tr>`;return;}
  const rows=data||[];
  document.getElementById('salesCount').textContent=rows.length;
  document.getElementById('salesValue').textContent=money(rows.reduce((s,r)=>s+Number(r.bill_amount||0),0));
  body.innerHTML=rows.length?rows.slice(0,50).map(r=>`<tr><td>${r.bill_date||rowDate(r)}</td><td>${r.patient_name||''}</td><td>${r.patient_type||''}</td><td>${money(r.bill_amount||0)}</td><td>${money(r.amount_paid||0)}</td><td>${r.payment_mode||''}</td><td><button type="button" class="secondary" onclick="printPharmacyBill(${r.id})">Print</button></td></tr>`).join(''):"<tr><td colspan='7'>No pharmacy bills.</td></tr>";
}

async function printPharmacyBill(id){
  const bills=await fetchAll('pharmacy_sales');
  const bill=bills.find(x=>String(x.id)===String(id));
  if(!bill){alert('Pharmacy bill not found.');return;}
  let stored=[];try{stored=JSON.parse(bill.items_json||'[]');}catch(e){stored=[];}
  const meta=stored.find(x=>x?.__bill_meta)||{};
  const list=stored.filter(x=>!x?.__bill_meta);
  const subtotal=Number(meta.subtotal??list.reduce((s,x)=>s+Number(x.total||0),0));
  const discount=Number(meta.discount_amount||0);
  const net=Number(meta.net_amount??subtotal-discount);
  const final=Number(meta.final_bill??bill.bill_amount||0);
  const roundOff=Number(meta.round_off??final-net);
  const rows=list.map((x,i)=>`<tr><td>${i+1}</td><td>${x.medicine_name||''}</td><td>${x.batch_no||''}</td><td>${x.expiry_date||''}</td><td>${x.quantity||0}</td><td>${money(x.sale_price||0)}</td><td>${money(x.total||0)}</td></tr>`).join('');
  openPrintWindow(`<div style="text-align:center"><h2 style="margin:0">Revive HealthScope Pharmacy</h2><p><b>GSTIN: ${PHARMACY_GSTIN}</b></p><p>Pharmacy Invoice</p></div><hr><div class="grid" style="grid-template-columns:repeat(2,1fr)"><div><b>Invoice:</b> PH-${bill.id}</div><div><b>Date & Time:</b> ${bill.bill_date||rowDate(bill)} ${meta.bill_time||''}</div><div><b>Patient:</b> ${bill.patient_name||''}</div><div><b>Type:</b> ${bill.patient_type||''}</div><div><b>UHID:</b> ${meta.uhid||'-'}</div><div><b>Mobile:</b> ${meta.mobile||'-'}</div><div><b>Payment:</b> ${bill.payment_mode||''}</div><div><b>Pharmacist/User:</b> ${meta.pharmacist||'-'}</div></div><br><table><thead><tr><th>#</th><th>Medicine</th><th>Batch</th><th>Expiry</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><div style="max-width:330px;margin:18px 0 0 auto;text-align:right">Subtotal: <b>${formatPharmacyMoney(subtotal)}</b><br>Discount: <b>${formatPharmacyMoney(discount)}</b><br>Net Amount: <b>${formatPharmacyMoney(net)}</b><br>Round Off: <b>${roundOff>=0?'+':''}${formatPharmacyMoney(roundOff)}</b><hr>Final Bill: <b style="font-size:20px">₹${final.toFixed(0)}</b><br>Paid: <b>${formatPharmacyMoney(bill.amount_paid)}</b><br>Balance: <b>₹0.00</b></div><p style="margin-top:28px;text-align:center;font-size:12px">Thank you for visiting Revive HealthScope Pharmacy.<br>Medicines once sold will not be taken back or exchanged.<br>Please preserve this invoice for future reference.</p>`);
}

window.renderPharmacyBilling=renderPharmacyBilling;
window.removeBillItem=removeBillItem;
window.printPharmacyBill=printPharmacyBill;
