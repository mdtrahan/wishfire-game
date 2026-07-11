export const CANONICAL_HERO_ROSTER = [
  { name: 'Falie', hp: 42, maxHP: 42, ATK: 18, DEF: 20, MAG: 10, RES: 18, SPD: 9, attackType: 'melee' },
  { name: 'Huun', hp: 35, maxHP: 35, ATK: 22, DEF: 10, MAG: 8, RES: 12, SPD: 20, attackType: 'melee' },
  { name: 'Runa', hp: 30, maxHP: 30, ATK: 8, DEF: 8, MAG: 28, RES: 20, SPD: 11, attackType: 'magic' },
  { name: 'Kojonn', hp: 40, maxHP: 40, ATK: 12, DEF: 14, MAG: 22, RES: 18, SPD: 14, attackType: 'magic' },
];
export const HERO_CLASS_LABELS = Object.freeze({
  falie: 'Guardian',
  huun: 'Vanguard',
  runa: 'Mystic',
  kojonn: 'Arcanist',
});
// Deterministic gate metric used for progression/access comparisons.
export function computeCombatPower(atk, def, hp) {
  const a = Number(atk || 0);
  const d = Number(def || 0);
  const h = Number(hp || 0);
  return Math.round((a + d + (h / 10)) * 100) / 100;
}
export const HERO_STAT_KEYS = ['ATK', 'DEF', 'MAG', 'RES', 'SPD', 'HP'];
export const HERO_PACK_PLUS_PATH = 'images/plus.png';
export const HERO_PACK_MINUS_PATH = 'images/minus.png';
export const HERO_PACK_CLOSE_OVAL_PATH = 'images/ui_navclosebutton-animation 1-000.png';
export const heroLayoutSpec = {
  artboard: { w: 360, h: 640 },
  portrait: { x: 109, y: 32, w: 142, h: 92 },
  arrows: {
    left: { x: 22, y: 78, w: 24, h: 38, glyphX: 34, glyphY: 97 },
    right: { x: 322, y: 78, w: 24, h: 38, glyphX: 334, glyphY: 97 },
  },
  namePill: { x: 85, y: 134, w: 190, h: 24 },
  stats: {
    labelsTop: 168,
    valuesTop: 190,
    labelH: 14,
    valueH: 44,
    cells: [
      { x: 16, w: 50 },
      { x: 72, w: 50 },
      { x: 128, w: 50 },
      { x: 184, w: 50 },
      { x: 240, w: 50 },
      { x: 296, w: 50 },
    ],
  },
  skillPoints: {
    row: { x: 160, y: 251, w: 190, h: 24 },
    chip: { x: 286, y: 252, w: 58, h: 20 },
  },
  heroHeader: {
    namePill: { x: 18, y: 38, w: 190, h: 24 },
    classLabel: { x: 24, y: 70, w: 128, h: 16 },
  },
  heroPortrait: { x: 69, y: 107, w: 224, h: 146 },
  heroArrows: {
    left: { x: 14, y: 152, w: 24, h: 38, glyphX: 26, glyphY: 171 },
    right: { x: 320, y: 152, w: 24, h: 38, glyphX: 332, glyphY: 171 },
  },
  heroCP: { x: 136, y: 272, w: 88, h: 18 },
  heroStats: {
    bar: { x: 6, y: 306, w: 350, h: 27 },
    items: [
      { iconX: 27, valueX: 54, key: 'HP' },
      { iconX: 94, valueX: 122, key: 'ATK' },
      { iconX: 165, valueX: 190, key: 'DEF' },
      { iconX: 233, valueX: 258, key: 'MAG' },
      { iconX: 301, valueX: 330, key: 'RES' },
    ],
  },
  heroNodes: {
    items: [
      {
        x: 101,
        y: 352,
        kind: 'circle',
        size: 44,
        frameFill: '#D9D9D9',
        frameStroke: '#FFFFFF',
        frameStrokeWidth: 1,
        levelBacker: { x: 132, y: 379, w: 18, h: 18, label: 'N' },
      },
      {
        x: 159,
        y: 352,
        kind: 'circle',
        size: 44,
        frameFill: '#D9D9D9',
        frameStroke: null,
        frameStrokeWidth: 0,
        levelBacker: { x: 190, y: 379, w: 18, h: 18, label: 'N' },
      },
      {
        x: 222.5,
        y: 355.615,
        kind: 'diamond',
        size: 36.77,
        frameFill: '#D9D9D9',
        frameStroke: null,
        frameStrokeWidth: 0,
        frameRadius: 8,
        levelBacker: { x: 251, y: 379, w: 18, h: 18, label: 'N' },
      },
    ],
  },
  heroSkillPoints: {
    row: { x: 86, y: 415, w: 190, h: 24 },
    chip: { x: 216, y: 415, w: 88, h: 24 },
  },
  heroSkillModal: {
    card: { x: 32, y: 92, w: 296, h: 438 },
    headerPill: { x: 56, y: 112, w: 168, h: 24 },
    classLabel: { x: 56, y: 142, w: 128, h: 16 },
    frame: { x: 56, y: 170, w: 44, h: 44 },
    rankRow: { x: 120, y: 176, w: 154, h: 24 },
    summaryRow: { x: 56, y: 228, w: 240, h: 56 },
    upgradeList: { x: 56, y: 300, w: 240, h: 118 },
    upgradeButton: { x: 104, y: 430, w: 152, h: 56 },
    close: { cx: 180, cy: 507, r: 15 },
  },
  heroUpgrade: { x: 118, y: 494, w: 124, h: 42 },
  cards: [
    {
      card: { x: 12, y: 287, w: 336, h: 79.53 },
      titleStrip: { x: 60, y: 295, w: 182, h: 13 },
      iconTile: { x: 18.96, y: 308.87, w: 37.775, h: 37.775 },
      bodyText: { x: 65.68, titleY: 306.5, line1Y: 324.5, line2Y: 336.5, line3Y: 348.5 },
      controls: {
        minus: { x: 249.59, y: 316.73, w: 22.773, h: 23.954 },
        value: { x: 277, y: 316, w: 35.787, h: 20.876 },
        plus: { x: 317.18, y: 312.85, w: 22.039, h: 23.676 },
      },
    },
    {
      card: { x: 12, y: 380.44, w: 336, h: 79.53 },
      titleStrip: { x: 60, y: 389, w: 182, h: 13 },
      iconTile: { x: 18.96, y: 402.31, w: 37.775, h: 37.775 },
      bodyText: { x: 65.68, titleY: 400.5, line1Y: 418.5, line2Y: 430.5, line3Y: 442.5 },
      controls: {
        minus: { x: 249.59, y: 410.17, w: 22.773, h: 23.954 },
        value: { x: 277, y: 409, w: 35.787, h: 20.876 },
        plus: { x: 317.18, y: 406.29, w: 22.039, h: 23.676 },
      },
    },
    {
      card: { x: 12, y: 473.89, w: 336, h: 79.53 },
      titleStrip: { x: 60, y: 482, w: 182, h: 13 },
      iconTile: { x: 18.96, y: 495.76, w: 37.775, h: 37.775 },
      bodyText: { x: 65.68, titleY: 493.5, line1Y: 511.5, line2Y: 523.5, line3Y: 535.5 },
      controls: {
        minus: { x: 249.59, y: 503.61, w: 22.773, h: 23.954 },
        value: { x: 277, y: 503, w: 35.787, h: 20.876 },
        plus: { x: 317.18, y: 499.73, w: 22.039, h: 23.676 },
      },
    },
  ],
  close: { cx: 180, cy: 608, r: 15 },
};
