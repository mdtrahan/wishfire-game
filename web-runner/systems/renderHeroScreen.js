import {renderHeroGear} from './heroGearUI.mjs';
import {runtimeAssetUrl} from './runtimeAssetUrl.mjs';
import {computeCombatPower} from '../src/core/combatPower.mjs';
import {HERO_DEFINITIONS,heroDefinition,heroSkillUnlocked} from '../src/core/heroDefinitions.mjs';
import {createHeroProgressStore} from '../src/core/heroProgression.mjs';
import {heroTicketLevelCost} from '../src/core/combatProgressionRules.mjs';
import {resolveCombatMovementTuning} from '../src/core/combatMovementTuning.mjs';
import {heroArtKey} from '../state/heroArtAssets.mjs';
import {actorAttackReach} from '../../src/core/arenaCombatRules.mjs';

let host,content,lastKey,currentTab='heroes',subPanel='',activeSkillIndex=-1,activeHeroIndex=-1,ticketNotice='';
const TICKET_QUADRANT={Fara:'12% 12%',Hondo:'94% 12%',Kaja:'12% 89%',Runa:'94% 89%'};
const STAT_ICONS={ATK:'stat-atk',DEF:'stat-def',MAG:'stat-matk',RES:'stat-res'};
const SUB_PANELS={
 formation:{title:'Formation',body:leader=>[`Current leader: ${leader}.`,'The formation board, leader choice and presets arrive in a later update.']},
 star:{title:'Star Up',body:()=>['Star Up is coming soon.','Stars will add a second progression track alongside hero levels.']},
 resonance:{title:'Resonance',body:()=>['Resonance is coming soon.','Two passive slots will borrow skills from other heroes as a later progression layer.'],slots:true},
};

// Star Up is not approved yet, so every hero shows an empty (grey) meter. Tiers fill five slots: bronze 1-5, silver 6-10, gold 11-15.
const STAR_TIERS=['bronze','silver','gold'];
function starMeter(hero,parent){
 const count=Math.max(0,Math.min(15,Math.floor(Number(hero?.stars)||0))),tier=Math.max(0,Math.ceil(count/5)-1),filled=count?count-tier*5:0;
 const meter=document.createElement('div');meter.className='stars';meter.setAttribute('role','img');meter.setAttribute('aria-label',count?`${count} stars`:'No stars yet; Star Up coming soon');
 for(let slot=0;slot<5;slot++){const star=document.createElement('span');star.textContent='★';if(slot<filled)star.dataset.tier=STAR_TIERS[tier];else if(tier>0)star.dataset.tier=STAR_TIERS[tier-1];meter.append(star);}
 parent.append(meter);return meter;
}

export function hideHeroScreen(){if(host)host.hidden=true;}

export function renderHeroScreen({equipmentProgress,combatProgression,canvas,gameState,fnContext,heroPortraitImages}){
 const globals=fnContext.state.globals;
 globals.HeroProgress ||= createHeroProgressStore();
 const roster=Object.keys(HERO_DEFINITIONS).map(key=>globals.HeroProgress.heroes[key]).filter(Boolean);
 if(!roster.length)return {mode:'details',selectedSkillIndex:0,hitZones:{skillNodes:[]}};
 const index=((Number(gameState.selectedHero)||0)%roster.length+roster.length)%roster.length;
 const hero=roster[index],definition=heroDefinition(hero),entries=[...definition.actives,null];
 if(activeHeroIndex!==index){activeHeroIndex=index;activeSkillIndex=definition.actives.length-1;ticketNotice='';}
 activeSkillIndex=Math.max(0,Math.min(activeSkillIndex,entries.length-1));
 if(!host){
  host=document.createElement('section');host.id='hero-details';host.setAttribute('aria-label','Hero details');
  const style=document.createElement('style');style.textContent=`
   #hero-details{position:fixed;z-index:30;color:#fff1d1;background:linear-gradient(#20385c,#1a2840 60%,#121c2c);box-sizing:border-box;overflow:hidden;font:14px/1.35 system-ui}
   #hero-details[hidden]{display:none} #hero-details *{box-sizing:border-box;min-width:0} #hero-details>div{height:100%;display:flex;flex-direction:column;gap:.4em}
   #hero-details button{background:#192e48;color:inherit;border:1px solid #9eafc2;border-radius:.5em;padding:.3em;font:inherit;cursor:pointer}
   #hero-details button:focus-visible{outline:3px solid #50cfff;outline-offset:2px} #hero-details button:disabled{opacity:.5;cursor:default}
   #hero-details .identity{position:relative;flex:0 0 21em;border-radius:.6em;overflow:hidden;isolation:isolate;background:radial-gradient(ellipse 60% 55% at 28% 52%,#4f7fa8 0%,#2d5079 45%,#1b3150 100%)}
   #hero-details .identity::after{content:'';position:absolute;left:4%;width:48%;bottom:5.3em;height:1.6em;border-radius:50%;background:radial-gradient(#0b1626aa,transparent 70%);z-index:-1}
   #hero-details .hero-portrait{position:absolute;left:2%;width:52%;top:.6em;bottom:5.6em;height:calc(100% - 6.2em);object-fit:contain;object-position:50% 100%;z-index:0;filter:drop-shadow(0 .3em .25em #07172a80)}
   #hero-details .formation-button{position:absolute;left:.4em;top:.4em;z-index:2;width:2.7em;height:2.4em;padding:.3em;display:grid;grid-template-columns:repeat(4,1fr);gap:.12em;background:#132238cc;border-color:#7e93ad}
   #hero-details .formation-button i{display:block;border-radius:.1em;background:#5d7290} #hero-details .formation-button i.lead{background:#ffd56e}
   #hero-details .hero-arrows{position:absolute;left:0;width:56%;top:38%;display:flex;justify-content:space-between;pointer-events:none;z-index:2}
   #hero-details .hero-arrows button{pointer-events:auto;min-height:0;padding:0 .25em;border:0;background:transparent;color:#cfe9ff;font-size:2em;font-weight:800;line-height:1;text-shadow:0 1px 4px #07172a}
   #hero-details .hero-name{position:absolute;left:2%;width:52%;bottom:.55em;z-index:1;display:flex;flex-direction:column;align-items:center;gap:.3em}
   #hero-details h1{margin:0;width:100%;padding:.12em .5em;text-align:center;font-size:1.3em;letter-spacing:.04em;color:#2a2010;background:linear-gradient(#fff8e4,#ecd7a4);border:2px solid #b88e3c;border-radius:.6em;box-shadow:0 .15em .3em #07172a80}
   #hero-details .stars{display:flex;justify-content:center;gap:.1em;line-height:1}
   #hero-details .stars span{font-size:1.15em;color:#59667a;text-shadow:0 0 1px #0b1626,0 1px 1px #0b1626}
   #hero-details .stars span[data-tier=bronze]{color:#d0884a} #hero-details .stars span[data-tier=silver]{color:#d9e2ec} #hero-details .stars span[data-tier=gold]{color:#ffcf3f}
   #hero-details .skill-panel{position:absolute;right:.45em;top:2.75em;bottom:.45em;width:43%;z-index:2;display:flex;flex-direction:column;color:#1b2a42;background:#fffdf7;border:2px solid #f2c75c;border-radius:.55em;box-shadow:0 0 0 2px #1b2a42,0 .35em .8em #050b16b0;overflow:hidden}
   #hero-details .skill-panel footer{display:flex;align-items:center;gap:.25em;padding:.3em .35em;background:#1b2a42;color:#fff4d6}
   #hero-details .skill-panel footer button{min-height:0;padding:0 .3em;border:0;background:transparent;color:#ffd56e;font-size:1.1em;font-weight:800;line-height:1.2}
   #hero-details .skill-panel footer small{flex:1;text-align:center;font-size:.72em;color:#c9d6e6}
   #hero-details .skill-panel article{flex:1;overflow:auto;padding:.4em .5em;font-size:.74em;overflow-wrap:anywhere}
   #hero-details .skill-panel h2{margin:0;font-size:1.3em;line-height:1.15;color:#13213a}
   #hero-details .skill-panel article>small{display:inline-block;margin:.25em 0;padding:.05em .45em;border-radius:.6em;font-weight:700;background:#dff3ea;color:#1f6a4f}
   #hero-details .skill-panel article[data-locked=true]>small{background:#eceff3;color:#5b6678}
   #hero-details .skill-panel p{margin:.3em 0} #hero-details .skill-panel p+p{font-size:.92em} #hero-details .skill-meta{font-weight:650;color:#3a4d6a}
   #hero-details .tabs{display:flex;flex:none;gap:.3em} #hero-details .tabs button{flex:1;min-height:2.3em;font-weight:700;border-radius:.45em;background:#1d3150;border-color:#3f5675;color:#c8d5e6}
   #hero-details .tabs button[aria-pressed=true]{background:#fff3d8;color:#163052;border-color:#fff3d8}
   #hero-details .pane{overflow:auto;flex:1;min-height:5em;overflow-wrap:anywhere;background:#fff4df;color:#20304a;border-radius:.45em;padding:.55em .6em}
   #hero-details .pane h2{font-size:1em;margin:0 0 .35em} #hero-details .pane p{margin:.35em 0} #hero-details small{display:block}
   #hero-details .roster{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.45em}
   #hero-details .roster-card{position:relative;display:flex;flex-direction:column}
   #hero-details .card-select{position:relative;z-index:1;display:block;width:100%;aspect-ratio:1/1.05;padding:0;overflow:hidden;border:2px solid #6b8590;border-radius:.4em;background:radial-gradient(ellipse 75% 65% at 50% 38%,#ffffff 0%,#eef2f6 55%,#d5dce5 100%)}
   #hero-details .card-select img{position:absolute;left:-40%;top:-2%;width:180%;height:auto;max-width:none}
   #hero-details .roster-card[data-selected=true] .card-select{border-color:#2fb3a6;box-shadow:0 0 0 2px #2fb3a655}
   #hero-details .leader-badge{position:absolute;left:50%;top:-.15em;transform:translateX(-50%);z-index:1;padding:0 .4em;border-radius:.3em;background:#2d7a5f;color:#fff;font-size:.62em;font-weight:700;white-space:nowrap}
   #hero-details .hero-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.4em;margin-top:.6em}
   #hero-details .hero-actions button{min-height:2.2em;font-size:.82em;font-weight:800;background:linear-gradient(#fffaf0,#f1e2bf);color:#1d3150;border:1px solid #b99c66;box-shadow:0 .12em 0 #b99c66}
   #hero-details .hero-actions button:disabled{opacity:1;background:#e3e6ea;color:#7d8794;border-color:#b8bfc8;box-shadow:none}
   #hero-details .ticket-bar{position:relative;display:flex;align-items:center;height:1.3em;width:84%;flex:none;margin-left:0;border-radius:1em;background:#0a0e15;box-shadow:inset 0 .1em .15em #000c}
   #hero-details .ticket-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:1em;background:linear-gradient(#9cecff 0%,#38b8ff 40%,#1a8cff 100%);box-shadow:inset 0 .12em 0 #ffffffb3,0 0 .35em #2aa6ff99}
   #hero-details .ticket-bar span{position:relative;flex:1;padding-left:.9em;text-align:center;white-space:nowrap;font-size:.7em;letter-spacing:-.02em;font-weight:900;color:#fff;text-shadow:-1px -1px 0 #14213a,1px -1px 0 #14213a,-1px 1px 0 #14213a,1px 1px 0 #14213a}
   #hero-details .ticket-strip{position:relative;display:flex;align-items:center;justify-content:center;margin:-1.1em .07em 0;padding:1.65em .25em .6em;border-radius:0 0 .5em .5em;background:linear-gradient(#2a3446,#1c2433);box-shadow:0 .1em .2em #0b162655}
   #hero-details .ticket-strip .hero-ticket-art{position:absolute;z-index:1;left:-.4em;bottom:.77em;width:1.45em;height:.97em;flex:none;background-image:url('assets/images/progression/hero-tickets.png');background-size:240% 240%;background-repeat:no-repeat;filter:drop-shadow(0 1px 1px #14213a)}
   #hero-details .hero-ticket-notice{margin-top:.5em;color:#36465c;font-size:.8em}
   #hero-details .sub-panel header{display:flex;align-items:center;justify-content:space-between;margin-bottom:.4em}
   #hero-details .sub-panel header h2{margin:0;padding:.1em .8em;border-radius:1em;background:#1b2a42;color:#fff4d6}
   #hero-details .sub-panel header button{min-height:0;width:1.9em;height:1.9em;padding:0;background:#5b6678;color:#fff;border:0;font-weight:800}
   #hero-details .resonance-slots{display:grid;grid-template-columns:1fr 1fr;gap:.5em;margin:.5em 0}
   #hero-details .resonance-slots span{display:grid;place-items:center;min-height:3.4em;border:2px dashed #b9c1cc;border-radius:.5em;color:#6b778a;font-size:.8em;text-align:center}
   #hero-details .gear-slots{display:flex;gap:.45em;justify-content:center;height:4.1em;margin-bottom:.3em}
   #hero-details .gear-slot{position:relative;flex:0 0 4.1em;aspect-ratio:1;min-height:0;padding:.2em;border:2px solid var(--rarity);border-radius:.55em;background:linear-gradient(145deg,color-mix(in srgb,var(--rarity) 60%,#122241),#182843);box-shadow:inset 0 1px #fff8,0 .2em .2em #07172a50}
   #hero-details button.gear-slot{min-height:0;padding:.2em;border:2px solid var(--rarity);background:linear-gradient(145deg,color-mix(in srgb,var(--rarity) 60%,#122241),#182843)}
   #hero-details .gear-slot[aria-pressed=true]{outline:2px solid #e2a92c;outline-offset:2px} #hero-details .gear-slot small{position:absolute;top:.15em;left:0;width:100%;color:white;font-size:.68em;white-space:nowrap;z-index:1} #hero-details .gear-slot .lamp-art{display:block;width:100%} #hero-details .gear-empty{position:absolute;inset:0;display:grid;place-items:center;font-size:.72em;color:#c3cbd8}
   #hero-details .pane[data-view=gear]{display:flex;flex-direction:column}
   #hero-details .gear-detail{padding:.45em .6em;text-align:center;font-size:.85em;border-radius:.5em;background:#1b2a42;color:#fff4d6;box-shadow:inset 0 1px #ffffff22} #hero-details .gear-detail h2{margin:0;font-size:1.05em;color:#fff4d6} #hero-details .gear-detail small{color:#b9c8da} #hero-details .gear-detail p{margin:.2em 0 0}
   #hero-details .stat-block{margin-top:auto;padding-top:.3em} #hero-details .stat-head{display:flex;justify-content:space-between;font-size:.8em;font-weight:800;color:#36465c}
   #hero-details .stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.3em;margin:.25em 0 0;padding:0}
   #hero-details .stat-grid div{display:flex;align-items:center;gap:.3em;padding:.3em .4em;border-radius:.4em;background:#1b2a42;color:#fff4d6}
   #hero-details .stat-grid img,#hero-details .stat-grid b{width:1.4em;height:1.4em;flex:none;object-fit:contain}
   #hero-details .stat-grid b{display:grid;place-items:center;border-radius:50%;background:#3d5677;font-size:.55em;white-space:nowrap;line-height:1}
   #hero-details .stat-grid dt{font-size:.68em;color:#b9c8da} #hero-details .stat-grid dd{margin:0 0 0 auto;font-weight:800}
   #hero-details .orb-placeholder{display:flex;align-items:center;gap:.6em;padding:.7em;border-radius:.5em;background:#1b2a42;color:#fff4d6}
   #hero-details .orb-placeholder small{color:#b9c8da}
  `;document.head.append(style);content=document.createElement('div');host.append(content);document.body.append(host);
 }
 const rect=canvas.getBoundingClientRect(),scale=rect.width/360;
 Object.assign(host.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,padding:`${(globals.CombatBossFallbackVisible?96:14)*scale}px ${12*scale}px ${66*scale}px`,fontSize:`${14*scale}px`});
 host.hidden=false;host.dataset.tab=currentTab;
 const tickets=Object.fromEntries(roster.map(member=>[member.heroInstanceKey,combatProgression?.ticketCount(member.heroInstanceKey)||0]));
 const leaderName=resolveCombatMovementTuning(globals).leaderName;
 const key=JSON.stringify([index,currentTab,subPanel,activeSkillIndex,leaderName,roster.map(member=>[member.currentLevel,member.currentEXP,member.maxHP,member.stats]),hero.hp,globals.Equipment,tickets,ticketNotice]);
 if(key!==lastKey){
  lastKey=key;
  const focused=content.contains(document.activeElement)?document.activeElement:null;
  const focusLabel=focused?.getAttribute('aria-label')||focused?.textContent;
  content.replaceChildren();
  const el=(tag,text,parent=content)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;parent.append(node);return node;};
  const button=(parent,text,action)=>{const node=el('button',text,parent);node.type='button';node.onclick=()=>{action();lastKey='';};return node;};
  const portrait=(owner,parent)=>{const image=heroPortraitImages[heroArtKey(owner)];if(image?.src){const img=el('img',null,parent);img.src=image.src;img.alt=heroDefinition(owner).name;return img;}};
  const selectHero=target=>{gameState.selectedHero=(target+roster.length)%roster.length;};

  const identity=el('header');identity.className='identity';
  portrait(hero,identity)?.classList.add('hero-portrait');
  const formation=button(identity,null,()=>{subPanel=subPanel==='formation'?'':'formation';currentTab='heroes';});
  formation.className='formation-button';formation.setAttribute('aria-label','Formation');
  for(let cell=0;cell<12;cell++)el('i',null,formation).className=cell===5?'lead':'';
  const arrows=el('nav',null,identity);arrows.className='hero-arrows';arrows.setAttribute('aria-label','Choose hero');
  button(arrows,'‹',()=>selectHero(index-1)).setAttribute('aria-label','Previous hero');
  button(arrows,'›',()=>selectHero(index+1)).setAttribute('aria-label','Next hero');
  const name=el('div',null,identity);name.className='hero-name';
  el('h1',definition.name,name);starMeter(hero,name);

  const panel=el('aside',null,identity);panel.className='skill-panel';panel.setAttribute('aria-label','Hero skills');
  const panelNav=document.createElement('footer');
  const previous=button(panelNav,'‹',()=>{activeSkillIndex=(activeSkillIndex-1+entries.length)%entries.length;});previous.setAttribute('aria-label','Previous skill');
  el('small',`${activeSkillIndex+1} / ${entries.length}`,panelNav).setAttribute('aria-label','Skill index');
  const next=button(panelNav,'›',()=>{activeSkillIndex=(activeSkillIndex+1)%entries.length;});next.setAttribute('aria-label','Next skill');
  const ability=entries[activeSkillIndex],detail=el('article',null,panel);
  panel.append(panelNav);
  if(ability){
   const abilities=definition.actives,unlocked=heroSkillUnlocked(hero,ability);detail.dataset.locked=String(!unlocked);detail.dataset.skill=ability.skillId;
   el('h2',ability.displayName,detail);
   el('small',unlocked?'Unlocked · Lv. '+ability.unlockLevel:'Unlocks at Lv. '+ability.unlockLevel,detail);
   el('p',ability.description.replaceAll('magic-tagged actions','magic skills'),detail);
   el('p',`Range: ${heroSkillRange(ability,hero)} · Cooldown: ${ability.cooldownSeconds}s`,detail).className='skill-meta';
   el('p',`When: ${ability.conditionLabel}`,detail);
   detail.setAttribute('aria-label',`Skill ${abilities.indexOf(ability)+1} of ${abilities.length}`);
  }else{detail.dataset.skill='basic';el('h2','Basic Attack',detail);el('small','Always available',detail);el('p',definition.basic.description,detail);}

  const tabs=el('nav');tabs.className='tabs';tabs.setAttribute('aria-label','Hero management');
  for(const [id,label] of [['heroes','Heroes'],['gear','Gear'],['orb','Orb']]){const tab=button(tabs,label,()=>{currentTab=id;subPanel='';});tab.setAttribute('aria-pressed',String(currentTab===id));}
  const pane=el('div');pane.className='pane';pane.dataset.view=currentTab;pane.setAttribute('aria-label',`${currentTab} view`);

  if(currentTab==='heroes'&&subPanel){
   const spec=SUB_PANELS[subPanel],sheet=el('section',null,pane);sheet.className='sub-panel';sheet.dataset.panel=subPanel;
   const head=el('header',null,sheet);el('h2',spec.title,head);button(head,'✕',()=>{subPanel='';}).setAttribute('aria-label','Close '+spec.title);
   if(spec.slots){const slots=el('div',null,sheet);slots.className='resonance-slots';for(const slot of [1,2])el('span',`Slot ${slot} · Coming soon`,slots);}
   for(const line of spec.body(leaderName))el('p',line,sheet);
  }else if(currentTab==='heroes'){
   const grid=el('div',null,pane);grid.className='roster';grid.setAttribute('aria-label','Party roster');
   for(const [memberIndex,member] of roster.entries()){
    const memberDefinition=heroDefinition(member),selected=memberIndex===index,balance=tickets[member.heroInstanceKey],cost=heroTicketLevelCost(member.currentLevel),memberMaxed=member.currentLevel>=member.maxLevel;
    const card=el('div',null,grid);card.className='roster-card';card.dataset.hero=member.heroInstanceKey;card.dataset.selected=String(selected);
    const pick=button(card,null,()=>selectHero(memberIndex));pick.className='card-select';pick.setAttribute('aria-label',`Select ${memberDefinition.name}, level ${member.currentLevel}`);pick.setAttribute('aria-pressed',String(selected));
    portrait(member,pick);
    if(memberDefinition.name===leaderName)el('span','Leader',card).className='leader-badge';
    const strip=el('div',null,card);strip.className='ticket-strip';
    const art=el('span',null,strip);art.className='hero-ticket-art';art.style.backgroundPosition=TICKET_QUADRANT[memberDefinition.name]||'0% 0%';
    const bar=el('div',null,strip);bar.className='ticket-bar';bar.setAttribute('role','img');
    bar.setAttribute('aria-label',memberMaxed?`${memberDefinition.name} at maximum level`:`${balance} of ${cost} ${memberDefinition.name} tickets for the next level`);
    el('i',null,bar).style.width=`${memberMaxed?100:Math.min(100,100*balance/cost)}%`;
    el('span',memberMaxed?'MAX':`${balance}/${cost}`,bar);
   }
   const balance=tickets[hero.heroInstanceKey],cost=heroTicketLevelCost(hero.currentLevel),maxedHero=hero.currentLevel>=hero.maxLevel;
   const actions=el('div',null,pane);actions.className='hero-actions';actions.setAttribute('aria-label',`${definition.name} actions`);
   const levelUp=button(actions,'Level Up',()=>{
    const result=combatProgression?.spendLevelUp(hero.heroInstanceKey)||{ok:false,reason:'unavailable'};
    ticketNotice=result.ok?`${definition.name} reached level ${result.level}.`:result.reason==='insufficient_tickets'?`Need ${result.cost} ${definition.name} tickets.`:result.reason==='max_level'?'This hero is at the current level cap.':'Ticket spend could not be saved.';
   });
   levelUp.className='hero-level-up';levelUp.disabled=maxedHero||balance<cost||!combatProgression;
   levelUp.setAttribute('aria-label',maxedHero?'Maximum level':`Level Up · ${cost} tickets`);
   button(actions,'Star Up',()=>{subPanel='star';});
   button(actions,'Resonance',()=>{subPanel='resonance';});
   if(ticketNotice)el('small',ticketNotice,pane).className='hero-ticket-notice';
  }else if(currentTab==='gear'){
   const slots=el('div',null,pane),itemDetail=el('div',null,pane);itemDetail.className='gear-detail';
   renderHeroGear({stage:slots,pane:itemDetail,hero,economy:equipmentProgress});
   slots.replaceWith(...slots.childNodes);
   const block=el('section',null,pane);block.className='stat-block';
   const head=el('div',null,block);head.className='stat-head';el('span',`Lv. ${hero.currentLevel}`,head);el('span',`CP ${computeCombatPower(hero)}`,head).className='hero-cp';
   const stats=el('dl',null,block);stats.className='stat-grid';stats.setAttribute('aria-label','Hero stats');
   for(const [label,value] of Object.entries({HP:hero.maxHP,...hero.stats})){
    const cell=el('div',null,stats);
    if(STAT_ICONS[label]){const icon=el('img',null,cell);icon.src=runtimeAssetUrl(`images/progression/${STAT_ICONS[label]}.png`);icon.alt='';}else el('b',label.slice(0,2),cell).setAttribute('aria-hidden','true');
    el('dt',label==='MAG'?'MATK':label,cell);el('dd',String(value),cell);
   }
  }else{
   const orb=el('div',null,pane);orb.className='orb-placeholder';orb.setAttribute('aria-label','Orb equipment unavailable');
   const copy=el('div',null,orb);el('h2','Orb slot · Coming soon',copy);el('small','Orb equipment is not available yet.',copy);
  }
  content.append(tabs,pane);
  if(focusLabel){const replacement=[...content.querySelectorAll('button')].find(node=>(node.getAttribute('aria-label')||node.textContent)===focusLabel);replacement?.focus({preventScroll:true});}
 }
 return {mode:'details',selectedSkillIndex:Math.min(activeSkillIndex,definition.actives.length-1),hitZones:{skillNodes:[]}};
}

function heroSkillRange(ability,hero){
 const {kind,shape}=ability.targetRule,reach=actorAttackReach({...hero,kind:'hero'});
 if(shape){
  const extent=shape.kind==='circle'?`radius ${shape.radius} units`:shape.kind==='rectangle'?`${shape.width} × ${shape.height} units`:shape.kind==='horizontalLine'?`${shape.width}-unit line to world X ${shape.toX}`:`${shape.length}-unit cone at ${shape.angleDegrees}°`;
  return `${extent}${['bestArea','firstArea','eventArea'].includes(kind)?`; anchor within ${reach} units`:''}`;
 }
 if(kind==='self')return 'Self';
 if(kind==='party')return `Allies within ${reach} units; foe trigger within ${reach} units`;
 if(kind==='eventChain')return `${ability.targetRule.minimum} other foes after a basic hit`;
 if(kind==='allEnemies')return 'All attackable foes';
 if(kind==='lowestHPAlly'||kind==='slowestAlly')return `Eligible ally within ${reach} units; foe trigger within ${reach} units`;
 return `${reach}-unit actor reach`;
}
