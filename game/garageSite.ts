/** Metre-scale placement of the reviewed garage; its entrance faces south. */
export const GARAGE_SITE = {
  x:26, z:-26, minX:-6, maxX:11, minZ:-6, maxZ:18, blend:9,
  floor:.18, rampStart:5.2, rampEnd:7.6, doorZ:4.8,
  parkedZ:-1.3, stagingZ:13, doorSeconds:4,
} as const;

export function garageGradeWeight(x:number,z:number) {
  const lx=x-GARAGE_SITE.x,lz=z-GARAGE_SITE.z;
  const dx=Math.max(GARAGE_SITE.minX-lx,0,lx-GARAGE_SITE.maxX);
  const dz=Math.max(GARAGE_SITE.minZ-lz,0,lz-GARAGE_SITE.maxZ);
  if(dx>=GARAGE_SITE.blend||dz>=GARAGE_SITE.blend)return 0;
  const t=Math.min(1,Math.hypot(dx,dz)/GARAGE_SITE.blend);
  return 1-t*t*(3-2*t);
}

export function garageClearing(x:number,z:number,margin=0) {
  const lx=x-GARAGE_SITE.x,lz=z-GARAGE_SITE.z;
  return lx>=GARAGE_SITE.minX-margin&&lx<=GARAGE_SITE.maxX+margin
    &&lz>=GARAGE_SITE.minZ-margin&&lz<=GARAGE_SITE.maxZ+margin;
}

export function garageFloorAt(x:number,z:number,ground:number,datum:number) {
  const lx=x-GARAGE_SITE.x,lz=z-GARAGE_SITE.z;
  if(Math.abs(lx)<=4.35&&lz>=-4.625&&lz<=4.625)return Math.max(ground,datum+GARAGE_SITE.floor);
  if(Math.abs(lx)<=3.2&&lz>=4.495&&lz<=GARAGE_SITE.rampEnd){
    const t=Math.max(0,(lz-GARAGE_SITE.rampStart)/(GARAGE_SITE.rampEnd-GARAGE_SITE.rampStart));
    return Math.max(ground,datum+GARAGE_SITE.floor*(1-t));
  }
  return ground;
}
