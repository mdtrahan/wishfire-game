//! Continuous-stage combat runtime: `rustCombatRuntime.mjs` + `combatAuthorityDriver.mjs` +
//! `questCombatSession.mjs` + the runtime half of `continuousCombatStage.mjs`, over the typed
//! `World`. Order of operations follows the JS exactly so gameplay hashes match the JS host.
use crate::progress::{CombatCheckpoint, ContinuousStageCheckpoint, HeroProgress, HeroProgressStore, PendingBattleRewards, Stats5, SubwaveProgress, WFM_COMBAT_ABI_VERSION, WFM_COMBAT_CONTENT_VERSION};
use crate::rewards::{self, ProgressionBattle};
use serde_json::Value;
use simulation_core::combat_abi::{EncounterConfig, EndReason, EnemyInput, StepRequest, World};
use std::collections::{BTreeMap, BTreeSet};
use wf_combat::{Event, Snapshot};
use wf_meta::combat_power::{compute_combat_power, CpActor};
use wf_meta::enemy::{EnemyRow, RawRow};
use wf_meta::geometry;
use wf_meta::hero::{self, HeroDefinition, Training};
use wf_meta::stage::{self, Activation, PlanEntry, StageState, BOSS_ENTRY_WIPE_MS, BOSS_TIME_LIMIT_SEC, PACKS_PER_WAVE, PACK_INTERVAL_SEC};
use wf_meta::subwaves;
use wf_meta::wfm_config::{self, EnemyHost, HeroHost};

/// Pinned slice Boss KO: 12 frames at 12 fps; actors.rs fade and impact_stop.rs camera.
const BOSS_KO_SECONDS: f64 = 1.;
const CORPSE_FADE: f64 = 0.42;
const DEATH_CAMERA_SECONDS: f64 = 0.32;
const RECOVERY_REVEAL_SECONDS: f64 = 0.35;

#[derive(Clone, Debug, PartialEq)]
pub struct HeroActor {
    pub uid: u32,
    pub instance_key: String,
    pub definition: &'static HeroDefinition,
    pub level: u32,
    pub hp: f64,
    pub max_hp: f64,
    pub combat_base_max_hp: f64,
    pub stats: Stats5,
    pub x: f64,
    pub y: f64,
    pub rust_actor_id: Option<u32>,
    /// `hostHeroes` original max HP while bound to a Rust encounter.
    bound_max_hp: Option<f64>,
    pub recovery_fade_started_at: Option<f64>,
}
impl HeroActor {
    pub fn from_progress(uid: u32, saved: &HeroProgress, display_slot: usize) -> Self {
        let x = 1020. + display_slot as f64 * 36.;
        Self { uid, instance_key: saved.hero_instance_key.clone(), definition: saved.definition(), level: saved.current_level, hp: saved.hp.min(saved.max_hp), max_hp: saved.max_hp, combat_base_max_hp: saved.max_hp, stats: saved.stats, x, y: 350., rust_actor_id: None, bound_max_hp: None, recovery_fade_started_at: None }
    }
    pub fn alive(&self) -> bool { self.hp > 0. }
    fn host(&self) -> HeroHost { HeroHost { instance_key: self.instance_key.clone(), definition: self.definition, hp: self.hp, max_hp: self.max_hp, combat_base_max_hp: self.combat_base_max_hp, stats: self.stats.with_hp(0.) } }
}
#[derive(Clone, Debug, PartialEq)]
pub struct EnemyEntity {
    pub uid: u32,
    pub row: EnemyRow,
    pub hp: f64,
    pub max_hp: f64,
    pub boss: bool,
    pub slot_index: u32,
    pub act: Activation,
    pub x: f64,
    pub y: f64,
    pub rust_actor_id: Option<u32>,
}
impl EnemyEntity {
    pub fn name(&self) -> &str { &self.row.name }
    pub fn alive(&self) -> bool { self.hp > 0. }
    fn host(&self) -> EnemyHost {
        EnemyHost { uid: self.uid, name: self.row.name.clone(), hp: self.hp, max_hp: self.max_hp, stats: self.row.stats6_into(), boss: self.boss, combat_tier: self.row.combat_tier, stream_walk_speed: self.act.stream_walk_speed, ranged: self.act.stream_delivery == "ranged", x: self.x, y: self.y, boss_interval_seconds: None }
    }
}
trait Stats6Into { fn stats6_into(&self) -> wf_meta::shadow::Stats6; }
impl Stats6Into for EnemyRow { fn stats6_into(&self) -> wf_meta::shadow::Stats6 { wf_meta::shadow::Stats6 { hp: self.hp, atk: self.atk, def: self.def, mag: self.mag, res: self.res, spd: self.spd } } }

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum HostRef { Hero(usize), Enemy(u32) }

/// Boss KO presentation tail (visual only; rewards already settled).
pub struct Tail { pub visual: Snapshot, pub ages: Vec<f32>, pub freeze: f64, pub elapsed: f64, pub previous_now: Option<f64>, pub born: f64, pub combat_born: f64, pub duration: f64 }

/// Receipt of the latest combat observation (`g.RustCombatReceipt`).
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Receipt { pub encounter_id: String, pub step: u64, pub sequence: u64, pub outcome: String, pub seconds: f64, pub presentation_seconds: f64, pub kills: usize, pub downed: usize }

/// Save sink: returns true when the store reached durable storage.
pub type Persist = Box<dyn FnMut(&HeroProgressStore) -> bool>;
/// COT quest recorder: `(id, type)`.
pub type QuestRecorder = Box<dyn FnMut(&str, &str)>;

pub struct Session {
    pub time: f64,
    pub stage: StageState,
    pub checkpoint: Option<CombatCheckpoint>,
    pub enemy_data: Vec<EnemyRow>,
    pub raw_rows: Vec<RawRow>,
    pub heroes: Vec<HeroActor>,
    pub enemies: Vec<EnemyEntity>,
    benched: BTreeMap<u32, EnemyEntity>,
    pub enemy_slots: Vec<u32>,
    pub next_uid: u32,
    pub enemy_size: f64,
    pub progress: HeroProgressStore,
    pub battle: ProgressionBattle,
    pub combat_session_id: String,
    pub dev_speed: f64,
    pub training: Option<Training>,
    pub stars: BTreeMap<String, u32>,
    pub gold_total: f64,
    pub pending_gold_settlements: BTreeMap<String, f64>,
    pub reward_serial: u32,
    pub progress_dirty: bool,
    pub storage_error: Option<String>,
    pub wfm_checkpoint_reload: bool,
    pub quest_finite_encounter: bool,
    pub intro_active: bool,
    pub receipt: Receipt,
    pub failed: Option<String>,
    /// Active seconds owed to the Bag conveyor (`advanceHostTime` with an unsettled battle).
    pub bag_seconds: f64,
    pub bag_blocked: bool,
    pub last_transition: Option<(String, String, f64)>,
    pub wave_clear_events: Vec<String>,
    /// Counts completed subwaves for the client (orb collection): the host released the next
    /// subwave, an ordinary wave cleared, or a boss fell. Observational; no rule reads it.
    pub subwave_completions: u32,
    persist: Persist,
    quest: QuestRecorder,
    encounter_counter: u64,
    ended_hash: Option<(u64, usize)>,
    /// `g.RestoredGoldSettlementReceipts`.
    restored_gold: BTreeSet<String>,
    /// combatAuthorityDriver permanent-input revisions: desired signature, (issued, acknowledged), pending command bodies, submitted (revision, sequence) by actor.
    desired_inputs: BTreeMap<String, String>,
    revisions: BTreeMap<String, (u64, u64)>,
    pending_inputs: BTreeMap<String, Value>,
    submitted_inputs: BTreeMap<u32, (String, String)>,
    command_sequence: u64,
    /// `g.ContinuousCombatStage` exists: saves capture the stage checkpoint.
    stage_configured: bool,
    frame_now_ms: f64,
    // driver
    world: Option<World>,
    encounter: String,
    sequence: u64,
    previous_now: Option<f64>,
    debt: f64,
    // runtime
    attempt: Option<String>,
    base_time: f64,
    last_combat_time: f64,
    last_presentation_time: f64,
    host_transition: bool,
    advanced: bool,
    subwaves: Vec<Vec<u32>>,
    previous_subwave: Vec<u32>,
    subwave_started: f64,
    pending_restart: Option<Vec<PlanEntry>>,
    hosts: BTreeMap<u32, HostRef>,
    hosts_seen_boss: BTreeSet<u32>,
    seen_spawns: BTreeSet<String>,
    intro_now: Option<f64>,
    pub tail: Option<Tail>,
    pub last_snapshot: Option<Snapshot>,
    pub presentation_events: Vec<Event>,
    /// (before, after) for every completed fixed step since the client last drained them.
    pub step_observations: Vec<(Snapshot, Snapshot)>,
    pub op_log: Vec<&'static str>,
}

impl Session {
    #[allow(clippy::too_many_arguments)]
    pub fn new(seed: u32, raw_rows: Vec<RawRow>, mut progress: HeroProgressStore, party: &[(&str, &str)], combat_session_id: &str, next_uid: u32, persist: Persist, quest: QuestRecorder) -> Self {
        let enemy_data = wf_meta::enemy::enemy_data(&raw_rows);
        let checkpoint = progress.continuous_stage.clone();
        let mut stage = checkpoint.as_ref().map_or_else(|| stage::create_stage_state(seed as f64, 1, 1), |c| {
            let mut s = stage::create_stage_state(seed as f64, c.region, c.stage);
            s.wave = c.wave; s.boss_available = c.boss_available; s.boss_summon_required = c.boss_summon_required; s.cleared_bosses = c.cleared_bosses; s.boss_uid = c.boss_uid;
            s.cleared_pack_mask = stage::normalize_pack_mask(c.cleared_pack_mask.unwrap_or(0));
            if let Some(seed) = c.seed { s.seed = seed; }
            if let Some(t) = c.transitions { s.transitions = t; }
            s
        });
        stage.boss_time_limit_sec = None;
        stage.spawned_pack_mask = 0;
        stage.spawn_serial = 0;
        let combat_checkpoint = checkpoint.as_ref().and_then(|c| c.combat_checkpoint.clone());
        if let Some(c) = &checkpoint { if c.combat_checkpoint.is_some() { if let Some(seed) = c.seed { stage.seed = seed; } } }
        let wfm_checkpoint_reload = checkpoint.is_some();
        let battle = ProgressionBattle::new(&format!("battle:{combat_session_id}"), party.iter().map(|(_, instance)| instance.to_string()).collect());
        let mut session = Self { time: 0., stage, checkpoint: combat_checkpoint, enemy_data, raw_rows, heroes: Vec::new(), enemies: Vec::new(), benched: BTreeMap::new(), enemy_slots: Vec::new(), next_uid, enemy_size: 40., progress, battle,
            combat_session_id: combat_session_id.into(), dev_speed: 1., training: None, stars: BTreeMap::new(), gold_total: 0., pending_gold_settlements: BTreeMap::new(), reward_serial: 0, progress_dirty: false, storage_error: None,
            wfm_checkpoint_reload, quest_finite_encounter: true, intro_active: false, receipt: Receipt::default(), failed: None, bag_seconds: 0., bag_blocked: false, last_transition: None, subwave_completions: 0, wave_clear_events: Vec::new(),
            persist, quest, encounter_counter: 0, ended_hash: None, restored_gold: BTreeSet::new(), desired_inputs: BTreeMap::new(), revisions: BTreeMap::new(), pending_inputs: BTreeMap::new(), submitted_inputs: BTreeMap::new(), command_sequence: 0, stage_configured: false, frame_now_ms: 0., world: None, encounter: String::new(), sequence: 0, previous_now: None, debt: 0., attempt: None, base_time: 0., last_combat_time: 0., last_presentation_time: 0.,
            host_transition: false, advanced: false, subwaves: Vec::new(), previous_subwave: Vec::new(), subwave_started: 0., pending_restart: None, hosts: BTreeMap::new(), hosts_seen_boss: BTreeSet::new(), seen_spawns: BTreeSet::new(), intro_now: None, tail: None,
            last_snapshot: None, presentation_events: Vec::new(), step_observations: Vec::new(), op_log: Vec::new() };
        // restoreHeroProgressFromStorage order: restored receipts settle (and may persist) before
        // the party attaches; pending gold and battle rewards recover after.
        session.restore_receipts();
        session.heroes = party.iter().enumerate().map(|(i, (key, instance))| { let saved = session.progress.attach(key, instance).clone(); HeroActor::from_progress(i as u32 + 1, &saved, i) }).collect();
        session.restore_progress();
        // configureContinuousCombatProduction, then the combat-entry restore persists the configured checkpoint.
        session.stage_configured = true;
        session.persist_progress_if_dirty();
        session.spawn_initial_wave();
        session
    }
    /// `initEntities` continuous path + `finalizeContinuousCombatProduction`: the authored opening
    /// wave (or the saved subwave plan) exists before the first host frame.
    fn spawn_initial_wave(&mut self) {
        let s = &self.stage;
        if s.boss_available && !s.boss_summon_required { return; }
        let saved = self.checkpoint.as_ref().and_then(|c| c.subwaves.clone()).filter(|p| !s.boss_active && p.position == self.subwave_position());
        let plan_state = match &saved { Some(p) => StageState { cleared_pack_mask: p.entry_pack_mask, ..s.clone() }, None => s.clone() };
        let party_cp = saved.as_ref().map_or_else(|| self.party_cp(), |p| p.party_cp);
        let Ok(plan) = stage::build_spawn_plan(&self.enemy_data, &plan_state, 0, party_cp, self.enemy_size) else { return };
        self.stage.spawned_pack_mask = plan.iter().fold(0, |m, e| m | (1 << e.sector_index));
        self.stage.spawn_serial = plan.len() as u32;
        self.stage.next_emission_at = self.time + PACK_INTERVAL_SEC;
        self.stage.last_updated_at = self.time;
        for entry in &plan { let _ = self.spawn_entry(entry, false, None); }
    }
    pub fn world(&self) -> Option<&World> { self.world.as_ref() }
    /// Interpolation fraction between the previous and current fixed step.
    pub fn alpha(&self) -> f32 { ((self.debt / (1. / 30.)) as f32).clamp(0., 1.) }
    /// Host-presented stage view for the client (never read by combat).
    pub fn stage_view(&self) -> wf_combat::StageView {
        let s = &self.stage;
        let (cleared, packs) = self.pack_progress();
        wf_combat::StageView { phase: if s.boss_active { wf_combat::StagePhase::Boss } else { wf_combat::StagePhase::Lull }, wave: s.wave, elapsed: self.time as f32,
            boss_eta: self.boss_time_remaining().unwrap_or(0.) as f32, escalation_level: 0, wipes: s.defeat_recoveries, kills: self.battle.defeated.len() as u32,
            mini_wave: cleared.min(packs), mini_waves_total: packs, tier: 1, buffs: Default::default(), fade: 0. }
    }
    pub fn sync_stage_view(&mut self) { let view = self.stage_view(); if let Some(w) = self.world.as_mut() { w.set_stage(view); } }
    pub fn battle_id(&self) -> &str { &self.battle.id }
    pub fn gameplay_hash(&self) -> Option<u64> { self.world.as_ref().map(|w| w.gameplay_hash()) }
    /// What `runtime.read()` reports between attempts: the ended world's final hash and live count.
    pub fn read_hash(&self) -> Option<(u64, usize)> { self.world.as_ref().map(|w| (w.gameplay_hash(), w.live_enemies())).or(self.ended_hash) }

    // ---- UID + entities ----
    fn next_uid(&mut self) -> u32 { self.next_uid = self.next_uid.max(1) + 1; self.next_uid }
    fn party_cp(&self) -> f64 {
        self.heroes.iter().map(|h| compute_combat_power(CpActor::new(h.level as f64, h.stats.atk, h.stats.mag, h.stats.def, h.stats.res, h.combat_base_max_hp, h.stats.spd))).sum()
    }
    /// `SpawnEnemy` + `activateContinuousCombatSpawnedEnemy` for one plan entry.
    fn spawn_entry(&mut self, entry: &PlanEntry, boss: bool, boss_x: Option<f64>) -> Result<u32, String> {
        let uid = self.next_uid();
        let act = stage::activate_entry(&self.stage, self.enemy_size, entry, boss, boss_x)?;
        let (x, y) = (act.x, act.y);
        let enemy = EnemyEntity { uid, row: entry.row.clone(), hp: entry.row.hp, max_hp: entry.row.hp, boss, slot_index: entry.slot_index, act, x, y, rust_actor_id: None };
        self.enemies.push(enemy);
        let slot = entry.slot_index as usize;
        if self.enemy_slots.len() <= slot { self.enemy_slots.resize(slot + 1, 0); }
        self.enemy_slots[slot] = uid + 1;
        Ok(uid)
    }
    fn boss_x_for_spawn(&self, state: &StageState) -> f64 {
        if let Some(x) = state.boss_world_x.filter(|v| v.is_finite()) { return x; }
        let living: Vec<&HeroActor> = self.heroes.iter().filter(|h| h.alive()).collect();
        if living.is_empty() { 290. } else { living.iter().map(|h| h.x).sum::<f64>() / living.len() as f64 + 260. }
    }
    /// `spawnContinuousCombatStage({globals, entities, call, state})`.
    fn spawn_stage(&mut self, state: StageState) -> Result<bool, String> {
        let plan = stage::build_spawn_plan(&self.enemy_data, &state, 0, self.party_cp(), self.enemy_size)?;
        if plan.is_empty() { return Ok(false); }
        let spawned_pack_mask = plan.iter().fold(0, |m, e| m | (1 << e.sector_index));
        let boss = stage::get_stage(&state).boss;
        self.stage = StageState { spawned_pack_mask, next_emission_at: self.time + PACK_INTERVAL_SEC, awaiting_pack_arrival: false, last_updated_at: self.time, spawn_serial: plan.len() as u32, boss_uid: None, ..state.clone() };
        for entry in &plan {
            let boss_x = self.boss_x_for_spawn(&state);
            let uid = self.spawn_entry(entry, boss, Some(boss_x))?;
            if boss { self.stage.boss_uid = Some(uid); }
        }
        Ok(true)
    }
    /// `armContinuousCombatBoss`.
    fn arm_boss(&mut self, now_ms: f64) -> Result<bool, String> {
        if !self.stage.boss_available || self.stage.boss_active { return Ok(false); }
        let living: Vec<usize> = self.heroes.iter().enumerate().filter(|(_, h)| h.alive()).map(|(i, _)| i).collect();
        let mut squad_center_x = if living.is_empty() { 290. - 130. } else { living.iter().map(|&i| self.heroes[i].x).sum::<f64>() / living.len() as f64 };
        if !living.is_empty() {
            let world = geometry::world_bounds();
            let safe = (world.hero_min_x + 320.).max((world.hero_max_x - 260. - 72. - 32.).min(squad_center_x));
            let shift = safe - squad_center_x;
            if shift != 0. { for &i in &living { let h = &mut self.heroes[i]; h.x = world.hero_min_x.max(world.hero_max_x.min(h.x + shift)); } }
            squad_center_x = safe;
        }
        let next = StageState { boss_armed: true, boss_active: true, boss_timer_started_at: None, boss_time_limit_sec: Some(BOSS_TIME_LIMIT_SEC), last_boss_outcome: None,
            boss_world_x: Some(squad_center_x + 260.), boss_camera_center_x: Some(squad_center_x + 130.), boss_transition_started_at_ms: Some(now_ms), boss_transition_ends_at_ms: Some(now_ms + BOSS_ENTRY_WIPE_MS),
            boss_uid: None, transitions: self.stage.transitions + 1, ..self.stage.clone() };
        if stage::build_spawn_plan(&self.enemy_data, &next, 0, 0., self.enemy_size)?.is_empty() { return Ok(false); }
        self.settle_continuous_combat_rewards();
        self.enemies.clear();
        self.enemy_slots.clear();
        self.spawn_stage(next)?;
        Ok(true)
    }
    /// `summonContinuousCombatBoss`: the explicit Summon Boss control.
    pub fn summon_boss(&mut self, now_ms: f64) -> Result<bool, String> {
        self.frame_now_ms = now_ms;
        if !self.stage.boss_available || !self.stage.boss_summon_required || self.stage.boss_active { return Ok(false); }
        if self.heroes.is_empty() || self.heroes.iter().any(|h| !h.alive() || self.reveal_active(h)) { return Ok(false); }
        if !self.arm_boss(now_ms)? { return Ok(false); }
        self.progress_dirty = true;
        Ok(true)
    }
    fn reveal_active(&self, hero: &HeroActor) -> bool { hero.recovery_fade_started_at.is_some_and(|t| self.time - t < RECOVERY_REVEAL_SECONDS) }

    // ---- checkpoint + persistence ----
    fn ensure_checkpoint(&mut self) {
        if self.checkpoint.is_none() {
            self.checkpoint = Some(CombatCheckpoint { version: 1, id: format!("cp-{}-{}", self.combat_session_id, self.stage.seed), generation: 1, reward_lineage: self.battle.id.clone(), content_version: WFM_COMBAT_CONTENT_VERSION.into(), abi_version: WFM_COMBAT_ABI_VERSION, subwaves: None });
        }
    }
    fn subwave_position(&self) -> String { format!("{}:{}:{}:{}:{}", self.stage.seed, self.stage.region, self.stage.stage, self.stage.wave, self.stage.transitions) }
    fn subwave_progress(&self) -> SubwaveProgress {
        let position = self.subwave_position();
        match self.checkpoint.as_ref().and_then(|c| c.subwaves.clone()) {
            Some(saved) if saved.position == position => saved,
            _ => SubwaveProgress { position, index: 0, party_cp: self.party_cp(), entry_pack_mask: self.stage.cleared_pack_mask },
        }
    }
    /// `persistHeroProgressIfDirty`: captures the stage checkpoint into the store and saves.
    pub fn persist_progress_if_dirty(&mut self) -> bool {
        if self.storage_error.is_some() { return false; }
        if self.progress.dirty { self.progress.dirty = false; self.progress_dirty = true; }
        if self.stage_configured { self.capture_stage_checkpoint(); }
        if self.capture_pending_battle_rewards() { self.progress_dirty = true; }
        if !self.progress_dirty { return false; }
        if (self.persist)(&self.progress) { self.progress_dirty = false; true } else { self.storage_error = Some("Hero progress could not be saved.".into()); false }
    }
    /// The `ContinuousCombatStage` capture inside `persistHeroProgressIfDirty`; only once the
    /// stage is configured (JS: after `configureContinuousCombatProduction`).
    fn capture_stage_checkpoint(&mut self) {
        let s = &self.stage;
        let mut checkpoint = ContinuousStageCheckpoint { topology_version: 2, region: s.region, stage: s.stage, wave: if s.boss_active { 1 } else { s.wave }, boss_available: s.boss_available || s.boss_active,
            boss_summon_required: s.boss_summon_required || s.boss_active, cleared_bosses: s.cleared_bosses, boss_uid: if s.boss_active { s.boss_uid.filter(|u| *u > 0) } else { None },
            cleared_pack_mask: Some(stage::normalize_pack_mask(s.cleared_pack_mask)), seed: None, transitions: None, combat_checkpoint: None };
        if let Some(cp) = &self.checkpoint {
            checkpoint.seed = Some(s.seed);
            checkpoint.transitions = Some(s.transitions);
            let previous = self.progress.continuous_stage.as_ref();
            let prior = previous.and_then(|p| p.combat_checkpoint.as_ref());
            let changed = prior.is_some_and(|prior| {
                let p = previous.unwrap();
                p.region != checkpoint.region || p.stage != checkpoint.stage || p.wave != checkpoint.wave || p.boss_available != checkpoint.boss_available || p.boss_summon_required != checkpoint.boss_summon_required
                    || p.cleared_bosses != checkpoint.cleared_bosses || p.boss_uid != checkpoint.boss_uid || p.cleared_pack_mask != checkpoint.cleared_pack_mask || p.seed != checkpoint.seed || p.transitions != checkpoint.transitions
                    || serde_json::to_value(&prior.subwaves).unwrap() != serde_json::to_value(&cp.subwaves).unwrap()
            });
            let generation = if changed { prior.unwrap().generation + 1 } else { cp.generation };
            let combat = CombatCheckpoint { generation, subwaves: if s.boss_active { None } else { cp.subwaves.clone() }, ..cp.clone() };
            self.checkpoint = Some(combat.clone());
            checkpoint.combat_checkpoint = Some(combat);
        }
        if self.progress.continuous_stage.as_ref() != Some(&checkpoint) { self.progress.continuous_stage = Some(checkpoint); self.progress_dirty = true; }
    }
    fn capture_pending_battle_rewards(&mut self) -> bool {
        let b = &self.battle;
        let current = if !b.settled && !b.defeated.is_empty() { Some(PendingBattleRewards { id: b.id.clone(), participants: b.participants.clone(), defeated: b.defeated.clone(), defeated_gold: b.defeated_gold.clone() }) } else { None };
        if self.progress.pending_battle_rewards == current { return false; }
        self.progress.pending_battle_rewards = current;
        true
    }
    /// `battle.persistPendingRewards(kill)`.
    pub fn persist_pending_rewards(&mut self, kill: Option<(String, f64)>) -> bool {
        if let Some((id, amount)) = kill { self.progress.bag_rewards_mut().insert(id, amount); }
        self.progress_dirty = true;
        self.capture_pending_battle_rewards();
        self.persist_progress_if_dirty()
    }
    fn save_checkpoint(&mut self) -> Result<(), String> {
        self.progress_dirty = true;
        if self.persist_progress_if_dirty() { return Ok(()); }
        Err("WFM_CHECKPOINT_SAVE_FAILED: save failed before Rust attempt creation or checkpoint advance".into())
    }
    fn save_hero_progress(&mut self, index: usize) {
        let hero = &self.heroes[index];
        let (hp, max_hp, stats) = match (hero.bound_max_hp, self.progress.heroes.get(&hero.instance_key)) {
            (Some(_), Some(source)) => (if hero.max_hp > 0. { hero.hp / hero.max_hp * source.max_hp } else { 0. }, source.max_hp, source.stats),
            _ => (hero.hp, hero.combat_base_max_hp, hero.stats),
        };
        let key = hero.instance_key.clone();
        let definition_key = hero.definition.key;
        let level = hero.level;
        let previous = self.progress.heroes.get(&key).cloned().unwrap_or_else(|| HeroProgress::new(definition_key, &key).unwrap());
        let (exp, lamp, equipment) = (previous.current_exp, previous.lamp_exp_claimed, previous.equipment());
        self.progress.heroes.insert(key.clone(), HeroProgress::saved_record(&key, definition_key, Some(&equipment), level, exp, lamp, hp, max_hp, stats));
    }
    /// `restoreHeroProgressFromStorage` after `createHeroProgressStore`: settle restored receipts,
    /// drop a stale boss attempt, recover pending gold and battle rewards, persist.
    fn restore_receipts(&mut self) {
        if let Err(error) = self.settle_pending_receipts() { self.storage_error = Some(error); }
    }
    fn restore_progress(&mut self) {
        if self.storage_error.is_some() { return; }
        for (id, amount) in self.progress.pending_gold_settlements.clone() {
            let amount = amount.max(0.).floor();
            if !self.restored_gold.insert(id.clone()) { continue; }
            self.pending_gold_settlements.insert(id, amount);
            self.gold_total += amount;
        }
        // restorePendingBattleRewards: a saved boss attempt is abandoned on reload.
        if let Some(uid) = self.progress.continuous_stage.as_ref().and_then(|s| s.boss_uid) {
            if let Some(active) = self.progress.pending_battle_rewards.as_mut() { active.defeated.remove(&uid.to_string()); active.defeated_gold.remove(&uid.to_string()); }
            if let Some(s) = self.progress.continuous_stage.as_mut() { s.boss_uid = None; }
            self.stage.boss_uid = None;
            self.progress_dirty = true;
        }
        let Some(pending) = self.progress.pending_battle_rewards.clone() else { self.persist_progress_if_dirty(); return };
        if self.progress.settled_battles.contains(&pending.id) {
            self.progress.pending_battle_rewards = None;
            self.progress_dirty = true;
            self.persist_progress_if_dirty();
            return;
        }
        let gold = pending.defeated_gold.values().map(|v| v.max(0.)).sum::<f64>();
        self.gold_total += gold;
        if gold > 0. {
            self.pending_gold_settlements.insert(pending.id.clone(), gold);
            self.progress.pending_gold_settlements.insert(pending.id.clone(), gold);
            self.restored_gold.insert(pending.id.clone());
        }
        // settleBattleEXP: zero EXP, then every participant is re-saved in the saveHeroProgress shape.
        self.progress.settled_battles.push(pending.id.clone());
        if self.progress.settled_battles.len() > 100 { let drop = self.progress.settled_battles.len() - 100; self.progress.settled_battles.drain(..drop); }
        for id in &pending.participants {
            let Some(mut record) = self.progress.heroes.get(id).cloned() else { continue };
            record.award_exp(0.);
            let max_hp = record.combat_base_max_hp.unwrap_or(record.max_hp);
            let saved = HeroProgress::saved_record(id, record.definition().key, Some(&record.equipment()), record.current_level, record.current_exp, record.lamp_exp_claimed, record.hp, max_hp, record.stats);
            if let Some(h) = self.heroes.iter_mut().find(|h| &h.instance_key == id) { h.level = saved.current_level; h.hp = saved.hp.min(saved.max_hp); h.max_hp = saved.max_hp; h.combat_base_max_hp = saved.max_hp; h.stats = saved.stats; }
            self.progress.heroes.insert(id.clone(), saved);
        }
        self.progress.pending_battle_rewards = None;
        self.progress_dirty = true;
        self.persist_progress_if_dirty();
    }
    /// `settlePendingReceipts()`: pending kill rows into the Bag queue and the quest recorder.
    fn settle_pending_receipts(&mut self) -> Result<(), String> {
        let pending = self.progress.combat_reward_outbox.streams.values().flat_map(|s| s.pending.iter().cloned()).collect::<Vec<_>>();
        if pending.is_empty() { return Ok(()); }
        for row in &pending { if row.amount > 0. { self.progress.bag_rewards_mut().insert(row.id.clone(), row.amount); } }
        self.progress_dirty = true;
        if !self.persist_progress_if_dirty() { return Err(self.storage_error.clone().unwrap_or_else(|| "Combat reward outbox save failed.".into())); }
        for row in &pending { (self.quest)(&row.id, "enemy_defeat"); }
        rewards::settle_pending_receipts(&mut self.progress.combat_reward_outbox);
        self.progress_dirty = true;
        if !self.persist_progress_if_dirty() { return Err("Combat reward outbox save failed.".into()); }
        Ok(())
    }
    /// `SettleContinuousCombatRewards`: settles the battle ledger and opens the next lineage battle.
    fn settle_continuous_combat_rewards(&mut self) {
        if self.battle.settled || self.progress.settled_battles.contains(&self.battle.id) { return; }
        let gold = self.battle.defeated_gold.values().map(|v| v.max(0.)).sum::<f64>().floor().max(0.);
        self.gold_total += gold;
        if gold > 0. { self.pending_gold_settlements.insert(self.battle.id.clone(), gold); self.progress.pending_gold_settlements.insert(self.battle.id.clone(), gold); }
        self.battle.settled = true;
        self.progress.settled_battles.push(self.battle.id.clone());
        if self.progress.settled_battles.len() > 100 { let drop = self.progress.settled_battles.len() - 100; self.progress.settled_battles.drain(..drop); }
        for i in 0..self.heroes.len() { if self.battle.participants.contains(&self.heroes[i].instance_key) { self.save_hero_progress(i); } }
        self.progress.pending_battle_rewards = None;
        self.progress_dirty = true;
        self.reward_serial += 1;
        let lineage = self.battle.reward_lineage_id.clone();
        self.battle = ProgressionBattle { id: format!("{lineage}-continuous-{}", self.reward_serial), participants: self.heroes.iter().map(|h| h.instance_key.clone()).collect(), defeated: BTreeMap::new(), defeated_gold: BTreeMap::new(), settled: false, outcome: "active".into(), reward_lineage_id: lineage };
    }

    // ---- driver ----
    fn driver_stop(&mut self, reason: Option<EndReason>) {
        if let (Some(reason), Some(world)) = (reason, self.world.as_mut()) {
            if world.state() != "host_ended" {
                self.op_log.push("end");
                if let Ok(after) = world.end_now(reason) { let _ = after; let last = world.last_event_sequence(); self.sequence = last; let id = world.encounter_id().to_string(); let _ = world.ack(&id, last); }
            }
        }
        if let Some(world) = self.world.take() { self.op_log.push("destroy"); self.ended_hash = Some((world.gameplay_hash(), world.live_enemies())); }
        self.previous_now = None;
        self.debt = 0.;
    }
    fn driver_start(&mut self, config: EncounterConfig) -> Result<(), String> {
        self.driver_stop(Some(EndReason::HostStageTransition));
        self.encounter = config.encounter_id.clone();
        self.sequence = 0;
        self.revisions.clear(); self.pending_inputs.clear(); self.submitted_inputs.clear(); self.command_sequence = 0;
        let mut world = World::create(config).map_err(|e| e.to_string())?;
        world.retain_typed_events = true;
        self.world = Some(world);
        self.op_log.push("create");
        self.accept(0, true)
    }
    /// `accept(result, notify)`: validates the fresh event range, consumes, acknowledges.
    fn accept(&mut self, after: usize, notify: bool) -> Result<(), String> {
        let (events, last, encounter_id) = {
            let world = self.world.as_ref().ok_or("Rust world missing")?;
            if world.encounter_id() != self.encounter { return Err("Rust encounter mismatch".into()); }
            (world.retained_events(after).to_vec(), world.last_event_sequence(), world.encounter_id().to_string())
        };
        let mut fresh = Vec::new();
        for event in events {
            let seq: u64 = event["sequence"].as_str().and_then(|s| s.parse().ok()).ok_or("Rust event sequence")?;
            if seq <= self.sequence { continue; }
            if seq != self.sequence + 1 { return Err("Rust event sequence gap".into()); }
            self.sequence = seq;
            fresh.push(event);
        }
        if notify { self.consume(fresh)?; }
        if let Some(world) = self.world.as_mut() { let _ = world.ack(&encounter_id, last.max(self.sequence).min(world.last_event_sequence())); }
        Ok(())
    }
    fn driver_advance(&mut self, now_ms: f64, paused: bool, speed: f64) -> Result<(), String> {
        if self.world.is_none() { return Ok(()); }
        if paused { self.previous_now = None; self.debt = 0.; return Ok(()); }
        if !now_ms.is_finite() { return Err("Invalid Rust foreground clock".into()); }
        if !speed.is_finite() || !(0.25..=4.).contains(&speed) { return Err("Invalid Rust foreground speed".into()); }
        self.debt += match self.previous_now { None => 0., Some(prev) => 0.25f64.min(((now_ms - prev) / 1000.).max(0.)) * speed };
        self.previous_now = Some(now_ms);
        let mut budget = 0;
        while self.world.as_ref().is_some_and(|w| w.state() == "running") && self.debt + 1e-9 >= 1. / 30. && budget < 8 {
            self.debt = (self.debt - 1. / 30.).max(0.);
            let before = self.world.as_ref().unwrap().snapshot().clone();
            let after = if self.pending_inputs.is_empty() { self.world.as_mut().unwrap().step_now().map_err(|e| e.to_string())? } else {
                let (encounter, step) = { let w = self.world.as_ref().unwrap(); (w.encounter_id().to_string(), w.step_number()) };
                let commands: Vec<Value> = self.pending_inputs.values().enumerate().map(|(index, data)| serde_json::json!({ "encounter_id": encounter, "step": (step + 1).to_string(), "sequence": (self.command_sequence + index as u64 + 1).to_string(), "body": { "kind": "replace_permanent_inputs", "data": data } })).collect();
                for c in &commands { self.submitted_inputs.insert(c["body"]["data"]["actor"].as_u64().unwrap() as u32, (c["body"]["data"]["revision"].as_str().unwrap().to_string(), c["sequence"].as_str().unwrap().to_string())); }
                let request: StepRequest = serde_json::from_value(serde_json::json!({ "encounter_id": encounter, "expected_previous_step": step.to_string(), "commands": commands })).map_err(|e| e.to_string())?;
                let after = self.world.as_mut().unwrap().step(request).map_err(|e| e.to_string())?;
                self.command_sequence += self.pending_inputs.len() as u64;
                after
            };
            self.op_log.push("step");
            self.accept(after, true)?;
            if !self.submitted_inputs.is_empty() { return Err("Missing Rust revision ack".into()); }
            if let Some(w) = self.world.as_ref() { self.step_observations.push((before, w.snapshot().clone())); }
            budget += 1;
        }
        Ok(())
    }
    fn driver_spawn(&mut self, enemies: Vec<EnemyInput>) -> Result<(), String> {
        let Some(world) = self.world.as_mut() else { return Ok(()) };
        let id = world.encounter_id().to_string();
        let after = world.spawn_batch(&id, enemies).map_err(|e| e.to_string())?;
        self.op_log.push("spawn");
        self.accept(after, true)
    }
    fn driver_wave_chest(&mut self) -> Result<(), String> {
        let Some(world) = self.world.as_mut() else { return Ok(()) };
        let id = world.encounter_id().to_string();
        let after = world.wave_chest(&id).map_err(|e| e.to_string())?;
        self.op_log.push("waveChest");
        self.accept(after, true)
    }
    fn driver_ordinary_clear(&mut self, transition_id: String) -> Result<(), String> {
        let Some(world) = self.world.as_mut() else { return Ok(()) };
        let id = world.encounter_id().to_string();
        let after = world.ordinary_clear(&id, transition_id).map_err(|e| e.to_string())?;
        self.op_log.push("ordinaryClear");
        self.accept(after, true)
    }

    // ---- runtime ----
    fn enemy_input(&self, enemy: &EnemyEntity) -> Result<EnemyInput, String> {
        let shadow = wfm_config::wfm_enemy_input(&enemy.host(), &self.raw_rows)?;
        serde_json::from_value(serde_json::to_value(shadow).unwrap()).map_err(|e| e.to_string())
    }
    fn restore_host_heroes(&mut self, keep_visuals: bool) {
        for i in 0..self.heroes.len() {
            let Some(original) = self.heroes[i].bound_max_hp else { continue };
            let ratio = if self.heroes[i].max_hp > 0. { self.heroes[i].hp / self.heroes[i].max_hp } else { 0. };
            if let Some(source) = self.progress.heroes.get(&self.heroes[i].instance_key) { self.heroes[i].stats = source.stats; self.heroes[i].combat_base_max_hp = source.max_hp; self.heroes[i].level = source.current_level; }
            let h = &mut self.heroes[i];
            h.max_hp = original;
            h.hp = (h.max_hp * ratio).clamp(0., h.max_hp);
            if !keep_visuals { h.rust_actor_id = None; h.bound_max_hp = None; }
        }
        if keep_visuals { return; }
    }
    fn stop(&mut self, reason: Option<EndReason>) {
        self.subwaves.clear();
        self.previous_subwave.clear();
        self.pending_restart = None;
        self.driver_stop(reason);
        self.restore_host_heroes(false);
        self.attempt = None;
        self.intro_now = None;
        self.tail = None;
        self.hosts.clear();
        self.hosts_seen_boss.clear();
        self.seen_spawns.clear();
        self.last_snapshot = None;
        self.presentation_events.push(Event::WaveReset);
    }
    fn finish_failure(&mut self, error: String) {
        if self.failed.is_some() { return; }
        self.failed = Some(error.clone());
        self.restore_host_heroes(false);
        self.attempt = None;
        self.receipt.outcome = "bridge_error".into();
        self.last_snapshot = None;
        if error.starts_with("WFM_CHECKPOINT_") || self.storage_error.is_some() { return; }
        if self.stage.boss_active { let _ = self.surrender_boss_attempt("rust_bridge_error"); } else { let _ = self.recover_continuous_defeat("rust_bridge_error"); }
    }
    fn project(&mut self, snapshot: &Snapshot, visual_only: bool) {
        let world = self.world.as_ref();
        let pending: Vec<String> = world.map(|w| w.pending_spawns().map(|(_, id, _)| id.to_string()).collect()).unwrap_or_default();
        for id in pending { if let Some(e) = self.enemies.iter_mut().find(|e| e.uid.to_string() == id) { e.hp = 0.; } }
        let views: Vec<(u32, Option<String>, bool, f32, f32, f32, f32, wf_combat::Archetype)> = snapshot.actors.iter().map(|a| (a.id, world.and_then(|w| w.host_id(a.id)).map(|s| s.to_string()), a.team == wf_combat::Team::Hero, a.hp, a.max_hp, a.pos.x, a.pos.y, a.archetype)).collect();
        for (actor_id, host_id, hero, hp, max_hp, x, y, archetype) in views {
            let host = match self.hosts.get(&actor_id).copied() {
                Some(h) => Some(h),
                None => {
                    let found = match (&host_id, hero) {
                        (Some(id), true) => self.heroes.iter().position(|h| &h.instance_key == id).map(HostRef::Hero),
                        (Some(id), false) => self.enemies.iter().find(|e| &e.uid.to_string() == id).map(|e| HostRef::Enemy(e.uid)),
                        (None, true) => None,
                        (None, false) => {
                            if archetype != wf_combat::Archetype::Gobloc { self.failed.get_or_insert(format!("Unsupported Rust summon: {archetype:?}")); None } else {
                                let row = self.enemy_data.iter().find(|r| r.name == "Gobloc").cloned();
                                row.map(|row| {
                                    let uid = self.next_uid.max(self.enemies.iter().chain(self.benched.values()).map(|e| e.uid + 1).max().unwrap_or(0)).max(self.heroes.iter().map(|h| h.uid + 1).max().unwrap_or(0));
                                    self.next_uid = uid + 1;
                                    let slot = self.enemy_slots.len() as u32;
                                    let act = Activation { combat_rank: "ordinary", stream_lane: 0, stream_rank: 0, stream_pack_index: 0, stream_sector_index: 0, stream_engagement_group_id: 0, stream_solo: 0, stream_solo_anchor_x: None, stream_solo_anchor_y: None, stream_solo_phase: None, stream_entry_order: 0, stream_delivery: "melee", stream_melee_line: 0, stream_engage_x: 0., stream_walk_speed: 0., x: x as f64, y: y as f64 };
                                    let hp_row = row.hp;
                                    self.enemies.push(EnemyEntity { uid, row, hp: hp_row, max_hp: hp_row, boss: false, slot_index: slot, act, x: x as f64, y: y as f64, rust_actor_id: Some(actor_id) });
                                    self.enemy_slots.push(uid + 1);
                                    HostRef::Enemy(uid)
                                })
                            }
                        }
                    };
                    if let Some(h) = found { self.hosts.insert(actor_id, h); }
                    found
                }
            };
            if let (Some(HostRef::Enemy(uid)), false) = (host, visual_only) {
                if self.enemies.iter().any(|e| e.uid == uid && e.boss) && !self.hosts_seen_boss.contains(&actor_id) { self.hosts_seen_boss.insert(actor_id); self.presentation_events.push(Event::BossArrived { id: actor_id }); }
            }
            match host {
                Some(HostRef::Hero(i)) => { let h = &mut self.heroes[i]; if !visual_only { h.hp = hp as f64; h.max_hp = max_hp as f64; } h.x = x as f64; h.y = y as f64; h.rust_actor_id = Some(actor_id); }
                Some(HostRef::Enemy(uid)) => { if let Some(e) = self.enemies.iter_mut().find(|e| e.uid == uid) { if !visual_only { e.hp = hp as f64; e.max_hp = max_hp as f64; } e.x = x as f64; e.y = y as f64; e.rust_actor_id = Some(actor_id); } }
                None => {}
            }
        }
    }
    fn consume(&mut self, events: Vec<Value>) -> Result<(), String> {
        let snapshot = self.world.as_ref().ok_or("Rust world missing")?.snapshot().clone();
        let (step, last_seq, encounter_id) = { let w = self.world.as_ref().unwrap(); (w.step_number(), w.last_event_sequence(), w.encounter_id().to_string()) };
        // Reward outbox: deaths into the encounter stream, Bag points into the same save.
        let battle_id = self.battle.id.clone();
        let hosts = self.hosts.clone();
        let enemies: Vec<(u32, bool)> = self.enemies.iter().map(|e| (e.uid, e.boss)).collect();
        let resolve = |actor: u32, host_id: Option<&str>| -> Option<(u32, bool)> {
            let uid = match hosts.get(&actor) { Some(HostRef::Enemy(uid)) => Some(*uid), _ => host_id.and_then(|id| id.parse::<u32>().ok()).filter(|uid| enemies.iter().any(|(u, _)| u == uid)) }?;
            if host_id.is_some_and(|id| id != uid.to_string()) { return None; }
            enemies.iter().find(|(u, _)| *u == uid).map(|(u, boss)| (*u, *boss))
        };
        let queued = rewards::consume_batch(&mut self.progress.combat_reward_outbox, &encounter_id, step, last_seq, &events, &battle_id, &resolve)?;
        if !queued.is_empty() { for (id, amount) in queued { self.progress.bag_rewards_mut().insert(id, amount); } self.progress_dirty = true; if !self.persist_progress_if_dirty() { return Err("Combat reward outbox save failed.".into()); } }
        let combat_delta = snapshot.combat_time - self.last_combat_time;
        let presentation_delta = snapshot.time - self.last_presentation_time;
        self.advance_host_time(combat_delta, presentation_delta);
        self.time = self.base_time + snapshot.combat_time;
        self.last_combat_time = snapshot.combat_time;
        self.last_presentation_time = snapshot.time;
        let mut typed = self.world.as_mut().unwrap().drain_typed_events();
        self.presentation_events.append(&mut typed);
        self.last_snapshot = Some(snapshot.clone());
        self.project(&snapshot, false);
        if let Some(err) = self.failed.clone() { return Err(err); }
        if self.stage.boss_active { self.stage.boss_camera_center_x = Some(snapshot.camera_focus.x as f64); }
        let mut boss_killed = false;
        for event in &events {
            let kind = event["body"]["kind"].as_str().unwrap_or("");
            match kind {
                "died" => {
                    let actor = event["body"]["data"]["actor"].as_u64().unwrap_or(0) as u32;
                    if let Some(HostRef::Enemy(uid)) = self.hosts.get(&actor).copied() {
                        if Some(uid) == self.stage.boss_uid { boss_killed = true; }
                        let boss = self.enemies.iter().find(|e| e.uid == uid).map_or(false, |e| e.boss);
                        if let Some(kill) = rewards::consume_combat_kill_event(&mut self.battle, uid, boss) { self.persist_pending_rewards(kill); }
                        if let Some(i) = self.enemies.iter().position(|e| e.uid == uid) {
                            let slot = self.enemies[i].slot_index as usize;
                            self.enemies.remove(i);
                            if slot < self.enemy_slots.len() { self.enemy_slots[slot] = 0; }
                        }
                        self.record_committed_enemy_defeats();
                    }
                }
                "permanent_inputs_applied" => {
                    let actor = event["body"]["data"]["actor"].as_u64().unwrap_or(0) as u32;
                    let revision = event["body"]["data"]["revision"].as_str().unwrap_or("").to_string();
                    let command = event["body"]["data"]["sequence"].as_str().unwrap_or("").to_string();
                    let hero = self.heroes.iter().find(|h| h.rust_actor_id == Some(actor)).map(|h| h.instance_key.clone()).ok_or("Unknown Rust hero revision")?;
                    let acknowledged: u64 = revision.parse().map_err(|_| "Rust revision ack conflict".to_string())?;
                    let state = self.revisions.get(&hero).copied();
                    let submitted = self.submitted_inputs.get(&actor).cloned();
                    if state.is_none() || submitted.as_ref().map(|s| s.0.as_str()) != Some(revision.as_str()) || submitted.as_ref().map(|s| s.1.as_str()) != Some(command.as_str()) || acknowledged > state.unwrap().0 || acknowledged <= state.unwrap().1 { return Err("Rust revision ack conflict".into()); }
                    self.revisions.insert(hero.clone(), (state.unwrap().0, acknowledged));
                    self.submitted_inputs.remove(&actor);
                    if self.pending_inputs.get(&hero).and_then(|p| p["revision"].as_str()) == Some(revision.as_str()) { self.pending_inputs.remove(&hero); }
                }
                "damage" | "spawned" | "downed" | "revived" | "all_down" | "ended" | "despawned" | "presentation" => {}
                other => return Err(format!("Unknown Rust gameplay event: {other}")),
            }
        }
        self.receipt = Receipt { encounter_id: encounter_id.clone(), step, sequence: last_seq, outcome: if boss_killed { "ended".into() } else { self.world.as_ref().map_or("", |w| w.state()).into() },
            seconds: snapshot.combat_time, presentation_seconds: snapshot.time, kills: self.battle.defeated.len(), downed: snapshot.actors.iter().filter(|a| a.team == wf_combat::Team::Hero && a.state == wf_combat::ActorState::Downed).count() };
        let state = self.world.as_ref().map_or("", |w| w.state()).to_string();
        if state == "all_down" {
            if self.stage.boss_active { self.stop(Some(EndReason::AllDownRouted)); self.surrender_boss_attempt("rust_all_down")?; }
            else { self.restart_at_subwave(None)?; }
            return Ok(());
        }
        if boss_killed {
            self.driver_stop(Some(EndReason::HostStageTransition));
            self.restore_host_heroes(true);
            self.enemies.clear();
            for slot in self.enemy_slots.iter_mut() { *slot = 0; }
            self.settle_continuous_combat_rewards();
            let freeze = snapshot.hit_stop.map_or(0., |h| h.remaining as f64).max(0.);
            let mut visual = snapshot.clone();
            visual.hit_stop = None;
            visual.hazards.clear();
            visual.projectiles.clear();
            for a in &mut visual.actors { a.encased = 0.; a.slowed = 0.; }
            self.tail = Some(Tail { ages: visual.actors.iter().map(|a| a.state_age).collect(), visual: visual.clone(), freeze, elapsed: 0., previous_now: Some(self.frame_now_ms), born: snapshot.time, combat_born: snapshot.combat_time, duration: freeze + (BOSS_KO_SECONDS + CORPSE_FADE).max(DEATH_CAMERA_SECONDS) });
            self.last_snapshot = Some(visual.clone());
            self.project(&visual, true);
            return Ok(());
        }
        if !self.host_transition && !self.subwaves.is_empty() {
            let living: BTreeSet<String> = {
                let w = self.world.as_ref().unwrap();
                snapshot.actors.iter().filter(|a| a.team == wf_combat::Team::Enemy && a.hp > 0.).filter_map(|a| w.host_id(a.id).map(|s| s.to_string())).chain(w.pending_spawns().map(|(_, id, _)| id.to_string())).collect()
            };
            let remaining = self.previous_subwave.iter().filter(|uid| living.contains(&uid.to_string())).count();
            if subwaves::subwave_ready(remaining, snapshot.combat_time - self.subwave_started) {
                self.host_transition = true;
                let result = self.release_subwave(snapshot.combat_time);
                self.host_transition = false;
                result?;
                self.subwave_completions += 1;
            }
            return Ok(());
        }
        if self.world.as_ref().is_some_and(|w| w.pending_spawns().next().is_some()) { return Ok(()); }
        let live_enemies = self.world.as_ref().map_or(0, |w| w.live_enemies());
        if !self.host_transition && !self.stage.boss_active && live_enemies == 0 && self.stage.wave.max(1) < stage::waves_for_stage(self.stage.region) {
            let chest = self.world.as_ref().and_then(|w| w.chest().map(|(_, ready)| ready));
            match chest {
                None => { self.host_transition = true; let r = self.driver_wave_chest(); self.host_transition = false; r?; return Ok(()); }
                Some(false) => return Ok(()),
                Some(true) => {}
            }
        }
        if !self.host_transition {
            self.host_transition = true;
            let before_boss = self.stage.boss_active;
            let before_region = self.stage.region;
            let moved = self.maybe_advance_stage(true);
            self.host_transition = false;
            let moved = moved?;
            if moved {
                self.advanced = true;
                if self.stage.boss_active != before_boss || self.stage.region != before_region { self.stop(Some(EndReason::HostStageTransition)); } else { self.spawn_additions()?; }
            }
        }
        Ok(())
    }
    fn advance_host_time(&mut self, dt: f64, active_seconds: f64) {
        self.time += dt;
        if active_seconds > 0. && !self.battle.settled && !self.bag_blocked { self.bag_seconds += active_seconds; }
    }
    fn record_committed_enemy_defeats(&mut self) {
        // COT quest: every defeated uid once per battle (combatProgression.recordCommittedEnemyDefeats).
        let ids: Vec<String> = self.battle.defeated.keys().map(|uid| format!("enemy:{}:{uid}", self.battle.id)).collect();
        for id in ids { (self.quest)(&id, "enemy_defeat"); }
    }
    /// `recordContinuousCombatWavePackProgress`.
    fn record_wave_pack_progress(&mut self) -> bool {
        let s = &self.stage;
        if s.boss_available || s.boss_active || s.spawn_serial == 0 { return false; }
        let saved = stage::normalize_pack_mask(s.cleared_pack_mask);
        let current_pack = s.transitions;
        let mut living_mask = 0u32;
        let mut invalid = false;
        for e in self.enemies.iter().filter(|e| e.alive()) {
            if e.act.stream_pack_index != current_pack || e.act.stream_sector_index / PACKS_PER_WAVE != current_pack { invalid = true; continue; }
            living_mask |= 1 << (e.act.stream_sector_index % PACKS_PER_WAVE);
        }
        let mask = if invalid { saved } else { saved | (stage::normalize_pack_mask(s.spawned_pack_mask) & !living_mask) };
        if mask == saved { return false; }
        self.stage.cleared_pack_mask = mask;
        true
    }
    fn wave_cleared(&self) -> bool { !self.enemies.iter().any(|e| e.alive()) }
    /// `maybeAdvanceContinuousCombatStage` with the runtime's callbacks inlined.
    fn maybe_advance_stage(&mut self, from_consume: bool) -> Result<bool, String> {
        if self.record_wave_pack_progress() { self.progress_dirty = true; }
        if self.stage.boss_active && self.stage.boss_transition_ends_at_ms.is_some_and(|t| t > self.wall_now()) { return Ok(false); }
        if self.heroes.iter().any(|h| self.reveal_active(h)) { return Ok(false); }
        if self.stage.boss_available && !self.stage.boss_active && !self.stage.boss_summon_required && self.time >= self.stage.next_emission_at && !self.intro_active {
            let now = self.wall_now();
            return self.arm_boss(now);
        }
        let now = self.time;
        if self.stage.boss_active && self.stage.boss_timer_started_at.is_none() { self.stage.boss_timer_started_at = Some(now); }
        if self.intro_active { return Ok(false); }
        let current = stage::get_stage(&self.stage);
        let clear = self.wave_cleared();
        let timer_ready = now >= self.stage.next_emission_at;
        if !clear && self.stage.boss_active && stage::boss_time_remaining(&self.stage, now) == Some(0.) && self.enemies.iter().any(|e| Some(e.uid) == self.stage.boss_uid && e.alive()) {
            self.receipt.outcome = "timeout".into();
            self.stop(Some(EndReason::HostTimeout));
            self.surrender_boss_attempt("boss_timeout")?;
            return Ok(false);
        }
        let before = self.stage.clone();
        let transition = if before.boss_active {
            if !clear { return Ok(false); }
            self.settle_continuous_combat_rewards();
            stage::advance_stage(&before)
        } else {
            if !clear || !timer_ready { return Ok(false); }
            stage::advance_stage(&before)
        };
        let entering_boss = transition.state.boss_available && !before.boss_available && !before.boss_summon_required;
        if entering_boss {
            self.stage = transition.state.clone();
            let now_ms = self.wall_now();
            if !self.arm_boss(now_ms)? { return Ok(false); }
        } else if !self.spawn_stage(transition.state.clone())? { return Ok(false); }
        if !before.boss_active && from_consume {
            self.driver_ordinary_clear(format!("{}:{}:{}:{}", before.region, before.stage, before.wave, before.transitions))?;
            for i in 0..self.heroes.len() { self.save_hero_progress(i); }
            self.progress_dirty = true;
        }
        if transition.cleared_boss.is_some() {
            self.presentation_events.push(Event::StageCleared);
            let revived = self.heroes.iter().any(|h| !h.alive());
            for h in &mut self.heroes { h.hp = h.max_hp; if !revived { h.recovery_fade_started_at = None; } }
            for i in 0..self.heroes.len() { self.save_hero_progress(i); }
            if revived { self.place_recovery_huddle(); }
            self.progress_dirty = true;
        }
        self.last_transition = Some((current.id, stage::get_stage(&self.stage).id, now));
        if !before.boss_active { self.wave_clear_events.push(stage::wave_clear_event_id(&before)); }
        if !before.boss_active || transition.cleared_boss.is_some() { self.subwave_completions += 1; }
        Ok(true)
    }
    fn place_recovery_huddle(&mut self) {
        let formation = geometry::start_formation(self.heroes.len());
        let patrol = geometry::ordinary_patrol_bounds();
        let center_y = (patrol.min_y + patrol.max_y) / 2.;
        let slots = geometry::hero_formation_slots();
        let now = self.time;
        for (i, h) in self.heroes.iter_mut().enumerate() {
            let (sx, sy) = slots[i.min(7)];
            h.x = formation.center_x + sx;
            h.y = center_y + sy;
            h.recovery_fade_started_at = Some(now);
        }
    }
    /// `Date.now()` in JS: the current frame's wall clock, valid between attempts too.
    fn wall_now(&self) -> f64 { self.frame_now_ms }

    /// `restartAtSubwave(index)`: D17′ ordinary AllDown and reload share one restart.
    pub fn restart_at_subwave(&mut self, index: Option<u32>) -> Result<bool, String> {
        if self.stage.boss_active || self.failed.is_some() || self.storage_error.is_some() { return Ok(false); }
        self.ensure_checkpoint();
        let progress = self.subwave_progress();
        let index = index.unwrap_or(progress.index);
        let plan_state = StageState { cleared_pack_mask: progress.entry_pack_mask, ..self.stage.clone() };
        let plan = stage::build_spawn_plan(&self.enemy_data, &plan_state, 0, progress.party_cp, self.enemy_size)?;
        let names: Vec<String> = plan.iter().map(|e| e.row.name.clone()).collect();
        let groups = subwaves::bind_authored_subwaves(&subwaves::author_subwaves(&names), &names)?;
        if index as usize >= groups.len().max(1) { return Err(format!("WFM_CHECKPOINT_INCOMPATIBLE: invalid subwave index {index}")); }
        self.stop(Some(EndReason::HostStageTransition));
        self.enemies.clear();
        self.benched.clear();
        for slot in self.enemy_slots.iter_mut() { *slot = 0; }
        self.stage.spawn_serial = plan.len() as u32;
        self.stage.spawned_pack_mask = plan.iter().fold(0, |m, e| m | (1 << e.sector_index));
        let remaining = groups[index as usize..].iter().flatten().fold(0u32, |m, &i| m | (1 << plan[i].sector_index));
        self.stage.cleared_pack_mask = progress.entry_pack_mask | (self.stage.spawned_pack_mask & !remaining);
        self.stage.next_emission_at = self.time + PACK_INTERVAL_SEC;
        if let Some(cp) = &mut self.checkpoint { cp.subwaves = Some(SubwaveProgress { index, ..progress }); }
        self.wfm_checkpoint_reload = true;
        self.save_checkpoint()?;
        self.pending_restart = Some(plan);
        Ok(true)
    }
    /// `prepareSubwaves(enemies)`: authors subwaves for the given entities, benches later groups.
    fn prepare_subwaves(&mut self, uids: Vec<u32>) -> Result<Vec<u32>, String> {
        let progress = if self.stage.boss_active { None } else { Some(self.subwave_progress()) };
        if let (Some(p), Some(cp)) = (&progress, &mut self.checkpoint) { cp.subwaves = Some(p.clone()); }
        if uids.is_empty() { self.subwaves.clear(); self.previous_subwave.clear(); return Ok(Vec::new()); }
        let names: Vec<String> = uids.iter().map(|uid| self.enemies.iter().find(|e| e.uid == *uid).map(|e| e.row.name.clone()).unwrap_or_default()).collect();
        let groups: Vec<Vec<u32>> = if self.stage.boss_active { vec![uids.clone()] } else { subwaves::bind_authored_subwaves(&subwaves::author_subwaves(&names), &names)?.into_iter().map(|g| g.into_iter().map(|i| uids[i]).collect()).collect() };
        let index = progress.as_ref().map_or(0, |p| p.index) as usize;
        if index >= groups.len() { return Err(format!("WFM_CHECKPOINT_INCOMPATIBLE: subwave index {index} exceeds authored plan")); }
        self.subwaves = groups[index + 1..].to_vec();
        self.previous_subwave = groups[index].clone();
        self.subwave_started = self.last_combat_time;
        let hidden: BTreeSet<u32> = groups[..index].iter().flatten().chain(self.subwaves.iter().flatten()).copied().collect();
        let mut kept = Vec::new();
        for e in std::mem::take(&mut self.enemies) {
            if hidden.contains(&e.uid) { let slot = e.slot_index as usize; if slot < self.enemy_slots.len() { self.enemy_slots[slot] = 0; } self.benched.insert(e.uid, e); } else { kept.push(e); }
        }
        self.enemies = kept;
        for uid in &uids { self.seen_spawns.insert(uid.to_string()); }
        Ok(self.previous_subwave.clone())
    }
    fn release_subwave(&mut self, now: f64) -> Result<(), String> {
        if let Some(cp) = &mut self.checkpoint { if let Some(p) = &mut cp.subwaves { p.index += 1; } }
        self.save_checkpoint()?;
        if self.subwaves.is_empty() { return Ok(()); }
        self.previous_subwave = self.subwaves.remove(0);
        self.subwave_started = now;
        let mut batch = Vec::new();
        for uid in self.previous_subwave.clone() {
            if let Some(e) = self.benched.remove(&uid) {
                let slot = e.slot_index as usize;
                if self.enemy_slots.len() <= slot { self.enemy_slots.resize(slot + 1, 0); }
                self.enemy_slots[slot] = e.uid + 1;
                self.enemies.push(e);
            }
            if let Some(e) = self.enemies.iter().find(|e| e.uid == uid) { batch.push(self.enemy_input(e)?); }
        }
        self.driver_spawn(batch)
    }
    fn spawn_additions(&mut self) -> Result<(), String> {
        let additions: Vec<u32> = self.enemies.iter().filter(|e| e.rust_actor_id.is_none() && e.alive() && !self.seen_spawns.contains(&e.uid.to_string())).map(|e| e.uid).collect();
        if additions.is_empty() { return Ok(()); }
        let batch = self.prepare_subwaves(additions)?;
        let mut inputs = Vec::new();
        for uid in batch { if let Some(e) = self.enemies.iter().find(|e| e.uid == uid) { inputs.push(self.enemy_input(e)?); } }
        self.driver_spawn(inputs)
    }
    fn start_attempt(&mut self, key: String) -> Result<(), String> {
        let restart = self.pending_restart.take();
        self.stop(Some(EndReason::HostStageTransition));
        self.attempt = Some(key);
        self.base_time = self.time;
        self.last_combat_time = 0.;
        self.last_presentation_time = 0.;
        for h in &mut self.heroes { h.bound_max_hp = Some(h.max_hp); }
        self.settle_pending_receipts()?;
        self.ensure_checkpoint();
        if let Some(plan) = restart { for entry in &plan { self.spawn_entry(entry, false, None)?; } }
        if self.wfm_checkpoint_reload { self.stage.boss_timer_started_at = None; }
        let alive: Vec<u32> = self.enemies.iter().filter(|e| e.alive()).map(|e| e.uid).collect();
        self.prepare_subwaves(alive)?;
        self.save_checkpoint()?;
        self.encounter_counter += 1;
        let encounter_id = format!("rust:{}:{}:{}", self.checkpoint.as_ref().map_or("", |c| c.id.as_str()), self.combat_session_id, self.encounter_counter);
        let hero_hosts: Vec<HeroHost> = self.heroes.iter().map(HeroActor::host).collect();
        let enemy_hosts: Vec<EnemyHost> = self.enemies.iter().filter(|e| e.alive()).map(EnemyEntity::host).collect();
        let stars = self.stars.clone();
        let star_of = move |key: &str| hero::canonical_growth_id(key).and_then(|id| stars.get(id).copied()).unwrap_or(0);
        let mut config = wfm_config::create_wfm_combat_config(&self.stage, &hero_hosts, &enemy_hosts, &self.enemy_data, &self.raw_rows, &encounter_id, self.wfm_checkpoint_reload, self.training, &star_of)?;
        config.spawn_markers = Some(!self.stage.boss_active);
        if self.stage.boss_active && !config.enemies.iter().any(|e| Some(e.spawn_key.as_str()) == self.stage.boss_uid.map(|u| u.to_string()).as_deref()) { return Err("Missing WFM boss spawn".into()); }
        for e in &config.enemies { self.seen_spawns.insert(e.spawn_key.clone()); }
        rewards::begin_encounter(&mut self.progress.combat_reward_outbox, &encounter_id)?;
        self.progress_dirty = true;
        if !self.persist_progress_if_dirty() { return Err("Combat reward outbox save failed.".into()); }
        let config_json = config.to_json();
        // driver.start seeds the desired permanent-input signature per hero from the config.
        self.desired_inputs.clear();
        for hero in config_json["heroes"].as_array().into_iter().flatten() { self.desired_inputs.insert(hero["instance_id"].as_str().unwrap_or("").to_string(), serde_json::to_string(&serde_json::json!({ "stats": hero["stats"], "host_max_hp": hero["host_max_hp"], "skill_modifiers": hero["skill_modifiers"] })).unwrap()); }
        let encounter: EncounterConfig = serde_json::from_value(config_json).map_err(|e| e.to_string())?;
        self.driver_start(encounter)?;
        if self.world.is_some() { self.wfm_checkpoint_reload = false; }
        Ok(())
    }
    /// `queuePermanentInputs(heroId)`: live heroes re-read their saved record (level, stats,
    /// equipment) and the Rust world receives a permanent-input revision on the next step.
    pub fn queue_permanent_inputs(&mut self, hero_key: Option<&str>) -> Result<(), String> {
        if self.world.is_none() { return Ok(()); }
        for i in 0..self.heroes.len() {
            if hero_key.is_some_and(|k| k != self.heroes[i].instance_key) { continue; }
            if self.heroes[i].bound_max_hp.is_none() { continue; }
            if let Some(source) = self.progress.heroes.get(&self.heroes[i].instance_key) {
                self.heroes[i].level = source.current_level;
                self.heroes[i].stats = source.stats;
                self.heroes[i].combat_base_max_hp = source.combat_base_max_hp.unwrap_or(source.max_hp);
            }
            let stars = self.stars.clone();
            let star = hero::canonical_growth_id(&self.heroes[i].instance_key).and_then(|id| stars.get(id).copied()).unwrap_or(0);
            let inputs = wfm_config::hero_permanent(&self.heroes[i].host(), self.training, star)?;
            self.heroes[i].bound_max_hp = Some(inputs.host_max_hp);
            let key = self.heroes[i].instance_key.clone();
            let actor = self.heroes[i].rust_actor_id.ok_or_else(|| format!("Unknown Rust hero: {key}"))?;
            let value = serde_json::json!({ "stats": serde_json::to_value(&inputs.stats).unwrap(), "host_max_hp": inputs.host_max_hp, "skill_modifiers": serde_json::to_value(&inputs.skill_modifiers).unwrap() });
            let signature = serde_json::to_string(&value).unwrap();
            if self.desired_inputs.get(&key) == Some(&signature) { continue; }
            self.desired_inputs.insert(key.clone(), signature);
            let base = self.world.as_ref().and_then(|w| w.permanent_revision(actor)).unwrap_or(0);
            let (issued, acknowledged) = self.revisions.get(&key).copied().map_or((base + 1, base), |(i, a)| (i + 1, a));
            self.revisions.insert(key.clone(), (issued, acknowledged));
            let mut data = value;
            data["actor"] = serde_json::json!(actor);
            data["expected_revision"] = serde_json::json!(acknowledged.to_string());
            data["revision"] = serde_json::json!(issued.to_string());
            self.pending_inputs.insert(key, data);
        }
        Ok(())
    }
    pub fn battle_settled(&self) -> bool { self.battle.settled }
    fn tick_frame(&mut self, now_ms: f64) -> Result<bool, String> {
        self.frame_now_ms = now_ms;
        self.advanced = false;
        if let Some(err) = &self.failed { return Err(err.clone()); }
        if let Some(err) = &self.storage_error { return Err(err.clone()); }
        if self.tail.is_some() { return self.advance_tail(now_ms); }
        if self.wfm_checkpoint_reload && !self.stage.boss_active && self.pending_restart.is_none() { self.restart_at_subwave(None)?; }
        if self.intro_active || self.heroes.iter().any(|h| self.reveal_active(h)) {
            let dt = match self.intro_now { None => 0.001, Some(prev) => ((now_ms - prev) / 1000.).clamp(0., 0.05) };
            self.intro_now = Some(now_ms);
            self.advance_host_time(dt, dt);
            return Ok(false);
        }
        self.intro_now = None;
        if self.stage.boss_transition_ends_at_ms.is_some_and(|t| t > now_ms) { self.driver_advance(now_ms, true, 1.)?; return Ok(false); }
        let key = format!("{}:{}:{}:{}:{:?}:{}", self.combat_session_id, self.stage.region, self.stage.stage, self.stage.boss_active, self.stage.boss_uid, self.stage.defeat_recoveries);
        if self.attempt.as_ref() != Some(&key) {
            if let Err(e) = self.start_attempt(key) { self.finish_failure(e.clone()); return Ok(false); }
        }
        self.spawn_additions()?;
        self.driver_advance(now_ms, false, self.dev_speed)?;
        Ok(self.advanced)
    }
    /// One host frame. Returns true when the stage advanced this frame.
    pub fn tick(&mut self, now_ms: f64) -> bool {
        let result = match self.tick_frame(now_ms) {
            Ok(advanced) => advanced,
            Err(error) => { self.stop(None); self.finish_failure(error); false }
        };
        self.sync_stage_view();
        result
    }
    fn advance_tail(&mut self, now_ms: f64) -> Result<bool, String> {
        let Some(tail) = self.tail.as_mut() else { return Ok(false) };
        let dt = tail.previous_now.map_or(0., |p| ((now_ms - p) / 1000.).max(0.));
        tail.previous_now = Some(now_ms);
        tail.elapsed += dt;
        let age = (tail.duration.min(tail.elapsed) - tail.freeze).max(0.);
        let mut visual = tail.visual.clone();
        visual.time = tail.born + age;
        visual.combat_time = tail.combat_born + age;
        for (i, a) in visual.actors.iter_mut().enumerate() { a.state_age = tail.ages[i] + age as f32; }
        let done = tail.elapsed + 1e-9 >= tail.duration;
        self.advance_host_time(dt, dt);
        self.last_snapshot = Some(visual.clone());
        self.project(&visual, true);
        if !done { return Ok(false); }
        self.stop(Some(EndReason::HostStageTransition));
        self.maybe_advance_stage(false)
    }
    /// `dispose()`: ends and destroys any live world and releases hero bindings.
    pub fn dispose(&mut self) { self.stop(Some(EndReason::HostStageTransition)); }
    pub fn pause(&mut self) { self.intro_now = None; if let Some(t) = &mut self.tail { t.previous_now = None; } self.previous_now = None; self.debt = 0.; }

    // ---- questCombatSession ----
    fn reset_session_conditions(&mut self) {}
    fn restore_heroes_to_full_hp(&mut self) -> Result<(), String> {
        if self.heroes.iter().any(|h| h.bound_max_hp.is_some()) { return Err("HP restoration not supported in Rust encounters; stop the encounter first".into()); }
        let now = self.time;
        for h in &mut self.heroes { h.hp = h.max_hp; h.recovery_fade_started_at = None; let _ = now; }
        Ok(())
    }
    pub fn surrender_boss_attempt(&mut self, reason: &str) -> Result<bool, String> {
        if !self.stage.boss_active { return Ok(false); }
        let mut boss_uids: BTreeSet<String> = self.enemies.iter().filter(|e| e.boss).map(|e| e.uid.to_string()).collect();
        if let Some(uid) = self.stage.boss_uid.filter(|u| *u > 0) { boss_uids.insert(uid.to_string()); }
        if reason == "boss_timeout" {
            let boss = self.enemies.iter().find(|e| Some(e.uid) == self.stage.boss_uid);
            self.stage.last_boss_timeout = Some(serde_json::json!({ "time": self.time, "elapsedSec": (self.time - self.stage.boss_timer_started_at.unwrap_or(0.)).max(0.), "timeLimitSec": BOSS_TIME_LIMIT_SEC,
                "bossHp": boss.map_or(0., |b| b.hp), "bossMaxHp": boss.map_or(0., |b| b.max_hp), "heroes": self.heroes.iter().map(|h| serde_json::json!({"uid": h.uid, "name": h.definition.key, "hp": h.hp, "maxHp": h.max_hp})).collect::<Vec<_>>() }));
        }
        let mut removed = false;
        for uid in &boss_uids { removed |= self.battle.defeated.remove(uid).is_some(); removed |= self.battle.defeated_gold.remove(uid).is_some(); }
        if removed { self.persist_pending_rewards(None); }
        self.stage.boss_uid = None;
        self.reset_session_conditions();
        self.stage.boss_summon_required = true;
        if reason == "boss_timeout" { self.stage.boss_timeouts += 1; self.stage.last_boss_outcome = Some("timeout".into()); }
        self.recover_continuous_defeat(reason)
    }
    pub fn recover_continuous_defeat(&mut self, _reason: &str) -> Result<bool, String> {
        if self.record_wave_pack_progress() { self.progress_dirty = true; }
        self.settle_continuous_combat_rewards();
        self.reset_session_conditions();
        self.enemies.clear();
        self.benched.clear();
        self.enemy_slots.clear();
        self.stage = stage::reset_after_defeat(&self.stage, self.time);
        self.progress_dirty = true;
        self.restore_heroes_to_full_hp()?;
        self.place_recovery_huddle();
        let plan = if self.stage.boss_available && !self.stage.boss_summon_required { Vec::new() } else { stage::build_spawn_plan(&self.enemy_data, &self.stage, 0, self.party_cp(), self.enemy_size)? };
        self.stage.spawn_serial = plan.len() as u32;
        self.stage.spawned_pack_mask = plan.iter().fold(0, |m, e| m | (1 << e.sector_index));
        for entry in &plan { self.spawn_entry(entry, false, None)?; }
        self.quest_finite_encounter = true;
        self.next_uid = self.heroes.iter().map(|h| h.uid).chain(self.enemies.iter().map(|e| e.uid)).max().unwrap_or(0) + 1;
        Ok(true)
    }
    /// `restoreHostHeroes` + checkpoint surrender when the player leaves combat (boss active).
    pub fn surrender_for_departure(&mut self) -> Result<bool, String> {
        if !self.stage.boss_active { self.pause(); return Ok(false); }
        self.stop(Some(EndReason::HostStageTransition));
        if !self.surrender_boss_attempt("boss_surrender")? { return Ok(false); }
        self.persist_progress_if_dirty();
        Ok(true)
    }
    pub fn boss_control_state(&self) -> &'static str { stage::boss_control_state(&self.stage) }
    pub fn boss_time_remaining(&self) -> Option<f64> { stage::boss_time_remaining(&self.stage, self.time) }
    pub fn pack_progress(&self) -> (u32, u32) {
        let packs = stage::packs_for_stage(self.stage.region);
        if self.stage.boss_available || self.stage.boss_active { return (packs, packs); }
        let mask = stage::normalize_pack_mask(self.stage.cleared_pack_mask) & stage::active_pack_mask(self.stage.region);
        ((0..PACKS_PER_WAVE).filter(|i| mask & (1 << i) != 0).count() as u32, packs)
    }
}

impl crate::equipment::LampHost for Session {
    fn progress(&mut self) -> &mut HeroProgressStore { &mut self.progress }
    fn gold_total(&self) -> f64 { self.gold_total }
    fn set_gold_total(&mut self, gold: f64) { self.gold_total = gold; }
    fn pending_gold_settlements(&mut self) -> &mut BTreeMap<String, f64> { &mut self.pending_gold_settlements }
    fn progress_storage_error(&self) -> bool { self.storage_error.is_some() }
    fn persist_progress(&mut self) -> bool { self.progress_dirty = true; self.persist_progress_if_dirty() }
    fn live_hero_keys(&self) -> Vec<String> { self.heroes.iter().filter(|h| h.bound_max_hp.is_some() && h.rust_actor_id.is_some()).map(|h| h.instance_key.clone()).collect() }
    fn revise_hero(&mut self, instance_key: &str) { if let Err(e) = self.queue_permanent_inputs(Some(instance_key)) { self.finish_failure(e); } }
    fn stage_context(&self) -> (f64, f64) { (self.stage.region as f64, self.stage.stage as f64) }
}

impl crate::progression::QuestHost for Session {
    fn quest_heroes(&self) -> Vec<wf_meta::progression::QuestHero> {
        self.heroes.iter().map(|h| wf_meta::progression::QuestHero { instance_key: h.instance_key.clone(), base_hero_name: h.definition.key.to_string(), current_level: h.level, max_level: self.progress.heroes.get(&h.instance_key).map_or(hero::MAX_LEVEL, |p| p.max_level), hp: h.hp }).collect()
    }
    fn quest_stage(&self) -> (Option<u32>, bool) { if self.stage_configured { (Some(self.stage.region), self.stage.boss_active) } else { (None, false) } }
    fn permanent_inputs(&mut self, hero: Option<&str>) { if let Err(e) = self.queue_permanent_inputs(hero) { self.finish_failure(e); } }
    fn apply_growth(&mut self, training: wf_meta::progression::Training, stars: BTreeMap<String, u32>) { self.training = Some(training.to_hero_training()); self.stars = stars; }
}
