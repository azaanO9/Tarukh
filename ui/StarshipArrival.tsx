"use client";
import {useEffect,useRef,useState} from 'react';
import type {createStarshipArrival} from './starbase/createStarshipArrival';
import {STARBASE} from '../game/starbaseRig';
import {REUSABLE_ROCKET} from '../game/reusableRocket';
import type {ArrivalPlayback} from '../game/starshipArrival';
import './starshipArrival.css';

export default function StarshipArrival({ready,onComplete,performance=false,playback,suspended=false,loading}:{ready:boolean;onComplete:()=>void;performance?:boolean;playback:ArrivalPlayback;suspended?:boolean;loading?:{progress:number;stage:string}}){
  const host=useRef<HTMLDivElement>(null),section=useRef<HTMLElement>(null),phase=useRef<HTMLHeadingElement>(null);
  const detail=useRef<HTMLParagraphElement>(null),bar=useRef<HTMLDivElement>(null),fade=useRef<HTMLDivElement>(null);
  const controller=useRef<ReturnType<typeof createStarshipArrival>|null>(null),latest=useRef({ready,onComplete,suspended}),skipPending=useRef(false);
  const [paused,setPaused]=useState(false);
  useEffect(()=>{latest.current={ready,onComplete,suspended};if(ready&&skipPending.current&&!suspended)onComplete();},[ready,onComplete,suspended]);
  useEffect(()=>{
    let cancelled=false;
    section.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const failure=()=>{
      if(cancelled)return;skipPending.current=true;
      if(section.current)section.current.dataset.fallback='true';
      if(phase.current)phase.current.textContent='Preparing Mars';
      if(detail.current)detail.current.textContent='Continuing without the cinematic on this device.';
      if(latest.current.ready&&!latest.current.suspended)latest.current.onComplete();
    };
    void import('./starbase/createStarshipArrival').then(({createStarshipArrival})=>{
      if(cancelled||!host.current||skipPending.current)return;
      const params=new URLSearchParams(location.search),preview=params.get('arrivalPreview');
      const previewTime=params.get('debug')==='1'&&preview!==null&&Number.isFinite(Number(preview))?Math.max(0,Math.min(32,Number(preview))):undefined;
      controller.current=createStarshipArrival(host.current,{
        ready:()=>latest.current.ready,onComplete:()=>latest.current.onComplete(),onFailure:failure,
        playback,suspended:()=>latest.current.suspended,
        performance:performance||matchMedia('(pointer: coarse)').matches,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,previewTime,
        onFrame:(frame,elapsed,isPaused,dust)=>{
          if(!section.current)return;
          section.current.dataset.phase=frame.phase;section.current.dataset.time=elapsed.toFixed(2);
          section.current.dataset.environment=frame.environment;
          section.current.dataset.shipAltitude=frame.shipY.toFixed(3);section.current.dataset.shipThrust=frame.shipThrust.toFixed(3);
          section.current.dataset.armAngle=frame.armAngle.toFixed(3);section.current.dataset.dust=String(dust);
          section.current.dataset.pinGap=(frame.shipY+REUSABLE_ROCKET.pinHeight-STARBASE.pinRadius-frame.carriageHeight).toFixed(4);
          const label=isPaused?'Sequence paused':frame.phase;
          if(phase.current&&phase.current.textContent!==label)phase.current.textContent=label;
          if(detail.current)detail.current.textContent=frame.returning?`Mars catch tower · ${frame.shipThrust>0?`${frame.landingEngines} landing engine${frame.landingEngines===1?'':'s'}`:'Engines off'}`:frame.environment==='space'?'Above Earth · interplanetary coast is time-compressed':'Earth coast · launch to orbit';
          if(bar.current)bar.current.style.transform=`scaleX(${frame.progress})`;
          if(fade.current)fade.current.style.opacity=String(frame.fade);
        },
      });
    }).catch(failure);
    const keys=(event:KeyboardEvent)=>{
      if(latest.current.suspended)return;
      if(event.code!=='Space'&&event.key!=='Escape')return;
      if(event.target instanceof HTMLButtonElement&&event.code==='Space')return;
      event.preventDefault();event.stopPropagation();skipPending.current=true;setPaused(false);controller.current?.skip();
      if(latest.current.ready&&!latest.current.suspended)latest.current.onComplete();
    };
    window.addEventListener('keydown',keys,true);
    return ()=>{cancelled=true;window.removeEventListener('keydown',keys,true);controller.current?.dispose();controller.current=null;};
  },[performance,playback]);
  const skip=()=>{skipPending.current=true;controller.current?.skip();setPaused(false);if(ready&&!suspended)onComplete();};
  return <section ref={section} className="starship-arrival" aria-label="Reusable spacecraft Earth launch, orbital coast and Mars arrival cinematic" data-world-ready={ready}>
    <div ref={host} className="starship-arrival-world"/>
    <div ref={fade} className="starship-arrival-cut" aria-hidden="true"/>
    <header className="starship-arrival-header"><b>TARUKH <span>· EARTH TO MARS</span></b><div>
      <button onClick={()=>setPaused(controller.current?.togglePause()??false)} aria-pressed={paused}>{paused?'Resume':'Pause'}</button>
      <button onClick={skip}>{ready?'Skip to Mars':'Skip animation'}</button>
    </div></header>
    <div className="starship-arrival-caption"><p>EARTH · SPACE · MARS · CATCH</p><h1 ref={phase} role="status" aria-live="polite">Preparing the flight</h1><p ref={detail}>Departing Earth for the Mars outpost</p><p>A fictional expedition · travel time is shortened for the game.</p>
      <div className="starship-arrival-track" aria-hidden="true"><div ref={bar}/></div>
      <p className="starship-arrival-loading" role="status">{ready?"Mars is ready · enter when you’re ready":loading?.stage??"Preparing Mars while the flight continues…"}</p>
      {!ready&&<progress className="starship-world-progress" aria-label="Mars scene preparation" value={loading?.progress??0} max={100}>{loading?.progress??0}%</progress>}
    </div>
  </section>;
}
