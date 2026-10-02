import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdir,writeFile} from 'node:fs/promises';
import {RARITIES} from '../web-runner/src/core/equipment.mjs';
import {createHeroProgressStore,refreshHeroStats} from '../web-runner/src/core/heroProgression.mjs';
import {createLampEconomy,activateLamp,lampItemCPGain,lampGearCP,compareLampItem} from '../web-runner/src/core/lampGear.mjs';
const require=createRequire(import.meta.url);
const {detectChromeExecutable}=require('../tools/playwright_support.js');
let url=process.env.LAMP_QA_URL,server;
const directory='test-results/lamp';
async function guideIdle(page,ms=15100){await page.evaluate(ms=>{if(window.lampIdleOffset===undefined){const now=performance.now.bind(performance);window.lampIdleOffset=0;performance.now=()=>now()+window.lampIdleOffset;}window.lampIdleOffset+=ms;},ms);}
async function guideBounds(page){const result=await page.evaluate(async()=>{const helper=document.querySelector('.lamp-idle-helper'),samples=[];for(let n=0;n<12;n++){await new Promise(requestAnimationFrame);samples.push([...helper.querySelectorAll('img,span')].every(e=>{const r=e.getBoundingClientRect();return r.left>=-.5&&r.right<=innerWidth+.5&&r.top>=-.5&&r.bottom<=innerHeight+.5;}));}return{target:helper.dataset.target,contained:samples.every(Boolean),overflow:document.documentElement.scrollWidth>innerWidth};});assert.deepEqual(result,{target:result.target,contained:true,overflow:false});return result;}
test('lamp immediate review, four recipients, durable equip, Auto and phone containment',async()=>{
 if(!url){
  const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
  url=`http://localhost:${port}/web-runner/index.html`;server=spawn(process.execPath,['tools/serve_web.js','--port',String(port),'--host','127.0.0.1'],{stdio:'ignore'});
  for(let n=0;n<50;n++){try{if((await fetch(url)).ok)break;}catch{}if(n===49){server.kill();throw Error('Lamp QA server did not start');}await delay(100);}
 }
 const browser=await chromium.launch({headless:true,executablePath:detectChromeExecutable()});
 await mkdir(directory,{recursive:true});const report=[];
 try{for(const [width,height,dpr]of [[360,640,1],[216,384,2],[233,452,2],[316,452,2]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr});const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const fixture=createLampEconomy(42,1000);
  activateLamp(fixture,{region:1,stage:1},0);activateLamp(fixture,{region:2,stage:3},2000);
  const current={...fixture.items[0],instanceId:'owned-Huun',stats:{...fixture.items[0].stats,ATK:fixture.items[0].stats.ATK+10,MAG:fixture.items[0].stats.MAG+1}};fixture.items.push(current);fixture.loadouts.Huun={[current.type]:current.instanceId};
  const equal={...fixture.items[0],instanceId:'owned-Kojonn'};fixture.items.push(equal);fixture.loadouts.Kojonn={[equal.type]:equal.instanceId};
  const heroSave=createHeroProgressStore();for(const h of Object.values(heroSave.heroes)){h.currentLevel=5;refreshHeroStats(h);h.hp=h.maxHP;}
  await page.addInitScript(({save,heroes})=>{if(!localStorage.getItem('wishfire.equipment-economy.v5'))localStorage.setItem('wishfire.equipment-economy.v5',JSON.stringify(save));if(!localStorage.getItem('orka.hero_progress.v2'))localStorage.setItem('orka.hero_progress.v2',JSON.stringify(heroes));},{save:fixture,heroes:heroSave});
  await page.goto(url);await page.waitForFunction(()=>typeof window.render_game_to_text==='function');const strip=page.locator('#wishfire-lamp');assert.equal(await strip.isVisible(),false,'lamp is hidden before combat');
  await page.waitForTimeout(2000);const startCanvas=await page.locator('canvas').first().boundingBox();await page.mouse.click(startCanvas.x+startCanvas.width/2,startCanvas.y+426*startCanvas.width/360);
  await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).quest.phase==='combat',null,{timeout:15000});await strip.getByRole('button',{name:'Reveal equipment',exact:true}).waitFor();
  const geometry=await page.evaluate(()=>{
   const canvas=document.querySelector('canvas'),s=document.querySelector('#wishfire-lamp'),c=canvas.getBoundingClientRect(),r=s.getBoundingClientRect();
   const bounds=n=>{const b=n.getBoundingClientRect();return b.left>=r.left-.5&&b.right<=r.right+.5&&b.top>=r.top-.5&&b.bottom<=r.bottom+.5;};
   return {viewport:[innerWidth,innerHeight,devicePixelRatio],overflow:document.documentElement.scrollWidth>innerWidth,stripOverflow:s.scrollWidth>s.clientWidth,controls:[...s.querySelectorAll('button')].every(bounds),anchor:(r.top-c.top)/(c.width/360),height:r.height/(c.width/360),lampRight:s.querySelector('.lamp-burp').getBoundingClientRect().left>s.querySelector('.lamp-results').getBoundingClientRect().right-.5,previewColumn:s.querySelector('.lamp-collect .lamp-art')?.style.getPropertyValue('--col'),previewRow:s.querySelector('.lamp-collect .lamp-art')?.style.getPropertyValue('--row')};
  });
  assert.equal(geometry.overflow,false);assert.equal(geometry.stripOverflow,false);assert.equal(geometry.controls,true);assert.equal(geometry.lampRight,true);assert.ok(Math.abs(geometry.anchor-488)<.5);assert.ok(Math.abs(geometry.height-92)<.5);
  const lampPaint=await strip.evaluate(s=>{
   const image=s.querySelector('.lamp-device'),r=s.getBoundingClientRect(),i=image.getBoundingClientRect();
   const clips=[];for(let n=image.parentElement;n;n=n.parentElement){const c=getComputedStyle(n);if(/hidden|clip|auto|scroll/.test(c.overflowY)&&i.top<n.getBoundingClientRect().top)clips.push(n.id||n.className);}
   return {aboveStrip:r.top-i.top,clips,filter:getComputedStyle(image).filter};
  });
  assert.ok(lampPaint.aboveStrip>0,'supplied smoke extends above the unchanged strip');assert.deepEqual(lampPaint.clips,[],'no ancestor clips the lamp smoke');assert.equal(lampPaint.filter,'none','ready lamp retains full brightness');
  assert.equal(await strip.locator('.lamp-collect .lamp-art').count(),0,'counter bubble contains no competing gear preview');
  assert.equal(await strip.locator('.lamp-strip-top,.lamp-status,.lamp-wallet').count(),0);assert.equal(await strip.locator('.lamp-results .lamp-level').count(),0);
  const stripBalance=await strip.evaluate(s=>{const r=s.getBoundingClientRect(),auto=s.querySelector('.lamp-auto'),bubble=s.querySelector('.lamp-collect'),progress=s.querySelector('.lamp-progress');return{autoState:auto.dataset.state,autoLeft:(auto.getBoundingClientRect().left-r.left)/(r.width/360),count:bubble.textContent,level:s.querySelector('.lamp-tier-badge b').textContent,progress:Number(progress.getAttribute('aria-valuenow')),max:Number(progress.getAttribute('aria-valuemax')),barLeft:progress.getBoundingClientRect().left,barHeight:progress.getBoundingClientRect().height,discEnd:s.querySelector('.lamp-level-disc').getBoundingClientRect().right};});
  assert.equal(stripBalance.autoState,'off');assert.ok(Math.abs(stripBalance.autoLeft-7.92)<1);assert.equal(stripBalance.count,'2');assert.equal(stripBalance.level,'5');assert.equal(stripBalance.progress,50);assert.equal(stripBalance.max,1119);assert.ok(stripBalance.barLeft+stripBalance.barHeight/2<stripBalance.discEnd,'level disc covers the entire rounded left end of the bar');
  await page.waitForTimeout(1500); // Let the combat entry transition finish before visual capture.
  await page.screenshot({path:`${directory}/${width}-strip.png`});
  const emission=await strip.evaluate(s=>{
   s.classList.add('burping','lamp-upgrade-emission');
   const animations=s.getAnimations({subtree:true}).filter(a=>['lamp-burp','lamp-reveal'].includes(a.animationName));
   const frames=Object.fromEntries(animations.map(a=>{a.pause();return[a.animationName,a.effect.getKeyframes().map(f=>{const m=new DOMMatrix(f.transform);return{opacity:Number(f.opacity??1),scaleX:Math.hypot(m.a,m.b),scaleY:Math.hypot(m.c,m.d),y:m.f};})];}));
   s.classList.remove('burping','lamp-upgrade-emission');return frames;
  });
  for(const name of ['lamp-burp']){assert.ok(emission[name]?.length>1);assert.ok(emission[name].every(f=>f.opacity===1&&Math.abs(f.scaleX-1)<.0001&&Math.abs(f.scaleY-1)<.0001),'emission preserves opacity and painted size');}
  assert.equal(emission['lamp-reveal'],undefined,'restored cache does not animate arrivals into the empty strip');

  await strip.locator('.lamp-collect').click();const dialog=page.locator('#lamp-dialog');await dialog.waitFor({state:'visible'});await dialog.locator('[data-action="queue"][data-id="'+fixture.items[0].instanceId+'"]').click();
  assert.equal(await dialog.locator('.lamp-hero').count(),4);assert.equal(await dialog.locator('.lamp-compare,.lamp-rarity,[data-action="finish"],.lamp-hero-navigation').count(),0);assert.equal(await dialog.locator('.lamp-quality-band').count(),1);
  const expectedPreview=Object.values(heroSave.heroes).map(h=>lampItemCPGain(fixture,fixture.items[0],h));
  const preview=await dialog.locator('.lamp-hero').evaluateAll(nodes=>nodes.map(n=>({change:Number(n.dataset.cpChange),text:n.textContent,label:n.getAttribute('aria-description'),arrow:n.querySelector('.lamp-cp-direction')?.className,src:n.querySelector('img').getAttribute('src')})));
  assert.deepEqual(preview.map(p=>p.change),expectedPreview,'preview uses total hero CP change, including level and existing gear');
  assert.ok(expectedPreview.some(n=>n>0)&&expectedPreview.some(n=>n<0)&&expectedPreview.includes(0),'fixture covers increase, decrease and unchanged total CP');
  preview.forEach(p=>{assert.equal(p.text,'');assert.match(p.label,/total CP change/);assert.equal(p.arrow,p.change?'lamp-cp-direction '+(p.change>0?'up':'down'):undefined);assert.match(p.src,/assets\/images\/(Fara|Hondo|Runa|Kaja)\.png$/);});
  const containment=await dialog.evaluate(d=>{const r=d.getBoundingClientRect();return {overflow:d.scrollWidth>d.clientWidth,inViewport:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,columns:[...d.querySelectorAll('.lamp-hero')].every(n=>{const b=n.getBoundingClientRect();return b.left>=r.left&&b.right<=r.right;})};});
  assert.deepEqual(containment,{overflow:false,inViewport:true,columns:true});
  const order=await dialog.evaluate(d=>{const stats=d.querySelector('.lamp-hero-row').getBoundingClientRect(),item=d.querySelector('.lamp-candidate').getBoundingClientRect(),buttons=d.querySelector('.lamp-actions').getBoundingClientRect();return stats.bottom<=item.top&&item.bottom<=buttons.top;});assert.equal(order,true,'heroes and deltas precede item, confirmation follows it');
  assert.equal(await dialog.locator('.lamp-item-stats dd').count(),Object.keys(fixture.items[0].stats).length);
  assert.deepEqual(await dialog.locator('.lamp-item-stats dt').allTextContents(),['HP','ATK','DEF','MAG','RES']);
  assert.deepEqual(await dialog.locator('.lamp-actions:not(.lamp-hero-navigation) button').allTextContents(),['Skip','Equip','Auto-Equip']);
  assert.equal(await dialog.locator('.lamp-queue').count(),1);
  const selectedTile=dialog.locator('.lamp-queue [aria-current="true"]');
  assert.equal(await selectedTile.count(),1);assert.equal(await selectedTile.getAttribute('data-id'),fixture.items[0].instanceId);
  const queueBounds=await dialog.locator('.lamp-queue').boundingBox();
  await dialog.locator('.lamp-queue [data-id="'+fixture.items[1].instanceId+'"]').click();
  assert.equal(await selectedTile.getAttribute('data-id'),fixture.items[1].instanceId);
  const changedBounds=await dialog.locator('.lamp-queue').boundingBox();
  assert.equal(changedBounds.width,queueBounds.width);assert.equal(changedBounds.height,queueBounds.height);
  assert.ok((await selectedTile.evaluate(e=>getComputedStyle(e).boxShadow)).includes('255, 201, 40'),'selected item has gold halo');
  await dialog.locator('.lamp-queue .lamp-tile').first().click();
  assert.equal(await selectedTile.getAttribute('data-id'),fixture.items[1].instanceId);
  await dialog.locator('.lamp-queue [data-id="'+fixture.items[0].instanceId+'"]').click();

  assert.equal(await dialog.getByText('Tap a hero portrait to choose.',{exact:true}).count(),0);
  const queueGeometry=await dialog.locator('.lamp-queue').evaluate(e=>{
   const original=[...e.children],frame=e.getBoundingClientRect(),style=getComputedStyle(e),size=original[0].getBoundingClientRect().height;
   for(let n=0;n<20;n++){const clone=original[n%original.length].cloneNode(true);clone.removeAttribute('aria-current');clone.dataset.qaClone='true';e.append(clone);}
   const tiles=[...e.children].slice(0,6).map(n=>n.getBoundingClientRect()),inset=parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)+parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth),gap=parseFloat(style.rowGap);
   const result={rows:(()=>{const available=frame.height-inset,full=Math.floor((available+gap)/(size+gap));return full+Math.max(0,available-full*(size+gap))/size;})(),fiveAcross:tiles.slice(0,5).every(t=>t.y===tiles[0].y)&&tiles[5].y>tiles[0].y,square:(()=>{const r=original[0].querySelector('.lamp-art').getBoundingClientRect();return Math.abs(r.width-r.height)<.1;})(),filled:Math.abs(tiles[4].right-tiles[0].left-(e.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)))<1,stable:e.getBoundingClientRect().height===frame.height&&e.scrollHeight>e.clientHeight};
   return result;
  });
  await page.screenshot({path:`${directory}/${width}-inventory-geometry.png`});
  assert.ok(queueGeometry.rows>=2&&queueGeometry.rows<=2.51,'cache exposes two to two-and-a-half rows: '+JSON.stringify(queueGeometry));
  assert.deepEqual({...queueGeometry,rows:2.5},{rows:2.5,fiveAcross:true,square:true,filled:true,stable:true});
  await page.screenshot({path:`${directory}/${width}-expanded-cache-comparison.png`});
  await dialog.locator('.lamp-queue').screenshot({path:`${directory}/${width}-inventory-expanded.png`});
  await dialog.locator('.lamp-queue [data-qa-clone]').evaluateAll(nodes=>nodes.forEach(n=>n.remove()));
  assert.equal(await dialog.locator('.lamp-rarity').count(),0);assert.equal(await strip.locator('.lamp-rarity').count(),0);
  await dialog.getByRole('button',{name:'Choose Hondo',exact:true}).click();
  const expectedDeltas=compareLampItem(fixture,fixture.items[0],'Huun').deltas;
  const statSignals=await dialog.locator('.lamp-item-stats>div').evaluateAll(nodes=>nodes.map(n=>({stat:n.querySelector('dt').textContent,value:n.querySelector('.lamp-stat-number').textContent,delta:Number(n.querySelector('dd').dataset.delta),arrow:n.querySelector('.lamp-stat-arrow')?.className})));
  for(const n of statSignals){assert.equal(Number(n.value),fixture.items[0].stats[n.stat]);assert.equal(n.delta,expectedDeltas[n.stat]);assert.equal(n.arrow,n.delta?'lamp-stat-arrow '+(n.delta>0?'up':'down'):undefined);}
  await page.waitForFunction(()=>!document.querySelector('#lamp-dialog [data-action="equip"]').disabled);assert.equal(await dialog.getByRole('button',{name:'Equip',exact:true}).isEnabled(),true,'manual lower-CP equip remains available');
  assert.equal(await dialog.locator('.lamp-stat-paint').evaluateAll(nodes=>nodes.every(c=>Math.abs(c.width/c.getBoundingClientRect().width-devicePixelRatio)<.05&&Math.abs(c.height/c.getBoundingClientRect().height-devicePixelRatio)<.05)),true,'stat backing pixels match display DPR');
  const itemLayout=await dialog.locator('.lamp-item-stats').evaluate(dl=>{
   const cells=[...dl.children].map(n=>n.getBoundingClientRect());return {threeAcross:cells[0].y===cells[1].y&&cells[1].y===cells[2].y&&cells[3].y>cells[0].y&&cells[3].y===cells[4].y,aligned:Math.abs(cells[0].x-cells[3].x)<.5&&Math.abs(cells[1].x-cells[4].x)<.5,contained:[...dl.querySelectorAll('dd')].every(e=>e.scrollWidth<=e.clientWidth),cardRadius:parseFloat(getComputedStyle(dl.closest('.lamp-candidate')).borderRadius)};
  });
  assert.deepEqual(itemLayout,{threeAcross:true,aligned:true,contained:true,cardRadius:9});
  await page.screenshot({path:`${directory}/${width}-comparison.png`});
  const beforeFailedSave=await page.evaluate(()=>localStorage.getItem('wishfire.equipment-economy.v5'));
  await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='wishfire.equipment-economy.v5'){Storage.prototype.setItem=set;throw Error('QA save failure');}return set.call(this,key,value);};});
  await dialog.getByRole('button',{name:'Equip',exact:true}).click();await dialog.getByText('QA save failure',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('wishfire.equipment-economy.v5')),beforeFailedSave,'failed equip preserves the saved loadout and cache');
  assert.equal(await page.locator('.lamp-cp-feedback').count(),0,'failed equip grants no CP receipt');
  const errorNotice=await dialog.locator('.lamp-modal-notice').evaluate(n=>{const r=n.getBoundingClientRect(),c=getComputedStyle(n);return{readable:r.width>40&&r.height>10&&c.clipPath==='none',contained:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,masterOverflow:n.closest('#lamp-dialog').scrollHeight>n.closest('#lamp-dialog').clientHeight+1};});
  assert.deepEqual(errorNotice,{readable:true,contained:true,masterOverflow:false});await page.screenshot({path:`${directory}/${width}-failed-save-notice.png`});

  await dialog.getByRole('button',{name:'Choose Kaja',exact:true}).click();assert.equal(await dialog.locator('.lamp-item-stats .lamp-stat-arrow').count(),0,'equal gear shows no stat arrows');
  await dialog.getByRole('button',{name:'Choose Fara',exact:true}).click();assert.equal(await dialog.locator('.lamp-portrait[aria-pressed="true"]').count(),1);
  const navigation=await dialog.evaluate(d=>({masterOverflow:d.scrollHeight>d.clientHeight+1,removed:d.querySelectorAll('.lamp-hero-navigation,.lamp-finish,.lamp-instruction,.lamp-selected').length,controls:[...d.querySelectorAll('.lamp-actions button')].every(n=>{const r=n.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;})}));
  assert.deepEqual(navigation,{masterOverflow:false,removed:0,controls:true});
  await page.screenshot({path:`${directory}/${width}-current-gear-navigation.png`});
  await dialog.locator('[data-action="queue"][data-id="'+fixture.items[0].instanceId+'"]').click();
  assert.equal(await dialog.locator('.lamp-modal-header span').innerText(),'HERO GEAR UPGRADE');
  {
   // Offset the monotonic browser clock without advancing combat or Auto farming.
   await page.evaluate(()=>{const now=performance.now.bind(performance);window.lampIdleOffset=0;performance.now=()=>now()+window.lampIdleOffset;});
   await dialog.locator('.lamp-modal-header span').click();await page.evaluate(()=>window.lampIdleOffset+=14000);await page.waitForTimeout(50);
   assert.equal(await page.locator('.lamp-idle-helper').isVisible(),false);
   await page.evaluate(()=>window.lampIdleOffset+=1100);await page.locator('.lamp-idle-helper').waitFor();
   assert.equal(await page.locator('.lamp-idle-helper').getAttribute('data-target'),'Huun');
   await page.screenshot({path:`${directory}/${width}-idle-hondo.png`});
   await dialog.getByRole('button',{name:'Choose Hondo',exact:true}).click();assert.equal(await page.locator('.lamp-idle-helper').isVisible(),false);
   await page.evaluate(()=>window.lampIdleOffset+=15100);await page.locator('.lamp-idle-helper').waitFor();
   assert.equal(await page.locator('.lamp-idle-helper').getAttribute('data-target'),'auto-equip');
   await page.screenshot({path:`${directory}/${width}-idle-auto-equip.png`});
   await dialog.locator('.lamp-item-stats').click();assert.equal(await page.locator('.lamp-idle-helper').isVisible(),false);
  }

  await dialog.getByRole('button',{name:'Choose Runa',exact:true}).click();assert.equal(await dialog.locator('.lamp-portrait[aria-pressed="true"]').getAttribute('data-id'),'Runa');await page.screenshot({path:`${directory}/${width}-selected.png`});await dialog.getByRole('button',{name:'Equip',exact:true}).click();
  const feedback=page.locator('.lamp-cp-feedback').last();await feedback.waitFor();assert.equal(await feedback.getAttribute('data-hero'),'Runa');assert.equal(await dialog.isVisible(),true,'comparison stays open during CP feedback');assert.equal(await feedback.evaluate(e=>e.closest('#lamp-overlay')!==null),true,'CP feedback belongs to its modal');
  const receipt=await feedback.evaluate(e=>({change:Number(e.dataset.change),before:Number(e.dataset.before),after:Number(e.dataset.after)}));assert.equal(receipt.change,Math.round((receipt.after-receipt.before)*10)/10);assert.ok(receipt.change>0,'selected Runa equip raises total CP');assert.equal(receipt.change,expectedPreview[2],'saved receipt matches the recipient preview');assert.equal(await feedback.locator('img').count(),0,'equip feedback floats only the CP value');assert.equal(await feedback.innerText(),'CP '+(receipt.change>0?'+':'')+receipt.change);await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.lamp-cp-feedback')).opacity)>.9);await page.screenshot({path:`${directory}/${width}-cp-feedback.png`});
  const closeBox=await dialog.locator('[data-action="close"]').boundingBox(),closePoint=[closeBox.x+closeBox.width/2,closeBox.y+closeBox.height/2];
  const closeHit=await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.closest('button')?.dataset.action,closePoint);assert.equal(closeHit,'close','Close center remains reachable while CP feedback is active');
  await page.mouse.click(...closePoint);assert.equal(await dialog.isVisible(),true,'Close waits for active saved CP feedback');await dialog.waitFor({state:'hidden'});assert.equal(await page.locator('.lamp-cp-feedback').count(),0,'float finishes before modal closes');
  let state=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));assert.equal(state.lamp.pending.length,1);assert.equal(state.loadouts.Runa[fixture.items[0].type],fixture.items[0].instanceId);
  await page.reload();await page.waitForTimeout(2000);const reloadCanvas=await page.locator('canvas').first().boundingBox();await page.mouse.click(reloadCanvas.x+reloadCanvas.width/2,reloadCanvas.y+426*reloadCanvas.width/360);await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).quest.phase==='combat');await strip.getByRole('button',{name:'Reveal equipment',exact:true}).waitFor();state=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));assert.equal(state.loadouts.Runa[fixture.items[0].type],fixture.items[0].instanceId);assert.equal(await strip.locator('.lamp-results button').count(),0,'reload restores cache without filling arrival positions');assert.equal(state.lamp.autoEnabled,false);
  await strip.locator('.lamp-collect').click();await dialog.getByRole('button',{name:'Skip',exact:true}).click();await dialog.getByText('DISMANTLE ALL',{exact:true}).waitFor();await dialog.locator('.lamp-queue .lamp-tile').waitFor();assert.equal(await dialog.getAttribute('aria-label'),'Dismantle All');assert.equal(await dialog.locator('.lamp-queue .lamp-tile').count(),1);assert.equal(await dialog.locator('.lamp-queue button').count(),0,'dismantling items cannot be selected');assert.equal((await dialog.innerText()).includes('Essence'),false,'resource amount appears only after confirmation');assert.equal(await dialog.getByRole('button',{name:'Review again',exact:true}).count(),0);
  await guideIdle(page);await page.locator('.lamp-idle-helper').waitFor();assert.equal(await page.locator('.lamp-idle-helper').getAttribute('data-target'),'dismantle');await guideBounds(page);await page.screenshot({path:`${directory}/${width}-guide-dismantle.png`});await dialog.locator('.lamp-modal-header span').click();assert.equal(await page.locator('.lamp-idle-helper').isVisible(),false);
  const beforeDismantleEXP=await page.evaluate(()=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).partyEXP);await page.screenshot({path:`${directory}/${width}-dismantle-all.png`});await dialog.getByRole('button',{name:'Dismantle All',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.locator('.lamp-reward-banner').getByText('DISMANTLED',{exact:true}).waitFor();await guideIdle(page);await page.waitForTimeout(50);assert.equal(await page.locator('.lamp-idle-helper').isVisible(),false,'guidance never interrupts the active reward banner');assert.equal(await page.locator('.lamp-party-exp').count(),0);assert.equal(await page.locator('.lamp-reward-banner button').count(),0);assert.equal(await page.locator('.lamp-reward-banner img').count(),1);assert.match(await page.locator('.lamp-reward-banner b').innerText(),/^[\d,]+$/);const rewardBounds=await page.locator('.lamp-reward-banner').boundingBox();assert.ok(rewardBounds.x>=0&&rewardBounds.x+rewardBounds.width<=width+.5);assert.ok(rewardBounds.height<height*.3);assert.equal(await page.locator('.lamp-reward-banner').evaluate(n=>getComputedStyle(n).pointerEvents),'none');await page.screenshot({path:`${directory}/${width}-dismantled.png`});await page.locator('.lamp-reward-banner').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).partyEXP),beforeDismantleEXP);state=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));assert.equal(state.lamp.pending.length,0);assert.equal(state.items.length,3);await strip.locator('.lamp-collect').click();assert.equal(await dialog.isVisible(),false,'empty storage never opens a dismantle modal');
  const guideBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')));
  await guideIdle(page);await page.locator('.lamp-idle-helper').waitFor();assert.equal(await page.locator('.lamp-idle-helper').getAttribute('data-target'),'lamp-upgrades');await guideBounds(page);await page.screenshot({path:`${directory}/${width}-guide-preview.png`});await strip.locator('[data-action="lamp-upgrades"]').click();await dialog.getByText('WISH LAMP',{exact:true}).waitFor();await page.waitForFunction(()=>!!(JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.guide&4));
  const guideAfter=await page.evaluate(()=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')));assert.equal(guideAfter.lamp.guide,7);delete guideAfter.lamp.guide;delete guideBefore.lamp.guide;assert.deepEqual(guideAfter,guideBefore,'free preview records only its guide receipt');await guideIdle(page);await page.locator('.lamp-idle-helper').waitFor();assert.equal(await page.locator('.lamp-idle-helper').getAttribute('data-target'),'close','unaffordable confirmation redirects to an enabled close');await guideBounds(page);await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await page.locator('.lamp-idle-helper').isVisible(),false);await guideIdle(page);await page.locator('.lamp-idle-helper').waitFor();assert.equal(await page.locator('.lamp-idle-helper').getAttribute('data-target'),'generate','completed preview stays completed while more essence is needed');await page.mouse.wheel(0,1);await page.waitForFunction(()=>document.querySelector('.lamp-idle-helper').hidden);
  for(let n=0;n<4;n++){
   const lamp=strip.getByRole('button',{name:'Reveal equipment',exact:true});await lamp.click();await page.waitForFunction(expected=>JSON.parse(window.render_game_to_text()).lamp.sequence===expected,n+3);
   if(n===0){assert.equal(await lamp.isDisabled(),true,'lamp is disabled during its emission cooldown');assert.equal(await lamp.locator('.lamp-device').evaluate(n=>getComputedStyle(n).filter),'brightness(0.8)','unavailable lamp darkens by exactly 20 percent');await page.screenshot({path:`${directory}/${width}-lamp-unavailable.png`});await lamp.evaluate(b=>b.click());await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>JSON.parse(window.render_game_to_text()).lamp.sequence),3,'rapid clicks grant no extra gear or EXP');await page.waitForFunction(()=>!document.querySelector('.lamp-burp').disabled);assert.ok(await lamp.evaluate(()=>Date.now()-JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.lastActivationAt)>=2000,'lamp only re-enables after two seconds');assert.equal(await lamp.locator('.lamp-device').evaluate(n=>getComputedStyle(n).filter),'none','readiness restores full brightness');}
  }
  await strip.locator('.lamp-collect').click();
  const ranked=await dialog.locator('.lamp-queue button').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.cp)));assert.ok(ranked.every((n,i)=>!i||ranked[i-1]>=n),'review grid sorts descending item CP');
  const beforeBatch=await page.evaluate(()=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')));await dialog.getByRole('button',{name:'Auto-Equip',exact:true}).click();await page.locator('.lamp-cp-feedback').first().waitFor();await page.waitForFunction(()=>!document.querySelector('.lamp-cp-feedback'));assert.equal(await page.locator('.lamp-cp-feedback').count(),0,'CP feedback completes before advancing review');
  const afterBatch=await page.evaluate(()=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')));assert.equal(afterBatch.lamp.pending.length,0);const recipients=Object.keys(afterBatch.loadouts).filter(id=>JSON.stringify(afterBatch.loadouts[id])!==JSON.stringify(beforeBatch.loadouts[id]));assert.ok(recipients.length>0&&recipients.length<=4);assert.equal(afterBatch.lamp.essence,beforeBatch.lamp.essence);assert.equal(afterBatch.partyEXP,beforeBatch.partyEXP);if(afterBatch.lamp.discarded.length){await dialog.getByText('DISMANTLE ALL',{exact:true}).waitFor();assert.equal((await dialog.innerText()).includes('Essence'),false);}else assert.equal(await dialog.isVisible(),false);await page.screenshot({path:`${directory}/${width}-auto-dismantle.png`});await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  if(afterBatch.lamp.discarded.length){await strip.locator('.lamp-collect').click();await dialog.getByText('DISMANTLE ALL',{exact:true}).waitFor();assert.equal(await dialog.locator('[data-action="equip"],[data-action="queue"]').count(),0);await dialog.getByRole('button',{name:'Dismantle All',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.locator('.lamp-reward-banner').getByText('DISMANTLED',{exact:true}).waitFor();await page.locator('.lamp-reward-banner').waitFor({state:'detached'});}
  assert.equal(await strip.locator('.lamp-results button').count(),0,'handled gear disappears from arrival strip at zero cache');assert.equal(await strip.locator('.lamp-empty').count(),5);await strip.getByRole('button',{name:'Reveal equipment',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.lamp-results button').length===1);
  // Disclosed essence fixture checks all tiers; the earned-resource video uses normal draws.
  await page.evaluate(()=>{const save=JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5'));save.lamp.essence=200;save.lamp.capacityTier=0;localStorage.setItem('wishfire.equipment-economy.v5',JSON.stringify(save));});
  await page.reload();await page.locator('canvas').first().waitFor();await page.waitForTimeout(1000);const restartBox=await page.locator('canvas').first().boundingBox();await page.mouse.click(restartBox.x+restartBox.width/2,restartBox.y+426*restartBox.width/360);await strip.locator('.lamp-tier-badge').waitFor();await strip.locator('.lamp-tier-badge').click();
  assert.equal(await dialog.getAttribute('aria-label'),'Lamp upgrades');assert.equal(await dialog.locator('.lamp-odds tbody tr').count(),5);
  const beforeUpgrade=await page.evaluate(()=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')));
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.guide),7,'reload retains completed guidance without rewards');assert.equal(await page.locator('.lamp-reward-banner').count(),0);await guideIdle(page);await page.locator('.lamp-idle-helper').waitFor();assert.equal(await page.locator('.lamp-idle-helper').getAttribute('data-target'),'upgrade');await guideBounds(page);await page.screenshot({path:`${directory}/${width}-guide-affordable.png`});
  for(let tier=0;tier<3;tier++){
   const sums=await dialog.locator('.lamp-odds tbody').evaluate(n=>[1,2].map(column=>[...n.rows].reduce((sum,row)=>sum+parseFloat(row.cells[column].textContent),0)));assert.deepEqual(sums,[100,100]);
   await dialog.locator('[data-action="upgrade"]').dblclick();await page.waitForFunction(t=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.capacityTier===t+1,tier);
  }
  await dialog.getByText('Lamp Lv. 4 · MAX',{exact:true}).waitFor();assert.equal(await dialog.getByRole('button',{name:'MAX',exact:true}).isEnabled(),false);
  const afterUpgrade=await page.evaluate(()=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')));assert.equal(afterUpgrade.lamp.essence,30);assert.deepEqual(afterUpgrade.items,beforeUpgrade.items);assert.equal(afterUpgrade.partyEXP,beforeUpgrade.partyEXP);
  const upgradeContainment=await dialog.evaluate(d=>{const r=d.getBoundingClientRect();return{overflow:d.scrollWidth>d.clientWidth,inViewport:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight};});assert.deepEqual(upgradeContainment,{overflow:false,inViewport:true});await page.screenshot({path:`${directory}/${width}-upgrade-max-fixture.png`});await guideIdle(page);await page.locator('.lamp-idle-helper').waitFor();assert.equal(await page.locator('.lamp-idle-helper').getAttribute('data-target'),'close');await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await guideIdle(page);assert.equal(await page.locator('.lamp-idle-helper').isVisible(),false,'completed upgrade loop stops strip guidance');
  await page.keyboard.press('Escape');
  assert.deepEqual(errors,[]);report.push({width,height,dpr,expectedPreview,preview,navigation,closePoint,closeHit,geometry,lampPaint,stripBalance,emission,queueGeometry,containment,errors});await context.close();
  // Disclosed six-item fixture stresses concurrent receipt layout without timing claims.
  const rapidFixture=createLampEconomy(43,1000);for(let n=0;n<6;n++)activateLamp(rapidFixture,{region:1,stage:1},n*2000);
  const rapidContext=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr}),rapidPage=await rapidContext.newPage();
  await rapidPage.addInitScript(({save,heroes})=>{localStorage.setItem('wishfire.equipment-economy.v5',JSON.stringify(save));localStorage.setItem('orka.hero_progress.v2',JSON.stringify(heroes));},{save:rapidFixture,heroes:heroSave});
  await rapidPage.goto(url);await rapidPage.waitForTimeout(2000);const rc=await rapidPage.locator('canvas').first().boundingBox();await rapidPage.mouse.click(rc.x+rc.width/2,rc.y+426*rc.width/360);
  await rapidPage.locator('#wishfire-lamp .lamp-collect').click();const rd=rapidPage.locator('#lamp-dialog');await rd.waitFor();
  for(let n=0;n<6;n++){const [hero,name]=n%2?['Huun','Hondo']:['Falie','Fara'],count=await rapidPage.locator('.lamp-cp-feedback[data-hero="'+hero+'"]').count();await rd.getByRole('button',{name:'Choose '+name,exact:true}).click();await rd.getByRole('button',{name:'Equip',exact:true}).click();await rapidPage.waitForFunction(({hero,count})=>document.querySelectorAll('.lamp-cp-feedback[data-hero="'+hero+'"]').length>count,{hero,count});}
  await rapidPage.waitForTimeout(300);await rapidPage.screenshot({path:`${directory}/${width}-rapid-receipts.png`});
  const rapidBounds=await rapidPage.evaluate(async()=>{const frames=[];for(let n=0;n<12;n++){await new Promise(requestAnimationFrame);frames.push([...document.querySelectorAll('.lamp-cp-feedback')].map(e=>{const r=e.getBoundingClientRect();return{hero:e.dataset.hero,text:e.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));}return frames;});report.at(-1).rapidBounds=rapidBounds;
  for(const frame of rapidBounds){assert.equal(frame.length,6);for(const r of frame)assert.ok(r.left>=0&&r.right<=width+.5&&r.top>=0&&r.bottom<=height+.5,'rapid CP text stays inside viewport');for(let a=0;a<frame.length;a++)for(let b=a+1;b<frame.length;b++){const x=frame[a],y=frame[b];assert.ok(x.right<=y.left||y.right<=x.left||x.bottom<=y.top||y.bottom<=x.top,'rapid saved CP receipts do not overlap');}}
  await rapidContext.close();
 }}finally{await browser.close();server?.kill();await writeFile(`${directory}/report.json`,JSON.stringify(report,null,2));}
});
