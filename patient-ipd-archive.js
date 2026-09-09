// Archived IPD documents shown from Patient Search after discharge.
(function(){
  if(window.__patientIPDArchiveLoaded)return;
  window.__patientIPDArchiveLoaded=true;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').trim();
  const discharged=a=>['discharged','final billed','closed'].includes(norm(a?.status||'').toLowerCase());
  const admissionKey=a=>norm(a?.admission_id||a?.id);

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const found=document.querySelector(`script[src^="${src}"]`);
      if(found){if(window.printIPDClinicalDischarge||src!=='ipd-discharge-print.js')resolve();else found.addEventListener('load',resolve,{once:true});return;}
      const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.body.appendChild(s);
    });
  }

  function openPrint(title,body){
    const w=window.open('','_blank');
    if(!w){alert('Please allow pop-ups for printing.');return;}
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172033;margin:0;font-size:12px}.head{border-bottom:3px solid #0f766e;padding-bottom:10px;margin-bottom:14px;display:flex;justify-content:space-between}.brand{font-size:24px;font-weight:800}.sub{color:#64748b}.title{text-align:center;font-size:21px;font-weight:800;margin:10px 0 16px}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}.meta div{border:1px solid #cbd5e1;border-radius:7px;padding:8px}.meta span{display:block;font-size:10px;color:#64748b;text-transform:uppercase}.meta strong{display:block;margin-top:3px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.summary div{border:1px solid #cbd5e1;padding:9px;border-radius:7px}.summary span{display:block;color:#64748b;font-size:10px;text-transform:uppercase}.summary strong{font-size:15px}table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#0f766e;color:white;text-align:left;padding:8px}td{border:1px solid #d7dee7;padding:7px}.right{text-align:right}.foot{margin-top:28px;border-top:1px solid #d7dee7;padding-top:10px;display:flex;justify-content:space-between;color:#64748b}@media print{button{display:none}}</style></head><body>${body}<script>window.onload=()=>setTimeout(()=>window.print(),150);<\/script></body></html>`);
    w.document.close();
  }

  async function fetchBill(admission){
    const key=admissionKey(admission);
    const {data,error}=await db.from('ipd_billing').select('*').eq('admission_id',key).order('created_at',{ascending:false}).limit(1);
    if(error)throw error;
    return (data||[])[0]||null;
  }

  window.printArchivedIPDBill=async function(admissionId){
    try{
      const {data:admission,error:aerr}=await db.from('ipd_admission').select('*').eq('id',admissionId).single();
      if(aerr)throw aerr;
      const bill=await fetchBill(admission);
      if(!bill){alert('No saved final bill was found for this admission.');return;}
      const {data:items,error:ierr}=await db.from('ipd_bill_items').select('*').eq('bill_id',bill.bill_id).order('created_at',{ascending:true});
      if(ierr)throw ierr;
      const rows=(items||[]).map(i=>`<tr><td>${esc(i.category||'')}</td><td>${esc(i.description||'')}</td><td class="right">${esc(i.quantity||1)}</td><td class="right">${money(i.rate||0)}</td><td class="right">${money(i.amount||0)}</td></tr>`).join('');
      const body=`<div class="head"><div><div class="brand">REVIVE HOSPITAL</div><div class="sub">Azamgarh, Uttar Pradesh</div></div><div class="sub">Duplicate / Reprint</div></div><div class="title">IPD FINAL BILL</div><div class="meta"><div><span>Patient</span><strong>${esc(admission.patient_name)}</strong></div><div><span>UHID</span><strong>${esc(admission.uhid)}</strong></div><div><span>Admission ID</span><strong>${esc(admission.admission_id||admission.id)}</strong></div><div><span>Bill ID</span><strong>${esc(bill.bill_id)}</strong></div><div><span>Admission Date</span><strong>${esc(admission.admission_date||'')}</strong></div><div><span>Discharge / Bill Date</span><strong>${esc(bill.billing_date||admission.discharge_date||'')}</strong></div><div><span>Consultant</span><strong>${esc(admission.doctor||admission.consultant||'')}</strong></div><div><span>Ward / Bed</span><strong>${esc([admission.ward_type,admission.bed_no].filter(Boolean).join(' / '))}</strong></div></div><table><thead><tr><th>Category</th><th>Description</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead><tbody>${rows||'<tr><td colspan="5">No item details saved.</td></tr>'}</tbody></table><div class="summary"><div><span>Gross Bill</span><strong>${money(bill.gross_total??bill.total??0)}</strong></div><div><span>Advance</span><strong>${money(bill.advance||0)}</strong></div><div><span>Final Payment</span><strong>${money(bill.final_payment||0)}</strong></div><div><span>Net Bill</span><strong>${money(bill.total||0)}</strong></div></div><div class="foot"><span>Computer generated duplicate bill</span><span>Revive HealthScope</span></div>`;
      openPrint('IPD Final Bill - '+(bill.bill_id||''),body);
    }catch(e){alert('Unable to print old bill: '+e.message);}
  };

  window.printArchivedDischargeSummary=async function(admissionId){
    try{
      const {data:admission,error:aerr}=await db.from('ipd_admission').select('*').eq('id',admissionId).single();
      if(aerr)throw aerr;
      let result=await db.from('doctor_discharge_summaries').select('*').eq('ipd_admission_id',admission.id).maybeSingle();
      if(result.error)throw result.error;
      let summary=result.data;
      if(!summary){result=await db.from('doctor_discharge_summaries').select('*').eq('admission_id',admission.admission_id||String(admission.id)).maybeSingle();if(result.error)throw result.error;summary=result.data;}
      if(!summary){alert('No discharge summary is saved for this admission.');return;}
      if(String(summary.status||'').toLowerCase()!=='finalized'){alert('The discharge summary exists but is not finalized.');return;}
      if(typeof window.printIPDClinicalDischarge!=='function')await loadScript('ipd-discharge-print.js?v=20260909-archive');
      if(typeof window.printIPDClinicalDischarge!=='function')throw new Error('Discharge print module could not be loaded.');
      window.printIPDClinicalDischarge(admission,summary);
    }catch(e){alert('Unable to print discharge summary: '+e.message);}
  };

  window.renderPatientIPDArchive=async function(key){
    const p=window.__patientMasterMap?.[key];
    const host=document.getElementById('patientProfile');
    if(!p||!host)return;
    host.querySelector('#patientOldIPDDocuments')?.remove();
    const section=document.createElement('div');section.id='patientOldIPDDocuments';section.className='hs-section';section.innerHTML='<h4>Previous IPD Documents</h4><div class="hs-empty hs-loading">Loading old bills and discharge summaries...</div>';host.appendChild(section);
    try{
      const admissions=(p.ipd||[]).filter(discharged).slice().sort((a,b)=>new Date(b.discharge_date||b.created_at||0)-new Date(a.discharge_date||a.created_at||0));
      if(!admissions.length){section.innerHTML='<h4>Previous IPD Documents</h4><div class="hs-empty">No discharged IPD admission found.</div>';return;}
      const admissionIds=admissions.map(a=>admissionKey(a));
      const [{data:bills,error:berr},{data:summaries,error:serr}]=await Promise.all([
        db.from('ipd_billing').select('*').in('admission_id',admissionIds),
        db.from('doctor_discharge_summaries').select('*').in('admission_id',admissionIds)
      ]);
      if(berr)throw berr;
      const summaryRows=serr?[]:(summaries||[]);
      section.innerHTML=`<h4>Previous IPD Documents</h4><table class="hs-mini-table"><thead><tr><th>Admission</th><th>Dates</th><th>Diagnosis</th><th>Documents</th></tr></thead><tbody>${admissions.map(a=>{
        const keyA=admissionKey(a);const bill=(bills||[]).find(b=>norm(b.admission_id)===keyA);const summary=summaryRows.find(s=>norm(s.admission_id)===keyA||String(s.ipd_admission_id||'')===String(a.id));
        return `<tr><td><strong>${esc(a.admission_id||a.id)}</strong><br>${esc(a.ward_type||'')} ${esc(a.bed_no||'')}</td><td>${esc(a.admission_date||'')}<br>to ${esc(a.discharge_date||'-')}</td><td>${esc(a.diagnosis||'-')}</td><td>${bill?`<button type="button" class="hs-btn hs-btn-secondary" onclick="printArchivedIPDBill(${Number(a.id)})">Print Old Bill</button>`:'<span class="hs-status">Bill not found</span>'} ${summary&&String(summary.status||'').toLowerCase()==='finalized'?`<button type="button" class="hs-btn hs-btn-secondary" onclick="printArchivedDischargeSummary(${Number(a.id)})">Print Discharge Summary</button>`:'<span class="hs-status">Discharge summary unavailable</span>'}</td></tr>`;
      }).join('')}</tbody></table>`;
    }catch(e){section.innerHTML=`<h4>Previous IPD Documents</h4><div class="hs-empty error">Unable to load previous IPD documents: ${esc(e.message)}</div>`;}
  };
})();
