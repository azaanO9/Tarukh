import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GREENHOUSE_PAD,GREENHOUSE_SCALE,GREENHOUSE_SITES,greenhouseClearing} from '../game/greenhouseSites.ts';
import {marsExpeditionHeight,marsOutpostHeight,GREENHOUSE_GROUND_HEIGHTS,OUTPOST_GROUND_HEIGHT} from '../game/marsExpeditionTerrain.ts';
import {createGreenhouseStates,greenhousePoint} from '../game/greenhouses.ts';
import {nearestOutpostDoor,stepOutpostDoor,toggleOutpostDoor} from '../game/outpost.ts';
import {moveAndSlide,overlapDisc} from '../game/collision.ts';
import {WALKER_RADIUS} from '../game/navigation.ts';

const layout=JSON.parse(fs.readFileSync(new URL('../public/models/greenhouse/layout.json',import.meta.url),'utf8'));
const states=()=>createGreenhouseStates(layout,GREENHOUSE_GROUND_HEIGHTS);
const close=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-5,message??`${a} != ${b}`);

test('six distinct food-production sites have genuinely planar game-ground foundations',()=>{
  assert.equal(GREENHOUSE_SITES.length,6);
  assert.equal(new Set(GREENHOUSE_SITES.map(s=>s.id)).size,6);
  for(const [i,site] of GREENHOUSE_SITES.entries()) {
    close(GREENHOUSE_GROUND_HEIGHTS[i],OUTPOST_GROUND_HEIGHT,'Cultivation pads should align with the campus, not sit on separate steep terraces');
    for(let x=-GREENHOUSE_PAD.halfSize;x<=GREENHOUSE_PAD.halfSize;x+=.5)for(let z=-GREENHOUSE_PAD.halfSize;z<=GREENHOUSE_PAD.halfSize;z+=.5)close(marsOutpostHeight(site.x+x,site.z+z),GREENHOUSE_GROUND_HEIGHTS[i],site.id+' pad must stay flat');
    for(const other of GREENHOUSE_SITES)if(other!==site)assert.ok(Math.hypot(site.x-other.x,site.z-other.z)>24);
  }
  for(const [x,z] of [[0,21],[17,10],[-24,24],[200,170],[-400,80]])close(marsOutpostHeight(x,z),marsExpeditionHeight(x,z));
});

test('greenhouse grading is continuous at the pads and their transitions into native soil',()=>{
  for(const site of GREENHOUSE_SITES)for(const dx of [-1,0,1])for(const dz of [-1,0,1]) {
    if(!dx&&!dz)continue;
    for(const r of [GREENHOUSE_PAD.halfSize,GREENHOUSE_PAD.halfSize+GREENHOUSE_PAD.blend]) {
      const a=marsOutpostHeight(site.x+dx*(r-.0001),site.z+dz*(r-.0001));
      const b=marsOutpostHeight(site.x+dx*(r+.0001),site.z+dz*(r+.0001));
      assert.ok(Math.abs(a-b)<.001,site.id+' terrain must have no step');
    }
  }
});

test('retained ceramic decks and both ramps sit on the native pads at human scale',()=>{
  for(const [index,state] of states().entries()) {
    close(state.baseY-GREENHOUSE_GROUND_HEIGHTS[index],GREENHOUSE_PAD.foundationOffset);
    close(state.floorAt(state.site.x,state.site.z,GREENHOUSE_GROUND_HEIGHTS[index]),state.baseY+layout.deckHeight*GREENHOUSE_SCALE);
    for(const door of layout.doors) {
      let previous=state.baseY+layout.deckHeight*GREENHOUSE_SCALE;
      for(let t=0;t<=layout.ramp.length;t+=.025) {
        const p=greenhousePoint(state.site,door.x+door.nx*(layout.ramp.start+t),door.z+door.nz*(layout.ramp.start+t));
        assert.ok(greenhouseClearing(p.x,p.z),'The entire ramp must be free of game rocks');
        const y=state.floorAt(p.x,p.z,GREENHOUSE_GROUND_HEIGHTS[index]);
        assert.ok(y<=previous+.005&&previous-y<.012,'Ramp must descend smoothly into game soil');previous=y;
      }
    }
  }
});

test('the astronaut can enter and leave the circular growing-bed area at all six rotations',()=>{
  for(const state of states())for(const sign of [-1,1]) {
    const outside=greenhousePoint(state.site,0,3.4),inside=greenhousePoint(state.site,0,.9);
    const start=sign===1?outside:inside,end=sign===1?inside:outside;
    const result=moveAndSlide(start.x,start.z,end.x-start.x,end.z-start.z,[{x:0,z:0,radius:WALKER_RADIUS}],state.obstacles,Infinity);
    assert.ok(Math.hypot(result.x-end.x,result.z-end.z)<.01,state.site.id+' circular aisle is clear in both directions');
    assert.equal(state.inside(inside.x,inside.z),true);
  }
});

test('wider floor coverage includes the new perimeter while beds and the central computer stay solid',()=>{
  for(const state of states()) {
    const edge=greenhousePoint(state.site,0,4.1);
    assert.equal(state.inside(edge.x,edge.z),true);
    close(state.floorAt(edge.x,edge.z,state.baseY-GREENHOUSE_PAD.foundationOffset),state.baseY+layout.deckHeight*GREENHOUSE_SCALE);
    const computer=state.obstacles.find(o=>o.id.endsWith('equipment-control'));
    assert.ok(overlapDisc(state.site.x,state.site.z,WALKER_RADIUS,computer));
    for(const [i,furniture] of layout.furniture.entries()) {
      const obstacle=state.obstacles.find(o=>o.id.endsWith(`equipment-${i}`));
      const point=greenhousePoint(state.site,furniture.hull.reduce((sum,p)=>sum+p[0],0)/furniture.hull.length,furniture.hull.reduce((sum,p)=>sum+p[1],0)/furniture.hull.length);
      assert.ok(overlapDisc(point.x,point.z,WALKER_RADIUS,obstacle),furniture.name+' remains solid');
    }
  }
});

test('all twelve greenhouse doors block closed, and open apertures work in both directions',()=>{
  for(const state of states())for(const door of state.doors)for(const sign of [-1,1]) {
    const x=door.x-door.nx*sign*.8,z=door.z-door.nz*sign*.8,dx=door.nx*sign*1.6,dz=door.nz*sign*1.6;
    door.collider.disabled=false;
    const closed=moveAndSlide(x,z,dx,dz,[{x:0,z:0,radius:.32}],state.obstacles,Infinity);
    assert.ok(Math.hypot(closed.x-x-dx,closed.z-z-dz)>.4,door.id+' closed');
    door.collider.disabled=true;
    const open=moveAndSlide(x,z,dx,dz,[{x:0,z:0,radius:.32}],state.obstacles,Infinity);
    assert.ok(Math.hypot(open.x-x-dx,open.z-z-dz)<.03,door.id+' clear '+JSON.stringify({x,z,dx,dz,open}));
  }
});

test('greenhouse E interaction is directional and preserves the doorway occupancy safeguard',()=>{
  const farm=states(),doors=farm.flatMap(s=>s.doors);
  assert.equal(doors.length,12);
  for(const door of doors) {
    const x=door.x+door.nx*2,z=door.z+door.nz*2,yaw=Math.atan2(door.nx,door.nz);
    assert.equal(nearestOutpostDoor(doors,x,door.y,z,yaw),door);
    toggleOutpostDoor(door,x,door.y,z);
    for(let i=0;i<40;i++)stepOutpostDoor(door,.05,x,door.y,z);
    assert.equal(door.amount,1);assert.equal(door.collider.disabled,true);
    assert.equal(toggleOutpostDoor(door,door.x,door.y,door.z),false);
    assert.equal(door.blocked,true);
  }
});

test('walls and growing beds remain solid while the service lanes stay unobstructed',()=>{
  const farm=states(),all=farm.flatMap(s=>s.obstacles);
  for(const state of farm) {
    const front=greenhousePoint(state.site,0,3.7),back=greenhousePoint(state.site,0,-3.7);
    const result=moveAndSlide(front.x,front.z,back.x-front.x,back.z-front.z,[{x:0,z:0,radius:.32}],state.obstacles,Infinity);
    assert.ok(Math.hypot(result.x-back.x,result.z-back.z)>1,'Do not pass through the hydroponic beds');
    const start=greenhousePoint(state.site,0,-8),end=greenhousePoint(state.site,0,-3.4);
    const blocked=moveAndSlide(start.x,start.z,end.x-start.x,end.z-start.z,[{x:0,z:0,radius:.32}],state.obstacles,Infinity);
    assert.ok(Math.hypot(blocked.x-end.x,blocked.z-end.z)>1,'Back wall blocks the player');
  }
  for(const x of [-44,44]) {
    const result=moveAndSlide(x-9,-65,18,0,[{x:0,z:0,radius:1.5}],all,Infinity);
    close(result.x,x+9);close(result.z,-65);
  }
});
