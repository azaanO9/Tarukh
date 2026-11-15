import test from "node:test"; import assert from "node:assert/strict";
import { graphicsTier, graphicsTiers, graphicsEffects } from "../ui/world/graphicsTiers.ts";
test("performance is cheaper than auto and no tier uses large runtime textures",()=>{const p=graphicsTier("performance"),a=graphicsTier("auto");assert.ok(p.resolutionCap<a.resolutionCap);assert.ok(p.smallRocks<a.smallRocks);assert.ok(p.particles<a.particles);assert.equal(p.shadows,false);assert.equal(p.bloom,false);assert.equal(p.ssao,false);for(const tier of Object.values(graphicsTiers))assert.ok(tier.terrainTexture<=1024)});
test("tier post processing has a predictable fallback",()=>{assert.equal(graphicsTier("auto").bloom,false);assert.equal(graphicsTier("high").bloom,true);assert.equal(graphicsTier("ultra").ssao,true);assert.equal(graphicsTier("unknown"),graphicsTiers.auto)});

test('every tier limits distant work and fog hides the far-plane cutoff',()=>{
 const names=['performance','auto','high','ultra'];
 assert.deepEqual(names.map(name=>graphicsTier(name).viewDistance),[320,420,520,650]);
 for(const name of names){
  const tier=graphicsTier(name);
  const transmission=Math.exp(-((tier.fogDensity*tier.viewDistance)**2));
  assert.ok(transmission<.002,'Terrain fades into haze before clipping');
  assert.ok(tier.viewDistance>315,'Sun, Earth and the nearby star shell remain inside the camera far plane');
 }
});

test('only Ultra restores indoor contact shading, bloom and local highlights; reduced motion suppresses bloom',()=>{
 for(const name of ['performance','auto','high','ultra','unknown'])for(const indoors of [false,true])for(const reduced of [false,true]){
  const effects=graphicsEffects(name,indoors,reduced),tier=graphicsTier(name),ultra=name==='ultra';
  assert.equal(effects.occlusion,tier.ssao&&(!indoors||ultra));
  assert.equal(effects.bloom,tier.bloom&&!reduced&&(!indoors||ultra));
  assert.equal(effects.reuseSceneDepth,ultra);assert.equal(effects.roomHighlights,ultra);
  if(name==='performance')assert.ok(!effects.occlusion&&!effects.bloom&&!effects.roomHighlights);
 }
});
