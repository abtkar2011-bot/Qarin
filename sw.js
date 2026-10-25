// قارِن — يخلي الموقع يشتغل مثل التطبيق، ويفتح بسرعة حتى لو النت ضعيف
const CACHE = 'qarin-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;     // طلبات المتاجر والسيرفر تمشي عادي
  if (url.pathname.includes('/data/')) return;     // ملفات المنتجات: من النت دايمًا
  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    // الصفحات: من النت أول (عشان التحديثات توصل على طول)، ولو ما فيه نت من النسخة المحفوظة
    e.respondWith(fetch(req.url, { cache: 'no-cache' }).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return r;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
