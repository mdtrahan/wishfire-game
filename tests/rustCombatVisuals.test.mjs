import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRustEffectState, effectSeed, slicePopupSize } from '../web-runner/systems/rustCombatEffects.mjs';
import { sampleRustVfx } from '../web-runner/systems/rustCombatAssets.mjs';
import { createBubbleModel } from '../web-runner/systems/rustCombatBubble.mjs';
import { createArcaneModel } from '../web-runner/systems/rustCombatArcane.mjs';
import { createSliceCombatCamera } from '../web-runner/systems/rustCombatCamera.mjs';
import { installRustCombat } from '../web-runner/systems/rustCombat.mjs';
const root=new URL('../web-runner/assets/rust-combat/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root)));
const hero={actor_id:1,team:'hero',kind:'hondo',pos:{x:900,y:300},hp:100,max_hp:100,scale:1,state:'cast'},enemy={actor_id:2,team:'enemy',kind:'boss',pos:{x:1050,y:300},hp:100,max_hp:100,scale:2.2};
const snapshot=(time=1,hazards=[])=>({encounter_id:'visual-proof',time,combat_time:time,actors:[hero,enemy],hazards,projectiles:[],geometry:{floor:{min:{x:0,y:-40},max:{x:2160,y:680}}}});
const present=(kind,data)=>({body:{kind:'presentation',data:{event:{kind,data}}}});
const damage=data=>({body:{kind:'damage',data:{source:1,target:2,amount:15,crit:false,element:'physical',...data}}});

test('slice manifest validates every referenced byte and excludes UI/arena/reward/chest art',()=>{
 assert.equal(manifest.source_commit,'9c142b5f73294bd5a783e79d3840d0c3386c90a1');
 for(const [file,hash]of Object.entries(manifest.sha256)){const bytes=fs.readFileSync(new URL(file,root));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash,file);assert.ok(!/^(arena|rewards|icons|wishfire-skills)\//.test(file),file);}
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

test('flag camera keeps the Troll body below the existing WFM boss HUD',()=>{
 const cam=createSliceCombatCamera(),s=snapshot();s.actors[1]={...enemy,pos:{x:1050,y:180}};cam.update(s,1);assert.ok(cam.y(180-370)>=155-1e-6);assert.ok(cam.y(hero.pos.y+30)<=478+1e-6);
});
