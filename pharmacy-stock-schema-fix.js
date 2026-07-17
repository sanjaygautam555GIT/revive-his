// Compatibility patch for databases without units_per_pack columns.
// Conversion remains in the form calculation but is not written to Supabase.

function stockMatchKey(name,batch){
  return `${String(name||"").trim().toLowerCase()}||${String(batch||"").trim().toLowerCase()}`;
}

async function loadSimpleStock(){
  const body=document.getElementById("stockRows");
  const status=document.getElementById("stockStatus");
  const [stockRes,purchaseRes]=await Promise.all([
    db.from("pharmacy_stock").select("*").order("created_at",{ascending:false}),
    db.from("pharmacy_purchases").select("*").order("created_at",{ascending:false})
  ]);
  if(stockRes.error){status.textContent="Stock load failed: "+stockRes.error.message;body.innerHTML="";return;}

  const purchases=purchaseRes.data||[];
  const purchaseMap=new Map();
  purchases.forEach(r=>{
    const key=stockMatchKey(r.medicine_name,r.batch_no);
    if(!purchaseMap.has(key))purchaseMap.set(key,r);
  });

  pharmacyStockEditRows=(stockRes.data||[]).map(r=>({
    ...r,
    _purchase:purchaseMap.get(stockMatchKey(r.medicine_name,r.batch_no))||null
  }));

  document.getElementById("stockCount").textContent=pharmacyStockEditRows.length;
  document.getElementById("lowStockCount").textContent=pharmacyStockEditRows.filter(r=>Number(r.quantity||0)<=10).length;
  status.textContent="Inventory loaded from Supabase: "+pharmacyStockEditRows.length+" records";

  const table=body.closest("table");
  const head=table?.querySelector("thead");
  if(head){
    head.innerHTML=`<tr><th>Type</th><th>Item</th><th>Batch/Lot</th><th>Expiry</th><th>Purchased Qty</th><th>Pack</th><th>Stock Qty</th><th>Purchase Rate/Pack</th><th>MRP/Pack</th><th>Cost/Sale Item</th><th>MRP/Sale Item</th><th>Selling Price</th><th>Action</th></tr>`;
  }

  body.innerHTML=pharmacyStockEditRows.length?pharmacyStockEditRows.map(r=>{
    const p=r._purchase;
    const cfg=STOCK_ITEM_CONFIG[r.category]||STOCK_ITEM_CONFIG.Other;
    const purchaseQty=p?Number(p.quantity||0):null;
    const unitsPerPack=(p&&purchaseQty>0)?Number(r.quantity||0)/purchaseQty:1;
    return `<tr>
      <td>${r.category||"Other"}</td>
      <td>${r.medicine_name||""}</td>
      <td>${r.batch_no||""}</td>
      <td>${r.expiry_date||""}</td>
      <td>${p?purchaseQty:"—"}</td>
      <td>${p?(p.unit||cfg.buy)+(unitsPerPack>1?` × ${unitsPerPack}`:""):cfg.buy}</td>
      <td>${r.quantity||0} ${stockPlural(cfg.sell)}</td>
      <td>${p?money(p.purchase_price||0):"—"}</td>
      <td>${p?money(p.mrp||0):"—"}</td>
      <td>${money(r.purchase_price||0)}</td>
      <td>${money(r.mrp||0)}</td>
      <td>${money(r.sale_price||0)}</td>
      <td>${currentUser?.role==="pharmacyOwner"?`<button type="button" class="secondary" onclick="editStockRow('${r.id}')">Edit</button>`:"View only"}</td>
    </tr>`;
  }).join(""):"<tr><td colspan='13'>No stock found.</td></tr>";
}

function editStockRow(id){
  if(currentUser?.role!=="pharmacyOwner"){alert("Only Pharmacy Owner can edit stock.");return;}
  const row=pharmacyStockEditRows.find(r=>String(r.id)===String(id));
  if(!row){alert("Stock row not found.");return;}
  editingStockId=row.id;
  const category=STOCK_ITEM_CONFIG[row.category]?row.category:"Other";
  const c=STOCK_ITEM_CONFIG[category];
  const p=row._purchase||null;
  const purchaseQty=p?Number(p.quantity||0):Number(row.quantity||0);
  const inferredN=(p&&purchaseQty>0)?Math.max(1,Number(row.quantity||0)/purchaseQty):1;
  const n=c.convert?inferredN:1;

  document.getElementById("editStockCategory").value=category;
  document.getElementById("editStockName").value=row.medicine_name||"";
  document.getElementById("editStockBatch").value=row.batch_no||"";
  document.getElementById("editStockExpiry").value=row.expiry_date||"";
  document.getElementById("editStockUnitsPerPack").value=n;
  document.getElementById("editStockPurchaseQty").value=p?purchaseQty:(Number(row.quantity||0)/n);
  document.getElementById("editStockQty").value=Number(row.quantity||0);
  document.getElementById("editStockPurchaseRate").value=p?Number(p.purchase_price||0):(Number(row.purchase_price||0)*n);
  document.getElementById("editStockMrpPack").value=p?Number(p.mrp||0):(Number(row.mrp||0)*n);
  document.getElementById("editStockPurchasePrice").value=Number(row.purchase_price||0).toFixed(2);
  document.getElementById("editStockMrp").value=Number(row.mrp||0).toFixed(2);
  document.getElementById("editStockSalePrice").value=Number(row.sale_price||0);
  document.getElementById("stockEditMessage").innerHTML="";
  applyStockEditType();
  document.getElementById("stockEditPanel").classList.remove("hidden");
  document.getElementById("stockEditPanel").scrollIntoView({behavior:"smooth",block:"start"});
}

async function saveStockEdit(){
  const msg=document.getElementById("stockEditMessage");
  if(currentUser?.role!=="pharmacyOwner"){
    msg.innerHTML="<p class='error'>Only Pharmacy Owner can edit stock.</p>";
    return;
  }

  const original=pharmacyStockEditRows.find(r=>String(r.id)===String(editingStockId));
  if(!original){
    msg.innerHTML="<p class='error'>Original stock row was not found.</p>";
    return;
  }

  const name=document.getElementById("editStockName").value.trim();
  const c=stockEditConfig();
  const n=c.convert?Math.max(1,Number(document.getElementById("editStockUnitsPerPack").value||1)):1;
  const purchaseQty=Number(document.getElementById("editStockPurchaseQty").value||0);
  const totalQty=Number(document.getElementById("editStockQty").value||0);
  const purchaseRate=Number(document.getElementById("editStockPurchaseRate").value||0);
  const mrpPack=Number(document.getElementById("editStockMrpPack").value||0);
  const salePrice=Number(document.getElementById("editStockSalePrice").value||0);

  if(!name){msg.innerHTML="<p class='error'>Item name is required.</p>";return;}
  if(purchaseQty<0||totalQty<0){msg.innerHTML="<p class='error'>Quantity cannot be negative.</p>";return;}

  const payload={
    category:document.getElementById("editStockCategory").value,
    medicine_name:name,
    batch_no:document.getElementById("editStockBatch").value.trim()||null,
    expiry_date:document.getElementById("editStockExpiry").value||null,
    quantity:totalQty,
    purchase_price:purchaseRate/n,
    mrp:mrpPack/n,
    sale_price:salePrice
  };

  const purchaseMatch=await findMatchingPurchaseForStock(original);
  if(purchaseMatch.error){msg.innerHTML=`<p class='error'>Could not check Purchase Register: ${purchaseMatch.error.message}</p>`;return;}

  const {data,error}=await db.from("pharmacy_stock").update(payload).eq("id",editingStockId).select();
  if(error){msg.innerHTML=`<p class='error'>Stock update failed: ${error.message}</p>`;return;}
  if(!data||!data.length){msg.innerHTML="<p class='error'>Stock was not updated. Supabase update permission may be missing.</p>";return;}

  let syncMessage="";
  if(purchaseMatch.row){
    const purchasePayload={
      category:payload.category,
      medicine_name:payload.medicine_name,
      batch_no:payload.batch_no,
      expiry_date:payload.expiry_date,
      quantity:purchaseQty,
      purchase_price:purchaseRate,
      mrp:mrpPack,
      sale_price:salePrice,
      total_amount:purchaseQty*purchaseRate
    };
    const {data:pData,error:pError}=await db.from("pharmacy_purchases").update(purchasePayload).eq("id",purchaseMatch.row.id).select();
    if(pError)syncMessage=`<br><span class='error'>Purchase Register sync failed: ${pError.message}</span>`;
    else if(!pData||!pData.length)syncMessage="<br><span class='error'>Stock updated, but Purchase Register update permission is missing.</span>";
    else syncMessage="<br>Matching Purchase Register entry updated.";
  }else{
    syncMessage="<br>No matching purchase entry was found for the original item name and batch.";
  }

  msg.innerHTML=`<p class='success'>Stock updated successfully.${syncMessage}</p>`;
  await loadSimpleStock();
  setTimeout(cancelStockEdit,1200);
}
