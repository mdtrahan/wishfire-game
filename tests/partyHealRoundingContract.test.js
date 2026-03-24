const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

function distributePartyHp(desiredTotal, maxHps) {
  const totalMax = maxHps.reduce((sum, value) => sum + value, 0);
  const scaled = maxHps.map((maxHP, idx) => {
    const raw = (desiredTotal * maxHP) / totalMax;
    return {
      idx,
      maxHP,
      base: Math.max(0, Math.min(maxHP, Math.floor(raw))),
      fractional: raw - Math.floor(raw),
    };
  });
  let assigned = scaled.reduce((sum, entry) => sum + entry.base, 0);
  let remaining = Math.max(0, desiredTotal - assigned);
  scaled.sort((a, b) => {
    if (b.fractional !== a.fractional) return b.fractional - a.fractional;
    return a.idx - b.idx;
  });
  for (const entry of scaled) {
    if (remaining <= 0) break;
    if (entry.base >= entry.maxHP) continue;
    entry.base += 1;
    remaining -= 1;
  }
  return scaled.sort((a, b) => a.idx - b.idx).map((entry) => entry.base);
}

for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
  test(`SyncPartyHPToHeroes preserves desired party total in ${relPath}`, () => {
    const src = read(relPath);
    assert.match(src, /const desiredTotal = clamp\(0, Math\.floor\(Number\(g\.PartyHP \|\| 0\)\), totalMax\);/);
    assert.match(src, /const raw = \(desiredTotal \* maxHP\) \/ totalMax;/);
    assert.match(src, /fractional: raw - Math\.floor\(raw\),/);
    assert.match(src, /let remaining = Math\.max\(0, desiredTotal - assigned\);/);
    assert.match(src, /scaled\.sort\(\(a, b\) => \{/);
    assert.match(src, /entry\.hero\.hp = clamp\(0, entry\.base, entry\.maxHP\);/);
  });
}

test('small HoT increments survive hero redistribution instead of flooring away', () => {
  const result = distributePartyHp(101, [100, 100, 100, 100]);
  assert.deepEqual(result, [26, 25, 25, 25]);
  assert.equal(result.reduce((sum, value) => sum + value, 0), 101);
});
