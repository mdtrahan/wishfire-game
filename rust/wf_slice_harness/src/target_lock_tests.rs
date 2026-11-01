use crate::{tests::ALLOCATIONS, tuning::*, *};
fn fixture(kind: Archetype) -> Sim {
    let mut s = Sim::composition_trial(SimConfig::default(), &[kind]);
    s.combat.hazards.clear();
    s.combat.projectiles.clear();
    s.combat.events.clear();
    for (i, a) in s.combat.actors.iter_mut().enumerate() {
        a.view.pos = Vec2::new(480. + i as f32 * 20., 1100.);
        a.destination = a.view.pos;
        a.formed_age = 100.;
        a.stats.evade = 0.;
        a.view.hp = 100000.;
        a.view.max_hp = 100000.;
        a.basic_cd = 1000.;
        a.special_cd = 1000.;
        a.extra_cd = 1000.;
        a.pound_cd = 1000.;
        a.pulse_cd = 1000.;
        a.summon_cd = 1000.;
        a.ai_cd = 1000.;
    }
    s
}
fn impact(s: &mut Sim, i: usize) {
    s.combat.actors[i].view.state_age = s.combat.actors[i].view.impact_at;
    s.combat.action(i);
}
fn finish(s: &mut Sim) {
    for _ in 0..180 {
        s.combat.update_hazards();
        s.resolve_hazards();
    }
}
#[test]
fn locked_hero_melee_and_shadow_hit_walkers_but_enemy_melee_keeps_range_and_evade() {
    for i in [0, 1] {
        for shadow in [false, true] {
            if shadow && i == 0 {
                continue;
            }
            let mut s = fixture(Archetype::Orc);
            let id = s.combat.actors[4].view.id;
            s.combat.start_action(i, Some(id), shadow, false);
            // Keep the locked Shadow target horizontal; diagonal drift follows the no-landing path.
            s.combat.actors[4].view.pos = if shadow {
                Vec2::new(600., 1100.)
            } else {
                Vec2::new(800., ARENA_MAX.y - 100.)
            };
            impact(&mut s, i);
            assert!(s.combat.actors[4].view.hp < 100000.);
        }
    }
    let mut s = fixture(Archetype::Orc);
    s.combat.start_action(4, Some(1), false, false);
    s.combat.actors[0].view.pos = Vec2::new(150., ARENA_MAX.y - 100.);
    impact(&mut s, 4);
    assert_eq!(s.combat.actors[0].view.hp, 100000.);
    s.combat.actors[4].stats.evade = 1.;
    let id = s.combat.actors[4].view.id;
    s.combat.start_action(0, Some(id), false, false);
    impact(&mut s, 0);
    assert!(s
        .drain_events()
        .iter()
        .any(|e| matches!(e,Event::Evaded{source:1,target}if *target==id)));
}
#[test]
fn shadow_landed_strike_grants_absorbing_self_ward_for_exactly_three_combat_seconds() {
    let mut s = fixture(Archetype::Orc);
    let target = s.combat.actors[4].view.id;
    let hondo = s.combat.actors[1].view.id;
    let max_hp = s.combat.actors[1].view.max_hp;
    s.combat.grant_ward(0);
    let fara_ward = s.combat.actors[0].view.ward;
    s.combat.start_action(1, Some(target), true, false);
    assert_eq!(s.combat.actors[1].view.ward, 0.);
    impact(&mut s, 1);
    assert_eq!(s.combat.actors[1].view.ward, max_hp * SHADOW_WARD_FRACTION);
    assert!(s.drain_events().iter().any(|e| matches!(e,
        Event::WardGained { target, amount }
        if *target == hondo && *amount == max_hp * SHADOW_WARD_FRACTION)));
    s.combat
        .damage(target, 1, max_hp * 0.1, false, false, Element::Physical);
    assert_eq!(s.combat.actors[1].view.hp, max_hp);
    assert_eq!(s.combat.actors[1].view.ward, max_hp * 0.1);
    for _ in 0..89 {
        s.combat.timers();
    }
    assert!(s.combat.actors[1].view.ward > 0.);
    s.combat.timers();
    assert_eq!(s.combat.actors[1].view.ward, 0.);
    assert_eq!(s.combat.actors[0].view.ward, fara_ward);
    s.combat
        .damage(target, 1, 10., false, false, Element::Physical);
    assert_eq!(s.combat.actors[1].view.hp, max_hp - 10.);
}

#[test]
fn shadow_without_landed_hit_and_hondo_basic_or_split_do_not_grant_ward() {
    for case in 0..4 {
        let mut s = fixture(Archetype::Orc);
        let target = s.combat.actors[4].view.id;
        if case == 3 {
            s.combat.start_extra(1, target);
        } else {
            s.combat.start_action(1, Some(target), case < 2, false);
        }
        if case == 0 {
            s.combat.actors[4].view.hp = 0.;
        }
        if case == 1 {
            s.combat.actors[4].stats.evade = 1.;
        }
        impact(&mut s, 1);
        assert_eq!(s.combat.actors[1].view.ward, 0., "case {case}");
        assert!(!s
            .drain_events()
            .iter()
            .any(|e| matches!(e, Event::WardGained { .. })));
    }
}

#[test]
fn shadow_ward_freezes_during_spotlight_and_clears_on_down_and_wipe() {
    let mut s = fixture(Archetype::Boss);
    s.set_spotlight(SpotlightConfig {
        global_gap: 0.,
        hero_gap: 0.,
        fairness: 0.,
        charge: 0.,
        auto_release: true,
        ..SpotlightConfig::DEFAULT
    });
    let target = s.combat.actors[4].view.id;
    s.combat.start_action(1, Some(target), true, false);
    s.combat.select_spotlight();
    assert!(s.combat.spotlight.active.is_some());
    for _ in 0..300 {
        if s.combat.spotlight.active.is_none() {
            break;
        }
        s.step();
    }
    assert!(s.combat.spotlight.active.is_none());
    assert_eq!(s.combat.actors[1].self_ward_steps, 90);
    assert_eq!(
        s.combat.actors[1].view.ward,
        s.combat.actors[1].view.max_hp * SHADOW_WARD_FRACTION
    );
    s.combat.actors[1].view.hp = 0.;
    s.deaths();
    assert_eq!(s.combat.actors[1].view.ward, 0.);
    assert_eq!(s.combat.actors[1].self_ward_steps, 0);
    s.combat.actors[1].self_ward_steps = 20;
    s.combat.actors[1].view.ward = 10.;
    s.reset_stage(false);
    assert_eq!(s.combat.actors[1].self_ward_steps, 0);
    assert_eq!(s.combat.actors[1].view.ward, 0.);
}
#[test]
fn split_tracks_to_impact_without_reach_recheck_and_dead_target_leaves_area() {
    for dead in [false, true] {
        let mut s = fixture(Archetype::Orc);
        let id = s.combat.actors[4].view.id;
        s.combat.start_extra(1, id);
        s.combat.actors[4].view.pos = Vec2::new(780., ARENA_MAX.y - 100.);
        s.combat.actors[1].view.state_age = 0.1;
        s.combat.action(1);
        let other = s.spawn_actor(
            Archetype::Orc,
            s.combat.actors[4].view.pos + Vec2::new(40., 0.),
        );
        s.combat.actors.last_mut().unwrap().stats.evade = 0.;
        if dead {
            s.combat.actors[4].view.hp = 0.;
            s.combat.actors.remove(4);
        }
        impact(&mut s, 1);
        assert!(s
            .drain_events()
            .iter()
            .any(|e| matches!(e,Event::Hit{target,amount,..}if *target==other&&*amount>0.)));
    }
}
#[test]
fn bubble_and_pulse_track_walkers_clamp_corners_and_guarantee_only_the_locked_target() {
    for kind in [HazardKind::BubblePop, HazardKind::ArcanePulse] {
        let mut s = fixture(Archetype::Orc);
        let id = s.combat.actors[4].view.id;
        let i = if kind == HazardKind::BubblePop { 2 } else { 3 };
        if i == 2 {
            s.combat.start_action(i, Some(id), true, false);
        } else {
            s.combat.start_arcane_pulse(i, id);
            impact(&mut s, i);
        }
        let radius = if i == 2 {
            BUBBLE_RADIUS
        } else {
            ARCANE_PULSE_RADIUS
        };
        s.combat.actors[4].view.pos = ARENA_MIN + Vec2::new(BODY_RADIUS, BODY_RADIUS);
        let bystander = s.spawn_actor(Archetype::Orc, s.combat.actors[4].view.pos);
        let j = s.combat.actor_index(bystander).unwrap();
        s.combat.actors[j].view.hp = 100000.;
        s.combat.actors[j].stats.evade = 0.;
        s.combat.update_hazards();
        assert_eq!(
            s.combat.hazards[0].view.origin,
            crate::math::floor_point(s.combat.actors[4].view.pos, radius)
        );
        assert!(!s.combat.hazards[0].hits(s.combat.actors[4].view.pos, BODY_RADIUS));
        let h = s.combat.hazards[0].view.clone();
        let extra_should_hit = crate::math::contains(
            h.shape,
            h.origin,
            h.dir,
            s.combat.actors[j].view.pos,
            BODY_RADIUS,
        );
        finish(&mut s);
        assert!(s.combat.actors[4].view.hp < 100000.);
        assert_eq!(s.combat.actors[j].view.hp < 100000., extra_should_hit);
    }
}
#[test]
fn tracked_circle_locks_last_geometry_when_target_dies_and_still_hits_other_enemies() {
    for kind in [HazardKind::BubblePop, HazardKind::ArcanePulse] {
        let mut s = fixture(Archetype::Orc);
        let target = s.combat.actors[4].view.id;
        let owner = if kind == HazardKind::BubblePop { 3 } else { 4 };
        s.hazard(
            kind,
            owner,
            Some(target),
            s.combat.actors[4].view.pos,
            Vec2::new(1., 0.),
        );
        s.combat.actors[4].view.pos = Vec2::new(700., 1400.);
        s.combat.update_hazards();
        let last = s.combat.hazards[0].view.origin;
        let extra = s.spawn_actor(Archetype::Orc, last);
        let e = s.combat.actor_index(extra).unwrap();
        s.combat.actors[e].stats.evade = 0.;
        let hp = s.combat.actors[e].view.hp;
        s.combat.actors[4].view.hp = 0.;
        s.combat.actors[4].view.pos = Vec2::new(150., ARENA_MAX.y - 100.);
        s.combat.update_hazards();
        assert_eq!(s.combat.hazards[0].view.origin, last);
        finish(&mut s);
        assert!(s.combat.actors[e].view.hp < hp);
    }
}
#[test]
fn pulse_and_pound_still_resolve_at_last_point_when_target_dies_during_cast() {
    for pound in [false, true] {
        let mut s = fixture(Archetype::Orc);
        let id = s.combat.actors[4].view.id;
        let i = if pound { 0 } else { 3 };
        if pound {
            s.combat.start_ground_pound(i, id)
        } else {
            s.combat.start_arcane_pulse(i, id)
        }
        s.combat.actors[4].view.pos = Vec2::new(680., 1100.);
        s.combat.action(i);
        let other = s.spawn_actor(Archetype::Orc, s.combat.actors[4].view.pos);
        let j = s.combat.actor_index(other).unwrap();
        s.combat.actors[j].stats.evade = 0.;
        let hp = s.combat.actors[j].view.hp;
        s.combat.actors[4].view.hp = 0.;
        s.combat.actors.remove(4);
        impact(&mut s, i);
        finish(&mut s);
        assert!(
            s.combat.actors[s.combat.actor_index(other).unwrap()]
                .view
                .hp
                < hp
        );
    }
}
#[test]
fn healing_spring_follows_its_locked_ally_without_creating_a_pool() {
    let mut s = fixture(Archetype::Orc);
    let id = s.combat.actors[1].view.id;
    s.combat.actors[1].view.hp = 1.;
    s.combat.start_extra(2, id);
    s.combat.actors[1].view.pos = Vec2::new(700., ARENA_MAX.y - 100.);
    impact(&mut s, 2);
    assert!(s.combat.hazards.is_empty());
    assert!((s.combat.actors[1].view.hp - 35001.).abs() < 0.01);
}

#[test]
fn locked_heal_lands_at_walls_and_does_not_tick_afterward() {
    let mut s = fixture(Archetype::Orc);
    s.combat.actors[1].view.hp = 1.;
    s.combat.start_extra(2, s.combat.actors[1].view.id);
    s.combat.actors[1].view.pos = ARENA_MIN + Vec2::new(BODY_RADIUS, BODY_RADIUS);
    impact(&mut s, 2);
    let hp = s.combat.actors[1].view.hp;
    assert!(hp > 1.);
    for _ in 0..60 {
        s.combat.update_hazards();
        s.resolve_hazards();
    }
    assert_eq!(s.combat.actors[1].view.hp, hp);
}

#[test]
fn ground_pound_committed_line_extends_past_cast_range_with_fixed_warning_and_hits_path() {
    let mut s = fixture(Archetype::Orc);
    let id = s.combat.actors[4].view.id;
    s.combat.start_ground_pound(0, id);
    impact(&mut s, 0);
    let duration = s.combat.hazards[0].duration;
    let damage = s.combat.hazards[0].damage;
    s.combat.actors[4].view.pos = Vec2::new(800., 1500.);
    let mid = s.combat.actors[0].view.pos
        + (s.combat.actors[4].view.pos - s.combat.actors[0].view.pos) * 0.5;
    let other = s.spawn_actor(Archetype::Orc, mid);
    let j = s.combat.actor_index(other).unwrap();
    s.combat.actors[j].stats.evade = 0.;
    let hp = s.combat.actors[j].view.hp;
    s.combat.update_hazards();
    assert!(matches!(s.combat.hazards[0].view.shape,Shape::Line{length,..}if length>300.));
    assert_eq!(s.combat.hazards[0].duration, duration);
    assert_eq!(duration, GROUND_POUND_COUNTDOWN);
    assert_eq!(s.combat.hazards[0].damage, damage);
    finish(&mut s);
    assert!(s.combat.actors[4].view.hp < 100000.);
    assert!(s.combat.actors[j].view.hp < hp);
}
#[test]
fn mage_bolts_home_past_interceptors_and_both_splashes_land_at_target() {
    for i in [2, 3] {
        let mut s = fixture(Archetype::Orc);
        s.combat.actors[i].view.pos = Vec2::new(300., 1000.);
        s.combat.actors[4].view.pos = Vec2::new(600., 1000.);
        let target = s.combat.actors[4].view.id;
        let blocker = s.spawn_actor(Archetype::Orc, Vec2::new(400., 1000.));
        let b = s.combat.actor_index(blocker).unwrap();
        s.combat.actors[b].stats.evade = 0.;
        let hp = s.combat.actors[b].view.hp;
        s.combat.projectile(
            i,
            Some(target),
            s.combat.actors[4].view.pos,
            false,
            30.,
            None,
        );
        let speed = s.combat.projectiles[0].speed;
        s.combat.move_projectiles();
        s.combat.actors[4].view.pos.y += 120.;
        let extra = s.spawn_actor(
            Archetype::Orc,
            s.combat.actors[4].view.pos + Vec2::new(0., 35.),
        );
        let e = s.combat.actor_index(extra).unwrap();
        s.combat.actors[e].stats.evade = 0.;
        let ehp = s.combat.actors[e].view.hp;
        for _ in 0..100 {
            s.combat.move_projectiles();
            for p in &s.combat.projectiles {
                assert_eq!(p.speed, speed);
            }
        }
        assert!(s.combat.actors[4].view.hp < 100000.);
        assert_eq!(s.combat.actors[b].view.hp, hp);
        assert!(s.combat.actors[e].view.hp < ehp);
        assert!(s.combat.projectiles.is_empty());
    }
}
#[test]
fn dead_target_bolts_keep_last_heading_and_first_body_collision() {
    let mut s = fixture(Archetype::Orc);
    s.combat.actors[2].view.pos = Vec2::new(300., 1000.);
    s.combat.actors[4].view.pos = Vec2::new(650., 1000.);
    let target = s.combat.actors[4].view.id;
    s.combat.projectile(
        2,
        Some(target),
        s.combat.actors[4].view.pos,
        false,
        30.,
        None,
    );
    s.combat.actors[4].view.pos.y += 100.;
    s.combat.move_projectiles();
    let dir = s.combat.projectiles[0].view.dir;
    let pos = s.combat.projectiles[0].view.pos;
    s.combat.actors[4].view.hp = 0.;
    let blocker = s.spawn_actor(Archetype::Orc, pos + dir * 100.);
    let j = s.combat.actor_index(blocker).unwrap();
    s.combat.actors[j].stats.evade = 0.;
    let hp = s.combat.actors[j].view.hp;
    for _ in 0..60 {
        s.combat.move_projectiles();
        for p in &s.combat.projectiles {
            assert_eq!(p.view.dir, dir);
        }
    }
    assert!(s.combat.actors[j].view.hp < hp);
}
#[test]
fn bubble_cancels_sniper_tracking_and_locked_lines_refunds_and_allows_fresh_recast() {
    for locked in [false, true] {
        let mut s = fixture(Archetype::Sniper);
        s.combat.actors[4].view.pos = Vec2::new(480., 800.);
        s.combat.actors[0].view.pos = Vec2::new(480., 1100.);
        let owner = s.combat.actors[4].view.id;
        let h = s.hazard(
            HazardKind::SniperLine,
            owner,
            Some(1),
            s.combat.actors[4].view.pos,
            Vec2::new(0., 1.),
        );
        if locked {
            s.combat.hazards[0].view.phase = HazardPhase::Locked;
        }
        s.combat.bubble_interrupt(4);
        assert_eq!(s.combat.actors[4].basic_cd, 0.);
        s.resolve_hazards();
        assert!(s.combat.hazards.is_empty());
        let es = s.drain_events();
        assert!(es
            .iter()
            .any(|e| matches!(e,Event::HazardCancelled{id,..}if *id==h)));
        assert!(!es
            .iter()
            .any(|e| matches!(e,Event::HazardResolved{id,..}if *id==h)));
        s.enemy_ai();
        let fresh = &s.combat.hazards[0];
        assert_ne!(fresh.view.id, h);
        assert_eq!(fresh.phase_age, 0.);
        assert_eq!(fresh.view.phase, HazardPhase::Tracking);
    }
}
#[test]
fn bubble_cancels_lizardo_prethrow_and_pending_drop_but_not_thrown_bombs_or_fuses() {
    let mut s = fixture(Archetype::Lizardo);
    s.combat.actors[4].view.pos = Vec2::new(480., 800.);
    for a in &mut s.combat.actors[..4] {
        a.view.pos = Vec2::new(480., 1080.);
    }
    s.combat.actors[4].basic_cd = 0.;
    s.enemy_ai();
    assert_eq!(s.combat.actors[4].view.state, ActorState::Cast);
    assert!(!s.combat.actors[4].action_done);
    assert_eq!(s.combat.actors[4].view.impact_at, LIZARDO_WINDUP);
    assert!(s.combat.hazards.is_empty() && s.combat.projectiles.is_empty());
    s.combat.bubble_interrupt(4);
    impact(&mut s, 4);
    assert!(s.combat.hazards.is_empty() && s.combat.projectiles.is_empty());
    assert_eq!(s.combat.actors[4].basic_cd, 0.);
    s.enemy_ai();
    impact(&mut s, 4);
    assert_eq!(s.combat.projectiles.len(), 1);
    let h = s.combat.hazards[0].clone();
    let bomb = s.combat.projectiles[0].clone();
    s.combat.bubble_interrupt(4);
    assert_eq!(s.combat.hazards[0].view, h.view);
    assert_eq!(s.combat.projectiles[0].fuse_hazard, bomb.fuse_hazard);
    assert_eq!(s.combat.hazards[0].damage, h.damage);
    assert_eq!(s.combat.hazards[0].duration, h.duration);
    // An unlaunched drop is cancellable; a body's Fizzmite fuse is independent.
    s.combat.projectiles.clear();
    s.combat.bubble_interrupt(4);
    assert!(s.combat.hazards[0].cancelled);
    s.resolve_hazards();
    assert!(s.combat.hazards.is_empty());
    let id = s.combat.actors[4].view.id;
    s.hazard(
        HazardKind::FizzmiteBlast,
        id,
        None,
        s.combat.actors[4].view.pos,
        Vec2::new(1., 0.),
    );
    let h = s.combat.hazards[0].view.clone();
    s.combat.bubble_interrupt(4);
    assert_eq!(s.combat.hazards[0].view, h);
}
#[test]
fn lizardo_release_rechecks_living_target_and_coverage_and_keeps_original_fuse() {
    for valid in [false, true] {
        let mut s = fixture(Archetype::Lizardo);
        s.combat.actors[4].view.pos = Vec2::new(480., 800.);
        for a in &mut s.combat.actors[..4] {
            a.view.pos = Vec2::new(480., 1080.);
        }
        s.combat.actors[4].basic_cd = 0.;
        s.enemy_ai();
        for _ in 0..11 {
            s.combat.timers();
            s.combat.action(4);
        }
        assert!(s.combat.projectiles.is_empty());
        if !valid {
            for a in &mut s.combat.actors[..4] {
                a.view.hp = 0.;
            }
        }
        s.combat.timers();
        s.combat.action(4);
        if valid {
            assert_eq!(s.combat.projectiles.len(), 1);
            assert_eq!(s.combat.hazards[0].base_duration, BOMB_TIME);
            assert_eq!(s.combat.projectiles[0].duration, BOMB_FLIGHT);
        } else {
            assert!(s.combat.projectiles.is_empty() && s.combat.hazards.is_empty());
            assert_eq!(s.combat.actors[4].basic_cd, 0.);
        }
    }
}
#[test]
fn bubble_interrupt_does_not_touch_bosses_or_launched_sniper_bolts() {
    let mut s = fixture(Archetype::Boss);
    let owner = s.combat.actors[4].view.id;
    s.hazard(
        HazardKind::BossSlam,
        owner,
        Some(1),
        s.combat.actors[4].view.pos,
        Vec2::new(1., 0.),
    );
    let before = format!("{:?}{:?}", s.combat.actors[4], s.combat.hazards);
    s.combat.bubble_interrupt(4);
    assert_eq!(
        format!("{:?}{:?}", s.combat.actors[4], s.combat.hazards),
        before
    );
    let mut s = fixture(Archetype::Sniper);
    let owner = s.combat.actors[4].view.id;
    s.hazard(
        HazardKind::SniperLine,
        owner,
        Some(1),
        s.combat.actors[4].view.pos,
        Vec2::new(1., 0.),
    );
    s.combat.hazards[0].view.phase = HazardPhase::Locked;
    s.combat.hazards[0].phase_age = s.combat.hazards[0].duration;
    s.resolve_hazards();
    let shots = format!("{:?}", s.combat.projectiles);
    let h = s.combat.hazards[0].view.clone();
    s.combat.bubble_interrupt(4);
    assert_eq!(s.combat.hazards[0].view, h);
    assert_eq!(format!("{:?}", s.combat.projectiles), shots);
}
#[test]
fn bubble_actual_hit_interrupts_ordinary_basic_windup_with_no_later_hit() {
    let mut s = fixture(Archetype::Orc);
    let id = s.combat.actors[4].view.id;
    s.combat.start_action(4, Some(1), false, false);
    s.combat.start_action(2, Some(id), true, false);
    s.combat.hazards[0].phase_age = s.combat.hazards[0].duration;
    s.resolve_hazards();
    assert!(s.combat.actors[4].action_done);
    assert_eq!(s.combat.actors[4].basic_cd, 0.);
    impact(&mut s, 4);
    assert!(!s
        .drain_events()
        .iter()
        .any(|e| matches!(e,Event::Hit{source,..}if *source==id)));
}
#[test]
fn target_lock_and_interruption_are_deterministic_allocation_free_with_spotlights() {
    for enabled in [false, true] {
        let cfg = SimConfig {
            seed: 7,
            spotlight: SpotlightConfig {
                enabled,
                auto_release: true,
                ..SpotlightConfig::DEFAULT
            },
            ..Default::default()
        };
        let mut a = Sim::new(cfg.clone());
        let mut b = Sim::new(cfg);
        a.drain_events();
        b.drain_events();
        for _ in 0..3600 {
            ALLOCATIONS.with(|x| x.set(Some(0)));
            a.step();
            let n = ALLOCATIONS.with(|x| x.replace(None).unwrap());
            assert_eq!(n, 0);
            b.advance(SIM_DT * 0.5);
            b.advance(SIM_DT * 0.5);
            assert_eq!(a.state_hash(), b.state_hash());
            assert_eq!(a.drain_events(), b.drain_events());
        }
    }
}

#[test]
fn lizardo_prethrow_survives_enemy_ai_at_exact_release_and_launched_bomb_still_hits() {
    let mut s = fixture(Archetype::Lizardo);
    s.combat.actors[4].view.pos = Vec2::new(480., 800.);
    for a in &mut s.combat.actors[..4] {
        a.view.pos = Vec2::new(480., 1080.);
    }
    s.combat.actors[4].basic_cd = 0.;
    s.enemy_ai();
    for n in 1..=12 {
        s.combat.timers();
        s.enemy_ai();
        s.combat.actions();
        assert_eq!(s.combat.projectiles.len(), usize::from(n == 12));
    }
    s.combat.bubble_interrupt(4);
    let hp = s.combat.actors[0].view.hp;
    for _ in 0..(BOMB_TIME / SIM_DT).ceil() as usize + 2 {
        s.combat.move_projectiles();
        s.combat.update_hazards();
        s.resolve_hazards();
        s.combat.prune_bombs();
    }
    assert!(s.combat.actors[0].view.hp < hp);
    assert!(s.combat.projectiles.is_empty());
}
#[test]
fn charge_performing_tail_freeze_projectiles_pools_and_other_actors_while_bubble_cancels_victim_warning(
) {
    let mut s = fixture(Archetype::Sniper);
    let target = s.combat.actors[4].view.id;
    s.set_spotlight(SpotlightConfig {
        enabled: true,
        auto_release: false,
        global_gap: 0.,
        hero_gap: 0.,
        fairness: 0.,
        ..SpotlightConfig::DEFAULT
    });
    let warning = s.hazard(
        HazardKind::SniperLine,
        target,
        Some(1),
        s.combat.actors[4].view.pos,
        Vec2::new(-1., 0.),
    );
    s.combat.place_faze(3, Vec2::new(300., 1500.));
    let pool = s.combat.hazards.last().unwrap().clone();
    s.combat.projectile(
        3,
        Some(target),
        s.combat.actors[4].view.pos,
        false,
        20.,
        None,
    );
    let shots = format!("{:?}", s.combat.projectiles);
    for dx in [-5., 5.] {
        s.spawn_actor(
            Archetype::Orc,
            s.combat.actors[4].view.pos + Vec2::new(dx, 0.),
        );
    }
    s.combat.start_action(2, Some(target), true, false);
    s.combat.select_spotlight();
    s.refresh_snapshot();
    let actors = format!("{:?}", s.combat.actors);
    let clock = s.combat.combat_steps;
    let charge_steps = (s.combat.cfg.spotlight.charge * SIM_HZ as f32).round() as u32;
    for _ in 0..charge_steps {
        s.step();
        assert_eq!(format!("{:?}", s.combat.actors), actors);
    }
    assert_eq!(
        s.combat.spotlight.active.as_ref().unwrap().phase,
        SpotlightPhase::Performing
    );
    for _ in 0..60 {
        if s.combat.spotlight.active.as_ref().unwrap().phase == SpotlightPhase::Tail {
            break;
        }
        s.step();
    }
    assert_eq!(s.combat.combat_steps, clock);
    assert_eq!(
        s.combat.spotlight.active.as_ref().unwrap().phase,
        SpotlightPhase::Tail
    );
    assert!(!s.combat.hazards.iter().any(|h| h.view.id == warning));
    let frozen = s
        .combat
        .hazards
        .iter()
        .find(|h| h.view.id == pool.view.id)
        .unwrap();
    assert_eq!(format!("{frozen:?}"), format!("{pool:?}"));
    assert_eq!(format!("{:?}", s.combat.projectiles), shots);
    let state = format!(
        "{:?}{:?}{:?}",
        s.combat.actors, s.combat.hazards, s.combat.projectiles
    );
    s.step();
    assert_eq!(
        format!(
            "{:?}{:?}{:?}",
            s.combat.actors, s.combat.hazards, s.combat.projectiles
        ),
        state
    );
}
