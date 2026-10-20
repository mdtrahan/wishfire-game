import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../web-runner/systems/renderHeroScreen.js', import.meta.url), 'utf8');

test('hero screen renders the basic attack and active descriptions with level gates and without retired resources', () => {
  assert.match(source, /definition\.basic\.description/);
  assert.match(source, /abilities=definition\.actives/);
  assert.match(source, /ability\.description/);
  assert.match(source, /currentLevel/);assert.match(source, /Unlocks at Lv/);assert.match(source, /heroSkillUnlocked/);
  assert.match(source, /currentEXP/);
  assert.match(source, /renderHeroGear/);
  assert.doesNotMatch(source, /d\.special|d\.passives|actionSlotsPerTurn|spMax|flowMode|\.flow\b|\.sp\b|\bAF\b|FLOW/);
});

test('hero party screen preserves the canonical roster and exposes the approved tabs, roster and stats', () => {
  assert.match(source, /Object\.keys\(HERO_DEFINITIONS\)\.map\(key=>globals\.HeroProgress\.heroes\[key\]\)\.filter\(Boolean\)/);
  assert.match(source, /Previous hero/);
  assert.match(source, /Next hero/);
  assert.match(source, /\['heroes','Heroes'\].*\['gear','Gear'\].*\['orb','Orb'\]/);
  assert.match(source, /className='roster'/);
  assert.match(source, /\{HP:hero\.maxHP,\.\.\.hero\.stats\}/);
  assert.match(source, /hero-ticket-art/);
  assert.match(source, /heroTicketLevelCost\(member\.currentLevel\)/);
  assert.match(source, /combatProgression\?\.spendLevelUp\(member\.heroInstanceKey\)/);
  assert.match(source, /Maximum level/);
  assert.doesNotMatch(source, /training-scene/);
});
