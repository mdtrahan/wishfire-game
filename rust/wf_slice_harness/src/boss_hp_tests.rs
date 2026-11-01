use super::*;
use crate::tuning::{stats, Stats, BOSS_TIER_HP, REWARD_BANNER_SECONDS, TRAVEL_SLOTS};

// Exercise the authored director and marker path; clear ordinary encounters as in
// six_announced_waves_gate_boss_without_an_arena_ring, without altering boss HP.
fn reach_boss(sim: &mut Sim) -> ActorView {
    for _ in 0..4000 {
        sim.direct();
        if let Some(id) = sim.director.boss {
            assert!(sim
                .drain_events()
                .iter()
                .any(|e| matches!(e, Event::BossArrived { id: arrived } if *arrived == id)));
            sim.refresh_snapshot();
            return sim
                .snapshot()
                .actors
                .iter()
                .find(|a| a.id == id)
                .unwrap()
                .clone();
        }
        sim.drain_events();
        for chest in &mut sim.chests {
            chest.state = ChestState::Open;
            chest.state_age = REWARD_BANNER_SECONDS;
        }
        sim.combat.update_hazards();
        sim.resolve_hazards();
        for actor in &mut sim.combat.actors {
            if actor.view.team == Team::Enemy {
                actor.view.hp = 0.;
            }
        }
        for (i, actor) in sim
            .combat
            .actors
            .iter_mut()
            .filter(|a| a.view.team == Team::Hero)
            .enumerate()
        {
            actor.view.pos = sim.combat.cfg.arena_size * 0.5 + TRAVEL_SLOTS[i];
        }
    }
    panic!("authored stage did not spawn its boss");
}

#[test]
fn authored_boss_hp_is_full_and_never_compounds_on_stage_reset_or_restart() {
    let data: serde_json::Value =
        serde_json::from_str(include_str!("../fixtures/waves.json")).unwrap();
    let mut boss_count = 0;
    for (stage_index, stage) in data["stages"].as_array().unwrap().iter().enumerate() {
        for (wave_index, wave) in stage["waves"].as_array().unwrap().iter().enumerate() {
            for subwave in wave["subwaves"].as_array().unwrap() {
                for spawn in subwave["spawns"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .chain(subwave["units"].as_array().into_iter().flatten())
                {
                    if spawn["type"] != "boss" {
                        continue;
                    }
                    boss_count += 1;
                    let tier = stage_index as u8 + 1;
                    let stage_number = stage_index as u32 + 1;
                    let archetype = [
                        Archetype::Boss,
                        Archetype::BossBomber,
                        Archetype::BossMarksman,
                    ][stage_index];
                    assert_eq!(
                        crate::stage_script::script(tier)[wave_index]
                            .subwaves
                            .iter()
                            .flat_map(|s| s.spawns)
                            .filter(|s| s.archetype == archetype)
                            .count(),
                        1
                    );
                    // ORKA-6jh1.23 separates ordinary progression from preserved boss tiers.
                    let hp_scale = [1., 2.3, 1.70][stage_index];
                    let tier_hp = BOSS_TIER_HP[stage_index];
                    let djinn_hp = if archetype == Archetype::BossMarksman {
                        2.
                    } else {
                        1.
                    };
                    let expected = 1500_f32 * djinn_hp * hp_scale * tier_hp;
                    let old = 1200_f32 * djinn_hp * hp_scale * tier_hp;
                    // Client R restarts construct a fresh Sim. Progress with the real
                    // stage-reset path, which also derives the tier from the stage.
                    for restart in 0..3 {
                        let mut sim = Sim::new(SimConfig {
                            seed: 42 + restart,
                            ..Default::default()
                        });
                        for _ in 1..stage_number {
                            sim.reset_stage(true);
                        }
                        for reset in 0..3 {
                            assert_eq!((sim.stage.wave, sim.stage.tier), (stage_number, tier));
                            let boss = reach_boss(&mut sim);
                            assert_eq!(boss.archetype, archetype);
                            assert_eq!(boss.hp.to_bits(), boss.max_hp.to_bits());
                            assert!(
                                (boss.max_hp - expected).abs() < 1e-3,
                                "{archetype:?}: {} != {expected}",
                                boss.max_hp
                            );
                            assert!((boss.max_hp - old * 1.25).abs() < 1e-3);
                            println!("{archetype:?} stage={stage_number} tier={tier} wave={} restart={restart} reset={reset} old={old} hp={} max_hp={}", wave_index + 1, boss.hp, boss.max_hp);
                            // A damaged boss must disappear on the same-stage wipe reset.
                            let i = sim.combat.actor_index(boss.id).unwrap();
                            sim.combat.actors[i].view.hp = 1.;
                            sim.reset_stage(false);
                            assert!(!sim
                                .combat
                                .actors
                                .iter()
                                .any(|a| crate::tuning::is_boss(a.view.archetype)));
                        }
                    }
                }
            }
        }
    }
    assert_eq!(boss_count, 3);
}

fn fields(s: Stats) -> [u32; 8] {
    [
        s.hp, s.atk, s.def, s.speed, s.reach, s.interval, s.evade, s.special,
    ]
    .map(f32::to_bits)
}

#[test]
fn regular_enemy_stats_and_non_hp_boss_stats_remain_bit_identical() {
    use Archetype::*;
    // Authored values at slice 9d47d4b4, with ORKA-6jh1.47 Mirewing, ORKA-6jh1.48 Bastorto and ORKA-6jh1.52 Gloamink tuning.
    let regular: [(Archetype, [f32; 8]); 10] = [
        (Gobloc, [140., 10., 0., 55., 40., 2.6, 0., 0.]),
        (Orc, [210., 11., 0., 45., 63., 3., 0., 0.]),
        (HighOrc, [260., 30., 80., 32., 68., 4.2, 0., 0.]),
        (
            Marid,
            [235., 12., 10., 78_f32 * 1.6698 * 0.95, 320., 4.5, 0., 0.],
        ),
        (Gloamink, [149.5, 10., 0., 112., 40., 1.5, 0., 0.]),
        (Mirewing, [145., 20., 8., 110., 420., 3., 0., 0.]),
        (Bastorto, [350., 15.2, 14., 50., 48., 2.6, 0., 0.]),
        (Sniper, [54., 26., 0., 35., 300., 4.5, 0., 0.]),
        (Lizardo, [100., 22., 0., 45., 220., 4.5, 0., 0.]),
        (Fizzmite, [95., 60., 0., 180., 55., 0.6, 0., 0.]),
    ];
    for (kind, expected) in regular {
        assert_eq!(fields(stats(kind)), expected.map(f32::to_bits), "{kind:?}");
    }
    let boss_before: [f32; 8] = [1200., 165., 0., 40., 100., 4.5, 0., 0.];
    for kind in [Boss, BossBomber, BossMarksman] {
        assert_eq!(
            &fields(stats(kind))[1..],
            &boss_before.map(f32::to_bits)[1..],
            "{kind:?}"
        );
        let expected_hp: f32 = if kind == BossMarksman { 3000. } else { 1500. };
        assert_eq!(stats(kind).hp.to_bits(), expected_hp.to_bits());
    }
}
