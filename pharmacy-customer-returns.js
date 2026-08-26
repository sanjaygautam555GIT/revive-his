let customerReturnSales=[];
let customerReturnSelectedSale=null;
let customerReturnPriorByStock={};

const crEsc=v=>String(v??'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const crMoney=v=>`₹${Number(v||0).toFixed(2)}`;

function crParseBillItems(sale){
  let rows=[];try{rows=JSON.parse(sale?.items_json||'[]')}catch(e){}
  return rows.filter(x=>x&&!x.__bill_meta);
}
function crBillMeta(sale){let rows=[];try{rows=JSON.parse(sale?.items_json||'[]')}catch(e){}return rows.find(x=>x&&x.__bill_meta)||{};}

async function renderPharmacyCustomerReturns(){
  const el=document.getElementById('pharmacyCustomerReturnsView');if(!el)return;
  customerReturnSelectedSale=null;customerReturnPriorByStock={};
  el.innerHTML=`
  <div class="panel"><h3>Medicine Return</h3><div class="grid" style="grid-template-columns:2fr auto">
    <div><label>Find Original Pharmacy Bill</label><input id="crBillSearch" placeholder="Bill no. PH-123 / patient / mobile / UHID"></div>
    <div><label>&nbsp;</label><button type="button" id="crSearchBtn">Search Bill</button></div>
  </div><div id="crSearchMsg"></div><div id="crBillResults" class="table-wrap" style="margin-top:12px"></div></div>

  <div id="crReturnPanel" class="panel hidden">
    <h3>Return Against Original Bill</h3><div id="crBillInfo" class="sync-box"></div>
    <div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Medicine</th><th>Batch</th><th>Purchased</th><th>Already Returned</th><th>Return Qty</th><th>Rate</th><th>Refund</th><th>Condition</th></tr></thead><tbody id="crItemRows"></tbody></table></div>
    <div class="grid" style="grid-template-columns:repeat(3,1fr);margin-top:14px">
      <div><label>Return Date</label><input id="crReturnDate" type="date" value="${todayISO()}"></div>
      <div><label>Reason</label><select id="crReason"><option>Unused</option><option>Treatment changed</option><option>Doctor advised</option><option>Excess purchased</option><option>Other</option></select></div>
      <div><label>Refund Mode</label><select id="crRefundMode"><option>Cash</option><option>UPI</option><option>Credit adjustment</option><option>No refund</option></select></div>
      <div><label>Returned By</label><input id="crReturnedBy" placeholder="Patient / attendant name"></div>
      <div style="grid-column:span 2"><label>Remarks</label><input id="crRemarks" placeholder="Optional"></div>
    </div>
    <div style="display:flex;justify-content:flex-end;align-items:center;gap:16px;margin-top:16px"><strong>Total Refund: <span id="crTotalRefund">₹0.00</span></strong><button type="button" id="crSaveBtn">Complete Return</button></div>
    <div id="crSaveMsg"></div>
  </div>

  <div class="panel table-wrap"><h3>Return History</h3><table><thead><tr><th>Return ID</th><th>Date</th><th>Original Bill</th><th>Patient</th><th>Refund</th><th>Mode</th><th>Processed By</th><th>Receipt</th></tr></thead><tbody id="crHistoryRows"></tbody></table></div>`;

  document.getElementById('crSearchBtn').onclick=searchCustomerReturnBills;
  document.getElementById('crBillSearch').onkeydown=e=>{if(e.key==='Enter')searchCustomerReturnBills()};
  document.getElementById('crSaveBtn').onclick=saveCustomerMedicineReturn;
  await Promise.all([loadCustomerReturnSales(),loadCustomerReturnHistory()]);
}

async function loadCustomerReturnSales(){
  const {data,error}=await db.from('pharmacy_sales').select('*').order('created_at',{ascending:false});
  customerReturnSales=error?[]:(data||[]);
  if(error){const m=document.getElementById('crSearchMsg');if(m)m.innerHTML=`<p class="error">Unable to load pharmacy bills: ${crEsc(error.message)}</p>`;}
}

function searchCustomerReturnBills(){
  const q=(document.getElementById('crBillSearch')?.value||'').trim().toLowerCase();
  const box=document.getElementById('crBillResults');if(!box)return;
  if(!q){box.innerHTML='<p class="error">Enter bill number, patient name, mobile number or UHID.</p>';return;}
  const normalized=q.replace(/^ph[-\s]?/,'');
  const rows=customerReturnSales.filter(s=>{
    const meta=crBillMeta(s);
    const direct=String(s.id)===normalized;
    return direct||[s.patient_name,s.patient_type,meta.mobile,meta.uhid,meta.reference,`ph-${s.id}`].join(' ').toLowerCase().includes(q);
  }).slice(0,20);
  box.innerHTML=rows.length?`<table><thead><tr><th>Bill</th><th>Date</th><th>Patient</th><th>Type</th><th>Amount</th><th>Action</th></tr></thead><tbody>${rows.map(s=>`<tr><td>PH-${s.id}</td><td>${crEsc(s.bill_date||rowDate(s))}</td><td>${crEsc(s.patient_name||'')}</td><td>${crEsc(s.patient_type||'')}</td><td>${crMoney(s.bill_amount)}</td><td><button type="button" onclick="openCustomerReturnBill(${Number(s.id)})">Select</button></td></tr>`).join('')}</tbody></table>`:'<p>No matching pharmacy bill found.</p>';
}

async function openCustomerReturnBill(id){
  const sale=customerReturnSales.find(s=>String(s.id)===String(id));if(!sale)return;
  customerReturnSelectedSale=sale;customerReturnPriorByStock={};
  const {data,error}=await db.from('pharmacy_customer_return_items').select('stock_id,quantity').eq('sale_id',id);
  if(error){
    document.getElementById('crSearchMsg').innerHTML=`<p class="error">Patient return database is not ready: ${crEsc(error.message)}. Run pharmacy-customer-returns.sql once in Supabase.</p>`;return;
  }
  for(const r of data||[])customerReturnPriorByStock[String(r.stock_id)]=(customerReturnPriorByStock[String(r.stock_id)]||0)+Number(r.quantity||0);
  const meta=crBillMeta(sale),items=crParseBillItems(sale);
  document.getElementById('crBillInfo').innerHTML=`<b>PH-${sale.id}</b> · ${crEsc(sale.patient_name||'Walk-in')} · ${crEsc(sale.bill_date||rowDate(sale))}<br><span class="muted">UHID: ${crEsc(meta.uhid||'-')} · Mobile: ${crEsc(meta.mobile||'-')} · Original bill: ${crMoney(sale.bill_amount)}</span>`;
  const body=document.getElementById('crItemRows');
  body.innerHTML=items.map((x,i)=>{
    const prior=Number(customerReturnPriorByStock[String(x.stock_id)]||0),purchased=Number(x.quantity||0),max=Math.max(purchased-prior,0);
    return `<tr><td>${crEsc(x.medicine_name||'')}</td><td>${crEsc(x.batch_no||'')}</td><td>${purchased}</td><td>${prior}</td><td><input class="crQty" data-i="${i}" type="number" min="0" max="${max}" step="1" value="0" style="width:85px" ${max<=0?'disabled':''}></td><td>${crMoney(x.sale_price)}</td><td class="crRefund" data-i="${i}">₹0.00</td><td><select class="crCondition" data-i="${i}" ${max<=0?'disabled':''}><option>Sealed & reusable</option><option>Opened / non-reusable</option><option>Damaged</option><option>Expired</option></select></td></tr>`;
  }).join('')||'<tr><td colspan="8">No medicine items stored on this bill.</td></tr>';
  document.querySelectorAll('.crQty').forEach(e=>e.oninput=updateCustomerReturnTotal);
  document.getElementById('crReturnPanel').classList.remove('hidden');
  document.getElementById('crSaveMsg').innerHTML='';updateCustomerReturnTotal();
  document.getElementById('crReturnPanel').scrollIntoView({behavior:'smooth',block:'start'});
}

function selectedCustomerReturnItems(){
  if(!customerReturnSelectedSale)return [];
  const items=crParseBillItems(customerReturnSelectedSale),out=[];
  document.querySelectorAll('.crQty').forEach(inp=>{
    const i=Number(inp.dataset.i),qty=Number(inp.value||0);if(qty<=0)return;
    const max=Number(inp.max||0);if(qty>max)throw new Error(`Return quantity for ${items[i]?.medicine_name||'medicine'} exceeds remaining quantity.`);
    const cond=document.querySelector(`.crCondition[data-i="${i}"]`)?.value||'Sealed & reusable';
    out.push({stock_id:items[i].stock_id,quantity:qty,condition:cond,sale_price:Number(items[i].sale_price||0),medicine_name:items[i].medicine_name||''});
  });
  return out;
}

function updateCustomerReturnTotal(){
  let total=0;try{for(const x of selectedCustomerReturnItems())total+=x.quantity*x.sale_price}catch(e){}
  const e=document.getElementById('crTotalRefund');if(e)e.textContent=crMoney(total);
  document.querySelectorAll('.crRefund').forEach(cell=>{const i=Number(cell.dataset.i),inp=document.querySelector(`.crQty[data-i="${i}"]`),items=crParseBillItems(customerReturnSelectedSale);cell.textContent=crMoney(Number(inp?.value||0)*Number(items[i]?.sale_price||0));});
}

async function saveCustomerMedicineReturn(){
  const msg=document.getElementById('crSaveMsg'),btn=document.getElementById('crSaveBtn');
  if(!customerReturnSelectedSale){msg.innerHTML='<p class="error">Select an original bill first.</p>';return;}
  let items=[];try{items=selectedCustomerReturnItems()}catch(e){msg.innerHTML=`<p class="error">${crEsc(e.message)}</p>`;return;}
  if(!items.length){msg.innerHTML='<p class="error">Enter return quantity for at least one medicine.</p>';return;}
  if(document.getElementById('crRefundMode').value==='No refund'&&!confirm('This return is marked No refund. Continue?'))return;
  btn.disabled=true;btn.textContent='Saving...';
  try{
    const args={p_sale_id:customerReturnSelectedSale.id,p_items:items.map(x=>({stock_id:x.stock_id,quantity:x.quantity,condition:x.condition})),p_return_date:document.getElementById('crReturnDate').value||todayISO(),p_reason:document.getElementById('crReason').value,p_refund_mode:document.getElementById('crRefundMode').value,p_returned_by:document.getElementById('crReturnedBy').value||null,p_processed_by:currentUser?.name||currentUser?.username||'',p_remarks:document.getElementById('crRemarks').value||null};
    const {data,error}=await db.rpc('return_customer_medicines',args);if(error)throw error;
    msg.innerHTML=`<p class="success">Return completed. Return ID RET-${data}. Stock was restored only for items marked Sealed & reusable. <button type="button" class="secondary" onclick="printCustomerReturnReceipt(${Number(data)})">Print Receipt</button></p>`;
    await Promise.all([loadCustomerReturnSales(),loadCustomerReturnHistory()]);
    await openCustomerReturnBill(customerReturnSelectedSale.id);
  }catch(err){msg.innerHTML=`<p class="error">Return failed: ${crEsc(err.message||'Unknown error')}. If this is the first use, run pharmacy-customer-returns.sql once in Supabase SQL Editor.</p>`;}
  finally{btn.disabled=false;btn.textContent='Complete Return';}
}

async function loadCustomerReturnHistory(){
  const body=document.getElementById('crHistoryRows');if(!body)return;
  const {data,error}=await db.from('pharmacy_customer_returns').select('*').order('created_at',{ascending:false});
  if(error){body.innerHTML=`<tr><td colspan="8" class="error">Return history unavailable. Run pharmacy-customer-returns.sql once in Supabase.</td></tr>`;return;}
  const rows=data||[];body.innerHTML=rows.length?rows.slice(0,100).map(r=>`<tr><td>RET-${r.id}</td><td>${crEsc(r.return_date||rowDate(r))}</td><td>PH-${r.sale_id}</td><td>${crEsc(r.patient_name||'')}</td><td>${crMoney(r.refund_amount)}</td><td>${crEsc(r.refund_mode||'')}</td><td>${crEsc(r.processed_by||'-')}</td><td><button type="button" class="secondary" onclick="printCustomerReturnReceipt(${Number(r.id)})">Print</button></td></tr>`).join(''):'<tr><td colspan="8">No patient medicine returns recorded.</td></tr>';
}

async function printCustomerReturnReceipt(id){
  const {data:r,error}=await db.from('pharmacy_customer_returns').select('*').eq('id',id).single();if(error||!r){alert('Return receipt not found.');return;}
  const {data:items}=await db.from('pharmacy_customer_return_items').select('*').eq('return_id',id).order('id',{ascending:true});
  const rows=(items||[]).map((x,i)=>`<tr><td>${i+1}</td><td>${crEsc(x.medicine_name||'')}</td><td>${crEsc(x.batch_no||'')}</td><td>${x.quantity||0}</td><td>${crMoney(x.sale_price)}</td><td>${crMoney(x.refund_amount)}</td><td>${crEsc(x.item_condition||'')}</td></tr>`).join('');
  openPrintWindow(`<div style="text-align:center"><h2 style="margin:0">SHAGUN PHARMACY</h2><p style="margin:4px 0">Medicine Return Receipt / Credit Note</p></div><hr><div class="grid" style="grid-template-columns:repeat(2,1fr)"><div><b>Return ID:</b> RET-${r.id}</div><div><b>Return Date:</b> ${crEsc(r.return_date||rowDate(r))}</div><div><b>Original Bill:</b> PH-${r.sale_id}</div><div><b>Patient:</b> ${crEsc(r.patient_name||'')}</div><div><b>Returned By:</b> ${crEsc(r.returned_by||'-')}</div><div><b>Processed By:</b> ${crEsc(r.processed_by||'-')}</div><div><b>Reason:</b> ${crEsc(r.reason||'-')}</div><div><b>Refund Mode:</b> ${crEsc(r.refund_mode||'-')}</div></div><br><table><thead><tr><th>#</th><th>Medicine</th><th>Batch</th><th>Qty</th><th>Rate</th><th>Refund</th><th>Condition</th></tr></thead><tbody>${rows}</tbody></table><div style="margin-top:18px;text-align:right;font-size:18px"><b>Total Refund: ${crMoney(r.refund_amount)}</b></div>${r.remarks?`<p><b>Remarks:</b> ${crEsc(r.remarks)}</p>`:''}`);
}

window.renderPharmacyCustomerReturns=renderPharmacyCustomerReturns;
window.openCustomerReturnBill=openCustomerReturnBill;
window.printCustomerReturnReceipt=printCustomerReturnReceipt;
