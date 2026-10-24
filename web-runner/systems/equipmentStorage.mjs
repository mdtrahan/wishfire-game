import {lampHeroRoster} from '../src/core/lampHeroRoster.mjs';
import {CONVEYOR_TRAVEL_MS,conveyorItemAge,validateConveyorState,emitConveyorItem,collectConveyorItem,classifyConveyorCache,equipConveyorItem,planConveyorAutoEquip,queueConveyorDisposal,conveyorDisposalPreview,dismantleConveyorItems} from '../src/core/lampConveyor.mjs';
import {equipmentStats} from '../src/core/equipment.mjs';
import {markLampGuide,createLampEconomy,lampStoredCount,migrateLegacyEquipment,migrateDraftLamp,migrateFourStatLamp,migrateLampEconomy,lampCapacity,upgradeLamp,restorePaidLampUpgrade,LAMP_CONFIG,progressionOrdinal} from '../src/core/lampGear.mjs';
import {refreshHeroStats,awardHeroEXP} from '../src/core/heroProgression.mjs';
import {fillGearMaxHpGrowth} from '../src/core/heroSustainRules.mjs';
import {computeCombatPower} from '../src/core/combatPower.mjs';
export const EQUIPMENT_SAVE_KEY='wishfire.equipment-economy.v5';
export const BAG_UPGRADE_BACKUP_KEY=EQUIPMENT_SAVE_KEY+'.before-bag-upgrades';
const CONVEYOR_CLOCK_KEY='wishfire.equipment-conveyor-clock.v1';
const FOUR_STAT_HP_KEY='wishfire.equipment-economy.v4';
const PREVIOUS_KEY='wishfire.equipment-economy.v3';
const DRAFT_KEY='wishfire.equipment-economy.v2';
const LEGACY_KEY='wishfire.equipment-economy.v1';
export function createEquipmentStorage({globals,getActors=()=>[],storage,checkpointStorage,locks=globalThis.navigator?.locks,now=Date.now,seed=()=>crypto.getRandomValues(new Uint32Array(1))[0],reportError=console.error,persistProgress=()=>{},onGearCollected=null}){
 let record,appliedGold,loading,dirty=false,lastClock=0,classifiedHeroes;
 let conveyorClock,conveyorFrame,conveyorOrigin,conveyorOriginWall,conveyorRunning=false;
 // Session storage survives reload in this tab and never overwrites inventory.
 try{checkpointStorage??=globalThis.sessionStorage;}catch{}
 function restoredConveyorClock(lamp){
  try{
   const saved=JSON.parse(checkpointStorage?.getItem(CONVEYOR_CLOCK_KEY)||'null');
   if(lamp.conveyorActiveMs!==undefined&&saved&&saved.seed===lamp.seed&&saved.sequence===lamp.sequence&&saved.lastActivationAt===lamp.lastActivationAt&&Number.isSafeInteger(saved.activeMs)&&saved.activeMs>=0)return Math.max(lamp.conveyorActiveMs??0,saved.activeMs);
  }catch(error){reportError('Lamp conveyor checkpoint could not be read',error);}
  return lamp.conveyorActiveMs;
 }
 function checkpointConveyorClock(){
  const {seed,sequence,lastActivationAt}=record.lamp;
  try{checkpointStorage?.setItem(CONVEYOR_CLOCK_KEY,JSON.stringify({seed,sequence,lastActivationAt,activeMs:conveyorClock}));}
  catch(error){reportError('Lamp conveyor checkpoint could not be saved',error);}
 }
 function setConveyorActive(active){
  if(!record)return Promise.resolve();
  const t=time(),wasRunning=conveyorRunning,initializing=conveyorClock===undefined;
  conveyorClock=Math.max(conveyorClock??restoredConveyorClock(record.lamp)??t,record.lamp.conveyorActiveMs??0);
  if(initializing){conveyorOrigin=conveyorClock;conveyorOriginWall=t;}
  if(wasRunning)conveyorClock+=Math.max(0,t-conveyorFrame);
  conveyorFrame=t;conveyorRunning=active;
  // Checkpoint active time through the pause event, including visibility/page exit.
  if(initializing||wasRunning&&!active){checkpointConveyorClock();return transact();}
  return Promise.resolve();
 }
 function saveConveyorClock(next){
  if(conveyorClock===undefined)return;
  next.lamp.conveyorActiveMs=Math.max(next.lamp.conveyorActiveMs??0,conveyorClock);
  for(const emission of next.lamp.emissions||[]){
   emission.issuedActiveMs??=Math.max(0,conveyorOrigin-Math.max(0,conveyorOriginWall-emission.issuedAt));
  }
 }
 const heroClassificationKey=()=>JSON.stringify(lampHeroRoster(globals.HeroProgress).map(h=>[h.heroInstanceKey,h.currentLevel,h.baseStats,h.statGrowth]));
 globalThis.addEventListener?.('storage',e=>{if(e.key===EQUIPMENT_SAVE_KEY)dirty=true;});
 const time=()=>lastClock=Math.max(lastClock,now(),record?.lamp.lastActivationAt||0);
 function read(){
  const raw=storage.getItem(EQUIPMENT_SAVE_KEY);
  if(raw!==null)return validateConveyorState(JSON.parse(raw));
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
   const canonical=hero.baseHeroName;
   const primary=hero.heroInstanceKey===canonical||hero.heroInstanceKey===`${canonical?.toLowerCase()}#1`;
   const stats=equipmentStats(record.items,record.loadouts[hero.heroInstanceKey]??(primary?record.loadouts[canonical]:undefined));
   if(JSON.stringify(hero.equipmentStats||{})!==JSON.stringify(stats)){
    const beforeMaxHp=hero.maxHP,beforeHp=hero.hp;
    hero.equipmentStats=stats;refreshHeroStats(hero);hero.hp=fillGearMaxHpGrowth(beforeHp,beforeMaxHp,hero.maxHP);globals.HeroProgressDirty=true;
   }
   hero.combatPower=computeCombatPower(hero);
  }
  if(globals.HeroProgressDirty)persistProgress();
 }
 async function transact(change){
  if(globals.HeroProgressStorageError&&Object.keys(globals.PendingGoldSettlements||{}).length)throw new Error('Pending Gold needs a saved HeroProgress receipt.');
  if(!locks)throw new Error('This browser cannot safely save lamp changes.');
  return locks.request(EQUIPMENT_SAVE_KEY,async()=>{
   // Guard every writer before read/migration/backup; classification is not the safety gate.
   const roster=lampHeroRoster(globals.HeroProgress,{requireComplete:true});
   const next=read();
   if(restorePaidLampUpgrade(next)&&storage.getItem(BAG_UPGRADE_BACKUP_KEY)===null){
    const original=storage.getItem(EQUIPMENT_SAVE_KEY);
    if(original!==null)storage.setItem(BAG_UPGRADE_BACKUP_KEY,original);
   }
   const receipts=new Set(next.settledGoldRewards);let delta=appliedGold===undefined?0:Number(globals.goldTotal)-appliedGold;
   for(const[rawId,rawAmount]of Object.entries(globals.PendingGoldSettlements||{})){
    const id=String(rawId),amount=Math.max(0,Math.floor(Number(rawAmount)||0));
    if(receipts.has(id)){if(appliedGold!==undefined)delta-=amount;continue;}
    receipts.add(id);next.settledGoldRewards.push(id);if(appliedGold===undefined)delta+=amount;
   }
   const t=time();saveConveyorClock(next);
   next.gold+=delta;
   classifyConveyorCache(next,roster);
   const result=change?.(next,t);classifyConveyorCache(next,roster);validateConveyorState(next);
   // One durable record owns spending, rolls, assignments and salvage receipts.
   storage.setItem(EQUIPMENT_SAVE_KEY,JSON.stringify(next));classifiedHeroes=heroClassificationKey();apply(next);return result;
  }).catch(error=>{globals.LampStorageError=error.message;reportError('Lamp save failed',error);throw error;});
 }
 function commitEquip(next,heroId,id){
   const hero=globals.HeroProgress.heroes[heroId],before=refreshHeroStats({...hero,equipmentStats:equipmentStats(next.items,next.loadouts[heroId])});
   const candidate=next.items.find(i=>i.instanceId===id)||next.lamp.reviewHold?.item;
   if(!candidate)throw new Error('Item missing.');
   const equipped=equipConveyorItem(next,heroId,id,hero),after=refreshHeroStats({...hero,equipmentStats:equipmentStats(next.items,next.loadouts[heroId])});
   const cpBefore=computeCombatPower(before),cpAfter=computeCombatPower(after);
   return{item:equipped,heroId,cpBefore,cpAfter,cpChange:Math.round((cpAfter-cpBefore)*10)/10};
 }
 function queueGearCollection(next,result){
  if(!onGearCollected||!result?.saved||!result.item?.instanceId)return;
  next.pendingGearCollections ||= [];
  if(!next.pendingGearCollections.some(event=>event.id===result.item.instanceId))next.pendingGearCollections.push({id:result.item.instanceId,item:structuredClone(result.item)});
 }
 let gearCollectionFlush=null;
 async function flushGearCollections(){
  if(!onGearCollected||!record?.pendingGearCollections?.length)return;
  if(gearCollectionFlush)return gearCollectionFlush;
  gearCollectionFlush=(async()=>{
   for(const event of [...record.pendingGearCollections]){
    try{
     const acknowledged=await onGearCollected({item:event.item,saved:true});
     if(!acknowledged)break;
     await transact(next=>{next.pendingGearCollections=(next.pendingGearCollections||[]).filter(pending=>pending.id!==event.id);});
    }catch(error){reportError('COT gear event save failed',error);break;}
   }
  })().finally(()=>{gearCollectionFlush=null;});
  return gearCollectionFlush;
 }
 return{
  get data(){return record;},time,setConveyorActive,
  conveyorTime(){return Math.max(conveyorClock??record?.lamp.conveyorActiveMs??time(),record?.lamp.conveyorActiveMs??0);},
  sync(){if(loading)return loading;if(record&&classifiedHeroes===heroClassificationKey()&&Number(globals.goldTotal)===appliedGold&&!dirty){apply(record);return flushGearCollections();}dirty=false;loading=transact().then(flushGearCollections).finally(()=>loading=null);return loading;},
  refresh(){dirty=true;return this.sync();},
  generate(context={}){return transact((next,t)=>{
   const item=emitConveyorItem(next,context,t),receipt=collectConveyorItem(next,item.instanceId,t,{automatic:true});
   queueGearCollection(next,receipt);
   return{...item,rewardEXP:receipt.exp};
  }).then(async result=>{await flushGearCollections();return result;});},
  async collect(id,canCollect=()=>true){const result=await transact((next,t)=>{if(!canCollect(next))return null;const collected=collectConveyorItem(next,id,t);queueGearCollection(next,collected);return collected;});await flushGearCollections();return result;},
  awardCombatEssence(receiptId,amount){
   const id=String(receiptId||'').slice(0,180),count=Math.max(0,Math.floor(Number(amount)||0));
   if(!id||!count)return Promise.resolve({applied:false,reason:'invalid_receipt'});
   return transact(next=>{
    next.settledCombatEssenceRewards ||= [];
    if(next.settledCombatEssenceRewards.includes(id))return{applied:false,duplicate:true,essence:next.lamp.essence};
    next.lamp.essence+=count;
    next.settledCombatEssenceRewards=[...next.settledCombatEssenceRewards,id].slice(-512);
    return{applied:true,essence:next.lamp.essence};
   });
  },
  hasSettledCombatEssenceReward(receiptId){
   const id=String(receiptId||'').slice(0,180);if(!id)return false;
   const current=record||read();return Array.isArray(current.settledCombatEssenceRewards)&&current.settledCombatEssenceRewards.includes(id);
  },
  collectAvailable(ids,canCollect=()=>true){return transact((next,t)=>[...new Set(ids)].flatMap(id=>{
   if(!canCollect(next))return[];
   const emission=next.lamp.emissions?.find(e=>e.item.instanceId===id);
   if(!emission||emission.collected||conveyorItemAge(next.lamp,emission,t)>=CONVEYOR_TRAVEL_MS)return[];
   const result=collectConveyorItem(next,id,t,{automatic:true});queueGearCollection(next,result);return[result];
  })).then(async result=>{await flushGearCollections();return result;});},
  queueDisposal(id){return transact(next=>queueConveyorDisposal(next,id,lampHeroRoster(globals.HeroProgress)));},
  disposalPreview(ids){return conveyorDisposalPreview(record,lampHeroRoster(globals.HeroProgress,{requireComplete:true}),ids);},
  // Legacy combat-exit call remains a sync barrier, without a preference or toggle.
  stopAuto(){return this.sync();},
  tickConveyor(context={},canCreate=()=>true,{deferCollection=false}={}){return transact((next,t)=>{
   if(!canCreate(next))return null;
   next.lamp.highestOrdinal=Math.max(next.lamp.highestOrdinal,progressionOrdinal(context));
   if(t-next.lamp.lastActivationAt<LAMP_CONFIG.autoIntervalMs)return null;
   const previous=next.lamp.emissions?.at(-1);
   if(previous?.issuedActiveMs!==undefined&&conveyorItemAge(next.lamp,previous,t)<LAMP_CONFIG.autoIntervalMs)return null;
   const item=emitConveyorItem(next,context,t),receipt=deferCollection?{exp:0}:collectConveyorItem(next,item.instanceId,t,{automatic:true});queueGearCollection(next,receipt);
   return{...item,rewardEXP:receipt.exp};
  }).then(async result=>{await flushGearCollections();return result;});},
  equip(heroId,id){if(!lampHeroRoster(globals.HeroProgress).some(h=>h.heroInstanceKey===heroId))return Promise.reject(new Error('Hero is not a lamp equipment owner'));return transact(next=>commitEquip(next,heroId,id));},
  autoEquip(){return transact(next=>{
   const heroes=lampHeroRoster(globals.HeroProgress),planned=planConveyorAutoEquip(next,heroes),before=structuredClone(next);
   Object.assign(next,planned.working);
   return heroes.flatMap(hero=>{
    const heroId=hero.heroInstanceKey,old=before.loadouts[heroId]||{},current=next.loadouts[heroId]||{};
    const slots=['hat','body','boots'].filter(slot=>old[slot]!==current[slot]);if(!slots.length)return[];
    const cpBefore=computeCombatPower(refreshHeroStats({...hero,equipmentStats:equipmentStats(before.items,old)})),cpAfter=computeCombatPower(refreshHeroStats({...hero,equipmentStats:equipmentStats(next.items,current)}));
    return[{items:slots.map(slot=>next.items.find(i=>i.instanceId===current[slot])),slots,heroId,cpBefore,cpAfter,cpChange:Math.round((cpAfter-cpBefore)*10)/10}];
   });
  });},
  finishReview(){return transact(()=>{});},
  markGuide(step){return transact(next=>markLampGuide(next,step));},
  upgrade(expectedTier=record?.lamp.capacityTier){return transact(next=>upgradeLamp(next,expectedTier));},
  dismantle(preview){return transact(next=>{
   const roster=lampHeroRoster(globals.HeroProgress);
   if(Array.isArray(preview)){
    const ids=preview.filter(id=>!id.startsWith('salvage:'));
    const current=conveyorDisposalPreview(next,roster,ids);
    if(!preview.includes(current.legacy))throw new Error('Collection changed. Review dismantling.');
    return dismantleConveyorItems(next,current,roster);
   }
   return dismantleConveyorItems(next,preview,roster);
  });},
 };
}
