/* =========================================================
   설치형 앱: 오프라인 캐시 등록 · 새 버전 알림 · "앱 설치" 버튼
   ========================================================= */
(function () {
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator && secure) {
    const sw = navigator.serviceWorker;
    let ctl = sw.controller;
    // 새 버전이 설치돼 화면을 넘겨받으면 알려 준다 (처음 설치할 때는 빼고)
    sw.addEventListener('controllerchange', () => {
      const had = ctl; ctl = sw.controller;
      if (!had || typeof S !== 'object') return;
      S.updateReady = true;
      if (typeof renderChrome === 'function' && els && els.app) renderChrome();
    });
    window.addEventListener('load', () => {
      sw.register('./sw.js').then(reg => {
        // 앱을 오래 켜 둬도 다시 볼 때 새 버전이 있는지 확인 (10분에 한 번까지)
        let last = Date.now();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState !== 'visible' || Date.now() - last < 600000) return;
          last = Date.now(); reg.update().catch(() => {});
        });
      }).catch(() => {});
    });
  }
  let deferred = null;
  const btn = () => document.getElementById('installBtn');
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); deferred = e;
    const b = btn(); if (b) b.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    deferred = null; const b = btn(); if (b) b.hidden = true;
    if (typeof toast === 'function') toast('앱을 설치했어요. 이제 아이콘으로 열 수 있어요');
  });
  document.addEventListener('click', e => {
    if (!e.target.closest || !e.target.closest('#installBtn') || !deferred) return;
    deferred.prompt();
    deferred.userChoice.finally(() => { deferred = null; const b = btn(); if (b) b.hidden = true; });
  });
})();
