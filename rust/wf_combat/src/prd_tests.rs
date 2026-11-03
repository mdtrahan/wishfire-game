use crate::{prd::*, rng::Rng, tuning::*, *};
use std::cell::Cell;

// Test-only A/B control: the production binary contains only the PRD path.
thread_local! { static ARM: Cell<Option<(u32, f32, bool)>> = const { Cell::new(None) }; }
pub(crate) fn nominal(source: u32) -> Option<f32> {
    ARM.with(|arm| arm.get().filter(|x| x.0 == source).map(|x| x.1))
}
pub(crate) fn independent_crit(sim: &mut Sim, source: u32) -> Option<bool> {
    ARM.with(|arm| {
        arm.get()
            .filter(|x| x.0 == source && !x.2)
            .map(|x| sim.combat_rng.chance(x.1))
    })
}

fn fixture(seed: u64) -> Sim {
    let mut sim = Sim::new(SimConfig {
        seed,
        ..Default::default()
    });
    sim.spawn_actor(Archetype::Hondo, TRIAL_ORIGIN, stats(Archetype::Hondo));
    sim.spawn_actor(
        Archetype::WfmHighGobloc,
        TRIAL_ORIGIN + Vec2::new(30., 0.),
        Stats {
            hp: 100_000.,
            atk: 0.,
            mag: 0.,
            speed: 0.,
            ..stats(Archetype::WfmHighGobloc)
        },
    );
    sim.drain_events();
    sim
}

#[test]
fn calibration_matches_audit_and_endpoints_consume_one_draw() {
    for (p, expected) in [(0.1, 0.0147458447810727), (0.25, 0.084744091852317)] {
        assert!((constant(p) - expected).abs() < 1e-14);
    }
    let (mut rng, mut control) = (Rng(7), Rng(7));
    let mut counter = Counter::default();
    for p in [0., 1., 0., 1.] {
        assert_eq!(counter.roll(&mut rng, p), p == 1.);
        control.unit();
        assert_eq!(rng.0, control.0);
        assert_eq!(counter.next, if p == 1. { 1 } else { 2 });
    }
}

#[test]
fn counters_are_per_actor_per_family_and_retain_history_when_stat_changes() {
    let mut sim = fixture(1);
    let initial = sim.state_hash();
    for id in [1, 2] {
        for family in 0..5 {
            let history = state(&mut sim.prd, id);
            let c = match family {
                0 => &mut history.damage_crit,
                1 => &mut history.evade,
                2 => &mut history.encase,
                3 => &mut history.push_resist,
                _ => &mut history.heal_crit,
            };
            c.next += 1;
            assert_ne!(sim.state_hash(), initial);
            assert_eq!(
                state(&mut sim.prd, id)
                    .counters()
                    .iter()
                    .filter(|&&n| n == 2)
                    .count(),
                1
            );
            *state(&mut sim.prd, id) = State::default();
            assert_eq!(sim.state_hash(), initial);
        }
    }
    let mut c = Counter::default();
    c.next = 67;
    assert!(!c.roll(&mut Rng(1), 0.0001));
    assert_eq!(c.next, 68);
    assert!(c.roll(&mut Rng(2), 0.1));
    assert_eq!(c.next, 1);
    assert!(fixture(2).prd.iter().all(|(_, s)| s.counters() == [1; 5]));
}

#[test]
fn snapshot_restore_mid_streak_preserves_next_rolls_and_hash() {
    let mut sim = fixture(42);
    let mut restored = fixture(42);
    // Both worlds reach the same checkpoint through built combat, partway into a real streak.
    while state(&mut sim.prd, 1).damage_crit.next < 4 {
        sim.damage(1, 1, 10., true, true, Element::Physical);
        restored.damage(1, 1, 10., true, true, Element::Physical);
    }
    sim.refresh_snapshot();
    #[cfg(feature = "serde")]
    let saved: Vec<(u32, State)> =
        serde_json::from_str(&serde_json::to_string(&sim.snapshot().prd).unwrap()).unwrap();
    #[cfg(not(feature = "serde"))]
    let saved = sim.snapshot().prd.clone();
    let rng = sim.combat_rng;
    let hash = sim.state_hash();
    restored.prd.clear();
    restored.prd = saved;
    restored.combat_rng = rng;
    assert_eq!(state(&mut restored.prd, 1).damage_crit.next, 4);
    assert_eq!(restored.state_hash(), hash);
    for _ in 0..500 {
        sim.damage(1, 1, 10., true, true, Element::Physical);
        restored.damage(1, 1, 10., true, true, Element::Physical);
        assert_eq!(sim.state_hash(), restored.state_hash());
        assert_eq!(
            format!("{:?}", sim.drain_events()),
            format!("{:?}", restored.drain_events())
        );
    }
}

#[cfg(feature = "serde")]
#[test]
fn serialized_history_rebuilds_calibration_cache() {
    let mut c = Counter::default();
    c.roll(&mut Rng(1), 0.25);
    c.next = 7;
    let saved = serde_json::to_string(&c).unwrap();
    assert_eq!(saved, "7");
    let mut restored: Counter = serde_json::from_str(&saved).unwrap();
    for seed in 1..1000 {
        assert_eq!(
            c.roll(&mut Rng(seed), 0.25),
            restored.roll(&mut Rng(seed), 0.25)
        );
        assert_eq!(c.next, restored.next);
    }
}

#[test]
fn removed_attack_source_keeps_its_own_history() {
    let mut sim = fixture(7);
    state(&mut sim.prd, 1).damage_crit.next = 68;
    sim.actors.remove(0);
    sim.damage(1, 0, 10., true, false, Element::Physical);
    assert_eq!(state(&mut sim.prd, 1).damage_crit.next, 1);
    assert_eq!(state(&mut sim.prd, 2).damage_crit.next, 1);
    sim.refresh_snapshot();
    assert!(sim.snapshot().prd.iter().any(|(id, _)| *id == 1));
}

fn mean_sd(values: &[f64]) -> (f64, f64) {
    let mean = values.iter().sum::<f64>() / values.len() as f64;
    let sd = (values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / values.len() as f64).sqrt();
    (mean, sd)
}

/// Built-code proof: 200k damage checks and forty 60s autonomous Hondo duels per arm/rate.
/// The durable, immobile, zero-offence WFM High Gobloc isolates outgoing DPS.
#[test]
fn hondo_ab_built_combat() {
    println!("nominal | arm | checks | fights | crit rate | misses p50/p90/p99/max | crits/fight mean±sd | DPS mean±sd");
    for p in [0.1f32, 0.25] {
        for prd in [false, true] {
            ARM.with(|arm| arm.set(Some((1, p, prd))));
            let (mut crits, mut misses) = (0, Vec::new());
            // Include each success-terminated interval; right-censored seed tails count toward max.
            let mut max = 0;
            for seed in 1..=20 {
                let mut sim = fixture(seed);
                let mut streak = 0;
                for _ in 0..10_000 {
                    sim.actors[1].view.hp = sim.actors[1].view.max_hp;
                    sim.damage(1, 1, 10., true, true, Element::Physical);
                    let hit = sim
                        .drain_events()
                        .iter()
                        .any(|e| matches!(e, Event::Hit { crit: true, .. }));
                    if hit {
                        crits += 1;
                        misses.push(streak);
                        streak = 0;
                    } else {
                        streak += 1;
                        max = max.max(streak);
                    }
                }
            }
            let rate = crits as f64 / 200_000.;
            if prd {
                assert!((rate - p as f64).abs() <= 0.002, "rate={rate}, p={p}");
                assert!(max <= if p > 0.2 { 11 } else { 67 }, "max={max}");
            }
            misses.sort_unstable();
            let q = |v: f64| misses[((misses.len() as f64 * v).ceil() as usize).saturating_sub(1)];
            let (mut fight_crits, mut fight_dps) = (Vec::new(), Vec::new());
            for seed in 1..=40 {
                let mut sim = fixture(seed);
                let (mut crits, mut damage) = (0., 0.);
                for _ in 0..1800 {
                    let hp = sim.actors.iter().find(|a| a.view.id == 2).unwrap().view.hp;
                    sim.step();
                    damage +=
                        (hp - sim.actors.iter().find(|a| a.view.id == 2).unwrap().view.hp) as f64;
                    for e in sim.drain_events() {
                        if matches!(
                            e,
                            Event::Hit {
                                source: 1,
                                crit: true,
                                ..
                            }
                        ) {
                            crits += 1.;
                        }
                    }
                }
                fight_crits.push(crits);
                fight_dps.push(damage / 60.);
            }
            let (cm, cs) = mean_sd(&fight_crits);
            let (dm, ds) = mean_sd(&fight_dps);
            println!(
                "{:.0}% | {} | 200000 | 40 | {:.4}% | {}/{}/{}/{} | {:.3}±{:.3} | {:.3}±{:.3}",
                p * 100.,
                if prd { "B PRD" } else { "A independent" },
                rate * 100.,
                q(0.5),
                q(0.9),
                q(0.99),
                max,
                cm,
                cs,
                dm,
                ds
            );
        }
    }
    ARM.with(|arm| arm.set(None));
}
