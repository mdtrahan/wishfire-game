const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const harnessPath = path.join(__dirname, '..', 'tools', 'balance_harness.js');
const source = fs.readFileSync(harnessPath, 'utf8');
const { START_WORLD_POINT, aggregateSessions, isRealtimeCombatReadyState } = require(harnessPath);

test('balance harness enters through Canvas START and observes automatic realtime combat', () => {
  assert.deepEqual(START_WORLD_POINT, { x: 184.5, y: 427 });
  assert.match(source, /setEncounterRequest\(\{ seed: encounterSeed/);
  assert.match(source, /async function enterRealtimeCombat/);
  assert.doesNotMatch(source, /runDevAutoplayUntilDepleted|stopDevAutoplay/);
  assert.doesNotMatch(source, /TurnSerial|turnType|turnUID|turnOrder|astralFlowWallet|pendingSkillId/);
  assert.doesNotMatch(source, /buildCandidateMatches|pickThree|maybeClearSelectedGems|canPickGems|180, 320/);
});

test('balance harness waits for active realtime combat with a living party and target', () => {
  const ready = {
    flags: { layoutId: 'combat' },
    quest: { phase: 'combat' },
    heroes: [{ hp: 1 }],
    enemies: [{ hp: 1 }],
  };
  assert.equal(isRealtimeCombatReadyState(ready), true);
  assert.equal(isRealtimeCombatReadyState({ ...ready, quest: { phase: 'map' } }), false);
  assert.equal(isRealtimeCombatReadyState({ ...ready, heroes: [{ hp: 0 }] }), false);
  assert.equal(isRealtimeCombatReadyState({ ...ready, enemies: [] }), false);
});

test('balance harness writes its completed summary before managed cleanup', () => {
  const mainBody = source.slice(source.indexOf('async function main('), source.indexOf('if (require.main === module)'));
  assert.ok(mainBody.indexOf('writeOutputs(config, sessions, aggregate)') < mainBody.indexOf('await browserSession.close()'));
  assert.match(source, /settleWithin\(\(\) => browserServer\.close\(\), config\.cleanupTimeoutMs\)/);
  assert.match(source, /browserServer\.kill\(\)/);
});

test('casualty variation measures the first hero lost in each session', () => {
  const aggregate = aggregateSessions({ maxWaves: 5, enemiesPerWave: 3 }, [
    { seed: 1, enemiesDefeated: 2, simulationSecondsSurvived: 20, heroCasualties: ['Runa', 'Falie'], firstKoSide: 'enemy', endReason: 'party_defeated', deadlockCount: 0 },
    { seed: 2, enemiesDefeated: 2, simulationSecondsSurvived: 21, heroCasualties: ['Huun', 'Falie'], firstKoSide: 'hero', endReason: 'party_defeated', deadlockCount: 0 },
  ]);
  assert.deepEqual(aggregate.firstHeroCasualtyDistribution, { Runa: 1, Huun: 1 });
  assert.equal(aggregate.averageSimulationSecondsSurvived, 20.5);
  assert.equal(aggregate.acceptance.variedHeroCasualties, true);
});
