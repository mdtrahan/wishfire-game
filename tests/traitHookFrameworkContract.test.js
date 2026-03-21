const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('trait hook API surface exists in runtime function bank', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(src, /const TRAIT_HOOK_EVENTS = new Set\(\[/);
  assert.match(src, /export function RegisterTraitHook\(ctx, eventName, traitId, handler\)/);
  assert.match(src, /export function UnregisterTraitHook\(ctx, eventName, traitId\)/);
  assert.match(src, /export function GetTraitHookTrace\(ctx, limit = 40\)/);
});

test('trait hook dispatch points cover required deterministic seams', () => {
  const filePath = path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js');
  const src = fs.readFileSync(filePath, 'utf8');
  assert.match(src, /runTraitHooks\(ctx, 'turn_start'/);
  assert.match(src, /runTraitHooks\(ctx, 'action_resolve'/);
  assert.match(src, /runTraitHooks\(ctx, 'damage_receive'/);
  assert.match(src, /runTraitHooks\(ctx, 'enemy_death'/);
  assert.match(src, /runTraitHooks\(ctx, 'status_apply'/);
});
