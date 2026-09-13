import { HERO_DEFINITIONS, PROGRESSION, heroDefinition, heroKey } from './heroDefinitions.mjs';
export const HERO_PROGRESS_VERSION=2;
export function expToNextLevel(level,config=PROGRESSION){return level>=config.maxLevel?0:Math.ceil(config.expBase*Math.pow(level,config.expExponent));}
export function unlockedPassives(hero){return (heroDefinition(hero)?.passives||[]).filter(p=>p.unlockLevel<=(hero.currentLevel||1));}
export function levelStats(hero){
 const definition=heroDefinition(hero);if(!definition)return {...hero.stats,HP:hero.maxHP};
 const stats=Object.fromEntries(Object.entries(definition.baseStats).map(([key,base])=>[key,Math.floor(base+(definition.growth[key]||0)*((hero.currentLevel||1)-1))]));
 for(const p of unlockedPassives(hero))if(!Object.keys(p.conditions||{}).length&&p.trigger==='stat')stats[p.effect]*=1+p.magnitude;
 for(const [stat,value] of Object.entries(hero.equipmentStats||{}))if(stat in stats)stats[stat]+=value;
 stats.HP*=PROGRESSION.heroHPScale;
 return Object.fromEntries(Object.entries(stats).map(([k,v])=>[k,Math.max(1,Math.floor(v))]));
}
export function refreshHeroStats(hero){const stats=levelStats(hero);hero.maxHP=stats.HP;delete stats.HP;hero.stats=stats;hero.maxLevel=heroDefinition(hero)?.maxLevel||PROGRESSION.maxLevel;hero.EXPToNextLevel=expToNextLevel(hero.currentLevel,{...PROGRESSION,maxLevel:hero.maxLevel});return hero;}
export function newHeroProgress(key,instanceKey=key){const definition=heroDefinition(key);if(!definition)throw new Error('Unknown hero: '+key);const hero={heroInstanceKey:instanceKey,baseHeroName:definition.key,name:definition.key,currentLevel:1,currentEXP:0,maxLevel:definition.maxLevel,actionSlotsPerTurn:definition.actionSlotsPerTurn,sp:definition.startingSP,spMax:definition.maxSP,flow:0};refreshHeroStats(hero);hero.hp=hero.maxHP;return hero;}
export function awardHeroEXP(hero,amount){
 const before={level:hero.currentLevel,hp:hero.maxHP,stats:{...hero.stats},exp:Math.max(0,Number(hero.currentEXP||0)),expToNext:Math.max(0,Number(hero.EXPToNextLevel||0))};let exp=Math.max(0,Math.floor(Number(amount)||0));
 if(hero.currentLevel>=hero.maxLevel){hero.currentEXP=0;hero.EXPToNextLevel=0;return {hero:heroKey(hero),exp:0,fromLevel:before.level,toLevel:before.level,expBefore:before.exp,expAfter:0,expToNextBefore:before.expToNext,unlocks:[]};}
 hero.currentEXP+=exp;
 while(hero.currentLevel<hero.maxLevel&&hero.currentEXP>=expToNextLevel(hero.currentLevel,{...PROGRESSION,maxLevel:hero.maxLevel})){
  hero.currentEXP-=expToNextLevel(hero.currentLevel,{...PROGRESSION,maxLevel:hero.maxLevel});const oldHP=hero.maxHP;hero.currentLevel++;refreshHeroStats(hero);if(hero.hp>0)hero.hp=Math.min(hero.maxHP,hero.hp+hero.maxHP-oldHP);
 }
 if(hero.currentLevel>=hero.maxLevel){hero.currentEXP=0;hero.EXPToNextLevel=0;}
 const d=heroDefinition(hero);return {hero:d.name,exp,fromLevel:before.level,toLevel:hero.currentLevel,expBefore:before.exp,expAfter:Math.max(0,Number(hero.currentEXP||0)),expToNextBefore:before.expToNext,statsBefore:before.stats,statsAfter:{...hero.stats},maxHPBefore:before.hp,maxHPAfter:hero.maxHP,unlocks:[...d.actives,...d.passives].filter(s=>s.unlockLevel>before.level&&s.unlockLevel<=hero.currentLevel).map(s=>s.displayName)};
}
export function createHeroProgressStore(snapshot){
 const store={version:HERO_PROGRESS_VERSION,heroes:{},settledBattles:[]};
 // Old skill-rank data is deliberately not imported into the replacement kits.
 if(snapshot?.version===HERO_PROGRESS_VERSION&&snapshot.heroes&&typeof snapshot.heroes==='object'){
  for(const [id,saved] of Object.entries(snapshot.heroes)){
   if(!heroDefinition(saved))continue;const hero=newHeroProgress(heroKey(saved),id);hero.currentLevel=Math.min(hero.maxLevel,Math.max(1,Math.floor(Number(saved.currentLevel)||1)));hero.currentEXP=Math.max(0,Math.floor(Number(saved.currentEXP)||0));hero.equipmentStats=Object.fromEntries(Object.entries(saved.equipmentStats||{}).filter(([key,value])=>key in heroDefinition(hero).baseStats&&Number.isSafeInteger(value)&&value>=0));hero.actionSlotsPerTurn=Math.max(1,Math.floor(Number(saved.actionSlotsPerTurn)||hero.actionSlotsPerTurn));refreshHeroStats(hero);hero.hp=Math.min(hero.maxHP,Math.max(0,Number(saved.hp)||0));hero.sp=Math.min(hero.spMax,Math.max(0,Number(saved.sp)||0));if(hero.currentLevel===hero.maxLevel)hero.currentEXP=0;store.heroes[id]=hero;
  }
  store.settledBattles=Array.isArray(snapshot.settledBattles)?snapshot.settledBattles.filter(id=>typeof id==='string').slice(-100):[];
 }
 for(const key of Object.keys(HERO_DEFINITIONS))if(!store.heroes[key])store.heroes[key]=newHeroProgress(key);
 return store;
}
export function attachHeroProgress(actor,store){
 const key=heroKey(actor),id=actor.heroInstanceKey||key;
 const saved=store.heroes[id]||(store.heroes[id]=newHeroProgress(key,id));
 Object.assign(actor,{currentLevel:saved.currentLevel,currentEXP:saved.currentEXP,maxLevel:saved.maxLevel,heroInstanceKey:id,equipmentStats:{...saved.equipmentStats},actionSlotsPerTurn:saved.actionSlotsPerTurn??heroDefinition(actor).actionSlotsPerTurn});refreshHeroStats(actor);actor.hp=Math.min(actor.maxHP,saved.hp);actor.sp=heroDefinition(actor).startingSP;actor.spMax=heroDefinition(actor).maxSP;actor.flow=0;actor.flowMode=heroDefinition(actor).flowMode;actor.statuses=[];return actor;
}
export function saveHeroProgress(actor,store){const id=actor.heroInstanceKey||heroKey(actor);store.heroes[id]={heroInstanceKey:id,equipmentStats:{...actor.equipmentStats},baseHeroName:heroKey(actor),name:heroKey(actor),actionSlotsPerTurn:actor.actionSlotsPerTurn,currentLevel:actor.currentLevel,currentEXP:actor.currentEXP,maxLevel:actor.maxLevel,hp:actor.hp,maxHP:actor.maxHP,stats:{...actor.stats},sp:actor.sp,spMax:actor.spMax,flow:0,EXPToNextLevel:actor.EXPToNextLevel};}
export function settleBattleEXP(store,battle,heroes){
 if(battle.settled||store.settledBattles.includes(battle.id))return [];
 battle.settled=true;store.settledBattles.push(battle.id);store.settledBattles=store.settledBattles.slice(-100);
 const exp=Object.values(battle.defeated||{}).reduce((sum,value)=>sum+Math.max(0,Number(value)||0),0);
 return heroes.filter(h=>battle.participants.includes(h.heroInstanceKey||heroKey(h))).map(hero=>{const result=awardHeroEXP(hero,exp);saveHeroProgress(hero,store);return result;});
}
