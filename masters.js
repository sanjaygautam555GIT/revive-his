let editingSupplierId=null;

async function renderSupplierMaster(){
  const el=document.getElementById("supplierMasterView");
  el.innerHTML=`
    <div class="panel"><h2>Supplier Master</h2><p>Add, edit, and manage pharmacy suppliers.</p>
      <form id="supplierForm"><input type="hidden" id="supId"><div class="grid" style="grid-template-columns:repeat(3,1fr)">
        <div><label>Supplier Name</label><input id="supName" required></div>
        <div><label>Contact Person</label><input id="supContact"></div>
        <div><label>Mobile</label><input id="supMobile"></div>
        <div><label>GST No</label><input id="supGst"></div>
        <div><label>Payment Terms</label><input id="supTerms" placeholder="Cash / 30 days / Credit"></div>
        <div><label>Address</label><input id="supAddress"></div>
      </div><br>
      <button type="submit" id="supplierSaveBtn">Save Supplier</button>
      <button type="button" class="secondary hidden" id="supplierCancelEditBtn">Cancel Edit</button>
      </form><div id="supplierMsg"></div>
    </div>
    <div class="panel table-wrap"><h3>Suppliers</h3><table><thead><tr><th>Name</th><th>Contact</th><th>Mobile</th><th>GST</th><th>Terms</th><th>Address</th><th>Actions</th></tr></thead><tbody id="supplierRows"></tbody></table></div>`;
  document.getElementById("supplierForm").onsubmit=saveSupplier;
  document.getElementById("supplierCancelEditBtn").onclick=cancelSupplierEdit;
  editingSupplierId=null;
  await loadSuppliers();
}

async function saveSupplier(e){
  e.preventDefault();
  const msg=document.getElementById("supplierMsg");
  const name=document.getElementById("supName").value.trim();
  if(!name){msg.innerHTML="<p class='error'>Supplier name is required.</p>";return;}
  const payload={supplier_name:name,contact_person:document.getElementById("supContact").value.trim()||null,mobile:document.getElementById("supMobile").value.trim()||null,gst_no:document.getElementById("supGst").value.trim()||null,payment_terms:document.getElementById("supTerms").value.trim()||null,address:document.getElementById("supAddress").value.trim()||null};
  let error;
  if(editingSupplierId){({error}=await db.from("suppliers").update(payload).eq("id",editingSupplierId));}
  else{payload.created_at=new Date().toISOString();({error}=await db.from("suppliers").insert([payload]));}
  if(error){msg.innerHTML=`<p class="error">Supplier ${editingSupplierId?"update":"save"} failed: ${error.message}</p>`;return;}
  msg.innerHTML=`<p class="success">Supplier ${editingSupplierId?"updated":"saved"}.</p>`;
  cancelSupplierEdit(false);
  await loadSuppliers();
}

function editSupplier(id){
  const r=(window.supplierMasterRows||[]).find(x=>String(x.id)===String(id));
  if(!r)return;
  editingSupplierId=r.id;
  document.getElementById("supId").value=r.id||"";
  document.getElementById("supName").value=r.supplier_name||"";
  document.getElementById("supContact").value=r.contact_person||"";
  document.getElementById("supMobile").value=r.mobile||"";
  document.getElementById("supGst").value=r.gst_no||"";
  document.getElementById("supTerms").value=r.payment_terms||"";
  document.getElementById("supAddress").value=r.address||"";
  document.getElementById("supplierSaveBtn").textContent="Update Supplier";
  document.getElementById("supplierCancelEditBtn").classList.remove("hidden");
  document.getElementById("supplierMsg").innerHTML=`<p class='success'>Editing ${r.supplier_name||"supplier"}.</p>`;
  document.getElementById("supName").focus();
}

function cancelSupplierEdit(clearMessage=true){
  editingSupplierId=null;
  const form=document.getElementById("supplierForm");if(form)form.reset();
  const id=document.getElementById("supId");if(id)id.value="";
  const btn=document.getElementById("supplierSaveBtn");if(btn)btn.textContent="Save Supplier";
  const cancel=document.getElementById("supplierCancelEditBtn");if(cancel)cancel.classList.add("hidden");
  if(clearMessage){const msg=document.getElementById("supplierMsg");if(msg)msg.innerHTML="";}
}

async function deleteSupplier(id){
  const msg=document.getElementById("supplierMsg");
  const r=(window.supplierMasterRows||[]).find(x=>String(x.id)===String(id));
  if(!r){msg.innerHTML="<p class='error'>Supplier record not found.</p>";return;}
  const {data:used,error:checkError}=await db.from("pharmacy_purchases").select("id").eq("supplier",r.supplier_name).limit(1);
  if(checkError){msg.innerHTML=`<p class='error'>Could not check supplier usage: ${checkError.message}</p>`;return;}
  if((used||[]).length){msg.innerHTML="<p class='error'>This supplier has purchase records and cannot be deleted. Edit it instead.</p>";return;}
  if(!confirm(`Delete supplier?\n\n${r.supplier_name||""}`))return;
  const {data:deleted,error}=await db.from("suppliers").delete().eq("id",id).select("id");
  if(error){msg.innerHTML=`<p class='error'>Supplier delete failed: ${error.message}</p>`;return;}
  if(!(deleted||[]).length){msg.innerHTML="<p class='error'>Supplier was not deleted. Supabase RLS is probably blocking DELETE. Add a DELETE policy for the suppliers table.</p>";return;}
  if(String(editingSupplierId)===String(id))cancelSupplierEdit(false);
  msg.innerHTML="<p class='success'>Supplier deleted.</p>";
  await loadSuppliers();
}

async function loadSuppliers(){
  const body=document.getElementById("supplierRows");
  const {data,error}=await db.from("suppliers").select("*").order("supplier_name",{ascending:true});
  if(error){body.innerHTML=`<tr><td colspan='7' class='error'>${error.message}</td></tr>`;return;}
  const rows=data||[];window.supplierMasterRows=rows;
  body.innerHTML=rows.length?rows.map(r=>`<tr><td>${r.supplier_name||""}</td><td>${r.contact_person||""}</td><td>${r.mobile||""}</td><td>${r.gst_no||""}</td><td>${r.payment_terms||""}</td><td>${r.address||""}</td><td><button type="button" class="secondary" onclick="editSupplier(${r.id})">Edit</button> <button type="button" class="secondary" onclick="deleteSupplier(${r.id})">Delete</button></td></tr>`).join(""):"<tr><td colspan='7'>No suppliers added.</td></tr>";
}

async function renderMedicineMaster(){
  const el=document.getElementById("medicineMasterView");
  el.innerHTML=`<div class="panel"><h2>Medicine Master</h2><p>Add standard medicine names and default pricing.</p><form id="medicineForm"><div class="grid" style="grid-template-columns:repeat(3,1fr)"><div><label>Medicine Name</label><input id="mmName" required></div><div><label>Generic Name</label><input id="mmGeneric"></div><div><label>Strength</label><input id="mmStrength" placeholder="500 mg / 1 g"></div><div><label>Unit</label><input id="mmUnit" placeholder="Tablet / Vial / Bottle"></div><div><label>Category</label><input id="mmCategory"></div><div><label>Manufacturer</label><input id="mmManufacturer"></div><div><label>Default Purchase Price</label><input id="mmPurchase" type="number" step="0.01" value="0"></div><div><label>Default Sale Price</label><input id="mmSale" type="number" step="0.01" value="0"></div></div><br><button type="submit">Save Medicine</button></form><div id="medicineMsg"></div></div><div class="panel table-wrap"><h3>Medicines</h3><table><thead><tr><th>Medicine</th><th>Generic</th><th>Strength</th><th>Unit</th><th>Manufacturer</th><th>Purchase</th><th>Sale</th></tr></thead><tbody id="medicineRows"></tbody></table></div>`;
  document.getElementById("medicineForm").onsubmit=saveMedicineMaster;await loadMedicineMaster();
}
async function saveMedicineMaster(e){e.preventDefault();const payload={medicine_name:document.getElementById("mmName").value.trim(),generic_name:document.getElementById("mmGeneric").value.trim()||null,strength:document.getElementById("mmStrength").value.trim()||null,unit:document.getElementById("mmUnit").value.trim()||null,category:document.getElementById("mmCategory").value.trim()||null,manufacturer:document.getElementById("mmManufacturer").value.trim()||null,default_purchase_price:Number(document.getElementById("mmPurchase").value||0),default_sale_price:Number(document.getElementById("mmSale").value||0),created_at:new Date().toISOString()};const {error}=await db.from("medicine_master").insert([payload]);const msg=document.getElementById("medicineMsg");if(error){msg.innerHTML=`<p class="error">Medicine save failed: ${error.message}</p>`;return;}msg.innerHTML=`<p class="success">Medicine saved.</p>`;document.getElementById("medicineForm").reset();await loadMedicineMaster();}
async function loadMedicineMaster(){const body=document.getElementById("medicineRows");const {data,error}=await db.from("medicine_master").select("*").order("medicine_name",{ascending:true});if(error){body.innerHTML=`<tr><td colspan='7' class='error'>${error.message}</td></tr>`;return;}const rows=data||[];body.innerHTML=rows.length?rows.map(r=>`<tr><td>${r.medicine_name||""}</td><td>${r.generic_name||""}</td><td>${r.strength||""}</td><td>${r.unit||""}</td><td>${r.manufacturer||""}</td><td>${money(r.default_purchase_price||0)}</td><td>${money(r.default_sale_price||0)}</td></tr>`).join(""):"<tr><td colspan='7'>No medicines added.</td></tr>";}