//! JS oracle parity: every case in `tests/fixtures/rust-oracle/*.json` (written by
//! `tools/rust_oracle/write_fixtures.mjs` from the real JS modules) must match the Rust translation.
use serde_json::Value;
use std::collections::BTreeMap;
use wf_meta::{combat_power::*, enemy::*, geometry, hero, seeded_rng::*, shadow, stage::*, subwaves, wfm_config::*};

fn fixture(name: &str) -> Value {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures/rust-oracle").join(name);
    serde_json::from_str(&std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{}: {e}", path.display()))).unwrap()
}
fn n(v: &Value) -> f64 { v.as_f64().unwrap_or_else(|| panic!("number expected, got {v}")) }
fn get<'a>(v: &'a Value, key: &str) -> &'a Value { v.get(key).unwrap_or_else(|| panic!("missing key {key} in {v}")) }
/// Every key in `expected` must be present and equal in `actual` (numbers compared as f64 exactly).
fn assert_subset(expected: &Value, actual: &Value, path: &str) {
    match (expected, actual) {
        (Value::Object(e), Value::Object(a)) => for (k, ev) in e { assert_subset(ev, a.get(k).unwrap_or_else(|| panic!("{path}.{k}: missing in actual {actual}")), &format!("{path}.{k}")); },
        (Value::Array(e), Value::Array(a)) => { assert_eq!(e.len(), a.len(), "{path}: length"); for (i, (ev, av)) in e.iter().zip(a).enumerate() { assert_subset(ev, av, &format!("{path}[{i}]")); } }
        (Value::Number(_), Value::Number(_)) => assert!(n(expected) == n(actual), "{path}: expected {expected} got {actual}"),
        (Value::Null, Value::Null) => {}
        _ => assert_eq!(expected, actual, "{path}"),
    }
}
fn stats6(v: &Value) -> shadow::Stats6 { shadow::Stats6 { hp: n(get(v, "HP")), atk: n(get(v, "ATK")), def: n(get(v, "DEF")), mag: n(get(v, "MAG")), res: n(get(v, "RES")), spd: n(get(v, "SPD")) } }
fn raw_rows() -> Vec<RawRow> { parse_c2_table(&std::fs::read_to_string(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../web-runner/assets/enemies.json")).unwrap()).unwrap() }

#[test]
fn seeded_rng_matches() {
    for case in fixture("seeded_rng.json").as_array().unwrap() {
        assert_eq!(preview_seeded_rng(n(get(case, "seed")), n(get(case, "draws"))), n(get(case, "value")), "{case}");
    }
}
#[test]
fn enemy_rows_match() {
    let f = fixture("enemy_rows.json");
    let rows = raw_rows();
    assert_subset(get(&f, "raw"), &serde_json::to_value(&rows).unwrap(), "raw");
    let mapped: Vec<Value> = enemy_data(&rows).iter().map(|r| serde_json::to_value(r).unwrap()).collect();
    for (i, expected) in get(&f, "mapped").as_array().unwrap().iter().enumerate() {
        for key in ["name", "HP", "ATK", "DEF", "MAG", "RES", "SPD", "maxHP", "combatTier", "enemyRole", "CombatPower"] { assert_subset(get(expected, key), get(&mapped[i], key), &format!("mapped[{i}].{key}")); }
    }
}
#[test]
fn combat_power_matches() {
    for case in fixture("combat_power.json").as_array().unwrap() {
        let cp = if let Some(legacy) = case.get("legacy") { let l = legacy.as_array().unwrap(); compute_combat_power_legacy(n(&l[0]), n(&l[1]), n(&l[2])) } else {
            let i = get(case, "input");
            let stat = |k: &str| i.get(k).and_then(Value::as_f64).unwrap_or(0.);
            let hp = i.get("HP").and_then(Value::as_f64).or_else(|| i.get("maxHP").and_then(Value::as_f64)).unwrap_or(0.);
            compute_combat_power(CpActor::new(1., stat("ATK"), stat("MAG"), stat("DEF"), stat("RES"), hp, stat("SPD")))
        };
        assert_eq!(cp, n(get(case, "cp")), "{case}");
    }
}
#[test]
fn hero_levels_match() {
    let f = fixture("hero_levels.json");
    for (key, d) in get(&f, "definitions").as_object().unwrap() {
        let def = hero::hero_definition(key).unwrap();
        assert_eq!(def.name, get(d, "name").as_str().unwrap());
        assert_subset(get(d, "baseStats"), &serde_json::to_value(def.base).unwrap(), "base");
        assert_subset(get(d, "growth"), &serde_json::to_value(def.growth).unwrap(), "growth");
    }
    for case in get(&f, "cases").as_array().unwrap() {
        let def = hero::hero_definition(get(case, "key").as_str().unwrap()).unwrap();
        let level = n(get(case, "level")) as u32;
        let equipment: BTreeMap<String, f64> = case.get("equipmentStats").map(|e| e.as_object().unwrap().iter().map(|(k, v)| (k.clone(), n(v))).collect()).unwrap_or_default();
        let stats = hero::level_stats(def, level, &equipment);
        assert_subset(get(case, "levelStats"), &serde_json::to_value(stats).unwrap(), "levelStats");
        assert_eq!(hero::max_hp(stats.hp, 1.), n(get(case, "maxHP")), "{case}");
        if let Some(exp) = case.get("expToNext") { assert_eq!(hero::exp_to_next_level(level), n(exp), "exp level {level}"); }
        assert_eq!(compute_combat_power(CpActor::new(level as f64, stats.atk, stats.mag, stats.def, stats.res, stats.hp, stats.spd)), n(get(case, "cp")), "cp {case}");
    }
}
#[test]
fn geometry_matches() {
    let f = fixture("geometry.json");
    assert_subset(get(&f, "world"), &serde_json::to_value(geometry::world_bounds()).unwrap(), "world");
    assert_subset(get(&f, "vertical"), &serde_json::to_value(geometry::vertical_bounds()).unwrap(), "vertical");
    assert_subset(get(&f, "patrol"), &serde_json::to_value(geometry::ordinary_patrol_bounds()).unwrap(), "patrol");
    assert_subset(get(&f, "formation4"), &serde_json::to_value(geometry::start_formation(4)).unwrap(), "formation4");
    assert_subset(get(&f, "moat"), &serde_json::to_value(geometry::spawn_moat()).unwrap(), "moat");
    let slice = get(&f, "slice");
    let (min, max) = geometry::slice_floor();
    assert_subset(get(slice, "floor"), &serde_json::json!({"min": min, "max": max}), "floor");
    assert_subset(get(slice, "origin"), &serde_json::to_value(geometry::slice_origin()).unwrap(), "origin");
    for (i, p) in get(slice, "heroPositions").as_array().unwrap().iter().enumerate() { assert_subset(p, &serde_json::to_value(geometry::slice_hero_position(i)).unwrap(), "heroPosition"); }
    for case in get(&f, "packPositions").as_array().unwrap() {
        let p = geometry::Point { x: n(get(case, "x")), y: n(get(case, "y")) };
        assert_subset(get(case, "ordinary"), &serde_json::to_value(geometry::slice_pack_position(p, false)).unwrap(), "ordinary");
        assert_subset(get(case, "boss"), &serde_json::to_value(geometry::slice_pack_position(p, true)).unwrap(), "boss");
    }
}
fn stage_state(v: &Value) -> StageState { serde_json::from_value(v.clone()).unwrap_or_else(|e| panic!("state {v}: {e}")) }
#[test]
fn spawn_plans_and_activation_match() {
    let rows = enemy_data(&raw_rows());
    for case in fixture("spawn_plans.json").as_array().unwrap() {
        let state = stage_state(get(case, "state"));
        let label = format!("seed {} region {} wave {} boss {} mask {}", state.seed, state.region, state.wave, state.boss_active, state.cleared_pack_mask);
        let stage = get_stage(&state);
        assert_eq!(stage.id, get(get(case, "stage"), "id").as_str().unwrap(), "{label}");
        let plan = build_spawn_plan(&rows, &state, 0, n(get(case, "partyCP")), n(get(case, "enemySize"))).unwrap();
        let expected = get(case, "plan").as_array().unwrap();
        assert_eq!(plan.len(), expected.len(), "{label}: plan length");
        for (i, (e, p)) in expected.iter().zip(&plan).enumerate() {
            let actual = serde_json::to_value(p).unwrap();
            assert_eq!(get(e, "name").as_str().unwrap(), p.row.name, "{label} [{i}]");
            assert_subset(get(e, "row"), get(&actual, "row"), &format!("{label} [{i}].row"));
            for key in ["lane", "rank", "packIndex", "entryOrder", "sectorIndex", "slotIndex", "sectorSize", "isSolo", "soloFootX", "soloFootY"] { assert_subset(get(e, key), get(&actual, key), &format!("{label} [{i}].{key}")); }
        }
        let boss = state.boss_active;
        for (i, (e, p)) in get(case, "spawned").as_array().unwrap().iter().zip(&plan).enumerate() {
            let a = activate_entry(&state, n(get(case, "enemySize")), p, boss, boss.then_some(1340.)).unwrap();
            let actual = serde_json::to_value(&a).unwrap();
            for key in ["x", "y", "streamWalkSpeed", "streamSectorIndex", "streamEngagementGroupId", "streamDelivery", "streamSolo", "streamSoloPhase", "streamEngageX", "combatRank"] { assert_subset(get(e, key), get(&actual, key), &format!("{label} spawned[{i}].{key}")); }
            assert_subset(get(e, "slicePosition"), &serde_json::to_value(geometry::slice_pack_position(geometry::Point { x: a.x, y: a.y }, p.row.name == "Troll")).unwrap(), &format!("{label} spawned[{i}].slicePosition"));
        }
        if !boss {
            let names: Vec<String> = plan.iter().map(|p| p.row.name.clone()).collect();
            assert_subset(get(case, "subwaves"), &serde_json::to_value(subwaves::author_subwaves(&names)).unwrap(), &format!("{label} subwaves"));
        }
    }
}
#[test]
fn subwave_authoring_matches() {
    let f = fixture("subwaves.json");
    for case in get(&f, "author").as_array().unwrap() {
        let keys: Vec<String> = get(case, "keys").as_array().unwrap().iter().map(|v| v.as_str().unwrap().to_string()).collect();
        assert_subset(get(case, "subwaves"), &serde_json::to_value(subwaves::author_subwaves(&keys)).unwrap(), "author");
    }
    let rows = enemy_data(&raw_rows());
    for case in get(&f, "chapterOne").as_array().unwrap() {
        let seed = n(get(case, "seed"));
        for stage in get(case, "stages").as_array().unwrap() {
            for (w, wave) in get(stage, "waves").as_array().unwrap().iter().enumerate() {
                let state = StageState { wave: w as u32 + 1, transitions: w as u32, ..create_stage_state(seed, 1, n(get(stage, "stage")) as u32) };
                let names: Vec<String> = build_spawn_plan(&rows, &state, 0, n(get(case, "partyCP")), 40.).unwrap().iter().map(|p| p.row.name.clone()).collect();
                assert_subset(get(wave, "subwaves"), &serde_json::to_value(subwaves::author_subwaves(&names)).unwrap(), &format!("chapter one wave {}", w + 1));
            }
        }
    }
}
#[test]
fn stage_transitions_match() {
    for case in fixture("stage_transitions.json").as_array().unwrap() {
        if let Some(before) = case.get("before") {
            let state = stage_state(before);
            let t = advance_stage(&state);
            assert_subset(get(case, "after"), &serde_json::to_value(&t.state).unwrap(), "advance");
            assert_eq!(t.stage.id, get(case, "stageId").as_str().unwrap());
            assert_eq!(t.cleared_boss.as_deref(), get(case, "clearedBoss").as_str());
            assert_eq!(wave_clear_event_id(&state), get(case, "eventId").as_str().unwrap());
        } else {
            let state = stage_state(get(case, "defeat"));
            assert_subset(get(case, "after"), &serde_json::to_value(reset_after_defeat(&state, 12.5)).unwrap(), "defeat");
        }
    }
}
#[test]
fn wfm_config_matches() {
    let f = fixture("wfm_config.json");
    for (name, d) in get(get(&f, "definitions"), "enemies").as_object().unwrap() {
        let def = shadow::enemy_definition(name).unwrap();
        assert_eq!(def.id, get(d, "id").as_str().unwrap());
        assert_subset(get(d, "stats"), &serde_json::to_value(def.stats).unwrap(), name);
    }
    for case in get(&f, "growth").as_array().unwrap() {
        assert_subset(get(case, "multipliers"), &serde_json::to_value(hero::star_skill_multipliers(n(get(case, "stars")) as u32)).unwrap(), "growth");
    }
    let training = |v: Option<&Value>| v.filter(|v| v.is_object()).map(|v| hero::Training { atk: n(get(v, "ATK")) as u32, def: n(get(v, "DEF")) as u32, matk: n(get(v, "MATK")) as u32, res: n(get(v, "RES")) as u32 });
    for case in get(&f, "modifiers").as_array().unwrap() {
        let stars = case.get("stars").and_then(|s| s.get("Falie")).map_or(0, |v| n(v) as u32);
        let def = hero::hero_definition("Falie").unwrap();
        let raw = hero::level_stats(def, 3, &BTreeMap::new());
        let mods = hero::permanent_hero_modifiers(training(case.get("training")), stars, &raw);
        assert_subset(get(case, "modifiers"), &serde_json::to_value(&mods).unwrap(), "modifiers");
    }
    let raws = raw_rows();
    let data = enemy_data(&raws);
    for case in get(&f, "projection").as_array().unwrap() {
        let name = get(case, "name").as_str().unwrap();
        let raw = raws.iter().find(|r| r.name == name).unwrap();
        let mapped = data.iter().find(|r| r.name == name).unwrap();
        let projected = shadow::project_shadow_stats(shadow::Stats6 { hp: mapped.hp, atk: mapped.atk, def: mapped.def, mag: mapped.mag, res: mapped.res, spd: mapped.spd },
            shadow::Stats6 { hp: raw.hp, atk: raw.atk, def: raw.def, mag: raw.mag, res: raw.res, spd: raw.spd }, shadow::enemy_definition(name).unwrap()).unwrap();
        assert_subset(get(case, "stats"), &serde_json::to_value(projected).unwrap(), name);
    }
    for case in get(&f, "cases").as_array().unwrap() {
        let seed = n(get(case, "seed"));
        let boss = get(case, "boss").as_bool().unwrap();
        let mask = n(get(case, "mask")) as u32;
        let mut state = create_stage_state(seed, 1, 1);
        state.cleared_pack_mask = mask;
        state.next_emission_at = 3.;
        if boss { state.boss_active = true; state.boss_available = true; state.boss_armed = true; state.wave = 1; state.transitions = 10; }
        let training = training(case.get("training"));
        let star_map: BTreeMap<String, u32> = case.get("stars").and_then(Value::as_object).map(|m| m.iter().map(|(k, v)| (k.clone(), n(v) as u32)).collect()).unwrap_or_default();
        let stars = |key: &str| hero::canonical_growth_id(key).and_then(|id| star_map.get(id).copied()).unwrap_or(0);
        let heroes: Vec<HeroHost> = get(case, "heroes").as_array().unwrap().iter().map(|h| {
            let key = get(h, "key").as_str().unwrap();
            HeroHost { instance_key: key.into(), definition: hero::hero_definition(hero::canonical_growth_id(key).unwrap()).unwrap(), hp: n(get(h, "hp")), max_hp: n(get(h, "maxHP")), combat_base_max_hp: n(get(h, "combatBaseMaxHP")),
                stats: shadow::Stats6 { hp: 0., atk: n(get(get(h, "stats"), "ATK")), def: n(get(get(h, "stats"), "DEF")), mag: n(get(get(h, "stats"), "MAG")), res: n(get(get(h, "stats"), "RES")), spd: n(get(get(h, "stats"), "SPD")) } }
        }).collect();
        for (h, expected) in heroes.iter().zip(get(case, "heroes").as_array().unwrap()) {
            assert_subset(get(expected, "permanent"), &serde_json::to_value(hero_permanent(h, training, stars(&h.instance_key)).unwrap()).unwrap(), &format!("permanent {}", h.instance_key));
        }
        let level = n(get(case, "level"));
        let party_cp: f64 = heroes.iter().map(|h| compute_combat_power(CpActor::new(level, h.stats.atk, h.stats.mag, h.stats.def, h.stats.res, h.max_hp, h.stats.spd))).sum();
        assert_eq!(party_cp, n(get(case, "partyCP")), "partyCP");
        let plan = build_spawn_plan(&data, &state, 0, party_cp, 40.).unwrap();
        let mut uid = 90;
        let enemies: Vec<EnemyHost> = plan.iter().map(|p| {
            let a = activate_entry(&state, 40., p, boss, None).unwrap();
            uid += 1;
            EnemyHost { uid: uid - 1, name: p.row.name.clone(), hp: p.row.hp, max_hp: p.row.hp, stats: shadow::Stats6 { hp: p.row.hp, atk: p.row.atk, def: p.row.def, mag: p.row.mag, res: p.row.res, spd: p.row.spd }, boss, combat_tier: p.row.combat_tier,
                stream_walk_speed: a.stream_walk_speed, ranged: a.stream_delivery == "ranged", x: a.x, y: a.y, boss_interval_seconds: None }
        }).collect();
        let config = create_wfm_combat_config(&state, &heroes, &enemies, &data, &raws, &format!("oracle:{}", seed as u32), false, training, &stars).unwrap();
        assert_subset(get(case, "config"), &config.to_json(), &format!("config seed {seed} boss {boss}"));
    }
}
