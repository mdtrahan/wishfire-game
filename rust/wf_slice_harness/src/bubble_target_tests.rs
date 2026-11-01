use super::*;
use crate::tuning::*;
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
        a.view.pos = Vec2::new(550., 1100.);
        a.destination = a.view.pos;
        a.formed_age = 100.;
        a.basic_cd = 100.;
        a.special_cd = 100.;
        a.extra_cd = 100.;
        a.pulse_cd = 100.;
        a.pound_cd = 100.;
    }
    s.combat.actors[2].view.pos = Vec2::new(300., 1100.);
    s.combat.actors[2].target = Some(s.combat.actors[4].view.id);
    s.combat.actors[2].view.ai_intent = AiIntent::Attack;
    s.combat.actors[2].ai_cd = 100.;
    s.combat.actors[4].view.hp = 100000.;
    s.combat.actors[4].stats.evade = 0.;
    s.combat.events.clear();
    s
}
#[test]
fn bubble_pop_forms_at_target_and_hits_pushes_enemies_from_that_fixed_center() {
    let mut s = fixture(true);
    let center = s.combat.actors[4].view.pos;
    let inside = s.spawn_actor(Archetype::Orc, center + Vec2::new(100., 0.));
    let outside = s.spawn_actor(Archetype::Orc, center + Vec2::new(180., 0.));
    let out_hp = s.combat.actors.last().unwrap().view.hp;
    let third = s.spawn_actor(Archetype::Orc, center + Vec2::new(-5., 0.));
    let hero_hp: Vec<_> = s.combat.actors[..4].iter().map(|a| a.view.hp).collect();
    s.combat
        .start_action(2, Some(s.combat.actors[4].view.id), true, false);
    s.combat.select_spotlight();
    s.refresh_snapshot();
    let h = &s.combat.hazards[0];
    assert_eq!(h.view.origin, center);
    assert!(!h.hits(s.combat.actors[2].view.pos, 0.));
    assert_eq!(
        s.snapshot.spotlight.as_ref().unwrap().participants,
        vec![3, s.combat.actors[4].view.id, inside, third]
    );
    let mut steps = 0;
    while s.snapshot.spotlight.as_ref().unwrap().phase == SpotlightPhase::Performing {
        s.step();
        steps += 1;
        assert!(steps < 40);
    }
    assert_eq!(s.combat.hazards[0].view.origin, center);
    assert_eq!(
        s.combat.actors[..4]
            .iter()
            .map(|a| a.view.hp)
            .collect::<Vec<_>>(),
        hero_hp
    );
    assert!(s.combat.actors[4].view.hp < 100000.);
    assert!((s.combat.actors[4].view.pos.distance(center) - BUBBLE_PUSH).abs() < 0.001);
    let p = s.combat.actors[s.combat.actor_index(inside).unwrap()]
        .view
        .pos;
    assert!((p.distance(center) - 100. - BUBBLE_PUSH).abs() < 0.001);
    assert_eq!(
        s.combat.actors[s.combat.actor_index(outside).unwrap()]
            .view
            .hp,
        out_hp
    );
    assert!(!s
        .snapshot
        .spotlight
        .as_ref()
        .unwrap()
        .participants
        .iter()
        .any(|id| [1, 2, 4].contains(id)));
}
#[test]
fn bubble_pop_warning_tracks_target_and_prevents_movement_miss() {
    let mut s = fixture(false);
    let center = s.combat.actors[4].view.pos;
    s.combat
        .start_action(2, Some(s.combat.actors[4].view.id), true, false);
    s.combat.actors[4].view.pos.x += 200.;
    for _ in 0..11 {
        s.combat.update_hazards();
        s.resolve_hazards();
    }
    assert_eq!(
        s.combat.hazards[0].view.origin,
        crate::math::floor_point(center + Vec2::new(200., 0.), BUBBLE_RADIUS)
    );
    assert!(s.combat.actors[4].view.hp < 100000.);
    assert!(s.drain_events().iter().any(|e|matches!(e,Event::HazardResolved{kind:HazardKind::BubblePop,victims,..} if !victims.is_empty())));
}
#[test]
fn bubble_pop_uses_staff_reach_and_current_living_enemy_target() {
    for inside in [false, true] {
        let mut s = fixture(false);
        let range = s.combat.actors[2].attack_range(&s.combat.actors[4]);
        s.combat.actors[4].view.pos = s.combat.actors[2].view.pos
            + Vec2::new(if inside { range - 1. } else { range + 1. }, 0.);
        s.combat.actors[2].special_cd = 0.;
        s.combat.actors[2].view.meter = 1.;
        for _ in 0..MAGE_AOE_HOLD_STEPS {
            s.combat.groove_timers();
        }
        s.hero_ai();
        let bubble = s
            .combat
            .hazards
            .iter()
            .find(|h| h.view.kind == HazardKind::BubblePop);
        assert_eq!(bubble.is_some(), inside);
        if let Some(h) = bubble {
            assert_eq!(h.view.origin, s.combat.actors[4].view.pos);
        }
    }
}
