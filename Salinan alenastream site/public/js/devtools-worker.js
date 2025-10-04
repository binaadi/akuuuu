// worker code (string)
onmessage = function(ev){
  // kirim sinyal mulai
  postMessage({ isOpenBeat: true });
  // PAUSE kalau DevTools dipakai / ada breakpoint (debugger)
  debugger;
  // optional heavy loop (akan dieksekusi setelah resume)
  for (let i = 0; i < (ev.data?.moreDebugs || 0); i++){
    // bisa jadi heavy op kalau mau menimbulkan delay saat debug
    Math.sqrt(i);
  }
  // kirim sinyal selesai
  postMessage({ isOpenBeat: false });
};
