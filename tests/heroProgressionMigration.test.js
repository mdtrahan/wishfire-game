const test=require('node:test');
const assert=require('node:assert/strict');
const {HERO_DEFINITIONS,PROGRESSION}=require('../web-runner/src/core/heroDefinitions.mjs');
const {newHeroProgress,awardHeroEXP,createHeroProgressStore,settleBattleEXP}=require('../web-runner/src/core/heroProgression.mjs');
test('all canonical kits expose staged 7 actives, 6 passives and a unique special',()=>{
 const specials=new Set();for(const d of Object.values(HERO_DEFINITIONS)){assert.equal(d.actives.length,7);assert.equal(d.passives.length,6);specials.add(d.special.skillId);assert.deepEqual(d.actives.map(a=>a.unlockLevel),[1,1,5,15,20,30,40]);}assert.equal(specials.size,4);
});
test('individual progression handles multi-level growth, living HP delta, KO and cap',()=>{
 const hero=newHeroProgress('Falie');hero.hp=10;const old=hero.maxHP;awardHeroEXP(hero,100);assert.equal(hero.currentLevel,2);assert.equal(hero.hp,10+hero.maxHP-old);
 hero.hp=0;awardHeroEXP(hero,1000);assert.ok(hero.currentLevel>2);assert.equal(hero.hp,0);awardHeroEXP(hero,1e10);assert.equal(hero.currentLevel,50);assert.equal(hero.currentEXP,0);assert.equal(hero.EXPToNextLevel,0);
});
test('canonical hero durability scale applies equally through progression',()=>{
 assert.equal(PROGRESSION.heroHPScale,2);
 assert.deepEqual(Object.keys(HERO_DEFINITIONS).map(key=>newHeroProgress(key).maxHP),[92,70,60,80]);
});
test('victory awards full defeated-enemy EXP once to every participant including KO',()=>{
 const store=createHeroProgressStore();const heroes=Object.values(store.heroes);heroes[1].hp=0;const battle={id:'one',participants:heroes.slice(0,2).map(h=>h.heroInstanceKey),defeated:{a:40,b:60}};
 assert.equal(settleBattleEXP(store,battle,heroes).length,2);assert.equal(heroes[0].currentLevel,2);assert.equal(heroes[1].currentLevel,2);assert.equal(heroes[1].hp,0);assert.equal(heroes[2].currentLevel,1);assert.deepEqual(settleBattleEXP(store,battle,heroes),[]);
});
