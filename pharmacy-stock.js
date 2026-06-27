async function renderPharmacyStock(){
  const el=document.getElementById("pharmacyStockView");
  el.innerHTML=`<div class="panel"><h2>Pharmacy Stock</h2><p>Loading stock from Supabase...</p><div id="stockStatus" class="sync-box">Connecting...</div><div class="grid cards"><div class="card"><span>Total Medicines</span><strong id="stockCount">0</strong></div><div class="card"><span>Low Stock</span><strong id="lowStockCount">0</strong></div></div><div class="panel table-wrap"><table><thead><tr><th>Medicine</th><th>Batch</th><th>Expiry</th><th>Qty</th><th>Sale Price</th></tr></thead><tbody id="stockRows"></tbody></table></div></div>`;
  await loadSimpleStock();
}

async function loadSimpleStock(){
  const body=document.getElementById("stockRows");
  const status=document.getElementById("stockStatus");
  const {data,error}=await db.from("pharmacy_stock").select("*").order("created_at",{ascending:false});
  if(error){status.textContent="Stock load failed: "+error.message;body.innerHTML="";return;}
  const rows=data||[];
  document.getElementById("stockCount").textContent=rows.length;
  document.getElementById("lowStockCount").textContent=rows.filter(r=>Number(r.quantity||0)<=10).length;
  status.textContent="Stock loaded from Supabase: "+rows.length+" records";
  body.innerHTML=rows.length?rows.map(r=>`<tr><td>${r.medicine_name||""}</td><td>${r.batch_no||""}</td><td>${r.expiry_date||""}</td><td>${r.quantity||0}</td><td>${money(r.sale_price||0)}</td></tr>`).join(""):"<tr><td colspan='5'>No stock found.</td></tr>";
}
