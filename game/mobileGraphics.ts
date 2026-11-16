import { graphicsTier } from '../ui/world/graphicsTiers.ts';
import { createAutoGraphics, type AutoProfile } from './autoGraphics.ts';

// Keep small silhouettes readable instead of chasing 60 Hz at half resolution.
export const MOBILE_TARGET_FPS = 40;
export const MOBILE_MIN_RENDER_SCALE = .85;

/** Mobile budgets reduce fill rate and optional detail without changing collision geometry. */
const budgets = {
  performance: { resolutionCap: 1, viewDistance: 220, shadowSize: 512, shadows: false, ssao: false, bloom: false, particles: 16, smallRocks: 1200 },
  auto: { resolutionCap: 1.1, viewDistance: 300, shadowSize: 512, shadows: true, ssao: false, bloom: false, particles: 40, smallRocks: 2500 },
  high: { resolutionCap: 1.25, viewDistance: 400, shadowSize: 768, shadows: true, ssao: false, bloom: false, particles: 72, smallRocks: 4000 },
  ultra: { resolutionCap: 1.5, viewDistance: 520, shadowSize: 1024, shadows: true, ssao: true, bloom: true, particles: 120, smallRocks: 5000 },
} as const;
type MobileTier = { [Key in keyof ReturnType<typeof graphicsTier>]: ReturnType<typeof graphicsTier>[Key] extends boolean ? boolean : number };
const tiers = Object.fromEntries(Object.entries(budgets).map(([name, budget]) => [name, {
  ...graphicsTier(name), ...budget, terrainTexture: 512,
}])) as Record<string, MobileTier>;
const automaticTiers = Object.fromEntries(Object.entries(tiers).map(([name, tier]) => [name, {
  ...tier, shadows: false, ssao: false, bloom: false,
}])) as Record<string, MobileTier>;

export function mobileGraphicsTier(name: string, automatic = false) {
  const selected = automatic ? automaticTiers : tiers;
  return selected[name] ?? selected.auto;
}

/** Hints only choose a safe pixel budget; measured frames still select the detail tier. */
export function mobileAutoPixelCap(cores: number, memory: number | undefined, gpu: string, saveData: boolean) {
  if (saveData || (memory !== undefined && memory <= 4) || (cores > 0 && cores <= 4) || /swiftshader|software/i.test(gpu)) return 1;
  return 1.25;
}

/** A busy loading sample must not permanently lock a phone into the rescue preset. */
export function createMobileAutoGraphics(profile: AutoProfile, scale: number, maximumScale: number) {
  return { ...createAutoGraphics(profile, scale), ceiling: 'high' as const, ceilingScale: maximumScale };
}

/** Idle panels redraw at 10 Hz; active mobile scenes never burn power above 60 Hz. */
export function createRenderPacer() { return {next: 0, interval: 0}; }
export function renderFrameDue(time: number, mobile: boolean, paused: boolean, state: ReturnType<typeof createRenderPacer>) {
  const interval = paused ? 100 : mobile ? 1000 / 60 : 0;
  if (state.interval !== interval) { state.next = 0; state.interval = interval; }
  if (time + .75 < state.next) return false;
  state.next = state.next < time - interval ? time + interval : state.next + interval;
  return true;
}
