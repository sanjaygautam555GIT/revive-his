// Soft click sound and lightweight interaction feedback.
(function(){
  let audioContext=null;
  let lastSoundAt=0;

  function getAudioContext(){
    if(audioContext)return audioContext;
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)return null;
    audioContext=new AudioCtx();
    return audioContext;
  }

  function playClickSound(){
    const now=Date.now();
    if(now-lastSoundAt<45)return;
    lastSoundAt=now;
    try{
      const ctx=getAudioContext();
      if(!ctx)return;
      if(ctx.state==="suspended")ctx.resume();
      const oscillator=ctx.createOscillator();
      const gain=ctx.createGain();
      oscillator.type="sine";
      oscillator.frequency.setValueAtTime(520,ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(360,ctx.currentTime+.035);
      gain.gain.setValueAtTime(.018,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.045);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime+.05);
    }catch(_){/* Sound must never interrupt the app. */}
  }

  function addRipple(target,event){
    if(!(target instanceof HTMLElement))return;
    target.classList.add("hs-ripple","hs-click-pulse");
    const rect=target.getBoundingClientRect();
    const diameter=Math.max(rect.width,rect.height);
    const dot=document.createElement("span");
    dot.className="hs-ripple-dot";
    dot.style.width=dot.style.height=diameter+"px";
    dot.style.left=(event.clientX?event.clientX-rect.left-diameter/2:rect.width/2-diameter/2)+"px";
    dot.style.top=(event.clientY?event.clientY-rect.top-diameter/2:rect.height/2-diameter/2)+"px";
    target.appendChild(dot);
    setTimeout(()=>{dot.remove();target.classList.remove("hs-click-pulse");},500);
  }

  document.addEventListener("pointerdown",function(event){
    const target=event.target.closest("button,a,[role='button'],summary,.modern-kpi,.dashboard-alert-card,table tbody tr");
    if(!target||target.hasAttribute("disabled"))return;
    playClickSound();
    if(target.matches("button,a,[role='button'],summary"))addRipple(target,event);
  },{passive:true});

  document.addEventListener("change",function(event){
    if(event.target.matches("select,input[type='checkbox'],input[type='radio']"))playClickSound();
  },{passive:true});
})();
