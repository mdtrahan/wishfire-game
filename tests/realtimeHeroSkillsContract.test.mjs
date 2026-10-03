import {pushContinuousCombatEnemy,reverseContinuousCombatEnemy,teleportContinuousCombatEnemy} from '../web-runner/src/core/continuousCombatStage.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { HERO_DEFINITIONS } from '../web-runner/src/core/heroDefinitions.mjs';
import { castRealtimeHeroSkill, realtimeBasicFollowups, realtimeCoverTarget, realtimeIncomingDamage, realtimeMagicBlocked, realtimeProvokeTarget, realtimeCombatStat, tickRealtimeHeroSkillZones, realtimeBasicInterval, cleanupRealtimeSkillActors } from '../web-runner/src/core/realtimeHeroSkills.mjs';
import { resetRealtimeSkillAttempt, ensureSkillBattle } from '../web-runner/src/core/realtimeSkillState.mjs';
import { previewSeededRng } from '../src/core/seededRngRules.mjs';
import { calculateDamageFromJs } from '../src/core/calculateDamageRules.mjs';
import { renderCombatAttackVfx } from '../web-runner/systems/combatAttackVfxPresentation.mjs';
const skill=(key,id)=>HERO_DEFINITIONS[key].actives.find(a=>a.skillId===id);
function combat() {
 const heroes=Object.keys(HERO_DEFINITIONS).map((key,index)=>({uid:index+1,kind:'hero',baseHeroName:key,name:key,currentLevel:100,hp:30,maxHP:100,x:120,y:200,stats:{ATK:100,DEF:20,MAG:100,RES:10,SPD:10},equipmentStats:{ATK:4}}));
 const enemies=[0,1,2].map(i=>({uid:10+i,kind:'enemy',hp:1000,maxHP:1000,x:200+i*20,y:200+i*10,streamEngageX:200,streamState:'engaged',combatRank:'ordinary',attackType:'magic',stats:{ATK:100,DEF:30,RES:0,MAG:101,SPD:5}}));
 const g={time:10,ContinuousCombatStageLoop:1,RuntimeRandomSeed:12,RuntimeRandomDraws:0};
 g.RuntimeRandom=()=>previewSeededRng(g.RuntimeRandomSeed,g.RuntimeRandomDraws++);
 const state={globals:g,entities:[...heroes,...enemies]},ctx={state,callFunction(name,...args){
  const source=state.entities.find(a=>a.uid===args[0]),target=state.entities.find(a=>a.uid===args[1]);
  if(name==='GetEffectiveStat')return realtimeCombatStat(g,args[0],args[1]);
  if(name==='CalculateDamage')return calculateDamageFromJs({power:realtimeCombatStat(g,source,args[2]==='magic'?'MAG':'ATK'),resist:realtimeCombatStat(g,target,args[2]==='magic'?'RES':'DEF'),attackMultiplierPct:args[3],critRoll01:1}).damage;
  if(name==='ApplyRealtimeRawDamage')return ctx.callFunction('ApplyDamageToTarget',target.uid,calculateDamageFromJs({power:args[2],resist:realtimeCombatStat(g,target,args[3]==='magic'?'RES':'DEF'),critRoll01:1}).damage,{sourceUID:source?.uid});
  if(name==='ApplyDamageToTarget') {const victim=source,before=victim.hp;victim.hp=Math.max(0,victim.hp-args[1]);return before-victim.hp;}
  if(name==='HealRealtimeActor') {if(!target || (args[3]?target.hp>0:target.hp<=0))return 0;const before=target.hp;target.hp=Math.min(target.maxHP,target.hp+Math.floor(target.maxHP*args[2]/100));return target.hp-before;}
  return 0;
 }};
 const cast=(key,id,event)=>castRealtimeHeroSkill(ctx,heroes.find(a=>a.baseHeroName===key).uid,skill(key,id),{event},{push:pushContinuousCombatEnemy,reverse:reverseContinuousCombatEnemy,teleport:teleportContinuousCombatEnemy});
 return {ctx,g,heroes,enemies,cast};
}
for(const [key,definition] of Object.entries(HERO_DEFINITIONS))for(const entry of definition.actives)test(`${definition.name}: ${entry.displayName} commits its conditional action`,()=>{
 const {ctx,g,heroes,enemies,cast}=combat();
 if(entry.skillId==='hex_beacon')enemies.forEach(a=>a.stats.RES=10);
 if(entry.skillId==='ambush')enemies[0].hp=1000;
 if(entry.skillId==='finish_the_job')enemies[0].hp=300;
 if(entry.skillId==='overrun') {enemies[0].combatRank='boss';enemies[0].hp=400;}
 if(entry.skillId==='cover')heroes[1].hp=20;
 if(['grow','fortunes_blessing'].includes(entry.skillId))enemies[0].combatRank='boss';
 if(entry.skillId==='grow')heroes.forEach(a=>a.hp=100);
 const event=entry.skillId==='retaliation_burst'?{sourceUID:10,targetUID:1,hpDamage:1,actionKind:'enemy'}:entry.skillId==='chain_strike'?{sourceUID:3,targetUID:10,hpDamage:1,rawDamage:100,isPrimary:true,actionKind:'basic'}:undefined;
 assert.equal(cast(key,entry.skillId,event),true);
 assert.equal(g.LastRealtimeHeroSkill.skillId,entry.skillId);
 assert.ok(g.CombatImpactRequests.length>0);
 assert.equal(heroes[0].currentLevel,100);assert.deepEqual(heroes[0].equipmentStats,{ATK:4});
});
test('party support VFX resolves ally positions',()=>{
 const {ctx,g,heroes,cast}=combat();g.HeroRestBasePosByUID=Object.fromEntries(heroes.map((a,i)=>[a.uid,{x:40,y:190+i*55}]));
 assert.equal(cast('Kojonn','wishgrant'),true);
 renderCombatAttackVfx({}, {state:ctx.state,images:{},worldToCanvas:(x,y)=>({x,y})});
 assert.deepEqual(g.CombatImpactVisuals.map(a=>[a.x,a.y]),heroes.map(a=>[40,g.HeroRestBasePosByUID[a.uid].y]));
});
test('Cover redirects allies indefinitely until expiry; Brace supersedes its mitigation twice',()=>{
 const {ctx,g,heroes,enemies,cast}=combat();heroes[1].hp=20;
 cast('Falie','cover');assert.equal(realtimeCoverTarget(ctx,heroes[1]),heroes[0]);
 assert.equal(realtimeIncomingDamage(ctx,heroes[0],enemies[0],100),60);
 cast('Falie','brace');assert.equal(realtimeIncomingDamage(ctx,heroes[0],enemies[0],100),50);assert.equal(realtimeIncomingDamage(ctx,heroes[0],enemies[0],100),50);
 assert.equal(realtimeIncomingDamage(ctx,heroes[0],enemies[0],100),60);
 g.time=16;tickRealtimeHeroSkillZones(ctx);assert.equal(realtimeCoverTarget(ctx,heroes[1]),heroes[1]);
});
test('source KO cancels Provoke, Cover, Ward and Burn while granted stat buffs remain',()=>{
 const {ctx,g,heroes,enemies,cast}=combat();cast('Falie','challenge_bolt');heroes[1].hp=20;cast('Falie','cover');cast('Falie','crimson_ward');cast('Runa','burn_sigil');cast('Kojonn','wishgrant');
 heroes[0].hp=0;heroes[2].hp=0;cleanupRealtimeSkillActors(ctx);
 assert.equal(realtimeProvokeTarget(ctx,enemies[0],heroes[1]),heroes[1]);assert.equal(realtimeCoverTarget(ctx,heroes[1]),heroes[1]);assert.equal(g.PartyTempHPShield,0);assert.equal(g.RealtimeSkillZones.length,0);
 assert.equal(realtimeCombatStat(g,heroes[1],'ATK'),135);
});
test('Burn and Destiny include their final tick; a KO recipient never receives regeneration',()=>{
 const {ctx,g,heroes,enemies,cast}=combat();cast('Runa','burn_sigil');cast('Falie','destiny');heroes[1].hp=0;g.time=16;tickRealtimeHeroSkillZones(ctx);
 assert.equal(enemies[0].hp,850);assert.equal(heroes[0].hp,54);assert.equal(heroes[1].hp,0);assert.equal(g.RealtimeSkillZones.length,0);
});
test('Blight refresh replaces its tick schedule and ignores later arrivals',()=>{
 const {ctx,g,enemies,cast}=combat();cast('Runa','faze');g.time=11;tickRealtimeHeroSkillZones(ctx);assert.equal(enemies[0].hp,999);
 const later={...enemies[0],uid:99,hp:1000};ctx.state.entities.push(later);cast('Runa','faze');g.time=14;tickRealtimeHeroSkillZones(ctx);assert.equal(enemies[0].hp,996);assert.equal(later.hp,997);
});
test('approaching foes cannot receive direct damage or zone ticks',()=>{
 const {ctx,g,enemies,cast}=combat();enemies[2].x=340;cast('Runa','burn_sigil');g.time=16;tickRealtimeHeroSkillZones(ctx);assert.equal(enemies[2].hp,1000);
});
test('Fortune previews once, suppresses useless chosen stats, and advances RNG only on success',()=>{
 const {g,heroes,enemies,cast}=combat();enemies[0].combatRank='boss';
 const choice=['ATK','DEF','MAG','RES'][Math.floor(previewSeededRng(12,0)*4)];
 g.RealtimeSkillEffects=Object.fromEntries(heroes.map(a=>[a.uid,{strong:{expiresAt:20,modifiers:[{channel:choice,direction:'up',magnitude:.5}]}}]));
 assert.equal(cast('Kojonn','fortunes_blessing'),false);assert.equal(g.RuntimeRandomDraws,0);
 delete g.RealtimeSkillEffects[1];assert.equal(cast('Kojonn','fortunes_blessing'),true);assert.equal(g.RuntimeRandomDraws,1);assert.equal(g.LastRealtimeHeroSkill.feedback,` (${choice} +25%)`);
});
test('Fruit and Grow reproject clean HP, preserve KO, and restore baseline on reset',()=>{
 const {ctx,g,heroes,enemies,cast}=combat();heroes[1].hp=20;cast('Kojonn','magic_fruit');assert.equal(heroes[1].maxHP,115);assert.equal(heroes[1].hp,56);assert.equal(cast('Kojonn','magic_fruit'),false);
 heroes.forEach(a=>a.hp=a.maxHP);enemies[0].combatRank='boss';cast('Kojonn','grow');assert.equal(heroes[0].maxHP,105);
 heroes[0].hp=0;ensureSkillBattle(ctx);assert.equal(heroes[0].hp,0);
 resetRealtimeSkillAttempt(g,ctx.state.entities);assert.equal(heroes[0].maxHP,100);assert.equal(heroes[0].hp,0);assert.equal(g.RealtimeSkillBattleState,undefined);
});
test('Sanctuary revives only the first KO instance and retains identity and gear',()=>{
 const {heroes,cast}=combat();heroes[0].hp=0;heroes[1].hp=0;const reference=heroes[0];cast('Kojonn','sanctuary');assert.equal(heroes[0],reference);assert.equal(heroes[0].hp,30);assert.equal(heroes[1].hp,0);assert.deepEqual(heroes[0].equipmentStats,{ATK:4});
});
test('Chain consumes only primary basic events, targets two other foes and cannot repeat during cooldown',()=>{
 const {ctx,g,heroes,enemies}=combat();assert.equal(realtimeBasicFollowups(ctx,heroes[2],enemies[0],1,100),true);assert.equal(enemies[0].hp,1000);assert.equal(enemies[1].hp,934);assert.equal(enemies[2].hp,934);
 assert.equal(realtimeBasicFollowups(ctx,heroes[2],enemies[0],1,100),false);assert.equal(g.RealtimeHeroBasicClocks[3].skillReadyAt.chain_strike,66);heroes[2].hp=0;g.time=100;assert.equal(realtimeBasicFollowups(ctx,heroes[2],enemies[0],1,100),false);
});
test('Quickload supersedes Shared Tempo and restores its interval on expiry',()=>{
 const {g,heroes,cast}=combat();cast('Kojonn','shared_tempo');assert.equal(realtimeBasicInterval(g,heroes[0],1),.75);cast('Kojonn','quickload');assert.equal(realtimeBasicInterval(g,heroes[0],1),.4);g.time=14;assert.equal(realtimeBasicInterval(g,heroes[0],1),.75);
});
