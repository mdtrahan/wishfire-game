//! The live game over `wf_host::Session`: save load, party, combat pacing and the client bridge.
use crate::platform;
use wf_combat::{Event, Snapshot};
use std::cell::RefCell;
use std::rc::Rc;
use wf_host::progression::{CombatProgression, SpendOutcome};
use wf_host::equipment::{EquipmentStorage, Storage};
use wf_host::progress::HeroProgressStore;
use wf_host::session::Session;
use wf_meta::enemy::{parse_c2_table, RawRow};

pub const HERO_PROGRESS_SAVE_KEY: &str = "orka.hero_progress.v2";
const PARTY: [(&str, &str); 4] = [("Falie", "falie#1"), ("Huun", "huun#1"), ("Runa", "runa#1"), ("Kojonn", "kojonn#1")];

pub struct Game {
    pub session: Session,
    /// `createCombatProgression(...)`: the COT quest system over the same browser storage.
    pub progression: CombatProgression,
    /// `onGearCollected` acknowledgements waiting for `record(gear:<id>)` on the next frame.
    gear_events: Rc<RefCell<Vec<String>>>,
    pub save_error: Option<String>,
    /// `createEquipmentStorage(...)`: the lamp/bag economy over the same browser storage.
    pub economy: EquipmentStorage,
}
struct LocalStorage;
impl Storage for LocalStorage {
    fn get(&self, key: &str) -> Option<String> { platform::storage_get(key) }
    fn set(&mut self, key: &str, value: &str) -> Result<(), String> { if platform::storage_set(key, value) { Ok(()) } else { Err("Lamp save could not be written.".into()) } }
    fn remove(&mut self, key: &str) { let _ = platform::storage_remove(key); }
}
struct SessionStorage;
impl Storage for SessionStorage {
    fn get(&self, key: &str) -> Option<String> { platform::session_get(key) }
    fn set(&mut self, key: &str, value: &str) -> Result<(), String> { if platform::session_set(key, value) { Ok(()) } else { Err("Lamp checkpoint could not be written.".into()) } }
    fn remove(&mut self, key: &str) { let _ = platform::session_remove(key); }
}
fn new_economy() -> EquipmentStorage { EquipmentStorage::new(Box::new(LocalStorage), Some(Box::new(SessionStorage)), Box::new(platform::epoch_ms), Box::new(platform::random_u32)) }
/// `restoreHeroProgressFromStorage`: the saved store, or a fresh one; save failures stay visible.
pub fn load_store() -> (HeroProgressStore, Option<String>) {
    match platform::storage_get(HERO_PROGRESS_SAVE_KEY) {
        // createHeroProgressStore(JSON.parse(raw)): normalizes any JS or Rust save; a corrupt checkpoint
        // or outbox is a storage error (JS keeps the original save and plays fresh).
        Some(json) => match serde_json::from_str::<serde_json::Value>(&json).map_err(|e| e.to_string()).and_then(|v| HeroProgressStore::from_snapshot(Some(&v))) { Ok(store) => (store, None), Err(e) => (HeroProgressStore::fresh(), Some(e)) },
        None => (HeroProgressStore::fresh(), None),
    }
}
pub fn persist(store: &HeroProgressStore) -> bool {
    match serde_json::to_string(store) { Ok(json) => platform::storage_set(HERO_PROGRESS_SAVE_KEY, &json), Err(_) => false }
}
/// Fresh encounters draw a seed per boot (generateEncounterSeed lineage); checkpoints keep theirs.
fn fresh_seed() -> u32 {
    let t = (macroquad::miniquad::date::now() * 1000.) as u64;
    let mixed = ((t ^ (t >> 29)).wrapping_mul(0x9E37_79B9_7F4A_7C15) >> 32) as u32;
    if mixed == 0 { 1 } else { mixed }
}
impl Game {
    pub fn new(rows: Vec<RawRow>, seed: Option<u32>) -> Self {
        let (store, save_error) = load_store();
        let session_id = 1;
        let seed = seed.unwrap_or_else(fresh_seed);
        // Encounter and reward-lineage ids must differ across boots (the JS host used UUIDs).
        let salt = (macroquad::miniquad::date::now() * 1000.) as u64;
        let party: Vec<(&str, &str)> = party_members().into_iter().filter(|m| m.2).map(|m| (m.0, m.1)).collect();
        let mut session = Session::new(seed, rows, store, &party, &format!("s{session_id}-{salt:x}"), 1, Box::new(persist), Box::new(|_, _| {}));
        let mut economy = new_economy();
        let gear_events: Rc<RefCell<Vec<String>>> = Rc::new(RefCell::new(Vec::new()));
        let queue = gear_events.clone();
        economy.on_gear_collected = Some(Box::new(move |item| { queue.borrow_mut().push(item.instance_id.clone()); true }));
        // app.js boot: the equipment economy syncs right after the hero progress restore, then the
        // quest system boots (ensure, reconcile ticket spends, settle Essence receipts).
        let _ = economy.sync(&mut session);
        let mut progression = CombatProgression::new(Box::new(LocalStorage), Box::new(platform::epoch_ms));
        progression.boot(&mut session, &mut economy);
        Game { session, save_error, economy, progression, gear_events }
    }
    // ---- Dev Tools (`ui/dev.rs`): developer changes to the saves and the live session ----
    /// `applyDeveloperLevel`: every saved hero at `level` with EXP 0 (the lamp's party EXP stays
    /// claimed), saved; the caller rebuilds the session from the save.
    pub fn dev_level(&mut self, level: u32) -> Result<(), String> {
        let bank = self.economy.data().map_or(0., |d| d.party_exp);
        self.session.progress.set_level(level.clamp(1, wf_meta::hero::MAX_LEVEL), bank)?;
        if persist(&self.session.progress) { Ok(()) } else { Err("The progression preset could not be saved.".into()) }
    }
    pub fn party_level(&self) -> u32 { self.session.heroes.first().map_or(1, |h| h.level) }
    /// Jump to a chapter and wave (or that chapter's boss): ends the encounter, rewrites the
    /// saved stage checkpoint; the caller rebuilds the session from the save and, for a boss,
    /// summons it.
    pub fn dev_stage(&mut self, region: u32, wave: u32, boss: bool) -> Result<(u32, u32), String> {
        use wf_meta::stage;
        let region = region.max(1);
        let waves = stage::waves_for_stage(region);
        let wave = if boss { waves } else { wave.clamp(1, waves) };
        let mut probe = stage::create_stage_state(self.session.stage.seed as f64, region, 1);
        probe.wave = wave;
        if !stage::build_spawn_plan(&self.session.enemy_data, &probe, 0, 1., self.session.enemy_size).is_ok_and(|plan| !plan.is_empty()) { return Err(format!("Chapter {region} has no combat data yet.")); }
        self.session.dispose();
        let Some(checkpoint) = self.session.progress.continuous_stage.as_mut() else { return Err("No stage checkpoint to move.".into()) };
        checkpoint.region = region; checkpoint.stage = 1; checkpoint.wave = wave;
        checkpoint.boss_available = boss; checkpoint.boss_summon_required = boss;
        checkpoint.boss_uid = None; checkpoint.cleared_pack_mask = None; checkpoint.seed = None; checkpoint.transitions = None; checkpoint.combat_checkpoint = None;
        if persist(&self.session.progress) { Ok((region, wave)) } else { Err("The stage could not be saved.".into()) }
    }
    /// Gold straight into the wallet; the lamp save takes it through the usual sync.
    /// Heroes a ticket drop can be for (below max level).
    pub fn ticket_heroes(&self) -> Vec<wf_meta::progression::TicketHero> {
        use wf_host::progression::QuestHost;
        wf_meta::progression::eligible_ticket_heroes(&self.session.quest_heroes())
    }
    /// A resource drop was picked up on the battlefield (`ui/orbs.rs`).
    pub fn award_loot(&mut self, loot: &crate::ui::orbs::Loot) -> Result<(), String> {
        use crate::ui::orbs::Loot;
        match loot {
            Loot::Gold(amount) => { self.session.gold_total += amount; self.economy.sync(&mut self.session) }
            Loot::Essence(amount) => self.economy.grant_essence(&mut self.session, *amount).map(|_| ()),
            Loot::Ticket { hero_id, .. } => self.progression.grant_hero_ticket(hero_id, &mut self.session, &self.economy).map(|_| ()),
        }
    }
    pub fn dev_gold(&mut self, amount: f64) -> Result<(), String> { self.session.gold_total += amount; self.economy.sync(&mut self.session) }
    /// Essence through the combat-reward receipt path (so Bag progress sees it like any other).
    pub fn dev_essence(&mut self, amount: f64) -> Result<(), String> {
        let id = format!("dev:{}:{}", platform::epoch_ms() as u64, platform::random_u32());
        self.economy.award_combat_essence(&mut self.session, &id, amount).map(|_| ())
    }
    pub fn dev_incense(&mut self, amount: f64) -> Result<(), String> { self.progression.dev_grant_incense(amount, &mut self.session, &self.economy).map(|_| ()) }
    /// Removes every uncollected orb from the save (the field forgets them next frame).
    pub fn dev_clear_orbs(&mut self) -> Result<(), String> { self.economy.transact(&mut self.session, |next, _| { next.set_orbs(Vec::new()); Ok(()) }) }
    pub fn tick(&mut self, now_ms: f64) -> bool {
        // app.js frame: observe quest milestones, tick the host, then record the combat events.
        self.progression.observe(&mut self.session, &mut self.economy);
        let moved = self.session.tick(now_ms);
        // combatHostClock: active combat seconds mint Bag progress receipts on the battle ledger.
        let pending = self.session.progress.pending_bag_kill_rewards.clone().unwrap_or_default();
        let battle_id = self.session.battle_id().to_string();
        match self.economy.advance_bag_clock(&battle_id, self.session.bag_seconds, self.session.battle_settled(), &pending) {
            Ok(rewards) => for reward in rewards { self.session.persist_pending_rewards(Some((reward.id, reward.amount))); },
            Err(error) => self.economy.error = Some(error),
        }
        // Pending kill receipts and gold deltas reach the lamp save through sync().
        if self.economy_needs_sync() { let _ = self.economy.sync(&mut self.session); }
        let battle = self.session.battle.clone();
        self.progression.record_committed_enemy_defeats(&battle, &mut self.session, &mut self.economy);
        for id in std::mem::take(&mut self.session.wave_clear_events) { let _ = self.progression.record(&id, "wave_clear", None, &mut self.session, &mut self.economy); }
        let gear: Vec<String> = std::mem::take(&mut *self.gear_events.borrow_mut());
        for id in gear { let _ = self.progression.record(&format!("gear:{id}"), "gear_collect", None, &mut self.session, &mut self.economy); }
        moved
    }
    pub fn claim_objective(&mut self, id: &str) -> wf_meta::progression::ClaimResult { self.progression.claim(id, &mut self.session, &mut self.economy) }
    pub fn train(&mut self, stat: &str) -> wf_meta::progression::TrainResult { self.progression.train(stat, &mut self.session, &mut self.economy) }
    /// The Hero screen's Level Up: levels the hero's fighting party copy and the saved hero together.
    pub fn spend_level_up(&mut self, hero: &str) -> SpendOutcome {
        let outcome = self.progression.level_up_saved_hero(hero, &mut self.session, &mut self.economy);
        if outcome.ok { if let Err(e) = self.economy.refresh(&mut self.session) { self.save_error = Some(e); } }
        outcome
    }
    pub fn star_up(&mut self, hero: &str) -> wf_meta::progression::StarUpResult { self.progression.star_up(hero, &mut self.session) }
    fn economy_needs_sync(&self) -> bool {
        self.session.progress.pending_bag_kill_rewards.as_ref().is_some_and(|p| !p.is_empty()) || self.economy.data().is_none_or(|d| d.gold != self.session.gold_total)
    }
    pub fn snapshot(&self) -> Option<&Snapshot> { self.session.last_snapshot.as_ref() }
    pub fn drain_events(&mut self) -> Vec<Event> { std::mem::take(&mut self.session.presentation_events) }
    pub fn drain_steps(&mut self) -> Vec<(Snapshot, Snapshot)> { std::mem::take(&mut self.session.step_observations) }
    pub fn alpha(&self) -> f32 { self.session.alpha() }
}
/// Every save this game writes (hero progress, quests, the equipment economy and its older
/// versions).
const GAME_SAVE_KEYS: [&str; 9] = [HERO_PROGRESS_SAVE_KEY, wf_meta::progression::SAVE_KEY, wf_host::equipment::EQUIPMENT_SAVE_KEY, wf_host::equipment::BAG_UPGRADE_BACKUP_KEY,
    "wishfire.equipment-economy.v4", "wishfire.equipment-economy.v3", "wishfire.equipment-economy.v2", "wishfire.equipment-economy.v1", "wishfire.gold.v1"];
pub const RESET_BACKUP_KEY: &str = "wishfire.qa.reset-backup.v1";
thread_local! { static BENCHED: std::cell::Cell<u8> = const { std::cell::Cell::new(0) }; }
/// The roster: (definition key, instance key, in the party). Dev Tools can bench members for
/// this page session; the next session is built from whoever is in.
pub fn party_members() -> Vec<(&'static str, &'static str, bool)> {
    let benched = BENCHED.with(|b| b.get());
    PARTY.iter().enumerate().map(|(i, (key, instance))| (*key, *instance, benched & (1 << i) == 0)).collect()
}
/// Benches or returns roster member `index`; the last member in the party stays. Returns
/// whether anything changed.
pub fn toggle_member(index: usize) -> bool {
    if index >= PARTY.len() { return false; }
    let next = BENCHED.with(|b| b.get()) ^ (1 << index);
    if next.count_ones() as usize >= PARTY.len() { return false; }
    BENCHED.with(|b| b.set(next));
    true
}
pub fn has_reset_snapshot() -> bool { platform::storage_get(RESET_BACKUP_KEY).is_some() }
/// Puts the saves of the last RESET GAME snapshot back (current saves are replaced).
pub fn restore_saves() -> Result<usize, String> {
    let raw = platform::storage_get(RESET_BACKUP_KEY).ok_or("There is no recovery snapshot.")?;
    let saved: serde_json::Map<String, serde_json::Value> = serde_json::from_str(&raw).map_err(|e| format!("The recovery snapshot is unreadable: {e}"))?;
    for key in GAME_SAVE_KEYS { let _ = platform::storage_remove(key); }
    let mut restored = 0;
    for (key, value) in &saved { if let (true, Some(text)) = (GAME_SAVE_KEYS.contains(&key.as_str()), value.as_str()) { if platform::storage_set(key, text) { restored += 1; } } }
    Ok(restored)
}
/// `resetDeveloperGame`: keeps a recoverable snapshot of this game's saves under
/// `RESET_BACKUP_KEY`, then removes them. Returns how many saves were cleared.
pub fn reset_saves() -> Result<usize, String> {
    let saved: serde_json::Map<String, serde_json::Value> = GAME_SAVE_KEYS.iter().filter_map(|key| platform::storage_get(key).map(|value| (key.to_string(), serde_json::Value::String(value)))).collect();
    if !platform::storage_set(RESET_BACKUP_KEY, &serde_json::Value::Object(saved.clone()).to_string()) { return Err("The recovery snapshot could not be saved; nothing was reset.".into()); }
    for key in saved.keys() { let _ = platform::storage_remove(key); }
    let _ = platform::session_remove(wf_host::equipment::CONVEYOR_CLOCK_KEY);
    Ok(saved.len())
}
pub async fn load_enemy_rows() -> Result<Vec<RawRow>, String> {
    let json = macroquad::file::load_string("data/enemies.json").await.map_err(|e| format!("enemies.json: {e}"))?;
    parse_c2_table(&json)
}
