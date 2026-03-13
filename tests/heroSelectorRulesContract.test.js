const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('hero selector rules align to runtime hero-turn phase semantics', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'heroSelectorRules.mjs');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(src, /export function shouldRenderHeroTurnSelector/);
  assert.match(src, /if \(Number\(turnPhase \|\| 0\) !== 0\) return false;/);
  assert.match(src, /if \(Number\(canPickGems \|\| 0\) === 0\) return false;/);
  assert.match(src, /if \(Number\(hideHeroSelector \|\| 0\) !== 0\) return false;/);
});

