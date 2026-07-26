// Removes repeated headings/taglines from module content while preserving forms and tables.
(function(){
  function cleanView(view){
    if(!view||view.id==="dashboardView")return;
    const firstPanel=[...view.children].find(el=>el.classList?.contains("panel"));
    if(!firstPanel)return;

    const heading=firstPanel.querySelector(":scope > h1:first-child, :scope > h2:first-child, :scope > h3:first-child");
    const intro=heading?.nextElementSibling?.tagName==="P"?heading.nextElementSibling:null;
    const hasUsefulContent=!!firstPanel.querySelector("input,select,textarea,button,table,.grid,.form-row,.table-wrap,.cards,.kpi-grid,form");

    firstPanel.classList.toggle("hs-intro-only",!!heading&&!hasUsefulContent);
    firstPanel.classList.toggle("hs-clean-first",!!heading&&hasUsefulContent);
    if(intro)intro.classList.add("hs-intro-copy");
  }

  function cleanAll(){
    const subtitle=document.getElementById("pageSubtitle");
    if(subtitle)subtitle.textContent="";
    document.querySelectorAll(".view").forEach(cleanView);
  }

  let queued=false;
  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;cleanAll();});
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",cleanAll);
  else cleanAll();

  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
})();
