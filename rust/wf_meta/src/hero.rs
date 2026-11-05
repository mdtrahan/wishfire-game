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

// ---- kit text (heroDefinitions.mjs special/passive, partySkillCatalog.mjs) ----
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SkillText { pub id: &'static str, pub name: &'static str, pub icon: &'static str, pub condition: &'static str, pub description: &'static str }
/// `heroDefinition(key).special`.
pub fn special_text(key: &str) -> Option<SkillText> {
    Some(match hero_key(key) {
        "Falie" => SkillText { id: "crimson_ward", name: "Crimson Ward", icon: "party-ward", condition: "A foe in range", description: "Every hero gains its own temporary HP worth 8% of its max HP, stacking up to 50% of its original max HP. Hits drain only the struck hero’s ward. Kept between waves, into a boss fight and after a boss clear; cleared when the party falls or a boss attempt fails." },
        "Huun" => SkillText { id: "shadow", name: "Shadow", icon: "party-special", condition: "A foe in range", description: "Jump behind a foe and hit it for 240% damage." },
        "Runa" => SkillText { id: "bubble_pop", name: "Bubble Pop", icon: "party-mag", condition: "A foe in range", description: "Hit every foe in range for 180% magic damage and push them back for 2 seconds." },
        "Kojonn" => SkillText { id: "elevate", name: "Elevate", icon: "party-spd", condition: "Fight start, then each time the clock fills", description: "Roll one party set until the next roll: SPD +5% and ATK +5%, max HP +20% and MAG +5%, or attack range +10% and crit damage +5%. Ends if Kaja falls." },
        _ => return None,
    })
}
/// `heroDefinition(key).passive`.
pub fn passive_text(key: &str) -> Option<SkillText> {
    Some(match hero_key(key) {
        "Falie" => SkillText { id: "smoke_form", name: "Smoke Form", icon: "party-dr", condition: "Own HP below 40%", description: "Below 40% HP, Fara takes 50% less damage." },
        "Huun" => SkillText { id: "royalty", name: "Royalty", icon: "party-atk", condition: "Own HP below 50%", description: "Below 50% HP, Hondo’s basic attacks deal double damage and lower the struck enemy’s DEF by 5% for 4s (provisional), helping every hero." },
        "Runa" => SkillText { id: "boast", name: "Boast", icon: "party-res", condition: "Own HP above 80%", description: "Above 80% HP, Runa gains MAG +5% and RES +5%." },
        "Kojonn" => SkillText { id: "ethereal_aura", name: "Ethereal Aura", icon: "party-mag", condition: "Foes in range", description: "Foes in Kaja’s range take Faze damage every second, rising with each chapter." },
        _ => return None,
    })
}
/// `PARTY_SKILLS`: every skill that can raise a party-wide buff icon.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PartySkill { pub id: &'static str, pub skill_id: &'static str, pub hero: &'static str, pub name: &'static str, pub clock_label: &'static str, pub icons: &'static [&'static str], pub effect: &'static str, pub values: &'static [&'static str] }
pub const PARTY_SKILLS: [PartySkill; 4] = [
    PartySkill { id: "crimson_ward", skill_id: "crimson_ward", hero: "Fara", name: "Crimson Ward", clock_label: "Cooldown", icons: &["party-ward"], effect: "Every hero gains its own temporary HP worth 8% of its max HP, stacking up to 50% of its original max HP. Hits drain only the struck hero’s ward. Kept between waves, into a boss fight and after a boss clear; cleared when the party falls or a boss attempt fails.", values: &["Each hero: temporary HP +8% of own max HP per cast", "Stacks to 50% of own original max HP"] },
    PartySkill { id: "elevate:swift", skill_id: "elevate", hero: "Kaja", name: "Elevate · Swift", clock_label: "Rerolls every", icons: &["party-spd", "party-atk"], effect: "One of Elevate’s three party rolls. While rolled, every hero gains SPD +5%, ATK +5%. Replaced by the next roll; ends if Kaja falls.", values: &["SPD +5%, ATK +5%"] },
    PartySkill { id: "elevate:vital", skill_id: "elevate", hero: "Kaja", name: "Elevate · Vital", clock_label: "Rerolls every", icons: &["party-hp", "party-mag"], effect: "One of Elevate’s three party rolls. While rolled, every hero gains Max HP +20%, MAG +5%. Replaced by the next roll; ends if Kaja falls.", values: &["Max HP +20%, MAG +5%"] },
    PartySkill { id: "elevate:reach", skill_id: "elevate", hero: "Kaja", name: "Elevate · Reach", clock_label: "Rerolls every", icons: &["party-range", "party-cd"], effect: "One of Elevate’s three party rolls. While rolled, every hero gains Attack range +10%, crit damage +5%. Replaced by the next roll; ends if Kaja falls.", values: &["Attack range +10%, crit damage +5%"] },
];
/// `partySkillFor(ref)`: a live party buff (effect id plus optional Elevate set) to its catalog entry.
pub fn party_skill_for(effect_id: &str, set: Option<&str>) -> Option<&'static PartySkill> {
    let id = match (effect_id, set) { ("ward", _) | ("crimson_ward", _) => "crimson_ward".to_string(), ("elevate", Some(set)) => format!("elevate:{set}"), _ => return None };
    PARTY_SKILLS.iter().find(|p| p.id == id)
}

/// `heroDefinition(key).resonances`: late-game scaffolding, Hero-screen text only.
pub fn resonance_texts(key: &str) -> Option<[SkillText; 2]> {
    Some(match hero_key(key) {
        "Falie" => [SkillText { id: "phoenix_soul", name: "Phoenix Soul", icon: "party-heal", condition: "Own HP below 15%", description: "Below 15% HP, each basic attack heals Fara for 6% of max HP." }, SkillText { id: "chastise", name: "Chastise", icon: "party-reflect", condition: "When hit", description: "Reflect 80% of damage taken back to the attacker." }],
        "Huun" => [SkillText { id: "chase", name: "Chase", icon: "party-atk", condition: "Exactly one foe in range", description: "Against a lone foe in range, deal +160% damage." }, SkillText { id: "weaken", name: "Weaken", icon: "party-cr", condition: "Three or more foes in range", description: "When surrounded by three or more foes, crit rate +5% and crit damage +5%." }],
        "Runa" => [SkillText { id: "vengeance", name: "Vengeance", icon: "party-mag", condition: "Own HP below 45%", description: "Below 45% HP, MAG rises by the share of HP lost." }, SkillText { id: "stare", name: "Stare", icon: "party-res", condition: "Exactly one foe in range", description: "Against a lone foe, add twice RES to MAG." }],
        "Kojonn" => [SkillText { id: "cornered", name: "Cornered", icon: "party-def", condition: "Three or more foes in range", description: "When surrounded by three or more foes, DEF +8% and RES +8%." }, SkillText { id: "timeless", name: "Timeless", icon: "party-special", condition: "Own HP below 55%", description: "Below 55% HP, every special deals +20% damage and crit rate rises 1%." }],
        _ => return None,
    })
}
/// `kit(..., magic)`: Runa and Kaja attack with MAG.
pub fn basic_is_magic(key: &str) -> bool { matches!(hero_key(key), "Runa" | "Kojonn") }
pub const PROVISIONAL_SPECIAL_COOLDOWNS: [&str; 3] = ["shadow", "bubble_pop", "elevate"];
/// `heroSpecialReach`: max(2 * HERO_FORMATION_WIDTH, 92 * attackRangeMultiplier) with no multiplier.
pub const HERO_SPECIAL_REACH: f64 = 211.2;
/// `heroSkillRange(ability, hero)` for a special by target rule.
pub fn special_range_text(skill_id: &str) -> String {
    match skill_id { "crimson_ward" | "elevate" => "Whole party".into(), "bubble_pop" => format!("Every foe within {HERO_SPECIAL_REACH} units"), "shadow" => format!("{HERO_SPECIAL_REACH}-unit actor reach"), _ => "Self".into() }
}
/// `formatHeroSpecialCooldown`: `Number(seconds.toFixed(2))` printed like a JS number.
pub fn format_special_cooldown(key: &str, stars: u32) -> String {
    let seconds = hero_special_cooldown(key, stars).map(|s| (s as f64 * 100.).round() / 100.).unwrap_or(0.);
    let text = format!("{seconds:.2}");
    text.trim_end_matches('0').trim_end_matches('.').to_string()
}
/// `heroSkillCopy(skill)` (`heroSkillCopy.mjs`): player-facing lines + rules.
pub struct SkillCopy { pub lines: Vec<String>, pub rules: Vec<&'static str> }
pub fn skill_copy(skill_id: &str, key: &str) -> SkillCopy {
    let lines = |v: &[&str]| v.iter().map(|s| s.to_string()).collect::<Vec<_>>();
    match skill_id {
        "basic_attack" => SkillCopy { lines: vec![format!("Deals 100% of {} to the current target.", if basic_is_magic(key) { "MAG" } else { "ATK" })], rules: vec![] },
        "crimson_ward" => SkillCopy { lines: lines(&["Grants each hero temporary HP equal to 8% of max HP.", "Stacks to 50% of original max HP."]), rules: vec!["Each hero has a separate ward. Hits drain only the struck hero’s ward.", "Persists between waves, into boss fights and after boss clears.", "Clears when the party falls or a boss attempt fails. A fallen hero loses its ward."] },
        "smoke_form" => SkillCopy { lines: lines(&["Below 40% HP, takes 50% less damage."]), rules: vec![] },
        "phoenix_soul" => SkillCopy { lines: lines(&["Below 15% HP, each basic attack heals 6% of max HP."]), rules: vec![] },
        "chastise" => SkillCopy { lines: lines(&["Reflects 80% of damage taken to the attacker."]), rules: vec![] },
        "shadow" => SkillCopy { lines: lines(&["Jumps behind a foe and deals 240% damage."]), rules: vec![] },
        "royalty" => SkillCopy { lines: lines(&["Below 50% HP: basic damage ×2.", "Hits: target DEF −5% for 4s."]), rules: vec!["The DEF reduction benefits every hero. Duration is provisional."] },
        "chase" => SkillCopy { lines: lines(&["Against a lone foe in range, deals +160% damage."]), rules: vec![] },
        "weaken" => SkillCopy { lines: lines(&["Surrounded by 3+ foes: crit rate +5% and crit damage +5%."]), rules: vec![] },
        "bubble_pop" => SkillCopy { lines: lines(&["Deals 180% magic damage to every foe in range.", "Pushes them back for 2s."]), rules: vec![] },
        "boast" => SkillCopy { lines: lines(&["Above 80% HP: MAG +5% and RES +5%."]), rules: vec![] },
        "vengeance" => SkillCopy { lines: lines(&["Below 45% HP, MAG rises by the share of HP lost."]), rules: vec![] },
        "stare" => SkillCopy { lines: lines(&["Against a lone foe, adds twice RES to MAG."]), rules: vec![] },
        "elevate" => SkillCopy { lines: lines(&["Rolls one party bonus set:"]), rules: vec!["SPD +5% and ATK +5%.", "Max HP +20% and MAG +5%.", "Attack range +10% and crit damage +5%.", "Rolls at fight start, then on cooldown. Lasts until the next roll; ends if Kaja falls."] },
        "ethereal_aura" => SkillCopy { lines: lines(&["Foes in range take Faze damage every second."]), rules: vec!["Damage rises with each chapter."] },
        "cornered" => SkillCopy { lines: lines(&["Surrounded by 3+ foes: DEF +8% and RES +8%."]), rules: vec![] },
        "timeless" => SkillCopy { lines: lines(&["Below 55% HP, specials deal +20% damage.", "Crit rate rises 1%."]), rules: vec![] },
        _ => SkillCopy { lines: vec![], rules: vec![] },
    }
}
/// `STAR_EFFECTS` text per star index (1-based): (skill slot, stat bonus, effect text).
pub fn star_effect(index: u32) -> (&'static str, f64, &'static str) {
    match index { 1 => ("special", STAR_STAT_BONUS, "+10% Special damage/healing"), 2 => ("special", STAR_STAT_BONUS, "-8% Special cooldown"), 3 => ("passive", STAR_STAT_BONUS, "+15% Passive magnitude"), 4 => ("passive", STAR_STAT_BONUS, "+15% Passive magnitude"), 5 | 6 => ("resonance1", STAR_STAT_BONUS, "Unlocks with Resonance crystals"), _ => ("resonance2", STAR_STAT_BONUS, "Unlocks with Resonance crystals") }
}
