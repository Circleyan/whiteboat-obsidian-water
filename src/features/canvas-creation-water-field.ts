export {
  CANVAS_CREATION_STATIONARY_WAKE_RADIUS_SCALE,
  CANVAS_CREATION_WAKE_FADE_TIER_COUNT,
  CANVAS_CREATION_WATER_DEFAULTS,
  clampWaterValue,
  hashWaterPoint,
  resolveCanvasCreationWakeFadeTier,
  resolveCanvasCreationWaterQuality,
  resolveCanvasCreationWaterTopInset,
  sampleCanvasCreationBaseVector,
  sampleCanvasCreationBoatResponse,
  sampleCanvasCreationFieldVector,
  sampleCanvasCreationFlowPosition,
  sampleCanvasCreationWakeAccent,
  smoothWaterStep,
} from "whiteboat-core";
export type {
  CanvasCreationWaterBoat,
  CanvasCreationWaterWake,
} from "whiteboat-core";

import {
  resolveCanvasCreationCssPixels as resolveCoreCssPixels,
} from "whiteboat-core";

export { ObsidianDiscWaterField as CanvasCreationWaterField } from "./obsidian-disc-water-field";

export function resolveCanvasCreationCssPixels(root: HTMLElement, name: string, fallback: string): number {
  return resolveCoreCssPixels(root, name, fallback, (parent) => parent.createDiv());
}
