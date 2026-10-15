import type { Howl, HowlOptions } from "howler";
import { IDEA_DROP_SOUND_SOURCES } from "./boat-water-source";

export const WHITEBOAT_WATER_SOUND_IDLE_VOLUME = 0.07;
export const WHITEBOAT_WATER_SOUND_MOVING_VOLUME = 0.22;
export const WHITEBOAT_WATER_SOUND_FADE_IN_MS = 650;
export const WHITEBOAT_WATER_SOUND_DUCK_MS = 180;
export const WHITEBOAT_WATER_SOUND_RESUME_MS = 520;

export type WhiteboatSoundState =
  | "waiting"
  | "playing"
  | "muted"
  | "suspended"
  | "error"
  | "destroyed";

export interface WhiteboatSoundSnapshot {
  state: WhiteboatSoundState;
  volume: number;
  activated: boolean;
}

export interface WhiteboatSoundscapeOptions {
  enabled: boolean;
  reducedMotion?: boolean;
  source: string;
  createHowl: (options: HowlOptions) => Howl;
  /** The adapter owns the browser or test clock; Core owns fade timing. */
  timers: Pick<Window, "setTimeout" | "clearTimeout">;
  onStateChange?: (snapshot: WhiteboatSoundSnapshot) => void;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

export function resolveWhiteboatBoatWaterVolume(
  boatSpeed: number,
  reducedMotion = false,
): number {
  if (reducedMotion) {
    return WHITEBOAT_WATER_SOUND_IDLE_VOLUME;
  }
  const speed = clampUnit(boatSpeed);
  const easedSpeed = speed * speed * (3 - 2 * speed);
  return (
    WHITEBOAT_WATER_SOUND_IDLE_VOLUME +
    (WHITEBOAT_WATER_SOUND_MOVING_VOLUME -
      WHITEBOAT_WATER_SOUND_IDLE_VOLUME) *
      easedSpeed
  );
}

export class WhiteboatBoatSoundscape {
  private readonly createHowl: (options: HowlOptions) => Howl;
  private readonly suspendedReasons = new Set<string>();
  private howl: Howl | null = null;
  private soundId: number | null = null;
  private enabled: boolean;
  private reducedMotion: boolean;
  private activated = false;
  private waitingForUnlock = false;
  private failed = false;
  private destroyed = false;
  private boatSpeed = 0;
  private currentVolume = 0;
  private cleanupGeneration = 0;
  private pauseTimer: number | null = null;
  private dropHowls: Howl[] = [];

  constructor(private readonly options: WhiteboatSoundscapeOptions) {
    this.enabled = options.enabled;
    this.reducedMotion = Boolean(options.reducedMotion);
    this.createHowl = options.createHowl;
    this.emit();
  }

  activate(): void {
    if (this.destroyed || this.failed) {
      return;
    }
    this.activated = true;
    this.syncPlayback(WHITEBOAT_WATER_SOUND_FADE_IN_MS);
  }

  setEnabled(enabled: boolean): void {
    if (this.destroyed) {
      return;
    }
    this.enabled = enabled;
    this.syncPlayback(enabled ? WHITEBOAT_WATER_SOUND_RESUME_MS : WHITEBOAT_WATER_SOUND_DUCK_MS);
  }

  prepareIdeaDropAudio(): void {
    this.ensureDropHowls();
  }

  playIdeaDropSound(): void {
    if (this.destroyed || !this.enabled) return;
    const dropHowls = this.ensureDropHowls();
    dropHowls[Math.floor(Math.random() * dropHowls.length)]?.play();
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
    this.applyBoatVolume();
  }

  setBoatSpeed(speed: number): void {
    this.boatSpeed = clampUnit(speed);
    this.applyBoatVolume();
  }

  setSuspended(reason: string, suspended: boolean): void {
    if (suspended) {
      this.suspendedReasons.add(reason);
    } else {
      this.suspendedReasons.delete(reason);
    }
    this.syncPlayback(
      suspended ? WHITEBOAT_WATER_SOUND_DUCK_MS : WHITEBOAT_WATER_SOUND_RESUME_MS,
    );
  }

  prepareResumeFromGesture(reason: string): void {
    if (
      this.destroyed ||
      this.failed ||
      !this.activated ||
      !this.enabled ||
      !this.suspendedReasons.has(reason) ||
      [...this.suspendedReasons].some((item) => item !== reason) ||
      !this.howl ||
      this.soundId === null
    ) {
      return;
    }
    this.clearPauseTimer();
    this.currentVolume = 0;
    this.howl.volume(0, this.soundId);
    if (!this.howl.playing(this.soundId)) {
      this.waitingForUnlock = false;
      this.howl.play(this.soundId);
    }
    this.emit();
  }

  getSnapshot(): WhiteboatSoundSnapshot {
    return {
      state: this.resolveState(),
      volume: this.currentVolume,
      activated: this.activated,
    };
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.cleanupGeneration += 1;
    this.clearPauseTimer();
    const generation = this.cleanupGeneration;
    const howl = this.howl;
    const soundId = this.soundId;
    this.currentVolume = 0;
    this.dropHowls.forEach((howl) => howl.unload());
    this.dropHowls = [];
    this.emit();
    if (!howl) {
      return;
    }
    if (soundId !== null && howl.playing(soundId)) {
      howl.fade(
        this.readVolume(howl, soundId),
        0,
        WHITEBOAT_WATER_SOUND_DUCK_MS,
        soundId,
      );
      this.options.timers.setTimeout(() => {
        if (generation !== this.cleanupGeneration) {
          return;
        }
        howl.stop(soundId);
        howl.unload();
      }, WHITEBOAT_WATER_SOUND_DUCK_MS + 24);
      return;
    }
    howl.unload();
  }

  private resolveState(): WhiteboatSoundState {
    if (this.destroyed) return "destroyed";
    if (this.failed) return "error";
    if (!this.enabled) return "muted";
    if (this.suspendedReasons.size > 0) return "suspended";
    if (
      this.soundId !== null &&
      !this.waitingForUnlock &&
      this.howl?.playing(this.soundId)
    ) {
      return "playing";
    }
    return "waiting";
  }

  private ensureHowl(): Howl | null {
    if (this.howl || this.destroyed || this.failed) {
      return this.howl;
    }
    try {
      this.howl = this.createHowl({
        src: [this.options.source],
        autoplay: false,
        loop: false,
        preload: true,
        volume: 0,
        onend: (soundId) => this.restartAfterLoopBoundary(soundId),
        onloaderror: () => this.failSilently(),
        onplayerror: (soundId) => this.waitForAudioUnlock(soundId),
        onplay: (soundId) => this.handlePlaybackStarted(soundId),
        onunlock: () => this.resumeAfterAudioUnlock(),
      });
    } catch {
      this.failSilently();
    }
    return this.howl;
  }

  private restartAfterLoopBoundary(soundId: number): void {
    if (
      this.destroyed ||
      this.failed ||
      this.soundId !== soundId ||
      !this.activated ||
      !this.enabled ||
      this.suspendedReasons.size > 0 ||
      !this.howl
    ) {
      this.emit();
      return;
    }
    this.clearPauseTimer();
    this.waitingForUnlock = false;
    this.howl.play(soundId);
    this.howl.volume(this.currentVolume, soundId);
    this.emit();
  }

  private syncPlayback(fadeDuration: number): void {
    if (this.destroyed || this.failed) {
      this.emit();
      return;
    }
    const shouldPlay =
      this.activated && this.enabled && this.suspendedReasons.size === 0;
    if (!shouldPlay) {
      this.fadeTo(0, fadeDuration);
      this.schedulePause(fadeDuration);
      this.emit();
      return;
    }
    this.clearPauseTimer();
    const howl = this.ensureHowl();
    if (!howl) {
      return;
    }
    if (this.soundId === null) {
      this.currentVolume = 0;
      this.soundId = howl.play();
    } else if (!howl.playing(this.soundId)) {
      howl.play(this.soundId);
    }
    const target = resolveWhiteboatBoatWaterVolume(
      this.boatSpeed,
      this.reducedMotion,
    );
    this.fadeTo(target, fadeDuration);
    this.emit();
  }

  private applyBoatVolume(): void {
    if (
      !this.activated ||
      !this.enabled ||
      this.suspendedReasons.size > 0 ||
      !this.howl ||
      this.soundId === null ||
      !this.howl.playing(this.soundId)
    ) {
      this.emit();
      return;
    }
    const target = resolveWhiteboatBoatWaterVolume(
      this.boatSpeed,
      this.reducedMotion,
    );
    if (this.boatSpeed <= 0.001 || this.reducedMotion) {
      this.fadeTo(target, WHITEBOAT_WATER_SOUND_RESUME_MS);
    } else {
      const next = this.currentVolume + (target - this.currentVolume) * 0.18;
      this.currentVolume = Math.abs(target - next) < 0.002 ? target : next;
      this.howl.volume(this.currentVolume, this.soundId);
    }
    this.emit();
  }

  private fadeTo(target: number, duration: number): void {
    const howl = this.howl;
    const soundId = this.soundId;
    if (!howl || soundId === null || !howl.playing(soundId)) {
      this.currentVolume = 0;
      return;
    }
    const from = this.readVolume(howl, soundId);
    this.currentVolume = target;
    if (Math.abs(from - target) < 0.001 || duration <= 0) {
      howl.volume(target, soundId);
      return;
    }
    howl.fade(from, target, duration, soundId);
  }

  private failSilently(): void {
    this.clearPauseTimer();
    this.waitingForUnlock = false;
    this.failed = true;
    this.currentVolume = 0;
    if (this.howl) {
      if (this.soundId !== null) {
        this.howl.stop(this.soundId);
      }
      this.howl.unload();
    }
    this.howl = null;
    this.soundId = null;
    this.emit();
  }

  private waitForAudioUnlock(soundId: number): void {
    if (
      this.destroyed ||
      this.failed ||
      this.soundId !== soundId
    ) {
      return;
    }
    this.waitingForUnlock = true;
    this.currentVolume = 0;
    this.emit();
  }

  private resumeAfterAudioUnlock(): void {
    if (
      this.destroyed ||
      this.failed ||
      !this.activated ||
      !this.enabled ||
      this.suspendedReasons.size > 0 ||
      !this.howl ||
      this.soundId === null
    ) {
      this.emit();
      return;
    }
    this.waitingForUnlock = false;
    if (!this.howl.playing(this.soundId)) {
      this.howl.play(this.soundId);
    }
    this.applyPlaybackVolume(WHITEBOAT_WATER_SOUND_FADE_IN_MS);
  }

  private handlePlaybackStarted(soundId: number): void {
    if (
      this.destroyed ||
      this.failed ||
      this.soundId !== soundId ||
      !this.activated ||
      !this.enabled ||
      this.suspendedReasons.size > 0
    ) {
      return;
    }
    this.waitingForUnlock = false;
    this.applyPlaybackVolume(WHITEBOAT_WATER_SOUND_FADE_IN_MS);
  }

  private applyPlaybackVolume(duration: number): void {
    const target = resolveWhiteboatBoatWaterVolume(
      this.boatSpeed,
      this.reducedMotion,
    );
    this.fadeTo(target, duration);
    this.emit();
  }

  private schedulePause(duration: number): void {
    this.clearPauseTimer();
    const howl = this.howl;
    const soundId = this.soundId;
    if (!howl || soundId === null || !howl.playing(soundId)) {
      return;
    }
    this.pauseTimer = this.options.timers.setTimeout(() => {
      this.pauseTimer = null;
      if (
        this.destroyed ||
        (this.activated && this.enabled && this.suspendedReasons.size === 0)
      ) {
        return;
      }
      howl.pause(soundId);
    }, Math.max(0, duration) + 24);
  }

  private clearPauseTimer(): void {
    if (this.pauseTimer === null) {
      return;
    }
    this.options.timers.clearTimeout(this.pauseTimer);
    this.pauseTimer = null;
  }

  private ensureDropHowls(): Howl[] {
    if (this.dropHowls.length > 0 || this.destroyed) return this.dropHowls;
    try {
      this.dropHowls = IDEA_DROP_SOUND_SOURCES.map((source) =>
        this.createHowl({
          src: [source],
          autoplay: false,
          loop: false,
          preload: true,
          volume: 0.82,
        }),
      );
    } catch {
      this.dropHowls = [];
    }
    return this.dropHowls;
  }

  private readVolume(howl: Howl, soundId: number): number {
    const value = howl.volume(soundId);
    return typeof value === "number" ? value : this.currentVolume;
  }

  private emit(): void {
    this.options.onStateChange?.(this.getSnapshot());
  }
}
