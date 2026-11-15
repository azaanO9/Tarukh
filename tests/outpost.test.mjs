import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {OUTPOST_SITE,outpostGradeWeight,gradeOutpostTerrain,outpostClearing} from '../game/outpostSite.ts';
import {marsExpeditionHeight,marsOutpostHeight,OUTPOST_GROUND_HEIGHT} from '../game/marsExpeditionTerrain.ts';
import {createOutpostState,nearestOutpostDoor,stepOutpostDoor,toggleOutpostDoor,occupiesOutpostDoor,OUTPOST_AIRLOCK_PAIRS,OUTPOST_AUTO_CLOSE_SECONDS} from '../game/outpost.ts';
import {moveAndSlide} from '../game/collision.ts';
import {scanRoverLidar} from '../game/roverLidar.ts';
import {spawnRoverVehicle} from '../game/roverVehicle.ts';
import {isOutpostInterior} from '../scripts/outpost-classification.mjs';

const layout=JSON.parse(fs.readFileSync(new URL('../public/models/outpost/layout.json',import.meta.url),'utf8'));
const baseY=OUTPOST_GROUND_HEIGHT+OUTPOST_SITE.foundationOffset;
const state=()=>createOutpostState(layout,baseY);
const close=(a,b,message)=>assert.ok(Math.abs(a-b)<.00001,message??`${a} != ${b}`);

test('offline grouping keeps furnished rooms out of the distant exterior batches',()=>{
  for(const name of ['FURNISHED INTERIORS','ROOM_CREW_01','ROOM_TREATMENT','V8 / INTERIOR EQUIPMENT','V8 / INNER BULKHEADS','V8 / CEILING SERVICES','01 / detailed cabin liner','02 / CREW LIVING / interior pressure panel'])assert.ok(isOutpostInterior(name),name);
  for(const name of ['01 / white cylindrical pressure shell','03 / MEDICAL + WORKSHOP / white hull','Entrance / continuous accessible ramp','POWER / photovoltaic array','LINK EAST / white quilted canopy'])assert.equal(isOutpostInterior(name),false,name);
});

test('the entire campus footprint is planar while arrival and remote terrain are unchanged',()=>{
  for(let x=-32;x<=30;x+=2)for(let z=-32;z<=21;z+=2){
    close(marsOutpostHeight(x+OUTPOST_SITE.x,z+OUTPOST_SITE.z),OUTPOST_GROUND_HEIGHT);
    assert.ok(outpostClearing(x+OUTPOST_SITE.x,z+OUTPOST_SITE.z));
  }
  for(const [x,z] of [[0,14],[17,10],[-24,24],[180,180],[-400,80]])close(marsOutpostHeight(x,z),marsExpeditionHeight(x,z));
});

test('site grading blends continuously into native terrain without a second ground mesh',()=>{
  let previous=1;
  for(let dx=0;dx<=12;dx+=.1){
    const weight=outpostGradeWeight(OUTPOST_SITE.maxX+dx,OUTPOST_SITE.z);
    assert.ok(weight<=previous+.000001);assert.ok(weight>=0);previous=weight;
    close(gradeOutpostTerrain(OUTPOST_SITE.maxX+dx,OUTPOST_SITE.z,4,2),4-2*weight);
  }
  close(outpostGradeWeight(OUTPOST_SITE.maxX+12,OUTPOST_SITE.z),0);
});

test('the extracted ramp rises gradually into walkable rooms at human scale',()=>{
  const campus=state();let previous=OUTPOST_GROUND_HEIGHT;
  for(let z=13.4;z>=5.4;z-=.1){
    const height=campus.floorAt(OUTPOST_SITE.x,OUTPOST_SITE.z+z,OUTPOST_GROUND_HEIGHT);
    assert.ok(height>=previous-.04);assert.ok(height-previous<.08);previous=height;
  }
  for(const [x,z] of [[0,0],[-19,0],[18,0],[-11,-22],[12,-22],[0,-13]]){
    const height=campus.floorAt(OUTPOST_SITE.x+x,OUTPOST_SITE.z+z,OUTPOST_GROUND_HEIGHT);
    assert.ok(height>OUTPOST_GROUND_HEIGHT+.65&&height<OUTPOST_GROUND_HEIGHT+.8,`${x},${z}: ${height}`);
  }
  close(campus.floorAt(1000,1000,17),17);
  for(const [a,b] of [[[0,0],[-16,0]],[[0,0],[17,0]],[[0,3.4],[0,-13]],[[0,-13],[-11,-13]],[[-11,-13],[-11,-19]],[[0,-13],[12,-13]],[[12,-13],[12,-19]]]){
    for(let t=0;t<=1;t+=.02){
      const height=campus.floorAt(OUTPOST_SITE.x+a[0]+(b[0]-a[0])*t,OUTPOST_SITE.z+a[1]+(b[1]-a[1])*t,OUTPOST_GROUND_HEIGHT);
      assert.ok(height>OUTPOST_GROUND_HEIGHT+.65,'Connecting route must have continuous floor '+JSON.stringify({a,b,t,height}));
    }
  }
});

test('every real gate blocks a walking capsule closed and is traversable open in both directions',()=>{
  const campus=state();
  for(const d of campus.doors){d.amount=d.target=1;d.collider.disabled=true;}
  for(const door of campus.doors)for(const sign of [-1,1]){
    const x=door.x-door.nx*.85*sign,z=door.z-door.nz*.85*sign;
    const dx=door.nx*1.7*sign,dz=door.nz*1.7*sign;
    door.collider.disabled=false;
    const closed=moveAndSlide(x,z,dx,dz,[{x:0,z:0,radius:.32}],campus.obstacles,Infinity);
    assert.ok(Math.hypot(closed.x-x-dx,closed.z-z-dz)>.3,door.id+' must block');
    door.collider.disabled=true;
    const open=moveAndSlide(x,z,dx,dz,[{x:0,z:0,radius:.32}],campus.obstacles,Infinity);
    assert.ok(Math.hypot(open.x-x-dx,open.z-z-dz)<.03,door.id+' must clear '+JSON.stringify({x,z,open,dx,dz}));
  }
});

test('door interaction selects the faced gate and closing refuses an occupied doorway',()=>{
  const campus=state(),door=campus.doors.find(d=>d.id==='entrance');
  assert.equal(nearestOutpostDoor(campus.doors,door.x,door.y,door.z+2,0),door);
  assert.equal(nearestOutpostDoor(campus.doors,door.x,door.y,door.z+2,Math.PI),null);
  toggleOutpostDoor(door,door.x,door.y,door.z+2);
  for(let i=0;i<40;i++)stepOutpostDoor(door,.05,door.x,door.y,door.z+2);
  assert.equal(door.amount,1);assert.equal(door.collider.disabled,true);
  assert.equal(toggleOutpostDoor(door,door.x,door.y,door.z),false);
  assert.equal(door.target,1);assert.equal(door.blocked,true);
  stepOutpostDoor(door,.05,door.x,door.y,door.z+2);
  assert.equal(door.blocked,false,'The warning clears after stepping out of the doorway');
  toggleOutpostDoor(door,door.x,door.y,door.z+2);
  stepOutpostDoor(door,.1,door.x,door.y,door.z+2);
  assert.equal(door.collider.disabled,false);
  stepOutpostDoor(door,.1,door.x,door.y,door.z);
  assert.equal(door.target,1);assert.equal(door.blocked,true);
});

test('an open door neither blocks the rover nor creates a ghost lidar return',()=>{
  const {doors}=state(),door=doors[0];door.collider.disabled=true;
  const rover=spawnRoverVehicle(door.x,door.z+8,0,()=>0);
  assert.equal(scanRoverLidar(rover,[door.collider]).contacts.length,0);
  door.collider.disabled=false;
  assert.equal(scanRoverLidar(rover,[door.collider]).contacts.length,1);
});

test('gate state is independent and invalid frame deltas cannot move a leaf',()=>{
  const {doors}=state(),door=doors[0];door.target=1;
  for(const dt of [NaN,-1,Infinity,0])assert.equal(stepOutpostDoor(door,dt,0,0,0),false);
  stepOutpostDoor(door,1000,door.x,door.y,door.z+4);
  assert.ok(door.amount>0&&door.amount<.1);assert.ok(doors.slice(1).every(d=>d.amount===0));
});

function stepGates(campus,frames,position) {
  for(let frame=0;frame<frames;frame++){
    for(const door of campus.doors)stepOutpostDoor(door,.05,position.x,position.y,position.z);
    for(const door of campus.doors)if(door.pair){
      assert.ok(door.amount===0||door.pair.amount===0,`${door.id}: both chamber gates are raised`);
    }
  }
}

test('all outpost doors auto-close only after the fully open doorway has remained clear',()=>{
  const campus=state();
  assert.equal(campus.doors.find(door=>door.id==='entrance').pair,undefined);
  for(const door of campus.doors){
    assert.equal(door.autoCloseSeconds,OUTPOST_AUTO_CLOSE_SECONDS);
    const outside={x:door.x+door.nx*3,y:door.y,z:door.z+door.nz*3};
    toggleOutpostDoor(door,outside.x,outside.y,outside.z);
    stepGates(campus,34,outside);
    assert.equal(door.amount,1);
    stepGates(campus,100,{x:door.x,y:door.y,z:door.z});
    assert.equal(door.amount,1,'An occupied open doorway must stay open');
    assert.equal(door.clearSeconds,0);
    stepGates(campus,39,outside);
    assert.equal(door.amount,1,'Two clear seconds are required');
    stepGates(campus,2,outside);
    assert.ok(door.amount<1);
    stepGates(campus,34,outside);
    assert.equal(door.amount,0);
    assert.equal(door.collider.disabled,false);
  }
});

test('each airlock cycles in both directions and waits for a fully sealed opposite gate',()=>{
  for(const pair of OUTPOST_AIRLOCK_PAIRS)for(const reverse of [false,true]){
    const campus=state(),ids=reverse?[...pair].reverse():pair;
    const first=campus.doors.find(door=>door.id===ids[0]);
    const next=campus.doors.find(door=>door.id===ids[1]);
    assert.equal(first.pair,next);assert.equal(next.pair,first);
    const middle={x:(first.x+next.x)/2,y:first.y,z:(first.z+next.z)/2};
    assert.equal(occupiesOutpostDoor(first,middle.x,middle.y,middle.z),false);
    assert.equal(occupiesOutpostDoor(next,middle.x,middle.y,middle.z),false);
    toggleOutpostDoor(first,middle.x,middle.y,middle.z);
    stepGates(campus,34,middle);assert.equal(first.amount,1);
    toggleOutpostDoor(next,middle.x,middle.y,middle.z);
    assert.equal(next.waiting,true);assert.equal(next.target,0);
    for(let frame=0;frame<34;frame++){
      stepGates(campus,1,middle);
      if(first.amount>0)assert.equal(next.amount,0);
    }
    assert.equal(first.amount,0);assert.equal(first.collider.disabled,false);
    stepGates(campus,34,middle);
    assert.equal(next.amount,1);assert.equal(next.waiting,false);
  }
});

test('queued gate waits safely when the departing gate is occupied, then continues after clearance',()=>{
  const campus=state(),first=campus.doors.find(door=>door.id==='botany_transit'),next=first.pair;
  const occupied={x:first.x,y:first.y,z:first.z};
  toggleOutpostDoor(first,occupied.x,occupied.y,occupied.z);stepGates(campus,34,occupied);
  toggleOutpostDoor(next,occupied.x,occupied.y,occupied.z);
  stepGates(campus,100,occupied);
  assert.equal(first.amount,1);assert.equal(first.blocked,true);
  assert.equal(next.waiting,true);assert.equal(next.amount,0);
  // The 1.65m botany chamber has useful standing space, not a deadlocked overlap
  // of both gates' much larger architectural frame bounds.
  const middle={x:first.x,y:first.y,z:(first.z+next.z)/2+.12};
  assert.equal(occupiesOutpostDoor(first,middle.x,middle.y,middle.z),false);
  assert.equal(occupiesOutpostDoor(next,middle.x,middle.y,middle.z),false);
  stepGates(campus,68,middle);
  assert.equal(first.amount,0);assert.equal(next.amount,1);
});

test('walking back into an automatically closing gate reverses it before collision overlap',()=>{
  const campus=state(),door=campus.doors.find(door=>door.id==='entrance');
  const clear={x:door.x,y:door.y,z:door.z+3};
  toggleOutpostDoor(door,clear.x,clear.y,clear.z);stepGates(campus,76,clear);
  assert.equal(door.target,0);assert.ok(door.amount<1&&door.amount>0);
  const near={x:door.x,y:door.y,z:door.z+.5};
  stepGates(campus,1,near);
  assert.equal(door.target,1);assert.equal(door.blocked,true);
  stepGates(campus,34,near);assert.equal(door.amount,1);
});

test('a queued request can be cancelled or replaced without reopening both sides',()=>{
  for(const replacement of ['cancel','reopen']){
    const campus=state(),first=campus.doors.find(door=>door.id==='west_command'),next=first.pair;
    const middle={x:(first.x+next.x)/2,y:first.y,z:first.z};
    toggleOutpostDoor(first,middle.x,middle.y,middle.z);stepGates(campus,34,middle);
    toggleOutpostDoor(next,middle.x,middle.y,middle.z);stepGates(campus,5,middle);
    assert.equal(next.waiting,true);
    const requested=replacement==='cancel'?next:first;
    toggleOutpostDoor(requested,middle.x,middle.y,middle.z);
    assert.equal(next.waiting,false);
    stepGates(campus,25,middle);
    assert.equal(next.amount,0);
    if(replacement==='reopen')assert.equal(first.amount,1);
    stepGates(campus,100,middle);
    assert.equal(next.amount,0);assert.equal(first.amount,0);
  }
});

test('pause and invalid deltas do not advance the closing timer or queued state',()=>{
  const campus=state(),door=campus.doors.find(door=>door.id==='east_command');
  door.amount=door.target=1;door.clearSeconds=.5;door.collider.disabled=true;
  for(const dt of [0,-1,NaN,Infinity]){
    assert.equal(stepOutpostDoor(door,dt,door.x+4,door.y,door.z),false);
    assert.equal(door.clearSeconds,.5);assert.equal(door.amount,1);
    door.pair.waiting=true;
    assert.equal(stepOutpostDoor(door.pair,dt,door.x+4,door.y,door.z),false);
    assert.equal(door.pair.waiting,true);assert.equal(door.target,1);
  }
  stepOutpostDoor(door,1000,door.x+4,door.y,door.z);
  close(door.clearSeconds,.6);assert.equal(door.amount,1,'Large deltas are bounded for both timer and leaf');
});
