let pharmacyStockEditRows=[];
let editingStockId=null;

async function renderPharmacyStock(){
  const el=document.getElementById("pharmacyStockView");
  el.innerHTML=`
    <div class="panel">
      <h2>Inventory & Pharmacy Stock</h2>
      <p>Current stock of medicines, surgical items, OT consumables, ward items and lab consumables.</p>
      <div id="stockStatus" class="sync-box">Connecting...</div>
      <div class="grid cards">
        <div class="card"><span>Total Stock Rows</span><strong id="stockCount">0</strong></div>
        <div class="card"><span>Low Stock</span><strong id="lowStockCount">0</strong></div>
      </div>
    </div>

    <div id="stockEditPanel" class="panel hidden">
      <h3>Edit Stock</h3>
      <div class="grid" style="grid-template-columns:repeat(4,1fr)">
        <div><label>Item Type</label><input id="editStockCategory"></div>
        <div><label>Item Name</label><input id="editStockName"></div>
        <div><label>Batch / Lot No</label><input id="editStockBatch"></div>
        <div><label>Expiry Date</label><input id="editStockExpiry" type="date"></div>
        <div><label>Available Quantity</label><input id="editStockQty" type="number" min="0" step="1"></div>
        <div><label>Purchase Cost per Sale Item</label><input id="editStockPurchasePrice" type="number" min="0" step="0.01"></div>
        <div><label>MRP per Sale Item</label><input id="editStockMrp" type="number" min="0" step="0.01"></div>
        <div><label>Selling Price per Sale Item</label><input id="editStockSalePrice" type="number" min="0" step="0.01"></div>
      </div><br>
      <button type="button" id="saveStockEditBtn">Update Stock</button>
      <button type="button" id="cancelStockEditBtn" class="secondary">Cancel</button>
      <div id="stockEditMessage"></div>
    </div>

    <div class="panel table-wrap">
      <table>
        <thead><tr><th>Type</th><th>Item</th><th>Batch/Lot</th><th>Expiry</th><th>Qty</th><th>Purchase Cost</th><th>MRP</th><th>Sale / Issue Price</th><th>Action</th></tr></thead>
        <tbody id="stockRows"></tbody>
      </table>
    </div>`;

  document.getElementById("saveStockEditBtn").onclick=saveStockEdit;
  document.getElementById("cancelStockEditBtn").onclick=cancelStockEdit;
  await loadSimpleStock();
}

async function loadSimpleStock(){
  const body=document.getElementById("stockRows");
  const status=document.getElementById("stockStatus");
  const {data,error}=await db.from("pharmacy_stock").select("*").order("created_at",{ascending:false});
  if(error){status.textContent="Stock load failed: "+error.message;body.innerHTML="";return;}
  pharmacyStockEditRows=data||[];
  document.getElementById("stockCount").textContent=pharmacyStockEditRows.length;
  document.getElementById("lowStockCount").textContent=pharmacyStockEditRows.filter(r=>Number(r.quantity||0)<=10).length;
  status.textContent="Inventory loaded from Supabase: "+pharmacyStockEditRows.length+" records";
  body.innerHTML=pharmacyStockEditRows.length?pharmacyStockEditRows.map(r=>`<tr>
    <td>${r.category||"Medicine"}</td>
    <td>${r.medicine_name||""}</td>
    <td>${r.batch_no||""}</td>
    <td>${r.expiry_date||""}</td>
    <td>${r.quantity||0}</td>
    <td>${money(r.purchase_price||0)}</td>
    <td>${money(r.mrp||0)}</td>
    <td>${money(r.sale_price||0)}</td>
    <td>${currentUser?.role==="pharmacyOwner"?`<button type="button" class="secondary" onclick="editStockRow('${r.id}')">Edit</button>`:"View only"}</td>
  </tr>`).join(""):"<tr><td colspan='9'>No stock found.</td></tr>";
}

function editStockRow(id){
  if(currentUser?.role!=="pharmacyOwner"){alert("Only Pharmacy Owner can edit stock.");return;}
  const row=pharmacyStockEditRows.find(r=>String(r.id)===String(id));
  if(!row){alert("Stock row not found.");return;}
  editingStockId=row.id;
  document.getElementById("editStockCategory").value=row.category||"Medicine";
  document.getElementById("editStockName").value=row.medicine_name||"";
  document.getElementById("editStockBatch").value=row.batch_no||"";
  document.getElementById("editStockExpiry").value=row.expiry_date||"";
  document.getElementById("editStockQty").value=Number(row.quantity||0);
  document.getElementById("editStockPurchasePrice").value=Number(row.purchase_price||0);
  document.getElementById("editStockMrp").value=Number(row.mrp||0);
  document.getElementById("editStockSalePrice").value=Number(row.sale_price||0);
  document.getElementById("stockEditMessage").innerHTML="";
  document.getElementById("stockEditPanel").classList.remove("hidden");
  document.getElementById("stockEditPanel").scrollIntoView({behavior:"smooth",block:"start"});
}

function cancelStockEdit(){
  editingStockId=null;
  document.getElementById("stockEditPanel").classList.add("hidden");
  document.getElementById("stockEditMessage").innerHTML="";
}

async function findMatchingPurchaseForStock(stockRow){
  const {data,error}=await db.from("pharmacy_purchases").select("*").order("created_at",{ascending:false});
  if(error)return {row:null,error};
  const oldName=String(stockRow.medicine_name||"").trim().toLowerCase();
  const oldBatch=String(stockRow.batch_no||"").trim().toLowerCase();
  const match=(data||[]).find(r=>{
    const sameName=String(r.medicine_name||"").trim().toLowerCase()===oldName;
    const sameBatch=String(r.batch_no||"").trim().toLowerCase()===oldBatch;
    return sameName&&sameBatch;
  });
  return {row:match||null,error:null};
}

async function saveStockEdit(){
  const msg=document.getElementById("stockEditMessage");
  if(currentUser?.role!=="pharmacyOwner"){msg.innerHTML="<p class='error'>Only Pharmacy Owner can edit stock.</p>";return;}
  if(editingStockId===null){msg.innerHTML="<p class='error'>Select a stock row first.</p>";return;}

  const original=pharmacyStockEditRows.find(r=>String(r.id)===String(editingStockId));
  if(!original){msg.innerHTML="<p class='error'>Original stock row was not found.</p>";return;}

  const name=document.getElementById("editStockName").value.trim();
  const qty=Number(document.getElementById("editStockQty").value||0);
  if(!name){msg.innerHTML="<p class='error'>Item name is required.</p>";return;}
  if(qty<0){msg.innerHTML="<p class='error'>Quantity cannot be negative.</p>";return;}

  const payload={
    category:document.getElementById("editStockCategory").value.trim()||"Medicine",
    medicine_name:name,
    batch_no:document.getElementById("editStockBatch").value.trim()||null,
    expiry_date:document.getElementById("editStockExpiry").value||null,
    quantity:qty,
    purchase_price:Number(document.getElementById("editStockPurchasePrice").value||0),
    mrp:Number(document.getElementById("editStockMrp").value||0),
    sale_price:Number(document.getElementById("editStockSalePrice").value||0)
  };

  const purchaseMatch=await findMatchingPurchaseForStock(original);
  if(purchaseMatch.error){msg.innerHTML=`<p class='error'>Could not check purchase register: ${purchaseMatch.error.message}</p>`;return;}

  const {data,error}=await db.from("pharmacy_stock").update(payload).eq("id",editingStockId).select();
  if(error){msg.innerHTML=`<p class='error'>Stock update failed: ${error.message}</p>`;return;}
  if(!data||!data.length){msg.innerHTML="<p class='error'>Stock was not updated. Supabase update permission may be missing.</p>";return;}

  let purchaseMessage="";
  if(purchaseMatch.row){
    const unitsPerPack=Math.max(1,Number(purchaseMatch.row.units_per_pack||original.units_per_pack||1));
    const purchaseQty=qty/unitsPerPack;
    const purchaseRate=payload.purchase_price*unitsPerPack;
    const purchaseMrp=payload.mrp*unitsPerPack;
    const purchasePayload={
      category:payload.category,
      medicine_name:payload.medicine_name,
      batch_no:payload.batch_no,
      expiry_date:payload.expiry_date,
      quantity:purchaseQty,
      purchase_price:purchaseRate,
      mrp:purchaseMrp,
      sale_price:payload.sale_price,
      total_amount:purchaseQty*purchaseRate
    };
    const {data:pData,error:pError}=await db.from("pharmacy_purchases").update(purchasePayload).eq("id",purchaseMatch.row.id).select();
    if(pError){
      purchaseMessage=`<br><span class='error'>Purchase Register sync failed: ${pError.message}</span>`;
    }else if(!pData||!pData.length){
      purchaseMessage="<br><span class='error'>Stock updated, but Purchase Register update permission is missing.</span>";
    }else{
      purchaseMessage="<br>Matching Purchase Register entry updated.";
    }
  }else{
    purchaseMessage="<br>No matching purchase entry was found for the original item name and batch.";
  }

  msg.innerHTML=`<p class='success'>Stock updated successfully.${purchaseMessage}</p>`;
  await loadSimpleStock();
  setTimeout(cancelStockEdit,1200);
}