import {STARBASE} from './starbaseRig.ts';

export const STARSHIP_ARRIVAL_DURATION = 32;
export const STARSHIP_SEPARATION_TIME = 2;
export const STARSHIP_RETURN_CUT = 8;
export const STARSHIP_CAPTURE_TIME = 29;
export const SHIP_CAPTURE_ALTITUDE = STARBASE.shipCatchHeight - STARBASE.shipPinHeight + STARBASE.pinRadius;

export type ArrivalFrame = {
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
  return {phase:'Stage separation',progress:0,complete:false,fade:0,separated:false,returning:false,boosterVisible:true,
    boosterX:-22,boosterY:150,boosterRoll:0,boosterThrust:.35,shipX:-22,shipY:221,shipRoll:0,shipThrust:0,
    landingEngines:0,armAngle:18,carriageHeight:52,flapAngle:0,dust:0};
}

/** Compressed cinematic shots; the cut omits orbit/coast rather than implying a real flight time. */
export function sampleStarshipArrival(seconds: number, out: ArrivalFrame): ArrivalFrame {
  const t = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  out.progress = clamp(t / STARSHIP_ARRIVAL_DURATION);
  out.complete = t >= STARSHIP_ARRIVAL_DURATION;
  out.separated = t >= STARSHIP_SEPARATION_TIME;
  out.returning = t >= STARSHIP_RETURN_CUT;
  out.boosterVisible = !out.returning;
  const ascent = ease(t/2), separate = ease((t-2)/5);
  out.boosterX = -22-25*separate;
  out.boosterY = 150+6*ascent-30*separate;
  out.boosterRoll = -25*separate;
  out.boosterThrust = (1-ease((t-1.2)/2.5))*.42;
  out.shipX = -22+24*separate;
  out.shipY = 221+6*ascent+54*separate;
  out.shipRoll = 5*separate;
  out.shipThrust = ease((t-1.4)/.9)*.75;
  out.landingEngines = 0;
  out.flapAngle = 0;
  out.armAngle = 18;
  out.carriageHeight = STARBASE.shipCatchHeight;
  out.fade = t<8 ? ease((t-7.2)/.8) : 1-ease((t-8)/.8);
  out.dust = 0;
  out.phase = t<2 ? 'Hot-stage ignition' : 'Stages separating';

  if (out.returning) {
    const approach = ease((t-8)/9), flip = ease((t-14.5)/4.5), align = ease((t-17)/5);
    out.shipX = t<17 ? mix(70,6,approach) : mix(6,0,align);
    out.shipY = t<17 ? mix(144,60,approach)
      : t<22 ? mix(60,SHIP_CAPTURE_ALTITUDE+7,align)
      : t<26 ? mix(SHIP_CAPTURE_ALTITUDE+7,SHIP_CAPTURE_ALTITUDE+1.2,ease((t-22)/4))
      : mix(SHIP_CAPTURE_ALTITUDE+1.2,SHIP_CAPTURE_ALTITUDE,ease((t-26)/3));
    out.shipRoll = -75*(1-flip);
    out.flapAngle = mix(65,18,flip);
    out.boosterThrust = 0;
    out.shipThrust = t<17 ? .88*ease((t-14.5)/1.2)
      : t<22 ? mix(.88,.42,align)
      : t<27 ? mix(.42,.26,ease((t-22)/5)) : .26*(1-ease((t-27)/2));
    out.landingEngines = t<24 ? 3 : t<27 ? 2 : 1;
    // The arms close only after position and attitude have stabilized above the contact surface.
    out.armAngle = 18*(1-ease((t-23)/3));
    out.dust = out.shipThrust*ease((48-out.shipY)/28)*ease((t-17)/3);
    out.phase = t<14.5 ? 'Starship return' : t<19 ? 'Landing flip · engines relit'
      : t<23 ? 'Final descent · aligning with the tower' : t<26 ? 'Chopsticks closing'
      : t<29 ? 'Settling onto the catch rails' : 'Starship secured';
  }
  return out;
}

export function canEnterMars(ready: boolean, elapsed: number, skipped: boolean, reducedMotion: boolean) {
  return ready && (skipped || elapsed >= (reducedMotion ? 2 : STARSHIP_ARRIVAL_DURATION));
}

export function advanceArrival(elapsed: number, delta: number, paused: boolean) {
  if (paused || !Number.isFinite(delta) || delta<=0) return elapsed;
  return Math.min(STARSHIP_ARRIVAL_DURATION+4, elapsed+Math.min(delta,.1));
}
