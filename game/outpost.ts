import {boxObstacle, type CollisionObstacle} from './collision.ts';
import {OUTPOST_SITE} from './outpostSite.ts';

export type OutpostDoorDefinition = {
  id: string; label: string; clip: string; position: number[]; normal: number[];
  halfWidth: number; halfDepth: number; interactionRange: number;
};
export type OutpostLayout = {
  version: number; boxes: number[][];
  floor: {x: number; z: number; cell: number; width: number; depth: number; runs: number[][]};
  doors: OutpostDoorDefinition[];
};
export type OutpostDoor = {
  id: string; label: string; clip: string; x: number; y: number; z: number;
  nx: number; nz: number; halfWidth: number; halfDepth: number; range: number;
  amount: number; target: number; blocked: boolean; collider: CollisionObstacle;
  /** Shared door controls; only gates enclosing a small airlock chamber are paired. */
  pair?: OutpostDoor; waiting?: boolean; clearSeconds?: number; autoCloseSeconds?: number;
  safetyDepth?: number;
};

export const OUTPOST_AUTO_CLOSE_SECONDS = 2;
export const OUTPOST_AIRLOCK_PAIRS = [
  ['west_command','west_crew'], ['east_command','east_lab'],
  ['north_command','north_transit'], ['botany_transit','botany_lab'],
  ['observatory_transit','observatory_dome'],
] as const;

export function createOutpostState(layout: OutpostLayout, baseY: number) {
  if (layout.version !== 1) throw new Error('Unsupported outpost layout');
  const floor = layout.floor;
  const heights = new Int16Array(floor.width * floor.depth);
  let offset = 0;
  for (const [count, height] of floor.runs) {
    if (count < 1 || offset + count > heights.length) throw new Error('Invalid outpost floor data');
    heights.fill(height, offset, offset + count); offset += count;
  }
  if (offset !== heights.length) throw new Error('Incomplete outpost floor data');
  const obstacles = layout.boxes.map(([x,z,hx,hz],index) => boxObstacle(x+OUTPOST_SITE.x,z+OUTPOST_SITE.z,hx,hz,`outpost-wall-${index}`));
  const doors: OutpostDoor[] = layout.doors.map(d => {
    const x=OUTPOST_SITE.x+d.position[0],z=OUTPOST_SITE.z-d.position[1],nx=d.normal[0],nz=-d.normal[1];
    const leafDepth=d.id==='entrance'?.12:.09;
    const collider=boxObstacle(x,z,Math.abs(nx)*leafDepth+Math.abs(nz)*d.halfWidth,Math.abs(nz)*leafDepth+Math.abs(nx)*d.halfWidth,`outpost-door-${d.id}`);
    obstacles.push(collider);
    return {id:d.id,label:d.label,clip:d.clip,x,y:baseY+d.position[2],z,nx,nz,halfWidth:d.halfWidth,halfDepth:d.halfDepth,range:d.interactionRange,
      amount:0,target:0,blocked:false,collider,waiting:false,clearSeconds:0,autoCloseSeconds:OUTPOST_AUTO_CLOSE_SECONDS,
      // Protect the actual moving leaf plus the 0.32m player radius and 0.1m
      // clearance. The larger frame depth would nearly fill the short chambers.
      safetyDepth:leafDepth+.42};
  });
  for(const [a,b] of OUTPOST_AIRLOCK_PAIRS){
    const first=doors.find(door=>door.id===a),second=doors.find(door=>door.id===b);
    if(first&&second){first.pair=second;second.pair=first;}
  }
  function floorAt(x:number,z:number,ground:number) {
    const u=(x-OUTPOST_SITE.x-floor.x)/floor.cell,v=(z-OUTPOST_SITE.z-floor.z)/floor.cell;
    const ix=Math.floor(u),iz=Math.floor(v);
    if(ix<0||iz<0||ix>=floor.width-1||iz>=floor.depth-1)return ground;
    const index=iz*floor.width+ix,a=heights[index],b=heights[index+1],c=heights[index+floor.width],d=heights[index+floor.width+1];
    if(a===-32768||b===-32768||c===-32768||d===-32768){
      const nearest=heights[Math.round(v)*floor.width+Math.round(u)];
      return nearest===-32768?ground:Math.max(ground,baseY+nearest/1000);
    }
    const fx=u-ix,fz=v-iz;
    return Math.max(ground,baseY+((a*(1-fx)+b*fx)*(1-fz)+(c*(1-fx)+d*fx)*fz)/1000);
  }
  return {doors,obstacles,floorAt};
}

export function occupiesOutpostDoor(door:OutpostDoor,x:number,feetY:number,z:number) {
  const dx=x-door.x,dz=z-door.z;
  return feetY<door.y+2.5&&feetY+1.8>door.y
    && Math.abs(dx*door.nx+dz*door.nz)<(door.safetyDepth??door.halfDepth+.42)
    && Math.abs(dx*-door.nz+dz*door.nx)<door.halfWidth+.32;
}

export function nearestOutpostDoor(doors:readonly OutpostDoor[],x:number,y:number,z:number,yaw:number) {
  let selected:OutpostDoor|null=null,best=Infinity;
  const fx=-Math.sin(yaw),fz=-Math.cos(yaw);
  for(const door of doors){
    const dx=door.x-x,dz=door.z-z,distance=Math.hypot(dx,dz);
    if(distance>door.range||y>door.y+2.2||y+1.8<door.y)continue;
    const facing=distance>.05?(dx*fx+dz*fz)/distance:1;
    if(facing<-.05||Math.abs(dx*-door.nz+dz*door.nx)>door.halfWidth+.65)continue;
    const score=distance+(1-facing)*1.4;
    if(score<best){best=score;selected=door;}
  }
  return selected;
}

export function toggleOutpostDoor(door:OutpostDoor,x:number,y:number,z:number) {
  if(door.waiting){door.waiting=false;door.target=0;door.blocked=false;door.clearSeconds=0;return true;}
  if(door.target===1&&occupiesOutpostDoor(door,x,y,z)){
    door.blocked=true;door.clearSeconds=0;return false;
  }
  const opening=door.target!==1;
  door.clearSeconds=0;door.blocked=false;
  if(opening&&door.pair){
    const other=door.pair;
    other.waiting=false;
    if(other.amount>0||other.target===1){
      door.waiting=true;door.target=0;
      if(!occupiesOutpostDoor(other,x,y,z)){other.target=0;other.blocked=false;}
      else other.blocked=true;
      return true;
    }
  }
  door.target=opening?1:0;return true;
}

export function stepOutpostDoor(door:OutpostDoor,dt:number,x:number,y:number,z:number) {
  if(!Number.isFinite(dt)||dt<=0)return false;
  const step=Math.min(dt,.1);
  const occupied=occupiesOutpostDoor(door,x,y,z);
  if(door.blocked&&!occupied)door.blocked=false;
  if(door.waiting&&door.pair){
    const other=door.pair;
    if(!occupiesOutpostDoor(other,x,y,z)){other.target=0;other.blocked=false;}
    else other.blocked=true;
    if(other.amount===0&&other.target===0){
      door.waiting=false;door.target=1;door.clearSeconds=0;
    }
  }
  if(door.autoCloseSeconds!==undefined){
    if(occupied||door.target!==1||door.amount<1)door.clearSeconds=0;
    else{
      door.clearSeconds=(door.clearSeconds??0)+step;
      if(door.clearSeconds>=door.autoCloseSeconds)door.target=0;
    }
  }
  if(door.target===0&&door.amount>0&&occupied){
    door.target=1;door.blocked=true;door.clearSeconds=0;
  }
  const delta=door.target-door.amount;
  if(Math.abs(delta)<1e-7)return false;
  door.amount+=Math.sign(delta)*Math.min(Math.abs(delta),step*.6);
  door.collider.disabled=door.amount>.96;
  return true;
}
