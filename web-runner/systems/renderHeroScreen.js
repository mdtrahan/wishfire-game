import {renderHeroGear} from './heroGearUI.mjs';
import {computeCombatPower} from '../src/core/combatPower.mjs';
import {heroDefinition,FLOW_ORB_TUNING} from '../src/core/heroDefinitions.mjs';
import {createHeroProgressStore} from '../src/core/heroProgression.mjs';
import {heroArtKey} from '../state/heroArtAssets.mjs';
let host, content, lastKey, currentTab='hero', skillTab='actives';
export function hideHeroScreen(){if(host)host.hidden=true;}
export function renderHeroScreen({equipmentProgress,canvas,gameState,fnContext,heroPortraitImages,onClose}) {
 const g=fnContext.state.globals;g.HeroProgress ||= createHeroProgressStore();
 const roster=Object.values(g.HeroProgress.heroes);
 const index=((Number(gameState.selectedHero)||0)%roster.length+roster.length)%roster.length;
 const saved=roster[index];
 const hero=fnContext.state.entities.find(a=>a.kind==='hero'&&a.heroInstanceKey===saved.heroInstanceKey)||saved;
 const d=heroDefinition(hero);
 if(!host){
  host=document.createElement('section');host.id='hero-details';host.setAttribute('aria-label','Hero details');
  const style=document.createElement('style');style.textContent=`
   #hero-details{position:fixed;z-index:30;background:#0b0d11;color:#eee;box-sizing:border-box;padding:16px;overflow:hidden;font:14px/1.45 system-ui}
   #hero-details[hidden]{display:none} #hero-details *{box-sizing:border-box;min-width:0} #hero-details>div{height:100%;display:flex;flex-direction:column;gap:.6em} #hero-details .pane{overflow:auto;flex:1;overflow-wrap:anywhere}
   #hero-details button{background:#171c24;color:#fff;border:1px solid #8895a5;border-radius:4px;padding:.5em;min-height:2.8em;font:inherit;cursor:pointer}
   #hero-details button:focus-visible{outline:3px solid #50cfff} #hero-details button[aria-pressed=true]{background:#15577f}
   #hero-details nav{display:flex;gap:.5em;justify-content:space-between}
   #hero-details .identity{position:relative;text-align:center;flex:none;background:radial-gradient(ellipse,#273d3c,transparent 65%)} #hero-details .identity img{width:100%;height:8em;object-fit:contain} #hero-details .tabs button{flex:1} #hero-details .roster{flex:none;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.4em;margin-top:.6em} #hero-details .roster img{display:block;width:100%;height:3em;object-fit:contain} #hero-details .roster button{font-size:.85em} #hero-details details{margin:.6em 0} #hero-details summary{cursor:pointer;padding:.5em 0} #hero-details .milestone{display:flex;gap:1em;padding:.4em 0;border-bottom:1px solid #333}
   #hero-details h1{margin:0;font-size:1.6em} #hero-details p{margin:4px 0}
   #hero-details progress{width:100%;accent-color:#3b82f6} #hero-details dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(64px,1fr));gap:8px;margin:12px 0}
   #hero-details dd{margin:0} #hero-details article{border-top:1px solid #444;padding:.7em 0} #hero-details h2{font-size:1em;margin:0}
   #hero-details .gear-slots{position:absolute;top:0;left:0;width:100%;height:8em;pointer-events:none} #hero-details .gear-slots button{position:absolute;width:4.5em;height:2.65em;pointer-events:auto;padding:0;font-size:.85em} #hero-details .gear-slots small{font-size:.7em} #hero-details .equipment-tile{position:relative;border:3px solid var(--rarity)!important;border-radius:.8em!important;background:radial-gradient(ellipse at 35% 20%,#ffffff50,transparent 70%),linear-gradient(145deg,var(--rarity),color-mix(in srgb,var(--rarity) 48%,#102041))!important;box-shadow:inset 0 2px 0 #fff7,inset 0 -3px 0 #0003,0 3px 3px #0007;padding:.35em!important}
   #hero-details .equipment-tile small{white-space:normal;overflow-wrap:anywhere;padding:0 .45em;color:#fff;text-shadow:0 1px 2px #000;font-size:.7em} #hero-details .equipment-grid .equipment-tile{min-height:6em}
   #hero-details .gear-type{position:absolute;left:-.2em;top:-.2em;width:1.35em;height:1.35em;border-radius:50%;border:1px solid #dff3ff;background:#17313baa;color:white;display:grid;place-items:center;font-size:.8em}
   #hero-details .gear-upgrade{position:absolute;right:-.2em;bottom:-.2em;color:#08772a;background:#7fff3b;border:2px solid #27942d;border-radius:.35em;width:1.3em;height:1.3em;display:grid;place-items:center;font-weight:bold;font-size:1.1em;line-height:1;box-shadow:0 1px 2px #0008}
   #hero-details .equipment-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.4em} #hero-details .gear-art{width:3.3em;height:3.3em;filter:drop-shadow(0 2px 2px #0008);object-fit:contain} #hero-details select{font:inherit;color:inherit;background:#202529;max-width:6em} #hero-details .equipment-detail{padding:.4em 0;border-bottom:1px solid #777} #hero-details .locked{color:#aaa} #hero-details small{display:block;color:#bcc6d2}
  `;document.head.append(style);content=document.createElement('div');host.append(content);document.body.append(host);
 }
 host.hidden=false;const rect=canvas.getBoundingClientRect();Object.assign(host.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,padding:`${14*rect.width/360}px`,fontSize:`${14*rect.width/360}px`});
 const key=JSON.stringify([index,currentTab,skillTab,hero.currentLevel,hero.currentEXP,hero.hp,hero.flow,hero.stats,roster.map(h=>h.currentLevel),g.Equipment]);
 if(key!==lastKey){lastKey=key;const focused=content.contains(document.activeElement)?document.activeElement:null;const focusLabel=focused?.getAttribute('aria-label')||focused?.textContent;content.replaceChildren();
  const el=(tag,text,parent=content)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;parent.append(n);return n;};
  const button=(parent,text,action)=>{const n=el('button',text,parent);n.type='button';n.onclick=action;return n;};
  const portrait=(owner,parent)=>{const def=heroDefinition(owner);const image=heroPortraitImages[heroArtKey(owner)];if(image?.src){const img=el('img',null,parent);img.src=image.src;img.alt=def.name;}};
  const nav=el('nav');button(nav,'Back',onClose);
  const identity=el('header');identity.className='identity';portrait(hero,identity);el('h1',d.name,identity);el('p',`Lv. ${hero.currentLevel} · ${d.role} · ${d.flowMode}`,identity);el('p',`CP ${computeCombatPower(hero)}`,identity);el('p',`HP ${hero.maxHP} · ATK ${hero.stats.ATK} · AF ${Math.min(100,Math.max(0,Number(hero.flow||0)))}`,identity);
  const tabs=el('nav');tabs.className='tabs';tabs.setAttribute('aria-label','Hero management');
  for(const [id,label] of [['hero','HERO'],['gear','GEAR'],['skills','SKILLS']]){const b=button(tabs,label,()=>{currentTab=id;});b.setAttribute('aria-pressed',String(currentTab===id));}
  const pane=el('div');pane.className='pane';pane.setAttribute('aria-label',`${currentTab} view`);
  if(currentTab==='hero'){
   el('h2','Level progress',pane);const exp=el('progress',null,pane);exp.max=hero.EXPToNextLevel||1;exp.value=hero.currentLevel>=hero.maxLevel?1:hero.currentEXP;exp.setAttribute('aria-label','Level EXP');
   el('small',hero.currentLevel>=hero.maxLevel?'Maximum level':`${hero.currentEXP} / ${hero.EXPToNextLevel} EXP`,pane);
   button(pane,d.special.displayName,()=>{currentTab='skills';skillTab='special';});
   const next=[...d.actives,...d.passives].filter(a=>a.unlockLevel>hero.currentLevel).sort((a,b)=>a.unlockLevel-b.unlockLevel).slice(0,3);
   el('h2',next.length?'Coming next':'Base kit complete',pane).style.marginTop='.8em';
   for(const ability of next){const row=el('div',null,pane);row.className='milestone';el('small',`Lv. ${ability.unlockLevel}`,row);el('span',ability.displayName,row);}
   const details=el('details',null,pane);el('summary','Stats',details);const stats=el('dl',null,details);
   for(const [name,value] of Object.entries({HP:hero.maxHP,...hero.stats,AF:Math.min(100,Math.max(0,Number(hero.flow||0)))})){const cell=el('div',null,stats);el('dt',name,cell);el('dd',String(value),cell);}
  }else if(currentTab==='gear'){
   renderHeroGear({stage:identity,pane,hero,economy:equipmentProgress,roster,invalidate:()=>{lastKey=null;}});
  }else{
   const categories=el('nav',null,pane);categories.className='tabs';categories.setAttribute('aria-label','Skill categories');
   for(const [id,label] of [['actives','Active'],['passives','Passive'],['special','FLOW']]){const b=button(categories,label,()=>{skillTab=id;});b.setAttribute('aria-pressed',String(skillTab===id));}
   if(skillTab==='special'){el('h2',`${d.flowMode} · AF trait`,pane);el('h2','How FLOW builds',pane).style.marginTop='.8em';el('p','Role actions send blue AF to the hero who earned it.',pane);}
   const entries=skillTab==='special'?[d.special]:skillTab==='actives'?d.actives:d.passives;
   for(const ability of entries){const item=el('article',null,pane);const locked=hero.currentLevel<ability.unlockLevel;if(locked)item.className='locked';el('h2',ability.displayName,item);
    if(ability.spCost!=null)el('small',ability.isFlowSpecial?'Full AF':'Action',item);
    el('p',ability.description.replaceAll('magic-tagged actions','magic skills'),item);el('small',locked?`Unlocks Lv. ${ability.unlockLevel}`:'Unlocked',item);
   }
   if(skillTab==='actives'){const basic=el('details',null,pane);el('summary','Basic Attack',basic);el('p',`${d.basic.description} Uses the whole turn.`,basic);}
  }
   const selection=el('div');selection.className='roster';selection.setAttribute('aria-label','Hero roster');
   roster.forEach((member,i)=>{const def=heroDefinition(member);const card=button(selection,'',()=>{gameState.selectedHero=i;});portrait(member,card);el('span',def.name,card);el('small',`Lv. ${member.currentLevel}`,card);card.setAttribute('aria-pressed',String(i===index));card.setAttribute('aria-label',`Inspect ${def.name}`);});
  if(focusLabel){const replacement=[...content.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||b.textContent)===focusLabel);replacement?.focus({preventScroll:true});}
 }
 return {mode:'details',selectedSkillIndex:0,hitZones:{skillNodes:[]}};
}
