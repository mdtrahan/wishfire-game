//! `web-runner/src/core/lampGear.mjs` + `lampConveyor.mjs` + `lampHeroRoster.mjs`: the Bag/lamp
//! equipment economy. `wishfire.equipment-economy.v5` is validated on JSON values exactly like the
//! JS (same error messages), then handled typed; unknown keys survive round trips.
use crate::combat_power::{compute_combat_power, CpActor};
use crate::equipment::{self, catalog, equipment_stats, is_equipment_upgrade, rarity_index, Gear, RARITIES};
use crate::hero::{self, HeroDefinition};
use crate::jsnum::{self, imul, number, round, to_int32};
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::{json, Map, Value};
use std::collections::BTreeMap;

pub const CAPACITY: u32 = 20;
pub const MIN_EMISSION_INTERVAL_MS: f64 = 2000.;
pub const AUTO_INTERVAL_MS: f64 = 5000.;
pub const AUTO_UNLOCK_LEVEL: u32 = 5;
pub const MAX_ORDINAL: u32 = 990;
pub const MAP_STAT_GROWTH: f64 = 0.005;
pub const LAMP_LEVELS: usize = 100;
pub const KILL_RECEIPT_DOMAINS: usize = 64;
pub const TICK_SECONDS: f64 = 15.;
pub const TICK_POINTS: f64 = 1.;
pub const BOSS_KILL_POINTS: f64 = 5.;
pub const CONVEYOR_TRAVEL_MS: f64 = 28000.;
pub const GEAR_STATS: [&str; 5] = ["ATK", "DEF", "MAG", "RES", "HP"];
/// Most equipment orbs that lie uncollected on the battlefield (owner 2026-11-04: an idle or
/// full-Bag party once left 2,488, a 564 KB save rewritten on every action). Kills keep dropping
/// past it: each new orb takes the place of the oldest orb of the lowest rarity on the field.
pub const ORB_LIMIT: usize = 40;
/// Chance that a defeated enemy drops an equipment orb. Owner 2026-11-04: a tenth of every
/// kill; owner 2026-11-05 (ORKA-63bf.43): a third more, 13.3%, because gear came in too slowly
/// once orbs were judged at pickup.
pub const ORB_DROP_CHANCE: f32 = 0.133;
// Field drops besides equipment (owner 2026-11-05; temporary, until a hero EXP system exists):
// a kill that leaves no equipment orb may leave a little Gold, a little Essence or one hero
// ticket instead. One roll per kill decides; the amounts are Fable's first numbers.
pub const GOLD_DROP_CHANCE: f32 = 0.05;
pub const GOLD_DROP_AMOUNT: f64 = 25.;
pub const ESSENCE_DROP_CHANCE: f32 = 0.04;
pub const ESSENCE_DROP_AMOUNT: f64 = 3.;
/// Always a single ticket, for one hero chosen evenly among those that can still level.
pub const TICKET_DROP_CHANCE: f32 = 0.03;
/// Most resource drops lying uncollected on the battlefield; kills past it drop nothing.
pub const LOOT_LIMIT: usize = 40;
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum FieldDrop { Equipment, Gold, Essence, Ticket }
/// What a kill drops. `roll` is uniform in 0..1; `orb_chance` is `ORB_DROP_CHANCE` unless Dev
/// Tools set another equipment rate for the page session.
pub fn field_drop(roll: f32, orb_chance: f32) -> Option<FieldDrop> {
    let mut edge = orb_chance;
    for (chance, drop) in [(0., FieldDrop::Equipment), (GOLD_DROP_CHANCE, FieldDrop::Gold), (ESSENCE_DROP_CHANCE, FieldDrop::Essence), (TICKET_DROP_CHANCE, FieldDrop::Ticket)] {
        edge += chance;
        if roll < edge { return Some(drop); }
    }
    None
}
/// An Essence drop was picked up: returns the new Essence total.
pub fn grant_essence(data: &mut LampEconomy, amount: f64) -> Result<f64, String> {
    let count = if amount.is_nan() { 0. } else { amount.floor().max(0.) };
    if !is_safe_integer(data.lamp.essence + count) { return Err("Essence exceeds the safe save limit. Original data is preserved.".into()); }
    data.lamp.essence += count;
    Ok(data.lamp.essence)
}
pub const GUIDE_STORAGE: u32 = 1;
pub const GUIDE_COMPARISON: u32 = 2;
pub const GUIDE_PREVIEW: u32 = 4;
const INVALID: &str = "Lamp save is invalid. Original data is preserved.";
const CONVEYOR_INVALID: &str = "Lamp conveyor save is invalid. Original data is preserved.";

/// `lampTierUpgradeCost(n, capacity)`: `None` at the last level.
pub fn tier_upgrade_cost(n: u32, capacity: f64) -> Option<f64> {
    if n as usize == LAMP_LEVELS - 1 { return None; }
    let n = n as f64;
    let trend = 100. + 200. * n - 10. * n.powi(2) + 5.35 * n.powi(3);
    let wave = 1. + 0.04 * (2. * std::f64::consts::PI * n / 10.).sin();
    let unit = 25.;
    Some((round(trend * wave / unit) * unit).max((5. * capacity / unit).ceil() * unit))
}
/// Bag levels are frozen until hero EXP exists to gate them (owner 2026-11-05): the Bag bar
/// still fills and empties, but a full bar adds one banked fill instead of a level, so capacity
/// and rarity odds stay where they are. Cost of the bar after `fills` completed ones: 50, 75,
/// 100 ... rising by 25 to a ceiling of 500. Owner-adjustable tuning.
pub fn bag_fill_cost(fills: f64) -> f64 { (50. + 25. * fills.max(0.)).min(500.) }
#[derive(Clone, Debug, PartialEq)]
pub struct CapacityTier { pub capacity: f64, pub cost: Option<f64>, pub rarity_weights: [(&'static str, f64); 5] }
/// `LAMP_CAPACITY_TIERS[n]`.
pub fn capacity_tier(n: u32) -> CapacityTier {
    let p = n as f64 / (LAMP_LEVELS as f64 - 1.);
    let r3 = |v: f64| round(v * 1000.) / 1000.;
    let uncommon = r3(25. + 10. * p);
    let rare = r3(30. * p);
    let epic = r3(14. * p);
    let legendary = r3(p);
    let common = r3(100. - uncommon - rare - epic - legendary);
    let capacity = CAPACITY as f64 + round(10. * (n as f64).powf(1.5));
    CapacityTier { capacity, cost: tier_upgrade_cost(n, capacity), rarity_weights: [("common", common), ("uncommon", uncommon), ("rare", rare), ("epic", epic), ("legendary", legendary)] }
}
/// `seededUnit(seed, sequence, salt)`.
pub fn seeded_unit(seed: u32, sequence: u32, salt: u32) -> f64 {
    let x = (to_int32(seed as f64) ^ imul(sequence as f64 + 1., 374761393.) ^ imul(salt as f64 + 1., 668265263.)) as u32;
    let x = imul((x ^ (x >> 13)) as i32 as f64, 1274126177.);
    let x = (x ^ ((x as u32) >> 16) as i32) as u32;
    x as f64 / 4294967296.
}
/// `progressionOrdinal({region, stage})`.
pub fn progression_ordinal(region: f64, stage: f64) -> u32 {
    let region = (if region.is_nan() || region == 0. { 1. } else { region }).floor().max(1.);
    let stage = (if stage.is_nan() || stage == 0. { 1. } else { stage }).floor();
    (((region - 1.) * 10.) + (stage - 1.).min(9.).max(0.)).min(MAX_ORDINAL as f64) as u32
}
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Archetype { pub id: &'static str, pub name: &'static str, pub kind: &'static str, pub art: u32, pub stats: [(&'static str, f64); 5] }
pub const GEAR_ARCHETYPES: [Archetype; 9] = [
    Archetype { id: "guardian-hat", name: "Guardian Helm", kind: "hat", art: 0, stats: [("ATK", 1.), ("DEF", 3.), ("MAG", 1.), ("RES", 2.), ("HP", 5.)] },
    Archetype { id: "scholar-hat", name: "Scholar Turban", kind: "hat", art: 1, stats: [("ATK", 1.), ("DEF", 1.), ("MAG", 3.), ("RES", 2.), ("HP", 5.)] },
    Archetype { id: "wanderer-hat", name: "Wayfarer Cap", kind: "hat", art: 2, stats: [("ATK", 3.), ("DEF", 2.), ("MAG", 1.), ("RES", 1.), ("HP", 5.)] },
    Archetype { id: "guardian-body", name: "Guardian Cuirass", kind: "body", art: 3, stats: [("ATK", 1.), ("DEF", 4.), ("MAG", 1.), ("RES", 2.), ("HP", 10.)] },
    Archetype { id: "scholar-body", name: "Scholar Vest", kind: "body", art: 4, stats: [("ATK", 1.), ("DEF", 2.), ("MAG", 3.), ("RES", 3.), ("HP", 10.)] },
    Archetype { id: "wanderer-body", name: "Wayfarer Vest", kind: "body", art: 5, stats: [("ATK", 4.), ("DEF", 2.), ("MAG", 1.), ("RES", 1.), ("HP", 10.)] },
    Archetype { id: "guardian-boots", name: "Guardian Boots", kind: "boots", art: 6, stats: [("ATK", 1.), ("DEF", 3.), ("MAG", 1.), ("RES", 2.), ("HP", 5.)] },
    Archetype { id: "scholar-boots", name: "Scholar Slippers", kind: "boots", art: 7, stats: [("ATK", 1.), ("DEF", 1.), ("MAG", 2.), ("RES", 3.), ("HP", 5.)] },
    Archetype { id: "wanderer-boots", name: "Wayfarer Boots", kind: "boots", art: 8, stats: [("ATK", 3.), ("DEF", 2.), ("MAG", 1.), ("RES", 1.), ("HP", 5.)] },
];
fn quality(rarity: &str) -> f64 { match rarity { "uncommon" => 1.18, "rare" => 1.42, "epic" => 1.7, "legendary" => 2., _ => 1. } }

/// One lamp item (`generateLampItem` shape); unknown keys survive.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LampItem {
    pub instance_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub equipment_id: Option<String>,
    pub name: String,
    #[serde(rename = "type")] pub kind: String,
    pub art: u32,
    pub rarity: String,
    pub level: f64,
    /// Insertion-ordered like the JS object (ATK, DEF, MAG, RES, HP when generated).
    pub stats: Map<String, Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub sequence: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub ordinal: Option<f64>,
    #[serde(flatten)] pub extra: Map<String, Value>,
}
impl LampItem {
    pub fn gear(&self) -> Gear { Gear { kind: self.kind.clone(), stats: self.stats.iter().map(|(k, v)| (k.clone(), v.as_f64().unwrap_or(0.))).collect() } }
    pub fn stat(&self, key: &str) -> f64 { self.stats.get(key).and_then(Value::as_f64).unwrap_or(0.) }
}
/// `JSON.stringify(value)`: compact, integral numbers without a fraction.
pub fn js_json(value: &Value) -> String {
    fn canon(v: &Value) -> Value {
        match v {
            Value::Number(n) => match n.as_f64() { Some(f) if f.fract() == 0. && f.abs() < 9007199254740992. => Value::from(f as i64), _ => v.clone() },
            Value::Array(a) => Value::Array(a.iter().map(canon).collect()),
            Value::Object(o) => Value::Object(o.iter().map(|(k, v)| (k.clone(), canon(v))).collect()),
            _ => v.clone(),
        }
    }
    canon(value).to_string()
}
/// `generateLampItem(seed, sequence, ordinal, weights)`.
pub fn generate_lamp_item(seed: u32, sequence: u32, ordinal: u32, weights: &[(&str, f64)]) -> LampItem {
    let a = GEAR_ARCHETYPES[(seeded_unit(seed, sequence, 0) * GEAR_ARCHETYPES.len() as f64).floor() as usize];
    let mut roll = seeded_unit(seed, sequence, 1) * 100.;
    let mut rarity = "common";
    for (key, weight) in weights { roll -= weight; if roll < 0. { rarity = key; break; } }
    let scale = 1. + ordinal.min(MAX_ORDINAL) as f64 * MAP_STAT_GROWTH;
    let rarity_floor = |kind: &str, stat: &str, tier: &str| -> f64 {
        let archetypes: Vec<&Archetype> = GEAR_ARCHETYPES.iter().filter(|e| e.kind == kind).collect();
        let base = |e: &Archetype| e.stats.iter().find(|(k, _)| *k == stat).map_or(0., |(_, v)| *v);
        let max_base = archetypes.iter().map(|e| base(e)).fold(f64::NEG_INFINITY, f64::max);
        let prior_quality = if tier == "epic" { quality("rare") } else { quality("epic") };
        let prior_envelope = (max_base * scale * prior_quality * 1.2).ceil();
        if tier == "epic" { return prior_envelope + 1.; }
        let epic_envelope = archetypes.iter().map(|e| (base(e) * scale * quality("epic") * 1.2).ceil()).fold(prior_envelope + 1., f64::max);
        epic_envelope + 1.
    };
    let mut stats = Map::new();
    for (i, (stat, value)) in a.stats.iter().enumerate() {
        let rolled = round(value * scale * quality(rarity) * (0.8 + 0.4 * seeded_unit(seed, sequence, i as u32 + 2))).max(1.);
        stats.insert(stat.to_string(), json!(if rarity == "epic" || rarity == "legendary" { rolled.max(rarity_floor(a.kind, stat, rarity)) } else { rolled }));
    }
    LampItem { instance_id: format!("lamp:{seed}:{sequence}"), equipment_id: Some(a.id.into()), name: a.name.into(), kind: a.kind.into(), art: a.art, rarity: rarity.into(), level: ordinal as f64 + 1., stats, sequence: Some(sequence as f64), ordinal: Some(ordinal as f64), extra: Map::new() }
}
pub fn salvage_value(rarity: &str) -> f64 { (1. + rarity_index(rarity).map_or(-1., |i| i as f64)).min(7.) }

fn keep_null<'de, D: Deserializer<'de>>(d: D) -> Result<Option<Value>, D::Error> { Value::deserialize(d).map(Some) }
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Default)]
pub struct Salvage { pub count: f64, pub gold: f64 }
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LampState {
    #[serde(default)] pub capacity_tier: u32,
    #[serde(default)] pub essence: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub kill_points: Option<f64>,
    pub seed: u32,
    pub sequence: f64,
    pub pending: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub discarded: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub recent: Option<Vec<Value>>,
    pub salvage: Salvage,
    pub auto_enabled: bool,
    pub highest_ordinal: f64,
    pub last_activation_at: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub guide: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub conveyor_active_ms: Option<f64>,
    /// Conveyor fields stay raw JSON so a malformed one reports the conveyor error, not the save error.
    #[serde(default, skip_serializing_if = "Option::is_none")] pub emissions: Option<Value>,
    #[serde(default, deserialize_with = "keep_null", skip_serializing_if = "Option::is_none")] pub review_hold: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub disposal_requested: Option<Value>,
    /// Equipment drops lying on the battlefield, oldest first: rolled, not yet in the Bag.
    #[serde(default, skip_serializing_if = "Option::is_none")] pub orbs: Option<Value>,
    /// Completed Cascade Fill bars while Bag levels are frozen (`bag_fill_cost`).
    #[serde(default, skip_serializing_if = "Option::is_none")] pub bag_fills: Option<f64>,
    #[serde(flatten)] pub extra: Map<String, Value>,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Emission { pub item: LampItem, pub issued_at: f64, #[serde(default, skip_serializing_if = "Option::is_none")] pub issued_active_ms: Option<f64>, pub collected: bool, #[serde(flatten)] pub extra: Map<String, Value> }
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewHold { pub item: LampItem, pub disposal: bool }
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GearCollection { pub id: String, pub item: LampItem }
/// `wishfire.equipment-economy.v5`.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LampEconomy {
    pub version: u32,
    #[serde(rename = "partyEXP", default)] pub party_exp: f64,
    pub gold: f64,
    pub items: Vec<LampItem>,
    pub loadouts: BTreeMap<String, BTreeMap<String, String>>,
    pub settled_gold_rewards: Vec<String>,
    pub lamp: LampState,
    #[serde(default)] pub migration: Map<String, Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub settled_bag_kill_rewards: Option<BTreeMap<String, Vec<[f64; 2]>>>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub pending_gear_collections: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub settled_combat_essence_rewards: Option<Vec<String>>,
    #[serde(flatten)] pub extra: Map<String, Value>,
}
impl LampEconomy {
    /// `createLampEconomy(seed, gold)`.
    pub fn create(seed: u32, gold: f64) -> Self {
        LampEconomy { version: 5, party_exp: 0., gold: gold.floor().max(0.), items: Vec::new(), loadouts: BTreeMap::new(), settled_gold_rewards: Vec::new(),
            lamp: LampState { capacity_tier: 0, essence: 0., kill_points: Some(0.), seed, sequence: 0., pending: Vec::new(), discarded: Some(Vec::new()), recent: Some(Vec::new()), salvage: Salvage::default(), auto_enabled: false, highest_ordinal: 0., last_activation_at: 0., guide: None, conveyor_active_ms: None, emissions: None, review_hold: None, disposal_requested: None, orbs: None, bag_fills: None, extra: Map::new() },
            migration: Map::new(), settled_bag_kill_rewards: None, pending_gear_collections: None, settled_combat_essence_rewards: None, extra: Map::new() }
    }
    pub fn to_value(&self) -> Value { serde_json::to_value(self).expect("lamp economy serializes") }
    pub fn capacity(&self) -> f64 { capacity_tier(self.lamp.capacity_tier).capacity }
    pub fn upgrade_cost(&self) -> Option<f64> { capacity_tier(self.lamp.capacity_tier).cost }
    pub fn kill_points(&self) -> f64 { self.lamp.kill_points.filter(|k| is_safe_integer(*k) && *k >= 0.).unwrap_or(0.) }
    pub fn item(&self, id: &str) -> Option<&LampItem> { self.items.iter().find(|i| i.instance_id == id) }
    pub fn review_hold(&self) -> Option<ReviewHold> { self.lamp.review_hold.as_ref().and_then(|v| serde_json::from_value(v.clone()).ok()) }
    pub fn set_review_hold(&mut self, hold: Option<ReviewHold>) { self.lamp.review_hold = Some(hold.map_or(Value::Null, |h| serde_json::to_value(h).unwrap())); }
    pub fn discarded(&self) -> &[String] { self.lamp.discarded.as_deref().unwrap_or(&[]) }
    pub fn emissions(&self) -> Vec<Emission> { self.lamp.emissions.as_ref().and_then(|v| serde_json::from_value(v.clone()).ok()).unwrap_or_default() }
    pub fn set_emissions(&mut self, emissions: Vec<Emission>) { self.lamp.emissions = Some(serde_json::to_value(emissions).unwrap()); }
    pub fn orbs(&self) -> Vec<LampItem> { self.lamp.orbs.as_ref().and_then(|v| serde_json::from_value(v.clone()).ok()).unwrap_or_default() }
    pub fn orb_count(&self) -> usize { self.lamp.orbs.as_ref().and_then(Value::as_array).map_or(0, Vec::len) }
    pub fn set_orbs(&mut self, orbs: Vec<LampItem>) { self.lamp.orbs = Some(serde_json::to_value(orbs).unwrap()); }
    /// Free Bag slots (`lampCapacity - lampStoredCount`); a held review item keeps its claim on one.
    pub fn free_slots(&self) -> usize { (self.capacity() - self.stored_count() - if self.review_hold().is_some() { 1. } else { 0. }).max(0.) as usize }
    pub fn disposal_requested(&self) -> Vec<String> { self.lamp.disposal_requested.as_ref().and_then(Value::as_array).map(|a| a.iter().filter_map(Value::as_str).map(String::from).collect()).unwrap_or_default() }
    pub fn set_disposal_requested(&mut self, ids: Vec<String>) { self.lamp.disposal_requested = Some(json!(ids)); }
    pub fn pending_gear_collections(&self) -> Vec<GearCollection> { self.pending_gear_collections.as_ref().and_then(|v| serde_json::from_value(v.clone()).ok()).unwrap_or_default() }
    pub fn set_pending_gear_collections(&mut self, events: Vec<GearCollection>) { self.pending_gear_collections = Some(serde_json::to_value(events).unwrap()); }
    /// `lampStoredCount`.
    pub fn stored_count(&self) -> f64 { self.lamp.pending.len() as f64 + self.discarded().len() as f64 + self.lamp.salvage.count }
    pub fn cooldown_remaining(&self, now: f64) -> f64 { if self.lamp.sequence != 0. { (self.lamp.last_activation_at + MIN_EMISSION_INTERVAL_MS - now).max(0.) } else { 0. } }
    pub fn bag_fills(&self) -> f64 { self.lamp.bag_fills.filter(|f| is_safe_integer(*f) && *f >= 0.).unwrap_or(0.) }
    /// The Bag bar while levels are frozen: progress points plus Essence toward `bag_fill_cost`.
    pub fn fill_progress(&self) -> UpgradeProgress {
        let required = bag_fill_cost(self.bag_fills());
        let current = self.kill_points() + self.lamp.essence;
        UpgradeProgress { current, required: Some(required), max: false, fraction: (current / required).min(1.) }
    }
    /// `lampUpgradeProgress`.
    pub fn upgrade_progress(&self) -> UpgradeProgress {
        let required = self.upgrade_cost();
        let current = self.kill_points() + self.lamp.essence;
        UpgradeProgress { current, required, max: required.is_none(), fraction: required.map_or(1., |r| (current / r).min(1.)) }
    }
}
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct UpgradeProgress { pub current: f64, pub required: Option<f64>, pub max: bool, pub fraction: f64 }
pub fn is_safe_integer(v: f64) -> bool { v.is_finite() && v.fract() == 0. && v.abs() <= 9007199254740991. }
fn vsafe(v: Option<&Value>) -> bool { jsnum::is_safe_integer(v) }
fn vint(v: Option<&Value>) -> bool { matches!(v, Some(Value::Number(n)) if n.as_f64().is_some_and(|f| f.is_finite() && f.fract() == 0.)) }
fn vnum(v: Option<&Value>) -> f64 { number(v) }
fn vstr(v: Option<&Value>) -> Option<&str> { v.and_then(Value::as_str) }
fn is_obj(v: Option<&Value>) -> bool { matches!(v, Some(Value::Object(_))) }
fn is_arr(v: Option<&Value>) -> bool { matches!(v, Some(Value::Array(_))) }
fn receipt_domain_ok(s: &str) -> bool { (s.starts_with("enemy:") || s.starts_with("tick:")) && s.len() <= 164 }
/// `validateLampEconomy(data, version)` on the JSON value; returns the typed (normalized) record.
pub fn validate_lamp_economy(data: &Value, version: u32) -> Result<LampEconomy, String> {
    let bad = || INVALID.to_string();
    let d = data.as_object().ok_or_else(bad)?;
    if version == 5 && (!vsafe(d.get("partyEXP")) || vnum(d.get("partyEXP")) < 0.) { return Err(bad()); }
    if d.get("version") != Some(&json!(version)) || !vsafe(d.get("gold")) || vnum(d.get("gold")) < 0. || !is_arr(d.get("items")) || !is_obj(d.get("loadouts")) || !is_arr(d.get("settledGoldRewards")) { return Err(bad()); }
    let l = d.get("lamp").and_then(Value::as_object);
    let lg = |k: &str| l.and_then(|l| l.get(k));
    if let Some(g) = lg("guide") { if !vint(Some(g)) || vnum(Some(g)) < 0. || vnum(Some(g)) > 7. { return Err(bad()); } }
    let tier = vnum(lg("capacityTier"));
    if let Some(s) = lg("upgradeStage") { if !vint(Some(s)) || vnum(Some(s)) < 0. || vnum(Some(s)) > 4. || (tier == LAMP_LEVELS as f64 - 1. && vnum(Some(s)) != 0.) { return Err(bad()); } }
    if let Some(e) = lg("upgradeEndsAt") { if !vsafe(Some(e)) || vnum(Some(e)) < 0. || (vnum(Some(e)) > 0. && (vnum(lg("upgradeStage")) != 4. || tier >= LAMP_LEVELS as f64 - 1.)) { return Err(bad()); } }
    if let Some(f) = lg("bagFills") { if !vsafe(Some(f)) || vnum(Some(f)) < 0. { return Err(bad()); } }
    if let Some(t) = lg("speedUpTickets") { if !vsafe(Some(t)) || vnum(Some(t)) < 0. { return Err(bad()); } }
    if version == 5 && (l.is_none() || !vint(lg("capacityTier")) || tier < 0. || tier >= LAMP_LEVELS as f64 || !vsafe(lg("essence")) || vnum(lg("essence")) < 0.) { return Err(bad()); }
    let Some(lo) = l else { return Err(bad()) };
    let capacity = if version == 5 { capacity_tier(tier as u32).capacity } else { CAPACITY as f64 };
    let pending = lo.get("pending").and_then(Value::as_array).ok_or_else(bad)?;
    if !vint(lo.get("seed")) || vnum(lo.get("seed")) < 0. || vnum(lo.get("seed")) > 4294967295. || !vsafe(lo.get("sequence")) || vnum(lo.get("sequence")) < 0. || !vsafe(lo.get("highestOrdinal")) || vnum(lo.get("highestOrdinal")) < 0. || vnum(lo.get("highestOrdinal")) > MAX_ORDINAL as f64
        || !vnum(lo.get("lastActivationAt")).is_finite() || !matches!(lo.get("autoEnabled"), Some(Value::Bool(_))) || !vsafe(lo.get("salvage").and_then(|s| s.get("count"))) || vnum(lo.get("salvage").and_then(|s| s.get("count"))) < 0.
        || !vsafe(lo.get("salvage").and_then(|s| s.get("gold"))) || vnum(lo.get("salvage").and_then(|s| s.get("gold"))) < 0. || pending.len() as f64 > capacity { return Err(bad()); }
    if let Some(receipts) = d.get("settledBagKillRewards") {
        let r = receipts.as_object().ok_or_else(bad)?;
        for (session, ranges) in r {
            let ranges = ranges.as_array().filter(|_| receipt_domain_ok(session)).ok_or_else(bad)?;
            let mut previous_hi = f64::NEG_INFINITY;
            for (i, range) in ranges.iter().enumerate() {
                let pair = range.as_array().filter(|p| p.len() == 2).ok_or_else(bad)?;
                if pair.iter().any(|n| !vsafe(Some(n)) || vnum(Some(n)) < 1.) || vnum(Some(&pair[0])) > vnum(Some(&pair[1])) || (i > 0 && vnum(Some(&pair[0])) <= previous_hi + 1.) { return Err(bad()); }
                previous_hi = vnum(Some(&pair[1]));
            }
        }
    }
    let mut ids: Vec<&str> = Vec::new();
    let allowed: Vec<&str> = match version { 2 => vec!["HP", "ATK", "DEF", "MAG", "RES", "SPD"], 3 => vec!["ATK", "DEF", "MAG", "RES"], _ => GEAR_STATS.to_vec() };
    for i in d["items"].as_array().unwrap() {
        let o = i.as_object().ok_or_else(bad)?;
        let id = vstr(o.get("instanceId")).filter(|s| !s.is_empty()).ok_or_else(bad)?;
        let name_ok = vstr(o.get("name")).is_some_and(|n| !n.is_empty() && n.len() <= 100);
        let stats = o.get("stats").and_then(Value::as_object);
        if !name_ok || !vsafe(o.get("level")) || vnum(o.get("level")) < 1. || vnum(o.get("level")) > MAX_ORDINAL as f64 + 1. || ids.contains(&id) || vstr(o.get("type")).and_then(equipment::slot_label).is_none()
            || vstr(o.get("rarity")).and_then(equipment::rarity).is_none() || stats.is_none() || !vint(o.get("art")) || vnum(o.get("art")) < 0. || vnum(o.get("art")) > 8. { return Err(bad()); }
        let stats = stats.unwrap();
        if stats.is_empty() { return Err(bad()); }
        if version != 2 && allowed.iter().any(|k| !stats.contains_key(*k)) { return Err(bad()); }
        if stats.iter().any(|(k, v)| !allowed.contains(&k.as_str()) || !vsafe(Some(v)) || vnum(Some(v)) < 0. || vnum(Some(v)) > 100000.) { return Err(bad()); }
        ids.push(id);
    }
    let mut assigned: Vec<&str> = Vec::new();
    let mut assign = |id: &str| -> Result<(), String> { let id_ref = ids.iter().find(|x| **x == id).ok_or_else(bad)?; if assigned.contains(id_ref) { return Err(bad()); } assigned.push(id_ref); Ok(()) };
    if d["settledGoldRewards"].as_array().unwrap().iter().any(|v| !v.is_string()) || d["loadouts"].as_object().unwrap().keys().any(|k| ["__proto__", "constructor", "prototype"].contains(&k.as_str())) { return Err(bad()); }
    for slots in d["loadouts"].as_object().unwrap().values() {
        let s = slots.as_object().ok_or_else(bad)?;
        for (slot, id) in s {
            let id = id.as_str().unwrap_or("");
            if equipment::slot_label(slot).is_none() || d["items"].as_array().unwrap().iter().find(|i| i["instanceId"].as_str() == Some(id)).and_then(|i| i["type"].as_str()) != Some(slot.as_str()) { return Err(bad()); }
            assign(id)?;
        }
    }
    if let Some(recent) = lo.get("recent") {
        let r = recent.as_array().ok_or_else(bad)?;
        if r.len() > 5 || r.iter().any(|i| !i.is_object() || !i["instanceId"].is_string() || !i["name"].is_string() || vstr(i.get("rarity")).and_then(equipment::rarity).is_none() || !vint(i.get("art")) || vnum(i.get("art")) < 0. || vnum(i.get("art")) > 8. || !vsafe(i.get("level")) || vnum(i.get("level")) < 1. || vnum(i.get("level")) > MAX_ORDINAL as f64 + 1.) { return Err(bad()); }
    }
    for id in pending { assign(id.as_str().unwrap_or(""))?; }
    if let Some(discarded) = lo.get("discarded") { let a = discarded.as_array().ok_or_else(bad)?; for id in a { assign(id.as_str().unwrap_or(""))?; } }
    if assigned.len() != ids.len() { return Err(bad()); }
    let mut typed: LampEconomy = serde_json::from_value(data.clone()).map_err(|_| bad())?;
    if version == 5 { typed.lamp.kill_points = Some(typed.kill_points()); }
    if let Some(receipts) = typed.settled_bag_kill_rewards.as_mut() { trim_kill_receipt_domains(receipts); }
    Ok(typed)
}
/// `trimKillReceiptDomains`: keeps the last 64 domains in key order.
fn trim_kill_receipt_domains(receipts: &mut BTreeMap<String, Vec<[f64; 2]>>) {
    while receipts.len() > KILL_RECEIPT_DOMAINS { let first = receipts.keys().next().cloned().unwrap(); receipts.remove(&first); }
}
/// `migrateLampEconomy(v4)`.
pub fn migrate_v4(old: &Value) -> Result<LampEconomy, String> {
    validate_lamp_economy(old, 4)?;
    let mut next = old.clone();
    next["version"] = json!(5); next["partyEXP"] = json!(0); next["lamp"]["capacityTier"] = json!(0); next["lamp"]["essence"] = json!(0);
    validate_lamp_economy(&next, 5)
}
/// `migrateFourStatLamp(v3)`: HP zero on every item.
pub fn migrate_v3(old: &Value) -> Result<LampEconomy, String> {
    validate_lamp_economy(old, 3)?;
    let mut next = old.clone();
    next["version"] = json!(5); next["partyEXP"] = json!(0); next["lamp"]["capacityTier"] = json!(0); next["lamp"]["essence"] = json!(0);
    for item in next["items"].as_array_mut().unwrap() { item["stats"]["HP"] = json!(0); }
    validate_lamp_economy(&next, 5)
}
/// `migrateDraftLamp(v2)`: regenerates missing stats from the seed, drops retired SPD.
pub fn migrate_v2(old: &Value) -> Result<LampEconomy, String> {
    validate_lamp_economy(old, 2)?;
    let mut next = old.clone();
    next["version"] = json!(5); next["partyEXP"] = json!(0); next["lamp"]["capacityTier"] = json!(0); next["lamp"]["essence"] = json!(0);
    let seed = next["lamp"]["seed"].as_u64().unwrap() as u32;
    let default_weights: Vec<(&str, f64)> = RARITIES.iter().map(|r| (r.key, r.weight)).collect();
    for item in next["items"].as_array_mut().unwrap() {
        let generated = match (vint(item.get("sequence")), vint(item.get("ordinal"))) { (true, true) => Some(generate_lamp_item(seed, vnum(item.get("sequence")) as u32, vnum(item.get("ordinal")) as u32, &default_weights)), _ => None };
        let mut stats = Map::new();
        for k in GEAR_STATS { let v = item["stats"].get(k).cloned().unwrap_or_else(|| json!(if k == "HP" { 0. } else { generated.as_ref().map_or(0., |g| g.stat(k)) })); stats.insert(k.into(), v); }
        item["stats"] = Value::Object(stats);
    }
    validate_lamp_economy(&next, 5)
}
/// `migrateLegacyEquipment(v1, seed)`.
pub fn migrate_v1(old: &Value, seed: u32) -> Result<LampEconomy, String> {
    let o = old.as_object().filter(|o| o.get("version") == Some(&json!(1)) && vsafe(o.get("gold")) && vnum(o.get("gold")) >= 0. && is_arr(o.get("items")) && o.get("loadouts").is_some_and(|l| !l.is_null())
        && vint(o.get("market").and_then(|m| m.get("seed"))) && vnum(o.get("market").and_then(|m| m.get("epoch"))).is_finite() && vnum(o.get("market").and_then(|m| m.get("lastSeen"))).is_finite())
        .ok_or("Legacy equipment save is invalid. Original data is preserved.")?;
    let mut by_id: BTreeMap<String, &Value> = BTreeMap::new();
    for i in o["items"].as_array().unwrap() {
        let id = vstr(i.get("instanceId"));
        if vstr(i.get("equipmentId")).and_then(catalog).is_none() || id.is_none() || by_id.contains_key(id.unwrap()) { return Err("Legacy ownership is invalid.".into()); }
        by_id.insert(id.unwrap().into(), i);
    }
    let mut next = LampEconomy::create(seed, vnum(o.get("gold")));
    next.migration.insert("legacyVersion".into(), json!(1));
    next.settled_gold_rewards = o.get("settledGoldRewards").and_then(Value::as_array).map(|a| a.iter().filter_map(Value::as_str).map(String::from).collect()).unwrap_or_default();
    let mut kept: Vec<String> = Vec::new();
    for (hero, slots) in o["loadouts"].as_object().ok_or("Legacy loadout is invalid.")? {
        let s = slots.as_object().ok_or("Legacy loadout is invalid.")?;
        for (slot, id) in s {
            let id = id.as_str().unwrap_or("");
            let item = by_id.get(id).ok_or("Legacy equipped item is missing.")?;
            let d = catalog(item["equipmentId"].as_str().unwrap()).unwrap();
            let Some(kind) = (match slot.as_str() { "head" => Some("hat"), "armor" => Some("body"), "boots" => Some("boots"), _ => None }) else { continue };
            if d.kind != slot || kept.iter().any(|k| k == id) { return Err("Legacy assignment is invalid.".into()); }
            let art = GEAR_ARCHETYPES.iter().find(|a| a.kind == kind).map_or(0, |a| a.art);
            let stats: Map<String, Value> = GEAR_STATS.iter().map(|k| (k.to_string(), json!(d.stats.iter().find(|(s, _)| s == k).map_or(0., |(_, v)| *v)))).collect();
            next.items.push(LampItem { instance_id: id.into(), equipment_id: Some(d.id.into()), name: d.name.into(), kind: kind.into(), rarity: d.rarity.into(), stats, art, level: 1., sequence: None, ordinal: None, extra: Map::new() });
            next.loadouts.entry(hero.clone()).or_default().insert(kind.into(), id.into());
            kept.push(id.into());
        }
    }
    let mut salvage = 0.;
    for (id, item) in &by_id { if !kept.contains(id) { salvage += salvage_value(catalog(item["equipmentId"].as_str().unwrap()).unwrap().rarity); } }
    next.gold += salvage;
    next.migration.insert("salvageGold".into(), json!(salvage));
    validate_lamp_economy(&next.to_value(), 5)
}
/// `validateConveyorState(data)`: economy checks, then conveyor fields.
pub fn validate_conveyor_state(data: &Value) -> Result<LampEconomy, String> {
    let economy = validate_lamp_economy(data, 5)?;
    let bad = || CONVEYOR_INVALID.to_string();
    let check = |item: &Value| -> Result<(), String> {
        let mut sample = LampEconomy::create(economy.lamp.seed, 0.).to_value();
        sample["items"] = json!([item]);
        sample["lamp"]["pending"] = json!([item.get("instanceId").cloned().unwrap_or(Value::Null)]);
        validate_lamp_economy(&sample, 5).map(|_| ()).map_err(|_| INVALID.to_string())
    };
    let l = &data["lamp"];
    if economy.stored_count() > economy.capacity() { return Err(bad()); }
    if let Some(ms) = l.get("conveyorActiveMs") { if !vsafe(Some(ms)) || vnum(Some(ms)) < 0. { return Err(bad()); } }
    if let Some(emissions) = l.get("emissions") {
        let a = emissions.as_array().filter(|a| a.len() <= 16).ok_or_else(bad)?;
        let mut ids: Vec<String> = Vec::new();
        for e in a {
            let o = e.as_object().ok_or_else(bad)?;
            let seq = o.get("item").and_then(|i| i.get("sequence"));
            let id = o.get("item").and_then(|i| i.get("instanceId")).and_then(Value::as_str).unwrap_or("");
            if !vsafe(o.get("issuedAt")) || vnum(o.get("issuedAt")) < 0. || !matches!(o.get("collected"), Some(Value::Bool(_))) || !vsafe(seq) || vnum(seq) >= economy.lamp.sequence || id != format!("lamp:{}:{}", economy.lamp.seed, vnum(seq)) || ids.contains(&id.to_string()) { return Err(bad()); }
            if let Some(ms) = o.get("issuedActiveMs") { if !vsafe(Some(ms)) || vnum(Some(ms)) < 0. || economy.lamp.conveyor_active_ms.is_none() || vnum(Some(ms)) > economy.lamp.conveyor_active_ms.unwrap() { return Err(bad()); } }
            check(&o["item"])?;
            ids.push(id.into());
        }
    }
    if let Some(hold) = l.get("reviewHold").filter(|h| !h.is_null() && *h != &Value::Bool(false)) {
        check(&hold["item"])?;
        if !matches!(hold.get("disposal"), Some(Value::Bool(_))) || economy.items.iter().any(|i| Some(i.instance_id.as_str()) == hold["item"]["instanceId"].as_str()) { return Err(bad()); }
    }
    if let Some(requested) = l.get("disposalRequested") {
        let a = requested.as_array().ok_or_else(bad)?;
        let mut seen: Vec<&Value> = Vec::new();
        let hold_id = economy.review_hold().map(|h| h.item.instance_id);
        for id in a {
            if seen.contains(&id) { return Err(bad()); }
            seen.push(id);
            let s = id.as_str().unwrap_or("");
            if !economy.lamp.pending.iter().any(|p| p == s) && !economy.discarded().iter().any(|p| p == s) && hold_id.as_deref() != Some(s) { return Err(bad()); }
        }
    }
    if let Some(orbs) = l.get("orbs") {
        let a = orbs.as_array().filter(|a| a.len() <= ORB_LIMIT).ok_or_else(bad)?;
        let mut ids: Vec<&str> = Vec::new();
        for item in a {
            let seq = item.get("sequence");
            let id = item.get("instanceId").and_then(Value::as_str).unwrap_or("");
            if !vsafe(seq) || vnum(seq) >= economy.lamp.sequence || id != format!("lamp:{}:{}", economy.lamp.seed, vnum(seq)) || ids.contains(&id) || economy.items.iter().any(|i| i.instance_id == id) || serde_json::from_value::<LampItem>(item.clone()).is_err() || rarity_index(item["rarity"].as_str().unwrap_or("")).is_none() { return Err(bad()); }
            ids.push(id);
        }
    }
    if let Some(events) = data.get("pendingGearCollections") {
        let a = events.as_array().filter(|a| a.len() <= 4096).ok_or_else(bad)?;
        let mut ids: Vec<&str> = Vec::new();
        for event in a {
            let id = event.get("id").and_then(Value::as_str).ok_or_else(bad)?;
            if event["item"]["instanceId"].as_str() != Some(id) || ids.contains(&id) { return Err(bad()); }
            check(&event["item"])?;
            ids.push(id);
        }
    }
    serde_json::from_value::<LampEconomy>(data.clone()).map(|mut e| { if let Some(r) = e.settled_bag_kill_rewards.as_mut() { trim_kill_receipt_domains(r); } e.lamp.kill_points = Some(e.kill_points()); e }).map_err(|_| bad())
}

// ---- Bag progress ----
#[derive(Clone, Debug, PartialEq, Default)]
pub struct BagClock { pub battle_id: String, pub index: f64, pub seconds: f64 }
#[derive(Clone, Debug, PartialEq)]
pub struct BagReward { pub id: String, pub amount: f64 }
/// `advanceLampCombatProgress(clock, {battleId, seconds, data, pending})`.
pub fn advance_lamp_combat_progress(clock: Option<&BagClock>, battle_id: &str, seconds: f64, data: Option<&LampEconomy>, pending: &BTreeMap<String, f64>) -> Result<(Option<BagClock>, Vec<BagReward>), String> {
    let Some(data) = data else { return Ok((None, Vec::new())) };
    if battle_id.is_empty() || data.upgrade_cost().is_none() || !seconds.is_finite() || seconds <= 0. { return Ok((None, Vec::new())); }
    let domain = format!("tick:{battle_id}");
    let clock = match clock {
        Some(c) if c.battle_id == battle_id => c.clone(),
        other => {
            let mut index = data.settled_bag_kill_rewards.as_ref().and_then(|r| r.get(&domain)).and_then(|ranges| ranges.last()).map_or(0., |r| r[1]);
            for id in pending.keys() {
                if let Some(rest) = id.strip_prefix(&format!("{domain}:")) { if let Ok(n) = rest.parse::<f64>() { if is_safe_integer(n) && n > index { index = n; } } }
            }
            BagClock { battle_id: battle_id.into(), index, seconds: other.map_or(0., |c| c.seconds) }
        }
    };
    let elapsed = clock.seconds + seconds;
    let count = ((elapsed + 1e-9) / TICK_SECONDS).floor();
    let index = clock.index + count;
    if !is_safe_integer(index) { return Err("Bag tick index exceeds the safe save limit.".into()); }
    let rewards = (0..count as u32).map(|n| BagReward { id: format!("{domain}:{}", clock.index + n as f64 + 1.), amount: TICK_POINTS }).collect();
    Ok((Some(BagClock { battle_id: battle_id.into(), index, seconds: (elapsed - count * TICK_SECONDS).max(0.) }), rewards))
}
#[derive(Clone, Debug, PartialEq)]
pub enum KillPointsResult { Applied(f64), Duplicate, Max }
/// `awardLampKillPoints(data, id, amount)`.
pub fn award_lamp_kill_points(data: &mut LampEconomy, id: &str, amount: f64) -> Result<KillPointsResult, String> {
    let split = id.rfind(':');
    let (session, uid_text) = match split { Some(i) => (&id[..i], &id[i + 1..]), None => ("", "") };
    let uid: f64 = uid_text.parse().unwrap_or(f64::NAN);
    if !receipt_domain_ok(session) || id.len() > 180 || !is_safe_integer(uid) || uid < 1. || format!("{uid}") != uid_text || !(amount == TICK_POINTS || amount == BOSS_KILL_POINTS) { return Err("Invalid Bag progress receipt.".into()); }
    let ranges = data.settled_bag_kill_rewards.as_ref().and_then(|r| r.get(session)).cloned().unwrap_or_default();
    if ranges.iter().any(|[lo, hi]| uid >= *lo && uid <= *hi) { return Ok(KillPointsResult::Duplicate); }
    if data.upgrade_cost().is_none() { return Ok(KillPointsResult::Max); }
    let total = data.kill_points() + amount;
    if !is_safe_integer(total) { return Err("Bag progress points exceed the safe save limit.".into()); }
    let mut all = ranges;
    all.push([uid, uid]);
    all.sort_by(|a, b| a[0].partial_cmp(&b[0]).unwrap());
    let mut merged: Vec<[f64; 2]> = Vec::new();
    for [lo, hi] in all { match merged.last_mut() { Some(last) if lo <= last[1] + 1. => last[1] = last[1].max(hi), _ => merged.push([lo, hi]) } }
    data.lamp.kill_points = Some(total);
    let receipts = data.settled_bag_kill_rewards.get_or_insert_with(BTreeMap::new);
    receipts.insert(session.into(), merged);
    trim_kill_receipt_domains(receipts);
    Ok(KillPointsResult::Applied(total))
}
/// `restorePaidLampUpgrade(data)`: one-time Essence credit for imported paid stages.
pub fn restore_paid_lamp_upgrade(data: &mut LampEconomy) -> Result<bool, String> {
    let stage = data.lamp.extra.get("upgradeStage").cloned();
    let ends = data.lamp.extra.get("upgradeEndsAt").cloned();
    if stage.is_none() && ends.is_none() { return Ok(false); }
    let paid = ((data.upgrade_cost().unwrap_or(0.)) * vnum(stage.as_ref()).max(0.) / 4.).floor();
    if !is_safe_integer(data.lamp.essence + paid) { return Err("Bag progress exceeds the safe save limit. Original data is preserved.".into()); }
    data.lamp.essence += paid;
    data.lamp.extra.remove("upgradeStage");
    data.lamp.extra.remove("upgradeEndsAt");
    Ok(true)
}
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpgradeReceipt { pub level_before: u32, pub level_after: u32, pub capacity_before: f64, pub capacity_after: f64, pub cost: f64 }
/// `upgradeLamp(data, expectedTier)`.
pub fn upgrade_lamp(data: &mut LampEconomy, expected_tier: u32) -> Result<UpgradeReceipt, String> {
    if data.lamp.capacity_tier != expected_tier { return Err("Bag level changed. Review the updated upgrade.".into()); }
    let cost = data.upgrade_cost().ok_or("Bag is fully upgraded.")?;
    let points = data.kill_points();
    let current = points + data.lamp.essence;
    if current < cost { return Err(format!("Need {} more Bag progress.", equipment::format_compact_count(cost - current))); }
    let before = data.lamp.capacity_tier;
    let spent = points.min(cost);
    data.lamp.kill_points = Some(points - spent);
    data.lamp.essence -= cost - spent;
    data.lamp.capacity_tier += 1;
    Ok(UpgradeReceipt { level_before: before + 1, level_after: data.lamp.capacity_tier + 1, capacity_before: capacity_tier(before).capacity, capacity_after: data.capacity(), cost })
}
/// A full Bag bar while levels are frozen: spends its cost like `upgrade_lamp` (progress points
/// first, then Essence) and banks one fill. The Bag level, capacity and rarity odds are unchanged.
/// Returns the cost paid.
pub fn complete_bag_fill(data: &mut LampEconomy, expected_fills: f64) -> Result<f64, String> {
    let fills = data.bag_fills();
    if fills != expected_fills { return Err("Bag progress changed. Review the updated bar.".into()); }
    let cost = bag_fill_cost(fills);
    let points = data.kill_points();
    let current = points + data.lamp.essence;
    if current < cost { return Err(format!("Need {} more Bag progress.", equipment::format_compact_count(cost - current))); }
    let spent = points.min(cost);
    data.lamp.kill_points = Some(points - spent);
    data.lamp.essence -= cost - spent;
    data.lamp.bag_fills = Some(fills + 1.);
    Ok(cost)
}
/// The Cascade Fill has finished (owner 2026-11-05): the Essence left over, less than one bar,
/// moves into the bar's saved progress points, so the Essence counter reads zero and the bar
/// keeps what it showed. Returns the Essence moved.
pub fn bank_bag_essence(data: &mut LampEconomy) -> Result<f64, String> {
    let essence = data.lamp.essence;
    if essence <= 0. { return Ok(0.); }
    let points = data.kill_points() + essence;
    if !is_safe_integer(points) { return Err("Bag progress exceeds the safe save limit. Original data is preserved.".into()); }
    data.lamp.kill_points = Some(points);
    data.lamp.essence = 0.;
    Ok(essence)
}
/// `markLampGuide(data, step)`.
pub fn mark_lamp_guide(data: &mut LampEconomy, step: &str) -> Result<u32, String> {
    let bit = match step { "storage" => GUIDE_STORAGE, "comparison" => GUIDE_COMPARISON, "preview" => GUIDE_PREVIEW, _ => return Err("Unknown lamp guide step.".into()) };
    let hold = data.review_hold().is_some();
    if step != "preview" && data.stored_count() == 0. && !hold { return Err("Open stored equipment first.".into()); }
    if step == "comparison" && data.lamp.pending.is_empty() && data.discarded().is_empty() && !hold { return Err("Choose equipment first.".into()); }
    let guide = (data.lamp.guide.unwrap_or(0.) as u32) | bit;
    data.lamp.guide = Some(guide as f64);
    Ok(guide)
}

// ---- heroes, CP and comparisons ----
/// A lamp gear owner: the canonical saved hero record (`lampHeroRoster`).
#[derive(Clone, Debug, PartialEq)]
pub struct LampHero { pub instance_key: String, pub definition: &'static HeroDefinition, pub level: u32 }
pub fn find_gear<'a>(data: &'a LampEconomy) -> impl Fn(&str) -> Option<Gear> + 'a {
    move |id: &str| { let owned = data.item(id)?; Some(if !owned.stats.is_empty() && !owned.kind.is_empty() { owned.gear() } else { let c = catalog(owned.equipment_id.as_deref()?)?; Gear { kind: c.kind.into(), stats: c.stats.iter().map(|(k, v)| (k.to_string(), *v)).collect() } }) }
}
fn loadout_stats(data: &LampEconomy, loadout: Option<&BTreeMap<String, String>>) -> BTreeMap<String, f64> {
    let find = find_gear(data);
    equipment_stats(|id| find(id), loadout.into_iter().flat_map(|l| l.iter().map(|(s, id)| (s.as_str(), id.as_str()))))
}
/// `computeCombatPower(refreshHeroStats({...hero, equipmentStats}))`.
pub fn hero_cp_with(hero: &LampHero, equipment: &BTreeMap<String, f64>) -> f64 {
    let stats = hero::level_stats(hero.definition, hero.level, equipment);
    compute_combat_power(CpActor::new(hero.level as f64, stats.atk, stats.mag, stats.def, stats.res, hero::max_hp(stats.hp, 1.), stats.spd))
}
pub fn lamp_hero_cp(data: &LampEconomy, hero: &LampHero) -> f64 { hero_cp_with(hero, &loadout_stats(data, data.loadouts.get(&hero.instance_key))) }
/// `lampItemCPGain(data, item, hero)`: CP after replacing the matching slot minus current CP.
pub fn lamp_item_cp_gain(data: &LampEconomy, item: &LampItem, hero: &LampHero) -> f64 {
    let loadout = data.loadouts.get(&hero.instance_key).cloned().unwrap_or_default();
    let before = hero_cp_with(hero, &loadout_stats(data, Some(&loadout)));
    let mut with_item = data.clone();
    if !with_item.items.iter().any(|i| i.instance_id == item.instance_id) { with_item.items.push(item.clone()); }
    let mut next = loadout.clone();
    next.insert(item.kind.clone(), item.instance_id.clone());
    let after = hero_cp_with(hero, &loadout_stats(&with_item, Some(&next)));
    round((after - before) * 10.) / 10.
}
/// `lampGearCP(item)`.
pub fn lamp_gear_cp(item: &LampItem) -> f64 {
    compute_combat_power(CpActor::new(1., item.stat("ATK"), item.stat("MAG"), item.stat("DEF"), item.stat("RES"), item.stat("HP"), item.stat("SPD")))
}
#[derive(Clone, Debug, PartialEq)]
pub struct Comparison { pub hero_id: String, pub current: Option<Gear>, pub upgrade: bool, pub deltas: BTreeMap<String, f64> }
/// `compareLampItem(data, item, heroId)`.
pub fn compare_lamp_item(data: &LampEconomy, item: &LampItem, hero_id: &str) -> Comparison {
    let current = data.loadouts.get(hero_id).and_then(|l| l.get(&item.kind)).and_then(|id| find_gear(data)(id));
    let deltas = GEAR_STATS.iter().map(|k| (k.to_string(), item.stat(k) - current.as_ref().and_then(|c| c.stats.get(*k)).copied().unwrap_or(0.))).collect();
    Comparison { hero_id: hero_id.into(), upgrade: is_equipment_upgrade(&item.gear(), current.as_ref()), current, deltas }
}
/// `sortedLampItems(data, ids)`: rarity desc, gear CP desc, sequence asc, id asc.
pub fn sorted_lamp_items<'a>(data: &'a LampEconomy, ids: &[String]) -> Vec<&'a LampItem> {
    let mut items: Vec<&LampItem> = ids.iter().filter_map(|id| data.item(id)).collect();
    items.sort_by(|a, b| {
        rarity_index(&b.rarity).cmp(&rarity_index(&a.rarity))
            .then(lamp_gear_cp(b).partial_cmp(&lamp_gear_cp(a)).unwrap())
            .then(a.sequence.unwrap_or(0.).partial_cmp(&b.sequence.unwrap_or(0.)).unwrap())
            .then(a.instance_id.cmp(&b.instance_id))
    });
    items
}
#[derive(Clone, Debug, PartialEq)]
pub struct Candidate { pub item: LampItem, pub queue: &'static str, pub gains: Vec<(String, f64)>, pub best_gain: f64, pub best_hero_id: Option<String> }
/// `lampReviewCandidates(data, heroes)`.
pub fn lamp_review_candidates(data: &LampEconomy, heroes: &[LampHero]) -> Vec<Candidate> {
    let mut queues: Vec<(String, &'static str)> = data.lamp.pending.iter().map(|id| (id.clone(), "pending")).collect();
    for id in data.discarded() { match queues.iter_mut().find(|(q, _)| q == id) { Some(e) => e.1 = "discarded", None => queues.push((id.clone(), "discarded")) } }
    let ids: Vec<String> = queues.iter().map(|(id, _)| id.clone()).collect();
    let mut out: Vec<Candidate> = sorted_lamp_items(data, &ids).into_iter().map(|item| {
        let gains: Vec<(String, f64)> = heroes.iter().map(|h| (h.instance_key.clone(), lamp_item_cp_gain(data, item, h))).collect();
        let best_hero = select_auto_equip_hero(data, item, heroes);
        let best_gain = best_hero.as_ref().and_then(|b| gains.iter().find(|(id, _)| id == b)).map_or(0., |(_, g)| *g);
        Candidate { item: item.clone(), queue: queues.iter().find(|(q, _)| *q == item.instance_id).map_or("pending", |(_, q)| q), gains, best_gain, best_hero_id: best_hero }
    }).collect();
    out.sort_by(|a, b| b.best_gain.partial_cmp(&a.best_gain).unwrap());
    out
}
/// `selectAutoEquipHero`: greatest gain, then lowest hero CP, then party order.
pub fn select_auto_equip_hero(data: &LampEconomy, item: &LampItem, heroes: &[LampHero]) -> Option<String> {
    let (mut best, mut best_gain, mut best_cp) = (None, 0., f64::INFINITY);
    for hero in heroes {
        let gain = lamp_item_cp_gain(data, item, hero);
        if gain <= 0. { continue; }
        let cp = lamp_hero_cp(data, hero);
        if gain > best_gain || (gain == best_gain && cp < best_cp) { best = Some(hero.instance_key.clone()); best_gain = gain; best_cp = cp; }
    }
    best
}
/// `equipLampItem(data, heroId, id, hero)`: the replaced piece leaves the save.
pub fn equip_lamp_item(data: &mut LampEconomy, hero_id: &str, id: &str, hero: Option<&LampHero>) -> Result<LampItem, String> {
    let pending = data.lamp.pending.iter().any(|p| p == id);
    let discarded = data.discarded().iter().any(|p| p == id);
    if !pending && !discarded { return Err("This result is no longer available.".into()); }
    let item = data.item(id).cloned().ok_or("Item missing.")?;
    let hero = hero.filter(|h| h.instance_key == hero_id).ok_or("Current hero is required before equipping.")?;
    if lamp_item_cp_gain(data, &item, hero) <= 0. { return Err("This equipment does not increase this hero CP.".into()); }
    let previous = data.loadouts.get(hero_id).and_then(|s| s.get(&item.kind)).cloned();
    if let Some(previous) = previous { data.items.retain(|e| e.instance_id != previous); }
    data.loadouts.entry(hero_id.into()).or_default().insert(item.kind.clone(), id.into());
    data.lamp.pending.retain(|x| x != id);
    data.lamp.discarded = Some(data.discarded().iter().filter(|x| *x != id).cloned().collect());
    Ok(item)
}

// ---- conveyor (lampConveyor.mjs) ----
pub fn conveyor_item_age(lamp: &LampState, emission: &Emission, now: f64, active_ms: Option<f64>) -> f64 {
    match emission.issued_active_ms { None => (now - emission.issued_at).max(0.), Some(issued) => (active_ms.or(lamp.conveyor_active_ms).unwrap_or(0.) - issued).max(0.) }
}
/// `conveyorReviewCandidates`: the held item joins the candidates as queue "held".
pub fn conveyor_review_candidates(data: &LampEconomy, heroes: &[LampHero]) -> Vec<Candidate> {
    let hold = data.review_hold();
    let mut virtual_data = data.clone();
    if let Some(h) = &hold { virtual_data.items.push(h.item.clone()); virtual_data.lamp.pending.push(h.item.instance_id.clone()); }
    lamp_review_candidates(&virtual_data, heroes).into_iter().map(|mut c| { if hold.as_ref().is_some_and(|h| h.item.instance_id == c.item.instance_id) { c.queue = "held"; } c }).collect()
}
/// `classifyConveyorCache(data, heroes)`: promotes a held item into a free slot, splits pending/discarded.
pub fn classify_conveyor_cache(data: &mut LampEconomy, heroes: &[LampHero]) -> Vec<Candidate> {
    if let Some(hold) = data.review_hold() { if data.stored_count() < data.capacity() { data.items.push(hold.item.clone()); data.lamp.pending.push(hold.item.instance_id.clone()); data.set_review_hold(None); } }
    let candidates = conveyor_review_candidates(data, heroes);
    let requested: Vec<String> = data.disposal_requested().into_iter().filter(|id| candidates.iter().any(|c| c.item.instance_id == *id && c.best_gain <= 0.)).collect();
    if data.lamp.disposal_requested.is_some() { data.set_disposal_requested(requested.iter().filter(|id| candidates.iter().any(|c| c.item.instance_id == **id)).cloned().collect()); }
    data.lamp.pending = candidates.iter().filter(|c| c.queue != "held" && c.best_gain > 0. && !requested.contains(&c.item.instance_id)).map(|c| c.item.instance_id.clone()).collect();
    data.lamp.discarded = Some(candidates.iter().filter(|c| c.queue != "held" && (c.best_gain <= 0. || requested.contains(&c.item.instance_id))).map(|c| c.item.instance_id.clone()).collect());
    candidates
}
/// `emitConveyorItem(data, context, now)`.
pub fn emit_conveyor_item(data: &mut LampEconomy, region: f64, stage: f64, now: f64) -> Result<LampItem, String> {
    if data.cooldown_remaining(now) > 0. { return Err("The lamp is preparing its next emission.".into()); }
    data.lamp.highest_ordinal = data.lamp.highest_ordinal.max(progression_ordinal(region, stage) as f64);
    let tier = capacity_tier(data.lamp.capacity_tier);
    let item = generate_lamp_item(data.lamp.seed, data.lamp.sequence as u32, data.lamp.highest_ordinal as u32, &tier.rarity_weights);
    data.lamp.sequence += 1.;
    data.lamp.last_activation_at = now;
    let mut emissions = data.emissions();
    emissions.push(Emission { item: item.clone(), issued_at: now, issued_active_ms: data.lamp.conveyor_active_ms, collected: false, extra: Map::new() });
    if emissions.len() > 16 { let drop = emissions.len() - 16; emissions.drain(..drop); }
    data.set_emissions(emissions);
    Ok(item)
}
#[derive(Clone, Debug, PartialEq)]
pub struct CollectResult { pub item: LampItem, pub saved: bool, pub exp: f64, pub held: bool }
/// `collectConveyorItem(data, id, now, {automatic})`.
pub fn collect_conveyor_item(data: &mut LampEconomy, id: &str, now: f64, automatic: bool) -> Result<CollectResult, String> {
    let hold = data.review_hold();
    let owned = data.item(id).cloned().or_else(|| hold.as_ref().map(|h| h.item.clone()).filter(|i| i.instance_id == id));
    if let Some(owned) = owned { return Ok(CollectResult { held: hold.as_ref().is_some_and(|h| h.item.instance_id == id), item: owned, saved: false, exp: 0. }); }
    let emissions = data.emissions();
    let index = emissions.iter().position(|e| e.item.instance_id == id);
    let e = index.map(|i| emissions[i].clone());
    if e.as_ref().is_none_or(|e| e.collected || conveyor_item_age(&data.lamp, e, now, None) >= CONVEYOR_TRAVEL_MS) { return Err("That item has passed. Review the cache for collected equipment.".into()); }
    let e = e.unwrap();
    if data.stored_count() >= data.capacity() {
        if automatic { return Ok(CollectResult { item: e.item, saved: false, exp: 0., held: false }); }
        if hold.is_some() { return Err("Resolve the held item first: equip it or confirm its disposal.".into()); }
        data.set_review_hold(Some(ReviewHold { item: e.item.clone(), disposal: false }));
    } else {
        data.items.push(e.item.clone());
        data.lamp.pending.push(id.into());
    }
    let mut next = emissions;
    next[index.unwrap()].collected = true;
    data.set_emissions(next);
    let held = data.review_hold().is_some_and(|h| h.item.instance_id == id);
    Ok(CollectResult { item: e.item, saved: true, exp: 0., held })
}
/// `equipConveyorItem(data, heroId, id, hero)`.
pub fn equip_conveyor_item(data: &mut LampEconomy, hero_id: &str, id: &str, hero: Option<&LampHero>) -> Result<LampItem, String> {
    let hold = data.review_hold();
    let item = data.item(id).cloned().or_else(|| hold.as_ref().map(|h| h.item.clone()));
    let valid = hero.is_some_and(|h| h.instance_key == hero_id) && item.as_ref().is_some_and(|i| lamp_item_cp_gain(data, i, hero.unwrap()) > 0.);
    if !valid { return Err("This equipment does not increase this hero CP.".into()); }
    if hold.as_ref().is_some_and(|h| h.item.instance_id == id) { let h = hold.unwrap(); data.items.push(h.item); data.lamp.pending.push(id.into()); data.set_review_hold(None); }
    equip_lamp_item(data, hero_id, id, hero)
}
#[derive(Clone, Debug, PartialEq)]
pub struct DisposalPreview { pub ids: Vec<String>, pub signature: String, pub legacy: String, pub essence: f64 }
/// `conveyorDisposalPreview(data, heroes, ids)`.
pub fn conveyor_disposal_preview(data: &LampEconomy, heroes: &[LampHero], ids: Option<&[String]>) -> Result<DisposalPreview, String> {
    if heroes.is_empty() { return Err("Current heroes are required before dismantling.".into()); }
    let candidates = conveyor_review_candidates(data, heroes);
    let selected: Vec<String> = match ids { Some(ids) => ids.to_vec(), None => candidates.iter().filter(|c| c.best_gain <= 0.).map(|c| c.item.instance_id.clone()).collect() };
    if candidates.iter().any(|c| selected.contains(&c.item.instance_id) && c.best_gain > 0.) { return Err("Equipment still improves a hero. Equip upgrades before dismantling.".into()); }
    let pieces: Vec<Option<&LampItem>> = selected.iter().map(|id| candidates.iter().find(|c| c.item.instance_id == *id).map(|c| &c.item)).collect();
    let mut unique = selected.clone();
    unique.sort();
    unique.dedup();
    if unique.len() != selected.len() || pieces.iter().any(|p| p.is_none()) { return Err("Disposal changed. Review the updated equipment.".into()); }
    let pieces: Vec<&LampItem> = pieces.into_iter().flatten().collect();
    Ok(DisposalPreview { signature: js_json(&serde_json::to_value(&pieces).unwrap()), legacy: format!("salvage:{}:{}", data.lamp.salvage.count, data.lamp.salvage.gold), essence: pieces.iter().map(|i| salvage_value(&i.rarity)).sum::<f64>() + data.lamp.salvage.gold, ids: selected })
}
/// `queueConveyorDisposal(data, id, heroes)`.
pub fn queue_conveyor_disposal(data: &mut LampEconomy, id: &str, heroes: &[LampHero]) -> Result<(), String> {
    conveyor_disposal_preview(data, heroes, Some(&[id.to_string()]))?;
    let hold = data.review_hold();
    if !data.lamp.pending.iter().any(|p| p == id) && !data.discarded().iter().any(|p| p == id) && hold.as_ref().map(|h| h.item.instance_id.as_str()) != Some(id) { return Err("Equipment is no longer available.".into()); }
    let mut requested = data.disposal_requested();
    if !requested.iter().any(|r| r == id) { requested.push(id.into()); }
    data.set_disposal_requested(requested);
    if let Some(mut h) = hold { if h.item.instance_id == id { h.disposal = true; data.set_review_hold(Some(h)); } }
    Ok(())
}
#[derive(Clone, Debug, PartialEq)]
pub struct DismantleResult { pub count: f64, pub essence: f64 }
/// `dismantleConveyorItems(data, preview, heroes)`.
pub fn dismantle_conveyor_items(data: &mut LampEconomy, preview: &DisposalPreview, heroes: &[LampHero]) -> Result<DismantleResult, String> {
    let fresh = conveyor_disposal_preview(data, heroes, Some(&preview.ids))?;
    if fresh.signature != preview.signature || fresh.legacy != preview.legacy { return Err("Disposal changed. Review the updated equipment.".into()); }
    let mut ids = preview.ids.clone();
    ids.sort();
    ids.dedup();
    let count = ids.len() as f64 + data.lamp.salvage.count;
    if count == 0. { return Err("No equipment selected for dismantling.".into()); }
    data.items.retain(|i| !ids.contains(&i.instance_id));
    data.lamp.pending.retain(|id| !ids.contains(id));
    data.lamp.discarded = Some(data.discarded().iter().filter(|id| !ids.contains(id)).cloned().collect());
    if data.review_hold().is_some_and(|h| ids.contains(&h.item.instance_id)) { data.set_review_hold(None); }
    let remaining: Vec<String> = data.disposal_requested().into_iter().filter(|id| !ids.contains(id)).collect();
    data.set_disposal_requested(remaining);
    data.lamp.salvage = Salvage::default();
    data.lamp.essence += fresh.essence;
    Ok(DismantleResult { count, essence: fresh.essence })
}
#[derive(Clone, Debug, PartialEq)]
pub struct AutoEquipChange { pub hero_id: String, pub item: LampItem }
/// `planConveyorAutoEquip(data, heroes)`: a working copy with every positive assignment applied.
pub fn plan_conveyor_auto_equip(data: &LampEconomy, heroes: &[LampHero]) -> (LampEconomy, Vec<AutoEquipChange>) {
    let mut working = data.clone();
    let mut changes = Vec::new();
    loop {
        let Some(candidate) = conveyor_review_candidates(&working, heroes).into_iter().find(|c| c.best_gain > 0.) else { break };
        let hero_id = candidate.best_hero_id.clone().unwrap();
        let hero = heroes.iter().find(|h| h.instance_key == hero_id);
        if equip_conveyor_item(&mut working, &hero_id, &candidate.item.instance_id, hero).is_err() { break; }
        classify_conveyor_cache(&mut working, heroes);
        changes.push(AutoEquipChange { hero_id, item: candidate.item });
    }
    (working, changes)
}

// ---- battlefield orbs (ORKA-63bf.20): a defeated enemy drops one equipment item as an orb ----
fn orb_list(data: &mut LampEconomy) -> &mut Vec<Value> {
    let list = data.lamp.orbs.get_or_insert_with(|| Value::Array(Vec::new()));
    if !list.is_array() { *list = Value::Array(Vec::new()); }
    list.as_array_mut().unwrap()
}
/// Uncollected conveyor emissions from an older save become orbs; the conveyor is retired.
pub fn adopt_conveyor_emissions(data: &mut LampEconomy) {
    let emissions = data.emissions();
    if emissions.is_empty() { return; }
    let mut orbs = data.orbs();
    for e in emissions {
        let id = &e.item.instance_id;
        if e.collected || orbs.len() >= ORB_LIMIT || data.item(id).is_some() || orbs.iter().any(|o| &o.instance_id == id) || data.review_hold().is_some_and(|h| &h.item.instance_id == id) { continue; }
        orbs.push(e.item);
    }
    orbs.sort_by(|a, b| a.sequence.partial_cmp(&b.sequence).unwrap_or(std::cmp::Ordering::Equal));
    data.set_orbs(orbs);
    data.set_emissions(Vec::new());
}
/// Makes room on a full field: removes the oldest orb of the lowest rarity until `keep` remain.
fn evict_orbs(orbs: &mut Vec<Value>, keep: usize) {
    let rank = |v: &Value| v.get("rarity").and_then(Value::as_str).and_then(rarity_index).unwrap_or(0);
    while orbs.len() > keep {
        let lowest = orbs.iter().map(rank).min().unwrap_or(0);
        let at = orbs.iter().position(|v| rank(v) == lowest).unwrap_or(0);
        orbs.remove(at);
    }
}
/// A save from before the field limit can hold thousands of orbs: keep `ORB_LIMIT` of them (the
/// same rule as a drop on a full field) before the save is validated.
pub fn trim_saved_orbs(save: &mut Value) {
    if let Some(orbs) = save.get_mut("lamp").and_then(|l| l.get_mut("orbs")).and_then(Value::as_array_mut) { evict_orbs(orbs, ORB_LIMIT); }
}
/// One drop: the next item of the lamp sequence, rolled with the current Bag level's rarity
/// weights and the highest stage reached (the same roll the conveyor made). On a full field the
/// oldest orb of the lowest rarity gives way to it.
pub fn drop_orb_item(data: &mut LampEconomy, region: f64, stage: f64) -> LampItem {
    data.lamp.highest_ordinal = data.lamp.highest_ordinal.max(progression_ordinal(region, stage) as f64);
    let tier = capacity_tier(data.lamp.capacity_tier);
    let item = generate_lamp_item(data.lamp.seed, data.lamp.sequence as u32, data.lamp.highest_ordinal as u32, &tier.rarity_weights);
    data.lamp.sequence += 1.;
    let orbs = orb_list(data);
    evict_orbs(orbs, ORB_LIMIT - 1);
    orbs.push(serde_json::to_value(&item).unwrap());
    item
}
/// What became of the orbs a pickup named: `stored` entered the Bag, `dismantled` paid `essence`.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct OrbPickup { pub stored: Vec<LampItem>, pub dismantled: Vec<LampItem>, pub essence: f64 }
/// Picks up the named orbs in drop order and judges each one on the spot (owner 2026-11-05,
/// ORKA-63bf.34): an item that would raise some hero's CP over what that hero wears now enters
/// the Bag, never beyond the free slots; any other item is dismantled at once for its salvage
/// Essence and needs no slot. Each orb is settled exactly once; an upgrade that does not fit,
/// and every unnamed orb, stays on the battlefield. Without a hero roster nothing can be judged
/// and every named orb is stored as before.
pub fn collect_orb_items(data: &mut LampEconomy, ids: &[String], heroes: &[LampHero]) -> OrbPickup {
    let mut free = data.free_slots();
    let mut pickup = OrbPickup::default();
    let mut kept = Vec::new();
    for value in std::mem::take(orb_list(data)) {
        let named = value.get("instanceId").and_then(Value::as_str).is_some_and(|id| ids.iter().any(|w| w == id));
        let Some(item) = named.then(|| serde_json::from_value::<LampItem>(value.clone()).ok()).flatten() else { kept.push(value); continue };
        if heroes.is_empty() || select_auto_equip_hero(data, &item, heroes).is_some() {
            if free == 0 { kept.push(value); continue; }
            free -= 1;
            pickup.stored.push(item);
        } else {
            pickup.essence += salvage_value(&item.rarity);
            pickup.dismantled.push(item);
        }
    }
    *orb_list(data) = kept;
    for item in &pickup.stored {
        if data.item(&item.instance_id).is_some() { continue; }
        data.items.push(item.clone());
        data.lamp.pending.push(item.instance_id.clone());
    }
    data.lamp.essence += pickup.essence;
    pickup
}
