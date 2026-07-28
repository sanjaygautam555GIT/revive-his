let patientSearchFilter="all";
let patientSearchList=[];
let patientSearchPage=1;
const patientSearchPageSize=10;

async function renderPatientSearch(){
  const el=document.getElementById("patientSearchView");
  el.innerHTML=`
    <div class="hs-page">
      <div class="hs-toolbar">
        <div class="hs-search"><input id="searchTerm" aria-label="Search patients" placeholder="Search by UHID, patient name, mobile or address"></div>
        <div class="hs-actions">
          <button id="newPatientBtn" class="hs-btn hs-btn-primary">＋ New Patient</button>
          <button id="patientPrintBtn" class="hs-btn hs-btn-secondary">Print</button>
          <button id="patientExportBtn" class="hs-btn hs-btn-secondary">Export</button>
        </div>
      </div>
      <div class="hs-filterbar" aria-label="Patient filters">
        <button class="hs-chip active" data-patient-filter="all">All Patients</button>
        <button class="hs-chip" data-patient-filter="opd">OPD History</button>
        <button class="hs-chip" data-patient-filter="ipd">IPD History</button>
        <button class="hs-chip" data-patient-filter="pharmacy">Pharmacy History</button>
      </div>
      <div class="hs-layout">
        <section class="hs-card">
          <div class="hs-card-head"><h3 class="hs-card-title">Patient List</h3><span id="patientResultCount" class="hs-count">0 records</span></div>
          <div class="hs-table-wrap">
            <table class="hs-table"><thead><tr><th>UHID</th><th>Patient Name</th><th>Age / Sex</th><th>Mobile</th><th>Last Visit</th><th>Visits</th></tr></thead><tbody id="searchRows"></tbody></table>
          </div>
          <div class="hs-pagination"><div id="patientPageControls" class="hs-page-controls"></div><select class="hs-page-size" disabled><option>10 per page</option></select></div>
        </section>
        <aside id="patientProfile" class="hs-card hs-profile"><div class="hs-empty">Select a patient to view the complete profile.</div></aside>
      </div>
    </div>`;
  document.getElementById("newPatientBtn").onclick=()=>navigate("opd");
  document.getElementById("searchTerm").oninput=()=>{patientSearchPage=1;applyPatientSearch()};
  document.getElementById("searchTerm").onkeydown=e=>{if(e.key==="Enter")searchPatients()};
  document.getElementById("patientPrintBtn").onclick=()=>window.print();
  document.getElementById("patientExportBtn").onclick=exportPatientSearch;
  document.querySelectorAll("[data-patient-filter]").forEach(btn=>btn.onclick=()=>{
    patientSearchFilter=btn.dataset.patientFilter;
    patientSearchPage=1;
    document.querySelectorAll("[data-patient-filter]").forEach(x=>x.classList.toggle("active",x===btn));
    applyPatientSearch();
  });
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
function patientInitials(p){return patientName(p).split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"PT"}
function escCsv(value){const s=String(value??"");return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s}

async function searchPatients(){
  const body=document.getElementById("searchRows");
  if(!body)return;
  body.innerHTML="<tr><td colspan='6'><div class='hs-empty hs-loading'>Loading patient records...</div></td></tr>";
  try{
    const data=await collectPatientMasterData();
    const map={};
    data.patients.forEach(p=>{const key=patientKey(p);if(!key)return;if(!map[key])map[key]={...p,visits:[],pharmacy:[],ipd:[]};map[key]={...map[key],...p}});
    data.opdVisits.forEach(v=>{const key=(v.uhid||v.patient_id||v.mobile||"").toString();if(!key)return;if(!map[key])map[key]={uhid:v.uhid,patient_id:v.patient_id,name:v.patient_name,patient_name:v.patient_name,age:v.age,sex:v.sex,mobile:v.mobile,visits:[],pharmacy:[],ipd:[]};map[key].visits.push(v)});
    data.sales.forEach(s=>{const mobile=s.mobile||"";const key=Object.keys(map).find(k=>(map[k].mobile||"")===mobile||patientName(map[k])===s.patient_name)||mobile||s.patient_name;if(!key)return;if(!map[key])map[key]={name:s.patient_name,patient_name:s.patient_name,mobile,visits:[],pharmacy:[],ipd:[]};map[key].pharmacy.push(s)});
    data.ipd.forEach(x=>{const key=Object.keys(map).find(k=>(map[k].mobile||"")===x.mobile||patientName(map[k])===x.patient_name)||x.mobile||x.patient_name;if(!key)return;if(!map[key])map[key]={name:x.patient_name,patient_name:x.patient_name,mobile:x.mobile,visits:[],pharmacy:[],ipd:[]};map[key].ipd.push(x)});
    patientSearchList=Object.values(map).sort((a,b)=>new Date(lastVisitDate(b)||0)-new Date(lastVisitDate(a)||0));
    window.__patientMasterMap=map;
    applyPatientSearch();
  }catch(e){body.innerHTML=`<tr><td colspan='6'><div class='hs-empty error'>${e.message}</div></td></tr>`}
}

function applyPatientSearch(){
  const body=document.getElementById("searchRows");
  if(!body)return;
  const q=(document.getElementById("searchTerm")?.value||"").trim().toLowerCase();
  let list=patientSearchList.filter(p=>!q||[patientUHID(p),patientName(p),p.mobile,p.address].join(" ").toLowerCase().includes(q));
  if(patientSearchFilter==="opd")list=list.filter(p=>(p.visits||[]).length);
  if(patientSearchFilter==="ipd")list=list.filter(p=>(p.ipd||[]).length);
  if(patientSearchFilter==="pharmacy")list=list.filter(p=>(p.pharmacy||[]).length);
  document.getElementById("patientResultCount").textContent=`${list.length} record${list.length===1?"":"s"}`;
  const pages=Math.max(1,Math.ceil(list.length/patientSearchPageSize));
  if(patientSearchPage>pages)patientSearchPage=pages;
  const start=(patientSearchPage-1)*patientSearchPageSize;
  const visible=list.slice(start,start+patientSearchPageSize);
  body.innerHTML=visible.length?visible.map(p=>{
    const key=patientKey(p).replaceAll("'","\\'");
    return `<tr data-patient-key="${key}" onclick="openPatientProfile('${key}')"><td><strong>${patientUHID(p)||"-"}</strong></td><td>${patientName(p)||"-"}</td><td>${p.age||"-"} / ${patientSex(p)||"-"}</td><td>${p.mobile||"-"}</td><td>${lastVisitDate(p)||"-"}</td><td><span class="hs-status active">${(p.visits||[]).length}</span></td></tr>`
  }).join(""):"<tr><td colspan='6'><div class='hs-empty'>No patient records match the selected search and filter.</div></td></tr>";
  renderPatientPagination(pages);
  window.__patientFilteredList=list;
}

function renderPatientPagination(pages){
  const el=document.getElementById("patientPageControls");
  if(!el)return;
  const max=Math.min(pages,5);
  let html=`<button class="hs-page-btn" ${patientSearchPage===1?"disabled":""} onclick="changePatientPage(${patientSearchPage-1})">‹</button>`;
  for(let i=1;i<=max;i++)html+=`<button class="hs-page-btn ${i===patientSearchPage?"active":""}" onclick="changePatientPage(${i})">${i}</button>`;
  html+=`<button class="hs-page-btn" ${patientSearchPage===pages?"disabled":""} onclick="changePatientPage(${patientSearchPage+1})">›</button>`;
  el.innerHTML=html;
}
function changePatientPage(page){patientSearchPage=Math.max(1,page);applyPatientSearch()}

function exportPatientSearch(){
  const list=window.__patientFilteredList||[];
  const rows=[["UHID","Patient Name","Age","Sex","Mobile","Address","Last Visit","OPD Visits","IPD Records","Pharmacy Bills"],...list.map(p=>[patientUHID(p),patientName(p),p.age||"",patientSex(p),p.mobile||"",p.address||"",lastVisitDate(p),(p.visits||[]).length,(p.ipd||[]).length,(p.pharmacy||[]).length])];
  const csv=rows.map(r=>r.map(escCsv).join(",")).join("\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`patient-search-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);
}
function lastVisitDate(p){const dates=[];(p.visits||[]).forEach(v=>dates.push(v.visit_date||rowDate(v)));(p.pharmacy||[]).forEach(s=>dates.push(s.bill_date||rowDate(s)));(p.ipd||[]).forEach(i=>dates.push(rowDate(i)));if(p.created_at)dates.push(rowDate(p));return dates.filter(Boolean).sort().slice(-1)[0]||""}

function closePatientProfile(){
  document.querySelectorAll("#searchRows tr").forEach(row=>row.classList.remove("selected"));
  const el=document.getElementById("patientProfile");
  if(el)el.innerHTML='<div class="hs-empty">Select a patient to view the complete profile.</div>';
}
function openPatientProfile(key){
  const p=window.__patientMasterMap?.[key];
  const el=document.getElementById("patientProfile");
  document.querySelectorAll("#searchRows tr").forEach(row=>row.classList.toggle("selected",row.dataset.patientKey===key));
  if(!p){el.innerHTML="<div class='hs-empty error'>Patient not found.</div>";return}
  const opdRevenue=(p.visits||[]).reduce((s,v)=>s+safeNumber(v.amount),0);
  const pharmacyRevenue=(p.pharmacy||[]).reduce((s,v)=>s+safeNumber(v.amount_paid||v.bill_amount),0);
  const ipdRevenue=(p.ipd||[]).reduce((s,v)=>s+safeNumber(v.advance||v.total),0);
  const total=opdRevenue+pharmacyRevenue+ipdRevenue;
  const visits=(p.visits||[]).slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,5);
  el.innerHTML=`
    <div class="hs-profile-head">
      <div class="hs-avatar">${patientInitials(p)}</div>
      <div class="hs-profile-head-main"><h3>${patientName(p)||"Patient"}</h3><p>${patientUHID(p)||"-"} &nbsp; <span class="hs-status active">ACTIVE</span></p></div>
      <button class="hs-profile-close" onclick="closePatientProfile()" aria-label="Close profile">×</button>
    </div>
    <div class="hs-profile-actions">
      <button class="hs-btn hs-btn-secondary">Edit</button>
      <button class="hs-btn hs-btn-secondary" onclick="navigate('opd')">New OPD</button>
      <button class="hs-btn hs-btn-secondary" onclick="navigate('ipd')">IPD Admission</button>
      <button class="hs-btn hs-btn-secondary" onclick="window.print()">Print</button>
    </div>
    <div class="hs-info-card">
      <div class="hs-info-title">Patient Information</div>
      <div class="hs-info-grid">
        <div class="hs-info-item"><span>Age / Sex</span><strong>${p.age||"-"} / ${patientSex(p)||"-"}</strong></div>
        <div class="hs-info-item"><span>DOB</span><strong>${p.dob||p.date_of_birth||"-"}</strong></div>
        <div class="hs-info-item"><span>Mobile</span><strong>${p.mobile||"-"}</strong></div>
        <div class="hs-info-item"><span>Alternate Mobile</span><strong>${p.alternate_mobile||p.alt_mobile||"-"}</strong></div>
        <div class="hs-info-item"><span>Address</span><strong>${p.address||"-"}</strong></div>
        <div class="hs-info-item"><span>Blood Group</span><strong>${p.blood_group||"-"}</strong></div>
      </div>
    </div>
    <div class="hs-metrics">
      <div class="hs-metric"><span>Total Visits</span><strong>${(p.visits||[]).length+(p.ipd||[]).length}</strong></div>
      <div class="hs-metric"><span>OPD Visits</span><strong>${(p.visits||[]).length}</strong></div>
      <div class="hs-metric"><span>IPD Admissions</span><strong>${(p.ipd||[]).length}</strong></div>
      <div class="hs-metric"><span>Total Billing</span><strong>${money(total)}</strong></div>
    </div>
    <div class="hs-section"><h4>Recent OPD Visits</h4><table class="hs-mini-table"><thead><tr><th>Date</th><th>Doctor</th><th>Department</th><th>Amount</th></tr></thead><tbody>${visits.length?visits.map(v=>`<tr><td>${v.visit_date||rowDate(v)||"-"}</td><td>${v.consultant||"-"}</td><td>${v.department||"-"}</td><td>${money(v.amount||0)}</td></tr>`).join(""):"<tr><td colspan='4'>No OPD visits.</td></tr>"}</tbody></table></div>`;
}