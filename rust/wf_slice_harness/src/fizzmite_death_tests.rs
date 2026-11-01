use crate::{tuning::*, *};

fn fixture() -> Sim {
    let mut s = Sim::composition_trial(SimConfig::default(), &[Archetype::Fizzmite]);
    s.combat.hazards.clear();
    s.combat.projectiles.clear();
    let positions = [
        Vec2::new(480., 1200.),
        Vec2::new(689., 1100.),
        Vec2::new(480., 1311.),
        Vec2::new(480., 1600.),
        Vec2::new(480., 1100.),
    ];
    for (a, pos) in s.combat.actors.iter_mut().zip(positions) {
        a.view.pos = pos;
        a.destination = pos;
        a.state(ActorState::Idle, 0., 0.);
        a.stats.evade = 0.;
        a.view.hp = 100000.;
        a.view.max_hp = 100000.;
    }
    s.combat.actors[4].target = Some(s.combat.actors[0].view.id);
    s.combat.events.clear();
    s
}

// The production hazard/death order, with stationary victims to measure exact contacts.
fn tick(s: &mut Sim) {
    s.combat.actors.retain(|a| a.view.state != ActorState::Dead);
    s.deaths();
    s.combat.enemy_statuses();
    s.combat.bubble_aura();
    // Suppress Fara breather healing while measuring blast-only HP changes.
    for a in &mut s.combat.actors {
        a.undamaged = 0.;
    }
    s.combat.timers();
    s.combat.update_hazards();
    s.resolve_hazards();
    s.deaths();
}

fn blast(s: &Sim) -> &hazards::Hazard {
    assert_eq!(s.combat.hazards.len(), 1);
    let h = &s.combat.hazards[0];
    assert_eq!(h.view.kind, HazardKind::FizzmiteBlast);
    assert_eq!(
        h.view.shape,
        Shape::Circle {
            radius: FIZZMITE_RADIUS
        }
    );
    assert_eq!(h.view.phase, HazardPhase::Locked);
    assert_eq!(h.view.fill, FillMode::Countdown);
    assert!((h.duration - FIZZMITE_COUNTDOWN).abs() < 0.00001);
    assert!((h.damage - s.combat.actors[4].stats.atk * 3.).abs() < 0.00001);
    h
}

fn arm(s: &mut Sim) -> u32 {
    s.combat.actors[0].view.pos = Vec2::new(480., 1140.);
    s.enemy_ai();
    blast(s).view.id
}

fn assert_one_resolution(s: &mut Sim, owner: u32, id: u32) {
    assert_eq!(s.combat.hazards.len(), 1);
    assert_eq!(s.combat.hazards[0].view.id, id);
    assert_eq!(s.combat.hazards[0].view.phase, HazardPhase::Resolved);
    let hp: Vec<_> = s.combat.actors.iter().take(4).map(|a| a.view.hp).collect();
    // Include pruning and more than another full fuse, catching delayed/rearmed blasts.
    for _ in 0..200 {
        tick(s);
    }
    assert!(s.combat.hazards.is_empty());
    assert_eq!(
        hp,
        s.combat
            .actors
            .iter()
            .take(4)
            .map(|a| a.view.hp)
            .collect::<Vec<_>>()
    );
    let events = s.drain_events();
    let resolved: Vec<_> = events
        .iter()
        .filter_map(|e| match e {
            Event::HazardResolved {
                id,
                kind: HazardKind::FizzmiteBlast,
                victims,
            } => Some((*id, victims)),
            _ => None,
        })
        .collect();
    assert_eq!(resolved.len(), 1);
    assert_eq!(resolved[0].0, id);
    assert_eq!(
        resolved[0].1,
        &vec![s.combat.actors[0].view.id, s.combat.actors[1].view.id]
    );
    assert_eq!(
        events
            .iter()
            .filter(|e| matches!(
                e,
                Event::HazardSpawned {
                    kind: HazardKind::FizzmiteBlast,
                    ..
                }
            ))
            .count(),
        1
    );
    assert!(!events
        .iter()
        .any(|e| matches!(e, Event::HazardCancelled { .. })));
    for (i, hero) in s.combat.actors.iter().take(4).enumerate() {
        let hits: Vec<_> = events
            .iter()
            .filter_map(|e| match e {
                Event::Hit {
                    source,
                    target,
                    amount,
                    ..
                } if *source == owner && *target == hero.view.id => Some(*amount),
                _ => None,
            })
            .collect();
        // Normal Fizzmite circles have one contact; Ground Pound's burst double-contact stays unchanged.
        assert_eq!(hits.len(), usize::from(i < 2));
        assert!((100000. - hero.view.hp - hits.iter().sum::<f32>()).abs() < 0.02);
    }
}

#[test]
fn walking_death_starts_full_fuse_at_death_position() {
    for target in [true, false] {
        let mut s = fixture();
        if !target {
            s.combat.actors[4].target = None;
        }
        let owner = s.combat.actors[4].view.id;
        let pos = s.combat.actors[4].view.pos;
        s.combat.actors[4].state(ActorState::Walk, 0., 0.);
        s.combat.actors[4].view.hp = 0.;
        s.deaths();
        let h = blast(&s);
        let id = h.view.id;
        assert_eq!(h.view.origin, pos);
        assert_eq!(h.phase_age, 0.);
        assert_eq!(h.view.progress, 0.);
        assert_eq!(h.target, target.then_some(s.combat.actors[0].view.id));
        for _ in 0..89 {
            tick(&mut s);
        }
        assert!(s.combat.actor_index(owner).is_none());
        assert_eq!(s.combat.hazards[0].view.phase, HazardPhase::Locked);
        assert!(s.combat.actors.iter().all(|a| a.view.hp == 100000.));
        tick(&mut s);
        assert_one_resolution(&mut s, owner, id);
    }
}

#[test]
fn armed_blast_survives_death_and_owner_removal_on_original_schedule() {
    let mut s = fixture();
    let owner = s.combat.actors[4].view.id;
    let id = arm(&mut s);
    for _ in 0..30 {
        tick(&mut s);
    }
    let before = s.combat.hazards[0].clone();
    s.combat.actors[4].view.hp = 0.;
    // Also cover a generic wind-up interruption having reset the cooldown.
    s.combat.actors[4].basic_cd = 0.;
    s.deaths();
    assert_eq!(s.combat.hazards.len(), 1);
    assert_eq!(s.combat.hazards[0].view, before.view);
    assert_eq!(s.combat.hazards[0].phase_age, before.phase_age);
    for _ in 0..59 {
        tick(&mut s);
    }
    assert!(s.combat.actor_index(owner).is_none());
    assert_eq!(s.combat.hazards[0].view.phase, HazardPhase::Locked);
    tick(&mut s);
    assert_one_resolution(&mut s, owner, id);
}

#[test]
fn natural_detonation_does_not_rearm_after_self_death_or_pruning() {
    let mut s = fixture();
    let owner = s.combat.actors[4].view.id;
    let id = arm(&mut s);
    for _ in 0..90 {
        tick(&mut s);
    }
    assert_eq!(s.combat.actors[4].view.state, ActorState::Dead);
    assert_one_resolution(&mut s, owner, id);
}

#[test]
fn spent_fuse_survives_resolved_hazard_pruning_before_death_dispatch() {
    let mut s = fixture();
    let id = arm(&mut s);
    for _ in 0..89 {
        tick(&mut s);
    }
    // Self-detonate, then prune before deaths: the actor latch must own this invariant.
    s.combat.update_hazards();
    s.resolve_hazards();
    assert_eq!(s.combat.hazards[0].view.phase, HazardPhase::Resolved);
    s.combat.hazards.clear();
    s.deaths();
    assert_eq!(s.combat.actors[4].view.state, ActorState::Dead);
    assert!(s.combat.hazards.is_empty());
    assert_eq!(
        s.drain_events()
            .iter()
            .filter(|e| matches!(e,
        Event::HazardResolved { id: h, kind: HazardKind::FizzmiteBlast, .. } if *h == id))
            .count(),
        1
    );
}

#[test]
fn lethal_hit_on_resolution_tick_produces_one_blast() {
    // Exercise both death dispatch before resolution and death dispatch after resolution.
    for early_death in [true, false] {
        let mut s = fixture();
        let owner = s.combat.actors[4].view.id;
        let id = arm(&mut s);
        for _ in 0..89 {
            tick(&mut s);
        }
        s.combat.actors[4].view.hp = 0.;
        if early_death {
            s.deaths();
        }
        s.combat.timers();
        s.combat.update_hazards();
        s.resolve_hazards();
        s.deaths();
        assert_one_resolution(&mut s, owner, id);
    }
}

#[test]
fn scene_cleanup_removes_fizzmites_without_combat_deaths_or_blasts() {
    let mut s = fixture();
    s.reset_stage(true);
    assert!(s.combat.actors.iter().all(|a| a.view.team == Team::Hero));
    assert!(!s.drain_events().iter().any(|e| matches!(
        e,
        Event::Died { .. }
            | Event::HazardSpawned {
                kind: HazardKind::FizzmiteBlast,
                ..
            }
    )));
}

#[test]
fn leaving_cast_pose_cannot_arm_another_body_fuse() {
    let mut s = fixture();
    let owner = s.combat.actors[4].view.id;
    let id = arm(&mut s);
    s.combat.encase(4);
    for _ in 0..60 {
        tick(&mut s);
    }
    assert_eq!(s.combat.actors[4].encase_steps, 0);
    s.enemy_ai();
    assert_eq!(s.combat.hazards.len(), 1);
    assert_eq!(s.combat.hazards[0].view.id, id);
    for _ in 0..30 {
        tick(&mut s);
    }
    assert_one_resolution(&mut s, owner, id);
}
