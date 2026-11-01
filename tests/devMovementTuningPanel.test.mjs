import {test} from 'node:test';
import {createRequire} from 'node:module';
const {detectChromeExecutable}=createRequire(import.meta.url)('../tools/playwright_support.js');
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';

// Retired leader saves cannot restore controls or influence the neutral party anchor.
test('dev movement panel discards saved leader choices while retaining numeric tuning',async()=>{
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const server=spawn(process.execPath,['tools/serve_web.js','--port',String(port),'--host','127.0.0.1'],{stdio:'ignore'}),base=`http://127.0.0.1:${port}`;let browser;
 try{
  for(let n=0;n<50;n++){try{if((await fetch(base+'/web-runner/index.html')).ok)break;}catch{}if(n===49)throw Error('server did not start');await delay(100);}
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||detectChromeExecutable()});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__movement-panel-qa',route=>route.fulfill({contentType:'text/html',body:`<base href="${base}/web-runner/"><div id="host"></div>`}));
  await page.goto(base+'/__movement-panel-qa');
  await page.evaluate(async()=>{
   const panel=await import('./systems/devMovementTuningPanel.mjs'),tuning=await import('./src/core/combatMovementTuning.mjs');
   const store=new Map([[tuning.COMBAT_MOVEMENT_TUNING_STORAGE_KEY,JSON.stringify({heroOverlap:0.5,leaderName:'Hondo'})]]);
   const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
   const state={globals:{HeroFormationLeader:'Runa',DevMovementTuning:panel.loadCombatMovementTuning(storage)}};
   panel.mountCombatMovementTuningPanel({container:document.querySelector('#host'),state,storage});
   window.qa={tuning:()=>tuning.resolveCombatMovementTuning(state.globals),saved:()=>JSON.parse(store.get(tuning.COMBAT_MOVEMENT_TUNING_STORAGE_KEY))};
  });
  assert.equal(await page.locator('[data-devtool-movement-leader-override],[data-devtool-movement-leader]').count(),0);
  assert.doesNotMatch(await page.locator('fieldset').innerText(),/leader|formation/i);
  const tuning=await page.evaluate(()=>window.qa.tuning());
  assert.equal(tuning.heroOverlap,0.5);assert.equal('leaderName' in tuning,false);assert.equal('leaderOverride' in tuning,false);
  await page.locator('[data-devtool-movement-key=heroOverlap]').fill('0.75');
  const saved=await page.evaluate(()=>window.qa.saved());
  assert.equal(saved.heroOverlap,0.75);assert.equal('leaderName' in saved,false);assert.equal('leaderOverride' in saved,false);
  await page.locator('[data-devtool-movement-reset]').click();
  assert.equal((await page.evaluate(()=>window.qa.saved())).heroOverlap,0.25);
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();server.kill();}
});
