const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const authorityModulePaths = [
  'src/core/dynamicInitiativeAuthorityExperiment.mjs',
  'web-runner/src/core/dynamicInitiativeAuthorityExperiment.mjs',
];

async function loadAuthorityModule(relPath) {
  return import(pathToFileURL(path.join(__dirname, '..', relPath)).href);
}

for (const modulePath of authorityModulePaths) {
  test(`dynamic initiative authority experiment defaults off and gates one encounter in ${modulePath}`, async () => {
    const authority = await loadAuthorityModule(modulePath);
    const actors = authority.DYNAMIC_INITIATIVE_AUTHORITY_ENCOUNTER.actors;

    assert.equal(authority.isDynamicInitiativeAuthorityExperimentEnabled({ globals: {}, actors }), false);
    assert.equal(authority.isDynamicInitiativeAuthorityExperimentEnabled({
      globals: {
        DynamicInitiativeAuthorityEnabled: 1,
        DynamicInitiativeAuthorityExperimentId: authority.DYNAMIC_INITIATIVE_AUTHORITY_EXPERIMENT_ID,
        DynamicInitiativeAuthoritySeed: authority.DYNAMIC_INITIATIVE_AUTHORITY_SEED,
        BattleId: authority.DYNAMIC_INITIATIVE_AUTHORITY_BATTLE_ID,
      },
      actors,
    }), true);
    assert.equal(authority.isDynamicInitiativeAuthorityExperimentEnabled({
      globals: {
        DynamicInitiativeAuthorityEnabled: 1,
        DynamicInitiativeAuthorityExperimentId: authority.DYNAMIC_INITIATIVE_AUTHORITY_EXPERIMENT_ID,
        DynamicInitiativeAuthoritySeed: 999,
        BattleId: authority.DYNAMIC_INITIATIVE_AUTHORITY_BATTLE_ID,
      },
      actors,
    }), false);
  });

  test(`dynamic initiative authority validates selected actor eligibility in ${modulePath}`, async () => {
    const authority = await loadAuthorityModule(modulePath);
    const actors = [
      { uid: 1, type: 0, speed: 60, hp: 42, name: 'Falie' },
      { uid: 101, type: 1, speed: 50, hp: 0, name: 'Djinn' },
    ];
    const prediction = {
      actionSerial: 4,
      selectedActor: { uid: 101, type: 1, name: 'Djinn' },
      progressBeforeSelection: { 1: 60, 101: 120 },
      progressAfterSelection: { 1: 60 },
      threshold: 100,
      eligibilitySkips: [{ uid: 101, reason: 'dead' }],
    };

    const validation = authority.validateDynamicInitiativeAuthoritySelection({
      prediction,
      actors,
      cadenceEvents: [
        { event: 'action_completed' },
        { event: 'turn_serial_increment' },
        { event: 'pending_death_resolution' },
      ],
      previousState: { actionCount: 0 },
    });

    assert.equal(validation.ok, false);
    assert.equal(validation.reason, 'selected_actor_ineligible');
    assert.match(validation.abortMessage, /selected_actor_ineligible/);
  });

  test(`dynamic initiative authority aborts unexpected live actor mismatch in ${modulePath}`, async () => {
    const authority = await loadAuthorityModule(modulePath);
    const prediction = {
      actionSerial: 5,
      selectedActor: { uid: 1, type: 0, name: 'Falie' },
      progressBeforeSelection: { 1: 140, 101: 100 },
      progressAfterSelection: { 1: 40, 101: 100 },
      threshold: 100,
    };

    const validation = authority.validateDynamicInitiativeAuthoritySelection({
      prediction,
      actors: authority.DYNAMIC_INITIATIVE_AUTHORITY_ENCOUNTER.actors,
      liveActor: { uid: 101, type: 1, name: 'Djinn' },
      cadenceEvents: [
        { event: 'action_completed' },
        { event: 'turn_serial_increment' },
        { event: 'pending_death_resolution' },
      ],
      previousState: { actionCount: 2, lastActionSerial: 4 },
    });

    assert.equal(validation.ok, false);
    assert.equal(validation.reason, 'actual_actor_mismatch');
    assert.equal(validation.expectedActor.uid, 1);
    assert.equal(validation.actualActor.uid, 101);
  });

  test(`dynamic initiative authority aborts cadence mismatch in ${modulePath}`, async () => {
    const authority = await loadAuthorityModule(modulePath);
    const prediction = {
      actionSerial: 6,
      selectedActor: { uid: 1, type: 0, name: 'Falie' },
      progressBeforeSelection: { 1: 140, 101: 100 },
      progressAfterSelection: { 1: 40, 101: 100 },
      threshold: 100,
    };

    const validation = authority.validateDynamicInitiativeAuthoritySelection({
      prediction,
      actors: authority.DYNAMIC_INITIATIVE_AUTHORITY_ENCOUNTER.actors,
      cadenceEvents: [{ event: 'action_completed' }],
      previousState: { actionCount: 3, lastActionSerial: 5 },
    });

    assert.equal(validation.ok, false);
    assert.equal(validation.reason, 'cadence_mismatch');
    assert.equal(validation.details.missingCadenceEvent, 'turn_serial_increment');
  });

  test(`dynamic initiative authority harness explains a deterministic battle trace in ${modulePath}`, async () => {
    const authority = await loadAuthorityModule(modulePath);
    const harness = authority.runDynamicInitiativeAuthorityExperimentHarness({ actionCount: 6 });

    assert.deepEqual(harness.traces.map(trace => trace.selectedActor.uid), [1, 1, 101, 2, 1, 102]);
    assert.equal(harness.traces.filter(trace => trace.selectionReason === 'opening_policy').length, 1);
    assert.ok(harness.traces.every(trace => trace.validation.ok));
    assert.equal(harness.traces[0].openingPolicy?.mode, 'hero_opener');
    assert.equal(harness.traces[1].initiativeAdvanceCount, 1);
    assert.equal(harness.traces[0].thresholdSubtraction.applied, false);
    assert.deepEqual(
      harness.traces[1].thresholdSubtraction,
      { uid: 1, before: 120, threshold: 100, after: 20, applied: true },
    );
    assert.ok(harness.text.includes('Cadence events:'));
    assert.ok(harness.text.includes('Initiative advances: 1'));
    assert.ok(harness.text.includes('Threshold subtraction: not applied for Falie (0 < 100)'));
    assert.ok(harness.text.includes('Threshold subtraction: Falie 120 - 100 = 20'));
  });
}

test('dynamic initiative authority wiring is dev-flagged and does not flip time initiative', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');

    assert.match(src, /function isTimeInitiative\(ctx\) \{\s*return false;\s*\}/);
    assert.match(src, /DynamicInitiativeAuthorityEnabled/);
    assert.match(src, /function isDynamicInitiativeAuthorityFlagEnabled\(g\)/);
    assert.match(src, /tryApplyDynamicInitiativeAuthoritySelection\(ctx, dynamicInitiativeShadowPrediction, dynamicInitiativeCadenceEvents\)/);
    assert.doesNotMatch(src, /isTimeInitiative\(ctx\) \{\s*return true;\s*\}/);
  }
});
