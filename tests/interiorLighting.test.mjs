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

test('Ultra highlights are confined to interior clones, including when a gate shares its physical material',()=>{
  const field=createInteriorLighting(),texture=new T.Texture();
  const source=new T.MeshPhysicalMaterial({map:texture,roughness:.31,metalness:.76,clearcoat:.6});
  const gate=field.materialFor(source),interior=field.materialFor(source,true);
  assert.notEqual(interior,gate);
  assert.equal(field.materialFor(source,true),interior);
  assert.equal(field.materialFor(source),gate);
  for(const material of [gate,interior]){
    assert.equal(material.map,texture);assert.equal(material.roughness,.31);
    assert.equal(material.metalness,.76);assert.equal(material.clearcoat,.6);
  }
  for(const material of [source,gate]){
    const shader=compile(material,'physical');
    assert.ok(!shader.fragmentShader.includes('tarukhInteriorSpecular'));
    assert.equal(shader.uniforms.tarukhInteriorSpecularStrength,undefined);
  }
  const shader=compile(interior,'physical');
  assert.ok(shader.fragmentShader.includes('BRDF_GGX(tarukhLightDirection, geometryViewDir, geometryNormal, material)'));
  assert.ok(shader.fragmentShader.includes('reflectedLight.directSpecular += tarukhIrradiance'));
  assert.ok(shader.fragmentShader.includes('getDistanceAttenuation(tarukhLightDistance, tarukhLightRange, 2.0)'));
  assert.notEqual(interior.customProgramCacheKey(),gate.customProgramCacheKey());
  const unlit=new T.MeshBasicMaterial();assert.equal(field.materialFor(unlit,true),unlit);
  field.dispose();source.dispose();unlit.dispose();texture.dispose();
});

test('Ultra and indoor state gate shared specular uniforms without recompilation or changing the existing fill',()=>{
  const field=createInteriorLighting(),source=new T.MeshStandardMaterial(),material=field.materialFor(source,true);
  const shader=compile(material),version=material.version,key=material.customProgramCacheKey();
  const strength=shader.uniforms.tarukhInteriorSpecularStrength;
  const colors=shader.uniforms.tarukhInteriorSpecularColors.value;
  assert.equal(strength.value,0);
  field.setUltra(true);assert.equal(strength.value,0,'outdoor materials stay unlit');
  field.setActive(true);assert.equal(strength.value,1);
  const fill=shader.uniforms.tarukhInteriorFill.value.clone();
  for(let i=0;i<120;i++){
    field.setUltra(false);assert.equal(strength.value,0,'other graphics tiers keep diffuse fill only');
    assert.ok(shader.uniforms.tarukhInteriorFill.value.equals(fill));
    field.setUltra(true);assert.equal(strength.value,1);
    field.setActive(false);assert.equal(strength.value,0,'leaving the room always disables highlights');
    field.setActive(true);assert.equal(strength.value,1);
  }
  assert.equal(material.version,version);assert.equal(material.customProgramCacheKey(),key);
  const again=compile(material);
  assert.equal(again.uniforms.tarukhInteriorSpecularStrength,strength);
  assert.equal(again.uniforms.tarukhInteriorSpecularColors.value,colors);
  assert.ok(colors[0].equals(new T.Color('#e5efff').multiplyScalar(28)));
  assert.ok(colors[1].equals(new T.Color('#d6c6ef').multiplyScalar(10)));
  field.dispose();source.dispose();
});

test('room emitters remain fixed in world space during camera movement and reuse all view-space vectors',()=>{
  const field=createInteriorLighting(),source=new T.MeshStandardMaterial(),shader=compile(field.materialFor(source,true));
  const positions=shader.uniforms.tarukhInteriorSpecularPositions.value,first=positions[0],second=positions[1];
  const camera=new T.PerspectiveCamera();
  const room={x:-19,y:.3,z:-65};
  field.setRoomCenter(room.x,room.y,room.z);
  const expected=[new T.Vector3(room.x-.65,room.y+2.65,room.z),new T.Vector3(room.x+.65,room.y+1.95,room.z-1.2)];
  for(let i=0;i<120;i++){
    camera.position.set(-17+i*.01,2,-62);
    camera.rotation.set(.1,i*.02,0);camera.updateMatrixWorld();field.updateView(camera);
    assert.equal(shader.uniforms.tarukhInteriorSpecularPositions.value,positions);
    assert.equal(positions[0],first);assert.equal(positions[1],second);
    for(let j=0;j<2;j++)assert.ok(positions[j].clone().applyMatrix4(camera.matrixWorld).distanceTo(expected[j])<1e-10);
  }
  field.setRoomCenter(12,.5,-87);field.updateView(camera);
  assert.ok(first.clone().applyMatrix4(camera.matrixWorld).distanceTo(new T.Vector3(11.35,3.15,-87))<1e-10);
  field.dispose();source.dispose();
});

test('specular clone preserves prior shader hooks and both clone variants dispose independently',()=>{
  const field=createInteriorLighting(),texture=new T.Texture(),source=new T.MeshStandardMaterial({map:texture});
  source.onBeforeCompile=function(shader){shader.uniforms.authored={value:1};assert.notEqual(this,source);};
  source.customProgramCacheKey=()=> 'authored-v1';
  const gate=field.materialFor(source),interior=field.materialFor(source,true),shader=compile(interior);
  assert.equal(shader.uniforms.authored.value,1);
  assert.ok(interior.customProgramCacheKey().startsWith('authored-v1|'));
  let disposedGate=0,disposedInterior=0,disposedSource=0,disposedTexture=0;
  gate.addEventListener('dispose',()=>disposedGate++);interior.addEventListener('dispose',()=>disposedInterior++);
  source.addEventListener('dispose',()=>disposedSource++);texture.addEventListener('dispose',()=>disposedTexture++);
  field.dispose();field.dispose();
  assert.equal(disposedGate,1);assert.equal(disposedInterior,1);
  assert.equal(disposedSource,0);assert.equal(disposedTexture,0);
  source.dispose();texture.dispose();
});
