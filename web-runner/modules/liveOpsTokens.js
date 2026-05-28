import { TOKEN } from './monsterLootTableEventTokens.js';

export const TOKEN_REGISTRY = {
  [TOKEN.SAND]: {
    token_id: TOKEN.SAND,
    token_key: 'sand',
    event_scope: 'long',
    schedule_key: 'event_long_sand',
    fallback: 'EMPTY',
  },
  [TOKEN.BONE_CHIP]: {
    token_id: TOKEN.BONE_CHIP,
    token_key: 'bone_chip',
    event_scope: 'long',
    schedule_key: 'event_long_bone',
    fallback: 'EMPTY',
  },
  [TOKEN.SLIME]: {
    token_id: TOKEN.SLIME,
    token_key: 'slime',
    event_scope: 'long',
    schedule_key: 'event_long_slime',
    fallback: 'EMPTY',
  },
  [TOKEN.HORN]: {
    token_id: TOKEN.HORN,
    token_key: 'horn',
    event_scope: 'long',
    schedule_key: 'event_long_horn',
    fallback: 'EMPTY',
  },
  [TOKEN.SHELL]: {
    token_id: TOKEN.SHELL,
    token_key: 'shell',
    event_scope: 'long',
    schedule_key: 'event_long_shell',
    fallback: 'EMPTY',
  },
};

export const LIVE_OPS_EVENTS = [
  {
    id: 'event_long_sand',
    token_id: TOKEN.SAND,
    tiers: [
      {
        required: 20,
        milestones: [
          { spend: 5, rewards: [{ type: 'ENERGY_RANDOM' }] },
          { spend: 10, rewards: [{ type: 'GOLD_RANDOM' }] },
          { spend: 15, rewards: [{ type: 'HEAL_RANDOM' }] },
        ],
        rewards: [{ type: 'GOLD_RANDOM' }],
      },
      {
        required: 40,
        milestones: [
          { spend: 10, rewards: [{ type: 'ENERGY_RANDOM' }] },
          { spend: 20, rewards: [{ type: 'HEAL_RANDOM' }] },
          { spend: 30, rewards: [{ type: 'GOLD_RANDOM' }] },
        ],
        rewards: [{ type: 'ENERGY_RANDOM' }],
      },
      {
        required: 80,
        milestones: [
          { spend: 20, rewards: [{ type: 'HEAL_RANDOM' }] },
          { spend: 40, rewards: [{ type: 'GOLD_RANDOM' }] },
          { spend: 60, rewards: [{ type: 'ENERGY_RANDOM' }] },
        ],
        rewards: [{ type: 'HEAL_RANDOM' }],
      },
      {
        required: 140,
        milestones: [
          { spend: 35, rewards: [{ type: 'GOLD_RANDOM' }] },
          { spend: 70, rewards: [{ type: 'ENERGY_RANDOM' }] },
          { spend: 105, rewards: [{ type: 'HEAL_RANDOM' }] },
        ],
        rewards: [{ type: 'GOLD_RANDOM' }, { type: 'ENERGY_RANDOM' }],
      },
    ],
  },
  {
    id: 'event_long_bone',
    token_id: TOKEN.BONE_CHIP,
    tiers: [
      { required: 20, milestones: [{ spend: 10, rewards: [{ type: 'GOLD_RANDOM' }] }], rewards: [{ type: 'HEAL_RANDOM' }] },
      { required: 40, milestones: [{ spend: 20, rewards: [{ type: 'ENERGY_RANDOM' }] }], rewards: [{ type: 'GOLD_RANDOM' }] },
      { required: 80, milestones: [{ spend: 40, rewards: [{ type: 'HEAL_RANDOM' }] }], rewards: [{ type: 'ENERGY_RANDOM' }] },
    ],
  },
  {
    id: 'event_long_slime',
    token_id: TOKEN.SLIME,
    tiers: [
      { required: 20, milestones: [{ spend: 10, rewards: [{ type: 'ENERGY_RANDOM' }] }], rewards: [{ type: 'GOLD_RANDOM' }] },
      { required: 50, milestones: [{ spend: 25, rewards: [{ type: 'HEAL_RANDOM' }] }], rewards: [{ type: 'ENERGY_RANDOM' }] },
      { required: 90, milestones: [{ spend: 45, rewards: [{ type: 'GOLD_RANDOM' }] }], rewards: [{ type: 'HEAL_RANDOM' }] },
    ],
  },
  {
    id: 'event_long_horn',
    token_id: TOKEN.HORN,
    tiers: [
      { required: 25, milestones: [{ spend: 10, rewards: [{ type: 'HEAL_RANDOM' }] }], rewards: [{ type: 'GOLD_RANDOM' }] },
      { required: 55, milestones: [{ spend: 20, rewards: [{ type: 'ENERGY_RANDOM' }] }], rewards: [{ type: 'HEAL_RANDOM' }] },
      { required: 100, milestones: [{ spend: 50, rewards: [{ type: 'GOLD_RANDOM' }] }], rewards: [{ type: 'ENERGY_RANDOM' }] },
    ],
  },
  {
    id: 'event_long_shell',
    token_id: TOKEN.SHELL,
    tiers: [
      { required: 30, milestones: [{ spend: 15, rewards: [{ type: 'GOLD_RANDOM' }] }], rewards: [{ type: 'ENERGY_RANDOM' }] },
      { required: 60, milestones: [{ spend: 30, rewards: [{ type: 'HEAL_RANDOM' }] }], rewards: [{ type: 'GOLD_RANDOM' }] },
      { required: 110, milestones: [{ spend: 55, rewards: [{ type: 'ENERGY_RANDOM' }] }], rewards: [{ type: 'HEAL_RANDOM' }] },
    ],
  },
];

export const ACTIVE_EVENT_IDS = [
  'event_long_sand',
  'event_long_bone',
  'event_long_slime',
  'event_long_horn',
  'event_long_shell',
];
