/* Generated into the static distribution by pwa-plugin.ts. */
const CACHE='tarukh-__VERSION__';
const SHELL=__SHELL__;
const MAX_ENTRIES=180;
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
  // An update waits until the previous game's tabs close, preserving running saves/assets.
});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith('tarukh-')&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||request.headers.has('range'))return;
  const navigation=request.mode==='navigate';
  const launch=new URL('./',self.registration.scope);
  if(navigation&&url.pathname!==launch.pathname&&url.pathname!==`${launch.pathname}index.html`)return;
  if(!navigation&&!/\.(?:js|css|wasm|glb|bin|webp|png|jpg|svg|json|webmanifest)$/.test(url.pathname))return;
  if(url.pathname.includes('/api/')||url.pathname.endsWith('/version.json'))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const key=navigation?launch.href:request;
    // Keep this worker's HTML and stable model URLs on the same release until
    // every active game tab closes and the waiting worker can activate.
    const hit=await cache.match(key);if(hit)return hit;
    try{
      const response=await fetch(request);
      if(response.ok){
        const copy=response.clone();
        event.waitUntil((async()=>{
          try{
            await cache.put(key,copy);
            const keys=await cache.keys();
            if(keys.length>MAX_ENTRIES){
              const removable=keys.filter(k=>!SHELL.some(s=>new URL(s,self.location.origin).href===k.url));
              for(const old of removable.slice(0,keys.length-MAX_ENTRIES))await cache.delete(old);
            }
          }catch{/* Storage pressure never prevents the response reaching the game. */}
        })());
      }
      return response;
    }catch{
      const saved=await cache.match(key);if(saved)return saved;
      return new Response(navigation?'Reconnect once to prepare TARUKH for offline exploration.':'Offline asset unavailable',{status:503,headers:{'Content-Type':'text/plain'}});
    }
  })());
});
