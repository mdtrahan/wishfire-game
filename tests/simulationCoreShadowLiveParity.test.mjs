import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const repoRoot = path.resolve(import.meta.dirname, '..');
const shadowSourcePath = path.join(repoRoot, 'web-runner', 'systems', 'simulationCoreShadow.js');
const wasmPath = path.join(repoRoot, 'web-runner', 'assets', 'simulation_core.wasm');
const seededRngUrl = pathToFileURL(path.join(repoRoot, 'web-runner', 'src', 'core', 'seededRngRules.mjs')).href;
const calculateDamageUrl = pathToFileURL(path.join(repoRoot, 'web-runner', 'src', 'core', 'calculateDamageRules.mjs')).href;
const runtimeAssetUrl = pathToFileURL(path.join(repoRoot, 'web-runner', 'systems', 'runtimeAssetUrl.mjs')).href;

async function loadShadowAgainstShippedWasm() {
  const source = fs.readFileSync(shadowSourcePath, 'utf8')
    .replace("'../src/core/seededRngRules.mjs'", `'${seededRngUrl}'`)
    .replace("'../src/core/calculateDamageRules.mjs'", `'${calculateDamageUrl}'`)
    .replace("'./runtimeAssetUrl.mjs'", `'${runtimeAssetUrl}'`);
  const modulePath = path.join(os.tmpdir(), `orka-shadow-live-parity-${process.pid}-${Date.now()}.mjs`);
  fs.writeFileSync(modulePath, source);
  const previousWindow = globalThis.window;
  const previousOfflineRuntime = globalThis.__ORKA_OFFLINE_RUNTIME__;
  globalThis.window = {};
  globalThis.__ORKA_OFFLINE_RUNTIME__ = {
    wasm: { 'simulation_core.wasm': new Uint8Array(fs.readFileSync(wasmPath)) },
  };
  const shadowModule = await import(`${pathToFileURL(modulePath).href}?v=${Date.now()}`);
  await shadowModule.initializeSimulationCoreShadow();
  return {
    shadowModule,
    shadow: globalThis.window.__ORKA_SIMULATION_CORE_SHADOW__,
    restore() {
      fs.rmSync(modulePath, { force: true });
      globalThis.window = previousWindow;
      globalThis.__ORKA_OFFLINE_RUNTIME__ = previousOfflineRuntime;
    },
  };
}

test('shipped WASM matches startup and live calculate-damage shadow packets', async () => {
  const { shadowModule, shadow, restore } = await loadShadowAgainstShippedWasm();
  try {
    assert.equal(shadow.status, 'ready');
    assert.deepEqual(shadow.mismatches, []);
    assert.deepEqual(
    {
      source: shadow.lastSingleHitOwnerCheck.source,
      damage: shadow.lastSingleHitOwnerCheck.damage,
      appliedDamage: shadow.lastSingleHitOwnerCheck.appliedDamage,
      afterHp: shadow.lastSingleHitOwnerCheck.afterHp,
    },
    { source: 'simulationCore.startup.singleHitOwner', damage: 7, appliedDamage: 7, afterHp: 33 },
    );
    assert.deepEqual(
    {
      source: shadow.lastCalculateDamageOwnerCheck.source,
      damage: shadow.lastCalculateDamageOwnerCheck.damage,
    },
    { source: 'simulationCore.startup.calculateDamageOwner', damage: 11 },
    );

    const live = shadowModule.createSimulationCoreCalculateDamageResolution({
    source: 'test.live.calculateDamage',
    power: 18,
    resist: 12,
    roll01: 0.5,
    critRoll01: 0.9,
    sourceIsHero: 1,
    heroAoe: 0,
    chainActive: 0,
    chainMultiplier: 1,
    jsDamage: 7,
    });
    assert.deepEqual(live, { owner: 'rust', damage: 7 });
    assert.deepEqual(shadow.mismatches, []);
  } finally {
    restore();
  }
});
