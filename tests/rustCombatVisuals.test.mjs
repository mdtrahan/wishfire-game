import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRustEffectState, elevateSourceForActor, effectSeed, slicePopupSize } from '../web-runner/systems/rustCombatEffects.mjs';
import { sampleRustVfx } from '../web-runner/systems/rustCombatAssets.mjs';
import { createBubbleModel } from '../web-runner/systems/rustCombatBubble.mjs';
import { createArcaneModel } from '../web-runner/systems/rustCombatArcane.mjs';
import { SLICE_FLOOR, COMBAT_VIEW } from '../web-runner/systems/rustCombatArena.mjs';
import { createSliceCombatCamera } from '../web-runner/systems/rustCombatCamera.mjs';
import { installRustCombat } from '../web-runner/systems/rustCombat.mjs';
const root=new URL('../web-runner/assets/rust-combat/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root)));
const hero={actor_id:1,team:'hero',kind:'hondo',pos:{x:900,y:300},hp:100,max_hp:100,scale:1,state:'cast'},enemy={actor_id:2,team:'enemy',kind:'boss',pos:{x:1050,y:300},hp:100,max_hp:100,scale:2.2};
const snapshot=(time=1,hazards=[])=>({encounter_id:'visual-proof',time,combat_time:time,actors:[hero,enemy],hazards,projectiles:[],geometry:{floor:{min:{x:0,y:-40},max:{x:2160,y:680}}}});
const present=(kind,data)=>({body:{kind:'presentation',data:{event:{kind,data}}}});
const damage=data=>({body:{kind:'damage',data:{source:1,target:2,amount:15,crit:false,element:'physical',...data}}});

test('slice manifest validates every referenced byte and excludes UI/arena/reward/chest art',()=>{
 assert.equal(manifest.source_commit,'9c142b5f73294bd5a783e79d3840d0c3386c90a1');
 for(const [file,hash]of Object.entries(manifest.sha256)){const bytes=fs.readFileSync(new URL(file,root));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash,file);assert.ok(!/^(arena|icons|wishfire-skills)\//.test(file),file);if(file.startsWith('rewards/'))assert.ok(/^rewards\/chest-(closed|open)\.png$/.test(file));}
 for(const [id,e]of Object.entries(manifest.effects)){assert.ok(fs.existsSync(new URL(e.file,root)),id);assert.equal(e.frame_ms.length,e.frame_count,id);const b=fs.readFileSync(new URL(e.file,root));assert.equal(b.readUInt32BE(16),e.frame_size[0]*e.frame_count,id);assert.equal(b.readUInt32BE(20),e.frame_size[1],id);}
 assert.ok(fs.existsSync(new URL(manifest.font,root)));
});
test('flag off imports and preloads no slice module or asset',()=>{
 let loads=0;const load=()=>{loads++;throw new Error('unexpected load');};
 for(const search of ['', '?rustCombat=0','?rustShadow=1'])assert.equal(installRustCombat({}, {location:{hostname:'localhost',search},load}),undefined);
 assert.equal(loads,0);
 const runtime=fs.readFileSync(new URL('../web-runner/app.js',import.meta.url),'utf8');assert.ok(!runtime.includes('rustCombatPresentation'));
});
test('damage, blocked, heal and Miss retain the slice font size, format and three-popup stack',()=>{
 const fx=createRustEffectState();fx.ingest(snapshot(),[damage({crit:true,amount:23}),damage({amount:7,blocked:true}),damage({amount:9}),damage({amount:12})]);
 assert.equal(fx.popups.length,3);assert.equal(fx.popups[0].tone,'blocked');
 fx.ingest(snapshot(1.1),[present('healed',{target:1,amount:12,source:{kind:'mend'}}),present('evaded',{target:2,source:1})]);assert.equal(fx.popups.at(-1).text,'Miss');assert.ok(fx.effects.some(f=>f.type==='green_aura'));
 assert.equal(slicePopupSize(9,false,100),10.5);assert.equal(slicePopupSize(9,true,100),16);assert.equal(slicePopupSize(60,false,100),18.7);assert.equal(slicePopupSize(0,false,100,true),12);
});
test('Shadow owns its hit regardless of event order and retains the 180/280ms beats',()=>{
 const fx=createRustEffectState();fx.ingest(snapshot(),[damage({amount:42}),present('blink',{hero:1,target:2,from:hero.pos,to:{x:1080,y:300}})]);
 assert.equal(fx.effects.filter(f=>f.type==='shadow').length,1);assert.equal(fx.effects.filter(f=>f.type==='hit').length,0);assert.equal(fx.popups[0].born,1.28);
});
test('Crimson Sweep owns its split hits and retains source/recipient identities',()=>{
 const fx=createRustEffectState();fx.ingest(snapshot(),[damage({}),present('split_strike',{hero:1,center:enemy.pos,targets:[2]})]);
 const split=fx.effects.find(f=>f.type==='split');assert.equal(split.data.caster.actor_id,1);assert.equal(split.data.targets[0].actor.actor_id,2);assert.equal(split.data.targets[0].landed,true);assert.equal(fx.effects.filter(f=>f.type==='hit').length,0);
});
test('resolved effects use Rust hazard geometry after the snapshot removes it; cancellation removes flash',()=>{
 for(const kind of ['bubble_pop','ground_pound','arcane_pulse','boss_slam','boss_cone','boss_stomp_step']){
  const h={id:10,kind,owner:1,origin:{x:950,y:320},shape:{kind:'circle',radius:140},phase:'locked',progress:.9};const fx=createRustEffectState();fx.ingest(snapshot(1,[h]),[]);fx.ingest(snapshot(1.033),[present('hazard_resolved',{id:10,kind,victims:[2]})]);
  assert.equal(fx.effects.find(f=>f.type==='resolved').data.hazard,h);if(['bubble_pop','ground_pound','arcane_pulse'].includes(kind))assert.ok(fx.effects.some(f=>f.type===kind));
  fx.ingest(snapshot(1.04),[present('hazard_cancelled',{id:10,kind})]);assert.ok(!fx.effects.some(f=>f.type==='resolved'));
 }
});
test('Resurrect/Phoenix share recipient channel results and cleared encounters release effects',()=>{
 const fx=createRustEffectState();fx.ingest(snapshot(),[{body:{kind:'revived',data:{hero:1}}},present('phoenix_cancelled',{hero:1})]);assert.equal(fx.effects[0].type,'revive');assert.equal(fx.effects[1].type,'revive_cancel');fx.ingest(null,[]);assert.equal(fx.effects.length,0);assert.equal(fx.actors.size,0);
});
test('sprite sampling retains authored frame holds and ends exactly after the last hold',()=>{
 const e={frame_count:3,frame_ms:[16,17,33]};assert.equal(sampleRustVfx(e,-.1),-1);assert.equal(sampleRustVfx(e,.015),0);assert.equal(sampleRustVfx(e,.016),1);assert.equal(sampleRustVfx(e,.033),2);assert.equal(sampleRustVfx(e,.066),-1);
});
test('Bubble Pop model has 1000 particles with separate style and motion streams',()=>{
 const a=createBubbleModel(1),b=createBubbleModel(2),replay=createBubbleModel(1);assert.equal(a.particles.length,1000);assert.equal(a.particles.filter(p=>p.delay===0).length,760);assert.deepEqual(a,replay);assert.notDeepEqual(a.origins,b.origins);
 for(let i=0;i<1000;i++){assert.equal(a.particles[i].size,b.particles[i].size);assert.equal(a.particles[i].color,b.particles[i].color);assert.equal(a.particles[i].delay,b.particles[i].delay);}
 assert.equal(effectSeed(1,0),747796405);
});
test('Arcane Pulse keeps five fixed paths, 8-12 beams, first arrival at 900ms and path launch separation',()=>{
 for(let seed=0;seed<100;seed++){const m=createArcaneModel(seed);assert.ok(m.beams.length>=8&&m.beams.length<=12);assert.ok(Math.abs(Math.min(...m.beams.map(b=>b.arrival))-.9)<1e-6);assert.equal(new Set(m.beams.map(b=>b.path)).size,5);for(const a of m.beams)for(const b of m.beams)if(a!==b&&a.path===b.path)assert.ok(Math.abs(a.launch-b.launch)>=.07999);}
});
test('ground projection uses .75 squash, preserves fixed zoom and leaves snapshots untouched',()=>{
 const s=snapshot(),before=structuredClone(s),cam=createSliceCombatCamera();cam.update(s,1);const dx=cam.x(1100)-cam.x(1000),dy=cam.y(400)-cam.y(300);assert.equal(dx,50);assert.equal(dy,37.5);assert.deepEqual(s,before);
});

test('slice camera fits hero and Troll body bounds inside the unchanged WFM HUD gap',()=>{
 const cam=createSliceCombatCamera(),s=snapshot();s.geometry.floor=SLICE_FLOOR;
 s.actors=[{...hero,pos:{x:418,y:520}},{...enemy,pos:{x:456,y:430}}];cam.update(s,1);
 assert.ok(cam.y(430-370)>=COMBAT_VIEW.top-1e-6);assert.ok(cam.y(520+30)<=COMBAT_VIEW.bottom+1e-6);
});

const {SliceActor,poisonStrength,castStrength,CAST_PURPLE,CAST_BLUE}=await import('../web-runner/systems/rustCombatActor.mjs');
const {chargeLines}=await import('../web-runner/systems/rustCombatSprites.mjs');
const {createPoundModel,drawPound}=await import('../web-runner/systems/rustCombatPound.mjs');
const {SliceSpotlightCamera}=await import('../web-runner/systems/rustCombatSpotlightCamera.mjs');
test('utility casts retain source hue strengths, release curves and party-only Elevate flash',()=>{
 const motion=new SliceActor(),s=snapshot(0);s.actors=[{...hero,kind:'kaja',actor_id:1,state:'cast',state_age:0,impact_at:1.875,state_duration:2.5}, {...hero,kind:'fara',actor_id:3},enemy];
 motion.observe(s,[present('skill_started',{id:1,skill:'elevate'})]);assert.equal(motion.records.get(1).strength,0);
 motion.observe({...s,time:1.875,combat_time:1.875,actors:s.actors.map(a=>a.actor_id===1?{...a,state_age:1.875}:a)},[present('groove_activated',{hero:1,groove:'power'})]);
 assert.equal(motion.records.get(1).hue,CAST_PURPLE);assert.equal(motion.records.get(1).strength,.55);assert.equal(motion.records.get(3).strength,.4);assert.equal(motion.records.get(2).strength,0);
 assert.equal(castStrength(1.5,1.5),1);assert.equal(castStrength(2.25,1.5),.5);assert.equal(castStrength(3,1.5),0);
 const fara={...s,actors:[{...hero,kind:'fara',state:'cast',state_age:1.5,impact_at:1.5,state_duration:2}]};motion.observe({...fara,encounter_id:'ward'},[present('skill_started',{id:1,skill:'taunt'}),present('ward_gained',{target:1})]);assert.equal(motion.records.get(1).hue,CAST_BLUE);assert.equal(motion.records.get(1).strength,.55);
});
test('poison ramps over 1.5s, retains Gaussian ticks and decays for 1.5s on combat time',()=>{
 const infection={since:0,end:null,from:0};assert.ok(poisonStrength(infection,0)<1e-9);assert.equal(poisonStrength(infection,2.5),.45+.20*Math.exp(-((.5/.105)**2)));assert.equal(poisonStrength(infection,3),.65);
 infection.end=3;assert.equal(poisonStrength(infection,3),.65);assert.equal(poisonStrength(infection,4.5),0);
 const motion=new SliceActor();motion.observe({...snapshot(0),actors:[{...hero,poisoned:3},enemy]},[]);motion.observe({...snapshot(1),combat_time:0,actors:[{...hero,poisoned:3},enemy]},[]);assert.ok(motion.records.get(1).dark<1e-9);
});
test('hit stop removes frozen time from presentation; Healing Spring cannot inherit camera punch',()=>{
 const m=new SliceActor(),s=snapshot(1);m.observe(s,[]);m.observe({...s,time:2,hit_stop:{cause:'healingspring'}},[]);const frozen=m.observe({...s,time:2+1/30,hit_stop:{cause:'healingspring'}},[]);assert.equal(frozen.time,2);
 const cam=createSliceCombatCamera();cam.update(s,1);m.impact={kind:'boss',born:2};m.observe({...s,time:2.1,hit_stop:{cause:'healingspring'}},[]);m.applyCamera(cam,m.observe({...s,time:2.2},[]));assert.equal(cam.zoom,.5);assert.equal(cam.offsetX,0);assert.equal(cam.offsetY,0);
});
test('charge admits once, holds its source clock and releases its echoes after 150ms',()=>{
 const m=new SliceActor(),base=snapshot(0),spotlight={caster:1,started:0,phase:'charge',participants:[1,2],co_casters:[],hazards:[],projectiles:[]};
 m.observe({...base,spotlight},[]);const q=m.charge;m.observe({...base,time:.6,spotlight},[]);assert.equal(m.charge,q);m.observe({...base,time:1.2,spotlight:{...spotlight,phase:'performing'}},[]);assert.equal(q.end,1.2);m.observe({...base,time:1.36,spotlight:{...spotlight,phase:'performing'}},[]);assert.equal(m.charge,null);
 const lines=chargeLines(1,.5);assert.deepEqual(lines,chargeLines(1,.5));assert.notDeepEqual(lines,chargeLines(2,.5));for(const line of lines){assert.ok(line.life>=.12&&line.life<=.18);assert.ok(line.start>=3.5&&line.start<=5);}
 for(const id of ['charge-ground','charge-gather','charge-flare'])assert.ok(manifest.effects[id],id);
});
test('Ground Pound emits moving translucent billboards with exact authored lifetime and spin',()=>{
 const h={origin:{x:1000,y:300},dir:{x:1,y:0},shape:{kind:'line',length:240,width:60}},m=createPoundModel(h),cam=createSliceCombatCamera();cam.update(snapshot(0),1);const calls=[],g={quad(...args){if(args[8]==='gas')calls.push(args);},use(){},vertex(){},ring(){},glow(){}};
 drawPound(g,m,h,cam,1.9,true);const first=m.puffs.find(p=>p.visible),x=first.x,y=first.y;assert.equal(m.puffs.length,92);assert.ok(first.alpha>0&&first.alpha<=.36);assert.ok(calls.length>0);for(const q of calls)assert.ok(q[6]<=.36);
 drawPound(g,m,h,cam,2.1,true);assert.ok(first.x!==x||first.y!==y);calls.length=0;drawPound(g,m,h,cam,2.92,true);assert.equal(calls.length,0);
});
test('subunit healing accumulates for the source window rather than painting one popup per tick',()=>{
 const fx=createRustEffectState();for(let i=0;i<15;i++)fx.ingest(snapshot(i/30),[present('healed',{target:1,amount:.1,source:{kind:'breather'}})]);assert.equal(fx.popups.length,0);fx.ingest(snapshot(.8),[]);assert.equal(fx.popups.length,1);assert.equal(fx.popups[0].text,'+2');
});
test('cast models survive their windup and keep a single source seed through resolution',()=>{
 const fx=createRustEffectState(),s=snapshot(0);s.actors[0]={...hero,state_duration:1.5};fx.ingest(s,[present('skill_started',{id:1,skill:'arcane_pulse'})]);fx.ingest({...s,time:1.2},[]);assert.equal(fx.effects.find(f=>f.type==='cast').data.seed,effectSeed(1,0));
});
test('Marching Stomp has no encasement mapping; Bubble Pop film comes only from actor encased state',()=>{
 const fx=createRustEffectState(),h={id:9,kind:'boss_stomp_step',origin:enemy.pos,shape:{kind:'circle',radius:70},phase:'locked',progress:.5};fx.ingest(snapshot(1,[h]),[present('hazard_spawned',{id:9,kind:h.kind})]);assert.ok(!fx.effects.some(f=>f.type==='bubble_pop'));assert.equal(fx.snapshot.actors[1].encased,undefined);
});
test('participant camera eases inside WFM lane and returns over 500ms without changing arena bounds',()=>{
 const s=snapshot(0),before=structuredClone(s),cam=createSliceCombatCamera(),spot=new SliceSpotlightCamera(manifest.actor_boxes);cam.update(s,1);const v={caster:1,started:0,participants:[1,2],hazards:[],co_casters:[],projectiles:[]};spot.apply(cam,{...s,spotlight:v},false);assert.ok(cam.zoom>=.5&&cam.zoom<=.8);spot.apply(cam,{...s,time:1.2,spotlight:v},false);spot.apply(cam,{...s,time:1.3},false);spot.apply(cam,{...s,time:1.81},false);assert.equal(spot.current,null);assert.deepEqual(s,before);
});
test('Shadow eases the source-to-landing pose for 180ms before its authored hit beat',()=>{
 const state=createRustEffectState(),s=snapshot(0);state.ingest(s,[present('blink',{hero:1,target:2,from:{x:800,y:300},to:{x:1100,y:300}}),damage({})]);const motion=new SliceActor();motion.observe(s,[]);motion.pose(s,state.effects);assert.equal(motion.records.get(1).visualX,800);assert.equal(motion.records.get(1).poseState,'cast');motion.observe({...s,time:.09,combat_time:.09},[]);motion.pose({...s,time:.09},state.effects);assert.equal(motion.records.get(1).visualX,1062.5);motion.observe({...s,time:.3,combat_time:.3},[]);motion.pose({...s,time:.3},state.effects);assert.equal(motion.records.get(1).poseState,'basic');
});
test('revive immunity keeps four alternating source sprite copies for two combat seconds',()=>{
 const m=new SliceActor(),s=snapshot(0);m.observe(s,[present('revive_burst',{hero:1,pos:hero.pos,radius:100})]);assert.equal(m.records.get(1).immuneAt,0);m.observe({...s,time:1,combat_time:0},[]);assert.equal(m.records.get(1).immuneAt,0);m.observe({...s,time:2.1,combat_time:2.1},[]);assert.ok(2.1-m.records.get(1).immuneAt>=2);
});
test('Kaja aura damage accumulates by source hazard and flushes after the current tick',()=>{
 const fx=createRustEffectState(),h={id:18,kind:'kaja_aura',owner:1,origin:hero.pos,shape:{kind:'circle',radius:100},phase:'active'};
 for(let i=0;i<=23;i++)fx.ingest(snapshot(i/30,[h]),[damage({amount:.2,element:'nature'})]);assert.equal(fx.popups.length,1);assert.equal(fx.popups[0].text,'5');assert.equal(fx.popups[0].amount,Array.from({length:24},()=>.2).reduce((a,b)=>a+b,0));assert.ok(fx.effects.filter(f=>f.type==='hit').length<=2);
});
test('a short fractional-heal bucket retires without inventing a full point of healing',()=>{
 const fx=createRustEffectState();fx.ingest(snapshot(0),[present('healed',{target:1,amount:.2,source:{kind:'breather'}})]);fx.ingest(snapshot(.25),[]);assert.equal(fx.popups.length,0);
});
test('Phoenix channel consumes its read-only observation and takes precedence over a colocated resurrect hazard',()=>{
 const s=snapshot(1,[{kind:'resurrect',phase:'active',owner:3,origin:hero.pos,progress:.2}]),fx=createRustEffectState(),original=structuredClone(s);fx.ingest({...s,phoenix_cooldown:0,phoenix_channel:{hero:1,progress:.6}},[]);assert.equal(fx.channels.length,1);assert.equal(fx.channels[0].owner,null);assert.equal(fx.channels[0].progress,.6);assert.deepEqual(s,original);fx.ingest({...s,hit_stop:{cause:'healingspring'},phoenix_channel:{hero:1,progress:.6}},[]);assert.equal(fx.channels.length,1);assert.equal(fx.channels[0].owner,3);
});

test('enemy death owns its authored KO puff after the one-second clip; downed heroes do not',()=>{
 const fx=createRustEffectState(),s=snapshot(0);fx.ingest(s,[{body:{kind:'died',data:{actor:2}}},{body:{kind:'downed',data:{actor:1}}}]);assert.equal(fx.effects.filter(f=>f.type==='corpse').length,1);assert.equal(fx.effects.find(f=>f.type==='corpse').life,1.48);fx.ingest(snapshot(1.48),[]);assert.equal(fx.effects.filter(f=>f.type==='corpse').length,0);assert.equal(manifest.effects['ko-puff'].blend,'alpha');
});


test('Elevate follows the slice hero-only recipient guard', () => {
 const kaja={...hero,actor_id:3,kind:'kaja',groove_active:7,elevate:'sword'};
 const s={...snapshot(),actors:[hero,enemy,kaja]};
 assert.equal(elevateSourceForActor(enemy,s),null);
 assert.equal(elevateSourceForActor({...hero,hp:0},s),null);
 assert.equal(elevateSourceForActor(hero,s),kaja);
 assert.equal(elevateSourceForActor(hero,{...s,actors:[hero,enemy]}),null);
});
test('encasement ends on zero timer, death and removal, then pops for exactly source .32s', () => {
 for (const end of ['timer','death','removed']) {
  const fx=createRustEffectState(),a={...enemy,kind:'gobloc',encased:2};
  fx.ingest({...snapshot(1),actors:[hero,a]},[]);fx.observeEncasements();assert.equal(fx.encased.size,1);
  const actors=end==='removed'?[hero]:[hero,{...a,...(end==='timer'?{encased:0}:{hp:0})}];
  fx.ingest({...snapshot(2),actors},[]);fx.observeEncasements();assert.equal(fx.encased.get(2).ended,2);
  fx.ingest({...snapshot(2.319),actors},[]);fx.observeEncasements();assert.equal(fx.encased.size,1);
  fx.ingest({...snapshot(2.321),actors},[]);fx.observeEncasements();assert.equal(fx.encased.size,0);
 }
});
test('stationary world enemy and ground effects do not follow another hero in the slice frame', () => {
 const cam=createSliceCombatCamera(),s={...snapshot(),geometry:{floor:SLICE_FLOOR}};
 s.actors=[{...hero,pos:{x:418,y:410}},{...enemy,pos:{x:456,y:430}}];
 const observations=[];
 for(const y of [300,330,360,390]){s.actors[0]={...s.actors[0],pos:{x:418,y}};cam.update(s,1);observations.push({worldY:s.actors[1].pos.y,drawY:cam.y(s.actors[1].pos.y),groundY:cam.y(400)});}
 assert.equal(new Set(observations.map(o=>o.worldY)).size,1);assert.equal(new Set(observations.map(o=>o.drawY)).size,1);assert.equal(new Set(observations.map(o=>o.groundY)).size,1);
});
test('bomb observations retire on the same snapshot as the source projectile', () => {
 const fx=createRustEffectState(),p={id:10,kind:'bomb',team:'enemy',pos:{x:480,y:900}};
 fx.ingest({...snapshot(1),projectiles:[p]},[]);assert.equal(fx.projectiles.size,1);
 fx.ingest(snapshot(2),[present('hazard_resolved',{id:9,kind:'lizardo_drop',victims:[]})]);assert.equal(fx.projectiles.size,0);assert.deepEqual(fx.snapshot.projectiles,[]);
});
