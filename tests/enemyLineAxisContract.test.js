const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

function extractFunctionSource(src, name) {
  const markers = [`export function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const marker of markers) {
    start = src.indexOf(marker);
    if (start !== -1) break;
  }
  assert.notEqual(start, -1, `missing ${name}`);
  const braceStart = src.indexOf('{', start);
  assert.notEqual(braceStart, -1, `missing body for ${name}`);
  let depth = 0;
  for (let i = braceStart; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

function buildLineClearFns(src) {
  const lockDurationSrc = src.match(/const ENEMY_GEM_LOCK_DURATIONS = Object\.freeze\(\{[\s\S]*?\n\}\);/);
  assert.ok(lockDurationSrc, 'missing ENEMY_GEM_LOCK_DURATIONS');
  const harnessStoreSrc = src.match(/const ENEMY_BOARD_PRESSURE_SKILL_HARNESSES = Object\.freeze\(\{[\s\S]*?\n\}\);/);
  assert.ok(harnessStoreSrc, 'missing ENEMY_BOARD_PRESSURE_SKILL_HARNESSES');
  const getHarnessSrc = extractFunctionSource(src, 'getEnemyBoardPressureSkillHarness')
    .replace(/^function\s+getEnemyBoardPressureSkillHarness\s*\(/, 'function(');
  const clearLockStateSrc = extractFunctionSource(src, 'clearEnemyGemLockState')
    .replace(/^function\s+clearEnemyGemLockState\s*\(/, 'function(');
  const isLockedSrc = extractFunctionSource(src, 'isEnemyGemLocked')
    .replace(/^function\s+isEnemyGemLocked\s*\(/, 'function(');
  const ensureGroupsSrc = extractFunctionSource(src, 'ensureEnemyGemLockGroups')
    .replace(/^function\s+ensureEnemyGemLockGroups\s*\(/, 'function(');
  const createGroupSrc = extractFunctionSource(src, 'createEnemyGemLockGroup')
    .replace(/^function\s+createEnemyGemLockGroup\s*\(/, 'function(');
  const applyLockSrc = extractFunctionSource(src, 'applyEnemyGemLockState')
    .replace(/^function\s+applyEnemyGemLockState\s*\(/, 'function(');
  const syncGroupsSrc = extractFunctionSource(src, 'syncEnemyGemLockGroupsToBoard')
    .replace(/^function\s+syncEnemyGemLockGroupsToBoard\s*\(/, 'function(');
  const tickGroupsSrc = extractFunctionSource(src, 'tickEnemyGemLockCountdowns')
    .replace(/^function\s+tickEnemyGemLockCountdowns\s*\(/, 'function(');
  const lockRandomGemLineSrc = extractFunctionSource(src, 'lockRandomGemLine')
    .replace(/^function\s+lockRandomGemLine\s*\(/, 'function(');
  const executeEnemyBoardPressureSkillSrc = extractFunctionSource(src, 'executeEnemyBoardPressureSkill')
    .replace(/^function\s+executeEnemyBoardPressureSkill\s*\(/, 'function(');
  const enemyScatheSrc = extractFunctionSource(src, 'Enemy_Scathe')
    .replace(/^export\s+/, '')
    .replace(/^function\s+Enemy_Scathe\s*\(/, 'function(');
  const enemySweepSrc = extractFunctionSource(src, 'Enemy_Sweep')
    .replace(/^export\s+/, '')
    .replace(/^function\s+Enemy_Sweep\s*\(/, 'function(');
  return new Function(
    'getGlobals',
    'getGems',
    'setGems',
    'setSelectedGemIndices',
    'getActorNameByUID',
    'LogCombat',
    'randomIndex',
    `${lockDurationSrc[0]}
     ${harnessStoreSrc[0]}
     const getEnemyBoardPressureSkillHarness = ${getHarnessSrc};
     const clearEnemyGemLockState = ${clearLockStateSrc};
     const isEnemyGemLocked = ${isLockedSrc};
     const ensureEnemyGemLockGroups = ${ensureGroupsSrc};
     const createEnemyGemLockGroup = ${createGroupSrc};
     const applyEnemyGemLockState = ${applyLockSrc};
     const syncEnemyGemLockGroupsToBoard = ${syncGroupsSrc};
     const tickEnemyGemLockCountdowns = ${tickGroupsSrc};
     const lockRandomGemLine = ${lockRandomGemLineSrc};
     const executeEnemyBoardPressureSkill = ${executeEnemyBoardPressureSkillSrc};
     return {
       Enemy_Scathe: ${enemyScatheSrc},
       Enemy_Sweep: ${enemySweepSrc},
       tickEnemyGemLockCountdowns,
     };`
  );
}

function makeSandbox() {
  const ctx = {
    globals: {
      RuntimeRandom: () => 0.4,
    },
    gems: [],
  };
  const baseGems = [
    { uid: 1, cellC: 0, cellR: 0 },
    { uid: 2, cellC: 1, cellR: 0 },
    { uid: 3, cellC: 2, cellR: 0 },
    { uid: 4, cellC: 0, cellR: 1 },
    { uid: 5, cellC: 1, cellR: 1 },
    { uid: 6, cellC: 2, cellR: 1 },
    { uid: 7, cellC: 0, cellR: 2 },
    { uid: 8, cellC: 1, cellR: 2 },
    { uid: 9, cellC: 2, cellR: 2 },
  ];
  ctx.gems = JSON.parse(JSON.stringify(baseGems));
  ctx.logs = [];
  return ctx;
}

for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
  test(`Djinn locks a column and Marid locks a row in ${relPath}`, () => {
    const src = read(relPath);
    const sandbox = makeSandbox();
    const factory = buildLineClearFns(src);
    const { Enemy_Scathe, Enemy_Sweep, tickEnemyGemLockCountdowns } = factory(
      (ctx) => ctx.globals,
      (ctx) => ctx.gems,
      (ctx, gems) => { ctx.gems = gems; },
      () => {},
      (_ctx, uid) => (uid === 100 ? 'Djinn' : 'Marid'),
      (ctx, msg) => ctx.logs.push(String(msg)),
      (ctx, size) => Math.floor(Number(ctx.globals.RuntimeRandom()) * size),
    );

    const scatheResult = Enemy_Scathe(sandbox, 100);
    assert.equal(scatheResult, 1);
    assert.deepEqual(
      sandbox.gems.map((gem) => [gem.cellC, gem.cellR]),
      [
        [0, 0], [1, 0], [2, 0],
        [0, 1], [1, 1], [2, 1],
        [0, 2], [1, 2], [2, 2],
      ],
    );
    const lockedColumn = sandbox.gems.filter((gem) => gem.cellC === 1);
    assert.equal(lockedColumn.length, 3);
    assert.ok(lockedColumn.every((gem) => gem.locked === true && gem.Locked === 1));
    assert.ok(lockedColumn.every((gem) => gem.lockCountdown === 3 && gem.LockCountdown === 3));
    assert.equal(new Set(lockedColumn.map((gem) => gem.lockGroupId)).size, 1);
    assert.equal(sandbox.globals.EnemyLineClearPressureActive, undefined);
    assert.equal(sandbox.logs[0], 'Djinn used Scathe and locked 3 gems from a column. (3 turns).');

    tickEnemyGemLockCountdowns(sandbox);
    assert.ok(lockedColumn.every((gem) => gem.lockCountdown === 3));
    sandbox.globals.TurnSerial = 1;
    tickEnemyGemLockCountdowns(sandbox);
    assert.ok(lockedColumn.every((gem) => gem.lockCountdown === 2));
    sandbox.globals.TurnSerial = 2;
    tickEnemyGemLockCountdowns(sandbox);
    assert.ok(lockedColumn.every((gem) => gem.lockCountdown === 1));
    sandbox.globals.TurnSerial = 3;
    tickEnemyGemLockCountdowns(sandbox);
    assert.ok(lockedColumn.every((gem) => !gem.locked && gem.Locked == null));

    sandbox.gems = [
      { uid: 1, cellC: 0, cellR: 0 },
      { uid: 2, cellC: 1, cellR: 0 },
      { uid: 3, cellC: 2, cellR: 0 },
      { uid: 4, cellC: 0, cellR: 1 },
      { uid: 5, cellC: 1, cellR: 1 },
      { uid: 6, cellC: 2, cellR: 1 },
      { uid: 7, cellC: 0, cellR: 2 },
      { uid: 8, cellC: 1, cellR: 2 },
      { uid: 9, cellC: 2, cellR: 2 },
    ];
    sandbox.logs.length = 0;
    delete sandbox.globals.EnemyLineClearPressureActive;

    const sweepResult = Enemy_Sweep(sandbox, 101);
    assert.equal(sweepResult, 1);
    assert.deepEqual(
      sandbox.gems.map((gem) => [gem.cellC, gem.cellR]),
      [
        [0, 0], [1, 0], [2, 0],
        [0, 1], [1, 1], [2, 1],
        [0, 2], [1, 2], [2, 2],
      ],
    );
    const lockedRow = sandbox.gems.filter((gem) => gem.cellR === 1);
    assert.equal(lockedRow.length, 3);
    assert.ok(lockedRow.every((gem) => gem.locked === true && gem.Locked === 1));
    assert.ok(lockedRow.every((gem) => gem.lockCountdown === 5 && gem.LockCountdown === 5));
    assert.equal(new Set(lockedRow.map((gem) => gem.lockGroupId)).size, 1);
    assert.equal(sandbox.globals.EnemyLineClearPressureActive, undefined);
    assert.equal(sandbox.logs[0], 'Marid used Sweep and locked 3 gems from a row. (5 turns).');
  });
}
