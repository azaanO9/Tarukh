export type ElysiumSite = {id:string;label:string;x:number;z:number;range:number;number:number};

/** Fictional commissioning stations placed in the existing, metre-scale campus. */
export const ELYSIUM_SITES: readonly ElysiumSite[] = [
  {id:'airlock',label:'Habitat airlock',x:0,z:-62.5,range:1.6,number:1},
  {id:'command',label:'Command terminal',x:0,z:-65,range:2.8,number:2},
  {id:'solar',label:'Solar cluster C',x:36,z:-21,range:3,number:3},
  {id:'lab',label:'Water, oxygen & air lab',x:17,z:-65,range:3.4,number:4},
  {id:'greenhouse1',label:'Greenhouse 1',x:-44,z:-51,range:6.5,number:5},
  {id:'greenhouse2',label:'Greenhouse 2',x:44,z:-51,range:6.5,number:6},
  {id:'garage',label:'Garage planning terminal',x:19,z:-11,range:3.5,number:7},
  {id:'field-sensor',label:'Silent field sensor',x:230,z:180,range:9,number:8},
  {id:'shelter',label:'Habitat shelter checks',x:-17,z:-65,range:3.4,number:9},
  {id:'heritage',label:'Curiosity heritage marker',x:-80,z:250,range:8,number:10},
  {id:'landmark',label:'Survey overlook',x:120,z:290,range:9,number:11},
];

export const ELYSIUM_ROUTES = {
  direct: [{x:26,z:-13},{x:130,z:60},{x:230,z:180}],
  ridge: [{x:26,z:-13},{x:80,z:-120},{x:300,z:-60},{x:230,z:180}],
  valley: [{x:26,z:-13},{x:-110,z:40},{x:-80,z:250},{x:80,z:310},{x:230,z:180}],
} as const;

export function nearestElysiumSite(x:number,z:number) {
  let nearest:ElysiumSite|null=null, distance=Infinity;
  for(const site of ELYSIUM_SITES){
    const d=Math.hypot(site.x-x,site.z-z);
    if(d<=site.range&&d<distance){nearest=site;distance=d;}
  }
  return nearest;
}
