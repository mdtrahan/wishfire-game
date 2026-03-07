const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('blue buff duration is capped to 5 hero team actions', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(
    src,
    /const buffTurns = Math\.max\(1, Math\.min\(5, Number\(g\.BuffDurationDefault \|\| 5\)\)\);/
  );
});

test('AdvanceTurn decays party buff turns and refreshes buff UI on hero action', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(src, /const decayPartyBuffsOnHeroAction = \(\) => \{/);
  assert.match(src, /if \(currentType === 0 && currentUID\) \{\s*decayPartyBuffsOnHeroAction\(\);/);
  assert.match(src, /RefreshPartyBuffUI\(ctx\);/);
});
