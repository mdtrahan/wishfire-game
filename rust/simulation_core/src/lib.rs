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
}
