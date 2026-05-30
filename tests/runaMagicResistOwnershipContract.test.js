const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const shadowPath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');
const rulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'runaMagicResistRules.mjs');

test('simulation core module exposes a Rust-owned Runa magic-resist marker', () => {
  const shadowSrc = fs.readFileSync(shadowPath, 'utf8');

  assert.match(shadowSrc, /export function createSimulationCoreRunaMagicResistResolution/);
  assert.match(shadowSrc, /window\.__ORKA_RUNA_MAGIC_RESIST_OWNER__/);
  assert.match(shadowSrc, /dataset\.simCoreShadowRunaMagicResistOwner/);
});

test('Runa magic-resist resolver follows Rust owner when Rust and JS disagree', async () => {
  const { RUNA_MAGIC_RESIST_MODE_CODES, resolveRunaMagicResist } = await import(pathToFileURL(rulesPath));
  const decision = resolveRunaMagicResist({
    targetIsRuna: 1,
    incomingDamage: 10,
    rollSource: () => 0.7,
    ownerHook: () => ({
      owner: 'rust',
      finalDamage: 0,
      modeCode: RUNA_MAGIC_RESIST_MODE_CODES.nullify,
    }),
  });

  assert.equal(decision.owner, 'rust');
  assert.equal(decision.finalDamage, 0);
  assert.equal(decision.mode, 'nullify');
  assert.equal(decision.jsDecision.mode, 'no_proc');
});

test('applyRunaMagicResist routes final mitigation through Rust-owned resolver', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, /resolveRunaMagicResist/);
    assert.match(src, /__ORKA_RUNA_MAGIC_RESIST_OWNER__/);
    assert.match(src, /g\.LastRunaMagicResist = trace;/);
  }
});
