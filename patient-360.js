// Unified Patient 360 view for OPD, IPD, diagnostics, pharmacy, payments and procedures.
(function(){
  async function safeFetch(table){
    try{return await fetchAll(table)}catch(e){console.warn(`Patient 360: ${table} unavailable`,e);return []}
  }
  function norm(v){return String(v||'').trim().toLowerCase()}
  function samePatient(record,p){
    const puhid=norm(patientUHID(p)), pmobile=norm(p.mobile), pname=norm(patientName(p));
    const ruhid=norm(record.uhid||record.patient_id), rmobile=norm(record.mobile), rname=norm(record.patient_name||record.name);
    return !!((puhid&&ruhid===puhid)||(pmobile&&rmobile===pmobile)||(pname&&rname===pname));
  }
  function eventDate(r,fields=[]){
    for(const f of fields){if(r?.[f])return String(r[f]).slice(0,10)}
    return rowDate(r)||'';
  }
  function eventAmount(r,fields=[]){for(const f of fields){if(r?.[f]!=null)return safeNumber(r[f])}return 0}
  function timelineItem(type,title,detail,date,amount,status){return {type,title,detail,date:date||'',amount:safeNumber(amount),status:status||''}}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

  window.collectPatientMasterData=async function(){
    const [patients,opdVisits,ipd,sales,diagnostics,diagnosticItems,ipdBills,charges]=await Promise.all([
      safeFetch('patient'),safeFetch('opd_visits'),safeFetch('ipd_admission'),safeFetch('pharmacy_sales'),safeFetch('diagnostic_bills'),safeFetch('diagnostic_bill_items'),safeFetch('ipd_billing'),safeFetch('ipd_daily_charges')
    ]);
    return {patients,opdVisits,ipd,sales,diagnostics,diagnosticItems,ipdBills,charges};
  };

  const originalSearch=window.searchPatients;
  window.searchPatients=async function(){
    const body=document.getElementById('searchRows');
    if(!body)return;
    body.innerHTML="<tr><td colspan='6'><div class='hs-empty hs-loading'>Loading patient records...</div></td></tr>";
    try{
      const data=await collectPatientMasterData();
      const map={};
      const init=p=>({...p,visits:[],pharmacy:[],ipd:[],diagnostics:[],diagnosticItems:[],ipdBills:[],charges:[]});
      data.patients.forEach(p=>{const key=patientKey(p);if(!key)return;map[key]=map[key]?{...map[key],...p}:init(p)});
      function attach(record,bucket){
        let key=Object.keys(map).find(k=>samePatient(record,map[k]));
        if(!key)key=String(record.uhid||record.patient_id||record.mobile||record.patient_name||record.name||record.id||'');
        if(!key)return;
        if(!map[key])map[key]=init({uhid:record.uhid,patient_id:record.patient_id,name:record.patient_name||record.name,patient_name:record.patient_name||record.name,mobile:record.mobile,age:record.age,sex:record.sex||record.gender});
        map[key][bucket].push(record);
      }
      data.opdVisits.forEach(r=>attach(r,'visits'));
      data.ipd.forEach(r=>attach(r,'ipd'));
      data.sales.forEach(r=>attach(r,'pharmacy'));
      data.diagnostics.forEach(r=>attach(r,'diagnostics'));
      data.ipdBills.forEach(r=>attach(r,'ipdBills'));
      data.charges.forEach(r=>attach(r,'charges'));
      const itemsByBill={};data.diagnosticItems.forEach(i=>(itemsByBill[i.bill_no]||(itemsByBill[i.bill_no]=[])).push(i));
      Object.values(map).forEach(p=>{p.diagnostics.forEach(b=>{b.items=itemsByBill[b.bill_no]||[]})});
      patientSearchList=Object.values(map).sort((a,b)=>new Date(lastVisitDate(b)||0)-new Date(lastVisitDate(a)||0));
      window.__patientMasterMap=map;applyPatientSearch();
    }catch(e){console.error(e);if(originalSearch)return originalSearch();body.innerHTML=`<tr><td colspan='6'><div class='hs-empty error'>${esc(e.message)}</div></td></tr>`}
  };

  window.lastVisitDate=function(p){
    const dates=[];
    (p.visits||[]).forEach(r=>dates.push(eventDate(r,['visit_date'])));
    (p.ipd||[]).forEach(r=>dates.push(eventDate(r,['admission_date'])));
    (p.pharmacy||[]).forEach(r=>dates.push(eventDate(r,['bill_date'])));
    (p.diagnostics||[]).forEach(r=>dates.push(eventDate(r,['billing_date'])));
    (p.ipdBills||[]).forEach(r=>dates.push(eventDate(r,['billing_date','discharge_date'])));
    (p.charges||[]).forEach(r=>dates.push(eventDate(r,['charge_date'])));
    if(p.created_at)dates.push(rowDate(p));return dates.filter(Boolean).sort().slice(-1)[0]||'';
  };

  window.openPatientProfile=function(key){
    const p=window.__patientMasterMap?.[key];const el=document.getElementById('patientProfile');
    document.querySelectorAll('#searchRows tr').forEach(row=>row.classList.toggle('selected',row.dataset.patientKey===key));
    if(!p){el.innerHTML="<div class='hs-empty error'>Patient not found.</div>";return}
    const latestVisit=(p.visits||[]).slice().sort((a,b)=>new Date(b.created_at||b.visit_date||0)-new Date(a.created_at||a.visit_date||0))[0];
    const opdTotal=(p.visits||[]).reduce((s,r)=>s+eventAmount(r,['amount','fee']),0);
    const diagTotal=(p.diagnostics||[]).reduce((s,r)=>s+eventAmount(r,['total_amount']),0);
    const pharmTotal=(p.pharmacy||[]).reduce((s,r)=>s+eventAmount(r,['amount_paid','bill_amount']),0);
    const ipdTotal=(p.ipdBills||[]).reduce((s,r)=>s+eventAmount(r,['total','grand_total','net_amount']),0)||(p.ipd||[]).reduce((s,r)=>s+eventAmount(r,['advance','total']),0);
    const events=[];
    (p.visits||[]).forEach(r=>events.push(timelineItem('opd','OPD Visit',[r.consultant,r.department,r.visit_type].filter(Boolean).join(' · '),eventDate(r,['visit_date']),eventAmount(r,['amount','fee']),r.status)));
    (p.ipd||[]).forEach(r=>events.push(timelineItem('ipd','IPD Admission',[r.admission_id,r.ward,r.bed_no,r.consultant].filter(Boolean).join(' · '),eventDate(r,['admission_date']),eventAmount(r,['advance']),r.status||'Admitted')));
    (p.diagnostics||[]).forEach(r=>events.push(timelineItem('diagnostic','Diagnostics',[(r.items||[]).map(i=>i.test_name).filter(Boolean).join(', ')||r.billing_type,r.bill_no].filter(Boolean).join(' · '),eventDate(r,['billing_date']),eventAmount(r,['total_amount']),r.status||'Billed')));
    (p.pharmacy||[]).forEach(r=>events.push(timelineItem('pharmacy','Pharmacy Purchase',[r.bill_no,r.payment_mode].filter(Boolean).join(' · '),eventDate(r,['bill_date']),eventAmount(r,['amount_paid','bill_amount']),r.status||'Paid')));
    (p.ipdBills||[]).forEach(r=>events.push(timelineItem('payment','IPD Final Payment',[r.bill_no,r.payment_mode].filter(Boolean).join(' · '),eventDate(r,['billing_date','discharge_date']),eventAmount(r,['total','grand_total','net_amount']),r.status||'Billed')));
    (p.charges||[]).forEach(r=>{
      const category=String(r.category||'').toLowerCase();
      const isProcedure=/procedure|surgery|operation|ot|nursing|doctor|room|bed/.test(category+' '+String(r.description||''));
      events.push(timelineItem(isProcedure?'procedure':'payment',isProcedure?'Procedure / Charge':'IPD Charge',[r.category,r.description].filter(Boolean).join(' · '),eventDate(r,['charge_date']),eventAmount(r,['amount']),r.status));
    });
    events.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
    const total=opdTotal+diagTotal+pharmTotal+ipdTotal;
    const counts={opd:(p.visits||[]).length,ipd:(p.ipd||[]).length,diagnostic:(p.diagnostics||[]).length,pharmacy:(p.pharmacy||[]).length,procedure:(p.charges||[]).length};
    el.innerHTML=`
      <div class="hs-profile-head"><div class="hs-avatar">${esc(patientInitials(p))}</div><div class="hs-profile-head-main"><h3>${esc(patientName(p)||'Patient')}</h3><p>${esc(patientUHID(p)||'-')} &nbsp; <span class="hs-status active">ACTIVE</span></p></div><button class="hs-profile-close" onclick="closePatientProfile()" aria-label="Close profile">×</button></div>
      <div class="hs-info-card"><div class="hs-info-title">Patient Information</div><div class="hs-info-grid">
        <div class="hs-info-item"><span>Age / Sex</span><strong>${esc(p.age||'-')} / ${esc(patientSex(p)||'-')}</strong></div>
        <div class="hs-info-item"><span>Department</span><strong>${esc(latestVisit?.department||p.department||'-')}</strong></div>
        <div class="hs-info-item"><span>Mobile</span><strong>${esc(p.mobile||'-')}</strong></div>
        <div class="hs-info-item"><span>Alternate Mobile</span><strong>${esc(p.alternate_mobile||p.alt_mobile||'-')}</strong></div>
        <div class="hs-info-item"><span>Address</span><strong>${esc(p.address||'-')}</strong></div>
        <div class="hs-info-item"><span>Last Activity</span><strong>${esc(lastVisitDate(p)||'-')}</strong></div>
      </div></div>
      <div class="hs-metrics hs-360-metrics"><div class="hs-metric"><span>OPD</span><strong>${counts.opd}</strong></div><div class="hs-metric"><span>IPD</span><strong>${counts.ipd}</strong></div><div class="hs-metric"><span>Diagnostics</span><strong>${counts.diagnostic}</strong></div><div class="hs-metric"><span>Pharmacy</span><strong>${counts.pharmacy}</strong></div><div class="hs-metric"><span>Procedures</span><strong>${counts.procedure}</strong></div><div class="hs-metric"><span>Total Billing</span><strong>${money(total)}</strong></div></div>
      <div class="hs-section hs-360-section"><h4>Patient 360° Timeline <span>${events.length} activities</span></h4><div class="hs-timeline">${events.length?events.slice(0,30).map(e=>`<div class="hs-timeline-item ${e.type}"><div class="hs-timeline-dot"></div><div class="hs-timeline-body"><div class="hs-timeline-top"><strong>${esc(e.title)}</strong><time>${esc(e.date||'-')}</time></div><p>${esc(e.detail||'No additional details')}</p><div class="hs-timeline-foot">${e.status?`<span class="hs-status active">${esc(e.status)}</span>`:''}${e.amount?`<b>${money(e.amount)}</b>`:''}</div></div></div>`).join(''):'<div class="hs-empty">No clinical or billing activity found.</div>'}</div></div>`;
  };
})();