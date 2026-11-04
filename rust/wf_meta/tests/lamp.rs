//! Lamp/Bag economy oracle (tests/fixtures/rust-oracle/lamp.json) from lampGear.mjs,
//! lampConveyor.mjs, equipment.mjs and formatCompactCount.mjs.
use serde_json::{json, Value};
use wf_meta::equipment::{format_compact_count, RARITIES};
use wf_meta::hero;
use wf_meta::lamp::*;

fn fixture() -> Value {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures/rust-oracle/lamp.json");
    serde_json::from_str(&std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{}: {e}", path.display()))).unwrap()
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
fn n(v: &Value) -> f64 { v.as_f64().unwrap_or_else(|| panic!("number expected, got {v}")) }
fn heroes_of(store: &Value) -> Vec<LampHero> {
    // lampHeroRoster: the canonical records whose heroInstanceKey equals the definition key.
    hero::HERO_DEFINITIONS.iter().filter_map(|d| {
        let r = store["heroes"].get(d.key)?;
        (r["heroInstanceKey"].as_str() == Some(d.key)).then(|| LampHero { instance_key: d.key.into(), definition: d, level: r["currentLevel"].as_u64().unwrap() as u32 })
    }).collect()
}
fn result_json<T: serde::Serialize>(r: &Result<T, String>) -> Value { match r { Ok(v) => json!({ "ok": v }), Err(e) => json!({ "error": e }) } }
fn candidates_json(c: &[Candidate], gains: bool) -> Value {
    Value::Array(c.iter().map(|c| { let mut o = json!({ "id": c.item.instance_id, "queue": c.queue, "bestGain": c.best_gain, "bestHeroId": c.best_hero_id }); if gains { o["gains"] = Value::Array(c.gains.iter().map(|(id, g)| json!({ "heroId": id, "cpGain": g })).collect()); } o }).collect())
}

#[test]
fn tiers_units_ordinals_items_match() {
    let f = fixture();
    for (i, t) in f["tiers"].as_array().unwrap().iter().enumerate() {
        let tier = capacity_tier(i as u32);
        assert_eq!(tier.capacity, n(&t["capacity"]), "tier {i} capacity");
        assert_eq!(tier.cost, t["cost"].as_f64(), "tier {i} cost");
        for (key, weight) in tier.rarity_weights { assert_eq!(weight, n(&t["rarityWeights"][key]), "tier {i} {key}"); }
    }
    for u in f["units"].as_array().unwrap() { assert_eq!(seeded_unit(n(&u["seed"]) as u32, n(&u["sequence"]) as u32, n(&u["salt"]) as u32), n(&u["value"]), "unit {u}"); }
    for o in f["ordinals"].as_array().unwrap() { assert_eq!(progression_ordinal(n(&o["region"]), n(&o["stage"])) as f64, n(&o["value"]), "ordinal {o}"); }
    let default_weights: Vec<(&str, f64)> = RARITIES.iter().map(|r| (r.key, r.weight)).collect();
    for c in f["items"].as_array().unwrap() {
        let weights = if c["tier"].is_null() { default_weights.clone() } else { capacity_tier(n(&c["tier"]) as u32).rarity_weights.to_vec() };
        let item = generate_lamp_item(n(&c["seed"]) as u32, n(&c["sequence"]) as u32, n(&c["ordinal"]) as u32, &weights);
        assert_json(&serde_json::to_value(&item).unwrap(), &c["item"], &format!("item seed {} tier {} ordinal {} seq {}", c["seed"], c["tier"], c["ordinal"], c["sequence"]));
    }
    for c in f["compact"].as_array().unwrap() { assert_eq!(format_compact_count(n(&c["value"])), c["text"].as_str().unwrap(), "compact {c}"); }
    for s in f["salvage"].as_array().unwrap() { assert_eq!(salvage_value(s["rarity"].as_str().unwrap()), n(&s["value"])); }
}
#[test]
fn earned_69_review_matches() {
    let f = fixture();
    let fx = &f["fixture69"];
    let heroes = heroes_of(&fx["heroes"]);
    let economy = validate_lamp_economy(&fx["economy"], 5).unwrap();
    assert_json(&economy.to_value(), &fx["normalized"], "normalized economy");
    let review = lamp_review_candidates(&economy, &heroes);
    assert_json(&candidates_json(&review, true), &fx["review"], "review candidates");
    for g in fx["gearCP"].as_array().unwrap() { assert_eq!(lamp_gear_cp(economy.item(g["id"].as_str().unwrap()).unwrap()), n(&g["cp"]), "gear cp {}", g["id"]); }
    for h in fx["heroCP"].as_array().unwrap() { let hero = heroes.iter().find(|x| x.instance_key == h["id"].as_str().unwrap()).unwrap(); assert_eq!(lamp_hero_cp(&economy, hero), n(&h["cp"]), "hero cp {}", h["id"]); }
    for c in fx["compare"].as_array().unwrap() {
        let item = economy.item(c["id"].as_str().unwrap()).unwrap();
        let cmp = compare_lamp_item(&economy, item, c["hero"].as_str().unwrap());
        assert_eq!(cmp.upgrade, c["upgrade"].as_bool().unwrap(), "compare {c}");
        assert_json(&serde_json::to_value(&cmp.deltas).unwrap(), &c["deltas"], &format!("deltas {}", c["id"]));
    }
    let (working, changes) = plan_conveyor_auto_equip(&economy, &heroes);
    assert_json(&working.to_value(), &fx["conveyorPlan"]["working"], "auto-equip working copy");
    assert_json(&Value::Array(changes.iter().map(|c| json!({ "heroId": c.hero_id, "item": c.item.instance_id })).collect()), &fx["conveyorPlan"]["changes"], "auto-equip changes");
}
#[test]
fn kill_points_ticks_upgrades_guides_match() {
    let f = fixture();
    let mut kp = LampEconomy::create(5, 0.);
    for k in f["kills"].as_array().unwrap() {
        let out = award_lamp_kill_points(&mut kp, k["id"].as_str().unwrap(), n(&k["amount"]));
        let out_json = match &out { Ok(KillPointsResult::Applied(t)) => json!({ "ok": { "applied": true, "killPoints": t } }), Ok(KillPointsResult::Duplicate) => json!({ "ok": { "applied": false, "duplicate": true } }), Ok(KillPointsResult::Max) => json!({ "ok": { "applied": false, "max": true } }), Err(e) => json!({ "error": e }) };
        assert_json(&out_json, &k["out"], &format!("kill {}", k["id"]));
        assert_json(&serde_json::to_value(&kp.settled_bag_kill_rewards).unwrap(), &k["receipts"], &format!("receipts after {}", k["id"]));
        assert_eq!(kp.lamp.kill_points, k["killPoints"].as_f64(), "points after {}", k["id"]);
    }
    let pending = std::collections::BTreeMap::from([("tick:battle:s1:9".to_string(), 1.)]);
    let mut clock: Option<BagClock> = None;
    for t in f["ticks"].as_array().unwrap() {
        let maxed = t["maxed"].as_bool().unwrap_or(false);
        let data = if maxed { let mut m = LampEconomy::create(5, 0.); m.lamp.capacity_tier = LAMP_LEVELS as u32 - 1; m } else { kp.clone() };
        let none = std::collections::BTreeMap::new();
        let (next, rewards) = advance_lamp_combat_progress(if maxed { None } else { clock.as_ref() }, "battle:s1", n(&t["seconds"]), Some(&data), if maxed { &none } else { &pending }).unwrap();
        assert_json(&next.as_ref().map_or(Value::Null, |c| json!({ "battleId": c.battle_id, "index": c.index, "seconds": c.seconds })), &t["clock"], &format!("tick clock {}", t["seconds"]));
        assert_json(&Value::Array(rewards.iter().map(|r| json!({ "id": r.id, "amount": r.amount })).collect()), &t["rewards"], &format!("tick rewards {}", t["seconds"]));
        if !maxed { clock = next; }
    }
    let up = &f["upgrade"];
    let mut economy = LampEconomy::create(9, 0.);
    economy.lamp.essence = 60.; economy.lamp.kill_points = Some(50.);
    let progress = |p: UpgradeProgress| json!({ "current": p.current, "required": p.required, "max": p.max, "fraction": p.fraction });
    assert_json(&progress(economy.upgrade_progress()), &up["before"], "progress before");
    assert_json(&result_json(&upgrade_lamp(&mut economy, 0)), &up["first"], "first upgrade");
    assert_json(&progress(economy.upgrade_progress()), &up["after"], "progress after");
    assert_json(&economy.to_value(), &up["state"], "upgrade state");
    assert_json(&result_json(&upgrade_lamp(&mut economy, 0)), &up["stale"], "stale upgrade");
    assert_json(&result_json(&upgrade_lamp(&mut economy, 1)), &up["short"], "short upgrade");
    let mut paid = LampEconomy::create(3, 0.);
    paid.lamp.extra.insert("upgradeStage".into(), json!(2)); paid.lamp.extra.insert("upgradeEndsAt".into(), json!(0));
    assert_eq!(restore_paid_lamp_upgrade(&mut paid).unwrap(), f["restore"]["applied"].as_bool().unwrap());
    assert_json(&paid.to_value(), &f["restore"]["state"], "restored paid upgrade");
    assert_eq!(restore_paid_lamp_upgrade(&mut paid).unwrap(), f["restore"]["again"].as_bool().unwrap());
    let mut guide = validate_lamp_economy(&f["fixture69"]["economy"], 5).unwrap();
    let mut empty = LampEconomy::create(1, 0.);
    let g = &f["guides"];
    assert_json(&result_json(&mark_lamp_guide(&mut guide, "storage")), &g["storage"], "guide storage");
    assert_json(&result_json(&mark_lamp_guide(&mut guide, "comparison")), &g["comparison"], "guide comparison");
    assert_json(&result_json(&mark_lamp_guide(&mut guide, "preview")), &g["preview"], "guide preview");
    assert_json(&result_json(&mark_lamp_guide(&mut guide, "x")), &g["unknown"], "guide unknown");
    assert_json(&result_json(&mark_lamp_guide(&mut empty, "storage")), &g["empty"], "guide empty");
    assert_eq!(guide.lamp.guide, g["state"].as_f64());
}
#[test]
fn validation_and_migrations_match() {
    let f = fixture();
    for case in f["validation"].as_array().unwrap() {
        let name = case["name"].as_str().unwrap();
        match validate_lamp_economy(&case["input"], 5) {
            Ok(e) => { assert!(case.get("error").is_none(), "validation {name}: expected error {}", case["error"]); assert_json(&e.to_value(), &case["ok"], &format!("validation {name}")); }
            Err(e) => assert_eq!(Some(e.as_str()), case["error"].as_str(), "validation {name}"),
        }
    }
    for case in f["migrations"].as_array().unwrap() {
        let name = case["name"].as_str().unwrap();
        let out = match name { "v4" => migrate_v4(&case["input"]), "v3" => migrate_v3(&case["input"]), "v2" => migrate_v2(&case["input"]), _ => migrate_v1(&case["input"], 77) };
        match out {
            Ok(e) => { assert!(case.get("error").is_none(), "migration {name}: expected error {}", case["error"]); assert_json(&e.to_value(), &case["ok"], &format!("migration {name}")); }
            Err(e) => assert_eq!(Some(e.as_str()), case["error"].as_str(), "migration {name}"),
        }
    }
    for case in f["conveyor"]["invalid"].as_array().unwrap() {
        let name = case["name"].as_str().unwrap();
        match validate_conveyor_state(&case["input"]) {
            Ok(e) => { assert!(case.get("error").is_none(), "conveyor validation {name}: expected error {}", case["error"]); assert_json(&e.to_value(), &case["ok"], &format!("conveyor validation {name}")); }
            Err(e) => assert_eq!(Some(e.as_str()), case["error"].as_str(), "conveyor validation {name}"),
        }
    }
}
#[test]
fn conveyor_script_matches() {
    let f = fixture();
    let roster: Vec<LampHero> = f["conveyor"]["roster"].as_array().unwrap().iter().map(|id| { let key = id.as_str().unwrap(); LampHero { instance_key: key.into(), definition: hero::hero_definition(key).unwrap(), level: 1 } }).collect();
    let mut conv = validate_conveyor_state(&LampEconomy::create(11, 0.).to_value()).unwrap();
    let mut last_preview: Option<DisposalPreview> = None;
    for step in f["conveyor"]["script"].as_array().unwrap() {
        let name = step["name"].as_str().unwrap();
        let t = n(&step["t"]);
        let hero = |id: &str| roster.iter().find(|h| h.instance_key == id);
        let collect_json = |r: Result<CollectResult, String>| result_json(&r.map(|c| json!({ "item": c.item, "saved": c.saved, "exp": c.exp, "held": c.held })));
        let result: Value = match name {
            "emit" | "emitCooldown" => result_json(&emit_conveyor_item(&mut conv, 1., 1., t)),
            s if s.starts_with("emitFull") || (s.starts_with("emit") && s[4..].parse::<u32>().is_ok()) => result_json(&emit_conveyor_item(&mut conv, 2., 3., t)),
            "collect" | "collectAgain" => collect_json(collect_conveyor_item(&mut conv, "lamp:11:0", t, false)),
            "collectUnknown" => collect_json(collect_conveyor_item(&mut conv, "lamp:11:9", t, false)),
            s if s.starts_with("auto") && s != "autoPlan" => collect_json(collect_conveyor_item(&mut conv, &format!("lamp:11:{}", &s[4..]), t, true)),
            "expired" => collect_json(collect_conveyor_item(&mut conv, "lamp:11:1", t + 40000., false)),
            "holdManual" => collect_json(collect_conveyor_item(&mut conv, "lamp:11:22", t, false)),
            "holdSecond" => collect_json(collect_conveyor_item(&mut conv, "lamp:11:23", t, false)),
            "classify" | "classify2" => json!({ "ok": candidates_json(&classify_conveyor_cache(&mut conv, &roster), false) }),
            "classify3" => json!({ "ok": classify_conveyor_cache(&mut conv, &roster).iter().map(|c| json!({ "id": c.item.instance_id, "queue": c.queue, "bestGain": c.best_gain })).collect::<Vec<_>>() }),
            "review" => json!({ "ok": candidates_json(&conveyor_review_candidates(&conv, &roster), false) }),
            "equipHeld" => {
                let held = conveyor_review_candidates(&conv, &roster).into_iter().find(|c| c.queue == "held").unwrap();
                match held.best_hero_id { None => json!({ "error": format!("held item not an upgrade: {}", held.best_gain) }), Some(id) => result_json(&equip_conveyor_item(&mut conv, &id, &held.item.instance_id, hero(&id))) }
            }
            "equipBad" => result_json(&equip_conveyor_item(&mut conv, "Falie", "lamp:11:2", hero("Runa"))),
            "autoPlan" => { let (working, changes) = plan_conveyor_auto_equip(&conv, &roster); conv = working; json!({ "ok": changes.iter().map(|c| json!({ "heroId": c.hero_id, "item": c.item.instance_id })).collect::<Vec<_>>() }) }
            "queueDisposal" => { let id = conv.discarded()[0].clone(); match queue_conveyor_disposal(&mut conv, &id, &roster) { Ok(()) => json!({}), Err(e) => json!({ "error": e }) } }
            "queueUseful" => { let id = conv.lamp.pending.first().cloned().unwrap_or("lamp:11:0".into()); match queue_conveyor_disposal(&mut conv, &id, &roster) { Ok(()) => json!({}), Err(e) => json!({ "error": e }) } }
            "preview" | "previewUseful" => {
                let ids = if name == "previewUseful" { Some(vec![conv.lamp.pending.first().cloned().unwrap_or("lamp:11:0".into())]) } else { None };
                let r = conveyor_disposal_preview(&conv, &roster, ids.as_deref());
                if let Ok(p) = &r { last_preview = Some(p.clone()); }
                result_json(&r.map(|p| json!({ "ids": p.ids, "signature": p.signature, "legacy": p.legacy, "essence": p.essence })))
            }
            "dismantle" | "dismantleEmpty" => {
                let r = conveyor_disposal_preview(&conv, &roster, None).and_then(|p| dismantle_conveyor_items(&mut conv, &p, &roster));
                result_json(&r.map(|d| json!({ "count": d.count, "essence": d.essence })))
            }
            "validateConveyor" => result_json(&validate_conveyor_state(&conv.to_value()).map(|_| true)),
            other => panic!("unknown step {other}"),
        };
        let _ = &last_preview;
        assert_json(&result, &step["result"], &format!("conveyor step {name} result"));
        assert_json(&conv.to_value(), &step["state"], &format!("conveyor step {name} state"));
    }
}
