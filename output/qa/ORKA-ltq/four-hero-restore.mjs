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
  CanvasRenderingContext2D.prototype.drawImage=function(...args){ const src=String(args[0]?.currentSrc||args[0]?.src||''); const fara=window.__codexGame?.state?.entities?.find(a=>a?.name==='Falie'); trace.push({at:performance.now(),src,fara:fara&&{footX:fara.footX,footY:fara.footY,locomotion:fara.locomotion,hp:fara.hp,actionState:fara.actionState,actionStateUntil:fara.actionStateUntil}}); return original.apply(this,args); };
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
let deferLive = true;
const deferred = [];
await page.route('**/puppets/fara/frames/*.png', route => {
  if (deferLive && !route.request().url().includes('/defeated-')) deferred.push(() => route.continue());
  else return route.continue();
});
await page.route('**/systems/questCombatSession.mjs', async route => {
  const response=await route.fetch();
  await route.fulfill({response, body:(await response.text()).replace('resetActorPresentationAfterRestore(hero, now);','resetActorPresentationAfterRestore(hero, now); (window.__qaRestoreEvents ||= []).push({uid:hero.uid,hp:hero.hp,cue:hero.actionState ?? null,locomotion:hero.locomotion,now});')});
});
await page.goto('http://localhost:8132/web-runner/index.html?devtest=true',{waitUntil:'domcontentloaded'});
await page.waitForFunction(() => window.__codexGame && typeof window.render_game_to_text === 'function');
await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).flags.layout0Ready === true);
const baselineRSS=await measureRSS();
const rssSamples=[];
const box=await page.locator('#view').boundingBox();
await page.mouse.click(box.x+box.width*184.5/360,box.y+box.height*427/640);
await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).flags.layoutId === 'combat');

// Let the normal entry fade complete before arranging the frozen KO fixture.
await page.waitForTimeout(700);
await page.evaluate(()=>{
  const state=window.__codexGame.state;
  state.globals.QaScenarioPaused=true;
  for(const hero of state.entities.filter(a=>a.kind==='hero')) { hero.hp=0;hero.isAlive=false;hero.actionState='ko';hero.actionStateStartedAt=state.globals.time-2;hero.actionStateUntil=state.globals.time+100; }
});
await page.waitForFunction(()=>window.__kk4PuppetTrace().some(d=>d.src.includes('/fara/frames/defeated-')));
const terminal=await page.evaluate(()=>({now:window.__codexGame.state.globals.time,koSources:[...new Set(window.__kk4PuppetTrace().filter(d=>d.src.includes('/fara/frames/defeated-')).map(d=>d.src))],heroes:window.__codexGame.state.entities.filter(a=>a.kind==='hero').map(a=>({uid:a.uid,hp:a.hp,cue:a.actionState,cueStartedAt:a.actionStateStartedAt})),retention:window.__qaPresentation.retention(),koDraws:window.__kk4PuppetTrace().filter(d=>d.src.includes('/fara/frames/defeated-')).length}));
await page.screenshot({path:new URL('four-ko.png', import.meta.url).pathname});
await page.evaluate(()=>{ window.__qaRestoreEvents=[];window.__codexGame.state.globals.QaScenarioPaused=false; });
await page.waitForFunction(()=>window.__codexGame.state.entities.filter(a=>a.kind==='hero').every(a=>a.hp>0));
await page.evaluate(()=>{window.__codexGame.state.globals.QaScenarioPaused=true;});
const restored=await page.evaluate(()=>{
  const state=window.__codexGame.state,hero=state.entities.find(a=>a.name==='Falie');
  const frame=window.__qaPresentation.frameFor(hero,state.globals.time,'left-wise');
  return {heroes:state.entities.filter(a=>a.kind==='hero').map(a=>({uid:a.uid,hp:a.hp,maxHP:a.maxHP,cue:a.actionState ?? null})),normalRestoreEvents:window.__qaRestoreEvents,pendingPresentation:frame && {state:frame.state,src:frame.frame.src},retention:window.__qaPresentation.retention(),incorrectKoDraws:window.__kk4PuppetTrace().filter(d=>d.src.includes('/fara/frames/defeated-') && d.fara?.hp>0)};
});
if(restored.heroes.length!==4 || restored.normalRestoreEvents.length!==4 || restored.pendingPresentation!==null || restored.incorrectKoDraws.length) throw Error('Actual coupled restore boundary failed');
await page.screenshot({path:new URL('four-restored-pending.png', import.meta.url).pathname});
deferLive=false; await Promise.all(deferred.splice(0).map(release=>release()));
await page.waitForFunction(()=>{const state=window.__codexGame.state,a=state.entities.find(a=>a.name==='Falie');return window.__qaPresentation.frameFor(a,state.globals.time,'left-wise')?.state!=='ko' && !!window.__qaPresentation.frameFor(a,state.globals.time,'left-wise');});
const afterReady=await page.evaluate(()=>{const state=window.__codexGame.state,a=state.entities.find(a=>a.name==='Falie'),p=window.__qaPresentation.frameFor(a,state.globals.time,'left-wise');return {now:state.globals.time,state:p.state,src:p.frame.src,retention:window.__qaPresentation.retention()};});
await page.waitForTimeout(400);
const afterPause=await page.evaluate(()=>{const state=window.__codexGame.state,a=state.entities.find(a=>a.name==='Falie'),p=window.__qaPresentation.frameFor(a,state.globals.time,'left-wise');return {now:state.globals.time,state:p.state,src:p.frame.src};});
if(afterReady.now!==afterPause.now || afterReady.src!==afterPause.src) throw Error('Paused ready frame advanced');
await page.getByRole('button',{name:'QUESTS',exact:true}).click();await page.waitForTimeout(100);
const departed=await page.evaluate(()=>window.__qaPresentation.retention());
if(departed.displayedActors!==0) throw Error('Scene departure retained actors');
await page.getByRole('button',{name:'Continue Battle',exact:true}).click();await page.waitForTimeout(150);
const reentered=await page.evaluate(()=>window.__qaPresentation.retention());
if(!reentered.displayedActors || reentered.retainedBytes>25165824 || reentered.entries>32) throw Error('Reentry or cache cap failed');
await page.screenshot({path:new URL('four-restored-final.png', import.meta.url).pathname});
const viewport=await page.evaluate(()=>{const c=document.querySelector('#view'),r=c.getBoundingClientRect();return {width:innerWidth,height:innerHeight,dpr:devicePixelRatio,canvas:{x:r.x,y:r.y,width:r.width,height:r.height,backingWidth:c.width,backingHeight:c.height}};});
const result={viewport,sourceDependency:'5d674b0c76d40305dc6c0317dbcf8e53606c3784',terminal,restored,afterReady,afterPause,departed,reentered,errors,fixture:'QA freezes four heroes at KO and defers Fara non-KO PNG requests. Resuming the existing simulation performs ordinary continuous-defeat recovery; no direct restore helper call. Pause then uses QaScenarioPaused.'};
fs.writeFileSync(new URL('four-hero-restore.json',import.meta.url),JSON.stringify(result,null,2)); console.log(JSON.stringify(result));
await browser.close();
