//! equipmentStorage.mjs oracle: replays the scripted transaction sequence in
//! tests/fixtures/rust-oracle/lamp.json `storage` against EquipmentStorage with a fake store.
use serde_json::{json, Value};
use std::cell::Cell;
use std::collections::BTreeMap;
use std::rc::Rc;
use wf_host::equipment::{EquipmentStorage, LampHost, Storage, EQUIPMENT_SAVE_KEY};
use wf_host::progress::HeroProgressStore;

fn fixture() -> Value {
    serde_json::from_str(&std::fs::read_to_string(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures/rust-oracle/lamp.json")).unwrap()).unwrap()
}
fn canon(v: &Value) -> Value {
    match v {
        Value::Number(n) => match n.as_f64() { Some(f) if f.fract() == 0. && f.abs() < 9007199254740992. => Value::from(f as i64), _ => v.clone() },
        Value::Array(a) => Value::Array(a.iter().map(canon).collect()),
        Value::Object(o) => Value::Object(o.iter().map(|(k, v)| (k.clone(), canon(v))).collect()),
        _ => v.clone(),
    }
}
fn first_diff(a: &Value, b: &Value, path: &str) -> Option<String> {
    match (a, b) {
        (Value::Object(x), Value::Object(y)) => {
            for k in x.keys().chain(y.keys()) {
                match (x.get(k), y.get(k)) {
                    (Some(p), Some(q)) => if let Some(d) = first_diff(p, q, &format!("{path}.{k}")) { return Some(d) },
                    (p, q) => return Some(format!("{path}.{k}: {p:?} vs {q:?}")),
                }
            }
            None
        }
        (Value::Array(x), Value::Array(y)) => {
            if x.len() != y.len() { return Some(format!("{path}: length {} vs {}", x.len(), y.len())); }
            x.iter().zip(y).enumerate().find_map(|(i, (p, q))| first_diff(p, q, &format!("{path}[{i}]")))
        }
        _ => (a != b).then(|| format!("{path}: {a} vs {b}")),
    }
}
#[track_caller]
fn assert_json(actual: &Value, expected: &Value, context: &str) {
    if let Some(diff) = first_diff(&canon(actual), &canon(expected), "$") { panic!("{context}: {diff}"); }
}
#[derive(Default)]
struct MemStore { values: Rc<std::cell::RefCell<BTreeMap<String, String>>> }
impl Storage for MemStore {
    fn get(&self, key: &str) -> Option<String> { self.values.borrow().get(key).cloned() }
    fn set(&mut self, key: &str, value: &str) -> Result<(), String> { self.values.borrow_mut().insert(key.into(), value.into()); Ok(()) }
    fn remove(&mut self, key: &str) { self.values.borrow_mut().remove(key); }
}
struct Host { progress: HeroProgressStore, gold: f64, pending_gold: BTreeMap<String, f64>, dirty: bool, revised: Vec<String> }
impl LampHost for Host {
    fn progress(&mut self) -> &mut HeroProgressStore { &mut self.progress }
    fn gold_total(&self) -> f64 { self.gold }
    fn set_gold_total(&mut self, gold: f64) { self.gold = gold; }
    fn pending_gold_settlements(&mut self) -> &mut BTreeMap<String, f64> { &mut self.pending_gold }
    fn progress_storage_error(&self) -> bool { false }
    fn persist_progress(&mut self) -> bool { self.dirty = true; true }
    fn live_hero_keys(&self) -> Vec<String> { Vec::new() }
    fn revise_hero(&mut self, key: &str) { self.revised.push(key.into()); }
    fn stage_context(&self) -> (f64, f64) { (1., 1.) }
}
fn result_json<T: serde::Serialize>(r: Result<T, String>) -> Value { match r { Ok(v) => json!({ "ok": v }), Err(e) => json!({ "error": e }) } }
#[test]
fn storage_script_matches() {
    let f = fixture();
    let values = Rc::new(std::cell::RefCell::new(BTreeMap::new()));
    let now = Rc::new(Cell::new(1000.));
    let now_read = now.clone();
    let mut store = EquipmentStorage::new(Box::new(MemStore { values: values.clone() }), None, Box::new(move || now_read.get()), Box::new(|| 42));
    let mut host = Host { progress: HeroProgressStore::fresh(), gold: 0., pending_gold: BTreeMap::from([("battle:s1".to_string(), 12.)]), dirty: false, revised: Vec::new() };
    *host.progress.bag_rewards_mut() = BTreeMap::from([("enemy:battle:s1:12".to_string(), 5.), ("tick:battle:s1:1".to_string(), 1.)]);
    let mut last_disposal_preview = None;
    for step in f["storage"].as_array().unwrap() {
        let name = step["name"].as_str().unwrap();
        now.set(step["now"].as_f64().unwrap());
        host.dirty = false;
        let result: Value = match name {
            "sync" | "sync2" => result_json(store.sync(&mut host).map(|_| Value::Null)),
            // JS returns `{...item, rewardEXP: 0}` for an emission (lamp draws grant no EXP).
            s if s.starts_with("tick") && s != "tickDeferred" => result_json(store.tick_conveyor(&mut host, 1., 1., true, false).map(|r| r.map(|i| { let mut v = json!(i); v["rewardEXP"] = json!(0); v }))),
            "tickDeferred" => result_json(store.tick_conveyor(&mut host, 1., 2., true, true).map(|r| r.map(|i| { let mut v = json!(i); v["rewardEXP"] = json!(0); v }))),
            "collect" => { let last = store.data().unwrap().emissions().last().unwrap().item.instance_id.clone(); result_json(store.collect(&mut host, &last, true).map(|r| r.map(|c| json!({ "item": c.item, "saved": c.saved, "exp": c.exp, "held": c.held })))) }
            "collectAvailable" => { let last = store.data().unwrap().emissions().last().unwrap().item.instance_id.clone(); result_json(store.collect_available(&mut host, &[last, "lamp:42:0".into()], true).map(|rs| rs.into_iter().map(|c| json!({ "item": c.item, "saved": c.saved, "exp": c.exp, "held": c.held })).collect::<Vec<_>>())) }
            "autoEquip" => result_json(store.auto_equip(&mut host)),
            "equipBad" => { let id = store.data().unwrap().discarded().first().cloned().unwrap_or("lamp:42:0".into()); result_json(store.equip(&mut host, "Falie", &id)) }
            "queueDisposal" => { let id = store.data().unwrap().discarded().first().cloned().unwrap_or_default(); result_json(store.queue_disposal(&mut host, &id).map(|_| Value::Null)) }
            "dismantle" => { let preview = store.disposal_preview(&mut host, None); match preview { Ok(p) => { last_disposal_preview = Some(p.clone()); result_json(store.dismantle(&mut host, &p).map(|d| json!({ "count": d.count, "essence": d.essence }))) } Err(e) => json!({ "error": e }) } }
            "upgrade" => result_json(store.upgrade(&mut host, None)),
            "upgradeStale" => result_json(store.upgrade(&mut host, Some(0))),
            "essence" | "essenceDup" => result_json(store.award_combat_essence(&mut host, "cot:1", 7.)),
            "guide" => result_json(store.mark_guide(&mut host, "preview")),
            "finishReview" => result_json(store.finish_review(&mut host).map(|_| Value::Null)),
            other => panic!("unknown storage step {other}"),
        };
        if name == "sync2" { *host.progress.bag_rewards_mut() = (0..20).map(|i| (format!("enemy:battle:s1:{}", 40 + i), 5.)).collect(); host.gold += 3.; let _ = store.sync(&mut host); }
        let _ = &last_disposal_preview;
        // JS `undefined` results serialize as `null` in the fixture; errors carry the message.
        let expected = &step["result"];
        // JS `undefined` and `null` results both read as "no value" here.
        let expected_norm = match expected { Value::Null => json!({}), Value::Object(o) if o.get("ok").is_some_and(|v| v.is_null()) => json!({}), other => other.clone() };
        let actual_norm = match &result { Value::Object(o) if o.get("ok").is_some_and(|v| v.is_null()) => json!({}), other => other.clone() };
        assert_json(&actual_norm, &expected_norm, &format!("storage step {name} result"));
        let save: Value = values.borrow().get(EQUIPMENT_SAVE_KEY).map(|s| serde_json::from_str(s).unwrap()).unwrap_or(Value::Null);
        assert_json(&save, &step["save"], &format!("storage step {name} save"));
        assert_eq!(host.gold, step["gold"].as_f64().unwrap(), "storage step {name} gold");
        assert_json(&json!(host.pending_gold), &step["pendingGold"], &format!("storage step {name} pending gold"));
        assert_json(&json!(host.progress.pending_bag_kill_rewards), &step["pendingKills"], &format!("storage step {name} pending kills"));
        let heroes: Value = Value::Object(host.progress.heroes.iter().map(|(k, h)| (k.clone(), json!({ "level": h.current_level, "hp": h.hp, "maxHP": h.max_hp, "stats": h.stats, "equipmentStats": h.equipment_stats, "lampEXPClaimed": h.lamp_exp_claimed, "combatPower": h.combat_power }))).collect());
        assert_json(&heroes, &step["heroes"], &format!("storage step {name} heroes"));
    }
}
