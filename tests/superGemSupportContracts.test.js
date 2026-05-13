const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('super-heal routes through DoHeal with explicit potency multiplier', () => {
  const skillSheetSrc = fs.readFileSync('web-runner/modules/skillSheet.js', 'utf8');
  const runtimeSrc = fs.readFileSync('web-runner/systems/superGemRuntime.js', 'utf8');
  assert.match(skillSheetSrc, /export function DoHeal\(ctx, actorUID, potencyMultiplier = 1\)/);
  assert.match(skillSheetSrc, /const potency = Math\.max\(1, Number\(potencyMultiplier \|\| 1\)\);/);
  assert.match(skillSheetSrc, /const criticalHealMin = 32;/);
  assert.match(skillSheetSrc, /const criticalHealMax = 42;/);
  assert.match(skillSheetSrc, /heal = criticalHealMin \+ Math\.floor\(roll \* \(criticalHealMax - criticalHealMin \+ 1\)\);/);
  assert.match(runtimeSrc, /const SUPER_GEM_HEAL_POTENCY = 6;/);
  assert.match(runtimeSrc, /callFunctionWithContext\(fnContext, 'DoHeal', actorUID, SUPER_GEM_HEAL_POTENCY\);/);
});

test('fixed power amp helper arms deterministic next-turn multiplier', () => {
  const src = fs.readFileSync('web-runner/modules/functionBank.js', 'utf8');
  assert.match(src, /export function ArmPowerAmpFixed\(ctx, actorUID, multiplier = 2\)/);
  assert.match(src, /createPowerAmpArmedEntry\(mult, grantTurn, grantTurnSerial, lifecycleId\)/);
  assert.match(src, /armed Power Amp x\$\{mult\} for next turn!/);
});
