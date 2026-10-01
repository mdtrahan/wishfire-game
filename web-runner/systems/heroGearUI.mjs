import {EQUIPMENT_SLOTS,equipmentDefinition,RARITIES} from '../src/core/equipment.mjs';
let selectedSlot='hat';
export function renderHeroGear({stage,pane,hero,economy}){
 const el=(tag,text,parent)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;parent.append(n);return n;};
 const data=economy?.data;if(!data){el('p','Loading equipment…',pane);return;}
 const slots=el('div',null,stage);slots.className='gear-slots';slots.setAttribute('aria-label','Equipped gear');
 const inspect=(slot,item)=>{
  selectedSlot=slot;pane.replaceChildren();
  for(const card of slots.children)card.setAttribute('aria-pressed',String(card.dataset.slot===slot));
  el('h2',item?.name||EQUIPMENT_SLOTS[slot]+' · Empty',pane);
  if(item){el('small',RARITIES[item.rarity].label+' · Lv. '+item.level,pane);el('p',Object.entries(item.stats).map(([k,v])=>(k==='MAG'?'MATK':k)+' +'+v).join(' · '),pane);}
  else el('p','Inspect lamp results to equip this slot.',pane);
 };
 for(const[slot,label]of Object.entries(EQUIPMENT_SLOTS)){
  const id=data.loadouts[hero.heroInstanceKey]?.[slot],item=equipmentDefinition(data.items.find(i=>i.instanceId===id));
  const card=el('button',null,slots);card.type='button';card.className='gear-slot';card.dataset.slot=slot;card.style.setProperty('--rarity',item?RARITIES[item.rarity].color:'#758597');
  card.setAttribute('aria-label',`Inspect ${label}: ${item?item.name+', '+RARITIES[item.rarity].label+', level '+item.level:'Empty'}`);el('small',label+(item?' · Lv. '+item.level:''),card);
  if(item){const art=el('span',null,card);art.className='lamp-art';art.style.setProperty('--col',item.art%3);art.style.setProperty('--row',Math.floor(item.art/3));art.setAttribute('aria-hidden','true');}
  else el('span','Empty',card).className='gear-empty';
  card.onclick=()=>inspect(slot,item);
  if(slot===selectedSlot)inspect(slot,item);
 }
 // Set selection on every card after the chosen slot has rendered.
 for(const card of slots.children)card.setAttribute('aria-pressed',String(card.dataset.slot===selectedSlot));
}
