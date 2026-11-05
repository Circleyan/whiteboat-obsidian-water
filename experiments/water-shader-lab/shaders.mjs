import { WAVES, FUSION_WAVES, VORTICES, REFERENCE_YAW, INSPIRATION } from './field.mjs';
export const vertexSource = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

export const fragmentSource = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform float dpr, time, strength, spacing, curvature, roughness, azimuth, elevation, view, swirl, brightness;
uniform vec3 waterBase, waterInk;
uniform vec4 boatFrame; // screen x/y, heading, normalized speed
uniform float boatRoll;
uniform int boatVisible, wakeCount, reducedMotion;
uniform vec4 wakes[24]; // screen x/y, heading, remaining life
uniform int mode, dark;
uniform sampler2D waveState;
uniform vec2 waveExtent;
uniform vec3 inspirations[3]; // x/y, visible age in seconds
uniform int inspirationCount;
// A finite traveling wave packet changes normals; its envelope also bounds the
// artistic reflection response. It never paints a separate ring or white overlay.
vec4 inspiration(vec2 p){
  vec4 result=vec4(0.0);
  if(mode!=5)return result;
  for(int i=0;i<3;i++){
    if(i>=inspirationCount)break;
    vec3 e=inspirations[i];float age=e.z;
    if(age<=0.0||age>=${INSPIRATION.duration})continue;
    vec2 d=p-e.xy;float root=sqrt(dot(d,d)+64.0),r=root-8.0;
    float q=r-${INSPIRATION.speed.toFixed(1)}*age,k=${2*Math.PI/INSPIRATION.wavelength};
    float envelope=pow(sin(3.14159265*age/${INSPIRATION.duration}),2.0)*exp(-q*q/${2*INSPIRATION.width**2}.0);
    float radial=${INSPIRATION.amplitude.toFixed(1)}*envelope*(k*cos(k*q)-q/${INSPIRATION.width**2}.0*sin(k*q));
    result.xyz+=vec3(${INSPIRATION.amplitude.toFixed(1)}*envelope*sin(k*q),radial*d/root);
    result.w=min(1.0,result.w+envelope);
  }
  return result;
}
vec2 water(vec2 p) {
  ivec2 size=textureSize(waveState,0);
  vec2 texel=(p/waveExtent+0.5)*vec2(size)-0.5;
  ivec2 a=ivec2(floor(texel));vec2 f=fract(texel);
  vec2 q00=texelFetch(waveState,clamp(a,ivec2(0),size-1),0).xy;
  vec2 q10=texelFetch(waveState,clamp(a+ivec2(1,0),ivec2(0),size-1),0).xy;
  vec2 q01=texelFetch(waveState,clamp(a+ivec2(0,1),ivec2(0),size-1),0).xy;
  vec2 q11=texelFetch(waveState,clamp(a+ivec2(1,1),ivec2(0),size-1),0).xy;
  return mix(mix(q00,q10,f.x),mix(q01,q11,f.x),f.y);
}
out vec4 color;
// jet = height, dHeight/dX, dHeight/dY, dHeight/dTime.
vec4 background(vec2 p) {
  vec4 jet = vec4(0.0);
  ${WAVES.map((w,i) => `{
    vec2 dir = vec2(${w.direction.join(',')});
    float k = ${2 * Math.PI / w.wavelength};
    float omega=${w.speed},amplitude=${w.amplitude.toFixed(1)};
    if(mode!=0&&mode!=3){dir=vec2(${FUSION_WAVES[i].direction.join(',')});k=${2*Math.PI/FUSION_WAVES[i].wavelength};omega=${FUSION_WAVES[i].speed};amplitude=${FUSION_WAVES[i].amplitude.toFixed(1)};}
    float phase = k * dot(p, dir) - time * omega + ${w.phase.toFixed(1)};
    float a = amplitude * strength;
    jet += vec4(a*sin(phase), a*k*dir*cos(phase), -a*omega*cos(phase));
  }`).join('\n')}
  return jet;
}
vec4 field(vec2 p) {
  vec4 jet=background(p);
  vec2 cell=waveExtent/vec2(textureSize(waveState,0));
  vec2 state=water(p);
  vec2 slope=vec2((water(p+vec2(cell.x,0)).x-water(p-vec2(cell.x,0)).x)/(2.0*cell.x),
    (water(p+vec2(0,cell.y)).x-water(p-vec2(0,cell.y)).x)/(2.0*cell.y));
  jet+=vec4(state.x,slope,state.y);
  jet.xyz+=inspiration(p).xyz;
  return jet;
}

vec2 safeDirection(vec2 p) { return length(p)<0.000001 ? vec2(1.0,0.0) : normalize(p); }
vec2 flow(vec2 p,vec2 size) {
  vec2 n=p/size;
  vec2 v=safeDirection(vec2(1.0+sin(n.y*6.2831853*1.35+time*.055)*.34+cos((n.x+n.y)*6.2831853*1.1-time*.036)*.18,
    sin(n.x*6.2831853*1.45-time*.048)*.52+cos((n.x*.72-n.y)*6.2831853*1.25+time*.031)*.28));
  ${VORTICES.map(q=>`{
    vec2 d=p-vec2(${q.x},${q.y})*size;
    float r=${q.radius}*min(size.x,size.y),distance=length(d);
    float w=(1.0-smoothstep(r*.14,r,distance))*${q.strength}*swirl*smoothstep(0.0,r*.045,distance);
    float drift=sin(time*.075+${q.x}*9.1+${q.y}*6.3)*.08;
    vec2 t=safeDirection(vec2(-d.y*${q.direction.toFixed(1)}+d.x*drift,d.x*${q.direction.toFixed(1)}+d.y*drift));
    v=safeDirection(mix(v,t,w));
  }`).join('\n')}
  return v;
}
// Fixed hull-side support and aging stern footprints match the existing water.
float contact(vec2 p) {
  vec2 d=p-boatFrame.xy,forward=vec2(cos(boatFrame.z),sin(boatFrame.z));
  float longitudinal=dot(d,forward),lateral=dot(d,vec2(-forward.y,forward.x));
  float side=abs(lateral)-17.0;
  float dist=length(vec2(longitudinal/88.0,side/(side<0.0?13.0:52.0)));
  return (1.0-smoothstep(.35,1.0,dist))*(reducedMotion==1?.4:.52+sign(lateral)*clamp(boatRoll/.1,-1.0,1.0)*.16);
}
float boatAccent(vec2 p) {
  if(boatVisible==0)return 0.0;
  float accent=contact(p)*(1.0-smoothstep(.04,.36,boatFrame.w));
  for(int n=0;n<24;n++){
    if(n>=wakeCount)break;
    vec4 w=wakes[n];vec2 d=p-w.xy;
    if(abs(d.x)>130.0||abs(d.y)>130.0)continue;
    vec2 f=vec2(cos(w.z),sin(w.z));float a=dot(d,f),b=dot(d,vec2(-f.y,f.x)),age=1.0-w.w;
    float dist=length(vec2((a+26.0+age*22.0)/(46.0+age*30.0),b/(24.0+age*58.0)));
    accent=max(accent,(1.0-smoothstep(.28,1.0,dist))*pow(max(w.w,0.0),.72));
  }
  return accent;
}
vec3 wakeColor(float index) {
  if(index<1.0)return vec3(0.3687363,0.7426546,0.3925963);
  if(index<2.0)return vec3(0.0000000,0.7024409,0.9472724);
  if(index<3.0)return vec3(0.4045061,0.6178688,0.9710992);
  if(index<4.0)return vec3(0.7632178,0.5874843,0.9595133);
  return waterInk;
}
float seed(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }

// Reference study: rigid circular patches tilt together under the same field.
// Ray/plane intersections produce actual perspective ellipses, not line masks.
vec3 discArray(vec2 screen,vec2 css,vec3 L) {
  float pitch=radians(view),cp=cos(pitch),sp=sin(pitch);
  float focal=max(css.x,css.y)*1.8;
  vec3 eye=vec3(0.0,-focal*sp,focal*cp);
  vec3 ray=normalize(vec3(screen.x,screen.y*cp+focal*sp,screen.y*sp-focal*cp));
  mat2 yaw=mat2(cos(${REFERENCE_YAW}),sin(${REFERENCE_YAW}),-sin(${REFERENCE_YAW}),cos(${REFERENCE_YAW}));
  eye.xy=yaw*eye.xy;ray.xy=yaw*ray.xy;
  if(ray.z>=-.03)return vec3(.29);
  vec3 ground=eye+ray*(-eye.z/ray.z);
  vec2 cell=floor(ground.xy/spacing+.5);
  vec3 base=vec3(.29,.295,.30),result=base;
  float seam=min(abs(fract((ground.x+spacing*.5)/(spacing*8.0))-.5),abs(fract((ground.y+spacing*.5)/(spacing*8.0))-.5));
  result*=1.0-.24*(1.0-smoothstep(0.0,.002,seam));
  float nearest=1e8,plateCoverage=0.0;vec3 plateColor=base;
  for(int j=-2;j<=2;j++)for(int i=-2;i<=2;i++){
    vec2 id=cell+vec2(float(i),float(j));
    vec2 p=id*spacing;
    float radius=spacing*.36,z=spacing*.12+(background(p).x+water(p).x)*.04;
    vec3 center=vec3(p,z);
    vec3 lightRay=normalize(vec3(L.xy,max(.25,L.z)));
    // cull-reference-start
    // A plate and its shadow must intersect their bounding spheres. This
    // height-only broad phase avoids four slope samples for distant candidates.
    vec3 eyeDelta=center-eye,lightDelta=center-ground;
    float rayDistance=length(cross(eyeDelta,ray));
    float shadowDistance=length(cross(lightDelta,lightRay));
    float fringe=max(radius*.25,4.0*length(eyeDelta)/(focal*dpr));
    if(rayDistance>radius+fringe && shadowDistance>radius*1.25)continue;
    // cull-reference-end
    vec4 state=field(p);
    vec3 N=normalize(vec3(-state.yz*1.45,1.0));
    // Raised circular plate casts a directional shadow onto the common ground.
    float lightDenom=dot(lightRay,N);
    if(lightDenom>.05){
      float t=dot(center-ground,N)/lightDenom;
      vec3 onPlate=ground+lightRay*t-center;
      float d=length(onPlate)/radius;
      if(t>0.0)result*=1.0-.55*(1.0-smoothstep(.82,1.18,d));
    }
    // A short cylinder supports the plate. Intersect its visible side/top.
    vec2 q=eye.xy-p;float r=radius*.24;
    float A=dot(ray.xy,ray.xy),B=dot(q,ray.xy),C=dot(q,q)-r*r;
    float D=B*B-A*C;
    if(D>0.0){
      float hit=(-B-sqrt(D))/A,h=eye.z+ray.z*hit;
      if(hit>0.0&&h>0.0&&h<z)result=vec3(.065);
    }
    float top=(z-eye.z)/ray.z;
    if(top>0.0&&length(eye.xy+ray.xy*top-p)<r)result=vec3(.11);
    float denom=dot(ray,N);
    if(abs(denom)<.02)continue;
    float t=dot(center-eye,N)/denom;
    if(t<=0.0||t>=nearest)continue;
    vec3 local=eye+ray*t-center;
    float distance=length(local)/radius;
    float aa=max(.015,t/(focal*radius*dpr));
    float coverage=1.0-smoothstep(1.0-aa,1.0+aa,distance);
    coverage*=smoothstep(.06,.10,distance);
    if(coverage<=0.0)continue;
    vec3 facing=denom<0.0?N:-N;
    vec3 H=normalize(L-ray);
    float diffuse=max(0.0,dot(facing,L));
    float metal=pow(max(0.0,dot(facing,H)),18.0);
    // Stable material variation only, never a time-dependent brightness seed.
    float grain=sin(dot(local,vec3(11.0,7.0,3.0)))*.013+sin(dot(local,vec3(23.0,-17.0,2.0)))*.006;
    vec3 nickel=vec3(.57,.57,.56)*( .56+diffuse*.68)+vec3(metal*.38*brightness+grain);
    float rim=smoothstep(.91,1.0,distance);
    nickel*=1.0-rim*.23;
    nickel=mix(nickel,vec3(.74,.745,.74),smoothstep(.975,1.0,distance)*.65);
    plateColor=nickel;plateCoverage=coverage;nearest=t;
  }
  return mix(result,plateColor,plateCoverage);
}

void main() {
  vec2 css=resolution/dpr;
  vec2 screen=vec2(gl_FragCoord.x/dpr,css.y-gl_FragCoord.y/dpr)-css*0.5;
  float pitch=radians(view), cp=cos(pitch), sp=sin(pitch);
  vec2 plane=vec2(screen.x,screen.y/cp);
  // Grid density is expressed in screen pixels, as in the existing Canvas field.
  vec2 grid=vec2(spacing,spacing/cp);
  vec2 drift=vec2(time*8.0,time*2.2/cp);
  vec2 cell=floor((plane-drift)/grid+0.5);
  vec3 L=vec3(cos(radians(azimuth))*cos(radians(elevation)),sin(radians(azimuth))*cos(radians(elevation)),sin(radians(elevation)));
  vec3 V=vec3(0.0,-sp,cp), H=normalize(L+V);
  if(mode==3){color=vec4(discArray(screen,css,L),1.0);return;}
  vec3 base=waterBase, light=waterInk;
  vec3 result=base;
  float bestCoverage=0.0;
  // Search neighboring projected patches: height/tilt can move a disc across its grid cell.
  for(int j=-2;j<=2;j++) for(int i=-1;i<=1;i++) {
    vec2 id=cell+vec2(float(i),float(j));
    vec2 jitter=vec2(seed(id)-.5,seed(vec2(id.y,17.0))-.5)*spacing*.065;
    vec2 center=id*grid+drift+jitter;
    float radius=spacing*.25*(.88+seed(id+4.0)*.24);
    float u=screen.x-center.x;
    // Height and pitch only move the projected Y coordinate. Reject X misses
    // before sampling the wave texture; include the exact antialiasing fringe.
    float aa=max(0.025,0.7/(radius*dpr*cp));
    // cull-water-start
    if(abs(u)>radius*(1.0+aa))continue;
    // cull-water-end
    vec4 state=field(center);
    float denom=max(0.12,cp+state.z*sp);
    float v=(screen.y-center.y*cp-state.x*sp-state.y*u*sp)/denom;
    vec2 local=vec2(u,v);
    float distance=length(local)/radius;
    float coverage=1.0-smoothstep(1.0-aa,1.0+aa,distance);
    if(coverage<=0.0 || coverage<bestCoverage) continue;
    vec2 tangent=flow(vec2(center.x,center.y*cp)+css*.5,css);
    tangent=safeDirection(vec2(tangent.x,tangent.y/cp));
    vec2 axis=vec2(-tangent.y,tangent.x);
    vec2 slope=state.yz+curvature*dot(local,axis)/radius*axis+local/radius*curvature*0.06;
    vec3 N=normalize(vec3(-slope,1.0));
    vec2 error=slope+H.xy/H.z;
    // A smooth microfacet normal lobe selects only the reflective portion of the disc.
    float accent=boatAccent(vec2(center.x,center.y*cp));
    float tint=smoothstep(.12,.52,accent);
    float eventGlow=inspiration(center).w;
    // Broad faint reflection preserves the water marks. The narrower solar lobe
    // catches only a small range of slopes, entering/leaving as the wave tilts.
    float opticalWidth=mode==5?mix(roughness,max(roughness,.08),eventGlow):roughness;
    float materialWidth=mix(max(opticalWidth,.055),max(opticalWidth,.065),tint);
    float softSpec=exp(-dot(error,error)/(2.0*materialWidth*materialWidth));
    // Integrate the narrow lobe approximately over a pixel to avoid sparkle
    // caused by subpixel sampling. Width/peak compensate each other.
    mat2 slopeGradient=curvature/radius*mat2(axis.x*axis.x+.06,axis.x*axis.y,axis.x*axis.y,axis.y*axis.y+.06);
    vec2 footprint=abs(slopeGradient*vec2(1.0,-state.y*sp/denom)/dpr)+abs(slopeGradient*vec2(0.0,1.0/denom)/dpr);
    float variance=opticalWidth*opticalWidth+dot(footprint,footprint)/12.0;
    float spec=exp(-dot(error,error)/(2.0*variance))*opticalWidth/sqrt(variance);
    float fresnel=0.02+0.98*pow(1.0-max(0.0,dot(V,H)),5.0);
    float incidence=max(0.0,dot(N,L));
    float glint=spec*(0.9+fresnel*5.0)*incidence;
    vec3 pigment=wakeColor(floor(seed(id+12.0)*4.0));
    // Color occupies only the existing optically selected part of each patch.
    float quiet=softSpec*incidence*mix(brightness*.20,.82,tint);
    vec3 surfaceColor=mix(base,mix(light,pigment,tint),quiet);
    // The solar peak lightens colored wakes too, on the same surface normals.
    float peakGain=mode==5?mix(.32,3.4,eventGlow):(mode==0?1.6:1.25);
    surfaceColor=mix(surfaceColor,mix(light,mix(pigment,light,.25),tint),min(1.0,glint*brightness*peakGain));
    if(mode==1) {
      float edge=smoothstep(0.88,0.99,distance)*0.12;
      surfaceColor=mix(base,light,0.06+max(0.0,dot(N,L))*0.13+edge+glint*1.5);
    }
    if(mode==2) surfaceColor=N*0.5+0.5;
    result=mix(base,surfaceColor,coverage);
    bestCoverage=coverage;
  }
  color=vec4(result,1.0);
}`;
