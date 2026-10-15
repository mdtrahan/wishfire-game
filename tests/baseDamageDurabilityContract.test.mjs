import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HERO_DEFINITIONS } from '../web-runner/src/core/heroDefinitions.mjs';
import { levelStats } from '../web-runner/src/core/heroProgression.mjs';
import { heroBasicAttackRate } from '../web-runner/src/core/realtimeCooldown.mjs';
import { scaleRoutineEnemy } from '../web-runner/src/core/routineEnemyScaling.mjs';
import { calculateDamageFromJs } from '../src/core/calculateDamageRules.mjs';

const columns = JSON.parse(fs.readFileSync(new URL('../web-runner/assets/enemies.json', import.meta.url))).data;
const headers = columns.map(column => column[0][0]);
const catalog = Object.fromEntries(Array.from({ length: columns[0].length - 1 }, (_, index) => {
  const row = Object.fromEntries(columns.map((column, columnIndex) => [headers[columnIndex], column[index + 1]?.[0]]));
  return [row.name, scaleRoutineEnemy(row, 1)];
}).filter(([name]) => name));

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
