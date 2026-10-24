import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HERO_DEFINITIONS } from '../web-runner/src/core/heroDefinitions.mjs';
import { validateSkillCondition,evaluateSkillCondition } from '../src/core/skillConditionRules.mjs';
import { COMBAT_MODIFIER_LIMITS,projectCombatStat,resolveBasicInterval } from '../src/core/combatModifierRules.mjs';
import { previewSeededRng } from '../src/core/seededRngRules.mjs';
import { enemiesInSkillShape } from '../web-runner/src/core/realtimeHeroTargeting.mjs';
import { ensureSkillBattle,resetRealtimeSkillAttempt,realtimeCombatStat } from '../web-runner/src/core/realtimeSkillState.mjs';
import { resetActorPresentationAfterRestore } from '../web-runner/src/core/actorPresentationState.mjs';
import { newHeroProgress,refreshHeroStats,awardHeroEXP,createHeroProgressStore,saveHeroProgress } from '../web-runner/src/core/heroProgression.mjs';
import { effectiveStat } from '../web-runner/src/core/combatRules.mjs';
import { calculateDamageFromJs } from '../src/core/calculateDamageRules.mjs';
const hero=(uid,def=20)=>({uid,kind:'hero',hp:100,maxHP:100,x:150,y:200,footX:150,footY:200,attackType:'magic',stats:{ATK:100,DEF:def,MAG:100,RES:20,SPD:10}});
const enemy=(uid,x=200,y=200,def=30,rank='ordinary')=>({uid,kind:'enemy',hp:100,maxHP:100,x,y,footX:x,footY:y,combatRank:rank,streamState:'engaged',stats:{ATK:100,DEF:def,RES:20}});
test('each Special is a valid conditional action with one integer clock and readable text',()=>{
 for(const def of Object.values(HERO_DEFINITIONS)) {
  const entry=def.special;assert.deepEqual(def.actives,[entry]);
  assert.equal(validateSkillCondition(entry.conditions),true);assert.ok(entry.description);assert.ok(entry.conditionLabel);assert.ok(Number.isInteger(entry.cooldownSeconds));assert.equal(entry.unlockLevel,1);
 }
});
test('unknown, malformed and ambiguous conditions fail closed',()=>{
 for(const node of [{key:'invented'},{all:[],key:'actor.hp_ratio'},{key:'actor.hp_ratio',operator:'gte',value:75},{key:'actor.effect_active',effectId:'CoverRelay'},{key:'actors.count',group:'imagined',operator:'gte',value:1},{key:'actor.trait',field:'weather',in:['rain']}])assert.throws(()=>validateSkillCondition(node));
});
test('predicate groups compose AND, OR and NOT without changing context',()=>{
 const self=hero(1),context={self,candidate:self,groups:{livingHeroes:[self]},effects:{},now:0};self.hp=40;
 const low={key:'actor.hp_ratio',subject:'self',operator:'lt',value:.5};
 assert.equal(evaluateSkillCondition({all:[low,{not:{key:'actor.effect_active',subject:'self',effectId:'brace'}}]},context),true);
 assert.equal(evaluateSkillCondition({any:[{not:low},low]},context),true);assert.equal(self.hp,40);
});
test('every stat channel clamps extremes and repeated up/down effects use the strongest component',()=>{
 for(const [channel,bounds] of Object.entries(COMBAT_MODIFIER_LIMITS).filter(([id])=>id!=='incomingReduction')) {
  assert.equal(projectCombatStat(100,channel,[{channel,direction:'up',magnitude:10}]),100*bounds[1]);
  assert.equal(projectCombatStat(100,channel,[{channel,direction:'down',magnitude:10}]),100*bounds[0]);
 }
 const mods=[{channel:'DEF',direction:'up',magnitude:.35},{channel:'DEF',direction:'up',magnitude:.25},{channel:'DEF',direction:'down',magnitude:.2}];
 assert.ok(Math.abs(projectCombatStat(100,'DEF',mods)-115)<1e-9);assert.equal(projectCombatStat(0,'DEF',mods),0);
});
test('horizontal throw keeps hero Y, and cone boundaries include only the forward area',()=>{
 const foes=[enemy(1,200,200),enemy(2,240,215),enemy(3,50,200),enemy(4,200,201)];
 assert.deepEqual(enemiesInSkillShape(foes,{kind:'horizontalLine',center:{x:100,y:200},toX:290,width:28}).map(a=>a.uid),[1,4]);
 assert.deepEqual(enemiesInSkillShape(foes,{kind:'cone',center:{x:100,y:200},length:120,angleDegrees:60}).map(a=>a.uid),[1,4]);
});
test('legacy flat and status modifiers share limits and benefit guards with realtime records',()=>{
 const a=hero(1);a.statuses=[{statusEffect:'atkUp',magnitude:.35,duration:1}];
 const g={time:1,PartyBuff_ATK:25,RealtimeSkillEffects:{1:{fortune:{expiresAt:2,modifiers:[{channel:'ATK',direction:'up',magnitude:.25}]}}}};
 assert.equal(realtimeCombatStat(g,a,'ATK'),135);g.PartyBuff_ATK=1000;assert.equal(realtimeCombatStat(g,a,'ATK'),175);
});
test('basic interval keeps a 0.4 second floor and ignores retired timing effects',()=>{
 assert.equal(resolveBasicInterval(1.8,{quickload:{expiresAt:2},shared_tempo:{expiresAt:3}},1),1.8);
 assert.equal(resolveBasicInterval(.1),.4);
});
test('RNG preview matches the existing LCG including large draw indices without consuming it',()=>{
 let state=123;for(let i=0;i<10001;i++){state=(Math.imul(1664525,state)+1013904223)>>>0;if([0,1,2,9,999,10000].includes(i))assert.equal(previewSeededRng(123,i),state/4294967296);}
});
test('level and gear refresh reproject from a clean baseline; saves contain no buffed maximum',()=>{
 const a={...newHeroProgress('Falie'),uid:1,kind:'hero'},ctx={state:{globals:{time:0,RealtimeSkillEffects:{1:{elevate:{sourceUID:4,expiresAt:1e9,modifiers:[{channel:'HP',direction:'up',magnitude:.15}]}}}},entities:[a]}};
 ensureSkillBattle(ctx);assert.equal(a.maxHP,86);
 a.hp=70;awardHeroEXP(a,100);ensureSkillBattle(ctx);assert.equal(a.combatBaseMaxHP,83);assert.equal(a.maxHP,95);assert.equal(a.hp,79);
 a.equipmentStats={HP:10,DEF:4};refreshHeroStats(a);ensureSkillBattle(ctx);assert.equal(a.maxHP,106);assert.equal(a.combatBaseMaxHP,93);
 const store=createHeroProgressStore();saveHeroProgress(a,store);assert.equal(store.heroes.Falie.maxHP,93);assert.equal(Object.hasOwn(store.heroes.Falie,'combatMaxHPMultiplier'),false);
 const loaded=createHeroProgressStore(store);assert.equal(loaded.heroes.Falie.maxHP,93);assert.deepEqual(loaded.heroes.Falie.equipmentStats,{HP:10,DEF:4});
 resetRealtimeSkillAttempt(ctx.state.globals,[a]);assert.equal(a.maxHP,93);assert.equal(a.combatMaxHPMultiplier,undefined);
});
// Exercise the actual runtime adapter bodies while replacing only environment services.
const runtime=fs.readFileSync(new URL('../web-runner/modules/functionBank.js',import.meta.url),'utf8');
function adapter(name,end,bindings){const start=runtime.indexOf(`export function ${name}(`),body=runtime.slice(start,runtime.indexOf(end,start)).replace('export function','function');return new Function(...Object.keys(bindings),`${body};return ${name};`)(...Object.values(bindings));}
test('the UID heal adapter clamps, rejects ordinary KO healing, and revives the same instance',()=>{
 const a=hero(1),source=hero(2),ctx={state:{globals:{time:0},entities:[a,source]}};a.hp=95;let events=0;
 const heal=adapter('HealRealtimeActor','\nfunction absorbPartyTempHPShield',{getGlobals:ctx=>ctx.state.globals,GetActorByUID:(ctx,uid)=>ctx.state.entities.find(a=>a.uid===uid),emitResolvedHealEvent:(ctx,source,target,before)=>{events++;return target.hp-before;},UpdateHeroHPUI:()=>{},resetActorPresentationAfterRestore});
 assert.equal(heal(ctx,2,1,20),5);a.hp=0;a.actionState='ko';a.actionFacing='left';a.actionStateUntil=86400;ctx.state.globals.time=8;assert.equal(heal(ctx,2,1,30,true),30);assert.equal(ctx.state.entities[0],a);assert.equal(a.locomotion,'idle');assert.equal(a.locomotionStartedAt,8);assert.equal(a.actionState,undefined);assert.equal(a.actionStateUntil,undefined);assert.equal(events,2);
});
test('raw magic adapters mitigate independently once, never reroll critical damage, and retain committed effect range',()=>{
 const source=hero(1),target=enemy(10);target.stats.RES=20;const g={time:0},ctx={state:{globals:g,entities:[source,target]}};
 const apply=adapter('ApplyRealtimeRawDamage','\nexport function HealRealtimeActor',{getGlobals:ctx=>ctx.state.globals,GetActorByUID:(ctx,uid)=>ctx.state.entities.find(a=>a.uid===uid),resolveCalculateDamageFromJs:calculateDamageFromJs,GetEffectiveStat:(ctx,a,stat)=>realtimeCombatStat(ctx.state.globals,a,stat),GetBaseStat:(ctx,a,stat)=>a.stats[stat]||0,realtimeBasicDamageMultiplier:()=>1,ApplyDamageToTarget:(ctx,uid,amount)=>{target.hp-=amount;return amount;}});
 assert.equal(apply(ctx,1,10,66,'magic'),46);assert.equal(apply(ctx,1,10,1,'magic'),0);
 target.hp=100;source.hp=0;source.footX=1000;source.x=1000;assert.equal(apply(ctx,1,10,66,'magic'),46);
 target.hp=100;ctx.state.entities.splice(0,1);assert.equal(apply(ctx,1,10,66,'magic'),46);
});
