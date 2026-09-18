// Shared placeholder catalog and balance data for acquisition, Gear and combat.
export const EQUIPMENT_SLOTS = Object.freeze({weapon:'Weapon',head:'Head',armor:'Armor',boots:'Boots',accessory1:'Accessory',accessory2:'Accessory'});
export const RARITIES = Object.freeze({
 common:{label:'Common',color:'#a5a7ac',weight:60,priceMultiplier:1},
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
  const owned=items.find(i=>i.instanceId===id),d=EQUIPMENT[owned?.equipmentId];
  if(!d||!EQUIPMENT_SLOTS[slot]||d.type!==(slot.startsWith('accessory')?'accessory':slot)||used.has(id))continue;
  used.add(id);for(const [stat,value] of Object.entries(d.stats))stats[stat]=(stats[stat]||0)+value;
 }
 return stats;
}
export function equipItem(economy,heroId,slot,instanceId){
 if(!EQUIPMENT_SLOTS[slot])throw new Error('Unknown equipment slot');
 const owned=economy.items.find(i=>i.instanceId===instanceId),d=EQUIPMENT[owned?.equipmentId];
 if(instanceId&&(!d||d.type!==(slot.startsWith('accessory')?'accessory':slot)))throw new Error('This item does not fit this slot');
 if(instanceId)for(const slots of Object.values(economy.loadouts))for(const [key,id] of Object.entries(slots))if(id===instanceId)delete slots[key];
 const loadout=economy.loadouts[heroId]||=( {} );
 if(instanceId)loadout[slot]=instanceId;else delete loadout[slot];
}

// Shared placeholder equipment art; replace catalog art without changing either screen.
export function equipmentArt(d){
 const shapes={
  '⚔':'<path d="M27 42 45 8 51 5 51 13 34 46Z"/><path d="m20 38 20 12-3 5-20-12Z"/><path d="m26 47-8 13-5-3 8-13Z"/>',
  '✦':'<path d="m29 20 5 1-8 40-5-1Z"/><path d="m30 3 13 10-7 15-15-5-3-15Z" fill="var(--stone)"/>',
  '♜':'<path d="M13 37V24a19 19 0 0 1 38 0v13l-7 16-9 5V33h-6v25l-9-5Z"/><path d="M16 25h12v6H17m19-6h12l-1 6H36" fill="#17232f"/>',
  '⬟':'<path d="m20 8 12 5 12-5 14 12-7 15-6-3 3 25-16 5-16-5 3-25-6 3-7-15Z"/><path d="m21 13 11 6 11-6M32 20v34" fill="none"/>',
  '♟':'<path d="M24 5h23l-2 32 11 10v12H8v-9l17-12Z"/><path d="M23 14h23M24 24h21M23 33h22M9 52h47" fill="none"/>',
  '◈':'<circle cx="32" cy="37" r="20" fill="none" stroke-width="8"/><path d="m32 3 13 12-13 15-13-15Z" fill="var(--stone)"/>',
 };
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" style="--stone:${RARITIES[d.rarity].color}"><defs><linearGradient id="m" x2="1" y2="1"><stop stop-color="#faf0c7"/><stop offset=".5" stop-color="#b8b6ab"/><stop offset="1" stop-color="#807559"/></linearGradient></defs><g fill="url(#m)" stroke="#51483b" stroke-width="2" stroke-linejoin="round">${shapes[d.icon]}</g></svg>`;
 return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Only unambiguous stat upgrades: no stat may drop, and at least one must rise.
export function isEquipmentUpgrade(candidate,current){
 if(!candidate||current&&candidate.type!==current.type)return false;
 const keys=new Set([...Object.keys(candidate.stats),...Object.keys(current?.stats||{})]);
 return [...keys].every(k=>(candidate.stats[k]||0)>=(current?.stats[k]||0))&&[...keys].some(k=>(candidate.stats[k]||0)>(current?.stats[k]||0));
}
