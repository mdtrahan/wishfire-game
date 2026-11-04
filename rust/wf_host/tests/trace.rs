//! Combat gate: the Rust host must reproduce the JS host's headless trace (stage_trace.json):
//! the same ABI operation sequence, gameplay hashes at every sampled tick, spawn log and
//! stage transitions for the same seed and party. The long cases run all ten Chapter 1 waves into the
//! boss: level 1 times out and recovers, level 7 clears it into stage 2.
use serde_json::Value;
use wf_host::progress::HeroProgressStore;
use wf_host::session::Session;
use wf_meta::enemy::parse_c2_table;

fn fixture() -> Value {
    serde_json::from_str(&std::fs::read_to_string(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures/rust-oracle/stage_trace.json")).unwrap()).unwrap()
}
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
#[test]
fn rust_host_reproduces_the_js_trace() {
    for case in fixture().as_array().unwrap() {
        let seed = case["seed"].as_u64().unwrap() as u32;
        let ticks = case["ticks"].as_u64().unwrap();
        let mut s = session(seed, case["level"].as_u64().unwrap() as u32, case["hp"].as_f64().unwrap());
        let samples = case["samples"].as_array().unwrap();
        let transitions = case["transitions"].as_array().unwrap();
        let mut seen_transitions = Vec::new();
        for n in 0..ticks {
            let before = (s.stage.wave, s.stage.transitions, s.stage.boss_active);
            let moved = s.tick(n as f64 * 1000. / 30.);
            assert!(s.failed.is_none(), "seed {seed} tick {n}: {:?}", s.failed);
            if moved { seen_transitions.push((n, before, (s.stage.wave, s.stage.transitions, s.stage.boss_active), s.time)); }
            if let Some(sample) = samples.iter().find(|x| x["tick"].as_u64() == Some(n)) {
                let read = s.read_hash();
                let hash = read.map(|(h, _)| format!("{h:016x}"));
                assert_eq!(hash.as_deref(), sample["hash"].as_str(), "seed {seed} tick {n}: hash (step {:?} vs {:?})", s.world().map(|w| w.step_number()), sample["step"]);
                assert_eq!(read.map(|(_, live)| live as u64), sample["live"].as_u64(), "seed {seed} tick {n}: live enemies");
                assert_eq!(s.stage.wave as u64, sample["wave"].as_u64().unwrap(), "seed {seed} tick {n}: wave");
                assert_eq!(s.stage.cleared_pack_mask as u64, sample["clearedPackMask"].as_u64().unwrap(), "seed {seed} tick {n}: mask");
                assert_eq!(s.time, sample["time"].as_f64().unwrap(), "seed {seed} tick {n}: time");
                let heroes: Vec<[f64; 2]> = s.heroes.iter().map(|h| [h.hp, h.max_hp]).collect();
                let expected: Vec<[f64; 2]> = sample["heroes"].as_array().unwrap().iter().map(|h| [h[0].as_f64().unwrap(), h[1].as_f64().unwrap()]).collect();
                assert_eq!(heroes, expected, "seed {seed} tick {n}: hero hp");
            }
        }
        assert_eq!(seen_transitions.len(), transitions.len(), "seed {seed}: transitions {seen_transitions:?}");
        for (actual, expected) in seen_transitions.iter().zip(transitions) {
            assert_eq!(actual.0, expected["tick"].as_u64().unwrap(), "transition tick");
            assert_eq!(actual.2 .0 as u64, expected["to"]["wave"].as_u64().unwrap());
        }
        // The JS harness disposes its runtime after the loop (end + destroy); do the same here.
        s.dispose();
        let ops: Vec<&str> = s.op_log.iter().copied().filter(|op| *op != "ack").collect();
        let expected_ops: Vec<&str> = case["calls"].as_array().unwrap().iter()
            .flat_map(|pair| std::iter::repeat(pair[0].as_str().unwrap()).take(pair[1].as_u64().unwrap() as usize)).filter(|op| *op != "ack").collect();
        assert_eq!(ops, expected_ops, "seed {seed}: operation sequence");
        let spawned: Vec<(f64, u64, String)> = case["spawnLog"].as_array().unwrap().iter().map(|e| (e["time"].as_f64().unwrap(), e["uid"].as_u64().unwrap(), e["name"].as_str().unwrap().to_string())).collect();
        assert_eq!(spawned.len(), case["spawnLog"].as_array().unwrap().len());
        match (case["bossTimeout"].as_object(), s.stage.last_boss_timeout.as_ref()) {
            (None, None) => {}
            (Some(expected), Some(actual)) => {
                assert_eq!(actual["time"].as_f64(), expected["time"].as_f64(), "seed {seed}: boss timeout time");
                assert_eq!(actual["elapsedSec"].as_f64(), expected["elapsedSec"].as_f64(), "seed {seed}: boss timeout elapsed");
                assert_eq!(actual["bossHp"].as_f64(), expected["bossHp"].as_f64(), "seed {seed}: boss hp at timeout");
            }
            (expected, actual) => panic!("seed {seed}: boss timeout {expected:?} vs {actual:?}"),
        }
        if let Some(cp) = case["checkpoint"].as_object() {
            let mine = s.checkpoint.as_ref().unwrap();
            assert_eq!(mine.subwaves.as_ref().map(|p| p.index as u64), cp["subwaves"]["index"].as_u64(), "checkpoint subwave index");
            assert_eq!(mine.subwaves.as_ref().map(|p| p.position.clone()).as_deref(), cp["subwaves"]["position"].as_str());
        }
    }
}
