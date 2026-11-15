import test from 'node:test';
import assert from 'node:assert/strict';
import {GARAGE_SITE as S,garageClearing,garageFloorAt} from '../game/garageSite.ts';
import {createGarageState,garageControlsRover,garagePrompt,requestGarageCycle,roverReturnIssue,stepGarage} from '../game/roverGarage.ts';
import {spawnRoverVehicle,enterRover} from '../game/roverVehicle.ts';
import {moveAndSlide,overlapBody} from '../game/collision.ts';
import {OUTPOST_GROUND_HEIGHT as datum,marsExpeditionHeight,marsOutpostHeight} from '../game/marsExpeditionTerrain.ts';

const height=(x,z)=>garageFloorAt(x,z,marsOutpostHeight(x,z),datum);
const observer={x:S.x-5.5,z:S.z+11,radius:.42,id:'walker'};
function setup(){const state=createGarageState(),rover=spawnRoverVehicle(S.x,S.z+S.parkedZ,Math.PI,height);return{state,rover};}
function step(state,rover,walker=observer,enabled=true,extras=[],sunlight=1){stepGarage(state,rover,1/60,enabled,walker,[...state.obstacles,...extras],height,sunlight);}
function until(state,rover,phase,walker=observer){
  for(let i=0;i<6000&&state.phase!==phase;i++)step(state,rover,walker);
  assert.equal(state.phase,phase,JSON.stringify({blocked:state.blocked,z:rover.z,door:state.doorAmount}));
}

test('garage, solar racks and return bay use planar native soil without changing arrival terrain',()=>{
  for(let x=S.minX;x<=S.maxX;x+=.5)for(let z=S.minZ;z<=S.maxZ;z+=.5){
    assert.ok(Math.abs(marsOutpostHeight(S.x+x,S.z+z)-datum)<1e-6);assert.ok(garageClearing(S.x+x,S.z+z));
  }
  for(const [x,z] of [[0,21],[17,10],[-24,24],[200,200]])assert.equal(marsOutpostHeight(x,z),marsExpeditionHeight(x,z));
  for(let z=5.2;z<=7.6;z+=.05){
    assert.ok(Math.abs(height(S.x,S.z+z)-(datum+S.floor*(7.6-z)/2.4))<1e-6);
  }
});

test('single vehicle deploys after the exact door cycle and returns without duplicating or resetting it',()=>{
  const {state,rover}=setup(),same=rover;
  rover.battery=37;rover.damage.wheel_fl=65;rover.upgrades=['test-retained'];
  assert.equal(garagePrompt(state,observer.x,observer.z,rover).enabled,true);
  assert.ok(requestGarageCycle(state,rover));assert.equal(requestGarageCycle(state,rover),false);
  for(let i=0;i<230;i++){step(state,rover);assert.equal(rover.z,S.z+S.parkedZ);}
  until(state,rover,'outside');assert.equal(state.doorAmount,0);assert.equal(state.door.disabled,false);
  assert.ok(Math.abs(rover.z-S.z-S.stagingZ)<1e-6);assert.ok(rover.wheelRoll>20);
  assert.equal(garageControlsRover(state),false);assert.ok(requestGarageCycle(state,rover));
  until(state,rover,'parked');assert.equal(rover,same);assert.ok(Math.abs(rover.z-S.z-S.parkedZ)<1e-6);
  assert.ok(Math.abs(rover.wheelRoll)<1e-5);assert.equal(rover.battery,37);assert.equal(rover.damage.wheel_fl,65);
  assert.deepEqual(rover.upgrades,['test-retained']);assert.equal(state.doorAmount,0);
});

test('rover stops for a person or science rover in its path, then resumes smoothly',()=>{
  const {state,rover}=setup();requestGarageCycle(state,rover);until(state,rover,'rolling-out');
  const person={x:S.x,z:S.z+11,radius:.42,id:'walker'};
  for(let i=0;i<1000&&!state.blocked;i++)step(state,rover,person);
  assert.match(state.blocked,/Clear the rover path/);const stopped=rover.z,roll=rover.wheelRoll;
  for(let i=0;i<100;i++)step(state,rover,person);
  assert.equal(rover.z,stopped);assert.equal(rover.wheelRoll,roll);
  assert.equal(overlapBody(rover.x,rover.z,state.body,person),null);
  until(state,rover,'outside');
  requestGarageCycle(state,rover);until(state,rover,'rolling-in');
  const scout={x:S.x,z:S.z+1,radius:1.2,id:'curiosity'};
  for(let i=0;i<1000&&!state.blocked;i++)step(state,rover,observer,true,[scout]);
  assert.match(state.blocked,/Clear the rover path/);until(state,rover,'parked');
});

test('paused game freezes doors, vehicle animation and power, and the canopy never closes on a visitor',()=>{
  const {state,rover}=setup();requestGarageCycle(state,rover);
  for(let i=0;i<70;i++)step(state,rover);
  const frozen={door:state.doorAmount,z:rover.z,battery:state.batteryWh};
  for(let i=0;i<90;i++)step(state,rover,observer,false);
  assert.deepEqual({door:state.doorAmount,z:rover.z,battery:state.batteryWh},frozen);
  until(state,rover,'closing-out');
  const inside={x:S.x+2,z:S.z,radius:.42,id:'walker'};
  for(let i=0;i<600;i++)step(state,rover,inside);
  assert.equal(state.doorAmount,1);assert.match(state.blocked,/Step outside/);
  until(state,rover,'outside');
});

test('return requires a stopped, unoccupied rover in the bay and preserves either arrival heading',()=>{
  for(const yaw of [0,Math.PI]){
    const {state,rover}=setup();state.phase='outside';rover.x=S.x+.8;rover.z=S.z+15;rover.yaw=yaw+.18;
    rover.driving=true;assert.match(roverReturnIssue(rover),/Exit/);assert.equal(requestGarageCycle(state,rover),false);
    rover.driving=false;assert.ok(requestGarageCycle(state,rover));
    const before=rover.x;step(state,rover);assert.equal(rover.x,before,'Opening must not teleport the rover onto the centreline');
    until(state,rover,'parked');assert.ok(Math.abs(rover.x-S.x)<1e-6);assert.ok(Math.abs(Math.sin(rover.yaw-yaw))<1e-6);
    requestGarageCycle(state,rover);until(state,rover,'outside');
    assert.ok(Math.abs(rover.z-S.z-S.stagingZ)<1e-6);
  }
  const {state,rover}=setup();state.phase='outside';rover.x+=100;
  assert.equal(requestGarageCycle(state,rover),false);assert.match(roverReturnIssue(rover),/return bay/);
  rover.x=S.x;rover.z=S.z+11;assert.equal(requestGarageCycle(state,rover),false,'No start under the door canopy');
  rover.z=S.z+13;rover.speed=2;assert.match(roverReturnIssue(rover),/Stop/);
});

test('closed garage is solid; open lane and ramp allow the same full-size crew rover through',()=>{
  const {state,rover}=setup(),body={x:0,z:0,halfX:1.69,halfZ:2.475,radius:3,yaw:Math.PI};
  const closed=moveAndSlide(rover.x,rover.z,0,14.3,[body],state.obstacles,Infinity);
  assert.ok(closed.z<S.z+4.8-2.4);
  state.door.disabled=true;
  const open=moveAndSlide(rover.x,rover.z,0,14.3,[body],state.obstacles,Infinity);
  assert.ok(Math.abs(open.z-S.z-13)<1e-5);
  assert.equal(enterRover(rover).driving,true,'Normal rover behavior is retained outside the garage controller');
});

test('solar-backed battery permits the door at night without changing rover battery or damage',()=>{
  const {state,rover}=setup();requestGarageCycle(state,rover);
  for(let i=0;i<245;i++)step(state,rover,observer,true,[],0);
  assert.equal(state.solarWatts,0);assert.ok(state.batteryWh<4200);assert.ok(state.lightsOn);
  assert.equal(state.doorAmount,1);assert.equal(rover.battery,100);
});

test('rover parked in garage recharges battery from base solar panels and inverter system',()=>{
  const {state,rover}=setup();
  rover.battery=40;
  assert.equal(state.phase,'parked');
  // Daylight sunlight=1 (1200W base solar rack generation)
  step(state,rover,observer,true,[],1);
  assert.equal(state.chargerActive,true);
  assert.equal(rover.garageCharging,true);
  assert.equal(rover.solarCharging,false);
  assert.equal(state.inverterWatts,850);
  assert.equal(state.inverterStatus,'CHARGING');
  assert.ok(rover.battery>40);

  // Advance 100 steps
  for(let i=0;i<100;i++)step(state,rover,observer,true,[],1);
  assert.ok(rover.battery>40.5);
  assert.ok(rover.estimatedRangeKm>34);
});

test('rover parked in garage recharges at night from base battery storage inverter',()=>{
  const {state,rover}=setup();
  rover.battery=50;
  state.batteryWh=3000;
  // Nighttime sunlight=0 (0W solar generation)
  step(state,rover,observer,true,[],0);
  assert.equal(state.solarWatts,0);
  assert.equal(state.chargerActive,true);
  assert.equal(rover.garageCharging,true);
  assert.equal(state.inverterWatts,850);
  assert.equal(state.inverterStatus,'INVERTING');
  assert.ok(rover.battery>50);
  assert.ok(state.batteryWh<3000);
});

test('base inverter halts rover charging when base battery is depleted at night',()=>{
  const {state,rover}=setup();
  rover.battery=20;
  state.batteryWh=5;
  step(state,rover,observer,true,[],0);
  assert.equal(state.solarWatts,0);
  assert.equal(state.chargerActive,false);
  assert.equal(rover.garageCharging,false);
  assert.equal(state.inverterStatus,'STANDBY');
  assert.equal(rover.battery,20);
});
