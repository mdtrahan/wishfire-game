//! `web-runner/systems/equipmentStorage.mjs` + `lampHeroRoster.mjs` + the bag tick clock of
//! `combatHostClock.mjs`: one durable lamp record (`wishfire.equipment-economy.v5`), its
//! migrations, every transaction, and the apply pass that feeds equipment stats into hero
//! records and live Rust heroes.
use crate::progress::{HeroProgress, HeroProgressStore};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use wf_meta::combat_power::{compute_combat_power, CpActor};
use wf_meta::equipment::equipment_stats;
use wf_meta::hero;
use wf_meta::lamp::*;

pub const EQUIPMENT_SAVE_KEY: &str = "wishfire.equipment-economy.v5";
pub const BAG_UPGRADE_BACKUP_KEY: &str = "wishfire.equipment-economy.v5.before-bag-upgrades";
pub const CONVEYOR_CLOCK_KEY: &str = "wishfire.equipment-conveyor-clock.v1";
const FOUR_STAT_HP_KEY: &str = "wishfire.equipment-economy.v4";
const PREVIOUS_KEY: &str = "wishfire.equipment-economy.v3";
const DRAFT_KEY: &str = "wishfire.equipment-economy.v2";
const LEGACY_KEY: &str = "wishfire.equipment-economy.v1";
const LEGACY_GOLD_KEY: &str = "wishfire.gold.v1";

/// Key/value storage (localStorage; sessionStorage for the conveyor checkpoint).
pub trait Storage { fn get(&self, key: &str) -> Option<String>; fn set(&mut self, key: &str, value: &str) -> Result<(), String>; fn remove(&mut self, key: &str); }
/// The game state the economy reads and writes (`globals` + hero actors in JS).
pub trait LampHost {
    fn progress(&mut self) -> &mut HeroProgressStore;
    fn gold_total(&self) -> f64;
    fn set_gold_total(&mut self, gold: f64);
    fn pending_gold_settlements(&mut self) -> &mut BTreeMap<String, f64>;
    fn progress_storage_error(&self) -> bool;
    fn persist_progress(&mut self) -> bool;
    /// Live Rust heroes (instance keys) whose saved record changed: revise their permanent inputs.
    fn live_hero_keys(&self) -> Vec<String>;
    fn revise_hero(&mut self, instance_key: &str);
    fn stage_context(&self) -> (f64, f64);
}
/// `lampHeroRoster(progress, {requireComplete})`: the canonical records in party order.
pub fn lamp_hero_roster(progress: &HeroProgressStore, require_complete: bool) -> Result<Vec<LampHero>, String> {
    let mut out = Vec::new();
    let mut missing = false;
    for d in hero::HERO_DEFINITIONS.iter() {
        match progress.heroes.get(d.key).filter(|r| r.hero_instance_key == d.key) { Some(r) => out.push(LampHero { instance_key: d.key.into(), definition: d, level: r.current_level }), None => missing = true }
    }
    if require_complete && missing { return Err("Equipment is unavailable: hero records are missing or invalid. Your gear is preserved.".into()); }
    Ok(out)
}
#[derive(Clone, Debug, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EquipReceipt { pub item: LampItem, pub hero_id: String, pub cp_before: f64, pub cp_after: f64, pub cp_change: f64 }
#[derive(Clone, Debug, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoEquipReceipt { pub items: Vec<LampItem>, pub slots: Vec<String>, pub hero_id: String, pub cp_before: f64, pub cp_after: f64, pub cp_change: f64 }
#[derive(Clone, Debug, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EssenceReceipt { pub applied: bool, #[serde(skip_serializing_if = "Option::is_none")] pub duplicate: Option<bool>, #[serde(skip_serializing_if = "Option::is_none")] pub reason: Option<String>, #[serde(skip_serializing_if = "Option::is_none")] pub essence: Option<f64> }
pub struct EquipmentStorage {
    pub storage: Box<dyn Storage>,
    pub checkpoint: Option<Box<dyn Storage>>,
    now: Box<dyn FnMut() -> f64>,
    seed: Box<dyn FnMut() -> u32>,
    record: Option<LampEconomy>,
    applied_gold: Option<f64>,
    dirty: bool,
    last_clock: f64,
    classified_heroes: Option<String>,
    conveyor_clock: Option<f64>,
    conveyor_frame: f64,
    conveyor_origin: f64,
    conveyor_origin_wall: f64,
    conveyor_running: bool,
    /// `globals.LampStorageError`.
    pub error: Option<String>,
    /// `globals.SettledGoldRewardReceipts`.
    pub settled_gold_receipts: Vec<String>,
    /// combatHostClock's bag tick clock.
    bag_clock: Option<BagClock>,
    bag_seconds_seen: f64,
    pub on_gear_collected: Option<Box<dyn FnMut(&LampItem) -> bool>>,
    /// Bumps whenever the applied record changes (JS compares the data object identity).
    pub generation: u64,
}
impl EquipmentStorage {
    pub fn new(storage: Box<dyn Storage>, checkpoint: Option<Box<dyn Storage>>, now: Box<dyn FnMut() -> f64>, seed: Box<dyn FnMut() -> u32>) -> Self {
        Self { storage, checkpoint, now, seed, record: None, applied_gold: None, dirty: false, last_clock: 0., classified_heroes: None, conveyor_clock: None, conveyor_frame: 0., conveyor_origin: 0., conveyor_origin_wall: 0., conveyor_running: false, error: None, settled_gold_receipts: Vec::new(), bag_clock: None, bag_seconds_seen: 0., on_gear_collected: None, generation: 0 }
    }
    pub fn data(&self) -> Option<&LampEconomy> { self.record.as_ref() }
    /// `time()`: monotonic over the wall clock and the last activation.
    pub fn time(&mut self) -> f64 { let now = (self.now)(); self.last_clock = self.last_clock.max(now).max(self.record.as_ref().map_or(0., |r| r.lamp.last_activation_at)); self.last_clock }
    fn restored_conveyor_clock(&self, lamp: &LampState) -> Option<f64> {
        if let (Some(active), Some(checkpoint)) = (lamp.conveyor_active_ms, self.checkpoint.as_ref()) {
            if let Some(saved) = checkpoint.get(CONVEYOR_CLOCK_KEY).and_then(|s| serde_json::from_str::<Value>(&s).ok()) {
                let active_ms = saved["activeMs"].as_f64();
                if saved["seed"].as_u64() == Some(lamp.seed as u64) && saved["sequence"].as_f64() == Some(lamp.sequence) && saved["lastActivationAt"].as_f64() == Some(lamp.last_activation_at) && active_ms.is_some_and(|a| is_safe_integer(a) && a >= 0.) {
                    return Some(active.max(active_ms.unwrap()));
                }
            }
        }
        lamp.conveyor_active_ms
    }
    fn checkpoint_conveyor_clock(&mut self) {
        let Some(record) = self.record.as_ref() else { return };
        let value = json!({ "seed": record.lamp.seed, "sequence": record.lamp.sequence, "lastActivationAt": record.lamp.last_activation_at, "activeMs": self.conveyor_clock });
        if let Some(c) = self.checkpoint.as_mut() { let _ = c.set(CONVEYOR_CLOCK_KEY, &js_json(&value)); }
    }
    /// `setConveyorActive(active)`: the active-time clock runs only while the strip conveys.
    pub fn set_conveyor_active(&mut self, active: bool, host: &mut dyn LampHost) -> Result<(), String> {
        if self.record.is_none() { return Ok(()); }
        let t = self.time();
        let was_running = self.conveyor_running;
        let initializing = self.conveyor_clock.is_none();
        let restored = self.restored_conveyor_clock(&self.record.as_ref().unwrap().lamp);
        let active_ms = self.record.as_ref().unwrap().lamp.conveyor_active_ms.unwrap_or(0.);
        self.conveyor_clock = Some(self.conveyor_clock.or(restored).unwrap_or(t).max(active_ms));
        if initializing { self.conveyor_origin = self.conveyor_clock.unwrap(); self.conveyor_origin_wall = t; }
        if was_running { *self.conveyor_clock.as_mut().unwrap() += (t - self.conveyor_frame).max(0.); }
        self.conveyor_frame = t;
        self.conveyor_running = active;
        if initializing || (was_running && !active) { self.checkpoint_conveyor_clock(); self.transact(host, |_, _| Ok(Value::Null))?; }
        Ok(())
    }
    fn save_conveyor_clock(&self, next: &mut LampEconomy) {
        let Some(clock) = self.conveyor_clock else { return };
        next.lamp.conveyor_active_ms = Some(next.lamp.conveyor_active_ms.unwrap_or(0.).max(clock));
        let mut emissions = next.emissions();
        let mut changed = false;
        for e in emissions.iter_mut() { if e.issued_active_ms.is_none() { e.issued_active_ms = Some((self.conveyor_origin - (self.conveyor_origin_wall - e.issued_at).max(0.)).max(0.)); changed = true; } }
        if changed { next.set_emissions(emissions); }
    }
    pub fn conveyor_time(&mut self) -> f64 {
        let active = self.record.as_ref().and_then(|r| r.lamp.conveyor_active_ms);
        let base = match self.conveyor_clock.or(active) { Some(v) => v, None => self.time() };
        base.max(active.unwrap_or(0.))
    }
    fn classification_key(progress: &HeroProgressStore) -> String {
        js_json(&json!(lamp_hero_roster(progress, false).unwrap_or_default().iter().map(|h| json!([h.instance_key, h.level, null, null])).collect::<Vec<_>>()))
    }
    /// `read()`: the current save, or the newest older save migrated once.
    fn read(&mut self, host: &mut dyn LampHost) -> Result<LampEconomy, String> {
        let parse = |raw: String| serde_json::from_str::<Value>(&raw).map_err(|e| format!("Lamp save could not be parsed: {e}"));
        if let Some(raw) = self.storage.get(EQUIPMENT_SAVE_KEY) { return validate_conveyor_state(&parse(raw)?); }
        if let Some(raw) = self.storage.get(FOUR_STAT_HP_KEY) { return migrate_v4(&parse(raw)?); }
        if let Some(raw) = self.storage.get(PREVIOUS_KEY) { return migrate_v3(&parse(raw)?); }
        if let Some(raw) = self.storage.get(DRAFT_KEY) { return migrate_v2(&parse(raw)?); }
        if let Some(raw) = self.storage.get(LEGACY_KEY) { let seed = (self.seed)(); return migrate_v1(&parse(raw)?, seed); }
        let pending: f64 = host.pending_gold_settlements().values().map(|n| n.max(0.).floor()).sum();
        let gold = match self.storage.get(LEGACY_GOLD_KEY) { None => (host.gold_total() - pending).max(0.), Some(raw) => raw.trim().parse::<f64>().unwrap_or(f64::NAN) };
        if !is_safe_integer(gold) || gold < 0. { return Err("Gold save is invalid. Original data is preserved.".into()); }
        let seed = (self.seed)();
        Ok(LampEconomy::create(seed, gold))
    }
    fn hero_equipment_stats(record: &LampEconomy, hero: &HeroProgress) -> BTreeMap<String, f64> {
        let canonical = hero.base_hero_name.as_str();
        let primary = hero.hero_instance_key == canonical || hero.hero_instance_key == format!("{}#1", canonical.to_lowercase());
        let loadout = record.loadouts.get(&hero.hero_instance_key).or_else(|| if primary { record.loadouts.get(canonical) } else { None });
        let find = find_gear(record);
        equipment_stats(|id| find(id), loadout.into_iter().flat_map(|l| l.iter().map(|(s, id)| (s.as_str(), id.as_str()))))
    }
    /// `applyHero(hero, stats)`: lamp EXP, equipment stats with max-HP growth filling HP, CP.
    fn apply_hero(record: &LampEconomy, hero: &mut HeroProgress, stats: &BTreeMap<String, f64>) -> bool {
        let mut dirty = false;
        let exp = record.party_exp - hero.lamp_exp_claimed;
        if exp > 0. { hero.award_exp(exp); hero.lamp_exp_claimed = record.party_exp; dirty = true; }
        if hero.equipment_stats.as_ref() != Some(stats) {
            let (before_max, before_hp) = (hero.max_hp, hero.hp);
            hero.equipment_stats = Some(stats.clone());
            hero.refresh();
            hero.hp = hero::fill_gear_max_hp_growth(before_hp, before_max, hero.max_hp);
            dirty = true;
        }
        hero.combat_power = Some(compute_combat_power(CpActor::new(hero.current_level as f64, hero.stats.atk, hero.stats.mag, hero.stats.def, hero.stats.res, hero.max_hp, hero.stats.spd)));
        dirty
    }
    /// `apply(next)`: the record becomes current; gold, receipts and hero stats follow it.
    fn apply(&mut self, next: LampEconomy, host: &mut dyn LampHost) {
        host.set_gold_total(next.gold);
        self.applied_gold = Some(next.gold);
        self.settled_gold_receipts = next.settled_gold_rewards.clone();
        self.error = None;
        let settled = next.settled_gold_rewards.clone();
        host.pending_gold_settlements().retain(|id, _| !settled.contains(id));
        let live = host.live_hero_keys();
        let mut dirty = false;
        let keys: Vec<String> = host.progress().heroes.keys().cloned().collect();
        for key in keys {
            let hero = host.progress().heroes.get(&key).cloned().unwrap();
            let stats = Self::hero_equipment_stats(&next, &hero);
            let previous = hero.equipment_stats.clone().unwrap_or_default();
            let changed = next.party_exp > hero.lamp_exp_claimed || stats.keys().chain(previous.keys()).any(|k| stats.get(k) != previous.get(k));
            let mut record = hero;
            if changed {
                if live.contains(&key) {
                    // routeHeroPermanentInputs: the detached record changes, then the live hero is revised.
                    let mut draft = record.clone();
                    Self::apply_hero(&next, &mut draft, &stats);
                    let max_hp = draft.combat_base_max_hp.unwrap_or(draft.max_hp);
                    let mut saved = HeroProgress::saved_record(&draft.hero_instance_key, draft.definition().key, Some(&draft.equipment()), draft.current_level, draft.current_exp, draft.lamp_exp_claimed, draft.hp, max_hp, draft.stats);
                    saved.combat_power = draft.combat_power;
                    host.progress().heroes.insert(key.clone(), saved);
                    dirty = true;
                    host.revise_hero(&key);
                    continue;
                }
                dirty |= Self::apply_hero(&next, &mut record, &stats);
            }
            record.combat_power = Some(compute_combat_power(CpActor::new(record.current_level as f64, record.stats.atk, record.stats.mag, record.stats.def, record.stats.res, record.max_hp, record.stats.spd)));
            host.progress().heroes.insert(key, record);
        }
        self.generation += 1;
        self.record = Some(next);
        if dirty { host.persist_progress(); }
    }
    /// `transact(change)`: the locked read-modify-write every economy action goes through.
    pub fn transact<R>(&mut self, host: &mut dyn LampHost, change: impl FnOnce(&mut LampEconomy, f64) -> Result<R, String>) -> Result<R, String> {
        let result = self.transact_inner(host, change);
        if let Err(e) = &result { self.error = Some(e.clone()); }
        result
    }
    fn transact_inner<R>(&mut self, host: &mut dyn LampHost, change: impl FnOnce(&mut LampEconomy, f64) -> Result<R, String>) -> Result<R, String> {
        if host.progress_storage_error() && (!host.pending_gold_settlements().is_empty() || host.progress().pending_bag_kill_rewards.as_ref().is_some_and(|p| !p.is_empty())) { return Err("Pending rewards need a saved HeroProgress receipt.".into()); }
        let roster = lamp_hero_roster(host.progress(), true)?;
        let mut next = self.read(host)?;
        if restore_paid_lamp_upgrade(&mut next)? && self.storage.get(BAG_UPGRADE_BACKUP_KEY).is_none() {
            if let Some(original) = self.storage.get(EQUIPMENT_SAVE_KEY) { self.storage.set(BAG_UPGRADE_BACKUP_KEY, &original)?; }
        }
        let mut receipts = next.settled_gold_rewards.clone();
        let mut delta = self.applied_gold.map_or(0., |applied| host.gold_total() - applied);
        let pending_gold: Vec<(String, f64)> = host.pending_gold_settlements().iter().map(|(id, amount)| (id.clone(), amount.max(0.).floor())).collect();
        for (id, amount) in pending_gold {
            if receipts.contains(&id) { if self.applied_gold.is_some() { delta -= amount; } continue; }
            receipts.push(id.clone());
            next.settled_gold_rewards.push(id);
            if self.applied_gold.is_none() { delta += amount; }
        }
        let kills: Vec<(String, f64)> = host.progress().pending_bag_kill_rewards.clone().unwrap_or_default().into_iter().collect();
        for (id, amount) in &kills { award_lamp_kill_points(&mut next, id, *amount)?; }
        let t = self.time();
        self.save_conveyor_clock(&mut next);
        next.gold += delta;
        classify_conveyor_cache(&mut next, &roster);
        let result = change(&mut next, t)?;
        classify_conveyor_cache(&mut next, &roster);
        let next = validate_conveyor_state(&next.to_value())?;
        self.storage.set(EQUIPMENT_SAVE_KEY, &js_json(&next.to_value()))?;
        if !kills.is_empty() {
            if let Some(pending) = host.progress().pending_bag_kill_rewards.as_mut() { for (id, _) in &kills { pending.remove(id); } }
            host.progress().mark_dirty();
        }
        self.classified_heroes = Some(Self::classification_key(host.progress()));
        self.apply(next, host);
        Ok(result)
    }
    fn commit_equip(next: &mut LampEconomy, host: &mut dyn LampHost, hero_id: &str, id: &str) -> Result<EquipReceipt, String> {
        let record = host.progress().heroes.get(hero_id).cloned().ok_or("Hero is not a lamp equipment owner")?;
        let hero = LampHero { instance_key: hero_id.into(), definition: record.definition(), level: record.current_level };
        let before = hero_cp_with(&hero, &Self::loadout_stats_of(next, hero_id));
        if next.item(id).is_none() && next.review_hold().map(|h| h.item.instance_id) != Some(id.to_string()) { return Err("Item missing.".into()); }
        let equipped = equip_conveyor_item(next, hero_id, id, Some(&hero))?;
        let after = hero_cp_with(&hero, &Self::loadout_stats_of(next, hero_id));
        Ok(EquipReceipt { item: equipped, hero_id: hero_id.into(), cp_before: before, cp_after: after, cp_change: wf_meta::jsnum::round((after - before) * 10.) / 10. })
    }
    fn loadout_stats_of(data: &LampEconomy, hero_id: &str) -> BTreeMap<String, f64> {
        let find = find_gear(data);
        equipment_stats(|id| find(id), data.loadouts.get(hero_id).into_iter().flat_map(|l| l.iter().map(|(s, id)| (s.as_str(), id.as_str()))))
    }
    fn queue_gear_collection(&self, next: &mut LampEconomy, result: &CollectResult) {
        if self.on_gear_collected.is_none() || !result.saved { return; }
        let mut events = next.pending_gear_collections();
        if !events.iter().any(|e| e.id == result.item.instance_id) { events.push(GearCollection { id: result.item.instance_id.clone(), item: result.item.clone() }); }
        next.set_pending_gear_collections(events);
    }
    /// `flushGearCollections()`: COT gear events acknowledged one at a time.
    fn flush_gear_collections(&mut self, host: &mut dyn LampHost) {
        if self.on_gear_collected.is_none() { return; }
        let events = self.record.as_ref().map(|r| r.pending_gear_collections()).unwrap_or_default();
        for event in events {
            let acknowledged = self.on_gear_collected.as_mut().map_or(false, |cb| cb(&event.item));
            if !acknowledged { break; }
            let id = event.id.clone();
            if self.transact(host, move |next, _| { let kept: Vec<GearCollection> = next.pending_gear_collections().into_iter().filter(|p| p.id != id).collect(); next.set_pending_gear_collections(kept); Ok(()) }).is_err() { break; }
        }
    }
    /// `sync()`: re-apply when nothing changed, otherwise a full transaction.
    pub fn sync(&mut self, host: &mut dyn LampHost) -> Result<(), String> {
        let unchanged = self.record.is_some() && self.classified_heroes.as_deref() == Some(Self::classification_key(host.progress()).as_str()) && Some(host.gold_total()) == self.applied_gold && !self.dirty && host.progress().pending_bag_kill_rewards.as_ref().is_none_or(|p| p.is_empty());
        if unchanged { let record = self.record.clone().unwrap(); self.apply(record, host); self.flush_gear_collections(host); return Ok(()); }
        self.dirty = false;
        self.transact(host, |_, _| Ok(()))?;
        self.flush_gear_collections(host);
        Ok(())
    }
    pub fn refresh(&mut self, host: &mut dyn LampHost) -> Result<(), String> { self.dirty = true; self.sync(host) }
    /// `generate(context)`: one emission collected at once (manual lamp, retained for QA).
    pub fn generate(&mut self, host: &mut dyn LampHost, region: f64, stage: f64) -> Result<LampItem, String> {
        let on = self.on_gear_collected.is_some();
        let result = self.transact(host, |next, t| { let item = emit_conveyor_item(next, region, stage, t)?; let receipt = collect_conveyor_item(next, &item.instance_id, t, true)?; if on && receipt.saved { let mut events = next.pending_gear_collections(); if !events.iter().any(|e| e.id == receipt.item.instance_id) { events.push(GearCollection { id: receipt.item.instance_id.clone(), item: receipt.item.clone() }); } next.set_pending_gear_collections(events); } Ok(item) })?;
        self.flush_gear_collections(host);
        Ok(result)
    }
    /// `collect(id, canCollect)`.
    pub fn collect(&mut self, host: &mut dyn LampHost, id: &str, can_collect: bool) -> Result<Option<CollectResult>, String> {
        let on = self.on_gear_collected.is_some();
        let id = id.to_string();
        let result = self.transact(host, move |next, t| { if !can_collect { return Ok(None); } let collected = collect_conveyor_item(next, &id, t, false)?; if on && collected.saved { let mut events = next.pending_gear_collections(); if !events.iter().any(|e| e.id == collected.item.instance_id) { events.push(GearCollection { id: collected.item.instance_id.clone(), item: collected.item.clone() }); } next.set_pending_gear_collections(events); } Ok(Some(collected)) })?;
        self.flush_gear_collections(host);
        Ok(result)
    }
    /// `collectAvailable(ids, canCollect)`: arrivals the strip reported, each at most once.
    pub fn collect_available(&mut self, host: &mut dyn LampHost, ids: &[String], can_collect: bool) -> Result<Vec<CollectResult>, String> {
        let on = self.on_gear_collected.is_some();
        let mut unique: Vec<String> = Vec::new();
        for id in ids { if !unique.contains(id) { unique.push(id.clone()); } }
        let result = self.transact(host, move |next, t| {
            let mut out = Vec::new();
            for id in unique {
                if !can_collect { continue; }
                let emissions = next.emissions();
                let Some(e) = emissions.iter().find(|e| e.item.instance_id == id) else { continue };
                if e.collected || conveyor_item_age(&next.lamp, e, t, None) >= CONVEYOR_TRAVEL_MS { continue; }
                let r = collect_conveyor_item(next, &id, t, true)?;
                if on && r.saved { let mut events = next.pending_gear_collections(); if !events.iter().any(|e| e.id == r.item.instance_id) { events.push(GearCollection { id: r.item.instance_id.clone(), item: r.item.clone() }); } next.set_pending_gear_collections(events); }
                out.push(r);
            }
            Ok(out)
        })?;
        self.flush_gear_collections(host);
        Ok(result)
    }
    /// `tickConveyor(context, canCreate, {deferCollection})`: one emission per 5 s of active combat.
    pub fn tick_conveyor(&mut self, host: &mut dyn LampHost, region: f64, stage: f64, can_create: bool, defer_collection: bool) -> Result<Option<LampItem>, String> {
        let on = self.on_gear_collected.is_some();
        let result = self.transact(host, move |next, t| {
            if !can_create { return Ok(None); }
            next.lamp.highest_ordinal = next.lamp.highest_ordinal.max(progression_ordinal(region, stage) as f64);
            if t - next.lamp.last_activation_at < AUTO_INTERVAL_MS { return Ok(None); }
            if let Some(previous) = next.emissions().last() { if previous.issued_active_ms.is_some() && conveyor_item_age(&next.lamp, previous, t, None) < AUTO_INTERVAL_MS { return Ok(None); } }
            let item = emit_conveyor_item(next, region, stage, t)?;
            if !defer_collection {
                let receipt = collect_conveyor_item(next, &item.instance_id, t, true)?;
                if on && receipt.saved { let mut events = next.pending_gear_collections(); if !events.iter().any(|e| e.id == receipt.item.instance_id) { events.push(GearCollection { id: receipt.item.instance_id.clone(), item: receipt.item.clone() }); } next.set_pending_gear_collections(events); }
            }
            Ok(Some(item))
        })?;
        self.flush_gear_collections(host);
        Ok(result)
    }
    pub fn equip(&mut self, host: &mut dyn LampHost, hero_id: &str, id: &str) -> Result<EquipReceipt, String> {
        if !lamp_hero_roster(host.progress(), false)?.iter().any(|h| h.instance_key == hero_id) { return Err("Hero is not a lamp equipment owner".into()); }
        let (hero_id, id) = (hero_id.to_string(), id.to_string());
        let roster_record = host.progress().heroes.get(&hero_id).cloned();
        self.transact(host, move |next, _| {
            let record = roster_record.ok_or("Hero is not a lamp equipment owner")?;
            let hero = LampHero { instance_key: hero_id.clone(), definition: record.definition(), level: record.current_level };
            let before = hero_cp_with(&hero, &Self::loadout_stats_of(next, &hero_id));
            if next.item(&id).is_none() && next.review_hold().map(|h| h.item.instance_id) != Some(id.clone()) { return Err("Item missing.".into()); }
            let equipped = equip_conveyor_item(next, &hero_id, &id, Some(&hero))?;
            let after = hero_cp_with(&hero, &Self::loadout_stats_of(next, &hero_id));
            Ok(EquipReceipt { item: equipped, hero_id: hero_id.clone(), cp_before: before, cp_after: after, cp_change: wf_meta::jsnum::round((after - before) * 10.) / 10. })
        })
    }
    pub fn auto_equip(&mut self, host: &mut dyn LampHost) -> Result<Vec<AutoEquipReceipt>, String> {
        let roster = lamp_hero_roster(host.progress(), false)?;
        self.transact(host, move |next, _| {
            let (working, _) = plan_conveyor_auto_equip(next, &roster);
            let before = next.clone();
            *next = working;
            let mut out = Vec::new();
            for hero in &roster {
                let old = before.loadouts.get(&hero.instance_key).cloned().unwrap_or_default();
                let current = next.loadouts.get(&hero.instance_key).cloned().unwrap_or_default();
                let slots: Vec<String> = ["hat", "body", "boots"].iter().filter(|s| old.get(**s) != current.get(**s)).map(|s| s.to_string()).collect();
                if slots.is_empty() { continue; }
                let cp_before = hero_cp_with(hero, &Self::loadout_stats_of(&before, &hero.instance_key));
                let cp_after = hero_cp_with(hero, &Self::loadout_stats_of(next, &hero.instance_key));
                out.push(AutoEquipReceipt { items: slots.iter().filter_map(|s| current.get(s).and_then(|id| next.item(id).cloned())).collect(), slots, hero_id: hero.instance_key.clone(), cp_before, cp_after, cp_change: wf_meta::jsnum::round((cp_after - cp_before) * 10.) / 10. });
            }
            Ok(out)
        })
    }
    pub fn finish_review(&mut self, host: &mut dyn LampHost) -> Result<(), String> { self.transact(host, |_, _| Ok(())) }
    pub fn mark_guide(&mut self, host: &mut dyn LampHost, step: &str) -> Result<u32, String> { let step = step.to_string(); self.transact(host, move |next, _| mark_lamp_guide(next, &step)) }
    pub fn upgrade(&mut self, host: &mut dyn LampHost, expected_tier: Option<u32>) -> Result<UpgradeReceipt, String> {
        let tier = expected_tier.or_else(|| self.record.as_ref().map(|r| r.lamp.capacity_tier)).unwrap_or(0);
        self.transact(host, move |next, _| upgrade_lamp(next, tier))
    }
    pub fn queue_disposal(&mut self, host: &mut dyn LampHost, id: &str) -> Result<(), String> {
        let roster = lamp_hero_roster(host.progress(), false)?;
        let id = id.to_string();
        self.transact(host, move |next, _| queue_conveyor_disposal(next, &id, &roster))
    }
    pub fn disposal_preview(&mut self, host: &mut dyn LampHost, ids: Option<&[String]>) -> Result<DisposalPreview, String> {
        let roster = lamp_hero_roster(host.progress(), true)?;
        let record = match self.record.clone() { Some(r) => r, None => self.read(host)? };
        conveyor_disposal_preview(&record, &roster, ids)
    }
    pub fn dismantle(&mut self, host: &mut dyn LampHost, preview: &DisposalPreview) -> Result<DismantleResult, String> {
        let roster = lamp_hero_roster(host.progress(), false)?;
        let preview = preview.clone();
        self.transact(host, move |next, _| dismantle_conveyor_items(next, &preview, &roster))
    }
    /// `awardCombatEssence(receiptId, amount)`: COT quest Essence, once per receipt.
    pub fn award_combat_essence(&mut self, host: &mut dyn LampHost, receipt_id: &str, amount: f64) -> Result<EssenceReceipt, String> {
        let id: String = receipt_id.chars().take(180).collect();
        let count = (if amount.is_nan() { 0. } else { amount }).floor().max(0.);
        if id.is_empty() || count == 0. { return Ok(EssenceReceipt { applied: false, duplicate: None, reason: Some("invalid_receipt".into()), essence: None }); }
        self.transact(host, move |next, _| {
            let mut settled = next.settled_combat_essence_rewards.clone().unwrap_or_default();
            if settled.contains(&id) { return Ok(EssenceReceipt { applied: false, duplicate: Some(true), reason: None, essence: Some(next.lamp.essence) }); }
            next.lamp.essence += count;
            settled.push(id);
            if settled.len() > 512 { let drop = settled.len() - 512; settled.drain(..drop); }
            next.settled_combat_essence_rewards = Some(settled);
            Ok(EssenceReceipt { applied: true, duplicate: None, reason: None, essence: Some(next.lamp.essence) })
        })
    }
    pub fn has_settled_combat_essence_reward(&mut self, host: &mut dyn LampHost, receipt_id: &str) -> bool {
        let id: String = receipt_id.chars().take(180).collect();
        if id.is_empty() { return false; }
        let current = match self.record.clone() { Some(r) => Some(r), None => self.read(host).ok() };
        current.and_then(|c| c.settled_combat_essence_rewards).is_some_and(|s| s.contains(&id))
    }
    /// combatHostClock: every 15 s of active combat is a Bag progress receipt on the battle ledger.
    pub fn advance_bag_clock(&mut self, battle_id: &str, bag_seconds: f64, battle_settled: bool, pending: &BTreeMap<String, f64>) -> Result<Vec<BagReward>, String> {
        let delta = bag_seconds - self.bag_seconds_seen;
        self.bag_seconds_seen = bag_seconds;
        if delta <= 0. || battle_settled { return Ok(Vec::new()); }
        let (clock, rewards) = advance_lamp_combat_progress(self.bag_clock.as_ref(), battle_id, delta, self.record.as_ref(), pending)?;
        self.bag_clock = clock;
        Ok(rewards)
    }
}
