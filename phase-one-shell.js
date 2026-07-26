// Phase One: responsive, collapsible application shell.
(function(){
  function addShellControls(){
    const topbar=document.querySelector('.topbar');
    const sidebar=document.querySelector('.sidebar');
    if(!topbar||!sidebar)return;

    if(!document.getElementById('shellMenuBtn')){
      const menu=document.createElement('button');
      menu.id='shellMenuBtn';
      menu.type='button';
      menu.className='shell-menu-btn';
      menu.setAttribute('aria-label','Open navigation');
      menu.textContent='☰';
      menu.onclick=()=>document.body.classList.toggle('mobile-nav-open');
      topbar.insertBefore(menu,topbar.firstChild);
    }

    const brand=document.getElementById('brandBlock');
    if(brand){
      const copy=brand.querySelector('div:last-child');
      if(copy)copy.classList.add('brand-copy');
      if(!document.getElementById('shellCollapseBtn')){
        const collapse=document.createElement('button');
        collapse.id='shellCollapseBtn';
        collapse.type='button';
        collapse.className='shell-collapse-btn';
        collapse.setAttribute('aria-label','Collapse navigation');
        collapse.textContent='‹';
        collapse.onclick=()=>{
          const collapsed=document.body.classList.toggle('sidebar-collapsed');
          collapse.textContent=collapsed?'›':'‹';
          try{localStorage.setItem('healthscopeSidebarCollapsed',collapsed?'1':'0');}catch(e){}
        };
        brand.appendChild(collapse);
      }
    }

    if(!document.querySelector('.sidebar-footer')){
      const footer=document.createElement('div');
      footer.className='sidebar-footer';
      footer.textContent='Revive HealthScope';
      sidebar.appendChild(footer);
    }

    if(!document.getElementById('shellOverlay')){
      const overlay=document.createElement('div');
      overlay.id='shellOverlay';
      overlay.className='shell-overlay';
      overlay.onclick=()=>document.body.classList.remove('mobile-nav-open');
      document.body.appendChild(overlay);
    }

    document.querySelectorAll('#mainNav button').forEach(button=>{
      if(button.dataset.shellCloseBound)return;
      button.dataset.shellCloseBound='1';
      button.addEventListener('click',()=>document.body.classList.remove('mobile-nav-open'));
    });
  }

  function restoreState(){
    try{
      if(localStorage.getItem('healthscopeSidebarCollapsed')==='1'){
        document.body.classList.add('sidebar-collapsed');
      }
    }catch(e){}
  }

  restoreState();
  const originalBuildNav=window.buildNav;
  if(typeof originalBuildNav==='function'){
    window.buildNav=function(){
      const result=originalBuildNav.apply(this,arguments);
      addShellControls();
      return result;
    };
  }
  const originalShowApp=window.showApp;
  if(typeof originalShowApp==='function'){
    window.showApp=function(){
      const result=originalShowApp.apply(this,arguments);
      addShellControls();
      return result;
    };
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addShellControls);
  else addShellControls();
  window.addEventListener('resize',()=>{if(window.innerWidth>900)document.body.classList.remove('mobile-nav-open');});
})();
