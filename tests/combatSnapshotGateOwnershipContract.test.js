const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { CombatRuntimeGateway } = require('../src/core');

const shadowPath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');
const gatewayCjsPath = path.join(__dirname, '..', 'src', 'core', 'combatRuntimeGateway.cjs');
const gatewayEsmPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'combatRuntimeGateway.js');

test('simulation core module exposes a Rust-owned combat snapshot marker', () => {
  const shadowSrc = fs.readFileSync(shadowPath, 'utf8');
  assert.match(shadowSrc, /window\.__ORKA_COMBAT_SNAPSHOT_OWNER__/);
  assert.match(shadowSrc, /export function createSimulationCoreCombatSnapshotResolution/);
  assert.match(shadowSrc, /dataset\.simCoreShadowCombatSnapshotOwner/);
  assert.match(shadowSrc, /combatSnapshotOwnerChecks/);
});

test('CombatRuntimeGateway follows the combat snapshot owner when Rust disagrees with JS', () => {
  const gateway = new CombatRuntimeGateway({
    combatState: {},
    combatSnapshotOwner: ({ checkpointId, jsFailures }) => ({
      owner: 'rust',
      checkpointId,
      failures: [...jsFailures, 'E_RESUME_TOKEN_MISMATCH'],
    }),
  });

  const result = gateway.evaluateCheckpoint('CHK_PRE_SUSPEND', {
    turnQueue: [{ uid: 1, type: 0 }],
    currentActorIndex: 0,
  });

  assert.equal(result.owner, 'rust');
  assert.deepEqual(result.failures, ['E_RESUME_TOKEN_MISMATCH']);
  assert.equal(result.pass, false);
});

test('CombatRuntimeGateway preserves invalid current actor index for Rust owner', () => {
  let ownerPayload = null;
  const gateway = new CombatRuntimeGateway({
    combatState: {},
    combatSnapshotOwner: (payload) => {
      ownerPayload = payload;
      return {
        owner: 'rust',
        failures: payload.jsFailures,
      };
    },
  });

  const result = gateway.evaluateCheckpoint('CHK_SNAPSHOT_EMIT', {
    snapshot: {
      snapshotVersion: 1,
      turnState: {
        turnQueue: [{ uid: 1, type: 0 }],
      },
      resumeToken: '1:1:0',
    },
  });

  assert.equal(result.owner, 'rust');
  assert.deepEqual(result.failures, ['E_SNAPSHOT_SCHEMA_INVALID']);
  assert.equal(ownerPayload.currentActorIndex, 0.5);
  assert.deepEqual(ownerPayload.jsFailures, ['E_SNAPSHOT_SCHEMA_INVALID']);
});

test('browser and commonjs gateways are wired to the combat snapshot owner hook', () => {
  const cjsSrc = fs.readFileSync(gatewayCjsPath, 'utf8');
  const esmSrc = fs.readFileSync(gatewayEsmPath, 'utf8');
  assert.match(cjsSrc, /combatSnapshotOwner/);
  assert.match(cjsSrc, /__ORKA_COMBAT_SNAPSHOT_OWNER__/);
  assert.match(esmSrc, /combatSnapshotOwner/);
  assert.match(esmSrc, /__ORKA_COMBAT_SNAPSHOT_OWNER__/);
});
