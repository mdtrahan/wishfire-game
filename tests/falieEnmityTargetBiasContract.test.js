const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

function extractPicker(relPath) {
  const src = read(relPath);
  const start = src.indexOf('function pickEnemyTargetHero(ctx, enemyUID = 0) {');
  const end = src.indexOf('function applyRunaMagicResist(', start);
  assert.ok(start >= 0, `missing pickEnemyTargetHero in ${relPath}`);
  assert.ok(end > start, `missing applyRunaMagicResist boundary in ${relPath}`);
  const fnSource = src.slice(start, end).trim();
  const factory = new Function('getGlobals', 'getHeroes', 'randomPick', `${fnSource}; return pickEnemyTargetHero;`);
  return { src, factory };
}

function runUniformPicker(relPath) {
  const globals = {};
  const heroes = [
    { uid: 11, name: 'Falie', hp: 40 },
    { uid: 12, name: 'Kojonn', hp: 40 },
    { uid: 13, name: 'Runa', hp: 40 },
  ];
  const calls = [];
  const { src, factory } = extractPicker(relPath);
  const picker = factory(
    () => globals,
    () => heroes,
    (ctxArg, listArg) => {
      calls.push({ ctxArg, listArg });
      return listArg[1];
    }
  );
  const ctx = { state: { globals } };
  const picked = picker(ctx, 99);
  return { src, globals, calls, picked, heroes, ctx };
}

test('runtime function bank uses uniform enemy targeting across living heroes', () => {
  const { src, globals, calls, picked, heroes, ctx } = runUniformPicker('web-runner/modules/functionBank.js');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].ctxArg, ctx);
  assert.equal(calls[0].listArg.length, heroes.length);
  assert.equal(picked.uid, heroes[1].uid);
  assert.deepEqual(globals.LastEnemyTargetBias, {
    enemyUID: 99,
    mode: 'uniform',
    targetUID: heroes[1].uid,
    heroCount: heroes.length,
  });
  assert.ok(!src.includes('FALIE_ENMITY_BONUS'));
  assert.ok(!src.includes("mode: 'falie_enmity_bias'"));
});

test('enemy single-target runtime paths still route through shared picker', () => {
  const src = read('web-runner/modules/functionBank.js');
  assert.match(src, /const target = pickEnemyTargetHero\(ctx, actorUID\);/);
  assert.match(src, /const resolvedTargetUID = targetUID \|\| \(pickEnemyTargetHero\(ctx, enemyUID\)\?\.uid \|\| 0\);/);
  assert.match(src, /const target = pickEnemyTargetHero\(ctx, enemyUID\);/);
});

test('Scripts mirror uses the same uniform enemy targeting behavior', () => {
  const { src, globals, calls, picked, heroes, ctx } = runUniformPicker('Scripts/functionBank.js');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].ctxArg, ctx);
  assert.equal(calls[0].listArg.length, heroes.length);
  assert.equal(picked.uid, heroes[1].uid);
  assert.deepEqual(globals.LastEnemyTargetBias, {
    enemyUID: 99,
    mode: 'uniform',
    targetUID: heroes[1].uid,
    heroCount: heroes.length,
  });
  assert.ok(!src.includes('FALIE_ENMITY_BONUS'));
  assert.ok(!src.includes("mode: 'falie_enmity_bias'"));
});
