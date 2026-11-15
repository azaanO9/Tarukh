import test from 'node:test';
import assert from 'node:assert/strict';
import {boxObstacle,moveAndSlide,overlapDisc,overlapBody,nearbyObstacles} from '../game/collision.ts';
import {stepWalker,WALKER_RADIUS} from '../game/navigation.ts';
import {spawnRoverVehicle,enterRover,stepRoverVehicle,exitRover,roverFootprint} from '../game/roverVehicle.ts';

test('continuous sweeps stop a fast walker at a thin wall instead of tunnelling',()=>{
 const wall=boxObstacle(0,0,4,.04);
 const next=stepWalker({x:0,z:2,vx:0,vz:-100,yaw:0},new Set(['w']),.05,[wall],100);
 assert.ok(next.z>=.04+WALKER_RADIUS-1e-5);
 assert.equal(next.vz,0);
});

test('reused broadphase buffers keep nearby contacts and long boundary walls',()=>{
 const near=boxObstacle(3,1,1,1),far=boxObstacle(90,90,1,1),wall=boxObstacle(100,0,100,1);
 const result=[far];assert.equal(nearbyObstacles([near,far,wall],0,0,4,result),result);
 assert.deepEqual(result,[near,wall]);
 nearbyObstacles([near,far],90,90,4,result);assert.deepEqual(result,[far]);
});

test('diagonal wall contact preserves tangential movement without jitter or stored inward velocity',()=>{
 const wall=boxObstacle(0,0,20,.2);
 let w={x:0,z:2,vx:0,vz:0,yaw:0};
 for(let i=0;i<180;i++)w=stepWalker(w,new Set(['w','d']),1/60,[wall]);
 assert.ok(w.x>9);assert.ok(w.z>=.52-1e-5&&w.z<.53);assert.ok(Math.abs(w.vz)<1e-6);
 const released=stepWalker(w,new Set(),1/60,[wall]);assert.ok(Math.abs(released.z-w.z)<1e-6);
});

test('inside corners satisfy both walls, and exact-centre overlaps recover finitely',()=>{
 const obstacles=[boxObstacle(0,-1,5,.1),boxObstacle(1,0,.1,5)];
 let w={x:0,z:0,vx:0,vz:0,yaw:0};
 for(let i=0;i<150;i++)w=stepWalker(w,new Set(['w','d']),1/30,obstacles);
 for(const o of obstacles)assert.equal(overlapDisc(w.x,w.z,WALKER_RADIUS,o),null);
 const circle={x:0,z:0,radius:1};
 const recovered=moveAndSlide(0,0,0,0,[{x:0,z:0,radius:.32}],[circle],88);
 assert.ok(Number.isFinite(recovered.x)&&Math.hypot(recovered.x,recovered.z)>=1.32);
});

test('rounded box corners do not create square invisible exclusion zones',()=>{
 const wall=boxObstacle(0,0,1,1);
 const moved=moveAndSlide(1.29,1.8,0,-.51,[{x:0,z:0,radius:.32}],[wall],88);
 assert.ok(Math.abs(moved.z-1.29)<1e-8);
});

test('precise walking hulls leave visible space clear without changing legacy rock contacts',()=>{
 const hull=[{x:-2,z:-.2},{x:2,z:-.2},{x:2,z:.2},{x:-2,z:.2}];
 const obstacle={x:0,z:0,radius:Math.hypot(2,.2),hull,hullForWalking:true};
 assert.equal(overlapDisc(0,1,WALKER_RADIUS,obstacle),null);
 assert.ok(overlapDisc(0,1,WALKER_RADIUS,{...obstacle,hullForWalking:false}));
 const free=moveAndSlide(-3,1,6,0,[{x:0,z:0,radius:WALKER_RADIUS}],[obstacle],Infinity);
 assert.equal(free.x,3);assert.equal(free.z,1);
 const hit=moveAndSlide(0,5,0,-10,[{x:0,z:0,radius:WALKER_RADIUS}],[obstacle],Infinity);
 assert.ok(hit.z>=.2+WALKER_RADIUS&&hit.z<.521,'Fast motion cannot tunnel through a crop bed');
 for(const [x,z] of [[0,0],[2,0],[2,.2]]) {
  const recovered=moveAndSlide(x,z,0,0,[{x:0,z:0,radius:WALKER_RADIUS}],[obstacle],Infinity);
  assert.ok(Number.isFinite(recovered.x)&&Number.isFinite(recovered.z));
  assert.equal(overlapDisc(recovered.x,recovered.z,WALKER_RADIUS,obstacle),null);
 }
});

test('walking hull corners stay rounded and angled faces permit sliding',()=>{
 const obstacle={x:0,z:0,radius:Math.sqrt(2),hullForWalking:true,hull:[{x:-1,z:-1},{x:1,z:-1},{x:1,z:1},{x:-1,z:1}]};
 const corner=moveAndSlide(1.29,1.8,0,-.51,[{x:0,z:0,radius:WALKER_RADIUS}],[obstacle],Infinity);
 assert.ok(Math.abs(corner.z-1.29)<1e-8);
 const yaw=.73,c=Math.cos(yaw),s=Math.sin(yaw);
 obstacle.hull=obstacle.hull.map(p=>({x:p.x*c+p.z*s,z:-p.x*s+p.z*c}));
 const slide=moveAndSlide(-.5*c+2*s,.5*s+2*c,2*c-2*s,-2*s-2*c,[{x:0,z:0,radius:WALKER_RADIUS}],[obstacle],Infinity);
 assert.ok(slide.normals.length>0);assert.equal(overlapDisc(slide.x,slide.z,WALKER_RADIUS,obstacle),null);
 assert.ok(slide.x*c-slide.z*s>1,'Contact preserves tangential motion along the rotated face');
});

test('rover front stops at hardware, wheels stop rolling, and reverse releases contact',()=>{
 const wall=boxObstacle(0,0,10,.1);
 let r={...enterRover(spawnRoverVehicle(0,6)),speed:13.5};
 for(let i=0;i<100;i++)r=stepRoverVehicle(r,new Set(['w']),.05,[wall]);
 assert.ok(r.z>=2.575-1e-4);assert.ok(r.speed<.001);
 const roll=r.wheelRoll;
 for(let i=0;i<20;i++)r=stepRoverVehicle(r,new Set(['w']),.05,[wall]);
 assert.ok(Math.abs(r.wheelRoll-roll)<.001);
 const before=r.z;
 for(let i=0;i<60;i++)r=stepRoverVehicle(r,new Set(['s']),.05,[wall]);
 assert.ok(r.z>before+1);
});

test('swept oriented rover body protects its corners and sides against boxes and rocks',()=>{
 for(const yaw of [0,.37,Math.PI/2,-.8])for(const wall of [boxObstacle(0,0,6,.06),{x:0,z:0,radius:.3}]){
  const shape=roverFootprint(0,0,yaw);
  const moved=moveAndSlide(0,8,0,-16,[shape],[wall],85);
  assert.ok(moved.normals.length>0,'the swept path registered contact');
  if(wall.halfX)assert.ok(moved.z>0,'cannot pass the wall');
  assert.equal(overlapBody(moved.x,moved.z,shape,wall),null);
 }
});

test('rover exit chooses an unblocked side and stays seated if surrounded',()=>{
 const r=enterRover(spawnRoverVehicle(0,0));
 const left=boxObstacle(-2.4,0,.5,3);
 const rightExit=exitRover(r,[left]);assert.ok(rightExit.exitPosition.x>0);
 const trapped=exitRover(r,[boxObstacle(0,0,5,5)]);
 assert.equal(trapped.exitPosition,null);assert.equal(trapped.rover.driving,true);
});

test('collision endpoints remain stable across simulation frame rates',()=>{
 const wall=boxObstacle(0,0,8,.1);
 const run=dt=>{let r={...enterRover(spawnRoverVehicle(0,10)),speed:13};for(let i=0;i<Math.round(4/dt);i++)r=stepRoverVehicle(r,new Set(['w']),dt,[wall]);return r;};
 assert.ok(Math.abs(run(1/30).z-run(1/120).z)<.005);
});
