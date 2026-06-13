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
  const lockTargetColorSrc = src.match(/const ENEMY_GEM_LOCK_TARGET_COLORS = Object\.freeze\(\{[\s\S]*?\n\}\);/);
  assert.ok(lockTargetColorSrc, 'missing ENEMY_GEM_LOCK_TARGET_COLORS');
  const harnessStoreSrc = src.match(/const ENEMY_BOARD_PRESSURE_SKILL_HARNESSES = Object\.freeze\(\{[\s\S]*?\n\}\);/);
  assert.ok(harnessStoreSrc, 'missing ENEMY_BOARD_PRESSURE_SKILL_HARNESSES');
  const getHarnessSrc = extractFunctionSource(src, 'getEnemyBoardPressureSkillHarness')
    .replace(/^function\s+getEnemyBoardPressureSkillHarness\s*\(/, 'function(');
  const getGemColorSrc = extractFunctionSource(src, 'getEnemyGemColor')
    .replace(/^function\s+getEnemyGemColor\s*\(/, 'function(');
  const isPressureTargetSrc = extractFunctionSource(src, 'isEnemyBoardPressureLockTargetGem')
    .replace(/^function\s+isEnemyBoardPressureLockTargetGem\s*\(/, 'function(');
  const clearLockStateSrc = extractFunctionSource(src, 'clearEnemyGemLockState')
    .replace(/^function\s+clearEnemyGemLockState\s*\(/, 'function(');
  const isLockedSrc = extractFunctionSource(src, 'isEnemyGemLocked')
    .replace(/^function\s+isEnemyGemLocked\s*\(/, 'function(');
  const ensureGroupsSrc = extractFunctionSource(src, 'ensureEnemyGemLockGroups')
    .replace(/^function\s+ensureEnemyGemLockGroups\s*\(/, 'function(');
  const getFazeHeroTeamTurnSpanSrc = extractFunctionSource(src, 'getFazeHeroTeamTurnSpan')
    .replace(/^function\s+getFazeHeroTeamTurnSpan\s*\(/, 'function(');
  const getFazeHeroTeamTurnSerialSrc = extractFunctionSource(src, 'getFazeHeroTeamTurnSerial')
    .replace(/^function\s+getFazeHeroTeamTurnSerial\s*\(/, 'function(');
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
     ${lockTargetColorSrc[0]}
     ${harnessStoreSrc[0]}
     const getEnemyBoardPressureSkillHarness = ${getHarnessSrc};
     const getEnemyGemColor = ${getGemColorSrc};
     const isEnemyBoardPressureLockTargetGem = ${isPressureTargetSrc};
     const clearEnemyGemLockState = ${clearLockStateSrc};
     const isEnemyGemLocked = ${isLockedSrc};
     const ensureEnemyGemLockGroups = ${ensureGroupsSrc};
     const getFazeHeroTeamTurnSpan = ${getFazeHeroTeamTurnSpanSrc};
     const getFazeHeroTeamTurnSerial = ${getFazeHeroTeamTurnSerialSrc};
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
      TurnSerial: 20,
      HeroTeamTurnSerial: 10,
      TurnOrderArray: [
        { uid: 1, type: 0 },
        { uid: 2, type: 0 },
        { uid: 3, type: 0 },
        { uid: 4, type: 0 },
        { uid: 100, type: 1 },
      ],
    },
    gems: [],
  };
  const baseGems = [
    { uid: 1, cellC: 0, cellR: 0, color: 2 },
    { uid: 2, cellC: 1, cellR: 0, color: 4 },
    { uid: 3, cellC: 2, cellR: 0, color: 1 },
    { uid: 4, cellC: 0, cellR: 1, color: 4 },
    { uid: 5, cellC: 1, cellR: 1, color: 2 },
    { uid: 6, cellC: 2, cellR: 1, color: 4 },
    { uid: 7, cellC: 0, cellR: 2, color: 4 },
    { uid: 8, cellC: 1, cellR: 2, color: 3 },
    { uid: 9, cellC: 2, cellR: 2, color: 2 },
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
    const lockedScatheGems = lockedColumn.filter((gem) => gem.locked === true && gem.Locked === 1);
    assert.equal(lockedColumn.length, 3);
    assert.equal(lockedScatheGems.length, 1);
    assert.ok(lockedScatheGems.every((gem) => gem.lockCountdown === 3 && gem.LockCountdown === 3));
    assert.ok(lockedScatheGems.every((gem) => gem.color === 2));
    assert.equal(new Set(lockedScatheGems.map((gem) => gem.lockGroupId)).size, 1);
    const scatheGroup = sandbox.globals.EnemyGemLockGroups[lockedScatheGems[0].lockGroupId];
    assert.equal(scatheGroup.durationHeroTeamTurns, 3);
    assert.equal(scatheGroup.heroTeamTurnSpan, 4);
    assert.equal(scatheGroup.createdHeroTeamTurnSerial, 10);
    assert.equal(scatheGroup.expiresAtHeroTeamTurnSerial, 13);
    assert.equal(scatheGroup.gemUIDs.length, 1);
    assert.equal(sandbox.globals.EnemyLineClearPressureActive, undefined);
    assert.equal(sandbox.logs[0], 'Djinn used Scathe and locked 1 gem from a column. (3 turns).');

    tickEnemyGemLockCountdowns(sandbox);
    assert.ok(lockedScatheGems.every((gem) => gem.lockCountdown === 3));
    sandbox.globals.TurnSerial = 21;
    tickEnemyGemLockCountdowns(sandbox);
    assert.ok(lockedScatheGems.every((gem) => gem.lockCountdown === 3), 'actor turns do not decrement locked gems');
    sandbox.globals.HeroTeamTurnSerial = 11;
    tickEnemyGemLockCountdowns(sandbox);
    assert.ok(lockedScatheGems.every((gem) => gem.lockCountdown === 2));
    sandbox.globals.TurnSerial = 25;
    tickEnemyGemLockCountdowns(sandbox);
    assert.ok(lockedScatheGems.every((gem) => gem.lockCountdown === 2), 'enemy-only turn serial changes do not decrement again');
    sandbox.globals.HeroTeamTurnSerial = 12;
    tickEnemyGemLockCountdowns(sandbox);
    assert.ok(lockedScatheGems.every((gem) => gem.lockCountdown === 1));
    sandbox.globals.HeroTeamTurnSerial = 13;
    tickEnemyGemLockCountdowns(sandbox);
    assert.ok(lockedScatheGems.every((gem) => !gem.locked && gem.Locked == null));

    sandbox.gems = [
      { uid: 1, cellC: 0, cellR: 0, color: 2 },
      { uid: 2, cellC: 1, cellR: 0, color: 4 },
      { uid: 3, cellC: 2, cellR: 0, color: 1 },
      { uid: 4, cellC: 0, cellR: 1, color: 4 },
      { uid: 5, cellC: 1, cellR: 1, color: 2 },
      { uid: 6, cellC: 2, cellR: 1, color: 4 },
      { uid: 7, cellC: 0, cellR: 2, color: 4 },
      { uid: 8, cellC: 1, cellR: 2, color: 3 },
      { uid: 9, cellC: 2, cellR: 2, color: 2 },
    ];
    sandbox.logs.length = 0;
    delete sandbox.globals.EnemyLineClearPressureActive;
    sandbox.globals.TurnSerial = 30;
    sandbox.globals.HeroTeamTurnSerial = 20;

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
    const lockedSweepGems = lockedRow.filter((gem) => gem.locked === true && gem.Locked === 1);
    assert.equal(lockedRow.length, 3);
    assert.equal(lockedSweepGems.length, 2);
    assert.ok(lockedSweepGems.every((gem) => gem.lockCountdown === 5 && gem.LockCountdown === 5));
    assert.ok(lockedSweepGems.every((gem) => gem.color === 4));
    assert.equal(new Set(lockedSweepGems.map((gem) => gem.lockGroupId)).size, 1);
    const sweepGroup = sandbox.globals.EnemyGemLockGroups[lockedSweepGems[0].lockGroupId];
    assert.equal(sweepGroup.durationHeroTeamTurns, 5);
    assert.equal(sweepGroup.heroTeamTurnSpan, 4);
    assert.equal(sweepGroup.createdHeroTeamTurnSerial, 20);
    assert.equal(sweepGroup.expiresAtHeroTeamTurnSerial, 25);
    assert.equal(sweepGroup.gemUIDs.length, 2);
    assert.equal(sandbox.globals.EnemyLineClearPressureActive, undefined);
    assert.equal(sandbox.logs[0], 'Marid used Sweep and locked 2 gems from a row. (5 turns).');
  });

  test(`consecutive Djinn and Marid lock casts stay capped per group in ${relPath}`, () => {
    const src = read(relPath);
    const factory = buildLineClearFns(src);
    const { Enemy_Scathe, Enemy_Sweep } = factory(
      (ctx) => ctx.globals,
      (ctx) => ctx.gems,
      (ctx, gems) => { ctx.gems = gems; },
      () => {},
      (_ctx, uid) => (uid === 100 ? 'Djinn' : 'Marid'),
      (ctx, msg) => ctx.logs.push(String(msg)),
      (ctx, size) => Math.floor(Number(ctx.globals.RuntimeRandom()) * size),
    );

    const djinnSandbox = makeSandbox();
    Enemy_Scathe(djinnSandbox, 100);
    Enemy_Scathe(djinnSandbox, 100);
    const scatheGroups = Object.values(djinnSandbox.globals.EnemyGemLockGroups)
      .filter((group) => group.skillId === 'Enemy_Scathe');
    assert.equal(scatheGroups.length, 2);
    assert.ok(scatheGroups.every((group) => group.gemUIDs.length <= 1));
    assert.equal(djinnSandbox.gems.filter((gem) => gem.locked === true).length, 2);
    assert.ok(djinnSandbox.logs.every((line) => /locked 1 gem from a column/.test(line)));

    const maridSandbox = makeSandbox();
    Enemy_Sweep(maridSandbox, 101);
    Enemy_Sweep(maridSandbox, 101);
    const sweepGroups = Object.values(maridSandbox.globals.EnemyGemLockGroups)
      .filter((group) => group.skillId === 'Enemy_Sweep');
    assert.equal(sweepGroups.length, 2);
    assert.ok(sweepGroups.every((group) => group.gemUIDs.length <= 2));
    assert.ok(maridSandbox.gems.filter((gem) => gem.locked === true).length <= 4);
    assert.ok(maridSandbox.logs.every((line) => /locked [12] gems? from a row/.test(line)));
  });

  test(`Marid prefers a row with two lockable heal gems when available in ${relPath}`, () => {
    const src = read(relPath);
    const factory = buildLineClearFns(src);
    const { Enemy_Sweep } = factory(
      (ctx) => ctx.globals,
      (ctx) => ctx.gems,
      (ctx, gems) => { ctx.gems = gems; },
      () => {},
      () => 'Marid',
      (ctx, msg) => ctx.logs.push(String(msg)),
      (ctx, size) => Math.floor(Number(ctx.globals.RuntimeRandom()) * size),
    );

    const maridSandbox = makeSandbox();
    maridSandbox.globals.RuntimeRandom = () => 0;
    const result = Enemy_Sweep(maridSandbox, 101);
    const lockedGems = maridSandbox.gems.filter((gem) => gem.locked === true && gem.Locked === 1);

    assert.equal(result, 1);
    assert.equal(lockedGems.length, 2);
    assert.ok(lockedGems.every((gem) => gem.cellR === 1));
    assert.ok(lockedGems.every((gem) => gem.color === 4));
    assert.equal(maridSandbox.logs[0], 'Marid used Sweep and locked 2 gems from a row. (5 turns).');
  });

  test(`Djinn and Marid lock moves are unavailable without their required gem color in ${relPath}`, () => {
    const src = read(relPath);
    const factory = buildLineClearFns(src);
    const { Enemy_Scathe, Enemy_Sweep } = factory(
      (ctx) => ctx.globals,
      (ctx) => ctx.gems,
      (ctx, gems) => { ctx.gems = gems; },
      () => {},
      (_ctx, uid) => (uid === 100 ? 'Djinn' : 'Marid'),
      (ctx, msg) => ctx.logs.push(String(msg)),
      (ctx, size) => Math.floor(Number(ctx.globals.RuntimeRandom()) * size),
    );

    const djinnSandbox = makeSandbox();
    djinnSandbox.gems.forEach((gem) => { gem.color = 4; });
    assert.equal(Enemy_Scathe(djinnSandbox, 100), 0);
    assert.equal(djinnSandbox.gems.filter((gem) => gem.locked === true).length, 0);
    assert.deepEqual(djinnSandbox.logs, []);

    const maridSandbox = makeSandbox();
    maridSandbox.gems.forEach((gem) => { gem.color = 2; });
    assert.equal(Enemy_Sweep(maridSandbox, 101), 0);
    assert.equal(maridSandbox.gems.filter((gem) => gem.locked === true).length, 0);
    assert.deepEqual(maridSandbox.logs, []);
  });
}
