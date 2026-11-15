/** Fictional cultivation district, in game metres; no crop-yield claim. */
export const GREENHOUSE_SITES = [
  {id: 'gh01', label: 'Greenhouse 01', x: -44, z: -51, yaw: Math.PI / 2},
  {id: 'gh02', label: 'Greenhouse 02', x: 44, z: -51, yaw: -Math.PI / 2},
  {id: 'gh03', label: 'Greenhouse 03', x: -44, z: -79, yaw: Math.PI / 2},
  {id: 'gh04', label: 'Greenhouse 04', x: 44, z: -79, yaw: -Math.PI / 2},
  {id: 'gh05', label: 'Greenhouse 05', x: -18, z: -114, yaw: 0},
  {id: 'gh06', label: 'Greenhouse 06', x: 18, z: -114, yaw: 0},
] as const;

export type GreenhouseSite = {id: string; label: string; x: number; z: number; yaw: number};
export const GREENHOUSE_PAD = {halfSize: 7.3, blend: 7, foundationOffset: .30} as const;

export function greenhouseGradeWeight(x: number, z: number, site: GreenhouseSite) {
  const dx = Math.max(0, Math.abs(x - site.x) - GREENHOUSE_PAD.halfSize);
  const dz = Math.max(0, Math.abs(z - site.z) - GREENHOUSE_PAD.halfSize);
  const t = Math.min(1, Math.hypot(dx, dz) / GREENHOUSE_PAD.blend);
  return 1 - t * t * (3 - 2 * t);
}

export function greenhouseClearing(x: number, z: number, margin = 0) {
  const radius = GREENHOUSE_PAD.halfSize + margin;
  return GREENHOUSE_SITES.some(site => Math.abs(x - site.x) <= radius && Math.abs(z - site.z) <= radius);
}

export function gradeGreenhouseTerrain(x: number, z: number, height: number, padHeights: readonly number[], protectedWeight = 0) {
  for (let i = 0; i < GREENHOUSE_SITES.length; i++) {
    const weight = greenhouseGradeWeight(x, z, GREENHOUSE_SITES[i]);
    // Overlapping blend shoulders must never bend either facility's flat pad.
    const blend = weight * (1-protectedWeight) / Math.max(1e-8, 1-weight*protectedWeight);
    if (blend > 0) height += (padHeights[i] - height) * blend;
  }
  return height;
}
