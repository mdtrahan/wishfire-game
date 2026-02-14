export const EMPTY = 'EMPTY';

export const ITEM = {
  GOLD: 'GOLD',
  ENERGY: 'ENERGY',
  HEAL: 'HEAL',
};

export const TOKEN = {
  SAND: 'SAND',
  BONE_CHIP: 'BONE_CHIP',
  SLIME: 'SLIME',
  HORN: 'HORN',
  SHELL: 'SHELL',
};

export const MONSTER_KEYS = [
  'Gobloc',
  'High Gobloc',
  'Lizardo',
  'Orc',
  'High Orc',
  'Chimerilass',
  'Troll',
  'Skeleton',
  'Djinn',
  'Marid',
];

export const MONSTER_LOOT_TABLE = [
  // 0: Gobloc
  ['TOKEN.SAND', 'TOKEN.BONE_CHIP', 'TOKEN.SLIME', 'TOKEN.SAND'],
  // 1: High Gobloc
  ['TOKEN.SAND', 'TOKEN.HORN', 'TOKEN.BONE_CHIP', 'TOKEN.SAND'],
  // 2: Lizardo
  ['TOKEN.SHELL', 'TOKEN.SLIME', 'TOKEN.SAND', 'TOKEN.SLIME'],
  // 3: Orc
  ['TOKEN.HORN', 'TOKEN.BONE_CHIP', 'TOKEN.SAND', 'TOKEN.BONE_CHIP'],
  // 4: High Orc
  ['TOKEN.HORN', 'TOKEN.SHELL', 'TOKEN.BONE_CHIP', 'TOKEN.HORN'],
  // 5: Chimerilass
  ['TOKEN.SHELL', 'TOKEN.HORN', 'TOKEN.SLIME', 'TOKEN.SHELL'],
  // 6: Troll
  ['TOKEN.BONE_CHIP', 'TOKEN.HORN', 'TOKEN.SAND', 'TOKEN.BONE_CHIP'],
  // 7: Skeleton
  ['TOKEN.BONE_CHIP', 'TOKEN.SHELL', 'TOKEN.SAND', 'TOKEN.BONE_CHIP'],
  // 8: Djinn
  ['TOKEN.SLIME', 'TOKEN.SHELL', 'TOKEN.HORN', 'TOKEN.SLIME'],
  // 9: Marid
  ['TOKEN.SHELL', 'TOKEN.SLIME', 'TOKEN.SAND', 'TOKEN.SHELL'],
];
