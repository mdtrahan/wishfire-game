//! Read-only equal-combat-time combo window diagnostic.
use crate::*;
#[test]
#[ignore = "20-seed DEFAULT combo window comparison"]
fn combo_twenty_seed_report() {
    let (
        mut windows,
        mut combo,
        mut co_total,
        mut co_max,
        mut window_s,
        mut max_s,
        mut performing,
        mut max_performing,
        mut boss_windows,
        mut fights,
        mut violations,
        mut open,
    ) = (
        0u64, 0u64, 0usize, 0usize, 0f64, 0f64, 0f64, 0f64, 0u64, 0u64, 0u64, 0u64,
    );
    let preset = std::env::var("COMBO_PRESET").unwrap_or_else(|_| "DEFAULT".into());
    let config = if preset == "OFF" {
        SpotlightConfig::OFF
    } else {
        SpotlightConfig::DEFAULT
    };
    let mut first_sum = [0f64; 3];
    let mut first_kills = [0u64; 3];
    let mut first_wipes = [0u64; 3];
    let mut downs = [0u64; 4];
    let mut encounters = 0u64;
    let mut co_heroes = [0u64; 4];
    for seed in 1..=20 {
        let mut s = Sim::new(SimConfig {
            seed,
            spotlight: SpotlightConfig {
                auto_release: true,
                ..config
            },
            ..Default::default()
        });
        s.drain_events();
        let mut first = [None; 3];
        let mut first_done = [false; 3];
        let mut start = None;
        let mut phase_steps = 0u64;
        while s.snapshot.combat_time < 900. {
            let frozen = s.snapshot.spotlight.is_some();
            let p = s
                .snapshot
                .spotlight
                .as_ref()
                .is_some_and(|a| a.phase == SpotlightPhase::Performing);
            let combat = s.combat.combat_steps;
            s.step();
            if p {
                phase_steps += 1;
            }
            if frozen && s.combat.combat_steps != combat {
                violations += 1;
            }
            for e in s.drain_events() {
                match e {
                    Event::SpotlightBegan { .. } => {
                        windows += 1;
                        let n = s.snapshot.spotlight.as_ref().unwrap().co_casters.len();
                        combo += u64::from(n > 0);
                        co_total += n;
                        for &id in &s.snapshot.spotlight.as_ref().unwrap().co_casters {
                            co_heroes[(id - 1) as usize] += 1;
                        }
                        co_max = co_max.max(n);
                        start = Some(s.snapshot.time);
                        phase_steps = 0;
                        if s.combat
                            .actors
                            .iter()
                            .any(|a| a.alive() && crate::tuning::is_boss(a.view.archetype))
                        {
                            boss_windows += 1;
                        }
                    }
                    Event::SpotlightEnded { .. } => {
                        if let Some(t) = start.take() {
                            let seconds = s.snapshot.time - t;
                            window_s += seconds;
                            max_s = max_s.max(seconds);
                            let seconds = phase_steps as f64 / 30.;
                            performing += seconds;
                            max_performing = max_performing.max(seconds);
                        }
                    }
                    Event::WaveIncoming { .. } => encounters += 1,
                    Event::BossArrived { id } => {
                        fights += 1;
                        encounters += 1;
                        if s.stage.wave <= 3 {
                            let k = (s.stage.wave - 1) as usize;
                            if !first_done[k] {
                                first[k] = Some((id, s.snapshot.combat_time));
                            }
                        }
                    }
                    Event::Died { id } => {
                        for k in 0..3 {
                            if first[k].is_some_and(|(boss, _)| boss == id) {
                                let (_, began) = first[k].take().unwrap();
                                first_sum[k] += s.snapshot.combat_time - began;
                                first_kills[k] += 1;
                                first_done[k] = true;
                            }
                        }
                    }
                    Event::WaveReset if s.stage.wave <= 3 => {
                        let k = (s.stage.wave - 1) as usize;
                        if !first_done[k] {
                            first[k] = None;
                            first_done[k] = true;
                            first_wipes[k] += 1;
                        }
                    }
                    Event::Downed { id } => {
                        if let Some(k) = s.combat.actor_index(id).and_then(|i| {
                            crate::actors::hero_index(s.combat.actors[i].view.archetype)
                        }) {
                            downs[k] += 1;
                        }
                    }
                    _ => {}
                }
            }
        }
        open += u64::from(start.is_some());
    }
    let first_mean: [f64; 3] =
        core::array::from_fn(|k| first_sum[k] / first_kills[k].max(1) as f64);
    println!("COMBO_FIGHTS preset={preset} first_kills={first_kills:?} first_wipes={first_wipes:?} mean_first_boss_s={first_mean:?}");
    println!("COMBO windows={windows} combo={combo} co_total={co_total} co_max={co_max} mean_co={:.6} mean_window_s={:.6} max_window_s={max_s:.6} mean_performing_s={:.6} max_performing_s={max_performing:.6} boss_windows={boss_windows} boss_fights={fights} per_boss_fight={:.6} encounters={encounters} per_encounter={:.6} co_heroes={co_heroes:?} combat_clock_violations={violations} open={open} downs={downs:?}",co_total as f64/windows.max(1) as f64,window_s/(windows-open).max(1)as f64,performing/(windows-open).max(1)as f64,boss_windows as f64/fights as f64,windows as f64/encounters as f64);
}
