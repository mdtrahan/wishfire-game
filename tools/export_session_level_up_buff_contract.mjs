import fs from 'node:fs';
import { UNIVERSAL_SESSION_POWER_BUFF_CARDS } from '../src/core/sessionLevelBuffCatalog.mjs';

const heroes = [
  { id: 'fara', native_features: ['emitter:fara_native', 'stat:fara_profile'], attack_tags: ['hero_native', 'all_attacks', 'basic_attack', 'direct_damage', 'direct_damage_received'] },
  { id: 'hondo', native_features: ['emitter:hondo_native', 'stat:hondo_profile'], attack_tags: ['hero_native', 'all_attacks', 'basic_attack', 'direct_damage', 'direct_damage_received'] },
  { id: 'runa', native_features: ['emitter:runa_native', 'stat:runa_profile'], attack_tags: ['hero_native', 'all_attacks', 'basic_attack', 'direct_damage', 'direct_damage_received'] },
  { id: 'kaja', native_features: ['emitter:kaja_native', 'stat:kaja_profile'], attack_tags: ['hero_native', 'all_attacks', 'basic_attack', 'direct_damage', 'direct_damage_received'] },
];

const contractCard = card => ({
  id: card.cardId,
  name: card.name,
  lane: card.lane,
  rarity: card.rarity.toLowerCase(),
  lifetime: card.lifetime,
  acquisition_source: card.acquisitionSource,
  ownership: { kind: card.ownership.kind, owner_id: card.ownership.ownerId },
  source_tags: [...card.sourceTags],
  trigger: {
    event: card.trigger.event,
    source_tags: [...card.trigger.sourceTags],
    allow_generated: card.trigger.allowGenerated,
    exclude_self_generated: card.trigger.excludeSelfGenerated,
  },
  compatible_attack_tags: [...card.compatibleAttackTags],
  incompatible_features: [...card.incompatibleFeatures],
  grants_features: [...card.grantsFeatures],
  modifies_axes: [...card.modifiesAxes],
  effects: {
    native_output_multiplier: card.effects.nativeOutputMultiplier,
    coverage_multiplier: card.effects.coverageMultiplier,
    spawns_entities: card.effects.spawnsEntities,
  },
  ranks: card.ranks.map(rank => ({ rank: rank.rank, effects: { ...rank.effects } })),
  branches: card.branches.map(branch => ({ ...branch })),
  max_rank: card.maxRank,
  end_state: { kind: card.endState.kind, remove_from_offers: card.endState.removeFromOffers },
  limits: {
    stack_cap: card.limits.stackCap,
    uptime_cap: card.limits.uptimeCap,
    proc_depth_cap: card.limits.procDepthCap,
    entity_cap: card.limits.entityCap,
    overflow: card.limits.overflow,
  },
  counterpressure: [...card.counterpressure],
  conflicts: [...card.conflicts],
  offer: { compatible_builds_only: card.offer.compatibleBuildsOnly },
  tests: [...card.tests],
});

const contract = {
  schema_version: 1,
  defaults: { max_proc_depth: 2, pick_rate_alarm: [0.2, 0.6] },
  heroes,
  cards: UNIVERSAL_SESSION_POWER_BUFF_CARDS.map(contractCard),
};

const output = `${JSON.stringify(contract, null, 2)}\n`;
const destination = process.argv[2];
if (destination) fs.writeFileSync(destination, output, 'utf8');
else process.stdout.write(output);
