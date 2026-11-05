export const DISC_WATER_LIMITS = {
  azimuth: [0, 180, 1, 90], elevation: [8, 80, 1, 66], view: [0, 65, 1, 0],
  roughness: [0.015, 0.18, 0.005, 0.055], swirl: [0, 1, 0.05, 1],
  brightness: [0.1, 1, 0.02, 0.62], curvature: [0, 0.9, 0.01, 0.9],
  strength: [0, 1.2, 0.01, 0.7], speed: [0.1, 1.8, 0.05, 1.1],
  spacing: [20, 54, 1, 23], pressure: [0, 2, 0.1, 1], weight: [0.4, 1.8, 0.1, 1],
} as const;
export type DiscWaterParameter = keyof typeof DISC_WATER_LIMITS;
export type DiscWaterSettings = Record<DiscWaterParameter, number> & { mode: number };
export const DEFAULT_DISC_WATER_SETTINGS = Object.freeze({
  ...Object.fromEntries(Object.entries(DISC_WATER_LIMITS).map(([key, value]) => [key, value[3]])),
  mode: 5,
}) as Readonly<DiscWaterSettings>;

export const CANVAS_WATER_SCALE_LIMITS = { min: 0.5, max: 2, step: 0.1, defaultValue: 0.9 } as const;
export function normalizeCanvasWaterScale(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return CANVAS_WATER_SCALE_LIMITS.defaultValue;
  return Math.round(Math.max(CANVAS_WATER_SCALE_LIMITS.min, Math.min(CANVAS_WATER_SCALE_LIMITS.max, value)) * 10) / 10;
}

/** Saved experiments never pass NaN or unbounded values into GPU allocation. */
export function normalizeDiscWaterSettings(value: unknown): DiscWaterSettings {
  const raw = value && typeof value === "object" ? value as Partial<DiscWaterSettings> : {};
  const out = { ...DEFAULT_DISC_WATER_SETTINGS };
  for (const key of Object.keys(DISC_WATER_LIMITS) as DiscWaterParameter[]) {
    const [min, max, , fallback] = DISC_WATER_LIMITS[key];
    const v = raw[key];
    out[key] = typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
  }
  out.mode = DEFAULT_DISC_WATER_SETTINGS.mode;
  return out;
}
