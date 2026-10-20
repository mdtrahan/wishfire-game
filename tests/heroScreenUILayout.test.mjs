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
  const render=()=>{renderHeroScreen({equipmentProgress:{data:equipment},canvas,gameState,fnContext,heroPortraitImages:portraits});const scale=canvas.getBoundingClientRect().width/360;renderExistingNavigation({canvas},{worldToCanvas:(x,y)=>({x:x*scale,y:y*scale}),layoutScale:scale,gameState,layoutState,eventBus});};
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
    const clipped=[...host.querySelectorAll('button:not(.card-select),.stars,h1,h2,.ticket-bar span,.card-level,.leader-badge,.exp-bar span,dt,dd')].filter(node=>node.offsetParent&&(node.scrollWidth>node.clientWidth+1)).map(node=>node.textContent);
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
    assert.equal(await card.locator('.card-select .stars span').count(),5,`${definition.name} card shows a five-slot star meter`);
    assert.equal(await card.locator('.card-select .stars span[data-tier]').count(),0,'stars stay grey until Star Up exists');
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
   for(const [action,panelId,title] of [['Star Up','star','Star Up'],['Resonance','resonance','Resonance']]){
    await detail.locator('.hero-actions').getByRole('button',{name:action,exact:true}).click();
    await page.waitForFunction(id=>document.querySelector('#hero-details .sub-panel')?.dataset.panel===id,panelId);
    if(panelId==='resonance'){assert.equal(await detail.locator('.resonance-slots span').count(),2,'two Resonance placeholder slots');screenshots.resonance=`${profile.name}-resonance.png`;await page.screenshot({path:path.join(artifactDir,screenshots.resonance),fullPage:true});}
    assert.deepEqual((await measure()).clipped,[],`${profile.name}: ${title} sheet has no clipped labels`);
    await detail.getByRole('button',{name:'Close '+title}).click();await page.waitForFunction(()=>!document.querySelector('#hero-details .sub-panel'));
   }
   await detail.getByRole('button',{name:'Formation'}).click();await page.waitForFunction(()=>document.querySelector('#hero-details .sub-panel')?.dataset.panel==='formation');
   assert.match(await detail.locator('.sub-panel').innerText(),/Current leader: Fara\./);
   await detail.getByRole('button',{name:'Close Formation'}).click();
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
