const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const repoRoot = path.join(__dirname, '..');
const runtimePath = path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js');
const scriptsPath = path.join(repoRoot, 'Scripts', 'functionBank.js');
const runtimeRulesPath = path.join(repoRoot, 'web-runner', 'src', 'core', 'astralFlowEnemyKoRewards.mjs');
const sharedRulesPath = path.join(repoRoot, 'src', 'core', 'astralFlowEnemyKoRewards.mjs');
const appPath = path.join(repoRoot, 'web-runner', 'app.js');

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

async function loadRules(modulePath) {
  assert.equal(fs.existsSync(modulePath), true, `${path.relative(repoRoot, modulePath)} must exist`);
  return import(pathToFileURL(modulePath));
}

async function loadFunctionBank(modulePath) {
  const helpers = await loadRules(runtimeRulesPath);
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = {
  AwardEnemyKoAstralFlow,
  BeginAstralFlowKoOrbEnemyDeaths,
  CompleteAstralFlowKoOrbRewards,
  CommitAstralFlowKoOrbEnemyDeaths,
  KillEnemyAt,
};`;
  const context = {
    console: { log() {}, warn() {}, error() {} },
    Math,
    Number,
    String,
    Array,
    Object,
    module: { exports: {} },
    exports: {},
    state: { globals: {}, entities: [] },
    setTimeout() { return 0; },
    clearTimeout() {},
    ...helpers,
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: modulePath }).runInContext(context);
  return context.module.exports;
}

function makeKillContext(enemyName = 'High Orc') {
  const hero = { uid: 100, kind: 'hero', name: 'Falie', hp: 40, maxHP: 40 };
  const enemy = {
    uid: 300,
    kind: 'enemy',
    name: enemyName,
    slotIndex: 0,
    hp: 0,
    maxHP: 95,
    x: 220,
    y: 90,
  };
  return {
    state: {
      globals: {
        time: 3,
        RuntimeRandom: () => 0.5,
        CurrentTurnIndex: 0,
        TurnOrderArray: [{ uid: hero.uid, type: 0, spd: 10 }],
        EnemySlots: [enemy.uid + 1],
        EnemyIDs: [enemy.uid],
        CombatLog: [],
        CombatActionLines: ['', '', '', ''],
        DamageTexts: [],
        SpawnDamageText: 1,
        AstralFlowWallet: 0,
        AstralFlowAmpPoints: 17,
        AstralFlowAmpMax: 18,
        AstralFlowAmpReady: 0,
        EnemySize: 40,
        SkillDraughtOpen: 0,
        SkillDraughtHeroUID: 0,
        SkillDraughtPendingOpen: 0,
        SkillDraughtPendingHeroUID: 0,
        SkillDraughtPendingForcedSkillId: '',
        SkillDraughtCandidates: [],
        SkillDraughtHitZones: [],
        SkillDraughtSelectedSkillId: '',
        SessionSkillsByHeroUID: {},
        SkillDraughtTrace: [],
        SkillDraughtTraceSeq: 0,
      },
      entities: [hero, enemy],
    },
    callFunction() {
      return undefined;
    },
  };
}

test('enemy KO Astral Flow fixed binary table is shared by runtime and Scripts helpers', async () => {
  for (const modulePath of [runtimeRulesPath, sharedRulesPath]) {
    const mod = await loadRules(modulePath);
    assert.equal(mod.getEnemyKoAstralFlowRewardPercent('High Orc'), 5);
    assert.equal(mod.getEnemyKoAstralFlowRewardPercent('Gobloc'), 5);
    assert.equal(mod.getEnemyKoAstralFlowRewardPercent('Skeleton'), 5);
    assert.equal(mod.getEnemyKoAstralFlowRewardPercent('Lizardo'), 5);
    assert.equal(mod.getEnemyKoAstralFlowRewardPercent('Orc'), 5);
    assert.equal(mod.getEnemyKoAstralFlowRewardPercent('Chimerilass'), 5);
    assert.equal(mod.getEnemyKoAstralFlowRewardPercent('Djinn'), 5);
    assert.equal(mod.getEnemyKoAstralFlowRewardPercent('High Gobloc'), 10);
    assert.equal(mod.getEnemyKoAstralFlowRewardPercent('Marid'), 10);
    assert.equal(mod.getEnemyKoAstralFlowRewardPercent('Troll'), 10);
    assert.equal(mod.getEnemyKoAstralFlowRewardPercent('Unknown'), 0);
    assert.deepEqual(mod.getEnemyKoAstralFlowOrbPresentation('High Orc').orbScales, [1, 1, 1, 1]);
    assert.deepEqual(mod.getEnemyKoAstralFlowOrbPresentation('Troll').orbScales, [1, 1.5, 1]);
    assert.equal(mod.getEnemyKoAstralFlowOrbPresentation('Unknown').orbScales.length, 0);

    const reward = mod.applyAstralFlowEnemyKoReward({
      enemyName: 'High Orc',
      astralFlowAmpPoints: 17,
      astralFlowAmpMax: 18,
      astralFlowAmpReady: 0,
      astralFlowWallet: 4,
    });
    assert.equal(reward.rewardPercent, 5);
    assert.equal(reward.rewardPoints, 0.9);
    assert.equal(reward.astralFlowAmpPointsAfter, 17.9);
    assert.equal(reward.astralFlowAmpReadyAfter, 0);
    assert.equal(reward.openDraught, 0);
    assert.equal(reward.astralFlowWalletAfter, 4.9);
    assert.equal(Object.hasOwn(reward, 'displayText'), false);

    const drawReward = mod.applyAstralFlowEnemyKoReward({
      enemyName: 'High Gobloc',
      astralFlowAmpPoints: 17,
      astralFlowAmpMax: 18,
      astralFlowAmpReady: 0,
      astralFlowWallet: 4,
    });
    assert.equal(drawReward.rewardPercent, 10);
    assert.equal(drawReward.rewardPoints, 1.8);
    assert.equal(drawReward.astralFlowAmpPointsAfter, 18);
    assert.equal(drawReward.astralFlowAmpReadyAfter, 1);
    assert.equal(drawReward.openDraught, 1);
    assert.equal(drawReward.astralFlowWalletAfter, 5.8);
    assert.equal(Object.hasOwn(drawReward, 'displayText'), false);
  }
});

test('enemy KO hook holds dead enemy visual until Astral Flow orbs are ready in both function bank mirrors', async () => {
  for (const modulePath of [runtimePath, scriptsPath]) {
    const mod = await loadFunctionBank(modulePath);
    const ctx = makeKillContext('High Gobloc');

    mod.KillEnemyAt(ctx, 0);

    const g = ctx.state.globals;
    assert.equal(g.AstralFlowAmpPoints, 17);
    assert.equal(g.AstralFlowAmpReady, 0);
    assert.equal(g.SkillDraughtPendingOpen, 0);
    assert.equal(g.SkillDraughtPendingHeroUID, 0);
    assert.equal(g.AstralFlowKoOrbQueue.length, 1);
    assert.equal(g.AstralFlowKoOrbQueue[0].enemyName, 'High Gobloc');
    assert.equal(g.AstralFlowKoOrbQueue[0].reward.rewardPercent, 10);
    assert.equal(g.AstralFlowKoOrbQueue[0].source.x, 220);
    assert.equal(g.AstralFlowKoOrbQueue[0].source.y, 90);
    assert.equal(g.AstralFlowKoOrbQueue[0].ground.y, 110);
    assert.equal(g.AstralFlowKoOrbQueue[0].color, '#1e7bd6');
    assert.deepEqual(g.AstralFlowKoOrbQueue[0].orbScales, [1, 1.5, 1]);
	    assert.equal(g.DamageTexts.length, 0);
	    assert.equal(ctx.state.entities.some(entity => entity && entity.uid === 300), true);
	    assert.equal(g.EnemySlots[0], 301);
	    assert.equal(g.EnemyDeathVisualHoldByUID[300].slotIndex, 0);
	    const heldEnemy = ctx.state.entities.find(entity => entity && entity.uid === 300);
	    assert.equal(heldEnemy.pendingOfficialDeath, 1);
	    assert.equal(heldEnemy.deathState, 'pending_attack');
	    assert.notEqual(heldEnemy.isAlive, false);

	    const begun = mod.BeginAstralFlowKoOrbEnemyDeaths(ctx);
	    assert.equal(begun.ok, true);
	    assert.equal(begun.hiddenCount, 1);
	    assert.equal(g.EnemyDeathVisualHoldByUID[300].hiddenForOrb, 1);
	    assert.equal(heldEnemy.deathState, 'payout');
	    assert.equal(heldEnemy.deathVisualHiddenForOrb, 1);
	    assert.equal(ctx.state.entities.some(entity => entity && entity.uid === 300), true);
	    assert.equal(g.EnemySlots[0], 301);

	    const completed = mod.CompleteAstralFlowKoOrbRewards(ctx);
	    assert.equal(completed.ok, true);
	    assert.equal(completed.appliedCount, 1);
	    assert.equal(ctx.state.entities.some(entity => entity && entity.uid === 300), false);
	    assert.equal(g.EnemySlots[0], 0);
	    assert.equal(Object.keys(g.EnemyDeathVisualHoldByUID).length, 0);
	    assert.equal(g.AstralFlowAmpPoints, 18);
    assert.equal(g.AstralFlowAmpReady, 1);
    assert.equal(g.SkillDraughtPendingOpen, 1);
    assert.equal(g.SkillDraughtPendingHeroUID, 100);
    assert.equal(g.AstralFlowKoOrbQueue.length, 0);
  }
});

test('function bank mirrors keep KO reward integration narrow', () => {
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = read(relPath);
    assert.match(src, /applyAstralFlowEnemyKoReward/);
	    assert.match(src, /export function AwardEnemyKoAstralFlow\(ctx, enemy, options = \{\}\)/);
	    assert.match(src, /AwardEnemyKoAstralFlow\(ctx, deadEnemy, \{[\s\S]*killerUID: Number\(currentUID \|\| 0\),[\s\S]*\}\);/);
	    assert.match(src, /export function BeginAstralFlowKoOrbEnemyDeaths\(ctx\)/);
	    assert.match(src, /export function CommitAstralFlowKoOrbEnemyDeaths\(ctx\)/);
	    assert.match(src, /export function CompleteAstralFlowKoOrbRewards\(ctx\)/);
    const awardStart = src.indexOf('export function AwardEnemyKoAstralFlow');
    const nextFunction = src.indexOf('\nfunction shouldResetAstralFlowAmpOnHeroTurn', awardStart);
    const awardBody = src.slice(awardStart, nextFunction);
    assert.doesNotMatch(awardBody, /SpawnDamageText|displayText|'astral_flow'|"astral_flow"/);
  }
  for (const relPath of ['src/core/astralFlowEnemyKoRewards.mjs', 'web-runner/src/core/astralFlowEnemyKoRewards.mjs']) {
    const src = read(relPath);
    assert.doesNotMatch(src, /EncounterCP|percentile|interpolate|scaling|formula|displayText/i);
  }
});

test('damage text rendering keeps the pre-bead numeric text path', () => {
  const appSrc = fs.readFileSync(appPath, 'utf8');
  assert.match(appSrc, /text,/);
  assert.doesNotMatch(appSrc, /displayText|High Orc|EncounterCP|AwardEnemyKoAstralFlow|applyAstralFlowEnemyKoReward|astral_flow/);
  for (const relPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
    const src = read(relPath);
    assert.match(src, /export function SpawnDamageText\(ctx, amount, x, y, kind = 'damage', targetKind = null\)/);
    const spawnStart = src.indexOf('export function SpawnDamageText');
    const spawnEnd = src.indexOf('\nexport function StartBuffRoll', spawnStart);
    const spawnBody = src.slice(spawnStart, spawnEnd);
    assert.doesNotMatch(spawnBody, /displayText/);
  }
});
