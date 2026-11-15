"use client";
import {useEffect,useRef} from 'react';
import {tryEnterLandscape} from './mobileDevice';

/** The parent pauses the world and cinematic before presenting this screen. */
export function RotateToLandscapeGate({blocked}:{blocked:boolean}) {
  const button=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!blocked)return;
    const previous=document.activeElement as HTMLElement|null;
    document.exitPointerLock?.();
    button.current?.focus();
    const keys=(event:KeyboardEvent)=>{
      if(event.key==='Tab'){event.preventDefault();button.current?.focus();}
    };
    document.addEventListener('keydown',keys);
    return ()=>{
      document.removeEventListener('keydown',keys);
      if(previous?.isConnected)previous.focus();
    };
  },[blocked]);
  if(!blocked)return null;
  return <div className="sv-rotate-gate" role="dialog" aria-modal="true" aria-labelledby="rotate-title" data-ui-zone="rotation">
    <div className="sv-rotate-card">
      <div className="sv-rotate-icon" aria-hidden="true"><span className="sv-phone-outline"/></div>
      <p className="sv-rotate-kicker">YOUR ADVENTURE IS PAUSED</p>
      <h2 id="rotate-title">Turn your device sideways</h2>
      <p>Give Mars a little more room! Your adventure continues when you rotate to landscape.</p>
      <button ref={button} type="button" className="sv-rotate-btn" onClick={()=>void tryEnterLandscape()}>Try fullscreen ↻</button>
    </div>
  </div>;
}
