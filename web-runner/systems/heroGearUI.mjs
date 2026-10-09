import {EQUIPMENT_SLOTS,equipmentDefinition,RARITIES} from '../src/core/equipment.mjs';
let selectedSlot='hat';
export function renderHeroGear({stage,pane,hero,economy}){
 const el=(tag,text,parent)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;parent.append(n);return n;};
 const data=economy?.data;if(!data){el('p','Loading equipment…',pane);return;}
 const slots=el('div',null,stage);slots.className='gear-slots';slots.setAttribute('aria-label','Equipped gear');
 const inspect=(slot,item)=>{
  selectedSlot=slot;pane.replaceChildren();
  for(const card of slots.querySelectorAll("[data-slot]"))card.setAttribute('aria-pressed',String(card.dataset.slot===slot));
  el('h2',item?.name||EQUIPMENT_SLOTS[slot]+' · Empty',pane);
  if(item){el('small',RARITIES[item.rarity].label+' · Lv. '+item.level,pane);el('p',Object.entries(item.stats).map(([k,v])=>(k==='MAG'?'MATK':k)+' +'+v).join(' · '),pane);}
  else el('p','Inspect lamp results to equip this slot.',pane);
 };
 for(const[index,[slot,label]]of Object.entries(EQUIPMENT_SLOTS).entries()){
  const id=data.loadouts[hero.heroInstanceKey]?.[slot],item=equipmentDefinition(data.items.find(i=>i.instanceId===id));
  const card=el('button',null,slots);card.type='button';card.className='gear-slot';card.dataset.slot=slot;card.style.gridColumn=1;card.style.gridRow=index+1;card.style.setProperty('--rarity',item?RARITIES[item.rarity].color:'#758597');
  card.setAttribute('aria-label',`Inspect ${label}: ${item?item.name+', '+RARITIES[item.rarity].label+', level '+item.level:'Empty'}`);
  if(item){const art=el('span',null,card);art.className='lamp-art';art.style.setProperty('--col',item.art%3);art.style.setProperty('--row',Math.floor(item.art/3));art.setAttribute('aria-hidden','true');el('span','Lv.'+item.level,art).className='lamp-level';}
  else{el('small',label,card);el('span','Empty',card).className='gear-empty';}
  card.onclick=()=>inspect(slot,item);
  if(slot===selectedSlot)inspect(slot,item);
 }
 for(let row=1;row<=3;row++){
  const card=el(row===3?'button':'div',row===3?'Orbs':null,slots);card.className='gear-slot gear-placeholder';card.style.gridColumn=3;card.style.gridRow=row;card.style.setProperty('--rarity','#758597');
  card.setAttribute('aria-label',row===3?'Orbs: unavailable':'Unassigned equipment slot');
  if(row===3){card.type='button';card.disabled=true;}
 }
 // Set selection on supported equipment cards after the chosen slot has rendered.
 for(const card of slots.querySelectorAll("[data-slot]"))card.setAttribute('aria-pressed',String(card.dataset.slot===selectedSlot));
}
