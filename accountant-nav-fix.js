(function(){
  const originalNavForRole=window.navForRole;
  if(typeof originalNavForRole==="function"){
    window.navForRole=function(role){
      const items=originalNavForRole(role);
      if(role==="accountant")return items.filter(item=>item!=="supplierMaster"&&item!=="purchaseRegister");
      return items;
    };
  }

  if(window.currentUser?.role==="accountant"&&typeof window.buildNav==="function"){
    window.buildNav();
    const visible=document.querySelector(".view:not(.hidden)")?.id||"";
    if(visible==="supplierMasterView"||visible==="purchaseRegisterView")window.navigate("expenses");
  }

  if(!document.querySelector('script[src="doctor-portal-nav-v3.js"]')){
    const s=document.createElement('script');
    s.src='doctor-portal-nav-v3.js';
    s.onload=function(){
      if(window.currentUser?.role==='doctor'&&typeof window.buildNav==='function'){
        window.buildNav();
        window.navigate('doctorDashboard');
      }
    };
    document.body.appendChild(s);
  }
})();