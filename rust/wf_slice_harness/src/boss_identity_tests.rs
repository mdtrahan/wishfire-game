use crate::{tests::ALLOCATIONS, tuning::*, *};
fn fixture(kind: Archetype) -> Sim {
    fixture_seed(kind, SimConfig::default().seed)
}
fn fixture_seed(kind: Archetype, seed: u64) -> Sim {
    let mut s = Sim::composition_trial(
        SimConfig {
            seed,
            ..Default::default()
        },
        &[kind],
    );
    s.combat.hazards.clear();
    for a in &mut s.combat.actors {
        a.view.pos = ARENA_CENTRE + Vec2::new(0., 100.);
        a.destination = a.view.pos;
        a.basic_cd = 1000.;
        a.special_cd = 1000.;
        a.extra_cd = 1000.;
        a.pulse_cd = 1000.;
        a.pound_cd = 1000.;
        a.mend_cd = 1000.;
        a.summon_cd = 1000.;
    }
    s.combat.actors[4].view.pos = ARENA_CENTRE;
    s.combat.events.clear();
    s
}
fn ready(s: &mut Sim) {
    s.combat.hazards.clear();
    s.combat.projectiles.clear();
    let a = &mut s.combat.actors[4];
    a.state(ActorState::Idle, 0., 0.);
    a.enemy_phase = 0;
    a.view.energy = 1.;
    a.recharge_left = -SIM_DT;
}
#[test]
fn boss_random_selection_is_seeded_varied_and_has_no_short_cycle() {
    use crate::enmity::BossAttack;
    for kind in [
        Archetype::Boss,
        Archetype::BossMarksman,
        Archetype::BossBomber,
    ] {
        let choices = BossAttack::choices(kind);
        let mut totals = [0; 4];
        let mut sequences = Vec::new();
        for seed in 1..=8 {
            let mut sequence = Vec::new();
            for replay in 0..2 {
                let mut s = fixture_seed(kind, seed);
                // Disable the reactive melee Fortress; exercise the normal bank selector.
                s.combat.actors[4].stats.reach = 0.;
                let mut actual = Vec::new();
                for n in 0..64 {
                    ready(&mut s);
                    s.combat.actors[4].barrage_cd = 0.;
                    s.combat.actors[4].fortress = false;
                    s.enemy_ai();
                    let attack = s.combat.actors[4].boss_attack;
                    assert_eq!(s.combat.actors[4].serial, n + 1, "{kind:?} {attack:?}");
                    assert_eq!(s.combat.actors[4].view.energy, 0.);
                    let expected = match attack {
                        BossAttack::Stomp | BossAttack::Targeted | BossAttack::Scatter => 4,
                        BossAttack::Twin => 2,
                        BossAttack::Fortress => CHIMERA_FORTRESS_BOMBS,
                        _ => 1,
                    };
                    assert_eq!(s.combat.hazards.len(), expected);
                    assert!(s
                        .combat
                        .hazards
                        .iter()
                        .all(|h| h.view.kind == attack.kind()));
                    if replay == 0 {
                        totals[choices.iter().position(|&a| a == attack).unwrap()] += 1;
                    }
                    actual.push(attack);
                }
                assert!(!actual.windows(3).any(|w| w[0] == w[1] && w[1] == w[2]));
                for period in 1..=8 {
                    assert!((period..actual.len()).any(|n| actual[n] != actual[n - period]));
                }
                assert!(choices.iter().all(|a| actual.contains(a)));
                if replay == 0 {
                    sequence = actual;
                } else {
                    assert_eq!(sequence, actual);
                }
            }
            sequences.push(sequence);
        }
        assert!(sequences.windows(2).all(|w| w[0] != w[1]));
        println!(
            "{kind:?} seeds=1..8 moves=512 {choices:?} counts={:?}",
            &totals[..choices.len()]
        );
    }
}
#[test]
fn boss_selection_filters_range_coverage_cooldowns_and_retains_empty_bank() {
    use crate::enmity::BossAttack::*;
    let mut s = fixture(Archetype::BossMarksman);
    for a in &mut s.combat.actors[..4] {
        a.view.pos.y = ARENA_CENTRE.y + 20.;
    }
    assert_eq!(s.combat.boss_attack_target(4, 0, Cone), None);
    s.combat.actors[4].boss_attack = Cone;
    s.combat.actors[4].boss_retry_special = true;
    ready(&mut s);
    s.enemy_ai();
    assert!(s.combat.hazards.is_empty());
    assert_eq!(s.combat.actors[4].view.energy, 1.);
    for a in &mut s.combat.actors[..4] {
        a.view.hp = 0.;
    }
    s.enemy_ai();
    assert!(s.combat.hazards.is_empty());
    assert_eq!(s.combat.actors[4].view.energy, 1.);
    let mut s = fixture(Archetype::BossBomber);
    s.combat.actors[4].stats.reach = 0.;
    s.combat.actors[4].barrage_cd = 10.;
    for attack in [Targeted, Scatter, Fortress] {
        assert_eq!(s.combat.boss_attack_target(4, 0, attack), None);
    }
    ready(&mut s);
    s.enemy_ai();
    assert_eq!(s.combat.actors[4].boss_attack, Nova);
    assert_eq!(s.combat.actors[4].view.energy, 0.);
    ready(&mut s);
    for a in &mut s.combat.actors[..4] {
        a.view.pos.y = ARENA_MAX.y - 50.;
    }
    let rng = s.combat.actors[4].ai_rng.0;
    s.enemy_ai();
    assert!(s.combat.hazards.is_empty());
    assert_eq!(s.combat.actors[4].view.energy, 1.);
    assert_eq!(s.combat.actors[4].ai_rng.0, rng);
}
#[test]
fn boss_random_history_is_hashed_and_does_not_block_only_eligible_attack() {
    use crate::enmity::BossAttack;
    let mut s = fixture(Archetype::Boss);
    let hash = s.state_hash();
    s.combat.actors[4].boss_last_attack = Some(BossAttack::Charge);
    assert_ne!(hash, s.state_hash());
    let hash = s.state_hash();
    s.combat.actors[4].boss_attack_streak = 2;
    assert_ne!(hash, s.state_hash());
    for a in &mut s.combat.actors[..4] {
        a.view.pos.y = ARENA_CENTRE.y + 600.;
    }
    assert_eq!(s.combat.select_boss_attack(4, 0), Some(0));
    assert_eq!(s.combat.actors[4].boss_attack, BossAttack::Charge);
}
#[test]
fn boss_draw_waits_for_open_bank_and_committed_move_keeps_rng_and_warning() {
    for kind in [
        Archetype::Boss,
        Archetype::BossMarksman,
        Archetype::BossBomber,
    ] {
        let mut s = fixture(kind);
        s.combat.actors[4].stats.reach = 0.;
        for (energy, recharge) in [(0.9, -SIM_DT), (1., 0.)] {
            ready(&mut s);
            s.combat.actors[4].view.energy = energy;
            s.combat.actors[4].recharge_left = recharge;
            let rng = s.combat.actors[4].ai_rng.0;
            s.enemy_ai();
            assert!(s.combat.hazards.is_empty());
            assert_eq!(s.combat.actors[4].ai_rng.0, rng);
        }
        ready(&mut s);
        s.enemy_ai();
        let rng = s.combat.actors[4].ai_rng.0;
        let warnings: Vec<_> = s.combat.hazards.iter().map(|h| h.view.clone()).collect();
        for a in &mut s.combat.actors[..4] {
            a.view.hp = 0.;
        }
        s.enemy_ai();
        assert_eq!(s.combat.actors[4].ai_rng.0, rng);
        assert_eq!(
            s.combat
                .hazards
                .iter()
                .map(|h| h.view.clone())
                .collect::<Vec<_>>(),
            warnings
        );
    }
}
#[test]
fn boss_basic_power_changes_leave_telegraph_damage_and_rate_scaling_intact() {
    for (kind, power, rate) in [
        (Archetype::Boss, 1., 1.),
        (
            Archetype::BossBomber,
            BOMBER_BASIC_SCALE,
            1. / CHIMERA_ATTACK_RATE,
        ),
        (Archetype::BossMarksman, MARKSMAN_BASIC_POWER, 2.),
    ] {
        let mut s = fixture(kind);
        s.combat.actors[4].stats.atk = 100.;
        s.combat.actors[4].stats.reach = 200.;
        let target = s.combat.actors[0].view.id;
        s.combat.start_action(4, Some(target), false, false);
        assert_eq!(
            s.combat.actors[4].basic_cd,
            s.combat.actors[4].stats.interval * rate
        );
        s.combat.actors[4].view.state_age = BASIC_IMPACT;
        s.combat.action(4);
        assert_eq!(s.combat.projectiles[0].damage, 100. * power);
        let hazard = if kind == Archetype::BossBomber {
            HazardKind::LizardoDrop
        } else if kind == Archetype::BossMarksman {
            HazardKind::BossSnipe
        } else {
            HazardKind::BossSlam
        };
        s.hazard(
            hazard,
            s.combat.actors[4].view.id,
            Some(target),
            s.combat.actors[4].view.pos,
            Vec2::new(0., 1.),
        );
        assert_eq!(s.combat.hazards[0].base_damage, 100.);
    }
}
fn hurt_chimera() -> Sim {
    let mut s = fixture(Archetype::BossBomber);
    s.combat.actors[4].view.max_hp = 1000.;
    s.combat.actors[4].view.hp = 500.;
    s
}
fn begin(s: &mut Sim) {
    for _ in 0..(CHIMERA_REGEN_INTERVAL * SIM_HZ as f32) as u32 {
        s.combat.timers();
    }
}
#[test]
fn chimera_regen_waits_thirty_seconds_then_heals_one_point_five_percent_in_ten_ticks() {
    let mut s = hurt_chimera();
    let id = s.combat.actors[4].view.id;
    let interval_steps = (CHIMERA_REGEN_INTERVAL * SIM_HZ as f32) as u32;
    let duration_steps = (CHIMERA_REGEN_SECONDS * SIM_HZ as f32) as u32;
    let tick_steps = (CHIMERA_REGEN_TICK_SECONDS * SIM_HZ as f32) as u32;
    assert_eq!(CHIMERA_REGEN_INTERVAL, 30.);
    assert_eq!(CHIMERA_REGEN_FRACTION, 0.015);
    for _ in 0..interval_steps - 1 {
        s.combat.timers();
    }
    assert!(!s
        .drain_events()
        .iter()
        .any(|e| matches!(e, Event::RegenStarted { .. })));
    s.combat.timers();
    assert_eq!(s.combat.actors[4].view.hp, 500.);
    assert!(s.drain_events().iter().any(|e| matches!(e,Event::RegenStarted{id:who,total,seconds} if *who==id && *total==15. && *seconds==CHIMERA_REGEN_SECONDS)));
    let mut healed = 0.;
    let mut ticks = 0;
    for n in 1..=duration_steps {
        s.combat.timers();
        let events = s.drain_events();
        for e in events {
            if let Event::Healed { target, amount, .. } = e {
                if target == id {
                    assert_eq!(n % tick_steps, 0);
                    assert_eq!(amount, 1.5);
                    healed += amount;
                    ticks += 1;
                }
            }
        }
        assert_eq!(
            s.combat.actors[4].view.hp,
            500. + 1.5 * (n / tick_steps) as f32
        );
    }
    assert_eq!(ticks, 10);
    assert_eq!(healed, 15.);
    assert_eq!(s.combat.actors[4].view.hp, 515.);
    assert_eq!(s.combat.actors[4].regen_ticks_left, 0);
    for _ in 0..interval_steps - duration_steps - 1 {
        s.combat.timers();
    }
    assert!(!s
        .drain_events()
        .iter()
        .any(|e| matches!(e, Event::RegenStarted { .. })));
    s.combat.timers();
    assert!(s
        .drain_events()
        .iter()
        .any(|e| matches!(e, Event::RegenStarted { .. })));
}
#[test]
fn chimera_regen_waits_at_full_hp_caps_healing_and_stops_on_death() {
    let mut s = hurt_chimera();
    s.combat.actors[4].view.hp = 1000.;
    begin(&mut s);
    for _ in 0..30 {
        s.combat.timers();
    }
    assert_eq!(s.combat.actors[4].regen_wait_steps, 0);
    assert_eq!(s.combat.actors[4].regen_ticks_left, 0);
    assert!(!s
        .drain_events()
        .iter()
        .any(|e| matches!(e, Event::RegenStarted { .. })));
    s.combat.actors[4].view.hp = 999.;
    s.combat.timers();
    assert_eq!(s.combat.actors[4].regen_ticks_left, 10);
    for _ in 0..150 {
        s.combat.timers();
        assert!(s.combat.actors[4].view.hp <= 1000.);
    }
    let id = s.combat.actors[4].view.id;
    let sum: f32 = s
        .drain_events()
        .iter()
        .filter_map(|e| match e {
            Event::Healed { target, amount, .. } if *target == id => Some(*amount),
            _ => None,
        })
        .sum();
    assert_eq!(sum, 1.);
    assert_eq!(s.combat.actors[4].view.hp, 1000.);
    s.combat.actors[4].regen_wait_steps = 0;
    s.combat.actors[4].view.hp = 500.;
    s.combat.timers();
    s.combat.events.clear();
    s.combat.actors[4].view.hp = 0.;
    s.deaths();
    assert_eq!(s.combat.actors[4].regen_ticks_left, 0);
    for _ in 0..160 {
        s.combat.timers();
    }
    assert_eq!(s.combat.actors[4].view.hp, 0.);
    assert_eq!(s.combat.actors[4].regen_ticks_left, 0);
    assert!(!s
        .drain_events()
        .iter()
        .any(|e| matches!(e, Event::RegenStarted { .. })
            || matches!(e,Event::Healed{target,..} if *target==id)));
}
#[test]
fn chimera_regen_is_frozen_during_all_spotlight_phases_and_allocates_nothing() {
    let mut s = hurt_chimera();
    begin(&mut s);
    s.combat.events.clear();
    let cfg = SpotlightConfig {
        global_gap: 0.,
        hero_gap: 0.,
        fairness: 0.,
        auto_release: false,
        ..SpotlightConfig::DEFAULT
    };
    s.set_spotlight(cfg);
    s.combat.start_ground_pound(0, s.combat.actors[4].view.id);
    // Inject the prepared regen budget after admission to verify an existing window freezes it.
    let ticks = s.combat.actors[4].regen_ticks_left;
    s.combat.actors[4].regen_ticks_left = 0;
    s.combat.select_spotlight();
    s.combat.actors[4].regen_ticks_left = ticks;
    let state = |s: &Sim| {
        let a = &s.combat.actors[4];
        (
            a.regen_wait_steps,
            a.regen_tick_steps,
            a.regen_ticks_left,
            a.regen_remaining,
        )
    };
    let before = state(&s);
    let mut allocations = 0;
    while s.combat.spotlight.active.as_ref().unwrap().phase != SpotlightPhase::Tail {
        ALLOCATIONS.with(|n| n.set(Some(0)));
        s.step();
        allocations += ALLOCATIONS.with(|n| n.replace(None)).unwrap();
        s.combat.events.clear();
        assert_eq!(state(&s), before);
    }
    for _ in 0..5 {
        s.step();
        assert_eq!(state(&s), before);
    }
    assert_eq!(allocations, 0);
    s.release_spotlight();
    s.step();
    assert_eq!(s.combat.actors[4].regen_tick_steps, before.1 + 1);
    assert_eq!(s.combat.actors[4].regen_wait_steps, before.0 - 1);
}
#[test]
fn chimera_regen_future_state_is_hashed() {
    let mut s = hurt_chimera();
    let hash = s.state_hash();
    for field in 0..4 {
        let before = s.combat.actors[4].clone();
        match field {
            0 => s.combat.actors[4].regen_wait_steps += 1,
            1 => s.combat.actors[4].regen_tick_steps += 1,
            2 => s.combat.actors[4].regen_ticks_left += 1,
            _ => s.combat.actors[4].regen_remaining += 1.,
        }
        assert_ne!(hash, s.state_hash());
        s.combat.actors[4] = before;
    }
}

#[test]
fn djinn_cone_reaches_wall_narrows_before_enrage_and_uses_fill_tradeoff() {
    for enraged in [false, true] {
        let mut s = fixture(Archetype::BossMarksman);
        let owner = s.combat.actors[4].view.id;
        s.combat.actors[4].view.enraged = enraged;
        let origin = Vec2::new(480., 400.);
        let dir = Vec2::new(0., 1.);
        s.hazard(HazardKind::BossCone, owner, Some(1), origin, dir);
        let h = s.combat.hazards.last().unwrap();
        let Shape::Cone {
            length,
            half_angle_rad,
        } = h.view.shape
        else {
            panic!("cone")
        };
        let width_scale = if enraged {
            s.combat.actors[4].phase_rule.unwrap().width_scale
        } else {
            1.
        };
        assert_eq!(length, crate::math::floor_ray(origin, dir, f32::INFINITY));
        assert!(
            (half_angle_rad - (CONE_HALF_ANGLE - MARKSMAN_CONE_HALF_REDUCTION) * width_scale).abs()
                < 0.00001
        );
        assert!((h.duration - CONE_LOCK * length / CONE_LENGTH).abs() < 0.00001);
        assert!((h.damage - h.base_damage * h.duration / CONE_LOCK).abs() < 0.0001);
        assert!(h.hits(origin + dir * (length - 1.), 0.));
        assert!(!h.hits(origin + dir * (length + 1.), 0.));
    }
    let mut s = fixture(Archetype::Boss);
    s.hazard(
        HazardKind::BossCone,
        s.combat.actors[4].view.id,
        Some(1),
        Vec2::new(480., 400.),
        Vec2::new(0., 1.),
    );
    assert_eq!(
        s.combat.hazards[0].view.shape,
        Shape::Cone {
            length: CONE_LENGTH,
            half_angle_rad: CONE_HALF_ANGLE
        }
    );
}
