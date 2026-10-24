import {test} from 'node:test';
import {createRequire} from 'node:module';
const {detectChromeExecutable}=createRequire(import.meta.url)('../tools/playwright_support.js');
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
const directory=process.env.LAMP_QA_OUTPUT||'test-results/lamp-bag-count';

test('bag count and pulse acknowledge only saved current arrivals, without cache-open catch-up',async()=>{
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const server=spawn(process.execPath,['tools/serve_web.js','--port',String(port),'--host','127.0.0.1'],{stdio:'ignore'}),base=`http://127.0.0.1:${port}`;let browser;
 try{
  for(let n=0;n<50;n++){try{if((await fetch(base+'/web-runner/index.html')).ok)break;}catch{}if(n===49)throw Error('Count QA server failed');await delay(100);}
  await mkdir(directory,{recursive:true});browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||detectChromeExecutable()});
  const page=await browser.newPage({viewport:{width:360,height:640}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__count-qa',route=>route.fulfill({contentType:'text/html',body:`<base href="${base}/web-runner/"><link rel="stylesheet" href="assets/lampEquipmentUI.css"><section id="wishfire-lamp" style="left:0;top:488px;width:360px;height:92px;font-size:11px"></section>`}));
  await page.goto(base+'/__count-qa');
  await page.evaluate(async()=>{
   const {updateLampConveyor,acknowledgeConveyorItem}=await import('./systems/lampConveyorPresentation.mjs'),{createEquipmentStorage,EQUIPMENT_SAVE_KEY}=await import('./systems/equipmentStorage.mjs'),{createHeroProgressStore}=await import('./src/core/heroProgression.mjs'),{createLampEconomy,generateLampItem}=await import('./src/core/lampGear.mjs');
   window.pulses=[];const original=Element.prototype.animate;Element.prototype.animate=function(...args){if(this.matches('.lamp-bag-art'))window.pulses.push(document.querySelector('.lamp-count').textContent);return original.apply(this,args);};
   window.reset=(count,withHeroes=true)=>{
    window.clock=100000;window.fail=false;window.pulses=[];document.querySelector('#wishfire-lamp').replaceChildren();
    const progress=createHeroProgressStore(),initial=createLampEconomy(42);for(const h of Object.values(progress.heroes))h.currentLevel=5;
    if(withHeroes)for(const h of Object.values(progress.heroes))for(const type of ['hat','body','boots']){const i={...generateLampItem(42,0,0),instanceId:`owned:${h.heroInstanceKey}:${type}`,type,stats:{ATK:1000,DEF:1000,MAG:1000,RES:1000,HP:1000}};initial.items.push(i);(initial.loadouts[h.heroInstanceKey]||={})[type]=i.instanceId;}
    for(let n=0;n<count;n++){const i=generateLampItem(42,n,0);initial.items.push(i);initial.lamp.pending.push(i.instanceId);initial.lamp.sequence++;}
    const values=new Map([[EQUIPMENT_SAVE_KEY,JSON.stringify(initial)]]);window.saved=()=>values.get(EQUIPMENT_SAVE_KEY);
    window.globals={goldTotal:0,HeroProgress:withHeroes?progress:{heroes:{}}};window.store=createEquipmentStorage({globals,storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(window.fail)throw Error('disk full');values.set(k,v);}},locks:navigator.locks,now:()=>clock,reportError:()=>{}});
   };
   window.paint=()=>{const before=saved();updateLampConveyor({strip:document.querySelector('#wishfire-lamp'),data:store.data,heroes:Object.values(globals.HeroProgress.heroes),now:clock,gearBounds:Array(9).fill({}),tile:i=>`<button class="lamp-tile" style="--rarity:#79ca87" data-id="${i.instanceId}"><span class="lamp-art" style="--col:1;--row:1"><span class="lamp-level">Lv.1</span></span></button>`});if(saved()!==before)throw Error('Presentation mutated inventory');};
   window.emit=async(deferred=false)=>{clock+=5000;const item=await store.tickConveyor({},()=>true,{deferCollection:deferred});paint();return item.instanceId;};
   window.ack=(id,animate=false)=>acknowledgeConveyorItem(document.querySelector('#wishfire-lamp'),id,{animate});
   window.count=()=>document.querySelector('.lamp-count').textContent;
   window.finish=id=>document.querySelector(`[data-id="${id}"]`).getAnimations()[0].finish();
   reset(8);await store.sync();paint();window.ids=[];for(let i=0;i<3;i++)ids.push(await emit());
  });
  assert.equal(await page.evaluate(()=>count()),'11','cache count immediately matches the durable record');
  assert.deepEqual(await page.evaluate(()=>pulses),[],'emission alone cannot bounce');
  await page.evaluate(()=>{finish(ids[0]);});await delay(50);
  assert.deepEqual(await page.evaluate(()=>pulses),[],'animation end without a new save cannot bounce');
  await page.evaluate(async()=>{reset(19);await store.sync();paint();window.ids=[await emit(true),await emit(true)];});
  assert.equal(await page.evaluate(()=>count()),'19');
  await page.evaluate(async()=>{
   for(const id of ids){const node=document.querySelector(`[data-id="${id}"]`);node.dispatchEvent(new AnimationEvent('animationend',{animationName:'lamp-conveyor-travel'}));}
   const results=await store.collectAvailable(ids);paint();
   for(const result of results)if(result.saved)ack(result.item.instanceId,true);
  });
  assert.equal(await page.evaluate(()=>count()),'20','last slot has one durable arrival');
  assert.deepEqual(await page.evaluate(()=>pulses),['20'],'the successful final slot bounces once');
  await page.evaluate(async()=>{const results=await store.collectAvailable(ids);paint();for(const result of results)if(result.saved)ack(result.item.instanceId,true);});
  assert.deepEqual(await page.evaluate(()=>pulses),['20'],'full or duplicate arrivals cannot bounce');
  await page.evaluate(async()=>{await store.dismantle(store.disposalPreview());paint();window.pulses=[];});
  const beforeFailure=await page.evaluate(()=>saved());
  await page.evaluate(async()=>{fail=true;try{await store.collectAvailable(ids);}catch{}paint();});
  assert.equal(await page.evaluate(()=>saved()),beforeFailure);assert.deepEqual(await page.evaluate(()=>pulses),[],'failed saves cannot animate');
  await page.evaluate(async()=>{fail=false;const results=await store.collectAvailable(ids);paint();for(const result of results)if(result.saved)ack(result.item.instanceId,true);});
  assert.equal(await page.evaluate(()=>count()),'1','remaining arrival saves after capacity is freed');
  assert.deepEqual(await page.evaluate(()=>pulses),['1']);
  await page.evaluate(()=>{document.querySelector('#wishfire-lamp').replaceChildren();clock+=26000;paint();});
  assert.equal(await page.evaluate(()=>count()),'1');assert.deepEqual(await page.evaluate(()=>pulses),['1'],'reload never replays receipts');
  await page.evaluate(async()=>{reset(0);await store.sync();paint();window.ids=[await emit(true)];window.allow=true;window.lockEntered=false;window.held=navigator.locks.request('wishfire.equipment-economy.v5',()=>new Promise(resolve=>{window.release=resolve;window.lockEntered=true;}));});
  await page.waitForFunction(()=>window.lockEntered);
  await page.evaluate(()=>{clock+=5000;window.sequenceBeforeLock=store.data.lamp.sequence;window.pendingCapture=Promise.all([store.collectAvailable(ids,()=>allow),store.collect(ids[0],()=>allow),store.tickConveyor({},()=>allow,{deferCollection:true})]);allow=false;release();});
  await page.evaluate(async()=>{await pendingCapture;paint();});assert.equal(await page.evaluate(()=>count()),'0');assert.equal(await page.evaluate(()=>store.data.lamp.sequence),await page.evaluate(()=>sequenceBeforeLock));assert.deepEqual(await page.evaluate(()=>pulses),[],'all gates are checked after the save lock is acquired');
  assert.deepEqual(errors,[]);await page.screenshot({path:`${directory}/saved-only.png`});await writeFile(`${directory}/receipt.json`,JSON.stringify({result:'PASS',lastSlotCount:20,fullBounce:false,gateAfterLock:true},null,2));
 }finally{await browser?.close();server.kill();}
});
