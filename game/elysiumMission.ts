import content from '../content/elysiumMissions.json' with { type: 'json' };
import { isActivityTaskId, validateActivityProof, type ActivityProof, type ActivityTaskId } from './missionActivities.ts';
import { isTrainingId, trainingDefinition, evaluateTraining, type TrainingId, type TrainingProof } from './trainingActivities.ts';

export const MISSION_IDS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'] as const;
export type MissionId = typeof MISSION_IDS[number];
export const SITE_IDS = ['airlock', 'command', 'solar', 'lab', 'greenhouse1', 'greenhouse2', 'garage', 'field-sensor', 'shelter', 'heritage', 'landmark'] as const;
export type SiteId = typeof SITE_IDS[number];
export const CHOICE_IDS = {
  grid: ['fast', 'balanced', 'greenhouse', 'reserve'],
  water: ['conservative', 'standard', 'aggressive'],
  oxygen: ['minimum', 'standard', 'high'],
  scrubber: ['scheduled', 'now'],
  greenhouse: ['comfortable', 'maximum', 'shared', 'minimal'],
  route: ['direct', 'ridge', 'valley'],
  sensor: ['sand', 'electronics'],
  shielding: ['full', 'partial', 'structure'],
  contingency: ['reserve', 'dim-crops', 'slow-charge'],
} as const;
export type ChoiceGroup = keyof typeof CHOICE_IDS;
export type ElysiumResources = { power:number; water:number; oxygen:number; co2:number; food:number; roverCharge:number; shelter:number; dose:number };
export type ElysiumOutcome = { decision:string; outcome:string; why:string };
export type ElysiumFault = 'heater' | 'scrubber' | 'pump';
export type ElysiumState = {
  version:1;
  phase:'briefing'|'active'|'ready';
  sol:number;
  seed:number;
  resources:ElysiumResources;
  roverRevision:number;
  roverDocked:boolean;
  choices:{[K in ChoiceGroup]:typeof CHOICE_IDS[K][number]|null};
  greenhouses:{light:number;water:number}[];
  visited:SiteId[];
  tasks:string[];
  completed:MissionId[];
  logs:{missionId:MissionId;choiceId:number;text:string;sol:number}[];
  test:{stage:'idle'|'fault'|'resolved'|'safe'|'passed';fault:ElysiumFault|null;attempts:number;pumpRestarted:boolean;checkpoint:ElysiumResources|null};
  lastOutcome:ElysiumOutcome|null;
  finalLog:string|null;
};
export type ElysiumAction =
  | {type:'begin'}
  | {type:'visit';siteId:SiteId;roverDriving?:boolean}
  | {type:'task';taskId:string}
  | {type:'complete-activity';taskId:ActivityTaskId;proof:ActivityProof}
  | {type:'complete-training';activityId:TrainingId;proof:TrainingProof}
  | {type:'choose';group:ChoiceGroup;choiceId:string}
  | {type:'greenhouse-settings';index:0|1;light:number;water:number}
  | {type:'log';missionId:MissionId;choiceId:number}
  | {type:'advance-sol'}
  | {type:'start-test'}
  | {type:'resolve-fault';choiceId:string}
  | {type:'advance-test'}
  | {type:'retry-test'}
  | {type:'recover-rover'}
  | {type:'run-drill'}
  | {type:'final-log';choiceId:number}
  | {type:'sync-world';revision?:number;roverCharge:number;dose?:number;roverDriving?:boolean;roverSpeed?:number;siteId?:string|null;garagePhase?:string};

type AuthoredOutcome = {id?:string;label?:string;decision?:string;outcome:string;why:string};
const authored = content as unknown as {
  missions:{id:string;logOptions:string[]}[];
  choices:Record<string,AuthoredOutcome[]>;
  tasks:Record<string,AuthoredOutcome>;
  finalLogOptions?:string[];
};
export const FINAL_LOGS = [
  'I left room for surprises. The next crew will have reserves to work with.',
  'The systems work best when I plan how they help each other.',
  'We can do more here because I tested the risks and prepared a backup.',
] as const;
const clamp=(value:number)=>Math.max(0,Math.min(100,value));
const has=(state:ElysiumState,task:string)=>state.tasks.includes(task);
const done=(state:ElysiumState,id:MissionId)=>state.completed.includes(id);
const visited=(state:ElysiumState,site:SiteId)=>state.visited.includes(site);
const addTask=(state:ElysiumState,task:string)=>{if(!has(state,task))state.tasks.push(task);};
const validIndex=(index:number)=>Number.isInteger(index)&&index>=0&&index<3;
const simulation=content.simulation;

export function createElysiumState(seed=73429):ElysiumState {
  return {
    version:1,phase:'briefing',sol:1,seed:Number.isFinite(seed)?(seed>>>0)||73429:73429,
    resources:{...simulation.initial},roverRevision:0,roverDocked:true,
    choices:{grid:null,water:null,oxygen:null,scrubber:null,greenhouse:null,route:null,sensor:null,shielding:null,contingency:null},
    greenhouses:[{light:0,water:0},{light:0,water:0}],visited:[],tasks:[],completed:[],logs:[],
    test:{stage:'idle',fault:null,attempts:0,pumpRestarted:false,checkpoint:null},lastOutcome:null,finalLog:null,
  };
}

export function availableMissions(state:ElysiumState):MissionId[] {
  if(state.phase==='briefing')return [];
  if(!done(state,'m1'))return ['m1'];
  if(!done(state,'m2'))return ['m2'];
  const parallel=(['m3','m4','m5'] as const).filter(id=>!done(state,id));
  if(parallel.length)return parallel;
  if(!done(state,'m6'))return ['m6'];
  return done(state,'m7')?[]:['m7'];
}

export function missionProgress(state:ElysiumState,id:MissionId) {
  const task=(key:string,label:string)=>({id:key,label,done:has(state,key)});
  const site=(key:SiteId,label:string)=>({id:key,label,done:visited(state,key)});
  const choice=(key:ChoiceGroup,label:string)=>({id:key,label,done:state.choices[key]!==null});
  const requirements:Record<MissionId,{id:string;label:string;done:boolean}[]>={
    m1:[site('airlock','Enter the habitat airlock'),site('command','Read the command terminal'),site('garage','Visit the crew rover garage'),site('greenhouse1','Visit Greenhouse 1')],
    m2:[task('solar-trace','Trace the Cluster C wiring'),task('solar-connect','Reconnect the loose connector'),{id:'solar-clean',label:'Brush dust from the solar panels',done:has(state,'solar-clean')||done(state,'m2')},choice('grid','Choose the shared power plan')],
    m3:[task('water-compare','Compare the water-loop readings'),choice('water','Set water recovery'),choice('oxygen','Set oxygen production'),choice('scrubber','Schedule CO₂ filter regeneration')],
    m4:[site('greenhouse1','Visit the growing trays'),choice('greenhouse','Choose a greenhouse strategy'),task('forecast-review','Compare the seven-sol forecast')],
    m5:[choice('route','Plan the rover route'),task('field-arrival','Reach the field sensor in the crew rover'),task('sensor-restore','Restore the buried sensor'),task('sample-collect','Collect a labelled sample'),task('sample-analyse','Return and analyse it in the lab')],
    m6:[task('archive-review','Review the archived radiation event'),task('ventilation-check','Check the shelter ventilation'),task('shelter-power','Verify shelter power'),choice('shielding','Choose a shielding plan')],
    m7:[task('plan-submit','Submit the operating plan'),choice('contingency','Choose a reduced-solar backup'),task('review-ack','Read Mission Control’s delayed review'),{id:'test-passed',label:'Complete the overnight readiness test',done:state.test.stage==='passed'}],
  };
  const objectives=requirements[id]??[];
  const available=availableMissions(state).includes(id);
  return {id,available,complete:done(state,id),readyToLog:available&&objectives.every(item=>item.done),objectives};
}

const taskRules:Record<string,{mission:MissionId;site:SiteId;requires?:string[]}>={
  'cargo-read':{mission:'m1',site:'command'},
  'solar-trace':{mission:'m2',site:'solar'},
  'solar-connect':{mission:'m2',site:'solar',requires:['solar-trace']},
  'solar-clean':{mission:'m2',site:'solar',requires:['solar-trace']},
  'clear-panels':{mission:'m2',site:'solar',requires:['solar-dust']},
  'water-compare':{mission:'m3',site:'lab'},
  'water-calibrate':{mission:'m3',site:'lab',requires:['water-compare']},
  'forecast-review':{mission:'m4',site:'greenhouse1'},
  'sensor-restore':{mission:'m5',site:'field-sensor',requires:['field-arrival']},
  'sample-collect':{mission:'m5',site:'field-sensor',requires:['sensor-restore']},
  'sample-analyse':{mission:'m5',site:'lab',requires:['sample-collect']},
  'archive-review':{mission:'m6',site:'command'},
  'ventilation-check':{mission:'m6',site:'shelter'},
  'shelter-power':{mission:'m6',site:'shelter',requires:['ventilation-check']},
  'plan-submit':{mission:'m7',site:'command'},
  'review-ack':{mission:'m7',site:'command',requires:['plan-submit']},
};
export const TASK_IDS=[...Object.keys(taskRules),'field-arrival','rough-driving','route-maintenance','solar-dust','next-day-charge','pump-visited','heritage-note','landmark-survey'] as const;
const groupRules:Record<ChoiceGroup,{mission:MissionId;site:SiteId}>={
  grid:{mission:'m2',site:'command'},water:{mission:'m3',site:'lab'},oxygen:{mission:'m3',site:'lab'},scrubber:{mission:'m3',site:'lab'},
  greenhouse:{mission:'m4',site:'greenhouse1'},route:{mission:'m5',site:'garage'},sensor:{mission:'m5',site:'field-sensor'},
  shielding:{mission:'m6',site:'shelter'},contingency:{mission:'m7',site:'command'},
};
const missionUnlocked=(state:ElysiumState,id:MissionId)=>done(state,id)||availableMissions(state).includes(id);

/** Opening an activity is separate from validating its eventual completion evidence. */
export function activityAvailable(state:ElysiumState,taskId:unknown):boolean {
  if(!isActivityTaskId(taskId)||state.phase==='briefing'||state.test.stage==='fault'||state.test.stage==='resolved')return false;
  const rule=taskRules[taskId];
  if(!missionUnlocked(state,rule.mission)||!visited(state,rule.site)||!rule.requires?.every(id=>has(state,id)))return false;
  if(taskId==='clear-panels')return has(state,'solar-dust');
  // Existing completed missions remain valid; practice never awards progress or resources.
  return !done(state,'m2')&&!has(state,taskId);
}

export function actionSite(action:ElysiumAction):SiteId|null {
  if(action.type==='complete-training')return isTrainingId(action.activityId)?trainingDefinition(action.activityId).site as SiteId:null;
  if(action.type==='recover-rover')return 'garage';
  if(action.type==='run-drill')return 'shelter';
  if(action.type==='visit')return action.siteId;
  if(action.type==='task')return taskRules[action.taskId]?.site??null;
  if(action.type==='complete-activity')return isActivityTaskId(action.taskId)?'solar':null;
  if(action.type==='choose')return groupRules[action.group]?.site??null;
  if(action.type==='greenhouse-settings')return action.index===0?'greenhouse1':'greenhouse2';
  if(action.type==='resolve-fault'&&action.choiceId==='restart-pump')return 'lab';
  if(['advance-sol','start-test','advance-test','retry-test'].includes(action.type))return 'command';
  return null;
}

function coreActionAllowed(state:ElysiumState,action:ElysiumAction):boolean {
  if(!action||typeof action!=='object')return false;
  if(action.type==='begin')return state.phase==='briefing';
  if(state.phase==='briefing')return false;
  const liveTest=state.test.stage==='fault'||state.test.stage==='resolved';
  if(action.type==='sync-world')return Number.isFinite(action.roverCharge)&&action.roverCharge>=0&&action.roverCharge<=100
    &&(action.revision===undefined||action.revision===state.roverRevision)
    &&(action.dose===undefined||(Number.isFinite(action.dose)&&action.dose>=0&&action.dose<=100000));
  if(action.type==='visit')return (SITE_IDS as readonly string[]).includes(action.siteId);
  if(action.type==='complete-activity')return activityAvailable(state,action.taskId)&&validateActivityProof(action.taskId,action.proof);
  if(action.type==='task'){
    if(isActivityTaskId(action.taskId))return false;
    const rule=taskRules[action.taskId];
    if(!rule||has(state,action.taskId)||!missionUnlocked(state,rule.mission)||!visited(state,rule.site)||(rule.requires&&!rule.requires.every(id=>has(state,id))))return false;
    if(action.taskId==='sensor-restore'&&state.choices.sensor!=='sand')return false;
    if(action.taskId==='forecast-review'&&!state.choices.greenhouse)return false;
    return !liveTest;
  }
  if(action.type==='choose'){
    const rule=groupRules[action.group],ids=CHOICE_IDS[action.group] as readonly string[]|undefined;
    if(!rule||!ids?.includes(action.choiceId)||!missionUnlocked(state,rule.mission)||!visited(state,rule.site))return false;
    if(action.group==='grid'&&(!has(state,'solar-connect')||(!done(state,'m2')&&!has(state,'solar-clean'))))return false;
    if(['water','oxygen','scrubber'].includes(action.group)&&!has(state,'water-compare'))return false;
    if(action.group==='route')return !has(state,'field-arrival')&&state.resources.roverCharge>=simulation.routes[action.choiceId as keyof typeof simulation.routes].minimumCharge;
    if(action.group==='sensor'&&!has(state,'field-arrival'))return false;
    if(action.group==='shielding'&&(!has(state,'shelter-power')||state.resources.roverCharge<simulation.shielding[action.choiceId as keyof typeof simulation.shielding].chargeCost))return false;
    return !liveTest||['grid','water','oxygen','scrubber','greenhouse'].includes(action.group);
  }
  if(action.type==='greenhouse-settings')return (action.index===0||action.index===1)&&missionUnlocked(state,'m4')
    &&visited(state,action.index===0?'greenhouse1':'greenhouse2')&&Number.isFinite(action.light)&&action.light>=0&&action.light<=24
    &&Number.isFinite(action.water)&&action.water>=0&&action.water<=100&&!liveTest;
  if(action.type==='log')return (MISSION_IDS as readonly string[]).includes(action.missionId)&&validIndex(action.choiceId)&&missionProgress(state,action.missionId).readyToLog;
  if(action.type==='final-log')return state.phase==='ready'&&state.finalLog===null&&validIndex(action.choiceId);
  if(action.type==='advance-sol')return !liveTest&&state.choices.grid!==null&&visited(state,'command');
  if(action.type==='start-test')return done(state,'m6')&&has(state,'plan-submit')&&has(state,'review-ack')&&!!state.choices.contingency&&!liveTest&&state.test.stage!=='safe';
  if(action.type==='advance-test')return state.test.stage==='resolved';
  if(action.type==='retry-test')return state.test.stage==='safe'&&state.test.checkpoint!==null;
  if(action.type==='recover-rover')return done(state,'m2')&&state.choices.route!==null&&visited(state,'garage')&&state.resources.roverCharge<simulation.recovery.minimumCharge&&!liveTest;
  if(action.type==='run-drill')return missionUnlocked(state,'m6')&&visited(state,'shelter')&&state.choices.shielding!==null&&!liveTest;
  if(action.type==='resolve-fault'){
    if(state.test.stage!=='fault')return false;
    if(state.test.fault==='heater')return ['cut-heater','cut-crops'].includes(action.choiceId);
    if(state.test.fault==='scrubber')return ['regenerate','reduce-ventilation'].includes(action.choiceId);
    return action.choiceId==='restart-pump'?has(state,'pump-visited')&&!state.test.pumpRestarted
      :action.choiceId==='cut-crop-water'&&state.test.pumpRestarted;
  }
  return false;
}

const trainingGroups:Partial<Record<ChoiceGroup,TrainingId>>={grid:'grid-plan',water:'water-plan',oxygen:'oxygen-plan',scrubber:'air-plan',greenhouse:'plant-plan',route:'route-plan',sensor:'sensor-restore',shielding:'shield-plan',contingency:'backup-plan'};
export function trainingForAction(action:ElysiumAction):TrainingId|null {
  if(!action||typeof action!=='object')return null;
  if(action.type==='task')return isTrainingId(action.taskId)?action.taskId:null;
  if(action.type==='choose')return trainingGroups[action.group]??null;
  if(action.type==='resolve-fault'){
    if(['cut-heater','cut-crops'].includes(action.choiceId))return 'fault-heater';
    if(['regenerate','reduce-ventilation'].includes(action.choiceId))return 'fault-scrubber';
    if(action.choiceId==='restart-pump')return 'fault-pump';
    if(action.choiceId==='cut-crop-water')return 'fault-water';
  }
  return null;
}

function trainingActions(id:TrainingId,choice:string|null):ElysiumAction[] {
  if(id==='sensor-restore')return [{type:'choose',group:'sensor',choiceId:'sand'},{type:'task',taskId:'sensor-restore'}];
  if(id==='fault-pump')return [{type:'resolve-fault',choiceId:'restart-pump'}];
  if(id==='fault-water')return [{type:'resolve-fault',choiceId:'cut-crop-water'}];
  if(id==='fault-heater'||id==='fault-scrubber')return [{type:'resolve-fault',choiceId:choice??''}];
  const group=(Object.keys(trainingGroups) as ChoiceGroup[]).find(group=>trainingGroups[group]===id);
  return group?[{type:'choose',group,choiceId:choice??''}]:[{type:'task',taskId:id}];
}

/** Once-only task credit comes from existing flags, keeping previous saves compatible. */
export function trainingCompleted(state:ElysiumState,id:TrainingId):boolean {
  return !!taskRules[id]&&has(state,id);
}

function trainingPlanAllowed(state:ElysiumState,id:TrainingId,choice:string|null):boolean {
  let draft=state;
  for(const action of trainingActions(id,choice)){
    if(!coreActionAllowed(draft,action))return false;
    draft=reduceCore(draft,action);
  }
  return true;
}

export function trainingAllowedChoices(state:ElysiumState,id:TrainingId):string[] {
  if(!isTrainingId(id))return [];
  const definition=trainingDefinition(id);
  if(state.phase==='briefing'||!visited(state,definition.site as SiteId))return [];
  return definition.choices.filter(choice=>trainingPlanAllowed(state,id,choice.id)).map(choice=>choice.id);
}

export function trainingAvailable(state:ElysiumState,id:unknown):boolean {
  if(!isTrainingId(id)||state.phase==='briefing'||trainingCompleted(state,id))return false;
  const definition=trainingDefinition(id);
  if(!visited(state,definition.site as SiteId)||!missionUnlocked(state,definition.mission))return false;
  return definition.choices.length?trainingAllowedChoices(state,id).length>0:trainingPlanAllowed(state,id,null);
}

export function actionAllowed(state:ElysiumState,action:ElysiumAction):boolean {
  if(!action||typeof action!=='object')return false;
  if(action.type==='complete-training'){
    if(!trainingAvailable(state,action.activityId))return false;
    const result=evaluateTraining(action.activityId,action.proof);
    return result.complete&&trainingPlanAllowed(state,action.activityId,result.choice);
  }
  if(trainingForAction(action)!==null)return false;
  return coreActionAllowed(state,action);
}

export function forecastGreenhouses(state:ElysiumState) {
  return state.greenhouses.map((settings,index)=>{
    const powered=state.choices.grid==='greenhouse'||state.choices.grid==='balanced'||state.choices.grid==='fast';
    const active=powered&&state.choices.greenhouse!=='minimal'&&settings.light>0;
    const waterFactor=has(state,'water-calibrate')?1:state.choices.water==='conservative'?.65:.8;
    const moisture=settings.water/60*waterFactor;
    const lightFactor=Math.min(1.15,settings.light/16);
    const stress=settings.light>18&&moisture<.9?.4:1;
    const growth=active?Math.round(Math.min(100,70*lightFactor*Math.min(1,moisture)*stress)):0;
    return {index,light:settings.light,water:settings.water,growth,food:Math.round(growth*.22),
      warning:!active?'Rations remain the food plan.':stress<1?'Too much light for this water supply slows growth.':moisture<.8?'Water limits growth. Repairing recovery helps.':'Light and water work together.',
      label:'Seven-sol accelerated simulation; crops supplement stored food.'};
  });
}

/** Forecast one deliberately advanced night; values are authored planning units. */
export function overnightDemand(state:ElysiumState) {
  const rules=simulation.overnight;
  const grid=state.choices.grid??'reserve',water=state.choices.water??'conservative',oxygen=state.choices.oxygen??'minimum';
  const cropsPowered=grid!=='reserve'&&state.choices.greenhouse!=='minimal';
  const cropPower=cropsPowered?state.greenhouses.reduce((sum,g)=>sum+g.light*rules.greenhousePowerPerLightHour,0):0;
  const cropWater=cropsPowered?state.greenhouses.reduce((sum,g)=>sum+g.water*rules.greenhouseWaterPerDrip,0):0;
  const chargerPower=state.roverDocked&&state.resources.roverCharge<100?rules.gridPower[grid]:0;
  const contingency=state.choices.contingency;
  const maintenancePower=has(state,'route-maintenance')?simulation.routeMaintenance.nightPowerPenalty:0;
  const backupSaving=contingency==='dim-crops'?Math.min(cropPower,rules.contingencyPower['dim-crops'])
    :contingency==='slow-charge'?Math.min(chargerPower,rules.contingencyPower['slow-charge'])
    :contingency==='reserve'?rules.contingencyPower.reserve:0;
  return {
    power:Math.max(0,rules.basePower+cropPower+chargerPower+maintenancePower+rules.oxygenPower[oxygen]+rules.waterPower[water]-backupSaving),
    water:Math.max(0,rules.baseWater+cropWater+rules.oxygenWater[oxygen]-rules.waterRecovery[water]-(has(state,'water-calibrate')?rules.calibrationWaterSaving:0)),
    oxygen:rules.baseOxygen-rules.oxygenReserveGain[oxygen],
    co2:state.choices.scrubber?rules.scrubberCo2Change[state.choices.scrubber]:0,
    backupSaving,cropPower,chargerPower,maintenancePower,
  };
}

export function readinessSummary(state:ElysiumState) {
  const outcome=state.choices.grid==='reserve'||state.choices.greenhouse==='minimal'?'Conservative'
    :state.choices.greenhouse==='shared'||state.choices.greenhouse==='maximum'?'Productive':'Balanced';
  const limits=simulation.readiness;
  const essentials=state.resources.power>=limits.minimumPower&&state.resources.water>=limits.minimumWater&&state.resources.oxygen>=limits.minimumOxygen&&state.resources.co2<=limits.maxCo2;
  const demand=overnightDemand(state),verified=has(state,'sensor-restore');
  const surveyed=has(state,'landmark-survey');
  const uncertainty=Math.max(0,(verified?simulation.forecast.verifiedPowerUncertainty:simulation.forecast.unverifiedPowerUncertainty)-(surveyed?simulation.forecast.surveyUncertaintyReduction:0));
  const forecastPower=demand.power*(1+simulation.overnight.sunriseDemandFraction)+simulation.overnight.sunrisePower;
  return {outcome,ready:state.test.stage==='passed',essentials,
    score:Math.round((state.resources.power+state.resources.water+state.resources.oxygen+(100-state.resources.co2)+state.resources.shelter)/5),
    forecast:forecastGreenhouses(state),logs:state.logs.map(log=>log.text),nightDemand:demand,
    solarCapacity:has(state,'solar-connect')?simulation.solar.repairedCapacity:simulation.solar.faultCapacity,
    solarDust:has(state,'solar-dust'),nextSolDustLoss:has(state,'solar-dust')?simulation.solar.dustPowerPenalty:0,
    roverMaintenance:has(state,'route-maintenance'),
    forecastInfo:{confidence:(verified?'Site sensor verified':'Unverified site readings')+(surveyed?' · terrain survey recorded':''),powerMin:Math.max(0,Math.floor(forecastPower-uncertainty)),powerMax:Math.ceil(forecastPower+uncertainty),solar:'Zero solar during the overnight test',
      explanation:(verified?'Restored site readings narrow the planning range. Keep extra reserve for the separate equipment fault.':'Missing field readings make the planning range wider. Restoring the sensor improves this estimate. All values are simulated.')+(surveyed?' Your recorded terrain observation reduces the remaining planning uncertainty.':'')},
    radiation:{outside:1.2,habitat:.6,shelter:simulation.shielding[state.choices.shielding??'structure'].dose,label:'Simulation estimates for the same drill interval, not measured doses.'}};
}

export function worldBindings(state:ElysiumState) {
  const chargingAllowed=state.choices.grid==='fast'||state.choices.grid==='balanced'||(state.choices.grid==='greenhouse'&&has(state,'next-day-charge'));
  return {revision:state.roverRevision,roverCharge:state.resources.roverCharge,chargingAllowed,maxCharge:chargingAllowed?100:state.resources.roverCharge,
    roverAllowed:done(state,'m2')&&!!state.choices.route&&state.resources.roverCharge>0,
    night:state.test.stage==='fault'||state.test.stage==='resolved'};
}

function outcome(state:ElysiumState,decision:string,result:string,why:string){state.lastOutcome={decision,outcome:result,why};}
function authoredOutcome(state:ElysiumState,value:AuthoredOutcome|undefined,fallback:string){
  outcome(state,value?.decision??value?.label??fallback,value?.outcome??'The setting is recorded.',value?.why??'Your next simulation step uses this setting.');
}
function charge(state:ElysiumState,value:number){state.resources.roverCharge=clamp(value);state.roverRevision++;}
function greenhousePreset(state:ElysiumState,id:string){
  state.greenhouses=simulation.greenhousePresets[id as keyof typeof simulation.greenhousePresets].map(settings=>({...settings}));
}
function resourceDelta(state:ElysiumState,delta:Partial<ElysiumResources>){
  for(const [name,amount] of Object.entries(delta)){
    const key=name as keyof ElysiumResources;
    state.resources[key]=clamp(state.resources[key]+amount);
  }
}

/** Decisions advance the planning model; wall-clock time never consumes mission reserves. */
function reduceCore(state:ElysiumState,action:ElysiumAction):ElysiumState {
  if(!coreActionAllowed(state,action))return state;
  if(action.type==='sync-world'){
    const arrived=action.roverDriving&&action.siteId==='field-sensor'&&!!state.choices.route&&!has(state,'field-arrival');
    const rough=action.roverDriving&&state.choices.route==='direct'&&(action.roverSpeed??0)>30&&!has(state,'rough-driving');
    const dockingChanged=action.garagePhase!==undefined&&(action.garagePhase==='parked')!==state.roverDocked;
    const serviced=action.garagePhase==='parked'&&has(state,'route-maintenance');
    if(Math.abs(action.roverCharge-state.resources.roverCharge)<.05&&(action.dose===undefined||action.dose<=state.resources.dose)&&!arrived&&!rough&&!dockingChanged&&!serviced)return state;
  }
  const next:ElysiumState={...state,resources:{...state.resources},choices:{...state.choices},greenhouses:state.greenhouses.map(g=>({...g})),visited:[...state.visited],tasks:[...state.tasks],completed:[...state.completed],logs:[...state.logs],test:{...state.test}};
  if(action.type==='begin')next.phase='active';
  else if(action.type==='sync-world'){
    next.resources.roverCharge=action.roverCharge;
    if(action.garagePhase!==undefined)next.roverDocked=action.garagePhase==='parked';
    if(action.garagePhase==='parked'&&has(next,'route-maintenance')){
      next.tasks=next.tasks.filter(id=>id!=='route-maintenance');
      outcome(next,'Park for maintenance','The garage clears the rough-route maintenance allowance.','Returning the rover removes the extra load from the next readiness test.');
    }
    if(action.dose!==undefined)next.resources.dose=Math.max(next.resources.dose,action.dose);
    if(action.roverDriving&&action.siteId==='field-sensor'&&next.choices.route)addTask(next,'field-arrival');
    if(action.roverDriving&&next.choices.route==='direct'&&(action.roverSpeed??0)>30)addTask(next,'rough-driving');
  }else if(action.type==='visit'){
    if(!visited(next,action.siteId))next.visited.push(action.siteId);
    if(action.siteId==='field-sensor'&&action.roverDriving&&next.choices.route){addTask(next,'field-arrival');next.roverDocked=false;}
    if(action.siteId==='lab'&&next.test.stage==='fault'&&next.test.fault==='pump')addTask(next,'pump-visited');
    if(action.siteId==='heritage'){
      addTask(next,'heritage-note');
      outcome(next,'Read the rover heritage marker','A knowledge note is recorded: Curiosity is a robotic rover in Gale crater.','This nearby traverse marker is fictional for education; it is not Curiosity’s real location beside Elysium.');
    }
    if(action.siteId==='landmark'){
      addTask(next,'landmark-survey');
      outcome(next,'Record the terrain survey','Your observed ridges narrow the planning forecast. The note is saved in the journal.','Combining site measurements and terrain observations reduces uncertainty. The effect is a labelled planning simulation.');
    }
  }else if(action.type==='task'||action.type==='complete-activity'){
    addTask(next,action.taskId);authoredOutcome(next,authored.tasks[action.taskId],action.taskId);
    if(action.taskId==='clear-panels')next.tasks=next.tasks.filter(id=>id!=='solar-dust');
    if(action.taskId==='solar-connect'){
      next.resources.power=clamp(next.resources.power+simulation.solar.repairReserveGain);
      outcome(next,'Reconnect Cluster C',`Reliable solar capacity rises from ${simulation.solar.faultCapacity}% to ${simulation.solar.repairedCapacity}%. The connection makes ${simulation.solar.repairReserveGain} existing reserve points available.`,
        'The rover battery does not jump. Choose a charging allocation and use the dock or a deliberate overnight step.');
    }
    if(action.taskId==='water-calibrate')next.resources.water=clamp(next.resources.water+simulation.waterCalibrationBonus);
    if(action.taskId==='sensor-restore'){
      const route=next.choices.route!;
      const maintenance=has(next,'rough-driving')?simulation.routeMaintenance.energyCost:0;
      charge(next,next.resources.roverCharge-simulation.routes[route].energyCost-maintenance);
      if(route==='ridge'){
        addTask(next,'solar-dust');
        outcome(next,'Restore the sensor after the ridge route',`The sensor is online. Wind-blown panel dust reduces next-sol power yield by ${simulation.solar.dustPowerPenalty} points until cleared.`,
          'Return to the solar station to clear the dust. It affects energy planning, not crew health.');
      }
      if(maintenance){
        addTask(next,'route-maintenance');
        outcome(next,'Direct route at high speed',`The rough trip uses ${maintenance} extra charge points and adds a ${simulation.routeMaintenance.nightPowerPenalty}-point maintenance load until the rover is parked in the garage.`,
          'Careful driving avoids this allowance. Returning to the maintenance bay removes it without losing mission progress.');
      }
    }
  }else if(action.type==='choose'){
    (next.choices as Record<string,string|null>)[action.group]=action.choiceId;
    authoredOutcome(next,authored.choices[action.group]?.find(choice=>choice.id===action.choiceId),action.choiceId);
    if(action.group==='greenhouse')greenhousePreset(next,action.choiceId);
    if(action.group==='shielding'){
      const plan=simulation.shielding[action.choiceId as keyof typeof simulation.shielding];
      next.resources.shelter=plan.readiness;
      if(plan.chargeCost>0&&state.choices.shielding!==action.choiceId)charge(next,next.resources.roverCharge-plan.chargeCost);
    }
    if(action.group==='sensor'&&action.choiceId==='electronics')outcome(next,'Check electronics','The electronics respond. Inspect the sand around the sensor and try again.','A silent sensor does not always mean a broken circuit.');
  }else if(action.type==='greenhouse-settings'){
    next.greenhouses[action.index]={light:action.light,water:action.water};
    outcome(next,'Change growing conditions','The seven-sol forecast has been recalculated.','Light needs enough water. These accelerated predictions are simulation values.');
  }else if(action.type==='log'){
    const mission=authored.missions.find(item=>item.id===action.missionId)!;
    next.logs.push({missionId:action.missionId,choiceId:action.choiceId,text:mission.logOptions[action.choiceId],sol:next.sol});
    next.completed.push(action.missionId);
    if(action.missionId==='m7')next.phase='ready';
    outcome(next,'Save personal log','Kaelen’s log is saved for Mission Control.','Your observations explain your engineering decisions.');
  }else if(action.type==='advance-sol'){
    next.sol++;
    const rules=simulation.sol,grid=next.choices.grid!,water=next.choices.water??'conservative',oxygenMode=next.choices.oxygen??'minimum';
    const cropLoad=next.greenhouses.reduce((sum,g)=>sum+g.light*rules.cropPowerPerLightHour,0);
    const recovery=rules.waterRecovery[water],oxygen=rules.oxygenProduction[oxygenMode];
    next.resources.power=clamp(next.resources.power+rules.gridPower[grid]-cropLoad-rules.waterPower[water]-rules.oxygenPower[oxygenMode]-(has(next,'solar-dust')?simulation.solar.dustPowerPenalty:0));
    next.resources.water=clamp(next.resources.water+recovery-rules.waterConsumption-oxygen*rules.oxygenWaterFactor-next.greenhouses.reduce((sum,g)=>sum+g.water*rules.cropWaterFactor,0)+(has(next,'water-calibrate')?rules.calibrationBonus:0));
    next.resources.oxygen=clamp(next.resources.oxygen+oxygen-rules.oxygenConsumption);
    next.resources.co2=clamp(next.resources.co2+(next.choices.scrubber?rules.scrubberChange:rules.unmaintainedCo2));
    next.resources.food=clamp(next.resources.food-rules.foodConsumption+forecastGreenhouses(next).reduce((sum,g)=>sum+g.food/rules.forecastSols,0));
    if(next.choices.grid==='greenhouse')addTask(next,'next-day-charge');
    if(next.choices.grid!=='reserve'&&next.roverDocked)charge(next,next.resources.roverCharge+rules.chargeGain[grid]);
    const safe=!readinessSummary(next).essentials;
    if(safe){next.resources.power=Math.max(simulation.recovery.power,next.resources.power);next.resources.water=Math.max(simulation.recovery.water,next.resources.water);next.resources.oxygen=Math.max(simulation.recovery.oxygen,next.resources.oxygen);next.resources.co2=Math.min(simulation.recovery.maxCo2,next.resources.co2);}
    outcome(next,`Wake up · Sol ${next.sol}`,safe?'Reserve systems kept essentials safe. Review the resource plan before the next test.':'Morning checks are complete. Your resource choices carried into this sol.',safe?'Safe mode protects the crew. No mission progress was lost.':'Charging and crops share power and water; the forecast is accelerated for planning.');
  }else if(action.type==='start-test'){
    next.seed=(Math.imul(next.seed,1664525)+1013904223)>>>0;
    next.test={stage:'fault',fault:(['heater','scrubber','pump'] as const)[next.seed%3],attempts:next.test.attempts+1,pumpRestarted:false,checkpoint:{...next.resources}};
    next.tasks=next.tasks.filter(id=>id!=='pump-visited');
    const demand=overnightDemand(next);
    resourceDelta(next,{power:-demand.power,water:-demand.water,oxygen:-demand.oxygen,co2:demand.co2});
    resourceDelta(next,simulation.faults[next.test.fault!]);
    outcome(next,'Start the overnight simulation',`Solar is zero. Your operating plan uses ${demand.power.toFixed(1)} power points before the ${next.test.fault} fault. Reserves wait while you decide.`,
      `Your reduced-solar backup saves ${demand.backupSaving.toFixed(1)} power points in this step. Only deliberate steps change reserves; there is no countdown.`);
  }else if(action.type==='resolve-fault'){
    resourceDelta(next,simulation.responses[action.choiceId as keyof typeof simulation.responses]);
    if(action.choiceId==='reduce-ventilation'){
      outcome(next,'Reduce ventilation','CO₂ rises. Try regenerating the filter instead.','Ventilation and carbon-dioxide removal are different jobs. The simulation waits for your next choice.');
    }else if(action.choiceId==='restart-pump'){
      next.test.pumpRestarted=true;
      outcome(next,'Restart the water pump','Flow is restored. Decide how to protect the habitat reserve next.','Oxygen generation needs water; the pump links both systems.');
    }else{
      next.test.stage='resolved';
      outcome(next,'Apply the fault response','The linked systems have stabilised. Continue to sunrise when ready.','Reserves stay visible while you compare the effect on power, water, air and crops.');
    }
  }else if(action.type==='advance-test'){
    const demand=overnightDemand(next),rules=simulation.overnight;
    resourceDelta(next,{power:-rules.sunrisePower-demand.power*rules.sunriseDemandFraction,water:-demand.water*rules.sunriseDemandFraction,oxygen:-rules.sunriseOxygen});
    next.test.stage=readinessSummary(next).essentials?'passed':'safe';
    outcome(next,'Check sunrise results',next.test.stage==='passed'?'Essentials stayed within the planning limits. The readiness test is complete.':'The outpost entered safe mode. Adjust your plan and retry.',next.test.stage==='passed'?'Conservative, balanced and productive plans can all work when essentials have enough reserve.':'The point is knowing what to do when things are not perfect. Your completed missions and logs are safe.');
  }else if(action.type==='retry-test'){
    next.resources={...next.test.checkpoint!,dose:Math.max(next.resources.dose,next.test.checkpoint!.dose),shelter:next.resources.shelter};charge(next,next.resources.roverCharge);
    next.test.stage='idle';next.test.fault=null;next.test.pumpRestarted=false;
    outcome(next,'Restore the test checkpoint','Resources are restored. Reallocate, rest if needed, then try again.','A rehearsal is a chance to improve the plan, not lose progress.');
  }else if(action.type==='recover-rover'){
    charge(next,simulation.recovery.returnCharge);
    outcome(next,'Request a rover return reserve',`A spare power cell restores ${simulation.recovery.returnCharge}% charge. Bring the rover back to the garage for a full recharge.`,'This deliberate recovery keeps an empty battery from ending exploration. Mission progress is unchanged.');
  }else if(action.type==='run-drill'){
    const estimate=readinessSummary(next).radiation.shelter;
    next.resources.dose=Math.min(100000,next.resources.dose+estimate);
    outcome(next,'Run the radiation comparison drill',`This simulated interval adds ${estimate.toFixed(2)} mSv inside the selected shelter.`,'Shielding reduces additional exposure. It does not erase the accumulated simulated dose. This is a rehearsal, not an emergency.');
  }else if(action.type==='final-log'){
    next.finalLog=authored.finalLogOptions?.[action.choiceId]??FINAL_LOGS[action.choiceId];
  }
  return next;
}

/** Apply a validated workbench as one transaction; cancelled or incomplete evidence changes nothing. */
export function reduceElysium(state:ElysiumState,action:ElysiumAction):ElysiumState {
  if(!actionAllowed(state,action))return state;
  if(action.type!=='complete-training')return reduceCore(state,action);
  const result=evaluateTraining(action.activityId,action.proof);
  let next=state;
  for(const step of trainingActions(action.activityId,result.choice))next=reduceCore(next,step);
  return next;
}
