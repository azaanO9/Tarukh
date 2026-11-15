export const CHUNK_SIZE = 70;
export const CHUNK_RADIUS = 3;
/** Outside the campus, 2m cells preserve the same interpolated surface for drawing and contact. */
export const TERRAIN_SAMPLE_STEP = 2;
// Rectangular mountain colliders enforce the region bounds; this legacy scalar must not clamp to 176m.
export const STREAM_LIMIT = Number.POSITIVE_INFINITY;
/** Conservative local-only hints; no device fingerprint is saved or sent. */
function hasStreamingHeadroom(gpu:string, cores:number, memory:number|undefined, mobile:boolean, quality:string) {
 return !mobile && quality !== "performance" && cores >= 8 && (memory === undefined || memory >= 8)
   && /geforce (?:rtx|gtx 16)|radeon rx [67][6789]00|apple m[234]/i.test(gpu)
   && !/software|swiftshader|intel|uhd|iris/i.test(gpu);
}
/** Every device keeps a bounded pool of detail tiles inside the finite MOLA region. */
export function streamingBudget(gpu:string,cores:number,memory:number|undefined,mobile:boolean,quality:string){
 const light=!hasStreamingHeadroom(gpu,cores,memory,mobile,quality);
 return {radius:light?2:3,rocks:light?8:18,pebbles:light?12:32,generationMs:light?.75:2,fog:light?.016:.01};
}
const hash=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
export function streamedRock(cx:number,cz:number,index:number){
 const seed=cx*113+cz*7919+index*37;
 const size=.45+hash(seed+2)*1.35;
 return {x:cx*CHUNK_SIZE+6+hash(seed)*58,z:cz*CHUNK_SIZE+6+hash(seed+1)*58,
  sx:size*(.75+hash(seed+3)*.55),sy:size*(.5+hash(seed+4)*.55),sz:size*(.8+hash(seed+5)*.5),yaw:hash(seed+6)*Math.PI*2,tint:hash(seed+7)};
}
export function chunkKey(x:number,z:number){return `${x},${z}`;}
export function isBaseChunk(x:number,z:number){return x>=-3&&x<3&&z>=-3&&z<3;}
/** Which side of a detail tile shares the campus's finer one-metre perimeter. */
export function baseBorderSide(x:number,z:number){
 if(z>=-3&&z<3){if(x===3)return 1;if(x===-4)return 2;}
 if(x>=-3&&x<3){if(z===3)return 3;if(z===-4)return 4;}
 return 0;
}
function triangleHeight(x:number,z:number,ax:number,az:number,a:number,bx:number,bz:number,b:number,cx:number,cz:number,c:number){
 const denominator=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
 const wa=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/denominator;
 const wb=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/denominator;
 return wa*a+wb*b+(1-wa-wb)*c;
}
export function streamedHeight(x:number,z:number,height:(x:number,z:number)=>number){
 if(Math.abs(x)===210&&Math.abs(z)<=210){const k=Math.floor(z),t=z-k;return height(x,k)*(1-t)+height(x,k+1)*t;}
 if(Math.abs(z)===210&&Math.abs(x)<=210){const k=Math.floor(x),t=x-k;return height(k,z)*(1-t)+height(k+1,z)*t;}
 const step=TERRAIN_SAMPLE_STEP,ix=Math.floor(x/step)*step,iz=Math.floor(z/step)*step,u=(x-ix)/step,v=(z-iz)/step;
 const a=height(ix,iz),b=height(ix+step,iz),c=height(ix,iz+step),d=height(ix+step,iz+step);
 // The one-metre midpoints on the campus perimeter split only its adjacent
 // triangles; contact uses the identical triangles as the rendered stitch.
 if(ix===210&&iz>=-210&&iz<210&&u+v<=1){
  const m=height(ix,iz+1);
  return v<=(1-u)*.5?triangleHeight(u,v,0,0,a,0,.5,m,1,0,b):triangleHeight(u,v,0,.5,m,0,1,c,1,0,b);
 }
 if(ix===-212&&iz>=-210&&iz<210&&u+v>=1){
  const m=height(ix+2,iz+1);
  return v>=1-u*.5?triangleHeight(u,v,0,1,c,1,1,d,1,.5,m):triangleHeight(u,v,0,1,c,1,.5,m,1,0,b);
 }
 if(iz===210&&ix>=-210&&ix<210&&u+v<=1){
  const m=height(ix+1,iz);
  return u<=(1-v)*.5?triangleHeight(u,v,0,0,a,0,1,c,.5,0,m):triangleHeight(u,v,.5,0,m,0,1,c,1,0,b);
 }
 if(iz===-212&&ix>=-210&&ix<210&&u+v>=1){
  const m=height(ix+1,iz+2);
  return u>=1-v*.5?triangleHeight(u,v,.5,1,m,1,1,d,1,0,b):triangleHeight(u,v,0,1,c,.5,1,m,1,0,b);
 }
 return u+v<=1?a+u*(b-a)+v*(c-a):d+(1-v)*(b-d)+(1-u)*(c-d);
}
