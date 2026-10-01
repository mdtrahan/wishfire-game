// Three supported slots. The fixed catalog below is retained for v1 save migration only.
export const EQUIPMENT_SLOTS = Object.freeze({hat:'Hat',body:'Body',boots:'Boots'});
export const RARITIES = Object.freeze({
 common:{label:'Common',color:'#f3f3ee',weight:60,priceMultiplier:1},
 uncommon:{label:'Uncommon',color:'#60bd76',weight:25,priceMultiplier:2},
 rare:{label:'Rare',color:'#58a7ff',weight:10,priceMultiplier:5},
 epic:{label:'Epic',color:'#c078f2',weight:4,priceMultiplier:12},
 legendary:{label:'Legendary',color:'#f0bd55',weight:1,priceMultiplier:30},
});
const item=(id,name,type,rarity,stats,icon,basePrice=30)=>({id,name,type,rarity,stats,icon,basePrice});
export const EQUIPMENT = Object.freeze(Object.fromEntries([
 item('iron-sword','Iron Sword','weapon','common',{ATK:2},'⚔'),
 item('apprentice-staff','Apprentice Staff','weapon','common',{MAG:2},'✦'),
 item('linen-hood','Linen Hood','head','common',{RES:1},'♜'),
 item('leather-vest','Leather Vest','armor','common',{DEF:2},'⬟'),
 item('trail-boots','Trail Boots','boots','common',{SPD:1},'♟'),
 item('copper-ring','Copper Ring','accessory','common',{HP:5},'◈'),
 item('warden-helm','Warden Helm','head','uncommon',{DEF:3,RES:1},'♜'),
 item('chain-mail','Chain Mail','armor','uncommon',{DEF:4},'⬟'),
 item('swift-boots','Swift Boots','boots','uncommon',{SPD:2},'♟'),
 item('ember-blade','Ember Blade','weapon','rare',{ATK:6},'⚔'),
 item('moon-staff','Moon Staff','weapon','rare',{MAG:6},'✦'),
 item('sapphire-ring','Sapphire Ring','accessory','rare',{RES:3,HP:10},'◈'),
 item('astral-mantle','Astral Mantle','armor','epic',{DEF:5,RES:5},'⬟'),
 item('star-pendant','Star Pendant','accessory','epic',{MAG:5,HP:15},'◈'),
 item('dawnbringer','Dawnbringer','weapon','legendary',{ATK:10,MAG:6},'⚔'),
 item('sunward-crown','Sunward Crown','head','legendary',{DEF:8,RES:8},'♜'),
].map(d=>[d.id,Object.freeze(d)])));
export function equipmentStats(items,loadout={}){
 const stats={};const used=new Set();
 for(const [slot,id] of Object.entries(loadout)){
  const owned=items.find(i=>i.instanceId===id),d=equipmentDefinition(owned);
  if(!d||!EQUIPMENT_SLOTS[slot]||d.type!==slot||used.has(id))continue;
  used.add(id);for(const [stat,value] of Object.entries(d.stats))stats[stat]=(stats[stat]||0)+value;
 }
 return stats;
}
export function equipmentDefinition(item){return item?.stats&&item?.type?item:EQUIPMENT[item?.equipmentId];}

// Shared placeholder equipment art; replace catalog art without changing either screen.
// Only unambiguous stat upgrades: no stat may drop, and at least one must rise.
export function isEquipmentUpgrade(candidate,current){
 if(!candidate||current&&candidate.type!==current.type)return false;
 const keys=new Set([...Object.keys(candidate.stats),...Object.keys(current?.stats||{})]);
 return [...keys].every(k=>(candidate.stats[k]||0)>=(current?.stats[k]||0))&&[...keys].some(k=>(candidate.stats[k]||0)>(current?.stats[k]||0));
}
