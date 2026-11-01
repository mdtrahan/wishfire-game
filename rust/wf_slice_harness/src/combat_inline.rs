use crate::{api::*, Sim};
#[cfg(test)]
mod float_event_tests {
    use super::*;

    #[test]
    fn hit_flags_full_and_partial_ward_absorption_without_changing_amounts() {
        let mut sim = Sim::new(SimConfig::default());
        sim.combat.actors[0].view.ward = 10.;
        let hp = sim.combat.actors[0].view.hp;
        for (amount, blocked) in [(4., true), (12., true), (3., false)] {
            sim.combat
                .damage(900, 0, amount, false, false, Element::Physical);
            assert!(matches!(sim.drain_events().last(), Some(Event::Hit {
                amount: actual, crit: false, blocked: actual_blocked, ..
            }) if *actual == amount && *actual_blocked == blocked));
        }
        assert_eq!(sim.combat.actors[0].view.ward, 0.);
        assert_eq!(sim.combat.actors[0].view.hp, hp - 9.);
    }
}
