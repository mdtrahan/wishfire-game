//! `web-runner/src/core/heroProgression.mjs` store shape (`orka.hero_progress.v2`) and
//! `heroProgressStorage.js` checkpoint capture. Save/normalize/migrate arrive with ORKA-63bf.5.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use wf_meta::hero::{self, HeroDefinition};
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
/// One saved hero (`newHeroProgress` + `saveHeroProgress` shape).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeroProgress {
    pub hero_instance_key: String,
    #[serde(default)] pub equipment_stats: BTreeMap<String, f64>,
    pub base_hero_name: String,
    pub name: String,
    pub current_level: u32,
    #[serde(rename = "currentEXP")] pub current_exp: f64,
    #[serde(rename = "lampEXPClaimed", default)] pub lamp_exp_claimed: f64,
    pub max_level: u32,
    pub hp: f64,
    #[serde(rename = "maxHP")] pub max_hp: f64,
    pub stats: Stats5,
    #[serde(rename = "EXPToNextLevel")] pub exp_to_next_level: f64,
}
impl HeroProgress {
    pub fn definition(&self) -> &'static HeroDefinition { hero::hero_definition(&self.base_hero_name).expect("saved hero has a definition") }
    /// `refreshHeroStats`: level stats + equipment, max HP, EXP to next.
    pub fn refresh(&mut self) {
        let def = self.definition();
        let stats = hero::level_stats(def, self.current_level, &self.equipment_stats);
        self.max_hp = hero::max_hp(stats.hp, 1.);
        self.stats = Stats5::from6(stats);
        self.max_level = hero::MAX_LEVEL;
        self.exp_to_next_level = hero::exp_to_next_level(self.current_level);
    }
    /// `newHeroProgress(key, instanceKey)`.
    pub fn new(key: &str, instance_key: &str) -> Result<Self, String> {
        let def = hero::hero_definition(key).ok_or_else(|| format!("Unknown hero: {key}"))?;
        let mut hero = HeroProgress { hero_instance_key: instance_key.into(), equipment_stats: BTreeMap::new(), base_hero_name: def.key.into(), name: def.key.into(), current_level: 1, current_exp: 0., lamp_exp_claimed: 0., max_level: hero::MAX_LEVEL, hp: 0., max_hp: 0., stats: Stats5::default(), exp_to_next_level: 0. };
        hero.refresh();
        hero.hp = hero.max_hp;
        Ok(hero)
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
    #[serde(default)] pub cleared_pack_mask: u32,
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
    /// Unknown save fields are preserved verbatim.
    #[serde(flatten)] pub extra: BTreeMap<String, Value>,
}
impl HeroProgressStore {
    /// `createHeroProgressStore()` with no snapshot: the four canonical heroes at level 1.
    pub fn fresh() -> Self {
        let mut store = HeroProgressStore { version: HERO_PROGRESS_VERSION, heroes: BTreeMap::new(), settled_battles: Vec::new(), pending_battle_rewards: None, pending_gold_settlements: BTreeMap::new(), settled_ticket_spends: Vec::new(), combat_reward_outbox: crate::rewards::OutboxState::default(), pending_bag_kill_rewards: None, continuous_stage: None, extra: BTreeMap::new() };
        for d in hero::HERO_DEFINITIONS.iter() { store.heroes.insert(d.key.into(), HeroProgress::new(d.key, d.key).unwrap()); }
        store
    }
    /// `attachHeroProgress`: returns the saved hero for an instance key, creating it from the definition.
    pub fn attach(&mut self, key: &str, instance_key: &str) -> &HeroProgress {
        if !self.heroes.contains_key(instance_key) { self.heroes.insert(instance_key.into(), HeroProgress::new(key, instance_key).unwrap()); }
        &self.heroes[instance_key]
    }
    pub fn bag_rewards_mut(&mut self) -> &mut BTreeMap<String, f64> { self.pending_bag_kill_rewards.get_or_insert_with(BTreeMap::new) }
}
