import test from 'node:test';
import assert from 'node:assert/strict';
import {createElysiumState,reduceElysium,missionProgress,availableMissions,activityAvailable,actionAllowed} from '../game/elysiumMission.ts';
import {ELYSIUM_SAVE_KEY,parseElysiumSave,loadElysiumSave,saveElysiumSave,clearElysiumSave} from '../game/elysiumSave.ts';
import content from '../content/elysiumMissions.json' with {type:'json'};
import {solvedTraining} from './trainingFixtures.mjs';

function arrival(){
  let s=reduceElysium(createElysiumState(45),{type:'begin'});
  for(const siteId of ['airlock','command','garage','greenhouse1'])s=reduceElysium(s,{type:'visit',siteId});
  return reduceElysium(s,{type:'log',missionId:'m1',choiceId:2});
}
function memory(){
  const values=new Map([['tarukh.mars.curiosity.v1','existing navigation save']]);
  return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
}

test('versioned mission saves round-trip progress, authored logs, shared resources and docking',()=>{
  for(const s of [createElysiumState(),arrival()]){
    const encoded=JSON.stringify(s),restored=parseElysiumSave(encoded);
    assert.deepEqual(restored,s);assert.notEqual(restored,s);
    const storage=memory();assert.deepEqual(saveElysiumSave(s,storage),{ok:true,error:null});
    assert.deepEqual(loadElysiumSave(storage),{state:s,error:null});
    assert.equal(storage.values.get('tarukh.mars.curiosity.v1'),'existing navigation save');
    assert.deepEqual(clearElysiumSave(storage),{ok:true,error:null});
    assert.equal(storage.values.has(ELYSIUM_SAVE_KEY),false);assert.equal(storage.values.size,1);
  }
});

test('corrupt, oversized, unknown-version and invalid-range saves never enter the mission engine',()=>{
  for(const raw of [null,'','{','null','[]','x'.repeat(50001)])assert.equal(parseElysiumSave(raw),null);
  const mutations=[
    s=>s.version=2,s=>s.phase='finished',s=>s.sol=-1,s=>s.seed=Infinity,s=>s.roverRevision=-1,s=>s.roverDocked='yes',
    s=>s.resources.power=101,s=>s.resources.roverCharge=-1,s=>s.resources.dose=-2,s=>delete s.resources.water,
    s=>s.choices.grid='unlimited',s=>delete s.choices.oxygen,s=>s.greenhouses[0].light=25,s=>s.greenhouses[1].water=101,
    s=>s.greenhouses.push({light:1,water:1}),s=>s.visited.push('unknown'),s=>s.visited.push('command'),
    s=>s.tasks.push('cheat'),s=>s.completed.push('m1'),s=>s.logs[0].choiceId=4,s=>s.logs[0].text='untrusted text',
    s=>s.logs[0].sol=900,s=>s.test.stage='fault',s=>s.test.fault='fire',s=>s.test.attempts=-1,
    s=>s.finalLog='invented closing',s=>s.lastOutcome={decision:'a',outcome:4,why:'b'},
  ];
  for(const mutate of mutations){const state=arrival();mutate(state);assert.equal(parseElysiumSave(JSON.stringify(state)),null,mutate.toString());}
});

test('readiness checkpoints round-trip and malformed test history is rejected',()=>{
  const s=arrival();s.test={stage:'fault',fault:'pump',attempts:2,pumpRestarted:false,checkpoint:{...s.resources}};
  assert.deepEqual(parseElysiumSave(JSON.stringify(s)),s);
  for(const patch of [{checkpoint:null},{checkpoint:{...s.resources,oxygen:-1}},{fault:null},{attempts:0},{pumpRestarted:'yes'}]){
    assert.equal(parseElysiumSave(JSON.stringify({...s,test:{...s.test,...patch}})),null);
  }
});

test('storage errors are reported and invalid saves preserve the last valid save',()=>{
  const storage=memory(),valid=arrival();saveElysiumSave(valid,storage);
  const original=storage.getItem(ELYSIUM_SAVE_KEY),invalid={...valid,sol:NaN};
  assert.equal(saveElysiumSave(invalid,storage).ok,false);assert.equal(storage.getItem(ELYSIUM_SAVE_KEY),original);
  storage.setItem(ELYSIUM_SAVE_KEY,'broken');assert.ok(loadElysiumSave(storage).error);assert.equal(storage.getItem(ELYSIUM_SAVE_KEY),'broken');
  const blocked={getItem(){throw new Error('blocked');},setItem(){throw new Error('quota');},removeItem(){throw new Error('blocked');}};
  assert.ok(loadElysiumSave(blocked).error);assert.equal(saveElysiumSave(valid,blocked).ok,false);assert.equal(clearElysiumSave(blocked).ok,false);
});

test('legacy completed solar missions stay unlocked while partially repaired saves retain their credited work',()=>{
  const partial=arrival();partial.visited.push('solar');partial.tasks.push('solar-trace','solar-connect');partial.choices.grid='balanced';
  const restoredPartial=parseElysiumSave(JSON.stringify(partial));assert.deepEqual(restoredPartial,partial);
  assert.equal(activityAvailable(restoredPartial,'solar-connect'),false,'an old repair must not award reserve points again');
  assert.ok(activityAvailable(restoredPartial,'solar-clean'));
  assert.equal(missionProgress(restoredPartial,'m2').readyToLog,false);
  const cleaning={type:'complete-activity',taskId:'solar-clean',proof:{kind:'panel-cleaning',strokes:Array.from({length:11},(_,row)=>[{x:0,y:row/10},{x:1,y:row/10}])}};
  const cleaned=reduceElysium(restoredPartial,cleaning);assert.deepEqual(cleaned.resources,partial.resources);
  assert.ok(missionProgress(cleaned,'m2').readyToLog);assert.deepEqual(parseElysiumSave(JSON.stringify(cleaned)),cleaned);
  assert.equal('proof' in cleaned,false,'transient activity evidence is not stored in the mission save');

  const legacy=structuredClone(partial);legacy.completed.push('m2');
  legacy.logs.push({missionId:'m2',choiceId:0,text:content.missions.find(m=>m.id==='m2').logOptions[0],sol:legacy.sol});
  const restored=parseElysiumSave(JSON.stringify(legacy));assert.deepEqual(restored,legacy);
  assert.deepEqual(availableMissions(restored),['m3','m4','m5']);
  assert.equal(missionProgress(restored,'m2').complete,true);
  assert.ok(missionProgress(restored,'m2').objectives.every(o=>o.done));
  assert.ok(actionAllowed(restored,solvedTraining('grid-plan','reserve')));
  assert.equal(activityAvailable(restored,'solar-clean'),false,'old completed missions use reward-free practice');
  assert.equal(reduceElysium(restored,cleaning),restored);
});
