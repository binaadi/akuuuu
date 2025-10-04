(function(){
  const REDIRECT = "https://google.com";
  let kicked = false;
  let lastBeat = Date.now();

  function forceClose(reason){
    if(kicked) return;
    kicked = true;
    document.body.innerHTML = "";
    console.warn("AntiInspect detect:", reason);
    setTimeout(()=>location.replace(REDIRECT), 150);
  }

  // Worker dengan jebakan debugger
  try {
    const code = `
      "use strict";
      setInterval(()=>{
        try { postMessage(Date.now()); } catch(e){}
        debugger; // <— ini yang bikin tab “pause” kalau DevTools terbuka
      },200);
    `;
    const blob = new Blob([code], {type:"text/javascript"});
    const w = new Worker(URL.createObjectURL(blob));
    w.onmessage = ()=>{ lastBeat = Date.now(); };

    setInterval(()=>{
      if(Date.now()-lastBeat > 1000){
        forceClose("worker-timeout");
      }
    },300);
  } catch(e){}

  // disable somme additional key 
  document.onkeydown = function (e) { 
    // disable F12 
    if (e.keyCode === 123) { return false; } 
    // Windows/Linux 
    if (e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0)) return false; 
    if (e.ctrlKey && e.shiftKey && e.keyCode == 'C'.charCodeAt(0)) return false; 
    if (e.ctrlKey && e.shiftKey && e.keyCode == 'J'.charCodeAt(0)) return false; 
    if (e.ctrlKey && e.keyCode == 'U'.charCodeAt(0)) return false; 
    // macOS (⌘ + ⌥ + I or J) 
    if (e.metaKey && e.altKey && e.keyCode == 'I'.charCodeAt(0)) return false; 
    if (e.metaKey && e.altKey && e.keyCode == 'J'.charCodeAt(0)) return false; 
  };
  document.oncontextmenu = e=>{ e.preventDefault(); return false; };
})();
