import { readFileSync } from "node:fs";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  CANVAS_CREATION_AUDIO_NODE_SIZE,
  CANVAS_CREATION_BOAT_FOLLOW_SPEED_LIMITS,
  WhiteboatCanvasCreationEntryModal,
  appendCanvasCreationSpeechTranscript,
  advanceCanvasCreationBoatFollow,
  createAndOpenCanvasFromEntry,
  createCanvasCreationCandidatePath,
  createCanvasCreationContent,
  extractCanvasCreationSpeechTranscript,
  formatCanvasCreationAudioError,
  formatCanvasCreationRecordingDuration,
  formatCanvasCreationRecordingFilename,
  formatCanvasCreationSpeechError,
  getCanvasCreationSpeechRecognitionConstructor,
  normalizeCanvasCreationFolder,
  normalizeCanvasCreationBoatFollowSpeed,
  requestCanvasCreationMicrophonePermission,
  resolveCanvasCreationEntryDeviceMode,
  resolveCanvasCreationAudioExtension,
  resolveCanvasCreationAudioFormat,
  resolveUniqueCanvasCreationPath,
  sampleCanvasCreationCelestialProjection,
  sampleCanvasCreationPhoneRoamTarget,
  saveCanvasCreationAudioRecording,
  shouldCanvasCreationBoatFollowPointer,
  shouldCanvasCreationEntryCloseComposerFirst,
  shouldShowCanvasCreationSpeechInput,
  shouldSubmitCanvasCreationIdeaKey,
  shouldUseCanvasCreationSystemKeyboardSpeechInput,
  shouldUseCanvasCreationAudioRecording,
} from "../../src/features/canvas-creation-entry";
import {
  CANVAS_CREATION_STATIONARY_WAKE_RADIUS_SCALE,
  CANVAS_CREATION_WAKE_FADE_TIER_COUNT,
  resolveCanvasCreationWakeFadeTier,
  resolveCanvasCreationWaterQuality,
  sampleCanvasCreationBaseVector,
  sampleCanvasCreationBoatResponse,
  sampleCanvasCreationFieldVector,
  sampleCanvasCreationFlowPosition,
  sampleCanvasCreationWakeAccent,
  resolveCanvasCreationWaterTopInset,
} from "../../src/features/canvas-creation-water-field";

const css = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");
const entrySource = readFileSync(
  new URL("../../src/features/canvas-creation-entry.ts", import.meta.url),
  "utf8",
);
const ideaSpeechSource = readFileSync(
  new URL("../../vendor/whiteboat-core/src/features/idea-speech-input.ts", import.meta.url),
  "utf8",
);
const sceneSource = readFileSync(
  new URL("../../src/features/canvas-creation-scene.ts", import.meta.url),
  "utf8",
);
const projectionSource = readFileSync(
  new URL("../../vendor/whiteboat-core/src/features/canvas-creation-projection.ts", import.meta.url),
  "utf8",
);
const waterFieldSource = readFileSync(
  new URL("../../vendor/whiteboat-core/src/features/canvas-creation-water-field.ts", import.meta.url),
  "utf8",
);
const boatProjectionSvg = readFileSync(
  new URL("../../src/assets/canvas-entry-boat-shadow.svg", import.meta.url),
  "utf8",
);
const boatHullSvg = readFileSync(
  new URL("../../src/assets/canvas-entry-boat-hull.svg", import.meta.url),
  "utf8",
);

beforeEach(() => { vi.stubGlobal("window", { crypto: globalThis.crypto }); });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Whiteboat Canvas creation entry", () => {
  function fakeFocusVeil() {
    const properties = new Map<string, string>();
    const transitions: string[] = [];
    return {
      properties,
      transitions,
      offsetWidth: 0,
      style: {
        set transition(value: string) { transitions.push(value); },
        setProperty: (name: string, value: string) => properties.set(name, value),
      },
    };
  }

  function sailingModal() {
    const state = {
      boat: { x: 300, y: 300, heading: 0, speed: 1, visible: true },
      target: { x: 400, y: 250 } as { x: number; y: number } | null,
      targetKind: "pointer" as "pointer" | "coast" | "click" | "roam" | "recording" | null,
      composerOpen: false,
      submitting: false,
      lastFrameAt: 0,
      frameId: null,
    };
    return Object.assign(Object.create(WhiteboatCanvasCreationEntryModal.prototype), {
      state,
      deviceMode: "desktop",
      motionQuery: { matches: false },
      options: {},
      waterEl: { getBoundingClientRect: () => ({ width: 1024, height: 768 }) },
      boatEl: { offsetWidth: 108 },
      rootEl: { dataset: { waterFocus: "clear" } },
      focusVeilEl: fakeFocusVeil(),
      waterFocus: { anchor: null, active: false, amount: 0, from: 0, startedAt: 0, startDistance: 0 },
      placeBoat: vi.fn(),
      scheduleMovement: vi.fn(),
    }) as {
      state: typeof state;
      deviceMode: string;
      motionQuery: { matches: boolean };
      continueFollowingPointer(): void;
      stopFollowingPointer(): void;
      followPointer(point: { x: number; y: number }): void;
      updateMovement(timestamp: number): void;
    };
  }

  it("continues past the last pointer target on the same course and stops at the first edge", () => {
    const modal = sailingModal();
    const before = { ...modal.state.boat };
    modal.continueFollowingPointer();
    expect(modal.state.boat).toEqual(before);
    expect(modal.state.target).toEqual({ x: 792, y: 54 });
    expect(modal.state.targetKind).toBe("coast");
    modal.continueFollowingPointer();
    expect(modal.state.target).toEqual({ x: 792, y: 54 });

    modal.state.lastFrameAt = 0;
    for (let time = 50; time <= 10000 && modal.state.target; time += 50) {
      const previous = { ...modal.state.boat };
      modal.updateMovement(time);
      const boat = modal.state.boat;
      expect(Math.hypot(boat.x - previous.x, boat.y - previous.y)).toBeLessThanOrEqual(9.000001);
      expect(boat.y - 300).toBeCloseTo((boat.x - 300) * -0.5, 5);
      expect(boat.y).toBeGreaterThanOrEqual(54);
    }
    expect(modal.state.boat).toMatchObject({ x: 792, y: 54, speed: 0 });
    expect(modal.state.target).toBeNull();
  });

  it("sails to the laid-out composer's upper-left berth without moving on the click frame", () => {
    const modal = sailingModal() as ReturnType<typeof sailingModal> & {
      composerEl: { style: { left?: string; top?: string } };
      fitComposerToVisualViewport: () => void;
      getComposerPosition: () => { x: number; y: number };
      syncComposerPosition(): void;
    };
    modal.state.composerOpen = true;
    modal.composerEl = { style: {} };
    modal.fitComposerToVisualViewport = vi.fn();
    modal.getComposerPosition = () => ({ x: 780, y: 180 });
    const before = { ...modal.state.boat };
    modal.syncComposerPosition();
    expect(modal.state.boat).toEqual(before);
    expect(modal.state.target).toEqual({ x: 732.5, y: 213.2 });
    expect(modal.state.targetKind).toBe("click");

    // A second click uses the final card position, not a stale raw click point.
    modal.getComposerPosition = () => ({ x: 624, y: 420 });
    modal.syncComposerPosition();
    expect(modal.state.target).toEqual({ x: 576.5, y: 453.2 });
    for (let time = 50; time <= 10000 && modal.state.target; time += 50) {
      const previous = { ...modal.state.boat };
      modal.updateMovement(time);
      expect(Math.hypot(modal.state.boat.x - previous.x, modal.state.boat.y - previous.y))
        .toBeLessThanOrEqual(9.000001);
    }
    expect(modal.state.boat).toMatchObject({ x: 576.5, y: 453.2, speed: 0 });
    expect(modal.state.target).toBeNull();
    // Typing/reflow at the same berth must not restart movement and interrupt sway.
    modal.syncComposerPosition();
    expect(modal.state.target).toBeNull();
  });

  it("keeps the sailing boat clear and deepens the veil no faster than its voyage", () => {
    const modal = sailingModal() as ReturnType<typeof sailingModal> & {
      composerEl: { style: Record<string, string>; offsetWidth: number; offsetHeight: number };
      focusVeilEl: ReturnType<typeof fakeFocusVeil>;
      rootEl: { dataset: { waterFocus?: string } };
      fitComposerToVisualViewport: () => void;
      getComposerPosition: () => { x: number; y: number };
      syncComposerPosition(): void;
      setWaterFocus(focused: boolean): void;
      renderWaterFocus(now?: number): void;
    };
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    const amount = () => Number(modal.focusVeilEl.properties.get("--wb-entry-water-focus-amount"));
    modal.state.composerOpen = true;
    modal.composerEl = { style: {}, offsetWidth: 400, offsetHeight: 224 };
    modal.fitComposerToVisualViewport = vi.fn();
    modal.getComposerPosition = () => ({ x: 400, y: 200 });
    modal.syncComposerPosition();
    // Card 400..800 × 200..424, berth (352.5, 233.2), boat (300, 300) ± 54.
    expect(Object.fromEntries(modal.focusVeilEl.properties)).toEqual({
      "--wb-entry-water-focus-x": "523px",
      "--wb-entry-water-focus-y": "312px",
      "--wb-entry-water-focus-rx": "277px",
      "--wb-entry-water-focus-ry": "112px",
      "--wb-entry-water-focus-amount": "0.0000",
    });

    modal.setWaterFocus(true);
    expect(modal.rootEl.dataset.waterFocus).toBe("focused");
    // Time alone never outruns a boat that has not moved yet.
    modal.renderWaterFocus(3000);
    expect(amount()).toBe(0);
    // Halfway along the voyage the blur is no more than halfway in.
    modal.state.boat = { ...modal.state.boat, x: 326.25, y: 266.6 };
    modal.renderWaterFocus(3000);
    expect(amount()).toBeCloseTo(0.5, 2);
    // Arrival still waits for the settle duration from opening.
    modal.state.target = null;
    modal.state.boat = { ...modal.state.boat, x: 352.5, y: 233.2 };
    modal.renderWaterFocus(1360);
    expect(amount()).toBeCloseTo(0.875, 2);
    modal.renderWaterFocus(1720);
    expect(amount()).toBe(1);
    expect(modal.focusVeilEl.properties.get("--wb-entry-water-focus-x")).toBe("549.25px");

    // A boat near a corner of the union box grows the ellipse so it stays clear.
    modal.state.boat = { ...modal.state.boat, x: 200, y: 500 };
    modal.renderWaterFocus(1720);
    const read = (key: string) => Number.parseFloat(
      modal.focusVeilEl.properties.get(`--wb-entry-water-focus-${key}`) ?? "",
    );
    expect(((200 - read("x")) / read("rx")) ** 2 + ((500 - read("y")) / read("ry")) ** 2)
      .toBeLessThanOrEqual(1 + 1e-9);
    modal.state.boat = { ...modal.state.boat, x: 352.5, y: 233.2 };

    now.mockReturnValue(2000);
    modal.setWaterFocus(false);
    expect(modal.rootEl.dataset.waterFocus).toBe("clear");
    modal.renderWaterFocus(2160);
    expect(amount()).toBeCloseTo(0.5, 2);
    modal.renderWaterFocus(2320);
    expect(amount()).toBe(0);
    now.mockRestore();
  });

  it("starts local water coloring only at the berth and supplies the actual boat sway", () => {
    const modal = sailingModal() as ReturnType<typeof sailingModal> & {
      placeBoat(): void;
    };
    const setMooring = vi.fn();
    const setBoat = vi.fn();
    Reflect.deleteProperty(modal, "placeBoat");
    Object.assign(modal, {
      waterField: { setMooring, setBoat },
      mooringFrame: { offset: 2.6, heading: 0.045, roll: 0.1 },
      boatEl: {
        offsetWidth: 108,
        offsetHeight: 108,
        style: { setProperty: vi.fn() },
      },
      placeRecordingRipples: vi.fn(),
    });
    modal.state.composerOpen = true;
    modal.placeBoat();
    expect(setMooring).toHaveBeenLastCalledWith(null);
    for (let time = 50; time <= 10000 && modal.state.target; time += 50) {
      modal.updateMovement(time);
    }
    expect(modal.state.target).toBeNull();
    expect(setMooring).toHaveBeenLastCalledWith({ x: 400, y: 250 });
    const visibleBoat = setBoat.mock.lastCall?.[0];
    expect(Math.hypot(visibleBoat.x - 400, visibleBoat.y - 250)).toBeCloseTo(2.6);
    expect(visibleBoat.roll).toBe(0.1);
    expect(visibleBoat.heading).toBeCloseTo(modal.state.boat.heading + 0.045);

    modal.followPointer({ x: 700, y: 600 });
    expect(setMooring).toHaveBeenLastCalledWith(null);
    modal.state.target = null;
    modal.deviceMode = "phone";
    modal.placeBoat();
    expect(setMooring).toHaveBeenLastCalledWith(null);
    modal.deviceMode = "desktop";
    modal.state.composerOpen = false;
    modal.placeBoat();
    expect(setMooring).toHaveBeenLastCalledWith(null);
  });

  it.each([
    [{ x: 100, y: 300 }, { x: 54, y: 300 }],
    [{ x: 400, y: 300 }, { x: 970, y: 300 }],
    [{ x: 300, y: 100 }, { x: 300, y: 54 }],
    [{ x: 300, y: 400 }, { x: 300, y: 714 }],
  ])("continues an axis-aligned course to the visible edge", (target, edge) => {
    const modal = sailingModal();
    modal.state.target = target;
    modal.continueFollowingPointer();
    expect(modal.state.target).toEqual(edge);
  });

  it("resumes following on reentry and lets explicit boat activation stop coasting", () => {
    const modal = sailingModal();
    modal.continueFollowingPointer();
    modal.followPointer({ x: 700, y: 600 });
    expect(modal.state.target).toEqual({ x: 700, y: 600 });
    expect(modal.state.targetKind).toBe("pointer");
    modal.continueFollowingPointer();
    modal.stopFollowingPointer();
    expect(modal.state.target).toBeNull();
    expect(modal.state.boat.speed).toBe(0);
  });

  it.each(["click", "roam", "recording", null] as const)(
    "does not extend a %s destination when the pointer leaves", (kind) => {
      const modal = sailingModal();
      modal.state.targetKind = kind;
      modal.continueFollowingPointer();
      expect(modal.state.target).toEqual({ x: 400, y: 250 });
      expect(modal.state.targetKind).toBe(kind);
    },
  );

  it("keeps phone, writing, submitting and reduced-motion rules when the pointer leaves", () => {
    const variants = [
      (modal: ReturnType<typeof sailingModal>) => { modal.deviceMode = "phone"; },
      (modal: ReturnType<typeof sailingModal>) => { modal.state.composerOpen = true; },
      (modal: ReturnType<typeof sailingModal>) => { modal.state.submitting = true; },
      (modal: ReturnType<typeof sailingModal>) => { modal.motionQuery.matches = true; },
    ];
    for (const configure of variants) {
      const modal = sailingModal();
      configure(modal);
      modal.continueFollowingPointer();
      expect(modal.state.target).toEqual({ x: 400, y: 250 });
      expect(modal.state.boat).toMatchObject({ x: 300, y: 300 });
    }
    const stationary = sailingModal();
    stationary.state.target = { x: 300, y: 300 };
    stationary.continueFollowingPointer();
    expect(stationary.state.target).toEqual({ x: 300, y: 300 });
  });

  it("lets the boat reach water in the header band while keeping its hit area on screen", () => {
    const modal = Object.create(WhiteboatCanvasCreationEntryModal.prototype) as {
      waterEl: unknown;
      boatEl: unknown;
      rootEl: unknown;
      constrainBoat(point: { x: number; y: number }): { x: number; y: number };
    };
    modal.waterEl = { getBoundingClientRect: () => ({ width: 1024, height: 768 }) };
    modal.boatEl = { offsetWidth: 108 };
    modal.rootEl = {};
    vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "96px" }));

    expect(modal.constrainBoat({ x: 440, y: 70 })).toEqual({ x: 440, y: 70 });
    expect(modal.constrainBoat({ x: 440, y: 10 })).toEqual({ x: 440, y: 54 });
    expect(modal.constrainBoat({ x: -20, y: 900 })).toEqual({ x: 54, y: 714 });
    expect(modal.constrainBoat({ x: 1100, y: 400 })).toEqual({ x: 970, y: 400 });
  });

  it("keeps water suspended until a released permission request settles", async () => {
    let resolveStream!: (stream: MediaStream) => void;
    const streamPromise = new Promise<MediaStream>((resolve) => {
      resolveStream = resolve;
    });
    const stop = vi.fn();
    const gesture = {
      pointerId: 1,
      point: { x: 20, y: 40 },
      timer: 0,
      activated: true,
    };
    const modal = Object.create(
      WhiteboatCanvasCreationEntryModal.prototype,
    ) as WhiteboatCanvasCreationEntryModal & Record<string, unknown>;
    const internals = modal as unknown as {
      audioCapture: null;
      audioSavingPromise: null;
      audioStartPendingRequestId: number | null;
      audioStartRequestId: number;
      recordingGesture: typeof gesture | null;
      rootEl: {
        isConnected: boolean;
        removeClass: (...classes: string[]) => void;
      };
      usesAudioRecording: () => boolean;
      updateSpeechButton: () => void;
      announce: (message: string) => void;
      resumePhoneRoamingAfterRecording: () => void;
      startAudioRecording: (gesture: typeof gesture) => Promise<void>;
      finishAudioRecording: () => Promise<unknown>;
    };
    const resume = vi.fn();
    internals.audioCapture = null;
    internals.audioSavingPromise = null;
    internals.audioStartPendingRequestId = null;
    internals.audioStartRequestId = 0;
    internals.recordingGesture = gesture;
    internals.rootEl = {
      isConnected: true,
      removeClass: vi.fn(),
    };
    internals.usesAudioRecording = () => true;
    internals.updateSpeechButton = vi.fn();
    internals.announce = vi.fn();
    internals.resumePhoneRoamingAfterRecording = resume;

    vi.stubGlobal("MediaRecorder", {
      isTypeSupported: () => true,
    });
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(() => streamPromise),
      },
    });

    const starting = internals.startAudioRecording(gesture);
    await Promise.resolve();
    await internals.finishAudioRecording();
    internals.recordingGesture = null;

    expect(resume).not.toHaveBeenCalled();

    resolveStream({
      getTracks: () => [{ stop }],
    } as unknown as MediaStream);
    await starting;

    expect(stop).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("uses the opaque shared Figma boat hull in Whiteboat Home", () => {
    expect(boatHullSvg).toContain("<radialGradient");
    expect(boatHullSvg).not.toContain("fill-opacity");
  });

  it("uses a predictable configurable Vault folder and timestamp name", () => {
    expect(normalizeCanvasCreationFolder(" /白舟//新画布/ ")).toBe(
      "白舟/新画布",
    );
    expect(normalizeCanvasCreationFolder("")).toBe("随手画布");
    expect(
      createCanvasCreationCandidatePath(new Date(2026, 6, 29, 9, 7), {
        folder: "白舟/画布",
      }),
    ).toBe("白舟/画布/2026-07-29 0907 画布.canvas");
  });

  it("creates valid empty or reversibly seeded Canvas JSON", () => {
    expect(JSON.parse(createCanvasCreationContent("  "))).toEqual({
      nodes: [],
      edges: [],
    });
    expect(
      JSON.parse(
        createCanvasCreationContent("一个还没有成形的想法", {
          nodeId: "0123456789abcdef",
          nodeSize: { width: 360, height: 140 },
        }),
      ),
    ).toEqual({
      nodes: [
        {
          id: "0123456789abcdef",
          type: "text",
          text: "一个还没有成形的想法",
          x: -180,
          y: -70,
          width: 360,
          height: 140,
        },
      ],
      edges: [],
    });
  });

  it("keeps completed iPhone recordings as real Canvas file nodes", () => {
    const audioOnly = JSON.parse(
      createCanvasCreationContent("", {
        audioPaths: ["_附件/白舟录音 2026-08-23 224500.m4a"],
        audioNodeIds: ["audio-1"],
      }),
    );
    expect(audioOnly.nodes).toEqual([
      {
        id: "audio-1",
        type: "file",
        file: "_附件/白舟录音 2026-08-23 224500.m4a",
        x: CANVAS_CREATION_AUDIO_NODE_SIZE.width * -0.5,
        y: CANVAS_CREATION_AUDIO_NODE_SIZE.height * -0.5,
        width: CANVAS_CREATION_AUDIO_NODE_SIZE.width,
        height: CANVAS_CREATION_AUDIO_NODE_SIZE.height,
      },
    ]);

    const mixed = JSON.parse(
      createCanvasCreationContent("先保留这句话", {
        nodeId: "text-1",
        nodeSize: { width: 320, height: 96 },
        audioPaths: ["_附件/one.m4a", "_附件/two.webm"],
        audioNodeIds: ["audio-1", "audio-2"],
      }),
    );
    expect(mixed.nodes.map((node: { type: string }) => node.type)).toEqual([
      "text",
      "file",
      "file",
    ]);
    expect(mixed.nodes[1].y).toBeGreaterThan(
      mixed.nodes[0].y + mixed.nodes[0].height,
    );
    expect(mixed.nodes[2].y).toBeGreaterThan(mixed.nodes[1].y);
  });

  it("prefers iPhone m4a, falls back to webm, and saves through the Vault attachment path", async () => {
    expect(
      resolveCanvasCreationAudioFormat({
        isTypeSupported: (mimeType: string) => mimeType === "audio/mp4",
      }),
    ).toEqual({ mimeType: "audio/mp4", extension: "m4a" });
    expect(
      resolveCanvasCreationAudioFormat({
        isTypeSupported: (mimeType: string) => mimeType === "audio/webm",
      }),
    ).toEqual({ mimeType: "audio/webm", extension: "webm" });
    expect(resolveCanvasCreationAudioExtension("audio/mp4")).toBe("m4a");
    expect(resolveCanvasCreationAudioExtension("audio/webm;codecs=opus")).toBe(
      "webm",
    );
    expect(
      formatCanvasCreationRecordingFilename(
        new Date(2026, 7, 23, 22, 45, 9),
        "m4a",
      ),
    ).toBe("白舟录音 2026-08-23 224509.m4a");
    expect(formatCanvasCreationRecordingDuration(1_260)).toBe("1 秒");
    expect(formatCanvasCreationRecordingDuration(65_000)).toBe("1:05");

    const writes = new Map<string, ArrayBuffer>();
    const result = await saveCanvasCreationAudioRecording(
      {
        vault: {
          getAbstractFileByPath: (path: string) =>
            path === "_附件" ? { path } : null,
          createBinary: async (path: string, data: ArrayBuffer) => {
            writes.set(path, data);
            return { path };
          },
        },
        fileManager: {
          getAvailablePathForAttachment: async () =>
            "_附件/白舟录音 2026-08-23 224509.m4a",
        },
      },
      new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mp4" }),
      {
        folder: "随手画布",
        now: new Date(2026, 7, 23, 22, 45, 9),
        durationMs: 1_260,
      },
    );
    expect(result.path).toBe("_附件/白舟录音 2026-08-23 224509.m4a");
    expect(writes.get(result.path)?.byteLength).toBe(3);
  });

  it("uses the configured default text-node size as the seeded node birth size", () => {
    const document = JSON.parse(
      createCanvasCreationContent("今天小豹吕淮说我很准", {
        nodeId: "default-size-node",
        nodeSize: { width: 200, height: 40 },
      }),
    );

    expect(document.nodes[0]).toMatchObject({
      id: "default-size-node",
      x: -100,
      y: -20,
      width: 200,
      height: 40,
    });
  });

  it("suffixes collisions instead of overwriting an existing Canvas", async () => {
    const firstPath = "随手画布/2026-07-29 0907 画布.canvas";
    const app = {
      vault: {
        getAbstractFileByPath: (path: string) =>
          path === firstPath ? { path } : null,
      },
    };

    await expect(
      resolveUniqueCanvasCreationPath(app, new Date(2026, 6, 29, 9, 7)),
    ).resolves.toBe("随手画布/2026-07-29 0907 画布 2.canvas");
  });

  it("creates missing nested folders, writes once, and opens the real file", async () => {
    const folders = new Set<string>();
    const files = new Map<string, unknown>();
    const createFolder = vi.fn(async (path: string) => {
      folders.add(path);
    });
    const create = vi.fn(async (path: string, content: string) => {
      const file = { path, content };
      files.set(path, file);
      return file;
    });
    const openFile = vi.fn(async () => undefined);
    const app = {
      vault: {
        getAbstractFileByPath: (path: string) =>
          files.get(path) ?? (folders.has(path) ? { path } : null),
        createFolder,
        create,
      },
      workspace: {
        getLeaf: () => ({ openFile }),
      },
    };

    const result = await createAndOpenCanvasFromEntry(app, "先从这里开始", {
      folder: "白舟/新画布",
      now: new Date(2026, 6, 29, 9, 7),
      nodeSize: { width: 320, height: 160 },
    });

    expect(createFolder.mock.calls.map(([path]) => path)).toEqual([
      "白舟",
      "白舟/新画布",
    ]);
    expect(result.path).toBe("白舟/新画布/2026-07-29 0907 画布.canvas");
    expect(
      JSON.parse((files.get(result.path) as { content: string }).content),
    ).toMatchObject({
      nodes: [{ type: "text", text: "先从这里开始" }],
      edges: [],
    });
    expect(result.opened).toBe(true);
    expect(openFile).toHaveBeenCalledWith(result.file);
  });

  it("reports a created file separately when the workspace cannot open it", async () => {
    const create = vi.fn(async (path: string, content: string) => ({
      path,
      content,
    }));
    const app = {
      vault: {
        getAbstractFileByPath: () => null,
        createFolder: vi.fn(async () => undefined),
        create,
      },
      workspace: {
        getLeaf: () => ({
          openFile: vi.fn(async () => {
            throw new Error("没有可用叶片");
          }),
        }),
      },
    };

    const result = await createAndOpenCanvasFromEntry(app, "", {
      now: new Date(2026, 6, 29, 9, 7),
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      path: "随手画布/2026-07-29 0907 画布.canvas",
      opened: false,
      openError: "没有可用叶片",
    });
  });

  it("does not write after Home closes during folder/path preparation", async () => {
    const create=vi.fn();
    const app={vault:{getAbstractFileByPath:()=>null,createFolder:vi.fn(async()=>undefined),create}};
    await expect(createAndOpenCanvasFromEntry(app,"draft",{isActive:()=>false})).rejects.toThrow("创建入口已关闭");
    expect(create).not.toHaveBeenCalled();
  });

  it("keeps a completed write but does not open it after Home closes during I/O", async () => {
    let active=true;
    const create=vi.fn(async(path: string)=>{active=false;return {path};});
    const openFile=vi.fn();
    const app={vault:{getAbstractFileByPath:()=>null,createFolder:vi.fn(async()=>undefined),create},workspace:{getLeaf:()=>({openFile})}};
    const result=await createAndOpenCanvasFromEntry(app,"draft",{isActive:()=>active});
    expect(create).toHaveBeenCalledOnce();
    expect(openFile).not.toHaveBeenCalled();
    expect(result).toMatchObject({opened:false,seeded:true});
    expect(result.firstNodeId).toBeTruthy();
  });

  it("falls back to the same created path when a mobile leaf cannot open it", async () => {
    const create = vi.fn(async (path: string, content: string) => ({
      path,
      content,
    }));
    const openLinkText = vi.fn(async () => undefined);
    const app = {
      vault: {
        getAbstractFileByPath: () => null,
        createFolder: vi.fn(async () => undefined),
        create,
      },
      workspace: {
        getLeaf: () => ({
          openFile: vi.fn(async () => {
            throw new Error("mobile leaf unavailable");
          }),
        }),
        openLinkText,
      },
    };

    const result = await createAndOpenCanvasFromEntry(app, "", {
      now: new Date(2026, 7, 15, 21, 45),
    });

    expect(result.opened).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(openLinkText).toHaveBeenCalledWith(result.path, "", false);
  });

  it("maps mobile Enter to enter Canvas without breaking composition or Shift+Enter", () => {
    expect(
      shouldSubmitCanvasCreationIdeaKey(
        { key: "Enter", isComposing: false },
        true,
      ),
    ).toBe(true);
    expect(
      shouldSubmitCanvasCreationIdeaKey({ key: "Enter", shiftKey: true }, true),
    ).toBe(false);
    expect(
      shouldSubmitCanvasCreationIdeaKey(
        { key: "Enter", isComposing: true },
        true,
      ),
    ).toBe(false);
    expect(shouldSubmitCanvasCreationIdeaKey({ key: "Enter" }, false)).toBe(
      false,
    );
    expect(
      shouldSubmitCanvasCreationIdeaKey({ key: "Enter", metaKey: true }, false),
    ).toBe(true);
    expect(shouldSubmitCanvasCreationIdeaKey({ key: "Enter", metaKey: true, repeat: true }, false)).toBe(false);
  });

  it("uses local audio on iPhone while retaining the existing tablet and non-iOS speech adapters", () => {
    class NativeSpeechRecognition {
      lang = "";
      continuous = false;
      interimResults = true;
      maxAlternatives = 0;
      onresult = null;
      onerror = null;
      onend = null;
      start(): void {
        // Browser owned.
      }
      stop(): void {
        // Browser owned.
      }
      abort(): void {
        // Browser owned.
      }
    }

    expect(shouldShowCanvasCreationSpeechInput("desktop")).toBe(false);
    expect(shouldShowCanvasCreationSpeechInput("tablet")).toBe(true);
    expect(shouldShowCanvasCreationSpeechInput("phone")).toBe(true);
    expect(
      shouldUseCanvasCreationSystemKeyboardSpeechInput("phone", {
        isIosApp: true,
      }),
    ).toBe(false);
    expect(
      shouldUseCanvasCreationSystemKeyboardSpeechInput("tablet", {
        isIosApp: true,
      }),
    ).toBe(true);
    expect(
      shouldUseCanvasCreationSystemKeyboardSpeechInput("phone", {
        isIosApp: false,
      }),
    ).toBe(false);
    expect(
      shouldUseCanvasCreationSystemKeyboardSpeechInput("desktop", {
        isIosApp: true,
      }),
    ).toBe(false);
    expect(
      shouldUseCanvasCreationAudioRecording("phone", { isIosApp: true }),
    ).toBe(true);
    expect(
      shouldUseCanvasCreationAudioRecording("tablet", { isIosApp: true }),
    ).toBe(false);
    expect(
      shouldUseCanvasCreationAudioRecording("phone", { isIosApp: false }),
    ).toBe(false);
    expect(
      getCanvasCreationSpeechRecognitionConstructor({
        webkitSpeechRecognition: NativeSpeechRecognition,
      }),
    ).toBe(NativeSpeechRecognition);
    expect(getCanvasCreationSpeechRecognitionConstructor({})).toBeNull();
    expect(
      extractCanvasCreationSpeechTranscript({
        resultIndex: 1,
        results: [
          { isFinal: true, 0: { transcript: "旧片段" } },
          { isFinal: false, 0: { transcript: "临时片段" } },
          { isFinal: true, 0: { transcript: "  继续说  " } },
        ],
      }),
    ).toBe("继续说");
    expect(appendCanvasCreationSpeechTranscript("", " 今天先从水面开始 ")).toBe(
      "今天先从水面开始",
    );
    expect(appendCanvasCreationSpeechTranscript("今天", "继续")).toBe(
      "今天继续",
    );
    expect(appendCanvasCreationSpeechTranscript("First", "second")).toBe(
      "First second",
    );
    expect(formatCanvasCreationSpeechError("not-allowed")).toContain(
      "麦克风权限",
    );
    expect(
      formatCanvasCreationSpeechError("not-allowed", {
        microphoneGranted: true,
      }),
    ).not.toContain("没有麦克风权限");
    expect(
      formatCanvasCreationSpeechError("service-not-allowed", {
        microphoneGranted: true,
      }),
    ).toContain("系统键盘上的麦克风");
    expect(
      formatCanvasCreationSpeechError("NotAllowedError", {
        microphoneGranted: true,
      }),
    ).toContain("Obsidian 已有麦克风权限");
    expect(formatCanvasCreationSpeechError("unsupported")).toContain(
      "系统键盘上的麦克风",
    );
    expect(
      formatCanvasCreationAudioError(
        Object.assign(new Error("denied"), { name: "NotAllowedError" }),
      ),
    ).toContain("iOS 设置");
    expect(
      formatCanvasCreationAudioError(
        Object.assign(new Error("busy"), { name: "NotReadableError" }),
      ),
    ).toContain("占用");
  });

  it("preflights microphone permission before starting mobile speech input", async () => {
    const stoppedTracks: string[] = [];
    const getUserMedia = vi.fn(async (constraints: { audio: true }) => {
      expect(constraints).toEqual({ audio: true });
      return {
        getTracks: () => [
          { stop: () => stoppedTracks.push("first") },
          { stop: () => stoppedTracks.push("second") },
        ],
      };
    });

    await expect(
      requestCanvasCreationMicrophonePermission({
        mediaDevices: { getUserMedia },
      }),
    ).resolves.toBe("granted");
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(stoppedTracks).toEqual(["first", "second"]);

    await expect(
      requestCanvasCreationMicrophonePermission({
        mediaDevices: {
          getUserMedia: vi.fn(async () => {
            throw new DOMException("denied", "NotAllowedError");
          }),
        },
      }),
    ).resolves.toBe("not-allowed");
    await expect(requestCanvasCreationMicrophonePermission({})).resolves.toBe(
      "unsupported",
    );
  });

  it("separates phone roaming from tablet pointer input", () => {
    expect(resolveCanvasCreationEntryDeviceMode({})).toBe("desktop");
    expect(
      resolveCanvasCreationEntryDeviceMode({
        isMobileApp: true,
        isTablet: true,
      }),
    ).toBe("tablet");
    expect(
      resolveCanvasCreationEntryDeviceMode({
        isMobileApp: true,
        isPhone: true,
      }),
    ).toBe("phone");
    expect(
      resolveCanvasCreationEntryDeviceMode({
        bodyIsMobile: true,
        bodyIsTablet: true,
      }),
    ).toBe("tablet");
    expect(shouldCanvasCreationBoatFollowPointer("desktop", false, false)).toBe(
      true,
    );
    expect(shouldCanvasCreationBoatFollowPointer("tablet", false, false)).toBe(
      true,
    );
    expect(shouldCanvasCreationBoatFollowPointer("phone", false, false)).toBe(
      false,
    );
    expect(shouldCanvasCreationBoatFollowPointer("tablet", true, false)).toBe(
      false,
    );
    expect(shouldCanvasCreationEntryCloseComposerFirst("desktop", true)).toBe(
      true,
    );
    expect(shouldCanvasCreationEntryCloseComposerFirst("tablet", true)).toBe(
      true,
    );
    expect(shouldCanvasCreationEntryCloseComposerFirst("phone", true)).toBe(
      false,
    );

    const limits = {
      minimumX: -48,
      maximumX: 448,
      minimumY: 40,
      maximumY: 740,
      preferredMaximumY: 520,
    };
    const aboveComposerTarget = sampleCanvasCreationPhoneRoamTarget(limits, {
      random: vi
        .fn()
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(0.25)
        .mockReturnValueOnce(0.2)
        .mockReturnValueOnce(0.5),
    });
    const occasionalLowerTarget = sampleCanvasCreationPhoneRoamTarget(limits, {
      random: vi
        .fn()
        .mockReturnValueOnce(0.9)
        .mockReturnValueOnce(0.75)
        .mockReturnValueOnce(0.92)
        .mockReturnValueOnce(0.8),
    });
    const offscreenTarget = sampleCanvasCreationPhoneRoamTarget(limits, {
      random: vi
        .fn()
        .mockReturnValueOnce(0.1)
        .mockReturnValueOnce(0.7)
        .mockReturnValueOnce(0.1)
        .mockReturnValueOnce(0.4),
    });
    expect(aboveComposerTarget).toEqual({ x: 76, y: 280 });
    expect(aboveComposerTarget.y).toBeLessThanOrEqual(limits.preferredMaximumY);
    expect(occasionalLowerTarget).toEqual({ x: 324, y: 600 });
    expect(occasionalLowerTarget.y).toBeGreaterThan(limits.preferredMaximumY);
    expect(offscreenTarget.x).toBe(limits.minimumX);
    expect(
      advanceCanvasCreationBoatFollow({
        boat: { x: 40, y: 280, heading: 0, speed: 0, visible: true },
        target: aboveComposerTarget,
        deltaSeconds: 0.05,
        maximumSpeed: 42,
        slowingDistance: 56,
      }).boat.x,
    ).toBeLessThan(43);
  });

  it("uses an invisible sun/moon orbit to steer one layered projection system", () => {
    const sunStart = sampleCanvasCreationCelestialProjection({
      light: "sun",
      elapsedSeconds: 0,
    });
    const sunQuarterOrbit = sampleCanvasCreationCelestialProjection({
      light: "sun",
      elapsedSeconds: 21,
    });
    const moonStart = sampleCanvasCreationCelestialProjection({
      light: "moon",
      elapsedSeconds: 0,
    });
    const moonQuarterOrbit = sampleCanvasCreationCelestialProjection({
      light: "moon",
      elapsedSeconds: 28,
    });

    expect(sunStart).toMatchObject({
      light: "sun",
      angleDeg: 29,
      counterAngleDeg: -29,
    });
    expect(moonStart).toMatchObject({
      light: "moon",
      angleDeg: -27,
      counterAngleDeg: 27,
    });
    expect(sunQuarterOrbit.angleDeg).not.toBe(sunStart.angleDeg);
    expect(sunQuarterOrbit.elevation).not.toBe(sunStart.elevation);
    expect(sunQuarterOrbit.composer.distance).toBeGreaterThan(
      sunStart.composer.distance,
    );
    expect(sunQuarterOrbit.composer.blur).toBeGreaterThan(
      sunStart.composer.blur,
    );
    expect(moonQuarterOrbit.angleDeg).not.toBe(moonStart.angleDeg);
    expect(moonQuarterOrbit.elevation).not.toBe(moonStart.elevation);
    // The pinned host API exposes rendered tiers; the unused diagnostic fields
    // were retired by the 2026-09-24 boat-light decision.
    expect(sunStart.boat.distance).toBeGreaterThan(0);
    expect(moonStart.elevation).toBeGreaterThan(0);

    for (const projection of [
      sunStart,
      sunQuarterOrbit,
      moonStart,
      moonQuarterOrbit,
    ]) {
      expect(projection.composer.distance).toBeGreaterThan(
        projection.boat.distance,
      );
      expect(projection.boat.distance).toBeGreaterThan(
        projection.pointer.distance,
      );
      expect(projection.composer.blur).toBeGreaterThan(projection.boat.blur);
      expect(projection.boat.blur).toBeGreaterThan(projection.pointer.blur);
      expect(projection.boat.opacity).toBeGreaterThan(
        projection.composer.opacity,
      );
      expect(projection.composer.opacity).toBeGreaterThan(
        projection.pointer.opacity,
      );
    }

    const reducedMotionStart = sampleCanvasCreationCelestialProjection({
      light: "sun",
      elapsedSeconds: 0,
      reducedMotion: true,
    });
    expect(
      sampleCanvasCreationCelestialProjection({
        light: "sun",
        elapsedSeconds: 42,
        reducedMotion: true,
      }),
    ).toEqual(reducedMotionStart);
  });

  it("lets light strength increase projection contrast without changing celestial direction or height tiers", () => {
    const gentle = sampleCanvasCreationCelestialProjection({
      light: "sun",
      elapsedSeconds: 21,
      lightIntensity: 0.6,
    });
    const standard = sampleCanvasCreationCelestialProjection({
      light: "sun",
      elapsedSeconds: 21,
      lightIntensity: 1,
    });
    const strong = sampleCanvasCreationCelestialProjection({
      light: "sun",
      elapsedSeconds: 21,
      lightIntensity: 1.6,
    });

    expect(gentle.angleDeg).toBe(standard.angleDeg);
    expect(standard.angleDeg).toBe(strong.angleDeg);
    expect(gentle.elevation).toBe(standard.elevation);
    expect(standard.elevation).toBe(strong.elevation);
    expect(gentle.boat.distance).toBe(standard.boat.distance);
    expect(standard.boat.distance).toBe(strong.boat.distance);
    expect(strong.boat.opacity).toBeGreaterThan(standard.boat.opacity);
    expect(standard.boat.opacity).toBeGreaterThan(gentle.boat.opacity);
    expect(strong.boat.blur).toBeLessThan(standard.boat.blur);
    expect(standard.boat.blur).toBeLessThan(gentle.boat.blur);

    for (const projection of [gentle, standard, strong]) {
      expect(projection.composer.distance).toBeGreaterThan(
        projection.boat.distance,
      );
      expect(projection.boat.distance).toBeGreaterThan(
        projection.pointer.distance,
      );
      expect(projection.boat.opacity).toBeGreaterThan(
        projection.composer.opacity,
      );
      expect(projection.composer.opacity).toBeGreaterThan(
        projection.pointer.opacity,
      );
    }
  });

  it("lets water depth separate every projection from its caster without changing the light source", () => {
    const shallow = sampleCanvasCreationCelestialProjection({
      light: "sun",
      elapsedSeconds: 21,
      lightIntensity: 1,
      waterDepth: 0.6,
    });
    const standard = sampleCanvasCreationCelestialProjection({
      light: "sun",
      elapsedSeconds: 21,
      lightIntensity: 1,
      waterDepth: 1,
    });
    const deep = sampleCanvasCreationCelestialProjection({
      light: "sun",
      elapsedSeconds: 21,
      lightIntensity: 1,
      waterDepth: 3,
    });

    expect(shallow.angleDeg).toBe(standard.angleDeg);
    expect(standard.angleDeg).toBe(deep.angleDeg);
    expect(shallow.elevation).toBe(standard.elevation);
    expect(standard.elevation).toBe(deep.elevation);
    expect(shallow.waterDepth).toBe(0.6);
    expect(standard.waterDepth).toBe(1);
    expect(deep.waterDepth).toBe(3);

    for (const tier of ["pointer", "boat", "composer"] as const) {
      expect(shallow[tier].distance).toBeLessThan(standard[tier].distance);
      expect(standard[tier].distance).toBeLessThan(deep[tier].distance);
      expect(shallow[tier].blur).toBeLessThan(standard[tier].blur);
      expect(standard[tier].blur).toBeLessThan(deep[tier].blur);
      expect(shallow[tier].opacity).toBeGreaterThan(standard[tier].opacity);
      expect(standard[tier].opacity).toBeGreaterThan(deep[tier].opacity);
    }
    expect(
      sampleCanvasCreationCelestialProjection({
        light: "sun",
        elapsedSeconds: 21,
        waterDepth: 3.4,
      }).waterDepth,
    ).toBe(3);

    for (const projection of [shallow, standard, deep]) {
      expect(projection.composer.distance).toBeGreaterThan(
        projection.boat.distance,
      );
      expect(projection.boat.distance).toBeGreaterThan(
        projection.pointer.distance,
      );
    }
  });

  it("keeps the continuous field normalized and degrades on reduced motion", () => {
    const base = sampleCanvasCreationBaseVector(240, 180, 960, 640, 3.4);
    expect(Math.hypot(base.x, base.y)).toBeCloseTo(1, 5);
    const influenced = sampleCanvasCreationFieldVector({
      x: 480,
      y: 320,
      width: 960,
      height: 640,
      boat: {
        x: 480,
        y: 320,
        heading: Math.PI / 4,
        speed: 0.7,
        visible: true,
      },
    });
    expect(influenced.boatInfluence).toBeGreaterThan(0.3);
    expect(influenced.accent).toBeGreaterThan(0.15);
    expect(
      resolveCanvasCreationWaterQuality({
        width: 1200,
        reducedMotion: true,
      }),
    ).toMatchObject({ fps: 0 });
  });

  it("advects line centers gently while direction drifts through the field", () => {
    const positionStart = sampleCanvasCreationFlowPosition({
      baseX: 288,
      baseY: 216,
      column: 12,
      row: 9,
      width: 960,
      height: 640,
      topInset: 96,
      spacing: 24,
      time: 0,
    });
    const positionLater = sampleCanvasCreationFlowPosition({
      baseX: 288,
      baseY: 216,
      column: 12,
      row: 9,
      width: 960,
      height: 640,
      topInset: 96,
      spacing: 24,
      time: 1,
    });
    const positionChange = Math.hypot(
      positionLater.x - positionStart.x,
      positionLater.y - positionStart.y,
    );
    expect(positionChange).toBeGreaterThan(5);
    expect(positionChange).toBeLessThan(14);
    expect(
      sampleCanvasCreationFlowPosition({
        baseX: 288,
        baseY: 216,
        column: 12,
        row: 9,
        width: 960,
        height: 640,
        topInset: 96,
        spacing: 24,
        time: 4,
        reducedMotion: true,
      }),
    ).toEqual(positionStart);

    const directionStart = sampleCanvasCreationBaseVector(
      positionStart.x,
      positionStart.y,
      960,
      640,
      0,
    );
    const directionLater = sampleCanvasCreationBaseVector(
      positionLater.x,
      positionLater.y,
      960,
      640,
      1,
    );
    const directionChange = Math.hypot(
      directionLater.x - directionStart.x,
      directionLater.y - directionStart.y,
    );
    expect(directionChange).toBeGreaterThan(0.0001);
    expect(directionChange).toBeLessThan(0.1);
  });

  it.each([
    { name: "DSH", topInset: 0, time: 3 },
    { name: "Obsidian", topInset: 12, time: 8.7 },
  ])("keeps $name vertical flow rows evenly spaced across wrapping", ({
    topInset,
    time,
  }) => {
    const height = 437;
    const spacing = 24;
    const rowCount = Math.ceil((height - topInset) / spacing) + 1;
    const positions = Array.from({ length: rowCount }, (_, row) =>
      sampleCanvasCreationFlowPosition({
        baseX: 0,
        baseY: topInset + row * spacing,
        column: 0,
        row,
        width: 971,
        height,
        topInset,
        spacing,
        time,
      }).y,
    ).sort((first, second) => first - second);
    const minimumGap = Math.min(
      ...positions.slice(1).map((position, index) =>
        position - positions[index]
      ),
    );

    expect(minimumGap).toBeGreaterThan(spacing * 0.7);
  });

  it("lets the Home water flow continue through the header band", () => {
    expect(
      resolveCanvasCreationWaterTopInset({
        height: 1080,
        configuredInset: 12,
        topInsetRatio: 0,
      }),
    ).toBe(12);
    expect(
      resolveCanvasCreationWaterTopInset({
        height: 568,
        configuredInset: 12,
        topInsetRatio: 0.055,
      }),
    ).toBeCloseTo(31.24, 2);
    expect(css).toContain(
      "--wb-entry-header-padding-block-start: var(--wb-entry-space-06);",
    );
    expect(css).toContain(
      "--wb-entry-water-top-inset: var(--wb-entry-space-04);",
    );
    expect(css).toContain("--wb-entry-water-top-ratio: 0;");
    expect(waterFieldSource).toContain("resolveCanvasCreationWaterTopInset");
    expect(waterFieldSource).toContain(
      "configuredInset: resolveCanvasCreationCssPixels(",
    );
    expect(waterFieldSource).not.toContain("spacing * 1.45");
  });

  it("lets flowing water collide with a stopped boat and color existing samples", () => {
    const extendedStationaryEdge = sampleCanvasCreationBoatResponse(570, 320, {
      x: 480,
      y: 320,
      heading: 0,
      speed: 0,
      visible: true,
    });
    expect(CANVAS_CREATION_STATIONARY_WAKE_RADIUS_SCALE).toBe(1.3);
    expect(extendedStationaryEdge.influence).toBeGreaterThan(0);
    expect(extendedStationaryEdge.accent).toBeGreaterThan(0);

    const stationary = sampleCanvasCreationBoatResponse(470, 320, {
      x: 480,
      y: 320,
      heading: 0,
      speed: 0,
      visible: true,
    });
    expect(stationary.influence).toBeGreaterThan(0.4);
    expect(Math.hypot(stationary.offsetX, stationary.offsetY)).toBeGreaterThan(
      0.5,
    );
    expect(stationary.lengthScale).toBeGreaterThan(1.05);
    expect(stationary.accent).toBeGreaterThan(0.6);

    const base = sampleCanvasCreationFieldVector({
      x: 470,
      y: 320,
      width: 960,
      height: 640,
    });
    const colliding = sampleCanvasCreationFieldVector({
      x: 470,
      y: 320,
      width: 960,
      height: 640,
      boat: {
        x: 480,
        y: 320,
        heading: 0,
        speed: 0,
        visible: true,
      },
    });
    expect(
      Math.hypot(colliding.x - base.x, colliding.y - base.y),
    ).toBeGreaterThan(0.05);
    expect(colliding.accent).toBeGreaterThan(0.6);

    const downstream = sampleCanvasCreationBoatResponse(490, 320, {
      x: 480,
      y: 320,
      heading: 0,
      speed: 0,
      visible: true,
    });
    expect(downstream.accent).toBeLessThan(stationary.accent);

    const moving = sampleCanvasCreationBoatResponse(470, 320, {
      x: 480,
      y: 320,
      heading: 0,
      speed: 0.7,
      visible: true,
    });
    expect(moving.influence).toBeGreaterThan(0.3);
    expect(Math.hypot(moving.offsetX, moving.offsetY)).toBeGreaterThan(2);
    expect(moving.lengthScale).toBeGreaterThan(1.08);
    expect(moving.accent).toBeGreaterThan(0.7);

    const farAway = sampleCanvasCreationBoatResponse(120, 90, {
      x: 480,
      y: 320,
      heading: 0,
      speed: 0.7,
      visible: true,
    });
    expect(farAway).toMatchObject({
      offsetX: 0,
      offsetY: 0,
      lengthScale: 1,
      influence: 0,
      accent: 0,
    });
  });

  it("colors only existing samples in the recorded stern trail without adding geometry", () => {
    const freshWake = {
      x: 480,
      y: 320,
      heading: 0,
      createdAt: 0,
      life: 1,
    };
    const olderWake = { ...freshWake, life: 0.35 };

    expect(
      sampleCanvasCreationWakeAccent(460, 320, [freshWake]),
    ).toBeGreaterThan(0.8);
    expect(sampleCanvasCreationWakeAccent(520, 320, [freshWake])).toBe(0);
    expect(sampleCanvasCreationWakeAccent(452, 350, [freshWake])).toBe(0);
    expect(
      sampleCanvasCreationWakeAccent(452, 350, [olderWake]),
    ).toBeGreaterThan(0.1);
    expect(
      sampleCanvasCreationFieldVector({
        x: 460,
        y: 320,
        width: 960,
        height: 640,
        wakes: [freshWake],
      }).accent,
    ).toBeGreaterThan(0.8);
  });

  it("fades the original brand-color wake monotonically toward its tail", () => {
    const accents = [0.9, 0.72, 0.54, 0.36, 0.2];
    const tiers = accents.map(resolveCanvasCreationWakeFadeTier);

    expect(CANVAS_CREATION_WAKE_FADE_TIER_COUNT).toBe(5);
    expect(tiers[0]).toBe(0);
    expect(tiers.at(-1)).toBe(4);
    expect(tiers.every((tier) => tier !== null)).toBe(true);
    expect(
      tiers.every(
        (tier, index) => index === 0 || (tier ?? 0) >= (tiers[index - 1] ?? 0),
      ),
    ).toBe(true);
    expect(resolveCanvasCreationWakeFadeTier(0.16)).toBeNull();
    expect(resolveCanvasCreationWakeFadeTier(0)).toBeNull();
  });

  it("keeps one flowing dash layer instead of pointer, composer, or wake geometry", () => {
    expect(waterFieldSource).toContain("sampleCanvasCreationFlowPosition");
    expect(waterFieldSource).toContain("resolveCanvasCreationCssPixels");
    expect(waterFieldSource).toContain("getBoundingClientRect().width");
    expect(waterFieldSource).not.toContain("sampleCanvasCreationAmbientOffset");
    expect(waterFieldSource).not.toContain("setPointer(");
    expect(waterFieldSource).not.toContain("setComposer(");
    expect(waterFieldSource).toContain("wakeOpacities");
    expect(waterFieldSource).toContain("wakeToneColors");
    expect(css).toContain(
      "--wb-entry-wake-accent-01: var(--wb-entry-green-40)",
    );
    expect(css).toContain(
      "--wb-entry-wake-accent-04: var(--wb-entry-violet-30)",
    );
    expect(css).toContain("--wb-entry-wake-opacity-strong: 1");
    expect(css).toContain("--wb-entry-wake-opacity-tail: 0.18");
    expect(waterFieldSource.match(/\bpath\.moveTo\(/gu)).toHaveLength(
      1,
    );
    expect(waterFieldSource.match(/\bpath\.lineTo\(/gu)).toHaveLength(
      1,
    );
  });

  it("moves toward hover or click targets at a capped pace without reduced-motion jumps", () => {
    const boat = {
      x: 120,
      y: 180,
      heading: 0,
      speed: 0,
      visible: true,
    };
    const target = { x: 520, y: 380 };
    const moving = advanceCanvasCreationBoatFollow({
      boat,
      target,
      deltaSeconds: 1 / 60,
    });
    expect(moving.arrived).toBe(false);
    expect(moving.boat.x).toBeGreaterThan(boat.x);
    expect(moving.boat.y).toBeGreaterThan(boat.y);
    expect(
      Math.hypot(target.x - moving.boat.x, target.y - moving.boat.y),
    ).toBeLessThan(Math.hypot(target.x - boat.x, target.y - boat.y));
    expect(
      Math.hypot(moving.boat.x - boat.x, moving.boat.y - boat.y),
    ).toBeLessThanOrEqual(3.001);
    expect(moving.boat.speed).toBeGreaterThan(0);

    const reduced = advanceCanvasCreationBoatFollow({
      boat,
      target,
      deltaSeconds: 1 / 60,
      reducedMotion: true,
    });
    expect(reduced).toMatchObject({
      arrived: true,
      boat: { x: boat.x, y: boat.y, speed: 0 },
    });
  });

  it("normalizes the configurable boat follow-speed multiplier", () => {
    expect(CANVAS_CREATION_BOAT_FOLLOW_SPEED_LIMITS).toEqual({
      min: 0.5,
      max: 2,
      step: 0.05,
      defaultValue: 1,
    });
    expect(normalizeCanvasCreationBoatFollowSpeed(undefined)).toBe(1);
    expect(normalizeCanvasCreationBoatFollowSpeed(0.49)).toBe(0.5);
    expect(normalizeCanvasCreationBoatFollowSpeed(1.26)).toBe(1.25);
    expect(normalizeCanvasCreationBoatFollowSpeed(2.1)).toBe(2);
    expect(entrySource).toContain("this.options.getBoatFollowSpeed?.()");
    expect(entrySource).toMatch(/\? 42\s+: 180\) \*/u);
  });

  it("ships a full-stage, tokenized, responsive, reduced-motion surface", () => {
    expect(css).toMatch(
      /\.modal-container\.whiteboat-canvas-entry-modal-container \{[\s\S]*inset: 0 !important;[\s\S]*height: 100dvh !important;[\s\S]*padding: 0 !important;/u,
    );
    expect(css).not.toContain("body.whiteboat-canvas-entry-open .modal-container");
    expect(css).not.toContain(":has(");
    expect(css).toContain("body.whiteboat-canvas-entry-phone-open");
    expect(css).toContain("background: oklch(99.5% 0.003 240) !important");
    expect(css).toContain(".whiteboat-canvas-entry-modal.modal");
    expect(css).toMatch(
      /\.whiteboat-canvas-entry-modal\.modal \{[\s\S]*position: fixed !important;[\s\S]*inset: 0 !important;[\s\S]*width: 100vw !important;[\s\S]*height: 100vh !important;/u,
    );
    expect(css).toMatch(
      /\.whiteboat-canvas-entry-modal > \.modal-content \{[\s\S]*position: absolute;[\s\S]*inset: 0;[\s\S]*max-height: none;/u,
    );
    expect(css).toMatch(
      /\.whiteboat-canvas-entry-modal > \.modal-close-button,\s*\.whiteboat-canvas-entry-modal > \.modal-header-button \{\s*display: none;/u,
    );
    expect(css).toContain(
      "body.whiteboat-canvas-entry-open\n  .sidebar-toggle-button.mod-right",
    );
    expect(css).toContain("--wb-entry-water-line-quiet");
    expect(css).toContain("--wb-entry-composer-width: 400px");
    expect(css).toContain("--wb-entry-composer-height: 224px");
    expect(css).toContain("--wb-entry-phone-composer-min-height: 64px");
    expect(css).toContain("--wb-entry-phone-composer-max-height: 144px");
    expect(css).toContain("--wb-entry-phone-composer-inline-gap: 12px");
    expect(css).toContain(
      "--wb-entry-composer-outer-radius: var(--wb-entry-radius-large)",
    );
    expect(css).toMatch(
      /--wb-entry-composer-inner-radius: calc\(\s*var\(--wb-entry-composer-outer-radius\) - var\(--wb-entry-space-03\)\s*\)/u,
    );
    expect(css).toMatch(
      /\.whiteboat-canvas-entry__composer-surface \{[\s\S]*border-radius: var\(--wb-entry-composer-outer-radius\);/u,
    );
    expect(css).toMatch(
      /\.whiteboat-canvas-entry__composer-body \{[\s\S]*border-radius: var\(--wb-entry-composer-inner-radius\);/u,
    );
    expect(css).toMatch(
      /\.whiteboat-canvas-entry__idea \{[\s\S]*border-radius: inherit;/u,
    );
    expect(css).toMatch(
      /\.whiteboat-canvas-entry__shortcut \.whiteboat-canvas-entry__command-key,[\s\S]*border-radius: var\(--wb-entry-composer-inner-radius\);/u,
    );
    expect(css).toMatch(
      /\.whiteboat-canvas-entry__shortcut \{[\s\S]*--wb-entry-shortcut-control-height:[\s\S]*display: flex;/u,
    );
    expect(css).toMatch(
      /\.whiteboat-canvas-entry__shortcut \.whiteboat-canvas-entry__command-key \{[\s\S]*width: var\(--wb-entry-shortcut-control-height\) !important;[\s\S]*aspect-ratio: 1;/u,
    );
    expect(css).toMatch(
      /\.whiteboat-canvas-entry__shortcut \.whiteboat-canvas-entry__command-key,[\s\S]*height: var\(--wb-entry-shortcut-control-height\) !important;[\s\S]*max-height: var\(--wb-entry-shortcut-control-height\) !important;/u,
    );
    expect(css).toMatch(
      /\.whiteboat-canvas-entry__shortcut \.whiteboat-canvas-entry__command-key,[\s\S]*height: var\(--wb-entry-shortcut-control-height\) !important;[\s\S]*padding: 0 var\(--wb-entry-space-03\) !important;[\s\S]*line-height: 1 !important;/u,
    );
    expect(css).toMatch(
      /@media \(pointer: coarse\) \{[\s\S]*\.whiteboat-canvas-entry__shortcut \{[\s\S]*--wb-entry-shortcut-control-height: 2\.75rem;/u,
    );
    expect(css).toMatch(
      /\.whiteboat-canvas-entry__shortcut \.whiteboat-canvas-entry__command-key,[\s\S]*appearance: none;[\s\S]*border: var\(--wb-entry-border-width\) solid var\(--wb-entry-border-subtle\);[\s\S]*box-shadow: none;/u,
    );
    expect(css).toContain(
      ".whiteboat-canvas-entry__shortcut button:focus-visible",
    );
    expect(css).toContain("--wb-entry-rim-highlight");
    expect(css).toContain("--wb-entry-rim-highlight-soft");
    expect(css).toMatch(
      /\.theme-dark \.whiteboat-canvas-entry__composer-surface \{[\s\S]*border: 0 !important;[\s\S]*border-color: transparent;[\s\S]*box-shadow: none;/u,
    );
    expect(css).toMatch(
      /\.theme-dark \.whiteboat-canvas-entry__composer-surface::after \{[\s\S]*display: none;/u,
    );
    expect(css).toContain(
      ".theme-dark .whiteboat-canvas-entry__composer.is-error",
    );
    expect(css).toMatch(
      /\.theme-dark \.whiteboat-canvas-entry__boat-body \{[\s\S]*drop-shadow\([^\n]*var\(--wb-entry-rim-highlight\)\)[\s\S]*drop-shadow\([^\n]*var\(--wb-entry-rim-highlight-soft\)\);/u,
    );
    expect(css).toContain("--wb-entry-boat-body-height: 68.7696px");
    expect(css).toContain("--wb-entry-celestial-light: sun");
    expect(css).toContain("--wb-entry-celestial-light: moon");
    expect(css).toContain("--wb-entry-celestial-light-intensity: 1");
    expect(css).toContain("--wb-entry-celestial-projection-angle");
    expect(css).toMatch(
      /\.whiteboat-canvas-entry \{[\s\S]*cursor: var\(--wb-entry-anchor-cursor, crosshair\);/u,
    );
    expect(css).toContain("--wb-entry-celestial-projection-counter-angle");
    expect(css).toContain("--wb-entry-celestial-projection-color");
    expect(css).toContain(
      "--wb-entry-celestial-projection-color: rgba(2, 8, 16, 0.46)",
    );
    expect(css).toContain("--wb-entry-projection-color");
    expect(css).toContain("--wb-entry-projection-opacity");
    expect(css).toContain("--wb-entry-projection-blur");
    expect(css).toContain("--wb-entry-projection-filter");
    expect(css).toContain("--wb-entry-boat-heading");
    expect(css).toContain("--wb-entry-boat-projection-distance");
    expect(css).toContain("--wb-entry-composer-projection-distance");
    expect(css).toContain("--wb-entry-composer-projection-blur");
    expect(css).toContain(
      ".whiteboat-canvas-entry__boat-shadow,\n.whiteboat-canvas-entry__composer-shadow",
    );
    expect(css).toMatch(
      /\.whiteboat-canvas-entry__boat-shadow \{[\s\S]*rotate\(var\(--wb-entry-celestial-projection-angle\)\)[\s\S]*translateY\(var\(--wb-entry-boat-projection-distance\)\)[\s\S]*rotate\(var\(--wb-entry-celestial-projection-counter-angle\)\)[\s\S]*rotate\(var\(--wb-entry-boat-heading\)\);/u,
    );
    expect(css).toMatch(
      /\.whiteboat-canvas-entry__composer-shadow \{[\s\S]*rotate\(var\(--wb-entry-celestial-projection-angle\)\)[\s\S]*translateY\(var\(--wb-entry-composer-projection-distance\)\)[\s\S]*scale\(/u,
    );
    // The moon casts the composer onto dark water just as the sun does by day.
    expect(css).not.toMatch(
      /\.theme-dark \.whiteboat-canvas-entry__composer-shadow \{[^}]*display: none;/u,
    );
    // Its moonlit rim faces the source along the same moving angle and stays
    // an open arc rather than an outline.
    expect(css).toMatch(
      /\.theme-dark \.whiteboat-canvas-entry__composer-surface::before \{[^}]*conic-gradient\(\s*from calc\(var\(--wb-entry-celestial-projection-angle\) - 90deg\),\s*transparent 0deg,[^}]*transparent 180deg/u,
    );
    // The rim borrows the boat's cool hull edge (0xb8d3ff), not the champagne
    // colour of the moon glint itself, which reads too gold on the composer.
    expect(css).toMatch(
      /--wb-entry-composer-moon-rim: rgba\(184, 211, 255, [\d.]+\);/u,
    );
    expect(css).not.toMatch(/--wb-entry-composer-moon-rim(-soft)?: rgba\(255, 209, 130/u);
    expect(entrySource).toContain('shadow.style.setProperty("mask-image"');
    expect(entrySource).not.toContain("pointerShadowEl");
    expect(entrySource).toContain(
      'cls: "whiteboat-canvas-entry__accessibility-label"',
    );
    expect(entrySource).toContain(
      '"aria-labelledby": "whiteboat-canvas-entry-boat-label"',
    );
    expect(entrySource).not.toContain('"aria-label": "投入一个想法"');
    expect(entrySource).not.toContain("whiteboat-canvas-entry-note");
    expect(entrySource).not.toContain("空着也可以直接进入");
    expect(sceneSource).not.toContain("whiteboat-canvas-entry__composer-note");
    expect(sceneSource).not.toContain("空着也可以直接进入");
    expect(entrySource).not.toContain("showPointerProjection");
    expect(entrySource).not.toContain("hidePointerProjection");
    expect(entrySource).toContain("applyCanvasCreationCelestialProjection");
    expect(projectionSource).toContain(
      "sampleCanvasCreationCelestialProjection({",
    );
    expect(projectionSource).toContain("projectionScale?: number");
    expect(entrySource).toContain("this.scheduleCelestialMotion()");
    expect(entrySource).toContain("private scheduleCelestialMotion(): void");
    expect(entrySource).toContain("private celestialFrameId: number | null");
    expect(projectionSource).toContain("rootEl.dataset.celestialElevation");
    expect(projectionSource).toContain(
      "rootEl.dataset.celestialLightIntensity",
    );
    expect(entrySource).toContain("this.options.getLightIntensity?.()");
    expect(entrySource).not.toContain('cls: "whiteboat-canvas-entry__sun"');
    expect(entrySource).not.toContain('cls: "whiteboat-canvas-entry__moon"');
    expect(entrySource).toContain(
      'this.boatEl.style.setProperty(\n      "--wb-entry-boat-heading"',
    );
    expect(boatProjectionSvg).not.toContain("feGaussianBlur");
    expect(boatProjectionSvg).not.toContain("fill-opacity");
    expect(css).toContain("width: 156.95px");
    expect(css).toContain(
      ".theme-dark .whiteboat-canvas-entry__brand .is-dark",
    );
    expect(entrySource).toContain("logoWordmarkDark");
    expect(css).toContain(".theme-dark .whiteboat-canvas-entry");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".whiteboat-canvas-entry__composer.is-landed");
    expect(css).not.toContain(".whiteboat-canvas-entry__folder");
    expect(entrySource).not.toContain("whiteboat-canvas-entry__folder");
    expect(entrySource).toContain("if (this.state.composerOpen)");
    expect(entrySource).toContain("this.closeComposer({ returnFocus: true })");
    expect(entrySource).toContain("this.followPointer(point)");
    expect(entrySource).toContain("keepDestination: true");
    expect(entrySource).toContain(
      "this.state.composerAnchor ?? this.state.boat",
    );
    expect(entrySource).toContain("this.composerEl.inert = true");
    expect(entrySource).toContain(
      "shouldCanvasCreationEntryCloseComposerFirst(",
    );
    expect(entrySource).toContain("Platform.isMobileApp");
    expect(entrySource).toContain("Platform.isPhone");
    expect(entrySource).toContain("Platform.isTablet");
    expect(entrySource).toContain("shouldShowCanvasCreationSpeechInput");
    expect(entrySource).toContain(
      "shouldUseCanvasCreationSystemKeyboardSpeechInput",
    );
    expect(entrySource).toContain("shouldUseCanvasCreationAudioRecording");
    expect(entrySource).toContain("resolveCanvasCreationAudioFormat");
    expect(entrySource).toContain("saveCanvasCreationAudioRecording");
    expect(entrySource).toContain("new MediaRecorder");
    expect(entrySource).toContain("createBinary");
    expect(entrySource).toContain("WhiteboatHomeBoatSoundscape");
    expect(entrySource).toContain("this.soundscape.activate();");
    expect(entrySource).toContain("this.soundscape?.activate()");
    expect(entrySource).toContain(
      'this.soundscape?.setSuspended("recording", true)',
    );
    expect(entrySource).toContain(
      'this.soundscape?.setSuspended("recording", false)',
    );
    expect(entrySource).toContain(
      'this.soundscape?.prepareResumeFromGesture("recording")',
    );
    expect(entrySource.indexOf("capture.stream.getTracks().forEach")).toBeLessThan(
      entrySource.indexOf("await stopped"),
    );
    expect(entrySource).toContain(
      'this.soundscape?.setSuspended("document-hidden", document.hidden)',
    );
    expect(entrySource).toContain(
      "this.soundscape?.setBoatSpeed(this.state.boat.speed)",
    );
    expect(entrySource).toContain(
      'cls: "whiteboat-canvas-entry__sound-toggle"',
    );
    expect(entrySource).toContain('setIcon(\n      this.soundToggleEl,');
    expect(css).toContain(".whiteboat-canvas-entry__sound-toggle");
    expect(entrySource).toContain('this.sailBoatTo(\n          this.resolvePhoneRecordingBoatTarget');
    expect(entrySource).toContain('"recording"');
    expect(entrySource).toContain(
      'cls: "whiteboat-canvas-entry__recording-ripples"',
    );
    expect(entrySource).toContain("openSystemKeyboardSpeechInput");
    expect(entrySource).toContain("用系统键盘听写");
    expect(entrySource).toContain("请点系统键盘上的麦克风听写");
    expect(entrySource).toContain("isIosApp");
    expect(entrySource).toContain(
      "getCanvasCreationSpeechRecognitionConstructor",
    );
    expect(entrySource).toContain("webkitSpeechRecognition");
    expect(entrySource).toContain("requestCanvasCreationMicrophonePermission");
    expect(ideaSpeechSource).toContain("getUserMedia.call(mediaDevices");
    expect(ideaSpeechSource).toContain("{ audio: true }");
    expect(entrySource).toContain(
      'cls: "whiteboat-canvas-entry__speech-button"',
    );
    expect(entrySource).toContain('"说出想法"');
    expect(entrySource).toContain('"aria-pressed": "false"');
    expect(entrySource).toContain("formatCanvasCreationSpeechError");
    expect(entrySource).toContain("let reportedRecognitionFailure = false");
    expect(entrySource).toContain(
      "const reportRecognitionFailure = (reason?: string)",
    );
    expect(entrySource).toContain("recognition.onerror = null");
    expect(entrySource).toContain(
      "this.stopSpeechRecognition({ abort: true, announce: false })",
    );
    expect(entrySource).toContain("`is-${this.deviceMode}`");
    expect(entrySource).toContain("claimModalContainer()");
    expect(entrySource).toContain("whiteboat-canvas-entry-open");
    expect(entrySource).toContain("whiteboat-canvas-entry-phone-open");
    expect(entrySource).toContain("private syncStageViewportFrame(): void");
    expect(entrySource).toContain("private followVisualViewportAnimation");
    expect(entrySource).toContain("private getPhoneRoamLimits()");
    expect(entrySource).toContain("constrainPhoneRoamTarget(point)");
    expect(entrySource).toContain("sampleCanvasCreationPhoneRoamTarget");
    expect(entrySource).toContain("private dismissPhoneKeyboard(): void");
    expect(entrySource).toContain("this.ideaEl.blur()");
    expect(entrySource).toContain("this.followVisualViewportAnimation(720)");
    expect(entrySource).toContain("preferredMaximumY");
    expect(entrySource).toContain("minimumTravel");
    expect(entrySource).toContain("maximumSpeed:");
    expect(entrySource).toContain(
      "this.openComposer({ focus: true, keepDestination: true })",
    );
    expect(entrySource).toContain(
      "shouldCanvasCreationEntryCloseComposerFirst",
    );
    expect(entrySource).toContain('this.deviceMode !== "phone"');
    expect(entrySource).toContain("const leftGap = Math.max(12, safeLeft)");
    expect(entrySource).toContain(
      "const bottomGap = Math.max(12, safeBottom + 8)",
    );
    expect(entrySource).toContain("renderPhoneSubmitAnchorIcon");
    expect(entrySource).toContain(
      'cls: "whiteboat-canvas-entry__submit-anchor"',
    );
    expect(entrySource).not.toContain('setIcon(this.submitEl, "arrow-up")');
    expect(entrySource).toContain(
      'rows: this.deviceMode === "phone" ? "1" : "4"',
    );
    expect(entrySource).toContain("this.resizePhoneComposer()");
    expect(entrySource).toContain(
      'enterkeyhint: this.mobileInput ? "go" : "enter"',
    );
    expect(entrySource).toContain("window.visualViewport?.addEventListener");
    expect(entrySource).toContain("this.waterField?.resize()");
    expect(css).toContain(".whiteboat-canvas-entry.is-mobile");
    expect(css).toContain("--wb-entry-phone-visual-scale: 0.8");
    expect(css).toContain("--wb-entry-water-visual-scale");
    expect(css).toContain("--wb-entry-header-height: 0px");
    expect(css).toContain("--wb-entry-water-top-ratio: 0.055");
    expect(css).toContain(
      "--wb-entry-boat-hit-size: calc(108px * var(--wb-entry-phone-visual-scale))",
    );
    expect(css).toMatch(
      /\.whiteboat-canvas-entry\.is-phone \.whiteboat-canvas-entry__header \{[\s\S]*display: flex;[\s\S]*justify-content: flex-end;/u,
    );
    expect(css).toMatch(
      /\.whiteboat-canvas-entry\.is-phone \.whiteboat-canvas-entry__brand \{[\s\S]*display: none;/u,
    );
    expect(css).toMatch(
      /\.whiteboat-canvas-entry\.is-phone \.whiteboat-canvas-entry__close \{[\s\S]*width: 44px;[\s\S]*height: 44px;/u,
    );
    expect(css).toMatch(
      /\.whiteboat-canvas-entry\.is-phone \.whiteboat-canvas-entry__composer-header \{[\s\S]*display: flex;[\s\S]*justify-content: flex-end;/u,
    );
    expect(css).toMatch(
      /\.whiteboat-canvas-entry\.is-phone \.whiteboat-canvas-entry__composer \{[\s\S]*height: auto;[\s\S]*min-height: var\(--wb-entry-phone-composer-min-height\);[\s\S]*top var\(--wb-entry-duration-fast\) var\(--wb-entry-ease-out\),/u,
    );
    expect(css).toMatch(
      /\.whiteboat-canvas-entry\.is-phone[\s\S]*\.whiteboat-canvas-entry__composer-surface \{[\s\S]*flex-direction: row;[\s\S]*border-radius: calc\(var\(--wb-entry-phone-composer-min-height\) \/ 2\);/u,
    );
    expect(css).toMatch(
      /\.whiteboat-canvas-entry\.is-phone \.whiteboat-canvas-entry__shortcut button \{[\s\S]*width: 46px;[\s\S]*height: 46px(?: !important)?;[\s\S]*border-radius: 50%;/u,
    );
    expect(css).toContain(".whiteboat-canvas-entry__speech-button");
    expect(css).toContain(
      ".whiteboat-canvas-entry__speech-button.is-listening",
    );
    expect(css).toContain("@keyframes whiteboat-entry-recording-ripple");
    expect(css).toContain("--wb-entry-recording-ripple-duration");
    expect(css).toContain("--wb-entry-wake-accent-04");
    expect(css).toMatch(
      /\.whiteboat-canvas-entry\.is-recording[\s\S]*\.whiteboat-canvas-entry__recording-ripple \{[\s\S]*animation:/u,
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.whiteboat-canvas-entry\.is-recording[\s\S]*\.whiteboat-canvas-entry__recording-ripple \{[\s\S]*animation: none;/u,
    );
    expect(css).toMatch(
      /\.whiteboat-canvas-entry\.is-mobile[\s\S]*\.whiteboat-canvas-entry__speech-button \{[\s\S]*width: 46px;[\s\S]*min-width: 46px;[\s\S]*height: 46px !important;[\s\S]*min-height: 46px !important;/u,
    );
    expect(css).toContain(".whiteboat-canvas-entry__submit-anchor");
    expect(css).toContain("min-width: 5.75rem");
    expect(css).toContain("height: 46px !important");
    expect(entrySource).toContain("private closeEntry(): void");
    expect(entrySource).not.toContain("renderFooter");
    expect(entrySource).not.toContain("可交互的白舟水面");
    expect(entrySource).not.toContain("移动鼠标带白舟靠近");
    expect(entrySource).not.toContain("新的 Canvas 将创建到");
    expect(css).not.toContain(".whiteboat-canvas-entry__hint");
    expect(css).not.toContain(".whiteboat-canvas-entry__footer");
  });

  it("recedes the surrounding water into a progressive blur while the desktop composer is open", () => {
    expect(entrySource).toContain('cls: "whiteboat-canvas-entry__focus-veil"');
    expect(entrySource).toContain('"data-water-focus": "clear"');
    expect(entrySource).toMatch(
      /this\.syncComposerPosition\(\);\n\s*if \(this\.deviceMode !== "phone"\) this\.setWaterFocus\(true\);/u,
    );
    expect(entrySource).toMatch(
      /this\.rootEl\.dataset\.waterBackground = "flowing";\n\s*this\.setWaterFocus\(false\);/u,
    );
    expect(entrySource).toMatch(
      /this\.setWaterFocus\(false\);\n\s*await this\.composerMotion\?\.confirm/u,
    );
    expect(css).toContain("--wb-entry-z-water-focus: 2;");
    expect(css).toContain("@property --wb-entry-water-focus-x");
    // Opacity transitions suppress backdrop-filter in Chromium until they end,
    // so the veil ramps the blur amount instead of fading.
    expect(css).toContain("@property --wb-entry-water-focus-amount");
    expect(css).toMatch(
      /\[data-water-focus="focused"\] \.whiteboat-canvas-entry__focus-veil \{\s*visibility: visible;/u,
    );
    // The entry script drives the ramp from the boat voyage, not a CSS timer.
    expect(entrySource).toContain('"--wb-entry-water-focus-amount"');
    expect(css).not.toMatch(/__focus-veil \{[^}]*\bopacity\b/u);
    for (const layer of ["near", "mid", "far"]) {
      expect(css).toMatch(new RegExp(
        `__focus-layer\\.is-${layer} \\{[\\s\\S]*?backdrop-filter: blur\\(calc\\(var\\(--wb-entry-water-focus-blur-${layer}\\) \\* var\\(--wb-entry-water-focus-amount\\)\\)\\);`,
        "u",
      ));
    }
    // A colour wash layer bands into visible rings; blur alone recedes the water.
    expect(css).not.toMatch(/__focus-layer[^{]*\{[^}]*\bbackground\b/u);
    expect(entrySource).toContain('for (const layer of ["near", "mid", "far"])');
    // Recession fades the water dashes themselves, on the veil's clear area.
    expect(css).toMatch(/--wb-entry-water-focus-dash-floor:\s*0\.3;/u);
    expect(entrySource).toContain("this.waterField?.setFocus(focus.amount > 0");
    expect(css).toMatch(
      /\[data-reduced-motion="true"\] \.whiteboat-canvas-entry__focus-veil \{\s*transition: none;/u,
    );
  });
});
