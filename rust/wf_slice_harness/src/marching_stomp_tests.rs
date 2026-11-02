use crate::{rng::Rng, tests::ALLOCATIONS, tuning::*, *};
fn fixture() -> Sim {
    let mut s = Sim::composition_trial(SimConfig::default(), &[Archetype::Boss]);
    s.combat.hazards.clear();
    s.combat.projectiles.clear();
    for (i, a) in s.combat.actors.iter_mut().enumerate() {
        a.view.pos = Vec2::new(480. + i as f32 * 10., 1300.);
        a.destination = a.view.pos;
        a.basic_cd = 1000.;
        a.special_cd = 1000.;
        a.extra_cd = 1000.;
        a.pulse_cd = 1000.;
        a.pound_cd = 1000.;
        a.mend_cd = 1000.;
        a.summon_cd = 1000.;
        a.stats.evade = 0.;
        a.view.hp = 100000.;
        a.view.max_hp = 100000.;
    }
    s.combat.actors[4].view.pos = Vec2::new(480., 900.);
    s.combat.actors[0].view.pos = Vec2::new(480., 1006.);
    s.combat.actors[4].recharge_left = -SIM_DT;
    s.combat.actors[4].enmity = [100., 0., 0., 0.];
    s.combat.actors[4].aggro_target = Some(s.combat.actors[0].view.id);
    s.combat.events.clear();
    s
}
fn close(a: f32, b: f32) {
    assert!((a - b).abs() < 0.001, "{a} != {b}");
}
fn start(s: &mut Sim) {
    s.combat.actors[4].boss_attack = crate::enmity::BossAttack::Stomp;
    s.combat.actors[4].boss_retry_special = true;
    s.enemy_ai();
    assert_eq!(s.combat.actors[4].serial, 1);
    assert_eq!(s.combat.actors[4].view.energy, 0.);
    assert_eq!(
        s.combat
            .hazards
            .iter()
            .filter(|h| h.view.kind == HazardKind::BossStompStep
                && h.view.phase != HazardPhase::Resolved)
            .count(),
        4
    );
}
fn pushed_seed(resist: bool) -> u64 {
    (0..100)
        .find(|&seed| Rng(seed).chance(0.5) == resist)
        .unwrap()
}
#[test]
fn four_forward_circles_lock_together_with_exact_spacing_and_delayed_fill() {
    let mut s = fixture();
    start(&mut s);
    let first = s.combat.actors[4].view.radius + STOMP_FIRST_GAP;
    for (k, h) in s.combat.hazards.iter().enumerate() {
        assert_eq!(h.view.kind, HazardKind::BossStompStep);
        assert_eq!(h.view.phase, HazardPhase::Locked);
        assert_eq!(h.view.fill, FillMode::Countdown);
        assert_eq!(h.view.progress, 0.);
        assert_eq!(h.view.shape, Shape::Circle { radius: 75. });
        assert_eq!(
            h.view.origin,
            Vec2::new(480., 900. + first + 120. * k as f32)
        );
        close(h.phase_age, -0.25 * k as f32);
    }
    for _ in 0..7 {
        s.combat.update_hazards();
    }
    assert!(s.combat.hazards[0].view.progress > 0.);
    assert_eq!(s.combat.hazards[1].view.progress, 0.);
    assert_eq!(s.combat.hazards[2].view.progress, 0.);
    assert_eq!(s.combat.hazards[3].view.progress, 0.);
}
#[test]
fn close_target_is_covered_and_far_target_uses_charge() {
    let mut s = fixture();
    s.combat.actors[0].view.pos = Vec2::new(480., 970.);
    assert!(s
        .combat
        .boss_attack_target(4, 0, crate::enmity::BossAttack::Stomp)
        .is_some());
    let first = s.combat.actors[4].view.radius + 40.;
    let max = first + 360. + 75.;
    s.combat.actors[0].view.pos = Vec2::new(480., 900. + max);
    assert!(s.combat.stomp_plan(4, 0).is_some());
    s.combat.actors[0].view.pos.y += 0.1;
    assert!(s.combat.stomp_plan(4, 0).is_none());
    assert!(s
        .combat
        .boss_attack_target(4, 0, crate::enmity::BossAttack::Stomp)
        .is_none());
}
#[test]
fn wall_truncates_at_first_crossing_and_requires_two_full_circles() {
    let mut s = fixture();
    s.combat.actors[4].view.pos = Vec2::new(480., 1100.);
    s.combat.actors[0].view.pos = Vec2::new(680., 1100.);
    let (p, n, _) = s.combat.stomp_plan(4, 0).unwrap();
    assert_eq!(n, 2);
    assert_eq!(p[0], Vec2::new(586., 1100.));
    assert_eq!(p[1], Vec2::new(706., 1100.));
    s.combat.actors[4].view.pos.x = 600.;
    s.combat.actors[0].view.pos.x = 750.;
    assert!(s.combat.stomp_plan(4, 0).is_none());
    assert!(s
        .combat
        .boss_attack_target(4, 0, crate::enmity::BossAttack::Stomp)
        .is_none());
}
#[test]
fn uncovered_pattern_never_spends_energy_on_a_stomp() {
    let mut s = fixture();
    for a in &mut s.combat.actors[..4] {
        a.view.pos = Vec2::new(480., 901.);
    }
    assert!(s.combat.stomp_plan(4, 0).is_some());
    assert!(!s.combat.stomp_covers(4, 0));
    assert!(s
        .combat
        .boss_attack_target(4, 0, crate::enmity::BossAttack::Stomp)
        .is_none());
    s.enemy_ai();
    assert!(!s
        .combat
        .hazards
        .iter()
        .any(|h| h.view.kind == HazardKind::BossStompStep));
}
#[test]
fn enrage_enlarges_each_radius_fill_damage_far_gate_and_wall_truncation() {
    let mut s = fixture();
    s.combat.actors[4].stats.atk = 100.;
    s.combat.actors[4].stats.mag = s.combat.actors[4].stats.atk;
    s.combat.spawn_marching_stomp(4, 0);
    let base = s.combat.hazards[0].clone();
    s.combat.hazards.clear();
    s.combat.actors[4].view.enraged = true;
    s.combat.actors[4].phase_rule = Some(BOSS_PHASE);
    s.combat.spawn_marching_stomp(4, 0);
    let h = &s.combat.hazards[0];
    assert_eq!(
        h.view.shape,
        Shape::Circle {
            radius: 75. * BOSS_PHASE.radius_scale
        }
    );
    close(base.duration, 75. / (SLAM_RADIUS / SLAM_LOCK));
    close(h.duration, base.duration * 1.5);
    close(base.base_damage, 60.);
    close(h.damage, base.damage * 1.5);
    s.combat.hazards.clear();
    s.combat.actors[4].view.pos = Vec2::new(530., 1100.);
    s.combat.actors[0].view.pos = Vec2::new(700., 1100.);
    assert!(s.combat.stomp_plan(4, 0).is_none());
    s.combat.actors[4].view.enraged = false;
    assert_eq!(s.combat.stomp_plan(4, 0).unwrap().1, 2);
    s.combat.actors[4].view.pos = Vec2::new(480., 900.);
    s.combat.actors[0].view.pos = Vec2::new(480., 1460.);
    assert!(s.combat.stomp_plan(4, 0).is_none());
    s.combat.actors[4].view.enraged = true;
    assert!(s.combat.stomp_plan(4, 0).is_some());
}
#[test]
fn circles_resolve_independently_in_order_with_no_linger() {
    let mut s = fixture();
    for k in 0..4 {
        s.combat.actors[k].view.pos = Vec2::new(480., 1006. + 120. * k as f32);
        s.combat.actors[k].stats.def = 0.;
        s.combat.actors[k].stats.res = s.combat.actors[k].stats.def;
    }
    s.combat.spawn_marching_stomp(4, 3);
    let ids: Vec<_> = s.combat.hazards.iter().map(|h| h.view.id).collect();
    s.combat.events.clear();
    let mut times = Vec::new();
    for step in 1..=60 {
        s.combat.update_hazards();
        s.resolve_hazards();
        for e in s.drain_events() {
            if let Event::HazardResolved { id, victims, .. } = e {
                let k = ids.iter().position(|&h| h == id).unwrap();
                assert_eq!(victims, vec![s.combat.actors[k].view.id]);
                times.push((k, step));
            }
        }
    }
    assert_eq!(times, vec![(0, 29), (1, 37), (2, 44), (3, 52)]);
    let hp: Vec<_> = s.combat.actors[..4].iter().map(|a| a.view.hp).collect();
    for _ in 0..20 {
        s.combat.update_hazards();
        s.resolve_hazards();
        assert!(s
            .drain_events()
            .iter()
            .all(|e| !matches!(e, Event::Hit { .. } | Event::HazardResolved { .. })));
    }
    assert_eq!(
        hp,
        s.combat.actors[..4]
            .iter()
            .map(|a| a.view.hp)
            .collect::<Vec<_>>()
    );
}
#[test]
fn started_stomp_finishes_after_target_leaves_and_hits_remaining_occupant() {
    for escape in [Vec2::new(200., 1006.), Vec2::new(480., 1550.)] {
        for occupied in [false, true] {
            let mut s = fixture();
            for a in &mut s.combat.actors[1..4] {
                a.view.pos.x = 800.;
            }
            start(&mut s);
            let ids: Vec<_> = s.combat.hazards.iter().map(|h| h.view.id).collect();
            let origins: Vec<_> = s.combat.hazards.iter().map(|h| h.view.origin).collect();
            if occupied {
                s.combat.actors[1].view.pos = origins[3];
            }
            let hp = [s.combat.actors[0].view.hp, s.combat.actors[1].view.hp];
            let mut resolved = Vec::new();
            s.combat.events.clear();
            for step in 1..=60 {
                if step == 10 {
                    s.combat.actors[0].view.pos = escape;
                }
                // Normal boss dispatch order; heroes stay planted to isolate circle contact.
                s.combat.timers();
                s.combat.update_hazards();
                s.combat.sync_boss_casts();
                s.enemy_ai();
                s.combat.actions();
                for h in &s.combat.hazards {
                    if let Some(k) = ids.iter().position(|&id| id == h.view.id) {
                        assert_eq!(h.view.origin, origins[k]);
                        if h.view.phase != HazardPhase::Resolved {
                            assert_eq!(
                                s.combat.actors[4].view.state,
                                ActorState::Cast,
                                "step {step}"
                            );
                            assert!(s.combat.actors[4].committed(), "step {step}");
                        }
                    }
                }
                s.resolve_hazards();
                for e in s.drain_events() {
                    assert!(!matches!(e, Event::HazardCancelled { id, .. } if ids.contains(&id)));
                    if let Event::HazardResolved { id, victims, .. } = e {
                        if let Some(k) = ids.iter().position(|&h| h == id) {
                            assert_eq!(
                                victims,
                                if occupied && k == 3 {
                                    vec![s.combat.actors[1].view.id]
                                } else {
                                    vec![]
                                }
                            );
                            resolved.push((k, step));
                        }
                    }
                }
            }
            assert_eq!(resolved, vec![(0, 29), (1, 37), (2, 44), (3, 52)]);
            assert_eq!(s.combat.actors[0].view.hp, hp[0]);
            assert_eq!(s.combat.actors[1].view.hp < hp[1], occupied);
        }
    }
}
#[test]
fn circle_hits_hero_feet_only_and_never_enemies() {
    let mut s = fixture();
    s.combat.actors[0].view.pos = Vec2::new(480. + 75.1, 1006.);
    s.combat.actors[1].view.pos = Vec2::new(480. + 74.9, 1006.);
    s.combat.actors[3].view.pos = Vec2::new(480., 1366.);
    let id = s.spawn_actor(Archetype::Orc, Vec2::new(480., 1006.));
    let enemy = s.combat.actor_index(id).unwrap();
    let hp = s.combat.actors[enemy].view.hp;
    s.combat.spawn_marching_stomp(4, 3);
    let first = s.combat.hazards[0].view.id;
    s.combat.hazards[0].phase_age = s.combat.hazards[0].duration;
    s.resolve_hazards();
    let victims = s
        .drain_events()
        .into_iter()
        .find_map(|e| match e {
            Event::HazardResolved { id, victims, .. } if id == first => Some(victims),
            _ => None,
        })
        .unwrap();
    assert_eq!(victims, vec![s.combat.actors[1].view.id]);
    assert_eq!(s.combat.actors[enemy].view.hp, hp);
}
#[test]
fn pushed_troll_cancels_whole_pattern_refunds_and_recasts_while_resist_preserves_it() {
    for resist in [true, false] {
        let mut s = fixture();
        start(&mut s);
        let ids: Vec<_> = s.combat.hazards.iter().map(|h| h.view.id).collect();
        let pos = s.combat.actors[4].view.pos;
        s.combat.actors[4].push_rng = Rng(pushed_seed(resist));
        s.combat.events.clear();
        s.combat.hero_push(4, Vec2::new(1., 0.), 20.);
        let es = s.drain_events();
        if resist {
            assert_eq!(s.combat.actors[4].view.pos, pos);
            assert_eq!(s.combat.hazards.iter().filter(|h| h.cancelled).count(), 0);
            assert_eq!(s.combat.actors[4].view.energy, 0.);
        } else {
            assert_ne!(s.combat.actors[4].view.pos, pos);
            assert_eq!(
                es.iter()
                    .filter(|e| matches!(e,Event::HazardCancelled{id,..}if ids.contains(id)))
                    .count(),
                4
            );
            assert!(!es.iter().any(|e| matches!(e, Event::HazardResolved { .. })));
            assert_eq!(s.combat.actors[4].serial, 0);
            assert_eq!(s.combat.actors[4].view.energy, 1.);
            s.enemy_ai();
            let live: Vec<_> = s
                .combat
                .hazards
                .iter()
                .filter(|h| h.view.phase != HazardPhase::Resolved)
                .collect();
            assert_eq!(live.len(), 4);
            let origin = s.combat.actors[4].view.pos;
            for (k, h) in live.iter().enumerate() {
                assert_eq!(
                    h.view.origin,
                    origin + h.view.dir * (s.combat.actors[4].view.radius + 40. + 120. * k as f32)
                );
                close(h.phase_age, -0.25 * k as f32);
            }
        }
    }
}
#[test]
fn partial_resolution_push_cancels_only_remaining_circles_and_aim_stays_locked() {
    let mut s = fixture();
    start(&mut s);
    let origins: Vec<_> = s.combat.hazards.iter().map(|h| h.view.origin).collect();
    s.combat.actors[0].view.pos.x += 100.;
    s.combat.actors[4].view.pos.x += 10.;
    s.combat.sync_boss_anchors();
    assert_eq!(
        origins,
        s.combat
            .hazards
            .iter()
            .map(|h| h.view.origin)
            .collect::<Vec<_>>()
    );
    for h in &mut s.combat.hazards[..2] {
        h.phase_age = h.duration;
    }
    s.resolve_hazards();
    s.drain_events();
    s.combat.actors[4].push_rng = Rng(pushed_seed(false));
    s.combat.hero_push(4, Vec2::new(1., 0.), 20.);
    assert_eq!(
        s.drain_events()
            .iter()
            .filter(|e| matches!(e, Event::HazardCancelled { .. }))
            .count(),
        2
    );
}
#[test]
fn marching_patterns_freeze_during_spotlight_and_steps_are_deterministic_zero_alloc() {
    let mut s = fixture();
    s.combat.cfg.spotlight = SpotlightConfig {
        global_gap: 0.,
        hero_gap: 0.,
        fairness: 0.,
        auto_release: false,
        tail_cap: 2.,
        ..SpotlightConfig::DEFAULT
    };
    s.combat.start_arcane_pulse(3, s.combat.actors[4].view.id);
    s.combat.select_spotlight();
    // Inject the pattern into an existing window; new admission during a march is forbidden.
    start(&mut s);
    let frozen: Vec<_> = s
        .combat
        .hazards
        .iter()
        .filter(|h| h.view.kind == HazardKind::BossStompStep)
        .map(|h| format!("{h:?}"))
        .collect();
    for _ in 0..150 {
        s.step();
        s.drain_events();
        if s.combat
            .spotlight
            .active
            .as_ref()
            .is_some_and(|a| a.phase == SpotlightPhase::Tail)
        {
            break;
        }
    }
    assert_eq!(
        s.combat.spotlight.active.as_ref().unwrap().phase,
        SpotlightPhase::Tail
    );
    for _ in 0..10 {
        s.step();
        s.drain_events();
    }
    assert_eq!(
        frozen,
        s.combat
            .hazards
            .iter()
            .filter(|h| h.view.kind == HazardKind::BossStompStep)
            .map(|h| format!("{h:?}"))
            .collect::<Vec<_>>()
    );
    for spotlight in [
        SpotlightConfig::OFF,
        SpotlightConfig {
            auto_release: true,
            ..SpotlightConfig::DEFAULT
        },
    ] {
        let cfg = SimConfig {
            seed: 7,
            spotlight,
            ..Default::default()
        };
        let mut a = Sim::new(cfg.clone());
        let mut b = Sim::new(cfg);
        for _ in 0..5400 {
            ALLOCATIONS.with(|n| n.set(Some(0)));
            a.step();
            let n = ALLOCATIONS.with(|n| n.replace(None));
            assert_eq!(n, Some(0));
            b.step();
            assert_eq!(a.state_hash(), b.state_hash());
            a.drain_events();
            b.drain_events();
        }
    }
}

#[test]
fn chimera_never_summons_and_troll_djinn_summons_remain_authored() {
    for kind in [
        Archetype::Boss,
        Archetype::BossBomber,
        Archetype::BossMarksman,
    ] {
        let mut s = fixture();
        s.combat.actors[4].view.archetype = kind;
        s.combat.actors[4].view.energy = 0.;
        for _ in 0..20 {
            s.combat.actors[4].summon_cd = 0.;
            s.enemy_ai();
            if kind == Archetype::BossBomber {
                assert_eq!(s.combat.actors.len(), 5);
                assert!(!s.drain_events().iter().any(|e| matches!(
                    e,
                    Event::Spawned {
                        archetype: Archetype::Gobloc | Archetype::Sniper | Archetype::Lizardo,
                        ..
                    }
                )));
            } else {
                let summoned: Vec<_> = s.combat.actors[5..]
                    .iter()
                    .map(|a| a.view.archetype)
                    .collect();
                if kind == Archetype::Boss {
                    assert_eq!(summoned, vec![Archetype::Gobloc; SUMMON_COUNT as usize]);
                } else {
                    assert_eq!(
                        summoned,
                        vec![Archetype::Sniper; MARKSMAN_SUMMON_SNIPERS as usize]
                    );
                }
                break;
            }
        }
    }
}
