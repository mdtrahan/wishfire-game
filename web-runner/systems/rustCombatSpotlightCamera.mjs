import { clamp01 as c, smooth } from './rustCombatEffects.mjs';
// spotlight_camera.rs participant bounds and easing, fitted to WFM's unobstructed lane.
const LEFT=14,RIGHT=346,TOP=174,BOTTOM=366,MID=270;
const box=(x,y,right,bottom)=>({x,y,right,bottom});
const union=(a,b)=>a?box(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.max(a.right,b.right),Math.max(a.bottom,b.bottom)):b;
function fit(b){const z=Math.max(.5,Math.min(.8,(RIGHT-LEFT)/Math.max(1,b.right-b.x),(BOTTOM-TOP)/Math.max(1,b.bottom-b.y)));return{x:(b.x+b.right)/2,y:(b.y+b.bottom)/2/.75,z};}
function contained(b,f){return(b.x-f.x)*f.z+180>=LEFT-.01&&(b.right-f.x)*f.z+180<=RIGHT+.01&&(b.y-f.y*.75)*f.z+MID>=TOP-.01&&(b.bottom-f.y*.75)*f.z+MID<=BOTTOM+.01;}
function constrain(f,b){const minx=b.right-(RIGHT-180)/f.z,maxx=b.x-(LEFT-180)/f.z,miny=b.bottom-(BOTTOM-MID)/f.z,maxy=b.y-(TOP-MID)/f.z;if(minx<=maxx)f.x=Math.max(minx,Math.min(maxx,f.x));if(miny<=maxy)f.y=Math.max(miny,Math.min(maxy,f.y*.75))/.75;return f;}
function actorBox(a,boxes){const scale=a.scale*(a.kind.startsWith('boss')?1:.6),px=a.pos.x,py=a.pos.y*.75;let b=box(px-55*scale,py-110*scale,px+55*scale,py+5*scale);for(const state of ['idle',a.state]){const q=boxes[a.kind]?.[state==='downed'||state==='dead'?'ko':state];if(q)b=union(b,box(px+q[0]*scale,py+q[1]*scale,px+q[2]*scale,py+q[3]*scale));}return box(b.x-12,b.y-12,b.right+12,b.bottom+12);}
function hazardBox(h){const sh=h.shape,x=h.origin.x,y=h.origin.y*.75,r=sh.radius??sh.outer??sh.length;if(sh.kind==='line'){const ex=x+h.dir.x*sh.length,ey=y+h.dir.y*sh.length*.75;return box(Math.min(x,ex)-sh.width/2-12,Math.min(y,ey)-sh.width*.375-12,Math.max(x,ex)+sh.width/2+12,Math.max(y,ey)+sh.width*.375+12);}return box(x-r-12,y-r*.75-12,x+r+12,y+r*.75+12);}
const distance=(b,x,y)=>((b.x+b.right)/2-x)**2+((b.y+b.bottom)/2-y)**2;
export class SliceSpotlightCamera {
 constructor(boxes){this.boxes=boxes;this.clear();}
 clear(){this.current=this.from=this.key=this.held=null;this.born=0;this.returnAge=0;this.time=null;}
 apply(camera,s,reduced){const dt=this.time===null?0:Math.max(0,s.time-this.time);this.time=s.time;if(!s.spotlight&&!this.current)return;const normal={x:camera.centreX,y:camera.centreY,z:camera.zoom},v=s.spotlight;let f;
  if(v){const key=v.caster+':'+v.started;if(key!==this.key){this.from=this.current??normal;this.born=s.time;this.held=null;}this.key=key;this.returnAge=0;let core=null;
   for(const a of s.actors)if(a.actor_id===v.caster||a.team==='enemy'&&v.participants.includes(a.actor_id))core=union(core,actorBox(a,this.boxes));
   for(const h of s.hazards)if(v.hazards.includes(h.id)&&!v.co_casters.includes(h.owner))core=union(core,hazardBox(h));
   if(core)core=union(this.held,core);this.held=core;let bounds=core;
   if(core&&contained(core,fit(core))){const extras=[],x=(core.x+core.right)/2,y=(core.y+core.bottom)/2;
    for(const a of s.actors)if(a.team==='hero'&&v.co_casters.includes(a.actor_id))extras.push(actorBox(a,this.boxes));for(const h of s.hazards)if(v.hazards.includes(h.id)&&v.co_casters.includes(h.owner))extras.push(hazardBox(h));
    for(const p of s.projectiles)if(v.projectiles.includes(p.id)){const x=p.pos.x,y=p.pos.y*.75-p.height;extras.push(box(x-36,y-36,x+36,y+36));}extras.sort((a,b)=>distance(a,x,y)-distance(b,x,y));for(const q of extras){const next=union(bounds,q);if(contained(next,fit(next)))bounds=next;}
   }
   const to=bounds?fit(bounds):normal,t=reduced?1:smooth((s.time-this.born)/1.2),from=this.from??normal;f={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,z:from.z+(to.z-from.z)*t};if(bounds)constrain(f,bounds);
  }else if(this.current){if(this.key){this.key=null;this.from=this.current;this.returnAge=0;}this.returnAge+=dt;const t=reduced?1:c(this.returnAge/.5);if(t>=1){this.current=this.from=null;return;}const u=smooth(t),from=this.from??this.current;f={x:from.x+(normal.x-from.x)*u,y:from.y+(normal.y-from.y)*u,z:from.z+(normal.z-from.z)*u};}else return;
  this.current=f;camera.frame(f.x,f.y,f.z);camera.offsetX=camera.offsetY=0;
 }
}
