const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const runtimeFunctionBankPath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
const scriptsFunctionBankPath = path.join(__dirname, '..', 'Scripts', 'functionBank.js');
const shadowModulePath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');

test('simulation core shadow module exposes observe-only enemy DoT tick checks', () => {
  const shadowSrc = fs.readFileSync(shadowModulePath, 'utf8');

  assert.match(shadowSrc, /window\.__ORKA_ENEMY_DOT_TICK_SHADOW__/);
  assert.match(shadowSrc, /export function shadowEnemyDotTick/);
  assert.match(shadowSrc, /enemy_dot_tick_damage_shadow/);
  assert.match(shadowSrc, /enemy_dot_tick_total_remaining_shadow/);
  assert.match(shadowSrc, /enemy_dot_tick_remaining_fires_shadow/);
  assert.match(shadowSrc, /enemy_dot_tick_next_turn_shadow/);
  assert.match(shadowSrc, /dataset\.simCoreShadowEnemyDotTickChecks/);
  assert.match(shadowSrc, /return jsValue;/);
});

test('functionBank mirrors submit enemy DoT tick facts without owning Rust imports', () => {
  for (const filePath of [runtimeFunctionBankPath, scriptsFunctionBankPath]) {
    const src = fs.readFileSync(filePath, 'utf8');

    assert.match(src, /function maybeShadowEnemyDotTick/);
    assert.match(src, /enemyDotTickShadowHook/);
    assert.match(src, /__ORKA_ENEMY_DOT_TICK_SHADOW__/);
    assert.match(src, /maybeShadowEnemyDotTick\(ctx, \{/);
    assert.match(
      src,
      /export function ProcessEnemyTurnDamageOverTime[\s\S]*maybeShadowEnemyDotTick\(ctx, \{[\s\S]*source: 'functionBank\.ProcessEnemyTurnDamageOverTime'[\s\S]*\}\);[\s\S]*return applied;/,
    );
  }
});
