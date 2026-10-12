import {
  ACESFilmicToneMapping, DirectionalLight, HemisphereLight,
  Mesh, MeshStandardMaterial, OrthographicCamera, PCFSoftShadowMap, Scene,
  Vector3, WebGLRenderer,
} from "three";
import { createCanvasCreationBoatModel, disposeCanvasCreationBoatModel } from "./canvas-creation-boat-model";
import { createBoatToneGrade } from "./canvas-creation-boat-tone";
import { createBoatMoonlight } from "./canvas-creation-boat-moonlight";

export interface CanvasCreationBoatLightFrame {
  angleDeg: number;
  elevation: number;
  lightIntensity: number;
  night: boolean;
  visibility: number;
  seconds: number;
  reducedMotion: boolean;
  mooringRoll?: number;
}

/** A small transparent WebGL canvas, not a second full-screen water renderer. */
export function mountCanvasCreationBoatRenderer(
  canvas: HTMLCanvasElement,
  button: HTMLElement,
  assets: { boatHull: string; boatWindow: string },
) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  const scene = new Scene();
  const model = createCanvasCreationBoatModel(assets);
  const toneGrade = createBoatToneGrade();
  const moonlight = createBoatMoonlight(model.userData.gunwaleOutline);
  const moonDirection = new Vector3();
  const moonModelDirection = new Vector3();
  const dayMaterialColors = new Map<MeshStandardMaterial, number>();
  const nightMaterialColors: Record<string, number> = {
    "Satin white hull": 0x55616d,
    "Soft white deck": 0x697681,
    // Night is still dark, but the shadow fill keeps the recesses in the
    // same cool blue-grey grade as the surrounding moonlit frame.
    "Recessed grey interior": 0x52616e,
    "Cockpit floor": 0x455460,
  };
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      if (material instanceof MeshStandardMaterial && !dayMaterialColors.has(material)) {
        dayMaterialColors.set(material, material.color.getHex());
        toneGrade.attach(material);
        if (object.name === "Rounded gunwale" || object.name === "Deck and two thwarts") moonlight.attach(material);
      }
    }
  });
  let materialsAreNight = false;
  const setBoatMaterialLight = (night: boolean) => {
    if (materialsAreNight === night) return;
    materialsAreNight = night;
    dayMaterialColors.forEach((dayColor, material) => {
      const nightColor = nightMaterialColors[material.name];
      material.color.setHex(night ? (nightColor ?? 0x4d5965) : dayColor);
    });
  };
  const camera = new OrthographicCamera(-2.325, 2.325, 2.325, -2.325, 0.1, 30);
  camera.position.set(0, 10, 2.6);
  camera.lookAt(0, 0, 0);
  const sky = new HemisphereLight(0xbacaff, 0x22242a, 0.15);
  const key = new DirectionalLight(0xe3ecff, 0.5);
  // A low-angle fill creates the narrow, cool moonlit edge on the hull and
  // cockpit rims without changing the cast-shadow direction or its opacity.
  const rim = new DirectionalLight(0xb8d3ff, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(256, 256);
  Object.assign(key.shadow.camera, { left: -2.4, right: 2.4, top: 2.4, bottom: -2.4, near: 0.1, far: 25 });
  key.shadow.normalBias = 0.012;
  key.shadow.bias = -0.0001;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.setClearColor(0, 0);
  scene.add(model, sky, key, rim);
  let heading = 0;
  let hasHeading = false;
  let rollAngle = 0;
  let rollVelocity = 0;
  let lost = false;
  let disposed = false;
  let lastRenderAt = -Infinity;
  let lastRenderSeconds: number | null = null;
  let size = 0;
  const onLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    delete button.dataset.boatRenderer;
  };
  const onRestored = () => { lost = false; lastRenderAt = -Infinity; };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  return {
    setHeading(value: number) {
      const delta = Math.atan2(
        Math.sin(value - heading),
        Math.cos(value - heading),
      );
      // Normal arcs remain quiet; a fast reversal adds lateral roll velocity.
      // The render loop then treats the hull like a damped spring, so it
      // crosses level a few times before settling instead of stopping at a
      // fixed tilted pose.
      if (hasHeading && Math.abs(delta) > 0.12) {
        rollVelocity = Math.max(-2.6, Math.min(2.6, rollVelocity + delta * 4.2));
      }
      heading = value;
      hasHeading = true;
    },
    render(frame: CanvasCreationBoatLightFrame) {
      if (disposed || lost || document.hidden) return;
      const now = performance.now();
      if (!frame.reducedMotion && now - lastRenderAt < 1000 / 30) return;
      lastRenderAt = now;
      const secondsDelta = lastRenderSeconds === null
        ? 1 / 60
        : Math.max(0, Math.min(0.1, frame.seconds - lastRenderSeconds));
      lastRenderSeconds = frame.seconds;
      // Keep the camera fixed in its original overhead position. Only a very
      // abrupt heading change can affect the hull's roll; edge position never
      // changes the boat's attitude.
      if (!frame.reducedMotion) {
        const springAcceleration = -rollAngle * 34 - rollVelocity * 5.8;
        rollVelocity += springAcceleration * secondsDelta;
        rollAngle += rollVelocity * secondsDelta;
        if (Math.abs(rollAngle) < 0.0005 && Math.abs(rollVelocity) < 0.0005) {
          rollAngle = 0;
          rollVelocity = 0;
        }
      } else {
        rollAngle = 0;
        rollVelocity = 0;
      }
      const nextSize = Math.max(1, Math.round(canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2)));
      if (nextSize !== size) { size = nextSize; renderer.setSize(size, size, false); }
      model.rotation.set(0, -heading - Math.PI / 2, 0);
      if (!frame.reducedMotion) {
        model.rotation.z = rollAngle + (frame.mooringRoll ?? 0);
      }
      setBoatMaterialLight(frame.night);
      toneGrade.setNight(frame.night);
      const angle = frame.angleDeg * Math.PI / 180;
      // CSS shadows extend (-sin(angle), cos(angle)); illumination comes from
      // the opposite side. Place the directional light using the same
      // elevation geometry: a horizontal plane receives a shadow of
      // length h * cot(theta), while the surface incidence is sin(theta).
      const horizontalDistance = 6;
      const elevation = Math.asin(Math.min(0.98, Math.max(0.12, frame.elevation)));
      key.position.set(
        Math.sin(angle) * horizontalDistance,
        Math.tan(elevation) * horizontalDistance,
        -Math.cos(angle) * horizontalDistance,
      );
      rim.position.set(
        Math.sin(angle) * horizontalDistance,
        horizontalDistance * 0.2,
        -Math.cos(angle) * horizontalDistance,
      );
      key.color.set(frame.night ? 0xd5e2ff : 0xfff8eb);
      sky.color.set(frame.night ? 0xbac8df : 0xf4f7ff);
      // This is the scene's color-grade / ambient fill. It lifts surfaces
      // hidden from the key light without flattening the directional shadow.
      sky.groundColor.set(frame.night ? 0x465663 : 0x7f898c);
      sky.intensity = frame.night ? 0.24 : 1.28;
      key.shadow.intensity = frame.night ? 0.46 : 0.58;
      const sourceIntensity = frame.night ? 1.05 : 2.6;
      key.intensity = sourceIntensity * Math.max(0.12, frame.lightIntensity) *
        frame.visibility;
      rim.color.set(frame.night ? 0xb8d3ff : 0xfff2d6);
      rim.intensity = (frame.night ? 0.42 : 0.06) *
        Math.max(0.12, frame.lightIntensity) * frame.visibility;
      renderer.toneMappingExposure = frame.night ? 0.78 : 0.95;
      camera.updateMatrixWorld();
      moonDirection.copy(key.position).transformDirection(camera.matrixWorldInverse);
      model.updateMatrixWorld();
      model.worldToLocal(moonModelDirection.copy(key.position)).normalize();
      moonlight.update(moonDirection, frame.night ? key.intensity : 0, moonModelDirection);
      renderer.render(scene, camera);
      button.dataset.boatRenderer = "webgl";
      canvas.dataset.meshes = String(model.children.length);
      canvas.dataset.triangles = String(renderer.info.render.triangles);
      canvas.dataset.light = frame.night ? "moon" : "sun";
      canvas.dataset.toneGrade = frame.night ? "dark-e" : "light-c";
      canvas.dataset.moonlight = frame.night ? "directional-champagne" : "off";
      canvas.dataset.illumination = key.intensity.toFixed(3);
      canvas.dataset.mooringRoll = String(frame.reducedMotion ? 0 : frame.mooringRoll ?? 0);
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      delete button.dataset.boatRenderer;
      disposeCanvasCreationBoatModel(model);
      key.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
