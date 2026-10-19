import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHeroProgressStore,refreshHeroStats} from '../web-runner/src/core/heroProgression.mjs';
import {createLampEconomy,generateLampItem,lampStoredCount,lampCapacity,salvageValue,lampItemCPGain} from '../web-runner/src/core/lampGear.mjs';
import {validateConveyorState} from '../web-runner/src/core/lampConveyor.mjs';
const require=createRequire(import.meta.url),{detectChromeExecutable}=require('../tools/playwright_support.js');
const directory=process.env.LAMP_QA_OUTPUT||'test-results/lamp';
const profiles=[[360,640,1],[216,384,2],[233,452,2],[316,452,2]];
const state=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')));
async function assertSave(page){const save=await state(page);validateConveyorState(save);assert.ok(lampStoredCount(save)<=lampCapacity(save));return save;}
async function tick(page){const before=await state(page);await page.evaluate(t=>window.setLampQAClock(t+5100),Math.max(Date.now(),before.lamp.lastActivationAt));await page.waitForFunction(n=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.sequence>n,before.lamp.sequence);return assertSave(page);}
async function waitForArrival(page,id){
 await page.waitForFunction(id=>[...document.querySelectorAll('.lamp-conveyor-item')].some(node=>node.dataset.id===id&&node.getAnimations()[0]),id);
 await page.evaluate(id=>{const node=[...document.querySelectorAll('.lamp-conveyor-item')].find(item=>item.dataset.id===id);const animation=node?.getAnimations()[0];if(animation?.playState==='running')animation.updatePlaybackRate(10);},id);
 await page.waitForFunction(id=>{const save=JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5'));return save.lamp.emissions.some(emission=>emission.item.instanceId===id&&emission.collected)&&save.items.some(item=>item.instanceId===id);},id);
 return assertSave(page);
}
async function enter(page,url){
 await page.bringToFront();await page.goto(url);await page.waitForFunction(()=>typeof window.render_game_to_text==='function');
 await page.waitForTimeout(2000);const c=await page.locator('canvas').first().boundingBox();await page.mouse.click(c.x+c.width/2,c.y+426*c.width/360);
 await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).quest.phase==='combat');await page.locator('#wishfire-lamp .lamp-conveyor').waitFor();
}
async function movingTap(page,id){
 await page.waitForFunction(id=>{const n=[...document.querySelectorAll('.lamp-conveyor-item')].find(n=>n.dataset.id===id);if(!n)return false;const r=n.getBoundingClientRect(),b=n.parentElement.getBoundingClientRect();return Math.min(r.right,b.right)-Math.max(r.left,b.left)>12;},id);
 const point=await page.evaluate(id=>{const n=[...document.querySelectorAll('.lamp-conveyor-item')].find(n=>n.dataset.id===id),r=n.getBoundingClientRect(),b=n.parentElement.getBoundingClientRect();return{x:(Math.max(r.left,b.left)+Math.min(r.right,b.right))/2,y:r.top+r.height/2};},id);
 await page.mouse.click(point.x,point.y);
}
async function movement(page,id,{paused=false}={}){
 await page.evaluate(id=>window.sampledConveyorNode=[...document.querySelectorAll('.lamp-conveyor-item')].find(n=>n.dataset.id===id),id);
 const combatBefore=await page.evaluate(()=>window.__codexGame.globals.time),before=await page.evaluate(()=>window.sampledConveyorNode.getBoundingClientRect().x);await delay(400);
 const after=await page.evaluate(id=>{const n=[...document.querySelectorAll('.lamp-conveyor-item')].find(n=>n.dataset.id===id);return{same:n===window.sampledConveyorNode,x:n.getBoundingClientRect().x,running:n.getAnimations()[0]?.playState,beltObject:!!document.querySelector('.lamp-conveyor-track')};},id);
 await page.waitForFunction(before=>window.__codexGame.globals.time>before,combatBefore,{timeout:3000});const combatAfter=await page.evaluate(()=>window.__codexGame.globals.time);assert.ok(combatAfter>combatBefore,'combat continues during cache review');assert.equal(after.same,true);assert.equal(after.running,paused?'paused':'running');assert.equal(after.beltObject,false,'item motion has no literal belt object');if(paused)assert.ok(Math.abs(after.x-before)<.1,'cache freezes equipment in place');else assert.ok(after.x>before+2,'equipment moves left to right without restarting its node');return{before,...after,combatBefore,combatAfter};
}
async function containment(page){
 const result=await page.evaluate(()=>{const d=document.querySelector('#lamp-dialog'),m=document.querySelector('#lamp-overlay'),s=document.querySelector('#wishfire-lamp'),c=document.querySelector('canvas'),r=d.getBoundingClientRect(),sr=s.getBoundingClientRect(),cr=c.getBoundingClientRect();return{viewport:[innerWidth,innerHeight,devicePixelRatio],horizontal:document.documentElement.scrollWidth>innerWidth,dialogHorizontal:d.scrollWidth>d.clientWidth+1,contained:r.left>=-.5&&r.right<=innerWidth+.5&&r.top>=-.5&&r.bottom<=innerHeight+.5,conveyorAccessible:m.getBoundingClientRect().bottom<sr.top,stripY:(sr.top-cr.top)/(cr.width/360),stripHeight:sr.height/(cr.width/360),portraits:[...d.querySelectorAll('.lamp-hero img')].every(i=>i.complete&&i.naturalWidth>0),stats:d.querySelectorAll('.lamp-item-stats dd').length,primaryVisible:[...d.querySelectorAll('.lamp-review-actions button,#lamp-dialog[data-view=dismantle]>.lamp-actions button')].every(b=>{const t=b.getBoundingClientRect();return t.top>=r.top&&t.bottom<=r.bottom&&t.height>=43;}),identityFits:[...d.querySelectorAll('.lamp-quality-band>*')].every(n=>{const t=n.getBoundingClientRect(),p=n.closest('.lamp-candidate').getBoundingClientRect();return t.top>=p.top&&t.bottom<=p.bottom;}),buttons:[...d.querySelectorAll('button')].every(b=>{const t=b.getBoundingClientRect();return t.left>=r.left-.5&&t.right<=r.right+.5;})};});
 assert.equal(result.horizontal,false);assert.equal(result.dialogHorizontal,false);assert.equal(result.contained,true);assert.equal(result.conveyorAccessible,await page.locator('#lamp-dialog').getAttribute('data-view')!=='upgrade'&&await page.locator('#lamp-dialog').getAttribute('data-view')!=='upgrade-complete');assert.equal(result.portraits,true);assert.equal(result.buttons,true);assert.equal(result.primaryVisible,true);assert.equal(result.identityFits,true);assert.ok(Math.abs(result.stripY-488)<.5);assert.ok(Math.abs(result.stripHeight-92)<.5);return result;
}
async function upgradeWithoutScroll(page){
 // The runtime positions the newly opened upgrade dialog on its next frame.
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const metrics=await page.evaluate(()=>{
  const dialog=document.querySelector('#lamp-dialog'),odds=dialog.querySelector('.lamp-odds-scroll'),overlay=document.querySelector('#lamp-overlay'),r=dialog.getBoundingClientRect();
  const cells=[...odds.querySelectorAll('tbody th,tbody td')].map(n=>{const range=document.createRange();range.selectNodeContents(n);const text=range.getBoundingClientRect(),cell=n.getBoundingClientRect();return text.left>=cell.left-.5&&text.right<=cell.right+.5&&text.top>=r.top&&text.bottom<=r.bottom;});
  return{height:r.height,overlayHeight:overlay.getBoundingClientRect().height,dialogClient:dialog.clientHeight,dialogTotal:dialog.scrollHeight,oddsClient:odds.clientHeight,oddsTotal:odds.scrollHeight,rows:odds.querySelectorAll('tbody tr').length,cellsFit:cells.every(Boolean),controlsFit:[...dialog.querySelectorAll('.bag-level-up,.bag-modal-close')].every(n=>{const b=n.getBoundingClientRect();return b.top>=r.top&&b.bottom<=r.bottom;})};
 });
 assert.equal(metrics.rows,5);assert.equal(metrics.cellsFit,true,'all current/next percentages are visible');assert.equal(metrics.controlsFit,true);
 assert.ok(metrics.dialogTotal<=metrics.dialogClient+1,'Wish Lamp needs no modal scroll: '+JSON.stringify(metrics));
 assert.ok(metrics.oddsTotal<=metrics.oddsClient+1,'Wish Lamp needs no odds scroll: '+JSON.stringify(metrics));return metrics;
}
async function conveyorGap(page){
 const result=await page.evaluate(()=>{
  const lane=document.querySelector('.lamp-conveyor'),strip=document.querySelector('#wishfire-lamp'),source=lane.querySelector('.lamp-conveyor-item');
  if(!source)throw Error('Spacing proof needs an issued item');
  // Disposable copies of the rendered tile avoid depending on expired previews.
  const nodes=[0,1].map(()=>{const n=source.cloneNode(true);n.hidden=false;n.style.display='';n.style.animationDelay='0s';lane.append(n);n.getBoundingClientRect();return n;});
  try{
   // Sample the real CSS animation at exactly one unchanged emission interval apart.
   nodes.forEach((n,i)=>{const animation=n.getAnimations()[0];animation.pause();animation.currentTime=(10-i*5)*1000;});
   const art=nodes.map(n=>n.querySelector('.lamp-art').getBoundingClientRect()),scale=strip.getBoundingClientRect().width/360;
   return{scale,artWidth:art[0].width,gap:art[0].left-art[1].right,oldGap:art[0].width+(30*scale*5-art[0].width)*.6*.7-art[0].width,viewport:[innerWidth,innerHeight,devicePixelRatio]};
  }finally{nodes.forEach(n=>n.remove());}
 });
 assert.ok(Math.abs(result.gap-result.oldGap*.6)<.1,'reduce previous artwork-edge gap by 40%, keeping full item width: '+JSON.stringify(result));
 assert.ok(result.gap>0,'regular emission does not overlap');return result;
}
function fixture(){
 const save=createLampEconomy(42),heroes=createHeroProgressStore(),stats=n=>({ATK:n,DEF:n,MAG:n,RES:n,HP:n});save.lamp.essence=1000;
 for(const h of Object.values(heroes.heroes)){h.currentLevel=5;refreshHeroStats(h);h.hp=h.maxHP;for(const type of ['hat','body','boots']){const i={...generateLampItem(42,0,0),instanceId:`owned:${h.heroInstanceKey}:${type}`,type,stats:stats(20)};save.items.push(i);(save.loadouts[h.heroInstanceKey]||={})[type]=i.instanceId;}}
 for(let n=0;n<20;n++){const i=generateLampItem(42,n,0);if(n<3){i.type=['hat','body','boots'][n];i.stats=stats(30);}else i.stats=stats(2);save.items.push(i);save.lamp.pending.push(i.instanceId);save.lamp.sequence++;}
 // Disclosed seeded cache/issued fixture; production UI owns every subsequent transaction.
 save.lamp.emissions=save.items.filter(i=>i.instanceId.startsWith('lamp:')).slice(0,3).map((item,n)=>({item,issuedAt:0,collected:true,age:3000+n*2000}));return{save,heroes};
}

test('one actual CP invariant controls arrows, equip and disposal across four phones',async()=>{
 let server,url=process.env.LAMP_QA_URL;const report=[];await mkdir(directory,{recursive:true});
 if(!url){const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));url=`http://localhost:${port}/web-runner/index.html`;server=spawn(process.execPath,['tools/serve_web.js','--port',String(port),'--host','127.0.0.1'],{stdio:'ignore'});for(let n=0;n<50;n++){try{if((await fetch(url)).ok)break;}catch{}if(n===49)throw Error('Lamp server did not start');await delay(100);}}
 const browser=await chromium.launch({headless:true,executablePath:detectChromeExecutable()});
 try{for(const [width,height,dpr] of profiles){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr});context.setDefaultTimeout(15000);
  try{for(const scenario of ['increase','decrease','equal','mixed']){
   const save=createLampEconomy(42),heroes=createHeroProgressStore(),stats=n=>({ATK:n,DEF:n,MAG:n,RES:n,HP:n}),candidate={...generateLampItem(42,4,0),type:'hat',stats:stats(10)};
   const ownerStats=[{ATK:1,DEF:10,MAG:6,RES:10,HP:87},{ATK:1,DEF:10,MAG:19,RES:10,HP:90},{ATK:1,DEF:10,MAG:3,RES:10,HP:118},{ATK:1,DEF:10,MAG:5,RES:10,HP:92}];
   if(scenario==='increase')candidate.stats={ATK:15,DEF:10,MAG:15,RES:10,HP:80};
   Object.values(heroes.heroes).forEach((hero,n)=>{const item={...generateLampItem(42,n,0),type:'hat',stats:scenario==='increase'?ownerStats[n]:stats(scenario==='decrease'||scenario==='mixed'&&n<2?1000:scenario==='equal'?10:1)};save.items.push(item);save.loadouts[hero.heroInstanceKey]={hat:item.instanceId};});
   save.items.push(candidate);save.lamp.pending=[candidate.instanceId];save.lamp.sequence=5;validateConveyorState(save);
   const expectedGains=Object.values(heroes.heroes).map(h=>lampItemCPGain(save,candidate,h)),useful=expectedGains.some(g=>g>0);
   if(scenario==='increase')assert.deepEqual(expectedGains,[13.6,15,6,11.9]);
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.addInitScript(({save,heroes})=>{save.lamp.lastActivationAt=Date.now();localStorage.setItem('wishfire.equipment-economy.v5',JSON.stringify(save));localStorage.setItem('orka.hero_progress.v2',JSON.stringify(heroes));},{save,heroes});
    await enter(page,url);const dialog=page.locator('#lamp-dialog');await page.locator('#wishfire-lamp .lamp-collect').click();await dialog.waitFor();
    await dialog.locator(`.lamp-tile[data-id="${candidate.instanceId}"]`).click();
    await page.waitForFunction(()=>document.querySelector('#lamp-dialog').dataset.view==='equip');
    const arrows=await dialog.locator('.lamp-hero').evaluateAll(ns=>ns.map(n=>({hero:n.dataset.id,gain:Number(n.dataset.cpChange),up:!!n.querySelector('.lamp-cp-direction.up'),down:!!n.querySelector('.lamp-cp-direction.down')})));
    assert.equal(arrows.length,4);assert.ok(arrows.every((a,n)=>a.gain===expectedGains[n]&&a.up===(expectedGains[n]>0)&&a.down===(expectedGains[n]<=0)));
    assert.equal(await dialog.locator('[data-action="queue-disposal"]').isEnabled(),!useful);
    await dialog.locator('.lamp-hero').first().click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.guide&2);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    assert.equal(await dialog.locator('[data-action="equip"]').isEnabled(),expectedGains[0]>0);
    assert.equal(await dialog.locator('[data-action="auto-equip"]').count(),0);
    if(useful)assert.equal(await dialog.locator('[data-action="disposal"]').isEnabled(),false,'Done cannot send a remaining upgrade to disposal');
    const layout=await containment(page);await page.screenshot({path:`${directory}/${width}-cp-${scenario}.png`});
    if(useful){
     await dialog.getByRole('button',{name:'Back to cache',exact:true}).click();await dialog.getByRole('button',{name:'Auto-Equip',exact:true}).click();await page.locator('.lamp-cp-feedback').waitFor();
     const feedback=await page.locator('.lamp-cp-feedback').evaluateAll(ns=>ns.map(n=>({hero:n.dataset.hero,before:+n.dataset.before,after:+n.dataset.after,change:+n.dataset.change})));
     assert.equal(feedback.length,1);assert.equal(feedback[0].change,Math.max(...expectedGains));assert.ok(feedback[0].after>feedback[0].before);
     if(scenario==='increase')assert.equal(feedback[0].hero,'Huun');
     const saved=await assertSave(page);assert.equal(Object.values(saved.loadouts).filter(slots=>slots.hat===candidate.instanceId).length,1);await page.waitForFunction(()=>document.querySelector('#lamp-overlay').hidden);
    }else{await dialog.locator('[data-action="queue-disposal"]').click();await page.waitForFunction(()=>document.querySelector('#lamp-dialog').dataset.view==='dismantle');assert.equal(await dialog.getAttribute('data-view'),'dismantle');await dialog.getByRole('button',{name:'Dismantle all',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#lamp-overlay').hidden);}
    assert.deepEqual(errors,[]);report.push({width,height,dpr,scenario,arrows,layout,errors});
   }finally{await page.close();}
  }}finally{await context.close();}
 }}finally{await browser.close();server?.kill();await writeFile(`${directory}/cp-invariant.json`,JSON.stringify(report,null,2));}
});

test('continuous equipment lifecycle: four phones, full-cache pause, concurrent active-tab collection, CP loss rejection and selected disposal',async()=>{
 let server,url=process.env.LAMP_QA_URL;const report=[];await mkdir(directory,{recursive:true});
 if(!url){const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));url=`http://localhost:${port}/web-runner/index.html`;server=spawn(process.execPath,['tools/serve_web.js','--port',String(port),'--host','127.0.0.1'],{stdio:'ignore'});for(let n=0;n<50;n++){try{if((await fetch(url)).ok)break;}catch{}if(n===49)throw Error('Lamp server did not start');await delay(100);}}
 const browser=await chromium.launch({headless:true,executablePath:detectChromeExecutable()});
 try{for(const [width,height,dpr] of profiles){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr}),page=await context.newPage(),errors=[];context.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.lampPassageBounces=[];const original=Element.prototype.animate;Element.prototype.animate=function(...args){const animation=original.apply(this,args);if(this.matches('.lamp-bag-art')){const receipt={art:this,animation,samples:[]};window.lampPassageBounces.push(receipt);const sample=()=>{const style=getComputedStyle(this);receipt.samples.push({opacity:Number(style.opacity),scale:new DOMMatrixReadOnly(style.transform).a});if(animation.playState==='running')requestAnimationFrame(sample);};requestAnimationFrame(sample);}return animation;};});
  await page.addInitScript(({save,heroes})=>{const realNow=Date.now;let offset=0;Date.now=()=>realNow()+offset;window.setLampQAClock=t=>offset=t-realNow();if(localStorage.getItem('test.conveyor.seeded'))return;localStorage.setItem('test.conveyor.seeded','1');save.lamp.emissions=save.lamp.emissions.map(({age,...e})=>({...e,issuedAt:Date.now()-age}));localStorage.setItem('wishfire.equipment-economy.v5',JSON.stringify(save));localStorage.setItem('orka.hero_progress.v2',JSON.stringify(heroes));},fixture());
  try{
   await enter(page,url);const strip=page.locator('#wishfire-lamp'),dialog=page.locator('#lamp-dialog');let saved=await assertSave(page);
   await writeFile(`${directory}/${width}-gap.json`,JSON.stringify(await conveyorGap(page),null,2));
   assert.equal(saved.partyEXP,0);assert.equal(lampStoredCount(saved),20);assert.equal(await strip.locator('.lamp-review-arrow').count(),3);assert.equal(await page.locator('.lamp-equip-puff').count(),0);
   const raw=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));
   await page.evaluate(()=>{window.initialBagArt=document.querySelector('.lamp-bag-art');const r=window.initialBagArt.getBoundingClientRect();window.initialBagSize={width:r.width,height:r.height};});assert.equal(await page.evaluate(()=>window.lampPassageBounces.length),0,'initial saved history does not replay a receiving tween');
   const pausedId=saved.lamp.emissions.at(-1).item.instanceId;
   const movingFull=await movement(page,pausedId,{paused:true});
   await page.evaluate(()=>window.setLampQAClock(Date.now()+6000));await delay(300);
   assert.equal((await state(page)).lamp.sequence,saved.lamp.sequence,'full cache pauses issuance');
   assert.equal(await page.evaluate(()=>window.lampPassageBounces.length),0,'full cache cannot bounce');
   await strip.locator('.lamp-collect').click();await dialog.waitFor();
   const movingReview=await movement(page,pausedId,{paused:true}),reviewLayout=await containment(page),passageBounce={fullCacheBounce:false};
   assert.equal(await dialog.locator('.lamp-hero-current-cp').count(),4);assert.equal(await dialog.locator('.lamp-actions button').count(),2);assert.equal(await dialog.getByText(/^Revealed /).count(),0);
   const mainIds=await dialog.locator('[aria-label="Actionable upgrades"] .lamp-tile').evaluateAll(ns=>ns.map(n=>({id:n.dataset.id,gain:Number(n.dataset.bestGain),arrow:!!n.querySelector('.lamp-review-arrow')})));assert.equal(mainIds.length,3);assert.ok(mainIds.every(n=>n.gain>0&&n.arrow));
   await page.evaluate(()=>{const original=performance.now.bind(performance);performance.now=()=>original()+15100;});await page.locator('.lamp-idle-helper').waitFor();assert.equal(await page.locator('.lamp-idle-helper').getAttribute('data-target'),'auto-equip');
   const helperContained=await page.evaluate(async()=>{const h=document.querySelector('.lamp-idle-helper');for(let frame=0;frame<12;frame++){await new Promise(requestAnimationFrame);for(const n of h.querySelectorAll('img,span')){const r=n.getBoundingClientRect();if(r.left<-.5||r.right>innerWidth+.5||r.top<-.5||r.bottom>innerHeight+.5)return false;}}return true;});assert.equal(helperContained,true);

   const beforeAuto=await assertSave(page);
   await dialog.getByRole('button',{name:'Auto-Equip',exact:true}).click();await page.locator('.lamp-cp-feedback').first().waitFor();
   assert.equal(await dialog.getAttribute('data-view'),'cache','Auto waits for saved CP feedback before disposal');
   const feedback=await page.locator('.lamp-cp-feedback').evaluateAll(ns=>ns.map(n=>({hero:n.dataset.hero,before:+n.dataset.before,after:+n.dataset.after,change:+n.dataset.change})));
   assert.ok(feedback.length>0);assert.ok(feedback.every(n=>n.after>n.before&&Math.abs(n.after-n.before-n.change)<.11));
   await page.waitForFunction(()=>!document.querySelector('.lamp-cp-feedback'));assert.equal(await dialog.getAttribute('data-view'),'dismantle');
   const disposal=await assertSave(page),selectedIds=await dialog.locator('[data-disposal-selected=true]').evaluateAll(ns=>ns.map(n=>n.dataset.id)),bank=disposal.lamp.essence;assert.equal(selectedIds.length,lampStoredCount(disposal)+(disposal.lamp.reviewHold?1:0));assert.ok(selectedIds.length>0);
   const expectedEssence=selectedIds.reduce((n,id)=>n+salvageValue(disposal.items.find(i=>i.instanceId===id)||disposal.lamp.reviewHold.item),0);
   await page.screenshot({path:`${directory}/${width}-disposal-review.png`});await dialog.getByRole('button',{name:'Dismantle all',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#lamp-overlay').hidden);await page.locator('.lamp-reward-banner').waitFor();
   saved=await assertSave(page);assert.equal(lampStoredCount(saved),0);assert.equal(saved.lamp.reviewHold??null,null);assert.equal(saved.lamp.essence,bank+expectedEssence);assert.equal(saved.partyEXP,0);assert.equal(saved.lamp.autoEnabled,false);
   // Automatic creation resumes without a toggle; an active second tab can deliver an item outside the current review snapshot.
   const resumed=await tick(page),first=resumed.lamp.emissions.at(-1).item;assert.equal(resumed.partyEXP,0);const arrivedFirst=await waitForArrival(page,first.instanceId);assert.ok(lampStoredCount(arrivedFirst)>=1);assert.equal(arrivedFirst.lamp.emissions.find(emission=>emission.item.instanceId===first.instanceId).collected,true);
   await strip.locator('.lamp-collect').click();await dialog.waitFor();assert.equal(await dialog.getAttribute('data-view'),'dismantle','all-trash bag skips the empty cache');assert.equal(await dialog.locator('[data-action=cache]').count(),0);assert.equal(await dialog.locator('.lamp-actions button').count(),1);assert.equal(await dialog.getByRole('button',{name:'Dismantle all',exact:true}).isEnabled(),true);await containment(page);const firstDisposalIds=await dialog.locator('[data-disposal-selected=true]').evaluateAll(ns=>ns.map(n=>n.dataset.id));assert.ok(firstDisposalIds.includes(first.instanceId));const firstDisposalValue=firstDisposalIds.reduce((sum,id)=>sum+salvageValue(arrivedFirst.items.find(item=>item.instanceId===id)),0);
    const background=await context.newPage();await background.addInitScript(()=>{const realNow=Date.now;let offset=0;Date.now=()=>realNow()+offset;window.setLampQAClock=t=>offset=t-realNow();});await enter(background,url);const issuedLater=await tick(background),later=issuedLater.lamp.emissions.at(-1).item,arrived=await waitForArrival(background,later.instanceId);await background.close();assert.equal(arrived.partyEXP,0);await page.waitForFunction(id=>[...document.querySelectorAll('#lamp-dialog [data-disposal-selected=false]')].some(tile=>tile.dataset.id===id),later.instanceId);assert.ok((await dialog.locator('[data-disposal-selected=false]').evaluateAll(ns=>ns.map(n=>n.dataset.id))).includes(later.instanceId),'new arrivals stay outside the reviewed snapshot');const bank2=arrived.lamp.essence;
   const beforeDismantleFailure=await page.evaluate(()=>localStorage.getItem('wishfire.equipment-economy.v5'));await page.evaluate(()=>{const original=Storage.prototype.setItem;window.restoreDismantleWrite=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(key,value){if(key==='wishfire.equipment-economy.v5')throw Error('isolated dismantle write failure');return original.call(this,key,value);};});
   await dialog.getByRole('button',{name:'Dismantle all',exact:true}).click();await dialog.getByText('isolated dismantle write failure',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('wishfire.equipment-economy.v5')),beforeDismantleFailure);assert.equal(await page.locator('.lamp-reward-banner').count(),0);assert.equal(await dialog.getAttribute('data-view'),'dismantle');await containment(page);await page.evaluate(()=>window.restoreDismantleWrite());
   await dialog.getByRole('button',{name:'Dismantle all',exact:true}).dblclick();await page.waitForFunction(()=>document.querySelector('#lamp-overlay').hidden);saved=await assertSave(page);assert.equal(saved.lamp.essence,bank2+firstDisposalValue);assert.ok(saved.items.some(i=>i.instanceId===later.instanceId));assert.ok(firstDisposalIds.every(id=>!saved.items.some(i=>i.instanceId===id)));assert.equal(saved.partyEXP,0);

   await strip.locator('.lamp-collect').click();await dialog.waitFor();assert.equal(await dialog.getAttribute('data-view'),'dismantle');await dialog.locator('[data-id="'+later.instanceId+'"]').click();await dialog.getByRole('button',{name:'Choose Fara',exact:true}).click();
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.guide&2);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   assert.equal(await dialog.getByRole('button',{name:'Equip',exact:true}).isEnabled(),false,'a red item cannot be manually equipped');
   const failureLayout=await containment(page),savedBefore=await state(page);assert.equal(savedBefore.partyEXP,0);assert.equal(await page.locator('.lamp-cp-feedback').count(),0);
   await dialog.locator('[data-action=close]').click();await page.waitForFunction(()=>document.querySelector('#lamp-overlay').hidden);
   // The approved full-cost upgrade applies once, then acknowledges the saved capacity gain.
   await strip.locator('.lamp-tier-badge').click();await dialog.waitFor();const beforeUpgrade=await state(page);
   {await page.evaluate(()=>{const s=window.__codexGame.globals.ContinuousCombatStage;s.bossSummonRequired=true;s.bossAvailable=true;s.bossActive=false;s.bossArmed=false;});await page.waitForFunction(()=>document.querySelector('#lamp-overlay').dataset.bossFallback==='false'&&document.querySelector('#combat-boss-fallback')?.hidden!==false);}
   await upgradeWithoutScroll(page);
   const upgradeLayout={...await containment(page),noScroll:await upgradeWithoutScroll(page)};
   const pills=await dialog.locator('.lamp-odds tbody tr').evaluateAll(rows=>rows.map(row=>({name:row.querySelector('th').textContent,color:getComputedStyle(row).backgroundColor})));
   assert.deepEqual(pills.map(p=>p.name),['Common','Uncommon','Rare','Epic','Legendary']);assert.deepEqual(pills.map(p=>p.color),['rgb(102, 102, 102)','rgb(1, 138, 84)','rgb(28, 143, 169)','rgb(215, 103, 61)','rgb(184, 50, 65)']);
   assert.equal(await dialog.locator('.lamp-stage-slots,.lamp-countdown,[data-action=speed-up]').count(),0);
   await page.screenshot({path:`${directory}/${width}-bag-upgrade.png`});
   await dialog.locator('[data-action=upgrade]').click();await page.waitForFunction(()=>document.querySelector('#lamp-dialog').dataset.view==='upgrade-complete');
   saved=await assertSave(page);assert.equal(saved.lamp.essence,beforeUpgrade.lamp.essence-400);assert.equal(saved.partyEXP,beforeUpgrade.partyEXP);assert.deepEqual(saved.items,beforeUpgrade.items);assert.equal(saved.lamp.capacityTier,1);assert.equal(saved.lamp.upgradeEndsAt,undefined);
   assert.equal(await dialog.locator('button').count(),1);assert.equal(await dialog.locator('.bag-reward-capacity').innerText(),'Bag Capacity 20 > 30');assert.equal(await dialog.getByText(/Rare or better|Continue/).count(),0);
   const rewardLayout=await dialog.evaluate(d=>{const panel=d.querySelector('.bag-upgrade-complete').getBoundingClientRect(),text=d.querySelector('.bag-reward-capacity').getBoundingClientRect(),close=d.querySelector('.bag-modal-close').getBoundingClientRect();return{gap:close.top-panel.bottom,bottomSpace:panel.bottom-text.bottom,contained:close.bottom<=innerHeight&&close.top>=0,centerOffset:Math.abs(close.x+close.width/2-panel.x-panel.width/2)};});
   assert.ok(rewardLayout.gap>=8);assert.ok(rewardLayout.bottomSpace<=30);assert.ok(rewardLayout.contained);assert.ok(rewardLayout.centerOffset<1);upgradeLayout.reward=rewardLayout;
   await page.screenshot({path:`${directory}/${width}-bag-complete.png`});await dialog.locator('[data-action=close]').click();await page.waitForFunction(()=>document.querySelector('#lamp-overlay').hidden);
   const durable=await state(page);await page.reload();await enter(page,url);assert.equal(await page.evaluate(()=>window.lampPassageBounces.length),0,'reload does not replay saved receipts');saved=await assertSave(page);assert.deepEqual(saved.items,durable.items);assert.deepEqual(saved.loadouts,durable.loadouts);assert.equal(saved.partyEXP,0);assert.equal(saved.lamp.autoEnabled,false);assert.ok(Object.values(await page.evaluate(()=>window.__codexGame.globals.HeroProgress.heroes)).every(h=>h.lampEXPClaimed===0));
   assert.deepEqual(errors,[]);report.push({width,height,dpr,movingFull,movingReview,passageBounce,reviewLayout,failureLayout,upgradeLayout,mainIds,selectedCount:selectedIds.length,expectedEssence,finalEXP:saved.partyEXP,finalStored:lampStoredCount(saved),helperContained,errors,entryPhase:raw.quest.phase});
  }catch(error){await writeFile(`${directory}/${width}-error.txt`,error.stack||String(error));await page.screenshot({path:`${directory}/${width}-failure.png`}).catch(()=>{});throw error;}finally{await context.close();}

 }
 // Two real tabs share localStorage and navigator.locks; duplicate pointer collection saves one item and grants no EXP.
 const shared=await browser.newContext({viewport:{width:360,height:640}}),first=await shared.newPage(),second=await shared.newPage();
 await shared.addInitScript(({save,heroes})=>{if(localStorage.getItem('test.conveyor.shared'))return;localStorage.setItem('test.conveyor.shared','1');save.lamp.emissions=[];const removed=save.lamp.pending.pop();save.items=save.items.filter(i=>i.instanceId!==removed);localStorage.setItem('wishfire.equipment-economy.v5',JSON.stringify(save));localStorage.setItem('orka.hero_progress.v2',JSON.stringify(heroes));},fixture());
 try{
  await enter(first,url);await enter(second,url);const before=await state(first);await first.waitForFunction(n=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.sequence>n,before.lamp.sequence,{timeout:8000});const id=(await state(first)).lamp.emissions.at(-1).item.instanceId;
  await Promise.all([movingTap(first,id),movingTap(second,id)]);await first.waitForFunction(id=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).items.some(item=>item.instanceId===id),id);
  const accepted=await assertSave(first);assert.equal(accepted.partyEXP,0);assert.equal(accepted.items.filter(i=>i.instanceId===id).length,1);assert.equal(accepted.lamp.reviewHold??null,null);assert.equal(lampStoredCount(accepted),20);
  await Promise.all([first.waitForFunction(()=>Object.values(window.__codexGame.globals.HeroProgress.heroes).every(h=>h.lampEXPClaimed===0)),second.waitForFunction(()=>Object.values(window.__codexGame.globals.HeroProgress.heroes).every(h=>h.lampEXPClaimed===0))]);
  report.push({realSharedTabs:2,uniqueCollectedId:id,permanentStored:20,partyEXP:accepted.partyEXP});
 }finally{await shared.close();}
 }finally{await browser.close();server?.kill();await writeFile(`${directory}/report.json`,JSON.stringify(report,null,2));}
});

test('lamp emitter: full cache and every modal freeze movement, capture and cadence',async()=>{
 let server,url=process.env.LAMP_QA_URL;const report=[];await mkdir(directory,{recursive:true});
 if(!url){const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));url=`http://localhost:${port}/web-runner/index.html`;server=spawn(process.execPath,['tools/serve_web.js','--port',String(port),'--host','127.0.0.1'],{stdio:'ignore'});for(let n=0;n<50;n++){try{if((await fetch(url)).ok)break;}catch{}if(n===49)throw Error('Lamp server did not start');await delay(100);}}
 const browser=await chromium.launch({headless:true,executablePath:detectChromeExecutable()});
 try{for(const [width,height,dpr] of profiles){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr}),page=await context.newPage();context.setDefaultTimeout(15000);
  try{
   const seed=fixture(),removed=seed.save.lamp.pending.pop();seed.save.items=seed.save.items.filter(i=>i.instanceId!==removed);seed.save.lamp.emissions=[];
   for(let n=0;n<2;n++){const item=generateLampItem(seed.save.lamp.seed,seed.save.lamp.sequence++,0);seed.save.lamp.emissions.push({item,issuedAt:0,collected:false,age:n===0?14000:1000});}
   await page.addInitScript(({save,heroes})=>{window.bounces=0;const animate=Element.prototype.animate;Element.prototype.animate=function(...args){if(this.matches('.lamp-bag-art'))window.bounces++;return animate.apply(this,args);};if(localStorage.getItem('test.conveyor.gates'))return;localStorage.setItem('test.conveyor.gates','1');save.lamp.lastActivationAt=Date.now();save.lamp.emissions.forEach(e=>{e.issuedAt=Date.now()-e.age;delete e.age;});localStorage.setItem('wishfire.equipment-economy.v5',JSON.stringify(save));localStorage.setItem('orka.hero_progress.v2',JSON.stringify(heroes));},seed);
   await enter(page,url);
   const strip=page.locator('#wishfire-lamp'),dialog=page.locator('#lamp-dialog'),arrival=seed.save.lamp.emissions[0].item.instanceId;
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.pending.length+JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.discarded.length===20);
   await page.waitForFunction(()=>window.bounces===1);await page.waitForFunction(()=>!document.querySelector('.lamp-bag-art').getAnimations().some(a=>a.playState==='running'));
   const snapshot=()=>page.evaluate(()=>({sequence:JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.sequence,activeMs:JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.conveyorActiveMs,count:document.querySelector('.lamp-count').textContent,bounces:window.bounces,items:[...document.querySelectorAll('.lamp-conveyor-item')].filter(n=>!n.hidden).map(n=>({id:n.dataset.id,x:n.getBoundingClientRect().x,time:n.getAnimations()[0]?.currentTime}))}));
   const freeze=async label=>{await page.waitForFunction(()=>document.querySelector('#wishfire-lamp').dataset.conveyorPaused==='true');await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});const before=await snapshot();await delay(5500);assert.deepEqual(await snapshot(),before,label);return before;};
   const full=await freeze('full cache freezes all motion, saves and feedback');assert.equal(full.count,'20');await page.screenshot({path:`${directory}/${width}-full-paused.png`});
   const positions=full.items;await page.reload();await enter(page,url);const restored=await freeze('reload retains full pause');assert.deepEqual(restored.items.map(n=>n.id),positions.map(n=>n.id));assert.ok(restored.items.every(n=>Math.abs(n.x-positions.find(old=>old.id===n.id).x)<.75),`full-cache reload preserves positions within one frame: ${JSON.stringify({full,restored})}`);assert.equal(restored.bounces,0,'reload never replays last-slot bounce');
   await strip.locator('.lamp-collect').click();await dialog.waitFor();await dialog.getByRole('button',{name:'Auto-Equip',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.lamp-cp-feedback'));
   await page.waitForFunction(()=>document.querySelector('#lamp-dialog').dataset.view==='dismantle');
   const disposal=await freeze('dismantle modal freezes even with free capacity');assert.ok(lampStoredCount(await assertSave(page))<20);await page.screenshot({path:`${directory}/${width}-disposal-paused.png`});
   await dialog.getByRole('button',{name:'Dismantle all',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#lamp-overlay').hidden);await page.waitForFunction(()=>document.querySelector('#wishfire-lamp').dataset.conveyorPaused==='false');
   const resumed=await snapshot();await delay(600);const progressed=await snapshot();assert.ok(progressed.sequence-resumed.sequence<=1,'no catch-up burst');assert.ok(progressed.items.some(n=>resumed.items.some(old=>old.id===n.id&&n.x>old.x)),'in-flight items resume');
   await page.evaluate(()=>{const modal=document.createElement('dialog');modal.id='other-qa-modal';modal.textContent='Other modal';document.body.append(modal);modal.showModal();});await freeze('native unrelated modal freezes conveyor');await page.evaluate(()=>document.querySelector('#other-qa-modal').close());
   await page.waitForFunction(()=>document.querySelector('#wishfire-lamp').dataset.conveyorPaused==='false');
   await page.evaluate(()=>{const modal=document.querySelector('#other-qa-modal');modal.remove();const alert=document.createElement('section');alert.id='other-qa-alert';alert.setAttribute('role','alertdialog');alert.textContent='Other alert';document.body.append(alert);});await freeze('unrelated alertdialog freezes conveyor');await page.evaluate(()=>document.querySelector('#other-qa-alert').remove());
   await page.getByRole('button',{name:'HERO',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#wishfire-lamp').hidden);const away=await state(page);await delay(5500);assert.equal((await state(page)).lamp.sequence,away.lamp.sequence,'noncombat also pauses emissions');
   report.push({width,height,dpr,full,disposal,result:'PASS'});await page.screenshot({path:`${directory}/${width}-gates.png`});
  }catch(error){await writeFile(`${directory}/${width}-emitter-error.txt`,error.stack||String(error));await writeFile(`${directory}/${width}-emitter-state.json`,JSON.stringify(await page.evaluate(()=>({save:JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')),paused:document.querySelector('#wishfire-lamp')?.dataset.conveyorPaused,nodes:[...document.querySelectorAll('.lamp-conveyor-item')].map(n=>({data:{...n.dataset},delay:n.style.animationDelay,motion:n.getAnimations().map(a=>({time:a.currentTime,state:a.playState,timing:a.effect.getComputedTiming()}))}))})),null,2));throw error;}finally{await context.close();}
 }}finally{await browser.close();server?.kill();await writeFile(`${directory}/emitter-gates.json`,JSON.stringify(report,null,2));}
});

async function disposalDensity(page,count){
 const metrics=await page.evaluate(()=>{const d=document.querySelector('#lamp-dialog'),body=d.querySelector('.lamp-disposal-body'),r=d.getBoundingClientRect(),b=body.getBoundingClientRect(),tiles=[...body.querySelectorAll('.lamp-tile')].map(n=>n.getBoundingClientRect());return{dialog:r.toJSON(),body:b.toJSON(),tile:tiles[0].toJSON(),visible:tiles.filter(t=>t.top>=b.top-.5&&t.bottom<=b.bottom+.5).length,columns:getComputedStyle(body.querySelector('.lamp-queue')).gridTemplateColumns.split(' ').length,viewport:[innerWidth,innerHeight,devicePixelRatio]};});
 assert.equal(metrics.visible,Math.min(count,20),'up to20 visible items: '+JSON.stringify(metrics));assert.equal(metrics.columns,5);assert.ok(Math.abs(metrics.tile.width-metrics.tile.height)<1);assert.ok(metrics.tile.width<metrics.dialog.width*.17);assert.ok(metrics.dialog.height>=metrics.dialog.width*.85);return metrics;
}

test('trash-only full cache and held item open directly to one dismantle-all action',async()=>{
 let server,url=process.env.LAMP_QA_URL;const report=[];await mkdir(directory,{recursive:true});
 if(!url){const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));url=`http://localhost:${port}/web-runner/index.html`;server=spawn(process.execPath,['tools/serve_web.js','--port',String(port),'--host','127.0.0.1'],{stdio:'ignore'});for(let n=0;n<50;n++){try{if((await fetch(url)).ok)break;}catch{}if(n===49)throw Error('Lamp server did not start');await delay(100);}}
 const browser=await chromium.launch({headless:true,executablePath:detectChromeExecutable()});
 try{for(const [width,height,dpr] of [profiles[0],profiles[1]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const seed=fixture();for(const i of seed.save.items)if(i.instanceId.startsWith('lamp:'))i.stats={ATK:2,DEF:2,MAG:2,RES:2,HP:2};
  await page.addInitScript(({save,heroes})=>{const realNow=Date.now;let offset=0;Date.now=()=>realNow()+offset;window.setLampQAClock=t=>offset=t-realNow();if(localStorage.getItem('test.conveyor.seeded'))return;localStorage.setItem('test.conveyor.seeded','1');save.lamp.emissions.forEach(({age,...e},i)=>save.lamp.emissions[i]={...e,issuedAt:Date.now()-age});localStorage.setItem('wishfire.equipment-economy.v5',JSON.stringify(save));localStorage.setItem('orka.hero_progress.v2',JSON.stringify(heroes));},seed);
  try{
   await enter(page,url);const strip=page.locator('#wishfire-lamp'),dialog=page.locator('#lamp-dialog');
   await page.evaluate(()=>{window.visibleLampViews=[];new MutationObserver(()=>{const d=document.querySelector('#lamp-dialog');if(!document.querySelector('#lamp-overlay').hidden)window.visibleLampViews.push(d.dataset.view);}).observe(document.querySelector('#lamp-dialog'),{attributes:true,attributeFilter:['data-view']});});
   const saved=await assertSave(page);await strip.locator('.lamp-collect').click();await dialog.waitFor();assert.equal(await dialog.getAttribute('data-view'),'dismantle');assert.equal(await dialog.getByText(/No CP upgrades/).count(),0);assert.equal(await dialog.getByRole('button',{name:'Back to cache',exact:true}).count(),0);assert.equal(await dialog.locator('.lamp-actions button').count(),1);assert.equal(await dialog.locator('[data-disposal-selected=true]').count(),20);await containment(page);assert.equal((await dialog.innerText()).trim().replace(/\s+/g,' '),'× Dismantle all');assert.equal(await dialog.locator('.lamp-level,.lamp-tile small,h2,h3').count(),0);assert.equal(await dialog.getByRole('button',{name:/^Inspect /}).count(),20);const density=await disposalDensity(page,20);
   await page.evaluate(()=>{const original=performance.now.bind(performance);performance.now=()=>original()+15100;});await page.locator('.lamp-idle-helper').waitFor();assert.equal(await page.locator('.lamp-idle-helper').getAttribute('data-target'),'dismantle');await page.screenshot({path:`${directory}/${width}-trash-only-direct.png`});
   await dialog.locator('[data-action=close]').click();const heldSeed=await state(page),heldItem=generateLampItem(heldSeed.lamp.seed,heldSeed.lamp.sequence++,0);heldItem.stats={ATK:2,DEF:2,MAG:2,RES:2,HP:2};heldSeed.lamp.reviewHold={item:heldItem,disposal:false};const id=heldItem.instanceId;await page.evaluate(save=>localStorage.setItem('wishfire.equipment-economy.v5',JSON.stringify(save)),heldSeed);await enter(page,url);await page.evaluate(()=>{window.visibleLampViews=[];new MutationObserver(()=>{const d=document.querySelector('#lamp-dialog');if(!document.querySelector('#lamp-overlay').hidden)window.visibleLampViews.push(d.dataset.view);}).observe(document.querySelector('#lamp-dialog'),{attributes:true,attributeFilter:['data-view']});});await strip.locator('.lamp-collect').click();await dialog.waitFor();assert.equal(await dialog.getAttribute('data-view'),'dismantle','saved held non-upgrade enters confirmation');assert.equal(await dialog.locator('[data-disposal-selected=true]').count(),21);await containment(page);const heldDensity=await disposalDensity(page,21);assert.ok(!(await page.evaluate(()=>window.visibleLampViews)).includes('cache'),'no empty cache interstitial');
   const preview=await assertSave(page),expected=preview.items.filter(i=>preview.lamp.discarded.includes(i.instanceId)).reduce((n,i)=>n+salvageValue(i),salvageValue(preview.lamp.reviewHold.item));
   await page.screenshot({path:`${directory}/${width}-trash-only-held.png`});await dialog.locator('.lamp-disposal-body').evaluate(n=>n.scrollTop=n.scrollHeight);assert.equal(await dialog.locator('.lamp-tile').last().evaluate(n=>{const r=n.getBoundingClientRect(),b=n.closest('.lamp-disposal-body').getBoundingClientRect();return r.top>=b.top-.5&&r.bottom<=b.bottom+.5;}),true,'held21st remains fully accessible by scrolling');await containment(page);await dialog.getByRole('button',{name:'Dismantle all',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#lamp-overlay').hidden);await page.locator('.lamp-reward-banner').waitFor();const after=await assertSave(page);assert.equal(after.lamp.essence,saved.lamp.essence+expected);assert.equal(lampStoredCount(after),0);assert.equal(after.lamp.reviewHold,null);assert.deepEqual(after.loadouts,saved.loadouts);assert.equal(after.partyEXP,saved.partyEXP);assert.equal(await page.locator('.lamp-reward-banner button').count(),0);await page.screenshot({path:`${directory}/${width}-trash-only-reward.png`});
   await strip.locator('.lamp-collect').click();await page.waitForFunction(()=>document.querySelector('#lamp-overlay').hidden);const expanded=fixture();expanded.save.lamp.capacityTier=3;for(const i of expanded.save.items)if(i.instanceId.startsWith('lamp:'))i.stats={ATK:2,DEF:2,MAG:2,RES:2,HP:2};for(let n=20;n<60;n++){const i=generateLampItem(42,n,3);i.stats={ATK:2,DEF:2,MAG:2,RES:2,HP:2};expanded.save.items.push(i);expanded.save.lamp.pending.push(i.instanceId);expanded.save.lamp.sequence++;}
   await page.evaluate(({save,heroes})=>{localStorage.setItem('wishfire.equipment-economy.v5',JSON.stringify(save));localStorage.setItem('orka.hero_progress.v2',JSON.stringify(heroes));},expanded);await enter(page,url);await strip.locator('.lamp-collect').click();await dialog.waitFor();assert.equal(await dialog.getAttribute('data-view'),'dismantle');assert.equal(await dialog.locator('.lamp-tile').count(),60);await containment(page);const large=await assertSave(page);
   const scrolling=await dialog.locator('.lamp-disposal-body').evaluate(n=>{n.scrollTop=n.scrollHeight;return{client:n.clientHeight,total:n.scrollHeight};});assert.ok(scrolling.total>scrolling.client);await containment(page);await page.screenshot({path:`${directory}/${width}-large-disposal.png`});await dialog.locator('.lamp-tile').last().click();assert.equal(await dialog.getAttribute('data-view'),'equip');assert.ok(await dialog.locator('.lamp-level').count()>0);assert.ok(await dialog.locator('.lamp-item-cp').count()>0);await containment(page);const inspected=await assertSave(page);assert.deepEqual(inspected.items,large.items);assert.deepEqual(inspected.loadouts,large.loadouts);
   assert.deepEqual(errors,[]);report.push({width,height,dpr,selected:21,essence:expected,density,heldDensity,scrolling,errors});
  }finally{await page.close();}
 }}finally{await browser.close();server?.kill();}
 await writeFile(`${directory}/direct-dismantle.json`,JSON.stringify(report,null,2));
});

test('Auto-Equip closes empty disposal after feedback and preserves legacy salvage review',async()=>{
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const server=spawn(process.execPath,['tools/serve_web.js','--port',String(port),'--host','127.0.0.1'],{stdio:'ignore'}),url=`http://localhost:${port}/web-runner/index.html`;
 let browser;
 try{
  for(let n=0;n<50;n++){try{if((await fetch(url)).ok)break;}catch{}if(n===49)throw Error('Lamp server did not start');await delay(100);}
  await mkdir(directory,{recursive:true});browser=await chromium.launch({headless:true,executablePath:detectChromeExecutable()});
  for(const [width,height,dpr] of profiles)for(const legacy of [false,true]){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr}),page=await context.newPage();
   try{
    const seed=fixture(),upgrade=seed.save.items.find(i=>i.instanceId===seed.save.lamp.pending[0]);
    seed.save.items=seed.save.items.filter(i=>i.instanceId.startsWith('owned:')||i.instanceId===upgrade.instanceId);
    seed.save.lamp.pending=[upgrade.instanceId];seed.save.lamp.discarded=[];seed.save.lamp.emissions=[];
    seed.save.lamp.salvage={count:legacy?1:0,gold:legacy?5:0};
    await page.addInitScript(({save,heroes})=>{save.lamp.lastActivationAt=Date.now()+3600000;localStorage.setItem('wishfire.equipment-economy.v5',JSON.stringify(save));localStorage.setItem('orka.hero_progress.v2',JSON.stringify(heroes));},seed);
    await enter(page,url);await page.locator('#wishfire-lamp .lamp-collect').click();
    await page.evaluate(()=>{window.emptyDisposalVisible=false;const check=()=>{const dialog=document.querySelector('#lamp-dialog'),overlay=document.querySelector('#lamp-overlay'),save=JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5'));if(!overlay.hidden&&dialog.dataset.view==='dismantle'&&!dialog.querySelector('[data-disposal-selected=true]')&&!save.lamp.salvage.count)window.emptyDisposalVisible=true;};new MutationObserver(check).observe(document.querySelector('#lamp-overlay'),{subtree:true,attributes:true,childList:true});});
    await page.getByRole('button',{name:'Auto-Equip',exact:true}).click();
    await page.waitForFunction(()=>!!document.querySelector('.lamp-cp-feedback'),null,{timeout:3000});
    await page.waitForFunction(()=>!document.querySelector('.lamp-cp-feedback'),null,{timeout:5000});
    if(legacy){await page.waitForFunction(()=>document.querySelector('#lamp-dialog').dataset.view==='dismantle');assert.equal(await page.getByRole('button',{name:'Dismantle all',exact:true}).isEnabled(),true);}
    else await page.waitForFunction(()=>document.querySelector('#lamp-overlay').hidden,null,{timeout:3000});
    const saved=await assertSave(page);assert.equal(lampStoredCount(saved),legacy?1:0);assert.ok(Object.values(saved.loadouts).some(slots=>Object.values(slots).includes(upgrade.instanceId)));assert.deepEqual(saved.lamp.salvage,seed.save.lamp.salvage);assert.equal(await page.evaluate(()=>window.emptyDisposalVisible),false);
    await page.screenshot({path:`${directory}/${width}-auto-equip-${legacy?'legacy':'empty'}.png`});
   }finally{await context.close();}
  }
 }finally{await browser?.close();server.kill();}
});
