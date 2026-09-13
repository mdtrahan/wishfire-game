const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const harnessPath = path.join(__dirname, '..', 'tools', 'balance_harness.js');
const source = fs.readFileSync(harnessPath, 'utf8');
const { START_WORLD_POINT, aggregateSessions, isAutoplayReadyState } = require(harnessPath);

test('balance harness enters through the current Canvas START and native autoplay seams', () => {
  assert.deepEqual(START_WORLD_POINT, { x: 184.5, y: 427 });
  assert.match(source, /setEncounterRequest\(\{ seed: encounterSeed/);
  assert.match(source, /runDevAutoplayUntilDepleted/);
  assert.doesNotMatch(source, /buildCandidateMatches|pickThree|maybeClearSelectedGems|canPickGems|180, 320/);
});

test('balance harness waits for current autoplay combat readiness', () => {
  const ready = {
    flags: { layoutId: 'combat' },
    quest: { phase: 'combat' },
    heroes: [{ hp: 1 }],
    enemies: [{ hp: 1 }],
  };
  assert.equal(isAutoplayReadyState(ready), true);
  assert.equal(isAutoplayReadyState({ ...ready, quest: { phase: 'map' } }), false);
  assert.equal(isAutoplayReadyState({ ...ready, heroes: [{ hp: 0 }] }), false);
  assert.equal(isAutoplayReadyState({ ...ready, enemies: [] }), false);
});

test('balance harness writes its completed summary before managed cleanup', () => {
  const mainBody = source.slice(source.indexOf('async function main('), source.indexOf('if (require.main === module)'));
  assert.ok(mainBody.indexOf('writeOutputs(config, sessions, aggregate)') < mainBody.indexOf('await browserSession.close()'));
  assert.match(source, /settleWithin\(\(\) => browserServer\.close\(\), config\.cleanupTimeoutMs\)/);
  assert.match(source, /browserServer\.kill\(\)/);
});

test('casualty variation measures the first hero lost in each session', () => {
  const aggregate = aggregateSessions({ maxWaves: 5, enemiesPerWave: 3 }, [
    { seed: 1, enemiesDefeated: 2, turnsSurvived: 20, heroCasualties: ['Runa', 'Falie'], firstKoSide: 'enemy', endReason: 'party_defeated', deadlockCount: 0 },
    { seed: 2, enemiesDefeated: 2, turnsSurvived: 21, heroCasualties: ['Huun', 'Falie'], firstKoSide: 'hero', endReason: 'party_defeated', deadlockCount: 0 },
  ]);
  assert.deepEqual(aggregate.firstHeroCasualtyDistribution, { Runa: 1, Huun: 1 });
  assert.equal(aggregate.acceptance.variedHeroCasualties, true);
});
