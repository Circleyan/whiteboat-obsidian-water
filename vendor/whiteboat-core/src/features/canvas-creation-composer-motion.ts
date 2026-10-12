/**
 * Shared motion timing for the Canvas Creation composer (the floating window
 * opened over the water).
 *
 * Hosts render the composer with their own DOM and keyframe shapes, but its
 * durations and easings live here so every surface keyed to the composer —
 * the water flow stop/restart first among them — moves on the same clock.
 * Reference these values rather than restating the literals.
 */
export const CANVAS_CREATION_COMPOSER_MOTION = Object.freeze({
  /** Rises slightly and resolves from blur to sharp. */
  appear: Object.freeze({ durationMs: 640, easing: "cubic-bezier(.16,1,.3,1)" }),
  /** Accelerates away; the draft is kept. */
  cancel: Object.freeze({ durationMs: 240, easing: "cubic-bezier(.55,.055,.675,.19)" }),
  /** The non-interactive afterimage left at the old anchor on relocation. */
  relocateGhost: Object.freeze({ durationMs: 240, easing: "cubic-bezier(.55,.055,.675,.19)" }),
  /** Submission: the window folds and drops into the water. */
  confirm: Object.freeze({
    durationMs: 520,
    fadeDurationMs: 360,
    plainDurationMs: 180,
  }),
  /** Every state collapses to a short fade under reduced motion. */
  reducedDurationMs: 80,
});

export interface CanvasCreationWaterFlowTiming {
  pauseDurationMs: number;
  resumeDurationMs: number;
}

/**
 * The water stops while the composer appears and restarts while it is
 * dismissed, so both ends settle together.  Reduced motion snaps the flow
 * rather than following the composer's short fade.
 */
export function resolveCanvasCreationWaterFlowTiming(
  reducedMotion: boolean,
): CanvasCreationWaterFlowTiming {
  if (reducedMotion) {
    return { pauseDurationMs: 0, resumeDurationMs: 0 };
  }
  return {
    pauseDurationMs: CANVAS_CREATION_COMPOSER_MOTION.appear.durationMs,
    resumeDurationMs: CANVAS_CREATION_COMPOSER_MOTION.cancel.durationMs,
  };
}
