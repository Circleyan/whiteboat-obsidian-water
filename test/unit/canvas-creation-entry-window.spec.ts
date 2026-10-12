import { describe, expect, it } from "vitest";
import { openCanvasCreationEntryInMainWindow } from "../../src/features/canvas-creation-entry-window";

describe("Home window ownership", () => {
  function windows() {
    const settings = { document: {} } as Window;
    const main = {
      document: {}, activeWindow: settings, activeDocument: settings.document,
    } as unknown as Window;
    return { main, settings };
  }

  it("opens in the main workspace while settings is focused, then restores host globals", () => {
    const { main, settings } = windows();
    let owner: Window | undefined;
    openCanvasCreationEntryInMainWindow({ open() {
      owner = main.activeWindow;
      expect(main.activeDocument).toBe(main.document);
    } }, main);
    expect(owner).toBe(main);
    expect(main.activeWindow).toBe(settings);
    expect(main.activeDocument).toBe(settings.document);
  });

  it("restores the active window and propagates an opening failure", () => {
    const { main, settings } = windows();
    expect(() => openCanvasCreationEntryInMainWindow({ open() {
      throw new Error("opening failed");
    } }, main)).toThrow("opening failed");
    expect(main.activeWindow).toBe(settings);
    expect(main.activeDocument).toBe(settings.document);
  });

  it("keeps normal main-window opening unchanged", () => {
    const { main } = windows();
    main.activeWindow = main;
    main.activeDocument = main.document;
    openCanvasCreationEntryInMainWindow({ open() {
      expect(main.activeWindow).toBe(main);
    } }, main);
    expect(main.activeWindow).toBe(main);
    expect(main.activeDocument).toBe(main.document);
  });
});
