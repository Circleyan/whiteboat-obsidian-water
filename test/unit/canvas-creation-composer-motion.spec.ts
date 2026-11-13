import { afterEach, describe, expect, it, vi } from "vitest";
import { registerCanvasCreationWaterImpact, mountCanvasCreationWaterImpact } from "../../src/features/canvas-creation-water-impact";
import { CanvasCreationComposerMotion } from "../../src/features/canvas-creation-composer-motion";

afterEach(()=>vi.unstubAllGlobals());

function fixture(reduced=false) {
  const runs: Array<{frames: Keyframe[];options: KeyframeAnimationOptions;cancel: ReturnType<typeof vi.fn>;finish:()=>void}> = [];
  const composer={ownerDocument:{defaultView:{performance, requestAnimationFrame:(cb: FrameRequestCallback)=>requestAnimationFrame(cb), cancelAnimationFrame:(id: number)=>cancelAnimationFrame(id)}},dataset:{} as Record<string,string>,style:{visibility:""},isConnected:true,
    classList:{contains:()=>true},getBoundingClientRect:()=>({left:0,top:0,width:400,height:224}),querySelectorAll:()=>[],
    animate(frames:Keyframe[],options:KeyframeAnimationOptions){let finish!:()=>void,reject!:()=>void;const finished=new Promise<void>((yes,no)=>{finish=yes;reject=()=>no(new Error("cancelled"));});const cancel=vi.fn(reject);runs.push({frames,options,cancel,finish});return {finished,cancel};},
  };
  const water={ownerDocument:{defaultView:{getComputedStyle:()=>({color:"#ffffff",getPropertyValue:()=>""})}},getBoundingClientRect:()=>({left:0,top:0,width:1000,height:700})};
  const createElement=vi.fn(()=>({className:"",setAttribute:vi.fn(),getContext:()=>null}));
  vi.stubGlobal("document",{createElement});
  vi.stubGlobal("createEl",createElement);
  vi.stubGlobal("requestAnimationFrame",vi.fn(()=>42));
  vi.stubGlobal("cancelAnimationFrame",vi.fn());
  const motion=new CanvasCreationComposerMotion(composer as unknown as HTMLFormElement,water as HTMLCanvasElement,()=>reduced);
  return {motion,composer,water,runs,createElement};
}

describe("Home composer motion lifecycle",()=>{
  it("drives the registered short-line material with the submission clock and releases it on reset",async()=>{
    const f=fixture(),draw=vi.fn(),destroy=vi.fn();
    const factory=vi.fn((_origin: {x:number;y:number})=>({draw,destroy}));
    const unregister=registerCanvasCreationWaterImpact(f.water as HTMLCanvasElement,factory);
    const finished=f.motion.confirm(true);
    expect(factory).toHaveBeenCalledOnce();
    expect(factory.mock.calls[0][0]).toEqual({x:200,y:112});
    expect(f.createElement).not.toHaveBeenCalled();
    const tick=vi.mocked(requestAnimationFrame).mock.calls[0][0];tick(performance.now()+950);
    expect(draw).toHaveBeenCalledOnce();expect(draw.mock.calls[0][0]).toBeGreaterThan(.9);
    f.motion.reset();await finished;expect(destroy).toHaveBeenCalledOnce();
    unregister();
    expect(mountCanvasCreationWaterImpact(f.water as HTMLCanvasElement,{x:0,y:0},{accents:["#fff","#fff","#fff","#fff"]})).toBeNull();
  });

  it("reduces confirmation to a short fade with no water/GPU allocation",async()=>{
    const f=fixture(true);const finished=f.motion.confirm(true);
    expect(f.createElement).not.toHaveBeenCalled();
    expect(f.runs[0].options.duration).toBe(80);
    expect(f.runs[0].frames.every(frame=>!frame.transform || frame.transform==="translate(0, 0) scale(1)")).toBe(true);
    f.runs[0].finish();await finished;f.motion.destroy();
    expect(f.runs[0].cancel).toHaveBeenCalled();
  });

  it("releases a pending confirmation when Home closes, even without WebGL",async()=>{
    const f=fixture();const finished=f.motion.confirm(true);
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    f.motion.destroy();await expect(finished).resolves.toBeUndefined();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
    expect(f.runs.every(run=>run.cancel.mock.calls.length===1)).toBe(true);
    expect(f.composer.dataset.motion).toBeUndefined();
  });

  it("reveals the host through a growing circular mask and restores it on disposal",async()=>{
    const f=fixture();
    const surface={style:{maskImage:"none"},dataset:{} as Record<string,string>,getBoundingClientRect:()=>({left:0,top:0})};
    const finished=f.motion.confirm(true,{surface:surface as unknown as HTMLElement,center:{x:400,y:350}});
    const tick=vi.mocked(requestAnimationFrame).mock.calls[0][0];
    tick(performance.now()+1100);
    expect(surface.style.maskImage).toContain("radial-gradient(circle at 400px 350px");
    const radius=Number(surface.dataset.revealRadius);
    tick(performance.now()+1400);
    expect(Number(surface.dataset.revealRadius)).toBeGreaterThan(radius);
    f.motion.destroy();await finished;
    expect(surface.style.maskImage).toBe("none");
    expect(surface.dataset.revealRadius).toBeUndefined();
  });

  it("does not let an interrupted cancellation hide the reopened composer",async()=>{
    const f=fixture();f.motion.cancel();f.motion.reset();f.motion.appear();
    await Promise.resolve();await Promise.resolve();
    expect(f.composer.style.visibility).toBe("");
    expect(f.composer.dataset.motion).not.toBe("closed");
    f.motion.destroy();
  });
});
