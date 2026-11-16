import {ARRIVAL_READY_HOLD, STARSHIP_RETURN_CUT, STARSHIP_ARRIVAL_DURATION, sampleStarshipArrival, type ArrivalFrame} from './starshipArrival.ts';

export const FLIGHT_EARTH_ORBIT = 6;
export const FLIGHT_MARS_ENTRY = 12;
export const FLIGHT_LANDING = 19;
export const FLIGHT_EXTRA_TIME = FLIGHT_LANDING - STARSHIP_RETURN_CUT;
export const FLIGHT_DURATION = STARSHIP_ARRIVAL_DURATION + FLIGHT_EXTRA_TIME;
export const FLIGHT_READY_HOLD = FLIGHT_LANDING - .9;
export type DepartureFrame = ArrivalFrame & {shot:'launch'|'earth-orbit'|'mars-entry'|'landing'};
export const flightEase = (value:number) => {
  const t=Math.max(0,Math.min(1,value));return t*t*t*(t*(t*6-15)+10);
};

/** The existing Mars renderer receives exactly its original landing clock and poses. */
export function landingPlaybackTime(time:number) {
  return time>=FLIGHT_LANDING?time-FLIGHT_EXTRA_TIME:Math.min(time,ARRIVAL_READY_HOLD);
}

export function sampleDepartureSequence(seconds:number,out:DepartureFrame) {
  const t=Number.isFinite(seconds)?Math.max(0,seconds):0;
  sampleStarshipArrival(landingPlaybackTime(t),out);
  out.progress=Math.min(1,t/FLIGHT_DURATION);
  out.shot=t<FLIGHT_EARTH_ORBIT?'launch':t<FLIGHT_MARS_ENTRY?'earth-orbit':t<FLIGHT_LANDING?'mars-entry':'landing';
  if(out.shot==='landing') return out;
  if(out.shot==='launch') return out;
  const entry=out.shot==='mars-entry';
  const p=flightEase((t-(entry?FLIGHT_MARS_ENTRY:FLIGHT_EARTH_ORBIT))/(entry?7:6));
  out.shipX=entry?12-22*p:-8+24*p;
  out.shipY=entry?241-24*p:225+16*p;
  out.shipRoll=entry?-64+42*p:-18-30*p;
  out.shipThrust=entry?0:.36*(1-flightEase((t-6)/3.5));
  out.phase=entry?'Mars approach · entering the atmosphere':'Earth departure · bound for Mars';
  out.fade=t<6.65?1-flightEase((t-6)/.65)
    :t<12?flightEase((t-11.45)/.55)
    :t<12.65?1-flightEase((t-12)/.65):flightEase((t-18.2)/.8);
  return out;
}

export function advanceDeparture(elapsed:number,delta:number,paused:boolean,ready:boolean) {
  if(paused||!Number.isFinite(delta)||delta<=0)return elapsed;
  return Math.min(ready?FLIGHT_DURATION+4:FLIGHT_READY_HOLD,elapsed+Math.min(delta,.1));
}
