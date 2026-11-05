export {
  advanceCanvasCreationBoatFollow,
  resolveCanvasCreationEntryDeviceMode,
  sampleCanvasCreationPhoneRoamTarget,
  shouldCanvasCreationBoatFollowPointer,
  shouldCanvasCreationEntryCloseComposerFirst,
} from "whiteboat-core";
export type { CanvasCreationEntryDeviceMode } from "whiteboat-core";

import { CANVAS_CREATION_BOAT_FOLLOW_SPEED_LIMITS as CORE_FOLLOW_LIMITS, normalizeCanvasCreationBoatFollowSpeed as normalizeCoreFollowSpeed } from "whiteboat-core";
// Obsidian's accepted slower default; shared DSH navigation remains unchanged.
export const CANVAS_CREATION_BOAT_FOLLOW_SPEED_LIMITS = { ...CORE_FOLLOW_LIMITS, defaultValue: 0.6 } as const;
export function normalizeCanvasCreationBoatFollowSpeed(value: unknown, fallback: number = CANVAS_CREATION_BOAT_FOLLOW_SPEED_LIMITS.defaultValue): number {
  return normalizeCoreFollowSpeed(value, fallback);
}
