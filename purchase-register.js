let purchaseInvoiceItems=[];
let previousPurchaseMedicines=[];
let purchaseSuppliers=[];

const ITEM_CONFIG={
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
const INVENTORY_TYPES=Object.keys(ITEM_CONFIG);

async function renderPurchaseRegister(){
  const el=document.getElementById("purchaseRegisterView");
  el.innerHTML=`
    <div class="panel"><h2>Pharmacy Purchase Register</h2><p>Select item type; the app will automatically decide whether stock is counted as tablets, pieces, bottles, vials or ampoules.</p>
      <div class="grid" style="grid-template-columns:1.4fr auto 1fr 1fr 1fr">
        <div><label>Supplier Name</label><select id="purchaseSupplier"><option value="">Loading suppliers...</option></select></div>
        <div><label>&nbsp;</label><button type="button" class="secondary" id="quickAddSupplierBtn">+ Supplier</button></div>
        <div><label>Invoice No</label><input id="purchaseInvoice"></div>
        <div><label>Invoice Date</label><input id="purchaseDate" type="date" value="${todayISO()}"></div>
        <div><label>Payment Status</label><select id="purchasePaymentStatus"><option>Paid</option><option>Due</option><option>Partial</option></select></div>
        <div><label>Payment Mode</label><select id="purchasePaymentMode"><option>Cash</option><option>UPI</option><option>Bank</option><option>Credit</option></select></div>
      </div>
      <div id="quickSupplierBox" class="hidden" style="margin-top:12px"><h3>Add Supplier</h3><div class="grid" style="grid-template-columns:repeat(4,1fr)">
        <div><label>Supplier Name</label><input id="newSupplierName"></div><div><label>Contact Person</label><input id="newSupplierContact"></div><div><label>Mobile</label><input id="newSupplierMobile"></div><div><label>Payment Terms</label><input id="newSupplierTerms"></div>
      </div><br><button type="button" id="saveQuickSupplierBtn">Save Supplier</button> <button type="button" class="secondary" id="cancelQuickSupplierBtn">Cancel</button></div>
    </div>

    <div class="panel"><h3>Add Inventory Item</h3>
      <div class="grid" style="grid-template-columns:repeat(4,1fr)">
        <div><label>Item Type</label><select id="purchaseCategory">${INVENTORY_TYPES.map(x=>`<option>${x}</option>`).join("")}</select></div>
        <div><label>Item Name</label><input id="purchaseMedicine" list="medicineSuggestions"><datalist id="medicineSuggestions"></datalist></div>
        <div><label>Batch / Lot No</label><input id="purchaseBatch"></div>
        <div><label>Expiry Date</label><input id="purchaseExpiry" type="date"></div>
        <div id="conversionWrap"><label id="conversionLabel">Tablets per Strip</label><input id="purchaseUnitsPerPack" type="number" min="1" value="10"></div>
        <div><label id="qtyLabel">Strips Purchased</label><input id="purchaseQty" type="number" min="1" value="0"></div>
        <div><label id="stockLabel">Total Tablets Added to Stock</label><input id="purchaseTotalUnits" readonly value="0"></div>
        <div><label id="rateLabel">Purchase Rate per Strip</label><input id="purchasePrice" type="number" value="0" step="0.01"></div>
        <div><label id="mrpLabel">MRP per Strip</label><input id="purchaseMrp" type="number" value="0" step="0.01"></div>
        <div><label id="saleLabel">Selling Price per Tablet</label><input id="purchaseSalePrice" type="number" value="0" step="0.01"></div>
        <div><label>Line Total</label><input id="purchaseLineTotal" readonly value="0"></div>
      </div>
      <p id="purchaseUnitHint"></p><button id="addPurchaseItemBtn" type="button">Add Item to Invoice</button><div id="purchaseMessage"></div>
    </div>

    <div class="panel table-wrap"><h3>Current Invoice</h3><table><thead><tr><th>Type</th><th>Item</th><th>Purchased</th><th>Qty</th><th>Stock Added</th><th>Batch</th><th>Rate</th><th>MRP</th><th>Selling Price</th><th>Total</th><th>Action</th></tr></thead><tbody id="purchaseItemRows"></tbody></table><h3>Grand Total: <span id="purchaseGrandTotal">₹0</span></h3><button id="saveInvoiceBtn" type="button">Save Invoice & Add Stock</button> <button id="clearInvoiceBtn" type="button" class="secondary">Clear Invoice</button></div>
    <div class="grid cards" style="margin-top:16px"><div class="card"><span>Purchase Rows</span><strong id="purchaseCount">0</strong></div><div class="card"><span>Total Purchase Value</span><strong id="purchaseValue">₹0</strong></div><div class="card"><span>Due Purchase Value</span><strong id="purchaseDue">₹0</strong></div></div>
    <div class="panel table-wrap"><h3>Recent Purchase Items</h3><table><thead><tr><th>Date</th><th>Supplier</th><th>Invoice</th><th>Type</th><th>Item</th><th>Purchased</th><th>Qty</th><th>Total</th><th>Status</th></tr></thead><tbody id="purchaseRows"></tbody></table></div>`;

  purchaseInvoiceItems=[];
  await loadPurchaseSuggestions();
  document.getElementById("quickAddSupplierBtn").onclick=()=>document.getElementById("quickSupplierBox").classList.remove("hidden");
  document.getElementById("cancelQuickSupplierBtn").onclick=()=>document.getElementById("quickSupplierBox").classList.add("hidden");
  document.getElementById("saveQuickSupplierBtn").onclick=saveQuickSupplier;
  document.getElementById("purchaseMedicine").onchange=applyPreviousMedicineDetails;
  document.getElementById("purchaseCategory").onchange=applyItemTypeDefaults;
  ["purchaseUnitsPerPack","purchaseQty","purchasePrice"].forEach(id=>document.getElementById(id).oninput=updatePurchaseCalculations);
  document.getElementById("purchaseMrp").oninput=autoSalePrice;
  document.getElementById("addPurchaseItemBtn").onclick=addPurchaseInvoiceItem;
  document.getElementById("saveInvoiceBtn").onclick=saveCompletePurchaseInvoice;
  document.getElementById("clearInvoiceBtn").onclick=()=>{purchaseInvoiceItems=[];renderPurchaseItems();};
  applyItemTypeDefaults();renderPurchaseItems();await loadPurchases();
}

function currentConfig(){return ITEM_CONFIG[document.getElementById("purchaseCategory").value]||ITEM_CONFIG.Other;}
function plural(word){return /s$/i.test(word)?word:`${word}s`;}
function applyItemTypeDefaults(){
  const c=currentConfig();
  document.getElementById("conversionWrap").classList.toggle("hidden",!c.convert);
  document.getElementById("purchaseUnitsPerPack").value=c.convert?(document.getElementById("purchaseUnitsPerPack").value||1):1;
  if(c.convert)document.getElementById("conversionLabel").textContent=c.inside;
  document.getElementById("qtyLabel").textContent=c.qty;
  document.getElementById("stockLabel").textContent=`Total ${plural(c.sell)} Added to Stock`;
  document.getElementById("rateLabel").textContent=`Purchase Rate per ${c.buy}`;
  document.getElementById("mrpLabel").textContent=`MRP per ${c.buy}`;
  document.getElementById("saleLabel").textContent=`Selling Price per ${c.sell}`;
  autoSalePrice();
}
function autoSalePrice(){const c=currentConfig();const n=c.convert?Math.max(1,Number(document.getElementById("purchaseUnitsPerPack").value||1)):1;const mrp=Number(document.getElementById("purchaseMrp").value||0);document.getElementById("purchaseSalePrice").value=(mrp/n).toFixed(2);updatePurchaseCalculations();}
function updatePurchaseCalculations(){const c=currentConfig();const q=Number(document.getElementById("purchaseQty").value||0);const n=c.convert?Math.max(1,Number(document.getElementById("purchaseUnitsPerPack").value||1)):1;const rate=Number(document.getElementById("purchasePrice").value||0);const total=q*n;document.getElementById("purchaseTotalUnits").value=total;document.getElementById("purchaseLineTotal").value=(q*rate).toFixed(2);document.getElementById("purchaseUnitHint").textContent=c.convert?`${q} ${plural(c.buy)} × ${n} ${plural(c.sell)} = ${total} ${plural(c.sell)} added to stock.`:`${q} ${plural(c.buy)} added to stock.`;}

async function loadPurchaseSuggestions(){const [s,p,st]=await Promise.all([db.from("suppliers").select("*").order("supplier_name"),db.from("pharmacy_purchases").select("supplier,medicine_name,category,unit,units_per_pack,purchase_price,sale_price,mrp").order("created_at",{ascending:false}).limit(1000),db.from("pharmacy_stock").select("medicine_name,category,unit,units_per_pack,purchase_price,sale_price,mrp").order("medicine_name").limit(1000)]);purchaseSuppliers=s.data||[];document.getElementById("purchaseSupplier").innerHTML=purchaseSuppliers.length?`<option value="">Select supplier</option>`+purchaseSuppliers.map(x=>`<option value="${x.supplier_name}">${x.supplier_name}</option>`).join(""):`<option value="">No suppliers saved</option>`;const m=new Map();[...(p.data||[]),...(st.data||[])].forEach(r=>{if(r.medicine_name&&!m.has(r.medicine_name.toLowerCase()))m.set(r.medicine_name.toLowerCase(),r)});previousPurchaseMedicines=[...m.values()];document.getElementById("medicineSuggestions").innerHTML=previousPurchaseMedicines.map(x=>`<option value="${x.medicine_name}"></option>`).join("");}
async function saveQuickSupplier(){const msg=document.getElementById("purchaseMessage");const name=document.getElementById("newSupplierName").value.trim();if(!name){msg.innerHTML="<p class='error'>Supplier name is required.</p>";return;}const {error}=await db.from("suppliers").insert([{supplier_name:name,contact_person:document.getElementById("newSupplierContact").value.trim(),mobile:document.getElementById("newSupplierMobile").value.trim(),payment_terms:document.getElementById("newSupplierTerms").value.trim(),created_at:new Date().toISOString()}]);if(error){msg.innerHTML=`<p class='error'>${error.message}</p>`;return;}document.getElementById("quickSupplierBox").classList.add("hidden");await loadPurchaseSuggestions();document.getElementById("purchaseSupplier").value=name;}
function applyPreviousMedicineDetails(){const name=document.getElementById("purchaseMedicine").value.trim().toLowerCase();const r=previousPurchaseMedicines.find(x=>(x.medicine_name||"").toLowerCase()===name);if(!r)return;document.getElementById("purchaseCategory").value=r.category||"Other";applyItemTypeDefaults();document.getElementById("purchaseUnitsPerPack").value=r.units_per_pack||1;const c=currentConfig();document.getElementById("purchasePrice").value=(Number(r.purchase_price||0)*(c.convert?Number(r.units_per_pack||1):1)).toFixed(2);document.getElementById("purchaseMrp").value=(Number(r.mrp||0)*(c.convert?Number(r.units_per_pack||1):1)).toFixed(2);document.getElementById("purchaseSalePrice").value=r.sale_price||0;updatePurchaseCalculations();}
function addPurchaseInvoiceItem(){const c=currentConfig();const name=document.getElementById("purchaseMedicine").value.trim();const q=Number(document.getElementById("purchaseQty").value||0);const n=c.convert?Math.max(1,Number(document.getElementById("purchaseUnitsPerPack").value||1)):1;if(!name||q<=0){alert("Enter item name and valid quantity.");return;}purchaseInvoiceItems.push({medicine_name:name,category:document.getElementById("purchaseCategory").value,unit:c.buy,sale_unit:c.sell,units_per_pack:n,batch_no:document.getElementById("purchaseBatch").value.trim()||null,expiry_date:document.getElementById("purchaseExpiry").value||null,quantity:q,total_units:q*n,purchase_price:Number(document.getElementById("purchasePrice").value||0),mrp:Number(document.getElementById("purchaseMrp").value||0),sale_price:Number(document.getElementById("purchaseSalePrice").value||0),total_amount:q*Number(document.getElementById("purchasePrice").value||0)});["purchaseMedicine","purchaseBatch","purchaseExpiry"].forEach(id=>document.getElementById(id).value="");document.getElementById("purchaseQty").value=0;document.getElementById("purchasePrice").value=0;document.getElementById("purchaseMrp").value=0;document.getElementById("purchaseSalePrice").value=0;updatePurchaseCalculations();renderPurchaseItems();}
function removePurchaseItem(i){purchaseInvoiceItems.splice(i,1);renderPurchaseItems();}
function renderPurchaseItems(){const body=document.getElementById("purchaseItemRows");const total=purchaseInvoiceItems.reduce((s,r)=>s+Number(r.total_amount||0),0);document.getElementById("purchaseGrandTotal").textContent=money(total);body.innerHTML=purchaseInvoiceItems.length?purchaseInvoiceItems.map((r,i)=>`<tr><td>${r.category}</td><td>${r.medicine_name}</td><td>${r.unit}</td><td>${r.quantity}</td><td>${r.total_units} ${plural(r.sale_unit)}</td><td>${r.batch_no||""}</td><td>${money(r.purchase_price)}</td><td>${money(r.mrp)}</td><td>${money(r.sale_price)}</td><td>${money(r.total_amount)}</td><td><button class="secondary" onclick="removePurchaseItem(${i})">Remove</button></td></tr>`).join(""):"<tr><td colspan='11'>No item added.</td></tr>";}

async function saveCompletePurchaseInvoice(){if(currentUser.role!=="pharmacyOwner"&&currentUser.role!=="accountant"){alert("Only Pharmacy Owner or Accountant can enter purchases.");return;}const supplier=document.getElementById("purchaseSupplier").value;const invoiceNo=document.getElementById("purchaseInvoice").value.trim();const invoiceDate=document.getElementById("purchaseDate").value;if(!supplier||!invoiceNo||!invoiceDate||!purchaseInvoiceItems.length){alert("Select supplier, enter invoice details and add at least one item.");return;}const status=document.getElementById("purchasePaymentStatus").value;const mode=document.getElementById("purchasePaymentMode").value;const rows=purchaseInvoiceItems.map(i=>({medicine_name:i.medicine_name,category:i.category,unit:i.unit,units_per_pack:i.units_per_pack,batch_no:i.batch_no,expiry_date:i.expiry_date,quantity:i.quantity,purchase_price:i.purchase_price,mrp:i.mrp,sale_price:i.sale_price,total_amount:i.total_amount,supplier,invoice_no:invoiceNo,invoice_date:invoiceDate,payment_status:status,payment_mode:mode,created_at:new Date().toISOString()}));const stockRows=purchaseInvoiceItems.map(i=>({medicine_name:i.medicine_name,category:i.category,unit:i.sale_unit,units_per_pack:i.units_per_pack,batch_no:i.batch_no,expiry_date:i.expiry_date,purchase_price:i.purchase_price/i.units_per_pack,mrp:i.mrp/i.units_per_pack,sale_price:i.sale_price,quantity:i.total_units,created_at:new Date().toISOString()}));const msg=document.getElementById("purchaseMessage");const {error:pError}=await db.from("pharmacy_purchases").insert(rows);if(pError){msg.innerHTML=`<p class='error'>Invoice save failed: ${pError.message}</p>`;return;}const {error:sError}=await db.from("pharmacy_stock").insert(stockRows);if(sError){msg.innerHTML=`<p class='error'>Purchase saved, but stock add failed: ${sError.message}</p>`;return;}msg.innerHTML="<p class='success'>Invoice saved and stock added.</p>";purchaseInvoiceItems=[];document.getElementById("purchaseInvoice").value="";renderPurchaseItems();await loadPurchaseSuggestions();await loadPurchases();}
async function loadPurchases(){const body=document.getElementById("purchaseRows");const {data,error}=await db.from("pharmacy_purchases").select("*").order("created_at",{ascending:false});if(error){body.innerHTML=`<tr><td colspan='9' class='error'>${error.message}</td></tr>`;return;}const rows=data||[];document.getElementById("purchaseCount").textContent=rows.length;document.getElementById("purchaseValue").textContent=money(rows.reduce((s,r)=>s+Number(r.total_amount||0),0));document.getElementById("purchaseDue").textContent=money(rows.filter(r=>String(r.payment_status||"").toLowerCase()!=="paid").reduce((s,r)=>s+Number(r.total_amount||0),0));body.innerHTML=rows.length?rows.slice(0,50).map(r=>`<tr><td>${r.invoice_date||rowDate(r)}</td><td>${r.supplier||""}</td><td>${r.invoice_no||""}</td><td>${r.category||""}</td><td>${r.medicine_name||""}</td><td>${r.unit||""}</td><td>${r.quantity||0}</td><td>${money(r.total_amount||0)}</td><td>${r.payment_status||""}</td></tr>`).join(""):"<tr><td colspan='9'>No purchase records.</td></tr>";}
