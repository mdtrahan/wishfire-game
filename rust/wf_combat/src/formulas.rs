//! Shared combat formula shapes; presentation mirrors live in combatFormulas.mjs.
pub fn mitigation_multiplier(defense: f64) -> f64 {
    100. / (100. + defense.max(0.))
}

/// Haste is derived from existing positive rate inputs; zero preserves the base.
/// Negative haste above -100 represents an existing rate below one (slowdown).
pub fn cooldown_seconds(base: f64, haste: f64) -> f64 {
    base * 100. / (100. + haste)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{tuning::*, *};

    #[test]
    fn cooldown_stays_positive_at_extreme_haste() {
        for base in [SIM_DT, 5., 30.] {
            for haste in [0., 100., 1e12, f32::MAX] {
                let seconds = cooldown_seconds(base as f64, haste as f64) as f32;
                assert!(seconds.is_finite() && seconds > 0. && seconds <= base, "{base}, {haste}: {seconds}");
            }
        }
        assert_eq!(cooldown_seconds(10., 100.), 5.);
        assert_eq!(cooldown_seconds(10., -50.), 20.);
        let mut sim = Sim::new(SimConfig::default());
        sim.spawn_actor(Archetype::Boss, ARENA_CENTRE, stats(Archetype::Boss));
        sim.modifiers.cooldown_haste = f32::MAX;
        sim.modifiers.recharge_haste = f32::MAX;
        assert!(sim.boss_time_scale() > 0.);
        assert!(sim.boss_recharge_duration(0) > 0.);
    }

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
