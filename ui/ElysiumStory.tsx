"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import MarsFreeRoam from './MarsFreeRoam';
import type {View} from './MarsWorld';
import {
  createElysiumState,reduceElysium,availableMissions,missionProgress,
  actionAllowed,actionSite,forecastGreenhouses,readinessSummary,worldBindings,
  type ElysiumState,type ElysiumAction,type MissionId,type SiteId,SITE_IDS,
} from '../game/elysiumMission';
import {loadElysiumSave,saveElysiumSave,clearElysiumSave} from '../game/elysiumSave';
import {ELYSIUM_SITES,ELYSIUM_ROUTES} from '../game/elysiumSites';
import {MARS_REGION,REGION_WORLD_BOUNDS} from '../game/marsRegion';
import {assetUrl} from '../lib/assetUrl';
import type {ElysiumWorldBridge} from '../game/elysiumWorld';
import content from '../content/elysiumMissions.json';
import './elysium.css';

type Panel='resume'|'prologue'|'time-jump'|'brief'|'missions'|'site'|'science'|'journal'|'log'|'restart'|'test'|'ending'|'heritage'|null;
type ChoiceGroup=keyof typeof content.choices;
const missionIds:MissionId[]=['m1','m2','m3','m4','m5','m6','m7'];
const groupNames:Record<ChoiceGroup,string>={grid:'Share the power',water:'Water recovery',oxygen:'Oxygen production',scrubber:'CO₂ removal',greenhouse:'Growing plan',route:'Expedition route',sensor:'Sensor diagnosis',shielding:'Shelter plan',contingency:'Less sunshine: your backup plan'};
const siteName=(id:string|null)=>ELYSIUM_SITES.find(site=>site.id===id)?.label??'Command terminal';
const taskAction=(taskId:string)=>({type:'task',taskId} as ElysiumAction);
const choiceAction=(group:ChoiceGroup,choiceId:string)=>({type:'choose',group,choiceId} as ElysiumAction);
const missionContent=(id:MissionId)=>content.missions.find(mission=>mission.id===id)!;
const newExpedition=()=>createElysiumState(globalThis.crypto?.getRandomValues(new Uint32Array(1))[0]??Date.now());

function nextSite(state:ElysiumState,id:MissionId){
  if(state.test.stage==='fault'&&state.test.fault==='pump'&&!state.test.pumpRestarted)return 'lab';
  if(id==='m1')return (['airlock','command','garage','greenhouse1'] as const).find(site=>!state.visited.includes(site))??'command';
  if(id==='m2')return state.tasks.includes('solar-connect')?'command':'solar';
  if(id==='m3')return 'lab';
  if(id==='m4')return 'greenhouse1';
  if(id==='m5')return !state.choices.route?'garage':!state.tasks.includes('sample-collect')?'field-sensor':'lab';
  if(id==='m6')return state.tasks.includes('archive-review')?'shelter':'command';
  return 'command';
}

function ResourceReadout({state}:{state:ElysiumState}){
  const values=[['Power reserve',state.resources.power,'%'],['Water reserve',state.resources.water,'%'],['Oxygen reserve',state.resources.oxygen,'%'],['CO₂ level',state.resources.co2,'%'],['Rover battery',state.resources.roverCharge,'%'],['Shelter readiness',state.resources.shelter,'%'],['Food reserve',state.resources.food,'%']] as const;
  return <><dl className="ely-resources">{values.map(([label,value,unit])=><div key={label}><dt>{label}</dt><dd>{Math.round(value)}{unit}</dd><meter aria-label={label} min={0} max={100} value={value}/></div>)}</dl><p className="ely-caption">Simulation values for planning. CO₂ is a simulated indicator, not a real concentration. No countdown.</p></>;
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

export default function ElysiumStory({controlMode,onExit}:{controlMode:'pc'|'mobile';onExit:()=>void}){
  const [initial]=useState(()=>loadElysiumSave());
  const [state,setState]=useState<ElysiumState>(()=>initial.state??newExpedition());
  const stateRef=useRef(state);
  const [worldSeed,setWorldSeed]=useState(state.seed);
  const [session,setSession]=useState(0);
  const [panel,setPanel]=useState<Panel>(initial.state?'resume':'prologue');
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
    setPanel(null);
  },[panel,onExit]);
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
    const location=actionSite(action);
    return <button className="ely-primary" disabled={!readyAction(action)} onClick={()=>perform(action)}>{label}{location&&!atAction(action)&&<small>Walk to {siteName(location)}</small>}</button>;
  };
  const finishEnding=useCallback(()=>{setEndingView(false);requestAnimationFrame(()=>document.querySelector<HTMLElement>('.sv-world')?.focus());},[]);
  const world=useMemo<ElysiumWorldBridge>(()=>({
    sessionId:`elysium-${worldSeed}-${session}`,command:worldBindings(state),
    targetSiteId:target,route:state.choices.route??undefined,onInteract:interact,
    routePoints:state.choices.route?ELYSIUM_ROUTES[state.choices.route]:undefined,
    ending:endingView,onEndingComplete:finishEnding,
  }),[session,worldSeed,state,endingView,target,interact,finishEnding]);

  function choices(group:ChoiceGroup){
    return <fieldset className="ely-choice-group" key={group}><legend>{groupNames[group]}</legend>{content.choices[group].map(option=>{
      const action=choiceAction(group,option.id),chosen=state.choices[group]===option.id;
      return <button key={option.id} className={chosen?'ely-choice selected':'ely-choice'} aria-pressed={chosen} disabled={!readyAction(action)} onClick={()=>perform(action)}><strong>{chosen?'✓ ':''}{option.label}</strong><span>{option.decision}</span>{!atAction(action)&&<small>Choose at {siteName(actionSite(action))}</small>}</button>;
    })}</fieldset>;
  }
  function taskCard(id:string){
    const item=content.tasks[id as keyof typeof content.tasks];if(!item)return null;
    const action=taskAction(id),done=state.tasks.includes(id);
    return <article className="ely-task" key={id}><h4>{done?'✓ ':''}{item.label}</h4>
      {id==='water-compare'&&<p>Compare the simulated readings: the main humidity sensor shows 40%; the checked reference shows 62%. A low reading can send useful water to waste.</p>}
      {id==='water-calibrate'&&<p>Use the checked 62% reference to correct the humidity sensor. This saves water without increasing power.</p>}
      {id==='cargo-read'&&<blockquote>{content.statusText.cargoManifest}</blockquote>}
      {(id==='solar-trace'||id==='solar-connect')&&<p>Cluster C capacity: <strong>{summary.solarCapacity}%</strong>. {state.tasks.includes('solar-connect')?'The repaired circuit restores the shared supply.':'Follow the circuit to find the loose connector before reconnecting it.'} These are simulated commissioning readings.</p>}
      {id==='archive-review'&&<><p><strong>{content.statusText.archiveTitle}</strong></p><p>{content.statusText.archiveDate}</p><p>{content.statusText.archiveNotice}</p><a href={content.sources.sep2017Mars.url} target="_blank" rel="noreferrer">NASA/JPL event archive ↗</a></>}
      {id==='plan-submit'&&<dl className="ely-decisions">{Object.entries(state.choices).filter(([group])=>group!=='sensor').map(([group,choice])=><div key={group}><dt>{groupNames[group as ChoiceGroup]}</dt><dd>{content.choices[group as ChoiceGroup].find(item=>item.id===choice)?.label??'Not yet chosen'}</dd></div>)}</dl>}
      {id==='plan-submit'&&<ReadinessForecast summary={summary}/>}
      {id==='review-ack'&&<><p>{content.statusText.reviewNotice}</p><ol>{content.statusText.reviewQuestions.map(question=><li key={question}>{question}</li>)}</ol></>}
      {done?<p>{item.outcome}</p>:actionButton(action,id==='water-calibrate'?'Calibrate to the checked reference':item.label)}
    </article>;
  }
  function greenhouse(){
    const forecast=forecastGreenhouses(state);
    return <section className="ely-experiment"><h3>Seven-sol growing forecast</h3><p>Labelled trays: lettuce, radishes and dwarf wheat. Accelerated simulation; crops supplement supplies over time.</p><div className="ely-compare">{forecast.map((tray,index)=><fieldset key={index}><legend>Greenhouse {index+1}</legend>
      <label>Light each sol: {tray.light} hours<input type="range" min={0} max={24} step={1} value={tray.light} disabled={view?.storySite!==`greenhouse${index+1}`} onChange={event=>perform({type:'greenhouse-settings',index:index as 0|1,light:Number(event.target.value),water:tray.water})}/></label>
      <label>Irrigation: {tray.water}%<input type="range" min={0} max={100} step={5} value={tray.water} disabled={view?.storySite!==`greenhouse${index+1}`} onChange={event=>perform({type:'greenhouse-settings',index:index as 0|1,light:tray.light,water:Number(event.target.value)})}/></label>
      <meter min={0} max={100} value={tray.growth} aria-label={`Greenhouse ${index+1} growth forecast`}/><p>Growth forecast: {Math.round(tray.growth)}% · Food contribution: {Math.round(tray.food)}</p><p>{tray.warning}</p>
      {view?.storySite!==`greenhouse${index+1}`&&<small>Visit this greenhouse to adjust its controls.</small>}
    </fieldset>)}</div><p className="ely-caption">Compare the two trays. Extra light does not help a thirsty plant. Forecasts are planning estimates, not instant harvests.</p><button onClick={()=>{setPanel(null);setTutorial(false);setQuietCaption(false);setQuietView(true);}}>Take a quiet look through the glass</button></section>;
  }
  function missionWork(id:MissionId,filterSite?:string){
    const definition=missionContent(id);
    const taskIds=definition.taskIds.filter(task=>!filterSite||actionSite(taskAction(task))===filterSite);
    const choiceGroups=(definition.choiceGroups as ChoiceGroup[]).filter(group=>!filterSite||actionSite(choiceAction(group,content.choices[group][0].id))===filterSite);
    if(!taskIds.length&&!choiceGroups.length&&!(id==='m4'&&filterSite==='greenhouse2'))return null;
    return <section className="ely-work" key={id}><h3>{missionContent(id).title}</h3>{id==='m5'&&choiceGroups.includes('route')&&<RouteDiagram selected={state.choices.route}/>}
      {taskIds.map(taskCard)}{choiceGroups.map(choices)}{id==='m4'&&greenhouse()}
      {id==='m6'&&<><h4>Same drill interval · compare additional exposure</h4><dl className="ely-resources"><div><dt>Outside</dt><dd>{summary.radiation.outside} mSv</dd></div><div><dt>Habitat</dt><dd>{summary.radiation.habitat} mSv</dd></div><div><dt>Shelter</dt><dd>{summary.radiation.shelter} mSv</dd></div></dl><p className="ely-caption">{summary.radiation.label} {content.statusText.shieldingNotice}</p><p>Total simulated exposure: {state.resources.dose.toFixed(2)} mSv. Shielding reduces new exposure; it cannot remove an earlier dose.</p>{actionButton({type:'run-drill'},'Run simulated shielding comparison')}</>}
      {missionProgress(state,id).readyToLog&&<button className="ely-primary" onClick={()=>{setSelected(id);setPanel('log');}}>Write this mission’s log</button>}
    </section>;
  }
  const title=panel==='prologue'?'Elysium Outpost':panel==='resume'?'Your expedition is saved':panel==='time-jump'?'Seven months later':panel==='brief'?mission.title:panel==='missions'?'Commissioning plan':panel==='site'?siteName(site):panel==='science'?'Mission Notes · Science':panel==='journal'?"Kaelen’s field journal":panel==='log'?'One entry before the next step':panel==='restart'?'Restart this expedition?':panel==='test'?'First Light · readiness test':panel==='ending'?'Elysium is ready':panel==='heritage'?'Rover heritage':'';

  const overlay=<div className="ely-shell" data-story-phase={state.phase}>
    {state.phase!=='briefing'&&arrival==='none'&&!panel&&!endingView&&!quietView&&<aside className="ely-hud" aria-label="Elysium mission controls"><div><span className="ely-eyebrow">ELYSIUM · SOL {String(state.sol).padStart(2,'0')}</span><button onClick={()=>setPanel('missions')}>Plan</button><button aria-label={hudDetails?'Collapse mission details':'Expand mission details'} aria-expanded={hudDetails} onClick={()=>setHudDetails(value=>!value)}>{hudDetails?'−':'+'}</button></div><strong>{mission.title}</strong><p>{siteName(target)}{view&&targetPoint?` · ${Math.round(Math.hypot(view.x-targetPoint.x,view.z-targetPoint.z))} m`:''}</p>{hudDetails&&<><div className="ely-hud-resources"><span>Power {Math.round(state.resources.power)}%</span><span>O₂ {Math.round(state.resources.oxygen)}%</span><span>Water {Math.round(state.resources.water)}%</span></div><nav aria-label="Mission tools"><button onClick={()=>setPanel('journal')}>Journal</button><button onClick={()=>setPanel('science')}>Science notes</button>{progress.readyToLog&&<button onClick={()=>setPanel('log')}>Write log</button>}</nav></>}
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
      {panel==='brief'&&<><p className="ely-location">{mission.act} · SOL {state.sol}</p><blockquote className="ely-log-entry">{mission.wakeText}</blockquote>{mission.briefing.map(text=><p key={text}>{text}</p>)}<ul className="ely-checklist">{progress.objectives.map(objective=><li key={objective.id} data-done={objective.done}>{objective.done?'✓':'○'} {objective.label}</li>)}</ul><div className="ely-actions"><button className="ely-primary" onClick={()=>setPanel(null)}>Explore · follow the station marker</button><button onClick={()=>setPanel('science')}>Read the science notes</button></div></>}
      {panel==='missions'&&<><p>One shared base. Your choices carry into the next test. Missions 3, 4 and 5 can be explored in any order.</p><div className="ely-missions">{missionIds.map(id=>{const p=missionProgress(state,id);return <button key={id} className={id===selected?'selected':''} disabled={!p.available&&!p.complete} onClick={()=>{setSelected(id);setPanel('brief');}}><span>{id.slice(1)} · {p.complete?'Logged':p.available?'Available':'Not open yet'}</span><strong>{missionContent(id).title}</strong><small>{p.objectives.filter(item=>item.done).length}/{p.objectives.length} checks</small></button>;})}</div><ResourceReadout state={state}/><div className="ely-actions"><button onClick={()=>setPanel('journal')}>Review journal and decisions</button><button onClick={()=>setPanel('restart')}>Restart expedition…</button><button onClick={onExit}>Save and return to modes</button></div></>}
      {panel==='site'&&<><p className="ely-location">STATION {ELYSIUM_SITES.find(item=>item.id===site)?.number} · {siteName(site)}</p>{site==='command'&&!state.completed.includes('m1')&&<section className="ely-task"><h3>Initial commissioning status</h3><ul>{content.statusText.initial.map(text=><li key={text}>{text}</li>)}</ul><p>{content.statusText.warning}</p></section>}<ResourceReadout state={state}/>{unlocked.map(id=>missionWork(id,site))}
        {site==='command'&&<><section className="ely-work"><h3>Between sols</h3><p>Rest only when you choose. The next sol applies your operating plan; nothing counts down while you explore. Park the rover in its garage for overnight charging.</p>{actionButton({type:'advance-sol'},'Rest · begin the next sol')}</section>{unlocked.includes('m7')&&<button className="ely-primary" onClick={()=>setPanel('test')}>Open readiness test</button>}</>}
        {site==='garage'&&state.completed.includes('m2')&&<section className="ely-work"><h3>Preparing the rover</h3><p>Direct route needs {content.simulation.routes.direct.minimumCharge}% charge, ridge {content.simulation.routes.ridge.minimumCharge}%, and valley {content.simulation.routes.valley.minimumCharge}%. Set a charging plan at the command terminal; leave the rover docked while it charges or rest there for the next sol.</p>{actionAllowed(state,{type:'recover-rover'})&&<><p>Low battery? A training reserve can help you recover safely. It adds no mission credit.</p>{actionButton({type:'recover-rover'},'Recover rover · add a safe return reserve')}</>}</section>}
        {site==='solar'&&actionAllowed(state,taskAction('clear-panels'))&&<section className="ely-work"><h3>Clear the dust</h3><p>Dust is reducing the solar array’s output by {summary.nextSolDustLoss} power points next sol. Cleaning restores that supply; it does not instantly refill the battery. This is a simulated maintenance action.</p>{actionButton(taskAction('clear-panels'),content.tasks['clear-panels'].label)}</section>}
        {site==='lab'&&state.test.stage==='fault'&&<button className="ely-primary" onClick={()=>setPanel('test')}>Continue the physical pump diagnosis</button>}
        {(site==='heritage'||site==='landmark')&&<article className="ely-task"><h3>{site==='heritage'?'A rover heritage marker':'Survey observation'}</h3><p>{site==='heritage'?'Curiosity rover · approximate traverse path, Sol 3057. Curiosity is a robotic rover in Gale crater. Its proximity here is fictional, for education.':'Compare the ridges with the NASA elevation map. Surface heights and travel distances are compressed for this game.'}</p></article>}
        <div className="ely-actions"><button onClick={()=>setPanel('science')}>Science notes & sources</button><button onClick={()=>setPanel(null)}>Return to the world</button></div>
      </>}
      {panel==='science'&&<><p>Mission Notes · {mission.title}</p>{mission.scienceNotes.map(note=><article className="ely-science" key={note.title}><h3>{note.title}</h3><p>{note.text}</p><p>{note.sourceIds.map(id=>{const source=content.sources[id as keyof typeof content.sources];return source?<a key={id} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>:null;})}</p></article>)}{Object.entries(content.scienceDiagrams).map(([id,diagram])=><figure key={id} className="ely-diagram"><figcaption>{diagram.title}</figcaption><ol>{diagram.steps.map(step=><li key={step}>{step}</li>)}</ol>{'equation' in diagram&&<p className="ely-equation">{diagram.equation}</p>}<p>{diagram.note}</p></figure>)}<p className="ely-caption">{content.simulationNotice}</p></>}
      {panel==='journal'&&<><ResourceReadout state={state}/><p>Kaelen’s decisions become evidence in Mission Control’s review.</p>{state.logs.length?state.logs.map(entry=><article className="ely-log-entry" key={entry.missionId}><span>SOL {entry.sol} · {missionContent(entry.missionId).title}</span><p>“{entry.text}”</p></article>):<p>No entries yet. Complete a mission’s checks, then choose a personal log entry.</p>}<h3>Operating choices</h3><dl className="ely-decisions">{Object.entries(state.choices).map(([group,id])=><div key={group}><dt>{groupNames[group as ChoiceGroup]}</dt><dd>{content.choices[group as ChoiceGroup].find(option=>option.id===id)?.label??'Not chosen yet'}</dd></div>)}</dl>{state.finalLog&&<blockquote className="ely-log-entry">{state.finalLog}</blockquote>}</>}
      {panel==='log'&&<><p>{mission.title} · Write one short entry. There is no single right personal answer.</p>{mission.logOptions.map((text,index)=><button className="ely-choice ely-log-entry" key={text} disabled={!progress.readyToLog} onClick={()=>recordLog(index as 0|1|2)}>{text}</button>)}</>}
      {panel==='journal'&&(state.tasks.includes('heritage-note')||state.tasks.includes('landmark-survey'))&&<section className="ely-work"><h3>Field knowledge</h3>
        {state.tasks.includes('heritage-note')&&<article className="ely-science"><h4>Curiosity heritage marker</h4><p>Curiosity is a robotic rover exploring Gale crater. The nearby Sol 3057 traverse marker is a fictional educational placement; it does not locate the real rover beside Elysium Outpost.</p><a href="https://science.nasa.gov/mission/msl-curiosity/" target="_blank" rel="noreferrer">NASA · Curiosity mission ↗</a></article>}
        {state.tasks.includes('landmark-survey')&&<article className="ely-science"><h4>Terrain survey observation</h4><p>The field map and distant ground use the same NASA MOLA elevation crop. Shaded relief shows heights, not a photograph. Close rocks and route hazards are game additions; distances are compressed for exploration.</p><p>Your survey helps compare proposed routes and narrows the simulated planning uncertainty. It does not measure real weather on Mars.</p><a href={content.sources.marsTrek.url} target="_blank" rel="noreferrer">NASA · Mars Trek ↗</a></article>}
      </section>}
      {panel==='restart'&&<><p>This replaces your saved Elysium decisions, resources and journal on this browser. Free Exploration is unaffected.</p><div className="ely-actions"><button className="ely-danger" onClick={reset}>Discard expedition · restart</button><button className="ely-primary" onClick={()=>setPanel('missions')}>Keep my progress</button></div></>}
      {panel==='test'&&<><p>A simulated night tests your plan. Each stage advances only when you choose. The reserve bars show resources, not a countdown.</p><ResourceReadout state={state}/><ReadinessForecast summary={summary}/>
        {state.test.stage==='idle'&&<><h3>Before Mission Control reviews your plan</h3><p>Submit the plan, choose a backup for reduced solar and acknowledge the delayed review at the command terminal.</p>{actionButton({type:'start-test'},'Begin simulated night')}</>}
        {state.test.stage==='fault'&&fault&&<section className="ely-fault"><span className="ely-eyebrow">ONE FAULT · TAKE YOUR TIME</span><h3>{fault.title}</h3><ol>{fault.chain.map(item=><li key={item}>{item}</li>)}</ol>{fault.choices.map(option=>{const action={type:'resolve-fault',choiceId:option.id} as ElysiumAction;return <button className="ely-choice" key={option.id} disabled={!readyAction(action)} onClick={()=>perform(action)}><strong>{option.label}</strong>{!atAction(action)&&<small>Go to {siteName(actionSite(action))} to do this physically.</small>}</button>;})}<button onClick={()=>setPanel(null)}>Inspect the base · keep the test paused</button></section>}
        {state.test.stage==='resolved'&&<><p>Your response is recorded. Review the resources, then move the simulation to sunrise.</p>{actionButton({type:'advance-test'},'Advance to sunrise')}</>}
        {state.test.stage==='safe'&&<><h3>The base entered safe mode</h3><p>Your mission progress and journal are safe. Knowing what to change is the point of the test.</p>{actionButton({type:'retry-test'},'Prepare a fresh test · keep my progress')}<button onClick={()=>setPanel('missions')}>Review my operating choices</button></>}
        {state.test.stage==='passed'&&<><h3>Essentials stayed online</h3><p>Your operating plan is ready for Mission Control.</p>{state.completed.includes('m7')?actionButton({type:'start-test'},'Run another readiness test'):<button className="ely-primary" onClick={()=>{setSelected('m7');setPanel('log');}}>Write the First Light log</button>}</>}
      </>}
      {panel==='ending'&&<><p className="ely-location">MISSION CONTROL · REVIEW RECEIVED AFTER COMMUNICATION DELAY</p><blockquote><span>Flight Director</span>{content.statusText.endingTransmission}</blockquote><h3>{ending.title}</h3><p>{ending.flightDirector}</p><p>{ending.why}</p><h3>Your own evidence</h3>{state.logs.map(entry=><blockquote className="ely-log-entry" key={entry.missionId}>“{entry.text}”<small>Kaelen · Sol {entry.sol}</small></blockquote>)}<h3>One final line</h3>{state.finalLog?<blockquote className="ely-log-entry">{state.finalLog}</blockquote>:content.finalLogOptions.map((text,index)=><button className="ely-choice" key={text} onClick={()=>perform({type:'final-log',choiceId:index as 0|1|2})}>{text}</button>)}<p>{content.statusText.completion}</p><div className="ely-actions"><button className="ely-primary" data-ely-ending disabled={!state.finalLog} onClick={()=>{setEndingView(true);setPanel(null);}}>Take one last look at the horizon</button><button onClick={()=>setPanel(null)}>Keep exploring Elysium</button></div></>}
      {panel==='heritage'&&<><h3>{heritage==='perseverance'?'Perseverance · Jezero crater':'Curiosity · Gale crater'}</h3><p>{heritage==='perseverance'?'This historical reference marks the Perseverance landing site in Jezero crater. It is not a second driveable crew rover.':'Curiosity is an autonomous robotic rover. Its movement near this fictional outpost is an educational representation, not its real location.'}</p><p><a href={heritage==='perseverance'?'https://science.nasa.gov/mission/mars-2020-perseverance/':'https://science.nasa.gov/mission/msl-curiosity/'} target="_blank" rel="noreferrer">NASA mission information ↗</a></p></>}
      {state.lastOutcome&&['site','test'].includes(panel)&&<aside className="ely-outcome" role="status"><h3 tabIndex={-1} data-ely-feedback>Your decision → What happened → Why</h3><p><strong>{state.lastOutcome.decision}</strong></p><p>{state.lastOutcome.outcome}</p><p>{state.lastOutcome.why}</p></aside>}
    </div><footer><span>Kaelen Reeves · Sol {state.sol} · {saveError?'Session only':'Saved on this browser'}</span>{!['prologue','resume','time-jump'].includes(panel)&&<button onClick={close}>Continue exploring</button>}</footer></section></div>}
  </div>;

  return <MarsFreeRoam key={session} story={{controlMode,modalOpen:panel!==null,world,onView:updateView,onInspect:inspect,onExit,overlay,arrival,onArrivalComplete:finishArrival}}/>;
}
