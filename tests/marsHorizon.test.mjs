import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {REGION_WORLD_BOUNDS as B} from '../game/marsRegion.ts';
import {marsOutpostHeight} from '../game/marsExpeditionTerrain.ts';
import {graphicsTiers} from '../ui/world/graphicsTiers.ts';
import {createMarsRegionalLandscape,MARS_HORIZON_DISTANCE} from '../ui/world/marsRegionalLandscape.ts';

function fixture(){
 const root=new T.Group();
 const landscape=createMarsRegionalLandscape(root);
 const camera=new T.PerspectiveCamera(58,16/9,.08,MARS_HORIZON_DISTANCE);
 const projection=new T.Matrix4(),frustum=new T.Frustum();
 return {root,landscape,camera,frustum,
  view(x,z,tx,tz){
   camera.position.set(x,marsOutpostHeight(x,z)+3,z);
   camera.lookAt(tx,marsOutpostHeight(tx,tz),tz);
   camera.updateProjectionMatrix();camera.updateMatrixWorld();root.updateMatrixWorld(true);
   landscape.updateVisibility(camera);
   frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  },
  dispose(){for(const mesh of root.children)mesh.geometry.dispose();root.children[0].material.dispose();},
 };
}

test('the regional horizon reaches boundary ridges in every tier while culling offscreen patches',()=>{
 const f=fixture();
 try{
  assert.equal(MARS_HORIZON_DISTANCE,Math.ceil(Math.hypot(B.east-B.west,B.south-B.north)+200));
  for(const [name,tier] of Object.entries(graphicsTiers)){
   assert.ok(MARS_HORIZON_DISTANCE>tier.viewDistance,name);
   for(const [x,z] of [[0,21],[350,-150],[B.east-100,B.south-140]]){
    for(const [tx,tz] of [[B.west+5,z],[B.east-5,z],[x,B.north+5],[x,B.south-5]]){
     f.view(x,z,tx,tz);
     const target=new T.Vector3(tx,marsOutpostHeight(tx,tz),tz);
     assert.ok(f.frustum.containsPoint(target),`${name}: boundary remains inside the long camera frustum`);
     assert.ok(f.landscape.visibleCount()>0&&f.landscape.visibleCount()<48,`${name}: draw a subset of regional patches`);
     assert.ok(f.root.children.some(mesh=>mesh.visible&&mesh.geometry.boundingBox.min.x<=tx&&mesh.geometry.boundingBox.max.x>=tx&&mesh.geometry.boundingBox.min.z<=tz&&mesh.geometry.boundingBox.max.z>=tz),`${name}: a boundary patch is visible`);
     for(const mesh of f.root.children){
      const box=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      if(!f.frustum.intersectsBox(box))assert.equal(mesh.visible,false,'offscreen geometry is never submitted');
     }
    }
   }
  }
 }finally{f.dispose();}
});

test('regional coverage culls wholly hidden patches and restores them when detail coverage moves',()=>{
 const f=fixture();
 try{
  f.view(0,21,B.east-5,21);
  const patch=f.root.children.find(mesh=>mesh.visible);
  assert.ok(patch);
  const bounds=patch.geometry.boundingBox;
  f.landscape.setCoverage(bounds.min.x-.01,bounds.min.z-.01,bounds.max.x+.01,bounds.max.z+.01);
  f.landscape.updateVisibility(f.camera);
  assert.equal(patch.visible,false,'ready detail wholly replaces its regional patch');
  f.landscape.setCoverage(0,0,0,0);
  f.landscape.updateVisibility(f.camera);
  assert.equal(patch.visible,true,'incomplete or moved detail reveals the regional fallback');
  f.landscape.setCoverage(bounds.min.x+.01,bounds.min.z+.01,bounds.max.x-.01,bounds.max.z-.01);
  f.landscape.updateVisibility(f.camera);
  assert.equal(patch.visible,true,'partial coverage must retain the surrounding far surface');
  for(const mesh of f.root.children){
   const box=mesh.geometry.boundingBox;
   if(box.min.x>=-210&&box.max.x<=210&&box.min.z>=-210&&box.max.z<=210)assert.equal(mesh.visible,false,'base-covered patch is omitted');
  }
  f.root.position.x=10000;
  f.root.updateMatrixWorld(true);
  f.landscape.updateVisibility(f.camera);
  assert.equal(f.landscape.visibleCount(),0,'visibility tests use world-transformed bounds');
 }finally{f.dispose();}
});

test('horizon visibility keeps all sampled heights, colors, triangles and material hooks intact',()=>{
 const f=fixture();
 try{
  assert.equal(f.landscape.count,48);
  assert.equal(f.root.children.reduce((sum,mesh)=>sum+mesh.geometry.index.count/3,0),98304);
  const material=f.root.children[0].material;
  assert.ok(material.customProgramCacheKey().includes('mola-far-lod-v1'));
  assert.ok(material.customProgramCacheKey().includes('terrain-height-haze'));
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>\n#include <project_vertex>',fragmentShader:'#include <clipping_planes_fragment>\n#include <fog_fragment>'};
  material.onBeforeCompile(shader,{});
  assert.ok(shader.fragmentShader.includes('localCoverage'));
  assert.ok(shader.fragmentShader.includes('terrainWorldHeight'));
  const color=new T.Color(),dust=new T.Color(0xb58865),rock=new T.Color(0x795b49);
  for(const mesh of f.root.children){
   assert.equal(mesh.userData.marsHorizon,true);
   assert.equal(mesh.material,material,'one shared regional material');
   const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,c=mesh.geometry.attributes.color;
   for(let i=0;i<p.count;i++){
    assert.equal(p.getY(i),Math.fround(marsOutpostHeight(p.getX(i),p.getZ(i))-.35));
    const slope=1-n.getY(i),band=.08*Math.sin(p.getY(i)*.5);
    color.copy(dust).lerp(rock,Math.min(.75,slope*1.8+.12+band));
    assert.equal(c.getX(i),Math.fround(color.r));
    assert.equal(c.getY(i),Math.fround(color.g));
    assert.equal(c.getZ(i),Math.fround(color.b));
   }
  }
 }finally{f.dispose();}
});
