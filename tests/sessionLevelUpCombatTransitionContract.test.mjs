import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  acknowledgeSessionLevelUpEntry,
  createSessionLevelUpQueue,
  currentSessionLevelUpEntry,
  pauseSessionLevelUpQueue,
  resumeSessionLevelUpQueue,
} from '../src/core/sessionLevelUpQueue.mjs';
import {
  getCurrentSessionLevelUpEntry,
  pauseSessionLevelUpRewards,
  resumeSessionLevelUpRewards,
  settleDefeat,
  settleVictory,
} from '../web-runner/modules/heroCommands.mjs';
import { createHeroProgressStore, newHeroProgress } from '../web-runner/src/core/heroProgression.mjs';

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

function extractFunctionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const braceStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`unterminated ${name}`);
}

test('level-up queue preserves party order, includes KO heroes, and creates one entry per earned level', () => {
  const queue = createSessionLevelUpQueue({
    heroes: [
      { uid: 2, heroInstanceKey: 'hondo-2', heroDisplaySlot: 1, hp: 20 },
      { uid: 1, heroInstanceKey: 'fara-1', heroDisplaySlot: 0, hp: 0 },
    ],
    progressionResults: [
      { fromLevel: 1, toLevel: 2 },
      { fromLevel: 1, toLevel: 3 },
    ],
  });
  assert.deepEqual(queue.entries.map(entry => [entry.heroId, entry.earnedLevel]), [
    ['fara-1', 2], ['fara-1', 3], ['hondo-2', 2],
  ]);
  assert.deepEqual(currentSessionLevelUpEntry(queue), queue.entries[0]);
});

test('queue pause/resume and acknowledgement form the Phase 4 presentation seam', () => {
  let queue = createSessionLevelUpQueue({ heroes: [{ uid: 1, heroInstanceKey: 'fara-1' }], progressionResults: [{ fromLevel: 1, toLevel: 2 }] });
  queue = pauseSessionLevelUpQueue(queue);
  assert.equal(currentSessionLevelUpEntry(queue), null);
  queue = resumeSessionLevelUpQueue(queue);
  assert.equal(currentSessionLevelUpEntry(queue).heroId, 'fara-1');
  assert.equal(acknowledgeSessionLevelUpEntry(queue).status, 'complete');
});

test('living hero CTB entry routes one native basic attack to a living selection or stale fallback without opening a fan', () => {
  const source = read('web-runner/modules/functionBank.js');
  const calls = [];
  const context = {
    getGlobals: ctx => ctx.state.globals,
    ensurePowerAmpByUID: () => ({}), ensureAstralFlowAmpState: () => {},
    resolveHeroTurnEntryCompat: () => ({ turnPhase: 0, hideHeroSelector: 0, acceptHeroUID: 1, currentHeroUIDAfter: 1, shouldResetAstralFlowAmp: 0 }),
    recordHeroTurnEntryOwner: () => {}, applyTurnGateIntent: () => {}, createHeroTurnGateBaseline: () => ({}),
    UpdateAstralFlowAmpBar: () => {}, getEntities: ctx => ctx.state.entities,
    executeHeroCommand: (ctx, command) => calls.push(command),
  };
  vm.createContext(context);
  vm.runInContext(`${extractFunctionSource(source, 'HeroTurn')}\nthis.HeroTurn = HeroTurn;`, context);
  const entities = [{ uid: 1, kind: 'hero', hp: 10 }, { uid: 9, kind: 'enemy', hp: 10 }, { uid: 10, kind: 'enemy', hp: 10 }];
  const selected = { state: { globals: { HeroTurnCardFanOpen: 0, SelectedEnemyUID: 10 }, entities } };
  context.HeroTurn(selected, 1);
  const stale = { state: { globals: { HeroTurnCardFanOpen: 0, SelectedEnemyUID: 99 }, entities } };
  context.HeroTurn(stale, 1);
  assert.deepEqual(calls.map(command => [command.actorUID, command.targetUID]), [[1, 10], [1, 9]]);
  assert.equal(selected.state.globals.HeroTurnCardFanOpen, 0);
  assert.equal(stale.state.globals.HeroTurnCardFanOpen, 0);
});

test('victory queues gained levels, the queue pauses battle completion, and defeat clears it', () => {
  const hero = newHeroProgress('Falie', 'fara-1');
  Object.assign(hero, { kind: 'hero', uid: 1, heroDisplaySlot: 0 });
  const globals = {
    NativeBattleEnded: true, HeroProgress: createHeroProgressStore(), goldTotal: 0,
    SessionLevelBuffState: { heroes: { 'fara-1': { activeStageByEffectId: { qa_atk_focus: 1 } } } },
    ProgressionBattle: { id: 'queue-victory', participants: ['fara-1'], defeated: { 9: 1000 }, defeatedGold: {} },
  };
  const ctx = { state: { globals, entities: [hero] }, callFunction: () => {} };
  settleVictory(ctx);
  assert.equal(globals.SessionLevelUpQueue.status, 'active');
  assert.equal(getCurrentSessionLevelUpEntry(ctx).heroId, 'fara-1');
  pauseSessionLevelUpRewards(ctx);
  assert.equal(getCurrentSessionLevelUpEntry(ctx), null);
  resumeSessionLevelUpRewards(ctx);
  assert.equal(getCurrentSessionLevelUpEntry(ctx).heroId, 'fara-1');
  settleDefeat(ctx);
  assert.equal(globals.SessionLevelUpQueue.status, 'complete');
  assert.deepEqual(globals.SessionLevelBuffState, { heroes: {} });
});

test('combat completion waits for the queue seam and resets its state for a fresh session', () => {
  const source = read('web-runner/systems/questCombatSession.mjs');
  const reset = read('web-runner/systems/combatSessionReset.mjs');
  assert.match(source, /SessionLevelUpQueue\?\.status !== 'active'/);
  assert.match(reset, /SessionLevelUpQueue: \{ version: 1, status: 'complete'/);
});
