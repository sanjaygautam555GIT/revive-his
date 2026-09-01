(()=>{
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const has=value=>String(value??"").trim()!=="";
  const fmtDate=value=>{if(!value)return'';try{return new Date(value).toLocaleDateString('en-GB')}catch{return value}};

  function parseMedicines(text){
    if(!has(text))return[];
    return String(text).split(/\n+/).map(x=>x.trim()).filter(Boolean).map(line=>{
      const duration=(line.match(/(\d+\s*(?:day|days|week|weeks|month|months))/i)||[])[1]||'';
      const freq=(line.match(/\b(TDS|BD|BID|OD|HS|SOS|QID|STAT)\b/i)||[])[1]||'';
      const dose=(line.match(/\b(\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|tablet|tablets|cap|capsule|capsules))\b/i)||[])[1]||'';
      let medicine=line.replace(new RegExp(duration.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$','i'),'').trim();
      return {medicine,dose,freq,duration};
    });
  }

  function printDocument(admission,discharge){
    const doctor=discharge.doctor_name||admission.doctor||admission.consultant||'';
    const meds=parseMedicines(discharge.discharge_medicines);
    const meta=(label,value,icon)=>has(value)?`<div class="meta-item"><span class="meta-icon">${icon||'•'}</span><div><b>${esc(label)}</b><strong>${esc(value)}</strong></div></div>`:'';
    const card=(label,value,cls='',icon='✚')=>has(value)?`<section class="card ${cls}"><div class="card-icon">${icon}</div><div><h3>${esc(label)}</h3><div class="card-text">${esc(value)}</div></div></section>`:'';
    const medTable=meds.length?`<section class="med-card"><h3>💊 DISCHARGE MEDICINES</h3><table><thead><tr><th>MEDICINE</th><th>DOSE</th><th>FREQUENCY</th><th>DURATION</th></tr></thead><tbody>${meds.map(m=>`<tr><td>${esc(m.medicine)}</td><td>${esc(m.dose||'-')}</td><td>${esc(m.freq||'-')}</td><td>${esc(m.duration||'-')}</td></tr>`).join('')}</tbody></table></section>`:'';
    const w=window.open('','_blank');
    if(!w){alert('Please allow pop-ups to print the discharge summary.');return;}
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Discharge Summary</title><style>
      @page{size:A4 portrait;margin:8mm}
      *{box-sizing:border-box}
      html,body{margin:0;padding:0;background:#fff}
      body{font-family:Arial,Helvetica,sans-serif;color:#172033;font-size:10.5pt;line-height:1.3;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .sheet{width:100%;max-width:194mm;margin:0 auto}
      .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #123f89;padding:0 1mm 4mm;margin-bottom:4mm}
      .brand{display:flex;gap:3mm;align-items:center}.brand-mark{width:13mm;height:13mm;border:2px solid #123f89;border-radius:3mm;display:grid;place-items:center;color:#123f89;font-size:20pt;font-weight:900}
      .brand h1{margin:0;color:#123f89;font-size:20pt;line-height:1}.brand p{margin:1.5mm 0 0;color:#27569b;font-size:9.5pt}.contact{text-align:right;font-size:8.5pt;line-height:1.45;color:#26344e}
      .title{text-align:center;color:#132d68;font-size:22pt;font-weight:800;letter-spacing:.5px;margin:3mm 0 4mm}
      .meta-grid{display:grid;grid-template-columns:repeat(4,1fr);border:1.5px solid #3f76c5;border-radius:3mm;overflow:hidden;margin-bottom:4mm;background:#f8fbff}
      .meta-item{display:flex;gap:2.3mm;align-items:center;min-height:16mm;padding:2.5mm;border-right:1px dotted #78a1d8;border-bottom:1px dotted #78a1d8}.meta-item:nth-child(4n){border-right:0}.meta-item:nth-last-child(-n+4){border-bottom:0}.meta-icon{font-size:15pt;color:#124185}.meta-item b{display:block;color:#254a84;font-size:7.7pt;letter-spacing:.25px}.meta-item strong{display:block;color:#101828;font-size:10pt;margin-top:.6mm}
      .diagnosis{border:1.5px solid #3f76c5;background:#edf5ff;border-radius:3mm;padding:3mm 4mm;margin-bottom:3.5mm}.diagnosis h3{margin:0;color:#163d7a;font-size:10pt}.diagnosis div{font-size:13.5pt;font-weight:700;margin-top:1mm;color:#111827}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-bottom:3mm}.card{display:grid;grid-template-columns:10mm 1fr;gap:2.5mm;border:1px solid #6d98d7;border-radius:3mm;padding:3mm;min-height:18mm;break-inside:avoid;background:#fff}.card.wide{grid-column:1/-1}.card-icon{font-size:17pt;color:#153f7f;line-height:1}.card h3{margin:0 0 1.2mm;color:#1d4d91;font-size:9pt}.card-text{white-space:pre-wrap;color:#1b2433;font-size:10pt}.card.green{border-color:#64a88b}.card.green h3,.card.green .card-icon{color:#157052}.card.red{border-color:#e08a8a}.card.red h3,.card.red .card-icon{color:#c62828}
      .med-card{border:1.5px solid #4275bd;border-radius:3mm;overflow:hidden;margin:3mm 0;break-inside:avoid}.med-card h3{margin:0;padding:2.2mm 3mm;color:#163f80;font-size:9.5pt;background:#f3f8ff}.med-card table{width:100%;border-collapse:collapse;font-size:9pt}.med-card th{background:#123f89;color:#fff;padding:2mm;border-right:1px solid #7e9fc8}.med-card td{padding:1.9mm 2mm;border-top:1px solid #b9cbe4;border-right:1px solid #b9cbe4}.med-card th:last-child,.med-card td:last-child{border-right:0}
      .bottom{display:grid;grid-template-columns:1fr 1fr;gap:4mm;border:1.3px solid #6b92ca;border-radius:3mm;padding:3.5mm;margin-top:4mm;break-inside:avoid}.consultant b{display:block;color:#214d8b;font-size:8pt}.consultant strong{display:block;font-size:12pt;margin:1mm 0}.sig{margin-top:7mm;border-bottom:1px solid #444;width:55mm;height:8mm}.discharge-meta{font-size:9.5pt;line-height:1.55}.wish{text-align:center;margin-top:4mm;font-style:italic;color:#3a465c}
      .footer{margin-top:3mm;background:#123f89;color:#fff;text-align:center;padding:2.2mm;border-radius:1.5mm;font-size:9pt;letter-spacing:.2px}
      @media print{body{zoom:1}.sheet{page-break-after:avoid}}
    </style></head><body><div class="sheet">
      <div class="top"><div class="brand"><div class="brand-mark">✚</div><div><h1>REVIVE HOSPITAL</h1><p>Compassionate Care. Better Health.</p></div></div><div class="contact">Revive HealthScope<br>Hospital Discharge Record</div></div>
      <div class="title">DISCHARGE SUMMARY</div>
      <div class="meta-grid">
        ${meta('PATIENT NAME',admission.patient_name,'👤')}${meta('UHID',admission.uhid,'▣')}${meta('ADMISSION ID',admission.admission_id||admission.id,'▤')}${meta('AGE / SEX',[admission.age,admission.sex].filter(Boolean).join(' / '),'⚥')}
        ${meta('WARD / BED',[admission.ward_type,admission.bed_no].filter(Boolean).join(' / '),'▰')}${meta('ADMISSION DATE',fmtDate(admission.admission_date||admission.created_at),'▦')}${meta('CONSULTANT',doctor,'⚕')}${meta('STATUS',discharge.status||'Finalized','⚑')}
      </div>
      ${has(discharge.final_diagnosis)?`<section class="diagnosis"><h3>FINAL DIAGNOSIS</h3><div>${esc(discharge.final_diagnosis)}</div></section>`:''}
      <div class="grid">
        ${card('PRESENTING COMPLAINTS / HISTORY',discharge.presenting_history,'','▤')}
        ${card('EXAMINATION FINDINGS',discharge.examination_findings,'','⚕')}
        ${card('SURGERY / PROCEDURE',discharge.procedure_performed,'','✎')}
        ${card('IMPORTANT INVESTIGATIONS',discharge.important_investigations,'','⚗')}
        ${card('INTRA-OPERATIVE FINDINGS',discharge.intraoperative_findings,'wide','◉')}
        ${card('HOSPITAL COURSE',discharge.hospital_course,'','▦')}
        ${card('CONDITION AT DISCHARGE',discharge.condition_at_discharge,'','♥')}
        ${card('TREATMENT GIVEN',discharge.treatment_given,'wide','✚')}
      </div>
      ${medTable}
      <div class="grid">
        ${card('DIET / ACTIVITY ADVICE',discharge.diet_activity_advice,'green','♨')}
        ${card('WOUND / DRESSING ADVICE',discharge.wound_dressing_advice,'green','✚')}
        ${card('FOLLOW-UP',discharge.follow_up,'','▦')}
        ${card('WARNING SIGNS / WHEN TO RETURN',discharge.warning_signs,'red','⚠')}
      </div>
      <div class="bottom"><div class="consultant"><b>CONSULTANT</b><strong>${esc(doctor)}</strong><div>Revive Hospital</div><div class="sig"></div><small>Signature</small></div><div class="discharge-meta"><b>Date of Discharge:</b> ${fmtDate(discharge.discharge_date||discharge.finalized_at||new Date())}<br><b>Status:</b> ${esc(discharge.status||'Finalized')}<div class="wish">We wish you a speedy recovery.<br>Thank you for choosing Revive Hospital.</div></div></div>
      <div class="footer">Thank you for trusting us with your care. &nbsp; | &nbsp; Revive HealthScope</div>
    </div><script>window.onload=function(){setTimeout(function(){window.print()},180)}<\/script></body></html>`);
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
        if(typeof window.openDoctorRecordV3==='function')await window.openDoctorRecordV3(a.id,'discharge');else await openDoctorPatient(a.id,'discharge');
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