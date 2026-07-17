(function(){
  const originalNavForRole=window.navForRole;
  if(typeof originalNavForRole!=="function")return;

  window.navForRole=function(role){
    const items=originalNavForRole(role);
    if(role!=="accountant")return items;
    return items.filter(item=>item!=="supplierMaster"&&item!=="purchaseRegister");
  };

  if(window.currentUser?.role==="accountant"&&typeof window.buildNav==="function"){
    window.buildNav();
    const visible=document.querySelector(".view:not(.hidden)")?.id||"";
    if(visible==="supplierMasterView"||visible==="purchaseRegisterView"){
      window.navigate("expenses");
    }
  }
})();