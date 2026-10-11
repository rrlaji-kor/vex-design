/* 오프라인 캐시: 앱 화면과 도구 파일을 저장해 두고, 인터넷이 없을 때도 열리게 한다.
   Firebase·구글 로그인 요청은 건드리지 않는다. */
const VERSION = '5968353de6';
const CORE = 'core-' + VERSION;
const FILES = ["./", "./index.html", "./config.js", "./seed.js", "./manifest.webmanifest", "./vendor/firebase-app-compat.js", "./vendor/firebase-auth-compat.js", "./vendor/firebase-firestore-compat.js", "./vendor/three.min.js", "./icons/apple-touch-icon.png", "./icons/favicon-32.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png"];
self.addEventListener('install', e => {
  // 브라우저 HTTP 캐시를 건너뛰고 새 파일을 받아 둔다
  e.waitUntil(caches.open(CORE).then(c => c.addAll(FILES.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('core-') && k !== CORE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// 화면(index)·설정·처음 자료는 인터넷 먼저, 안 되면 저장해 둔 것
const FRESH = ['index.html', 'config.js', 'seed.js'];
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    const name = url.pathname.split('/').pop() || 'index.html';
    const nav = req.mode === 'navigate';
    if (nav || FRESH.includes(name)) {
      const key = nav ? './index.html' : url.pathname;
      e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CORE).then(c => c.put(key, copy)); }
        return res;
      }).catch(() => caches.match(key, { ignoreSearch: true }).then(hit => hit || Response.error())));
      return;
    }
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CORE).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open('fonts').then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }))));
  }
});
