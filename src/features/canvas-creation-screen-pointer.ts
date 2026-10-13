import { Platform } from "obsidian";

interface Point {
  x: number;
  y: number;
}

interface ScreenPointerSource {
  getCursorScreenPoint(): Point;
  getContentBounds(): Point;
  getZoomFactor(): number;
  isMinimized(): boolean;
}

interface ElectronPointerBridge {
  remote?: {
    screen?: Pick<ScreenPointerSource, "getCursorScreenPoint">;
    getCurrentWindow?: () => Pick<ScreenPointerSource, "getContentBounds" | "isMinimized">;
  };
  webFrame: Pick<ScreenPointerSource, "getZoomFactor">;
}

function obsidianScreenPointerSource(): ScreenPointerSource | null {
  if (!Platform.isDesktopApp) return null;
  try {
    // Obsidian desktop exposes Electron's remote bridge. Keep this optional
    // and lazy so mobile never needs Electron or a native dependency.
    // Electron's optional remote bridge must be resolved inside this guarded
    // desktop path; a static runtime import would bypass the availability check.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional desktop-only host API
    const electron = require("electron") as ElectronPointerBridge;
    const screen = electron.remote?.screen;
    const hostWindow = electron.remote?.getCurrentWindow?.();
    if (!screen?.getCursorScreenPoint || !hostWindow) return null;
    return {
      getCursorScreenPoint: () => screen.getCursorScreenPoint(),
      getContentBounds: () => hostWindow.getContentBounds(),
      getZoomFactor: () => electron.webFrame.getZoomFactor(),
      isMinimized: () => hostWindow.isMinimized(),
    };
  } catch {
    return null;
  }
}

/** Screen and window bounds are both Electron DIP; CSS also needs host zoom. */
export function canvasCreationScreenPointToClient(
  point: Point,
  contentOrigin: Point,
  zoom: number,
): Point {
  return {
    x: (point.x - contentOrigin.x) / zoom,
    y: (point.y - contentOrigin.y) / zoom,
  };
}

export function startCanvasCreationScreenPointer(options: {
  isActive: () => boolean;
  onMove: (point: Point) => void;
  source?: ScreenPointerSource | null;
}): (() => void) | null {
  const source = options.source === undefined
    ? obsidianScreenPointerSource()
    : options.source;
  if (!source) return null;
  let previous: Point | null = null;
  let timer: number | null = null;
  const stop = () => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    previous = null;
  };
  const sample = () => {
    try {
      if (!options.isActive() || source.isMinimized()) {
        previous = null;
        return;
      }
      const point = source.getCursorScreenPoint();
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      const changed = previous && (previous.x !== point.x || previous.y !== point.y);
      previous = { ...point };
      // Opening Home or returning from typing does not move a stationary boat.
      if (!changed) return;
      const zoom = source.getZoomFactor();
      const origin = source.getContentBounds();
      if (!Number.isFinite(zoom) || zoom <= 0 ||
        !Number.isFinite(origin.x) || !Number.isFinite(origin.y)) return;
      options.onMove(canvasCreationScreenPointToClient(point, origin, zoom));
    } catch {
      // A host window may be destroyed or its optional bridge withdrawn.
      stop();
    }
  };
  timer = window.setInterval(sample, 80);
  sample();
  return stop;
}
