const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function makeFlow({ eligible = true } = {}) {
  const gameState = {};
  let activeLayout = 'combat';
  let combatEnds = 0;
  let combatQuits = 0;
  let clears = 0;
  let transientSurfaceOpen = false;
  const routeStates = [];
  const layoutState = {
    getActiveLayoutId: () => activeLayout,
    async requestLayoutChange(target) {
      routeStates.push({ target, paused: gameState.storyEntry.combatPaused, modal: gameState.storyEntry.modal, transientSurfaceOpen });
      activeLayout = target;
      return true;
    },
    clearSnapshot() { clears += 1; },
  };
  return import('../web-runner/systems/storyEntryFlow.mjs').then(({ createStoryEntryFlow }) => {
    const flow = createStoryEntryFlow({
      gameState,
      layoutState,
      isReady: () => true,
      onCombatEnd: () => { combatEnds += 1; },
      onCombatQuit: () => { combatQuits += 1; },
      isCombatPauseEligible: () => eligible,
      closeTransientSurface: () => { transientSurfaceOpen = false; },
    });
    gameState.storyEntry.phase = 'combat';
    gameState.storyEntry.activeCard = 0;
    gameState.storyEntry.combatUnlocked = true;
    return { flow, gameState, layoutState, openTransientSurface() { transientSurfaceOpen = true; }, get transientSurfaceOpen() { return transientSurfaceOpen; }, get routeStates() { return routeStates; }, get activeLayout() { return activeLayout; }, get combatEnds() { return combatEnds; }, get combatQuits() { return combatQuits; }, get clears() { return clears; } };
  });
}

test('Quests from active combat opens the paused battle modal without ending the card', async () => {
  const s = await makeFlow();
  assert.equal(await s.flow.navigate('Quests'), true);
  assert.equal(s.activeLayout, 'storyMock');
  assert.equal(s.gameState.storyEntry.phase, 'combat-paused');
  assert.equal(s.gameState.storyEntry.modal, 'combat-pause');
  assert.equal(s.gameState.storyEntry.activeCard, 0);
  assert.equal(s.combatEnds, 0);
  assert.equal(await s.flow.navigate('Quests'), false, 'the modal blocks repeated navigation');
});

test('Map and Back navigation retain the combat marker until Quests opens the modal', async () => {
  const s = await makeFlow();
  assert.equal(await s.flow.navigate('Map'), true);
  assert.equal(s.activeLayout, 'storyMock');
  assert.equal(s.gameState.storyEntry.phase, 'map');
  assert.equal(s.gameState.storyEntry.combatPaused, true);
  assert.equal(s.combatEnds, 0);
  assert.equal(await s.flow.navigate('Quests'), true);
  assert.equal(s.gameState.storyEntry.phase, 'combat-paused');
  assert.equal(s.gameState.storyEntry.modal, 'combat-pause');
});

test('Hero, Vault, and Flow pause before their destination route begins', async () => {
  for (const label of ['Hero', 'Vault', 'AstralFlow']) {
    const s = await makeFlow();
    assert.equal(await s.flow.navigate(label), true);
    assert.equal(s.gameState.storyEntry.combatPaused, true, `${label} freezes the active battle`);
    assert.equal(s.routeStates[0].paused, true, `${label} pauses before routing`);
    assert.equal(s.routeStates[0].modal, null, `${label} does not create a duplicate modal`);
  }
});

test('Flow-to-Quests closes the transient overlay before one paused-battle gate opens', async () => {
  const s = await makeFlow();
  await s.flow.navigate('AstralFlow');
  s.openTransientSurface();
  assert.equal(await s.flow.navigate('Quests'), true);
  assert.equal(s.transientSurfaceOpen, false);
  assert.deepEqual(s.routeStates.at(-1), { target: 'storyMock', paused: true, modal: 'combat-pause', transientSurfaceOpen: false });
  assert.equal(s.gameState.storyEntry.phase, 'combat-paused');
  assert.equal(s.gameState.storyEntry.modal, 'combat-pause');
});

test('paused navigation keeps the combat payload unchanged until Resume or Quit', async () => {
  const s = await makeFlow();
  const board = { heroHP: 46, enemyUID: 'enemy:9', af: 17, exp: 39, turn: 12 };
  await s.flow.navigate('Hero');
  const departure = structuredClone(board);
  await s.flow.navigate('Quests');
  assert.deepEqual(board, departure, 'routing cannot mutate combat state while away');
  assert.equal(await s.flow.continuePausedCombat(), true);
  assert.deepEqual(board, departure, 'Resume restores the untouched departure state');
  await s.flow.navigate('Quests');
  assert.equal(s.flow.quitPausedCombat(), true);
  assert.deepEqual(board, departure, 'Quit does not grant a completion reward before the reset owner runs');
});

test('Continue returns to the same combat session and Quit clears its snapshot without rewards', async () => {
  const s = await makeFlow();
  await s.flow.navigate('Quests');
  assert.equal(s.clears, 0, 'Continue must retain the paused snapshot');
  assert.equal(await s.flow.continuePausedCombat(), true);
  assert.equal(s.activeLayout, 'combat');
  assert.equal(s.gameState.storyEntry.phase, 'combat');
  assert.equal(s.gameState.storyEntry.activeCard, 0);
  assert.equal(s.combatQuits, 0);

  await s.flow.navigate('Quests');
  assert.equal(s.flow.quitPausedCombat(), true);
  assert.equal(s.activeLayout, 'storyMock');
  assert.equal(s.gameState.storyEntry.phase, 'map');
  assert.equal(s.gameState.storyEntry.activeCard, null);
  assert.equal(s.gameState.storyEntry.combatUnlocked, false);
  assert.equal(s.combatEnds, 0);
  assert.equal(s.combatQuits, 1);
  assert.equal(s.clears, 1);
});

test('ended combat cannot be converted into a paused-battle modal', async () => {
  const s = await makeFlow({ eligible: false });
  assert.equal(await s.flow.navigate('Quests'), false);
  assert.equal(s.activeLayout, 'combat');
  assert.equal(s.gameState.storyEntry.phase, 'combat');
  assert.equal(s.gameState.storyEntry.modal, null);
});

test('shared navigation and quest modal use the existing explicit control seams', () => {
  const nav = read('web-runner/systems/renderExistingNavigation.mjs');
  const ladder = read('web-runner/systems/questLadderUI.mjs');
  assert.doesNotMatch(nav, /inCombat && !gameState\.heroCommandsMenuOpen/);
  assert.match(ladder, /combat-paused/);
  assert.match(ladder, /combat-continue/);
  assert.match(ladder, /combat-quit/);
  assert.match(ladder, /button\('Quit Battle','combat-quit'\)[\s\S]*button\('Continue Battle','combat-continue'/);
  const app = read('web-runner/app.js');
  assert.match(app, /if \(gameState\.storyEntry\.combatPaused\) \{\s*(?:gameState\.publishQaPauseSnapshot\?\.\('paused'\);\s*)?if \(layoutState\.getActiveLayoutId\(\) !== 'combat'\) drawFrame\(\);\s*requestAnimationFrame\(tick\);\s*return;/,
    'the animation tick must freeze simulation while a combat session is paused');
  assert.match(app, /if \(layoutState\.getActiveLayoutId\(\) !== 'combat'\) \{\s*drawFrame\(\);\s*requestAnimationFrame\(tick\);/);
  assert.match(app, /const activeFanState = levelUpFanState;/,
    'the established fan seam must present the level-up choice ahead of a legacy fan');
  assert.match(app, /open: activeLayoutId === 'combat' && !!activeFanState\.open/);
  const pointerRouter = read('web-runner/systems/pointerRoutingShell.js');
  assert.match(pointerRouter, /typeof entry\?\.openPausedBattleGate === 'function'/,
    'secondary close buttons must delegate to the shared paused-battle route');
  assert.match(pointerRouter, /entry\?\.phase === 'combat' \|\| entry\?\.combatPaused/);
  assert.match(pointerRouter, /entry\.modal = 'combat-pause'/);
  assert.match(nav, /host\.style\.zIndex = layoutState\.getActiveLayoutId\(\) === 'heroLayout' \? '32' : '19'/,
    'shared navigation must rise above the full-screen Hero details surface only on Hero');
  const devRuntime = read('web-runner/systems/devToolingRuntime.js');
  assert.match(devRuntime, /callFunctionWithContext\(fnContext, 'CancelHeroTurnCardFan'\)/,
    'quitting a paused battle clears the visible fan before fresh-session reset');
  assert.match(devRuntime, /state\.globals\.NativeCommandSequence = null/,
    'quitting a paused battle discards an in-flight native sequence');
});
