export {
  CANVAS_CREATION_WATER_IMPACT_CANVAS_CLASS,
  CANVAS_CREATION_WATER_IMPACT_DURATION_SECONDS,
  CANVAS_CREATION_WATER_IMPACT_FIRST_RING_DELAY_SECONDS,
  CANVAS_CREATION_WATER_IMPACT_MAX_SCALE,
  CANVAS_CREATION_WATER_IMPACT_MIN_SCALE,
  CANVAS_CREATION_WATER_IMPACT_REACH_EXPONENT,
  CANVAS_CREATION_WATER_IMPACT_REACH_MARGIN,
  CANVAS_CREATION_WATER_IMPACT_REACH_SECONDS,
  CANVAS_CREATION_WATER_IMPACT_REFERENCE_POINT_WIDTH,
  isCanvasCreationWaterImpactActive,
  resolveCanvasCreationWaterImpactReach,
  resolveCanvasCreationWaterImpactRevealBand,
  resolveCanvasCreationWaterImpactRingRadius,
  resolveCanvasCreationWaterImpactScale,
} from "whiteboat-core";
export type {
  CanvasCreationWaterImpact,
} from "whiteboat-core";

import { mountCanvasCreationWaterImpact as mountCoreImpact, type CanvasCreationWaterImpactOptions as CoreImpactOptions } from "whiteboat-core";
export type CanvasCreationWaterImpactOptions = Omit<CoreImpactOptions, "createCanvas">;

export function mountCanvasCreationWaterImpact(source: HTMLCanvasElement, origin: { x: number; y: number }, options: CanvasCreationWaterImpactOptions) {
  return mountCoreImpact(source, origin, { ...options, createCanvas: () => createEl("canvas") });
}
