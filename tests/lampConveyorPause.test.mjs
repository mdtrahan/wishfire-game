import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{detectChromeExecutable}=require('../tools/playwright_support.js');
const directory=process.env.LAMP_QA_OUTPUT||'test-results/lamp-pause';
const fixture=`<!doctype html><base href="/web-runner/"><link rel="stylesheet" href="/web-runner/assets/lampEquipmentUI.css">
<section id="wishfire-lamp" style="left:0;top:0;width:360px;height:92px;font-size:11px"></section>
<script type="module">
import {updateLampConveyor} from '/web-runner/systems/lampConveyorPresentation.mjs';
import {createLampEconomy,generateLampItem} from '/web-runner/src/core/lampGear.mjs';
const strip=document.querySelector('#wishfire-lamp'),data=createLampEconomy(42);
data.lamp.conveyorActiveMs=100000;
data.lamp.emissions=[];
for(const age of [13000,8000,3000])data.lamp.emissions.push({item:generateLampItem(42,data.lamp.sequence++,0),issuedAt:100000-age,issuedActiveMs:100000-age,collected:false});
window.renderConveyor=(paused=true,advance=0)=>{data.lamp.conveyorActiveMs+=advance;updateLampConveyor({strip,data,heroes:[],now:100000,paused,gearBounds:Array(9),tile:item=>'<button class="lamp-tile" data-id="'+item.instanceId+'"><span class="lamp-art"></span></button>'});};
window.conveyorSnapshot=()=>[...strip.querySelectorAll('.lamp-conveyor-item')].map(n=>({id:n.dataset.id,x:n.getBoundingClientRect().x,time:n.getAnimations()[0]?.currentTime,delay:n.style.animationDelay,arrived:n.dataset.arrived==='true'}));
window.renderConveyor();window.fixtureReady=true;
</script>`;

test('conveyor keeps active-time positions through repeated modal pauses and hidden menu returns',async()=>{
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const url=`http://localhost:${port}/conveyor-pause-fixture.html`,server=spawn(process.execPath,['tools/serve_web.js','--port',String(port)],{stdio:'ignore'});
 const browser=await chromium.launch({headless:true,executablePath:detectChromeExecutable()});
 const report=[];
 try{
  for(let n=0;n<50;n++){try{if((await fetch(`http://localhost:${port}/web-runner/index.html`)).ok)break;}catch{}if(n===49)throw Error('Conveyor server did not start');await delay(100);}
  for(const [width,height,dpr] of [[360,640,1],[216,384,2],[233,452,2],[316,452,2]]){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr});
   try{
    await page.route('**/conveyor-pause-fixture.html',route=>route.fulfill({contentType:'text/html',body:fixture.replace('width:360px',`width:${width}px`)}));
    await page.goto(url);await page.waitForFunction(()=>window.fixtureReady,null,{timeout:5000});
    const initial=await page.evaluate(()=>window.conveyorSnapshot());
    for(let cycle=0;cycle<4;cycle++){
     await page.evaluate(()=>window.renderConveyor(false,400));await delay(60);
     await page.evaluate(()=>window.renderConveyor(true));
     await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
     const paused=await page.evaluate(()=>window.conveyorSnapshot());await delay(80);
     assert.deepEqual(await page.evaluate(()=>window.conveyorSnapshot()),paused,'modal preserves paused positions');
     await page.evaluate(()=>{document.querySelector('#wishfire-lamp').hidden=true;window.renderConveyor(true);});
     await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
     await page.evaluate(()=>{document.querySelector('#wishfire-lamp').hidden=false;window.renderConveyor(true);});
     await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
     const restored=await page.evaluate(()=>window.conveyorSnapshot());
     assert.deepEqual(restored.map(n=>n.id),paused.map(n=>n.id));
     for(let i=0;i<paused.length;i++)assert.ok(Math.abs(restored[i].x-paused[i].x)<.1,`menu return preserves gear position: ${JSON.stringify({cycle,paused,restored})}`);
     assert.ok(restored.every((n,i)=>i===0||n.x<restored[i-1].x),'menu return preserves gear order and spacing');
    }
    const final=await page.evaluate(()=>window.conveyorSnapshot());
    assert.ok(final.every((n,i)=>n.x>initial[i].x),'gear advances across resumed active time');
    assert.equal(new Set(final.map(n=>n.id)).size,3,'menu returns never duplicate gear');
    for(let i=1;i<final.length;i++)assert.ok(Math.abs((final[i-1].x-final[i].x)-(initial[i-1].x-initial[i].x))<.1,'menu cycles preserve the emission gap');
    await page.evaluate(()=>{window.renderConveyor(false);document.querySelector('#wishfire-lamp').hidden=true;window.renderConveyor(true);});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await page.evaluate(()=>{document.querySelector('#wishfire-lamp').hidden=false;window.renderConveyor(true);});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const runningReturn=await page.evaluate(()=>window.conveyorSnapshot());
    assert.ok(runningReturn.every((n,i)=>Math.abs(n.x-final[i].x)<.1),'leaving while running restores the same active positions');
    report.push({width,height,dpr,initial,final});await page.screenshot({path:`${directory}/${width}-resumed.png`});
   }finally{await page.close();}
  }
 }finally{await browser.close();server.kill();await mkdir(directory,{recursive:true});await writeFile(`${directory}/report.json`,JSON.stringify(report,null,2));}
});
