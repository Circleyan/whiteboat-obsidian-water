declare module "*water-shader-lab/renderer.mjs" {
  import type { DiscWaterSettings } from "../features/disc-water-settings";
  import type { CanvasCreationWaterBoat, CanvasCreationWaterFocus } from "whiteboat-core";
  export interface LabDrawSettings extends DiscWaterSettings {
    dark: boolean;
    focus?: CanvasCreationWaterFocus | null;
    focusFloor?: number;
    impact?: { x: number; y: number; elapsed: number; scale: number; reach: number; delay: number; gap: number; travel: number; exponent: number } | null;
    boat: (CanvasCreationWaterBoat & { wakes: { x: number; y: number; heading: number; life: number }[] }) | null;
    reducedMotion: boolean;
    inspirations: { x: number; y: number; age: number }[];
  }
  export class WaterRenderer {
    constructor(canvas: HTMLCanvasElement, options?: { transparentBackground?: boolean });
    frames: number;
    dpr: number;
    ensureSolver(pitch: number, reference?: boolean): void;
    advance(elapsed: number, pitch: number, sourceAt: (step: number) => { hull: number[]; disc: number[] }): void;
    drop(x: number, y: number, weight: number, pitch: number, staticOnly?: boolean): void;
    draw(settings: LabDrawSettings, time: number): void;
    resize(): void;
    destroy(): void;
  }
}
declare module "*water-shader-lab/pressure.mjs" {
  import type { CanvasCreationWaterBoat } from "whiteboat-core";
  export class WaterPressure {
    advance(dt: number): void;
    sources(boat: CanvasCreationWaterBoat | null, amount?: number, enabled?: boolean): { hull: number[]; disc: number[] };
  }
}
declare module "*water-shader-lab/field.mjs" {
  export class InspirationBursts {
    events: { x: number; y: number; age: number }[];
    trigger(x: number, y: number, staticOnly?: boolean): void;
    advance(seconds: number): void;
  }
}
