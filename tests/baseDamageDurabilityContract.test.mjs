import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HERO_DEFINITIONS } from '../web-runner/src/core/heroDefinitions.mjs';
import { levelStats } from '../web-runner/src/core/heroProgression.mjs';
import { heroBasicAttackRate } from '../web-runner/src/core/realtimeCooldown.mjs';
import { capContinuousHostileHit, scaleRoutineEnemy } from '../web-runner/src/core/routineEnemyScaling.mjs';
import { rulesContext } from '../web-runner/modules/heroCommands.mjs';
import { calculateDamageFromJs } from '../src/core/calculateDamageRules.mjs';

const columns = JSON.parse(fs.readFileSync(new URL('../web-runner/assets/enemies.json', import.meta.url))).data;
const headers = columns.map(column => column[0][0]);
const catalog = Object.fromEntries(Array.from({ length: columns[0].length - 1 }, (_, index) => {
  const row = Object.fromEntries(columns.map((column, columnIndex) => [headers[columnIndex], column[index + 1]?.[0]]));
  return [row.name, scaleRoutineEnemy(row, 1)];
}).filter(([name]) => name));

test('continuous hostile damage obeys the tier ceiling at the applied hit seam', () => {
  const limits = { fodder: 1, routine: 1, hard: 4, elite: 7, boss: 10 };
  for (const [combatTier, expected] of Object.entries(limits)) {
    assert.equal(capContinuousHostileHit(25, 60, { combatTier }), expected);
  }
  const enemy = { uid: 9, kind: 'enemy', name: 'Lizardo' };
  const hero = { uid: 1, kind: 'hero', hp: 60, maxHP: 60 };
  const globals = { ContinuousCombatStageLoop: 1, EnemyData: [{ name: 'Lizardo', combatTier: 'routine' }] };
  let applied = 0;
  const ctx = { state: { globals, entities: [enemy, hero] }, callFunction(name, uid, amount) {
    if (name === 'ApplyDamageToTarget') { applied = amount; hero.hp -= amount; }
  } };
  assert.equal(rulesContext(ctx).applyDamage(enemy, hero, 25, {}), 1);
  assert.equal(applied, 1);
  globals.ContinuousCombatStageLoop = 0;
  assert.equal(rulesContext(ctx).applyDamage(enemy, hero, 25, {}), 25);
});

function partyDamagePerSecond(enemy, level = 1) {
  return Object.values(HERO_DEFINITIONS).reduce((sum, hero) => {
    const magic = hero.basic.tags.includes('magic');
    const stats = levelStats({ name: hero.key, currentLevel: level });
    const power = magic ? stats.MAG : stats.ATK;
    const defense = magic ? enemy.RES : enemy.DEF;
    const damage = calculateDamageFromJs({ power, resist: defense }).damage;
    return sum + damage * heroBasicAttackRate({ name: hero.key, stats: hero.baseStats });
  }, 0);
}

test('starting packs survive multiple hits while elite and boss gates remain killable', () => {
  for (const name of ['Skeleton', 'Gobloc', 'Lizardo', 'Orc']) {
    const enemy = catalog[name];
    const highestSingleHit = Math.max(...Object.values(HERO_DEFINITIONS).map(hero => {
      const magic = hero.basic.tags.includes('magic');
      return calculateDamageFromJs({ power: magic ? hero.baseStats.MAG : hero.baseStats.ATK, resist: magic ? enemy.RES : enemy.DEF }).damage;
    }));
    assert.ok(enemy.HP > highestSingleHit * 2, `${name} needs multiple successful attacks`);
    assert.ok(partyDamagePerSecond(enemy) > 0, `${name} can be farmed`);
  }
  const routineSeconds = catalog.Orc.HP / partyDamagePerSecond(catalog.Orc);
  const eliteSeconds = catalog['High Orc'].HP / partyDamagePerSecond(catalog['High Orc']);
  const bossSeconds = catalog.Troll.HP / partyDamagePerSecond(catalog.Troll);
  assert.ok(eliteSeconds > routineSeconds, 'elite outlasts routine pack member');
  assert.ok(bossSeconds > eliteSeconds, 'boss outlasts elite');
  const postGrowthBossSeconds = catalog.Troll.HP / partyDamagePerSecond(catalog.Troll, 5);
  assert.ok(postGrowthBossSeconds < 20, 'starting boss remains reachable after level-5 power growth');
});
