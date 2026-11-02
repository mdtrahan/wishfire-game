//! Shared combat formula shapes; presentation mirrors live in combatFormulas.mjs.
pub fn mitigation_multiplier(defense: f64) -> f64 {
    100. / (100. + defense.max(0.))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{tuning::*, *};

    #[test]
    fn positive_hits_at_extreme_defense_and_resistance_use_independent_channels() {
        let mut sim = Sim::new(SimConfig::default());
        let mut target = stats(Archetype::Fara);
        target.def = 1_000_000.;
        target.res = 2_000_000.;
        sim.spawn_actor(Archetype::Fara, ARENA_CENTRE, target);
        for (channel, defense) in [(DamageChannel::Physical, target.def), (DamageChannel::Magic, target.res)] {
            let damage = sim.damage_limited_channel(0, 0, 100., false, true, Element::Physical, None, true, channel);
            assert!(damage > 0., "{channel:?}: {damage}");
            assert_eq!(damage, 100. * mitigation_multiplier(defense as f64) as f32);
        }
        assert_eq!(mitigation_multiplier(0.), 1.);
        assert_eq!(mitigation_multiplier(100.), 0.5);
        assert!(mitigation_multiplier(f32::MAX as f64) > 0.);
    }
}
