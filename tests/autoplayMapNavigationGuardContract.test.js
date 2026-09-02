const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');

test('broad fallback navigation is disabled when rendered nav labels exist', () => {
  const app = fs.readFileSync(appPath, 'utf8');
  const fallbackStart = app.indexOf('const fallbackNavBand = {');
  const pendingAttackStart = app.indexOf('// Pending hero attack: click an enemy to execute', fallbackStart);

  assert.ok(fallbackStart > 0, 'expected compact fallback navigation band');
  assert.ok(pendingAttackStart > fallbackStart, 'expected pending attack routing after navigation');

  const fallbackRouting = app.slice(fallbackStart, pendingAttackStart);
  assert.match(
    fallbackRouting,
    /if \(\s*navLabelItems\.length === 0 &&\s*mx >= fallbackNavBand\.x/,
    'fallback nav must not intercept board pointer events when rendered Nav_* labels are available',
  );
});

test('explicit rendered Map navigation remains wired to mapLayout', () => {
  const app = fs.readFileSync(appPath, 'utf8');

  assert.match(app, /Nav_MapText: 'Map'/);
  assert.match(app, /if \(label === 'Map'\)/);
  assert.match(app, /requestLayoutChange\('mapLayout', 'nav-map'\)/);
});
