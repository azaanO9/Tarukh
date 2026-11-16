"use client";
import { useCallback, useEffect, useRef } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, LogOut, SwitchCamera, Zap } from "lucide-react";
import type { TouchControlProps } from "./touchControlTypes";

type Control = "left" | "right" | "gas" | "rev" | "boost";
type Props = Pick<TouchControlProps,"onDriveAxes" | "onToggleView" | "onToggleRover">;

const PEDAL_LABELS: Record<"gas" | "rev" | "boost", string> = {
  gas: "Go",
  rev: "Back",
  boost: "Boost",
};

export function RoverTouchDeck({onDriveAxes,onToggleView,onToggleRover}: Props) {
  const inputs = useRef(new Map<string,Control>());
  const buttons = useRef<Partial<Record<Control,HTMLButtonElement>>>({});
  const reset = useCallback(()=>{
    inputs.current.clear();
    for(const button of Object.values(buttons.current))button.removeAttribute('data-held');
    onDriveAxes({steer:0,throttle:0,handbrake:false});
  },[onDriveAxes]);
  useEffect(()=>{
    window.addEventListener("blur",reset);
    document.addEventListener("visibilitychange",reset);
    return ()=>{
      window.removeEventListener("blur",reset);
      document.removeEventListener("visibilitychange",reset);
      reset();
    };
  },[reset]);
  function update(id:string,control?:Control) {
    if(control) inputs.current.set(id,control);
    else if(!inputs.current.delete(id)) return;
    const held = new Set(inputs.current.values());
    for(const control of Object.keys(buttons.current) as Control[])buttons.current[control]?.toggleAttribute('data-held',held.has(control));
    const throttle =
      held.has("gas") && !held.has("rev") ? 1 : held.has("rev") && !held.has("gas") ? -1 : 0;
    onDriveAxes({
      steer:Number(held.has("left"))-Number(held.has("right")),
      throttle,
      handbrake:false,
      boost: held.has("boost"),
    });
  }
  function button(control:Control,label:string) {
    return <button ref={element=>{if(element)buttons.current[control]=element;else delete buttons.current[control]}} type="button" className={"wheel-"+control} aria-label={label}
      onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);update(String(e.pointerId),control)}}
      onPointerUp={e=>update(String(e.pointerId))} onPointerCancel={e=>update(String(e.pointerId))}
      onLostPointerCapture={e=>update(String(e.pointerId))}
      onKeyDown={e=>{if(e.key===" "||e.key==="Enter"){e.preventDefault();update("key-"+control,control)}}}
      onKeyUp={e=>{if(e.key===" "||e.key==="Enter")update("key-"+control)}} onBlur={()=>update("key-"+control)}>
      {control==="left"?<ArrowLeft aria-hidden="true"/>:control==="right"?<ArrowRight aria-hidden="true"/>:<>
        {control==="gas"?<ArrowUp aria-hidden="true"/>:control==="rev"?<ArrowDown aria-hidden="true"/>:<Zap aria-hidden="true"/>}
        <small>{PEDAL_LABELS[control]}</small>
      </>}
    </button>;
  }
  return <>
    <div className="wheel-controls wheel-steering">{button("left","Steer left")}{button("right","Steer right")}</div>
    <div className="wheel-controls wheel-pedals">
      <div className="wheel-tools">
        <button type="button" aria-label="Switch camera" onClick={onToggleView}><SwitchCamera aria-hidden="true"/><small>View</small></button>
        <button type="button" aria-label="Exit rover" onClick={onToggleRover}><LogOut aria-hidden="true"/><small>Exit</small></button>
      </div>
      {button("boost","Boost mode")}{button("rev","Brake and reverse")}{button("gas","Forward")}
    </div>
  </>;
}
