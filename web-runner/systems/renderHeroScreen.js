import {renderHeroGear} from './heroGearUI.mjs';
import {computeCombatPower} from '../src/core/combatPower.mjs';
import {heroDefinition,heroSkillUnlocked} from '../src/core/heroDefinitions.mjs';
import {createHeroProgressStore} from '../src/core/heroProgression.mjs';
import {heroArtKey} from '../state/heroArtAssets.mjs';
let host, content, lastKey, currentTab='gear';
export function hideHeroScreen(){if(host)host.hidden=true;}
export function renderHeroScreen({equipmentProgress,canvas,gameState,fnContext,heroPortraitImages}) {
 const g=fnContext.state.globals;g.HeroProgress ||= createHeroProgressStore();
 const roster=Object.values(g.HeroProgress.heroes);
 const index=((Number(gameState.selectedHero)||0)%roster.length+roster.length)%roster.length;
 const saved=roster[index];
 const hero=fnContext.state.entities.find(a=>a.kind==='hero'&&a.heroInstanceKey===saved.heroInstanceKey)||saved;
 const d=heroDefinition(hero);
 if(!host){
  host=document.createElement('section');host.id='hero-details';host.setAttribute('aria-label','Hero details');
  const style=document.createElement('style');style.textContent=`
   #hero-details{position:fixed;z-index:30;color:#fff1d1;background:linear-gradient(#173e76,#29324c 70%,#101926);box-sizing:border-box;overflow:hidden;font:14px/1.4 system-ui}
   #hero-details[hidden]{display:none} #hero-details *{box-sizing:border-box;min-width:0} #hero-details>div{height:100%;display:flex;flex-direction:column;gap:.5em}
   #hero-details button{background:#192e48;color:inherit;border:1px solid #9eafc2;border-radius:.6em;padding:.4em;min-height:2.8em;font:inherit;cursor:pointer}
   #hero-details button:focus-visible{outline:3px solid #50cfff;outline-offset:2px} #hero-details button[aria-pressed=true]{background:#785c26;border-color:#ffd971}
   #hero-details nav{display:flex;gap:.5em;justify-content:space-between;flex:none} #hero-details .tabs button{flex:1}
   #hero-details .identity{position:relative;text-align:center;flex:1;min-height:0;background:radial-gradient(ellipse at 50% 85%,#8ee0d560,transparent 55%);isolation:isolate}
   #hero-details .hero-portrait{position:absolute;width:50%;height:72%;object-fit:contain;left:25%;bottom:0;z-index:-1;filter:drop-shadow(0 .3em .2em #07172a80)}
   #hero-details h1{margin:0;font-size:1.5em} #hero-details p{margin:.2em 0} #hero-details h2{font-size:1em;margin:0}
   #hero-details .power-bar{display:flex;justify-content:center;gap:2em;flex:none;padding:.5em;border:1px solid #dcb957;border-radius:.6em;background:linear-gradient(#806d42,#3a372d);font-weight:bold}
   #hero-details .power-bar span{display:flex;gap:.5em}
   #hero-details .gear-slots{position:absolute;inset:3.5em 0 .2em;display:grid;grid-template-columns:22% 1fr 22%;grid-template-rows:repeat(3,minmax(0,1fr));gap:max(.6em,8px) 0;pointer-events:none}
   #hero-details .gear-slot{position:relative;width:100%;aspect-ratio:1;align-self:center;min-height:0;padding:.2em;border:2px solid var(--rarity);border-radius:.6em;background:linear-gradient(145deg,color-mix(in srgb,var(--rarity) 60%,#122241),#182843);box-shadow:inset 0 1px #fff8,0 .2em .2em #07172a80}
   #hero-details button.gear-slot{pointer-events:auto;min-height:0;padding:.2em;border:2px solid var(--rarity);background:linear-gradient(145deg,color-mix(in srgb,var(--rarity) 60%,#122241),#182843)}
   #hero-details .gear-slot[aria-pressed=true]{outline:2px solid #ffe28c;outline-offset:2px} #hero-details .gear-slot small{position:absolute;top:.2em;left:0;width:100%;color:white;font-size:.72em;white-space:nowrap;z-index:1} #hero-details .gear-slot .lamp-art{display:block;width:100%} #hero-details .gear-empty{position:absolute;inset:0;display:grid;place-items:center;font-size:.85em;color:#c3cbd8}
   #hero-details button.gear-placeholder{cursor:default;color:#aab8cb}
   #hero-details .pane{overflow:auto;flex:1;overflow-wrap:anywhere} #hero-details[data-tab=gear] .pane{flex:none;height:5.4em;padding:.5em .7em;background:#111e31;border-radius:.5em} #hero-details:not([data-tab=gear]) .identity{flex:none;height:11em} #hero-details:not([data-tab=gear]) .hero-portrait{height:45%}
   #hero-details small{display:block;color:#d6dce5} #hero-details .roster{display:flex;flex:none;gap:.4em;overflow-x:auto;padding:.15em;margin:0} #hero-details .roster button{flex:0 0 calc((100% - 1.2em)/4);font-size:.8em;min-height:0;padding:.25em} #hero-details .roster img{display:block;width:100%;height:3em;object-fit:contain}
   #hero-details progress{width:100%;accent-color:#e4b354} #hero-details details{margin:.5em 0} #hero-details summary{cursor:pointer;padding:.5em 0} #hero-details dl{display:grid;grid-template-columns:repeat(3,1fr);gap:.5em;margin:.5em 0} #hero-details dd{margin:0} #hero-details article{border-top:1px solid #718198;padding:.7em 0}
  `;document.head.append(style);content=document.createElement('div');host.append(content);document.body.append(host);
 }
 host.hidden=false;const rect=canvas.getBoundingClientRect();Object.assign(host.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,padding:`${14*rect.width/360}px ${14*rect.width/360}px ${66*rect.width/360}px`,fontSize:`${14*rect.width/360}px`});
 host.dataset.tab=currentTab;
 const key=JSON.stringify([index,currentTab,hero.currentLevel,hero.currentEXP,hero.hp,hero.stats,roster.map(h=>h.currentLevel),g.Equipment]);
 if(key!==lastKey){lastKey=key;const focused=content.contains(document.activeElement)?document.activeElement:null;const focusLabel=focused?.getAttribute('aria-label')||focused?.textContent;content.replaceChildren();
  const el=(tag,text,parent=content)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;parent.append(n);return n;};
  const button=(parent,text,action)=>{const n=el('button',text,parent);n.type='button';n.onclick=action;return n;};
  const portrait=(owner,parent)=>{const def=heroDefinition(owner);const image=heroPortraitImages[heroArtKey(owner)];if(image?.src){const img=el('img',null,parent);img.src=image.src;img.alt=def.name;}};
  const identity=el('header');identity.className='identity';portrait(hero,identity);identity.querySelector('img')?.classList.add('hero-portrait');el('h1',d.name,identity);el('p',`Lv. ${hero.currentLevel} · ${d.role}`,identity);el('p',`CP ${computeCombatPower(hero)}`,identity);const power=el('div');power.className='power-bar';const magic=hero.stats.MAG>hero.stats.ATK;el('span',`${magic?'MATK':'ATK'} ${magic?hero.stats.MAG:hero.stats.ATK}`,power);el('span',`HP ${hero.maxHP}`,power);
  const tabs=el('nav');tabs.className='tabs';tabs.setAttribute('aria-label','Hero management');
  for(const [id,label] of [['hero','HERO'],['gear','GEAR'],['skills','SKILLS']]){const b=button(tabs,label,()=>{currentTab=id;});b.setAttribute('aria-pressed',String(currentTab===id));}
  const pane=el('div');pane.className='pane';pane.setAttribute('aria-label',`${currentTab} view`);
  if(currentTab==='hero'){
   el('h2','Level progress',pane);const exp=el('progress',null,pane);exp.max=hero.EXPToNextLevel||1;exp.value=hero.currentLevel>=hero.maxLevel?1:hero.currentEXP;exp.setAttribute('aria-label','Level EXP');
   el('small',hero.currentLevel>=hero.maxLevel?'Maximum level':`${hero.currentEXP} / ${hero.EXPToNextLevel} EXP`,pane);
   const next=d.actives.find(a=>!heroSkillUnlocked(hero,a));if(next)el('p',`Next skill: ${next.displayName} at Lv. ${next.unlockLevel}`,pane);
   button(pane,'View skills',()=>{currentTab='skills';});
   const details=el('details',null,pane);el('summary','Stats',details);const stats=el('dl',null,details);
   for(const [name,value] of Object.entries({HP:hero.maxHP,...hero.stats})){const cell=el('div',null,stats);el('dt',name==='MAG'?'MATK':name,cell);el('dd',String(value),cell);}
  }else if(currentTab==='gear'){
   renderHeroGear({stage:identity,pane,hero,economy:equipmentProgress});
  }else{
   const basic=el('article',null,pane);el('h2','Basic Attack',basic);el('p',d.basic.description,basic);
   for(const ability of d.actives){const item=el('article',null,pane);el('h2',ability.displayName,item);
    el('small',heroSkillUnlocked(hero,ability)?'Unlocked · Lv. '+ability.unlockLevel:'Unlocks at Lv. '+ability.unlockLevel,item);
    item.dataset.locked=String(!heroSkillUnlocked(hero,ability));
    el('p',ability.description.replaceAll('magic-tagged actions','magic skills'),item);
   }
  }
   const selection=el('div');selection.className='roster';selection.setAttribute('aria-label','Hero roster');
   roster.forEach((member,i)=>{const def=heroDefinition(member);const card=button(selection,'',()=>{gameState.selectedHero=i;});portrait(member,card);el('span',def.name,card);el('small',`Lv. ${member.currentLevel}`,card);card.setAttribute('aria-pressed',String(i===index));card.setAttribute('aria-label',`Inspect ${def.name}`);});
  content.append(tabs);
  if(focusLabel){const replacement=[...content.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||b.textContent)===focusLabel);replacement?.focus({preventScroll:true});}
 }
 return {mode:'details',selectedSkillIndex:0,hitZones:{skillNodes:[]}};
}
