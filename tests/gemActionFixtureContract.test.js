const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const fixturePath = path.join(__dirname, 'fixtures', 'gem_action_cases.csv');
const rustLibPath = path.join(__dirname, '..', 'rust', 'simulation_core', 'src', 'lib.rs');
const wasmPath = path.join(__dirname, '..', 'web-runner', 'assets', 'simulation_core.wasm');
const rulesPaths = [
  path.join(__dirname, '..', 'src', 'core', 'gemActionRules.mjs'),
  path.join(__dirname, '..', 'web-runner', 'src', 'core', 'gemActionRules.mjs'),
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
    gemColor: toNumber(row, 'gemColor'),
    consumedCount: toNumber(row, 'consumedCount'),
    astralFlowWallet: toNumber(row, 'astralFlowWallet'),
    astralFlowAmpPoints: toNumber(row, 'astralFlowAmpPoints'),
    astralFlowAmpMax: toNumber(row, 'astralFlowAmpMax'),
    astralFlowAmpReady: toNumber(row, 'astralFlowAmpReady'),
    time: toNumber(row, 'time'),
    actionLockUntil: toNumber(row, 'actionLockUntil'),
    textAnimEndAt: toNumber(row, 'textAnimEndAt'),
    purpleRoll01: toNumber(row, 'purpleRoll01'),
  };
}

function assertDecision(decision, row, prefix = '') {
  assert.equal(decision.routeCode, toNumber(row, 'expectedRouteCode'), `${prefix}${row.name} route`);
  assert.equal(decision.pendingSkillCode, toNumber(row, 'expectedPendingSkillCode'), `${prefix}${row.name} pending`);
  assert.equal(decision.setIsAoe, toNumber(row, 'expectedSetIsAoe'), `${prefix}${row.name} set aoe`);
  assert.equal(decision.isAoe, toNumber(row, 'expectedIsAoe'), `${prefix}${row.name} aoe`);
  assert.equal(decision.showAttackUi, toNumber(row, 'expectedShowAttackUi'), `${prefix}${row.name} ui`);
  assert.equal(decision.callCode, toNumber(row, 'expectedCallCode'), `${prefix}${row.name} call`);
  assert.equal(decision.consumesTurn, toNumber(row, 'expectedConsumesTurn'), `${prefix}${row.name} consumes`);
  assert.equal(decision.blueWalletAfter, toNumber(row, 'expectedBlueWalletAfter'), `${prefix}${row.name} wallet`);
  assert.equal(decision.blueAmpPointsAfter, toNumber(row, 'expectedBlueAmpPointsAfter'), `${prefix}${row.name} amp`);
  assert.equal(decision.blueAmpReadyAfter, toNumber(row, 'expectedBlueAmpReadyAfter'), `${prefix}${row.name} ready`);
  assert.equal(decision.blueOpenDraught, toNumber(row, 'expectedBlueOpenDraught'), `${prefix}${row.name} draught`);
  assert.equal(decision.actionLockUntil, toNumber(row, 'expectedActionLockUntil'), `${prefix}${row.name} lock`);
  assert.equal(decision.purpleEnergyAmount, toNumber(row, 'expectedPurpleEnergyAmount'), `${prefix}${row.name} purple`);
}

for (const rulesPath of rulesPaths) {
  test(`gem action fixtures encode current JS ResolveGemAction packet in ${path.relative(path.join(__dirname, '..'), rulesPath)}`, async () => {
    const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
    const { gemActionFromJs } = await import(pathToFileURL(rulesPath));

    assert.ok(rows.length >= 10);
    for (const row of rows) {
      assertDecision(gemActionFromJs(payloadFromRow(row)), row);
    }
  });
}

test('Rust simulation core declares gem action shadow exports', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');

  assert.match(rustSrc, /pub fn gem_action_route_code/);
  assert.match(rustSrc, /extern "C" fn gem_action_route_code_shadow/);
  assert.match(rustSrc, /extern "C" fn gem_action_action_lock_until_shadow/);
  assert.match(rustSrc, /extern "C" fn gem_action_purple_energy_amount_shadow/);
});

test('static simulation core wasm matches gem action fixtures', async () => {
  const rows = parseCsvRows(fs.readFileSync(fixturePath, 'utf8'));
  const bytes = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(bytes, {});
  const exports = result.instance.exports;

  assert.equal(typeof exports.gem_action_route_code_shadow, 'function');
  assert.equal(typeof exports.gem_action_pending_skill_code_shadow, 'function');
  assert.equal(typeof exports.gem_action_set_aoe_shadow, 'function');
  assert.equal(typeof exports.gem_action_is_aoe_shadow, 'function');
  assert.equal(typeof exports.gem_action_show_attack_ui_shadow, 'function');
  assert.equal(typeof exports.gem_action_call_code_shadow, 'function');
  assert.equal(typeof exports.gem_action_consumes_turn_shadow, 'function');
  assert.equal(typeof exports.gem_action_consumed_count_shadow, 'function');
  assert.equal(typeof exports.gem_action_blue_wallet_after_shadow, 'function');
  assert.equal(typeof exports.gem_action_blue_amp_points_after_shadow, 'function');
  assert.equal(typeof exports.gem_action_blue_amp_ready_after_shadow, 'function');
  assert.equal(typeof exports.gem_action_blue_open_draught_shadow, 'function');
  assert.equal(typeof exports.gem_action_action_lock_until_shadow, 'function');
  assert.equal(typeof exports.gem_action_purple_energy_amount_shadow, 'function');

  for (const row of rows) {
    const payload = payloadFromRow(row);
    const routeCode = Number(exports.gem_action_route_code_shadow(payload.gemColor));
    const blueOpenDraught = Number(exports.gem_action_blue_open_draught_shadow(
      payload.consumedCount,
      payload.astralFlowAmpPoints,
      payload.astralFlowAmpMax,
      payload.astralFlowAmpReady,
    ));
    assertDecision({
      routeCode,
      pendingSkillCode: Number(exports.gem_action_pending_skill_code_shadow(routeCode)),
      setIsAoe: Number(exports.gem_action_set_aoe_shadow(routeCode)),
      isAoe: Number(exports.gem_action_is_aoe_shadow(routeCode)),
      showAttackUi: Number(exports.gem_action_show_attack_ui_shadow(routeCode)),
      callCode: Number(exports.gem_action_call_code_shadow(routeCode)),
      consumesTurn: Number(exports.gem_action_consumes_turn_shadow(routeCode)),
      blueWalletAfter: Number(exports.gem_action_blue_wallet_after_shadow(
        payload.astralFlowWallet,
        payload.consumedCount,
      )),
      blueAmpPointsAfter: Number(exports.gem_action_blue_amp_points_after_shadow(
        payload.consumedCount,
        payload.astralFlowAmpPoints,
        payload.astralFlowAmpMax,
        payload.astralFlowAmpReady,
      )),
      blueAmpReadyAfter: Number(exports.gem_action_blue_amp_ready_after_shadow(
        payload.consumedCount,
        payload.astralFlowAmpPoints,
        payload.astralFlowAmpMax,
        payload.astralFlowAmpReady,
      )),
      blueOpenDraught,
      actionLockUntil: Number(exports.gem_action_action_lock_until_shadow(
        routeCode,
        payload.actionLockUntil,
        payload.time,
        payload.textAnimEndAt,
        blueOpenDraught,
      )),
      purpleEnergyAmount: Number(exports.gem_action_purple_energy_amount_shadow(payload.purpleRoll01)),
    }, row, 'wasm ');
  }
});
