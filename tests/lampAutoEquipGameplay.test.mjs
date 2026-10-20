import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {trustFixture,owners,cp,gain} from './fixtures/lampTrust.mjs';
const require=createRequire(import.meta.url),{detectChromeExecutable}=require('../tools/playwright_support.js');
const directory=process.env.LAMP_TRUST_OUTPUT||'test-results/lamp-trust';
const read=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')));
async function serveGame(){
 let server,url=process.env.LAMP_QA_URL;
 if(!url){const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));url=`http://localhost:${port}/web-runner/index.html`;server=spawn(process.execPath,['tools/serve_web.js','--port',String(port),'--host','127.0.0.1'],{stdio:'ignore'});for(let n=0;n<50;n++){try{if((await fetch(url)).ok)break;}catch{}await delay(100);}}
 return{server,url};
}
async function enter(page,url){
 await page.goto(url);await page.waitForFunction(()=>typeof window.render_game_to_text==='function');
 await page.waitForTimeout(2000);const canvas=await page.locator('canvas').first().boundingBox();await page.mouse.click(canvas.x+canvas.width/2,canvas.y+426*canvas.width/360);
 await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).quest.phase==='combat');await page.locator('#wishfire-lamp .lamp-collect').waitFor();
}
async function arrows(page,expected){
 const portraits=await page.locator('#lamp-dialog .lamp-hero').evaluateAll(ns=>ns.map(n=>({opacity:getComputedStyle(n).opacity,disabled:n.disabled,view:n.closest('#lamp-dialog').dataset.view})));
 for(const portrait of portraits){assert.equal(portrait.opacity,'1','portraits and their CP arrows retain full color');assert.equal(portrait.disabled,portrait.view==='cache','overview keeps portrait selection disabled');}
 const disabledEquip=page.locator('#lamp-dialog [data-action="equip"]:disabled');
 if(await disabledEquip.count())assert.equal(await disabledEquip.evaluate(n=>getComputedStyle(n).opacity),'1','unavailable Equip retains full color');
 const actual=await page.locator('#lamp-dialog .lamp-hero').evaluateAll(ns=>ns.map(n=>({id:n.dataset.id,gain:Number(n.dataset.cpChange),green:!!n.querySelector('.lamp-cp-direction.up'),red:!!n.querySelector('.lamp-cp-direction.down')})));
 assert.deepEqual(actual.map(a=>a.id),owners);
 for(const [n,a]of actual.entries()){assert.equal(a.gain,expected[n],a.id+' displayed gain');assert.equal(a.green,expected[n]>0,a.id+' green');assert.equal(a.red,expected[n]<=0,a.id+' red');}
 return actual;
}
function assertCacheExhausted(save,heroes){
 const queued=new Set([...save.lamp.pending,...(save.lamp.discarded||[])]),items=[...save.items.filter(i=>queued.has(i.instanceId)),...(save.lamp.reviewHold?[save.lamp.reviewHold.item]:[])];
 for(const item of items)for(const id of owners){const delta=gain(save,heroes.heroes[id],item);assert.ok(delta<=0,`Auto left ${item.instanceId} as a +${delta} CP upgrade for ${id}`);}
}
async function guidance(page,target){
 await page.evaluate(()=>{const now=performance.now.bind(performance);performance.now=()=>now()+16000;});
 const helper=page.locator('.lamp-idle-helper');await helper.waitFor();assert.equal(await helper.getAttribute('data-target'),target);
 const button=page.locator(target==='Falie'?'#lamp-dialog [data-action="hero"][data-id="Falie"]':`#lamp-dialog [data-action="${target}"]`);assert.equal(await button.isEnabled(),true);
}
async function heroScreens(page,save,heroes,prefix){
 await page.getByRole('button',{name:'HERO',exact:true}).click();await page.locator('#hero-details').waitFor();
 await page.locator('#hero-details .tabs').getByRole('button',{name:'Gear',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#hero-details')?.dataset.tab==='gear');
 const rows=[];
 for(const id of owners){
  const identity=page.locator('#hero-details .hero-name');const label=await identity.locator('h1').innerText();
  const value=Number((await identity.innerText()).match(/CP ([\d.]+)/)[1]);assert.equal(value,cp(save,heroes.heroes[id]),id+' Hero screen CP');
  const slots=await page.locator('#hero-details .gear-slot[data-slot]').evaluateAll(ns=>ns.map(n=>({slot:n.dataset.slot,label:n.getAttribute('aria-label'),empty:!!n.querySelector('.gear-empty')})));
  for(const slot of slots){const item=save.items.find(i=>i.instanceId===save.loadouts[id]?.[slot.slot]);assert.equal(slot.empty,!item,id+' '+slot.slot+' ownership');if(item)assert.ok(slot.label.includes(item.name));}
  rows.push({id,label,cp:value,slots});
  if(id==='Huun')await page.screenshot({path:`${directory}/${prefix}-hero-hondo.png`});
  await page.getByRole('button',{name:'Next hero',exact:true}).click();await page.waitForFunction(previous=>document.querySelector('#hero-details h1')?.textContent!==previous,label);
 }
 return rows;
}
test('player-visible cache arrows, item review, Auto receipts and Hero gear agree',async()=>{
 await mkdir(directory,{recursive:true});const {server,url}=await serveGame(),report=[];
 const browser=await chromium.launch({headless:true,executablePath:detectChromeExecutable()});
 try{for(const scenario of ['mixed','hondo','equal','decrease','kaja','kaja-last','kaja-interleaved','held','lowercp','fulltie','itemtie','rerank']){
  const fixture=trustFixture(scenario.startsWith('kaja')?'kaja':scenario),{save,heroes,selected,other}=fixture;
  if(scenario==='kaja-last')heroes.heroes=Object.fromEntries([...owners,'falie#1'].map(id=>[id,heroes.heroes[id]]));
  if(scenario==='kaja-interleaved')heroes.heroes=Object.fromEntries(['Falie','falie#1','Huun','Runa','Kojonn'].map(id=>[id,heroes.heroes[id]]));
  const context=await browser.newContext({viewport:{width:360,height:640}}),page=await context.newPage(),errors=[];context.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
   // Setup runs once in an isolated context. Reload must read the result, never reseed it.
   await context.addInitScript(({save,heroes})=>{if(sessionStorage.getItem('lamp-trust-seeded'))return;sessionStorage.setItem('lamp-trust-seeded','1');save.lamp.lastActivationAt=Date.now();localStorage.setItem('wishfire.equipment-economy.v5',JSON.stringify(save));localStorage.setItem('orka.hero_progress.v2',JSON.stringify(heroes));},{save,heroes});
   await enter(page,url);const originalIds=Object.keys(heroes.heroes),boot=await page.evaluate(count=>{const entries=Object.entries(window.__codexGame.globals.HeroProgress.heroes);return{original:entries.slice(0,count).map(([id])=>id),appended:entries.slice(count).map(([id,h])=>({id,owner:h.baseHeroName}))};},originalIds.length);assert.deepEqual(boot.original,originalIds,'boot preserves original records in exact order');assert.ok(boot.appended.every(h=>/^.+#[1-9]\d*$/.test(h.id)&&owners.includes(h.owner)),'combat appends only authored hero copies');await page.locator('#wishfire-lamp .lamp-collect').click();const dialog=page.locator('#lamp-dialog');await dialog.waitFor();
   const useful=owners.some(id=>gain(save,heroes.heroes[id],selected)>0)||!!other;
   if(!useful){
    assert.equal(await dialog.getAttribute('data-view'),'dismantle');await dialog.locator(`[data-action="queue"][data-id="${selected.instanceId}"]`).click();await page.waitForFunction(()=>document.querySelector('#lamp-dialog').dataset.view==='equip');
    const itemArrows=await arrows(page,owners.map(id=>gain(save,heroes.heroes[id],selected)));assert.equal(await dialog.locator('[data-action="auto-equip"]').count(),0);
    for(const id of owners){await dialog.locator(`[data-action="hero"][data-id="${id}"]`).click();assert.equal(await dialog.locator('[data-action="equip"]').isEnabled(),false);}
    await page.screenshot({path:`${directory}/${scenario}-item.png`});const after=await read(page);assert.deepEqual(after.loadouts,save.loadouts);report.push({scenario,itemArrows,unchanged:true});continue;
   }
   // This assertion must fail against the old implicit-first-item UI.
   await page.screenshot({path:`${directory}/${scenario}-opened.png`});assert.equal(await dialog.getAttribute('data-view'),'cache','opening cache must show inventory-wide arrows');
   const candidates=[...save.items.filter(i=>save.lamp.pending.includes(i.instanceId)||(save.lamp.discarded||[]).includes(i.instanceId)),...(save.lamp.reviewHold?[selected]:[])],cacheArrows=await arrows(page,owners.map(id=>Math.max(0,...candidates.map(i=>gain(save,heroes.heroes[id],i)))));
   assert.equal(await dialog.getByRole('button',{name:'Auto-Equip',exact:true}).isEnabled(),true);
   if(scenario==='mixed')await guidance(page,'auto-equip');
   await dialog.locator(`[data-action="queue"][data-id="${selected.instanceId}"]`).click();await page.waitForFunction(()=>document.querySelector('#lamp-dialog').dataset.view==='equip');
   const itemArrows=await arrows(page,owners.map(id=>gain(save,heroes.heroes[id],selected)));
   assert.equal(await dialog.locator('[data-action="auto-equip"]').count(),0,'selected-item arrows must never sit beside full-cache Auto');
   if(scenario==='mixed'){await guidance(page,'Falie');await dialog.locator('[data-action="hero"][data-id="Falie"]').click();await guidance(page,'equip');}
   await page.screenshot({path:`${directory}/${scenario}-item.png`});const beforeBack=await read(page);await dialog.getByRole('button',{name:'Back to cache',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#lamp-dialog').dataset.view==='cache');assert.deepEqual(await read(page),beforeBack,'Back changes no save field');
   await arrows(page,cacheArrows.map(a=>a.gain));const before=await read(page);
   await dialog.getByRole('button',{name:'Auto-Equip',exact:true}).click();await page.locator('.lamp-cp-feedback').first().waitFor();
   const receipts=await page.locator('.lamp-cp-feedback').evaluateAll(ns=>ns.map(n=>({id:n.dataset.hero,before:Number(n.dataset.before),after:Number(n.dataset.after),gain:Number(n.dataset.change)}))),after=await read(page);
   assertCacheExhausted(after,heroes);
   for(const receipt of receipts){assert.ok(cacheArrows.find(a=>a.id===receipt.id).green,'every Auto recipient was green in the cache');assert.equal(receipt.before,cp(before,heroes.heroes[receipt.id]));assert.equal(receipt.after,cp(after,heroes.heroes[receipt.id]));assert.ok(receipt.after>receipt.before);}
   for(const id of owners)for(const slot of ['hat','body','boots']){
    if(after.loadouts[id][slot]===before.loadouts[id][slot])continue;
    const item=after.items.find(i=>i.instanceId===after.loadouts[id][slot]);assert.ok(candidates.some(c=>c.instanceId===item.instanceId),'equipped gear came from cache');assert.ok(gain(scenario==='rerank'?{...before,loadouts:{...before.loadouts,[id]:{...after.loadouts[id],[slot]:before.loadouts[id][slot]}}}:before,heroes.heroes[id],item)>0,'replacement improves its owner');
   }
   assert.deepEqual(Object.keys(after.loadouts).sort(),Object.keys(save.loadouts).sort());if(save.loadouts['falie#1'])assert.deepEqual(after.loadouts['falie#1'],save.loadouts['falie#1']);
   if(scenario==='mixed'){assert.equal(after.loadouts.Falie.hat,selected.instanceId);assert.equal(after.loadouts.Huun.boots,other.instanceId);assert.equal(receipts.length,2);}
   if(scenario==='hondo'){assert.deepEqual(owners.map(id=>gain(save,heroes.heroes[id],selected)),[13.6,15,6,11.9]);assert.equal(after.loadouts.Huun.hat,selected.instanceId);}
   if(scenario.startsWith('kaja')){assert.equal(gain(save,heroes.heroes.Kojonn,selected),15);assert.equal(after.loadouts.Kojonn.hat,selected.instanceId);}
   if(scenario==='lowercp'||scenario==='fulltie'){assert.equal(gain(save,heroes.heroes.Falie,selected),60);assert.equal(gain(save,heroes.heroes.Huun,selected),60);assert.equal(after.loadouts[scenario==='lowercp'?'Huun':'Falie'].hat,selected.instanceId);if(scenario==='lowercp'){assert.ok(cp(save,heroes.heroes.Huun)<cp(save,heroes.heroes.Falie));assert.ok(save.items.find(i=>i.instanceId===save.loadouts.Huun.body).stats.HP>save.items.find(i=>i.instanceId===save.loadouts.Falie.body).stats.HP);}else assert.equal(cp(save,heroes.heroes.Falie),cp(save,heroes.heroes.Huun));}
   if(scenario==='itemtie'){assert.equal(after.loadouts.Falie.hat,other.instanceId);assert.ok(after.lamp.discarded.includes(selected.instanceId));}
   if(scenario==='rerank'){const revealed=candidates.find(i=>i!==selected&&i!==other);const intermediate={...save,loadouts:{...save.loadouts,Falie:{...save.loadouts.Falie,body:selected.instanceId}}};assert.ok(gain(intermediate,heroes.heroes.Falie,revealed)<=0);assert.equal(gain({...intermediate,loadouts:{...intermediate.loadouts,Falie:{...intermediate.loadouts.Falie,hat:other.instanceId}}},heroes.heroes.Falie,revealed),29.3);assert.equal(after.loadouts.Falie.body,revealed.instanceId);assert.equal(after.loadouts.Falie.hat,other.instanceId);}
   if(scenario==='held'){assert.equal(after.loadouts.Huun.hat,selected.instanceId);assert.equal(after.lamp.reviewHold,null);}
   await page.screenshot({path:`${directory}/${scenario}-receipts.png`});await page.waitForFunction(()=>!document.querySelector('.lamp-cp-feedback'));
   if(scenario==='itemtie'){await dialog.locator(`[data-action="queue"][data-id="${selected.instanceId}"]`).click();await arrows(page,owners.map(id=>gain(after,heroes.heroes[id],selected)));assert.equal(await dialog.locator('[data-action="queue-disposal"]').isEnabled(),true);await page.screenshot({path:`${directory}/itemtie-leftover-red.png`});}
   if(await page.locator('#lamp-overlay').isVisible())await dialog.getByRole('button',{name:'Close equipment comparison',exact:true}).click();
   const displayed=await heroScreens(page,after,heroes,scenario);await page.reload();await page.waitForFunction(()=>typeof window.render_game_to_text==='function');
   const restored=await read(page);assert.deepEqual(restored.loadouts,after.loadouts);assert.deepEqual(restored.items,after.items);
   assert.deepEqual(errors,[]);report.push({scenario,cacheArrows,itemArrows,receipts,displayed,reloadPreserved:true,errors});
  }catch(error){await page.screenshot({path:`${directory}/${scenario}-failure.png`});report.push({scenario,error:error.stack});throw error;}finally{await context.close();}
 }}finally{await browser.close();server?.kill();await writeFile(`${directory}/gameplay.json`,JSON.stringify(report,null,2));}
});

test('Auto-Equip never equips a hero advertised red by the arrows beside it',async()=>{
 await mkdir(directory,{recursive:true});const {server,url}=await serveGame(),browser=await chromium.launch({headless:true,executablePath:detectChromeExecutable()}),context=await browser.newContext({viewport:{width:360,height:640}}),page=await context.newPage(),fixture=trustFixture('mixed'),report={};
 try{
  await page.addInitScript(({save,heroes})=>{save.lamp.lastActivationAt=Date.now();localStorage.setItem('wishfire.equipment-economy.v5',JSON.stringify(save));localStorage.setItem('orka.hero_progress.v2',JSON.stringify(heroes));},fixture);
  await enter(page,url);await page.locator('#wishfire-lamp .lamp-collect').click();
  report.arrows=await page.locator('#lamp-dialog .lamp-hero').evaluateAll(ns=>ns.map(n=>({id:n.dataset.id,green:!!n.querySelector('.lamp-cp-direction.up')})));
  await page.screenshot({path:`${directory}/red-promise-before-auto.png`});
  await page.getByRole('button',{name:'Auto-Equip',exact:true}).click();await page.locator('.lamp-cp-feedback').first().waitFor();
  report.receipts=await page.locator('.lamp-cp-feedback').evaluateAll(ns=>ns.map(n=>({id:n.dataset.hero,gain:Number(n.dataset.change)})));
  await page.screenshot({path:`${directory}/red-promise-after-auto.png`});
  assert.ok(report.receipts.length>0);
  for(const receipt of report.receipts)assert.equal(report.arrows.find(a=>a.id===receipt.id)?.green,true,receipt.id+' was advertised red but Auto equipped gear');
 }finally{await writeFile(`${directory}/red-promise.json`,JSON.stringify(report,null,2));await context.close();await browser.close();server?.kill();}
});

test('a Kaja-only +15 upgrade survives the real dismantle flow with an early combat copy',async()=>{
 await mkdir(directory,{recursive:true});const {server,url}=await serveGame(),browser=await chromium.launch({headless:true,executablePath:detectChromeExecutable()}),context=await browser.newContext({viewport:{width:360,height:640}}),page=await context.newPage(),fixture=trustFixture('kaja'),report={};context.setDefaultTimeout(15000);
 try{
  await page.addInitScript(({save,heroes})=>{save.lamp.lastActivationAt=Date.now();localStorage.setItem('wishfire.equipment-economy.v5',JSON.stringify(save));localStorage.setItem('orka.hero_progress.v2',JSON.stringify(heroes));},fixture);
  assert.equal(gain(fixture.save,fixture.heroes.heroes.Kojonn,fixture.selected),15);
  await enter(page,url);await page.locator('#wishfire-lamp .lamp-collect').click();const dialog=page.locator('#lamp-dialog');await dialog.waitFor();report.openedView=await dialog.getAttribute('data-view');
  await page.screenshot({path:`${directory}/kaja-protection-before-action.png`});
  // On the broken build the player is offered Dismantle all immediately.
  if(report.openedView==='dismantle'){await dialog.getByRole('button',{name:'Dismantle all',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#lamp-overlay').hidden);}
  else{
   assert.equal(await dialog.locator('[data-action="disposal"]').isEnabled(),false);
   await dialog.locator(`[data-action="queue"][data-id="${fixture.selected.instanceId}"]`).click();
   assert.equal(await dialog.locator('[data-action="queue-disposal"]').isEnabled(),false);
  }
  const after=await read(page);report.survived=after.items.some(i=>i.instanceId===fixture.selected.instanceId);report.essence=after.lamp.essence;
  assert.equal(report.survived,true,'Dismantle destroyed a cached item worth +15 CP to Kaja');assert.equal(after.lamp.essence,fixture.save.lamp.essence);
 }finally{await writeFile(`${directory}/kaja-protection.json`,JSON.stringify(report,null,2));await context.close();await browser.close();server?.kill();}
});

test('an upgrade arriving during Auto feedback returns to inventory-wide review',async()=>{
 await mkdir(directory,{recursive:true});const {server,url}=await serveGame(),browser=await chromium.launch({headless:true,executablePath:detectChromeExecutable()}),context=await browser.newContext({viewport:{width:360,height:640}}),page=await context.newPage(),writer=await context.newPage(),fixture=trustFixture('mixed');context.setDefaultTimeout(15000);
 try{
  await page.addInitScript(({save,heroes})=>{save.lamp.lastActivationAt=Date.now();localStorage.setItem('wishfire.equipment-economy.v5',JSON.stringify(save));localStorage.setItem('orka.hero_progress.v2',JSON.stringify(heroes));},fixture);
  await writer.goto(new URL('/package.json',url).href);await enter(page,url);await page.locator('#wishfire-lamp .lamp-collect').click();await page.getByRole('button',{name:'Auto-Equip',exact:true}).click();await page.locator('.lamp-cp-feedback').first().waitFor();
  const incoming={...fixture.selected,instanceId:'lamp:42:14',sequence:14,stats:{ATK:3000,DEF:3000,MAG:3000,RES:3000,HP:30000}};
  await writer.evaluate(item=>{const save=JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5'));save.items.push(item);save.lamp.pending.push(item.instanceId);save.lamp.sequence=15;localStorage.setItem('wishfire.equipment-economy.v5',JSON.stringify(save));},incoming);
  await page.waitForFunction(()=>!document.querySelector('.lamp-cp-feedback'));await page.waitForFunction(()=>document.querySelector('#lamp-dialog').dataset.view==='cache');
  assert.equal(await page.locator('#lamp-overlay').isVisible(),true);assert.equal(await page.locator('#lamp-dialog .lamp-candidate').count(),0);
  const save=await read(page),result=await arrows(page,owners.map(id=>Math.max(0,gain(save,fixture.heroes.heroes[id],incoming))));
  assert.equal(await page.locator('#lamp-dialog [data-action="disposal"]').isEnabled(),false);assert.equal(await page.getByRole('button',{name:'Auto-Equip',exact:true}).isEnabled(),true);
  await page.screenshot({path:`${directory}/feedback-arrival-overview.png`});await writeFile(`${directory}/feedback-arrival.json`,JSON.stringify({arrows:result,incoming:incoming.instanceId,view:'cache'},null,2));
 }finally{await context.close();await browser.close();server?.kill();}
});

test('a legal equip in another tab rescues a stale disposal item and manual Equip preserves other gear',async()=>{
 await mkdir(directory,{recursive:true});const {server,url}=await serveGame(),browser=await chromium.launch({headless:true,executablePath:detectChromeExecutable()}),context=await browser.newContext({viewport:{width:360,height:640}}),page=await context.newPage(),writer=await context.newPage(),fixture=trustFixture('decrease');context.setDefaultTimeout(15000);
 const {save,heroes,selected}=fixture,stats=n=>({ATK:n,DEF:n,MAG:n,RES:n,HP:n});
 for(const id of owners)for(const slot of ['hat','body','boots'])save.items.find(i=>i.instanceId===save.loadouts[id][slot]).stats=stats(id==='Falie'?1:10000);
 save.items.find(i=>i.instanceId===save.loadouts.Falie.hat).stats={...stats(1),MAG:200};save.items.find(i=>i.instanceId===save.loadouts.Falie.boots).stats=stats(0);
 selected.type='body';selected.stats={...stats(1),ATK:10};const hat={...structuredClone(selected),instanceId:'lamp:42:13',sequence:13,type:'hat',stats:{ATK:1,MAG:1,DEF:200,RES:200,HP:2000}};
 assert.equal(gain(save,heroes.heroes.Falie,selected),0);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try{
  await page.addInitScript(({save,heroes})=>{if(sessionStorage.getItem('stale-seeded'))return;sessionStorage.setItem('stale-seeded','1');save.lamp.lastActivationAt=Date.now();localStorage.setItem('wishfire.equipment-economy.v5',JSON.stringify(save));localStorage.setItem('orka.hero_progress.v2',JSON.stringify(heroes));},{save,heroes});
  await enter(page,url);const beforeScreens=await heroScreens(page,save,heroes,'stale-before');await page.getByRole('button',{name:'QUESTS',exact:true}).click();await page.getByRole('button',{name:'Continue Battle',exact:true}).click();await page.locator('#wishfire-lamp .lamp-collect').waitFor();
  await page.locator('#wishfire-lamp .lamp-collect').click();await page.waitForFunction(()=>document.querySelector('#lamp-dialog').dataset.view==='dismantle');
  const preview=await page.evaluate(async()=>{const {createEquipmentStorage}=await import('./systems/equipmentStorage.mjs');const store=createEquipmentStorage({globals:window.__codexGame.globals,storage:localStorage});await store.sync();return store.disposalPreview();});
  await page.screenshot({path:`${directory}/stale-disposal-before.png`});
  await writer.goto(new URL('/package.json',url).href);
  const receipt=await writer.evaluate(async hat=>{
   // A disclosed incoming-item fixture; the subsequent equip is the production transaction.
   const saved=JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5'));saved.items.push(hat);saved.lamp.pending.push(hat.instanceId);saved.lamp.sequence=14;localStorage.setItem('wishfire.equipment-economy.v5',JSON.stringify(saved));
   const {createEquipmentStorage}=await import('/web-runner/systems/equipmentStorage.mjs');const store=createEquipmentStorage({globals:{HeroProgress:JSON.parse(localStorage.getItem('orka.hero_progress.v2')),goldTotal:saved.gold},storage:localStorage});await store.sync();return store.equip('Falie',hat.instanceId);
  },hat);assert.ok(receipt.cpChange>0);
  await page.bringToFront();
  // The arrival opens the overview before the second tab finishes equipping.
  // Wait for its committed loadout AND rendered tile removal, independently of arrows.
  await page.waitForFunction(id=>document.querySelector('#lamp-dialog').dataset.view==='cache'&&window.__codexGame.globals.Equipment?.loadouts?.Falie?.hat===id&&![...document.querySelectorAll('#lamp-dialog .lamp-tile')].some(n=>n.dataset.id===id),hat.instanceId);
  const afterHat=await read(page);assert.ok(gain(afterHat,heroes.heroes.Falie,selected)>0);
  await arrows(page,owners.map(id=>Math.max(0,gain(afterHat,heroes.heroes[id],selected))));
  const guard=await page.evaluate(async preview=>{const {createEquipmentStorage}=await import('./systems/equipmentStorage.mjs');const store=createEquipmentStorage({globals:window.__codexGame.globals,storage:localStorage,reportError:()=>{}});await store.sync();const before=localStorage.getItem('wishfire.equipment-economy.v5');try{await store.dismantle(preview);return{rejected:false};}catch(e){return{rejected:true,message:e.message,unchanged:before===localStorage.getItem('wishfire.equipment-economy.v5')};}},preview);
  assert.equal(guard.rejected,true);assert.match(guard.message,/still improves/);assert.equal(guard.unchanged,true);
  await page.screenshot({path:`${directory}/stale-disposal-rescued.png`});
  await page.locator(`#lamp-dialog [data-action="queue"][data-id="${selected.instanceId}"]`).click();await page.locator('#lamp-dialog [data-action="hero"][data-id="Falie"]').click();
  const beforeManual=await read(page);await page.locator('#lamp-dialog [data-action="equip"]').click();await page.locator('.lamp-cp-feedback').waitFor();const after=await read(page);
  assertCacheExhausted(after,heroes);
  assert.equal(after.loadouts.Falie.body,selected.instanceId);assert.equal(Math.round((cp(after,heroes.heroes.Falie)-cp(beforeManual,heroes.heroes.Falie))*10)/10,gain(beforeManual,heroes.heroes.Falie,selected));
  for(const id of owners)for(const slot of ['hat','body','boots'])if(id!=='Falie'||slot!=='body')assert.equal(after.loadouts[id][slot],beforeManual.loadouts[id][slot]);
  await page.waitForFunction(()=>!document.querySelector('.lamp-cp-feedback'));if(await page.locator('#lamp-overlay').isVisible())await page.locator('#lamp-dialog [data-action="close"]').click();
  const afterScreens=await heroScreens(page,after,heroes,'stale-after');assert.ok(afterScreens[0].cp>beforeScreens[0].cp);
  await page.reload();await page.waitForFunction(()=>typeof window.render_game_to_text==='function');assert.deepEqual((await read(page)).loadouts,after.loadouts);assert.deepEqual(errors,[]);
  await writeFile(`${directory}/stale-disposal.json`,JSON.stringify({beforeScreens,afterScreens,preview,guard,receipt,reloadPreserved:true,errors},null,2));
 }catch(e){await page.screenshot({path:`${directory}/stale-disposal-failure.png`});throw e;}finally{await context.close();await browser.close();server?.kill();}
});

// Negative controls prove the browser assertion detects a missed positive assignment.
 test('exhaustion proof detects eligible leftovers in pending discarded and held queues',async()=>{
 const report=[];
 for(const queue of ['pending','discarded','held']){
  const {save,heroes,selected,other}=trustFixture('mixed');save.items=save.items.filter(i=>i.instanceId!==other.instanceId);save.lamp.pending=queue==='pending'?[selected.instanceId]:[];save.lamp.discarded=queue==='discarded'?[selected.instanceId]:[];save.lamp.reviewHold=queue==='held'?{item:selected,disposal:false}:null;if(queue==='held')save.items=save.items.filter(i=>i.instanceId!==selected.instanceId);
  let message;try{assertCacheExhausted(save,heroes);}catch(error){message=error.message;}
  assert.match(message,/Auto left .* as a \+[\d.]+ CP upgrade for Falie/);report.push({queue,rejected:true,message});
 }
 await mkdir(directory,{recursive:true});await writeFile(`${directory}/exhaustion-negative-controls.json`,JSON.stringify(report,null,2));
});
