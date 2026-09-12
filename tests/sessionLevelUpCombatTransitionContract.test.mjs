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
import { resetCombatSessionConditions } from '../web-runner/systems/combatSessionReset.mjs';
import { hasSessionLevelUpPresentationBarrier } from '../web-runner/src/core/turnGateController.mjs';
import { applyLevelUpBuffCard, createSessionLevelBuffState } from '../src/core/sessionLevelBuffOffers.mjs';
import { QA_LEVEL_UP_BUFF_CARDS } from '../web-runner/modules/sessionLevelUpBuffPresentation.mjs';
import { applySessionLevelBuffsAtBattleStart, rulesContext } from '../web-runner/modules/heroCommands.mjs';

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

test('shared ProcessTurn boundary holds every scheduler path while settlement or an offer is active', () => {
  const source = read('web-runner/modules/functionBank.js');
  assert.equal(hasSessionLevelUpPresentationBarrier({ SessionLevelUpQueue: { status: 'active' } }), true);
  assert.equal(hasSessionLevelUpPresentationBarrier({ SessionLevelUpSettlement: { phase: 'fadeOut' } }), true);
  assert.equal(hasSessionLevelUpPresentationBarrier({ SessionLevelUpQueue: { status: 'complete' } }), false);
  const processTurn = source.slice(source.indexOf('export function ProcessTurn(ctx)'), source.indexOf('function isBoardFullyPopulatedForEnemyMutation'));
  assert.match(processTurn, /hasSessionLevelUpPresentationBarrier\(g\)[\s\S]*return;[\s\S]*resolvePendingEnemyDeaths\(ctx\)/);
});

test('fresh-session reset clears level buffs, offers, settlement, and queue state', () => {
  const globals = { SessionLevelBuffState: { heroes: { fara: { activeStageByEffectId: { qa_atk_focus: 1 } } } }, SessionLevelUpOffersByQueueIndex: { 0: {} }, SessionLevelUpSettlement: { rows: [{}] } };
  resetCombatSessionConditions(globals, {});
  assert.deepEqual(globals.SessionLevelBuffState, { heroes: {} });
  assert.deepEqual(globals.SessionLevelUpOffersByQueueIndex, {});
  assert.equal(globals.SessionLevelUpSettlement, null);
  assert.equal(globals.SessionLevelUpQueue.status, 'complete');
});

test('a selected session buff survives the next battle of a continuing adventure and terminal reset clears it', () => {
  const selected = applyLevelUpBuffCard({
    state: createSessionLevelBuffState(), heroId: 'fara-1', cardId: 'qa_atk_focus_1', cards: QA_LEVEL_UP_BUFF_CARDS,
  });
  const globals = {
    CombatSessionId: 1, ProgressionBattle: { outcome: 'victory' }, SessionLevelBuffState: selected.state,
    SessionLevelUpQueue: { status: 'complete' }, SessionLevelUpSettlement: { rows: [] }, SessionLevelUpOffersByQueueIndex: { 0: {} },
  };
  resetCombatSessionConditions(globals, {}, { preserveSessionLevelBuffs: true });
  assert.deepEqual(globals.SessionLevelBuffState, selected.state);
  assert.equal(globals.SessionLevelUpQueue.status, 'complete');
  assert.equal(globals.SessionLevelUpSettlement, null);
  const hero = { uid: 1, kind: 'hero', heroInstanceKey: 'fara-1', hp: 100, maxHP: 100, stats: { ATK: 20 }, statuses: [] };
  const ctx = { state: { globals: { ...globals, CombatSessionId: 2 }, entities: [hero] }, callFunction: () => 0 };
  applySessionLevelBuffsAtBattleStart(ctx, rulesContext(ctx));
  assert.equal(hero.statuses.find(status => status.statusEffect === 'atkUp')?.magnitude, .10, 'battle B reads battle A ownership for this hero only');
  resetCombatSessionConditions(globals, {});
  assert.deepEqual(globals.SessionLevelBuffState, { heroes: {} }, 'a new terminal session clears ownership');
});

test('initializer preserves only victory-owned buffs and the paused Quests quit route clears them', () => {
  const initializer = read('web-runner/systems/combatSessionInitializer.js');
  const app = read('web-runner/app.js');
  const hooks = read('web-runner/systems/devBrowserTestHooks.js');
  assert.match(initializer, /ProgressionBattle\?\.outcome === 'victory'[\s\S]*preserveSessionLevelBuffs: continuingAdventure/);
  assert.match(app, /quest-navigation-quit', \{ clearSessionLevelBuffs: true \}/);
  assert.match(hooks, /navigate\('Quests'\)[\s\S]*quitPausedCombat\(\)/);
});

test('QA continuation enters Battle B through StoryEntry and effect controls invoke native production seams', () => {
  const hooks = read('web-runner/systems/devBrowserTestHooks.js');
  const nextBattle = hooks.slice(hooks.indexOf("['QA next battle'"), hooks.indexOf("['QA fresh session'"));
  const effects = hooks.slice(hooks.indexOf("['QA native basic'"), hooks.indexOf("['QA next battle'"));
  assert.match(hooks, /EncounterSeed = 7969171/);
  assert.match(nextBattle, /storyEntry\.victory\(\)[\s\S]*storyEntry\.startCard\(cardIndex\)[\s\S]*storyEntry\.confirmSkip\(\)[\s\S]*waitForQaStoryCombatPhase/);
  assert.doesNotMatch(nextBattle, /layoutState\.requestLayoutChange/);
  assert.match(effects, /callFunctionWithContext\(fnContext, 'ProcessTurn'\)/);
  assert.match(effects, /callFunctionWithContext\(fnContext, 'AdvanceTurn'\)/);
  assert.match(effects, /callFunctionWithContext\(fnContext, 'ExecuteEnemyJobSkill', enemy\.uid, 'Enemy_ATK_Single', hero\.uid\)/);
});

function loadQaStoryWait() {
  const source = read('web-runner/systems/devBrowserTestHooks.js');
  const helperStart = source.indexOf('export async function waitForQaStoryCombatPhase');
  const braceStart = source.indexOf(') {', helperStart) + 2;
  let depth = 0; let helperEnd = braceStart;
  for (; helperEnd < source.length; helperEnd += 1) { if (source[helperEnd] === '{') depth += 1; if (source[helperEnd] === '}' && --depth === 0) break; }
  const helper = source.slice(helperStart, helperEnd + 1).replace('export async function', 'async function');
  const context = {}; vm.createContext(context);
  vm.runInContext(`${helper}\nthis.waitForQaStoryCombatPhase = waitForQaStoryCombatPhase;`, context);
  return context.waitForQaStoryCombatPhase;
}

test('QA StoryEntry wait accepts a combat handoff that completes around 1820ms', async () => {
  const waitForQaStoryCombatPhase = loadQaStoryWait();
  let time = 0; const entry = { phase: 'opening', pending: true };
  const outcome = await waitForQaStoryCombatPhase(entry, {
    timeoutMs: 2400, pollMs: 25, now: () => time,
    wait: async ms => { time += ms; if (time >= 1820) { entry.phase = 'combat'; entry.pending = false; } },
  });
  assert.equal(outcome.ok, true);
  assert.ok(outcome.elapsedMs >= 1800, 'the full fade, hold, and transition window remains valid');
  assert.equal(entry.phase, 'combat');
});

test('QA StoryEntry wait reports the observed state only after a true timeout', async () => {
  const waitForQaStoryCombatPhase = loadQaStoryWait();
  let time = 0; const entry = { phase: 'opening', pending: true };
  const outcome = await waitForQaStoryCombatPhase(entry, { timeoutMs: 2400, pollMs: 25, now: () => time, wait: async ms => { time += ms; } });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.observed.phase, 'opening');
  assert.equal(outcome.observed.pending, true);
  assert.ok(outcome.elapsedMs >= 2400);
});

test('QA fixture scenarios use bounded production actions and require each observable result', () => {
  const hooks = read('web-runner/systems/devBrowserTestHooks.js');
  const fixtureRun = hooks.slice(hooks.indexOf("['QA run fixture'"), hooks.indexOf("['QA next battle'"));
  assert.match(fixtureRun, /const scenarios = \{/);
  assert.match(fixtureRun, /pulse: \{ attempts: 2/);
  assert.match(fixtureRun, /orb: \{ attempts: 3/);
  assert.match(fixtureRun, /venom: \{ attempts: 1/);
  assert.match(fixtureRun, /bounce requires two distinct living enemies/);
  assert.match(fixtureRun, /visual\.targetUID\) !== Number\(visual\.sourceTargetUID\)/);
  assert.match(fixtureRun, /ExecuteEnemyJobSkill', enemy\.uid, 'Enemy_ATK_Single', owner\.uid/);
  assert.match(fixtureRun, /for \(let attempt = 0; attempt < scenario\.attempts/);
  assert.match(fixtureRun, /did not produce its required observable production result/);
  assert.doesNotMatch(fixtureRun, /resolveSessionLevelBasicEffects|resolveSessionLevelCounter|applySessionLevelBuffsAtBattleStart/);
});

test('the Phase 4 fixture table keeps Pulse, staged Orb, and Venom identities distinct', () => {
  const cards = read('web-runner/modules/sessionLevelUpBuffPresentation.mjs');
  assert.match(cards, /qa_pulse_1[\s\S]*everyCompletedBasics: 2, amount: 6/);
  assert.match(cards, /qa_orb_cadence_1[\s\S]*everyCompletedBasics: 3, amount: 4/);
  assert.match(cards, /qa_orb_cadence_2[\s\S]*requiresStage: 1, replacesStage: 1[\s\S]*everyCompletedBasics: 2, amount: 6/);
  assert.match(cards, /statusId: 'qa_venom'/);
});
