import { CANVAS_CREATION_COMPOSER_MOTION as MOTION } from "whiteboat-core";
import {
  CANVAS_CREATION_WATER_IMPACT_DURATION_SECONDS,
  CANVAS_CREATION_WATER_IMPACT_FIRST_RING_DELAY_SECONDS,
  mountCanvasCreationWaterImpact,
  resolveCanvasCreationWaterImpactReach,
  resolveCanvasCreationWaterImpactRevealBand,
  resolveCanvasCreationWaterImpactScale,
  type CanvasCreationWaterImpact,
} from "./canvas-creation-water-impact";

/** Host token names; core only needs the values they resolve to. */
const WAKE_ACCENT_TOKENS = [
  "--wb-entry-wake-accent-01",
  "--wb-entry-wake-accent-02",
  "--wb-entry-wake-accent-03",
  "--wb-entry-wake-accent-04",
] as const;

/**
 * Obsidian's water palette, read off the water the pass will refract.  The
 * tokens are defined at the root and inherit down, so the source canvas and
 * the composer resolve to the same values; the fallback keeps a host without
 * them on a single tone rather than on black.
 */
function readWakeAccents(source: HTMLElement): [string, string, string, string] {
  const tokens = getComputedStyle(source);
  const fallback = tokens.color;
  return WAKE_ACCENT_TOKENS.map((name) => tokens.getPropertyValue(name).trim() || fallback) as [
    string, string, string, string,
  ];
}

const STILL = { opacity: 1, transform: "translate(0, 0) scale(1)", filter: "blur(0px)" };
const WISP = { opacity: 0, transform: "translate(76px, -9px) scale(1.22, .7)", filter: "blur(15px)" };

/** Owns presentation only. The modal retains the one live input and submission. */
export class CanvasCreationComposerMotion {
  private animations = new Set<Animation>();
  private ghosts = new Set<HTMLElement>();
  private impact: CanvasCreationWaterImpact | null = null;
  private frame: number | null = null;
  private finishConfirmation: (() => void) | null = null;
  private generation = 0;
  private restoreReveal: (() => void) | null = null;

  private get ownerWindow(): Window {
    return this.composer.ownerDocument.defaultView!;
  }

  constructor(private readonly composer: HTMLFormElement,
    private readonly water: HTMLCanvasElement,
    private readonly reduced: () => boolean,
    private readonly onImpact?: () => void) {
    composer.dataset.motion = "closed";
  }

  private animate(element: HTMLElement, frames: Keyframe[], duration: number, easing: string, retain = false): Promise<void> {
    if (!element.animate) return Promise.resolve();
    const animation=element.animate(frames,{duration,easing,fill:"both"});
    this.animations.add(animation);
    return animation.finished.catch(()=>{}).then(()=>{
      if (!retain) { animation.cancel();this.animations.delete(animation); }
    });
  }

  reset(): void {
    this.generation += 1;
    this.restoreReveal?.();this.restoreReveal=null;
    if (this.frame!==null) this.ownerWindow.cancelAnimationFrame(this.frame);
    this.frame=null;
    this.impact?.destroy();this.impact=null;
    this.animations.forEach(animation=>animation.cancel());this.animations.clear();
    this.ghosts.forEach(ghost=>ghost.remove());this.ghosts.clear();
    this.composer.dataset.motion=this.composer.classList.contains("is-open")?"open":"closed";
    this.finishConfirmation?.();this.finishConfirmation=null;
  }

  /** Called before position changes; the outgoing picture has no input or events. */
  leavePicture(): HTMLElement | null {
    if (this.reduced()) return null;
    const ghost=createDiv();
    ghost.className="whiteboat-canvas-entry__composer-ghost";
    ghost.style.cssText=this.composer.style.cssText;
    ghost.style.width=`${this.composer.offsetWidth}px`;
    ghost.style.height=`${this.composer.offsetHeight}px`;
    ghost.setAttribute("aria-hidden","true");ghost.setAttribute("inert","");
    for (const child of Array.from(this.composer.children)) ghost.append(child.cloneNode(true));
    const original=this.composer.querySelector("textarea");
    const field=ghost.querySelector("textarea");
    if (field && original) {
      const echo=createDiv();echo.className=field.className;
      echo.style.cssText=field.style.cssText;echo.classList.add("whiteboat-canvas-entry__idea-echo");
      echo.textContent=original.value||original.placeholder;field.replaceWith(echo);
    }
    ghost.querySelectorAll("[id], [aria-labelledby], [role]").forEach(el=>{
      el.removeAttribute("id");el.removeAttribute("aria-labelledby");el.removeAttribute("role");
    });
    this.composer.after(ghost);this.ghosts.add(ghost);
    return ghost;
  }

  appear(ghost: HTMLElement | null = null): Promise<void> {
    const generation=this.generation;
    this.composer.dataset.motion=ghost?"relocating":"appearing";
    if (ghost) void this.animate(ghost,[STILL,WISP],MOTION.relocateGhost.durationMs,MOTION.relocateGhost.easing)
      .then(()=>{ghost.remove();this.ghosts.delete(ghost);});
    const from=this.reduced()?{opacity:0}:{opacity:0,transform:"translateY(18px) scale(.975)",filter:"blur(10px)"};
    return this.animate(this.composer,[from,STILL],this.reduced()?MOTION.reducedDurationMs:MOTION.appear.durationMs,MOTION.appear.easing)
      .then(()=>{if (generation===this.generation && this.composer.classList.contains("is-open") && ["appearing","relocating"].includes(this.composer.dataset.motion||"")) this.composer.dataset.motion="open";});
  }

  cancel(): void {
    this.reset();
    this.composer.dataset.motion="cancelling";
    void this.animate(this.composer,[STILL,this.reduced()?{opacity:0}:WISP],this.reduced()?MOTION.reducedDurationMs:MOTION.cancel.durationMs,MOTION.cancel.easing)
      .then(()=>{if (this.composer.dataset.motion==="cancelling") {this.composer.dataset.motion="closed";}});
  }

  impactCenter(): {x: number; y: number} {
    const rect=this.composer.getBoundingClientRect();
    return {x:rect.left+rect.width*.5,y:rect.top+rect.height*.5};
  }

  confirm(hasContent: boolean, reveal?: {surface: HTMLElement; center: {x: number; y: number}}): Promise<void> {
    this.reset();this.composer.dataset.motion="confirming";
    if (this.reduced() || !hasContent) {
      return this.animate(this.composer,[STILL,{opacity:0}],this.reduced()?MOTION.reducedDurationMs:MOTION.confirm.plainDurationMs,"ease-out",true);
    }
    const rect=this.composer.getBoundingClientRect(),waterRect=this.water.getBoundingClientRect();
    const scale=resolveCanvasCreationWaterImpactScale(rect.width);
    const center=reveal?.center ?? this.impactCenter();
    const origin={x:center.x-waterRect.left,y:center.y-waterRect.top};
    const reach=resolveCanvasCreationWaterImpactReach(waterRect.width,waterRect.height,origin.x,origin.y,scale);
    this.impact=mountCanvasCreationWaterImpact(this.water,origin,{
      accents:readWakeAccents(this.water),
      visualScale:scale,
      reach,
      canvasClassName:"whiteboat-canvas-entry__water-canvas whiteboat-canvas-entry__water-impact",
    });
    const dx=center.x-(rect.left+rect.width*.5),dy=center.y-(rect.top+rect.height*.5);
    const transform=(y: number,x: number,sy: number)=>`translate(${dx*Math.max(0,y/44)}px, ${y<0?y*scale:dy*y/44}px) scale(${x}, ${sy})`;
    let revealFrame: ((elapsed: number) => void) | undefined;
    if (reveal) {
      const surface=reveal.surface,bounds=surface.getBoundingClientRect();
      const previous=surface.style.maskImage;
      this.restoreReveal=()=>{surface.style.maskImage=previous;delete surface.dataset.revealRadius;};
      revealFrame=(elapsed)=>{
        if(elapsed<=CANVAS_CREATION_WATER_IMPACT_FIRST_RING_DELAY_SECONDS)return;
        const {inner,outer}=resolveCanvasCreationWaterImpactRevealBand(elapsed,reach,scale);
        surface.style.maskImage=`radial-gradient(circle at ${center.x-bounds.left}px ${center.y-bounds.top}px, transparent ${inner}px, black ${outer}px)`;
        surface.dataset.revealRadius=inner.toFixed(2);
      };
    }
    void this.animate(this.composer,[
      {...STILL,offset:0,easing:"ease-out"},
      {opacity:1,transform:transform(-6,.985,.985),offset:.30,easing:"cubic-bezier(.55,.055,.675,.19)"},
      {opacity:1,transform:transform(6,.57,.39),offset:.70,easing:"cubic-bezier(.55,.055,.675,.19)"},
      {opacity:1,transform:transform(30,.22,.1),offset:.92},
      {opacity:0,transform:transform(44,.13,.014),offset:1},
    ],MOTION.confirm.durationMs,"linear",true);
    this.composer.querySelectorAll<HTMLElement>(".whiteboat-canvas-entry__composer-header, .whiteboat-canvas-entry__composer-body")
      .forEach(el=>{void this.animate(el,[{opacity:1,offset:0},{opacity:1,offset:.3},{opacity:0,offset:1}],MOTION.confirm.fadeDurationMs,"ease-in",true);});
    return new Promise(resolve=>{
      const started=this.ownerWindow.performance.now();
      this.finishConfirmation=resolve;
      const tick=(now: number)=>{
        this.frame=null;
        const elapsed=(now-started)/1000;
        if (!this.composer.isConnected || this.reduced() || elapsed>=CANVAS_CREATION_WATER_IMPACT_DURATION_SECONDS) {
          revealFrame?.(CANVAS_CREATION_WATER_IMPACT_DURATION_SECONDS);
          this.impact?.destroy();this.impact=null;
          this.finishConfirmation=null;resolve();return;
        }
        this.impact?.draw(elapsed);
        revealFrame?.(elapsed);
        if (elapsed>=CANVAS_CREATION_WATER_IMPACT_FIRST_RING_DELAY_SECONDS) {
          if (this.composer.dataset.motion !== "impact") this.onImpact?.();
          this.composer.dataset.motion="impact";
        }
        this.frame=this.ownerWindow.requestAnimationFrame(tick);
      };
      this.frame=this.ownerWindow.requestAnimationFrame(tick);
    });
  }

  destroy(): void { this.reset();delete this.composer.dataset.motion; }
}
