use super::*;
use crate::{hazards::HitPolicy, tests::ALLOCATIONS, tuning::*};

fn fixture(spotlight: bool) -> Sim {
    let cfg = SimConfig {
        spotlight: SpotlightConfig {
            enabled: spotlight,
            global_gap: 0.,
            hero_gap: 0.,
            fairness: 0.,
            auto_release: false,
            charge: 0.,
            ..SpotlightConfig::DEFAULT
        },
        ..Default::default()
    };
    let mut s = Sim::composition_trial(cfg, &[Archetype::Orc]);
    s.combat.hazards.clear();
    for a in &mut s.combat.actors {
        a.view.pos = Vec2::new(480., 1100.);
        a.destination = a.view.pos;
        a.formed_age = 100.;
        a.view.hp = a.view.max_hp * 0.8;
        a.basic_cd = 100.;
        a.special_cd = 100.;
        a.extra_cd = 100.;
        a.mend_cd = 100.;
    }
    s.combat.actors[4].view.pos.x += 90.;
    s.combat.actors[4].view.hp = 100000.;
    s.combat.actors[4].view.max_hp = 100000.;
    s.combat.actors[4].stats.def = 0.;
    s.combat.actors[4].stats.evade = 0.;
    s.combat.actors[3].target = Some(s.combat.actors[4].view.id);
    s.combat.actors[3].view.ai_intent = AiIntent::Attack;
    s.combat.actors[3].ai_cd = 100.;
    s.combat.events.clear();
    s
}
fn start(s: &mut Sim) {
    let target = s.combat.actors[4].view.id;
    s.combat.start_arcane_pulse(3, target);
    s.combat.select_spotlight();
    s.refresh_snapshot();
}
#[test]
fn arcane_pulse_unevadable_range_curve_keeps_crits_and_shared_victim_multiplier() {
    let mut saw_crit = false;
    let mut saw_normal = false;
    for (distance, multiplier) in [
        (0., 1.),
        (60., 1.),
        (147.5, 1.575),
        (235., 2.15),
        (400., 2.15),
    ] {
        for seed in 1..=32 {
            let mut s = fixture(false);
            s.combat.combat_rng = crate::rng::Rng(seed);
            s.combat.actors[3].view.elevate = Some(ElevateVariant::Wings);
            start(&mut s);
            s.combat.actors[3].view.state_age = CAST_IMPACT;
            s.combat.action(3);
            let origin = s.combat.hazards.last().unwrap().view.origin;
            // Move Kaja after placement; range extensions must not move the curve.
            s.combat.actors[3].view.pos = origin - Vec2::new(distance, 0.);
            s.spawn_actor(Archetype::Orc, origin + Vec2::new(80., 0.));
            for a in &mut s.combat.actors[4..] {
                a.stats.evade = 1.;
                a.stats.def = 100.;
                a.view.ward = 1000.;
            }
            let raw = s.combat.hazards.last().unwrap().damage;
            for _ in 0..14 {
                s.combat.update_hazards();
                s.resolve_hazards();
            }
            let mut hits = 0;
            for e in s.drain_events() {
                assert!(!matches!(e, Event::Evaded { .. }));
                if let Event::Hit {
                    amount,
                    crit,
                    blocked,
                    element: Element::Arcane,
                    ..
                } = e
                {
                    saw_crit |= crit;
                    saw_normal |= !crit;
                    let expected = raw * multiplier * 0.5 * if crit { CRIT_MULTIPLIER } else { 1. };
                    assert!(
                        (amount - expected).abs() < 0.0001,
                        "distance={distance}: {amount} != {expected}"
                    );
                    assert!(blocked);
                    hits += 1;
                }
            }
            assert_eq!(hits, 2);
        }
    }
    assert!(saw_crit && saw_normal);
}

#[test]
fn arcane_pulse_resolution_uses_live_target_and_origin_fallbacks() {
    for lost in 0..5 {
        let mut s = fixture(false);
        s.combat.actors[4].view.pos = s.combat.actors[3].view.pos + Vec2::new(60., 0.);
        start(&mut s);
        s.combat.actors[3].view.state_age = CAST_IMPACT;
        s.combat.action(3);
        let raw = s.combat.hazards.last().unwrap().damage;
        let origin = s.combat.hazards.last().unwrap().view.origin;
        let victim = s.spawn_actor(Archetype::Orc, origin);
        s.combat.actors[5].stats.evade = 1.;
        s.combat.actors[5].stats.def = 0.;
        s.combat.actors[4].view.pos = s.combat.actors[3].view.pos + Vec2::new(235., 0.);
        if lost != 1 && lost != 2 {
            s.combat.actors[5].view.pos = s.combat.actors[4].view.pos;
        }
        match lost {
            1 => s.combat.actors[4].view.hp = 0.,
            2 => {
                s.combat.actors.remove(4);
            }
            3 => s.combat.actors[3].view.hp = 0.,
            4 => {
                s.combat.actors.remove(3);
            }
            _ => {}
        }
        for _ in 0..14 {
            s.combat.update_hazards();
            s.resolve_hazards();
        }
        let (amount, crit) = s
            .drain_events()
            .into_iter()
            .find_map(|e| match e {
                Event::Hit {
                    target,
                    amount,
                    crit,
                    ..
                } if target == victim => Some((amount, crit)),
                _ => None,
            })
            .unwrap();
        let expected =
            raw * if lost == 0 { 2.15 } else { 1. } * if crit { CRIT_MULTIPLIER } else { 1. };
        assert!((amount - expected).abs() < 0.0001, "fallback={lost}");
    }
}

#[test]
fn arcane_pulse_spends_a_stock_without_a_cooldown_and_reset_clears_it() {
    let mut s = fixture(false);
    s.combat.actors[3].view.meter = 2.;
    start(&mut s);
    assert_eq!(s.combat.actors[3].view.meter, 1.);
    assert_eq!(s.combat.actors[3].pulse_cd, 0.);
    assert_eq!(s.combat.actors[3].skill_lockout, 0.);
    assert_eq!(s.combat.actors[3].view.state_duration, CAST_DURATION);
    s.reset_stage(false);
    assert_eq!(s.combat.actors[3].view.meter, 0.);
    assert!(!s.combat.actors[3].action_pulse);
}

#[test]
fn arcane_pulse_fires_at_single_current_target_in_reach_and_not_outside() {
    for (inside, cooldown) in [(false, 0.), (true, 1.), (true, 0.)] {
        let mut s = fixture(false);
        let range = s.combat.actors[3].attack_range(&s.combat.actors[4]);
        s.combat.actors[4].view.pos = s.combat.actors[3].view.pos
            + Vec2::new(
                0.,
                if inside {
                    -(range - 1.)
                } else {
                    -(range + 50.)
                },
            );
        s.combat.actors[3].pulse_cd = cooldown;
        s.combat.actors[3].view.meter = 1.;
        s.combat.actors[3].power_choice = Some(false);
        for _ in 0..MAGE_AOE_HOLD_STEPS {
            s.combat.groove_timers();
        }
        s.hero_ai();
        let events = s.drain_events();
        assert_eq!(
            events
                .iter()
                .filter(|e| matches!(
                    e,
                    Event::SkillStarted {
                        skill: Skill::ArcanePulse,
                        ..
                    }
                ))
                .count(),
            usize::from(inside)
        );
        if inside {
            assert_eq!(s.combat.actors[3].pulse_cd, cooldown);
            // After the bounded group hold, unrelated legacy cooldowns do not block Pulse.
            assert_eq!(s.combat.actors[3].special_cd, 100.);
            assert_eq!(s.combat.actors[3].extra_cd, 100.);
        }
    }
}
#[test]
fn arcane_pulse_impact_tracks_target_position_and_scales_buffed_arcane_damage() {
    for variant in [
        None,
        Some(ElevateVariant::Sword),
        Some(ElevateVariant::Wings),
        Some(ElevateVariant::WingedBoots),
    ] {
        let buffed = variant == Some(ElevateVariant::Sword);
        let mut s = fixture(false);
        s.combat.actors[3].view.elevate = variant;
        start(&mut s);
        let impact = Vec2::new(600., 1200.);
        s.combat.actors[4].view.pos = impact;
        s.combat.actors[0].view.pos = impact; // Friendly bystander stands inside the blast.
        let inside = s.spawn_actor(Archetype::Orc, impact + Vec2::new(90., 0.));
        let outside = s.spawn_actor(Archetype::Orc, impact + Vec2::new(140., 0.));
        let outside_hp = s.combat.actors.last().unwrap().view.hp;
        s.combat.actors[3].view.state_age = CAST_IMPACT;
        s.combat.action(3);
        let h = s.combat.hazards.last().unwrap();
        assert_eq!(h.view.kind, HazardKind::ArcanePulse);
        assert_eq!(h.view.origin, impact);
        assert_eq!(h.view.shape, Shape::Circle { radius: 95. });
        assert_eq!(h.view.fill, FillMode::Countdown);
        assert_eq!(h.policy, HitPolicy::Snapshot);
        assert_eq!(h.duration, 0.45);
        let expected =
            s.combat.actors[3].stats.atk * 2.2 * if buffed { 1. + ELEVATE_BONUS } else { 1. };
        assert!((h.damage - expected).abs() < 0.0001);
        let hero_hp: Vec<_> = s.combat.actors[..4].iter().map(|a| a.view.hp).collect();
        for _ in 0..14 {
            s.combat.update_hazards();
            s.resolve_hazards();
        }
        assert_eq!(
            s.combat.actors[..4]
                .iter()
                .map(|a| a.view.hp)
                .collect::<Vec<_>>(),
            hero_hp
        );
        assert!(s.combat.actors[4].view.hp < 100000.);
        assert_eq!(
            s.combat.actors[s.combat.actor_index(outside).unwrap()]
                .view
                .hp,
            outside_hp
        );
        let events = s.drain_events();
        assert!(events.iter().any(|e| matches!(e, Event::Hit { target, element: Element::Arcane, .. } if *target == inside)));
        assert_eq!(
            events
                .iter()
                .filter(|e| matches!(
                    e,
                    Event::SkillStarted {
                        skill: Skill::ArcanePulse,
                        ..
                    }
                ))
                .count(),
            1
        );
        assert!(events.iter().any(|e| matches!(
            e,
            Event::Hit {
                source: 4,
                target,
                element: Element::Arcane,
                ..
            } if *target == s.combat.actors[4].view.id
        )));
    }
}
#[test]
fn arcane_pulse_resolves_during_performing_then_releases_with_frozen_cooldowns_and_ai() {
    let mut s = fixture(true);
    for dx in [-5., 5.] {
        s.spawn_actor(
            Archetype::Orc,
            s.combat.actors[4].view.pos + Vec2::new(dx, 0.),
        );
    }
    start(&mut s);
    let clock = s.combat.combat_steps;
    let actor_rng: Vec<_> = s.combat.actors.iter().map(|a| a.ai_rng.0).collect();
    let cd = s.combat.actors[3].pulse_cd;
    let mut performing_steps = 0;
    while s.snapshot.spotlight.as_ref().unwrap().phase == SpotlightPhase::Performing {
        s.step();
        performing_steps += 1;
        assert!(performing_steps < 50);
        assert_eq!(s.combat.combat_steps, clock);
        assert_eq!(s.combat.actors[3].pulse_cd, cd);
        assert_eq!(
            s.combat
                .actors
                .iter()
                .map(|a| a.ai_rng.0)
                .collect::<Vec<_>>(),
            actor_rng
        );
    }
    // Cast impact + pulse countdown exceeds the caster's full animation duration.
    assert!(performing_steps as f32 * SIM_DT > CAST_DURATION);
    let v = s.snapshot.spotlight.as_ref().unwrap();
    assert_eq!(v.skill, Skill::ArcanePulse);
    assert_eq!(
        v.participants,
        vec![
            4,
            s.combat.actors[4].view.id,
            s.combat.actors[5].view.id,
            s.combat.actors[6].view.id
        ]
    );
    assert_eq!(v.hazards.len(), 1);
    let id = v.hazards[0];
    let h = s.combat.hazards.iter().find(|h| h.view.id == id).unwrap();
    assert_eq!(h.view.phase, HazardPhase::Resolved);
    assert!(h.perception_pending);
    assert!(s.combat.actors[4].view.hp < 100000.);
    s.release_spotlight();
    s.step();
    assert!(!s.combat.hazards.iter().any(|h| h.view.id == id));
    assert_ne!(
        s.combat
            .actors
            .iter()
            .map(|a| a.ai_rng.0)
            .collect::<Vec<_>>(),
        actor_rng
    );
}
#[test]
fn arcane_pulse_cast_and_cooldown_are_hashed() {
    let mut s = fixture(false);
    let hash = s.state_hash();
    s.combat.actors[3].pulse_cd = 2.;
    assert_ne!(s.state_hash(), hash);
    s.combat.actors[3].pulse_cd = 0.;
    s.combat.actors[3].action_pulse = true;
    assert_ne!(s.state_hash(), hash);
}
#[test]
fn arcane_pulse_larger_countdown_preserves_warning_damage_tradeoff() {
    let base = Sim::dodge_trial(
        SimConfig::default(),
        HazardKind::ArcanePulse,
        Archetype::Kaja,
        1.,
        1.,
    );
    let enlarged = Sim::dodge_trial(
        SimConfig::default(),
        HazardKind::ArcanePulse,
        Archetype::Kaja,
        1.,
        2.,
    );
    let b = base
        .hazards
        .iter()
        .find(|h| h.view.kind == HazardKind::ArcanePulse)
        .unwrap();
    let e = enlarged
        .hazards
        .iter()
        .find(|h| h.view.kind == HazardKind::ArcanePulse)
        .unwrap();
    assert_eq!(b.duration, ARCANE_PULSE_COUNTDOWN);
    assert_eq!(
        e.view.shape,
        Shape::Circle {
            radius: ARCANE_PULSE_RADIUS * 2.
        }
    );
    assert!((e.duration / b.duration - 2.).abs() < 0.0001);
    assert!((e.damage / b.damage - 2.).abs() < 0.0001);
}
#[test]
fn arcane_pulse_zero_allocations_for_cast_hazard_resolution_and_release() {
    let mut s = fixture(true);
    start(&mut s);
    let mut allocations = 0;
    while s
        .combat
        .spotlight
        .active
        .as_ref()
        .is_some_and(|s| s.phase == SpotlightPhase::Performing)
    {
        ALLOCATIONS.with(|n| n.set(Some(0)));
        s.step();
        allocations += ALLOCATIONS.with(|n| n.replace(None)).unwrap();
        s.combat.events.clear();
    }
    ALLOCATIONS.with(|n| n.set(Some(0)));
    s.release_spotlight();
    s.step();
    allocations += ALLOCATIONS.with(|n| n.replace(None)).unwrap();
    assert_eq!(allocations, 0);
}
#[test]
fn faze_never_spotlit_even_with_explicit_opt_in() {
    for preset in [
        SpotlightConfig::CONSERVATIVE,
        SpotlightConfig::DEFAULT,
        SpotlightConfig::AGGRESSIVE,
    ] {
        assert!(!preset.skills[Skill::Faze.index()]);
        assert!(preset.skills[Skill::ArcanePulse.index()]);
    }
    for enabled in [false, true] {
        let mut s = fixture(true);
        s.combat.cfg.spotlight.skills[Skill::Faze.index()] = enabled;
        let target = s.combat.actors[4].view.id;
        s.combat.start_extra(3, target);
        s.combat.select_spotlight();
        s.refresh_snapshot();
        assert!(s.snapshot.spotlight.is_none());
    }
}
