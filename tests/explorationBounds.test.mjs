import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPLORATION_BOUNDS as B,PLAYABLE_BOUNDS as P,BOUNDARY_RIDGE_WIDTH,createExplorationBoundaryObstacles,boundaryMountainHeight,isExplorationTile} from '../game/explorationBounds.ts';
import {MARS_LANDMARKS} from '../content/marsLandmarks.ts';
import {marsOutpostHeight,marsExpeditionHeight} from '../game/marsExpeditionTerrain.ts';
import {moveAndSlide,overlapBody} from '../game/collision.ts';
import {roverFootprint} from '../game/roverVehicle.ts';
import {stepMarsLocomotion} from '../game/marsLocomotion.ts';

test('the finite region keeps all real landmark coordinates inside an unchanged surveyed interior',()=>{
  assert.ok(B.east-B.west>1800&&B.east-B.west<2000);
  assert.ok(B.south-B.north>1400&&B.south-B.north<1500);
  for(const landmark of MARS_LANDMARKS){
    assert.ok(landmark.x>P.west&&landmark.x<P.east&&landmark.z>P.north&&landmark.z<P.south,landmark.id);
    assert.equal(boundaryMountainHeight(landmark.x,landmark.z),0,landmark.id+' source relief remains unchanged');
  }
  for(const [x,z] of [[400,400],[-500,0],[300,-400]])assert.equal(marsOutpostHeight(x,z),marsExpeditionHeight(x,z));
  assert.equal(isExplorationTile(10000,10000,70),false);
  assert.equal(isExplorationTile(Math.floor(B.west/70),0,70),true);
});

test('authored perimeter mountains rise continuously beyond the foot and are separate from source relief',()=>{
  assert.equal(boundaryMountainHeight(0,0),0);
  for(const direction of [-1,1])for(const axis of ['x','z']) {
    const outer=axis==='x'?(direction<0?B.west:B.east):(direction<0?B.north:B.south);
    const start=outer-direction*BOUNDARY_RIDGE_WIDTH;
    const at=(value)=>axis==='x'?boundaryMountainHeight(value,0):boundaryMountainHeight(0,value);
    assert.equal(at(start),0);assert.ok(at(outer)>40);
    assert.ok(Math.abs(at(start-.001)-at(start+.001))<.001);
    for(let offset=0;offset<90;offset+=.5)assert.ok(Math.abs(at(outer-direction*offset)-at(outer-direction*(offset+.001)))<.1);
  }
});

test('all four mountain barriers block walking, airborne movement and a high-speed rover',()=>{
  const obstacles=createExplorationBoundaryObstacles();
  assert.equal(obstacles.length,4);assert.ok(obstacles.every(o=>o.topY===undefined));
  const cases=[{x:P.west+10,z:0,dx:-40,dz:0},{x:P.east-10,z:0,dx:40,dz:0},{x:0,z:P.north+10,dx:0,dz:-40},{x:0,z:P.south-10,dx:0,dz:40}];
  for(const c of cases) {
    for(const body of [{x:0,z:0,radius:.32},roverFootprint(0,0,.67)]) {
      const result=moveAndSlide(c.x,c.z,c.dx,c.dz,[body],obstacles,Infinity);
      assert.ok(result.x>P.west&&result.x<P.east&&result.z>P.north&&result.z<P.south);
      for(const obstacle of obstacles)assert.equal(overlapBody(result.x,result.z,body,obstacle),null);
    }
    let walker={x:c.x,z:c.z,vx:c.dx*10,vz:c.dz*10,yaw:0},jump={height:200,velocity:0};
    for(let i=0;i<10;i++)({walker,jump}=stepMarsLocomotion(walker,jump,new Set(),.05,()=>0,obstacles,undefined,Infinity));
    assert.ok(walker.x>P.west&&walker.x<P.east&&walker.z>P.north&&walker.z<P.south,'jumping never bypasses the boundary');
  }
  const corner=moveAndSlide(P.east-5,P.south-5,30,30,[{x:0,z:0,radius:.32}],obstacles,Infinity);
  assert.ok(corner.x<P.east&&corner.z<P.south,'adjacent barriers have no corner gap');
});
