import { Plugin, PluginSettingTab, Setting, Notice, normalizePath, setTooltip, type Command, type DropdownComponent, type TextComponent } from "obsidian";
import { WhiteboatCanvasCreationEntryModal } from "./features/canvas-creation-entry";
import { openCanvasCreationEntryInMainWindow } from "./features/canvas-creation-entry-window";
import { normalizeCanvasCreationBoatFollowSpeed } from "./features/canvas-creation-navigation";
import { normalizeCanvasCreationLightIntensity, normalizeCanvasCreationWaterDepth } from "./features/canvas-creation-light";
import { normalizeTextNodeSize } from "./features/canvas-geometry";

import { canvasCreationEntryText, currentWaterLanguage, normalizeWaterLanguage, waterUiText, type WaterLanguagePreference, type WaterUiTextKey } from "./i18n";

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
  private waterCommand: Command | null = null;
  private ribbon: HTMLElement | null = null;
  private settingsTab: WaterSettingTab | null = null;

  async onload(): Promise<void> {
    const loaded: unknown = await this.loadData();
    this.savedData = asRecord(loaded);
    this.waterCommand = this.addCommand({ id: "open-canvas-creation-entry", name: this.ui("open"), callback: () => this.openWater() });
    this.ribbon = this.addRibbonIcon("sailboat", this.ui("ribbon"), () => this.openWater());
    this.settingsTab = new WaterSettingTab(this);
    this.addSettingTab(this.settingsTab);
    this.app.workspace.onLayoutReady(() => {
      if (this.unloading) return;
      this.startupTimer = window.setTimeout(() => {
        this.startupTimer = null;
        if (!this.unloading) this.openWater();
      }, 180);
    });
  }

  get languagePreference(): WaterLanguagePreference { return normalizeWaterLanguage(this.savedData.waterLanguage); }
  get language() { return currentWaterLanguage(this.languagePreference); }
  ui(key: WaterUiTextKey): string { return waterUiText(this.language, key); }

  async updateLanguage(value: string): Promise<void> {
    const previous = this.savedData.waterLanguage;
    this.savedData.waterLanguage = normalizeWaterLanguage(value);
    this.refreshLanguage();
    try { await this.saveData(this.savedData); }
    catch {
      this.savedData.waterLanguage = previous;
      this.refreshLanguage();
      new Notice(this.ui("languageSaveFailed"));
    }
  }

  private refreshLanguage(): void {
    if (this.waterCommand) this.waterCommand.name = `${this.manifest.name}: ${this.ui("open")}`;
    if (this.ribbon) setTooltip(this.ribbon, this.ui("ribbon"), { placement: "right" });
    this.settingsTab?.refreshText();
    this.entry?.refreshText();
  }

  get preferences(): WaterPreferences {
    const saved = asRecord(asRecord(this.savedData.canvas).creation);
    const defaultFolder = typeof saved.defaultFolder === "string" ? normalizePath(saved.defaultFolder).replace(/^\/+|\/+$/g, "") : "";
    return {
      defaultFolder: this.usesAutomaticFolder ? canvasCreationEntryText(this.language)("defaultFolder") : defaultFolder,
      boatFollowSpeed: normalizeCanvasCreationBoatFollowSpeed(saved.boatFollowSpeed),
      lightIntensity: normalizeCanvasCreationLightIntensity(saved.lightIntensity),
      waterDepth: normalizeCanvasCreationWaterDepth(saved.waterDepth),
      soundEnabled: typeof saved.soundEnabled === "boolean" ? saved.soundEnabled : true,
    };
  }

  private get usesAutomaticFolder(): boolean {
    const saved = asRecord(asRecord(this.savedData.canvas).creation);
    const folder = typeof saved.defaultFolder === "string" ? normalizePath(saved.defaultFolder).replace(/^\/+|\/+$/g, "") : "";
    if (!folder || saved.defaultFolderMode === "auto") return true;
    if (saved.defaultFolderMode === "custom") return false;
    // Older builds saved the translated default without recording its origin.
    return (["en", "zh-CN", "zh-TW"] as const).some(language => canvasCreationEntryText(language)("defaultFolder") === folder);
  }

  async updateWaterPreferences(update: Partial<WaterPreferences>): Promise<void> {
    const canvas = asRecord(this.savedData.canvas);
    const automatic = update.defaultFolder === undefined ? this.usesAutomaticFolder : !update.defaultFolder.trim();
    this.savedData.canvas = { ...canvas, creation: { ...asRecord(canvas.creation), ...this.preferences, ...update, defaultFolderMode: automatic ? "auto" : "custom" } };
    await this.saveData(this.savedData);
  }

  openWater(): void {
    if (this.unloading || this.entry || document.querySelector(".whiteboat-canvas-entry:not(.is-settings-preview)")) return;
    const entry = new WhiteboatCanvasCreationEntryModal(this.app, {
      text: (key, params) => canvasCreationEntryText(this.language)(key, params),
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
  nameKey: WaterUiTextKey;
  descKey: WaterUiTextKey;
}

class WaterSettingTab extends PluginSettingTab {
  private rendered = new Map<WaterUiTextKey, { setting: Setting; descKey: WaterUiTextKey }>();
  private languageDropdown: DropdownComponent | null = null;
  private folderInput: TextComponent | null = null;

  refreshText(): void {
    for (const [key, { setting, descKey }] of this.rendered) {
      setting.setName(this.waterPlugin.ui(key)).setDesc(this.waterPlugin.ui(descKey));
    }
    const dropdown = this.languageDropdown;
    if (dropdown) {
      for (const option of Array.from(dropdown.selectEl.options)) {
        if (option.value === "auto") option.text = this.waterPlugin.ui("auto");
      }
      dropdown.setValue(this.waterPlugin.languagePreference);
    }
    this.folderInput?.setValue(this.waterPlugin.preferences.defaultFolder);
  }

  constructor(private readonly waterPlugin: WhiteboatPlugin) { super(waterPlugin.app, waterPlugin); }
  // Keep tooltip support for Obsidian 1.8.10–1.12; newer hosts show values inline.
  getSettingDefinitions(): WaterSettingDefinition[] {
    const prefs = this.waterPlugin.preferences;
    const definitions: WaterSettingDefinition[] = [
      { name: this.waterPlugin.ui("language"), desc: this.waterPlugin.ui("languageDesc"), nameKey: "language", descKey: "languageDesc", render: setting => {
        setting.addDropdown(dropdown => {
          this.languageDropdown = dropdown;
          dropdown.addOptions({ auto: this.waterPlugin.ui("auto"), en: "English", "zh-CN": "简体中文", "zh-TW": "繁體中文" }).setValue(this.waterPlugin.languagePreference).onChange(value => this.waterPlugin.updateLanguage(value));
        });
      } },
      { name: this.waterPlugin.ui("folder"), desc: this.waterPlugin.ui("folderDesc"), nameKey: "folder", descKey: "folderDesc", render: setting => {
        setting.addText(text => {
          this.folderInput = text;
          text.setValue(prefs.defaultFolder).onChange(value => { void this.waterPlugin.updateWaterPreferences({ defaultFolder: value }); });
        });
      } },
      { name: this.waterPlugin.ui("sound"), desc: this.waterPlugin.ui("soundDesc"), nameKey: "sound", descKey: "soundDesc", render: setting => {
        setting.addToggle(toggle => toggle.setValue(prefs.soundEnabled).onChange(value => this.waterPlugin.updateWaterPreferences({ soundEnabled: value })));
      } },
      { name: this.waterPlugin.ui("speed"), desc: this.waterPlugin.ui("speedDesc"), nameKey: "speed", descKey: "speedDesc", render: setting => {
        setting.addSlider(slider => slider.setLimits(0.5, 2, 0.1).setValue(prefs.boatFollowSpeed).setDynamicTooltip().onChange(value => { void this.waterPlugin.updateWaterPreferences({ boatFollowSpeed: value }); }));
      } },
      { name: this.waterPlugin.ui("light"), desc: this.waterPlugin.ui("lightDesc"), nameKey: "light", descKey: "lightDesc", render: setting => {
        setting.addSlider(slider => slider.setLimits(0.6, 1.6, 0.05).setValue(prefs.lightIntensity).setDynamicTooltip().onChange(value => { void this.waterPlugin.updateWaterPreferences({ lightIntensity: value }); }));
      } },
      { name: this.waterPlugin.ui("depth"), desc: this.waterPlugin.ui("depthDesc"), nameKey: "depth", descKey: "depthDesc", render: setting => {
        setting.addSlider(slider => slider.setLimits(0.6, 3, 0.1).setValue(prefs.waterDepth).setDynamicTooltip().onChange(value => { void this.waterPlugin.updateWaterPreferences({ waterDepth: value }); }));
      } },
    ];
    return definitions.map(item => ({ ...item, render: setting => {
      this.rendered.set(item.nameKey, { setting, descKey: item.descKey });
      item.render(setting);
    } }));
  }

  // Obsidian <1.13 calls display(); newer hosts render the same definitions.
  display(): void {
    this.containerEl.empty();
    this.rendered.clear();
    for (const item of this.getSettingDefinitions()) {
      const setting = new Setting(this.containerEl).setName(item.name);
      if (item.desc) setting.setDesc(item.desc);
      item.render(setting);
    }
  }
}
