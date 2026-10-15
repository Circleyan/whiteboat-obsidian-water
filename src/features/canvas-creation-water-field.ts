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
  CanvasCreationWaterField as CoreWaterField,
  resolveCanvasCreationCssPixels as resolveCoreCssPixels,
} from "whiteboat-core";

/** DOM and frame ownership belong to the Obsidian adapter. */
export class CanvasCreationWaterField extends CoreWaterField {
  constructor(canvas: HTMLCanvasElement, options: Omit<ConstructorParameters<typeof CoreWaterField>[1], "createProbe" | "ownerWindow">) {
    super(canvas, {
      ...options,
      createProbe: (root) => root.createDiv(),
      ownerWindow: canvas.win,
    });
  }
}

export function resolveCanvasCreationCssPixels(root: HTMLElement, name: string, fallback: string): number {
  return resolveCoreCssPixels(root, name, fallback, (parent) => parent.createDiv());
}
