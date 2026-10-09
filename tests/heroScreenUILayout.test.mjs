import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import {chromium} from 'playwright';
import {createHeroProgressStore,refreshHeroStats} from '../web-runner/src/core/heroProgression.mjs';
import {equipmentStats} from '../web-runner/src/core/equipment.mjs';
import {createLampEconomy,generateLampItem} from '../web-runner/src/core/lampGear.mjs';
import {heroDefinition,heroSkillUnlocked} from '../web-runner/src/core/heroDefinitions.mjs';
import {actorAttackReach} from '../src/core/arenaCombatRules.mjs';
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
const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};

function expectedSkillRange(ability,hero){
 const {kind,shape}=ability.targetRule,reach=actorAttackReach({...hero,attackType:heroDefinition(hero).basic.tags.includes('magic')?'magic':'physical'});
 if(shape){
  const extent=shape.kind==='circle'?`radius ${shape.radius} units`:shape.kind==='rectangle'?`${shape.width} × ${shape.height} units`:shape.kind==='horizontalLine'?`${shape.width}-unit line to world X ${shape.toX}`:`${shape.length}-unit cone at ${shape.angleDegrees}°`;
  return `${extent}${['bestArea','firstArea','eventArea'].includes(kind)?`; anchor within ${reach} units`:''}`;
 }
 if(kind==='self')return 'Self';
 if(kind==='party')return `Party; foe trigger within ${reach} units`;
 if(kind==='eventChain')return `${ability.targetRule.minimum} other foes after a basic hit`;
 if(kind==='allEnemies')return 'All attackable foes';
 if(kind==='lowestHPAlly'||kind==='slowestAlly')return `Eligible ally; foe trigger within ${reach} units`;
 return `${reach}-unit actor reach`;
}

function makeSavedFixture(){
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
  window.heroQa={globals,gameState,equipment,render};
 };
`;

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
   assert.equal(await mainNav.locator('button img').count(),4,'the four production navigation badges use decoded artwork');
   assert.equal(await mainNav.locator('button img').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0)),true,'shared navigation artwork is loaded');
   const heroes=Object.values(progress.heroes);
   assert.deepEqual(heroes.map(hero=>heroDefinition(hero).actives.length),[8,8,8,9],'the saved roster contains the complete eight- and nine-skill kits');
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
     assert.equal(await grid.locator('.skill-icon img').count(),4,'each skill card contains its existing icon image');
    }
    const screenshot=`${profile.name}-${tab.toLowerCase()}.png`;
    await page.screenshot({path:path.join(artifactDir,screenshot),fullPage:true});screenshots[tab.toLowerCase()]=screenshot;
   }
   for(const bounds of tabPortraits)assert.ok(['x','y','width','height'].every(key=>Math.abs(bounds[key]-tabPortraits[0][key])<0.75),'portrait geometry stays fixed when tabs change');
   const reachedSkills=[];
   for(let heroIndex=0;heroIndex<heroes.length;heroIndex++){
    const hero=heroes[heroIndex],definition=heroDefinition(hero),abilities=definition.actives;
    if(heroIndex){
     await detail.getByRole('button',{name:'Next hero'}).click();
     await page.waitForFunction(expected=>document.querySelector('#hero-details h1')?.textContent===expected,definition.name);
     await page.waitForFunction(()=>document.querySelector('#hero-details [aria-label="Skill page"]')?.textContent?.startsWith('1 /'));
     assert.equal(await detail.locator('.skill-card[aria-pressed="true"]').getAttribute('aria-label'),`Inspect ${abilities[0].displayName}`,`${definition.name} gets a fresh first-skill selection`);
    }
    const pageStarts=abilities.length===9?[0,4,5]:[0,4];
    const selectedTab=detail.getByRole('button',{name:'Skills',exact:true});
    assert.equal(await selectedTab.getAttribute('aria-pressed'),'true','Skills remains selected while inspecting skill data');
    for(let pageIndex=0;pageIndex<pageStarts.length;pageIndex++){
     if(pageIndex){await detail.getByRole('button',{name:'Next skills'}).click();await page.waitForFunction(expected=>document.querySelector('#hero-details [aria-label="Skill page"]')?.textContent===expected,`${pageIndex+1} / ${pageStarts.length}`);}
     const start=pageStarts[pageIndex],pageAbilities=abilities.slice(start,start+4),grid=detail.locator('.identity .skill-grid');
     assert.equal(await grid.locator('.skill-card').count(),4,`${definition.name} page ${pageIndex+1} renders exactly four skills`);
     assert.deepEqual(await grid.locator('.skill-card').evaluateAll(cards=>cards.map(card=>card.getAttribute('aria-label'))),pageAbilities.map(ability=>`Inspect ${ability.displayName}`),`${definition.name} page ${pageIndex+1} exposes its canonical skill window`);
     assert.equal(await grid.locator('.skill-icon img').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0)),true,`${definition.name} page ${pageIndex+1} decodes all four icon assets`);
     const row=await grid.boundingBox(),portraitBounds=await portrait.boundingBox(),stageBounds=await page.locator('#game-screen').boundingBox();
     assert.ok(row.x>=stageBounds.x-0.5&&row.x+row.width<=stageBounds.x+stageBounds.width+0.5,`${definition.name} skill row stays inside the stage`);
     assert.ok(row.y>=portraitBounds.y+portraitBounds.height-8*stageBounds.width/360,`${definition.name} skill row stays below the visible portrait frame`);
     assert.equal(await grid.locator('.gear-slot, .gear-placeholder').count(),0,`${definition.name} skills row contains no Orb or gear slot`);
     assert.equal(await detail.locator('.pane .gear-placeholder').count(),0,`${definition.name} skills panel contains no Orb equipment`);
     for(const ability of pageAbilities){
      const card=grid.getByRole('button',{name:`Inspect ${ability.displayName}`,exact:true});
      await card.click();await page.waitForFunction(name=>document.querySelector('#hero-details .pane article h2')?.textContent===name,ability.displayName);
      assert.equal(await card.getAttribute('aria-pressed'),'true',`${ability.displayName} is the selected icon`);
      assert.equal(await card.evaluate(node=>getComputedStyle(node).borderTopColor),'rgb(255, 217, 113)',`${ability.displayName} shows the selected gold state`);
      const detailPanel=detail.locator('.pane article').first();
      assert.equal(await detailPanel.locator('h2').textContent(),ability.displayName,'selected icon opens matching skill data');
      assert.equal(await detailPanel.getAttribute('data-locked'),String(!heroSkillUnlocked(hero,ability)),`${ability.displayName} uses its level gate`);
      assert.equal(await detailPanel.locator('small').textContent(),heroSkillUnlocked(hero,ability)?`Unlocked · Lv. ${ability.unlockLevel}`:`Unlocks at Lv. ${ability.unlockLevel}`,`${ability.displayName} shows its unlock condition`);
      assert.deepEqual(await detailPanel.locator('p').allTextContents(),[
       `Range: ${expectedSkillRange(ability,hero)} · Cooldown: ${ability.cooldownSeconds}s`,
       `When: ${ability.conditionLabel}`,
       ability.description.replaceAll('magic-tagged actions','magic skills'),
      ],`${ability.displayName} details come from canonical target, cooldown, condition and description data`);
      reachedSkills.push(`${hero.heroInstanceKey}:${ability.skillId}`);
     }
     assert.equal(await detail.locator('.pane article').last().locator('h2').textContent(),'Basic Attack','Basic Attack remains reachable below the active skill');
     assert.equal(await detail.locator('.pane article').last().locator('p').textContent(),definition.basic.description,'Basic Attack description is preserved');
     assert.equal(await detail.locator('[aria-label="Skill page"]').textContent(),`${pageIndex+1} / ${pageStarts.length}`,'current page index matches the rendered skill window');
     assert.equal(await detail.getByRole('button',{name:'Previous skills'}).isDisabled(),pageIndex===0,'previous-page gate matches the first page');
     assert.equal(await detail.getByRole('button',{name:'Next skills'}).isDisabled(),pageIndex===pageStarts.length-1,'next-page gate matches the last page');
    }
    if(heroIndex===0){
     await detail.getByRole('button',{name:'Gear',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#hero-details')?.dataset.tab==='gear');
     await detail.getByRole('button',{name:'Skills',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#hero-details')?.dataset.tab==='skills');
     assert.equal(await detail.locator('[aria-label="Skill page"]').textContent(),`${pageStarts.length} / ${pageStarts.length}`,'tab changes preserve selected skill page');
     assert.equal(await detail.locator('.skill-card[aria-pressed="true"]').getAttribute('aria-label'),`Inspect ${abilities.at(-1).displayName}`,'tab changes preserve selected skill');
    }
   }
   assert.equal(new Set(reachedSkills).size,33,'all 33 canonical active skills are reachable');
   assert.equal(await page.evaluate(()=>JSON.stringify([localStorage.getItem('orka.hero_progress.v2'),localStorage.getItem('wishfire.equipment-economy.v5')])),JSON.stringify([saved.progress,saved.economy]),'hero and equipment saves stay byte-identical while browsing');
   assert.deepEqual(await page.evaluate(()=>window.heroQa.globals.HeroProgress),progress,'progression data stays unchanged in memory');
   assert.deepEqual(await page.evaluate(()=>window.heroQa.equipment),economy,'equipped items and loadouts stay unchanged in memory');
   assert.deepEqual(pageErrors,[],'renderer has no browser exceptions');
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
