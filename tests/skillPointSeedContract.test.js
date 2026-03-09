const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('party seed function exists in runtime functionBank', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(src, /export function SetHeroSkillPointsForParty\(ctx, exactAmount = 300, source = 'party_seed_exact'\)/);
  assert.match(src, /const HERO_SKILL_SHARED_KEY = '__party_shared__';/);
  assert.match(src, /store\[HERO_SKILL_SHARED_KEY\] = target;/);
});

test('combat init seeds party skill points to 300 for ORKA-spt lane', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'app.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(src, /callFunctionWithContext\(fnContext, 'SetHeroSkillPointsForParty', 300, 'ORKA-spt-seed'\);/);
});
