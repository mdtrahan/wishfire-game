import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import {chromium} from 'playwright';
import {createHeroProgressStore,refreshHeroStats,newHeroProgress} from '../web-runner/src/core/heroProgression.mjs';
import {equipmentStats} from '../web-runner/src/core/equipment.mjs';
import {createLampEconomy,generateLampItem} from '../web-runner/src/core/lampGear.mjs';
import {HERO_DEFINITIONS,heroDefinition,heroSkillUnlocked} from '../web-runner/src/core/heroDefinitions.mjs';
import {actorAttackReach} from '../src/core/arenaCombatRules.mjs';
import {heroTicketLevelCost} from '../web-runner/src/core/combatProgressionRules.mjs';
import {EQUIPMENT_SAVE_KEY} from '../web-runner/systems/equipmentStorage.mjs';

const require=createRequire(import.meta.url);
const {detectChromeExecutable}=require('../tools/playwright_support.js');
const HERO_PROGRESS_SAVE_KEY='orka.hero_progress.v2';
const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const artifactDir=path.join(repoRoot,'test-results/hero-redesign');
const profiles=[
 {name:'reference',width:360,height:640,dpr:1},
 {name:'compact-retina',width:216,height:384,dpr:2},
 {name:'live-narrow',width:233,height:452,dpr:2},
 {name:'natural-preview',width:316,height:452,dpr:2},
 {name:'natural',width:591,height:1223,dpr:1},
];
const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};

function expectedSkillRange(ability,hero){
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

function makeSavedFixture({shellsFirst=true}={}){
 const progress=createHeroProgressStore();
 const economy=createLampEconomy(0x2c2);
 const wanted={hat:4,body:4,boots:4},items={hat:[],body:[],boots:[]};
 for(let sequence=0;sequence<4000&&Object.entries(wanted).some(([type,count])=>items[type].length<count);sequence++){
  const item=generateLampItem(economy.lamp.seed,sequence,3);
  if(items[item.type]&&items[item.type].length<wanted[item.type])items[item.type].push(item);
 }
 assert.deepEqual(Object.fromEntries(Object.entries(items).map(([type,list])=>[type,list.length])),wanted,'canonical gear fixture contains four equipped examples per slot');
 economy.items=Object.values(items).flat();
 for(const [index,hero] of Object.values(progress.heroes).entries()){
  const id=hero.heroInstanceKey,level=[17,23,31,42][index];
  economy.loadouts[id]=Object.fromEntries(Object.keys(items).map(type=>[type,items[type][index].instanceId]));
  hero.currentLevel=level;hero.currentEXP=12+index;hero.lampEXPClaimed=80+index;
  hero.equipmentStats=equipmentStats(economy.items,economy.loadouts[id]);
  refreshHeroStats(hero);hero.hp=hero.maxHP-2;
 }
 // Retired instance records precede canonical records and carry distinct progression/loadouts.
 const shells=Object.fromEntries(Object.keys(HERO_DEFINITIONS).map(key=>{
  const id=key.toLowerCase()+'#1';
  const hero=newHeroProgress(key,id);hero.equipmentStats={};
  economy.loadouts[id]={};
  return [id,hero];
 }));
 progress.heroes=shellsFirst?{...shells,...progress.heroes}:{...progress.heroes,...shells};
 progress.settledBattles=['hero-redesign-save-preservation'];
 return{progress,economy};
}

function startFixtureServer(){
 const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/web-runner/assets/lampEquipmentUI.css"><style>html,body{margin:0;width:100%;height:100%}#game-screen{position:fixed;display:block}</style></head><body><canvas id="game-screen"></canvas></body></html>';
 const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/web-runner/__hero_redesign_qa__'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);return;}
  let target;
  try{target=path.resolve(repoRoot,'.'+decodeURIComponent(pathname));}catch{res.writeHead(400);res.end();return;}
  if(!target.startsWith(repoRoot+path.sep)){res.writeHead(403);res.end();return;}
  try{const data=await readFile(target);res.writeHead(200,{'content-type':mime[path.extname(target)]||'application/octet-stream'});res.end(data);}
  catch{res.writeHead(404);res.end();}
 });
 return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve({server,url:`http://localhost:${server.address().port}/web-runner/__hero_redesign_qa__`}));});
}

const fixtureModule=`
 import {renderHeroScreen} from '/web-runner/systems/renderHeroScreen.js';
 import {renderExistingNavigation} from '/web-runner/systems/renderExistingNavigation.mjs';
 import {createHeroProgressStore,refreshHeroStats} from '/web-runner/src/core/heroProgression.mjs';
 import {equipmentStats} from '/web-runner/src/core/equipment.mjs';
 import {heroDefinition} from '/web-runner/src/core/heroDefinitions.mjs';
 import {heroArtKey} from '/web-runner/state/heroArtAssets.mjs';
 import {EQUIPMENT_SAVE_KEY} from '/web-runner/systems/equipmentStorage.mjs';
 import {HERO_PROGRESS_SAVE_KEY} from '/web-runner/systems/heroProgressStorage.js';
 import {createHeroFormationStore} from '/web-runner/systems/heroFormationStore.mjs';
 import {starUpHero,setHeroResonance} from '/web-runner/src/core/heroGrowthRules.mjs';
 window.mountHeroRedesignFixture=async({progress,economy})=>{
  localStorage.setItem(HERO_PROGRESS_SAVE_KEY,JSON.stringify(progress));
  localStorage.setItem(EQUIPMENT_SAVE_KEY,JSON.stringify(economy));
  const stateSave=createHeroProgressStore(JSON.parse(localStorage.getItem(HERO_PROGRESS_SAVE_KEY)));
  const equipment=JSON.parse(localStorage.getItem(EQUIPMENT_SAVE_KEY));
  for(const hero of Object.values(stateSave.heroes)){hero.equipmentStats=equipmentStats(equipment.items,equipment.loadouts[hero.heroInstanceKey]);refreshHeroStats(hero);}
  const portraits={};
  await Promise.all(Object.values(stateSave.heroes).map(async hero=>{
   const key=heroArtKey(hero),image=new Image();image.src='/web-runner/assets/images/'+key+'.png';await image.decode();portraits[key]=image;
  }));
  const canvas=document.querySelector('#game-screen');
  const fit=()=>{const scale=Math.min(innerWidth/360,innerHeight/640),width=360*scale,height=640*scale;canvas.style.width=width+'px';canvas.style.height=height+'px';canvas.style.left='50%';canvas.style.top='50%';canvas.style.transform='translate(-50%,-50%)';};
  fit();addEventListener('resize',fit);
  const globals={HeroProgress:stateSave,Equipment:equipment};
  const gameState={selectedHero:0,storyEntry:{phase:'hero'}};
  const fnContext={state:{globals,entities:[]}};
  const layoutState={getActiveLayoutId:()=> 'heroLayout'},eventBus={emit(){}};
  // Growth runs through the real rules against an in-memory wallet; Formation uses the real store.
  let growthState={wallet:{ticketsByHero:{}}};
  const wallet=()=>({ticketsByHero:{...(window.heroQa?.tickets||{})}});
  const growthResult=result=>{if(result.ok){growthState=result.state;window.heroQa.tickets={...result.state.wallet.ticketsByHero};}return result;};
  const combatProgression={ticketCount:id=>window.heroQa?.tickets?.[id]||0,spendLevelUp:()=>({ok:false,reason:'unavailable'}),
   heroGrowth:()=>growthState.growth||null,formation:createHeroFormationStore({globals,storage:localStorage}),
   starUp:id=>growthResult(starUpHero({...growthState,wallet:wallet()},id)),
   setResonance:(id,slot,linked)=>growthResult(setHeroResonance({...growthState,wallet:wallet()},id,slot,linked))};
  const render=()=>{renderHeroScreen({equipmentProgress:{data:equipment},combatProgression,canvas,gameState,fnContext,heroPortraitImages:portraits});const scale=canvas.getBoundingClientRect().width/360;renderExistingNavigation({canvas},{worldToCanvas:(x,y)=>({x:x*scale,y:y*scale}),layoutScale:scale,gameState,layoutState,eventBus});};
  const frame=()=>{render();window.heroQaFrame=requestAnimationFrame(frame);};render();window.heroQaFrame=requestAnimationFrame(frame);
  window.heroQa={globals,gameState,equipment,fnContext,render};
 };
`;

async function mountPage(browser,profile,fixture,url){
 const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},deviceScaleFactor:profile.dpr}),page=await context.newPage(),pageErrors=[];
 page.on('pageerror',error=>pageErrors.push(error.message));
 await page.goto(url);await page.addScriptTag({type:'module',content:fixtureModule});await page.waitForFunction(()=>typeof window.mountHeroRedesignFixture==='function');
 await page.evaluate(fixture=>window.mountHeroRedesignFixture(fixture),fixture);
 await page.locator('#hero-details .hero-portrait').waitFor();
 return{context,page,pageErrors};
}
const openTab=async(page,name)=>{await page.locator('#hero-details .tabs').getByRole('button',{name,exact:true}).click();await page.waitForFunction(tab=>document.querySelector('#hero-details')?.dataset.tab===tab,name.toLowerCase());};
const plateText=hero=>heroDefinition(hero).name+'★★★★★';
const p_scale=profile=>Math.min(profile.width/360,profile.height/640);
const heading=page=>page.locator('#hero-details .hero-name h1').textContent();

test('combat copies never appear as unequipped duplicate heroes in the Hero screen',{timeout:90000},async()=>{
 await mkdir(artifactDir,{recursive:true});
 const {progress,economy}=makeSavedFixture({shellsFirst:false}),heroes=Object.keys(HERO_DEFINITIONS).map(key=>progress.heroes[key]);
 for(const hero of heroes){const id=hero.heroInstanceKey.toLowerCase()+'#1';progress.heroes[id]={...structuredClone(hero),heroInstanceKey:id};}
 const {server,url}=await startFixtureServer(),browser=await chromium.launch({headless:true,executablePath:detectChromeExecutable()});
 try{
  for(const profile of profiles){
   const {context,page}=await mountPage(browser,profile,{progress,economy},url);
   const afterAuto=await page.evaluate(async()=>{
    const {generateLampItem}=await import('/web-runner/src/core/lampGear.mjs'),{createEquipmentStorage}=await import('/web-runner/systems/equipmentStorage.mjs');
    const qa=window.heroQa,item=generateLampItem(qa.equipment.lamp.seed,5000,69);
    qa.equipment.items.push(item);qa.equipment.lamp.pending.push(item.instanceId);qa.equipment.lamp.sequence=5001;qa.equipment.lamp.highestOrdinal=69;
    localStorage.setItem('wishfire.equipment-economy.v5',JSON.stringify(qa.equipment));
    const store=createEquipmentStorage({globals:qa.globals,storage:localStorage,locks:navigator.locks});await store.sync();const changes=await store.autoEquip();
    Object.assign(qa.equipment,store.data);qa.render();return{economy:store.data,changes};
   });
   assert.equal(afterAuto.changes.length,1,'production Auto assigns the cached upgrade once');assert.ok(afterAuto.changes[0].cpChange>0);
   const detail=page.locator('#hero-details'),before=await page.evaluate(()=>JSON.stringify(window.heroQa.globals.HeroProgress));
   assert.equal(await detail.locator('.roster-card').count(),4,`${profile.name}: roster shows the four canonical heroes only`);
   await openTab(page,'Gear');
   for(let step=0;step<8;step++){
    const hero=heroes[step%4];assert.equal(await heading(page),heroDefinition(hero).name);
    for(const id of Object.values(afterAuto.economy.loadouts[hero.heroInstanceKey])){
     const item=afterAuto.economy.items.find(i=>i.instanceId===id);assert.equal(await detail.getByRole('button',{name:new RegExp('^Inspect .*: '+item.name+',')}).count(),1,`${profile.name}: ${hero.heroInstanceKey} retains ${item.type} on visit ${step}`);
    }
    await detail.getByRole('button',{name:'Next hero'}).click();
    await page.waitForFunction(expected=>document.querySelector('#hero-details h1')?.textContent===expected,heroDefinition(heroes[(step+1)%4]).name);
   }
   await detail.getByRole('button',{name:'Previous hero'}).click();await page.waitForFunction(()=>document.querySelector('#hero-details h1')?.textContent==='Kaja');
   assert.equal(await page.evaluate(()=>JSON.stringify(window.heroQa.globals.HeroProgress)),before,'browsing preserves canonical and combat-copy progression');
   assert.equal(await page.evaluate(()=>localStorage.getItem('wishfire.equipment-economy.v5')),JSON.stringify(afterAuto.economy),'browsing preserves every equipped item');
   await page.screenshot({path:path.join(artifactDir,`${profile.name}-canonical-gear.png`),fullPage:true});await context.close();
  }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('hero party screen uses saved canonical data and stays contained across portrait viewport profiles',{timeout:240000},async()=>{
 await mkdir(artifactDir,{recursive:true});
 const {progress,economy}=makeSavedFixture(),saved={progress:JSON.stringify(progress),economy:JSON.stringify(economy)};
 const heroes=Object.keys(HERO_DEFINITIONS).map(key=>progress.heroes[key]);
 const {server,url}=await startFixtureServer(),browser=await chromium.launch({headless:true,executablePath:detectChromeExecutable()}),report=[];
 try{
  for(const profile of profiles){
   const {context,page,pageErrors}=await mountPage(browser,profile,{progress,economy},url);
   const detail=page.locator('#hero-details'),mainNav=page.locator('#game-meta-nav'),screenshots={};
   const measure=()=>page.evaluate(()=>{
    const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
    const host=document.querySelector('#hero-details'),q=s=>host.querySelector(s);
    const clipped=[...host.querySelectorAll('button:not(.card-select),.stars,h1,h2,.ticket-bar span,.card-level,.leader-badge,.exp-bar span,dt,dd,.formation-cell em,.resonance-slot span')].filter(node=>node.offsetParent&&(node.scrollWidth>node.clientWidth+1)).map(node=>node.textContent);
    return{viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},stage:rect(document.querySelector('#game-screen')),host:rect(host),identity:rect(q('.identity')),portrait:rect(q('.hero-portrait')),panel:rect(q('.skill-panel')),name:rect(q('.hero-name')),tabs:rect(q('.tabs')),pane:rect(q('.pane')),bottomNav:rect(document.querySelector('#game-meta-nav')),clipped,
     panelColor:getComputedStyle(q('.skill-panel')).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth||document.body.scrollWidth>innerWidth};
   });
   const inside=(inner,outer,label)=>assert.ok(inner.left>=outer.left-0.5&&inner.right<=outer.right+0.5&&inner.top>=outer.top-0.5&&inner.bottom<=outer.bottom+0.5,`${profile.name}: ${label} stays inside`);
   const initial=await measure();
   assert.deepEqual(initial.viewport,{width:profile.width,height:profile.height,dpr:profile.dpr},'browser uses requested viewport and DPR');
   assert.equal(initial.overflow,false,profile.name+' has no horizontal overflow');
   inside(initial.identity,initial.stage,'showcase');inside(initial.panel,initial.identity,'skill panel');inside(initial.name,initial.identity,'name plate');
   assert.ok(initial.portrait.right<=initial.panel.left+2,`${profile.name}: portrait sits beside the skill panel`);
   assert.ok(initial.portrait.height>=initial.identity.height*.5,'portrait fills the showcase');
   assert.equal(initial.panelColor,'rgb(255, 253, 247)','skill panel is a light high-contrast card');
   assert.ok(initial.tabs.top>=initial.identity.bottom-0.5&&initial.pane.top>=initial.tabs.bottom-0.5,'tabs sit between showcase and pane');
   assert.ok(initial.pane.bottom<=initial.bottomNav.top+0.5,'pane clears the bottom navigation reserve');
   assert.deepEqual(initial.clipped,[],`${profile.name}: no clipped labels`);
   assert.equal(await mainNav.locator('button[aria-current="page"]').innerText(),'HERO','hero is the active shared-navigation destination');
   assert.deepEqual(await detail.locator('.tabs button').allTextContents(),['Heroes','Gear','Orb'],'flat Heroes | Gear | Orb tabs');
   assert.equal(await detail.locator('.tabs img, .tabs svg').count(),0,'tabs carry no art icons');
   assert.equal(await detail.locator('.tabs button[aria-pressed="true"]').innerText(),'Heroes','Heroes is the default tab');
   assert.equal(await detail.locator('.formation-button').count(),1,'Formation button flanks the hero');
   assert.equal(await detail.locator('.identity .gear-slots').count(),0,'gear is no longer drawn over the showcase');
   // Roster cards: portrait, level and ticket progress only.
   const cards=detail.locator('.roster-card');
   assert.equal(await cards.count(),4,'roster shows four canonical heroes');
   for(const [cardIndex,hero] of heroes.entries()){
    const card=cards.nth(cardIndex),definition=heroDefinition(hero),cost=heroTicketLevelCost(hero.currentLevel);
    assert.equal(await card.locator('.card-select img').count(),1,`${definition.name} card shows the hero portrait`);
    assert.equal(await card.locator('.card-level').count(),0,`${definition.name} card has no level counter`);
    assert.equal(await card.locator('.stars').count(),0,`${definition.name} card carries no stars`);
    const shell=await card.evaluate(node=>{const c=node.getBoundingClientRect(),b=node.querySelector('.ticket-bar').getBoundingClientRect(),t=node.querySelector('.hero-ticket-art').getBoundingClientRect(),p=node.querySelector('.card-select').getBoundingClientRect();const strip=node.querySelector('.ticket-strip'),st=strip.getBoundingClientRect();return{bg:getComputedStyle(strip).backgroundImage,hangs:st.top<p.bottom,inside:t.left>=node.closest('.pane').getBoundingClientRect().left&&b.right<=c.right+0.5&&b.bottom<=c.bottom+0.5&&b.top>=p.bottom,center:(b.left+b.right)/2-(c.left+c.right)/2};});
    assert.match(shell.bg,/linear-gradient/,`${definition.name} ticket strip hangs on a dark card`);
    assert.ok(shell.hangs,`${definition.name} dark card starts behind the portrait`);
    assert.equal(await card.locator('.ticket-bar span').last().evaluate(node=>node.getClientRects().length===1&&node.scrollWidth<=node.parentElement.clientWidth),true,`${definition.name} ticket count stays on one line`);
    assert.equal(await card.evaluate(node=>{const t=node.querySelector('.hero-ticket-art').getBoundingClientRect(),range=document.createRange();range.selectNodeContents(node.querySelector('.ticket-bar span:last-child'));return range.getBoundingClientRect().left>=t.right-0.5;}),true,`${definition.name} ticket icon never covers the count`);
    const hierarchy=await card.evaluate(node=>{const p=node.querySelector('.card-select').getBoundingClientRect(),st=node.querySelector('.ticket-strip').getBoundingClientRect(),b=node.querySelector('.ticket-bar').getBoundingClientRect(),t=node.querySelector('.hero-ticket-art').getBoundingClientRect();return{inset:[st.left-p.left,p.right-st.right],visible:(st.bottom-p.bottom)/p.height,hidden:p.bottom-st.top,barMid:(b.top+b.bottom)/2,iconMid:(t.top+t.bottom)/2,visibleMid:(p.bottom+st.bottom)/2,iconOut:t.left<st.left,border:getComputedStyle(node.querySelector('.card-select')).borderTopColor};});
    assert.ok(hierarchy.inset.every(gap=>gap>0&&gap<p_scale(profile)*1.5+.5),`${definition.name} dark card is only a hair narrower than the portrait (${hierarchy.inset})`);
    assert.ok(hierarchy.hidden>0,'dark card starts behind the portrait');
    assert.ok(hierarchy.visible>.33&&hierarchy.visible<.5,`${definition.name} dark card shows about two fifths of the portrait height below it (${hierarchy.visible})`);
    assert.ok(Math.abs(hierarchy.barMid-hierarchy.visibleMid)<1.5&&Math.abs(hierarchy.iconMid-hierarchy.barMid)<1.5,`${definition.name} bar and icon are vertically centred in the visible dark card`);
    assert.ok(hierarchy.iconOut,`${definition.name} ticket icon clamps past the dark card's left edge`);
    if(cardIndex)assert.equal(hierarchy.border,'rgb(107, 133, 144)',`${definition.name} portrait carries the slate frame`);
    assert.ok(shell.inside,`${definition.name} ticket icon and bar sit inside the dark card below the portrait`);
    assert.ok(Math.abs(shell.center)<1.5,`${definition.name} progress bar is centered (${shell.center})`);
    const crop=await card.locator('.card-select').evaluate(node=>{const box=node.getBoundingClientRect(),img=node.querySelector('img').getBoundingClientRect();return img.height/box.height;});
    assert.ok(crop>1.5,`${definition.name} card crops to the head and shoulders (${crop})`);
    assert.equal(await card.locator('.ticket-bar span').last().textContent(),`0/${cost}`,`${definition.name} card shows hero-ticket progress`);
    assert.equal(await card.locator('.card-select').evaluate(node=>node.innerText.includes(node.querySelector('img').alt)),false,`${definition.name} card omits the hero name`);
    assert.match(await card.locator('.card-select').evaluate(node=>getComputedStyle(node).backgroundImage),/radial-gradient\(.*rgb\(255, 255, 255\)/,'card uses a soft light gradient');
   }
   assert.equal(await cards.locator('.leader-badge').count(),1,'one leader badge');
   assert.equal(await cards.nth(0).locator('.leader-badge').textContent(),'Leader','default leader is Fara');
   const actions=detail.locator('.hero-actions');
   assert.deepEqual(await actions.locator('button').allTextContents(),['Level Up','Star Up','Resonance'],'selected hero exposes its actions');
   assert.equal(await actions.getAttribute('aria-label'),'Fara actions','actions follow the selected hero');
   assert.equal(await actions.locator('.hero-level-up').isDisabled(),true,'Level Up stays gated by the existing ticket spend');
   assert.equal(await cards.locator('button').count(),4,'cards keep faces clear of action buttons');
   screenshots.heroes=`${profile.name}-heroes.png`;await page.screenshot({path:path.join(artifactDir,screenshots.heroes),fullPage:true});
   const sheetFits=async label=>{
    const fit=await page.evaluate(()=>{const pane=document.querySelector('#hero-details .pane'),sheet=pane.querySelector('.sub-panel');const p=pane.getBoundingClientRect(),r=sheet.getBoundingClientRect();return{scroll:pane.scrollHeight-pane.clientHeight,inside:r.bottom<=p.bottom+0.5&&r.right<=p.right+0.5};});
    assert.ok(fit.scroll<=1&&fit.inside,`${profile.name}: ${label} sheet fits the pane without scrolling (${JSON.stringify(fit)})`);
    assert.deepEqual((await measure()).clipped,[],`${profile.name}: ${label} sheet has no clipped labels`);
   };
   const sheet=detail.locator('.sub-panel');
   // Star Up: spends the hero's own tickets and fills the bronze meter.
   await detail.locator('.hero-actions').getByRole('button',{name:'Star Up',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('#hero-details .sub-panel')?.dataset.panel==='star');
   assert.equal(await sheet.locator('.star-up').isDisabled(),true,'Star Up waits for enough tickets');
   assert.equal(await sheet.locator('.star-cost').textContent(),'0/50 Fara tickets');
   await sheetFits('Star Up');
   await page.evaluate(()=>{window.heroQa.tickets={Falie:60};window.heroQa.render();});
   await sheet.getByRole('button',{name:'Star Up · 50 tickets'}).click();
   await page.waitForFunction(()=>document.querySelector('#hero-details .star-cost')?.textContent==='10/100 Fara tickets');
   assert.equal(await detail.locator('.hero-name .stars span[data-tier="bronze"]').count(),1,'showcase meter shows the first bronze star');
   assert.equal(await detail.locator('.hero-name .stars').getAttribute('aria-label'),'1 of 15 stars');
   assert.match(await sheet.innerText(),/Fara reached ★1\./);
   screenshots.star=`${profile.name}-star.png`;await page.screenshot({path:path.join(artifactDir,screenshots.star),fullPage:true});
   await detail.getByRole('button',{name:'Close Star Up'}).click();await page.waitForFunction(()=>!document.querySelector('#hero-details .sub-panel'));
   // Resonance: slot 1 open, slot 2 opens at five stars.
   await detail.locator('.hero-actions').getByRole('button',{name:'Resonance',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('#hero-details .sub-panel')?.dataset.panel==='resonance');
   const slots=sheet.locator('.resonance-slot');
   assert.equal(await slots.count(),2,'two Resonance slots');
   assert.equal(await slots.nth(1).isDisabled(),true,'slot 2 is locked below five stars');
   assert.match(await slots.nth(1).innerText(),/Unlocks at ★5/);
   await slots.nth(0).click();await sheet.locator('.resonance-picker button').first().waitFor();
   assert.deepEqual(await sheet.locator('.resonance-picker button').allTextContents(),['Hondo +5% ATK','Runa +5% MATK','Kaja +5% HP'],'picker offers the other heroes');
   await sheetFits('Resonance picker');
   await sheet.locator('.resonance-picker').getByRole('button',{name:'Hondo +5% ATK'}).click();
   await page.waitForFunction(()=>document.querySelector('#hero-details .resonance-slot')?.dataset.linked==='Huun');
   assert.equal(await slots.nth(0).innerText().then(text=>text.trim()),'Hondo · Might +5% ATK');
   await sheetFits('Resonance');
   screenshots.resonance=`${profile.name}-resonance.png`;await page.screenshot({path:path.join(artifactDir,screenshots.resonance),fullPage:true});
   await detail.getByRole('button',{name:'Close Resonance'}).click();await page.waitForFunction(()=>!document.querySelector('#hero-details .sub-panel'));
   // Formation: full-screen modal, two 2x2 grids in one row; the right grid opens first with the frontline rightmost.
   const openFormationModal=async()=>{await detail.locator('.identity').getByRole('button',{name:'Formation',exact:true}).click();await page.waitForFunction(()=>!!document.querySelector('#hero-details .formation-modal'));};
   await openFormationModal();
   const modal=detail.locator('.formation-modal'),board=modal.locator('.formation-field');
   const cellHero=cell=>page.evaluate(cell=>document.querySelector(`#hero-details .formation-cell[data-cell="${cell}"]`)?.dataset.hero||'',cell);
   const modalFits=async label=>{
    const fit=await page.evaluate(()=>{
     const host=document.querySelector('#hero-details'),modal=host.querySelector('.formation-modal'),h=host.getBoundingClientRect(),m=modal.getBoundingClientRect(),nav=document.querySelector('#game-meta-nav').getBoundingClientRect();
     const top=document.elementFromPoint(nav.left+nav.width/2,nav.top+nav.height/2);
     const field=modal.querySelector('.formation-field').getBoundingClientRect(),cell=modal.querySelector('.formation-cell').getBoundingClientRect();
     const parts=[...modal.querySelectorAll(':scope>header,.formation-top,.formation-field,.formation-roster-bar,.formation-roster,.formation-note,.formation-actions,.formation-grid,.formation-card')];
     const inside=parts.every(node=>{const r=node.getBoundingClientRect();return r.left>=m.left-0.5&&r.right<=m.right+0.5&&r.top>=m.top-0.5&&r.bottom<=m.bottom+0.5;});
     const grids=[...modal.querySelectorAll('.formation-grid')].map(node=>node.getBoundingClientRect());
     const overlap=grids.some((r,i)=>grids.some((o,j)=>j>i&&r.left<o.right-0.5&&o.left<r.right-0.5&&r.top<o.bottom-0.5&&o.top<r.bottom-0.5));
     const close=modal.querySelector('.game-modal-close').getBoundingClientRect();
     return{full:Math.abs(m.width-h.width)<1&&Math.abs(m.height-h.height)<1,coversNav:modal.contains(top),inside,overlap,aligned:Math.abs(grids[0].top-grids[1].top)<1&&Math.abs(grids[0].height-grids[1].height)<1,closeInside:close.right<=m.right+0.5&&close.top>=m.top-0.5,cellShare:cell.width/m.width,scroll:modal.scrollHeight-modal.clientHeight};
    });
    assert.ok(fit.full&&fit.coversNav,`${profile.name}: ${label} is a full-screen modal over the navigation (${JSON.stringify(fit)})`);
    assert.ok(fit.inside&&!fit.overlap&&fit.aligned&&fit.closeInside&&fit.scroll<=1,`${profile.name}: ${label} lines both grids up in one contained row (${JSON.stringify(fit)})`);
    assert.ok(fit.cellShare>.15,`${profile.name}: ${label} keeps tiles readable (${JSON.stringify(fit)})`);
    assert.deepEqual((await measure()).clipped,[],`${profile.name}: ${label} has no clipped labels`);
   };
   assert.equal(await modal.locator('.game-modal-close').count(),1,'Formation uses the shared modal close');
   // Fixture heroes reach level 42, so both grids are open; the left one stays empty by default.
   assert.equal(await board.locator('.formation-grid').count(),2,'both grids render');
   assert.deepEqual(await board.locator('.formation-grid[data-grid="1"] .formation-cell').evaluateAll(nodes=>nodes.map(node=>[node.dataset.cell,node.dataset.hero||''])),[['2','Runa'],['3','Falie'],['6','Kojonn'],['7','Huun']],'tanks hold the rightmost frontline column, ranged the column beside it');
   assert.equal(await board.locator('.formation-grid[data-grid="0"] .formation-cell[data-hero]').count(),0,'heroes fill the right grid before the left');
   const gridRects=()=>board.evaluate(node=>[...node.querySelectorAll('.formation-grid')].map(grid=>{const r=grid.getBoundingClientRect();return[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)];}));
   const openRects=await gridRects();
   const levels=await page.evaluate(()=>Object.fromEntries(Object.entries(window.heroQa.globals.HeroProgress.heroes).map(([id,hero])=>[id,hero.currentLevel])));
   await page.evaluate(()=>{for(const hero of Object.values(window.heroQa.globals.HeroProgress.heroes))hero.currentLevel=Math.min(hero.currentLevel,29);window.heroQa.render();});
   // Leaving and reopening picks up the new unlock state.
   await modal.locator('.game-modal-close').click();await page.waitForFunction(()=>!document.querySelector('#hero-details .formation-modal'));await openFormationModal();
   await board.locator('.formation-grid[data-locked="true"]').waitFor();
   assert.equal(await board.locator('.formation-grid[data-locked="true"]').getAttribute('data-grid'),'0','the left back grid is the locked one');
   assert.equal(await board.locator('.formation-grid[data-locked="true"] .formation-cell').evaluateAll(nodes=>nodes.every(node=>node.tagName==='DIV')),true,'locked tiles are not slots');
   assert.equal(await board.locator('.formation-lock').textContent(),'🔒 Lv. 30');
   await board.locator('.formation-lock').click();
   await page.waitForFunction(()=>document.querySelector('#hero-details .formation-note')?.textContent==='This grid unlocks when a hero reaches Lv. 30.');
   assert.deepEqual(await gridRects(),openRects,'locking changes no layout');
   await modalFits('Locked formation');
   screenshots.formationLocked=`${profile.name}-formation-locked.png`;await page.screenshot({path:path.join(artifactDir,screenshots.formationLocked),fullPage:true});
   await page.evaluate(levels=>{for(const [id,level] of Object.entries(levels))window.heroQa.globals.HeroProgress.heroes[id].currentLevel=level;window.heroQa.render();},levels);
   await modal.locator('.game-modal-close').click();await page.waitForFunction(()=>!document.querySelector('#hero-details .formation-modal'));await openFormationModal();
   await page.waitForFunction(()=>!document.querySelector('#hero-details .formation-grid[data-locked]'));
   assert.equal(await board.locator('.formation-cell[data-leader="true"]').getAttribute('data-hero'),'Falie','Fara leads by default');
   assert.match(await modal.locator('.formation-total').textContent(),/^\d+$/);
   await modalFits('Formation');
   screenshots.formation=`${profile.name}-formation.png`;await page.screenshot({path:path.join(artifactDir,screenshots.formation),fullPage:true});
   // Roster with sort and filter.
   const rosterOrder=()=>modal.locator('.formation-card').evaluateAll(nodes=>nodes.map(node=>node.dataset.hero));
   assert.equal(await modal.locator('.formation-count').textContent(),'4/4');
   assert.deepEqual(await rosterOrder(),['Kojonn','Runa','Huun','Falie'],'roster sorts by level, highest first');
   await modal.getByRole('button',{name:'Sort descending'}).click();await page.waitForFunction(()=>document.querySelector('#hero-details .formation-card')?.dataset.hero==='Falie');
   await modal.getByRole('button',{name:'Sort and filter heroes'}).click();const sortSheet=modal.locator('.formation-sort');await sortSheet.waitFor();
   await sortSheet.getByRole('button',{name:'Tank',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('#hero-details .formation-card').length===1);
   assert.deepEqual(await rosterOrder(),['Falie'],'role filter narrows the roster');
   await sortSheet.getByRole('button',{name:'Done'}).click();await page.waitForFunction(()=>!document.querySelector('#hero-details .formation-sort'));
   await modal.getByRole('button',{name:'Reset sort and filter'}).click();
   await page.waitForFunction(()=>document.querySelectorAll('#hero-details .formation-card').length===4&&document.querySelector('#hero-details .formation-card')?.dataset.hero==='Kojonn');
   assert.equal(await modal.getByRole('button',{name:'Sort descending'}).count(),1,'reset restores Level, highest first, no filter');
   // Move from the roster, undo, redo on the board, then Save.
   const savedBefore=await page.evaluate(()=>localStorage.getItem('wishfire.heroFormation.v3'));
   assert.equal(await modal.getByRole('button',{name:'Formation saved'}).isDisabled(),true,'Save waits for changes');
   await modal.locator('.formation-card[data-hero="Runa"] .formation-card-pick').click();
   await page.waitForFunction(()=>document.querySelector('#hero-details .formation-card[data-hero="Runa"]')?.dataset.selected==='true');
   assert.equal(await board.evaluate(node=>[...node.querySelectorAll('.formation-grid:not([data-locked]) .formation-cell')].filter(cell=>getComputedStyle(cell).borderTopColor==='rgb(80, 207, 255)').length),7,'a picked hero highlights every other open slot');
   await board.locator('.formation-cell[data-cell="3"]').click();
   await page.waitForFunction(()=>document.querySelector('#hero-details .formation-cell[data-cell="3"]')?.dataset.hero==='Runa');
   assert.equal(await cellHero(2),'Falie','occupied target swaps');
   assert.equal(await modal.locator('.formation-note').textContent(),'Unsaved changes.');
   assert.equal(await page.evaluate(()=>localStorage.getItem('wishfire.heroFormation.v3')),savedBefore,'moves stay in the draft until Save');
   await modal.getByRole('button',{name:'Undo'}).click();
   await page.waitForFunction(()=>document.querySelector('#hero-details .formation-cell[data-cell="3"]')?.dataset.hero==='Falie');
   assert.equal(await modal.getByRole('button',{name:'Undo'}).isDisabled(),true,'undo history empties');
   await board.locator('.formation-cell[data-hero="Runa"]').click();
   await page.waitForFunction(()=>document.querySelector('#hero-details .formation-cell[data-hero="Runa"]')?.getAttribute('aria-pressed')==='true');
   await board.locator('.formation-cell[data-cell="3"]').click();
   await page.waitForFunction(()=>document.querySelector('#hero-details .formation-cell[data-cell="3"]')?.dataset.hero==='Runa');
   await board.locator('.formation-cell[data-hero="Runa"]').click();
   await page.waitForFunction(()=>document.querySelector('#hero-details .formation-cell[data-hero="Runa"]')?.getAttribute('aria-pressed')==='true');
   await modal.getByRole('button',{name:'Set Runa as leader'}).click();
   await page.waitForFunction(()=>document.querySelector('#hero-details .formation-cell[data-leader="true"]')?.dataset.hero==='Runa');
   await modal.getByRole('button',{name:'Save formation'}).click();
   await page.waitForFunction(()=>document.querySelector('#hero-details .formation-note')?.textContent==='Formation saved.');
   assert.deepEqual(await page.evaluate(()=>[window.heroQa.globals.HeroFormationLeader,window.heroQa.globals.HeroFormationOrder,JSON.parse(localStorage.getItem('wishfire.heroFormation.v3')).presets[0].leader]),['Runa',['Runa','Hondo','Fara','Kaja'],'Runa'],'Save publishes the leader and succession to combat and persists');
   // Lock commits and blocks edits until unlocked.
   await modal.getByRole('button',{name:'Lock formation'}).click();
   await page.waitForFunction(()=>document.querySelector('#hero-details .formation-tools .lock')?.getAttribute('aria-pressed')==='true');
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('wishfire.heroFormation.v3')).presets[0].locked),true,'lock persists');
   assert.equal(await modal.getByRole('button',{name:'Auto-Form'}).isDisabled(),true,'Auto-Form is disabled while locked');
   await board.locator('.formation-cell[data-hero="Falie"]').click();
   await page.waitForFunction(()=>document.querySelector('#hero-details .formation-note')?.textContent==='Unlock the formation to make changes.');
   await modal.getByRole('button',{name:'Unlock formation'}).click();
   await page.waitForFunction(()=>document.querySelector('#hero-details .formation-tools .lock')?.getAttribute('aria-pressed')==='false');
   // Presets and Copy edit the draft.
   await modal.getByRole('button',{name:'Preset 2',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('#hero-details .formation-cell[data-leader="true"]')?.dataset.hero==='Falie');
   await modal.getByRole('button',{name:'Preset 1',exact:true}).click();
   await modal.getByRole('button',{name:'Copy preset 1'}).click();const copySheet=modal.locator('.formation-copy');await copySheet.waitFor();
   assert.equal(await copySheet.getByRole('button',{name:'Copy',exact:true}).isDisabled(),true,'Copy waits for a destination');
   await copySheet.getByRole('button',{name:'Select All'}).click();
   await page.waitForFunction(()=>[...document.querySelectorAll('#hero-details .formation-copy .sort-options button')].filter(node=>node.getAttribute('aria-pressed')==='true').length===3);
   await copySheet.getByRole('button',{name:'Copy',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('#hero-details .formation-note')?.textContent==='Copied to 2 presets.');
   await modal.getByRole('button',{name:'Preset 2',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('#hero-details .formation-tools button[aria-label="Preset 2"]')?.getAttribute('aria-pressed')==='true'&&document.querySelector('#hero-details .formation-cell[data-leader="true"]')?.dataset.hero==='Runa');
   await modal.getByRole('button',{name:'Auto-Form'}).click();
   await page.waitForFunction(()=>document.querySelector('#hero-details .formation-cell[data-cell="3"]')?.dataset.hero==='Falie');
   // Closing with unsaved changes asks to save or discard; Discard keeps the saved formation.
   await modal.locator('.game-modal-close').click();
   const confirm=modal.locator('.formation-confirm');await confirm.waitFor();
   await confirm.getByRole('button',{name:'Discard'}).click();await page.waitForFunction(()=>!document.querySelector('#hero-details .formation-modal'));
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('wishfire.heroFormation.v3')).active),0,'discarded draft never saves');
   // The magnifier opens that hero's screen and returns to the same Formation draft.
   await openFormationModal();
   await board.locator('.formation-cell[data-hero="Kojonn"]').click();
   await page.waitForFunction(()=>document.querySelector('#hero-details .formation-cell[data-hero="Kojonn"]')?.getAttribute('aria-pressed')==='true');
   await board.locator('.formation-cell[data-cell="2"]').click();
   await page.waitForFunction(()=>document.querySelector('#hero-details .formation-cell[data-cell="2"]')?.dataset.hero==='Kojonn');
   await modal.getByRole('button',{name:"Open Kaja's hero screen"}).click();
   await page.waitForFunction(()=>!document.querySelector('#hero-details .formation-modal')&&document.querySelector('#hero-details h1')?.textContent==='Kaja');
   await detail.getByRole('button',{name:'Back to Formation'}).click();await page.waitForFunction(()=>!!document.querySelector('#hero-details .formation-modal'));
   assert.equal(await cellHero(2),'Kojonn','returning keeps the unsaved draft');
   await modal.locator('.game-modal-close').click();await confirm.waitFor();await confirm.getByRole('button',{name:'Discard'}).click();
   await page.waitForFunction(()=>!document.querySelector('#hero-details .formation-modal'));
   // Restore Fara as leader for the remaining checks; Escape closes a clean modal.
   await cards.nth(0).locator('.card-select').click();await page.waitForFunction(()=>document.querySelector('#hero-details h1')?.textContent==='Fara');
   await openFormationModal();
   await board.locator('.formation-cell[data-hero="Falie"]').click();
   await page.waitForFunction(()=>document.querySelector('#hero-details .formation-cell[data-hero="Falie"]')?.getAttribute('aria-pressed')==='true');
   await modal.getByRole('button',{name:'Set Fara as leader'}).click();await modal.getByRole('button',{name:'Save formation'}).click();
   await page.waitForFunction(()=>window.heroQa.globals.HeroFormationLeader==='Fara');
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('#hero-details .formation-modal'));
   // Card selection drives the showcase.
   for(const [cardIndex,hero] of heroes.entries()){
    await cards.nth(cardIndex).locator('.card-select').click();
    await page.waitForFunction(expected=>document.querySelector('#hero-details h1')?.textContent===expected,heroDefinition(hero).name);
    assert.equal(await cards.nth(cardIndex).getAttribute('data-selected'),'true');
    assert.equal(await detail.locator('.hero-name').innerText().then(text=>text.replace(/\s+/g,'')),plateText(hero),'showcase shows only the wide name plate and stars');
    assert.equal(await detail.locator('.hero-name .stars span').count(),5,'showcase star meter replaces the EXP readout');
   }
   await cards.nth(0).locator('.card-select').click();await page.waitForFunction(()=>document.querySelector('#hero-details h1')?.textContent==='Fara');
   // Gear tab: equipped items and the full stat sheet, no inventory.
   await openTab(page,'Gear');
   for(const [heroIndex,hero] of heroes.entries()){
    const definition=heroDefinition(hero);
    if(heroIndex){await detail.getByRole('button',{name:'Next hero'}).click();await page.waitForFunction(expected=>document.querySelector('#hero-details h1')?.textContent===expected,definition.name);}
    const gearRow=detail.locator('.pane .gear-slots');
    assert.equal(await gearRow.locator('[data-slot]').count(),3,'Hat, Body and Boots appear in the Gear tab');
    assert.equal(await gearRow.locator('.gear-placeholder').count(),0,'Orb is no longer a gear slot');
    for(const itemId of Object.values(economy.loadouts[hero.heroInstanceKey])){const item=economy.items.find(entry=>entry.instanceId===itemId);assert.equal(await gearRow.getByRole('button',{name:new RegExp(item.name)}).count(),1,`${definition.name} retains equipped ${item.name}`);assert.equal(await gearRow.locator('.lamp-art').count(),3,'equipped item art replaces generic silhouettes');}
    const stats=Object.entries({HP:hero.maxHP,...hero.stats}).map(([label,value])=>[label==='MAG'?'MATK':label,String(value)]);
    assert.deepEqual(await detail.locator('.stat-grid div').evaluateAll(cells=>cells.map(cell=>[cell.querySelector('dt').textContent,cell.querySelector('dd').textContent])),stats,`${definition.name} full stats come from saved progression and gear`);
    assert.equal(await detail.locator('.pane .lamp-results, .pane .lamp-candidate').count(),0,'no selectable inventory in the hero Gear tab');
    const layout=await detail.locator('.pane').evaluate(pane=>{const p=pane.getBoundingClientRect(),b=pane.querySelector('.stat-block').getBoundingClientRect(),d=pane.querySelector('.gear-detail');return{gap:p.bottom-b.bottom,pad:parseFloat(getComputedStyle(pane).paddingBottom),backer:getComputedStyle(d).backgroundColor,radius:parseFloat(getComputedStyle(d).borderTopLeftRadius)};});
    assert.ok(Math.abs(layout.gap-layout.pad)<1.5,`${profile.name}: hero stats sit at the bottom of the Gear pane (${JSON.stringify(layout)})`);
    assert.equal(layout.backer,'rgb(27, 42, 66)','equip readout sits on a rounded cell backer');assert.ok(layout.radius>0);
    const gearMeasure=await measure();assert.deepEqual(gearMeasure.clipped,[],`${profile.name}: Gear has no clipped labels`);
    const paneBox=await detail.locator('.pane').evaluate(node=>({scroll:node.scrollHeight,client:node.clientHeight}));
    assert.ok(paneBox.scroll<=paneBox.client+1,`${profile.name}: Gear content fits without scrolling (${paneBox.scroll}/${paneBox.client})`);
   }
   screenshots.gear=`${profile.name}-gear.png`;await page.screenshot({path:path.join(artifactDir,screenshots.gear),fullPage:true});
   await detail.getByRole('button',{name:'Next hero'}).click();await page.waitForFunction(()=>document.querySelector('#hero-details h1')?.textContent==='Fara');
   await openTab(page,'Orb');
   assert.equal(await detail.locator('.pane .orb-placeholder[aria-label="Orb equipment unavailable"]').count(),1,'Orb shows its placeholder');
   assert.equal(await detail.locator('.pane .stat-grid').count(),0,'stats moved out of the Orb tab');
   screenshots.orb=`${profile.name}-orb.png`;await page.screenshot({path:path.join(artifactDir,screenshots.orb),fullPage:true});
   // Signature skill panel reaches every canonical skill and the basic attack.
   const reachedSkills=[];
   for(const [heroIndex,hero] of heroes.entries()){
    const definition=heroDefinition(hero),abilities=definition.actives;
    if(heroIndex){await detail.getByRole('button',{name:'Next hero'}).click();await page.waitForFunction(expected=>document.querySelector('#hero-details h1')?.textContent===expected,definition.name);}
    const article=detail.locator('.skill-panel article');
    assert.equal(await article.locator('h2').textContent(),abilities.at(-1).displayName,`${definition.name} headlines the awakening`);
    for(let step=1;step<=abilities.length+1;step++){
     const entry=(abilities.length-1+step)%(abilities.length+1),ability=abilities[entry];
     await detail.getByRole('button',{name:'Next skill'}).click();
     await page.waitForFunction(expected=>document.querySelector('#hero-details [aria-label="Skill index"]')?.textContent===expected,`${entry+1} / ${abilities.length+1}`);
     if(!ability){assert.equal(await article.locator('h2').textContent(),'Basic Attack');assert.equal(await article.locator('p').textContent(),definition.basic.description,'Basic Attack description is preserved');continue;}
     assert.equal(await article.locator('h2').textContent(),ability.displayName,'panel shows the stepped skill');
     assert.equal(await article.getAttribute('data-locked'),String(!heroSkillUnlocked(hero,ability)),`${ability.displayName} uses its level gate`);
     assert.equal(await article.locator('small').textContent(),heroSkillUnlocked(hero,ability)?`Unlocked · Lv. ${ability.unlockLevel}`:`Unlocks at Lv. ${ability.unlockLevel}`);
     assert.deepEqual(await article.locator('p').allTextContents(),[
      ability.description.replaceAll('magic-tagged actions','magic skills'),
      `Range: ${expectedSkillRange(ability,hero)} · Cooldown: ${ability.cooldownSeconds}s`,
      `When: ${ability.conditionLabel}`,
     ],`${ability.displayName} details come from canonical data`);
     const fit=await article.evaluate(node=>({scroll:node.scrollHeight,client:node.clientHeight}));
     assert.ok(fit.scroll<=fit.client+1,`${profile.name}: ${ability.displayName} fits the skill panel (${fit.scroll}/${fit.client})`);
     reachedSkills.push(`${hero.heroInstanceKey}:${ability.skillId}`);
    }
   }
   assert.equal(new Set(reachedSkills).size,33,'all 33 canonical active skills are reachable');
   assert.equal(await page.evaluate(()=>JSON.stringify([localStorage.getItem('orka.hero_progress.v2'),localStorage.getItem('wishfire.equipment-economy.v5')])),JSON.stringify([saved.progress,saved.economy]),'hero and equipment saves stay byte-identical while browsing');
   assert.deepEqual(await page.evaluate(()=>window.heroQa.globals.HeroProgress),progress,'progression data stays unchanged in memory');
   assert.deepEqual(await page.evaluate(()=>window.heroQa.equipment),economy,'equipped items and loadouts stay unchanged in memory');
   await openTab(page,'Gear');
   const cpRefresh=await page.evaluate(async()=>{
    const {refreshHeroStats}=await import('/web-runner/src/core/heroProgression.mjs');
    const {computeCombatPower}=await import('/web-runner/src/core/combatPower.mjs');
    const {HERO_DEFINITIONS}=await import('/web-runner/src/core/heroDefinitions.mjs');
    const qa=window.heroQa,heroes=Object.keys(HERO_DEFINITIONS).map(key=>qa.globals.HeroProgress.heroes[key]);
    qa.fnContext.state.entities=heroes.map(hero=>({...structuredClone(hero),kind:'hero'}));
    const results=[];
    for(const [index,hero] of heroes.entries()){
     qa.gameState.selectedHero=index;qa.render();
     const before=computeCombatPower(hero);
     hero.equipmentStats.HP=(hero.equipmentStats.HP||0)+80;
     refreshHeroStats(hero);qa.render();
     results.push({before,expected:'CP '+computeCombatPower(hero),visible:document.querySelector('#hero-details .stat-head').textContent});
    }
    return results;
   });
   for(const result of cpRefresh){assert.ok(result.visible.includes(result.expected),'next render reads committed CP despite a stale combat actor');assert.notEqual(result.expected,'CP '+result.before,'fixture adds a measurable CP upgrade');}
   await openTab(page,'Heroes');
   const ticketFixture={Falie:300,Huun:900,Runa:1600,Kojonn:500};
   await page.evaluate(tickets=>{window.heroQa.tickets=tickets;window.heroQa.render();},ticketFixture);
   for(const [cardIndex,hero] of heroes.entries()){
    const card=detail.locator('.roster-card').nth(cardIndex),cost=heroTicketLevelCost(hero.currentLevel),balance=ticketFixture[hero.heroInstanceKey];
    await page.waitForFunction(([index,text])=>document.querySelectorAll('#hero-details .ticket-bar span')[index]?.textContent===text,[cardIndex,`${balance}/${cost}`]);
    const fill=await card.locator('.ticket-bar i').evaluate(node=>({ratio:node.getBoundingClientRect().width/node.parentElement.getBoundingClientRect().width,image:getComputedStyle(node).backgroundImage}));
    assert.ok(Math.abs(fill.ratio-Math.min(1,balance/cost))<.03,`${heroDefinition(hero).name} fill tracks ticket progress (${fill.ratio})`);
    assert.match(fill.image,/rgb\(26, 140, 255\)/,'progress fill is bright blue');
    const room=await card.evaluate(node=>{const bar=node.querySelector('.ticket-bar').getBoundingClientRect(),icon=node.querySelector('.hero-ticket-art').getBoundingClientRect(),range=document.createRange();range.selectNodeContents(node.querySelector('.ticket-bar span:last-child'));const text=range.getBoundingClientRect();return{right:(bar.right-text.right)/bar.width,left:(text.left-icon.right)/bar.width};});
    assert.ok(room.right>=.08&&room.left>=0,`${heroDefinition(hero).name} count fits inside the bar with room to spare (${JSON.stringify(room)})`);
   }
   screenshots.tickets=`${profile.name}-tickets.png`;await page.screenshot({path:path.join(artifactDir,screenshots.tickets),fullPage:true});
   assert.deepEqual(pageErrors,[],'renderer has no browser exceptions');
   report.push({fixture:'isolated production hero renderer and shared navigation modules',profile,geometry:initial,screenshots,reachedSkillCount:reachedSkills.length,pass:true});
   await context.close();
  }
 }catch(error){report.push({pass:false,error:error.stack||String(error)});throw error;}
 finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
  await writeFile(path.join(artifactDir,'report.json'),JSON.stringify(report,null,2));
 }
});
