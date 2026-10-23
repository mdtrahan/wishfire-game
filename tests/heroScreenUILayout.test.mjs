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
import {heroBasicSkill,heroSkillCopy} from '../web-runner/systems/heroSkillCopy.mjs';
import {EQUIPMENT_SAVE_KEY} from '../web-runner/systems/equipmentStorage.mjs';

const require=createRequire(import.meta.url);
const {detectChromeExecutable}=require('../tools/playwright_support.js');
const HERO_PROGRESS_SAVE_KEY='orka.hero_progress.v2';
const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const artifactDir=path.join(repoRoot,'test-results/hero-redesign');
const profiles=[
 {name:'reference',width:360,height:640,dpr:1},
 {name:'compact-retina',width:216,height:384,dpr:2},
 {name:'natural',width:591,height:1223,dpr:1},
];

test('Basic Attack copy reads authored power and damage stat at each progression value',()=>{
 for(const definition of Object.values(HERO_DEFINITIONS))for(const potency of [1,1.3,2.1]){
  const basic=heroBasicSkill({...definition,basic:{...definition.basic,effects:[{effectType:'damage',potency,hits:1}]}});
  assert.deepEqual(heroSkillCopy(basic).lines,[`Deals ${potency*100}% of ${basic.tags.includes('magic')?'MAG':'ATK'} to the current target.`]);
 }
});
const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};

function expectedSkillRange(ability,hero){
 const {kind}=ability.targetRule,reach=actorAttackReach({...hero,kind:'hero'});
 if(kind==='party')return 'Whole party';
 if(kind==='inRangeEnemies')return `Every foe within ${reach} units`;
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

test('combat copies never appear as unequipped duplicate heroes in the Hero screen',{timeout:60000},async()=>{
 await mkdir(artifactDir,{recursive:true});
 const {progress,economy}=makeSavedFixture({shellsFirst:false}),heroes=Object.keys(HERO_DEFINITIONS).map(key=>progress.heroes[key]);
 for(const hero of heroes){const id=hero.heroInstanceKey.toLowerCase()+'#1';progress.heroes[id]={...structuredClone(hero),heroInstanceKey:id};}
 const {server,url}=await startFixtureServer(),browser=await chromium.launch({headless:true,executablePath:detectChromeExecutable()});
 try{
  for(const profile of profiles){
   const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},deviceScaleFactor:profile.dpr}),page=await context.newPage();
   await page.goto(url);await page.addScriptTag({type:'module',content:fixtureModule});await page.waitForFunction(()=>typeof window.mountHeroRedesignFixture==='function');
   await page.evaluate(({progress,economy})=>window.mountHeroRedesignFixture({progress,economy}),{progress,economy});
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
   for(let step=0;step<8;step++){
    const hero=heroes[step%4];assert.equal(await detail.locator('h1').textContent(),heroDefinition(hero).name);
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

test('hero redesign uses saved canonical data and stays contained across portrait viewport profiles',{timeout:120000},async()=>{
 await mkdir(artifactDir,{recursive:true});
 const {progress,economy}=makeSavedFixture(),saved={progress:JSON.stringify(progress),economy:JSON.stringify(economy)};
 const {server,url}=await startFixtureServer(),browser=await chromium.launch({headless:true,executablePath:detectChromeExecutable()}),report=[];
 try{
  for(const profile of profiles){
   const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},deviceScaleFactor:profile.dpr});
   const page=await context.newPage(),pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
   await page.goto(url);await page.addScriptTag({type:'module',content:fixtureModule});
   await page.waitForFunction(()=>typeof window.mountHeroRedesignFixture==='function');
   await page.evaluate(({progress,economy})=>window.mountHeroRedesignFixture({progress,economy}),{progress,economy});
   const detail=page.locator('#hero-details'),portrait=detail.locator('.hero-portrait'),gearRow=detail.locator('.gear-slots');
   await detail.waitFor({state:'visible'});await portrait.waitFor();
   const initial=await page.evaluate(()=>{
    const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
    const host=document.querySelector('#hero-details'),identity=host.querySelector('.identity'),image=identity.querySelector('.hero-portrait'),canvas=document.querySelector('#game-screen'),pane=host.querySelector('.pane'),nav=document.querySelector('#game-meta-nav');
    return{viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},stage:rect(canvas),host:rect(host),identity:rect(identity),portrait:rect(image),portraitNatural:{width:image.naturalWidth,height:image.naturalHeight},gear:rect(host.querySelector('.gear-slots')),power:rect(host.querySelector('.power-bar')),pane:rect(pane),bottomNav:rect(nav),overflow:document.documentElement.scrollWidth>innerWidth||document.body.scrollWidth>innerWidth};
   });
   assert.deepEqual(initial.viewport,{width:profile.width,height:profile.height,dpr:profile.dpr},'browser uses requested viewport and DPR');
   assert.equal(initial.overflow,false,profile.name+' has no horizontal overflow');
   assert.ok(initial.portraitNatural.width>0&&initial.portraitNatural.height>0,'decoded production portrait asset is rendered');
   assert.ok(Math.abs((initial.portrait.left+initial.portrait.right)/2-(initial.identity.left+initial.identity.right)/2)<0.75,'portrait stays centered in identity');
   assert.ok(initial.portrait.height>=initial.identity.height*.55,`portrait uses most of the enlarged identity frame (${initial.portrait.height}/${initial.identity.height})`);
   assert.equal(await gearRow.locator('[data-slot]').count(),3,'all three supported gear slots appear beside the portrait');
   assert.equal(await gearRow.locator('.gear-placeholder[aria-label="Orb equipment unavailable"]').count(),1,'Orb remains a separate unavailable slot');
   assert.ok(initial.gear.left>=initial.stage.left-0.5&&initial.gear.right<=initial.stage.right+0.5,'gear row stays inside the portrait stage');
   assert.ok(Math.abs((initial.gear.left+initial.gear.right)/2-(initial.identity.left+initial.identity.right)/2)<1,'gear row is centered below the portrait');
   assert.ok(initial.pane.height>initial.power.height*3,`${profile.name} retains a large details panel (${initial.pane.height}/${initial.power.height})`);
   assert.ok(initial.pane.bottom<=initial.bottomNav.top+0.5,'details panel clears the bottom navigation reserve');
   const mainNav=page.locator('#game-meta-nav');
   assert.equal(await mainNav.locator('button').count(),5,'fixture renders the production shared navigation');
   assert.equal(await mainNav.locator('button[aria-current="page"]').innerText(),'HERO','hero is the active shared-navigation destination');
   assert.equal(await mainNav.locator('button img').count(),5,'the five production navigation badges use decoded artwork');
   assert.equal(await mainNav.locator('button img').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0)),true,'shared navigation artwork is loaded');
   const heroes=Object.keys(HERO_DEFINITIONS).map(key=>progress.heroes[key]);
   assert.deepEqual(heroes.map(hero=>heroDefinition(hero).skills.length),[4,4,4,4],'the saved roster contains the accepted four-skill kits');
   for(let offset=0;offset<heroes.length;offset++){
    const index=(offset+heroes.length)%heroes.length,hero=heroes[index],definition=heroDefinition(hero);
    assert.equal(await detail.locator('h1').textContent(),definition.name,'hero arrow refreshes identity data');
    for(const stat of ['ATK','DEF'])assert.equal(await detail.locator('.power-bar').getByText(new RegExp('^'+stat+' '+hero.stats[stat]+'$')).count(),1,`${definition.name} ${stat} comes from saved progression and gear`);
    assert.equal(await detail.locator('.power-bar').getByText('HP '+hero.maxHP,{exact:true}).count(),1,`${definition.name} HP comes from saved progression and gear`);
    const expectedItems=Object.values(economy.loadouts[hero.heroInstanceKey]);
    assert.equal(await gearRow.locator('[data-slot]').count(),expectedItems.length,'equipped slot count remains three on each hero');
    for(const itemId of expectedItems){const item=economy.items.find(entry=>entry.instanceId===itemId);assert.equal(await gearRow.getByRole('button',{name:new RegExp(item.name)}).count(),1,`${definition.name} retains equipped ${item.name}`);}
    const next=detail.getByRole('button',{name:'Next hero'});await next.click();
    await page.waitForFunction(expected=>document.querySelector('#hero-details h1')?.textContent===expected,heroDefinition(heroes[(index+1)%heroes.length]).name);
   }
   const firstName=heroDefinition(heroes[0]).name;
   assert.equal(await detail.locator('h1').textContent(),firstName,'next arrow wraps across every saved hero instance');
   await detail.getByRole('button',{name:'Previous hero'}).click();
   await page.waitForFunction(expected=>document.querySelector('#hero-details h1')?.textContent===expected,heroDefinition(heroes.at(-1)).name);
   await detail.getByRole('button',{name:'Next hero'}).click();
   await page.waitForFunction(expected=>document.querySelector('#hero-details h1')?.textContent===expected,firstName);
   const tabPortraits=[],screenshots={};
   for(const tab of ['Gear','Orb','Skills']){
    await detail.getByRole('button',{name:tab,exact:true}).click();
    await page.waitForFunction(tabName=>document.querySelector('#hero-details')?.dataset.tab===tabName,tab.toLowerCase());
    const selected=detail.getByRole('button',{name:tab,exact:true});
    assert.equal(await selected.getAttribute('aria-pressed'),'true',`${tab} is the selected tab`);
    assert.equal(await selected.evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(255, 243, 216)',`${tab} selected state uses the cream tab color`);
    tabPortraits.push(await portrait.boundingBox());
    const pane=await detail.locator('.pane').boundingBox(),nav=await mainNav.boundingBox(),overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.body.scrollWidth>innerWidth);
    assert.equal(overflow,false,`${tab} view has no horizontal overflow`);
    assert.ok(pane.height>initial.power.height*3,`${tab} view preserves the large panel`);
    assert.ok(pane.y+pane.height<=nav.y+0.5,`${tab} panel clears the bottom navigation`);
    if(tab==='Skills'){
     const grid=detail.locator('.identity .skill-grid');
     assert.equal(await grid.count(),1,'four skill cards occupy the identity row below the portrait');
     assert.equal(await grid.locator('.skill-card').count(),4,'skills identity row has exactly four icons');
     assert.equal(await grid.locator('.gear-slot, .gear-placeholder').count(),0,'skills identity row has no gear or Orb slots');
     assert.equal(await detail.locator('.pane .gear-placeholder').count(),0,'skills panel has no Orb equipment button');
     assert.equal(await grid.locator('.skill-icon i').evaluateAll(icons=>icons.filter(icon=>icon.style.backgroundImage.includes('buff-signals.png')).length),4,'each skill card shows its bitmap sheet icon');
    }
    const screenshot=`${profile.name}-${tab.toLowerCase()}.png`;
    await page.screenshot({path:path.join(artifactDir,screenshot),fullPage:true});screenshots[tab.toLowerCase()]=screenshot;
   }
   for(const bounds of tabPortraits.slice(0,2))assert.ok(['x','y','width','height'].every(key=>Math.abs(bounds[key]-tabPortraits[0][key])<0.75),'Gear and Orb portrait geometry stays fixed');
   assert.ok(tabPortraits[2].height<tabPortraits[0].height,'Skills reserves more height for its readable detail frame');
   const reachedSkills=[];
   for(let heroIndex=0;heroIndex<heroes.length;heroIndex++){
    const hero=heroes[heroIndex],definition=heroDefinition(hero),abilities=definition.skills,slots=['Special','Passive','Resonance 1','Resonance 2'];
    if(heroIndex){
     await detail.getByRole('button',{name:'Next hero'}).click();
     await page.waitForFunction(expected=>document.querySelector('#hero-details h1')?.textContent===expected,definition.name);
     assert.equal(await detail.locator('.skill-card[aria-pressed="true"]').count(),0,`${definition.name} starts with no specific skill selected`);
    }
    const selectedTab=detail.getByRole('button',{name:'Skills',exact:true});
    assert.equal(await selectedTab.getAttribute('aria-pressed'),'true','Skills remains selected while inspecting skill data');
    const grid=detail.locator('.identity .skill-grid');
    const basicPanel=detail.locator('.skill-frame');
    assert.equal(await basicPanel.locator('h2').textContent(),'Basic Attack','no selected skill displays Basic Attack in the full frame');
    assert.deepEqual(await basicPanel.locator('.skill-effect').allTextContents(),heroSkillCopy(heroBasicSkill(definition)).lines,'Basic Attack reads this hero’s authored power and damage stat');
    const basicHeight=(await basicPanel.boundingBox()).height;
    reachedSkills.push(`${hero.heroInstanceKey}:basic_attack`);
    assert.deepEqual(await grid.locator('.skill-card').evaluateAll(cards=>cards.map(card=>card.getAttribute('aria-label'))),abilities.map((ability,index)=>`Inspect ${slots[index]}: ${ability.displayName}`),`${definition.name} exposes Special, Passive and both Resonances`);
    const row=await grid.boundingBox(),portraitBounds=await portrait.boundingBox(),stageBounds=await page.locator('#game-screen').boundingBox();
    assert.ok(row.x>=stageBounds.x-0.5&&row.x+row.width<=stageBounds.x+stageBounds.width+0.5,`${definition.name} skill row stays inside the stage`);
    assert.ok(row.y>=portraitBounds.y+portraitBounds.height-8*stageBounds.width/360,`${definition.name} skill row stays below the visible portrait frame`);
    for(const [index,ability] of abilities.entries()){
     const card=grid.getByRole('button',{name:`Inspect ${slots[index]}: ${ability.displayName}`,exact:true});
     await card.click();await page.waitForFunction(name=>document.querySelector('#hero-details .pane article h2')?.textContent===name,ability.displayName);
     assert.equal(await card.getAttribute('aria-pressed'),'true',`${ability.displayName} is the selected icon`);
     assert.equal(await card.evaluate(node=>getComputedStyle(node).borderTopColor),'rgb(255, 217, 113)',`${ability.displayName} shows the selected gold state`);
     const detailPanel=detail.locator('.pane article').first();
     assert.ok(Math.abs((await detailPanel.boundingBox()).height-basicHeight)<1,'Basic Attack and selected skills use equal frame space');
     assert.equal(await detailPanel.locator('small').textContent(),slots[index]);
     assert.equal(await detailPanel.getAttribute('data-locked'),String(ability.slot==='resonance'),`${ability.displayName} marks late-game resonances`);
     const copy=heroSkillCopy(ability);
     assert.deepEqual(await detailPanel.locator('.skill-effect').allTextContents(),copy.lines,`${ability.displayName} uses concise copy with separate effect lines`);
     assert.deepEqual(await detailPanel.locator('.skill-rules p').allTextContents(),[...(ability.scaffold?['Late-game resonance · Not yet available']:[]),...(copy.rules||[])],`${ability.displayName} preserves its extra rules and availability`);
     assert.doesNotMatch(await detailPanel.textContent(),/When:|Always on while/,'ordinary triggers are omitted');
     const metrics=detailPanel.locator('.skill-metrics');
     if(ability.slot==='special')assert.equal(await metrics.getAttribute('aria-label'),`Range: ${expectedSkillRange(ability,hero)} · Cooldown: ${ability.cooldownSeconds}s${ability.provisionalCooldown?' (provisional)':''}`,'icon metadata preserves range, cooldown and tuning status');
     const geometry=await detailPanel.evaluate(frame=>{const body=frame.querySelector('.skill-body'),pane=frame.parentElement;return{height:frame.clientHeight,bodyHeight:body.clientHeight,overflow:frame.scrollWidth>frame.clientWidth||body.scrollWidth>body.clientWidth,paneScroll:pane.scrollHeight>pane.clientHeight+1,top:body.scrollTop};});
     assert.equal(geometry.overflow,false,'skill frame and text have no horizontal overflow');
     assert.equal(geometry.paneScroll,false,'selected skill never extends the outer pane');
     assert.ok(geometry.bodyHeight>20,'skill retains a readable scroll area');
     assert.equal(geometry.top,0,'selecting a skill resets its own scroll position');
     assert.equal(await detailPanel.locator('.skill-body').evaluate(body=>body.querySelector('.skill-effect:last-of-type').getBoundingClientRect().bottom<=body.getBoundingClientRect().bottom+1),true,'the complete main effect fits before scrolling');
     await detailPanel.locator('.skill-body').evaluate(body=>body.scrollTop=body.scrollHeight);
     assert.ok(Math.abs((await detailPanel.boundingBox()).height-geometry.height-2)<1,'scrolling keeps the skill frame height fixed');
     assert.equal(await detailPanel.locator('.skill-body').evaluate(body=>{const qa=window.heroQa,hero=Object.values(qa.globals.HeroProgress.heroes)[qa.gameState.selectedHero],hp=hero.hp,xp=hero.currentEXP,top=body.scrollTop;hero.hp=hp-1;hero.currentEXP=xp+1;qa.render();const kept=body.isConnected&&body.scrollTop===top;hero.hp=hp;hero.currentEXP=xp;qa.render();return kept;}),true,'damage and EXP ticks preserve the reading node and scroll position');
     await metrics.click();assert.equal(await detailPanel.locator('.skill-metric-label').isVisible(),true,'touch reveals icon labels');
     await metrics.click();assert.equal(await detailPanel.locator('.skill-metric-label').isVisible(),false,'labels close again');
     reachedSkills.push(`${hero.heroInstanceKey}:${ability.skillId}`);
     if(heroIndex===0&&index===0)await page.screenshot({path:path.join(artifactDir,`${profile.name}-special.png`),fullPage:true});
    }
    await grid.getByRole('button',{name:`Inspect Resonance 2: ${abilities.at(-1).displayName}`,exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.skill-frame h2')?.textContent==='Basic Attack');
    assert.equal(await grid.locator('[aria-pressed="true"]').count(),0,'clicking the selected skill toggles it off and restores Basic Attack');
    assert.ok(Math.abs((await basicPanel.boundingBox()).height-basicHeight)<1,'toggling back preserves Basic Attack’s equal frame space');
    await grid.getByRole('button',{name:`Inspect Resonance 2: ${abilities.at(-1).displayName}`,exact:true}).click();
    if(heroIndex===0){
     await detail.getByRole('button',{name:'Gear',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#hero-details')?.dataset.tab==='gear');
     await detail.getByRole('button',{name:'Skills',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#hero-details')?.dataset.tab==='skills');
     assert.equal(await detail.locator('.skill-card[aria-pressed="true"]').getAttribute('aria-label'),`Inspect Resonance 2: ${abilities.at(-1).displayName}`,'tab changes preserve selected skill');
    }
   }
   assert.equal(new Set(reachedSkills).size,20,'all 16 selected skills and four hero Basic Attacks are reachable');
   assert.equal(await page.evaluate(()=>JSON.stringify([localStorage.getItem('orka.hero_progress.v2'),localStorage.getItem('wishfire.equipment-economy.v5')])),JSON.stringify([saved.progress,saved.economy]),'hero and equipment saves stay byte-identical while browsing');
   assert.deepEqual(await page.evaluate(()=>window.heroQa.globals.HeroProgress),progress,'progression data stays unchanged in memory');
   assert.deepEqual(await page.evaluate(()=>window.heroQa.equipment),economy,'equipped items and loadouts stay unchanged in memory');
   assert.deepEqual(pageErrors,[],'renderer has no browser exceptions');
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
     results.push({before,expected:'CP '+computeCombatPower(hero),visible:document.querySelector('.hero-name').textContent});
    }
    return results;
   });
   for(const result of cpRefresh){assert.ok(result.visible.includes(result.expected),'next render reads committed CP despite a stale combat actor');assert.notEqual(result.expected,'CP '+result.before,'fixture adds a measurable CP upgrade');}
   for(const tab of ['Gear','Orb','Skills']){
    await detail.getByRole('button',{name:tab,exact:true}).click();
    await page.waitForFunction(tabName=>document.querySelector('#hero-details')?.dataset.tab===tabName,tab.toLowerCase());
    assert.ok((await detail.locator('.hero-name').textContent()).includes(cpRefresh.at(-1).expected),`${tab} reads the same updated hero CP`);
   }
   const filename=`${profile.name}.png`;await page.screenshot({path:path.join(artifactDir,filename),fullPage:true});
   report.push({fixture:'isolated production hero renderer and shared navigation modules',profile,geometry:initial,heroes:heroes.map(hero=>({id:hero.heroInstanceKey,level:hero.currentLevel,stats:hero.stats,hp:hero.maxHP,loadout:economy.loadouts[hero.heroInstanceKey]})),portraitGeometryByTab:tabPortraits,screenshots,finalScreenshot:filename,reachedSkillCount:reachedSkills.length,pass:true});
   await context.close();
  }
 }catch(error){report.push({pass:false,error:error.stack||String(error)});throw error;}
 finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
  await writeFile(path.join(artifactDir,'report.json'),JSON.stringify(report,null,2));
 }
});
