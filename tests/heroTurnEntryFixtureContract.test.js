const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const fixturePath = path.join(__dirname, 'fixtures', 'hero_turn_entry_cases.csv');
const rustLibPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'src', 'lib.rs');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');
const rulesPaths = [
  path.join(__dirname, '..', 'src', 'core', 'heroTurnEntryRules.mjs'),
  path.join(__dirname, '..', 'web-runner', 'src', 'core', 'heroTurnEntryRules.mjs'),
];

function parseCsvRows(src) {
  const [headerLine, ...lines] = src.trim().split(/\r?\n/);
  const headers = headerLine.split(',');
  return lines.map((line) => {
    const cols = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, cols[index]]));
  });
}

function toNumber(row, key) {
  return Number(row[key] || 0);
}

function payloadFromRow(row) {
  return {
    heroUID: toNumber(row, 'heroUID'),
    currentHeroUIDBefore: toNumber(row, 'currentHeroUIDBefore'),
    skillDraughtOpen: toNumber(row, 'skillDraughtOpen'),
    astralFlowAmpPoints: toNumber(row, 'astralFlowAmpPoints'),
    astralFlowAmpMax: toNumber(row, 'astralFlowAmpMax'),
    astralFlowAmpReady: toNumber(row, 'astralFlowAmpReady'),
    time: toNumber(row, 'time'),
    combatActionPinnedUntil: toNumber(row, 'combatActionPinnedUntil'),
  };
}

function assertDecision(decision, row, prefix = '') {
  assert.equal(decision.turnPhase, toNumber(row, 'expectedTurnPhase'), `${prefix}${row.name} phase`);
  assert.equal(decision.hideHeroSelector, toNumber(row, 'expectedHideHeroSelector'), `${prefix}${row.name} selector`);
  assert.equal(decision.acceptHeroUID, toNumber(row, 'expectedAcceptHeroUID'), `${prefix}${row.name} accept hero`);
  assert.equal(decision.currentHeroUIDAfter, toNumber(row, 'expectedCurrentHeroUIDAfter'), `${prefix}${row.name} current hero`);
  assert.equal(decision.shouldResetAstralFlowAmp, toNumber(row, 'expectedShouldResetAstralFlowAmp'), `${prefix}${row.name} reset`);
  assert.equal(decision.astralFlowAmpPointsAfter, toNumber(row, 'expectedAstralFlowAmpPointsAfter'), `${prefix}${row.name} points`);
  assert.equal(decision.astralFlowAmpReadyAfter, toNumber(row, 'expectedAstralFlowAmpReadyAfter'), `${prefix}${row.name} ready`);
  assert.equal(decision.clearCombatActionPinned, toNumber(row, 'expectedClearCombatActionPinned'), `${prefix}${row.name} clear pinned`);
}

for (const rulesPath of rulesPaths) {
  test(`hero turn entry fixtures encode current JS HeroTurn packet in ${path.relative(path.join(__dirname, '..'), rulesPath)}`, async () => {
    const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
    const { heroTurnEntryFromJs } = await import(pathToFileURL(rulesPath));

    assert.ok(rows.length >= 5);
    for (const row of rows) {
      assertDecision(heroTurnEntryFromJs(payloadFromRow(row)), row);
    }
  });
}

test('Rust simulation core declares HeroTurn entry shadow exports', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');

  assert.match(rustSrc, /pub fn hero_turn_entry_turn_phase/);
  assert.match(rustSrc, /extern "C" fn hero_turn_entry_turn_phase_shadow/);
  assert.match(rustSrc, /extern "C" fn hero_turn_entry_should_reset_astral_flow_shadow/);
  assert.match(rustSrc, /extern "C" fn hero_turn_entry_clear_pinned_action_shadow/);
});

test('static simulation core wasm matches hero turn entry fixtures', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;

  assert.equal(typeof exports.hero_turn_entry_turn_phase_shadow, 'function');
  assert.equal(typeof exports.hero_turn_entry_hide_hero_selector_shadow, 'function');
  assert.equal(typeof exports.hero_turn_entry_accept_hero_uid_shadow, 'function');
  assert.equal(typeof exports.hero_turn_entry_current_hero_uid_after_shadow, 'function');
  assert.equal(typeof exports.hero_turn_entry_should_reset_astral_flow_shadow, 'function');
  assert.equal(typeof exports.hero_turn_entry_amp_points_after_shadow, 'function');
  assert.equal(typeof exports.hero_turn_entry_amp_ready_after_shadow, 'function');
  assert.equal(typeof exports.hero_turn_entry_clear_pinned_action_shadow, 'function');

  for (const row of rows) {
    const payload = payloadFromRow(row);
    const shouldReset = Number(exports.hero_turn_entry_should_reset_astral_flow_shadow(
      payload.skillDraughtOpen,
      payload.astralFlowAmpReady,
      payload.astralFlowAmpPoints,
      payload.astralFlowAmpMax,
      payload.time,
      payload.combatActionPinnedUntil,
    ));
    assertDecision({
      turnPhase: Number(exports.hero_turn_entry_turn_phase_shadow()),
      hideHeroSelector: Number(exports.hero_turn_entry_hide_hero_selector_shadow()),
      acceptHeroUID: Number(exports.hero_turn_entry_accept_hero_uid_shadow(payload.heroUID)),
      currentHeroUIDAfter: Number(exports.hero_turn_entry_current_hero_uid_after_shadow(payload.heroUID, payload.currentHeroUIDBefore)),
      shouldResetAstralFlowAmp: shouldReset,
      astralFlowAmpPointsAfter: Number(exports.hero_turn_entry_amp_points_after_shadow(
        payload.skillDraughtOpen,
        payload.astralFlowAmpReady,
        payload.astralFlowAmpPoints,
        payload.astralFlowAmpMax,
        payload.time,
        payload.combatActionPinnedUntil,
      )),
      astralFlowAmpReadyAfter: Number(exports.hero_turn_entry_amp_ready_after_shadow(
        payload.skillDraughtOpen,
        payload.astralFlowAmpReady,
        payload.astralFlowAmpPoints,
        payload.astralFlowAmpMax,
        payload.time,
        payload.combatActionPinnedUntil,
      )),
      clearCombatActionPinned: Number(exports.hero_turn_entry_clear_pinned_action_shadow(shouldReset)),
    }, row, 'wasm ');
  }
});
