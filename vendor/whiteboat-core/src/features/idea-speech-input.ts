/**
 * Browser speech-to-draft helpers shared by every Whiteboat host adapter.
 *
 * This module owns no UI, recording lifecycle, Session, Canvas, or automatic
 * submission. A host may expose speech as a progressive enhancement, but the
 * only product value returned here is editable text.
 */

interface IdeaSpeechAlternativeLike {
  transcript?: string;
}

interface IdeaSpeechResultLike {
  readonly isFinal?: boolean;
  readonly [index: number]: IdeaSpeechAlternativeLike | undefined;
}

export interface IdeaSpeechEventLike {
  readonly resultIndex?: number;
  readonly results?: ArrayLike<IdeaSpeechResultLike>;
}

export interface IdeaSpeechErrorEventLike {
  readonly error?: string;
}

export interface IdeaSpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: IdeaSpeechEventLike) => void) | null;
  onerror: ((event: IdeaSpeechErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export type IdeaSpeechRecognitionConstructor =
  new () => IdeaSpeechRecognitionLike;

interface IdeaSpeechWindowLike {
  SpeechRecognition?: IdeaSpeechRecognitionConstructor;
  webkitSpeechRecognition?: IdeaSpeechRecognitionConstructor;
}

interface IdeaMediaStreamTrackLike {
  stop?: () => void;
}

interface IdeaMediaStreamLike {
  getTracks?: () => ArrayLike<IdeaMediaStreamTrackLike | undefined>;
}

interface IdeaMediaDevicesLike {
  getUserMedia?: (constraints: {
    audio: true;
  }) =>
    | Promise<IdeaMediaStreamLike | undefined>
    | IdeaMediaStreamLike
    | undefined;
}

interface IdeaNavigatorLike {
  mediaDevices?: IdeaMediaDevicesLike;
}

export type IdeaMicrophonePermissionResult =
  | "granted"
  | "unsupported"
  | "not-allowed"
  | "audio-capture";

export function getIdeaSpeechRecognitionConstructor(
  source: unknown = window,
): IdeaSpeechRecognitionConstructor | null {
  const speechWindow = source as IdeaSpeechWindowLike | null;
  return (
    speechWindow?.SpeechRecognition ??
    speechWindow?.webkitSpeechRecognition ??
    null
  );
}

function normalizeIdeaSpeechFailureReason(
  error: unknown,
): IdeaMicrophonePermissionResult {
  const name = String(
    (error as { name?: string } | null | undefined)?.name ?? "",
  );
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "not-allowed";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "NotReadableError":
    case "AbortError":
    case "OverconstrainedError":
      return "audio-capture";
    default:
      return "audio-capture";
  }
}

export async function requestIdeaMicrophonePermission(
  source: unknown = globalThis.navigator,
): Promise<IdeaMicrophonePermissionResult> {
  const mediaDevices = (source as IdeaNavigatorLike | null)?.mediaDevices;
  const getUserMedia = mediaDevices?.getUserMedia;
  if (!getUserMedia) {
    return "unsupported";
  }
  let stream: IdeaMediaStreamLike | undefined;
  try {
    stream = await Promise.resolve(
      getUserMedia.call(mediaDevices, { audio: true }),
    );
  } catch (error) {
    return normalizeIdeaSpeechFailureReason(error);
  }
  for (const track of Array.from(stream?.getTracks?.() ?? [])) {
    try {
      track?.stop?.();
    } catch {
      // This probe owns no recording lifecycle. Recognition remains usable
      // even when a browser refuses a redundant track stop.
    }
  }
  return "granted";
}

export function extractFinalIdeaSpeechTranscript(
  event: IdeaSpeechEventLike,
): string {
  const results = event.results;
  if (!results) {
    return "";
  }
  const startIndex = Math.max(0, Math.floor(event.resultIndex ?? 0));
  const fragments: string[] = [];
  for (let index = startIndex; index < results.length; index += 1) {
    const result = results[index];
    if (!result || result.isFinal === false) {
      continue;
    }
    const transcript = String(result[0]?.transcript ?? "").trim();
    if (transcript) {
      fragments.push(transcript);
    }
  }
  return fragments.join(" ").trim();
}

export function appendIdeaSpeechTranscript(
  currentValue: string,
  transcript: string,
): string {
  const addition = String(transcript ?? "").trim();
  if (!addition) {
    return currentValue;
  }
  const current = String(currentValue ?? "");
  if (!current.trim()) {
    return addition;
  }
  if (/\s$/u.test(current)) {
    return `${current}${addition}`;
  }
  const trimmed = current.replace(/\s+$/u, "");
  const last = trimmed.charAt(trimmed.length - 1);
  const first = addition.charAt(0);
  const cjk = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/u;
  const canJoinDirectly =
    (last && first && cjk.test(last) && cjk.test(first)) ||
    /[。！？!?，,、；;：:]$/u.test(trimmed);
  return `${current}${canJoinDirectly ? "" : " "}${addition}`;
}

export function formatIdeaSpeechError(
  reason?: string,
  options: {
    microphoneGranted?: boolean;
    hostLabel?: string;
    surfaceLabel?: string;
  } = {},
): string {
  const hostLabel = options.hostLabel ?? "当前应用";
  const surfaceLabel = options.surfaceLabel ?? "水面";
  const hostUsesWordSpacing = /^[A-Za-z0-9]/u.test(hostLabel);
  const hostBefore = hostUsesWordSpacing ? " " : "";
  const hostAfter = hostUsesWordSpacing ? " " : "";
  switch (reason) {
    case "not-allowed":
    case "service-not-allowed":
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      if (options.microphoneGranted) {
        return `${hostLabel}${hostAfter}已有麦克风权限，但当前设备暂不能在${surfaceLabel}内听写。可以使用系统键盘上的麦克风输入。`;
      }
      return `没有麦克风权限。允许${hostBefore}${hostLabel}${hostAfter}使用麦克风后再试，或使用系统键盘上的麦克风输入。`;
    case "no-speech":
      return "暂时没有听到内容。可以再点麦克风说一次，或直接打字。";
    case "audio-capture":
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "NotReadableError":
    case "AbortError":
    case "OverconstrainedError":
      return "当前设备暂时无法使用麦克风。可以使用系统键盘上的麦克风输入。";
    default:
      return `当前设备暂不能在${surfaceLabel}内听写，可以使用系统键盘上的麦克风输入。`;
  }
}
