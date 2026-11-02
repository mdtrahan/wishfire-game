use crate::{api::*, tuning::*, Sim};
#[cfg(test)]
mod tests {
    use super::*;
    use crate::{rng::Rng, tests::ALLOCATIONS};
    fn fixture(kind: Archetype) -> Sim {
        let mut s = Sim::composition_trial(
            SimConfig::default(),
            &[kind, Archetype::HighOrc, Archetype::Gobloc],
        );
        s.combat.hazards.clear();
        for (i, a) in s.combat.actors.iter_mut().enumerate() {
            a.view.pos = if i < 4 {
                Vec2::new(150. + i as f32 * 50., 1400.)
            } else {
                Vec2::new(600. + (i - 4) as f32 * 50., 600.)
            };
            a.destination = a.view.pos;
            a.state(ActorState::Idle, 0., 0.);
            a.formed_age = 10.;
            a.action_done = true;
            a.basic_cd = 100.;
            a.ai_cd = 100.;
        }
        s.combat.events.clear();
        s
    }
    #[test]
    fn marid_inherits_continuous_aura_range_damage_and_lifecycle_without_kaja_passive() {
        for stage in [1, 3, 7] {
            let mut s = Sim::composition_trial(SimConfig::default(), &[]);
            assert!(!s
                .combat
                .hazards
                .iter()
                .any(|h| h.view.kind == HazardKind::KajaAura));
            s.stage.wave = stage;
            s.stage.tier = ((stage - 1) % 3 + 1) as u8;
            let pos = Vec2::new(480., 1100.);
            let owner = s.spawn_actor(Archetype::Marid, pos);
            let source = s.combat.actor_index(owner).unwrap();
            let aura = s
                .combat
                .hazards
                .iter()
                .find(|h| h.view.owner == owner)
                .unwrap();
            assert_eq!(aura.view.kind, HazardKind::KajaAura);
            assert_eq!(aura.view.team, Team::Enemy);
            assert_eq!(
                aura.view.shape,
                Shape::Circle {
                    radius: AURA_RADIUS
                }
            );
            for a in &mut s.combat.actors[..4] {
                a.view.pos = pos + Vec2::new(300., 0.);
                a.stats.def = 1000.; // The transferred continuous damage ignores armor.
                a.stats.res = a.stats.def;
                a.view.ward = 0.;
            }
            let edge = AURA_RADIUS + s.combat.actors[0].view.radius;
            s.combat.actors[0].view.pos = pos + Vec2::new(edge, 0.);
            s.combat.actors[1].view.pos = pos + Vec2::new(edge + 1., 0.);
            let hp = s.combat.actors[0].view.hp;
            let outside_hp = s.combat.actors[1].view.hp;
            let marid_hp = s.combat.actors[source].view.hp;
            for _ in 0..30 {
                s.combat.update_hazards();
                s.resolve_hazards();
            }
            assert!((hp - s.combat.actors[0].view.hp - AURA_DPS).abs() < 0.001);
            assert_eq!(s.combat.actors[1].view.hp, outside_hp);
            assert_eq!(s.combat.actors[source].view.hp, marid_hp);
            assert!(s.drain_events().iter().any(|e| matches!(e,
                Event::Hit { source: id, target, element: Element::Nature, .. }
                    if *id == owner && *target == s.combat.actors[0].view.id)));
            s.combat.actors[source].view.pos.x += 20.;
            s.combat.update_hazards();
            assert_eq!(
                s.combat
                    .hazards
                    .iter()
                    .find(|h| h.view.owner == owner)
                    .unwrap()
                    .view
                    .origin,
                s.combat.actors[source].view.pos
            );
            s.combat.actors[source].begin_spawn();
            let hp = s.combat.actors[0].view.hp;
            s.combat.update_hazards();
            s.resolve_hazards();
            assert_eq!(s.combat.actors[0].view.hp, hp);
            s.combat.actors[source].view.hp = 0.;
            s.combat.update_hazards();
            s.resolve_hazards();
            assert_eq!(s.combat.actors[0].view.hp, hp);
            assert_eq!(
                s.combat
                    .hazards
                    .iter()
                    .find(|h| h.view.owner == owner)
                    .unwrap()
                    .view
                    .phase,
                HazardPhase::Resolved
            );
        }
    }
    fn finish(s: &mut Sim) {
        for _ in 0..24 {
            s.combat.timers();
            s.combat.actions();
        }
    }
    #[test]
    fn marid_heals_lowest_fraction_arena_wide_preferring_other_ally_over_self() {
        let mut s = fixture(Archetype::Marid);
        s.combat.actors[4].view.hp *= 0.05;
        s.combat.actors[5].view.pos = Vec2::new(100., 100.);
        s.combat.actors[5].view.hp *= 0.2;
        s.combat.actors[6].view.hp *= 0.4;
        assert_eq!(s.combat.enemy_heal_target(4), Some(5));
        let before = s.combat.actors[5].view.hp;
        let mut roll = s.combat.actors[4].ai_rng;
        let expected = roll.range(MARID_HEAL_MIN, MARID_HEAL_MAX);
        s.enemy_ai();
        assert!(s.combat.actors[4].action_heal);
        let healer = s.combat.actors[4].view.id;
        let target = s.combat.actors[5].view.id;
        assert!(s.drain_events().iter().any(|e| matches!(e, Event::EnemyHealCast { healer: h, target: t, seconds } if *h == healer && *t == target && *seconds == ENEMY_HEAL_CAST)));
        for _ in 0..23 {
            s.combat.timers();
            s.combat.actions();
        }
        assert_eq!(s.combat.actors[5].view.hp, before);
        s.combat.timers();
        s.combat.actions();
        assert!(
            (s.combat.actors[5].view.hp - before - s.combat.actors[5].view.max_hp * expected).abs()
                < 0.001
        );
        assert!(s.drain_events().iter().any(|e| matches!(e, Event::EnemyHealed { healer: h, target: t, .. } if *h == healer && *t == target)));
        assert!(!s.combat.try_enemy_heal(4));
        assert!(
            (s.combat.actors[4].extra_cd - (MARID_HEAL_INTERVAL - ENEMY_HEAL_CAST)).abs() < 0.001
        );
        s.combat.actors[5].view.hp = s.combat.actors[5].view.max_hp;
        s.combat.actors[6].view.hp = s.combat.actors[6].view.max_hp;
        assert_eq!(s.combat.enemy_heal_target(4), Some(4));
    }
    #[test]
    fn marid_seeded_heals_use_large_ally_and_small_boss_ranges() {
        for boss in [false, true] {
            let (min, max) = if boss {
                (MARID_BOSS_HEAL_MIN, MARID_BOSS_HEAL_MAX)
            } else {
                (MARID_HEAL_MIN, MARID_HEAL_MAX)
            };
            let mut smallest = f32::INFINITY;
            let mut largest = 0.0f32;
            for seed in 0..64 {
                let mut s = fixture(Archetype::Marid);
                let t = if boss {
                    let id = s.spawn_actor(Archetype::Boss, Vec2::new(480., ARENA_MAX.y - 100.));
                    s.combat.actor_index(id).unwrap()
                } else {
                    5
                };
                s.combat.actors[t].view.hp = s.combat.actors[t].view.max_hp * 0.05;
                s.combat.actors[4].ai_rng = Rng(seed);
                let mut roll = s.combat.actors[4].ai_rng;
                let expected = roll.range(min, max);
                assert!(s.combat.try_enemy_heal(4));
                assert_eq!(s.combat.actors[4].extra_cd, 10.);
                let before = s.combat.actors[t].view.hp;
                finish(&mut s);
                let fraction =
                    (s.combat.actors[t].view.hp - before) / s.combat.actors[t].view.max_hp;
                assert!((fraction - expected).abs() < 0.00001);
                assert!(fraction >= min - 0.00001 && fraction <= max + 0.00001);
                smallest = smallest.min(fraction);
                largest = largest.max(fraction);
            }
            assert!(smallest < min + (max - min) * 0.25 && largest > min + (max - min) * 0.75);
        }
    }
    #[test]
    fn marid_leaves_a_corner_instead_of_stalling_or_jittering() {
        let mut s = fixture(Archetype::Marid);
        let p = crate::math::floor_point(ARENA_MAX, BODY_RADIUS);
        s.combat.actors[4].view.pos = p;
        for h in &mut s.combat.actors[..4] {
            h.view.pos = p - Vec2::new(100., 100.);
        }
        for _ in 0..19 {
            s.combat.timers();
            s.enemy_ai();
        }
        assert!(
            s.combat.actors[4].view.pos.distance(p) > 20.,
            "start {p:?}, end {:?}, goal {:?}, hold {}",
            s.combat.actors[4].view.pos,
            s.combat.actors[4].destination,
            s.combat.actors[4].goal_cd
        );
        assert_eq!(
            crate::math::floor_point(s.combat.actors[4].view.pos, BODY_RADIUS),
            s.combat.actors[4].view.pos
        );
    }
    #[test]
    fn uninterrupted_heal_releases_in_real_step_order_before_ai_can_replan() {
        for kind in [Archetype::Marid, Archetype::BossBomber] {
            let mut s = fixture(kind);
            s.combat.actors[5].view.hp *= 0.2;
            s.combat.actors[4].state(ActorState::Walk, 0., 0.);
            s.combat.actors[4].velocity = Vec2::new(100., 0.);
            assert!(s.combat.try_enemy_heal(4));
            assert_eq!(s.combat.actors[4].velocity, Vec2::default());
            let pos = s.combat.actors[4].view.pos;
            let target = s.combat.actors[5].view.id;
            for _ in 0..23 {
                s.step();
                assert_eq!(s.combat.actors[4].view.pos, pos);
                assert_eq!(s.combat.actors[4].target, Some(target));
                assert!(!s
                    .drain_events()
                    .iter()
                    .any(|e| matches!(e, Event::EnemyHealed { .. })));
            }
            s.step();
            assert!(s.drain_events().iter().any(|e| matches!(e, Event::EnemyHealed { healer, target: t, amount } if *healer == s.combat.actors[4].view.id && *t == target && *amount > 0.)));
            assert!(!s.combat.actors[4].action_heal);
        }
    }
    #[test]
    fn dead_heal_recipient_retargets_only_on_release_to_another_hurt_ally() {
        for kind in [Archetype::Marid, Archetype::BossBomber] {
            let mut s = fixture(kind);
            s.combat.actors[5].view.hp *= 0.1;
            s.combat.actors[6].view.hp *= 0.4;
            assert!(s.combat.try_enemy_heal(4));
            let original = s.combat.actors[5].view.id;
            s.combat.actors[5].view.hp = 0.;
            for _ in 0..23 {
                s.combat.timers();
                s.enemy_ai();
                s.combat.actions();
                assert_eq!(s.combat.actors[4].target, Some(original));
            }
            s.combat.timers();
            s.enemy_ai();
            s.combat.actions();
            assert_eq!(s.combat.actors[4].target, Some(s.combat.actors[6].view.id));
            assert!(s.drain_events().iter().any(
                |e| matches!(e, Event::EnemyHealed { target, .. } if *target == s.combat.actors[6].view.id)
            ));
        }
    }
    #[test]
    fn heals_never_overheal_and_dead_recipient_does_not_cancel_committed_boss_cast() {
        for kind in [Archetype::Marid, Archetype::BossBomber] {
            let mut s = fixture(kind);
            s.combat.actors[5].view.hp -= 1.;
            assert!(s.combat.try_enemy_heal(4));
            finish(&mut s);
            assert_eq!(s.combat.actors[5].view.hp, s.combat.actors[5].view.max_hp);
            let mut s = fixture(kind);
            s.combat.actors[5].view.hp *= 0.2;
            assert!(s.combat.try_enemy_heal(4));
            s.combat.actors[5].view.hp = 0.;
            finish(&mut s);
            assert!(s.combat.actors[4].action_done);
            assert!(!s
                .drain_events()
                .iter()
                .any(|e| matches!(e, Event::EnemyHealed { .. })));
        }
    }
    #[test]
    fn chimera_only_heals_minions_and_uses_its_own_fraction_and_interval() {
        let mut s = fixture(Archetype::BossBomber);
        s.combat.actors[4].view.hp *= 0.1;
        assert_eq!(s.combat.enemy_heal_target(4), None);
        s.combat.actors[5].view.hp *= 0.1;
        let hp = s.combat.actors[5].view.hp;
        assert!(s.combat.try_enemy_heal(4));
        assert_eq!(s.combat.actors[4].extra_cd, CHIMERA_HEAL_INTERVAL);
        finish(&mut s);
        assert!(
            (s.combat.actors[5].view.hp
                - hp
                - s.combat.actors[5].view.max_hp * CHIMERA_HEAL_FRACTION)
                .abs()
                < 0.001
        );
        assert_eq!(
            basic_interval_scale(Archetype::BossBomber),
            1. / CHIMERA_ATTACK_RATE
        );
    }
    #[test]
    fn taunt_changes_future_enemy_aggro_without_redirecting_a_heal() {
        for kind in [Archetype::Marid, Archetype::BossBomber] {
            let mut s = fixture(kind);
            s.combat.actors[0].view.pos = s.combat.actors[4].view.pos + Vec2::new(-100., 0.);
            s.combat.actors[5].view.hp *= 0.2;
            let target = s.combat.actors[5].view.id;
            let hp = s.combat.actors[5].view.hp;
            assert!(s.combat.try_enemy_heal(4));
            s.combat.taunt(0);
            assert_eq!(s.combat.actors[4].target, Some(target));
            finish(&mut s);
            assert!(s.combat.actors[5].view.hp > hp);
        }
    }
    #[test]
    fn bubble_and_encase_cancel_heal_and_refund_cooldown() {
        for bubble in [false, true] {
            let mut s = fixture(Archetype::Marid);
            s.combat.actors[5].view.hp *= 0.1;
            let hp = s.combat.actors[5].view.hp;
            assert!(s.combat.try_enemy_heal(4));
            if bubble {
                s.combat.bubble_interrupt(4);
            } else {
                s.combat.encase(4);
            }
            assert_eq!(s.combat.actors[4].extra_cd, 0.);
            assert!(!s.combat.actors[4].action_heal);
            finish(&mut s);
            assert_eq!(s.combat.actors[5].view.hp, hp);
            assert!(!s
                .drain_events()
                .iter()
                .any(|e| matches!(e, Event::EnemyHealed { .. })));
        }
    }
    #[test]
    fn boss_push_resists_or_cancels_heal_using_existing_rule() {
        for resist in [false, true] {
            let mut s = fixture(Archetype::BossBomber);
            s.combat.actors[5].view.hp *= 0.1;
            let hp = s.combat.actors[5].view.hp;
            assert!(s.combat.try_enemy_heal(4));
            s.combat.actors[4].push_rng = (0..100)
                .map(Rng)
                .find(|r| {
                    let mut r = *r;
                    r.chance(0.5) == resist
                })
                .unwrap();
            s.combat.hero_push(4, Vec2::new(1., 0.), 30.);
            finish(&mut s);
            assert_eq!(s.combat.actors[5].view.hp > hp, resist);
            if !resist {
                assert_eq!(s.combat.actors[4].extra_cd, 0.);
            }
        }
    }
    #[test]
    fn marid_retreats_from_close_heroes_including_near_wall() {
        for x in [450., 830.] {
            let mut s = fixture(Archetype::Marid);
            s.combat.actors[4].view.pos = Vec2::new(x, 450.);
            for h in &mut s.combat.actors[..4] {
                h.view.pos = Vec2::new(x - 70., 450.);
            }
            let before = s.combat.actors[4]
                .view
                .pos
                .distance(s.combat.actors[0].view.pos);
            s.enemy_ai();
            // Departure holds its position until the18-step fade is complete.
            for _ in 0..18 {
                s.combat.timers();
            }
            assert!(
                s.combat.actors[4]
                    .view
                    .pos
                    .distance(s.combat.actors[0].view.pos)
                    > before
            );
            assert_eq!(s.combat.actors[4].view.state, ActorState::Idle);
            assert!(
                s.combat.actors[4].view.pos.x
                    <= s.combat.cfg.arena_size.x - s.combat.actors[4].view.radius
            );
        }
    }
    #[test]
    fn marid_keeps_medium_hp_and_slowest_hero_reference_speed() {
        let marid = stats(Archetype::Marid);
        assert!(marid.hp > stats(Archetype::Orc).hp && marid.hp < stats(Archetype::HighOrc).hp);
        assert_eq!(marid.speed, stats(Archetype::Runa).speed);
        assert_eq!(marid.speed, stats(Archetype::Kaja).speed);
        assert!(HERO_STATS.iter().all(|hero| hero.speed >= marid.speed));
        assert_eq!(marid.atk, MARID_BOLT_DAMAGE);
    }

    #[test]
    fn heroes_prioritize_reachable_perceived_healer_and_ignore_materializing_one() {
        for hidden in [false, true] {
            let mut s = fixture(Archetype::Marid);
            s.combat.actors[4].view.pos = Vec2::new(440., 800.);
            s.combat.actors[5].view.pos = Vec2::new(350., 800.);
            s.combat.actors[6].view.pos = Vec2::new(700., 800.);
            if hidden {
                s.combat.actors[4].begin_spawn();
            }
            for a in &mut s.combat.actors[..4] {
                a.view.pos = Vec2::new(300., 800.);
                a.ai_cd = 0.;
            }
            s.hero_ai();
            for i in [1, 2, 3] {
                assert_eq!(
                    s.combat.actors[i].target,
                    Some(s.combat.actors[if hidden { 5 } else { 4 }].view.id),
                    "hero {i}"
                );
            }
        }
    }
    #[test]
    fn marid_cap_defers_marker_without_losing_unit() {
        let mut s =
            Sim::composition_trial(SimConfig::default(), &[Archetype::Marid, Archetype::Marid]);
        let id = s.hazard(
            HazardKind::SpawnMarker,
            0,
            None,
            Vec2::new(900., 450.),
            Vec2::new(1., 0.),
        );
        let h = s.combat.hazards.last_mut().unwrap();
        h.spawn_kind = Some(Archetype::Marid);
        h.phase_age = h.duration;
        s.resolve_hazards();
        assert_eq!(
            s.combat
                .actors
                .iter()
                .filter(|a| a.alive() && a.view.archetype == Archetype::Marid)
                .count(),
            2
        );
        assert_ne!(
            s.combat
                .hazards
                .iter()
                .find(|h| h.view.id == id)
                .unwrap()
                .view
                .phase,
            HazardPhase::Resolved
        );
        s.combat.actors[4].view.hp = 0.;
        s.resolve_hazards();
        assert_eq!(
            s.combat
                .actors
                .iter()
                .filter(|a| a.alive() && a.view.archetype == Archetype::Marid)
                .count(),
            2
        );
        assert_eq!(
            s.combat
                .hazards
                .iter()
                .find(|h| h.view.id == id)
                .unwrap()
                .view
                .phase,
            HazardPhase::Resolved
        );
    }
    #[test]
    fn heal_cast_and_cooldown_freeze_during_spotlight_and_are_allocation_free() {
        let mut s = fixture(Archetype::Marid);
        s.combat.actors[5].view.hp *= 0.1;
        s.combat.actors[5].view.pos = Vec2::new(150., 150.);
        assert!(s.combat.try_enemy_heal(4));
        s.set_spotlight(SpotlightConfig {
            charge: 1.2,
            global_gap: 0.,
            hero_gap: 0.,
            fairness: 0.,
            ..SpotlightConfig::DEFAULT
        });
        // Keep the healer/recipient ordinary; qualify with three enemies in Pulse's area.
        for dx in [30., 60.] {
            s.spawn_actor(
                Archetype::Orc,
                s.combat.actors[5].view.pos + Vec2::new(dx, 0.),
            );
        }
        s.combat.start_arcane_pulse(3, s.combat.actors[5].view.id);
        s.combat.select_spotlight();
        assert!(s.combat.spotlight.active.is_some());
        let before = (
            s.combat.actors[4].view.state_age,
            s.combat.actors[4].extra_cd,
            s.combat.actors[5].view.hp,
        );
        for _ in 0..20 {
            s.step();
        }
        assert_eq!(
            before,
            (
                s.combat.actors[4].view.state_age,
                s.combat.actors[4].extra_cd,
                s.combat.actors[5].view.hp
            )
        );
        // Performing and Tail freeze the healer just as Charge does; the featured hit
        // may change its recipient's HP, so audit the healer's own clock fields here.
        while s.combat.spotlight.active.is_some() {
            s.step();
            assert_eq!(
                (before.0, before.1),
                (
                    s.combat.actors[4].view.state_age,
                    s.combat.actors[4].extra_cd
                )
            );
        }
        let start = ALLOCATIONS.with(|a| a.get());
        for _ in 0..400 {
            s.combat.events.clear();
            s.enemy_ai();
            s.combat.timers();
            s.combat.actions();
        }
        assert_eq!(start, ALLOCATIONS.with(|a| a.get()));
        let mut a = Sim::new(SimConfig::default());
        let mut b = Sim::new(SimConfig::default());
        for _ in 0..6000 {
            a.step();
            b.step();
            assert_eq!(a.state_hash(), b.state_hash());
        }
    }
}
