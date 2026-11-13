import { describe, it, expect, vi } from "vitest";
import { WaterAdjustmentSession, waterAdjustmentAt, waterAdjustmentPosition } from "../../src/water-adjustment";
describe("Light/depth workbench", () => {
  it("maps the two axes independently and clamps outside the pad", () => {
    expect(waterAdjustmentAt(0, 1)).toEqual({ lightIntensity: .6, waterDepth: .6 });
    expect(waterAdjustmentAt(1, 0)).toEqual({ lightIntensity: 1.6, waterDepth: 3 });
    expect(waterAdjustmentAt(3, -2)).toEqual(waterAdjustmentAt(1, 0));
    const value = { lightIntensity: 1.25, waterDepth: 1.7 };
    const p = waterAdjustmentPosition(value);
    expect(waterAdjustmentAt(p.x, p.y)).toEqual(value);
  });
  it("previews continuously, commits once per gesture, cancels and undoes", () => {
    const preview = vi.fn(), save = vi.fn();
    const session = new WaterAdjustmentSession({ lightIntensity: 1, waterDepth: 1 }, preview, save);
    session.move({ lightIntensity: .6, waterDepth: 3 });
    session.move({ lightIntensity: 1.6, waterDepth: .6 });
    expect(preview).toHaveBeenCalledTimes(2); expect(save).not.toHaveBeenCalled();
    session.cancel(); expect(session.value).toEqual({ lightIntensity: 1, waterDepth: 1 });
    session.commit(); expect(save).not.toHaveBeenCalled();
    session.move({ lightIntensity: 1.6, waterDepth: 3 }); session.commit(); session.commit();
    expect(save).toHaveBeenCalledOnce(); expect(session.canUndo).toBe(true);
    session.undo(); expect(save).toHaveBeenLastCalledWith({ lightIntensity: 1, waterDepth: 1 }); expect(session.canUndo).toBe(false);
  });
  it("accepts saved external changes without replacing an active gesture", () => {
    const session = new WaterAdjustmentSession({ lightIntensity: 1, waterDepth: 1 }, vi.fn(), vi.fn());
    session.sync({ lightIntensity: 1.2, waterDepth: 2 });
    expect(session.value).toEqual({ lightIntensity: 1.2, waterDepth: 2 });
    session.move({ lightIntensity: .6, waterDepth: .6 });
    session.sync({ lightIntensity: 1.6, waterDepth: 3 });
    expect(session.value).toEqual({ lightIntensity: .6, waterDepth: .6 });
    session.cancel(); expect(session.value).toEqual({ lightIntensity: 1.2, waterDepth: 2 });
  });
});
