import { normalizeCanvasCreationLightIntensity, normalizeCanvasCreationWaterDepth } from "./features/canvas-creation-light";
export interface WaterAdjustment { lightIntensity: number; waterDepth: number }
export function normalizeWaterAdjustment(value: WaterAdjustment): WaterAdjustment {
  return { lightIntensity: normalizeCanvasCreationLightIntensity(value.lightIntensity), waterDepth: normalizeCanvasCreationWaterDepth(value.waterDepth) };
}
export function waterAdjustmentAt(x: number, y: number): WaterAdjustment {
  return normalizeWaterAdjustment({ lightIntensity: .6 + Math.max(0, Math.min(1, x)), waterDepth: .6 + (1 - Math.max(0, Math.min(1, y))) * 2.4 });
}
export function waterAdjustmentPosition(value: WaterAdjustment): { x: number; y: number } {
  const normalized = normalizeWaterAdjustment(value);
  return { x: (normalized.lightIntensity - .6), y: 1 - (normalized.waterDepth - .6) / 2.4 };
}
/** A gesture previews freely, commits once, and can be cancelled or undone. */
export class WaterAdjustmentSession {
  private committed: WaterAdjustment;
  private current: WaterAdjustment;
  private previous: WaterAdjustment | null = null;
  constructor(value: WaterAdjustment, private readonly preview: (value: WaterAdjustment) => void, private readonly save: (value: WaterAdjustment) => void) {
    this.current = this.committed = normalizeWaterAdjustment(value);
  }
  get value(): WaterAdjustment { return { ...this.current }; }
  get canUndo(): boolean { return this.previous !== null; }
  sync(value: WaterAdjustment): void {
    if (this.current.lightIntensity !== this.committed.lightIntensity || this.current.waterDepth !== this.committed.waterDepth) return;
    const normalized = normalizeWaterAdjustment(value);
    if (normalized.lightIntensity !== this.committed.lightIntensity || normalized.waterDepth !== this.committed.waterDepth) this.previous = null;
    this.current = this.committed = normalized;
  }
  move(value: WaterAdjustment): void { this.current = normalizeWaterAdjustment(value); this.preview(this.value); }
  commit(): void {
    if (this.current.lightIntensity === this.committed.lightIntensity && this.current.waterDepth === this.committed.waterDepth) return;
    this.previous = this.committed; this.committed = this.value; this.save(this.value);
  }
  cancel(): void { this.current = this.committed; this.preview(this.value); }
  undo(): void { if (!this.previous) return; this.current = this.committed = this.previous; this.previous = null; this.preview(this.value); this.save(this.value); }
}
