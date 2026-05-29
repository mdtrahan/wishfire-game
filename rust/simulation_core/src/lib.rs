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

#[no_mangle]
pub extern "C" fn combat_power_shadow(atk: f64, def: f64, hp: f64) -> f64 {
    combat_power(atk, def, hp)
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
}
