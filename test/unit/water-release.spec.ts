import { describe, expect, it, vi, afterEach } from "vitest";
import { Plugin, Platform } from "obsidian";
vi.mock("obsidian", async (original) => {
 const real = await original<Record<string, unknown>>();
 return { ...real, PluginSettingTab: class { constructor(public app: unknown, public plugin: unknown) {} }, Setting: class {} };
});
import WhiteboatPlugin from "../../src/main";
import { startCanvasCreationScreenPointer } from "../../src/features/canvas-creation-screen-pointer";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("Water-only release lifecycle", () => {
 it("retains unrelated preferences and registers only the water command, with no startup after unload", async () => {
   vi.useFakeTimers();
   vi.stubGlobal("window", { setTimeout, clearTimeout });
   const methods: Record<string, unknown> = {};
   const commands: string[] = [];
   const data = { canvas: { creation: { defaultFolder: "my thoughts", soundEnabled: false, futureWater: { keep: true } }, defaultTextNodeSize: { width: 312, height: 88 } }, futureFeature: { keep: true } };
   let saved: unknown;
   const prototype = Plugin.prototype as any;
   const overrides = { loadData: async () => data, saveData: async (value: unknown) => { saved = value; }, addCommand: (command: any) => commands.push(command.id), addRibbonIcon: vi.fn(), addSettingTab: vi.fn() };
   for (const [key, value] of Object.entries(overrides)) { methods[key] = prototype[key]; prototype[key] = value; }
   try {
     const plugin = new WhiteboatPlugin({ workspace: { onLayoutReady: (fn: () => void) => fn() } } as any, {} as any);
     const open = vi.spyOn(plugin, "openWater").mockImplementation(() => {});
     await plugin.onload();
     expect(commands).toEqual(["open-canvas-creation-entry"]);
     expect(plugin.preferences.defaultFolder).toBe("my thoughts");
     expect(plugin.preferences.soundEnabled).toBe(false);
     await plugin.updateWaterPreferences({ soundEnabled: true });
     expect((saved as any).futureFeature).toEqual({ keep: true });
     expect((saved as any).canvas.creation.futureWater).toEqual({ keep: true });
     expect((saved as any).canvas.defaultTextNodeSize).toEqual({ width: 312, height: 88 });
     const closeImmediately = vi.fn();
     (plugin as any).entry = { closeEntryImmediately: closeImmediately };
     plugin.onunload();
     expect(closeImmediately).toHaveBeenCalledOnce();
     await vi.advanceTimersByTimeAsync(300);
     expect(open).not.toHaveBeenCalled();
   } finally { for (const [key, value] of Object.entries(methods)) prototype[key] = value; }
 });
 it("does not resolve Electron on a non-desktop host", () => {
   const old = Platform.isDesktopApp;
   Platform.isDesktopApp = false;
   try { expect(startCanvasCreationScreenPointer({ isActive: () => true, onMove: () => {} })).toBeNull(); }
   finally { Platform.isDesktopApp = old; }
 });
});
