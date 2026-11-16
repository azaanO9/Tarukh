import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function worker({offline=false,full=false}={}){
  const handlers={},store=new Map(),pending=[];
  const key=r=>typeof r==='string'?r:r.url;
  const cache={match:async r=>store.get(key(r))?.clone(),put:async(r,v)=>{if(full)throw Error('quota');store.set(key(r),v.clone());},keys:async()=>[...store.keys()].map(url=>new Request(url)),delete:async r=>store.delete(key(r)),addAll:async()=>{}};
  const source=fs.readFileSync(new URL('../scripts/service-worker.js',import.meta.url),'utf8').replace('__VERSION__','test').replace('__SHELL__',JSON.stringify(['/Tarukh/']));
  vm.runInNewContext(source,{URL,Response,Request,caches:{open:async()=>cache,keys:async()=>[],delete:async()=>true},self:{location:{origin:'https://game.test'},registration:{scope:'https://game.test/Tarukh/'},clients:{claim:async()=>{}},addEventListener:(n,fn)=>handlers[n]=fn},fetch:async()=>{if(offline)throw Error('offline');return new Response('asset');}});
  return {store,async request(url,mode='cors'){
    let response;
    const request={url,method:'GET',mode,headers:new Headers()};
    handlers.fetch({request,respondWith:r=>response=r,waitUntil:p=>pending.push(p)});
    const result=await response;await Promise.all(pending);return result;
  }};
}
test('offline navigation restores the cached shell regardless of debug/query parameters',async()=>{
  const w=worker({offline:true});w.store.set('https://game.test/Tarukh/',new Response('saved shell'));
  assert.equal(await(await w.request('https://game.test/Tarukh/?device=mobile','navigate')).text(),'saved shell');
});
test('an active release keeps its shell and models together while an update waits',async()=>{
  const w=worker();
  w.store.set('https://game.test/Tarukh/',new Response('current release shell'));
  w.store.set('https://game.test/Tarukh/models/astronaut.glb',new Response('current release model'));
  assert.equal(await(await w.request('https://game.test/Tarukh/?device=mobile','navigate')).text(),'current release shell');
  assert.equal(await(await w.request('https://game.test/Tarukh/models/astronaut.glb')).text(),'current release model');
});
test('the separate Starbase preview and unrelated pages cannot replace the game shell',async()=>{
  const w=worker();w.store.set('https://game.test/Tarukh/',new Response('game shell'));
  assert.equal(await w.request('https://game.test/Tarukh/starbase.html','navigate'),undefined);
  assert.equal(await w.request('https://game.test/another-app/','navigate'),undefined);
  assert.equal(await(await w.request('https://game.test/Tarukh/index.html','navigate')).text(),'game shell');
});
test('third-party science and API requests bypass the asset cache',async()=>{
  const w=worker();
  assert.equal(await w.request('https://services.swpc.noaa.gov/protons.json'),undefined);
  assert.equal(await w.request('https://game.test/api/current.json'),undefined);
  assert.equal(w.store.size,0);
});
test('a full cache never interrupts a successful model download',async()=>{
  const w=worker({full:true});assert.equal(await(await w.request('https://game.test/Tarukh/models/astronaut.glb')).text(),'asset');
});
test('models use their cache on repeat visits while a missing offline asset fails clearly',async()=>{
  const w=worker({offline:true});w.store.set('https://game.test/Tarukh/models/astronaut.glb',new Response('cached model'));
  assert.equal(await(await w.request('https://game.test/Tarukh/models/astronaut.glb')).text(),'cached model');
  assert.equal((await w.request('https://game.test/Tarukh/models/missing.glb')).status,503);
});
