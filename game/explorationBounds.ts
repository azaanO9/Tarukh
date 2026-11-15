import {REGION_WORLD_BOUNDS} from './marsRegion.ts';
import {boxObstacle, type CollisionObstacle} from './collision.ts';

/** Real MOLA crop limits; the perimeter ridge is an authored game boundary, not NASA relief. */
export const EXPLORATION_BOUNDS = REGION_WORLD_BOUNDS;
export const BOUNDARY_RIDGE_WIDTH = 90;
export const BOUNDARY_WALL_INSET = 72;
export const PLAYABLE_BOUNDS = {
  west: EXPLORATION_BOUNDS.west + BOUNDARY_WALL_INSET,
  east: EXPLORATION_BOUNDS.east - BOUNDARY_WALL_INSET,
  north: EXPLORATION_BOUNDS.north + BOUNDARY_WALL_INSET,
  south: EXPLORATION_BOUNDS.south - BOUNDARY_WALL_INSET,
} as const;

/** Only tiles intersecting the finite surveyed crop may enter the detail pool. */
export function isExplorationTile(x:number,z:number,size:number) {
  return (x+1)*size>EXPLORATION_BOUNDS.west && x*size<EXPLORATION_BOUNDS.east
    && (z+1)*size>EXPLORATION_BOUNDS.north && z*size<EXPLORATION_BOUNDS.south;
}

export function boundaryMountainHeight(x:number,z:number) {
  const distance=Math.min(x-EXPLORATION_BOUNDS.west,EXPLORATION_BOUNDS.east-x,z-EXPLORATION_BOUNDS.north,EXPLORATION_BOUNDS.south-z);
  if(distance>=BOUNDARY_RIDGE_WIDTH)return 0;
  const t=Math.max(0,Math.min(1,(BOUNDARY_RIDGE_WIDTH-distance)/BOUNDARY_RIDGE_WIDTH));
  const foot=t*t*(3-2*t);
  // A steep rocky face beyond the blocked toe, with an uneven skyline.
  const cliff=Math.max(0,Math.min(1,(t-.2)/.2));
  const crest=62+12*Math.sin(x*.043+z*.027)+8*Math.sin(x*.09-z*.071);
  return foot*16+cliff*cliff*(3-2*cliff)*crest;
}

/** No topY: these stay solid at every jump height for walkers and the rover. */
export function createExplorationBoundaryObstacles():CollisionObstacle[] {
  const b=PLAYABLE_BOUNDS, depth=128, cx=(b.west+b.east)/2, cz=(b.north+b.south)/2;
  const halfX=(b.east-b.west)/2+depth, halfZ=(b.south-b.north)/2+depth;
  return [
    boxObstacle(b.west-depth/2,cz,depth/2,halfZ,'boundary-west'),
    boxObstacle(b.east+depth/2,cz,depth/2,halfZ,'boundary-east'),
    boxObstacle(cx,b.north-depth/2,halfX,depth/2,'boundary-north'),
    boxObstacle(cx,b.south+depth/2,halfX,depth/2,'boundary-south'),
  ];
}
