//! Combat gate: the host must reproduce the recorded headless trace (stage_trace.json): the same
//! ABI operation sequence, gameplay hashes at every sampled tick, stage transitions, boss
//! timeout record and checkpoint for the same seed and party. The long cases run all ten
//! Chapter 1 waves into the boss.
//!
//! The recording began as the JS host's trace and the Rust host reproduced it exactly
//! (ORKA-63bf.2 to .27). Combat rules are Rust-only now, so when the owner changes one the
//! recording is taken again from this host: `WF_RECORD_STAGE_TRACE=1 cargo test -p wf_host
//! --test trace`. Re-record only for an owner rule change, never to make a failure pass.
use serde_json::{json, Value};
use wf_host::progress::HeroProgressStore;
use wf_host::session::Session;
use wf_meta::enemy::parse_c2_table;

fn fixture_path() -> std::path::PathBuf { std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures/rust-oracle/stage_trace.json") }
fn fixture() -> Value { serde_json::from_str(&std::fs::read_to_string(fixture_path()).unwrap()).unwrap() }
fn session(seed: u32, level: u32, hp: f64) -> Session {
    let rows = parse_c2_table(&std::fs::read_to_string(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../web-runner/assets/enemies.json")).unwrap()).unwrap();
    let mut store = HeroProgressStore::fresh();
    for (key, instance) in [("Falie", "falie#1"), ("Huun", "huun#1"), ("Runa", "runa#1"), ("Kojonn", "kojonn#1")] {
        let hero = store.attach(key, instance).clone();
        let mut hero = hero;
        hero.current_level = level;
        hero.refresh();
        hero.hp = hero.max_hp * hp;
        store.heroes.insert(instance.into(), hero);
    }
    let mut session = Session::new(seed, rows, store, &[("Falie", "falie#1"), ("Huun", "huun#1"), ("Runa", "runa#1"), ("Kojonn", "kojonn#1")], "oracle", 90, Box::new(|_| true), Box::new(|_, _| {}));
    session.stage.next_emission_at = 3.;
    session
}
/// Plays one case and returns it in the fixture's shape.
fn play(seed: u32, level: u32, hp: f64, ticks: u64) -> Value {
    let mut s = session(seed, level, hp);
    let heroes = |s: &Session| -> Value { s.heroes.iter().map(|h| json!([h.hp, h.max_hp])).collect() };
    let (mut samples, mut transitions) = (Vec::new(), Vec::new());
    for n in 0..ticks {
        let before = json!({"wave": s.stage.wave, "transitions": s.stage.transitions, "bossActive": s.stage.boss_active});
        let moved = s.tick(n as f64 * 1000. / 30.);
        assert!(s.failed.is_none(), "seed {seed} tick {n}: {:?}", s.failed);
        if moved {
            transitions.push(json!({"tick": n, "from": before, "to": {"wave": s.stage.wave, "transitions": s.stage.transitions, "bossActive": s.stage.boss_active}, "time": s.time, "heroes": heroes(&s)}));
        }
        // Sampled every second and at every transition, like the original recording.
        if n % 30 == 0 || moved {
            let read = s.read_hash();
            samples.push(json!({"tick": n, "time": s.time, "step": s.world().map(|w| w.step_number().to_string()), "hash": read.map(|(h, _)| format!("{h:016x}")), "live": read.map(|(_, live)| live),
                "state": s.world().map_or("host_ended", |w| w.state()), "wave": s.stage.wave, "clearedPackMask": s.stage.cleared_pack_mask, "heroes": heroes(&s)}));
        }
    }
    // The JS harness disposed its runtime after the loop (end + destroy); do the same here.
    s.dispose();
    let mut calls: Vec<(&str, u64)> = Vec::new();
    for op in s.op_log.iter().copied().filter(|op| *op != "ack") {
        match calls.last_mut() { Some((last, count)) if *last == op => *count += 1, _ => calls.push((op, 1)) }
    }
    let checkpoint = s.checkpoint.as_ref().map(|c| json!({"subwaves": c.subwaves.as_ref().map(|p| json!({"position": p.position, "index": p.index, "partyCP": p.party_cp, "entryPackMask": p.entry_pack_mask})), "generation": c.generation}));
    json!({"seed": seed, "level": level, "hp": hp, "ticks": ticks, "gold": s.gold_total, "bossTimeout": s.stage.last_boss_timeout, "checkpoint": checkpoint,
        "transitions": transitions, "calls": calls.iter().map(|(op, count)| json!([op, count])).collect::<Vec<_>>(), "samples": samples})
}
/// JSON equality with numbers compared by value (the JS recording wrote `420`, Rust writes `420.0`).
fn same(a: &Value, b: &Value) -> bool {
    match (a, b) {
        (Value::Number(x), Value::Number(y)) => x.as_f64() == y.as_f64(),
        (Value::Array(x), Value::Array(y)) => x.len() == y.len() && x.iter().zip(y).all(|(x, y)| same(x, y)),
        (Value::Object(x), Value::Object(y)) => x.len() == y.len() && x.iter().all(|(k, v)| y.get(k).is_some_and(|w| same(v, w))),
        _ => a == b,
    }
}
fn ops(calls: &Value) -> Vec<String> {
    calls.as_array().unwrap().iter().flat_map(|pair| std::iter::repeat(pair[0].as_str().unwrap().to_string()).take(pair[1].as_u64().unwrap() as usize)).filter(|op| op != "ack").collect()
}
#[test]
fn the_host_reproduces_the_recorded_trace() {
    let cases = fixture();
    let played: Vec<Value> = cases.as_array().unwrap().iter().map(|case| play(case["seed"].as_u64().unwrap() as u32, case["level"].as_u64().unwrap() as u32, case["hp"].as_f64().unwrap(), case["ticks"].as_u64().unwrap())).collect();
    if std::env::var_os("WF_RECORD_STAGE_TRACE").is_some() {
        std::fs::write(fixture_path(), serde_json::to_string(&played).unwrap()).unwrap();
        return;
    }
    for (actual, case) in played.iter().zip(cases.as_array().unwrap()) {
        let seed = &case["seed"];
        let (samples, expected) = (actual["samples"].as_array().unwrap(), case["samples"].as_array().unwrap());
        for (mine, theirs) in samples.iter().zip(expected) {
            for key in ["tick", "hash", "live", "wave", "clearedPackMask", "time", "heroes"] {
                assert!(same(&mine[key], &theirs[key]), "seed {seed} tick {}: {key} {} vs recorded {}", theirs["tick"], mine[key], theirs[key]);
            }
        }
        assert_eq!(samples.len(), expected.len(), "seed {seed}: sample count");
        let (transitions, expected) = (actual["transitions"].as_array().unwrap(), case["transitions"].as_array().unwrap());
        assert_eq!(transitions.len(), expected.len(), "seed {seed}: transitions {transitions:?}");
        for (mine, theirs) in transitions.iter().zip(expected) {
            assert!(same(&mine["tick"], &theirs["tick"]) && same(&mine["to"], &theirs["to"]), "seed {seed}: transition {mine} vs recorded {theirs}");
        }
        assert_eq!(ops(&actual["calls"]), ops(&case["calls"]), "seed {seed}: operation sequence");
        match (case["bossTimeout"].as_object(), actual["bossTimeout"].as_object()) {
            (None, None) => {}
            (Some(expected), Some(mine)) => for key in ["time", "elapsedSec", "bossHp"] {
                assert_eq!(mine[key].as_f64(), expected[key].as_f64(), "seed {seed}: boss timeout {key}");
            },
            (expected, mine) => panic!("seed {seed}: boss timeout {expected:?} vs {mine:?}"),
        }
        for key in ["index", "position"] {
            assert!(same(&actual["checkpoint"]["subwaves"][key], &case["checkpoint"]["subwaves"][key]), "seed {seed}: checkpoint subwave {key}");
        }
    }
}
