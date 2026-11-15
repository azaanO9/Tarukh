import {STARBASE} from './starbaseRig.ts';
import {REUSABLE_ROCKET} from './reusableRocket.ts';

export const STARSHIP_ARRIVAL_DURATION = 32;
export const STARSHIP_SPACE_CUT = 6;
export const STARSHIP_RETURN_CUT = 11;
export const STARSHIP_CAPTURE_TIME = 29;
export const ARRIVAL_READY_HOLD = STARSHIP_RETURN_CUT - 0.9;
export const SHIP_CAPTURE_ALTITUDE = STARBASE.shipCatchHeight - REUSABLE_ROCKET.pinHeight + STARBASE.pinRadius;

export type ArrivalFrame = {
  environment: 'earth' | 'space' | 'mars';
  phase: string; progress: number; complete: boolean; fade: number;
  separated: boolean; returning: boolean; boosterVisible: boolean;
  boosterX: number; boosterY: number; boosterRoll: number; boosterThrust: number;
  shipX: number; shipY: number; shipRoll: number; shipThrust: number; landingEngines: number;
  armAngle: number; carriageHeight: number; flapAngle: number; dust: number;
};

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => { const t = clamp(v); return t*t*t*(t*(t*6-15)+10); };
const mix = (a: number, b: number, t: number) => a+(b-a)*t;

export function createArrivalFrame(): ArrivalFrame {
  return {environment:'earth',phase:'Ignition · Earth coast',progress:0,complete:false,fade:0,separated:false,returning:false,boosterVisible:false,
    boosterX:0,boosterY:0,boosterRoll:0,boosterThrust:0,shipX:0,shipY:REUSABLE_ROCKET.launchAltitude,shipRoll:0,shipThrust:0,
    landingEngines:0,armAngle:18,carriageHeight:STARBASE.shipCatchHeight,flapAngle:0,dust:0};
}

/** Three compressed shots of one intact fictional vehicle; no detachable stages. */
export function sampleStarshipArrival(seconds: number, out: ArrivalFrame): ArrivalFrame {
  const t = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  out.progress = clamp(t / STARSHIP_ARRIVAL_DURATION);
  out.complete = t >= STARSHIP_ARRIVAL_DURATION;
  out.separated = false;
  out.returning = t >= STARSHIP_RETURN_CUT;
  out.environment = out.returning ? 'mars' : t >= STARSHIP_SPACE_CUT ? 'space' : 'earth';
  out.boosterVisible = false;
  out.boosterX = out.boosterY = out.boosterRoll = out.boosterThrust = 0;
  out.shipX = out.shipRoll = 0;
  out.landingEngines = out.flapAngle = 0;
  out.armAngle = 18;
  out.carriageHeight = STARBASE.shipCatchHeight;
  out.dust = 0;
  // Fade only at the time-compressed environment cuts, never during the final catch.
  out.fade = t<STARSHIP_SPACE_CUT ? ease((t-5.55)/.45)
    : t<6.5 ? 1-ease((t-6)/.5)
    : t<STARSHIP_RETURN_CUT ? ease((t-10.2)/.8) : 1-ease((t-11)/.8);
  if(out.environment==='earth'){
    const ascent=clamp((t-.9)/5.1);
    out.shipY=REUSABLE_ROCKET.launchAltitude+100*ascent*ascent;
    out.shipThrust=.85*ease(t/1.4);
    out.dust=out.shipThrust*(1-ease((out.shipY-4)/32));
    out.phase=t<.9?'Ignition · Earth coast':'Liftoff · leaving Earth';
  }else if(out.environment==='space'){
    const coast=clamp((t-STARSHIP_SPACE_CUT)/(STARSHIP_RETURN_CUT-STARSHIP_SPACE_CUT));
    out.shipX=mix(-6,8,coast);
    out.shipY=mix(225,241,coast);
    out.shipRoll=mix(-8,-3,ease(coast));
    out.shipThrust=.15*(1-ease(coast/.65));
    out.phase='Above Earth · one reusable spacecraft';
  }else{
    const approach=ease((t-11)/8),align=ease((t-19)/3);
    out.shipX=t<19?mix(26,3,approach):mix(3,0,align);
    out.shipY=t<19?mix(126,SHIP_CAPTURE_ALTITUDE+20,approach)
      :t<22?mix(SHIP_CAPTURE_ALTITUDE+20,SHIP_CAPTURE_ALTITUDE+7,align)
      :t<26?mix(SHIP_CAPTURE_ALTITUDE+7,SHIP_CAPTURE_ALTITUDE+1.2,ease((t-22)/4))
      :mix(SHIP_CAPTURE_ALTITUDE+1.2,SHIP_CAPTURE_ALTITUDE,ease((t-26)/3));
    out.shipRoll=-8*(1-ease((t-11)/11));
    out.shipThrust=t<19?mix(.65,.48,approach)
      :t<27?mix(.48,.26,ease((t-19)/8)):.26*(1-ease((t-27)/2));
    out.landingEngines=t<24?3:t<27?2:1;
    // Both pins clear the rails until the arms have closed and descent is almost stopped.
    out.armAngle=18*(1-ease((t-23)/3));
    out.dust=out.shipThrust*ease((72-out.shipY)/30);
    out.phase=t<19?'Mars arrival · outpost in sight':t<23?'Gentle descent · Mars'
      :t<26?'Chopsticks closing':t<29?'Settling onto the catch rails':'Reusable spacecraft secured';
  }
  return out;
}

/** Shared refs keep the cinematic and the real Mars renderer in step without React frame updates. */
export function createArrivalPlayback() {
  return {time:0,active:false,marsRendered:false};
}
export type ArrivalPlayback = ReturnType<typeof createArrivalPlayback>;

/** Hold the orbit shot if assets are still preparing; never reveal an empty Mars scene. */
export function advanceArrivalWithReadiness(elapsed:number,delta:number,paused:boolean,ready:boolean) {
  const next=advanceArrival(elapsed,delta,paused);
  return ready?next:Math.min(next,ARRIVAL_READY_HOLD);
}

export function canEnterMars(ready: boolean, elapsed: number, skipped: boolean, reducedMotion: boolean) {
  return ready && (skipped || elapsed >= (reducedMotion ? 2 : STARSHIP_ARRIVAL_DURATION));
}

export function advanceArrival(elapsed: number, delta: number, paused: boolean) {
  if (paused || !Number.isFinite(delta) || delta<=0) return elapsed;
  return Math.min(STARSHIP_ARRIVAL_DURATION+4, elapsed+Math.min(delta,.1));
}
