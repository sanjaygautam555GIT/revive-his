async function renderSupplierMaster(){
  const el=document.getElementById("supplierMasterView");
  el.innerHTML=`
    <div class="panel"><h2>Supplier Master</h2><p>Add and view pharmacy suppliers.</p>
      <form id="supplierForm"><div class="grid" style="grid-template-columns:repeat(3,1fr)">
        <div><label>Supplier Name</label><input id="supName" required></div>
        <div><label>Contact Person</label><input id="supContact"></div>
        <div><label>Mobile</label><input id="supMobile"></div>
        <div><label>GST No</label><input id="supGst"></div>
        <div><label>Payment Terms</label><input id="supTerms" placeholder="Cash / 30 days / Credit"></div>
        <div><label>Address</label><input id="supAddress"></div>
      </div><br><button type="submit">Save Supplier</button></form><div id="supplierMsg"></div>
    </div>
    <div class="panel table-wrap"><h3>Suppliers</h3><table><thead><tr><th>Name</th><th>Contact</th><th>Mobile</th><th>GST</th><th>Terms</th></tr></thead><tbody id="supplierRows"></tbody></table></div>`;
  document.getElementById("supplierForm").onsubmit=saveSupplier;
  await loadSuppliers();
}

async function saveSupplier(e){
  e.preventDefault();
  const payload={supplier_name:document.getElementById("supName").value.trim(),contact_person:document.getElementById("supContact").value.trim()||null,mobile:document.getElementById("supMobile").value.trim()||null,gst_no:document.getElementById("supGst").value.trim()||null,payment_terms:document.getElementById("supTerms").value.trim()||null,address:document.getElementById("supAddress").value.trim()||null,created_at:new Date().toISOString()};
  const {error}=await db.from("suppliers").insert([payload]);
  const msg=document.getElementById("supplierMsg");
  if(error){msg.innerHTML=`<p class="error">Supplier save failed: ${error.message}</p>`;return;}
  msg.innerHTML=`<p class="success">Supplier saved.</p>`;
  document.getElementById("supplierForm").reset();
  await loadSuppliers();
}

async function loadSuppliers(){
  const body=document.getElementById("supplierRows");
  const {data,error}=await db.from("suppliers").select("*").order("supplier_name",{ascending:true});
  if(error){body.innerHTML=`<tr><td colspan='5' class='error'>${error.message}</td></tr>`;return;}
  const rows=data||[];
  body.innerHTML=rows.length?rows.map(r=>`<tr><td>${r.supplier_name||""}</td><td>${r.contact_person||""}</td><td>${r.mobile||""}</td><td>${r.gst_no||""}</td><td>${r.payment_terms||""}</td></tr>`).join(""):"<tr><td colspan='5'>No suppliers added.</td></tr>";
}

async function renderMedicineMaster(){
  const el=document.getElementById("medicineMasterView");
  el.innerHTML=`
    <div class="panel"><h2>Medicine Master</h2><p>Add standard medicine names and default pricing.</p>
      <form id="medicineForm"><div class="grid" style="grid-template-columns:repeat(3,1fr)">
        <div><label>Medicine Name</label><input id="mmName" required></div>
        <div><label>Generic Name</label><input id="mmGeneric"></div>
        <div><label>Strength</label><input id="mmStrength" placeholder="500 mg / 1 g"></div>
        <div><label>Unit</label><input id="mmUnit" placeholder="Tablet / Vial / Bottle"></div>
        <div><label>Category</label><input id="mmCategory"></div>
        <div><label>Manufacturer</label><input id="mmManufacturer"></div>
        <div><label>Default Purchase Price</label><input id="mmPurchase" type="number" step="0.01" value="0"></div>
        <div><label>Default Sale Price</label><input id="mmSale" type="number" step="0.01" value="0"></div>
      </div><br><button type="submit">Save Medicine</button></form><div id="medicineMsg"></div>
    </div>
    <div class="panel table-wrap"><h3>Medicines</h3><table><thead><tr><th>Medicine</th><th>Generic</th><th>Strength</th><th>Unit</th><th>Manufacturer</th><th>Purchase</th><th>Sale</th></tr></thead><tbody id="medicineRows"></tbody></table></div>`;
  document.getElementById("medicineForm").onsubmit=saveMedicineMaster;
  await loadMedicineMaster();
}

async function saveMedicineMaster(e){
  e.preventDefault();
  const payload={medicine_name:document.getElementById("mmName").value.trim(),generic_name:document.getElementById("mmGeneric").value.trim()||null,strength:document.getElementById("mmStrength").value.trim()||null,unit:document.getElementById("mmUnit").value.trim()||null,category:document.getElementById("mmCategory").value.trim()||null,manufacturer:document.getElementById("mmManufacturer").value.trim()||null,default_purchase_price:Number(document.getElementById("mmPurchase").value||0),default_sale_price:Number(document.getElementById("mmSale").value||0),created_at:new Date().toISOString()};
  const {error}=await db.from("medicine_master").insert([payload]);
  const msg=document.getElementById("medicineMsg");
  if(error){msg.innerHTML=`<p class="error">Medicine save failed: ${error.message}</p>`;return;}
  msg.innerHTML=`<p class="success">Medicine saved.</p>`;
  document.getElementById("medicineForm").reset();
  await loadMedicineMaster();
}

async function loadMedicineMaster(){
  const body=document.getElementById("medicineRows");
  const {data,error}=await db.from("medicine_master").select("*").order("medicine_name",{ascending:true});
  if(error){body.innerHTML=`<tr><td colspan='7' class='error'>${error.message}</td></tr>`;return;}
  const rows=data||[];
  body.innerHTML=rows.length?rows.map(r=>`<tr><td>${r.medicine_name||""}</td><td>${r.generic_name||""}</td><td>${r.strength||""}</td><td>${r.unit||""}</td><td>${r.manufacturer||""}</td><td>${money(r.default_purchase_price||0)}</td><td>${money(r.default_sale_price||0)}</td></tr>`).join(""):"<tr><td colspan='7'>No medicines added.</td></tr>";
}
