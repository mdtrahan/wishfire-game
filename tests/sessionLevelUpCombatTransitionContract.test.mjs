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
  executeHeroCommand,
} from '../web-runner/modules/heroCommands.mjs';
import { awardHeroEXP, createHeroProgressStore, newHeroProgress } from '../web-runner/src/core/heroProgression.mjs';
import { releaseCombatStartToScheduler, resetCombatSessionConditions } from '../web-runner/systems/combatSessionReset.mjs';
import { derivePresentationTurnBarrier, hasSessionLevelUpPresentationBarrier } from '../web-runner/src/core/turnGateController.mjs';
import { applyLevelUpBuffCard, createSessionLevelBuffState, getEligibleLevelUpBuffCards } from '../src/core/sessionLevelBuffOffers.mjs';
import { beginSessionLevelUpSettlement, QA_LEVEL_UP_BUFF_CARDS } from '../web-runner/modules/sessionLevelUpBuffPresentation.mjs';
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

function loadQaFixtureIdentity() {
  const source = read('web-runner/systems/devBrowserTestHooks.js');
  const mapStart = source.indexOf('export const QA_LEVEL_UP_FIXTURE_CARD_IDS');
  const mapEnd = source.indexOf('\n});', mapStart) + 4;
  const resolver = extractFunctionSource(source, 'resolveQaLevelUpFixtureKey');
  const offerResolver = extractFunctionSource(source, 'resolveQaFixtureOfferCardId');
  assert.ok(mapStart >= 0 && mapEnd > mapStart, 'missing QA fixture identity map');
  const context = {}; vm.createContext(context);
  vm.runInContext(`${source.slice(mapStart, mapEnd).replace('export const', 'const')}\n${resolver}\n${offerResolver}\nthis.identity = { QA_LEVEL_UP_FIXTURE_CARD_IDS, resolveQaLevelUpFixtureKey, resolveQaFixtureOfferCardId };`, context);
  return context.identity;
}

function loadQaSettlementReward() {
  const source = read('web-runner/systems/devBrowserTestHooks.js');
  const start = source.indexOf('function deriveQaSettlementReward(');
  assert.notEqual(start, -1, 'missing deriveQaSettlementReward');
  const braceStart = source.indexOf('{', source.indexOf(') {', start));
  let depth = 0; let end = -1;
  for (let index = braceStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) { end = index + 1; break; }
  }
  assert.ok(end > braceStart, 'unterminated deriveQaSettlementReward');
  const reward = source.slice(start, end);
  const context = {}; vm.createContext(context);
  vm.runInContext(`${reward};\nthis.deriveQaSettlementReward = deriveQaSettlementReward;`, context);
  return context.deriveQaSettlementReward;
}

function loadQaSettlementGuards() {
  const source = read('web-runner/systems/devBrowserTestHooks.js');
  const extractDefaultedFunction = name => {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `missing ${name}`);
    const braceStart = source.indexOf('{', source.indexOf(') {', start));
    let depth = 0;
    for (let index = braceStart; index < source.length; index += 1) {
      if (source[index] === '{') depth += 1;
      if (source[index] === '}' && --depth === 0) {
        const isAsync = source.slice(Math.max(0, start - 6), start) === 'async ';
        return `${isAsync ? 'async ' : ''}${source.slice(start, index + 1)}`;
      }
    }
    assert.fail(`unterminated ${name}`);
  };
  const quiescence = extractDefaultedFunction('qaSettlementQuiescenceSnapshot');
  const waitForQuiescence = extractDefaultedFunction('waitForQaSettlementQuiescence');
  const snapshot = extractDefaultedFunction('qaSettlementHeroHealthSnapshot');
  const changed = extractDefaultedFunction('qaSettlementHeroHealthChanged');
  const context = {
    derivePresentationTurnBarrier: ({ globals }) => ({ canAdvanceTurn: !!globals.presentationClear, blockingLane: globals.presentationClear ? null : 'text-animation' }),
    Object,
    Number,
  };
  vm.createContext(context);
  vm.runInContext(`${quiescence}\n${waitForQuiescence}\n${snapshot}\n${changed}\nthis.guards = { qaSettlementQuiescenceSnapshot, waitForQaSettlementQuiescence, qaSettlementHeroHealthSnapshot, qaSettlementHeroHealthChanged };`, context);
  return context.guards;
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
  assert.equal(globals.ProgressionBattle.outcome, 'victory');
  assert.equal(globals.SessionLevelUpQueue.status, 'active');
  assert.equal(getCurrentSessionLevelUpEntry(ctx).heroId, 'fara-1');
  pauseSessionLevelUpRewards(ctx);
  assert.equal(getCurrentSessionLevelUpEntry(ctx), null);
  resumeSessionLevelUpRewards(ctx);
  assert.equal(getCurrentSessionLevelUpEntry(ctx).heroId, 'fara-1');
  settleDefeat(ctx);
  assert.equal(globals.ProgressionBattle.outcome, 'defeat');
  assert.equal(globals.ProgressionBattle.defeatSettled, true);
  assert.equal(globals.SessionLevelUpQueue.status, 'complete');
  assert.deepEqual(globals.SessionLevelBuffState, { heroes: {} });
});

test('a new victory identity starts its own queue and settlement while a duplicate stays idempotent', () => {
  const hero = newHeroProgress('Falie', 'fara-1');
  Object.assign(hero, { kind: 'hero', uid: 1, heroDisplaySlot: 0, currentEXP: 47, EXPToNextLevel: 100 });
  const globals = {
    NativeBattleEnded: true,
    HeroProgress: createHeroProgressStore(),
    SessionLevelBuffState: { heroes: {} },
    ProgressionBattle: { id: 'victory-a', participants: ['fara-1'], defeated: { 9: 80 }, defeatedGold: {} },
  };
  const ctx = { state: { globals, entities: [hero] }, callFunction: () => {} };
  settleVictory(ctx);
  assert.equal(globals.SessionLevelUpQueue.status, 'active');
  const firstGeneration = globals.SessionLevelUpOfferGeneration;
  globals.SessionLevelUpQueue = { status: 'complete', paused: false, currentIndex: 1, entries: [] };
  hero.currentEXP = Math.max(0, Number(hero.EXPToNextLevel) - 53);
  globals.NativeBattleEnded = true;
  globals.ProgressionBattle = { id: 'victory-b', participants: ['fara-1'], defeated: { 9: 80 }, defeatedGold: {} };
  settleVictory(ctx);
  assert.equal(globals.SessionLevelUpQueue.status, 'active');
  assert.equal(globals.SessionLevelUpSettlement.phase, 'fadeIn');
  assert.equal(globals.SessionLevelUpOfferGeneration, firstGeneration + 1);
  const results = JSON.stringify(globals.ProgressionResults);
  const queue = JSON.stringify(globals.SessionLevelUpQueue);
  settleVictory(ctx);
  assert.equal(JSON.stringify(globals.ProgressionResults), results);
  assert.equal(JSON.stringify(globals.SessionLevelUpQueue), queue);
  assert.deepEqual(globals.HeroProgress.settledBattles, ['victory-a', 'victory-b']);
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

test('QA fixture offers use the production victory settlement and reject only defeat', () => {
  const hooks = read('web-runner/systems/devBrowserTestHooks.js');
  const fixtureOffer = hooks.slice(hooks.indexOf('const beginQaFixtureOffer'), hooks.indexOf("['QA defeat'"));
  const commands = read('web-runner/modules/heroCommands.mjs');
  assert.match(fixtureOffer, /battle\.outcome === 'defeat' \|\| battle\.defeatSettled/);
  assert.match(fixtureOffer, /claimQaSettlementHold\(\)[\s\S]*setQaFixtureOfferPool\(fixtureSelect\.value\);[\s\S]*beginRewardSettlement\(\{ holdClaimed: true \}\)/);
  assert.match(fixtureOffer, /SessionLevelUpQueue\?\.status !== 'active'/);
  assert.match(hooks, /const reward = deriveQaSettlementReward\(\{[\s\S]*threshold: selected\.EXPToNextLevel,[\s\S]*currentEXP: selected\.currentEXP/);
  assert.match(hooks, /hero\.currentEXP = Math\.max\(0, expToNext - 53\)/);
  assert.doesNotMatch(fixtureOffer, /EXPToNextLevel\s*=/);
  assert.match(hooks, /\['QA fixture offer', \(\) => beginQaFixtureOffer\(\)\]/);
  assert.match(commands, /export function settleVictory[\s\S]*if\(!g\.NativeBattleEnded[\s\S]*g\.ProgressionBattle\.outcome='victory'/);
  assert.match(commands, /export function settleDefeat[\s\S]*g\.ProgressionBattle\.outcome='defeat'[\s\S]*g\.ProgressionBattle\.defeatSettled=true/);
});

test('QA settlement rewards use live thresholds for one overflow and a positive no-level EXP row', () => {
  const deriveQaSettlementReward = loadQaSettlementReward();
  const levelOneReward = deriveQaSettlementReward({ threshold: 100, currentEXP: 47, overflow: true });
  assert.equal(levelOneReward, 80);
  assert.equal(47 + levelOneReward - 100, 27);

  const levelTwoReward = deriveQaSettlementReward({ threshold: 283, currentEXP: 230, overflow: true });
  assert.equal(levelTwoReward, 80);
  assert.equal(230 + levelTwoReward - 283, 27);

  const noLevelReward = deriveQaSettlementReward({ threshold: 283, currentEXP: 100, noLevel: true });
  assert.ok(noLevelReward > 0);
  assert.ok(100 + noLevelReward < 283);

  const hooks = read('web-runner/systems/devBrowserTestHooks.js');
  assert.match(hooks, /\['QA no-level EXP', \(\) => beginRewardSettlement\(\{ noLevel: true \}\)\]/);
});

test('synthetic QA settlements hold scheduling until production is quiescent and preserve hero HP through settlement', async () => {
  const { qaSettlementQuiescenceSnapshot, waitForQaSettlementQuiescence, qaSettlementHeroHealthSnapshot, qaSettlementHeroHealthChanged } = loadQaSettlementGuards();
  const globals = { ActionInProgress: 1, IsPlayerBusy: 1, PendingHeroHits: [{ targetUID: 1 }], presentationClear: false };
  assert.equal(qaSettlementQuiescenceSnapshot(globals).ok, false);
  Object.assign(globals, { ActionInProgress: 0, IsPlayerBusy: 0, PendingHeroHits: [], presentationClear: true });
  assert.equal(qaSettlementQuiescenceSnapshot(globals).ok, true);

  const inFlight = { ActionInProgress: 1, IsPlayerBusy: 1, PendingHeroHits: [{ targetUID: 1 }], presentationClear: false, CurrentTurnUID: 7 };
  let elapsed = 0;
  const completed = await waitForQaSettlementQuiescence({
    globals: inFlight,
    timeoutMs: 100,
    pollMs: 25,
    now: () => elapsed,
    wait: async () => {
      elapsed += 25;
      Object.assign(inFlight, { ActionInProgress: 0, IsPlayerBusy: 0, PendingHeroHits: [], presentationClear: true });
    },
  });
  assert.equal(completed.ok, true, 'the hold waits for an in-flight hit to complete before settlement');
  assert.equal(inFlight.CurrentTurnUID, 7, 'the wait itself does not advance the scheduler');
  const blocked = await waitForQaSettlementQuiescence({
    globals: { ActionInProgress: 1, IsPlayerBusy: 1, PendingHeroHits: [{ targetUID: 1 }], presentationClear: false },
    timeoutMs: 50,
    pollMs: 25,
    now: () => elapsed,
    wait: async () => { elapsed += 25; },
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.observed.presentationBlocker, 'text-animation');

  const heroes = [{ uid: 1, kind: 'hero', hp: 25 }, { uid: 2, kind: 'hero', hp: 40 }];
  const baseline = qaSettlementHeroHealthSnapshot(heroes);
  assert.equal(qaSettlementHeroHealthChanged(heroes, baseline), false);
  heroes[1].hp = 39;
  assert.equal(qaSettlementHeroHealthChanged(heroes, baseline), true);

  const hooks = read('web-runner/systems/devBrowserTestHooks.js');
  const settlement = hooks.slice(hooks.indexOf('const beginRewardSettlement'), hooks.indexOf('const beginQaFixtureOffer'));
  assert.match(settlement, /if \(!holdClaimed && !claimQaSettlementHold\(\)\)[\s\S]*const actionCompletion = await waitForQaSettlementQuiescence/);
  assert.match(settlement, /QA synthetic settlement action completion timed out before a live settlement: \$\{JSON\.stringify\(actionCompletion\.observed\)\}/);
  assert.match(settlement, /const preSettlementState = qaSettlementRuntimeSnapshot\(\);[\s\S]*settleVictory\(fnContext\);[\s\S]*monitorQaSettlementHold\(\{ baselineHP: qaSettlementHeroHealthSnapshot\(state\.entities\), preSettlementState \}\)/);
  assert.match(hooks, /duringSettlement\.currentTurnUID !== preSettlementState\.currentTurnUID[\s\S]*duringSettlement\.damageTextCount > preSettlementState\.damageTextCount/);
  assert.match(hooks, /QaSettlementHoldReleaseCount = Number\(state\.globals\.QaSettlementHoldReleaseCount \|\| 0\) \+ 1/);
});

test('living EXP level growth happens synchronously before the held settlement baseline, then HP remains stable', () => {
  const hero = newHeroProgress('Falie');
  hero.hp = 24;
  const oldMaxHP = hero.maxHP;
  const result = awardHeroEXP(hero, 100);
  assert.equal(result.fromLevel, 1);
  assert.equal(result.toLevel, 2);
  assert.equal(hero.hp, 24 + hero.maxHP - oldMaxHP);
  const postStartupHP = hero.hp;
  beginSessionLevelUpSettlement({}, [result], [hero], 0);
  assert.equal(hero.hp, postStartupHP);
});

function loadQaFixtureProcessTurnHarness({ tokenOwnerUID = 0 } = {}) {
  const source = read('web-runner/modules/functionBank.js');
  const processTurn = source.slice(source.indexOf('export function ProcessTurn(ctx)'), source.indexOf('function isBoardFullyPopulatedForEnemyMutation')).replace('export function', 'function');
  const hero = { uid: 1, kind: 'hero', baseHeroName: 'Falie', hp: 40, maxHP: 40, sp: 100, spMax: 100, remainingActionSlots: 3, statuses: [] };
  const enemy = { uid: 9, kind: 'enemy', hp: 30, maxHP: 30, statuses: [] };
  const globals = {
    QaFixtureHoldTurn: 1, GamePhase: 'RUNTIME', CombatSessionId: 1,
    TurnPhase: 0, CurrentTurnIndex: 0, TurnOrderArray: [{ uid: hero.uid, type: 0 }],
    QaFixtureExplicitAction: tokenOwnerUID ? 1 : undefined,
    QaFixtureExplicitActionOwnerUID: tokenOwnerUID,
    QaFixtureExplicitActionClaimed: 0,
  };
  if (!tokenOwnerUID) {
    delete globals.QaFixtureExplicitAction;
    delete globals.QaFixtureExplicitActionOwnerUID;
  }
  const state = { globals, entities: [hero, enemy] };
  const ctx = {
    state,
    callFunction(name, ...args) {
      if (name === 'GetEnemyRosterStability') return { stable: true };
      if (name === 'GetCurrentTurn') return hero.uid;
      if (name === 'StartHeroLunge') {
        assert.equal(args[0], hero.uid);
        globals.ActionInProgress = 1;
        globals.IsPlayerBusy = 1;
        globals.TurnPhase = 1;
        return 1;
      }
      throw new Error(`unexpected exact command dependency: ${name}`);
    },
  };
  const context = {
    console: { log() {} },
    GetCurrentType: () => 0,
    GetCurrentTurn: () => hero.uid,
    GetActorByUID: (_ctx, uid) => state.entities.find(entity => entity.uid === uid),
    getGlobals: () => globals,
    hasSessionLevelUpPresentationBarrier: () => false,
    resolvePendingEnemyDeaths: () => {}, holdForEnemyRosterRefill: () => false,
    recoverStaleActionInProgress: () => {}, logActionGateBlock: () => {},
    nativeTurnStarted: () => {},
    getDynamicInitiativeDefaultCurrent: () => false,
    isTimeInitiative: () => false,
    schedulerWriteQueue: () => {}, schedulerWriteIndex: () => {},
    GetEffectiveStat: () => 1,
    resolveProcessTurnActorEligibility: () => ({ code: 1 }), TURN_ACTOR_ELIGIBILITY_ACT: 1,
    runTraitHooks: () => {},
    HeroTurn: (runtimeCtx, uid) => executeHeroCommand(runtimeCtx, { actorUID: uid, targetUID: enemy.uid }),
    AdvanceTurn: () => { throw new Error('held fixture should not advance'); },
  };
  vm.createContext(context);
  vm.runInContext(`${processTurn}\nthis.ProcessTurn = ProcessTurn;`, context);
  return { context, globals, hero, enemy, ctx };
}

test('QA fixture hold permits one owner-bound ProcessTurn through the real command seam', () => {
  const source = read('web-runner/modules/functionBank.js');
  const hooks = read('web-runner/systems/devBrowserTestHooks.js');
  const processTurn = source.slice(source.indexOf('export function ProcessTurn(ctx)'), source.indexOf('function isBoardFullyPopulatedForEnemyMutation'));
  assert.match(processTurn, /QaFixtureExplicitActionOwnerUID/);
  assert.match(processTurn, /actor\?\.kind === 'hero'/);
  assert.match(processTurn, /finishQaFixtureExplicitAction/);
  assert.match(processTurn, /qaExplicitOwnerUID === Number\(uid \|\| 0\)/);
  assert.match(processTurn, /nativeCommandOwner/);
  assert.match(processTurn, /qaTrace\('qa-hold-blocked'\)/);
  assert.match(hooks, /QaFixtureExplicitActionOwnerUID = Number\(ownerUID \|\| 0\)/);
  assert.match(hooks, /delete state\.globals\.QaFixtureExplicitActionClaimed/);
  assert.match(hooks, /if \(!state\.globals\.QaFixtureExplicitActionClaimed\)/);

  const blocked = loadQaFixtureProcessTurnHarness();
  blocked.context.ProcessTurn(blocked.ctx);
  assert.equal(blocked.globals.NativeCommandSequence, undefined, 'automatic held ProcessTurn cannot create a command');
  assert.equal(blocked.globals.QaFixtureProcessTurnGate.reason, 'qa-hold-blocked');

  const matching = loadQaFixtureProcessTurnHarness({ tokenOwnerUID: 1 });
  matching.context.ProcessTurn(matching.ctx);
  assert.equal(matching.globals.NativeCommandSequence?.actorUID, 1, 'the matching selected hero creates the exact native command');
  assert.equal(matching.globals.DebugTurnCount, 1, 'one ProcessTurn crosses the production trigger exactly once');
  assert.equal(matching.globals.QaFixtureExplicitActionClaimed, 1);
  assert.equal(matching.globals.QaFixtureExplicitAction, undefined, 'the allowance is gone before an await can run');
  matching.context.ProcessTurn(matching.ctx);
  assert.equal(matching.globals.QaFixtureProcessTurnGate.reason, 'qa-hold-blocked', 'a spent token cannot authorize a second command');

  const wrongOwner = loadQaFixtureProcessTurnHarness({ tokenOwnerUID: 2 });
  wrongOwner.context.ProcessTurn(wrongOwner.ctx);
  assert.equal(wrongOwner.globals.NativeCommandSequence, undefined, 'a token for another actor cannot create a command');
  assert.equal(wrongOwner.globals.QaFixtureProcessTurnGate.reason, 'qa-hold-blocked');
});

test('QA fixture hold closes an idle completed phase before its explicit owner command', () => {
  const harness = loadQaFixtureProcessTurnHarness();
  harness.globals.TurnPhase = 2;
  harness.context.ProcessTurn(harness.ctx);
  assert.equal(harness.globals.NativeCommandSequence, undefined, 'the hold blocks the completed enemy phase from claiming a command');
  assert.equal(harness.globals.QaFixtureProcessTurnGate.reason, 'qa-hold-blocked');
  // The fixture lifecycle delegates this transition to production AdvanceTurn;
  // after it returns phase zero, the selected owner may claim exactly once.
  harness.globals.TurnPhase = 0;
  harness.globals.QaFixtureExplicitAction = 1;
  harness.globals.QaFixtureExplicitActionOwnerUID = 1;
  harness.globals.QaFixtureExplicitActionClaimed = 0;
  harness.context.ProcessTurn(harness.ctx);
  assert.equal(harness.globals.NativeCommandSequence?.actorUID, 1);
  assert.equal(harness.globals.QaFixtureExplicitActionClaimed, 1);
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
  assert.match(fixtureRun, /orb: \{ attempts: orbCadence/);
  assert.match(fixtureRun, /venom: \{ attempts: 1/);
  assert.match(fixtureRun, /bounce requires two distinct living enemies/);
  assert.match(fixtureRun, /distinctTargets: Number\(primary\?\.uid \|\| 0\) !== Number\(secondary\?\.uid \|\| 0\)/);
  assert.match(fixtureRun, /ExecuteEnemyJobSkill', enemy\.uid, 'Enemy_ATK_Single', owner\.uid/);
  assert.match(fixtureRun, /arrangeOwnerTurn\(owner, currentTarget\)/);
  assert.match(hooks, /initiative\.current = scheduledOwner/);
  assert.match(hooks, /InitiativeCurrentUID = scheduledOwner\.uid/);
  assert.match(fixtureRun, /installQaFixtureRuntimeRandom\(QA_FIXTURE_RUNTIME_ENCOUNTER_SEED\)/);
  assert.match(fixtureRun, /const idleBefore = await waitForFixtureIdle\(\{ allowDeferredAdvance: !!state\.globals\.QaFixtureHoldTurn \}\)/);
  assert.match(fixtureRun, /const idleAfter = await waitForFixtureIdle\(\{ allowDeferredAdvance: !!state\.globals\.QaFixtureHoldTurn \}\)/);
  assert.match(fixtureRun, /delete state\.globals\.SessionLevelBuffCombatSessionId/);
  assert.match(fixtureRun, /ownerHPBeforeIncomingHit: ownerHPBefore, ownerHPAfterIncomingDamage, ownerHPAfterCounterHeal/);
  assert.match(fixtureRun, /Number\(visual\.amount\) === 6/);
  assert.match(fixtureRun, /orbEvidence\?\.actualBasicsToProc === orbCadence && orbEvidence\?\.amount === orbAmount/);
  assert.match(fixtureRun, /actualBasicsToProc: ownerBasicAttempts, amount: Number\(visual\.amount \|\| 0\)/);
  assert.match(fixtureRun, /const resolvedPrimaryDamage = primaryHPBefore - primaryHPAfter/);
  assert.match(fixtureRun, /damagePercent: Number\(chain\?\.damagePercent \|\| 0\)/);
  assert.match(fixtureRun, /resolvedSecondaryDamage: Number\(chain\?\.resolvedDamage \|\| 0\)/);
  assert.match(fixtureRun, /bounceEvidence\?\.damagePercent === \.50/);
  assert.match(fixtureRun, /actualSecondaryDamage === bounceEvidence\?\.resolvedSecondaryDamage/);
  assert.match(fixtureRun, /primaryHPBefore, primaryHPAfter, resolvedPrimaryDamage/);
  assert.match(fixtureRun, /snapshotPotency === 3/);
  assert.match(fixtureRun, /const resolveQaVenomDotTurns = target => \{/);
  assert.match(fixtureRun, /turnStart\(rulesContext\(fnContext\), target, firstSerial\)/);
  assert.match(fixtureRun, /venomTurnEvidence\?\.damage === 3/);
  assert.match(fixtureRun, /markerVisibleBefore[\s\S]*markerAbsentAfterExpiry/);
  assert.match(fixtureRun, /delete state\.globals\.QaFixtureResult/);
  assert.match(fixtureRun, /state\.globals\.QaFixtureResult = fixtureResult/);
  assert.match(fixtureRun, /counterBeforeFirstOwnerBasic: firstOwnerBasicEvidence\?\.counterBefore/);
  assert.match(fixtureRun, /targetTurnTickDelta: venomTurnEvidence\?\.damage/);
  assert.match(fixtureRun, /statusMarkerAbsentAfterExpiry: venomTurnEvidence\?\.markerAbsentAfterExpiry/);
  assert.match(fixtureRun, /QaFixtureHoldReleaseCount = fixtureReleaseCountBefore \+ 1/);
  assert.match(fixtureRun, /QA_FIXTURE_INELIGIBLE_PROC_ENCOUNTER_SEED/);
  assert.match(fixtureRun, /healEvidence\?\.actualHeal === healEvidence\?\.expectedHeal/);
  assert.match(fixtureRun, /bounceEvidence\?\.actualSecondaryDamage === bounceEvidence\?\.resolvedSecondaryDamage/);
  assert.match(fixtureRun, /counterEvidence\?\.actualCounterDamage === counterEvidence\?\.resolvedCounterDamage/);
  assert.match(fixtureRun, /for \(let attempt = 0; attempt < scenario\.attempts && !scenario\.observed\(\); attempt \+= 1\)/);
  assert.match(fixtureRun, /ineligibleTriggerNoHeal/);
  assert.match(fixtureRun, /addedHitTriggeredNoSessionEffects/);
  assert.match(fixtureRun, /otherHeroNoTrigger/);
  assert.match(fixtureRun, /turnSerialBefore, turnSerialAfter/);
  assert.match(fixtureRun, /counterCount: counterDamageTexts\.length, recursiveCounterCount: Math\.max\(0, counterDamageTexts\.length - 1\)/);
  assert.match(fixtureRun, /counterPresentationObserved/);
  assert.match(fixtureRun, /atMaxHpCap/);
  assert.match(fixtureRun, /for \(let attempt = 0; attempt < scenario\.attempts/);
  assert.match(fixtureRun, /did not produce its required observable production result/);
  assert.doesNotMatch(fixtureRun, /seedProductionEncounter\(\)/);
  assert.doesNotMatch(fixtureRun, /resolveSessionLevelBasicEffects|resolveSessionLevelCounter|applySessionLevelBuffsAtBattleStart/);
});

test('every QA fixture option resolves to its stable scenario and production card identity', () => {
  const { QA_LEVEL_UP_FIXTURE_CARD_IDS, resolveQaLevelUpFixtureKey, resolveQaFixtureOfferCardId } = loadQaFixtureIdentity();
  const hooks = read('web-runner/systems/devBrowserTestHooks.js');
  const fixtureRun = hooks.slice(hooks.indexOf("['QA run fixture'"), hooks.indexOf("['QA next battle'"));
  const optionValues = [...hooks.matchAll(/new Option\(name, name\)/g)];
  assert.equal(optionValues.length, 1, 'the selector must expose fixture keys, never card IDs');

  for (const [fixture, cardId] of Object.entries(QA_LEVEL_UP_FIXTURE_CARD_IDS)) {
    assert.equal(resolveQaLevelUpFixtureKey(fixture), fixture);
    assert.equal(resolveQaLevelUpFixtureKey(cardId), fixture);
    assert.match(fixtureRun, new RegExp(`\\b${fixture}: \\{`), `missing ${fixture} scenario`);
    assert.match(hooks, new RegExp(`\\b${fixture}: '${cardId}'`), `missing ${fixture} card mapping`);
  }
  assert.equal(resolveQaLevelUpFixtureKey('missing-fixture'), null);
  assert.equal(resolveQaFixtureOfferCardId('orb', { cards: QA_LEVEL_UP_BUFF_CARDS }), 'qa_orb_cadence_1', 'Orb keeps its Tier 1 default');
  assert.equal(resolveQaFixtureOfferCardId('orb', { selectedCardId: 'qa_orb_cadence_2', cards: QA_LEVEL_UP_BUFF_CARDS }), 'qa_orb_cadence_2', 'an explicit Orb upgrade drives its own offer');
  const base = applyLevelUpBuffCard({ state: createSessionLevelBuffState(), heroId: 'hondo-1', cardId: 'qa_orb_cadence_1', cards: QA_LEVEL_UP_BUFF_CARDS });
  const tierTwo = getEligibleLevelUpBuffCards({ state: base.state, heroId: 'hondo-1', cards: QA_LEVEL_UP_BUFF_CARDS, tier: 2 });
  assert.ok(tierTwo.some(card => card.cardId === 'qa_orb_cadence_2'), 'Tier 2 Orb is eligible only after the real base grant');
  const upgraded = applyLevelUpBuffCard({ state: base.state, heroId: 'hondo-1', cardId: 'qa_orb_cadence_2', cards: QA_LEVEL_UP_BUFF_CARDS });
  assert.equal(upgraded.replacedStage, 1);
  assert.equal(upgraded.state.heroes['hondo-1'].activeStageByEffectId.qa_orb_cadence, 2);
});

test('the QA fixture RNG seam reinstalls the production-derived stream for the current battle', () => {
  const app = read('web-runner/app.js');
  assert.match(app, /installQaFixtureRuntimeRandom: encounterSeed => installCombatRuntimeRandom\(deriveCombatRuntimeRngSeed\(encounterSeed\), 'quest-qa-fixture'\)/);
});

test('Battle B holds automatic scheduling through fixture evidence while permitting one explicit production action', () => {
  const hooks = read('web-runner/systems/devBrowserTestHooks.js');
  const commands = read('web-runner/modules/functionBank.js');
  const app = read('web-runner/app.js');
  const nextBattle = hooks.slice(hooks.indexOf("['QA next battle'"), hooks.indexOf("['QA fresh session'"));
  const fixtureRun = hooks.slice(hooks.indexOf("['QA run fixture'"), hooks.indexOf("['QA next battle'"));
  assert.match(nextBattle, /QaFixtureHoldTurn = 1/);
  assert.match(nextBattle, /QaFixtureHoldTurn = 1;[\s\S]*seedProductionEncounter\(\)/);
  assert.match(nextBattle, /QaFixtureBattleBaseline[\s\S]*catch \(error\) \{\s*delete state\.globals\.QaFixtureHoldTurn/);
  assert.match(hooks, /const runQaFixtureProductionAction = async \(ownerUID, action\) => \{\s*state\.globals\.QaFixtureExplicitAction = 1/);
  assert.match(hooks, /const arrangeOwnerAsNextSchedulerActor = \(owner, target\) => \{/);
  assert.match(fixtureRun, /const closeCompletedFixturePhase = async \(target, priorSequence\) => \{/);
  assert.match(fixtureRun, /await runQaFixtureProductionAction\(owner\.uid, \(\) => \{[\s\S]*callFunctionWithContext\(fnContext, 'AdvanceTurn'\)/);
  assert.match(fixtureRun, /const tokenUnclaimed = !!state\.globals\.QaFixtureExplicitAction && !state\.globals\.QaFixtureExplicitActionClaimed/);
  assert.match(fixtureRun, /postAdvance\.currentUID === Number\(owner\.uid\)[\s\S]*postAdvance\.phase === 0/);
  assert.match(fixtureRun, /tokenUnclaimed && ownerReady[\s\S]*callFunctionWithContext\(fnContext, 'ProcessTurn'\)/);
  assert.match(fixtureRun, /callFunctionWithContext\(fnContext, 'AdvanceTurn'\)/);
  assert.match(fixtureRun, /const phaseClosed = await closeCompletedFixturePhase\(currentTarget, priorSequence\)/);
  assert.match(fixtureRun, /if \(!phaseClosed\.commandStarted\) \{[\s\S]*callFunctionWithContext\(fnContext, 'ProcessTurn'\)/);
  assert.match(fixtureRun, /const deferredAdvancePending = !!state\.globals\.DeferAdvance/);
  assert.match(fixtureRun, /resolveQaFixtureDeferredAdvance\(\);[\s\S]*!observed\.deferAdvance[\s\S]*await runQaFixtureProductionAction\(owner\.uid, \(\) => \{\s*callFunctionWithContext\(fnContext, 'ProcessTurn'\)/);
  assert.match(fixtureRun, /const completed = await waitForFixtureAction\(observed => observed\.nativeCommandOwner === 0[\s\S]*captureFreshVisuals\(\);\s*ownerBasicAttempts \+= 1;\s*const counterAfter/);
  assert.doesNotMatch(fixtureRun, /owner basic did not complete:[\s\S]*callFunctionWithContext\(fnContext, 'AdvanceTurn'\)/);
  assert.match(fixtureRun, /counterAfter !== counterBefore \+ 1/);
  assert.match(fixtureRun, /await runOwnerBasicAttempt\(attempt\)/);
  assert.match(fixtureRun, /finally \{[\s\S]*delete state\.globals\.QaFixtureHoldTurn/);
  assert.match(commands, /if \(g\.QaFixtureHoldTurn && !qaExplicitActionAllowed\)/);
  assert.match(app, /resolveQaFixtureDeferredAdvance: \(\) => \{[\s\S]*callFunctionWithContext\(fnContext, 'AdvanceTurn'\);[\s\S]*applyTurnGateIntent\(createDeferredAdvanceResolved\)/);
  assert.match(app, /state\.globals\.DeferAdvance &&\s*!state\.globals\.QaFixtureHoldTurn/);
  assert.match(app, /state\.globals\.GamePhase === 'RUNTIME' &&\s*!state\.globals\.QaFixtureHoldTurn &&\s*!state\.globals\.BattleStartActive &&\s*currentTurnType === 1/);
});

test('the Phase 4 fixture table keeps Pulse, staged Orb, and Venom identities distinct', () => {
  const cards = read('web-runner/modules/sessionLevelUpBuffPresentation.mjs');
  assert.match(cards, /qa_pulse_1[\s\S]*everyCompletedBasics: 2, amount: 6/);
  assert.match(cards, /qa_orb_cadence_1[\s\S]*everyCompletedBasics: 3, amount: 4/);
  assert.match(cards, /qa_orb_cadence_2[\s\S]*requiresStage: 1, replacesStage: 1[\s\S]*everyCompletedBasics: 2, amount: 6/);
  assert.match(cards, /statusId: 'qa_venom'/);
});

test('the staged Orb QA workflow returns to victory settlement before the held Tier 2 battle', () => {
  const hooks = read('web-runner/systems/devBrowserTestHooks.js');
  const fixtureRun = hooks.slice(hooks.indexOf("['QA run fixture'"), hooks.indexOf("['QA next battle'"));
  const fixtureOffer = hooks.slice(hooks.indexOf('const beginQaFixtureOffer'), hooks.indexOf("['QA defeat'"));
  const nextBattle = hooks.slice(hooks.indexOf("['QA next battle'"), hooks.indexOf("['QA fresh session'"));
  assert.match(fixtureRun, /const orbCadence = Number\(fixtureCard\?\.formula\?\.everyCompletedBasics \|\| 3\)/);
  assert.match(fixtureRun, /const orbAmount = Number\(fixtureCard\?\.formula\?\.amount \|\| 4\)/);
  assert.match(fixtureOffer, /claimQaSettlementHold\(\)[\s\S]*setQaFixtureOfferPool\(fixtureSelect\.value\)[\s\S]*beginRewardSettlement\(\{ holdClaimed: true \}\)/);
  assert.match(nextBattle, /QaFixtureHoldTurn = 1;[\s\S]*seedProductionEncounter\(\)/);
  assert.doesNotMatch(hooks, /QaFixtureOfferHold|QaFixtureOfferArmed|QaFixtureOfferStartTurnCount/);
});

test('QA continuation transfers the hold to Battle B before scheduling and keeps defeat terminal', () => {
  const hooks = read('web-runner/systems/devBrowserTestHooks.js');
  const nextBattle = hooks.slice(hooks.indexOf("['QA next battle'"), hooks.indexOf("['QA fresh session'"));
  const offer = hooks.slice(hooks.indexOf('const beginQaFixtureOffer'), hooks.indexOf("['QA defeat'"));
  assert.match(nextBattle, /QaFixtureHoldTurn = 1;[\s\S]*seedProductionEncounter\([\s\S]*storyEntry\.victory\(\)/);
  assert.match(nextBattle, /catch \(error\) \{\s*delete state\.globals\.QaFixtureHoldTurn/);
  assert.match(nextBattle, /priorBattle\.outcome === 'defeat' \|\| priorBattle\.defeatSettled/);
  assert.match(offer, /battle\.outcome === 'defeat' \|\| battle\.defeatSettled/);
  assert.doesNotMatch(hooks, /advanceQaVictoryResult|battle-results/);
});

test('production effect visuals retain the fixture payload needed for current-run QA deltas', () => {
  const commands = read('web-runner/modules/heroCommands.mjs');
  assert.match(commands, /shape:'crescent_arc_blast'[\s\S]*amount:Number\(formula\.amount\|\|0\)/);
  assert.match(commands, /visual:'chain_strike',damagePercent:Number\(formula\.damagePercent\|\|0\)/);
  assert.match(commands, /visual\.resolvedDamage=Math\.max\(0,before-Number\(bounce\.hp\|\|0\)\)/);
});

function loadQaPlayableBattleWait() {
  const source = read('web-runner/systems/devBrowserTestHooks.js');
  const start = source.indexOf('export function qaPlayableBattleSnapshot');
  const end = source.indexOf('export function registerDevBrowserTestHooks', start);
  assert.notEqual(start, -1, 'missing playable Battle B helper');
  const context = {}; vm.createContext(context);
  context.derivePresentationTurnBarrier = derivePresentationTurnBarrier;
  vm.runInContext(source.slice(start, end).replace('export function', 'function').replace('export async function', 'async function') + '\nthis.waitForPlayableBattle = waitForPlayableBattle; this.qaPlayableBattleSnapshot = qaPlayableBattleSnapshot;', context);
  return { waitForPlayableBattle: context.waitForPlayableBattle, qaPlayableBattleSnapshot: context.qaPlayableBattleSnapshot };
}

test('QA waits through delayed encounter replacement and an enemy-action gate before allowing the owner turn', async () => {
  const { waitForPlayableBattle } = loadQaPlayableBattleWait();
  let time = 0;
  const entry = { phase: 'combat', pending: false };
  const globals = { time: 0, EnemyAction: { active: true }, ActionInProgress: 1, ActionLockUntil: 1 };
  const entities = [{ uid: 7, kind: 'hero', hp: 50 }, { uid: 9, kind: 'enemy', hp: 50 }];
  const result = await waitForPlayableBattle({
    entry, globals, entities, getCurrentUID: () => 7, now: () => time, timeoutMs: 1000, pollMs: 20,
    wait: async ms => { time += ms; globals.time = time / 1000; if (time >= 180) { globals.EnemyAction.active = false; globals.ActionInProgress = 0; globals.ActionLockUntil = 0; } },
  });
  assert.equal(result.ok, true);
  assert.ok(result.elapsedMs >= 180);
  assert.equal(result.observed.enemyActionActive, false);
});

test('QA fixture hold accepts a completed owner action with its central deferred advance pending', () => {
  const { qaPlayableBattleSnapshot } = loadQaPlayableBattleWait();
  const entry = { phase: 'combat', pending: false };
  const globals = { DeferAdvance: 1 };
  const entities = [{ uid: 7, kind: 'hero', hp: 50 }, { uid: 9, kind: 'enemy', hp: 50 }];
  assert.equal(qaPlayableBattleSnapshot({ entry, globals, entities, currentUID: 7 }).ok, false);
  assert.equal(qaPlayableBattleSnapshot({ entry, globals, entities, currentUID: 7, allowDeferredAdvance: true }).ok, true);
});

test('QA fixture hold waits for a lingering production text presentation before the next owner token', () => {
  const { qaPlayableBattleSnapshot } = loadQaPlayableBattleWait();
  const entry = { phase: 'combat', pending: false };
  const globals = { DeferAdvance: 1, TextAnimEndAt: 10, time: 9 };
  const entities = [{ uid: 7, kind: 'hero', hp: 50 }, { uid: 9, kind: 'enemy', hp: 50 }];
  assert.equal(qaPlayableBattleSnapshot({ entry, globals, entities, currentUID: 7, allowDeferredAdvance: true }).ok, false);
  assert.equal(qaPlayableBattleSnapshot({ entry, globals: { ...globals, time: 10 }, entities, currentUID: 7, allowDeferredAdvance: true }).ok, true);
});

test('QA continuation preserves its pre-transition permanent baseline until Battle B is playable', () => {
  const hooks = read('web-runner/systems/devBrowserTestHooks.js');
  const nextBattle = hooks.slice(hooks.indexOf("['QA next battle'"), hooks.indexOf("['QA fresh session'"));
  assert.match(nextBattle, /const preBattleBaseline = \{ fixture, \.\.\.snapshotFixtureBaseline\(owner, target\) \}/);
  assert.match(nextBattle, /storyEntry\.victory\(\)[\s\S]*waitForPlayableBattle[\s\S]*QaFixtureBattleBaseline = \{ \.\.\.preBattleBaseline/);
  assert.match(nextBattle, /liveOwnerUID/);
});

test('continuing Battle B clears outgoing action gates while retaining selected owner buffs', () => {
  const selected = applyLevelUpBuffCard({
    state: createSessionLevelBuffState(), heroId: 'fara-1', cardId: 'qa_atk_focus_1', cards: QA_LEVEL_UP_BUFF_CARDS,
  });
  const globals = {
    ProgressionBattle: { outcome: 'victory' }, SessionLevelBuffState: selected.state,
    IsPlayerBusy: 1, ActionInProgress: 1, ActionActorUID: 9, ActionOwnerUID: 9,
    ActionLockUntil: 99, DeferAdvance: 1, AdvanceAfterAction: 1, TextAnimEndAt: 99,
    PendingHeroHits: [{ heroUID: 1 }], EnemyAction: { active: true }, NativeCommandSequence: { actorUID: 1 },
  };
  resetCombatSessionConditions(globals, {}, { preserveSessionLevelBuffs: true });
  assert.deepEqual(globals.SessionLevelBuffState, selected.state);
  assert.equal(globals.IsPlayerBusy, 0);
  assert.equal(globals.ActionInProgress, 0);
  assert.equal(globals.ActionLockUntil, 0);
  assert.equal(globals.PendingHeroHits.length, 0);
  assert.equal(globals.EnemyAction, undefined);
  assert.equal(globals.NativeCommandSequence, null);
});

test('the continuing-adventure initializer resets action transients before its Battle B scheduler intro', () => {
  const initializer = read('web-runner/systems/combatSessionInitializer.js');
  const reset = read('web-runner/systems/combatSessionReset.mjs');
  assert.match(initializer, /resetCombatSessionConditions\(state\.globals, gameState, \{ preserveSessionLevelBuffs: continuingAdventure \}\)[\s\S]*state\.globals\.BattleStartActive = 1/);
  assert.match(reset, /PendingHeroHits: \[\][\s\S]*IsPlayerBusy: 0, ActionInProgress: 0[\s\S]*ActionLockUntil: 0/);
});

test('StoryEntry releases the initializer busy hold once after Battle B transition completion', () => {
  const selected = applyLevelUpBuffCard({
    state: createSessionLevelBuffState(), heroId: 'fara-1', cardId: 'qa_atk_focus_1', cards: QA_LEVEL_UP_BUFF_CARDS,
  });
  const globals = {
    GamePhase: 'RUNTIME', ProgressionBattle: { outcome: 'victory' }, SessionLevelBuffState: selected.state,
    IsPlayerBusy: 1, ActionInProgress: 1, PendingHeroHits: [{ heroUID: 9 }],
  };
  // Battle A reset runs first, then the Battle B initializer owns its intro hold.
  resetCombatSessionConditions(globals, {}, { preserveSessionLevelBuffs: true });
  assert.equal(globals.IsPlayerBusy, 0);
  globals.BattleStartActive = 1;
  globals.BattleStartClearedForSession = 0;
  globals.BattleStartProcessStarted = 0;
  globals.IsPlayerBusy = 1;
  assert.equal(releaseCombatStartToScheduler(globals), true);
  assert.equal(globals.IsPlayerBusy, 0);
  assert.equal(globals.BattleStartActive, 0);
  assert.equal(globals.BattleStartProcessStarted, 1);
  assert.deepEqual(globals.SessionLevelBuffState, selected.state);
  assert.equal(releaseCombatStartToScheduler(globals), false, 'the completion seam cannot release a second scheduler turn');
  const app = read('web-runner/app.js');
  assert.match(app, /createCombatEntryTransition\(canvas, \{ onComplete: \(\) => \{[\s\S]*releaseCombatStartToScheduler\(state\.globals\)[\s\S]*runCombatStep\(fnContext, 'ProcessTurn'\)/);
});
