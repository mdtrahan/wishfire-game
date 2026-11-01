use crate::{tuning::*, *};
fn fixture() -> Sim {
    let mut s = Sim::composition_trial(SimConfig::default(), &[Archetype::Orc]);
    s.combat.hazards.clear();
    for a in &mut s.combat.actors {
        a.view.pos = Vec2::new(480., 1100.);
        a.destination = a.view.pos;
        a.formed_age = 100.;
        a.basic_cd = 100.;
        a.special_cd = 100.;
        a.extra_cd = 100.;
        a.pound_cd = 100.;
        a.pulse_cd = 100.;
        a.mend_cd = 100.;
    }
    s.combat.events.clear();
    s
}
#[test]
fn taunt_ignores_materialising_enemies_and_refunds_empty_impact() {
    for reason in [0, 1, 2] {
        let mut s = fixture();
        let target = s.combat.actors[4].view.id;
        s.combat.actors[0].view.meter = 1.;
        s.combat.start_extra(0, target);
        match reason {
            0 => s.combat.actors[4].begin_spawn(),
            1 => s.combat.actors[4].view.hp = 0.,
            _ => s.combat.actors[4].view.pos.x += TAUNT_RADIUS + 1.,
        }
        s.combat.actors[0].view.state_age = WARCRY_WINDUP;
        s.combat.action(0);
        assert_eq!(s.combat.actors[0].extra_cd, 0.);
        assert_eq!(s.combat.actors[0].skill_lockout, 0.);
        assert!(!s
            .drain_events()
            .iter()
            .any(|e| matches!(e, Event::Taunt { .. })));
    }
    let mut s = fixture();
    s.combat.actors[4].begin_spawn();
    s.combat.actors[0].extra_cd = 0.;
    s.combat.actors[0].target = Some(s.combat.actors[4].view.id);
    s.combat.actors[0].view.ai_intent = AiIntent::Attack;
    s.hero_ai();
    assert!(!s.drain_events().iter().any(|e| matches!(
        e,
        Event::SkillStarted {
            skill: Skill::Taunt,
            ..
        }
    )));
}
#[test]
fn taunt_real_recipients_spend_meter_without_cooldown_and_exclude_spawn() {
    let mut s = fixture();
    let target = s.combat.actors[4].view.id;
    let spawn = s.spawn_actor(Archetype::Orc, s.combat.actors[4].view.pos);
    s.combat.actors.last_mut().unwrap().begin_spawn();
    s.combat.actors[0].view.meter = 1.;
    s.combat.start_extra(0, target);
    s.combat.actors[0].view.state_age = WARCRY_WINDUP;
    s.combat.action(0);
    assert_eq!(s.combat.actors[0].view.meter, 0.);
    assert_eq!(s.combat.actors[0].skill_lockout, 0.);
    let es = s.drain_events();
    let enemies = es
        .iter()
        .find_map(|e| {
            if let Event::Taunt { enemies, .. } = e {
                Some(enemies)
            } else {
                None
            }
        })
        .unwrap();
    assert_eq!(enemies, &vec![target]);
    assert!(!enemies.contains(&spawn));
}
#[test]
fn placed_hero_circles_fit_wall_and_corner_with_their_full_radius() {
    for kind in [
        HazardKind::FazePool,
        HazardKind::ArcanePulse,
        HazardKind::BubblePop,
    ] {
        for p in [
            Vec2::new(ARENA_MIN.x + 20., ARENA_MIN.y + 20.),
            Vec2::new(ARENA_MAX.x - 20., ARENA_MAX.y - 20.),
        ] {
            let mut s = fixture();
            s.combat.actors[4].view.pos = p;
            s.combat.actors[3].view.pos = crate::math::floor_point(p, 20.);
            match kind {
                HazardKind::FazePool => s.combat.place_faze(3, p),
                HazardKind::ArcanePulse => {
                    let target = s.combat.actors[4].view.id;
                    s.combat.start_arcane_pulse(3, target);
                    s.combat.actors[3].view.state_age = CAST_IMPACT;
                    s.combat.action(3);
                }
                _ => {
                    let target = s.combat.actors[4].view.id;
                    s.combat.actors[2].view.pos = p;
                    s.combat.start_action(2, Some(target), true, false);
                }
            }
            let h = s
                .combat
                .hazards
                .iter()
                .find(|h| h.view.kind == kind)
                .unwrap();
            let Shape::Circle { radius } = h.view.shape else {
                panic!()
            };
            assert_eq!(
                h.view.origin,
                crate::math::floor_point(h.view.origin, radius)
            );
            // Full-circle containment can move a corner cast away from its original aim.
            // The published centre is the authoritative damage centre.
        }
    }
}
