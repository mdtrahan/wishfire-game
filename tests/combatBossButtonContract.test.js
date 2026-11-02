const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');

test('combat progress HUD shows the current chapter and region-sized wave progress', async () => {
  const renderer = fs.readFileSync(path.join(root, 'web-runner/systems/renderRuntime.js'), 'utf8');
  const loader = fs.readFileSync(path.join(root, 'web-runner/systems/runtimeVisualAssetLoader.js'), 'utf8');
  const control = await import(pathToFileURL(path.join(root, 'web-runner/systems/renderCombatBossControl.mjs')));
  assert.match(renderer, /drawCombatProgressHud\(ctx, \{ state, images, worldToCanvas \}\)/);
  assert.match(loader, /images\.CombatProgressHondoHead = await loadImage\(assetUrl\('puppets\/hondo\/source\/head\.png'\)\)/);
  assert.doesNotMatch(control.drawCombatProgressHud.toString(), /HERO_HEAD|sourceX|sourceY/);
  assert.match(control.drawCombatProgressHud.toString(), /ctx\.textAlign = 'center'/);
  assert.match(control.drawCombatProgressHud.toString(), /11 \* scale/);
  assert.match(control.drawCombatProgressHud.toString(), /16 \* scale/);
  assert.match(control.drawCombatProgressHud.toString(), /Chapter/);

  const calls = [];
  const ctx = new Proxy({}, { get: (_target, key) => (...args) => calls.push([key, ...args]), set: (_target, key, value) => { calls.push(['set', key, value]); return true; } });
  const worldToCanvas = (x, y) => ({ x: x * 1.5 + 10, y: y * 1.5 + 4 });
  const state = { globals: { ContinuousCombatStage: { region: 4, stage: 1, wave: 3 } } };
  const rect = control.combatProgressHudRect(worldToCanvas);
  assert.deepEqual(rect, { x: 201.25, y: 70, w: 157.5, h: 60 });
  assert.equal(rect.x + rect.w / 2, worldToCanvas(180, 0).x);
  const result = control.drawCombatProgressHud(ctx, { state, images: { CombatProgressHondoHead: { width: 367, height: 391 } }, worldToCanvas });
  assert.equal(result.label, 'Chapter 4');
  assert.equal(result.waveCount, 20);
  assert.equal(result.railCenterX, result.labelX);
  assert.equal(result.railCenterX, worldToCanvas(180, 0).x);
  assert.equal(calls.find(([name, text]) => name === 'strokeText' && text === result.label)[2], worldToCanvas(180, 0).x);
  const notchX = worldToCanvas(138.5 + 83 / 20, 0).x;
  const notchTop = calls.find(([name, x]) => name === 'moveTo' && Math.abs(x - notchX) < 1e-9);
  const notchBottom = calls.find(([name, x]) => name === 'lineTo' && Math.abs(x - notchX) < 1e-9);
  assert.equal(notchBottom[2] - notchTop[2], 11.25, 'notch height grows from 5 to 7.5 logical pixels');
  assert.ok(calls.some(([name, key, value]) => name === 'set' && key === 'lineWidth' && value === 1.5), 'notch width scales with the twenty-wave chapter count');
  const notchColors = () => calls.filter(([name, key, value]) => name === 'set' && key === 'strokeStyle' && ['#55d4be', '#243237'].includes(value)).map(([, , value]) => value);
  assert.deepEqual(notchColors(), [...Array(2).fill('#55d4be'), ...Array(17).fill('#243237')]);
  assert.equal(result.completedWaves, 2);
  assert.equal(result.bossReady, false);
  assert.equal(calls.filter(([name]) => name === 'fillRect').length, 1);
  assert.equal(calls.filter(([name]) => name === 'drawImage').length, 1);

  state.globals.ContinuousCombatStage.bossAvailable = true;
  const assertBossMarkerSeparated = () => {
    calls.length = 0;
    const bossHud = control.drawCombatProgressHud(ctx, { state, images: { CombatProgressHondoHead: { width: 367, height: 391 } }, worldToCanvas });
    const markerImage = calls.find(([name]) => name === 'drawImage');
    const bossHead = calls.find(([name]) => name === 'translate');
    const markerX = markerImage[2] + markerImage[4] / 2;
    const scale = bossHud.w / 105;
    assert.equal(bossHud.waveCount, 20);
    assert.equal(bossHud.completedWaves, 20);
    assert.deepEqual(notchColors(), Array(19).fill('#55d4be'));
    assert.ok(bossHead[1] - markerX >= 16 * scale + 2 * scale - 0.01, 'full-progress heads remain visible with a scaled gap');
  };
  assertBossMarkerSeparated();
  state.globals.ContinuousCombatStage.bossAvailable = false;
  state.globals.ContinuousCombatStage.bossActive = true;
  state.globals.ContinuousCombatStage.bossTimerStartedAt = 0;
  state.globals.ContinuousCombatStage.bossTimeLimitSec = 18;
  state.globals.time = 15;
  assertBossMarkerSeparated();
  assert.ok(calls.some(([name, key, value]) => name === 'set' && key === 'fillStyle' && value === '#55d4be'));
  assert.equal(control.drawCombatProgressHud(ctx, { state, images: {}, worldToCanvas }).bossTimeRemainingSec, 15);
  state.globals.ContinuousCombatStage.bossActive = false;
  state.globals.ContinuousCombatStage.wave = 1;
  calls.length = 0;
  const deferredHud = control.drawCombatProgressHud(ctx, { state, images: {}, worldToCanvas });
  assert.equal(deferredHud.completedWaves, 0, 'cleared readiness refills the meter during an ordinary wave');
  assert.deepEqual(notchColors(), Array(19).fill('#243237'));
  state.globals.ContinuousCombatStage.bossAvailable = true;
  state.globals.ContinuousCombatStage.bossSummonRequired = true;
  calls.length = 0;
  assert.equal(control.drawCombatProgressHud(ctx, { state, images: {}, worldToCanvas }).completedWaves, 20);
  assert.deepEqual(notchColors(), Array(19).fill('#55d4be'));

  state.globals.ContinuousCombatStage.region = 5;
  state.globals.ContinuousCombatStage.stage = 1;
  state.globals.ContinuousCombatStage.wave = 5;
  state.globals.ContinuousCombatStage.bossAvailable = false;
  state.globals.ContinuousCombatStage.bossSummonRequired = false;
  calls.length = 0;
  const shortChapterHud = control.drawCombatProgressHud(ctx, { state, images: {}, worldToCanvas });
  assert.equal(shortChapterHud.label, 'Chapter 5');
  assert.equal(shortChapterHud.waveCount, 5);
  assert.equal(shortChapterHud.completedWaves, 4);
  assert.equal(notchColors().length, 4);
});

test('shared Rust HP bars follow owner feet and paint above the sorted actor and front passes', async () => {
  const { drawSliceActorBars } = await import('../web-runner/systems/rustCombatWorldHud.mjs');
  const { drawTauntIcons } = await import('../web-runner/systems/rustCombatTaunt.mjs');
  const source = fs.readFileSync(path.join(root, 'web-runner/systems/rustCombatPresentation.mjs'), 'utf8');
  const frontSource = source.slice(source.indexOf('  function frontPass('), source.indexOf('  function labels('));
  const renderer = fs.readFileSync(path.join(root, 'web-runner/systems/renderRuntime.js'), 'utf8');
  const queueSource = renderer.slice(renderer.indexOf('    actorPaintQueue.sort('), renderer.indexOf('    // Render hero damage/heal text'));
  assert.ok(frontSource.length && queueSource.length);
  for (const zoom of [.4, .5]) for (const scale of [.6, 1.25]) {
    const order = [], tracks = [], transforms = []; let color;
    const ctx = new Proxy({}, {get:(_target,key)=>key==='fillRect'?(...rect)=>{if(color==='#292E34'){tracks.push(rect);order.push('hp');}}:key==='translate'||key==='scale'?(...args)=>transforms.push([key,...args]):()=>{},set:(_target,key,value)=>{if(key==='fillStyle')color=value;return true;}});
    const actors = [
      {actor_id:1,team:'hero',kind:'fara',hp:50,max_hp:100,pos:{x:100,y:200}},
      {actor_id:2,team:'enemy',kind:'gobloc',hp:25,max_hp:100,pos:{x:130,y:100}},
    ];
    const camera = {zoom,x:x=>x*zoom+5,y:y=>y*.75*zoom+7};
    const snapshot = {time:1,combat_time:1,actors,hazards:[],projectiles:[]};
    const scope = {state:{snapshot,effects:[],channels:[]},camera,drawSliceActorBars,drawTauntIcons,encased:new Map(),
      gpu:{mask(){},composite(){},bitmap(){}},sprites:{chargeArt(){}},
      procedural:()=>order.push('front-effects'),begin(){},finish:()=>order.push('composite'),labels:()=>order.push('labels')};
    const front = new Function('scope', `with(scope){${frontSource};return frontPass;}`)(scope);
    const queue = actors.map(a=>({uid:a.actor_id,footY:a.pos.y,paint:()=>order.push(a.team)}));
    new Function('state','ctx','actorPaintQueue','heroAuraQueue','actorFrontOverlayQueue','layoutScale','layoutOffsetX','layoutOffsetY',queueSource)(
      {globals:{RustCombatPresentation:{front}}},ctx,queue,[()=>order.push('aura')],[()=>order.push('overlay')],scale,11,13);
    assert.deepEqual(order,['aura','enemy','hero','overlay','front-effects','composite','labels','hp','hp']);
    const z=zoom/.5;
    assert.deepEqual(tracks,actors.map(a=>[camera.x(a.pos.x)-17*z/2,camera.y(a.pos.y)+(a.team==='hero'?8*z:4),17*z,1.5*z]));
    assert.deepEqual(transforms,[['translate',11,13],['scale',scale,scale]]);
  }
});
