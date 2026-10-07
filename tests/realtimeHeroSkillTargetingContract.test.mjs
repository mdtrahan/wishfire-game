import test from 'node:test';
import assert from 'node:assert/strict';
import { HERO_DEFINITIONS } from '../web-runner/src/core/heroDefinitions.mjs';
import { enemiesInSkillShape, selectRealtimeHeroSkillTarget } from '../web-runner/src/core/realtimeHeroTargeting.mjs';

const skill = (hero, id) => HERO_DEFINITIONS[hero].actives.find(entry => entry.skillId === id);
const hero = (uid, name, hp = 100, maxHP = 100) => ({ uid, kind: 'hero', baseHeroName: name, hp, maxHP, stats: { SPD: uid * 2 } });
const enemy = (uid, x, y, hp = 100, extra = {}) => ({ uid, kind: 'enemy', x, y, hp, maxHP: 100, streamState: 'engaged', ...extra });
const choose = (heroKey, id, actor, heroes, enemies, extra = {}) => selectRealtimeHeroSkillTarget({ skill: skill(heroKey, id), hero: actor, heroes, enemies, ...extra });

test('area geometry uses enemy centers in circles, rectangles and puncture lines', () => {
  const enemies = [enemy(1, 170, 200), enemy(2, 190, 225), enemy(3, 230, 250), enemy(4, 200, 260, 0)];
  assert.deepEqual(enemiesInSkillShape(enemies, { kind: 'circle', center: { x: 170, y: 200 }, radius: 40 }).map(e => e.uid), [1, 2]);
  assert.deepEqual(enemiesInSkillShape(enemies, { kind: 'rectangle', center: { x: 190, y: 225 }, width: 80, height: 50 }).map(e => e.uid), [1, 2, 3]);
  assert.deepEqual(enemiesInSkillShape(enemies, { kind: 'horizontalLine', center: { x: 40, y: 200 }, toX: 250, width: 28 }).map(e => e.uid), [1]);
});

test('Cover protects the whole living party when an ally is critical',()=>{
 const fara=hero(1,'Falie'),allies=[fara,hero(2,'Huun',30),hero(3,'Runa',0)];
 assert.deepEqual(choose('Falie','cover',fara,allies,[enemy(10,200,200)]).targetUIDs,[1,2]);
 assert.equal(choose('Falie','cover',fara,allies,[]),null);
});

test('Return Gate picks greatest progress and waits when a teleport is too short', () => {
  const runa = hero(1, 'Runa'), enemies = [enemy(10, 300, 200), enemy(11, 190, 200), enemy(12, 190, 230)];
  assert.equal(choose('Runa', 'return_gate', runa, [runa], enemies).targetUID, 11);
  assert.equal(choose('Runa', 'return_gate', runa, [runa], [enemy(10, 300, 200)]), null);
});

test('Kaja support targets allies while enemy-only attacks require useful enemies', () => {
  const kaja = hero(1, 'Kojonn'), allies = [kaja, hero(2, 'Falie', 60), hero(3, 'Huun')];
  const enemies = [enemy(10, 200, 200), enemy(11, 225, 210)];
  assert.deepEqual(choose('Kojonn', 'shared_tempo', kaja, allies, enemies).targetUIDs, [1, 2, 3]);
  assert.equal(choose('Kojonn', 'patchwork', kaja, allies, enemies).targetUIDs.length, 1);
  assert.equal(choose('Kojonn', 'shared_tempo', kaja, allies, [enemies[0]]), null);
  assert.equal(choose('Huun', 'finish_the_job', allies[2], allies, enemies), null);
});

test('Quickload selects the slowest effective basic clock', () => {
  const fara = { ...hero(4, 'Falie'), speed: 100 };
  const kaja = { ...hero(1, 'Kojonn'), speed: 30 };
  const hondo = { ...hero(2, 'Huun'), speed: 20 };
  const runa = { ...hero(3, 'Runa'), speed: 2 };
  assert.equal(choose('Kojonn', 'quickload', kaja, [kaja, hondo, runa, fara], [enemy(10, 200, 200)]).targetUID, fara.uid);

});
