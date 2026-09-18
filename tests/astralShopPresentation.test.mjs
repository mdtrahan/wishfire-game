import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {detectChromeExecutable}=require('../tools/playwright_support.js');
test('shop shader, live shared wallet, back navigation and compact containment',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:detectChromeExecutable()});
 await mkdir('test-results/shop-rainbow',{recursive:true});
 try{for(const [width,height,dpr] of [[216,384,2],[360,640,1],[316,452,1]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(width===360)await page.clock.install();
  await page.goto('http://localhost:8047/web-runner/index.html');
  await page.getByRole('button',{name:'FLOW',exact:true}).waitFor();
  await page.evaluate(async()=>{const {createMarket}=await import('/web-runner/src/core/astralMarket.mjs');const key='wishfire.equipment-economy.v1';const data=JSON.parse(localStorage.getItem(key))||{version:1,loadouts:{},market:createMarket(123,Date.now())};data.gold=5000;data.items=[{instanceId:'test-iron',equipmentId:'iron-sword'},{instanceId:'test-ember',equipmentId:'ember-blade'}];localStorage.setItem(key,JSON.stringify(data));});
  await page.getByRole('button',{name:'FLOW',exact:true}).click();
  const shop=page.locator('#astral-market');await shop.getByLabel('Energy 200 of 200',{exact:true}).waitFor();
  assert.equal(await shop.getByLabel('Resources 150',{exact:true}).count(),1);
  assert.equal(await shop.locator('.rainbow').getAttribute('data-renderer'),'webgl');
  const bannerBounds=await shop.locator('.page-banner').boundingBox();const walletBounds=await shop.locator('.quest-wallet').boundingBox();const shopBounds=await shop.boundingBox();const unit=shopBounds.width/360;assert.ok(Math.abs((walletBounds.x-shopBounds.x)/unit-122)<1&&Math.abs((walletBounds.y-shopBounds.y)/unit-48)<1&&Math.abs(walletBounds.width/unit-230)<1,'shared resource anchors');const streamTop=await shop.locator('.tracks').boundingBox();for(const key of ['x','y','width','height'])assert.ok(Math.abs(streamTop[key]-shopBounds[key])<1,'full-screen stream '+key);
  const geometry=await shop.evaluate(p=>{const r=p.getBoundingClientRect();return {overflow:p.scrollWidth>p.clientWidth,bounds:[...p.querySelectorAll('.back,.balance')].every(n=>{const b=n.getBoundingClientRect();return b.left>=r.left-.5&&b.right<=r.right+.5;})};});assert.equal(geometry.overflow,false);assert.equal(geometry.bounds,true);
  const shader=shop.locator('.rainbow');await shader.evaluate(c=>c.style.zIndex='5');const first=await shader.screenshot();await page.waitForTimeout(200);assert.equal(first.equals(await shader.screenshot()),false,"shader animates");
  const wake=await shader.evaluate(c=>{
   const gl=c.getContext('webgl'),p=gl.getParameter(gl.CURRENT_PROGRAM),points=new Float32Array(32).fill(-10),colors=new Float32Array(48);
   const location=gl.getUniformLocation(p,'lights[0]'),palette=gl.getUniformLocation(p,'colors[0]');
   gl.uniform2fv(location,points);gl.uniform3fv(palette,colors);gl.drawArrays(gl.TRIANGLES,0,3);
   const baseline=new Uint8Array(c.width*c.height*4),lit=new Uint8Array(baseline.length);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,baseline);
   points[0]=.5;points[1]=.5;colors[0]=1;gl.uniform2fv(location,points);gl.uniform3fv(palette,colors);gl.drawArrays(gl.TRIANGLES,0,3);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,lit);
   let ahead=0,behind=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;const change=Math.abs(lit[i]-baseline[i])+Math.abs(lit[i+1]-baseline[i+1])+Math.abs(lit[i+2]-baseline[i+2]);if((y+.5)/c.height<.5)ahead+=change;else behind+=change;}
   return {ahead,behind};
  });assert.equal(wake.ahead,0,'wake never colors pixels ahead of its upper-edge anchor');assert.ok(wake.behind>0,'wake colors pixels behind its anchor');
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);const still=await shader.screenshot();await page.waitForTimeout(150);assert.equal(still.equals(await shader.screenshot()),true,"reduced motion freezes shader");
  await page.emulateMedia({reducedMotion:'no-preference'});await shader.evaluate(c=>c.style.zIndex='');
  await page.screenshot({path:`test-results/shop-rainbow/${width}-${dpr}.png`});
  const drop=await shop.locator('.inspection').boundingBox();const bounds=await shop.boundingBox();assert.ok(drop.height<bounds.height*.1&&drop.y>bounds.y+bounds.height*.85,'compact lower purchase area');
  await page.waitForTimeout(100);const bloomProof=await shader.evaluate(c=>{const gl=c.getContext('webgl'),p=gl.getParameter(gl.CURRENT_PROGRAM);return [...document.querySelectorAll('#astral-market .offer')].slice(0,16).every(card=>Array.from({length:16},(_,i)=>i).some(i=>{const point=gl.getUniform(p,gl.getUniformLocation(p,`lights[${i}]`)),color=gl.getUniform(p,gl.getUniformLocation(p,`colors[${i}]`));const hex=parseInt(card.style.getPropertyValue('--rarity').slice(1),16);return Math.abs(point[0]-(Number(card.style.getPropertyValue('--track'))+.5)/4)<.001&&Math.abs(color[0]-((hex>>16)&255)/255)<.001&&Math.abs(color[1]-((hex>>8)&255)/255)<.001&&Math.abs(color[2]-(hex&255)/255)<.001;}));});assert.equal(bloomProof,true,'shader lights use stream positions and rarity colors');
  const candidate=await shop.locator('.offer').evaluateAll(cards=>{const card=cards.find(c=>{const r=c.getBoundingClientRect(),p=c.parentElement.getBoundingClientRect();return r.top>p.top+p.height*.2&&r.bottom<p.top+p.height*.75;});const r=card.getBoundingClientRect();return {id:card.dataset.offer,x:r.x+r.width/2,y:r.y+r.height/2,price:Number(card.querySelector('.price').textContent.split(' ')[0])};});
  if(width===216){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:candidate.x,y:candidate.y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:drop.x+drop.width/2,y:drop.y+drop.height/2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
  else{await page.mouse.move(candidate.x,candidate.y);await page.mouse.down();await page.mouse.move(drop.x+drop.width/2,drop.y+drop.height/2,{steps:8});await page.mouse.up();}
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v1')).items.some(i=>i.instanceId===id),candidate.id);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v1')).gold),5000-candidate.price);assert.equal(await page.getByRole('dialog').count(),0);
  if(width===360){
   const visible=await shop.locator('.offer').evaluateAll(cards=>cards.find(c=>{const r=c.getBoundingClientRect(),p=c.parentElement.getBoundingClientRect();return r.top>p.top+p.height*.25&&r.bottom<p.top+p.height*.7;}).dataset.offer);
   const target=await shop.locator(`[data-offer="${visible}"]`).boundingBox();await page.mouse.click(target.x+target.width/2,target.y+target.height/2);await shop.locator('[data-buy]').waitFor();
   await page.clock.fastForward(33000);
   await shop.getByText('Drag equipment here to buy. Tap an item for details.',{exact:true}).waitFor();
   assert.equal(await shop.locator('[data-buy]').count(),0,'expired selection returns to default');
   assert.equal(await shop.getByText('Item has passed',{exact:true}).count(),0);
  }
  const back=await shop.locator('.back').boundingBox();const frame=await shop.boundingBox();assert.ok(Math.abs((drop.y-back.y-back.height)/(frame.width/360)-5)<1,'Back sits five reference pixels above tray');
  await shop.getByRole('button',{name:'Back',exact:true}).click();await shop.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'QUESTS',exact:true}).click();await page.locator('#quest-ui').waitFor();
  assert.equal(await page.locator('#quest-ui .quest-wallet').count(),1);const questWallet=await page.locator('#quest-ui .quest-wallet').boundingBox();for(const key of ['x','y','width','height'])assert.ok(Math.abs(questWallet[key]-walletBounds[key])<1,'identical wallet geometry '+key);
  await page.getByRole('button',{name:'HERO',exact:true}).click();await page.locator('#hero-details').getByRole('button',{name:'GEAR',exact:true}).click();
  await page.locator('.equipment-grid .gear-upgrade').first().waitFor();assert.ok(await page.locator('.equipment-grid .gear-upgrade').count()>0);assert.equal(await page.locator('.equipment-grid .equipment-tile').count(),3);
  await page.screenshot({path:`test-results/shop-rainbow/${width}-${dpr}-inventory.png`});assert.deepEqual(errors,[]);await context.close();
 }}finally{await browser.close();}
});
