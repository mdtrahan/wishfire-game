use super::*;
use crate::tuning::*;
#[test]
fn djinn_long_fight_caps_snipers_and_lizardos_without_gobloc_summons() {
    let mut s = Sim::composition_trial(SimConfig::default(), &[Archetype::BossMarksman]);
    s.combat.hazards.clear(); // Kaja's fixed-damage passive must not damage immortal minions.
    for a in &mut s.combat.actors {
        if a.view.team == Team::Hero {
            a.stats.atk = 0.;
            a.stats.mag = a.stats.atk;
            a.view.hp = 1e9;
            a.view.max_hp = 1e9;
        }
    }
    s.combat.events.clear();
    let (mut max_snipers, mut max_lizardos, mut goblocs) = (0, 0, 0);
    for _ in 0..240 * SIM_HZ {
        s.step();
        let snipers = s
            .combat
            .actors
            .iter()
            .filter(|a| a.alive() && a.view.archetype == Archetype::Sniper)
            .count();
        let lizardos = s
            .combat
            .actors
            .iter()
            .filter(|a| a.alive() && a.view.archetype == Archetype::Lizardo)
            .count();
        max_snipers = max_snipers.max(snipers);
        max_lizardos = max_lizardos.max(lizardos);
        assert!(snipers <= MARKSMAN_MAX_SNIPERS as usize);
        assert!(lizardos <= MARKSMAN_MAX_LIZARDOS as usize);
        for e in s.drain_events() {
            if matches!(
                e,
                Event::Spawned {
                    archetype: Archetype::Gobloc,
                    ..
                }
            ) {
                goblocs += 1;
            }
            if let Event::Hit {
                source,
                target,
                amount,
                ..
            } = e
            {
                if source <= 4 && target > 4 {
                    assert_eq!(amount, 0., "fixture must not damage minions");
                }
            }
        }
    }
    assert_eq!(max_snipers, 4);
    assert_eq!(max_lizardos, 2);
    assert_eq!(goblocs, 0);
    println!("Djinn 240s: max living snipers={max_snipers}; max living lizardos={max_lizardos}; Gobloc summons={goblocs}");
}

fn basic_window(kind: Archetype, phase: u8, control_scale: Option<f32>) -> u32 {
    let mut s = Sim::composition_trial(SimConfig::default(), &[kind]);
    s.combat.hazards.clear();
    for a in &mut s.combat.actors {
        a.view.pos = Vec2::new(480., 1250.);
        a.destination = a.view.pos;
        a.formed_age = 100.;
        a.view.hp = 1e9;
        a.view.max_hp = 1e9;
        a.summon_cd = 1000.;
    }
    s.combat.actors[4].view.pos = Vec2::new(480., 1100.);
    s.combat.actors[4].destination = s.combat.actors[4].view.pos;
    s.combat.actors[4].enemy_phase = if phase == 4 { 0 } else { phase };
    s.combat.actors[4].relocate_left = 1000.;
    s.combat.actors[4].special_cd = 0.;
    s.combat.actors[4].view.energy = if phase == 4 { 1. } else { 0. };
    s.combat.actors[4].recharge_left = if phase == 4 { -SIM_DT } else { 1000. };
    s.combat.actors[4].recharge_duration = 1000.;
    if phase == 4 {
        s.combat.actors[4].boss_attack = crate::enmity::BossAttack::Twin;
        s.combat.actors[4].boss_retry_special = true;
        // Widened beams overlap at the old 164-u fixture. Extend fixture-only basic
        // reach to isolate the same coverage-fallback branch between the new rays.
        s.combat.actors[4].stats.reach = 200.;
        for a in &mut s.combat.actors[..4] {
            a.view.radius = 0.;
            a.view.pos = Vec2::new(480., 1340.);
        }
    }
    let boss = s.combat.actors[4].view.id;
    s.combat.events.clear();
    let mut shots = 0;
    for _ in 0..120 * SIM_HZ {
        s.combat.timers();
        s.enemy_ai();
        s.combat.actions();
        s.combat.move_projectiles();
        for e in s.drain_events() {
            if matches!(e,Event::ActionStarted{id,state:ActorState::Basic,..} if id==boss) {
                shots += 1;
                if let Some(scale) = control_scale {
                    // Counterfactual scale-1 control uses the identical AI branch and clocks.
                    s.combat.actors[4].basic_cd = s.combat.actors[4].stats.interval * scale;
                    s.combat.actors[4].special_cd = 3. * scale;
                }
            }
        }
    }
    shots
}
#[test]
fn boss_basic_rate_scales_across_relocation_and_recharge() {
    assert_eq!(basic_interval_scale(Archetype::BossMarksman), 2.);
    for kind in [
        Archetype::BossMarksman,
        Archetype::Boss,
        Archetype::BossBomber,
    ] {
        for phase in [0, 3, 4] {
            if phase == 4 && kind != Archetype::BossMarksman {
                continue;
            }
            let before = basic_window(kind, phase, Some(1.));
            let after = basic_window(kind, phase, None);
            if kind == Archetype::BossMarksman {
                assert!(before > 0);
                assert!(
                    (after as i32 * 2 - before as i32).abs() <= 2,
                    "{kind:?} phase{phase}: {before}->{after}"
                );
            } else if kind == Archetype::BossBomber {
                assert!(
                    (after as f32 - before as f32 * CHIMERA_ATTACK_RATE).abs() <= 2.,
                    "{kind:?} phase{phase}: {before}->{after}"
                );
            } else {
                assert_eq!(
                    basic_interval_scale(kind),
                    if kind == Archetype::BossBomber {
                        1. / CHIMERA_ATTACK_RATE
                    } else {
                        1.
                    }
                );
                assert_eq!(before, after, "{kind:?} phase{phase}");
            }
            println!("{kind:?} phase{phase},120s: before {before} shots ({:.1}/min); after {after} shots ({:.1}/min)",before as f32/2.,after as f32/2.);
        }
    }
}
