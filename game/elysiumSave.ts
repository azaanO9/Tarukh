import content from '../content/elysiumMissions.json' with { type: 'json' };
import { CHOICE_IDS, FINAL_LOGS, MISSION_IDS, SITE_IDS, TASK_IDS, type ElysiumResources, type ElysiumState } from './elysiumMission.ts';

export const ELYSIUM_SAVE_KEY='tarukh.elysium.v1';
export type ElysiumStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const number=(value:unknown,min:number,max:number):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const integer=(value:unknown,min:number,max:number):value is number=>number(value,min,max)&&Number.isInteger(value);
const text=(value:unknown,max=2000):value is string=>typeof value==='string'&&value.length<=max;
const listed=(value:unknown,choices:readonly string[]):value is string=>typeof value==='string'&&choices.includes(value);
function list(value:unknown,choices:readonly string[],limit:number):value is string[]{
  return Array.isArray(value)&&value.length<=limit&&new Set(value).size===value.length&&value.every(item=>listed(item,choices));
}
function resources(value:unknown):value is ElysiumResources {
  return record(value)&&['power','water','oxygen','co2','food','roverCharge','shelter'].every(key=>number(value[key],0,100))&&number(value.dose,0,100000);
}

/** Reject incomplete, incompatible or tampered saves before they reach the simulation. */
export function parseElysiumSave(raw:string|null):ElysiumState|null {
  if(!raw||raw.length>50000)return null;
  try{
    const s:unknown=JSON.parse(raw);
    if(!record(s)||s.version!==1||!listed(s.phase,['briefing','active','ready'])||!integer(s.sol,1,100000)||!integer(s.seed,0,0xffffffff)||!integer(s.roverRevision,0,1000000000)||typeof s.roverDocked!=='boolean'||!resources(s.resources))return null;
    if(!record(s.choices)||!Object.entries(CHOICE_IDS).every(([key,ids])=>s.choices&&record(s.choices)&&(s.choices[key]===null||listed(s.choices[key],ids))))return null;
    if(!Array.isArray(s.greenhouses)||s.greenhouses.length!==2||!s.greenhouses.every(g=>record(g)&&number(g.light,0,24)&&number(g.water,0,100)))return null;
    if(!list(s.visited,SITE_IDS,SITE_IDS.length)||!list(s.tasks,TASK_IDS,TASK_IDS.length)||!list(s.completed,MISSION_IDS,7))return null;
    if(!record(s.test)||!listed(s.test.stage,['idle','fault','resolved','safe','passed'])||!(s.test.fault===null||listed(s.test.fault,['heater','scrubber','pump']))
      ||!integer(s.test.attempts,0,100000)||typeof s.test.pumpRestarted!=='boolean'||!(s.test.checkpoint===null||resources(s.test.checkpoint)))return null;
    if(s.test.stage!=='idle'&&(s.test.fault===null||s.test.checkpoint===null||s.test.attempts<1))return null;
    if(s.lastOutcome!==null&&(!record(s.lastOutcome)||!text(s.lastOutcome.decision)||!text(s.lastOutcome.outcome)||!text(s.lastOutcome.why)))return null;
    const closing=(content as unknown as {finalLogOptions?:string[]}).finalLogOptions??FINAL_LOGS;
    if(s.finalLog!==null&&(!listed(s.finalLog,closing)||s.phase!=='ready'))return null;
    if(!Array.isArray(s.logs)||s.logs.length!==s.completed.length||s.logs.length>7)return null;
    const logIds=new Set<string>();
    for(const log of s.logs){
      if(!record(log)||!listed(log.missionId,MISSION_IDS)||!s.completed.includes(log.missionId)||logIds.has(log.missionId)
        ||!integer(log.choiceId,0,2)||!integer(log.sol,1,s.sol))return null;
      const mission=content.missions.find(item=>item.id===log.missionId);
      if(!mission||log.text!==mission.logOptions[log.choiceId])return null;
      logIds.add(log.missionId);
    }
    const complete=(id:string)=>s.completed instanceof Array&&s.completed.includes(id);
    if((complete('m2')&&!complete('m1'))||(['m3','m4','m5'].some(complete)&&!complete('m2'))
      ||(complete('m6')&&!['m3','m4','m5'].every(complete))||(complete('m7')&&!complete('m6')))return null;
    if((s.phase==='ready')!==complete('m7')||(s.phase==='briefing'&&(s.completed.length||s.visited.length||s.tasks.length)))return null;
    return s as unknown as ElysiumState;
  }catch{return null;}
}

function storageOrThrow(storage?:ElysiumStorage):ElysiumStorage {
  if(storage)return storage;
  if(typeof localStorage==='undefined')throw new Error('Browser storage is unavailable.');
  return localStorage;
}
export function loadElysiumSave(storage?:ElysiumStorage):{state:ElysiumState|null;error:string|null} {
  try{
    const raw=storageOrThrow(storage).getItem(ELYSIUM_SAVE_KEY),state=parseElysiumSave(raw);
    return {state,error:raw&&!state?'The saved story could not be read. It has not been erased.':null};
  }catch{return {state:null,error:'Story saving is unavailable in this browser. You can still play this session.'};}
}
export function saveElysiumSave(state:ElysiumState,storage?:ElysiumStorage):{ok:boolean;error:string|null} {
  try{
    const raw=JSON.stringify(state);
    if(!parseElysiumSave(raw))return {ok:false,error:'The story state could not be saved. The previous save is unchanged.'};
    storageOrThrow(storage).setItem(ELYSIUM_SAVE_KEY,raw);
    return {ok:true,error:null};
  }catch{return {ok:false,error:'This browser could not save the story. Keep this tab open to continue this session.'};}
}
export function clearElysiumSave(storage?:ElysiumStorage):{ok:boolean;error:string|null} {
  try{storageOrThrow(storage).removeItem(ELYSIUM_SAVE_KEY);return {ok:true,error:null};}
  catch{return {ok:false,error:'The previous story save could not be removed.'};}
}
