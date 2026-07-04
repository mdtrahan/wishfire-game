const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const dynamicSchedulerPaths = [
  'src/core/dynamicInitiativeRules.mjs',
  'web-runner/src/core/dynamicInitiativeRules.mjs',
];

async function loadScheduler(relPath) {
  return import(pathToFileURL(path.join(__dirname, '..', relPath)).href);
}

for (const schedulerPath of dynamicSchedulerPaths) {
  test(`dynamic initiative source removes burst caps and repeat-limit concepts in ${schedulerPath}`, () => {
    const src = fs.readFileSync(path.join(__dirname, '..', schedulerPath), 'utf8');

    assert.doesNotMatch(src, /burst/i);
    assert.doesNotMatch(src, /maxConsecutive/i);
    assert.doesNotMatch(src, /consecutiveTurns/i);
    assert.doesNotMatch(src, /extra.?turn/i);
    assert.doesNotMatch(src, /repeat/i);
    assert.doesNotMatch(src, /ticksElapsed|maxTicks/i);
  });

  test(`dynamic initiative accumulates Speed into Progress after an action completes in ${schedulerPath}`, async () => {
    const scheduler = await loadScheduler(schedulerPath);
    const actors = [
      { uid: 1, type: 0, spd: 30, hp: 40, name: 'Falie' },
      { uid: 101, type: 1, spd: 15, hp: 20, name: 'Djinn' },
    ];

    const result = scheduler.applyDynamicInitiativeActionCompleted({
      actors,
      progress: { 1: 10, 101: 90 },
    });

    assert.deepEqual(result.progress, { 1: 40, 101: 105 });
    assert.deepEqual(result.eligible.map(actor => actor.uid), [1, 101]);
    assert.deepEqual(result.skipped, []);
  });

  test(`dynamic initiative preserves overflow so successive turns emerge from Progress math in ${schedulerPath}`, async () => {
    const scheduler = await loadScheduler(schedulerPath);
    const actors = [
      { uid: 1, type: 0, spd: 100, hp: 40, name: 'Falie' },
      { uid: 101, type: 1, spd: 10, hp: 20, name: 'Djinn' },
    ];

    const first = scheduler.selectDynamicInitiativeTurn({
      actors,
      progress: { 1: 250, 101: 60 },
      threshold: 100,
    });

    assert.equal(first.actor.uid, 1);
    assert.equal(first.turn.progressBeforeAct, 250);
    assert.equal(first.turn.overflowBeforeAct, 150);
    assert.deepEqual(first.progress, { 1: 150, 101: 60 });

    const afterFirstAction = scheduler.applyDynamicInitiativeActionCompleted({
      actors,
      progress: first.progress,
    });
    const second = scheduler.selectDynamicInitiativeTurn({
      actors,
      progress: afterFirstAction.progress,
      threshold: 100,
    });

    assert.equal(second.actor.uid, 1);
    assert.equal(second.turn.progressBeforeAct, 250);
    assert.deepEqual(second.progress, { 1: 150, 101: 70 });
    assert.equal(second.reasons.some(reason => /cap|limit|repeat/i.test(reason.reason)), false);
  });

  test(`dynamic initiative tie break prefers hero over enemy when Progress is equal in ${schedulerPath}`, async () => {
    const scheduler = await loadScheduler(schedulerPath);
    const actors = [
      { uid: 101, type: 1, spd: 40, hp: 20, name: 'Djinn' },
      { uid: 1, type: 0, spd: 40, hp: 40, name: 'Falie' },
    ];

    const selected = scheduler.selectDynamicInitiativeTurn({
      actors,
      progress: { 1: 120, 101: 120 },
      threshold: 100,
    });

    assert.equal(selected.actor.uid, 1);
  });

  test(`dynamic initiative ordering is stable after Progress side and Speed ties in ${schedulerPath}`, async () => {
    const scheduler = await loadScheduler(schedulerPath);
    const actors = [
      { uid: 8, type: 0, spd: 30, hp: 20, name: 'Stable first' },
      { uid: 4, type: 0, spd: 30, hp: 20, name: 'Stable second' },
    ];

    const stableIndexWins = scheduler.selectDynamicInitiativeTurn({
      actors,
      progress: { 4: 120, 8: 120 },
      threshold: 100,
    });

    assert.equal(stableIndexWins.actor.uid, 8);
  });

  test(`dynamic initiative does not starve slower actors when faster actors act successively in ${schedulerPath}`, async () => {
    const scheduler = await loadScheduler(schedulerPath);
    const actors = [
      { uid: 1, type: 0, spd: 100, hp: 40, name: 'Fast' },
      { uid: 101, type: 1, spd: 10, hp: 20, name: 'Slow' },
    ];

    const preview = scheduler.previewDynamicInitiativeTurns({
      actors,
      threshold: 100,
      openingPolicy: { mode: 'hero_opener', remainingUIDs: { 1: true } },
      turnCount: 12,
    });

    assert.deepEqual(preview.turns.map(turn => turn.uid), [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 101]);
    assert.equal(preview.turns[0].openingPolicyTurn, true);
    assert.equal(preview.turns.some(turn => turn.uid === 101), true);
    assert.equal(preview.reasons.some(reason => /cap|limit|repeat/i.test(reason.reason)), false);
  });

  test(`dynamic initiative eligibility filtering skips ineligible actors and does not grant Progress to them in ${schedulerPath}`, async () => {
    const scheduler = await loadScheduler(schedulerPath);
    const actors = [
      { uid: 1, type: 0, spd: 20, hp: 0, name: 'Dead' },
      { uid: 2, type: 0, spd: 20, hp: 10, stunned: true, name: 'Stunned' },
      { uid: 3, type: 0, spd: 20, hp: 10, ableToAct: false, name: 'Disabled by gate' },
      { uid: 4, type: 1, spd: 20, hp: 10, name: 'Pending death' },
      { uid: 5, type: 1, spd: 20, hp: 10, statusEffects: ['paralyzed'], name: 'Paralyzed' },
      { uid: 6, type: 1, spd: 20, hp: 10, name: 'Eligible' },
    ];

    const result = scheduler.applyDynamicInitiativeActionCompleted({
      actors,
      progress: { 1: 80, 2: 80, 3: 80, 4: 80, 5: 80, 6: 80 },
      pendingDeaths: { 4: { group: 0 } },
    });

    assert.deepEqual(result.progress, { 6: 100 });
    assert.deepEqual(
      result.skipped.map(actor => [actor.uid, actor.reason]),
      [
        [1, 'dead'],
        [2, 'stunned'],
        [3, 'unable_to_act'],
        [4, 'pending_death'],
        [5, 'status_blocked:paralyzed'],
      ],
    );
  });

  test(`dynamic initiative models hero opener as explicit policy instead of team phase in ${schedulerPath}`, async () => {
    const scheduler = await loadScheduler(schedulerPath);
    const actors = [
      { uid: 1, type: 0, spd: 10, hp: 40, name: 'Falie' },
      { uid: 2, type: 0, spd: 8, hp: 35, name: 'Huun' },
      { uid: 101, type: 1, spd: 200, hp: 20, name: 'Djinn' },
    ];
    const openingPolicy = {
      mode: 'hero_opener',
      remainingUIDs: { 1: true, 2: true },
    };

    const first = scheduler.selectDynamicInitiativeTurn({
      actors,
      progress: { 1: 0, 2: 0, 101: 500 },
      openingPolicy,
      threshold: 100,
    });

    assert.equal(first.actor.uid, 1);
    assert.equal(first.turn.openingPolicyTurn, true);
    assert.deepEqual(first.openingPolicy.remainingUIDs, { 2: true });
    assert.deepEqual(first.progress, { 1: 0, 2: 0, 101: 500 });
    assert.ok(first.reasons.some(reason => reason.uid === 101 && reason.reason === 'opening_policy_hold'));

    const second = scheduler.selectDynamicInitiativeTurn({
      actors,
      progress: first.progress,
      openingPolicy: first.openingPolicy,
      threshold: 100,
    });

    assert.equal(second.actor.uid, 2);
    assert.equal(second.turn.openingPolicyTurn, true);
    assert.deepEqual(second.openingPolicy.remainingUIDs, {});
  });

  test(`dynamic initiative shadow audit compares team phase against frozen Progress contract in ${schedulerPath}`, async () => {
    const scheduler = await loadScheduler(schedulerPath);
    const actors = [
      { uid: 1, type: 0, spd: 10, hp: 40, name: 'Falie' },
      { uid: 2, type: 0, spd: 8, hp: 35, name: 'Huun' },
      { uid: 101, type: 1, spd: 30, hp: 20, name: 'Djinn' },
      { uid: 102, type: 1, spd: 5, hp: 20, name: 'Marid' },
      { uid: 103, type: 1, spd: 20, hp: 20, stunned: true, name: 'Stunned' },
    ];

    const audit = scheduler.createDynamicInitiativeShadowAudit({
      actors,
      currentTeamPhaseOrder: [1, 2, 101, 102],
      openingPolicy: { mode: 'hero_opener', remainingUIDs: { 1: true, 2: true } },
      threshold: 100,
      previewCount: 6,
    });

    assert.equal(audit.mode, 'shadow_only');
    assert.equal(audit.liveModeUnchanged, true);
    assert.equal(audit.proposedModel, 'dynamic_progress');
    assert.deepEqual(audit.currentOrder.map(turn => turn.uid), [1, 2, 101, 102]);
    assert.deepEqual(audit.proposedOrder.map(turn => turn.uid), [1, 2]);
    assert.ok(audit.skipped.some(actor => actor.uid === 103 && actor.reason === 'stunned'));
    assert.ok(audit.reasons.some(reason => reason.reason === 'opening_policy_hold'));
    assert.equal(audit.divergesFromCurrentOrder, true);
  });
}

test('default combat delegates actor selection to Dynamic Initiative without reviving legacy time initiative', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');

    assert.match(src, /function isTimeInitiative\(ctx\) \{\s*return false;\s*\}/);
    assert.match(src, /function ensureDynamicInitiativeDefaultState\(g\)/);
    assert.match(src, /function getDynamicInitiativeDefaultCurrent\(g\)/);
    assert.match(src, /function recordDynamicInitiativeDefaultAfterAction\(ctx, currentUID, currentType, cadenceEvents = \[\]\)/);
    assert.match(src, /function applyDynamicInitiativeDefaultSelection\(ctx, prediction, cadenceEvents = \[\]\)/);
    assert.match(src, /initializeDynamicInitiativeDefaultCurrent\(ctx, 'BuildRoundGroups'\)/);
    assert.match(src, /getDynamicInitiativeDefaultCurrent\(g\);\s*if \(dynamicCurrent\) return dynamicCurrent\.uid;/);
    assert.match(src, /applyDynamicInitiativeDefaultSelection\(ctx, dynamicInitiativeDefaultPrediction, dynamicInitiativeCadenceEvents\)/);
    assert.match(src, /export function AdvanceTurn\(ctx\)/);
    assert.match(src, /export function ProcessCurrentTurn\(ctx\)/);
    assert.match(src, /export function HeroTurn\(ctx, heroUID\)/);
    assert.match(src, /export function EnemyTurn\(ctx, enemyUID\)/);
  }
});
