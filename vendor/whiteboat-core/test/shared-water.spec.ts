import { describe, expect, it } from "vitest";
import {
  CANVAS_CREATION_STATIONARY_WAKE_RADIUS_SCALE,
  resolveCanvasCreationWakeFadeTier,
  sampleCanvasCreationBoatResponse,
  sampleCanvasCreationFlowPosition,
} from "../src/features/canvas-creation-water-field";
import {
  advanceCanvasCreationBoatFollow,
  sampleCanvasCreationPhoneRoamTarget,
  shouldCanvasCreationBoatFollowPointer,
} from "../src/features/canvas-creation-navigation";
import {
  normalizeCanvasCreationLightIntensity,
  sampleCanvasCreationCelestialProjection,
} from "../src/features/canvas-creation-light";

describe("Whiteboat shared water capabilities", () => {
  it("follows fine pointers only before a composer opens", () => {
    expect(shouldCanvasCreationBoatFollowPointer("desktop", false, false)).toBe(true);
    expect(shouldCanvasCreationBoatFollowPointer("tablet", false, false)).toBe(true);
    expect(shouldCanvasCreationBoatFollowPointer("desktop", true, false)).toBe(false);
    expect(shouldCanvasCreationBoatFollowPointer("phone", false, false)).toBe(false);
  });

  it("moves toward a target with a capped step", () => {
    const step = advanceCanvasCreationBoatFollow({
      boat: { x: 100, y: 100, heading: 0, speed: 0, visible: true },
      target: { x: 400, y: 100 },
      deltaSeconds: 0.05,
    });

    expect(step.arrived).toBe(false);
    expect(step.boat.x).toBeGreaterThan(100);
    expect(step.boat.x).toBeLessThanOrEqual(109);
    expect(step.boat.y).toBe(100);
  });

  it("keeps phone roaming inside the shared sampler", () => {
    const values = [0.2, 0.5, 0.2, 0.5];
    const target = sampleCanvasCreationPhoneRoamTarget(
      {
        minimumX: -40,
        maximumX: 430,
        minimumY: 40,
        maximumY: 800,
        preferredMaximumY: 620,
      },
      { random: () => values.shift() ?? 0.5 },
    );

    expect(target).toEqual({ x: 430, y: 330 });
  });

  it.each([
    { name: "DSH", topInset: 0, time: 3 },
    { name: "Obsidian", topInset: 12, time: 8.7 },
  ])("keeps $name vertical flow rows evenly spaced across wrapping", ({
    topInset,
    time,
  }) => {
    const height = 437;
    const spacing = 24;
    const rowCount = Math.ceil((height - topInset) / spacing) + 1;
    const positions = Array.from({ length: rowCount }, (_, row) =>
      sampleCanvasCreationFlowPosition({
        baseX: 0,
        baseY: topInset + row * spacing,
        column: 0,
        row,
        width: 971,
        height,
        topInset,
        spacing,
        time,
      }).y,
    ).sort((first, second) => first - second);
    const minimumGap = Math.min(
      ...positions.slice(1).map((position, index) =>
        position - positions[index]
      ),
    );

    expect(minimumGap).toBeGreaterThan(spacing * 0.7);
  });

  it("keeps the horizontal flow wrap aligned with the rendered column grid", () => {
    const width = 946;
    const spacing = 24;
    const columnCount = Math.ceil(width / spacing) + 1;
    const time = 2.4;
    const positions = Array.from({ length: columnCount }, (_, column) =>
      sampleCanvasCreationFlowPosition({
        baseX: column * spacing,
        baseY: 0,
        column,
        row: 0,
        width,
        height: 437,
        topInset: 0,
        spacing,
        time,
      }).x,
    ).sort((first, second) => first - second);
    const wrapSpan = columnCount * spacing;
    const cyclicGaps = positions
      .slice(1)
      .map((position, index) => position - positions[index]);
    cyclicGaps.push(
      positions[0] + wrapSpan - positions[positions.length - 1],
    );

    expect(Math.max(...cyclicGaps)).toBeLessThan(spacing * 1.25);
  });

  it("keeps the five wake tiers and expanded stationary radius", () => {
    const response = sampleCanvasCreationBoatResponse(90, 0, {
      x: 0,
      y: 0,
      heading: 0,
      speed: 0,
      visible: true,
    });

    expect(resolveCanvasCreationWakeFadeTier(0.9)).toBe(0);
    expect(resolveCanvasCreationWakeFadeTier(0.2)).toBe(4);
    expect(CANVAS_CREATION_STATIONARY_WAKE_RADIUS_SCALE).toBe(1.3);
    expect(response.influence).toBeGreaterThan(0);
    expect(response.accent).toBeGreaterThan(0);
  });

  it("keeps celestial projection host-neutral", () => {
    expect(normalizeCanvasCreationLightIntensity(20)).toBe(1.6);
    const projection = sampleCanvasCreationCelestialProjection({
      elapsedSeconds: 10,
      light: "moon",
      lightIntensity: 1,
      waterDepth: 1,
    });

    expect(projection.light).toBe("moon");
    expect(projection.boat.distance).toBeGreaterThan(0);
    expect(projection.composer.blur).toBeGreaterThan(projection.boat.blur);
    expect(projection.shadowLengthFactor).toBeGreaterThan(0);
    expect(projection.normalIncidence).toBeCloseTo(projection.elevation, 3);
    const highSun = sampleCanvasCreationCelestialProjection({
      light: "sun",
      elapsedSeconds: 0,
    });
    const lowSun = sampleCanvasCreationCelestialProjection({
      light: "sun",
      elapsedSeconds: 42,
    });
    expect(lowSun.elevation).toBeLessThan(highSun.elevation);
    expect(lowSun.shadowLengthFactor).toBeGreaterThan(
      highSun.shadowLengthFactor,
    );
  });
});
