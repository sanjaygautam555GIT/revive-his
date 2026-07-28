// Aligns Patient Search profile fields with the actual OPD data model.
(function(){
  function latestOPDVisit(patient){
    return (patient?.visits||[]).slice().sort((a,b)=>new Date(b.created_at||b.visit_date||0)-new Date(a.created_at||a.visit_date||0))[0]||null;
  }

  window.openPatientProfile=function(key){
    const p=window.__patientMasterMap?.[key];
    const el=document.getElementById("patientProfile");
    document.querySelectorAll("#searchRows tr").forEach(row=>row.classList.toggle("selected",row.dataset.patientKey===key));
    if(!p){if(el)el.innerHTML="<div class='hs-empty error'>Patient not found.</div>";return;}

    const opdRevenue=(p.visits||[]).reduce((s,v)=>s+safeNumber(v.amount),0);
    const pharmacyRevenue=(p.pharmacy||[]).reduce((s,v)=>s+safeNumber(v.amount_paid||v.bill_amount),0);
    const ipdRevenue=(p.ipd||[]).reduce((s,v)=>s+safeNumber(v.advance||v.total),0);
    const total=opdRevenue+pharmacyRevenue+ipdRevenue;
    const visits=(p.visits||[]).slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,5);
    const latest=latestOPDVisit(p);
    const department=latest?.department||p.department||"-";
    const lastVisit=latest?.visit_date||lastVisitDate(p)||"-";

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
          <div class="hs-info-item"><span>Department</span><strong>${department}</strong></div>
          <div class="hs-info-item"><span>Mobile</span><strong>${p.mobile||"-"}</strong></div>
          <div class="hs-info-item"><span>Alternate Mobile</span><strong>${p.alternate_mobile||p.alt_mobile||"-"}</strong></div>
          <div class="hs-info-item"><span>Address</span><strong>${p.address||"-"}</strong></div>
          <div class="hs-info-item"><span>Last Visit</span><strong>${lastVisit}</strong></div>
        </div>
      </div>
      <div class="hs-metrics">
        <div class="hs-metric"><span>Total Visits</span><strong>${(p.visits||[]).length+(p.ipd||[]).length}</strong></div>
        <div class="hs-metric"><span>OPD Visits</span><strong>${(p.visits||[]).length}</strong></div>
        <div class="hs-metric"><span>IPD Admissions</span><strong>${(p.ipd||[]).length}</strong></div>
        <div class="hs-metric"><span>Total Billing</span><strong>${money(total)}</strong></div>
      </div>
      <div class="hs-section"><h4>Recent OPD Visits</h4><table class="hs-mini-table"><thead><tr><th>Date</th><th>Doctor</th><th>Department</th><th>Amount</th></tr></thead><tbody>${visits.length?visits.map(v=>`<tr><td>${v.visit_date||rowDate(v)||"-"}</td><td>${v.consultant||"-"}</td><td>${v.department||"-"}</td><td>${money(v.amount||0)}</td></tr>`).join(""):"<tr><td colspan='4'>No OPD visits.</td></tr>"}</tbody></table></div>`;
  };
})();
