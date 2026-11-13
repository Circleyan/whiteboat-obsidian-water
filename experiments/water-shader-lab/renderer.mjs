import { vertexSource, fragmentSource } from './shaders.mjs';
import { WaveSolver } from './solver.mjs';
import { WaterPressure } from './pressure.mjs';
import { REFERENCE_DEFAULTS, FUSION_DEFAULTS, INSPIRATION_DEFAULTS, referenceExtent } from './field.mjs';

export class WaterRenderer {
  constructor(canvas, { transparentBackground = false } = {}) {
    this.canvas = canvas;
    this.transparentBackground = transparentBackground;
    const gl = this.gl = canvas.getContext('webgl2', { alpha: transparentBackground, antialias: false });
    if (!gl) throw new Error('当前浏览器无法使用 WebGL 2，请换一个支持图形加速的浏览器。');
    const shaders = [];
    const program = this.program = gl.createProgram();
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
        const shader = gl.createShader(type);
        shaders.push(shader);
        gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
        gl.attachShader(program, shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    } catch (error) { gl.deleteProgram(program); throw error; }
    finally { shaders.forEach(shader => gl.deleteShader(shader)); }
    gl.useProgram(program);
    this.transparentUniform = gl.getUniformLocation(program, 'transparentBackground');
    this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
    this.buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    this.uniforms = Object.fromEntries(['resolution','dpr','time','strength','spacing','curvature','roughness','azimuth','elevation','view','mode','dark','swirl','brightness','waterBase','waterInk','focusArea','focusAmount','focusFloor','impactFrame','impactTiming','impactReach','impactActive','boatFrame','boatRoll','boatVisible','wakeCount','reducedMotion','wakes[0]','waveState','waveExtent','inspirations[0]','inspirationCount'].map(name => [name, gl.getUniformLocation(program,name)]));
    this.frames = 0;
    this.accumulator=0;
  }
  ensureSolver(pitch,reference=this.reference||false) {
    this.reference=reference;
    const rect=this.canvas.getBoundingClientRect(), key=`${Math.round(rect.width)}:${Math.round(rect.height)}:${pitch}:${reference}`;
    if(key!==this.solverKey) {
      this.solver?.destroy();this.solver=new WaveSolver(this.gl,rect.width,rect.height,pitch,reference?referenceExtent(rect.width,rect.height,pitch):undefined);
      this.solverKey=key;this.accumulator=0;
    }
  }
  advance(elapsed,pitch,sourceAt=()=>({})) {
    this.ensureSolver(pitch);this.accumulator+=Math.min(elapsed,0.05);
    while(this.accumulator>=this.solver.step){this.solver.update(sourceAt(this.solver.step));this.accumulator-=this.solver.step;}
  }
  drop(x,y,weight,pitch,staticOnly=false) {
    this.ensureSolver(pitch);this.solver.drop(x,y,weight);
    if(staticOnly)for(let i=0;i<Math.round(0.7/this.solver.step);i++)this.solver.update();
  }
  clear(pitch,reference=this.reference||false) {this.solverKey=null;this.ensureSolver(pitch,reference);}
  draw(settings, time, width = this.canvas.width, height = this.canvas.height, dpr = this.dpr) {
    const gl = this.gl, u = this.uniforms;
    gl.useProgram(this.program); gl.bindVertexArray(this.vao); gl.viewport(0,0,width,height);
    gl.uniform1i(this.transparentUniform,this.transparentBackground ? 1 : 0);
    gl.uniform2f(u.resolution,width,height); gl.uniform1f(u.dpr,dpr); gl.uniform1f(u.time,time);
    for (const name of ['strength','spacing','curvature','roughness','azimuth','elevation','view','swirl','brightness']) gl.uniform1f(u[name],settings[name]);
    gl.uniform3fv(u.waterBase,settings.dark?[0.072,0.088,0.099]:[0.985,0.995,1.0]);
    // Existing quiet/strong water tones: dark #e2ebf1, light #262626.
    gl.uniform3fv(u.waterInk,settings.dark?[226/255,235/255,241/255]:[38/255,38/255,38/255]);
    // Host focus uses top-left CSS coordinates; the material uses centered screen coordinates.
    const focus=settings.focus;
    gl.uniform4f(u.focusArea,focus ? focus.x-width/dpr/2 : 0,focus ? focus.y-height/dpr/2 : 0,
      Math.max(1,(focus?.rx||0)+(focus?.padding||0)),Math.max(1,(focus?.ry||0)+(focus?.padding||0)));
    gl.uniform1f(u.focusAmount,Math.max(0,Math.min(1,focus?.amount||0)));
    gl.uniform1f(u.focusFloor,Math.max(0,Math.min(1,settings.focusFloor ?? .3)));
    const impact=settings.impact;
    gl.uniform1i(u.impactActive,impact && !settings.reducedMotion ? 1 : 0);
    gl.uniform4f(u.impactFrame,impact ? impact.x-width/dpr/2 : 0,impact ? impact.y-height/dpr/2 : 0,impact?.elapsed||0,impact?.scale||1);
    gl.uniform4f(u.impactTiming,impact?.delay||0,impact?.gap||0,impact?.travel||1,impact?.exponent||1);
    gl.uniform1f(u.impactReach,impact ? impact.reach/impact.scale : 0);
    const boat=settings.boat,cp=Math.cos(settings.view*Math.PI/180);
    gl.uniform1i(u.boatVisible,boat?.visible?1:0);gl.uniform1i(u.reducedMotion,settings.reducedMotion?1:0);
    gl.uniform4f(u.boatFrame,boat?.x||0,(boat?.y||0)*cp,boat?.heading||0,boat?.speed||0);
    gl.uniform1f(u.boatRoll,boat?.roll||0);
    const wakeData=new Float32Array(24*4),wakes=boat?.wakes||[];
    wakes.slice(-24).forEach((w,i)=>wakeData.set([w.x,w.y*cp,w.heading,w.life],i*4));
    gl.uniform1i(u.wakeCount,Math.min(24,wakes.length));gl.uniform4fv(u['wakes[0]'],wakeData);
    const events=settings.inspirations||[],eventData=new Float32Array(9);
    events.slice(-3).forEach((e,i)=>eventData.set([e.x,e.y,e.age],i*3));
    gl.uniform1i(u.inspirationCount,Math.min(3,events.length));gl.uniform3fv(u['inspirations[0]'],eventData);
    gl.uniform1i(u.mode,settings.mode); gl.uniform1i(u.dark,settings.dark ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.solver.texture);
    gl.uniform1i(u.waveState,0);gl.uniform2f(u.waveExtent,...this.solver.extent);
    gl.drawArrays(gl.TRIANGLES,0,3);
    this.frames++;
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.max(1,Math.round(rect.width*this.dpr));
    this.canvas.height = Math.max(1,Math.round(rect.height*this.dpr));
  }
  probe(settings) {
    // Offscreen GPU readback verifies compiled shader output, not a CPU stand-in.
    const gl=this.gl, size=240, texture=gl.createTexture(), fb=gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
    try {
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) throw new Error('GPU probe framebuffer incomplete');
      this.ensureSolver(settings.view);
      const capture=(s,t)=>{
        gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
        this.draw({...settings,...s},t,size,size,1);
        const pixels=new Uint8Array(size*size*4);
        gl.readPixels(0,0,size,size,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        return pixels;
      };
      const a=capture({dark:true,mode:0},2);
      const difference=b=>a.reduce((sum,value,i)=>sum+(i%4!==3?Math.abs(value-b[i]):0),0)/(size*size*3);
      const next=capture({dark:true,mode:0},3);
      const waveDifference=difference(next);
      let brightPixels=0,quietPixels=0,brightTransitions=0;
      for(let i=0;i<a.length;i+=4){
        const bright=a[i]>120 && a[i+1]>120 && a[i+2]>120;
        if(bright)brightPixels++;
        if(a[i]<50 && a[i+1]<50 && a[i+2]<50)quietPixels++;
        if(bright!==(next[i]>120 && next[i+1]>120 && next[i+2]>120))brightTransitions++;
      }
      const lightDifference=difference(capture({dark:true,mode:0,azimuth:settings.azimuth+50},2));
      const curvatureDifference=difference(capture({dark:true,mode:0,curvature:0},2));
      const swirlDifference=difference(capture({dark:true,mode:0,swirl:0},2));
      const boatPixels=capture({dark:true,mode:0,boat:{x:0,y:0,heading:0,speed:0,roll:.07,visible:true,wakes:[]}},2);
      const boatDifference=difference(boatPixels);
      const wakePixels=capture({dark:true,mode:0,boat:{x:0,y:0,heading:0,speed:1,roll:0,visible:true,wakes:[{x:0,y:0,heading:0,life:1}]}},2);
      const wakeDifference=difference(wakePixels);
      const countColor=pixels=>{let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+1]>pixels[i+2]+3||pixels[i]>pixels[i+1]+3||pixels[i+2]>pixels[i+1]+8)count++;return count;};
      const coloredPixels=countColor(boatPixels),wakeColoredPixels=countColor(wakePixels);
      const normalDifference=difference(capture({dark:true,mode:2},2));
      const reference=capture({...REFERENCE_DEFAULTS,mode:3},2);
      const referenceDifference=b=>reference.reduce((sum,value,i)=>sum+(i%4!==3?Math.abs(value-b[i]):0),0)/(size*size*3);
      const referenceWave=referenceDifference(capture({...REFERENCE_DEFAULTS,mode:3},3));
      const referenceLight=referenceDifference(capture({...REFERENCE_DEFAULTS,mode:3,azimuth:30},2));
      const fusion=capture({...FUSION_DEFAULTS,mode:4},2);
      const fusionDifference=b=>fusion.reduce((sum,value,i)=>sum+(i%4!==3?Math.abs(value-b[i]):0),0)/(size*size*3);
      const fusionWave=fusionDifference(capture({...FUSION_DEFAULTS,mode:4},3));
      const fusionLight=fusionDifference(capture({...FUSION_DEFAULTS,mode:4,azimuth:140},2));
      const fusionColor=capture({...FUSION_DEFAULTS,mode:4,boat:{x:0,y:0,heading:0,speed:0,roll:.07,visible:true,wakes:[]}},2);
      const fusionColoredPixels=countColor(fusionColor);
      const daily=capture({...INSPIRATION_DEFAULTS,mode:5},2);
      const burst=capture({...INSPIRATION_DEFAULTS,mode:5,inspirations:[{x:0,y:0,age:1.5}]},2);
      const returned=capture({...INSPIRATION_DEFAULTS,mode:5,inspirations:[{x:0,y:0,age:5.2}]},2);
      const brightCount=pixels=>{let n=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>80&&pixels[i+1]>80&&pixels[i+2]>80)n++;return n;};
      const dailyBright=brightCount(daily),burstBright=brightCount(burst);
      const returnDifference=daily.reduce((s,v,i)=>s+Math.abs(v-returned[i]),0);
      this.solver.drop(0,0,1);
      const measure=()=>{
        const pixels=this.solver.sample(),[sx,sy]=this.solver.size,[ex,ey]=this.solver.extent;
        let maxHeight=0,maxVelocity=0,finite=true,radius=0,energy=0,center=0;
        for(let i=0;i<pixels.length;i+=4){
          const h=pixels[i],v=pixels[i+1],index=i/4,x=((index%sx)+0.5)/sx*ex-ex/2,y=(Math.floor(index/sx)+0.5)/sy*ey-ey/2;
          maxHeight=Math.max(maxHeight,Math.abs(h));maxVelocity=Math.max(maxVelocity,Math.abs(v));finite&&=Number.isFinite(h)&&Number.isFinite(v);
          if(Math.abs(h)>0.15)radius=Math.max(radius,Math.hypot(x,y));
          energy+=h*h+v*v/1000;
          if(index===Math.floor(sy/2)*sx+Math.floor(sx/2))center=h;
        }
        return {time:this.solver.time,maxHeight,maxVelocity,center,radius,energy,finite};
      };
      for(let i=0;i<6;i++)this.solver.update();
      const impact=measure();
      for(let i=6;i<60;i++)this.solver.update();
      const nearWave=measure();
      const impulseDifference=difference(capture({dark:true,mode:0},2));
      const referenceImpact=referenceDifference(capture({...REFERENCE_DEFAULTS,mode:3},2));
      const fusionImpact=fusionDifference(capture({...FUSION_DEFAULTS,mode:4},2));
      for(let i=60;i<180;i++)this.solver.update();
      const farWave=measure();
      for(let i=180;i<720;i++)this.solver.update();
      const settled=measure();
      this.clear(settings.view);const pressure=new WaterPressure();pressure.lower();
      const pressureQuiet=capture({...FUSION_DEFAULTS,strength:0,mode:4,boat:undefined},2);
      const pressureDifference=b=>pressureQuiet.reduce((sum,v,i)=>sum+(i%4!==3?Math.abs(v-b[i]):0),0)/(size*size*3);
      for(let i=0;i<96;i++){pressure.advance(this.solver.step);this.solver.update(pressure.sources());}
      const depressed=measure(),sinkPixels=pressureDifference(capture({...FUSION_DEFAULTS,strength:0,mode:4,boat:undefined},2));
      for(let i=96;i<360;i++){pressure.advance(this.solver.step);this.solver.update(pressure.sources());}
      const released=measure();
      for(let i=360;i<900;i++)this.solver.update();
      const pressureSettled=measure();
      this.clear(settings.view);pressure.reset();pressure.age=1;
      for(let i=0;i<360;i++)this.solver.update(pressure.sources({x:-110+i*this.solver.step*75,y:0,heading:0,visible:true}));
      const movingHull=measure(),hullPixels=pressureDifference(capture({...FUSION_DEFAULTS,strength:0,mode:4,boat:undefined},2));
      const pressureProbe={depressed,released,settled:pressureSettled,movingHull,sinkPixels,hullPixels};
      const result={shader:'WebGL2 compiled and linked', framebuffer:'complete',
        range:Math.max(...a.filter((_,i)=>i%4===0))-Math.min(...a.filter((_,i)=>i%4===0)),
        waveDifference,lightDifference,curvatureDifference,impulseDifference,normalDifference,swirlDifference,boatDifference,wakeDifference,coloredPixels,wakeColoredPixels,
        sparkle:{brightPixels,brightTransitions,quietFraction:quietPixels/(size*size)},
        reference:{waveDifference:referenceWave,lightDifference:referenceLight,impulseDifference:referenceImpact},
        fusion:{waveDifference:fusionWave,lightDifference:fusionLight,impulseDifference:fusionImpact,coloredPixels:fusionColoredPixels},
        inspiration:{dailyBrightPixels:dailyBright,burstBrightPixels:burstBright,returnDifference},
        solver:{format:'RGBA32F height/velocity ping-pong',steps:this.solver.updates,impact,nearWave,farWave,settled},pressure:pressureProbe,glError:gl.getError()};
      result.passed=result.range>100 && brightPixels>10 && brightTransitions>10 && result.sparkle.quietFraction>.95 && result.waveDifference>0.05 && result.lightDifference>0.05 && result.curvatureDifference>0.05 && result.impulseDifference>0.02 && result.normalDifference>5 && result.swirlDifference>0.02 && result.boatDifference>0.02 && result.wakeDifference>0 && coloredPixels>5 && wakeColoredPixels>5 && impact.center<0 && nearWave.center>0 && farWave.radius>nearWave.radius && settled.energy<nearWave.energy*0.2 && settled.finite && result.glError===0;
      result.passed&&=referenceWave>1 && referenceLight>1 && referenceImpact>.1;
      result.passed&&=fusionWave>.05&&fusionLight>.05&&fusionImpact>.02&&fusionColoredPixels>5;
      result.passed&&=depressed.center<-2&&released.radius>depressed.radius&&pressureSettled.energy<released.energy&&movingHull.maxHeight>1&&sinkPixels>.05&&hullPixels>.05&&pressureSettled.finite;
      result.passed&&=burstBright>dailyBright+20&&returnDifference===0;
      this.clear(settings.view);return result;
    } finally {
      gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.deleteFramebuffer(fb); gl.deleteTexture(texture);
    }
  }
  destroy() {
    const gl=this.gl;
    this.solver?.destroy();
    gl.deleteBuffer(this.buffer); gl.deleteVertexArray(this.vao); gl.deleteProgram(this.program);
  }
}
