import {heroDefinition} from '../src/core/heroDefinitions.mjs';
import {EQUIPMENT,EQUIPMENT_SLOTS,RARITIES,equipmentArt,isEquipmentUpgrade} from '../src/core/equipment.mjs';
let selectedId=null,type='all',sort='rarity',notice='';
export function renderHeroGear({stage,pane,hero,economy,roster,invalidate}){
 const el=(tag,text,parent)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;parent.append(n);return n;};
 const button=(parent,text,fn)=>{const b=el('button',text,parent);b.type='button';b.onclick=fn;return b;};
 const data=economy?.data;if(!data){el('p','Loading equipment…',pane);return;}
 const loadout=data.loadouts[hero.heroInstanceKey]||{};
 const definition=id=>EQUIPMENT[data.items.find(i=>i.instanceId===id)?.equipmentId];
 const owner=id=>Object.entries(data.loadouts).find(([,slots])=>Object.values(slots).includes(id))?.[0];
 const available=data.items.filter(i=>!owner(i.instanceId));
 const upgradeBadge=b=>{const a=el('span','⬆',b);a.className='gear-upgrade';a.setAttribute('aria-label','Upgrade available');};
 const tile=(b,d)=>{b.classList.add('equipment-tile');b.style.setProperty('--rarity',RARITIES[d.rarity].color);const badge=el('span',({weapon:'⚔',head:'♜',armor:'⬟',boots:'♟',accessory:'◈'})[d.type],b);badge.className='gear-type';badge.setAttribute('aria-hidden','true');};
 const change=fn=>{fn();invalidate();};
 const transact=async(slot,id)=>{try{await economy.equip(hero.heroInstanceKey,slot,id);notice=id?'Equipment updated.':'Item unequipped.';}catch(e){notice=e.message;}invalidate();};
 const slots=el('div',null,stage);slots.className='gear-slots';
 Object.entries(EQUIPMENT_SLOTS).forEach(([slot,label],i)=>{
  const id=loadout[slot],d=definition(id);const b=button(slots,'',()=>change(()=>{selectedId=id||null;type=slot.startsWith('accessory')?'accessory':slot;}));
  b.style.left=i%2?'auto':'0';b.style.right=i%2?'0':'auto';b.style.top=`${Math.floor(i/2)*2.8}em`;
  b.setAttribute('aria-label',`${label}: ${d?.name||'Empty'}`);if(d){const art=el('img',null,b);art.src=equipmentArt(d);art.alt='';art.style.cssText='width:1.5em;height:1.5em;object-fit:contain';}else el('span','+',b);el('small',label,b);if(d)tile(b,d);if(available.some(i=>isEquipmentUpgrade(EQUIPMENT[i.equipmentId],d)&&EQUIPMENT[i.equipmentId].type===(slot.startsWith('accessory')?'accessory':slot)))upgradeBadge(b);
 });
 const controls=el('nav',null,pane);controls.setAttribute('aria-label','Equipment filters');
 const label=el('label','Type ',controls),filter=el('select',null,label);for(const t of ['all','weapon','head','armor','boots','accessory']){const option=el('option',t==='all'?'All':t[0].toUpperCase()+t.slice(1),filter);option.value=t;}filter.value=type;filter.onchange=()=>change(()=>type=filter.value);
 button(controls,sort==='rarity'?'Quality ↓':'Type',()=>change(()=>sort=sort==='rarity'?'type':'rarity'));
 const selected=definition(selectedId);
 if(selected){
  const detail=el('section',null,pane);detail.className='equipment-detail';el('h2',selected.name,detail);el('small',`${RARITIES[selected.rarity].label} · ${selected.type}`,detail);
  el('p',Object.entries(selected.stats).map(([k,v])=>`${k} +${v}`).join(' · '),detail);
  const equippedBy=owner(selectedId);if(equippedBy)el('small',`Equipped by ${heroDefinition(roster.find(h=>h.heroInstanceKey===equippedBy))?.name||'another hero'}`,detail);
  for(const [slot,label] of Object.entries(EQUIPMENT_SLOTS).filter(([s])=>(s.startsWith('accessory')?'accessory':s)===selected.type)){
   const current=definition(loadout[slot]);
   el('p',`${label}${slot.startsWith('accessory')?' '+slot.slice(-1):''}: ${current?.name||'Empty'}`,detail);
   if(current)el('small',Object.entries(current.stats).map(([k,v])=>`${k} +${v}`).join(' · '),detail);
   if(loadout[slot]===selectedId)button(detail,'Unequip',()=>transact(slot,null));
   else button(detail,`Equip${selected.type==='accessory'?' in slot '+slot.slice(-1):''}`,()=>transact(slot,selectedId));
  }
 }
 const status=el('p',notice,pane);status.setAttribute('role','status');
 const grid=el('div',null,pane);grid.className='equipment-grid';grid.setAttribute('aria-label','Equipment inventory');
 const rarityOrder=Object.keys(RARITIES);
 const visible=data.items.filter(i=>type==='all'||EQUIPMENT[i.equipmentId].type===type).sort((a,b)=>{const x=EQUIPMENT[a.equipmentId],y=EQUIPMENT[b.equipmentId];return (sort==='rarity'?rarityOrder.indexOf(y.rarity)-rarityOrder.indexOf(x.rarity):x.type.localeCompare(y.type))||x.name.localeCompare(y.name);});
 for(const item of visible){const d=EQUIPMENT[item.equipmentId],b=button(grid,'',()=>change(()=>selectedId=item.instanceId));tile(b,d);if(!owner(item.instanceId)&&Object.keys(EQUIPMENT_SLOTS).some(slot=>(slot.startsWith('accessory')?'accessory':slot)===d.type&&isEquipmentUpgrade(d,definition(loadout[slot]))))upgradeBadge(b);b.setAttribute('aria-label',`Inspect ${d.name}`);b.setAttribute('aria-pressed',String(item.instanceId===selectedId));const art=el('img',null,b);art.src=equipmentArt(d);art.alt='';art.className='gear-art';el('small',d.name,b);if(owner(item.instanceId))el('small','Equipped',b);}
 if(!visible.length)el('p',data.items.length?'No items of this type.':'No equipment owned. Find equipment in Astral Flow.',pane);
}
