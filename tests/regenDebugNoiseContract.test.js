const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('runtime and mirror skill sheets contain no raw [REGEN] debug spam markers', () => {
  const runtime = read('web-runner/modules/skillSheet.js');
  const mirror = read('Scripts/skillSheet.js');
  assert.doesNotMatch(runtime, /\[REGEN\]/);
  assert.doesNotMatch(mirror, /\[REGEN\]/);
});

test('app runtime contains no raw [REGEN] debug spam markers', () => {
  const app = read('web-runner/app.js');
  assert.doesNotMatch(app, /\[REGEN\]/);
});
