/* Revive IPD loader + advance top-up extension */
(function(){
  var x=new XMLHttpRequest();
  x.open('GET','ipd-base.js?v=20260912-patient-result-selection',false);
  x.send(null);
  if(x.status>=200&&x.status<300){(0,eval)(x.responseText);}else{throw new Error('Unable to load IPD base module');}

  window.loadIPDDoctors=async function(){
    var select=document.getElementById('ipdConsultant');
    var result=await db.from('doctor_master').select('*').order('doctor_name',{ascending:true});
    if(result.error){ipdDoctorMaster=[];select.innerHTML="<option value=''>Doctor master not loaded</option>";return;}
    ipdDoctorMaster=(result.data||[]).filter(function(d){return String(d.status||'Active').toLowerCase()==='active';});
    ipdDoctorMaster.sort(function(a,b){
      var an=String(a.doctor_name||'').toLowerCase(),bn=String(b.doctor_name||'').toLowerCase();
      var aSanjay=an.includes('sanjay'),bSanjay=bn.includes('sanjay');
      if(aSanjay&&!bSanjay)return -1;
      if(!aSanjay&&bSanjay)return 1;
      return an.localeCompare(bn);
    });
    select.innerHTML=ipdDoctorMaster.length?ipdDoctorMaster.map(function(d,index){return '<option value="'+index+'" data-doctor-id="'+(d.id??'')+'">'+d.doctor_name+'</option>';}).join(''):"<option value=''>No active doctor</option>";
    applyIPDDoctorDepartment();
  };

  window.loadIPDRegister=async function(){
    var body=document.getElementById('ipdRows');
    if(!body)return;
    var result=await db.from('ipd_admission').select('*').order('created_at',{ascending:false}).limit(100);
    if(result.error){body.innerHTML="<tr><td colspan='10' class='error'>"+result.error.message+"</td></tr>";return;}
    var rows=(result.data||[]).filter(isActiveIPD);
    body.innerHTML=rows.length?rows.map(function(r){return '<tr data-admission-id="'+(r.admission_id||r.id||'')+'"><td>'+(r.admission_id||r.id||'')+'</td><td>'+(r.uhid||'')+'</td><td>'+(r.patient_name||'')+'</td><td>'+(r.department||'')+'</td><td>'+(r.doctor||r.consultant||'')+'</td><td>'+([r.ward_type,r.bed_no].filter(Boolean).join(' / '))+'</td><td>'+(r.treatment_type||'')+'</td><td>'+money(r.deposit_amount||r.advance||0)+'</td><td>'+(r.status||'Admitted')+'</td><td><button type="button" onclick="openAdvanceTopup('+r.id+')">Add Advance</button> <button class="secondary" onclick="dischargeIPD('+r.id+')">Discharge</button></td></tr>';}).join(''):"<tr><td colspan='10'>No current IPD admissions.</td></tr>";
  };

  window.ipdTopupAdmission=null;
  window.closeAdvanceTopup=function(){document.getElementById('ipdTopupBackdrop')?.remove();window.ipdTopupAdmission=null;};
  window.openAdvanceTopup=async function(id){
    var result=await db.from('ipd_admission').select('*').eq('id',id).single();
    if(result.error||!result.data){alert('Unable to load admission: '+(result.error?.message||'Not found'));return;}
    closeAdvanceTopup(); window.ipdTopupAdmission=result.data;
    var data=result.data,current=safeNumber(data.deposit_amount||data.advance),wrap=document.createElement('div');
    wrap.id='ipdTopupBackdrop';wrap.className='ipd-duplicate-backdrop';
    wrap.innerHTML='<div class="ipd-duplicate-dialog" role="dialog" aria-modal="true" style="max-width:560px"><div><h3>Add / Top-Up Advance</h3><p><b>'+(data.patient_name||'Patient')+'</b> · '+(data.admission_id||data.id)+'</p></div><div class="sync-box"><b>Current Total Advance:</b> '+money(current)+'</div><div class="grid" style="grid-template-columns:1fr 1fr"><div><label>Top-Up Amount</label><input id="ipdTopupAmount" type="number" min="0.01" step="0.01" placeholder="Enter amount"></div><div><label>Payment Mode</label><select id="ipdTopupMode"><option>Cash</option><option>UPI</option><option>Bank</option><option>Credit</option></select></div><div><label>Date</label><input id="ipdTopupDate" type="date" value="'+todayISO()+'"></div><div><label>Receipt / Reference No.</label><input id="ipdTopupReference" placeholder="Optional"></div></div><div><label>Remarks</label><input id="ipdTopupRemarks" placeholder="Optional"></div><div id="ipdTopupMessage"></div><div class="ipd-duplicate-actions"><button type="button" class="secondary" onclick="closeAdvanceTopup()">Cancel</button><button type="button" id="ipdTopupSaveBtn" onclick="saveAdvanceTopup()">Save Top-Up</button></div></div>';
    wrap.addEventListener('click',function(e){if(e.target===wrap)closeAdvanceTopup();});document.body.appendChild(wrap);setTimeout(function(){document.getElementById('ipdTopupAmount')?.focus();},50);
  };
  window.saveAdvanceTopup=async function(){
    var a=window.ipdTopupAdmission,msg=document.getElementById('ipdTopupMessage'),btn=document.getElementById('ipdTopupSaveBtn');if(!a||!msg)return;
    var amount=safeNumber(document.getElementById('ipdTopupAmount').value);if(amount<=0){msg.innerHTML="<p class='error'>Enter a top-up amount greater than zero.</p>";return;}
    var mode=document.getElementById('ipdTopupMode').value,date=document.getElementById('ipdTopupDate').value||todayISO(),reference=document.getElementById('ipdTopupReference').value.trim(),remarks=document.getElementById('ipdTopupRemarks').value.trim(),oldTotal=safeNumber(a.deposit_amount||a.advance),newTotal=oldTotal+amount;
    btn.disabled=true;btn.textContent='Saving...';
    var stamp='[ADVANCE TOP-UP '+date+'] '+money(amount)+' via '+mode+(reference?' Ref: '+reference:'')+(remarks?' - '+remarks:''),combined=[a.remarks,stamp].filter(Boolean).join('\n');
    var update=await db.from('ipd_admission').update({advance:newTotal,deposit_amount:newTotal,remarks:combined}).eq('id',a.id);
    if(update.error){btn.disabled=false;btn.textContent='Save Top-Up';msg.innerHTML="<p class='error'>Top-up failed: "+update.error.message+'</p>';return;}
    try{await db.from('ipd_advance_transactions').insert([{admission_id:a.admission_id||String(a.id),admission_row_id:a.id,uhid:a.uhid,patient_name:a.patient_name,amount:amount,payment_mode:mode,transaction_date:date,reference_no:reference,remarks:remarks,transaction_type:'Top-Up',created_at:new Date().toISOString()}]);}catch(e){}
    msg.innerHTML="<p class='success'>Advance topped up by "+money(amount)+'. New total advance: <b>'+money(newTotal)+'</b>.</p>';window.ipdTopupAdmission=Object.assign({},a,{advance:newTotal,deposit_amount:newTotal});await loadIPDRegister();setTimeout(closeAdvanceTopup,1200);
  };
})();
