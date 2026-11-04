//! Replays `tests/fixtures/rust-oracle/progression.json` (JS combatProgressionRules + questMilestones + heroGrowthRules).
use serde_json::{json, Value};
use std::collections::BTreeMap;
use wf_meta::lamp::LampEconomy;
use wf_meta::progression::*;

fn fixture() -> Value { serde_json::from_str(&std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/../../tests/fixtures/rust-oracle/progression.json")).unwrap()).unwrap() }
fn canon(v: &Value) -> Value {
    match v {
        Value::Number(n) => n.as_f64().map_or(v.clone(), |f| if f.fract() == 0. && f.abs() < 1e15 { json!(f as i64) } else { json!(f) }),
        Value::Array(a) => Value::Array(a.iter().map(canon).collect()),
        Value::Object(o) => Value::Object(o.iter().filter(|(_, v)| !v.is_null()).map(|(k, v)| (k.clone(), canon(v))).collect()),
        other => other.clone(),
    }
}
fn first_diff(path: &str, a: &Value, b: &Value) -> Option<String> {
    match (a, b) {
        (Value::Object(x), Value::Object(y)) => { for k in x.keys().chain(y.keys()) { if let Some(d) = first_diff(&format!("{path}.{k}"), x.get(k).unwrap_or(&Value::Null), y.get(k).unwrap_or(&Value::Null)) { return Some(d); } } None }
        (Value::Array(x), Value::Array(y)) => { if x.len() != y.len() { return Some(format!("{path}: len {} vs {}", x.len(), y.len())); } for (i, (p, q)) in x.iter().zip(y).enumerate() { if let Some(d) = first_diff(&format!("{path}[{i}]"), p, q) { return Some(d); } } None }
        _ => (a != b).then(|| format!("{path}: rust {a} vs js {b}")),
    }
}
fn assert_same(label: &str, rust: &Value, js: &Value) { if let Some(d) = first_diff(label, &canon(rust), &canon(js)) { panic!("{d}"); } }
fn heroes_from(fixture: &Value, levels: &BTreeMap<String, u32>) -> Vec<QuestHero> {
    fixture["heroes"].as_array().unwrap().iter().map(|h| { let key = h["heroInstanceKey"].as_str().unwrap().to_string(); QuestHero { current_level: levels.get(&key).copied().unwrap_or(h["currentLevel"].as_u64().unwrap() as u32), instance_key: key, base_hero_name: h["baseHeroName"].as_str().unwrap().into(), max_level: h["maxLevel"].as_u64().unwrap() as u32, hp: h["hp"].as_f64().unwrap() } }).collect()
}
fn objective_value(o: &Option<Objective>) -> Value { o.as_ref().map_or(Value::Null, |o| serde_json::to_value(o).unwrap()) }

#[test]
fn state_normalization_matches() {
    let f = fixture();
    for (name, raw) in f["states"]["raw"].as_object().unwrap() {
        let state = create_state(Some(raw), 0x43544f);
        assert_same(&format!("states.{name}"), &state.to_value(), &f["states"][name]);
    }
    for row in f["growth"].as_array().unwrap() {
        let clean = sanitize_growth(Some(&row["raw"])).map_or(Value::Null, |g| serde_json::to_value(g).unwrap());
        assert_same("growth", &clean, &row["clean"]);
    }
}

#[test]
fn targets_and_presentation_match() {
    let f = fixture();
    for row in f["targets"].as_array().unwrap() {
        assert_eq!(action_target(row["type"].as_str().unwrap(), row["chapter"].as_f64().unwrap(), row["roll"].as_u64().unwrap() as u32) as u64, row["target"].as_u64().unwrap(), "{row}");
    }
    for row in f["presentations"].as_array().unwrap() {
        let objective: Option<Objective> = if row["objective"].is_null() { None } else { Some(create_state(Some(&json!({ "objective": row["objective"] })), 1).objective.unwrap_or_else(|| serde_json::from_value(row["objective"].clone()).unwrap())) };
        // Fixture objectives are hand-written rows: normalize like the rules do, but keep raw rows the normalizer rejects.
        let objective = objective.or_else(|| serde_json::from_value(row["objective"].clone()).ok());
        assert_same("presentation", &serde_json::to_value(objective_presentation(objective.as_ref())).unwrap(), &row["presentation"]);
        assert_same("reward", &objective_reward(objective.as_ref()).map_or(Value::Null, |r| serde_json::to_value(r).unwrap()), &row["reward"]);
        if let Some(o) = objective.as_ref() {
            assert_same("milestone", &milestone_presentation(o).map_or(Value::Null, |(c, l)| json!({ "category": c, "challenge": l })), &row["milestone"]);
            assert_eq!(quest_family(&o.kind), row["family"].as_str().unwrap());
            assert_eq!(valid_milestone_objective(o), row["valid"].as_bool().unwrap(), "{o:?}");
        }
    }
}

#[test]
fn driven_session_matches() {
    let f = fixture();
    let mut economy: LampEconomy = serde_json::from_value(f["economy"].clone()).unwrap();
    let mut levels: BTreeMap<String, u32> = BTreeMap::new();
    let mut chapter = 1.;
    let mut state = create_state(None, 0x43544f);
    let mut now = 0.;
    for (index, step) in f["steps"].as_array().unwrap().iter().enumerate() {
        let heroes = heroes_from(&f, &levels);
        let context = Context { equipment: Some(&economy), chapter: Some(chapter) };
        let args = &step["args"];
        let label = format!("step {index} {}", step["op"]);
        let mut result = Value::Null;
        match step["op"].as_str().unwrap() {
            "ensure" => state = ensure_objective(&state, &heroes, context),
            "record" => { let (next, changed) = record_event(&state, Event { id: args["id"].as_str().unwrap(), kind: args["type"].as_str().unwrap(), hero_id: args["heroId"].as_str() }, &heroes); state = next; result = json!({ "changed": changed }); }
            "claim" => { now = args["now"].as_f64().unwrap(); let r = claim_reward(&state, args["id"].as_str().unwrap(), &heroes, now, context); state = r.state; result = json!({ "ok": r.ok, "reason": r.reason, "receipt": r.receipt }); }
            "train" => { let r = purchase_training(&state, args["stat"].as_str().unwrap()); state = r.state; result = json!({ "ok": r.ok, "reason": r.reason, "cost": if r.ok || r.reason == Some("insufficient_incense") { Some(r.cost) } else { None }, "level": r.ok.then_some(r.level) }); }
            "spend" => { let id = args["heroId"].as_str().unwrap(); let r = spend_hero_tickets(&state, id, heroes.iter().find(|h| h.instance_key == id), args["spendId"].as_str().unwrap()); state = r.state; result = json!({ "ok": r.ok, "reason": r.reason, "cost": if r.ok || r.reason == Some("insufficient_tickets") { Some(r.cost) } else { None } }); }
            "settle" => { let (next, changed) = settle_hero_ticket_spend(&state, args["spendId"].as_str().unwrap(), &heroes); state = next; result = json!({ "changed": changed }); }
            "observe" => { let mut next = create_state(Some(&state.to_value()), state.seed); observe_chapter_milestones(&mut next, Some(args["region"].as_u64().unwrap() as u32)); state = ensure_objective(&next, &heroes, context); }
            "starUp" => { let r = star_up_hero(&state, args["heroId"].as_str().unwrap()); state = r.state; result = json!({ "ok": r.ok, "reason": r.reason, "cost": if r.ok || r.reason == Some("insufficient_tickets") { Some(r.cost) } else { None }, "stars": r.ok.then_some(r.stars) }); }
            "setLevel" => { levels.insert(args["heroId"].as_str().unwrap().into(), args["level"].as_u64().unwrap() as u32); }
            "setIncense" => { let mut raw = state.to_value(); raw["wallet"]["incense"] = args["n"].clone(); state = create_state(Some(&raw), state.seed); }
            "setTickets" => { let mut raw = state.to_value(); raw["wallet"]["ticketsByHero"][args["heroId"].as_str().unwrap()] = args["n"].clone(); state = create_state(Some(&raw), state.seed); }
            "equip" => { economy.loadouts.entry(args["heroId"].as_str().unwrap().into()).or_default().insert(args["slot"].as_str().unwrap().into(), args["itemId"].as_str().unwrap().into()); }
            "setChapter" => chapter = args["chapter"].as_f64().unwrap(),
            "abandon" => { let mut raw = state.to_value(); raw["objective"] = Value::Null; state = create_state(Some(&raw), state.seed); }
            "candidates" => { result = serde_json::to_value(milestone_candidates(&state, &heroes, context).iter().map(|o| { let mut v = serde_json::to_value(o).unwrap(); let m = v.as_object_mut().unwrap(); m.remove("id"); m.remove("progress"); m.remove("seed"); v }).collect::<Vec<_>>()).unwrap(); }
            other => panic!("unknown op {other}"),
        }
        let _ = now;
        assert_same(&format!("{label} result"), &result, &step["result"]);
        if step["op"] == "record" {
            assert_same(&format!("{label} objective"), &objective_value(&state.objective), &step["objective"]);
            assert_eq!(state.processed_events.len() as u64, step["processed"].as_u64().unwrap(), "{label}");
        } else {
            assert_same(&format!("{label} state"), &state.to_value(), &step["state"]);
        }
    }
    let heroes = heroes_from(&f, &levels);
    assert_same("eligible.all", &serde_json::to_value(eligible_ticket_heroes(&heroes).iter().map(|h| json!({ "id": h.id, "name": h.name })).collect::<Vec<_>>()).unwrap(), &f["eligible"]["all"]);
    assert_same("eligible.ready", &serde_json::to_value(eligible_hero_upgrade_targets(&state, &heroes).iter().map(|h| json!({ "id": h.id, "name": h.name })).collect::<Vec<_>>()).unwrap(), &f["eligible"]["ready"]);
}
