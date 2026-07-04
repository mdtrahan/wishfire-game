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

function readCanonicalHero(name) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner/state/heroScreenConfig.js'), 'utf8');
  const line = src.split('\n').find(candidate => candidate.includes(`name: '${name}'`));
  assert.ok(line, `missing canonical hero ${name}`);
  const stat = (key) => {
    const match = line.match(new RegExp(`${key}:\\s*([0-9]+)`));
    assert.ok(match, `missing ${key} for ${name}`);
    return Number(match[1]);
  };
  return {
    name,
    hp: stat('hp'),
    speed: stat('SPD'),
  };
}

function readCanonicalEnemy(name) {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'web-runner/assets/enemies.json'), 'utf8'));
  const headers = raw.data.map(column => String(column?.[0]?.[0] || ''));
  for (let rowIndex = 1; rowIndex < raw.data[0].length; rowIndex += 1) {
    const row = {};
    for (let columnIndex = 0; columnIndex < headers.length; columnIndex += 1) {
      row[headers[columnIndex]] = raw.data[columnIndex][rowIndex][0];
    }
    if (String(row.name || '') === name) {
      return {
        name,
        hp: Number(row.HP),
        speed: Number(row.SPD),
      };
    }
  }
  assert.fail(`missing canonical enemy ${name}`);
}

function canonicalAuthorityBattleStartActors() {
  const falie = readCanonicalHero('Falie');
  const huun = readCanonicalHero('Huun');
  const djinn = readCanonicalEnemy('Djinn');
  const marid = readCanonicalEnemy('Marid');
  return [
    { uid: 1, type: 0, name: falie.name, speed: falie.speed, hp: falie.hp },
    { uid: 2, type: 0, name: huun.name, speed: huun.speed, hp: huun.hp },
    { uid: 101, type: 1, name: djinn.name, speed: djinn.speed, hp: djinn.hp },
    { uid: 102, type: 1, name: marid.name, speed: marid.speed, hp: marid.hp },
  ];
}

for (const modulePath of authorityModulePaths) {
  test(`dynamic initiative authority encounter uses canonical battle-start Speed in ${modulePath}`, async () => {
    const authority = await loadAuthorityModule(modulePath);

    assert.deepEqual(
      authority.DYNAMIC_INITIATIVE_AUTHORITY_ENCOUNTER.actors.map(actor => ({
        uid: actor.uid,
        type: actor.type,
        name: actor.name,
        speed: actor.speed,
        hp: actor.hp,
      })),
      canonicalAuthorityBattleStartActors(),
    );
  });

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
    const [falie, , djinn] = canonicalAuthorityBattleStartActors();
    const actors = [
      falie,
      { ...djinn, hp: 0 },
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

    assert.deepEqual(harness.traces.map(trace => trace.selectedActor.uid), [1, 2, 101, 2, 1, 102]);
    assert.equal(harness.traces.filter(trace => trace.selectionReason === 'opening_policy').length, 1);
    assert.ok(harness.traces.every(trace => trace.validation.ok));
    assert.equal(harness.traces[0].openingPolicy?.mode, 'hero_opener');
    assert.equal(harness.traces[1].initiativeAdvanceCount, 4);
    assert.equal(harness.traces[0].thresholdSubtraction.applied, false);
    assert.deepEqual(
      harness.traces[1].thresholdSubtraction,
      { uid: 2, before: 100, threshold: 100, after: 0, applied: true },
    );
    assert.ok(harness.text.includes('Cadence events:'));
    assert.ok(harness.text.includes('Initiative advances: 4'));
    assert.ok(harness.text.includes('Threshold subtraction: not applied for Falie (0 < 100)'));
    assert.ok(harness.text.includes('Threshold subtraction: Huun 100 - 100 = 0'));
  });
}

test('dynamic initiative authority wiring is dev-flagged and does not flip time initiative', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');

    assert.match(src, /function isTimeInitiative\(ctx\) \{\s*return false;\s*\}/);
    assert.match(src, /DynamicInitiativeAuthorityEnabled/);
    assert.match(src, /function isDynamicInitiativeAuthorityFlagEnabled\(g\)/);
    assert.match(src, /tryApplyDynamicInitiativeAuthoritySelection\(ctx, dynamicInitiativeShadowPrediction, dynamicInitiativeCadenceEvents\)/);
    assert.match(src, /const actors = getDynamicInitiativeRoster\(ctx\);/);
    assert.match(src, /speed: GetEffectiveStat\(ctx, hero, 'SPD'\)/);
    assert.match(src, /speed: GetEffectiveStat\(ctx, enemy, 'SPD'\)/);
    assert.doesNotMatch(src, /isTimeInitiative\(ctx\) \{\s*return true;\s*\}/);
  }
});
