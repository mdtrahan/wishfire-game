import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../web-runner/systems/renderHeroScreen.js', import.meta.url), 'utf8');

test('hero screen renders the basic attack and accepted skill descriptions without retired resources', () => {
  assert.match(source, /heroBasicSkill\(definition\)/);
  assert.match(source, /abilities=definition\.skills/);
  assert.match(source, /heroSkillCopy\(ability\)/);
  assert.match(source, /currentLevel/);assert.match(source, /Late-game resonance/);assert.match(source, /provisionalCooldown/);
  assert.match(source, /currentEXP/);
  assert.match(source, /renderHeroGear/);
  assert.doesNotMatch(source, /d\.special|d\.passives|actionSlotsPerTurn|spMax|flowMode|\.flow\b|\.sp\b|\bAF\b|FLOW/);
});

test('hero redesign preserves the canonical roster behind directional controls and exposes the approved tabs and stats', () => {
  assert.match(source, /Object\.keys\(HERO_DEFINITIONS\)\.map\(key=>globals\.HeroProgress\.heroes\[key\]\)\.filter\(Boolean\)/);
  assert.match(source, /Previous hero/);
  assert.match(source, /Next hero/);
  assert.match(source, /\['orb','Orb'\].*\['gear','Gear'\].*\['skills','Skills'\]/);
  assert.match(source, /`DEF \$\{hero\.stats\.DEF\}`/);
  assert.match(source, /hero-ticket-art/);
  assert.match(source, /heroTicketLevelCost\(hero\.currentLevel\)/);
  assert.match(source, /combatProgression\?\.spendLevelUp\(hero\.heroInstanceKey\)/);
  assert.match(source, /Maximum level/);
  assert.doesNotMatch(source, /className='roster'/);
});
