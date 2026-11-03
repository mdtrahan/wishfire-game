import { ENEMY_DEFEAT_FADE_SEC } from './actorPuppetDefeats.mjs';
import { clamp01 as c, smooth } from './rustCombatEffects.mjs';
const TAU=Math.PI*2;
const DIRECTIONS=[-1,0,1,0,0,-1,0,1,-.707,-.707,.707,-.707,-.707,.707,.707,.707],ENERGY=[8,.045,5,.10,2,.20];
const COLORS={fara:0xe62633,hondo:0xd9338c,runa:0x8cd9ff,kaja:0x9e61ff};
// SplitMix64, matching charge.rs. Plans are built only at charge admission.
const bits=new DataView(new ArrayBuffer(8));
const MASK=(1n<<64n)-1n;
function random(seed){seed&=MASK;seed^=seed>>30n;seed=seed*0xbf58476d1ce4e5b9n&MASK;seed^=seed>>27n;seed=seed*0x94d049bb133111ebn&MASK;seed^=seed>>31n;return Number(seed>>40n)/16777215;}
export function chargeLines(id,started,duration=1.2){
 bits.setFloat64(0,started,true);const seed=BigInt(id)^bits.getBigUint64(0,true),lines=[];
 for(let i=0;i<12;i++)for(let cycle=0;cycle<Math.ceil(duration/.48)+1;cycle++){const k=(seed+BigInt(i+1)*0x9e3779b97f4a7c15n+BigInt(cycle)*0x517cc1b727220a95n)&MASK,angle=random(k)*TAU;lines.push({born:i*.04+cycle*.48,life:.12+.06*random(k+3n),dx:Math.cos(angle),dy:Math.sin(angle),start:3.5+1.5*random(k+1n),length:1.2+.8*random(k+2n)});}
 return lines;
}
export class SliceSprites {
 constructor(gpu,camera,motion,state){this.gpu=gpu;this.camera=camera;this.motion=motion;this.state=state;this.mask=document.createElement('canvas');this.maskCtx=this.mask.getContext('2d');this.s=1;this.ox=this.oy=0;this.charge=null;this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
 beginFrame(density,s,ox,oy,maskEnabled){this.maskEnabled=maskEnabled;if(maskEnabled){const w=Math.round(360*density),h=Math.round(640*density);if(this.mask.width!==w||this.mask.height!==h){this.mask.width=w;this.mask.height=h;}this.maskCtx.setTransform(density,0,0,density,0,0);this.maskCtx.clearRect(0,0,360,640);}this.s=s;this.ox=ox;this.oy=oy;}
 observe(){const charge=this.motion.charge;if(charge&&this.charge!==charge){this.charge=charge;charge.lines=chargeLines(charge.id,charge.born,charge.duration);}else if(!charge)this.charge=null;this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
 sprite(ctx,p,options){
  const host=options.actor;
  if(host?.isPuppetDefeat){
   const paint=host.puppetPaint;if(!paint)return null;
   const {presentation,dx,dy,w,hh,angle}=paint,s=this.s,px=(options.footX-this.ox)/s,py=(options.footY-this.oy)/s;
   const opacity=1-c((options.now-host.actionStateStartedAt)/ENEMY_DEFEAT_FADE_SEC),g=this.gpu;
   ctx.save();g.begin((window.devicePixelRatio||1)*s,ctx,s,this.ox,this.oy);
   g.actor(presentation.frame,px+dx,py+dy,w,hh,opacity,0,0,1,1,1,0,'alpha',angle,px,py);
   g.composite();ctx.restore();
   return {drawX:options.footX+dx*s,drawY:options.footY+dy*s,width:w*s,height:hh*s};
  }
  const a=this.state.actors.get(options.rustActorId),r=a&&this.motion.records.get(a.actor_id);
  if(!a||!r||(a.team==='enemy'&&a.hp<=0)||!p?.frame||!p.clip)return null;
  const s=this.s,ox=this.ox,oy=this.oy,frame=this.state.snapshot,unit=options.height/s/(p.clip.canvas.referenceHeight??p.clip.canvas.height),h=options.height/s,x=(options.footX-ox)/s+this.camera.x(r.visualX)-this.camera.x(a.pos.x),y=(options.footY-oy)/s+this.camera.y(r.visualY)-this.camera.y(a.pos.y),body=126*(a.kind.startsWith('boss')?a.scale:a.scale*.6)*this.camera.zoom,poseUnit=body/58;
  if(!r.rect)r.rect={drawX:0,drawY:0,width:0,height:0};const rect=r.rect;
  const px=x+r.dx*poseUnit,py=y-r.lift*poseUnit-(a.team==='enemy'&&a.encased>0?(6+2*Math.sin(frame.combat_time*3+a.actor_id))*this.camera.zoom/.5:0),dx=-p.clip.footOrigin.x*unit,dy=-p.clip.footOrigin.y*unit*r.sy,w=p.clip.canvas.width*unit,hh=p.clip.canvas.height*unit*r.sy;
  rect.drawX=ox+(px+dx)*s;rect.drawY=oy+(py+dy)*s;rect.width=w*s;rect.height=hh*s;
  if(host)host.puppetPaint={presentation:p,dx:px+dx-x,dy:py+dy-y,w,hh,angle:r.angle,height:h};
  const opacity=this.motion.featured(a)?1:1-this.motion.scrimAlpha;
  ctx.save();
  const g=this.gpu;g.begin((window.devicePixelRatio||1)*s,ctx,s,ox,oy);
  const charge=this.charge,reduced=this.reduced;
  if(charge?.id===a.actor_id){if(!charge.image)charge.image=p.frame;this.echoes(charge,px,py,body,dx,dy,w,hh,frame.time,reduced);}
  if(a.kind.startsWith('boss')&&a.hp>0){const energy=.03+(a.energy??0)**2,z=this.camera.zoom/.5;for(let ring=0;ring<3;ring++)for(let i=0;i<8;i++){const ex=DIRECTIONS[i*2]*ENERGY[ring*2]*z,ey=DIRECTIONS[i*2+1]*ENERGY[ring*2]*z;g.actor(p.frame,px+dx+ex,py+dy+ey,w,hh,opacity*ENERGY[ring*2+1]*energy,0,0,1,.34,.06,0,'additive',r.angle,px+ex,py+ey);}}
  // Source-matching shader preserves painted alpha, lifts utility casts and multiplies poison.
  let tr=1-.88*r.dark,tg=1-.12*r.dark,tb=1-.82*r.dark;
  if(a.slowed>0){tr*=.87;tg*=.98;}if(a.kind==='hondo'&&a.groove_active>0&&r.strength<=0){tg*=.91;tb*=.69;}
  let lift=0;for(const f of this.state.effects){if(f.type==='healing'&&f.data.target===a.actor_id)lift=Math.max(lift,.2*smooth((frame.time-f.born)/.5)*(1-smooth((frame.time-f.born-1.4)/1.2)));}
  g.actor(p.frame,px+dx,py+dy,w,hh,opacity,r.hue,r.strength,tr,tg,tb,0,'alpha',r.angle,px,py);
  if(lift>0)g.actor(p.frame,px+dx,py+dy,w,hh,opacity,0,0,1,1,1,lift,'additive',r.angle,px,py,0);
  let targetLight=0;for(const f of this.state.effects)if(f.type==='arcane_pulse'&&f.data.model&&f.data.victims?.includes(a.actor_id))for(const beam of f.data.model.beams){const age=.9+frame.time-f.born-beam.arrival;if(age>=0&&age<.2)targetLight=Math.max(targetLight,.38*(1-c(age/.2)));}
  if(targetLight>0)g.actor(p.frame,px+dx,py+dy,w,hh,opacity,0,0,1,1,1,targetLight,'additive',r.angle,px,py,1);
  const immuneAge=frame.combat_time-r.immuneAt;
  if(a.hp>0&&immuneAge>=0&&immuneAge<2){const alpha=reduced?.12:.12+.16*Math.max(0,Math.sin(immuneAge*22));for(let i=0;i<4;i++){if(!reduced&&(Math.floor(immuneAge*14)+i)%3===0)continue;const ex=i===0?-1:i===1?1:0,ey=i===2?-1:i===3?1:0;g.actor(p.frame,px+dx+ex,py+dy+ey,w,hh,alpha,0,0,1,.84,.43,0,'additive',r.angle,px+ex,py+ey);}}
  g.composite();ctx.restore();
  if(this.maskEnabled){const mask=this.maskCtx;mask.save();mask.translate(px,py);mask.rotate(r.angle);mask.drawImage(p.frame,dx,dy,w,hh);mask.restore();}
  return rect;
 }
 echoes(charge,x,y,h,dx,dy,w,hh,now,reduced){
  const age=now-charge.born,tail=charge.end===null?1:c(1-(now-charge.end)/.15),a=this.state.actors.get(charge.id),color=COLORS[a.kind]??COLORS.kaja,tr=(color>>16&255)/255,tg=(color>>8&255)/255,tb=(color&255)/255,interval=reduced?charge.duration/2:.15;
  for(let i=0;i<Math.ceil(charge.duration/interval-1e-6);i++){const t=(age-i*interval)/.55;if(t>=0&&t<1)this.echo(charge.image,x,y,h,dx,dy,w,hh,t,1,reduced?1.3:2.4,reduced?1:1.2,(reduced?.3:.9)*tail,(tr+1)/2,(tg+.92)/2,(tb+.75)/2);}
  this.echo(charge.image,x,y,h,dx,dy,w,hh,0,reduced?1.05:1.12,1.12,1,(reduced?.22:(.475+.125*Math.sin(age*9))*1.25)*tail,tr,tg,tb);
  const flare=(age-Math.max(0,charge.duration-.1))/.25;
  if(!reduced&&flare>=0&&flare<1)this.echo(charge.image,x,y,h,dx,dy,w,hh,flare,1,3.2,1.2,tail,(tr+1)/2,(tg+.92)/2,(tb+.75)/2);
 }
 echo(image,x,y,h,dx,dy,w,hh,t,from,to,stretch,alpha,tr,tg,tb){const ease=1-(1-c(t))**3,sx=from+(to-from)*ease,sy=sx*(1+(stretch-1)*ease),mid=y-h*.5;this.gpu.actor(image,x+dx*sx,mid+(dy+h*.5)*sy,w*sx,hh*sy,alpha*(1-t)**2,0,0,tr,tg,tb,0,'additive');}
 chargeArt(front,now){
  const q=this.charge;if(!q)return;const a=this.state.actors.get(q.id);if(!a)return;const age=now-q.born,g=this.gpu,camera=this.camera,h=126*a.scale*.6*camera.zoom,x=camera.x(a.pos.x),y=camera.y(a.pos.y),color=COLORS[a.kind]??COLORS.kaja;
  if(!front){const e=g.assets.get('charge-ground'),duration=e.duration,at=age/q.duration*duration;g.once('charge-ground',at,x,y+e.screen_size_px[1]*h/64,e.screen_size_px[0]*h/32,e.screen_size_px[1]*h/32,0,.5,color);return;}
  if(q.end===null){const e=g.assets.get('charge-gather');g.bitmap('charge-gather',Math.floor(age/.075)%e.frame_count,x,y-h*19/32,e.screen_size_px[0]*h/16,e.screen_size_px[1]*h/16,0,1,0xffffff);for(const line of q.lines){const t=(age-line.born)/line.life;if(t<0||t>=1)continue;const radius=line.start+(.3-line.start)*(1-(1-t)**2),hx=x+line.dx*radius*h,hy=y-h*19/32+line.dy*radius*h;g.strip('bolt-trail-neutral',hx+line.dx*line.length*h,hy+line.dy*line.length*h,hx,hy,1.8*camera.zoom/.5,Math.sin(Math.PI*t)*.95);}}
  const flare=(age-Math.max(0,q.duration-.1))/.25;if(flare>=0&&flare<1){const e=g.assets.get('charge-flare');g.once('charge-flare',flare*.2,x,y,e.screen_size_px[0]*h/32,e.screen_size_px[1]*h/32,0,1,color);}
 }
}
