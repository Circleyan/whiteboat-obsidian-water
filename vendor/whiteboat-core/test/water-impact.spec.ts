import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CANVAS_CREATION_WATER_IMPACT_CANVAS_CLASS,
  CANVAS_CREATION_WATER_IMPACT_DURATION_SECONDS,
  CANVAS_CREATION_WATER_IMPACT_REACH_MARGIN,
  resolveCanvasCreationWaterImpactRevealBand,
  isCanvasCreationWaterImpactActive,
  mountCanvasCreationWaterImpact,
  resolveCanvasCreationWaterImpactReach,
  resolveCanvasCreationWaterImpactRingRadius,
  resolveCanvasCreationWaterImpactScale,
} from "../src/features/canvas-creation-water-impact";

type Triple = [number, number, number];

const ACCENTS: [string, string, string, string] = ["#ff0000", "#00ff00", "#0000ff", "#ffffff"];

/** A 1x1 canvas that echoes whatever CSS color it was last padded with. */
function createPaint() {
  let fill = "#000000";
  return {
    get fillStyle() { return fill; },
    set fillStyle(value: string) { fill = value; },
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    getImageData: () => {
      const match = /^#([0-9a-f]{6})$/i.exec(fill);
      const bytes = match ? [0, 2, 4].map((i) => parseInt(match[1].slice(i, i + 2), 16)) : [0, 0, 0];
      return { data: [...bytes, 255] };
    },
  };
}

/**
 * Records every uniform the module sets.  `compile`/`link` fail the program on
 * demand, and `failUpload` makes the per-frame texture upload throw so the
 * frame-level teardown path can be exercised.
 *
 * Every method is bound to the target, because WebGL requires its receiver.
 */
function createGl(overrides: { compile?: boolean; link?: boolean; failUpload?: boolean } = {}) {
  const uniforms = new Map<string, unknown[]>();
  const calls: string[] = [];
  const constants: Record<string, number> = {
    VERTEX_SHADER: 35633, FRAGMENT_SHADER: 35632, COMPILE_STATUS: 35713,
    LINK_STATUS: 35714, ARRAY_BUFFER: 34962, STATIC_DRAW: 35044, FLOAT: 5126,
    TEXTURE0: 33984, TEXTURE_2D: 3553, TEXTURE_MIN_FILTER: 10241,
    TEXTURE_MAG_FILTER: 10240, TEXTURE_WRAP_S: 10242, TEXTURE_WRAP_T: 10243,
    CLAMP_TO_EDGE: 33071, LINEAR: 9729, RGBA: 6408, UNSIGNED_BYTE: 5121,
    TRIANGLES: 4, UNPACK_FLIP_Y_WEBGL: 37440, UNPACK_PREMULTIPLY_ALPHA_WEBGL: 37441,
  };
  const target: Record<string, unknown> = { ...constants };
  const record = (name: string, result?: unknown) => {
    target[name] = (...args: unknown[]) => {
      calls.push(name);
      if (name.startsWith("uniform") && name !== "uniform1i") {
        uniforms.set((args[0] as { name: string }).name, args.slice(1));
      }
      return result;
    };
  };
  target.getUniformLocation = (_program: unknown, name: string) => ({ name });
  target.getAttribLocation = () => 0;
  target.getShaderParameter = () => overrides.compile !== false;
  target.getProgramParameter = () => overrides.link !== false;
  target.getShaderInfoLog = () => "compile failed";
  target.createShader = () => ({ kind: "shader" });
  target.texImage2D = () => {
    calls.push("texImage2D");
    if (overrides.failUpload) throw new Error("context lost");
  };
  target.createProgram = () => ({ kind: "program" });
  target.createBuffer = () => ({ kind: "buffer" });
  target.createTexture = () => ({ kind: "texture" });
  // The module calls `getExtension("WEBGL_lose_context")?.loseContext()`, so the
  // stub has to hand back something callable.
  const loseContext = () => { calls.push("loseContext"); };
  target.getExtension = (name: string) => (name === "WEBGL_lose_context" ? { loseContext } : null);
  const gl = new Proxy(target, {
    get(inner, key: string) {
      if (!(key in inner)) record(key);
      return inner[key];
    },
  }) as unknown as WebGLRenderingContext;
  return { gl, uniforms, calls };
}

function createHarness(options: {
  gl?: ReturnType<typeof createGl>;
  paint?: ReturnType<typeof createPaint> | null;
} = {}) {
  const gl = options.gl ?? createGl();
  const paint = options.paint === undefined ? createPaint() : options.paint;
  const created: Array<Record<string, unknown>> = [];
  const inserted: unknown[] = [];
  vi.stubGlobal("document", {
    createElement: () => {
      const element: Record<string, unknown> = {
        className: "", dataset: {} as Record<string, string>,
        style: { visibility: "" }, width: 0, height: 0,
        setAttribute: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(),
        remove: vi.fn(), after: (node: unknown) => inserted.push(node),
        getContext: (kind: string) => (kind === "webgl" ? gl.gl : paint),
      };
      created.push(element);
      return element;
    },
  });
  const source = {
    style: { visibility: "visible" }, width: 1280, height: 800,
    clientWidth: 640, clientHeight: 400,
    after: vi.fn((node: unknown) => inserted.push(node)),
  } as unknown as HTMLCanvasElement;
  return { gl, paint, created, source, inserted };
}

describe("water impact geometry", () => {
  it("clamps the drop point scale to the reference width", () => {
    expect(resolveCanvasCreationWaterImpactScale(400)).toBe(1);
    expect(resolveCanvasCreationWaterImpactScale(160)).toBe(0.6);
    expect(resolveCanvasCreationWaterImpactScale(2000)).toBe(1.4);
    expect(resolveCanvasCreationWaterImpactScale(Number.NaN)).toBe(0.6);
  });

  it("reaches the farthest corner plus a scaled margin, in canvas pixels", () => {
    const origin = { x: 320, y: 200 };
    const farthest = Math.hypot(origin.x, origin.y);
    expect(resolveCanvasCreationWaterImpactReach(640, 400, origin.x, origin.y, 1)).toBeCloseTo(
      farthest + CANVAS_CREATION_WATER_IMPACT_REACH_MARGIN, 9,
    );
    expect(resolveCanvasCreationWaterImpactReach(640, 400, 0, 0, 2)).toBeCloseTo(
      Math.hypot(640, 400) + 2 * CANVAS_CREATION_WATER_IMPACT_REACH_MARGIN, 9,
    );
    // The margin tracks the drop point, so a larger one still overshoots the edge.
    expect(
      resolveCanvasCreationWaterImpactReach(640, 400, origin.x, origin.y, 2) - farthest,
    ).toBeCloseTo(2 * CANVAS_CREATION_WATER_IMPACT_REACH_MARGIN, 9);
    // Degenerate input stays finite instead of poisoning the uniform.
    expect(resolveCanvasCreationWaterImpactReach(Number.NaN, Number.NaN, Number.NaN, 0)).toBe(
      CANVAS_CREATION_WATER_IMPACT_REACH_MARGIN,
    );
  });

  it("holds the ring still until the delay, then eases out along the shader's curve", () => {
    const reach = 500;
    expect(resolveCanvasCreationWaterImpactRingRadius(0, reach)).toBe(0);
    expect(resolveCanvasCreationWaterImpactRingRadius(0.52, reach)).toBe(0);
    // The exponent is just above 1, so the ring creeps out of the drop and only
    // later gains speed — the first quarter of the travel covers under a quarter
    // of the reach, and the second quarter covers more than the first.
    const at = (seconds: number) => resolveCanvasCreationWaterImpactRingRadius(0.52 + seconds, reach);
    const first = at(2.14 / 4);
    const second = at(2.14 / 2) - first;
    expect(first).toBeLessThan(reach / 4);
    expect(second).toBeGreaterThan(first);
    expect(resolveCanvasCreationWaterImpactRingRadius(0.52 + 2.14, reach)).toBeCloseTo(reach, 9);
    // Saturates at the reach, and is exactly zero before the delay.
    expect(resolveCanvasCreationWaterImpactRingRadius(99, reach)).toBeCloseTo(reach, 9);
    expect(resolveCanvasCreationWaterImpactRingRadius(0.3, Number.NaN)).toBe(0);
  });

  it("stops the pass at the shared duration", () => {
    expect(isCanvasCreationWaterImpactActive(0)).toBe(true);
    expect(isCanvasCreationWaterImpactActive(CANVAS_CREATION_WATER_IMPACT_DURATION_SECONDS - 0.001)).toBe(true);
    expect(isCanvasCreationWaterImpactActive(CANVAS_CREATION_WATER_IMPACT_DURATION_SECONDS)).toBe(false);
    expect(isCanvasCreationWaterImpactActive(Number.NaN)).toBe(true);
  });

  it("shares the reveal band around the expanding crest", () => {
    expect(resolveCanvasCreationWaterImpactRevealBand(0.52, 500, 1)).toEqual({ inner: 0, outer: 12 });
    expect(resolveCanvasCreationWaterImpactRevealBand(1.52, 500, 2)).toEqual({
      inner: 500 * Math.pow(1 / 2.14, 1.05) - 104,
      outer: 500 * Math.pow(1 / 2.14, 1.05) + 24,
    });
  });
});

describe("water impact mount", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns null with no WebGL, leaving the caller's water untouched", () => {
    vi.stubGlobal("document", {
      createElement: () => ({
        className: "", dataset: {}, style: {}, setAttribute: vi.fn(),
        getContext: () => null,
      }),
    });
    const source = { style: { visibility: "visible" } } as unknown as HTMLCanvasElement;
    expect(mountCanvasCreationWaterImpact(source, { x: 320, y: 200 }, { accents: ACCENTS }))
      .toBeNull();
    expect(source.style.visibility).toBe("visible");
  });

  it("returns null when the shader will not compile, leaving the source visible", () => {
    const harness = createHarness({ gl: createGl({ compile: false }) });
    expect(mountCanvasCreationWaterImpact(harness.source, { x: 320, y: 200 }, { accents: ACCENTS }))
      .toBeNull();
    expect(harness.source.style.visibility).toBe("visible");
    expect(harness.inserted).toEqual([]);
  });

  it("converts the pixel reach into the shader's scale-relative units exactly once", () => {
    const harness = createHarness();
    const reach = resolveCanvasCreationWaterImpactReach(640, 400, 320, 200, 1.4);
    mountCanvasCreationWaterImpact(harness.source, { x: 320, y: 200 }, {
      accents: ACCENTS, visualScale: 1.4, reach,
    });
    // The shader divides every distance by `scale` before measuring it, so the
    // uniform is the pixel reach divided once — dividing twice, as an earlier
    // draft did, stops the ring well inside the frame.
    expect(harness.gl.uniforms.get("reach")).toEqual([reach / 1.4]);
    expect(harness.gl.uniforms.get("scale")).toEqual([1.4]);
    expect(harness.gl.uniforms.get("origin")).toEqual([320, 200]);
  });

  it("defaults the reach to the source's own geometry when the caller omits it", () => {
    const harness = createHarness();
    mountCanvasCreationWaterImpact(harness.source, { x: 320, y: 200 }, {
      accents: ACCENTS, visualScale: 2,
    });
    const expected = resolveCanvasCreationWaterImpactReach(640, 400, 320, 200, 2) / 2;
    expect(harness.gl.uniforms.get("reach")).toEqual([expected]);
  });

  it("resolves the host's accents through the platform, and degrades to one tone", () => {
    const harness = createHarness();
    mountCanvasCreationWaterImpact(harness.source, { x: 0, y: 0 }, { accents: ACCENTS });
    const expected: Triple[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]];
    expected.forEach((triple, index) => {
      expect(harness.gl.uniforms.get(`wake${index}`)).toEqual(triple);
    });

    vi.unstubAllGlobals();
    const noPaint = createHarness({ paint: null });
    mountCanvasCreationWaterImpact(noPaint.source, { x: 0, y: 0 }, { accents: ACCENTS });
    for (let index = 0; index < 4; index += 1) {
      expect(noPaint.gl.uniforms.get(`wake${index}`)).toEqual([0, 0, 0]);
    }
  });

  it("carries the host's classes so the host keeps owning placement", () => {
    const harness = createHarness();
    mountCanvasCreationWaterImpact(harness.source, { x: 0, y: 0 }, {
      accents: ACCENTS, canvasClassName: "host-canvas host-water-impact",
    });
    expect(harness.created[0].className).toBe("host-canvas host-water-impact");
    expect(harness.created[0].setAttribute).toHaveBeenCalledWith("aria-hidden", "true");

    vi.unstubAllGlobals();
    const fallback = createHarness();
    mountCanvasCreationWaterImpact(fallback.source, { x: 0, y: 0 }, { accents: ACCENTS });
    expect(fallback.created[0].className).toBe(CANVAS_CREATION_WATER_IMPACT_CANVAS_CLASS);
  });

  it("uploads the live canvas, hides it for the pass, and restores it on destroy", () => {
    const harness = createHarness();
    const impact = mountCanvasCreationWaterImpact(harness.source, { x: 320, y: 200 }, { accents: ACCENTS });
    expect(impact).not.toBeNull();
    const pass = harness.created[0];
    expect(harness.source.after).toHaveBeenCalledWith(pass);

    impact!.draw(0.95);
    expect(harness.gl.calls).toContain("texImage2D");
    expect(harness.gl.uniforms.get("elapsed")).toEqual([0.95]);
    expect(harness.gl.uniforms.get("size")).toEqual([640, 400]);
    expect(harness.source.style.visibility).toBe("hidden");
    // The pass mirrors the water's backing resolution, not its CSS size.
    expect(pass.width).toBe(1280);
    expect(pass.height).toBe(800);
    expect(pass.dataset).toEqual({ elapsed: "0.950" });

    impact!.destroy();
    expect(harness.source.style.visibility).toBe("visible");
    expect(pass.remove).toHaveBeenCalled();
    expect(harness.gl.calls).toContain("loseContext");
  });

  it("ignores draw after destroy and never leaves the water hidden", () => {
    const harness = createHarness();
    const impact = mountCanvasCreationWaterImpact(harness.source, { x: 0, y: 0 }, { accents: ACCENTS });
    impact!.draw(0.6);
    impact!.destroy();
    const draws = () => harness.gl.calls.filter((call) => call === "drawArrays").length;
    expect(draws()).toBe(1);
    impact!.draw(1.2);
    impact!.destroy();
    expect(draws()).toBe(1);
    expect(harness.source.style.visibility).not.toBe("hidden");
  });

  it("releases the context when a frame throws, restoring the source", () => {
    const harness = createHarness({ gl: createGl({ failUpload: true }) });
    const impact = mountCanvasCreationWaterImpact(harness.source, { x: 0, y: 0 }, { accents: ACCENTS });
    expect(impact).not.toBeNull();
    impact!.draw(0.7);
    expect(harness.gl.calls).toContain("loseContext");
    expect(harness.source.style.visibility).toBe("visible");
    expect(harness.created[0].remove).toHaveBeenCalled();
  });
});
