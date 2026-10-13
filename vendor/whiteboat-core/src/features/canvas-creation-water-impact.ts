/**
 * A short-lived refraction pass over a live water canvas.
 *
 * Submission is the one moment the water is asked to answer back: the surface
 * is pushed away from the drop point and two rings travel outward from it.
 * This module owns that disturbance only.  It draws no water of its own and
 * introduces no second simulation — the host keeps rendering its field, and
 * this pass reads that canvas as a texture, displaces its samples, tints them,
 * then hides the source for the duration of the pass.
 *
 * The clock belongs to the host: `draw(elapsedSeconds)` is called once per
 * frame with the elapsed time since the disturbance began, so a host can drive
 * its own reveal, audio, or capture from the same timestamp and stay aligned.
 */

/**
 * Seconds from the drop to the last frame of the disturbance.  The ring
 * envelope closes at 2.1s and the outermost travel finishes here; a host that
 * also reveals content through this moment should key its own duration to this
 * value rather than restating the literal.
 */
export const CANVAS_CREATION_WATER_IMPACT_DURATION_SECONDS = 2.66;

/** Where the leading ring starts travelling, as a delay after the drop. */
export const CANVAS_CREATION_WATER_IMPACT_FIRST_RING_DELAY_SECONDS = 0.52;

/** Delay before the trailing ring follows the leading one. */
export const CANVAS_CREATION_WATER_IMPACT_RING_GAP_SECONDS = 0.2;

/** Seconds for the leading ring to reach the full reach. */
export const CANVAS_CREATION_WATER_IMPACT_REACH_SECONDS = 2.14;

/** Curvature of the ring's expansion; below 1 the ring starts fast and eases out. */
export const CANVAS_CREATION_WATER_IMPACT_REACH_EXPONENT = 1.05;

/** How far past the drop point the disturbance travels, per unit of visual scale. */
export const CANVAS_CREATION_WATER_IMPACT_REACH_MARGIN = 96;

/** Floor and ceiling applied to a drop point's scale, so tiny and huge hosts read alike. */
export const CANVAS_CREATION_WATER_IMPACT_MIN_SCALE = 0.6;
export const CANVAS_CREATION_WATER_IMPACT_MAX_SCALE = 1.4;

/** Reference drop point width; the host's own width is measured against it. */
export const CANVAS_CREATION_WATER_IMPACT_REFERENCE_POINT_WIDTH = 400;

/** The reveal mask trails the crest by this many scaled pixels. */
export const CANVAS_CREATION_WATER_IMPACT_REVEAL_INSET = 52;

/** The reveal mask leads the crest by this many scaled pixels. */
export const CANVAS_CREATION_WATER_IMPACT_REVEAL_OUTSET = 12;

/** Default class for the pass's canvas; hosts with their own positioning pass their own. */
export const CANVAS_CREATION_WATER_IMPACT_CANVAS_CLASS = "whiteboat-water-impact";

/**
 * Writes a number as a GLSL float literal — always with a decimal point, and
 * otherwise exactly as JavaScript spells it.
 *
 * The shader is assembled from the constants above rather than restating them,
 * because the ring's geometry is stated twice: once in GLSL, where it displaces
 * pixels, and once in {@link resolveCanvasCreationWaterImpactRingRadius}, where
 * a host keys its companion reveal to it.  A hole whose mask is computed from
 * its own copy of `2.14` stops matching the wave the moment either is touched.
 * Interpolation leaves the generated source byte-identical to the literals it
 * replaced, so sharing the value costs nothing at compile time.
 */
function glslFloat(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

const VERTEX = `attribute vec2 position;
varying vec2 uv;
void main(){uv=(position+1.0)*0.5;gl_Position=vec4(position,0.0,1.0);}`;

const FRAGMENT = `precision highp float;
uniform sampler2D water;
uniform vec2 size;
uniform vec2 origin;
uniform float elapsed;
uniform float scale;
uniform float reach;
uniform vec3 wake0;
uniform vec3 wake1;
uniform vec3 wake2;
uniform vec3 wake3;
varying vec2 uv;
float bell(float v){return exp(-v*v);}
vec3 disturbance(vec2 p){
  vec2 delta=(p-origin)/scale;
  float r=length(delta);
  vec2 n=delta/max(r,0.001);
  float pull=smoothstep(0.18,0.49,elapsed)*(1.0-smoothstep(0.53,0.78,elapsed))*bell(r/91.0);
  float age=elapsed-${glslFloat(CANVAS_CREATION_WATER_IMPACT_FIRST_RING_DELAY_SECONDS)};
  float wave=0.0;
  float crest=0.0;
  for(int i=0;i<2;i++){
    float a=age-float(i)*${glslFloat(CANVAS_CREATION_WATER_IMPACT_RING_GAP_SECONDS)};
    if(a>=0.0){
      float radius=reach*pow(clamp(a/${glslFloat(CANVAS_CREATION_WATER_IMPACT_REACH_SECONDS)},0.0,1.0),${glslFloat(CANVAS_CREATION_WATER_IMPACT_REACH_EXPONENT)});
      float z=(r-radius)/(22.0+a*12.0);
      float envelope=bell(z)*exp(-a*0.45)*(i==0?1.0:0.43)*smoothstep(0.0,0.07,a)*(1.0-smoothstep(1.7,2.1,age));
      wave+=(1.0-2.0*z*z)*envelope;
      crest+=envelope;
    }
  }
  float kick=age<0.0?0.0:bell((age-0.12)/0.105)*bell(r/73.0);
  float radial=-r*0.31*pull+17.0*wave+18.0*kick;
  return vec3(n*radial,crest+kick*0.6)*vec3(scale,scale,1.0);
}
void main(){
  vec2 p=vec2(uv.x,1.0-uv.y)*size;
  vec3 shift=disturbance(p);
  vec2 source=p-shift.xy;
  vec2 sampleUV=vec2(source.x/size.x,1.0-source.y/size.y);
  vec4 ink=texture2D(water,clamp(sampleUV,0.0,1.0));
  if(source.x<0.0||source.y<0.0||source.x>size.x||source.y>size.y)ink=vec4(0.0);
  // Recolor only existing ink; transparent water never becomes ring geometry.
  float tone=fract(atan(p.y-origin.y,p.x-origin.x)/6.2831853+0.5)*4.0;
  vec3 accent=tone<1.0?mix(wake0,wake1,tone):tone<2.0?mix(wake1,wake2,tone-1.0):tone<3.0?mix(wake2,wake3,tone-2.0):mix(wake3,wake0,tone-3.0);
  float strength=clamp(shift.z,0.0,1.0);
  ink.rgb=mix(ink.rgb,accent,strength*0.92);
  ink.a=min(1.0,ink.a*(1.0+strength*4.0));
  gl_FragColor=ink;
}`;

/**
 * Four colors sampled around the drop point, in ring order.  A host that owns
 * a wake palette passes its own tones; a monochrome host passes one color four
 * times and gets a single-tone disturbance.  Any CSS Color 4 syntax the
 * platform accepts works — the values are painted, not parsed.
 */
export interface CanvasCreationWaterImpactOptions {
  accents: [string, string, string, string];
  /** Multiplies the drop point's proportions; 1 keeps the reference sizing. */
  visualScale?: number;
  /** Distance the disturbance travels, in canvas pixels.  Defaults to {@link resolveCanvasCreationWaterImpactReach}. */
  reach?: number;
  /**
   * Classes for the pass's own canvas.  The canvas is inserted into the host's
   * own stacking context, so its positioning rules are the host's to supply;
   * the default carries no styles.
   */
  canvasClassName?: string;
}

/** The live pass.  `draw` is cheap; `destroy` must be called to release the context. */
export interface CanvasCreationWaterImpact {
  /** `elapsedSeconds` is measured from the drop, not from the first frame drawn. */
  draw(elapsedSeconds: number): void;
  destroy(): void;
}

/**
 * Proportions of the thing that was dropped, clamped so the disturbance reads
 * the same on a narrow phone and a wide desktop.
 */
export function resolveCanvasCreationWaterImpactScale(pointWidth: number): number {
  const width = Number.isFinite(pointWidth) ? pointWidth : 0;
  return Math.max(
    CANVAS_CREATION_WATER_IMPACT_MIN_SCALE,
    Math.min(
      CANVAS_CREATION_WATER_IMPACT_MAX_SCALE,
      width / CANVAS_CREATION_WATER_IMPACT_REFERENCE_POINT_WIDTH,
    ),
  );
}

/**
 * Distance the leading ring travels from the drop point, in canvas pixels:
 * the drop point to the farthest corner of the water, plus a margin.
 *
 * The margin is what keeps the disturbance from dying at the edge — a ring
 * that ends exactly on the boundary reads as a cut, not as a wave that left
 * the frame.  The result is in canvas pixels, matching what
 * {@link CanvasCreationWaterImpactOptions.reach} expects.
 */
export function resolveCanvasCreationWaterImpactReach(
  width: number,
  height: number,
  originX: number,
  originY: number,
  visualScale = 1,
): number {
  const safeWidth = Number.isFinite(width) ? Math.max(0, width) : 0;
  const safeHeight = Number.isFinite(height) ? Math.max(0, height) : 0;
  const x = Number.isFinite(originX) ? originX : 0;
  const y = Number.isFinite(originY) ? originY : 0;
  const scale = Number.isFinite(visualScale) && visualScale > 0 ? visualScale : 1;
  return (
    Math.hypot(Math.max(x, safeWidth - x), Math.max(y, safeHeight - y)) +
    CANVAS_CREATION_WATER_IMPACT_REACH_MARGIN * scale
  );
}

/**
 * Radius of the leading ring at `elapsedSeconds` — the same curve the shader
 * draws with, so a host can key a reveal mask to the crest instead of
 * approximating it.  `reach` is in the same canvas pixels
 * {@link resolveCanvasCreationWaterImpactReach} returns; the result is too.
 */
export function resolveCanvasCreationWaterImpactRingRadius(
  elapsedSeconds: number,
  reach: number,
): number {
  const elapsed = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
  const age = elapsed - CANVAS_CREATION_WATER_IMPACT_FIRST_RING_DELAY_SECONDS;
  if (age <= 0 || !Number.isFinite(reach)) {
    return 0;
  }
  const progress = Math.max(
    0,
    Math.min(1, age / CANVAS_CREATION_WATER_IMPACT_REACH_SECONDS),
  );
  return reach * Math.pow(progress, CANVAS_CREATION_WATER_IMPACT_REACH_EXPONENT);
}

/**
 * Returns the transparent and opaque stops for a host's circular reveal.
 * Keeping the wave-band padding here makes the visible handoff match the
 * refraction crest in every host instead of letting each adapter invent a mask.
 */
export function resolveCanvasCreationWaterImpactRevealBand(
  elapsedSeconds: number,
  reach: number,
  visualScale = 1,
): { inner: number; outer: number } {
  const scale = Number.isFinite(visualScale) && visualScale > 0 ? visualScale : 1;
  const radius = resolveCanvasCreationWaterImpactRingRadius(elapsedSeconds, reach);
  return {
    inner: Math.max(0, radius - CANVAS_CREATION_WATER_IMPACT_REVEAL_INSET * scale),
    outer: Math.max(0.01, radius + CANVAS_CREATION_WATER_IMPACT_REVEAL_OUTSET * scale),
  };
}

/**
 * Whether the pass still has something to draw.  Hosts stop their frame loop
 * on the first `false` rather than running the clock out.
 */
export function isCanvasCreationWaterImpactActive(elapsedSeconds: number): boolean {
  const elapsed = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
  return elapsed < CANVAS_CREATION_WATER_IMPACT_DURATION_SECONDS;
}

/**
 * Resolves a CSS color string to the sRGB triple the shader wants.
 *
 * The host owns its palette and may express it in any CSS Color 4 syntax the
 * platform supports — oklch included, which WebGL cannot read — so the value is
 * painted rather than parsed, and the browser does the conversion.  Returns
 * null when no context is available, which lets callers fall back instead of
 * silently rendering black.
 */
function resolveAccentBytes(
  paint: CanvasRenderingContext2D | null,
  color: string,
): [number, number, number] | null {
  if (!paint) {
    return null;
  }
  paint.clearRect(0, 0, 1, 1);
  paint.fillStyle = "#000000";
  paint.fillStyle = color;
  paint.fillRect(0, 0, 1, 1);
  const [red, green, blue] = paint.getImageData(0, 0, 1, 1).data;
  return [red / 255, green / 255, blue / 255];
}

/**
 * Mounts the refraction pass over `source` and inserts its own canvas directly
 * after it.  Returns null when WebGL is unavailable or the shader fails to
 * build, so a host can keep whatever it was already doing — the water field is
 * never left hidden on a failure path.
 */
export function mountCanvasCreationWaterImpact(
  source: HTMLCanvasElement,
  origin: { x: number; y: number },
  options: CanvasCreationWaterImpactOptions,
): CanvasCreationWaterImpact | null {
  const scale = options.visualScale ?? 1;
  const canvas = document.createElement("canvas");
  canvas.className = options.canvasClassName ?? CANVAS_CREATION_WATER_IMPACT_CANVAS_CLASS;
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    depth: false,
    powerPreference: "low-power",
  });
  if (!gl) {
    return null;
  }
  const shaders: WebGLShader[] = [];
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let texture: WebGLTexture | null = null;
  let destroyed = false;
  const originalCovered = source.dataset.wbWaterImpactCovered;
  const destroy = (): void => {
    if (destroyed) {
      return;
    }
    destroyed = true;
    if (originalCovered === undefined) delete source.dataset.wbWaterImpactCovered;
    else source.dataset.wbWaterImpactCovered = originalCovered;
    canvas.removeEventListener("webglcontextlost", onContextLost);
    canvas.remove();
    gl.deleteTexture(texture);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    shaders.forEach((shader) => gl.deleteShader(shader));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
  const onContextLost = (event: Event): void => {
    event.preventDefault();
    destroy();
  };
  try {
    const compile = (type: number, code: string): WebGLShader => {
      const shader = gl.createShader(type);
      if (!shader) {
        throw new Error("Water impact shader unavailable");
      }
      shaders.push(shader);
      gl.shaderSource(shader, code);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) || "Water impact compilation failed");
      }
      return shader;
    };
    program = gl.createProgram();
    buffer = gl.createBuffer();
    texture = gl.createTexture();
    if (!program || !buffer || !texture) {
      throw new Error("Water impact resources unavailable");
    }
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error("Water impact linking failed");
    }
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.uniform1i(gl.getUniformLocation(program, "water"), 0);
    gl.uniform2f(gl.getUniformLocation(program, "origin"), origin.x, origin.y);
    gl.uniform1f(gl.getUniformLocation(program, "scale"), scale);
    // The shader divides every distance by `scale` before measuring it, so the
    // reach it is given has to be divided the same way to line up with the
    // pixels the caller measured.
    gl.uniform1f(
      gl.getUniformLocation(program, "reach"),
      (options.reach ?? resolveCanvasCreationWaterImpactReach(
        source.clientWidth,
        source.clientHeight,
        origin.x,
        origin.y,
        scale,
      )) / scale,
    );
    // Canvas resolves CSS Color 4 tokens (including oklch) to sRGB for WebGL.
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    const paint = probe.getContext("2d", { willReadFrequently: true });
    const fallback = resolveAccentBytes(paint, options.accents[0]) ?? [0, 0, 0];
    for (let index = 0; index < 4; index += 1) {
      const bytes = resolveAccentBytes(paint, options.accents[index]) ?? fallback;
      gl.uniform3f(
        gl.getUniformLocation(program, `wake${index}`),
        bytes[0],
        bytes[1],
        bytes[2],
      );
    }
    const size = gl.getUniformLocation(program, "size");
    const time = gl.getUniformLocation(program, "elapsed");
    canvas.addEventListener("webglcontextlost", onContextLost);
    source.after(canvas);
    return {
      draw(elapsed) {
        if (destroyed) {
          return;
        }
        try {
          // Limit this short-lived pass to the existing water backing resolution.
          if (canvas.width !== source.width || canvas.height !== source.height) {
            canvas.width = source.width;
            canvas.height = source.height;
            gl.viewport(0, 0, canvas.width, canvas.height);
          }
          gl.uniform2f(size, source.clientWidth, source.clientHeight);
          gl.uniform1f(time, elapsed);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          source.dataset.wbWaterImpactCovered = "";
          canvas.dataset.elapsed = elapsed.toFixed(3);
        } catch {
          destroy();
        }
      },
      destroy,
    };
  } catch {
    destroy();
    return null;
  }
}
