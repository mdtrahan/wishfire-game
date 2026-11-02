const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsvRows } = require('./helpers/fixtureCsv');

const fixturePath = path.join(__dirname, 'fixtures', 'game_state_envelope_cases.csv');

function toNumber(row, key) {
  return Number(row[key] || 0);
}

test('retained GameState envelope fixtures encode actor counts and schema cases', () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  assert.ok(rows.length >= 5);
  for (const row of rows) {
    const actorCount = Math.max(0, Math.floor(toNumber(row, 'heroCount')))
      + Math.max(0, Math.floor(toNumber(row, 'enemyCount')));
    const queueLen = toNumber(row, 'turnQueueLength');
    const currentIndex = toNumber(row, 'currentActorIndex');
    const expectedValid = toNumber(row, 'schemaVersion') === 1
      && toNumber(row, 'heroCount') >= 0
      && toNumber(row, 'enemyCount') >= 0
      && toNumber(row, 'gemCount') >= 0
      && queueLen >= 0
      && Number.isInteger(queueLen)
      && Number.isInteger(currentIndex)
      && (queueLen === 0 ? currentIndex === 0 : currentIndex >= 0 && currentIndex < queueLen)
      ? 1
      : 0;
    assert.equal(actorCount, toNumber(row, 'expectedActorCount'), `${row.name} actor count`);
    assert.equal(expectedValid, toNumber(row, 'expectedValid'), `${row.name} valid`);
  }
});

test('shipped GameState envelope builders preserve fixture actors and resources through normalization', async () => {
  const source = require('../src/core/gameStateEnvelopeRules.cjs');
  const runtime = await import('../web-runner/src/core/gameStateEnvelopeRules.mjs');
  for (const row of parseCsvRows(fs.readFileSync(fixturePath, 'utf8'))) {
    const count = key => Math.max(0, toNumber(row, key));
    const input = {
      schemaVersion: toNumber(row, 'schemaVersion'),
      heroes: Array.from({ length: count('heroCount') }, (_, uid) => ({ uid: uid + 1, hp: 20, maxHp: 40 })),
      enemies: Array.from({ length: count('enemyCount') }, (_, uid) => ({ uid: uid + 10, hp: 30, maxHp: 60 })),
      board: { gems: Array.from({ length: count('gemCount') }, (_, uid) => ({ uid: uid + 100, color: 3 })) },
      turnState: { turnQueue: Array.from({ length: count('turnQueueLength') }, (_, uid) => ({ uid: uid + 1 })), currentActorIndex: toNumber(row, 'currentActorIndex') },
      resources: { energy: toNumber(row, 'energy'), partyHp: toNumber(row, 'partyHp') },
    };
    const envelope = runtime.normalizeGameStateEnvelope(input);
    assert.deepEqual(envelope, source.normalizeGameStateEnvelope(input), row.name);
    assert.deepEqual(JSON.parse(JSON.stringify(envelope)), envelope, row.name);
    const shape = runtime.getGameStateEnvelopeShape(envelope);
    assert.equal(shape.schemaVersion, 1, row.name);
    assert.equal(shape.heroCount + shape.enemyCount, toNumber(row, 'expectedActorCount'), row.name);
    assert.equal(shape.heroCount, count('heroCount'), row.name);
    assert.equal(shape.enemyCount, count('enemyCount'), row.name);
    assert.equal(shape.gemCount, count('gemCount'), row.name);
    assert.equal(shape.turnQueueLength, count('turnQueueLength'), row.name);
    assert.equal(shape.currentActorIndex, row.name === 'bad_index' ? 3 : toNumber(row, 'currentActorIndex'), row.name);
    assert.equal(shape.energy, toNumber(row, 'energy'), row.name);
    assert.equal(shape.partyHp, toNumber(row, 'partyHp'), row.name);
  }
});
