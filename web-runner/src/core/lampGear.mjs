import {EQUIPMENT,RARITIES,EQUIPMENT_SLOTS,equipmentDefinition,equipmentStats,isEquipmentUpgrade} from './equipment.mjs';
import {refreshHeroStats} from './heroProgression.mjs';
import {computeCombatPower} from './combatPower.mjs';

export const LAMP_CONFIG=Object.freeze({capacity:20,drawEXP:25,minEmissionIntervalMs:2000,autoIntervalMs:5000,autoUnlockLevel:5,maxOrdinal:990});
export const LAMP_CAPACITY_TIERS=Object.freeze([
 {capacity:20,cost:20,rarityWeights:{common:75,uncommon:25,rare:0,epic:0,legendary:0}},
 {capacity:30,cost:50,rarityWeights:{common:55,uncommon:35,rare:10,epic:0,legendary:0}},
 {capacity:40,cost:100,rarityWeights:{common:35,uncommon:40,rare:20,epic:5,legendary:0}},
 {capacity:50,cost:null,rarityWeights:{common:20,uncommon:35,rare:30,epic:14,legendary:1}},
].map(t=>Object.freeze({...t,rarityWeights:Object.freeze(t.rarityWeights)})));
export const lampCapacity=data=>LAMP_CAPACITY_TIERS[data.lamp.capacityTier||0].capacity;
export function upgradeLamp(data){const tier=LAMP_CAPACITY_TIERS[data.lamp.capacityTier];if(tier.cost===null)throw new Error('Lamp is fully upgraded.');if(data.lamp.essence<tier.cost)throw new Error('Dismantle gear to earn more essence.');data.lamp.essence-=tier.cost;data.lamp.capacityTier++;return lampCapacity(data);}
export const GEAR_STATS=Object.freeze(['ATK','DEF','MAG','RES','HP']);
export const GEAR_ARCHETYPES=Object.freeze([
 {id:'guardian-hat',name:'Guardian Helm',type:'hat',art:0,stats:{ATK:1,DEF:3,MAG:1,RES:2,HP:5}},
 {id:'scholar-hat',name:'Scholar Turban',type:'hat',art:1,stats:{ATK:1,DEF:1,MAG:3,RES:2,HP:5}},
 {id:'wanderer-hat',name:'Wayfarer Cap',type:'hat',art:2,stats:{ATK:3,DEF:2,MAG:1,RES:1,HP:5}},
 {id:'guardian-body',name:'Guardian Cuirass',type:'body',art:3,stats:{ATK:1,DEF:4,MAG:1,RES:2,HP:10}},
 {id:'scholar-body',name:'Scholar Vest',type:'body',art:4,stats:{ATK:1,DEF:2,MAG:3,RES:3,HP:10}},
 {id:'wanderer-body',name:'Wayfarer Vest',type:'body',art:5,stats:{ATK:4,DEF:2,MAG:1,RES:1,HP:10}},
 {id:'guardian-boots',name:'Guardian Boots',type:'boots',art:6,stats:{ATK:1,DEF:3,MAG:1,RES:2,HP:5}},
 {id:'scholar-boots',name:'Scholar Slippers',type:'boots',art:7,stats:{ATK:1,DEF:1,MAG:2,RES:3,HP:5}},
 {id:'wanderer-boots',name:'Wayfarer Boots',type:'boots',art:8,stats:{ATK:3,DEF:2,MAG:1,RES:1,HP:5}},
].map(Object.freeze));
const QUALITY=Object.freeze({common:1,uncommon:1.18,rare:1.42,epic:1.7,legendary:2});
export function seededUnit(seed,sequence,salt){let x=(seed^Math.imul(sequence+1,374761393)^Math.imul(salt+1,668265263))>>>0;x=Math.imul(x^(x>>>13),1274126177);return((x^(x>>>16))>>>0)/4294967296;}
export function progressionOrdinal({region=1,stage=1}={}){return Math.min(LAMP_CONFIG.maxOrdinal,(Math.max(1,Math.floor(Number(region)||1))-1)*10+Math.max(0,Math.min(9,Math.floor(Number(stage)||1)-1)));}
export function generateLampItem(seed,sequence,ordinal,weights=Object.fromEntries(Object.entries(RARITIES).map(([k,v])=>[k,v.weight]))){
 const a=GEAR_ARCHETYPES[Math.floor(seededUnit(seed,sequence,0)*GEAR_ARCHETYPES.length)];
 let roll=seededUnit(seed,sequence,1)*100,rarity='common';
 for(const [key,weight]of Object.entries(weights)){roll-=weight;if(roll<0){rarity=key;break;}}
 const scale=1+Math.min(LAMP_CONFIG.maxOrdinal,Math.max(0,ordinal))*.08;
 const stats=Object.fromEntries(Object.entries(a.stats).map(([stat,value],i)=>[stat,Math.max(1,Math.round(value*scale*QUALITY[rarity]*(.8+.4*seededUnit(seed,sequence,i+2))))]));
 return {instanceId:`lamp:${seed}:${sequence}`,equipmentId:a.id,name:a.name,type:a.type,art:a.art,rarity,level:ordinal+1,stats,sequence,ordinal};
}
export function salvageValue(item){return Math.min(7,1+Object.keys(RARITIES).indexOf(item.rarity));}
export function createLampEconomy(seed,gold=0){return{version:5,partyEXP:0,gold:Math.max(0,Math.floor(gold)),items:[],loadouts:{},settledGoldRewards:[],lamp:{capacityTier:0,essence:0,seed:seed>>>0,sequence:0,pending:[],discarded:[],recent:[],salvage:{count:0,gold:0},autoEnabled:false,highestOrdinal:0,lastActivationAt:0},migration:{}};}
export function validateLampEconomy(data,version=5){
 const bad=()=>{throw new Error('Lamp save is invalid. Original data is preserved.');};
 if((version===5&&(!Number.isSafeInteger(data?.partyEXP)||data.partyEXP<0))||data?.version!==version||!Number.isSafeInteger(data.gold)||data.gold<0||!Array.isArray(data.items)||!data.loadouts||Array.isArray(data.loadouts)||!Array.isArray(data.settledGoldRewards))bad();
 const l=data.lamp;
 if(version===5&&(!l||!Number.isInteger(l.capacityTier)||l.capacityTier<0||l.capacityTier>=LAMP_CAPACITY_TIERS.length||!Number.isSafeInteger(l.essence)||l.essence<0))bad();
 if(!l||!Number.isInteger(l.seed)||l.seed<0||l.seed>4294967295||!Number.isSafeInteger(l.sequence)||l.sequence<0||!Number.isSafeInteger(l.highestOrdinal)||l.highestOrdinal<0||l.highestOrdinal>LAMP_CONFIG.maxOrdinal||!Number.isFinite(l.lastActivationAt)||typeof l.autoEnabled!=='boolean'||!Array.isArray(l.pending)||!Number.isSafeInteger(l.salvage?.count)||l.salvage.count<0||!Number.isSafeInteger(l.salvage.gold)||l.salvage.gold<0||l.pending.length>(version===5?lampCapacity(data):LAMP_CONFIG.capacity))bad();
 const ids=new Set();
 for(const i of data.items){if(!i||typeof i.instanceId!=='string'||!i.instanceId||typeof i.name!=='string'||!i.name||i.name.length>100||!Number.isSafeInteger(i.level)||i.level<1||i.level>LAMP_CONFIG.maxOrdinal+1||ids.has(i.instanceId)||!EQUIPMENT_SLOTS[i.type]||!RARITIES[i.rarity]||!i.stats||!Number.isInteger(i.art)||i.art<0||i.art>8||!Object.keys(i.stats).length||(version!==2&&(version===3?GEAR_STATS.filter(k=>k!=='HP'):GEAR_STATS).some(k=>!Object.hasOwn(i.stats,k)))||Object.entries(i.stats).some(([k,v])=>!(version===2?['HP','ATK','DEF','MAG','RES','SPD']:version===3?GEAR_STATS.filter(k=>k!=='HP'):GEAR_STATS).includes(k)||!Number.isSafeInteger(v)||v<0||v>100000))bad();ids.add(i.instanceId);}
 const assigned=new Set();
 const assign=id=>{if(!ids.has(id)||assigned.has(id))bad();assigned.add(id);};
 if(data.settledGoldRewards.some(id=>typeof id!=='string')||Object.keys(data.loadouts).some(id=>['__proto__','constructor','prototype'].includes(id)))bad();
 for(const slots of Object.values(data.loadouts)){if(!slots||Array.isArray(slots)||typeof slots!=='object')bad();for(const[slot,id]of Object.entries(slots)){if(!EQUIPMENT_SLOTS[slot]||data.items.find(i=>i.instanceId===id)?.type!==slot)bad();assign(id);}}
 if(l.recent!==undefined&&(!Array.isArray(l.recent)||l.recent.length>5||l.recent.some(i=>!i||typeof i.instanceId!=='string'||typeof i.name!=='string'||!RARITIES[i.rarity]||!Number.isInteger(i.art)||i.art<0||i.art>8||!Number.isSafeInteger(i.level)||i.level<1||i.level>LAMP_CONFIG.maxOrdinal+1)))bad();
 l.pending.forEach(assign);if(l.discarded!==undefined&&!Array.isArray(l.discarded))bad();(l.discarded||[]).forEach(assign);if(assigned.size!==ids.size)bad();return data;
}
export function migrateLampEconomy(old){validateLampEconomy(old,4);const next={...structuredClone(old),version:5,partyEXP:0};next.lamp.capacityTier=0;next.lamp.essence=0;if(next.lamp.pending.length>=LAMP_CONFIG.capacity)next.lamp.autoEnabled=false;return validateLampEconomy(next);}
export function lampAutoUnlocked(heroes){return heroes.length===4&&heroes.every(h=>h.currentLevel>=LAMP_CONFIG.autoUnlockLevel);}
export function migrateFourStatLamp(old){
 validateLampEconomy(old,3);const next=structuredClone(old);next.version=5;next.partyEXP=0;next.lamp.capacityTier=0;next.lamp.essence=0;if(next.lamp.pending.length>=LAMP_CONFIG.capacity)next.lamp.autoEnabled=false;
 for(const item of next.items)item.stats.HP=0;
 return validateLampEconomy(next);
}
export function migrateDraftLamp(old){
 validateLampEconomy(old,2);
 const next=structuredClone(old);next.version=5;next.partyEXP=0;next.lamp.capacityTier=0;next.lamp.essence=0;if(next.lamp.pending.length>=LAMP_CONFIG.capacity)next.lamp.autoEnabled=false;
 for(const i of next.items){
  const generated=Number.isInteger(i.sequence)&&Number.isInteger(i.ordinal)?generateLampItem(next.lamp.seed,i.sequence,i.ordinal):null;
  i.stats=Object.fromEntries(GEAR_STATS.map(k=>[k,i.stats[k]??(k==='HP'?0:generated?.stats[k]??0)]));
 }
 return validateLampEconomy(next);
}
export function migrateLegacyEquipment(old,seed){
 if(old?.version!==1||!Number.isSafeInteger(old.gold)||old.gold<0||!Array.isArray(old.items)||!old.loadouts||!Number.isInteger(old.market?.seed)||!Number.isFinite(old.market?.epoch)||!Number.isFinite(old.market?.lastSeen))throw new Error('Legacy equipment save is invalid. Original data is preserved.');
 const byId=new Map();for(const i of old.items){if(!EQUIPMENT[i.equipmentId]||typeof i.instanceId!=='string'||byId.has(i.instanceId))throw new Error('Legacy ownership is invalid.');byId.set(i.instanceId,i);}
 const next=createLampEconomy(seed,old.gold);next.migration.legacyVersion=1;next.settledGoldRewards=Array.isArray(old.settledGoldRewards)?old.settledGoldRewards.filter(x=>typeof x==='string'):[];
 const kept=new Set();
 for(const[hero,slots]of Object.entries(old.loadouts)){
  if(!slots||Array.isArray(slots)||typeof slots!=='object')throw new Error('Legacy loadout is invalid.');
  for(const[slot,id]of Object.entries(slots)){
   if(!byId.has(id))throw new Error('Legacy equipped item is missing.');
   const d=EQUIPMENT[byId.get(id).equipmentId],type={head:'hat',armor:'body',boots:'boots'}[slot];
   if(!type)continue;if(d.type!==slot||kept.has(id))throw new Error('Legacy assignment is invalid.');
   const art=GEAR_ARCHETYPES.find(a=>a.type===type)?.art||0;
   next.items.push({instanceId:id,equipmentId:d.id,name:d.name,type,rarity:d.rarity,stats:Object.fromEntries(GEAR_STATS.map(k=>[k,d.stats[k]||0])),art,level:1});(next.loadouts[hero]||={})[type]=id;kept.add(id);
  }
 }
 let salvage=0;for(const i of old.items)if(!kept.has(i.instanceId))salvage+=salvageValue(EQUIPMENT[i.equipmentId]);next.gold+=salvage;next.migration.salvageGold=salvage;return validateLampEconomy(next);
}
export function lampStoredCount(data){return data.lamp.pending.length+(data.lamp.discarded?.length||0)+data.lamp.salvage.count;}
export function lampCooldownRemaining(data,now){return data.lamp.sequence?Math.max(0,data.lamp.lastActivationAt+LAMP_CONFIG.minEmissionIntervalMs-now):0;}
export function activateLamp(data,context,now){
 const l=data.lamp;if(lampStoredCount(data)>=lampCapacity(data))throw new Error('Collection full. Review your gear to make room.');
 if(lampCooldownRemaining(data,now)>0)throw new Error('The lamp is preparing its next emission.');
 l.highestOrdinal=Math.max(l.highestOrdinal,progressionOrdinal(context));const item=generateLampItem(l.seed,l.sequence,l.highestOrdinal,LAMP_CAPACITY_TIERS[l.capacityTier].rarityWeights);
 l.recent=[...(l.recent||[]),structuredClone(item)].slice(-5);data.partyEXP+=LAMP_CONFIG.drawEXP;l.sequence++;l.lastActivationAt=now;data.items.push(item);l.pending.push(item.instanceId);if(lampStoredCount(data)>=lampCapacity(data))l.autoEnabled=false;return item;
}
export function compareLampItem(data,item,heroId){
 const current=equipmentDefinition(data.items.find(i=>i.instanceId===data.loadouts[heroId]?.[item.type]));
 return{heroId,current,upgrade:isEquipmentUpgrade(item,current),deltas:Object.fromEntries(GEAR_STATS.map(k=>[k,(item.stats[k]||0)-(current?.stats[k]||0)]))};
}
export function lampItemCPGain(data,item,hero){
 const loadout=data.loadouts[hero.heroInstanceKey]||{};
 const before=refreshHeroStats({...hero,equipmentStats:equipmentStats(data.items,loadout)});
 const items=data.items.some(i=>i.instanceId===item.instanceId)?data.items:[...data.items,item];
 const after=refreshHeroStats({...hero,equipmentStats:equipmentStats(items,{...loadout,[item.type]:item.instanceId})});
 return Math.round((computeCombatPower(after)-computeCombatPower(before))*10)/10;
}
export const lampGearCP=item=>item?computeCombatPower({stats:item.stats,level:1}):0;
export function sortedLampItems(data,ids=data.lamp.pending){return ids.map(id=>data.items.find(i=>i.instanceId===id)).sort((a,b)=>lampGearCP(b)-lampGearCP(a)||(a.sequence??0)-(b.sequence??0)||a.instanceId.localeCompare(b.instanceId));}
export function selectLampUpgrades(data,heroes){return sortedLampItems(data).filter(i=>heroes.some(h=>lampGearCP(i)>lampGearCP(data.items.find(x=>x.instanceId===data.loadouts[h.heroInstanceKey]?.[i.type])))).slice(0,4);}
export function selectAutoEquipHero(data,item,heroes){
 let best=null,bestGain=0,bestMaxHP=Infinity;
 for(const hero of heroes){
  const current=data.items.find(i=>i.instanceId===data.loadouts[hero.heroInstanceKey]?.[item.type]);
  const gain=lampGearCP(item)-lampGearCP(current),maxHP=hero.maxHP??refreshHeroStats({...hero,equipmentStats:equipmentStats(data.items,data.loadouts[hero.heroInstanceKey])}).maxHP;
  if(gain>0&&lampItemCPGain(data,item,hero)>0&&(gain>bestGain||(gain===bestGain&&maxHP<bestMaxHP))){best=hero.heroInstanceKey;bestGain=gain;bestMaxHP=maxHP;}
 }
 return best;
}
export function finishLampReview(data){(data.lamp.discarded||=[]).push(...data.lamp.pending);data.lamp.pending=[];return data.lamp.discarded.length;}
export function equipLampItem(data,heroId,id){
 if(!data.lamp.pending.includes(id))throw new Error('This result is no longer available.');
 const item=data.items.find(i=>i.instanceId===id);if(!item)throw new Error('Item missing.');
 const slots=data.loadouts[heroId]||={};const previous=slots[item.type];if(previous)(data.lamp.discarded||=[]).push(previous);
 slots[item.type]=id;data.lamp.pending=data.lamp.pending.filter(x=>x!==id);return item;
}
export function dismantleLampItems(data,expectedIds){
 const ids=[...data.lamp.pending.filter(id=>expectedIds.includes(id)),...(data.lamp.discarded||[]),'salvage:'+data.lamp.salvage.count+':'+data.lamp.salvage.gold];
 if(ids.length!==expectedIds.length||ids.some(id=>!expectedIds.includes(id)))throw new Error('Collection changed. Review the updated dismantling return.');
 const stored=ids.slice(0,-1);const count=stored.length+data.lamp.salvage.count;const total=stored.reduce((sum,id)=>sum+salvageValue(data.items.find(i=>i.instanceId===id)),0)+data.lamp.salvage.gold;
 data.lamp.essence+=total;const removed=new Set(ids);data.items=data.items.filter(i=>!removed.has(i.instanceId));data.lamp.pending=data.lamp.pending.filter(id=>!removed.has(id));data.lamp.discarded=[];data.lamp.salvage={count:0,gold:0};return{count,essence:total};
}
