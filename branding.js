// Safe Revive HealthScope branding layer.
// Runs once after the DOM is ready and never observes or rewrites app mutations.
(function(){
  "use strict";

  function setText(selector,text){
    const element=document.querySelector(selector);
    if(element)element.textContent=text;
  }

  function applyBranding(){
    try{
      document.title="Revive HealthScope";
      setText("#loginPage .login-card h1","Revive HealthScope");
      setText("#loginPage .login-card > p","Smart Healthcare Management Platform");
      setText(".sidebar h2","Revive HealthScope");

      const loginCard=document.querySelector(".login-card");
      if(loginCard&&!document.getElementById("healthScopeFooter")){
        const footer=document.createElement("p");
        footer.id="healthScopeFooter";
        footer.className="brand-footer";
        footer.textContent=`© ${new Date().getFullYear()} Revive HealthScope`;
        loginCard.appendChild(footer);
      }
    }catch(error){
      // Branding must never stop authentication or application loading.
      console.warn("Branding could not be applied:",error);
    }
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",applyBranding,{once:true});
  }else{
    applyBranding();
  }
})();