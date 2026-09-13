const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const flush = () => new Promise(resolve => setImmediate(resolve));
async function browserModule(file, replacements = []) {
  let source = fs.readFileSync(path.join(root, file), 'utf8');
  for (const [from, to] of replacements) source = source.replace(from, to);
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

async function setup(ready = true, enemies = []) {
  const { createStoryEntryFlow } = await import('../web-runner/systems/storyEntryFlow.mjs');
  const controller = await import('../web-runner/systems/narrativeSceneController.mjs');
  const { WISHFIRE_WARP_CROSSING_CONTENT: content } = await import('../web-runner/src/core/wishfireWarpCrossingContent.mjs');
  const { createHarnessEventBus, HarnessInputDomainManager, createHarnessLayoutState } = await browserModule(
    'web-runner/state/harnessLayoutState.js',
    [[/import .*runtimeDebugLogging.*;\n/, 'const runtimeDebugLogging = { debugLayoutLog() {} };\n']],
  );
  const { registerRuntimeLayouts } = await browserModule('web-runner/systems/runtimeLayoutRegistry.js');
  const bus = createHarnessEventBus();
  const input = new HarnessInputDomainManager(bus);
  const layout = createHarnessLayoutState({ eventBus: bus, inputDomains: input });
  const gameState = {};
  const readiness = { ready };
  let combatEntries = 0;
  let sessionEnds = 0;
  let heals = 0;
  const flow = createStoryEntryFlow({ gameState, layoutState: layout, isReady: () => readiness.ready, getEnemies: () => enemies, onCombatEnd: () => { sessionEnds++; } });
  registerRuntimeLayouts(layout, {
    gameState, storyEntry: flow,
    combatLayout: { id: 'combat', allowedTransitions: ['storyMock', 'heroLayout'], onEnter() { combatEntries++; }, onActive() {}, onExit() {} },
    uiState: { setUIStateField() {} },
    restorePartyToFullHP() { heals++; },
  });
  await layout.activateInitialLayout('storyMock');
  return { gameState, flow, controller, content, layout, input, bus, readiness, combatEntries: () => combatEntries, sessionEnds: () => sessionEnds, heals: () => heals };
}


function openLadder(s) {
  s.gameState.storyEntry.phase = 'ladder';
}
test('player Start enters endless combat directly without a stage card or story scene', async () => {
 const s = await setup();
 s.gameState.storyEntry.startHitZone = { x: 111.4, y: 405, w: 146.2, h: 44 };
 assert.equal(s.flow.handlePointer({ x: 180, y: 428 }), true);
 await flush();
 assert.equal(s.layout.getActiveLayoutId(), 'combat');
 assert.equal(s.gameState.storyEntry.phase, 'combat');
 assert.equal(s.gameState.narrativeScene, undefined);
 assert.equal(s.gameState.storyEntry.progress.energy, 200);
 assert.equal(s.gameState.storyEntry.cards.length, 2);
});
test('loading blocks entry and developer shortcuts', async () => {
 const s = await setup(false);
 assert.equal(s.flow.handlePointer({x:180,y:428}),false);
 assert.equal(s.flow.skip(),false);
 assert.equal(s.flow.startCard(0),false);
});
test('quest QA direct combat shortcut skips story presentation and uses the existing combat entry', async () => {
 const s = await setup();
 const hooks = fs.readFileSync(path.join(root, 'web-runner/systems/devBrowserTestHooks.js'), 'utf8');
 assert.match(hooks, /get\('questQA'\) === '1'/);
 assert.match(hooks, /'QA start combat'/);
 assert.match(hooks, /storyEntry\.startCombatForQA\(\)/);
 assert.equal(typeof s.flow.startCombatForQA, 'function');
 const energy = s.gameState.storyEntry.progress.energy;
 assert.equal(await s.flow.startCombatForQA(), true);
 await flush();
 assert.equal(s.layout.getActiveLayoutId(), 'combat');
 assert.equal(s.gameState.storyEntry.phase, 'combat');
 assert.equal(s.gameState.storyEntry.activeCard, 0);
 assert.equal(s.gameState.storyEntry.progress.energy, energy);
 assert.equal(s.gameState.narrativeScene, undefined);
});
test('Skip confirmation pauses flow; Cancel retains the current card and line', async () => {
 const s = await setup(); openLadder(s); s.flow.startCard(0);
 s.gameState.narrativeScene.auto = true;
 assert.equal(s.flow.requestSkip(),true);
 s.flow.update(99999);
 assert.equal(s.gameState.narrative.stepIndex,0);
 assert.equal(s.gameState.storyEntry.progress.revealed,1);
 assert.equal(s.combatEntries(),0);
 s.flow.cancelSkip();
 assert.equal(s.gameState.narrativeScene.auto,true);
 assert.equal(s.gameState.storyEntry.modal,null);
});
test('confirmed Skip starts internal combat; victory alone reveals next card and pays once', async () => {
 const s = await setup(); openLadder(s); s.flow.startCard(0);
 s.flow.requestSkip(); s.flow.confirmSkip(); await flush();
 assert.equal(s.layout.getActiveLayoutId(),'combat');
 assert.equal(s.gameState.storyEntry.progress.revealed,1);
 assert.equal(s.gameState.storyEntry.progress.resources,150);
 s.flow.victory(); await flush();
 assert.equal(s.layout.getActiveLayoutId(),'storyMock');
 assert.equal(s.gameState.storyEntry.phase,'ladder');
 assert.equal(s.gameState.storyEntry.progress.revealed,2);
 assert.equal(s.gameState.storyEntry.progress.resources,200);
 s.flow.victory(); assert.equal(s.gameState.storyEntry.progress.resources,200);
 assert.equal(s.flow.startCard(1),true);
 s.flow.requestSkip(); s.flow.confirmSkip();
 assert.equal(s.gameState.storyEntry.phase,'ladder');
 assert.equal(s.combatEntries(),1,'next card does not launch combat');
 assert.equal(s.gameState.storyEntry.progress.resources,250);
 s.flow.startCard(1); s.flow.requestSkip(); s.flow.confirmSkip();
 assert.equal(s.gameState.storyEntry.progress.resources,250,'reward remains once only');
});
test('manual pages reach embedded combat without changing narrative text', async () => {
 const s=await setup();openLadder(s);s.flow.startCard(0);
 let pages=0;
 while(s.gameState.storyEntry.phase==='opening') {
  s.controller.advanceNarrativeScenePresentation(s.gameState,s.gameState.storyEntry.content,{forceCompleteTextFirst:false,nowSec:1000+pages});
  s.flow.update(1000+pages++);await flush();assert.ok(pages<100);
 }
 assert.equal(s.layout.getActiveLayoutId(),'combat');assert.ok(pages>16);
});
test('defeat waits for resource Continue or Quit without completion or unlock', async () => {
 const s=await setup();s.flow.skip();await flush();
 assert.equal(s.flow.defeat(),true);await flush();
 assert.equal(s.gameState.storyEntry.phase,'defeat');
 assert.equal(s.gameState.storyEntry.progress.revealed,1);
 assert.equal(await s.flow.continueCombat(),true);
 assert.equal(s.gameState.storyEntry.progress.resources,120);
 assert.equal(s.layout.getActiveLayoutId(),'combat');
 s.flow.defeat();await flush();s.gameState.storyEntry.progress.resources=0;
 assert.equal(await s.flow.continueCombat(),false);
 s.flow.quit();assert.equal(s.gameState.storyEntry.phase,'map');
 assert.equal(s.gameState.storyEntry.progress.completed.length,0);
});

test('synthetic roster stages remain QA helpers and never enter the player card list', async () => {
 const { buildSyntheticQuestStages } = await import('../web-runner/systems/storyEntryFlow.mjs');
 const table = JSON.parse(fs.readFileSync(path.join(root, 'web-runner/assets/enemies.json')));
 const names = table.data.find(column => column[0][0] === 'name');
 const cp = table.data.find(column => column[0][0] === 'EncounterCP');
 const enemies = names.slice(1).map((value,i) => ({name:value[0], CombatPower:cp[i+1][0]}));
 const stages = buildSyntheticQuestStages(enemies);
 assert.deepEqual(buildSyntheticQuestStages(enemies.map(e => ({name:e.name, EncounterCP:e.CombatPower}))), stages);
 assert.equal(stages.length,10);
 assert.equal(stages[0].enemyName,'Troll');
 assert.equal(stages.at(-1).enemyName,'High Orc');
 for (const [i,stage] of stages.entries()) {
   assert.equal(stage.title,`Stage ${i+1}`);
   assert.ok(fs.existsSync(path.join(root,'web-runner',decodeURIComponent(stage.thumbnail))));
   if(i) assert.ok(stage.cp >= stages[i-1].cp);
 }
 const s = await setup(true,enemies); s.flow.update();
 assert.deepEqual(s.gameState.storyEntry.cards.map(c=>c.title),['Main Story 1','Main Story 2']);
});

test('Quests from the map changes the view without requesting the same layout', async () => {
 const s = await setup();
 assert.equal(await s.flow.navigate('Quests'), true);
 assert.equal(s.gameState.storyEntry.phase, 'map');
 assert.equal(s.gameState.storyEntry.error, null);
 assert.equal(await s.flow.navigate('Quests'), true);
 assert.equal(s.gameState.storyEntry.error, null);
});


test('combat end resets overrides once; Continue preserves the active session', async () => {
 const s = await setup(); s.flow.skip(); await flush();
 s.flow.defeat(); await flush();
 assert.equal(s.sessionEnds(),0);
 await s.flow.continueCombat();
 assert.equal(s.sessionEnds(),0);
 s.flow.victory(); await flush();
 assert.equal(s.sessionEnds(),1);
 s.flow.victory(); assert.equal(s.sessionEnds(),1);
 s.flow.startCard(0); s.flow.requestSkip(); s.flow.confirmSkip(); await flush();
 s.flow.defeat(); await flush(); s.flow.quit();
 assert.equal(s.sessionEnds(),2);
 s.flow.startCard(1); s.flow.requestSkip(); s.flow.confirmSkip();
 assert.equal(s.sessionEnds(),2,'story-only completion has no combat overrides to clear');
 await s.flow.startCombatForQA(); await flush();
 await s.flow.navigate('Quests');
 assert.equal(s.gameState.storyEntry.phase,'combat-paused');
 assert.equal(s.gameState.storyEntry.modal,'combat-pause');
 assert.equal(s.sessionEnds(),2,'pausing preserves the active combat session');
 assert.equal(s.flow.quitPausedCombat(),true);
 assert.equal(s.sessionEnds(),3,'quitting the paused battle clears the session once');
});

test('every enabled non-combat destination pauses before its shared Quests resume-or-quit gate', async () => {
 for (const label of ['Hero', 'Vault', 'AstralFlow', 'Map']) {
  const { createStoryEntryFlow } = await import('../web-runner/systems/storyEntryFlow.mjs');
  let active = 'combat';
  const gameState = {};
  const flow = createStoryEntryFlow({ gameState, isReady: () => true, layoutState: {
    getActiveLayoutId: () => active,
    async requestLayoutChange(target) { active = target; return true; },
  } });
  gameState.storyEntry.phase = 'combat';
  assert.equal(await flow.navigate(label), true, `${label} opens while preserving combat`);
  assert.equal(gameState.storyEntry.combatPaused, true, `${label} marks the exact battle paused`);
  assert.equal(await flow.navigate('Quests'), true, `${label} returns through Quests`);
  assert.equal(gameState.storyEntry.phase, 'combat-paused');
  assert.equal(gameState.storyEntry.modal, 'combat-pause');
  assert.equal(await flow.continuePausedCombat(), true);
  assert.equal(active, 'combat');
  assert.equal(gameState.storyEntry.combatPaused, false);
 }
});
