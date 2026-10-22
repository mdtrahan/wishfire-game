import {test} from 'node:test';
import {createRequire} from 'node:module';
const {detectChromeExecutable}=createRequire(import.meta.url)('../tools/playwright_support.js');
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';

// The dev leader select only overrides Formation while its checkbox is ticked; panel edits and Reset never do.
test('dev movement panel overrides the Formation leader only when explicitly enabled',async()=>{
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
   window.qa={leader:()=>tuning.resolveCombatMovementTuning(state.globals).leaderName,saved:()=>JSON.parse(store.get(tuning.COMBAT_MOVEMENT_TUNING_STORAGE_KEY))};
  });
  const toggle=page.locator('[data-devtool-movement-leader-override]'),select=page.locator('[data-devtool-movement-leader]'),leader=()=>page.evaluate(()=>window.qa.leader());
  assert.equal(await toggle.isChecked(),false,'a pre-flag saved leader loads unticked');
  assert.equal(await select.isDisabled(),true);
  assert.equal(await leader(),'Runa','Formation leads despite the saved dev leader name');
  await page.locator('[data-devtool-movement-key=heroOverlap]').fill('0.75');
  assert.equal(await leader(),'Runa','moving a slider never overrides Formation');
  await toggle.check();
  assert.equal(await select.isDisabled(),false);
  await select.selectOption('Kaja');
  assert.equal(await leader(),'Kaja');
  assert.deepEqual((({leaderName,leaderOverride})=>({leaderName,leaderOverride}))(await page.evaluate(()=>window.qa.saved())),{leaderName:'Kaja',leaderOverride:true},'the override persists under the dev key');
  await toggle.uncheck();
  assert.equal(await leader(),'Runa');
  await toggle.check();await page.locator('[data-devtool-movement-reset]').click();
  assert.equal(await toggle.isChecked(),false,'Reset returns to Formation');
  assert.equal(await select.isDisabled(),true);
  assert.equal(await leader(),'Runa');
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();server.kill();}
});
