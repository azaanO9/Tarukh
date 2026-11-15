import content from '../content/elysiumMissions.json' with {type:'json'};
import {availableMissions,missionProgress,type ElysiumState,type MissionId,type SiteId} from './elysiumMission.ts';
import {ELYSIUM_SITES,nearestElysiumSite} from './elysiumSites.ts';
import {trainingDefinition,type TrainingId} from './trainingActivities.ts';
import type {ActivityTaskId} from './missionActivities.ts';

export type GuidanceAction = 'advance-sol'|'start-test'|'advance-test'|'retry-test'|'recover-rover';
export type GuidanceIntent =
  | {type:'visit';siteId:SiteId}
  | {type:'training';activityId:TrainingId}
  | {type:'solar';taskId:ActivityTaskId}
  | {type:'log';missionId:MissionId}
  | {type:'action';action:GuidanceAction}
  | {type:'panel';panel:'prologue'|'ending'}
  | {type:'world';action:'deploy-rover'|'drive'|'park-rover'|'explore'};

export interface GuidanceContext {
  selectedMission?:MissionId;
  currentSiteId?:string|null;
  x?:number;
  z?:number;
  roverDriving?:boolean;
  garagePhase?:string;
  roverX?:number;
  roverZ?:number;
}

export interface ElysiumGuidance {
  id:string;
  missionId:MissionId|null;
  kind:'briefing'|'visit'|'training'|'solar'|'log'|'travel'|'charge'|'test'|'ending'|'explore';
  title:string;
  action:string;
  detail:string;
  travelHint:string;
  targetSiteId:SiteId|null;
  target:{x:number;z:number;label:string;range:number;number:number|null}|null;
  distance:number|null;
  atTarget:boolean;
  stepIndex:number;
  stepCount:number;
  optional:boolean;
  intent:GuidanceIntent;
}

type Step = Pick<ElysiumGuidance,'id'|'kind'|'title'|'action'|'detail'|'intent'> & {
  site?:SiteId;
  optional?:boolean;
  rover?:boolean;
};
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const indoor=new Set<SiteId>(['airlock','command','lab','shelter']);
const has=(state:ElysiumState,id:string)=>state.tasks.includes(id);

function training(id:TrainingId,title?:string,detail?:string):Step {
  const definition=trainingDefinition(id);
  return {id,kind:'training',site:definition.site as SiteId,title:title??definition.title,action:'Open the workbench',
    detail:detail??definition.instruction,intent:{type:'training',activityId:id}};
}
function station(site:SiteId,title:string,detail:string):Step {
  return {id:`visit-${site}`,kind:'visit',site,title,detail,action:'Use this station',intent:{type:'visit',siteId:site}};
}
function actionStep(action:GuidanceAction,title:string,detail:string,site:SiteId='command',kind:ElysiumGuidance['kind']='test'):Step {
  return {id:action,kind,site,title,detail,action:title,intent:{type:'action',action}};
}

function travelHint(step:Step,context:GuidanceContext,atTarget:boolean,target:ElysiumGuidance['target']):string {
  if(!target)return step.kind==='log'?'You can write this here. No need to walk anywhere.':step.kind==='explore'?'Keep exploring, or replay a completed activity for practice.':'Open the mission tablet when you are ready.';
  if(step.rover)return atTarget?'Use F or the Enter rover button to board.':'Follow the rover symbol on your map. Use F or Enter rover when you reach it.';
  if(context.roverDriving&&step.site&&indoor.has(step.site))return `Stop the rover outside the habitat. Use F or Exit rover to get out, then open the airlock and follow marker ${target.number} inside.`;
  if(context.roverDriving&&(step.site==='greenhouse1'||step.site==='greenhouse2'))return `Stop outside the greenhouse and use F or Exit rover to get out. Open its airlock, then follow marker ${target.number}.`;
  if(atTarget)return `You are at ${target.label}. ${step.action}.`;
  const inside=indoor.has(context.currentSiteId as SiteId);
  if(step.site&&indoor.has(step.site))return inside
    ?`Stay inside the habitat and follow marker ${target.number} to ${target.label}.`
    :`Go up the habitat ramp. Use E or the door button to pass through the airlock, then follow marker ${target.number}.`;
  const exit=inside?'Leave through the habitat airlock. ':'';
  if(step.site==='greenhouse1'||step.site==='greenhouse2')return `${exit}Follow marker ${target.number} to the greenhouse. Use E or the door button to go inside.`;
  if(step.site==='field-sensor')return 'Follow your marked rover route to the sensor. Open the full map if you need a bigger view.';
  if(step.site==='solar')return `${exit}Follow marker 3 to the solar panels beside the garage.`;
  if(step.site==='garage')return `${exit}Follow marker 7 to the rover garage and its planning terminal.`;
  return `${exit}Follow marker ${target.number} on your map.`;
}

function finish(state:ElysiumState,missionId:MissionId|null,step:Step,context:GuidanceContext):ElysiumGuidance {
  const site=step.site?ELYSIUM_SITES.find(site=>site.id===step.site):null;
  const roverPosition=step.rover&&finite(context.roverX)&&finite(context.roverZ);
  const target:ElysiumGuidance['target']=roverPosition
    ?{x:context.roverX!,z:context.roverZ!,label:'Crew rover',range:4,number:null}
    :site?{x:site.x,z:site.z,label:site.label,range:site.range,number:site.number}:null;
  const distance=target&&finite(context.x)&&finite(context.z)?Math.round(Math.hypot(context.x-target.x,context.z-target.z)):null;
  const physicalSite=context.currentSiteId!==undefined?context.currentSiteId:finite(context.x)&&finite(context.z)?nearestElysiumSite(context.x,context.z)?.id:null;
  const atTarget=!target||(step.rover?distance!==null&&Math.hypot(context.x!-target.x,context.z!-target.z)<=target.range:physicalSite===step.site);
  const progress=missionId?missionProgress(state,missionId):null;
  const remaining=progress?.objectives.findIndex(objective=>!objective.done)??-1;
  return {...step,missionId,targetSiteId:step.rover?null:step.site??null,target,distance,atTarget,
    stepIndex:progress?remaining<0?progress.objectives.length:remaining+1:0,stepCount:progress?.objectives.length??0,
    optional:step.optional??false,travelHint:travelHint(step,context,atTarget,target)};
}

function chargeStep(state:ElysiumState):Step {
  if(state.choices.grid==='reserve')return training('grid-plan','Give the rover some power','At the command terminal, move energy cells to the rover or share them. A reserve-only plan does not charge it.');
  if(!state.roverDocked)return {id:'park-to-charge',kind:'charge',site:'garage',title:'Park the rover to charge',action:'Return to the garage',
    detail:'Stop in the marked return bay, get out, then use Park rover inside. The dock can charge a parked rover.',intent:{type:'world',action:'park-rover'}};
  return actionStep('advance-sol','Rest while the rover charges',state.choices.grid==='greenhouse'&&!has(state,'next-day-charge')
    ?'Your plants-first plan charges the rover on the next sol. Leave it parked, then rest at the command terminal.'
    :'Leave the rover in its dock. At the command terminal, rest to begin the next sol with more charge.','command','charge');
}

function roverStep(state:ElysiumState,context:GuidanceContext):Step {
  const minimum=Math.min(...Object.values(content.simulation.routes).map(route=>route.minimumCharge));
  if(!state.choices.route){
    if(state.resources.roverCharge<minimum)return chargeStep(state);
    return training('route-plan','Plan your rover trip',`At the garage terminal, trace a route to the field sensor. The shortest route needs ${minimum}% battery.`);
  }
  if(state.resources.roverCharge<=0)return actionStep('recover-rover','Get a spare rover power cell','Walk to the garage terminal and request a return reserve. Your mission progress is safe.','garage','charge');
  if(state.roverDocked||context.garagePhase&&context.garagePhase!=='outside')return {id:'deploy-rover',kind:'travel',site:'garage',title:'Bring the rover outside',action:'Use the garage controls',
    detail:'Choose Bring rover out. Let it finish rolling out before you get in.',intent:{type:'world',action:'deploy-rover'}};
  if(context.roverDriving===false){
    const known=finite(context.roverX)&&finite(context.roverZ);
    return {id:'board-rover',kind:'travel',...(known?{rover:true}:{site:'garage' as SiteId}),title:'Get in the crew rover',action:'Enter the rover',
      detail:'Walk beside your crew rover. Use F or the Enter rover button, then follow the route to the sensor.',intent:{type:'world',action:'drive'}};
  }
  return {id:'drive-to-sensor',kind:'travel',site:'field-sensor',title:'Drive to the field sensor',action:'Follow the marked route',
    detail:'Take the crew rover to marker 8. Arriving on foot alone does not finish this driving step.',intent:{type:'world',action:'drive'}};
}

/** Read-only guidance: choose one useful next step without advancing resources or changing a save. */
export function nextElysiumGuidance(state:ElysiumState,context:GuidanceContext={}):ElysiumGuidance {
  const available=availableMissions(state);
  const selected=context.selectedMission&&available.includes(context.selectedMission)?context.selectedMission:available[0]??null;
  const output=(step:Step,missionId:MissionId|null=selected)=>{
    if(step.site&&!state.visited.includes(step.site)&&(step.intent.type==='training'||step.intent.type==='solar')){
      return finish(state,missionId,{...step,id:`arrive-${step.site}-${step.id}`,kind:'visit',action:'Use this station',intent:{type:'visit',siteId:step.site}},context);
    }
    return finish(state,missionId,step,context);
  };
  if(state.phase==='briefing')return output({id:'begin',kind:'briefing',title:'Start your Mars adventure',action:'Read the short briefing',detail:'Meet Kaelen and choose whether to watch the launch.',intent:{type:'panel',panel:'prologue'}},null);
  if(state.test.stage==='fault'){
    if(state.test.fault==='pump'){
      if(!state.test.pumpRestarted){
        if(!has(state,'pump-visited'))return output(station('lab','Check the stopped water pump','Go into the habitat lab and use its station. Then repair the water path.'),'m7');
        return output(training('fault-pump'),'m7');
      }
      return output(training('fault-water','Keep water for the cabin'),'m7');
    }
    return output(training(state.test.fault==='heater'?'fault-heater':'fault-scrubber'),'m7');
  }
  if(state.test.stage==='resolved')return output(actionStep('advance-test','See how the base did','Return to the command terminal and advance the rehearsal to sunrise.'),'m7');
  if(state.test.stage==='safe')return output(actionStep('retry-test','Try the rehearsal again','Your completed missions and journal are safe. Restore the test supplies, adjust your plan, then try again.'),'m7');
  if(state.phase==='ready')return state.finalLog
    ?output({id:'explore',kind:'explore',title:'Your outpost is ready',action:'Keep exploring',detail:'All seven missions are logged. Explore Mars or practise a workbench without changing your progress.',intent:{type:'world',action:'explore'}},null)
    :output({id:'final-log',kind:'ending',title:'Send your final message',action:'Open your mission ending',detail:'Choose Kaelen’s final line, then enjoy the view of the outpost you prepared.',intent:{type:'panel',panel:'ending'}},'m7');
  if(!selected)return output({id:'explore',kind:'explore',title:'Explore the outpost',action:'Keep exploring',detail:'Use your map to find the outpost and rover.',intent:{type:'world',action:'explore'}},null);
  if(missionProgress(state,selected).readyToLog)return output({id:`log-${selected}`,kind:'log',title:'You finished this mission’s jobs',action:'Write the mission log',detail:'Choose one short journal line to finish this mission and see what comes next.',intent:{type:'log',missionId:selected}});

  if(selected==='m1'){
    if(!state.visited.includes('airlock'))return output(station('airlock','Go into your Mars home','Follow marker 1 to the habitat ramp. Open the airlock door with E or the door button.'));
    if(!state.visited.includes('command'))return output(station('command','Find the command terminal','Inside the habitat, use marker 2 to check the base and try unpacking its supplies.'));
    if(context.currentSiteId==='command'&&!has(state,'cargo-read'))return output({...training('cargo-read','Try unpacking the supplies'),optional:true});
    if(!state.visited.includes('garage'))return output(station('garage','Find your rover garage','Leave through the habitat airlock and follow marker 7. Use the garage planning terminal.'));
    return output(station('greenhouse1','Visit the space garden','Follow marker 5 to Greenhouse 1. Open its airlock, then use the growing station.'));
  }
  if(selected==='m2'){
    if(!has(state,'solar-trace'))return output(training('solar-trace'));
    if(!has(state,'solar-connect'))return output({id:'solar-connect',kind:'solar',site:'solar',title:'Reconnect the solar wires',action:'Open the wire repair',detail:'Isolate power, then match the four wires by their letters and shapes.',intent:{type:'solar',taskId:'solar-connect'}});
    if(!has(state,'solar-clean'))return output({id:'solar-clean',kind:'solar',site:'solar',title:'Brush the dusty solar panels',action:'Open the cleaning brush',detail:'Sweep every part of the panel so sunlight can reach the cells.',intent:{type:'solar',taskId:'solar-clean'}});
    return output(training('grid-plan','Share your recovered power','Go inside to the command terminal. Give the five movable energy cells a job.'));
  }
  if(selected==='m3'){
    if(!has(state,'water-compare'))return output(training('water-compare'));
    if(!state.choices.water){
      if(context.currentSiteId==='lab'&&!has(state,'water-calibrate'))return output({...training('water-calibrate'),optional:true});
      return output(training('water-plan'));
    }
    if(!state.choices.oxygen)return output(training('oxygen-plan'));
    return output(training('air-plan'));
  }
  if(selected==='m4'){
    if(!state.visited.includes('greenhouse1'))return output(station('greenhouse1','Find the growing trays','Open Greenhouse 1 and use its station.'));
    if(!state.choices.greenhouse)return output(training('plant-plan'));
    return output(training('forecast-review'));
  }
  if(selected==='m5'){
    if(!has(state,'field-arrival'))return output(roverStep(state,context));
    if(!has(state,'sensor-restore'))return output(training('sensor-restore'));
    if(!has(state,'sample-collect'))return output(training('sample-collect'));
    return output(training('sample-analyse','Bring your samples to the lab','Return to the habitat lab at marker 4. Sort the rocks by what you can see.'));
  }
  if(selected==='m6'){
    if(!has(state,'archive-review'))return output(training('archive-review'));
    if(!has(state,'ventilation-check'))return output(training('ventilation-check'));
    if(!has(state,'shelter-power'))return output(training('shelter-power'));
    return output(training('shield-plan','Compare shelter layers','Test the shelter, then choose an affordable layer plan. Keeping the existing structure is a valid plan.'));
  }
  if(!has(state,'plan-submit'))return output(training('plan-submit'));
  if(!state.choices.contingency)return output(training('backup-plan'));
  if(!has(state,'review-ack'))return output(training('review-ack'));
  // This uses explicit steps rather than a timer; the base waits for the player.
  return output(actionStep('start-test','Try one night at the outpost','At the command terminal, begin the rehearsal. Nothing counts down while you decide what to do.'));
}
