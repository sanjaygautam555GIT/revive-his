let pharmacyStockEditRows=[];
let editingStockId=null;

const STOCK_ITEM_CONFIG={
  "Tablet":{buy:"Strip",sell:"Tablet",convert:true,inside:"Tablets per Strip",qty:"Strips Purchased"},
  "Capsule":{buy:"Strip",sell:"Capsule",convert:true,inside:"Capsules per Strip",qty:"Strips Purchased"},
  "Syrup":{buy:"Bottle",sell:"Bottle",convert:false,qty:"Bottles Purchased"},
  "Injection Vial":{buy:"Vial",sell:"Vial",convert:false,qty:"Vials Purchased"},
  "Injection Ampoule":{buy:"Ampoule",sell:"Ampoule",convert:false,qty:"Ampoules Purchased"},
  "IV Fluid":{buy:"Bottle",sell:"Bottle",convert:false,qty:"Bottles Purchased"},
  "Cream / Ointment":{buy:"Tube",sell:"Tube",convert:false,qty:"Tubes Purchased"},
  "Drops":{buy:"Bottle",sell:"Bottle",convert:false,qty:"Bottles Purchased"},
  "Suture":{buy:"Box",sell:"Piece",convert:true,inside:"Pieces per Box",qty:"Boxes Purchased"},
  "Catheter":{buy:"Box",sell:"Piece",convert:true,inside:"Pieces per Box",qty:"Boxes Purchased"},
  "Cannula":{buy:"Box",sell:"Piece",convert:true,inside:"Pieces per Box",qty:"Boxes Purchased"},
  "Gloves":{buy:"Box",sell:"Pair",convert:true,inside:"Pairs per Box",qty:"Boxes Purchased"},
  "Surgical Consumable":{buy:"Box",sell:"Piece",convert:true,inside:"Pieces per Box",qty:"Boxes Purchased"},
  "Other":{buy:"Piece",sell:"Piece",convert:false,qty:"Quantity Purchased"}
};

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
      <p>Edit using the same purchase and pack details used in Purchase Register.</p>
      <div class="grid" style="grid-template-columns:repeat(4,1fr)">
        <div><label>Item Type</label><select id="editStockCategory">${Object.keys(STOCK_ITEM_CONFIG).map(x=>`<option>${x}</option>`).join("")}</select></div>
        <div><label>Item Name</label><input id="editStockName"></div>
        <div><label>Batch / Lot No</label><input id="editStockBatch"></div>
        <div><label>Expiry Date</label><input id="editStockExpiry" type="date"></div>
        <div id="editConversionWrap"><label id="editConversionLabel">Tablets per Strip</label><input id="editStockUnitsPerPack" type="number" min="1" step="1" value="1"></div>
        <div><label id="editPurchaseQtyLabel">Strips Purchased</label><input id="editStockPurchaseQty" type="number" min="0" step="0.01"></div>
        <div><label id="editStockQtyLabel">Total Tablets in Stock</label><input id="editStockQty" type="number" min="0" step="1"></div>
        <div><label id="editPurchaseRateLabel">Purchase Rate per Strip</label><input id="editStockPurchaseRate" type="number" min="0" step="0.01"></div>
        <div><label id="editMrpLabel">MRP per Strip</label><input id="editStockMrpPack" type="number" min="0" step="0.01"></div>
        <div><label id="editSaleLabel">Selling Price per Tablet</label><input id="editStockSalePrice" type="number" min="0" step="0.01"></div>
        <div><label>Purchase Cost per Sale Item</label><input id="editStockPurchasePrice" type="number" readonly></div>
        <div><label>MRP per Sale Item</label><input id="editStockMrp" type="number" readonly></div>
      </div>
      <p id="editStockHint"></p><br>
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
  document.getElementById("editStockCategory").onchange=applyStockEditType;
  ["editStockUnitsPerPack","editStockPurchaseQty","editStockPurchaseRate","editStockMrpPack"].forEach(id=>document.getElementById(id).oninput=calculateStockEdit);
  document.getElementById("editStockQty").oninput=syncPurchaseQtyFromStock;
  await loadSimpleStock();
}

function stockEditConfig(){return STOCK_ITEM_CONFIG[document.getElementById("editStockCategory").value]||STOCK_ITEM_CONFIG.Other;}
function stockPlural(x){return /s$/i.test(x)?x:`${x}s`;}
function applyStockEditType(){
  const c=stockEditConfig();
  document.getElementById("editConversionWrap").classList.toggle("hidden",!c.convert);
  if(!c.convert)document.getElementById("editStockUnitsPerPack").value=1;
  if(c.convert)document.getElementById("editConversionLabel").textContent=c.inside;
  document.getElementById("editPurchaseQtyLabel").textContent=c.qty;
  document.getElementById("editStockQtyLabel").textContent=`Total ${stockPlural(c.sell)} in Stock`;
  document.getElementById("editPurchaseRateLabel").textContent=`Purchase Rate per ${c.buy}`;
  document.getElementById("editMrpLabel").textContent=`MRP per ${c.buy}`;
  document.getElementById("editSaleLabel").textContent=`Selling Price per ${c.sell}`;
  calculateStockEdit();
}
function calculateStockEdit(){
  const c=stockEditConfig();
  const n=c.convert?Math.max(1,Number(document.getElementById("editStockUnitsPerPack").value||1)):1;
  const packs=Number(document.getElementById("editStockPurchaseQty").value||0);
  const ratePack=Number(document.getElementById("editStockPurchaseRate").value||0);
  const mrpPack=Number(document.getElementById("editStockMrpPack").value||0);
  const total=packs*n;
  document.getElementById("editStockQty").value=total;
  document.getElementById("editStockPurchasePrice").value=(ratePack/n).toFixed(2);
  document.getElementById("editStockMrp").value=(mrpPack/n).toFixed(2);
  document.getElementById("editStockHint").textContent=c.convert?`${packs} ${stockPlural(c.buy)} × ${n} ${stockPlural(c.sell)} = ${total} ${stockPlural(c.sell)} in stock.`:`${packs} ${stockPlural(c.buy)} in stock.`;
}
function syncPurchaseQtyFromStock(){
  const c=stockEditConfig();
  const n=c.convert?Math.max(1,Number(document.getElementById("editStockUnitsPerPack").value||1)):1;
  const total=Number(document.getElementById("editStockQty").value||0);
  document.getElementById("editStockPurchaseQty").value=(total/n).toFixed(c.convert?2:0);
  const packs=Number(document.getElementById("editStockPurchaseQty").value||0);
  document.getElementById("editStockHint").textContent=c.convert?`${total} ${stockPlural(c.sell)} = ${packs} ${stockPlural(c.buy)} at ${n} per ${c.buy}.`:`${total} ${stockPlural(c.buy)} in stock.`;
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
  body.innerHTML=pharmacyStockEditRows.length?pharmacyStockEditRows.map(r=>`<tr><td>${r.category||"Other"}</td><td>${r.medicine_name||""}</td><td>${r.batch_no||""}</td><td>${r.expiry_date||""}</td><td>${r.quantity||0}</td><td>${money(r.purchase_price||0)}</td><td>${money(r.mrp||0)}</td><td>${money(r.sale_price||0)}</td><td>${currentUser?.role==="pharmacyOwner"?`<button type="button" class="secondary" onclick="editStockRow('${r.id}')">Edit</button>`:"View only"}</td></tr>`).join(""):"<tr><td colspan='9'>No stock found.</td></tr>";
}

function editStockRow(id){
  if(currentUser?.role!=="pharmacyOwner"){alert("Only Pharmacy Owner can edit stock.");return;}
  const row=pharmacyStockEditRows.find(r=>String(r.id)===String(id));
  if(!row){alert("Stock row not found.");return;}
  editingStockId=row.id;
  const category=STOCK_ITEM_CONFIG[row.category]?row.category:"Other";
  const c=STOCK_ITEM_CONFIG[category];
  const n=Math.max(1,Number(row.units_per_pack||1));
  document.getElementById("editStockCategory").value=category;
  document.getElementById("editStockName").value=row.medicine_name||"";
  document.getElementById("editStockBatch").value=row.batch_no||"";
  document.getElementById("editStockExpiry").value=row.expiry_date||"";
  document.getElementById("editStockUnitsPerPack").value=c.convert?n:1;
  document.getElementById("editStockPurchaseQty").value=(Number(row.quantity||0)/(c.convert?n:1)).toFixed(c.convert?2:0);
  document.getElementById("editStockQty").value=Number(row.quantity||0);
  document.getElementById("editStockPurchaseRate").value=(Number(row.purchase_price||0)*(c.convert?n:1)).toFixed(2);
  document.getElementById("editStockMrpPack").value=(Number(row.mrp||0)*(c.convert?n:1)).toFixed(2);
  document.getElementById("editStockPurchasePrice").value=Number(row.purchase_price||0).toFixed(2);
  document.getElementById("editStockMrp").value=Number(row.mrp||0).toFixed(2);
  document.getElementById("editStockSalePrice").value=Number(row.sale_price||0);
  document.getElementById("stockEditMessage").innerHTML="";
  applyStockEditType();
  document.getElementById("stockEditPanel").classList.remove("hidden");
  document.getElementById("stockEditPanel").scrollIntoView({behavior:"smooth",block:"start"});
}

function cancelStockEdit(){editingStockId=null;document.getElementById("stockEditPanel").classList.add("hidden");document.getElementById("stockEditMessage").innerHTML="";}

async function findMatchingPurchaseForStock(stockRow){
  const {data,error}=await db.from("pharmacy_purchases").select("*").order("created_at",{ascending:false});
  if(error)return {row:null,error};
  const oldName=String(stockRow.medicine_name||"").trim().toLowerCase();
  const oldBatch=String(stockRow.batch_no||"").trim().toLowerCase();
  return {row:(data||[]).find(r=>String(r.medicine_name||"").trim().toLowerCase()===oldName&&String(r.batch_no||"").trim().toLowerCase()===oldBatch)||null,error:null};
}

async function saveStockEdit(){
  const msg=document.getElementById("stockEditMessage");
  if(currentUser?.role!=="pharmacyOwner"){msg.innerHTML="<p class='error'>Only Pharmacy Owner can edit stock.</p>";return;}
  const original=pharmacyStockEditRows.find(r=>String(r.id)===String(editingStockId));
  if(!original){msg.innerHTML="<p class='error'>Original stock row was not found.</p>";return;}
  const name=document.getElementById("editStockName").value.trim();
  const c=stockEditConfig();
  const n=c.convert?Math.max(1,Number(document.getElementById("editStockUnitsPerPack").value||1)):1;
  const purchaseQty=Number(document.getElementById("editStockPurchaseQty").value||0);
  const totalQty=Number(document.getElementById("editStockQty").value||0);
  const purchaseRate=Number(document.getElementById("editStockPurchaseRate").value||0);
  const mrpPack=Number(document.getElementById("editStockMrpPack").value||0);
  if(!name){msg.innerHTML="<p class='error'>Item name is required.</p>";return;}
  if(purchaseQty<0||totalQty<0){msg.innerHTML="<p class='error'>Quantity cannot be negative.</p>";return;}
  const payload={category:document.getElementById("editStockCategory").value,medicine_name:name,batch_no:document.getElementById("editStockBatch").value.trim()||null,expiry_date:document.getElementById("editStockExpiry").value||null,quantity:totalQty,units_per_pack:n,purchase_price:purchaseRate/n,mrp:mrpPack/n,sale_price:Number(document.getElementById("editStockSalePrice").value||0)};
  const purchaseMatch=await findMatchingPurchaseForStock(original);
  if(purchaseMatch.error){msg.innerHTML=`<p class='error'>Could not check Purchase Register: ${purchaseMatch.error.message}</p>`;return;}
  const {data,error}=await db.from("pharmacy_stock").update(payload).eq("id",editingStockId).select();
  if(error){msg.innerHTML=`<p class='error'>Stock update failed: ${error.message}</p>`;return;}
  if(!data||!data.length){msg.innerHTML="<p class='error'>Stock was not updated. Supabase update permission may be missing.</p>";return;}
  let sync="";
  if(purchaseMatch.row){
    const purchasePayload={category:payload.category,medicine_name:payload.medicine_name,batch_no:payload.batch_no,expiry_date:payload.expiry_date,quantity:purchaseQty,units_per_pack:n,purchase_price:purchaseRate,mrp:mrpPack,sale_price:payload.sale_price,total_amount:purchaseQty*purchaseRate};
    const {data:pData,error:pError}=await db.from("pharmacy_purchases").update(purchasePayload).eq("id",purchaseMatch.row.id).select();
    sync=pError?`<br><span class='error'>Purchase Register sync failed: ${pError.message}</span>`:(!pData||!pData.length?"<br><span class='error'>Purchase Register update permission is missing.</span>":"<br>Matching Purchase Register entry updated.");
  }else sync="<br>No matching Purchase Register entry was found for the original item name and batch.";
  msg.innerHTML=`<p class='success'>Stock updated successfully.${sync}</p>`;
  await loadSimpleStock();
  setTimeout(cancelStockEdit,1400);
}