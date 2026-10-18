import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHeroProgressStore,refreshHeroStats} from '../web-runner/src/core/heroProgression.mjs';
import {createLampEconomy,generateLampItem,lampStoredCount,lampCapacity,salvageValue} from '../web-runner/src/core/lampGear.mjs';
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
 const combatAfter=await page.evaluate(()=>window.__codexGame.globals.time);assert.ok(combatAfter>combatBefore,'combat continues during cache review');assert.equal(after.same,true);assert.equal(after.running,paused?'paused':'running');assert.equal(after.beltObject,false,'item motion has no literal belt object');if(paused)assert.ok(Math.abs(after.x-before)<.1,'cache freezes equipment in place');else assert.ok(after.x>before+2,'equipment moves left to right without restarting its node');return{before,...after,combatBefore,combatAfter};
}
async function containment(page){
 const result=await page.evaluate(()=>{const d=document.querySelector('#lamp-dialog'),m=document.querySelector('#lamp-overlay'),s=document.querySelector('#wishfire-lamp'),c=document.querySelector('canvas'),r=d.getBoundingClientRect(),sr=s.getBoundingClientRect(),cr=c.getBoundingClientRect();return{viewport:[innerWidth,innerHeight,devicePixelRatio],horizontal:document.documentElement.scrollWidth>innerWidth,dialogHorizontal:d.scrollWidth>d.clientWidth+1,contained:r.left>=-.5&&r.right<=innerWidth+.5&&r.top>=-.5&&r.bottom<=innerHeight+.5,conveyorAccessible:m.getBoundingClientRect().bottom<sr.top,stripY:(sr.top-cr.top)/(cr.width/360),stripHeight:sr.height/(cr.width/360),portraits:[...d.querySelectorAll('.lamp-hero img')].every(i=>i.complete&&i.naturalWidth>0),stats:d.querySelectorAll('.lamp-item-stats dd').length,primaryVisible:[...d.querySelectorAll('.lamp-review-actions button,#lamp-dialog[data-view=dismantle]>.lamp-actions button')].every(b=>{const t=b.getBoundingClientRect();return t.top>=r.top&&t.bottom<=r.bottom&&t.height>=43;}),identityFits:[...d.querySelectorAll('.lamp-quality-band>*')].every(n=>{const t=n.getBoundingClientRect(),p=n.closest('.lamp-candidate').getBoundingClientRect();return t.top>=p.top&&t.bottom<=p.bottom;}),buttons:[...d.querySelectorAll('button')].every(b=>{const t=b.getBoundingClientRect();return t.left>=r.left-.5&&t.right<=r.right+.5;})};});
 assert.equal(result.horizontal,false);assert.equal(result.dialogHorizontal,false);assert.equal(result.contained,true);assert.equal(result.conveyorAccessible,await page.locator('#lamp-dialog').getAttribute('data-view')!=='upgrade');assert.equal(result.portraits,true);assert.equal(result.buttons,true);assert.equal(result.primaryVisible,true);assert.equal(result.identityFits,true);assert.ok(Math.abs(result.stripY-488)<.5);assert.ok(Math.abs(result.stripHeight-92)<.5);return result;
}
async function upgradeWithoutScroll(page){
 const metrics=await page.evaluate(()=>{
  const dialog=document.querySelector('#lamp-dialog'),odds=dialog.querySelector('.lamp-odds-scroll'),overlay=document.querySelector('#lamp-overlay'),r=dialog.getBoundingClientRect();
  const cells=[...odds.querySelectorAll('th,td')].map(n=>{const range=document.createRange();range.selectNodeContents(n);const text=range.getBoundingClientRect(),cell=n.getBoundingClientRect();return text.left>=cell.left-.5&&text.right<=cell.right+.5&&text.top>=r.top&&text.bottom<=r.bottom;});
  return{height:r.height,overlayHeight:overlay.getBoundingClientRect().height,dialogClient:dialog.clientHeight,dialogTotal:dialog.scrollHeight,oddsClient:odds.clientHeight,oddsTotal:odds.scrollHeight,rows:odds.querySelectorAll('tbody tr').length,cellsFit:cells.every(Boolean),controlsFit:[...dialog.querySelectorAll('.lamp-upgrade')].every(n=>{const b=n.getBoundingClientRect();return b.top>=r.top&&b.bottom<=r.bottom;})};
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

test('continuous equipment lifecycle: four phones, full-cache hold, concurrent active-tab collection, manual downgrade and selected disposal',async()=>{
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
   assert.equal(await strip.locator('[data-action=generate],.lamp-auto').count(),0);await tick(page);
   saved=await assertSave(page);const tapped=saved.lamp.emissions.at(-1).item.instanceId;assert.equal(saved.partyEXP,0);const movingFull=await movement(page,tapped);await page.waitForFunction(n=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.sequence>n,saved.lamp.sequence,{timeout:8000});const fullAuto=await assertSave(page);
   assert.equal(await strip.locator('img[src="assets/images/lamp/lamp.png"]').count(),0,'deprecated lamp art never appears in the strip');
   await page.waitForFunction(id=>{const n=[...document.querySelectorAll('.lamp-conveyor-item')].find(n=>n.dataset.id===id);return n&&n.getBoundingClientRect().right-n.parentElement.getBoundingClientRect().left>16;},fullAuto.lamp.emissions.at(-1).item.instanceId);
   await movingTap(page,tapped);await dialog.waitFor();await page.waitForFunction(id=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.reviewHold?.item.instanceId===id,tapped);
   saved=await assertSave(page);assert.equal(saved.partyEXP,0);assert.equal(lampStoredCount(saved),20);const countFits=await strip.locator('.lamp-count').evaluate(n=>{const range=document.createRange();range.selectNodeContents(n);const r=range.getBoundingClientRect(),b=n.closest('button').getBoundingClientRect();return r.left>=b.left&&r.right<=b.right&&r.right<=innerWidth;});assert.equal(countFits,true,'20+1 hold count is fully painted');assert.equal(await dialog.locator('.lamp-item-stats dd').count(),5);assert.equal(await dialog.locator('.lamp-hero').count(),4);
   // Controlled CSS end time proves visual passage independently of the held-item save.
   await page.evaluate(()=>document.querySelector('.lamp-conveyor-item').getAnimations()[0].finish());
   await page.waitForFunction(()=>window.lampPassageBounces.length>0);await delay(500);
   const passageBounce=await page.evaluate(()=>{const r=window.lampPassageBounces.at(-1),sampled=[];r.animation.pause();for(const time of Array.from({length:81},(_,i)=>i*10)){r.animation.currentTime=time;const style=getComputedStyle(r.art);sampled.push({scale:new DOMMatrixReadOnly(style.transform).a,opacity:Number(style.opacity)});}r.animation.finish();return{timeline:sampled,stable:r.art===window.initialBagArt,opacity:r.samples.map(s=>s.opacity),scale:r.samples.map(s=>s.scale),end:getComputedStyle(r.art).transform,initialSize:window.initialBagSize,receivedSize:{width:r.art.getBoundingClientRect().width,height:r.art.getBoundingClientRect().height}};});assert.equal(passageBounce.stable,true);assert.ok(passageBounce.opacity.every(o=>o===1),'receiving never blinks');assert.ok(Math.max(...passageBounce.timeline.map(s=>s.scale))>1.42&&Math.min(...passageBounce.timeline.map(s=>s.scale))>.8&&passageBounce.timeline.every(s=>s.opacity===1),'strong visual passage bounce settles without blinking: '+JSON.stringify(passageBounce.timeline));assert.equal(passageBounce.end,'none');assert.deepEqual(passageBounce.receivedSize,passageBounce.initialSize,'a full-cache hold never shrinks or stretches the bag art');
   await dialog.getByRole('button',{name:'Choose Fara',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#lamp-dialog [data-action="equip"]')?.disabled===false);assert.ok(Number(await dialog.locator('[data-action=hero][data-id=Falie]').getAttribute('data-cp-change'))<0,'held inferior item permits deliberate downgrade');
   const heldLayout=await containment(page);await page.screenshot({path:`${directory}/${width}-held-review.png`});
   await page.evaluate(()=>window.setLampQAClock(Date.now()+6000));await delay(300);assert.equal((await state(page)).lamp.sequence,fullAuto.lamp.sequence,'cache menu pauses new creation');assert.equal(fullAuto.partyEXP,0);assert.equal((await state(page)).lamp.reviewHold.item.instanceId,tapped);assert.equal(lampStoredCount(fullAuto),20);
   const latest=fullAuto.lamp.emissions.at(-1).item.instanceId,movingReview=await movement(page,latest,{paused:true});assert.equal(await dialog.isVisible(),true);
   // A second full-cache tap never replaces the reservation, and provides a visible explanation.
   await movingTap(page,latest);await page.getByText('Resolve the held item first: equip it or confirm its disposal.',{exact:true}).first().waitFor();assert.equal((await state(page)).lamp.reviewHold.item.instanceId,tapped);
   await movingTap(page,tapped);assert.equal(await page.evaluate(()=>document.querySelector('.lamp-bag-art')===window.initialBagArt),true,'collection retains the persistent bag artwork');
   await strip.locator('.lamp-collect').click();await page.waitForFunction(()=>document.querySelector('#lamp-dialog').dataset.view==='equip');
   assert.equal(await dialog.locator('.lamp-hero-current-cp').count(),4);assert.equal(await dialog.locator('.lamp-review-actions button').count(),2);assert.equal(await dialog.getByText(/^Revealed /).count(),0);
   const mainIds=await dialog.locator('[aria-label="Actionable upgrades"] .lamp-tile').evaluateAll(ns=>ns.map(n=>({id:n.dataset.id,gain:Number(n.dataset.bestGain),arrow:!!n.querySelector('.lamp-review-arrow')})));assert.equal(mainIds.length,3);assert.ok(mainIds.every(n=>n.gain>0&&n.arrow));
   await page.evaluate(()=>{const original=performance.now.bind(performance);performance.now=()=>original()+15100;});await page.locator('.lamp-idle-helper').waitFor();assert.equal(await page.locator('.lamp-idle-helper').getAttribute('data-target'),'Huun');
   const helperContained=await page.evaluate(async()=>{const h=document.querySelector('.lamp-idle-helper');for(let frame=0;frame<12;frame++){await new Promise(requestAnimationFrame);for(const n of h.querySelectorAll('img,span')){const r=n.getBoundingClientRect();if(r.left<-.5||r.right>innerWidth+.5||r.top<-.5||r.bottom>innerHeight+.5)return false;}}return true;});assert.equal(helperContained,true);

   const beforeAuto=await assertSave(page);
   await dialog.getByRole('button',{name:'Auto-Equip',exact:true}).click();await page.locator('.lamp-cp-feedback').first().waitFor();
   assert.equal(await dialog.getAttribute('data-view'),'equip','Auto waits for saved CP feedback before disposal');
   const feedback=await page.locator('.lamp-cp-feedback').evaluateAll(ns=>ns.map(n=>({hero:n.dataset.hero,before:+n.dataset.before,after:+n.dataset.after,change:+n.dataset.change})));
   assert.ok(feedback.length>0);assert.ok(feedback.every(n=>n.after>n.before&&Math.abs(n.after-n.before-n.change)<.11));
   await page.waitForFunction(()=>!document.querySelector('.lamp-cp-feedback'));assert.equal(await dialog.getAttribute('data-view'),'dismantle');
   const disposal=await assertSave(page),selectedIds=await dialog.locator('[data-disposal-selected=true]').evaluateAll(ns=>ns.map(n=>n.dataset.id)),bank=disposal.lamp.essence;assert.equal(selectedIds.length,lampStoredCount(disposal)+(disposal.lamp.reviewHold?1:0));assert.ok(selectedIds.length>0);
   const expectedEssence=selectedIds.reduce((n,id)=>n+salvageValue(disposal.items.find(i=>i.instanceId===id)||disposal.lamp.reviewHold.item),0);
   await page.screenshot({path:`${directory}/${width}-disposal-review.png`});await dialog.getByRole('button',{name:'Dismantle all',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#lamp-overlay').hidden);await page.locator('.lamp-reward-banner').waitFor();
   saved=await assertSave(page);assert.equal(lampStoredCount(saved),0);assert.equal(saved.lamp.reviewHold,null);assert.equal(saved.lamp.essence,bank+expectedEssence);assert.equal(saved.partyEXP,0);assert.equal(saved.lamp.autoEnabled,false);
   // Automatic creation resumes without a toggle. A second arrival during confirmation is deliberately retained.
   const resumed=await tick(page),first=resumed.lamp.emissions.at(-1).item;assert.equal(resumed.partyEXP,0);const arrivedFirst=await waitForArrival(page,first.instanceId);assert.ok(lampStoredCount(arrivedFirst)>=1);assert.equal(arrivedFirst.lamp.emissions.find(emission=>emission.item.instanceId===first.instanceId).collected,true);
   await strip.locator('.lamp-collect').click();await dialog.waitFor();assert.equal(await dialog.getAttribute('data-view'),'dismantle','all-trash bag skips the empty cache');assert.equal(await dialog.locator('[data-action=cache]').count(),0);assert.equal(await dialog.locator('.lamp-actions button').count(),1);assert.equal(await dialog.getByRole('button',{name:'Dismantle all',exact:true}).isEnabled(),true);await containment(page);const firstDisposalIds=await dialog.locator('[data-disposal-selected=true]').evaluateAll(ns=>ns.map(n=>n.dataset.id));assert.ok(firstDisposalIds.includes(first.instanceId));const firstDisposalValue=firstDisposalIds.reduce((sum,id)=>sum+salvageValue(arrivedFirst.items.find(item=>item.instanceId===id)),0);
    const background=await context.newPage();await background.addInitScript(()=>{const realNow=Date.now;let offset=0;Date.now=()=>realNow()+offset;window.setLampQAClock=t=>offset=t-realNow();});await enter(background,url);const issuedLater=await tick(background),later=issuedLater.lamp.emissions.at(-1).item,arrived=await waitForArrival(background,later.instanceId);await background.close();assert.equal(arrived.partyEXP,0);await page.waitForFunction(id=>[...document.querySelectorAll('#lamp-dialog [data-disposal-selected=false]')].some(tile=>tile.dataset.id===id),later.instanceId);assert.ok((await dialog.locator('[data-disposal-selected=false]').evaluateAll(ns=>ns.map(n=>n.dataset.id))).includes(later.instanceId),'new arrivals stay outside the reviewed snapshot');const bank2=arrived.lamp.essence;
   const beforeDismantleFailure=await page.evaluate(()=>localStorage.getItem('wishfire.equipment-economy.v5'));await page.evaluate(()=>{const original=Storage.prototype.setItem;window.restoreDismantleWrite=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(key,value){if(key==='wishfire.equipment-economy.v5')throw Error('isolated dismantle write failure');return original.call(this,key,value);};});
   await dialog.getByRole('button',{name:'Dismantle all',exact:true}).click();await dialog.getByText('isolated dismantle write failure',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('wishfire.equipment-economy.v5')),beforeDismantleFailure);assert.equal(await page.locator('.lamp-reward-banner').count(),0);assert.equal(await dialog.getAttribute('data-view'),'dismantle');await containment(page);await page.evaluate(()=>window.restoreDismantleWrite());
   await dialog.getByRole('button',{name:'Dismantle all',exact:true}).dblclick();await page.waitForFunction(()=>document.querySelector('#lamp-overlay').hidden);saved=await assertSave(page);assert.equal(saved.lamp.essence,bank2+firstDisposalValue);assert.ok(saved.items.some(i=>i.instanceId===later.instanceId));assert.ok(firstDisposalIds.every(id=>!saved.items.some(i=>i.instanceId===id)));assert.equal(saved.partyEXP,0);

   await strip.locator('.lamp-collect').click();await dialog.waitFor();assert.equal(await dialog.getAttribute('data-view'),'dismantle');await dialog.locator('[data-id="'+later.instanceId+'"]').click();await dialog.getByRole('button',{name:'Choose Fara',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#lamp-dialog [data-action=equip]')?.disabled);
   const baseline=await page.evaluate(()=>localStorage.getItem('wishfire.equipment-economy.v5'));await page.evaluate(()=>{const original=Storage.prototype.setItem;window.restoreConveyorWrite=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(key,value){if(key==='wishfire.equipment-economy.v5')throw Error('isolated lamp write failure');return original.call(this,key,value);};});
   await dialog.getByRole('button',{name:'Equip',exact:true}).click();await dialog.getByText('isolated lamp write failure',{exact:true}).first().waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('wishfire.equipment-economy.v5')),baseline);assert.equal(await page.locator('.lamp-cp-feedback').count(),0);assert.equal(await dialog.getAttribute('data-view'),'equip','failed save stays in comparison');const failureLayout=await containment(page);
   await page.evaluate(()=>window.restoreConveyorWrite());
   const oldGear=(await state(page)).loadouts.Falie[later.type];
   await dialog.getByRole('button',{name:'Equip',exact:true}).click();await page.locator('.lamp-cp-feedback').waitFor();
   assert.equal(await dialog.getAttribute('data-view'),'dismantle','manual equip keeps the player in the explicitly selected disposal screen');
   await page.waitForFunction(()=>!document.querySelector('.lamp-cp-feedback'));assert.equal(await page.locator('#lamp-overlay').isVisible(),true,'manual equip never closes the screen');
   saved=await assertSave(page);assert.equal(saved.loadouts.Falie[later.type],later.instanceId);assert.equal(saved.partyEXP,0);
   assert.ok(!saved.items.some(i=>i.instanceId===oldGear),'replaced gear is destroyed');
   assert.equal(saved.lamp.essence,bank2+firstDisposalValue,'replacement grants no Essence');
   await dialog.locator('[data-action=close]').click();await page.waitForFunction(()=>document.querySelector('#lamp-overlay').hidden);
   // Existing four purchases / seven-hour construction retain their UI and economy behavior.
   await strip.locator('.lamp-tier-badge').click();await dialog.waitFor();const beforeUpgrade=await state(page);{await page.evaluate(()=>{const s=window.__codexGame.globals.ContinuousCombatStage;s.bossSummonRequired=true;s.bossAvailable=true;s.bossActive=false;s.bossArmed=false;});await page.waitForFunction(()=>document.querySelector('#lamp-overlay').dataset.bossFallback==='true');}await upgradeWithoutScroll(page);for(let n=0;n<4;n++){await dialog.locator('[data-action=purchase-stage]').click();await page.waitForFunction(n=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.upgradeStage===n+1,n);}
   saved=await assertSave(page);assert.equal(saved.lamp.essence,beforeUpgrade.lamp.essence-400);assert.equal(saved.partyEXP,beforeUpgrade.partyEXP);assert.deepEqual(saved.items,beforeUpgrade.items);assert.equal(saved.lamp.capacityTier,0);assert.ok(saved.lamp.upgradeEndsAt>Date.now());await dialog.locator('.lamp-countdown').waitFor();const upgradeLayout={...await containment(page),noScroll:await upgradeWithoutScroll(page)};await page.screenshot({path:`${directory}/${width}-construction.png`});await dialog.locator('[data-action=close]').click();await page.waitForFunction(()=>document.querySelector('#lamp-overlay').hidden);
   const durable=await state(page);await page.reload();await enter(page,url);assert.equal(await page.evaluate(()=>window.lampPassageBounces.length),0,'reload does not replay saved receipts');saved=await assertSave(page);assert.deepEqual(saved.items,durable.items);assert.deepEqual(saved.loadouts,durable.loadouts);assert.equal(saved.partyEXP,0);assert.equal(saved.lamp.autoEnabled,false);assert.ok(Object.values(await page.evaluate(()=>window.__codexGame.globals.HeroProgress.heroes)).every(h=>h.lampEXPClaimed===0));
   assert.deepEqual(errors,[]);report.push({width,height,dpr,movingFull,movingReview,passageBounce,heldLayout,failureLayout,upgradeLayout,mainIds,selectedCount:selectedIds.length,expectedEssence,finalEXP:saved.partyEXP,finalStored:lampStoredCount(saved),helperContained,errors,entryPhase:raw.quest.phase});
  }catch(error){await writeFile(`${directory}/${width}-error.txt`,error.stack||String(error));await page.screenshot({path:`${directory}/${width}-failure.png`}).catch(()=>{});throw error;}finally{await context.close();}

 }
 // Two real tabs share localStorage and navigator.locks; duplicate pointer collection saves one item and grants no EXP.
 const shared=await browser.newContext({viewport:{width:360,height:640}}),first=await shared.newPage(),second=await shared.newPage();
 await shared.addInitScript(({save,heroes})=>{if(localStorage.getItem('test.conveyor.shared'))return;localStorage.setItem('test.conveyor.shared','1');save.lamp.emissions=[];localStorage.setItem('wishfire.equipment-economy.v5',JSON.stringify(save));localStorage.setItem('orka.hero_progress.v2',JSON.stringify(heroes));},fixture());
 try{
  await enter(first,url);await enter(second,url);const before=await state(first);await first.waitForFunction(n=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.sequence>n,before.lamp.sequence,{timeout:8000});const id=(await state(first)).lamp.emissions.at(-1).item.instanceId;
  await Promise.all([movingTap(first,id),movingTap(second,id)]);await Promise.all([first.waitForFunction(()=>!document.querySelector('#lamp-overlay').hidden),second.waitForFunction(()=>!document.querySelector('#lamp-overlay').hidden)]);
  const accepted=await assertSave(first);assert.equal(accepted.partyEXP,0);assert.equal(accepted.lamp.reviewHold.item.instanceId,id);assert.equal(lampStoredCount(accepted),20);
  await Promise.all([first.waitForFunction(()=>Object.values(window.__codexGame.globals.HeroProgress.heroes).every(h=>h.lampEXPClaimed===0)),second.waitForFunction(()=>Object.values(window.__codexGame.globals.HeroProgress.heroes).every(h=>h.lampEXPClaimed===0))]);
  report.push({realSharedTabs:2,uniqueHeldId:id,permanentStored:20,partyEXP:accepted.partyEXP});
 }finally{await shared.close();}
 }finally{await browser.close();server?.kill();await writeFile(`${directory}/report.json`,JSON.stringify(report,null,2));}
});

test('lamp emitter: creation and conveyor motion pause together in menus',async()=>{
 let server,url=process.env.LAMP_QA_URL;await mkdir(directory,{recursive:true});
 if(!url){const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));url=`http://localhost:${port}/web-runner/index.html`;server=spawn(process.execPath,['tools/serve_web.js','--port',String(port),'--host','127.0.0.1'],{stdio:'ignore'});for(let n=0;n<50;n++){try{if((await fetch(url)).ok)break;}catch{}if(n===49)throw Error('Emitter server did not start');await delay(100);}}
 const browser=await chromium.launch({headless:true,executablePath:detectChromeExecutable()});
 try{await Promise.all([360,216].map(async width=>{
  const context=await browser.newContext({viewport:{width,height:640}}),page=await context.newPage(),errors=[],samples=[];page.on('pageerror',e=>errors.push(e.message));
  const seed=fixture();const removed=seed.save.lamp.pending.pop();seed.save.items=seed.save.items.filter(i=>i.instanceId!==removed);seed.save.lamp.emissions=[];seed.save.lamp.autoEnabled=width===216;for(const hero of Object.values(seed.heroes.heroes))hero.currentLevel=1;
  await page.addInitScript(({save,heroes})=>{const request=navigator.locks.request.bind(navigator.locks);window.lampLockRequests=0;navigator.locks.request=(name,...args)=>{if(name==='wishfire.equipment-economy.v5')window.lampLockRequests++;return request(name,...args);};if(!localStorage.getItem('wishfire.equipment-economy.v5')){localStorage.setItem('wishfire.equipment-economy.v5',JSON.stringify(save));localStorage.setItem('orka.hero_progress.v2',JSON.stringify(heroes));}},seed);
  const sample=async()=>{
   const a=await page.evaluate(()=>{const lane=document.querySelector('.lamp-conveyor'),strip=document.querySelector('#wishfire-lamp'),nodes=[...lane.querySelectorAll('.lamp-conveyor-item')];window.emitterSample=nodes;return{time:performance.now(),scale:strip.getBoundingClientRect().width/360,left:lane.getBoundingClientRect().left-strip.getBoundingClientRect().left,speed:(parseFloat(getComputedStyle(lane).getPropertyValue('--conveyor-end'))-parseFloat(getComputedStyle(lane).getPropertyValue('--conveyor-start')))/parseFloat(getComputedStyle(lane).getPropertyValue('--conveyor-duration')),nodes:nodes.map(n=>({id:n.dataset.id,x:n.getBoundingClientRect().left,animationTime:n.getAnimations()[0]?.currentTime,art:n.querySelector('.lamp-art').getBoundingClientRect().toJSON()}))};});
   await delay(350);
   const b=await page.evaluate(()=>({time:performance.now(),nodes:window.emitterSample.map(n=>({id:n.dataset.id,connected:n.isConnected,x:n.getBoundingClientRect().left,animationTime:n.getAnimations()[0]?.currentTime,art:n.querySelector('.lamp-art').getBoundingClientRect().toJSON(),phase:n.getAnimations()[0]?.playState}))}));
   assert.ok(Math.abs(a.left)<.5,'lane clips at the strip left edge');assert.equal(new Set(a.nodes.map(n=>n.id)).size,a.nodes.length,'one sprite per emission');
   for(let i=0;i<a.nodes.length;i++){if(!b.nodes[i].connected||b.nodes[i].phase!=='running')continue;const dx=b.nodes[i].x-a.nodes[i].x,width=a.nodes[i].art.width,speed=a.speed,expected=speed*(b.nodes[i].animationTime-a.nodes[i].animationTime)/1000;assert.ok(Math.abs(dx-expected)<2,'fixed emitter speed '+JSON.stringify({id:a.nodes[i].id,dx,expected,from:a.nodes[i].x,to:b.nodes[i].x}));}
   const moving=b.nodes.filter(n=>n.connected&&n.phase==='running').sort((a,b)=>a.art.left-b.art.left);for(let i=1;i<moving.length;i++)assert.ok(moving[i].art.left>=moving[i-1].art.right-1,'successive real emissions never overlap');samples.push({leftInset:a.left,count:a.nodes.length,ids:a.nodes.map(n=>n.id)});
  };
  try{
   await enter(page,url);const strip=page.locator('#wishfire-lamp');
   assert.equal(await strip.locator('[data-action=generate],.lamp-auto').count(),0);assert.equal(lampStoredCount(await assertSave(page)),19);for(let n=0;n<3;n++){const before=(await state(page)).lamp.sequence;await page.waitForFunction(n=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.sequence>n,before,{timeout:8000});const issued=await assertSave(page),latest=issued.lamp.emissions.at(-1).item.instanceId;assert.equal(lampStoredCount(issued),n===0?19:20,'stored count changes only when equipment reaches the bag');assert.equal(issued.lamp.emissions.at(-1).collected,false,'new emissions remain uncollected while traveling');assert.equal(issued.partyEXP,0);
    const entry=await page.locator(`.lamp-conveyor-item[data-id="${latest}"]`).evaluate(n=>{const style=getComputedStyle(n),lane=n.parentElement;return{start:parseFloat(style.getPropertyValue('--conveyor-start')),art:n.querySelector('.lamp-art').getBoundingClientRect().width,delay:parseFloat(style.animationDelay),elapsed:n.getAnimations()[0].currentTime/1000-parseFloat(style.animationDelay),scale:document.querySelector('#wishfire-lamp').getBoundingClientRect().width/360,left:n.getBoundingClientRect().left-lane.getBoundingClientRect().left};});assert.ok(entry.start<=-entry.art+1,'emitter begins fully off-screen');const entrySpeed=(entry.art+(30*entry.scale*5-entry.art)*.6*.7*.6)/5;assert.ok(Math.abs(entry.left-(entry.start+entrySpeed*entry.elapsed))<1,'actual emission age advances from the offscreen origin');await sample();if(n===0){const arrived=await waitForArrival(page,latest);assert.equal(lampStoredCount(arrived),20,'first arriving item fills the last free slot');assert.equal(arrived.lamp.emissions.find(emission=>emission.item.instanceId===latest).collected,true);}
   }
   const heldId=(await state(page)).lamp.emissions.at(-1).item.instanceId;await movingTap(page,heldId);await page.locator('#lamp-dialog').waitFor();assert.equal((await assertSave(page)).lamp.reviewHold.item.instanceId,heldId);
   const paused=(await state(page)).lamp.sequence;await sample();
   const frozen=await page.locator('.lamp-conveyor-item').evaluateAll(nodes=>nodes.filter(n=>!n.hidden).map(n=>({id:n.dataset.id,x:n.getBoundingClientRect().x,phase:n.getAnimations()[0]?.playState})));
   assert.ok(frozen.length>0);assert.ok(frozen.every(n=>n.phase==='paused'));
   await delay(20000);
   const still=await page.locator('.lamp-conveyor-item').evaluateAll(nodes=>nodes.filter(n=>!n.hidden).map(n=>({id:n.dataset.id,x:n.getBoundingClientRect().x,phase:n.getAnimations()[0]?.playState})));
   assert.deepEqual(still,frozen,'20 seconds in cache preserves every position and gap');
   await page.screenshot({path:`${directory}/${width}-paused-cache.png`});
   assert.equal((await state(page)).lamp.sequence,paused,'bag review pauses creation even at full capacity');
   await page.locator('#lamp-dialog [data-action=close]').click();
   await page.waitForFunction(n=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.sequence>n,paused,{timeout:8000});
   const heldFlow=await assertSave(page);assert.equal(lampStoredCount(heldFlow),20);assert.equal(heldFlow.lamp.reviewHold.item.instanceId,heldId);assert.equal(heldFlow.lamp.emissions.at(-1).collected,false,'unresolved hold never gates creation');const gapProof=await conveyorGap(page);await sample();await page.screenshot({path:`${directory}/${width}-fixed-emitter.png`});
   // Hold the real storage lock while a rejected second full-cache tap keeps the UI busy.
   // Creation must still enqueue; capacity/processing cannot reset the emission clock.
   await page.evaluate(()=>{window.heldLampLock=navigator.locks.request('wishfire.equipment-economy.v5',()=>new Promise(resolve=>window.releaseLampLock=resolve));});
   await page.waitForFunction(()=>typeof window.releaseLampLock==='function');
   try{
    await movingTap(page,heldFlow.lamp.emissions.at(-1).item.instanceId);
    const queued=await page.evaluate(()=>window.lampLockRequests);
    await page.waitForFunction(n=>window.lampLockRequests>n,queued,{timeout:6500});
   }finally{await page.evaluate(()=>window.releaseLampLock());}
   await page.waitForFunction(n=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.sequence>n,heldFlow.lamp.sequence,{timeout:6500});
   const afterBusy=await assertSave(page);assert.deepEqual(afterBusy.items,heldFlow.items);assert.deepEqual(afterBusy.lamp.reviewHold,heldFlow.lamp.reviewHold);assert.equal(afterBusy.lamp.emissions.at(-1).collected,false);await sample();
   const beforeScreen=afterBusy.lamp.sequence;
   await page.getByRole('button',{name:'HERO',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#wishfire-lamp').hidden);await delay(5500);
   assert.equal((await state(page)).lamp.sequence,beforeScreen,'non-combat Hero screen pauses creation');
   await page.getByRole('button',{name:'QUESTS',exact:true}).click();await page.getByRole('button',{name:'Continue Battle',exact:true}).click();await page.locator('#wishfire-lamp').waitFor();
   await page.waitForFunction(n=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.sequence>n,beforeScreen,{timeout:8000});
   assert.equal((await state(page)).lamp.sequence,beforeScreen+1,'resume emits once, without catch-up');
   await delay(1200);const beforeReload=await assertSave(page);
   const activeBeforeReload=await page.evaluate(()=>{const save=JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')),e=save.lamp.emissions.at(-1),n=[...document.querySelectorAll('.lamp-conveyor-item')].find(n=>n.dataset.id===e.item.instanceId);return e.issuedActiveMs+n.getAnimations()[0].currentTime-parseFloat(getComputedStyle(n).animationDelay)*1000;});
   const reloadStartedAt=Date.now();await page.reload();await enter(page,url);const restored=await assertSave(page);
   const activeDelta=restored.lamp.conveyorActiveMs-activeBeforeReload,wallDelta=Date.now()-reloadStartedAt;
   assert.ok(activeDelta>=-150&&activeDelta<=wallDelta+150,'reload preserves position and only advances by time spent loading/playing: '+JSON.stringify({activeDelta,wallDelta}));assert.deepEqual(restored.items,beforeReload.items);assert.deepEqual(restored.loadouts,beforeReload.loadouts);assert.deepEqual(restored.lamp.reviewHold,beforeReload.lamp.reviewHold);await page.waitForFunction(n=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.sequence>n,beforeReload.lamp.sequence,{timeout:8000});const afterReload=await assertSave(page);assert.equal(lampStoredCount(afterReload),20);assert.deepEqual(afterReload.lamp.reviewHold,beforeReload.lamp.reviewHold);assert.equal(afterReload.lamp.emissions.at(-1).collected,false);assert.equal(afterReload.partyEXP,0);await sample();await page.screenshot({path:`${directory}/${width}-full-cache-reloaded.png`});assert.deepEqual(errors,[]);await writeFile(`${directory}/${width}-emitter.json`,JSON.stringify({width,samples,gapProof,fullCache:{stored:lampStoredCount(afterReload),held:heldId,sequence:afterReload.lamp.sequence,latestCollected:afterReload.lamp.emissions.at(-1).collected,partyEXP:afterReload.partyEXP,emittedWhileBusy:afterBusy.lamp.sequence>heldFlow.lamp.sequence},errors},null,2));
  }catch(error){await writeFile(`${directory}/${width}-emitter-error.txt`,error.stack||String(error));await page.screenshot({path:`${directory}/${width}-emitter-failure.png`}).catch(()=>{});await writeFile(`${directory}/${width}-emitter-failure.json`,JSON.stringify(await page.evaluate(()=>({save:JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')),readout:JSON.parse(window.render_game_to_text()),hidden:document.hidden,clock:Date.now()})),null,2));throw error;}finally{await context.close();}
 }));}finally{await browser.close();server?.kill();}
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
   await dialog.locator('[data-action=close]').click();const emitted=await tick(page),id=emitted.lamp.emissions.at(-1).item.instanceId;await movingTap(page,id);await page.waitForFunction(id=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.reviewHold?.item.instanceId===id,id);await dialog.waitFor();assert.equal(await dialog.getAttribute('data-view'),'dismantle','held non-upgrade enters same direct confirmation');assert.equal(await dialog.locator('[data-disposal-selected=true]').count(),21);assert.equal((await dialog.innerText()).trim().replace(/\s+/g,' '),'× Dismantle all');await containment(page);const heldDensity=await disposalDensity(page,21);assert.ok(!(await page.evaluate(()=>window.visibleLampViews)).includes('cache'),'no visible empty cache interstitial');
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
