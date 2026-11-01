use crate::{tuning::*, *};

fn fixture(kinds: &[Archetype]) -> Sim {
    let mut s = Sim::composition_trial(SimConfig::default(), kinds);
    s.combat.hazards.clear();
    for (i, a) in s.combat.actors.iter_mut().enumerate() {
        a.view.pos = Vec2::new(480., 1100. + i as f32 * 10.);
        a.view.state = ActorState::Idle;
        a.formed_age = 10.;
        a.summon_cd = 100.;
        a.basic_cd = 0.;
        a.pound_cd = 100.; // Isolate Ward/Taunt utility contracts from the new attack.
        a.pulse_cd = 100.;
    }
    s
}

#[test]
fn crimson_ward_is_retired_from_fara_kit() {
    let mut s = fixture(&[Archetype::Orc]);
    s.combat.actors[0].view.meter = 1.;
    s.combat
        .start_action(0, Some(s.combat.actors[4].view.id), true, false);
    assert_eq!(s.combat.actors[0].view.meter, 1.);
    assert_eq!(s.combat.actors[0].view.ward, 0.);
    assert_ne!(s.combat.actors[0].view.state, ActorState::Cast);
}

#[test]
fn taunt_lists_exact_radius_living_targets_refreshes_and_expires() {
    let mut s = fixture(&[
        Archetype::Gobloc,
        Archetype::Boss,
        Archetype::Sniper,
        Archetype::Orc,
        Archetype::Lizardo,
    ]);
    let pos = s.combat.actors[0].view.pos;
    s.combat.actors[4].view.pos = pos + Vec2::new(TAUNT_RADIUS, 0.);
    s.combat.actors[6].view.pos = pos + Vec2::new(TAUNT_RADIUS + 0.1, 0.);
    s.combat.actors[7].view.hp = 0.;
    // Hondo is closer to every enemy than Fara.
    s.combat.actors[1].view.pos = pos + Vec2::new(20., 50.);
    s.combat.taunt(0);
    assert_eq!(
        s.drain_events()
            .iter()
            .find_map(|e| {
                if let Event::Taunt {
                    hero,
                    radius,
                    enemies,
                    seconds,
                } = e
                {
                    assert_eq!(
                        (*hero, *radius, *seconds),
                        (1, TAUNT_RADIUS, TAUNT_DURATION)
                    );
                    Some(enemies.clone())
                } else {
                    None
                }
            })
            .unwrap(),
        vec![
            s.combat.actors[4].view.id,
            s.combat.actors[5].view.id,
            s.combat.actors[8].view.id
        ]
    );
    for i in [4, 5, 8] {
        assert_eq!(s.combat.enemy_target(i), Some(0));
    }
    assert_eq!(s.combat.actors[6].taunted_by, None);
    for _ in 0..60 {
        s.combat.timers();
    }
    s.combat.taunt(0);
    for _ in 0..(TAUNT_DURATION * 30.) as usize - 1 {
        s.combat.timers();
    }
    assert_eq!(s.combat.taunt_target(5), Some(0));
    s.combat.timers();
    assert_eq!(s.combat.taunt_target(5), None);
    assert_eq!(
        s.combat.enemy_target(5),
        Some(0),
        "boss retains Fara on enmity after forced targeting expires"
    );
    assert_eq!(
        s.combat.enemy_target(4),
        Some(1),
        "ordinary enemies return to proximity"
    );
}

#[test]
fn taunt_ends_on_death_and_does_not_return_on_revive() {
    let mut s = fixture(&[Archetype::Boss]);
    s.combat.taunt(0);
    s.combat.actors[0].view.hp = 0.;
    assert_eq!(s.combat.taunt_target(4), None);
    s.deaths();
    s.combat.actors[0].view.hp = 420.;
    s.combat.actors[0].view.state = ActorState::Idle;
    assert_eq!(s.combat.actors[4].taunted_by, None);
    assert_eq!(s.combat.taunt_target(4), None);
}

#[test]
fn taunted_telegraphs_use_fara_including_barrage_and_close_when_uncoverable() {
    for kind in [
        Archetype::Boss,
        Archetype::BossBomber,
        Archetype::BossMarksman,
        Archetype::Sniper,
        Archetype::Lizardo,
        Archetype::Fizzmite,
    ] {
        let mut s = fixture(&[kind]);
        s.combat.actors[4].view.pos = s.combat.actors[0].view.pos + Vec2::new(0., -50.);
        s.combat.actors[4].recharge_left = -SIM_DT;
        if kind == Archetype::BossBomber {
            s.combat.actors[4].boss_attack = crate::enmity::BossAttack::Targeted;
            s.combat.actors[4].boss_retry_special = true;
            // Isolate the aimed barrage from the authored two-melee-hero Fortress override.
            for (n, a) in s.combat.actors[1..4].iter_mut().enumerate() {
                a.view.pos = Vec2::new(480., ARENA_MIN.y + 100. + n as f32 * 100.);
            }
        }
        s.combat.taunt(0);
        s.enemy_ai();
        if kind == Archetype::Lizardo {
            assert!(s.combat.hazards.is_empty());
            s.combat.actors[4].view.state_age = LIZARDO_WINDUP;
            s.combat.action(4);
        }
        let hostile: Vec<_> = s.combat.hazards.iter().filter(|h| h.view.hostile).collect();
        assert!(!hostile.is_empty(), "{kind:?}");
        if kind == Archetype::BossBomber {
            assert_eq!(hostile.iter().filter(|h| h.target == Some(1)).count(), 3);
            assert_eq!(hostile.iter().filter(|h| h.target.is_none()).count(), 1);
        } else {
            assert!(hostile.iter().all(|h| h.target == Some(1)), "{kind:?}");
        }
        assert_eq!(s.combat.actors[4].target, Some(1));
    }
    let mut s = fixture(&[Archetype::Boss]);
    s.combat.actors[4].boss_attack = crate::enmity::BossAttack::Stomp;
    s.combat.actors[4].boss_retry_special = true; // The forward march covers Fara despite another closer hero.
    s.combat.actors[4].view.pos = s.combat.actors[0].view.pos + Vec2::new(0., -170.);
    s.combat.actors[1].view.pos = s.combat.actors[4].view.pos + Vec2::new(25., 0.);
    s.combat.actors[4].recharge_left = -SIM_DT;
    s.combat.taunt(0);
    let before = s.combat.actors[4]
        .view
        .pos
        .distance(s.combat.actors[0].view.pos);
    s.enemy_ai();
    assert_eq!(s.combat.hazards.len(), 4);
    assert!(s.combat.hazards.iter().all(|h| h.target == Some(1)));
    assert!(s
        .combat
        .hazards
        .iter()
        .any(|h| h.hits(s.combat.actors[0].view.pos, 0.)));
    assert_eq!(
        s.combat.actors[4]
            .view
            .pos
            .distance(s.combat.actors[0].view.pos),
        before
    );
    assert_eq!(s.combat.actors[4].view.energy, 0.);
}

#[test]
fn fara_basic_still_works_without_rage_and_one_stock_selects_pound() {
    let mut s = fixture(&[Archetype::Orc, Archetype::Orc]);
    s.combat.actors[0].target = Some(s.combat.actors[4].view.id);
    s.combat.actors[0].view.ai_intent = AiIntent::Attack;
    s.combat.actors[0].ai_cd = 100.;
    s.hero_ai();
    assert_eq!(s.combat.actors[0].view.state, ActorState::Basic);
    s.combat.actors[0].view.state_age = BASIC_DURATION;
    s.combat.actors[0].action_done = true;
    s.combat.actors[0].view.meter = 1.;
    s.combat.actors[2].view.pos.y += 400.;
    s.combat.actors[3].view.pos.y += 400.;
    s.hero_ai();
    assert!(s.combat.actors[0].action_pound);
    assert_eq!(s.combat.actors[0].view.meter, 0.);
}

#[test]
fn taunt_redirects_committed_basics_and_preserves_locked_aim() {
    let mut s = fixture(&[Archetype::Orc, Archetype::Sniper]);
    s.combat.actors[4].view.pos = s.combat.actors[0].view.pos + Vec2::new(60., 0.);
    let hondo = s.combat.actors[1].view.id;
    s.combat.start_action(4, Some(hondo), false, false);
    let origin = s.combat.actors[5].view.pos;
    s.hazard(
        HazardKind::SniperLine,
        s.combat.actors[5].view.id,
        Some(hondo),
        origin,
        Vec2::new(1., 0.),
    );
    s.hazard(
        HazardKind::SniperLine,
        s.combat.actors[5].view.id,
        Some(hondo),
        origin,
        Vec2::new(1., 0.),
    );
    s.combat.hazards[1].view.phase = HazardPhase::Locked;
    let locked = s.combat.hazards[1].view.dir;
    s.combat.taunt(0);
    assert_eq!(s.combat.hazards[0].target, Some(1));
    assert_eq!(s.combat.hazards[1].target, Some(hondo));
    assert_eq!(s.combat.hazards[1].view.dir, locked);
    s.combat.actors[4].view.state_age = BASIC_IMPACT;
    s.combat.actors[0].stats.evade = 0.;
    s.drain_events();
    s.combat.actions();
    let hits: Vec<_> = s
        .drain_events()
        .into_iter()
        .filter_map(|e| {
            if let Event::Hit { target, .. } = e {
                Some(target)
            } else {
                None
            }
        })
        .collect();
    assert_eq!(hits, vec![1]);
}

#[test]
fn ward_requires_detection_range_and_taunt_state_is_hashed() {
    let mut s = fixture(&[Archetype::Orc]);
    s.combat.actors[4].view.pos = s.combat.actors[0].view.pos + Vec2::new(0., -600.);
    s.combat.actors[0].special_cd = 0.;
    s.combat.actors[0].extra_cd = 0.;
    s.hero_ai();
    assert_ne!(s.combat.actors[0].view.state, ActorState::Cast);
    let before = s.state_hash();
    s.combat.actors[4].taunted_by = Some(1);
    assert_ne!(s.state_hash(), before);
    let before = s.state_hash();
    s.combat.actors[4].taunt_left = 4.;
    assert_ne!(s.state_hash(), before);
}

#[test]
fn taunt_source_down_clears_every_enemy_in_the_damage_step_and_stays_gone_after_revive() {
    let mut s = fixture(&[Archetype::Orc, Archetype::Gobloc, Archetype::Sniper]);
    for a in &mut s.combat.actors {
        a.basic_cd = 100.;
        a.extra_cd = 100.;
        a.special_cd = 100.;
        a.view.meter = 0.;
    }
    let source = s.combat.actors[0].view.id;
    s.combat.taunt(0);
    s.refresh_snapshot();
    assert!(s.snapshot().actors[4..]
        .iter()
        .all(|a| a.taunted_by == Some(source)));
    s.combat.actors[0].view.hp = 0.01;
    s.combat.actors[0].view.ward = 0.;
    s.combat.actors[0].stats.evade = 0.;
    s.combat.start_action(4, Some(source), false, false);
    s.combat.actors[4].view.state_age = s.combat.actors[4].view.impact_at - SIM_DT * 0.5;
    s.step();
    assert_eq!(s.combat.actors[0].view.state, ActorState::Downed);
    for i in 4..s.combat.actors.len() {
        assert_eq!(s.combat.actors[i].taunted_by, None);
        assert_eq!(s.combat.actors[i].taunt_left, 0.);
        assert_ne!(s.combat.enemy_target(i), Some(0));
        assert!(s.combat.enemy_target(i).is_some());
    }
    assert!(s.snapshot().actors[4..]
        .iter()
        .all(|a| a.taunted_by.is_none()));
    while s.combat.hit_stop_steps > 0 {
        s.step();
    }
    s.step();
    for a in &s.combat.actors[5..] {
        assert!(a.target.is_some());
        assert_ne!(a.target, Some(source));
    }
    // The lethal attacker finishes its authored recovery before normal AI runs again.
    for _ in 0..SIM_HZ {
        s.step();
    }
    assert!(s.combat.actors[4..]
        .iter()
        .all(|a| a.target.is_some() && a.target != Some(source)));
    s.combat.revive_hero(0);
    s.refresh_snapshot();
    assert!(s.combat.actors[0].alive());
    assert!(s.combat.actors[4..]
        .iter()
        .all(|a| a.taunted_by.is_none() && a.taunt_left == 0.));
    assert!(s.snapshot().actors[4..]
        .iter()
        .all(|a| a.taunted_by.is_none()));
    s.combat.taunt(0);
    s.refresh_snapshot();
    assert!(s.snapshot().actors[4..]
        .iter()
        .all(|a| a.taunted_by == Some(source)));
}

#[test]
fn taunt_validity_uses_source_state_and_presence_for_any_archetype() {
    for source in [0, 1, 2, 3] {
        for loss in 0..4 {
            let mut s = fixture(&[Archetype::Orc, Archetype::Gobloc]);
            let id = s.combat.actors[source].view.id;
            let enemies: Vec<_> = s.combat.actors[4..].iter().map(|a| a.view.id).collect();
            s.combat.taunt(source);
            match loss {
                0 => s.combat.actors[source].view.hp = 0.,
                1 => s.combat.actors[source].view.state = ActorState::Downed,
                2 => s.combat.actors[source].view.state = ActorState::Dead,
                _ => {
                    s.combat.actors.remove(source);
                }
            }
            s.step();
            for enemy in enemies {
                let i = s.combat.actor_index(enemy).unwrap();
                assert_eq!(
                    s.combat.actors[i].taunted_by, None,
                    "source {id}, loss {loss}"
                );
                assert_eq!(s.combat.actors[i].taunt_left, 0.);
                assert!(s.combat.enemy_target(i).is_some());
            }
        }
    }
}

#[test]
fn living_source_taunt_snapshot_lasts_every_authored_combat_step() {
    let mut s = fixture(&[Archetype::Orc, Archetype::Gobloc]);
    let source = s.combat.actors[0].view.id;
    s.combat.taunt(0);
    for _ in 0..(TAUNT_DURATION * SIM_HZ as f32) as usize - 1 {
        s.combat.timers();
        s.deaths();
        s.refresh_snapshot();
        assert!(s.snapshot().actors[4..]
            .iter()
            .all(|a| a.taunted_by == Some(source)));
    }
    s.combat.timers();
    s.deaths();
    s.refresh_snapshot();
    assert!(s.snapshot().actors[4..]
        .iter()
        .all(|a| a.taunted_by.is_none()));
}

#[test]
fn taunt_source_down_preserves_a_committed_boss_move() {
    let mut s = fixture(&[Archetype::Boss]);
    let source = s.combat.actors[0].view.id;
    s.combat.taunt(0);
    s.hazard(
        HazardKind::BossSlam,
        s.combat.actors[4].view.id,
        Some(source),
        s.combat.actors[4].view.pos,
        Vec2::new(0., 1.),
    );
    s.combat.actors[4].state(ActorState::Cast, SLAM_LOCK, 0.);
    s.combat.actors[4].action_done = true;
    let warnings: Vec<_> = s
        .combat
        .hazards
        .iter()
        .map(|h| (h.view.id, h.view.origin, h.view.dir))
        .collect();
    assert!(!warnings.is_empty());
    s.combat.actors[0].view.hp = 0.;
    s.deaths();
    assert_eq!(s.combat.actors[4].taunted_by, None);
    assert!(s.combat.actors[4].committed());
    assert_eq!(s.combat.actors[4].target, Some(source));
    assert_eq!(
        warnings,
        s.combat
            .hazards
            .iter()
            .map(|h| (h.view.id, h.view.origin, h.view.dir))
            .collect::<Vec<_>>()
    );
    for _ in 0..300 {
        s.combat.timers();
        s.combat.update_hazards();
        s.combat.sync_boss_casts();
        s.resolve_hazards();
    }
    let events = s.drain_events();
    for (id, _, _) in warnings {
        assert!(events
            .iter()
            .any(|e| matches!(e, Event::HazardResolved { id: h, .. } if *h == id)));
        assert!(!events
            .iter()
            .any(|e| matches!(e, Event::HazardCancelled { id: h, .. } if *h == id)));
    }
    s.enemy_ai();
    assert_ne!(s.combat.actors[4].target, Some(source));
}
