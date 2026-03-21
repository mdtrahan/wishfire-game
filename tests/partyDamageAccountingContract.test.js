const path = require('node:path');
const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

function loadModule(modulePath) {
  const original = fs.readFileSync(modulePath, 'utf8');
  const transformed = `${original
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = {
  Enemy_ATK_Single,
  Enemy_MAG_Single,
  CalculateDamage,
  ApplyDamageToTarget,
};`;
  const context = {
    console,
    Math,
    module: { exports: {} },
    exports: {},
    state: { globals: {}, entities: [] },
  };
  vm.createContext(context);
  new vm.Script(transformed, { filename: modulePath }).runInContext(context);
  return context.module.exports;
}

function withRandomSequence(sequence, fn) {
  const original = Math.random;
  let index = 0;
  Math.random = () => {
    const value = sequence[Math.min(index, sequence.length - 1)];
    index += 1;
    return value;
  };
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

function makeCombatContext({ heroName = 'Falie', heroHp = 5, enemyAtk = 30, enemyMag = 30 } = {}) {
  const hero = {
    uid: 100,
    kind: 'hero',
    name: heroName,
    heroIndex: 0,
    hp: heroHp,
    maxHP: heroHp,
    ATK: 4,
    DEF: 0,
    MAG: 2,
    RES: 0,
    SPD: 1,
    x: 10,
    y: 10,
    stats: { ATK: 4, DEF: 0, MAG: 2, RES: 0, SPD: 1 },
  };
  const enemy = {
    uid: 200,
    kind: 'enemy',
    name: 'Marid',
    hp: 999,
    maxHP: 999,
    ATK: enemyAtk,
    DEF: 0,
    MAG: enemyMag,
    RES: 0,
    SPD: 1,
    x: 20,
    y: 20,
    stats: { ATK: enemyAtk, DEF: 0, MAG: enemyMag, RES: 0, SPD: 1 },
  };
  return {
    state: {
      globals: {
        time: 0,
        SpawnDamageText: 0,
        CombatActionLines: ['', '', '', ''],
        CombatLog: [],
        PartyHP: heroHp,
        PartyMaxHP: heroHp,
        PartyHPByIndex: [heroHp],
        PartyMaxHPByIndex: [heroHp],
        HeroIconPosByIndex: [{ x: 10, y: 10 }],
        TurnOrderArray: [{ uid: enemy.uid, type: 1, spd: 1 }],
        CurrentTurnIndex: 0,
        IsAOEMatch: 0,
      },
      entities: [hero, enemy],
    },
  };
}

function parseLoggedDamage(line) {
  const match = String(line || '').match(/for (\d+)!/);
  assert.ok(match, `expected damage line, got: ${line}`);
  return Number(match[1]);
}

function runSingleTargetAccountingPasses(modulePath, attackKind) {
  const mod = loadModule(modulePath);
  for (let pass = 0; pass < 1000; pass += 1) {
    const heroHp = (pass % 9) + 1;
    const sequence = [
      ((pass * 17) % 100) / 100,
      ((pass * 37 + 11) % 100) / 100,
    ];
    const attemptedCtx = makeCombatContext({ heroHp });
    const attemptedDamage = withRandomSequence(sequence, () =>
      mod.CalculateDamage(
        attemptedCtx,
        200,
        100,
        attackKind === 'melee' ? 'melee' : 'magic',
      )
    );
    assert.ok(attemptedDamage >= heroHp, `expected overkill attempt on pass ${pass + 1}`);

    const ctx = makeCombatContext({ heroHp });
    const beforePartyHp = Number(ctx.state.globals.PartyHP || 0);
    const beforeHeroHp = Number(ctx.state.entities[0].hp || 0);
    withRandomSequence(sequence, () => {
      if (attackKind === 'melee') {
        mod.Enemy_ATK_Single(ctx, 200, 100);
      } else {
        mod.Enemy_MAG_Single(ctx, 200, 100);
      }
    });
    const afterHeroHp = Number(ctx.state.entities[0].hp || 0);
    const afterPartyHp = Number(ctx.state.globals.PartyHP || 0);
    const appliedDamage = beforeHeroHp - afterHeroHp;
    const partyDamage = beforePartyHp - afterPartyHp;
    const loggedDamage = parseLoggedDamage(ctx.state.globals.CombatActionLines[3]);

    assert.equal(afterHeroHp, 0, `hero should clamp to 0 on pass ${pass + 1}`);
    assert.equal(partyDamage, appliedDamage, `party HP must match applied damage on pass ${pass + 1}`);
    assert.equal(loggedDamage, appliedDamage, `combat log must report applied damage on pass ${pass + 1}`);
    assert.ok(attemptedDamage >= appliedDamage, `attempted damage must be >= applied damage on pass ${pass + 1}`);
  }
}

test('enemy single-target damage accounting uses applied post-clamp damage in both runtime mirrors over 1000 melee passes', () => {
  const repoRoot = path.join(__dirname, '..');
  runSingleTargetAccountingPasses(path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js'), 'melee');
  runSingleTargetAccountingPasses(path.join(repoRoot, 'Scripts', 'functionBank.js'), 'melee');
});

test('enemy magic single-target damage accounting uses applied post-clamp damage in both runtime mirrors over 1000 passes', () => {
  const repoRoot = path.join(__dirname, '..');
  runSingleTargetAccountingPasses(path.join(repoRoot, 'web-runner', 'modules', 'functionBank.js'), 'magic');
  runSingleTargetAccountingPasses(path.join(repoRoot, 'Scripts', 'functionBank.js'), 'magic');
});
