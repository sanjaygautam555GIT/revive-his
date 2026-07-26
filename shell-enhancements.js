// Professional application shell enhancements for Revive HealthScope.
(function(){
  const icons={
    Dashboard:"▦",Patient:"⌕",Cash:"₹",Reports:"▤",OPD:"＋",IPD:"▣",Diagnostics:"◉",Doctor:"⚕",User:"♙",Pharmacy:"✚",Purchase:"↓",Supplier:"♧",Expenses:"₹",Financial:"▥",Billing:"▧"
  };

  function iconFor(label){
    const key=Object.keys(icons).find(k=>String(label||"").includes(k));
    return icons[key]||"•";
  }

  function enhanceShell(){
    const sidebar=document.querySelector(".sidebar");
    const title=sidebar?.querySelector("h2");
    if(sidebar&&title&&!document.getElementById("brandBlock")){
      const brand=document.createElement("div");
      brand.id="brandBlock";
      brand.className="brand-block";
      brand.innerHTML=`<div class="brand-mark">RH</div><div><strong>Revive HealthScope</strong><small>Smart Healthcare Platform</small></div>`;
      title.replaceWith(brand);
    }

    const topbar=document.querySelector(".topbar");
    const logout=document.getElementById("logoutBtn");
    if(topbar&&logout&&!document.getElementById("topbarTools")){
      const tools=document.createElement("div");
      tools.id="topbarTools";
      tools.className="topbar-tools";
      tools.innerHTML=`<div class="live-clock"><strong id="healthScopeTime"></strong><span id="healthScopeDate"></span></div><div class="user-chip"><span class="user-avatar">${String(currentUser?.name||currentUser?.username||"U").trim().charAt(0).toUpperCase()}</span><div><strong>${currentUser?.name||currentUser?.username||"User"}</strong><small>${document.getElementById("roleBadge")?.textContent||""}</small></div></div>`;
      topbar.insertBefore(tools,logout);
      logout.textContent="Sign out";
    }

    document.querySelectorAll("#mainNav button").forEach(button=>{
      if(button.dataset.enhanced)return;
      const label=button.textContent.trim();
      button.innerHTML=`<span class="nav-icon">${iconFor(label)}</span><span>${label}</span>`;
      button.dataset.enhanced="true";
    });
  }

  function updateClock(){
    const now=new Date();
    const time=document.getElementById("healthScopeTime");
    const date=document.getElementById("healthScopeDate");
    if(time)time.textContent=now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
    if(date)date.textContent=now.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
  }

  const originalBuildNav=window.buildNav;
  if(typeof originalBuildNav==="function"){
    window.buildNav=function(){originalBuildNav();enhanceShell();};
  }
  const originalShowApp=window.showApp;
  if(typeof originalShowApp==="function"){
    window.showApp=function(){originalShowApp();enhanceShell();updateClock();};
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{enhanceShell();updateClock();});
  else {enhanceShell();updateClock();}
  setInterval(updateClock,30000);
})();