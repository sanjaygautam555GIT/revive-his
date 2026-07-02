async function renderPharmacyBillingLinked(){
  await renderPharmacyBilling();
  const firstPanel=document.querySelector('#pharmacyBillingView .panel');
  if(!firstPanel)return;
  firstPanel.insertAdjacentHTML('afterbegin',`
    <div style="margin-bottom:14px">
      <h3>Import Patient</h3>
      <div class="grid" style="grid-template-columns:1fr 2fr auto">
        <div><label>Source</label><select id="phPatientSource"><option>Walk-in</option><option>OPD</option><option>IPD</option></select></div>
        <div><label>Search</label><input id="phPatientSearch" placeholder="Name / mobile / UHID / visit ID / admission ID"></div>
        <div><label>&nbsp;</label><button type="button" id="phImportBtn">Import</button></div>
      </div>
      <div id="phPatientMsg"></div>
    </div><hr>`);
  window.currentPharmacyPatient=null;
  document.getElementById('phImportBtn').onclick=importPatientForPharmacy;
  document.getElementById('phPatientSearch').onkeydown=e=>{if(e.key==='Enter')importPatientForPharmacy()};
}

async function importPatientForPharmacy(){
  const source=document.getElementById('phPatientSource').value;
  const q=document.getElementById('phPatientSearch').value.trim().toLowerCase();
  const msg=document.getElementById('phPatientMsg');
  window.currentPharmacyPatient=null;
  if(source==='Walk-in'){
    document.getElementById('billPatientName').value='Walk-in';
    document.getElementById('billPatientType').value='Walk-in';
    msg.innerHTML="<p class='success'>Walk-in selected.</p>";
    return;
  }
  if(!q){msg.innerHTML="<p class='error'>Enter search text.</p>";return;}
  if(source==='IPD'){
    const rows=await fetchAll('ipd_admission');
    const a=rows.find(r=>(r.status||'Admitted')!=='Discharged' && [r.admission_id,r.uhid,r.patient_name,r.mobile].join(' ').toLowerCase().includes(q));
    if(!a){msg.innerHTML="<p class='error'>No active IPD admission found.</p>";return;}
    window.currentPharmacyPatient={type:'IPD',admission_id:a.admission_id||String(a.id),uhid:a.uhid||'',patient_name:a.patient_name||''};
    document.getElementById('billPatientName').value=a.patient_name||'';
    document.getElementById('billPatientType').value='IPD';
    document.getElementById('billPaymentStatus').value='Due';
    document.getElementById('billAmountPaid').value=0;
    msg.innerHTML=`<div class='sync-box'><b>IPD patient imported</b><br>${a.patient_name||''} · ${a.uhid||''} · ${a.admission_id||''}</div>`;
  }else{
    const rows=await fetchAll('opd_visits');
    const v=rows.find(r=>[r.visit_id,r.uhid,r.patient_name,r.mobile].join(' ').toLowerCase().includes(q));
    if(!v){msg.innerHTML="<p class='error'>No OPD visit found.</p>";return;}
    window.currentPharmacyPatient={type:'OPD',visit_id:v.visit_id||'',uhid:v.uhid||'',patient_name:v.patient_name||''};
    document.getElementById('billPatientName').value=v.patient_name||'';
    document.getElementById('billPatientType').value='OPD';
    msg.innerHTML=`<div class='sync-box'><b>OPD patient imported</b><br>${v.patient_name||''} · ${v.uhid||''} · ${v.visit_id||''}</div>`;
  }
}

const oldSavePharmacyBill=savePharmacyBill;
savePharmacyBill=async function(){
  const before=window.currentPharmacyPatient;
  await oldSavePharmacyBill();
  if(before?.type==='IPD'){
    const sales=await fetchAll('pharmacy_sales');
    const last=(sales||[]).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
    if(last){
      await db.from('ipd_daily_charges').insert([{admission_id:before.admission_id,uhid:before.uhid,patient_name:before.patient_name,charge_date:todayISO(),category:'Pharmacy Charge',description:`Pharmacy Bill PH-${last.id}`,rate:last.bill_amount||0,quantity:1,amount:last.bill_amount||0,created_at:new Date().toISOString()}]);
    }
  }
}
