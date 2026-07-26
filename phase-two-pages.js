// Phase Two: standardize module panels without changing their content or events.
(function(){
  function directHas(el,selector){
    return [...el.children].some(child=>child.matches?.(selector)||child.querySelector?.(selector));
  }

  function classifyPanel(panel){
    if(!panel||panel.dataset.phaseTwoStyled)return;
    panel.dataset.phaseTwoStyled="true";
    panel.classList.add("hs-module-panel");

    const hasTable=!!panel.querySelector("table,.table-wrap");
    const hasForm=!!panel.querySelector("form,textarea,input:not([type='hidden']),select");
    const buttons=panel.querySelectorAll("button").length;
    const fields=panel.querySelectorAll("input:not([type='hidden']),select,textarea").length;

    if(hasTable&&!hasForm)panel.classList.add("hs-table-panel");
    if(hasForm&&!hasTable)panel.classList.add(fields<=4&&buttons>0?"hs-toolbar-panel":"hs-form-panel");
    if(hasForm&&hasTable)panel.classList.add("hs-form-panel");

    panel.querySelectorAll(":scope > h1,:scope > h2,:scope > h3").forEach(h=>{
      if(h.offsetParent!==null)h.classList.add("hs-section-heading");
    });

    panel.querySelectorAll(".form-row").forEach(row=>{
      const actionButtons=[...row.children].filter(x=>x.matches?.("button")||x.querySelector?.("button"));
      if(actionButtons.length)row.classList.add("hs-action-group");
    });
  }

  function standardizeView(view){
    if(!view||view.classList.contains("hidden"))return;
    [...view.children].forEach(child=>{
      if(child.classList?.contains("panel")||child.classList?.contains("card")||child.classList?.contains("table-wrap"))classifyPanel(child);
    });
    view.querySelectorAll(".panel").forEach(classifyPanel);
  }

  function apply(){
    const subtitle=document.getElementById("pageSubtitle");
    if(subtitle)subtitle.textContent="";
    document.querySelectorAll(".view").forEach(standardizeView);
  }

  let pending=false;
  function schedule(){
    if(pending)return;
    pending=true;
    requestAnimationFrame(()=>{pending=false;apply();});
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",apply);
  else apply();
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
})();
