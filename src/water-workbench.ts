import { mountCanvasCreationHomePreview } from "./features/canvas-creation-scene";
import { ObsidianDiscWaterField } from "./features/obsidian-disc-water-field";
import { WhiteboatHomeBoatSoundscape } from "./features/canvas-creation-home-audio";
import { WaterAdjustmentSession, waterAdjustmentAt, waterAdjustmentPosition, type WaterAdjustment } from "./water-adjustment";
import type { WaterUiTextKey } from "./i18n";

export interface WaterPreviewPreferences extends WaterAdjustment {
  boatFollowSpeed: number; soundEnabled: boolean; canvasWaterEnabled: boolean; canvasWaterScale: number;
}
export interface WaterWorkbench { refresh(): void; refreshText(): void; destroy(): void }
interface Options {
  preferences(): WaterPreviewPreferences;
  text(key: WaterUiTextKey): string;
  preview(value: Partial<WaterPreviewPreferences>): void;
  save(value: Partial<WaterPreviewPreferences>): Promise<void>;
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
  let pointerId: number | null = null;
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
    const controls = root.createDiv({ cls: "whiteboat-water-workbench__controls" });
    root.prepend(controls);
    const pad = controls.createDiv({ cls: "whiteboat-water-workbench__pad", attr: { tabindex: "0", role: "group" } });
    const lightAxis = pad.createDiv({ cls: "whiteboat-water-workbench__axis is-light" });
    const depthAxis = pad.createDiv({ cls: "whiteboat-water-workbench__axis is-depth" });
    const point = pad.createDiv({ cls: "whiteboat-water-workbench__point" });
    point.setAttribute("aria-hidden", "true");
    const readout = controls.createDiv({ cls: "whiteboat-water-workbench__readout", attr: { "aria-live": "polite" } });
    const precise = controls.createDiv({ cls: "whiteboat-water-workbench__precise" });
    const numberInputs = new Map<keyof WaterAdjustment, HTMLInputElement>();
    const labels = new Map<keyof WaterAdjustment, HTMLSpanElement>();
    const session = new WaterAdjustmentSession(initial, value => { options.preview(value); render(value); }, value => { void options.save(value); undo.disabled = !session.canUndo; });
    const actions = controls.createDiv({ cls: "whiteboat-water-workbench__actions" });
    const undo = actions.createEl("button");
    const reset = actions.createEl("button");
    undo.type = reset.type = "button";
    undo.addEventListener("click", () => session.undo(), { signal });
    reset.addEventListener("click", () => { session.move({ lightIntensity: 1, waterDepth: 1 }); session.commit(); }, { signal });
    function render(value: WaterAdjustment) {
      const position = waterAdjustmentPosition(value);
      point.style.left = `${position.x * 100}%`; point.style.top = `${position.y * 100}%`;
      pad.dataset.lightIntensity = String(value.lightIntensity); pad.dataset.waterDepth = String(value.waterDepth);
      scene.update({ ...options.preferences(), ...value });
      for (const [key, input] of numberInputs) if (input !== input.ownerDocument.activeElement) input.value = String(Math.round(value[key] * 100));
      readout.textContent = `${options.text("light")} ${Math.round(value.lightIntensity * 100)}% · ${options.text("depth")} ${Math.round(value.waterDepth * 100)}%`;
      pad.setAttribute("aria-label", `${options.text("lighting")} · ${readout.textContent}. ${options.text("padHelp")}`);
      undo.disabled = !session.canUndo;
    }
    for (const [key, min, max, step] of [["lightIntensity", 60, 160, 5], ["waterDepth", 60, 300, 10]] as const) {
      const label = precise.createEl("label");
      labels.set(key, label.createSpan());
      const input = label.createEl("input", { type: "number", attr: { min: String(min), max: String(max), step: String(step) } });
      numberInputs.set(key, input);
      label.createSpan({ text: "%" });
      input.addEventListener("input", () => { if (input.value !== "" && Number.isFinite(input.valueAsNumber)) session.move({ ...session.value, [key]: input.valueAsNumber / 100 }); }, { signal });
      input.addEventListener("change", () => { session.commit(); input.value = String(Math.round(session.value[key] * 100)); }, { signal });
      input.addEventListener("keydown", event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); session.cancel(); input.value = String(Math.round(session.value[key] * 100)); } }, { signal });
    }
    const move = (event: PointerEvent) => {
      const rect = pad.getBoundingClientRect();
      session.move(waterAdjustmentAt((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height));
    };
    pad.addEventListener("pointerdown", event => {
      if (pointerId !== null || event.button !== 0) return;
      event.preventDefault(); pad.focus(); pointerId = event.pointerId; move(event);
      // Obsidian settings can use a separate host document. Keep the gesture
      // on that document so dragging beyond the pad remains continuous.
    }, { signal });
    pad.ownerDocument.addEventListener("pointermove", event => { if (event.pointerId === pointerId) move(event); }, { signal });
    const finish = (event: PointerEvent, commit: boolean) => {
      if (event.pointerId !== pointerId) return;
      const id = pointerId; pointerId = null;
      if (commit) { move(event); session.commit(); } else session.cancel();
      if (pad.hasPointerCapture(id)) pad.releasePointerCapture(id);
    };
    pad.ownerDocument.addEventListener("pointerup", event => finish(event, true), { signal });
    pad.ownerDocument.addEventListener("pointercancel", event => finish(event, false), { signal });
    owner.addEventListener("blur", () => { if (pointerId !== null) { pointerId = null; session.cancel(); } }, { signal });
    pad.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation();
        const id = pointerId; pointerId = null;
        if (id !== null && pad.hasPointerCapture(id)) pad.releasePointerCapture(id);
        session.cancel(); return;
      }
      const value = session.value, multiplier = event.shiftKey ? 2 : 1;
      if (event.key === "ArrowRight") value.lightIntensity += .05 * multiplier;
      else if (event.key === "ArrowLeft") value.lightIntensity -= .05 * multiplier;
      else if (event.key === "ArrowUp") value.waterDepth += .1 * multiplier;
      else if (event.key === "ArrowDown") value.waterDepth -= .1 * multiplier;
      else return;
      event.preventDefault(); session.move(value); session.commit();
    }, { signal });
    refresh = () => {
      const prefs = options.preferences();
      session.sync(prefs);
      scene.update(prefs);
      if (sound) sound.setEnabled(prefs.soundEnabled);
      stage.dataset.soundEnabled = String(prefs.soundEnabled);
      render({ lightIntensity: prefs.lightIntensity, waterDepth: prefs.waterDepth });
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
      lightAxis.textContent = `${options.text("lightWeak")} → ${options.text("lightStrong")}`;
      depthAxis.textContent = `${options.text("depthDeep")} ↑`;
      for (const [key, label] of labels) label.textContent = options.text(key === "lightIntensity" ? "light" : "depth");
      undo.textContent = options.text("undo"); reset.textContent = options.text("reset");
      note.textContent = options.text("previewHelp"); stage.setAttribute("aria-label", options.text("launchpadPreview"));
      const sceneRoot = stage.querySelector(".whiteboat-canvas-entry");
      const title = sceneRoot?.querySelector(".whiteboat-canvas-entry__composer-title span");
      if (title) title.textContent = options.text("previewThought");
      const textarea = sceneRoot?.querySelector("textarea");
      if (textarea) textarea.placeholder = options.text("previewPlaceholder");
      const buttons = sceneRoot?.querySelectorAll("button");
      if (buttons?.length) buttons[buttons.length - 1].textContent = options.text("previewEnter");
      render(session.value);
    };
    destroyScene = () => { session.cancel(); scene.destroy(); sound?.destroy(); };
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
