const {chromium}=require('playwright');
const fs=require('node:fs/promises'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const {createLampEconomy,generateLampItem}=await import(pathToFileURL(path.resolve('web-runner/src/core/lampGear.mjs')));
 const {createHeroProgressStore}=await import(pathToFileURL(path.resolve('web-runner/src/core/heroProgression.mjs')));
 const economy=createLampEconomy(43);
 const items=['hat','body','boots'].map((slot,index)=>{
  const level=[1,7,12][index];
  const item=Array.from({length:50},(_,n)=>generateLampItem(43,n,level-1)).find(i=>i.type===slot);
  assert.ok(item);return {...item,instanceId:'layout:'+slot,sequence:index,stats:Object.fromEntries(Object.keys(item.stats).map(k=>[k,k==='MAG'&&slot==='hat'?3:0]))};
 });
 economy.items=items;economy.lamp.sequence=3;economy.loadouts.Falie=Object.fromEntries(items.map(i=>[i.type,i.instanceId]));
 const browser=await chromium.launch({headless:true}),report=[];
 try{for(const [width,height,dpr]of [[360,640,1],[216,384,2],[233,452,2],[316,452,2]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,...(width===360?{recordVideo:{dir:__dirname,size:{width,height}}}:{})});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.addInitScript(({economy,heroes})=>{localStorage.setItem('wishfire.equipment-economy.v5',JSON.stringify(economy));localStorage.setItem('orka.hero_progress.v2',JSON.stringify(heroes));},{economy,heroes:createHeroProgressStore()});
   await page.goto('http://localhost:8035/');await page.waitForTimeout(2000);
   const c=await page.locator('canvas').first().boundingBox();await page.mouse.click(c.x+c.width/2,c.y+426*c.width/360);
   await page.locator('#wishfire-lamp').waitFor();const before=await page.evaluate(()=>localStorage.getItem('wishfire.equipment-economy.v5'));
   await page.getByRole('button',{name:'HERO',exact:true}).click();const panel=page.locator('#hero-details');
   await panel.locator('.gear-slot').first().waitFor();assert.equal(await panel.getByRole('button',{name:'Back',exact:true}).count(),0);assert.equal(await panel.getAttribute('data-tab'),'gear');
   assert.deepEqual(await panel.locator('.gear-slot>small').allTextContents(),['Hat · Lv. 1','Body · Lv. 7','Boots · Lv. 12']);
   assert.equal(await panel.locator('.power-bar').innerText(),'ATK 7\nHP 75'); // Fara's ATK/MAG tie displays ATK.
   for(const slot of ['hat','body','boots']){
    await panel.locator(`[data-slot=${slot}]`).click();
    assert.equal(await panel.locator('.gear-slot[aria-pressed=true]').count(),1);
    assert.equal(await panel.locator('.pane h2').innerText(),items.find(i=>i.type===slot).name);
   }
   const geometry=await panel.evaluate(e=>{
    const box=n=>{const r=n.getBoundingClientRect();return [r.x,r.y,r.width,r.height];};
    const host=box(e),nav=box(document.querySelector('#game-meta-nav'));
    const targets=[...e.querySelectorAll('.gear-slot,.tabs button,.roster button')].filter(n=>!n.closest('.roster')||n.getAttribute('aria-pressed')==='true');
    return {viewport:[innerWidth,innerHeight,devicePixelRatio],canvas:box(document.querySelector('canvas')),host,nav,targets:targets.map(n=>({label:n.getAttribute('aria-label')||n.textContent,box:box(n)})),overflow:e.scrollWidth>e.clientWidth};
   });
   assert.equal(geometry.overflow,false);
   for(const t of geometry.targets){const [x,y,w,h]=t.box;assert.ok(x>=geometry.host[0]-.5&&x+w<=geometry.host[0]+geometry.host[2]+.5,t.label+' horizontal containment');assert.ok(y>=geometry.host[1]-.5&&y+h<=geometry.nav[1]+.5,t.label+' above navigation');}
   const cards=geometry.targets.slice(0,3);for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++){const [x,y,w,h]=cards[i].box,[a,b,c,d]=cards[j].box;assert.ok(x+w<=a||a+c<=x||y+h+8<=b||b+d+8<=y,'gear cards plus focus ring must remain separate');}
   await page.screenshot({path:path.join(__dirname,width+'-gear.png')});
   for(const [name,power]of [['Hondo','ATK 16'],['Runa','MATK 16'],['Kaja','MATK 9']]){
    await panel.getByRole('button',{name:'Inspect '+name,exact:true}).first().click();await page.waitForFunction(power=>document.querySelector('#hero-details .power-bar')?.textContent.startsWith(power),power,{timeout:3000});
    assert.equal(await panel.locator('[data-slot=hat]').innerText(),'Hat\nEmpty');
   }
   await page.screenshot({path:path.join(__dirname,width+'-magic.png')});
   await panel.getByRole('button',{name:'HERO',exact:true}).click();await panel.getByRole('progressbar',{name:'Level EXP'}).waitFor();assert.ok((await panel.locator('.pane').innerText()).includes('0 / 100 EXP'));
   const titleClear=await panel.locator('.identity').evaluate(e=>e.querySelector('.hero-portrait').getBoundingClientRect().top>=e.querySelector('p:last-of-type').getBoundingClientRect().bottom-.5);assert.equal(titleClear,true,'non-Gear portrait clears CP title');
   await panel.getByRole('button',{name:'View skills',exact:true}).click();await panel.locator('.pane article').first().waitFor();assert.ok((await panel.locator('.pane').innerText()).includes('Basic Attack'));
   await panel.getByRole('button',{name:'GEAR',exact:true}).click();await panel.locator('.gear-slot').first().waitFor();
   assert.equal(await page.evaluate(()=>localStorage.getItem('wishfire.equipment-economy.v5')),before);assert.deepEqual(errors,[]);
   await page.locator('#game-meta-nav').getByRole('button',{name:'VAULT',exact:true}).click();await panel.waitFor({state:'hidden'});
   await page.locator('#game-meta-nav').getByRole('button',{name:'HERO',exact:true}).click();await panel.locator('.gear-slot').first().waitFor();
   report.push({width,height,dpr,geometry,powerCases:['ATK tie','ATK greater','MATK greater'],navigation:true,ownedStateUnchanged:true,errors});
  }catch(e){await page.screenshot({path:path.join(__dirname,width+'-failure.png')});throw e;}
  finally{await context.close();}
 }}finally{await browser.close();await fs.writeFile(path.join(__dirname,'report.json'),JSON.stringify({fixture:'Staged owned levels 1/7/12; Hat MAG+3 and other empty stats create an ATK/MAG tie. Layout/inspection proof only.',report},null,2)+'\n');}
 console.log(JSON.stringify(report.map(r=>({width:r.width,height:r.height,power:r.powerCases,unchanged:r.ownedStateUnchanged}))));
})().catch(e=>{console.error(e);process.exitCode=1});
