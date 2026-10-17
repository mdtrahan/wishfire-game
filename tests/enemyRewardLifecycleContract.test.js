const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const {recordEnemyDefeatReward,settleDefeat,settleContinuousCombatRewards}=require('../web-runner/modules/heroCommands.mjs');
const {createHeroProgressStore,newHeroProgress}=require('../web-runner/src/core/heroProgression.mjs');

function loadFunctionBank(){
 const file=path.join(__dirname,'../web-runner/modules/functionBank.js');
 const source=fs.readFileSync(file,'utf8').replace(/import\s+\{[^}]*\}\s+from\s+['"][^'"]+['"];\n/g,'').replace(/export\s+function\s+/g,'function ').replace(/export\s+\{[^}]*\};\n/g,'');
 const names=[...new Set([...source.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/g)].map(match=>match[1]))];
 const context={console:{log(){},warn:console.warn,error:console.error},Math,Number,String,Boolean,Array,Object,Set,Map,JSON,Date,structuredClone,document:{documentElement:{setAttribute(){},getAttribute(){return null;}}},globalThis:{},recordEnemyDefeatReward,...require('../web-runner/systems/actorPuppetDefeats.mjs'),...require('../web-runner/src/core/realtimeHeroSkills.mjs'),module:{exports:{}},exports:{}};
 vm.runInNewContext(`${source}\nmodule.exports={${names.join(',')}};`,context,{filename:file});
 return context.module.exports;
}

test('basic damage records one zero-value enemy reward receipt at the shared KO seam',()=>{
 const hero={uid:1,kind:'hero',name:'Falie',heroInstanceKey:'Falie',hp:10,maxHP:10};
 const enemy={uid:9,kind:'enemy',name:'Gobloc',hp:3,maxHP:3,slotIndex:0,expValue:7,goldValue:4,x:1,y:1};
 let rewardFlushes=0;const globals={ProgressionBattle:{id:'basic-ko',participants:['Falie'],defeated:{},persistPendingRewards(){rewardFlushes++;}},EnemySlots:[9],EnemyData:[],DamageTexts:[],SpawnDamageText:0,HeroHPByIndex:[],EnemyHPByIndex:[],RoundActive:1,GroupResolving:1};
 const ctx={state:{globals,entities:[hero,enemy]},callFunction(name,...args){return bank[name]?.(ctx,...args);}};
 const bank=loadFunctionBank();
 assert.equal(bank.ApplyDamageToTarget(ctx,enemy.uid,3,{sourceUID:hero.uid}),3);
 assert.deepEqual({...globals.ProgressionBattle.defeated},{9:0});
 assert.deepEqual({...globals.ProgressionBattle.defeatedGold},{9:0});
 assert.equal(rewardFlushes,1);
 assert.equal(bank.ApplyDamageToTarget(ctx,enemy.uid,3,{sourceUID:hero.uid}),0);
 assert.equal(Object.keys(globals.ProgressionBattle.defeated).length,1);
 assert.equal(rewardFlushes,1);
});

test('continuous defeat leaves legacy Gold payable without hero EXP until retry settlement',()=>{
 const hero={...newHeroProgress('Falie'),kind:'hero',uid:1};
 const progress=createHeroProgressStore();
 const battle={id:'continuous-defeat',participants:['Falie'],defeated:{9:7},defeatedGold:{9:4}};
 const globals={ContinuousCombatStageLoop:1,ProgressionBattle:battle,HeroProgress:progress,goldTotal:2};
 const ctx={state:{globals,entities:[hero]},callFunction(){}};
 settleDefeat(ctx);
 assert.equal(battle.settled,false);
 assert.equal(settleContinuousCombatRewards(ctx).length,1);
 assert.equal(hero.currentEXP,0);
 assert.equal(globals.goldTotal,6);
 assert.equal(battle.settled,true);
 settleContinuousCombatRewards(ctx);
 assert.equal(globals.goldTotal,6);
 assert.equal(hero.currentEXP,0);
 const reloadedGlobals={ContinuousCombatStageLoop:1,ProgressionBattle:{...battle,settled:false},HeroProgress:JSON.parse(JSON.stringify(progress)),goldTotal:6};
 const reloadedCtx={state:{globals:reloadedGlobals,entities:[{...hero}]},callFunction(){}};
 assert.equal(settleContinuousCombatRewards(reloadedCtx).length,0);
 assert.equal(reloadedGlobals.goldTotal,6);
 assert.equal(reloadedGlobals.HeroProgress.heroes.Falie.currentEXP,0);
});

test('repeated role KO callbacks retain the first per-enemy reward entry',()=>{
 const battle={defeated:{9:7},defeatedGold:{}};
 assert.equal(recordEnemyDefeatReward(battle,{uid:9,kind:'enemy',expValue:7,goldValue:4}),true);
 assert.equal(recordEnemyDefeatReward(battle,{uid:9,kind:'enemy',expValue:99,goldValue:99}),false);
 assert.deepEqual(battle,{defeated:{9:7},defeatedGold:{9:0}});
});

test('continuous reward rollover preserves the battle outcome',()=>{
 const battle={id:'continuous-wave',participants:['Falie'],defeated:{},defeatedGold:{},outcome:'active'};
 const globals={ProgressionBattle:battle,HeroProgress:createHeroProgressStore(),goldTotal:0};
 settleContinuousCombatRewards({state:{globals,entities:[{...newHeroProgress('Falie'),kind:'hero'}]},callFunction(){}});
 assert.equal(battle.outcome,'active');
});
