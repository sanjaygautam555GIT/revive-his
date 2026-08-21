(()=>{
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const has=value=>String(value??"").trim()!=="";

  function printDocument(admission,discharge){
    const fields=[
      ['Final Diagnosis',discharge.final_diagnosis,true],
      ['Presenting Complaints / History',discharge.presenting_history,true],
      ['Examination Findings',discharge.examination_findings,false],
      ['Important Investigations',discharge.important_investigations,false],
      ['Hospital Course',discharge.hospital_course,false],
      ['Surgery / Procedure',discharge.procedure_performed,false],
      ['Intra-operative Findings',discharge.intraoperative_findings,true],
      ['Treatment Given',discharge.treatment_given,false],
      ['Condition at Discharge',discharge.condition_at_discharge,false],
      ['Discharge Medicines',discharge.discharge_medicines,true],
      ['Diet / Activity Advice',discharge.diet_activity_advice,false],
      ['Wound / Dressing Advice',discharge.wound_dressing_advice,false],
      ['Follow-up',discharge.follow_up,false],
      ['Warning Signs / When to Return',discharge.warning_signs,true]
    ];
    const meta=(label,value)=>has(value)?`<div><b>${esc(label)}</b>${esc(value)}</div>`:'';
    const section=(label,value,full=false)=>has(value)?`<div class="sec ${full?'full':''}"><b>${esc(label)}</b><div>${esc(value)}</div></div>`:'';
    const w=window.open('','_blank');
    if(!w){alert('Please allow pop-ups to print the discharge summary.');return;}
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Discharge Summary</title><style>
      @page{margin:7mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;font-family:Arial,sans-serif;color:#111;font-size:9px;line-height:1.18}.sheet{width:100%}.head{text-align:center;border-bottom:1.5px solid #111;padding-bottom:4px;margin-bottom:5px}.head h1{font-size:15px;margin:0}.head h2{font-size:11px;margin:2px 0 0}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:3px 8px;border-bottom:1px solid #777;padding-bottom:4px;margin-bottom:5px}.meta b,.sec>b{display:block;font-size:8px;text-transform:uppercase;color:#333;margin-bottom:1px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:3px 8px}.sec{break-inside:avoid;border-bottom:1px solid #ddd;padding:2px 0;white-space:pre-wrap}.sec.full{grid-column:1/-1}.footer{display:flex;justify-content:space-between;border-top:1px solid #777;margin-top:5px;padding-top:4px}</style></head><body><div class="sheet"><div class="head"><h1>REVIVE HOSPITAL</h1><h2>DISCHARGE SUMMARY</h2></div><div class="meta">${meta('Patient',admission.patient_name)}${meta('UHID',admission.uhid)}${meta('Admission ID',admission.admission_id||admission.id)}${meta('Age / Sex',[admission.age,admission.sex].filter(Boolean).join(' / '))}${meta('Ward / Bed',[admission.ward_type,admission.bed_no].filter(Boolean).join(' / '))}${meta('Admission',admission.admission_date||'')}${meta('Consultant',discharge.doctor_name||admission.doctor||admission.consultant)}${meta('Status','Finalized')}</div><div class="grid">${fields.map(f=>section(f[0],f[1],f[2])).join('')}</div><div class="footer"><div><b>Consultant:</b> ${esc(discharge.doctor_name||admission.doctor||admission.consultant||'')}</div><div>Revive HealthScope</div></div></div><script>window.onload=function(){setTimeout(function(){window.print()},100)}<\/script></body></html>`);
    w.document.close();
  }

  window.applyIntraopDischargePatches=function(){
    if(typeof window.doctorDischargeForm==='function'&&!window.__intraopDoctorFormPatched){
      const originalForm=window.doctorDischargeForm;
      window.doctorDischargeForm=function(a,d){
        let html=originalForm(a,d);
        if(d?.status==='Finalized'){
          if(has(d.intraoperative_findings)&&!html.includes('Intra-operative Findings')){
            const block=`<div class="doctor-final-section full"><span>Intra-operative Findings</span>${esc(d.intraoperative_findings)}</div>`;
            html=html.replace(/(<div class="doctor-final-section[^>]*"><span>Treatment Given<\/span>)/,block+'$1');
          }
          return html;
        }
        if(!html.includes('dd_intraop')){
          const field=`<div class="doctor-full"><label>Intra-operative Findings</label><textarea id="dd_intraop" rows="4">${esc(d?.intraoperative_findings||'')}</textarea></div>`;
          html=html.replace(/(<div class="doctor-full"><label>Treatment Given<\/label>)/,field+'$1');
        }
        return html;
      };
      window.__intraopDoctorFormPatched=true;
    }

    if(typeof window.saveDoctorDischarge==='function'&&!window.__intraopDoctorSavePatched){
      window.saveDoctorDischarge=async function(status){
        const a=doctorPortalState.selected,d=doctorPortalState.doctor;if(!a||!d)return;
        const v=id=>document.getElementById('dd_'+id)?.value.trim()||'';
        const payload={ipd_admission_id:a.id,admission_id:a.admission_id||String(a.id),uhid:a.uhid||null,patient_name:a.patient_name||null,doctor_id:d.id,doctor_name:d.doctor_name,created_by_user_id:currentUser?.id||null,status,final_diagnosis:v('finalDiagnosis'),presenting_history:v('history'),examination_findings:v('findings'),important_investigations:v('investigations'),hospital_course:v('course'),procedure_performed:v('procedure'),intraoperative_findings:v('intraop'),treatment_given:v('treatment'),condition_at_discharge:v('condition'),discharge_medicines:v('medicines'),diet_activity_advice:v('advice'),wound_dressing_advice:v('wound'),follow_up:v('followup'),warning_signs:v('warning'),updated_at:new Date().toISOString(),finalized_at:status==='Finalized'?new Date().toISOString():null};
        const {error}=await db.from('doctor_discharge_summaries').upsert(payload,{onConflict:'ipd_admission_id'});
        if(error){doctorPortalMsg('doctorDischargeMessage',error.message,'error');return}
        await openDoctorPatient(a.id,'discharge');
      };
      window.__intraopDoctorSavePatched=true;
    }

    if(typeof window.printDoctorDischarge==='function'&&!window.__intraopDoctorPrintPatched){
      window.printDoctorDischarge=function(){printDocument(doctorPortalState?.selected||{},doctorPortalState?.discharge||{})};
      window.__intraopDoctorPrintPatched=true;
    }

    if(typeof window.printIPDClinicalDischarge==='function'&&!window.__intraopStaffPrintPatched){
      window.printIPDClinicalDischarge=function(admission,discharge){printDocument(admission,discharge)};
      window.__intraopStaffPrintPatched=true;
    }
  };
})();