export const HERO_SKILL_SPRITE_SHEET_PATH = 'images/Fantasy RPG skill icon showcase.png';

const SHEET_SIZE = 1024;
const CELL_SIZE = 256;
const CELL_INSET = 18;

function makeCrop(row, col) {
  return {
    x: (col * CELL_SIZE) + CELL_INSET,
    y: (row * CELL_SIZE) + CELL_INSET,
    w: CELL_SIZE - (CELL_INSET * 2),
    h: CELL_SIZE - (CELL_INSET * 2),
  };
}

function circleSkill(title, description, row, col, beadId = '') {
  return {
    title,
    description,
    badge: 'CS',
    iconShape: 'circle',
    beadId,
    spriteCrop: makeCrop(row, col),
  };
}

function diamondSkill(title, description, row, col, beadId = '') {
  return {
    title,
    description,
    badge: 'JS',
    iconShape: 'diamond',
    beadId,
    spriteCrop: makeCrop(row, col),
  };
}

export const HERO_SKILL_PRESENTATION = Object.freeze({
  Falie: Object.freeze([
    circleSkill('Block', 'Chance to receive damage for ally', 0, 0),
    circleSkill('Shield Bash', 'Chance to counterattack an attacker', 0, 2),
    diamondSkill('Bounce', 'Chance reflect damage to attacker', 0, 3),
  ]),
  Huun: Object.freeze([
    circleSkill('Steal', 'Chance to convert damage into Astral Flow', 1, 0),
    circleSkill('Lift', 'Chance to get more gold', 1, 1),
    diamondSkill('Assault', 'Chance to triple attack an enemy', 1, 3),
  ]),
  Runa: Object.freeze([
    circleSkill('Burn', 'Chance to drop totem doing magic damage over time', 2, 0),
    circleSkill('Inspire', 'Chance to raise party RES', 2, 1),
    diamondSkill('Destiny', 'Chance for gem match to heal', 2, 2),
  ]),
  Rune: Object.freeze([
    circleSkill('Burn', 'Chance to drop totem doing magic damage over time', 2, 0),
    circleSkill('Inspire', 'Chance to raise party RES', 2, 1),
    diamondSkill('Destiny', 'Chance for gem match to heal', 2, 2),
  ]),
  Kojonn: Object.freeze([
    circleSkill('Avoid', 'Chance to use gems at no cost', 3, 0),
    circleSkill('Enhance', 'Chance to increase ally MAG', 3, 1),
    diamondSkill('Gift', 'Chance to increase ally power 2x', 2, 3),
  ]),
});

export function getHeroSkillPresentationEntries(heroName) {
  const entries = HERO_SKILL_PRESENTATION[String(heroName || '')];
  if (!Array.isArray(entries)) return [];
  return entries.map((entry, idx) => ({
    slot: idx,
    key: `skill${idx + 1}`,
    title: String(entry.title || `Skill ${idx + 1}`),
    description: String(entry.description || ''),
    beadId: String(entry.beadId || ''),
    badge: String(entry.badge || (idx === 2 ? 'JS' : 'CS')),
    iconShape: String(entry.iconShape || (idx === 2 ? 'diamond' : 'circle')),
    actionable: true,
    spriteCrop: entry.spriteCrop
      ? {
          x: Math.max(0, Math.min(SHEET_SIZE, Number(entry.spriteCrop.x || 0))),
          y: Math.max(0, Math.min(SHEET_SIZE, Number(entry.spriteCrop.y || 0))),
          w: Math.max(1, Math.min(SHEET_SIZE, Number(entry.spriteCrop.w || CELL_SIZE))),
          h: Math.max(1, Math.min(SHEET_SIZE, Number(entry.spriteCrop.h || CELL_SIZE))),
        }
      : null,
  }));
}
