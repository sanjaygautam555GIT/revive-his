// Professional application shell enhancements for Revive HealthScope.
(function(){
  const paths={
    dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/>',
    cash:'<path d="M6 2h9a4 4 0 0 1 0 8H6"/><path d="M6 6h10"/><path d="m7 10 8 10"/>',
    reports:'<path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19V3"/>',
    plus:'<path d="M12 5v14"/><path d="M5 12h14"/>',
    bed:'<path d="M3 7v11"/><path d="M3 14h18v4"/><path d="M7 14V8h6a4 4 0 0 1 4 4v2"/><path d="M7 10H4"/>',
    diagnostics:'<path d="M9 3h6"/><path d="M10 9 5 20h14L14 9"/><path d="M8 15h8"/>',
    doctor:'<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/><path d="M18 8h4"/><path d="M20 6v4"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    pharmacy:'<path d="m10.5 20.5 10-10a4.24 4.24 0 0 0-6-6l-10 10a4.24 4.24 0 0 0 6 6Z"/><path d="m8.5 8.5 7 7"/>',
    purchase:'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    supplier:'<path d="M3 21h18"/><path d="M6 21V7l6-4 6 4v14"/><path d="M9 21v-5h6v5"/>',
    billing:'<path d="M6 2h9l3 3v17l-3-2-3 2-3-2-3 2Z"/><path d="M9 9h6"/><path d="M9 13h6"/>',
    expenses:'<circle cx="12" cy="12" r="9"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 6v12"/>',
    print:'<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    export:'<path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/>',
    save:'<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
    delete:'<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 15H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    signout:'<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 19V5a2 2 0 0 0-2-2h-6"/>',
    close:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
  };

  function svg(name,cls='hs-icon'){
    return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name]||paths.search}</svg>`;
  }

  function navIcon(label){
    const text=String(label||'').toLowerCase();
    if(text.includes('dashboard'))return 'dashboard';
    if(text.includes('patient'))return 'search';
    if(text.includes('cash'))return 'cash';
    if(text.includes('report'))return 'reports';
    if(text==='opd')return 'plus';
    if(text.includes('ipd'))return 'bed';
    if(text.includes('diagnostic'))return 'diagnostics';
    if(text.includes('doctor'))return 'doctor';
    if(text.includes('user'))return 'users';
    if(text.includes('pharmacy'))return 'pharmacy';
    if(text.includes('purchase'))return 'purchase';
    if(text.includes('supplier'))return 'supplier';
    if(text.includes('billing'))return 'billing';
    if(text.includes('expense')||text.includes('financial'))return 'expenses';
    return 'dashboard';
  }

  function actionIcon(text){
    const t=String(text||'').trim().toLowerCase();
    if(/sign out|logout/.test(t))return 'signout';
    if(/new|add|create/.test(t))return 'plus';
    if(/search|find/.test(t))return 'search';
    if(/print/.test(t))return 'print';
    if(/export|download/.test(t))return 'export';
    if(/save|submit|update/.test(t))return 'save';
    if(/delete|remove/.test(t))return 'delete';
    if(/edit|change/.test(t))return 'edit';
    if(t==='close'||t==='×')return 'close';
    return '';
  }

  function currentDisplayName(){return String(currentUser?.name||currentUser?.display_name||currentUser?.username||'User').trim()||'User'}
  function currentRoleLabel(){return ROLE_LABELS?.[currentUser?.role]||document.getElementById('roleBadge')?.textContent||''}

  function refreshUserChip(){
    const chip=document.querySelector('#topbarTools .user-chip');if(!chip)return;
    const name=currentDisplayName();
    const avatar=chip.querySelector('.user-avatar');const nameEl=chip.querySelector('strong');const roleEl=chip.querySelector('small');
    if(avatar)avatar.textContent=name.charAt(0).toUpperCase();if(nameEl)nameEl.textContent=name;if(roleEl)roleEl.textContent=currentRoleLabel();
  }

  function enhanceActionIcons(root=document){
    root.querySelectorAll('button,a.hs-btn').forEach(button=>{
      if(button.dataset.iconEnhanced==='true'||button.querySelector(':scope > svg.hs-action-icon'))return;
      const name=actionIcon(button.textContent||button.getAttribute('aria-label'));
      if(!name)return;
      button.insertAdjacentHTML('afterbegin',svg(name,'hs-icon hs-action-icon'));
      button.dataset.iconEnhanced='true';
    });
  }

  function enhanceShell(){
    const sidebar=document.querySelector('.sidebar');const title=sidebar?.querySelector('h2');
    if(sidebar&&title&&!document.getElementById('brandBlock')){
      const brand=document.createElement('div');brand.id='brandBlock';brand.className='brand-block';
      brand.innerHTML='<div class="brand-mark">RH</div><div><strong>Revive HealthScope</strong><small>Smart Healthcare Platform</small></div>';title.replaceWith(brand);
    }
    const topbar=document.querySelector('.topbar');const logout=document.getElementById('logoutBtn');
    if(topbar&&logout&&!document.getElementById('topbarTools')){
      const tools=document.createElement('div');tools.id='topbarTools';tools.className='topbar-tools';
      tools.innerHTML='<div class="live-clock"><strong id="healthScopeTime"></strong><span id="healthScopeDate"></span></div><div class="user-chip"><span class="user-avatar">U</span><div><strong>User</strong><small></small></div></div>';
      topbar.insertBefore(tools,logout);logout.textContent='Sign out';
    }
    refreshUserChip();
    document.querySelectorAll('#mainNav button').forEach(button=>{
      const label=button.dataset.iconLabel||button.textContent.trim();button.dataset.iconLabel=label;
      button.innerHTML=`<span class="nav-icon">${svg(navIcon(label))}</span><span>${label}</span>`;button.dataset.enhanced='true';
    });
    enhanceActionIcons(document);
  }

  function updateClock(){
    const now=new Date();const time=document.getElementById('healthScopeTime');const date=document.getElementById('healthScopeDate');
    if(time)time.textContent=now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
    if(date)date.textContent=now.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
  }

  const originalBuildNav=window.buildNav;if(typeof originalBuildNav==='function')window.buildNav=function(){originalBuildNav();enhanceShell()};
  const originalShowApp=window.showApp;if(typeof originalShowApp==='function')window.showApp=function(){originalShowApp();enhanceShell();refreshUserChip();updateClock()};
  const originalNavigate=window.navigate;if(typeof originalNavigate==='function')window.navigate=async function(){const result=await originalNavigate.apply(this,arguments);enhanceActionIcons(document.querySelector('.view:not(.hidden)')||document);return result};

  window.refreshHealthScopeUserChip=refreshUserChip;window.enhanceHealthScopeIcons=enhanceActionIcons;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{enhanceShell();updateClock()});else{enhanceShell();updateClock()}
  setInterval(updateClock,30000);
})();