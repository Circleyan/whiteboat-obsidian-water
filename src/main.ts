import { Plugin, PluginSettingTab, Setting, Notice, normalizePath, setTooltip, type Command, type DropdownComponent, type TextComponent } from "obsidian";
import { CanvasDiscWaterBackground } from "./features/canvas-disc-water-background";
import { WhiteboatCanvasCreationEntryModal } from "./features/canvas-creation-entry";
import { openCanvasCreationEntryInMainWindow } from "./features/canvas-creation-entry-window";
import { normalizeCanvasCreationBoatFollowSpeed } from "./features/canvas-creation-navigation";
import { normalizeCanvasCreationLightIntensity, normalizeCanvasCreationWaterDepth } from "./features/canvas-creation-light";
import { normalizeCanvasWaterScale, normalizeDiscWaterSettings } from "./features/disc-water-settings";
import { normalizeTextNodeSize } from "./features/canvas-geometry";

import { canvasCreationEntryText, currentWaterLanguage, normalizeWaterLanguage, waterUiText, type WaterLanguagePreference, type WaterUiTextKey } from "./i18n";
import { mountWaterWorkbench, type WaterWorkbench } from "./water-workbench";

// Retain the existing preference shape so a later full Whiteboat build can use it.
interface WaterPreferences {
  defaultFolder: string;
  boatFollowSpeed: number;
  lightIntensity: number;
  waterDepth: number;
  soundEnabled: boolean;
  canvasWaterEnabled: boolean;
  canvasWaterScale: number;
}
function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export default class WhiteboatPlugin extends Plugin {
  private canvasWater: CanvasDiscWaterBackground | null = null;
  private savedData: Record<string, unknown> = {};
  private entry: WhiteboatCanvasCreationEntryModal | null = null;
  private startupTimer: number | null = null;
  private unloading = false;
  private waterCommand: Command | null = null;
  private ribbon: HTMLElement | null = null;
  private settingsTab: WaterSettingTab | null = null;
  private previewPreferences: Partial<WaterPreferences> = {};
  private preferenceSave: Promise<void> = Promise.resolve();
  private preferenceRevision = 0;

  async onload(): Promise<void> {
    const loaded: unknown = await this.loadData();
    this.savedData = asRecord(loaded);
    this.canvasWater = new CanvasDiscWaterBackground(this.app, () => this.preferences.canvasWaterEnabled, () => this.preferences.canvasWaterScale);
    this.canvasWater.register(this);
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
    return this.readPreferences(this.previewPreferences);
  }
  private readPreferences(preview: Partial<WaterPreferences>): WaterPreferences {
    const saved = asRecord(asRecord(this.savedData.canvas).creation);
    const defaultFolder = typeof saved.defaultFolder === "string" ? normalizePath(saved.defaultFolder).replace(/^\/+|\/+$/g, "") : "";
    return {
      defaultFolder: this.usesAutomaticFolder ? canvasCreationEntryText(this.language)("defaultFolder") : defaultFolder,
      boatFollowSpeed: normalizeCanvasCreationBoatFollowSpeed(preview.boatFollowSpeed ?? saved.boatFollowSpeed),
      lightIntensity: normalizeCanvasCreationLightIntensity(preview.lightIntensity ?? saved.lightIntensity),
      waterDepth: normalizeCanvasCreationWaterDepth(preview.waterDepth ?? saved.waterDepth),
      canvasWaterEnabled: saved.canvasWaterEnabled === true,
      canvasWaterScale: normalizeCanvasWaterScale(preview.canvasWaterScale ?? saved.canvasWaterScale),
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
    const previous = this.savedData.canvas;
    const revision = ++this.preferenceRevision;
    const canvas = asRecord(this.savedData.canvas);
    const automatic = update.defaultFolder === undefined ? this.usesAutomaticFolder : !update.defaultFolder.trim();
    this.savedData.canvas = { ...canvas, creation: { ...asRecord(canvas.creation), ...this.readPreferences({}), ...update, defaultFolderMode: automatic ? "auto" : "custom" } };
    for (const key of Object.keys(update) as Array<keyof WaterPreferences>) delete this.previewPreferences[key];
    this.settingsTab?.refreshPreviews();
    this.entry?.refreshPreferences?.();
    this.canvasWater?.sync();
    const snapshot = { ...this.savedData };
    const save = this.preferenceSave.then(() => this.saveData(snapshot));
    this.preferenceSave = save.catch(() => {});
    try { await save; }
    catch {
      if (revision === this.preferenceRevision) {
        this.savedData.canvas = previous;
        this.clearWaterPreview();
      }
      new Notice(this.ui("settingsSaveFailed"));
    }
  }

  clearWaterPreview(): void {
    this.previewPreferences = {};
    this.settingsTab?.refreshPreviews();
    this.entry?.refreshPreferences();
    this.canvasWater?.sync();
  }

  previewWaterPreferences(update: Partial<WaterPreferences>): void {
    this.previewPreferences = { ...this.previewPreferences, ...update };
    this.settingsTab?.refreshPreviews();
    this.entry?.refreshPreferences?.();
    this.canvasWater?.sync();
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
      getDiscWaterSettings: () => normalizeDiscWaterSettings(undefined),
      getSoundEnabled: () => this.preferences.soundEnabled,
      onSoundEnabledChange: enabled => this.updateWaterPreferences({ soundEnabled: enabled }),
      onClose: () => { if (this.entry === entry) this.entry = null; },
    });
    this.entry = entry;
    openCanvasCreationEntryInMainWindow(entry);
  }

  onunload(): void {
    this.unloading = true;
    this.settingsTab?.destroyPreviews();
    this.canvasWater?.destroy();
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

interface WaterSettingGroupDefinition {
  type: "group";
  heading: string;
  items: WaterSettingDefinition[];
}
type WaterSettingEntry = WaterSettingDefinition | WaterSettingGroupDefinition;
type WaterGroupKey = "launchpadGroup" | "canvasGroup";

export class WaterSettingTab extends PluginSettingTab {
  private rendered = new Map<WaterUiTextKey, { setting: Setting; descKey: WaterUiTextKey }>();
  private groupHeadings = new Map<WaterGroupKey, HTMLElement>();
  private languageDropdown: DropdownComponent | null = null;
  private folderInput: TextComponent | null = null;
  private previews = new Map<string, WaterWorkbench>();
  refreshPreviews(): void { for (const preview of this.previews.values()) preview.refresh(); }
  destroyPreviews(): void { for (const preview of this.previews.values()) preview.destroy(); this.previews.clear(); }
  private renderPreview(setting: Setting, canvasOnly: boolean): void {
    const key = canvasOnly ? "canvas" : "launchpad";
    this.previews.get(key)?.destroy();
    setting.settingEl.classList.add("whiteboat-water-workbench-setting");
    this.previews.set(key, mountWaterWorkbench(setting.settingEl, {
      preferences: () => this.waterPlugin.preferences,
      text: key => this.waterPlugin.ui(key),
      preview: value => this.waterPlugin.previewWaterPreferences(value),
      save: value => this.waterPlugin.updateWaterPreferences(value),
      close: () => this.waterPlugin.clearWaterPreview(),
    }, canvasOnly));
  }

  refreshText(): void {
    for (const preview of this.previews.values()) preview.refreshText();
    for (const [key, heading] of this.groupHeadings) heading.textContent = this.waterPlugin.ui(key);
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
  getSettingDefinitions(): WaterSettingEntry[] {
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
      { name: this.waterPlugin.ui("canvasWater"), desc: this.waterPlugin.ui("canvasWaterDesc"), nameKey: "canvasWater", descKey: "canvasWaterDesc", render: setting => {
        setting.addToggle(toggle => toggle.setValue(this.waterPlugin.preferences.canvasWaterEnabled).onChange(value => this.waterPlugin.updateWaterPreferences({ canvasWaterEnabled: value })));
      } },
      { name: this.waterPlugin.ui("canvasWaterScale"), desc: this.waterPlugin.ui("canvasWaterScaleDesc"), nameKey: "canvasWaterScale", descKey: "canvasWaterScaleDesc", render: setting => {
        setting.addSlider(slider => {
          slider.setLimits(50, 200, 10).setValue(prefs.canvasWaterScale * 100).setDynamicTooltip();
          slider.sliderEl.addEventListener("input", () => this.waterPlugin.previewWaterPreferences({ canvasWaterScale: Number(slider.sliderEl.value) / 100 }));
          slider.sliderEl.addEventListener("change", () => { void this.waterPlugin.updateWaterPreferences({ canvasWaterScale: Number(slider.sliderEl.value) / 100 }); });
        });
      } },
      { name: this.waterPlugin.ui("sound"), desc: this.waterPlugin.ui("soundDesc"), nameKey: "sound", descKey: "soundDesc", render: setting => {
        setting.addToggle(toggle => toggle.setValue(prefs.soundEnabled).onChange(value => {
          const saved = this.waterPlugin.updateWaterPreferences({ soundEnabled: value });
          this.containerEl.querySelectorAll(".whiteboat-water-workbench").forEach(root => root.dispatchEvent(new Event("whiteboat-preview-sound")));
          return saved;
        }));
      } },
      { name: this.waterPlugin.ui("speed"), desc: this.waterPlugin.ui("speedDesc"), nameKey: "speed", descKey: "speedDesc", render: setting => {
        setting.addSlider(slider => {
          slider.setLimits(0.5, 2, 0.1).setValue(prefs.boatFollowSpeed).setDynamicTooltip();
          slider.sliderEl.addEventListener("input", () => this.waterPlugin.previewWaterPreferences({ boatFollowSpeed: Number(slider.sliderEl.value) }));
          slider.sliderEl.addEventListener("change", () => { void this.waterPlugin.updateWaterPreferences({ boatFollowSpeed: Number(slider.sliderEl.value) }); });
        });
      } },
      { name: this.waterPlugin.ui("lighting"), desc: this.waterPlugin.ui("lightingDesc"), nameKey: "lighting", descKey: "lightingDesc", render: setting => this.renderPreview(setting, false) },
      { name: this.waterPlugin.ui("canvasPreview"), desc: this.waterPlugin.ui("canvasPreviewDesc"), nameKey: "canvasPreview", descKey: "canvasPreviewDesc", render: setting => this.renderPreview(setting, true) },
    ];
    const items = definitions.map(item => ({ ...item, render: (setting: Setting) => {
      this.rendered.set(item.nameKey, { setting, descKey: item.descKey });
      item.render(setting);
    } }));
    const group = (key: WaterGroupKey, keys: WaterUiTextKey[]): WaterSettingGroupDefinition => ({
      type: "group", heading: this.waterPlugin.ui(key),
      items: keys.map(nameKey => {
        const item = items.find(item => item.nameKey === nameKey)!;
        return { ...item, render: setting => {
          // The host owns the card and its heading; retain the element for live translation.
          const heading = setting.settingEl.closest(".setting-group")?.querySelector<HTMLElement>(".setting-item-heading .setting-item-name");
          if (heading) this.groupHeadings.set(key, heading);
          item.render(setting);
        } };
      }),
    });
    return [items[0], group("launchpadGroup", ["folder", "sound", "speed", "lighting"]), group("canvasGroup", ["canvasWater", "canvasWaterScale", "canvasPreview"])];
  }

  // Obsidian <1.13 calls display(); newer hosts render the same definitions.
  display(): void {
    this.containerEl.empty();
    this.destroyPreviews();
    this.rendered.clear();
    this.groupHeadings.clear();
    for (const item of this.getSettingDefinitions()) {
      if ("type" in item) {
        const heading = new Setting(this.containerEl).setName(item.heading).setHeading();
        const key = item.items[0].nameKey === "folder" ? "launchpadGroup" : "canvasGroup";
        this.groupHeadings.set(key, heading.nameEl);
        for (const child of item.items) this.renderSetting(child);
      } else this.renderSetting(item);
    }
  }

  hide(): void { this.destroyPreviews(); this.waterPlugin.clearWaterPreview(); }

  private renderSetting(item: WaterSettingDefinition): void {
    const setting = new Setting(this.containerEl).setName(item.name).setDesc(item.desc);
    item.render(setting);
  }
}
