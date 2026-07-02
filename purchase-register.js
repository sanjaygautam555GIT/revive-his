let purchaseInvoiceItems=[];
let previousPurchaseMedicines=[];
let previousPurchaseSuppliers=[];

async function renderPurchaseRegister(){
  const el=document.getElementById("purchaseRegisterView");
  el.innerHTML=`
    <div class="panel">
      <h2>Pharmacy Purchase Register</h2>
      <p>Type supplier and medicine directly. Saving purchase will add stock automatically.</p>
      <div class="grid" style="grid-template-columns:repeat(3,1fr)">
        <div><label>Supplier Name</label><input id="purchaseSupplier" list="supplierSuggestions" required><datalist id="supplierSuggestions"></datalist></div>
        <div><label>Invoice No</label><input id="purchaseInvoice" required></div>
        <div><label>Invoice Date</label><input id="purchaseDate" type="date" value="${todayISO()}" required></div>
        <div><label>Payment Status</label><select id="purchasePaymentStatus"><option>Paid</option><option>Due</option><option>Partial</option></select></div>
        <div><label>Payment Mode</label><select id="purchasePaymentMode"><option>Cash</option><option>UPI</option><option>Bank</option><option>Credit</option></select></div>
      </div>
    </div>

    <div class="panel">
      <h3>Add Medicine Row</h3>
      <div class="grid" style="grid-template-columns:repeat(4,1fr)">
        <div><label>Medicine Name</label><input id="purchaseMedicine" list="medicineSuggestions" placeholder="Type medicine name"><datalist id="medicineSuggestions"></datalist></div>
        <div><label>Category / Unit</label><input id="purchaseCategory" placeholder="Tab / Inj / Syrup etc"></div>
        <div><label>Batch No</label><input id="purchaseBatch"></div>
        <div><label>Expiry Date</label><input id="purchaseExpiry" type="date"></div>
        <div><label>Quantity</label><input id="purchaseQty" type="number" value="0"></div>
        <div><label>Purchase Price</label><input id="purchasePrice" type="number" value="0" step="0.01"></div>
        <div><label>MRP</label><input id="purchaseMrp" type="number" value="0" step="0.01"></div>
        <div><label>Sale Price</label><input id="purchaseSalePrice" type="number" value="0" step="0.01"></div>
        <div><label>Line Total</label><input id="purchaseLineTotal" readonly value="0"></div>
      </div>
      <br><button id="addPurchaseItemBtn" type="button">Add Medicine to Invoice</button>
      <div id="purchaseMessage"></div>
    </div>

    <div class="panel table-wrap">
      <h3>Current Invoice</h3>
      <table><thead><tr><th>Medicine</th><th>Batch</th><th>Expiry</th><th>Qty</th><th>Purchase</th><th>MRP</th><th>Sale</th><th>Total</th><th>Action</th></tr></thead><tbody id="purchaseItemRows"></tbody></table>
      <h3>Grand Total: <span id="purchaseGrandTotal">₹0</span></h3>
      <button id="saveInvoiceBtn" type="button">Save Invoice & Add Stock</button>
      <button id="clearInvoiceBtn" type="button" class="secondary">Clear Invoice</button>
    </div>

    <div class="grid cards" style="margin-top:16px">
      <div class="card"><span>Purchase Rows</span><strong id="purchaseCount">0</strong></div>
      <div class="card"><span>Total Purchase Value</span><strong id="purchaseValue">₹0</strong></div>
      <div class="card"><span>Due Purchase Value</span><strong id="purchaseDue">₹0</strong></div>
    </div>

    <div class="panel table-wrap"><h3>Recent Purchase Items</h3><table><thead><tr><th>Date</th><th>Supplier</th><th>Invoice</th><th>Medicine</th><th>Batch</th><th>Qty</th><th>Total</th><th>Status</th></tr></thead><tbody id="purchaseRows"></tbody></table></div>
  `;
  purchaseInvoiceItems=[];
  await loadPurchaseSuggestions();
  document.getElementById("purchaseMedicine").onchange=applyPreviousMedicineDetails;
  document.getElementById("purchaseQty").oninput=updatePurchaseLineTotal;
  document.getElementById("purchasePrice").oninput=updatePurchaseLineTotal;
  document.getElementById("addPurchaseItemBtn").onclick=addPurchaseInvoiceItem;
  document.getElementById("saveInvoiceBtn").onclick=saveCompletePurchaseInvoice;
  document.getElementById("clearInvoiceBtn").onclick=()=>{purchaseInvoiceItems=[];renderPurchaseItems();};
  renderPurchaseItems();
  await loadPurchases();
}

function updatePurchaseLineTotal(){
  const qty=Number(document.getElementById("purchaseQty").value||0);
  const price=Number(document.getElementById("purchasePrice").value||0);
  document.getElementById("purchaseLineTotal").value=(qty*price).toFixed(2);
}

async function loadPurchaseSuggestions(){
  const [purchaseRes,stockRes]=await Promise.all([
    db.from("pharmacy_purchases").select("supplier,medicine_name,category,purchase_price,sale_price,mrp").order("created_at",{ascending:false}).limit(1000),
    db.from("pharmacy_stock").select("medicine_name,category,purchase_price,sale_price,mrp").order("medicine_name",{ascending:true}).limit(1000)
  ]);
  const pRows=purchaseRes.data||[];
  const sRows=stockRes.data||[];
  previousPurchaseSuppliers=[...new Set(pRows.map(r=>r.supplier).filter(Boolean))];
  const medMap=new Map();
  [...pRows,...sRows].forEach(r=>{if(r.medicine_name&&!medMap.has(r.medicine_name.toLowerCase()))medMap.set(r.medicine_name.toLowerCase(),r)});
  previousPurchaseMedicines=[...medMap.values()];
  document.getElementById("supplierSuggestions").innerHTML=previousPurchaseSuppliers.map(x=>`<option value="${x}"></option>`).join("");
  document.getElementById("medicineSuggestions").innerHTML=previousPurchaseMedicines.map(x=>`<option value="${x.medicine_name}"></option>`).join("");
}

function applyPreviousMedicineDetails(){
  const name=document.getElementById("purchaseMedicine").value.trim().toLowerCase();
  const m=previousPurchaseMedicines.find(x=>(x.medicine_name||"").toLowerCase()===name);
  if(!m)return;
  document.getElementById("purchaseCategory").value=m.category||"";
  document.getElementById("purchasePrice").value=m.purchase_price||0;
  document.getElementById("purchaseMrp").value=m.mrp||0;
  document.getElementById("purchaseSalePrice").value=m.sale_price||0;
  updatePurchaseLineTotal();
}

function addPurchaseInvoiceItem(){
  const med=document.getElementById("purchaseMedicine").value.trim();
  const qty=Number(document.getElementById("purchaseQty").value||0);
  const purchasePrice=Number(document.getElementById("purchasePrice").value||0);
  if(!med){alert("Enter medicine name first.");return;}
  if(qty<=0){alert("Quantity should be more than 0.");return;}
  purchaseInvoiceItems.push({
    medicine_name:med,
    category:document.getElementById("purchaseCategory").value.trim()||null,
    batch_no:document.getElementById("purchaseBatch").value.trim()||null,
    expiry_date:document.getElementById("purchaseExpiry").value||null,
    quantity:qty,
    purchase_price:purchasePrice,
    mrp:Number(document.getElementById("purchaseMrp").value||0),
    sale_price:Number(document.getElementById("purchaseSalePrice").value||0),
    total_amount:qty*purchasePrice
  });
  document.getElementById("purchaseMedicine").value="";
  document.getElementById("purchaseCategory").value="";
  document.getElementById("purchaseBatch").value="";
  document.getElementById("purchaseExpiry").value="";
  document.getElementById("purchaseQty").value=0;
  document.getElementById("purchasePrice").value=0;
  document.getElementById("purchaseMrp").value=0;
  document.getElementById("purchaseSalePrice").value=0;
  updatePurchaseLineTotal();
  renderPurchaseItems();
}

function removePurchaseItem(i){purchaseInvoiceItems.splice(i,1);renderPurchaseItems();}

function renderPurchaseItems(){
  const body=document.getElementById("purchaseItemRows");
  const total=purchaseInvoiceItems.reduce((s,r)=>s+Number(r.total_amount||0),0);
  document.getElementById("purchaseGrandTotal").textContent=money(total);
  body.innerHTML=purchaseInvoiceItems.length?purchaseInvoiceItems.map((r,i)=>`<tr><td>${r.medicine_name}</td><td>${r.batch_no||""}</td><td>${r.expiry_date||""}</td><td>${r.quantity}</td><td>${money(r.purchase_price)}</td><td>${money(r.mrp||0)}</td><td>${money(r.sale_price)}</td><td>${money(r.total_amount)}</td><td><button type="button" class="secondary" onclick="removePurchaseItem(${i})">Remove</button></td></tr>`).join(""):"<tr><td colspan='9'>No medicine added to current invoice.</td></tr>";
}

async function saveCompletePurchaseInvoice(){
  if(currentUser.role!=="pharmacyOwner" && currentUser.role!=="accountant"){alert("Only Pharmacy Owner or Accountant can enter purchases.");return;}
  const supplier=document.getElementById("purchaseSupplier").value.trim();
  const invoiceNo=document.getElementById("purchaseInvoice").value.trim();
  const invoiceDate=document.getElementById("purchaseDate").value;
  if(!supplier||!invoiceNo||!invoiceDate){alert("Fill supplier name, invoice number and invoice date.");return;}
  if(!purchaseInvoiceItems.length){alert("Add at least one medicine row.");return;}
  const paymentStatus=document.getElementById("purchasePaymentStatus").value;
  const paymentMode=document.getElementById("purchasePaymentMode").value;
  const rows=purchaseInvoiceItems.map(item=>({...item,supplier,invoice_no:invoiceNo,invoice_date:invoiceDate,payment_status:paymentStatus,payment_mode:paymentMode,created_at:new Date().toISOString()}));
  const stockRows=purchaseInvoiceItems.map(item=>({medicine_name:item.medicine_name,category:item.category,batch_no:item.batch_no,expiry_date:item.expiry_date,purchase_price:item.purchase_price,mrp:item.mrp,sale_price:item.sale_price,quantity:item.quantity,created_at:new Date().toISOString()}));
  const msg=document.getElementById("purchaseMessage");
  const {error:pError}=await db.from("pharmacy_purchases").insert(rows);
  if(pError){msg.innerHTML=`<p class="error">Invoice save failed: ${pError.message}</p>`;return;}
  const {error:sError}=await db.from("pharmacy_stock").insert(stockRows);
  if(sError){msg.innerHTML=`<p class="error">Purchase saved, but stock add failed: ${sError.message}</p>`;await loadPurchases();return;}
  msg.innerHTML=`<p class="success">Invoice saved. ${rows.length} medicines added to stock.</p>`;
  purchaseInvoiceItems=[];
  document.getElementById("purchaseInvoice").value="";
  document.getElementById("purchaseDate").value=todayISO();
  renderPurchaseItems();
  await loadPurchaseSuggestions();
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
