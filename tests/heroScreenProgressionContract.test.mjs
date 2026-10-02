import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../web-runner/systems/renderHeroScreen.js', import.meta.url), 'utf8');

test('hero screen renders the basic attack and active descriptions with level gates and without retired resources', () => {
  assert.match(source, /d\.basic\.description/);
  assert.match(source, /for\s*\(const ability of d\.actives\)/);
  assert.match(source, /ability\.description/);
  assert.match(source, /currentLevel/);assert.match(source, /Unlocks at Lv/);assert.match(source, /heroSkillUnlocked/);
  assert.match(source, /currentEXP/);
  assert.match(source, /renderHeroGear/);
  assert.doesNotMatch(source, /d\.special|d\.passives|actionSlotsPerTurn|spMax|flowMode|\.flow\b|\.sp\b|\bAF\b|FLOW/);
});
