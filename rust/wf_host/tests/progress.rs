//! Hero progression oracle (tests/fixtures/rust-oracle/hero_progress.json): EXP awards, the
//! `createHeroProgressStore` normalization, presets and `restoreHeroProgressFromStorage`.
use serde_json::{json, Value};
use std::cell::RefCell;
use std::rc::Rc;
use wf_host::progress::{HeroProgress, HeroProgressStore};
use wf_host::session::Session;
use wf_meta::enemy::parse_c2_table;

fn fixture() -> Value {
    serde_json::from_str(&std::fs::read_to_string(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures/rust-oracle/hero_progress.json")).unwrap()).unwrap()
}
fn amount(v: &Value) -> f64 { if v.as_str() == Some("NaN") { f64::NAN } else { v.as_f64().unwrap() } }
/// JSON.stringify writes integral numbers without a fraction; serde writes f64 fields as `75.0`.
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
#[test]
fn award_hero_exp_matches() {
    for case in fixture()["award"].as_array().unwrap() {
        let mut hero: HeroProgress = serde_json::from_value(case["before"].clone()).unwrap();
        let result = hero.award_exp(amount(&case["amount"]));
        let context = format!("award {} lvl {} amount {}", case["before"]["heroInstanceKey"], case["before"]["currentLevel"], case["amount"]);
        assert_json(&serde_json::to_value(&result).unwrap(), &case["result"], &format!("{context}: result"));
        assert_json(&serde_json::to_value(&hero).unwrap(), &case["after"], &format!("{context}: hero"));
    }
}
#[test]
fn store_normalization_matches() {
    for case in fixture()["stores"].as_array().unwrap() {
        let name = case["name"].as_str().unwrap();
        let input = case.get("input").filter(|v| !v.is_null());
        match HeroProgressStore::from_snapshot(input) {
            Ok(store) => { assert!(case.get("error").is_none(), "store {name}: expected error {}", case["error"]); assert_json(&serde_json::to_value(&store).unwrap(), &case["output"], &format!("store {name}")); }
            Err(error) => assert_eq!(Some(error.as_str()), case["error"].as_str(), "store {name}"),
        }
    }
}
#[test]
fn level_presets_match() {
    let f = fixture();
    let sanitized = f["stores"].as_array().unwrap().iter().find(|c| c["name"] == "sanitized").unwrap();
    for case in f["presets"].as_array().unwrap() {
        let mut store = HeroProgressStore::from_snapshot(Some(&sanitized["input"])).unwrap();
        store.set_level(case["level"].as_u64().unwrap() as u32, case["partyEXP"].as_f64().unwrap()).unwrap();
        assert_json(&serde_json::to_value(&store.heroes).unwrap(), &case["heroes"], &format!("preset {}", case["level"]));
    }
    assert!(HeroProgressStore::fresh().set_level(0, 0.).is_err());
    assert!(HeroProgressStore::fresh().set_level(5, -1.).is_err());
}
#[test]
fn restore_matches() {
    let f = fixture();
    let rows = parse_c2_table(&std::fs::read_to_string(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../web-runner/assets/enemies.json")).unwrap()).unwrap();
    for case in f["restores"].as_array().unwrap() {
        let name = case["name"].as_str().unwrap();
        let input = f["stores"].as_array().unwrap().iter().find(|c| c["name"] == case["name"]).unwrap().get("input").cloned().unwrap();
        let store = HeroProgressStore::from_snapshot(Some(&input)).unwrap();
        let saved: Rc<RefCell<Option<Value>>> = Rc::new(RefCell::new(None));
        let sink = saved.clone();
        let session = Session::new(7, rows.clone(), store, &[("Falie", "falie#1"), ("Huun", "huun#1"), ("Runa", "runa#1"), ("Kojonn", "kojonn#1")], "oracle", 90, Box::new(move |s| { *sink.borrow_mut() = Some(serde_json::to_value(s).unwrap()); true }), Box::new(|_, _| {}));
        assert_eq!(session.failed, None, "restore {name}");
        assert_json(&serde_json::to_value(&session.progress).unwrap(), &case["store"], &format!("restore {name}: store"));
        assert_json(&saved.borrow().clone().unwrap_or(Value::Null), &case["saved"], &format!("restore {name}: persisted save"));
        assert_eq!(session.gold_total, case["goldTotal"].as_f64().unwrap(), "restore {name}: gold");
        assert_json(&serde_json::to_value(&session.pending_gold_settlements).unwrap(), &case["pendingGold"], &format!("restore {name}: pending gold"));
        let s = &session.stage;
        let stage = json!({ "region": s.region, "stage": s.stage, "wave": s.wave, "bossAvailable": s.boss_available, "bossSummonRequired": s.boss_summon_required, "clearedBosses": s.cleared_bosses, "bossUID": s.boss_uid, "clearedPackMask": s.cleared_pack_mask, "seed": s.seed, "transitions": s.transitions });
        assert_json(&stage, &case["stage"], &format!("restore {name}: stage"));
        let heroes: Vec<Value> = session.heroes.iter().map(|h| json!({ "key": h.instance_key, "level": h.level, "hp": h.hp, "maxHP": h.max_hp, "exp": session.progress.heroes[&h.instance_key].current_exp })).collect();
        assert_json(&Value::Array(heroes), &case["heroes"], &format!("restore {name}: live heroes"));
    }
}
