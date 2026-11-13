import { mountCanvasCreationHomePreview } from "./canvas-creation-scene";
import { ObsidianDiscWaterField } from "./obsidian-disc-water-field";
import { WhiteboatHomeBoatSoundscape } from "./canvas-creation-home-audio";
import type { WaterWorkbenchTextKey } from "./water-workbench-text";

export interface WaterPreviewPreferences {
  lightIntensity: number; waterDepth: number;
  boatFollowSpeed: number; soundEnabled: boolean; canvasWaterEnabled: boolean; canvasWaterScale: number;
}
export interface WaterWorkbench { refresh(): void; refreshText(): void; destroy(): void }
interface Options {
  preferences(): WaterPreviewPreferences;
  text(key: WaterWorkbenchTextKey): string;
  close(): void;
}
export function mountWaterWorkbench(parent: HTMLElement, options: Options, canvasOnly = false): WaterWorkbench {
  const root = parent.createDiv({ cls: "whiteboat-water-workbench" });
  const owner = parent.win;
  const controller = new AbortController();
  const signal = controller.signal;
  const stage = root.createDiv({ cls: "whiteboat-water-workbench__preview", attr: { role: "img" } });
  const note = root.createDiv({ cls: "whiteboat-water-workbench__note" });
  let destroyed = false;
  let sound: WhiteboatHomeBoatSoundscape | null = null;
  let refresh = () => {};
  let refreshText = () => {};
  let destroyScene: () => void;

  if (canvasOnly) {
    root.classList.add("is-canvas");
    const waterCanvas = stage.createEl("canvas", { cls: "whiteboat-canvas-entry__water-canvas" });
    waterCanvas.setAttribute("aria-hidden", "true");
    const node = stage.createDiv({ cls: "whiteboat-water-workbench__sample-node" });
    const field = new ObsidianDiscWaterField(waterCanvas, { tokenRoot: stage, maxFps: 30, maxPixels: 500000, maxDpr: 1, transparentBackground: true, reducedMotion: owner.matchMedia("(prefers-reduced-motion: reduce)").matches, getWaterScale: () => options.preferences().canvasWaterScale });
    field.start();
    refresh = () => {
      const prefs = options.preferences();
      waterCanvas.style.visibility = prefs.canvasWaterEnabled ? "visible" : "hidden";
      stage.dataset.waterEnabled = String(prefs.canvasWaterEnabled);
      stage.dataset.waterScale = String(prefs.canvasWaterScale);
      field.resize();
    };
    refreshText = () => { node.textContent = options.text("canvasPreviewNode"); note.textContent = options.text("canvasPreviewDesc"); stage.setAttribute("aria-label", options.text("canvasPreview")); };
    destroyScene = () => field.destroy();
  } else {
    const initial = options.preferences();
    const scene = mountCanvasCreationHomePreview(stage, initial);
    refresh = () => {
      const prefs = options.preferences();
      scene.update(prefs);
      if (sound) sound.setEnabled(prefs.soundEnabled);
      stage.dataset.soundEnabled = String(prefs.soundEnabled);
    };
    // Sound starts only after a gesture in the settings preview or sound toggle.
    const activateSound = () => {
      if (!options.preferences().soundEnabled) return;
      sound ??= new WhiteboatHomeBoatSoundscape({ enabled: true, ownerWindow: owner, onStateChange: state => { stage.dataset.soundState = state.state; } });
      sound.activate();
    };
    stage.addEventListener("pointerdown", activateSound, { signal });
    root.addEventListener("whiteboat-preview-sound", activateSound, { signal });
    refreshText = () => {
      note.textContent = options.text("previewHelp"); stage.setAttribute("aria-label", options.text("launchpadPreview"));
      const sceneRoot = stage.querySelector(".whiteboat-canvas-entry");
      const title = sceneRoot?.querySelector(".whiteboat-canvas-entry__composer-title span");
      if (title) title.textContent = options.text("previewThought");
      const textarea = sceneRoot?.querySelector("textarea");
      if (textarea) textarea.placeholder = options.text("previewPlaceholder");
      const buttons = sceneRoot?.querySelectorAll("button");
      if (buttons?.length) buttons[buttons.length - 1].textContent = options.text("previewEnter");
    };
    destroyScene = () => { scene.destroy(); sound?.destroy(); };
  }
  refresh(); refreshText();
  const observer = new MutationObserver(() => { if (!root.isConnected) api.destroy(); });
  observer.observe(parent.ownerDocument.body, { childList: true, subtree: true });
  const api: WaterWorkbench = {
    refresh: () => { if (!destroyed) refresh(); }, refreshText: () => { if (!destroyed) refreshText(); },
    destroy: () => { if (destroyed) return; destroyed = true; controller.abort(); observer.disconnect(); destroyScene(); root.remove(); options.close(); },
  };
  return api;
}
