import {EQUIPMENT,RARITIES} from './equipment.mjs';
export const MARKET_CONFIG=Object.freeze({trackCount:4,spawnIntervalRange:[9,13],travelDuration:32,specialPresentationThreshold:'epic',eligibleEquipmentPools:Object.keys(EQUIPMENT)});
function random(seed,track,index,salt){let x=(seed^Math.imul(track+1,374761393)^Math.imul(index+1,668265263)^Math.imul(salt,1274126177))>>>0;x=Math.imul(x^(x>>>13),1274126177);return ((x^(x>>>16))>>>0)/4294967296;}
export function createMarket(seed,now){return {seed:seed>>>0,epoch:now-MARKET_CONFIG.travelDuration*1000,lastSeen:now};}
export function marketOffers(market,now,items=[],config=MARKET_CONFIG){
 now=Math.max(now,market.lastSeen);const [min,max]=config.spawnIntervalRange;const period=(min+max)/2*1000,jitter=(max-min)/4*1000,lifetime=config.travelDuration*1000;
 const purchased=new Set(items.map(i=>i.instanceId));const result=[];
 const pool=config.eligibleEquipmentPools.map(id=>EQUIPMENT[id]).filter(Boolean);
 const weights=Object.entries(RARITIES).filter(([r])=>pool.some(d=>d.rarity===r));const total=weights.reduce((s,[,r])=>s+r.weight,0);
 for(let track=0;track<config.trackCount;track++){
  const offset=track*period/config.trackCount;
  const first=Math.max(0,Math.floor((now-market.epoch-offset-lifetime-jitter)/period));
  const last=Math.floor((now-market.epoch-offset+jitter)/period);
  for(let index=first;index<=last;index++){
   const spawnedAt=market.epoch+offset+index*period+(random(market.seed,track,index,1)*2-1)*jitter;
   if(spawnedAt>now||spawnedAt+lifetime<=now)continue;
   const id=`flow:${market.seed}:${track}:${index}`;if(purchased.has(id))continue;
   let roll=random(market.seed,track,index,2)*total;let rarity=weights[0]?.[0];
   for(const [key,r] of weights){roll-=r.weight;if(roll<0){rarity=key;break;}}
   const candidates=pool.filter(d=>d.rarity===rarity);if(!candidates.length)continue;
   const d=candidates[Math.floor(random(market.seed,track,index,3)*candidates.length)];
   result.push({id,track,equipmentId:d.id,price:Math.round(d.basePrice*RARITIES[d.rarity].priceMultiplier),spawnedAt,expiresAt:spawnedAt+lifetime,progress:(now-spawnedAt)/lifetime});
  }
 }
 return result;
}
export function purchaseOffer(economy,id,now){
 const offer=marketOffers(economy.market,now,economy.items).find(o=>o.id===id);
 if(!offer)throw new Error('This item has passed or was already purchased.');
 if(economy.gold<offer.price)throw new Error('Not enough Gold.');
 economy.gold-=offer.price;economy.items.push({instanceId:offer.id,equipmentId:offer.equipmentId,acquiredAt:now});
 return offer;
}
