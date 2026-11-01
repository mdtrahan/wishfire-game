//! Atomic, actor-local permanent input replacement. Call immediately before a step.
use crate::{tuning::Stats, *};
#[derive(Clone, Copy, Debug)]
pub struct PermanentInputs {
    pub actor: u32,
    pub expected_revision: u64,
    pub revision: u64,
    pub stats: Stats,
    pub special_potency: f32,
    pub meter_rate: f32,
}
impl PermanentInputs {
    pub fn valid(&self) -> bool {
        let s = self.stats;
        [
            s.hp,
            s.atk,
            s.def,
            s.mag,
            s.res,
            s.speed,
            s.reach,
            s.interval,
            s.evade,
            s.special,
            self.special_potency,
            self.meter_rate,
        ]
        .iter()
        .all(|v| v.is_finite() && *v >= 0. && *v <= 1_000_000.)
            && s.hp > 0.
            && s.interval >= SIM_DT
            && s.evade <= 1.
            && self.special_potency > 0.
            && self.meter_rate > 0.
    }
}
impl Sim {
    pub fn replace_permanent_inputs(
        &mut self,
        batch: &[PermanentInputs],
    ) -> Result<(), &'static str> {
        let mut seen = std::collections::BTreeSet::new();
        for input in batch {
            let a = self
                .actors
                .iter()
                .find(|a| a.view.id == input.actor)
                .ok_or("unknown permanent-input actor")?;
            if a.view.team != Team::Hero || !input.valid() || !seen.insert(input.actor) {
                return Err("invalid permanent-input batch");
            }
            if a.permanent_revision != input.expected_revision
                || input.revision <= a.permanent_revision
            {
                return Err("permanent-input revision conflict");
            }
        }
        for input in batch {
            let a = self
                .actors
                .iter_mut()
                .find(|a| a.view.id == input.actor)
                .unwrap();
            let hp = if a.view.hp <= 0. || a.view.state == ActorState::Downed {
                0.
            } else {
                (a.view.hp + (input.stats.hp - a.view.max_hp).max(0.)).min(input.stats.hp)
            };
            a.stats = input.stats;
            a.view.max_hp = input.stats.hp;
            a.view.hp = hp;
            a.special_potency = input.special_potency;
            a.meter_rate = input.meter_rate;
            a.permanent_revision = input.revision;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn sim() -> Sim {
        let mut sim = Sim::new(SimConfig::default());
        sim.spawn_actor(
            Archetype::Fara,
            Vec2::new(480., 800.),
            crate::tuning::HERO_STATS[0],
        );
        sim.spawn_actor(
            Archetype::Hondo,
            Vec2::new(520., 800.),
            crate::tuning::HERO_STATS[1],
        );
        sim
    }
    fn input(s: &Sim, index: usize, hp: f32) -> PermanentInputs {
        let a = &s.actors[index];
        PermanentInputs {
            actor: a.view.id,
            expected_revision: a.permanent_revision,
            revision: a.permanent_revision + 1,
            stats: Stats { hp, ..a.stats },
            special_potency: 1.,
            meter_rate: 1.,
        }
    }
    #[test]
    fn hp_growth_shrink_and_downed_follow_r1_without_heal_events() {
        let mut s = sim();
        s.actors[0].view.hp = 100.;
        let change = input(&s, 0, 500.);
        s.replace_permanent_inputs(&[change]).unwrap();
        assert_eq!(s.actors[0].view.hp, 180.);
        let change = input(&s, 0, 120.);
        s.replace_permanent_inputs(&[change]).unwrap();
        assert_eq!(s.actors[0].view.hp, 120.);
        s.actors[0].view.hp = 0.;
        s.actors[0].view.state = ActorState::Downed;
        let change = input(&s, 0, 700.);
        s.drain_events();
        s.replace_permanent_inputs(&[change]).unwrap();
        assert_eq!(s.actors[0].view.hp, 0.);
        assert_eq!(s.actors[0].view.state, ActorState::Downed);
        assert!(s.drain_events().is_empty());
    }
    #[test]
    fn preserves_cast_cooldowns_meters_targets_ward_statuses_and_rng() {
        let mut s = sim();
        let target = s.actors[1].view.id;
        s.start_action(0, Some(target), false, false);
        let a = &mut s.actors[0];
        a.view.ward = 17.;
        a.view.meter = 0.7;
        a.basic_cd = 0.83;
        a.special_cd = 4.;
        a.extra_cd = 2.;
        a.poison_steps = 90;
        a.poison_tick_steps = 15;
        a.poison_damage = 3.;
        a.poison_source = Some(target);
        a.bubble_steps = 5;
        a.encase_steps = 7;
        a.view.elevate = Some(ElevateVariant::Sword);
        let rng = (s.spawn_rng.0, s.combat_rng.0);
        let before = s.actors[0].clone();
        let mut change = input(&s, 0, 600.);
        change.stats.atk *= 3.;
        change.meter_rate = 1. / 0.92;
        s.replace_permanent_inputs(&[change]).unwrap();
        assert_eq!(s.actors[0].committed_stats().atk, before.stats.atk);
        let mut after = s.actors[0].clone();
        after.stats = before.stats;
        after.view.hp = before.view.hp;
        after.view.max_hp = before.view.max_hp;
        after.permanent_revision = before.permanent_revision;
        after.meter_rate = before.meter_rate;
        assert_eq!(format!("{after:?}"), format!("{before:?}"));
        assert_eq!((s.spawn_rng.0, s.combat_rng.0), rng);
    }
    #[test]
    fn stale_duplicate_invalid_and_mixed_batches_are_atomic() {
        let mut s = sim();
        let first = input(&s, 0, 600.);
        s.replace_permanent_inputs(&[first]).unwrap();
        let hash = s.state_hash();
        assert!(s.replace_permanent_inputs(&[first]).is_err());
        assert_eq!(s.state_hash(), hash);
        let valid = input(&s, 1, 900.);
        assert!(s.replace_permanent_inputs(&[valid, first]).is_err());
        assert_eq!(s.state_hash(), hash);
        assert!(s.replace_permanent_inputs(&[valid, valid]).is_err());
        assert_eq!(s.state_hash(), hash);
        let mut invalid = valid;
        invalid.stats.atk = f32::NAN;
        assert!(s.replace_permanent_inputs(&[invalid]).is_err());
        assert_eq!(s.state_hash(), hash);
        let mut stale = first;
        stale.revision = 0;
        assert!(s.replace_permanent_inputs(&[stale]).is_err());
    }
    #[test]
    fn committed_attack_uses_old_power_once_then_next_attack_uses_revision() {
        let mut s = sim();
        s.actors[0].state(ActorState::Idle, 0., 0.);
        s.actors[1].view.team = Team::Enemy;
        s.actors[1].view.hp = 10000.;
        s.actors[1].view.max_hp = 10000.;
        s.actors[1].stats.evade = 0.;
        let target = s.actors[1].view.id;
        s.start_action(0, Some(target), false, false);
        let mut change = input(&s, 0, 420.);
        change.stats.atk *= 100.;
        s.replace_permanent_inputs(&[change]).unwrap();
        s.actors[0].view.state_age = s.actors[0].view.impact_at;
        s.action(0);
        let hp = s.actors[1].view.hp;
        assert!(hp < 10000. && hp > 9900.);
        s.action(0);
        assert_eq!(s.actors[1].view.hp, hp);
        s.actors[0].state(ActorState::Idle, 0., 0.);
        s.start_action(0, Some(target), false, false);
        s.actors[0].view.state_age = s.actors[0].view.impact_at;
        s.action(0);
        assert!(s.actors[1].view.hp < hp - 500.);
    }
    #[test]
    fn repeated_replacements_do_not_multiply_buffs_or_refill_clocks() {
        let mut s = sim();
        s.actors[0].view.meter = 0.3;
        s.actors[0].basic_cd = 0.4;
        for _ in 0..4 {
            let mut change = input(&s, 0, 420.);
            change.stats.atk = 100.;
            change.meter_rate = 1. / 0.92;
            s.replace_permanent_inputs(&[change]).unwrap();
        }
        assert_eq!(s.actors[0].stats.atk, 100.);
        assert_eq!(s.actors[0].view.meter, 0.3);
        assert_eq!(s.actors[0].basic_cd, 0.4);
        assert_eq!(s.actors[0].meter_rate, 1. / 0.92);
    }
    #[test]
    fn heal_commits_target_maximum_and_potency_without_double_heal() {
        let mut s = sim();
        s.spawn_actor(
            Archetype::Runa,
            Vec2::new(440., 800.),
            crate::tuning::HERO_STATS[2],
        );
        s.actors[0].view.hp = 30.;
        s.actors[2].state(ActorState::Idle, 0., 0.);
        let target = s.actors[0].view.id;
        s.start_extra(2, target);
        let grow = input(&s, 0, 840.);
        let mut potency = input(&s, 2, 260.);
        potency.special_potency = 1.1;
        s.replace_permanent_inputs(&[grow, potency]).unwrap();
        let before = s.actors[0].view.hp;
        s.actors[2].view.state_age = s.actors[2].view.impact_at;
        s.action(2);
        assert!(
            (s.actors[0].view.hp - before - 420. * crate::tuning::SUPER_HEAL_FRACTION).abs()
                < 0.001
        );
        let healed = s.actors[0].view.hp;
        s.action(2);
        assert_eq!(s.actors[0].view.hp, healed);
    }
    #[test]
    fn ward_cast_commits_maximum_and_revision_preserves_spotlight() {
        let mut s = sim();
        s.actors[0].state(ActorState::Idle, 0., 0.);
        let target = s.actors[1].view.id;
        s.start_extra(0, target);
        s.spotlight.active = Some(crate::spotlight::Spotlight::new(
            s.actors[0].view.id,
            Skill::Taunt,
            Some(target),
        ));
        s.spotlight.touched = true;
        let before = format!("{:?}", s.spotlight.active);
        let change = input(&s, 0, 840.);
        s.replace_permanent_inputs(&[change]).unwrap();
        assert_eq!(format!("{:?}", s.spotlight.active), before);
        s.actors[0].view.state_age = s.actors[0].view.impact_at;
        s.action(0);
        assert_eq!(
            s.actors[0].view.ward,
            420. * crate::tuning::WARCRY_WARD_FRACTION
        );
    }
    #[test]
    fn earned_cooldown_reward_changes_passive_refill_once() {
        let mut s = sim();
        let mut change = input(&s, 0, 420.);
        change.meter_rate = 1. / 0.92;
        s.replace_permanent_inputs(&[change]).unwrap();
        s.actors[0].view.meter = 0.;
        s.groove_timers();
        assert!(
            (s.actors[0].view.meter - SIM_DT / crate::tuning::RAGE_FILL_SECONDS / 0.92).abs()
                < 1e-9
        );
    }
    #[test]
    fn actor_revival_commits_recipient_maximum_for_growth_and_shrink() {
        for maximum in [840., 100.] {
            let mut s = sim();
            s.actors[0].view.hp = 0.;
            s.actors[0].state(ActorState::Downed, 0., 0.);
            s.actors[1].view.pos = s.actors[0].view.pos;
            s.actors[1].state(ActorState::Idle, 0., 0.);
            let target = s.actors[0].view.id;
            s.start_action(1, Some(target), false, true);
            assert_eq!(s.actors[1].action_target_max_hp, 420.);
            let change = input(&s, 0, maximum);
            s.replace_permanent_inputs(&[change]).unwrap();
            s.actors[1].view.state_age = s.actors[1].view.impact_at;
            s.action(1);
            let expected = (420. * crate::tuning::REVIVE_HP).min(maximum);
            assert_eq!(s.actors[0].view.hp, expected);
            let healed = s.drain_events().iter().filter_map(|e| match e {
                Event::Healed { amount, source: HealSource::Revive, .. } => Some(*amount), _ => None,
            }).sum::<f32>();
            assert_eq!(healed, expected);
            s.action(1);
            assert_eq!(s.actors[0].view.hp, expected);
        }
    }

    #[test]
    fn phoenix_commits_recipient_maximum_for_growth_and_shrink() {
        for maximum in [840., 100.] {
            let mut s = sim();
            s.actors[0].view.hp = 0.;
            s.actors[0].state(ActorState::Downed, 0., 0.);
            let hero = s.actors[0].view.id;
            s.phoenix_hold(hero);
            s.phoenix_step();
            assert_eq!(s.phoenix.target_max_hp, 420.);
            let change = input(&s, 0, maximum);
            s.replace_permanent_inputs(&[change]).unwrap();
            for _ in 1..(crate::tuning::REVIVE_CHANNEL * SIM_HZ as f32).round() as u32 {
                s.phoenix_hold(hero);
                s.phoenix_step();
            }
            let expected = (420. * crate::tuning::REVIVE_HP).min(maximum);
            assert_eq!(s.actors[0].view.hp, expected);
            assert!(s.drain_events().iter().any(|e| matches!(e,
                Event::Healed { amount, source: HealSource::Phoenix, .. } if *amount == expected)));
        }
    }

    // Adapted from the independent verifier's native/src/bin/elevate.rs.
    #[test]
    fn revision_keeps_committed_magic_while_new_elevate_applies_at_impact() {
        for pulse in [true, false] {
            let mut s = Sim::new(SimConfig::default());
            s.spawn_actor(Archetype::Kaja, Vec2::new(480., 800.), crate::tuning::HERO_STATS[3]);
            s.spawn_actor(Archetype::Gobloc, Vec2::new(480., 700.), crate::tuning::stats(Archetype::Gobloc));
            s.actors[0].state(ActorState::Idle, 0., 0.);
            s.actors[0].stats.mag = 31.;
            s.actors[0].view.elevate = None;
            let target = s.actors[1].view.id;
            if pulse { s.start_arcane_pulse(0, target); }
            else { s.start_action(0, Some(target), false, false); }
            let mut change = input(&s, 0, 560.);
            change.stats.mag = 310.;
            s.replace_permanent_inputs(&[change]).unwrap();
            s.actors[0].view.elevate = Some(ElevateVariant::Sword);
            let kind = if pulse { HazardKind::ArcanePulse } else { HazardKind::FazePool };
            if pulse {
                s.actors[0].view.state_age = s.actors[0].view.impact_at;
                s.action(0);
            } else { s.place_faze(0, s.actors[1].view.pos); }
            let potency = if pulse { crate::tuning::ARCANE_PULSE_POTENCY } else { crate::tuning::FAZE_POTENCY };
            let expected = 31. * potency * (1. + crate::tuning::ELEVATE_BONUS);
            let hazard = s.hazards.iter().find(|h| h.view.kind == kind).unwrap();
            assert!((hazard.base_damage - expected).abs() < 0.0001);
        }
    }

    #[test]
    fn unrevised_actions_read_live_elevate_at_impact_and_shadow_landing() {
        for gained in [true, false] {
            let mut s = Sim::new(SimConfig::default());
            s.spawn_actor(Archetype::Kaja, Vec2::new(480., 800.), crate::tuning::HERO_STATS[3]);
            s.spawn_actor(Archetype::Gobloc, Vec2::new(480., 700.), crate::tuning::stats(Archetype::Gobloc));
            s.actors[0].state(ActorState::Idle, 0., 0.);
            s.actors[0].view.elevate = if gained { None } else { Some(ElevateVariant::Sword) };
            let target = s.actors[1].view.id;
            s.start_arcane_pulse(0, target);
            let attack = s.actors[0].action_stats.mag;
            s.actors[0].view.elevate = if gained { Some(ElevateVariant::Sword) } else { None };
            s.actors[0].view.state_age = s.actors[0].view.impact_at;
            s.action(0);
            let multiplier = if gained { 1. + crate::tuning::ELEVATE_BONUS } else { 1. };
            assert!((s.hazards.iter().find(|h| h.view.kind == HazardKind::ArcanePulse).unwrap().base_damage
                - attack * crate::tuning::ARCANE_PULSE_POTENCY * multiplier).abs() < 0.0001);
        }
        let mut s = sim();
        s.actors[0].view.team = Team::Enemy;
        s.actors[1].state(ActorState::Idle, 0., 0.);
        s.actors[1].view.elevate = Some(ElevateVariant::Wings);
        let target = s.actors[0].view.id;
        s.start_action(1, Some(target), true, false);
        let landing = s.combo_landing(1, 0, s.actors[1].view.pos).unwrap();
        s.actors[1].view.elevate = None;
        let after = s.combo_landing(1, 0, s.actors[1].view.pos).unwrap();
        assert_ne!(after, landing);
    }

    #[test]
    fn lizardo_basic_uses_slice_magic_channel_with_unequal_offence() {
        let mut s = sim();
        s.spawn_actor(Archetype::Lizardo, Vec2::new(440., 800.), crate::tuning::stats(Archetype::Lizardo));
        s.actors[2].state(ActorState::Idle, 0., 0.);
        s.actors[2].stats.atk = 20.;
        s.actors[2].stats.mag = 100.;
        let target = s.actors[0].view.id;
        s.start_action(2, Some(target), false, false);
        s.actors[2].view.state_age = s.actors[2].view.impact_at;
        s.action(2);
        let projectile = s.projectiles.last().unwrap();
        assert_eq!(projectile.channel, DamageChannel::Magic);
        assert_eq!(projectile.damage, 100.);
    }

    #[test]
    fn physical_and_magic_hits_use_independent_incoming_defence() {
        let mut s = sim();
        s.actors[0].stats.def = 100.;
        s.actors[0].stats.res = 300.;
        let source = s.actors[1].view.id;
        assert_eq!(s.damage(source, 0, 80., false, true, Element::Physical), 40.);
        assert_eq!(s.damage(source, 0, 80., false, true, Element::Arcane), 20.);
        let mut change = input(&s, 0, 420.);
        change.stats.res = 700.;
        s.replace_permanent_inputs(&[change]).unwrap();
        assert_eq!(s.damage(source, 0, 80., false, true, Element::Arcane), 10.);
        assert_eq!(s.damage(source, 0, 80., false, true, Element::Physical), 40.);
    }

    #[test]
    fn mage_basic_commits_magic_then_next_basic_uses_replacement() {
        let mut s = sim();
        s.spawn_actor(Archetype::Runa, Vec2::new(440., 800.), crate::tuning::HERO_STATS[2]);
        s.actors[2].state(ActorState::Idle, 0., 0.);
        s.actors[2].stats.atk = 3.;
        s.actors[2].stats.mag = 71.;
        let target = s.actors[0].view.id;
        s.start_action(2, Some(target), false, false);
        let mut change = input(&s, 2, 520.);
        change.stats.mag = 710.;
        s.replace_permanent_inputs(&[change]).unwrap();
        s.actors[2].view.state_age = s.actors[2].view.impact_at;
        s.action(2);
        assert_eq!(s.projectiles.last().unwrap().damage, 71.);
        assert_eq!(s.projectiles.last().unwrap().channel, DamageChannel::Magic);
        s.actors[2].state(ActorState::Idle, 0., 0.);
        s.start_action(2, Some(target), false, false);
        s.actors[2].view.state_age = s.actors[2].view.impact_at;
        s.action(2);
        assert_eq!(s.projectiles.last().unwrap().damage, 710.);
    }

    #[test]
    fn shadow_landing_retains_committed_reach_through_revision() {
        let mut s = sim();
        s.actors[0].view.team = Team::Enemy;
        s.actors[1].state(ActorState::Idle, 0., 0.);
        let target = s.actors[0].view.id;
        s.start_action(1, Some(target), true, false);
        let landing = s.combo_landing(1, 0, s.actors[1].view.pos).unwrap();
        let mut change = input(&s, 1, 300.);
        change.stats.reach *= 10.;
        s.replace_permanent_inputs(&[change]).unwrap();
        assert_eq!(s.combo_landing(1, 0, s.actors[1].view.pos), Some(landing));
    }

    #[test]
    fn shadow_is_physical_even_with_arcane_impact_art() {
        let mut s = sim();
        s.actors[0].view.team = Team::Enemy;
        s.actors[0].stats.def = 100.;
        s.actors[0].stats.res = 900.;
        s.actors[0].stats.evade = 0.;
        s.actors[1].state(ActorState::Idle, 0., 0.);
        s.actors[1].stats.atk = 30.;
        s.actors[1].stats.mag = 300.;
        let target = s.actors[0].view.id;
        s.start_action(1, Some(target), true, false);
        s.actors[1].view.state_age = s.actors[1].view.impact_at;
        let before = s.actors[0].view.hp;
        s.action(1);
        let loss = before - s.actors[0].view.hp;
        assert!(loss == 36. || loss == 54.);
    }

}
