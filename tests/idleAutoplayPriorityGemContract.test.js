const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function buildTripletPickerScript(src) {
  const priorityConst = src.match(/const IDLE_AUTOPLAY_COLOR_PRIORITY = Object\.freeze\(\[[\s\S]*?\]\);/);
  const currentHeroFn = src.match(/function getCurrentIdleAutoplayHeroName\(\) \{[\s\S]*?\n  \}/);
  const livingEnemyFn = src.match(/function hasLivingEnemiesForIdleAutoplay\(\) \{[\s\S]*?\n  \}/);
  const resourceOnlyFn = src.match(/function isIdleAutoplayResourceOnlyColor\(color\) \{[\s\S]*?\n  \}/);
  const fn = src.match(/function pickIdleAutoplayTriplet\(\) \{[\s\S]*?\n  \}/);
  assert.ok(priorityConst, 'triplet priority constant should exist');
  assert.ok(currentHeroFn, 'current hero helper should exist');
  assert.ok(livingEnemyFn, 'living enemy helper should exist');
  assert.ok(resourceOnlyFn, 'resource-only color helper should exist');
  assert.ok(fn, 'triplet priority picker should exist');
  return [
    priorityConst[0],
    currentHeroFn[0],
    livingEnemyFn[0],
    resourceOnlyFn[0],
    fn[0],
    'pickIdleAutoplayTriplet();',
  ].join('\n');
}

function buildPickerContext(gameState, random = () => 0) {
  return {
    gameState,
    state: { entities: [] },
    callFunctionWithContext: () => null,
    fnContext: {},
    Math: Object.assign(Object.create(Math), { random }),
    Number,
    Array,
    Object,
    Map,
    String,
  };
}

test('dev idle autoplay prefers purple, then heal, then balances red-green-blue-yellow equally', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  const script = buildTripletPickerScript(src);
  const result = vm.runInNewContext(script, buildPickerContext({
      gems: [
        { cellR: 0, cellC: 0, color: 2 }, { cellR: 0, cellC: 1, color: 2 }, { cellR: 0, cellC: 2, color: 2 },
        { cellR: 1, cellC: 0, color: 3 }, { cellR: 1, cellC: 1, color: 3 }, { cellR: 1, cellC: 2, color: 3 },
        { cellR: 2, cellC: 0, color: 5 }, { cellR: 2, cellC: 1, color: 5 }, { cellR: 2, cellC: 2, color: 5 },
      ],
    }));
  assert.equal(JSON.stringify(result), JSON.stringify([{ row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }]));
});

test('dev idle autoplay treats red, green, blue, and yellow as equal-priority triplet colors', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  const script = buildTripletPickerScript(src);
  const greenResult = vm.runInNewContext(script, buildPickerContext({
      gems: [
        { cellR: 0, cellC: 0, color: 0 }, { cellR: 0, cellC: 1, color: 0 }, { cellR: 0, cellC: 2, color: 0 },
        { cellR: 1, cellC: 0, color: 1 }, { cellR: 1, cellC: 1, color: 1 }, { cellR: 1, cellC: 2, color: 1 },
        { cellR: 2, cellC: 0, color: 2 }, { cellR: 2, cellC: 1, color: 2 }, { cellR: 2, cellC: 2, color: 2 },
        { cellR: 3, cellC: 0, color: 3 }, { cellR: 3, cellC: 1, color: 3 }, { cellR: 3, cellC: 2, color: 3 },
      ],
    }, () => 0));
  const redResult = vm.runInNewContext(script, buildPickerContext({
      gems: [
        { cellR: 0, cellC: 0, color: 0 }, { cellR: 0, cellC: 1, color: 0 }, { cellR: 0, cellC: 2, color: 0 },
        { cellR: 1, cellC: 0, color: 1 }, { cellR: 1, cellC: 1, color: 1 }, { cellR: 1, cellC: 2, color: 1 },
        { cellR: 2, cellC: 0, color: 2 }, { cellR: 2, cellC: 1, color: 2 }, { cellR: 2, cellC: 2, color: 2 },
        { cellR: 3, cellC: 0, color: 3 }, { cellR: 3, cellC: 1, color: 3 }, { cellR: 3, cellC: 2, color: 3 },
      ],
    }, () => 0.26));
  const blueResult = vm.runInNewContext(script, buildPickerContext({
      gems: [
        { cellR: 0, cellC: 0, color: 0 }, { cellR: 0, cellC: 1, color: 0 }, { cellR: 0, cellC: 2, color: 0 },
        { cellR: 1, cellC: 0, color: 1 }, { cellR: 1, cellC: 1, color: 1 }, { cellR: 1, cellC: 2, color: 1 },
        { cellR: 2, cellC: 0, color: 2 }, { cellR: 2, cellC: 1, color: 2 }, { cellR: 2, cellC: 2, color: 2 },
        { cellR: 3, cellC: 0, color: 3 }, { cellR: 3, cellC: 1, color: 3 }, { cellR: 3, cellC: 2, color: 3 },
      ],
    }, () => 0.51));
  const yellowResult = vm.runInNewContext(script, buildPickerContext({
      gems: [
        { cellR: 0, cellC: 0, color: 0 }, { cellR: 0, cellC: 1, color: 0 }, { cellR: 0, cellC: 2, color: 0 },
        { cellR: 1, cellC: 0, color: 1 }, { cellR: 1, cellC: 1, color: 1 }, { cellR: 1, cellC: 2, color: 1 },
        { cellR: 2, cellC: 0, color: 2 }, { cellR: 2, cellC: 1, color: 2 }, { cellR: 2, cellC: 2, color: 2 },
        { cellR: 3, cellC: 0, color: 3 }, { cellR: 3, cellC: 1, color: 3 }, { cellR: 3, cellC: 2, color: 3 },
      ],
    }, () => 0.99));
  assert.equal(JSON.stringify(greenResult), JSON.stringify([{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }]));
  assert.equal(JSON.stringify(redResult), JSON.stringify([{ row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }]));
  assert.equal(JSON.stringify(blueResult), JSON.stringify([{ row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }]));
  assert.equal(JSON.stringify(yellowResult), JSON.stringify([{ row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 }]));
});

test('dev idle autoplay checks purple supergem pickup before the triplet picker in the hero window', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  assert.doesNotMatch(src, /findIdleAutoplayPrioritySinglePick/);
  assert.match(src, /const superGemPick = findIdleAutoplayPrioritySuperGemPick\(\);/);
  assert.match(src, /if \(superGemPick\) \{/);
  assert.match(src, /const played = clickGemCell\(Number\(superGemPick\.row \|\| 0\), Number\(superGemPick\.col \|\| 0\)\);/);
  assert.match(src, /const pick = pickIdleAutoplayTriplet\(\);/);
});
