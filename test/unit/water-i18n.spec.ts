import { describe, it, expect, vi, afterEach } from "vitest";
vi.mock("obsidian", async original => ({ ...await original<Record<string, unknown>>(), getLanguage: vi.fn(() => "en"), PluginSettingTab: class {}, Setting: class {} }));
import { getLanguage, Plugin } from "obsidian";
import { normalizeWaterLanguage, resolveWaterLanguage, currentWaterLanguage, WATER_UI_TEXT } from "../../src/i18n";
import { CANVAS_CREATION_ENTRY_TEXT, canvasCreationEntryText } from "../../src/features/canvas-creation-entry-text";
import WhiteboatPlugin from "../../src/main";
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
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    vi.mocked(getLanguage).mockReturnValue(host);
    const plugin = new WhiteboatPlugin({ workspace: { onLayoutReady: () => {} } } as any, { name: "Whiteboat" } as any);
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
