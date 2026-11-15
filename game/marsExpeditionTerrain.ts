import {marsRegionalHeight} from './marsRegion.ts';
import {terrainFbm,terrainNoise} from '../ui/world/terrainNoise.ts';
import {OUTPOST_SITE, gradeOutpostTerrain, outpostGradeWeight} from './outpostSite.ts';
import {GREENHOUSE_SITES, gradeGreenhouseTerrain} from './greenhouseSites.ts';
import {garageGradeWeight} from './garageSite.ts';
import {boundaryMountainHeight} from './explorationBounds.ts';
import {MARS_CATCH_SITE,gradeMarsCatchSite} from './marsCatchSite.ts';
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

/** MOLA macro relief + clearly artistic sub-grid regolith. No invented named mountains. */
export function marsExpeditionHeight(x:number,z:number){
 const regional=marsRegionalHeight(x,z);
 const grain=(terrainFbm(x*.055,z*.055)-.5)*1.3;
 const ripples=Math.sin(x*.31+z*.1+terrainNoise(x*.06,z*.06)*3)*.12;
 // Only the actual arrival and parked rover areas are gently graded.
 const landing=smooth(8,18,Math.hypot(x,z-14));
 const rover=smooth(4,8,Math.hypot(x-17,z-10));
 return (regional+grain+ripples)*Math.min(landing,rover);
}

export const OUTPOST_GROUND_HEIGHT = marsExpeditionHeight(OUTPOST_SITE.x, OUTPOST_SITE.z);
export const MARS_CATCH_GROUND_HEIGHT = marsExpeditionHeight(MARS_CATCH_SITE.x,MARS_CATCH_SITE.z);
// Cultivation bays share the campus datum, avoiding steep isolated terraces
// across the compressed regional relief while preserving the outer terrain.
export const GREENHOUSE_GROUND_HEIGHTS = GREENHOUSE_SITES.map(() => OUTPOST_GROUND_HEIGHT);

/** The campus pad is graded into the same surface used by rendering and physics. */
export function marsOutpostHeight(x:number,z:number) {
 const campus=gradeGreenhouseTerrain(x,z,gradeOutpostTerrain(x,z,marsExpeditionHeight(x,z),OUTPOST_GROUND_HEIGHT),GREENHOUSE_GROUND_HEIGHTS,outpostGradeWeight(x,z));
 const graded=campus+(OUTPOST_GROUND_HEIGHT-campus)*garageGradeWeight(x,z);
 return gradeMarsCatchSite(x,z,graded,MARS_CATCH_GROUND_HEIGHT)+boundaryMountainHeight(x,z);
}
