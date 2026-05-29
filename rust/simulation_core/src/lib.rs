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

pub fn combat_power(atk: f64, def: f64, hp: f64) -> f64 {
    let a = number_or_zero(atk);
    let d = number_or_zero(def);
    let h = number_or_zero(hp);

    round_like_js((a + d + (h / 10.0)) * 100.0) / 100.0
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
}
