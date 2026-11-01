use crate::{actors::Actor, tuning::*, *};
#[test]
fn grooves_start_empty_and_scene_reset_clears_their_state() {
    for (id, kind, groove) in [
        (1, Archetype::Fara, Groove::Rage),
        (2, Archetype::Hondo, Groove::Combo),
        (3, Archetype::Runa, Groove::Super),
        (4, Archetype::Kaja, Groove::Power),
    ] {
        let a = Actor::new(id, kind, Vec2::default(), crate::tuning::stats(kind), 7);
        assert_eq!(a.view.groove, Some(groove));
        assert_eq!(a.view.meter, GROOVE_START_METER);
        assert_eq!(
            [
                a.special_cd,
                a.extra_cd,
                a.pulse_cd,
                a.pound_cd,
                a.skill_lockout
            ],
            [0.; 5]
        );
    }
    for clear in [false, true] {
        let mut s = Sim::new(SimConfig::default());
        for a in &mut s.combat.actors {
            a.view.meter = 1.;
            a.view.groove_active = 3.;
            a.view.special_casting = true;
        }
        s.reset_stage(clear);
        for a in &s.combat.actors {
            assert_eq!(a.view.meter, 0.);
            assert_eq!(a.view.groove_active, 0.);
            assert!(!a.view.special_casting);
        }
    }
}
#[test]
fn removed_ward_and_faze_cannot_start() {
    let mut s = Sim::composition_trial(SimConfig::default(), &[Archetype::Orc]);
    let target = s.combat.actors[4].view.id;
    s.combat.start_action(0, Some(target), true, false);
    s.combat.start_extra(3, target);
    assert_ne!(s.combat.actors[0].view.state, ActorState::Cast);
    assert_ne!(s.combat.actors[3].view.state, ActorState::Cast);
    assert!(!s.drain_events().iter().any(|e| matches!(
        e,
        Event::SkillStarted {
            skill: Skill::CrimsonWard | Skill::Faze,
            ..
        }
    )));
}
