import { CURIOSITY_LIMIT, type SavedCuriosityState } from "./curiosityRover.ts";

export const CURIOSITY_SAVE_KEY = "tarukh.mars.curiosity.v1";
const scanStages = new Set(["none", "deploy", "laser", "stow"]);

function finiteInRange(value: unknown, limit: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit;
}

/** Validate serialized Curiosity rover state before restoring from browser storage. */
export function parseCuriositySave(raw: string | null): SavedCuriosityState | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const s = value as Record<string, unknown>;
    if (s.version !== 1) return null;
    if (!finiteInRange(s.x, CURIOSITY_LIMIT) || !finiteInRange(s.z, CURIOSITY_LIMIT)) return null;
    if (typeof s.yaw !== "number" || !Number.isFinite(s.yaw)) return null;
    if (!finiteInRange(s.targetX, CURIOSITY_LIMIT) || !finiteInRange(s.targetZ, CURIOSITY_LIMIT)) return null;
    if (s.targetZone !== "colony" && s.targetZone !== "plains") return null;
    if (s.phase !== "driving" && s.phase !== "scanning") return null;
    if (typeof s.scanStage !== "string" || !scanStages.has(s.scanStage)) return null;
    if (typeof s.scanTimer !== "number" || !Number.isFinite(s.scanTimer) || s.scanTimer < 0 || s.scanTimer > 30) return null;
    if (typeof s.driveTimer !== "number" || !Number.isFinite(s.driveTimer) || s.driveTimer < 0 || s.driveTimer > 600) return null;
    if (typeof s.nextScanAfter !== "number" || !Number.isFinite(s.nextScanAfter) || s.nextScanAfter <= 0 || s.nextScanAfter > 120) return null;
    if (!Number.isInteger(s.scanCount) || (s.scanCount as number) < 0) return null;
    if (typeof s.lastScanSample !== "string" || s.lastScanSample.length > 200) return null;
    if (!Number.isInteger(s.rngSeed) || (s.rngSeed as number) < 0) return null;
    if (!Array.isArray(s.recentTargets) || s.recentTargets.length > 16) return null;
    for (const pt of s.recentTargets) {
      if (!pt || typeof pt !== "object") return null;
      const p = pt as Record<string, unknown>;
      if (!finiteInRange(p.x, CURIOSITY_LIMIT) || !finiteInRange(p.z, CURIOSITY_LIMIT)) return null;
    }
    return s as unknown as SavedCuriosityState;
  } catch {
    return null;
  }
}
