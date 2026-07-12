// Compatibility layer for databases that do not yet contain pharmacy purchase/stock unit columns.
// The UI still uses item type configuration for Strip/Box/Bottle and dispensing calculations.

async function loadPurchaseSuggestions(){
  const [supplierRes,purchaseRes,stockRes]=await Promise.all([
    db.from("suppliers").select("*").order("supplier_name"),
    db.from("pharmacy_purchases").select("supplier,medicine_name,category,units_per_pack,purchase_price,sale_price,mrp").order("created_at",{ascending:false}).limit(1000),
    db.from("pharmacy_stock").select("medicine_name,category,units_per_pack,purchase_price,sale_price,mrp").order("medicine_name").limit(1000)
  ]);

  purchaseSuppliers=supplierRes.data||[];
  const supplierSelect=document.getElementById("purchaseSupplier");
  if(supplierSelect){
    supplierSelect.innerHTML=purchaseSuppliers.length
      ? `<option value="">Select supplier</option>`+purchaseSuppliers.map(x=>`<option value="${x.supplier_name}">${x.supplier_name}</option>`).join("")
      : `<option value="">No suppliers saved</option>`;
  }

  const map=new Map();
  [...(purchaseRes.data||[]),...(stockRes.data||[])].forEach(row=>{
    if(row.medicine_name&&!map.has(row.medicine_name.toLowerCase()))map.set(row.medicine_name.toLowerCase(),row);
  });
  previousPurchaseMedicines=[...map.values()];
  const list=document.getElementById("medicineSuggestions");
  if(list)list.innerHTML=previousPurchaseMedicines.map(x=>`<option value="${x.medicine_name}"></option>`).join("");
}

async function saveCompletePurchaseInvoice(){
  if(currentUser.role!=="pharmacyOwner"&&currentUser.role!=="accountant"){
    alert("Only Pharmacy Owner or Accountant can enter purchases.");
    return;
  }

  const supplier=document.getElementById("purchaseSupplier").value;
  const invoiceNo=document.getElementById("purchaseInvoice").value.trim();
  const invoiceDate=document.getElementById("purchaseDate").value;
  if(!supplier||!invoiceNo||!invoiceDate||!purchaseInvoiceItems.length){
    alert("Select supplier, enter invoice details and add at least one item.");
    return;
  }

  const status=document.getElementById("purchasePaymentStatus").value;
  const mode=document.getElementById("purchasePaymentMode").value;
  const now=new Date().toISOString();

  const purchaseRows=purchaseInvoiceItems.map(item=>({
    medicine_name:item.medicine_name,
    category:item.category,
    units_per_pack:item.units_per_pack,
    batch_no:item.batch_no,
    expiry_date:item.expiry_date,
    quantity:item.quantity,
    purchase_price:item.purchase_price,
    mrp:item.mrp,
    sale_price:item.sale_price,
    total_amount:item.total_amount,
    supplier,
    invoice_no:invoiceNo,
    invoice_date:invoiceDate,
    payment_status:status,
    payment_mode:mode,
    created_at:now
  }));

  const stockRows=purchaseInvoiceItems.map(item=>({
    medicine_name:item.medicine_name,
    category:item.category,
    units_per_pack:item.units_per_pack,
    batch_no:item.batch_no,
    expiry_date:item.expiry_date,
    purchase_price:Number(item.purchase_price||0)/Math.max(1,Number(item.units_per_pack||1)),
    mrp:Number(item.mrp||0)/Math.max(1,Number(item.units_per_pack||1)),
    sale_price:item.sale_price,
    quantity:item.total_units,
    created_at:now
  }));

  const msg=document.getElementById("purchaseMessage");
  const {error:purchaseError}=await db.from("pharmacy_purchases").insert(purchaseRows);
  if(purchaseError){
    msg.innerHTML=`<p class='error'>Invoice save failed: ${purchaseError.message}</p>`;
    return;
  }

  const {error:stockError}=await db.from("pharmacy_stock").insert(stockRows);
  if(stockError){
    msg.innerHTML=`<p class='error'>Purchase saved, but stock add failed: ${stockError.message}</p>`;
    return;
  }

  msg.innerHTML="<p class='success'>Invoice saved and stock added.</p>";
  purchaseInvoiceItems=[];
  document.getElementById("purchaseInvoice").value="";
  renderPurchaseItems();
  await loadPurchaseSuggestions();
  await loadPurchases();
}

async function loadPurchases(){
  const body=document.getElementById("purchaseRows");
  const {data,error}=await db.from("pharmacy_purchases").select("*").order("created_at",{ascending:false});
  if(error){body.innerHTML=`<tr><td colspan='9' class='error'>${error.message}</td></tr>`;return;}
  const rows=data||[];
  document.getElementById("purchaseCount").textContent=rows.length;
  document.getElementById("purchaseValue").textContent=money(rows.reduce((sum,row)=>sum+Number(row.total_amount||0),0));
  document.getElementById("purchaseDue").textContent=money(rows.filter(row=>String(row.payment_status||"").toLowerCase()!=="paid").reduce((sum,row)=>sum+Number(row.total_amount||0),0));
  body.innerHTML=rows.length?rows.slice(0,50).map(row=>{
    const config=ITEM_CONFIG[row.category]||ITEM_CONFIG.Other;
    return `<tr><td>${row.invoice_date||rowDate(row)}</td><td>${row.supplier||""}</td><td>${row.invoice_no||""}</td><td>${row.category||""}</td><td>${row.medicine_name||""}</td><td>${config.buy}</td><td>${row.quantity||0}</td><td>${money(row.total_amount||0)}</td><td>${row.payment_status||""}</td></tr>`;
  }).join(""):"<tr><td colspan='9'>No purchase records.</td></tr>";
}
