// Global progress, skeleton and fade-in behavior without changing module business logic.
(function(){
  const skeleton=`<div class="hs-view-skeleton" aria-label="Loading module"><div class="hs-skeleton-toolbar"></div><div class="hs-skeleton-grid"><div class="hs-skeleton-stat"></div><div class="hs-skeleton-stat"></div><div class="hs-skeleton-stat"></div><div class="hs-skeleton-stat"></div></div><div class="hs-skeleton-card"></div></div>`;
  let activeLoads=0;

  function ensureProgress(){
    if(document.getElementById("hsProgress"))return;
    const el=document.createElement("div");
    el.id="hsProgress";
    el.setAttribute("aria-hidden","true");
    el.innerHTML='<div id="hsProgressBar"></div>';
    document.body.appendChild(el);
  }
  function start(){activeLoads++;ensureProgress();document.body.classList.add("hs-loading")}
  function stop(){activeLoads=Math.max(0,activeLoads-1);if(!activeLoads)setTimeout(()=>document.body.classList.remove("hs-loading"),120)}
  function animateView(view){
    if(!view)return;
    view.classList.remove("hs-view-enter");
    void view.offsetWidth;
    view.classList.add("hs-view-enter");
    view.querySelectorAll(":scope > .panel,:scope > .hs-page > .hs-card,:scope > .hs-page > .hs-layout > .hs-card,:scope > .card").forEach((el,i)=>{
      el.classList.remove("hs-content-enter");
      el.style.animationDelay=`${Math.min(i*35,140)}ms`;
      el.classList.add("hs-content-enter");
    });
  }
  function showSkeleton(name){
    const view=document.getElementById(name+"View");
    if(view)view.innerHTML=skeleton;
  }

  window.hsLoading={start,stop,showSkeleton,animateView};

  function wrapNavigation(){
    if(typeof window.navigate!=="function"||window.navigate.__hsWrapped)return;
    const original=window.navigate;
    const wrapped=async function(name){
      start();
      const target=document.getElementById(name+"View");
      if(target&&!target.innerHTML.trim())showSkeleton(name);
      try{
        const result=await original.apply(this,arguments);
        animateView(document.getElementById(name+"View"));
        return result;
      }finally{stop()}
    };
    wrapped.__hsWrapped=true;
    window.navigate=wrapped;
  }

  function markAsyncButtons(){
    document.addEventListener("click",e=>{
      const btn=e.target.closest("button[type='submit'],button[id*='save' i],button[id*='search' i],button[id*='load' i]");
      if(!btn||btn.disabled)return;
      btn.classList.add("hs-busy");
      setTimeout(()=>btn.classList.remove("hs-busy"),900);
    });
  }

  function observeContent(){
    let queued=false;
    const observer=new MutationObserver(records=>{
      if(queued)return;
      // Animate only when substantial top-level UI blocks are inserted.
      // Text/value refreshes (such as live pharmacy totals) must not restart
      // the whole page animation.
      const relevant=records.some(record=>{
        if(record.type!=="childList"||!record.addedNodes.length)return false;
        return Array.from(record.addedNodes).some(node=>{
          if(node.nodeType!==Node.ELEMENT_NODE)return false;
          const el=node;
          return el.classList?.contains("panel")||
            el.classList?.contains("card")||
            el.classList?.contains("hs-page")||
            el.classList?.contains("hs-card")||
            el.classList?.contains("hs-layout")||
            el.classList?.contains("hs-view-skeleton");
        });
      });
      if(!relevant)return;
      queued=true;
      requestAnimationFrame(()=>{
        queued=false;
        const visible=document.querySelector(".view:not(.hidden)");
        if(visible&&!visible.querySelector(".hs-view-skeleton"))animateView(visible);
      });
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  function init(){ensureProgress();wrapNavigation();markAsyncButtons();observeContent()}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
