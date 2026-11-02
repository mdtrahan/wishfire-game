import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('DEV retires movement and camera controls without an authoritative Rust API', () => {
  const runtime = readFileSync(new URL('../web-runner/systems/devToolingRuntime.js', import.meta.url), 'utf8');
  assert.doesNotMatch(runtime, /devMovementTuningPanel|mountCombatMovementTuningPanel|DevMovementTuning/);
  assert.equal(existsSync(new URL('../web-runner/systems/devMovementTuningPanel.mjs', import.meta.url)), false);
});
