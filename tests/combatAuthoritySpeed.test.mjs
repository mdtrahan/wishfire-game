import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCombatBridge } from '../web-runner/src/core/combatBridge.mjs';
import { createCombatAuthorityDriver } from '../web-runner/src/core/combatAuthorityDriver.mjs';

const wasm = new WebAssembly.Module(readFileSync(new URL('../web-runner/assets/simulation_core.wasm', import.meta.url)));
const { config } = JSON.parse(readFileSync(new URL('../rust/simulation_core/tests/permanent_revision_scenario.json', import.meta.url)));

function run(speed, frames, frameMs = 1000 / 60) {
  const bridge = createCombatBridge(new WebAssembly.Instance(wasm));
  const trace = [], errors = [];
  const driver = createCombatAuthorityDriver({ bridge, consume: snapshot => trace.push(snapshot), onError: error => errors.push(error) });
  try {
    driver.start(config);
    for (let frame = 0; frame <= frames; frame++) driver.advance(frame * frameMs, false, speed);
    assert.deepEqual(errors, []);
    return trace;
  } finally { driver.stop(); }
}

test('foreground speed changes step rate while equal-step real WASM snapshots remain deterministic', () => {
  const slow = run(.25, 120), normal = run(1, 30), fast = run(4, 120);
  assert.equal(slow.at(-1).step, '15');
  assert.equal(fast.at(-1).step, '240');
  assert.deepEqual(slow, normal);
  assert.deepEqual(slow, fast.slice(0, slow.length));
});

test('fast foreground elapsed time retains the eight-step per-frame budget', () => {
  const trace = run(4, 1, 1000);
  assert.equal(trace.at(-1).step, '8');
});
