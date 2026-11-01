use crate::math::*;
use crate::{api::*, tuning::*, Sim};
#[cfg(test)]
mod tests {
    use super::*;
    use crate::rng::Rng;
    fn fixture(seed: u64) -> Sim {
        let mut s = Sim::composition_trial(
            SimConfig {
                seed,
                ..Default::default()
            },
            &[Archetype::Marid],
        );
        s.combat.hazards.clear();
        for (i, a) in s.combat.actors.iter_mut().enumerate() {
            a.view.pos = Vec2::new(220. + i as f32 * 60., 1200.);
            a.state(ActorState::Idle, 0., 0.);
            a.formed_age = 100.;
            a.action_done = true;
            a.basic_cd = 100.;
            a.extra_cd = 100.;
        }
        s.combat.actors[4].view.pos = Vec2::new(480., 700.);
        s.combat.events.clear();
        s
    }
    #[test]
    fn hops_are_exact_floor_contained_spaced_and_replay_deterministically() {
        let mut a = fixture(71);
        let mut b = fixture(71);
        let hop = a.combat.marid_hop_distance();
        assert!((hop - 153.6).abs() < 0.001);
        for _ in 0..600 {
            let before = a.combat.actors[4].view.pos;
            a.combat.timers();
            b.combat.timers();
            a.combat.marid_teleport(4);
            b.combat.marid_teleport(4);
            let pos = a.combat.actors[4].view.pos;
            let distance = before.distance(pos);
            assert!(distance < 0.001 || (distance - hop).abs() < 0.001);
            assert_eq!(pos, floor_point(pos, a.combat.actors[4].view.radius));
            for other in &a.combat.actors[..4] {
                let d = pos - other.view.pos;
                assert!(
                    Vec2::new(d.x, d.y / ACTOR_MOAT_DEPTH).length()
                        >= a.combat.actors[4].view.radius + other.view.radius + 2. * ACTOR_MOAT
                );
            }
            assert_eq!(a.state_hash(), b.state_hash());
            assert_eq!(a.combat.actors[4].view.state, ActorState::Idle);
        }
    }
    #[test]
    fn teleport_is_sixty_steps_switches_once_and_resumes_ai() {
        let mut s = fixture(3);
        let from = s.combat.actors[4].view.pos;
        s.combat.actors[4].basic_cd = 0.;
        s.combat.marid_teleport(4);
        let destination = s.combat.actors[4].destination;
        let mut switches = 0;
        for step in 1..=60 {
            let before = s.combat.actors[4].view.pos;
            s.combat.timers();
            switches += usize::from(before != s.combat.actors[4].view.pos);
            assert_eq!(s.combat.actors[4].view.teleport_steps, 60 - step);
            assert_eq!(
                s.combat.actors[4].view.pos,
                if step < 18 { from } else { destination }
            );
            if step < 60 {
                assert!(!s.combat.can_engage(0, 4));
                s.enemy_ai();
                s.combat.action(4);
                assert!(s.combat.projectiles.is_empty());
                assert_eq!(s.combat.actors[4].view.state, ActorState::Idle);
            }
        }
        assert_eq!(switches, 1);
        assert!(s.combat.can_engage(0, 4));
        s.combat.actors[0].view.pos = destination + Vec2::new(0., 200.);
        s.enemy_ai();
        assert_eq!(s.combat.actors[4].view.state, ActorState::Basic);
        s.combat.actors[4].view.state_age = s.combat.actors[4].view.impact_at;
        s.combat.action(4);
        assert_eq!(s.combat.projectiles.len(), 1);
    }
    #[test]
    fn teleport_drops_pursuit_ignores_damage_and_has_no_body() {
        let mut s = fixture(3);
        let id = s.combat.actors[4].view.id;
        s.combat.actors[0].target = Some(id);
        s.combat.actors[0].view.target = Some(id);
        s.combat.actors[0].view.ai_intent = AiIntent::MoveToRange;
        s.combat.actors[0].destination = s.combat.actors[4].view.pos;
        s.combat.marid_teleport(4);
        assert_eq!(s.combat.actors[0].target, None);
        assert_eq!(s.combat.actors[0].destination, s.combat.actors[0].view.pos);
        for steps in [60, 30, 9] {
            s.combat.actors[4].view.teleport_steps = steps;
            s.combat.actors[0].view.pos = s.combat.actors[4].view.pos;
            let before = s.combat.actors[4].view.pos;
            s.combat.separate_bodies();
            assert_eq!(s.combat.actors[4].view.pos, before);
            assert_eq!(s.combat.actors[0].view.pos, before);
            let hp = s.combat.actors[4].view.hp;
            s.combat.hero_push(4, Vec2::new(1., 0.), 70.);
            assert_eq!(s.combat.actors[4].view.pos, before);
            s.combat.damage(
                s.combat.actors[0].view.id,
                4,
                50.,
                false,
                false,
                Element::Physical,
            );
            assert_eq!(s.combat.actors[4].view.hp, hp);
        }
    }
    #[test]
    fn open_vector_weights_reduce_wall_hugging_against_uniform_valid_directions() {
        let mut s = fixture(1);
        s.combat.actors[4].view.pos = Vec2::new(150., 700.);
        let mut means = [0.; 2];
        for (index, weighted) in [false, true].into_iter().enumerate() {
            let choices = s.combat.marid_weights(4, weighted);
            let total: f32 = choices.iter().map(|c| c.1).sum();
            let mut rng = Rng(123);
            for _ in 0..4000 {
                let mut roll = rng.range(0., total);
                for (end, weight) in choices {
                    if weight <= 0. {
                        continue;
                    }
                    roll -= weight;
                    if roll <= 0. {
                        means[index] += (end.x - ARENA_MIN.x)
                            .min(ARENA_MAX.x - end.x)
                            .min(end.y - ARENA_MIN.y)
                            .min(ARENA_MAX.y - end.y);
                        break;
                    }
                }
            }
            means[index] /= 4000.;
        }
        assert!(
            means[1] > means[0] * 1.05,
            "uniform/weighted wall clearance {means:?}"
        );
        eprintln!("Marid mean wall clearance uniform/weighted: {means:?}");
    }
    #[test]
    fn hostile_marid_orbs_launch_on_cadence_and_hit_heroes() {
        let mut s = fixture(4);
        for h in &mut s.combat.actors[..4] {
            h.view.hp = 0.;
        }
        s.combat.actors[0].view.hp = 100.;
        s.combat.actors[0].stats.evade = 0.;
        s.combat.actors[0].view.pos = Vec2::new(480., 900.);
        s.combat.actors[4].relocate_left = 100000.;
        s.combat.actors[4].basic_cd = 0.;
        s.enemy_ai();
        assert_eq!(s.combat.actors[4].view.state, ActorState::Basic);
        assert_eq!(s.combat.actors[4].basic_cd, MARID_BOLT_INTERVAL);
        s.combat.actors[4].view.state_age = s.combat.actors[4].view.impact_at;
        s.combat.action(4);
        assert_eq!(s.combat.projectiles.len(), 1);
        let p = &s.combat.projectiles[0];
        assert_eq!(p.view.team, Team::Enemy);
        assert_eq!(p.view.kind, ProjectileKind::Orb);
        assert_eq!(p.damage, MARID_BOLT_DAMAGE);
        let hp = s.combat.actors[0].view.hp;
        for _ in 0..30 {
            s.combat.move_projectiles();
        }
        assert!(s.combat.actors[0].view.hp < hp);
    }
    #[test]
    fn hop_breaks_pending_mage_aim_and_existing_area_tracking() {
        let mut s = fixture(19);
        let target = s.combat.actors[4].view.id;
        let from = s.combat.actors[4].view.pos;
        s.combat.start_action(2, Some(target), false, false);
        let area = s.hazard(
            HazardKind::ArcanePulse,
            s.combat.actors[3].view.id,
            Some(target),
            from,
            Vec2::new(1., 0.),
        );
        s.combat.marid_teleport(4);
        let position = s.combat.actors[4].view.pos;
        s.combat.sync_hero_areas();
        let h = s.combat.hazards.iter().find(|h| h.view.id == area).unwrap();
        assert_eq!(h.target, None);
        assert_eq!(h.view.origin, from);
        s.combat.actors[2].view.state_age = s.combat.actors[2].view.impact_at;
        s.combat.action(2);
        assert_eq!(s.combat.projectiles[0].target, None);
        assert_eq!(s.combat.projectiles[0].end, from);
        assert_eq!(s.combat.actors[4].view.pos, position);
    }
    #[test]
    fn hop_does_not_invalidate_a_spatial_hit_when_target_returns_to_old_area() {
        let mut s = fixture(5);
        let target = s.combat.actors[4].view.id;
        let from = s.combat.actors[4].view.pos;
        s.combat.start_action(0, Some(target), false, false);
        s.combat.marid_teleport(4);
        for _ in 0..60 {
            s.combat.timers();
        }
        s.combat.actors[4].view.pos = from;
        let hp = s.combat.actors[4].view.hp;
        s.combat.actors[0].view.state_age = s.combat.actors[0].view.impact_at;
        s.combat.action(0);
        assert!(s.combat.actors[4].view.hp < hp);
    }
    #[test]
    fn pre_hop_melee_and_homing_shots_miss_but_new_locks_hit() {
        let mut s = fixture(9);
        let target = s.combat.actors[4].view.id;
        s.combat.actors[0].view.pos = Vec2::new(400., 700.);
        s.combat.start_action(0, Some(target), false, false);
        s.combat.projectile(
            2,
            Some(target),
            s.combat.actors[4].view.pos,
            false,
            20.,
            None,
        );
        s.combat.marid_teleport(4);
        assert!(s.combat.actors[0].action_target_teleported);
        assert_eq!(s.combat.projectiles[0].target, None);
        let hp = s.combat.actors[4].view.hp;
        s.combat.actors[0].view.state_age = s.combat.actors[0].view.impact_at;
        s.combat.action(0);
        for _ in 0..100 {
            s.combat.move_projectiles();
        }
        assert_eq!(s.combat.actors[4].view.hp, hp);
        for _ in 0..60 {
            s.combat.timers();
        }
        s.combat.actors[0].state(ActorState::Idle, 0., 0.);
        s.combat.start_action(0, Some(target), false, false);
        assert!(!s.combat.actors[0].action_target_teleported);
        s.combat.actors[0].view.state_age = s.combat.actors[0].view.impact_at;
        s.combat.action(0);
        assert!(s.combat.actors[4].view.hp < hp);
    }
}
