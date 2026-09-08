// Global professional notifications for Revive HealthScope.
(function(){
  const deleteBypass=new WeakSet();

  function region(){
    let el=document.getElementById('hsToastRegion');
    if(!el){
      el=document.createElement('div');
      el.id='hsToastRegion';
      el.className='hs-toast-region';
      el.setAttribute('aria-live','polite');
      el.setAttribute('aria-atomic','true');
      document.body.appendChild(el);
    }
    return el;
  }

  function normalizeType(type,message){
    if(type)return type;
    const text=String(message||'').toLowerCase();
    if(/fail|invalid|error|required|not found|denied|unable/.test(text))return 'error';
    if(/stock|expiry|expired|warning|low/.test(text))return 'warning';
    if(/saved|updated|deleted|success|complete|printed|created/.test(text))return 'success';
    return 'info';
  }

  function titleFor(type){return {success:'Success',error:'Action required',warning:'Warning',info:'Notice'}[type]||'Notice'}
  function iconFor(type){return {success:'✓',error:'!',warning:'!',info:'i'}[type]||'i'}

  window.hsToast=function(message,type,options={}){
    if(!message)return null;
    type=normalizeType(type,message);
    const toast=document.createElement('div');
    toast.className=`hs-toast ${type}`;
    toast.innerHTML=`<div class="hs-toast-icon">${iconFor(type)}</div><div class="hs-toast-copy"><strong>${options.title||titleFor(type)}</strong><span></span></div><button class="hs-toast-close" aria-label="Dismiss">×</button>`;
    toast.querySelector('.hs-toast-copy span').textContent=String(message).replace(/<[^>]*>/g,'').trim();
    const close=()=>{
      if(toast.classList.contains('is-leaving'))return;
      toast.classList.add('is-leaving');
      setTimeout(()=>toast.remove(),190);
    };
    toast.querySelector('.hs-toast-close').onclick=close;
    region().appendChild(toast);
    const duration=options.duration??(type==='error'?5200:3600);
    if(duration>0)setTimeout(close,duration);
    return toast;
  };

  window.hsConfirm=function(message,options={}){
    return new Promise(resolve=>{
      const wrap=document.createElement('div');
      wrap.className='hs-confirm-backdrop';
      wrap.innerHTML=`<div class="hs-confirm" role="dialog" aria-modal="true"><h3>${options.title||'Confirm deletion'}</h3><p></p><div class="hs-confirm-actions"><button class="hs-confirm-cancel" data-no-confirm="true">Cancel</button><button class="hs-confirm-danger" data-no-confirm="true">${options.confirmText||'Delete'}</button></div></div>`;
      wrap.querySelector('p').textContent=message||'This action cannot be undone.';
      const done=value=>{wrap.remove();resolve(value)};
      wrap.querySelector('.hs-confirm-cancel').onclick=()=>done(false);
      wrap.querySelector('.hs-confirm-danger').onclick=()=>done(true);
      wrap.addEventListener('click',e=>{if(e.target===wrap)done(false)});
      document.body.appendChild(wrap);
      wrap.querySelector('.hs-confirm-cancel').focus();
    });
  };

  window.alert=function(message){hsToast(message,normalizeType(null,message));};

  document.addEventListener('invalid',e=>{
    const field=e.target;
    const label=field.labels?.[0]?.textContent?.trim()||field.getAttribute('aria-label')||field.name||'This field';
    hsToast(`${label} is required or contains an invalid value.`,'error',{title:'Check the form'});
  },true);

  document.addEventListener('click',async e=>{
    const button=e.target.closest('button,a');
    if(!button)return;
    if(button.closest('.hs-confirm-backdrop')||button.dataset.noConfirm==='true')return;
    const text=(button.textContent||button.getAttribute('aria-label')||'').trim();
    if(!/delete|remove/i.test(text))return;
    if(deleteBypass.has(button)){deleteBypass.delete(button);return;}
    e.preventDefault();
    e.stopImmediatePropagation();
    const ok=await hsConfirm('Delete this record? This action cannot be undone.');
    if(ok){deleteBypass.add(button);button.click();}
  },true);

  window.addEventListener('afterprint',()=>hsToast('Print dialog completed.','success',{title:'Print complete'}));

  function start(){region();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();

// Robust cross-user realtime synchronization.
(function(){
  let channel=null;
  let reconnectTimer=null;
  let updateTimer=null;

  function client(){
    try{return typeof db!=='undefined'?db:null}catch(_){return null}
  }

  function activeView(){
    return document.querySelector('#mainNav button.active')?.dataset?.view||null;
  }

  function setKpi(title,value){
    document.querySelectorAll('#dashboardView .modern-kpi').forEach(card=>{
      const label=card.querySelector('span')?.textContent?.trim();
      if(label===title){const strong=card.querySelector('strong');if(strong)strong.textContent=value;}
    });
  }

  async function syncDashboardKpis(){
    if(activeView()!=='dashboard'||document.hidden)return;
    try{
      const [opdVisits,admissions,ipdBills,diagnosticBills,pharmacySales,expenses]=await Promise.all([
        fetchAll('opd_visits'),fetchAll('ipd_admission'),fetchAll('ipd_billing'),fetchAll('diagnostic_bills'),fetchAll('pharmacy_sales'),fetchAll('expenses')
      ]);
      const today=todayISO();
      const opdToday=filterByDate(opdVisits,'visit_date',today,today);
      const ipdToday=filterByDate(admissions,'admission_date',today,today).filter(isActiveIPDAdmission);
      const activeIpd=admissions.filter(isActiveIPDAdmission);
      const ipdFinalToday=filterByDate(ipdBills,'billing_date',today,today);
      const diagToday=filterByDate(diagnosticBills,'billing_date',today,today);
      const pharmToday=filterByDate(pharmacySales,'bill_date',today,today);
      const expToday=filterByDate(expenses,'expense_date',today,today);
      const revenue=sumField(opdToday,'amount')+sumField(ipdFinalToday,'total')+sumField(diagToday,'total_amount')+sumField(pharmToday,'bill_amount');
      const collection=collectionByMode({opd:opdToday,diag:diagToday,pharm:pharmToday,adm:ipdToday},'cash')+collectionByMode({opd:opdToday,diag:diagToday,pharm:pharmToday,adm:ipdToday},'upi')+collectionByMode({opd:opdToday,diag:diagToday,pharm:pharmToday,adm:ipdToday},'bank');
      setKpi("Today's OPD",String(opdToday.length));
      setKpi("Today's IPD",String(ipdToday.length));
      setKpi('Occupied Beds',String(activeIpd.length));
      setKpi('Available Beds',String(Math.max(0,Math.max(20,activeIpd.length)-activeIpd.length)));
      setKpi('Revenue Today',money(revenue));
      setKpi('Cash Collection',money(collection));
      setKpi('Pharmacy Sales',money(sumField(pharmToday,'bill_amount')));
      setKpi('Expenses Today',money(sumField(expToday,'amount')));
    }catch(err){console.warn('Dashboard live KPI sync failed',err);}
  }

  function handleChange(payload){
    clearTimeout(updateTimer);
    updateTimer=setTimeout(async()=>{
      if(activeView()==='dashboard')await syncDashboardKpis();
      else if(typeof reviveDifferentialRefresh==='function')reviveDifferentialRefresh();
    },120);
  }

  function scheduleReconnect(){
    if(reconnectTimer)return;
    reconnectTimer=setTimeout(()=>{reconnectTimer=null;startRealtime();},2000);
  }

  function startRealtime(){
    const c=client();
    if(!c||!document.getElementById('appShell')||document.getElementById('appShell').classList.contains('hidden'))return;
    if(channel){try{c.removeChannel(channel)}catch(_){} channel=null;}
    channel=c.channel('revive-live-sync-v2')
      .on('postgres_changes',{event:'*',schema:'public'},handleChange)
      .subscribe(status=>{
        window.reviveRealtimeStatus=status;
        console.info('REVIVE realtime status:',status);
        if(status==='SUBSCRIBED')syncDashboardKpis();
        if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')scheduleReconnect();
      });
  }

  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden){if(window.reviveRealtimeStatus!=='SUBSCRIBED')startRealtime();else syncDashboardKpis();}
  });

  const originalShowApp=typeof showApp==='function'?showApp:null;
  if(originalShowApp){
    window.showApp=function(){const r=originalShowApp.apply(this,arguments);setTimeout(startRealtime,0);return r;};
  }
  setTimeout(startRealtime,300);
})();