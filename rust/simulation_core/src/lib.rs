mod combat_abi;

fn number_or_zero(value: f64) -> f64 {
    if value.is_nan() {
        0.0
    } else {
        value
    }
}

fn round_like_js(value: f64) -> f64 {
    if value.is_finite() {
        (value + 0.5).floor()
    } else {
        value
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

pub fn combat_power_full(atk:f64, mag:f64, def:f64, res:f64, hp:f64, spd:f64, level:f64, direct:f64, crit_chance:f64, crit_multiplier:f64, aoe_damage:f64, extra_targets:f64, sustain:f64, control:f64, proc:f64, af:f64, sequence:f64) -> f64 {
    let level=positive_floor_or_one(level);
    let _atk=number_or_zero(atk).max(0.0); let _mag=number_or_zero(mag).max(0.0);
    let def=number_or_zero(def).max(0.0); let res=number_or_zero(res).max(0.0);
    let hp=number_or_zero(hp).max(1.0); let spd=number_or_zero(spd).max(0.0);
    let guard=20.0+(1.5*(level-1.0));
    let expected=number_or_zero(direct);
    let crit=expected*number_or_zero(crit_chance).clamp(0.0,1.0)*(number_or_zero(crit_multiplier).clamp(1.0,3.0)-1.0);
    let action_rate=(spd/10.0).clamp(0.6,1.8);
    let effective_hp=hp*(1.0+(((def+res)/2.0)/guard));
    let value=(5.0*action_rate*((expected+crit+(number_or_zero(aoe_damage).max(0.0)*number_or_zero(extra_targets).max(0.0))+number_or_zero(sustain).max(0.0)+number_or_zero(control).max(0.0)+number_or_zero(proc).max(0.0)+number_or_zero(af).max(0.0))*positive_floor_or_one(sequence).min(2.0)))+(effective_hp/4.0);
    round_like_js(value*10.0)/10.0
}

pub fn combat_power(atk: f64, def: f64, hp: f64) -> f64 {
    combat_power_full(atk,0.0,def,0.0,hp,0.0,1.0,0.0,0.01,1.25,0.0,0.0,0.0,0.0,0.0,0.0,1.0)
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
pub extern "C" fn combat_power_full_shadow(atk:f64, mag:f64, def:f64, res:f64, hp:f64, spd:f64, level:f64, direct:f64, crit_chance:f64, crit_multiplier:f64, aoe_damage:f64, extra_targets:f64, sustain:f64, control:f64, proc:f64, af:f64, sequence:f64) -> f64 {
    combat_power_full(atk,mag,def,res,hp,spd,level,direct,crit_chance,crit_multiplier,aoe_damage,extra_targets,sustain,control,proc,af,sequence)
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
