async function renderPurchaseRegister(){
  const el=document.getElementById("purchaseRegisterView");
  el.innerHTML=`
    <div class="panel">
      <h2>Pharmacy Purchase Register</h2>
      <p>Select supplier and medicine from master lists. Purchase saves record and increases pharmacy stock.</p>
      <form id="purchaseForm">
        <div class="grid" style="grid-template-columns:repeat(3,1fr)">
          <div><label>Supplier</label><select id="purchaseSupplier" required><option value="">Loading suppliers...</option></select></div>
          <div><label>Invoice No</label><input id="purchaseInvoice" required></div>
          <div><label>Invoice Date</label><input id="purchaseDate" type="date" value="${todayISO()}" required></div>
          <div><label>Medicine Name</label><select id="purchaseMedicine" required><option value="">Loading medicines...</option></select></div>
          <div><label>Category</label><input id="purchaseCategory" placeholder="Tablet / Injection / Syrup"></div>
          <div><label>Batch No</label><input id="purchaseBatch"></div>
          <div><label>Expiry Date</label><input id="purchaseExpiry" type="date"></div>
          <div><label>Purchase Price / Unit</label><input id="purchasePrice" type="number" value="0" step="0.01"></div>
          <div><label>Sale Price / Unit</label><input id="purchaseSalePrice" type="number" value="0" step="0.01"></div>
          <div><label>Quantity</label><input id="purchaseQty" type="number" value="0"></div>
          <div><label>Payment Status</label><select id="purchasePaymentStatus"><option>Paid</option><option>Due</option><option>Partial</option></select></div>
          <div><label>Payment Mode</label><select id="purchasePaymentMode"><option>Cash</option><option>UPI</option><option>Bank</option><option>Credit</option></select></div>
        </div>
        <br><button type="submit">Save Purchase & Add Stock</button>
      </form>
      <div id="purchaseMessage"></div>
    </div>
    <div class="grid cards" style="margin-top:16px">
      <div class="card"><span>Purchase Records</span><strong id="purchaseCount">0</strong></div>
      <div class="card"><span>Total Purchase Value</span><strong id="purchaseValue">₹0</strong></div>
      <div class="card"><span>Due Purchase Value</span><strong id="purchaseDue">₹0</strong></div>
    </div>
    <div class="panel table-wrap"><h3>Recent Purchases</h3><table><thead><tr><th>Date</th><th>Supplier</th><th>Invoice</th><th>Medicine</th><th>Batch</th><th>Qty</th><th>Total</th><th>Status</th></tr></thead><tbody id="purchaseRows"></tbody></table></div>
  `;
  document.getElementById("purchaseForm").onsubmit=savePurchaseRegister;
  await loadPurchaseMasters();
  await loadPurchases();
}

async function loadPurchaseMasters(){
  const sup=document.getElementById("purchaseSupplier");
  const med=document.getElementById("purchaseMedicine");
  const [supRes,medRes]=await Promise.all([
    db.from("suppliers").select("*").order("supplier_name",{ascending:true}),
    db.from("medicine_master").select("*").order("medicine_name",{ascending:true})
  ]);
  if(supRes.error){sup.innerHTML=`<option value="">Supplier load failed</option>`;}else{
    sup.innerHTML=`<option value="">Select supplier</option>`+(supRes.data||[]).map(r=>`<option value="${r.supplier_name||""}">${r.supplier_name||""}</option>`).join("");
  }
  if(medRes.error){med.innerHTML=`<option value="">Medicine load failed</option>`;}else{
    window.purchaseMedicineMaster=medRes.data||[];
    med.innerHTML=`<option value="">Select medicine</option>`+window.purchaseMedicineMaster.map(r=>`<option value="${r.medicine_name||""}">${r.medicine_name||""}${r.strength?" - "+r.strength:""}</option>`).join("");
    med.onchange=()=>{
      const m=window.purchaseMedicineMaster.find(x=>x.medicine_name===med.value);
      if(!m)return;
      document.getElementById("purchaseCategory").value=m.category||m.unit||"";
      document.getElementById("purchasePrice").value=m.default_purchase_price||0;
      document.getElementById("purchaseSalePrice").value=m.default_sale_price||0;
    };
  }
}

async function savePurchaseRegister(e){
  e.preventDefault();
  if(currentUser.role!=="pharmacyOwner" && currentUser.role!=="accountant"){
    alert("Only Pharmacy Owner or Accountant can enter purchases.");
    return;
  }
  const qty=Number(document.getElementById("purchaseQty").value||0);
  const purchasePrice=Number(document.getElementById("purchasePrice").value||0);
  const total=qty*purchasePrice;
  const purchase={
    supplier:document.getElementById("purchaseSupplier").value,
    invoice_no:document.getElementById("purchaseInvoice").value.trim(),
    invoice_date:document.getElementById("purchaseDate").value,
    medicine_name:document.getElementById("purchaseMedicine").value,
    category:document.getElementById("purchaseCategory").value.trim()||null,
    batch_no:document.getElementById("purchaseBatch").value.trim()||null,
    expiry_date:document.getElementById("purchaseExpiry").value||null,
    purchase_price:purchasePrice,
    sale_price:Number(document.getElementById("purchaseSalePrice").value||0),
    quantity:qty,
    total_amount:total,
    payment_status:document.getElementById("purchasePaymentStatus").value,
    payment_mode:document.getElementById("purchasePaymentMode").value,
    created_at:new Date().toISOString()
  };
  const msg=document.getElementById("purchaseMessage");
  const {error:pError}=await db.from("pharmacy_purchases").insert([purchase]);
  if(pError){msg.innerHTML=`<p class="error">Purchase save failed: ${pError.message}</p>`;return;}
  const stock={medicine_name:purchase.medicine_name,category:purchase.category,batch_no:purchase.batch_no,expiry_date:purchase.expiry_date,purchase_price:purchase.purchase_price,sale_price:purchase.sale_price,quantity:purchase.quantity,created_at:new Date().toISOString()};
  const {error:sError}=await db.from("pharmacy_stock").insert([stock]);
  if(sError){msg.innerHTML=`<p class="error">Purchase saved, but stock add failed: ${sError.message}</p>`;await loadPurchases();return;}
  msg.innerHTML=`<p class="success">Purchase saved and stock increased.</p>`;
  document.getElementById("purchaseForm").reset();
  document.getElementById("purchaseDate").value=todayISO();
  await loadPurchaseMasters();
  await loadPurchases();
}

async function loadPurchases(){
  const body=document.getElementById("purchaseRows");
  if(!body)return;
  body.innerHTML="<tr><td colspan='8'>Loading purchases...</td></tr>";
  const {data,error}=await db.from("pharmacy_purchases").select("*").order("created_at",{ascending:false});
  if(error){body.innerHTML=`<tr><td colspan='8' class='error'>Purchase table error: ${error.message}</td></tr>`;return;}
  const rows=data||[];
  document.getElementById("purchaseCount").textContent=rows.length;
  document.getElementById("purchaseValue").textContent=money(rows.reduce((s,r)=>s+Number(r.total_amount||0),0));
  document.getElementById("purchaseDue").textContent=money(rows.filter(r=>(r.payment_status||"").toLowerCase()!=="paid").reduce((s,r)=>s+Number(r.total_amount||0),0));
  body.innerHTML=rows.length?rows.slice(0,50).map(r=>`<tr><td>${r.invoice_date||rowDate(r)}</td><td>${r.supplier||""}</td><td>${r.invoice_no||""}</td><td>${r.medicine_name||""}</td><td>${r.batch_no||""}</td><td>${r.quantity||0}</td><td>${money(r.total_amount||0)}</td><td>${r.payment_status||""}</td></tr>`).join(""):"<tr><td colspan='8'>No purchase records.</td></tr>";
}
