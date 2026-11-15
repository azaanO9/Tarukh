import type {ElysiumGuidance} from '../game/elysiumGuidance';

export default function ElysiumGuidanceCard({guidance,yaw=0,x=0,z=0,compact=false,buttonLabel,onContinue}:{
  guidance:ElysiumGuidance;
  yaw?:number;x?:number;z?:number;compact?:boolean;
  buttonLabel?:string;onContinue:()=>void;
}){
  const target=guidance.target;
  const bearing=target?Math.atan2(-(target.x-x),-(target.z-z)):yaw;
  const angle=Math.atan2(Math.sin(yaw-bearing),Math.cos(yaw-bearing))*180/Math.PI;
  const direction=Math.abs(angle)<25?'Ahead':Math.abs(angle)>155?'Behind you':angle>0?'To your right':'To your left';
  return <section className={`ely-guidance${compact?' ely-guidance-compact':''}`} data-ely-guidance data-step-id={guidance.id} data-target-site={guidance.targetSiteId??''} aria-label="Your next step">
    <div className="ely-guidance-label"><span>YOUR NEXT STEP</span>{guidance.stepCount>0&&<span>{guidance.stepIndex} / {guidance.stepCount}</span>}</div>
    <h3>{guidance.title}</h3>
    {target&&<div className="ely-destination">
      <span className="ely-direction" aria-hidden="true">{guidance.atTarget?'✓':<span style={{transform:`rotate(${angle}deg)`}}>↑</span>}</span>
      <div><strong>{target.number!==null?`${target.number} · `:''}{target.label}</strong><span>{guidance.atTarget?'You are here':`${guidance.distance===null?'':`${guidance.distance} m · `}${direction}`}</span></div>
    </div>}
    <p>{guidance.detail}</p>
    {!compact&&guidance.travelHint&&<p className="ely-travel-hint">{guidance.travelHint}</p>}
    <button className="ely-primary" data-ely-next onClick={onContinue}>{buttonLabel??(target&&!guidance.atTarget?`Go to ${target.label}`:guidance.action)}</button>
  </section>;
}
