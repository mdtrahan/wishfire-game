const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const repoRoot = path.join(__dirname, '..');
const corePairs = [
  {
    name: 'shared core',
    rulesPath: path.join(repoRoot, 'src', 'core', 'gemActionRules.mjs'),
    gatePath: path.join(repoRoot, 'src', 'core', 'turnGateController.mjs'),
  },
  {
    name: 'web runner core',
    rulesPath: path.join(repoRoot, 'web-runner', 'src', 'core', 'gemActionRules.mjs'),
    gatePath: path.join(repoRoot, 'web-runner', 'src', 'core', 'turnGateController.mjs'),
  },
];

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function loadSuperGemRuntime() {
  const src = read('web-runner/systems/superGemRuntime.js')
    .replace(/export function /g, 'function ')
    .replace(/export \{ SUPER_GEM_COST \};/g, '')
    + '\nmodule.exports = { activateSuperGemEffect };';
  const context = { module: { exports: {} }, exports: {}, Math, Number, String, Array, Map };
  vm.runInNewContext(src, context, { filename: 'superGemRuntime.js' });
  return context.module.exports;
}

function assertNear(actual, expected, label) {
  assert.ok(Math.abs(Number(actual) - Number(expected)) < 1e-9, `${label}: expected ${expected}, got ${actual}`);
}

function appClaimGate({ globals, currentTurnType = 0, pendingBarrier }) {
  if (!Number(globals.SkillDraughtPendingOpen || 0)) return false;
  if (Number(globals.SkillDraughtOpen || 0)) return false;
  if (currentTurnType !== 0) return false;
  if (!globals.DeferAdvance || !globals.AdvanceAfterAction) return false;
  if (Number(globals.ActionLockUntil || 0) > Number(globals.time || 0)) return false;
  if (globals.IsPlayerBusy || globals.ActionInProgress || globals.PendingSkillID) return false;
  return !!pendingBarrier.canClaimSkillDraught;
}

function claimReadyGlobals({ time, actionLockUntil, heroUID = 42 }) {
  return {
    time,
    TurnPhase: 0,
    SkillDraughtPendingOpen: 1,
    SkillDraughtPendingHeroUID: heroUID,
    SkillDraughtOpen: 0,
    DeferAdvance: 1,
    AdvanceAfterAction: 1,
    ActionLockUntil: actionLockUntil,
    IsPlayerBusy: 0,
    ActionInProgress: 0,
    PendingSkillID: '',
  };
}

for (const core of corePairs) {
  test(`full Astral Flow blue merges claim the draw after the short handoff in ${core.name}`, async () => {
    const { gemActionFromJs } = await import(pathToFileURL(core.rulesPath));
    const { derivePresentationTurnBarrier } = await import(pathToFileURL(core.gatePath));

    for (let i = 0; i < 96; i += 1) {
      const consumedCount = 3 + (i % 5);
      const astralFlowAmpMax = 18 + (i % 3) * 3;
      const astralFlowAmpPoints = astralFlowAmpMax - consumedCount;
      const time = 20 + i * 0.17;
      const actionLockUntil = i % 11 === 0 ? time + 0.45 : (i % 7 === 0 ? time + 0.1 : 0);
      const decision = gemActionFromJs({
        gemColor: 2,
        consumedCount,
        astralFlowWallet: 50 + i,
        astralFlowAmpPoints,
        astralFlowAmpMax,
        astralFlowAmpReady: 0,
        time,
        actionLockUntil,
      });
      const expectedLock = Math.max(actionLockUntil, time + 0.32);

      assert.equal(decision.blueOpenDraught, 1, `case ${i} should queue Astral Flow draw`);
      assert.equal(decision.blueAmpReadyAfter, 1, `case ${i} should mark amp ready`);
      assert.equal(decision.deferAdvance, 1, `case ${i} should defer advance`);
      assert.equal(decision.advanceAfterAction, 1, `case ${i} should advance after modal handoff`);
      assertNear(decision.actionLockUntil, expectedLock, `case ${i} action lock`);
      assert.ok(decision.actionLockUntil < time + 1, `case ${i} should not use combat text read-time as action lock`);

      const globals = claimReadyGlobals({
        time: decision.actionLockUntil + 0.001,
        actionLockUntil: decision.actionLockUntil,
      });
      const pendingBarrier = derivePresentationTurnBarrier({ globals, boardHasEmptySlots: true });
      assert.equal(pendingBarrier.firstBlockingLane, 'skill-draught-pending', `case ${i} should hold on pending draw`);
      assert.equal(pendingBarrier.canStartRefill, false, `case ${i} should block refill`);
      assert.equal(pendingBarrier.canAdvanceTurn, false, `case ${i} should block enemy/turn advance`);
      assert.equal(appClaimGate({ globals, pendingBarrier }), true, `case ${i} should be claimable at the hero checkpoint`);
    }
  });

  test(`non-full blue Astral Flow merges do not queue a draw in ${core.name}`, async () => {
    const { gemActionFromJs } = await import(pathToFileURL(core.rulesPath));

    for (let i = 0; i < 48; i += 1) {
      const consumedCount = 3 + (i % 4);
      const astralFlowAmpMax = 18 + (i % 2) * 6;
      const astralFlowAmpPoints = Math.max(0, astralFlowAmpMax - consumedCount - 1);
      const decision = gemActionFromJs({
        gemColor: 2,
        consumedCount,
        astralFlowWallet: i,
        astralFlowAmpPoints,
        astralFlowAmpMax,
        astralFlowAmpReady: 0,
        time: 60 + i,
      });

      assert.equal(decision.blueOpenDraught, 0, `case ${i} should not queue Astral Flow draw before threshold`);
      assert.equal(decision.blueAmpReadyAfter, 0, `case ${i} should not mark amp ready before threshold`);
    }
  });

  test(`skill draw pending and open barriers pause refill, turn advance, and actions in ${core.name}`, async () => {
    const { derivePresentationTurnBarrier } = await import(pathToFileURL(core.gatePath));
    const pending = derivePresentationTurnBarrier({
      globals: claimReadyGlobals({ time: 75, actionLockUntil: 74.9 }),
      boardHasEmptySlots: true,
    });
    assert.equal(pending.canClaimSkillDraught, true);
    assert.equal(pending.canStartRefill, false);
    assert.equal(pending.canAdvanceTurn, false);
    assert.equal(pending.canClaimCombatAction, false);
    assert.equal(pending.canResolvePendingTargetAction, false);
    assert.equal(pending.canRestoreHeroInput, false);

    const open = derivePresentationTurnBarrier({
      globals: { time: 75, TurnPhase: 0, SkillDraughtOpen: 1 },
      boardHasEmptySlots: true,
    });
    assert.equal(open.firstBlockingLane, 'skill-draught');
    assert.equal(open.canClaimSkillDraught, false);
    assert.equal(open.canStartRefill, false);
    assert.equal(open.canAdvanceTurn, false);
    assert.equal(open.canClaimCombatAction, false);
    assert.equal(open.canResolvePendingTargetAction, false);
    assert.equal(open.canRestoreHeroInput, false);
  });
}

test('blue supergem draw is claimable after the same short handoff across repeated live-like runs', async () => {
  const { activateSuperGemEffect } = loadSuperGemRuntime();
  const { derivePresentationTurnBarrier } = await import(pathToFileURL(corePairs[1].gatePath));

  for (let i = 0; i < 64; i += 1) {
    const time = 100 + i * 0.13;
    const heroUID = 1000 + i;
    const calls = [];
    const state = {
      globals: {
        time,
        RuntimeRandom: () => ((i % 10) + 0.25) / 10,
        AstralFlowWallet: i,
        AstralFlowAmpPoints: i % 18,
        AstralFlowAmpReady: 0,
      },
    };
    const activated = activateSuperGemEffect({
      superGem: { baseColor: 2 },
      actorUID: heroUID,
      selectedEnemyUID: 0,
      state,
      callFunctionWithContext: (_ctx, name, ...args) => {
        calls.push({ name, args });
        if (name === 'QueueSkillDraughtForHero') {
          state.globals.SkillDraughtPendingOpen = 1;
          state.globals.SkillDraughtPendingHeroUID = args[0];
          return { ok: true };
        }
        return undefined;
      },
      fnContext: {},
      sourceItems: [{ x: i % 4, y: i % 5, color: 2 }],
      consumedColorGemCount: 99,
      startGemMergeFx: () => {},
      getGoldLabelTargetWorld: () => null,
    });

    assert.equal(activated, true, `case ${i} should activate`);
    assert.deepEqual(calls.filter(call => call.name === 'QueueSkillDraughtForHero').map(call => call.args), [[heroUID]]);
    assert.equal(calls.some(call => call.name === 'OpenSkillDraughtForHero'), false, `case ${i} should queue, not open mid-action`);
    assertNear(state.globals.ActionLockUntil, time + 0.32, `case ${i} blue supergem action lock`);
    assert.equal(state.globals.SkillDraughtPendingOpen, 1, `case ${i} should queue pending draw`);
    assert.equal(state.globals.DeferAdvance, 1, `case ${i} should defer advance`);
    assert.equal(state.globals.AdvanceAfterAction, 1, `case ${i} should advance after modal handoff`);

    const globals = claimReadyGlobals({
      time: state.globals.ActionLockUntil + 0.001,
      actionLockUntil: state.globals.ActionLockUntil,
      heroUID,
    });
    const pendingBarrier = derivePresentationTurnBarrier({ globals, boardHasEmptySlots: true });
    assert.equal(appClaimGate({ globals, pendingBarrier }), true, `case ${i} blue supergem should be claimable`);
    assert.equal(pendingBarrier.canStartRefill, false, `case ${i} blue supergem should block refill until claimed`);
    assert.equal(pendingBarrier.canAdvanceTurn, false, `case ${i} blue supergem should block enemy/turn advance until claimed`);
  }
});
