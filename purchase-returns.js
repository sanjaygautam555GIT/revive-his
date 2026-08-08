let pharmacyReturnStockRows=[];
let pharmacyReturnPurchaseRows=[];
let selectedReturnStock=null;

function daysToExpiry(value){
  if(!value)return null;
  const today=new Date();today.setHours(0,0,0,0);
  const d=new Date(value+'T00:00:00');
  if(Number.isNaN(d.getTime()))return null;
  return Math.ceil((d-today)/86400000);
}
function returnExpiryStatus(row){
  const days=daysToExpiry(row.expiry_date);
  if(days===null)return {label:'No Expiry',cls:''};
  if(days<0)return {label:'Expired',cls:'error'};
  if(days<=90)return {label:`Near Expiry · ${days}d`,cls:'warning'};
  return {label:'Valid',cls:'success'};
}
function returnPurchaseMatch(stock){
  if(!stock)return null;
  const name=String(stock.medicine_name||'').trim().toLowerCase();
  const batch=String(stock.batch_no||'').trim().toLowerCase();
  return pharmacyReturnPurchaseRows.find(r=>String(r.medicine_name||'').trim().toLowerCase()===name&&String(r.batch_no||'').trim().toLowerCase()===batch)||null;
}

async function renderPurchaseReturns(){
  const el=document.getElementById('purchaseReturnsView');
  el.innerHTML=`
    <div class="panel">
      <div class="grid cards" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <div class="card"><span>Expired Batches</span><strong id="returnExpiredCount">0</strong></div>
        <div class="card"><span>Near Expiry ≤ 90 Days</span><strong id="returnNearCount">0</strong></div>
        <div class="card"><span>Return Value</span><strong id="returnTotalValue">₹0</strong></div>
      </div>
    </div>

    <div id="returnFormPanel" class="panel hidden">
      <h3>Return Stock to Supplier</h3>
      <div class="grid" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        <div><label>Medicine / Item</label><input id="returnMedicine" readonly></div>
        <div><label>Batch / Lot</label><input id="returnBatch" readonly></div>
        <div><label>Expiry Date</label><input id="returnExpiry" type="date" readonly></div>
        <div><label>Available Quantity</label><input id="returnAvailable" readonly></div>
        <div><label>Supplier</label><input id="returnSupplier" placeholder="Supplier name"></div>
        <div><label>Return Date</label><input id="returnDate" type="date" value="${todayISO()}"></div>
        <div><label>Quantity to Return</label><input id="returnQty" type="number" min="0.01" step="0.01"></div>
        <div><label>Reason</label><select id="returnReason"><option>Near Expiry</option><option>Expired</option><option>Damaged</option><option>Supplier Recall</option><option>Other</option></select></div>
        <div><label>Purchase Cost / Sale Unit</label><input id="returnUnitCost" readonly></div>
        <div><label>Estimated Return Value</label><input id="returnValue" readonly></div>
        <div><label>Credit Note No.</label><input id="returnCreditNote" placeholder="Optional"></div>
        <div><label>Remarks</label><input id="returnRemarks" placeholder="Optional"></div>
      </div>
      <div id="returnFormHint" style="margin-top:12px"></div>
      <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
        <button id="confirmReturnBtn" type="button">Confirm Return</button>
        <button id="cancelReturnBtn" type="button" class="secondary">Cancel</button>
      </div>
      <div id="returnMessage"></div>
    </div>

    <div class="panel table-wrap">
      <h3>Expired & Near Expiry Stock</h3>
      <table><thead><tr><th>Item</th><th>Batch</th><th>Expiry</th><th>Status</th><th>Qty</th><th>Supplier</th><th>Action</th></tr></thead><tbody id="returnCandidateRows"></tbody></table>
    </div>

    <div class="panel table-wrap">
      <h3>Purchase Returns Register</h3>
      <table><thead><tr><th>Date</th><th>Item</th><th>Batch</th><th>Supplier</th><th>Qty Returned</th><th>Reason</th><th>Return Value</th><th>Credit Note</th><th>User</th></tr></thead><tbody id="returnRegisterRows"></tbody></table>
    </div>`;

  document.getElementById('returnQty').oninput=calculateReturnValue;
  document.getElementById('confirmReturnBtn').onclick=confirmPurchaseReturn;
  document.getElementById('cancelReturnBtn').onclick=closePurchaseReturnForm;
  await loadPurchaseReturnData();
  if(window.__returnStockPrefill){
    const id=window.__returnStockPrefill;window.__returnStockPrefill=null;
    openPurchaseReturnForm(id);
  }
}

async function loadPurchaseReturnData(){
  const [stockResult,purchaseResult,returnResult]=await Promise.all([
    db.from('pharmacy_stock').select('*').order('expiry_date',{ascending:true}),
    db.from('pharmacy_purchases').select('*').order('created_at',{ascending:false}),
    db.from('pharmacy_purchase_returns').select('*').order('created_at',{ascending:false})
  ]);
  const candidateBody=document.getElementById('returnCandidateRows');
  const registerBody=document.getElementById('returnRegisterRows');
  if(stockResult.error){candidateBody.innerHTML=`<tr><td colspan="7" class="error">${stockResult.error.message}</td></tr>`;return;}
  pharmacyReturnStockRows=stockResult.data||[];
  pharmacyReturnPurchaseRows=purchaseResult.data||[];
  const returns=returnResult.data||[];
  const candidates=pharmacyReturnStockRows.filter(r=>Number(r.quantity||0)>0&&daysToExpiry(r.expiry_date)!==null&&daysToExpiry(r.expiry_date)<=90);
  document.getElementById('returnExpiredCount').textContent=candidates.filter(r=>daysToExpiry(r.expiry_date)<0).length;
  document.getElementById('returnNearCount').textContent=candidates.filter(r=>daysToExpiry(r.expiry_date)>=0).length;
  document.getElementById('returnTotalValue').textContent=money(returns.reduce((s,r)=>s+Number(r.return_value||0),0));
  candidateBody.innerHTML=candidates.length?candidates.map(r=>{
    const st=returnExpiryStatus(r),p=returnPurchaseMatch(r);
    return `<tr><td>${r.medicine_name||''}</td><td>${r.batch_no||''}</td><td>${r.expiry_date||''}</td><td><span class="${st.cls}">${st.label}</span></td><td>${r.quantity||0}</td><td>${p?.supplier_name||p?.supplier||'-'}</td><td><button type="button" onclick="openPurchaseReturnForm('${r.id}')">Return</button></td></tr>`;
  }).join(''):`<tr><td colspan="7">No expired or near-expiry stock found.</td></tr>`;
  if(returnResult.error){
    registerBody.innerHTML=`<tr><td colspan="9" class="error">Purchase Returns table is not ready. Run supabase/pharmacy-purchase-returns.sql in Supabase SQL Editor.</td></tr>`;
  }else{
    registerBody.innerHTML=returns.length?returns.map(r=>`<tr><td>${r.return_date||rowDate(r)}</td><td>${r.medicine_name||''}</td><td>${r.batch_no||''}</td><td>${r.supplier_name||''}</td><td>${r.quantity_returned||0}</td><td>${r.reason||''}</td><td>${money(r.return_value||0)}</td><td>${r.credit_note_no||''}</td><td>${r.created_by||''}</td></tr>`).join(''):`<tr><td colspan="9">No purchase returns recorded.</td></tr>`;
  }
}

function openPurchaseReturnForm(id){
  if(currentUser?.role!=='pharmacyOwner'){alert('Only Pharmacy Owner can return stock to supplier.');return;}
  const row=pharmacyReturnStockRows.find(r=>String(r.id)===String(id));
  if(!row){alert('Stock batch not found.');return;}
  selectedReturnStock=row;
  const purchase=returnPurchaseMatch(row);
  const days=daysToExpiry(row.expiry_date);
  document.getElementById('returnMedicine').value=row.medicine_name||'';
  document.getElementById('returnBatch').value=row.batch_no||'';
  document.getElementById('returnExpiry').value=row.expiry_date||'';
  document.getElementById('returnAvailable').value=Number(row.quantity||0);
  document.getElementById('returnSupplier').value=purchase?.supplier_name||purchase?.supplier||'';
  document.getElementById('returnQty').value=Number(row.quantity||0);
  document.getElementById('returnUnitCost').value=Number(row.purchase_price||0).toFixed(2);
  document.getElementById('returnReason').value=days!==null&&days<0?'Expired':'Near Expiry';
  document.getElementById('returnCreditNote').value='';
  document.getElementById('returnRemarks').value='';
  document.getElementById('returnMessage').innerHTML='';
  document.getElementById('returnFormHint').textContent=purchase?`Matched purchase record ${purchase.invoice_no||purchase.invoice_number||purchase.id||''}. Original purchase record will remain unchanged.`:'No matching purchase record found. The return can still be recorded against this stock batch.';
  calculateReturnValue();
  document.getElementById('returnFormPanel').classList.remove('hidden');
  document.getElementById('returnFormPanel').scrollIntoView({behavior:'smooth',block:'start'});
}
function closePurchaseReturnForm(){selectedReturnStock=null;document.getElementById('returnFormPanel')?.classList.add('hidden');}
function calculateReturnValue(){
  const qty=Number(document.getElementById('returnQty')?.value||0);
  const cost=Number(selectedReturnStock?.purchase_price||0);
  const field=document.getElementById('returnValue');if(field)field.value=(qty*cost).toFixed(2);
}

async function confirmPurchaseReturn(){
  const msg=document.getElementById('returnMessage');
  if(currentUser?.role!=='pharmacyOwner'){msg.innerHTML="<p class='error'>Only Pharmacy Owner can return stock.</p>";return;}
  if(!selectedReturnStock){msg.innerHTML="<p class='error'>Select a stock batch first.</p>";return;}
  const qty=Number(document.getElementById('returnQty').value||0);
  const available=Number(selectedReturnStock.quantity||0);
  if(qty<=0){msg.innerHTML="<p class='error'>Return quantity must be greater than zero.</p>";return;}
  if(qty>available){msg.innerHTML=`<p class='error'>Only ${available} units are available in this batch.</p>`;return;}
  const purchase=returnPurchaseMatch(selectedReturnStock);
  const btn=document.getElementById('confirmReturnBtn');btn.disabled=true;btn.textContent='Saving Return...';
  try{
    const {data,error}=await db.rpc('return_pharmacy_stock',{
      p_stock_id:String(selectedReturnStock.id),
      p_purchase_id:purchase?String(purchase.id||''):'',
      p_return_date:document.getElementById('returnDate').value||todayISO(),
      p_supplier_name:document.getElementById('returnSupplier').value.trim(),
      p_quantity:qty,
      p_reason:document.getElementById('returnReason').value,
      p_credit_note_no:document.getElementById('returnCreditNote').value.trim(),
      p_remarks:document.getElementById('returnRemarks').value.trim(),
      p_created_by:currentUser?.name||currentUser?.username||''
    });
    if(error)throw error;
    msg.innerHTML=`<p class="success">Return #${data} recorded. ${qty} unit(s) removed from this batch. Original purchase record retained.</p>`;
    selectedReturnStock=null;
    await loadPurchaseReturnData();
    setTimeout(closePurchaseReturnForm,1200);
  }catch(e){
    const setup=/return_pharmacy_stock|schema cache|function/i.test(e.message||'');
    msg.innerHTML=`<p class="error">${setup?'Purchase Returns database setup is required. Run supabase/pharmacy-purchase-returns.sql in Supabase SQL Editor.':e.message}</p>`;
  }finally{btn.disabled=false;btn.textContent='Confirm Return';}
}

window.openPurchaseReturnForm=openPurchaseReturnForm;
