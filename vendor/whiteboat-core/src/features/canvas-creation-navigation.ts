import {
  clampWaterValue,
  type CanvasCreationWaterBoat,
} from "./canvas-creation-water-field";

export type CanvasCreationEntryDeviceMode = "desktop" | "tablet" | "phone";

export const CANVAS_CREATION_BOAT_FOLLOW_SPEED_LIMITS = {
  min: 0.5,
  max: 2,
  step: 0.05,
  defaultValue: 1,
} as const;

export function normalizeCanvasCreationBoatFollowSpeed(
  value: unknown,
  fallback: number = CANVAS_CREATION_BOAT_FOLLOW_SPEED_LIMITS.defaultValue,
): number {
  const parsed = Number(value);
  const fallbackValue = Number.isFinite(Number(fallback))
    ? Number(fallback)
    : CANVAS_CREATION_BOAT_FOLLOW_SPEED_LIMITS.defaultValue;
  const normalized = Number.isFinite(parsed) ? parsed : fallbackValue;
  const stepped =
    Math.round(normalized / CANVAS_CREATION_BOAT_FOLLOW_SPEED_LIMITS.step) *
    CANVAS_CREATION_BOAT_FOLLOW_SPEED_LIMITS.step;
  return Math.round(
    clampWaterValue(
      stepped,
      CANVAS_CREATION_BOAT_FOLLOW_SPEED_LIMITS.min,
      CANVAS_CREATION_BOAT_FOLLOW_SPEED_LIMITS.max,
    ) * 1000,
  ) / 1000;
}

export function resolveCanvasCreationEntryDeviceMode(options: {
  isMobileApp?: boolean;
  isPhone?: boolean;
  isTablet?: boolean;
  bodyIsMobile?: boolean;
  bodyIsPhone?: boolean;
  bodyIsTablet?: boolean;
}): CanvasCreationEntryDeviceMode {
  if (options.isPhone || options.bodyIsPhone) {
    return "phone";
  }
  if (options.isTablet || options.bodyIsTablet) {
    return "tablet";
  }
  if (options.isMobileApp || options.bodyIsMobile) {
    return "phone";
  }
  return "desktop";
}

export function shouldCanvasCreationBoatFollowPointer(
  deviceMode: CanvasCreationEntryDeviceMode,
  composerOpen: boolean,
  submitting: boolean,
): boolean {
  return deviceMode !== "phone" && !composerOpen && !submitting;
}

export function shouldCanvasCreationEntryCloseComposerFirst(
  deviceMode: CanvasCreationEntryDeviceMode,
  composerOpen: boolean,
): boolean {
  return deviceMode !== "phone" && composerOpen;
}

export function sampleCanvasCreationPhoneRoamTarget(
  limits: {
    minimumX: number;
    maximumX: number;
    minimumY: number;
    maximumY: number;
    preferredMaximumY?: number;
  },
  options: {
    random?: () => number;
    current?: { x: number; y: number };
    aboveComposerRatio?: number;
    minimumTravel?: number;
  } = {},
): { x: number; y: number } {
  const minimumX = Math.min(limits.minimumX, limits.maximumX);
  const maximumX = Math.max(limits.minimumX, limits.maximumX);
  const minimumY = Math.min(limits.minimumY, limits.maximumY);
  const maximumY = Math.max(limits.minimumY, limits.maximumY);
  const preferredMaximumY = clampWaterValue(
    limits.preferredMaximumY ?? maximumY,
    minimumY,
    maximumY,
  );
  const random = options.random ?? Math.random;
  const nextRandom = () => {
    const value = Number(random());
    return Number.isFinite(value) ? clampWaterValue(value, 0, 0.999999) : 0;
  };
  const aboveComposerRatio = clampWaterValue(
    options.aboveComposerRatio ?? 0.8,
    0,
    1,
  );
  const minimumTravel = Math.max(0, options.minimumTravel ?? 0);
  const sample = () => {
    const edgeRoll = nextRandom();
    const xRoll = nextRandom();
    const zoneRoll = nextRandom();
    const yRoll = nextRandom();
    const x =
      edgeRoll < 0.18
        ? minimumX
        : edgeRoll < 0.36
          ? maximumX
          : minimumX + (maximumX - minimumX) * xRoll;
    const useComposerSafeBand =
      zoneRoll < aboveComposerRatio && preferredMaximumY > minimumY;
    const yMaximum = useComposerSafeBand ? preferredMaximumY : maximumY;
    return {
      x,
      y: minimumY + (yMaximum - minimumY) * yRoll,
    };
  };
  let fallback = sample();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = attempt === 0 ? fallback : sample();
    fallback = candidate;
    if (
      !options.current ||
      Math.hypot(
        candidate.x - options.current.x,
        candidate.y - options.current.y,
      ) >= minimumTravel
    ) {
      return candidate;
    }
  }
  return fallback;
}

export function advanceCanvasCreationBoatFollow(options: {
  boat: CanvasCreationWaterBoat;
  target: { x: number; y: number };
  deltaSeconds: number;
  reducedMotion?: boolean;
  maximumSpeed?: number;
  slowingDistance?: number;
}): { boat: CanvasCreationWaterBoat; arrived: boolean } {
  const deltaSeconds = clampWaterValue(options.deltaSeconds, 0, 0.05);
  const dx = options.target.x - options.boat.x;
  const dy = options.target.y - options.boat.y;
  const distance = Math.hypot(dx, dy);
  const desiredHeading =
    distance > 0.000001 ? Math.atan2(dy, dx) : options.boat.heading;
  if (options.reducedMotion) {
    return {
      boat: {
        ...options.boat,
        speed: 0,
      },
      arrived: true,
    };
  }
  if (distance < 1.5) {
    return {
      boat: {
        ...options.boat,
        x: options.target.x,
        y: options.target.y,
        heading: desiredHeading,
        speed: 0,
      },
      arrived: true,
    };
  }

  const maximumSpeed = options.maximumSpeed ?? 180;
  const slowingDistance = options.slowingDistance ?? 96;
  const speedScale = clampWaterValue(distance / slowingDistance, 0.2, 1);
  const step = Math.min(distance, maximumSpeed * speedScale * deltaSeconds);
  const followAmount = distance > 0 ? step / distance : 0;
  const headingAmount = 1 - Math.exp(-deltaSeconds * 7);
  const headingDelta = Math.atan2(
    Math.sin(desiredHeading - options.boat.heading),
    Math.cos(desiredHeading - options.boat.heading),
  );
  const speedPixels = deltaSeconds > 0 ? step / deltaSeconds : 0;
  return {
    boat: {
      ...options.boat,
      x: options.boat.x + dx * followAmount,
      y: options.boat.y + dy * followAmount,
      heading: options.boat.heading + headingDelta * headingAmount,
      speed: clampWaterValue(speedPixels / maximumSpeed, 0, 1),
    },
    arrived: false,
  };
}
