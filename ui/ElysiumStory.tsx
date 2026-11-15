"use client";

import {lazy,Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import MarsFreeRoam from './MarsFreeRoam';
import type {View} from './MarsWorld';
import {
  createElysiumState,reduceElysium,availableMissions,missionProgress,
  actionAllowed,actionSite,activityAvailable,trainingAvailable,trainingCompleted,trainingForAction,trainingAllowedChoices,readinessSummary,worldBindings,
  type ElysiumState,type ElysiumAction,type MissionId,type SiteId,SITE_IDS,
} from '../game/elysiumMission';
import {loadElysiumSave,saveElysiumSave,clearElysiumSave} from '../game/elysiumSave';
import {isActivityTaskId,validateActivityProof,type ActivityTaskId,type ActivityProof} from '../game/missionActivities';
import {trainingDefinition,validateTrainingProof,type TrainingId,type TrainingProof} from '../game/trainingActivities';
import {ELYSIUM_SITES,ELYSIUM_ROUTES} from '../game/elysiumSites';
import {MARS_REGION,REGION_WORLD_BOUNDS} from '../game/marsRegion';
import {assetUrl} from '../lib/assetUrl';
import type {ElysiumWorldBridge} from '../game/elysiumWorld';
import content from '../content/elysiumMissions.json';
import './elysium.css';

const MissionActivity=lazy(()=>import('./MissionActivity'));
const TrainingWorkshop=lazy(()=>import('./TrainingWorkshop'));
const LifeSupportGames=lazy(()=>import('./LifeSupportGames'));
type OpenActivity=({family:'solar';taskId:ActivityTaskId}|{family:'training';activityId:TrainingId})&{practice:boolean;returnTo:'site'|'test'};
type Panel='resume'|'prologue'|'time-jump'|'brief'|'missions'|'site'|'activity'|'science'|'journal'|'log'|'restart'|'test'|'ending'|'heritage'|null;
type ChoiceGroup=keyof typeof content.choices;
const missionIds:MissionId[]=['m1','m2','m3','m4','m5','m6','m7'];
const groupNames:Record<ChoiceGroup,string>={grid:'Share the power',water:'Clean water',oxygen:'Make breathing air',scrubber:'Clean the cabin air',greenhouse:'Care for the plants',route:'Plan a rover trip',sensor:'Fix the field sensor',shielding:'Build a shelter',contingency:'Pack a backup'};
const siteName=(id:string|null)=>ELYSIUM_SITES.find(site=>site.id===id)?.label??'Command terminal';
const taskAction=(taskId:string)=>({type:'task',taskId} as ElysiumAction);
const choiceAction=(group:ChoiceGroup,choiceId:string)=>({type:'choose',group,choiceId} as ElysiumAction);
const missionContent=(id:MissionId)=>content.missions.find(mission=>mission.id===id)!;
const newExpedition=()=>createElysiumState(globalThis.crypto?.getRandomValues(new Uint32Array(1))[0]??Date.now());

function MissionActionButton({action,label,enabled,location,onAction}:{action:ElysiumAction;label:string;enabled:boolean;location:SiteId|null;onAction:(action:ElysiumAction)=>void}){
  return <button className="ely-primary" disabled={!enabled} onClick={()=>onAction(action)}>{label}{location&&<small>Walk to {siteName(location)}</small>}</button>;
}

function nextSite(state:ElysiumState,id:MissionId){
  if(state.test.stage==='fault'&&state.test.fault==='pump'&&!state.test.pumpRestarted)return 'lab';
  if(id==='m1')return (['airlock','command','garage','greenhouse1'] as const).find(site=>!state.visited.includes(site))??'command';
  if(id==='m2')return state.completed.includes('m2')||(state.tasks.includes('solar-connect')&&state.tasks.includes('solar-clean'))?'command':'solar';
  if(id==='m3')return 'lab';
  if(id==='m4')return 'greenhouse1';
  if(id==='m5')return !state.choices.route?'garage':!state.tasks.includes('sample-collect')?'field-sensor':'lab';
  if(id==='m6')return state.tasks.includes('archive-review')?'shelter':'command';
  return 'command';
}

function ResourceReadout({state}:{state:ElysiumState}){
  const values=[['⚡ Power',state.resources.power],['◉ Water',state.resources.water],['O₂ Breathing air',state.resources.oxygen],['CO₂ Used air',state.resources.co2],['▰ Rover battery',state.resources.roverCharge],['⬟ Shelter',state.resources.shelter],['♧ Food',state.resources.food]] as const;
  return <><dl className="ely-resources">{values.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{Math.round(value)}%</dd><meter aria-label={label} min={0} max={100} value={value}/></div>)}</dl><p className="ely-caption">Keep supplies ready and used air low. These are game meters. Take your time!</p></>;
}

function ReadinessForecast({summary}:{summary:ReturnType<typeof readinessSummary>}){
  const estimate=summary.forecastInfo,draw=summary.nightDemand;
  return <details className="ely-experiment" aria-label="Simulated overnight forecast">
    <summary>Overnight forecast · {estimate.powerMin}–{estimate.powerMax} power points · {estimate.confidence}</summary>
    <h3>What your plan needs overnight</h3>
    <p><strong>{estimate.confidence}</strong> · {estimate.solar}.</p>
    <p>Expected power use through sunrise: <strong>{estimate.powerMin}–{estimate.powerMax} reserve points</strong>, before the separate equipment fault.</p>
    <p>{estimate.explanation}</p>
    <dl className="ely-decisions">
      <div><dt>Crop lights · first night step</dt><dd>{draw.cropPower.toFixed(1)} power points</dd></div>
      <div><dt>Docked rover charging</dt><dd>{draw.chargerPower.toFixed(1)} power points</dd></div>
      {summary.roverMaintenance&&<div><dt>Rough-route maintenance</dt><dd>{draw.maintenancePower.toFixed(1)} power points · park the rover in its garage to clear this load</dd></div>}
      <div><dt>Your backup saves</dt><dd>{draw.backupSaving.toFixed(1)} power points</dd></div>
      <div><dt>Water use · first night step</dt><dd>{draw.water.toFixed(1)} reserve points</dd></div>
      <div><dt>Oxygen · first night step</dt><dd>{Math.abs(draw.oxygen).toFixed(1)} points {draw.oxygen<0?'added':'used'}</dd></div>
      <div><dt>CO₂ indicator · first night step</dt><dd>{Math.abs(draw.co2).toFixed(1)} points {draw.co2<0?'lower':'higher'}</dd></div>
    </dl>
    <p className="ely-caption">Simulated planning units on a 0–100 scale. These are not measured mission rates or a countdown. Different system settings change this forecast.</p>
  </details>;
}

function RouteDiagram({selected}:{selected:string|null}){
  const bounds=REGION_WORLD_BOUNDS;
  const colors=['#ffc169','#85d9f0','#ded0ff'];
  return <figure className="ely-route">
    <svg viewBox="-145 -160 485 520" role="img" aria-labelledby="ely-route-title ely-route-desc">
      <title id="ely-route-title">NASA terrain and three proposed rover routes</title>
      <desc id="ely-route-desc">North-up NASA MOLA shaded relief, using the same local image and coordinates as the field map. The direct route is solid, ridge dashed, and valley dotted. These are fictional compressed planning routes.</desc>
      <defs><pattern id="ely-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#fff" opacity=".15"/></pattern></defs>
      <image href={assetUrl('art/mars-mola-overview.webp')} x={bounds.west} y={bounds.north} width={bounds.east-bounds.west} height={bounds.south-bounds.north} preserveAspectRatio="none"/>
      <rect x="-145" y="-160" width="485" height="520" fill="#051019" opacity=".3"/>
      <rect x="-145" y="-160" width="485" height="520" fill="url(#ely-grid)"/>
      {Object.entries(ELYSIUM_ROUTES).map(([id,points],index)=>{
        const path=points.map(point=>`${point.x},${point.z}`).join(' ');
        return <g key={id} opacity={!selected||selected===id?1:.65}>
          <polyline points={path} fill="none" stroke="#101c22" strokeWidth={selected===id?9:6} vectorEffect="non-scaling-stroke"/>
          <polyline points={path} fill="none" stroke={colors[index]} strokeWidth={selected===id?5:3} strokeDasharray={index===0?'none':index===1?'10 5':'3 7'} vectorEffect="non-scaling-stroke"/>
        </g>;
      })}
      <g className="ely-map-labels">
        <circle cx="26" cy="-13" r="7" fill="#fff"/><text x="38" y="-18">Garage</text>
        <circle cx="230" cy="180" r="7" fill="#fff"/><text x="185" y="210">Field sensor</text>
        <text x="-125" y="-130">N ↑</text>
        <path d="M-125 332v8h100v-8" fill="none" stroke="#fff" strokeWidth="2"/>
        <text x="-125" y="323">100 game metres</text>
      </g>
    </svg>
    <figcaption>
      <strong>NASA MOLA elevation · {MARS_REGION.scaleLabel}</strong>
      <ul className="ely-route-legend">{content.choices.route.map((route,index)=><li key={route.id}>
        <span aria-hidden="true" style={{borderColor:colors[index],borderTopStyle:index===0?'solid':index===1?'dashed':'dotted'}}/>
        {route.label}: about {route.playableDistanceM} m in play · {route.planningDistanceKm} km fictional planning distance.
      </li>)}</ul>
      <p>This local shaded-relief image shows measured elevations, not photography. Proposed routes and planning distances are game assumptions.</p>
      <p>Live simulated LiDAR appears on the minimap and rover display while you explore. This paused planning view does not invent sensor returns. Caps Lock / Atlas opens the full NASA field map.</p>
    </figcaption>
  </figure>;
}

export default function ElysiumStory({controlMode,onExit,launchNew=false}:{controlMode:'pc'|'mobile';onExit:()=>void;launchNew?:boolean}){
  const [initial]=useState(()=>loadElysiumSave());
  const [state,setState]=useState<ElysiumState>(()=>initial.state??newExpedition());
  const stateRef=useRef(state);
  const [worldSeed,setWorldSeed]=useState(state.seed);
  const [session,setSession]=useState(0);
  const [panel,setPanel]=useState<Panel>(initial.state?(launchNew?'restart':'resume'):'prologue');
  const [activity,setActivity]=useState<OpenActivity|null>(null);
  const [selected,setSelected]=useState<MissionId>(()=>availableMissions(state).find(id=>!state.completed.includes(id))??(state.phase==='ready'?'m7':'m1'));
  const [site,setSite]=useState('command');
  const [view,setView]=useState<View|null>(null);
  const viewRef=useRef<View|null>(null);
  const [arrival,setArrival]=useState<'earth'|'none'>('none');
  const [saveError,setSaveError]=useState<string|null>(initial.error??null);
  const [feedback,setFeedback]=useState(0);
  const [heritage,setHeritage]=useState('curiosity');
  const [tutorial,setTutorial]=useState(!initial.state);
  const [hudDetails,setHudDetails]=useState(controlMode==='pc');
  const [endingView,setEndingView]=useState(false);
  const [quietView,setQuietView]=useState(false),[quietCaption,setQuietCaption]=useState(false);
  const dialog=useRef<HTMLElement>(null),returnFocus=useRef<HTMLElement|null>(null);
  const progress=missionProgress(state,selected),mission=missionContent(selected);
  const available=availableMissions(state);
  const unlocked=missionIds.filter(id=>available.includes(id)||state.completed.includes(id));
  const summary=readinessSummary(state);
  const ending=content.endings[summary.outcome.toLowerCase() as keyof typeof content.endings];
  const fault=content.faults.find(item=>item.id===state.test.fault);
  const target=nextSite(state,selected),targetPoint=ELYSIUM_SITES.find(item=>item.id===target);

  const perform=useCallback((action:ElysiumAction)=>{
    const previous=stateRef.current;
    if(!actionAllowed(previous,action))return;
    const next=reduceElysium(previous,action);stateRef.current=next;setState(next);
    if(next.lastOutcome!==previous.lastOutcome&&action.type!=='greenhouse-settings')setFeedback(value=>value+1);
  },[]);

  const interact=useCallback((siteId:string)=>{
    if(viewRef.current?.storySite!==siteId||!(SITE_IDS as readonly string[]).includes(siteId))return;
    perform({type:'visit',siteId:siteId as SiteId,roverDriving:viewRef.current.roverDriving});setSite(siteId);setPanel('site');
  },[perform]);
  const inspect=useCallback((id:string)=>{setHeritage(id);setPanel('heritage');},[]);
  const updateView=useCallback((next:View)=>{
    viewRef.current=next;setView(next);
    const current=stateRef.current;
    if(current.phase==='briefing'||next.storyRevision!==current.roverRevision||next.roverBattery===undefined)return;
    const updated=reduceElysium(current,{type:'sync-world',revision:next.storyRevision,roverCharge:next.roverBattery,dose:next.radiationExposure,roverDriving:next.roverDriving,roverSpeed:next.roverSpeed,siteId:next.storySite??undefined,garagePhase:next.garagePhase});
    if(updated!==current){stateRef.current=updated;setState(updated);}
  },[]);

  useEffect(()=>{
    let saved: ElysiumState|null=initial.state;
    const persist=()=>{
      const current=stateRef.current;
      if(current.phase==='briefing'||current===saved)return;
      const result=saveElysiumSave(current);setSaveError(result.error??null);
      if(result.ok)saved=current;
    };
    const timer=window.setInterval(persist,2000);
    window.addEventListener('pagehide',persist);
    const visibility=()=>{if(document.hidden)persist();};document.addEventListener('visibilitychange',visibility);
    return()=>{persist();window.clearInterval(timer);window.removeEventListener('pagehide',persist);document.removeEventListener('visibilitychange',visibility);};
  },[initial.state]);

  useEffect(()=>{
    if(!quietView)return;
    const timer=window.setTimeout(()=>setQuietCaption(true),3500);
    return()=>window.clearTimeout(timer);
  },[quietView]);

  const close=useCallback(()=>{
    if(panel==='prologue'||panel==='resume'){onExit();return;}
    if(panel==='time-jump'){setSelected('m1');setPanel('brief');return;}
    if(panel==='activity'){setPanel(activity?.returnTo??'site');setActivity(null);return;}
    setPanel(null);
  },[panel,onExit,activity?.returnTo]);
  useEffect(()=>{
    if(!panel){
      if(returnFocus.current){const previous=returnFocus.current;returnFocus.current=null;requestAnimationFrame(()=>{if(previous.isConnected&&previous!==document.body&&!previous.hasAttribute('disabled')&&previous.getClientRects().length)previous.focus();else document.querySelector<HTMLElement>('.sv-world')?.focus();});}
      return;
    }
    if(!returnFocus.current)returnFocus.current=document.activeElement as HTMLElement|null;
    document.exitPointerLock?.();
    const frame=requestAnimationFrame(()=>dialog.current?.querySelector<HTMLElement>(panel==='ending'&&state.finalLog?'[data-ely-ending]':'[data-ely-focus]')?.focus());
    const keys=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
      if(event.key!=='Tab')return;
      const items=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')??[]).filter(element=>element.getClientRects().length>0);
      const first=items[0],last=items.at(-1);
      if(!first){event.preventDefault();return;}
      if(event.shiftKey&&(document.activeElement===first||!dialog.current?.contains(document.activeElement)||(document.activeElement as HTMLElement)?.hasAttribute('data-ely-focus'))){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!dialog.current?.contains(document.activeElement))){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',keys,true);
    return()=>{cancelAnimationFrame(frame);document.removeEventListener('keydown',keys,true);};
  },[panel,selected,state.finalLog,close]);
  useEffect(()=>{
    if(!feedback)return;
    const frame=requestAnimationFrame(()=>dialog.current?.querySelector<HTMLElement>('[data-ely-feedback]')?.focus());
    return()=>cancelAnimationFrame(frame);
  },[feedback]);

  const begin=(watch:boolean)=>{perform({type:'begin'});setArrival(watch?'earth':'none');setPanel(watch?null:'time-jump');};
  const finishArrival=useCallback(()=>{if(arrival==='earth'){setArrival('none');setPanel('time-jump');}},[arrival]);
  const reset=()=>{
    const result=clearElysiumSave();setSaveError(result.error??null);
    const fresh=newExpedition();stateRef.current=fresh;setState(fresh);setWorldSeed(fresh.seed);setSelected('m1');setArrival('none');setSession(value=>value+1);setTutorial(true);setEndingView(false);setQuietView(false);setPanel('prologue');
  };
  const recordLog=(choiceId:0|1|2)=>{
    perform({type:'log',missionId:selected,choiceId});
    const next=availableMissions(stateRef.current)[0];
    if(next)setSelected(next);
    setPanel(stateRef.current.phase==='ready'?'ending':'missions');
  };
  const atAction=(action:ElysiumAction)=>{
    const location=actionSite(action);
    return !location||view?.storySite===location;
  };
  const readyAction=(action:ElysiumAction)=>actionAllowed(state,action)&&atAction(action);
  const actionButton=(action:ElysiumAction,label:string)=>{
    const game=trainingForAction(action);
    if(game)return trainingButton(game,label);
    const location=actionSite(action);
    return <MissionActionButton action={action} label={label} enabled={readyAction(action)} location={location&&!atAction(action)?location:null} onAction={perform}/>;
  };
  const startActivity=(taskId:ActivityTaskId,practice=false)=>{
    if(viewRef.current?.storySite!=='solar')return;
    const current=stateRef.current;
    const canPractice=taskId!=='clear-panels'&&(current.tasks.includes(taskId)||current.completed.includes('m2'));
    if(practice?!canPractice:!activityAvailable(current,taskId))return;
    setActivity({family:'solar',taskId,practice,returnTo:'site'});setPanel('activity');
  };
  const completeActivity=(proof:ActivityProof)=>{
    if(!activity||activity.family!=='solar'||viewRef.current?.storySite!=='solar'||!validateActivityProof(activity.taskId,proof))return;
    if(!activity.practice){
      const action:ElysiumAction={type:'complete-activity',taskId:activity.taskId,proof};
      if(!actionAllowed(stateRef.current,action))return;
      perform(action);
    }
    setActivity(null);setPanel('site');
  };
  const activityButton=(taskId:ActivityTaskId,label:string,practice=false)=>
    <button className="ely-primary" data-activity-task={taskId} disabled={view?.storySite!=='solar'||(!practice&&!activityAvailable(state,taskId))} onClick={()=>startActivity(taskId,practice)}>{label}{view?.storySite!=='solar'&&<small>Walk to {siteName('solar')}</small>}</button>;
  function startTraining(activityId:TrainingId,practice=false){
    const definition=trainingDefinition(activityId);
    if(viewRef.current?.storySite!==definition.site)return;
    if(practice?!trainingCompleted(stateRef.current,activityId):!trainingAvailable(stateRef.current,activityId))return;
    setActivity({family:'training',activityId,practice,returnTo:panel==='test'?'test':'site'});setPanel('activity');
  }
  function completeTraining(proof:TrainingProof){
    if(activity?.family!=='training')return;
    if(viewRef.current?.storySite!==trainingDefinition(activity.activityId).site||!validateTrainingProof(activity.activityId,proof))return;
    if(!activity.practice){
      const action:ElysiumAction={type:'complete-training',activityId:activity.activityId,proof};
      if(!actionAllowed(stateRef.current,action))return;
      perform(action);
    }
    setPanel(activity.returnTo);setActivity(null);
  }
  function trainingButton(activityId:TrainingId,label?:string,practice=false){
    const definition=trainingDefinition(activityId),near=view?.storySite===definition.site;
    const available=practice?trainingCompleted(state,activityId):trainingAvailable(state,activityId);
    const hint=activityId==='route-plan'?(state.tasks.includes('field-arrival')?'This trip’s route is already recorded.':'Charge the rover in its garage first.'):activityId==='sensor-restore'?'Drive your rover to the field sensor first.':activityId==='shield-plan'?'Connect the shelter backup power first.':activityId==='forecast-review'?'Plant a space garden first.':state.test.stage==='fault'||state.test.stage==='resolved'?'Finish the current night repair first.':'Complete the earlier station jobs first.';
    return <button className="ely-primary" data-training-activity={activityId} disabled={!near||!available} onClick={()=>startTraining(activityId,practice)}>{label??`Play · ${definition.title}`}{!near?<small>Walk to {siteName(definition.site)}</small>:!available&&<small>{hint}</small>}</button>;
  }
  const finishEnding=useCallback(()=>{setEndingView(false);requestAnimationFrame(()=>document.querySelector<HTMLElement>('.sv-world')?.focus());},[]);
  const world=useMemo<ElysiumWorldBridge>(()=>({
    sessionId:`elysium-${worldSeed}-${session}`,command:worldBindings(state),
    targetSiteId:target,route:state.choices.route??undefined,onInteract:interact,
    routePoints:state.choices.route?ELYSIUM_ROUTES[state.choices.route]:undefined,
    ending:endingView,onEndingComplete:finishEnding,
  }),[session,worldSeed,state,endingView,target,interact,finishEnding]);

  function choices(group:ChoiceGroup){
    if(group==='sensor')return null;
    const activityId=trainingForAction(choiceAction(group,content.choices[group][0].id));
    if(!activityId)return null;
    const definition=trainingDefinition(activityId),chosen=content.choices[group].find(option=>option.id===state.choices[group]);
    return <article className="ely-task ely-play-card" key={group}><span className="ely-eyebrow">HANDS-ON JOB</span><h4>{definition.title}</h4><p>{definition.instruction}</p>{chosen&&<p className="ely-caption">Your plan: {chosen.label}. Play again to change it.</p>}{trainingButton(activityId)}<details className="ely-more"><summary>What do the different plans do?</summary>{content.choices[group].map(option=><p key={option.id}><strong>{option.label}</strong> · {option.outcome}</p>)}</details></article>;
  }
  function taskCard(id:string){
    const item=content.tasks[id as keyof typeof content.tasks];if(!item)return null;
    const action=taskAction(id),done=state.tasks.includes(id)||(id==='solar-clean'&&state.completed.includes('m2'));
    const trainingId=trainingForAction(action);
    const play=isActivityTaskId(id)?activityButton(id,done?'Play again · practice':`Play · ${item.label}`,done):trainingId?trainingButton(trainingId,done?'Play again · practice':undefined,done):actionButton(action,item.label);
    const explanation=<details className="ely-more"><summary>Why it works</summary><p>{item.why}</p>{id==='cargo-read'&&<blockquote>{content.statusText.cargoManifest}</blockquote>}{id==='archive-review'&&<p>{content.statusText.archiveNotice} <a href={content.sources.sep2017Mars.url} target="_blank" rel="noreferrer">NASA event record ↗</a></p>}</details>;
    if(done)return <details className="ely-task ely-finished" key={id}><summary>✓ {item.label}</summary><p>{item.outcome}</p>{play}{explanation}</details>;
    return <article className="ely-task ely-play-card" key={id}><span className="ely-eyebrow">HANDS-ON JOB</span><h4>{trainingId?trainingDefinition(trainingId).title:item.label}</h4>{trainingId&&<p>{trainingDefinition(trainingId).instruction}</p>}{play}{explanation}</article>;
  }
  function missionWork(id:MissionId,filterSite?:string){
    const definition=missionContent(id);
    const taskIds=definition.taskIds.filter(task=>!filterSite||actionSite(taskAction(task))===filterSite);
    const choiceGroups=(definition.choiceGroups as ChoiceGroup[]).filter(group=>!filterSite||actionSite(choiceAction(group,content.choices[group][0].id))===filterSite);
    if(!taskIds.length&&!choiceGroups.length&&!(id==='m4'&&filterSite==='greenhouse2'))return null;
    return <section className="ely-work" key={id}><h3>{missionContent(id).title}</h3>
      {id==='m4'&&choiceGroups.map(choices)}{taskIds.map(taskCard)}{id!=='m4'&&choiceGroups.map(choices)}
      {id==='m5'&&choiceGroups.includes('route')&&<details className="ely-more"><summary>See the full route map</summary><RouteDiagram selected={state.choices.route}/></details>}
      {id==='m4'&&<><p>Plants need light and water together. Your game tray shows a sped-up preview; real crops take weeks.</p>{filterSite==='greenhouse2'&&<p>Walk to Greenhouse 1 to use the growing tablet.</p>}<button onClick={()=>{setPanel(null);setTutorial(false);setQuietCaption(false);setQuietView(true);}}>Look around the greenhouse</button></>}
      {id==='m6'&&<details className="ely-more"><summary>Look closer at the shelter test</summary><p>Thicker shielding reduces extra exposure; it cannot remove earlier exposure. These are made-up game estimates, not measured doses.</p>{actionButton({type:'run-drill'},'Try the shelter test')}<p>Outside {summary.radiation.outside} · Habitat {summary.radiation.habitat} · Shelter {summary.radiation.shelter} mSv for the same game test.</p></details>}
      {missionProgress(state,id).readyToLog&&<button className="ely-primary" onClick={()=>{setSelected(id);setPanel('log');}}>Finish mission · add to my journal</button>}
    </section>;
  }
  const training=activity?.family==='training'?trainingDefinition(activity.activityId):null;
  const title=panel==='activity'?(training?.title??(activity?.family==='solar'&&activity.taskId==='solar-connect'?'Match the wires':'Brush the solar panels')):panel==='prologue'?'Elysium Outpost':panel==='resume'?'Your expedition is saved':panel==='time-jump'?'Seven months later':panel==='brief'?mission.title:panel==='missions'?'Your Mars missions':panel==='site'?siteName(site):panel==='science'?'Why it works':panel==='journal'?"Kaelen’s field journal":panel==='log'?'What did you notice?':panel==='restart'?'Restart this expedition?':panel==='test'?'Try a night at the base':panel==='ending'?'Elysium is ready':panel==='heritage'?'Rover discoveries':'';

  const overlay=<div className="ely-shell" data-story-phase={state.phase}>
    {state.phase!=='briefing'&&arrival==='none'&&!panel&&!endingView&&!quietView&&<aside className="ely-hud" aria-label="Elysium mission controls"><div><span className="ely-eyebrow">ELYSIUM · SOL {String(state.sol).padStart(2,'0')}</span><button onClick={()=>setPanel('missions')}>Missions</button><button aria-label={hudDetails?'Collapse mission details':'Expand mission details'} aria-expanded={hudDetails} onClick={()=>setHudDetails(value=>!value)}>{hudDetails?'−':'+'}</button></div><strong>{mission.title}</strong><p>{siteName(target)}{view&&targetPoint?` · ${Math.round(Math.hypot(view.x-targetPoint.x,view.z-targetPoint.z))} m`:''}</p>{hudDetails&&<><div className="ely-hud-resources"><span>Power {Math.round(state.resources.power)}%</span><span>O₂ {Math.round(state.resources.oxygen)}%</span><span>Water {Math.round(state.resources.water)}%</span></div><nav aria-label="Mission tools"><button onClick={()=>setPanel('journal')}>Journal</button><button onClick={()=>setPanel('science')}>Why it works</button>{progress.readyToLog&&<button onClick={()=>setPanel('log')}>Write log</button>}</nav></>}
      {view?.storySite&&<button className="ely-primary" onClick={()=>interact(view.storySite!)}>Use {siteName(view.storySite)}</button>}
      {(state.test.stage==='fault'||state.test.stage==='resolved'||state.test.stage==='safe')&&<button className="ely-primary" onClick={()=>setPanel('test')}>Readiness test · {state.test.stage==='safe'?'safe mode':'review systems'}</button>}
      {hudDetails&&tutorial&&<div className="ely-hint"><p>{controlMode==='pc'?'WASD move · E interact · F rover · Caps Lock map. Drag to look if mouse capture is unavailable.':'Use the movement stick and swipe to look. Tap a station button nearby; Atlas opens the field map.'}</p><button onClick={()=>setTutorial(false)}>Got it · skip guide</button></div>}
    </aside>}
    {endingView&&<aside className="ely-horizon-note"><p>{content.statusText.completion}</p><button onClick={finishEnding}>Finish horizon view · keep exploring</button></aside>}
    {quietView&&<aside className="ely-horizon-note">{quietCaption&&<p className="ely-log-entry">Kaelen · “{content.statusText.quietLog}”</p>}<button onClick={()=>{setQuietView(false);setQuietCaption(false);}}>Continue exploring</button></aside>}
    {saveError&&<p className="ely-save-alert" role="status">Progress is kept in this session, but this browser could not save it: {saveError}</p>}
    {panel&&<div className="ely-backdrop"><section className="ely-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="ely-title"><header><p className="ely-eyebrow">TARUKH · ELYSIUM OUTPOST</p><h2 id="ely-title" tabIndex={-1} data-ely-focus>{title}</h2>{!['resume','prologue','time-jump'].includes(panel)&&<button className="ely-close" aria-label="Close mission panel" onClick={close}>×</button>}</header><div className="ely-dialog-body">
      {panel==='resume'&&<><p>Kaelen Reeves · Sol {state.sol} · {state.completed.length} of 7 missions logged.</p><p>Your operating decisions, resources and journal are stored on this browser. The world starts safely beside the base.</p><ResourceReadout state={state}/><div className="ely-actions"><button className="ely-primary" onClick={()=>setPanel(state.phase==='briefing'?'prologue':state.phase==='ready'?'ending':null)}>Resume expedition</button><button onClick={()=>setPanel('restart')}>Start a new expedition…</button><button onClick={onExit}>Return to mode selection</button></div></>}
      {panel==='prologue'&&<><p className="ely-location">CAPE CANAVERAL · EARTH</p><h3>Kaelen Reeves · commissioning engineer, 24</h3>{content.prologue.briefing.map(text=><p key={text}>{text}</p>)}<blockquote><span>Flight Director · Mission Control</span>{content.prologue.flightDirector}</blockquote><p className="ely-caption">Fictional expedition. The launch and tower sequence is on Earth; it is not a Mars landing.</p><div className="ely-actions"><button className="ely-primary" onClick={()=>begin(true)}>Begin · watch Earth launch</button><button onClick={()=>begin(false)}>Skip prologue · travel to Mars</button><button onClick={onExit}>Back to mode selection</button></div></>}
      {panel==='time-jump'&&<div className="ely-title-card"><span>SEVEN MONTHS LATER</span><h3>Elysium Outpost, Mars</h3><p>The robotic builders have finished. Now the systems must work together.</p><button className="ely-primary" onClick={()=>{setSelected('m1');setPanel('brief');}}>Wake up · begin commissioning</button></div>}
      {panel==='brief'&&<><p className="ely-location">{mission.act} · SOL {state.sol}</p><blockquote className="ely-log-entry">{mission.wakeText}</blockquote>{mission.briefing.map(text=><p key={text}>{text}</p>)}<ul className="ely-checklist">{progress.objectives.map(objective=><li key={objective.id} data-done={objective.done}>{objective.done?'✓':'○'} {objective.label}</li>)}</ul><div className="ely-actions"><button className="ely-primary" onClick={()=>setPanel(null)}>Explore · follow the station marker</button><button onClick={()=>setPanel('science')}>Curious? See why it works</button></div></>}
      {panel==='missions'&&<><p>Your jobs help the whole base. Come back to explore whenever you like. Try the water lab, greenhouse and rover trip in any order after fixing the power.</p><div className="ely-missions">{missionIds.map(id=>{const p=missionProgress(state,id);return <button key={id} className={id===selected?'selected':''} disabled={!p.available&&!p.complete} onClick={()=>{setSelected(id);setPanel('brief');}}><span>{id.slice(1)} · {p.complete?'Logged':p.available?'Available':'Not open yet'}</span><strong>{missionContent(id).title}</strong><small>{p.objectives.filter(item=>item.done).length}/{p.objectives.length} checks</small></button>;})}</div><ResourceReadout state={state}/><div className="ely-actions"><button onClick={()=>setPanel('journal')}>Open my adventure journal</button><button onClick={()=>setPanel('restart')}>Restart expedition…</button><button onClick={onExit}>Save and return to modes</button></div></>}
      {panel==='site'&&<><p className="ely-location">STATION {ELYSIUM_SITES.find(item=>item.id===site)?.number} · {siteName(site)}</p>{site==='command'&&!state.completed.includes('m1')&&<section className="ely-task"><h3>Our first base check</h3><p>Some equipment needs your help. Start with the supply locker below.</p><details className="ely-more"><summary>Look at the equipment report</summary><ul>{content.statusText.initial.map(text=><li key={text}>{text}</li>)}</ul><p>{content.statusText.warning}</p></details></section>}<details className="ely-more"><summary>Check base supplies</summary><ResourceReadout state={state}/></details><p className="ely-station-help">Pick a job to open your tool tablet. Move, turn or match the parts. There is no timer.</p>{unlocked.map(id=>missionWork(id,site))}
        {site==='command'&&<><section className="ely-work"><h3>Ready for a new Mars day?</h3><p>Rest when you want to try your plan for another day. Park the rover in the garage so it can charge while you rest.</p>{actionButton({type:'advance-sol'},'Rest · start a new Mars day')}</section>{unlocked.includes('m7')&&<button className="ely-primary" onClick={()=>setPanel('test')}>Try a night at the base</button>}</>}
        {site==='garage'&&state.completed.includes('m2')&&<section className="ely-work"><h3>Preparing the rover</h3><p>A longer trip needs more battery. Share power with the rover at the command tablet, then leave it in the garage to charge. You can rest at command to speed up the wait.</p>{actionAllowed(state,{type:'recover-rover'})&&<><p>Low battery? A training reserve can help you recover safely. It adds no mission credit.</p>{actionButton({type:'recover-rover'},'Recover rover · add a safe return reserve')}</>}</section>}
        {site==='solar'&&activityAvailable(state,'clear-panels')&&<section className="ely-work"><h3>Clear the dust</h3><p>Dust came back! Brush it away so sunlight can reach the panels again.</p>{activityButton('clear-panels',content.tasks['clear-panels'].label)}</section>}
        {site==='lab'&&state.test.stage==='fault'&&<button className="ely-primary" onClick={()=>setPanel('test')}>Continue the physical pump diagnosis</button>}
        {(site==='heritage'||site==='landmark')&&<article className="ely-task"><h3>{site==='heritage'?'A rover heritage marker':'Survey observation'}</h3><p>{site==='heritage'?'Curiosity rover · approximate traverse path, Sol 3057. Curiosity is a robotic rover in Gale crater. Its proximity here is fictional, for education.':'Compare the ridges with the NASA elevation map. Surface heights and travel distances are compressed for this game.'}</p></article>}
        <div className="ely-actions"><button onClick={()=>setPanel('science')}>Why it works · NASA sources</button><button onClick={()=>setPanel(null)}>Return to the world</button></div>
      </>}
      {panel==='activity'&&activity&&<>{activity.practice&&<p className="ely-caption">Play again for practice. Your mission and supplies are safe.</p>}<Suspense fallback={<p role="status">Opening your tool tablet…</p>}>{activity.family==='solar'?<MissionActivity kind={activity.taskId==='solar-connect'?'wire-repair':'panel-cleaning'} taskId={activity.taskId} onComplete={completeActivity} onCancel={close}/>:training?.screen==='life'?<LifeSupportGames key={activity.activityId} activityId={activity.activityId} allowedChoices={trainingAllowedChoices(state,activity.activityId)} onComplete={completeTraining} onCancel={close}/>:<TrainingWorkshop key={activity.activityId} activityId={activity.activityId} allowedChoices={trainingAllowedChoices(state,activity.activityId)} onComplete={completeTraining} onCancel={close}/>}</Suspense></>}
      {panel==='science'&&<><p>Mission Notes · {mission.title}</p>{mission.scienceNotes.map(note=><article className="ely-science" key={note.title}><h3>{note.title}</h3><p>{note.text}</p><p>{note.sourceIds.map(id=>{const source=content.sources[id as keyof typeof content.sources];return source?<a key={id} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>:null;})}</p></article>)}{Object.entries(content.scienceDiagrams).map(([id,diagram])=><figure key={id} className="ely-diagram"><figcaption>{diagram.title}</figcaption><ol>{diagram.steps.map(step=><li key={step}>{step}</li>)}</ol>{'equation' in diagram&&<p className="ely-equation">{diagram.equation}</p>}<p>{diagram.note}</p></figure>)}<p className="ely-caption">{content.simulationNotice}</p></>}
      {panel==='journal'&&<><ResourceReadout state={state}/><p>Kaelen’s decisions become evidence in Mission Control’s review.</p>{state.logs.length?state.logs.map(entry=><article className="ely-log-entry" key={entry.missionId}><span>SOL {entry.sol} · {missionContent(entry.missionId).title}</span><p>“{entry.text}”</p></article>):<p>No entries yet. Complete a mission’s checks, then choose a personal log entry.</p>}<h3>Operating choices</h3><dl className="ely-decisions">{Object.entries(state.choices).map(([group,id])=><div key={group}><dt>{groupNames[group as ChoiceGroup]}</dt><dd>{content.choices[group as ChoiceGroup].find(option=>option.id===id)?.label??'Not chosen yet'}</dd></div>)}</dl>{state.finalLog&&<blockquote className="ely-log-entry">{state.finalLog}</blockquote>}</>}
      {panel==='log'&&<><p>{mission.title} · Pick a thought for your journal. All of these are good ways to reflect on your adventure.</p>{mission.logOptions.map((text,index)=><button className="ely-choice ely-log-entry" key={text} disabled={!progress.readyToLog} onClick={()=>recordLog(index as 0|1|2)}>{text}</button>)}</>}
      {panel==='journal'&&(state.tasks.includes('heritage-note')||state.tasks.includes('landmark-survey'))&&<section className="ely-work"><h3>Field knowledge</h3>
        {state.tasks.includes('heritage-note')&&<article className="ely-science"><h4>Curiosity heritage marker</h4><p>Curiosity is a robotic rover exploring Gale crater. The nearby Sol 3057 traverse marker is a fictional educational placement; it does not locate the real rover beside Elysium Outpost.</p><a href="https://science.nasa.gov/mission/msl-curiosity/" target="_blank" rel="noreferrer">NASA · Curiosity mission ↗</a></article>}
        {state.tasks.includes('landmark-survey')&&<article className="ely-science"><h4>Terrain survey observation</h4><p>The field map and distant ground use the same NASA MOLA elevation crop. Shaded relief shows heights, not a photograph. Close rocks and route hazards are game additions; distances are compressed for exploration.</p><p>Your survey helps compare proposed routes and narrows the simulated planning uncertainty. It does not measure real weather on Mars.</p><a href={content.sources.marsTrek.url} target="_blank" rel="noreferrer">NASA · Mars Trek ↗</a></article>}
      </section>}
      {panel==='restart'&&<><p>This replaces your saved Elysium decisions, resources and journal on this browser. Free Exploration is unaffected.</p><div className="ely-actions"><button className="ely-danger" onClick={reset}>Discard expedition · restart</button><button className="ely-primary" onClick={()=>setPanel('missions')}>Keep my progress</button></div></>}
      {panel==='test'&&<><p>Can your base make it through a pretend night? Open the repair tablet if something needs help. Nothing counts down while you play.</p><details className="ely-more"><summary>Check our supplies</summary><ResourceReadout state={state}/><ReadinessForecast summary={summary}/></details>
        {state.test.stage==='idle'&&<><h3>Ready for a practice night?</h3><p>Pack the base plan and a backup, then receive Mission Control’s message at the command tablet.</p>{actionButton({type:'start-test'},'Start the practice night')}</>}
        {state.test.stage==='fault'&&fault&&<section className="ely-fault"><span className="ely-eyebrow">REPAIR TIME · NO RUSH</span><h3>{fault.title}</h3><p>{fault.chain[0]} Let’s fix it together.</p>{trainingButton(state.test.fault==='pump'?(state.test.pumpRestarted?'fault-water':'fault-pump'):state.test.fault==='heater'?'fault-heater':'fault-scrubber')}<details className="ely-more"><summary>What is happening?</summary><ol>{fault.chain.map(item=><li key={item}>{item}</li>)}</ol></details><button onClick={()=>setPanel(null)}>Walk to the equipment</button></section>}
        {state.test.stage==='resolved'&&<><p>Your repair is recorded. Check the supplies, then see how the base does at sunrise.</p>{actionButton({type:'advance-test'},'Advance to sunrise')}</>}
        {state.test.stage==='safe'&&<><h3>The backup kept the crew safe</h3><p>Your adventure is safe. Try sharing the supplies differently, then play the night test again.</p>{actionButton({type:'retry-test'},'Try again · keep my adventure')}<button onClick={()=>setPanel('missions')}>Try a different plan</button></>}
        {state.test.stage==='passed'&&<><h3>The base made it through the night!</h3><p>You kept the crew’s supplies ready. Mission Control can welcome the next crew.</p>{state.completed.includes('m7')?actionButton({type:'start-test'},'Run another readiness test'):<button className="ely-primary" onClick={()=>{setSelected('m7');setPanel('log');}}>Write the First Light log</button>}</>}
      </>}
      {panel==='ending'&&<><p className="ely-location">MISSION CONTROL · REVIEW RECEIVED AFTER COMMUNICATION DELAY</p><blockquote><span>Flight Director</span>{content.statusText.endingTransmission}</blockquote><h3>{ending.title}</h3><p>{ending.flightDirector}</p><p>{ending.why}</p><h3>Your own evidence</h3>{state.logs.map(entry=><blockquote className="ely-log-entry" key={entry.missionId}>“{entry.text}”<small>Kaelen · Sol {entry.sol}</small></blockquote>)}<h3>One final line</h3>{state.finalLog?<blockquote className="ely-log-entry">{state.finalLog}</blockquote>:content.finalLogOptions.map((text,index)=><button className="ely-choice" key={text} onClick={()=>perform({type:'final-log',choiceId:index as 0|1|2})}>{text}</button>)}<p>{content.statusText.completion}</p><div className="ely-actions"><button className="ely-primary" data-ely-ending disabled={!state.finalLog} onClick={()=>{setEndingView(true);setPanel(null);}}>Take one last look at the horizon</button><button onClick={()=>setPanel(null)}>Keep exploring Elysium</button></div></>}
      {panel==='heritage'&&<><h3>{heritage==='perseverance'?'Perseverance · Jezero crater':'Curiosity · Gale crater'}</h3><p>{heritage==='perseverance'?'This historical reference marks the Perseverance landing site in Jezero crater. It is not a second driveable crew rover.':'Curiosity is an autonomous robotic rover. Its movement near this fictional outpost is an educational representation, not its real location.'}</p><p><a href={heritage==='perseverance'?'https://science.nasa.gov/mission/mars-2020-perseverance/':'https://science.nasa.gov/mission/msl-curiosity/'} target="_blank" rel="noreferrer">NASA mission information ↗</a></p></>}
      {state.lastOutcome&&['site','test'].includes(panel)&&<aside className="ely-outcome" role="status"><h3 tabIndex={-1} data-ely-feedback>Look what changed!</h3><p>{state.lastOutcome.outcome}</p><details className="ely-more"><summary>Why did that happen?</summary><p>{state.lastOutcome.why}</p></details></aside>}
    </div><footer><span>Kaelen Reeves · Sol {state.sol} · {saveError?'Session only':'Saved on this browser'}</span>{!['prologue','resume','time-jump'].includes(panel)&&<button onClick={close}>{panel==='activity'?'Return to station':'Continue exploring'}</button>}</footer></section></div>}
  </div>;

  return <MarsFreeRoam key={session} story={{controlMode,modalOpen:panel!==null,world,onView:updateView,onInspect:inspect,onExit,overlay,arrival,onArrivalComplete:finishArrival}}/>;
}
