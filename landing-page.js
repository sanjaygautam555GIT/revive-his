(function(){
  function showLogin(){
    const landing=document.getElementById('landingPage');
    const login=document.getElementById('loginPage');
    if(landing)landing.classList.add('hidden');
    if(login)login.classList.remove('hidden');
    setTimeout(()=>document.getElementById('username')?.focus(),80);
  }
  function showLanding(){
    const landing=document.getElementById('landingPage');
    const login=document.getElementById('loginPage');
    if(login)login.classList.add('hidden');
    if(landing)landing.classList.remove('hidden');
    window.scrollTo({top:0,behavior:'smooth'});
  }
  window.showReviveLogin=showLogin;
  window.showReviveLanding=showLanding;
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('[data-open-login]').forEach(b=>b.addEventListener('click',showLogin));
    document.getElementById('backToLandingBtn')?.addEventListener('click',showLanding);
  });
})();