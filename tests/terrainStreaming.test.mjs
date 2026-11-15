import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {streamingBudget,streamedRock,streamedHeight,STREAM_LIMIT,TERRAIN_SAMPLE_STEP,CHUNK_SIZE,isBaseChunk} from "../game/terrainStreaming.ts";
import {EXPLORATION_BOUNDS,isExplorationTile} from '../game/explorationBounds.ts';
import {createStreamedMars} from "../ui/world/streamedMars.ts";
import {marsExpeditionHeight as marsHeight} from "../game/marsExpeditionTerrain.ts";
import {stepWalker,spawnWalker} from "../game/navigation.ts";
import {spawnRoverVehicle,exitRover} from "../game/roverVehicle.ts";
test("every device loads finite-region detail with a bounded capability budget",()=>{
 const high=streamingBudget("NVIDIA GeForce RTX 4060",8,8,false,"auto");
 for(const gpu of ["Intel Iris Xe","SwiftShader","", "AMD Radeon Vega 8"]){const low=streamingBudget(gpu,4,4,true,"auto");assert.equal(low.radius,2);assert.ok(low.rocks>0);assert.ok(low.rocks<high.rocks);assert.ok(low.generationMs<high.generationMs);}
 assert.equal(high.radius,3);assert.ok(high.pebbles>streamingBudget("",4,4,true,"performance").pebbles);
 assert.equal(streamingBudget("NVIDIA GeForce RTX 4060",8,8,false,"performance").radius,2);
 assert.equal(STREAM_LIMIT,Infinity);
 assert.deepEqual(streamedRock(100,-20,3),streamedRock(100,-20,3));
});
test("walking and rover exit can use extended bounds without changing the finite default",()=>{
 const initial={...spawnWalker(),x:50000,z:0};
 assert.ok(stepWalker(initial,new Set(["d"]),.05,[],5,true,undefined,STREAM_LIMIT).x>50000);
 assert.ok(exitRover(spawnRoverVehicle(500,0,0),[],STREAM_LIMIT).exitPosition);
 assert.equal(exitRover(spawnRoverVehicle(500,0,0)).exitPosition,null);
});
test("streamed chunks share borders, match contact heights, recycle and dispose their pool",()=>{
 const root=new T.Group(), material=new T.MeshStandardMaterial();
 const ground=new T.Mesh(new T.PlaneGeometry(1,1),material);
 const obstacles=[];
 const stream=createStreamedMars(root,ground,marsHeight,{obstacles});
 function fill(x,z){stream.update(x,z,1000);while(stream.pending())stream.update(x,z,1000);}
 fill(500,500);
 assert.equal(root.children.length,98);
 const chunks=root.children.filter(m=>m.visible&&m.name==="streamed-ground");
 assert.equal(chunks.length,49);
 assert.ok(root.children.filter(m=>m.name==="streamed-rocks").every(m=>m.count===50),"pebbles reuse each tile rock draw");
 const first=chunks[0].geometry.attributes.position;
 const tint=chunks[0].geometry.attributes.color;
 assert.ok(tint.array.some(v=>v!==1),"generated ground carries the same mineral/mud tint system");
 assert.equal(first.count,(CHUNK_SIZE/TERRAIN_SAMPLE_STEP+1)**2+CHUNK_SIZE/TERRAIN_SAMPLE_STEP);
 for(const i of [0,23,70,Math.floor(first.count/2),first.count-1])assert.ok(Math.abs(first.getY(i)-stream.heightAt(first.getX(i)+chunks[0].position.x,first.getZ(i)+chunks[0].position.z))<1e-5);
 const a=streamedHeight(560,501.25,marsHeight),b=streamedHeight(560-1e-7,501.25,marsHeight);
 assert.ok(Math.abs(a-b)<1e-5);
 const expected=stream.heightAt(501.25,502.5);
 fill(-600,-600);fill(500,500);
 assert.equal(stream.heightAt(501.25,502.5),expected);
 assert.equal(root.children.length,98);
 assert.equal(obstacles.length,49*18);
 const small=obstacles.find(o=>o.traversable),large=obstacles.find(o=>!o.traversable);
 assert.ok(small&&large,"generated terrain includes climbable rocks and blocking boulders");
 assert.ok(stream.roverHeightAt(small.x,small.z)>stream.heightAt(small.x,small.z)+.2);
 assert.equal(stream.roverHeightAt(large.x,large.z),stream.heightAt(large.x,large.z));
 assert.ok(obstacles.every(o=>o.hull.length>=3));
 stream.dispose();assert.equal(obstacles.length,0);assert.equal(root.children.length,0);ground.geometry.dispose();material.dispose();
});


test("generated rocks share tier materials without owning or disposing them",()=>{
 const root=new T.Group(),base=new T.MeshStandardMaterial(),light=new T.MeshStandardMaterial();
 const ground=new T.Mesh(new T.PlaneGeometry(1,1),base);
 const source=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),base,1);source.name="mars-small-rocks";root.add(source);
 let disposed=0;base.addEventListener('dispose',()=>disposed++);light.addEventListener('dispose',()=>disposed++);
 const stream=createStreamedMars(root,ground,marsHeight,{radius:1,rocks:1,pebbles:1});
 stream.update(500,500,1000);while(stream.pending())stream.update(500,500,1000);
 const rocks=root.children.filter(o=>o.name==='streamed-rocks');assert.ok(rocks.every(o=>o.material===base));
 source.material=light;stream.update(500,500,1);assert.ok(rocks.every(o=>o.material===light));
 stream.dispose();assert.equal(disposed,0);assert.equal(root.children.length,1);
 ground.geometry.dispose();source.geometry.dispose();base.dispose();light.dispose();
});

test('Performance trims a detail ring without losing contacts or finite-region coverage',()=>{
 for(const radius of [2,3]){
  const root=new T.Group(),material=new T.MeshStandardMaterial();
  const ground=new T.Mesh(new T.PlaneGeometry(1,1),material),obstacles=[];
  const stream=createStreamedMars(root,ground,marsHeight,{radius,rocks:2,pebbles:1,obstacles});
  const fill=(x,z)=>{stream.update(x,z,1000);while(stream.pending())stream.update(x,z,1000);};
  fill(500,500);
  const total=(radius*2+1)**2,contacts=obstacles.length;
  assert.equal(stream.visibleCount(),total);
  stream.setPerformance(true);stream.update(500,500,0);
  assert.equal(stream.count(),total);assert.equal(stream.visibleCount(),((radius-1)*2+1)**2);
  assert.equal(obstacles.length,contacts,'outer contacts remain ready before approaching them');
  const bounds=stream.coverage();
  for(const mesh of root.children.filter(m=>m.name==='streamed-ground'&&m.visible)){
   assert.ok(mesh.position.x>=bounds.x&&mesh.position.x+70<=bounds.z);
   assert.ok(mesh.position.z>=bounds.y&&mesh.position.z+70<=bounds.w);
  }
  assert.equal(bounds.z-bounds.x,(2*(radius-1)+1)*70,'far LOD covers the omitted ring');
  fill(EXPLORATION_BOUNDS.east-20,0);assert.ok(stream.count()<total);assert.equal(root.children.length,total*2);
  for(const mesh of root.children.filter(m=>m.name==='streamed-ground'&&m.visible))assert.equal(isExplorationTile(Math.round(mesh.position.x/70),Math.round(mesh.position.z/70),70),true);
  fill(5000,-5000);assert.equal(stream.count(),0);assert.equal(obstacles.length,0,'no terrain or rocks generate beyond the real crop');
  fill(500,500);stream.setPerformance(false);stream.update(500,500,0);assert.equal(stream.visibleCount(),total);
  stream.dispose();assert.equal(obstacles.length,0);ground.geometry.dispose();material.dispose();
 }
});

test('tile preparation samples each height once and generates stable shared-edge normals',()=>{
 const root=new T.Group(),ground=new T.Mesh(new T.PlaneGeometry(),new T.MeshStandardMaterial());
 let samples=0;
 const height=(x,z)=>{samples++;return x*.02+z*.03;};
 const stream=createStreamedMars(root,ground,height,{radius:1,rocks:0,pebbles:0,sampleHeight:height});
 try{
  stream.update(500,400,1000);while(stream.pending())stream.update(500,400,1000);
  assert.equal(samples,9*(CHUNK_SIZE/TERRAIN_SAMPLE_STEP+3)**2);
  for(const mesh of root.children.filter(m=>m.name==='streamed-ground'&&m.visible)){
   const normal=mesh.geometry.attributes.normal,positions=mesh.geometry.attributes.position;
   for(const index of [0,normal.count-1]){
    assert.ok(Math.abs(normal.getY(index)-1/Math.hypot(.02,1,.03))<1e-6);
    const point=new T.Vector3().fromBufferAttribute(positions,index);
    assert.ok(mesh.geometry.boundingSphere.containsPoint(point),'incremental bounds enclose all sampled vertices');
   }
  }
 }finally{stream.dispose();ground.geometry.dispose();ground.material.dispose();}
});

test('far relief stays visible until the entire replacement rectangle is ready',()=>{
 const root=new T.Group(),ground=new T.Mesh(new T.PlaneGeometry(),new T.MeshStandardMaterial());
 const stream=createStreamedMars(root,ground,()=>0,{radius:2,rocks:0,pebbles:0,sampleHeight:()=>0});
 const fill=(x,z)=>{stream.update(x,z,1000);while(stream.pending())stream.update(x,z,1000);};
 const assertCoveredTilesReady=()=>{
  const bounds=stream.coverage();
  for(let z=bounds.y;z<bounds.w;z+=CHUNK_SIZE)for(let x=bounds.x;x<bounds.z;x+=CHUNK_SIZE){
   if(isBaseChunk(x/CHUNK_SIZE,z/CHUNK_SIZE)||!isExplorationTile(x/CHUNK_SIZE,z/CHUNK_SIZE,CHUNK_SIZE))continue;
   assert.ok(root.children.some(mesh=>mesh.name==='streamed-ground'&&mesh.visible&&mesh.position.x===x&&mesh.position.z===z),'far discard never includes an unfinished tile');
  }
 };
 try{
  fill(500,400);
  stream.update(EXPLORATION_BOUNDS.east-80,0,0);
  assert.ok(stream.pending()>0);
  assert.deepEqual(stream.coverage().toArray(),[0,0,0,0],'no replacement at the new center yet');
  fill(EXPLORATION_BOUNDS.east-80,0);assertCoveredTilesReady();
  stream.update(EXPLORATION_BOUNDS.east-80,CHUNK_SIZE,0);
  assert.ok(stream.pending()>0);assertCoveredTilesReady();
  stream.setPerformance(true);stream.update(EXPLORATION_BOUNDS.east-80,CHUNK_SIZE,0);assertCoveredTilesReady();
 }finally{stream.dispose();ground.geometry.dispose();ground.material.dispose();}
});

test('partly prepared rings never draw fine terrain or rocks over the far relief',()=>{
 const root=new T.Group(),ground=new T.Mesh(new T.PlaneGeometry(),new T.MeshStandardMaterial()),obstacles=[];
 const stream=createStreamedMars(root,ground,()=>0,{radius:2,rocks:1,pebbles:0,obstacles,sampleHeight:()=>0});
 const verifyVisible=()=>{
  const bounds=stream.coverage();
  for(const mesh of root.children.filter(o=>o.visible&&(o.name==='streamed-ground'||o.name==='streamed-rocks'))){
   assert.ok(mesh.position.x>=bounds.x&&mesh.position.z>=bounds.y&&mesh.position.x+CHUNK_SIZE<=bounds.z&&mesh.position.z+CHUNK_SIZE<=bounds.w,'visible ground and rocks remain inside the far discard rectangle');
  }
  assert.equal(obstacles.length,stream.count(),'prepared contacts remain available even while a ring is hidden');
 };
 try{
  stream.update(500,400,0);verifyVisible();
  let frames=0;
  while(stream.pending()&&frames++<5000){stream.update(500,400,.2);verifyVisible();}
  assert.equal(stream.pending(),0);assert.equal(stream.visibleCount(),25);
  stream.update(570,400,0);verifyVisible();
  while(stream.pending()&&frames++<5000){stream.update(570,400,.2);verifyVisible();}
  assert.equal(stream.pending(),0);assert.equal(stream.visibleCount(),25);
 }finally{stream.dispose();ground.geometry.dispose();ground.material.dispose();}
});

test('all four campus edges stitch exactly to the one-metre base without changing its height',()=>{
 const h=(x,z)=>Math.sin(x*.8)*Math.cos(z*.7)*3;
 const root=new T.Group(),ground=new T.Mesh(new T.PlaneGeometry(),new T.MeshStandardMaterial());
 const stream=createStreamedMars(root,ground,h,{radius:1,rocks:0,pebbles:0,sampleHeight:h});
 try{
  for(const [x,z] of [[220,0],[-220,0],[0,220],[0,-220]]){
   stream.update(x,z,1000);while(stream.pending())stream.update(x,z,1000);
   for(const mesh of root.children.filter(o=>o.name==='streamed-ground'&&o.visible)){
    const p=mesh.geometry.attributes.position,index=mesh.geometry.index;
    for(let i=0;i<index.count;i+=3){
     const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);
     const wx=mesh.position.x+(p.getX(a)+p.getX(b)+p.getX(c))/3,wz=mesh.position.z+(p.getZ(a)+p.getZ(b)+p.getZ(c))/3;
     assert.ok(Math.abs(stream.heightAt(wx,wz)-(p.getY(a)+p.getY(b)+p.getY(c))/3)<1e-5,'stitched mesh triangles and contact agree');
    }
   }
  }
  for(let t=-209;t<210;t++)for(const [x,z] of [[210,t],[-210,t],[t,210],[t,-210]]){
   assert.ok(Math.abs(streamedHeight(x,z,h)-h(x,z))<1e-10,'odd one-metre edge vertices are preserved');
  }
 }finally{stream.dispose();ground.geometry.dispose();ground.material.dispose();}
});
