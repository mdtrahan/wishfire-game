import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../web-runner/app.js', import.meta.url), 'utf8');

test('query variants keep production combat on the realtime scheduler', () => {
  assert.match(app, /beforeInit: \(\) => configureContinuousCombatProduction\(state\.globals, \{ productionPath: true \}\)/,
    'devtest and orientation query parameters must not opt production back into turn combat');
  assert.doesNotMatch(app, /configureContinuousCombatProduction\(state\.globals, \{ productionPath: window\.location\.search/);
});

test('app and developer QA expose no legacy turn dispatcher', () => {
  assert.doesNotMatch(app, /autoPlayTurnsDev|runDevAutoplayUntilDepleted/,
    'continuous combat QA must rely on normal automatic combat instead of retired autoplay');
  assert.doesNotMatch(app, /runCombatStep\(fnContext, ['"]ProcessTurn['"]\)|callFunctionWithContext\(fnContext, ['"]AdvanceTurn['"]\)/);
  const hooks = fs.readFileSync(new URL('../web-runner/systems/devBrowserTestHooks.js', import.meta.url), 'utf8');
  assert.doesNotMatch(hooks, /resolveQaFixtureDeferredAdvance|['"]AdvanceTurn['"]|['"]ProcessTurn['"]/);
});

test('combat frame exits before stage or legacy turn service whenever simulation is paused', () => {
  const tickStart = app.indexOf('function tick(){');
  const tickEnd = app.indexOf('\n  tick();', tickStart);
  const tick = app.slice(tickStart, tickEnd);
  const pausedGate = tick.indexOf('shouldFreezeCombatSimulation(state, gameState)');
  const stageAdvance = tick.indexOf('maybeAdvanceContinuousCombatStage(');
  assert.ok(pausedGate >= 0 && pausedGate < stageAdvance, 'pause gate precedes continuous action scheduling');
  assert.match(tick.slice(pausedGate, stageAdvance), /combatSimulationTicker\.reset\(\)[\s\S]*return;/);
  assert.doesNotMatch(tick, /TurnPhase|DeferAdvance|ProcessTurn|AdvanceTurn/);

  const defeatStart = tick.indexOf("if (gameState.storyEntry.phase === 'defeat')");
  const defeatEnd = tick.indexOf("if (ensureDevToolingConfig().open)", defeatStart);
  assert.ok(defeatStart >= 0 && defeatEnd > defeatStart);
  assert.doesNotMatch(tick.slice(defeatStart, defeatEnd), /combatSimulationTicker\.tick/);

  const hiddenStart = tick.indexOf('if (document.hidden)');
  const hiddenEnd = tick.indexOf("if (gameState.storyEntry.phase === 'defeat')", hiddenStart);
  assert.match(tick.slice(hiddenStart, hiddenEnd), /combatSimulationTicker\.reset\(\)[\s\S]*return;/);
});
