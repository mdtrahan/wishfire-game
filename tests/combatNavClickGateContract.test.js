const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function readCombatNavClickSection() {
  const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(appPath, 'utf8');
  const start = src.indexOf('// Check nav label clicks using actual Nav_* text objects.');
  const end = src.indexOf('// Pending hero attack: click an enemy to execute', start);
  assert.notEqual(start, -1, 'combat nav click section exists');
  assert.notEqual(end, -1, 'combat nav click section has expected end marker');
  return src.slice(start, end);
}

test('combat nav keeps Map and Vault clickable through combat input gates', () => {
  const section = readCombatNavClickSection();

  assert.match(section, /const navAlwaysAllowedLabels = new Set\(\['AstralFlow', 'Hero', 'Map', 'Vault'\]\);/);
  assert.match(section, /navAlwaysAllowedLabels\.has\(labelName\) \|\| !navBlockedBySelection/);
  assert.doesNotMatch(section, /labelName === 'AstralFlow' \|\| labelName === 'Hero' \|\| !navBlockedBySelection/);
});
