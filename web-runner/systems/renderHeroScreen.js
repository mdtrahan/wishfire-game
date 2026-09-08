import {heroDefinition,FLOW_MODES} from '../src/core/heroDefinitions.mjs';
import {createHeroProgressStore} from '../src/core/heroProgression.mjs';
let host, content, lastKey, currentTab='actives';
export function hideHeroScreen(){if(host)host.hidden=true;}
export function renderHeroScreen({canvas,gameState,fnContext,heroPortraitImages,onClose}) {
 const g=fnContext.state.globals;g.HeroProgress ||= createHeroProgressStore();
 const roster=Object.values(g.HeroProgress.heroes);
 const index=((Number(gameState.selectedHero)||0)%roster.length+roster.length)%roster.length;
 const saved=roster[index];
 const hero=fnContext.state.entities.find(a=>a.kind==='hero'&&a.heroInstanceKey===saved.heroInstanceKey)||saved;
 const d=heroDefinition(hero);
 if(!host){
  host=document.createElement('section');host.id='hero-details';host.setAttribute('aria-label','Hero details');
  const style=document.createElement('style');style.textContent=`
   #hero-details{position:fixed;z-index:30;background:#0b0d11;color:#eee;box-sizing:border-box;padding:16px;overflow:auto;font:14px/1.45 system-ui}
   #hero-details[hidden]{display:none} #hero-details *{box-sizing:border-box}
   #hero-details button{background:#171c24;color:#fff;border:1px solid #8895a5;border-radius:4px;padding:10px;min-height:44px;font:inherit;cursor:pointer}
   #hero-details button:focus-visible{outline:3px solid #50cfff} #hero-details button[aria-pressed=true]{background:#15577f}
   #hero-details nav{display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap}
   #hero-details .identity{display:flex;gap:16px;margin:16px 0} #hero-details img{width:80px;height:100px;object-fit:contain}
   #hero-details h1{margin:0;font-size:24px} #hero-details p{margin:4px 0}
   #hero-details progress{width:100%;accent-color:#3b82f6} #hero-details dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(64px,1fr));gap:8px;margin:12px 0}
   #hero-details dd{margin:0} #hero-details article{border-top:1px solid #444;padding:12px 0} #hero-details h2{font-size:16px;margin:0}
   #hero-details .locked{color:#aaa} #hero-details small{display:block;color:#bcc6d2}
  `;document.head.append(style);content=document.createElement('div');host.append(content);document.body.append(host);
 }
 host.hidden=false;const rect=canvas.getBoundingClientRect();Object.assign(host.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});
 const key=JSON.stringify([index,currentTab,hero.currentLevel,hero.currentEXP,hero.hp,hero.sp,hero.actionSlotsPerTurn]);
 if(key!==lastKey){lastKey=key;content.replaceChildren();
  const el=(tag,text,parent=content)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;parent.append(n);return n;};
  const button=(parent,text,action)=>{const n=el('button',text,parent);n.type='button';n.onclick=action;return n;};
  const nav=el('nav');button(nav,'Back',onClose);button(nav,'Previous hero',()=>{gameState.selectedHero=(index+roster.length-1)%roster.length;});button(nav,'Next hero',()=>{gameState.selectedHero=(index+1)%roster.length;});
  const identity=el('div');identity.className='identity';const portrait=heroPortraitImages[hero.baseHeroName]||heroPortraitImages[d.key];if(portrait?.src){const img=el('img',null,identity);img.src=portrait.src;img.alt=d.name;}
  const info=el('div',null,identity);el('h1',d.name,info);el('p',`${d.role} · ${d.flowMode} FLOW`,info);el('p',`Builds FLOW: ${FLOW_MODES[d.flowMode]}.`,info);el('p',`${hero.actionSlotsPerTurn??d.actionSlotsPerTurn} actions per turn`,info);el('p',`Level ${hero.currentLevel} / ${hero.maxLevel}`,info);
  const exp=el('progress');exp.max=hero.EXPToNextLevel||1;exp.value=hero.currentLevel===hero.maxLevel?1:hero.currentEXP;exp.setAttribute('aria-label','Level EXP');el('p',hero.currentLevel===hero.maxLevel?'MAX':`${hero.currentEXP} / ${hero.EXPToNextLevel} EXP`);
  const stats=el('dl');for(const [name,value] of Object.entries({HP:`${hero.hp}/${hero.maxHP}`,SP:`${hero.sp}/${hero.spMax}`,...hero.stats})){const cell=el('div',null,stats);el('dt',name,cell);el('dd',String(value),cell);}
  const tabs=el('nav');for(const [id,label] of [['actives','Skills'],['passives','Passives'],['special','FLOW Special']]){const b=button(tabs,label,()=>{currentTab=id;});b.setAttribute('aria-pressed',String(currentTab===id));}
  const entries=currentTab==='special'?[d.special]:currentTab==='actives'?[d.basic,...d.actives]:d.passives;
  const targetLabels={self:'Self',enemy:'One enemy',ally:'One ally',deadAlly:'KO’d ally',allEnemies:'All enemies',allAllies:'All allies'};
  for(const ability of entries){const item=el('article');const locked=hero.currentLevel<ability.unlockLevel;if(locked)item.className='locked';el('h2',ability.displayName,item);el('small',locked?`Locked · Level ${ability.unlockLevel}`:`Unlocked · Level ${ability.unlockLevel}`,item);
   if(ability.tags?.length)el('small',ability.tags.map(tag=>tag[0].toUpperCase()+tag.slice(1)).join(' / '),item);
   el('p',ability.description,item);if(ability.spCost!=null)el('small',`${ability.isFlowSpecial?'Full FLOW':`${ability.spCost} SP`} · ${targetLabels[ability.targetType]||''}`,item);
  }
 }
 return {mode:'details',selectedSkillIndex:0,hitZones:{skillNodes:[]}};
}
