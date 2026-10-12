import { afterEach, describe, expect, it, vi } from "vitest";
import type { Howl, HowlOptions } from "howler";
import {
  WHITEBOAT_HOME_SOUND_DUCK_MS,
  WHITEBOAT_HOME_SOUND_IDLE_VOLUME,
  WHITEBOAT_HOME_SOUND_MOVING_VOLUME,
  WhiteboatHomeBoatSoundscape,
  resolveWhiteboatHomeBoatWaterVolume,
  type WhiteboatHomeSoundSnapshot,
} from "../../src/features/canvas-creation-home-audio";

class FakeHowl {
  readonly fades: Array<{
    from: number;
    to: number;
    duration: number;
    id?: number;
  }> = [];
  readonly playCalls: Array<number | undefined> = [];
  readonly pauseCalls: number[] = [];
  readonly stopCalls: number[] = [];
  volumeValue = 0;
  nextId = 1001;
  activeIds = new Set<number>();
  unloaded = false;

  play(id?: number): number {
    const soundId = id ?? this.nextId++;
    this.playCalls.push(id);
    this.activeIds.add(soundId);
    return soundId;
  }

  pause(id?: number): this {
    if (typeof id === "number") {
      this.pauseCalls.push(id);
      this.activeIds.delete(id);
    }
    return this;
  }

  stop(id?: number): this {
    if (typeof id === "number") {
      this.stopCalls.push(id);
      this.activeIds.delete(id);
    }
    return this;
  }

  unload(): null {
    this.unloaded = true;
    this.activeIds.clear();
    return null;
  }

  playing(id?: number): boolean {
    return typeof id === "number"
      ? this.activeIds.has(id)
      : this.activeIds.size > 0;
  }

  volume(): number;
  volume(idOrVolume: number): this | number;
  volume(volume: number, id: number): this;
  volume(idOrVolume?: number, id?: number): this | number {
    if (typeof id === "number" && typeof idOrVolume === "number") {
      this.volumeValue = idOrVolume;
      return this;
    }
    if (typeof idOrVolume === "number" && idOrVolume > 1) {
      return this.volumeValue;
    }
    if (typeof idOrVolume === "number") {
      this.volumeValue = idOrVolume;
      return this;
    }
    return this.volumeValue;
  }

  fade(from: number, to: number, duration: number, id?: number): this {
    this.fades.push({ from, to, duration, id });
    this.volumeValue = to;
    return this;
  }
}

function createHarness(enabled = true) {
  const howl = new FakeHowl();
  const snapshots: WhiteboatHomeSoundSnapshot[] = [];
  let howlOptions: HowlOptions | null = null;
  const soundscape = new WhiteboatHomeBoatSoundscape({
    enabled,
    createHowl: (options) => {
      howlOptions = options;
      return howl as unknown as Howl;
    },
    onStateChange: (snapshot) => snapshots.push(snapshot),
  });
  return {
    soundscape,
    howl,
    snapshots,
    getHowlOptions: () => howlOptions,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Whiteboat Home boat soundscape", () => {
  it("maps normalized boat speed to a quiet monotonic water volume", () => {
    expect(resolveWhiteboatHomeBoatWaterVolume(0)).toBe(
      WHITEBOAT_HOME_SOUND_IDLE_VOLUME,
    );
    expect(resolveWhiteboatHomeBoatWaterVolume(0.5)).toBeGreaterThan(
      WHITEBOAT_HOME_SOUND_IDLE_VOLUME,
    );
    expect(resolveWhiteboatHomeBoatWaterVolume(1)).toBe(
      WHITEBOAT_HOME_SOUND_MOVING_VOLUME,
    );
    expect(resolveWhiteboatHomeBoatWaterVolume(1, true)).toBe(
      WHITEBOAT_HOME_SOUND_IDLE_VOLUME,
    );
  });

  it("waits for host activation and creates only one managed-loop Howl", () => {
    const { soundscape, howl, getHowlOptions } = createHarness();

    expect(soundscape.getSnapshot()).toMatchObject({
      state: "waiting",
      activated: false,
    });
    expect(getHowlOptions()).toBeNull();

    soundscape.activate();
    soundscape.activate();

    expect(howl.playCalls).toEqual([undefined]);
    expect(getHowlOptions()).toMatchObject({
      autoplay: false,
      loop: false,
      preload: true,
      volume: 0,
      onend: expect.any(Function),
    });
    expect(soundscape.getSnapshot()).toMatchObject({
      state: "playing",
      activated: true,
      volume: WHITEBOAT_HOME_SOUND_IDLE_VOLUME,
    });
  });

  it("raises volume with boat motion without changing playback rate", () => {
    const { soundscape, howl } = createHarness();
    soundscape.activate();

    soundscape.setBoatSpeed(1);

    expect(howl.volumeValue).toBeGreaterThan(
      WHITEBOAT_HOME_SOUND_IDLE_VOLUME,
    );
    expect(howl.volumeValue).toBeLessThanOrEqual(
      WHITEBOAT_HOME_SOUND_MOVING_VOLUME,
    );
    expect("rate" in howl).toBe(false);
  });

  it("restarts the same sound id when iOS ends the source at the loop boundary", () => {
    const { soundscape, howl, getHowlOptions } = createHarness();
    soundscape.activate();

    howl.activeIds.delete(1001);
    getHowlOptions()?.onend?.(1001);

    expect(howl.playCalls).toEqual([undefined, 1001]);
    expect(howl.playing(1001)).toBe(true);
    expect(soundscape.getSnapshot()).toMatchObject({
      state: "playing",
      activated: true,
    });
  });

  it("ducks and pauses for recording, then resumes the same sound id", () => {
    vi.useFakeTimers();
    const { soundscape, howl } = createHarness();
    soundscape.activate();

    soundscape.setSuspended("recording", true);
    expect(soundscape.getSnapshot().state).toBe("suspended");
    expect(howl.fades[howl.fades.length - 1]).toMatchObject({
      to: 0,
      duration: WHITEBOAT_HOME_SOUND_DUCK_MS,
    });

    vi.advanceTimersByTime(WHITEBOAT_HOME_SOUND_DUCK_MS + 24);
    expect(howl.pauseCalls).toEqual([1001]);

    soundscape.setSuspended("recording", false);
    expect(howl.playCalls).toEqual([undefined, 1001]);
    expect(soundscape.getSnapshot().state).toBe("playing");
  });

  it("does not pause when microphone permission is denied immediately after ducking", () => {
    vi.useFakeTimers();
    const { soundscape, howl } = createHarness();
    soundscape.activate();

    soundscape.setSuspended("recording", true);
    vi.advanceTimersByTime(WHITEBOAT_HOME_SOUND_DUCK_MS);
    soundscape.setSuspended("recording", false);
    vi.advanceTimersByTime(24);

    expect(howl.pauseCalls).toEqual([]);
    expect(howl.playCalls).toEqual([undefined]);
    expect(soundscape.getSnapshot()).toMatchObject({
      state: "playing",
      volume: WHITEBOAT_HOME_SOUND_IDLE_VOLUME,
    });
  });

  it("primes the paused sound inside the recording-end gesture while keeping save silent", () => {
    vi.useFakeTimers();
    const { soundscape, howl } = createHarness();
    soundscape.activate();

    soundscape.setSuspended("recording", true);
    vi.advanceTimersByTime(WHITEBOAT_HOME_SOUND_DUCK_MS + 24);
    expect(howl.playing(1001)).toBe(false);

    soundscape.prepareResumeFromGesture("recording");

    expect(howl.playCalls).toEqual([undefined, 1001]);
    expect(howl.volumeValue).toBe(0);
    expect(soundscape.getSnapshot()).toMatchObject({
      state: "suspended",
      volume: 0,
    });

    soundscape.setSuspended("recording", false);
    expect(soundscape.getSnapshot()).toMatchObject({
      state: "playing",
      volume: WHITEBOAT_HOME_SOUND_IDLE_VOLUME,
    });
  });

  it("does not prime recording recovery while Home is hidden", () => {
    vi.useFakeTimers();
    const { soundscape, howl } = createHarness();
    soundscape.activate();

    soundscape.setSuspended("recording", true);
    soundscape.setSuspended("document-hidden", true);
    vi.advanceTimersByTime(WHITEBOAT_HOME_SOUND_DUCK_MS + 24);

    soundscape.prepareResumeFromGesture("recording");
    soundscape.setSuspended("recording", false);

    expect(howl.playCalls).toEqual([undefined]);
    expect(soundscape.getSnapshot()).toMatchObject({
      state: "suspended",
      volume: 0,
    });
  });

  it("remembers a muted state without constructing an audio engine", () => {
    const { soundscape, getHowlOptions } = createHarness(false);

    soundscape.activate();

    expect(soundscape.getSnapshot()).toMatchObject({
      state: "muted",
      activated: true,
    });
    expect(getHowlOptions()).toBeNull();
  });

  it("fails silently and leaves the Home lifecycle usable", () => {
    const { soundscape, getHowlOptions, howl } = createHarness();
    soundscape.activate();

    getHowlOptions()?.onloaderror?.(1001, "decode failed");

    expect(soundscape.getSnapshot()).toMatchObject({ state: "error" });
    expect(howl.unloaded).toBe(true);
  });

  it("retries an autoplay-blocked start after Howler unlocks audio", () => {
    const { soundscape, getHowlOptions, howl } = createHarness();
    soundscape.activate();

    howl.activeIds.delete(1001);
    getHowlOptions()?.onplayerror?.(
      1001,
      "Playback was unable to start without user interaction.",
    );

    expect(soundscape.getSnapshot()).toMatchObject({
      state: "waiting",
      activated: true,
      volume: 0,
    });
    expect(howl.unloaded).toBe(false);

    getHowlOptions()?.onunlock?.();

    expect(howl.playCalls).toEqual([undefined, 1001]);
    expect(soundscape.getSnapshot()).toMatchObject({
      state: "playing",
      activated: true,
      volume: WHITEBOAT_HOME_SOUND_IDLE_VOLUME,
    });
  });
});
