//! `web-runner/src/core/heroProgression.mjs` store shape (`orka.hero_progress.v2`), its
//! normalization (`createHeroProgressStore`), EXP awards and `heroProgressStorage.js` capture.
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::BTreeMap;
use wf_meta::hero::{self, HeroDefinition};
use wf_meta::jsnum::{is_safe_integer, number, number_or};
use wf_meta::shadow::Stats6;

pub const HERO_PROGRESS_VERSION: u32 = 2;
pub const WFM_COMBAT_CONTENT_VERSION: &str = "wfm-slice-v1";
pub const WFM_COMBAT_ABI_VERSION: u32 = 0x10000;

/// Five combat stats as saved (`stats` without HP).
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize, Default)]
pub struct Stats5 { #[serde(rename = "ATK")] pub atk: f64, #[serde(rename = "DEF")] pub def: f64, #[serde(rename = "MAG")] pub mag: f64, #[serde(rename = "RES")] pub res: f64, #[serde(rename = "SPD")] pub spd: f64 }
impl Stats5 {
    pub fn from6(s: Stats6) -> Self { Self { atk: s.atk, def: s.def, mag: s.mag, res: s.res, spd: s.spd } }
    pub fn with_hp(self, hp: f64) -> Stats6 { Stats6 { hp, atk: self.atk, def: self.def, mag: self.mag, res: self.res, spd: self.spd } }
}
/// One saved hero. `newHeroProgress` records carry `combatBaseMaxHP` and no `equipmentStats`;
/// `saveHeroProgress` records carry `equipmentStats` and no `combatBaseMaxHP`; normalized
/// records carry both.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeroProgress {
    pub hero_instance_key: String,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub equipment_stats: Option<BTreeMap<String, f64>>,
    pub base_hero_name: String,
    pub name: String,
    pub current_level: u32,
    #[serde(rename = "currentEXP")] pub current_exp: f64,
    #[serde(rename = "lampEXPClaimed", default)] pub lamp_exp_claimed: f64,
    pub max_level: u32,
    #[serde(rename = "combatBaseMaxHP", default, skip_serializing_if = "Option::is_none")] pub combat_base_max_hp: Option<f64>,
    pub hp: f64,
    #[serde(rename = "maxHP")] pub max_hp: f64,
    pub stats: Stats5,
    #[serde(rename = "EXPToNextLevel")] pub exp_to_next_level: f64,
    /// `hero.combatPower`: written by the equipment economy's apply pass; dropped on normalization.
    #[serde(default, skip_serializing_if = "Option::is_none")] pub combat_power: Option<f64>,
}
/// `awardHeroEXP` result.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AwardResult {
    pub hero: String,
    pub exp: f64,
    pub from_level: u32,
    pub to_level: u32,
    pub exp_before: f64,
    pub exp_after: f64,
    pub exp_to_next_before: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub stats_before: Option<Stats5>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub stats_after: Option<Stats5>,
    #[serde(rename = "maxHPBefore", default, skip_serializing_if = "Option::is_none")] pub max_hp_before: Option<f64>,
    #[serde(rename = "maxHPAfter", default, skip_serializing_if = "Option::is_none")] pub max_hp_after: Option<f64>,
}
impl HeroProgress {
    pub fn definition(&self) -> &'static HeroDefinition { hero::hero_definition(&self.base_hero_name).expect("saved hero has a definition") }
    pub fn equipment(&self) -> BTreeMap<String, f64> { self.equipment_stats.clone().unwrap_or_default() }
    /// `refreshHeroStats`: level stats + equipment, combat base max HP, max HP, EXP to next.
    pub fn refresh(&mut self) {
        let def = self.definition();
        let stats = hero::level_stats(def, self.current_level, &self.equipment());
        self.combat_base_max_hp = Some(stats.hp);
        self.max_hp = hero::max_hp(stats.hp, 1.);
        self.stats = Stats5::from6(stats);
        self.max_level = hero::MAX_LEVEL;
        self.exp_to_next_level = hero::exp_to_next_level(self.current_level);
    }
    /// `newHeroProgress(key, instanceKey)`.
    pub fn new(key: &str, instance_key: &str) -> Result<Self, String> {
        let def = hero::hero_definition(key).ok_or_else(|| format!("Unknown hero: {key}"))?;
        let mut hero = HeroProgress { hero_instance_key: instance_key.into(), equipment_stats: None, base_hero_name: def.key.into(), name: def.key.into(), current_level: 1, current_exp: 0., lamp_exp_claimed: 0., max_level: hero::MAX_LEVEL, combat_base_max_hp: None, hp: 0., max_hp: 0., stats: Stats5::default(), exp_to_next_level: 0., combat_power: None };
        hero.refresh();
        hero.hp = hero.max_hp;
        Ok(hero)
    }
    /// `awardHeroEXP(hero, amount)`: level-ups carry the max-HP gain into current HP.
    pub fn award_exp(&mut self, amount: f64) -> AwardResult {
        let before_level = self.current_level;
        let before_hp = self.max_hp;
        let before_stats = self.stats;
        let before_exp = self.current_exp.max(0.);
        let before_to_next = self.exp_to_next_level.max(0.);
        let exp = if amount.is_nan() { 0. } else { amount.floor().max(0.) };
        if self.current_level >= self.max_level {
            self.current_exp = 0.;
            self.exp_to_next_level = 0.;
            return AwardResult { hero: self.definition().key.into(), exp: 0., from_level: before_level, to_level: before_level, exp_before: before_exp, exp_after: 0., exp_to_next_before: before_to_next, stats_before: None, stats_after: None, max_hp_before: None, max_hp_after: None };
        }
        self.current_exp += exp;
        while self.current_level < self.max_level && self.current_exp >= hero::exp_to_next_level(self.current_level) {
            self.current_exp -= hero::exp_to_next_level(self.current_level);
            let old_hp = self.max_hp;
            self.current_level += 1;
            self.refresh();
            if self.hp > 0. { self.hp = self.max_hp.min(self.hp + self.max_hp - old_hp); }
        }
        if self.current_level >= self.max_level { self.current_exp = 0.; self.exp_to_next_level = 0.; }
        AwardResult { hero: self.definition().name.into(), exp, from_level: before_level, to_level: self.current_level, exp_before: before_exp, exp_after: self.current_exp.max(0.), exp_to_next_before: before_to_next,
            stats_before: Some(before_stats), stats_after: Some(self.stats), max_hp_before: Some(before_hp), max_hp_after: Some(self.max_hp) }
    }
    /// `saveHeroProgress` record shape for a hero at `level` with the given HP and stats.
    pub fn saved_record(instance_key: &str, definition_key: &str, equipment: Option<&BTreeMap<String, f64>>, level: u32, exp: f64, lamp_exp_claimed: f64, hp: f64, max_hp: f64, stats: Stats5) -> Self {
        HeroProgress { hero_instance_key: instance_key.into(), equipment_stats: Some(equipment.cloned().unwrap_or_default()), base_hero_name: definition_key.into(), name: definition_key.into(), current_level: level, current_exp: exp, lamp_exp_claimed, max_level: hero::MAX_LEVEL, combat_base_max_hp: None, hp: hp.min(max_hp), max_hp, stats, exp_to_next_level: hero::exp_to_next_level(level), combat_power: None }
    }
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SubwaveProgress { pub position: String, pub index: u32, #[serde(rename = "partyCP")] pub party_cp: f64, pub entry_pack_mask: u32 }
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CombatCheckpoint {
    pub version: u32,
    pub id: String,
    pub generation: u64,
    pub reward_lineage: String,
    pub content_version: String,
    pub abi_version: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub subwaves: Option<SubwaveProgress>,
}
/// `HeroProgress.continuousStage` (topology version 2).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContinuousStageCheckpoint {
    pub topology_version: u32,
    pub region: u32,
    pub stage: u32,
    pub wave: u32,
    pub boss_available: bool,
    pub boss_summon_required: bool,
    pub cleared_bosses: u32,
    #[serde(rename = "bossUID", default, skip_serializing_if = "Option::is_none")] pub boss_uid: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub cleared_pack_mask: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub seed: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub transitions: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub combat_checkpoint: Option<CombatCheckpoint>,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingBattleRewards { pub id: String, pub participants: Vec<String>, pub defeated: BTreeMap<String, f64>, pub defeated_gold: BTreeMap<String, f64> }
/// `orka.hero_progress.v2`.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeroProgressStore {
    pub version: u32,
    pub heroes: BTreeMap<String, HeroProgress>,
    pub settled_battles: Vec<String>,
    pub pending_battle_rewards: Option<PendingBattleRewards>,
    pub pending_gold_settlements: BTreeMap<String, f64>,
    pub settled_ticket_spends: Vec<String>,
    pub combat_reward_outbox: crate::rewards::OutboxState,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub pending_bag_kill_rewards: Option<BTreeMap<String, f64>>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub continuous_stage: Option<ContinuousStageCheckpoint>,
    /// Not saved: set by economy writers; the session folds it into `progress_dirty`.
    #[serde(skip)] pub dirty: bool,
}
fn object(v: Option<&Value>) -> Option<&Map<String, Value>> { v.and_then(Value::as_object) }
/// `sanitizeRewardLedger`: finite non-negative amounts keyed by string.
fn sanitize_reward_ledger(v: Option<&Value>) -> BTreeMap<String, f64> {
    let entries: Vec<(String, &Value)> = match v {
        Some(Value::Object(m)) => m.iter().map(|(k, v)| (k.clone(), v)).collect(),
        Some(Value::Array(a)) => a.iter().enumerate().map(|(i, v)| (i.to_string(), v)).collect(),
        _ => Vec::new(),
    };
    entries.into_iter().filter_map(|(id, v)| { let n = number(Some(v)); (n.is_finite() && n >= 0.).then_some((id, n)) }).collect()
}
fn checkpoint_error(message: &str) -> String { format!("WFM checkpoint: {message}") }
fn short_string(v: Option<&Value>, max: usize) -> Option<&str> { v.and_then(Value::as_str).filter(|s| !s.is_empty() && s.len() <= max) }
/// `validateCombatCheckpoint(stage)`: errors carry the JS `WFM_CHECKPOINT_INCOMPATIBLE` message.
pub fn validate_combat_checkpoint(stage: Option<&Value>) -> Result<(), String> {
    let Some(meta) = stage.and_then(|s| s.get("combatCheckpoint")) else { return Ok(()) };
    let stage = stage.unwrap();
    let Some(m) = meta.as_object() else { return Err(checkpoint_error("invalid checkpoint identity")) };
    if m.get("version") != Some(&Value::from(1)) { return Err(checkpoint_error("unsupported checkpoint version")); }
    if m.get("contentVersion").and_then(Value::as_str) != Some(WFM_COMBAT_CONTENT_VERSION) {
        return Err(checkpoint_error(&format!("content version mismatch (saved {}, expected {WFM_COMBAT_CONTENT_VERSION})", m.get("contentVersion").map_or("undefined".to_string(), |v| v.as_str().map_or(v.to_string(), |s| s.to_string())))));
    }
    if m.get("abiVersion") != Some(&Value::from(WFM_COMBAT_ABI_VERSION)) {
        return Err(checkpoint_error(&format!("ABI version mismatch (saved {}, expected {WFM_COMBAT_ABI_VERSION})", m.get("abiVersion").map_or("undefined".to_string(), |v| v.to_string()))));
    }
    let seed = number(stage.get("seed"));
    let transitions = number(stage.get("transitions"));
    let generation = number(m.get("generation"));
    if !is_safe_integer(stage.get("seed")) || !(1. ..=4294967295.).contains(&seed) || !is_safe_integer(stage.get("transitions")) || transitions < 0.
        || !is_safe_integer(m.get("generation")) || generation < 1. || short_string(m.get("id"), 180).is_none() || short_string(m.get("rewardLineage"), 180).is_none() {
        return Err(checkpoint_error("invalid checkpoint identity, seed, generation or reward lineage"));
    }
    if let Some(progress) = m.get("subwaves") {
        let p = progress.as_object();
        let ok = p.is_some_and(|p| {
            let index = number(p.get("index"));
            let party_cp = number(p.get("partyCP"));
            let mask = number(p.get("entryPackMask"));
            short_string(p.get("position"), 100).is_some() && is_safe_integer(p.get("index")) && (0. ..42.).contains(&index)
                && party_cp.is_finite() && party_cp >= 0. && is_safe_integer(p.get("entryPackMask")) && (0. ..=63.).contains(&mask)
        });
        if !ok { return Err(checkpoint_error("invalid subwave checkpoint")); }
    }
    Ok(())
}
/// `normalizeContinuousStageCheckpoint(stage)`: `Ok(None)` for an unusable stage, errors for a
/// checkpoint identity that cannot be migrated.
pub fn normalize_continuous_stage_checkpoint(stage: Option<&Value>) -> Result<Option<ContinuousStageCheckpoint>, String> {
    validate_combat_checkpoint(stage)?;
    let Some(s) = object(stage) else { return Ok(None) };
    let region = number(s.get("region"));
    let stage_no = number(s.get("stage"));
    let wave = number(s.get("wave"));
    let cleared_bosses = number(s.get("clearedBosses"));
    if !is_safe_integer(s.get("region")) || region < 1. || !is_safe_integer(s.get("stage")) || !is_safe_integer(s.get("wave")) || wave < 1.
        || !matches!(s.get("bossAvailable"), Some(Value::Bool(_))) || !is_safe_integer(s.get("clearedBosses")) || cleared_bosses < 0. { return Ok(None); }
    let topology = s.get("topologyVersion").filter(|v| !v.is_null());
    if topology.is_some() && topology != Some(&Value::from(2)) { return Ok(None); }
    let legacy = topology.is_none();
    if legacy && (stage_no < 1. || stage_no > 10. || wave > 4.) { return Ok(None); }
    if !legacy && (stage_no != 1. || wave > wf_meta::stage::waves_for_stage(region as u32) as f64) { return Ok(None); }
    let region = if legacy { (region - 1.) * 10. + stage_no } else { region };
    if !(region.is_finite() && region.fract() == 0. && region >= 1. && region <= 9007199254740991.) { return Ok(None); }
    let mut checkpoint = ContinuousStageCheckpoint { topology_version: 2, region: region as u32, stage: 1, wave: if legacy { 1 } else { wave as u32 }, boss_available: s.get("bossAvailable") == Some(&Value::Bool(true)),
        boss_summon_required: s.get("bossSummonRequired") == Some(&Value::Bool(true)), cleared_bosses: cleared_bosses as u32, boss_uid: None, cleared_pack_mask: None, seed: None, transitions: None, combat_checkpoint: None };
    let mask = number(s.get("clearedPackMask"));
    if !legacy && is_safe_integer(s.get("clearedPackMask")) && (0. ..=63.).contains(&mask) { checkpoint.cleared_pack_mask = Some(mask as u32); }
    let boss_uid = number(s.get("bossUID"));
    if is_safe_integer(s.get("bossUID")) && boss_uid > 0. { checkpoint.boss_uid = Some(boss_uid as u32); }
    if let Some(m) = s.get("combatCheckpoint").filter(|v| v.as_object().is_some()) {
        if legacy { return Err(checkpoint_error("combat identity requires topology version 2")); }
        checkpoint.seed = Some(number(s.get("seed")) as u32);
        checkpoint.transitions = Some(number(s.get("transitions")) as u32);
        let subwaves = m.get("subwaves").map(|p| SubwaveProgress { position: p["position"].as_str().unwrap_or_default().into(), index: number(p.get("index")) as u32, party_cp: number(p.get("partyCP")), entry_pack_mask: number(p.get("entryPackMask")) as u32 });
        checkpoint.combat_checkpoint = Some(CombatCheckpoint { version: 1, id: m["id"].as_str().unwrap_or_default().into(), generation: number(m.get("generation")) as u64, reward_lineage: m["rewardLineage"].as_str().unwrap_or_default().into(),
            content_version: WFM_COMBAT_CONTENT_VERSION.into(), abi_version: WFM_COMBAT_ABI_VERSION, subwaves });
    }
    Ok(Some(checkpoint))
}
impl HeroProgressStore {
    fn empty() -> Self {
        HeroProgressStore { version: HERO_PROGRESS_VERSION, heroes: BTreeMap::new(), settled_battles: Vec::new(), pending_battle_rewards: None, pending_gold_settlements: BTreeMap::new(), settled_ticket_spends: Vec::new(), combat_reward_outbox: crate::rewards::OutboxState::default(), pending_bag_kill_rewards: None, continuous_stage: None, dirty: false }
    }
    /// `createHeroProgressStore()` with no snapshot: the four canonical heroes at level 1.
    pub fn fresh() -> Self { Self::from_snapshot(None).unwrap() }
    /// `createHeroProgressStore(snapshot)`: sanitizes a saved envelope; unknown keys and heroes drop.
    pub fn from_snapshot(snapshot: Option<&Value>) -> Result<Self, String> {
        let mut store = Self::empty();
        if let Some(saved) = object(snapshot).filter(|s| s.get("version") == Some(&Value::from(HERO_PROGRESS_VERSION))) {
            if let Some(heroes) = object(saved.get("heroes")) {
                for (id, raw) in heroes {
                    let name = raw.get("baseHeroName").filter(|v| v.as_str().is_some_and(|s| !s.is_empty())).or_else(|| raw.get("name")).and_then(Value::as_str).unwrap_or("");
                    let Some(def) = hero::hero_definition(name) else { continue };
                    let mut hero = HeroProgress::new(def.key, id)?;
                    hero.current_level = (number_or(raw.get("currentLevel"), 1.).floor().max(1.) as u32).min(hero.max_level);
                    hero.current_exp = number_or(raw.get("currentEXP"), 0.).floor().max(0.);
                    hero.lamp_exp_claimed = if is_safe_integer(raw.get("lampEXPClaimed")) && number(raw.get("lampEXPClaimed")) >= 0. { number(raw.get("lampEXPClaimed")) } else { 0. };
                    hero.equipment_stats = Some(object(raw.get("equipmentStats")).map(|m| m.iter().filter(|(k, v)| ["HP", "ATK", "DEF", "MAG", "RES", "SPD"].contains(&k.as_str()) && is_safe_integer(Some(v)) && number(Some(v)) >= 0.).map(|(k, v)| (k.clone(), number(Some(v)))).collect()).unwrap_or_default());
                    hero.refresh();
                    hero.hp = hero.max_hp.min(number_or(raw.get("hp"), 0.).max(0.));
                    if hero.current_level == hero.max_level { hero.current_exp = 0.; }
                    store.heroes.insert(id.clone(), hero);
                }
            }
            store.settled_battles = saved.get("settledBattles").and_then(Value::as_array).map(|a| { let ids: Vec<String> = a.iter().filter_map(Value::as_str).map(String::from).collect(); ids[ids.len().saturating_sub(100)..].to_vec() }).unwrap_or_default();
            if let Some(pending) = object(saved.get("pendingBattleRewards")) {
                if let (Some(id), Some(participants)) = (short_string(pending.get("id"), usize::MAX), pending.get("participants").and_then(Value::as_array)) {
                    store.pending_battle_rewards = Some(PendingBattleRewards { id: id.into(), participants: participants.iter().filter_map(Value::as_str).map(String::from).collect(), defeated: sanitize_reward_ledger(pending.get("defeated")), defeated_gold: sanitize_reward_ledger(pending.get("defeatedGold")) });
                }
            }
            store.pending_gold_settlements = sanitize_reward_ledger(saved.get("pendingGoldSettlements"));
            store.combat_reward_outbox = crate::rewards::OutboxState::from_saved(saved.get("combatRewardOutbox"))?;
            store.pending_bag_kill_rewards = Some(object(saved.get("pendingBagKillRewards")).map(|m| m.iter().filter(|(id, amount)| !id.is_empty() && id.len() <= 180 && matches!(amount.as_f64(), Some(a) if a == 1. || a == 5.)).map(|(id, amount)| (id.clone(), amount.as_f64().unwrap())).collect()).unwrap_or_default());
            store.settled_ticket_spends = saved.get("settledTicketSpends").and_then(Value::as_array).map(|a| {
                let mut seen = Vec::new();
                for id in a.iter().filter_map(Value::as_str).filter(|s| s.len() <= 180) { if !seen.iter().any(|s: &String| s == id) { seen.push(id.to_string()); } }
                seen[seen.len().saturating_sub(256)..].to_vec()
            }).unwrap_or_default();
            let stage = normalize_continuous_stage_checkpoint(saved.get("continuousStage"))?;
            if object(saved.get("continuousStage")).is_some_and(|s| s.get("combatCheckpoint").is_some_and(|c| !c.is_null() && c != &Value::Bool(false))) && stage.is_none() { return Err(checkpoint_error("invalid checkpoint topology")); }
            store.continuous_stage = stage;
        }
        for d in hero::HERO_DEFINITIONS.iter() { if !store.heroes.contains_key(d.key) { store.heroes.insert(d.key.into(), HeroProgress::new(d.key, d.key)?); } }
        Ok(store)
    }
    /// `setHeroProgressLevel(store, level, partyEXP)`: QA preset for every saved hero.
    pub fn set_level(&mut self, level: u32, party_exp: f64) -> Result<(), String> {
        if level < 1 || level > hero::MAX_LEVEL || !(party_exp.is_finite() && party_exp.fract() == 0. && party_exp >= 0.) { return Err("Invalid hero progression preset.".into()); }
        for hero in self.heroes.values_mut() { hero.current_level = level; hero.current_exp = 0.; hero.lamp_exp_claimed = party_exp; hero.refresh(); hero.hp = hero.max_hp; }
        Ok(())
    }
    /// `attachHeroProgress`: returns the saved hero for an instance key, creating it from the definition.
    pub fn attach(&mut self, key: &str, instance_key: &str) -> &HeroProgress {
        if !self.heroes.contains_key(instance_key) { self.heroes.insert(instance_key.into(), HeroProgress::new(key, instance_key).unwrap()); }
        &self.heroes[instance_key]
    }
    pub fn bag_rewards_mut(&mut self) -> &mut BTreeMap<String, f64> { self.pending_bag_kill_rewards.get_or_insert_with(BTreeMap::new) }
    /// `g.HeroProgressDirty = true` for callers that cannot reach the session flag.
    pub fn mark_dirty(&mut self) { self.dirty = true; }
}
