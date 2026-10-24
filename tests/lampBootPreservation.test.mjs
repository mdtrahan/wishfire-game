import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {trustFixture} from './fixtures/lampTrust.mjs';
const require=createRequire(import.meta.url),{detectChromeExecutable}=require('../tools/playwright_support.js');
const keys=['wishfire.equipment-economy.v5','orka.hero_progress.v2','orka.combat_progression.v1','wishfire.equipment-economy.v5.before-bag-upgrades','wishfire.qa.reset-backup.v1','wishfire.gold.v1'];
test('no-action baseline and candidate boot preserve protected save fields',{skip:!process.env.LAMP_BASELINE_URL||!process.env.LAMP_QA_URL},async()=>{
 const browser=await chromium.launch({headless:true,executablePath:detectChromeExecutable()}),report=[];
 try{for(const scenario of ['mixed','kaja']){
  const fixture=trustFixture(scenario);fixture.save.lamp.lastActivationAt=2000000000000;const snapshots=[];
  for(const url of [process.env.LAMP_BASELINE_URL,process.env.LAMP_QA_URL]){
   const context=await browser.newContext(),page=await context.newPage();
   try{
    await page.addInitScript(({save,heroes})=>{localStorage.setItem('wishfire.equipment-economy.v5',JSON.stringify(save));localStorage.setItem('orka.hero_progress.v2',JSON.stringify(heroes));for(const key of ['wishfire.equipment-economy.v5.before-bag-upgrades','wishfire.qa.reset-backup.v1'])localStorage.setItem(key,'preserve-this-existing-backup');localStorage.setItem('wishfire.gold.v1','17');},fixture);
    await page.goto(url);await page.waitForFunction(()=>window.__codexGame?.globals.Equipment&&typeof window.render_game_to_text==='function');
    snapshots.push(await page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),keys));
   }finally{await context.close();}
  }
  const [baseline,candidate]=snapshots,allowed=['pending','discarded','disposalRequested','reviewHold','guide','conveyorActiveMs'];
  const equipment=snapshots.map(s=>JSON.parse(s[keys[0]])),queueDifferences={};
  for(const key of allowed){if(JSON.stringify(equipment[0].lamp[key])!==JSON.stringify(equipment[1].lamp[key]))queueDifferences[key]=equipment.map(s=>s.lamp[key]);for(const record of equipment)delete record.lamp[key];}
  for(const record of equipment)for(const emission of record.lamp.emissions||[])delete emission.issuedActiveMs;
  assert.deepEqual(equipment[1],equipment[0],'protected equipment fields differ from unchanged main');
  for(const key of keys.slice(1))assert.equal(candidate[key],baseline[key],key+' differs from unchanged main');
  report.push({scenario,queueDifferences,protectedKeys:keys,pass:true});
 }}finally{await browser.close();const dir=process.env.LAMP_TRUST_OUTPUT||'test-results/lamp-trust';await mkdir(dir,{recursive:true});await writeFile(`${dir}/boot-preservation.json`,JSON.stringify(report,null,2));}
});
