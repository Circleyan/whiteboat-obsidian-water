import { describe, it, expect, vi, afterEach } from "vitest";
vi.mock("../../src/water-workbench", () => ({ mountWaterWorkbench: vi.fn(() => ({ refresh: vi.fn(), refreshText: vi.fn(), destroy: vi.fn() })) }));
vi.mock("obsidian", async original => ({ ...await original<Record<string, unknown>>(), getLanguage: vi.fn(() => "en"), PluginSettingTab: class {}, Setting: class {
  nameEl = { textContent: "" };
  settingEl = { closest: () => this.container.group ?? null, classList: { add() {} } };
  desc = "";
  heading = false;
  constructor(private container: any) { container.rows.push(this); }
  setName(value: string) { this.nameEl.textContent = value; return this; }
  setDesc(value: string) { this.desc = value; return this; }
  setHeading() { this.heading = true; return this; }
  addText(render: (control: any) => void) { render(this.control()); return this; }
  addToggle(render: (control: any) => void) { render(this.control()); return this; }
  addSlider(render: (control: any) => void) { render(this.control()); return this; }
  addDropdown(render: (control: any) => void) { render(this.control()); return this; }
  private control(): any {
    return { sliderEl: { addEventListener() {} }, selectEl: { options: [] }, setValue() { return this; }, addOptions() { return this; },
      onChange() { return this; }, setLimits() { return this; }, setInstant() { return this; }, setDynamicTooltip() { return this; } };
  }
} }));
import { getLanguage, Plugin, Setting } from "obsidian";
import { normalizeWaterLanguage, resolveWaterLanguage, currentWaterLanguage, WATER_UI_TEXT } from "../../src/i18n";
import { CANVAS_CREATION_ENTRY_TEXT, canvasCreationEntryText } from "../../src/features/canvas-creation-entry-text";
import WhiteboatPlugin, { WaterSettingTab } from "../../src/main";
import { createAndOpenCanvasFromEntry } from "../../src/features/canvas-creation-entry";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("Water interface languages", () => {
  it.each([ ["en", "en"], ["zh", "zh-CN"], ["zh_CN", "zh-CN"], ["zh-Hans", "zh-CN"], ["zh-TW", "zh-TW"], ["zh-HK", "zh-TW"], ["zh-Hant", "zh-TW"], ["fr", "en"], ["", "en"], ["unknown", "en"] ])("follows host %s as %s", (host, expected) => {
    expect(resolveWaterLanguage("auto", host)).toBe(expected);
  });
  it("defaults to auto, falls back to English, and honors manual overrides", () => {
    expect(normalizeWaterLanguage(undefined)).toBe("auto");
    expect(normalizeWaterLanguage("invalid")).toBe("auto");
    expect(resolveWaterLanguage("en", "zh")).toBe("en");
    expect(resolveWaterLanguage("zh-TW", "en")).toBe("zh-TW");
    vi.mocked(getLanguage).mockImplementationOnce(() => { throw new Error("unavailable"); });
    expect(currentWaterLanguage("auto")).toBe("en");
  });
  it("has complete catalogs with matching placeholders and English default copy", () => {
    for (const catalog of [WATER_UI_TEXT, CANVAS_CREATION_ENTRY_TEXT]) {
      for (const value of Object.values(catalog)) {
        expect(Object.keys(value).sort()).toEqual(["en", "zh-CN", "zh-TW"]);
        expect(value.en).not.toMatch(/[\u3400-\u9fff]/u);
        for (const language of ["zh-CN", "zh-TW"] as const) {
          expect(value[language].trim()).not.toBe("");
          expect(value[language].match(/\{\w+\}/g) ?? []).toEqual(value.en.match(/\{\w+\}/g) ?? []);
        }
      }
    }
    expect(canvasCreationEntryText("en")("created", { path: "中文.canvas" })).toBe("Created and opened Canvas: 中文.canvas");
  });
  it("persists manual language independently of other settings and rolls back failed saves", async () => {
    const plugin = new WhiteboatPlugin({} as any, { name: "Whiteboat" } as any);
    const data = { future: { keep: true }, canvas: { creation: { defaultFolder: "我的目录", futureWater: true } } };
    (plugin as any).savedData = data;
    vi.mocked(getLanguage).mockReturnValue("zh");
    expect(plugin.language).toBe("zh-CN");
    let saved: unknown;
    (plugin as any).saveData = vi.fn(async (value: unknown) => { saved = JSON.parse(JSON.stringify(value)); });
    const entry = { refreshText: vi.fn() };
    (plugin as any).entry = entry;
    await plugin.updateLanguage("zh-TW");
    expect(plugin.language).toBe("zh-TW");
    expect(entry.refreshText).toHaveBeenCalledOnce();
    expect((saved as any).canvas).toEqual(data.canvas);
    const restarted = new WhiteboatPlugin({} as any, {} as any);
    (restarted as any).savedData = saved;
    expect(restarted.languagePreference).toBe("zh-TW");
    expect(restarted.preferences.defaultFolder).toBe("我的目录");
    (plugin as any).saveData.mockRejectedValueOnce(new Error("disk full"));
    await plugin.updateLanguage("en");
    expect(plugin.languagePreference).toBe("zh-TW");
  });
  it.each(["en", "zh-CN", "zh-TW"] as const)("creates native Canvas in %s without translating user input", async language => {
    vi.stubGlobal("window", { crypto: globalThis.crypto });
    const files = new Map<string, string>();
    const openFile = vi.fn();
    const app = { vault: { createFolder: vi.fn(), getAbstractFileByPath: (path: string) => files.has(path), create: async (path: string, content: string) => { files.set(path, content); return { path }; } }, workspace: { getLeaf: () => ({ openFile }) } };
    const result = await createAndOpenCanvasFromEntry(app, "我的想法 🌊", { folder: "my folder", now: new Date(2026, 9, 14, 10, 0), text: canvasCreationEntryText(language) });
    expect(result.opened).toBe(true);
    expect(result.path).toContain("my folder/");
    expect(JSON.parse(files.get(result.path)!).nodes[0].text).toBe("我的想法 🌊");
    expect(openFile).toHaveBeenCalledOnce();
  });
  it.each([["en", "Canvases"], ["zh", "随手画布"], ["zh-TW", "隨手畫布"]])("follows %s for new installations and updates the default folder live", async (host, folder) => {
    vi.stubGlobal("window", { setTimeout, clearTimeout, setInterval: vi.fn(), clearInterval: vi.fn() });
    vi.mocked(getLanguage).mockReturnValue(host);
    const plugin = new WhiteboatPlugin({ workspace: { on: vi.fn(), onLayoutReady: () => {} } } as any, { name: "Whiteboat" } as any);
    (plugin as any).loadData = vi.fn(async () => null);
    (plugin as any).saveData = vi.fn(async () => {});
    (plugin as any).addCommand = vi.fn();
    (plugin as any).addRibbonIcon = vi.fn();
    (plugin as any).addSettingTab = vi.fn();
    await plugin.onload();
    expect(plugin.languagePreference).toBe("auto");
    expect(plugin.preferences.defaultFolder).toBe(folder);
    await plugin.updateLanguage("en");
    expect(plugin.preferences.defaultFolder).toBe("Canvases");
    await plugin.updateLanguage("zh-TW");
    expect(plugin.preferences.defaultFolder).toBe("隨手畫布");
  });
  it.each(["随手画布", "隨手畫布", "Canvases"])("recognizes the legacy %s default without changing saved paths", async folder => {
    const plugin = new WhiteboatPlugin({} as any, {} as any);
    const data = { waterLanguage: "en", canvas: { creation: { defaultFolder: folder, futureWater: true } } };
    (plugin as any).savedData = data;
    (plugin as any).saveData = vi.fn(async () => {});
    expect(plugin.preferences.defaultFolder).toBe("Canvases");
    expect(data.canvas.creation.defaultFolder).toBe(folder);
    await plugin.updateWaterPreferences({ soundEnabled: false });
    await plugin.updateLanguage("zh-CN");
    expect(plugin.preferences.defaultFolder).toBe("随手画布");
    expect((plugin as any).savedData.canvas.creation.futureWater).toBe(true);
    const restarted = new WhiteboatPlugin({} as any, {} as any);
    (restarted as any).savedData = JSON.parse(JSON.stringify((plugin as any).savedData));
    expect(restarted.preferences.defaultFolder).toBe("随手画布");
  });
  it("preserves explicitly chosen folders, including translated names, and clearing returns to automatic", async () => {
    const plugin = new WhiteboatPlugin({} as any, {} as any);
    (plugin as any).savedData = { waterLanguage: "en" };
    (plugin as any).saveData = vi.fn(async () => {});
    for (const folder of ["我的目录", "随手画布", "Canvases"]) {
      await plugin.updateWaterPreferences({ defaultFolder: folder });
      await plugin.updateLanguage("zh-TW");
      expect(plugin.preferences.defaultFolder).toBe(folder);
      await plugin.updateWaterPreferences({ boatFollowSpeed: 1.3 });
      await plugin.updateLanguage("en");
      expect(plugin.preferences.defaultFolder).toBe(folder);
    }
    await plugin.updateWaterPreferences({ defaultFolder: " " });
    expect(plugin.preferences.defaultFolder).toBe("Canvases");
    await plugin.updateLanguage("zh-TW");
    expect(plugin.preferences.defaultFolder).toBe("隨手畫布");
  });
  it("reports common failures in English", async () => {
    await expect(createAndOpenCanvasFromEntry({}, "", { text: canvasCreationEntryText("en") })).rejects.toThrow("The Obsidian vault cannot create files.");
  });
});


describe("Water settings groups", () => {
  function fixture(language: string) {
    const plugin = new WhiteboatPlugin({} as any, {} as any);
    (plugin as any).savedData = { waterLanguage: language, canvas: { creation: { canvasWaterEnabled: true, canvasWaterScale: 1.2, boatFollowSpeed: 1.3 } } };
    const tab = new WaterSettingTab(plugin);
    const container = { rows: [] as any[], empty() { this.rows = []; } };
    (tab as any).containerEl = container;
    return { plugin, tab, container };
  }
  it.each([["en", "Launchpad", "Canvas"], ["zh-CN", "启动台", "画布"], ["zh-TW", "啟動台", "畫布"]])("groups native settings in %s without changing preferences", (language, launchpad, canvas) => {
    const { plugin, tab } = fixture(language);
    const before = JSON.stringify(plugin.preferences);
    const entries = tab.getSettingDefinitions();
    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({ nameKey: "language" });
    expect(entries.slice(1).map(entry => "type" in entry && entry.heading)).toEqual([launchpad, canvas]);
    expect(entries.slice(1).map(entry => "type" in entry && entry.items.map(item => item.nameKey))).toEqual([
      ["folder", "sound", "speed", "light", "depth", "launchpadPreview"], ["canvasWater", "canvasWaterScale", "canvasPreview"],
    ]);
    expect(JSON.stringify(plugin.preferences)).toBe(before);
  });
  it("renders the same groups on older hosts and translates without replacing controls", () => {
    const { plugin, tab, container } = fixture("en");
    tab.display();
    const rows = [...container.rows];
    expect(rows.filter(row => row.heading).map(row => row.nameEl.textContent)).toEqual(["Launchpad", "Canvas"]);
    expect(rows.filter(row => !row.heading).map(row => row.nameEl.textContent)).toEqual(["Language", "New Canvas location", "Water sound", "Boat speed", "Light intensity", "Water depth", "Launchpad preview", "Water surface", "Water mark size", "Canvas preview"]);
    (plugin as any).savedData.waterLanguage = "zh-TW";
    tab.refreshText();
    expect(container.rows).toEqual(rows);
    expect(rows.filter(row => row.heading).map(row => row.nameEl.textContent)).toEqual(["啟動台", "畫布"]);
    expect(rows[1].nameEl.textContent).toBe("啟動台");
  });
  it("updates native host headings in place during a language change", () => {
    const { plugin, tab } = fixture("en");
    const entries = tab.getSettingDefinitions();
    const headings = entries.slice(1).map(entry => {
      if (!("type" in entry)) throw new Error("Expected group");
      const heading = { textContent: entry.heading };
      const container = { rows: [], group: { querySelector: (selector: string) => selector === ".setting-item-heading .setting-item-name" ? heading : null } };
      for (const item of entry.items) item.render(new Setting(container as any));
      return heading;
    });
    (plugin as any).savedData.waterLanguage = "zh-CN";
    tab.refreshText();
    expect(headings.map(heading => heading.textContent)).toEqual(["启动台", "画布"]);
  });
});
