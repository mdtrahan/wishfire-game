const test=require('node:test');
const assert=require('node:assert/strict');
const {HERO_DEFINITIONS,PROGRESSION}=require('../web-runner/src/core/heroDefinitions.mjs');
const {newHeroProgress,awardHeroEXP,createHeroProgressStore,settleBattleEXP,attachHeroProgress,saveHeroProgress}=require('../web-runner/src/core/heroProgression.mjs');
test('progress records retain the four internal hero keys without retired combat resources',()=>{
 const store=createHeroProgressStore();assert.deepEqual(Object.keys(store.heroes),['Falie','Huun','Runa','Kojonn']);
 for(const hero of Object.values(store.heroes))for(const field of ['actionSlotsPerTurn','sp','spMax','flow','flowMode'])assert.equal(Object.hasOwn(hero,field),false,`${field} is not progression state`);
});
test('each internal hero key has one Special clock, a passive and two resonances, with no ranks',()=>{
 assert.equal(PROGRESSION.maxLevel,100);
 for(const [key,definition] of Object.entries(HERO_DEFINITIONS)){
  assert.equal(newHeroProgress(key).baseHeroName,key);
  assert.equal(definition.actives.length,1,`${key} active skill count`);
  for(const field of ['passives','actionSlotsPerTurn','startingSP','maxSP','flowMode'])assert.equal(Object.hasOwn(definition,field),false,`${key}.${field} is retired`);
  for(const skill of definition.actives){
   for(const field of ['rank','ranks','skillRank'])assert.equal(Object.hasOwn(skill,field),false,`${skill.skillId}.${field} is retired`);
   assert.equal(skill.unlockLevel,1);assert.ok(skill.description);assert.ok(skill.cooldownSeconds>=0);assert.ok(skill.durationSeconds>=0);assert.ok(skill.targetType);
  }
 }
});
test('legacy combat resource fields are dropped while identity, growth, HP, and equipment survive',()=>{
 const snapshot={version:2,heroes:{'Falie#1':{heroInstanceKey:'Falie#1',baseHeroName:'Falie',name:'Falie',currentLevel:8,currentEXP:19,maxLevel:99,hp:51,equipmentStats:{ATK:4},actionSlotsPerTurn:5,sp:87,spMax:100,flow:63,flowMode:'Stoic'}}};
 const store=createHeroProgressStore(snapshot),saved=store.heroes['Falie#1'];
 assert.equal(saved.heroInstanceKey,'Falie#1');assert.equal(saved.baseHeroName,'Falie');assert.equal(saved.currentLevel,8);assert.equal(saved.currentEXP,19);assert.equal(saved.hp,51);assert.deepEqual(saved.equipmentStats,{ATK:4});
 for(const field of ['actionSlotsPerTurn','sp','spMax','flow','flowMode'])assert.equal(Object.hasOwn(saved,field),false,`${field} is discarded from old saves`);
 const actor={...saved,actionSlotsPerTurn:5,sp:87,spMax:100,flow:63,flowMode:'Stoic'};attachHeroProgress(actor,store);
 for(const field of ['actionSlotsPerTurn','sp','spMax','flow','flowMode'])assert.equal(Object.hasOwn(actor,field),false,`${field} is removed from attached actors`);
 saveHeroProgress(actor,store);for(const field of ['actionSlotsPerTurn','sp','spMax','flow','flowMode'])assert.equal(Object.hasOwn(store.heroes['Falie#1'],field),false,`${field} is not written back`);
});
test('individual progression handles multi-level growth, living HP delta, KO and cap',()=>{
 const hero=newHeroProgress('Falie');hero.hp=10;const old=hero.maxHP;awardHeroEXP(hero,100);assert.equal(hero.currentLevel,2);assert.equal(hero.hp,10+hero.maxHP-old);
 hero.hp=0;awardHeroEXP(hero,1000);assert.ok(hero.currentLevel>2);assert.equal(hero.hp,0);awardHeroEXP(hero,1e10);assert.equal(hero.currentLevel,100);assert.equal(hero.currentEXP,0);assert.equal(hero.EXPToNextLevel,0);
});
test('role-shaped base durability is explicit rather than globally multiplied',()=>{
 assert.equal('heroHPScale' in PROGRESSION,false);
 assert.deepEqual(Object.keys(HERO_DEFINITIONS).map(key=>newHeroProgress(key).maxHP),[75,60,60,65]);
});
test('victory records settlement without awarding idle hero EXP',()=>{
 const store=createHeroProgressStore();const heroes=Object.values(store.heroes);heroes[1].hp=0;const battle={id:'one',participants:heroes.slice(0,2).map(h=>h.heroInstanceKey),defeated:{a:40,b:60}};
 assert.equal(settleBattleEXP(store,battle,heroes).length,2);assert.equal(heroes[0].currentLevel,1);assert.equal(heroes[1].currentLevel,1);assert.equal(heroes[1].hp,0);assert.equal(heroes[2].currentLevel,1);assert.deepEqual(settleBattleEXP(store,battle,heroes),[]);
});
