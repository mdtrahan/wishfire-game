import { clamp01 as c, smooth as s, sliceEvent } from './rustCombatEffects.mjs';
// Slice cast_hue.rs, poison.rs, groove.rs and impact_stop.rs. Simulation stays read-only.
export const CAST_PURPLE=0xa824f9,CAST_BLUE=0xaee5fb;
export function poisonStrength(record,now){
 if(record.end!==null)return .65*(1-c((now-record.end)/1.5))**3;
 const age=Math.max(0,now-record.since),tick=Math.max(1,Math.round(age));
 return record.from+(.45-record.from)*s(age/1.5)+.20*Math.exp(-(((age-tick)/.105)**2));
}
export function castStrength(age,windup){return age<0?0:age<windup?s(age/windup):1-s((age-windup)/windup);}
const TAU=Math.PI*2;
const PALETTES={fara:[0xf21438,0xff618c,0xff80a6,0xff8cad],runa:[0xff9e14,0xffd459,0xffe68c,0xfff0a6],kaja:[0xa11fff,0xcc61ff,0xe08cff,0xf0adff]};
export class SliceActor {
 constructor(){this.records=new Map();this.raw=null;this.stopped=0;this.impact=null;this.charge=null;this.scrimAlpha=0;this.scrimView=null;this.scrimEnd=null;}
 clear(){this.records.clear();this.raw=null;this.stopped=0;this.impact=null;this.charge=null;this.scrimAlpha=0;this.scrimView=null;this.scrimEnd=null;}
 observe(raw,events){
  if(this.raw&&this.raw.encounter_id!==raw.encounter_id)this.clear();
  if(this.raw?.hit_stop)this.stopped+=Math.max(0,raw.time-this.raw.time);
  const old=this.raw;this.raw=raw;
  const frame={...raw,time:raw.time-this.stopped,spotlight:raw.spotlight?{...raw.spotlight,started:raw.spotlight.started-this.stopped}:null};
  const live=old?Math.max(0,raw.time-old.time):0,combat=old?Math.max(0,raw.combat_time-old.combat_time):0,now=frame.time;
  for(const a of raw.actors){
   let r=this.records.get(a.actor_id);
   if(!r){r={rect:{drawX:0,drawY:0,width:0,height:0},cast:null,flash:-100,heal:-100,immuneAt:-100,poison:null,glow:0,glowFrom:0,glowAge:0,glowOn:false,springUntil:-100,sy:1,lift:0,dx:0,angle:0,hue:CAST_PURPLE,strength:0,dark:0,facing:a.facing,candidate:a.facing,since:now};this.records.set(a.actor_id,r);}
   const living=a.hp>0&&!a.downed;
   if(!living){r.cast=null;r.poison=null;r.heal=-100;}
   if(r.cast){const spot=frame.spotlight,featured=spot&&(spot.caster===a.actor_id||spot.co_casters?.includes(a.actor_id));r.cast.age+=featured?(spot.phase==='performing'?live:0):combat;if(!r.cast.released&&a.state==='cast')r.cast.age=a.state_age;if(r.cast.age>=2*r.cast.windup||!r.cast.released&&a.state!=='cast')r.cast=null;}
   if(a.poisoned>0&&living){if(!r.poison)r.poison={since:raw.combat_time,end:null,from:0};else if(r.poison.end!==null){r.poison.from=poisonStrength(r.poison,raw.combat_time);r.poison.since=raw.combat_time;r.poison.end=null;}}
   else if(r.poison&&r.poison.end===null)r.poison.end=raw.combat_time;
   if(r.poison&&r.poison.end!==null&&raw.combat_time-r.poison.end>=1.5)r.poison=null;
   if(r.candidate!==a.facing){r.candidate=a.facing;r.since=now;}
   if(now-r.since>=.15)r.facing=r.candidate;
   if(a.team==='hero'&&(a.state==='basic'||a.state==='cast'||a.special_casting)){const target=raw.actors.find(b=>b.actor_id===a.target);if(target&&Math.abs(target.pos.x-a.pos.x)>1)r.facing=target.pos.x<a.pos.x?'left':'right';}
  }
  for(const e of events){const {kind,data:d}=sliceEvent(e);
   if(kind==='skill_started'){const r=this.records.get(d.id),a=raw.actors.find(a=>a.actor_id===d.id);if(r){r.cast=null;if(living(a)&&((a.kind==='kaja'&&d.skill==='elevate')||(a.kind==='fara'&&d.skill==='taunt')))r.cast={skill:d.skill,age:a.state_age,windup:a.impact_at,released:false};if(a?.kind==='runa'&&d.skill==='healing_spring')r.springUntil=raw.combat_time-a.state_age+2*a.state_duration;}}
   if(kind==='ward_gained'){const cast=this.records.get(d.target)?.cast;if(cast?.skill==='taunt'&&!cast.released){cast.released=true;cast.age=cast.windup;}}
   if(kind==='groove_activated'&&d.groove==='power'){const cast=this.records.get(d.hero)?.cast;if(cast?.skill==='elevate'){cast.released=true;cast.age=cast.windup;for(const a of raw.actors)if(a.team==='hero'&&a.actor_id!==d.hero&&living(a))this.records.get(a.actor_id).flash=raw.combat_time;}}
   if(kind==='healed'&&d.amount>0&&['mend','breather','revive','phoenix','spring_tick'].includes(d.source?.kind)){const r=this.records.get(d.target);if(r)r.heal=raw.combat_time;}
   if(kind==='revive_burst'){const r=this.records.get(d.hero);if(r)r.immuneAt=raw.combat_time;}
   if(kind==='downed')this.impact={kind:'down',born:now};
   if(kind==='died'&&raw.actors.some(a=>a.actor_id===(d.actor??d.id)&&a.kind.startsWith('boss')))this.impact={kind:'boss',born:now};
  }
  if(raw.hit_stop?.cause==='healingspring'||raw.hit_stop?.cause==='healing_spring')this.impact=null;
  const spot=frame.spotlight;
  if(spot){this.scrimView=spot;this.scrimEnd=null;const t=c((now-spot.started)/.15);this.scrimAlpha=.8*(1-(1-t)**3);}else if(this.scrimView||this.scrimAlpha>0){if(this.scrimEnd===null){this.scrimEnd=now;this.scrimFrom=this.scrimAlpha;}this.scrimAlpha=this.scrimFrom*(1-s((now-this.scrimEnd)/.45));if(this.scrimAlpha<.2)this.scrimView=null;}
  if(spot?.phase==='charge'&&(!this.charge||this.charge.id!==spot.caster)){this.charge={id:spot.caster,born:spot.started,end:null,duration:1.2};}
  else if(this.charge&&spot&&spot.phase!=='charge'&&this.charge.end===null)this.charge.end=now;
  if(!spot||this.charge&&this.charge.end!==null&&now-this.charge.end>=.15)this.charge=null;
  for(const a of raw.actors){const r=this.records.get(a.actor_id),flash=.4*(1-s((raw.combat_time-r.flash)/1.875)),cast=r.cast;
   r.hue=cast?.skill==='taunt'?CAST_BLUE:CAST_PURPLE;r.strength=living(a)?Math.max(flash,cast?.windup>0?.55*castStrength(cast.age,cast.windup):0):0;
   r.dark=r.poison?poisonStrength(r.poison,raw.combat_time):0;r.sy=1;r.lift=r.dx=r.angle=0;r.visualX=a.pos.x;r.visualY=a.pos.y;r.poseState=null;
   if(cast){const stretch=cast.skill==='elevate'?1.25:1,age=cast.released?1.5+(cast.age-cast.windup)/stretch:cast.age/stretch;
    if(age<1.82){if(!cast.released){if(cast.skill==='elevate'){if(age<.25)r.sy=1-.08*s(age/.25);else{const up=s((age-.25)/.3);r.sy=.92+.08*up;r.lift=6*up;if(age>=1.1)r.dx=1.5*Math.sin((age-1.1)*TAU*18);}}else{const plant=s(age/.25);r.sy=1-.1*plant;r.angle=6*plant*(a.facing==='left'?1:-1)*Math.PI/180;}}
     else{const t=Math.max(0,age-1.5),tail=t<.1?1:(1-c((t-.1)/.22))**3;if(cast.skill==='elevate'){r.sy=1+.08*tail;r.lift=6*(1-c(t/.2))**3;}else{r.sy=1+.1*tail;r.dx=(a.facing==='left'?-5:5)*tail;}}}
   }
   let on=living(a)&&a.special_casting&&a.kind!=='hondo';
   if(a.kind==='runa'){r.glow=living(a)&&a.encased<=0&&raw.combat_time<r.springUntil+.3?1-s(Math.max(0,raw.combat_time-r.springUntil)/.3):0;}
   else {if(on!==r.glowOn){r.glowFrom=r.glow;r.glowAge=0;r.glowOn=on;}else r.glowAge+=live;r.glow=r.glowFrom+((on?1:0)-r.glowFrom)*s(r.glowAge/.3);}
  }
  return frame;
 }
 featured(a){const v=this.scrimView;return !v||a.actor_id===v.caster||v.co_casters.includes(a.actor_id)||a.team==='enemy'&&v.participants.includes(a.actor_id);}
 pose(frame,effects,reduced=false){
  for(const f of effects){const age=frame.time-f.born,d=f.data;
   if(f.type==='shadow'&&age>=0&&age<1.5){const r=this.records.get(d.hero);if(!r)continue;if(age<.18){const t=reduced?1:1-(1-c(age/.18))**3;r.visualX=d.from.x+(d.to.x-d.from.x)*t;r.visualY=d.from.y+(d.to.y-d.from.y)*t;r.poseState='cast';r.poseAge=0;r.poseDuration=.4;r.poseImpact=0;}else if(age<.52){r.poseState='basic';r.poseAge=.18+Math.max(0,age-.3);r.poseDuration=.4;r.poseImpact=.18;}}
   if(f.type==='boss_push'&&!d.resisted&&!reduced&&age>=0&&age<.1){const r=this.records.get(d.id);if(r)r.visualX+=Math.sin(age/.1*Math.PI*4)*(1-age/.1)*3;}
  }
 }
 applyCamera(camera,frame,reduced=false){
  camera.offsetX=camera.offsetY=0;camera.zoom=.5;
  if(reduced||frame.spotlight)return;
  if(this.impact){const a=Math.max(0,frame.time-this.impact.born);if(this.impact.kind==='boss')camera.zoom*=1+.07*(1-c(a/.32))**2;else{const fade=1-c(a/.16);camera.offsetX+=Math.sin(a*140+1)*1.5*fade;camera.offsetY+=Math.cos(a*90)*.5*fade;}}
 }
}
function living(a){return a?.hp>0&&!a.downed;}
// Source silhouette aura uses the existing flash bitmap; all sizes are body-relative.
export function drawActorAura(g,a,r,x,y,h,now,combat,front,z=1){
 const ward=a.team==='hero'&&a.ward>0&&a.hp>0&&!a.warcry_shield?Math.max(.3,c(a.ward/(.4*a.max_hp))):0,cast=r.glow,level=cast+ward*(1-cast),heal=a.team==='hero'&&a.hp>0?1-s((combat-r.heal-.15)/.3):0;
 const seed=a.actor_id*1.37,breath=.5+.5*Math.sin(now*2.4+seed),shimmer=Math.abs(Math.sin(now*17+seed*3)*Math.sin(now*11.3+seed));
 for(let pass=0;pass<2;pass++){const strength=pass?heal:level;if(strength<=0)continue;
  const palette=PALETTES[a.kind]??PALETTES.fara,mix=level>0?cast/level:0;
  const color0=pass?0x86eb2e:mixHex(PALETTES.fara[0],palette[0],mix),color1=pass?0x86eb2e:mixHex(PALETTES.fara[1],palette[1],mix),color2=pass?0x86eb2e:mixHex(PALETTES.fara[2],palette[2],mix),color3=pass?0x86eb2e:mixHex(PALETTES.fara[3],palette[3],mix);
  if(!front){g.bitmap('flash',0,x,y-h*.48,1.7*h*(1+.05*breath),2*h*(1+.05*breath),0,(.42+.14*breath)*strength,color0);g.bitmap('flash',0,x,y-h*.48,1.25*h,1.55*h,0,(.2+.22*shimmer)*strength,color1);}
  else{g.bitmap('flash',0,x,y-h*.48,.8*h,1.05*h,0,(.05+.10*shimmer)*strength,color2);if(!pass)for(let i=0;i<5;i++){const u=(now*.7+i*.2+seed*.13)%1,size=8*z*(1-.4*u);g.bitmap('flash',0,x+Math.sin(i*2.1+now*1.3+seed)*.36*h,y-h*.48+.4*h-u*h,size,size,0,Math.sin(Math.PI*u)*.85*strength,color3);}}
 }
}

function mixHex(a,b,t){return Math.round((a>>16&255)*(1-t)+(b>>16&255)*t)<<16|Math.round((a>>8&255)*(1-t)+(b>>8&255)*t)<<8|Math.round((a&255)*(1-t)+(b&255)*t);}
