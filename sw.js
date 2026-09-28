const CACHE="mbo-v4-shell-codes8";
const SHELL=["./","./index.html","./styles.css","./db.js","./vendor/bwip-js-min.js","./vendor/zxing-library.min.js","./vendor/zxing-browser.min.js","./app.js","./manifest.webmanifest","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(resp=>{
    if(resp&&resp.ok&&new URL(e.request.url).origin===self.location.origin)caches.open(CACHE).then(c=>c.put(e.request,resp.clone()));
    return resp;
  }).catch(()=>cached)));
});