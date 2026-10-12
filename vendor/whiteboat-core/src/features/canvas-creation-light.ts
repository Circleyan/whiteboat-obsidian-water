export const CANVAS_CREATION_LIGHT_INTENSITY_LIMITS = {
  min: 0.6,
  max: 1.6,
  step: 0.05,
  defaultValue: 1,
} as const;

export const CANVAS_CREATION_WATER_DEPTH_LIMITS = {
  min: 0.6,
  max: 3,
  step: 0.05,
  defaultValue: 1,
} as const;

export type CanvasCreationCelestialLight = "sun" | "moon";

export interface CanvasCreationCelestialProjectionTier {
  distance: number;
  blur: number;
  opacity: number;
}

export interface CanvasCreationCelestialProjection {
  light: CanvasCreationCelestialLight;
  angleDeg: number;
  counterAngleDeg: number;
  elevation: number;
  /**
   * Relative length of a cast shadow on a horizontal surface.  This is the
   * inverse tangent relationship for a directional source, normalized to the
   * neutral elevation so CSS and WebGL projections use the same geometry.
   */
  shadowLengthFactor: number;
  /** Normalized irradiance of the celestial light on a horizontal surface. */
  normalIncidence: number;
  waterDepth: number;
  boat: CanvasCreationCelestialProjectionTier;
  pointer: CanvasCreationCelestialProjectionTier;
  composer: CanvasCreationCelestialProjectionTier;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundProjectionValue(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function normalizeCanvasCreationLightIntensity(
  value: unknown,
  fallback: number = CANVAS_CREATION_LIGHT_INTENSITY_LIMITS.defaultValue,
): number {
  const parsed = Number(value);
  const fallbackValue = Number.isFinite(Number(fallback))
    ? Number(fallback)
    : CANVAS_CREATION_LIGHT_INTENSITY_LIMITS.defaultValue;
  const normalized = Number.isFinite(parsed) ? parsed : fallbackValue;
  const stepped =
    Math.round(normalized / CANVAS_CREATION_LIGHT_INTENSITY_LIMITS.step) *
    CANVAS_CREATION_LIGHT_INTENSITY_LIMITS.step;
  return roundProjectionValue(
    clamp(
      stepped,
      CANVAS_CREATION_LIGHT_INTENSITY_LIMITS.min,
      CANVAS_CREATION_LIGHT_INTENSITY_LIMITS.max,
    ),
  );
}

export function normalizeCanvasCreationWaterDepth(
  value: unknown,
  fallback: number = CANVAS_CREATION_WATER_DEPTH_LIMITS.defaultValue,
): number {
  const parsed = Number(value);
  const fallbackValue = Number.isFinite(Number(fallback))
    ? Number(fallback)
    : CANVAS_CREATION_WATER_DEPTH_LIMITS.defaultValue;
  const normalized = Number.isFinite(parsed) ? parsed : fallbackValue;
  const stepped =
    Math.round(normalized / CANVAS_CREATION_WATER_DEPTH_LIMITS.step) *
    CANVAS_CREATION_WATER_DEPTH_LIMITS.step;
  return roundProjectionValue(
    clamp(
      stepped,
      CANVAS_CREATION_WATER_DEPTH_LIMITS.min,
      CANVAS_CREATION_WATER_DEPTH_LIMITS.max,
    ),
  );
}

export function sampleCanvasCreationCelestialProjection(options: {
  elapsedSeconds: number;
  light: CanvasCreationCelestialLight;
  lightIntensity?: number;
  waterDepth?: number;
  reducedMotion?: boolean;
}): CanvasCreationCelestialProjection {
  const light = options.light;
  const intensity = normalizeCanvasCreationLightIntensity(
    options.lightIntensity,
  );
  const waterDepth = normalizeCanvasCreationWaterDepth(options.waterDepth);
  const elapsedSeconds = Math.max(0, Number(options.elapsedSeconds) || 0);
  const periodSeconds = light === "moon" ? 112 : 84;
  const orbit = options.reducedMotion
    ? 0
    : ((elapsedSeconds % periodSeconds) / periodSeconds) * Math.PI * 2;
  const centerAngle = light === "moon" ? -27 : 29;
  const angleAmplitude = light === "moon" ? 8 : 10;
  const elevation = clamp(
    0.72 + Math.cos(orbit) * (light === "moon" ? 0.14 : 0.18),
    0.34,
    0.96,
  );
  // A directional light at elevation angle θ casts a shadow proportional to
  // cot(θ). `elevation` stores sin(θ), so cot(θ) = sqrt(1 - e²) / e. Keep
  // the value relative to the neutral 0.86 elevation used by the scene.
  const neutralElevation = 0.86;
  const shadowLength =
    Math.sqrt(Math.max(0, 1 - elevation * elevation)) /
    Math.max(0.12, elevation);
  const neutralShadowLength =
    Math.sqrt(1 - neutralElevation * neutralElevation) / neutralElevation;
  const shadowLengthFactor = roundProjectionValue(
    clamp(shadowLength / neutralShadowLength, 0.55, 1.8),
  );
  const normalIncidence = roundProjectionValue(clamp(elevation, 0, 1));
  const horizon = 1 - elevation;
  const distanceFactor =
    (0.96 + horizon * (light === "moon" ? 0.16 : 0.14)) *
    shadowLengthFactor;
  const blurFactor = 0.95 + horizon * (light === "moon" ? 0.24 : 0.18);
  const opacityFactor = 0.94 + elevation * (light === "moon" ? 0.06 : 0.08);
  const contrastBlurFactor = 1 - (intensity - 1) * 0.16;
  const depthBlurFactor = 0.9 + waterDepth * 0.1;
  const depthOpacityFactor = 1 - (waterDepth - 1) * 0.12;
  const tier = (base: {
    distance: number;
    blur: number;
    opacity: number;
  }): CanvasCreationCelestialProjectionTier => ({
    distance: roundProjectionValue(
      base.distance * distanceFactor * waterDepth,
    ),
    blur: roundProjectionValue(
      Math.max(
        1,
        base.blur * blurFactor * contrastBlurFactor * depthBlurFactor,
      ),
    ),
    opacity: roundProjectionValue(
      clamp(
        base.opacity * opacityFactor * intensity * depthOpacityFactor,
        0.02,
        0.5,
      ),
    ),
  });
  const angleDeg = roundProjectionValue(
    centerAngle + Math.sin(orbit) * angleAmplitude,
  );
  return {
    light,
    angleDeg,
    counterAngleDeg: roundProjectionValue(angleDeg * -1),
    elevation: roundProjectionValue(elevation),
    shadowLengthFactor,
    normalIncidence,
    waterDepth,
    boat: tier({ distance: 11, blur: 8, opacity: 0.28 }),
    pointer: tier({ distance: 4, blur: 5, opacity: 0.14 }),
    composer: tier({
      distance: light === "moon" ? 68 : 74,
      blur: 16,
      opacity: 0.24,
    }),
  };
}
