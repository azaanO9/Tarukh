import test from 'node:test';
import assert from 'node:assert/strict';
import {nextElysiumGuidance} from '../game/elysiumGuidance.ts';
import {createElysiumState,reduceElysium,actionAllowed,availableMissions,trainingAvailable,activityAvailable} from '../game/elysiumMission.ts';
import {ELYSIUM_SITES} from '../game/elysiumSites.ts';
import {solvedTraining} from './trainingFixtures.mjs';
import content from '../content/elysiumMissions.json' with {type:'json'};

const apply=(state,action)=>{assert.ok(actionAllowed(state,action),JSON.stringify(action));return reduceElysium(state,action);};
const visit=(state,siteId)=>apply(state,{type:'visit',siteId});
function at(siteId,extras={}){const site=ELYSIUM_SITES.find(site=>site.id===siteId);return {currentSiteId:siteId,x:site.x,z:site.z,...extras};}
function gridReady(){
  let s=apply(createElysiumState(),{type:'begin'});
  for(const site of ['airlock','command','garage','greenhouse1'])s=visit(s,site);
  s=apply(s,{type:'log',missionId:'m1',choiceId:0});
  // A real version-1 save made before the solar-clean objective was introduced.
  s.visited.push('solar');s.tasks.push('solar-trace','solar-connect');s.choices.grid='balanced';s.completed.push('m2');
  s.logs.push({missionId:'m2',choiceId:0,text:content.missions.find(m=>m.id==='m2').logOptions[0],sol:s.sol});
  return s;
}
function night(stage='fault',fault='pump'){
  const s=gridReady();s.completed.push('m3','m4','m5','m6');s.tasks.push('plan-submit','review-ack');s.choices.contingency='reserve';
  s.test={stage,fault,attempts:1,pumpRestarted:false,checkpoint:{...s.resources}};return s;
}

test('briefing, first visits and optional cargo give one clear physical step without changing progress',()=>{
  const initial=createElysiumState(),before=JSON.stringify(initial);
  assert.deepEqual(nextElysiumGuidance(initial).intent,{type:'panel',panel:'prologue'});assert.equal(JSON.stringify(initial),before);
  let s=apply(initial,{type:'begin'}),g=nextElysiumGuidance(s,{selectedMission:'m7',x:10,z:10});
  assert.equal(g.missionId,'m1');assert.equal(g.targetSiteId,'airlock');assert.equal(g.stepIndex,1);assert.equal(g.stepCount,4);
  assert.match(g.travelHint,/airlock/);assert.equal(g.atTarget,false);
  s=visit(s,'airlock');g=nextElysiumGuidance(s,at('airlock'));assert.equal(g.targetSiteId,'command');
  s=visit(s,'command');g=nextElysiumGuidance(s,at('command'));assert.equal(g.intent.activityId,'cargo-read');assert.equal(g.optional,true);
  assert.equal(g.atTarget,true);assert.equal(g.distance,0);
  assert.equal(nextElysiumGuidance(s,at('airlock')).targetSiteId,'garage','optional unpacking never traps a player who walks away');
  s=visit(visit(s,'garage'),'greenhouse1');g=nextElysiumGuidance(s,at('greenhouse1'));
  assert.deepEqual(g.intent,{type:'log',missionId:'m1'});assert.equal(g.target,null);assert.equal(g.targetSiteId,null);
  assert.match(g.travelHint,/here/);
  s=apply(s,{type:'log',missionId:'m1',choiceId:1});g=nextElysiumGuidance(s,{selectedMission:'m1'});
  assert.equal(g.missionId,'m2');assert.equal(g.targetSiteId,'solar');assert.equal(g.intent.type,'visit');
});

test('solar guidance advances trace → repair → clean → power sharing → log',()=>{
  let s=gridReady();s.completed=s.completed.filter(id=>id!=='m2');s.logs=s.logs.filter(log=>log.missionId!=='m2');s.tasks=[];s.choices.grid=null;
  const guide=()=>nextElysiumGuidance(s,at('solar',{selectedMission:'m2'}));
  assert.equal(guide().intent.activityId,'solar-trace');s=apply(s,solvedTraining('solar-trace'));
  assert.equal(guide().intent.taskId,'solar-connect');s.tasks.push('solar-connect');
  assert.equal(guide().intent.taskId,'solar-clean');s.tasks.push('solar-clean');
  assert.equal(guide().intent.activityId,'grid-plan');assert.equal(guide().targetSiteId,'command');
  s=apply(s,solvedTraining('grid-plan','balanced'));assert.equal(guide().kind,'log');
});

test('parallel missions honor an unfinished selection and completed or locked selections hand off safely',()=>{
  let s=gridReady();
  assert.deepEqual(availableMissions(s),['m3','m4','m5']);
  assert.equal(nextElysiumGuidance(s,{selectedMission:'m2'}).missionId,'m3','legacy completed M2 is never reopened for new cleaning');
  assert.equal(nextElysiumGuidance(s,{selectedMission:'m7'}).missionId,'m3');
  assert.equal(nextElysiumGuidance(s,{selectedMission:'m4'}).intent.activityId,'plant-plan');
  s=apply(s,solvedTraining('plant-plan','comfortable'));assert.equal(nextElysiumGuidance(s,{selectedMission:'m4'}).intent.activityId,'forecast-review');
  s=apply(s,solvedTraining('forecast-review'));assert.equal(nextElysiumGuidance(s,{selectedMission:'m4'}).intent.type,'log');
  s=apply(s,{type:'log',missionId:'m4',choiceId:0});assert.equal(nextElysiumGuidance(s,{selectedMission:'m4'}).missionId,'m3');
  assert.equal(nextElysiumGuidance(s,{selectedMission:'m5'}).missionId,'m5','a child can still choose the rover mission first');
  s=visit(s,'lab');assert.equal(nextElysiumGuidance(s,at('lab',{selectedMission:'m3'})).intent.activityId,'water-compare');
  s=apply(s,solvedTraining('water-compare'));assert.equal(nextElysiumGuidance(s,at('lab',{selectedMission:'m3'})).intent.activityId,'water-calibrate');
  s=apply(s,solvedTraining('water-calibrate'));assert.equal(nextElysiumGuidance(s,at('lab',{selectedMission:'m3'})).intent.activityId,'water-plan');
  s=apply(s,solvedTraining('water-plan','standard'));assert.equal(nextElysiumGuidance(s,{selectedMission:'m3'}).intent.activityId,'oxygen-plan');
  s=apply(s,solvedTraining('oxygen-plan','standard'));assert.equal(nextElysiumGuidance(s,{selectedMission:'m3'}).intent.activityId,'air-plan');
});

test('rover guidance resolves power prerequisites, parking, deployment and actual rover location',()=>{
  let s=gridReady(),ctx={selectedMission:'m5'};
  assert.equal(nextElysiumGuidance(s,ctx).intent.action,'advance-sol');
  s.choices.grid='reserve';assert.equal(nextElysiumGuidance(s,ctx).intent.activityId,'grid-plan');
  s.choices.grid='greenhouse';assert.match(nextElysiumGuidance(s,ctx).detail,/next sol/);
  s.roverDocked=false;assert.equal(nextElysiumGuidance(s,ctx).intent.action,'park-rover');
  s.roverDocked=true;s.resources.roverCharge=35;
  assert.equal(nextElysiumGuidance(s,ctx).intent.activityId,'route-plan');
  s=apply(s,solvedTraining('route-plan','direct'));
  assert.equal(nextElysiumGuidance(s,ctx).intent.action,'deploy-rover');
  s.roverDocked=false;ctx={...ctx,roverDriving:false,garagePhase:'outside',roverX:125,roverZ:80,x:120,z:80};
  let g=nextElysiumGuidance(s,ctx);assert.equal(g.id,'board-rover');assert.equal(g.targetSiteId,null);assert.equal(g.target.x,125);assert.equal(g.distance,5);
  assert.equal(g.atTarget,false);assert.equal(nextElysiumGuidance(s,{...ctx,x:124}).atTarget,true);
  g=nextElysiumGuidance(s,{...ctx,roverDriving:true});assert.equal(g.id,'drive-to-sensor');assert.equal(g.targetSiteId,'field-sensor');
  s.resources.roverCharge=0;g=nextElysiumGuidance(s,ctx);assert.equal(g.intent.action,'recover-rover');assert.equal(g.targetSiteId,'garage');
});

test('field arrival and samples guide the actual mission work before returning to the lab',()=>{
  let s=gridReady();s.choices.route='direct';s.resources.roverCharge=55;s.roverDocked=false;
  const ctx={selectedMission:'m5'};
  s=apply(s,{type:'visit',siteId:'field-sensor',roverDriving:true});
  assert.equal(nextElysiumGuidance(s,ctx).intent.activityId,'sensor-restore');
  s=apply(s,solvedTraining('sensor-restore'));assert.equal(nextElysiumGuidance(s,ctx).intent.activityId,'sample-collect');
  s=apply(s,solvedTraining('sample-collect'));const g=nextElysiumGuidance(s,ctx);
  assert.equal(g.targetSiteId,'lab');assert.equal(g.intent.type,'visit');assert.match(g.travelHint,/airlock/);
  const driving=nextElysiumGuidance(s,{...ctx,roverDriving:true});assert.match(driving.travelHint,/Stop the rover outside/);assert.match(driving.travelHint,/Exit rover/);
  s=visit(s,'lab');assert.equal(nextElysiumGuidance(s,ctx).intent.activityId,'sample-analyse');
});

test('each night fault gives its real station and pump diagnosis requires a fresh visit',()=>{
  for(const [fault,id,site]of [['heater','fault-heater','command'],['scrubber','fault-scrubber','command']]){
    const g=nextElysiumGuidance(night('fault',fault),{selectedMission:'m3'});assert.equal(g.missionId,'m7');assert.equal(g.intent.activityId,id);assert.equal(g.targetSiteId,site);
  }
  let s=night();s.visited.push('lab');
  let g=nextElysiumGuidance(s,at('lab'));assert.equal(g.intent.type,'visit','a past lab visit cannot skip the new pump check');
  s=visit(s,'lab');g=nextElysiumGuidance(s,at('lab'));assert.equal(g.intent.activityId,'fault-pump');
  s=apply(s,solvedTraining('fault-pump'));g=nextElysiumGuidance(s,at('lab'));
  assert.equal(g.intent.activityId,'fault-water');assert.equal(g.targetSiteId,'command');
  s=apply(s,solvedTraining('fault-water'));assert.equal(nextElysiumGuidance(s).intent.action,'advance-test');
  assert.equal(nextElysiumGuidance(night('safe')).intent.action,'retry-test');
});

test('guidance drives all seven missions through real reducer guards and ends without a stale waypoint',()=>{
  let s=createElysiumState(3),ctx={},count=0;const visitedMissions=new Set(),seen=[];
  const choices={'grid-plan':'balanced','water-plan':'standard','oxygen-plan':'standard','air-plan':'scheduled','plant-plan':'comfortable','route-plan':'direct','shield-plan':'structure','backup-plan':'reserve','fault-heater':'cut-crops','fault-scrubber':'regenerate'};
  while(count++<100){
    const before=JSON.stringify(s),g=nextElysiumGuidance(s,ctx);assert.equal(JSON.stringify(s),before);seen.push(g.id);
    if(g.missionId)visitedMissions.add(g.missionId);
    if(g.targetSiteId)ctx={...ctx,...at(g.targetSiteId)};
    ctx.selectedMission=g.missionId??undefined;
    if(g.intent.type==='visit')s=visit(s,g.intent.siteId);
    else if(g.intent.type==='training'){assert.ok(trainingAvailable(s,g.intent.activityId),g.id);s=apply(s,solvedTraining(g.intent.activityId,choices[g.intent.activityId]));}
    else if(g.intent.type==='solar'){
      assert.ok(activityAvailable(s,g.intent.taskId));
      const proof=g.intent.taskId==='solar-connect'?{kind:'wire-repair',isolated:true,connections:['A','B','C','D'].map(id=>({from:id,to:id}))}:{kind:'panel-cleaning',strokes:Array.from({length:11},(_,i)=>[{x:0,y:i/10},{x:1,y:i/10}])};
      s=apply(s,{type:'complete-activity',taskId:g.intent.taskId,proof});
    }else if(g.intent.type==='log')s=apply(s,{type:'log',missionId:g.intent.missionId,choiceId:0});
    else if(g.intent.type==='action')s=apply(s,{type:g.intent.action});
    else if(g.intent.type==='panel')s=apply(s,g.intent.panel==='prologue'?{type:'begin'}:{type:'final-log',choiceId:0});
    else if(g.intent.action==='deploy-rover'){
      s=apply(s,{type:'sync-world',roverCharge:s.resources.roverCharge,garagePhase:'outside'});ctx={...ctx,garagePhase:'outside',roverDriving:false,roverX:26,roverZ:-13};
    }else if(g.intent.action==='drive'){
      if(g.id==='board-rover')ctx.roverDriving=true;
      else {ctx={...ctx,...at('field-sensor'),roverDriving:true};s=apply(s,{type:'visit',siteId:'field-sensor',roverDriving:true});}
    }else if(g.intent.action==='explore'){assert.equal(g.targetSiteId,null);assert.equal(g.target,null);break;}
    else throw new Error(`Unexpected guide ${JSON.stringify(g)}`);
  }
  assert.ok(count<100,seen.join(' → '));assert.equal(s.completed.length,7);assert.ok(s.finalLog);
  assert.deepEqual([...visitedMissions],['m1','m2','m3','m4','m5','m6','m7']);
  for(const id of ['archive-review','ventilation-check','shelter-power','shield-plan','plan-submit','backup-plan','review-ack','start-test'])assert.ok(seen.includes(id),id);
});

test('guidance handles invalid coordinates and stays immutable for completed saves and another night rehearsal',()=>{
  const s=night('passed');s.completed.push('m7');s.phase='ready';
  let g=nextElysiumGuidance(s,{x:NaN,z:Infinity});assert.equal(g.kind,'ending');assert.equal(g.target,null);
  s.finalLog=content.finalLogOptions[0];g=nextElysiumGuidance(s,{selectedMission:'m2'});assert.equal(g.kind,'explore');assert.equal(g.missionId,null);
  s.test.stage='fault';s.test.fault='heater';assert.equal(nextElysiumGuidance(s).intent.activityId,'fault-heater');
  const active=gridReady();g=nextElysiumGuidance(active,{x:NaN,z:Infinity});assert.equal(g.distance,null);assert.equal(g.atTarget,false);
});
