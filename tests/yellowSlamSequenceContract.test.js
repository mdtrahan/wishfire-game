const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

function extractFunctionSource(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const signatureEnd = src.indexOf(') {', start);
  assert.notEqual(signatureEnd, -1, `missing body start for ${name}`);
  const braceStart = signatureEnd + 2;
  assert.notEqual(braceStart, -1, `missing body for ${name}`);
  let depth = 0;
  for (let i = braceStart; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

function extractYellowBranch(src) {
  const start = src.indexOf('} else if (color === 3) {');
  assert.notEqual(start, -1, 'missing regular yellow branch');
  const end = src.indexOf('} else if (color === 4) {', start);
  assert.notEqual(end, -1, 'missing heal branch after yellow');
  return src.slice(start, end);
}

test('regular yellow matches route empty-cell fill through shared bounce refill', () => {
  const src = read('web-runner/app.js');
  const branch = extractYellowBranch(src);

  assert.match(branch, /callFunctionWithContext\(fnContext, 'ResolveGemAction', 3, actorUID, matchedYellowCount\);/);
  assert.match(branch, /callFunctionWithContext\(fnContext, 'DestroyGem'\);/);
  assert.match(branch, /callFunctionWithContext\(fnContext, 'ClearMatchState'\);/);
  assert.match(branch, /syncGemsFromGlobals\(\);/);
  assert.match(branch, /clearLocalSelection\(\);/);
  assert.match(branch, /rebuildGridAndStartMatchRefill\(\);/);
  assert.match(branch, /callFunctionWithContext\(fnContext, 'Sub_Energy'\);/);
  assert.match(branch, /startYellowCasinoSequence\(actorUID, matchedYellowCount,/);
});

test('yellow casino sequence no longer owns unrelated board-yellow or empty-slot refill work', () => {
  const src = read('web-runner/app.js');
  const sequence = extractFunctionSource(src, 'startYellowCasinoSequence');

  assert.match(sequence, /const queue = \[\];/);
  assert.match(sequence, /const totalYellowConsumed = Math\.max\(0, Number\(initialMatchedYellowCount \|\| 0\)\);/);
  assert.doesNotMatch(sequence, /additionalYellowConsumed/);
  assert.doesNotMatch(sequence, /reason: 'yellow-reassign'/);
  assert.doesNotMatch(sequence, /pickYellowReassignTarget\(\)/);
  assert.doesNotMatch(sequence, /type: 'empty'/);
  assert.doesNotMatch(sequence, /reason: 'yellow-refill'/);
  assert.doesNotMatch(sequence, /pickYellowRefillTarget\(\)/);
});

test('gate-stuck diagnostic does not fire during normal deferred yellow handoff windows', () => {
  const src = read('web-runner/app.js');
  const start = src.indexOf("console.error('[GATE_STUCK_CANPICK]'");
  assert.notEqual(start, -1, 'missing gate-stuck diagnostic');
  const blockStart = src.lastIndexOf('noRefillActive', start);
  const block = src.slice(blockStart, start + 220);

  assert.match(block, /!state\.globals\.DeferAdvance/);
  assert.match(block, /\(state\.globals\.ActionLockUntil \|\| 0\) <= \(state\.globals\.time \|\| 0\)/);
});
