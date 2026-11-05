import type { App, Plugin } from "obsidian";
import { ObsidianDiscWaterField } from "./obsidian-disc-water-field";
import { normalizeCanvasWaterScale } from "./disc-water-settings";

/** Presentation only: native Canvas owns nodes, gestures, viewport and files. */
export class CanvasDiscWaterBackground {
  private surface: { root: HTMLElement; canvas: HTMLCanvasElement; field: ObsidianDiscWaterField } | null = null;
  private timer = 0;
  private destroyed = false;
  private scale = 1;

  constructor(private readonly app: App, private readonly enabled: () => boolean, private readonly getScale: () => number = () => normalizeCanvasWaterScale(undefined)) {}

  register(plugin: Plugin): void {
    plugin.registerEvent(this.app.workspace.on("layout-change", () => this.sync()));
    plugin.registerEvent(this.app.workspace.on("active-leaf-change", () => this.sync()));
    this.app.workspace.onLayoutReady(() => this.sync());
    // Covers Home overlays and window visibility without polling nodes or data.
    this.timer = window.setInterval(() => this.sync(), 500);
    plugin.register(() => this.destroy());
  }

  sync(): void {
    if (this.destroyed) return;
    if (!this.enabled()) { this.remove(); return; }
    const leaf = this.app.workspace.getMostRecentLeaf();
    const container = leaf?.view.containerEl;
    const root = leaf?.view.getViewType() === "canvas" ? container?.querySelector<HTMLElement>(".canvas-wrapper") : null;
    const visible = root?.isConnected && root.getClientRects().length && !root.ownerDocument.hidden &&
      !root.ownerDocument.querySelector(".whiteboat-canvas-entry:not(.is-settings-preview)");
    if (!this.enabled() || !root || !visible) { this.remove(); return; }
    if (this.surface?.root === root) {
      this.surface.field.setReducedMotion(root.win.matchMedia("(prefers-reduced-motion: reduce)").matches);
      const scale = normalizeCanvasWaterScale(this.getScale());
      if (scale !== this.scale) { this.scale = scale; this.surface.field.resize(); }
      return;
    }
    this.remove();
    const canvas = root.createEl("canvas", { cls: "whiteboat-canvas-entry__water-canvas whiteboat-disc-canvas-background" });
    canvas.setAttribute("aria-hidden", "true");
    root.prepend(canvas);
    root.classList.add("whiteboat-disc-water-host");
    try {
      this.scale = normalizeCanvasWaterScale(this.getScale());
      const field = new ObsidianDiscWaterField(canvas, {
        tokenRoot: root,
        reducedMotion: root.win.matchMedia("(prefers-reduced-motion: reduce)").matches,
        maxFps: 30, maxPixels: 2000000, maxDpr: 1,
        transparentBackground: true,
        getWaterScale: this.getScale,
      });
      this.surface = { root, canvas, field };
      field.start();
      canvas.dataset.waterTargetFps = "30";
    } catch {
      canvas.remove(); root.classList.remove("whiteboat-disc-water-host");
    }
  }

  private remove(): void {
    if (!this.surface) return;
    this.surface.field.destroy(); this.surface.canvas.remove();
    this.surface.root.classList.remove("whiteboat-disc-water-host");
    this.surface = null;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    window.clearInterval(this.timer); this.timer = 0;
    this.remove();
  }
}
