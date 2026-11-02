import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { quantiles } from './verify_handoff_logic.mjs';

// Replay the observed boss config; time complete ABI steps with Node's nanosecond clock.
export async function sampleSteps(root, config, { batches = 30, batchSize = 300 } = {}) {
  if (!config) throw Error('Missing observed Rust encounter config');
  const { createCombatBridge } = await import(pathToFileURL(join(root, 'web-runner/src/core/combatBridge.mjs')));
  const bridge = createCombatBridge(new WebAssembly.Instance(await WebAssembly.compile(await readFile(join(root, 'web-runner/assets/simulation_core.wasm')))));
  const samples = [], totals = [];
  for (let batch = -3; batch < batches; batch++) {
    const created = bridge.create(config);
    let snapshot = created.snapshot, count = 0;
    try {
      const start = process.hrtime.bigint();
      for (; count < batchSize && snapshot.state === 'running'; count++) {
        snapshot = bridge.step(created.world, { encounter_id: config.encounter_id, expected_previous_step: snapshot.step }).snapshot;
      }
      const elapsedNs = Number(process.hrtime.bigint() - start);
      if (count < batchSize) throw Error(`Step fixture ended after ${count}/${batchSize} steps`);
      if (batch >= 0) { samples.push(elapsedNs / 1e6 / count); totals.push({ elapsedNs, steps: count }); }
    } finally { bridge.destroy(created.world); }
  }
  const q = quantiles(samples);
  return { metrics: { stepMean: samples.reduce((a, b) => a + b, 0) / samples.length, stepP50: q.p50, stepP95: q.p95, stepMax: q.max },
    timing: { clock: 'process.hrtime.bigint', scope: 'Rust bridge step including JSON ABI transport', warmupBatches: 3, batchSize, totals, perStepMs: samples } };
}
