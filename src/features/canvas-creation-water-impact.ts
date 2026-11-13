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

import type { CanvasCreationWaterImpact, CanvasCreationWaterImpactOptions as CoreImpactOptions } from "whiteboat-core";
export type CanvasCreationWaterImpactOptions = Omit<CoreImpactOptions, "createCanvas">;

type ImpactFactory = (origin: { x: number; y: number }, options: CanvasCreationWaterImpactOptions) => CanvasCreationWaterImpact | null;
const materialImpacts = new WeakMap<HTMLCanvasElement, ImpactFactory>();

/** The live water material owns disturbance; the composer supplies its clock. */
export function registerCanvasCreationWaterImpact(source: HTMLCanvasElement, factory: ImpactFactory): () => void {
  materialImpacts.set(source, factory);
  return () => { if (materialImpacts.get(source) === factory) materialImpacts.delete(source); };
}

export function mountCanvasCreationWaterImpact(source: HTMLCanvasElement, origin: { x: number; y: number }, options: CanvasCreationWaterImpactOptions): CanvasCreationWaterImpact | null {
  return materialImpacts.get(source)?.(origin, options) ?? null;
}
