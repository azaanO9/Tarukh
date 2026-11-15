import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {STARBASE as D,createStarbaseState,startCatch,stepStarbase,setRigControl,setArticulation,resetStarbase,catchRailZ} from '../game/starbaseRig.ts';
import {createStarbase} from '../ui/starbase/createStarbase.ts';

function finish(state,dt=1/60){for(let i=0;i<4000&&state.running;i++)stepStarbase(state,dt);assert.equal(state.running,false);}

test('catch settles both lift pins on the rails and extinguishes thrust at every tested frame rate',()=>{
  for(const dt of [1/30,1/60,1/120]){
    const state=createStarbaseState();startCatch(state);finish(state,dt);const p=state.current;
    assert.equal(state.secured,true);assert.equal(state.phase,'Secured on catch rails');assert.equal(p.engineThrust,0);
    assert.ok(Math.abs(p.rocketPosY+D.pinHeight-D.pinRadius-p.carriageHeight)<1e-9);
    for(const value of [p.rocketPosX,p.rocketPosZ,p.rocketPitch,p.rocketRoll])assert.ok(Math.abs(value)<1e-9);
    for(const side of [-1,1])assert.ok(Math.abs(catchRailZ(side,0,0)-side*D.pinZ)<1e-9);
  }
});

test('catch closes only while pins are above the rails, with continuous downward motion',()=>{
  const state=createStarbaseState();startCatch(state);let prior=state.current.rocketPosY;
  for(let i=0;i<2000&&state.running;i++){
    stepStarbase(state,1/60);const p=state.current;
    assert.ok(p.rocketPosY<=prior+1e-8);assert.ok(Math.abs(p.rocketPosY-prior)<.3);
    if(state.elapsed>20&&state.elapsed<25){assert.ok(p.rocketPosY+D.pinHeight-D.pinRadius>p.carriageHeight+1);assert.equal(p.qd,1);}
    prior=p.rocketPosY;
  }
});

test('pause freezes the entire sequence; manual controls cancel it safely and reject invalid numbers',()=>{
  const state=createStarbaseState();startCatch(state);stepStarbase(state,.1);state.paused=true;
  const saved=JSON.stringify(state);for(let i=0;i<30;i++)stepStarbase(state,.1);assert.equal(JSON.stringify(state),saved);
  state.paused=false;assert.equal(setRigControl(state,'leftArmAngle',NaN),false);assert.equal(state.running,true);
  setRigControl(state,'leftArmAngle',99);assert.equal(state.target.leftArmAngle,35);assert.equal(state.running,false);
  setRigControl(state,'carriageHeight',0);assert.equal(state.target.carriageHeight,25);
  assert.ok(state.target.rightArmAngle<35);assert.equal(setArticulation(state,'flaps',4,25),false);
  setArticulation(state,'gridFins',2,-80);assert.equal(state.target.gridFins[2],-30);
  assert.equal(state.target.gridFins[1],state.current.gridFins[1]);
});

test('carriage can lift a secured booster using world coordinates without moving it laterally',()=>{
  const state=createStarbaseState();startCatch(state);finish(state);setRigControl(state,'carriageHeight',112);
  for(let i=0;i<300;i++)stepStarbase(state,1/60);
  assert.ok(Math.abs(state.current.carriageHeight-112)<1e-6);
  assert.ok(Math.abs(state.current.rocketPosY+D.pinHeight-D.pinRadius-112)<1e-6);
  assert.equal(state.current.rocketPosX,0);assert.equal(state.current.rocketPosZ,0);
  resetStarbase(state);assert.equal(state.view,'stack');assert.equal(state.secured,false);assert.equal(state.target.engineThrust,0);
});

test('scene has an independent rocket, two modular stages, 33+6 engines and independently movable surfaces',()=>{
  const scene=new T.Scene(),rig=createStarbase(scene),state=createStarbaseState();
  try{
    assert.equal(rig.rocketEntity.parent,scene);assert.equal(rig.mechazillaTower.parent,scene);assert.equal(rig.mechazillaTower.position.x,-18);
    assert.equal(rig.superHeavyBooster.parent,rig.rocketEntity);assert.equal(rig.starshipUpperStage.parent,rig.rocketEntity);
    assert.equal(rig.boosterEngines.root.userData.engineCount,33);assert.equal(rig.shipEngines.root.userData.engineCount,6);
    assert.equal(rig.boosterEngines.gimbals.length,13);assert.equal(rig.shipEngines.gimbals.length,3);
    assert.equal(rig.gridFins.length,4);assert.equal(rig.forwardFlaps.length,2);assert.equal(rig.aftFlaps.length,2);
    state.current.leftArmAngle=31;state.current.rightArmAngle=7;state.current.gridFins[2]=14;state.current.flaps[3]=56;
    rig.applyPose(state.current,'stack',0);assert.ok(Math.abs(rig.leftArmPivot.rotation.y-31*Math.PI/180)<1e-9);
    assert.ok(Math.abs(rig.rightArmPivot.rotation.y+7*Math.PI/180)<1e-9);
    assert.equal(rig.gridFins[0].rotation.x,0);assert.equal(rig.gridFins[2].rotation.x,14*Math.PI/180);
    assert.equal(rig.aftFlaps[1].rotation.x,56*Math.PI/180);
  }finally{rig.dispose();}
});

test('hydraulic rods remain attached at both ends throughout independent arm travel',()=>{
  const scene=new T.Scene(),rig=createStarbase(scene),p=createStarbaseState().current;
  try{
    const lengths=[];
    for(const angle of [0,12,18,30,35]){
      p.leftArmAngle=angle;p.rightArmAngle=35-angle;rig.applyPose(p,'booster',0);scene.updateMatrixWorld(true);
      for(const piston of rig.pistons){
        const end=new T.Vector3(0,piston.root.userData.extension,0).applyMatrix4(piston.root.matrixWorld);
        const attach=piston.tip.clone().applyMatrix4(piston.arm.matrixWorld);
        assert.ok(end.distanceTo(attach)<1e-6);assert.ok(piston.rod.scale.y>0&&piston.rod.scale.y<8);
      }
      lengths.push(rig.pistons[0].root.userData.extension);
    }
    assert.ok(Math.max(...lengths)-Math.min(...lengths)>.2);
  }finally{rig.dispose();}
});

test('stage separation preserves the world transform and frees upper-stage motion from the booster',()=>{
  const scene=new T.Scene(),rig=createStarbase(scene),p=createStarbaseState().current;
  try{
    p.rocketPosX=8;p.rocketPosY=80;p.rocketPitch=12;p.rocketYaw=20;p.rocketRoll=4;
    rig.applyPose(p,'stack',0);scene.updateMatrixWorld(true);const before=rig.starshipUpperStage.matrixWorld.clone();
    rig.separateStages();scene.updateMatrixWorld(true);assert.equal(rig.starshipUpperStage.parent,scene);
    for(let i=0;i<16;i++)assert.ok(Math.abs(before.elements[i]-rig.starshipUpperStage.matrixWorld.elements[i])<1e-8);
    p.rocketPosY=50;rig.applyPose(p,'stack',0);scene.updateMatrixWorld(true);
    for(let i=0;i<16;i++)assert.ok(Math.abs(before.elements[i]-rig.starshipUpperStage.matrixWorld.elements[i])<1e-8);
    rig.joinStages();assert.equal(rig.starshipUpperStage.parent,rig.rocketEntity);assert.equal(rig.starshipUpperStage.position.y,71);
  }finally{rig.dispose();}
});

test('rendered catch pins contact the actual arm rails while the booster remains independent',()=>{
  const scene=new T.Scene(),rig=createStarbase(scene),state=createStarbaseState();
  try{
    startCatch(state);finish(state);rig.applyPose(state.current,'booster',32);scene.updateMatrixWorld(true);
    const {left,right}=rig.pins();
    for(const pin of [left,right])assert.ok(Math.abs(pin.y-D.pinRadius-rig.chopstickCarriage.getWorldPosition(new T.Vector3()).y)<1e-7);
    assert.equal(rig.boosterEngines.flame.visible,false);assert.equal(rig.rocketEntity.parent,scene);
  }finally{rig.dispose();}
});

test('standalone HTML contains its renderer, no external scripts, and matches the current source files',async()=>{
  const files=['game/starbaseRig.ts','ui/starbase/createStarbase.ts','ui/starbase/main.ts','ui/starbase/preview.html','scripts/build-starbase.mjs'];
  const hash=createHash('sha256');for(const file of files)hash.update(file+'\0'+(await fs.readFile(new URL('../'+file,import.meta.url),'utf8')).replaceAll('\r\n','\n'));
  const html=await fs.readFile(new URL('../public/starbase.html',import.meta.url),'utf8');
  assert.ok(html.includes('Source SHA256: '+hash.digest('hex')),'Rebuild the standalone preview after changing its source');
  assert.equal((html.match(/<script[\s>]/g)||[]).length,1);assert.ok(!/<script[^>]+src=/.test(html));
  assert.ok(html.includes('starbaseControls'));assert.ok(html.includes('The MIT License'));assert.ok(Buffer.byteLength(html)<900000);
});
