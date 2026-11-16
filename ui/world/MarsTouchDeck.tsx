"use client";
import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import { ArrowUpFromLine, Camera, CarFront, Hand, Move } from "lucide-react";
import type { TouchControlProps } from "./touchControlTypes";

export function MarsTouchDeck({roverNear, canInspect, onWalkAxes, onHoldKey, onToggleRover, onToggleView, onInspectNearby}: TouchControlProps) {
  const pad = useRef<HTMLDivElement>(null);
  const jump = useRef<HTMLButtonElement>(null);
  const jumpPointers = useRef(new Set<number>());
  const origin = useRef<{id:number;x:number;y:number}|null>(null);
  const reset = useCallback(()=>{
    origin.current=null;
    jumpPointers.current.clear();
    jump.current?.removeAttribute('data-held');
    pad.current?.removeAttribute("data-held");
    onWalkAxes({side:0,forward:0,sprint:false});
    onHoldKey("jump",false);
  },[onWalkAxes,onHoldKey]);
  useEffect(()=>{
    reset();
    window.addEventListener("blur",reset);
    document.addEventListener("visibilitychange",reset);
    return ()=>{window.removeEventListener("blur",reset);document.removeEventListener("visibilitychange",reset);reset()};
  },[reset]);
  function move(e:PointerEvent<HTMLDivElement>){
    const start=origin.current;
    if(!start || start.id!==e.pointerId)return;
    const dx=e.clientX-start.x, dy=e.clientY-start.y;
    const distance=Math.hypot(dx,dy), scale=1/Math.max(38,distance);
    const side=distance<5?0:dx*scale, forward=distance<5?0:-dy*scale;
    e.currentTarget.style.setProperty("--dx",side*26+"px");
    e.currentTarget.style.setProperty("--dy",-forward*26+"px");
    onWalkAxes({side,forward,sprint:distance>34});
  }
  function releaseStick(e:PointerEvent<HTMLDivElement>){
    if(origin.current?.id!==e.pointerId)return;
    origin.current=null;
    e.currentTarget.removeAttribute("data-held");
    onWalkAxes({side:0,forward:0,sprint:false});
  }
  function action(active:boolean){
    onHoldKey("jump",active);
    jump.current?.toggleAttribute('data-held',active);
  }
  function releaseJump(event:PointerEvent<HTMLButtonElement>){
    jumpPointers.current.delete(event.pointerId);
    action(jumpPointers.current.size>0);
  }
  return <>
    <div ref={pad} className="flight-pad" aria-label="Move" onPointerDown={e=>{
      e.preventDefault();e.stopPropagation();if(origin.current)return;
      const rect=e.currentTarget.getBoundingClientRect();
      origin.current={id:e.pointerId,x:e.clientX,y:e.clientY};
      e.currentTarget.dataset.held="";
      e.currentTarget.style.setProperty("--x",e.clientX-rect.left+"px");
      e.currentTarget.style.setProperty("--y",e.clientY-rect.top+"px");
      e.currentTarget.setPointerCapture(e.pointerId);move(e);
    }} onPointerMove={e=>{e.stopPropagation();move(e)}} onPointerUp={releaseStick} onLostPointerCapture={releaseStick} onPointerCancel={releaseStick}>
      <i><Move size={24}/></i>
    </div>
    <div className="flight-actions">
      <button className="flight-view" aria-label="Switch camera" onClick={onToggleView}><Camera/><span>View</span></button>
      {roverNear&&<button className="flight-board" aria-label="Drive rover" onClick={onToggleRover}><CarFront/><span>Drive</span></button>}
      {canInspect&&<button className="flight-use" aria-label="Interact with station" onClick={onInspectNearby}><Hand/><span>Use</span></button>}
      <button ref={jump} className="flight-main" aria-label="Jump" onPointerDown={e=>{e.preventDefault();jumpPointers.current.add(e.pointerId);e.currentTarget.setPointerCapture(e.pointerId);action(true)}} onLostPointerCapture={releaseJump} onPointerUp={releaseJump} onPointerCancel={releaseJump} onKeyDown={e=>{if(e.key===" "||e.key==="Enter"){e.preventDefault();action(true)}}} onKeyUp={e=>{if(e.key===" "||e.key==="Enter")action(jumpPointers.current.size>0)}} onBlur={()=>action(jumpPointers.current.size>0)}><ArrowUpFromLine/><span>Jump</span></button>
    </div>
  </>;
}
