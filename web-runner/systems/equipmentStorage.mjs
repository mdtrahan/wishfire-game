import {EQUIPMENT,equipItem,equipmentStats} from '../src/core/equipment.mjs';
import {createMarket,purchaseOffer} from '../src/core/astralMarket.mjs';
import {refreshHeroStats} from '../src/core/heroProgression.mjs';
import {computeCombatPower} from '../src/core/combatPower.mjs';
const KEY='wishfire.equipment-economy.v1';

export function createEquipmentStorage({globals,getActors=()=>[],storage,locks=globalThis.navigator?.locks,now=Date.now,seed=()=>crypto.getRandomValues(new Uint32Array(1))[0],reportError=console.error}){
 let record,appliedGold,loading,dirty=false,lastClock=0;
 globalThis.addEventListener?.('storage',event=>{if(event.key===KEY)dirty=true;});
 const time=()=>lastClock=Math.max(lastClock,now(),record?.market.lastSeen||0);
 function read(){
  const raw=storage.getItem(KEY);
  if(!raw){const legacy=storage.getItem('wishfire.gold.v1');const pendingGold=Object.values(globals.PendingGoldSettlements||{}).reduce((sum,value)=>sum+Math.max(0,Math.floor(Number(value)||0)),0);const gold=legacy===null?Math.max(0,Number(globals.goldTotal||0)-pendingGold):Number(legacy);return {version:1,gold,items:[],loadouts:{},market:createMarket(seed(),now()),settledGoldRewards:[]};}
  const data=JSON.parse(raw);
  if(data.version!==1||!Number.isSafeInteger(data.gold)||data.gold<0||!Array.isArray(data.items)||!data.loadouts||typeof data.loadouts!=='object'||!Number.isInteger(data.market?.seed)||!Number.isFinite(data.market?.epoch)||!Number.isFinite(data.market?.lastSeen))throw new Error('Equipment save is invalid; original save preserved.');
  const ids=new Set();for(const i of data.items){if(!EQUIPMENT[i.equipmentId]||typeof i.instanceId!=='string'||ids.has(i.instanceId))throw new Error('Invalid equipment ownership');ids.add(i.instanceId);}
  for(const slots of Object.values(data.loadouts)){if(!slots||typeof slots!=='object'||Array.isArray(slots)||Object.values(slots).some(id=>typeof id!=='string'||!ids.has(id)))throw new Error('Invalid saved loadout');}
  data.settledGoldRewards=Array.isArray(data.settledGoldRewards)?data.settledGoldRewards.filter(id=>typeof id==='string'):[];
  return data;
 }
 function apply(next){
  record=next;globals.goldTotal=record.gold;appliedGold=record.gold;globals.Equipment=record;globals.SettledGoldRewardReceipts=[...record.settledGoldRewards];
  const pending=globals.PendingGoldSettlements&&typeof globals.PendingGoldSettlements==='object'?globals.PendingGoldSettlements:{};
  globals.PendingGoldSettlements=Object.fromEntries(Object.entries(pending).filter(([id])=>!record.settledGoldRewards.includes(String(id))));
  for(const hero of [...Object.values(globals.HeroProgress?.heroes||{}),...getActors().filter(a=>a.kind==='hero')]){
   const stats=equipmentStats(record.items,record.loadouts[hero.heroInstanceKey]);
   if(JSON.stringify(hero.equipmentStats||{})!==JSON.stringify(stats)){
    hero.equipmentStats=stats;refreshHeroStats(hero);hero.hp=Math.min(hero.hp,hero.maxHP);globals.HeroProgressDirty=true;
   }
   hero.combatPower=computeCombatPower(hero);
  }
 }
 async function transact(change){
  if(globals.HeroProgressStorageError&&Object.keys(globals.PendingGoldSettlements||{}).length)throw new Error('Pending Gold rewards require a saved HeroProgress receipt.');
  if(!locks)throw new Error('Secure local purchases are unavailable in this browser.');
  return locks.request(KEY,async()=>{
   const next=read();const pending=globals.PendingGoldSettlements&&typeof globals.PendingGoldSettlements==='object'?globals.PendingGoldSettlements:{};const receipts=new Set(next.settledGoldRewards);
   let delta=appliedGold===undefined?0:Number(globals.goldTotal)-appliedGold;
   for(const [rawId,rawAmount] of Object.entries(pending)){
    const id=String(rawId),amount=Math.max(0,Math.floor(Number(rawAmount)||0));
    if(receipts.has(id)){if(appliedGold!==undefined)delta-=amount;continue;}
    receipts.add(id);next.settledGoldRewards.push(id);
    if(appliedGold===undefined)delta+=amount;
   }
   next.gold+=delta;
   if(!Number.isSafeInteger(next.gold)||next.gold<0)throw new Error('Invalid Gold balance');
   const t=time();next.market.lastSeen=Math.max(next.market.lastSeen,t);
   const result=change?.(next,t);
   // One save commits Gold, ownership, loadouts and the market timeline together.
   storage.setItem(KEY,JSON.stringify(next));apply(next);return result;
  });
 }
 return {
  get data(){return record;},time,
  sync(){
   if(loading)return loading;
   if(record&&Number(globals.goldTotal)===appliedGold&&!dirty){apply(record);return Promise.resolve();}
   dirty=false;loading=transact().catch(e=>{reportError('Equipment save failed',e);throw e;}).finally(()=>{loading=null;});return loading;
  },
  refresh(){dirty=true;return this.sync();},
  purchase(id){return transact((next,t)=>purchaseOffer(next,id,t));},
  equip(heroId,slot,id){if(!globals.HeroProgress?.heroes[heroId])return Promise.reject(new Error('Hero is not owned'));return transact(next=>equipItem(next,heroId,slot,id));},
 };
}
