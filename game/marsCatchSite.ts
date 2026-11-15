import {boxObstacle} from './collision.ts';

/** Fictional expedition infrastructure; the artistic footprint is separate from the MOLA data. */
export const MARS_CATCH_SITE = {x:118,z:90,scale:.65,yaw:Math.PI,radius:28,blend:15} as const;

export function marsCatchClearing(x:number,z:number,margin=0) {
  return Math.hypot(x-MARS_CATCH_SITE.x,z-MARS_CATCH_SITE.z)<MARS_CATCH_SITE.radius+margin;
}

export function gradeMarsCatchSite(x:number,z:number,naturalHeight:number,padHeight:number) {
  const distance=Math.hypot(x-MARS_CATCH_SITE.x,z-MARS_CATCH_SITE.z);
  if(distance>=MARS_CATCH_SITE.radius+MARS_CATCH_SITE.blend)return naturalHeight;
  const t=Math.max(0,Math.min(1,(distance-MARS_CATCH_SITE.radius)/MARS_CATCH_SITE.blend));
  return padHeight+(naturalHeight-padHeight)*(t*t*(3-2*t));
}

export function marsCatchObstacles() {
  const s=MARS_CATCH_SITE;
  return [boxObstacle(s.x-18*s.scale*Math.cos(s.yaw),s.z,5.3,5.3,'mars-catch-tower')];
}
