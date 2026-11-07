//! `web-runner/src/core/combatRewardOutbox.mjs` + `systems/combatRewardOutbox.mjs` +
//! `modules/heroCommands.mjs`: event-only kill ledger, Bag kill points, battle settlement.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
pub const COMBAT_RECEIPT_WINDOW: usize = 128;
pub const BOSS_KILL_POINTS: f64 = 5.;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingEnemyRef { pub kind: String, pub uid: u32, pub enemy_role: String }
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingRow { pub sequence: String, pub battle_id: String, pub id: String, pub amount: f64, pub enemy: PendingEnemyRef }
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Default)]
pub struct Stream { pub sequence: String, pub step: String, pub recent: BTreeMap<String, String>, pub pending: Vec<PendingRow> }
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutboxState {
    pub version: u32,
    pub streams: BTreeMap<String, Stream>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub active_encounter: Option<String>,
}
impl Default for OutboxState { fn default() -> Self { Self { version: 1, streams: BTreeMap::new(), active_encounter: None } } }
impl OutboxState {
    /// `createCombatRewardOutboxState(saved)`: a missing outbox is fresh; a malformed one is an error.
    pub fn from_saved(saved: Option<&Value>) -> Result<Self, String> {
        let Some(saved) = saved else { return Ok(Self::default()) };
        let invalid = || "Invalid combat reward outbox. Original save must be preserved.".to_string();
        let s = saved.as_object().ok_or_else(invalid)?;
        if s.get("version") != Some(&Value::from(1)) { return Err(invalid()); }
        let streams = s.get("streams").and_then(Value::as_object).ok_or_else(invalid)?;
        if streams.len() > 64 { return Err(invalid()); }
        let active_encounter = match s.get("activeEncounter") { None => None, Some(v) => Some(v.as_str().filter(|a| !a.is_empty() && a.len() <= 256).ok_or_else(invalid)?.to_string()) };
        let mut out = BTreeMap::new();
        for (id, stream) in streams {
            let st = stream.as_object().filter(|_| !id.is_empty() && id.len() <= 256).ok_or_else(invalid)?;
            let sequence = decimal(&st["sequence"]).ok_or_else(invalid)?;
            decimal(&st["step"]).ok_or_else(invalid)?;
            let recent = st.get("recent").and_then(Value::as_object).ok_or_else(invalid)?;
            let pending = st.get("pending").and_then(Value::as_array).ok_or_else(invalid)?;
            if pending.len() > 512 || recent.len() > COMBAT_RECEIPT_WINDOW { return Err(invalid()); }
            let mut recent_out = BTreeMap::new();
            for (seq, body) in recent {
                let n = decimal(&Value::String(seq.clone())).ok_or_else(invalid)?;
                if n > sequence { return Err(invalid()); }
                recent_out.insert(seq.clone(), body.as_str().ok_or_else(invalid)?.to_string());
            }
            let mut seen = std::collections::BTreeSet::new();
            let mut rows = Vec::new();
            for row in pending {
                let r = row.as_object().ok_or_else(invalid)?;
                let seq = decimal(&r["sequence"]).ok_or_else(invalid)?;
                let battle_id = r.get("battleId").and_then(Value::as_str).filter(|b| !b.is_empty()).ok_or_else(invalid)?;
                let enemy = r.get("enemy").and_then(Value::as_object).ok_or_else(invalid)?;
                let uid = enemy.get("uid").and_then(Value::as_f64).filter(|u| u.fract() == 0. && *u >= 1. && *u <= 9007199254740991.).ok_or_else(invalid)?;
                let role = enemy.get("enemyRole").and_then(Value::as_str).filter(|r| ["boss", "ordinary"].contains(r)).ok_or_else(invalid)?;
                let row_id = r.get("id").and_then(Value::as_str).ok_or_else(invalid)?;
                let amount = r.get("amount").and_then(Value::as_f64).ok_or_else(invalid)?;
                if seq > sequence || !seen.insert(seq) || enemy.get("kind").and_then(Value::as_str) != Some("enemy") || row_id != format!("enemy:{battle_id}:{uid}") || row_id.len() > 180 || amount != if role == "boss" { 5. } else { 0. } { return Err(invalid()); }
                rows.push(PendingRow { sequence: r["sequence"].as_str().unwrap().into(), battle_id: battle_id.into(), id: row_id.into(), amount, enemy: PendingEnemyRef { kind: "enemy".into(), uid: uid as u32, enemy_role: role.into() } });
            }
            out.insert(id.clone(), Stream { sequence: st["sequence"].as_str().unwrap().into(), step: st["step"].as_str().unwrap().into(), recent: recent_out, pending: rows });
        }
        Ok(Self { version: 1, streams: out, active_encounter })
    }
}

/// `g.ProgressionBattle`: the per-attempt kill ledger.
#[derive(Clone, Debug, PartialEq)]
pub struct ProgressionBattle { pub id: String, pub participants: Vec<String>, pub defeated: BTreeMap<String, f64>, pub defeated_gold: BTreeMap<String, f64>, pub settled: bool, pub outcome: String, pub reward_lineage_id: String }
impl ProgressionBattle {
    pub fn new(id: &str, participants: Vec<String>) -> Self {
        Self { id: id.into(), participants, defeated: BTreeMap::new(), defeated_gold: BTreeMap::new(), settled: false, outcome: "active".into(), reward_lineage_id: id.into() }
    }
}
/// `enemyBagKillPoints`: bosses mint five points, nothing else mints.
pub fn enemy_bag_kill_points(boss: bool) -> f64 { if boss { BOSS_KILL_POINTS } else { 0. } }
/// `consumeCombatKillEvent(battle, {enemy})`: returns the Bag reward to persist when the ledger changed.
pub fn consume_combat_kill_event(battle: &mut ProgressionBattle, uid: u32, boss: bool) -> Option<Option<(String, f64)>> {
    let key = uid.to_string();
    let has_exp = battle.defeated.contains_key(&key);
    let has_gold = battle.defeated_gold.contains_key(&key);
    if !has_exp { battle.defeated.insert(key.clone(), 0.); }
    if !has_gold { battle.defeated_gold.insert(key.clone(), 0.); }
    if !(has_exp && has_gold) {
        let amount = enemy_bag_kill_points(boss);
        Some(if amount > 0. { Some((format!("enemy:{}:{key}", battle.id), amount)) } else { None })
    } else { None }
}
fn decimal(v: &Value) -> Option<u64> { v.as_str().filter(|s| !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit())).and_then(|s| s.parse().ok()) }
/// `rewardOutbox.consumeBatch(snapshot, events, resolveEnemy)`: records enemy deaths into the
/// encounter stream; returns the Bag rewards to queue (`id -> amount`).
pub fn consume_batch(outbox: &mut OutboxState, encounter_id: &str, step: u64, last_event_sequence: u64, events: &[Value], battle_id: &str, resolve_enemy: &dyn Fn(u32, Option<&str>) -> Option<(u32, bool)>) -> Result<Vec<(String, f64)>, String> {
    if let Some(active) = &outbox.active_encounter { if active != encounter_id { return Err("Unknown Rust encounter.".into()); } }
    outbox.active_encounter = Some(encounter_id.into());
    if !outbox.streams.contains_key(encounter_id) && outbox.streams.len() >= 64 { return Err("Combat reward outbox encounter capacity exceeded.".into()); }
    let mut stream = outbox.streams.get(encounter_id).cloned().unwrap_or_else(|| Stream { sequence: "0".into(), step: "0".into(), recent: BTreeMap::new(), pending: Vec::new() });
    let mut changed = false;
    let mut delivery: Option<u64> = None;
    let mut queued = Vec::new();
    for event in events {
        let seq = decimal(&event["sequence"]).filter(|s| *s > 0).ok_or("Unknown or invalid Rust gameplay event.")?;
        let event_step = decimal(&event["step"]).ok_or("Unknown or invalid Rust gameplay event.")?;
        if event["encounter_id"].as_str() != Some(encounter_id) || event_step > step { return Err("Unknown or invalid Rust gameplay event.".into()); }
        let body = serde_json::to_string(event).unwrap();
        if let Some(prev) = delivery { if seq != prev + 1 { return Err("Rust event batch sequence gap.".into()); } }
        delivery = Some(seq);
        let stream_seq: u64 = stream.sequence.parse().unwrap_or(0);
        if seq <= stream_seq {
            match stream.recent.get(&seq.to_string()) { Some(known) if *known == body => continue, Some(_) => return Err("Rust event sequence collision.".into()), None => return Err("Unknown stale Rust event sequence. Request the retained cursor.".into()) }
        }
        if seq != stream_seq + 1 || event_step < stream.step.parse::<u64>().unwrap_or(0) { return Err("Rust event sequence gap.".into()); }
        if event["body"]["kind"] == "died" {
            let data = &event["body"]["data"];
            let team = data["team"].as_str().unwrap_or("");
            if !matches!(team, "hero" | "enemy") || data["reason"] != "combat" { return Err("Unknown Rust death provenance.".into()); }
            if team == "enemy" {
                let actor = data["actor"].as_u64().unwrap_or(0) as u32;
                let (uid, boss) = resolve_enemy(actor, data["host_id"].as_str()).ok_or("Unknown Rust enemy reward identity.")?;
                if battle_id.is_empty() { return Err("Missing WFM reward battle.".into()); }
                let amount = enemy_bag_kill_points(boss);
                stream.pending.push(PendingRow { sequence: seq.to_string(), battle_id: battle_id.into(), id: format!("enemy:{battle_id}:{uid}"), amount, enemy: PendingEnemyRef { kind: "enemy".into(), uid, enemy_role: if boss { "boss".into() } else { "ordinary".into() } } });
            }
        }
        stream.sequence = seq.to_string();
        stream.step = event_step.to_string();
        stream.recent.insert(seq.to_string(), body);
        changed = true;
    }
    if last_event_sequence != stream.sequence.parse::<u64>().unwrap_or(0) { return Err("Rust event sequence gap.".into()); }
    if !changed { return Ok(queued); }
    while stream.recent.len() > COMBAT_RECEIPT_WINDOW { let first = stream.recent.keys().next().cloned().unwrap(); stream.recent.remove(&first); }
    for row in &stream.pending { if row.amount > 0. { queued.push((row.id.clone(), row.amount)); } }
    outbox.streams.insert(encounter_id.into(), stream);
    Ok(queued)
}
/// `beginEncounter(encounterId)`: keeps only streams with pending rows.
pub fn begin_encounter(outbox: &mut OutboxState, encounter_id: &str) -> Result<(), String> {
    if encounter_id.is_empty() || encounter_id.len() > 256 { return Err("Invalid combat encounter identity.".into()); }
    if outbox.streams.get(encounter_id).is_some_and(|s| s.sequence != "0") { return Err("Rust encounter identity was already used.".into()); }
    outbox.active_encounter = Some(encounter_id.into());
    outbox.streams.retain(|_, s| !s.pending.is_empty());
    Ok(())
}
/// `settlePendingReceipts()`: pending rows move into the Bag queue and the quest recorder; returns the rows settled.
pub fn settle_pending_receipts(outbox: &mut OutboxState) -> Vec<PendingRow> {
    let pending: Vec<PendingRow> = outbox.streams.values().flat_map(|s| s.pending.iter().cloned()).collect();
    for stream in outbox.streams.values_mut() { stream.pending.clear(); }
    pending
}
