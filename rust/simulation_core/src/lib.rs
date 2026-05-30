fn number_or_zero(value: f64) -> f64 {
    if value.is_nan() {
        0.0
    } else {
        value
    }
}

fn unit_interval_or_half(value: f64) -> f64 {
    if value.is_finite() && (0.0..1.0).contains(&value) {
        value
    } else {
        0.5
    }
}

fn round_like_js(value: f64) -> f64 {
    if value.is_finite() {
        (value + 0.5).floor()
    } else {
        value
    }
}

fn positive_floor_or_zero(value: f64) -> f64 {
    if value.is_finite() && value > 0.0 {
        value.floor()
    } else {
        0.0
    }
}

fn positive_floor_or_one(value: f64) -> f64 {
    let normalized = if value.is_finite() && value != 0.0 {
        value
    } else {
        1.0
    };
    normalized.floor().max(1.0)
}

pub fn combat_power(atk: f64, def: f64, hp: f64) -> f64 {
    let a = number_or_zero(atk);
    let d = number_or_zero(def);
    let h = number_or_zero(hp);

    round_like_js((a + d + (h / 10.0)) * 100.0) / 100.0
}

pub fn effective_stat_value(
    base: f64,
    party_buff: f64,
    enemy_debuff: f64,
    is_hero: f64,
    is_enemy: f64,
) -> f64 {
    let mut value = number_or_zero(base);
    if number_or_zero(is_hero) == 1.0 {
        value += number_or_zero(party_buff);
    } else if number_or_zero(is_enemy) == 1.0 {
        value -= number_or_zero(enemy_debuff);
    }

    value.max(0.0)
}

pub fn combat_outcome_code(energy: f64, party_hp: f64, living_heroes: f64) -> f64 {
    if number_or_zero(energy) <= 0.0 {
        return 1.0;
    }
    if number_or_zero(party_hp) <= 0.0 {
        return 2.0;
    }
    if number_or_zero(living_heroes) <= 0.0 {
        return 3.0;
    }
    0.0
}

pub fn turn_actor_eligibility_code(
    turn_type: f64,
    actor_exists: f64,
    actor_hp: f64,
    party_hp: f64,
    round_active: f64,
    pending_group_matches: f64,
    blue_buff_sequence_active: f64,
) -> f64 {
    let is_round_pending =
        number_or_zero(round_active) == 1.0 && number_or_zero(pending_group_matches) == 1.0;

    if number_or_zero(turn_type) == 0.0 {
        if number_or_zero(actor_exists) != 1.0 {
            return 0.0;
        }
        if number_or_zero(party_hp) > 0.0 || is_round_pending {
            return 1.0;
        }
        return 0.0;
    }

    if number_or_zero(turn_type) == 1.0 {
        if number_or_zero(blue_buff_sequence_active) == 1.0 {
            return 2.0;
        }
        if number_or_zero(actor_exists) != 1.0 {
            return 0.0;
        }
        if number_or_zero(actor_hp) > 0.0 || is_round_pending {
            return 1.0;
        }
    }

    0.0
}

pub fn turn_phase_from_type(turn_type: f64) -> f64 {
    if number_or_zero(turn_type) == 0.0 {
        0.0
    } else {
        2.0
    }
}

fn enemy_kind_code(value: f64) -> f64 {
    match number_or_zero(value).floor() as i32 {
        1 => 1.0,
        2 => 2.0,
        3 => 3.0,
        _ => 0.0,
    }
}

fn clamp_roll(value: f64) -> f64 {
    number_or_zero(value).clamp(0.0, 0.999_999_999)
}

fn enemy_skill_base_choice(kind_code: f64, hp: f64, max_hp: f64, roll: f64) -> (f64, f64) {
    let hp_value = number_or_zero(hp);
    let max_value = number_or_zero(max_hp);
    let is_damaged = hp_value < max_value;
    let roll_value = clamp_roll(roll);
    match enemy_kind_code(kind_code) {
        1.0 => {
            if roll_value < 0.30 {
                (1.0, 1.0)
            } else if roll_value < 0.85 {
                (2.0, 2.0)
            } else {
                (0.0, 0.0)
            }
        }
        2.0 => {
            if roll_value < 0.25 {
                (3.0, 1.0)
            } else if roll_value < 0.65 {
                (2.0, 2.0)
            } else {
                (0.0, 0.0)
            }
        }
        3.0 => {
            if is_damaged && roll_value < 0.20 {
                (4.0, 1.0)
            } else if is_damaged && roll_value < 0.49 {
                (5.0, 2.0)
            } else {
                (0.0, 0.0)
            }
        }
        _ => (0.0, 0.0),
    }
}

fn enemy_regular_skill_code(kind_code: f64) -> f64 {
    match enemy_kind_code(kind_code) {
        1.0 | 2.0 => 2.0,
        3.0 => 5.0,
        _ => 0.0,
    }
}

fn enemy_skill_apply_board_fallback(
    kind_code: f64,
    board_ready: f64,
    selected_code: f64,
    branch_code: f64,
) -> (f64, f64) {
    if number_or_zero(board_ready) == 1.0 {
        return (selected_code, branch_code);
    }
    if selected_code != 1.0 && selected_code != 3.0 {
        return (selected_code, branch_code);
    }
    let blocked_branch = if branch_code == 1.0 { 5.0 } else { 6.0 };
    (enemy_regular_skill_code(kind_code), blocked_branch)
}

fn enemy_skill_chimerilass_heal_choice(
    hp: f64,
    max_hp: f64,
    damaged_allies_count: f64,
    heal_roll: f64,
) -> Option<(f64, f64)> {
    let damaged = positive_floor_or_zero(damaged_allies_count);
    let mut weighted: [(f64, f64); 3] = [(0.0, 0.0); 3];
    let mut count = 0usize;
    if damaged > 1.0 {
        weighted[count] = (7.0, 20.0);
        count += 1;
    }
    if damaged > 0.0 {
        weighted[count] = (6.0, 15.0);
        count += 1;
    }
    if number_or_zero(hp) < number_or_zero(max_hp) {
        weighted[count] = (5.0, 65.0);
        count += 1;
    }
    if count == 0 {
        return None;
    }
    let total: f64 = weighted[..count].iter().map(|(_, weight)| *weight).sum();
    let mut pick = clamp_roll(heal_roll) * total;
    let mut selected = weighted[count - 1].0;
    for (skill_code, weight) in weighted[..count].iter() {
        pick -= *weight;
        if pick <= 0.0 {
            selected = *skill_code;
            break;
        }
    }
    Some((selected, 4.0))
}

fn enemy_skill_choice_pair(
    kind_code: f64,
    hp: f64,
    max_hp: f64,
    damaged_allies_count: f64,
    board_ready: f64,
    roll: f64,
    heal_roll: f64,
) -> (f64, f64) {
    let kind = enemy_kind_code(kind_code);
    let hp_value = number_or_zero(hp);
    let max_input = if max_hp.is_finite() {
        max_hp
    } else if hp_value != 0.0 {
        hp_value
    } else {
        1.0
    };
    let max_value = max_input.max(1.0);
    let below_half_hp = hp_value <= (max_value * 0.5).floor();

    if kind == 3.0 {
        if !below_half_hp {
            let decision = enemy_skill_base_choice(kind, hp_value, max_value, roll);
            if decision.0 == 5.0 || decision.0 == 6.0 || decision.0 == 7.0 || decision.0 == 4.0 {
                return (2.0, 3.0);
            }
            return decision;
        }
        if let Some(decision) =
            enemy_skill_chimerilass_heal_choice(hp_value, max_value, damaged_allies_count, heal_roll)
        {
            return decision;
        }
    }

    let decision = enemy_skill_base_choice(kind, hp_value, max_value, roll);
    enemy_skill_apply_board_fallback(kind, board_ready, decision.0, decision.1)
}

pub fn enemy_skill_choice_selected_code(
    kind_code: f64,
    hp: f64,
    max_hp: f64,
    damaged_allies_count: f64,
    board_ready: f64,
    roll: f64,
    heal_roll: f64,
) -> f64 {
    enemy_skill_choice_pair(
        kind_code,
        hp,
        max_hp,
        damaged_allies_count,
        board_ready,
        roll,
        heal_roll,
    )
    .0
}

pub fn enemy_skill_choice_branch_code(
    kind_code: f64,
    hp: f64,
    max_hp: f64,
    damaged_allies_count: f64,
    board_ready: f64,
    roll: f64,
    heal_roll: f64,
) -> f64 {
    enemy_skill_choice_pair(
        kind_code,
        hp,
        max_hp,
        damaged_allies_count,
        board_ready,
        roll,
        heal_roll,
    )
    .1
}

pub fn turn_order_actor_in_phase(
    actor_type: f64,
    phase_type: f64,
    uid: f64,
    hp: f64,
    is_alive: f64,
    able_to_act: f64,
    disabled: f64,
    stunned: f64,
    stopped: f64,
    paralyzed: f64,
    status_blocked: f64,
) -> f64 {
    let phase = if number_or_zero(phase_type) == 1.0 {
        1.0
    } else {
        0.0
    };
    let actor_phase = if number_or_zero(actor_type) == 1.0 {
        1.0
    } else {
        0.0
    };
    let hp_value = if hp.is_nan() { 1.0 } else { hp };

    if number_or_zero(uid) <= 0.0 {
        return 0.0;
    }
    if actor_phase != phase {
        return 0.0;
    }
    if hp_value <= 0.0 {
        return 0.0;
    }
    if number_or_zero(is_alive) != 1.0 || number_or_zero(able_to_act) != 1.0 {
        return 0.0;
    }
    if number_or_zero(disabled) == 1.0
        || number_or_zero(stunned) == 1.0
        || number_or_zero(stopped) == 1.0
        || number_or_zero(paralyzed) == 1.0
        || number_or_zero(status_blocked) == 1.0
    {
        return 0.0;
    }

    1.0
}

pub fn turn_order_phase_type(
    requested_phase_type: f64,
    requested_count: f64,
    _alternate_count: f64,
) -> f64 {
    let requested = if number_or_zero(requested_phase_type) == 1.0 {
        1.0
    } else {
        0.0
    };
    if number_or_zero(requested_count) > 0.0 {
        requested
    } else if requested == 1.0 {
        0.0
    } else {
        1.0
    }
}

pub fn turn_order_compare_slots(
    a_uid: f64,
    a_type: f64,
    a_spd: f64,
    b_uid: f64,
    b_type: f64,
    b_spd: f64,
) -> f64 {
    let spd_diff = number_or_zero(b_spd) - number_or_zero(a_spd);
    if spd_diff < 0.0 {
        return -1.0;
    }
    if spd_diff > 0.0 {
        return 1.0;
    }

    let type_diff = number_or_zero(a_type) - number_or_zero(b_type);
    if type_diff < 0.0 {
        return -1.0;
    }
    if type_diff > 0.0 {
        return 1.0;
    }

    let uid_diff = number_or_zero(a_uid) - number_or_zero(b_uid);
    if uid_diff < 0.0 {
        return -1.0;
    }
    if uid_diff > 0.0 {
        return 1.0;
    }

    0.0
}

pub fn round_pointer_next_member_index(round_member_index: f64) -> f64 {
    positive_floor_or_zero(round_member_index) + 1.0
}

pub fn round_pointer_group_complete(next_member_index: f64, group_member_count: f64) -> f64 {
    if positive_floor_or_zero(next_member_index) >= positive_floor_or_zero(group_member_count) {
        1.0
    } else {
        0.0
    }
}

pub fn round_pointer_next_group_index(round_group_index: f64) -> f64 {
    positive_floor_or_zero(round_group_index) + 1.0
}

pub fn round_pointer_round_complete(
    next_group_index: f64,
    group_count: f64,
    group_complete: f64,
) -> f64 {
    if number_or_zero(group_complete) == 1.0
        && positive_floor_or_zero(next_group_index) >= positive_floor_or_zero(group_count)
    {
        1.0
    } else {
        0.0
    }
}

pub fn round_pointer_next_team_phase_type(team_phase_type: f64) -> f64 {
    if number_or_zero(team_phase_type) == 1.0 {
        0.0
    } else {
        1.0
    }
}

pub fn round_pointer_advance_code(group_complete: f64, round_complete: f64) -> f64 {
    if number_or_zero(round_complete) == 1.0 {
        2.0
    } else if number_or_zero(group_complete) == 1.0 {
        1.0
    } else {
        0.0
    }
}

fn js_to_uint32(value: f64) -> u32 {
    if !value.is_finite() {
        return 0;
    }
    value.trunc().rem_euclid(4294967296.0) as u32
}

fn seeded_rng_initial_state(seed: f64) -> u32 {
    let initial = if seed == 0.0 || seed.is_nan() {
        1.0
    } else {
        seed
    };
    let state = js_to_uint32(initial);
    if state == 0 {
        1
    } else {
        state
    }
}

pub fn seeded_rng_next_state(seed: f64, draws: f64) -> f64 {
    let mut state = seeded_rng_initial_state(seed);
    let total = number_or_zero(draws).floor().max(0.0) as u32;
    for _ in 0..total {
        state = state.wrapping_mul(1664525).wrapping_add(1013904223);
    }
    state as f64
}

pub fn seeded_rng_next_value(seed: f64, draws: f64) -> f64 {
    seeded_rng_next_state(seed, draws) / 4294967296.0
}

pub fn seeded_rng_index(seed: f64, draws: f64, size: f64) -> f64 {
    let pool_size = number_or_zero(size).floor().max(0.0);
    (seeded_rng_next_value(seed, draws) * pool_size).floor()
}

#[no_mangle]
pub extern "C" fn combat_power_shadow(atk: f64, def: f64, hp: f64) -> f64 {
    combat_power(atk, def, hp)
}

#[no_mangle]
pub extern "C" fn effective_stat_value_shadow(
    base: f64,
    party_buff: f64,
    enemy_debuff: f64,
    is_hero: f64,
    is_enemy: f64,
) -> f64 {
    effective_stat_value(base, party_buff, enemy_debuff, is_hero, is_enemy)
}

#[no_mangle]
pub extern "C" fn combat_outcome_code_shadow(
    energy: f64,
    party_hp: f64,
    living_heroes: f64,
) -> f64 {
    combat_outcome_code(energy, party_hp, living_heroes)
}

#[no_mangle]
pub extern "C" fn turn_actor_eligibility_code_shadow(
    turn_type: f64,
    actor_exists: f64,
    actor_hp: f64,
    party_hp: f64,
    round_active: f64,
    pending_group_matches: f64,
    blue_buff_sequence_active: f64,
) -> f64 {
    turn_actor_eligibility_code(
        turn_type,
        actor_exists,
        actor_hp,
        party_hp,
        round_active,
        pending_group_matches,
        blue_buff_sequence_active,
    )
}

#[no_mangle]
pub extern "C" fn turn_phase_from_type_shadow(turn_type: f64) -> f64 {
    turn_phase_from_type(turn_type)
}

#[no_mangle]
pub extern "C" fn enemy_skill_choice_selected_code_shadow(
    kind_code: f64,
    hp: f64,
    max_hp: f64,
    damaged_allies_count: f64,
    board_ready: f64,
    roll: f64,
    heal_roll: f64,
) -> f64 {
    enemy_skill_choice_selected_code(
        kind_code,
        hp,
        max_hp,
        damaged_allies_count,
        board_ready,
        roll,
        heal_roll,
    )
}

#[no_mangle]
pub extern "C" fn enemy_skill_choice_branch_code_shadow(
    kind_code: f64,
    hp: f64,
    max_hp: f64,
    damaged_allies_count: f64,
    board_ready: f64,
    roll: f64,
    heal_roll: f64,
) -> f64 {
    enemy_skill_choice_branch_code(
        kind_code,
        hp,
        max_hp,
        damaged_allies_count,
        board_ready,
        roll,
        heal_roll,
    )
}

#[no_mangle]
pub extern "C" fn turn_order_actor_in_phase_shadow(
    actor_type: f64,
    phase_type: f64,
    uid: f64,
    hp: f64,
    is_alive: f64,
    able_to_act: f64,
    disabled: f64,
    stunned: f64,
    stopped: f64,
    paralyzed: f64,
    status_blocked: f64,
) -> f64 {
    turn_order_actor_in_phase(
        actor_type,
        phase_type,
        uid,
        hp,
        is_alive,
        able_to_act,
        disabled,
        stunned,
        stopped,
        paralyzed,
        status_blocked,
    )
}

#[no_mangle]
pub extern "C" fn turn_order_phase_type_shadow(
    requested_phase_type: f64,
    requested_count: f64,
    alternate_count: f64,
) -> f64 {
    turn_order_phase_type(requested_phase_type, requested_count, alternate_count)
}

#[no_mangle]
pub extern "C" fn turn_order_compare_slots_shadow(
    a_uid: f64,
    a_type: f64,
    a_spd: f64,
    b_uid: f64,
    b_type: f64,
    b_spd: f64,
) -> f64 {
    turn_order_compare_slots(a_uid, a_type, a_spd, b_uid, b_type, b_spd)
}

#[no_mangle]
pub extern "C" fn round_pointer_next_member_index_shadow(round_member_index: f64) -> f64 {
    round_pointer_next_member_index(round_member_index)
}

#[no_mangle]
pub extern "C" fn round_pointer_group_complete_shadow(
    next_member_index: f64,
    group_member_count: f64,
) -> f64 {
    round_pointer_group_complete(next_member_index, group_member_count)
}

#[no_mangle]
pub extern "C" fn round_pointer_next_group_index_shadow(round_group_index: f64) -> f64 {
    round_pointer_next_group_index(round_group_index)
}

#[no_mangle]
pub extern "C" fn round_pointer_round_complete_shadow(
    next_group_index: f64,
    group_count: f64,
    group_complete: f64,
) -> f64 {
    round_pointer_round_complete(next_group_index, group_count, group_complete)
}

#[no_mangle]
pub extern "C" fn round_pointer_next_team_phase_type_shadow(team_phase_type: f64) -> f64 {
    round_pointer_next_team_phase_type(team_phase_type)
}

#[no_mangle]
pub extern "C" fn round_pointer_advance_code_shadow(
    group_complete: f64,
    round_complete: f64,
) -> f64 {
    round_pointer_advance_code(group_complete, round_complete)
}

#[no_mangle]
pub extern "C" fn seeded_rng_next_state_shadow(seed: f64, draws: f64) -> f64 {
    seeded_rng_next_state(seed, draws)
}

#[no_mangle]
pub extern "C" fn seeded_rng_next_value_shadow(seed: f64, draws: f64) -> f64 {
    seeded_rng_next_value(seed, draws)
}

#[no_mangle]
pub extern "C" fn seeded_rng_index_shadow(seed: f64, draws: f64, size: f64) -> f64 {
    seeded_rng_index(seed, draws, size)
}

pub fn single_hit_damage(
    power: f64,
    resist: f64,
    roll01: f64,
    crit_roll01: f64,
    source_is_hero: f64,
    hero_aoe: f64,
    chain_active: f64,
    chain_multiplier: f64,
) -> f64 {
    let source_is_hero = number_or_zero(source_is_hero) == 1.0;
    let hero_aoe = number_or_zero(hero_aoe) == 1.0;
    let roll = 0.8 + (unit_interval_or_half(roll01) * 0.4);
    let power = number_or_zero(power);
    let resist = number_or_zero(resist);
    let raw_damage = if source_is_hero && !hero_aoe {
        (power - (resist * 0.35)) * roll
    } else {
        (power - (resist / 2.0)) * roll
    };
    let base_damage = raw_damage.ceil().max(1.0);
    let buff = power.max(0.0);
    let mut crit_multiplier_raw = 1.1;
    if buff > 0.0 {
        crit_multiplier_raw = (1.0 + (buff / 10.0)).min(3.0);
    }
    crit_multiplier_raw = crit_multiplier_raw.min(3.0);
    let crit_multiplier = if source_is_hero {
        crit_multiplier_raw
    } else {
        1.0 + ((crit_multiplier_raw - 1.0) * 0.1)
    };
    let crit_value = if number_or_zero(crit_roll01) <= 0.1 {
        base_damage * crit_multiplier
    } else {
        base_damage
    };
    let mut damage = crit_value.ceil().max(1.0);
    if source_is_hero && number_or_zero(chain_active) == 1.0 {
        let multiplier = number_or_zero(chain_multiplier);
        damage = (damage * if multiplier != 0.0 { multiplier } else { 1.0 }).ceil();
    }
    damage.max(1.0)
}

pub fn single_hit_applied_damage(target_hp: f64, incoming_damage: f64, shield: f64) -> f64 {
    let before_hp = number_or_zero(target_hp);
    let incoming = number_or_zero(incoming_damage).max(0.0);
    let shield_absorbed = number_or_zero(shield).max(0.0).min(incoming);
    let damage_to_hp = (incoming - shield_absorbed).max(0.0);
    let after_hp = (before_hp - damage_to_hp).max(0.0);
    (before_hp - after_hp).max(0.0)
}

pub fn single_hit_after_hp(target_hp: f64, incoming_damage: f64, shield: f64) -> f64 {
    let before_hp = number_or_zero(target_hp);
    let incoming = number_or_zero(incoming_damage).max(0.0);
    let shield_absorbed = number_or_zero(shield).max(0.0).min(incoming);
    let damage_to_hp = (incoming - shield_absorbed).max(0.0);
    (before_hp - damage_to_hp).max(0.0)
}

pub fn party_damage_absorbed(incoming_damage: f64, shield: f64) -> f64 {
    let incoming = number_or_zero(incoming_damage).max(0.0);
    let shield = number_or_zero(shield).max(0.0);
    shield.min(incoming)
}

pub fn party_damage_after_shield(incoming_damage: f64, shield: f64) -> f64 {
    let incoming = number_or_zero(incoming_damage).max(0.0);
    (incoming - party_damage_absorbed(incoming_damage, shield)).max(0.0)
}

pub fn party_damage_shield_after(incoming_damage: f64, shield: f64) -> f64 {
    let shield = number_or_zero(shield).max(0.0);
    (shield - party_damage_absorbed(incoming_damage, shield)).max(0.0)
}

pub fn party_damage_hero_after_hp(hero_hp: f64, damage_after_shield: f64) -> f64 {
    let before_hp = number_or_zero(hero_hp).max(0.0);
    let damage = number_or_zero(damage_after_shield).max(0.0);
    (before_hp - damage).max(0.0)
}

pub fn party_damage_party_hp_after(
    hero_count: f64,
    hero0_hp: f64,
    hero1_hp: f64,
    hero2_hp: f64,
    hero3_hp: f64,
    damage_after_shield: f64,
) -> f64 {
    let values = [hero0_hp, hero1_hp, hero2_hp, hero3_hp];
    values
        .iter()
        .take(combatant_count(hero_count))
        .map(|hp| party_damage_hero_after_hp(*hp, damage_after_shield))
        .sum()
}

pub fn enemy_dot_tick_damage(
    total_damage_remaining: f64,
    remaining_fires: f64,
    damage_per_fire: f64,
    has_total_damage_remaining: f64,
) -> f64 {
    let fires = number_or_zero(remaining_fires).floor().max(1.0);
    if number_or_zero(has_total_damage_remaining) == 1.0 {
        let remaining = number_or_zero(total_damage_remaining).floor().max(0.0);
        let base = (remaining / fires).floor();
        let extra = if remaining % fires > 0.0 { 1.0 } else { 0.0 };
        (base + extra).max(1.0)
    } else {
        let raw = number_or_zero(damage_per_fire);
        let fallback = if raw != 0.0 { raw } else { 1.0 };
        round_like_js(fallback).max(1.0)
    }
}

pub fn enemy_dot_tick_total_remaining(
    total_damage_remaining: f64,
    remaining_fires: f64,
    damage_per_fire: f64,
    has_total_damage_remaining: f64,
) -> f64 {
    if number_or_zero(has_total_damage_remaining) != 1.0 {
        return 0.0;
    }
    let remaining = number_or_zero(total_damage_remaining).floor().max(0.0);
    let damage = enemy_dot_tick_damage(
        total_damage_remaining,
        remaining_fires,
        damage_per_fire,
        has_total_damage_remaining,
    );
    (remaining - damage).max(0.0)
}

pub fn enemy_dot_tick_remaining_fires(remaining_fires: f64) -> f64 {
    (number_or_zero(remaining_fires).floor() - 1.0).max(0.0)
}

pub fn enemy_dot_tick_next_turn(next_fire_turn_serial: f64, fires_every_turns: f64) -> f64 {
    number_or_zero(next_fire_turn_serial) + number_or_zero(fires_every_turns).floor().max(1.0)
}

pub fn enemy_dot_packet_target_uid(enemy_uid: f64) -> f64 {
    number_or_zero(enemy_uid)
}

pub fn enemy_dot_packet_source_uid(actor_uid: f64) -> f64 {
    number_or_zero(actor_uid)
}

pub fn enemy_dot_packet_remaining_fires(total_ticks: f64) -> f64 {
    positive_floor_or_one(total_ticks)
}

pub fn enemy_dot_packet_total_damage_remaining(total_damage: f64) -> f64 {
    positive_floor_or_one(total_damage)
}

pub fn enemy_dot_packet_fires_every_ticks(fires_every_ticks: f64) -> f64 {
    positive_floor_or_one(fires_every_ticks)
}

pub fn enemy_dot_packet_next_fire_tick(now_tick: f64, start_after_ticks: f64) -> f64 {
    number_or_zero(now_tick) + positive_floor_or_one(start_after_ticks)
}

pub fn enemy_dot_packet_fires_every_turns(fires_every_turns: f64) -> f64 {
    positive_floor_or_one(fires_every_turns)
}

pub fn enemy_dot_packet_next_fire_turn_serial(now_turn_serial: f64, start_after_turns: f64) -> f64 {
    number_or_zero(now_turn_serial) + positive_floor_or_one(start_after_turns)
}

pub fn enemy_dot_packet_last_processed_turn_serial(now_turn_serial: f64) -> f64 {
    number_or_zero(now_turn_serial)
}

pub fn enemy_dot_lifecycle_action(
    cadence_is_turn: f64,
    dot_target_uid: f64,
    target_uid: f64,
    remaining_fires: f64,
    has_total_damage_remaining: f64,
    total_damage_remaining: f64,
    target_alive: f64,
    current_turn_serial: f64,
    next_fire_turn_serial: f64,
    last_processed_turn_serial: f64,
) -> f64 {
    if number_or_zero(remaining_fires) <= 0.0 {
        return 1.0;
    }
    if number_or_zero(cadence_is_turn) != 1.0 {
        return 0.0;
    }
    if number_or_zero(dot_target_uid) != number_or_zero(target_uid) {
        return 0.0;
    }
    if number_or_zero(has_total_damage_remaining) == 1.0
        && number_or_zero(total_damage_remaining) <= 0.0
    {
        return 1.0;
    }
    if number_or_zero(target_alive) != 1.0 {
        return 1.0;
    }
    if number_or_zero(current_turn_serial) < number_or_zero(next_fire_turn_serial) {
        return 0.0;
    }
    if number_or_zero(last_processed_turn_serial) >= number_or_zero(current_turn_serial) {
        return 0.0;
    }
    2.0
}

pub fn enemy_debuff_turns_after_tick(turns_before: f64) -> f64 {
    let turns = positive_floor_or_zero(turns_before);
    if turns > 0.0 {
        (turns - 1.0).max(0.0)
    } else {
        0.0
    }
}

pub fn enemy_debuff_amount_after_tick(amount_before: f64, turns_after: f64) -> f64 {
    if positive_floor_or_zero(turns_after) <= 0.0 {
        0.0
    } else {
        positive_floor_or_zero(amount_before)
    }
}

pub fn enemy_debuff_active_after_tick(amount_after: f64, turns_after: f64) -> f64 {
    if positive_floor_or_zero(amount_after) > 0.0 && positive_floor_or_zero(turns_after) > 0.0 {
        1.0
    } else {
        0.0
    }
}

pub fn enemy_debuff_apply_amount_after(amount_before: f64, add_amount: f64) -> f64 {
    positive_floor_or_zero(amount_before) + positive_floor_or_zero(add_amount)
}

pub fn enemy_debuff_apply_turns_after(duration_turns: f64) -> f64 {
    positive_floor_or_zero(duration_turns)
}

pub fn enemy_debuff_apply_active(amount_after: f64, turns_after: f64) -> f64 {
    if positive_floor_or_zero(amount_after) > 0.0 && positive_floor_or_zero(turns_after) > 0.0 {
        1.0
    } else {
        0.0
    }
}

fn normalized_debuff_stat_index(value: f64) -> f64 {
    if !value.is_finite() {
        return -1.0;
    }
    let index = value.floor();
    if (0.0..=4.0).contains(&index) {
        index
    } else {
        -1.0
    }
}

fn normalized_debuff_slot_count(value: f64) -> usize {
    if !value.is_finite() {
        return 0;
    }
    value.floor().clamp(0.0, 3.0) as usize
}

fn normalized_debuff_slots(slot_count: f64, slot0: f64, slot1: f64, slot2: f64) -> Vec<f64> {
    let raw = [
        normalized_debuff_stat_index(slot0),
        normalized_debuff_stat_index(slot1),
        normalized_debuff_stat_index(slot2),
    ];
    raw.iter()
        .take(normalized_debuff_slot_count(slot_count))
        .copied()
        .filter(|index| *index >= 0.0)
        .collect()
}

fn enemy_debuff_slot_transition(
    slot_count: f64,
    slot0_index: f64,
    slot1_index: f64,
    slot2_index: f64,
    applied_stat_index: f64,
    active: f64,
) -> (f64, f64, f64) {
    let applied = normalized_debuff_stat_index(applied_stat_index);
    if applied < 0.0 {
        return (0.0, -1.0, -1.0);
    }

    let slots = normalized_debuff_slots(slot_count, slot0_index, slot1_index, slot2_index);
    let contains_applied = slots.iter().any(|index| *index == applied);
    if number_or_zero(active) <= 0.0 {
        return if contains_applied {
            (3.0, applied, -1.0)
        } else {
            (0.0, -1.0, -1.0)
        };
    }

    if contains_applied {
        return (0.0, -1.0, -1.0);
    }
    if slots.len() >= 3 {
        return (2.0, slots[0], applied);
    }
    (1.0, -1.0, applied)
}

pub fn enemy_debuff_slot_transition_action(
    slot_count: f64,
    slot0_index: f64,
    slot1_index: f64,
    slot2_index: f64,
    applied_stat_index: f64,
    active: f64,
) -> f64 {
    enemy_debuff_slot_transition(
        slot_count,
        slot0_index,
        slot1_index,
        slot2_index,
        applied_stat_index,
        active,
    )
    .0
}

pub fn enemy_debuff_slot_transition_drop_slot_index(
    slot_count: f64,
    slot0_index: f64,
    slot1_index: f64,
    slot2_index: f64,
    applied_stat_index: f64,
    active: f64,
) -> f64 {
    enemy_debuff_slot_transition(
        slot_count,
        slot0_index,
        slot1_index,
        slot2_index,
        applied_stat_index,
        active,
    )
    .1
}

pub fn enemy_debuff_slot_transition_append_slot_index(
    slot_count: f64,
    slot0_index: f64,
    slot1_index: f64,
    slot2_index: f64,
    applied_stat_index: f64,
    active: f64,
) -> f64 {
    enemy_debuff_slot_transition(
        slot_count,
        slot0_index,
        slot1_index,
        slot2_index,
        applied_stat_index,
        active,
    )
    .2
}

fn combatant_count(value: f64) -> usize {
    number_or_zero(value).floor().clamp(0.0, 4.0) as usize
}

fn side_alive_count(count: f64, hp0: f64, hp1: f64, hp2: f64, hp3: f64) -> f64 {
    let values = [hp0, hp1, hp2, hp3];
    values
        .iter()
        .take(combatant_count(count))
        .filter(|hp| number_or_zero(**hp) > 0.0)
        .count() as f64
}

pub fn turn_summary_code(
    hero_count: f64,
    hero0_hp: f64,
    hero1_hp: f64,
    hero2_hp: f64,
    hero3_hp: f64,
    enemy_count: f64,
    enemy0_hp: f64,
    enemy1_hp: f64,
    enemy2_hp: f64,
    enemy3_hp: f64,
) -> f64 {
    let hero_count = combatant_count(hero_count) as f64;
    let enemy_count = combatant_count(enemy_count) as f64;
    let hero_alive = side_alive_count(hero_count, hero0_hp, hero1_hp, hero2_hp, hero3_hp);
    let enemy_alive = side_alive_count(enemy_count, enemy0_hp, enemy1_hp, enemy2_hp, enemy3_hp);
    let hero_defeated = (hero_count - hero_alive).max(0.0);
    let enemy_defeated = (enemy_count - enemy_alive).max(0.0);
    let party_defeated = if hero_count > 0.0 && hero_alive == 0.0 {
        1.0
    } else {
        0.0
    };
    let enemies_defeated = if enemy_alive == 0.0 { 1.0 } else { 0.0 };

    (hero_alive * 100000.0)
        + (hero_defeated * 10000.0)
        + (enemy_alive * 1000.0)
        + (enemy_defeated * 100.0)
        + (party_defeated * 10.0)
        + enemies_defeated
}

#[no_mangle]
pub extern "C" fn single_hit_damage_shadow(
    power: f64,
    resist: f64,
    roll01: f64,
    crit_roll01: f64,
    source_is_hero: f64,
    hero_aoe: f64,
    chain_active: f64,
    chain_multiplier: f64,
) -> f64 {
    single_hit_damage(
        power,
        resist,
        roll01,
        crit_roll01,
        source_is_hero,
        hero_aoe,
        chain_active,
        chain_multiplier,
    )
}

#[no_mangle]
pub extern "C" fn single_hit_applied_damage_shadow(
    target_hp: f64,
    incoming_damage: f64,
    shield: f64,
) -> f64 {
    single_hit_applied_damage(target_hp, incoming_damage, shield)
}

#[no_mangle]
pub extern "C" fn single_hit_after_hp_shadow(
    target_hp: f64,
    incoming_damage: f64,
    shield: f64,
) -> f64 {
    single_hit_after_hp(target_hp, incoming_damage, shield)
}

#[no_mangle]
pub extern "C" fn party_damage_absorbed_shadow(incoming_damage: f64, shield: f64) -> f64 {
    party_damage_absorbed(incoming_damage, shield)
}

#[no_mangle]
pub extern "C" fn party_damage_after_shield_shadow(incoming_damage: f64, shield: f64) -> f64 {
    party_damage_after_shield(incoming_damage, shield)
}

#[no_mangle]
pub extern "C" fn party_damage_shield_after_shadow(incoming_damage: f64, shield: f64) -> f64 {
    party_damage_shield_after(incoming_damage, shield)
}

#[no_mangle]
pub extern "C" fn party_damage_hero_after_hp_shadow(hero_hp: f64, damage_after_shield: f64) -> f64 {
    party_damage_hero_after_hp(hero_hp, damage_after_shield)
}

#[no_mangle]
pub extern "C" fn party_damage_party_hp_after_shadow(
    hero_count: f64,
    hero0_hp: f64,
    hero1_hp: f64,
    hero2_hp: f64,
    hero3_hp: f64,
    damage_after_shield: f64,
) -> f64 {
    party_damage_party_hp_after(
        hero_count,
        hero0_hp,
        hero1_hp,
        hero2_hp,
        hero3_hp,
        damage_after_shield,
    )
}

#[no_mangle]
pub extern "C" fn turn_summary_code_shadow(
    hero_count: f64,
    hero0_hp: f64,
    hero1_hp: f64,
    hero2_hp: f64,
    hero3_hp: f64,
    enemy_count: f64,
    enemy0_hp: f64,
    enemy1_hp: f64,
    enemy2_hp: f64,
    enemy3_hp: f64,
) -> f64 {
    turn_summary_code(
        hero_count,
        hero0_hp,
        hero1_hp,
        hero2_hp,
        hero3_hp,
        enemy_count,
        enemy0_hp,
        enemy1_hp,
        enemy2_hp,
        enemy3_hp,
    )
}

#[no_mangle]
pub extern "C" fn enemy_dot_tick_damage_shadow(
    total_damage_remaining: f64,
    remaining_fires: f64,
    damage_per_fire: f64,
    has_total_damage_remaining: f64,
) -> f64 {
    enemy_dot_tick_damage(
        total_damage_remaining,
        remaining_fires,
        damage_per_fire,
        has_total_damage_remaining,
    )
}

#[no_mangle]
pub extern "C" fn enemy_dot_tick_total_remaining_shadow(
    total_damage_remaining: f64,
    remaining_fires: f64,
    damage_per_fire: f64,
    has_total_damage_remaining: f64,
) -> f64 {
    enemy_dot_tick_total_remaining(
        total_damage_remaining,
        remaining_fires,
        damage_per_fire,
        has_total_damage_remaining,
    )
}

#[no_mangle]
pub extern "C" fn enemy_dot_tick_remaining_fires_shadow(remaining_fires: f64) -> f64 {
    enemy_dot_tick_remaining_fires(remaining_fires)
}

#[no_mangle]
pub extern "C" fn enemy_dot_tick_next_turn_shadow(
    next_fire_turn_serial: f64,
    fires_every_turns: f64,
) -> f64 {
    enemy_dot_tick_next_turn(next_fire_turn_serial, fires_every_turns)
}

#[no_mangle]
pub extern "C" fn enemy_dot_packet_target_uid_shadow(enemy_uid: f64) -> f64 {
    enemy_dot_packet_target_uid(enemy_uid)
}

#[no_mangle]
pub extern "C" fn enemy_dot_packet_source_uid_shadow(actor_uid: f64) -> f64 {
    enemy_dot_packet_source_uid(actor_uid)
}

#[no_mangle]
pub extern "C" fn enemy_dot_packet_remaining_fires_shadow(total_ticks: f64) -> f64 {
    enemy_dot_packet_remaining_fires(total_ticks)
}

#[no_mangle]
pub extern "C" fn enemy_dot_packet_total_damage_remaining_shadow(total_damage: f64) -> f64 {
    enemy_dot_packet_total_damage_remaining(total_damage)
}

#[no_mangle]
pub extern "C" fn enemy_dot_packet_fires_every_ticks_shadow(fires_every_ticks: f64) -> f64 {
    enemy_dot_packet_fires_every_ticks(fires_every_ticks)
}

#[no_mangle]
pub extern "C" fn enemy_dot_packet_next_fire_tick_shadow(
    now_tick: f64,
    start_after_ticks: f64,
) -> f64 {
    enemy_dot_packet_next_fire_tick(now_tick, start_after_ticks)
}

#[no_mangle]
pub extern "C" fn enemy_dot_packet_fires_every_turns_shadow(fires_every_turns: f64) -> f64 {
    enemy_dot_packet_fires_every_turns(fires_every_turns)
}

#[no_mangle]
pub extern "C" fn enemy_dot_packet_next_fire_turn_serial_shadow(
    now_turn_serial: f64,
    start_after_turns: f64,
) -> f64 {
    enemy_dot_packet_next_fire_turn_serial(now_turn_serial, start_after_turns)
}

#[no_mangle]
pub extern "C" fn enemy_dot_packet_last_processed_turn_serial_shadow(now_turn_serial: f64) -> f64 {
    enemy_dot_packet_last_processed_turn_serial(now_turn_serial)
}

#[no_mangle]
pub extern "C" fn enemy_dot_lifecycle_action_shadow(
    cadence_is_turn: f64,
    dot_target_uid: f64,
    target_uid: f64,
    remaining_fires: f64,
    has_total_damage_remaining: f64,
    total_damage_remaining: f64,
    target_alive: f64,
    current_turn_serial: f64,
    next_fire_turn_serial: f64,
    last_processed_turn_serial: f64,
) -> f64 {
    enemy_dot_lifecycle_action(
        cadence_is_turn,
        dot_target_uid,
        target_uid,
        remaining_fires,
        has_total_damage_remaining,
        total_damage_remaining,
        target_alive,
        current_turn_serial,
        next_fire_turn_serial,
        last_processed_turn_serial,
    )
}

#[no_mangle]
pub extern "C" fn enemy_debuff_turns_after_tick_shadow(turns_before: f64) -> f64 {
    enemy_debuff_turns_after_tick(turns_before)
}

#[no_mangle]
pub extern "C" fn enemy_debuff_amount_after_tick_shadow(
    amount_before: f64,
    turns_after: f64,
) -> f64 {
    enemy_debuff_amount_after_tick(amount_before, turns_after)
}

#[no_mangle]
pub extern "C" fn enemy_debuff_active_after_tick_shadow(
    amount_after: f64,
    turns_after: f64,
) -> f64 {
    enemy_debuff_active_after_tick(amount_after, turns_after)
}

#[no_mangle]
pub extern "C" fn enemy_debuff_apply_amount_after_shadow(
    amount_before: f64,
    add_amount: f64,
) -> f64 {
    enemy_debuff_apply_amount_after(amount_before, add_amount)
}

#[no_mangle]
pub extern "C" fn enemy_debuff_apply_turns_after_shadow(duration_turns: f64) -> f64 {
    enemy_debuff_apply_turns_after(duration_turns)
}

#[no_mangle]
pub extern "C" fn enemy_debuff_apply_active_shadow(amount_after: f64, turns_after: f64) -> f64 {
    enemy_debuff_apply_active(amount_after, turns_after)
}

#[no_mangle]
pub extern "C" fn enemy_debuff_slot_transition_action_shadow(
    slot_count: f64,
    slot0_index: f64,
    slot1_index: f64,
    slot2_index: f64,
    applied_stat_index: f64,
    active: f64,
) -> f64 {
    enemy_debuff_slot_transition_action(
        slot_count,
        slot0_index,
        slot1_index,
        slot2_index,
        applied_stat_index,
        active,
    )
}

#[no_mangle]
pub extern "C" fn enemy_debuff_slot_transition_drop_slot_index_shadow(
    slot_count: f64,
    slot0_index: f64,
    slot1_index: f64,
    slot2_index: f64,
    applied_stat_index: f64,
    active: f64,
) -> f64 {
    enemy_debuff_slot_transition_drop_slot_index(
        slot_count,
        slot0_index,
        slot1_index,
        slot2_index,
        applied_stat_index,
        active,
    )
}

#[no_mangle]
pub extern "C" fn enemy_debuff_slot_transition_append_slot_index_shadow(
    slot_count: f64,
    slot0_index: f64,
    slot1_index: f64,
    slot2_index: f64,
    applied_stat_index: f64,
    active: f64,
) -> f64 {
    enemy_debuff_slot_transition_append_slot_index(
        slot_count,
        slot0_index,
        slot1_index,
        slot2_index,
        applied_stat_index,
        active,
    )
}

#[cfg(test)]
mod single_hit_resolution_tests {
    use super::*;

    #[test]
    fn mirrors_current_single_hit_resolution_cases() {
        let cases = [
            (
                18.0, 12.0, 0.5, 0.9, 1.0, 0.0, 0.0, 1.0, 40.0, 0.0, 14.0, 14.0, 26.0,
            ),
            (
                30.0, 20.0, 0.25, 0.05, 0.0, 0.0, 0.0, 1.0, 5.0, 0.0, 22.0, 5.0, 0.0,
            ),
            (
                28.0, 14.0, 0.75, 0.11, 1.0, 1.0, 1.0, 1.5, 20.0, 0.0, 36.0, 20.0, 0.0,
            ),
            (
                18.0, 10.0, 0.0, 0.9, 0.0, 0.0, 0.0, 1.0, 16.0, 6.0, 11.0, 5.0, 11.0,
            ),
        ];

        for (
            power,
            resist,
            roll,
            crit,
            hero,
            aoe,
            chain,
            chain_mult,
            hp,
            shield,
            damage,
            applied,
            after_hp,
        ) in cases
        {
            let rust_damage =
                single_hit_damage(power, resist, roll, crit, hero, aoe, chain, chain_mult);
            assert_eq!(rust_damage, damage);
            assert_eq!(single_hit_applied_damage(hp, rust_damage, shield), applied);
            assert_eq!(single_hit_after_hp(hp, rust_damage, shield), after_hp);
        }
    }

    #[test]
    fn mirrors_current_party_damage_accounting_cases() {
        let cases = [
            (
                12.0,
                5.0,
                [20.0, 16.0, 12.0, 8.0],
                5.0,
                7.0,
                0.0,
                [13.0, 9.0, 5.0, 1.0],
                28.0,
            ),
            (
                4.0,
                10.0,
                [20.0, 16.0, 12.0, 8.0],
                4.0,
                0.0,
                6.0,
                [20.0, 16.0, 12.0, 8.0],
                56.0,
            ),
            (
                40.0,
                0.0,
                [9.0, 6.0, 3.0, 1.0],
                0.0,
                40.0,
                0.0,
                [0.0, 0.0, 0.0, 0.0],
                0.0,
            ),
        ];

        for (incoming, shield, hp, absorbed, after_shield, shield_after, expected_hp, party_hp) in
            cases
        {
            assert_eq!(party_damage_absorbed(incoming, shield), absorbed);
            assert_eq!(party_damage_after_shield(incoming, shield), after_shield);
            assert_eq!(party_damage_shield_after(incoming, shield), shield_after);
            for index in 0..4 {
                assert_eq!(
                    party_damage_hero_after_hp(hp[index], after_shield),
                    expected_hp[index]
                );
            }
            assert_eq!(
                party_damage_party_hp_after(4.0, hp[0], hp[1], hp[2], hp[3], after_shield),
                party_hp
            );
        }
    }

    #[test]
    fn mirrors_current_turn_summary_cases() {
        let cases = [
            (
                4.0,
                [35.0, 28.0, 32.0, 30.0],
                3.0,
                [18.0, 22.0, 16.0, 0.0],
                403000.0,
            ),
            (
                4.0,
                [0.0, 28.0, 32.0, 30.0],
                3.0,
                [0.0, 22.0, 16.0, 0.0],
                312100.0,
            ),
            (
                4.0,
                [0.0, 0.0, 0.0, 0.0],
                2.0,
                [9.0, 0.0, 0.0, 0.0],
                41110.0,
            ),
            (
                4.0,
                [10.0, 12.0, 8.0, 6.0],
                3.0,
                [0.0, 0.0, 0.0, 0.0],
                400301.0,
            ),
            (
                4.0,
                [10.0, 12.0, 8.0, 6.0],
                0.0,
                [0.0, 0.0, 0.0, 0.0],
                400001.0,
            ),
        ];

        for (hero_count, hero_hp, enemy_count, enemy_hp, expected) in cases {
            assert_eq!(
                turn_summary_code(
                    hero_count,
                    hero_hp[0],
                    hero_hp[1],
                    hero_hp[2],
                    hero_hp[3],
                    enemy_count,
                    enemy_hp[0],
                    enemy_hp[1],
                    enemy_hp[2],
                    enemy_hp[3],
                ),
                expected
            );
        }
    }

    #[test]
    fn mirrors_current_enemy_dot_tick_cases() {
        let cases = [
            (16.0, 3.0, 0.0, 1.0, 8.0, 1.0, 6.0, 10.0, 2.0, 9.0),
            (8.0, 2.0, 0.0, 1.0, 12.0, 1.0, 4.0, 4.0, 1.0, 13.0),
            (4.0, 1.0, 0.0, 1.0, 14.0, 1.0, 4.0, 0.0, 0.0, 15.0),
            (0.0, 3.0, 2.4, 0.0, 20.0, 2.0, 2.0, 0.0, 2.0, 22.0),
            (7.9, 3.0, 0.0, 1.0, 25.0, 3.0, 3.0, 4.0, 2.0, 28.0),
        ];

        for (
            total_remaining,
            remaining_fires,
            damage_per_fire,
            has_total,
            next_turn,
            every_turns,
            expected_damage,
            expected_total_remaining,
            expected_remaining_fires,
            expected_next_turn,
        ) in cases
        {
            assert_eq!(
                enemy_dot_tick_damage(total_remaining, remaining_fires, damage_per_fire, has_total,),
                expected_damage
            );
            assert_eq!(
                enemy_dot_tick_total_remaining(
                    total_remaining,
                    remaining_fires,
                    damage_per_fire,
                    has_total,
                ),
                expected_total_remaining
            );
            assert_eq!(
                enemy_dot_tick_remaining_fires(remaining_fires),
                expected_remaining_fires
            );
            assert_eq!(
                enemy_dot_tick_next_turn(next_turn, every_turns),
                expected_next_turn
            );
        }
    }

    #[test]
    fn mirrors_current_enemy_dot_lifecycle_cases() {
        let cases = [
            (1.0, 200.0, 200.0, 0.0, 1.0, 12.0, 1.0, 10.0, 10.0, 9.0, 1.0),
            (0.0, 200.0, 200.0, 3.0, 1.0, 12.0, 1.0, 10.0, 10.0, 9.0, 0.0),
            (1.0, 201.0, 200.0, 3.0, 1.0, 12.0, 1.0, 10.0, 10.0, 9.0, 0.0),
            (1.0, 200.0, 200.0, 3.0, 1.0, 0.0, 1.0, 10.0, 10.0, 9.0, 1.0),
            (1.0, 200.0, 200.0, 3.0, 1.0, 12.0, 0.0, 10.0, 10.0, 9.0, 1.0),
            (1.0, 200.0, 200.0, 3.0, 1.0, 12.0, 1.0, 9.0, 10.0, 8.0, 0.0),
            (
                1.0, 200.0, 200.0, 3.0, 1.0, 12.0, 1.0, 10.0, 10.0, 10.0, 0.0,
            ),
            (1.0, 200.0, 200.0, 3.0, 1.0, 12.0, 1.0, 10.0, 10.0, 9.0, 2.0),
            (1.0, 200.0, 200.0, 2.0, 0.0, 0.0, 1.0, 11.0, 11.0, 10.0, 2.0),
        ];

        for (
            cadence_is_turn,
            dot_target_uid,
            target_uid,
            remaining_fires,
            has_total,
            total_remaining,
            target_alive,
            current_turn,
            next_turn,
            last_processed,
            expected,
        ) in cases
        {
            assert_eq!(
                enemy_dot_lifecycle_action(
                    cadence_is_turn,
                    dot_target_uid,
                    target_uid,
                    remaining_fires,
                    has_total,
                    total_remaining,
                    target_alive,
                    current_turn,
                    next_turn,
                    last_processed,
                ),
                expected
            );
        }
    }

    #[test]
    fn mirrors_current_enemy_dot_packet_cases() {
        let cases = [
            (
                100.0, 200.0, 16.0, 8.0, 40.0, 12.0, 1.0, 1.0, 1.0, 1.0, 200.0, 100.0, 8.0, 16.0,
                1.0, 41.0, 1.0, 13.0, 12.0,
            ),
            (
                101.0, 201.0, 25.9, 3.8, 4.0, 20.0, 2.8, 5.2, 2.4, 3.9, 201.0, 101.0, 3.0, 25.0,
                2.0, 9.0, 2.0, 23.0, 20.0,
            ),
            (
                102.0, 202.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 202.0, 102.0, 1.0, 1.0, 1.0,
                1.0, 1.0, 1.0, 0.0,
            ),
            (
                -3.0, -9.0, -12.0, -4.0, 7.0, 8.0, -1.0, -2.0, -3.0, -4.0, -9.0, -3.0, 1.0, 1.0,
                1.0, 8.0, 1.0, 9.0, 8.0,
            ),
            (
                100.8, 200.9, 7.9, 2.9, 10.5, 11.5, 1.9, 2.1, 3.7, 4.2, 200.9, 100.8, 2.0, 7.0,
                1.0, 12.5, 3.0, 15.5, 11.5,
            ),
        ];

        for (
            actor_uid,
            enemy_uid,
            total_damage,
            total_ticks,
            now_tick,
            now_turn,
            fires_every_ticks,
            start_after_ticks,
            fires_every_turns,
            start_after_turns,
            expected_target_uid,
            expected_source_uid,
            expected_remaining_fires,
            expected_total_damage,
            expected_fires_every_ticks,
            expected_next_fire_tick,
            expected_fires_every_turns,
            expected_next_fire_turn,
            expected_last_processed_turn,
        ) in cases
        {
            assert_eq!(enemy_dot_packet_target_uid(enemy_uid), expected_target_uid);
            assert_eq!(enemy_dot_packet_source_uid(actor_uid), expected_source_uid);
            assert_eq!(
                enemy_dot_packet_remaining_fires(total_ticks),
                expected_remaining_fires
            );
            assert_eq!(
                enemy_dot_packet_total_damage_remaining(total_damage),
                expected_total_damage
            );
            assert_eq!(
                enemy_dot_packet_fires_every_ticks(fires_every_ticks),
                expected_fires_every_ticks
            );
            assert_eq!(
                enemy_dot_packet_next_fire_tick(now_tick, start_after_ticks),
                expected_next_fire_tick
            );
            assert_eq!(
                enemy_dot_packet_fires_every_turns(fires_every_turns),
                expected_fires_every_turns
            );
            assert_eq!(
                enemy_dot_packet_next_fire_turn_serial(now_turn, start_after_turns),
                expected_next_fire_turn
            );
            assert_eq!(
                enemy_dot_packet_last_processed_turn_serial(now_turn),
                expected_last_processed_turn
            );
        }
    }

    #[test]
    fn mirrors_current_enemy_debuff_duration_decay_cases() {
        let cases = [
            (4.0, 3.0, 2.0, 4.0, 1.0),
            (4.0, 1.0, 0.0, 0.0, 0.0),
            (0.0, 3.0, 2.0, 0.0, 0.0),
            (-2.0, 3.0, 2.0, 0.0, 0.0),
            (2.0, f64::NAN, 0.0, 0.0, 0.0),
        ];

        for (amount_before, turns_before, expected_turns, expected_amount, expected_active) in cases
        {
            let turns_after = enemy_debuff_turns_after_tick(turns_before);
            let amount_after = enemy_debuff_amount_after_tick(amount_before, turns_after);
            assert_eq!(turns_after, expected_turns);
            assert_eq!(amount_after, expected_amount);
            assert_eq!(
                enemy_debuff_active_after_tick(amount_after, turns_after),
                expected_active
            );
        }
    }

    #[test]
    fn mirrors_current_enemy_debuff_apply_cases() {
        let cases = [
            (0.0, 2.0, 3.0, 2.0, 3.0, 1.0),
            (4.0, 2.0, 3.0, 6.0, 3.0, 1.0),
            (2.8, 2.2, 3.9, 4.0, 3.0, 1.0),
            (-2.0, 2.0, 3.0, 2.0, 3.0, 1.0),
            (4.0, 0.0, 3.0, 4.0, 3.0, 1.0),
            (4.0, 2.0, 0.0, 6.0, 0.0, 0.0),
        ];

        for (
            amount_before,
            add_amount,
            duration_turns,
            expected_amount,
            expected_turns,
            expected_active,
        ) in cases
        {
            let amount_after = enemy_debuff_apply_amount_after(amount_before, add_amount);
            let turns_after = enemy_debuff_apply_turns_after(duration_turns);
            assert_eq!(amount_after, expected_amount);
            assert_eq!(turns_after, expected_turns);
            assert_eq!(
                enemy_debuff_apply_active(amount_after, turns_after),
                expected_active
            );
        }
    }

    #[test]
    fn mirrors_current_enemy_debuff_slot_transition_cases() {
        let cases = [
            (1.0, 0.0, -1.0, -1.0, 0.0, 1.0, 0.0, -1.0, -1.0),
            (2.0, 0.0, 1.0, -1.0, 2.0, 1.0, 1.0, -1.0, 2.0),
            (3.0, 0.0, 1.0, 2.0, 4.0, 1.0, 2.0, 0.0, 4.0),
            (2.0, 0.0, 1.0, -1.0, 1.0, 0.0, 3.0, 1.0, -1.0),
            (2.0, 0.0, 1.0, -1.0, 4.0, 0.0, 0.0, -1.0, -1.0),
            (2.0, 0.0, 1.0, -1.0, -1.0, 1.0, 0.0, -1.0, -1.0),
        ];

        for (
            slot_count,
            slot0,
            slot1,
            slot2,
            applied,
            active,
            expected_action,
            expected_drop,
            expected_append,
        ) in cases
        {
            assert_eq!(
                enemy_debuff_slot_transition_action(
                    slot_count, slot0, slot1, slot2, applied, active,
                ),
                expected_action
            );
            assert_eq!(
                enemy_debuff_slot_transition_drop_slot_index(
                    slot_count, slot0, slot1, slot2, applied, active,
                ),
                expected_drop
            );
            assert_eq!(
                enemy_debuff_slot_transition_append_slot_index(
                    slot_count, slot0, slot1, slot2, applied, active,
                ),
                expected_append
            );
        }
    }

    #[test]
    fn mirrors_current_seeded_rng_cases() {
        let cases = [
            (1.0, 1.0, 6.0, 1015568748.0, 0.23645552527159452, 1.0),
            (1.0, 2.0, 6.0, 1586005467.0, 0.3692706737201661, 2.0),
            (123456789.0, 1.0, 10.0, 920370032.0, 0.2142903469502926, 2.0),
            (
                123456789.0,
                3.0,
                10.0,
                2252023330.0,
                0.5243400414474308,
                5.0,
            ),
            (0.0, 1.0, 6.0, 1015568748.0, 0.23645552527159452, 1.0),
            (
                4294967295.0,
                1.0,
                10.0,
                1012239698.0,
                0.2356804204173386,
                2.0,
            ),
            (987654321.0, 5.0, 3.0, 2873750864.0, 0.669097263365984, 2.0),
        ];

        for (seed, draws, size, expected_state, expected_value, expected_index) in cases {
            assert_eq!(seeded_rng_next_state(seed, draws), expected_state);
            assert!((seeded_rng_next_value(seed, draws) - expected_value).abs() < 0.000000000001);
            assert_eq!(seeded_rng_index(seed, draws, size), expected_index);
        }
    }

    #[test]
    fn mirrors_current_effective_stat_cases() {
        let cases = [
            (10.0, 0.0, 0.0, 1.0, 0.0, 10.0),
            (10.0, 3.0, 0.0, 1.0, 0.0, 13.0),
            (-2.0, 5.0, 0.0, 1.0, 0.0, 3.0),
            (2.0, -5.0, 0.0, 1.0, 0.0, 0.0),
            (10.0, 0.0, 4.0, 0.0, 1.0, 6.0),
            (3.0, 0.0, 9.0, 0.0, 1.0, 0.0),
            (10.0, 0.0, 2.5, 0.0, 1.0, 7.5),
            (7.0, 4.0, 3.0, 0.0, 0.0, 7.0),
        ];

        for (base, party_buff, enemy_debuff, is_hero, is_enemy, expected) in cases {
            assert_eq!(
                effective_stat_value(base, party_buff, enemy_debuff, is_hero, is_enemy),
                expected
            );
        }
    }

    #[test]
    fn mirrors_current_combat_outcome_cases() {
        let cases = [
            (10.0, 40.0, 4.0, 0.0),
            (0.0, 40.0, 4.0, 1.0),
            (-1.0, 40.0, 4.0, 1.0),
            (10.0, 0.0, 4.0, 2.0),
            (10.0, -3.0, 4.0, 2.0),
            (10.0, 12.0, 0.0, 3.0),
            (0.0, 0.0, 0.0, 1.0),
            (5.0, 0.0, 0.0, 2.0),
        ];

        for (energy, party_hp, living_heroes, expected) in cases {
            assert_eq!(
                combat_outcome_code(energy, party_hp, living_heroes),
                expected
            );
        }
    }

    #[test]
    fn mirrors_current_turn_actor_eligibility_cases() {
        let cases = [
            (0.0, 0.0, 0.0, 40.0, 0.0, 0.0, 0.0, 0.0),
            (0.0, 1.0, 10.0, 40.0, 0.0, 0.0, 0.0, 1.0),
            (0.0, 1.0, 10.0, 0.0, 0.0, 0.0, 0.0, 0.0),
            (0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0),
            (1.0, 0.0, 0.0, 40.0, 0.0, 0.0, 0.0, 0.0),
            (1.0, 1.0, 12.0, 40.0, 0.0, 0.0, 0.0, 1.0),
            (1.0, 1.0, 0.0, 40.0, 0.0, 0.0, 0.0, 0.0),
            (1.0, 1.0, 0.0, 40.0, 1.0, 1.0, 0.0, 1.0),
            (1.0, 1.0, 12.0, 40.0, 0.0, 0.0, 1.0, 2.0),
            (2.0, 1.0, 12.0, 40.0, 0.0, 0.0, 0.0, 0.0),
        ];

        for (
            turn_type,
            actor_exists,
            actor_hp,
            party_hp,
            round_active,
            pending_group_matches,
            blue_buff_sequence_active,
            expected,
        ) in cases
        {
            assert_eq!(
                turn_actor_eligibility_code(
                    turn_type,
                    actor_exists,
                    actor_hp,
                    party_hp,
                    round_active,
                    pending_group_matches,
                    blue_buff_sequence_active,
                ),
                expected
            );
        }
    }

    #[test]
    fn mirrors_current_turn_order_group_cases() {
        let actor_cases = [
            // actor_type, phase_type, uid, hp, is_alive, able_to_act, disabled,
            // stunned, stopped, paralyzed, status_blocked, expected
            (0.0, 0.0, 1.0, 40.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0),
            (0.0, 1.0, 1.0, 40.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0),
            (
                1.0, 1.0, 101.0, 20.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0,
            ),
            (1.0, 1.0, 101.0, 0.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0),
            (0.0, 0.0, 2.0, 35.0, 1.0, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0),
            (0.0, 0.0, 3.0, 35.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0),
            (0.0, 0.0, 4.0, 35.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0),
            (0.0, 0.0, 5.0, 35.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0),
        ];

        for (
            actor_type,
            phase_type,
            uid,
            hp,
            is_alive,
            able_to_act,
            disabled,
            stunned,
            stopped,
            paralyzed,
            status_blocked,
            expected,
        ) in actor_cases
        {
            assert_eq!(
                turn_order_actor_in_phase(
                    actor_type,
                    phase_type,
                    uid,
                    hp,
                    is_alive,
                    able_to_act,
                    disabled,
                    stunned,
                    stopped,
                    paralyzed,
                    status_blocked,
                ),
                expected
            );
        }

        assert_eq!(turn_order_phase_type(0.0, 3.0, 2.0), 0.0);
        assert_eq!(turn_order_phase_type(0.0, 0.0, 2.0), 1.0);
        assert_eq!(turn_order_phase_type(1.0, 0.0, 3.0), 0.0);
        assert_eq!(
            turn_order_compare_slots(2.0, 0.0, 20.0, 1.0, 0.0, 11.0),
            -1.0
        );
        assert_eq!(
            turn_order_compare_slots(5.0, 0.0, 10.0, 4.0, 0.0, 10.0),
            1.0
        );
        assert_eq!(
            turn_order_compare_slots(101.0, 1.0, 18.0, 2.0, 0.0, 18.0),
            1.0
        );
    }

    #[test]
    fn mirrors_current_turn_phase_assignment_cases() {
        let cases = [
            (0.0, 0.0),
            (1.0, 2.0),
            (2.0, 2.0),
            (-1.0, 2.0),
        ];

        for (turn_type, expected_phase) in cases {
            assert_eq!(turn_phase_from_type(turn_type), expected_phase);
        }
    }

    #[test]
    fn mirrors_current_enemy_skill_choice_cases() {
        let cases = [
            // kind, hp, max, damaged_allies, board_ready, roll, heal_roll, selected, branch
            (0.0, 10.0, 20.0, 0.0, 1.0, 0.1, 0.0, 0.0, 0.0),
            (1.0, 20.0, 20.0, 0.0, 1.0, 0.1, 0.0, 1.0, 1.0),
            (1.0, 20.0, 20.0, 0.0, 1.0, 0.5, 0.0, 2.0, 2.0),
            (1.0, 20.0, 20.0, 0.0, 1.0, 0.9, 0.0, 0.0, 0.0),
            (2.0, 20.0, 20.0, 0.0, 0.0, 0.1, 0.0, 2.0, 5.0),
            (3.0, 80.0, 100.0, 0.0, 1.0, 0.1, 0.0, 2.0, 3.0),
            (3.0, 40.0, 100.0, 2.0, 1.0, -1.0, 0.1, 7.0, 4.0),
            (3.0, 40.0, 100.0, 1.0, 1.0, -1.0, 0.1, 6.0, 4.0),
            (3.0, 40.0, 100.0, 0.0, 1.0, -1.0, 0.1, 5.0, 4.0),
        ];

        for (
            kind,
            hp,
            max_hp,
            damaged_allies,
            board_ready,
            roll,
            heal_roll,
            expected_selected,
            expected_branch,
        ) in cases
        {
            assert_eq!(
                enemy_skill_choice_selected_code(
                    kind,
                    hp,
                    max_hp,
                    damaged_allies,
                    board_ready,
                    roll,
                    heal_roll,
                ),
                expected_selected
            );
            assert_eq!(
                enemy_skill_choice_branch_code(
                    kind,
                    hp,
                    max_hp,
                    damaged_allies,
                    board_ready,
                    roll,
                    heal_roll,
                ),
                expected_branch
            );
        }
    }

    #[test]
    fn mirrors_current_round_pointer_advance_cases() {
        let cases = [
            // member_index, group_member_count, group_index, group_count,
            // team_phase, expected_member, expected_group_complete,
            // expected_group_index, expected_round_complete, expected_phase, expected_code
            (0.0, 4.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0),
            (2.0, 4.0, 0.0, 1.0, 0.0, 3.0, 0.0, 1.0, 0.0, 1.0, 0.0),
            (3.0, 4.0, 0.0, 1.0, 0.0, 4.0, 1.0, 1.0, 1.0, 1.0, 2.0),
            (1.0, 2.0, 0.0, 2.0, 1.0, 2.0, 1.0, 1.0, 0.0, 0.0, 1.0),
            (0.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 2.0),
        ];

        for (
            member_index,
            group_member_count,
            group_index,
            group_count,
            team_phase,
            expected_member,
            expected_group_complete,
            expected_group_index,
            expected_round_complete,
            expected_phase,
            expected_code,
        ) in cases
        {
            let next_member = round_pointer_next_member_index(member_index);
            let group_complete = round_pointer_group_complete(next_member, group_member_count);
            let next_group = round_pointer_next_group_index(group_index);
            let round_complete =
                round_pointer_round_complete(next_group, group_count, group_complete);
            assert_eq!(next_member, expected_member);
            assert_eq!(group_complete, expected_group_complete);
            assert_eq!(next_group, expected_group_index);
            assert_eq!(round_complete, expected_round_complete);
            assert_eq!(
                round_pointer_next_team_phase_type(team_phase),
                expected_phase
            );
            assert_eq!(
                round_pointer_advance_code(group_complete, round_complete),
                expected_code
            );
        }
    }
}
