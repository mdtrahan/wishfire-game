import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHeroProgressStore,refreshHeroStats} from '../web-runner/src/core/heroProgression.mjs';
import {createLampEconomy,activateLamp} from '../web-runner/src/core/lampGear.mjs';
const require=createRequire(import.meta.url);
const {detectChromeExecutable}=require('../tools/playwright_support.js');
let url=process.env.LAMP_QA_URL,server;
const directory='test-results/lamp';
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
  const current={...fixture.items[0],instanceId:'owned-Huun',stats:{...fixture.items[0].stats,MAG:fixture.items[0].stats.MAG+1}};fixture.items.push(current);fixture.loadouts.Huun={[current.type]:current.instanceId};
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
  assert.equal(await dialog.locator('.lamp-hero').count(),4);assert.equal(await dialog.locator('thead small').count(),4);assert.equal(await dialog.locator('.lamp-quality-band').count(),1);assert.equal(await dialog.locator('td.positive .lamp-stat-arrow.up').count()>0,true);assert.equal(await dialog.locator('td.positive').first().innerText().then(t=>!t.includes('+')),true);assert.equal(await dialog.locator('tbody tr').count()>0,true);
  const containment=await dialog.evaluate(d=>{const r=d.getBoundingClientRect();return {overflow:d.scrollWidth>d.clientWidth,inViewport:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,columns:[...d.querySelectorAll('.lamp-hero')].every(n=>{const b=n.getBoundingClientRect();return b.left>=r.left&&b.right<=r.right;})};});
  assert.deepEqual(containment,{overflow:false,inViewport:true,columns:true});
  const order=await dialog.evaluate(d=>{const stats=d.querySelector('.lamp-compare').getBoundingClientRect(),item=d.querySelector('.lamp-candidate').getBoundingClientRect(),buttons=d.querySelector('.lamp-actions').getBoundingClientRect();return stats.bottom<=item.top&&item.bottom<=buttons.top;});assert.equal(order,true,'heroes and deltas precede item, confirmation follows it');
  assert.equal(await dialog.locator('.lamp-item-stats dd').count(),Object.keys(fixture.items[0].stats).length);
  assert.deepEqual(await dialog.locator('tbody th').allTextContents(),['HP','ATK','DEF','MAG','RES']);
  assert.deepEqual(await dialog.locator('.lamp-item-stats dt').allTextContents(),['HP','ATK','DEF','MAG','RES']);
  assert.deepEqual(await dialog.locator('.lamp-actions button').allTextContents(),['Skip','Equip','Auto-Equip']);
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
   const result={rows:(frame.height-inset-gap)/size,fiveAcross:tiles.slice(0,5).every(t=>t.y===tiles[0].y)&&tiles[5].y>tiles[0].y,square:(()=>{const r=original[0].querySelector('.lamp-art').getBoundingClientRect();return Math.abs(r.width-r.height)<.1;})(),filled:Math.abs(tiles[4].right-tiles[0].left-(e.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)))<1,stable:e.getBoundingClientRect().height===frame.height&&e.scrollHeight>e.clientHeight};
   return result;
  });
  assert.ok(Math.abs(queueGeometry.rows-1.5)<.01,'cache exposes one and a half rows');
  assert.deepEqual({...queueGeometry,rows:1.5},{rows:1.5,fiveAcross:true,square:true,filled:true,stable:true});
  await dialog.locator('.lamp-queue').screenshot({path:`${directory}/${width}-inventory-expanded.png`});
  await dialog.locator('.lamp-queue [data-qa-clone]').evaluateAll(nodes=>nodes.forEach(n=>n.remove()));
  assert.equal(await dialog.locator('.lamp-candidate .lamp-rarity').innerText(),fixture.items[0].rarity[0].toUpperCase());assert.equal(await strip.locator('.lamp-collect .lamp-rarity').count(),0);
  assert.equal(await dialog.locator('.lamp-stat-paint').evaluateAll(nodes=>nodes.every(c=>Math.abs(c.width/c.getBoundingClientRect().width-devicePixelRatio)<.05&&Math.abs(c.height/c.getBoundingClientRect().height-devicePixelRatio)<.05)),true,'stat backing pixels match display DPR');
  for(const direction of ['up','down']){
   const indicator=dialog.locator('tbody tr').filter({has:page.getByRole('rowheader',{name:'MAG',exact:true})}).locator(direction==='up'?'td.positive .lamp-stat-value':'td.negative .lamp-stat-value').first();
   const split=await indicator.locator('canvas').getAttribute('data-arrow-x'),png=await indicator.screenshot({path:`${directory}/${width}-stat-${direction}.png`});
   const painted=await page.evaluate(async({base64,split,red})=>{
    const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    return [0,1].map(part=>{const rows=[];for(let y=0;y<canvas.height;y++)for(let x=part?split:0;x<(part?canvas.width:split);x++){const i=(y*canvas.width+x)*4,ink=red?pixels[i]>pixels[i+1]+20&&pixels[i]>pixels[i+2]+20&&pixels[i]>90:pixels[i+1]>pixels[i]+20&&pixels[i+1]>pixels[i+2]+8&&pixels[i+1]>90;if(ink){rows.push(y);break;}}return [Math.min(...rows),Math.max(...rows)];});
   },{base64:png.toString('base64'),split:Number(split),red:direction==='down'});
   assert.deepEqual(painted[1],painted[0],direction+' arrow and digit occupy identical painted pixel rows');
  }
  const itemLayout=await dialog.locator('.lamp-item-stats').evaluate(dl=>{
   const values=[...dl.querySelectorAll('dd')],original=values.map(e=>e.textContent),before=values.map(e=>e.getBoundingClientRect().x);
   values.forEach((e,i)=>e.textContent=['1','999','10000','100000','12345'][i]);
   const after=values.map(e=>e.getBoundingClientRect().x),bounds=dl.getBoundingClientRect();
   const result={aligned:Math.abs(before[0]-before[1])<.5&&Math.abs(before[1]-before[3])<.5&&Math.abs(before[2]-before[4])<.5,stable:before.every((x,i)=>Math.abs(x-after[i])<.5),contained:values.every(e=>{const r=e.getBoundingClientRect();return r.right<=bounds.right+.5&&e.scrollWidth<=e.clientWidth;}),font:parseFloat(getComputedStyle(values[0]).fontSize)};
   values.forEach((e,i)=>e.textContent=original[i]);return result;
  });
  assert.equal(itemLayout.aligned,true,'item values share hard left edges');assert.equal(itemLayout.stable,true,'larger numbers preserve left edges');assert.equal(itemLayout.contained,true,'six-digit item values fit');assert.ok(itemLayout.font>=13);
  await page.screenshot({path:`${directory}/${width}-comparison.png`});
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

  await dialog.getByRole('button',{name:'Choose Runa',exact:true}).click();await dialog.getByText('Equip to Runa?',{exact:true}).waitFor();await page.screenshot({path:`${directory}/${width}-selected.png`});await dialog.getByRole('button',{name:'Equip',exact:true}).click();
  const feedback=page.locator('.lamp-cp-feedback').last();await feedback.waitFor();assert.equal(await feedback.getAttribute('data-hero'),'Runa');assert.equal(await dialog.isVisible(),true,'comparison stays open during CP feedback');assert.equal(await feedback.evaluate(e=>e.closest('#lamp-overlay')!==null),true,'CP feedback belongs to its modal');
  const receipt=await feedback.evaluate(e=>({change:Number(e.dataset.change),before:Number(e.dataset.before),after:Number(e.dataset.after)}));assert.equal(receipt.change,Math.round((receipt.after-receipt.before)*10)/10);assert.ok(receipt.change>0,'equipping always raises total CP');assert.equal(await feedback.locator('img').count(),0,'equip feedback floats only the CP value');assert.equal(await feedback.innerText(),'CP '+(receipt.change>0?'+':'')+receipt.change);await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.lamp-cp-feedback')).opacity)>.9);await page.screenshot({path:`${directory}/${width}-cp-feedback.png`});
  await page.waitForFunction(()=>!document.querySelector('.lamp-cp-feedback'));await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await page.locator('.lamp-cp-feedback').count(),0,'float finishes before modal closes');
  let state=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));assert.equal(state.lamp.pending.length,1);assert.equal(state.loadouts.Runa[fixture.items[0].type],fixture.items[0].instanceId);
  await page.reload();await page.waitForTimeout(2000);const reloadCanvas=await page.locator('canvas').first().boundingBox();await page.mouse.click(reloadCanvas.x+reloadCanvas.width/2,reloadCanvas.y+426*reloadCanvas.width/360);await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).quest.phase==='combat');await strip.getByRole('button',{name:'Reveal equipment',exact:true}).waitFor();state=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));assert.equal(state.loadouts.Runa[fixture.items[0].type],fixture.items[0].instanceId);assert.equal(await strip.locator('.lamp-results button').count(),0,'reload restores cache without filling arrival positions');assert.equal(state.lamp.autoEnabled,false);
  await strip.locator('.lamp-collect').click();await dialog.getByRole('button',{name:'Dismantle',exact:true}).click();await dialog.getByText('DISMANTLE ALL',{exact:true}).waitFor();assert.equal(await dialog.getAttribute('aria-label'),'Dismantle All');assert.equal(await dialog.locator('.lamp-queue .lamp-tile').count(),1);assert.equal(await dialog.locator('.lamp-queue button').count(),0,'dismantling items cannot be selected');assert.equal((await dialog.innerText()).includes('Essence'),false,'resource amount appears only after confirmation');assert.equal(await dialog.getByRole('button',{name:'Review again',exact:true}).count(),0);
  const beforeDismantleEXP=await page.evaluate(()=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).partyEXP);await page.screenshot({path:`${directory}/${width}-dismantle-all.png`});await dialog.getByRole('button',{name:'Dismantle All',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.locator('.lamp-reward-banner').getByText('DISMANTLED',{exact:true}).waitFor();assert.equal(await page.locator('.lamp-party-exp').count(),0);assert.equal(await page.locator('.lamp-reward-banner button').count(),0);assert.equal(await page.locator('.lamp-reward-banner img').count(),1);assert.match(await page.locator('.lamp-reward-banner b').innerText(),/^[\d,]+$/);const rewardBounds=await page.locator('.lamp-reward-banner').boundingBox();assert.ok(rewardBounds.x>=0&&rewardBounds.x+rewardBounds.width<=width+.5);assert.ok(rewardBounds.height<height*.3);assert.equal(await page.locator('.lamp-reward-banner').evaluate(n=>getComputedStyle(n).pointerEvents),'none');await page.screenshot({path:`${directory}/${width}-dismantled.png`});await page.locator('.lamp-reward-banner').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).partyEXP),beforeDismantleEXP);state=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));assert.equal(state.lamp.pending.length,0);assert.equal(state.items.length,2);await strip.locator('.lamp-collect').click();assert.equal(await dialog.isVisible(),false,'empty storage never opens a dismantle modal');
  for(let n=0;n<4;n++){
   const lamp=strip.getByRole('button',{name:'Reveal equipment',exact:true});await lamp.click();await page.waitForFunction(expected=>JSON.parse(window.render_game_to_text()).lamp.sequence===expected,n+3);
   if(n===0){assert.equal(await lamp.isDisabled(),true,'lamp is disabled during its emission cooldown');await lamp.evaluate(b=>b.click());await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>JSON.parse(window.render_game_to_text()).lamp.sequence),3,'rapid clicks grant no extra gear or EXP');await page.waitForFunction(()=>!document.querySelector('.lamp-burp').disabled);assert.ok(await lamp.evaluate(()=>Date.now()-JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.lastActivationAt)>=2000,'lamp only re-enables after two seconds');}
  }
  await strip.locator('.lamp-collect').click();
  const ranked=await dialog.locator('.lamp-queue button').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.cp)));assert.ok(ranked.every((n,i)=>!i||ranked[i-1]>=n),'review grid sorts descending item CP');
  const beforeBatch=await page.evaluate(()=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')));await dialog.getByRole('button',{name:'Auto-Equip',exact:true}).click();await page.locator('.lamp-cp-feedback').first().waitFor();await page.waitForFunction(()=>!document.querySelector('.lamp-cp-feedback'));assert.equal(await page.locator('.lamp-cp-feedback').count(),0,'CP feedback completes before advancing review');
  const afterBatch=await page.evaluate(()=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')));assert.equal(afterBatch.lamp.pending.length,0);const recipients=Object.keys(afterBatch.loadouts).filter(id=>JSON.stringify(afterBatch.loadouts[id])!==JSON.stringify(beforeBatch.loadouts[id]));assert.ok(recipients.length>0&&recipients.length<=4);assert.equal(afterBatch.lamp.essence,beforeBatch.lamp.essence);assert.equal(afterBatch.partyEXP,beforeBatch.partyEXP);if(afterBatch.lamp.discarded.length){await dialog.getByText('DISMANTLE ALL',{exact:true}).waitFor();assert.equal((await dialog.innerText()).includes('Essence'),false);}else assert.equal(await dialog.isVisible(),false);await page.screenshot({path:`${directory}/${width}-auto-dismantle.png`});await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  if(afterBatch.lamp.discarded.length){await strip.locator('.lamp-collect').click();await dialog.getByText('DISMANTLE ALL',{exact:true}).waitFor();assert.equal(await dialog.locator('[data-action="equip"],[data-action="queue"]').count(),0);await dialog.getByRole('button',{name:'Dismantle All',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.locator('.lamp-reward-banner').getByText('DISMANTLED',{exact:true}).waitFor();await page.locator('.lamp-reward-banner').waitFor({state:'detached'});}
  assert.equal(await strip.locator('.lamp-results button').count(),0,'handled gear disappears from arrival strip at zero cache');assert.equal(await strip.locator('.lamp-empty').count(),5);await strip.getByRole('button',{name:'Reveal equipment',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.lamp-results button').length===1);
  if(width===360){await strip.locator('.lamp-tier-badge').click();assert.equal(await dialog.getAttribute('aria-label'),'Lamp upgrades');assert.equal(await dialog.locator('.lamp-odds tbody tr').count(),5);await page.keyboard.press('Escape');}
  assert.deepEqual(errors,[]);report.push({width,height,dpr,geometry,stripBalance,emission,queueGeometry,containment,errors});await context.close();
 }}finally{await browser.close();server?.kill();await writeFile(`${directory}/report.json`,JSON.stringify(report,null,2));}
});
