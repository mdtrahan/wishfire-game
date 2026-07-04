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
  test(`dynamic initiative gauge math keeps overflow for successive high-speed turns in ${schedulerPath}`, async () => {
    const scheduler = await loadScheduler(schedulerPath);
    const actors = [
      { uid: 1, type: 0, spd: 60, hp: 40, name: 'Falie' },
      { uid: 101, type: 1, spd: 30, hp: 20, name: 'Djinn' },
    ];

    const first = scheduler.selectDynamicInitiativeTurn({ actors, threshold: 100, maxConsecutiveTurns: 2 });

    assert.equal(first.actor.uid, 1);
    assert.equal(first.ticksElapsed, 2);
    assert.equal(first.meters['1'], 20);
    assert.equal(first.meters['101'], 60);

    const second = scheduler.selectDynamicInitiativeTurn({
      actors,
      meters: first.meters,
      lastActorUID: first.actor.uid,
      consecutiveTurns: first.consecutiveTurns,
      threshold: 100,
      maxConsecutiveTurns: 2,
    });

    assert.equal(second.actor.uid, 1);
    assert.equal(second.ticksElapsed, 2);
    assert.equal(second.meters['1'], 40);
    assert.equal(second.meters['101'], 120);
    assert.equal(second.consecutiveTurns, 2);
    assert.ok(second.reasons.some(reason => reason.reason === 'speed_overflow_repeat'));
  });

  test(`dynamic initiative ready picks use overflow, SPD, then stable order in ${schedulerPath}`, async () => {
    const scheduler = await loadScheduler(schedulerPath);
    const actors = [
      { uid: 9, type: 0, spd: 10, hp: 30, name: 'Slow overflow' },
      { uid: 4, type: 1, spd: 40, hp: 20, name: 'Fast tie A' },
      { uid: 8, type: 1, spd: 40, hp: 20, name: 'Fast tie B' },
    ];

    const overflowWins = scheduler.selectDynamicInitiativeTurn({
      actors,
      meters: { 9: 130, 4: 120, 8: 120 },
      threshold: 100,
    });
    assert.equal(overflowWins.actor.uid, 9);

    const speedThenOrderWins = scheduler.selectDynamicInitiativeTurn({
      actors,
      meters: { 9: 100, 4: 120, 8: 120 },
      threshold: 100,
    });
    assert.equal(speedThenOrderWins.actor.uid, 4);

    const stableOrderWins = scheduler.selectDynamicInitiativeTurn({
      actors: [actors[2], actors[1]],
      meters: { 4: 120, 8: 120 },
      threshold: 100,
    });
    assert.equal(stableOrderWins.actor.uid, 8);
  });

  test(`dynamic initiative eligibility filtering skips dead stunned disabled and pending-death actors in ${schedulerPath}`, async () => {
    const scheduler = await loadScheduler(schedulerPath);
    const actors = [
      { uid: 1, type: 0, spd: 20, hp: 0, name: 'Dead' },
      { uid: 2, type: 0, spd: 20, hp: 10, stunned: true, name: 'Stunned' },
      { uid: 3, type: 0, spd: 20, hp: 10, ableToAct: false, name: 'Disabled by gate' },
      { uid: 4, type: 1, spd: 20, hp: 10, name: 'Pending death' },
      { uid: 5, type: 1, spd: 20, hp: 10, statusEffects: ['paralyzed'], name: 'Paralyzed' },
      { uid: 6, type: 1, spd: 20, hp: 10, name: 'Eligible' },
    ];

    const roster = scheduler.buildDynamicInitiativeRoster(actors, { pendingDeaths: { 4: { group: 0 } } });

    assert.deepEqual(roster.eligible.map(actor => actor.uid), [6]);
    assert.deepEqual(
      roster.skipped.map(actor => [actor.uid, actor.reason]),
      [
        [1, 'dead'],
        [2, 'stunned'],
        [3, 'unable_to_act'],
        [4, 'pending_death'],
        [5, 'status_blocked:paralyzed'],
      ],
    );

    const turn = scheduler.selectDynamicInitiativeTurn({ actors, pendingDeaths: { 4: true } });
    assert.equal(turn.actor.uid, 6);
    assert.ok(turn.skipped.some(actor => actor.uid === 4 && actor.reason === 'pending_death'));
  });

  test(`dynamic initiative burst cap prevents starvation without timer seconds in ${schedulerPath}`, async () => {
    const scheduler = await loadScheduler(schedulerPath);
    const actors = [
      { uid: 1, type: 0, spd: 100, hp: 40, name: 'Fast' },
      { uid: 101, type: 1, spd: 10, hp: 20, name: 'Slow' },
    ];

    const preview = scheduler.previewDynamicInitiativeTurns({
      actors,
      threshold: 100,
      maxConsecutiveTurns: 2,
      turnCount: 6,
    });

    assert.deepEqual(preview.turns.map(turn => turn.uid), [1, 1, 101, 1, 1, 101]);
    assert.ok(preview.reasons.some(reason => reason.reason === 'burst_cap_wait_for_alternative'));
    assert.ok(preview.reasons.some(reason => reason.reason === 'burst_cap_select_alternative'));
    assert.equal(preview.turns.some(turn => !Number.isInteger(turn.ticksElapsed)), false);
  });

  test(`dynamic initiative models hero opener as an explicit opening policy in ${schedulerPath}`, async () => {
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
      openingPolicy,
      threshold: 100,
    });

    assert.equal(first.actor.uid, 1);
    assert.deepEqual(first.openingPolicy.remainingUIDs, { 2: true });
    assert.ok(first.reasons.some(reason => reason.uid === 101 && reason.reason === 'opening_policy_hold'));

    const second = scheduler.selectDynamicInitiativeTurn({
      actors,
      meters: first.meters,
      openingPolicy: first.openingPolicy,
      threshold: 100,
    });

    assert.equal(second.actor.uid, 2);
    assert.deepEqual(second.openingPolicy.remainingUIDs, {});
  });

  test(`dynamic initiative shadow audit compares team phase against proposed gauge order in ${schedulerPath}`, async () => {
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
      maxConsecutiveTurns: 2,
      previewCount: 5,
    });

    assert.equal(audit.mode, 'shadow_only');
    assert.equal(audit.liveModeUnchanged, true);
    assert.deepEqual(audit.currentOrder.map(turn => turn.uid), [1, 2, 101, 102]);
    assert.deepEqual(audit.proposedOrder.map(turn => turn.uid), [1, 2, 101, 101, 1]);
    assert.ok(audit.skipped.some(actor => actor.uid === 103 && actor.reason === 'stunned'));
    assert.ok(audit.repeats.some(repeat => repeat.uid === 101 && repeat.reason === 'speed_overflow_repeat'));
    assert.ok(audit.reasons.some(reason => reason.reason === 'burst_cap_select_alternative'));
    assert.equal(audit.divergesFromCurrentOrder, true);
  });
}

test('checkpoint leaves live combat turn wiring on current team-phase behavior', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');

    assert.match(src, /function isTimeInitiative\(ctx\) \{\s*return false;\s*\}/);
    assert.doesNotMatch(src, /dynamicInitiativeRules/);
    assert.match(src, /export function AdvanceTurn\(ctx\)/);
    assert.match(src, /export function ProcessCurrentTurn\(ctx\)/);
    assert.match(src, /export function HeroTurn\(ctx, heroUID\)/);
    assert.match(src, /export function EnemyTurn\(ctx, enemyUID\)/);
  }
});
