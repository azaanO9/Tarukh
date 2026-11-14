import test from "node:test"; import assert from "node:assert/strict";
import { graphicsTier, graphicsTiers } from "../ui/world/graphicsTiers.ts";
test("performance is cheaper than auto and no tier uses large runtime textures",()=>{const p=graphicsTier("performance"),a=graphicsTier("auto");assert.ok(p.resolutionCap<a.resolutionCap);assert.ok(p.smallRocks<a.smallRocks);assert.ok(p.particles<a.particles);assert.equal(p.shadows,false);assert.equal(p.bloom,false);assert.equal(p.ssao,false);for(const tier of Object.values(graphicsTiers))assert.ok(tier.terrainTexture<=1024)});
test("tier post processing has a predictable fallback",()=>{assert.equal(graphicsTier("auto").bloom,false);assert.equal(graphicsTier("high").bloom,true);assert.equal(graphicsTier("ultra").ssao,true);assert.equal(graphicsTier("unknown"),graphicsTiers.auto)});

test('Performance hides distant work while keeping the other tier distances unchanged',()=>{
 const light=graphicsTier('performance');
 assert.equal(light.viewDistance,800);
 for(const name of ['auto','high','ultra']){
  assert.equal(graphicsTier(name).viewDistance,1100);
  assert.ok(light.fogDensity>graphicsTier(name).fogDensity);
 }
});
