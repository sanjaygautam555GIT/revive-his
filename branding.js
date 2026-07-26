// Revive HealthScope branding layer.
(function(){
  const replacements=[
    [/Revive Hospital HIS v2\.0/gi,"Revive HealthScope"],
    [/Revive HIS/gi,"Revive HealthScope"],
    [/Hospital Information System v2\.0/gi,"Smart Healthcare Management Platform"]
  ];

  function applyBranding(root=document){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      if(["SCRIPT","STYLE","TEXTAREA"].includes(node.parentElement?.tagName))return;
      let value=node.nodeValue;
      replacements.forEach(([pattern,replacement])=>{value=value.replace(pattern,replacement);});
      if(value!==node.nodeValue)node.nodeValue=value;
    });

    document.title="Revive HealthScope";
  }

  function addBrandFooter(){
    const loginCard=document.querySelector(".login-card");
    if(loginCard&&!document.getElementById("healthScopeFooter")){
      const footer=document.createElement("p");
      footer.id="healthScopeFooter";
      footer.className="brand-footer";
      footer.textContent=`© ${new Date().getFullYear()} Revive HealthScope`;
      loginCard.appendChild(footer);
    }
  }

  function refresh(){
    applyBranding();
    addBrandFooter();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",refresh);
  else refresh();

  const observer=new MutationObserver(()=>refresh());
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
