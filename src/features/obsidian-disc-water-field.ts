import {
  CanvasCreationWaterField as CoreWaterField,
  CANVAS_CREATION_WATER_DEFAULTS,
  resolveCanvasCreationWaterFlowTiming,
  type CanvasCreationWaterBoat,
  type CanvasCreationWaterFocus,
} from "whiteboat-core";
import { WaterRenderer } from "../../experiments/water-shader-lab/renderer.mjs";
import { WaterPressure } from "../../experiments/water-shader-lab/pressure.mjs";
import { InspirationBursts } from "../../experiments/water-shader-lab/field.mjs";
import { normalizeCanvasWaterScale, normalizeDiscWaterSettings, type DiscWaterSettings } from "./disc-water-settings";

type Options = Omit<ConstructorParameters<typeof CoreWaterField>[1], "createProbe" | "ownerWindow"> & {
  getDiscWaterSettings?: () => DiscWaterSettings;
  maxFps?: number;
  maxPixels?: number;
  maxDpr?: number;
  transparentBackground?: boolean;
  getWaterScale?: () => number;
};

/** Obsidian owns lifecycle and interaction; the live lab owns the GPU material. */
export class ObsidianDiscWaterField {
  private renderer: WaterRenderer | null = null;
  private fallback: CoreWaterField | null = null;
  private fallbackCanvas: HTMLCanvasElement | null = null;
  private fallbackConfig = { ...CANVAS_CREATION_WATER_DEFAULTS };
  private readonly pressure = new WaterPressure();
  private readonly bursts = new InspirationBursts();
  private readonly controller = new AbortController();
  private readonly observer: ResizeObserver;
  private readonly themeObserver: MutationObserver;
  private readonly owner: Window;
  private frame = 0;
  private last = 0;
  private paintedAt = 0;
  private time = 2;
  private paused = false;
  private flowScale = 1;
  private flowTransition: { start: number; from: number; to: number; duration: number } | null = null;
  private reduced: boolean;
  private running = false;
  private destroyed = false;
  private lost = false;
  private restorations = 0;
  private recoveryTimer = 0;
  private boat: CanvasCreationWaterBoat | null = null;
  private wakes: {x: number; y: number; heading: number; life: number}[] = [];
  private lastWake = 0;
  private focus: CanvasCreationWaterFocus | null = null;
  private mooring: {x: number; y: number} | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly options: Options) {
    this.owner = canvas.win ?? window;
    this.reduced = options.reducedMotion === true;
    const signal = this.controller.signal;
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault(); this.lost = true; this.last = 0;
      this.stopFrame(); canvas.dataset.waterState = "context-lost";
      this.recoveryTimer = this.owner.setTimeout(() => this.useFallback(), 3000);
    }, {signal});
    canvas.addEventListener("webglcontextrestored", () => {
      this.owner.clearTimeout(this.recoveryTimer);
      if (this.destroyed || this.fallback) return;
      // The old context resources are invalid; never delete them after restoration.
      this.renderer = null; this.lost = false;
      if (++this.restorations > 2) { this.useFallback(); return; }
      this.initialize(); this.last = 0; this.requestRender();
    }, {signal});
    canvas.ownerDocument.addEventListener("visibilitychange", () => {
      this.last = 0;
      if (canvas.ownerDocument.hidden) this.stopFrame(); else this.requestRender();
    }, {signal});
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.themeObserver = new MutationObserver(() => this.refreshColors());
    this.themeObserver.observe(canvas.ownerDocument.body, {attributes: true, attributeFilter: ["class", "style"]});
    this.initialize();
  }

  private initialize(): void {
    try {
      this.renderer = new WaterRenderer(this.canvas, { transparentBackground: this.options.transparentBackground });
      this.canvas.dataset.waterRenderer = "disc-lab-webgl2";
      this.resize();
    } catch (error) {
      this.canvas.dataset.waterError = String(error);
      this.useFallback();
    }
  }

  private useFallback(): void {
    if (this.destroyed || this.fallback) return;
    this.owner.clearTimeout(this.recoveryTimer); this.stopFrame();
    if (!this.lost) this.renderer?.destroy();
    this.renderer = null;
    // A canvas that acquired WebGL cannot acquire 2D: use a sibling surface.
    const replacement = this.canvas.cloneNode(false) as HTMLCanvasElement;
    replacement.removeAttribute("id");
    this.canvas.after(replacement);
    this.fallbackCanvas = replacement;
    replacement.dataset.waterRenderer = "canvas2d-fallback";
    this.canvas.dataset.waterState = "fallback";
    this.updateDrawingBudget();
    this.fallback = new CoreWaterField(replacement, {...this.options,
      config: this.fallbackConfig,
      createProbe: root => root.createDiv(), ownerWindow: this.owner,
    });
    this.fallback.setBoat(this.boat); this.fallback.setFocus(this.focus);
    this.fallback.setMooring(this.mooring); this.fallback.setFlowPaused(this.paused);
    if (this.running) this.fallback.start();
  }

  private settings(): DiscWaterSettings {
    const settings = normalizeDiscWaterSettings(this.options.getDiscWaterSettings?.());
    settings.spacing *= (this.options.getWaterScale ? normalizeCanvasWaterScale(this.options.getWaterScale()) : 1);
    return settings;
  }

  private updateDrawingBudget(): number {
    const rect = this.canvas.getBoundingClientRect();
    const scale = Math.min(this.owner.devicePixelRatio || 1, this.options.maxDpr ?? 1.5, Math.sqrt((this.options.maxPixels ?? 4000000)/Math.max(1, rect.width*rect.height)));
    Object.assign(this.fallbackConfig, {
      spacing: CANVAS_CREATION_WATER_DEFAULTS.spacing * (this.options.getWaterScale ? normalizeCanvasWaterScale(this.options.getWaterScale()) : 1),
      compactSpacing: CANVAS_CREATION_WATER_DEFAULTS.compactSpacing * (this.options.getWaterScale ? normalizeCanvasWaterScale(this.options.getWaterScale()) : 1),
      lowPowerSpacing: CANVAS_CREATION_WATER_DEFAULTS.lowPowerSpacing * (this.options.getWaterScale ? normalizeCanvasWaterScale(this.options.getWaterScale()) : 1),
      dashLength: CANVAS_CREATION_WATER_DEFAULTS.dashLength * (this.options.getWaterScale ? normalizeCanvasWaterScale(this.options.getWaterScale()) : 1),
      compactDashLength: CANVAS_CREATION_WATER_DEFAULTS.compactDashLength * (this.options.getWaterScale ? normalizeCanvasWaterScale(this.options.getWaterScale()) : 1),
      lineWidth: CANVAS_CREATION_WATER_DEFAULTS.lineWidth * (this.options.getWaterScale ? normalizeCanvasWaterScale(this.options.getWaterScale()) : 1),
      targetFps: this.options.maxFps ?? 60,
      lowPowerFps: Math.min(this.options.maxFps ?? 60, CANVAS_CREATION_WATER_DEFAULTS.lowPowerFps),
      maxPixelRatio: scale, lowPowerPixelRatio: scale,
    });
    return scale;
  }

  resize(): void {
    if (this.destroyed || (this.lost && !this.fallback)) return;
    const rect = this.canvas.getBoundingClientRect();
    const scale = this.updateDrawingBudget();
    this.fallback?.resize();
    if (this.renderer) {
      this.renderer.resize();
      this.renderer.dpr = scale;
      this.canvas.width = Math.max(1, Math.round(rect.width*scale));
      this.canvas.height = Math.max(1, Math.round(rect.height*scale));
      this.paintedAt = 0;
      // ResizeObserver runs before paint: redraw now to avoid an empty surface.
      if (this.running && !this.canvas.ownerDocument.hidden) { this.stopFrame(); this.render(this.owner.performance.now()); }
      else this.requestRender();
    }
  }

  refreshColors(): void { this.fallback?.refreshColors(); this.requestRender(); }
  setReducedMotion(value: boolean): void {
    if (this.reduced === value) return;
    this.reduced = value; this.last = 0;
    if (value) { this.flowTransition = null; this.flowScale = this.paused ? 0 : 1; }
    this.fallback?.setReducedMotion(value); this.requestRender();
  }
  setFlowPaused(value: boolean): void {
    if (this.paused === value) return;
    this.paused = value;
    const timing = resolveCanvasCreationWaterFlowTiming(this.reduced);
    const duration = value ? timing.pauseDurationMs : timing.resumeDurationMs;
    this.flowTransition = duration ? { start: this.owner.performance.now(), from: this.flowScale, to: value ? 0 : 1, duration } : null;
    if (!duration) this.flowScale = value ? 0 : 1;
    this.fallback?.setFlowPaused(value); this.requestRender();
  }
  setFocus(value: CanvasCreationWaterFocus | null): void {
    if (JSON.stringify(value) === JSON.stringify(this.focus)) return;
    this.focus = value; this.fallback?.setFocus(value);
    this.canvas.style.setProperty("mask-image", value ? `radial-gradient(ellipse ${value.rx}px ${value.ry}px at ${value.x}px ${value.y}px, black 45%, rgba(0,0,0,${1-(value.amount ?? 0)*.9}) 100%)` : "");
    this.requestRender();
  }
  setMooring(value: {x: number; y: number} | null): void {
    if (value?.x === this.mooring?.x && value?.y === this.mooring?.y) return;
    this.mooring = value; this.fallback?.setMooring(value); this.requestRender();
  }
  setBoat(value: CanvasCreationWaterBoat | null): void {
    if (this.reduced && this.boat) return;
    if (JSON.stringify(value) === JSON.stringify(this.boat)) return;
    if (value?.visible && value.speed > .04 && this.time - this.lastWake > .08) {
      const r = this.canvas.getBoundingClientRect();
      this.wakes.push({x:value.x-r.width/2,y:value.y-r.height/2,heading:value.heading,life:1});
      this.wakes = this.wakes.slice(-24); this.lastWake = this.time;
    }
    this.boat = value ? {...value} : null; this.fallback?.setBoat(value); this.requestRender();
  }
  triggerInspiration(x?: number, y?: number): void {
    const r = this.canvas.getBoundingClientRect();
    this.bursts.trigger((x ?? this.boat?.x ?? r.width/2)-r.width/2, (y ?? this.boat?.y ?? r.height/2)-r.height/2, this.reduced);
    this.requestRender();
  }
  drop(): void {
    if (!this.renderer || this.lost) return;
    const s=this.settings(); this.renderer.drop(0,0,s.weight,s.view,this.reduced || this.paused);
    this.requestRender();
  }
  start(): void { this.running = true; this.fallback?.start(); this.requestRender(); }

  private stopFrame(): void { if (this.frame) this.owner.cancelAnimationFrame(this.frame); this.frame=0; }
  private requestRender(): void {
    if (!this.frame && this.running && !this.destroyed && !this.lost && this.renderer && !this.canvas.ownerDocument.hidden)
      this.frame = this.owner.requestAnimationFrame(now => this.render(now));
  }
  private render(now: number): void {
    this.frame=0;
    if (!this.renderer || this.destroyed || this.lost || this.canvas.ownerDocument.hidden) return;
    const frameDuration = 1000 / (this.options.maxFps ?? 60);
    if (!this.reduced && this.paintedAt && now - this.paintedAt < frameDuration - .5) { this.requestRender(); return; }
    this.paintedAt = now;
    const s=this.settings(), rect=this.canvas.getBoundingClientRect();
    const dt=this.last && !this.reduced ? Math.min((now-this.last)/1000,.05) : 0;
    this.last=now;
    if (this.flowTransition) {
      const transition = this.flowTransition;
      const p = Math.max(0, Math.min(1, (now - transition.start) / transition.duration));
      const eased = this.paused ? 1 - Math.pow(1 - p, 5) : (p < .5 ? 4*p*p*p : 1 - Math.pow(-2*p+2, 3)/2);
      this.flowScale = transition.from + (transition.to - transition.from)*eased;
      if (p === 1) { this.flowScale = transition.to; this.flowTransition = null; }
    }
    const elapsed=dt*s.speed*this.flowScale*(this.options.flowTimeScale??1);
    this.time+=elapsed;
    this.bursts.advance(dt);
    this.wakes=this.wakes.map(w=>({...w,life:w.life-dt/1.7})).filter(w=>w.life>0);
    const boat=this.boat ? {...this.boat,x:this.boat.x-rect.width/2,y:this.boat.y-rect.height/2,wakes:this.wakes} : null;
    try {
      this.renderer.ensureSolver(s.view, s.mode === 3);
      this.renderer.advance(elapsed,s.view,(step: number)=>{
        this.pressure.advance(step);return this.pressure.sources(boat,s.pressure,s.mode!==3);
      });
      this.renderer.draw({...s,dark:this.canvas.ownerDocument.body.classList.contains("theme-dark"),boat,
        reducedMotion:this.reduced,inspirations:this.bursts.events},this.time);
      Object.assign(this.canvas.dataset,{waterState:this.reduced?"static":"running",waterFrames:String(this.renderer.frames),
        flowTime:String(this.time),flowScale:String(this.flowScale),waterMode:String(s.mode),waterViewAngle:String(s.view)});
    } catch (error) { this.canvas.dataset.waterError=String(error); this.useFallback(); return; }
    if (!this.reduced) this.requestRender();
  }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed=true;this.stopFrame();this.owner.clearTimeout(this.recoveryTimer);
    this.controller.abort();this.observer.disconnect();this.themeObserver.disconnect();
    if (!this.lost) this.renderer?.destroy();
    this.renderer=null;this.fallback?.destroy();this.fallbackCanvas?.remove();
    this.canvas.style.removeProperty("visibility");this.canvas.style.removeProperty("mask-image");
    this.canvas.dataset.waterState="destroyed";
  }
}
