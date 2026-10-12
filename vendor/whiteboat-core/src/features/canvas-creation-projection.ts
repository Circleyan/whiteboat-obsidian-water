import {
  normalizeCanvasCreationLightIntensity,
  normalizeCanvasCreationWaterDepth,
  sampleCanvasCreationCelestialProjection,
  type CanvasCreationCelestialLight,
} from "./canvas-creation-light";

export function resolveCanvasCreationCelestialLight(): CanvasCreationCelestialLight {
  return document.body.classList.contains("theme-dark") ? "moon" : "sun";
}

export function applyCanvasCreationCelestialProjection(
  rootEl: HTMLElement,
  options: {
    elapsedSeconds: number;
    lightIntensity?: number;
    waterDepth?: number;
    reducedMotion?: boolean;
    deviceMode?: "desktop" | "tablet" | "phone";
    projectionScale?: number;
  },
): void {
  const deviceMode = options.deviceMode ?? "desktop";
  const projection = sampleCanvasCreationCelestialProjection({
    elapsedSeconds: options.elapsedSeconds,
    light: resolveCanvasCreationCelestialLight(),
    lightIntensity: options.lightIntensity,
    waterDepth: options.waterDepth,
    reducedMotion: options.reducedMotion,
  });
  const lightIntensity = normalizeCanvasCreationLightIntensity(
    options.lightIntensity,
  );
  const waterDepth = normalizeCanvasCreationWaterDepth(options.waterDepth);
  const phoneScale = deviceMode === "phone" ? 0.8 : 1;
  const composerDistanceScale = deviceMode === "phone" ? 0.2 : 1;
  const requestedProjectionScale = Number(options.projectionScale);
  const projectionScale =
    Number.isFinite(requestedProjectionScale) && requestedProjectionScale > 0
      ? requestedProjectionScale
      : 1;
  const set = (name: string, value: string) =>
    rootEl.style.setProperty(name, value);

  set("--wb-entry-celestial-light", projection.light);
  set("--wb-entry-celestial-light-intensity", String(lightIntensity));
  set("--wb-entry-water-depth", String(waterDepth));
  set("--wb-entry-celestial-projection-angle", `${projection.angleDeg}deg`);
  set(
    "--wb-entry-celestial-projection-counter-angle",
    `${projection.counterAngleDeg}deg`,
  );
  set(
    "--wb-entry-boat-projection-distance",
    `${projection.boat.distance * phoneScale * projectionScale}px`,
  );
  set("--wb-entry-boat-projection-blur", `${projection.boat.blur}px`);
  set("--wb-entry-boat-projection-opacity", String(projection.boat.opacity));
  set(
    "--wb-entry-pointer-projection-distance",
    `${projection.pointer.distance * projectionScale}px`,
  );
  set("--wb-entry-pointer-projection-blur", `${projection.pointer.blur}px`);
  set(
    "--wb-entry-pointer-projection-opacity",
    String(projection.pointer.opacity),
  );
  set(
    "--wb-entry-composer-projection-distance",
    `${projection.composer.distance * composerDistanceScale * projectionScale}px`,
  );
  set(
    "--wb-entry-composer-projection-blur",
    `${projection.composer.blur}px`,
  );
  set(
    "--wb-entry-composer-projection-opacity",
    String(projection.composer.opacity),
  );
  rootEl.dataset.celestialLight = projection.light;
  rootEl.dataset.celestialElevation = String(projection.elevation);
  rootEl.dataset.celestialLightIntensity = String(lightIntensity);
  rootEl.dataset.waterDepth = String(waterDepth);
}
