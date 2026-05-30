const DEFAULT_WASM_URL = './assets/simulation_core.wasm';
const SHADOW_STATE_KEY = '__ORKA_SIMULATION_CORE_SHADOW__';

function getShadowState() {
  if (typeof window === 'undefined') {
    return {
      status: 'unavailable',
      mismatches: [],
      singleHitChecks: 0,
      singleHitOwnerChecks: 0,
      calculateDamageOwnerChecks: 0,
      combatSnapshotOwnerChecks: 0,
      partyDamageOwnerChecks: 0,
      partyRegenTickOwnerChecks: 0,
      partyRegenLifecycleOwnerChecks: 0,
      turnSummaryChecks: 0,
      turnSummaryOwnerChecks: 0,
      enemyDotPacketOwnerChecks: 0,
      enemyDotTickChecks: 0,
      enemyDotTickOwnerChecks: 0,
      enemyDotLifecycleOwnerChecks: 0,
      enemyDebuffDecayOwnerChecks: 0,
      enemyDebuffApplyOwnerChecks: 0,
      enemyDebuffSlotOwnerChecks: 0,
      effectiveStatOwnerChecks: 0,
      combatOutcomeOwnerChecks: 0,
      turnActorEligibilityOwnerChecks: 0,
      turnPhaseAssignmentOwnerChecks: 0,
      enemySkillChoiceOwnerChecks: 0,
      enemyJobSkillOwnerChecks: 0,
      startEnemyActionOwnerChecks: 0,
      enemyTurnFlowOwnerChecks: 0,
      heroTurnEntryOwnerChecks: 0,
      enemyTargetOwnerChecks: 0,
      runaMagicResistOwnerChecks: 0,
      turnOrderGroupOwnerChecks: 0,
      roundPointerAdvanceOwnerChecks: 0,
      gemActionOwnerChecks: 0,
      seededRngChecks: 0,
      seededRngOwnerChecks: 0,
      singleHitOwnerSmokeRan: false,
      calculateDamageOwnerSmokeRan: false,
      combatSnapshotOwnerSmokeRan: false,
      partyDamageOwnerSmokeRan: false,
      partyRegenTickOwnerSmokeRan: false,
      partyRegenLifecycleOwnerSmokeRan: false,
      turnSummaryOwnerSmokeRan: false,
      enemyDotPacketOwnerSmokeRan: false,
      enemyDotTickOwnerSmokeRan: false,
      enemyDotLifecycleOwnerSmokeRan: false,
      enemyDebuffDecayOwnerSmokeRan: false,
      enemyDebuffApplyOwnerSmokeRan: false,
      enemyDebuffSlotOwnerSmokeRan: false,
      effectiveStatOwnerSmokeRan: false,
      combatOutcomeOwnerSmokeRan: false,
      turnActorEligibilityOwnerSmokeRan: false,
      turnPhaseAssignmentOwnerSmokeRan: false,
      enemySkillChoiceOwnerSmokeRan: false,
      enemyJobSkillOwnerSmokeRan: false,
      startEnemyActionOwnerSmokeRan: false,
      enemyTurnFlowOwnerSmokeRan: false,
      heroTurnEntryOwnerSmokeRan: false,
      enemyTargetOwnerSmokeRan: false,
      runaMagicResistOwnerSmokeRan: false,
      turnOrderGroupOwnerSmokeRan: false,
      roundPointerAdvanceOwnerSmokeRan: false,
      gemActionOwnerSmokeRan: false,
    };
  }
  if (!window[SHADOW_STATE_KEY]) {
    window.__ORKA_SIMULATION_CORE_SHADOW__ = {
      status: 'idle',
      mismatches: [],
      singleHitChecks: 0,
      singleHitOwnerChecks: 0,
      calculateDamageOwnerChecks: 0,
      combatSnapshotOwnerChecks: 0,
      partyDamageOwnerChecks: 0,
      partyRegenTickOwnerChecks: 0,
      partyRegenLifecycleOwnerChecks: 0,
      turnSummaryChecks: 0,
      turnSummaryOwnerChecks: 0,
      enemyDotPacketOwnerChecks: 0,
      enemyDotTickChecks: 0,
      enemyDotTickOwnerChecks: 0,
      enemyDotLifecycleOwnerChecks: 0,
      enemyDebuffDecayOwnerChecks: 0,
      enemyDebuffApplyOwnerChecks: 0,
      enemyDebuffSlotOwnerChecks: 0,
      effectiveStatOwnerChecks: 0,
      combatOutcomeOwnerChecks: 0,
      turnActorEligibilityOwnerChecks: 0,
      turnPhaseAssignmentOwnerChecks: 0,
      enemySkillChoiceOwnerChecks: 0,
      enemyJobSkillOwnerChecks: 0,
      startEnemyActionOwnerChecks: 0,
      enemyTurnFlowOwnerChecks: 0,
      heroTurnEntryOwnerChecks: 0,
      enemyTargetOwnerChecks: 0,
      runaMagicResistOwnerChecks: 0,
      turnOrderGroupOwnerChecks: 0,
      roundPointerAdvanceOwnerChecks: 0,
      gemActionOwnerChecks: 0,
      seededRngChecks: 0,
      seededRngOwnerChecks: 0,
      singleHitOwnerSmokeRan: false,
      calculateDamageOwnerSmokeRan: false,
      combatSnapshotOwnerSmokeRan: false,
      partyDamageOwnerSmokeRan: false,
      partyRegenTickOwnerSmokeRan: false,
      partyRegenLifecycleOwnerSmokeRan: false,
      turnSummaryOwnerSmokeRan: false,
      enemyDotPacketOwnerSmokeRan: false,
      enemyDotTickOwnerSmokeRan: false,
      enemyDotLifecycleOwnerSmokeRan: false,
      enemyDebuffDecayOwnerSmokeRan: false,
      enemyDebuffApplyOwnerSmokeRan: false,
      enemyDebuffSlotOwnerSmokeRan: false,
      effectiveStatOwnerSmokeRan: false,
      combatOutcomeOwnerSmokeRan: false,
      turnActorEligibilityOwnerSmokeRan: false,
      turnPhaseAssignmentOwnerSmokeRan: false,
      enemySkillChoiceOwnerSmokeRan: false,
      enemyJobSkillOwnerSmokeRan: false,
      startEnemyActionOwnerSmokeRan: false,
      enemyTurnFlowOwnerSmokeRan: false,
      heroTurnEntryOwnerSmokeRan: false,
      enemyTargetOwnerSmokeRan: false,
      runaMagicResistOwnerSmokeRan: false,
      turnOrderGroupOwnerSmokeRan: false,
      roundPointerAdvanceOwnerSmokeRan: false,
      gemActionOwnerSmokeRan: false,
      lastCheck: null,
      lastSingleHitCheck: null,
      lastSingleHitOwnerCheck: null,
      lastCalculateDamageOwnerCheck: null,
      lastCombatSnapshotOwnerCheck: null,
      lastPartyDamageOwnerCheck: null,
      lastPartyRegenTickOwnerCheck: null,
      lastPartyRegenLifecycleOwnerCheck: null,
      lastTurnSummaryCheck: null,
      lastTurnSummaryOwnerCheck: null,
      lastEnemyDotPacketOwnerCheck: null,
      lastEnemyDotTickCheck: null,
      lastEnemyDotTickOwnerCheck: null,
      lastEnemyDotLifecycleOwnerCheck: null,
      lastEnemyDebuffDecayOwnerCheck: null,
      lastEnemyDebuffApplyOwnerCheck: null,
      lastEnemyDebuffSlotOwnerCheck: null,
      lastEffectiveStatOwnerCheck: null,
      lastCombatOutcomeOwnerCheck: null,
      lastTurnActorEligibilityOwnerCheck: null,
      lastTurnPhaseAssignmentOwnerCheck: null,
      lastEnemySkillChoiceOwnerCheck: null,
      lastEnemyJobSkillOwnerCheck: null,
      lastStartEnemyActionOwnerCheck: null,
      lastEnemyTurnFlowOwnerCheck: null,
      lastHeroTurnEntryOwnerCheck: null,
      lastEnemyTargetOwnerCheck: null,
      lastRunaMagicResistOwnerCheck: null,
      lastTurnOrderGroupOwnerCheck: null,
      lastRoundPointerAdvanceOwnerCheck: null,
      lastGemActionOwnerCheck: null,
      lastSeededRngCheck: null,
      lastSeededRngOwnerCheck: null,
      exports: null,
    };
  }
  return window[SHADOW_STATE_KEY];
}

function updateShadowDomMarker(shadow) {
  if (typeof document === 'undefined' || !document.documentElement) return;
  document.documentElement.dataset.simCoreShadowStatus = String(shadow?.status || 'unknown');
  document.documentElement.dataset.simCoreShadowMismatches = String(
    Array.isArray(shadow?.mismatches) ? shadow.mismatches.length : 0,
  );
  document.documentElement.dataset.simCoreShadowSingleHitChecks = String(
    Number(shadow?.singleHitChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowSingleHitOwnerChecks = String(
    Number(shadow?.singleHitOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowSingleHitOwner = String(
    shadow?.lastSingleHitOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowCalculateDamageOwnerChecks = String(
    Number(shadow?.calculateDamageOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowCalculateDamageOwner = String(
    shadow?.lastCalculateDamageOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowCombatSnapshotOwnerChecks = String(
    Number(shadow?.combatSnapshotOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowCombatSnapshotOwner = String(
    shadow?.lastCombatSnapshotOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowPartyDamageOwnerChecks = String(
    Number(shadow?.partyDamageOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowPartyDamageOwner = String(
    shadow?.lastPartyDamageOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowPartyRegenTickOwnerChecks = String(
    Number(shadow?.partyRegenTickOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowPartyRegenTickOwner = String(
    shadow?.lastPartyRegenTickOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowPartyRegenLifecycleOwnerChecks = String(
    Number(shadow?.partyRegenLifecycleOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowPartyRegenLifecycleOwner = String(
    shadow?.lastPartyRegenLifecycleOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowTurnSummaryChecks = String(
    Number(shadow?.turnSummaryChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowTurnSummaryOwnerChecks = String(
    Number(shadow?.turnSummaryOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowTurnSummaryOwner = String(
    shadow?.lastTurnSummaryOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowEnemyDotPacketOwnerChecks = String(
    Number(shadow?.enemyDotPacketOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowEnemyDotPacketOwner = String(
    shadow?.lastEnemyDotPacketOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowEnemyDotTickChecks = String(
    Number(shadow?.enemyDotTickChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowEnemyDotTickOwnerChecks = String(
    Number(shadow?.enemyDotTickOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowEnemyDotTickOwner = String(
    shadow?.lastEnemyDotTickOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowEnemyDotLifecycleOwnerChecks = String(
    Number(shadow?.enemyDotLifecycleOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowEnemyDotLifecycleOwner = String(
    shadow?.lastEnemyDotLifecycleOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowEnemyDebuffDecayOwnerChecks = String(
    Number(shadow?.enemyDebuffDecayOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowEnemyDebuffDecayOwner = String(
    shadow?.lastEnemyDebuffDecayOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowEnemyDebuffApplyOwnerChecks = String(
    Number(shadow?.enemyDebuffApplyOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowEnemyDebuffApplyOwner = String(
    shadow?.lastEnemyDebuffApplyOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowEnemyDebuffSlotOwnerChecks = String(
    Number(shadow?.enemyDebuffSlotOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowEnemyDebuffSlotOwner = String(
    shadow?.lastEnemyDebuffSlotOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowEffectiveStatOwnerChecks = String(
    Number(shadow?.effectiveStatOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowEffectiveStatOwner = String(
    shadow?.lastEffectiveStatOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowCombatOutcomeOwnerChecks = String(
    Number(shadow?.combatOutcomeOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowCombatOutcomeOwner = String(
    shadow?.lastCombatOutcomeOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowTurnActorEligibilityOwnerChecks = String(
    Number(shadow?.turnActorEligibilityOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowTurnActorEligibilityOwner = String(
    shadow?.lastTurnActorEligibilityOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowTurnPhaseAssignmentOwnerChecks = String(
    Number(shadow?.turnPhaseAssignmentOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowTurnPhaseAssignmentOwner = String(
    shadow?.lastTurnPhaseAssignmentOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowEnemySkillChoiceOwnerChecks = String(
    Number(shadow?.enemySkillChoiceOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowEnemySkillChoiceOwner = String(
    shadow?.lastEnemySkillChoiceOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowEnemyJobSkillOwnerChecks = String(
    Number(shadow?.enemyJobSkillOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowEnemyJobSkillOwner = String(
    shadow?.lastEnemyJobSkillOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowStartEnemyActionOwnerChecks = String(
    Number(shadow?.startEnemyActionOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowStartEnemyActionOwner = String(
    shadow?.lastStartEnemyActionOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowEnemyTurnFlowOwnerChecks = String(
    Number(shadow?.enemyTurnFlowOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowEnemyTurnFlowOwner = String(
    shadow?.lastEnemyTurnFlowOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowHeroTurnEntryOwnerChecks = String(
    Number(shadow?.heroTurnEntryOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowHeroTurnEntryOwner = String(
    shadow?.lastHeroTurnEntryOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowEnemyTargetOwnerChecks = String(
    Number(shadow?.enemyTargetOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowEnemyTargetOwner = String(
    shadow?.lastEnemyTargetOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowRunaMagicResistOwnerChecks = String(
    Number(shadow?.runaMagicResistOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowRunaMagicResistOwner = String(
    shadow?.lastRunaMagicResistOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowTurnOrderGroupOwnerChecks = String(
    Number(shadow?.turnOrderGroupOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowTurnOrderGroupOwner = String(
    shadow?.lastTurnOrderGroupOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowRoundPointerAdvanceOwnerChecks = String(
    Number(shadow?.roundPointerAdvanceOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowRoundPointerAdvanceOwner = String(
    shadow?.lastRoundPointerAdvanceOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowGemActionOwnerChecks = String(
    Number(shadow?.gemActionOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowGemActionOwner = String(
    shadow?.lastGemActionOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowSeededRngChecks = String(
    Number(shadow?.seededRngChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowSeededRngOwnerChecks = String(
    Number(shadow?.seededRngOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowSeededRngOwner = String(
    shadow?.lastSeededRngOwnerCheck?.owner || '',
  );
}

function hasSeededRngExports(exports) {
  return typeof exports?.seeded_rng_next_state_shadow === 'function'
    && typeof exports?.seeded_rng_next_value_shadow === 'function'
    && typeof exports?.seeded_rng_index_shadow === 'function';
}

function hasSingleHitExports(exports) {
  return typeof exports?.single_hit_damage_shadow === 'function'
    && typeof exports?.single_hit_applied_damage_shadow === 'function'
    && typeof exports?.single_hit_after_hp_shadow === 'function';
}

function hasCalculateDamageExports(exports) {
  return typeof exports?.single_hit_damage_shadow === 'function';
}

function hasPartyDamageExports(exports) {
  return typeof exports?.party_damage_absorbed_shadow === 'function'
    && typeof exports?.party_damage_after_shield_shadow === 'function'
    && typeof exports?.party_damage_shield_after_shadow === 'function'
    && typeof exports?.party_damage_hero_after_hp_shadow === 'function'
    && typeof exports?.party_damage_party_hp_after_shadow === 'function';
}

function hasPartyRegenTickExports(exports) {
  return typeof exports?.party_regen_tick_heal_shadow === 'function'
    && typeof exports?.party_regen_tick_total_remaining_shadow === 'function'
    && typeof exports?.party_regen_tick_remaining_fires_shadow === 'function'
    && typeof exports?.party_regen_tick_next_serial_shadow === 'function';
}

function hasPartyRegenLifecycleExports(exports) {
  return typeof exports?.party_regen_lifecycle_action_shadow === 'function';
}

function hasEnemyDotTickExports(exports) {
  return typeof exports?.enemy_dot_tick_damage_shadow === 'function'
    && typeof exports?.enemy_dot_tick_total_remaining_shadow === 'function'
    && typeof exports?.enemy_dot_tick_remaining_fires_shadow === 'function'
    && typeof exports?.enemy_dot_tick_next_turn_shadow === 'function';
}

function hasEnemyDotPacketExports(exports) {
  return typeof exports?.enemy_dot_packet_target_uid_shadow === 'function'
    && typeof exports?.enemy_dot_packet_source_uid_shadow === 'function'
    && typeof exports?.enemy_dot_packet_remaining_fires_shadow === 'function'
    && typeof exports?.enemy_dot_packet_total_damage_remaining_shadow === 'function'
    && typeof exports?.enemy_dot_packet_fires_every_ticks_shadow === 'function'
    && typeof exports?.enemy_dot_packet_next_fire_tick_shadow === 'function'
    && typeof exports?.enemy_dot_packet_fires_every_turns_shadow === 'function'
    && typeof exports?.enemy_dot_packet_next_fire_turn_serial_shadow === 'function'
    && typeof exports?.enemy_dot_packet_last_processed_turn_serial_shadow === 'function';
}

function hasEnemyDotLifecycleExports(exports) {
  return typeof exports?.enemy_dot_lifecycle_action_shadow === 'function';
}

function hasEnemyDebuffDecayExports(exports) {
  return typeof exports?.enemy_debuff_turns_after_tick_shadow === 'function'
    && typeof exports?.enemy_debuff_amount_after_tick_shadow === 'function'
    && typeof exports?.enemy_debuff_active_after_tick_shadow === 'function';
}

function hasEnemyDebuffApplyExports(exports) {
  return typeof exports?.enemy_debuff_apply_amount_after_shadow === 'function'
    && typeof exports?.enemy_debuff_apply_turns_after_shadow === 'function'
    && typeof exports?.enemy_debuff_apply_active_shadow === 'function';
}

function hasEnemyDebuffSlotExports(exports) {
  return typeof exports?.enemy_debuff_slot_transition_action_shadow === 'function'
    && typeof exports?.enemy_debuff_slot_transition_drop_slot_index_shadow === 'function'
    && typeof exports?.enemy_debuff_slot_transition_append_slot_index_shadow === 'function';
}

function hasEffectiveStatExports(exports) {
  return typeof exports?.effective_stat_value_shadow === 'function';
}

function hasCombatOutcomeExports(exports) {
  return typeof exports?.combat_outcome_code_shadow === 'function';
}

function hasCombatSnapshotExports(exports) {
  return typeof exports?.combat_snapshot_index_failure_code_shadow === 'function'
    && typeof exports?.combat_snapshot_schema_valid_shadow === 'function'
    && typeof exports?.combat_snapshot_resume_token_valid_shadow === 'function';
}

function hasTurnActorEligibilityExports(exports) {
  return typeof exports?.turn_actor_eligibility_code_shadow === 'function';
}

function hasTurnPhaseAssignmentExports(exports) {
  return typeof exports?.turn_phase_from_type_shadow === 'function';
}

function hasEnemySkillChoiceExports(exports) {
  return typeof exports?.enemy_skill_choice_selected_code_shadow === 'function'
    && typeof exports?.enemy_skill_choice_branch_code_shadow === 'function';
}

function hasEnemyJobSkillExports(exports) {
  return typeof exports?.enemy_job_skill_normalized_code_shadow === 'function'
    && typeof exports?.enemy_job_skill_resolved_target_uid_shadow === 'function'
    && typeof exports?.enemy_job_skill_ally_target_uid_shadow === 'function'
    && typeof exports?.enemy_job_skill_action_code_shadow === 'function'
    && typeof exports?.enemy_job_skill_return_value_shadow === 'function';
}

function hasStartEnemyActionExports(exports) {
  return typeof exports?.start_enemy_action_active_shadow === 'function'
    && typeof exports?.start_enemy_action_state_code_shadow === 'function'
    && typeof exports?.start_enemy_action_uid_shadow === 'function'
    && typeof exports?.start_enemy_action_target_uid_shadow === 'function'
    && typeof exports?.start_enemy_action_skill_code_shadow === 'function'
    && typeof exports?.start_enemy_action_forward_x_shadow === 'function';
}

function hasEnemyTurnFlowExports(exports) {
  return typeof exports?.enemy_turn_flow_active_uid_shadow === 'function'
    && typeof exports?.enemy_turn_flow_turn_phase_shadow === 'function'
    && typeof exports?.enemy_turn_flow_action_code_shadow === 'function'
    && typeof exports?.enemy_turn_flow_should_advance_shadow === 'function'
    && typeof exports?.enemy_turn_flow_should_start_action_shadow === 'function';
}

function hasHeroTurnEntryExports(exports) {
  return typeof exports?.hero_turn_entry_turn_phase_shadow === 'function'
    && typeof exports?.hero_turn_entry_hide_hero_selector_shadow === 'function'
    && typeof exports?.hero_turn_entry_accept_hero_uid_shadow === 'function'
    && typeof exports?.hero_turn_entry_current_hero_uid_after_shadow === 'function'
    && typeof exports?.hero_turn_entry_should_reset_astral_flow_shadow === 'function'
    && typeof exports?.hero_turn_entry_amp_points_after_shadow === 'function'
    && typeof exports?.hero_turn_entry_amp_ready_after_shadow === 'function'
    && typeof exports?.hero_turn_entry_clear_pinned_action_shadow === 'function';
}

function hasEnemyTargetExports(exports) {
  return typeof exports?.enemy_target_selected_uid_shadow === 'function'
    && typeof exports?.enemy_target_mode_code_shadow === 'function'
    && typeof exports?.enemy_target_roll_index_shadow === 'function';
}

function hasRunaMagicResistExports(exports) {
  return typeof exports?.runa_magic_resist_final_damage_shadow === 'function'
    && typeof exports?.runa_magic_resist_mode_code_shadow === 'function';
}

function hasTurnOrderGroupExports(exports) {
  return typeof exports?.turn_order_actor_in_phase_shadow === 'function'
    && typeof exports?.turn_order_phase_type_shadow === 'function'
    && typeof exports?.turn_order_compare_slots_shadow === 'function';
}

function hasRoundPointerAdvanceExports(exports) {
  return typeof exports?.round_pointer_next_member_index_shadow === 'function'
    && typeof exports?.round_pointer_group_complete_shadow === 'function'
    && typeof exports?.round_pointer_next_group_index_shadow === 'function'
    && typeof exports?.round_pointer_round_complete_shadow === 'function'
    && typeof exports?.round_pointer_next_team_phase_type_shadow === 'function'
    && typeof exports?.round_pointer_advance_code_shadow === 'function';
}

function hasGemActionExports(exports) {
  return typeof exports?.gem_action_route_code_shadow === 'function'
    && typeof exports?.gem_action_pending_skill_code_shadow === 'function'
    && typeof exports?.gem_action_set_aoe_shadow === 'function'
    && typeof exports?.gem_action_is_aoe_shadow === 'function'
    && typeof exports?.gem_action_show_attack_ui_shadow === 'function'
    && typeof exports?.gem_action_call_code_shadow === 'function'
    && typeof exports?.gem_action_consumes_turn_shadow === 'function'
    && typeof exports?.gem_action_consumed_count_shadow === 'function'
    && typeof exports?.gem_action_blue_wallet_after_shadow === 'function'
    && typeof exports?.gem_action_blue_amp_points_after_shadow === 'function'
    && typeof exports?.gem_action_blue_amp_ready_after_shadow === 'function'
    && typeof exports?.gem_action_blue_open_draught_shadow === 'function'
    && typeof exports?.gem_action_action_lock_until_shadow === 'function'
    && typeof exports?.gem_action_purple_energy_amount_shadow === 'function';
}

function hasTurnSummaryExports(exports) {
  return typeof exports?.turn_summary_code_shadow === 'function';
}

function hasRequiredExports(exports) {
  return typeof exports?.combat_power_shadow === 'function'
    && hasSeededRngExports(exports)
    && hasSingleHitExports(exports)
    && hasPartyDamageExports(exports)
    && hasPartyRegenTickExports(exports)
    && hasPartyRegenLifecycleExports(exports)
    && hasTurnSummaryExports(exports)
    && hasEnemyDotPacketExports(exports)
    && hasEnemyDotTickExports(exports)
    && hasEnemyDotLifecycleExports(exports)
    && hasEnemyDebuffDecayExports(exports)
    && hasEnemyDebuffApplyExports(exports)
    && hasEnemyDebuffSlotExports(exports)
    && hasEffectiveStatExports(exports)
    && hasCombatOutcomeExports(exports)
    && hasCombatSnapshotExports(exports)
    && hasTurnActorEligibilityExports(exports)
    && hasTurnPhaseAssignmentExports(exports)
    && hasEnemySkillChoiceExports(exports)
    && hasEnemyJobSkillExports(exports)
    && hasStartEnemyActionExports(exports)
    && hasEnemyTurnFlowExports(exports)
    && hasHeroTurnEntryExports(exports)
    && hasEnemyTargetExports(exports)
    && hasRunaMagicResistExports(exports)
    && hasTurnOrderGroupExports(exports)
    && hasRoundPointerAdvanceExports(exports)
    && hasGemActionExports(exports);
}

async function instantiateWasm(wasmUrl) {
  if (WebAssembly.instantiateStreaming) {
    try {
      const result = await WebAssembly.instantiateStreaming(fetch(wasmUrl), {});
      return result.instance;
    } catch (_) {
      // Some local servers or browsers reject streaming when MIME checks are strict.
    }
  }
  const response = await fetch(wasmUrl);
  const bytes = await response.arrayBuffer();
  const result = await WebAssembly.instantiate(bytes, {});
  return result.instance;
}

function runSingleHitOwnerStartupCheck(shadow) {
  if (!shadow || shadow.singleHitOwnerSmokeRan) return;
  shadow.singleHitOwnerSmokeRan = true;
  createSimulationCoreSingleHitResolution({
    source: 'simulationCore.startup.singleHitOwner',
    power: 18,
    resist: 12,
    roll01: 0.5,
    critRoll01: 0.9,
    sourceIsHero: 1,
    heroAoe: 0,
    chainActive: 0,
    chainMultiplier: 1,
    targetHp: 40,
    shield: 0,
    jsDamage: 14,
    jsAppliedDamage: 14,
    jsAfterHp: 26,
  });
}

function runCalculateDamageOwnerStartupCheck(shadow) {
  if (!shadow || shadow.calculateDamageOwnerSmokeRan) return;
  shadow.calculateDamageOwnerSmokeRan = true;
  createSimulationCoreCalculateDamageResolution({
    source: 'simulationCore.startup.calculateDamageOwner',
    power: 30,
    resist: 10,
    roll01: 0.5,
    critRoll01: 0.9,
    sourceIsHero: 1,
    heroAoe: 0,
    chainActive: 0,
    chainMultiplier: 1,
    jsDamage: 27,
  });
}

function runCombatSnapshotOwnerStartupCheck(shadow) {
  if (!shadow || shadow.combatSnapshotOwnerSmokeRan) return;
  shadow.combatSnapshotOwnerSmokeRan = true;
  createSimulationCoreCombatSnapshotResolution({
    source: 'simulationCore.startup.combatSnapshotOwner',
    checkpointId: 'CHK_POST_RESUME',
    snapshotVersion: 1,
    hasTurnState: 1,
    turnQueueIsArray: 1,
    turnQueueLength: 2,
    currentActorIndex: 1,
    hasResumeToken: 1,
    hasExpectedToken: 1,
    capturedAtTick: 77,
    expectedCapturedAtTick: 77,
    expectedTurnQueueLength: 2,
    expectedCurrentActorIndex: 1,
    jsFailures: [],
  });
}

function runPartyDamageOwnerStartupCheck(shadow) {
  if (!shadow || shadow.partyDamageOwnerSmokeRan) return;
  shadow.partyDamageOwnerSmokeRan = true;
  createSimulationCorePartyDamageResolution({
    source: 'simulationCore.startup.partyDamageOwner',
    incomingDamage: 12,
    shield: 5,
    heroCount: 4,
    heroHp: [20, 16, 12, 8],
    jsAbsorbed: 5,
    jsDamageAfterShield: 7,
    jsShieldAfter: 0,
    jsHeroHp: [13, 9, 5, 1],
    jsPartyHp: 28,
  });
}

function runPartyRegenLifecycleOwnerStartupCheck(shadow) {
  if (!shadow || shadow.partyRegenLifecycleOwnerSmokeRan) return;
  shadow.partyRegenLifecycleOwnerSmokeRan = true;
  createSimulationCorePartyRegenLifecycleResolution({
    source: 'simulationCore.startup.partyRegenLifecycleOwner',
    remainingFires: 3,
    hasTotalHealRemaining: 1,
    totalHealRemaining: 10,
    currentSerial: 10,
    nextFireSerial: 10,
    appliedOnSerial: 0,
    lastProcessedSerial: 9,
    jsAction: 2,
  });
}

function runPartyRegenTickOwnerStartupCheck(shadow) {
  if (!shadow || shadow.partyRegenTickOwnerSmokeRan) return;
  shadow.partyRegenTickOwnerSmokeRan = true;
  createSimulationCorePartyRegenTickResolution({
    source: 'simulationCore.startup.partyRegenTickOwner',
    totalHealRemaining: 10,
    remainingFires: 3,
    healPerFire: 0,
    hasTotalHealRemaining: 1,
    nextFireSerial: 10,
    firesEvery: 2,
    distributionMode: 1,
    jsHeal: 3,
    jsTotalHealRemaining: 7,
    jsRemainingFires: 2,
    jsNextFireSerial: 12,
  });
}

function runEnemyDotTickOwnerStartupCheck(shadow) {
  if (!shadow || shadow.enemyDotTickOwnerSmokeRan) return;
  shadow.enemyDotTickOwnerSmokeRan = true;
  createSimulationCoreEnemyDotTickResolution({
    source: 'simulationCore.startup.enemyDotTickOwner',
    totalDamageRemaining: 30,
    remainingFires: 3,
    damagePerFire: 0,
    hasTotalDamageRemaining: 1,
    nextFireTurnSerial: 10,
    firesEveryTurns: 2,
    jsDamage: 10,
    jsTotalDamageRemaining: 20,
    jsRemainingFires: 2,
    jsNextFireTurnSerial: 12,
  });
}

function runEnemyDotPacketOwnerStartupCheck(shadow) {
  if (!shadow || shadow.enemyDotPacketOwnerSmokeRan) return;
  shadow.enemyDotPacketOwnerSmokeRan = true;
  createSimulationCoreEnemyDotPacketResolution({
    source: 'simulationCore.startup.enemyDotPacketOwner',
    actorUID: 100,
    enemyUID: 200,
    totalDamage: 25,
    totalTicks: 3,
    nowTick: 4,
    nowTurnSerial: 20,
    firesEveryTicks: 1,
    startAfterTicks: 1,
    firesEveryTurns: 2,
    startAfterTurns: 3,
    cadence: 'turn',
    effectName: 'Blight',
    taintedGroundZoneId: '',
    jsTargetUID: 200,
    jsSourceUID: 100,
    jsRemainingFires: 3,
    jsTotalDamageRemaining: 25,
    jsFiresEveryTicks: 1,
    jsNextFireTick: 5,
    jsFiresEveryTurns: 2,
    jsNextFireTurnSerial: 23,
    jsLastProcessedTurnSerial: 20,
  });
}

function runEnemyDotLifecycleOwnerStartupCheck(shadow) {
  if (!shadow || shadow.enemyDotLifecycleOwnerSmokeRan) return;
  shadow.enemyDotLifecycleOwnerSmokeRan = true;
  createSimulationCoreEnemyDotLifecycleResolution({
    source: 'simulationCore.startup.enemyDotLifecycleOwner',
    cadenceIsTurn: 1,
    dotTargetUID: 200,
    targetUID: 200,
    remainingFires: 3,
    hasTotalDamageRemaining: 1,
    totalDamageRemaining: 30,
    targetAlive: 1,
    currentTurnSerial: 10,
    nextFireTurnSerial: 10,
    lastProcessedTurnSerial: 9,
    jsAction: 2,
  });
}

function runEnemyDebuffDecayOwnerStartupCheck(shadow) {
  if (!shadow || shadow.enemyDebuffDecayOwnerSmokeRan) return;
  shadow.enemyDebuffDecayOwnerSmokeRan = true;
  createSimulationCoreEnemyDebuffDecayResolution({
    source: 'simulationCore.startup.enemyDebuffDecayOwner',
    stat: 'ATK',
    amountBefore: 4,
    turnsBefore: 3,
    jsAmountAfter: 4,
    jsTurnsAfter: 2,
    jsActive: 1,
  });
}

function runEnemyDebuffApplyOwnerStartupCheck(shadow) {
  if (!shadow || shadow.enemyDebuffApplyOwnerSmokeRan) return;
  shadow.enemyDebuffApplyOwnerSmokeRan = true;
  createSimulationCoreEnemyDebuffApplyResolution({
    source: 'simulationCore.startup.enemyDebuffApplyOwner',
    stat: 'ATK',
    amountBefore: 4,
    turnsBefore: 1,
    addAmount: 2,
    durationTurns: 3,
    jsAmountAfter: 6,
    jsTurnsAfter: 3,
    jsActive: 1,
  });
}

function runEnemyDebuffSlotOwnerStartupCheck(shadow) {
  if (!shadow || shadow.enemyDebuffSlotOwnerSmokeRan) return;
  shadow.enemyDebuffSlotOwnerSmokeRan = true;
  createSimulationCoreEnemyDebuffSlotTransition({
    source: 'simulationCore.startup.enemyDebuffSlotOwner',
    stat: 'SPD',
    statIndex: 4,
    active: 1,
    slotCount: 3,
    slot0Index: 0,
    slot1Index: 1,
    slot2Index: 2,
    jsAction: 2,
    jsDropSlotIndex: 0,
    jsAppendSlotIndex: 4,
  });
}

function runEffectiveStatOwnerStartupCheck(shadow) {
  if (!shadow || shadow.effectiveStatOwnerSmokeRan) return;
  shadow.effectiveStatOwnerSmokeRan = true;
  createSimulationCoreEffectiveStatResolution({
    source: 'simulationCore.startup.effectiveStatOwner.hero',
    stat: 'ATK',
    actorKind: 'hero',
    base: 10,
    partyBuff: 3,
    enemyDebuff: 0,
    isHero: 1,
    isEnemy: 0,
    jsValue: 13,
  });
  createSimulationCoreEffectiveStatResolution({
    source: 'simulationCore.startup.effectiveStatOwner.enemy',
    stat: 'DEF',
    actorKind: 'enemy',
    base: 10,
    partyBuff: 0,
    enemyDebuff: 4,
    isHero: 0,
    isEnemy: 1,
    jsValue: 6,
  });
}

function runCombatOutcomeOwnerStartupCheck(shadow) {
  if (!shadow || shadow.combatOutcomeOwnerSmokeRan) return;
  shadow.combatOutcomeOwnerSmokeRan = true;
  createSimulationCoreCombatOutcomeResolution({
    source: 'simulationCore.startup.combatOutcomeOwner.continue',
    energy: 10,
    partyHp: 40,
    livingHeroes: 4,
    jsCode: 0,
  });
  createSimulationCoreCombatOutcomeResolution({
    source: 'simulationCore.startup.combatOutcomeOwner.partyDefeated',
    energy: 10,
    partyHp: 0,
    livingHeroes: 4,
    jsCode: 2,
  });
}

function runTurnActorEligibilityOwnerStartupCheck(shadow) {
  if (!shadow || shadow.turnActorEligibilityOwnerSmokeRan) return;
  shadow.turnActorEligibilityOwnerSmokeRan = true;
  createSimulationCoreTurnActorEligibilityResolution({
    source: 'simulationCore.startup.turnActorEligibilityOwner.hero',
    turnType: 0,
    actorExists: 1,
    actorHp: 10,
    partyHp: 40,
    roundActive: 0,
    pendingGroupMatches: 0,
    blueBuffSequenceActive: 0,
    jsCode: 1,
  });
  createSimulationCoreTurnActorEligibilityResolution({
    source: 'simulationCore.startup.turnActorEligibilityOwner.enemyHold',
    turnType: 1,
    actorExists: 1,
    actorHp: 12,
    partyHp: 40,
    roundActive: 0,
    pendingGroupMatches: 0,
    blueBuffSequenceActive: 1,
    jsCode: 2,
  });
}

function runTurnPhaseAssignmentOwnerStartupCheck(shadow) {
  if (!shadow || shadow.turnPhaseAssignmentOwnerSmokeRan) return;
  shadow.turnPhaseAssignmentOwnerSmokeRan = true;
  createSimulationCoreTurnPhaseAssignmentResolution({
    source: 'simulationCore.startup.turnPhaseAssignmentOwner',
    turnTypeCode: 1,
    jsTurnPhase: 2,
  });
}

function runEnemySkillChoiceOwnerStartupCheck(shadow) {
  if (!shadow || shadow.enemySkillChoiceOwnerSmokeRan) return;
  shadow.enemySkillChoiceOwnerSmokeRan = true;
  createSimulationCoreEnemySkillChoiceResolution({
    source: 'simulationCore.startup.enemySkillChoiceOwner',
    enemyKindCode: 1,
    hp: 20,
    maxHP: 20,
    damagedAlliesCount: 0,
    boardReady: 1,
    roll: 0.1,
    healRoll: 0,
    jsSelectedCode: 1,
    jsBranchCode: 1,
  });
}

function runEnemyJobSkillOwnerStartupCheck(shadow) {
  if (!shadow || shadow.enemyJobSkillOwnerSmokeRan) return;
  shadow.enemyJobSkillOwnerSmokeRan = true;
  createSimulationCoreEnemyJobSkillResolution({
    source: 'simulationCore.startup.enemyJobSkillOwner',
    skillCode: 1,
    enemyKindCode: 1,
    boardReady: 0,
    targetUID: 0,
    fallbackTargetUID: 12,
    jsNormalizedSkillCode: 2,
    jsActionCode: 2,
    jsResolvedTargetUID: 12,
    jsAllyTargetUID: 0,
    jsReturnValue: 1,
  });
}

function runStartEnemyActionOwnerStartupCheck(shadow) {
  if (!shadow || shadow.startEnemyActionOwnerSmokeRan) return;
  shadow.startEnemyActionOwnerSmokeRan = true;
  createSimulationCoreStartEnemyActionResolution({
    source: 'simulationCore.startup.startEnemyActionOwner',
    enemyExists: 1,
    enemyUID: 12,
    targetUID: 101,
    skillCode: 2,
    originX: 300,
    jsActive: 1,
    jsStateCode: 1,
    jsTargetUID: 101,
    jsSkillCode: 2,
    jsForwardX: 245,
  });
}

function runEnemyTurnFlowOwnerStartupCheck(shadow) {
  if (!shadow || shadow.enemyTurnFlowOwnerSmokeRan) return;
  shadow.enemyTurnFlowOwnerSmokeRan = true;
  createSimulationCoreEnemyTurnFlowResolution({
    source: 'simulationCore.startup.enemyTurnFlowOwner',
    activeEnemyUID: 12,
    enemyExists: 1,
    enemyHp: 20,
    jsTurnPhase: 2,
    jsActionCode: 2,
    jsActiveEnemyUID: 12,
  });
}

function runHeroTurnEntryOwnerStartupCheck(shadow) {
  if (!shadow || shadow.heroTurnEntryOwnerSmokeRan) return;
  shadow.heroTurnEntryOwnerSmokeRan = true;
  createSimulationCoreHeroTurnEntryResolution({
    source: 'simulationCore.startup.heroTurnEntryOwner',
    heroUID: 101,
    currentHeroUIDBefore: 77,
    skillDraughtOpen: 0,
    astralFlowAmpPoints: 18,
    astralFlowAmpMax: 18,
    astralFlowAmpReady: 1,
    time: 15,
    combatActionPinnedUntil: 14,
    jsTurnPhase: 0,
    jsHideHeroSelector: 0,
    jsAcceptHeroUID: 1,
    jsCurrentHeroUIDAfter: 101,
    jsShouldResetAstralFlowAmp: 1,
    jsAstralFlowAmpPointsAfter: 0,
    jsAstralFlowAmpReadyAfter: 0,
    jsClearCombatActionPinned: 1,
  });
}

function runEnemyTargetOwnerStartupCheck(shadow) {
  if (!shadow || shadow.enemyTargetOwnerSmokeRan) return;
  shadow.enemyTargetOwnerSmokeRan = true;
  createSimulationCoreEnemyTargetResolution({
    source: 'simulationCore.startup.enemyTargetOwner',
    preferenceCode: 0,
    roll: 0.9,
    heroes: [
      { uid: 11, hp: 40, maxHP: 40, atk: 5, slot: 0, roleCode: 0 },
      { uid: 22, hp: 9, maxHP: 35, atk: 12, slot: 1, roleCode: 0 },
      { uid: 33, hp: 30, maxHP: 30, atk: 8, slot: 2, roleCode: 1 },
      { uid: 44, hp: 40, maxHP: 40, atk: 3, slot: 3, roleCode: 0 },
    ],
    jsTargetUID: 44,
    jsModeCode: 1,
    jsRollIndex: 3,
  });
}

function runTurnOrderGroupOwnerStartupCheck(shadow) {
  if (!shadow || shadow.turnOrderGroupOwnerSmokeRan) return;
  shadow.turnOrderGroupOwnerSmokeRan = true;
  createSimulationCoreTurnOrderGroupProjection({
    source: 'simulationCore.startup.turnOrderGroupOwner',
    requestedPhaseType: 0,
    roster: [
      { uid: 1, type: 0, spd: 11, hp: 40, isAlive: 1, ableToAct: 1 },
      { uid: 2, type: 0, spd: 20, hp: 35, isAlive: 1, ableToAct: 1 },
      { uid: 101, type: 1, spd: 18, hp: 20, isAlive: 1, ableToAct: 1 },
    ],
    jsPhaseType: 0,
    jsMembers: [
      { uid: 2, type: 0, spd: 20 },
      { uid: 1, type: 0, spd: 11 },
    ],
  });
}

function runRunaMagicResistOwnerStartupCheck(shadow) {
  if (!shadow || shadow.runaMagicResistOwnerSmokeRan) return;
  shadow.runaMagicResistOwnerSmokeRan = true;
  createSimulationCoreRunaMagicResistResolution({
    source: 'simulationCore.startup.runaMagicResistOwner',
    targetIsRuna: 1,
    incomingDamage: 10,
    triggerRoll: 0.1,
    nullifyRoll: 0.35,
    jsFinalDamage: 2,
    jsModeCode: 3,
  });
}

function runRoundPointerAdvanceOwnerStartupCheck(shadow) {
  if (!shadow || shadow.roundPointerAdvanceOwnerSmokeRan) return;
  shadow.roundPointerAdvanceOwnerSmokeRan = true;
  createSimulationCoreRoundPointerAdvanceResolution({
    source: 'simulationCore.startup.roundPointerAdvanceOwner',
    roundMemberIndex: 3,
    groupMemberCount: 4,
    roundGroupIndex: 0,
    groupCount: 1,
    teamPhaseType: 0,
    jsCode: 2,
    jsNextMemberIndex: 4,
    jsGroupComplete: 1,
    jsNextGroupIndex: 1,
    jsRoundComplete: 1,
    jsNextTeamPhaseType: 1,
  });
}

function runGemActionOwnerStartupCheck(shadow) {
  if (!shadow || shadow.gemActionOwnerSmokeRan) return;
  shadow.gemActionOwnerSmokeRan = true;
  createSimulationCoreGemActionResolution({
    source: 'simulationCore.startup.gemActionOwner',
    gemColor: 2,
    consumedCount: 5,
    astralFlowWallet: 7,
    astralFlowAmpPoints: 16,
    astralFlowAmpMax: 18,
    astralFlowAmpReady: 0,
    time: 10,
    actionLockUntil: 0,
    textAnimEndAt: 0,
    purpleRoll01: 0.5,
    jsRouteCode: 2,
    jsPendingSkillCode: 0,
    jsSetIsAoe: 1,
    jsIsAoe: 0,
    jsShowAttackUi: 0,
    jsCallCode: 0,
    jsConsumesTurn: 1,
    jsConsumedCount: 5,
    jsBlueWalletAfter: 12,
    jsBlueAmpPointsAfter: 18,
    jsBlueAmpReadyAfter: 1,
    jsBlueOpenDraught: 1,
    jsActionLockUntil: 14,
    jsPurpleEnergyAmount: 12,
  });
}

function runTurnSummaryOwnerStartupCheck(shadow) {
  if (!shadow || shadow.turnSummaryOwnerSmokeRan) return;
  shadow.turnSummaryOwnerSmokeRan = true;
  createSimulationCoreTurnSummaryResolution({
    source: 'simulationCore.startup.turnSummaryOwner',
    heroCount: 4,
    heroHp: [10, 12, 8, 6],
    enemyCount: 3,
    enemyHp: [0, 0, 0, 0],
    jsCode: 400301,
  });
}

export function initializeSimulationCoreShadow({ wasmUrl = DEFAULT_WASM_URL } = {}) {
  const shadow = getShadowState();
  if (typeof window !== 'undefined') {
    window.__ORKA_SINGLE_HIT_SHADOW__ = shadowSingleHitResolution;
    window.__ORKA_SINGLE_HIT_OWNER__ = createSimulationCoreSingleHitResolution;
    window.__ORKA_CALCULATE_DAMAGE_OWNER__ = createSimulationCoreCalculateDamageResolution;
    window.__ORKA_COMBAT_SNAPSHOT_OWNER__ = createSimulationCoreCombatSnapshotResolution;
    window.__ORKA_PARTY_DAMAGE_OWNER__ = createSimulationCorePartyDamageResolution;
    window.__ORKA_PARTY_REGEN_LIFECYCLE_OWNER__ = createSimulationCorePartyRegenLifecycleResolution;
    window.__ORKA_PARTY_REGEN_TICK_OWNER__ = createSimulationCorePartyRegenTickResolution;
    window.__ORKA_TURN_SUMMARY_SHADOW__ = shadowTurnSummary;
    window.__ORKA_TURN_SUMMARY_OWNER__ = createSimulationCoreTurnSummaryResolution;
    window.__ORKA_ENEMY_DOT_PACKET_OWNER__ = createSimulationCoreEnemyDotPacketResolution;
    window.__ORKA_ENEMY_DOT_TICK_SHADOW__ = shadowEnemyDotTick;
    window.__ORKA_ENEMY_DOT_TICK_OWNER__ = createSimulationCoreEnemyDotTickResolution;
    window.__ORKA_ENEMY_DOT_LIFECYCLE_OWNER__ = createSimulationCoreEnemyDotLifecycleResolution;
    window.__ORKA_ENEMY_DEBUFF_DECAY_OWNER__ = createSimulationCoreEnemyDebuffDecayResolution;
    window.__ORKA_ENEMY_DEBUFF_APPLY_OWNER__ = createSimulationCoreEnemyDebuffApplyResolution;
    window.__ORKA_ENEMY_DEBUFF_SLOT_OWNER__ = createSimulationCoreEnemyDebuffSlotTransition;
    window.__ORKA_EFFECTIVE_STAT_OWNER__ = createSimulationCoreEffectiveStatResolution;
    window.__ORKA_COMBAT_OUTCOME_OWNER__ = createSimulationCoreCombatOutcomeResolution;
    window.__ORKA_TURN_ACTOR_ELIGIBILITY_OWNER__ = createSimulationCoreTurnActorEligibilityResolution;
    window.__ORKA_TURN_PHASE_ASSIGNMENT_OWNER__ = createSimulationCoreTurnPhaseAssignmentResolution;
    window.__ORKA_ENEMY_SKILL_CHOICE_OWNER__ = createSimulationCoreEnemySkillChoiceResolution;
    window.__ORKA_ENEMY_JOB_SKILL_OWNER__ = createSimulationCoreEnemyJobSkillResolution;
    window.__ORKA_START_ENEMY_ACTION_OWNER__ = createSimulationCoreStartEnemyActionResolution;
    window.__ORKA_ENEMY_TURN_FLOW_OWNER__ = createSimulationCoreEnemyTurnFlowResolution;
    window.__ORKA_HERO_TURN_ENTRY_OWNER__ = createSimulationCoreHeroTurnEntryResolution;
    window.__ORKA_ENEMY_TARGET_OWNER__ = createSimulationCoreEnemyTargetResolution;
    window.__ORKA_RUNA_MAGIC_RESIST_OWNER__ = createSimulationCoreRunaMagicResistResolution;
    window.__ORKA_TURN_ORDER_GROUP_OWNER__ = createSimulationCoreTurnOrderGroupProjection;
    window.__ORKA_ROUND_POINTER_ADVANCE_OWNER__ = createSimulationCoreRoundPointerAdvanceResolution;
    window.__ORKA_GEM_ACTION_OWNER__ = createSimulationCoreGemActionResolution;
    window.__ORKA_SEEDED_RNG_SHADOW__ = shadowSeededRng;
    window.__ORKA_SEEDED_RNG_OWNER__ = createSimulationCoreSeededRng;
  }
  if (shadow.status === 'ready' || shadow.status === 'loading') return shadow.readyPromise || null;
  if (typeof window === 'undefined' || typeof WebAssembly === 'undefined' || typeof fetch !== 'function') {
    shadow.status = 'unavailable';
    updateShadowDomMarker(shadow);
    return null;
  }
  shadow.status = 'loading';
  updateShadowDomMarker(shadow);
  shadow.readyPromise = instantiateWasm(wasmUrl)
    .then((instance) => {
      shadow.exports = instance.exports;
      shadow.status = hasRequiredExports(shadow.exports) ? 'ready' : 'missing-export';
      if (shadow.status === 'ready') {
        runSingleHitOwnerStartupCheck(shadow);
        runCalculateDamageOwnerStartupCheck(shadow);
        runCombatSnapshotOwnerStartupCheck(shadow);
        runPartyDamageOwnerStartupCheck(shadow);
        runPartyRegenLifecycleOwnerStartupCheck(shadow);
        runPartyRegenTickOwnerStartupCheck(shadow);
        runTurnSummaryOwnerStartupCheck(shadow);
        runEnemyDotPacketOwnerStartupCheck(shadow);
        runEnemyDotTickOwnerStartupCheck(shadow);
        runEnemyDotLifecycleOwnerStartupCheck(shadow);
        runEnemyDebuffDecayOwnerStartupCheck(shadow);
        runEnemyDebuffApplyOwnerStartupCheck(shadow);
        runEnemyDebuffSlotOwnerStartupCheck(shadow);
        runEffectiveStatOwnerStartupCheck(shadow);
        runCombatOutcomeOwnerStartupCheck(shadow);
        runTurnActorEligibilityOwnerStartupCheck(shadow);
        runTurnPhaseAssignmentOwnerStartupCheck(shadow);
        runEnemySkillChoiceOwnerStartupCheck(shadow);
        runEnemyJobSkillOwnerStartupCheck(shadow);
        runStartEnemyActionOwnerStartupCheck(shadow);
        runEnemyTurnFlowOwnerStartupCheck(shadow);
        runHeroTurnEntryOwnerStartupCheck(shadow);
        runEnemyTargetOwnerStartupCheck(shadow);
        runRunaMagicResistOwnerStartupCheck(shadow);
        runTurnOrderGroupOwnerStartupCheck(shadow);
        runRoundPointerAdvanceOwnerStartupCheck(shadow);
        runGemActionOwnerStartupCheck(shadow);
      }
      updateShadowDomMarker(shadow);
      return shadow;
    })
    .catch((error) => {
      shadow.status = 'error';
      shadow.error = String(error?.message || error || 'unknown');
      updateShadowDomMarker(shadow);
      return shadow;
    });
  return shadow.readyPromise;
}

function normalizeSeed(seed = 1) {
  const normalized = Number(seed || 1) >>> 0;
  return normalized || 1;
}

function createSeededRngFallback(seed = 1) {
  let state = normalizeSeed(seed);
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const COMBAT_SNAPSHOT_FAILURE_IDS = Object.freeze({
  INDEX_NOT_ARRAY: 'E_TURN_QUEUE_NOT_ARRAY',
  INDEX_OUT_OF_RANGE: 'E_CURRENT_INDEX_OUT_OF_RANGE',
  INDEX_INVALID_EMPTY: 'E_CURRENT_INDEX_INVALID_WITH_EMPTY_QUEUE',
  SCHEMA_INVALID: 'E_SNAPSHOT_SCHEMA_INVALID',
  RESUME_TOKEN_MISMATCH: 'E_RESUME_TOKEN_MISMATCH',
});

function combatSnapshotIndexFailureFromCode(code) {
  switch (Number(code || 0)) {
    case 1:
      return COMBAT_SNAPSHOT_FAILURE_IDS.INDEX_NOT_ARRAY;
    case 2:
      return COMBAT_SNAPSHOT_FAILURE_IDS.INDEX_OUT_OF_RANGE;
    case 3:
      return COMBAT_SNAPSHOT_FAILURE_IDS.INDEX_INVALID_EMPTY;
    default:
      return '';
  }
}

function normalizeCombatSnapshotFailures(failures) {
  return Array.isArray(failures) ? failures.map(String) : [];
}

function recordCombatSnapshotOwnerCheck(shadow, check) {
  if (!shadow) return check;
  shadow.combatSnapshotOwnerChecks = Number(shadow.combatSnapshotOwnerChecks || 0) + 1;
  shadow.lastCombatSnapshotOwnerCheck = check;
  updateShadowDomMarker(shadow);
  return check;
}

export function createSimulationCoreCombatSnapshotResolution({
  source = 'unknown',
  checkpointId = '',
  snapshotVersion = 1,
  hasTurnState = 1,
  turnQueueIsArray = 1,
  turnQueueLength = 0,
  currentActorIndex = 0,
  hasResumeToken = 0,
  hasExpectedToken = 0,
  capturedAtTick = 0,
  expectedCapturedAtTick = 0,
  expectedTurnQueueLength = 0,
  expectedCurrentActorIndex = 0,
  jsFailures = [],
} = {}, {
  exportsOverride = null,
} = {}) {
  const shadow = getShadowState();
  const exports = exportsOverride || shadow.exports;
  const normalized = {
    source,
    checkpointId: String(checkpointId || ''),
    snapshotVersion: Number(snapshotVersion || 0),
    hasTurnState: Number(hasTurnState || 0),
    turnQueueIsArray: Number(turnQueueIsArray || 0),
    turnQueueLength: Number(turnQueueLength || 0),
    currentActorIndex: Number(currentActorIndex || 0),
    hasResumeToken: Number(hasResumeToken || 0),
    hasExpectedToken: Number(hasExpectedToken || 0),
    capturedAtTick: Number(capturedAtTick || 0),
    expectedCapturedAtTick: Number(expectedCapturedAtTick || 0),
    expectedTurnQueueLength: Number(expectedTurnQueueLength || 0),
    expectedCurrentActorIndex: Number(expectedCurrentActorIndex || 0),
    jsFailures: normalizeCombatSnapshotFailures(jsFailures),
  };

  if (!hasCombatSnapshotExports(exports)) {
    return recordCombatSnapshotOwnerCheck(shadow, {
      ...normalized,
      owner: 'js',
      failures: normalized.jsFailures,
    });
  }

  const failures = [];
  if (normalized.checkpointId === 'CHK_PRE_SUSPEND' || normalized.checkpointId === 'CHK_POST_RESUME') {
    const indexFailure = combatSnapshotIndexFailureFromCode(exports.combat_snapshot_index_failure_code_shadow(
      normalized.turnQueueIsArray,
      normalized.turnQueueLength,
      normalized.currentActorIndex,
    ));
    if (indexFailure) failures.push(indexFailure);
  }

  if (normalized.checkpointId === 'CHK_SNAPSHOT_EMIT') {
    const schemaValid = Number(exports.combat_snapshot_schema_valid_shadow(
      normalized.snapshotVersion,
      normalized.hasTurnState,
      normalized.turnQueueIsArray,
      normalized.turnQueueLength,
      normalized.currentActorIndex,
      normalized.hasResumeToken,
    ));
    if (schemaValid !== 1) failures.push(COMBAT_SNAPSHOT_FAILURE_IDS.SCHEMA_INVALID);
  }

  if (normalized.checkpointId === 'CHK_POST_RESUME') {
    const resumeTokenValid = Number(exports.combat_snapshot_resume_token_valid_shadow(
      normalized.hasExpectedToken,
      normalized.capturedAtTick,
      normalized.turnQueueLength,
      normalized.currentActorIndex,
      normalized.expectedCapturedAtTick,
      normalized.expectedTurnQueueLength,
      normalized.expectedCurrentActorIndex,
    ));
    if (resumeTokenValid !== 1) failures.push(COMBAT_SNAPSHOT_FAILURE_IDS.RESUME_TOKEN_MISMATCH);
  }

  const check = {
    ...normalized,
    owner: 'rust',
    failures,
  };
  if (JSON.stringify(normalized.jsFailures) !== JSON.stringify(failures)) {
    shadow.mismatches.push({
      type: 'combatSnapshotOwner',
      source,
      checkpointId: normalized.checkpointId,
      jsFailures: normalized.jsFailures,
      rustFailures: failures,
    });
  }
  return recordCombatSnapshotOwnerCheck(shadow, check);
}

export function createSimulationCoreEffectiveStatResolution({
  source = 'unknown',
  stat = '',
  actorKind = '',
  base = 0,
  partyBuff = 0,
  enemyDebuff = 0,
  isHero = 0,
  isEnemy = 0,
  jsValue = 0,
} = {}, {
  exportsOverride = null,
} = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    stat: String(stat || '').toUpperCase(),
    actorKind: String(actorKind || ''),
    base: Number(base || 0),
    partyBuff: Number(partyBuff || 0),
    enemyDebuff: Number(enemyDebuff || 0),
    isHero: Number(isHero || 0),
    isEnemy: Number(isEnemy || 0),
    jsValue: Number(jsValue || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasEffectiveStatExports(exports)) {
    shadow.effectiveStatOwnerChecks = Number(shadow.effectiveStatOwnerChecks || 0) + 1;
    shadow.lastEffectiveStatOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      value: normalized.jsValue,
    };
    updateShadowDomMarker(shadow);
    return { owner: 'fallback', value: normalized.jsValue };
  }

  const rustValue = Number(exports.effective_stat_value_shadow(
    normalized.base,
    normalized.partyBuff,
    normalized.enemyDebuff,
    normalized.isHero,
    normalized.isEnemy,
  ));
  shadow.effectiveStatOwnerChecks = Number(shadow.effectiveStatOwnerChecks || 0) + 1;
  shadow.lastEffectiveStatOwnerCheck = {
    ...normalized,
    owner: 'rust',
    value: rustValue,
  };
  if (!exportsOverride && Math.abs(rustValue - normalized.jsValue) > 0.000001) {
    shadow.mismatches.push(shadow.lastEffectiveStatOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastEffectiveStatOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return { owner: 'rust', value: rustValue };
}

export function createSimulationCoreCombatOutcomeResolution({
  source = 'unknown',
  energy = 0,
  partyHp = 0,
  livingHeroes = 0,
  jsCode = 0,
} = {}, {
  exportsOverride = null,
} = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    energy: Number(energy || 0),
    partyHp: Number(partyHp || 0),
    livingHeroes: Number(livingHeroes || 0),
    jsCode: Number(jsCode || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasCombatOutcomeExports(exports)) {
    shadow.combatOutcomeOwnerChecks = Number(shadow.combatOutcomeOwnerChecks || 0) + 1;
    shadow.lastCombatOutcomeOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      code: normalized.jsCode,
    };
    updateShadowDomMarker(shadow);
    return { owner: 'fallback', code: normalized.jsCode };
  }

  const rustCode = Number(exports.combat_outcome_code_shadow(
    normalized.energy,
    normalized.partyHp,
    normalized.livingHeroes,
  ));
  shadow.combatOutcomeOwnerChecks = Number(shadow.combatOutcomeOwnerChecks || 0) + 1;
  shadow.lastCombatOutcomeOwnerCheck = {
    ...normalized,
    owner: 'rust',
    code: rustCode,
  };
  if (!exportsOverride && Math.abs(rustCode - normalized.jsCode) > 0.000001) {
    shadow.mismatches.push(shadow.lastCombatOutcomeOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastCombatOutcomeOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return { owner: 'rust', code: rustCode };
}

export function createSimulationCoreTurnActorEligibilityResolution({
  source = 'unknown',
  turnType = -1,
  actorExists = 0,
  actorHp = 0,
  partyHp = 0,
  roundActive = 0,
  pendingGroupMatches = 0,
  blueBuffSequenceActive = 0,
  jsCode = 0,
} = {}, {
  exportsOverride = null,
} = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    turnType: Number(turnType || 0),
    actorExists: Number(actorExists || 0),
    actorHp: Number(actorHp || 0),
    partyHp: Number(partyHp || 0),
    roundActive: Number(roundActive || 0),
    pendingGroupMatches: Number(pendingGroupMatches || 0),
    blueBuffSequenceActive: Number(blueBuffSequenceActive || 0),
    jsCode: Number(jsCode || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasTurnActorEligibilityExports(exports)) {
    shadow.turnActorEligibilityOwnerChecks = Number(shadow.turnActorEligibilityOwnerChecks || 0) + 1;
    shadow.lastTurnActorEligibilityOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      code: normalized.jsCode,
    };
    updateShadowDomMarker(shadow);
    return { owner: 'fallback', code: normalized.jsCode };
  }

  const rustCode = Number(exports.turn_actor_eligibility_code_shadow(
    normalized.turnType,
    normalized.actorExists,
    normalized.actorHp,
    normalized.partyHp,
    normalized.roundActive,
    normalized.pendingGroupMatches,
    normalized.blueBuffSequenceActive,
  ));
  shadow.turnActorEligibilityOwnerChecks = Number(shadow.turnActorEligibilityOwnerChecks || 0) + 1;
  shadow.lastTurnActorEligibilityOwnerCheck = {
    ...normalized,
    owner: 'rust',
    code: rustCode,
  };
  if (!exportsOverride && Math.abs(rustCode - normalized.jsCode) > 0.000001) {
    shadow.mismatches.push(shadow.lastTurnActorEligibilityOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastTurnActorEligibilityOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return { owner: 'rust', code: rustCode };
}

export function createSimulationCoreTurnPhaseAssignmentResolution({
  source = 'unknown',
  turnTypeCode = 0,
  jsTurnPhase = 0,
} = {}, {
  exportsOverride = null,
} = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    turnTypeCode: Number(turnTypeCode || 0) === 0 ? 0 : 1,
    jsTurnPhase: Number(jsTurnPhase || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasTurnPhaseAssignmentExports(exports)) {
    shadow.turnPhaseAssignmentOwnerChecks = Number(shadow.turnPhaseAssignmentOwnerChecks || 0) + 1;
    shadow.lastTurnPhaseAssignmentOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      turnPhase: normalized.jsTurnPhase,
    };
    updateShadowDomMarker(shadow);
    return { owner: 'fallback', turnPhase: normalized.jsTurnPhase };
  }

  const turnPhase = Number(exports.turn_phase_from_type_shadow(normalized.turnTypeCode));
  shadow.turnPhaseAssignmentOwnerChecks = Number(shadow.turnPhaseAssignmentOwnerChecks || 0) + 1;
  shadow.lastTurnPhaseAssignmentOwnerCheck = {
    ...normalized,
    owner: 'rust',
    turnPhase,
  };
  if (!exportsOverride && turnPhase !== normalized.jsTurnPhase) {
    shadow.mismatches.push(shadow.lastTurnPhaseAssignmentOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastTurnPhaseAssignmentOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return { owner: 'rust', turnPhase };
}

export function createSimulationCoreEnemySkillChoiceResolution({
  source = 'unknown',
  enemyKindCode = 0,
  hp = 0,
  maxHP = 1,
  damagedAlliesCount = 0,
  boardReady = 1,
  roll = 0,
  healRoll = 0,
  jsSelectedCode = 0,
  jsBranchCode = 0,
} = {}, {
  exportsOverride = null,
} = {}) {
  const shadow = getShadowState();
  const hpValue = Number(hp || 0);
  const maxValue = Math.max(1, Number(maxHP || hpValue || 1));
  const normalized = {
    source,
    enemyKindCode: Math.max(0, Math.trunc(Number(enemyKindCode || 0))),
    hp: hpValue,
    maxHP: maxValue,
    damagedAlliesCount: Math.max(0, Math.trunc(Number(damagedAlliesCount || 0))),
    boardReady: Number(boardReady || 0) === 1 ? 1 : 0,
    roll: Number(roll || 0),
    healRoll: Number(healRoll || 0),
    jsSelectedCode: Number(jsSelectedCode || 0),
    jsBranchCode: Number(jsBranchCode || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasEnemySkillChoiceExports(exports)) {
    shadow.enemySkillChoiceOwnerChecks = Number(shadow.enemySkillChoiceOwnerChecks || 0) + 1;
    shadow.lastEnemySkillChoiceOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      selectedCode: normalized.jsSelectedCode,
      branchCode: normalized.jsBranchCode,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      selectedCode: normalized.jsSelectedCode,
      branchCode: normalized.jsBranchCode,
    };
  }

  const selectedCode = Number(exports.enemy_skill_choice_selected_code_shadow(
    normalized.enemyKindCode,
    normalized.hp,
    normalized.maxHP,
    normalized.damagedAlliesCount,
    normalized.boardReady,
    normalized.roll,
    normalized.healRoll,
  ));
  const branchCode = Number(exports.enemy_skill_choice_branch_code_shadow(
    normalized.enemyKindCode,
    normalized.hp,
    normalized.maxHP,
    normalized.damagedAlliesCount,
    normalized.boardReady,
    normalized.roll,
    normalized.healRoll,
  ));
  shadow.enemySkillChoiceOwnerChecks = Number(shadow.enemySkillChoiceOwnerChecks || 0) + 1;
  shadow.lastEnemySkillChoiceOwnerCheck = {
    ...normalized,
    owner: 'rust',
    selectedCode,
    branchCode,
  };
  if (
    !exportsOverride
    && (selectedCode !== normalized.jsSelectedCode || branchCode !== normalized.jsBranchCode)
  ) {
    shadow.mismatches.push(shadow.lastEnemySkillChoiceOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastEnemySkillChoiceOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return { owner: 'rust', selectedCode, branchCode };
}

export function createSimulationCoreEnemyJobSkillResolution({
  source = 'unknown',
  skillCode = -1,
  enemyKindCode = 0,
  boardReady = 1,
  targetUID = 0,
  fallbackTargetUID = 0,
  jsNormalizedSkillCode = -1,
  jsActionCode = 0,
  jsResolvedTargetUID = 0,
  jsAllyTargetUID = 0,
  jsReturnValue = 0,
} = {}, {
  exportsOverride = null,
} = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    skillCode: Math.trunc(Number(skillCode ?? -1)),
    enemyKindCode: Math.max(0, Math.trunc(Number(enemyKindCode || 0))),
    boardReady: Number(boardReady || 0) === 1 ? 1 : 0,
    targetUID: Math.max(0, Math.trunc(Number(targetUID || 0))),
    fallbackTargetUID: Math.max(0, Math.trunc(Number(fallbackTargetUID || 0))),
    jsNormalizedSkillCode: Math.trunc(Number(jsNormalizedSkillCode ?? -1)),
    jsActionCode: Math.max(0, Math.trunc(Number(jsActionCode || 0))),
    jsResolvedTargetUID: Math.max(0, Math.trunc(Number(jsResolvedTargetUID || 0))),
    jsAllyTargetUID: Math.max(0, Math.trunc(Number(jsAllyTargetUID || 0))),
    jsReturnValue: Math.max(0, Math.trunc(Number(jsReturnValue || 0))),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasEnemyJobSkillExports(exports)) {
    shadow.enemyJobSkillOwnerChecks = Number(shadow.enemyJobSkillOwnerChecks || 0) + 1;
    shadow.lastEnemyJobSkillOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      normalizedSkillCode: normalized.jsNormalizedSkillCode,
      actionCode: normalized.jsActionCode,
      resolvedTargetUID: normalized.jsResolvedTargetUID,
      allyTargetUID: normalized.jsAllyTargetUID,
      returnValue: normalized.jsReturnValue,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      normalizedSkillCode: normalized.jsNormalizedSkillCode,
      actionCode: normalized.jsActionCode,
      resolvedTargetUID: normalized.jsResolvedTargetUID,
      allyTargetUID: normalized.jsAllyTargetUID,
      returnValue: normalized.jsReturnValue,
    };
  }

  const normalizedSkillCode = Number(exports.enemy_job_skill_normalized_code_shadow(
    normalized.skillCode,
    normalized.enemyKindCode,
    normalized.boardReady,
  ));
  const resolvedTargetUID = Number(exports.enemy_job_skill_resolved_target_uid_shadow(
    normalized.targetUID,
    normalized.fallbackTargetUID,
  ));
  const allyTargetUID = Number(exports.enemy_job_skill_ally_target_uid_shadow(
    normalized.targetUID,
  ));
  const actionCode = Number(exports.enemy_job_skill_action_code_shadow(
    normalizedSkillCode,
    resolvedTargetUID,
  ));
  const returnValue = Number(exports.enemy_job_skill_return_value_shadow(actionCode));
  const result = {
    owner: 'rust',
    normalizedSkillCode,
    actionCode,
    resolvedTargetUID,
    allyTargetUID,
    returnValue,
  };
  shadow.enemyJobSkillOwnerChecks = Number(shadow.enemyJobSkillOwnerChecks || 0) + 1;
  shadow.lastEnemyJobSkillOwnerCheck = {
    ...normalized,
    ...result,
  };
  if (
    !exportsOverride
    && (
      result.normalizedSkillCode !== normalized.jsNormalizedSkillCode
      || result.actionCode !== normalized.jsActionCode
      || result.resolvedTargetUID !== normalized.jsResolvedTargetUID
      || result.allyTargetUID !== normalized.jsAllyTargetUID
      || result.returnValue !== normalized.jsReturnValue
    )
  ) {
    shadow.mismatches.push(shadow.lastEnemyJobSkillOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastEnemyJobSkillOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return result;
}

export function createSimulationCoreStartEnemyActionResolution({
  source = 'unknown',
  enemyExists = 0,
  enemyUID = 0,
  targetUID = 0,
  skillCode = -1,
  originX = 0,
  jsActive = 0,
  jsStateCode = 0,
  jsTargetUID = 0,
  jsSkillCode = -1,
  jsForwardX = 0,
} = {}, {
  exportsOverride = null,
} = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    enemyExists: Number(enemyExists || 0) ? 1 : 0,
    enemyUID: Math.max(0, Math.trunc(Number(enemyUID || 0))),
    targetUID: Math.max(0, Math.trunc(Number(targetUID || 0))),
    skillCode: Math.trunc(Number(skillCode ?? -1)),
    originX: Number(originX || 0),
    jsActive: Number(jsActive || 0) ? 1 : 0,
    jsStateCode: Math.max(0, Math.trunc(Number(jsStateCode || 0))),
    jsTargetUID: Math.max(0, Math.trunc(Number(jsTargetUID || 0))),
    jsSkillCode: Math.trunc(Number(jsSkillCode ?? -1)),
    jsForwardX: Number(jsForwardX || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasStartEnemyActionExports(exports)) {
    shadow.startEnemyActionOwnerChecks = Number(shadow.startEnemyActionOwnerChecks || 0) + 1;
    shadow.lastStartEnemyActionOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      active: normalized.jsActive,
      stateCode: normalized.jsStateCode,
      uid: normalized.enemyUID,
      targetUID: normalized.jsTargetUID,
      skillCode: normalized.jsSkillCode,
      forwardX: normalized.jsForwardX,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      active: normalized.jsActive,
      stateCode: normalized.jsStateCode,
      uid: normalized.enemyUID,
      targetUID: normalized.jsTargetUID,
      skillCode: normalized.jsSkillCode,
      forwardX: normalized.jsForwardX,
      timer: 0,
      actionApplied: 0,
    };
  }

  const active = Number(exports.start_enemy_action_active_shadow(normalized.enemyExists));
  const result = {
    owner: 'rust',
    active,
    stateCode: Number(exports.start_enemy_action_state_code_shadow(normalized.enemyExists)),
    uid: Number(exports.start_enemy_action_uid_shadow(normalized.enemyExists, normalized.enemyUID)),
    targetUID: Number(exports.start_enemy_action_target_uid_shadow(normalized.enemyExists, normalized.targetUID)),
    skillCode: Number(exports.start_enemy_action_skill_code_shadow(normalized.enemyExists, normalized.skillCode)),
    forwardX: Number(exports.start_enemy_action_forward_x_shadow(normalized.enemyExists, normalized.originX)),
    timer: 0,
    actionApplied: 0,
  };
  shadow.startEnemyActionOwnerChecks = Number(shadow.startEnemyActionOwnerChecks || 0) + 1;
  shadow.lastStartEnemyActionOwnerCheck = {
    ...normalized,
    ...result,
  };
  if (
    !exportsOverride
    && (
      result.active !== normalized.jsActive
      || result.stateCode !== normalized.jsStateCode
      || result.targetUID !== normalized.jsTargetUID
      || result.skillCode !== normalized.jsSkillCode
      || Math.abs(result.forwardX - normalized.jsForwardX) > 0.000001
    )
  ) {
    shadow.mismatches.push(shadow.lastStartEnemyActionOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastStartEnemyActionOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return result;
}

export function createSimulationCoreEnemyTurnFlowResolution({
  source = 'unknown',
  activeEnemyUID = 0,
  enemyExists = 0,
  enemyHp = 0,
  jsTurnPhase = 2,
  jsActionCode = 1,
  jsActiveEnemyUID = 0,
} = {}, {
  exportsOverride = null,
} = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    activeEnemyUID: Math.max(0, Math.trunc(Number(activeEnemyUID || 0))),
    enemyExists: Number(enemyExists || 0) ? 1 : 0,
    enemyHp: Number(enemyHp || 0),
    jsTurnPhase: Math.trunc(Number(jsTurnPhase || 2)),
    jsActionCode: Math.max(0, Math.trunc(Number(jsActionCode || 0))),
    jsActiveEnemyUID: Math.max(0, Math.trunc(Number(jsActiveEnemyUID || 0))),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasEnemyTurnFlowExports(exports)) {
    shadow.enemyTurnFlowOwnerChecks = Number(shadow.enemyTurnFlowOwnerChecks || 0) + 1;
    shadow.lastEnemyTurnFlowOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      turnPhase: normalized.jsTurnPhase,
      actionCode: normalized.jsActionCode,
      activeEnemyUID: normalized.jsActiveEnemyUID,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      turnPhase: normalized.jsTurnPhase,
      actionCode: normalized.jsActionCode,
      activeEnemyUID: normalized.jsActiveEnemyUID,
      shouldAdvance: normalized.jsActionCode === 1 ? 1 : 0,
      shouldStartAction: normalized.jsActionCode === 2 ? 1 : 0,
    };
  }

  const actionCode = Number(exports.enemy_turn_flow_action_code_shadow(
    normalized.activeEnemyUID,
    normalized.enemyExists,
    normalized.enemyHp,
  ));
  const result = {
    owner: 'rust',
    activeEnemyUID: Number(exports.enemy_turn_flow_active_uid_shadow(normalized.activeEnemyUID)),
    turnPhase: Number(exports.enemy_turn_flow_turn_phase_shadow()),
    actionCode,
    shouldAdvance: Number(exports.enemy_turn_flow_should_advance_shadow(actionCode)),
    shouldStartAction: Number(exports.enemy_turn_flow_should_start_action_shadow(actionCode)),
  };
  shadow.enemyTurnFlowOwnerChecks = Number(shadow.enemyTurnFlowOwnerChecks || 0) + 1;
  shadow.lastEnemyTurnFlowOwnerCheck = {
    ...normalized,
    ...result,
  };
  if (
    !exportsOverride
    && (
      result.turnPhase !== normalized.jsTurnPhase
      || result.actionCode !== normalized.jsActionCode
      || result.activeEnemyUID !== normalized.jsActiveEnemyUID
    )
  ) {
    shadow.mismatches.push(shadow.lastEnemyTurnFlowOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastEnemyTurnFlowOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return result;
}

export function createSimulationCoreHeroTurnEntryResolution({
  source = 'unknown',
  heroUID = 0,
  currentHeroUIDBefore = 0,
  skillDraughtOpen = 0,
  astralFlowAmpPoints = 0,
  astralFlowAmpMax = 18,
  astralFlowAmpReady = 0,
  time = 0,
  combatActionPinnedUntil = 0,
  jsTurnPhase = 0,
  jsHideHeroSelector = 0,
  jsAcceptHeroUID = 0,
  jsCurrentHeroUIDAfter = 0,
  jsShouldResetAstralFlowAmp = 0,
  jsAstralFlowAmpPointsAfter = 0,
  jsAstralFlowAmpReadyAfter = 0,
  jsClearCombatActionPinned = 0,
} = {}, {
  exportsOverride = null,
} = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    heroUID: Math.max(0, Math.trunc(Number(heroUID || 0))),
    currentHeroUIDBefore: Math.max(0, Math.trunc(Number(currentHeroUIDBefore || 0))),
    skillDraughtOpen: Number(skillDraughtOpen || 0) ? 1 : 0,
    astralFlowAmpPoints: Math.max(0, Number(astralFlowAmpPoints || 0)),
    astralFlowAmpMax: Math.max(1, Number(astralFlowAmpMax || 18)),
    astralFlowAmpReady: Number(astralFlowAmpReady || 0) ? 1 : 0,
    time: Number(time || 0),
    combatActionPinnedUntil: Number(combatActionPinnedUntil || 0),
    jsTurnPhase: Math.trunc(Number(jsTurnPhase || 0)),
    jsHideHeroSelector: Number(jsHideHeroSelector || 0) ? 1 : 0,
    jsAcceptHeroUID: Number(jsAcceptHeroUID || 0) ? 1 : 0,
    jsCurrentHeroUIDAfter: Math.max(0, Math.trunc(Number(jsCurrentHeroUIDAfter || 0))),
    jsShouldResetAstralFlowAmp: Number(jsShouldResetAstralFlowAmp || 0) ? 1 : 0,
    jsAstralFlowAmpPointsAfter: Math.max(0, Number(jsAstralFlowAmpPointsAfter || 0)),
    jsAstralFlowAmpReadyAfter: Number(jsAstralFlowAmpReadyAfter || 0) ? 1 : 0,
    jsClearCombatActionPinned: Number(jsClearCombatActionPinned || 0) ? 1 : 0,
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasHeroTurnEntryExports(exports)) {
    shadow.heroTurnEntryOwnerChecks = Number(shadow.heroTurnEntryOwnerChecks || 0) + 1;
    shadow.lastHeroTurnEntryOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      turnPhase: normalized.jsTurnPhase,
      hideHeroSelector: normalized.jsHideHeroSelector,
      acceptHeroUID: normalized.jsAcceptHeroUID,
      currentHeroUIDAfter: normalized.jsCurrentHeroUIDAfter,
      shouldResetAstralFlowAmp: normalized.jsShouldResetAstralFlowAmp,
      astralFlowAmpPointsAfter: normalized.jsAstralFlowAmpPointsAfter,
      astralFlowAmpReadyAfter: normalized.jsAstralFlowAmpReadyAfter,
      clearCombatActionPinned: normalized.jsClearCombatActionPinned,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      turnPhase: normalized.jsTurnPhase,
      hideHeroSelector: normalized.jsHideHeroSelector,
      acceptHeroUID: normalized.jsAcceptHeroUID,
      currentHeroUIDAfter: normalized.jsCurrentHeroUIDAfter,
      shouldResetAstralFlowAmp: normalized.jsShouldResetAstralFlowAmp,
      astralFlowAmpPointsAfter: normalized.jsAstralFlowAmpPointsAfter,
      astralFlowAmpReadyAfter: normalized.jsAstralFlowAmpReadyAfter,
      clearCombatActionPinned: normalized.jsClearCombatActionPinned,
    };
  }

  const shouldReset = Number(exports.hero_turn_entry_should_reset_astral_flow_shadow(
    normalized.skillDraughtOpen,
    normalized.astralFlowAmpReady,
    normalized.astralFlowAmpPoints,
    normalized.astralFlowAmpMax,
    normalized.time,
    normalized.combatActionPinnedUntil,
  ));
  const result = {
    owner: 'rust',
    turnPhase: Number(exports.hero_turn_entry_turn_phase_shadow()),
    hideHeroSelector: Number(exports.hero_turn_entry_hide_hero_selector_shadow()),
    acceptHeroUID: Number(exports.hero_turn_entry_accept_hero_uid_shadow(normalized.heroUID)),
    currentHeroUIDAfter: Number(exports.hero_turn_entry_current_hero_uid_after_shadow(
      normalized.heroUID,
      normalized.currentHeroUIDBefore,
    )),
    shouldResetAstralFlowAmp: shouldReset,
    astralFlowAmpPointsAfter: Number(exports.hero_turn_entry_amp_points_after_shadow(
      normalized.skillDraughtOpen,
      normalized.astralFlowAmpReady,
      normalized.astralFlowAmpPoints,
      normalized.astralFlowAmpMax,
      normalized.time,
      normalized.combatActionPinnedUntil,
    )),
    astralFlowAmpReadyAfter: Number(exports.hero_turn_entry_amp_ready_after_shadow(
      normalized.skillDraughtOpen,
      normalized.astralFlowAmpReady,
      normalized.astralFlowAmpPoints,
      normalized.astralFlowAmpMax,
      normalized.time,
      normalized.combatActionPinnedUntil,
    )),
    clearCombatActionPinned: Number(exports.hero_turn_entry_clear_pinned_action_shadow(shouldReset)),
  };
  shadow.heroTurnEntryOwnerChecks = Number(shadow.heroTurnEntryOwnerChecks || 0) + 1;
  shadow.lastHeroTurnEntryOwnerCheck = {
    ...normalized,
    ...result,
  };
  if (
    !exportsOverride
    && (
      result.turnPhase !== normalized.jsTurnPhase
      || result.hideHeroSelector !== normalized.jsHideHeroSelector
      || result.acceptHeroUID !== normalized.jsAcceptHeroUID
      || result.currentHeroUIDAfter !== normalized.jsCurrentHeroUIDAfter
      || result.shouldResetAstralFlowAmp !== normalized.jsShouldResetAstralFlowAmp
      || Math.abs(result.astralFlowAmpPointsAfter - normalized.jsAstralFlowAmpPointsAfter) > 0.000001
      || result.astralFlowAmpReadyAfter !== normalized.jsAstralFlowAmpReadyAfter
      || result.clearCombatActionPinned !== normalized.jsClearCombatActionPinned
    )
  ) {
    shadow.mismatches.push(shadow.lastHeroTurnEntryOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastHeroTurnEntryOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return result;
}

function normalizeEnemyTargetHeroes(heroes = []) {
  const source = Array.isArray(heroes) ? heroes : [];
  return Array.from({ length: 4 }, (_, index) => {
    const hero = source[index] || {};
    const hp = Math.max(0, Number(hero?.hp || 0));
    return {
      uid: Math.max(0, Math.trunc(Number(hero?.uid || 0))),
      hp,
      maxHP: Math.max(1, Number(hero?.maxHP ?? hp ?? 1)),
      atk: Number(hero?.atk ?? hero?.stats?.ATK ?? 0),
      slot: Number(hero?.slot ?? hero?.slotIndex ?? hero?.displaySlot ?? index),
      roleCode: Number(hero?.roleCode || 0) === 1 ? 1 : 0,
    };
  });
}

function flattenEnemyTargetHeroes(heroes = []) {
  return normalizeEnemyTargetHeroes(heroes).flatMap((hero) => [
    hero.uid,
    hero.hp,
    hero.maxHP,
    hero.atk,
    hero.slot,
    hero.roleCode,
  ]);
}

export function createSimulationCoreEnemyTargetResolution({
  source = 'unknown',
  preferenceCode = 0,
  roll = 0,
  heroes = [],
  jsTargetUID = 0,
  jsModeCode = 0,
  jsRollIndex = 0,
} = {}, {
  exportsOverride = null,
} = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    preferenceCode: Math.max(0, Math.trunc(Number(preferenceCode || 0))),
    roll: Number(roll || 0),
    heroes: normalizeEnemyTargetHeroes(heroes),
    jsTargetUID: Number(jsTargetUID || 0),
    jsModeCode: Number(jsModeCode || 0),
    jsRollIndex: Number(jsRollIndex || 0),
  };
  const args = [
    normalized.preferenceCode,
    normalized.roll,
    ...flattenEnemyTargetHeroes(normalized.heroes),
  ];
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasEnemyTargetExports(exports)) {
    shadow.enemyTargetOwnerChecks = Number(shadow.enemyTargetOwnerChecks || 0) + 1;
    shadow.lastEnemyTargetOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      targetUID: normalized.jsTargetUID,
      modeCode: normalized.jsModeCode,
      rollIndex: normalized.jsRollIndex,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      targetUID: normalized.jsTargetUID,
      modeCode: normalized.jsModeCode,
      rollIndex: normalized.jsRollIndex,
    };
  }

  const targetUID = Number(exports.enemy_target_selected_uid_shadow(...args));
  const modeCode = Number(exports.enemy_target_mode_code_shadow(...args));
  const rollIndex = Number(exports.enemy_target_roll_index_shadow(...args));
  shadow.enemyTargetOwnerChecks = Number(shadow.enemyTargetOwnerChecks || 0) + 1;
  shadow.lastEnemyTargetOwnerCheck = {
    ...normalized,
    owner: 'rust',
    targetUID,
    modeCode,
    rollIndex,
  };
  if (
    !exportsOverride
    && (
      targetUID !== normalized.jsTargetUID
      || modeCode !== normalized.jsModeCode
      || rollIndex !== normalized.jsRollIndex
    )
  ) {
    shadow.mismatches.push(shadow.lastEnemyTargetOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastEnemyTargetOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return { owner: 'rust', targetUID, modeCode, rollIndex };
}

function normalizeTurnOrderGroupPhaseType(value = 0) {
  return Number(value || 0) === 1 ? 1 : 0;
}

function normalizeTurnOrderGroupRoster(roster = []) {
  if (!Array.isArray(roster)) return [];
  return roster
    .map(actor => ({
      uid: Number(actor?.uid || 0),
      type: normalizeTurnOrderGroupPhaseType(actor?.type),
      spd: Number(actor?.spd || 0),
      extra: !!actor?.extra,
      hp: Number.isNaN(Number(actor?.hp)) ? 1 : Number(actor?.hp ?? 1),
      isAlive: actor?.isAlive === false ? 0 : 1,
      ableToAct: actor?.ableToAct === false ? 0 : 1,
      disabled: Number(actor?.disabled || 0) ? 1 : 0,
      stunned: Number(actor?.stunned || 0) ? 1 : 0,
      stopped: Number(actor?.stopped || 0) ? 1 : 0,
      paralyzed: Number(actor?.paralyzed || 0) ? 1 : 0,
      statusBlocked: Number(actor?.statusBlocked || 0) ? 1 : 0,
    }))
    .filter(actor => actor.uid > 0);
}

function normalizeTurnOrderGroupMembers(members = []) {
  if (!Array.isArray(members)) return [];
  return members
    .map(member => ({
      uid: Number(member?.uid || 0),
      type: normalizeTurnOrderGroupPhaseType(member?.type),
      spd: Number(member?.spd || 0),
      extra: !!member?.extra,
    }))
    .filter(member => member.uid > 0);
}

function turnOrderMembersMatch(a = [], b = []) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (Number(a[i]?.uid || 0) !== Number(b[i]?.uid || 0)) return false;
    if (Number(a[i]?.type || 0) !== Number(b[i]?.type || 0)) return false;
    if (Number(a[i]?.spd || 0) !== Number(b[i]?.spd || 0)) return false;
  }
  return true;
}

function rustTurnOrderActorInPhase(exports, actor, phaseType) {
  return Number(exports.turn_order_actor_in_phase_shadow(
    actor.type,
    phaseType,
    actor.uid,
    actor.hp,
    actor.isAlive,
    actor.ableToAct,
    actor.disabled,
    actor.stunned,
    actor.stopped,
    actor.paralyzed,
    actor.statusBlocked,
  ));
}

export function createSimulationCoreTurnOrderGroupProjection({
  source = 'unknown',
  requestedPhaseType = 0,
  roster = [],
  jsPhaseType = 0,
  jsMembers = [],
} = {}, {
  exportsOverride = null,
} = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    requestedPhaseType: normalizeTurnOrderGroupPhaseType(requestedPhaseType),
    roster: normalizeTurnOrderGroupRoster(roster),
    jsPhaseType: normalizeTurnOrderGroupPhaseType(jsPhaseType),
    jsMembers: normalizeTurnOrderGroupMembers(jsMembers),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasTurnOrderGroupExports(exports)) {
    shadow.turnOrderGroupOwnerChecks = Number(shadow.turnOrderGroupOwnerChecks || 0) + 1;
    shadow.lastTurnOrderGroupOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      phaseType: normalized.jsPhaseType,
      members: normalized.jsMembers,
    };
    updateShadowDomMarker(shadow);
    return { owner: 'fallback', phaseType: normalized.jsPhaseType, members: normalized.jsMembers };
  }

  const requestedCount = normalized.roster.reduce((total, actor) => (
    total + rustTurnOrderActorInPhase(exports, actor, normalized.requestedPhaseType)
  ), 0);
  const alternatePhaseType = normalized.requestedPhaseType === 1 ? 0 : 1;
  const alternateCount = normalized.roster.reduce((total, actor) => (
    total + rustTurnOrderActorInPhase(exports, actor, alternatePhaseType)
  ), 0);
  const phaseType = normalizeTurnOrderGroupPhaseType(exports.turn_order_phase_type_shadow(
    normalized.requestedPhaseType,
    requestedCount,
    alternateCount,
  ));
  const members = normalized.roster
    .filter(actor => rustTurnOrderActorInPhase(exports, actor, phaseType) === 1)
    .map(actor => ({
      uid: actor.uid,
      type: actor.type,
      spd: actor.spd,
      extra: actor.extra,
    }))
    .sort((a, b) => Number(exports.turn_order_compare_slots_shadow(
      a.uid,
      a.type,
      a.spd,
      b.uid,
      b.type,
      b.spd,
    )));

  shadow.turnOrderGroupOwnerChecks = Number(shadow.turnOrderGroupOwnerChecks || 0) + 1;
  shadow.lastTurnOrderGroupOwnerCheck = {
    ...normalized,
    owner: 'rust',
    phaseType,
    members,
    requestedCount,
    alternateCount,
  };
  if (
    !exportsOverride
    && (
      phaseType !== normalized.jsPhaseType
      || !turnOrderMembersMatch(members, normalized.jsMembers)
    )
  ) {
    shadow.mismatches.push(shadow.lastTurnOrderGroupOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastTurnOrderGroupOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return { owner: 'rust', phaseType, members };
}

export function createSimulationCoreRoundPointerAdvanceResolution({
  source = 'unknown',
  roundMemberIndex = 0,
  groupMemberCount = 0,
  roundGroupIndex = 0,
  groupCount = 0,
  teamPhaseType = 0,
  jsCode = 0,
  jsNextMemberIndex = 0,
  jsGroupComplete = 0,
  jsNextGroupIndex = 0,
  jsRoundComplete = 0,
  jsNextTeamPhaseType = 0,
} = {}, {
  exportsOverride = null,
} = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    roundMemberIndex: Math.max(0, Math.trunc(Number(roundMemberIndex || 0))),
    groupMemberCount: Math.max(0, Math.trunc(Number(groupMemberCount || 0))),
    roundGroupIndex: Math.max(0, Math.trunc(Number(roundGroupIndex || 0))),
    groupCount: Math.max(0, Math.trunc(Number(groupCount || 0))),
    teamPhaseType: Number(teamPhaseType || 0) === 1 ? 1 : 0,
    jsCode: Number(jsCode || 0),
    jsNextMemberIndex: Number(jsNextMemberIndex || 0),
    jsGroupComplete: Number(jsGroupComplete || 0) ? 1 : 0,
    jsNextGroupIndex: Number(jsNextGroupIndex || 0),
    jsRoundComplete: Number(jsRoundComplete || 0) ? 1 : 0,
    jsNextTeamPhaseType: Number(jsNextTeamPhaseType || 0) === 1 ? 1 : 0,
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasRoundPointerAdvanceExports(exports)) {
    shadow.roundPointerAdvanceOwnerChecks = Number(shadow.roundPointerAdvanceOwnerChecks || 0) + 1;
    shadow.lastRoundPointerAdvanceOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      code: normalized.jsCode,
      nextMemberIndex: normalized.jsNextMemberIndex,
      groupComplete: normalized.jsGroupComplete,
      nextGroupIndex: normalized.jsNextGroupIndex,
      roundComplete: normalized.jsRoundComplete,
      nextTeamPhaseType: normalized.jsNextTeamPhaseType,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      code: normalized.jsCode,
      nextMemberIndex: normalized.jsNextMemberIndex,
      groupComplete: normalized.jsGroupComplete,
      nextGroupIndex: normalized.jsNextGroupIndex,
      roundComplete: normalized.jsRoundComplete,
      nextTeamPhaseType: normalized.jsNextTeamPhaseType,
    };
  }

  const nextMemberIndex = Number(exports.round_pointer_next_member_index_shadow(normalized.roundMemberIndex));
  const groupComplete = Number(exports.round_pointer_group_complete_shadow(nextMemberIndex, normalized.groupMemberCount));
  const nextGroupIndex = Number(exports.round_pointer_next_group_index_shadow(normalized.roundGroupIndex));
  const roundComplete = Number(exports.round_pointer_round_complete_shadow(
    nextGroupIndex,
    normalized.groupCount,
    groupComplete,
  ));
  const nextTeamPhaseType = Number(exports.round_pointer_next_team_phase_type_shadow(normalized.teamPhaseType));
  const code = Number(exports.round_pointer_advance_code_shadow(groupComplete, roundComplete));

  shadow.roundPointerAdvanceOwnerChecks = Number(shadow.roundPointerAdvanceOwnerChecks || 0) + 1;
  shadow.lastRoundPointerAdvanceOwnerCheck = {
    ...normalized,
    owner: 'rust',
    code,
    nextMemberIndex,
    groupComplete,
    nextGroupIndex,
    roundComplete,
    nextTeamPhaseType,
  };
  if (
    !exportsOverride
    && (
      code !== normalized.jsCode
      || nextMemberIndex !== normalized.jsNextMemberIndex
      || groupComplete !== normalized.jsGroupComplete
      || nextGroupIndex !== normalized.jsNextGroupIndex
      || roundComplete !== normalized.jsRoundComplete
      || nextTeamPhaseType !== normalized.jsNextTeamPhaseType
    )
  ) {
    shadow.mismatches.push(shadow.lastRoundPointerAdvanceOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastRoundPointerAdvanceOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return { owner: 'rust', code, nextMemberIndex, groupComplete, nextGroupIndex, roundComplete, nextTeamPhaseType };
}

export function createSimulationCoreGemActionResolution({
  source = 'unknown',
  gemColor = -1,
  consumedCount = 0,
  astralFlowWallet = 0,
  astralFlowAmpPoints = 0,
  astralFlowAmpMax = 18,
  astralFlowAmpReady = 0,
  time = 0,
  actionLockUntil = 0,
  textAnimEndAt = 0,
  purpleRoll01 = 0.5,
  jsRouteCode = -1,
  jsPendingSkillCode = 0,
  jsSetIsAoe = 0,
  jsIsAoe = 0,
  jsShowAttackUi = 0,
  jsCallCode = 0,
  jsConsumesTurn = 0,
  jsConsumedCount = 0,
  jsBlueWalletAfter = 0,
  jsBlueAmpPointsAfter = 0,
  jsBlueAmpReadyAfter = 0,
  jsBlueOpenDraught = 0,
  jsActionLockUntil = 0,
  jsPurpleEnergyAmount = 0,
} = {}, {
  exportsOverride = null,
} = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    gemColor: Number(gemColor || 0),
    consumedCount: Math.max(0, Math.floor(Number(consumedCount || 0))),
    astralFlowWallet: Number(astralFlowWallet || 0),
    astralFlowAmpPoints: Number(astralFlowAmpPoints || 0),
    astralFlowAmpMax: Math.max(1, Math.floor(Number(astralFlowAmpMax || 18))),
    astralFlowAmpReady: Number(astralFlowAmpReady || 0) ? 1 : 0,
    time: Number(time || 0),
    actionLockUntil: Number(actionLockUntil || 0),
    textAnimEndAt: Number(textAnimEndAt || 0),
    purpleRoll01: Number.isFinite(Number(purpleRoll01)) ? Number(purpleRoll01) : 0.5,
    jsRouteCode: Number(jsRouteCode || 0),
    jsPendingSkillCode: Number(jsPendingSkillCode || 0),
    jsSetIsAoe: Number(jsSetIsAoe || 0) ? 1 : 0,
    jsIsAoe: Number(jsIsAoe || 0) ? 1 : 0,
    jsShowAttackUi: Number(jsShowAttackUi || 0) ? 1 : 0,
    jsCallCode: Number(jsCallCode || 0),
    jsConsumesTurn: Number(jsConsumesTurn || 0) ? 1 : 0,
    jsConsumedCount: Number(jsConsumedCount || 0),
    jsBlueWalletAfter: Number(jsBlueWalletAfter || 0),
    jsBlueAmpPointsAfter: Number(jsBlueAmpPointsAfter || 0),
    jsBlueAmpReadyAfter: Number(jsBlueAmpReadyAfter || 0) ? 1 : 0,
    jsBlueOpenDraught: Number(jsBlueOpenDraught || 0) ? 1 : 0,
    jsActionLockUntil: Number(jsActionLockUntil || 0),
    jsPurpleEnergyAmount: Number(jsPurpleEnergyAmount || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasGemActionExports(exports)) {
    shadow.gemActionOwnerChecks = Number(shadow.gemActionOwnerChecks || 0) + 1;
    shadow.lastGemActionOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      routeCode: normalized.jsRouteCode,
      pendingSkillCode: normalized.jsPendingSkillCode,
      setIsAoe: normalized.jsSetIsAoe,
      isAoe: normalized.jsIsAoe,
      showAttackUi: normalized.jsShowAttackUi,
      callCode: normalized.jsCallCode,
      consumesTurn: normalized.jsConsumesTurn,
      consumedCount: normalized.jsConsumedCount,
      blueWalletAfter: normalized.jsBlueWalletAfter,
      blueAmpPointsAfter: normalized.jsBlueAmpPointsAfter,
      blueAmpReadyAfter: normalized.jsBlueAmpReadyAfter,
      blueOpenDraught: normalized.jsBlueOpenDraught,
      actionLockUntil: normalized.jsActionLockUntil,
      purpleEnergyAmount: normalized.jsPurpleEnergyAmount,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      routeCode: normalized.jsRouteCode,
      pendingSkillCode: normalized.jsPendingSkillCode,
      setIsAoe: normalized.jsSetIsAoe,
      isAoe: normalized.jsIsAoe,
      showAttackUi: normalized.jsShowAttackUi,
      callCode: normalized.jsCallCode,
      consumesTurn: normalized.jsConsumesTurn,
      consumedCount: normalized.jsConsumedCount,
      blueWalletAfter: normalized.jsBlueWalletAfter,
      blueAmpPointsAfter: normalized.jsBlueAmpPointsAfter,
      blueAmpReadyAfter: normalized.jsBlueAmpReadyAfter,
      blueOpenDraught: normalized.jsBlueOpenDraught,
      actionLockUntil: normalized.jsActionLockUntil,
      purpleEnergyAmount: normalized.jsPurpleEnergyAmount,
    };
  }

  const routeCode = Number(exports.gem_action_route_code_shadow(normalized.gemColor));
  const blueOpenDraught = Number(exports.gem_action_blue_open_draught_shadow(
    normalized.consumedCount,
    normalized.astralFlowAmpPoints,
    normalized.astralFlowAmpMax,
    normalized.astralFlowAmpReady,
  ));
  const result = {
    owner: 'rust',
    routeCode,
    pendingSkillCode: Number(exports.gem_action_pending_skill_code_shadow(routeCode)),
    setIsAoe: Number(exports.gem_action_set_aoe_shadow(routeCode)),
    isAoe: Number(exports.gem_action_is_aoe_shadow(routeCode)),
    showAttackUi: Number(exports.gem_action_show_attack_ui_shadow(routeCode)),
    callCode: Number(exports.gem_action_call_code_shadow(routeCode)),
    consumesTurn: Number(exports.gem_action_consumes_turn_shadow(routeCode)),
    consumedCount: Number(exports.gem_action_consumed_count_shadow(normalized.consumedCount)),
    blueWalletAfter: Number(exports.gem_action_blue_wallet_after_shadow(
      normalized.astralFlowWallet,
      normalized.consumedCount,
    )),
    blueAmpPointsAfter: Number(exports.gem_action_blue_amp_points_after_shadow(
      normalized.consumedCount,
      normalized.astralFlowAmpPoints,
      normalized.astralFlowAmpMax,
      normalized.astralFlowAmpReady,
    )),
    blueAmpReadyAfter: Number(exports.gem_action_blue_amp_ready_after_shadow(
      normalized.consumedCount,
      normalized.astralFlowAmpPoints,
      normalized.astralFlowAmpMax,
      normalized.astralFlowAmpReady,
    )),
    blueOpenDraught,
    actionLockUntil: Number(exports.gem_action_action_lock_until_shadow(
      routeCode,
      normalized.actionLockUntil,
      normalized.time,
      normalized.textAnimEndAt,
      blueOpenDraught,
    )),
    purpleEnergyAmount: Number(exports.gem_action_purple_energy_amount_shadow(normalized.purpleRoll01)),
  };

  shadow.gemActionOwnerChecks = Number(shadow.gemActionOwnerChecks || 0) + 1;
  shadow.lastGemActionOwnerCheck = {
    ...normalized,
    ...result,
  };
  if (
    !exportsOverride
    && (
      result.routeCode !== normalized.jsRouteCode
      || result.pendingSkillCode !== normalized.jsPendingSkillCode
      || result.setIsAoe !== normalized.jsSetIsAoe
      || result.isAoe !== normalized.jsIsAoe
      || result.showAttackUi !== normalized.jsShowAttackUi
      || result.callCode !== normalized.jsCallCode
      || result.consumesTurn !== normalized.jsConsumesTurn
      || result.consumedCount !== normalized.jsConsumedCount
      || result.blueWalletAfter !== normalized.jsBlueWalletAfter
      || result.blueAmpPointsAfter !== normalized.jsBlueAmpPointsAfter
      || result.blueAmpReadyAfter !== normalized.jsBlueAmpReadyAfter
      || result.blueOpenDraught !== normalized.jsBlueOpenDraught
      || Math.abs(result.actionLockUntil - normalized.jsActionLockUntil) > 0.000001
      || result.purpleEnergyAmount !== normalized.jsPurpleEnergyAmount
    )
  ) {
    shadow.mismatches.push(shadow.lastGemActionOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastGemActionOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return result;
}

export function createSimulationCoreSeededRng(seed = 1, {
  source = 'simulationCore.seededRng',
  exportsOverride = null,
} = {}) {
  const normalizedSeed = normalizeSeed(seed);
  const fallback = createSeededRngFallback(normalizedSeed);
  let draws = 0;
  return () => {
    draws += 1;
    const fallbackValue = fallback();
    const shadow = getShadowState();
    const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
    if (!hasSeededRngExports(exports)) {
      shadow.seededRngOwnerChecks = Number(shadow.seededRngOwnerChecks || 0) + 1;
      shadow.lastSeededRngOwnerCheck = {
        source,
        owner: 'fallback',
        seed: normalizedSeed,
        draws,
        value: fallbackValue,
      };
      updateShadowDomMarker(shadow);
      return fallbackValue;
    }

    const rustState = Number(exports.seeded_rng_next_state_shadow(normalizedSeed, draws));
    const rustValue = Number(exports.seeded_rng_next_value_shadow(normalizedSeed, draws));
    shadow.seededRngOwnerChecks = Number(shadow.seededRngOwnerChecks || 0) + 1;
    shadow.lastSeededRngOwnerCheck = {
      source,
      owner: 'rust',
      seed: normalizedSeed,
      draws,
      fallbackValue,
      rustState,
      rustValue,
    };
    if (Math.abs(rustValue - fallbackValue) > 0.000001 && !exportsOverride) {
      shadow.mismatches.push(shadow.lastSeededRngOwnerCheck);
      if (shadow.mismatches.length > 20) shadow.mismatches.shift();
      console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastSeededRngOwnerCheck);
    }
    updateShadowDomMarker(shadow);
    return rustValue;
  };
}

export function shadowCombatPower({ source = 'unknown', atk = 0, def = 0, hp = 0, jsValue = 0 } = {}) {
  const shadow = getShadowState();
  if (shadow.status !== 'ready' || !shadow.exports) return jsValue;
  const rustValue = Number(shadow.exports.combat_power_shadow(Number(atk || 0), Number(def || 0), Number(hp || 0)));
  shadow.lastCheck = {
    source,
    atk: Number(atk || 0),
    def: Number(def || 0),
    hp: Number(hp || 0),
    jsValue,
    rustValue,
  };
  if (Math.abs(rustValue - jsValue) > 0.000001) {
    shadow.mismatches.push(shadow.lastCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastCheck);
  }
  updateShadowDomMarker(shadow);
  return jsValue;
}

export function shadowSeededRng({
  source = 'unknown',
  seed = 1,
  draws = 1,
  size = 1,
  jsState = 0,
  jsValue = 0,
  jsIndex = 0,
} = {}) {
  const shadow = getShadowState();
  if (shadow.status !== 'ready' || !hasSeededRngExports(shadow.exports)) return jsValue;
  const normalizedSeed = Number(seed || 0);
  const normalizedDraws = Number(draws || 0);
  const normalizedSize = Number(size || 0);
  const rustState = Number(shadow.exports.seeded_rng_next_state_shadow(normalizedSeed, normalizedDraws));
  const rustValue = Number(shadow.exports.seeded_rng_next_value_shadow(normalizedSeed, normalizedDraws));
  const rustIndex = Number(shadow.exports.seeded_rng_index_shadow(
    normalizedSeed,
    normalizedDraws,
    normalizedSize,
  ));
  shadow.seededRngChecks = Number(shadow.seededRngChecks || 0) + 1;
  shadow.lastSeededRngCheck = {
    source,
    seed: normalizedSeed,
    draws: normalizedDraws,
    size: normalizedSize,
    jsState: Number(jsState || 0),
    rustState,
    jsValue: Number(jsValue || 0),
    rustValue,
    jsIndex: Number(jsIndex || 0),
    rustIndex,
  };
  if (
    Math.abs(rustState - Number(jsState || 0)) > 0.000001
    || Math.abs(rustValue - Number(jsValue || 0)) > 0.000001
    || Math.abs(rustIndex - Number(jsIndex || 0)) > 0.000001
  ) {
    shadow.mismatches.push(shadow.lastSeededRngCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastSeededRngCheck);
  }
  updateShadowDomMarker(shadow);
  return jsValue;
}

export function shadowTurnSummary({
  source = 'unknown',
  heroCount = 0,
  heroHp = [],
  enemyCount = 0,
  enemyHp = [],
  jsCode = 0,
  jsValue = 0,
} = {}) {
  const shadow = getShadowState();
  if (shadow.status !== 'ready' || !hasRequiredExports(shadow.exports)) return jsValue;
  const heroes = Array.isArray(heroHp) ? heroHp : [];
  const enemies = Array.isArray(enemyHp) ? enemyHp : [];
  const heroValues = [0, 1, 2, 3].map((index) => Number(heroes[index] || 0));
  const enemyValues = [0, 1, 2, 3].map((index) => Number(enemies[index] || 0));
  const rustCode = Number(shadow.exports.turn_summary_code_shadow(
    Number(heroCount || 0),
    heroValues[0],
    heroValues[1],
    heroValues[2],
    heroValues[3],
    Number(enemyCount || 0),
    enemyValues[0],
    enemyValues[1],
    enemyValues[2],
    enemyValues[3],
  ));
  shadow.turnSummaryChecks = Number(shadow.turnSummaryChecks || 0) + 1;
  shadow.lastTurnSummaryCheck = {
    source,
    heroCount: Number(heroCount || 0),
    heroHp: heroValues,
    enemyCount: Number(enemyCount || 0),
    enemyHp: enemyValues,
    jsCode: Number(jsCode || 0),
    rustCode,
  };
  if (Math.abs(rustCode - Number(jsCode || 0)) > 0.000001) {
    shadow.mismatches.push(shadow.lastTurnSummaryCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastTurnSummaryCheck);
  }
  updateShadowDomMarker(shadow);
  return jsValue;
}

export function createSimulationCoreCalculateDamageResolution({
  source = 'unknown',
  power = 0,
  resist = 0,
  roll01 = 0.5,
  critRoll01 = 0.5,
  sourceIsHero = 0,
  heroAoe = 0,
  chainActive = 0,
  chainMultiplier = 1,
  jsDamage = 0,
} = {}, { exportsOverride = null } = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    power: Number(power || 0),
    resist: Number(resist || 0),
    roll01: Number(roll01 || 0),
    critRoll01: Number(critRoll01 || 0),
    sourceIsHero: Number(sourceIsHero || 0) === 1 ? 1 : 0,
    heroAoe: Number(heroAoe || 0) === 1 ? 1 : 0,
    chainActive: Number(chainActive || 0) === 1 ? 1 : 0,
    chainMultiplier: Number(chainMultiplier || 1),
    jsDamage: Number(jsDamage || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasCalculateDamageExports(exports)) {
    shadow.calculateDamageOwnerChecks = Number(shadow.calculateDamageOwnerChecks || 0) + 1;
    shadow.lastCalculateDamageOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      damage: normalized.jsDamage,
    };
    updateShadowDomMarker(shadow);
    return { owner: 'fallback', damage: normalized.jsDamage };
  }

  const damage = Number(exports.single_hit_damage_shadow(
    normalized.power,
    normalized.resist,
    normalized.roll01,
    normalized.critRoll01,
    normalized.sourceIsHero,
    normalized.heroAoe,
    normalized.chainActive,
    normalized.chainMultiplier,
  ));
  shadow.calculateDamageOwnerChecks = Number(shadow.calculateDamageOwnerChecks || 0) + 1;
  shadow.lastCalculateDamageOwnerCheck = {
    ...normalized,
    owner: 'rust',
    damage,
  };
  if (!exportsOverride && Math.abs(damage - normalized.jsDamage) > 0.000001) {
    shadow.mismatches.push(shadow.lastCalculateDamageOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastCalculateDamageOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return { owner: 'rust', damage };
}

export function createSimulationCorePartyDamageResolution({
  source = 'unknown',
  incomingDamage = 0,
  shield = 0,
  heroCount = 0,
  heroHp = [],
  jsAbsorbed = 0,
  jsDamageAfterShield = 0,
  jsShieldAfter = 0,
  jsHeroHp = [],
  jsPartyHp = 0,
} = {}, { exportsOverride = null } = {}) {
  const shadow = getShadowState();
  const heroes = Array.isArray(heroHp) ? heroHp : [];
  const jsHeroes = Array.isArray(jsHeroHp) ? jsHeroHp : [];
  const normalized = {
    source,
    incomingDamage: Number(incomingDamage || 0),
    shield: Number(shield || 0),
    heroCount: Number(heroCount || 0),
    heroHp: [0, 1, 2, 3].map((index) => Number(heroes[index] || 0)),
    jsAbsorbed: Number(jsAbsorbed || 0),
    jsDamageAfterShield: Number(jsDamageAfterShield || 0),
    jsShieldAfter: Number(jsShieldAfter || 0),
    jsHeroHp: [0, 1, 2, 3].map((index) => Number(jsHeroes[index] || 0)),
    jsPartyHp: Number(jsPartyHp || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasPartyDamageExports(exports)) {
    shadow.partyDamageOwnerChecks = Number(shadow.partyDamageOwnerChecks || 0) + 1;
    shadow.lastPartyDamageOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      absorbed: normalized.jsAbsorbed,
      damageAfterShield: normalized.jsDamageAfterShield,
      shieldAfter: normalized.jsShieldAfter,
      heroHp: normalized.jsHeroHp,
      partyHp: normalized.jsPartyHp,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      absorbed: normalized.jsAbsorbed,
      damageAfterShield: normalized.jsDamageAfterShield,
      shieldAfter: normalized.jsShieldAfter,
      heroHp: normalized.jsHeroHp,
      partyHp: normalized.jsPartyHp,
    };
  }

  const rustAbsorbed = Number(exports.party_damage_absorbed_shadow(
    normalized.incomingDamage,
    normalized.shield,
  ));
  const rustDamageAfterShield = Number(exports.party_damage_after_shield_shadow(
    normalized.incomingDamage,
    normalized.shield,
  ));
  const rustShieldAfter = Number(exports.party_damage_shield_after_shadow(
    normalized.incomingDamage,
    normalized.shield,
  ));
  const rustHeroHp = normalized.heroHp.map((hp) => Number(exports.party_damage_hero_after_hp_shadow(
    hp,
    rustDamageAfterShield,
  )));
  const rustPartyHp = Number(exports.party_damage_party_hp_after_shadow(
    normalized.heroCount,
    normalized.heroHp[0],
    normalized.heroHp[1],
    normalized.heroHp[2],
    normalized.heroHp[3],
    rustDamageAfterShield,
  ));
  shadow.partyDamageOwnerChecks = Number(shadow.partyDamageOwnerChecks || 0) + 1;
  shadow.lastPartyDamageOwnerCheck = {
    ...normalized,
    owner: 'rust',
    absorbed: rustAbsorbed,
    damageAfterShield: rustDamageAfterShield,
    shieldAfter: rustShieldAfter,
    heroHp: rustHeroHp,
    partyHp: rustPartyHp,
  };
  const heroHpMismatch = rustHeroHp.some((hp, index) =>
    Math.abs(hp - Number(normalized.jsHeroHp[index] || 0)) > 0.000001
  );
  if (
    !exportsOverride
    && (
      Math.abs(rustAbsorbed - normalized.jsAbsorbed) > 0.000001
      || Math.abs(rustDamageAfterShield - normalized.jsDamageAfterShield) > 0.000001
      || Math.abs(rustShieldAfter - normalized.jsShieldAfter) > 0.000001
      || heroHpMismatch
      || Math.abs(rustPartyHp - normalized.jsPartyHp) > 0.000001
    )
  ) {
    shadow.mismatches.push(shadow.lastPartyDamageOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastPartyDamageOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return {
    owner: 'rust',
    absorbed: rustAbsorbed,
    damageAfterShield: rustDamageAfterShield,
    shieldAfter: rustShieldAfter,
    heroHp: rustHeroHp,
    partyHp: rustPartyHp,
  };
}

export function createSimulationCorePartyRegenLifecycleResolution({
  source = 'unknown',
  remainingFires = 0,
  hasTotalHealRemaining = 0,
  totalHealRemaining = 0,
  currentSerial = 0,
  nextFireSerial = 0,
  appliedOnSerial = 0,
  lastProcessedSerial = 0,
  jsAction = 0,
} = {}, { exportsOverride = null } = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    remainingFires: Number(remainingFires || 0),
    hasTotalHealRemaining: Number(hasTotalHealRemaining || 0),
    totalHealRemaining: Number(totalHealRemaining || 0),
    currentSerial: Number(currentSerial || 0),
    nextFireSerial: Number(nextFireSerial || 0),
    appliedOnSerial: Number(appliedOnSerial || 0),
    lastProcessedSerial: Number(lastProcessedSerial || 0),
    jsAction: Number(jsAction || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasPartyRegenLifecycleExports(exports)) {
    shadow.partyRegenLifecycleOwnerChecks = Number(shadow.partyRegenLifecycleOwnerChecks || 0) + 1;
    shadow.lastPartyRegenLifecycleOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      action: normalized.jsAction,
    };
    updateShadowDomMarker(shadow);
    return { owner: 'fallback', action: normalized.jsAction };
  }
  const action = Number(exports.party_regen_lifecycle_action_shadow(
    normalized.remainingFires,
    normalized.hasTotalHealRemaining,
    normalized.totalHealRemaining,
    normalized.currentSerial,
    normalized.nextFireSerial,
    normalized.appliedOnSerial,
    normalized.lastProcessedSerial,
  ));
  shadow.partyRegenLifecycleOwnerChecks = Number(shadow.partyRegenLifecycleOwnerChecks || 0) + 1;
  shadow.lastPartyRegenLifecycleOwnerCheck = {
    ...normalized,
    owner: 'rust',
    action,
  };
  if (!exportsOverride && Math.abs(action - normalized.jsAction) > 0.000001) {
    shadow.mismatches.push(shadow.lastPartyRegenLifecycleOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastPartyRegenLifecycleOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return { owner: 'rust', action };
}

export function createSimulationCorePartyRegenTickResolution({
  source = 'unknown',
  totalHealRemaining = 0,
  remainingFires = 0,
  healPerFire = 0,
  hasTotalHealRemaining = 0,
  nextFireSerial = 0,
  firesEvery = 1,
  distributionMode = 0,
  jsHeal = 0,
  jsTotalHealRemaining = 0,
  jsRemainingFires = 0,
  jsNextFireSerial = 0,
} = {}, { exportsOverride = null } = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    totalHealRemaining: Number(totalHealRemaining || 0),
    remainingFires: Number(remainingFires || 0),
    healPerFire: Number(healPerFire || 0),
    hasTotalHealRemaining: Number(hasTotalHealRemaining || 0),
    nextFireSerial: Number(nextFireSerial || 0),
    firesEvery: Number(firesEvery || 1),
    distributionMode: Number(distributionMode || 0),
    jsHeal: Number(jsHeal || 0),
    jsTotalHealRemaining: Number(jsTotalHealRemaining || 0),
    jsRemainingFires: Number(jsRemainingFires || 0),
    jsNextFireSerial: Number(jsNextFireSerial || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasPartyRegenTickExports(exports)) {
    shadow.partyRegenTickOwnerChecks = Number(shadow.partyRegenTickOwnerChecks || 0) + 1;
    shadow.lastPartyRegenTickOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      heal: normalized.jsHeal,
      totalHealRemaining: normalized.jsTotalHealRemaining,
      remainingFires: normalized.jsRemainingFires,
      nextFireSerial: normalized.jsNextFireSerial,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      heal: normalized.jsHeal,
      totalHealRemaining: normalized.jsTotalHealRemaining,
      remainingFires: normalized.jsRemainingFires,
      nextFireSerial: normalized.jsNextFireSerial,
    };
  }
  const rustHeal = Number(exports.party_regen_tick_heal_shadow(
    normalized.totalHealRemaining,
    normalized.remainingFires,
    normalized.healPerFire,
    normalized.hasTotalHealRemaining,
    normalized.distributionMode,
  ));
  const rustTotalHealRemaining = Number(exports.party_regen_tick_total_remaining_shadow(
    normalized.totalHealRemaining,
    normalized.remainingFires,
    normalized.healPerFire,
    normalized.hasTotalHealRemaining,
    normalized.distributionMode,
  ));
  const rustRemainingFires = Number(exports.party_regen_tick_remaining_fires_shadow(
    normalized.remainingFires,
  ));
  const rustNextFireSerial = Number(exports.party_regen_tick_next_serial_shadow(
    normalized.nextFireSerial,
    normalized.firesEvery,
  ));
  shadow.partyRegenTickOwnerChecks = Number(shadow.partyRegenTickOwnerChecks || 0) + 1;
  shadow.lastPartyRegenTickOwnerCheck = {
    ...normalized,
    owner: 'rust',
    heal: rustHeal,
    totalHealRemaining: rustTotalHealRemaining,
    remainingFires: rustRemainingFires,
    nextFireSerial: rustNextFireSerial,
  };
  if (
    !exportsOverride
    && (
      Math.abs(rustHeal - normalized.jsHeal) > 0.000001
      || Math.abs(rustTotalHealRemaining - normalized.jsTotalHealRemaining) > 0.000001
      || Math.abs(rustRemainingFires - normalized.jsRemainingFires) > 0.000001
      || Math.abs(rustNextFireSerial - normalized.jsNextFireSerial) > 0.000001
    )
  ) {
    shadow.mismatches.push(shadow.lastPartyRegenTickOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastPartyRegenTickOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return {
    owner: 'rust',
    heal: rustHeal,
    totalHealRemaining: rustTotalHealRemaining,
    remainingFires: rustRemainingFires,
    nextFireSerial: rustNextFireSerial,
  };
}

export function createSimulationCoreRunaMagicResistResolution({
  source = 'unknown',
  targetIsRuna = 0,
  incomingDamage = 0,
  triggerRoll = 0,
  nullifyRoll = 0,
  jsFinalDamage = 0,
  jsModeCode = 0,
} = {}, { exportsOverride = null } = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    targetIsRuna: Number(targetIsRuna || 0) === 1 ? 1 : 0,
    incomingDamage: Number(incomingDamage || 0),
    triggerRoll: Number(triggerRoll || 0),
    nullifyRoll: Number(nullifyRoll || 0),
    jsFinalDamage: Number(jsFinalDamage || 0),
    jsModeCode: Number(jsModeCode || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasRunaMagicResistExports(exports)) {
    shadow.runaMagicResistOwnerChecks = Number(shadow.runaMagicResistOwnerChecks || 0) + 1;
    shadow.lastRunaMagicResistOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      finalDamage: normalized.jsFinalDamage,
      modeCode: normalized.jsModeCode,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      finalDamage: normalized.jsFinalDamage,
      modeCode: normalized.jsModeCode,
    };
  }

  const finalDamage = Number(exports.runa_magic_resist_final_damage_shadow(
    normalized.targetIsRuna,
    normalized.incomingDamage,
    normalized.triggerRoll,
    normalized.nullifyRoll,
  ));
  const modeCode = Number(exports.runa_magic_resist_mode_code_shadow(
    normalized.targetIsRuna,
    normalized.incomingDamage,
    normalized.triggerRoll,
    normalized.nullifyRoll,
  ));

  shadow.runaMagicResistOwnerChecks = Number(shadow.runaMagicResistOwnerChecks || 0) + 1;
  shadow.lastRunaMagicResistOwnerCheck = {
    ...normalized,
    owner: 'rust',
    finalDamage,
    modeCode,
  };
  if (
    !exportsOverride
    && (
      Math.abs(finalDamage - normalized.jsFinalDamage) > 0.000001
      || Math.abs(modeCode - normalized.jsModeCode) > 0.000001
    )
  ) {
    shadow.mismatches.push(shadow.lastRunaMagicResistOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastRunaMagicResistOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return { owner: 'rust', finalDamage, modeCode };
}

export function createSimulationCoreTurnSummaryResolution({
  source = 'unknown',
  heroCount = 0,
  heroHp = [],
  enemyCount = 0,
  enemyHp = [],
  jsCode = 0,
} = {}, { exportsOverride = null } = {}) {
  const shadow = getShadowState();
  const heroes = Array.isArray(heroHp) ? heroHp : [];
  const enemies = Array.isArray(enemyHp) ? enemyHp : [];
  const normalized = {
    source,
    heroCount: Number(heroCount || 0),
    heroHp: [0, 1, 2, 3].map((index) => Number(heroes[index] || 0)),
    enemyCount: Number(enemyCount || 0),
    enemyHp: [0, 1, 2, 3].map((index) => Number(enemies[index] || 0)),
    jsCode: Number(jsCode || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasTurnSummaryExports(exports)) {
    shadow.turnSummaryOwnerChecks = Number(shadow.turnSummaryOwnerChecks || 0) + 1;
    shadow.lastTurnSummaryOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      code: normalized.jsCode,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      code: normalized.jsCode,
    };
  }

  const rustCode = Number(exports.turn_summary_code_shadow(
    normalized.heroCount,
    normalized.heroHp[0],
    normalized.heroHp[1],
    normalized.heroHp[2],
    normalized.heroHp[3],
    normalized.enemyCount,
    normalized.enemyHp[0],
    normalized.enemyHp[1],
    normalized.enemyHp[2],
    normalized.enemyHp[3],
  ));
  shadow.turnSummaryOwnerChecks = Number(shadow.turnSummaryOwnerChecks || 0) + 1;
  shadow.lastTurnSummaryOwnerCheck = {
    ...normalized,
    owner: 'rust',
    code: rustCode,
  };
  if (!exportsOverride && Math.abs(rustCode - normalized.jsCode) > 0.000001) {
    shadow.mismatches.push(shadow.lastTurnSummaryOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastTurnSummaryOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return {
    owner: 'rust',
    code: rustCode,
  };
}

export function createSimulationCoreSingleHitResolution({
  source = 'unknown',
  power = 0,
  resist = 0,
  roll01 = 0,
  critRoll01 = 0,
  sourceIsHero = 0,
  heroAoe = 0,
  chainActive = 0,
  chainMultiplier = 1,
  targetHp = 0,
  shield = 0,
  jsDamage = 0,
  jsAppliedDamage = 0,
  jsAfterHp = 0,
} = {}, { exportsOverride = null } = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    power: Number(power || 0),
    resist: Number(resist || 0),
    roll01: Number(roll01 || 0),
    critRoll01: Number(critRoll01 || 0),
    sourceIsHero: Number(sourceIsHero || 0),
    heroAoe: Number(heroAoe || 0),
    chainActive: Number(chainActive || 0),
    chainMultiplier: Number(chainMultiplier || 1),
    targetHp: Number(targetHp || 0),
    shield: Number(shield || 0),
    jsDamage: Number(jsDamage || 0),
    jsAppliedDamage: Number(jsAppliedDamage || 0),
    jsAfterHp: Number(jsAfterHp || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasSingleHitExports(exports)) {
    shadow.singleHitOwnerChecks = Number(shadow.singleHitOwnerChecks || 0) + 1;
    shadow.lastSingleHitOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      damage: normalized.jsDamage,
      appliedDamage: normalized.jsAppliedDamage,
      afterHp: normalized.jsAfterHp,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      damage: normalized.jsDamage,
      appliedDamage: normalized.jsAppliedDamage,
      afterHp: normalized.jsAfterHp,
    };
  }

  const rustDamage = Number(exports.single_hit_damage_shadow(
    normalized.power,
    normalized.resist,
    normalized.roll01,
    normalized.critRoll01,
    normalized.sourceIsHero,
    normalized.heroAoe,
    normalized.chainActive,
    normalized.chainMultiplier,
  ));
  const rustAppliedDamage = Number(exports.single_hit_applied_damage_shadow(
    normalized.targetHp,
    rustDamage,
    normalized.shield,
  ));
  const rustAfterHp = Number(exports.single_hit_after_hp_shadow(
    normalized.targetHp,
    rustDamage,
    normalized.shield,
  ));
  shadow.singleHitOwnerChecks = Number(shadow.singleHitOwnerChecks || 0) + 1;
  shadow.lastSingleHitOwnerCheck = {
    ...normalized,
    owner: 'rust',
    damage: rustDamage,
    appliedDamage: rustAppliedDamage,
    afterHp: rustAfterHp,
  };
  if (
    !exportsOverride
    && (
      Math.abs(rustDamage - normalized.jsDamage) > 0.000001
      || Math.abs(rustAppliedDamage - normalized.jsAppliedDamage) > 0.000001
      || Math.abs(rustAfterHp - normalized.jsAfterHp) > 0.000001
    )
  ) {
    shadow.mismatches.push(shadow.lastSingleHitOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastSingleHitOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return {
    owner: 'rust',
    damage: rustDamage,
    appliedDamage: rustAppliedDamage,
    afterHp: rustAfterHp,
  };
}

export function createSimulationCoreEnemyDotPacketResolution({
  source = 'unknown',
  actorUID = 0,
  enemyUID = 0,
  totalDamage = 0,
  totalTicks = 1,
  nowTick = 0,
  nowTurnSerial = 0,
  firesEveryTicks = 1,
  startAfterTicks = 1,
  firesEveryTurns = 1,
  startAfterTurns = 1,
  cadence = '',
  effectName = '',
  taintedGroundZoneId = '',
  jsTargetUID = 0,
  jsSourceUID = 0,
  jsRemainingFires = 0,
  jsTotalDamageRemaining = 0,
  jsFiresEveryTicks = 0,
  jsNextFireTick = 0,
  jsFiresEveryTurns = 0,
  jsNextFireTurnSerial = 0,
  jsLastProcessedTurnSerial = 0,
} = {}, { exportsOverride = null } = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    actorUID: Number(actorUID || 0),
    enemyUID: Number(enemyUID || 0),
    totalDamage: Number(totalDamage || 0),
    totalTicks: Number(totalTicks || 0),
    nowTick: Number(nowTick || 0),
    nowTurnSerial: Number(nowTurnSerial || 0),
    firesEveryTicks: Number(firesEveryTicks || 0),
    startAfterTicks: Number(startAfterTicks || 0),
    firesEveryTurns: Number(firesEveryTurns || 0),
    startAfterTurns: Number(startAfterTurns || 0),
    cadence: String(cadence || ''),
    effectName: String(effectName || ''),
    taintedGroundZoneId: String(taintedGroundZoneId || ''),
    jsTargetUID: Number(jsTargetUID || 0),
    jsSourceUID: Number(jsSourceUID || 0),
    jsRemainingFires: Number(jsRemainingFires || 0),
    jsTotalDamageRemaining: Number(jsTotalDamageRemaining || 0),
    jsFiresEveryTicks: Number(jsFiresEveryTicks || 0),
    jsNextFireTick: Number(jsNextFireTick || 0),
    jsFiresEveryTurns: Number(jsFiresEveryTurns || 0),
    jsNextFireTurnSerial: Number(jsNextFireTurnSerial || 0),
    jsLastProcessedTurnSerial: Number(jsLastProcessedTurnSerial || 0),
  };
  const fallback = {
    owner: 'fallback',
    targetUID: normalized.jsTargetUID,
    sourceUID: normalized.jsSourceUID,
    remainingFires: normalized.jsRemainingFires,
    totalDamageRemaining: normalized.jsTotalDamageRemaining,
    firesEveryTicks: normalized.jsFiresEveryTicks,
    nextFireTick: normalized.jsNextFireTick,
    firesEveryTurns: normalized.jsFiresEveryTurns,
    nextFireTurnSerial: normalized.jsNextFireTurnSerial,
    lastProcessedTurnSerial: normalized.jsLastProcessedTurnSerial,
    cadence: normalized.cadence,
    effectName: normalized.effectName,
    taintedGroundZoneId: normalized.taintedGroundZoneId,
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasEnemyDotPacketExports(exports)) {
    shadow.enemyDotPacketOwnerChecks = Number(shadow.enemyDotPacketOwnerChecks || 0) + 1;
    shadow.lastEnemyDotPacketOwnerCheck = {
      ...normalized,
      ...fallback,
    };
    updateShadowDomMarker(shadow);
    return fallback;
  }

  const rustPacket = {
    owner: 'rust',
    targetUID: Number(exports.enemy_dot_packet_target_uid_shadow(normalized.enemyUID)),
    sourceUID: Number(exports.enemy_dot_packet_source_uid_shadow(normalized.actorUID)),
    remainingFires: Number(exports.enemy_dot_packet_remaining_fires_shadow(normalized.totalTicks)),
    totalDamageRemaining: Number(exports.enemy_dot_packet_total_damage_remaining_shadow(normalized.totalDamage)),
    firesEveryTicks: Number(exports.enemy_dot_packet_fires_every_ticks_shadow(normalized.firesEveryTicks)),
    nextFireTick: Number(exports.enemy_dot_packet_next_fire_tick_shadow(
      normalized.nowTick,
      normalized.startAfterTicks,
    )),
    firesEveryTurns: Number(exports.enemy_dot_packet_fires_every_turns_shadow(normalized.firesEveryTurns)),
    nextFireTurnSerial: Number(exports.enemy_dot_packet_next_fire_turn_serial_shadow(
      normalized.nowTurnSerial,
      normalized.startAfterTurns,
    )),
    lastProcessedTurnSerial: Number(
      exports.enemy_dot_packet_last_processed_turn_serial_shadow(normalized.nowTurnSerial),
    ),
    cadence: normalized.cadence,
    effectName: normalized.effectName,
    taintedGroundZoneId: normalized.taintedGroundZoneId,
  };
  shadow.enemyDotPacketOwnerChecks = Number(shadow.enemyDotPacketOwnerChecks || 0) + 1;
  shadow.lastEnemyDotPacketOwnerCheck = {
    ...normalized,
    ...rustPacket,
  };
  if (
    !exportsOverride
    && (
      Math.abs(rustPacket.targetUID - normalized.jsTargetUID) > 0.000001
      || Math.abs(rustPacket.sourceUID - normalized.jsSourceUID) > 0.000001
      || Math.abs(rustPacket.remainingFires - normalized.jsRemainingFires) > 0.000001
      || Math.abs(rustPacket.totalDamageRemaining - normalized.jsTotalDamageRemaining) > 0.000001
      || Math.abs(rustPacket.firesEveryTicks - normalized.jsFiresEveryTicks) > 0.000001
      || Math.abs(rustPacket.nextFireTick - normalized.jsNextFireTick) > 0.000001
      || Math.abs(rustPacket.firesEveryTurns - normalized.jsFiresEveryTurns) > 0.000001
      || Math.abs(rustPacket.nextFireTurnSerial - normalized.jsNextFireTurnSerial) > 0.000001
      || Math.abs(rustPacket.lastProcessedTurnSerial - normalized.jsLastProcessedTurnSerial) > 0.000001
    )
  ) {
    shadow.mismatches.push(shadow.lastEnemyDotPacketOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastEnemyDotPacketOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return rustPacket;
}

export function createSimulationCoreEnemyDotTickResolution({
  source = 'unknown',
  totalDamageRemaining = 0,
  remainingFires = 0,
  damagePerFire = 0,
  hasTotalDamageRemaining = 0,
  nextFireTurnSerial = 0,
  firesEveryTurns = 1,
  jsDamage = 0,
  jsTotalDamageRemaining = 0,
  jsRemainingFires = 0,
  jsNextFireTurnSerial = 0,
} = {}, { exportsOverride = null } = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    totalDamageRemaining: Number(totalDamageRemaining || 0),
    remainingFires: Number(remainingFires || 0),
    damagePerFire: Number(damagePerFire || 0),
    hasTotalDamageRemaining: Number(hasTotalDamageRemaining || 0),
    nextFireTurnSerial: Number(nextFireTurnSerial || 0),
    firesEveryTurns: Number(firesEveryTurns || 1),
    jsDamage: Number(jsDamage || 0),
    jsTotalDamageRemaining: Number(jsTotalDamageRemaining || 0),
    jsRemainingFires: Number(jsRemainingFires || 0),
    jsNextFireTurnSerial: Number(jsNextFireTurnSerial || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasEnemyDotTickExports(exports)) {
    shadow.enemyDotTickOwnerChecks = Number(shadow.enemyDotTickOwnerChecks || 0) + 1;
    shadow.lastEnemyDotTickOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      damage: normalized.jsDamage,
      totalDamageRemaining: normalized.jsTotalDamageRemaining,
      remainingFires: normalized.jsRemainingFires,
      nextFireTurnSerial: normalized.jsNextFireTurnSerial,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      damage: normalized.jsDamage,
      totalDamageRemaining: normalized.jsTotalDamageRemaining,
      remainingFires: normalized.jsRemainingFires,
      nextFireTurnSerial: normalized.jsNextFireTurnSerial,
    };
  }

  const rustDamage = Number(exports.enemy_dot_tick_damage_shadow(
    normalized.totalDamageRemaining,
    normalized.remainingFires,
    normalized.damagePerFire,
    normalized.hasTotalDamageRemaining,
  ));
  const rustTotalDamageRemaining = Number(exports.enemy_dot_tick_total_remaining_shadow(
    normalized.totalDamageRemaining,
    normalized.remainingFires,
    normalized.damagePerFire,
    normalized.hasTotalDamageRemaining,
  ));
  const rustRemainingFires = Number(exports.enemy_dot_tick_remaining_fires_shadow(
    normalized.remainingFires,
  ));
  const rustNextFireTurnSerial = Number(exports.enemy_dot_tick_next_turn_shadow(
    normalized.nextFireTurnSerial,
    normalized.firesEveryTurns,
  ));
  shadow.enemyDotTickOwnerChecks = Number(shadow.enemyDotTickOwnerChecks || 0) + 1;
  shadow.lastEnemyDotTickOwnerCheck = {
    ...normalized,
    owner: 'rust',
    damage: rustDamage,
    totalDamageRemaining: rustTotalDamageRemaining,
    remainingFires: rustRemainingFires,
    nextFireTurnSerial: rustNextFireTurnSerial,
  };
  if (
    !exportsOverride
    && (
      Math.abs(rustDamage - normalized.jsDamage) > 0.000001
      || Math.abs(rustTotalDamageRemaining - normalized.jsTotalDamageRemaining) > 0.000001
      || Math.abs(rustRemainingFires - normalized.jsRemainingFires) > 0.000001
      || Math.abs(rustNextFireTurnSerial - normalized.jsNextFireTurnSerial) > 0.000001
    )
  ) {
    shadow.mismatches.push(shadow.lastEnemyDotTickOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastEnemyDotTickOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return {
    owner: 'rust',
    damage: rustDamage,
    totalDamageRemaining: rustTotalDamageRemaining,
    remainingFires: rustRemainingFires,
    nextFireTurnSerial: rustNextFireTurnSerial,
  };
}

export function createSimulationCoreEnemyDotLifecycleResolution({
  source = 'unknown',
  cadenceIsTurn = 0,
  dotTargetUID = 0,
  targetUID = 0,
  remainingFires = 0,
  hasTotalDamageRemaining = 0,
  totalDamageRemaining = 0,
  targetAlive = 0,
  currentTurnSerial = 0,
  nextFireTurnSerial = 0,
  lastProcessedTurnSerial = 0,
  jsAction = 0,
} = {}, { exportsOverride = null } = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    cadenceIsTurn: Number(cadenceIsTurn || 0),
    dotTargetUID: Number(dotTargetUID || 0),
    targetUID: Number(targetUID || 0),
    remainingFires: Number(remainingFires || 0),
    hasTotalDamageRemaining: Number(hasTotalDamageRemaining || 0),
    totalDamageRemaining: Number(totalDamageRemaining || 0),
    targetAlive: Number(targetAlive || 0),
    currentTurnSerial: Number(currentTurnSerial || 0),
    nextFireTurnSerial: Number(nextFireTurnSerial || 0),
    lastProcessedTurnSerial: Number(lastProcessedTurnSerial || 0),
    jsAction: Number(jsAction || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasEnemyDotLifecycleExports(exports)) {
    shadow.enemyDotLifecycleOwnerChecks = Number(shadow.enemyDotLifecycleOwnerChecks || 0) + 1;
    shadow.lastEnemyDotLifecycleOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      action: normalized.jsAction,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      action: normalized.jsAction,
    };
  }

  const rustAction = Number(exports.enemy_dot_lifecycle_action_shadow(
    normalized.cadenceIsTurn,
    normalized.dotTargetUID,
    normalized.targetUID,
    normalized.remainingFires,
    normalized.hasTotalDamageRemaining,
    normalized.totalDamageRemaining,
    normalized.targetAlive,
    normalized.currentTurnSerial,
    normalized.nextFireTurnSerial,
    normalized.lastProcessedTurnSerial,
  ));
  shadow.enemyDotLifecycleOwnerChecks = Number(shadow.enemyDotLifecycleOwnerChecks || 0) + 1;
  shadow.lastEnemyDotLifecycleOwnerCheck = {
    ...normalized,
    owner: 'rust',
    action: rustAction,
  };
  if (!exportsOverride && Math.abs(rustAction - normalized.jsAction) > 0.000001) {
    shadow.mismatches.push(shadow.lastEnemyDotLifecycleOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastEnemyDotLifecycleOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return {
    owner: 'rust',
    action: rustAction,
  };
}

export function createSimulationCoreEnemyDebuffApplyResolution({
  source = 'unknown',
  stat = '',
  amountBefore = 0,
  turnsBefore = 0,
  addAmount = 2,
  durationTurns = 3,
  jsAmountAfter = 0,
  jsTurnsAfter = 0,
  jsActive = 0,
} = {}, { exportsOverride = null } = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    stat: String(stat || '').toUpperCase(),
    amountBefore: Number(amountBefore || 0),
    turnsBefore: Number(turnsBefore || 0),
    addAmount: Number(addAmount || 0),
    durationTurns: Number(durationTurns || 0),
    jsAmountAfter: Number(jsAmountAfter || 0),
    jsTurnsAfter: Number(jsTurnsAfter || 0),
    jsActive: Number(jsActive || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasEnemyDebuffApplyExports(exports)) {
    shadow.enemyDebuffApplyOwnerChecks = Number(shadow.enemyDebuffApplyOwnerChecks || 0) + 1;
    shadow.lastEnemyDebuffApplyOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      amountAfter: normalized.jsAmountAfter,
      turnsAfter: normalized.jsTurnsAfter,
      active: normalized.jsActive,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      amountAfter: normalized.jsAmountAfter,
      turnsAfter: normalized.jsTurnsAfter,
      active: normalized.jsActive,
    };
  }

  const rustAmountAfter = Number(exports.enemy_debuff_apply_amount_after_shadow(
    normalized.amountBefore,
    normalized.addAmount,
  ));
  const rustTurnsAfter = Number(exports.enemy_debuff_apply_turns_after_shadow(
    normalized.durationTurns,
  ));
  const rustActive = Number(exports.enemy_debuff_apply_active_shadow(
    rustAmountAfter,
    rustTurnsAfter,
  ));
  shadow.enemyDebuffApplyOwnerChecks = Number(shadow.enemyDebuffApplyOwnerChecks || 0) + 1;
  shadow.lastEnemyDebuffApplyOwnerCheck = {
    ...normalized,
    owner: 'rust',
    amountAfter: rustAmountAfter,
    turnsAfter: rustTurnsAfter,
    active: rustActive,
  };
  if (
    !exportsOverride
    && (
      Math.abs(rustAmountAfter - normalized.jsAmountAfter) > 0.000001
      || Math.abs(rustTurnsAfter - normalized.jsTurnsAfter) > 0.000001
      || Math.abs(rustActive - normalized.jsActive) > 0.000001
    )
  ) {
    shadow.mismatches.push(shadow.lastEnemyDebuffApplyOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastEnemyDebuffApplyOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return {
    owner: 'rust',
    amountAfter: rustAmountAfter,
    turnsAfter: rustTurnsAfter,
    active: rustActive,
  };
}

export function createSimulationCoreEnemyDebuffSlotTransition({
  source = 'unknown',
  stat = '',
  statIndex = -1,
  active = 0,
  slotCount = 0,
  slot0Index = -1,
  slot1Index = -1,
  slot2Index = -1,
  jsAction = 0,
  jsDropSlotIndex = -1,
  jsAppendSlotIndex = -1,
} = {}, { exportsOverride = null } = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    stat: String(stat || '').toUpperCase(),
    statIndex: Number(statIndex ?? -1),
    active: Number(active || 0),
    slotCount: Number(slotCount || 0),
    slot0Index: Number(slot0Index ?? -1),
    slot1Index: Number(slot1Index ?? -1),
    slot2Index: Number(slot2Index ?? -1),
    jsAction: Number(jsAction || 0),
    jsDropSlotIndex: Number(jsDropSlotIndex ?? -1),
    jsAppendSlotIndex: Number(jsAppendSlotIndex ?? -1),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasEnemyDebuffSlotExports(exports)) {
    shadow.enemyDebuffSlotOwnerChecks = Number(shadow.enemyDebuffSlotOwnerChecks || 0) + 1;
    shadow.lastEnemyDebuffSlotOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      action: normalized.jsAction,
      dropSlotIndex: normalized.jsDropSlotIndex,
      appendSlotIndex: normalized.jsAppendSlotIndex,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      action: normalized.jsAction,
      dropSlotIndex: normalized.jsDropSlotIndex,
      appendSlotIndex: normalized.jsAppendSlotIndex,
    };
  }

  const args = [
    normalized.slotCount,
    normalized.slot0Index,
    normalized.slot1Index,
    normalized.slot2Index,
    normalized.statIndex,
    normalized.active,
  ];
  const rustAction = Number(exports.enemy_debuff_slot_transition_action_shadow(...args));
  const rustDropSlotIndex = Number(exports.enemy_debuff_slot_transition_drop_slot_index_shadow(...args));
  const rustAppendSlotIndex = Number(exports.enemy_debuff_slot_transition_append_slot_index_shadow(...args));
  shadow.enemyDebuffSlotOwnerChecks = Number(shadow.enemyDebuffSlotOwnerChecks || 0) + 1;
  shadow.lastEnemyDebuffSlotOwnerCheck = {
    ...normalized,
    owner: 'rust',
    action: rustAction,
    dropSlotIndex: rustDropSlotIndex,
    appendSlotIndex: rustAppendSlotIndex,
  };
  if (
    !exportsOverride
    && (
      Math.abs(rustAction - normalized.jsAction) > 0.000001
      || Math.abs(rustDropSlotIndex - normalized.jsDropSlotIndex) > 0.000001
      || Math.abs(rustAppendSlotIndex - normalized.jsAppendSlotIndex) > 0.000001
    )
  ) {
    shadow.mismatches.push(shadow.lastEnemyDebuffSlotOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastEnemyDebuffSlotOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return {
    owner: 'rust',
    action: rustAction,
    dropSlotIndex: rustDropSlotIndex,
    appendSlotIndex: rustAppendSlotIndex,
  };
}

export function createSimulationCoreEnemyDebuffDecayResolution({
  source = 'unknown',
  stat = '',
  amountBefore = 0,
  turnsBefore = 0,
  jsAmountAfter = 0,
  jsTurnsAfter = 0,
  jsActive = 0,
} = {}, { exportsOverride = null } = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    stat: String(stat || '').toUpperCase(),
    amountBefore: Number(amountBefore || 0),
    turnsBefore: Number(turnsBefore || 0),
    jsAmountAfter: Number(jsAmountAfter || 0),
    jsTurnsAfter: Number(jsTurnsAfter || 0),
    jsActive: Number(jsActive || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasEnemyDebuffDecayExports(exports)) {
    shadow.enemyDebuffDecayOwnerChecks = Number(shadow.enemyDebuffDecayOwnerChecks || 0) + 1;
    shadow.lastEnemyDebuffDecayOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      amountAfter: normalized.jsAmountAfter,
      turnsAfter: normalized.jsTurnsAfter,
      active: normalized.jsActive,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      amountAfter: normalized.jsAmountAfter,
      turnsAfter: normalized.jsTurnsAfter,
      active: normalized.jsActive,
    };
  }

  const rustTurnsAfter = Number(exports.enemy_debuff_turns_after_tick_shadow(
    normalized.turnsBefore,
  ));
  const rustAmountAfter = Number(exports.enemy_debuff_amount_after_tick_shadow(
    normalized.amountBefore,
    rustTurnsAfter,
  ));
  const rustActive = Number(exports.enemy_debuff_active_after_tick_shadow(
    rustAmountAfter,
    rustTurnsAfter,
  ));
  shadow.enemyDebuffDecayOwnerChecks = Number(shadow.enemyDebuffDecayOwnerChecks || 0) + 1;
  shadow.lastEnemyDebuffDecayOwnerCheck = {
    ...normalized,
    owner: 'rust',
    amountAfter: rustAmountAfter,
    turnsAfter: rustTurnsAfter,
    active: rustActive,
  };
  if (
    !exportsOverride
    && (
      Math.abs(rustAmountAfter - normalized.jsAmountAfter) > 0.000001
      || Math.abs(rustTurnsAfter - normalized.jsTurnsAfter) > 0.000001
      || Math.abs(rustActive - normalized.jsActive) > 0.000001
    )
  ) {
    shadow.mismatches.push(shadow.lastEnemyDebuffDecayOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastEnemyDebuffDecayOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return {
    owner: 'rust',
    amountAfter: rustAmountAfter,
    turnsAfter: rustTurnsAfter,
    active: rustActive,
  };
}

export function shadowSingleHitResolution({
  source = 'unknown',
  power = 0,
  resist = 0,
  roll01 = 0,
  critRoll01 = 0,
  sourceIsHero = 0,
  heroAoe = 0,
  chainActive = 0,
  chainMultiplier = 1,
  targetHp = 0,
  shield = 0,
  jsDamage = 0,
  jsAppliedDamage = 0,
  jsAfterHp = 0,
  jsValue = 0,
} = {}) {
  const shadow = getShadowState();
  if (shadow.status !== 'ready' || !hasSingleHitExports(shadow.exports)) return jsValue;
  const rustDamage = Number(shadow.exports.single_hit_damage_shadow(
    Number(power || 0),
    Number(resist || 0),
    Number(roll01 || 0),
    Number(critRoll01 || 0),
    Number(sourceIsHero || 0),
    Number(heroAoe || 0),
    Number(chainActive || 0),
    Number(chainMultiplier || 1),
  ));
  const rustAppliedDamage = Number(shadow.exports.single_hit_applied_damage_shadow(
    Number(targetHp || 0),
    rustDamage,
    Number(shield || 0),
  ));
  const rustAfterHp = Number(shadow.exports.single_hit_after_hp_shadow(
    Number(targetHp || 0),
    rustDamage,
    Number(shield || 0),
  ));
  shadow.singleHitChecks = Number(shadow.singleHitChecks || 0) + 1;
  shadow.lastSingleHitCheck = {
    source,
    power: Number(power || 0),
    resist: Number(resist || 0),
    roll01: Number(roll01 || 0),
    critRoll01: Number(critRoll01 || 0),
    sourceIsHero: Number(sourceIsHero || 0),
    heroAoe: Number(heroAoe || 0),
    chainActive: Number(chainActive || 0),
    chainMultiplier: Number(chainMultiplier || 1),
    targetHp: Number(targetHp || 0),
    shield: Number(shield || 0),
    jsDamage,
    rustDamage,
    jsAppliedDamage,
    rustAppliedDamage,
    jsAfterHp,
    rustAfterHp,
  };
  if (
    Math.abs(rustDamage - jsDamage) > 0.000001
    || Math.abs(rustAppliedDamage - jsAppliedDamage) > 0.000001
    || Math.abs(rustAfterHp - jsAfterHp) > 0.000001
  ) {
    shadow.mismatches.push(shadow.lastSingleHitCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastSingleHitCheck);
  }
  updateShadowDomMarker(shadow);
  return jsValue;
}

export function shadowEnemyDotTick({
  source = 'unknown',
  totalDamageRemaining = 0,
  remainingFires = 0,
  damagePerFire = 0,
  hasTotalDamageRemaining = 0,
  nextFireTurnSerial = 0,
  firesEveryTurns = 1,
  jsDamage = 0,
  jsTotalDamageRemaining = 0,
  jsRemainingFires = 0,
  jsNextFireTurnSerial = 0,
  jsValue = 0,
} = {}) {
  const shadow = getShadowState();
  if (shadow.status !== 'ready' || !hasEnemyDotTickExports(shadow.exports)) return jsValue;
  const rustDamage = Number(shadow.exports.enemy_dot_tick_damage_shadow(
    Number(totalDamageRemaining || 0),
    Number(remainingFires || 0),
    Number(damagePerFire || 0),
    Number(hasTotalDamageRemaining || 0),
  ));
  const rustTotalDamageRemaining = Number(shadow.exports.enemy_dot_tick_total_remaining_shadow(
    Number(totalDamageRemaining || 0),
    Number(remainingFires || 0),
    Number(damagePerFire || 0),
    Number(hasTotalDamageRemaining || 0),
  ));
  const rustRemainingFires = Number(shadow.exports.enemy_dot_tick_remaining_fires_shadow(
    Number(remainingFires || 0),
  ));
  const rustNextFireTurnSerial = Number(shadow.exports.enemy_dot_tick_next_turn_shadow(
    Number(nextFireTurnSerial || 0),
    Number(firesEveryTurns || 1),
  ));
  shadow.enemyDotTickChecks = Number(shadow.enemyDotTickChecks || 0) + 1;
  shadow.lastEnemyDotTickCheck = {
    source,
    totalDamageRemaining: Number(totalDamageRemaining || 0),
    remainingFires: Number(remainingFires || 0),
    damagePerFire: Number(damagePerFire || 0),
    hasTotalDamageRemaining: Number(hasTotalDamageRemaining || 0),
    nextFireTurnSerial: Number(nextFireTurnSerial || 0),
    firesEveryTurns: Number(firesEveryTurns || 1),
    jsDamage: Number(jsDamage || 0),
    rustDamage,
    jsTotalDamageRemaining: Number(jsTotalDamageRemaining || 0),
    rustTotalDamageRemaining,
    jsRemainingFires: Number(jsRemainingFires || 0),
    rustRemainingFires,
    jsNextFireTurnSerial: Number(jsNextFireTurnSerial || 0),
    rustNextFireTurnSerial,
  };
  if (
    Math.abs(rustDamage - Number(jsDamage || 0)) > 0.000001
    || Math.abs(rustTotalDamageRemaining - Number(jsTotalDamageRemaining || 0)) > 0.000001
    || Math.abs(rustRemainingFires - Number(jsRemainingFires || 0)) > 0.000001
    || Math.abs(rustNextFireTurnSerial - Number(jsNextFireTurnSerial || 0)) > 0.000001
  ) {
    shadow.mismatches.push(shadow.lastEnemyDotTickCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastEnemyDotTickCheck);
  }
  updateShadowDomMarker(shadow);
  return jsValue;
}
