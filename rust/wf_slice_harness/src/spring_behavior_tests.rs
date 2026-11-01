use crate::{tuning::*, *};
#[test]
fn no_pool_or_camp_generated_in_real_combat_and_steps_remain_allocation_free() {
    for spotlight in [false, true] {
        let mut s = Sim::new(SimConfig {
            spotlight: SpotlightConfig {
                enabled: spotlight,
                auto_release: true,
                ..SpotlightConfig::DEFAULT
            },
            ..Default::default()
        });
        s.drain_events();
        for _ in 0..5400 {
            crate::tests::ALLOCATIONS.with(|a| a.set(Some(0)));
            s.step();
            assert_eq!(crate::tests::ALLOCATIONS.with(|a| a.replace(None)), Some(0));
            assert!(!s
                .combat
                .hazards
                .iter()
                .any(|h| h.view.kind == HazardKind::HealingSpring));
            s.combat.events.clear();
        }
    }
}
#[test]
fn heal_never_overrides_committed_basic_or_cast() {
    let mut s = Sim::composition_trial(SimConfig::default(), &[Archetype::Orc]);
    s.combat.actors[0].view.hp = 1.;
    s.combat.actors[2].view.meter = 3.;
    s.combat
        .start_action(2, Some(s.combat.actors[4].view.id), false, false);
    let epoch = s.combat.actors[2].action_epoch;
    assert!(!s.combat.groove_action(2));
    s.combat.start_extra(2, s.combat.actors[0].view.id);
    assert_eq!(s.combat.actors[2].action_epoch, epoch);
    assert_eq!(s.combat.actors[2].view.meter, 3.);
    assert_eq!(s.combat.actors[2].view.state, ActorState::Basic);
    s.combat.actors[2].view.state_age = BASIC_DURATION;
    s.combat.actors[2].action_done = true;
    assert!(s.combat.groove_action(2));
}
