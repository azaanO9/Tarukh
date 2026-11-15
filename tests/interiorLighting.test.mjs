import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createInteriorLighting} from '../ui/world/interiorLighting.ts';

function compile(material,kind='standard'){
  const shader={vertexShader:T.ShaderLib[kind].vertexShader,fragmentShader:T.ShaderLib[kind].fragmentShader,uniforms:{}};
  material.onBeforeCompile(shader,{});
  return shader;
}

test('interior material clones preserve physical properties and shared textures without modifying the exterior',()=>{
  const field=createInteriorLighting(),texture=new T.Texture();
  const exterior=new T.MeshPhysicalMaterial({map:texture,roughness:.31,metalness:.76,clearcoat:.6});
  const originalCompile=exterior.onBeforeCompile,originalKey=exterior.customProgramCacheKey();
  const interior=field.materialFor(exterior);
  assert.notEqual(interior,exterior);assert.ok(interior instanceof T.MeshPhysicalMaterial);
  assert.equal(interior.map,texture);assert.equal(interior.roughness,.31);assert.equal(interior.metalness,.76);assert.equal(interior.clearcoat,.6);
  assert.equal(field.materialFor(exterior),interior,'shared source materials reuse the same interior clone');
  assert.equal(exterior.onBeforeCompile,originalCompile);assert.equal(exterior.customProgramCacheKey(),originalKey);
  assert.ok(!compile(exterior,'physical').fragmentShader.includes('tarukhInteriorFill'));
  const unlit=new T.MeshBasicMaterial();assert.equal(field.materialFor(unlit),unlit);
  field.dispose();exterior.dispose();unlit.dispose();texture.dispose();
});

test('steady room fill switches as one shared uniform without camera-dependent updates or recompilation',()=>{
  const field=createInteriorLighting(),source=new T.MeshStandardMaterial(),shader=compile(field.materialFor(source));
  const material=field.materialFor(source),version=material.version,key=material.customProgramCacheKey();
  const fill=shader.uniforms.tarukhInteriorFill.value;
  assert.equal(fill.getHex(),0);
  field.setActive(true);
  const expected=new T.Color('#e6efff').multiplyScalar(.65);
  assert.ok(fill.equals(expected));
  for(let i=0;i<120;i++)field.setActive(true);
  assert.equal(shader.uniforms.tarukhInteriorFill.value,fill);
  assert.ok(fill.equals(expected),'room brightness stays constant while inside');
  assert.equal(material.version,version);assert.equal(material.customProgramCacheKey(),key);
  field.setActive(false);assert.equal(fill.getHex(),0);
  assert.equal(compile(field.materialFor(source)).uniforms.tarukhInteriorFill.value,fill);
  field.dispose();source.dispose();
});

test('fill preserves material hooks and does not add point-light, shadow or distance calculations',()=>{
  const field=createInteriorLighting(),source=new T.MeshStandardMaterial(),receivers=[];
  source.onBeforeCompile=function(shader){receivers.push(this);shader.uniforms.existing={value:3};shader.fragmentShader='// retained hook\n'+shader.fragmentShader;};
  source.customProgramCacheKey=()=> 'existing-material-v2';
  const interior=field.materialFor(source),shader=compile(interior);
  assert.equal(receivers[0],interior);assert.equal(shader.uniforms.existing.value,3);assert.ok(shader.fragmentShader.includes('// retained hook'));
  assert.equal(interior.customProgramCacheKey(),'existing-material-v2|tarukh-interior-fill-v2');
  assert.ok(shader.fragmentShader.includes('#include <lights_fragment_end>'));
  assert.ok(shader.fragmentShader.includes('reflectedLight.indirectDiffuse += tarukhInteriorFill * diffuseColor.rgb'));
  assert.ok(!shader.fragmentShader.includes('getDistanceAttenuation('));
  assert.ok(!shader.fragmentShader.includes('tarukhInteriorPositions'));
  const physical=new T.MeshPhysicalMaterial();
  assert.ok(compile(field.materialFor(physical),'physical').fragmentShader.includes('tarukhInteriorFill'));
  field.dispose();source.dispose();physical.dispose();
});

test('disposing the light field releases each clone once and never disposes original materials or shared textures',()=>{
  const field=createInteriorLighting(),texture=new T.Texture(),source=new T.MeshStandardMaterial({map:texture});
  const clone=field.materialFor(source);let cloned=0,original=0,textures=0;
  clone.addEventListener('dispose',()=>cloned++);source.addEventListener('dispose',()=>original++);texture.addEventListener('dispose',()=>textures++);
  field.materialFor(source);field.dispose();field.dispose();
  assert.equal(cloned,1);assert.equal(original,0);assert.equal(textures,0);
  assert.notEqual(field.materialFor(source),clone,'dispose clears the clone cache');
  field.dispose();source.dispose();texture.dispose();
});
