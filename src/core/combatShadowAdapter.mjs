// Shadow-only bases from rust/wf_combat/src/tuning.rs, not WFM balance inputs.
const heroSpeed = 78 * 1.6698;
const base = (hp, atk, def, speed, reach, interval, evade = 0, special = 0) =>
  Object.freeze({ hp, atk, def, mag: atk, res: def, speed, reach, interval, evade, special });
export const WFM_ENEMY_DEFINITIONS = Object.freeze({
  Gobloc: { id: 'slice.enemy.gobloc', stats: base(140, 10, 0, 55, 40, 2.6) },
  'High Gobloc': { id: 'wfm.enemy.high_gobloc', stats: Object.freeze({ ...base(70, 14, 14, 25.2, 46, 3.6), mag: 8, res: 12 }) },
  Lizardo: { id: 'slice.enemy.lizardo', stats: base(100, 22, 0, 45, 220, 4.5) },
  Orc: { id: 'slice.enemy.orc', stats: base(210, 11, 0, 45, 63, 3) },
  'High Orc': { id: 'slice.enemy.high_orc', stats: base(260, 30, 80, 32, 68, 4.2) },
  Chimerilass: { id: 'wfm.enemy.chimerilass', stats: Object.freeze({ ...base(80, 8, 10, 25.2, 146, 5), mag: 26, res: 16 }) },
  Troll: { id: 'slice.boss.troll_brute', stats: base(1500, 165, 0, 40, 100, 4.5) },
  Skeleton: { id: 'wfm.enemy.skeleton', stats: Object.freeze({ ...base(35, 8, 5, 25.2, 46, 3.6), mag: 4, res: 4 }) },
  Djinn: { id: 'wfm.enemy.djinn', stats: Object.freeze({ ...base(55, 6, 6, 25.2, 146, 5), mag: 28, res: 14 }) },
  Marid: { id: 'slice.enemy.marid', stats: base(235, 12, 10, heroSpeed * .95, 320, 4.5) },
});
export const SHADOW_DEFINITIONS = Object.freeze({
  ...WFM_ENEMY_DEFINITIONS,
  Falie: { id: 'slice.hero.fara', stats: base(420, 26.4, 28, heroSpeed, 100, 1.8, .09, 30) },
  Huun: { id: 'slice.hero.hondo', stats: base(300, 40.8, 14, heroSpeed * 1.1, 45, 1.2, .12, 8) },
  Runa: { id: 'slice.hero.runa', stats: base(260, 36, 10, heroSpeed * .95, 270, 1.4, .05, 10) },
  Kojonn: { id: 'slice.hero.kaja', stats: base(280, 21.6, 16, heroSpeed * .95, 235, 1.6, .05, 16) },
});

function number(value, name, positive = false) {
  if (!Number.isFinite(value) || (positive ? value <= 0 : value < 0)) throw new Error(`Invalid shadow ${name}`);
  return value;
}

export function projectShadowStats(resolved, reference, definition) {
  if (!definition) throw new Error('Unsupported shadow combatant');
  const c = definition.stats;
  const ratio = key => number(resolved[key], key, key === 'HP' || key === 'SPD') / number(reference[key], `reference ${key}`, true);
  return {
    ...c,
    hp: Math.max(1, Math.floor(c.hp * ratio('HP'))),
    atk: c.atk * ratio('ATK'),
    def: c.def === 0 ? 0 : c.def * ratio('DEF'),
    mag: c.mag * ratio('MAG'),
    res: c.res === 0 ? 0 : c.res * ratio('RES'),
    // ABI cadence bounds; SPD never changes movement or reach.
    interval: Math.max(1 / 30, Math.min(1_000_000, c.interval / ratio('SPD'))),
  };
}

function entryHP(hp, hostMax, shadowMax) {
  number(hp, 'entry HP');
  return Math.min(shadowMax, hp / number(hostMax, 'host max HP', true) * shadowMax);
}

export function shadowHero({ identity, key, slot, position, resolved, reference, hp, hostMaxHP, permanent }, origin) {
  const definition = SHADOW_DEFINITIONS[key];
  const stats = permanent?.stats || projectShadowStats(resolved, reference, definition);
  return { ...permanent, instance_id: identity, definition_id: definition.id, slot, host_max_hp: permanent?.host_max_hp ?? hostMaxHP,
    formation_offset: { x: position.x - origin.x, y: position.y - origin.y }, stats,
    hp: entryHP(hp, hostMaxHP, stats.hp) };
}

export function shadowEnemy({ identity, key, position, resolved, reference, hp, hostMaxHP, speed, interval }) {
  const definition = WFM_ENEMY_DEFINITIONS[key];
  if (!definition) throw new Error(`WFM combat: unmapped enemy "${key}"`);
  const stats = projectShadowStats(resolved, reference, definition);
  if (definition.id.startsWith('wfm.')) {
    stats.interval = interval ?? definition.stats.interval;
    stats.speed = speed ?? definition.stats.speed;
  }
  return { spawn_key: identity, definition_id: definition.id, position: { ...position }, stats,
    hp: entryHP(hp, hostMaxHP, stats.hp) };
}

export function createShadowConfig({ encounterId, seed, geometry, heroes, enemies, summon }) {
  return { encounter_id: encounterId, seed: String(seed), geometry: structuredClone(geometry),
    heroes: heroes.map(hero => shadowHero(hero, geometry.formation_origin)),
    enemies: enemies.map(enemy => ({ ...shadowEnemy(enemy),
      // Troll's children require a final host-resolved Gobloc template.
      summon_profiles: enemy.key === 'Troll' ? [{ definition_id: SHADOW_DEFINITIONS.Gobloc.id,
        stats: projectShadowStats(summon.resolved, summon.reference, SHADOW_DEFINITIONS.Gobloc) }] : [] })),
  };
}
