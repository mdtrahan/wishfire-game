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
  let heals = 0;
  const flow = createStoryEntryFlow({ gameState, layoutState: layout, isReady: () => readiness.ready, getEnemies: () => enemies });
  registerRuntimeLayouts(layout, {
    gameState, storyEntry: flow,
    combatLayout: { id: 'combat', allowedTransitions: ['storyMock', 'heroLayout'], onEnter() { combatEntries++; }, onActive() {}, onExit() {} },
    uiState: { setUIStateField() {} },
    restorePartyToFullHP() { heals++; },
  });
  await layout.activateInitialLayout('storyMock');
  return { gameState, flow, controller, content, layout, input, bus, readiness, combatEntries: () => combatEntries, heals: () => heals };
}


function openLadder(s) {
  s.gameState.storyEntry.startHitZone = { x: 111.4, y: 405, w: 146.2, h: 44 };
  assert.equal(s.flow.handlePointer({ x: 180, y: 428 }), true);
}
test('map opens ladder; only revealed cards can start and energy is charged once', async () => {
 const s = await setup(); openLadder(s);
 assert.equal(s.gameState.storyEntry.phase, 'ladder');
 assert.equal(s.flow.startCard(1), false);
 assert.equal(s.flow.startCard(0), true);
 assert.equal(s.flow.startCard(0), false);
 assert.equal(s.gameState.storyEntry.progress.energy, 95);
 assert.equal(s.gameState.narrative.stepIndex, 0);
 assert.equal(s.layout.canTransitionTo('combat').allowed, false);
});
test('loading blocks entry and developer shortcuts', async () => {
 const s = await setup(false);
 assert.equal(s.flow.handlePointer({x:180,y:428}),false);
 assert.equal(s.flow.skip(),false);
 assert.equal(s.flow.startCard(0),false);
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
 s.flow.quit();assert.equal(s.gameState.storyEntry.phase,'ladder');
 assert.equal(s.gameState.storyEntry.progress.completed.length,0);
});

test('synthetic roster stages sort by CP, use existing thumbnails, and unlock one battle at a time', async () => {
 const { buildSyntheticQuestStages } = await import('../web-runner/systems/storyEntryFlow.mjs');
 const table = JSON.parse(fs.readFileSync(path.join(root, 'web-runner/assets/enemies.json')));
 const names = table.data.find(column => column[0][0] === 'name');
 const cp = table.data.find(column => column[0][0] === 'EncounterCP');
 const enemies = names.slice(1).map((value,i) => ({name:value[0], CombatPower:cp[i+1][0]}));
 const stages = buildSyntheticQuestStages(enemies);
 assert.equal(stages.length,10);
 assert.equal(stages[0].enemyName,'Troll');
 assert.equal(stages.at(-1).enemyName,'High Orc');
 for (const [i,stage] of stages.entries()) {
   assert.equal(stage.title,`Stage ${i+1}`);
   assert.ok(fs.existsSync(path.join(root,'web-runner',decodeURIComponent(stage.thumbnail))));
   if(i) assert.ok(stage.cp >= stages[i-1].cp);
 }
 const s = await setup(true,enemies); s.flow.update(); openLadder(s);
 assert.deepEqual(s.gameState.storyEntry.cards.map(c=>c.title),['Main Story 1',...stages.slice(0,5).map(c=>c.title),'Main Story 2',...stages.slice(5).map(c=>c.title)]);
 for(let i=0;i<12;i++) {
   assert.equal(s.gameState.storyEntry.progress.revealed,i+1);
   assert.equal(s.flow.startCard(i+1),false);
   assert.equal(s.flow.startCard(i),true);
   const card = s.gameState.storyEntry.cards[i];
   if(card.content) { s.flow.requestSkip(); s.flow.confirmSkip(); }
   await flush();
   if(card.combat) {
     assert.equal(s.gameState.storyEntry.phase,'combat');
     s.flow.victory(); await flush();
   }
 }
 assert.equal(s.gameState.storyEntry.progress.completed.length,12);
 assert.equal(s.gameState.storyEntry.progress.resources,750);
});

test('Quests from the map changes the view without requesting the same layout', async () => {
 const s = await setup();
 assert.equal(await s.flow.navigate('Quests'), true);
 assert.equal(s.gameState.storyEntry.phase, 'ladder');
 assert.equal(s.gameState.storyEntry.error, null);
 assert.equal(await s.flow.navigate('Quests'), true);
 assert.equal(s.gameState.storyEntry.error, null);
});
