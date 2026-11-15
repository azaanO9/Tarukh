import test from 'node:test';
import assert from 'node:assert/strict';
import {createElysiumState,reduceElysium,availableMissions,missionProgress,forecastGreenhouses,readinessSummary,overnightDemand,worldBindings,actionAllowed} from '../game/elysiumMission.ts';
import content from '../content/elysiumMissions.json' with {type:'json'};

function apply(state,action){assert.ok(actionAllowed(state,action),JSON.stringify(action));return reduceElysium(state,action);}
const visit=(state,siteId,extras={})=>apply(state,{type:'visit',siteId,...extras});
const task=(state,taskId)=>apply(state,{type:'task',taskId});
const choose=(state,group,choiceId)=>apply(state,{type:'choose',group,choiceId});
const log=(state,missionId)=>apply(state,{type:'log',missionId,choiceId:0});
function gridReady(seed=1){
  let s=apply(createElysiumState(seed),{type:'begin'});
  for(const site of ['airlock','command','garage','greenhouse1'])s=visit(s,site);
  s=log(s,'m1');s=visit(s,'solar');s=task(s,'solar-trace');s=task(s,'solar-connect');
  s=choose(s,'grid','balanced');s=log(s,'m2');return apply(s,{type:'advance-sol'});
}
function prepared(seed=1,strategy='comfortable',order=['m3','m4','m5']){
  let s=gridReady(seed);s=visit(s,'lab');s=task(s,'water-compare');s=task(s,'water-calibrate');
  s=choose(s,'water',strategy==='shared'?'aggressive':'standard');s=choose(s,'oxygen','standard');s=choose(s,'scrubber','scheduled');
  s=choose(s,'greenhouse',strategy);s=task(s,'forecast-review');s=choose(s,'route','direct');
  s=visit(s,'field-sensor',{roverDriving:true});s=choose(s,'sensor','sand');s=task(s,'sensor-restore');s=task(s,'sample-collect');
  s=visit(s,'lab');s=task(s,'sample-analyse');
  s=apply(s,{type:'sync-world',roverCharge:s.resources.roverCharge,garagePhase:'parked'});
  for(const id of order)s=log(s,id);
  s=task(s,'archive-review');s=visit(s,'shelter');s=task(s,'ventilation-check');s=task(s,'shelter-power');s=choose(s,'shielding','structure');s=log(s,'m6');
  if(strategy==='minimal')s=choose(s,'grid','reserve');
  s=choose(s,'contingency','reserve');s=task(s,'plan-submit');s=task(s,'review-ack');return s;
}
function resolve(state){
  if(state.test.fault==='pump'){
    state=visit(state,'lab');state=apply(state,{type:'resolve-fault',choiceId:'restart-pump'});
    return apply(state,{type:'resolve-fault',choiceId:'cut-crop-water'});
  }
  return apply(state,{type:'resolve-fault',choiceId:state.test.fault==='heater'?'cut-crops':'regenerate'});
}

test('arrival requires all four physical visits and logs cannot skip or double-complete missions',()=>{
  let s=createElysiumState();assert.deepEqual(availableMissions(s),[]);
  assert.equal(reduceElysium(s,{type:'log',missionId:'m1',choiceId:0}),s);
  s=apply(s,{type:'begin'});s=visit(s,'command');
  assert.equal(missionProgress(s,'m1').readyToLog,false);
  assert.equal(reduceElysium(s,{type:'task',taskId:'solar-connect'}),s);
  for(const id of ['airlock','garage','greenhouse1'])s=visit(s,id);
  assert.equal(missionProgress(s,'m1').readyToLog,true);s=log(s,'m1');
  assert.equal(s.logs.length,1);assert.ok(s.logs[0].text.length>10);
  assert.equal(reduceElysium(s,{type:'log',missionId:'m1',choiceId:1}),s);
  assert.deepEqual(availableMissions(s),['m2']);
});

test('Act II missions run in any order and each successful plan keeps its own ending',()=>{
  for(const [strategy,classification] of [['minimal','Conservative'],['comfortable','Balanced'],['shared','Productive']]){
    for(const order of [['m3','m4','m5'],['m5','m3','m4'],['m4','m5','m3']]){
      let s=prepared(3,strategy,order);
      assert.deepEqual(availableMissions(s),['m7']);
      s=apply(s,{type:'start-test'});s=resolve(s);s=apply(s,{type:'advance-test'});
      assert.equal(s.test.stage,'passed');assert.equal(readinessSummary(s).outcome,classification);
      s=log(s,'m7');assert.equal(s.phase,'ready');assert.equal(s.completed.length,7);
      s=apply(s,{type:'final-log',choiceId:1});assert.ok(s.finalLog);
      assert.equal(readinessSummary(s).logs.length,7);
      assert.ok(actionAllowed(s,{type:'start-test'}),'post-story readiness experiments stay available');
    }
  }
});

test('route planning honors battery gates and requires crew-rover evidence before field work',()=>{
  let s=gridReady();assert.deepEqual(availableMissions(s),['m3','m4','m5']);
  assert.equal(actionAllowed(s,{type:'choose',group:'route',choiceId:'valley'}),false);
  s=choose(s,'route','direct');s=visit(s,'field-sensor');
  assert.equal(actionAllowed(s,{type:'choose',group:'sensor',choiceId:'sand'}),false);
  s=apply(s,{type:'sync-world',revision:s.roverRevision,roverCharge:55,roverDriving:true,siteId:'field-sensor',roverSpeed:12,garagePhase:'outside'});
  assert.ok(s.tasks.includes('field-arrival'));assert.equal(s.roverDocked,false);
  const revision=s.roverRevision;s=choose(s,'sensor','electronics');
  assert.equal(actionAllowed(s,{type:'task',taskId:'sensor-restore'}),false);assert.match(s.lastOutcome.outcome,/sand/);
  s=choose(s,'sensor','sand');s=task(s,'sensor-restore');assert.equal(s.resources.roverCharge,47);assert.equal(s.roverRevision,revision+1);
  assert.equal(reduceElysium(s,{type:'task',taskId:'sensor-restore'}),s);
  s=apply(s,{type:'advance-sol'});assert.equal(s.resources.roverCharge,47,'a parked field rover cannot recharge remotely');
});

test('explicit sol steps carry allocations across systems without time-based resource drains',()=>{
  let s=gridReady();s=choose(s,'grid','reserve');const charge=s.resources.roverCharge,revision=s.roverRevision;
  s=apply(s,{type:'advance-sol'});assert.equal(s.resources.roverCharge,charge);assert.equal(s.roverRevision,revision);
  assert.equal(worldBindings(s).chargingAllowed,false);
  s=choose(s,'grid','greenhouse');const previous=s.resources.roverCharge;s=apply(s,{type:'advance-sol'});
  assert.ok(s.resources.roverCharge>previous);assert.ok(worldBindings(s).chargingAllowed);
  const before=JSON.stringify(s);reduceElysium(s,{type:'unknown',elapsed:999999});assert.equal(JSON.stringify(s),before);
  s=choose(s,'grid','fast');for(let i=0;i<15;i++)s=apply(s,{type:'advance-sol'});
  assert.ok(s.resources.power>=0&&s.resources.power<=100);assert.equal(s.completed.length,2);
});

test('water, oxygen and scrubber choices stay separate; forecast penalizes too much light with too little water',()=>{
  let s=gridReady();s=visit(s,'lab');s=task(s,'water-compare');s=choose(s,'water','standard');
  assert.equal(s.choices.oxygen,null);assert.equal(s.choices.scrubber,null);
  s=choose(s,'greenhouse','comfortable');s=apply(s,{type:'greenhouse-settings',index:0,light:16,water:35});
  const comfortable=forecastGreenhouses(s)[0].growth;
  s=apply(s,{type:'greenhouse-settings',index:0,light:24,water:35});
  assert.ok(forecastGreenhouses(s)[0].growth<comfortable);
  assert.equal(actionAllowed(s,{type:'greenhouse-settings',index:1,light:16,water:60}),false);
  s=visit(s,'greenhouse2');s=apply(s,{type:'greenhouse-settings',index:1,light:16,water:60});
  const before=forecastGreenhouses(s)[1].growth;s=task(s,'water-calibrate');
  assert.ok(forecastGreenhouses(s)[1].growth>before);
  assert.equal(reduceElysium(s,{type:'task',taskId:'water-calibrate'}),s,'calibration bonus cannot repeat');
});

test('the three seeded faults are reproducible and the pump needs a fresh physical lab visit',()=>{
  const faults=new Set();
  for(let seed=1;seed<=6;seed++){
    const base=prepared(seed),a=apply(base,{type:'start-test'}),b=apply(base,{type:'start-test'});
    assert.equal(a.test.fault,b.test.fault);faults.add(a.test.fault);
    assert.equal(worldBindings(a).night,true);
    if(a.test.fault==='pump')assert.equal(actionAllowed(a,{type:'resolve-fault',choiceId:'restart-pump'}),false);
    const resolved=resolve(a);assert.equal(resolved.test.stage,'resolved');
    assert.equal(actionAllowed(resolved,{type:'resolve-fault',choiceId:'regenerate'}),false);
    assert.equal(actionAllowed(resolved,{type:'advance-sol'}),false);
  }
  assert.deepEqual([...faults].sort(),['heater','pump','scrubber']);
});

test('safe failure and retry restore reserves without losing completed missions, logs or accumulated dose',()=>{
  let s=prepared(2);s={...s,resources:{...s.resources,power:10,dose:4.8}};
  const completed=[...s.completed],logs=[...s.logs],checkpoint={...s.resources};
  s=apply(s,{type:'start-test'});s=resolve(s);s=apply(s,{type:'advance-test'});assert.equal(s.test.stage,'safe');
  const revision=s.roverRevision;s=apply(s,{type:'retry-test'});
  assert.deepEqual(s.resources,checkpoint);assert.equal(s.roverRevision,revision+1);
  assert.deepEqual(s.completed,completed);assert.deepEqual(s.logs,logs);assert.equal(s.test.stage,'idle');
  assert.equal(worldBindings(s).night,false);assert.ok(actionAllowed(s,{type:'advance-sol'}));
  s=apply(s,{type:'start-test'});s=resolve(s);s=apply(s,{type:'advance-test'});
  assert.equal(s.test.stage,'safe');s=apply(s,{type:'run-drill'});
  const dose=s.resources.dose;s=apply(s,{type:'retry-test'});assert.equal(s.resources.dose,dose,'retry must never erase accumulated simulated dose');
});

test('world telemetry never increments the command revision or erases dose; stale and invalid inputs are ignored',()=>{
  let s=gridReady(),revision=s.roverRevision;
  s=apply(s,{type:'sync-world',revision,roverCharge:51,dose:3});assert.equal(s.roverRevision,revision);
  s=apply(s,{type:'sync-world',revision,roverCharge:50,dose:1});assert.equal(s.resources.dose,3);
  assert.equal(reduceElysium(s,{type:'sync-world',revision:revision-1,roverCharge:100}),s);
  assert.equal(reduceElysium(s,{type:'sync-world',revision,roverCharge:50.01,dose:0}),s);
  for(const action of [null,{type:'choose',group:'bad',choiceId:'fast'},{type:'choose',group:'grid',choiceId:'bad'},
    {type:'visit',siteId:'anywhere'},{type:'task',taskId:'unknown'},{type:'sync-world',roverCharge:NaN},
    {type:'greenhouse-settings',index:0,light:Infinity,water:50},{type:'log',missionId:'m20',choiceId:0}])assert.equal(reduceElysium(s,action),s);
});

test('a depleted rover can request a deliberate return reserve without claiming progress or repeating recovery',()=>{
  let s=gridReady();s=choose(s,'route','direct');s=apply(s,{type:'sync-world',roverCharge:0,garagePhase:'outside'});
  const complete=[...s.completed],revision=s.roverRevision;
  s=apply(s,{type:'recover-rover'});assert.equal(s.resources.roverCharge,35);assert.equal(s.roverRevision,revision+1);
  assert.deepEqual(s.completed,complete);assert.equal(actionAllowed(s,{type:'recover-rover'}),false);
  let initial=gridReady();initial=choose(initial,'grid','greenhouse');
  initial=apply(initial,{type:'sync-world',roverCharge:12,garagePhase:'parked'});
  assert.equal(actionAllowed(initial,{type:'recover-rover'}),false,'recovery cannot bypass the initial charging plan');
});

test('shielding comparisons add simulated dose and changing shelter never removes earlier exposure',()=>{
  let s=prepared();s=apply(s,{type:'run-drill'});assert.equal(s.resources.dose,.6);
  s=choose(s,'shielding','full');const charge=s.resources.roverCharge;
  assert.equal(s.resources.dose,.6);s=apply(s,{type:'run-drill'});assert.ok(Math.abs(s.resources.dose-.78)<1e-9);
  assert.equal(readinessSummary(s).radiation.shelter,.18);
  s=choose(s,'shielding','full');assert.equal(s.resources.roverCharge,charge,'unchanged shielding cannot spend battery twice');
});

test('night demand follows actual greenhouse, water, oxygen, scrubber and docked charging allocations',()=>{
  let s=prepared(),base=overnightDemand(s);
  const high=choose(s,'oxygen','high'),highDemand=overnightDemand(high);
  assert.ok(highDemand.power>base.power);assert.ok(highDemand.water>base.water);assert.ok(highDemand.oxygen<base.oxygen);
  const aggressive=overnightDemand(choose(s,'water','aggressive'));
  assert.ok(aggressive.power>base.power);assert.ok(aggressive.water<base.water);
  assert.ok(overnightDemand(choose(s,'scrubber','now')).co2>base.co2);
  const minimal=overnightDemand(choose(s,'greenhouse','minimal'));
  assert.equal(minimal.cropPower,0);assert.ok(minimal.power<base.power);assert.ok(minimal.water<base.water);
  const shared=overnightDemand(choose(s,'greenhouse','shared'));assert.ok(shared.cropPower>base.cropPower);
  const undocked=overnightDemand({...s,roverDocked:false});assert.equal(undocked.chargerPower,0);assert.ok(undocked.power<base.power);
  const full=overnightDemand({...s,resources:{...s.resources,roverCharge:100}});assert.equal(full.chargerPower,0);
});

test('reduced-solar backups change the actual test draws and cannot save inactive loads',()=>{
  const base=prepared(),results=[];
  for(const contingency of ['reserve','dim-crops','slow-charge']){
    const configured=choose(base,'contingency',contingency),demand=overnightDemand(configured);
    assert.ok(demand.backupSaving>0);
    const started=apply(configured,{type:'start-test'}),fault=content.simulation.faults[started.test.fault];
    assert.ok(Math.abs(started.resources.power-(configured.resources.power-demand.power+(fault.power??0)))<1e-8);
    results.push(started.resources.power);
  }
  assert.equal(new Set(results).size,3,'three deliberate backups yield different power reserves');
  const noCrops=choose(choose(base,'greenhouse','minimal'),'contingency','dim-crops');
  assert.equal(overnightDemand(noCrops).backupSaving,0);
  const noCharger=choose({...base,roverDocked:false},'contingency','slow-charge');
  assert.equal(overnightDemand(noCharger).backupSaving,0);
});

test('mid-test reallocation changes the remaining night and low reserves can recover through a deliberate retry',()=>{
  let state=prepared(3,'shared');state=apply(state,{type:'start-test'});state=resolve(state);
  const continued=apply(state,{type:'advance-test'});
  const replanned=choose(state,'greenhouse','minimal'),saved=apply(replanned,{type:'advance-test'});
  assert.ok(saved.resources.power>continued.resources.power);
  let poor=prepared(2,'shared');poor={...poor,resources:{...poor.resources,power:18}};
  poor=apply(poor,{type:'start-test'});poor=resolve(poor);poor=apply(poor,{type:'advance-test'});
  assert.equal(poor.test.stage,'safe');const completed=[...poor.completed];
  poor=apply(poor,{type:'retry-test'});poor=choose(poor,'greenhouse','minimal');poor=choose(poor,'grid','reserve');poor=choose(poor,'water','standard');
  poor=apply(poor,{type:'advance-sol'});poor=apply(poor,{type:'start-test'});poor=resolve(poor);poor=apply(poor,{type:'advance-test'});
  assert.equal(poor.test.stage,'passed');assert.deepEqual(poor.completed,completed);
});

test('restored sensor readings narrow a usable overnight forecast and authored configuration controls the consequence',()=>{
  const restored=prepared(),missing={...restored,tasks:restored.tasks.filter(id=>id!=='sensor-restore')};
  const accurate=readinessSummary(restored).forecastInfo,uncertain=readinessSummary(missing).forecastInfo;
  assert.ok(accurate.powerMax-accurate.powerMin<uncertain.powerMax-uncertain.powerMin);
  assert.match(accurate.confidence,/verified/);assert.match(accurate.explanation,/fault/);
  const original=content.simulation.overnight.basePower,initial=overnightDemand(restored).power;
  try{
    content.simulation.overnight.basePower=original+2;
    assert.equal(overnightDemand(restored).power,initial+2,'editing authored consequences changes the real planning calculation');
  }finally{content.simulation.overnight.basePower=original;}
});

test('repairing solar restores configured reliable capacity once without instantly charging the rover',()=>{
  let s=apply(createElysiumState(),{type:'begin'});
  for(const site of ['airlock','command','garage','greenhouse1'])s=visit(s,site);
  s=log(s,'m1');s=visit(s,'solar');s=task(s,'solar-trace');
  const before={...s.resources};assert.equal(readinessSummary(s).solarCapacity,content.simulation.solar.faultCapacity);
  s=task(s,'solar-connect');
  assert.equal(s.resources.power,before.power+content.simulation.solar.repairReserveGain);
  assert.equal(s.resources.roverCharge,before.roverCharge);assert.equal(s.roverRevision,0);
  assert.equal(readinessSummary(s).solarCapacity,content.simulation.solar.repairedCapacity);
  assert.equal(reduceElysium(s,{type:'task',taskId:'solar-connect'}),s);
});

test('rough driving spends configured energy and its overnight maintenance load lasts until physical docking',()=>{
  let s=gridReady();s=choose(s,'route','direct');
  s=apply(s,{type:'sync-world',roverCharge:60,roverDriving:true,roverSpeed:35,siteId:'field-sensor',garagePhase:'outside'});
  s=visit(s,'field-sensor');s=choose(s,'sensor','sand');s=task(s,'sensor-restore');
  assert.equal(s.resources.roverCharge,60-content.simulation.routes.direct.energyCost-content.simulation.routeMaintenance.energyCost);
  assert.ok(readinessSummary(s).roverMaintenance);
  assert.equal(overnightDemand(s).maintenancePower,content.simulation.routeMaintenance.nightPowerPenalty);
  const revision=s.roverRevision,progress=[...s.completed];
  s=apply(s,{type:'sync-world',roverCharge:s.resources.roverCharge,garagePhase:'rolling-in'});
  assert.ok(readinessSummary(s).roverMaintenance);
  s=apply(s,{type:'sync-world',roverCharge:s.resources.roverCharge,garagePhase:'parked'});
  assert.equal(readinessSummary(s).roverMaintenance,false);assert.equal(overnightDemand(s).maintenancePower,0);
  assert.equal(s.roverRevision,revision);assert.deepEqual(s.completed,progress);
});

test('ridge dust lowers the next-sol yield until the physical solar task clears it, without instant energy rewards',()=>{
  let s=gridReady();assert.equal(actionAllowed(s,{type:'task',taskId:'clear-panels'}),false);
  s=choose(s,'route','ridge');s=visit(s,'field-sensor',{roverDriving:true});s=choose(s,'sensor','sand');s=task(s,'sensor-restore');
  assert.ok(s.tasks.includes('solar-dust'));assert.equal(readinessSummary(s).nextSolDustLoss,content.simulation.solar.dustPowerPenalty);
  s={...s,resources:{...s.resources,power:50}};
  const before={...s.resources},cleared=task(s,'clear-panels');
  assert.deepEqual(cleared.resources,before,'cleaning restores yield, not stored charge');
  assert.equal(readinessSummary(cleared).solarDust,false);assert.equal(actionAllowed(cleared,{type:'task',taskId:'clear-panels'}),false);
  const dustySol=apply(s,{type:'advance-sol'}),cleanSol=apply(cleared,{type:'advance-sol'});
  assert.equal(cleanSol.resources.power-dustySol.resources.power,content.simulation.solar.dustPowerPenalty);
  assert.equal(cleanSol.resources.dose,dustySol.resources.dose);assert.deepEqual(cleanSol.completed,dustySol.completed);
  assert.ok(cleared.lastOutcome.decision);assert.ok(cleared.lastOutcome.outcome);assert.ok(cleared.lastOutcome.why);
});

test('optional survey knowledge narrows the planning forecast once and heritage notes preserve mission progress',()=>{
  const base=prepared(),initial=readinessSummary(base).forecastInfo;
  let s=visit(base,'landmark');const surveyed=readinessSummary(s).forecastInfo;
  assert.ok(surveyed.powerMax-surveyed.powerMin<initial.powerMax-initial.powerMin);
  assert.match(surveyed.confidence,/survey/);assert.match(s.lastOutcome.why,/uncertainty/);
  s=visit(s,'landmark');assert.deepEqual(readinessSummary(s).forecastInfo,surveyed,'repeat inspections cannot stack the benefit');
  s=visit(s,'heritage');assert.ok(s.tasks.includes('heritage-note'));assert.match(s.lastOutcome.why,/fictional/);
  assert.deepEqual(s.resources,base.resources);assert.deepEqual(s.completed,base.completed);assert.deepEqual(s.logs,base.logs);
});
