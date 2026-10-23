// Active buffs are a condition signal, not a readout. Party-wide buffs show once as stat
// icons; each hero shows its remaining buffs as at most three group badges. Debuffs,
// unknown channels and KO heroes never signal. New skills plug in through channels only.
export const BUFF_SIGNAL_SHEET = Object.freeze({ columns: 6, rows: 3, cellSize: 48 });

// Frame cell in the 6x3 sheet, in the sheet's own order.
export const BUFF_SIGNAL_FRAMES = Object.freeze(Object.fromEntries([
  'party-spd', 'party-atk', 'party-mag', 'party-def', 'party-res', 'party-hp',
  'party-cr', 'party-cd', 'party-range', 'party-dr', 'party-ward', 'party-heal',
  'party-special', 'party-reflect', 'hero-tempo', 'hero-offense', 'hero-defense',
].map((id, index) => [id, Object.freeze({ column: index % 6, row: Math.floor(index / 6) })])));

// Modifier channel -> [party icon, hero group]. Table order is the default party order.
export const BUFF_SIGNAL_CHANNELS = Object.freeze({
  SPD: ['party-spd', 'tempo'], basicRate: ['party-spd', 'tempo'], range: ['party-range', 'tempo'],
  ATK: ['party-atk', 'offense'], damageAmp: ['party-atk', 'offense'], MAG: ['party-mag', 'offense'],
  critRate: ['party-cr', 'offense'], critDamage: ['party-cd', 'offense'], specialDamage: ['party-special', 'offense'],
  DEF: ['party-def', 'defense'], RES: ['party-res', 'defense'], HP: ['party-hp', 'defense'],
  damageReduction: ['party-dr', 'defense'], ward: ['party-ward', 'defense'],
  reflect: ['party-reflect', 'defense'], heal: ['party-heal', 'defense'],
});
export const HERO_BUFF_GROUPS = Object.freeze(['tempo', 'offense', 'defense']);
const PARTY_ICON_ORDER = [...new Set(Object.values(BUFF_SIGNAL_CHANNELS).map(([icon]) => icon))];

const signalled = buff => (buff?.modifiers || [])
  .filter(modifier => modifier?.direction !== 'down' && BUFF_SIGNAL_CHANNELS[modifier?.channel])
  .map(modifier => BUFF_SIGNAL_CHANNELS[modifier.channel]);

// Keep earlier icons where they are, drop ended ones (the rest close up), append new ones.
function arrivalOrder(previous = [], active, canonical) {
  const kept = previous.filter(id => active.has(id));
  return [...kept, ...canonical.filter(id => active.has(id) && !kept.includes(id))];
}

// heroes: [{ uid, alive, buffs: [{ key, modifiers: [{ channel, direction }] }] }]
// key identifies one effect from one source; the same key on every living hero is party-wide.
export function projectBuffSignals(heroes = [], previous = {}) {
  const living = heroes.filter(hero => hero?.alive && hero.uid != null);
  const keysOf = hero => new Set((hero.buffs || []).filter(buff => signalled(buff).length).map(buff => String(buff.key)));
  const heroKeys = living.map(keysOf);
  const partyKeys = living.length < 2 ? new Set()
    : new Set([...heroKeys[0]].filter(key => heroKeys.every(keys => keys.has(key))));
  const partyIcons = new Set(), groupsByUID = {};
  for (const hero of living) {
    const groups = new Set();
    for (const buff of hero.buffs || []) {
      const party = partyKeys.has(String(buff.key));
      for (const [icon, group] of signalled(buff)) (party ? partyIcons.add(icon) : groups.add(group));
    }
    groupsByUID[String(hero.uid)] = groups;
  }
  return {
    party: arrivalOrder(previous.party, partyIcons, PARTY_ICON_ORDER),
    heroes: Object.fromEntries(Object.entries(groupsByUID)
      .map(([uid, groups]) => [uid, arrivalOrder(previous.heroes?.[uid], groups, HERO_BUFF_GROUPS)])),
  };
}
