//! `web-runner/src/core/combatPower.mjs` + `combatFormulas.mjs`. CP is derived, never authored.
use crate::jsnum::{clamp, round};

pub fn mitigation_multiplier(defense: f64) -> f64 { 100. / (100. + defense.max(0.)) }
pub fn cooldown_seconds(base: f64, haste: f64) -> f64 { base * 100. / (100. + haste) }

/// The six combat stats plus level, as `normalizeCombatPowerActor` reads them (kit absent).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct CpActor { pub level: f64, pub atk: f64, pub mag: f64, pub def: f64, pub res: f64, pub hp: f64, pub spd: f64 }
impl CpActor {
    pub fn new(level: f64, atk: f64, mag: f64, def: f64, res: f64, hp: f64, spd: f64) -> Self { Self { level, atk, mag, def, res, hp, spd } }
}
fn num(v: f64) -> f64 { if v.is_finite() { v } else { 0. } }
pub fn compute_combat_power(a: CpActor) -> f64 {
    let level = num(a.level).floor().max(1.);
    let atk = num(a.atk).max(0.);
    let mag = num(a.mag).max(0.);
    let def = num(a.def).max(0.);
    let res = num(a.res).max(0.);
    let hp = num(a.hp).max(1.);
    let spd = num(a.spd).max(0.);
    let benchmark = 7. + (0.9 * (level - 1.));
    let offense = atk.max(mag);
    let neutral_hit = offense * mitigation_multiplier(benchmark);
    let action_rate = clamp(spd / 10., 0.6, 1.8);
    let effective_hp = hp / mitigation_multiplier((def + res) / 2.);
    let expected_direct = neutral_hit;
    let crit = expected_direct * 0.01 * (1.25 - 1.);
    let value = (5. * action_rate * ((expected_direct + crit + 0. + 0. + 0. + 0. + 0.) * 1.)) + (effective_hp / 4.);
    round(value * 10.) / 10.
}
/// `computeCombatPower(atk, def, hp)` legacy triple form (MAG/RES/SPD/level absent).
pub fn compute_combat_power_legacy(atk: f64, def: f64, hp: f64) -> f64 {
    compute_combat_power(CpActor::new(1., atk, 0., def, 0., hp, 0.))
}
