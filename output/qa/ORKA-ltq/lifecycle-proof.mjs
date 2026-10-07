import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { detectChromeExecutable } = require('../../../tools/playwright_support.js');
const responses=[];
const browser=await chromium.launch({headless:true, executablePath:detectChromeExecutable()});
const processSession = await browser.newBrowserCDPSession();
const measureRSS = async () => {
  const processes = (await processSession.send('SystemInfo.getProcessInfo')).processInfo;
  const rss = execFileSync('ps', ['-o', 'rss=', '-p', processes.map(p => p.id).join(',')], { encoding: 'utf8' }).trim().split(/\s+/).reduce((sum, kb) => sum + Number(kb), 0) * 1024;
  return { rssBytes: rss, processes: processes.map(p => ({ pid: p.id, type: p.type })) };
};
const page=await browser.newPage({viewport:{width:405,height:720}});
await page.addInitScript(() => {
  const trace=[]; const original=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(...args){ const src=String(args[0]?.currentSrc||args[0]?.src||''); const fara=window.__codexGame?.state?.entities?.find(a=>a?.name==='Falie'); trace.push({at:performance.now(),src,fara:fara&&{footX:fara.footX,footY:fara.footY,locomotion:fara.locomotion,actionState:fara.actionState,actionStateUntil:fara.actionStateUntil}}); return original.apply(this,args); };
  window.__kk4PuppetTrace=()=>trace.slice(-30000);
});
page.on('response', response => { const url=response.url(); if (url.includes('/assets/puppets/')) responses.push({url,status:response.status()}); });
const errors=[]; page.on('pageerror', error => errors.push(String(error)));
await page.route('**/systems/actorClipPlayback.mjs', async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: (await response.text()).replace('  return load;', '  window.__qaClipLoader = load; return load;') });
});
await page.route('**/systems/actorPuppetPresentation.mjs', async route => {
  const response = await route.fetch();
  await route.fulfill({response, body:(await response.text()).replace('  return {\n    beginFrame()', '  return window.__qaPresentation = {\n    beginFrame()')});
});
await page.goto('http://localhost:8132/web-runner/index.html?devtest=true',{waitUntil:'domcontentloaded'});
await page.waitForFunction(() => window.__codexGame && typeof window.render_game_to_text === 'function');
await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).flags.layout0Ready === true);
const baselineRSS=await measureRSS();
const rssSamples=[];
const box=await page.locator('#view').boundingBox();
await page.mouse.click(box.x+box.width*184.5/360,box.y+box.height*427/640);
await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).flags.layoutId === 'combat');
await page.evaluate(() => { window.__faraSamples=[]; window.__faraSampleTimer=setInterval(()=>{const a=window.__codexGame?.state?.entities?.find(x=>x?.name==='Falie'); if(a) window.__faraSamples.push({at:performance.now(),footX:a.footX,footY:a.footY,locomotion:a.locomotion,actionState:a.actionState,actionStateUntil:a.actionStateUntil});},20); });
const retentionSamples=[];
for(let i=0;i<18;i++) { await page.waitForTimeout(500); retentionSamples.push(await page.evaluate(()=>window.__qaClipLoader?.retention())); rssSamples.push(await measureRSS()); }

await page.evaluate(() => clearInterval(window.__faraSampleTimer));
await page.evaluate(() => window.__codexGame.stepFrames(16));
const runtime=await page.evaluate(() => ({
  viewport: { width:innerWidth, height:innerHeight, dpr:devicePixelRatio, canvas: (()=>{const c=document.querySelector('#view'),r=c.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,backingWidth:c.width,backingHeight:c.height};})() },
  actors:window.__codexGame.state.entities.filter(a=>a?.kind==='hero'||a?.kind==='enemy').map(a=>({uid:a.uid,kind:a.kind,name:a.name,baseHeroName:a.baseHeroName,portraitName:a.portraitName,hp:a.hp,footX:a.footX,footY:a.footY,locomotion:a.locomotion,actionState:a.actionState,actionStateStartedAt:a.actionStateStartedAt,actionImpactAt:a.actionImpactAt,actionStateUntil:a.actionStateUntil})),
  drawTrace:window.__kk4PuppetTrace().filter(entry=>entry.src.includes('/assets/puppets/')), faraSamples:window.__faraSamples,
}));
await page.screenshot({path:'/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-ltq-clip-retention/output/qa/ORKA-ltq/battle.png'});
runtime.drawSources=runtime.drawTrace.map(entry=>entry.src); const report={responses, runtime, errors, retentionSamples, logicalHighWaterBytes: Math.max(...retentionSamples.map(s=>s?.retainedBytes||0)), physicalMemory: { baselineRSS, rssSamples, peakRSSBytes: Math.max(...rssSamples.map(s=>s.rssBytes)), limitation: "Isolated browser process RSS includes app, canvas, JS, decoder and GPU-process allocations. It does not attribute decoded PNG memory or measure GPU texture residency." }}; fs.writeFileSync('/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-ltq-clip-retention/output/qa/ORKA-ltq/battle.json',JSON.stringify(report,null,2)); console.log(JSON.stringify({responses:responses.length,draws:runtime.drawSources.length,drawStates:[...new Set(runtime.drawSources.map(s=>s.split('/').at(-1).replace(/-[0-9]+\.png$/, '')))],errors,logicalHighWaterBytes:report.logicalHighWaterBytes,retention:retentionSamples.at(-1), baselineRSSBytes:baselineRSS.rssBytes, peakRSSBytes:report.physicalMemory.peakRSSBytes},null,2));
await page.getByRole('button', {name:'QUESTS',exact:true}).click();
await page.waitForTimeout(300);
console.log(JSON.stringify(await page.evaluate(()=>({layout:window.__codexGame.state.globals.CurrentLayout, presentation:window.__qaPresentation.retention(), buttons:[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(Boolean).slice(0,20)}))));
await page.screenshot({path:'/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-ltq-clip-retention/output/qa/ORKA-ltq/departure.png'});
const departed=await page.evaluate(()=>({layout:JSON.parse(window.render_game_to_text()).flags.layoutId,retention:window.__qaPresentation.retention()}));
await page.getByRole('button',{name:'Continue Battle',exact:true}).click();
await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).flags.layoutId==='combat');
await page.waitForTimeout(300);
const restored=await page.evaluate(()=>({layout:JSON.parse(window.render_game_to_text()).flags.layoutId,retention:window.__qaPresentation.retention()}));
const pauseBefore=await page.evaluate(()=>{
  window.__codexGame.state.globals.QaScenarioPaused=true;
  const now=window.__codexGame.state.globals.time;
  const actor=window.__codexGame.state.entities.find(a=>a.name==='Falie');
  const puppet=window.__qaPresentation.frameFor(actor,now,'left-wise');
  return {now,src:puppet?.frame?.src, state:puppet?.state};
});
await page.waitForTimeout(500);
const pauseAfter=await page.evaluate(()=>{
  const now=window.__codexGame.state.globals.time;
  const actor=window.__codexGame.state.entities.find(a=>a.name==='Falie');
  const puppet=window.__qaPresentation.frameFor(actor,now,'left-wise');
  return {now,src:puppet?.frame?.src,state:puppet?.state,retention:window.__qaPresentation.retention()};
});
await page.screenshot({path:'/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-ltq-clip-retention/output/qa/ORKA-ltq/restored-paused.png'});
await page.evaluate(()=>{window.__codexGame.state.globals.QaScenarioPaused=false;});
if(departed.retention.displayedActors!==0 || restored.retention.displayedActors===0 || pauseBefore.now!==pauseAfter.now || pauseBefore.src!==pauseAfter.src) throw Error('Lifecycle assertion failed');
const lifecycle={departed,restored,pauseBefore,pauseAfter,errors,fixture:'Only pause uses the existing QaScenarioPaused fixture; departure/restore click ordinary navigation and Continue Battle.'};
fs.writeFileSync('/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-ltq-clip-retention/output/qa/ORKA-ltq/lifecycle.json',JSON.stringify(lifecycle,null,2));
console.log(JSON.stringify(lifecycle));
await browser.close();
