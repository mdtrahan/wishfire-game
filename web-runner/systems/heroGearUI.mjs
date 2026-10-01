import {EQUIPMENT_SLOTS,equipmentDefinition,RARITIES} from '../src/core/equipment.mjs';
export function renderHeroGear({pane,hero,economy}){
 const el=(tag,text,parent)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;parent.append(n);return n;};
 const data=economy?.data;if(!data){el('p','Loading equipment…',pane);return;}
 el('h2','Equipped gear',pane);el('p','Inspect new lamp results to replace a piece.',pane);
 for(const[slot,label]of Object.entries(EQUIPMENT_SLOTS)){
  const id=data.loadouts[hero.heroInstanceKey]?.[slot],item=equipmentDefinition(data.items.find(i=>i.instanceId===id));
  const row=el('section',null,pane);row.style.cssText='padding:.6em 0;border-bottom:1px solid #786446';
  el('strong',label,row);el('p',item?.name||'Empty',row);
  if(item){el('small',RARITIES[item.rarity].label,row);el('p',Object.entries(item.stats).map(([k,v])=>k+' +'+v).join(' · '),row);}
 }
}
