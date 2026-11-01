use crate::math::*;
use crate::{api::*, tuning::*, Sim};
#[cfg(test)]
mod tests {
    use super::*;
    use crate::tests::ALLOCATIONS;
    fn fixture() -> Sim {
        let mut s = Sim::composition_trial(
            SimConfig::default(),
            &[Archetype::BossBomber, Archetype::HighOrc],
        );
        s.combat.hazards.clear();
        s.combat.projectiles.clear();
        for (i, a) in s.combat.actors.iter_mut().enumerate() {
            a.view.pos = if i < 4 {
                Vec2::new(230. + i as f32 * 100., 1200.)
            } else {
                Vec2::new(480., 800. - (i - 4) as f32 * 200.)
            };
            a.destination = a.view.pos;
            a.state(ActorState::Idle, 0., 0.);
            a.action_done = true;
            a.formed_age = 10.;
            a.extra_cd = 100.;
            a.basic_cd = 100.;
            a.special_cd = 100.;
            a.summon_cd = 100.;
        }
        s.combat.events.clear();
        s
    }
    fn drops(s: &Sim) -> Vec<&crate::hazards::Hazard> {
        s.combat
            .hazards
            .iter()
            .filter(|h| {
                h.view.kind == HazardKind::LizardoDrop && h.view.phase != HazardPhase::Resolved
            })
            .collect()
    }
    #[test]
    fn bomb_fuses_radii_and_damage_preserve_targeted_timing_in_every_mode_and_phase() {
        for enraged in [false, true] {
            for mode in 0..3 {
                let mut s = fixture();
                s.combat.actors[4].view.enraged = enraged;
                let scale = if enraged { BOSS_PHASE.radius_scale } else { 1. };
                s.combat.spawn_chimera_barrage(4, 0, mode).unwrap();
                s.refresh_snapshot();
                let count = drops(&s).len();
                for (b, h) in drops(&s).into_iter().enumerate() {
                    let old_time = BOMB_TIME * scale + b as f32 * (0.4 / (count - 1) as f32);
                    let radius = if h.target.is_some() {
                        CHIMERA_TARGETED_BOMB_RADIUS
                    } else {
                        BOMB_RADIUS
                    } * scale;
                    assert_eq!(h.view.shape, Shape::Circle { radius });
                    assert_eq!(
                        s.snapshot()
                            .hazards
                            .iter()
                            .find(|v| v.id == h.view.id)
                            .unwrap()
                            .shape,
                        h.view.shape
                    );
                    assert!((h.damage - h.base_damage * old_time / BOMB_TIME).abs() < 0.001);
                    assert!(
                        (h.duration
                            - if h.target.is_some() {
                                old_time
                            } else {
                                BOMB_FLIGHT + 3.0
                            })
                        .abs()
                            < 0.00001
                    );
                }
                let ids: Vec<_> = drops(&s)
                    .into_iter()
                    .map(|h| (h.view.id, h.target.is_some(), h.duration))
                    .collect();
                let mut landing = None;
                for tick in 1..=230 {
                    s.combat.update_hazards();
                    s.combat.move_projectiles();
                    if landing.is_none() && s.combat.projectiles.iter().all(|p| p.view.height == 0.)
                    {
                        landing = Some(tick);
                    }
                    s.resolve_hazards();
                    for (id, targeted, duration) in &ids {
                        let resolved = s
                            .combat
                            .hazards
                            .iter()
                            .find(|h| h.view.id == *id)
                            .is_none_or(|h| h.view.phase == HazardPhase::Resolved);
                        if *targeted {
                            assert_eq!(resolved, tick >= (duration / SIM_DT).ceil() as usize);
                        } else {
                            assert_eq!(resolved, landing.is_some_and(|land| tick >= land + 90));
                        }
                    }
                }
                assert!(landing.is_some());
            }
        }
    }
    #[test]
    fn bomb_snapshot_circle_matches_actual_feet_damage_at_both_rims() {
        for targeted in [false, true] {
            for enraged in [false, true] {
                let mut s = fixture();
                s.combat.actors[4].view.enraged = enraged;
                s.combat.spawn_chimera_barrage(4, 0, 0).unwrap();
                let mut h = drops(&s)
                    .into_iter()
                    .find(|h| h.target.is_some() == targeted)
                    .unwrap()
                    .clone();
                let Shape::Circle { radius } = h.view.shape else {
                    panic!("bomb circle")
                };
                h.phase_age = h.duration;
                for (n, a) in s.combat.actors[..4].iter_mut().enumerate() {
                    a.view.pos = h.view.origin
                        + Vec2::new(if n < 2 { radius - 0.01 } else { radius + 0.01 }, 0.);
                    a.stats.evade = 0.;
                    a.view.ward = 0.;
                }
                let hp: Vec<_> = s.combat.actors[..4].iter().map(|a| a.view.hp).collect();
                s.combat.hazards.clear();
                s.combat.hazards.push(h);
                s.resolve_hazards();
                for (n, a) in s.combat.actors[..4].iter().enumerate() {
                    assert_eq!(
                        a.view.hp < hp[n],
                        n < 2,
                        "targeted={targeted} enraged={enraged} hero={n}"
                    );
                }
            }
        }
    }
    #[test]
    fn each_barrage_variant_keeps_its_authored_bombs_and_targets() {
        let mut s = fixture();
        for mode in 0..6 {
            s.combat.hazards.clear();
            s.combat.projectiles.clear();
            let a = &mut s.combat.actors[4];
            a.state(ActorState::Idle, 0., 0.);
            a.fortress = false;
            a.barrage_cd = 0.;
            a.view.energy = 1.;
            a.recharge_left = -SIM_DT;
            a.enemy_phase = 0;
            a.boss_attack = [
                crate::enmity::BossAttack::Targeted,
                crate::enmity::BossAttack::Scatter,
                crate::enmity::BossAttack::Fortress,
            ][(mode % 3) as usize];
            a.boss_retry_special = true;
            s.enemy_ai();
            let bombs = drops(&s);
            assert_eq!(bombs.len(), if mode % 3 == 2 { 8 } else { 4 });
            assert_eq!(
                bombs.iter().filter(|h| h.target.is_some()).count(),
                if mode % 3 == 0 { 3 } else { 0 }
            );
            assert_eq!(s.combat.actors[4].barrage_serial, mode + 1);
            assert_eq!(s.combat.boss_attack_kind(4), HazardKind::LizardoDrop);
        }
    }
    #[test]
    fn fortress_is_eight_evenly_spaced_bombs_and_holds_while_healing_until_last_resolve() {
        let mut s = fixture();
        let pos = s.combat.actors[4].view.pos;
        let radius = s.combat.actors[4].view.radius + CHIMERA_FORTRESS_GAP;
        let fill = s.combat.spawn_chimera_barrage(4, 0, 2).unwrap();
        s.combat.enemy_cast(4, fill);
        s.combat.actors[4].enemy_phase = 2;
        for (n, h) in drops(&s).into_iter().enumerate() {
            assert!((h.view.origin.distance(pos) - radius).abs() < 0.001);
            let expected = pos + direction(TAU * n as f32 / 8.) * radius;
            assert!(h.view.origin.distance(expected) < 0.001);
        }
        s.combat.actors[4].extra_cd = 0.;
        s.combat.actors[5].view.hp *= 0.2;
        let hp = s.combat.actors[5].view.hp;
        for _ in 0..((fill - SIM_DT) / SIM_DT) as usize {
            s.combat.timers();
            s.combat.update_hazards();
            s.combat.sync_boss_casts();
            s.enemy_ai();
            s.combat.actions();
            s.resolve_hazards();
            assert_eq!(s.combat.actors[4].view.pos, pos);
        }
        assert!(s.combat.actors[5].view.hp > hp);
        assert!(s.combat.actors[4].fortress);
        while !drops(&s).is_empty() {
            s.combat.timers();
            s.combat.update_hazards();
            s.enemy_ai();
            s.combat.actions();
            s.resolve_hazards();
        }
        s.enemy_ai();
        assert!(!s.combat.actors[4].fortress);
    }
    #[test]
    fn random_fortress_requires_room_for_full_ring_at_every_wall_and_phase() {
        use crate::enmity::BossAttack;
        for enraged in [false, true] {
            for wall in [
                Vec2::new(162., 800.),
                Vec2::new(798., 800.),
                Vec2::new(480., 106.),
                Vec2::new(480., 1526.),
            ] {
                let mut s = fixture();
                s.combat.actors[4].view.enraged = enraged;
                s.combat.actors[4].view.pos = wall;
                s.combat.actors[0].view.pos = wall;
                assert_eq!(
                    s.combat.boss_attack_target(4, 0, BossAttack::Fortress),
                    None
                );
                for _ in 0..16 {
                    assert!(s.combat.select_boss_attack(4, 0).is_some());
                    assert_ne!(s.combat.actors[4].boss_attack, BossAttack::Fortress);
                }
                for _ in 0..300 {
                    if !s.combat.prepare_fortress(4) {
                        break;
                    }
                }
                assert!(s
                    .combat
                    .boss_attack_target(4, 0, BossAttack::Fortress)
                    .is_some());
                for _ in 0..64 {
                    s.combat.select_boss_attack(4, 0).unwrap();
                    if s.combat.actors[4].boss_attack == BossAttack::Fortress {
                        break;
                    }
                }
                assert_eq!(s.combat.actors[4].boss_attack, BossAttack::Fortress);
                s.combat.spawn_chimera_barrage(4, 0, 2).unwrap();
                assert_eq!(drops(&s).len(), CHIMERA_FORTRESS_BOMBS);
                for h in drops(&s) {
                    assert_eq!(
                        floor_point(h.view.origin, s.combat.bomb_radius(4)),
                        h.view.origin
                    );
                    assert!(
                        (h.view.origin.distance(s.combat.actors[4].view.pos)
                            - BOSS_BODY_RADIUS
                            - CHIMERA_FORTRESS_GAP)
                            .abs()
                            < 0.001
                    );
                }
            }
        }
    }
    #[test]
    fn fortress_makes_room_before_commit_and_never_squeezes_its_wall_geometry() {
        let mut s = fixture();
        s.combat.actors[4].view.pos = Vec2::new(170., 800.);
        s.combat.actors[0].view.pos = Vec2::new(270., 800.);
        s.combat.actors[1].view.pos = Vec2::new(170., 900.);
        assert!(s.combat.try_fortress(4));
        assert!(drops(&s).is_empty());
        for _ in 0..200 {
            s.enemy_ai();
            if s.combat.actors[4].fortress {
                break;
            }
        }
        assert!(s.combat.actors[4].fortress);
        let pos = s.combat.actors[4].view.pos;
        for h in drops(&s) {
            assert!(
                (h.view.origin.distance(pos) - BOSS_BODY_RADIUS - CHIMERA_FORTRESS_GAP).abs()
                    < 0.001
            );
            assert_eq!(floor_point(h.view.origin, BOMB_RADIUS), h.view.origin);
        }
    }
    #[test]
    fn committed_bombs_in_every_mode_survive_target_loss_and_hero_stagger() {
        for mode in 0..3 {
            let mut s = fixture();
            let duration = s.combat.spawn_chimera_barrage(4, 0, mode).unwrap();
            s.combat.enemy_cast(4, duration);
            let ids: Vec<_> = drops(&s).into_iter().map(|h| h.view.id).collect();
            for a in &mut s.combat.actors[..4] {
                a.view.hp = 0.;
            }
            s.combat.actors[4].push_rng = (0..100)
                .map(crate::rng::Rng)
                .find(|r| {
                    let mut r = *r;
                    !r.chance(0.5)
                })
                .unwrap();
            s.combat.hero_push(4, Vec2::new(1., 0.), 30.);
            assert_eq!(drops(&s).len(), ids.len());
            for _ in 0..180 {
                s.combat.timers();
                s.combat.update_hazards();
                s.combat.move_projectiles();
                s.resolve_hazards();
                s.combat.prune_bombs();
            }
            let events = s.drain_events();
            for id in ids {
                assert!(events.iter().any(
                    |e| matches!(e, Event::HazardResolved { id: resolved, .. } if *resolved == id)
                ));
            }
            assert!(!events
                .iter()
                .any(|e| matches!(e, Event::HazardCancelled { .. })));
        }
    }
    #[test]
    fn scatter_uses_open_floor_avoids_heroes_existing_and_sibling_bombs() {
        for seed in 1..=20 {
            let mut s = fixture();
            s.combat.spawn_rng = crate::rng::Rng(seed);
            let old = Vec2::new(480., 1500.);
            s.hazard(
                HazardKind::LizardoDrop,
                s.combat.actors[4].view.id,
                None,
                old,
                Vec2::new(1., 0.),
            );
            s.combat.spawn_chimera_barrage(4, 0, 1).unwrap();
            let bombs = drops(&s);
            assert_eq!(bombs.len(), 5);
            for (n, b) in bombs.iter().enumerate().skip(1) {
                assert_eq!(b.view.origin, floor_point(b.view.origin, BOMB_RADIUS));
                assert!(b.target.is_none());
                for hero in &s.combat.actors[..4] {
                    assert!(
                        b.view.origin.distance(hero.view.pos)
                            >= BOMB_RADIUS + hero.view.radius + BOMB_OPEN_MARGIN
                    );
                }
                for previous in &bombs[..n] {
                    assert!(
                        b.view.origin.distance(previous.view.origin)
                            >= 2. * BOMB_RADIUS + BOMB_OPEN_MARGIN
                    );
                }
            }
        }
    }
    #[test]
    fn targeted_always_includes_random_area_denial_and_cooldown_is_exactly_halved() {
        let mut s = fixture();
        let base = s.combat.boss_recharge_duration(4);
        let fill = s.combat.spawn_chimera_barrage(4, 0, 0).unwrap();
        assert_eq!(drops(&s).len(), 4);
        assert_eq!(drops(&s).iter().filter(|h| h.target.is_none()).count(), 1);
        let bombs = drops(&s);
        let open = bombs.iter().find(|h| h.target.is_none()).unwrap();
        for aimed in bombs.iter().filter(|h| h.target.is_some()) {
            assert!(
                open.view.origin.distance(aimed.view.origin)
                    >= BOMB_RADIUS + CHIMERA_TARGETED_BOMB_RADIUS + BOMB_OPEN_MARGIN
            );
        }
        assert!((s.combat.actors[4].barrage_cd - fill - base * 0.5).abs() < 0.00001);
        assert!(s.combat.spawn_chimera_barrage(4, 0, 1).is_none());
        for h in &mut s.combat.hazards {
            h.view.phase = HazardPhase::Resolved;
        }
        s.combat.actors[4].enemy_phase = 2;
        s.combat.actors[4].view.energy = 0.;
        s.enemy_ai();
        assert!((s.combat.actors[4].recharge_duration - base * 0.5).abs() < 0.00001);
    }
    #[test]
    fn melee_pressure_triggers_fortress_out_of_turn_once_without_advancing_normal_mode() {
        let mut s = fixture();
        let p = s.combat.actors[4].view.pos;
        s.combat.actors[0].view.pos = p + Vec2::new(100., 0.);
        s.combat.actors[1].view.pos = p + Vec2::new(-100., 0.);
        s.combat.actors[4].serial = 1;
        s.combat.actors[4].view.energy = 0.;
        s.enemy_ai();
        assert_eq!(drops(&s).len(), 8);
        assert!(s.combat.actors[4].fortress);
        assert_eq!(s.combat.actors[4].barrage_serial, 0);
        assert_eq!(s.combat.actors[4].serial, 1);
        s.enemy_ai();
        assert_eq!(drops(&s).len(), 8);
    }
    #[test]
    fn fortress_body_separation_keeps_boss_planted() {
        let mut s = fixture();
        let p = s.combat.actors[4].view.pos;
        s.combat.spawn_chimera_barrage(4, 0, 2).unwrap();
        for (n, h) in s.combat.actors[..4].iter_mut().enumerate() {
            h.view.pos = p + direction(n as f32 * TAU / 4.) * 40.;
        }
        s.combat.constrain_party();
        assert_eq!(s.combat.actors[4].view.pos, p);
        for h in &s.combat.actors[..4] {
            assert!(
                h.view.pos.distance(p) >= h.view.radius + s.combat.actors[4].view.radius - 0.001
            );
        }
    }
    #[test]
    fn bomb_packages_are_deterministic_allocation_free_and_freeze_with_combat() {
        let mut a = fixture();
        let mut b = fixture();
        let start = ALLOCATIONS.with(|c| c.get());
        for mode in 0..3 {
            a.combat.hazards.clear();
            a.combat.projectiles.clear();
            b.combat.hazards.clear();
            b.combat.projectiles.clear();
            a.combat.actors[4].barrage_cd = 0.;
            b.combat.actors[4].barrage_cd = 0.;
            assert_eq!(
                a.combat.spawn_chimera_barrage(4, 0, mode),
                b.combat.spawn_chimera_barrage(4, 0, mode)
            );
            assert_eq!(a.state_hash(), b.state_hash());
        }
        assert_eq!(start, ALLOCATIONS.with(|c| c.get()));
        // A running window freezes a package; the boss-special gate only blocks new windows.
        a.set_spotlight(SpotlightConfig {
            global_gap: 0.,
            hero_gap: 0.,
            fairness: 0.,
            ..SpotlightConfig::DEFAULT
        });
        a.combat.actors[4].fortress = false;
        a.combat.hazards.clear();
        a.combat.projectiles.clear();
        for dx in [-5., 5.] {
            a.spawn_actor(
                Archetype::Orc,
                a.combat.actors[5].view.pos + Vec2::new(dx, 0.),
            );
        }
        a.combat.start_arcane_pulse(3, a.combat.actors[5].view.id);
        a.combat.select_spotlight();
        assert!(a.combat.spotlight.active.is_some());
        a.combat.actors[4].barrage_cd = 0.;
        a.combat.spawn_chimera_barrage(4, 0, 2).unwrap();
        let before = a.combat.actors[4].barrage_cd;
        for _ in 0..10 {
            a.step();
            assert_eq!(a.combat.actors[4].barrage_cd, before);
        }
    }
}
