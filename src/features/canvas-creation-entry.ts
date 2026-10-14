import {
  Modal,
  Notice,
  Platform,
  normalizePath,
  setIcon,
  type App,
} from "obsidian";
import {
  normalizeTextNodeSize,
  type CanvasTextNodeSize,
} from "./canvas-geometry";
import {
  applyCanvasCreationCelestialProjection,
  CANVAS_CREATION_ENTRY_ASSETS,
} from "./canvas-creation-scene";
import { sampleCanvasCreationCelestialProjection } from "./canvas-creation-light";
import { CANVAS_CREATION_ANCHOR_CURSOR } from "./canvas-creation-anchor-asset";
import { mountCanvasCreationBoatRenderer } from "./canvas-creation-boat-renderer";
import { startCanvasCreationScreenPointer } from "./canvas-creation-screen-pointer";
import { CanvasCreationComposerMotion } from "./canvas-creation-composer-motion";
import { CanvasCreationMooringMotion } from "./canvas-creation-mooring";
import {
  advanceCanvasCreationBoatFollow,
  normalizeCanvasCreationBoatFollowSpeed,
  resolveCanvasCreationEntryDeviceMode,
  sampleCanvasCreationPhoneRoamTarget,
  shouldCanvasCreationBoatFollowPointer,
  shouldCanvasCreationEntryCloseComposerFirst,
  type CanvasCreationEntryDeviceMode,
} from "./canvas-creation-navigation";
import {
  CanvasCreationWaterField,
  clampWaterValue,
  resolveCanvasCreationCssPixels,
  type CanvasCreationWaterBoat,
} from "./canvas-creation-water-field";
import {
  WHITEBOAT_HOME_SOUND_DUCK_MS,
  WhiteboatHomeBoatSoundscape,
  type WhiteboatHomeSoundSnapshot,
} from "./canvas-creation-home-audio";
import {
  appendIdeaSpeechTranscript,
  extractFinalIdeaSpeechTranscript,
  formatIdeaSpeechError,
  getIdeaSpeechRecognitionConstructor,
  requestIdeaMicrophonePermission,
  type IdeaMicrophonePermissionResult,
  type IdeaSpeechEventLike,
  type IdeaSpeechRecognitionLike,
} from "./idea-speech-input";

import { defaultCanvasCreationEntryText, type CanvasCreationEntryText } from "./canvas-creation-entry-text";

import { CanvasRuntimeAdapter } from "../canvas/runtime";
import type { ObsidianAppLike, RuntimeCanvasLike } from "../canvas/types";

export const DEFAULT_CANVAS_CREATION_FOLDER = "随手画布";
const CANVAS_CREATION_COMPOSER_OFFSET = { x: 47.5, y: -33.2 };
// Mirror --wb-entry-water-focus-enter/release-duration in styles.css.
const CANVAS_CREATION_WATER_FOCUS_ENTER_MS = 720;
const CANVAS_CREATION_WATER_FOCUS_RELEASE_MS = 320;
// The stop and restart follow the shared composer motion in core.
const CANVAS_CREATION_HOME_WATER_MOTION = Object.freeze({
  flowTimeScale: 1.2,
});

export {
  advanceCanvasCreationBoatFollow,
  CANVAS_CREATION_BOAT_FOLLOW_SPEED_LIMITS,
  normalizeCanvasCreationBoatFollowSpeed,
  resolveCanvasCreationEntryDeviceMode,
  sampleCanvasCreationPhoneRoamTarget,
  shouldCanvasCreationBoatFollowPointer,
  shouldCanvasCreationEntryCloseComposerFirst,
  type CanvasCreationEntryDeviceMode,
} from "./canvas-creation-navigation";
export {
  normalizeCanvasCreationLightIntensity,
  normalizeCanvasCreationWaterDepth,
  sampleCanvasCreationCelestialProjection,
  CANVAS_CREATION_WATER_DEPTH_LIMITS,
  type CanvasCreationCelestialLight,
  type CanvasCreationCelestialProjection,
  type CanvasCreationCelestialProjectionTier,
} from "./canvas-creation-light";

export type CanvasCreationSpeechEventLike = IdeaSpeechEventLike;
type CanvasCreationSpeechRecognitionLike = IdeaSpeechRecognitionLike;
export type CanvasCreationMicrophonePermissionResult =
  IdeaMicrophonePermissionResult;

export function shouldShowCanvasCreationSpeechInput(
  deviceMode: CanvasCreationEntryDeviceMode,
): boolean {
  return deviceMode !== "desktop";
}

export function shouldUseCanvasCreationSystemKeyboardSpeechInput(
  deviceMode: CanvasCreationEntryDeviceMode,
  platform: { isIosApp?: boolean } = Platform,
): boolean {
  return deviceMode === "tablet" && Boolean(platform.isIosApp);
}

export function shouldUseCanvasCreationAudioRecording(
  deviceMode: CanvasCreationEntryDeviceMode,
  platform: { isIosApp?: boolean } = Platform,
): boolean {
  return deviceMode === "phone" && Boolean(platform.isIosApp);
}

export function getCanvasCreationSpeechRecognitionConstructor(
  source: unknown = window,
): ReturnType<typeof getIdeaSpeechRecognitionConstructor> {
  // The shared browser detector covers SpeechRecognition and
  // webkitSpeechRecognition without moving either host lifecycle with it.
  return getIdeaSpeechRecognitionConstructor(source);
}

export async function requestCanvasCreationMicrophonePermission(
  source: unknown = window.navigator,
): Promise<CanvasCreationMicrophonePermissionResult> {
  return requestIdeaMicrophonePermission(source);
}

export function extractCanvasCreationSpeechTranscript(
  event: CanvasCreationSpeechEventLike,
): string {
  return extractFinalIdeaSpeechTranscript(event);
}

export function appendCanvasCreationSpeechTranscript(
  currentValue: string,
  transcript: string,
): string {
  return appendIdeaSpeechTranscript(currentValue, transcript);
}

export function formatCanvasCreationSpeechError(
  reason?: string,
  options: { microphoneGranted?: boolean } = {},
): string {
  return formatIdeaSpeechError(reason, {
    ...options,
    hostLabel: "Obsidian",
    surfaceLabel: "白舟",
  });
}

export function shouldSubmitCanvasCreationIdeaKey(
  event: {
    key: string;
    metaKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    isComposing?: boolean;
    repeat?: boolean;
  },
  mobileInput: boolean,
): boolean {
  if (event.key !== "Enter" || event.isComposing || event.repeat) {
    return false;
  }
  if (mobileInput) {
    return !event.shiftKey;
  }
  return Boolean(event.metaKey || event.ctrlKey);
}

interface CanvasCreationVaultLike {
  getAbstractFileByPath?: (path: string) => unknown;
  create?: (path: string, content: string) => Promise<unknown>;
  createBinary?: (path: string, data: ArrayBuffer) => Promise<unknown>;
  createFolder?: (path: string) => Promise<unknown>;
  adapter?: {
    exists?: (path: string) => Promise<boolean>;
    mkdir?: (path: string) => Promise<unknown>;
  };
}

interface CanvasCreationWorkspaceLike {
  getLeaf?: (newLeaf?: boolean) => {
    openFile?: (file: unknown) => Promise<unknown>;
  };
  openLinkText?: (
    linktext: string,
    sourcePath: string,
    newLeaf?: boolean,
  ) => Promise<unknown>;
}

interface CanvasCreationAppLike {
  vault?: unknown;
  workspace?: unknown;
  fileManager?: {
    getAvailablePathForAttachment?: (
      filename: string,
      sourcePath?: string,
    ) => Promise<string>;
  };
}

export interface CanvasCreationResult {
  path: string;
  file: unknown;
  seeded: boolean;
  opened: boolean;
  firstNodeId?: string;
  openError?: string;
}

export interface CanvasCreationAudioFormat {
  mimeType: string;
  extension: "m4a" | "webm";
}

export interface CanvasCreationAudioSaveResult {
  path: string;
  file: unknown;
  mimeType: string;
  durationMs: number;
}

const CANVAS_CREATION_AUDIO_FORMATS: readonly CanvasCreationAudioFormat[] = [
  { mimeType: "audio/mp4", extension: "m4a" },
  { mimeType: "audio/webm;codecs=opus", extension: "webm" },
  { mimeType: "audio/webm", extension: "webm" },
];

export const CANVAS_CREATION_AUDIO_NODE_SIZE = {
  width: 400,
  height: 120,
} as const;

export const CANVAS_CREATION_AUDIO_NODE_GAP = 32;

export function resolveCanvasCreationAudioFormat(
  recorderConstructor: Pick<typeof MediaRecorder, "isTypeSupported"> | null =
    typeof MediaRecorder === "undefined" ? null : MediaRecorder,
): CanvasCreationAudioFormat | null {
  if (!recorderConstructor) {
    return null;
  }
  const supported = CANVAS_CREATION_AUDIO_FORMATS.find((format) =>
    recorderConstructor.isTypeSupported(format.mimeType),
  );
  return supported ?? { mimeType: "", extension: "webm" };
}

export function resolveCanvasCreationAudioExtension(
  mimeType: string,
  fallback: CanvasCreationAudioFormat["extension"] = "webm",
): CanvasCreationAudioFormat["extension"] {
  const normalized = mimeType.toLowerCase();
  return normalized.includes("mp4") || normalized.includes("m4a")
    ? "m4a"
    : normalized.includes("webm")
      ? "webm"
      : fallback;
}

export function formatCanvasCreationRecordingFilename(
  now: Date,
  extension: CanvasCreationAudioFormat["extension"],
): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  return `白舟录音 ${year}-${month}-${day} ${hour}${minute}${second}.${extension}`;
}

export function formatCanvasCreationRecordingDuration(durationMs: number): string {
  const seconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return minutes > 0 ? `${minutes}:${remainder}` : `${seconds} 秒`;
}

export function formatCanvasCreationAudioError(error: unknown): string {
  const name =
    typeof DOMException !== "undefined" && error instanceof DOMException
      ? error.name
      : typeof error === "object" && error && "name" in error
        ? String((error as { name?: string }).name ?? "")
        : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Obsidian 没有获得麦克风权限。请在 iOS 设置中允许后再试。";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "当前设备没有可用的麦克风，可以继续输入文字。";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "麦克风正被其他地方占用，请稍后再按住水面录音。";
  }
  return "当前设备暂时不能在白舟里录音，可以继续输入文字。";
}

export interface CanvasCreationEntryOptions {
  getDefaultFolder: () => string;
  getDefaultTextNodeSize: () => CanvasTextNodeSize;
  text?: CanvasCreationEntryText;
  getBoatFollowSpeed?: () => number;
  getLightIntensity?: () => number;
  getWaterDepth?: () => number;
  getSoundEnabled?: () => boolean;
  onSoundEnabledChange?: (enabled: boolean) => void | Promise<void>;
  now?: () => Date;
  onClose?: () => void;
}

interface CanvasCreationEntryState {
  boat: CanvasCreationWaterBoat;
  target: { x: number; y: number } | null;
  targetKind: "pointer" | "coast" | "click" | "roam" | "recording" | null;
  composerAnchor: { x: number; y: number } | null;
  composerOpen: boolean;
  landed: boolean;
  submitting: boolean;
  lastFrameAt: number;
  frameId: number | null;
}

interface CanvasCreationAudioCapture {
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  format: CanvasCreationAudioFormat;
  startedAt: number;
}

interface CanvasCreationRecordingGesture {
  pointerId: number;
  point: { x: number; y: number };
  timer: number;
  activated: boolean;
}

export function normalizeCanvasCreationFolder(
  value: string | null | undefined,
): string {
  const normalized = normalizePath(String(value ?? "").trim())
    .replace(/^\/+|\/+$/gu, "")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");
  return normalized || DEFAULT_CANVAS_CREATION_FOLDER;
}

export function formatCanvasCreationTimestamp(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}${minute}`;
}

export function createCanvasCreationCandidatePath(
  now: Date,
  options: { folder?: string; suffix?: number; text?: CanvasCreationEntryText } = {},
): string {
  const folder = normalizeCanvasCreationFolder(options.folder);
  const suffix =
    typeof options.suffix === "number" && options.suffix > 1
      ? ` ${Math.floor(options.suffix)}`
      : "";
  return normalizePath(
    `${folder}/${formatCanvasCreationTimestamp(now)} ${(options.text ?? defaultCanvasCreationEntryText)("canvasName")}${suffix}.canvas`,
  );
}

export async function resolveUniqueCanvasCreationPath(
  app: CanvasCreationAppLike,
  now: Date,
  options: { folder?: string; text?: CanvasCreationEntryText } = {},
): Promise<string> {
  const vault = app.vault as CanvasCreationVaultLike | undefined;
  if (!vault) {
    throw new Error((options.text ?? defaultCanvasCreationEntryText)("vaultUnavailable"));
  }
  for (let suffix = 1; suffix <= 999; suffix += 1) {
    const path = createCanvasCreationCandidatePath(now, {
      folder: options.folder,
      suffix,
      text: options.text,
    });
    const abstractFile = vault.getAbstractFileByPath?.(path);
    const adapterExists = vault.adapter?.exists
      ? await vault.adapter.exists(path)
      : false;
    if (!abstractFile && !adapterExists) {
      return path;
    }
  }
  throw new Error((options.text ?? defaultCanvasCreationEntryText)("pathLimit"));
}

function createCanvasNodeId(): string {
  const bytes = new Uint8Array(8);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) =>
      value.toString(16).padStart(2, "0"),
    ).join("");
  }
  return Math.random().toString(16).slice(2, 18).padEnd(16, "0");
}

export function createCanvasCreationContent(
  input: string,
  options: {
    nodeId?: string;
    nodeSize?: Partial<CanvasTextNodeSize>;
    audioPaths?: string[];
    audioNodeIds?: string[];
  } = {},
): string {
  const text = String(input ?? "").trim();
  const audioPaths = (options.audioPaths ?? [])
    .map((path) => normalizePath(String(path ?? "").trim()))
    .filter(Boolean);
  if (!text && audioPaths.length === 0) {
    return `${JSON.stringify({ nodes: [], edges: [] }, null, 2)}\n`;
  }
  const { width, height } = normalizeTextNodeSize(options.nodeSize);
  const nodes: Array<Record<string, unknown>> = [];
  if (text) {
    nodes.push({
      id: options.nodeId ?? createCanvasNodeId(),
      type: "text",
      text,
      x: Math.round(width * -0.5),
      y: Math.round(height * -0.5),
      width,
      height,
    });
  }
  const audioStackHeight =
    audioPaths.length * CANVAS_CREATION_AUDIO_NODE_SIZE.height +
    Math.max(0, audioPaths.length - 1) * CANVAS_CREATION_AUDIO_NODE_GAP;
  const audioStartY = text
    ? Math.round(height * 0.5 + CANVAS_CREATION_AUDIO_NODE_GAP)
    : Math.round(audioStackHeight * -0.5);
  audioPaths.forEach((file, index) => {
    nodes.push({
      id: options.audioNodeIds?.[index] ?? createCanvasNodeId(),
      type: "file",
      file,
      x: Math.round(CANVAS_CREATION_AUDIO_NODE_SIZE.width * -0.5),
      y:
        audioStartY +
        index *
          (CANVAS_CREATION_AUDIO_NODE_SIZE.height +
            CANVAS_CREATION_AUDIO_NODE_GAP),
      width: CANVAS_CREATION_AUDIO_NODE_SIZE.width,
      height: CANVAS_CREATION_AUDIO_NODE_SIZE.height,
    });
  });
  return `${JSON.stringify(
    {
      nodes,
      edges: [],
    },
    null,
    2,
  )}\n`;
}

async function ensureCanvasCreationFolder(
  app: CanvasCreationAppLike,
  folder: string,
  text: CanvasCreationEntryText = defaultCanvasCreationEntryText,
): Promise<void> {
  await ensureCanvasCreationVaultFolderPath(
    app,
    normalizeCanvasCreationFolder(folder),
    text,
  );
}

async function ensureCanvasCreationVaultFolderPath(
  app: CanvasCreationAppLike,
  folder: string,
  text: CanvasCreationEntryText = defaultCanvasCreationEntryText,
): Promise<void> {
  const vault = app.vault as CanvasCreationVaultLike | undefined;
  if (!vault) {
    throw new Error(text("vaultUnavailable"));
  }
  const normalizedFolder = normalizePath(folder).replace(/^\/+|\/+$/gu, "");
  if (!normalizedFolder) {
    return;
  }
  const segments = normalizedFolder.split("/").filter(Boolean);
  let current = "";
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    if (vault.getAbstractFileByPath?.(current)) {
      continue;
    }
    if (vault.createFolder) {
      try {
        await vault.createFolder(current);
      } catch (error) {
        if (!vault.getAbstractFileByPath?.(current)) {
          throw error;
        }
      }
      continue;
    }
    if (vault.adapter?.mkdir) {
      await vault.adapter.mkdir(current);
      continue;
    }
    throw new Error(text("folderFailed", { path: current }));
  }
}

export async function saveCanvasCreationAudioRecording(
  app: CanvasCreationAppLike,
  blob: Blob,
  options: {
    folder?: string;
    now?: Date;
    durationMs?: number;
    fallbackExtension?: CanvasCreationAudioFormat["extension"];
  } = {},
): Promise<CanvasCreationAudioSaveResult> {
  const vault = app.vault as CanvasCreationVaultLike | undefined;
  if (!vault?.createBinary) {
    throw new Error("当前 Vault 暂时不能保存录音。");
  }
  if (blob.size <= 0) {
    throw new Error("这段录音没有收到声音数据，请重新按住水面录音。");
  }
  const extension = resolveCanvasCreationAudioExtension(
    blob.type,
    options.fallbackExtension,
  );
  const filename = formatCanvasCreationRecordingFilename(
    options.now ?? new Date(),
    extension,
  );
  const sourcePath = normalizePath(
    `${normalizeCanvasCreationFolder(options.folder)}/未命名.canvas`,
  );
  let path = await app.fileManager?.getAvailablePathForAttachment?.(
    filename,
    sourcePath,
  );
  if (!path) {
    const folder = normalizeCanvasCreationFolder(options.folder);
    for (let suffix = 1; suffix <= 999; suffix += 1) {
      const stem = filename.slice(0, -(extension.length + 1));
      const candidate = normalizePath(
        `${folder}/${stem}${suffix === 1 ? "" : ` ${suffix}`}.${extension}`,
      );
      const exists =
        Boolean(vault.getAbstractFileByPath?.(candidate)) ||
        Boolean(await vault.adapter?.exists?.(candidate));
      if (!exists) {
        path = candidate;
        break;
      }
    }
  }
  if (!path) {
    throw new Error("当前目录里已有太多同名录音，请稍后再试。");
  }
  path = normalizePath(path);
  const separator = path.lastIndexOf("/");
  if (separator > 0) {
    await ensureCanvasCreationVaultFolderPath(app, path.slice(0, separator));
  }
  const file = await vault.createBinary(path, await blob.arrayBuffer());
  return {
    path,
    file,
    mimeType: blob.type,
    durationMs: Math.max(0, options.durationMs ?? 0),
  };
}

async function openCreatedCanvas(
  app: CanvasCreationAppLike,
  file: unknown,
  path: string,
  text: CanvasCreationEntryText = defaultCanvasCreationEntryText,
): Promise<void> {
  const workspace = app.workspace as CanvasCreationWorkspaceLike | undefined;
  const leaf = workspace?.getLeaf?.(false);
  if (leaf?.openFile) {
    try {
      await leaf.openFile(file);
      return;
    } catch (error) {
      if (!workspace?.openLinkText) {
        throw error;
      }
    }
  }
  if (workspace?.openLinkText) {
    await workspace.openLinkText(path, "", false);
    return;
  }
  throw new Error(text("openFailed"));
}

export async function createAndOpenCanvasFromEntry(
  app: CanvasCreationAppLike,
  input: string,
  options: {
    folder?: string;
    now?: Date;
    nodeSize?: Partial<CanvasTextNodeSize>;
    audioPaths?: string[];
    isActive?: () => boolean;
    text?: CanvasCreationEntryText;
  } = {},
): Promise<CanvasCreationResult> {
  const text = options.text ?? defaultCanvasCreationEntryText;
  const vault = app.vault as CanvasCreationVaultLike | undefined;
  if (!vault?.create) {
    throw new Error(text("createUnavailable"));
  }
  const folder = normalizeCanvasCreationFolder(options.folder);
  await ensureCanvasCreationFolder(app, folder, text);
  const path = await resolveUniqueCanvasCreationPath(
    app,
    options.now ?? new Date(),
    { folder, text },
  );
  const content = createCanvasCreationContent(input, {
    nodeSize: options.nodeSize,
    audioPaths: options.audioPaths,
  });
  if (options.isActive?.() === false) throw new Error(text("entryClosed"));
  const createdData = JSON.parse(content) as { nodes: Array<{ id: string }> };
  const firstNodeId = createdData.nodes[0]?.id;
  const file = await vault.create(path, content);
  try {
    if (options.isActive?.() === false) throw new Error(text("entryClosedSaved"));
    await openCreatedCanvas(app, file, path, text);
    return {
      path,
      file,
      firstNodeId,
      seeded:
        Boolean(String(input ?? "").trim()) ||
        Boolean(options.audioPaths?.length),
      opened: true,
    };
  } catch (error) {
    return {
      path,
      file,
      firstNodeId,
      seeded:
        Boolean(String(input ?? "").trim()) ||
        Boolean(options.audioPaths?.length),
      opened: false,
      openError: error instanceof Error ? error.message : String(error),
    };
  }
}

export class WhiteboatCanvasCreationEntryModal extends Modal {
  private readonly motionQuery = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  private state: CanvasCreationEntryState = {
    boat: {
      x: 0,
      y: 0,
      heading: -Math.PI / 4,
      speed: 0,
      visible: true,
    },
    target: null,
    targetKind: null,
    composerAnchor: null,
    composerOpen: false,
    landed: false,
    submitting: false,
    lastFrameAt: performance.now(),
    frameId: null,
  };
  private rootEl!: HTMLElement;
  private waterEl!: HTMLElement;
  private recordingRipplesEl!: HTMLElement;
  private focusVeilEl!: HTMLElement;
  /** Composer card and dock the focus veil keeps clear, plus its blur ramp. */
  private waterFocus: {
    anchor: { left: number; top: number; right: number; bottom: number; dock: { x: number; y: number } } | null;
    active: boolean;
    amount: number;
    from: number;
    startedAt: number;
    startDistance: number;
    padding: number;
  } = { anchor: null, active: false, amount: 0, from: 0, startedAt: 0, startDistance: 0, padding: 0 };
  private boatEl!: HTMLButtonElement;
  private boatCanvas!: HTMLCanvasElement;
  private boatRenderer: ReturnType<typeof mountCanvasCreationBoatRenderer> | null = null;
  private soundToggleEl: HTMLButtonElement | null = null;
  private composerEl!: HTMLFormElement;
  private composerMotion: CanvasCreationComposerMotion | null = null;
  private ideaEl!: HTMLTextAreaElement;
  private speechEl: HTMLButtonElement | null = null;
  private submitEl!: HTMLButtonElement;
  private statusEl!: HTMLElement;
  private deviceMode: CanvasCreationEntryDeviceMode = "desktop";
  private mobileInput = false;
  private speechRecognition: CanvasCreationSpeechRecognitionLike | null = null;
  private speechListening = false;
  private speechPermissionPending = false;
  private speechStartRequestId = 0;
  private recordingGesture: CanvasCreationRecordingGesture | null = null;
  private audioCapture: CanvasCreationAudioCapture | null = null;
  private audioStartRequestId = 0;
  private audioStartPendingRequestId: number | null = null;
  private audioSavingPromise: Promise<CanvasCreationAudioSaveResult | null> | null =
    null;
  private recordedAudioPaths: string[] = [];
  private suppressNextWaterClick = false;
  private closeAfterAudioStops = false;
  private phoneRoamTimer: number | null = null;
  private viewportFollowFrame: number | null = null;
  private viewportFollowUntil = 0;
  private celestialFrameId: number | null = null;
  private celestialStartedAt = 0;
  private themeObserver: MutationObserver | null = null;
  private waterField: CanvasCreationWaterField | null = null;
  private readonly mooringMotion = new CanvasCreationMooringMotion();
  private mooringFrame = { offset: 0, heading: 0, roll: 0 };
  private soundscape: WhiteboatHomeBoatSoundscape | null = null;
  private soundEnabled = true;
  private modalContainerEl: HTMLElement | null = null;
  private readonly cleanup: Array<() => void> = [];

  constructor(
    app: App,
    private readonly options: CanvasCreationEntryOptions,
  ) {
    super(app);
  }

  private get t(): CanvasCreationEntryText { return this.options.text ?? defaultCanvasCreationEntryText; }

  /** Update copy in place: retain draft, focus, and every effect instance. */
  refreshText(): void {
    if (!this.rootEl) return;
    const label = this.rootEl.querySelector("#whiteboat-canvas-entry-boat-label");
    if (label) label.setText(this.t("boatLabel"));
    const title = this.rootEl.querySelector("label[for=whiteboat-canvas-entry-idea]");
    if (title) title.setText(this.t("composerTitle"));
    this.ideaEl.placeholder = this.t("placeholder");
    this.rootEl.querySelector(".whiteboat-canvas-entry__close")?.setAttribute("aria-label", this.t("close"));
    this.rootEl.querySelector(".whiteboat-canvas-entry__shortcut")?.setAttribute("aria-label", this.t(this.mobileInput ? "enterCanvas" : "enterShortcut"));
    this.submitEl.setText(this.t(this.state.submitting ? "creating" : this.composerEl.hasClass("is-error") ? "retry" : this.mobileInput ? "enterCanvas" : "enterKey"));
    this.submitEl.setAttribute("aria-label", this.t(this.state.submitting ? "creatingLabel" : "enterKeyLabel"));
    this.updateSoundLabel(this.soundToggleEl?.dataset.soundState === "error");
    this.statusEl.setText("");
    this.syncComposerPosition();
  }

  close(): void {
    if (this.state.submitting) {
      return;
    }
    if (
      shouldCanvasCreationEntryCloseComposerFirst(
        this.deviceMode,
        this.state.composerOpen,
      )
    ) {
      this.closeComposer({ returnFocus: true });
      return;
    }
    this.closeEntry();
  }

  closeEntryImmediately(): void {
    this.abortAudioRecording();
    super.close();
  }

  onOpen(): void {
    this.modalEl.addClass("whiteboat-canvas-entry-modal");
    this.claimModalContainer();
    this.contentEl.empty();
    this.deviceMode = resolveCanvasCreationEntryDeviceMode({
      isMobileApp: Platform.isMobileApp,
      isPhone: Platform.isPhone,
      isTablet: Platform.isTablet,
      bodyIsMobile: document.body.classList.contains("is-mobile"),
      bodyIsPhone: document.body.classList.contains("is-phone"),
      bodyIsTablet: document.body.classList.contains("is-tablet"),
    });
    document.body.classList.toggle(
      "whiteboat-canvas-entry-phone-open",
      this.deviceMode === "phone",
    );
    this.mobileInput = this.deviceMode !== "desktop";
    this.rootEl = this.contentEl.createDiv({
      cls: [
        "whiteboat-canvas-entry",
        this.mobileInput ? "is-mobile" : "",
        `is-${this.deviceMode}`,
      ]
        .filter(Boolean)
        .join(" "),
      attr: {
        "data-reduced-motion": String(this.motionQuery.matches),
        "data-mobile-input": String(this.mobileInput),
        "data-device-mode": this.deviceMode,
        "data-water-focus": "clear",
      },
    });
    this.rootEl.style.setProperty(
      "--wb-entry-anchor-cursor",
      `url("${CANVAS_CREATION_ANCHOR_CURSOR}") 12 12, pointer`,
    );
    this.celestialStartedAt = performance.now();
    this.themeObserver = new MutationObserver(() => {
      if (!this.rootEl?.isConnected) {
        return;
      }
      // Obsidian can apply its theme class just after a modal opens. Re-sample
      // immediately so the boat and water never keep the light grade in a
      // dark surface (or vice versa), including when motion is reduced.
      this.updateCelestialProjection(performance.now());
    });
    this.themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });
    this.updateCelestialProjection(this.celestialStartedAt);
    this.soundEnabled = this.options.getSoundEnabled?.() ?? true;
    this.soundscape = new WhiteboatHomeBoatSoundscape({
      enabled: this.soundEnabled,
      reducedMotion: this.motionQuery.matches,
      onStateChange: (snapshot) => this.updateSoundSurface(snapshot),
    });
    this.soundscape.setSuspended("document-hidden", document.hidden);
    this.soundscape.activate();
    this.renderHeader();
    this.renderWater();
    try {
      this.boatRenderer = mountCanvasCreationBoatRenderer(
        this.boatCanvas,
        this.boatEl,
        CANVAS_CREATION_ENTRY_ASSETS,
      );
    } catch (error) {
      console.warn("[whiteboat] 3D boat unavailable; using the shared artwork", error);
    }
    this.syncStageViewportFrame();
    this.installInteractions();
    this.waterField = new CanvasCreationWaterField(
      this.waterEl.querySelector("canvas") as HTMLCanvasElement,
      {
        tokenRoot: this.rootEl,
        reducedMotion: this.motionQuery.matches,
        ...CANVAS_CREATION_HOME_WATER_MOTION,
      },
    );
    this.waterField.start();
    this.composerMotion = new CanvasCreationComposerMotion(
      this.composerEl,
      this.waterEl.querySelector("canvas") as HTMLCanvasElement,
      () => this.motionQuery.matches,
      () => { void this.soundscape?.playIdeaDropSound(); },
    );
    this.resetLayout();
    if (Platform.isDesktopApp && this.deviceMode === "desktop") {
      const stopScreenPointer = startCanvasCreationScreenPointer({
        isActive: () => this.rootEl.isConnected &&
          !this.motionQuery.matches &&
          shouldCanvasCreationBoatFollowPointer(
            this.deviceMode, this.state.composerOpen, this.state.submitting,
          ),
        onMove: (point) => {
          const rect = this.waterEl.getBoundingClientRect();
          this.followPointer({ x: point.x - rect.left, y: point.y - rect.top });
        },
      });
      this.rootEl.dataset.pointerSource = stopScreenPointer ? "screen" : "surface";
      if (stopScreenPointer) this.cleanup.push(stopScreenPointer);
    }
    this.scheduleCelestialMotion();
    this.scheduleWaterGeometryRefresh();
    if (this.deviceMode === "phone") {
      this.openComposer({ focus: true, keepDestination: true });
      this.schedulePhoneRoam(240);
    } else {
      this.boatEl.addClass("is-initial-focus");
      window.requestAnimationFrame(() => {
        if (this.boatEl.isConnected && !this.state.composerOpen) {
          this.boatEl.focus({ preventScroll: true });
        }
      });
    }
  }

  onClose(): void {
    this.composerMotion?.destroy();
    this.composerMotion = null;
    if (this.state.frameId !== null) {
      cancelAnimationFrame(this.state.frameId);
      this.state.frameId = null;
    }
    if (this.viewportFollowFrame !== null) {
      cancelAnimationFrame(this.viewportFollowFrame);
      this.viewportFollowFrame = null;
    }
    if (this.celestialFrameId !== null) {
      cancelAnimationFrame(this.celestialFrameId);
      this.celestialFrameId = null;
    }
    this.themeObserver?.disconnect();
    this.themeObserver = null;
    this.stopSpeechRecognition({ abort: true, announce: false });
    this.abortAudioRecording();
    this.soundscape?.destroy();
    this.soundscape = null;
    this.speechStartRequestId += 1;
    this.speechPermissionPending = false;
    this.clearPhoneRoamTimer();
    this.cleanup.splice(0).forEach((dispose) => dispose());
    this.waterField?.destroy();
    this.waterField = null;
    this.boatRenderer?.destroy();
    this.boatRenderer = null;
    this.clearStageViewportFrame();
    this.modalEl.removeClass("whiteboat-canvas-entry-modal");
    this.modalContainerEl?.classList.remove(
      "whiteboat-canvas-entry-modal-container",
    );
    this.modalContainerEl = null;
    document.body.classList.remove("whiteboat-canvas-entry-open");
    document.body.classList.remove("whiteboat-canvas-entry-phone-open");
    this.contentEl.empty();
    this.options.onClose?.();
  }

  private closeEntry(): void {
    if (this.audioCapture) {
      this.closeAfterAudioStops = true;
      void this.finishAudioRecording();
      return;
    }
    if (this.audioSavingPromise) {
      this.closeAfterAudioStops = true;
      void this.audioSavingPromise.then((result) => {
        if (!this.closeAfterAudioStops) {
          return;
        }
        this.closeAfterAudioStops = false;
        if (result) {
          super.close();
        }
      });
      return;
    }
    this.abortAudioRecording();
    super.close();
  }

  private claimModalContainer(): void {
    const container = this.modalEl.closest(".modal-container");
    this.modalContainerEl =
      container instanceof HTMLElement ? container : this.modalEl.parentElement;
    this.modalContainerEl?.classList.add(
      "whiteboat-canvas-entry-modal-container",
    );
    document.body.classList.add("whiteboat-canvas-entry-open");
  }

  private syncStageViewportFrame(): void {
    if (this.deviceMode !== "phone") {
      return;
    }
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    const fixedTargets = [
      this.modalContainerEl,
      this.modalEl,
      this.contentEl,
    ].filter((target): target is HTMLElement => target instanceof HTMLElement);
    fixedTargets.forEach((target) => {
      target.classList.add("whiteboat-canvas-entry-viewport-frame");
      target.style.setProperty("left", `${left}px`, "important");
      target.style.setProperty("top", `${top}px`, "important");
      target.style.setProperty("width", `${width}px`, "important");
      target.style.setProperty("height", `${height}px`, "important");
    });
    if (this.rootEl) {
      this.rootEl.style.setProperty("width", `${width}px`);
      this.rootEl.style.setProperty("height", `${height}px`);
      this.rootEl.classList.add("whiteboat-canvas-entry-viewport-root");
    }
  }

  private clearStageViewportFrame(): void {
    const fixedTargets = [
      this.modalContainerEl,
      this.modalEl,
      this.contentEl,
    ].filter((target): target is HTMLElement => target instanceof HTMLElement);
    const frameProperties = [
      "position",
      "left",
      "top",
      "right",
      "bottom",
      "width",
      "height",
      "min-width",
      "min-height",
      "max-width",
      "max-height",
      "padding",
      "margin",
      "overflow",
      "box-sizing",
    ];
    fixedTargets.forEach((target) => {
      target.classList.remove("whiteboat-canvas-entry-viewport-frame");
      frameProperties.forEach((property) =>
        target.style.removeProperty(property),
      );
    });
    if (this.rootEl) {
      this.rootEl.classList.remove("whiteboat-canvas-entry-viewport-root");
      ["width", "height", "min-width", "min-height"].forEach((property) =>
        this.rootEl.style.removeProperty(property),
      );
    }
  }

  private renderHeader(): void {
    const header = this.rootEl.createEl("header", {
      cls: "whiteboat-canvas-entry__header",
      attr: { "aria-label": "Whiteboat" },
    });
    const brand = header.createDiv({
      cls: "whiteboat-canvas-entry__brand",
      attr: { "aria-label": "Whiteboat" },
    });
    brand.createEl("img", {
      cls: "whiteboat-canvas-entry__brand-mark is-light",
      attr: { src: CANVAS_CREATION_ENTRY_ASSETS.logoMark, alt: "" },
    });
    brand.createEl("img", {
      cls: "whiteboat-canvas-entry__brand-mark is-dark",
      attr: { src: CANVAS_CREATION_ENTRY_ASSETS.logoMarkDark, alt: "" },
    });
    brand.createEl("img", {
      cls: "whiteboat-canvas-entry__brand-wordmark is-light",
      attr: { src: CANVAS_CREATION_ENTRY_ASSETS.logoWordmark, alt: "Whiteboat" },
    });
    brand.createEl("img", {
      cls: "whiteboat-canvas-entry__brand-wordmark is-dark",
      attr: {
        src: CANVAS_CREATION_ENTRY_ASSETS.logoWordmarkDark,
        alt: "Whiteboat",
      },
    });

    const actions = header.createDiv({
      cls: "whiteboat-canvas-entry__header-actions",
    });
    this.soundToggleEl = actions.createEl("button", {
      cls: "whiteboat-canvas-entry__sound-toggle",
      attr: {
        type: "button",
        "aria-label": this.soundEnabled ? this.t("soundOff") : this.t("soundOn"),
        "aria-pressed": String(this.soundEnabled),
      },
    });
    this.soundToggleEl.addEventListener("click", () => {
      void this.toggleSoundEnabled();
    });
    this.updateSoundSurface(this.soundscape?.getSnapshot() ?? {
      state: this.soundEnabled ? "waiting" : "muted",
      volume: 0,
      activated: false,
    });
    const closeButton = actions.createEl("button", {
      cls: "whiteboat-canvas-entry__close",
      attr: { type: "button", "aria-label": this.t("close") },
    });
    setIcon(closeButton, "x");
    closeButton.addEventListener("click", () => {
      if (!this.state.submitting) {
        this.closeEntry();
      }
    });
  }

  private async toggleSoundEnabled(): Promise<void> {
    const previous = this.soundEnabled;
    const next = !previous;
    this.soundEnabled = next;
    this.soundscape?.setEnabled(next);
    if (next) {
      this.soundscape?.activate();
    }
    this.updateSoundSurface(
      this.soundscape?.getSnapshot() ?? {
        state: next ? "waiting" : "muted",
        volume: 0,
        activated: false,
      },
    );
    try {
      await this.options.onSoundEnabledChange?.(next);
    } catch {
      this.soundEnabled = previous;
      this.soundscape?.setEnabled(previous);
      this.updateSoundSurface(
        this.soundscape?.getSnapshot() ?? {
          state: previous ? "waiting" : "muted",
          volume: 0,
          activated: false,
        },
      );
      new Notice(this.t("soundSaveFailed"));
    }
  }

  private updateSoundSurface(snapshot: WhiteboatHomeSoundSnapshot): void {
    if (this.rootEl) {
      this.rootEl.dataset.soundState = snapshot.state;
      this.rootEl.dataset.soundVolume = snapshot.volume.toFixed(3);
      this.rootEl.dataset.soundActivated = String(snapshot.activated);
    }
    if (!this.soundToggleEl) {
      return;
    }
    const unavailable = snapshot.state === "error";
    this.soundToggleEl.empty();
    setIcon(
      this.soundToggleEl,
      this.soundEnabled && !unavailable ? "volume-2" : "volume-x",
    );
    this.soundToggleEl.dataset.soundState = snapshot.state;
    this.soundToggleEl.setAttribute("aria-pressed", String(this.soundEnabled));
    this.updateSoundLabel(unavailable);
  }

  private updateSoundLabel(unavailable: boolean): void {
    this.soundToggleEl?.setAttribute(
      "aria-label",
      unavailable
        ? this.t("soundUnavailable")
        : this.soundEnabled
          ? this.t("soundOff")
          : this.t("soundOn"),
    );
  }

  private renderWater(): void {
    this.waterEl = this.rootEl.createEl("section", {
      cls: "whiteboat-canvas-entry__water",
    });
    this.waterEl.createEl("canvas", {
      cls: "whiteboat-canvas-entry__water-canvas",
      attr: { "aria-hidden": "true" },
    });
    this.recordingRipplesEl = this.waterEl.createDiv({
      cls: "whiteboat-canvas-entry__recording-ripples",
      attr: { "aria-hidden": "true" },
    });
    for (let index = 0; index < 4; index += 1) {
      this.recordingRipplesEl.createSpan({
        cls: "whiteboat-canvas-entry__recording-ripple",
        attr: { style: `--wb-entry-recording-ripple-index: ${index}` },
      });
    }
    // Progressive blur around the open composer: sits above the water canvas
    // and below the boat / composer, so only the surrounding water recedes.
    this.focusVeilEl = this.waterEl.createDiv({
      cls: "whiteboat-canvas-entry__focus-veil",
      attr: { "aria-hidden": "true" },
    });
    for (const layer of ["near", "mid", "far"]) {
      this.focusVeilEl.createSpan({
        cls: `whiteboat-canvas-entry__focus-layer is-${layer}`,
      });
    }
    this.waterEl.createSpan({
      cls: "whiteboat-canvas-entry__accessibility-label",
      text: this.t("boatLabel"),
      attr: { id: "whiteboat-canvas-entry-boat-label" },
    });
    this.boatEl = this.waterEl.createEl("button", {
      cls: "whiteboat-canvas-entry__boat",
      attr: {
        type: "button",
        "aria-labelledby": "whiteboat-canvas-entry-boat-label",
        "aria-haspopup": "dialog",
      },
    });
    this.boatCanvas = this.boatEl.createEl("canvas", {
      cls: "whiteboat-canvas-entry__boat-model",
      attr: { "aria-hidden": "true" },
    });
    const shadow = this.boatEl.createSpan({
      cls: "whiteboat-canvas-entry__boat-shadow",
      attr: { "aria-hidden": "true" },
    });
    const boatProjectionMask = `url("${CANVAS_CREATION_ENTRY_ASSETS.boatShadow}")`;
    shadow.style.setProperty("mask-image", boatProjectionMask);
    shadow.style.setProperty("-webkit-mask-image", boatProjectionMask);
    const body = this.boatEl.createSpan({
      cls: "whiteboat-canvas-entry__boat-body",
      attr: { "aria-hidden": "true" },
    });
    body.createEl("img", {
      cls: "whiteboat-canvas-entry__boat-hull",
      attr: { src: CANVAS_CREATION_ENTRY_ASSETS.boatHull, alt: "" },
    });
    body.createEl("img", {
      cls: "whiteboat-canvas-entry__boat-window",
      attr: { src: CANVAS_CREATION_ENTRY_ASSETS.boatWindow, alt: "" },
    });

    this.composerEl = this.waterEl.createEl("form", {
      cls: "whiteboat-canvas-entry__composer",
      attr: {
        role: "dialog",
        ...(this.deviceMode === "phone"
          ? { "aria-label": this.t("composerTitle") }
          : { "aria-labelledby": "whiteboat-canvas-entry-title" }),
        "aria-modal": "false",
        "aria-hidden": "true",
      },
    });
    this.composerEl.noValidate = true;
    this.composerEl.inert = true;
    this.composerEl.createSpan({
      cls: "whiteboat-canvas-entry__composer-shadow",
      attr: { "aria-hidden": "true" },
    });
    const surface = this.composerEl.createDiv({
      cls: "whiteboat-canvas-entry__composer-surface",
    });
    const composerHeader = surface.createDiv({
      cls: "whiteboat-canvas-entry__composer-header",
    });
    const title = composerHeader.createDiv({
      cls: "whiteboat-canvas-entry__composer-title",
      attr: { id: "whiteboat-canvas-entry-title" },
    });
    title.createEl("img", {
      attr: {
        src: CANVAS_CREATION_ENTRY_ASSETS.anchor,
        alt: "",
        "aria-hidden": "true",
      },
    });
    title.createEl("label", {
      text: this.t("composerTitle"),
      attr: { for: "whiteboat-canvas-entry-idea" },
    });
    const shortcut = composerHeader.createDiv({
      cls: "whiteboat-canvas-entry__shortcut",
      attr: {
        "aria-label": this.mobileInput
          ? this.t("enterCanvas")
          : this.t("enterShortcut"),
      },
    });
    if (!this.mobileInput) {
      shortcut.createEl("button", {
        cls: "whiteboat-canvas-entry__command-key",
        text: "⌘",
        attr: { "aria-hidden": "true", type: "button" },
      });
    }
    if (shouldShowCanvasCreationSpeechInput(this.deviceMode)) {
      this.speechEl = shortcut.createEl("button", {
        cls: "whiteboat-canvas-entry__speech-button",
        attr: {
          type: "button",
          "aria-label": this.usesAudioRecording()
            ? "按住水面录音"
            : this.usesSystemKeyboardSpeechInput()
              ? "用系统键盘听写"
              : "说出想法",
          "aria-pressed": "false",
        },
      });
      setIcon(this.speechEl, "mic");
    }
    this.submitEl = shortcut.createEl("button", {
      text:
        this.deviceMode === "phone"
          ? ""
          : this.mobileInput
            ? this.t("enterCanvas")
            : this.t("enterKey"),
      attr: {
        type: "submit",
        "aria-label": this.mobileInput ? this.t("enterCanvas") : this.t("enterKeyLabel"),
      },
    });
    if (this.deviceMode === "phone") {
      this.renderPhoneSubmitAnchorIcon();
    }
    const composerBody = surface.createDiv({
      cls: "whiteboat-canvas-entry__composer-body",
    });
    this.ideaEl = composerBody.createEl("textarea", {
      cls: "whiteboat-canvas-entry__idea",
      attr: {
        id: "whiteboat-canvas-entry-idea",
        name: "idea",
        rows: this.deviceMode === "phone" ? "1" : "4",
        placeholder: this.t("placeholder"),
        autocomplete: "off",
        enterkeyhint: this.mobileInput ? "go" : "enter",
      },
    });
    this.statusEl = this.waterEl.createEl("p", {
      cls: "whiteboat-canvas-entry__status",
      attr: { role: "status", "aria-live": "polite" },
    });
  }

  private installInteractions(): void {
    const recordingTargetSelector =
      ".whiteboat-canvas-entry__boat, .whiteboat-canvas-entry__composer, .whiteboat-canvas-entry__header-actions";
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (
        !this.usesAudioRecording() ||
        !event.isPrimary ||
        event.button !== 0 ||
        this.state.submitting ||
        this.audioSavingPromise ||
        target?.closest(recordingTargetSelector)
      ) {
        return;
      }
      this.cancelRecordingGesture();
      const gesture: CanvasCreationRecordingGesture = {
        pointerId: event.pointerId,
        point: this.getWaterPoint(event),
        timer: 0,
        activated: false,
      };
      gesture.timer = window.setTimeout(() => {
        if (this.recordingGesture !== gesture || !this.rootEl.isConnected) {
          return;
        }
        gesture.activated = true;
        this.suppressNextWaterClick = true;
        this.soundscape?.setSuspended("recording", true);
        this.dismissPhoneKeyboard();
        this.stopPhoneRoaming();
        this.sailBoatTo(
          this.resolvePhoneRecordingBoatTarget(gesture.point),
          "recording",
        );
        this.rootEl.addClass("is-recording-pending");
        this.placeRecordingRipples();
        this.updateSpeechButton();
        this.announce("正在准备录音。松手结束。");
        window.setTimeout(() => {
          if (
            this.recordingGesture === gesture &&
            gesture.activated &&
            this.rootEl.isConnected
          ) {
            void this.startAudioRecording(gesture);
          }
        }, WHITEBOAT_HOME_SOUND_DUCK_MS);
      }, 260);
      this.recordingGesture = gesture;
      try {
        this.waterEl.setPointerCapture(event.pointerId);
      } catch {
        // A host gesture recognizer may already own pointer capture.
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      const point = this.getWaterPoint(event);
      if (
        this.recordingGesture &&
        this.recordingGesture.pointerId === event.pointerId
      ) {
        this.recordingGesture.point = point;
        if (this.recordingGesture.activated) {
          event.preventDefault();
          this.sailBoatTo(
            this.resolvePhoneRecordingBoatTarget(point),
            "recording",
          );
          return;
        }
      }
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest(recordingTargetSelector)
      ) {
        if (!target?.closest(".whiteboat-canvas-entry__boat")) {
          this.continueFollowingPointer();
        }
        return;
      }
      if (
        shouldCanvasCreationBoatFollowPointer(
          this.deviceMode,
          this.state.composerOpen,
          this.state.submitting,
        )
      ) {
        this.followPointer(point);
      }
    };
    const onPointerLeave = () => {
      this.continueFollowingPointer();
    };
    const onPointerEnd = (event: PointerEvent) => {
      const gesture = this.recordingGesture;
      if (!gesture || gesture.pointerId !== event.pointerId) {
        return;
      }
      if (gesture.activated) {
        event.preventDefault();
        this.suppressNextWaterClick = true;
        void this.finishAudioRecording();
      }
      this.cancelRecordingGesture({ keepActiveCapture: true });
      try {
        this.waterEl.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture can disappear when iOS opens a permission prompt.
      }
    };
    const onContextMenu = (event: MouseEvent) => {
      if (this.recordingGesture?.activated || this.audioCapture) {
        event.preventDefault();
      }
    };
    const onWaterClick = (event: MouseEvent) => {
      if (this.suppressNextWaterClick) {
        this.suppressNextWaterClick = false;
        event.preventDefault();
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      if (
        this.state.submitting ||
        target?.closest(recordingTargetSelector)
      ) {
        return;
      }
      this.soundscape?.activate();
      const point = this.getWaterPoint(event);
      if (this.deviceMode === "phone" && this.state.composerOpen) {
        this.dismissPhoneKeyboard();
        this.syncComposerPosition();
        return;
      }
      const destination = this.constrainBoat(point);
      // The composer relocates immediately; its final layout sets the boat's berth.
      this.state.composerAnchor = destination;
      this.openComposer({ focus: true, keepDestination: true });
    };
    const onBoatClick = (event: MouseEvent) => {
      event.stopPropagation();
      this.boatEl.removeClass("is-initial-focus");
      if (this.state.submitting) {
        return;
      }
      this.soundscape?.activate();
      if (this.state.composerOpen) {
        if (this.deviceMode === "phone") {
          this.syncComposerPosition();
          return;
        }
        this.closeComposer({ returnFocus: true });
      } else {
        this.openComposer({ focus: true });
      }
    };
    const onInput = () => this.syncIdeaValueState();
    const onIdeaKeydown = (event: KeyboardEvent) => {
      if (
        shouldSubmitCanvasCreationIdeaKey(event, this.mobileInput) &&
        !this.state.submitting
      ) {
        event.preventDefault();
        void this.submit();
      }
    };
    const onSubmit = (event: SubmitEvent) => {
      event.preventDefault();
      if (!this.state.submitting) {
        void this.submit();
      }
    };
    const onSpeechClick = (event: MouseEvent) => {
      event.preventDefault();
      this.toggleSpeechRecognition();
    };
    const onResize = () => this.handleViewportChange();
    const onMotionChange = (event: MediaQueryListEvent) => {
      this.rootEl.dataset.reducedMotion = String(event.matches);
      this.waterField?.setReducedMotion(event.matches);
      this.soundscape?.setReducedMotion(event.matches);
      this.updateCelestialProjection(performance.now());
      this.scheduleCelestialMotion();
      if (this.deviceMode === "phone") {
        if (event.matches) {
          this.stopPhoneRoaming();
        } else {
          this.schedulePhoneRoam(0);
        }
      }
      this.scheduleMovement();
    };
    const onVisibilityChange = () => {
      this.soundscape?.setSuspended("document-hidden", document.hidden);
    };

    this.waterEl.addEventListener("pointerdown", onPointerDown);
    this.waterEl.addEventListener("pointermove", onPointerMove);
    this.waterEl.addEventListener("pointerup", onPointerEnd);
    this.waterEl.addEventListener("pointercancel", onPointerEnd);
    this.waterEl.addEventListener("pointerleave", onPointerLeave);
    this.waterEl.addEventListener("contextmenu", onContextMenu);
    this.waterEl.addEventListener("click", onWaterClick);
    this.boatEl.addEventListener("click", onBoatClick);
    this.boatEl.addEventListener(
      "keydown",
      () => this.boatEl.removeClass("is-initial-focus"),
      { once: true },
    );
    this.boatEl.addEventListener(
      "blur",
      () => this.boatEl.removeClass("is-initial-focus"),
      { once: true },
    );
    this.ideaEl.addEventListener("input", onInput);
    this.ideaEl.addEventListener("keydown", onIdeaKeydown);
    this.composerEl.addEventListener("submit", onSubmit);
    this.speechEl?.addEventListener("click", onSpeechClick);
    window.addEventListener("resize", onResize);
    window.addEventListener("blur", onPointerLeave);
    window.visualViewport?.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("scroll", onResize);
    this.motionQuery.addEventListener("change", onMotionChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    this.cleanup.push(
      () => this.waterEl.removeEventListener("pointerdown", onPointerDown),
      () => this.waterEl.removeEventListener("pointermove", onPointerMove),
      () => this.waterEl.removeEventListener("pointerup", onPointerEnd),
      () => this.waterEl.removeEventListener("pointercancel", onPointerEnd),
      () => this.waterEl.removeEventListener("pointerleave", onPointerLeave),
      () => this.waterEl.removeEventListener("contextmenu", onContextMenu),
      () => this.waterEl.removeEventListener("click", onWaterClick),
      () => this.boatEl.removeEventListener("click", onBoatClick),
      () => this.ideaEl.removeEventListener("input", onInput),
      () => this.ideaEl.removeEventListener("keydown", onIdeaKeydown),
      () => this.composerEl.removeEventListener("submit", onSubmit),
      () => this.speechEl?.removeEventListener("click", onSpeechClick),
      () => window.removeEventListener("resize", onResize),
      () => window.removeEventListener("blur", onPointerLeave),
      () => window.visualViewport?.removeEventListener("resize", onResize),
      () => window.visualViewport?.removeEventListener("scroll", onResize),
      () => this.motionQuery.removeEventListener("change", onMotionChange),
      () => document.removeEventListener("visibilitychange", onVisibilityChange),
    );
  }

  private announce(message: string): void {
    this.statusEl.setText("");
    window.requestAnimationFrame(() => this.statusEl.setText(message));
  }

  private showSpeechFailureNotice(message: string): void {
    this.announce(message);
    new Notice(message);
  }

  private syncIdeaValueState(): void {
    this.composerEl.toggleClass(
      "has-value",
      Boolean(this.ideaEl.value.trim()),
    );
    this.composerEl.removeClass("is-error");
    this.resizePhoneComposer();
    if (this.state.landed) {
      this.state.landed = false;
      this.composerEl.removeClass("is-landed");
      this.syncComposerPosition();
    }
  }

  private toggleSpeechRecognition(): void {
    if (!shouldShowCanvasCreationSpeechInput(this.deviceMode)) {
      return;
    }
    if (this.state.submitting || this.speechPermissionPending) {
      return;
    }
    if (this.usesAudioRecording()) {
      const message = this.recordedAudioPaths.length
        ? `已保存 ${this.recordedAudioPaths.length} 段录音。继续按住空白水面可以再录一段。`
        : "请按住空白水面录音，松手结束。";
      this.announce(message);
      new Notice(message);
      return;
    }
    if (this.usesSystemKeyboardSpeechInput()) {
      this.openSystemKeyboardSpeechInput();
      return;
    }
    if (this.speechListening) {
      this.stopSpeechRecognition({ announce: true });
      return;
    }
    void this.startSpeechRecognition();
  }

  private usesAudioRecording(): boolean {
    return shouldUseCanvasCreationAudioRecording(this.deviceMode, Platform);
  }

  private cancelRecordingGesture(
    options: { keepActiveCapture?: boolean } = {},
  ): void {
    const gesture = this.recordingGesture;
    if (!gesture) {
      return;
    }
    window.clearTimeout(gesture.timer);
    if (!options.keepActiveCapture) {
      this.audioStartRequestId += 1;
    }
    this.recordingGesture = null;
  }

  private resolvePhoneRecordingBoatTarget(point: { x: number; y: number }): {
    x: number;
    y: number;
  } {
    const rect = this.waterEl.getBoundingClientRect();
    const horizontalOffset = point.x < rect.width * 0.5 ? 38 : -38;
    return this.constrainBoat({
      x: point.x + horizontalOffset,
      y: point.y - 58,
    });
  }

  private async startAudioRecording(
    gesture: CanvasCreationRecordingGesture,
  ): Promise<void> {
    if (!this.usesAudioRecording() || this.audioCapture) {
      return;
    }
    const format = resolveCanvasCreationAudioFormat();
    const mediaDevices = navigator.mediaDevices;
    if (!format || !mediaDevices?.getUserMedia) {
      this.rootEl.removeClass("is-recording-pending", "is-recording");
      this.updateSpeechButton();
      this.showSpeechFailureNotice(formatCanvasCreationAudioError(null));
      this.resumePhoneRoamingAfterRecording();
      return;
    }
    const requestId = (this.audioStartRequestId += 1);
    this.audioStartPendingRequestId = requestId;
    let stream: MediaStream;
    try {
      stream = await mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (error) {
      if (this.audioStartPendingRequestId === requestId) {
        this.audioStartPendingRequestId = null;
      }
      if (requestId !== this.audioStartRequestId) {
        this.resumePhoneRoamingAfterPendingAudioStart();
        return;
      }
      this.rootEl.removeClass("is-recording-pending", "is-recording");
      this.updateSpeechButton();
      this.showSpeechFailureNotice(formatCanvasCreationAudioError(error));
      this.resumePhoneRoamingAfterRecording();
      return;
    }
    if (this.audioStartPendingRequestId === requestId) {
      this.audioStartPendingRequestId = null;
    }
    if (
      requestId !== this.audioStartRequestId ||
      this.recordingGesture !== gesture ||
      !gesture.activated ||
      !this.rootEl.isConnected
    ) {
      stream.getTracks().forEach((track) => track.stop());
      this.rootEl.removeClass("is-recording-pending", "is-recording");
      this.updateSpeechButton();
      if (this.rootEl.isConnected) {
        this.announce("麦克风已经准备好，请再次按住水面录音。");
        new Notice("麦克风已经准备好，请再次按住水面录音。");
      }
      this.resumePhoneRoamingAfterPendingAudioStart();
      return;
    }
    let recorder: MediaRecorder;
    try {
      recorder = format.mimeType
        ? new MediaRecorder(stream, { mimeType: format.mimeType })
        : new MediaRecorder(stream);
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      this.rootEl.removeClass("is-recording-pending", "is-recording");
      this.updateSpeechButton();
      this.showSpeechFailureNotice(formatCanvasCreationAudioError(error));
      this.resumePhoneRoamingAfterRecording();
      return;
    }
    const capture: CanvasCreationAudioCapture = {
      recorder,
      stream,
      chunks: [],
      format,
      startedAt: performance.now(),
    };
    recorder.addEventListener("dataavailable", (event: BlobEvent) => {
      if (event.data.size > 0) {
        capture.chunks.push(event.data);
      }
    });
    recorder.addEventListener("error", () => {
      if (this.audioCapture === capture) {
        void this.finishAudioRecording({ failed: true });
      }
    });
    this.audioCapture = capture;
    try {
      recorder.start(250);
    } catch (error) {
      this.audioCapture = null;
      stream.getTracks().forEach((track) => track.stop());
      this.rootEl.removeClass("is-recording-pending", "is-recording");
      this.updateSpeechButton();
      this.showSpeechFailureNotice(formatCanvasCreationAudioError(error));
      this.resumePhoneRoamingAfterRecording();
      return;
    }
    this.rootEl.removeClass("is-recording-pending");
    this.rootEl.addClass("is-recording");
    this.placeRecordingRipples();
    this.updateSpeechButton();
    this.announce("正在录音。松手结束并保存到 Vault。");
  }

  private async finishAudioRecording(
    options: { failed?: boolean } = {},
  ): Promise<CanvasCreationAudioSaveResult | null> {
    if (this.audioSavingPromise) {
      return this.audioSavingPromise;
    }
    const capture = this.audioCapture;
    const audioStartPending = this.audioStartPendingRequestId !== null;
    this.audioStartRequestId += 1;
    this.rootEl.removeClass("is-recording-pending", "is-recording");
    if (!capture) {
      this.updateSpeechButton();
      if (!audioStartPending) {
        this.resumePhoneRoamingAfterRecording();
      }
      return null;
    }
    this.audioCapture = null;
    this.rootEl.addClass("is-recording-saving");
    this.updateSpeechButton();
    let streamStopped = false;
    const stopStream = () => {
      if (streamStopped) {
        return;
      }
      streamStopped = true;
      capture.stream.getTracks().forEach((track) => track.stop());
    };
    const saving = (async () => {
      try {
        const stopped = new Promise<void>((resolve) => {
          if (capture.recorder.state === "inactive") {
            resolve();
            return;
          }
          capture.recorder.addEventListener("stop", () => resolve(), {
            once: true,
          });
          try {
            capture.recorder.requestData();
          } catch {
            // Some iOS MediaRecorder implementations flush only on stop.
          }
          capture.recorder.stop();
        });
        stopStream();
        this.soundscape?.prepareResumeFromGesture("recording");
        await stopped;
        if (options.failed) {
          throw new Error("录音过程中断了，请重新按住水面录音。");
        }
        const durationMs = Math.max(0, performance.now() - capture.startedAt);
        const mimeType =
          capture.chunks.find((chunk) => chunk.type)?.type ||
          capture.recorder.mimeType ||
          capture.format.mimeType;
        const blob = new Blob(capture.chunks, { type: mimeType });
        const result = await saveCanvasCreationAudioRecording(
          this.app as unknown as CanvasCreationAppLike,
          blob,
          {
            folder: this.options.getDefaultFolder(),
            now: this.options.now?.() ?? new Date(),
            durationMs,
            fallbackExtension: capture.format.extension,
          },
        );
        this.recordedAudioPaths.push(result.path);
        const duration = formatCanvasCreationRecordingDuration(durationMs);
        const message = `录音已保存（${duration}）：${result.path}`;
        this.announce(message);
        new Notice(message);
        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String((error as string | null | undefined) ?? "录音保存失败");
        this.showSpeechFailureNotice(`录音没有保存：${message}`);
        return null;
      } finally {
        stopStream();
        this.rootEl.removeClass("is-recording-saving");
        this.audioSavingPromise = null;
        this.updateSpeechButton();
        this.resumePhoneRoamingAfterRecording();
      }
    })();
    this.audioSavingPromise = saving;
    const result = await saving;
    if (this.closeAfterAudioStops) {
      this.closeAfterAudioStops = false;
      if (result) {
        super.close();
      }
    }
    return result;
  }

  private abortAudioRecording(): void {
    this.audioStartRequestId += 1;
    this.cancelRecordingGesture();
    const capture = this.audioCapture;
    this.audioCapture = null;
    if (capture) {
      try {
        if (capture.recorder.state !== "inactive") {
          capture.recorder.stop();
        }
      } catch {
        // Closing the plugin must still release the microphone tracks.
      }
      capture.stream.getTracks().forEach((track) => track.stop());
    }
    this.rootEl?.removeClass(
      "is-recording-pending",
      "is-recording",
      "is-recording-saving",
    );
  }

  private resumePhoneRoamingAfterRecording(): void {
    this.soundscape?.setSuspended("recording", false);
    if (!this.rootEl?.isConnected || this.deviceMode !== "phone") {
      return;
    }
    if (this.state.targetKind === "recording") {
      this.state.target = null;
      this.state.targetKind = null;
      this.state.boat.speed = 0;
      this.placeBoat();
    }
    this.schedulePhoneRoam(700);
  }

  private resumePhoneRoamingAfterPendingAudioStart(): void {
    if (
      this.audioStartPendingRequestId !== null ||
      this.audioCapture ||
      this.audioSavingPromise ||
      this.recordingGesture?.activated
    ) {
      return;
    }
    this.resumePhoneRoamingAfterRecording();
  }

  private usesSystemKeyboardSpeechInput(): boolean {
    return shouldUseCanvasCreationSystemKeyboardSpeechInput(
      this.deviceMode,
      Platform,
    );
  }

  private openSystemKeyboardSpeechInput(): void {
    this.stopSpeechRecognition({ abort: true, announce: false });
    this.speechPermissionPending = false;
    this.speechListening = false;
    this.updateSpeechButton();
    this.ideaEl.focus();
    this.syncComposerPosition();
    const message = "已打开输入框。请点系统键盘上的麦克风听写。";
    this.announce(message);
    new Notice(message);
  }

  private async startSpeechRecognition(): Promise<void> {
    const startRequestId = (this.speechStartRequestId += 1);
    this.speechPermissionPending = true;
    this.updateSpeechButton();
    this.announce("请允许 Obsidian 使用麦克风。");
    const permission = await requestCanvasCreationMicrophonePermission(
      navigator,
    );
    if (
      startRequestId !== this.speechStartRequestId ||
      this.state.submitting ||
      !this.rootEl.isConnected
    ) {
      return;
    }
    this.speechPermissionPending = false;
    this.updateSpeechButton();
    if (permission !== "granted") {
      const message = formatCanvasCreationSpeechError(permission);
      this.showSpeechFailureNotice(message);
      this.ideaEl.focus();
      return;
    }
    const Recognition = getCanvasCreationSpeechRecognitionConstructor(window);
    if (!Recognition) {
      const message = formatCanvasCreationSpeechError("unsupported");
      this.showSpeechFailureNotice(message);
      this.ideaEl.focus();
      return;
    }
    const recognition = new Recognition();
    let reportedRecognitionFailure = false;
    const reportRecognitionFailure = (reason?: string) => {
      if (reportedRecognitionFailure) {
        return;
      }
      reportedRecognitionFailure = true;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      this.speechRecognition = null;
      this.speechListening = false;
      this.speechPermissionPending = false;
      this.updateSpeechButton();
      const message = formatCanvasCreationSpeechError(reason, {
        microphoneGranted: true,
      });
      this.showSpeechFailureNotice(message);
    };
    recognition.lang = navigator.language || "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = extractCanvasCreationSpeechTranscript(event);
      if (!transcript) {
        return;
      }
      this.ideaEl.value = appendCanvasCreationSpeechTranscript(
        this.ideaEl.value,
        transcript,
      );
      this.syncIdeaValueState();
      this.ideaEl.focus();
      this.announce("已把语音放进想法。");
    };
    recognition.onerror = (event) => {
      if (this.speechRecognition !== recognition) {
        return;
      }
      reportRecognitionFailure(event.error);
    };
    recognition.onend = () => {
      if (
        reportedRecognitionFailure ||
        this.speechRecognition !== recognition
      ) {
        return;
      }
      const wasListening = this.speechListening;
      this.speechRecognition = null;
      this.speechListening = false;
      this.speechPermissionPending = false;
      this.updateSpeechButton();
      if (wasListening) {
        this.announce("语音输入已停止。");
      }
    };
    this.speechRecognition = recognition;
    try {
      recognition.start();
    } catch (error) {
      reportRecognitionFailure(
        error instanceof DOMException ? error.name : undefined,
      );
      return;
    }
    if (
      reportedRecognitionFailure ||
      startRequestId !== this.speechStartRequestId ||
      this.speechRecognition !== recognition ||
      this.state.submitting ||
      !this.rootEl.isConnected
    ) {
      return;
    }
    this.speechListening = true;
    this.speechPermissionPending = false;
    this.updateSpeechButton();
    this.announce("正在听写。说完后再点一次麦克风停止。");
  }

  private stopSpeechRecognition(
    options: { abort?: boolean; announce?: boolean } = {},
  ): void {
    const recognition = this.speechRecognition;
    this.speechStartRequestId += 1;
    this.speechPermissionPending = false;
    if (!recognition) {
      this.updateSpeechButton();
      return;
    }
    if (options.abort) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      this.speechRecognition = null;
      this.speechListening = false;
      this.speechPermissionPending = false;
      this.updateSpeechButton();
      try {
        recognition.abort();
      } catch {
        // The browser may already have ended the recognition session.
      }
      return;
    }
    try {
      recognition.stop();
      if (options.announce) {
        this.announce("正在结束听写。");
      }
    } catch {
      this.speechRecognition = null;
      this.speechListening = false;
      this.speechPermissionPending = false;
      this.updateSpeechButton();
      if (options.announce) {
        this.announce("语音输入已停止。");
      }
    }
  }

  private updateSpeechButton(): void {
    if (!this.speechEl) {
      return;
    }
    if (this.usesAudioRecording()) {
      const recording = Boolean(this.audioCapture);
      const pending = this.rootEl.hasClass("is-recording-pending");
      const saving = Boolean(this.audioSavingPromise);
      this.composerEl.toggleClass("is-listening", recording);
      this.speechEl.toggleClass("is-listening", recording);
      this.speechEl.toggleClass("is-pending", pending || saving);
      this.speechEl.disabled = this.state.submitting || saving;
      this.speechEl.setAttribute(
        "aria-pressed",
        String(recording || pending || saving),
      );
      this.speechEl.setAttribute(
        "aria-label",
        saving
          ? "正在保存录音"
          : recording
            ? "松手结束录音"
            : pending
              ? "正在准备录音"
              : this.recordedAudioPaths.length
                ? `已保存 ${this.recordedAudioPaths.length} 段录音，按住水面继续录音`
                : "按住水面录音",
      );
      this.speechEl.empty();
      setIcon(
        this.speechEl,
        saving || pending
          ? "loader-circle"
          : recording
            ? "square"
            : this.recordedAudioPaths.length
              ? "audio-lines"
              : "mic",
      );
      return;
    }
    this.composerEl.toggleClass("is-listening", this.speechListening);
    this.speechEl.toggleClass("is-listening", this.speechListening);
    this.speechEl.toggleClass("is-pending", this.speechPermissionPending);
    this.speechEl.disabled =
      this.state.submitting || this.speechPermissionPending;
    this.speechEl.setAttribute(
      "aria-pressed",
      String(this.speechListening || this.speechPermissionPending),
    );
    this.speechEl.setAttribute(
      "aria-label",
      this.speechPermissionPending
        ? "正在请求麦克风权限"
        : this.speechListening
          ? "停止语音输入"
          : this.usesSystemKeyboardSpeechInput()
            ? "用系统键盘听写"
            : "说出想法",
    );
    this.speechEl.empty();
    setIcon(
      this.speechEl,
      this.speechPermissionPending
        ? "loader-circle"
        : this.speechListening
          ? "square"
          : "mic",
    );
  }

  private getWaterPoint(
    event: Pick<PointerEvent | MouseEvent, "clientX" | "clientY">,
  ): { x: number; y: number } {
    const rect = this.waterEl.getBoundingClientRect();
    return {
      x: clampWaterValue(event.clientX - rect.left, 0, rect.width),
      y: clampWaterValue(event.clientY - rect.top, 0, rect.height),
    };
  }

  private getBoatLimits(): {
    minimumX: number;
    maximumX: number;
    minimumY: number;
    maximumY: number;
  } {
    const rect = this.waterEl.getBoundingClientRect();
    const hitRadius = this.boatEl.offsetWidth * 0.5;
    // The header's blank area is navigable water. Only the viewport edge
    // constrains the boat; the header controls handle their own pointer hits.
    return {
      minimumX: hitRadius,
      maximumX: Math.max(hitRadius, rect.width - hitRadius),
      minimumY: hitRadius,
      maximumY: Math.max(hitRadius, rect.height - hitRadius),
    };
  }

  private constrainBoat(point: { x: number; y: number }): {
    x: number;
    y: number;
  } {
    const limits = this.getBoatLimits();
    return {
      x: clampWaterValue(point.x, limits.minimumX, limits.maximumX),
      y: clampWaterValue(point.y, limits.minimumY, limits.maximumY),
    };
  }

  private placeBoat(): void {
    const boat = {
      ...this.state.boat,
      x: this.state.boat.x - Math.sin(this.state.boat.heading) * this.mooringFrame.offset,
      y: this.state.boat.y + Math.cos(this.state.boat.heading) * this.mooringFrame.offset,
      heading: this.state.boat.heading + this.mooringFrame.heading,
      roll: this.mooringFrame.roll,
    };
    this.boatEl.style.transform = [
      `translate3d(${boat.x - this.boatEl.offsetWidth * 0.5}px,`,
      `${boat.y - this.boatEl.offsetHeight * 0.5}px, 0)`,
    ].join(" ");
    this.boatEl.style.setProperty(
      "--wb-entry-boat-heading",
      `${boat.heading + Math.PI * 0.5}rad`,
    );
    this.placeRecordingRipples();
    this.renderWaterFocus();
    // Enable local water coloring only after docking; setBoat supplies its live sway.
    this.waterField?.setMooring(
      this.deviceMode !== "phone" && this.state.composerOpen && !this.state.target
        ? { x: this.state.boat.x, y: this.state.boat.y }
        : null,
    );
    this.waterField?.setBoat(boat);
    this.soundscape?.setBoatSpeed(this.state.boat.speed);
    this.boatRenderer?.setHeading(boat.heading);
  }

  private placeRecordingRipples(): void {
    if (!this.recordingRipplesEl) {
      return;
    }
    this.recordingRipplesEl.style.transform = `translate3d(${this.state.boat.x}px, ${this.state.boat.y}px, 0)`;
  }

  private updateCelestialProjection(timestamp: number): void {
    this.mooringFrame = this.mooringMotion.sample(
      timestamp,
      this.deviceMode !== "phone" && this.state.composerOpen && !this.state.target,
      this.motionQuery.matches,
    );
    if (this.boatEl) this.placeBoat();
    applyCanvasCreationCelestialProjection(this.rootEl, {
      elapsedSeconds: Math.max(0, timestamp - this.celestialStartedAt) / 1000,
      lightIntensity: this.options.getLightIntensity?.(),
      waterDepth: this.options.getWaterDepth?.(),
      reducedMotion: this.motionQuery.matches,
      deviceMode: this.deviceMode,
    });
    const lightIntensity = this.options.getLightIntensity?.();
    const projection = sampleCanvasCreationCelestialProjection({
      elapsedSeconds: Math.max(0, timestamp - this.celestialStartedAt) / 1000,
      light: this.rootEl.dataset.celestialLight === "moon" ? "moon" : "sun",
      lightIntensity,
      waterDepth: this.options.getWaterDepth?.(),
      reducedMotion: this.motionQuery.matches,
    });
    const night = projection.light === "moon";
    // The moonlit rim faces the source, opposite the cast-shadow direction.
    // Keep the CSS fallback on the same moving angle as the WebGL key light.
    const rimAngle = (projection.angleDeg * Math.PI) / 180;
    this.rootEl.style.setProperty(
      "--wb-entry-boat-rim-offset-x",
      `${Math.sin(rimAngle) * 0.9}px`,
    );
    this.rootEl.style.setProperty(
      "--wb-entry-boat-rim-offset-y",
      `${-Math.cos(rimAngle) * 0.9}px`,
    );
    this.rootEl.style.setProperty(
      "--wb-entry-boat-rim-angle",
      `${projection.angleDeg + 90}deg`,
    );
    this.boatRenderer?.render({
      angleDeg: projection.angleDeg,
      elevation: projection.elevation,
      lightIntensity: Number(this.rootEl.dataset.celestialLightIntensity ?? lightIntensity ?? 1),
      night,
      visibility: night ? 0.72 : 1,
      seconds: Math.max(0, timestamp - this.celestialStartedAt) / 1000,
      reducedMotion: this.motionQuery.matches,
      mooringRoll: this.mooringFrame.roll,
    });
  }

  private scheduleCelestialMotion(): void {
    if (this.celestialFrameId !== null || this.motionQuery.matches) {
      return;
    }
    this.celestialFrameId = window.requestAnimationFrame((timestamp) => {
      this.celestialFrameId = null;
      if (!this.rootEl.isConnected) {
        return;
      }
      this.updateCelestialProjection(timestamp);
      this.scheduleCelestialMotion();
    });
  }

  private refreshWaterGeometry(): void {
    this.syncStageViewportFrame();
    this.waterField?.resize();
    this.resetLayout();
  }

  private scheduleWaterGeometryRefresh(): void {
    const refresh = () => {
      if (!this.rootEl.isConnected) {
        return;
      }
      this.syncStageViewportFrame();
      this.refreshWaterGeometry();
    };
    window.requestAnimationFrame(() => {
      refresh();
      window.requestAnimationFrame(refresh);
    });
    const timeoutId = window.setTimeout(refresh, 280);
    this.cleanup.push(() => window.clearTimeout(timeoutId));
  }

  private handleViewportChange(): void {
    this.refreshWaterGeometry();
    if (this.deviceMode === "phone") {
      this.followVisualViewportAnimation();
    }
  }

  private getComposerPosition(): { x: number; y: number } {
    const waterRect = this.waterEl.getBoundingClientRect();
    const margin = waterRect.width < 640 ? 12 : 24;
    const anchor = this.state.composerAnchor ?? this.state.boat;
    const preferredX = anchor.x + CANVAS_CREATION_COMPOSER_OFFSET.x;
    const preferredY = anchor.y + CANVAS_CREATION_COMPOSER_OFFSET.y;
    const headerHeight = resolveCanvasCreationCssPixels(
      this.rootEl,
      "--wb-entry-header-height",
      "96px",
    );
    const visualViewport = this.mobileInput ? window.visualViewport : null;
    const visibleLeft = visualViewport
      ? clampWaterValue(
          visualViewport.offsetLeft - waterRect.left,
          0,
          waterRect.width,
        )
      : 0;
    const visibleTop = visualViewport
      ? clampWaterValue(
          visualViewport.offsetTop - waterRect.top,
          0,
          waterRect.height,
        )
      : 0;
    const visibleRight = visualViewport
      ? Math.min(waterRect.width, visibleLeft + visualViewport.width)
      : waterRect.width;
    const visibleBottom = visualViewport
      ? Math.min(waterRect.height, visibleTop + visualViewport.height)
      : waterRect.height;
    if (this.deviceMode === "phone") {
      const rootStyle = getComputedStyle(this.rootEl);
      const safeLeft =
        Number.parseFloat(
          rootStyle.getPropertyValue("--safe-area-inset-left"),
        ) || 0;
      const safeRight =
        Number.parseFloat(
          rootStyle.getPropertyValue("--safe-area-inset-right"),
        ) || 0;
      const safeBottom =
        Number.parseFloat(
          rootStyle.getPropertyValue("--safe-area-inset-bottom"),
        ) || 0;
      const leftGap = Math.max(12, safeLeft);
      const rightGap = Math.max(12, safeRight);
      const bottomGap = Math.max(12, safeBottom + 8);
      const width = Math.max(
        0,
        visibleRight - visibleLeft - leftGap - rightGap,
      );
      this.composerEl.style.width = `${width}px`;
      return {
        x: visibleLeft + leftGap,
        y: Math.max(
          visibleTop + 12,
          visibleBottom - this.composerEl.offsetHeight - bottomGap,
        ),
      };
    }
    this.composerEl.style.removeProperty("width");
    const minimumX = visibleLeft + margin;
    const minimumY = Math.max(headerHeight + 12, visibleTop + 12);
    return {
      x: clampWaterValue(
        preferredX,
        minimumX,
        Math.max(minimumX, visibleRight - this.composerEl.offsetWidth - margin),
      ),
      y: clampWaterValue(
        preferredY,
        minimumY,
        Math.max(
          minimumY,
          visibleBottom - this.composerEl.offsetHeight - margin,
        ),
      ),
    };
  }

  private fitComposerToVisualViewport(): void {
    const visualViewport = this.mobileInput ? window.visualViewport : null;
    if (this.deviceMode === "phone") {
      this.composerEl.style.removeProperty("height");
      return;
    }
    if (!visualViewport) {
      this.composerEl.style.removeProperty("height");
      return;
    }
    const waterRect = this.waterEl.getBoundingClientRect();
    const headerHeight = resolveCanvasCreationCssPixels(
      this.rootEl,
      "--wb-entry-header-height",
      "96px",
    );
    const visibleTop = clampWaterValue(
      visualViewport.offsetTop - waterRect.top,
      0,
      waterRect.height,
    );
    const visibleBottom = Math.min(
      waterRect.height,
      visibleTop + visualViewport.height,
    );
    const availableHeight =
      visibleBottom - Math.max(headerHeight + 12, visibleTop + 12) - 12;
    const configuredHeight =
      Number.parseFloat(
        getComputedStyle(this.rootEl).getPropertyValue(
          "--wb-entry-composer-height",
        ),
      ) || 224;
    this.composerEl.style.height = `${Math.min(
      configuredHeight,
      Math.max(132, availableHeight),
    )}px`;
  }

  private syncComposerPosition(): void {
    if (!this.state.composerOpen) {
      return;
    }
    this.fitComposerToVisualViewport();
    const position = this.getComposerPosition();
    this.composerEl.style.left = `${position.x}px`;
    this.composerEl.style.top = `${position.y}px`;
    if (this.deviceMode !== "phone") {
      // Dock beside the actual card, including when its position is clamped
      // near a viewport edge. The logical anchor stays independent of travel.
      const destination = this.constrainBoat({
        x: position.x - CANVAS_CREATION_COMPOSER_OFFSET.x,
        y: position.y - CANVAS_CREATION_COMPOSER_OFFSET.y,
      });
      const target = this.state.target;
      const needsTravel = target !== null ||
        Math.hypot(destination.x - this.state.boat.x, destination.y - this.state.boat.y) > 0.5;
      const sameTarget = this.state.targetKind === "click" && target &&
        Math.hypot(destination.x - target.x, destination.y - target.y) <= 0.5;
      if (needsTravel && !sameTarget) this.sailBoatTo(destination, "click");
      this.syncWaterFocus(position, destination);
    }
  }

  /** Centre the focus veil on the composer card plus its moored boat. */
  private syncWaterFocus(
    position: { x: number; y: number },
    dock: { x: number; y: number },
  ): void {
    this.waterFocus.anchor = {
      left: Math.min(position.x, dock.x),
      top: Math.min(position.y, dock.y),
      right: position.x + this.composerEl.offsetWidth,
      bottom: Math.max(position.y + this.composerEl.offsetHeight, dock.y),
      dock,
    };
    this.renderWaterFocus();
  }

  private setWaterFocus(focused: boolean): void {
    this.rootEl.dataset.waterFocus = focused ? "focused" : "clear";
    const focus = this.waterFocus;
    if (focus.active === focused) return;
    focus.active = focused;
    const view = this.focusVeilEl?.ownerDocument?.defaultView;
    if (focused && view) {
      focus.padding = Number.parseFloat(
        view.getComputedStyle(this.focusVeilEl).getPropertyValue("--wb-entry-water-focus-padding"),
      ) || 0;
    }
    focus.from = focus.amount;
    focus.startedAt = performance.now();
    const dock = focus.anchor?.dock;
    focus.startDistance = dock
      ? Math.hypot(dock.x - this.state.boat.x, dock.y - this.state.boat.y)
      : 0;
    this.renderWaterFocus();
  }

  /**
   * The blur never outruns the boat: it deepens with the boat's progress
   * toward the dock (and no faster than the settle duration), and the clear
   * area keeps the sailing boat and its fresh wake sharp until it moors.
   */
  private renderWaterFocus(now = performance.now()): void {
    const focus = this.waterFocus;
    const veil = this.focusVeilEl;
    if (!veil || !focus.anchor) return;
    const boat = this.state.boat;
    const reduced = this.motionQuery.matches;
    if (focus.active) {
      const dock = focus.anchor.dock;
      const sailing = this.state.target !== null;
      const voyage = !sailing || focus.startDistance < 1
        ? 1
        : clampWaterValue(
          1 - Math.hypot(dock.x - boat.x, dock.y - boat.y) / focus.startDistance,
          0,
          1,
        );
      const time = clampWaterValue(
        (now - focus.startedAt) / CANVAS_CREATION_WATER_FOCUS_ENTER_MS,
        0,
        1,
      );
      // Only the time cap is eased; the voyage share stays linear so the blur
      // never gets ahead of the boat and the wake it is still drawing.
      const progress = reduced ? 1 : Math.min(voyage, 1 - Math.pow(1 - time, 3));
      focus.amount = Math.max(focus.amount, focus.from + (1 - focus.from) * progress);
    } else {
      const time = reduced
        ? 1
        : clampWaterValue((now - focus.startedAt) / CANVAS_CREATION_WATER_FOCUS_RELEASE_MS, 0, 1);
      const eased = time < 0.5 ? 4 * time ** 3 : 1 - Math.pow(-2 * time + 2, 3) / 2;
      focus.amount = focus.from * (1 - eased);
    }
    const radius = (this.boatEl?.offsetWidth ?? 0) * 0.5;
    const left = Math.min(focus.anchor.left, boat.x - radius);
    const right = Math.max(focus.anchor.right, boat.x + radius);
    const top = Math.min(focus.anchor.top, boat.y - radius);
    const bottom = Math.max(focus.anchor.bottom, boat.y + radius);
    const x = (left + right) / 2;
    const y = (top + bottom) / 2;
    // The ellipse is inscribed in the box, so a boat near a corner can fall
    // outside it; grow the ellipse until the boat is always clear.
    const reach = Math.max(
      1,
      Math.hypot((boat.x - x) / ((right - left) / 2 || 1), (boat.y - y) / ((bottom - top) / 2 || 1)),
    );
    const rx = ((right - left) / 2) * reach;
    const ry = ((bottom - top) / 2) * reach;
    veil.style.setProperty("--wb-entry-water-focus-x", `${x}px`);
    veil.style.setProperty("--wb-entry-water-focus-y", `${y}px`);
    veil.style.setProperty("--wb-entry-water-focus-rx", `${rx}px`);
    veil.style.setProperty("--wb-entry-water-focus-ry", `${ry}px`);
    veil.style.setProperty("--wb-entry-water-focus-amount", focus.amount.toFixed(4));
    // The background recedes by fading the water dashes themselves, on the
    // same clear area and ramp as the blur; no colour layer is drawn on top.
    this.waterField?.setFocus(focus.amount > 0
      ? { x, y, rx, ry, padding: focus.padding, amount: focus.amount }
      : null);
  }

  private resizePhoneComposer(): void {
    if (this.deviceMode !== "phone") {
      return;
    }
    this.ideaEl.style.removeProperty("height");
    this.ideaEl.classList.add("whiteboat-canvas-entry__idea-measuring");
    const height = clampWaterValue(this.ideaEl.scrollHeight, 48, 128);
    this.ideaEl.classList.remove("whiteboat-canvas-entry__idea-measuring");
    this.ideaEl.style.height = `${height}px`;
    this.ideaEl.style.overflowY =
      this.ideaEl.scrollHeight > height ? "auto" : "hidden";
    this.syncComposerPosition();
  }

  private openComposer(
    options: { focus?: boolean; keepDestination?: boolean } = {},
  ): void {
    this.composerMotion?.reset();
    const outgoing = this.state.composerOpen
      ? this.composerMotion?.leavePicture() ?? null
      : null;
    if (!options.keepDestination) {
      this.stopFollowingPointer();
      this.state.composerAnchor = {
        x: this.state.boat.x,
        y: this.state.boat.y,
      };
    }
    this.state.composerOpen = true;
    if (this.deviceMode !== "phone") {
      this.waterField?.setFlowPaused(true);
      this.rootEl.dataset.waterBackground = "paused";
      this.placeBoat();
    }
    this.state.landed = false;
    this.composerEl.addClass("is-open");
    this.composerEl.removeClass("is-landed", "is-error");
    this.composerEl.setAttribute("aria-hidden", "false");
    this.composerEl.inert = false;
    this.resizePhoneComposer();
    this.syncComposerPosition();
    if (this.deviceMode !== "phone") this.setWaterFocus(true);
    const appearance = this.composerMotion?.appear(outgoing);
    this.announce(this.t("composerOpened"));
    if (options.focus !== false) {
      this.ideaEl.focus({ preventScroll: true });
      void appearance?.then(() => {
        // Obsidian's modal focus trap can return focus to the boat while the
        // entering input has zero opacity. Restore only that fallback focus.
        if (this.rootEl.isConnected && this.state.composerOpen &&
            !this.state.submitting && document.activeElement === this.boatEl) {
          this.ideaEl.focus({ preventScroll: true });
        }
      });
    }
  }

  private closeComposer(options: { returnFocus?: boolean } = {}): void {
    this.state.composerOpen = false;
    this.waterField?.setMooring(null);
    this.waterField?.setFlowPaused(false);
    this.rootEl.dataset.waterBackground = "flowing";
    this.setWaterFocus(false);
    this.state.landed = false;
    this.composerEl.removeClass("is-open", "is-landed", "is-error");
    this.composerEl.setAttribute("aria-hidden", "true");
    this.composerEl.inert = true;
    this.composerMotion?.cancel();
    this.state.composerAnchor = null;
    this.announce(this.t("composerClosed"));
    if (options.returnFocus) {
      this.boatEl.removeClass("is-initial-focus");
      this.boatEl.focus();
    }
  }

  private followPointer(point: { x: number; y: number }): void {
    this.sailBoatTo(point, "pointer");
  }

  private continueFollowingPointer(): void {
    if (
      this.state.targetKind !== "pointer" ||
      !this.state.target ||
      this.motionQuery.matches ||
      !shouldCanvasCreationBoatFollowPointer(
        this.deviceMode,
        this.state.composerOpen,
        this.state.submitting,
      )
    ) {
      return;
    }
    const { boat, target } = this.state;
    const dx = target.x - boat.x;
    const dy = target.y - boat.y;
    if (Math.hypot(dx, dy) < 0.000001) return;
    const limits = this.getBoatLimits();
    // Extend the last sailing direction to the first viewport edge, rather
    // than clamping an arbitrary distant point and changing the heading.
    const xScale = dx === 0 ? Infinity :
      ((dx > 0 ? limits.maximumX : limits.minimumX) - boat.x) / dx;
    const yScale = dy === 0 ? Infinity :
      ((dy > 0 ? limits.maximumY : limits.minimumY) - boat.y) / dy;
    const scale = Math.max(0, Math.min(xScale, yScale));
    this.sailBoatTo({
      x: boat.x + dx * scale,
      y: boat.y + dy * scale,
    }, "coast");
  }

  private stopFollowingPointer(): void {
    if (this.state.targetKind === "pointer" || this.state.targetKind === "coast") {
      this.state.target = null;
      this.state.targetKind = null;
      this.state.boat.speed = 0;
      this.placeBoat();
    }
  }

  private sailBoatTo(
    point: { x: number; y: number },
    kind: "pointer" | "coast" | "click" | "roam" | "recording",
  ): void {
    this.state.target =
      this.deviceMode === "phone" && kind === "roam"
        ? this.constrainPhoneRoamTarget(point)
        : this.constrainBoat(point);
    this.state.targetKind = kind;
    this.waterField?.setMooring(null);
    if (this.state.frameId === null) {
      this.state.lastFrameAt = performance.now();
    }
    this.scheduleMovement();
  }

  private scheduleMovement(): void {
    if (this.state.frameId !== null) {
      return;
    }
    this.state.frameId = window.requestAnimationFrame((timestamp) =>
      this.updateMovement(timestamp),
    );
  }

  private updateMovement(timestamp: number): void {
    this.state.frameId = null;
    const deltaSeconds = clampWaterValue(
      (timestamp - this.state.lastFrameAt) / 1000,
      0,
      0.05,
    );
    this.state.lastFrameAt = timestamp;
    if (!this.state.target) {
      this.state.boat.speed = 0;
      this.placeBoat();
      return;
    }
    const step = advanceCanvasCreationBoatFollow({
      boat: this.state.boat,
      target: this.state.target,
      deltaSeconds,
      reducedMotion: this.motionQuery.matches,
      maximumSpeed:
        (this.deviceMode === "phone" && this.state.targetKind === "roam"
          ? 42
          : 180) *
        normalizeCanvasCreationBoatFollowSpeed(
          this.options.getBoatFollowSpeed?.(),
        ),
      slowingDistance:
        this.deviceMode === "phone" && this.state.targetKind === "roam"
          ? 56
          : undefined,
    });
    this.state.boat = step.boat;
    if (step.arrived) {
      const arrivedKind = this.state.targetKind;
      this.state.target = null;
      this.state.targetKind = null;
      this.placeBoat();
      if (arrivedKind === "roam") {
        this.schedulePhoneRoam(700);
      }
      return;
    }
    this.placeBoat();
    this.scheduleMovement();
  }

  private clearPhoneRoamTimer(): void {
    if (this.phoneRoamTimer === null) {
      return;
    }
    window.clearTimeout(this.phoneRoamTimer);
    this.phoneRoamTimer = null;
  }

  private stopPhoneRoaming(): void {
    this.clearPhoneRoamTimer();
    if (this.state.targetKind === "roam") {
      this.state.target = null;
      this.state.targetKind = null;
      this.state.boat.speed = 0;
      this.placeBoat();
    }
  }

  private schedulePhoneRoam(delayMs: number): void {
    if (
      this.deviceMode !== "phone" ||
      this.motionQuery.matches ||
      this.state.submitting ||
      Boolean(this.recordingGesture?.activated) ||
      Boolean(this.audioCapture) ||
      Boolean(this.audioSavingPromise) ||
      this.phoneRoamTimer !== null ||
      this.state.targetKind === "roam" ||
      this.state.targetKind === "recording"
    ) {
      return;
    }
    this.phoneRoamTimer = window.setTimeout(
      () => {
        this.phoneRoamTimer = null;
        if (
          !this.boatEl.isConnected ||
          this.deviceMode !== "phone" ||
          this.motionQuery.matches ||
          this.state.submitting ||
          Boolean(this.recordingGesture?.activated) ||
          Boolean(this.audioCapture) ||
          Boolean(this.audioSavingPromise)
        ) {
          return;
        }
        this.sailBoatTo(
          sampleCanvasCreationPhoneRoamTarget(this.getPhoneRoamLimits(), {
            current: this.state.boat,
            minimumTravel: Math.min(this.waterEl.offsetWidth, 420) * 0.22,
          }),
          "roam",
        );
      },
      Math.max(0, delayMs),
    );
  }

  private resetLayout(): void {
    const rect = this.waterEl.getBoundingClientRect();
    if (this.state.boat.x === 0 && this.state.boat.y === 0) {
      if (this.deviceMode === "phone") {
        const initialRandom = (() => {
          const values = [0.12, 0, 0.12, 0.32];
          let index = 0;
          return () => values[index++] ?? 0.32;
        })();
        const initial = sampleCanvasCreationPhoneRoamTarget(
          this.getPhoneRoamLimits(),
          { random: initialRandom },
        );
        this.state.boat.x = initial.x;
        this.state.boat.y = initial.y;
        this.state.boat.heading = 0;
      } else {
        this.state.boat.x = rect.width * 0.43;
        this.state.boat.y = rect.height * 0.5233;
      }
    } else {
      const position =
        this.deviceMode === "phone"
          ? this.constrainPhoneRoamTarget(this.state.boat)
          : this.constrainBoat(this.state.boat);
      this.state.boat.x = position.x;
      this.state.boat.y = position.y;
    }
    if (this.state.composerAnchor) {
      this.state.composerAnchor = this.constrainBoat(this.state.composerAnchor);
    }
    if (this.state.targetKind === "coast" && this.state.target) {
      this.state.target = this.constrainBoat(this.state.target);
    }
    this.placeBoat();
    this.syncComposerPosition();
  }

  private dismissPhoneKeyboard(): void {
    if (document.activeElement === this.ideaEl) {
      this.ideaEl.blur();
      this.followVisualViewportAnimation(720);
    }
  }

  private getPhoneRoamLimits(): {
    minimumX: number;
    maximumX: number;
    minimumY: number;
    maximumY: number;
    preferredMaximumY: number;
  } {
    const rect = this.waterEl.getBoundingClientRect();
    const visibleLimits = this.getBoatLimits();
    const offscreenX = this.boatEl.offsetWidth * 0.5 + 4;
    const composerRect = this.composerEl.getBoundingClientRect();
    const composerTop =
      this.state.composerOpen && composerRect.height > 0
        ? composerRect.top - rect.top
        : rect.height - 84;
    const boatRadius = this.boatEl.offsetHeight * 0.5;
    const preferredMaximumY = clampWaterValue(
      composerTop - boatRadius * 0.75,
      visibleLimits.minimumY,
      visibleLimits.maximumY,
    );
    return {
      ...visibleLimits,
      minimumX: -offscreenX,
      maximumX: rect.width + offscreenX,
      preferredMaximumY,
    };
  }

  private constrainPhoneRoamTarget(point: { x: number; y: number }): {
    x: number;
    y: number;
  } {
    const limits = this.getPhoneRoamLimits();
    return {
      x: clampWaterValue(point.x, limits.minimumX, limits.maximumX),
      y: clampWaterValue(point.y, limits.minimumY, limits.maximumY),
    };
  }

  private followVisualViewportAnimation(durationMs = 520): void {
    if (this.deviceMode !== "phone") {
      return;
    }
    this.viewportFollowUntil = Math.max(
      this.viewportFollowUntil,
      performance.now() + durationMs,
    );
    if (this.viewportFollowFrame !== null) {
      return;
    }
    const tick = (timestamp: number) => {
      this.viewportFollowFrame = null;
      if (!this.rootEl.isConnected) {
        return;
      }
      this.syncStageViewportFrame();
      this.syncComposerPosition();
      if (timestamp < this.viewportFollowUntil) {
        this.viewportFollowFrame = window.requestAnimationFrame(tick);
      }
    };
    this.viewportFollowFrame = window.requestAnimationFrame(tick);
  }

  /** Align only the newly created host view while Home still covers it. */
  private async prepareCanvasReveal(result: CanvasCreationResult): Promise<{surface: HTMLElement; center: {x: number; y: number}} | undefined> {
    if (!result.firstNodeId || !this.modalContainerEl || this.motionQuery.matches) return;
    const runtime=new CanvasRuntimeAdapter(this.app as unknown as ObsidianAppLike);
    const intended=this.composerMotion?.impactCenter();
    if (!intended) return;
    const deadline=performance.now()+1500;
    const frame=()=>new Promise<void>(resolve=>window.setTimeout(resolve,32));
    while (this.rootEl.isConnected && performance.now()<deadline) {
      const view=runtime.getCanvasViewByPath(result.path);
      const node=runtime.findRuntimeNodeById(view,result.firstNodeId);
      const element=node?.nodeEl;
      const rect=element?.getBoundingClientRect?.();
      const canvas=view?.canvas as (RuntimeCanvasLike & {x?: number; y?: number; scale?: number; panTo?: (x: number,y: number)=>void}) | undefined;
      const bounds=canvas?.wrapperEl?.getBoundingClientRect?.();
      if (element?.isConnected && rect?.width && rect.height && bounds?.width && bounds.height) {
        // Native initial-fit work must settle before applying the initial view.
        await frame();await frame();
        if (!this.rootEl.isConnected) return;
        const current=element.getBoundingClientRect!();
        const clamp=(value: number,low: number,high: number)=>low>high?(low+high)/2:Math.max(low,Math.min(high,value));
        const target={
          x:clamp(intended.x,bounds.left+current.width/2+24,bounds.right-current.width/2-24),
          y:clamp(intended.y,bounds.top+current.height/2+24,bounds.bottom-current.height/2-24),
        };
        if (canvas?.panTo && Number.isFinite(canvas.x) && Number.isFinite(canvas.y) && canvas.scale!>0) {
          canvas.panTo(canvas.x!+(current.left+current.width/2-target.x)/canvas.scale!,canvas.y!+(current.top+current.height/2-target.y)/canvas.scale!);
          await frame();await frame();
        }
        if (!this.rootEl.isConnected || !this.modalContainerEl || !element.isConnected) return;
        const actual=element.getBoundingClientRect!();
        return {surface:this.modalContainerEl,center:{x:actual.left+actual.width/2,y:actual.top+actual.height/2}};
      }
      await frame();
    }
    // Older/slow host runtimes retain ordinary opening; never create a second file.
    return;
  }

  private async submit(): Promise<void> {
    if (this.state.submitting) return;
    void this.soundscape?.prepareIdeaDropAudio();
    this.stopSpeechRecognition({ abort: true, announce: false });
    this.state.submitting = true;
    const idea = this.ideaEl.value;
    this.ideaEl.readOnly = true;
    this.updateSpeechButton();
    this.cancelRecordingGesture();
    if (this.audioCapture) {
      await this.finishAudioRecording();
    } else if (this.audioSavingPromise) {
      await this.audioSavingPromise;
    }
    if (!this.rootEl.isConnected) return;
    this.state.landed = false;
    this.composerEl.addClass("is-submitting");
    this.composerEl.removeClass("is-error");
    this.submitEl.disabled = true;
    if (this.speechEl) {
      this.speechEl.disabled = true;
    }
    if (this.deviceMode === "phone") {
      this.submitEl.empty();
      setIcon(this.submitEl, "loader-circle");
      this.submitEl.setAttribute("aria-label", this.t("creatingLabel"));
    } else {
      this.submitEl.setText(this.t("creating"));
    }
    this.syncComposerPosition();
    this.announce(this.t("creatingNotice"));
    try {
      this.composerEl.inert = true;
      this.composerMotion?.reset();
      const result = await createAndOpenCanvasFromEntry(
        this.app as unknown as CanvasCreationAppLike,
        idea,
        {
          folder: this.options.getDefaultFolder(),
          now: this.options.now?.() ?? new Date(),
          nodeSize: this.options.getDefaultTextNodeSize(),
          audioPaths: [...this.recordedAudioPaths],
          isActive: () => this.rootEl.isConnected,
          text: this.t,
        },
      );
      if (!this.rootEl.isConnected) return;
      if (!result.opened) {
        const message = result.openError || this.t("workspaceUnavailable");
        this.announce(this.t("createdNotOpened", { path: result.path }));
        new Notice(
          this.t("createdNotOpenedDetail", { path: result.path, message }),
        );
        this.closeEntry();
        return;
      }
      // All following work is presentation of a saved file. Its failure must
      // never return to a retry action that would create a duplicate Canvas.
      try {
        const reveal=await this.prepareCanvasReveal(result);
        if (!this.rootEl.isConnected) return;
        // Let the drop ripple travel over clear water.
        this.setWaterFocus(false);
        await this.composerMotion?.confirm(result.seeded,reveal);
      } catch { this.composerMotion?.reset(); }
      if (!this.rootEl.isConnected) return;
      new Notice(this.t("created", { path: result.path }));
      this.closeEntry();
    } catch (error) {
      if (!this.rootEl.isConnected) return;
      const message = error instanceof Error ? error.message : String(error);
      this.state.submitting = false;
      this.state.landed = false;
      this.composerMotion?.reset();
      this.composerEl.inert = false;
      this.ideaEl.readOnly = false;
      this.composerEl.removeClass("is-landed", "is-submitting");
      this.composerEl.addClass("is-error");
      if (this.deviceMode !== "phone") this.setWaterFocus(true);
      this.submitEl.disabled = false;
      if (this.speechEl) {
        this.speechEl.disabled = false;
      }
      if (this.deviceMode === "phone") {
        this.renderPhoneSubmitAnchorIcon(this.t("retryEnter"));
      } else {
        this.submitEl.setText(this.t("retry"));
      }
      this.syncComposerPosition();
      this.announce(this.t("failedStatus", { message }));
      new Notice(this.t("failed", { message }));
      this.ideaEl.focus();
    }
  }

  private renderPhoneSubmitAnchorIcon(label = this.t("enterCanvas")): void {
    this.submitEl.empty();
    this.submitEl.createEl("img", {
      cls: "whiteboat-canvas-entry__submit-anchor",
      attr: {
        src: CANVAS_CREATION_ENTRY_ASSETS.anchor,
        alt: "",
        "aria-hidden": "true",
      },
    });
    this.submitEl.setAttribute("aria-label", label);
  }
}
