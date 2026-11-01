import { drawSliceHeroBars, drawSliceChest } from './rustCombatWorldHud.mjs';
import { COMBAT_VIEW } from './rustCombatArena.mjs';
import { SliceSpotlightCamera } from './rustCombatSpotlightCamera.mjs';
import { SliceActor, drawActorAura } from './rustCombatActor.mjs';
import { SliceSprites } from './rustCombatSprites.mjs';
import { createPoundModel, drawPound } from './rustCombatPound.mjs';
import { createArcaneModel, drawArcane } from './rustCombatArcane.mjs';
import { createHealingModel, drawHealing } from './rustCombatHealing.mjs';
import { preloadRustCombatAssets } from './rustCombatAssets.mjs';
import { createRustEffectState, elevateSourceForActor, sliceChest, slicePopupSize, clamp01 as c, smooth } from './rustCombatEffects.mjs';
import { createSliceCombatCamera } from './rustCombatCamera.mjs';
import { SliceGpu } from './rustCombatGpu.mjs';
import { SliceGround } from './rustCombatGround.mjs';
import { bubbleSphere, createBubbleModel, drawBubbleShell, drawBubbleRelease } from './rustCombatBubble.mjs';
const TAU=Math.PI*2;
const GRADIENTS={damage:[0xfbfdce,0xf7f8d4],hero:[0xff9488,0xff6458],heal:[0x86eb2e,0x9fdfff],dot:[0xe4c3ff,0x8d37ff],miss:[0xa8adb4,0xa8adb4],blocked:[0x8fd3ff,0x8fd3ff],crit:[0xffd84a,0xffd84a]};
const css=hex=>`#${hex.toString(16).padStart(6,'0')}`;
const bubbleKinds=new Set(['bubble_pop']);

// All phases draw into WFM's existing Canvas, in its actor/ground ordering.
export async function createRustCombatPresentation(globals) {
  const assets=await preloadRustCombatAssets(),gpu=new SliceGpu(assets),camera=createSliceCombatCamera(),ground=new SliceGround(gpu,camera),state=createRustEffectState(),sphere=bubbleSphere();
  let density=window.devicePixelRatio||1,partyHP=0,scale=1,offsetX=0,offsetY=0;
  const shells=new Map(),encased=state.encased,motion=new SliceActor(),spotlightCamera=new SliceSpotlightCamera(assets.manifest.actor_boxes),sprites=new SliceSprites(gpu,camera,motion,state);
  function rasterPopup(p) {
    const actor=state.actors.get(p.target),size=slicePopupSize(p.amount,p.crit,partyHP,p.tone==='miss');
    const image=document.createElement('canvas'),ctx=image.getContext('2d');ctx.font=`${size*density}px SliceBungee`;
    const metrics=ctx.measureText(p.text),width=metrics.width/density,pad=Math.max(1.5,size*.18)+2;
    image.width=Math.ceil((width+pad*2)*density);image.height=Math.ceil((size*2+pad*2)*density);ctx.font=`${size*density}px SliceBungee`;ctx.textAlign='left';ctx.lineJoin='round';ctx.lineWidth=Math.max(1.5,size*.18)*density;
    const tone=p.blocked?'blocked':p.crit&&p.tone!=='heal'?'crit':p.tone==='damage'&&actor?.team==='hero'?'hero':p.element==='poison'?'dot':p.tone,colors=GRADIENTS[tone]||GRADIENTS.damage;
    const gradient=ctx.createLinearGradient(0,0,0,size*2.6*density);gradient.addColorStop(0,css(colors[0]));gradient.addColorStop(1,css(colors[1]));ctx.strokeStyle='#0f0f0f';ctx.fillStyle=gradient;
    const baseline=(size+pad)*density;ctx.strokeText(p.text,pad*density,baseline);ctx.fillText(p.text,pad*density,baseline);
    p.raster=image;p.width=width;p.pad=pad;p.baseline=baseline/density;p.inkHeight=metrics.actualBoundingBoxAscent/density;p.density=density;
  }
  function present(snapshot,events=[]) {
    if(!snapshot){state.clear();shells.clear();encased.clear();motion.clear();spotlightCamera.clear();camera.reset();if(globals.RustCombatPresentation===api)delete globals.RustCombatPresentation;return;}
    const old=state.snapshot;snapshot=motion.observe(snapshot,events);sprites.observe();state.ingest(snapshot,events);motion.pose(snapshot,state.effects,sprites.reduced);
    for(const entry of state.hazards.values()){
      const h=entry.hazard;
      if(h.kind==='arcane_pulse'&&!entry.model){const cast=state.effects.find(f=>f.type==='cast'&&f.data.id===h.owner&&f.data.skill==='arcane_pulse');entry.model=cast?.data.model??createArcaneModel(h.id);}
      if(h.kind==='ground_pound'&&!entry.model)entry.model=createPoundModel(h);
      if(h.kind==='boss_charge'&&h.phase==='active'&&entry.chargeBorn===undefined)entry.chargeBorn=snapshot.combat_time;
    }camera.update(snapshot,old?Math.max(0,snapshot.time-old.time):1);motion.applyCamera(camera,snapshot,sprites.reduced);spotlightCamera.apply(camera,snapshot,sprites.reduced);
    for(const f of state.effects)if(f.type==='shadow'&&f.data.hit&&!sprites.reduced){const t=(snapshot.time-f.data.impact)/.09;if(t>=0&&t<1){camera.offsetX+=1.5*(1-t)**2*Math.sin(TAU*3*t);camera.offsetY+=.45*(1-t)**2*Math.sin(TAU*2*t);}}
    for(const f of state.effects)if(f.type==='ground_pound'){const age=snapshot.time-f.born-(1.75-1.3)*6/13;if(!sprites.reduced&&age>=0&&age<.22){const u=age/.22,p=Math.sin(u*TAU*2.5)*Math.exp(-1.6*u);camera.offsetX+=Math.round(1.5*p/2)*2;camera.offsetY+=Math.round(6*p/2)*2;}}
    partyHP=0;for(const a of snapshot.actors)if(a.team==='hero')partyHP+=a.max_hp;
    for(const p of state.popups)if(!p.raster)rasterPopup(p);
    for(const fx of state.effects){
      if(fx.type==='ground_pound'&&!fx.data.model)fx.data.model=state.hazards.get(fx.data.hazard.id)?.model??createPoundModel(fx.data.hazard);
      if(fx.type==='hit'&&!fx.data.spriteId){const d=fx.data,element=d.element==='physical'?'physical':d.element==='poison'?'poison':'arcane';d.spriteId=element==='poison'?(d.crit?'crit-poison':'faze-tick'):`${d.crit?'crit':'hit'}-${element}`;}
      if(fx.type==='cast'&&fx.data.skill==='arcane_pulse'&&!fx.data.model)fx.data.model=createArcaneModel(fx.data.seed);
      if(fx.type==='arcane_pulse'&&!fx.data.model){const cast=state.effects.find(f=>f.type==='cast'&&f.data.id===fx.data.hazard.owner&&f.data.skill==='arcane_pulse');fx.data.model=cast?.data.model??createArcaneModel(fx.data.seed);fx.data.source=state.actors.get(fx.data.hazard.owner)?.pos??fx.data.hazard.origin;}
      if(fx.type==='cast'&&fx.data.skill==='healing_spring'&&!fx.data.model)fx.data.model=createHealingModel(fx.data.seed);
      if(fx.type==='healing'&&!fx.data.model){const cast=state.effects.find(f=>f.type==='cast'&&f.data.skill==='healing_spring'&&f.data.target===fx.data.target);fx.data.model=cast?.data.model??createHealingModel(fx.data.seed);}
    }
    for(const fx of state.effects)if(bubbleKinds.has(fx.type)&&!fx.data.model){const cast=state.effects.find(f=>f.type==='cast'&&f.data.id===fx.data.hazard.owner&&f.data.skill==='bubble_pop');fx.data.model=cast?.data.model??createBubbleModel(fx.data.seed);}
    for(const fx of state.effects)if(fx.type==='cast'&&fx.data.skill==='bubble_pop'&&!fx.data.model)fx.data.model=createBubbleModel(fx.data.seed);
    for(const a of snapshot.actors){
      if(a.kind==='fara'){
        let sh=shells.get(a.actor_id);if(!sh){sh={active:false,ward:0,changed:snapshot.time,from:0,opacity:0,refresh:-100};shells.set(a.actor_id,sh);}
        const active=a.hp>0&&a.warcry_shield&&a.ward>0;
        if(active!==sh.active){sh.from=sh.opacity;sh.active=active;sh.changed=snapshot.time;sh.refresh=-100;}else if(active&&a.ward>sh.ward+.01)sh.refresh=snapshot.time;
        sh.ward=a.ward;sh.opacity=sh.from+((active?1:0)-sh.from)*smooth((snapshot.time-sh.changed)/.25);
      }
    }
    state.observeEncasements();
    globals.RustCombatPresentation=api;
  }
  function begin(ctx,s,ox,oy){scale=s;offsetX=ox;offsetY=oy;const nextDensity=(window.devicePixelRatio||1)*s;if(density!==nextDensity){density=nextDensity;for(const p of state.popups)rasterPopup(p);}gpu.begin(density,ctx,s,ox,oy);ctx.save();}
  function finish(ctx){gpu.composite();ctx.restore();}
  function groundPass(ctx,s,ox,oy){
    if(!state.snapshot)return;begin(ctx,s,ox,oy);sprites.beginFrame(density,s,ox,oy);const now=state.snapshot.time,z=camera.zoom/.5;sprites.chargeArt(false,now);
    for(const m of state.markers.values()){const age=now-m.born,fade=m.ended===null?1:c(1-(now-m.ended)/.15),id=age<.2?'spawn-marker-appear':'spawn-marker',frame=age<.2?Math.floor(age*20):Math.floor((age-.2)*10+1e-9)%6,e=assets.entries.get(id);gpu.bitmap(id,frame,camera.x(m.pos.x),camera.y(m.pos.y),e.screen_size_px[0]*z,e.screen_size_px[1]*z,0,fade);}
    for(const h of state.groundItems){const x=camera.x(h.origin.x),y=camera.y(h.origin.y),r=h.shape.radius??0;
      if((h.kind==='ward_ring'||h.kind==='elevate_ring')&&h.phase==='active'){const age=(1-h.progress)*(h.kind==='ward_ring'?5:6);if(age<.3)gpu.bitmap('support-cast-pulse',Math.min(2,Math.floor(age/.3*3)),x,y,42*z,31.5*z,0,1-age/.3,h.kind==='ward_ring'?0x59b3ff:0x59ffa6);}
      else if(h.kind==='faze_pool'&&h.phase!=='resolved'){
        const age=(1-c(h.progress))*5,fade=Math.min(age/.1,1)*c((5-age)/.35);gpu.bitmap('faze-pool',0,x,y,r*2*camera.zoom,r*2*camera.zoom*.75,0,fade);
        for(let i=0;i<5;i++){const phase=(age+i*.173)%(2/3+.15+i*.125);if(phase>=2/3||age-phase>=4.3)continue;const a=i*2.399+.4,rr=(.3+i*.11)*r*camera.zoom;gpu.bitmap('faze-bubbles',Math.floor(phase*12),x+Math.cos(a)*rr,y+Math.sin(a)*rr*.75,(9+i*.75)*z,(9+i*.75)*z,0,fade);}
        for(let i=0;i<3;i++){const phase=(age+i*.37)%(1.25+i*.225);if(phase>=1||age-phase>=4)continue;const a=.8+i*2.2,rr=r*camera.zoom*.85;gpu.bitmap('faze-fumes',Math.floor(phase*8),x+Math.cos(a)*rr,y+Math.sin(a)*rr*.75,14*z,21*z,0,fade);}
      }else if(h.kind==='resurrect'&&h.phase!=='resolved'){
        const breath=.92+.08*Math.sin(now*3);gpu.bitmap('resurrect/light-column',0,x,y-76.25,40,160,0,.32*breath,0xffc74d);gpu.bitmap('resurrect/ground-ring',0,x,y,52,39,0,.26,0xffc747);
        // Slice draws its channel clock as geometry; its surrounding light remains bitmap art.
        const n=Math.ceil(80*c(h.progress));for(let i=0;i<n;i++){const a=-Math.PI/2+i/80*TAU,b=-Math.PI/2+Math.min((i+1)/80,h.progress)*TAU;gpu.solidLine(x+Math.cos(a)*23,y+Math.sin(a)*23*.75,x+Math.cos(b)*23,y+Math.sin(b)*23*.75,1.8,0xffd461,.85);}
      }
    }
    for(const f of state.effects)if(f.type==='corpse'){const a=f.data.actor,age=now-f.born-1;if(age>=0){const height=-(assets.manifest.actor_boxes[a.kind]?.idle[1]??-114)*a.scale*(a.kind.startsWith('boss')?1:.6)*camera.zoom,size=Math.min(.70*height,a.kind.startsWith('boss')?42:30);gpu.once('ko-puff',age,camera.x(a.pos.x),camera.y(a.pos.y),size,size);}}
    for(const f of state.effects)if(f.type==='faze_splash'){const h=f.data.hazard,r=h.shape.radius;gpu.once('faze-splash',now-f.born,camera.x(h.origin.x),camera.y(h.origin.y),2*r*camera.zoom,2*r*camera.zoom*.75);}
    procedural(true);ground.hostile(state);finish(ctx);
    if(motion.scrimAlpha>0){ctx.save();ctx.fillStyle='#000';ctx.globalAlpha=motion.scrimAlpha;ctx.fillRect(ox,oy+COMBAT_VIEW.top*s,360*s,(COMBAT_VIEW.bottom-COMBAT_VIEW.top)*s);ctx.restore();}
  }
  function actorPass(ctx,host,footX,footY,height,front,s,ox,oy){
    if(!state.snapshot||host?.rustActorId==null)return;const a=state.actors.get(host.rustActorId);if(!a)return;
    const sh=shells.get(a.actor_id),now=state.snapshot.time,elevate=elevateSourceForActor(a,state.snapshot);
    const record=motion.records.get(a.actor_id);
    if(!(sh?.opacity>0)&&!elevate&&!record?.glow&&!(state.snapshot.combat_time-record?.heal<.45)&&!(a.ward>0&&!a.warcry_shield))return;
    begin(ctx,s,ox,oy);const x=(footX-ox)/s,y=(footY-oy)/s,h=126*(a.kind.startsWith('boss')?a.scale:a.scale*.6)*camera.zoom;
    if(record&&!motion.featured(a))ctx.globalAlpha*=1-motion.scrimAlpha;
    if(record)drawActorAura(gpu,a,record,x,y,h,now,state.snapshot.combat_time,front,camera.zoom/.5);
    if(sh?.opacity>0){const age=Math.max(0,now-sh.changed),transition=age<.25?Math.sin(Math.PI*age/.25)*.6:0,refresh=c(1-(now-sh.refresh)/.25)*.25,pulse=.78+.22*Math.sin(now*TAU/1.35),alpha=Math.min(1,pulse+(transition+refresh)*.12)*sh.opacity*(front?.78:1);gpu.bitmap(front?'warcry-shell-front':'warcry-shell-back',0,x,y-h*.48,h*.943,h*1.18,0,alpha);}
    if(elevate&&a.team==='hero'&&a.hp>0&&!a.downed){const age=8-elevate.groove_active,fade=c(age/.25)*c((1.875-age)/.6),angle=(now/1.6%1)*TAU+(a.actor_id*2.399963229728653)%TAU,bob=Math.sin(angle*2)*1.5,unit=(a.scale??1)*camera.zoom/.5;
      for(let i=0;i<2;i++){const theta=angle+i*Math.PI,depth=Math.sin(theta);if((depth>=0)!==front||fade<=0)continue;const size=24*unit*(.975+depth*.125),atx=x+Math.cos(theta)*22*unit,aty=y-h*.5+(depth*22/3+bob)*unit,id=elevate.elevate==='wingedboots'?'winged_boots':elevate.elevate==='wings'?'wings':'sword',e=assets.entries.get(id);gpu.bitmap(id,0,atx,aty,size*e.image.width/e.image.height,size,0,fade);gpu.flush();const blend=e.blend;e.blend='additive';gpu.bitmap(id,0,atx,aty,size*e.image.width/e.image.height*1.3,size*1.3,0,.35*fade);e.blend=blend;}
    }finish(ctx);
  }
  function shadow(f,now,z){
    const d=f.data,age=now-f.born,chest=sliceChest(d.caster)*camera.zoom,px=camera.x(d.from.x),py=camera.y(d.from.y)-chest,qx=camera.x(d.to.x),qy=camera.y(d.to.y)-chest,dx=qx-px,dy=qy-py,length=Math.hypot(dx,dy),rotation=Math.atan2(dy,dx);
    if(age<.1)gpu.once('shadow-coil',age,px,py,48*z,48*z);
    if(age>=0&&age<.18){const t=age*.12/.18,opacity=t<.012?t/.012:t<.08?1-(t-.012)/.068*.1:.9*(1-(t-.08)/.04);gpu.bitmap('shadow-streak',0,px,py,length*256/245,22*z,rotation,.55*opacity,0xfff2d9);gpu.bitmap('shadow-streak',0,px,py,length*256/245,12*z,rotation,opacity);}
    for(let i=0;i<3;i++){const fraction=i===0?.2:i===1?.45:.7,born=i===0?.024:i===1?.054:.084,t=(age-born)/.11;if(t<0||t>=1)continue;const x=px+dx*fraction,y=py+dy*fraction,w=40*z*(d.caster?.facing==='left'?-1:1);gpu.bitmap('shadow-afterimage',0,x,y,w*1.18,40*z*1.18,0,.35*(1-t),0xffedd9);gpu.bitmap('shadow-afterimage',0,x,y,w,40*z,0,.45*(1-t),0x40306b);}
    if(d.hit){const target=d.targetActor;if(target){const x=camera.x(target.pos.x),y=camera.y(target.pos.y)-sliceChest(target)*camera.zoom,t=now-d.impact;gpu.once('cast-flash-neutral',t,x,y,84*z,84*z);gpu.once('shadow-impact',t,x,y,96*z,96*z);gpu.once('shadow-crack',age-.18,x,camera.y(target.pos.y),64*z,32*z,0,age-.18<.1?.72-1.2*(age-.18):.6*c(1-(age-.28)/.35));}gpu.once('shadow-dissipate',age-.30,qx,camera.y(d.to.y),48*z,48*z);}
  }
  function split(f,now,z){
    const d=f.data,a=d.caster;if(!a)return;const age=now-f.born,px=camera.x(d.center.x),py=camera.y(d.center.y)-42*camera.zoom,ox=camera.x(a.pos.x),oy=camera.y(a.pos.y)-sliceChest(a)*camera.zoom,dx=d.center.x-a.pos.x,dy=(d.center.y-a.pos.y)*.75,sign=dx<0?-1:1;
    gpu.once('crimson-sweep-arc',age,ox,oy,84*sign*z,72*z,Math.atan2(dy*sign,Math.abs(dx)),1,0xffffff,true);
    let primary=null,best=Infinity;for(const target of d.targets)if(target.actor){const p=target.actor.pos,dist=(p.x-d.center.x)**2+(p.y-d.center.y)**2;if(dist<best){best=dist;primary=target.actor;}}
    for(const target of d.targets){const actor=target.actor;if(!actor)continue;const x=camera.x(actor.pos.x),y=camera.y(actor.pos.y)-sliceChest(actor)*camera.zoom,local=actor===primary,arrival=local?.125:.305,flight=age-.125;
      if(!local&&flight>=0&&flight<.18){const dx=x-px,dy=y-py,length=Math.hypot(dx,dy);for(let k=0;k<3;k++){const back=k===0?9:k===1?5:0,alpha=k===0?.13:k===1?.22:1;gpu.bitmap('split-shard',0,px+dx*flight/.18-dx/length*back*z,py+dy*flight/.18-dy/length*back*z,28*z,28*z,Math.atan2(dy,dx),alpha);}}
      if(target.landed)gpu.once('crimson-sweep-impact',age-arrival,x,y,28*z,28*z);
    }
  }
  function procedural(back){
    const now=state.snapshot.time,z=camera.zoom/.5;
    for(const h of state.snapshot.hazards)if(h.kind==='ground_pound'&&h.phase!=='resolved'){const model=state.hazards.get(h.id)?.model;if(model){gpu.postMode(true);drawPound(gpu,model,h,camera,h.progress*1.3,!back);gpu.postMode(false);}}
    for(const h of state.snapshot.hazards)if(h.kind==='arcane_pulse'&&h.phase!=='resolved'){
      const model=state.hazards.get(h.id)?.model,a=state.actors.get(h.owner),p=a?.pos??h.origin;if(model){gpu.postMode(true);drawArcane(gpu,model,camera.x(p.x),camera.y(p.y)-58*.72*z,camera.x(h.origin.x),camera.y(h.origin.y),h.progress*.9,z,back);gpu.postMode(false);}
    }
    for(const f of state.effects){const d=f.data;if(f.type==='ground_pound'&&d.model){gpu.postMode(true);drawPound(gpu,d.model,d.hazard,camera,1.3+(now-f.born)*13/6,!back);gpu.postMode(false);}else if(f.type==='arcane_pulse'&&d.model){gpu.postMode(true);drawArcane(gpu,d.model,camera.x(d.source.x),camera.y(d.source.y)-58*.72*z,camera.x(d.hazard.origin.x),camera.y(d.hazard.origin.y),.9+now-f.born,z,back);gpu.postMode(false);}
      else if(f.type==='healing'&&d.model){const a=state.actors.get(d.target);if(a?.hp>0){gpu.postMode(true);drawHealing(gpu,d.model,camera.x(a.pos.x),camera.y(a.pos.y),now-f.born,z,!back);gpu.postMode(false);}}
    }
  }
  function frontPass(ctx,s,ox,oy){
    if(!state.snapshot)return;begin(ctx,s,ox,oy);const snapshot=state.snapshot,now=snapshot.time,z=camera.zoom/.5;
    gpu.mask(sprites.mask);procedural(false);sprites.chargeArt(true,now);
    for(const a of snapshot.actors)if(a.enraged&&a.hp>0){const pulse=.5+.5*Math.sin(now*TAU*.9),unit=a.scale*camera.zoom;gpu.bitmap('flash',0,camera.x(a.pos.x),camera.y(a.pos.y)-62*unit,120*unit*(1+.06*pulse),150*unit*(1+.06*pulse),0,.16+.12*pulse,0xff140f);}
    for(const h of snapshot.hazards)if(h.kind==='bubble_pop'&&h.phase!=='resolved'){gpu.postMode(true);drawBubbleShell(gpu,sphere,camera.x(h.origin.x),camera.y(h.origin.y),h.progress*.35,h.shape.radius/140*z);gpu.postMode(false);}
    for(const f of state.effects){const age=now-f.born,d=f.data;
      if(f.type==='shadow')shadow(f,now,z);else if(f.type==='split')split(f,now,z);
      else if(f.type==='bubble_pop'&&d.model){gpu.postMode(true);drawBubbleRelease(gpu,d.model,camera.x(d.hazard.origin.x),camera.y(d.hazard.origin.y),age,d.hazard.shape.radius/140*z);gpu.postMode(false);}
      else if(f.type==='boss_push'){const a=state.actors.get(d.id);if(a){const x=camera.x(a.pos.x),y=camera.y(a.pos.y);if(d.resisted)gpu.once('blast-smoke',age*.48/.18,x,y,42*z,22*z,0,.65*(1-age/.18));else gpu.once('hit-physical',age,x,y-sliceChest(a)*camera.zoom,(d.interrupted?48:36)*z,(d.interrupted?48:36)*z);}}
      else if(f.type==='hit'){const a=d.actor,source=d.sourceActor;if(!a)continue;let dx=(source?.pos.x??a.pos.x)-a.pos.x,dy=((source?.pos.y??a.pos.y)-a.pos.y)*.75;const length=Math.hypot(dx,dy);if(length){dx/=length;dy/=length;}const element=d.element==='physical'?'physical':d.element==='poison'?'poison':'arcane',id=d.spriteId;if(assets.entries.has(id))gpu.once(id,age,camera.x(a.pos.x)+dx*6*z,camera.y(a.pos.y)-sliceChest(a)*camera.zoom+dy*6*z,(d.crit?38:d.element==='poison'?12:24)*z,(d.crit?38:d.element==='poison'?12:24)*z,Math.atan2(-dy,-dx));}
      else if(f.type==='phoenix_burst'){const t=c((snapshot.combat_time-d.combatBorn)/.5),radius=d.radius*camera.zoom*(1-(1-t)**3);gpu.bitmap('wave_band',0,camera.x(d.pos.x),camera.y(d.pos.y),radius*2,radius*2*.75,0,(1-t)*.85,0xffcc44);}
      else if(f.type==='revive'||f.type==='revive_cancel'){const a=d.actor;if(!a)continue;const interrupted=f.type==='revive_cancel',t=c(age/(interrupted?.28:.75)),size=interrupted?1-t*.65:.65+t,x=camera.x(a.pos.x),y=camera.y(a.pos.y);gpu.bitmap(interrupted?'resurrect/channel-glow':'resurrect/burst',0,x,y-23,85*size,112*size,0,(1-t)*(interrupted?.3:.95),0xffd159);if(!interrupted)gpu.bitmap('resurrect/ground-ring',0,x,y,86*(.3+t),86*.75*(.3+t),0,(1-t)*.9,0xffcc52);}
    }
    for(const h of state.channels){const x=camera.x(h.origin.x),y=camera.y(h.origin.y);for(let i=0;i<9;i++){const phase=(now*.36+i*.113)%1,px=x+Math.sin(i*2.4+phase*3)*(10+phase*8),py=y-10-phase*115,size=15*(1-phase*.4);gpu.bitmap('resurrect/motes',(Math.floor(now*8)+i)%4,px,py,size,size,0,(1-phase)*.85,0xffd666);}const owner=state.actors.get(h.owner);if(owner?.hp>0)gpu.bitmap('resurrect/channel-glow',0,camera.x(owner.pos.x),camera.y(owner.pos.y)-19,43,58,0,.3*(.92+.08*Math.sin(now*3)),0xffba38);}
    for(const h of snapshot.hazards)if(h.kind==='boss_charge'&&h.phase==='active'){
      const a=state.actors.get(h.owner),entry=state.hazards.get(h.id);if(!a||a.hp<=0)continue;const age=snapshot.combat_time-(entry.chargeBorn??snapshot.combat_time),unit=(a.scale??2.2)/2.2,mirror=h.dir.x<0,rotation=Math.atan2(h.dir.y*.75,h.dir.x)-(mirror?Math.PI:0),x=camera.x(a.pos.x),y=camera.y(a.pos.y)-38*unit;gpu.bitmap('charge-lines',(Math.floor(age*24)+2)%6,x,y,128*unit,96*unit,rotation,1,0xffffff,mirror);gpu.bitmap('charge-shell',Math.floor(age*18)%6,x,y,128*unit,96*unit,rotation,1,0xffffff,mirror);
    }
    for(const p of snapshot.projectiles??[]){
      const x=camera.x(p.pos.x),y=camera.y(p.pos.y)-p.height*camera.zoom,angle=Math.atan2(p.dir.y*.75,p.dir.x),observation=state.projectiles.get(p.id),enemy=p.team==='enemy',kaja=observation?.source?.kind==='kaja';
      if(p.kind==='bolt'){gpu.bitmap('bolt',0,x,y,23*z,6*z,angle);continue;}
      if(p.kind==='bomb'){gpu.bitmap('bomb',0,x,y,14*z,14*z,angle);continue;}
      const head=enemy?'orb-head-neutral':kaja?'orb-head-kaja':'orb-head',trail=enemy?'orb-trail-neutral':kaja?'orb-trail-kaja':'orb-trail',tint=enemy?0xffafc2:0xffffff,dx=p.dir.x,dy=p.dir.y*.75,length=Math.hypot(dx,dy)||1,travel=observation?Math.hypot(camera.x(p.pos.x)-camera.x(observation.origin.x),camera.y(p.pos.y)-camera.y(observation.origin.y)):0,span=Math.max(0,Math.min(24*z,travel-4*z));
      if(span>0){const tx=x-dx/length*4*z,ty=y-dy/length*4*z;gpu.strip(trail,tx-dx/length*span,ty-dy/length*span,tx,ty,6*z,1,tint);}
      gpu.bitmap(head,1,x,y,12*z,12*z,angle,1,tint);
    }
    for(const a of snapshot.actors)if(a.team==='enemy'&&a.hp>0&&a.slowed>0){const height=126*(a.kind.startsWith('boss')?a.scale:a.scale*.6)*camera.zoom;for(let k=0;k<3;k++){const t=(now*.65+a.actor_id*.17+k*.32)%1,size=(4+k*.5)*z;gpu.bitmap('bubble-droplets',k,camera.x(a.pos.x)+(k-1)*height*.2,camera.y(a.pos.y)-height*(.82-.48*t),size,size,0,.65*(1-t*.45),0xe6ffff);}}
    for(const [id,record]of encased){const a=state.actors.get(id)??record.actor,height=126*(a.kind.startsWith('boss')?a.scale:a.scale*.6)*camera.zoom,x=camera.x(a.pos.x),y=camera.y(a.pos.y)+height*.15,wobble=Math.sin((now+id)*5)*.02,size=height*1.3*192/180;if(record.ended===null)gpu.bitmap('bubble-swell',Math.min(5,Math.floor((now-record.born)/.18*6)),x,y,size*(1+wobble),size*(1-wobble),0,.86);else{gpu.once('bubble-pop',now-record.ended,x,y,size*256/192,size*256/192,0,.8);gpu.once('bubble-suds',now-record.ended,x,camera.y(a.pos.y)-height*.5,height*.65,height*.65);}}
    finish(ctx);labels(ctx,s,ox,oy);
    drawSliceHeroBars(ctx,snapshot,camera,s,ox,oy);
  }
  function labels(ctx,s,ox,oy){const snapshot=state.snapshot,now=snapshot.time;ctx.save();for(let i=0;i<state.popups.length;i++){const p=state.popups[i],age=now-p.born;if(age<0)continue;let above=0;for(let j=i+1;j<state.popups.length;j++)if(state.popups[j].target===p.target)above++;const a=state.actors.get(p.target),pos=a?.pos??p.pos,height=126*(a?.scale??1)*(a?.kind?.startsWith('boss')?1:.6)*camera.zoom,t=c(age/p.life),side=a?.team==='hero'?-10:a?10:0,cy=Math.max(COMBAT_VIEW.top+p.inkHeight*.5+p.pad,Math.min(COMBAT_VIEW.bottom-p.inkHeight*.5-p.pad,camera.y(pos.y)-height*.5-above*12-18*(1-(1-t)**2))),x=Math.max(p.width/2+3,Math.min(357-p.width/2,camera.x(pos.x)+side))-p.width/2-p.pad,y=cy+p.inkHeight*.5-p.baseline;ctx.globalAlpha=c((p.life-age)/.25);ctx.drawImage(p.raster,ox+Math.round(x*density)/density*s,oy+Math.round(y*density)/density*s,p.raster.width/density*s,p.raster.height/density*s);}ctx.restore();}
  const api={chest(ctx,s,ox,oy){drawSliceChest(ctx,state.snapshot,camera,assets,gpu,s,ox,oy);},present,ground:groundPass,actor:actorPass,front:frontPass,camera,state,motion,project:camera.project,
    sprite:sprites.sprite.bind(sprites),
    pose(view){return motion.records.get(view.actor_id);},
    height(host,fallback,s=1){const a=state.actors.get(host?.rustActorId);return a?128*(a.kind.startsWith('boss')?a.scale:a.scale*.6)*camera.zoom*s:fallback;},
    dispose(){present(null);gpu.dispose();assets.dispose();}};
  return api;
}
