import {renderHeroGear} from './heroGearUI.mjs';
import {runtimeAssetUrl} from './runtimeAssetUrl.mjs';
import {computeCombatPower} from '../src/core/combatPower.mjs';
import {HERO_DEFINITIONS,heroDefinition} from '../src/core/heroDefinitions.mjs';
import {createHeroProgressStore} from '../src/core/heroProgression.mjs';
import {heroTicketLevelCost} from '../src/core/combatProgressionRules.mjs';
import {heroArtKey,heroArtPath} from '../state/heroArtAssets.mjs';
import {BUFF_SIGNAL_FRAMES,BUFF_SIGNAL_SHEET} from '../../src/core/buffSignalRules.mjs';
import {actorAttackReach} from '../../src/core/arenaCombatRules.mjs';
import {heroBasicSkill,heroSkillCopy} from './heroSkillCopy.mjs';

let host,content,lastKey,currentTab='gear',activeSkillIndex=-1,activeHeroIndex=-1,ticketNotice='',revealSkill=false;
const SLOT_LABELS=['Special','Passive','Resonance 1','Resonance 2'];
// Open a hero's Skills tab with the Special selected and brought into view (cooldown-strip navigation).
export function focusHeroSpecial(gameState,heroKey){
 const index=Object.keys(HERO_DEFINITIONS).indexOf(heroKey);
 if(index<0)return false;
 gameState.selectedHero=index;activeHeroIndex=index;currentTab='skills';activeSkillIndex=0;revealSkill=true;lastKey=null;return true;
}
const iconStyle=id=>{const frame=BUFF_SIGNAL_FRAMES[id];return frame?`background-image:url('${runtimeAssetUrl('images/ui/buff-signals.png')}');background-size:${BUFF_SIGNAL_SHEET.columns*100}% ${BUFF_SIGNAL_SHEET.rows*100}%;background-position:${frame.column/(BUFF_SIGNAL_SHEET.columns-1)*100}% ${frame.row/(BUFF_SIGNAL_SHEET.rows-1)*100}%`:'';};
const TICKET_QUADRANT={Fara:'0% 0%',Hondo:'100% 0%',Kaja:'0% 100%',Runa:'100% 100%'};

export function hideHeroScreen(){if(host)host.hidden=true;}

export function renderHeroScreen({equipmentProgress,combatProgression,canvas,gameState,fnContext,heroPortraitImages}){
 const globals=fnContext.state.globals;
 globals.HeroProgress ||= createHeroProgressStore();
 const roster=Object.keys(HERO_DEFINITIONS).map(key=>globals.HeroProgress.heroes[key]).filter(Boolean);
 if(!roster.length)return {mode:'details',selectedSkillIndex:0,hitZones:{skillNodes:[]}};
 const index=((Number(gameState.selectedHero)||0)%roster.length+roster.length)%roster.length;
 if(activeHeroIndex!==index){activeHeroIndex=index;activeSkillIndex=-1;ticketNotice='';}
 const saved=roster[index];
 const hero=saved;
 const definition=heroDefinition(hero);
 if(!host){
  host=document.createElement('section');host.id='hero-details';host.setAttribute('aria-label','Hero details');
  const style=document.createElement('style');style.textContent=`
   #hero-details{position:fixed;z-index:30;color:#fff1d1;background:linear-gradient(#173e76,#29324c 70%,#101926);box-sizing:border-box;overflow:hidden;font:14px/1.4 system-ui}
   #hero-details[hidden]{display:none} #hero-details *{box-sizing:border-box;min-width:0} #hero-details>div{height:100%;display:flex;flex-direction:column;gap:.45em}
   #hero-details button{background:#192e48;color:inherit;border:1px solid #9eafc2;border-radius:.6em;padding:.35em;min-height:2.5em;font:inherit;cursor:pointer}
   #hero-details button:focus-visible{outline:3px solid #50cfff;outline-offset:2px} #hero-details button[aria-pressed=true]{background:#fff3d8;color:#163052;border-color:#f5d58d}
   #hero-details .identity{position:relative;text-align:center;flex:2;min-height:8em;isolation:isolate;background:radial-gradient(ellipse at 50% 78%,#8ee0d570,transparent 57%)}
   #hero-details .hero-portrait{position:absolute;width:64%;height:calc(100% - 4.3em);object-fit:contain;left:18%;bottom:4.3em;z-index:-1;filter:drop-shadow(0 .3em .2em #07172a80)}
   #hero-details .hero-name{position:absolute;left:0;top:0;text-align:left} #hero-details h1{margin:0;font-size:1.5em} #hero-details .hero-name p{margin:.15em 0}
   #hero-details .hero-arrows{position:absolute;inset:44% 0 auto;display:flex;justify-content:space-between;pointer-events:none}
   #hero-details .hero-arrows button{pointer-events:auto;min-height:0;padding:0 .2em;border:0;background:transparent;color:#9deaff;font-size:3.4em;font-weight:800;line-height:.8;text-shadow:0 1px 5px #07172a}
   #hero-details .gear-slots{position:absolute;bottom:.25em;left:18%;width:64%;height:3.8em;display:flex;gap:.25em;justify-content:center}
   #hero-details .gear-slot{position:relative;flex:1;aspect-ratio:1;min-height:0;padding:.2em;border:2px solid var(--rarity);border-radius:.55em;background:linear-gradient(145deg,color-mix(in srgb,var(--rarity) 60%,#122241),#182843);box-shadow:inset 0 1px #fff8,0 .2em .2em #07172a80}
   #hero-details button.gear-slot{min-height:0;padding:.2em;border:2px solid var(--rarity);background:linear-gradient(145deg,color-mix(in srgb,var(--rarity) 60%,#122241),#182843)}
   #hero-details .gear-slot[aria-pressed=true]{outline:2px solid #ffe28c;outline-offset:2px} #hero-details .gear-slot small{position:absolute;top:.15em;left:0;width:100%;color:white;font-size:.68em;white-space:nowrap;z-index:1} #hero-details .gear-slot .lamp-art{display:block;width:100%} #hero-details .gear-empty{position:absolute;inset:0;display:grid;place-items:center;font-size:.72em;color:#c3cbd8}
   #hero-details button.gear-placeholder{cursor:default;color:#d6e1f0;background:#192e48}
   #hero-details .power-bar{display:flex;justify-content:space-around;gap:.4em;flex:none;padding:.45em .25em;border:1px solid #dcb957;border-radius:.6em;background:linear-gradient(#806d42,#3a372d);font-weight:bold}
   #hero-details .tabs{display:flex;flex:none;gap:1px;margin-bottom:-.45em;z-index:1} #hero-details .tabs button{flex:1;border-radius:.5em .5em 0 0;font-weight:700}
   #hero-details .pane{overflow:auto;flex:1;min-height:5em;overflow-wrap:anywhere;background:#fff4df;color:#20304a;border-radius:0 0 .3em .3em;padding:.8em 1em}
   #hero-details .pane h2{font-size:1.1em;margin:0} #hero-details .pane p{margin:.45em 0} #hero-details small{display:block;color:#536279}
   #hero-details progress{width:100%;accent-color:#d5a641} #hero-details details{margin:.5em 0} #hero-details summary{cursor:pointer;padding:.5em 0} #hero-details dl{display:grid;grid-template-columns:repeat(3,1fr);gap:.5em;margin:.5em 0} #hero-details dd{margin:0}
   #hero-details article{border-bottom:1px solid #bdc4ce;padding:.7em 0} #hero-details article:last-child{border:0}
   #hero-details .skill-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.35em;margin-bottom:.65em}
   #hero-details .skill-grid.gear-slots{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));height:3.8em}
   #hero-details .skill-card{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.15em;min-width:0;min-height:0;height:100%;padding:.2em;border:1px solid #738eac;background:linear-gradient(145deg,#28496d,#152943);color:#fff1d1;border-radius:.45em;font-size:.7em}
   #hero-details .skill-card[aria-pressed=true]{background:linear-gradient(145deg,#28496d,#152943);color:#fff1d1;border:2px solid #ffd971;box-shadow:0 0 .55em #e7b94d99}
   #hero-details .skill-icon{position:relative;width:2.6em;height:2.6em;display:grid;place-items:center}
   #hero-details .skill-icon i{position:absolute;inset:0;background-repeat:no-repeat;border-radius:.25em}
   #hero-details .skill-card[data-scaffold=true]{opacity:.62}
   #hero-details .skill-slot{font-weight:650;color:#374b67}
   #hero-details .skill-icon b{position:relative;color:#fff;font-size:1.4em;line-height:1;text-shadow:0 1px 2px #13223b,1px 0 #13223b,-1px 0 #13223b}
   #hero-details .skill-card small{width:100%;overflow:hidden;text-align:center;font-size:.85em;line-height:1.15;max-height:2.3em;color:inherit}
   #hero-details .skill-pages{display:flex;align-items:center;justify-content:space-between;gap:.5em;margin:.2em 0 .5em}
   #hero-details .skill-pages{font-size:.85em} #hero-details .skill-pages button{min-height:1.8em;padding:.15em .5em;background:#e4e8ed;color:#243653;border-color:#9ba9bb}
   #hero-details .skill-pages button:disabled{opacity:.45;cursor:default}
   #hero-details .skill-meta{font-weight:650;color:#374b67}
   #hero-details[data-tab=skills] .pane{display:flex;flex-direction:column;gap:.5em;overflow:hidden;color:#372d20}
   #hero-details article.skill-frame{display:flex;flex-direction:column;flex:0 1 auto;min-height:0;max-height:100%;overflow:hidden;padding:0;border:1px solid #a28b61;border-radius:.7em;background:linear-gradient(#fff6df,#eddfbd);font-size:clamp(12px,calc(14px * var(--hero-scale)),16px)}
   #hero-details .skill-heading{display:flex;align-items:center;gap:.5em;padding:0 .6em;border-bottom:1px solid #ccb991;flex:none}
   #hero-details .skill-heading>.skill-icon{flex:none;width:2em;height:2em}
   #hero-details .skill-heading .skill-slot{font-size:.75em;color:#786348}
   #hero-details .skill-heading h2{font-size:1.1em;color:#372d20;line-height:1.2}
   #hero-details .skill-heading .skill-metrics{margin-left:auto;flex:none;min-height:44px;padding:0 .3em;border:0;border-radius:.3em;background:transparent;color:#59482e;font-size:.75em;text-align:left}
   #hero-details .skill-metrics span{display:flex;align-items:center;gap:.3em;line-height:1.6}
   #hero-details .skill-metrics svg{width:1.1em;height:1.1em;fill:none;stroke:currentColor;stroke-width:1.7}
   #hero-details .skill-metric-label{flex:none;margin:0;padding:.4em .7em;font-size:.75em;color:#59482e;background:#f1e0bb}
   #hero-details .skill-body{min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#bda36d #f4e6c8;padding:.5em .7em;line-height:1.35}
   #hero-details .skill-body:focus-visible{outline:2px solid #8d672a;outline-offset:-3px}
   #hero-details .skill-body .skill-effect{margin:0 0 .35em}
   #hero-details .skill-body .skill-effect:last-child{margin-bottom:0}
   #hero-details .skill-rules{border-top:1px dotted #ab9367;margin-top:.7em;padding-top:.4em;font-size:.875em;color:#5a4a33}
   #hero-details .hero-tickets{display:flex;align-items:center;gap:.5em;margin:.5em 0;padding:.45em;border:1px solid #b99c66;border-radius:.5em;background:#fff9eb}
   #hero-details .hero-ticket-art{width:1.7em;height:1.7em;flex:none;background-image:url('assets/images/progression/hero-tickets.png');background-size:200% 133.333%;background-repeat:no-repeat}
   #hero-details .hero-level-up{width:100%;font-weight:800}
   #hero-details .hero-ticket-notice{min-height:1.2em;color:#36465c}
  `;document.head.append(style);content=document.createElement('div');host.append(content);document.body.append(host);
 }
 const rect=canvas.getBoundingClientRect(),scale=rect.width/360;
 Object.assign(host.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,padding:`${(globals.CombatBossFallbackVisible?96:14)*scale}px ${14*scale}px ${66*scale}px`,fontSize:`${14*scale}px`});
 host.style.setProperty('--hero-scale',scale);
 host.hidden=false;host.dataset.tab=currentTab;
 const ticketBalance=combatProgression?.ticketCount(hero.heroInstanceKey)||0;
 const key=JSON.stringify([index,currentTab,activeSkillIndex,hero.currentLevel,currentTab==='orb'?hero.currentEXP:null,hero.maxHP,hero.stats,roster.map(member=>member.currentLevel),globals.Equipment,ticketBalance,ticketNotice]);
 if(key!==lastKey){
  lastKey=key;
  const focused=content.contains(document.activeElement)?document.activeElement:null;
  const focusLabel=focused?.getAttribute('aria-label')||focused?.textContent;
  content.replaceChildren();
  const el=(tag,text,parent=content)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;parent.append(node);return node;};
  const button=(parent,text,action)=>{const node=el('button',text,parent);node.type='button';node.onclick=action;return node;};
  // Preloaded art when available; otherwise load directly so one failed preload never blanks the hero.
  const portrait=(owner,parent)=>{const image=heroPortraitImages?.[heroArtKey(owner)],img=el('img',null,parent);img.src=image?.src||runtimeAssetUrl(heroArtPath(owner));img.alt=heroDefinition(owner).name;};
  const identity=el('header');identity.className='identity';portrait(hero,identity);identity.querySelector('img')?.classList.add('hero-portrait');
  const name=el('div',null,identity);name.className='hero-name';el('h1',definition.name,name);el('p',`Lv. ${hero.currentLevel} · ${definition.role}`,name);el('p',`CP ${computeCombatPower(hero)}`,name);
  const arrows=el('nav',null,identity);arrows.className='hero-arrows';arrows.setAttribute('aria-label','Choose hero');
  const selectHero=(offset)=>{gameState.selectedHero=(index+offset+roster.length)%roster.length;};
  button(arrows,'❮',()=>selectHero(-1)).setAttribute('aria-label','Previous hero');
  button(arrows,'❯',()=>selectHero(1)).setAttribute('aria-label','Next hero');
  let selectedAbility;
  if(currentTab==='skills'){
   const abilities=definition.skills;activeSkillIndex=Math.max(-1,Math.min(activeSkillIndex,abilities.length-1));
   const grid=el('div',null,identity);grid.className='skill-grid gear-slots';grid.setAttribute('aria-label','Hero skills');
   for(const [skillIndex,ability] of abilities.entries()){
    const card=button(grid,'',()=>{activeSkillIndex=activeSkillIndex===skillIndex?-1:skillIndex;});
    card.className='skill-card';card.dataset.slot=ability.slot;card.dataset.scaffold=String(!!ability.scaffold);
    card.setAttribute('aria-label',`Inspect ${SLOT_LABELS[skillIndex]}: ${ability.displayName}`);card.setAttribute('aria-pressed',String(skillIndex===activeSkillIndex));
    const icon=el('span',null,card);icon.className='skill-icon';icon.setAttribute('aria-hidden','true');
    el('i',null,icon).style.cssText=iconStyle(ability.icon);el('small',ability.displayName,card);
   }
   selectedAbility=abilities[activeSkillIndex]||heroBasicSkill(definition);
  }
  const pane=el('div');pane.className='pane';pane.setAttribute('aria-label',`${currentTab} view`);
  if(currentTab!=='skills')renderHeroGear({stage:identity,pane,hero,economy:equipmentProgress,showDetails:currentTab==='gear',onGearTab:()=>{currentTab='gear';}});
  const power=el('div');power.className='power-bar';el('span',`ATK ${hero.stats.ATK}`,power);el('span',`DEF ${hero.stats.DEF}`,power);el('span',`HP ${hero.maxHP}`,power);
  const tabs=el('nav');tabs.className='tabs';tabs.setAttribute('aria-label','Hero management');
  for(const [id,label] of [['orb','Orb'],['gear','Gear'],['skills','Skills']]){const tab=button(tabs,label,()=>{currentTab=id;});tab.setAttribute('aria-pressed',String(currentTab===id));}
  if(currentTab==='orb'){
   el('h2','Level progress',pane);
   const exp=el('progress',null,pane);exp.max=hero.EXPToNextLevel||1;exp.value=hero.currentLevel>=hero.maxLevel?1:hero.currentEXP;exp.setAttribute('aria-label','Level EXP');
   el('small',hero.currentLevel>=hero.maxLevel?'Maximum level':`${hero.currentEXP} / ${hero.EXPToNextLevel} EXP`,pane);
   const ticketRow=el('div',null,pane);ticketRow.className='hero-tickets';
   const ticketArt=el('span',null,ticketRow);ticketArt.className='hero-ticket-art';ticketArt.setAttribute('role','img');ticketArt.setAttribute('aria-label',`${definition.name} tickets`);ticketArt.style.backgroundPosition=TICKET_QUADRANT[definition.name]||'0% 0%';
   const ticketCopy=el('span',`${ticketBalance} ${definition.name} tickets`,ticketRow);
   const levelCost=heroTicketLevelCost(hero.currentLevel);
   const levelUp=button(pane,hero.currentLevel>=hero.maxLevel?'Maximum level':`Level Up · ${levelCost} tickets`,()=>{
    const result=combatProgression?.spendLevelUp(hero.heroInstanceKey)||{ok:false,reason:'unavailable'};
    ticketNotice=result.ok?`${definition.name} reached level ${result.level}.`:result.reason==='insufficient_tickets'?`Need ${result.cost} ${definition.name} tickets.`:result.reason==='max_level'?'This hero is at the current level cap.':'Ticket spend could not be saved.';
    lastKey='';
   });
   levelUp.className='hero-level-up';levelUp.disabled=hero.currentLevel>=hero.maxLevel||ticketBalance<levelCost||!combatProgression;
   if(ticketNotice)el('small',ticketNotice,pane).className='hero-ticket-notice';
   const details=el('details',null,pane);el('summary','Current stats',details);const stats=el('dl',null,details);
   for(const [label,value] of Object.entries({HP:hero.maxHP,...hero.stats})){const cell=el('div',null,stats);el('dt',label==='MAG'?'MATK':label,cell);el('dd',String(value),cell);}
  }else if(currentTab==='skills'){
   const ability=selectedAbility,detail=el('article',null,pane);detail.dataset.skill=ability.skillId;detail.dataset.slot=ability.slot;detail.dataset.locked=String(!!ability.scaffold);
   detail.className='skill-frame';
   const heading=el('header',null,detail);heading.className='skill-heading';
   const icon=el('span',null,heading);icon.className='skill-icon';icon.setAttribute('aria-hidden','true');el('i',null,icon).style.cssText=iconStyle(ability.icon);
   const title=el('div',null,heading);el('small',activeSkillIndex<0?'Basic':SLOT_LABELS[activeSkillIndex],title).className='skill-slot';el('h2',ability.displayName,title);
   const targeted=ability.slot==='special'||ability.slot==='basic';
   const scope=targeted?heroSkillRange(ability,hero):ability.skillId==='ethereal_aura'?`Foes within ${actorAttackReach({...hero,kind:'hero'})} units`:'Self';
   const metricLabel=`Range: ${scope}${ability.cooldownSeconds!=null?` · Cooldown: ${ability.cooldownSeconds}s${ability.provisionalCooldown?' (provisional)':''}`:''}`;
   const metrics=button(heading,'',()=>{label.hidden=!label.hidden;metrics.setAttribute('aria-expanded',String(!label.hidden));});metrics.className='skill-metrics';metrics.title=metricLabel;metrics.setAttribute('aria-label',metricLabel);metrics.setAttribute('aria-expanded','false');
   const metric=(path,value)=>{const row=el('span',null,metrics),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const mark=document.createElementNS(svg.namespaceURI,'path');mark.setAttribute('d',path);svg.append(mark);row.append(svg,document.createTextNode(value));};
   metric('M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18M12 0v7m0 10v7M0 12h7m10 0h7',targeted?(ability.targetRule.kind==='party'?'Party':`${actorAttackReach({...hero,kind:'hero'})}`):ability.skillId==='ethereal_aura'?`${actorAttackReach({...hero,kind:'hero'})}`:'Self');
   if(ability.cooldownSeconds!=null)metric('M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18M12 6v6l4 2',`${ability.cooldownSeconds}s${ability.provisionalCooldown?'†':''}`);
   const label=el('div',metricLabel,detail);label.className='skill-metric-label';label.hidden=true;
   const body=el('div',null,detail);body.className='skill-body';body.tabIndex=0;body.setAttribute('role','region');body.setAttribute('aria-label',`${ability.displayName} effect and rules`);
   const copy=heroSkillCopy(ability);
   for(const line of copy.lines){const effect=el('p',null,body);effect.className='skill-effect';for(const part of line.split(/(\d+(?:\.\d+)?(?:%|s|\+)?)/g)){if(/^\d/.test(part))el('strong',part,effect);else effect.append(document.createTextNode(part));}}
   if(ability.scaffold||copy.rules?.length){const rules=el('div',null,body);rules.className='skill-rules';if(ability.scaffold)el('p','Late-game resonance · Not yet available',rules);for(const rule of copy.rules||[])el('p',rule,rules);}
  }
  content.append(power,tabs,pane);
  if(revealSkill&&currentTab==='skills'){revealSkill=false;const card=content.querySelector('.skill-card[data-slot=special]');card?.focus({preventScroll:true});pane.querySelector('article[data-slot=special]')?.scrollIntoView({block:'nearest'});}
  if(focusLabel){const replacement=[...content.querySelectorAll('button')].find(node=>(node.getAttribute('aria-label')||node.textContent)===focusLabel);replacement?.focus({preventScroll:true});}
 }
 return {mode:'details',selectedSkillIndex:activeSkillIndex,hitZones:{skillNodes:[]}};
}

function heroSkillRange(ability,hero){
 const {kind}=ability.targetRule,reach=actorAttackReach({...hero,kind:'hero'});
 if(kind==='party')return 'Whole party';
 if(kind==='inRangeEnemies')return `Every foe within ${reach} units`;
 return `${reach}-unit actor reach`;
}
