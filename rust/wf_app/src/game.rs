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
    pub session_id: u32,
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
        let mut session = Session::new(seed, rows, store, &PARTY, &format!("s{session_id}-{salt:x}"), 1, Box::new(persist), Box::new(|_, _| {}));
        let mut economy = new_economy();
        let gear_events: Rc<RefCell<Vec<String>>> = Rc::new(RefCell::new(Vec::new()));
        let queue = gear_events.clone();
        economy.on_gear_collected = Some(Box::new(move |item| { queue.borrow_mut().push(item.instance_id.clone()); true }));
        // app.js boot: the equipment economy syncs right after the hero progress restore, then the
        // quest system boots (ensure, reconcile ticket spends, settle Essence receipts).
        let _ = economy.sync(&mut session);
        let mut progression = CombatProgression::new(Box::new(LocalStorage), Box::new(platform::epoch_ms));
        progression.boot(&mut session, &mut economy);
        Game { session, session_id, save_error, economy, progression, gear_events }
    }
    pub fn restart(&mut self, seed: Option<u32>) {
        self.session.dispose();
        let rows = self.session.raw_rows.clone();
        let _ = platform::storage_remove(HERO_PROGRESS_SAVE_KEY);
        let next = Game::new(rows, seed);
        self.session = next.session;
        self.economy = next.economy;
        self.progression = next.progression;
        self.gear_events = next.gear_events;
        self.session_id += 1;
    }
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
    pub fn spend_level_up(&mut self, hero: &str) -> SpendOutcome { self.progression.spend_level_up(hero, &mut self.session, &mut self.economy) }
    pub fn star_up(&mut self, hero: &str) -> wf_meta::progression::StarUpResult { self.progression.star_up(hero, &mut self.session) }
    fn economy_needs_sync(&self) -> bool {
        self.session.progress.pending_bag_kill_rewards.as_ref().is_some_and(|p| !p.is_empty()) || self.economy.data().is_none_or(|d| d.gold != self.session.gold_total)
    }
    pub fn snapshot(&self) -> Option<&Snapshot> { self.session.last_snapshot.as_ref() }
    pub fn drain_events(&mut self) -> Vec<Event> { std::mem::take(&mut self.session.presentation_events) }
    pub fn drain_steps(&mut self) -> Vec<(Snapshot, Snapshot)> { std::mem::take(&mut self.session.step_observations) }
    pub fn alpha(&self) -> f32 { self.session.alpha() }
}
pub async fn load_enemy_rows() -> Result<Vec<RawRow>, String> {
    let json = macroquad::file::load_string("data/enemies.json").await.map_err(|e| format!("enemies.json: {e}"))?;
    parse_c2_table(&json)
}
