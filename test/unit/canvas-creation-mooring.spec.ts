import { describe, expect, it } from "vitest";
import { CanvasCreationMooringMotion } from "../../src/features/canvas-creation-mooring";

describe("composer mooring presentation", () => {
  it("eases in, sways to both sides and settles without a discontinuity", () => {
    const motion = new CanvasCreationMooringMotion();
    expect(motion.sample(0, true, false)).toEqual({ offset: 0, heading: 0, roll: 0 });
    const frames = [];
    for (let time = 16; time <= 6000; time += 16) frames.push(motion.sample(time, true, false));
    expect(Math.max(...frames.map(frame => frame.offset))).toBeGreaterThan(2);
    expect(Math.min(...frames.map(frame => frame.offset))).toBeLessThan(-2);
    expect(frames.every(frame => Math.abs(frame.roll) <= 0.1)).toBe(true);
    for (let index = 1; index < frames.length; index++) {
      expect(Math.abs(frames[index].offset - frames[index - 1].offset)).toBeLessThan(0.1);
    }
    const last = frames[frames.length - 1];
    const firstExit = motion.sample(6016, false, false);
    expect(Math.abs(firstExit.offset - last.offset)).toBeLessThan(0.4);
    for (let time = 6032; time <= 7500; time += 16) motion.sample(time, false, false);
    expect(motion.sample(7516, false, false)).toEqual({ offset: 0, heading: 0, roll: 0 });
  });

  it("stays continuous on reentry and does not fast-forward after a hidden window", () => {
    const motion = new CanvasCreationMooringMotion();
    for (let time = 0; time <= 800; time += 16) motion.sample(time, true, false);
    const before = motion.sample(816, false, false);
    const reentered = motion.sample(832, true, false);
    expect(Math.abs(reentered.offset - before.offset)).toBeLessThan(0.2);
    const afterHidden = motion.sample(100_000, true, false);
    expect(Math.abs(afterHidden.offset - reentered.offset)).toBeLessThan(0.3);
  });

  it("removes all presentation motion immediately when reduced motion is enabled", () => {
    const motion = new CanvasCreationMooringMotion();
    for (let time = 0; time < 1000; time += 16) motion.sample(time, true, false);
    expect(motion.sample(1000, true, true)).toEqual({ offset: 0, heading: 0, roll: 0 });
    expect(motion.sample(2000, false, true)).toEqual({ offset: 0, heading: 0, roll: 0 });
  });
});
