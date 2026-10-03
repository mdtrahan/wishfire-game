import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HERO_DEFINITIONS } from '../web-runner/src/core/heroDefinitions.mjs';
import { validateSkillCondition,evaluateSkillCondition } from '../src/core/skillConditionRules.mjs';
import { COMBAT_MODIFIER_LIMITS,projectCombatStat,modifierCanImprove,resolveBasicInterval } from '../src/core/combatModifierRules.mjs';
import { previewSeededRng } from '../src/core/seededRngRules.mjs';
import { selectRealtimeHeroSkillTarget,enemiesInSkillShape } from '../web-runner/src/core/realtimeHeroTargeting.mjs';
import { ensureSkillBattle,resetRealtimeSkillAttempt,realtimeCombatStat } from '../web-runner/src/core/realtimeSkillState.mjs';
import { newHeroProgress,refreshHeroStats,awardHeroEXP,createHeroProgressStore,saveHeroProgress } from '../web-runner/src/core/heroProgression.mjs';
import { effectiveStat } from '../web-runner/src/core/combatRules.mjs';
import { calculateDamageFromJs } from '../src/core/calculateDamageRules.mjs';
const skill=(key,id)=>HERO_DEFINITIONS[key].actives.find(a=>a.skillId===id);
const hero=(uid,def=20)=>({uid,kind:'hero',hp:100,maxHP:100,x:100,y:200,stats:{ATK:100,DEF:def,MAG:100,RES:20,SPD:10}});
const enemy=(uid,x=200,y=200,def=30,rank='ordinary')=>({uid,kind:'enemy',hp:100,maxHP:100,x,y,combatRank:rank,streamState:'engaged',stats:{ATK:100,DEF:def,RES:20}});
const select=(skill,heroes,enemies,globals={})=>selectRealtimeHeroSkillTarget({skill,hero:heroes.at(-1),heroes,enemies,globals,effects:globals.RealtimeSkillEffects,now:globals.time || 0});
test('33 stable IDs have independent unlocks, complete descriptions and spaced integer cooldowns',()=>{
 const ids=[];for(const def of Object.values(HERO_DEFINITIONS)) {
  for(const entry of def.actives){ids.push(entry.skillId);assert.equal(validateSkillCondition(entry.conditions),true);assert.ok(entry.description);assert.ok(entry.conditionLabel);assert.ok(Number.isInteger(entry.cooldownSeconds));assert.ok(entry.unlockLevel);}
  for(let i=0;i<def.actives.length;i++)for(let j=i+1;j<def.actives.length;j++){const a=def.actives[i].cooldownSeconds,b=def.actives[j].cooldownSeconds;assert.ok(Math.abs(a-b)/Math.min(a,b)>.2,`${def.name}: ${a}/${b}`);}
  assert.equal(def.actives.filter(a=>a.displayName.includes('Awakening')).length,1);
 }assert.equal(ids.length,33);assert.equal(new Set(ids).size,33);
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
 assert.equal(modifierCanImprove({DEF:100},mods,[{channel:'DEF',direction:'up',magnitude:.1}]),false);
});
test('Shrink compares current highest living-party DEF, excludes bosses, and refuses a stronger debuff',()=>{
 const heroes=[hero(1,50),hero(2,20)],ordinary=enemy(10,200,200,45),boss=enemy(11,200,200,100,'boss');
 assert.equal(select(skill('Kojonn','shrink'),heroes,[ordinary,boss]),null);
 heroes[0].hp=0;assert.equal(select(skill('Kojonn','shrink'),heroes,[ordinary,boss]).targetUID,10);
 heroes[0].hp=100;const g={time:1,RealtimeSkillEffects:{10:{raised:{expiresAt:2,modifiers:[{channel:'DEF',direction:'up',magnitude:.35}]}}}};
 assert.equal(select(skill('Kojonn','shrink'),heroes,[ordinary],g).targetUID,10);
 g.time=2;assert.equal(select(skill('Kojonn','shrink'),heroes,[ordinary],g),null);
 heroes[0].hp=0;g.EnemyDebuffs={10:{DEF:40,ATK:90}};assert.equal(select(skill('Kojonn','shrink'),heroes,[ordinary],g),null);
});
test('best-area selection searches all anchors and prefers an eligible boss over a bigger cluster',()=>{
 const caster=hero(1),isolated=enemy(10,30,30),a=enemy(11,200,200),b=enemy(12,220,200);
 assert.equal(select(skill('Falie','shield_slam'),[caster],[isolated,a,b]).targetUID,11);
 const boss=enemy(13,280,400,30,'boss');assert.equal(select(skill('Falie','shield_slam'),[caster],[isolated,a,b,boss]).targetUID,13);
 assert.equal(select(skill('Huun','overrun'),[caster],[boss]),null);boss.hp=49;assert.equal(select(skill('Huun','overrun'),[caster],[boss]).targetUID,13);
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
test('basic interval bounds prevent timing amplification and honor expiry',()=>{
 assert.equal(resolveBasicInterval(5,{quickload:{expiresAt:2},shared_tempo:{expiresAt:3}},1),1.25);
 assert.equal(resolveBasicInterval(1,{quickload:{expiresAt:2},shared_tempo:{expiresAt:3}},2),.75);
 assert.equal(resolveBasicInterval(1,{quickload:{expiresAt:2},shared_tempo:{expiresAt:3}},3),1);
});
test('RNG preview matches the existing LCG including large draw indices without consuming it',()=>{
 let state=123;for(let i=0;i<10001;i++){state=(Math.imul(1664525,state)+1013904223)>>>0;if([0,1,2,9,999,10000].includes(i))assert.equal(previewSeededRng(123,i),state/4294967296);}
});
test('level and gear refresh reproject from a clean baseline; saves contain no Fruit/Grow maximum',()=>{
 const a={...newHeroProgress('Falie'),uid:1,kind:'hero'},ctx={state:{globals:{time:0},entities:[a]}};
 const battle=ensureSkillBattle(ctx);battle.fruitUIDs=[1];battle.magicFruitUsed=1;ensureSkillBattle(ctx);assert.equal(a.maxHP,86);
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
 const a=hero(1),source=hero(2),ctx={state:{entities:[a,source]}};a.hp=95;let events=0;
 const heal=adapter('HealRealtimeActor','\nfunction absorbPartyTempHPShield',{GetActorByUID:(ctx,uid)=>ctx.state.entities.find(a=>a.uid===uid),emitResolvedHealEvent:(ctx,source,target,before)=>{events++;return target.hp-before;},UpdateHeroHPUI:()=>{}});
 assert.equal(heal(ctx,2,1,20),5);a.hp=0;assert.equal(heal(ctx,2,1,20),0);assert.equal(heal(ctx,2,1,30,true),30);assert.equal(ctx.state.entities[0],a);assert.equal(events,2);
});
test('raw magic adapters mitigate independently once and never reroll critical damage',()=>{
 const source=hero(1),target=enemy(10);target.stats.RES=20;const g={time:0},ctx={state:{globals:g,entities:[source,target]}};
 const apply=adapter('ApplyRealtimeRawDamage','\nexport function HealRealtimeActor',{getGlobals:ctx=>ctx.state.globals,GetActorByUID:(ctx,uid)=>ctx.state.entities.find(a=>a.uid===uid),isHeroBasicTargetInRange:a=>a.hp>0&&a.x<=290,resolveCalculateDamageFromJs:calculateDamageFromJs,GetEffectiveStat:(ctx,a,stat)=>realtimeCombatStat(ctx.state.globals,a,stat),GetBaseStat:(ctx,a,stat)=>a.stats[stat]||0,realtimeBasicDamageMultiplier:()=>1,ApplyDamageToTarget:(ctx,uid,amount)=>{target.hp-=amount;return amount;}});
 assert.equal(apply(ctx,1,10,66,'magic'),46);assert.equal(apply(ctx,1,10,1,'magic'),0);
});

test('Shrink draws once at 70% size, keeps the feet fixed and restores the original sprite after expiry',async()=>{
 const {drawCombatActorSprite}=await import('../web-runner/systems/combatActorSpritePresentation.mjs');
 const draws=[],ctx={drawImage:(...args)=>draws.push(args),save(){},restore(){},translate(){},scale(){}};
 const parameters={drawX:100,drawY:100,width:100,height:100,pivotX:150,orientation:'left-wise',actorUID:1,effects:{1:{shrink:{expiresAt:5}}}};
 const reduced=drawCombatActorSprite(ctx,{}, {...parameters,now:1});assert.deepEqual(reduced.drawBounds,{x:115,y:130,width:70,height:70});
 const again=drawCombatActorSprite(ctx,{}, {...parameters,now:2});assert.deepEqual(again.drawBounds,reduced.drawBounds);
 const restored=drawCombatActorSprite(ctx,{}, {...parameters,now:5});assert.deepEqual(restored.drawBounds,{x:100,y:100,width:100,height:100});
});
