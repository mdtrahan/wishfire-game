import {equipmentStats} from '../src/core/equipment.mjs';
import {markLampGuide,createLampEconomy,validateLampEconomy,lampItemCPGain,planLampAutoEquip,lampStoredCount,migrateLegacyEquipment,migrateDraftLamp,migrateFourStatLamp,migrateLampEconomy,lampAutoUnlocked,lampCapacity,purchaseLampStage,upgradeLamp,completeLampUpgrade,speedUpLampUpgrade,activateLamp,equipLampItem,dismantleLampItems,LAMP_CONFIG,progressionOrdinal} from '../src/core/lampGear.mjs';
import {refreshHeroStats,awardHeroEXP} from '../src/core/heroProgression.mjs';
import {computeCombatPower} from '../src/core/combatPower.mjs';
export const EQUIPMENT_SAVE_KEY='wishfire.equipment-economy.v5';
const FOUR_STAT_HP_KEY='wishfire.equipment-economy.v4';
const PREVIOUS_KEY='wishfire.equipment-economy.v3';
const DRAFT_KEY='wishfire.equipment-economy.v2';
const LEGACY_KEY='wishfire.equipment-economy.v1';
export function createEquipmentStorage({globals,getActors=()=>[],storage,locks=globalThis.navigator?.locks,now=Date.now,seed=()=>crypto.getRandomValues(new Uint32Array(1))[0],reportError=console.error,persistProgress=()=>{}}){
 let record,appliedGold,loading,dirty=false,lastClock=0;
 globalThis.addEventListener?.('storage',e=>{if(e.key===EQUIPMENT_SAVE_KEY)dirty=true;});
 const time=()=>lastClock=Math.max(lastClock,now(),record?.lamp.lastActivationAt||0);
 function read(){
  const raw=storage.getItem(EQUIPMENT_SAVE_KEY);
  if(raw!==null)return validateLampEconomy(JSON.parse(raw));
  const v4=storage.getItem(FOUR_STAT_HP_KEY);if(v4!==null)return migrateLampEconomy(JSON.parse(v4));
  const previous=storage.getItem(PREVIOUS_KEY);if(previous!==null)return migrateFourStatLamp(JSON.parse(previous));
  const draft=storage.getItem(DRAFT_KEY);if(draft!==null)return migrateDraftLamp(JSON.parse(draft));
  const old=storage.getItem(LEGACY_KEY);if(old!==null)return migrateLegacyEquipment(JSON.parse(old),seed());
  const legacyGold=storage.getItem('wishfire.gold.v1');
  const pending=Object.values(globals.PendingGoldSettlements||{}).reduce((sum,n)=>sum+Math.max(0,Math.floor(Number(n)||0)),0);
  const gold=legacyGold===null?Math.max(0,Number(globals.goldTotal||0)-pending):Number(legacyGold);
  if(!Number.isSafeInteger(gold)||gold<0)throw new Error('Gold save is invalid. Original data is preserved.');
  return createLampEconomy(seed(),gold);
 }
 function apply(next){
  record=next;globals.goldTotal=record.gold;appliedGold=record.gold;globals.Equipment=record;globals.SettledGoldRewardReceipts=[...record.settledGoldRewards];globals.LampStorageError='';
  const pending=globals.PendingGoldSettlements&&typeof globals.PendingGoldSettlements==='object'?globals.PendingGoldSettlements:{};
  globals.PendingGoldSettlements=Object.fromEntries(Object.entries(pending).filter(([id])=>!record.settledGoldRewards.includes(String(id))));
  for(const hero of [...Object.values(globals.HeroProgress?.heroes||{}),...getActors().filter(a=>a.kind==='hero')]){
   const exp=record.partyEXP-(hero.lampEXPClaimed||0);
   if(exp>0){awardHeroEXP(hero,exp);hero.lampEXPClaimed=record.partyEXP;globals.HeroProgressDirty=true;}
   const stats=equipmentStats(record.items,record.loadouts[hero.heroInstanceKey]);
   if(JSON.stringify(hero.equipmentStats||{})!==JSON.stringify(stats)){
    hero.equipmentStats=stats;refreshHeroStats(hero);hero.hp=Math.min(hero.hp,hero.maxHP);globals.HeroProgressDirty=true;
   }
   hero.combatPower=computeCombatPower(hero);
  }
  if(globals.HeroProgressDirty)persistProgress();
 }
 async function transact(change){
  if(globals.HeroProgressStorageError&&Object.keys(globals.PendingGoldSettlements||{}).length)throw new Error('Pending Gold needs a saved HeroProgress receipt.');
  if(!locks)throw new Error('This browser cannot safely save lamp changes.');
  return locks.request(EQUIPMENT_SAVE_KEY,async()=>{
   const next=read(),receipts=new Set(next.settledGoldRewards);let delta=appliedGold===undefined?0:Number(globals.goldTotal)-appliedGold;
   for(const[rawId,rawAmount]of Object.entries(globals.PendingGoldSettlements||{})){
    const id=String(rawId),amount=Math.max(0,Math.floor(Number(rawAmount)||0));
    if(receipts.has(id)){if(appliedGold!==undefined)delta-=amount;continue;}
    receipts.add(id);next.settledGoldRewards.push(id);if(appliedGold===undefined)delta+=amount;
   }
   const t=time();completeLampUpgrade(next,t);
   next.gold+=delta;const result=change?.(next,t);validateLampEconomy(next);
   // One durable record owns spending, rolls, assignments and salvage receipts.
   storage.setItem(EQUIPMENT_SAVE_KEY,JSON.stringify(next));apply(next);return result;
  }).catch(error=>{globals.LampStorageError=error.message;reportError('Lamp save failed',error);throw error;});
 }
 function commitEquip(next,heroId,id){
   const hero=globals.HeroProgress.heroes[heroId],before=refreshHeroStats({...hero,equipmentStats:equipmentStats(next.items,next.loadouts[heroId])});
   const candidate=next.items.find(i=>i.instanceId===id);
   if(!candidate)throw new Error('Item missing.');
   const equipped=equipLampItem(next,heroId,id),after=refreshHeroStats({...hero,equipmentStats:equipmentStats(next.items,next.loadouts[heroId])});
   const cpBefore=computeCombatPower(before),cpAfter=computeCombatPower(after);
   return{item:equipped,heroId,cpBefore,cpAfter,cpChange:Math.round((cpAfter-cpBefore)*10)/10};
 }
 return{
  get data(){return record;},time,
  sync(){if(loading)return loading;if(record&&Number(globals.goldTotal)===appliedGold&&!dirty&&!(record.lamp.upgradeEndsAt&&time()>=record.lamp.upgradeEndsAt)){apply(record);return Promise.resolve();}dirty=false;loading=transact().finally(()=>loading=null);return loading;},
  refresh(){dirty=true;return this.sync();},
  generate(context={}){return transact((next,t)=>activateLamp(next,context,t));},
  setAuto(enabled){return transact(next=>{if(enabled&&!lampAutoUnlocked(Object.values(globals.HeroProgress?.heroes||{}).slice(0,4)))throw new Error('All four heroes must reach Lv. 5 to unlock Auto.');next.lamp.autoEnabled=!!enabled;});},
  async stopAuto(){await this.sync();if(!record?.lamp.autoEnabled)return false;await this.setAuto(false);return true;},
  tickAuto(context={}){return transact((next,t)=>{
   next.lamp.highestOrdinal=Math.max(next.lamp.highestOrdinal,progressionOrdinal(context));
   if(!lampAutoUnlocked(Object.values(globals.HeroProgress?.heroes||{}).slice(0,4))||!next.lamp.autoEnabled||t-next.lamp.lastActivationAt<LAMP_CONFIG.autoIntervalMs||lampStoredCount(next)>=lampCapacity(next))return null;
   return activateLamp(next,context,t);
  });},
  equip(heroId,id){if(!globals.HeroProgress?.heroes?.[heroId])return Promise.reject(new Error('Hero is not owned'));return transact(next=>commitEquip(next,heroId,id));},
  autoEquip(){return transact(next=>{
   const heroes=Object.values(globals.HeroProgress?.heroes||{}).slice(0,4),before=new Map(heroes.map(hero=>[hero.heroInstanceKey,computeCombatPower(refreshHeroStats({...hero,equipmentStats:equipmentStats(next.items,next.loadouts[hero.heroInstanceKey])}))])),planned=planLampAutoEquip(next,heroes);
   next.items=planned.items;next.loadouts=planned.loadouts;next.lamp.pending=planned.pending;next.lamp.discarded=planned.discarded;
   return planned.changes.map(change=>{
    const hero=heroes.find(h=>h.heroInstanceKey===change.heroId),after=computeCombatPower(refreshHeroStats({...hero,equipmentStats:equipmentStats(next.items,next.loadouts[change.heroId])})),cpBefore=before.get(change.heroId);
    return{items:change.items,processedItems:change.processedItems,slots:change.slots,heroId:change.heroId,cpBefore,cpAfter:after,cpChange:Math.round((after-cpBefore)*10)/10};
   });
  });},
  markGuide(step){return transact(next=>markLampGuide(next,step));},
  purchaseStage(expectedTier=record?.lamp.capacityTier,expectedStage=record?.lamp.upgradeStage||0){return transact((next,t)=>purchaseLampStage(next,expectedTier,expectedStage,t));},
  upgrade(expectedTier=record?.lamp.capacityTier){return transact((next,t)=>upgradeLamp(next,expectedTier,t));},
  speedUp(expectedTier=record?.lamp.capacityTier){return transact((next,t)=>speedUpLampUpgrade(next,expectedTier,t));},
  dismantle(ids){return transact(next=>dismantleLampItems(next,ids,Object.values(globals.HeroProgress?.heroes||{}).slice(0,4)));},
 };
}
