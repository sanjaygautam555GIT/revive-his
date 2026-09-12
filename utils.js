function money(n){return "₹"+Number(n||0).toLocaleString("en-IN")}
function todayISO(){return new Date().toISOString().slice(0,10)}
function rowDate(r,f="created_at"){return(r[f]||"").slice(0,10)}
async function fetchAll(t){const{data,error}=await db.from(t).select("*");if(error)throw error;return data||[]}
function placeholder(id,text){document.getElementById(id).innerHTML=`<div class="panel">${text}</div>`}

function escapePatientChoice(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}
function filterPatientChoices(records,query,fields){
  const q=String(query||"").trim().toLowerCase();
  return (records||[]).filter(record=>fields.some(field=>String(typeof field==="function"?field(record):record[field]||"").toLowerCase().includes(q))).sort((a,b)=>{
    const name=r=>String(r.patient_name||r.name||"").trim().toLowerCase();
    const exactDifference=Number(name(b)===q)-Number(name(a)===q);
    if(exactDifference)return exactDifference;
    return String(b.created_at||b.visit_date||b.admission_date||"").localeCompare(String(a.created_at||a.visit_date||a.admission_date||""));
  });
}
function renderPatientChoices(container,records,options,onSelect){
  const label=options?.recordLabel||"patient";
  const detailLabel=options?.detailLabel||"Reference";
  const detailValue=options?.detailValue||(()=>"-");
  container.innerHTML=`<div class="sync-box"><b>${records.length} ${label}${records.length===1?"":"s"} found</b><br><span>Select the correct record using the details below.</span></div><div class="table-wrap"><table><thead><tr><th>Name</th><th>UHID</th><th>Age / Sex</th><th>Mobile</th><th>${escapePatientChoice(detailLabel)}</th><th>Action</th></tr></thead><tbody>${records.map((r,index)=>`<tr><td><b>${escapePatientChoice(r.patient_name||r.name||"Patient")}</b></td><td>${escapePatientChoice(r.uhid||r.patient_id||"-")}</td><td>${escapePatientChoice([r.age,r.sex||r.gender].filter(v=>v!==null&&v!==undefined&&v!=="").join(" / ")||"-")}</td><td>${escapePatientChoice(r.mobile||"-")}</td><td>${escapePatientChoice(detailValue(r)||"-")}</td><td><button type="button" class="patient-choice-select" data-index="${index}">Select</button></td></tr>`).join("")}</tbody></table></div>`;
  container.querySelectorAll(".patient-choice-select").forEach(button=>button.onclick=()=>onSelect(records[Number(button.dataset.index)]));
}
