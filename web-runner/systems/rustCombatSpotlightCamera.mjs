import { COMBAT_VIEW, COMBAT_FRAME_Y } from './rustCombatCamera.mjs';
import { clamp01 as c, smooth } from './rustCombatEffects.mjs';
// spotlight_camera.rs participant bounds and easing, fitted to WFM's unobstructed lane.
const LEFT=14,RIGHT=346,TOP=COMBAT_VIEW.top+6,BOTTOM=COMBAT_VIEW.bottom-10,MID=COMBAT_FRAME_Y;
const RETURN=.5,MAX_ZOOM=.8;
const OFFENSIVE = new Set(['shadow', 'split', 'bubble_pop', 'arcane_pulse', 'ground_pound']);
const box=(x,y,right,bottom)=>({x,y,right,bottom});
const union=(a,b)=>a?box(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.max(a.right,b.right),Math.max(a.bottom,b.bottom)):b;
function fit(b){const z=Math.max(.5,Math.min(MAX_ZOOM,(RIGHT-LEFT)/Math.max(1,b.right-b.x),(BOTTOM-TOP)/Math.max(1,b.bottom-b.y)));return{x:(b.x+b.right)/2,y:((b.y+b.bottom)/2-((TOP+BOTTOM)/2-MID)/z)/.75,z};}
function constrain(f,b){const minx=b.right-(RIGHT-180)/f.z,maxx=b.x-(LEFT-180)/f.z,miny=b.bottom-(BOTTOM-MID)/f.z,maxy=b.y-(TOP-MID)/f.z;if(minx<=maxx)f.x=Math.max(minx,Math.min(maxx,f.x));if(miny<=maxy)f.y=Math.max(miny,Math.min(maxy,f.y*.75))/.75;return f;}
function actorBox(a,boxes){const scale=a.scale*(a.kind.startsWith('boss')?1:.6),px=a.pos.x,py=a.pos.y*.75;let b=box(px-55*scale,py-110*scale,px+55*scale,py+5*scale);for(const state of ['idle',a.state]){const q=boxes[a.kind]?.[state==='downed'||state==='dead'?'ko':state];if(q)b=union(b,box(px+q[0]*scale,py+q[1]*scale,px+q[2]*scale,py+q[3]*scale));}return box(b.x-12,b.y-12,b.right+12,b.bottom+12);}
function hazardBox(h){const sh=h.shape,x=h.origin.x,y=h.origin.y*.75,r=sh.radius??sh.outer??sh.length;if(sh.kind==='line'){const ex=x+h.dir.x*sh.length,ey=y+h.dir.y*sh.length*.75;return box(Math.min(x,ex)-sh.width/2-12,Math.min(y,ey)-sh.width*.375-12,Math.max(x,ex)+sh.width/2+12,Math.max(y,ey)+sh.width*.375+12);}return box(x-r-12,y-r*.75-12,x+r+12,y+r*.75+12);}
export class SliceSpotlightCamera {
 constructor(boxes){this.boxes=boxes;this.clear();}
 clear(){this.current=this.from=this.key=this.held=null;this.born=0;this.returnAge=0;this.time=null;this.active=null;this.encounter=null;}
 // Presentation observes committed casts and their existing attack lifetimes only.
 observe(s, events = []) {
  if (this.encounter !== s.encounter_id) { this.clear(); this.encounter = s.encounter_id; }
  const v = this.active;
  if (v) {
   const caster = s.actors.find(a => a.actor_id === v.caster), now = s.combat_time ?? s.time;
   for (const e of events) if (e.body.kind === 'presentation' && e.body.data.event.kind === 'skill_started') {
    const d = e.body.data.event.data;
    if (d.id === v.caster) v.castEnd = now + (d.skill === v.skill ? caster?.state_duration ?? 0 : 0);
   }
   v.hazards = s.hazards.filter(h => h.owner === v.caster && h.kind === v.skill && h.phase !== 'resolved').map(h => h.id);
   for (const e of events) if (e.body.kind === 'damage' && e.body.data.source === v.caster && !v.participants.includes(e.body.data.target)) v.participants.push(e.body.data.target);
   if (!caster || caster.hp <= 0 || (!(caster.special_casting && now < v.castEnd) && !v.hazards.length)) this.active = null;
  }
  if (this.active) return;
  for (const e of events) {
   if (e.body.kind !== 'presentation' || e.body.data.event.kind !== 'skill_started') continue;
   const d = e.body.data.event.data, caster = s.actors.find(a => a.actor_id === d.id);
   if (caster?.team !== 'hero' || caster.hp <= 0 || !OFFENSIVE.has(d.skill)) continue;
   const target = s.actors.find(a => a.actor_id === d.target && a.team === 'enemy');
   if (!target) continue;
   this.active = { caster: d.id, skill: d.skill, started: s.time, castEnd: (s.combat_time ?? s.time) + caster.state_duration, participants: [target.actor_id], hazards: [], entry: Math.min(1.2, Math.max(1/30, caster.state_duration / 2)) };
   break;
  }
 }
 apply(camera,s,reduced,wallDt=0){const liveDt=this.time===null?0:Math.max(0,s.time-this.time),dt=liveDt>0?liveDt:Math.max(0,wallDt);this.time=s.time;if(!this.active&&!this.current)return;const normal={x:camera.centreX,y:camera.centreY,z:camera.zoom},v=this.active;let f;
  if(v){const key=v.caster+':'+v.started;if(key!==this.key){this.from=this.current??normal;this.born=s.time;this.held=null;}this.key=key;this.returnAge=0;let core=null;
   for(const a of s.actors)if(a.actor_id===v.caster||a.team==='enemy'&&v.participants.includes(a.actor_id))core=union(core,actorBox(a,this.boxes));
   for(const h of s.hazards)if(v.hazards.includes(h.id))core=union(core,hazardBox(h));
   if(core)core=union(this.held,core);this.held=core;let bounds=core;
   const to=bounds?fit(bounds):normal,t=reduced?1:smooth((s.time-this.born)/v.entry),from=this.from??normal;f={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,z:from.z+(to.z-from.z)*t};if(bounds)constrain(f,bounds);
  }else if(this.current){if(this.key){this.key=null;this.from=this.current;this.returnAge=0;}this.returnAge+=dt;const t=reduced?1:c(this.returnAge/RETURN);if(t>=1-1e-12){this.current=this.from=null;return;}const u=smooth(t),from=this.from??this.current;f={x:from.x+(normal.x-from.x)*u,y:from.y+(normal.y-from.y)*u,z:from.z+(normal.z-from.z)*u};}else return;
  f.participants=v?[v.caster,...v.participants]:this.current.participants;
  // Return follows live participants too: the target can walk beyond the interpolated frame.
  if(!v){let bounds=null;for(const a of s.actors)if(f.participants.includes(a.actor_id))bounds=union(bounds,actorBox(a,this.boxes));if(bounds)constrain(f,bounds);}
  this.current=f;camera.frame(f.x,f.y,f.z);camera.offsetX=camera.offsetY=0;
 }
}
