/** Artistic site grading, in game metres; not a change to the NASA MOLA data. */
export const OUTPOST_SITE = {
  x: 0, z: -65, scale: 1, foundationOffset: .1,
  minX: -32, maxX: 30, minZ: -32, maxZ: 21, blend: 12,
} as const;

export function outpostClearing(x: number, z: number, margin = 0) {
  const px = x - OUTPOST_SITE.x, pz = z - OUTPOST_SITE.z;
  return px >= OUTPOST_SITE.minX - margin && px <= OUTPOST_SITE.maxX + margin
    && pz >= OUTPOST_SITE.minZ - margin && pz <= OUTPOST_SITE.maxZ + margin;
}

export function outpostGradeWeight(x: number, z: number) {
  const px = x - OUTPOST_SITE.x, pz = z - OUTPOST_SITE.z;
  const dx = Math.max(OUTPOST_SITE.minX - px, 0, px - OUTPOST_SITE.maxX);
  const dz = Math.max(OUTPOST_SITE.minZ - pz, 0, pz - OUTPOST_SITE.maxZ);
  const t = Math.min(1, Math.hypot(dx, dz) / OUTPOST_SITE.blend);
  return 1 - t * t * (3 - 2 * t);
}

export function gradeOutpostTerrain(x: number, z: number, naturalHeight: number, padHeight: number) {
  const weight = outpostGradeWeight(x, z);
  return naturalHeight + (padHeight - naturalHeight) * weight;
}
