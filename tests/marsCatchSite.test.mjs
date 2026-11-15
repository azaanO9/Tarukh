import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {MARS_CATCH_SITE,gradeMarsCatchSite,marsCatchClearing,marsCatchObstacles} from '../game/marsCatchSite.ts';
import {marsOutpostHeight,MARS_CATCH_GROUND_HEIGHT} from '../game/marsExpeditionTerrain.ts';
import {createMarsCatchSite} from '../ui/world/createMarsCatchSite.ts';
import {STARBASE} from '../game/starbaseRig.ts';
import {REUSABLE_ROCKET} from '../game/reusableRocket.ts';

test('catch site uses a locally graded game surface and leaves remote terrain untouched',()=>{
  const s=MARS_CATCH_SITE;
  for(let dx=-20;dx<=20;dx+=10)for(let dz=-10;dz<=10;dz+=10){
    assert.equal(marsOutpostHeight(s.x+dx,s.z+dz),MARS_CATCH_GROUND_HEIGHT);
    assert.equal(marsCatchClearing(s.x+dx,s.z+dz),true);
  }
  assert.equal(gradeMarsCatchSite(0,-65,12,8),12);
  assert.equal(marsCatchClearing(0,-65),false);
  assert.equal(marsCatchObstacles().length,1);
});

test('the same visible ship settles on both catch rails and all owned resources detach',async()=>{
  const scene=new T.Scene(),obstacles=[],site=createMarsCatchSite(scene,obstacles,true),camera=new T.PerspectiveCamera();
  try{
    await site.ready;
    site.cinematic(24,1/60,camera,false);
    assert.equal(site.rig.shipEngines.flame.visible,true);
    site.settle();site.root.updateMatrixWorld(true);
    const ship=site.rig.starshipUpperStage;
    assert.ok(Math.abs(site.rig.rocketEntity.position.y+ship.position.y+REUSABLE_ROCKET.pinHeight-STARBASE.pinRadius-site.rig.chopstickCarriage.position.y)<1e-8);
    assert.equal(site.rig.superHeavyBooster.visible,false);
    assert.equal(site.rig.shipEngines.flame.visible,false);
    assert.equal(site.rig.groundPad.children.length,0);
    assert.equal(scene.getObjectByName('Mars arrival tower and secured Starship'),site.root);
    assert.equal(obstacles.length,1);
  }finally{site.dispose();site.dispose();}
  assert.equal(scene.children.length,0);assert.equal(obstacles.length,0);
});

test('parked batches retain every visible triangle and world bound with fewer draw calls',async()=>{
  const scene=new T.Scene(),site=createMarsCatchSite(scene,[],true),camera=new T.PerspectiveCamera();
  function measure(){
    site.root.updateWorldMatrix(true,true);
    let calls=0,triangles=0;const bounds=new T.Box3(),part=new T.Box3();
    site.root.traverseVisible(object=>{
      if(!(object instanceof T.Mesh))return;
      calls++;triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3*(object instanceof T.InstancedMesh?object.count:1);
      if(object instanceof T.InstancedMesh){object.computeBoundingBox();part.copy(object.boundingBox);}
      else{object.geometry.computeBoundingBox();part.copy(object.geometry.boundingBox);}
      bounds.union(part.applyMatrix4(object.matrixWorld));
    });
    return {calls,triangles,bounds};
  }
  try{
    await site.ready;
    site.cinematic(32,0,camera,false);const animated=measure();site.settle();const parked=measure();
    assert.equal(parked.triangles,animated.triangles);assert.ok(parked.calls<=16&&parked.calls<animated.calls/4);
    assert.ok(parked.bounds.min.distanceTo(animated.bounds.min)<.001);assert.ok(parked.bounds.max.distanceTo(animated.bounds.max)<.001);
  }finally{site.dispose();}
});

test('the loaded Starship is baked before readiness with identical parked geometry and bounds',async()=>{
  const scene=new T.Scene(),model=new T.Group(),camera=new T.PerspectiveCamera();
  const geometry=new T.BoxGeometry(.16,1,.16),material=new T.MeshStandardMaterial();
  const body=new T.Mesh(geometry,material);body.position.y=.5;model.add(body);
  const fin=new T.Mesh(geometry,material);fin.scale.set(.3,.15,1.4);fin.position.set(.1,.2,0);model.add(fin);
  let resolve;
  const pending=new Promise(done=>{resolve=done;});
  const site=createMarsCatchSite(scene,[],true,()=>pending);
  function measure(){
    site.root.updateWorldMatrix(true,true);
    const bounds=new T.Box3(),part=new T.Box3();let triangles=0,calls=0;
    site.root.traverseVisible(object=>{
      if(!(object instanceof T.Mesh))return;
      calls++;triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3*(object instanceof T.InstancedMesh?object.count:1);
      if(object instanceof T.InstancedMesh){object.computeBoundingBox();part.copy(object.boundingBox);}
      else{object.geometry.computeBoundingBox();part.copy(object.geometry.boundingBox);}
      bounds.union(part.applyMatrix4(object.matrixWorld));
    });
    return {bounds,triangles,calls};
  }
  try{
    assert.equal(site.modelStatus,'loading');
    assert.equal(site.root.getObjectByName('Batched secured Starship').children.length,0);
    resolve(model);await site.ready;assert.equal(site.modelStatus,'loaded');
    assert.ok(site.root.getObjectByName('Batched secured Starship').children.length>0);
    site.cinematic(32,0,camera,false);const animated=measure();site.settle();const parked=measure();
    assert.equal(parked.triangles,animated.triangles);assert.ok(parked.calls<animated.calls);
    assert.ok(parked.bounds.min.distanceTo(animated.bounds.min)<.001);
    assert.ok(parked.bounds.max.distanceTo(animated.bounds.max)<.001);
  }finally{site.dispose();site.dispose();}
  assert.equal(scene.children.length,0);
});

test('teardown during Starship loading does not later bake or reattach a parked site',async()=>{
  const scene=new T.Scene(),obstacles=[],model=new T.Group();
  const geometry=new T.BoxGeometry(1,1,1),material=new T.MeshStandardMaterial();
  model.add(new T.Mesh(geometry,material));let disposed=0,resolve;
  geometry.addEventListener('dispose',()=>disposed++);
  const site=createMarsCatchSite(scene,obstacles,true,()=>new Promise(done=>{resolve=done;}));
  await Promise.resolve();site.dispose();resolve(model);await site.ready;
  assert.equal(disposed,1);assert.equal(scene.children.length,0);assert.equal(obstacles.length,0);
  assert.equal(site.root.getObjectByName('Batched secured Starship').children.length,0);
});
