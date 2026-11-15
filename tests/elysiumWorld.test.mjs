import test from 'node:test';
import assert from 'node:assert/strict';
import {ELYSIUM_SITES,ELYSIUM_ROUTES,nearestElysiumSite} from '../game/elysiumSites.ts';
import {PLAYABLE_BOUNDS} from '../game/explorationBounds.ts';
import {SITE_IDS} from '../game/elysiumMission.ts';
import {createGarageState,requestGarageCycle,stepGarage} from '../game/roverGarage.ts';
import {GARAGE_SITE,garageFloorAt} from '../game/garageSite.ts';
import {spawnRoverVehicle} from '../game/roverVehicle.ts';
import {marsOutpostHeight,OUTPOST_GROUND_HEIGHT} from '../game/marsExpeditionTerrain.ts';
import {SpaceWeatherService} from '../game/spaceWeatherService.ts';
import {allocatedRoverCharge,approachStoryDaylight} from '../game/elysiumWorld.ts';

test('readiness night and sunrise ease smoothly even while the planning dialog is open',()=>{
  const night=approachStoryDaylight(0,true,.1);
  assert.ok(night>0&&night<30);
  assert.equal(approachStoryDaylight(300,true,1),300);
  assert.equal(approachStoryDaylight(300,false,0),300);
  assert.ok(approachStoryDaylight(300,false,.1)>300);
  const half=approachStoryDaylight(approachStoryDaylight(0,true,.5),true,.5);
  assert.ok(Math.abs(half-approachStoryDaylight(0,true,1))<1e-10);
});

test('story charge ceiling preserves driving drain and blocks passive roof-panel bypass',()=>{
  const held={revision:0,roverCharge:12,maxCharge:12,chargingAllowed:false};
  assert.equal(allocatedRoverCharge(12,12.4,held),12);
  assert.equal(allocatedRoverCharge(11.7,11.8,held),11.7);
  assert.equal(allocatedRoverCharge(12,11.5,held),11.5);
  assert.equal(allocatedRoverCharge(12,15,{...held,maxCharge:100,chargingAllowed:true}),15);
  assert.equal(allocatedRoverCharge(99,102,{...held,maxCharge:100,chargingAllowed:true}),100);
});

const height=(x,z)=>garageFloorAt(x,z,marsOutpostHeight(x,z),OUTPOST_GROUND_HEIGHT);
const observer={x:GARAGE_SITE.x-5.5,z:GARAGE_SITE.z+11,radius:.42,id:'walker'};
function garage(){
  const state=createGarageState(),rover=spawnRoverVehicle(GARAGE_SITE.x,GARAGE_SITE.z+GARAGE_SITE.parkedZ,Math.PI,height);
  rover.battery=12;return {state,rover};
}
function step({state,rover},allowCharging){
  const args=[state,rover,1/60,true,observer,state.obstacles,height,1,false];
  if(allowCharging!==undefined)args.push(allowCharging);
  stepGarage(...args);
}

test('story allocation disables dock charging without disabling doors, rollout or the base inverter',()=>{
  const g=garage();
  for(let i=0;i<300;i++)step(g,false);
  assert.equal(g.rover.battery,12);assert.equal(g.state.chargerActive,false);assert.equal(g.state.chargerWatts,0);
  assert.equal(g.rover.garageCharging,false);assert.equal(g.state.chargingSource,'none');
  assert.ok(g.state.batteryWh>4200,'unallocated sunlight still enters the existing base battery');
  assert.ok(g.state.lightsOn);assert.ok(requestGarageCycle(g.state,g.rover));
  for(let i=0;i<6000&&g.state.phase!=='outside';i++)step(g,false);
  assert.equal(g.state.phase,'outside');assert.equal(g.state.doorAmount,0);
  assert.ok(Math.abs(g.rover.z-(GARAGE_SITE.z+GARAGE_SITE.stagingZ))<1e-6);
  assert.equal(g.rover.battery,12,'door animation must not grant charge');
});

test('omitted garage charge policy preserves the exact free-exploration default',()=>{
  const implicit=garage(),explicit=garage();
  for(let i=0;i<300;i++){step(implicit);step(explicit,true);}
  assert.deepEqual(implicit,explicit);assert.ok(implicit.rover.battery>12);
  assert.equal(implicit.state.chargerActive,true);assert.equal(implicit.state.chargingSource,'base-solar');
  const charged=implicit.rover.battery;step(implicit,false);
  assert.equal(implicit.rover.battery,charged);assert.equal(implicit.state.chargerActive,false);
});

test('station interaction uses actual proximity and selects the nearest overlapping terminal',()=>{
  for(const site of ELYSIUM_SITES){
    assert.equal(nearestElysiumSite(site.x,site.z)?.id,site.id);
    for(const offset of [-1000,1000])assert.equal(nearestElysiumSite(site.x+offset,site.z+offset),null);
  }
  const solar=ELYSIUM_SITES.find(site=>site.id==='solar');
  assert.equal(nearestElysiumSite(solar.x+solar.range,solar.z)?.id,'solar');
  assert.notEqual(nearestElysiumSite(solar.x+solar.range+.001,solar.z)?.id,'solar');
  assert.equal(nearestElysiumSite(0,-63.6)?.id,'airlock');
  assert.equal(nearestElysiumSite(0,-64)?.id,'command');
  assert.equal(nearestElysiumSite(NaN,0),null);assert.equal(nearestElysiumSite(0,Infinity),null);
});

test('all story sites and every route waypoint remain inside the existing physical playable region',()=>{
  assert.deepEqual(ELYSIUM_SITES.map(site=>site.id).sort(),[...SITE_IDS].sort());
  assert.equal(new Set(ELYSIUM_SITES.map(site=>site.number)).size,ELYSIUM_SITES.length);
  const inside=point=>point.x>PLAYABLE_BOUNDS.west&&point.x<PLAYABLE_BOUNDS.east&&point.z>PLAYABLE_BOUNDS.north&&point.z<PLAYABLE_BOUNDS.south;
  for(const site of ELYSIUM_SITES){assert.ok(inside(site),site.id);assert.ok(site.range>0&&site.range<=10);}
  const target=ELYSIUM_SITES.find(site=>site.id==='field-sensor'),lengths=[];
  for(const [id,route] of Object.entries(ELYSIUM_ROUTES)){
    assert.ok(route.length>=3);for(const point of route)assert.ok(inside(point),id);
    assert.deepEqual(route.at(-1),{x:target.x,z:target.z});
    lengths.push(route.reduce((sum,point,i)=>sum+(i?Math.hypot(point.x-route[i-1].x,point.z-route[i-1].z):0),0));
  }
  assert.ok(lengths[0]<lengths[1]&&lengths[1]<lengths[2]);
});

test('story space weather starts without NOAA requests or polling; free-exploration default still polls',async t=>{
  let requests=0,timers=0,cleared=0;
  t.mock.method(globalThis,'fetch',async()=>{requests++;return {ok:true,json:async()=>[]};});
  const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,value:{setInterval(){timers++;return 7;},clearInterval(){cleared++;}}});
  let story,free;
  try{
    story=new SpaceWeatherService(false);story.update(500);story.setMode('historical');story.nextHistoricalEvent();story.update(100);
    await Promise.resolve();assert.equal(requests,0);assert.equal(timers,0);
    story.dispose();assert.equal(cleared,0);
    free=new SpaceWeatherService();await Promise.resolve();
    assert.equal(requests,1);assert.equal(timers,1);free.dispose();assert.equal(cleared,1);
  }finally{
    story?.dispose();free?.dispose();
    if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else delete globalThis.window;
  }
});
