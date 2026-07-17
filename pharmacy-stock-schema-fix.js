// Compatibility patch for databases without units_per_pack columns.
// Conversion remains in the form calculation but is not written to Supabase.

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

  if(!name){
    msg.innerHTML="<p class='error'>Item name is required.</p>";
    return;
  }
  if(purchaseQty<0||totalQty<0){
    msg.innerHTML="<p class='error'>Quantity cannot be negative.</p>";
    return;
  }

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
  if(purchaseMatch.error){
    msg.innerHTML=`<p class='error'>Could not check Purchase Register: ${purchaseMatch.error.message}</p>`;
    return;
  }

  const {data,error}=await db.from("pharmacy_stock").update(payload).eq("id",editingStockId).select();
  if(error){
    msg.innerHTML=`<p class='error'>Stock update failed: ${error.message}</p>`;
    return;
  }
  if(!data||!data.length){
    msg.innerHTML="<p class='error'>Stock was not updated. Supabase update permission may be missing.</p>";
    return;
  }

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

    const {data:pData,error:pError}=await db.from("pharmacy_purchases")
      .update(purchasePayload)
      .eq("id",purchaseMatch.row.id)
      .select();

    if(pError){
      syncMessage=`<br><span class='error'>Purchase Register sync failed: ${pError.message}</span>`;
    }else if(!pData||!pData.length){
      syncMessage="<br><span class='error'>Stock updated, but Purchase Register update permission is missing.</span>";
    }else{
      syncMessage="<br>Matching Purchase Register entry updated.";
    }
  }else{
    syncMessage="<br>No matching purchase entry was found for the original item name and batch.";
  }

  msg.innerHTML=`<p class='success'>Stock updated successfully.${syncMessage}</p>`;
  await loadSimpleStock();
  setTimeout(cancelStockEdit,1200);
}
