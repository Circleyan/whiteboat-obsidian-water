import { resolveCanvasCreationWaterFlowTiming } from "./canvas-creation-composer-motion";
import { CANVAS_CREATION_WATER_CSS_PROBE_CLASS } from "./canvas-creation-water-presentation";

const TAU = Math.PI * 2;
const EPSILON = 0.000001;
const WAKE_ACCENT_THRESHOLD = 0.16;
export const CANVAS_CREATION_WAKE_FADE_TIER_COUNT = 5;
export const CANVAS_CREATION_STATIONARY_WAKE_RADIUS_SCALE = 1.3;

const FIELD_VORTICES = Object.freeze([
  { x: 0.1, y: 0.72, radius: 0.28, strength: 0.88, direction: 1 },
  { x: 0.34, y: 0.2, radius: 0.22, strength: 0.74, direction: -1 },
  { x: 0.54, y: 0.32, radius: 0.24, strength: 0.6, direction: 1 },
  { x: 0.79, y: 0.18, radius: 0.22, strength: 0.68, direction: -1 },
  { x: 0.88, y: 0.72, radius: 0.34, strength: 0.56, direction: 1 },
]);

export const CANVAS_CREATION_WATER_DEFAULTS = Object.freeze({
  spacing: 24,
  compactSpacing: 22,
  lowPowerSpacing: 30,
  dashLength: 11.5,
  compactDashLength: 9.5,
  lineWidth: 1,
  flowSpeed: 8,
  flowCrossSpeed: 2.2,
  flowWander: 1.8,
  boatRadius: 104,
  targetFps: 60,
  lowPowerFps: 30,
  maxPixelRatio: 2,
  lowPowerPixelRatio: 1.5,
  wakeLifetimeMs: 1700,
  maxWakeSamples: 24,
});

interface WaterConfig {
  spacing: number;
  compactSpacing: number;
  lowPowerSpacing: number;
  dashLength: number;
  compactDashLength: number;
  lineWidth: number;
  flowSpeed: number;
  flowCrossSpeed: number;
  flowWander: number;
  boatRadius: number;
  targetFps: number;
  lowPowerFps: number;
  maxPixelRatio: number;
  lowPowerPixelRatio: number;
  wakeLifetimeMs: number;
  maxWakeSamples: number;
}

export interface CanvasCreationWaterBoat {
  x: number;
  y: number;
  heading: number;
  roll?: number;
  speed: number;
  visible: boolean;
}

export interface CanvasCreationWaterWake {
  x: number;
  y: number;
  heading: number;
  createdAt: number;
  life?: number;
}

export function clampWaterValue(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function smoothWaterStep(
  edge0: number,
  edge1: number,
  value: number,
): number {
  if (Math.abs(edge1 - edge0) < EPSILON) {
    return value < edge0 ? 0 : 1;
  }
  const amount = clampWaterValue((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

export function hashWaterPoint(x: number, y: number, salt = 0): number {
  const value =
    Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

function normalizeVector(x: number, y: number): { x: number; y: number } {
  const length = Math.hypot(x, y);
  if (length < EPSILON) {
    return { x: 1, y: 0 };
  }
  return { x: x / length, y: y / length };
}

function blendVector(
  current: { x: number; y: number },
  target: { x: number; y: number },
  amount: number,
): { x: number; y: number } {
  const weight = clampWaterValue(amount, 0, 1);
  return normalizeVector(
    current.x * (1 - weight) + target.x * weight,
    current.y * (1 - weight) + target.y * weight,
  );
}

function wrapWaterValue(value: number, minimum: number, maximum: number): number {
  const span = Math.max(maximum - minimum, EPSILON);
  return minimum + ((((value - minimum) % span) + span) % span);
}

function resolveCanvasCreationFlowSampleCount(
  length: number,
  spacing: number,
): number {
  const safeLength = Number.isFinite(length) ? Math.max(0, length) : 0;
  const safeSpacing = Number.isFinite(spacing)
    ? Math.max(spacing, EPSILON)
    : 1;
  return Math.max(1, Math.ceil(safeLength / safeSpacing) + 1);
}

function resolveCanvasCreationFlowWrapBounds(
  width: number,
  spacing: number,
): { minimum: number; maximum: number } {
  const safeWidth = Number.isFinite(width) ? Math.max(0, width) : 0;
  const safeSpacing = Number.isFinite(spacing)
    ? Math.max(spacing, EPSILON)
    : 1;
  const columnCount = Math.max(1, Math.ceil(safeWidth / safeSpacing) + 1);
  return {
    minimum: -safeSpacing,
    maximum: -safeSpacing + columnCount * safeSpacing,
  };
}

export function sampleCanvasCreationBaseVector(
  x: number,
  y: number,
  width: number,
  height: number,
  time = 0,
): { x: number; y: number } {
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);
  const nx = x / safeWidth;
  const ny = y / safeHeight;
  let vector = normalizeVector(
    1 +
      Math.sin(ny * TAU * 1.35 + time * 0.055) * 0.34 +
      Math.cos((nx + ny) * TAU * 1.1 - time * 0.036) * 0.18,
    Math.sin(nx * TAU * 1.45 - time * 0.048) * 0.52 +
      Math.cos((nx * 0.72 - ny) * TAU * 1.25 + time * 0.031) * 0.28,
  );

  FIELD_VORTICES.forEach((vortex) => {
    const centerX = vortex.x * safeWidth;
    const centerY = vortex.y * safeHeight;
    const dx = x - centerX;
    const dy = y - centerY;
    const radius = vortex.radius * Math.min(safeWidth, safeHeight);
    const distance = Math.hypot(dx, dy);
    const influence =
      (1 - smoothWaterStep(radius * 0.14, radius, distance)) *
      vortex.strength;
    const drift =
      Math.sin(time * 0.075 + vortex.x * 9.1 + vortex.y * 6.3) * 0.08;
    const tangent = normalizeVector(
      -dy * vortex.direction + dx * drift,
      dx * vortex.direction + dy * drift,
    );
    vector = blendVector(vector, tangent, influence);
  });
  return vector;
}

export function sampleCanvasCreationFlowPosition(options: {
  baseX: number;
  baseY: number;
  column: number;
  row: number;
  width: number;
  height: number;
  topInset: number;
  spacing: number;
  time?: number;
  reducedMotion?: boolean;
  config?: WaterConfig;
}): { x: number; y: number } {
  const {
    baseX,
    baseY,
    column,
    row,
    width,
    height,
    topInset,
    spacing,
    time = 0,
    reducedMotion = false,
    config = CANVAS_CREATION_WATER_DEFAULTS,
  } = options;
  if (reducedMotion || time <= 0) {
    return { x: baseX, y: baseY };
  }
  const phase = hashWaterPoint(column, row, 21) * TAU;
  const wanderX =
    (Math.sin(phase + time * 0.31) - Math.sin(phase)) * config.flowWander;
  const wanderY =
    (Math.cos(phase * 0.73 + time * 0.23) - Math.cos(phase * 0.73)) *
    config.flowWander;
  const rowCount = resolveCanvasCreationFlowSampleCount(
    height - topInset,
    spacing,
  );
  const horizontalWrap = resolveCanvasCreationFlowWrapBounds(width, spacing);
  return {
    x: wrapWaterValue(
      baseX + time * config.flowSpeed + wanderX,
      horizontalWrap.minimum,
      horizontalWrap.maximum,
    ),
    y: wrapWaterValue(
      baseY + time * config.flowCrossSpeed + wanderY,
      topInset,
      topInset + rowCount * spacing,
    ),
  };
}

export function resolveCanvasCreationWaterTopInset(options: {
  height: number;
  configuredInset: number;
  topInsetRatio: number;
}): number {
  const safeHeight = Number.isFinite(options.height)
    ? Math.max(0, options.height)
    : 0;
  const configuredInset = Number.isFinite(options.configuredInset)
    ? Math.max(0, options.configuredInset)
    : 0;
  const topInsetRatio = Number.isFinite(options.topInsetRatio)
    ? clampWaterValue(options.topInsetRatio, 0, 0.32)
    : 0;
  return Math.max(configuredInset, safeHeight * topInsetRatio);
}

function sampleBoatInfluence(
  x: number,
  y: number,
  boat: CanvasCreationWaterBoat | null,
  config: WaterConfig,
  flowVector: { x: number; y: number },
): {
  vector: { x: number; y: number } | null;
  influence: number;
  accent: number;
  offsetX: number;
  offsetY: number;
  lengthScale: number;
} {
  if (!boat?.visible) {
    return {
      vector: null,
      influence: 0,
      accent: 0,
      offsetX: 0,
      offsetY: 0,
      lengthScale: 1,
    };
  }
  const radius = config.boatRadius;
  const dx = x - boat.x;
  const dy = y - boat.y;
  const forwardX = Math.cos(boat.heading);
  const forwardY = Math.sin(boat.heading);
  const sideX = -forwardY;
  const sideY = forwardX;
  const longitudinal = dx * forwardX + dy * forwardY;
  const lateral = dx * sideX + dy * sideY;
  const speed = clampWaterValue(boat.speed, 0, 1);
  const motion = smoothWaterStep(0.04, 0.36, speed);
  const stationaryWakeScale = 1 +
    (CANVAS_CREATION_STATIONARY_WAKE_RADIUS_SCALE - 1) * (1 - motion);
  const longitudinalRadius =
    radius * (0.78 + speed * 0.42) * stationaryWakeScale;
  const lateralRadius =
    radius * (0.44 + speed * 0.16) * stationaryWakeScale;
  const normalizedDistance = Math.hypot(
    longitudinal / longitudinalRadius,
    lateral / lateralRadius,
  );
  const collision = 1 - smoothWaterStep(0.14, 1, normalizedDistance);
  const influence =
    collision * (0.42 + speed * 0.24);
  if (influence <= EPSILON) {
    return {
      vector: null,
      influence: 0,
      accent: 0,
      offsetX: 0,
      offsetY: 0,
      lengthScale: 1,
    };
  }

  const normal = normalizeVector(
    forwardX * (longitudinal / (longitudinalRadius * longitudinalRadius)) +
      sideX * (lateral / (lateralRadius * lateralRadius)),
    forwardY * (longitudinal / (longitudinalRadius * longitudinalRadius)) +
      sideY * (lateral / (lateralRadius * lateralRadius)),
  );
  const normalizedFlow = normalizeVector(flowVector.x, flowVector.y);
  let tangent = { x: -normal.y, y: normal.x };
  if (tangent.x * normalizedFlow.x + tangent.y * normalizedFlow.y < 0) {
    tangent = { x: -tangent.x, y: -tangent.y };
  }
  const incoming = clampWaterValue(
    -(normalizedFlow.x * normal.x + normalizedFlow.y * normal.y),
    0,
    1,
  );
  const streamShift = -motion * influence * (3 + speed * 4);
  const crossShift =
    Math.sin((longitudinal / Math.max(longitudinalRadius, 1)) * Math.PI) *
    influence *
    motion *
    2.4;
  const surfaceShift = influence * (1.5 + speed * 2.2);
  return {
    vector: tangent,
    influence,
    accent:
      collision * (0.3 + incoming * 0.7) * (0.72 + speed * 0.16),
    offsetX:
      normal.x * surfaceShift +
      forwardX * streamShift +
      sideX * crossShift,
    offsetY:
      normal.y * surfaceShift +
      forwardY * streamShift +
      sideY * crossShift,
    lengthScale: 1 + influence * (0.16 + speed * 0.1),
  };
}

export function sampleCanvasCreationBoatResponse(
  x: number,
  y: number,
  boat: CanvasCreationWaterBoat | null,
  config: WaterConfig = CANVAS_CREATION_WATER_DEFAULTS,
  flowVector: { x: number; y: number } = { x: 1, y: 0 },
): {
  offsetX: number;
  offsetY: number;
  lengthScale: number;
  influence: number;
  accent: number;
} {
  const sample = sampleBoatInfluence(x, y, boat, config, flowVector);
  return {
    offsetX: sample.offsetX,
    offsetY: sample.offsetY,
    lengthScale: sample.lengthScale,
    influence: sample.influence,
    accent: sample.accent,
  };
}

export function sampleCanvasCreationWakeAccent(
  x: number,
  y: number,
  wakes: CanvasCreationWaterWake[],
): number {
  let accent = 0;
  wakes.forEach((wake) => {
    const life = clampWaterValue(wake.life ?? 0, 0, 1);
    if (life <= 0) {
      return;
    }
    const dx = x - wake.x;
    const dy = y - wake.y;
    const forwardX = Math.cos(wake.heading);
    const forwardY = Math.sin(wake.heading);
    const sideX = -forwardY;
    const sideY = forwardX;
    const longitudinal = dx * forwardX + dy * forwardY;
    const lateral = dx * sideX + dy * sideY;
    const age = 1 - life;
    const centerBehindStern = 26 + age * 22;
    const longitudinalRadius = 46 + age * 30;
    const lateralRadius = 24 + age * 58;
    const normalizedDistance = Math.hypot(
      (longitudinal + centerBehindStern) / longitudinalRadius,
      lateral / lateralRadius,
    );
    const localAccent =
      (1 - smoothWaterStep(0.28, 1, normalizedDistance)) *
      Math.pow(life, 0.72);
    accent = Math.max(
      accent,
      localAccent,
    );
  });
  return clampWaterValue(accent, 0, 1);
}

export function resolveCanvasCreationWakeFadeTier(
  accent: number,
): number | null {
  const normalizedAccent = clampWaterValue(accent, 0, 1);
  if (normalizedAccent <= WAKE_ACCENT_THRESHOLD) {
    return null;
  }
  const strength = smoothWaterStep(
    WAKE_ACCENT_THRESHOLD,
    0.9,
    normalizedAccent,
  );
  return Math.min(
    CANVAS_CREATION_WAKE_FADE_TIER_COUNT - 1,
    Math.floor(
      (1 - strength) * CANVAS_CREATION_WAKE_FADE_TIER_COUNT,
    ),
  );
}

export interface CanvasCreationWaterMooringFrame {
  x: number;
  y: number;
  elapsedMs: number;
  reducedMotion?: boolean;
}

export function sampleCanvasCreationMooringAccent(
  x: number,
  y: number,
  mooring: CanvasCreationWaterMooringFrame,
  boat: CanvasCreationWaterBoat | null = null,
): number {
  if (!boat?.visible) return 0;
  const dx = x - boat.x;
  const dy = y - boat.y;
  const forwardX = Math.cos(boat.heading);
  const forwardY = Math.sin(boat.heading);
  const longitudinal = dx * forwardX + dy * forwardY;
  const lateral = -dx * forwardY + dy * forwardX;
  // Two leaves follow the hull's sides, reaching farther outward than inward.
  // The centerline and bow/stern remain clear, and the support never expands
  // beyond this fixed local footprint (no ring grows from the hull).
  const side = Math.abs(lateral) - 17;
  const distance = Math.hypot(longitudinal / 88, side / (side < 0 ? 13 : 52));
  const contact = 1 - smoothWaterStep(0.35, 1, distance);
  if (mooring.reducedMotion) return contact * 0.40;
  const roll = clampWaterValue((boat.roll ?? 0) / 0.1, -1, 1);
  const sideStrength = 0.52 + Math.sign(lateral) * roll * 0.16;
  return contact * sideStrength * smoothWaterStep(0, 180, mooring.elapsedMs);
}

/** Clear area of a host focus veil; dashes outside it recede. */
export interface CanvasCreationWaterFocus {
  x: number;
  y: number;
  rx: number;
  ry: number;
  padding: number;
  /** 0 = no recession, 1 = full recession. */
  amount: number;
}

export const CANVAS_CREATION_FOCUS_FADE_TIER_COUNT = 8;

/**
 * How far a dash recedes (0-1) for the focus veil. It starts just inside the
 * padded clear ellipse and deepens with distance, scaled by the veil amount.
 */
export function sampleCanvasCreationFocusFade(
  x: number,
  y: number,
  focus: CanvasCreationWaterFocus,
): number {
  const distance = Math.hypot(
    (x - focus.x) / Math.max(1, focus.rx + focus.padding),
    (y - focus.y) / Math.max(1, focus.ry + focus.padding),
  );
  return clampWaterValue(focus.amount, 0, 1) * smoothWaterStep(0.9, 2, distance);
}

/**
 * Dashes are faded as whole strokes in a few alpha tiers. A fixed per-dash
 * dither picks between neighbouring tiers, so no contour line forms where
 * one tier meets the next.
 */
export function resolveCanvasCreationFocusFadeTier(fade: number, dither: number): number {
  if (fade <= 0) return 0;
  return Math.min(
    CANVAS_CREATION_FOCUS_FADE_TIER_COUNT - 1,
    Math.floor(fade * (CANVAS_CREATION_FOCUS_FADE_TIER_COUNT - 1) + dither),
  );
}

export function sampleCanvasCreationFieldVector(options: {
  x: number;
  y: number;
  width: number;
  height: number;
  time?: number;
  boat?: CanvasCreationWaterBoat | null;
  wakes?: CanvasCreationWaterWake[];
  freezeQuietStrokes?: boolean;
  freezeGeometry?: boolean;
  mooring?: CanvasCreationWaterMooringFrame | null;
  config?: WaterConfig;
}): {
  x: number;
  y: number;
  accent: number;
  boatInfluence: number;
  offsetX: number;
  offsetY: number;
  lengthScale: number;
} {
  const {
    x,
    y,
    width,
    height,
    time = 0,
    boat = null,
    wakes = [],
    freezeQuietStrokes = false,
    freezeGeometry = false,
    mooring = null,
    config = CANVAS_CREATION_WATER_DEFAULTS,
  } = options;
  let vector = sampleCanvasCreationBaseVector(x, y, width, height, time);
  const boatSample = sampleBoatInfluence(x, y, mooring ? null : boat, config, vector);
  const accent = Math.max(
    sampleCanvasCreationWakeAccent(x, y, wakes),
    mooring ? sampleCanvasCreationMooringAccent(x, y, mooring, boat) : boatSample.accent,
  );
  // Paused ordinary strokes retain their base geometry, even near the hull.
  // Only the existing colored samples participate in live contact and wakes.
  if (freezeGeometry || mooring ||
      (freezeQuietStrokes && resolveCanvasCreationWakeFadeTier(accent) === null)) {
    return {
      ...vector,
      accent,
      boatInfluence: 0,
      offsetX: 0,
      offsetY: 0,
      lengthScale: 1,
    };
  }
  if (boatSample.vector) {
    vector = blendVector(vector, boatSample.vector, boatSample.influence);
  }
  return {
    ...vector,
    accent,
    boatInfluence: boatSample.influence,
    offsetX: boatSample.offsetX,
    offsetY: boatSample.offsetY,
    lengthScale: boatSample.lengthScale,
  };
}

export function resolveCanvasCreationWaterQuality(options: {
  width: number;
  reducedMotion?: boolean;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  devicePixelRatio?: number;
  config?: WaterConfig;
}): {
  lowPower: boolean;
  spacing: number;
  fps: number;
  pixelRatio: number;
} {
  const {
    width,
    reducedMotion = false,
    hardwareConcurrency = 8,
    deviceMemory = 8,
    devicePixelRatio = 1,
    config = CANVAS_CREATION_WATER_DEFAULTS,
  } = options;
  const lowPower =
    hardwareConcurrency <= 4 || deviceMemory <= 4 || width <= 360;
  return {
    lowPower,
    spacing: lowPower
      ? config.lowPowerSpacing
      : width < 640
        ? config.compactSpacing
        : config.spacing,
    fps: reducedMotion ? 0 : lowPower ? config.lowPowerFps : config.targetFps,
    pixelRatio: Math.min(
      Math.max(devicePixelRatio, 1),
      lowPower ? config.lowPowerPixelRatio : config.maxPixelRatio,
    ),
  };
}

function readToken(root: HTMLElement, name: string, fallback: string): string {
  const value = getComputedStyle(root).getPropertyValue(name).trim();
  return value || fallback;
}

function readOptionalToken(root: HTMLElement, name: string): string | null {
  const value = getComputedStyle(root).getPropertyValue(name).trim();
  return value || null;
}

function readNumericToken(
  root: HTMLElement,
  name: string,
  fallback: number,
): number {
  const value = Number.parseFloat(readToken(root, name, String(fallback)));
  return Number.isFinite(value) ? value : fallback;
}

export function resolveCanvasCreationCssPixels(
  root: HTMLElement,
  name: string,
  fallback: string,
  createProbe: (root: HTMLElement) => HTMLDivElement,
): number {
  const directValue = readToken(root, name, fallback);
  const directPixels = Number.parseFloat(directValue);
  if (Number.isFinite(directPixels)) {
    return directPixels;
  }

  const probe = createProbe(root);
  probe.className = CANVAS_CREATION_WATER_CSS_PROBE_CLASS;
  probe.style.width = `var(${name}, ${fallback})`;
  root.appendChild(probe);
  const measuredPixels = probe.getBoundingClientRect().width;
  probe.remove();
  if (Number.isFinite(measuredPixels) && measuredPixels > 0) {
    return measuredPixels;
  }

  const fallbackPixels = Number.parseFloat(fallback);
  return Number.isFinite(fallbackPixels) ? fallbackPixels : 0;
}

interface WaterFlowTransition {
  startedAt: number;
  fromScale: number;
  toScale: number;
  durationMs: number;
  easing: "pause" | "resume";
}

function waterFlowEase(progress: number, easing: WaterFlowTransition["easing"]): number {
  if (easing === "pause") return 1 - Math.pow(1 - progress, 5);
  return progress <= 0.5 ? 4 * Math.pow(progress, 3) :
    1 - 4 * Math.pow(1 - progress, 3);
}

function waterFlowEaseIntegral(progress: number, easing: WaterFlowTransition["easing"]): number {
  if (easing === "pause") return progress + Math.pow(1 - progress, 6) / 6 - 1 / 6;
  return progress <= 0.5 ? Math.pow(progress, 4) :
    progress + Math.pow(1 - progress, 4) - 0.5;
}

export class CanvasCreationWaterField {
  private readonly context: CanvasRenderingContext2D;
  private readonly config: WaterConfig;
  private readonly tokenRoot: HTMLElement;
  private readonly createProbe: (root: HTMLElement) => HTMLDivElement;
  private readonly ownerWindow: Pick<Window, "requestAnimationFrame" | "cancelAnimationFrame">;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly handleWindowResize: () => void;
  private readonly handleVisibility: () => void;
  private width = 1;
  private height = 1;
  private frameId: number | null = null;
  private lastFrameAt = 0;
  private lastWakeAt = 0;
  private readonly startedAt = performance.now();
  private flowClockAt = this.startedAt;
  private flowTimestamp = this.startedAt;
  private flowPaused = false;
  private readonly flowTimeScale: number;
  private flowScale = 1;
  private flowTransition: WaterFlowTransition | null = null;
  private mooring: { x: number; y: number; startedAt: number } | null = null;
  private focus: CanvasCreationWaterFocus | null = null;
  private focusDashFloor = 1;
  private visible = !document.hidden;
  private reducedMotion: boolean;
  private boat: CanvasCreationWaterBoat | null = null;
  private wakes: CanvasCreationWaterWake[] = [];
  private lineColors: string[] = [];
  private accentColors: string[] = [];
  private wakeToneColors: string[] = [];
  private wakeOpacities: number[] = [];
  private quality = resolveCanvasCreationWaterQuality({ width: 1 });

  private getVisualScale(): number {
    return clampWaterValue(
      readNumericToken(this.tokenRoot, "--wb-entry-water-visual-scale", 1),
      0.25,
      2,
    );
  }

  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: {
      tokenRoot: HTMLElement;
      createProbe: (root: HTMLElement) => HTMLDivElement;
      ownerWindow: Pick<Window, "requestAnimationFrame" | "cancelAnimationFrame">;
      reducedMotion?: boolean;
      flowTimeScale?: number;
      config?: WaterConfig;
    },
  ) {
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      throw new Error("Canvas 2D is unavailable.");
    }
    this.context = context;
    this.tokenRoot = options.tokenRoot;
    this.createProbe = options.createProbe;
    this.ownerWindow = options.ownerWindow;
    this.config = options.config ?? CANVAS_CREATION_WATER_DEFAULTS;
    this.reducedMotion = options.reducedMotion === true;
    const timeScale = options.flowTimeScale ?? 1;
    this.flowTimeScale = Number.isFinite(timeScale) ? Math.max(0, timeScale) : 1;
    this.flowScale = this.flowTimeScale;
    this.handleVisibility = () => {
      this.visible = !document.hidden;
      if (this.visible) {
        this.requestRender();
      }
    };
    this.handleWindowResize = () => this.resize();
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.resizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => this.resize())
        : null;
    this.resizeObserver?.observe(canvas);
    if (!this.resizeObserver) {
      window.addEventListener("resize", this.handleWindowResize);
    }
    this.refreshColors();
    this.resize();
  }

  refreshColors(): void {
    this.lineColors = [
      readToken(
        this.tokenRoot,
        "--wb-entry-water-line-quiet",
        "rgba(38,38,38,0.10)",
      ),
      readToken(
        this.tokenRoot,
        "--wb-entry-water-line",
        "rgba(38,38,38,0.14)",
      ),
      readToken(
        this.tokenRoot,
        "--wb-entry-water-line-strong",
        "rgba(38,38,38,0.18)",
      ),
    ];
    this.accentColors = [
      readToken(
        this.tokenRoot,
        "--wb-entry-wake-accent-01",
        this.lineColors[2],
      ),
      readToken(
        this.tokenRoot,
        "--wb-entry-wake-accent-02",
        this.lineColors[2],
      ),
      readToken(
        this.tokenRoot,
        "--wb-entry-wake-accent-03",
        this.lineColors[2],
      ),
      readToken(
        this.tokenRoot,
        "--wb-entry-wake-accent-04",
        this.lineColors[2],
      ),
    ];
    const wakeToneColors = [
      "--wb-entry-wake-color-strong",
      "--wb-entry-wake-color-bright",
      "--wb-entry-wake-color-middle",
      "--wb-entry-wake-color-soft",
      "--wb-entry-wake-color-tail",
    ].map((name) => readOptionalToken(this.tokenRoot, name));
    this.wakeToneColors = wakeToneColors.every((color) => color !== null)
      ? wakeToneColors.filter((color): color is string => color !== null)
      : [];
    this.wakeOpacities = [
      readNumericToken(this.tokenRoot, "--wb-entry-wake-opacity-strong", 1),
      readNumericToken(this.tokenRoot, "--wb-entry-wake-opacity-bright", 0.76),
      readNumericToken(this.tokenRoot, "--wb-entry-wake-opacity-middle", 0.54),
      readNumericToken(this.tokenRoot, "--wb-entry-wake-opacity-soft", 0.34),
      readNumericToken(this.tokenRoot, "--wb-entry-wake-opacity-tail", 0.18),
    ].map((opacity) => clampWaterValue(opacity, 0, 1));
    // Opacity left on the farthest dashes under full focus; 1 disables it.
    this.focusDashFloor = clampWaterValue(
      readNumericToken(this.tokenRoot, "--wb-entry-water-focus-dash-floor", 1),
      0,
      1,
    );
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(rect.width, 1);
    this.height = Math.max(rect.height, 1);
    const navigatorWithMemory = navigator as Navigator & {
      deviceMemory?: number;
    };
    this.quality = resolveCanvasCreationWaterQuality({
      width: this.width,
      reducedMotion: this.reducedMotion,
      hardwareConcurrency: navigator.hardwareConcurrency ?? 8,
      deviceMemory: navigatorWithMemory.deviceMemory ?? 8,
      devicePixelRatio: window.devicePixelRatio ?? 1,
      config: this.config,
    });
    this.canvas.width = Math.round(this.width * this.quality.pixelRatio);
    this.canvas.height = Math.round(this.height * this.quality.pixelRatio);
    this.context.setTransform(
      this.quality.pixelRatio,
      0,
      0,
      this.quality.pixelRatio,
      0,
      0,
    );
    this.requestRender();
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.advanceFlowClock(performance.now());
    this.reducedMotion = reducedMotion;
    if (reducedMotion) {
      this.flowTransition = null;
      this.flowScale = this.flowPaused ? 0 : this.flowTimeScale;
    }
    this.resize();
  }

  /**
   * Freeze ordinary water flow; boat contact and wake emission/age stay live.
   * The stop runs with the composer appearing and the restart with it being
   * dismissed, timed by the shared composer motion.
   */
  setFlowPaused(paused: boolean): void {
    if (this.flowPaused === paused) {
      return;
    }
    this.advanceFlowClock(performance.now());
    this.flowPaused = paused;
    const toScale = paused ? 0 : this.flowTimeScale;
    const timing = resolveCanvasCreationWaterFlowTiming(this.reducedMotion);
    const durationMs = paused ? timing.pauseDurationMs : timing.resumeDurationMs;
    if (durationMs === 0 || this.flowScale === toScale) {
      this.flowScale = toScale;
      this.flowTransition = null;
    } else {
      this.flowTransition = {
        startedAt: this.flowClockAt,
        fromScale: this.flowScale,
        toScale,
        durationMs,
        easing: paused ? "pause" : "resume",
      };
    }
    this.requestRender();
  }

  setMooring(center: { x: number; y: number } | null): void {
    if (center && this.mooring?.x === center.x && this.mooring.y === center.y) return;
    if (!center && !this.mooring) return;
    this.mooring = center ? { ...center, startedAt: performance.now() } : null;
    this.requestRender();
  }

  /** Recede the dashes outside a host focus veil's clear area. */
  setFocus(focus: CanvasCreationWaterFocus | null): void {
    const next = focus && focus.amount > 0 ? { ...focus } : null;
    const previous = this.focus;
    if (!next && !previous) return;
    if (next && previous && (Object.keys(next) as (keyof CanvasCreationWaterFocus)[])
      .every((key) => next[key] === previous[key])) return;
    this.focus = next;
    this.requestRender();
  }

  setBoat(boat: CanvasCreationWaterBoat | null): void {
    const timestamp = performance.now();
    this.advanceFlowClock(timestamp);
    const previous = this.boat;
    this.boat = boat ? { ...boat } : null;
    if (
      boat?.visible &&
      previous?.visible &&
      boat.speed > 0.08 &&
      Math.hypot(boat.x - previous.x, boat.y - previous.y) > 0.2 &&
      timestamp - this.lastWakeAt >= 54
    ) {
      this.lastWakeAt = timestamp;
      this.wakes.unshift({
        x: boat.x,
        y: boat.y,
        heading: boat.heading,
        createdAt: this.lastWakeAt,
      });
      this.wakes.length = Math.min(
        this.wakes.length,
        this.config.maxWakeSamples,
      );
    }
    if (this.reducedMotion) {
      this.requestRender();
    }
  }

  start(): void {
    this.requestRender();
  }

  destroy(): void {
    if (this.frameId !== null) {
      this.ownerWindow.cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.handleWindowResize);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.wakes.length = 0;
  }

  private requestRender(): void {
    if (this.frameId !== null || !this.visible) {
      return;
    }
    this.frameId = this.ownerWindow.requestAnimationFrame((timestamp) => {
      this.frameId = null;
      this.render(timestamp);
      if (!this.reducedMotion) {
        this.requestRender();
      }
    });
  }

  private advanceFlowClock(timestamp: number): number {
    // RAF timestamps can precede a setBoat call made in the same frame.
    const nextTimestamp = Math.max(timestamp, this.flowClockAt);
    const transition = this.flowTransition;
    if (!transition) {
      this.flowTimestamp += (nextTimestamp - this.flowClockAt) * this.flowScale;
    } else {
      const end = transition.startedAt + transition.durationMs;
      const integratedUntil = Math.min(nextTimestamp, end);
      const from = clampWaterValue((this.flowClockAt - transition.startedAt) / transition.durationMs, 0, 1);
      const to = clampWaterValue((integratedUntil - transition.startedAt) / transition.durationMs, 0, 1);
      // Integrate the velocity envelope exactly; RAF cadence and late frames
      // cannot alter the distance travelled or add a paused-time catch-up.
      this.flowTimestamp += transition.durationMs * (
        transition.fromScale * (to - from) +
        (transition.toScale - transition.fromScale) *
          (waterFlowEaseIntegral(to, transition.easing) - waterFlowEaseIntegral(from, transition.easing))
      );
      this.flowScale = transition.fromScale + (transition.toScale - transition.fromScale) *
        waterFlowEase(to, transition.easing);
      if (nextTimestamp >= end) {
        this.flowTimestamp += (nextTimestamp - end) * transition.toScale;
        this.flowScale = transition.toScale;
        this.flowTransition = null;
      }
    }
    this.flowClockAt = nextTimestamp;
    return this.flowTimestamp;
  }

  private render(timestamp: number): void {
    const frameDuration = this.quality.fps > 0 ? 1000 / this.quality.fps : 0;
    if (
      frameDuration > 0 &&
      timestamp - this.lastFrameAt < frameDuration
    ) {
      return;
    }
    this.lastFrameAt = timestamp;
    const flowTimestamp = this.advanceFlowClock(timestamp);
    const elapsed = this.reducedMotion ? 0 : (flowTimestamp - this.startedAt) / 1000;
    const mooring = this.mooring ? {
      x: this.mooring.x,
      y: this.mooring.y,
      elapsedMs: Math.max(0, timestamp - this.mooring.startedAt),
      reducedMotion: this.reducedMotion,
    } : null;
    const wakes = this.wakes
      .map((wake) => ({
        ...wake,
        life:
          1 - (timestamp - wake.createdAt) / this.config.wakeLifetimeMs,
      }))
      .filter((wake) => (wake.life ?? 0) > 0);
    this.wakes = wakes.map(({ life: _life, ...wake }) => wake);

    this.context.clearRect(0, 0, this.width, this.height);
    const visualScale = this.getVisualScale();
    const scaledConfig: WaterConfig = {
      ...this.config,
      flowSpeed: this.config.flowSpeed * visualScale,
      flowCrossSpeed: this.config.flowCrossSpeed * visualScale,
      flowWander: this.config.flowWander * visualScale,
      boatRadius: this.config.boatRadius * visualScale,
    };
    this.context.lineCap = "round";
    this.context.lineWidth = Math.max(0.5, this.config.lineWidth * visualScale);
    const usesWakeTonePalette =
      this.wakeToneColors.length === CANVAS_CREATION_WAKE_FADE_TIER_COUNT;
    const bucketCount =
      this.lineColors.length +
      (usesWakeTonePalette
        ? this.wakeToneColors.length
        : this.accentColors.length * this.wakeOpacities.length);
    const focus = this.focusDashFloor < 1 ? this.focus : null;
    const fadeTierCount = focus ? CANVAS_CREATION_FOCUS_FADE_TIER_COUNT : 1;
    const paths = Array.from(
      { length: bucketCount * fadeTierCount },
      () => new Path2D(),
    );
    const spacing = this.quality.spacing * visualScale;
    const dashLength =
      (this.width < 640
        ? this.config.compactDashLength
        : this.config.dashLength) * visualScale;
    const topInsetRatio = clampWaterValue(
      readNumericToken(this.tokenRoot, "--wb-entry-water-top-ratio", 0),
      0,
      0.32,
    );
    const topInset = resolveCanvasCreationWaterTopInset({
      height: this.height,
      configuredInset: resolveCanvasCreationCssPixels(
        this.tokenRoot,
        "--wb-entry-water-top-inset",
        "12px",
        this.createProbe,
      ),
      topInsetRatio,
    });
    const columnCount = Math.ceil(this.width / spacing) + 1;
    const rowCount = resolveCanvasCreationFlowSampleCount(
      this.height - topInset,
      spacing,
    );
    for (let row = 0; row < rowCount; row += 1) {
      const baseY =
        topInset +
        row * spacing +
        (hashWaterPoint(row, 17, 2) - 0.5) * spacing * 0.06;
      if (baseY > this.height + spacing) {
        break;
      }
      for (let column = 0; column < columnCount; column += 1) {
        const baseX =
          column * spacing +
          (hashWaterPoint(column, row, 1) - 0.5) * spacing * 0.07;
        const position = sampleCanvasCreationFlowPosition({
          baseX,
          baseY,
          column,
          row,
          width: this.width,
          height: this.height,
          topInset,
          spacing,
          time: elapsed,
          reducedMotion: this.reducedMotion,
          config: scaledConfig,
        });
        const sample = sampleCanvasCreationFieldVector({
          x: position.x,
          y: position.y,
          width: this.width,
          height: this.height,
          time: elapsed,
          boat: this.boat,
          wakes,
          freezeQuietStrokes: this.flowPaused,
          freezeGeometry: this.flowPaused,
          mooring,
          config: scaledConfig,
        });
        const length =
          dashLength *
          (0.82 + hashWaterPoint(column, row, 4) * 0.34) *
          sample.lengthScale;
        const halfX = sample.x * length * 0.5;
        const halfY = sample.y * length * 0.5;
        const x = position.x + sample.offsetX;
        const y = position.y + sample.offsetY;
        const wakeFadeTier = resolveCanvasCreationWakeFadeTier(sample.accent);
        const bucket = wakeFadeTier !== null
          ? this.lineColors.length +
            (usesWakeTonePalette
              ? wakeFadeTier
              : Math.floor(hashWaterPoint(column, row, 12) * 4) *
                  this.wakeOpacities.length +
                wakeFadeTier)
          : Math.min(Math.floor(hashWaterPoint(column, row, 5) * 3), 2);
        const fadeTier = focus
          ? resolveCanvasCreationFocusFadeTier(
            sampleCanvasCreationFocusFade(x, y, focus),
            hashWaterPoint(column, row, 21),
          )
          : 0;
        const path = paths[fadeTier * bucketCount + bucket];
        path.moveTo(x - halfX, y - halfY);
        path.lineTo(x + halfX, y + halfY);
      }
    }
    paths.forEach((path, pathIndex) => {
      const index = pathIndex % bucketCount;
      const fadeTier = Math.floor(pathIndex / bucketCount);
      if (index < this.lineColors.length) {
        this.context.strokeStyle = this.lineColors[index];
        this.context.globalAlpha = 1;
      } else {
        const accentIndex = index - this.lineColors.length;
        if (usesWakeTonePalette) {
          this.context.strokeStyle = this.wakeToneColors[accentIndex];
          this.context.globalAlpha = this.wakeOpacities[accentIndex];
        } else {
          this.context.strokeStyle =
            this.accentColors[
              Math.floor(accentIndex / this.wakeOpacities.length)
            ];
          this.context.globalAlpha =
            this.wakeOpacities[accentIndex % this.wakeOpacities.length];
        }
      }
      if (fadeTier > 0) {
        this.context.globalAlpha *= 1 - (1 - this.focusDashFloor) *
          fadeTier / (CANVAS_CREATION_FOCUS_FADE_TIER_COUNT - 1);
      }
      this.context.stroke(path);
    });
    this.context.globalAlpha = 1;
  }
}
