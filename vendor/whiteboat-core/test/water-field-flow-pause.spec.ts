import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CanvasCreationWaterField,
  sampleCanvasCreationMooringAccent,
  sampleCanvasCreationFocusFade,
  resolveCanvasCreationFocusFadeTier,
  CANVAS_CREATION_FOCUS_FADE_TIER_COUNT,
} from "../src/features/canvas-creation-water-field";
import {
  CANVAS_CREATION_COMPOSER_MOTION,
  resolveCanvasCreationWaterFlowTiming,
} from "../src/features/canvas-creation-composer-motion";

type Point = [number, number];
type Stroke = { points: Point[]; color: string; opacity: number };

class RecordedPath {
  readonly points: Point[] = [];
  moveTo(x: number, y: number): void { this.points.push([x, y]); }
  lineTo(x: number, y: number): void { this.points.push([x, y]); }
}

describe("water field flow pause", () => {
  let now: number;
  let nextFrameId: number;
  let frames: Map<number, FrameRequestCallback>;
  let fields: CanvasCreationWaterField[];

  beforeEach(() => {
    now = 1000;
    nextFrameId = 0;
    frames = new Map();
    fields = [];
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("document", {
      hidden: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("window", {
      devicePixelRatio: 1,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("navigator", { hardwareConcurrency: 8, deviceMemory: 8 });
    vi.stubGlobal("ResizeObserver", undefined);
    vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "" }));
    vi.stubGlobal("Path2D", RecordedPath);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const id = ++nextFrameId;
      frames.set(id, callback);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  });

  afterEach(() => {
    fields.forEach((field) => field.destroy());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function createField(reducedMotion = false, options: {
    flowTimeScale?: number;
  } = {}) {
    let strokes: Stroke[] = [];
    const context = {
      strokeStyle: "",
      globalAlpha: 1,
      setTransform: vi.fn(),
      clearRect: () => { strokes = []; },
      stroke: (path: RecordedPath) => {
        strokes.push({
          points: path.points,
          color: context.strokeStyle,
          opacity: context.globalAlpha,
        });
      },
    };
    const canvas = {
      getContext: () => context,
      getBoundingClientRect: () => ({ width: 640, height: 400 }),
    } as unknown as HTMLCanvasElement;
    const field = new CanvasCreationWaterField(canvas, {
      tokenRoot: {} as HTMLElement,
      createProbe: () => document.createElement("div"),
      ownerWindow: { requestAnimationFrame, cancelAnimationFrame },
      reducedMotion,
      ...options,
    });
    fields.push(field);
    return { field, snapshot: () => structuredClone(strokes) };
  }

  function renderAt(timestamp: number): void {
    now = timestamp;
    const pending = [...frames.values()];
    frames.clear();
    expect(pending.length).toBeGreaterThan(0);
    pending.forEach((callback) => callback(timestamp));
  }

  function allSegments(strokes: Stroke[]): string[] {
    return strokes.flatMap((stroke) =>
      Array.from({ length: stroke.points.length / 2 }, (_, index) =>
        JSON.stringify(stroke.points.slice(index * 2, index * 2 + 2)),
      ),
    ).sort();
  }

  function clock(field: CanvasCreationWaterField) {
    return {
      timestamp: Reflect.get(field, "flowTimestamp") as number,
      scale: Reflect.get(field, "flowScale") as number,
      transition: Reflect.get(field, "flowTransition"),
    };
  }

  it("times the stop and restart to the composer's appear and cancel motion", () => {
    expect(resolveCanvasCreationWaterFlowTiming(false)).toEqual({
      pauseDurationMs: CANVAS_CREATION_COMPOSER_MOTION.appear.durationMs,
      resumeDurationMs: CANVAS_CREATION_COMPOSER_MOTION.cancel.durationMs,
    });
    expect(resolveCanvasCreationWaterFlowTiming(true)).toEqual({
      pauseDurationMs: 0, resumeDurationMs: 0,
    });
  });

  it("integrates the 1.2 baseline, quintic stop and cubic resume exactly", () => {
    // Stop over the 640ms composer appear, restart over its 240ms cancel.
    const { field } = createField(false, { flowTimeScale: 1.2 });
    renderAt(1100);
    expect(clock(field).timestamp).toBeCloseTo(1120, 9);
    field.setFlowPaused(true);
    renderAt(1420);
    expect(clock(field).scale).toBeCloseTo(0.0375, 9);
    expect(clock(field).timestamp).toBeCloseTo(1246, 9);
    field.setFlowPaused(true); // An identical state must not restart the stop.
    renderAt(1740);
    expect(clock(field)).toEqual({ timestamp: 1248, scale: 0, transition: null });
    renderAt(2400);
    expect(clock(field).timestamp).toBe(1248);
    now = 2800;
    field.setFlowPaused(false);
    renderAt(2920);
    expect(clock(field).scale).toBeCloseTo(0.6, 9);
    expect(clock(field).timestamp).toBeCloseTo(1266, 9);
    renderAt(3040);
    expect(clock(field).timestamp).toBeCloseTo(1392, 9);
    expect(clock(field).scale).toBe(1.2);
    expect(clock(field).transition).toBeNull();
    renderAt(3140);
    expect(clock(field).timestamp).toBeCloseTo(1512, 9);
  });

  it("interrupts stop and resume from the instantaneous velocity without phase catch-up", () => {
    const { field } = createField(false, { flowTimeScale: 1.2 });
    field.setFlowPaused(true);
    renderAt(1320);
    const beforeReentry = clock(field);
    expect(beforeReentry.timestamp).toBeCloseTo(1126, 9);
    field.setFlowPaused(false);
    expect(clock(field).timestamp).toBe(beforeReentry.timestamp);
    expect(clock(field).scale).toBe(beforeReentry.scale);
    renderAt(1440);
    expect(clock(field).scale).toBeCloseTo(0.61875, 9);
    expect(clock(field).timestamp).toBeCloseTo(1147.9375, 9);
    field.setFlowPaused(true);
    renderAt(2080);
    expect(clock(field).timestamp).toBeCloseTo(1213.9375, 9);
    expect(clock(field).scale).toBe(0);
    renderAt(10000);
    expect(clock(field).timestamp).toBeCloseTo(1213.9375, 9);
  });

  it("has the same integrated stop distance with a late frame or many frames", () => {
    const coarse = createField(false, { flowTimeScale: 1.2 });
    coarse.field.setFlowPaused(true);
    renderAt(9000);
    const stopped = clock(coarse.field).timestamp;
    coarse.field.destroy();
    now = 1000;
    const fine = createField(false, { flowTimeScale: 1.2 });
    fine.field.setFlowPaused(true);
    [1040, 1110, 1200, 1320, 1450, 1600, 1700, 9000].forEach(renderAt);
    expect(clock(fine.field).timestamp).toBeCloseTo(stopped, 9);
    expect(stopped).toBeCloseTo(1128, 9);
  });

  it("freezes the current phase, keeps rendering, and excludes repeated pause durations", () => {
    const paused = createField();
    renderAt(1200);
    paused.field.setFlowPaused(true);
    renderAt(1840);
    const stopped = paused.snapshot();
    const stopDistance = 640 / 6;
    expect(clock(paused.field).timestamp).toBeCloseTo(1200 + stopDistance, 9);
    renderAt(5000);
    expect(paused.snapshot()).toEqual(stopped);
    paused.field.setFlowPaused(true);
    renderAt(9000);
    expect(paused.snapshot()).toEqual(stopped);
    expect(frames.size).toBe(1);

    paused.field.setFlowPaused(false);
    renderAt(9240);
    const firstResume = paused.snapshot();
    const firstFlow = clock(paused.field).timestamp;
    expect(firstResume).not.toEqual(stopped);
    expect(firstFlow).toBeCloseTo(1200 + stopDistance + 120, 9);
    paused.field.setFlowPaused(false);
    paused.field.setFlowPaused(true);
    renderAt(20000);
    paused.field.setFlowPaused(false);
    renderAt(20240);
    const secondResume = paused.snapshot();
    const secondFlow = clock(paused.field).timestamp;
    expect(secondFlow).toBeCloseTo(firstFlow + stopDistance + 120, 9);
    paused.field.destroy();

    // The paused stretch adds nothing: phase depends only on integrated flow.
    now = 1000;
    const continuous = createField();
    renderAt(firstFlow);
    expect(firstResume).toEqual(continuous.snapshot());
    renderAt(secondFlow);
    expect(secondResume).toEqual(continuous.snapshot());
  });

  it("keeps existing colored wakes aging while ordinary water stays paused", () => {
    const paused = createField();
    paused.field.setBoat({ x: 220, y: 200, heading: 0, speed: 1, visible: true });
    now = 1100;
    paused.field.setBoat({ x: 250, y: 200, heading: 0, speed: 1, visible: true });
    paused.field.setBoat(null);
    paused.field.setFlowPaused(true);
    renderAt(1740);
    const beforePause = paused.snapshot();
    expect(beforePause.slice(3).some((stroke) => stroke.points.length > 0)).toBe(true);
    renderAt(2100);
    const agedWake = paused.snapshot();
    expect(agedWake.slice(3)).not.toEqual(beforePause.slice(3));
    const farOrdinaryPoints = (strokes: Stroke[]) => strokes.slice(0, 3).flatMap(
      (stroke) => stroke.points.filter(([x]) => x > 500),
    );
    expect(farOrdinaryPoints(agedWake)).toEqual(farOrdinaryPoints(beforePause));
    renderAt(3000);
    expect(paused.snapshot().slice(3).every((stroke) => stroke.points.length === 0)).toBe(true);
    expect(farOrdinaryPoints(paused.snapshot())).toEqual(farOrdinaryPoints(beforePause));
  });

  it.each([true, false])("creates and expires new wakes on real time after a long pause (still paused: %s)", (keepPaused) => {
    const { field, snapshot } = createField();
    field.setFlowPaused(true);
    renderAt(1640);
    const emptyWater = snapshot();
    renderAt(20000);
    if (!keepPaused) field.setFlowPaused(false);
    field.setBoat({ x: 220, y: 200, heading: 0, speed: 1, visible: true });
    now = 20100;
    field.setBoat({ x: 250, y: 200, heading: 0, speed: 1, visible: true });
    field.setBoat(null);
    renderAt(20200);
    expect(snapshot().slice(3).some((stroke) => stroke.points.length > 0)).toBe(true);
    renderAt(22000);
    expect(snapshot().slice(3).every((stroke) => stroke.points.length === 0)).toBe(true);
    if (keepPaused) expect(snapshot()).toEqual(emptyWater);
  });

  it("updates boat-contact color while every paused dash keeps its base geometry", () => {
    const { field, snapshot } = createField();
    field.setFlowPaused(true);
    renderAt(1640);
    const emptyWater = snapshot();
    field.setBoat({ x: 320, y: 200, heading: 0, speed: 0, visible: true });
    renderAt(2000);
    const firstPose = snapshot();
    field.setBoat({ x: 322, y: 201, heading: 0.2, speed: 0, visible: true });
    renderAt(4000);
    const secondPose = snapshot();
    const farPoints = (strokes: Stroke[]) => strokes.flatMap((stroke) =>
      stroke.points.filter(([x]) => x < 100 || x > 540),
    );
    const pointCount = (strokes: Stroke[]) => strokes.reduce(
      (count, stroke) => count + stroke.points.length, 0,
    );
    expect(secondPose).not.toEqual(firstPose);
    expect(secondPose.slice(3)).not.toEqual(firstPose.slice(3));
    expect(farPoints(secondPose)).toEqual(farPoints(firstPose));
    expect(pointCount(secondPose)).toBe(pointCount(emptyWater));
    expect(allSegments(firstPose)).toEqual(allSegments(emptyWater));
    expect(allSegments(secondPose)).toEqual(allSegments(emptyWater));
    // First three stroke buckets are the ordinary palette. Every remaining gray
    // segment, including those close to the hull, must keep its original geometry.
    const ordinarySegments = (strokes: Stroke[]) => strokes.slice(0, 3).flatMap(
      (stroke) => Array.from({ length: stroke.points.length / 2 }, (_, index) =>
        JSON.stringify(stroke.points.slice(index * 2, index * 2 + 2)),
      ),
    );
    const baseSegments = new Set(ordinarySegments(emptyWater));
    for (const pose of [firstPose, secondPose]) {
      expect(ordinarySegments(pose).every((segment) => baseSegments.has(segment))).toBe(true);
    }
    // Rocking with zero sailing speed does not add a traveled wake of its own.
    field.setBoat(null);
    renderAt(6000);
    expect(snapshot()).toEqual(emptyWater);
  });

  it("preserves reduced-motion static water and event-only rendering", () => {
    const { field, snapshot } = createField(true);
    renderAt(1200);
    const staticWater = snapshot();
    expect(frames.size).toBe(0);
    field.setFlowPaused(true);
    renderAt(6000);
    expect(snapshot()).toEqual(staticWater);
    expect(frames.size).toBe(0);
    field.setFlowPaused(false);
    renderAt(10000);
    expect(snapshot()).toEqual(staticWater);
    expect(frames.size).toBe(0);
    field.setBoat({ x: 320, y: 200, heading: 0, speed: 0, visible: true });
    renderAt(11000);
    expect(snapshot()).not.toEqual(staticWater);
    expect(frames.size).toBe(0);
  });

  it("follows the rocking hull with local color and preserves every dash's geometry", () => {
    const { field, snapshot } = createField();
    field.setFlowPaused(true);
    renderAt(1640);
    const plainGeometry = allSegments(snapshot());
    const center = { x: 320, y: 200 };
    const boat = { ...center, heading: 0.4, roll: 0.1, speed: 0, visible: true };
    field.setBoat(boat);
    field.setMooring(center);
    renderAt(1840);
    const first = snapshot();
    now = 2240;
    field.setMooring({ ...center });
    renderAt(2640);
    expect(snapshot()).toEqual(first);
    expect(Reflect.get(field, "mooring").startedAt).toBe(1640);
    field.setBoat({ ...boat, roll: -0.1 });
    renderAt(2840);
    const oppositeRoll = snapshot();
    field.setBoat({ ...boat, x: 322, y: 201, heading: 0.6 });
    renderAt(3040);
    const movedPose = snapshot();
    const coloredRadii = (strokes: Stroke[], pose: { x: number; y: number }) => strokes.slice(3).flatMap((stroke) =>
      Array.from({ length: stroke.points.length / 2 }, (_, index) => {
        const start = stroke.points[index * 2], end = stroke.points[index * 2 + 1];
        return Math.hypot((start[0] + end[0]) / 2 - pose.x, (start[1] + end[1]) / 2 - pose.y);
      }),
    );
    for (const [strokes, pose] of [
      [first, center], [oppositeRoll, center], [movedPose, { x: 322, y: 201 }],
    ] as const) {
      const radii = coloredRadii(strokes, pose);
      expect(radii.length).toBeGreaterThan(0);
      expect(radii.every((radius) => radius < 100)).toBe(true);
      expect(allSegments(strokes)).toEqual(plainGeometry);
    }
    expect(first.slice(3)).not.toEqual(oppositeRoll.slice(3));
    expect(movedPose.slice(3)).not.toEqual(oppositeRoll.slice(3));
    field.setMooring(null);
    field.setBoat(null);
    renderAt(3240);
    expect(snapshot().slice(3).every((stroke) => stroke.points.length === 0)).toBe(true);
    expect(allSegments(snapshot())).toEqual(plainGeometry);
  });

  it("keeps two hull-side leaves in a fixed footprint with no ring or autonomous pulse", () => {
    const boat = { x: 20, y: 30, heading: 0, roll: 0.1, speed: 0, visible: true };
    const mooring = { x: 0, y: 0, elapsedMs: 180 };
    const sample = (dx: number, dy: number, elapsedMs = 180) =>
      sampleCanvasCreationMooringAccent(boat.x + dx, boat.y + dy, { ...mooring, elapsedMs }, boat);
    expect(sample(0, 17, 0)).toBe(0);
    expect(sample(0, 17, 90)).toBeCloseTo(0.34);
    expect(sample(0, 17)).toBeCloseTo(0.68);
    expect(sample(0, -17)).toBeCloseTo(0.36);
    expect(sample(0, 0)).toBe(0);
    // Wider after mooring: reaches along the hull and out beside it.
    // Wider after mooring: colored dashes (accent > 0.16) reach ~55px along
    // the hull and ~50px out from its centerline, but never beyond.
    expect(sample(50, 17)).toBeGreaterThan(0.16);
    expect(sample(0, 48)).toBeGreaterThan(0.16);
    expect(sample(0, 8)).toBeLessThan(sample(0, 30));
    expect(sample(88, 17)).toBe(0);
    expect(sample(0, 70)).toBe(0);
    expect(sampleCanvasCreationMooringAccent(20, 47, mooring)).toBe(0);
    expect(sampleCanvasCreationMooringAccent(20, 47, mooring, { ...boat, visible: false })).toBe(0);
    for (const elapsed of [180, 1250, 3000, 100000]) {
      for (let x = -115; x <= 115; x += 5) {
        for (let y = -115; y <= 115; y += 5) {
          expect(sample(x, y, elapsed)).toBe(sample(x, y));
          if (Math.hypot(x, y) >= 110) expect(sample(x, y, elapsed)).toBe(0);
        }
      }
    }
  });

  it("swaps side intensity with roll and follows the actual visual boat heading", () => {
    const mooring = { x: 0, y: 0, elapsedMs: 1000 };
    const boat = { x: 20, y: 30, heading: 0, roll: 0.1, speed: 0, visible: true };
    const positive = sampleCanvasCreationMooringAccent(20, 47, mooring, boat);
    const negative = sampleCanvasCreationMooringAccent(20, 13, mooring, boat);
    expect(sampleCanvasCreationMooringAccent(20, 47, mooring, { ...boat, roll: -0.1 })).toBe(negative);
    expect(sampleCanvasCreationMooringAccent(20, 13, mooring, { ...boat, roll: -0.1 })).toBe(positive);
    expect(sampleCanvasCreationMooringAccent(3, 30, mooring, { ...boat, heading: Math.PI / 2 })).toBeCloseTo(positive);
    expect(sampleCanvasCreationMooringAccent(20, 47, mooring, { ...boat, heading: Math.PI / 2 })).toBe(0);
  });

  it("keeps reduced-motion hull contact static and avoids redraws for the same center", () => {
    const { field, snapshot } = createField(true, { flowTimeScale: 1.2 });
    field.setFlowPaused(true);
    field.setMooring({ x: 320, y: 200 });
    const boat = { x: 320, y: 200, heading: 0, roll: 0.1, speed: 0, visible: true };
    field.setBoat(boat);
    renderAt(1200);
    const first = snapshot();
    expect(first.slice(3).some((stroke) => stroke.points.length > 0)).toBe(true);
    expect(clock(field).scale).toBe(0);
    expect(clock(field).transition).toBeNull();
    expect(frames.size).toBe(0);
    field.setMooring({ x: 320, y: 200 });
    expect(frames.size).toBe(0);
    field.resize();
    renderAt(10000);
    expect(snapshot()).toEqual(first);
    expect(frames.size).toBe(0);
    field.setBoat({ ...boat, roll: -0.1 });
    renderAt(11000);
    expect(snapshot()).toEqual(first);
    expect(frames.size).toBe(0);
    for (const elapsedMs of [0, 90, 180, 9000]) {
      expect(sampleCanvasCreationMooringAccent(320, 217, {
        x: 320, y: 200, elapsedMs, reducedMotion: true,
      }, boat)).toBe(0.40);
    }
  });

  it("recedes dashes by distance from the focus clear area, following its amount", () => {
    const focus = { x: 320, y: 200, rx: 100, ry: 60, padding: 40, amount: 1 };
    expect(sampleCanvasCreationFocusFade(320, 200, focus)).toBe(0);
    expect(sampleCanvasCreationFocusFade(320 + 125, 200, focus)).toBe(0);
    const near = sampleCanvasCreationFocusFade(320 + 180, 200, focus);
    const far = sampleCanvasCreationFocusFade(320 + 260, 200, focus);
    expect(near).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(near);
    expect(sampleCanvasCreationFocusFade(320 + 400, 200, focus)).toBe(1);
    expect(sampleCanvasCreationFocusFade(320 + 400, 200, { ...focus, amount: 0.5 })).toBe(0.5);
    expect(resolveCanvasCreationFocusFadeTier(0, 0.99)).toBe(0);
    expect(resolveCanvasCreationFocusFadeTier(1, 0)).toBe(CANVAS_CREATION_FOCUS_FADE_TIER_COUNT - 1);
    const tiers = new Set([0.1, 0.5, 0.9].map((dither) => resolveCanvasCreationFocusFadeTier(0.5, dither)));
    expect(tiers.size).toBe(2);
  });

  it("fades the dashes themselves with no overlay, and restores them when focus clears", () => {
    vi.stubGlobal("getComputedStyle", () => ({
      getPropertyValue: (name: string) => name === "--wb-entry-water-focus-dash-floor" ? "0.2" : "",
    }));
    const { field, snapshot } = createField(true);
    renderAt(1200);
    const plain = snapshot();
    const plainPoints = allSegments(plain).sort();
    field.setFocus({ x: 320, y: 200, rx: 60, ry: 40, padding: 20, amount: 1 });
    renderAt(1300);
    const focused = snapshot();
    // Same dashes in the same places; only their opacity changes.
    expect(allSegments(focused).sort()).toEqual(plainPoints);
    const opacityAt = (px: number, py: number) => {
      const stroke = focused.find((entry) => entry.points.some(([x, y]) => Math.hypot(x - px, y - py) < 12));
      return stroke?.opacity ?? null;
    };
    const faded = focused.filter((stroke) => stroke.points.length > 0 && stroke.opacity < 1);
    expect(faded.length).toBeGreaterThan(0);
    expect(Math.min(...faded.map((stroke) => stroke.opacity))).toBeCloseTo(0.2);
    expect(opacityAt(320, 200)).toBe(1);
    expect(opacityAt(20, 20)).toBeCloseTo(0.2);
    field.setFocus(null);
    renderAt(1400);
    expect(snapshot()).toEqual(plain);
  });

  it("leaves dashes untouched when the host sets no dash floor", () => {
    const { field, snapshot } = createField(true);
    renderAt(1200);
    const plain = snapshot();
    field.setFocus({ x: 320, y: 200, rx: 60, ry: 40, padding: 20, amount: 1 });
    renderAt(1300);
    expect(snapshot()).toEqual(plain);
  });
});
