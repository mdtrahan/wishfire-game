import {test} from 'node:test';
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
  await mkdir(directory,{recursive:true});browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/chromium'});
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
   window.ack=id=>acknowledgeConveyorItem(document.querySelector('#wishfire-lamp'),id);
   window.count=()=>document.querySelector('.lamp-count').textContent;
   window.finish=id=>document.querySelector(`[data-id="${id}"]`).getAnimations()[0].finish();
   reset(8);await store.sync();paint();window.ids=[];for(let i=0;i<3;i++)ids.push(await emit());
  });
  assert.equal(await page.evaluate(()=>count()),'8','three saved in-flight items must not lead their arrivals');
  assert.equal(await page.evaluate(()=>JSON.parse(saved()).lamp.discarded.length),11);
  await page.screenshot({path:`${directory}/before-arrival.png`});
  const finish=async index=>{await page.evaluate(index=>finish(ids[index]),index);await page.waitForFunction(index=>document.querySelector(`[data-id="${ids[index]}"]`).hidden,index);await page.waitForFunction(()=>!document.querySelector('.lamp-conveyor-item[data-count-pending=true]'));};
  await finish(0);assert.equal(await page.evaluate(()=>count()),'9');assert.deepEqual(await page.evaluate(()=>pulses),['8'],'count cannot precede visible expansion');
  await page.evaluate(()=>{document.querySelector(`[data-id="${ids[0]}"]`).dispatchEvent(new AnimationEvent('animationend',{animationName:'lamp-conveyor-travel'}));paint();});assert.equal(await page.evaluate(()=>count()),'9');assert.deepEqual(await page.evaluate(()=>pulses),['8']);
  await page.evaluate(async()=>ids.push(await emit()));assert.equal(await page.evaluate(()=>count()),'9');await finish(1);assert.equal(await page.evaluate(()=>count()),'10');
  await page.evaluate(async()=>{await store.equip(Object.keys(globals.HeroProgress.heroes)[0],ids[2]);paint();});assert.equal(await page.evaluate(()=>count()),'10','replacement is destroyed; equipped in-flight gear does not count');
  await finish(2);assert.equal(await page.evaluate(()=>count()),'10','equipped arrival cannot add an extra item');await finish(3);assert.equal(await page.evaluate(()=>count()),'11','latest saved snapshot includes the later AUTO emission');
  await page.evaluate(async()=>ids.push(await emit()));assert.equal(await page.evaluate(()=>count()),'11');await page.evaluate(()=>paint());assert.equal(await page.evaluate(()=>count()),'11','review render cannot batch-acknowledge in-flight equipment');await finish(4);assert.equal(await page.evaluate(()=>count()),'12');
  await page.evaluate(async()=>{reset(8,false);await store.sync();paint();window.ids=[await emit()];});assert.equal(await page.evaluate(()=>count()),'8');await page.evaluate(async()=>{await store.dismantle(store.disposalPreview());paint();});assert.equal(await page.evaluate(()=>count()),'0');const essence=await page.evaluate(()=>store.data.lamp.essence);await finish(0);assert.equal(await page.evaluate(()=>count()),'0','removed items cannot increment from a stale animation callback');assert.equal(await page.evaluate(()=>store.data.lamp.essence),essence);
  await page.evaluate(async()=>{reset(20);await store.sync();paint();window.ids=[await emit()];});assert.equal(await page.evaluate(()=>count()),'20');await finish(0);assert.equal(await page.evaluate(()=>count()),'20','full-cache unsaved arrivals never increment');
  await page.evaluate(async()=>{ids.push(await emit());await store.collect(ids[1]);paint();});assert.equal(await page.evaluate(()=>count()),'20+1');await finish(1);assert.equal(await page.evaluate(()=>count()),'20+1','manual hold counts once and stays separate from capacity');
  await page.evaluate(()=>{document.querySelector('#wishfire-lamp').replaceChildren();clock+=26000;paint();});assert.equal(await page.evaluate(()=>count()),'20+1','expired replay restores actual count without pulses');
  const beforeFailure=await page.evaluate(()=>saved());await page.evaluate(async()=>{fail=true;try{await emit();}catch{}paint();});assert.equal(await page.evaluate(()=>saved()),beforeFailure);assert.equal(await page.evaluate(()=>count()),'20+1');
  await page.evaluate(async()=>{reset(20);await store.sync();paint();window.ids=[await emit(true)];await store.dismantle(store.disposalPreview());paint();});
  assert.equal(await page.evaluate(()=>count()),'0');
  await page.evaluate(()=>{window.trace=[];window.sampling=true;const sample=()=>{paint();const t=getComputedStyle(document.querySelector('.lamp-bag-art')).transform;trace.push({count:count(),scale:t==='none'?1:new DOMMatrixReadOnly(t).a});if(sampling)requestAnimationFrame(sample);};requestAnimationFrame(sample);finish(ids[0]);});
  await page.waitForFunction(()=>document.querySelector('.lamp-conveyor-item').dataset.arrived==='true');
  await page.evaluate(async()=>{await store.collectAvailable([ids[0],ids[0]]);paint();});
  await page.waitForFunction(()=>trace.some(t=>t.count==='1'));await page.evaluate(()=>sampling=false);
  const trace=await page.evaluate(()=>trace),changed=trace.findIndex(t=>t.count==='1');
  const expanded=trace.findIndex(t=>t.scale>1.01);assert.ok(expanded>=0 && changed>expanded,'count lags first visible expansion');assert.ok(trace.every(t=>t.scale>=1),'bag never shrinks below its resting size');
  assert.deepEqual(await page.evaluate(()=>pulses),['0']);
  await page.evaluate(async()=>{await store.collectAvailable(ids);paint();});assert.equal(await page.evaluate(()=>count()),'1','first post-dismantle arrival saves exactly once');
  assert.deepEqual(errors,[]);await page.screenshot({path:`${directory}/full-held.png`});await writeFile(`${directory}/receipt.json`,JSON.stringify({profile:[360,640,1],result:'PASS',counts:['8','9','10','11','12','13','0','20','20+1'],consoleErrors:errors},null,2));
 }finally{await browser?.close();server.kill();}
});
