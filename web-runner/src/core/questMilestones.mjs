import { heroDefinition } from './heroDefinitions.mjs';
import { RARITIES } from './equipment.mjs';

export const MILESTONE_REWARDS = Object.freeze(Object.fromEntries([
  'equip_slot', 'equip_all', 'equip_level', 'equip_rarity', 'chapter_clear', 'boss_defeat',
  'chapter_survive', 'hero_level', 'party_level', 'training_level',
].map(type => [type, Object.freeze({ resource: 'incense', amount: 5 })])));
export const questFamily = type => type.startsWith('equip_') || type === 'gear_collect' ? 'equipment'
  : ['chapter_clear', 'boss_defeat', 'chapter_survive', 'wave_clear', 'enemy_defeat'].includes(type) ? 'battle'
  : ['training_upgrade', 'training_level'].includes(type) ? 'training' : 'heroes';
const slots = ['hat', 'body', 'boots'];
const rarityColors = { common:'White', uncommon:'Green', rare:'Blue', epic:'Purple', legendary:'Gold' };
const slotNames = { hat: 'a Hat', body: 'Body Armor', boots: 'Boots' };
const rarities = Object.keys(RARITIES);
const positive = value => Math.max(0, Math.floor(Number(value) || 0));
const key = row => `${row.type}:${row.slot || row.rarity || row.stat || row.heroId || ''}:${row.threshold || row.chapter || ''}`;

function equipped(heroes, equipment) {
  const items = new Map((equipment?.items || []).map(item => [item.instanceId, item]));
  return heroes.map(hero => {
    const id = hero.heroInstanceKey;
    const canonical = hero.baseHeroName;
    const primary = id === canonical || id === `${canonical?.toLowerCase()}#1`;
    const loadout = equipment?.loadouts?.[id] ?? (primary ? equipment?.loadouts?.[canonical] : undefined) ?? {};
    return Object.fromEntries(slots.map(slot => [slot, items.get(loadout[slot])]));
  });
}

export function reconcileQuestMilestones(state, heroes, context = {}) {
  const objective = state.objective;
  if (!objective || !MILESTONE_REWARDS[objective.type]) return state;
  if (objective.type.startsWith('equip_') && !context.equipment) return state;
  const party = equipped(heroes, context.equipment);
  let progress = 0;
  switch (objective.type) {
    case 'equip_slot': progress = party.filter(gear => gear[objective.slot]).length; break;
    case 'equip_all': progress = party.filter(gear => slots.every(slot => gear[slot])).length; break;
    case 'equip_level': progress = party.filter(gear => slots.every(slot => positive(gear[slot]?.level) >= objective.threshold)).length; break;
    case 'equip_rarity': progress = party.filter(gear => slots.every(slot => gear[slot] && rarities.indexOf(gear[slot].rarity) >= rarities.indexOf(objective.rarity))).length; break;
    case 'hero_level': progress = heroes.some(hero => hero.heroInstanceKey === objective.heroId && positive(hero.currentLevel) >= objective.threshold) ? 1 : 0; break;
    case 'party_level': progress = heroes.filter(hero => positive(hero.currentLevel) >= objective.threshold).length; break;
    case 'training_level': progress = positive(state.training[objective.stat]) >= objective.threshold ? 1 : 0; break;
    case 'chapter_clear': case 'boss_defeat': progress = positive(state.chaptersCleared) >= objective.chapter ? 1 : 0; break;
    case 'chapter_survive': progress = (state.survivalChapters || []).includes(objective.chapter) ? 1 : 0; break;
  }
  // Equipment/levels describe the current saved party, and are rechecked at claim time.
  objective.progress = Math.min(objective.target, progress);
  return state;
}

export function milestoneCandidates(state, heroes, context = {}) {
  const rows = [];
  const add = row => { row.key = key(row); if (!state.claimedMilestones.includes(row.key)) rows.push(row); };
  if (heroes.length && context.equipment) {
    for (const slot of slots) add({ type: 'equip_slot', slot, target: heroes.length });
    add({ type: 'equip_all', target: heroes.length });
    const party = equipped(heroes, context.equipment);
    const minLevel = Math.min(...party.flatMap(gear => slots.map(slot => positive(gear[slot]?.level))));
    const nextLevel = Math.max(5, (Math.floor(minLevel / 5) + 1) * 5);
    const availableLevel = Math.max(1, positive(context.equipment.lamp?.highestOrdinal) + 1, ...context.equipment.items.map(item => positive(item.level)));
    for (let threshold = 5; threshold <= Math.min(nextLevel, availableLevel); threshold += 5) add({ type: 'equip_level', threshold, target: heroes.length });
    const availableRarity = Math.max(0, ...context.equipment.items.map(item => rarities.indexOf(item.rarity)));
    for (let index = 1; index <= availableRarity; index++) add({ type: 'equip_rarity', rarity: rarities[index], target: heroes.length });
  }
  const chapter = Math.max(1, positive(context.chapter));
  for (const type of ['chapter_clear', 'boss_defeat']) {
    const claimed = state.claimedMilestones.filter(k => k.startsWith(`${type}:`)).map(k => positive(k.split(':').at(-1)));
    const targetChapter = Math.min(chapter, Math.max(0, ...claimed) + 1);
    add({ type, chapter: targetChapter, target: 1 });
  }
  if (context.chapter) {
    // Only offer survival for an attainable next boss, or a witnessed clean clear.
    const clean = state.survivalChapters.find(n => !state.claimedMilestones.includes(`chapter_survive::${n}`));
    add({ type: 'chapter_survive', chapter: clean || (state.chapterObservation?.failed ? chapter + 1 : chapter), target: 1 });
  }
  for (const stat of ['ATK', 'DEF', 'MATK', 'RES']) {
    const level = positive(state.training[stat]);
    const threshold = state.wallet.incense >= 20 + level * 10 && level < 100 ? level + 1 : level;
    if (threshold > 0) add({ type: 'training_level', stat, threshold, target: 1 });
  }
  for (const hero of heroes) {
    const level = positive(hero.currentLevel);
    const nextLevel = level < 5 ? level + 1 : Math.min(hero.maxLevel || 100, (Math.floor(level / 5) + 1) * 5);
    let cost = 0; for (let n = level; n < nextLevel; n++) cost += 100 + (n - 1) * 50;
    const threshold = (state.wallet.ticketsByHero[hero.heroInstanceKey] || 0) >= cost ? nextLevel : Math.max(2, level);
    if (level >= 2 || (state.wallet.ticketsByHero[hero.heroInstanceKey] || 0) >= cost) add({ type: 'hero_level', heroId: hero.heroInstanceKey, heroName: heroDefinition(hero)?.name || hero.baseHeroName || hero.name, threshold, target: 1 });
  }
  if (heroes.length && heroes.every(hero => positive(hero.currentLevel) >= 2)) add({ type: 'party_level', threshold: Math.min(...heroes.map(hero => positive(hero.currentLevel))), target: heroes.length });
  return rows;
}

export function milestonePresentation(objective) {
  const { type, threshold, chapter, rarity, stat, heroName } = objective;
  const labels = {
    equip_slot: `Equip ${slotNames[objective.slot]} to all heroes`, equip_all: 'Fully equip all heroes',
    equip_level: `Equip Lv. ${threshold}+ in all heroes’ slots`,
    equip_rarity: `Equip ${rarityColors[rarity] || rarity}+ in all heroes’ slots`,
    chapter_clear: `Clear Chapter ${chapter}`, boss_defeat: `Defeat Chapter ${chapter} boss`,
    chapter_survive: `Clear Chapter ${chapter} with zero hero KOs`,
    hero_level: `Reach Level ${threshold} with ${heroName}`, party_level: `Reach Level ${threshold} with all heroes`,
    training_level: `Train ${stat} to Level ${threshold}`,
  };
  return labels[type] ? { category: questFamily(type) === 'equipment' ? 'Equipment' : 'Milestone', challenge: labels[type], ...(type === 'equip_rarity' ? { color: RARITIES[rarity]?.color } : {}) } : null;
}

export function observeChapterMilestones(state, heroes, stage) {
  if (!stage || !Number.isSafeInteger(stage.region) || stage.region < 1) return state;
  const prior = state.chapterObservation;
  const chapter = stage.region;
  state.chaptersCleared = Math.max(state.chaptersCleared, chapter - 1);
  const ko = heroes.some(hero => Number(hero.hp) <= 0);
  if (prior?.bossActive && chapter > prior.chapter && !prior.failed && !ko && !state.survivalChapters.includes(prior.chapter)) state.survivalChapters.push(prior.chapter);
  const sameChapter = prior?.chapter === chapter;
  state.chapterObservation = {
    chapter, bossActive: stage.bossActive === true,
    failed: sameChapter ? prior.failed || ko : ko || stage.bossSummonRequired === true || Number(stage.wave || 1) > 1 || stage.bossActive === true,
  };
  return state;
}

export function validMilestoneObjective(row) {
  if (!MILESTONE_REWARDS[row.type]) return true;
  if (row.type === 'equip_slot') return slots.includes(row.slot);
  if (row.type === 'equip_rarity') return rarities.includes(row.rarity);
  if (row.type === 'equip_level') return Number.isSafeInteger(row.threshold) && row.threshold >= 5 && row.threshold <= 990 && row.threshold % 5 === 0;
  if (['hero_level','party_level','training_level'].includes(row.type)) return Number.isSafeInteger(row.threshold) && row.threshold > 0 && row.threshold <= 100 && (row.type !== 'hero_level' || !!row.heroId) && (row.type !== 'training_level' || ['ATK','DEF','MATK','RES'].includes(row.stat));
  if (['chapter_clear','boss_defeat','chapter_survive'].includes(row.type)) return Number.isSafeInteger(row.chapter) && row.chapter > 0;
  return true;
}
