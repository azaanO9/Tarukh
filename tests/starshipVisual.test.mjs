import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createStarbase} from '../ui/starbase/createStarbase.ts';
import {createStarshipVisual,STARSHIP_NOZZLES} from '../ui/starbase/starshipVisual.ts';
import {createArrivalRigPose} from '../ui/starbase/arrivalRig.ts';
import {createArrivalFrame,sampleStarshipArrival} from '../game/starshipArrival.ts';
import {REUSABLE_ROCKET} from '../game/reusableRocket.ts';

function fixture(){
  const disposed={geometry:0,material:0,texture:0,bitmap:0};
  const texture=new T.Texture({close(){disposed.bitmap++;}});
  const material=new T.MeshStandardMaterial({map:texture,metalness:.8,roughness:.3});
  const geometry=new T.BoxGeometry(.17,1,.17);
  geometry.addEventListener('dispose',()=>disposed.geometry++);
  material.addEventListener('dispose',()=>disposed.material++);
  texture.addEventListener('dispose',()=>disposed.texture++);
  const model=new T.Group();model.name='Height-one supplied Starship';
  const body=new T.Mesh(geometry,material);body.position.y=.5;model.add(body);
  // Shared resources must not be disposed once per mesh.
  const fin=new T.Mesh(geometry,material);fin.scale.set(.4,.15,1.5);fin.position.set(.11,.2,0);model.add(fin);
  return {model,geometry,material,texture,disposed};
}

function rocket(){
  const scene=new T.Scene();
  const rig=createStarbase(scene,{reusableRocket:true,ground:false});
  const fallback=rig.starshipUpperStage.getObjectByName('reusableCrewVehicle');
  return {scene,rig,fallback};
}

test('the supplied model keeps its proportions and replaces only the old shell and engine meshes',async()=>{
  const {scene,rig,fallback}=rocket(),asset=fixture();
  const engines=rig.shipEngines,engineNodes=[...engines.active];
  const visual=createStarshipVisual(rig,async()=>asset.model);
  try{
    assert.equal(visual.status,'loading');assert.equal(fallback.visible,true);
    await visual.ready;
    assert.equal(visual.status,'loaded');assert.equal(fallback.visible,false);
    assert.equal(asset.model.parent,rig.starshipUpperStage.getObjectByName('Imported Starship'));
    assert.deepEqual(asset.model.scale.toArray(),[19.2,19.2,19.2]);
    rig.starshipUpperStage.position.y=0;scene.updateMatrixWorld(true);
    const size=new T.Box3().setFromObject(asset.model).getSize(new T.Vector3());
    assert.ok(Math.abs(size.y-REUSABLE_ROCKET.height)<1e-6);
    assert.equal(asset.material.map,asset.texture);
    assert.equal(asset.material.metalness,.8);assert.equal(asset.material.roughness,.3);
    assert.deepEqual(engines.active,engineNodes);
    engines.root.traverse(object=>{
      if(object instanceof T.Mesh&&object!==engines.flame&&object!==engines.core)assert.equal(object.visible,false);
    });
    rig.setPropulsion(0,.6,2);
    assert.equal(engines.flame.visible,true);assert.equal(engines.core.visible,true);
    assert.equal(engines.flame.count,6);assert.equal(engines.core.count,6);
  }finally{visual.dispose();visual.dispose();rig.dispose();}
  assert.deepEqual(asset.disposed,{geometry:1,material:1,texture:1,bitmap:1});
  assert.equal(scene.children.length,0);assert.equal(visual.status,'disposed');
});

test('all six exhaust origins meet the imported nozzle rims after scaling, flight poses and staged shutdown',async()=>{
  const {scene,rig}=rocket(),asset=fixture(),visual=createStarshipVisual(rig,async()=>asset.model);
  const apply=createArrivalRigPose(rig),frame=createArrivalFrame();
  const matrix=new T.Matrix4(),tip=new T.Vector3(),expected=new T.Vector3();
  try{
    await visual.ready;
    for(const [time,landingCount] of [[2,0],[24.5,2],[28,1]]){
      sampleStarshipArrival(time,frame);apply(frame,time,false);
      // These frames are upright, so engine gimbals cannot move the rim from its measured origin.
      assert.equal(Math.abs(frame.shipRoll),0);scene.updateMatrixWorld(true);
      rig.setPropulsion(0,.5,time,false,false,landingCount);
      const count=landingCount||6;
      assert.equal(rig.shipEngines.flame.count,count);
      for(let index=0;index<count;index++){
        const sourceIndex=landingCount?3+index:index;
        expected.fromArray(STARSHIP_NOZZLES[sourceIndex]).multiplyScalar(REUSABLE_ROCKET.height).applyMatrix4(rig.starshipUpperStage.matrixWorld);
        rig.shipEngines.flame.getMatrixAt(index,matrix);
        tip.set(0,.5,0).applyMatrix4(matrix).applyMatrix4(rig.shipEngines.flame.matrixWorld);
        assert.ok(tip.distanceTo(expected)<1e-5,`Engine ${sourceIndex} plume begins at its nozzle rim`);
      }
    }
    sampleStarshipArrival(32,frame);apply(frame,32,false);
    assert.equal(rig.shipEngines.flame.visible,false);assert.equal(rig.shipEngines.core.visible,false);
  }finally{visual.dispose();rig.dispose();}
});

test('missing, failed and Node-default loads retain the complete procedural fallback',async()=>{
  for(const loader of [undefined,async()=>null,async()=>{throw new Error('Model unavailable');}]){
    const {scene,rig,fallback}=rocket();
    const geometryBefore=[];rig.shipEngines.root.traverseVisible(object=>{if(object instanceof T.Mesh)geometryBefore.push(object);});
    const visual=createStarshipVisual(rig,loader);
    try{
      await visual.ready;assert.equal(visual.status,'fallback');assert.equal(fallback.visible,true);
      assert.equal(rig.starshipUpperStage.getObjectByName('Imported Starship'),undefined);
      assert.deepEqual(rig.shipEngines.root.scale.toArray(),[1,1,1]);
      for(const object of geometryBefore)assert.equal(object.visible,true);
      rig.setPropulsion(0,.5,2);assert.equal(rig.shipEngines.flame.count,6);
    }finally{visual.dispose();rig.dispose();}
    assert.equal(scene.children.length,0);
  }
});

test('a load completing after teardown cannot attach meshes and releases shared asset resources once',async()=>{
  const {scene,rig}=rocket(),asset=fixture();let resolve;
  const pending=new Promise(done=>{resolve=done;});
  const visual=createStarshipVisual(rig,()=>pending);
  visual.dispose();visual.dispose();rig.dispose();resolve(asset.model);await visual.ready;
  assert.equal(visual.status,'disposed');assert.equal(asset.model.parent,null);
  assert.equal(scene.children.length,0);
  assert.deepEqual(asset.disposed,{geometry:1,material:1,texture:1,bitmap:1});
});
