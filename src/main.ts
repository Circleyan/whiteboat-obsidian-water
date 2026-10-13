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
function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export default class WhiteboatPlugin extends Plugin {
  private savedData: Record<string, unknown> = {};
  private entry: WhiteboatCanvasCreationEntryModal | null = null;
  private startupTimer: number | null = null;
  private unloading = false;

  async onload(): Promise<void> {
    const loaded: unknown = await this.loadData();
    this.savedData = asRecord(loaded);
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
    const saved = asRecord(asRecord(this.savedData.canvas).creation);
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
    const canvas = asRecord(this.savedData.canvas);
    this.savedData.canvas = { ...canvas, creation: { ...asRecord(canvas.creation), ...this.preferences, ...update } };
    await this.saveData(this.savedData);
  }

  openWater(): void {
    if (this.unloading || this.entry || document.querySelector(".whiteboat-canvas-entry:not(.is-settings-preview)")) return;
    const entry = new WhiteboatCanvasCreationEntryModal(this.app, {
      getDefaultFolder: () => this.preferences.defaultFolder,
      getDefaultTextNodeSize: () => normalizeTextNodeSize(asRecord(this.savedData.canvas).defaultTextNodeSize),
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

// Structurally matches 1.13's render definitions, using APIs supported since 1.8.10.
interface WaterSettingDefinition {
  name: string;
  desc: string;
  render: (setting: Setting) => void;
}

class WaterSettingTab extends PluginSettingTab {
  constructor(private readonly waterPlugin: WhiteboatPlugin) { super(waterPlugin.app, waterPlugin); }
  // Keep tooltip support for Obsidian 1.8.10–1.12; newer hosts show values inline.
  getSettingDefinitions(): WaterSettingDefinition[] {
    const prefs = this.waterPlugin.preferences;
    return [
      { name: "Canvas folder", desc: "New canvases are saved inside this vault folder.", render: setting => {
        setting.addText(text => text.setValue(prefs.defaultFolder).onChange(value => { void this.waterPlugin.updateWaterPreferences({ defaultFolder: value }); }));
      } },
      { name: "Water sound", desc: "Play the bundled water sound while the surface is open.", render: setting => {
        setting.addToggle(toggle => toggle.setValue(prefs.soundEnabled).onChange(value => this.waterPlugin.updateWaterPreferences({ soundEnabled: value })));
      } },
      { name: "Boat speed", desc: "How quickly the boat follows the pointer.", render: setting => {
        setting.addSlider(slider => slider.setLimits(0.5, 2, 0.1).setValue(prefs.boatFollowSpeed).setDynamicTooltip().onChange(value => { void this.waterPlugin.updateWaterPreferences({ boatFollowSpeed: value }); }));
      } },
      { name: "Light intensity", desc: "The strength of sunlight and moonlight.", render: setting => {
        setting.addSlider(slider => slider.setLimits(0.6, 1.6, 0.05).setValue(prefs.lightIntensity).setDynamicTooltip().onChange(value => { void this.waterPlugin.updateWaterPreferences({ lightIntensity: value }); }));
      } },
      { name: "Water depth", desc: "The depth of the projected shadows.", render: setting => {
        setting.addSlider(slider => slider.setLimits(0.6, 3, 0.1).setValue(prefs.waterDepth).setDynamicTooltip().onChange(value => { void this.waterPlugin.updateWaterPreferences({ waterDepth: value }); }));
      } },
    ];
  }

  // Obsidian <1.13 calls display(); newer hosts render the same definitions.
  display(): void {
    this.containerEl.empty();
    for (const item of this.getSettingDefinitions()) {
      const setting = new Setting(this.containerEl).setName(item.name);
      if (item.desc) setting.setDesc(item.desc);
      item.render(setting);
    }
  }
}
