import test from 'node:test';
import assert from 'node:assert/strict';
import {TRAINING_IDS,TRAINING_ACTIVITIES,trainingDefinition,createTrainingProof,evaluateTraining,validateTrainingProof} from '../game/trainingActivities.ts';
import {createElysiumState,reduceElysium,trainingAvailable,trainingCompleted,trainingAllowedChoices,trainingForAction,actionAllowed,actionSite} from '../game/elysiumMission.ts';
import {parseElysiumSave} from '../game/elysiumSave.ts';
import {ELYSIUM_SITES,ELYSIUM_ROUTES} from '../game/elysiumSites.ts';
import content from '../content/elysiumMissions.json' with {type:'json'};
import {solvedTraining} from './trainingFixtures.mjs';

function arrival(){
  let s=reduceElysium(createElysiumState(),{type:'begin'});
  for(const siteId of ['airlock','command','garage','greenhouse1'])s=reduceElysium(s,{type:'visit',siteId});
  return reduceElysium(s,{type:'log',missionId:'m1',choiceId:0});
}
function legacyGrid(){
  const s=arrival();s.visited.push('solar','lab','field-sensor','shelter');s.tasks.push('solar-trace','solar-connect');s.choices.grid='balanced';
  s.completed.push('m2');s.logs.push({missionId:'m2',choiceId:0,text:content.missions.find(m=>m.id==='m2').logOptions[0],sol:1});s.resources.roverCharge=60;
  return s;
}

test('all 25 workbenches start incomplete and have valid proof for every operating choice',()=>{
  assert.equal(TRAINING_IDS.length,25);
  for(const id of TRAINING_IDS){
    const d=trainingDefinition(id);assert.ok(ELYSIUM_SITES.some(site=>site.id===d.site));
    assert.equal(validateTrainingProof(id,createTrainingProof(id)),false,`${id} cannot complete untouched`);
    for(const choice of d.choices.length?d.choices.map(c=>c.id):[undefined]){
      const {proof}=solvedTraining(id,choice),result=evaluateTraining(id,proof);
      assert.ok(result.complete,`${id}/${choice}: ${result.feedback}`);assert.equal(result.progress,1);
      if(choice)assert.equal(result.choice,choice);
    }
  }
});

test('malformed, oversized, unknown and sparse evidence is rejected rather than trusted',()=>{
  const valid=solvedTraining('water-plan','standard').proof;
  for(const proof of [null,[],{},true,{...valid,choice:'unknown'},{...valid,values:{output:NaN}},{...valid,values:{output:Infinity}},
    {...valid,values:{output:1,remote:1}},{...valid,placements:{screen:'wrong',filter:'stage2',disinfect:'stage3'}},
    {...valid,placements:{screen:'stage1',filter:'stage2',disinfect:'stage3',unknown:'stage1'}},
    {...valid,steps:Array(2)},{...valid,rotations:Array(2)},{...valid,steps:Array(33).fill('read')},
    {...valid,arbitrary:true},{...valid,values:{output:1.5}},{...valid,choice:'x'.repeat(65)}])assert.equal(validateTrainingProof('water-plan',proof),false);
  assert.equal(validateTrainingProof('__proto__',valid),false);
});

test('placement, closed loops, ordered radio packets and visible reference dials require real manipulation',()=>{
  for(const id of ['cargo-read','sample-analyse','oxygen-plan']){
    const {proof}=solvedTraining(id),key=Object.keys(proof.placements)[0];
    delete proof.placements[key];assert.equal(validateTrainingProof(id,proof),false);
  }
  for(const id of ['solar-trace','water-compare','ventilation-check','fault-pump']){
    const {proof}=solvedTraining(id);proof.rotations[0]=(proof.rotations[0]+1)%4;assert.equal(validateTrainingProof(id,proof),false);
  }
  for(const id of ['review-ack','sample-collect','sensor-restore']){
    const {proof}=solvedTraining(id);proof.steps.reverse();assert.equal(validateTrainingProof(id,proof),false);
  }
  const calibration=solvedTraining('water-calibrate').proof;calibration.values.calibration=40;
  assert.equal(validateTrainingProof('water-calibrate',calibration),false);
  calibration.values.calibration=62;assert.equal(validateTrainingProof('water-calibrate',calibration),true);
});

test('power cells and chemistry boards select plans from actual manipulated state',()=>{
  const grid=solvedTraining('grid-plan','balanced').proof;grid.choice='fast';
  assert.equal(evaluateTraining('grid-plan',grid).choice,'balanced','the cells are authoritative, not a separate label');
  grid.values.rover++;assert.equal(validateTrainingProof('grid-plan',grid),false,'no free extra energy cells');
  const oxygen=solvedTraining('oxygen-plan','high').proof;oxygen.placements.h4='oxygen';
  assert.equal(validateTrainingProof('oxygen-plan',oxygen),false,'hydrogen cannot be put in the breathable oxygen tank');
  const air=solvedTraining('air-plan').proof;air.placements['o2-a']='filter';assert.equal(validateTrainingProof('air-plan',air),false);
  const backup=solvedTraining('backup-plan').proof;backup.placements['slow-charge']='backup';assert.equal(validateTrainingProof('backup-plan',backup),false);
});

test('route proof follows the real compressed planning paths, not arbitrary point selections',()=>{
  const d=TRAINING_ACTIVITIES['route-plan'];
  for(const route of d.routes){
    const actual=route.steps.map(id=>{const node=d.nodes.find(node=>node.id===id);return{x:node.x*485-145,z:node.y*520-160};});
    actual.forEach((p,i)=>{assert.ok(Math.abs(p.x-ELYSIUM_ROUTES[route.id][i].x)<1e-8);assert.ok(Math.abs(p.z-ELYSIUM_ROUTES[route.id][i].z)<1e-8);});
    const {proof}=solvedTraining('route-plan',route.id);proof.steps.splice(1,1);assert.equal(validateTrainingProof('route-plan',proof),false);
  }
});

test('converted actions cannot bypass training, cancelled work earns nothing, and station mappings stay stable',()=>{
  const s=legacyGrid(),before=JSON.stringify(s);
  for(const action of [{type:'task',taskId:'water-compare'},{type:'choose',group:'grid',choiceId:'fast'},{type:'resolve-fault',choiceId:'restart-pump'}]){
    assert.ok(trainingForAction(action));assert.equal(reduceElysium(s,action),s);
  }
  assert.equal(actionSite({type:'task',taskId:'water-compare'}),'lab');
  assert.equal(actionSite(solvedTraining('water-compare')),'lab');
  assert.equal(reduceElysium(s,{type:'complete-training',activityId:'water-compare',proof:createTrainingProof('water-compare')}),s);
  assert.equal(JSON.stringify(s),before);
  assert.equal(trainingAvailable({...s,visited:s.visited.filter(site=>site!=='lab')},'water-compare'),false);
  assert.equal(trainingAvailable(createElysiumState(),'cargo-read'),false);
});

test('task credits and calibration rewards apply once and preserve old saves without new schema',()=>{
  let s=legacyGrid();assert.deepEqual(parseElysiumSave(JSON.stringify(s)),s);
  assert.ok(trainingCompleted(s,'solar-trace'));assert.equal(trainingAvailable(s,'solar-trace'),false);
  assert.ok(trainingAvailable(s,'water-compare'));s=reduceElysium(s,solvedTraining('water-compare'));
  const before=s.resources.water;s=reduceElysium(s,solvedTraining('water-calibrate'));
  assert.equal(s.resources.water,before+content.simulation.waterCalibrationBonus);
  assert.equal(reduceElysium(s,solvedTraining('water-calibrate')),s);
  assert.deepEqual(parseElysiumSave(JSON.stringify(s)),s);assert.equal('training' in s,false);
  assert.equal(trainingForAction({type:'complete-activity',taskId:'solar-connect',proof:{}}),null,'existing solar activities keep their dedicated controls');
});

test('sensor repair is atomic and choice eligibility mirrors battery limits before opening a plan',()=>{
  let s=legacyGrid();assert.equal(trainingAvailable(s,'sensor-restore'),false);
  assert.deepEqual(trainingAllowedChoices(s,'route-plan'),['direct','ridge']);
  assert.equal(actionAllowed(s,solvedTraining('route-plan','valley')),false);
  s=reduceElysium(s,solvedTraining('route-plan','direct'));
  s=reduceElysium(s,{type:'visit',siteId:'field-sensor',roverDriving:true});
  const bad=solvedTraining('sensor-restore');bad.proof.values.antenna=0;
  assert.equal(reduceElysium(s,bad),s);assert.equal(s.choices.sensor,null);
  const before=s.resources.roverCharge;s=reduceElysium(s,solvedTraining('sensor-restore'));
  assert.equal(s.choices.sensor,'sand');assert.ok(s.tasks.includes('sensor-restore'));
  assert.equal(s.resources.roverCharge,before-content.simulation.routes.direct.energyCost);
  assert.equal(reduceElysium(s,solvedTraining('sensor-restore')),s);
});
