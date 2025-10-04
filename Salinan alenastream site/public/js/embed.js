
(async () => {
  const token = location.pathname.split("/").pop(); 
  const res = await fetch("/api/videos/by-token/" + encodeURIComponent(token));
  if (!res.ok) return alert("❌ Video tidak ditemukan");
  const v = await res.json();

  const video = document.getElementById("player");
  const container = document.getElementById("videoContainer");
  const overlay = document.getElementById("overlay");
  const loading = document.getElementById("loading");
  const player = new Plyr(video, { fullscreen:{enabled:false} });
  let hls, clickCount = 0, failCount = 0;

  async function getSignedUrl() {
    try {
      const r = await fetch(`/api/videos/public-signed/${v.embed_token}`);
      if (!r.ok) throw new Error("expired");
      return await r.json();
    } catch {
      failCount++;
      return null;
    }
  }

  async function initPreview() {
    const d = await getSignedUrl();
    if (!d?.url) return;

    if (d.type === "iframe") {
      container.innerHTML = `<iframe src="${d.url}" allow="autoplay; fullscreen; encrypted-media" allowfullscreen frameborder="0" style="width:100%;height:100%;"></iframe>`;
      overlay.style.display = "none";
      return;
    }

    if (d.type === "hls" && Hls.isSupported()) {
      hls = new Hls({ autoStartLoad:false });
      hls.loadSource(d.url);
      hls.attachMedia(video);
    } else {
      video.src = d.url;
    }
  }

  async function refreshSignedUrl(playNow=false) {
    const d = await getSignedUrl();
    if (!d?.url) {
      if (failCount > 3) {
        // fallback darurat
        const fallback = v.video_id.endsWith(".mp4") ? v.video_id : v.video_id + ".mp4";
        video.src = fallback;
        video.play().catch(()=>{});
      }
      return;
    }

    const currentTime = player.currentTime || 0;
    loading.style.display = "block";

    if (d.type === "iframe") {
      container.innerHTML = `<iframe src="${d.url}" allow="autoplay; fullscreen; encrypted-media" allowfullscreen frameborder="0" style="width:100%;height:100%;"></iframe>`;
      loading.style.display = "none";
      return;
    }

    if (d.type === "hls") {
      if (Hls.isSupported()) {
        if (hls) hls.destroy();
        hls = new Hls();
        hls.loadSource(d.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.currentTime = currentTime;
          if (playNow) player.play();
        });
        hls.on(Hls.Events.FRAG_BUFFERED, () => loading.style.display = "none");
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = d.url;
        video.currentTime = currentTime;
        if (playNow) player.play();
        loading.style.display = "none";
      }
    } else {
      video.src = d.url;
      video.currentTime = currentTime;
      if (playNow) player.play();
      loading.style.display = "none";
    }
  }

  await initPreview();

  overlay.addEventListener("click", async () => {
    clickCount++;
    if (clickCount === 1) {
      window.open("https://example.com/directlink", "_blank");
    } else if (clickCount === 2) {
      await fetch(`/api/videos/${v.id}/view`, { method:"POST" });
      overlay.style.display = "none";
      await refreshSignedUrl(true);
      setInterval(()=>refreshSignedUrl(false), 45000);
    }
  });

  video.addEventListener("waiting", () => loading.style.display = "block");
  video.addEventListener("playing", () => loading.style.display = "none");
})();

