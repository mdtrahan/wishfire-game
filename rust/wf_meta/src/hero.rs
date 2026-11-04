//! `web-runner/src/core/heroDefinitions.mjs` (stats/growth), `heroProgression.mjs` (levels),
//! `heroGrowthRules.mjs` (stars), `heroPermanentModifiers.mjs` + `src/core/combatModifierRules.mjs`,
//! `heroMaxHpPolicy.mjs`, `heroSpecialCooldown.mjs`.
use crate::combat_power::cooldown_seconds;
use crate::jsnum::round;
use crate::shadow::{self, Stats6};
use serde::Serialize;
use std::collections::BTreeMap;

pub const MAX_LEVEL: u32 = 100;
pub const EXP_BASE: f64 = 100.;
pub const EXP_EXPONENT: f64 = 1.5;
pub const ENEMY_EXP: f64 = 25.;
pub const ENEMY_GOLD: f64 = 10.;
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct HeroDefinition { pub key: &'static str, pub name: &'static str, pub role: &'static str, pub base: Stats6, pub growth: Stats6, pub base_attack_interval: f64 }
pub const HERO_DEFINITIONS: [HeroDefinition; 4] = [
    HeroDefinition { key: "Falie", name: "Fara", role: "Tank", base: Stats6 { hp: 75., atk: 7., def: 12., mag: 4., res: 8., spd: 8. }, growth: Stats6 { hp: 8., atk: 0.8, def: 1.8, mag: 0.4, res: 1.1, spd: 0.15 }, base_attack_interval: 1.8 },
    HeroDefinition { key: "Huun", name: "Hondo", role: "Damage", base: Stats6 { hp: 60., atk: 16., def: 5., mag: 3., res: 4., spd: 12. }, growth: Stats6 { hp: 6., atk: 2.1, def: 0.7, mag: 0.3, res: 0.6, spd: 0.35 }, base_attack_interval: 1.2 },
    HeroDefinition { key: "Runa", name: "Runa", role: "Mage", base: Stats6 { hp: 60., atk: 3., def: 4., mag: 16., res: 10., spd: 11. }, growth: Stats6 { hp: 5., atk: 0.3, def: 0.7, mag: 2.1, res: 1.4, spd: 0.3 }, base_attack_interval: 1.4 },
    HeroDefinition { key: "Kojonn", name: "Kaja", role: "Support", base: Stats6 { hp: 65., atk: 4., def: 7., mag: 9., res: 12., spd: 10. }, growth: Stats6 { hp: 7., atk: 0.4, def: 1.1, mag: 1.4, res: 1.7, spd: 0.25 }, base_attack_interval: 1.6 },
];
/// `heroKey`: display names map to definition keys.
pub fn hero_key(name: &str) -> &str { match name { "Fara" => "Falie", "Hondo" => "Huun", "Kaja" => "Kojonn", other => other } }
pub fn hero_definition(name: &str) -> Option<&'static HeroDefinition> { let key = hero_key(name); HERO_DEFINITIONS.iter().find(|d| d.key == key) }
/// `canonicalGrowthId`: strips `#1`, case-insensitive match.
pub fn canonical_growth_id(key: &str) -> Option<&'static str> {
    let base = key.strip_suffix("#1").unwrap_or(key).to_lowercase();
    HERO_DEFINITIONS.iter().map(|d| d.key).find(|id| id.to_lowercase() == base)
}
pub fn exp_to_next_level(level: u32) -> f64 { if level >= MAX_LEVEL { 0. } else { (EXP_BASE * (level as f64).powf(EXP_EXPONENT)).ceil() } }
/// `levelStats(hero)`: floored base + growth per level, plus equipment, floored and at least 1.
pub fn level_stats(definition: &HeroDefinition, level: u32, equipment: &BTreeMap<String, f64>) -> Stats6 {
    let l = (level.max(1) - 1) as f64;
    let mut s = [
        (definition.base.hp + definition.growth.hp * l).floor(), (definition.base.atk + definition.growth.atk * l).floor(), (definition.base.def + definition.growth.def * l).floor(),
        (definition.base.mag + definition.growth.mag * l).floor(), (definition.base.res + definition.growth.res * l).floor(), (definition.base.spd + definition.growth.spd * l).floor(),
    ];
    for (i, key) in ["HP", "ATK", "DEF", "MAG", "RES", "SPD"].iter().enumerate() {
        if let Some(v) = equipment.get(*key) { s[i] += v; }
    }
    let s = s.map(|v| v.floor().max(1.));
    Stats6 { hp: s[0], atk: s[1], def: s[2], mag: s[3], res: s[4], spd: s[5] }
}
/// `refreshHeroStats` derived values: combatBaseMaxHP and maxHP (multiplier 1).
pub fn max_hp(level_hp: f64, combat_max_hp_multiplier: f64) -> f64 { (level_hp * combat_max_hp_multiplier).floor().max(1.) }

// ---- stars ----
pub const STAR_MAX: u32 = 8;
pub const STAR_COST_STEP: f64 = 50.;
pub const STAR_STAT_BONUS: f64 = 0.02;
pub fn star_up_cost(stars: u32) -> f64 { STAR_COST_STEP * (stars.min(STAR_MAX) as f64 + 1.) }
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillMultipliers { pub special_magnitude: f64, pub special_cooldown: f64, pub passive_magnitude: f64 }
/// `heroStarSkillMultipliers(growth, heroId)` for `stars` owned stars.
pub fn star_skill_multipliers(stars: u32) -> SkillMultipliers {
    let stars = stars.min(STAR_MAX);
    let (mut special_bonus, mut passive_bonus, mut special_haste) = (0., 0., 0.);
    // STAR_EFFECTS in index order: special +10%, special -8% cooldown, passive +15%, passive +15%, resonance x4.
    if stars >= 1 { special_bonus += 0.1; }
    if stars >= 2 { special_haste += 100. / 0.92 - 100.; }
    if stars >= 3 { passive_bonus += 0.15; }
    if stars >= 4 { passive_bonus += 0.15; }
    SkillMultipliers { special_magnitude: 1. + special_bonus, special_cooldown: cooldown_seconds(1., special_haste), passive_magnitude: 1. + passive_bonus }
}
/// `heroGrowthBreakdown(...).own`: 0.02 per star, summed in order, rounded to four decimals.
pub fn growth_own(stars: u32) -> f64 {
    let mut own = 0.;
    for _ in 0..stars.min(STAR_MAX) { own += STAR_STAT_BONUS; }
    round(own * 10000.) / 10000.
}
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Modifier { pub channel: &'static str, pub direction: &'static str, pub magnitude: f64 }
pub const GROWTH_STATS: [&str; 5] = ["HP", "ATK", "DEF", "MAG", "RES"];
/// Party training levels by training stat (`PartyTrainingLevels`).
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Training { pub atk: u32, pub def: u32, pub matk: u32, pub res: u32 }
/// `permanentHeroModifiers(globals, actor)`: training then star growth, filtered to stats the actor has.
pub fn permanent_hero_modifiers(training: Option<Training>, stars: u32, raw: &Stats6) -> Vec<Modifier> {
    let mut totals: Vec<(&'static str, f64)> = Vec::new();
    if let Some(t) = training {
        for (levels, stat) in [(t.atk, "ATK"), (t.def, "DEF"), (t.matk, "MAG"), (t.res, "RES")] {
            if levels > 0 { totals.push((stat, (levels as f64 * 0.02).min(2.))); }
        }
    }
    let own = growth_own(stars);
    if own > 0. {
        for channel in GROWTH_STATS {
            match totals.iter_mut().find(|(c, _)| *c == channel) { Some(entry) => entry.1 += own, None => totals.push((channel, own)) }
        }
    }
    let raw_stat = |stat: &str| match stat { "ATK" => raw.atk, "DEF" => raw.def, "MAG" => raw.mag, "RES" => raw.res, "HP" => raw.hp, "SPD" => raw.spd, _ => 0. };
    totals.into_iter().filter(|(stat, _)| *stat == "HP" || raw_stat(stat) > 0.).map(|(channel, magnitude)| Modifier { channel, direction: "up", magnitude }).collect()
}
fn bounds(channel: &str) -> (f64, f64) {
    match channel { "ATK" | "DEF" | "MAG" | "RES" => (0.5, 1.75), "HP" | "SPD" => (0.5, 1.5), "damageAmp" => (0.5, 1.5), "incomingReduction" => (0., 0.6), "range" => (0.5, 1.5), "critDamage" => (1., 2.), _ => panic!("Missing combat bounds: {channel}") }
}
pub fn project_combat_multiplier(channel: &str, modifiers: &[Modifier]) -> f64 {
    let (lo, hi) = bounds(channel);
    let up = modifiers.iter().filter(|m| m.channel == channel && m.direction == "up").map(|m| m.magnitude).fold(0., f64::max);
    let down = modifiers.iter().filter(|m| m.channel == channel && m.direction == "down").map(|m| m.magnitude).fold(0., f64::max);
    crate::jsnum::clamp(1. + up - down, lo, hi)
}
pub fn project_combat_stat(base: f64, channel: &str, modifiers: &[Modifier]) -> f64 {
    if !(base > 0.) { return if channel == "HP" { 1. } else { 0. }; }
    let value = base * project_combat_multiplier(channel, modifiers);
    if channel == "HP" { (value + 1e-9).floor().max(1.) } else { value }
}
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct SkillModifiers { pub special_potency: f64, pub meter_rate: f64 }
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct PermanentInputs { pub stats: shadow::ShadowStats, pub host_max_hp: f64, pub skill_modifiers: SkillModifiers }
/// `wfmHeroPermanentInputs(g, actor)`: training + stars projected onto the saved stats, then shadowed.
pub fn wfm_hero_permanent_inputs(definition: &HeroDefinition, saved_stats: &Stats6, combat_base_max_hp: f64, training: Option<Training>, stars: u32) -> Result<PermanentInputs, String> {
    let base = Stats6 { hp: combat_base_max_hp, ..*saved_stats };
    let modifiers = permanent_hero_modifiers(training, stars, &base);
    let resolved = Stats6 {
        hp: project_combat_stat(base.hp, "HP", &modifiers), atk: project_combat_stat(base.atk, "ATK", &modifiers), def: project_combat_stat(base.def, "DEF", &modifiers),
        mag: project_combat_stat(base.mag, "MAG", &modifiers), res: project_combat_stat(base.res, "RES", &modifiers), spd: project_combat_stat(base.spd, "SPD", &modifiers),
    };
    let growth = star_skill_multipliers(stars);
    let shadow = shadow::shadow_definition(definition.key).ok_or("Unsupported shadow combatant")?;
    Ok(PermanentInputs { stats: shadow::project_shadow_stats(resolved, definition.base, shadow)?, host_max_hp: resolved.hp,
        skill_modifiers: SkillModifiers { special_potency: growth.special_magnitude, meter_rate: 1. / growth.special_cooldown } })
}

/// `fillGearMaxHpGrowth(hp, beforeMaxHp, afterMaxHp)`: gear max-HP growth fills current HP.
pub fn fill_gear_max_hp_growth(hp: f64, before_max_hp: f64, after_max_hp: f64) -> f64 {
    let nz = |v: f64| if v.is_nan() { 0. } else { v };
    let before = nz(before_max_hp).floor().max(0.);
    let after = nz(after_max_hp).floor().max(0.);
    let current = nz(hp).floor().max(0.);
    after.min(if current > 0. { current + (after - before).max(0.) } else { 0. })
}
/// `specialClockContent.mjs`: Rust `describe.special_clocks` by shadow definition id.
pub fn special_clock(key: &str) -> Option<f64> {
    match hero_key(key) { "Falie" => Some(10.), "Huun" => Some(10.), "Kojonn" => Some(5.65217399597168), "Runa" => Some(10.), _ => None }
}
/// `heroSpecialCooldown(hero, growth)`: f32 haste input and f32 cooldown like Rust groove_timers.
pub fn hero_special_cooldown(key: &str, stars: u32) -> Result<f32, String> {
    let base = special_clock(key).ok_or_else(|| format!("Missing Rust special clock for {key}"))?;
    let multiplier = star_skill_multipliers(stars).special_cooldown;
    let haste = ((1. / multiplier) as f32 as f64 - 1.) * 100.;
    Ok(cooldown_seconds(base, haste) as f32)
}
