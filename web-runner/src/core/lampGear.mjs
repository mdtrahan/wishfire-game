import {EQUIPMENT,RARITIES,EQUIPMENT_SLOTS,equipmentDefinition,equipmentStats,isEquipmentUpgrade} from './equipment.mjs';
import {refreshHeroStats} from './heroProgression.mjs';
import {formatCompactCount} from './formatCompactCount.mjs';
import {computeCombatPower} from './combatPower.mjs';

export const LAMP_CONFIG=Object.freeze({capacity:20,drawEXP:0,minEmissionIntervalMs:2000,autoIntervalMs:5000,autoUnlockLevel:5,maxOrdinal:990,mapStatGrowth:.005,lampLevels:100,upgradeCostBase:100,upgradeCostLinear:200,upgradeCostQuad:-10,upgradeCostCubic:5.35,upgradeCostWave:.04,upgradeCostPeriod:10,upgradeCostRound:25,upgradeCostCapacityFloor:5,killReceiptDomains:64,tickSeconds:15,tickPoints:1,bossKillPoints:5,});
export function lampTierUpgradeCost(n,capacity){
 if(n===LAMP_CONFIG.lampLevels-1)return null;
 const c=LAMP_CONFIG,trend=c.upgradeCostBase+c.upgradeCostLinear*n+c.upgradeCostQuad*n**2+c.upgradeCostCubic*n**3;
 const wave=1+c.upgradeCostWave*Math.sin(2*Math.PI*n/c.upgradeCostPeriod),unit=c.upgradeCostRound;
 return Math.max(Math.round(trend*wave/unit)*unit,Math.ceil(c.upgradeCostCapacityFloor*capacity/unit)*unit);
}
export const LAMP_GUIDE=Object.freeze({storage:1,comparison:2,preview:4});
export function markLampGuide(data,step){if(!Object.hasOwn(LAMP_GUIDE,step))throw new Error('Unknown lamp guide step.');if(step!=='preview'&&!lampStoredCount(data)&&!data.lamp.reviewHold)throw new Error('Open stored equipment first.');if(step==='comparison'&&!data.lamp.pending.length&&!data.lamp.discarded?.length&&!data.lamp.reviewHold)throw new Error('Choose equipment first.');return data.lamp.guide=(data.lamp.guide||0)|LAMP_GUIDE[step];}
export const LAMP_CAPACITY_TIERS=Object.freeze(Array.from({length:LAMP_CONFIG.lampLevels},(_,n)=>{
 const p=n/(LAMP_CONFIG.lampLevels-1),round=v=>Math.round(v*1000)/1000;
 const rarityWeights={common:0,uncommon:round(25+10*p),rare:round(30*p),epic:round(14*p),legendary:round(p)};
 rarityWeights.common=round(100-rarityWeights.uncommon-rarityWeights.rare-rarityWeights.epic-rarityWeights.legendary);
 const capacity=LAMP_CONFIG.capacity+Math.round(10*n**1.5);
 return Object.freeze({capacity,cost:lampTierUpgradeCost(n,capacity),rarityWeights:Object.freeze(rarityWeights)});
}));
export const lampCapacity=data=>LAMP_CAPACITY_TIERS[data.lamp.capacityTier||0].capacity;
export const lampUpgradeCost=data=>LAMP_CAPACITY_TIERS[data.lamp.capacityTier].cost;
export const lampKillPoints=data=>Number.isSafeInteger(data.lamp.killPoints)&&data.lamp.killPoints>=0?data.lamp.killPoints:0;
export const enemyBagKillPoints=actor=>String(actor.enemyRole||actor.role||'').toLowerCase()==='boss'?LAMP_CONFIG.bossKillPoints:0;
// Partial seconds stay in memory; completed indices recover from the saved
// equipment receipts or HeroProgress outbox after reload.
export function advanceLampCombatProgress(clock,{battleId,seconds,data,pending={}}){
 if(!battleId||!data?.lamp||lampUpgradeCost(data)===null||!Number.isFinite(seconds)||seconds<=0)return{clock:null,rewards:[]};
 const domain=`tick:${battleId}`;
 if(clock?.battleId!==battleId){
  let index=data.settledBagKillRewards?.[domain]?.at(-1)?.[1]||0;
  for(const id of Object.keys(pending))if(id.startsWith(domain+':')){
   const n=Number(id.slice(domain.length+1));if(Number.isSafeInteger(n)&&n>index)index=n;
  }
  clock={battleId,index,seconds:clock?.seconds||0};
 }
 const elapsed=clock.seconds+seconds,count=Math.floor((elapsed+1e-9)/LAMP_CONFIG.tickSeconds),index=clock.index+count;
 if(!Number.isSafeInteger(index))throw new Error('Bag tick index exceeds the safe save limit.');
 return{clock:{battleId,index,seconds:Math.max(0,elapsed-count*LAMP_CONFIG.tickSeconds)},rewards:Array.from({length:count},(_,n)=>({id:`${domain}:${clock.index+n+1}`,amount:LAMP_CONFIG.tickPoints}))};
}
function trimKillReceiptDomains(receipts){
 for(const domain of Object.keys(receipts).slice(0,-LAMP_CONFIG.killReceiptDomains))delete receipts[domain];
}
export function awardLampKillPoints(data,id,amount){
 const split=typeof id==='string'?id.lastIndexOf(':'):-1,session=id?.slice?.(0,split),uid=Number(id?.slice?.(split+1));
 if(!/^(enemy|tick):/.test(session||'')||session.length>164||id.length>180||!Number.isSafeInteger(uid)||uid<1||String(uid)!==id.slice(split+1)||![LAMP_CONFIG.tickPoints,LAMP_CONFIG.bossKillPoints].includes(amount))throw new Error('Invalid Bag progress receipt.');
 const receipts=data.settledBagKillRewards||{},ranges=receipts[session]||[];
 if(ranges.some(([lo,hi])=>uid>=lo&&uid<=hi))return{applied:false,duplicate:true};
 if(lampUpgradeCost(data)===null)return{applied:false,max:true};
 const total=lampKillPoints(data)+amount;
 if(!Number.isSafeInteger(total))throw new Error('Bag progress points exceed the safe save limit.');
 // Coalesce adjacent KO UIDs within each battle. Recovery can reset actor
 // numbers, so each later battle retains its own receipt domain.
 const merged=[];
 for(const[lo,hi]of [...ranges,[uid,uid]].sort((a,b)=>a[0]-b[0])){
  const last=merged.at(-1);
  if(last&&lo<=last[1]+1)last[1]=Math.max(last[1],hi);else merged.push([lo,hi]);
 }
 data.lamp.killPoints=total;(data.settledBagKillRewards||={})[session]=merged;
 trimKillReceiptDomains(data.settledBagKillRewards);
 return{applied:true,killPoints:total};
}
export function lampUpgradeProgress(data){
 const required=lampUpgradeCost(data),current=lampKillPoints(data)+data.lamp.essence;
 return{current,required,max:required===null,fraction:required===null?1:Math.min(1,current/required)};
}
// Import supported paid-stage saves once; new records never write stages or deadlines.
export function restorePaidLampUpgrade(data){
 const l=data.lamp;
 if(!Object.hasOwn(l,'upgradeStage')&&!Object.hasOwn(l,'upgradeEndsAt'))return false;
 const paid=Math.floor((lampUpgradeCost(data)||0)*(l.upgradeStage||0)/4);
 if(!Number.isSafeInteger(l.essence+paid))throw new Error('Bag progress exceeds the safe save limit. Original data is preserved.');
 l.essence+=paid;delete l.upgradeStage;delete l.upgradeEndsAt;
 return true;
}
export function upgradeLamp(data,expectedTier=data.lamp.capacityTier){
 const l=data.lamp;
 if(l.capacityTier!==expectedTier)throw new Error('Bag level changed. Review the updated upgrade.');
 const cost=lampUpgradeCost(data);
 if(cost===null)throw new Error('Bag is fully upgraded.');
 const points=lampKillPoints(data),current=points+l.essence;
 if(current<cost)throw new Error('Need '+formatCompactCount(cost-current)+' more Bag progress.');
 const before=l.capacityTier;
 const spentPoints=Math.min(points,cost);
 l.killPoints=points-spentPoints;l.essence-=cost-spentPoints;l.capacityTier++;
 return{levelBefore:before+1,levelAfter:l.capacityTier+1,capacityBefore:LAMP_CAPACITY_TIERS[before].capacity,capacityAfter:lampCapacity(data),cost};
}
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
 const scale=1+Math.min(LAMP_CONFIG.maxOrdinal,Math.max(0,ordinal))*LAMP_CONFIG.mapStatGrowth;
 const rarityFloor=(type,stat,tier)=>{
  const archetypes=GEAR_ARCHETYPES.filter(entry=>entry.type===type),maxBase=Math.max(...archetypes.map(entry=>entry.stats[stat]||0));
  const priorQuality=tier==='epic'?QUALITY.rare:QUALITY.epic;
  const priorEnvelope=Math.ceil(maxBase*scale*priorQuality*1.2);
  if(tier==='epic')return priorEnvelope+1;
  const epicEnvelope=Math.max(priorEnvelope+1,...archetypes.map(entry=>Math.ceil((entry.stats[stat]||0)*scale*QUALITY.epic*1.2)));
  return epicEnvelope+1;
 };
 const stats=Object.fromEntries(Object.entries(a.stats).map(([stat,value],i)=>{
  const rolled=Math.max(1,Math.round(value*scale*QUALITY[rarity]*(.8+.4*seededUnit(seed,sequence,i+2))));
  return[stat,rarity==='epic'||rarity==='legendary'?Math.max(rolled,rarityFloor(a.type,stat,rarity)):rolled];
 }));
 return {instanceId:`lamp:${seed}:${sequence}`,equipmentId:a.id,name:a.name,type:a.type,art:a.art,rarity,level:ordinal+1,stats,sequence,ordinal};
}
export function salvageValue(item){return Math.min(7,1+Object.keys(RARITIES).indexOf(item.rarity));}
export function createLampEconomy(seed,gold=0){return{version:5,partyEXP:0,gold:Math.max(0,Math.floor(gold)),items:[],loadouts:{},settledGoldRewards:[],lamp:{capacityTier:0,essence:0,killPoints:0,seed:seed>>>0,sequence:0,pending:[],discarded:[],recent:[],salvage:{count:0,gold:0},autoEnabled:false,highestOrdinal:0,lastActivationAt:0},migration:{}};}
export function validateLampEconomy(data,version=5){
 const bad=()=>{throw new Error('Lamp save is invalid. Original data is preserved.');};
 if((version===5&&(!Number.isSafeInteger(data?.partyEXP)||data.partyEXP<0))||data?.version!==version||!Number.isSafeInteger(data.gold)||data.gold<0||!Array.isArray(data.items)||!data.loadouts||Array.isArray(data.loadouts)||!Array.isArray(data.settledGoldRewards))bad();
 const l=data.lamp;
 if(l?.guide!==undefined&&(!Number.isInteger(l.guide)||l.guide<0||l.guide>7))bad();
 if(l?.upgradeStage!==undefined&&(!Number.isInteger(l.upgradeStage)||l.upgradeStage<0||l.upgradeStage>4||l.capacityTier===LAMP_CONFIG.lampLevels-1&&l.upgradeStage!==0))bad();
 if(l?.upgradeEndsAt!==undefined&&(!Number.isSafeInteger(l.upgradeEndsAt)||l.upgradeEndsAt<0||l.upgradeEndsAt>0&&(l.upgradeStage!==4||l.capacityTier>=LAMP_CONFIG.lampLevels-1)))bad();
 if(l?.speedUpTickets!==undefined&&(!Number.isSafeInteger(l.speedUpTickets)||l.speedUpTickets<0))bad();
 if(version===5&&(!l||!Number.isInteger(l.capacityTier)||l.capacityTier<0||l.capacityTier>=LAMP_CAPACITY_TIERS.length||!Number.isSafeInteger(l.essence)||l.essence<0))bad();
 if(!l||!Number.isInteger(l.seed)||l.seed<0||l.seed>4294967295||!Number.isSafeInteger(l.sequence)||l.sequence<0||!Number.isSafeInteger(l.highestOrdinal)||l.highestOrdinal<0||l.highestOrdinal>LAMP_CONFIG.maxOrdinal||!Number.isFinite(l.lastActivationAt)||typeof l.autoEnabled!=='boolean'||!Array.isArray(l.pending)||!Number.isSafeInteger(l.salvage?.count)||l.salvage.count<0||!Number.isSafeInteger(l.salvage.gold)||l.salvage.gold<0||l.pending.length>(version===5?lampCapacity(data):LAMP_CONFIG.capacity))bad();
 if(version===5)l.killPoints=lampKillPoints(data);
 if(data.settledBagKillRewards!==undefined){
  const receipts=data.settledBagKillRewards;
  if(!receipts||typeof receipts!=='object'||Array.isArray(receipts))bad();
  for(const[session,ranges]of Object.entries(receipts)){
   if(!/^(enemy|tick):/.test(session)||session.length>164||!Array.isArray(ranges)||ranges.some((range,i)=>!Array.isArray(range)||range.length!==2||range.some(n=>!Number.isSafeInteger(n)||n<1)||range[0]>range[1]||i>0&&range[0]<=ranges[i-1][1]+1))bad();
  }
  trimKillReceiptDomains(receipts);
 }
 const ids=new Set();
 for(const i of data.items){if(!i||typeof i.instanceId!=='string'||!i.instanceId||typeof i.name!=='string'||!i.name||i.name.length>100||!Number.isSafeInteger(i.level)||i.level<1||i.level>LAMP_CONFIG.maxOrdinal+1||ids.has(i.instanceId)||!EQUIPMENT_SLOTS[i.type]||!RARITIES[i.rarity]||!i.stats||!Number.isInteger(i.art)||i.art<0||i.art>8||!Object.keys(i.stats).length||(version!==2&&(version===3?GEAR_STATS.filter(k=>k!=='HP'):GEAR_STATS).some(k=>!Object.hasOwn(i.stats,k)))||Object.entries(i.stats).some(([k,v])=>!(version===2?['HP','ATK','DEF','MAG','RES','SPD']:version===3?GEAR_STATS.filter(k=>k!=='HP'):GEAR_STATS).includes(k)||!Number.isSafeInteger(v)||v<0||v>100000))bad();ids.add(i.instanceId);}
 const assigned=new Set();
 const assign=id=>{if(!ids.has(id)||assigned.has(id))bad();assigned.add(id);};
 if(data.settledGoldRewards.some(id=>typeof id!=='string')||Object.keys(data.loadouts).some(id=>['__proto__','constructor','prototype'].includes(id)))bad();
 for(const slots of Object.values(data.loadouts)){if(!slots||Array.isArray(slots)||typeof slots!=='object')bad();for(const[slot,id]of Object.entries(slots)){if(!EQUIPMENT_SLOTS[slot]||data.items.find(i=>i.instanceId===id)?.type!==slot)bad();assign(id);}}
 if(l.recent!==undefined&&(!Array.isArray(l.recent)||l.recent.length>5||l.recent.some(i=>!i||typeof i.instanceId!=='string'||typeof i.name!=='string'||!RARITIES[i.rarity]||!Number.isInteger(i.art)||i.art<0||i.art>8||!Number.isSafeInteger(i.level)||i.level<1||i.level>LAMP_CONFIG.maxOrdinal+1)))bad();
 l.pending.forEach(assign);if(l.discarded!==undefined&&!Array.isArray(l.discarded))bad();(l.discarded||[]).forEach(assign);if(assigned.size!==ids.size)bad();return data;
}
export function migrateLampEconomy(old){validateLampEconomy(old,4);const next={...structuredClone(old),version:5,partyEXP:0};next.lamp.capacityTier=0;next.lamp.essence=0;return validateLampEconomy(next);}
export function lampAutoUnlocked(heroes){return heroes.length===4&&heroes.every(h=>h.currentLevel>=LAMP_CONFIG.autoUnlockLevel);}
export function migrateFourStatLamp(old){
 validateLampEconomy(old,3);const next=structuredClone(old);next.version=5;next.partyEXP=0;next.lamp.capacityTier=0;next.lamp.essence=0;
 for(const item of next.items)item.stats.HP=0;
 return validateLampEconomy(next);
}
export function migrateDraftLamp(old){
 validateLampEconomy(old,2);
 const next=structuredClone(old);next.version=5;next.partyEXP=0;next.lamp.capacityTier=0;next.lamp.essence=0;
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
 l.recent=[...(l.recent||[]),structuredClone(item)].slice(-5);l.sequence++;l.lastActivationAt=now;data.items.push(item);l.pending.push(item.instanceId);return item;
}
export function compareLampItem(data,item,heroId){
 const current=equipmentDefinition(data.items.find(i=>i.instanceId===data.loadouts[heroId]?.[item.type]));
 return{heroId,current,upgrade:isEquipmentUpgrade(item,current),deltas:Object.fromEntries(GEAR_STATS.map(k=>[k,(item.stats[k]||0)-(current?.stats[k]||0)]))};
}
function lampHeroCP(data,hero){
 const loadout=data.loadouts[hero.heroInstanceKey]||{};
 return computeCombatPower(refreshHeroStats({...hero,equipmentStats:equipmentStats(data.items,loadout)}));
}
export function lampItemCPGain(data,item,hero){
 const loadout=data.loadouts[hero.heroInstanceKey]||{};
 const before=refreshHeroStats({...hero,equipmentStats:equipmentStats(data.items,loadout)});
 const items=data.items.some(i=>i.instanceId===item.instanceId)?data.items:[...data.items,item];
 const after=refreshHeroStats({...hero,equipmentStats:equipmentStats(items,{...loadout,[item.type]:item.instanceId})});
 return Math.round((computeCombatPower(after)-computeCombatPower(before))*10)/10;
}
export const lampGearCP=item=>item?computeCombatPower({stats:item.stats,level:1}):0;
export function sortedLampItems(data,ids=data.lamp.pending){
 const items=new Map(data.items.map(item=>[item.instanceId,item])),rarities=Object.keys(RARITIES);
 return ids.map(id=>items.get(id)).sort((a,b)=>rarities.indexOf(b.rarity)-rarities.indexOf(a.rarity)||lampGearCP(b)-lampGearCP(a)||(a.sequence??0)-(b.sequence??0)||a.instanceId.localeCompare(b.instanceId));
}
export function lampReviewCandidates(data,heroes){
 const queues=new Map();for(const id of data.lamp.pending)queues.set(id,'pending');for(const id of data.lamp.discarded||[])queues.set(id,'discarded');
 return sortedLampItems(data,[...queues.keys()]).map(item=>{
  const gains=heroes.map(hero=>({heroId:hero.heroInstanceKey,cpGain:lampItemCPGain(data,item,hero)}));
  const bestHeroId=selectAutoEquipHero(data,item,heroes),best=gains.find(gain=>gain.heroId===bestHeroId)||{heroId:null,cpGain:0};
  return{item,queue:queues.get(item.instanceId),gains,bestGain:best.cpGain,bestHeroId:best.heroId};
 }).sort((a,b)=>b.bestGain-a.bestGain);
}
export function selectLampUpgrades(data,heroes){return lampReviewCandidates(data,heroes).filter(candidate=>candidate.bestGain>0).map(candidate=>candidate.item);}
export function selectAutoEquipHero(data,item,heroes){
 let best=null,bestGain=0,bestHeroCP=Infinity;
 for(const hero of heroes){
  const gain=lampItemCPGain(data,item,hero);if(gain<=0)continue;
  const heroCP=lampHeroCP(data,hero);
  if(gain>bestGain||(gain===bestGain&&heroCP<bestHeroCP)){best=hero.heroInstanceKey;bestGain=gain;bestHeroCP=heroCP;}
 }
 return best;
}
// Closing review never changes item ownership or routes a batch to disposal.
export function finishLampReview(data){return lampStoredCount(data);}
export function equipLampItem(data,heroId,id,hero){
 const pending=data.lamp.pending.includes(id),discarded=(data.lamp.discarded||[]).includes(id);
 if(!pending&&!discarded)throw new Error('This result is no longer available.');
 const item=data.items.find(i=>i.instanceId===id);if(!item)throw new Error('Item missing.');
 if(!hero||hero.heroInstanceKey!==heroId)throw new Error('Current hero is required before equipping.');
 if(lampItemCPGain(data,item,hero)<=0)throw new Error('This equipment does not increase this hero CP.');
 const slots=data.loadouts[heroId]||={};const previous=slots[item.type];if(previous)data.items=data.items.filter(entry=>entry.instanceId!==previous);
 slots[item.type]=id;data.lamp.pending=data.lamp.pending.filter(x=>x!==id);data.lamp.discarded=(data.lamp.discarded||[]).filter(x=>x!==id);return item;
}
export function planLampAutoEquip(data,heroes){
 const working=structuredClone(data);
 const before=new Map(heroes.map(hero=>[hero.heroInstanceKey,lampHeroCP(data,hero)])),changed=new Map();
 while(true){
  const candidate=lampReviewCandidates(working,heroes).find(c=>c.bestGain>0);if(!candidate)break;
  const {item,bestHeroId:heroId}=candidate;
  equipLampItem(working,heroId,item.instanceId,heroes.find(h=>h.heroInstanceKey===heroId));
  const change=changed.get(heroId)||{heroId,slots:[],itemsBySlot:new Map(),processedItems:[]};
  if(!change.itemsBySlot.has(item.type))change.slots.push(item.type);
  change.itemsBySlot.set(item.type,item);change.processedItems.push(item);changed.set(heroId,change);
 }
 const changes=heroes.filter(hero=>changed.has(hero.heroInstanceKey)).map(hero=>{
  const heroId=hero.heroInstanceKey,change=changed.get(heroId),cpBefore=before.get(heroId),cpAfter=lampHeroCP(working,hero);
  return{heroId,slots:change.slots,items:change.slots.map(slot=>change.itemsBySlot.get(slot)),processedItems:change.processedItems,cpBefore,cpAfter,cpChange:Math.round((cpAfter-cpBefore)*10)/10};
 });
 return{items:working.items,loadouts:working.loadouts,pending:working.lamp.pending,discarded:working.lamp.discarded,changes};
}
export function dismantleLampItems(data,expectedIds,heroes){
 if(!Array.isArray(heroes)||!heroes.length)throw new Error('Current heroes are required before dismantling.');
 if(lampReviewCandidates(data,heroes).some(c=>expectedIds.includes(c.item.instanceId)&&c.bestGain>0))throw new Error('Equipment still improves a hero. Equip upgrades before dismantling.');
 const ids=[...data.lamp.pending.filter(id=>expectedIds.includes(id)),...(data.lamp.discarded||[]),'salvage:'+data.lamp.salvage.count+':'+data.lamp.salvage.gold];
 if(ids.length!==expectedIds.length||ids.some(id=>!expectedIds.includes(id)))throw new Error('Collection changed. Review the updated dismantling return.');
 const stored=ids.slice(0,-1);const count=stored.length+data.lamp.salvage.count;const total=stored.reduce((sum,id)=>sum+salvageValue(data.items.find(i=>i.instanceId===id)),0)+data.lamp.salvage.gold;
 data.lamp.essence+=total;const removed=new Set(ids);data.items=data.items.filter(i=>!removed.has(i.instanceId));data.lamp.pending=data.lamp.pending.filter(id=>!removed.has(id));data.lamp.discarded=[];data.lamp.salvage={count:0,gold:0};return{count,essence:total};
}
