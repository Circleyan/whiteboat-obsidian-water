import { vertexSource } from './shaders.mjs';
import { HULL_LENGTH, HULL_WIDTH } from './pressure.mjs';

// WB-ENTRY-006/007 experiment: fixed-step damped wave equation, separate read/write states.
export const WAVE_SPEED = 110;
export const STEP = 1 / 120;
export const DAMPING = 0.65;
export function stoneKick(x,y,weight=1) {
  const radius=18+5*weight,r2=(x*x+y*y)/(radius*radius);
  return -125*weight*(Math.exp(-r2)-0.25*Math.exp(-r2/4));
}
export const updateSource = `#version 300 es
precision highp float;
uniform sampler2D previous;
uniform ivec2 size;
uniform vec2 extent;
uniform vec4 stone;
uniform vec4 hull, disc; // world coordinates, heading/radius, displaced depth
uniform float dt;
out vec4 nextState;
vec2 at(ivec2 p) { return texelFetch(previous,clamp(p,ivec2(0),size-1),0).xy; }
float pressureLap(vec2 delta,vec2 radii,float depth){
  vec2 q=delta/radii,inv=1.0/(radii*radii);
  float r2=dot(q,q),radial=dot(q*q,inv),sum=inv.x+inv.y;
  return -depth*(exp(-r2)*(4.0*radial-2.0*sum)-.25*exp(-r2/4.0)*(radial/4.0-sum/2.0));
}
void main() {
  ivec2 p=ivec2(gl_FragCoord.xy);
  vec2 cell=extent/vec2(size), state=at(p);
  float lap=(at(p+ivec2(1,0)).x+at(p-ivec2(1,0)).x-2.0*state.x)/(cell.x*cell.x)
    +(at(p+ivec2(0,1)).x+at(p-ivec2(0,1)).x-2.0*state.x)/(cell.y*cell.y);
  vec2 world=(vec2(p)+0.5)/vec2(size)*extent-extent*0.5;
  vec2 d=world-hull.xy,f=vec2(cos(hull.z),sin(hull.z));
  vec2 local=vec2(dot(d,f),dot(d,vec2(-f.y,f.x)));
  float load=pressureLap(local,vec2(${HULL_LENGTH.toFixed(1)},${HULL_WIDTH.toFixed(1)}),hull.w)
    +pressureLap(world-disc.xy,vec2(disc.z),disc.w);
  // A static load has equilibrium h=displacedProfile; moving/released loads radiate waves.
  float v=(state.y+${WAVE_SPEED.toFixed(1)}*${WAVE_SPEED.toFixed(1)}*(lap-load)*dt)*exp(-${DAMPING}*dt);
  // Extra edge damping absorbs outgoing waves; not a shoreline reflection model.
  vec2 edge=min(vec2(p),vec2(size-1-p));
  float absorb=1.0-smoothstep(0.0,10.0,min(edge.x,edge.y));
  v*=exp(-absorb*5.0*dt);
  float h=state.x+v*dt;
  vec2 delta=world-stone.xy;
  float r2=dot(delta,delta)/(stone.w*stone.w);
  float gaussian=exp(-r2)-0.25*exp(-r2/4.0);
  // Downward center and displaced surrounding water have balanced integrated volume.
  v-=stone.z*gaussian;
  nextState=vec4(h,v,0.0,1.0);
}`;

export function stableStep(cellX, cellY) {
  return 0.8 / (WAVE_SPEED * Math.sqrt(1 / cellX ** 2 + 1 / cellY ** 2));
}

export class WaveSolver {
  constructor(gl, width, height, pitch, extent) {
    this.gl=gl;
    if(!gl.getExtension('EXT_color_buffer_float')) throw new Error('投石实验需要浏览器支持浮点水面状态。');
    this.extent=extent||[width+160,height/Math.cos(pitch*Math.PI/180)+160];
    this.size=this.extent.map(v=>Math.max(32,Math.min(360,Math.ceil(v/7))));
    this.step=Math.min(STEP,stableStep(this.extent[0]/this.size[0],this.extent[1]/this.size[1]));
    this.time=0;this.updates=0;this.pending=[];this.index=0;
    this.program=gl.createProgram();const shaders=[];
    try {
      for(const [type,source] of [[gl.VERTEX_SHADER,vertexSource],[gl.FRAGMENT_SHADER,updateSource]]) {
        const shader=gl.createShader(type);shaders.push(shader);
        gl.shaderSource(shader,source);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
        gl.attachShader(this.program,shader);
      }
      gl.linkProgram(this.program);
      if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));
    } catch(error) {gl.deleteProgram(this.program);throw error;}
    finally {shaders.forEach(shader=>gl.deleteShader(shader));}
    this.uniforms=Object.fromEntries(['previous','size','extent','stone','dt','hull','disc'].map(n=>[n,gl.getUniformLocation(this.program,n)]));
    this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
    this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(this.program,'position');
    gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    this.textures=[];this.frames=[];
    try {
      for(let i=0;i<2;i++) {
        const texture=gl.createTexture(), fb=gl.createFramebuffer();this.textures.push(texture);this.frames.push(fb);
        gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,...this.size,0,gl.RGBA,gl.FLOAT,null);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('水面状态缓冲未能建立');
        gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      }
    } catch(error) {this.destroy();throw error;}
    finally {gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
  }
  get texture() {return this.textures[this.index];}
  drop(x,y,weight=1) {
    if(this.pending.length===16)this.pending.shift();
    this.pending.push([x,y,125*weight,18+5*weight]);
  }
  update(sources={}) {
    const gl=this.gl,u=this.uniforms;
    gl.useProgram(this.program);gl.bindVertexArray(this.vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.frames[1-this.index]);gl.viewport(0,0,...this.size);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(u.previous,0);
    gl.uniform2i(u.size,...this.size);gl.uniform2f(u.extent,...this.extent);gl.uniform1f(u.dt,this.step);
    gl.uniform4f(u.stone,...(this.pending.shift()||[0,0,0,1]));
    gl.uniform4f(u.hull,...(sources.hull||[0,0,0,0]));
    gl.uniform4f(u.disc,...(sources.disc||[0,0,44,0]));
    gl.drawArrays(gl.TRIANGLES,0,3);this.index=1-this.index;this.time+=this.step;this.updates++;
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }
  sample() {
    const gl=this.gl,pixels=new Float32Array(this.size[0]*this.size[1]*4);
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.frames[this.index]);
    gl.readPixels(0,0,...this.size,gl.RGBA,gl.FLOAT,pixels);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    return pixels;
  }
  destroy() {
    const gl=this.gl;
    this.textures?.forEach(t=>gl.deleteTexture(t));this.frames?.forEach(f=>gl.deleteFramebuffer(f));
    gl.deleteBuffer(this.buffer);gl.deleteVertexArray(this.vao);gl.deleteProgram(this.program);
  }
}

// Float64 reference used for stability/propagation tests; runtime uses the shader above.
export function advanceReference(height,velocity,width,heightCount,cell,dt=STEP) {
  const nextH=new Float64Array(height.length),nextV=new Float64Array(height.length);
  const at=(x,y)=>height[Math.max(0,Math.min(heightCount-1,y))*width+Math.max(0,Math.min(width-1,x))];
  for(let y=0;y<heightCount;y++)for(let x=0;x<width;x++){
    const i=y*width+x,lap=(at(x+1,y)+at(x-1,y)+at(x,y+1)+at(x,y-1)-4*height[i])/cell**2;
    const edge=Math.min(x,y,width-1-x,heightCount-1-y),t=Math.max(0,Math.min(1,edge/10)),absorb=1-t*t*(3-2*t);
    nextV[i]=(velocity[i]+WAVE_SPEED**2*lap*dt)*Math.exp(-(DAMPING+absorb*5)*dt);
    nextH[i]=height[i]+nextV[i]*dt;
  }
  return [nextH,nextV];
}
