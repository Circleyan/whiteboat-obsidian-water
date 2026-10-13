import boatWaterSource from "../assets/audio/boat-water.mp3";
import stoneFallingInWaterSource from "../assets/audio/stone-falling-in-water.mp3";
import bigRockSplash1 from "../assets/audio/idea-drops/big-rock-splash-1.mp3";
import bigRockSplash2 from "../assets/audio/idea-drops/big-rock-splash-2.mp3";
import bigRockSplash3 from "../assets/audio/idea-drops/big-rock-splash-3.mp3";
import bigRockSplash4 from "../assets/audio/idea-drops/big-rock-splash-4.mp3";

// Explicit public types survive declaration bundling of the data-url modules.
export const BOAT_WATER_SOURCE: string = boatWaterSource;
export const STONE_FALLING_IN_WATER_SOURCE: string = stoneFallingInWaterSource;
export const IDEA_DROP_SOUND_SOURCES: readonly [string, string, string, string] = [
  bigRockSplash1,
  bigRockSplash2,
  bigRockSplash3,
  bigRockSplash4,
] as const;
