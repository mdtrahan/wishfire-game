use crate::{tuning::*, *};

fn fixture(boss: Archetype) -> Sim {
    let mut s = Sim::composition_trial(SimConfig::default(), &[boss]);
    s.combat.hazards.clear();
    s.combat.projectiles.clear();
    for (i, a) in s.combat.actors.iter_mut().enumerate() {
        a.view.pos = Vec2::new(
            480.,
            if i == 4 {
                900.
            } else {
                1000. + 150. * i as f32
            },
        );
        a.destination = a.view.pos;
        a.state(ActorState::Idle, 0., 0.);
        a.stats.evade = 0.;
        a.view.hp = 100000.;
        a.view.max_hp = 100000.;
        a.basic_cd = 1000.;
        a.special_cd = 1000.;
        a.extra_cd = 1000.;
        a.pulse_cd = 1000.;
        a.pound_cd = 1000.;
        a.mend_cd = 1000.;
        a.summon_cd = 1000.;
    }
    s.combat.events.clear();
    s
}
fn cast(s: &mut Sim, kind: HazardKind) -> u32 {
    s.hazard(
        kind,
        s.combat.actors[4].view.id,
        Some(s.combat.actors[0].view.id),
        s.combat.actors[4].view.pos,
        Vec2::new(0., 1.),
    )
}
fn tick(s: &mut Sim) {
    s.combat.timers();
    s.combat.update_hazards();
    s.combat.sync_boss_casts();
    s.combat.move_projectiles();
    s.resolve_hazards();
    s.combat.prune_bombs();
}
fn release(s: &mut Sim) {
    s.combat.actors[4].view.state_age = s.combat.actors[4].view.impact_at;
    s.combat.action(4);
}

#[test]
fn committed_boss_warnings_complete_after_target_dies_or_leaves() {
    for kind in [
        HazardKind::BossSlam,
        HazardKind::BossStompStep,
        HazardKind::BossNova,
        HazardKind::BossCone,
        HazardKind::BossSnipe,
        HazardKind::LizardoDrop,
    ] {
        for dead in [false, true] {
            let mut s = fixture(Archetype::BossMarksman);
            let id = cast(&mut s, kind);
            if dead {
                s.combat.actors[0].view.hp = 0.;
                s.combat.actors[0].state(ActorState::Downed, 0., 0.);
            } else {
                s.combat.actors[0].view.pos = Vec2::new(200., ARENA_MAX.y - 100.);
            }
            for _ in 0..600 {
                tick(&mut s);
            }
            let events = s.drain_events();
            assert!(
                events
                    .iter()
                    .any(|e| matches!(e, Event::HazardResolved{id:h,..} if *h==id)),
                "{kind:?} dead={dead}"
            );
            assert!(!events
                .iter()
                .any(|e| matches!(e, Event::HazardCancelled{id:h,..} if *h==id)));
        }
    }
}

#[test]
fn charge_keeps_last_complete_lane_budget_and_aim_after_target_loss() {
    for remove in [false, true] {
        let mut s = fixture(Archetype::Boss);
        s.combat.actors[0].view.pos.y = 1200.;
        cast(&mut s, HazardKind::BossCharge);
        s.combat.update_hazards();
        s.combat.actors[0].view.pos = Vec2::new(600., 1350.);
        s.combat.update_hazards(); // living-target tracking is retained
        let h = s.combat.hazards[0].clone();
        if remove {
            s.combat.actors.remove(0);
        } else {
            s.combat.actors[0].view.hp = 0.;
            s.combat.actors[0].view.pos = Vec2::new(200., 200.);
        }
        s.combat.update_hazards();
        let next = &s.combat.hazards[0];
        assert_eq!(next.view.origin, h.view.origin);
        assert_eq!(next.view.dir, h.view.dir);
        assert_eq!(next.view.shape, h.view.shape);
        assert_eq!((next.duration, next.damage), (h.duration, h.damage));
        assert!(next.phase_age > h.phase_age);
        for _ in 0..600 {
            tick(&mut s);
        }
        assert!(s.drain_events().iter().any(|e| matches!(
            e,
            Event::HazardResolved {
                kind: HazardKind::BossCharge,
                ..
            }
        )));
    }
}

#[test]
fn cast_pose_tracks_warning_without_changing_its_clock_or_budget() {
    let mut s = fixture(Archetype::BossMarksman);
    cast(&mut s, HazardKind::BossSnipe);
    s.combat.actors[4].state(ActorState::Cast, 0.01, 0.01);
    s.combat.actors[4].action_done = true;
    let damage = s.combat.hazards[0].damage;
    let mut warning_steps = 0;
    for _ in 0..300 {
        tick(&mut s);
        if let Some(left) =
            crate::boss_commit::warning_left(&s.combat.hazards, s.combat.actors[4].view.id)
        {
            warning_steps += 1;
            let a = &s.combat.actors[4].view;
            assert_eq!(a.state, ActorState::Cast);
            assert!((a.state_duration - a.state_age - left).abs() < 0.0001);
            assert_eq!(s.combat.hazards[0].damage, damage);
        } else {
            break;
        }
    }
    assert!(warning_steps > 30);
    s.combat.timers();
    assert_eq!(s.combat.actors[4].view.state, ActorState::Idle);
}

#[test]
fn melee_swing_locks_target_and_aim_across_taunt_and_prefers_locked_victim() {
    let mut s = fixture(Archetype::Boss);
    s.combat.actors[1].view.pos = Vec2::new(480., 1010.);
    let target = s.combat.actors[1].view.id;
    s.combat.start_action(4, Some(target), false, false);
    s.combat.taunt(0);
    assert_eq!(s.combat.actors[4].target, Some(target));
    assert!(s.combat.actors[4].action_aim.distance(Vec2::new(0., 1.)) < 0.00001);
    let hp = [s.combat.actors[0].view.hp, s.combat.actors[1].view.hp];
    release(&mut s);
    assert_eq!(s.combat.actors[0].view.hp, hp[0]);
    assert!(s.combat.actors[1].view.hp < hp[1]);
}

#[test]
fn melee_swing_uses_nearest_in_arc_fallback_then_can_miss() {
    for fallback in [false, true] {
        let mut s = fixture(Archetype::Boss);
        s.combat
            .start_action(4, Some(s.combat.actors[0].view.id), false, false);
        s.combat.actors[0].view.hp = 0.;
        s.combat.actors[1].view.pos = Vec2::new(if fallback { 480. } else { 700. }, 1000.);
        s.combat.actors[2].view.pos = Vec2::new(480., 1040.);
        if !fallback {
            s.combat.actors[2].view.pos.x = 200.;
        }
        let hp = [s.combat.actors[1].view.hp, s.combat.actors[2].view.hp];
        release(&mut s);
        assert_eq!(s.combat.actors[1].view.hp < hp[0], fallback);
        assert_eq!(s.combat.actors[2].view.hp, hp[1]);
        assert!(s.combat.actors[4].action_done);
    }
}

#[test]
fn ranged_basic_releases_at_fixed_aim_after_target_death() {
    let mut s = fixture(Archetype::BossMarksman);
    s.combat.actors[4].stats.reach = 500.;
    s.combat
        .start_action(4, Some(s.combat.actors[0].view.id), false, false);
    s.combat.actors[0].view.hp = 0.;
    s.combat.actors[0].view.pos = Vec2::new(200., 200.);
    release(&mut s);
    assert_eq!(s.combat.projectiles.len(), 1);
    assert_eq!(s.combat.projectiles[0].view.dir, Vec2::new(0., 1.));
}

#[test]
fn boss_death_cancels_warnings_fronts_and_owned_projectiles_without_stagger() {
    let mut s = fixture(Archetype::BossMarksman);
    for kind in [
        HazardKind::BossSlam,
        HazardKind::BossStompStep,
        HazardKind::BossNova,
        HazardKind::BossCone,
        HazardKind::BossCharge,
        HazardKind::BossSnipe,
        HazardKind::LizardoDrop,
    ] {
        cast(&mut s, kind);
    }
    let count = s.combat.hazards.len();
    s.combat.hazards[5].view.phase = HazardPhase::Active;
    s.combat.projectile(
        4,
        Some(s.combat.actors[0].view.id),
        s.combat.actors[0].view.pos,
        false,
        99999.,
        None,
    );
    s.combat
        .projectile(1, None, s.combat.actors[4].view.pos, false, 1., None);
    s.combat.actors[4].view.hp = 0.;
    let pos = s.combat.actors[4].view.pos;
    s.combat.hero_push(4, Vec2::new(1., 0.), 35.); // a lethal hero hit never staggers the corpse
    s.deaths();
    s.resolve_hazards();
    assert_eq!(s.combat.projectiles.len(), 1);
    assert_eq!(s.combat.projectiles[0].source, s.combat.actors[1].view.id);
    assert!(s.combat.hazards.is_empty());
    assert_eq!(s.combat.actors[4].view.pos, pos);
    let events = s.drain_events();
    assert_eq!(
        events
            .iter()
            .filter(|e| matches!(e, Event::HazardCancelled { .. }))
            .count(),
        count
    );
    assert!(!events.iter().any(|e| matches!(
        e,
        Event::HazardResolved { .. }
            | Event::BossStaggered { .. }
            | Event::KnockbackResisted { .. }
    )));
}

#[test]
fn accepted_barrage_keeps_all_four_bombs_after_every_hero_leaves() {
    let mut s = fixture(Archetype::BossBomber);
    s.combat.actors[4].view.energy = 1.;
    s.combat.actors[4].enemy_phase = 0;
    s.combat.actors[4].recharge_left = -SIM_DT;
    s.combat.actors[4].enmity = [100., 0., 0., 0.];
    s.combat.actors[4].aggro_target = Some(s.combat.actors[0].view.id);
    s.combat.actors[4].boss_attack = crate::enmity::BossAttack::Targeted;
    s.combat.actors[4].boss_retry_special = true;
    s.enemy_ai();
    let ids: Vec<_> = s
        .combat
        .hazards
        .iter()
        .filter(|h| h.view.kind == HazardKind::LizardoDrop)
        .map(|h| h.view.id)
        .collect();
    assert_eq!(ids.len(), 4);
    for a in &mut s.combat.actors[..4] {
        a.view.pos = Vec2::new(200., ARENA_MAX.y - 100.);
    }
    for _ in 0..300 {
        tick(&mut s);
    }
    let events = s.drain_events();
    for id in ids {
        assert!(events
            .iter()
            .any(|e| matches!(e, Event::HazardResolved{id:h,..} if *h==id)));
    }
}
