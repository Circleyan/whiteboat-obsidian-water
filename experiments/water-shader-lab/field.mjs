// WB-ENTRY-006 / WB-ENTRY-007: one differentiable field shared by all patches.
export const WAVES = [
  { direction: [0.8, 0.6], amplitude: 12, wavelength: 230, speed: 0.85, phase: 0 },
  { direction: [-0.35, 0.93675], amplitude: 7, wavelength: 143, speed: 1.1, phase: 1.7 },
  { direction: [0.96, -0.28], amplitude: 2.5, wavelength: 79, speed: 1.4, phase: 3.1 },
];
export const DEFAULTS = Object.freeze({ strength: 0.42, speed: 0.85, spacing: 24,
  curvature: 0.62, roughness: 0.03, azimuth: 90, elevation: 66, view: 24, weight: 1,
  swirl: 1, brightness: 0.9 });
export const REFERENCE_DEFAULTS=Object.freeze({...DEFAULTS,strength:1.0,speed:.85,spacing:54,view:48,azimuth:120,elevation:50});
// Longer wavelengths give neighboring water marks a coherent optical rhythm.
export const FUSION_WAVES=Object.freeze([
  {direction:[.96,.28],amplitude:20,wavelength:620,speed:.72,phase:0},
  {direction:[-.42,.9075],amplitude:9,wavelength:390,speed:.96,phase:1.7},
  {direction:[.8,-.6],amplitude:3,wavelength:190,speed:1.1,phase:3.1},
]);
export const FUSION_DEFAULTS=Object.freeze({...DEFAULTS,strength:.75,speed:.75,roughness:.035,brightness:.66});
// Start from the user's latest fine-line tuning; transient glints have their own event.
export const INSPIRATION_DEFAULTS=Object.freeze({...FUSION_DEFAULTS,spacing:23,view:0,roughness:.055,brightness:.62,curvature:.9,strength:.7,speed:1.1});
export const INSPIRATION=Object.freeze({duration:5.2,speed:90,width:115,wavelength:140,amplitude:9,maxEvents:3});
export const fusionMode=mode=>mode!==0&&mode!==3;
export const surfaceDefaults=mode=>mode===5?INSPIRATION_DEFAULTS:mode===3?REFERENCE_DEFAULTS:fusionMode(mode)?FUSION_DEFAULTS:DEFAULTS;
export function inspirationField(x,y,age,origin=[0,0]) {
  if(age<=0||age>=INSPIRATION.duration)return {height:0,dx:0,dy:0,envelope:0};
  const ox=x-origin[0],oy=y-origin[1],root=Math.hypot(ox,oy,8),r=root-8;
  const q=r-INSPIRATION.speed*age,k=2*Math.PI/INSPIRATION.wavelength;
  const envelope=Math.sin(Math.PI*age/INSPIRATION.duration)**2*Math.exp(-q*q/(2*INSPIRATION.width**2));
  const radial=INSPIRATION.amplitude*envelope*(k*Math.cos(k*q)-q/INSPIRATION.width**2*Math.sin(k*q));
  return {height:INSPIRATION.amplitude*envelope*Math.sin(k*q),dx:radial*ox/root,dy:radial*oy/root,envelope};
}
export class InspirationBursts {
  events=[];
  trigger(x,y,staticOnly=false){
    this.events.push({x,y,age:staticOnly?1.5:0});
    this.events=this.events.slice(-INSPIRATION.maxEvents);
  }
  advance(seconds){for(const e of this.events)e.age+=Math.max(0,seconds);this.events=this.events.filter(e=>e.age<INSPIRATION.duration);}
  clear(){this.events=[];}
}
export const REFERENCE_YAW=16*Math.PI/180;
export function referencePoint(x,y,width,height,view){
  const p=view*Math.PI/180,cp=Math.cos(p),sp=Math.sin(p),f=Math.max(width,height)*1.8;
  const t=-f*cp/(y*sp-f*cp),u=x*t,v=-f*sp+(y*cp+f*sp)*t;
  return [u*Math.cos(REFERENCE_YAW)-v*Math.sin(REFERENCE_YAW),u*Math.sin(REFERENCE_YAW)+v*Math.cos(REFERENCE_YAW)];
}
export function referenceExtent(width,height,view){
  const corners=[[-1,-1],[-1,1],[1,-1],[1,1]].map(([x,y])=>referencePoint(x*width/2,y*height/2,width,height,view));
  return [0,1].map(axis=>2*Math.max(...corners.map(p=>Math.abs(p[axis])))+160);
}

// Value and analytic first derivatives (height, slopes, vertical velocity).
export function sampleField(x, y, time, strength = 1, waves=WAVES) {
  const out = { height: 0, dx: 0, dy: 0, velocity: 0 };
  for (const wave of waves) {
    const k = 2 * Math.PI / wave.wavelength;
    const p = k * (x * wave.direction[0] + y * wave.direction[1]) - time * wave.speed + wave.phase;
    const a = wave.amplitude * strength;
    out.height += a * Math.sin(p);
    out.dx += a * k * wave.direction[0] * Math.cos(p);
    out.dy += a * k * wave.direction[1] * Math.cos(p);
    out.velocity -= a * wave.speed * Math.cos(p);
  }
  return out;
}
export const sampleFusionField=(x,y,time,strength=1)=>sampleField(x,y,time,strength,FUSION_WAVES);

export function patchSlope(field, u, v, radius, curvature, tangent = [1,0]) {
  // A quadratic surface aligned with the local flow, not a rotated line mask.
  const length=Math.hypot(...tangent), ax=-tangent[1]/length, ay=tangent[0]/length;
  const bend = curvature * (u * ax + v * ay) / radius;
  return [field.dx + bend * ax + u / radius * curvature * 0.06,
    field.dy + bend * ay + v / radius * curvature * 0.06];
}

export function halfVector(azimuth, elevation, view) {
  const rad = Math.PI / 180, a = azimuth * rad, e = elevation * rad, p = view * rad;
  const h = [Math.cos(a) * Math.cos(e), Math.sin(a) * Math.cos(e) - Math.sin(p), Math.sin(e) + Math.cos(p)];
  const length = Math.hypot(...h);
  return h.map(v => v / length);
}

export function reflectance(slope, half, roughness) {
  const error = (slope[0] + half[0] / half[2]) ** 2 + (slope[1] + half[1] / half[2]) ** 2;
  return Math.exp(-error / (2 * roughness ** 2));
}

// Artistic orientation only: the production field does not advect water either.
export const VORTICES = Object.freeze([
  { x: .1, y: .72, radius: .28, strength: .88, direction: 1 },
  { x: .34, y: .2, radius: .22, strength: .74, direction: -1 },
  { x: .54, y: .32, radius: .24, strength: .6, direction: 1 },
  { x: .79, y: .18, radius: .22, strength: .68, direction: -1 },
  { x: .88, y: .72, radius: .34, strength: .56, direction: 1 },
]);
const normalize = (x,y) => { const l=Math.hypot(x,y);return l<1e-6?[1,0]:[x/l,y/l]; };
export function sampleFlow(x,y,width,height,time=0,swirl=1) {
  const nx=x/width,ny=y/height,tau=2*Math.PI;
  let v=normalize(1+Math.sin(ny*tau*1.35+time*.055)*.34+Math.cos((nx+ny)*tau*1.1-time*.036)*.18,
    Math.sin(nx*tau*1.45-time*.048)*.52+Math.cos((nx*.72-ny)*tau*1.25+time*.031)*.28);
  for(const q of VORTICES){
    const dx=x-q.x*width,dy=y-q.y*height,r=q.radius*Math.min(width,height),d=Math.hypot(dx,dy);
    if(d>=r)continue;
    const a=Math.min(1,Math.max(0,(d/r-.14)/.86)),w=(1-a*a*(3-2*a))*q.strength*swirl;
    // A small softened core avoids an undefined direction exactly at the center.
    const core=Math.min(1,d/(r*.045)),weight=w*core*core*(3-2*core);
    const drift=Math.sin(time*.075+q.x*9.1+q.y*6.3)*.08;
    const t=normalize(-dy*q.direction+dx*drift,dx*q.direction+dy*drift);
    v=normalize(v[0]*(1-weight)+t[0]*weight,v[1]*(1-weight)+t[1]*weight);
  }
  return v;
}
