use super::*;
use crate::{hazards::HitPolicy, tests::ALLOCATIONS, tuning::*};
fn fixture(spotlight: bool) -> Sim {
    let mut s = Sim::composition_trial(
        SimConfig {
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
        },
        &[Archetype::Orc],
    );
    s.combat.hazards.clear();
    for a in &mut s.combat.actors {
        a.view.pos = Vec2::new(480., 1100.);
        a.destination = a.view.pos;
        a.formed_age = 100.;
        a.basic_cd = 100.;
        a.special_cd = 100.;
        a.extra_cd = 100.;
        a.pulse_cd = 100.;
        a.mend_cd = 100.;
    }
    s.combat.actors[4].view.pos.x += 100.;
    s.combat.actors[4].view.hp = 100000.;
    s.combat.actors[4].view.max_hp = 100000.;
    s.combat.actors[4].stats.evade = 0.;
    s.combat.actors[4].stats.def = 0.;
    s.combat.actors[0].target = Some(s.combat.actors[4].view.id);
    s.combat.actors[0].view.ai_intent = AiIntent::Attack;
    s.combat.actors[0].ai_cd = 100.;
    s.combat.events.clear();
    s
}
fn start(s: &mut Sim) {
    let target = s.combat.actors[4].view.id;
    s.combat.start_ground_pound(0, target);
    s.combat.select_spotlight();
    s.refresh_snapshot();
}
fn warcry_ward_impact(s: &mut Sim) {
    s.combat.actors[0].view.meter = 1.;
    s.combat.start_extra(0, s.combat.actors[4].view.id);
    s.combat.actors[0].view.state_age = WARCRY_WINDUP;
    s.combat.action(0);
}
#[test]
fn warcry_shield_grants_at_resolve_only_to_fara_even_without_taunt_recipients() {
    for recipients in [false, true] {
        for initial in [0., 10., 200.] {
            let mut s = fixture(false);
            if !recipients {
                s.combat.actors[4].view.pos.x += TAUNT_RADIUS + 1.;
            }
            s.combat.actors[0].view.ward = initial;
            s.combat.actors[0].self_ward_steps = 13;
            s.combat.actors[0].view.meter = 1.;
            s.combat.start_extra(0, s.combat.actors[4].view.id);
            s.combat.actors[0].view.state_age = WARCRY_WINDUP - SIM_DT;
            s.combat.action(0);
            assert_eq!(s.combat.actors[0].view.ward, initial);
            assert!(!s.combat.actors[0].view.warcry_shield);
            assert!(!s
                .drain_events()
                .iter()
                .any(|e| matches!(e, Event::WardGained { .. })));
            s.combat.actors[0].view.state_age = WARCRY_WINDUP;
            s.combat.action(0);
            let expected = initial.max(s.combat.actors[0].view.max_hp * WARCRY_WARD_FRACTION);
            let fara = s.combat.actors[0].view.id;
            let events = s.drain_events();
            assert_eq!(
                events
                    .iter()
                    .filter_map(|e| match e {
                        Event::WardGained { target, amount } => Some((*target, *amount)),
                        _ => None,
                    })
                    .collect::<Vec<_>>(),
                vec![(fara, expected - initial)]
            );
            assert_eq!(
                events.iter().any(|e| matches!(e, Event::Taunt { .. })),
                recipients
            );
            assert!(s.combat.actors[1..]
                .iter()
                .all(|a| a.view.ward == 0. && !a.view.warcry_shield));
            assert_eq!(s.combat.actors[0].self_ward_steps, 0);
            // A minute of combat timers plus seven seconds through the real step path.
            for _ in 0..60 * SIM_HZ {
                s.combat.timers();
            }
            assert_eq!(s.combat.actors[0].view.ward, expected);
            assert!(s.combat.actors[0].view.warcry_shield);
            let clock = s.combat.combat_steps;
            for _ in 0..7 * SIM_HZ {
                s.step();
            }
            assert_eq!(s.combat.combat_steps - clock, 7 * SIM_HZ as u64);
            assert_eq!(s.snapshot.actors[0].ward, expected);
            assert!(s.snapshot.actors[0].warcry_shield);
            assert_eq!(s.combat.actors[0].self_ward_steps, 0);
        }
    }
}
#[test]
fn warcry_shield_credits_actual_delta_to_boss_enmity_and_dead_caster_cannot_grant() {
    for initial in [0., 200.] {
        let mut s = fixture(false);
        s.combat.actors[4].view.pos.x += TAUNT_RADIUS + 1.;
        let boss = s.spawn_actor(Archetype::Boss, Vec2::new(480., 400.));
        let j = s.combat.actor_index(boss).unwrap();
        s.combat.actors[j].enmity = [0.; 4];
        s.combat.actors[j].enmity_seeded = true;
        s.combat.actors[0].view.ward = initial;
        warcry_ward_impact(&mut s);
        assert_eq!(
            s.combat.actors[j].enmity,
            [
                (s.combat.actors[0].view.ward - initial) * ENMITY_WARD,
                0.,
                0.,
                0.
            ]
        );
    }
    let mut s = fixture(false);
    s.combat.actors[0].view.meter = 1.;
    s.combat.start_extra(0, s.combat.actors[4].view.id);
    s.combat.actors[0].view.state_age = WARCRY_WINDUP;
    s.combat.actors[0].view.hp = 0.;
    s.combat.action(0);
    assert_eq!(s.combat.actors[0].view.ward, 0.);
    assert!(!s.combat.actors[0].view.warcry_shield);
    assert!(!s
        .drain_events()
        .iter()
        .any(|e| matches!(e, Event::WardGained { .. })));
}
#[test]
fn ground_pound_resolve_never_grants_ward_or_changes_a_shield() {
    for existing in [false, true] {
        let mut s = fixture(false);
        if existing {
            warcry_ward_impact(&mut s);
            s.combat.actors[0].view.state_age = s.combat.actors[0].view.state_duration;
        }
        let before: Vec<_> = s
            .combat
            .actors
            .iter()
            .map(|a| (a.view.ward, a.view.warcry_shield))
            .collect();
        s.combat.events.clear();
        start(&mut s);
        s.combat.actors[0].view.state_age = CAST_IMPACT;
        s.combat.action(0);
        for h in &mut s.combat.hazards {
            if h.view.kind == HazardKind::GroundPound {
                h.phase_age = h.duration;
            }
        }
        s.resolve_hazards();
        assert_eq!(
            s.combat
                .actors
                .iter()
                .map(|a| (a.view.ward, a.view.warcry_shield))
                .collect::<Vec<_>>(),
            before
        );
        let events = s.drain_events();
        assert!(events.iter().any(|e| matches!(
            e,
            Event::HazardResolved {
                kind: HazardKind::GroundPound,
                ..
            }
        )));
        assert!(!events.iter().any(|e| matches!(e, Event::WardGained { .. })));
    }
}
#[test]
fn warcry_shield_flag_clears_at_exact_depletion() {
    let mut s = fixture(false);
    warcry_ward_impact(&mut s);
    let source = s.combat.actors[4].view.id;
    let ward = s.combat.actors[0].view.ward;
    let hp = s.combat.actors[0].view.hp;
    s.combat
        .damage(source, 0, ward - 1., false, false, Element::Physical);
    s.refresh_snapshot();
    assert_eq!(s.snapshot.actors[0].ward, 1.);
    assert_eq!(s.snapshot.actors[0].hp, hp);
    assert!(s.snapshot.actors[0].warcry_shield);
    s.combat
        .damage(source, 0, 1., false, false, Element::Physical);
    s.refresh_snapshot();
    assert_eq!(s.snapshot.actors[0].ward, 0.);
    assert_eq!(s.snapshot.actors[0].hp, hp);
    assert!(!s.snapshot.actors[0].warcry_shield);
    s.combat
        .damage(source, 0, 1., false, false, Element::Physical);
    assert_eq!(s.combat.actors[0].view.hp, hp - 1.);
}
#[test]
fn warcry_shield_recast_refreshes_without_stacking_and_flag_is_hashed() {
    let mut s = fixture(false);
    warcry_ward_impact(&mut s);
    let ward = s.combat.actors[0].view.ward;
    let hash = s.state_hash();
    s.combat.actors[0].view.warcry_shield = false;
    assert_ne!(s.state_hash(), hash);
    s.combat.actors[0].view.warcry_shield = true;
    s.combat.damage(
        s.combat.actors[4].view.id,
        0,
        10.,
        false,
        false,
        Element::Physical,
    );
    for _ in 0..2 {
        s.combat.actors[0].view.state_age = s.combat.actors[0].view.state_duration;
        warcry_ward_impact(&mut s);
        s.refresh_snapshot();
        assert_eq!(s.snapshot.actors[0].ward, ward);
        assert!(s.snapshot.actors[0].warcry_shield);
        assert_eq!(s.combat.actors[0].self_ward_steps, 0);
    }
}
#[test]
fn warcry_shield_survives_stage_clear_and_clears_on_down_or_wipe() {
    for down in [false, true] {
        let mut s = fixture(false);
        warcry_ward_impact(&mut s);
        let ward = s.combat.actors[0].view.ward;
        s.reset_stage(true);
        s.refresh_snapshot();
        assert_eq!(s.snapshot.actors[0].ward, ward);
        assert!(s.snapshot.actors[0].warcry_shield);
        if down {
            s.combat.actors[0].view.hp = 0.;
            s.deaths();
        } else {
            s.reset_stage(false);
        }
        s.refresh_snapshot();
        assert_eq!(s.snapshot.actors[0].ward, 0.);
        assert!(!s.snapshot.actors[0].warcry_shield);
        assert_eq!(s.combat.actors[0].self_ward_steps, 0);
    }
}
#[test]
fn ground_pound_uses_meter_in_range_and_ignores_retired_cooldown() {
    for (distance, cooldown, fire) in [(300., 0., true), (301., 0., false), (100., 1., true)] {
        let mut s = fixture(false);
        s.stage.buffs.attack_speed = 0.35;
        s.combat.actors[4].view.pos = s.combat.actors[0].view.pos + Vec2::new(distance, 0.);
        s.combat.actors[0].pound_cd = cooldown;
        s.combat.actors[0].view.meter = 2.;
        s.hero_ai();
        assert_eq!(
            s.drain_events()
                .iter()
                .filter(|e| matches!(
                    e,
                    Event::SkillStarted {
                        skill: Skill::GroundPound,
                        ..
                    }
                ))
                .count(),
            usize::from(fire)
        );
        if fire {
            assert_eq!(s.combat.actors[0].pound_cd, cooldown);
            assert_eq!(s.combat.actors[0].special_cd, 100.);
            assert_eq!(s.combat.actors[0].extra_cd, 100.);
            assert!(s.combat.actors[0].action_pound && !s.combat.actors[0].action_extra);
            assert_eq!(s.combat.actors[0].view.state_duration, CAST_DURATION);
            assert_eq!(s.combat.actors[0].view.impact_at, CAST_IMPACT);
            s.combat.timers();
            assert_eq!(s.combat.actors[0].pound_cd, (cooldown - SIM_DT).max(0.));
            s.reset_stage(false);
            assert_eq!(s.combat.actors[0].pound_cd, 0.);
            assert_eq!(s.combat.actors[0].skill_lockout, 0.);
            assert!(!s.combat.actors[0].action_pound);
        }
    }
}
#[test]
fn ground_pound_line_uses_feet_enemies_only_and_pushes_along_direction() {
    let mut s = fixture(false);
    s.combat.actors[4].view.pos.x =
        s.combat.actors[0].view.pos.x + GROUND_POUND_LENGTH - s.combat.actors[4].view.radius;
    start(&mut s);
    s.combat.actors[0].view.state_age = CAST_IMPACT;
    s.combat.action(0);
    let h = s.combat.hazards[0].clone();
    assert_eq!(h.view.kind, HazardKind::GroundPound);
    assert_eq!(h.view.origin, s.combat.actors[0].view.pos);
    assert_eq!(
        h.view.shape,
        Shape::Line {
            length: 300.,
            width: 80.,
        }
    );
    assert_eq!(h.view.fill, FillMode::Countdown);
    assert_eq!(h.policy, HitPolicy::Snapshot);
    assert_eq!(h.duration, GROUND_POUND_COUNTDOWN);
    assert_eq!(h.damage, s.combat.actors[0].stats.atk * 2.4);
    assert!(h.hits(h.view.origin + Vec2::new(100., 30.), h.hit_radius(18.)));
    assert!(!h.hits(h.view.origin + Vec2::new(100., 41.), h.hit_radius(18.)));
    assert!(h.hits(h.view.origin + Vec2::new(301., 0.), h.hit_radius(18.))); // finale extends beyond the line
    assert!(!h.hits(h.view.origin + Vec2::new(381., 0.), h.hit_radius(18.)));
    assert!(!h.hits(h.view.origin - Vec2::new(1., 0.), h.hit_radius(18.)));
    assert!(h.hits(h.view.origin + Vec2::new(300., 40.), h.hit_radius(18.)));
    assert!(h.hits(h.view.origin + Vec2::new(100., -40.), h.hit_radius(18.)));
    assert!(!h.hits(h.view.origin + Vec2::new(100., -41.), h.hit_radius(18.)));
    let outside = s.spawn_actor(Archetype::Orc, h.view.origin + Vec2::new(100., 41.));
    let outside_hp = s.combat.actors.last().unwrap().view.hp;
    let edge = s.spawn_actor(Archetype::Orc, h.view.origin + Vec2::new(301., 0.));
    let edge_hp = s.combat.actors.last().unwrap().view.hp;
    let side = s.spawn_actor(Archetype::Orc, h.view.origin + Vec2::new(100., 30.));
    let side_pos = s.combat.actors[s.combat.actor_index(side).unwrap()]
        .view
        .pos;
    let hero_hp: Vec<_> = s.combat.actors[..4].iter().map(|a| a.view.hp).collect();
    let target_pos = s.combat.actors[4].view.pos;
    for _ in 0..(GROUND_POUND_COUNTDOWN * SIM_HZ as f32).ceil() as u32 {
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
    assert!(s.combat.actors[s.combat.actor_index(edge).unwrap()].view.hp < edge_hp);
    assert_eq!(
        s.combat.actors[s.combat.actor_index(outside).unwrap()]
            .view
            .hp,
        outside_hp
    );
    assert_eq!(s.combat.actors[4].view.pos, target_pos + h.view.dir * 30.);
    assert_eq!(
        s.combat.actors[s.combat.actor_index(side).unwrap()]
            .view
            .pos,
        side_pos + h.view.dir * 30.
    );
    assert!(s.combat.actors[4].view.hp < 100000.);
    let events = s.drain_events();
    assert!(events.iter().any(|e| matches!(
        e,
        Event::Hit {
            source: 1,
            target,
            element: Element::Physical,
            ..
        } if *target == s.combat.actors[4].view.id
    )));
    assert!(events
        .iter()
        .any(|e| matches!(e,Event::Hit{target,element:Element::Physical,..} if *target==side)));
}
#[test]
fn ground_pound_performing_finishes_hazard_and_full_cast_with_zero_allocations() {
    let mut s = fixture(true);
    for dx in [-5., 5.] {
        s.spawn_actor(
            Archetype::Orc,
            s.combat.actors[4].view.pos + Vec2::new(dx, 0.),
        );
    }
    start(&mut s);
    let clock = s.combat.combat_steps;
    let cd = s.combat.actors[0].pound_cd;
    let rng: Vec<_> = s.combat.actors.iter().map(|a| a.ai_rng.0).collect();
    let mut steps = 0;
    let mut allocations = 0;
    while s.snapshot.spotlight.as_ref().unwrap().phase == SpotlightPhase::Performing {
        ALLOCATIONS.with(|n| n.set(Some(0)));
        s.step();
        allocations += ALLOCATIONS.with(|n| n.replace(None)).unwrap();
        steps += 1;
        assert!(steps < 60);
        assert_eq!(s.combat.combat_steps, clock);
        assert_eq!(s.combat.actors[0].pound_cd, cd);
        assert_eq!(
            s.combat
                .actors
                .iter()
                .map(|a| a.ai_rng.0)
                .collect::<Vec<_>>(),
            rng
        );
        s.combat.events.clear();
    }
    assert!(!s.combat.actors[0].view.warcry_shield);
    assert_eq!(s.combat.actors[0].self_ward_steps, 0);
    assert_eq!(s.combat.actors[0].view.ward, 0.);
    for _ in 0..10 {
        s.step();
    }
    assert!(!s.combat.actors[0].view.warcry_shield);
    assert_eq!(s.combat.actors[0].self_ward_steps, 0);
    assert!(steps as f32 * SIM_DT > CAST_DURATION); // The eruption outlasts caster recovery.
    let v = s.snapshot.spotlight.as_ref().unwrap();
    assert_eq!(v.skill, Skill::GroundPound);
    assert_eq!(
        v.participants,
        vec![
            1,
            s.combat.actors[4].view.id,
            s.combat.actors[5].view.id,
            s.combat.actors[6].view.id
        ]
    );
    assert_eq!(v.hazards.len(), 1);
    let h = s
        .combat
        .hazards
        .iter()
        .find(|h| h.view.id == v.hazards[0])
        .unwrap();
    assert_eq!(h.view.phase, HazardPhase::Resolved);
    ALLOCATIONS.with(|n| n.set(Some(0)));
    s.release_spotlight();
    s.step();
    allocations += ALLOCATIONS.with(|n| n.replace(None)).unwrap();
    assert_eq!(allocations, 0);
}
#[test]
fn ground_pound_cooldown_and_action_are_hashed() {
    let mut s = fixture(false);
    let hash = s.state_hash();
    s.combat.actors[0].pound_cd = 1.;
    assert_ne!(hash, s.state_hash());
    s.combat.actors[0].pound_cd = 0.;
    s.combat.actors[0].action_pound = true;
    assert_ne!(hash, s.state_hash());
}
#[test]
fn ground_pound_enlargement_scales_countdown_and_damage() {
    let b = Sim::dodge_trial(
        SimConfig::default(),
        HazardKind::GroundPound,
        Archetype::Fara,
        1.,
        1.,
    );
    let e = Sim::dodge_trial(
        SimConfig::default(),
        HazardKind::GroundPound,
        Archetype::Fara,
        1.,
        2.,
    );
    // Enlarged lines preserve the base floor and proportional warning/damage.
    assert!(e.hazards[0].duration >= b.combat.hazards[0].duration);
    assert!(
        (e.hazards[0].damage / b.combat.hazards[0].damage
            - e.hazards[0].duration / b.combat.hazards[0].duration)
            .abs()
            < 0.001
    );
}

#[test]
fn ground_pound_is_deterministic_across_step_chunking() {
    let mut reference = fixture(true);
    start(&mut reference);
    for _ in 0..30 {
        reference.step();
    }
    for dt in [1. / 30., 1. / 60., 0.1] {
        let mut s = fixture(true);
        start(&mut s);
        while s.combat.step_number < reference.combat.step_number {
            s.advance(dt);
        }
        assert_eq!(s.combat.step_number, reference.combat.step_number);
        assert_eq!(s.state_hash(), reference.state_hash(), "dt={dt}");
    }
}

#[test]
fn ground_pound_ends_at_target_body_edge_after_commitment() {
    for distance in [100., 300.] {
        let mut s = fixture(false);
        let origin = s.combat.actors[0].view.pos;
        s.combat.actors[4].view.pos = origin + Vec2::new(distance, 0.);
        let length = distance + s.combat.actors[4].view.radius;
        let between = s.spawn_actor(Archetype::Orc, origin + Vec2::new(50., 0.));
        let beyond = s.spawn_actor(
            Archetype::Orc,
            origin + Vec2::new(length + 1., GROUND_POUND_BURST_RADIUS + 1.),
        );
        for a in &mut s.combat.actors[4..] {
            a.stats.evade = 0.;
            a.view.hp = 100000.;
            a.view.max_hp = 100000.;
        }
        start(&mut s);
        s.combat.actors[0].view.state_age = CAST_IMPACT;
        s.combat.action(0);
        assert_eq!(
            s.combat.hazards[0].view.shape,
            Shape::Line {
                length,
                width: GROUND_POUND_WIDTH
            }
        );
        for _ in 0..(s.combat.hazards[0].duration * SIM_HZ as f32).ceil() as u32 {
            s.combat.update_hazards();
            s.resolve_hazards();
        }
        assert!(s.combat.actors[4].view.hp < 100000.);
        assert!(
            s.combat.actors[s.combat.actor_index(between).unwrap()]
                .view
                .hp
                < 100000.
        );
        assert_eq!(
            s.combat.actors[s.combat.actor_index(beyond).unwrap()]
                .view
                .hp,
            100000.
        );
    }
}

#[test]
fn ground_pound_endpoint_burst_hits_off_line_and_double_hits_overlapping_victims() {
    for spotlight in [false, true] {
        let mut s = fixture(spotlight);
        let origin = s.combat.actors[0].view.pos;
        s.combat.actors[4].view.pos = origin + Vec2::new(200., 0.);
        let end = s.combat.actors[4].view.pos + Vec2::new(s.combat.actors[4].view.radius, 0.);
        let line = s.spawn_actor(Archetype::Orc, origin + Vec2::new(100., 0.));
        let overlap = s.spawn_actor(Archetype::Orc, end - Vec2::new(10., 0.));
        let burst = s.spawn_actor(Archetype::Orc, end + Vec2::new(0., 70.));
        let outside = s.spawn_actor(
            Archetype::Orc,
            end + Vec2::new(0., GROUND_POUND_BURST_RADIUS + 1.),
        );
        s.combat.actors[3].view.pos = end + Vec2::new(0., 70.);
        let ally_hp = s.combat.actors[3].view.hp;
        for a in &mut s.combat.actors[4..] {
            a.stats.evade = 0.;
            a.view.hp = 100000.;
            a.view.max_hp = 100000.;
        }
        start(&mut s);
        s.combat.actors[0].view.state_age = CAST_IMPACT;
        s.combat.action(0);
        if spotlight {
            let members = s.combat.spotlight.active.unwrap().participants;
            for id in [line, overlap, burst] {
                assert!(members.slice().contains(&id));
            }
            assert!(!members.slice().contains(&s.combat.actors[3].view.id));
        }
        assert_eq!(
            s.combat.actors[s.combat.actor_index(burst).unwrap()]
                .view
                .hp,
            100000.
        );
        for _ in 0..(s.combat.hazards[0].duration * SIM_HZ as f32).ceil() as u32 + 3 {
            s.combat.update_hazards();
            s.resolve_hazards();
        }
        let events = s.drain_events();
        for (id, hits) in [
            (s.combat.actors[4].view.id, 2),
            (line, 1),
            (overlap, 2),
            (burst, 1),
        ] {
            assert_eq!(
                events
                    .iter()
                    .filter(|e| matches!(e, Event::Hit { source: 1, target, .. } if *target == id))
                    .count(),
                hits
            );
            let damage: Vec<_> = events
                .iter()
                .filter_map(|e| match e {
                    Event::Hit {
                        source: 1,
                        target,
                        amount,
                        ..
                    } if *target == id => Some(*amount),
                    _ => None,
                })
                .collect();
            // Measured before the shield transfer, in both spotlight modes.
            assert_eq!(damage, vec![63.36; hits]);
            assert!(s.combat.actors[s.combat.actor_index(id).unwrap()].view.hp < 100000.);
        }
        for (id, pos) in [
            (s.combat.actors[4].view.id, Vec2::new(710., 1100.)),
            (line, Vec2::new(610., 1100.)),
            (overlap, Vec2::new(714., 1100.)),
            (burst, Vec2::new(724., 1170.)),
        ] {
            assert_eq!(
                s.combat.actors[s.combat.actor_index(id).unwrap()].view.pos,
                pos
            );
        }
        assert_eq!(
            s.combat.actors[s.combat.actor_index(outside).unwrap()]
                .view
                .hp,
            100000.
        );
        assert_eq!(s.combat.actors[3].view.hp, ally_hp);
    }
}

#[test]
fn ground_pound_tracks_walking_target_and_caster_then_locks_on_target_death() {
    let mut s = fixture(false);
    start(&mut s);
    s.combat.actors[0].view.state_age = CAST_IMPACT;
    s.combat.action(0);
    let duration = s.combat.hazards[0].duration;
    let damage = s.combat.hazards[0].damage;
    for n in 1..=10 {
        s.combat.actors[4].view.pos.y += 4.;
        s.combat.actors[0].view.pos.x -= 1.;
        s.combat.update_hazards();
        s.resolve_hazards();
        let h = &s.combat.hazards[0];
        assert_eq!(h.view.origin, s.combat.actors[0].view.pos);
        assert!(h.hits(s.combat.actors[4].view.pos, 0.), "step {n}");
        assert_eq!(h.duration, duration);
        assert_eq!(h.damage, damage);
    }
    let locked = s.combat.hazards[0].view.clone();
    s.combat.actors[4].view.hp = 0.;
    s.combat.actors[0].view.pos.y += 100.;
    s.combat.actors[4].view.pos.x += 100.;
    s.combat.update_hazards();
    s.resolve_hazards();
    assert_eq!(s.combat.hazards[0].view.origin, locked.origin);
    assert_eq!(s.combat.hazards[0].view.dir, locked.dir);
    assert_eq!(s.combat.hazards[0].view.shape, locked.shape);
}

#[test]
fn ground_pound_aims_after_last_step_movement_and_hits_target_and_path() {
    let mut s = fixture(false);
    start(&mut s);
    s.combat.actors[0].view.state_age = CAST_IMPACT;
    s.combat.action(0);
    let center = s.combat.actors[0].view.pos;
    let between = s.spawn_actor(Archetype::Orc, center + Vec2::new(0., 50.));
    let b = s.combat.actor_index(between).unwrap();
    s.combat.actors[b].stats.evade = 0.;
    s.combat.actors[b].view.hp = 100000.;
    s.combat.hazards[0].phase_age = s.combat.hazards[0].duration - SIM_DT;
    s.combat.update_hazards();
    // AI movement happens between update_hazards and resolution in a real step.
    s.combat.actors[4].view.pos = center + Vec2::new(0., 100.);
    s.resolve_hazards();
    assert!(s.combat.actors[4].view.hp < 100000.);
    assert!(s.combat.actors[b].view.hp < 100000.);
    assert_eq!(s.combat.hazards[0].target_contact, Some(true));
    assert_eq!(s.combat.hazards[0].view.dir, Vec2::new(0., 1.));
}
