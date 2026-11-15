import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {BoundedBloomPass} from '../ui/world/BoundedBloomPass.ts';

test('bloom bounds every mip at desktop, retina and phone sizes while retaining authored intensity',()=>{
 const pass=new BoundedBloomPass(new T.Vector2(512,512),.28,.55,.88);
 const uniforms=pass.separableBlurMaterials.map(material=>material.uniforms.invSize.value);
 for(const [w,h] of [[1280,720],[3840,2160],[390,844],[1,1],[2560,1440]]){
  pass.setSize(w,h);
  assert.ok(Math.max(pass.renderTargetBright.width,pass.renderTargetBright.height)<=512);
  for(let i=0;i<pass.nMips;i++){
   const a=pass.renderTargetsHorizontal[i],b=pass.renderTargetsVertical[i];
   assert.ok(a.width>=1&&a.height>=1);assert.equal(a.width,b.width);assert.equal(a.height,b.height);
   assert.equal(pass.separableBlurMaterials[i].uniforms.invSize.value,uniforms[i]);
   assert.equal(uniforms[i].x,1/a.width);assert.equal(uniforms[i].y,1/a.height);
  }
 }
 assert.equal(pass.strength,.28);assert.equal(pass.radius,.55);assert.equal(pass.threshold,.88);
 pass.dispose();
});

test('equivalent capped sizes retain bloom buffers during dynamic resolution changes',()=>{
 const pass=new BoundedBloomPass(new T.Vector2(512,512),.28,.55,.88);
 pass.setSize(1920,1080);
 let invalidations=0;
 const targets=[pass.renderTargetBright,...pass.renderTargetsHorizontal,...pass.renderTargetsVertical];
 for(const target of targets)target.addEventListener('dispose',()=>invalidations++);
 pass.setSize(2560,1440);pass.setSize(3840,2160);
 assert.equal(invalidations,0);
 pass.dispose();assert.equal(invalidations,targets.length);
});
