/**
 * Bounded rendering costs (TASKS T16). Two small pieces of shared state, both outside React:
 *
 * 1. Shadow map on demand. The sun’s shadow map is redrawn only when something that casts a shadow changed
 *    (a hull appeared, left or changed level of detail) or the shadow frustum moved. Orbiting around a fixed
 *    target reuses the last map, which removes the whole shadow pass from those frames.
 * 2. Adaptive pixel ratio. While the camera moves, the canvas pixel ratio steps down if frames run long and
 *    creeps back up when they are comfortably short; when the scene comes to rest it redraws once at the full
 *    capped ratio, so a still view is always sharp. The selected boat’s geometry and materials never change.
 */
let version = 1;
/** Call when shadow casters change. */
export const invalidateShadows = () => {
  version += 1;
};
export const shadowVersion = () => version;

let shadowUpdates = 0;
export const countShadowUpdate = () => {
  shadowUpdates += 1;
};
export const shadowUpdateCount = () => shadowUpdates;

export const MAX_DPR = 1.75;
export const MIN_DPR = 1;
export const DPR_STEP = 0.25;
/** Mean frame time (ms) over the sample window above which the moving pixel ratio steps down / below which it may step up. */
export const SLOW_FRAME_MS = 24;
export const FAST_FRAME_MS = 17.5;
export const SAMPLE_FRAMES = 40;

/** Pure step rule, unit-tested: returns the next moving pixel ratio for a window of frame times. */
export function nextMovingDpr(current: number, meanFrameMs: number, max: number): number {
  if (meanFrameMs > SLOW_FRAME_MS) return Math.max(MIN_DPR, Math.round((current - DPR_STEP) * 100) / 100);
  if (meanFrameMs < FAST_FRAME_MS) return Math.min(max, Math.round((current + DPR_STEP) * 100) / 100);
  return current;
}
