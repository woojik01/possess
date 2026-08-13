const CACHE_NAME = 'possess-v0.1.1-pwa';
const ASSETS = [
  './','./index.html','./style.css','./manifest.json','./js/game.js','./js/admob.js',
  './icons/icon-192.png','./icons/icon-512.png',
  './assets/sprites/parasite.png','./assets/sprites/crawl.png','./assets/sprites/spitter.png','./assets/sprites/hopper.png','./assets/sprites/charger.png','./assets/sprites/phantom.png','./assets/sprites/blight.png','./assets/sprites/wraith.png','./assets/sprites/gorger.png','./assets/sprites/seer.png','./assets/sprites/mother.png',
  './assets/tiles/floor.png','./assets/tiles/platform.png','./assets/tiles/wall.png','./assets/tiles/ceiling.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if(e.request.method!=='GET') return;
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(res=>{
    const clone=res.clone(); caches.open(CACHE_NAME).then(cache=>cache.put(e.request,clone)); return res;
  }).catch(()=>caches.match('./index.html'))));
});