// Global professional notifications for Revive HealthScope.
(function(){
  const seenMessages=new WeakSet();
  const deleteBypass=new WeakSet();

  function region(){
    let el=document.getElementById('hsToastRegion');
    if(!el){el=document.createElement('div');el.id='hsToastRegion';el.className='hs-toast-region';el.setAttribute('aria-live','polite');el.setAttribute('aria-atomic','true');document.body.appendChild(el)}
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
    const close=()=>{if(toast.classList.contains('is-leaving'))return;toast.classList.add('is-leaving');setTimeout(()=>toast.remove(),190)};
    toast.querySelector('.hs-toast-close').onclick=close;
    region().appendChild(toast);
    const duration=options.duration??(type==='error'?5200:3600);
    if(duration>0)setTimeout(close,duration);
    return toast;
  };
  window.hsConfirm=function(message,options={}){
    return new Promise(resolve=>{
      const wrap=document.createElement('div');wrap.className='hs-confirm-backdrop';
      wrap.innerHTML=`<div class="hs-confirm" role="dialog" aria-modal="true"><h3>${options.title||'Confirm deletion'}</h3><p></p><div class="hs-confirm-actions"><button class="hs-confirm-cancel">Cancel</button><button class="hs-confirm-danger">${options.confirmText||'Delete'}</button></div></div>`;
      wrap.querySelector('p').textContent=message||'This action cannot be undone.';
      const done=value=>{wrap.remove();resolve(value)};
      wrap.querySelector('.hs-confirm-cancel').onclick=()=>done(false);
      wrap.querySelector('.hs-confirm-danger').onclick=()=>done(true);
      wrap.addEventListener('click',e=>{if(e.target===wrap)done(false)});
      document.body.appendChild(wrap);wrap.querySelector('.hs-confirm-cancel').focus();
    });
  };

  const nativeAlert=window.alert.bind(window);
  window.alert=function(message){hsToast(message,normalizeType(null,message));};

  document.addEventListener('invalid',e=>{
    const field=e.target;const label=field.labels?.[0]?.textContent?.trim()||field.getAttribute('aria-label')||field.name||'This field';
    hsToast(`${label} is required or contains an invalid value.`,'error',{title:'Check the form'});
  },true);

  document.addEventListener('click',async e=>{
    const button=e.target.closest('button,a');if(!button)return;
    const text=(button.textContent||button.getAttribute('aria-label')||'').trim();
    if(!/delete|remove/i.test(text)||button.dataset.noConfirm==='true')return;
    if(deleteBypass.has(button)){deleteBypass.delete(button);return;}
    e.preventDefault();e.stopImmediatePropagation();
    const ok=await hsConfirm('Delete this record? This action cannot be undone.');
    if(ok){deleteBypass.add(button);button.click();}
  },true);

  window.addEventListener('afterprint',()=>hsToast('Print dialog completed.','success',{title:'Print complete'}));

  function surfaceMessage(node){
    if(!(node instanceof Element)||seenMessages.has(node))return;
    if(!node.matches('.success,.error,.warning,[class*="stock-warning"],[class*="low-stock"]'))return;
    const text=node.textContent.trim();if(!text)return;
    seenMessages.add(node);
    const type=node.matches('.error')?'error':node.matches('.warning,[class*="stock-warning"],[class*="low-stock"]')?'warning':'success';
    hsToast(text,type);
  }
  const observer=new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(node=>{if(node instanceof Element){surfaceMessage(node);node.querySelectorAll?.('.success,.error,.warning,[class*="stock-warning"],[class*="low-stock"]').forEach(surfaceMessage)}})));
  function start(){region();document.querySelectorAll('.success,.error,.warning,[class*="stock-warning"],[class*="low-stock"]').forEach(surfaceMessage);observer.observe(document.body,{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();