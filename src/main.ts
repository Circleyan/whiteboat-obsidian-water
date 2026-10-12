import { Plugin, PluginSettingTab, Setting, normalizePath } from "obsidian";
import { WhiteboatCanvasCreationEntryModal, DEFAULT_CANVAS_CREATION_FOLDER } from "./features/canvas-creation-entry";
import { openCanvasCreationEntryInMainWindow } from "./features/canvas-creation-entry-window";
import { normalizeCanvasCreationBoatFollowSpeed } from "./features/canvas-creation-navigation";
import { normalizeCanvasCreationLightIntensity, normalizeCanvasCreationWaterDepth } from "./features/canvas-creation-light";
import { normalizeTextNodeSize } from "./features/canvas-geometry";

// Retain the existing preference shape so a later full Whiteboat build can use it.
interface WaterPreferences {
  defaultFolder: string;
  boatFollowSpeed: number;
  lightIntensity: number;
  waterDepth: number;
  soundEnabled: boolean;
}
export default class WhiteboatPlugin extends Plugin {
  private savedData: Record<string, any> = {};
  private entry: WhiteboatCanvasCreationEntryModal | null = null;
  private startupTimer: number | null = null;
  private unloading = false;

  async onload(): Promise<void> {
    const loaded = await this.loadData();
    this.savedData = loaded && typeof loaded === "object" ? loaded : {};
    this.addCommand({ id: "open-canvas-creation-entry", name: "Open water surface", callback: () => this.openWater() });
    this.addRibbonIcon("sailboat", "Open Whiteboat water surface", () => this.openWater());
    this.addSettingTab(new WaterSettingTab(this));
    this.app.workspace.onLayoutReady(() => {
      if (this.unloading) return;
      this.startupTimer = window.setTimeout(() => {
        this.startupTimer = null;
        if (!this.unloading) this.openWater();
      }, 180);
    });
  }

  get preferences(): WaterPreferences {
    const saved = this.savedData.canvas?.creation ?? {};
    const defaultFolder = typeof saved.defaultFolder === "string" ? normalizePath(saved.defaultFolder).replace(/^\/+|\/+$/g, "") : "";
    return {
      defaultFolder: defaultFolder || DEFAULT_CANVAS_CREATION_FOLDER,
      boatFollowSpeed: normalizeCanvasCreationBoatFollowSpeed(saved.boatFollowSpeed),
      lightIntensity: normalizeCanvasCreationLightIntensity(saved.lightIntensity),
      waterDepth: normalizeCanvasCreationWaterDepth(saved.waterDepth),
      soundEnabled: typeof saved.soundEnabled === "boolean" ? saved.soundEnabled : true,
    };
  }

  async updateWaterPreferences(update: Partial<WaterPreferences>): Promise<void> {
    this.savedData.canvas = { ...this.savedData.canvas, creation: { ...this.savedData.canvas?.creation, ...this.preferences, ...update } };
    await this.saveData(this.savedData);
  }

  openWater(): void {
    if (this.unloading || this.entry || document.querySelector(".whiteboat-canvas-entry:not(.is-settings-preview)")) return;
    const entry = new WhiteboatCanvasCreationEntryModal(this.app, {
      getDefaultFolder: () => this.preferences.defaultFolder,
      getDefaultTextNodeSize: () => normalizeTextNodeSize(this.savedData.canvas?.defaultTextNodeSize),
      getBoatFollowSpeed: () => this.preferences.boatFollowSpeed,
      getLightIntensity: () => this.preferences.lightIntensity,
      getWaterDepth: () => this.preferences.waterDepth,
      getSoundEnabled: () => this.preferences.soundEnabled,
      onSoundEnabledChange: enabled => this.updateWaterPreferences({ soundEnabled: enabled }),
      onClose: () => { if (this.entry === entry) this.entry = null; },
    });
    this.entry = entry;
    openCanvasCreationEntryInMainWindow(entry);
  }

  onunload(): void {
    this.unloading = true;
    if (this.startupTimer !== null) window.clearTimeout(this.startupTimer);
    this.startupTimer = null;
    this.entry?.closeEntryImmediately();
    this.entry = null;
  }
}

class WaterSettingTab extends PluginSettingTab {
  constructor(private readonly waterPlugin: WhiteboatPlugin) { super(waterPlugin.app, waterPlugin); }
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const prefs = this.waterPlugin.preferences;
    new Setting(containerEl).setName("Canvas folder").setDesc("New canvases are saved inside this vault folder.")
      .addText(text => text.setValue(prefs.defaultFolder).onChange(value => { void this.waterPlugin.updateWaterPreferences({ defaultFolder: value }); }));
    new Setting(containerEl).setName("Water sound").setDesc("Play the bundled water sound while the surface is open.")
      .addToggle(toggle => toggle.setValue(prefs.soundEnabled).onChange(value => this.waterPlugin.updateWaterPreferences({ soundEnabled: value })));
    new Setting(containerEl).setName("Boat speed").setDesc("How quickly the boat follows the pointer.")
      .addSlider(slider => slider.setLimits(0.5, 2, 0.1).setValue(prefs.boatFollowSpeed).setDynamicTooltip().onChange(value => { void this.waterPlugin.updateWaterPreferences({ boatFollowSpeed: value }); }));
    new Setting(containerEl).setName("Light intensity").setDesc("The strength of sunlight and moonlight.")
      .addSlider(slider => slider.setLimits(0.6, 1.6, 0.05).setValue(prefs.lightIntensity).setDynamicTooltip().onChange(value => { void this.waterPlugin.updateWaterPreferences({ lightIntensity: value }); }));
    new Setting(containerEl).setName("Water depth").setDesc("The depth of the projected shadows.")
      .addSlider(slider => slider.setLimits(0.6, 3, 0.1).setValue(prefs.waterDepth).setDynamicTooltip().onChange(value => { void this.waterPlugin.updateWaterPreferences({ waterDepth: value }); }));
  }
}
