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

function proofAuthorityBattleStartActors({
  proofHp,
  skeletonUID = 101,
  goblocUID = 102,
  trollUID = 103,
} = {}) {
  const falie = readCanonicalHero('Falie');
  const huun = readCanonicalHero('Huun');
  const runa = readCanonicalHero('Runa');
  const kojonn = readCanonicalHero('Kojonn');
  const skeleton = readCanonicalEnemy('Skeleton');
  const gobloc = readCanonicalEnemy('Gobloc');
  const troll = readCanonicalEnemy('Troll');
  return [
    { uid: 1, type: 0, name: falie.name, speed: falie.speed, hp: proofHp },
    { uid: 2, type: 0, name: huun.name, speed: huun.speed, hp: proofHp },
    { uid: 3, type: 0, name: runa.name, speed: runa.speed, hp: proofHp },
    { uid: 4, type: 0, name: kojonn.name, speed: kojonn.speed, hp: proofHp },
    { uid: skeletonUID, type: 1, name: skeleton.name, speed: skeleton.speed, hp: proofHp },
    { uid: goblocUID, type: 1, name: gobloc.name, speed: gobloc.speed, hp: proofHp },
    { uid: trollUID, type: 1, name: troll.name, speed: troll.speed, hp: proofHp },
  ];
}

for (const modulePath of authorityModulePaths) {
  test(`dynamic initiative authority proof encounter uses canonical Speed with proof HP in ${modulePath}`, async () => {
    const authority = await loadAuthorityModule(modulePath);
    const proofHp = authority.DYNAMIC_INITIATIVE_AUTHORITY_PROOF_HP;

    assert.deepEqual(
      authority.DYNAMIC_INITIATIVE_AUTHORITY_ENCOUNTER.actors.map(actor => ({
        uid: actor.uid,
        type: actor.type,
        name: actor.name,
        speed: actor.speed,
        hp: actor.hp,
      })),
      proofAuthorityBattleStartActors({ proofHp }),
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

  test(`dynamic initiative authority gate binds live actor identities instead of transient enemy UIDs in ${modulePath}`, async () => {
    const authority = await loadAuthorityModule(modulePath);
    const proofHp = authority.DYNAMIC_INITIATIVE_AUTHORITY_PROOF_HP;
    const liveActors = proofAuthorityBattleStartActors({
      proofHp,
      skeletonUID: 5,
      goblocUID: 6,
      trollUID: 7,
    });
    const globals = {
      DynamicInitiativeAuthorityEnabled: 1,
      DynamicInitiativeAuthorityExperimentId: authority.DYNAMIC_INITIATIVE_AUTHORITY_EXPERIMENT_ID,
      DynamicInitiativeAuthoritySeed: authority.DYNAMIC_INITIATIVE_AUTHORITY_SEED,
      BattleId: authority.DYNAMIC_INITIATIVE_AUTHORITY_BATTLE_ID,
    };

    assert.equal(authority.isDynamicInitiativeAuthorityExperimentEnabled({
      globals,
      actors: liveActors,
    }), true);

    assert.equal(authority.isDynamicInitiativeAuthorityExperimentEnabled({
      globals,
      actors: liveActors.map(actor => (
        actor.name === 'Skeleton' ? { ...actor, hp: proofHp - 2 } : actor
      )),
    }), true);

    assert.equal(authority.isDynamicInitiativeAuthorityExperimentEnabled({
      globals,
      actors: [
        ...liveActors.slice(0, 4),
        liveActors[5],
        liveActors[4],
        liveActors[6],
      ],
    }), false);

    assert.equal(authority.isDynamicInitiativeAuthorityExperimentEnabled({
      globals,
      actors: liveActors.map(actor => (
        actor.name === 'Troll' ? { ...actor, name: 'Orc' } : actor
      )),
    }), false);
  });

  test(`dynamic initiative authority validates selected actor eligibility in ${modulePath}`, async () => {
    const authority = await loadAuthorityModule(modulePath);
    const [falie, , , , skeleton] = proofAuthorityBattleStartActors({
      proofHp: authority.DYNAMIC_INITIATIVE_AUTHORITY_PROOF_HP,
    });
    const actors = [
      falie,
      { ...skeleton, hp: 0 },
    ];
    const prediction = {
      actionSerial: 4,
      selectedActor: { uid: 101, type: 1, name: 'Skeleton' },
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
    const harness = authority.runDynamicInitiativeAuthorityExperimentHarness({ actionCount: 50 });

    assert.deepEqual(
      harness.traces.slice(0, 10).map(trace => trace.selectedActor.name),
      ['Skeleton', 'Huun', 'Gobloc', 'Kojonn', 'Skeleton', 'Runa', 'Huun', 'Gobloc', 'Falie', 'Skeleton'],
    );
    assert.equal(harness.traces.filter(trace => trace.selectionReason === 'opening_policy').length, 0);
    assert.ok(harness.traces.every(trace => trace.validation.ok));
    assert.equal(harness.traces[0].openingPolicy, null);
    assert.equal(harness.traces[0].initiativeAdvanceCount, 5);
    assert.deepEqual(
      harness.traces[0].thresholdSubtraction,
      { uid: 101, before: 110, threshold: 100, after: 10, applied: true },
    );
    const counts = harness.traces.reduce((acc, trace) => {
      const name = trace.selectedActor.name;
      acc[name] = Number(acc[name] || 0) + 1;
      return acc;
    }, {});
    assert.ok(counts.Skeleton > counts.Troll);
    assert.ok(counts.Huun > counts.Falie);
    assert.ok(counts.Gobloc > counts.Falie);
    assert.ok(harness.traces.some((trace, index) => (
      index > 0
      && trace.selectedActor.type !== harness.traces[index - 1].selectedActor.type
      && harness.traces[index - 1].selectedActor.type !== harness.traces[Math.max(0, index - 2)]?.selectedActor?.type
    )));
    assert.ok(harness.text.includes('Cadence events:'));
    assert.ok(harness.text.includes('Initiative advances: 5'));
    assert.ok(harness.text.includes('Threshold subtraction: Skeleton 110 - 100 = 10'));
  });
}

test('dynamic initiative authority harness remains gated while default combat uses scheduler selection', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');

    assert.match(src, /function isTimeInitiative\(ctx\) \{\s*return false;\s*\}/);
    assert.match(src, /DynamicInitiativeAuthorityEnabled/);
    assert.match(src, /function isDynamicInitiativeAuthorityFlagEnabled\(g\)/);
    assert.match(src, /tryApplyDynamicInitiativeAuthoritySelection\(ctx, dynamicInitiativeShadowPrediction, dynamicInitiativeCadenceEvents\)/);
    assert.match(src, /function getDynamicInitiativeDefaultCurrent\(g\)/);
    assert.match(src, /recordDynamicInitiativeDefaultAfterAction\(ctx, currentUID, currentType, dynamicInitiativeCadenceEvents\)/);
    assert.match(src, /applyDynamicInitiativeDefaultSelection\(ctx, dynamicInitiativeDefaultPrediction, dynamicInitiativeCadenceEvents\)/);
    assert.match(src, /const actors = getDynamicInitiativeRoster\(ctx\);/);
    assert.match(src, /speed: GetEffectiveStat\(ctx, hero, 'SPD'\)/);
    assert.match(src, /speed: GetEffectiveStat\(ctx, enemy, 'SPD'\)/);
    assert.doesNotMatch(src, /isTimeInitiative\(ctx\) \{\s*return true;\s*\}/);
  }
});
