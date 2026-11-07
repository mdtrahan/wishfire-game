//! `src/core/combatShadowAdapter.mjs`: WFM/host stats -> wf_combat definition stats.
use crate::combat_power::cooldown_seconds;
use serde::{Deserialize, Serialize};

/// `base(hp, atk, def, speed, reach, interval, evade, special)` with mag=atk, res=def unless overridden.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct ShadowStats { pub hp: f64, pub atk: f64, pub def: f64, pub mag: f64, pub res: f64, pub speed: f64, pub reach: f64, pub interval: f64, pub evade: f64, pub special: f64 }
const fn base(hp: f64, atk: f64, def: f64, speed: f64, reach: f64, interval: f64, evade: f64, special: f64) -> ShadowStats {
    ShadowStats { hp, atk, def, mag: atk, res: def, speed, reach, interval, evade, special }
}
const HERO_SPEED: f64 = 78. * 1.6698;
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Definition { pub key: &'static str, pub id: &'static str, pub stats: ShadowStats }
const fn wfm(hp: f64, atk: f64, def: f64, speed: f64, reach: f64, interval: f64, mag: f64, res: f64) -> ShadowStats {
    ShadowStats { mag, res, ..base(hp, atk, def, speed, reach, interval, 0., 0.) }
}
pub const WFM_ENEMY_DEFINITIONS: [Definition; 10] = [
    Definition { key: "Gobloc", id: "slice.enemy.gobloc", stats: base(140., 10., 0., 55., 40., 2.6, 0., 0.) },
    Definition { key: "High Gobloc", id: "wfm.enemy.high_gobloc", stats: wfm(70., 14., 14., 25.2, 46., 3.6, 8., 12.) },
    Definition { key: "Lizardo", id: "slice.enemy.lizardo", stats: base(100., 22., 0., 45., 220., 4.5, 0., 0.) },
    Definition { key: "Orc", id: "slice.enemy.orc", stats: base(210., 11., 0., 45., 63., 3., 0., 0.) },
    Definition { key: "High Orc", id: "slice.enemy.high_orc", stats: base(260., 30., 80., 32., 68., 4.2, 0., 0.) },
    Definition { key: "Chimerilass", id: "wfm.enemy.chimerilass", stats: wfm(80., 8., 10., 25.2, 146., 5., 26., 16.) },
    Definition { key: "Troll", id: "slice.boss.troll_brute", stats: base(1500., 165., 0., 40., 100., 4.5, 0., 0.) },
    Definition { key: "Skeleton", id: "wfm.enemy.skeleton", stats: wfm(35., 8., 5., 25.2, 46., 3.6, 4., 4.) },
    Definition { key: "Djinn", id: "wfm.enemy.djinn", stats: wfm(55., 6., 6., 25.2, 146., 5., 28., 14.) },
    Definition { key: "Marid", id: "slice.enemy.marid", stats: base(235., 12., 10., HERO_SPEED * 0.95, 320., 4.5, 0., 0.) },
];
pub const HERO_SHADOW_DEFINITIONS: [Definition; 4] = [
    Definition { key: "Falie", id: "slice.hero.fara", stats: base(420., 26.4, 28., HERO_SPEED, 100., 1.8, 0.09, 30.) },
    Definition { key: "Huun", id: "slice.hero.hondo", stats: base(300., 40.8, 14., HERO_SPEED * 1.1, 45., 1.2, 0.12, 8.) },
    Definition { key: "Runa", id: "slice.hero.runa", stats: base(260., 36., 10., HERO_SPEED * 0.95, 270., 1.4, 0.05, 10.) },
    Definition { key: "Kojonn", id: "slice.hero.kaja", stats: base(280., 21.6, 16., HERO_SPEED * 0.95, 235., 1.6, 0.05, 16.) },
];
pub fn enemy_definition(name: &str) -> Option<&'static Definition> { WFM_ENEMY_DEFINITIONS.iter().find(|d| d.key == name) }
pub fn shadow_definition(key: &str) -> Option<&'static Definition> { HERO_SHADOW_DEFINITIONS.iter().chain(WFM_ENEMY_DEFINITIONS.iter()).find(|d| d.key == key) }

/// Six WFM stats in HP, ATK, DEF, MAG, RES, SPD order.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct Stats6 { #[serde(rename = "HP")] pub hp: f64, #[serde(rename = "ATK")] pub atk: f64, #[serde(rename = "DEF")] pub def: f64, #[serde(rename = "MAG")] pub mag: f64, #[serde(rename = "RES")] pub res: f64, #[serde(rename = "SPD")] pub spd: f64 }
fn number(value: f64, name: &str, positive: bool) -> Result<f64, String> {
    if !value.is_finite() || (if positive { value <= 0. } else { value < 0. }) { return Err(format!("Invalid shadow {name}")); }
    Ok(value)
}
/// `projectShadowStats(resolved, reference, definition)`.
pub fn project_shadow_stats(resolved: Stats6, reference: Stats6, definition: &Definition) -> Result<ShadowStats, String> {
    let c = definition.stats;
    let ratio = |value: f64, reference: f64, key: &str, positive: bool| -> Result<f64, String> {
        Ok(number(value, key, positive)? / number(reference, &format!("reference {key}"), true)?)
    };
    let hp = (c.hp * ratio(resolved.hp, reference.hp, "HP", true)?).floor().max(1.);
    let atk = c.atk * ratio(resolved.atk, reference.atk, "ATK", false)?;
    let def = if c.def == 0. { 0. } else { c.def * ratio(resolved.def, reference.def, "DEF", false)? };
    let mag = c.mag * ratio(resolved.mag, reference.mag, "MAG", false)?;
    let res = if c.res == 0. { 0. } else { c.res * ratio(resolved.res, reference.res, "RES", false)? };
    let interval = (1. / 30f64).max(1_000_000f64.min(cooldown_seconds(c.interval, (ratio(resolved.spd, reference.spd, "SPD", true)? - 1.) * 100.)));
    Ok(ShadowStats { hp, atk, def, mag, res, interval, ..c })
}
/// `entryHP(hp, hostMax, shadowMax)`.
pub fn entry_hp(hp: f64, host_max: f64, shadow_max: f64) -> Result<f64, String> {
    number(hp, "entry HP", false)?;
    Ok(shadow_max.min(hp / number(host_max, "host max HP", true)? * shadow_max))
}
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct SummonProfile { pub definition_id: String, pub stats: ShadowStats }
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct ShadowEnemy { pub spawn_key: String, pub definition_id: String, pub position: crate::geometry::Point, pub stats: ShadowStats, pub hp: f64, pub summon_profiles: Vec<SummonProfile> }
/// `shadowEnemy({identity, key, position, resolved, reference, hp, hostMaxHP, speed, interval})`.
#[allow(clippy::too_many_arguments)]
pub fn shadow_enemy(identity: &str, key: &str, position: crate::geometry::Point, resolved: Stats6, reference: Stats6, hp: f64, host_max_hp: f64, speed: Option<f64>, interval: Option<f64>) -> Result<ShadowEnemy, String> {
    let definition = enemy_definition(key).ok_or_else(|| format!("WFM combat: unmapped enemy \"{key}\""))?;
    let mut stats = project_shadow_stats(resolved, reference, definition)?;
    if definition.id.starts_with("wfm.") {
        stats.interval = interval.unwrap_or(definition.stats.interval);
        stats.speed = speed.unwrap_or(definition.stats.speed);
    }
    Ok(ShadowEnemy { spawn_key: identity.into(), definition_id: definition.id.into(), position, stats, hp: entry_hp(hp, host_max_hp, stats.hp)?, summon_profiles: Vec::new() })
}
