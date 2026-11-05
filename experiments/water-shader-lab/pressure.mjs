// WB-ENTRY-006/007: a displaced height profile drives the existing wave equation.
// Negative center and raised surroundings integrate to zero; no painted wake rings.
export const HULL_LENGTH=40, HULL_WIDTH=17, HULL_DEPTH=9;
export const DISC_RADIUS=44, DISC_DEPTH=18, DISC_DURATION=2.4;
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function sinkDepth(age,amount=1){
  if(age<0||age>=DISC_DURATION)return 0;
  return DISC_DEPTH*amount*smooth(age/.65)*(1-smooth((age-1.15)/1.25));
}
export function displacedProfile(x,y,length,width,depth){
  const r2=(x/length)**2+(y/width)**2;
  return -depth*(Math.exp(-r2)-.25*Math.exp(-r2/4));
}
export function pressureLaplacian(x,y,length,width,depth){
  const r2=(x/length)**2+(y/width)**2;
  const inv=1/length**2+1/width**2,radial=x*x/length**4+y*y/width**4;
  return -depth*(Math.exp(-r2)*(4*radial-2*inv)-.25*Math.exp(-r2/4)*(radial/4-inv/2));
}
export class WaterPressure {
  constructor(){this.reset();}
  reset(){this.age=0;this.sink=null;}
  lower(x=0,y=0,amount=1){this.sink={x,y,amount,age:0};}
  advance(dt){
    this.age+=dt;
    if(this.sink){this.sink.age+=dt;if(this.sink.age>=DISC_DURATION)this.sink=null;}
  }
  sources(boat,amount=1,enabled=true){
    const hullDepth=enabled&&boat?.visible?HULL_DEPTH*amount*smooth(this.age/.8):0;
    return {
      hull:[boat?.x||0,boat?.y||0,boat?.heading||0,hullDepth],
      disc:[this.sink?.x||0,this.sink?.y||0,DISC_RADIUS,sinkDepth(this.sink?.age??-1,this.sink?.amount||0)]
    };
  }
}
