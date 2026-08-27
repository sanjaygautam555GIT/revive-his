(function(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dOnly=v=>{if(!v)return '-';try{return new Date(v).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}catch{return v}};
  const active=a=>String(a?.status||'Admitted').toLowerCase()!=='discharged';
  const monthNow=v=>{if(!v)return false;const d=new Date(v),n=new Date();return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear()};
  const state={doctor:null,all:[],active:[],discharges:[]};

  async function assets(){
    await loadScriptOnce('doctor-portal.js');
    await loadScriptOnce('doctor-vitals.js');
    await loadScriptOnce('doctor-intraop.js');
    window.applyIntraopDischargePatches?.();
    installActionFixes();
  }
  function view(id){return document.getElementById(id)}
  function proc(a,d){return d?.procedure_performed||a?.procedure_name||a?.procedure||'Conservative'}
  function sDate(a,d){return d?.surgery_date||a?.surgery_date||a?.operation_date||''}
  function dischargeDate(a,d){return d?.discharge_date||d?.finalized_at||a?.discharge_date||''}
  function dischargeFor(a){return state.discharges.find(d=>String(d.ipd_admission_id)===String(a.id))||null}

  async function load(){
    await assets();
    state.doctor=await resolveLoggedInDoctor();
    if(!state.doctor)throw new Error('This login is not linked to a Doctor Master profile.');
    const key=doctorPortalNameKey(state.doctor.doctor_name);
    const [{data:ipd,error:e1},{data:ds,error:e2}]=await Promise.all([
      db.from('ipd_admission').select('*').order('created_at',{ascending:false}),
      db.from('doctor_discharge_summaries').select('*').eq('doctor_id',state.doctor.id).order('updated_at',{ascending:false})
    ]);
    if(e1)throw e1;if(e2)throw e2;
    state.all=(ipd||[]).filter(a=>[a.doctor,a.consultant].some(n=>doctorPortalNameKey(n)===key));
    state.active=state.all.filter(active);
    state.discharges=ds||[];
    if(window.doctorPortalState){doctorPortalState.doctor=state.doctor;doctorPortalState.allPatients=state.all;doctorPortalState.patients=state.active;doctorPortalState.discharges=state.discharges;}
  }

  async function dashboard(){
    const el=view('doctorDashboardView');
    try{await load();const ops=state.discharges.filter(d=>monthNow(d.surgery_date||d.finalized_at)&&d.procedure_performed&&String(d.procedure_performed).toLowerCase()!=='conservative');const major=ops.filter(d=>String(d.ot_category||'').toLowerCase()==='major').length;const minor=ops.filter(d=>String(d.ot_category||'').toLowerCase()==='minor').length;const adm=state.all.filter(a=>monthNow(a.admission_date||a.created_at)).length;
      el.innerHTML=`<div class="doctor-hero panel"><div><h2>${esc(state.doctor.doctor_name)}</h2><p>Clinical activity · ${new Date().toLocaleString('en-IN',{month:'long',year:'numeric'})}</p></div></div><div class="doctor-metrics doctor-metrics-five"><div class="panel"><span>Active Admissions</span><strong>${state.active.length}</strong></div><div class="panel"><span>Monthly Admissions</span><strong>${adm}</strong></div><div class="panel"><span>Monthly Operations</span><strong>${ops.length}</strong></div><div class="panel"><span>Major OT</span><strong>${major}</strong></div><div class="panel"><span>Minor OT</span><strong>${minor}</strong></div></div><div class="panel"><h3>Active Admissions</h3><div class="table-wrap"><table><thead><tr><th>Bed</th><th>Patient</th><th>Diagnosis</th><th>Management</th><th>Admission</th></tr></thead><tbody>${state.active.slice(0,12).map(a=>{const d=dischargeFor(a);return `<tr><td>${esc(a.bed_no||'-')}</td><td><b>${esc(a.patient_name||'')}</b></td><td>${esc(a.diagnosis||'-')}</td><td>${esc(proc(a,d))}</td><td>${dOnly(a.admission_date||a.created_at)}</td></tr>`}).join('')||'<tr><td colspan="5">No active admissions.</td></tr>'}</tbody></table></div></div>`;
    }catch(e){el.innerHTML=`<div class="panel"><p class="error">${esc(e.message)}</p></div>`}
  }

  async function admitted(){
    const el=view('currentlyAdmittedView');
    try{await load();el.innerHTML=`<div class="panel"><div class="doctor-toolbar"><div><h2>Currently Admitted Patients</h2><p>Active inpatient clinical care</p></div><input id="doctorAdmSearch" placeholder="Search patient, bed, diagnosis..." oninput="window.filterDoctorAdmittedV3()"></div><div class="table-wrap"><table><thead><tr><th>Bed No.</th><th>Patient Name</th><th>Diagnosis</th><th>Management</th><th>Date of Admission</th><th>Date of Surgery</th><th>Actions</th></tr></thead><tbody id="doctorAdmRows">${rowsAdmitted(state.active)}</tbody></table></div></div>`}catch(e){el.innerHTML=`<div class="panel"><p class="error">${esc(e.message)}</p></div>`}
  }
  function rowsAdmitted(rows){if(!rows.length)return '<tr><td colspan="7">No currently admitted patients.</td></tr>';return rows.map(a=>{const d=dischargeFor(a);return `<tr><td><b>${esc(a.bed_no||'-')}</b></td><td><b>${esc(a.patient_name||'')}</b><br><small>${esc(a.uhid||'')}</small></td><td>${esc(a.diagnosis||'-')}</td><td>${esc(proc(a,d))}</td><td>${dOnly(a.admission_date||a.created_at)}</td><td>${dOnly(sDate(a,d))}</td><td><div class="doctor-row-actions"><button onclick="window.openDoctorRecordV3('${a.id}','notes')">Daily Notes</button><button class="secondary" onclick="window.openDoctorRecordV3('${a.id}','discharge')">Prepare Discharge</button></div></td></tr>`}).join('')}
  window.filterDoctorAdmittedV3=function(){const q=(document.getElementById('doctorAdmSearch')?.value||'').toLowerCase().trim();const r=!q?state.active:state.active.filter(a=>[a.patient_name,a.uhid,a.bed_no,a.diagnosis,proc(a,dischargeFor(a))].join(' ').toLowerCase().includes(q));document.getElementById('doctorAdmRows').innerHTML=rowsAdmitted(r)};

  window.openDoctorRecordV3=async function(id,tab='notes'){
    const el=view('currentlyAdmittedView');
    try{
      await assets();
      if(!state.doctor||!state.active.length)await load();
      const a=state.active.find(x=>String(x.id)===String(id));
      if(!a)throw new Error('Patient record not found in currently admitted list.');
      const [noteResult,dischargeResult]=await Promise.all([
        db.from('doctor_daily_notes').select('*').eq('ipd_admission_id',a.id).order('created_at',{ascending:false}),
        db.from('doctor_discharge_summaries').select('*').eq('ipd_admission_id',a.id).order('updated_at',{ascending:false}).limit(1)
      ]);
      if(noteResult.error)throw noteResult.error;
      if(dischargeResult.error)throw dischargeResult.error;
      const notes=noteResult.data||[];
      const discharge=(dischargeResult.data||[])[0]||null;
      doctorPortalState.doctor=state.doctor;
      doctorPortalState.patients=state.active;
      doctorPortalState.selected=a;
      doctorPortalState.notes=notes;
      doctorPortalState.discharge=discharge;
      el.innerHTML=`<div class="doctor-patient-header panel"><div><button class="secondary doctor-back" type="button" onclick="navigate('currentlyAdmitted')">← Currently Admitted</button><h2>${esc(a.patient_name||'Patient')}</h2><p>${esc(a.diagnosis||'Diagnosis not recorded')}</p></div><button type="button" onclick="window.openDoctorRecordV3('${a.id}','discharge')">Prepare Discharge</button></div><div class="doctor-patient-meta panel"><div><span>UHID</span><b>${esc(a.uhid||'-')}</b></div><div><span>Age / Sex</span><b>${esc(a.age||'-')} / ${esc(a.sex||'-')}</b></div><div><span>Ward / Bed</span><b>${esc([a.ward_type,a.bed_no].filter(Boolean).join(' / ')||'-')}</b></div><div><span>Admission</span><b>${esc(a.admission_date||rowDate(a)||'-')}</b></div></div><div class="doctor-tabs"><button class="${tab==='notes'?'active':''}" onclick="window.openDoctorRecordV3('${a.id}','notes')">Daily Notes</button><button class="${tab==='discharge'?'active':''}" onclick="window.openDoctorRecordV3('${a.id}','discharge')">Discharge Summary</button></div>${tab==='discharge'?doctorDischargeForm(a,discharge):doctorNotesPanel(a,notes)}`;
    }catch(e){el.innerHTML=`<div class="panel"><button class="secondary" onclick="navigate('currentlyAdmitted')">← Currently Admitted</button><p class="error">${esc(e.message)}</p></div>`}
  };

  function installActionFixes(){
    window.saveDoctorDailyNote=async function(admissionId){
      const a=doctorPortalState.selected,d=doctorPortalState.doctor;if(!a||!d)return;
      const payload={ipd_admission_id:a.id,admission_id:a.admission_id||String(a.id),uhid:a.uhid||null,patient_name:a.patient_name||null,doctor_id:d.id,doctor_name:d.doctor_name,created_by_user_id:currentUser?.id||null,general_condition:document.getElementById('dnCondition')?.value.trim()||'',vitals:document.getElementById('dnVitals')?.value.trim()||'',complaints:document.getElementById('dnComplaints')?.value.trim()||'',findings:document.getElementById('dnFindings')?.value.trim()||'',investigations:document.getElementById('dnInvestigations')?.value.trim()||'',assessment:document.getElementById('dnAssessment')?.value.trim()||'',treatment_changes:document.getElementById('dnTreatment')?.value.trim()||'',plan:document.getElementById('dnPlan')?.value.trim()||''};
      if(!payload.general_condition&&!payload.complaints&&!payload.findings&&!payload.assessment&&!payload.plan){doctorPortalMsg('doctorNoteMessage','Enter at least one clinical note field.','error');return}
      const {error}=await db.from('doctor_daily_notes').insert([payload]);if(error){doctorPortalMsg('doctorNoteMessage',error.message,'error');return}
      await window.openDoctorRecordV3(admissionId,'notes');
    };
    window.saveDoctorDischarge=async function(status){
      const a=doctorPortalState.selected,d=doctorPortalState.doctor;if(!a||!d)return;
      const v=id=>document.getElementById('dd_'+id)?.value.trim()||'';
      const payload={ipd_admission_id:a.id,admission_id:a.admission_id||String(a.id),uhid:a.uhid||null,patient_name:a.patient_name||null,doctor_id:d.id,doctor_name:d.doctor_name,created_by_user_id:currentUser?.id||null,status,final_diagnosis:v('finalDiagnosis'),presenting_history:v('history'),examination_findings:v('findings'),important_investigations:v('investigations'),hospital_course:v('course'),procedure_performed:v('procedure'),treatment_given:v('treatment'),condition_at_discharge:v('condition'),discharge_medicines:v('medicines'),diet_activity_advice:v('advice'),wound_dressing_advice:v('wound'),follow_up:v('followup'),warning_signs:v('warning'),updated_at:new Date().toISOString(),finalized_at:status==='Finalized'?new Date().toISOString():null};
      const {error}=await db.from('doctor_discharge_summaries').upsert(payload,{onConflict:'ipd_admission_id'});if(error){doctorPortalMsg('doctorDischargeMessage',error.message,'error');return}
      await window.openDoctorRecordV3(a.id,'discharge');
    };
  }

  async function search(){
    const el=view('doctorPatientSearchView');
    try{await load();el.innerHTML=`<div class="panel"><div class="doctor-toolbar"><div><h2>Patient Search</h2><p>Search current and previous patients with complete clinical history.</p></div><input id="doctorHistorySearch" placeholder="Search patient, UHID, diagnosis, procedure..." oninput="window.filterDoctorHistoryV3()"></div><div class="table-wrap"><table><thead><tr><th>Patient</th><th>Diagnosis</th><th>Procedure</th><th>Admitted</th><th>Operated</th><th>Discharged</th><th></th></tr></thead><tbody id="doctorHistoryRows">${rowsHistory(state.all)}</tbody></table></div></div>`}catch(e){el.innerHTML=`<div class="panel"><p class="error">${esc(e.message)}</p></div>`}
  }
  function rowsHistory(rows){if(!rows.length)return '<tr><td colspan="7">No records found.</td></tr>';return rows.map(a=>{const d=dischargeFor(a);return `<tr><td><b>${esc(a.patient_name||'')}</b><br><small>${esc(a.uhid||'')}</small></td><td>${esc(d?.final_diagnosis||a.diagnosis||'-')}</td><td>${esc(proc(a,d))}</td><td>${dOnly(a.admission_date||a.created_at)}</td><td>${dOnly(sDate(a,d))}</td><td>${dOnly(dischargeDate(a,d))}</td><td><button onclick="window.openDoctorHistoryV3('${a.id}')">View Details</button></td></tr>`}).join('')}
  window.filterDoctorHistoryV3=function(){const q=(document.getElementById('doctorHistorySearch')?.value||'').toLowerCase().trim();const r=!q?state.all:state.all.filter(a=>{const d=dischargeFor(a);return[a.patient_name,a.uhid,a.diagnosis,proc(a,d),d?.intraoperative_findings,d?.complications].join(' ').toLowerCase().includes(q)});document.getElementById('doctorHistoryRows').innerHTML=rowsHistory(r)};
  window.openDoctorHistoryV3=function(id){const a=state.all.find(x=>String(x.id)===String(id));if(!a)return;const d=dischargeFor(a),el=view('doctorPatientSearchView');el.innerHTML=`<button class="secondary doctor-back" onclick="window.openDoctorPatientSearchV3()">← Patient Search</button><div class="panel"><h2>${esc(a.patient_name||'Patient')}</h2><div class="doctor-patient-meta"><div><span>UHID</span><b>${esc(a.uhid||'-')}</b></div><div><span>Admission</span><b>${dOnly(a.admission_date||a.created_at)}</b></div><div><span>Surgery</span><b>${dOnly(sDate(a,d))}</b></div><div><span>Discharge</span><b>${dOnly(dischargeDate(a,d))}</b></div></div></div><div class="panel doctor-history-detail"><h3>Complete Clinical Record</h3><dl><dt>Diagnosis</dt><dd>${esc(d?.final_diagnosis||a.diagnosis||'-')}</dd><dt>Procedure / Management</dt><dd>${esc(proc(a,d))}</dd><dt>OT Category</dt><dd>${esc(d?.ot_category||'-')}</dd><dt>Intra-operative Findings</dt><dd>${esc(d?.intraoperative_findings||'-')}</dd><dt>Complications</dt><dd>${esc(d?.complications||'No complication recorded')}</dd><dt>Hospital Course</dt><dd>${esc(d?.hospital_course||'-')}</dd><dt>Discharge Summary Status</dt><dd>${esc(d?.status||'Not prepared')}</dd></dl></div>`};
  window.openDoctorPatientSearchV3=search;

  VIEWS.doctorDashboard={title:'Dashboard',subtitle:'Admissions and operative activity',render:dashboard};
  VIEWS.currentlyAdmitted={title:'Currently Admitted',subtitle:'Active inpatient clinical care',render:admitted};
  VIEWS.doctorPatientSearch={title:'Patient Search',subtitle:'Complete patient history',render:search};
  NAV_BY_ROLE.doctor=['doctorDashboard','currentlyAdmitted','doctorPatientSearch'];
  const old=window.navForRole;
  window.navForRole=function(role){if(role==='doctor')return ['doctorDashboard','currentlyAdmitted','doctorPatientSearch'];return old(role)};
  if(window.currentUser?.role==='doctor'&&typeof window.buildNav==='function'){window.buildNav();window.navigate('doctorDashboard')}
})();