import { normalizeDiscWaterSettings, type DiscWaterSettings } from "./disc-water-settings";
import { advanceCanvasCreationBoatFollow, normalizeCanvasCreationBoatFollowSpeed } from "./canvas-creation-navigation";
import logoMarkSvg from "../assets/canvas-entry-logo-mark.svg";
import logoWordmarkSvg from "../assets/canvas-entry-logo-wordmark.svg";
import { CANVAS_CREATION_ANCHOR_ASSET } from "./canvas-creation-anchor-asset";
import { CANVAS_CREATION_BOAT_ASSETS } from "./canvas-creation-boat-assets";
import {
  normalizeCanvasCreationLightIntensity,
  normalizeCanvasCreationWaterDepth,
} from "./canvas-creation-light";
import { applyCanvasCreationCelestialProjection } from "./canvas-creation-projection";
export {
  applyCanvasCreationCelestialProjection,
  resolveCanvasCreationCelestialLight,
} from "./canvas-creation-projection";
import {
  CanvasCreationWaterField,
  clampWaterValue,
} from "./canvas-creation-water-field";

function svgDataUrl(source: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
}

function createDarkEntrySvg(source: string): string {
  return source.split("#262626").join("#F1F5F7");
}

export const CANVAS_CREATION_ENTRY_ASSETS = Object.freeze({
  anchor: CANVAS_CREATION_ANCHOR_ASSET,
  ...CANVAS_CREATION_BOAT_ASSETS,
  logoMark: svgDataUrl(logoMarkSvg),
  logoMarkDark: svgDataUrl(createDarkEntrySvg(logoMarkSvg)),
  logoWordmark: svgDataUrl(logoWordmarkSvg),
  logoWordmarkDark: svgDataUrl(createDarkEntrySvg(logoWordmarkSvg)),
});

export interface CanvasCreationHomePreviewController {
  update(options: {
    lightIntensity?: number;
    waterDepth?: number;
    discWater?: DiscWaterSettings;
    boatFollowSpeed?: number;
  }): {
    lightIntensity: number;
    waterDepth: number;
  };
  destroy(): void;
}

/**
 * Settings shows this exact desktop Home moment: a large opened composer
 * anchored near the upper-left and the boat waiting above it. It is a
 * normalized scene frame, not a settings-specific illustration.
 */
export const CANVAS_CREATION_DESKTOP_OPEN_COMPOSER_REFERENCE_LAYOUT =
  Object.freeze({
    boat: {
      x: 0.12,
      y: 0.19,
      heading: 0,
    },
    composer: {
      x: 0.18,
      y: 0.1,
    },
  });

function appendElement<K extends keyof HTMLElementTagNameMap>(
  parentEl: HTMLElement,
  tagName: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const element = parentEl.createEl(tagName, { cls: className });
  return element;
}

function appendImage(
  parentEl: HTMLElement,
  className: string,
  source: string,
): HTMLImageElement {
  const image = appendElement(parentEl, "img", className);
  image.src = source;
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  return image;
}

/**
 * Renders a non-interactive, scaled Home scene. The scene deliberately uses
 * the same Home DOM classes, assets, Canvas 2D water renderer, and celestial
 * CSS variables instead of a second settings-only illustration.
 */
export function mountCanvasCreationHomePreview(
  stageEl: HTMLElement,
  initialSettings: {
    lightIntensity: number;
    waterDepth: number;
    discWater?: DiscWaterSettings;
    boatFollowSpeed?: number;
  },
): CanvasCreationHomePreviewController {
  const owner = stageEl.win;
  let boatFollowSpeed = normalizeCanvasCreationBoatFollowSpeed(initialSettings.boatFollowSpeed);
  let discWater = normalizeDiscWaterSettings(initialSettings.discWater);
  const motionQuery = owner.matchMedia("(prefers-reduced-motion: reduce)");
  const rootEl = appendElement(
    stageEl,
    "div",
    "whiteboat-canvas-entry is-settings-preview",
  );
  rootEl.dataset.reducedMotion = String(motionQuery.matches);
  rootEl.dataset.deviceMode = "desktop";
  rootEl.dataset.previewScene = "desktop-open-composer-reference";

  const waterEl = appendElement(
    rootEl,
    "section",
    "whiteboat-canvas-entry__water",
  );
  const canvasEl = appendElement(
    waterEl,
    "canvas",
    "whiteboat-canvas-entry__water-canvas",
  );
  canvasEl.setAttribute("aria-hidden", "true");

  const boatEl = appendElement(
    waterEl,
    "button",
    "whiteboat-canvas-entry__boat",
  );
  boatEl.type = "button";
  boatEl.disabled = true;
  boatEl.tabIndex = -1;
  boatEl.setAttribute("aria-hidden", "true");
  const boatShadowEl = appendElement(
    boatEl,
    "span",
    "whiteboat-canvas-entry__boat-shadow",
  );
  boatShadowEl.setAttribute("aria-hidden", "true");
  const boatProjectionMask = `url("${CANVAS_CREATION_ENTRY_ASSETS.boatShadow}")`;
  boatShadowEl.style.setProperty("mask-image", boatProjectionMask);
  boatShadowEl.style.setProperty("-webkit-mask-image", boatProjectionMask);
  const boatBodyEl = appendElement(
    boatEl,
    "span",
    "whiteboat-canvas-entry__boat-body",
  );
  boatBodyEl.setAttribute("aria-hidden", "true");
  appendImage(
    boatBodyEl,
    "whiteboat-canvas-entry__boat-hull",
    CANVAS_CREATION_ENTRY_ASSETS.boatHull,
  );
  appendImage(
    boatBodyEl,
    "whiteboat-canvas-entry__boat-window",
    CANVAS_CREATION_ENTRY_ASSETS.boatWindow,
  );

  const composerEl = appendElement(
    waterEl,
    "div",
    "whiteboat-canvas-entry__composer is-open",
  );
  composerEl.setAttribute("aria-hidden", "true");
  const composerShadowEl = appendElement(
    composerEl,
    "span",
    "whiteboat-canvas-entry__composer-shadow",
  );
  composerShadowEl.setAttribute("aria-hidden", "true");
  const composerSurfaceEl = appendElement(
    composerEl,
    "div",
    "whiteboat-canvas-entry__composer-surface",
  );
  const composerHeaderEl = appendElement(
    composerSurfaceEl,
    "div",
    "whiteboat-canvas-entry__composer-header",
  );
  const composerTitleEl = appendElement(
    composerHeaderEl,
    "div",
    "whiteboat-canvas-entry__composer-title",
  );
  appendImage(composerTitleEl, "", CANVAS_CREATION_ENTRY_ASSETS.anchor);
  const composerTitleLabel = appendElement(composerTitleEl, "span", "");
  composerTitleLabel.textContent = "投入想法";
  const shortcutEl = appendElement(
    composerHeaderEl,
    "div",
    "whiteboat-canvas-entry__shortcut",
  );
  const keyEl = appendElement(
    shortcutEl,
    "button",
    "whiteboat-canvas-entry__command-key",
  );
  keyEl.type = "button";
  keyEl.setAttribute("aria-hidden", "true");
  keyEl.textContent = "⌘";
  const submitEl = appendElement(shortcutEl, "button", "");
  submitEl.type = "button";
  submitEl.disabled = true;
  submitEl.textContent = "回车";
  const composerBodyEl = appendElement(
    composerSurfaceEl,
    "div",
    "whiteboat-canvas-entry__composer-body",
  );
  const ideaEl = appendElement(
    composerBodyEl,
    "textarea",
    "whiteboat-canvas-entry__idea",
  );
  ideaEl.disabled = true;
  ideaEl.placeholder = "随便说说，你想到什么了？";

  const waterField = new CanvasCreationWaterField(canvasEl, {
    getDiscWaterSettings: () => discWater,
    tokenRoot: rootEl,
    reducedMotion: motionQuery.matches,
  });
  let lightIntensity = normalizeCanvasCreationLightIntensity(
    initialSettings.lightIntensity,
  );
  let waterDepth = normalizeCanvasCreationWaterDepth(
    initialSettings.waterDepth,
  );
  let previewScale = 0.5;
  const startedAt = performance.now();
  let celestialFrameId: number | null = null;
  let boat = { x: 0, y: 0, heading: 0, speed: 0, visible: true };
  let target: { x: number; y: number } | null = null;
  let lastFrame = 0;
  const moveBoat = (timestamp: number) => {
    if (target) {
      const step = advanceCanvasCreationBoatFollow({ boat, target, deltaSeconds: Math.min(.05, Math.max(0, timestamp - lastFrame) / 1000), maximumSpeed: 180 * boatFollowSpeed * previewScale, reducedMotion: motionQuery.matches });
      boat = step.boat;
      if (step.arrived) target = null;
      const width = boatEl.offsetWidth, height = boatEl.offsetHeight;
      boatEl.style.transform = `translate3d(${boat.x - width / 2}px, ${boat.y - height / 2}px, 0)`;
      boatEl.style.setProperty("--wb-entry-boat-heading", `${boat.heading + Math.PI * .5}rad`);
      waterField.setBoat({ ...boat, visible: true });
    }
    lastFrame = timestamp;
  };
  const onPointerMove = (event: PointerEvent) => {
    if (initialSettings.boatFollowSpeed === undefined) return;
    const rect = stageEl.getBoundingClientRect();
    target = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (motionQuery.matches) moveBoat(owner.performance.now());
  };
  stageEl.addEventListener("pointermove", onPointerMove);

  const applyProjection = (timestamp: number) => {
    applyCanvasCreationCelestialProjection(rootEl, {
      elapsedSeconds: Math.max(0, timestamp - startedAt) / 1000,
      lightIntensity,
      waterDepth,
      reducedMotion: motionQuery.matches,
      deviceMode: "desktop",
      projectionScale: previewScale,
    });
  };

  const layout = () => {
    if (!rootEl.isConnected) {
      return;
    }
    const rect = waterEl.getBoundingClientRect();
    previewScale = clampWaterValue(
      Math.min(rect.width / 1440, rect.height / 810),
      initialSettings.boatFollowSpeed === undefined ? 0.38 : 0.1,
      0.55,
    );
    rootEl.style.setProperty("--wb-entry-preview-scale", String(previewScale));
    const reference =
      CANVAS_CREATION_DESKTOP_OPEN_COMPOSER_REFERENCE_LAYOUT;
    const boatX = rect.width * reference.boat.x;
    const boatY = rect.height * reference.boat.y;
    boat = { x: boatX, y: boatY, heading: reference.boat.heading, speed: 0, visible: true };
    const boatWidth = boatEl.offsetWidth || 108 * previewScale;
    const boatHeight = boatEl.offsetHeight || 108 * previewScale;
    boatEl.style.transform = `translate3d(${boatX - boatWidth / 2}px, ${
      boatY - boatHeight / 2
    }px, 0)`;
    boatEl.style.setProperty(
      "--wb-entry-boat-heading",
      `${reference.boat.heading + Math.PI * 0.5}rad`,
    );
    composerEl.style.left = `${rect.width * reference.composer.x}px`;
    composerEl.style.top = `${rect.height * reference.composer.y}px`;
    waterField.resize();
    waterField.setBoat({
      x: boatX,
      y: boatY,
      heading: reference.boat.heading,
      speed: 0,
      visible: true,
    });
    applyProjection(performance.now());
  };

  const scheduleCelestialMotion = () => {
    if (celestialFrameId !== null || motionQuery.matches) {
      return;
    }
    celestialFrameId = owner.requestAnimationFrame((timestamp) => {
      celestialFrameId = null;
      if (!rootEl.isConnected) {
        return;
      }
      applyProjection(timestamp);
      moveBoat(timestamp);
      scheduleCelestialMotion();
    });
  };

  const onMotionChange = (event: MediaQueryListEvent) => {
    rootEl.dataset.reducedMotion = String(event.matches);
    waterField.setReducedMotion(event.matches);
    applyProjection(performance.now());
    scheduleCelestialMotion();
  };
  const resizeObserver =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(layout)
      : null;
  resizeObserver?.observe(stageEl);
  motionQuery.addEventListener("change", onMotionChange);
  waterField.start();
  owner.requestAnimationFrame(() => {
    layout();
    scheduleCelestialMotion();
  });

  return {
    update(options): { lightIntensity: number; waterDepth: number } {
      if (options.boatFollowSpeed !== undefined) boatFollowSpeed = normalizeCanvasCreationBoatFollowSpeed(options.boatFollowSpeed);
      if (options.lightIntensity !== undefined) {
        lightIntensity = normalizeCanvasCreationLightIntensity(
          options.lightIntensity,
        );
      }
      if (options.waterDepth !== undefined) {
        waterDepth = normalizeCanvasCreationWaterDepth(options.waterDepth);
      }
      if (options.discWater) { discWater = normalizeDiscWaterSettings(options.discWater); waterField.refreshColors(); }
      applyProjection(performance.now());
      return { lightIntensity, waterDepth };
    },
    destroy(): void {
      if (celestialFrameId !== null) {
        owner.cancelAnimationFrame(celestialFrameId);
        celestialFrameId = null;
      }
      resizeObserver?.disconnect();
      motionQuery.removeEventListener("change", onMotionChange);
      stageEl.removeEventListener("pointermove", onPointerMove);
      waterField.destroy();
      rootEl.remove();
    },
  };
}
