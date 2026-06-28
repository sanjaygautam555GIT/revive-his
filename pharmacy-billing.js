let pharmacyBillItems=[];
let pharmacyStockRows=[];
let billAmountPaidEdited=false;

async function renderPharmacyBilling(){
  const el=document.getElementById("pharmacyBillingView");
  el.innerHTML=`
    <div class="panel">
      <h2>Pharmacy Billing V3</h2>
      <p>Create medicine bills, save sale to Supabase, and reduce stock automatically.</p>
      <div class="grid" style="grid-template-columns:repeat(3,1fr)">
        <div><label>Patient / Customer Name</label><input id="billPatientName" value="Walk-in"></div>
        <div><label>Patient Type</label><select id="billPatientType"><option>Walk-in</option><option>OPD</option><option>IPD</option><option>Staff</option></select></div>
        <div><label>Bill Date</label><input id="billDate" type="date" value="${todayISO()}"></div>
        <div><label>Payment Mode</label><select id="billPaymentMode"><option>Cash</option><option>UPI</option><option>Bank</option><option>Credit</option></select></div>
        <div><label>Payment Status</label><select id="billPaymentStatus"><option>Paid</option><option>Due</option></select></div>
        <div><label>Amount Paid</label><input id="billAmountPaid" type="number" value="0" step="0.01"></div>
      </div>
    </div>

    <div class="panel">
      <h3>Add Medicine</h3>
      <div class="grid" style="grid-template-columns:repeat(4,1fr)">
        <div><label>Medicine / Batch</label><select id="billStockSelect"><option value="">Loading stock...</option></select></div>
        <div><label>Available Qty</label><input id="billAvailableQty" readonly></div>
        <div><label>Sale Price</label><input id="billSalePrice" type="number" value="0" step="0.01"></div>
        <div><label>Quantity</label><input id="billQty" type="number" value="1"></div>
        <div><label>Line Total</label><input id="billLineTotal" readonly value="0"></div>
      </div>
      <br><button id="addBillItemBtn" type="button">Add to Bill</button>
      <div id="billingMessage"></div>
    </div>

    <div class="panel table-wrap">
      <h3>Current Bill</h3>
      <table><thead><tr><th>Medicine</th><th>Batch</th><th>Expiry</th><th>Qty</th><th>Rate</th><th>Total</th><th>Action</th></tr></thead><tbody id="billItemRows"></tbody></table>
      <h3>Bill Total: <span id="billGrandTotal">₹0</span></h3>
      <button id="saveBillBtn" type="button">Save Bill & Deduct Stock</button>
      <button id="clearBillBtn" type="button" class="secondary">Clear Bill</button>
    </div>

    <div class="grid cards" style="margin-top:16px">
      <div class="card"><span>Total Bills</span><strong id="salesCount">0</strong></div>
      <div class="card"><span>Total Sales</span><strong id="salesValue">₹0</strong></div>
      <div class="card"><span>Total Due</span><strong id="salesDue">₹0</strong></div>
    </div>

    <div class="panel table-wrap"><h3>Recent Pharmacy Bills</h3><table><thead><tr><th>Date</th><th>Patient</th><th>Type</th><th>Total</th><th>Paid</th><th>Due</th><th>Mode</th><th>Status</th></tr></thead><tbody id="salesRows"></tbody></table></div>
  `;
  pharmacyBillItems=[];
  billAmountPaidEdited=false;
  await loadBillingStock();
  document.getElementById("billStockSelect").onchange=selectBillingStock;
  document.getElementById("billQty").oninput=updateBillLineTotal;
  document.getElementById("billSalePrice").oninput=updateBillLineTotal;
  document.getElementById("billAmountPaid").oninput=()=>{billAmountPaidEdited=true;};
  document.getElementById("billPaymentStatus").onchange=()=>{if(document.getElementById("billPaymentStatus").value==="Due"){billAmountPaidEdited=true;document.getElementById("billAmountPaid").value=0;}else{billAmountPaidEdited=false;renderBillItems();}};
  document.getElementById("addBillItemBtn").onclick=addPharmacyBillItem;
  document.getElementById("saveBillBtn").onclick=savePharmacyBill;
  document.getElementById("clearBillBtn").onclick=()=>{pharmacyBillItems=[];billAmountPaidEdited=false;renderBillItems();};
  renderBillItems();
  await loadPharmacySales();
}

async function loadBillingStock(){
  const sel=document.getElementById("billStockSelect");
  const {data,error}=await db.from("pharmacy_stock").select("*").gt("quantity",0).order("medicine_name",{ascending:true});
  if(error){sel.innerHTML=`<option value="">Stock load failed</option>`;return;}
  pharmacyStockRows=data||[];
  sel.innerHTML=`<option value="">Select medicine stock</option>`+pharmacyStockRows.map(r=>`<option value="${r.id}">${r.medicine_name||""} | Batch ${r.batch_no||""} | Exp ${r.expiry_date||""} | Qty ${r.quantity||0}</option>`).join("");
}

function selectBillingStock(){
  const id=document.getElementById("billStockSelect").value;
  const stock=pharmacyStockRows.find(r=>String(r.id)===String(id));
  if(!stock)return;
  document.getElementById("billAvailableQty").value=stock.quantity||0;
  document.getElementById("billSalePrice").value=stock.sale_price||0;
  updateBillLineTotal();
}

function updateBillLineTotal(){
  const qty=Number(document.getElementById("billQty").value||0);
  const rate=Number(document.getElementById("billSalePrice").value||0);
  document.getElementById("billLineTotal").value=(qty*rate).toFixed(2);
}

function addPharmacyBillItem(){
  const id=document.getElementById("billStockSelect").value;
  const stock=pharmacyStockRows.find(r=>String(r.id)===String(id));
  if(!stock){alert("Select medicine stock first.");return;}
  const qty=Number(document.getElementById("billQty").value||0);
  const available=Number(stock.quantity||0);
  if(qty<=0){alert("Quantity should be more than 0.");return;}
  if(qty>available){alert("Quantity is more than available stock.");return;}
  const rate=Number(document.getElementById("billSalePrice").value||0);
  pharmacyBillItems.push({
    stock_id:stock.id,
    medicine_name:stock.medicine_name,
    batch_no:stock.batch_no,
    expiry_date:stock.expiry_date,
    purchase_price:Number(stock.purchase_price||0),
    sale_price:rate,
    quantity:qty,
    total:qty*rate,
    available_before:available
  });
  document.getElementById("billStockSelect").value="";
  document.getElementById("billAvailableQty").value="";
  document.getElementById("billSalePrice").value=0;
  document.getElementById("billQty").value=1;
  updateBillLineTotal();
  renderBillItems();
}

function removeBillItem(i){
  pharmacyBillItems.splice(i,1);
  renderBillItems();
}

function renderBillItems(){
  const body=document.getElementById("billItemRows");
  const total=pharmacyBillItems.reduce((s,r)=>s+Number(r.total||0),0);
  document.getElementById("billGrandTotal").textContent=money(total);
  const paid=document.getElementById("billAmountPaid");
  const status=document.getElementById("billPaymentStatus");
  if(paid && status && !billAmountPaidEdited && status.value==="Paid") paid.value=total.toFixed(2);
  body.innerHTML=pharmacyBillItems.length?pharmacyBillItems.map((r,i)=>`<tr><td>${r.medicine_name||""}</td><td>${r.batch_no||""}</td><td>${r.expiry_date||""}</td><td>${r.quantity}</td><td>${money(r.sale_price)}</td><td>${money(r.total)}</td><td><button type="button" class="secondary" onclick="removeBillItem(${i})">Remove</button></td></tr>`).join(""):"<tr><td colspan='7'>No medicine added.</td></tr>";
}

async function savePharmacyBill(){
  if(currentUser.role!=="pharmacy"){
    alert("Only Pharmacy Staff can create pharmacy bills.");
    return;
  }
  if(!pharmacyBillItems.length){alert("Add at least one medicine.");return;}
  const total=pharmacyBillItems.reduce((s,r)=>s+Number(r.total||0),0);
  const status=document.getElementById("billPaymentStatus").value;
  const paid=status==="Due"?0:Number(document.getElementById("billAmountPaid").value||0);
  const due=status==="Due"?total:Math.max(total-paid,0);
  const payload={
    patient_name:document.getElementById("billPatientName").value.trim()||"Walk-in",
    patient_type:document.getElementById("billPatientType").value,
    bill_date:document.getElementById("billDate").value,
    bill_amount:total,
    amount_paid:paid,
    amount_due:due,
    payment_status:status,
    payment_mode:document.getElementById("billPaymentMode").value,
    items_json:JSON.stringify(pharmacyBillItems),
    created_at:new Date().toISOString()
  };
  const msg=document.getElementById("billingMessage");
  const {error:saleError}=await db.from("pharmacy_sales").insert([payload]);
  if(saleError){msg.innerHTML=`<p class="error">Bill save failed: ${saleError.message}</p>`;return;}
  for(const item of pharmacyBillItems){
    const newQty=Number(item.available_before||0)-Number(item.quantity||0);
    const {error:updateError}=await db.from("pharmacy_stock").update({quantity:newQty}).eq("id",item.stock_id);
    if(updateError){msg.innerHTML=`<p class="error">Bill saved, but stock update failed for ${item.medicine_name}: ${updateError.message}</p>`;return;}
  }
  msg.innerHTML=`<p class="success">Bill saved and stock deducted.</p>`;
  pharmacyBillItems=[];
  billAmountPaidEdited=false;
  document.getElementById("billPatientName").value="Walk-in";
  document.getElementById("billAmountPaid").value=0;
  renderBillItems();
  await loadBillingStock();
  await loadPharmacySales();
}

async function loadPharmacySales(){
  const body=document.getElementById("salesRows");
  const {data,error}=await db.from("pharmacy_sales").select("*").order("created_at",{ascending:false});
  if(error){body.innerHTML=`<tr><td colspan='8' class='error'>${error.message}</td></tr>`;return;}
  const rows=data||[];
  document.getElementById("salesCount").textContent=rows.length;
  document.getElementById("salesValue").textContent=money(rows.reduce((s,r)=>s+Number(r.bill_amount||0),0));
  document.getElementById("salesDue").textContent=money(rows.reduce((s,r)=>s+Number(r.amount_due||0),0));
  body.innerHTML=rows.length?rows.slice(0,50).map(r=>`<tr><td>${r.bill_date||rowDate(r)}</td><td>${r.patient_name||""}</td><td>${r.patient_type||""}</td><td>${money(r.bill_amount||0)}</td><td>${money(r.amount_paid||0)}</td><td>${money(r.amount_due||0)}</td><td>${r.payment_mode||""}</td><td>${r.payment_status||""}</td></tr>`).join(""):"<tr><td colspan='8'>No pharmacy bills.</td></tr>";
}
