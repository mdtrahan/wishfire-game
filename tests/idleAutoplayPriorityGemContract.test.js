const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

test('dev idle autoplay prioritizes frame-6 single-pick energy gems before triplets', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  const match = src.match(/function findIdleAutoplayPrioritySinglePick\(\) \{[\s\S]*?\n  \}/);
  assert.ok(match, 'priority single-pick helper should exist');
  const script = `${match[0]}; findIdleAutoplayPrioritySinglePick();`;
  const result = vm.runInNewContext(script, {
    gameState: {
      gems: [
        { cellR: 2, cellC: 1, color: 4 },
        { cellR: 0, cellC: 3, color: 6 },
        { cellR: 1, cellC: 1, color: 2 },
      ],
    },
    Number,
  });
  assert.equal(JSON.stringify(result), JSON.stringify({ row: 0, col: 3 }));
});

test('dev idle autoplay falls back to triplets when no frame-6 pickup exists', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  const match = src.match(/function findIdleAutoplayPrioritySinglePick\(\) \{[\s\S]*?\n  \}/);
  assert.ok(match, 'priority single-pick helper should exist');
  const script = `${match[0]}; findIdleAutoplayPrioritySinglePick();`;
  const result = vm.runInNewContext(script, {
    gameState: {
      gems: [
        { cellR: 2, cellC: 1, color: 4 },
        { cellR: 0, cellC: 3, color: 3 },
        { cellR: 1, cellC: 1, color: 2 },
      ],
    },
    Number,
  });
  assert.equal(result, null);
});

test('dev idle autoplay prefers purple, then heal, then balances red-green-blue-yellow equally', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  const priorityConst = src.match(/const IDLE_AUTOPLAY_COLOR_PRIORITY = Object\.freeze\(\[[\s\S]*?\]\);/);
  const fn = src.match(/function pickIdleAutoplayTriplet\(\) \{[\s\S]*?\n  \}/);
  assert.ok(priorityConst, 'triplet priority constant should exist');
  assert.ok(fn, 'triplet priority picker should exist');
  const script = `${priorityConst[0]}\n${fn[0]}\npickIdleAutoplayTriplet();`;
  const result = vm.runInNewContext(script, {
    gameState: {
      gems: [
        { cellR: 0, cellC: 0, color: 2 }, { cellR: 0, cellC: 1, color: 2 }, { cellR: 0, cellC: 2, color: 2 },
        { cellR: 1, cellC: 0, color: 3 }, { cellR: 1, cellC: 1, color: 3 }, { cellR: 1, cellC: 2, color: 3 },
        { cellR: 2, cellC: 0, color: 5 }, { cellR: 2, cellC: 1, color: 5 }, { cellR: 2, cellC: 2, color: 5 },
      ],
    },
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
    Number,
    Array,
    Object,
    Map,
  });
  assert.equal(JSON.stringify(result), JSON.stringify([{ row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }]));
});

test('dev idle autoplay treats red, green, blue, and yellow as equal-priority triplet colors', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  const priorityConst = src.match(/const IDLE_AUTOPLAY_COLOR_PRIORITY = Object\.freeze\(\[[\s\S]*?\]\);/);
  const fn = src.match(/function pickIdleAutoplayTriplet\(\) \{[\s\S]*?\n  \}/);
  assert.ok(priorityConst, 'triplet priority constant should exist');
  assert.ok(fn, 'triplet priority picker should exist');
  const script = `${priorityConst[0]}\n${fn[0]}\npickIdleAutoplayTriplet();`;
  const greenResult = vm.runInNewContext(script, {
    gameState: {
      gems: [
        { cellR: 0, cellC: 0, color: 0 }, { cellR: 0, cellC: 1, color: 0 }, { cellR: 0, cellC: 2, color: 0 },
        { cellR: 1, cellC: 0, color: 1 }, { cellR: 1, cellC: 1, color: 1 }, { cellR: 1, cellC: 2, color: 1 },
        { cellR: 2, cellC: 0, color: 2 }, { cellR: 2, cellC: 1, color: 2 }, { cellR: 2, cellC: 2, color: 2 },
        { cellR: 3, cellC: 0, color: 3 }, { cellR: 3, cellC: 1, color: 3 }, { cellR: 3, cellC: 2, color: 3 },
      ],
    },
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
    Number,
    Array,
    Object,
    Map,
  });
  const redResult = vm.runInNewContext(script, {
    gameState: {
      gems: [
        { cellR: 0, cellC: 0, color: 0 }, { cellR: 0, cellC: 1, color: 0 }, { cellR: 0, cellC: 2, color: 0 },
        { cellR: 1, cellC: 0, color: 1 }, { cellR: 1, cellC: 1, color: 1 }, { cellR: 1, cellC: 2, color: 1 },
        { cellR: 2, cellC: 0, color: 2 }, { cellR: 2, cellC: 1, color: 2 }, { cellR: 2, cellC: 2, color: 2 },
        { cellR: 3, cellC: 0, color: 3 }, { cellR: 3, cellC: 1, color: 3 }, { cellR: 3, cellC: 2, color: 3 },
      ],
    },
    Math: Object.assign(Object.create(Math), { random: () => 0.26 }),
    Number,
    Array,
    Object,
    Map,
  });
  const blueResult = vm.runInNewContext(script, {
    gameState: {
      gems: [
        { cellR: 0, cellC: 0, color: 0 }, { cellR: 0, cellC: 1, color: 0 }, { cellR: 0, cellC: 2, color: 0 },
        { cellR: 1, cellC: 0, color: 1 }, { cellR: 1, cellC: 1, color: 1 }, { cellR: 1, cellC: 2, color: 1 },
        { cellR: 2, cellC: 0, color: 2 }, { cellR: 2, cellC: 1, color: 2 }, { cellR: 2, cellC: 2, color: 2 },
        { cellR: 3, cellC: 0, color: 3 }, { cellR: 3, cellC: 1, color: 3 }, { cellR: 3, cellC: 2, color: 3 },
      ],
    },
    Math: Object.assign(Object.create(Math), { random: () => 0.51 }),
    Number,
    Array,
    Object,
    Map,
  });
  const yellowResult = vm.runInNewContext(script, {
    gameState: {
      gems: [
        { cellR: 0, cellC: 0, color: 0 }, { cellR: 0, cellC: 1, color: 0 }, { cellR: 0, cellC: 2, color: 0 },
        { cellR: 1, cellC: 0, color: 1 }, { cellR: 1, cellC: 1, color: 1 }, { cellR: 1, cellC: 2, color: 1 },
        { cellR: 2, cellC: 0, color: 2 }, { cellR: 2, cellC: 1, color: 2 }, { cellR: 2, cellC: 2, color: 2 },
        { cellR: 3, cellC: 0, color: 3 }, { cellR: 3, cellC: 1, color: 3 }, { cellR: 3, cellC: 2, color: 3 },
      ],
    },
    Math: Object.assign(Object.create(Math), { random: () => 0.99 }),
    Number,
    Array,
    Object,
    Map,
  });
  assert.equal(JSON.stringify(greenResult), JSON.stringify([{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }]));
  assert.equal(JSON.stringify(redResult), JSON.stringify([{ row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }]));
  assert.equal(JSON.stringify(blueResult), JSON.stringify([{ row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }]));
  assert.equal(JSON.stringify(yellowResult), JSON.stringify([{ row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 }]));
});

test('dev idle autoplay checks priority pickup before the triplet picker in the hero window', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  assert.match(src, /const singlePick = findIdleAutoplayPrioritySinglePick\(\);/);
  assert.match(src, /if \(singlePick\) \{/);
  assert.match(src, /const played = clickGemCell\(Number\(singlePick\.row \|\| 0\), Number\(singlePick\.col \|\| 0\)\);/);
  assert.match(src, /const pick = pickIdleAutoplayTriplet\(\);/);
});
