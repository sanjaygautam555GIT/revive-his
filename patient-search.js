async function renderPatientSearch(){
  const el=document.getElementById("patientSearchView");
  el.innerHTML=`
    <div class="panel">
      <h2>Patient Master V2</h2>
      <p>Search patient by UHID, name, or mobile. Click a patient to see profile, OPD history, pharmacy history, and financial summary.</p>
      <div class="form-row"><div><label>Search UHID / Name / Mobile</label><input id="searchTerm" placeholder="Type patient name, mobile or UHID"></div><button id="searchBtn">Search</button></div>
    </div>
    <div class="grid" style="grid-template-columns:1.1fr .9fr;gap:16px">
      <div class="panel table-wrap"><h3>Patient List</h3><table><thead><tr><th>UHID</th><th>Name</th><th>Age/Sex</th><th>Mobile</th><th>Last Visit</th><th>Visits</th></tr></thead><tbody id="searchRows"></tbody></table></div>
      <div id="patientProfile" class="panel"><h3>Patient Profile</h3><p>Select a patient from the list.</p></div>
    </div>
  `;
  document.getElementById("searchBtn").onclick=searchPatients;
  document.getElementById("searchTerm").onkeydown=e=>{if(e.key==="Enter")searchPatients()};
  await searchPatients();
}

async function collectPatientMasterData(){
  const [patients,opdVisits,ipd,sales]=await Promise.all([fetchAll("patient"),fetchAll("opd_visits"),fetchAll("ipd_admission"),fetchAll("pharmacy_sales")]);
  return {patients,opdVisits,ipd,sales};
}

function patientKey(p){return (p.uhid||p.patient_id||p.mobile||p.id||"").toString()}
function patientName(p){return p.name||p.patient_name||""}
function patientUHID(p){return p.uhid||p.patient_id||""}
function patientSex(p){return p.sex||p.gender||""}

async function searchPatients(){
  const q=(document.getElementById("searchTerm")?.value||"").trim().toLowerCase();
  const body=document.getElementById("searchRows");
  body.innerHTML="<tr><td colspan='6'>Loading patients...</td></tr>";
  try{
    const data=await collectPatientMasterData();
    const map={};
    data.patients.forEach(p=>{
      const key=patientKey(p);
      if(!key)return;
      if(!map[key])map[key]={...p,visits:[],pharmacy:[],ipd:[]};
      map[key]={...map[key],...p};
    });
    data.opdVisits.forEach(v=>{
      const key=(v.uhid||v.patient_id||v.mobile||"").toString();
      if(!key)return;
      if(!map[key])map[key]={uhid:v.uhid,patient_id:v.patient_id,name:v.patient_name,patient_name:v.patient_name,age:v.age,sex:v.sex,mobile:v.mobile,visits:[],pharmacy:[],ipd:[]};
      map[key].visits.push(v);
    });
    data.sales.forEach(s=>{
      const mobile=s.mobile||"";
      let key=Object.keys(map).find(k=>(map[k].mobile||"")===mobile || patientName(map[k])===s.patient_name) || mobile || s.patient_name;
      if(!key)return;
      if(!map[key])map[key]={name:s.patient_name,patient_name:s.patient_name,mobile,visits:[],pharmacy:[],ipd:[]};
      map[key].pharmacy.push(s);
    });
    data.ipd.forEach(x=>{
      let key=Object.keys(map).find(k=>(map[k].mobile||"")===x.mobile || patientName(map[k])===x.patient_name) || x.mobile || x.patient_name;
      if(!key)return;
      if(!map[key])map[key]={name:x.patient_name,patient_name:x.patient_name,mobile:x.mobile,visits:[],pharmacy:[],ipd:[]};
      map[key].ipd.push(x);
    });
    let list=Object.values(map);
    if(q){list=list.filter(p=>[patientUHID(p),patientName(p),p.mobile,p.address].join(" ").toLowerCase().includes(q));}
    list.sort((a,b)=>new Date(lastVisitDate(b)||0)-new Date(lastVisitDate(a)||0));
    body.innerHTML=list.length?list.slice(0,100).map((p,i)=>`<tr onclick="openPatientProfile('${patientKey(p).replaceAll("'","\\'")}')"><td>${patientUHID(p)||"-"}</td><td>${patientName(p)||"-"}</td><td>${p.age||""}/${patientSex(p)||""}</td><td>${p.mobile||""}</td><td>${lastVisitDate(p)||""}</td><td>${(p.visits||[]).length}</td></tr>`).join(""):"<tr><td colspan='6'>No patient found.</td></tr>";
    window.__patientMasterMap=map;
  }catch(e){body.innerHTML=`<tr><td colspan='6' class='error'>${e.message}</td></tr>`;}
}

function lastVisitDate(p){
  const dates=[];
  (p.visits||[]).forEach(v=>dates.push(v.visit_date||rowDate(v)));
  (p.pharmacy||[]).forEach(s=>dates.push(s.bill_date||rowDate(s)));
  (p.ipd||[]).forEach(i=>dates.push(rowDate(i)));
  if(p.created_at)dates.push(rowDate(p));
  return dates.filter(Boolean).sort().slice(-1)[0]||"";
}

function openPatientProfile(key){
  const p=window.__patientMasterMap?.[key];
  const el=document.getElementById("patientProfile");
  if(!p){el.innerHTML="<h3>Patient Profile</h3><p class='error'>Patient not found.</p>";return;}
  const opdRevenue=(p.visits||[]).reduce((s,v)=>s+safeNumber(v.amount),0);
  const pharmacyRevenue=(p.pharmacy||[]).reduce((s,v)=>s+safeNumber(v.amount_paid||v.bill_amount),0);
  const ipdRevenue=(p.ipd||[]).reduce((s,v)=>s+safeNumber(v.advance||v.total),0);
  const total=opdRevenue+pharmacyRevenue+ipdRevenue;
  el.innerHTML=`
    <h3>${patientName(p)||"Patient"}</h3>
    <p><b>UHID:</b> ${patientUHID(p)||"-"}<br><b>Age/Sex:</b> ${p.age||""} / ${patientSex(p)||""}<br><b>Mobile:</b> ${p.mobile||""}<br><b>Address:</b> ${p.address||""}</p>
    <div class="grid cards" style="grid-template-columns:repeat(2,1fr)">
      <div class="card"><span>Total Revenue</span><strong>${money(total)}</strong></div>
      <div class="card"><span>OPD Visits</span><strong>${(p.visits||[]).length}</strong></div>
      <div class="card"><span>OPD Revenue</span><strong>${money(opdRevenue)}</strong></div>
      <div class="card"><span>Pharmacy Revenue</span><strong>${money(pharmacyRevenue)}</strong></div>
    </div>
    <div class="table-wrap"><h3>OPD Visit History</h3><table><thead><tr><th>Date</th><th>Visit ID</th><th>Department</th><th>Doctor</th><th>Amount</th></tr></thead><tbody>${(p.visits||[]).length?(p.visits||[]).slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).map(v=>`<tr><td>${v.visit_date||rowDate(v)}</td><td>${v.visit_id||""}</td><td>${v.department||""}</td><td>${v.consultant||""}</td><td>${money(v.amount||0)}</td></tr>`).join(""):"<tr><td colspan='5'>No OPD visits.</td></tr>"}</tbody></table></div>
    <div class="table-wrap"><h3>Pharmacy History</h3><table><thead><tr><th>Date</th><th>Patient Type</th><th>Amount</th></tr></thead><tbody>${(p.pharmacy||[]).length?(p.pharmacy||[]).slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).map(s=>`<tr><td>${s.bill_date||rowDate(s)}</td><td>${s.patient_type||""}</td><td>${money(s.amount_paid||s.bill_amount||0)}</td></tr>`).join(""):"<tr><td colspan='3'>No pharmacy bills.</td></tr>"}</tbody></table></div>
  `;
}
