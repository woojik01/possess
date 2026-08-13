
const CACHE_NAME = 'possess-v0.1.0-pwa';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/game.js',
  './js/admob.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './assets/sprites/parasite.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if(e.request.method!=='GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if(cached) return cached;
      return fetch(e.request).then(res=>{
        // cache dynamic
        const clone=res.clone();
        caches.open(CACHE_NAME).then(cache=>cache.put(e.request, clone));
        return res;
      }).catch(()=>caches.match('./index.html'));
    })
  );
});
