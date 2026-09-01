(()=>{
  if(window.__doctorDischargeCompactLoaded)return;
  window.__doctorDischargeCompactLoaded=true;

  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const has=value=>String(value??"").trim()!=="";

  const style=document.createElement("style");
  style.textContent=`
    .doctor-final-summary{padding:18px}
    .doctor-final-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;border-bottom:2px solid #0f8f87;padding-bottom:10px;margin-bottom:12px}
    .doctor-final-head h3{margin:0 0 3px}.doctor-final-head p{margin:0;color:#667085}
    .doctor-final-patient{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
    .doctor-final-patient div{padding:8px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px}
    .doctor-final-patient span,.doctor-final-section span{display:block;color:#667085;font-size:11px;font-weight:700;text-transform:uppercase;margin-bottom:3px}
    .doctor-final-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
    .doctor-final-section{border:1px solid #e5e7eb;border-radius:8px;padding:9px;white-space:pre-wrap;line-height:1.35}
    .doctor-final-section.full{grid-column:1/-1}
    .doctor-final-actions{display:flex;justify-content:flex-end;margin-top:14px}
    @media(max-width:700px){.doctor-final-patient{grid-template-columns:1fr 1fr}.doctor-final-grid{grid-template-columns:1fr}.doctor-final-section.full{grid-column:auto}}
  `;
  document.head.appendChild(style);

  function section(label,value,full=false){if(!has(value))return "";return `<div class="doctor-final-section ${full?'full':''}"><span>${esc(label)}</span>${esc(value)}</div>`}
  function printSection(label,value,full=false){if(!has(value))return "";return `<div class="p-section ${full?'full':''}"><b>${esc(label)}</b>${esc(value)}</div>`}
  function meta(label,value){return has(value)?`<div><b>${esc(label)}</b>${esc(value)}</div>`:""}

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

  const originalDoctorDischargeForm=window.doctorDischargeForm;
  window.doctorDischargeForm=function(a,d){
    const locked=d?.status==="Finalized";
    if(!locked)return originalDoctorDischargeForm(a,d);
    const fields=[
      ["Final Diagnosis",d.final_diagnosis,true],
      ["Presenting Complaints / History",d.presenting_history,true],
      ["Examination Findings",d.examination_findings,false],
      ["Important Investigations",d.important_investigations,false],
      ["Surgery / Procedure",d.procedure_performed,false],
      ["Intra-operative Findings",d.intraoperative_findings,true],
      ["Hospital Stay",d.hospital_course,true],
      ["Condition at Discharge",d.condition_at_discharge,false],
      ["Treatment Given",d.treatment_given,false],
      ["Discharge Medicines",d.discharge_medicines,true],
      ["Diet / Activity Advice",d.diet_activity_advice,false],
      ["Wound / Dressing Advice",d.wound_dressing_advice,false],
      ["Follow-up",d.follow_up,false],
      ["Warning Signs / When to Return",d.warning_signs,true]
    ];
    return `<div class="panel doctor-final-summary"><div class="doctor-final-head"><div><h3>Discharge Summary</h3><p>${esc(a.patient_name||"Patient")}</p></div><span class="doctor-status finalized">Finalized</span></div><div class="doctor-final-patient">${meta("UHID",a.uhid)}${meta("Age / Sex",[a.age,a.sex].filter(Boolean).join(" / "))}${meta("Ward / Bed",[a.ward_type,a.bed_no].filter(Boolean).join(" / "))}${meta("Admission",a.admission_date||"")}</div><div class="doctor-final-grid">${fields.map(f=>section(f[0],f[1],f[2])).join("")}</div><div class="doctor-final-actions"><button type="button" onclick="printDoctorDischarge()">Print / Save PDF</button></div></div>`;
  };

  window.printDoctorDischarge=function(){
    const a=doctorPortalState?.selected||{};const d=doctorPortalState?.discharge||{};const doctor=doctorPortalState?.doctor||{};
    const fields=[
      ["Final Diagnosis",d.final_diagnosis,true],
      ["Presenting Complaints / History",d.presenting_history,true],
      ["Examination Findings",d.examination_findings,false],
      ["Important Investigations",d.important_investigations,false],
      ["Surgery / Procedure",d.procedure_performed,false],
      ["Intra-operative Findings",d.intraoperative_findings,true],
      ["Hospital Stay",d.hospital_course,true],
      ["Condition at Discharge",d.condition_at_discharge,false],
      ["Treatment Given",d.treatment_given,false],
      ["Discharge Medicines",d.discharge_medicines,true],
      ["Diet / Activity Advice",d.diet_activity_advice,false],
      ["Wound / Dressing Advice",d.wound_dressing_advice,false],
      ["Follow-up",d.follow_up,false],
      ["Warning Signs / When to Return",d.warning_signs,true]
    ];
    const content=`<div class="p-head"><h1>REVIVE HOSPITAL</h1><h2>DISCHARGE SUMMARY</h2></div><div class="p-meta">${meta("Patient",a.patient_name)}${meta("UHID",a.uhid)}${meta("Admission ID",a.admission_id||a.id)}${meta("Age / Sex",[a.age,a.sex].filter(Boolean).join(" / "))}${meta("Ward / Bed",[a.ward_type,a.bed_no].filter(Boolean).join(" / "))}${meta("Admission",a.admission_date||"")}${meta("Consultant",doctor.doctor_name||d.doctor_name)}${meta("Status",d.status)}</div><div class="p-grid">${fields.map(f=>printSection(f[0],f[1],f[2])).join("")}</div><div class="p-footer"><div><b>Consultant:</b> ${esc(doctor.doctor_name||d.doctor_name||"")}</div><div>Revive HealthScope</div></div>`;
    openStandalonePrint(content);
  };
})();