import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Exercise the built package used by the Obsidian adapter, not sibling core source.
import {
  CANVAS_CREATION_WATER_DEFAULTS,
  CanvasCreationWaterField,
  hashWaterPoint,
  sampleCanvasCreationFlowPosition,
} from "whiteboat-core";

const cases = [22, 24, 30, 48].flatMap((spacing) => [
  { spacing, width: spacing * 40, height: spacing * 25, topInset: 0 },
  { spacing, width: spacing * 40 + 7, height: spacing * 25 + 19, topInset: 12 },
  { spacing, width: 410, height: 994, topInset: 0 },
]);
const times = [0.001, 2.4, 8.7, 60, 180, 3600];

function cyclicGaps(values: number[], span: number): number[] {
  const sorted = [...values].sort((first, second) => first - second);
  return [
    ...sorted.slice(1).map((value, index) => value - sorted[index]),
    sorted[0] + span - sorted[sorted.length - 1],
  ];
}

describe("Obsidian consumed water-field package seam regression", () => {
  it.each(cases)(
    "preserves two-axis spacing at $width x $height with $spacing px samples",
    ({ width, height, spacing, topInset }) => {
      const columns = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil((height - topInset) / spacing) + 1;
      // Two samples can wander oppositely by twice the configured amplitude each.
      const wanderBudget = CANVAS_CREATION_WATER_DEFAULTS.flowWander * 4;
      const horizontalBudget = spacing * 0.07 + wanderBudget;
      const verticalBudget = spacing * 0.06 + wanderBudget;
      for (const time of times) {
        const points = Array.from({ length: rows }, (_, row) =>
          Array.from({ length: columns }, (_, column) =>
            sampleCanvasCreationFlowPosition({
              baseX: column * spacing +
                (hashWaterPoint(column, row, 1) - 0.5) * spacing * 0.07,
              baseY: topInset + row * spacing +
                (hashWaterPoint(row, 17, 2) - 0.5) * spacing * 0.06,
              column,
              row,
              width,
              height,
              topInset,
              spacing,
              time,
            }),
          ),
        );
        const horizontalGaps = points.flatMap((row) =>
          cyclicGaps(row.map((point) => point.x), columns * spacing),
        );
        const verticalGaps = Array.from({ length: columns }, (_, column) =>
          cyclicGaps(points.map((row) => row[column].y), rows * spacing),
        ).flat();
        expect(Math.max(...horizontalGaps), `horizontal maximum at ${time}s`)
          .toBeLessThanOrEqual(spacing + horizontalBudget + 0.000001);
        expect(Math.min(...horizontalGaps), `horizontal minimum at ${time}s`)
          .toBeGreaterThanOrEqual(spacing - horizontalBudget - 0.000001);
        expect(Math.max(...verticalGaps), `vertical maximum at ${time}s`)
          .toBeLessThanOrEqual(spacing + verticalBudget + 0.000001);
        expect(Math.min(...verticalGaps), `vertical minimum at ${time}s`)
          .toBeGreaterThanOrEqual(spacing - verticalBudget - 0.000001);
      }
    },
  );
});

describe("Obsidian consumed water-field rendered sample count", () => {
  let now: number;
  let nextFrameId: number;
  let frames: Map<number, FrameRequestCallback>;
  let field: CanvasCreationWaterField | undefined;

  class CountedPath {
    lines = 0;
    moveTo(): void {}
    lineTo(): void { this.lines += 1; }
  }

  beforeEach(() => {
    now = 1000;
    nextFrameId = 0;
    frames = new Map();
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
    vi.stubGlobal("Path2D", CountedPath);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const id = ++nextFrameId;
      frames.set(id, callback);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  });

  afterEach(() => {
    field?.destroy();
    field = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(cases)(
    "keeps one fixed sample set at $width x $height with $spacing px samples",
    ({ width, height, spacing, topInset }) => {
      vi.stubGlobal("getComputedStyle", () => ({
        getPropertyValue: (name: string) =>
          name === "--wb-entry-water-top-inset" ? `${topInset}px` : "",
      }));
      let renderedLines = 0;
      const context = {
        setTransform: vi.fn(),
        clearRect: () => { renderedLines = 0; },
        stroke: (path: CountedPath) => { renderedLines += path.lines; },
      };
      const canvas = {
        getContext: () => context,
        getBoundingClientRect: () => ({ width, height }),
      } as unknown as HTMLCanvasElement;
      field = new CanvasCreationWaterField(canvas, {
        tokenRoot: {} as HTMLElement,
        config: {
          ...CANVAS_CREATION_WATER_DEFAULTS,
          spacing,
          compactSpacing: spacing,
          lowPowerSpacing: spacing,
        },
      });
      const expectedLines = (Math.ceil(width / spacing) + 1) *
        (Math.ceil((height - topInset) / spacing) + 1);
      for (const time of times) {
        now = 1000 + time * 1000;
        const pending = [...frames.values()];
        frames.clear();
        expect(pending.length).toBeGreaterThan(0);
        pending.forEach((callback) => callback(now));
        expect(renderedLines, `rendered short-line count at ${time}s`)
          .toBe(expectedLines);
      }
    },
  );
});
