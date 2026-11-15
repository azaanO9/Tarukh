import {boxObstacle, type CollisionObstacle} from './collision.ts';
import {GREENHOUSE_PAD, GREENHOUSE_SCALE, GREENHOUSE_SITES, type GreenhouseSite} from './greenhouseSites.ts';
import type {OutpostDoor} from './outpost.ts';

export type GreenhouseLayout = {
  version: number;
  deckHeight: number;
  deckOutline: number[][];
  walls: number[][];
  furniture: {name: string; hull: number[][]}[];
  doors: {id: string; label: string; x: number; z: number; nx: number; nz: number; halfWidth: number; halfDepth: number; travel: number}[];
  ramp: {start: number; length: number; halfWidth: number};
};

export function greenhousePoint(site: GreenhouseSite, x: number, z: number) {
  const c = Math.cos(site.yaw), s = Math.sin(site.yaw);
  return {x: site.x + (c * x + s * z) * GREENHOUSE_SCALE, z: site.z + (-s * x + c * z) * GREENHOUSE_SCALE};
}

function insideOutline(x: number, z: number, outline: readonly number[][]) {
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    if ((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]) < -.001) return false;
  }
  return true;
}

export function createGreenhouseStates(layout: GreenhouseLayout, groundHeights: readonly number[]) {
  if (layout.version !== 1 || groundHeights.length !== GREENHOUSE_SITES.length) throw new Error('Invalid greenhouse layout');
  return GREENHOUSE_SITES.map((site, index) => {
    const c = Math.cos(site.yaw), s = Math.sin(site.yaw);
    const baseY = groundHeights[index] + GREENHOUSE_PAD.foundationOffset;
    const obstacles: CollisionObstacle[] = layout.walls.map(([x,z,hx,hz,yaw], i) => {
      const p = greenhousePoint(site, x, z);
      return boxObstacle(p.x, p.z, hx * GREENHOUSE_SCALE, hz * GREENHOUSE_SCALE, `${site.id}-wall-${i}`, site.yaw + yaw);
    });
    for (const [i, furniture] of layout.furniture.entries()) {
      const points = furniture.hull.map(p => greenhousePoint(site, p[0], p[1]));
      const x = points.reduce((sum,p) => sum + p.x, 0) / points.length;
      const z = points.reduce((sum,p) => sum + p.z, 0) / points.length;
      const hull = points.map(p => ({x: p.x - x, z: p.z - z}));
      obstacles.push({x, z, radius: Math.max(...hull.map(p => Math.hypot(p.x,p.z))), hull, hullForWalking:true, id: `${site.id}-equipment-${i}`});
    }
    // Measured bounds of the existing central grow computer, now reachable through the beds.
    obstacles.push(boxObstacle(site.x,site.z,.454 * GREENHOUSE_SCALE,.388 * GREENHOUSE_SCALE,`${site.id}-equipment-control`,site.yaw));
    const doors: OutpostDoor[] = layout.doors.map(d => {
      const p = greenhousePoint(site, d.x, d.z);
      const nx = c * d.nx + s * d.nz, nz = -s * d.nx + c * d.nz;
      const collider = boxObstacle(p.x, p.z, d.halfWidth * GREENHOUSE_SCALE, d.halfDepth * GREENHOUSE_SCALE, `${site.id}-door-${d.id}`, Math.atan2(nx,nz));
      obstacles.push(collider);
      return {id: `${site.id}-${d.id}`, label: `${site.label} · ${d.label}`, clip: d.id,
        x: p.x, y: baseY + layout.deckHeight * GREENHOUSE_SCALE, z: p.z, nx, nz,
        halfWidth: d.halfWidth * GREENHOUSE_SCALE, halfDepth: .42 * GREENHOUSE_SCALE, range: 2.8,
        amount: 0, target: 0, blocked: false, collider};
    });
    function inside(x: number, z: number) {
      const dx = (x - site.x) / GREENHOUSE_SCALE, dz = (z - site.z) / GREENHOUSE_SCALE;
      return Math.abs(dx) < 6 && Math.abs(dz) < 6 && insideOutline(c*dx-s*dz, s*dx+c*dz, layout.deckOutline);
    }
    function floorAt(x: number, z: number, ground: number) {
      const dx = (x - site.x) / GREENHOUSE_SCALE, dz = (z - site.z) / GREENHOUSE_SCALE;
      if (Math.abs(dx) > 8 || Math.abs(dz) > 8) return ground;
      const lx = c*dx-s*dz, lz = s*dx+c*dz;
      if (insideOutline(lx,lz,layout.deckOutline)) return Math.max(ground, baseY + layout.deckHeight * GREENHOUSE_SCALE);
      for (const d of layout.doors) {
        const xOffset = lx-d.x, zOffset = lz-d.z;
        const forward = xOffset*d.nx+zOffset*d.nz-layout.ramp.start;
        const across = xOffset*d.nz-zOffset*d.nx;
        if (forward >= -.04 && forward <= layout.ramp.length && Math.abs(across) <= layout.ramp.halfWidth) {
          const rise = (GREENHOUSE_PAD.foundationOffset + layout.deckHeight * GREENHOUSE_SCALE) * (1-Math.max(0,forward)/layout.ramp.length);
          return Math.max(ground, groundHeights[index] + rise);
        }
      }
      return ground;
    }
    return {site, baseY, obstacles, doors, inside, floorAt};
  });
}

export type GreenhouseState = ReturnType<typeof createGreenhouseStates>[number];
