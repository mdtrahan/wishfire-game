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

/// Orbs roll the item rarity with the current Bag level's weights (the Bag upgrade odds table).
#[test]
fn orb_rarity_follows_the_bag_level_weights() {
    use wf_meta::lamp::{capacity_tier, collect_orb_items, drop_orb_item, LampEconomy, ORB_LIMIT};
    for tier in [0u32, 50, 99] {
        let mut data = LampEconomy::create(20261104, 0.);
        data.lamp.capacity_tier = tier;
        let mut counts = std::collections::BTreeMap::new();
        let mut total = 0;
        while total < 8000 {
            let item = drop_orb_item(&mut data, 1., 1.);
            *counts.entry(item.rarity).or_insert(0usize) += 1;
            total += 1;
            assert!(data.orb_count() <= ORB_LIMIT, "the field never holds more than its limit");
        }
        for (key, weight) in capacity_tier(tier).rarity_weights {
            let share = *counts.get(key).unwrap_or(&0) as f64 / total as f64 * 100.;
            assert!((share - weight).abs() < 1.5, "tier {tier} {key}: {share:.2}% rolled for a {weight}% weight");
            if weight == 0. { assert_eq!(share, 0., "tier {tier} never rolls {key}"); }
        }
        let first: Vec<String> = data.orbs().iter().take(5).map(|o| o.instance_id.clone()).collect();
        assert_eq!(collect_orb_items(&mut data, &first, &[]).stored.len(), 5);
    }
}

/// A full field keeps dropping: the newest orb always lands and the oldest orb of the lowest
/// rarity gives way, so an idle party's pile stays bounded and drifts toward its best drops.
#[test]
fn a_full_field_trades_its_oldest_lowest_rarity_orb_for_each_new_drop() {
    use wf_meta::equipment::rarity_index;
    use wf_meta::lamp::{drop_orb_item, trim_saved_orbs, validate_conveyor_state, LampEconomy, ORB_LIMIT};
    let mut data = LampEconomy::create(20261104, 0.);
    let mut every = Vec::new();
    for _ in 0..ORB_LIMIT { every.push(drop_orb_item(&mut data, 1., 1.)); }
    assert_eq!(data.orb_count(), ORB_LIMIT);
    for _ in 0..400 {
        let before = data.orbs();
        let lowest = before.iter().map(|o| rarity_index(&o.rarity).unwrap()).min().unwrap();
        let leaving = before.iter().find(|o| rarity_index(&o.rarity).unwrap() == lowest).unwrap().instance_id.clone();
        let item = drop_orb_item(&mut data, 1., 1.);
        let after = data.orbs();
        assert_eq!(after.len(), ORB_LIMIT);
        assert_eq!(after.last().unwrap().instance_id, item.instance_id, "the new drop is on the field");
        assert!(after.iter().all(|o| o.instance_id != leaving), "the oldest orb of the lowest rarity left");
        assert_eq!(before.iter().filter(|o| after.iter().all(|a| a.instance_id != o.instance_id)).count(), 1, "exactly one orb gives way");
        every.push(item);
    }
    validate_conveyor_state(&data.to_value()).expect("a full field is a valid save");
    // A save from before the limit (thousands of orbs) loads as the same bounded field.
    data.set_orbs(every.clone());
    let mut save = data.to_value();
    trim_saved_orbs(&mut save);
    let loaded = validate_conveyor_state(&save).expect("the trimmed save is valid");
    assert_eq!(loaded.orb_count(), ORB_LIMIT);
    let worst_kept = loaded.orbs().iter().map(|o| rarity_index(&o.rarity).unwrap()).min().unwrap();
    let kept: Vec<String> = loaded.orbs().into_iter().map(|o| o.instance_id).collect();
    assert!(every.iter().filter(|o| !kept.contains(&o.instance_id)).all(|o| rarity_index(&o.rarity).unwrap() <= worst_kept), "nothing better than a kept orb was dropped");
}
#[test]
fn a_full_bag_bar_banks_a_fill_and_leaves_the_bag_level_alone() {
    use wf_meta::lamp::{bag_fill_cost, complete_bag_fill, validate_conveyor_state, LampEconomy};
    assert_eq!((0..5).map(|n| bag_fill_cost(n as f64)).collect::<Vec<_>>(), [50., 75., 100., 125., 150.]);
    assert_eq!((bag_fill_cost(18.), bag_fill_cost(19.), bag_fill_cost(5000.)), (500., 500., 500.), "the cost stops rising at 500");
    let mut data = LampEconomy::create(20261105, 0.);
    assert_eq!((data.bag_fills(), data.fill_progress().required, data.fill_progress().fraction), (0., Some(50.), 0.));
    data.lamp.kill_points = Some(30.);
    data.lamp.essence = 60.;
    assert!(complete_bag_fill(&mut data, 1.).is_err(), "a stale request is refused");
    // Progress points are spent first, then Essence for the rest.
    assert_eq!(complete_bag_fill(&mut data, 0.), Ok(50.));
    assert_eq!((data.bag_fills(), data.kill_points(), data.lamp.essence), (1., 0., 40.));
    assert_eq!((data.lamp.capacity_tier, data.capacity()), (0, 20.), "no level, no capacity");
    assert!(complete_bag_fill(&mut data, 1.).is_err(), "40 of 75 is not a full bar");
    assert_eq!((data.bag_fills(), data.lamp.essence), (1., 40.));
    // The cascade has finished: the leftover Essence moves into the bar, which shows the same.
    let shown = data.fill_progress();
    assert_eq!(wf_meta::lamp::bank_bag_essence(&mut data), Ok(40.));
    assert_eq!((data.lamp.essence, data.kill_points(), data.fill_progress()), (0., 40., shown));
    assert_eq!(wf_meta::lamp::bank_bag_essence(&mut data), Ok(0.), "nothing left to move");
    let loaded = validate_conveyor_state(&data.to_value()).expect("banked fills are a valid save");
    assert_eq!(loaded.bag_fills(), 1.);
    let mut bad = data.to_value();
    bad["lamp"]["bagFills"] = serde_json::json!(-1);
    assert!(validate_conveyor_state(&bad).is_err());
}

#[test]
fn a_kill_drops_equipment_gold_essence_a_ticket_or_nothing() {
    use wf_meta::lamp::{field_drop, grant_essence, FieldDrop, LampEconomy, ESSENCE_DROP_CHANCE, GOLD_DROP_CHANCE, ORB_DROP_CHANCE, TICKET_DROP_CHANCE};
    // Equipment keeps its tenth; the three resources share the next 12%, most kills drop nothing.
    assert_eq!((GOLD_DROP_CHANCE, ESSENCE_DROP_CHANCE, TICKET_DROP_CHANCE), (0.05, 0.04, 0.03));
    let mut counts = [0u32; 5];
    for i in 0..10_000 {
        let roll = (i as f32 + 0.5) / 10_000.;
        counts[match field_drop(roll, ORB_DROP_CHANCE) { Some(FieldDrop::Equipment) => 0, Some(FieldDrop::Gold) => 1, Some(FieldDrop::Essence) => 2, Some(FieldDrop::Ticket) => 3, None => 4 }] += 1;
    }
    assert_eq!(counts, [1000, 500, 400, 300, 7800]);
    // Dev Tools' equipment rate moves the equipment share only.
    assert_eq!(field_drop(0.99, 1.), Some(FieldDrop::Equipment));
    assert_eq!((field_drop(0.0, 0.), field_drop(0.049, 0.), field_drop(0.06, 0.), field_drop(0.1, 0.), field_drop(0.125, 0.)), (Some(FieldDrop::Gold), Some(FieldDrop::Gold), Some(FieldDrop::Essence), Some(FieldDrop::Ticket), None));
    let mut data = LampEconomy::create(20261105, 0.);
    assert_eq!(grant_essence(&mut data, 3.), Ok(3.));
    assert_eq!(grant_essence(&mut data, f64::NAN), Ok(3.));
    assert_eq!(grant_essence(&mut data, -5.), Ok(3.));
    assert!(grant_essence(&mut data, 9_007_199_254_740_992.).is_err());
    assert_eq!(data.lamp.essence, 3.);
}

/// Owner 2026-11-05 (ORKA-63bf.34): an orb is judged when it is picked up. It enters the Bag
/// only if it raises some hero's CP over what that hero wears; otherwise it is dismantled at
/// once for its salvage Essence and uses no Bag slot.
#[test]
fn a_picked_up_orb_is_stored_if_it_raises_a_hero_cp_and_dismantled_for_essence_if_not() {
    use wf_meta::hero::HERO_DEFINITIONS;
    use wf_meta::lamp::{classify_conveyor_cache, collect_orb_items, drop_orb_item, lamp_item_cp_gain, plan_conveyor_auto_equip, salvage_value, LampEconomy, LampHero, OrbPickup};
    let heroes: Vec<LampHero> = HERO_DEFINITIONS.iter().map(|d| LampHero { instance_key: d.key.into(), definition: d, level: 1 }).collect();
    let ids = |data: &LampEconomy| data.orbs().iter().map(|o| o.instance_id.clone()).collect::<Vec<_>>();
    let mut data = LampEconomy::create(20261105, 0.);
    // A bare party: every drop raises somebody's CP and is stored.
    for _ in 0..12 { drop_orb_item(&mut data, 1., 1.); }
    let named = ids(&data);
    let first = collect_orb_items(&mut data, &named, &heroes);
    assert_eq!((first.stored.len(), first.dismantled.len(), first.essence, data.lamp.essence, data.orb_count()), (12, 0, 0., 0., 0));
    // The party equips the best of them (the Bag's Auto-Equip).
    classify_conveyor_cache(&mut data, &heroes);
    let (working, changes) = plan_conveyor_auto_equip(&data, &heroes);
    assert!(!changes.is_empty());
    data = working;
    classify_conveyor_cache(&mut data, &heroes);
    // Forty more drops, judged against what the heroes wear now.
    for _ in 0..40 { drop_orb_item(&mut data, 1., 1.); }
    let orbs = data.orbs();
    let upgrade = |data: &LampEconomy, id: &str| { let item = orbs.iter().find(|o| o.instance_id == id).unwrap(); heroes.iter().any(|h| lamp_item_cp_gain(data, item, h) > 0.) };
    let before = data.clone();
    let named = ids(&data);
    let pickup = collect_orb_items(&mut data, &named, &heroes);
    assert!(!pickup.stored.is_empty() && !pickup.dismantled.is_empty(), "{} stored, {} dismantled", pickup.stored.len(), pickup.dismantled.len());
    assert!(pickup.stored.iter().all(|i| upgrade(&before, &i.instance_id)) && pickup.dismantled.iter().all(|i| !upgrade(&before, &i.instance_id)));
    assert_eq!(pickup.essence, pickup.dismantled.iter().map(|i| salvage_value(&i.rarity)).sum::<f64>());
    assert_eq!(data.lamp.essence, before.lamp.essence + pickup.essence);
    assert_eq!(data.stored_count(), before.stored_count() + pickup.stored.len() as f64, "a dismantled orb uses no Bag slot");
    assert!(pickup.dismantled.iter().all(|i| data.item(&i.instance_id).is_none()), "and never becomes an item");
    assert_eq!(pickup.stored.len() + pickup.dismantled.len() + data.orb_count(), 40);
    // Whatever still lies there is an upgrade the full Bag could not take.
    assert!(data.orbs().iter().all(|o| upgrade(&before, &o.instance_id)) && (data.orb_count() == 0 || data.free_slots() == 0));
    // Picking the same orbs up again settles nothing twice.
    let names: Vec<String> = orbs.iter().map(|o| o.instance_id.clone()).collect();
    let left = data.orb_count();
    let again = collect_orb_items(&mut data, &names, &heroes);
    assert_eq!((again.dismantled.len(), again.essence, data.orb_count() + again.stored.len()), (0, 0., left));
    // A full Bag: upgrades wait on the field, everything else is still dismantled.
    let mut full = before.clone();
    full.lamp.salvage.count = full.capacity() - full.stored_count();
    assert_eq!(full.free_slots(), 0);
    let blocked = collect_orb_items(&mut full, &names, &heroes);
    assert_eq!((blocked.stored.len(), blocked.dismantled.len(), blocked.essence), (0, pickup.dismantled.len(), pickup.essence));
    assert_eq!(full.orb_count(), 40 - pickup.dismantled.len());
    // Unnamed orbs are never touched; without a roster nothing can be judged and all are stored.
    let mut unjudged = before.clone();
    assert_eq!(collect_orb_items(&mut unjudged, &[], &heroes), OrbPickup::default());
    let some: Vec<String> = names.iter().take(3).cloned().collect();
    let stored = collect_orb_items(&mut unjudged, &some, &[]);
    assert_eq!((stored.stored.len(), stored.dismantled.len(), unjudged.orb_count()), (3, 0, 37));
}
