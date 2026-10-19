import {LAMP_CONFIG,LAMP_CAPACITY_TIERS,createLampEconomy,validateLampEconomy,generateLampItem,progressionOrdinal,lampCooldownRemaining,lampStoredCount,lampCapacity,lampReviewCandidates,lampItemCPGain,selectAutoEquipHero,equipLampItem,salvageValue} from './lampGear.mjs';

export const CONVEYOR_TRAVEL_MS = 28000;
export function conveyorItemAge(lamp,emission,now,activeMs=lamp.conveyorActiveMs){
 return Math.max(0,emission.issuedActiveMs===undefined?now-emission.issuedAt:activeMs-emission.issuedActiveMs);
}
export function validateConveyorState(data){
 validateLampEconomy(data);
 const l=data.lamp,bad=()=>{throw new Error('Lamp conveyor save is invalid. Original data is preserved.');};
 const check=item=>{const sample=createLampEconomy(l.seed);sample.items=[item];sample.lamp.pending=[item?.instanceId];validateLampEconomy(sample);};
 if(lampStoredCount(data)>lampCapacity(data))bad();
 if(l.conveyorActiveMs!==undefined&&(!Number.isSafeInteger(l.conveyorActiveMs)||l.conveyorActiveMs<0))bad();
 if(l.emissions!==undefined){
  if(!Array.isArray(l.emissions)||l.emissions.length>16)bad();
  const ids=new Set();
  for(const e of l.emissions){if(!e||!Number.isSafeInteger(e.issuedAt)||e.issuedAt<0||typeof e.collected!=='boolean'||!Number.isSafeInteger(e.item?.sequence)||e.item.sequence>=l.sequence||e.item.instanceId!==`lamp:${l.seed}:${e.item.sequence}`||ids.has(e.item.instanceId))bad();if(e.issuedActiveMs!==undefined&&(!Number.isSafeInteger(e.issuedActiveMs)||e.issuedActiveMs<0||l.conveyorActiveMs===undefined||e.issuedActiveMs>l.conveyorActiveMs))bad();check(e.item);ids.add(e.item.instanceId);}
 }
 if(l.reviewHold){check(l.reviewHold.item);if(typeof l.reviewHold.disposal!=='boolean'||data.items.some(i=>i.instanceId===l.reviewHold.item.instanceId))bad();}
 if(l.disposalRequested!==undefined&&(!Array.isArray(l.disposalRequested)||new Set(l.disposalRequested).size!==l.disposalRequested.length||l.disposalRequested.some(id=>![...l.pending,...(l.discarded||[]),l.reviewHold?.item.instanceId].includes(id))))bad();
 if(data.pendingGearCollections!==undefined){
  if(!Array.isArray(data.pendingGearCollections)||data.pendingGearCollections.length>4096)bad();
  const ids=new Set();
  for(const event of data.pendingGearCollections){if(!event||typeof event.id!=='string'||event.id!==event.item?.instanceId||ids.has(event.id))bad();check(event.item);ids.add(event.id);}
 }
 return data;
}
export function conveyorReviewCandidates(data,heroes){
 const virtual={...data,items:[...data.items],lamp:{...data.lamp,pending:[...data.lamp.pending]}};
 if(data.lamp.reviewHold){virtual.items.push(data.lamp.reviewHold.item);virtual.lamp.pending.push(data.lamp.reviewHold.item.instanceId);}
 return lampReviewCandidates(virtual,heroes).map(c=>({...c,queue:c.item.instanceId===data.lamp.reviewHold?.item.instanceId?'held':c.queue}));
}
export function classifyConveyorCache(data,heroes){
 const l=data.lamp;
 // A manually protected item gets the first freed slot before another AUTO draw.
 if(l.reviewHold&&lampStoredCount(data)<lampCapacity(data)){
  data.items.push(l.reviewHold.item);l.pending.push(l.reviewHold.item.instanceId);l.reviewHold=null;
 }
 const candidates=conveyorReviewCandidates(data,heroes),requested=new Set((l.disposalRequested||[]).filter(id=>candidates.some(c=>c.item.instanceId===id&&c.bestGain<=0)));
 if(l.disposalRequested!==undefined)l.disposalRequested=[...requested].filter(id=>candidates.some(c=>c.item.instanceId===id));
 l.pending=candidates.filter(c=>c.queue!=='held'&&c.bestGain>0&&!requested.has(c.item.instanceId)).map(c=>c.item.instanceId);
 l.discarded=candidates.filter(c=>c.queue!=='held'&&(c.bestGain<=0||requested.has(c.item.instanceId))).map(c=>c.item.instanceId);
 return candidates;
}
export function emitConveyorItem(data,context,now){
 if(lampCooldownRemaining(data,now)>0)throw new Error('The lamp is preparing its next emission.');
 const l=data.lamp;l.highestOrdinal=Math.max(l.highestOrdinal,progressionOrdinal(context));
 const item=generateLampItem(l.seed,l.sequence,l.highestOrdinal,LAMP_CAPACITY_TIERS[l.capacityTier].rarityWeights);
 l.sequence++;l.lastActivationAt=now;
 l.emissions=[...(l.emissions||[]),{item,issuedAt:now,...(l.conveyorActiveMs===undefined?{}:{issuedActiveMs:l.conveyorActiveMs}),collected:false}].slice(-16);
 return item;
}
export function collectConveyorItem(data,id,now,{automatic=false}={}){
 const l=data.lamp,e=l.emissions?.find(e=>e.item.instanceId===id);
 const owned=data.items.find(i=>i.instanceId===id)||l.reviewHold?.item;
 if(owned?.instanceId===id)return{item:owned,saved:false,exp:0,held:l.reviewHold?.item.instanceId===id};
 if(!e||e.collected||conveyorItemAge(l,e,now)>=CONVEYOR_TRAVEL_MS)throw new Error('That item has passed. Review the cache for collected equipment.');
 if(lampStoredCount(data)>=lampCapacity(data)){
  if(automatic)return{item:e.item,saved:false,exp:0,held:false};
  if(l.reviewHold)throw new Error('Resolve the held item first: equip it or confirm its disposal.');
  l.reviewHold={item:structuredClone(e.item),disposal:false};
 }else{data.items.push(structuredClone(e.item));l.pending.push(id);}
 e.collected=true;
 return{item:e.item,saved:true,exp:0,held:l.reviewHold?.item.instanceId===id};
}
export function equipConveyorItem(data,heroId,id,hero){
 const l=data.lamp,item=data.items.find(i=>i.instanceId===id)||l.reviewHold?.item;
 if(!hero||hero.heroInstanceKey!==heroId||!item||lampItemCPGain(data,item,hero)<=0)throw new Error('This equipment does not increase this hero CP.');
 if(l.reviewHold?.item.instanceId===id){
  data.items.push(l.reviewHold.item);l.pending.push(id);l.reviewHold=null;
 }
 return equipLampItem(data,heroId,id,hero);
}
export function queueConveyorDisposal(data,id,heroes){
 conveyorDisposalPreview(data,heroes,[id]);
 if(![...data.lamp.pending,...(data.lamp.discarded||[]),data.lamp.reviewHold?.item.instanceId].includes(id))throw new Error('Equipment is no longer available.');
 data.lamp.disposalRequested=[...new Set([...(data.lamp.disposalRequested||[]),id])];
 if(data.lamp.reviewHold?.item.instanceId===id)data.lamp.reviewHold.disposal=true;
}
export function planConveyorAutoEquip(data,heroes){
 const working=structuredClone(data),changes=[];
 // Every assignment changes the next candidate/recipient comparison.
 while(true){
  const candidate=conveyorReviewCandidates(working,heroes).find(c=>c.bestGain>0);if(!candidate)break;
  const {item,bestHeroId:heroId}=candidate;
  equipConveyorItem(working,heroId,item.instanceId,heroes.find(h=>h.heroInstanceKey===heroId));classifyConveyorCache(working,heroes);
  changes.push({heroId,item});
 }
 return{working,changes};
}
export function conveyorDisposalPreview(data,heroes,ids){
 if(!Array.isArray(heroes)||!heroes.length)throw new Error('Current heroes are required before dismantling.');
 const candidates=conveyorReviewCandidates(data,heroes);
 const selected=ids||candidates.filter(c=>c.bestGain<=0).map(c=>c.item.instanceId);
 if(candidates.some(c=>selected.includes(c.item.instanceId)&&c.bestGain>0))throw new Error('Equipment still improves a hero. Equip upgrades before dismantling.');
 const pieces=selected.map(id=>candidates.find(c=>c.item.instanceId===id)?.item);
 if(new Set(selected).size!==selected.length||pieces.some(i=>!i))throw new Error('Disposal changed. Review the updated equipment.');
 return{ids:selected,signature:JSON.stringify(pieces),legacy:`salvage:${data.lamp.salvage.count}:${data.lamp.salvage.gold}`,essence:pieces.reduce((n,i)=>n+salvageValue(i),0)+data.lamp.salvage.gold};
}
export function dismantleConveyorItems(data,preview,heroes){
 const fresh=conveyorDisposalPreview(data,heroes,preview.ids);
 if(fresh.signature!==preview.signature||fresh.legacy!==preview.legacy)throw new Error('Disposal changed. Review the updated equipment.');
 const ids=new Set(preview.ids),count=ids.size+data.lamp.salvage.count;
 if(!count)throw new Error('No equipment selected for dismantling.');
 data.items=data.items.filter(i=>!ids.has(i.instanceId));data.lamp.pending=data.lamp.pending.filter(id=>!ids.has(id));data.lamp.discarded=data.lamp.discarded.filter(id=>!ids.has(id));
 if(ids.has(data.lamp.reviewHold?.item.instanceId))data.lamp.reviewHold=null;
 data.lamp.disposalRequested=(data.lamp.disposalRequested||[]).filter(id=>!ids.has(id));
 data.lamp.salvage={count:0,gold:0};data.lamp.essence+=fresh.essence;
 return{count,essence:fresh.essence};
}
