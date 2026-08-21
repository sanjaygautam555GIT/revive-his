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
    #doctorCompactPrint{display:none}
    @media(max-width:700px){.doctor-final-patient{grid-template-columns:1fr 1fr}.doctor-final-grid{grid-template-columns:1fr}.doctor-final-section.full{grid-column:auto}}
    @media print{
      @page{size:A4 portrait;margin:7mm}
      body.doctor-compact-print *{visibility:hidden!important}
      body.doctor-compact-print #doctorCompactPrint,
      body.doctor-compact-print #doctorCompactPrint *{visibility:visible!important}
      body.doctor-compact-print #doctorCompactPrint{display:block!important;position:absolute;left:0;top:0;width:100%;font-family:Arial,sans-serif;color:#111;font-size:9px;line-height:1.18}
      body.doctor-compact-print #doctorCompactPrint .p-head{text-align:center;border-bottom:1.5px solid #111;padding-bottom:4px;margin-bottom:5px}
      body.doctor-compact-print #doctorCompactPrint .p-head h1{font-size:15px;margin:0}.p-head h2{font-size:11px;margin:2px 0 0}
      body.doctor-compact-print #doctorCompactPrint .p-meta{display:grid;grid-template-columns:repeat(4,1fr);gap:3px 8px;border-bottom:1px solid #777;padding-bottom:4px;margin-bottom:5px}
      body.doctor-compact-print #doctorCompactPrint .p-meta div{margin:0}.p-meta b{display:block;font-size:8px;text-transform:uppercase;color:#444;margin-bottom:1px}
      body.doctor-compact-print #doctorCompactPrint .p-grid{display:grid;grid-template-columns:1fr 1fr;gap:3px 8px}
      body.doctor-compact-print #doctorCompactPrint .p-section{break-inside:avoid;border-bottom:1px solid #ddd;padding:2px 0;white-space:pre-wrap}
      body.doctor-compact-print #doctorCompactPrint .p-section.full{grid-column:1/-1}
      body.doctor-compact-print #doctorCompactPrint .p-section b{display:block;font-size:8px;text-transform:uppercase;margin-bottom:1px}
      body.doctor-compact-print #doctorCompactPrint .p-footer{display:flex;justify-content:space-between;gap:10px;border-top:1px solid #777;margin-top:5px;padding-top:4px}
    }
  `;
  document.head.appendChild(style);

  function section(label,value,full=false){
    if(!has(value))return "";
    return `<div class="doctor-final-section ${full?'full':''}"><span>${esc(label)}</span>${esc(value)}</div>`;
  }
  function printSection(label,value,full=false){
    if(!has(value))return "";
    return `<div class="p-section ${full?'full':''}"><b>${esc(label)}</b>${esc(value)}</div>`;
  }
  function meta(label,value){return has(value)?`<div><b>${esc(label)}</b>${esc(value)}</div>`:""}

  const originalDoctorDischargeForm=window.doctorDischargeForm;
  window.doctorDischargeForm=function(a,d){
    const locked=d?.status==="Finalized";
    if(!locked)return originalDoctorDischargeForm(a,d);
    const fields=[
      ["Final Diagnosis",d.final_diagnosis,true],
      ["Presenting Complaints / History",d.presenting_history,true],
      ["Examination Findings",d.examination_findings,false],
      ["Important Investigations",d.important_investigations,false],
      ["Hospital Course",d.hospital_course,false],
      ["Surgery / Procedure",d.procedure_performed,false],
      ["Treatment Given",d.treatment_given,false],
      ["Condition at Discharge",d.condition_at_discharge,false],
      ["Discharge Medicines",d.discharge_medicines,true],
      ["Diet / Activity Advice",d.diet_activity_advice,false],
      ["Wound / Dressing Advice",d.wound_dressing_advice,false],
      ["Follow-up",d.follow_up,false],
      ["Warning Signs / When to Return",d.warning_signs,true]
    ];
    return `<div class="panel doctor-final-summary">
      <div class="doctor-final-head"><div><h3>Discharge Summary</h3><p>${esc(a.patient_name||"Patient")}</p></div><span class="doctor-status finalized">Finalized</span></div>
      <div class="doctor-final-patient">
        ${meta("UHID",a.uhid)}${meta("Age / Sex",[a.age,a.sex].filter(Boolean).join(" / "))}${meta("Ward / Bed",[a.ward_type,a.bed_no].filter(Boolean).join(" / "))}${meta("Admission",a.admission_date||"")}
      </div>
      <div class="doctor-final-grid">${fields.map(f=>section(f[0],f[1],f[2])).join("")}</div>
      <div class="doctor-final-actions"><button type="button" onclick="printDoctorDischarge()">Print / Save PDF</button></div>
    </div>`;
  };

  window.printDoctorDischarge=function(){
    const a=doctorPortalState?.selected||{};
    const d=doctorPortalState?.discharge||{};
    const doctor=doctorPortalState?.doctor||{};
    const fields=[
      ["Final Diagnosis",d.final_diagnosis,true],
      ["Presenting Complaints / History",d.presenting_history,true],
      ["Examination Findings",d.examination_findings,false],
      ["Important Investigations",d.important_investigations,false],
      ["Hospital Course",d.hospital_course,false],
      ["Surgery / Procedure",d.procedure_performed,false],
      ["Treatment Given",d.treatment_given,false],
      ["Condition at Discharge",d.condition_at_discharge,false],
      ["Discharge Medicines",d.discharge_medicines,true],
      ["Diet / Activity Advice",d.diet_activity_advice,false],
      ["Wound / Dressing Advice",d.wound_dressing_advice,false],
      ["Follow-up",d.follow_up,false],
      ["Warning Signs / When to Return",d.warning_signs,true]
    ];
    document.getElementById("doctorCompactPrint")?.remove();
    const print=document.createElement("div");
    print.id="doctorCompactPrint";
    print.innerHTML=`
      <div class="p-head"><h1>REVIVE HOSPITAL</h1><h2>DISCHARGE SUMMARY</h2></div>
      <div class="p-meta">
        ${meta("Patient",a.patient_name)}${meta("UHID",a.uhid)}${meta("Admission ID",a.admission_id||a.id)}${meta("Age / Sex",[a.age,a.sex].filter(Boolean).join(" / "))}
        ${meta("Ward / Bed",[a.ward_type,a.bed_no].filter(Boolean).join(" / "))}${meta("Admission",a.admission_date||"")}${meta("Consultant",doctor.doctor_name||d.doctor_name)}${meta("Status",d.status)}
      </div>
      <div class="p-grid">${fields.map(f=>printSection(f[0],f[1],f[2])).join("")}</div>
      <div class="p-footer"><div><b>Consultant:</b> ${esc(doctor.doctor_name||d.doctor_name||"")}</div><div>Revive HealthScope</div></div>`;
    document.body.appendChild(print);
    document.body.classList.add("doctor-compact-print");
    const cleanup=()=>{document.body.classList.remove("doctor-compact-print");print.remove();window.removeEventListener("afterprint",cleanup)};
    window.addEventListener("afterprint",cleanup);
    setTimeout(()=>window.print(),50);
  };
})();
