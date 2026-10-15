import { Howl, type HowlOptions } from "howler";
import {
  WhiteboatBoatSoundscape,
  resolveWhiteboatBoatWaterVolume,
  WHITEBOAT_WATER_SOUND_DUCK_MS,
  WHITEBOAT_WATER_SOUND_IDLE_VOLUME,
  WHITEBOAT_WATER_SOUND_MOVING_VOLUME,
  WHITEBOAT_WATER_SOUND_FADE_IN_MS,
  WHITEBOAT_WATER_SOUND_RESUME_MS,
  type WhiteboatSoundSnapshot,
  type WhiteboatSoundscapeOptions,
} from "whiteboat-core";
import { BOAT_WATER_SOURCE } from "whiteboat-core";

/** Obsidian keeps the historical feature name; playback is owned by Core. */
export const WHITEBOAT_HOME_SOUND_IDLE_VOLUME = WHITEBOAT_WATER_SOUND_IDLE_VOLUME;
export const WHITEBOAT_HOME_SOUND_MOVING_VOLUME = WHITEBOAT_WATER_SOUND_MOVING_VOLUME;
export const WHITEBOAT_HOME_SOUND_FADE_IN_MS = WHITEBOAT_WATER_SOUND_FADE_IN_MS;
export const WHITEBOAT_HOME_SOUND_DUCK_MS = WHITEBOAT_WATER_SOUND_DUCK_MS;
export const WHITEBOAT_HOME_SOUND_RESUME_MS = WHITEBOAT_WATER_SOUND_RESUME_MS;

export type WhiteboatHomeSoundState = WhiteboatSoundSnapshot["state"];
export type WhiteboatHomeSoundSnapshot = WhiteboatSoundSnapshot;
export interface WhiteboatHomeSoundscapeOptions {
  enabled: boolean;
  ownerWindow: Pick<Window, "setTimeout" | "clearTimeout">;
  reducedMotion?: boolean;
  createHowl?: (options: HowlOptions) => Howl;
  onStateChange?: (snapshot: WhiteboatHomeSoundSnapshot) => void;
}

export function resolveWhiteboatHomeBoatWaterVolume(
  boatSpeed: number,
  reducedMotion = false,
): number {
  return resolveWhiteboatBoatWaterVolume(boatSpeed, reducedMotion);
}

export class WhiteboatHomeBoatSoundscape extends WhiteboatBoatSoundscape {
  constructor(options: WhiteboatHomeSoundscapeOptions) {
    const coreOptions: WhiteboatSoundscapeOptions = {
      enabled: options.enabled,
      reducedMotion: options.reducedMotion,
      source: BOAT_WATER_SOURCE,
      timers: options.ownerWindow,
      createHowl: options.createHowl ?? ((howlOptions) => new Howl(howlOptions)),
      onStateChange: options.onStateChange,
    };
    super(coreOptions);
  }
}
