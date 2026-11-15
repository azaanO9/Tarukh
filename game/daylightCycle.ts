/** Artistic time compression: a full noon-to-noon cycle takes ten active minutes. */
export const DAYLIGHT_CYCLE_SECONDS=600;
export function daylightPhase(seconds:number){
 const phase=(Math.max(0,seconds)%DAYLIGHT_CYCLE_SECONDS)/DAYLIGHT_CYCLE_SECONDS;
 return phase<1/6||phase>=11/12?"Day":phase<5/12?"Sunset":phase<2/3?"Night":"Sunrise";
}
export function daylightAngle(seconds:number){return (Math.max(0,seconds)%DAYLIGHT_CYCLE_SECONDS)/DAYLIGHT_CYCLE_SECONDS*Math.PI*2;}
/** No frozen daylight segments: smooth brightness and zero slope at noon/midnight. */
export function nightAmount(seconds:number){
 return (1-Math.cos(daylightAngle(seconds)))/2;
}
/** The helmet lamp fades in at dusk, avoiding a shadow pass in bright daylight. */
export function helmetLightAmount(night:number){
 const dusk=Math.max(0,Math.min(1,(night-.3)/.7));
 return dusk*dusk*(3-2*dusk);
}
