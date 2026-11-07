//! Player-host replays. Uses the same Session, enemy data and fixed clock as wf_app.
use serde_json::{json, Value};
use std::time::Instant;
use wf_host::progress::{ContinuousStageCheckpoint, HeroProgressStore};
use wf_host::session::Session;
use wf_meta::enemy::parse_c2_table;

fn fold(hash: &mut u64, bytes: &[u8]) {
    for b in bytes {
        *hash = (*hash ^ *b as u64).wrapping_mul(0x100000001b3);
    }
}
fn percentile(samples: &mut [f64], fraction: f64) -> f64 {
    if samples.is_empty() {
        return 0.;
    }
    samples.sort_by(f64::total_cmp);
    samples[((samples.len() - 1) as f64 * fraction).ceil() as usize]
}
fn play(name: &str, seed: u32, level: u32, boss: bool, pause: bool) -> Value {
    let rows = parse_c2_table(
        &std::fs::read_to_string(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../web-runner/assets/enemies.json"),
        )
        .unwrap(),
    )
    .unwrap();
    let party = [
        ("Falie", "falie#1"),
        ("Huun", "huun#1"),
        ("Runa", "runa#1"),
        ("Kojonn", "kojonn#1"),
    ];
    let mut store = HeroProgressStore::fresh();
    for (definition, instance) in party {
        let mut hero = store.attach(definition, instance).clone();
        hero.current_level = level;
        hero.refresh();
        hero.hp = hero.max_hp;
        store.heroes.insert(instance.into(), hero);
    }
    if boss {
        store.continuous_stage = Some(ContinuousStageCheckpoint {
            topology_version: 2,
            region: 1,
            stage: 1,
            wave: wf_meta::stage::waves_for_stage(1),
            boss_available: true,
            boss_summon_required: true,
            cleared_bosses: 0,
            boss_uid: None,
            cleared_pack_mask: None,
            seed: None,
            transitions: None,
            combat_checkpoint: None,
        });
    }
    let initial_save = serde_json::to_value(&store).unwrap();
    let mut session = Session::new(
        seed,
        rows,
        store,
        &party,
        "handoff-replay",
        1,
        Box::new(|_| true),
        Box::new(|_, _| {}),
    );
    let expected = if boss { "chapter_2" } else { "wave_2" };
    let mut script = Vec::new();
    let mut status = "FAIL";
    let mut outcome = "deadline".to_string();
    let mut digest = 0xcbf29ce484222325;
    let mut event_count = 0;
    let mut timings = Vec::new();
    let mut previous_progress = String::new();
    let mut last_progress = 0;
    let mut ticks = 0;
    let mut paused_state = None;
    // 180 s without damage, death, movement or a host transition is a soft lock.
    // Clocks/hash alone are deliberately excluded: an idle sim still advances them.
    const STALL_TICKS: u64 = 180 * 30;
    for tick in 0..(900 * 30) {
        ticks = tick + 1;
        let now = tick as f64 * 1000. / 30.;
        if boss && tick == 0 {
            script.push(json!({"tick": tick, "action": "summon_boss"}));
            if !session.summon_boss(now).unwrap() {
                outcome = "summon_rejected".into();
                break;
            }
        }
        if pause && tick == 90 {
            script.push(json!({"tick":tick,"action":"pause"}));
            paused_state = Some((
                session.time,
                session.gameplay_hash(),
                session.last_snapshot.clone(),
            ));
        }
        if pause && tick == 120 {
            script.push(json!({"tick":tick,"action":"resume"}));
        }
        if pause && (90..120).contains(&tick) {
            session.pause();
            assert_eq!(
                Some((
                    session.time,
                    session.gameplay_hash(),
                    session.last_snapshot.clone()
                )),
                paused_state,
                "simulation time and state must stay frozen while paused"
            );
            continue;
        }
        let start = Instant::now();
        session.tick(now);
        if pause && tick == 120 {
            assert_eq!(
                Some((
                    session.time,
                    session.gameplay_hash(),
                    session.last_snapshot.clone()
                )),
                paused_state,
                "resume must rebase the clock without applying paused time"
            );
            assert!(
                session.step_observations.is_empty(),
                "resume must not step the simulation"
            );
            assert_eq!(session.alpha(), 0., "resume must retain no time debt");
        }
        if pause && tick == 121 {
            assert_eq!(
                session.step_observations.len(),
                1,
                "the next frame must apply only one fresh step"
            );
        }
        timings.push(start.elapsed().as_secs_f64() * 1e6);
        if let Some(error) = &session.failed {
            outcome = format!("host_error: {error}");
            break;
        }
        for event in session.presentation_events.drain(..) {
            // Length-prefix each serialized event; this is an ordered log, never a state hash.
            let bytes = serde_json::to_vec(&event).unwrap();
            fold(&mut digest, &(bytes.len() as u64).to_le_bytes());
            fold(&mut digest, &bytes);
            event_count += 1;
        }
        session.step_observations.clear();
        if (boss && session.stage.region >= 2) || (!boss && session.stage.wave >= 2) {
            status = "PASS";
            outcome = expected.into();
            break;
        }
        if tick % 30 == 0 {
            let actors = session.last_snapshot.as_ref().map(|s| {
                s.actors
                    .iter()
                    .map(|a| json!([a.id, a.hp, a.pos.x, a.pos.y]))
                    .collect::<Vec<_>>()
            });
            let progress = json!([
                session.stage.region,
                session.stage.wave,
                session.stage.transitions,
                session.subwave_completions,
                actors
            ])
            .to_string();
            if progress != previous_progress {
                last_progress = tick;
                previous_progress = progress;
            }
            if tick - last_progress >= STALL_TICKS {
                outcome = "soft_lock".into();
                break;
            }
        }
    }
    session.dispose();
    json!({"name": name, "seed":seed, "level":level, "status":status, "expected":expected,
        "outcome":outcome, "ticks":ticks, "sim_seconds":session.time, "script":script,
        "initial_save":initial_save, "event_count":event_count, "event_digest":format!("fnv1a64:{digest:016x}"),
        "step_us":{"p50":percentile(&mut timings,0.50),"p95":percentile(&mut timings,0.95)},
        "soft_lock_seconds":180, "deadline_seconds":900})
}
fn main() {
    println!(
        "{}",
        json!({"schema":1,"scenarios":[
            play("chapter-1", 1, 1, false, false),
            play("chapter-1-boss", 7, 25, true, false),
            play("pause-resume", 42, 1, false, true),
        ]})
    );
}
