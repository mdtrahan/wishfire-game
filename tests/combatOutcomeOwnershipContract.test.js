const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const appPath = path.join(__dirname, '..', 'web-runner', 'app.js');
const rulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'combatOutcomeRules.mjs');
const shadowModulePath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');

test('simulation core module exposes a Rust-owned combat outcome marker', () => {
  const shadowSrc = fs.readFileSync(shadowModulePath, 'utf8');

  assert.match(shadowSrc, /window\.__ORKA_COMBAT_OUTCOME_OWNER__/);
  assert.match(shadowSrc, /export function createSimulationCoreCombatOutcomeResolution/);
  assert.match(shadowSrc, /simulationCore\.startup\.combatOutcomeOwner/);
  assert.match(shadowSrc, /combatOutcomeOwnerChecks/);
  assert.match(shadowSrc, /dataset\.simCoreShadowCombatOutcomeOwner/);
});

test('combat outcome resolver follows Rust owner when Rust and JS disagree', async () => {
  const {
    combatOutcomeReasonFromCode,
    resolveCombatOutcome,
  } = await import(pathToFileURL(rulesPath));
  const calls = [];
  const result = resolveCombatOutcome({
    source: 'test.combatOutcomeOwner',
    energy: 10,
    partyHp: 40,
    livingHeroes: 4,
    ownerHook: (payload) => {
      calls.push(payload);
      return { owner: 'rust', code: 2 };
    },
  });

  assert.equal(result.owner, 'rust');
  assert.equal(result.code, 2);
  assert.equal(result.reason, 'party_defeated');
  assert.equal(combatOutcomeReasonFromCode(0), '');
  assert.equal(calls[0].jsCode, 0);
  assert.equal(calls[0].energy, 10);
  assert.equal(calls[0].partyHp, 40);
  assert.equal(calls[0].livingHeroes, 4);
});

test('dev autoplay stop checks route through Rust-owned combat outcome resolver', () => {
  const appSrc = fs.readFileSync(appPath, 'utf8');

  assert.match(appSrc, /resolveCombatOutcome/);
  assert.match(appSrc, /__ORKA_COMBAT_OUTCOME_OWNER__/);
  assert.match(appSrc, /app\.runDevAutoplayUntilDepleted/);
  assert.match(appSrc, /lastReason: outcome\.reason/);
});
