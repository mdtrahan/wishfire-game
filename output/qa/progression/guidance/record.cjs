const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const out=__dirname;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:chromium.executablePath()});
 const context=await browser.newContext({viewport:{width:360,height:640},deviceScaleFactor:1,recordVideo:{dir:out,size:{width:360,height:640}}});
 const page=await context.newPage(),errors=[],events=[];page.on('pageerror',e=>errors.push(e.message));
 let started=Date.now();
 const read=()=>page.evaluate(()=>({economy:JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')),heroes:JSON.parse(localStorage.getItem('orka.hero_progress.v2'))}));
 const progress=s=>Object.entries(s.heroes?.heroes||{}).map(([id,h])=>[id,h.currentLevel,h.currentEXP,h.EXPToNextLevel,h.lampEXPClaimed]);
 const draw=async label=>{const before=(await read()).economy;await strip.getByRole('button',{name:'Reveal equipment',exact:true}).click();await page.waitForFunction(seq=>JSON.parse(localStorage.getItem('wishfire.equipment-economy.v5')).lamp.sequence===seq+1,before.lamp.sequence);await mark(label);await page.waitForTimeout(2100);};
 const mark=async(label)=>{events.push({at:(Date.now()-started)/1000,label,state:await read()});await fs.writeFile(out+'/guidance-events.json',JSON.stringify({url:page.url(),viewport:[360,640,1],tuning:'preserved foundation: manual2s/Auto5s, current EXP curve; prices20/50/100 provisional',events,errors},null,2));console.log(label);};
 const strip=page.locator('#wishfire-lamp'),dialog=page.locator('#lamp-dialog');
 const hint=async target=>{await page.waitForTimeout(15500);const helper=page.locator('.lamp-idle-helper');await helper.waitFor();assert.equal(await helper.getAttribute('data-target'),target);await mark('Natural idle guide: '+target);await page.screenshot({path:out+'/guide-'+target+'.png'});};
 try{
  await page.goto('http://localhost:8032/');await page.waitForTimeout(1200);
  const box=await page.locator('canvas').first().boundingBox();started=Date.now();
  await page.mouse.click(box.x+box.width/2,box.y+426*box.width/360);
  await strip.getByRole('button',{name:'Reveal equipment',exact:true}).waitFor();await mark('Fresh combat: empty cache and Lv1 heroes; no injected save');
  await hint('generate');await page.waitForTimeout(14500);const idle=await read();assert.equal(idle.economy.lamp.sequence,0);assert.equal(idle.economy.partyEXP,0);assert.equal(idle.economy.items.length,0);for(const id of ['Falie','Huun','Runa','Kojonn'])assert.ok(idle.heroes.heroes[id]);for(const hero of Object.values(idle.heroes.heroes)){assert.equal(hero.currentLevel,1);assert.equal(hero.currentEXP,0);assert.equal(hero.lampEXPClaimed,0);}await mark('Thirty seconds untouched: four Lv1 heroes, no item or EXP');
  for(let n=0;n<20;n++)await draw('Normal draw '+(n+1));
  await hint('collect');await strip.locator('.lamp-collect').click();await dialog.waitFor();await mark('Complete descending-CP twenty-item review');await hint('Huun');await dialog.getByRole('button',{name:'Choose Hondo',exact:true}).click();assert.equal(await page.locator('.lamp-idle-helper').isVisible(),false);await mark('Any input dismisses guidance; actual hero comparison recorded');await hint('auto-equip');
  await dialog.getByRole('button',{name:'Auto-Equip',exact:true}).click();await page.waitForTimeout(2200);await mark('Auto Equip commits up to four upgrades; remaining gear enters dismantling');
  await hint('dismantle');await dialog.getByRole('button',{name:'Dismantle All',exact:true}).click();await page.locator('.lamp-reward-banner').waitFor();await mark('Dismantle conversion awards earned essence');await page.screenshot({path:out+'/upgrade-earned-essence-360.png'});await page.waitForTimeout(3600);
  await hint('lamp-upgrades');await strip.locator('.lamp-tier-badge').click();await dialog.waitFor();await mark('Free upgrade preview completes once without changing gear, EXP or essence');await hint((await read()).economy.lamp.essence>=20?'upgrade':'close');await dialog.locator('[data-action="close"]').click();
  let state=await read();const shortfall=Math.max(0,20-state.economy.lamp.essence);
  if(shortfall){for(let n=0;n<shortfall;n++)await draw('Additional earned draw '+(n+1));await strip.locator('.lamp-collect').click();await dialog.locator('[data-action="finish"]').click();await dialog.getByRole('button',{name:'Dismantle All',exact:true}).click();await page.waitForTimeout(3600);await mark('Additional batch closes the upgrade shortfall');}
  const before=await read();assert.ok(before.economy.lamp.essence>=20);
  await hint('lamp-upgrades');await strip.locator('.lamp-tier-badge').click();await mark('Affordable upgrade preview; earned gear and hero EXP preserved');await page.screenshot({path:out+'/upgrade-affordable-360.png'});await page.waitForTimeout(2000);
  await hint('upgrade');await dialog.locator('[data-action="upgrade"]').dblclick();await page.waitForTimeout(1500);
  const after=await read();assert.equal(after.economy.lamp.capacityTier,1);assert.equal(after.economy.lamp.essence,before.economy.lamp.essence-20);assert.equal(after.economy.partyEXP,before.economy.partyEXP);assert.deepEqual(after.economy.items,before.economy.items);assert.deepEqual(progress(after),progress(before));
  assert.match(await dialog.innerText(),/Cost 50/);await mark('Repeated confirmation spends20 once, LampLv2/capacity30 and next cost50');await page.screenshot({path:out+'/upgrade-confirmed-360.png'});await page.waitForTimeout(2500);
  await page.reload();await page.waitForTimeout(1000);const box2=await page.locator('canvas').first().boundingBox();await page.mouse.click(box2.x+box2.width/2,box2.y+426*box2.width/360);await strip.locator('.lamp-tier-badge').waitFor();await strip.locator('.lamp-tier-badge').click();await page.waitForTimeout(1500);
  const restored=await read();assert.equal(restored.economy.lamp.capacityTier,1);assert.equal(restored.economy.lamp.essence,after.economy.lamp.essence);assert.deepEqual(restored.economy.items,after.economy.items);assert.equal(restored.economy.partyEXP,after.economy.partyEXP);
  assert.equal(restored.economy.lamp.guide,7);assert.equal(await page.locator('.lamp-reward-banner').count(),0);await mark('Reload retains completed guidance, tier, balance, earned gear and cumulative EXP without tutorial rewards');await page.screenshot({path:out+'/upgrade-reloaded-360.png'});await page.waitForTimeout(1800);assert.deepEqual(errors,[]);
 }catch(e){await page.screenshot({path:out+'/upgrade-failure.png'});await mark('FAILED: '+e.message);throw e;}
 finally{const video=page.video();await context.close();await video.saveAs(out+'/lamp-guidance-earned-flow.webm');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
