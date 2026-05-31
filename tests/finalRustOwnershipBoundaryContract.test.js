const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.join(__dirname, '..');
const rustLibPath = path.join(repoRoot, 'rust', 'simulation_core', 'src', 'lib.rs');
const shadowPath = path.join(repoRoot, 'web-runner', 'systems', 'simulationCoreShadow.js');
const packetPath = path.join(repoRoot, 'src', 'core', 'simulationCorePacket.cjs');
const contractPath = path.join(repoRoot, 'governance', 'planning', 'simulation-core-rust-js-contract.md');
const gatewayPath = path.join(repoRoot, 'src', 'core', 'combatRuntimeGateway.cjs');
const heroGemStoragePath = path.join(repoRoot, 'web-runner', 'systems', 'heroGemProgressStorage.js');

const requiredOwnerMarkers = [
  ['combat snapshot/save-load gate', '__ORKA_COMBAT_SNAPSHOT_OWNER__'],
  ['seeded RNG', '__ORKA_SEEDED_RNG_OWNER__'],
  ['win/loss checks', '__ORKA_COMBAT_OUTCOME_OWNER__'],
  ['single-hit combat', '__ORKA_SINGLE_HIT_OWNER__'],
  ['calculate damage', '__ORKA_CALCULATE_DAMAGE_OWNER__'],
  ['effective stat', '__ORKA_EFFECTIVE_STAT_OWNER__'],
  ['party damage', '__ORKA_PARTY_DAMAGE_OWNER__'],
  ['Runa magic resist', '__ORKA_RUNA_MAGIC_RESIST_OWNER__'],
  ['turn summary', '__ORKA_TURN_SUMMARY_OWNER__'],
  ['turn actor eligibility', '__ORKA_TURN_ACTOR_ELIGIBILITY_OWNER__'],
  ['turn phase assignment', '__ORKA_TURN_PHASE_ASSIGNMENT_OWNER__'],
  ['turn order grouping', '__ORKA_TURN_ORDER_GROUP_OWNER__'],
  ['round pointer advance', '__ORKA_ROUND_POINTER_ADVANCE_OWNER__'],
  ['hero turn entry', '__ORKA_HERO_TURN_ENTRY_OWNER__'],
  ['enemy turn flow', '__ORKA_ENEMY_TURN_FLOW_OWNER__'],
  ['enemy target choice', '__ORKA_ENEMY_TARGET_OWNER__'],
  ['enemy skill choice', '__ORKA_ENEMY_SKILL_CHOICE_OWNER__'],
  ['enemy job skill', '__ORKA_ENEMY_JOB_SKILL_OWNER__'],
  ['start enemy action', '__ORKA_START_ENEMY_ACTION_OWNER__'],
  ['gem action', '__ORKA_GEM_ACTION_OWNER__'],
  ['enemy DoT packet', '__ORKA_ENEMY_DOT_PACKET_OWNER__'],
  ['enemy DoT tick', '__ORKA_ENEMY_DOT_TICK_OWNER__'],
  ['enemy DoT lifecycle', '__ORKA_ENEMY_DOT_LIFECYCLE_OWNER__'],
  ['enemy debuff apply', '__ORKA_ENEMY_DEBUFF_APPLY_OWNER__'],
  ['enemy debuff decay', '__ORKA_ENEMY_DEBUFF_DECAY_OWNER__'],
  ['enemy debuff slot', '__ORKA_ENEMY_DEBUFF_SLOT_OWNER__'],
  ['party regen lifecycle', '__ORKA_PARTY_REGEN_LIFECYCLE_OWNER__'],
  ['party regen tick', '__ORKA_PARTY_REGEN_TICK_OWNER__'],
];

const requiredRustExports = [
  'game_state_envelope_valid_shadow',
  'game_state_envelope_actor_count_shadow',
  'combat_snapshot_index_failure_code_shadow',
  'combat_snapshot_schema_valid_shadow',
  'combat_snapshot_resume_token_valid_shadow',
  'seeded_rng_next_state_shadow',
  'seeded_rng_next_value_shadow',
  'seeded_rng_index_shadow',
  'combat_outcome_code_shadow',
  'single_hit_damage_shadow',
  'single_hit_applied_damage_shadow',
  'single_hit_after_hp_shadow',
  'effective_stat_value_shadow',
  'party_damage_party_hp_after_shadow',
  'runa_magic_resist_final_damage_shadow',
  'turn_summary_code_shadow',
  'turn_actor_eligibility_code_shadow',
  'turn_phase_from_type_shadow',
  'turn_order_phase_type_shadow',
  'turn_order_compare_slots_shadow',
  'round_pointer_advance_code_shadow',
  'hero_turn_entry_turn_phase_shadow',
  'enemy_turn_flow_action_code_shadow',
  'enemy_target_selected_uid_shadow',
  'enemy_skill_choice_selected_code_shadow',
  'enemy_job_skill_action_code_shadow',
  'start_enemy_action_active_shadow',
  'gem_action_route_code_shadow',
  'enemy_dot_packet_remaining_fires_shadow',
  'enemy_dot_tick_damage_shadow',
  'enemy_dot_lifecycle_action_shadow',
  'enemy_debuff_apply_amount_after_shadow',
  'enemy_debuff_turns_after_tick_shadow',
  'enemy_debuff_slot_transition_action_shadow',
  'party_regen_lifecycle_action_shadow',
  'party_regen_tick_heal_shadow',
];

test('final Rust ownership boundary exposes every deterministic owner marker', () => {
  const shadowSrc = fs.readFileSync(shadowPath, 'utf8');
  for (const [label, marker] of requiredOwnerMarkers) {
    assert.match(shadowSrc, new RegExp(`window\\.${marker}\\s*=`), `${label} owner marker`);
  }
  assert.match(shadowSrc, /window\.__ORKA_SIMULATION_CORE_SHADOW__/);
  assert.match(shadowSrc, /dataset\.simCoreShadowMismatches/);
  assert.match(shadowSrc, /console\.warn\('\[SIM_CORE_SHADOW_MISMATCH\]'/);
});

test('Rust simulation core exports the full deterministic boundary used by JS', () => {
  const rustSrc = fs.readFileSync(rustLibPath, 'utf8');
  for (const exportName of requiredRustExports) {
    assert.match(
      rustSrc,
      new RegExp(`extern "C" fn ${exportName}\\b`),
      `${exportName} export`,
    );
  }
});

test('SimulationCore packets normalize GameState and exclude browser-owned state', () => {
  const packetSrc = fs.readFileSync(packetPath, 'utf8');
  assert.match(packetSrc, /normalizeGameStateEnvelope/);
  assert.match(packetSrc, /gameState: normalizeGameStateEnvelope\(gameState\)/);
  assert.match(packetSrc, /nextGameState: normalizeGameStateEnvelope\(nextGameState\)/);
  assert.match(packetSrc, /context: normalizeSimulationContext\(context\)/);
  assert.doesNotMatch(packetSrc, /\bdocument\b|\bwindow\b|\blocalStorage\b|getContext\(/);
});

test('browser save/load wrappers stay outside Rust-owned deterministic simulation', () => {
  const gatewaySrc = fs.readFileSync(gatewayPath, 'utf8');
  const storageSrc = fs.readFileSync(heroGemStoragePath, 'utf8');
  assert.match(gatewaySrc, /createSimulationCoreRequest/);
  assert.match(gatewaySrc, /applySimulationCoreResponse/);
  assert.match(gatewaySrc, /resume\(snapshot\)/);
  assert.doesNotMatch(gatewaySrc, /localStorage/);
  assert.match(storageSrc, /window\.localStorage\.getItem/);
  assert.match(storageSrc, /window\.localStorage\.setItem/);
  assert.doesNotMatch(storageSrc, /createSimulationCoreRequest|createSimulationCoreResponse/);
});

test('contract doc names the intended Rust and JS ownership split', () => {
  const contract = fs.readFileSync(contractPath, 'utf8');
  for (const phrase of [
    'Rust owns deterministic simulation',
    '`GameState`',
    'turn resolution',
    'combat formulas',
    'status effect application, ticking, and expiry',
    'RNG seed/state logic',
    'win/loss checks',
    'JavaScript owns browser integration',
    'save/load wrapper',
    'Netlify deployment',
  ]) {
    assert.match(contract, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
