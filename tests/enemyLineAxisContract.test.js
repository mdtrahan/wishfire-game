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
  const harnessStoreSrc = src.match(/const ENEMY_BOARD_PRESSURE_SKILL_HARNESSES = Object\.freeze\(\{[\s\S]*?\n\}\);/);
  assert.ok(harnessStoreSrc, 'missing ENEMY_BOARD_PRESSURE_SKILL_HARNESSES');
  const getHarnessSrc = extractFunctionSource(src, 'getEnemyBoardPressureSkillHarness')
    .replace(/^function\s+getEnemyBoardPressureSkillHarness\s*\(/, 'function(');
  const clearRandomGemLineSrc = extractFunctionSource(src, 'clearRandomGemLine')
    .replace(/^function\s+clearRandomGemLine\s*\(/, 'function(');
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
    `${harnessStoreSrc[0]}
     const getEnemyBoardPressureSkillHarness = ${getHarnessSrc};
     const clearRandomGemLine = ${clearRandomGemLineSrc};
     const executeEnemyBoardPressureSkill = ${executeEnemyBoardPressureSkillSrc};
     return {
       Enemy_Scathe: ${enemyScatheSrc},
       Enemy_Sweep: ${enemySweepSrc},
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
  test(`Djinn clears a column and Marid clears a row in ${relPath}`, () => {
    const src = read(relPath);
    const sandbox = makeSandbox();
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

    const scatheResult = Enemy_Scathe(sandbox, 100);
    assert.equal(scatheResult, 1);
    assert.deepEqual(
      sandbox.gems.map((gem) => [gem.cellC, gem.cellR]),
      [
        [0, 0], [2, 0],
        [0, 1], [2, 1],
        [0, 2], [2, 2],
      ],
    );
    assert.equal(sandbox.globals.EnemyLineClearPressureActive, 1);
    assert.equal(sandbox.logs[0], 'Djinn used Scathe and removed 3 gems from a column.');

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
        [0, 2], [1, 2], [2, 2],
      ],
    );
    assert.equal(sandbox.globals.EnemyLineClearPressureActive, 1);
    assert.equal(sandbox.logs[0], 'Marid used Sweep and removed 3 gems from a row.');
  });
}
