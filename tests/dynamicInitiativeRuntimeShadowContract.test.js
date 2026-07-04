const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const shadowModulePaths = [
  'src/core/dynamicInitiativeRuntimeShadow.mjs',
  'web-runner/src/core/dynamicInitiativeRuntimeShadow.mjs',
];

async function loadShadowModule(relPath) {
  return import(pathToFileURL(path.join(__dirname, '..', relPath)).href);
}

for (const modulePath of shadowModulePaths) {
  test(`dynamic initiative shadow adapter traces action-completed progress and selection in ${modulePath}`, async () => {
    const shadow = await loadShadowModule(modulePath);
    const actors = [
      { uid: 1, type: 0, speed: 90, hp: 40, name: 'Hero A' },
      { uid: 101, type: 1, speed: 80, hp: 20, name: 'Enemy B' },
    ];

    const result = shadow.advanceDynamicInitiativeShadow({
      battleId: 1001,
      actionSerial: 1,
      actors,
      completedActor: { uid: 1, type: 0, name: 'Hero A' },
      progress: { 1: 50, 101: 0 },
      threshold: 100,
    });

    assert.equal(result.trace.actionSerial, 1);
    assert.deepEqual(result.trace.progressBeforeAdvance, { 1: 50, 101: 0 });
    assert.deepEqual(result.trace.progressBeforeSelection, { 1: 140, 101: 80 });
    assert.equal(result.trace.selectedActor.uid, 1);
    assert.deepEqual(result.trace.progressAfterSelection, { 1: 40, 101: 80 });
    assert.equal(result.trace.selectionReason, 'highest_progress');
    assert.deepEqual(result.nextState.progress, { 1: 40, 101: 80 });
  });

  test(`dynamic initiative shadow adapter records hero tie break and live mismatch in ${modulePath}`, async () => {
    const shadow = await loadShadowModule(modulePath);
    const actors = [
      { uid: 101, type: 1, speed: 50, hp: 20, name: 'Enemy B' },
      { uid: 1, type: 0, speed: 50, hp: 40, name: 'Hero A' },
    ];

    const result = shadow.advanceDynamicInitiativeShadow({
      actionSerial: 2,
      actors,
      completedActor: { uid: 101, type: 1, name: 'Enemy B' },
      progress: { 1: 50, 101: 50 },
      threshold: 100,
    });
    const comparison = shadow.compareDynamicInitiativeShadowSelection(result.trace, {
      uid: 101,
      type: 1,
      name: 'Enemy B',
    });

    assert.equal(result.trace.selectedActor.uid, 1);
    assert.equal(result.trace.selectionReason, 'tie_hero_over_enemy');
    assert.equal(comparison.matches, false);
    assert.equal(comparison.expected.uid, 1);
    assert.equal(comparison.live.uid, 101);
  });

  test(`dynamic initiative shadow adapter consumes explicit hero opening policy without team phase ownership in ${modulePath}`, async () => {
    const shadow = await loadShadowModule(modulePath);
    const actors = [
      { uid: 1, type: 0, speed: 10, hp: 40, name: 'Hero A' },
      { uid: 2, type: 0, speed: 8, hp: 40, name: 'Hero C' },
      { uid: 101, type: 1, speed: 200, hp: 20, name: 'Enemy B' },
    ];

    const result = shadow.advanceDynamicInitiativeShadow({
      actionSerial: 1,
      actors,
      completedActor: { uid: 1, type: 0, name: 'Hero A' },
      progress: { 1: 0, 2: 0, 101: 500 },
      openingPolicy: { mode: 'hero_opener', remainingUIDs: { 1: true, 2: true } },
      threshold: 100,
    });

    assert.equal(result.trace.openingPolicy.completedActorConsumed, true);
    assert.equal(result.trace.selectedActor.uid, 2);
    assert.equal(result.trace.selectionReason, 'opening_policy');
    assert.deepEqual(result.nextState.openingPolicy.remainingUIDs, {});
  });

  test(`dynamic initiative shadow adapter becomes Progress-driven after one opening selection in ${modulePath}`, async () => {
    const shadow = await loadShadowModule(modulePath);
    const actors = [
      { uid: 1, type: 0, speed: 60, hp: 42, name: 'Synthetic Hero A' },
      { uid: 2, type: 0, speed: 45, hp: 36, name: 'Synthetic Hero B' },
      { uid: 101, type: 1, speed: 50, hp: 30, name: 'Synthetic Enemy A' },
      { uid: 102, type: 1, speed: 35, hp: 30, name: 'Synthetic Enemy B' },
    ];

    const result = shadow.advanceDynamicInitiativeShadow({
      actionSerial: 2,
      actors,
      completedActor: { uid: 1, type: 0, name: 'Synthetic Hero A' },
      progress: { 1: 0, 2: 0, 101: 0, 102: 0 },
      openingPolicy: { mode: 'hero_opener', remainingUIDs: {}, exhausted: true },
      threshold: 100,
    });

    assert.equal(result.trace.selectedActor.uid, 1);
    assert.equal(result.trace.selectionReason, 'highest_progress');
    assert.equal(result.trace.initiativeAdvanceCount, 2);
    assert.deepEqual(result.trace.progressBeforeSelection, { 1: 120, 2: 90, 101: 100, 102: 70 });
    assert.deepEqual(result.trace.progressAfterSelection, { 1: 20, 2: 90, 101: 100, 102: 70 });
  });

  test(`dynamic initiative shadow adapter reports eligibility skips and pending-death exclusions in ${modulePath}`, async () => {
    const shadow = await loadShadowModule(modulePath);
    const actors = [
      { uid: 1, type: 0, speed: 40, hp: 40, name: 'Hero A' },
      { uid: 101, type: 1, speed: 80, hp: 20, name: 'Enemy B' },
      { uid: 102, type: 1, speed: 90, hp: 20, name: 'Enemy Pending' },
      { uid: 103, type: 1, speed: 90, hp: 20, stunned: true, name: 'Enemy Stunned' },
    ];

    const result = shadow.advanceDynamicInitiativeShadow({
      actionSerial: 3,
      actors,
      completedActor: { uid: 1, type: 0, name: 'Hero A' },
      progress: { 1: 60, 101: 20, 102: 95, 103: 95 },
      pendingDeaths: { 102: true },
      threshold: 100,
    });

    assert.deepEqual(result.trace.progressBeforeSelection, { 1: 100, 101: 100 });
    assert.deepEqual(
      result.trace.eligibilitySkips.map(skip => [skip.uid, skip.reason]),
      [
        [102, 'pending_death'],
        [103, 'stunned'],
      ],
    );
    assert.deepEqual(result.trace.pendingDeathExclusions.map(skip => skip.uid), [102]);
  });

  test(`dynamic initiative shadow trace formatter produces deterministic readable output in ${modulePath}`, async () => {
    const shadow = await loadShadowModule(modulePath);
    const actors = [
      { uid: 1, type: 0, speed: 90, hp: 40, name: 'Hero A' },
      { uid: 101, type: 1, speed: 80, hp: 20, name: 'Enemy B' },
    ];
    const result = shadow.advanceDynamicInitiativeShadow({
      battleId: 1001,
      actionSerial: 1,
      actors,
      completedActor: { uid: 1, type: 0, name: 'Hero A' },
      progress: { 1: 50, 101: 0 },
      threshold: 100,
    });

    assert.equal(
      shadow.formatDynamicInitiativeTrace(result.trace),
      [
        'Battle 1001',
        'Action 01',
        'Completed: Hero A',
        'Progress before selection:',
        'Hero A 140',
        'Enemy B 80',
        'Selected: Hero A',
        'Reason: highest_progress',
        'Progress after selection:',
        'Hero A 40',
        'Enemy B 80',
      ].join('\n'),
    );
  });

  test(`dynamic initiative shadow harness produces deterministic multi-action traces in ${modulePath}`, async () => {
    const shadow = await loadShadowModule(modulePath);
    const actors = [
      { uid: 1, type: 0, speed: 10, hp: 40, name: 'Hero A' },
      { uid: 101, type: 1, speed: 80, hp: 20, name: 'Enemy B' },
    ];

    const harness = shadow.runDynamicInitiativeTraceHarness({
      battleId: 1001,
      actors,
      progress: { 1: 140, 101: 120 },
      threshold: 100,
      actionCount: 2,
    });

    assert.deepEqual(harness.traces.map(trace => trace.selectedActor.uid), [1, 101]);
    assert.equal(
      harness.text,
      [
        'Battle 1001',
        'Action 01',
        'Progress before selection:',
        'Hero A 140',
        'Enemy B 120',
        'Selected: Hero A',
        'Reason: highest_progress',
        'Progress after selection:',
        'Hero A 40',
        'Enemy B 120',
        '',
        'Battle 1001',
        'Action 02',
        'Progress before selection:',
        'Hero A 50',
        'Enemy B 200',
        'Selected: Enemy B',
        'Reason: highest_progress',
        'Progress after selection:',
        'Hero A 50',
        'Enemy B 100',
      ].join('\n'),
    );
  });
}
