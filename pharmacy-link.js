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
  document.getElementById('phPatientSearch').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();importPatientForPharmacy()}};
}

async function importPatientForPharmacy(){
  const source=document.getElementById('phPatientSource').value;
  const q=document.getElementById('phPatientSearch').value.trim();
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
    const rows=(await fetchAll('ipd_admission')).filter(r=>!['discharged','final billed','cancelled','closed'].includes(String(r.status||'Admitted').trim().toLowerCase()));
    const matches=filterPatientChoices(rows,q,['admission_id','id','uhid','patient_name','mobile']);
    if(!matches.length){msg.innerHTML="<p class='error'>No active IPD admission found.</p>";return;}
    renderPatientChoices(msg,matches,{recordLabel:'active admission',detailLabel:'Admission / Ward',detailValue:r=>[r.admission_id||r.id,[r.ward_type,r.bed_no].filter(Boolean).join(' / ')].filter(Boolean).join(' · ')},a=>selectLinkedPharmacyPatient(a,'IPD',msg));
  }else{
    const matches=filterPatientChoices(await fetchAll('opd_visits'),q,['visit_id','uhid','patient_name','mobile']);
    if(!matches.length){msg.innerHTML="<p class='error'>No OPD visit found.</p>";return;}
    renderPatientChoices(msg,matches,{recordLabel:'OPD visit',detailLabel:'Visit / Date',detailValue:r=>[r.visit_id,r.visit_date||rowDate(r)].filter(Boolean).join(' · ')},v=>selectLinkedPharmacyPatient(v,'OPD',msg));
  }
}

function selectLinkedPharmacyPatient(record,type,msg){
  if(type==='IPD'){
    const a=record;
    window.currentPharmacyPatient={type:'IPD',admission_id:a.admission_id||String(a.id),uhid:a.uhid||'',patient_name:a.patient_name||''};
    document.getElementById('billPatientName').value=a.patient_name||'';
    document.getElementById('billPatientType').value='IPD';
    document.getElementById('billPaymentStatus').value='Due';
    document.getElementById('billAmountPaid').value=0;
    msg.innerHTML=`<div class='sync-box'><b>IPD patient imported</b><br>${escapePatientChoice(a.patient_name||'')} · ${escapePatientChoice(a.uhid||'')} · ${escapePatientChoice(a.admission_id||'')}</div>`;
  }else{
    const v=record;
    window.currentPharmacyPatient={type:'OPD',visit_id:v.visit_id||'',uhid:v.uhid||'',patient_name:v.patient_name||''};
    document.getElementById('billPatientName').value=v.patient_name||'';
    document.getElementById('billPatientType').value='OPD';
    msg.innerHTML=`<div class='sync-box'><b>OPD patient imported</b><br>${escapePatientChoice(v.patient_name||'')} · ${escapePatientChoice(v.uhid||'')} · ${escapePatientChoice(v.visit_id||'')}</div>`;
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
