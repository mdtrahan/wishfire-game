const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const shadowPath = path.join(__dirname, '..', 'web-runner', 'systems', 'simulationCoreShadow.js');
const rulesPath = path.join(__dirname, '..', 'web-runner', 'src', 'core', 'heroTurnEntryRules.mjs');

test('simulation core module exposes a Rust-owned HeroTurn entry marker', () => {
  const shadowSrc = fs.readFileSync(shadowPath, 'utf8');

  assert.match(shadowSrc, /export function createSimulationCoreHeroTurnEntryResolution/);
  assert.match(shadowSrc, /window\.__ORKA_HERO_TURN_ENTRY_OWNER__/);
  assert.match(shadowSrc, /dataset\.simCoreShadowHeroTurnEntryOwner/);
});

test('HeroTurn entry resolver follows Rust owner when Rust and JS disagree', async () => {
  const { resolveHeroTurnEntry } = await import(pathToFileURL(rulesPath));
  const decision = resolveHeroTurnEntry({
    source: 'test.heroTurnEntryOwner',
    heroUID: 101,
    currentHeroUIDBefore: 77,
    skillDraughtOpen: 0,
    astralFlowAmpPoints: 18,
    astralFlowAmpMax: 18,
    astralFlowAmpReady: 1,
    time: 15,
    combatActionPinnedUntil: 14,
    ownerHook: () => ({
      owner: 'rust',
      turnPhase: 0,
      hideHeroSelector: 0,
      acceptHeroUID: 1,
      currentHeroUIDAfter: 202,
      shouldResetAstralFlowAmp: 0,
      astralFlowAmpPointsAfter: 18,
      astralFlowAmpReadyAfter: 1,
      clearCombatActionPinned: 0,
    }),
  });

  assert.equal(decision.owner, 'rust');
  assert.equal(decision.currentHeroUIDAfter, 202);
  assert.equal(decision.shouldResetAstralFlowAmp, 0);
  assert.equal(decision.jsDecision.currentHeroUIDAfter, 101);
  assert.equal(decision.jsDecision.shouldResetAstralFlowAmp, 1);
});

test('HeroTurn routes entry packet through Rust-owned resolver', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, /resolveHeroTurnEntryCompat/);
    assert.match(src, /__ORKA_HERO_TURN_ENTRY_OWNER__/);
    assert.match(src, /g\.LastHeroTurnEntryOwner/);
    assert.match(src, /decision\.shouldResetAstralFlowAmp/);
    assert.match(src, /decision\.acceptHeroUID/);
  }
});
