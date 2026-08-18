(function(){
  function enableLandingScroll(){
    const landing=document.getElementById('landingPage');
    if(!landing || landing.classList.contains('hidden')) return;
    document.documentElement.style.setProperty('height','auto','important');
    document.documentElement.style.setProperty('min-height','100%','important');
    document.documentElement.style.setProperty('overflow-x','hidden','important');
    document.documentElement.style.setProperty('overflow-y','auto','important');
    document.body.style.setProperty('height','auto','important');
    document.body.style.setProperty('min-height','100%','important');
    document.body.style.setProperty('overflow-x','hidden','important');
    document.body.style.setProperty('overflow-y','auto','important');
    document.body.style.setProperty('position','static','important');
    landing.style.setProperty('height','auto','important');
    landing.style.setProperty('min-height','100vh','important');
    landing.style.setProperty('overflow-x','hidden','important');
    landing.style.setProperty('overflow-y','visible','important');
  }
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
    enableLandingScroll();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  window.showReviveLogin=showLogin;
  window.showReviveLanding=showLanding;
  document.addEventListener('DOMContentLoaded',()=>{
    enableLandingScroll();
    document.querySelectorAll('[data-open-login]').forEach(b=>b.addEventListener('click',showLogin));
    document.getElementById('backToLandingBtn')?.addEventListener('click',showLanding);
  });
})();