/** Local frame timings decide quality; GPU names and core counts never cap a tier. */
export const AUTO_TARGET_FPS = 40;
export const AUTO_PROBE_FPS = 43; // Small headroom for movement, streaming and UI.
export const AUTO_PROFILES = ['ultra', 'high', 'auto', 'performance'] as const;
export type AutoProfile = typeof AUTO_PROFILES[number];
export type FrameSummary = {
  fps: number;
  p90Ms: number;
  frames: number;
  meetsTarget: boolean;
};
export type GraphicsTrial = FrameSummary & {
  profile: AutoProfile;
  scale: number;
};
/** Occluded browsers can cap rAF at 1–4 Hz without setting document.hidden. */
export function browserThrottledFrame(intervalMs: number, renderWorkMs: number) {
  return intervalMs >= 250 && renderWorkMs < Math.min(25, intervalMs * .1);
}
export function summarizeFrames(samples: ArrayLike<number>, targetFps = AUTO_TARGET_FPS): FrameSummary {
  const valid = Array.from(samples).filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  const frames = valid.length, total = valid.reduce((sum, value) => sum + value, 0);
  const fps = total > 0 ? 1000 * frames / total : 0, p90Ms = frames ? valid[Math.ceil(frames * .9) - 1] : Infinity;
  const threshold = targetFps === 60 ? 57 : AUTO_PROBE_FPS;
  return { fps, p90Ms, frames, meetsTarget: frames >= 12 && fps >= threshold && p90Ms <= 1000 / (targetFps === 60 ? 50 : 38) };
}
export function profileName(profile: AutoProfile) {
  return profile === 'auto' ? 'Balanced' : profile[0].toUpperCase() + profile.slice(1);
}
export function calibrationCandidates(displayRatio: number, cap: (profile: AutoProfile) => number, includeAllProfiles = false) {
  const ratio = Math.max(.55, Math.min(2, displayRatio));
  const candidates = AUTO_PROFILES.map(profile => ({ profile, scale: Math.min(ratio, cap(profile)) }))
    // High/Ultra differ only in pixel cap; don't time the identical preset twice at 1× DPR.
    .filter((candidate, index, all) => includeAllProfiles || candidate.profile !== 'high' || candidate.scale !== all[index - 1].scale);
  for (const scale of [.85, .7, .55])
    if (scale < candidates.at(-1)!.scale - .01)
      candidates.push({ profile: 'performance', scale });
  return candidates;
}
export type AutoGraphicsState = {
  profile: AutoProfile;
  scale: number;
  ceiling: AutoProfile;
  ceilingScale: number;
  slow: number;
  fast: number;
  cooldownUntil: number;
};
export function createAutoGraphics(profile: AutoProfile, scale: number): AutoGraphicsState {
  return { profile, scale, ceiling: profile, ceilingScale: scale, slow: 0, fast: 0, cooldownUntil: 0 };
}
/** One sample per second. Hysteresis avoids chasing individual hitches or menu frames. */
export function adaptAutoGraphics(state: AutoGraphicsState, fps: number, active: boolean, now: number, cap: (profile: AutoProfile) => number, targetFps = AUTO_TARGET_FPS, minimumScale = .55): AutoGraphicsState {
  if (!active || !Number.isFinite(fps) || fps <= 0)
    return { ...state, slow: 0, fast: 0 };
  const next = { ...state, slow: fps < (targetFps === 60 ? 54 : targetFps) ? state.slow + 1 : 0, fast: fps >= (targetFps === 60 ? 58 : 50) ? state.fast + 1 : 0 };
  if (now < state.cooldownUntil)
    return next;
  const index = AUTO_PROFILES.indexOf(state.profile);
  if (next.slow >= 2) {
    // Preserve sharpness by dropping effects/detail before aggressively shrinking pixels.
    if (index < 3 && (fps < 30 || state.scale <= Math.min(1, cap(state.profile) * .8))) {
      next.profile = index === 0 && cap('ultra') === cap('high') ? 'auto' : AUTO_PROFILES[index + 1];
      next.scale = Math.min(state.scale, cap(next.profile));
    }
    else
      next.scale = Math.max(Math.min(minimumScale, cap(state.profile)), state.scale - .12);
    next.cooldownUntil = now + 5000;
    next.slow = next.fast = 0;
  }
  else if (next.fast >= 8) {
    const ceiling = Math.min(cap(state.profile), state.ceilingScale);
    if (state.scale < ceiling - .01)
      next.scale = Math.min(ceiling, state.scale + .08);
    else if (index > AUTO_PROFILES.indexOf(state.ceiling))
      next.profile = AUTO_PROFILES[index - 1];
    next.cooldownUntil = now + 8000;
    next.slow = next.fast = 0;
  }
  return next;
}
/** Small, infrequent buffer-size changes instead of one large resolution jump. */
export function approachRenderScale(current: number, target: number) {
  return Math.abs(target - current) < .041 ? target : current + Math.sign(target - current) * .04;
}
