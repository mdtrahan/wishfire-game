//! `web-runner/src/core/combatProgressionRules.mjs` + `questMilestones.mjs`: the COT quest
//! objective, Incense/ticket wallet, party training and the `orka.combat_progression.v1` save.
use crate::equipment::{rarity_index, RARITIES};
use crate::hero;
use crate::jsnum::number;
use crate::lamp::LampEconomy;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

pub const VERSION: u32 = 1;
pub const SAVE_KEY: &str = "orka.combat_progression.v1";
pub const TRAINING_STATS: [&str; 4] = ["ATK", "DEF", "MATK", "RES"];
pub const TRAINING_COST_BASE: f64 = 20.;
pub const TRAINING_COST_STEP: f64 = 10.;
pub const TRAINING_BONUS_PER_LEVEL: f64 = 0.02;
pub const HERO_TICKET_REWARD: f64 = 5.;
pub const HERO_TICKET_LEVEL_COST_BASE: f64 = 100.;
pub const HERO_TICKET_LEVEL_COST_STEP: f64 = 50.;
pub const MILESTONE_TYPES: [&str; 9] = ["equip_slot", "equip_all", "equip_level", "equip_rarity", "chapter_clear", "boss_defeat", "hero_level", "party_level", "training_level"];
const ACTION_TYPES: [&str; 5] = ["enemy_defeat", "wave_clear", "gear_collect", "training_upgrade", "hero_upgrade"];
const SLOTS: [&str; 3] = ["hat", "body", "boots"];
pub fn is_milestone(kind: &str) -> bool { MILESTONE_TYPES.contains(&kind) }
pub fn objective_types() -> Vec<&'static str> { ACTION_TYPES.iter().chain(MILESTONE_TYPES.iter()).copied().collect() }
/// `COMBAT_REWARD_BUNDLES[type]`.
pub fn reward_bundle(kind: &str) -> Option<(&'static str, f64)> {
    match kind { "enemy_defeat" | "wave_clear" => Some(("incense", 5.)), "gear_collect" => Some(("essence", 2.)), "training_upgrade" | "hero_upgrade" => Some(("hero_ticket", HERO_TICKET_REWARD)), k if is_milestone(k) => Some(("incense", 5.)), _ => None }
}
pub fn clamp_count(v: Option<&Value>) -> f64 { let n = number(v); if crate::jsnum::is_safe_integer(v) && n > 0. { n.min(1e9) } else { 0. } }
pub fn safe_id(v: Option<&Value>) -> String { match v.and_then(Value::as_str) { Some(s) if s.len() <= 180 && !["__proto__", "constructor", "prototype"].contains(&s) => s.to_string(), _ => String::new() } }
/// `String(value || '').slice(0, n)`.
fn slice_n(v: Option<&Value>, n: usize) -> String { let s = match v { Some(Value::String(s)) => s.clone(), Some(Value::Number(x)) => { let f = x.as_f64().unwrap_or(0.); if f == 0. { String::new() } else { format!("{f}") } }, Some(Value::Bool(true)) => "true".into(), Some(Value::Array(_)) | Some(Value::Object(_)) => v.unwrap().to_string(), _ => String::new() }; s.chars().take(n).collect() }
fn slice32(v: Option<&Value>) -> String { slice_n(v, 32) }
fn positive(v: f64) -> f64 { if v.is_nan() { 0. } else { v.floor().max(0.) } }

/// A party member as the quest rules see it (`state.entities` heroes or saved records).
#[derive(Clone, Debug, PartialEq)]
pub struct QuestHero { pub instance_key: String, pub base_hero_name: String, pub current_level: u32, pub max_level: u32, pub hp: f64 }
impl QuestHero { pub fn display_name(&self) -> String { hero::hero_definition(&self.base_hero_name).map_or(self.base_hero_name.clone(), |d| d.name.to_string()) } }
#[derive(Clone, Copy, Debug, PartialEq, Default)]
pub struct Context<'a> { pub equipment: Option<&'a LampEconomy>, pub chapter: Option<f64> }

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Objective {
    pub id: String,
    #[serde(rename = "type")] pub kind: String,
    pub target: u32,
    pub progress: u32,
    pub seed: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub chapter: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub threshold: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub slot: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub rarity: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub stat: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub hero_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub hero_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub reward_hero_name: Option<String>,
}
impl Objective {
    pub fn ready(&self) -> bool { self.progress >= self.target }
    fn threshold_u(&self) -> f64 { self.threshold.unwrap_or(0.) }
    fn chapter_u(&self) -> f64 { self.chapter.unwrap_or(0.) }
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Wallet { pub incense: f64, pub tickets_by_hero: Map<String, Value> }
impl Wallet { pub fn tickets(&self, id: &str) -> f64 { self.tickets_by_hero.get(id).and_then(Value::as_f64).unwrap_or(0.) } }
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize, Default)]
pub struct Training { #[serde(rename = "ATK")] pub atk: u32, #[serde(rename = "DEF")] pub def: u32, #[serde(rename = "MATK")] pub matk: u32, #[serde(rename = "RES")] pub res: u32 }
impl Training {
    pub fn get(&self, stat: &str) -> u32 { match stat { "ATK" => self.atk, "DEF" => self.def, "MATK" => self.matk, "RES" => self.res, _ => 0 } }
    pub fn set(&mut self, stat: &str, level: u32) { match stat { "ATK" => self.atk = level, "DEF" => self.def = level, "MATK" => self.matk = level, "RES" => self.res = level, _ => {} } }
    pub fn to_hero_training(self) -> hero::Training { hero::Training { atk: self.atk, def: self.def, matk: self.matk, res: self.res } }
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TicketSpend { pub id: String, pub hero_id: String, pub cost: f64, pub from_level: f64 }
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Receipt { pub id: String, pub resource: String, pub amount: f64, #[serde(default, skip_serializing_if = "Option::is_none")] pub hero_id: Option<String>, #[serde(default, skip_serializing_if = "Option::is_none")] pub hero_name: Option<String> }
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LastReward { pub label: String, pub icon: String, pub count: f64, pub shown_at: f64, pub receipt_id: String, #[serde(default, skip_serializing_if = "Option::is_none")] pub hero_id: Option<String>, #[serde(default, skip_serializing_if = "Option::is_none")] pub hero_name: Option<String> }
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Default)]
pub struct Growth { pub stars: Map<String, Value> }
impl Growth { pub fn stars_of(&self, id: &str) -> u32 { hero::canonical_growth_id(id).and_then(|c| self.stars.get(c)).and_then(Value::as_f64).map_or(0, |v| v.max(0.).min(hero::STAR_MAX as f64).floor() as u32) } }
/// `orka.combat_progression.v1` as `createCombatProgressionState` writes it.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressionState {
    pub version: u32,
    pub seed: u32,
    pub cursor: u64,
    pub objective: Option<Objective>,
    pub last_family: String,
    pub claimed_milestones: Vec<String>,
    pub chapters_cleared: f64,
    pub wallet: Wallet,
    pub training: Training,
    pub processed_events: Vec<String>,
    pub pending_ticket_spends: Map<String, Value>,
    pub reward_receipts: Vec<Receipt>,
    pub last_reward: Option<LastReward>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub growth: Option<Growth>,
}
impl ProgressionState {
    pub fn to_value(&self) -> Value { serde_json::to_value(self).unwrap() }
    pub fn pending_spends(&self) -> Vec<TicketSpend> { self.pending_ticket_spends.values().filter_map(|v| serde_json::from_value(v.clone()).ok()).collect() }
    pub fn hero_stars(&self, id: &str) -> u32 { self.growth.as_ref().map_or(0, |g| g.stars_of(id)) }
}
/// `sanitizeHeroGrowth(raw)`.
pub fn sanitize_growth(raw: Option<&Value>) -> Option<Growth> {
    let raw = raw?.as_object()?;
    let stars = raw.get("stars").and_then(Value::as_object)?;
    let mut out = Map::new();
    for (id, count) in stars {
        let n = number(Some(count));
        let clamped = if n.is_finite() { n.floor().max(0.).min(hero::STAR_MAX as f64) } else { 0. };
        let safe = hero::HERO_DEFINITIONS.iter().find(|d| d.key == id).map(|d| d.key);
        if let Some(id) = safe { if clamped > 0. { out.insert(id.into(), json!(clamped)); } }
    }
    if out.is_empty() { None } else { Some(Growth { stars: out }) }
}
/// `createCombatProgressionState(snapshot, seed)`: normalizes any saved shape.
pub fn create_state(snapshot: Option<&Value>, seed: u32) -> ProgressionState {
    let raw = snapshot.and_then(Value::as_object).cloned().unwrap_or_default();
    let types = objective_types();
    let objective = raw.get("objective").and_then(Value::as_object).filter(|o| o.get("type").and_then(Value::as_str).is_some_and(|t| types.contains(&t))).map(|o| {
        let kind = o["type"].as_str().unwrap().to_string();
        let target = number(o.get("target"));
        let target = (if target.is_nan() || target == 0. { 1. } else { target }).floor().min(40.).max(1.);
        let progress = number(o.get("progress"));
        let progress = (if progress.is_nan() { 0. } else { progress }).floor().min(target).max(0.);
        let milestone = is_milestone(&kind);
        Objective {
            id: safe_id(o.get("id")), kind: kind.clone(), target: target as u32, progress: progress as u32, seed: crate::jsnum::to_uint32(number(o.get("seed"))),
            key: milestone.then(|| safe_id(o.get("key"))),
            chapter: milestone.then(|| clamp_count(o.get("chapter"))),
            threshold: milestone.then(|| clamp_count(o.get("threshold"))),
            slot: milestone.then(|| o.get("slot").and_then(Value::as_str).filter(|s| SLOTS.contains(s)).unwrap_or("").to_string()),
            rarity: milestone.then(|| o.get("rarity").and_then(Value::as_str).filter(|r| rarity_index(r).is_some()).unwrap_or("").to_string()),
            stat: milestone.then(|| o.get("stat").and_then(Value::as_str).filter(|s| TRAINING_STATS.contains(s)).unwrap_or("").to_string()),
            hero_id: o.get("heroId").filter(|v| truthy(v)).map(|_| safe_id(o.get("heroId"))),
            hero_name: (["hero_upgrade", "hero_level"].contains(&kind.as_str()) && o.get("heroName").is_some_and(truthy)).then(|| slice32(o.get("heroName"))),
            reward_hero_name: (kind == "training_upgrade" && o.get("rewardHeroName").is_some_and(truthy)).then(|| slice32(o.get("rewardHeroName"))),
        }
    }).filter(valid_milestone_objective);
    let growth = sanitize_growth(raw.get("growth"));
    let tickets: Map<String, Value> = raw.get("wallet").and_then(|w| w.get("ticketsByHero")).and_then(Value::as_object).map(|m| m.iter().map(|(id, amount)| (safe_id(Some(&Value::String(id.clone()))), json!(clamp_count(Some(amount))))).filter(|(id, _)| !id.is_empty()).collect()).unwrap_or_default();
    let mut training = Training::default();
    for stat in TRAINING_STATS { let v = number(raw.get("training").and_then(|t| t.get(stat))); training.set(stat, (if v.is_nan() { 0. } else { v }).floor().max(0.).min(100.) as u32); }
    let processed: Vec<String> = raw.get("processedEvents").and_then(Value::as_array).map(|a| { let mut seen: Vec<String> = Vec::new(); for v in a { let id = safe_id(Some(v)); if !id.is_empty() && !seen.contains(&id) { seen.push(id); } } seen[seen.len().saturating_sub(512)..].to_vec() }).unwrap_or_default();
    let mut spends = Map::new();
    if let Some(obj) = raw.get("pendingTicketSpends").and_then(Value::as_object) {
        for (id, row) in obj {
            let sid = safe_id(Some(&Value::String(id.clone())));
            if sid.is_empty() || !row.is_object() { continue; }
            let hero_id = safe_id(row.get("heroId"));
            let cost = clamp_count(row.get("cost"));
            if hero_id.is_empty() || cost <= 0. { continue; }
            let from = number(row.get("fromLevel"));
            let from = (if from.is_nan() || from == 0. { 1. } else { from }).floor().max(1.);
            spends.insert(id.clone(), json!({ "id": id, "heroId": hero_id, "cost": cost, "fromLevel": from }));
        }
    }
    let receipts: Vec<Receipt> = raw.get("rewardReceipts").and_then(Value::as_array).map(|a| {
        let rows: Vec<&Value> = a.iter().filter(|r| r.is_object() && !safe_id(r.get("id")).is_empty()).collect();
        rows[rows.len().saturating_sub(256)..].iter().map(|row| {
            let res = row.get("resource").and_then(Value::as_str);
            let resource = if matches!(res, Some("essence") | Some("hero_ticket")) { res.unwrap().to_string() } else if res.is_none_or(|r| r.is_empty()) && clamp_count(row.get("essence")) > 0. { "essence".into() } else { "incense".into() };
            let amount = if row.get("amount").is_some_and(|v| !v.is_null()) { clamp_count(row.get("amount")) } else if resource == "essence" { clamp_count(row.get("essence")) } else { clamp_count(row.get("incense")) };
            Receipt { id: safe_id(row.get("id")), hero_id: (resource == "hero_ticket").then(|| safe_id(row.get("heroId"))), hero_name: (resource == "hero_ticket").then(|| slice32(row.get("heroName"))), resource, amount }
        }).collect()
    }).unwrap_or_default();
    let last_reward = raw.get("lastReward").and_then(Value::as_object).map(|lr| LastReward {
        label: slice_n(lr.get("label"), 48), icon: lr.get("icon").and_then(Value::as_str).filter(|i| ["essence", "hero_ticket"].contains(i)).unwrap_or("incense").into(),
        count: clamp_count(lr.get("count")), shown_at: { let n = number(lr.get("shownAt")); if n.is_nan() { 0. } else { n.max(0.) } }, receipt_id: safe_id(lr.get("receiptId")),
        hero_id: lr.get("heroId").filter(|v| truthy(v)).map(|_| safe_id(lr.get("heroId"))), hero_name: lr.get("heroId").filter(|v| truthy(v)).map(|_| slice32(lr.get("heroName"))),
    });
    ProgressionState {
        version: VERSION,
        seed: if crate::jsnum::is_safe_integer(raw.get("seed")) { crate::jsnum::to_uint32(number(raw.get("seed"))) } else { seed },
        cursor: { let c = number(raw.get("cursor")); (if c.is_nan() { 0. } else { c }).floor().max(0.) as u64 },
        objective,
        last_family: raw.get("lastFamily").and_then(Value::as_str).filter(|f| ["equipment", "battle", "training", "heroes"].contains(f)).unwrap_or("").into(),
        claimed_milestones: raw.get("claimedMilestones").and_then(Value::as_array).map(|a| { let mut seen: Vec<String> = Vec::new(); for v in a { let id = safe_id(Some(v)); if !id.is_empty() && !seen.contains(&id) { seen.push(id); } } seen }).unwrap_or_default(),
        chapters_cleared: clamp_count(raw.get("chaptersCleared")),
        wallet: Wallet { incense: clamp_count(raw.get("wallet").and_then(|w| w.get("incense"))), tickets_by_hero: tickets },
        training, processed_events: processed, pending_ticket_spends: spends, reward_receipts: receipts, last_reward, growth,
    }
}
fn truthy(v: &Value) -> bool { match v { Value::Null => false, Value::Bool(b) => *b, Value::Number(n) => n.as_f64().is_some_and(|f| f != 0. && !f.is_nan()), Value::String(s) => !s.is_empty(), _ => true } }
fn next_random(state: &mut ProgressionState) -> u32 {
    let mut seed = if state.seed == 0 { 0x9e3779b9u32 } else { state.seed };
    seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5;
    state.seed = seed;
    seed
}
/// `combatObjectiveActionTarget(type, chapter, roll)`.
pub fn action_target(kind: &str, chapter: f64, roll: u32) -> u32 {
    if !["enemy_defeat", "gear_collect", "wave_clear"].contains(&kind) { return 1; }
    let bands = [(1u32, 3u32), (5, 10), (10, 20), (20, 30), (30, 40)];
    let c = if chapter.is_nan() || chapter == 0. { 1. } else { chapter };
    let (lo, hi) = bands[(c.floor() - 1.).max(0.).min(4.) as usize];
    lo + roll % (hi - lo + 1)
}
fn opening_objective(cursor: u64, seed: u32, chapter: f64) -> Objective {
    let kind = if cursor == 0 { "gear_collect" } else { "enemy_defeat" };
    let target = if chapter <= 1. { if cursor == 0 { 1 } else { 3 } } else { action_target(kind, chapter, seed) };
    Objective { id: format!("cot-opening-{cursor}-{seed:x}"), kind: kind.into(), target, progress: 0, seed, key: None, chapter: None, threshold: None, slot: None, rarity: None, stat: None, hero_id: None, hero_name: None, reward_hero_name: None }
}
#[derive(Clone, Debug, PartialEq)]
pub struct TicketHero { pub id: String, pub name: String }
/// `eligibleTicketHeroes(heroes)`: below max level, sorted by id.
pub fn eligible_ticket_heroes(heroes: &[QuestHero]) -> Vec<TicketHero> {
    let mut out: Vec<TicketHero> = heroes.iter().filter(|h| h.current_level < h.max_level).map(|h| TicketHero { id: safe_id(Some(&Value::String(h.instance_key.clone()))), name: h.base_hero_name.chars().take(32).collect() }).filter(|h| !h.id.is_empty() && !h.name.is_empty()).collect();
    out.sort_by(|a, b| a.id.cmp(&b.id));
    out
}
pub fn eligible_hero_upgrade_targets(state: &ProgressionState, heroes: &[QuestHero]) -> Vec<TicketHero> {
    eligible_ticket_heroes(heroes).into_iter().filter(|h| state.wallet.tickets(&h.id) >= hero_ticket_level_cost(heroes.iter().find(|c| c.instance_key == h.id).map_or(1., |c| c.current_level as f64))).collect()
}
pub fn hero_ticket_level_cost(level: f64) -> f64 { HERO_TICKET_LEVEL_COST_BASE + (level - 1.).max(0.) * HERO_TICKET_LEVEL_COST_STEP }
pub fn training_cost(state: &ProgressionState, stat: &str) -> f64 { if !TRAINING_STATS.contains(&stat) { return 0.; } TRAINING_COST_BASE + state.training.get(stat) as f64 * TRAINING_COST_STEP }
pub fn quest_family(kind: &str) -> &'static str {
    if kind.starts_with("equip_") || kind == "gear_collect" { "equipment" } else if ["chapter_clear", "boss_defeat", "wave_clear", "enemy_defeat"].contains(&kind) { "battle" } else if ["training_upgrade", "training_level"].contains(&kind) { "training" } else { "heroes" }
}
fn milestone_key(kind: &str, slot: &str, rarity: &str, stat: &str, hero_id: &str, threshold: f64, chapter: f64) -> String {
    let middle = if !slot.is_empty() { slot } else if !rarity.is_empty() { rarity } else if !stat.is_empty() { stat } else { hero_id };
    let tail = if threshold > 0. { format!("{threshold}") } else if chapter > 0. { format!("{chapter}") } else { String::new() };
    format!("{kind}:{middle}:{tail}")
}
/// `equipped(heroes, equipment)`: each hero's slot items through the primary-loadout fallback.
fn equipped<'a>(heroes: &[QuestHero], equipment: &'a LampEconomy) -> Vec<[Option<&'a crate::lamp::LampItem>; 3]> {
    heroes.iter().map(|h| {
        let canonical = h.base_hero_name.as_str();
        let primary = h.instance_key == canonical || h.instance_key == format!("{}#1", canonical.to_lowercase());
        let loadout = equipment.loadouts.get(&h.instance_key).or_else(|| if primary { equipment.loadouts.get(canonical) } else { None });
        let item = |slot: &str| loadout.and_then(|l| l.get(slot)).and_then(|id| equipment.item(id));
        [item("hat"), item("body"), item("boots")]
    }).collect()
}
/// `reconcileQuestMilestones(state, heroes, context)`.
pub fn reconcile_milestones(state: &mut ProgressionState, heroes: &[QuestHero], context: Context) {
    let Some(objective) = state.objective.as_mut() else { return };
    if !is_milestone(&objective.kind) { return; }
    if objective.kind.starts_with("equip_") && context.equipment.is_none() { return; }
    let party = context.equipment.map(|e| equipped(heroes, e)).unwrap_or_default();
    let slot_index = |s: &str| SLOTS.iter().position(|x| *x == s).unwrap_or(0);
    let progress = match objective.kind.as_str() {
        "equip_slot" => party.iter().filter(|g| g[slot_index(objective.slot.as_deref().unwrap_or(""))].is_some()).count() as f64,
        "equip_all" => party.iter().filter(|g| g.iter().all(|s| s.is_some())).count() as f64,
        "equip_level" => party.iter().filter(|g| g.iter().all(|s| s.map_or(false, |i| positive(i.level) >= objective.threshold_u()))).count() as f64,
        "equip_rarity" => party.iter().filter(|g| g.iter().all(|s| s.is_some_and(|i| rarity_index(&i.rarity).map_or(-1, |x| x as i64) >= rarity_index(objective.rarity.as_deref().unwrap_or("")).map_or(-1, |x| x as i64)))).count() as f64,
        "hero_level" => if heroes.iter().any(|h| Some(h.instance_key.as_str()) == objective.hero_id.as_deref() && positive(h.current_level as f64) >= objective.threshold_u()) { 1. } else { 0. },
        "party_level" => heroes.iter().filter(|h| positive(h.current_level as f64) >= objective.threshold_u()).count() as f64,
        "training_level" => if positive(state.training.get(objective.stat.as_deref().unwrap_or("")) as f64) >= objective.threshold_u() { 1. } else { 0. },
        "chapter_clear" | "boss_defeat" => if positive(state.chapters_cleared) >= objective.chapter_u() { 1. } else { 0. },
        _ => 0.,
    };
    objective.progress = progress.min(objective.target as f64) as u32;
}
/// `milestoneCandidates(state, heroes, context)`: rows with their keys, unclaimed only.
pub fn milestone_candidates(state: &ProgressionState, heroes: &[QuestHero], context: Context) -> Vec<Objective> {
    let mut rows: Vec<Objective> = Vec::new();
    let mut add = |kind: &str, slot: &str, rarity: &str, stat: &str, hero_id: &str, hero_name: Option<String>, threshold: f64, chapter: f64, target: u32| {
        let key = milestone_key(kind, slot, rarity, stat, hero_id, threshold, chapter);
        if state.claimed_milestones.contains(&key) { return; }
        rows.push(Objective { id: String::new(), kind: kind.into(), target, progress: 0, seed: 0, key: Some(key), chapter: (chapter > 0.).then_some(chapter), threshold: (threshold > 0.).then_some(threshold), slot: (!slot.is_empty()).then(|| slot.into()), rarity: (!rarity.is_empty()).then(|| rarity.into()), stat: (!stat.is_empty()).then(|| stat.into()), hero_id: (!hero_id.is_empty()).then(|| hero_id.into()), hero_name, reward_hero_name: None });
    };
    if let (true, Some(equipment)) = (!heroes.is_empty(), context.equipment) {
        for slot in SLOTS { add("equip_slot", slot, "", "", "", None, 0., 0., heroes.len() as u32); }
        add("equip_all", "", "", "", "", None, 0., 0., heroes.len() as u32);
        let party = equipped(heroes, equipment);
        let min_level = party.iter().flat_map(|g| g.iter().map(|s| s.map_or(0., |i| positive(i.level)))).fold(f64::INFINITY, f64::min);
        let next_level = (((min_level / 5.).floor() + 1.) * 5.).max(5.);
        let available_level = equipment.items.iter().map(|i| positive(i.level)).fold((positive(equipment.lamp.highest_ordinal) + 1.).max(1.), f64::max);
        let mut threshold = 5.;
        while threshold <= next_level.min(available_level) { add("equip_level", "", "", "", "", None, threshold, 0., heroes.len() as u32); threshold += 5.; }
        let available_rarity = equipment.items.iter().map(|i| rarity_index(&i.rarity).map_or(0, |x| x as i64)).fold(0, i64::max);
        let rare = rarity_index("rare").unwrap() as i64;
        for index in 1..=available_rarity.min(rare) { add("equip_rarity", "", RARITIES[index as usize].key, "", "", None, 0., 0., heroes.len() as u32); }
    }
    let chapter = positive(context.chapter.unwrap_or(0.)).max(1.);
    for kind in ["chapter_clear", "boss_defeat"] {
        let claimed = state.claimed_milestones.iter().filter(|k| k.starts_with(&format!("{kind}:"))).map(|k| positive(k.rsplit(':').next().and_then(|s| s.parse::<f64>().ok()).unwrap_or(f64::NAN))).fold(0., f64::max);
        add(kind, "", "", "", "", None, 0., chapter.min(claimed + 1.), 1);
    }
    for stat in TRAINING_STATS {
        let level = positive(state.training.get(stat) as f64);
        let threshold = if state.wallet.incense >= 20. + level * 10. && level < 100. { level + 1. } else { level };
        if threshold > 0. { add("training_level", "", "", stat, "", None, threshold, 0., 1); }
    }
    for h in heroes {
        let level = positive(h.current_level as f64);
        let next_level = if level < 5. { level + 1. } else { ((level / 5.).floor() + 1.) * 5. }.min(if h.max_level > 0 { h.max_level as f64 } else { 100. });
        let mut cost = 0.;
        let mut n = level;
        while n < next_level { cost += 100. + (n - 1.) * 50.; n += 1.; }
        let tickets = state.wallet.tickets(&h.instance_key);
        let threshold = if tickets >= cost { next_level } else { level.max(2.) };
        if level >= 2. || tickets >= cost { add("hero_level", "", "", "", &h.instance_key, Some(h.display_name()), threshold, 0., 1); }
    }
    if !heroes.is_empty() && heroes.iter().all(|h| positive(h.current_level as f64) >= 2.) { add("party_level", "", "", "", "", None, heroes.iter().map(|h| positive(h.current_level as f64)).fold(f64::INFINITY, f64::min), 0., heroes.len() as u32); }
    rows
}
/// `milestonePresentation(objective)` → (category, challenge).
pub fn milestone_presentation(o: &Objective) -> Option<(&'static str, String)> {
    let slot_names = |s: &str| match s { "hat" => "a Hat", "body" => "Body Armor", "boots" => "Boots", _ => "undefined" };
    fn rarity_colors(r: &str) -> &str { match r { "common" => "White", "uncommon" => "Green", "rare" => "Blue", "epic" => "Purple", "legendary" => "Gold", other => other } }
    let label = match o.kind.as_str() {
        "equip_slot" => format!("Equip {} to all heroes", slot_names(o.slot.as_deref().unwrap_or(""))),
        "equip_all" => "Fully equip all heroes".into(),
        "equip_level" => format!("Equip Lv. {}+ in all heroes\u{2019} slots", o.threshold_u()),
        "equip_rarity" => format!("Equip {}+ in all heroes\u{2019} slots", rarity_colors(o.rarity.as_deref().unwrap_or(""))),
        "chapter_clear" => format!("Clear Chapter {}", o.chapter_u()),
        "boss_defeat" => format!("Defeat Chapter {} boss", o.chapter_u()),
        "hero_level" => format!("Reach Level {} with {}", o.threshold_u(), o.hero_name.as_deref().unwrap_or("undefined")),
        "party_level" => format!("Reach Level {} with all heroes", o.threshold_u()),
        "training_level" => format!("Train {} to Level {}", o.stat.as_deref().unwrap_or("undefined"), o.threshold_u()),
        _ => return None,
    };
    Some((if quest_family(&o.kind) == "equipment" { "Equipment" } else { "Milestone" }, label))
}
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Presentation { pub category: String, pub challenge: String, pub count: String }
/// `combatObjectivePresentation(objective)`.
pub fn objective_presentation(objective: Option<&Objective>) -> Presentation {
    let Some(o) = objective else { return Presentation { category: "Ready".into(), challenge: "Complete a combat action".into(), count: "0/1".into() } };
    let (category, base) = match o.kind.as_str() { "wave_clear" => ("Advance", "Clear a wave"), "gear_collect" => ("Supplies", "Collect equipment"), "training_upgrade" => ("Training", "Train a party stat"), "hero_upgrade" => ("Level Up", "Level up a hero"), _ => ("Battle", "Defeat enemies") };
    let count = if ["chapter_clear", "boss_defeat"].contains(&o.kind.as_str()) { String::new() } else { format!("{}/{}", o.progress.min(o.target), o.target) };
    if let Some((cat, challenge)) = milestone_presentation(o) { return Presentation { category: cat.into(), challenge, count }; }
    let challenge = if o.kind == "hero_upgrade" && o.hero_name.as_deref().is_some_and(|n| !n.is_empty()) { format!("{base}: {}", o.hero_name.as_deref().unwrap()) } else { base.into() };
    Presentation { category: category.into(), challenge, count }
}
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RewardPreview { pub resource: String, pub amount: f64, #[serde(skip_serializing_if = "Option::is_none")] pub hero_id: Option<String>, #[serde(skip_serializing_if = "Option::is_none")] pub hero_name: Option<String> }
/// `combatObjectiveReward(objective)`.
pub fn objective_reward(objective: Option<&Objective>) -> Option<RewardPreview> {
    let o = objective?;
    let (resource, amount) = reward_bundle(&o.kind)?;
    let ticket = resource == "hero_ticket";
    Some(RewardPreview { resource: resource.into(), amount, hero_id: ticket.then(|| safe_id(o.hero_id.as_ref().map(|s| Value::String(s.clone())).as_ref())), hero_name: ticket.then(|| (if o.kind == "hero_upgrade" { o.hero_name.clone() } else { o.reward_hero_name.clone() }).unwrap_or_default().chars().take(32).collect()) })
}
/// `ensureCombatObjective(state, heroes, context)`.
pub fn ensure_objective(state: &ProgressionState, heroes: &[QuestHero], context: Context) -> ProgressionState {
    let mut next = create_state(Some(&state.to_value()), state.seed);
    if next.objective.as_ref().is_some_and(|o| o.kind == "equip_rarity" && ["epic", "legendary"].contains(&o.rarity.as_deref().unwrap_or(""))) {
        let o = next.objective.clone().unwrap();
        let claimed = next.claimed_milestones.iter().any(|k| Some(k.as_str()) == o.key.as_deref()) || next.reward_receipts.iter().any(|r| r.id == format!("cot-reward:{}", o.id));
        if !claimed && o.progress >= o.target { return next; }
        next.objective = None;
    }
    reconcile_milestones(&mut next, heroes, context);
    let chapter = { let c = context.chapter.unwrap_or(f64::NAN); (if c.is_nan() || c == 0. { 1. } else { c }).max(next.chapters_cleared + 1.) };
    if next.objective.as_ref().is_some_and(|o| o.progress >= o.target) { return next; }
    let can_train = TRAINING_STATS.iter().any(|s| next.training.get(s) < 100 && training_cost(&next, s) <= next.wallet.incense);
    if next.objective.as_ref().is_some_and(|o| o.kind == "training_level" && o.progress < o.target) && next.wallet.incense < training_cost(&next, next.objective.as_ref().unwrap().stat.as_deref().unwrap_or("")) { next.objective = None; }
    if next.objective.as_ref().is_some_and(|o| o.kind == "hero_level" && o.progress < o.target) {
        let o = next.objective.clone().unwrap();
        let hero = heroes.iter().find(|h| Some(h.instance_key.as_str()) == o.hero_id.as_deref());
        let mut cost = 0.;
        let mut level = hero.map_or(1., |h| if h.current_level == 0 { 1. } else { h.current_level as f64 });
        while level < o.threshold_u() { cost += hero_ticket_level_cost(level); level += 1.; }
        if hero.is_none() || o.threshold_u() > hero.unwrap().max_level as f64 || next.wallet.tickets(o.hero_id.as_deref().unwrap_or("")) < cost { next.objective = None; }
    }
    if next.cursor < 2 && next.objective.as_ref().is_some_and(|o| o.kind == "wave_clear") { next.objective = Some(opening_objective(next.cursor, next.seed, chapter)); return next; }
    if next.cursor < 2 && next.objective.is_none() { next.objective = Some(opening_objective(next.cursor, next.seed, chapter)); return next; }
    if next.objective.as_ref().is_some_and(|o| o.kind == "training_upgrade") && !can_train { next.objective = None; }
    if let Some(mut o) = next.objective.clone() {
        if ["training_upgrade", "hero_upgrade"].contains(&o.kind.as_str()) {
            if o.hero_id.as_deref().is_some_and(|h| !h.is_empty()) {
                if o.kind == "training_upgrade" {
                    o.hero_name = None;
                    if o.reward_hero_name.as_deref().is_none_or(|n| n.is_empty()) { o.reward_hero_name = Some(eligible_ticket_heroes(heroes).into_iter().find(|h| Some(h.id.as_str()) == o.hero_id.as_deref()).map_or(String::new(), |h| h.name)); }
                    next.objective = Some(o);
                    return next;
                }
                let pending_spend = next.pending_spends().iter().any(|s| Some(s.hero_id.as_str()) == o.hero_id.as_deref());
                let ready_hero = eligible_hero_upgrade_targets(&next, heroes).into_iter().any(|h| Some(h.id.as_str()) == o.hero_id.as_deref());
                if pending_spend || ready_hero {
                    if o.hero_name.as_deref().is_none_or(|n| n.is_empty()) { o.hero_name = Some(eligible_ticket_heroes(heroes).into_iter().find(|h| Some(h.id.as_str()) == o.hero_id.as_deref()).map_or(String::new(), |h| h.name)); }
                    next.objective = Some(o);
                    return next;
                }
                o.hero_id = None;
                o.hero_name = None;
            }
            let eligible = eligible_ticket_heroes(heroes);
            let ready = eligible_hero_upgrade_targets(&next, heroes);
            let recipients = if o.kind == "hero_upgrade" { ready } else { eligible };
            let recipient = if recipients.is_empty() { None } else { Some(recipients[(next.cursor % recipients.len() as u64) as usize].clone()) };
            match recipient {
                None => next.objective = None,
                Some(r) => {
                    o.hero_id = Some(r.id.clone());
                    if o.kind == "hero_upgrade" { if o.hero_name.as_deref().is_none_or(|n| n.is_empty()) { o.hero_name = Some(r.name); } }
                    else { o.hero_name = None; if o.reward_hero_name.as_deref().is_none_or(|n| n.is_empty()) { o.reward_hero_name = Some(r.name); } }
                    next.objective = Some(o);
                }
            }
        } else { next.objective = Some(o); }
        if next.objective.is_some() { return next; }
    }
    let roll = next_random(&mut next);
    let eligible = eligible_ticket_heroes(heroes);
    let ready = eligible_hero_upgrade_targets(&next, heroes);
    let candidates: Vec<&str> = objective_types().into_iter().filter(|t| !is_milestone(t) && *t != "wave_clear" && ((*t != "training_upgrade" && *t != "hero_upgrade") || (if *t == "training_upgrade" { !eligible.is_empty() && can_train } else { !ready.is_empty() }))).collect();
    let milestones = milestone_candidates(&next, heroes, context);
    let mut pool: Vec<Objective> = milestones.iter().cloned().chain(candidates.iter().map(|t| Objective { id: String::new(), kind: t.to_string(), target: 1, progress: 0, seed: 0, key: None, chapter: None, threshold: None, slot: None, rarity: None, stat: None, hero_id: None, hero_name: None, reward_hero_name: None })).filter(|r| quest_family(&r.kind) != next.last_family).collect();
    if pool.is_empty() { pool = candidates.iter().map(|t| Objective { id: String::new(), kind: t.to_string(), target: 1, progress: 0, seed: 0, key: None, chapter: None, threshold: None, slot: None, rarity: None, stat: None, hero_id: None, hero_name: None, reward_hero_name: None }).collect(); }
    let opening_gear = (next.cursor == 2 && context.equipment.is_some()).then(|| milestones.iter().find(|r| r.kind == "equip_slot" && r.slot.as_deref() == Some("hat")).cloned()).flatten();
    let picked = opening_gear.unwrap_or_else(|| pool[((next.cursor + roll as u64) % pool.len() as u64) as usize].clone());
    if is_milestone(&picked.kind) {
        let mut o = picked;
        o.id = format!("cot-{}-{:x}", next.cursor, next.seed);
        o.progress = 0;
        o.seed = next.seed;
        next.objective = Some(o);
        reconcile_milestones(&mut next, heroes, context);
        return next;
    }
    let kind = picked.kind.clone();
    let roll2 = next_random(&mut next);
    let target = action_target(&kind, chapter, roll2);
    let recipients = if kind == "hero_upgrade" { ready } else { eligible };
    let hero = if ["hero_upgrade", "training_upgrade"].contains(&kind.as_str()) && !recipients.is_empty() { Some(recipients[(next.cursor % recipients.len() as u64) as usize].clone()) } else { None };
    next.objective = Some(Objective { id: format!("cot-{}-{:x}", next.cursor, next.seed), kind: kind.clone(), target, progress: 0, seed: next.seed, key: None, chapter: None, threshold: None, slot: None, rarity: None, stat: None,
        hero_id: hero.as_ref().map(|h| h.id.clone()), hero_name: hero.as_ref().filter(|_| kind == "hero_upgrade").map(|h| h.name.clone()), reward_hero_name: hero.as_ref().filter(|_| kind == "training_upgrade").map(|h| h.name.clone()) });
    next
}
pub fn valid_milestone_objective(o: &Objective) -> bool {
    if !is_milestone(&o.kind) { return true; }
    let safe_int = |v: f64| crate::lamp::is_safe_integer(v);
    match o.kind.as_str() {
        "equip_slot" => SLOTS.contains(&o.slot.as_deref().unwrap_or("")),
        "equip_rarity" => rarity_index(o.rarity.as_deref().unwrap_or("")).is_some(),
        "equip_level" => { let t = o.threshold_u(); safe_int(t) && t >= 5. && t <= 990. && t % 5. == 0. }
        "hero_level" | "party_level" | "training_level" => { let t = o.threshold_u(); safe_int(t) && t > 0. && t <= 100. && (o.kind != "hero_level" || o.hero_id.as_deref().is_some_and(|h| !h.is_empty())) && (o.kind != "training_level" || TRAINING_STATS.contains(&o.stat.as_deref().unwrap_or(""))) }
        "chapter_clear" | "boss_defeat" => { let c = o.chapter_u(); safe_int(c) && c > 0. }
        _ => true,
    }
}
#[derive(Clone, Debug, PartialEq)]
pub struct Event<'a> { pub id: &'a str, pub kind: &'a str, pub hero_id: Option<&'a str> }
/// `recordCombatObjectiveEvent(state, event, heroes, now)` → (state, changed).
pub fn record_event(state: &ProgressionState, event: Event, heroes: &[QuestHero]) -> (ProgressionState, bool) {
    let mut next = ensure_objective(state, heroes, Context::default());
    let id = safe_id(Some(&Value::String(event.id.into())));
    if id.is_empty() || !objective_types().contains(&event.kind) || next.processed_events.contains(&id) { return (next, false); }
    next.processed_events.push(id);
    if next.processed_events.len() > 512 { let drop = next.processed_events.len() - 512; next.processed_events.drain(..drop); }
    if let Some(o) = next.objective.as_mut() {
        if o.progress < o.target && o.kind == event.kind && (event.kind != "hero_upgrade" || event.hero_id == o.hero_id.as_deref()) { o.progress = (o.progress + 1).min(o.target); }
    }
    (next, true)
}
#[derive(Clone, Debug, PartialEq)]
pub struct ClaimResult { pub state: ProgressionState, pub ok: bool, pub reason: Option<&'static str>, pub receipt: Option<Receipt> }
/// `claimCombatObjectiveReward(state, expectedObjectiveId, heroes, now, context)`.
pub fn claim_reward(state: &ProgressionState, expected_id: &str, heroes: &[QuestHero], now: f64, context: Context) -> ClaimResult {
    let mut next = ensure_objective(state, heroes, context);
    let Some(objective) = next.objective.clone().filter(|o| o.id == safe_id(Some(&Value::String(expected_id.into())))) else { return ClaimResult { state: next, ok: false, reason: Some("stale_objective"), receipt: None } };
    if objective.progress < objective.target { return ClaimResult { state: next, ok: false, reason: Some("not_ready"), receipt: None }; }
    let receipt_id = format!("cot-reward:{}", objective.id);
    if next.reward_receipts.iter().any(|r| r.id == receipt_id) { return ClaimResult { state: next, ok: false, reason: Some("already_claimed"), receipt: None }; }
    let (resource, amount) = reward_bundle(&objective.kind).unwrap();
    let recipient = eligible_ticket_heroes(heroes).into_iter().find(|h| Some(h.id.as_str()) == objective.hero_id.as_deref());
    let ticket = resource == "hero_ticket";
    // JS leaves `heroId`/`heroName` undefined (absent) when the objective carries none.
    let hero_name = if ticket { if objective.kind == "hero_upgrade" { objective.hero_name.clone() } else { objective.reward_hero_name.clone().filter(|n| !n.is_empty()).or_else(|| recipient.map(|r| r.name)) } } else { None };
    let rewards = Receipt { id: receipt_id.clone(), resource: resource.into(), amount, hero_id: if ticket { objective.hero_id.clone() } else { None }, hero_name };
    if resource == "incense" { next.wallet.incense += amount; }
    if ticket { if let Some(h) = rewards.hero_id.as_deref().filter(|h| !h.is_empty()) { let current = next.wallet.tickets(h); next.wallet.tickets_by_hero.insert(h.into(), json!(current + amount)); } }
    next.reward_receipts.push(rewards.clone());
    let has_hero = rewards.hero_id.as_deref().is_some_and(|h| !h.is_empty());
    next.last_reward = Some(LastReward { label: "Objective cleared".into(), icon: resource.into(), count: amount, shown_at: if now.is_nan() { 0. } else { now.max(0.) }, receipt_id, hero_id: has_hero.then(|| rewards.hero_id.clone().unwrap()), hero_name: if has_hero { rewards.hero_name.clone() } else { None } });
    next.last_family = quest_family(&objective.kind).into();
    if let Some(key) = objective.key.clone() { next.claimed_milestones.push(key); }
    next.cursor += 1;
    next.objective = None;
    ClaimResult { state: ensure_objective(&next, heroes, context), ok: true, reason: None, receipt: Some(rewards) }
}
#[derive(Clone, Debug, PartialEq)]
pub struct SpendResult { pub state: ProgressionState, pub ok: bool, pub reason: Option<&'static str>, pub cost: f64 }
/// `spendHeroTickets(state, heroId, hero, spendId)`.
pub fn spend_hero_tickets(state: &ProgressionState, hero_id: &str, hero: Option<&QuestHero>, spend_id: &str) -> SpendResult {
    let mut next = create_state(Some(&state.to_value()), state.seed);
    let Some(hero) = hero.filter(|h| h.instance_key == hero_id) else { return SpendResult { state: next, ok: false, reason: Some("hero_unavailable"), cost: 0. } };
    if hero.current_level >= hero.max_level { return SpendResult { state: next, ok: false, reason: Some("max_level"), cost: 0. }; }
    let cost = hero_ticket_level_cost(hero.current_level as f64);
    if next.wallet.tickets(hero_id) < cost { return SpendResult { state: next, ok: false, reason: Some("insufficient_tickets"), cost }; }
    let remaining = next.wallet.tickets(hero_id) - cost;
    next.wallet.tickets_by_hero.insert(hero_id.into(), json!(remaining));
    next.pending_ticket_spends.insert(spend_id.into(), json!({ "id": spend_id, "heroId": hero_id, "cost": cost, "fromLevel": hero.current_level }));
    SpendResult { state: next, ok: true, reason: None, cost }
}
/// `settleHeroTicketSpend(state, spendId, heroes, now)` → (state, changed).
pub fn settle_hero_ticket_spend(state: &ProgressionState, spend_id: &str, heroes: &[QuestHero]) -> (ProgressionState, bool) {
    let next = create_state(Some(&state.to_value()), state.seed);
    let Some(spend) = next.pending_ticket_spends.get(spend_id).cloned() else { return (next, false) };
    let hero_id = spend["heroId"].as_str().unwrap_or("").to_string();
    let event_id = format!("ticket-level-up:{spend_id}");
    let (mut result, _) = record_event(&next, Event { id: &event_id, kind: "hero_upgrade", hero_id: Some(&hero_id) }, heroes);
    result.pending_ticket_spends.remove(spend_id);
    (result, true)
}
#[derive(Clone, Debug, PartialEq)]
pub struct TrainResult { pub state: ProgressionState, pub ok: bool, pub reason: Option<&'static str>, pub stat: String, pub cost: f64, pub level: u32 }
/// `purchasePartyTraining(state, stat)`.
pub fn purchase_training(state: &ProgressionState, stat: &str) -> TrainResult {
    let mut next = create_state(Some(&state.to_value()), state.seed);
    if !TRAINING_STATS.contains(&stat) { return TrainResult { state: next, ok: false, reason: Some("invalid_stat"), stat: stat.into(), cost: 0., level: 0 }; }
    let level = next.training.get(stat);
    if level >= 100 { return TrainResult { state: next, ok: false, reason: Some("max_level"), stat: stat.into(), cost: 0., level }; }
    let cost = training_cost(&next, stat);
    if next.wallet.incense < cost { return TrainResult { state: next, ok: false, reason: Some("insufficient_incense"), stat: stat.into(), cost, level }; }
    next.wallet.incense -= cost;
    next.training.set(stat, level + 1);
    TrainResult { state: next, ok: true, reason: None, stat: stat.into(), cost, level: level + 1 }
}
/// `observeChapterMilestones(state, heroes, stage)`.
pub fn observe_chapter_milestones(state: &mut ProgressionState, region: Option<u32>) {
    if let Some(r) = region.filter(|r| *r >= 1) { state.chapters_cleared = state.chapters_cleared.max(r as f64 - 1.); }
}
/// `heroGrowthRules.starUpHero(state, heroId)`: spends the hero's own tickets.
#[derive(Clone, Debug, PartialEq)]
pub struct StarUpResult { pub state: ProgressionState, pub ok: bool, pub reason: Option<&'static str>, pub cost: f64, pub stars: u32 }
pub fn star_up_hero(state: &ProgressionState, hero_id: &str) -> StarUpResult {
    let Some(id) = hero::HERO_DEFINITIONS.iter().find(|d| d.key == hero_id).map(|d| d.key) else { return StarUpResult { state: state.clone(), ok: false, reason: Some("hero_unavailable"), cost: 0., stars: 0 } };
    let stars = state.growth.as_ref().map_or(0, |g| g.stars.get(id).and_then(Value::as_f64).map_or(0, |v| v.max(0.).min(hero::STAR_MAX as f64).floor() as u32));
    if stars >= hero::STAR_MAX { return StarUpResult { state: state.clone(), ok: false, reason: Some("max_stars"), cost: 0., stars }; }
    let cost = hero::star_up_cost(stars);
    let balance = state.wallet.tickets(id);
    if balance < cost { return StarUpResult { state: state.clone(), ok: false, reason: Some("insufficient_tickets"), cost, stars }; }
    let mut next = state.clone();
    let mut growth = next.growth.clone().unwrap_or_default();
    growth.stars.insert(id.into(), json!(stars + 1));
    next.growth = sanitize_growth(Some(&serde_json::to_value(&growth).unwrap()));
    next.wallet.tickets_by_hero.insert(id.into(), json!(balance - cost));
    StarUpResult { state: next, ok: true, reason: None, cost, stars: stars + 1 }
}
