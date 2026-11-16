import { browserThrottledFrame, calibrationCandidates, summarizeFrames, type AutoProfile, type GraphicsTrial } from './autoGraphics.ts';
import { MOBILE_MIN_RENDER_SCALE, MOBILE_TARGET_FPS } from './mobileGraphics.ts';
type Candidate = {
  profile: AutoProfile;
  scale: number;
};
type Decision = {
  trial: GraphicsTrial;
  next: Candidate;
  complete: boolean;
  selected?: GraphicsTrial;
};
/** Passive samples from the existing game loop: no second renderer, camera move or timer. */
export function createBackgroundGraphics(displayRatio: number, cap: (profile: AutoProfile) => number, options: {mobile?: boolean} = {}) {
  const minimumScale = Math.min(Math.max(.55, displayRatio), cap('performance'), MOBILE_MIN_RENDER_SCALE);
  const candidates = calibrationCandidates(displayRatio, cap, options.mobile).filter(candidate => !options.mobile ||
    (candidate.profile !== 'ultra' && candidate.scale >= minimumScale));
  const nativePerformance = Math.min(Math.max(.55, Math.min(2, displayRatio)), cap('performance'));
  const levels = candidates.filter(c => c.profile !== 'performance' || c.scale === nativePerformance).reverse();
  const rescue = candidates.filter(c => c.profile === 'performance' && c.scale < nativePerformance);
  let level = 0, rescueIndex = -1, current = levels[0], complete = false, best: GraphicsTrial | undefined;
  const samples = new Float64Array(180), trials: GraphicsTrial[] = [];
  let count = 0, elapsed = 0, warm = 6;
  const reset = () => { count = 0; elapsed = 0; warm = 6; };
  return {
    candidate: () => current, done: () => complete, trials: () => trials,
    reset,
    frame(intervalMs: number, workMs: number, eligible: boolean): Decision | null {
      if (complete)
        return null;
      if (!eligible || !Number.isFinite(intervalMs) || intervalMs <= 0 || browserThrottledFrame(intervalMs, workMs)) {
        reset();
        return null;
      }
      if (warm > 0) {
        warm--;
        return null;
      }
      samples[count++] = intervalMs;
      elapsed += intervalMs;
      if (elapsed < 1000 && count < samples.length)
        return null;
      const trial = { ...current, ...summarizeFrames(samples.subarray(0, count), options.mobile ? MOBILE_TARGET_FPS : 40) };
      trials.push(trial);
      reset();
      if (trial.meetsTarget) {
        best = trial;
        if (rescueIndex < 0 && level + 1 < levels.length)
          current = levels[++level];
        else
          complete = true;
      }
      else if (best) {
        current = { profile: best.profile, scale: best.scale };
        complete = true;
      }
      else if (rescueIndex + 1 < rescue.length)
        current = rescue[++rescueIndex];
      else
        complete = true;
      return { trial, next: current, complete, selected: complete ? (best ?? trial) : undefined };
    },
  };
}
