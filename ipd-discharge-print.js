(()=>{
  if(window.__ipdDischargePrintLoaded)return;
  window.__ipdDischargePrintLoaded=true;

  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const has=value=>String(value??"").trim()!=="";

  const style=document.createElement('style');
  style.textContent=`.ipd-clinical-discharge-box{margin-top:14px;padding-top:12px;border-top:1px solid #d9e2e8;display:flex;gap:10px;align-items:center;flex-wrap:wrap}.ipd-clinical-discharge-box .status{font-size:12px;color:#667085}`;
  document.head.appendChild(style);

  function meta(label,value){return has(value)?`<div><b>${esc(label)}</b>${esc(value)}</div>`:""}
  function section(label,value,full=false){return has(value)?`<div class="p-section ${full?'full':''}"><b>${esc(label)}</b>${esc(value)}</div>`:""}

  function openStandalonePrint(content){
    const w=window.open('', '_blank');
    if(!w){alert('Please allow pop-ups for printing.');return}
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Discharge Summary</title><style>
      @page{size:A4 portrait;margin:10mm 11mm 11mm}
      *{box-sizing:border-box}
      html,body{margin:0;padding:0;background:#fff;height:auto;min-height:0}
      body{font-family:Arial,Helvetica,sans-serif;color:#151515;font-size:11pt;line-height:1.34}
      .sheet{display:block;width:100%;margin:0;padding:0;page-break-after:avoid;break-after:avoid-page}
      .p-head{text-align:center;border-bottom:2.2px solid #111;padding:2mm 0 3mm;margin-bottom:3mm}
      .p-head h1{font-size:20pt;line-height:1.05;letter-spacing:.4px;margin:0;font-weight:800}
      .p-head h2{font-size:13pt;line-height:1.1;letter-spacing:.8px;margin:1.5mm 0 0;font-weight:700}
      .p-meta{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #aeb4ba;border-radius:2mm;overflow:hidden;margin-bottom:3.5mm}
      .p-meta>div{min-height:14mm;padding:2.3mm 2.5mm;border-right:1px solid #d3d6da;border-bottom:1px solid #d3d6da}
      .p-meta>div:nth-child(4n){border-right:0}
      .p-meta>div:nth-last-child(-n+4){border-bottom:0}
      .p-meta b{display:block;font-size:8.5pt;line-height:1.05;text-transform:uppercase;letter-spacing:.25px;color:#4b5055;margin-bottom:1.2mm}
      .p-grid{display:grid;grid-template-columns:1fr 1fr;gap:3mm}
      .p-section{break-inside:avoid;page-break-inside:avoid;border:1px solid #c8ccd0;border-radius:1.7mm;padding:2.5mm 3mm;min-height:17mm;white-space:pre-wrap;background:#fff}
      .p-section.full{grid-column:1/-1;min-height:16mm}
      .p-section b{display:block;font-size:9pt;line-height:1.05;text-transform:uppercase;letter-spacing:.3px;margin:-2.5mm -3mm 2mm;padding:1.7mm 3mm;background:#f0f1f2;border-bottom:1px solid #c8ccd0}
      .p-footer{display:flex;justify-content:space-between;align-items:flex-end;gap:10mm;border-top:1.5px solid #555;margin-top:5mm;padding-top:3mm;font-size:10pt;page-break-after:avoid;break-after:avoid-page}
      .p-footer>div:first-child{min-width:65mm;padding-top:5mm}
      @media print{html,body,.sheet{height:auto!important;min-height:0!important;overflow:visible!important}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body><div class="sheet">${content}</div><script>window.onload=function(){setTimeout(function(){window.print()},120)};<\/script></body></html>`);
    w.document.close();
  }

  async function getClinicalDischarge(admission){
    if(!admission)return null;
    let result=await db.from('doctor_discharge_summaries').select('*').eq('ipd_admission_id',admission.id).maybeSingle();
    if(result.error)throw result.error;
    if(result.data)return result.data;
    const admissionId=admission.admission_id||String(admission.id||'');
    if(admissionId){result=await db.from('doctor_discharge_summaries').select('*').eq('admission_id',admissionId).maybeSingle();if(result.error)throw result.error}
    return result.data||null;
  }

  async function renderIPDClinicalDischargeAction(){
    const host=document.getElementById('ipdAdmissionSummary');
    const admission=(typeof ipdBillingState!=='undefined')?ipdBillingState.admission:null;
    if(!host||!admission)return;
    host.querySelector('.ipd-clinical-discharge-box')?.remove();
    const box=document.createElement('div');box.className='ipd-clinical-discharge-box';box.innerHTML='<span class="status">Checking doctor discharge summary...</span>';host.appendChild(box);
    try{
      const discharge=await getClinicalDischarge(admission);
      if(!discharge){box.innerHTML='<span class="status">Doctor discharge summary: Not prepared</span>';return}
      if(discharge.status!=='Finalized'){box.innerHTML=`<span class="status">Doctor discharge summary: ${esc(discharge.status||'Draft')} — finalization required before staff printing.</span>`;return}
      box.innerHTML=`<button type="button" id="printClinicalDischargeBtn">Print Discharge Summary</button><span class="status">Finalized by ${esc(discharge.doctor_name||'Doctor')}</span>`;
      box.querySelector('#printClinicalDischargeBtn').onclick=()=>window.printIPDClinicalDischarge(admission,discharge);
    }catch(error){box.innerHTML=`<span class="status" style="color:#b42318">Unable to load doctor discharge: ${esc(error.message)}</span>`}
  }

  window.printIPDClinicalDischarge=function(admission,discharge){
    const fields=[
      ['Final Diagnosis',discharge.final_diagnosis,true],
      ['Presenting Complaints / History',discharge.presenting_history,true],
      ['Examination Findings',discharge.examination_findings,false],
      ['Important Investigations',discharge.important_investigations,false],
      ['Surgery / Procedure',discharge.procedure_performed,false],
      ['Intra-operative Findings',discharge.intraoperative_findings,true],
      ['Hospital Stay',discharge.hospital_course,true],
      ['Condition at Discharge',discharge.condition_at_discharge,false],
      ['Treatment Given',discharge.treatment_given,false],
      ['Discharge Medicines',discharge.discharge_medicines,true],
      ['Diet / Activity Advice',discharge.diet_activity_advice,false],
      ['Wound / Dressing Advice',discharge.wound_dressing_advice,false],
      ['Follow-up',discharge.follow_up,false],
      ['Warning Signs / When to Return',discharge.warning_signs,true]
    ];
    const content=`<div class="p-head"><h1>REVIVE HOSPITAL</h1><h2>DISCHARGE SUMMARY</h2></div><div class="p-meta">${meta('Patient',admission.patient_name)}${meta('UHID',admission.uhid)}${meta('Admission ID',admission.admission_id||admission.id)}${meta('Age / Sex',[admission.age,admission.sex].filter(Boolean).join(' / '))}${meta('Ward / Bed',[admission.ward_type,admission.bed_no].filter(Boolean).join(' / '))}${meta('Admission',admission.admission_date||'')}${meta('Consultant',discharge.doctor_name||admission.doctor||admission.consultant)}${meta('Status','Finalized')}</div><div class="p-grid">${fields.map(f=>section(f[0],f[1],f[2])).join('')}</div><div class="p-footer"><div><b>Consultant:</b> ${esc(discharge.doctor_name||admission.doctor||admission.consultant||'')}</div><div>Revive HealthScope</div></div>`;
    openStandalonePrint(content);
  };

  const originalRender=window.renderIPDAdmissionSummary;
  if(typeof originalRender==='function'){
    window.renderIPDAdmissionSummary=function(){const result=originalRender.apply(this,arguments);Promise.resolve(result).finally(()=>setTimeout(renderIPDClinicalDischargeAction,0));return result}
  }
})();