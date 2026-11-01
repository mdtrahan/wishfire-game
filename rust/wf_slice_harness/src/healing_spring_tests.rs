use crate::{tuning::*, *};
fn fixture() -> Sim {
    let mut s = Sim::composition_trial(SimConfig::default(), &[Archetype::Orc]);
    s.combat.hazards.clear();
    for a in &mut s.combat.actors {
        a.formed_age = 100.;
        a.basic_cd = 100.;
        a.mend_cd = 100.;
    }
    s.combat.actors[2].view.pos = Vec2::new(480., 1100.);
    s.combat.actors[4].view.pos = Vec2::new(480., 1250.);
    s.combat.actors[2].target = Some(s.combat.actors[4].view.id);
    s.combat.actors[2].view.ai_intent = AiIntent::Attack;
    s.combat.actors[2].view.meter = 3.;
    s.combat.events.clear();
    s
}
#[test]
fn hit_stop_starts_on_healing_cast_not_impact_or_bubble_pop() {
    let mut s = fixture();
    s.combat.actors[0].view.hp = s.combat.actors[0].view.max_hp * 0.4;
    let hp = s.combat.actors[0].view.hp;
    assert!(s.combat.groove_action(2));
    assert!(s.drain_events().iter().any(|e| matches!(
        e,
        Event::SkillStarted {
            skill: Skill::HealingSpring,
            ..
        }
    )));
    assert_eq!(s.combat.actors[2].view.state, ActorState::Cast);
    assert_eq!(s.combat.actors[2].view.state_age, 0.);
    assert_eq!(s.combat.actors[0].view.hp, hp);
    s.refresh_snapshot();
    let stop = s.snapshot().hit_stop.unwrap();
    assert_eq!(stop.cause, HitStopCause::HealingSpring);
    assert_eq!(stop.actor, s.combat.actors[2].view.id);
    assert_eq!(s.combat.hit_stop_steps, 4);
    let combat = s.combat.combat_steps;
    for _ in 0..4 {
        s.step();
        assert_eq!(s.combat.combat_steps, combat);
        assert_eq!(s.combat.actors[2].view.state_age, 0.);
        assert_eq!(s.combat.actors[0].view.hp, hp);
    }
    assert!(s.snapshot().hit_stop.is_none());
    s.combat.actors[2].view.state_age = CAST_DURATION;
    s.combat.action(2);
    assert!(s.combat.actors[0].view.hp > hp);
    assert!(
        s.combat.hit_stop.is_none(),
        "healing impact must not freeze again"
    );

    let mut s = fixture();
    s.combat.actors[2].aoe_ready_steps = MAGE_AOE_HOLD_STEPS;
    assert!(s.combat.groove_action(2));
    assert!(s.drain_events().iter().any(|e| matches!(
        e,
        Event::SkillStarted {
            skill: Skill::BubblePop,
            ..
        }
    )));
    assert!(s.combat.hit_stop.is_none());
    s.combat.actors[2].view.state_age = CAST_IMPACT;
    s.combat.action(2);
    assert!(s.combat.hit_stop.is_none());
}

#[test]
fn healing_cast_freeze_skips_spotlights_and_yields_to_downs_and_boss_death() {
    let mut s = fixture();
    s.set_spotlight(SpotlightConfig {
        global_gap: 0.,
        hero_gap: 0.,
        fairness: 0.,
        ..SpotlightConfig::DEFAULT
    });
    s.combat.actors[4].view.archetype = Archetype::Boss;
    s.combat.start_arcane_pulse(3, s.combat.actors[4].view.id);
    s.combat.select_spotlight();
    assert!(s.combat.spotlight.active.is_some());
    s.combat.actors[0].view.hp = 1.;
    s.combat.start_extra(2, s.combat.actors[0].view.id);
    assert!(s.drain_events().iter().any(|e| matches!(
        e,
        Event::SkillStarted {
            skill: Skill::HealingSpring,
            ..
        }
    )));
    assert!(s.combat.hit_stop.is_none());

    let mut s = fixture();
    let id = s.combat.actors[2].view.id;
    for cause in [
        HitStopCause::HealingSpring,
        HitStopCause::HeroDowned,
        HitStopCause::BossDied,
    ] {
        s.combat.begin_hit_stop(cause, id);
        s.combat.begin_hit_stop(HitStopCause::HealingSpring, id);
        assert_eq!(s.combat.hit_stop.unwrap().cause, cause);
    }
}

#[test]
fn heal_locks_lowest_fraction_and_lands_for_35_percent_at_cast_end() {
    let mut s = fixture();
    s.combat.actors[0].view.hp = s.combat.actors[0].view.max_hp * 0.55;
    s.combat.actors[1].view.hp = s.combat.actors[1].view.max_hp * 0.2;
    let before = s.combat.actors[1].view.hp;
    assert!(s.combat.groove_action(2));
    assert_eq!(s.combat.actors[2].target, Some(s.combat.actors[1].view.id));
    assert_eq!(s.combat.actors[2].view.meter, 2.);
    s.combat.actors[1].view.pos = ARENA_MIN + Vec2::new(BODY_RADIUS, BODY_RADIUS);
    s.combat.actors[0].view.hp = 1.; // another ally becomes the lowest after commitment
    s.combat.actors[2].view.state_age = CAST_IMPACT;
    s.combat.action(2);
    assert_eq!(s.combat.actors[1].view.hp, before);
    s.combat.actors[2].view.state_age = CAST_DURATION;
    s.combat.action(2);
    assert!(
        (s.combat.actors[1].view.hp - before - s.combat.actors[1].view.max_hp * 0.35).abs() < 0.001
    );
    assert!(s.combat.hazards.is_empty());
}
#[test]
fn heal_commitment_spends_even_if_ally_is_healed_or_dies() {
    for dies in [false, true] {
        let mut s = fixture();
        s.combat.actors[0].view.hp = 1.;
        assert!(s.combat.groove_action(2));
        s.combat.actors[0].view.hp = if dies {
            0.
        } else {
            s.combat.actors[0].view.max_hp
        };
        s.combat.actors[2].view.state_age = CAST_DURATION;
        s.combat.action(2);
        assert_eq!(s.combat.actors[2].view.meter, 2.);
        assert_eq!(
            s.combat.actors[0].view.hp,
            if dies {
                0.
            } else {
                s.combat.actors[0].view.max_hp
            }
        );
        assert!(!s
            .drain_events()
            .iter()
            .any(|e| matches!(e, Event::Healed { .. })));
    }
}
#[test]
fn committed_heal_reports_only_the_remaining_hp_restored() {
    let mut s = fixture();
    s.combat.actors[0].view.hp = 1.;
    assert!(s.combat.groove_action(2));
    s.combat.actors[0].view.hp = s.combat.actors[0].view.max_hp - 7.;
    s.combat.actors[2].view.state_age = CAST_DURATION;
    s.combat.action(2);
    let heals: Vec<_> = s
        .drain_events()
        .into_iter()
        .filter_map(|e| match e {
            Event::Healed {
                target,
                amount,
                source,
            } => {
                assert_eq!(source, HealSource::HealingSpring);
                Some((target, amount))
            }
            _ => None,
        })
        .collect();
    assert_eq!(heals, vec![(s.combat.actors[0].view.id, 7.)]);
    assert_eq!(s.combat.actors[0].view.hp, s.combat.actors[0].view.max_hp);
}
#[test]
fn runa_chains_heal_then_bubble_after_bounded_hold_then_heal() {
    let mut s = fixture();
    s.combat.actors[0].view.hp = s.combat.actors[0].view.max_hp * 0.4;
    for skill in [Skill::HealingSpring, Skill::BubblePop, Skill::HealingSpring] {
        if skill == Skill::BubblePop {
            assert!(!s.combat.groove_action(2));
            for _ in 0..MAGE_AOE_HOLD_STEPS {
                s.combat.groove_timers();
            }
        }
        assert!(s.combat.groove_action(2));
        assert!(s
            .drain_events()
            .iter()
            .any(|e| matches!(e, Event::GrooveSpent { skill: k, bars: 1., .. } if *k == skill)));
        assert!(s.combat.actors[2].view.special_casting);
        s.combat.actors[2].view.state_age = CAST_DURATION;
        s.combat.action(2);
        s.combat.timers();
        s.combat.actors[2].target = Some(s.combat.actors[4].view.id);
        if skill == Skill::BubblePop {
            s.combat.actors[0].view.hp = 1.;
        }
    }
    let passive = MAGE_AOE_HOLD_STEPS as f32 * SIM_DT / SUPER_FILL_SECONDS;
    assert!((s.combat.actors[2].view.meter - passive).abs() < 0.00001);
    assert!(!s.combat.groove_action(2));
}
