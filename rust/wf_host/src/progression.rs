//! `web-runner/systems/combatProgression.mjs`: the COT quest system over browser storage.
//! Rules live in `wf_meta::progression`; this owns the save, essence settlement through the
//! lamp economy, ticket level-ups against the hero save, and the permanent-input notifications.
use crate::equipment::{EquipmentStorage, LampHost, Storage};
use crate::rewards::ProgressionBattle;
use std::collections::{BTreeMap, BTreeSet};
use wf_meta::hero;
use wf_meta::progression::*;

/// What the quest system reads from the running game (`globals` + `state.entities`).
pub trait QuestHost: LampHost {
    /// Live party as the rules see it (`getHeroes().filter(kind === 'hero')`).
    fn quest_heroes(&self) -> Vec<QuestHero>;
    /// `ContinuousCombatStage.region` / `.bossActive`.
    fn quest_stage(&self) -> (Option<u32>, bool);
    /// `RustCombatPermanentInputs(heroId?)`.
    fn permanent_inputs(&mut self, hero: Option<&str>);
    /// `globals.PartyTrainingLevels` / `globals.HeroGrowth` the combat config reads.
    fn apply_growth(&mut self, training: Training, stars: BTreeMap<String, u32>);
}
#[derive(Clone, Debug, PartialEq)]
pub struct SpendOutcome { pub ok: bool, pub reason: Option<&'static str>, pub pending: bool, pub cost: f64, pub level: u32 }
pub struct CombatProgression {
    storage: Box<dyn Storage>,
    now: Box<dyn Fn() -> f64>,
    pub state: ProgressionState,
    storage_ready: bool,
    pub storage_error: Option<String>,
    pub errors: Vec<String>,
    essence_settled: BTreeSet<String>,
    essence_retry_at: f64,
    ticket_spend_sequence: u64,
    defeat_battle_id: String,
    committed_defeats: BTreeSet<String>,
    observation_signature: String,
    observed_equipment: Option<u64>,
    /// `notify(reason)` reasons since the client last drained them (UI listeners).
    pub notifications: Vec<&'static str>,
}
impl CombatProgression {
    /// `createCombatProgression(...)` up to the first ensure; `boot` finishes against the game.
    pub fn new(storage: Box<dyn Storage>, now: Box<dyn Fn() -> f64>) -> Self {
        let (state, storage_ready, storage_error) = match storage.get(SAVE_KEY).map(|raw| serde_json::from_str::<serde_json::Value>(&raw)) {
            None => (create_state(None, 0x43544f), true, None),
            Some(Ok(raw)) => (create_state(Some(&raw), 0x43544f), true, None),
            Some(Err(error)) => (create_state(None, 0x43544f), false, Some(error.to_string())),
        };
        Self { storage, now, state, storage_ready, storage_error, errors: Vec::new(), essence_settled: BTreeSet::new(), essence_retry_at: 0., ticket_spend_sequence: 0, defeat_battle_id: String::new(), committed_defeats: BTreeSet::new(), observation_signature: String::new(), observed_equipment: None, notifications: Vec::new() }
    }
    fn context<'a>(host: &dyn QuestHost, economy: &'a EquipmentStorage) -> Context<'a> { Context { equipment: economy.data(), chapter: host.quest_stage().0.map(f64::from) } }
    fn apply_globals(&self, host: &mut dyn QuestHost) {
        let stars = self.state.growth.as_ref().map(|g| g.stars.iter().filter_map(|(k, v)| v.as_f64().map(|n| (k.clone(), n as u32))).collect()).unwrap_or_default();
        host.apply_growth(self.state.training, stars);
    }
    fn commit(&mut self, next: ProgressionState, host: &mut dyn QuestHost) -> Result<(), String> {
        if !self.storage_ready { return Err("Combat progression storage is unavailable; saved data was preserved.".into()); }
        self.storage.set(SAVE_KEY, &serde_json::to_string(&next).unwrap())?;
        self.state = next;
        self.storage_error = None;
        self.apply_globals(host);
        Ok(())
    }
    fn report(&mut self, label: &str, error: String) { self.errors.push(format!("{label}: {error}")); }
    /// The boot ensure + `reconcileTicketSpends()` + `sync()` the app runs right after creation.
    pub fn boot(&mut self, host: &mut dyn QuestHost, economy: &mut EquipmentStorage) {
        let ensured = ensure_objective(&self.state, &host.quest_heroes(), Self::context(host, economy));
        if !self.storage_ready { self.state = ensured; self.apply_globals(host); }
        else if self.state.objective.is_none() || ensured != self.state {
            if let Err(error) = self.commit(ensured.clone(), host) { self.storage_error = Some(error); self.state = ensured; self.apply_globals(host); }
        } else { self.apply_globals(host); }
        self.reconcile_ticket_spends(host, economy);
        self.sync(host, economy);
    }
    /// `observe()`: milestones re-evaluate when the party, stage, cursor, training or equipment changed.
    pub fn observe(&mut self, host: &mut dyn QuestHost, economy: &mut EquipmentStorage) {
        let party = host.quest_heroes();
        let (region, boss_active) = host.quest_stage();
        let signature = serde_json::to_string(&serde_json::json!([region, boss_active, party.iter().map(|h| (h.instance_key.clone(), h.current_level, h.hp <= 0.)).collect::<Vec<_>>(), self.state.cursor, self.state.training])).unwrap();
        if signature == self.observation_signature && self.observed_equipment == Some(economy.generation) { return; }
        let mut observed = create_state(Some(&self.state.to_value()), self.state.seed);
        observe_chapter_milestones(&mut observed, region);
        let next = ensure_objective(&observed, &party, Self::context(host, economy));
        if next != self.state { if let Err(error) = self.commit(next, host) { self.report("Quest milestone save failed", error); return; } }
        self.observation_signature = signature;
        self.observed_equipment = Some(economy.generation);
    }
    /// `settleEssenceReceipts()`: Essence rewards reach the lamp save once each.
    pub fn sync(&mut self, host: &mut dyn QuestHost, economy: &mut EquipmentStorage) -> bool {
        if (self.now)() < self.essence_retry_at { return false; }
        let receipts: Vec<(String, f64)> = self.state.reward_receipts.iter().filter(|r| r.resource == "essence" && r.amount > 0. && !self.essence_settled.contains(&r.id)).map(|r| (r.id.clone(), r.amount)).collect();
        for (id, amount) in receipts {
            if economy.has_settled_combat_essence_reward(host, &id) { self.essence_settled.insert(id); continue; }
            match economy.award_combat_essence(host, &id, amount) {
                Ok(_) => { self.essence_settled.insert(id); }
                Err(error) => { self.essence_retry_at = (self.now)() + 5000.; self.report("COT Essence reward save failed", error); return false; }
            }
        }
        true
    }
    fn notify(&mut self, reason: &'static str, host: &mut dyn QuestHost) {
        if ["training", "star-up", "ticket-spend"].contains(&reason) { host.permanent_inputs(None); }
        self.notifications.push(reason);
    }
    /// `persistHeroLevelSpend(spend)`: the saved hero gains exactly one level from the reserved tickets.
    fn persist_hero_level_spend(&mut self, spend: &TicketSpend, host: &mut dyn QuestHost) -> bool {
        let store = host.progress();
        if !store.settled_ticket_spends.contains(&spend.id) {
            let Some(hero) = store.heroes.get_mut(&spend.hero_id) else { return false };
            if hero.current_level as f64 != spend.from_level || hero.current_level >= hero.max_level { return false; }
            let required = hero::exp_to_next_level(hero.current_level) - hero.current_exp;
            if required <= 0. { return false; }
            let result = hero.award_exp(required);
            if result.to_level != result.from_level + 1 { return false; }
            store.settled_ticket_spends.push(spend.id.clone());
            let keep = store.settled_ticket_spends.len().saturating_sub(256);
            store.settled_ticket_spends.drain(..keep);
        }
        store.mark_dirty();
        let persisted = host.persist_progress();
        if persisted { host.permanent_inputs(Some(&spend.hero_id)); }
        persisted
    }
    /// `reconcileTicketSpends()`: reserved spends whose level-up saved settle into the quest state.
    pub fn reconcile_ticket_spends(&mut self, host: &mut dyn QuestHost, economy: &mut EquipmentStorage) {
        for spend in self.state.pending_spends() {
            if !self.persist_hero_level_spend(&spend, host) { continue; }
            let (next, _) = settle_hero_ticket_spend(&self.state, &spend.id, &host.quest_heroes());
            if let Err(error) = self.commit(next, host) { self.report("Hero ticket settlement save failed", error); continue; }
            self.notify("ticket-spend", host);
        }
        let _ = economy;
    }
    /// `record(event)` → changed.
    pub fn record(&mut self, id: &str, kind: &str, hero_id: Option<&str>, host: &mut dyn QuestHost, economy: &mut EquipmentStorage) -> Result<bool, String> {
        self.observe(host, economy);
        let (next, _) = record_event(&self.state, Event { id, kind, hero_id }, &host.quest_heroes());
        if next != self.state {
            self.commit(next, host)?;
            self.notify("progress", host);
            return Ok(true);
        }
        Ok(false)
    }
    /// `claimObjective(expectedObjectiveId)`.
    pub fn claim(&mut self, expected_id: &str, host: &mut dyn QuestHost, economy: &mut EquipmentStorage) -> ClaimResult {
        self.observe(host, economy);
        let result = claim_reward(&self.state, expected_id, &host.quest_heroes(), (self.now)(), Self::context(host, economy));
        if !result.ok { return result; }
        if let Err(error) = self.commit(result.state.clone(), host) { self.report("COT reward claim save failed", error); return ClaimResult { state: result.state, ok: false, reason: Some("save_failed"), receipt: None }; }
        self.notify("reward", host);
        if result.receipt.as_ref().is_some_and(|r| r.resource == "essence") { self.sync(host, economy); }
        result
    }
    /// `recordCommittedEnemyDefeats(battle)`: one `enemy:<battle>:<uid>` event per ledger row.
    pub fn record_committed_enemy_defeats(&mut self, battle: &ProgressionBattle, host: &mut dyn QuestHost, economy: &mut EquipmentStorage) -> u32 {
        if battle.id.is_empty() { return 0; }
        if battle.id != self.defeat_battle_id { self.defeat_battle_id = battle.id.clone(); self.committed_defeats.clear(); }
        let mut recorded = 0;
        for uid in battle.defeated.keys() {
            let id = format!("enemy:{}:{uid}", battle.id);
            if self.committed_defeats.contains(&id) { continue; }
            match self.record(&id, "enemy_defeat", None, host, economy) {
                Ok(_) => { self.committed_defeats.insert(id); recorded += 1; }
                Err(error) => { self.report("COT enemy defeat save failed", error); break; }
            }
        }
        recorded
    }
    pub fn ticket_count(&self, hero_id: &str) -> f64 { self.state.wallet.tickets(hero_id) }
    /// `spendLevelUp(heroId)`: tickets reserve, the save levels the hero, the spend settles.
    pub fn spend_level_up(&mut self, hero_id: &str, host: &mut dyn QuestHost, economy: &mut EquipmentStorage) -> SpendOutcome {
        self.reconcile_ticket_spends(host, economy);
        let hero = host.progress().heroes.get(hero_id).map(|h| QuestHero { instance_key: h.hero_instance_key.clone(), base_hero_name: h.base_hero_name.clone(), current_level: h.current_level, max_level: h.max_level, hp: h.hp });
        self.ticket_spend_sequence += 1;
        let spend_id = format!("ticket-spend:{hero_id}:{}:{}:{}:{}", self.state.cursor, self.state.reward_receipts.len(), (self.now)(), self.ticket_spend_sequence);
        let result = spend_hero_tickets(&self.state, hero_id, hero.as_ref(), &spend_id);
        if !result.ok { return SpendOutcome { ok: false, reason: result.reason, pending: false, cost: result.cost, level: 0 }; }
        if let Err(error) = self.commit(result.state.clone(), host) { self.report("Hero ticket reservation save failed", error); return SpendOutcome { ok: false, reason: Some("save_failed"), pending: false, cost: result.cost, level: 0 }; }
        let spend = self.state.pending_spends().into_iter().find(|s| s.id == spend_id).unwrap();
        if !self.persist_hero_level_spend(&spend, host) { return SpendOutcome { ok: false, reason: Some("save_failed"), pending: true, cost: result.cost, level: 0 }; }
        let (settled, _) = settle_hero_ticket_spend(&self.state, &spend_id, &host.quest_heroes());
        if let Err(error) = self.commit(settled, host) { self.report("Hero ticket settlement save failed", error); return SpendOutcome { ok: false, reason: Some("save_failed"), pending: true, cost: result.cost, level: 0 }; }
        self.notify("ticket-spend", host);
        let level = host.progress().heroes.get(hero_id).map_or(0, |h| h.current_level);
        SpendOutcome { ok: true, reason: None, pending: false, cost: result.cost, level }
    }
    /// `train(stat)`: Incense buys one party training level and records the objective event.
    pub fn train(&mut self, stat: &str, host: &mut dyn QuestHost, economy: &mut EquipmentStorage) -> TrainResult {
        if !TRAINING_STATS.contains(&stat) { return TrainResult { state: self.state.clone(), ok: false, reason: Some("invalid_stat"), stat: stat.into(), cost: 0., level: 0 }; }
        let purchase = purchase_training(&self.state, stat);
        if !purchase.ok { return purchase; }
        let heroes = host.quest_heroes();
        let (mut event, _) = record_event(&self.state, Event { id: &format!("training:{}:{}:{}", purchase.state.cursor, purchase.stat, purchase.level), kind: "training_upgrade", hero_id: None }, &heroes);
        event.wallet.incense = purchase.state.wallet.incense;
        event.training = purchase.state.training;
        let committed = ensure_objective(&event, &heroes, Self::context(host, economy));
        if let Err(error) = self.commit(committed, host) { self.report("Party training save failed", error); return TrainResult { state: purchase.state, ok: false, reason: Some("save_failed"), stat: stat.into(), cost: purchase.cost, level: purchase.level }; }
        self.notify("training", host);
        purchase
    }
    /// `starUp(heroId)`.
    pub fn star_up(&mut self, hero_id: &str, host: &mut dyn QuestHost) -> StarUpResult {
        let result = star_up_hero(&self.state, hero_id);
        if !result.ok { return result; }
        if let Err(error) = self.commit(result.state.clone(), host) { self.report("Star Up save failed", error); return StarUpResult { state: result.state, ok: false, reason: Some("save_failed"), cost: result.cost, stars: result.stars }; }
        self.notify("star-up", host);
        result
    }
    pub fn drain_notifications(&mut self) -> Vec<&'static str> { std::mem::take(&mut self.notifications) }
}
