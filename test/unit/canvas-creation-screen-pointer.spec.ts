import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canvasCreationScreenPointToClient,
  startCanvasCreationScreenPointer,
} from "../../src/features/canvas-creation-screen-pointer";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Home system pointer", () => {
  it("maps desktop DIP through window origin and Obsidian zoom, including other displays", () => {
    expect(canvasCreationScreenPointToClient({ x: 1200, y: 700 }, { x: 200, y: 100 }, 2))
      .toEqual({ x: 500, y: 300 });
    expect(canvasCreationScreenPointToClient({ x: -1500, y: -200 }, { x: -1000, y: 100 }, 1))
      .toEqual({ x: -500, y: -300 });
  });

  it("reads only during active Home use and releases polling on close", () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", globalThis);
    let point = { x: 100, y: 100 };
    let active = true;
    let minimized = false;
    const source = {
      getCursorScreenPoint: vi.fn(() => point),
      getContentBounds: () => ({ x: 200, y: 100 }),
      getZoomFactor: () => 2,
      isMinimized: () => minimized,
    };
    const onMove = vi.fn();
    const stop = startCanvasCreationScreenPointer({ source, onMove, isActive: () => active });
    expect(onMove).not.toHaveBeenCalled();
    point = { x: -200, y: 300 };
    vi.advanceTimersByTime(80);
    expect(onMove).toHaveBeenLastCalledWith({ x: -200, y: 100 });
    vi.advanceTimersByTime(160);
    expect(onMove).toHaveBeenCalledTimes(1);

    active = false;
    const reads = source.getCursorScreenPoint.mock.calls.length;
    point = { x: 600, y: 500 };
    vi.advanceTimersByTime(160);
    expect(source.getCursorScreenPoint).toHaveBeenCalledTimes(reads);
    active = true;
    minimized = true;
    vi.advanceTimersByTime(80);
    expect(source.getCursorScreenPoint).toHaveBeenCalledTimes(reads);
    minimized = false;
    vi.advanceTimersByTime(80);
    expect(onMove).toHaveBeenCalledTimes(1);
    point = { x: 700, y: 500 };
    vi.advanceTimersByTime(80);
    expect(onMove).toHaveBeenLastCalledWith({ x: 250, y: 200 });
    stop?.();
    expect(vi.getTimerCount()).toBe(0);
    const stoppedReads = source.getCursorScreenPoint.mock.calls.length;
    vi.advanceTimersByTime(320);
    expect(source.getCursorScreenPoint).toHaveBeenCalledTimes(stoppedReads);
  });

  it("supports a missing native bridge and disposes a failing one", () => {
    expect(startCanvasCreationScreenPointer({ source: null, isActive: () => true, onMove: vi.fn() })).toBeNull();
    vi.useFakeTimers();
    vi.stubGlobal("window", globalThis);
    const onMove = vi.fn();
    startCanvasCreationScreenPointer({
      source: {
        getCursorScreenPoint: () => { throw new Error("window destroyed"); },
        getContentBounds: () => ({ x: 0, y: 0 }),
        getZoomFactor: () => 1,
        isMinimized: () => false,
      },
      isActive: () => true,
      onMove,
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(onMove).not.toHaveBeenCalled();
  });
});
