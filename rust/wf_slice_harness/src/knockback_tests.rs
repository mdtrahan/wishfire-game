use crate::{rng::Rng, tests::ALLOCATIONS, *};
fn fixture(kind: Archetype) -> Sim {
    let mut s = Sim::composition_trial(SimConfig::default(), &[kind]);
    s.combat.hazards.clear();
    s.combat.projectiles.clear();
    s.combat.events.clear();
    for a in &mut s.combat.actors {
        a.view.pos = Vec2::new(480., 1200.);
        a.destination = a.view.pos;
        a.basic_cd = 1000.;
        a.special_cd = 1000.;
        a.extra_cd = 1000.;
        a.pound_cd = 1000.;
        a.pulse_cd = 1000.;
        a.mend_cd = 1000.;
        a.summon_cd = 1000.;
        a.stats.evade = 0.;
        a.view.hp = 100000.;
        a.view.max_hp = 100000.;
    }
    s.combat.actors[4].view.pos.y -= 100.;
    s
}
fn roll(s: &mut Sim, pushed: bool) {
    s.combat.actors[4].push_rng = (0..100)
        .map(Rng)
        .find(|r| {
            let mut r = *r;
            r.chance(0.5) != pushed
        })
        .unwrap();
}
fn cast(s: &mut Sim, kind: HazardKind) -> u32 {
    let (owner, target) = (s.combat.actors[4].view.id, s.combat.actors[0].view.id);
    let p = s.combat.actors[4].view.pos;
    let origin = if kind == HazardKind::BossCone {
        s.combat.actors[4].cone_origin(Vec2::new(0., 1.))
    } else {
        p
    };
    let id = s.hazard(kind, owner, Some(target), origin, Vec2::new(0., 1.));
    s.combat.actors[4].serial = match kind {
        HazardKind::BossNova | HazardKind::BossCone | HazardKind::BossCharge => 2,
        _ => 1,
    };
    s.combat.actors[4].boss_attack = match kind {
        HazardKind::BossStompStep | HazardKind::BossSlam => crate::enmity::BossAttack::Stomp,
        HazardKind::BossCharge => crate::enmity::BossAttack::Charge,
        HazardKind::BossNova => crate::enmity::BossAttack::Nova,
        HazardKind::BossCone => crate::enmity::BossAttack::Cone,
        _ => crate::enmity::BossAttack::Snipe,
    };
    s.combat.actors[4].view.energy = 0.;
    s.combat.actors[4].enemy_phase = 2;
    s.combat.actors[4].state(ActorState::Cast, 10., 10.);
    s.combat.actors[4].action_done = true;
    id
}
#[test]
fn boss_resists_without_moving_or_changing_live_attack() {
    let mut s = fixture(Archetype::Boss);
    let id = cast(&mut s, HazardKind::BossSlam);
    roll(&mut s, false);
    let p = s.combat.actors[4].view.pos;
    let h = s.combat.hazards[0].view.clone();
    s.combat.hero_push(4, Vec2::new(1., 0.), 35.);
    assert_eq!(s.combat.actors[4].view.pos, p);
    assert_eq!(s.combat.hazards[0].view, h);
    assert!(s
        .drain_events()
        .iter()
        .any(|e| matches!(e,Event::KnockbackResisted{id:i} if *i==s.combat.actors[4].view.id)));
    assert_eq!(s.combat.hazards[0].view.id, id);
}
#[test]
fn pushed_boss_cancels_and_refunds_same_ground_attack_at_new_origin() {
    for (boss, kind) in [
        (Archetype::Boss, HazardKind::BossStompStep),
        (Archetype::Boss, HazardKind::BossCharge),
        (Archetype::BossBomber, HazardKind::BossNova),
        (Archetype::BossMarksman, HazardKind::BossCone),
    ] {
        let mut s = fixture(boss);
        let old = cast(&mut s, kind);
        roll(&mut s, true);
        let p = s.combat.actors[4].view.pos;
        s.combat.hero_push(4, Vec2::new(1., 0.), 30.);
        assert_eq!(s.combat.actors[4].view.pos, p + Vec2::new(30., 0.));
        assert_eq!(s.combat.actors[4].view.energy, 1.);
        s.resolve_hazards();
        assert!(s.combat.hazards.is_empty());
        let es = s.drain_events();
        assert!(es
            .iter()
            .any(|e| matches!(e,Event::HazardCancelled{id,..} if *id==old)));
        assert!(!es
            .iter()
            .any(|e| matches!(e,Event::HazardResolved{id,..} if *id==old)));
        assert!(es.iter().any(|e| matches!(
            e,
            Event::BossStaggered {
                interrupted: true,
                ..
            }
        )));
        s.enemy_ai();
        let h = s
            .combat
            .hazards
            .iter()
            .find(|h| h.view.kind == kind)
            .expect("same attack recast");
        assert_ne!(h.view.id, old);
        assert_eq!(h.phase_age, 0.);
        assert_eq!(
            h.view.origin,
            if kind == HazardKind::BossStompStep {
                s.combat.actors[4].view.pos
                    + h.view.dir * (s.combat.actors[4].view.radius + crate::tuning::STOMP_FIRST_GAP)
            } else if kind == HazardKind::BossCone {
                s.combat.actors[4].cone_origin(h.view.dir)
            } else {
                s.combat.actors[4].view.pos
            }
        );
        assert_eq!(s.combat.actors[4].view.energy, 0.);
    }
}
#[test]
fn boss_basic_windup_refunds_and_restarts_but_launched_attacks_continue() {
    let mut s = fixture(Archetype::BossMarksman);
    let target = s.combat.actors[0].view.id;
    s.combat.start_action(4, Some(target), false, false);
    roll(&mut s, true);
    s.combat.hero_push(4, Vec2::new(0., 1.), 10.);
    assert!(s.combat.actors[4].boss_retry_basic);
    assert_eq!(s.combat.actors[4].basic_cd, 0.);
    assert_eq!(s.combat.actors[4].special_cd, 0.);
    s.enemy_ai();
    assert_eq!(s.combat.actors[4].view.state, ActorState::Basic);
    assert_eq!(s.combat.actors[4].view.state_age, 0.);
    assert!(!s.combat.actors[4].boss_retry_basic);
    // Snipes/bombs have independent launched travel and are not self-anchored.
    s.combat.actors[4].state(ActorState::Idle, 0., 0.);
    for kind in [HazardKind::BossSnipe, HazardKind::LizardoDrop] {
        let owner = s.combat.actors[4].view.id;
        s.hazard(
            kind,
            owner,
            Some(target),
            Vec2::new(400., 1000.),
            Vec2::new(0., 1.),
        );
        if kind == HazardKind::BossSnipe {
            s.combat.hazards.last_mut().unwrap().view.phase = HazardPhase::Active;
        }
    }
    let views: Vec<_> = s.combat.hazards.iter().map(|h| h.view.clone()).collect();
    roll(&mut s, true);
    s.combat.hero_push(4, Vec2::new(1., 0.), 30.);
    assert_eq!(
        s.combat
            .hazards
            .iter()
            .map(|h| h.view.clone())
            .collect::<Vec<_>>(),
        views
    );
    assert!(s.drain_events().iter().any(|e| matches!(
        e,
        Event::BossStaggered {
            interrupted: false,
            ..
        }
    )));
}
#[test]
fn boss_push_stream_is_half_resists_deterministic_and_allocation_free() {
    let mut a = fixture(Archetype::Boss);
    let mut b = fixture(Archetype::Boss);
    let mut pushed = 0;
    for _ in 0..10000 {
        for s in [&mut a, &mut b] {
            s.combat.events.clear();
            s.combat.actors[4].view.pos = Vec2::new(480., 1100.);
            ALLOCATIONS.with(|n| n.set(Some(0)));
            s.combat.hero_push(4, Vec2::new(1., 0.), 30.);
            assert_eq!(ALLOCATIONS.with(|n| n.replace(None)), Some(0));
        }
        pushed += usize::from(a.combat.actors[4].view.pos.x > 480.);
        assert_eq!(a.combat.actors[4].push_rng.0, b.combat.actors[4].push_rng.0);
        assert_eq!(a.state_hash(), b.state_hash());
    }
    eprintln!("boss pushes={pushed}/10000, resists={}", 10000 - pushed);
    assert!((4800..=5200).contains(&pushed));
}
#[test]
fn body_collision_keeps_pending_slam_nova_and_cone_anchored() {
    for (boss, kind) in [
        (Archetype::Boss, HazardKind::BossSlam),
        (Archetype::BossBomber, HazardKind::BossNova),
        (Archetype::BossMarksman, HazardKind::BossCone),
    ] {
        let mut s = fixture(boss);
        cast(&mut s, kind);
        s.combat.actors[0].view.pos = s.combat.actors[4].view.pos;
        s.combat.actors[0].state(ActorState::Cast, 10., 10.);
        s.combat.constrain_party();
        let h = &s.combat.hazards[0];
        assert_eq!(
            h.view.origin,
            if kind == HazardKind::BossCone {
                s.combat.actors[4].cone_origin(h.view.dir)
            } else {
                s.combat.actors[4].view.pos
            }
        );
    }
}
#[test]
fn tracking_charge_reclips_after_boss_containment_shift() {
    let mut s = fixture(Archetype::Boss);
    let origin = Vec2::new(700., 1100.);
    s.combat.actors[4].view.pos = origin;
    let clearance = s.combat.actors[4].view.radius + s.combat.actors[0].view.radius;
    s.combat.actors[0].view.pos = origin - Vec2::new(clearance - 0.2, 0.);
    s.hazard(
        HazardKind::BossCharge,
        s.combat.actors[4].view.id,
        Some(s.combat.actors[0].view.id),
        origin,
        Vec2::new(1., 0.),
    );
    s.combat.hazards[0].known[0] = true;
    s.combat.constrain_party();
    let h = &s.combat.hazards[0].view;
    assert_eq!(h.phase, HazardPhase::Tracking);
    assert_eq!(h.origin, s.combat.actors[4].view.pos);
    assert!(h.origin.x > origin.x);
    let Shape::Line { length, .. } = h.shape else {
        panic!("charge line")
    };
    let end = h.origin + h.dir * length;
    assert!(
        end.x >= tuning::ARENA_MIN.x && end.x < tuning::ARENA_MAX.x,
        "{end:?}"
    );
    assert!(end.y >= tuning::ARENA_MIN.y && end.y < tuning::ARENA_MAX.y);
}
#[test]
fn hero_hazard_pushes_damage_bosses_and_still_move_regular_enemies() {
    for kind in [HazardKind::BubblePop, HazardKind::GroundPound] {
        for boss in [false, true] {
            let mut s = fixture(if boss {
                Archetype::Boss
            } else {
                Archetype::Orc
            });
            s.combat.actors[0].view.pos = Vec2::new(380., 1100.);
            let p = s.combat.actors[4].view.pos;
            roll(&mut s, false);
            let target = s.combat.actors[4].view.id;
            s.hazard(
                kind,
                1,
                Some(target),
                s.combat.actors[0].view.pos,
                Vec2::new(1., 0.),
            );
            s.combat.hazards[0].phase_age = s.combat.hazards[0].duration;
            s.resolve_hazards();
            assert!(s.combat.actors[4].view.hp < 100000.);
            if boss {
                assert_eq!(s.combat.actors[4].view.pos, p);
            } else {
                assert!(s.combat.actors[4].view.pos.x > p.x);
            }
        }
    }
}

#[test]
fn pending_snipe_restarts_but_launched_bolt_keeps_its_committed_flight() {
    let mut s = fixture(Archetype::BossMarksman);
    let old = cast(&mut s, HazardKind::BossSnipe);
    s.combat.actors[4].serial = 1;
    roll(&mut s, true);
    s.combat.hero_push(4, Vec2::new(1., 0.), 30.);
    s.resolve_hazards();
    assert!(!s.combat.hazards.iter().any(|h| h.view.id == old));
    s.enemy_ai();
    let h = s
        .combat
        .hazards
        .iter()
        .find(|h| h.view.kind == HazardKind::BossSnipe)
        .unwrap();
    assert_eq!(h.view.origin, s.combat.actors[4].view.pos);
    assert_eq!(h.phase_age, 0.);
    let mut h = h.clone();
    h.view.phase = HazardPhase::Active;
    s.combat.hazards[0] = h.clone();
    s.combat.sniper_bolt(&h);
    let shots = s.combat.projectiles.len();
    assert!(shots > 0);
    let p = s.combat.projectiles[0].view.pos;
    s.combat.actors[4].state(ActorState::Idle, 0., 0.);
    roll(&mut s, true);
    s.combat.hero_push(4, Vec2::new(1., 0.), 30.);
    assert_eq!(s.combat.projectiles.len(), shots);
    for a in &mut s.combat.actors[..4] {
        a.view.pos.y = crate::tuning::ARENA_MAX.y - 100.;
    }
    s.combat.move_projectiles();
    assert_ne!(s.combat.projectiles[0].view.pos, p);
}
