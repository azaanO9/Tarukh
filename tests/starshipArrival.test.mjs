import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {STARBASE,createStarbaseState} from '../game/starbaseRig.ts';
import {createArrivalFrame,sampleStarshipArrival,advanceArrival,advanceArrivalWithReadiness,canEnterMars,SHIP_CAPTURE_ALTITUDE,STARSHIP_SPACE_CUT,STARSHIP_RETURN_CUT,ARRIVAL_READY_HOLD} from '../game/starshipArrival.ts';
import {createStarbase} from '../ui/starbase/createStarbase.ts';
import {REUSABLE_ROCKET} from '../game/reusableRocket.ts';
import {createArrivalRigPose} from '../ui/starbase/arrivalRig.ts';
import {createLandingDust} from '../ui/starbase/landingDust.ts';

test('one reusable craft remains intact through Earth, space and Mars',()=>{
  const scene=new T.Scene(),rig=createStarbase(scene,{reusableRocket:true,ground:false});
  const apply=createArrivalRigPose(rig),frame=createArrivalFrame(),vehicle=rig.starshipUpperStage;
  const geometries=[];vehicle.traverse(o=>{if(o instanceof T.Mesh)geometries.push(o.geometry);});
  try{
    assert.ok(vehicle.getObjectByName('reusableCrewVehicle'));
    assert.equal(vehicle.getObjectByName('windwardHexagonalTPS'),undefined);
    assert.equal(rig.boosterEngines.centres.length,0);
    for(let t=0;t<=32;t+=.1){
      sampleStarshipArrival(t,frame);apply(frame,t,false);
      assert.equal(frame.separated,false);assert.equal(frame.boosterVisible,false);
      assert.equal(rig.stagesSeparated,false);assert.equal(vehicle.parent,rig.rocketEntity);
      assert.equal(rig.superHeavyBooster.visible,false);
      assert.equal(rig.rocketEntity.position.y,frame.shipY);
    }
    rig.separateStages();assert.equal(rig.stagesSeparated,false);
    const after=[];vehicle.traverse(o=>{if(o instanceof T.Mesh)after.push(o.geometry);});
    assert.deepEqual(after,geometries);
  }finally{rig.dispose();rig.dispose();}assert.equal(scene.children.length,0);
});

test('upright Earth liftoff accelerates from the pad; both environment cuts are covered',()=>{
  const frame=createArrivalFrame();sampleStarshipArrival(0,frame);
  assert.equal(frame.environment,'earth');assert.equal(frame.shipY,REUSABLE_ROCKET.launchAltitude);
  let previous=frame.shipY,velocity=0;
  for(let t=.02;t<STARSHIP_SPACE_CUT;t+=.02){
    sampleStarshipArrival(t,frame);const dy=frame.shipY-previous;
    assert.ok(dy>=velocity-1e-7);assert.equal(frame.shipRoll,0);previous=frame.shipY;velocity=dy;
  }
  for(const cut of [STARSHIP_SPACE_CUT,STARSHIP_RETURN_CUT]){
    sampleStarshipArrival(cut-.0001,frame);assert.ok(frame.fade>.999);
    sampleStarshipArrival(cut,frame);assert.equal(frame.fade,1);
  }
  sampleStarshipArrival(STARSHIP_SPACE_CUT,frame);assert.equal(frame.environment,'space');
  sampleStarshipArrival(STARSHIP_RETURN_CUT,frame);assert.equal(frame.environment,'mars');
});

test('the coast shot waits for the prepared game without advancing into an empty landing',()=>{
  let elapsed=0;for(let i=0;i<6000;i++)elapsed=advanceArrivalWithReadiness(elapsed,1/60,false,false);
  assert.equal(elapsed,ARRIVAL_READY_HOLD);
  assert.equal(advanceArrivalWithReadiness(elapsed,.05,true,true),elapsed);
  assert.ok(advanceArrivalWithReadiness(elapsed,.05,false,true)>elapsed);
});

test('arms close after alignment and support both pins before the engine cutoff',()=>{
  const frame=createArrivalFrame();let lastY=Infinity;
  for(let time=STARSHIP_RETURN_CUT;time<32;time+=1/120){
    sampleStarshipArrival(time,frame);assert.ok(frame.shipY<=lastY+1e-8);lastY=frame.shipY;
    if(time>23){assert.equal(frame.shipX,0);assert.equal(Math.abs(frame.shipRoll),0);}
    const gap=frame.shipY+REUSABLE_ROCKET.pinHeight-STARBASE.pinRadius-frame.carriageHeight;
    assert.ok(gap>=-1e-8);if(time>23&&time<26)assert.ok(gap>1.19);
    if(time>26&&time<28.9){assert.equal(frame.armAngle,0);assert.ok(frame.shipThrust>0);}
  }
  sampleStarshipArrival(32,frame);assert.equal(frame.shipY,SHIP_CAPTURE_ALTITUDE);assert.equal(frame.shipThrust,0);assert.equal(frame.complete,true);
  assert.equal(frame.shipY+REUSABLE_ROCKET.pinHeight-STARBASE.pinRadius,frame.carriageHeight);
});

test('landing stays nearly upright and switches from three to two to one engine',()=>{
  const frame=createArrivalFrame();sampleStarshipArrival(13,frame);assert.ok(frame.shipThrust>0);assert.ok(frame.shipRoll>=-8&&frame.shipRoll<=0);
  sampleStarshipArrival(16,frame);assert.ok(frame.shipThrust>.45);assert.ok(frame.shipRoll>-8&&frame.shipRoll<0);assert.equal(frame.landingEngines,3);
  sampleStarshipArrival(24.5,frame);assert.equal(frame.landingEngines,2);assert.ok(frame.dust>0);
  sampleStarshipArrival(28,frame);assert.equal(frame.landingEngines,1);assert.ok(frame.dust>0);
  sampleStarshipArrival(29,frame);assert.equal(frame.shipThrust,0);assert.equal(frame.dust,0);
});

test('handoff waits for Mars readiness through completion, skip and reduced motion',()=>{
  for(const reduced of [false,true])for(const skipped of [false,true])assert.equal(canEnterMars(false,100,skipped,reduced),false);
  assert.equal(canEnterMars(true,31,false,false),false);assert.equal(canEnterMars(true,32,false,false),true);
  assert.equal(canEnterMars(true,0,true,false),true);assert.equal(canEnterMars(true,2,false,true),true);
  assert.equal(advanceArrival(4,2,true),4);assert.equal(advanceArrival(4,NaN,false),4);
  for(const fps of [30,60,120]){let time=0;for(let i=0;i<fps*33;i++)time=advanceArrival(time,1/fps,false);assert.equal(canEnterMars(true,time,false,false),true);}
});

test('each stage controls its own exhaust and all flame layers turn off on capture',()=>{
  const scene=new T.Scene(),rig=createStarbase(scene,{shipCatchPins:true}),p=createStarbaseState().current;
  try{
    rig.applyPose(p,'stack',0);rig.setPropulsion(.4,.8,2,false,false,0);
    assert.equal(rig.boosterEngines.flame.count,33);assert.equal(rig.shipEngines.flame.count,6);
    assert.equal(rig.shipEngines.plumeMaterials[0].uniforms.thrust.value,.8);
    for(const count of [3,2,1]){rig.setPropulsion(0,.4,24,false,false,count);assert.equal(rig.shipEngines.flame.count,count);assert.equal(rig.shipEngines.core.count,count);assert.equal(rig.boosterEngines.flame.visible,false);}
    rig.setPropulsion(0,0,29);assert.equal(rig.shipEngines.flame.visible,false);assert.equal(rig.shipEngines.core.visible,false);
    assert.ok(rig.starshipUpperStage.getObjectByName('shipCatchPins'));
  }finally{rig.dispose();}
});

test('ground dust stays in its fixed pool and dissipates when thrust ends',()=>{
  const scene=new T.Scene(),dust=createLandingDust(scene,32),camera=new T.PerspectiveCamera();
  try{
    for(let i=0;i<600;i++)dust.update(1/60,1,0,0,camera,false);
    assert.equal(dust.mesh.count,32);assert.ok(dust.active>0&&dust.active<=32);
    assert.ok([...dust.mesh.instanceMatrix.array].every(Number.isFinite));
    for(let i=0;i<360;i++)dust.update(1/60,0,0,0,camera,false);
    assert.equal(dust.active,0);assert.equal(dust.mesh.visible,false);
  }finally{dust.dispose();}assert.equal(scene.children.length,0);
});
