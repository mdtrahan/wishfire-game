use crate::{tuning::*, *};

fn fixture(enemies: &[Archetype]) -> Sim {
    let mut s = Sim::composition_trial(SimConfig::default(), enemies);
    s.combat.hazards.clear();
    for (i, a) in s.combat.actors.iter_mut().enumerate() {
        a.view.pos = Vec2::new(220. + i as f32 * 80., 1250.);
        a.destination = a.view.pos;
        a.state(ActorState::Idle, 0., 0.);
        a.formed_age = 100.;
        a.action_done = true;
        a.basic_cd = 100.;
        a.ai_cd = 0.;
    }
    s
}

fn assert_no_return(s: &Sim) {
    for (k, a) in s.combat.actors[..4].iter().enumerate() {
        assert_ne!(a.destination, ARENA_CENTRE, "hero {k} chose centre");
        assert_ne!(
            a.destination,
            ARENA_CENTRE + TRAVEL_SLOTS[k],
            "hero {k} chose centre travel slot"
        );
        assert_ne!(
            a.view.ai_intent,
            AiIntent::Regroup,
            "hero {k} regrouped during combat"
        );
    }
}

#[test]
fn generic_untargetable_enemy_holds_then_reacquires_on_first_available_tick() {
    // Any actor can be alive but phased out; no archetype-specific producer is needed.
    let mut s = fixture(&[Archetype::Gobloc]);
    s.combat.actors[4].view.pos = Vec2::new(480., 450.);
    let id = s.combat.actors[4].view.id;
    s.hero_ai();
    assert!(s.combat.actors[..4].iter().all(|a| a.target == Some(id)));
    s.combat.actors[4].view.teleport_steps = 1;
    for a in &mut s.combat.actors[..4] {
        a.ai_cd = AI_INTERVAL;
    }
    s.hero_ai();
    assert!(!s.wave_combat_complete());
    assert_no_return(&s);
    for a in &s.combat.actors[..4] {
        assert!(a.target.is_none());
        assert_eq!(a.destination, a.view.pos);
        assert_eq!(a.velocity, Vec2::default());
    }
    s.combat.actors[4].view.teleport_steps = 0;
    for a in &mut s.combat.actors[..4] {
        a.ai_cd = AI_INTERVAL;
    }
    s.hero_ai();
    assert_no_return(&s);
    for a in &s.combat.actors[..4] {
        assert_eq!(a.target, Some(id));
        assert_eq!(a.view.ai_intent, AiIntent::MoveToRange);
        assert!(
            a.destination.distance(s.combat.actors[4].view.pos)
                < a.view.pos.distance(s.combat.actors[4].view.pos)
        );
    }
}

#[test]
fn lost_target_reacquires_nearest_targetable_living_enemy() {
    let mut s = fixture(&[Archetype::Gobloc, Archetype::Gobloc, Archetype::Gobloc]);
    s.combat.actors[4].view.pos = Vec2::new(480., 550.);
    s.combat.actors[5].view.pos = Vec2::new(480., 200.);
    s.combat.actors[6].view.pos = Vec2::new(480., 100.);
    s.hero_ai();
    assert!(s.combat.actors[..4]
        .iter()
        .all(|a| a.target == Some(s.combat.actors[4].view.id)));
    s.combat.actors[4].view.teleport_steps = 1;
    for a in &mut s.combat.actors[..4] {
        a.ai_cd = AI_INTERVAL;
    }
    s.hero_ai();
    assert_no_return(&s);
    for a in &s.combat.actors[..4] {
        assert_eq!(a.target, Some(s.combat.actors[5].view.id));
    }
}

#[test]
fn marid_transit_holds_then_immediately_reacquires_without_centre_oscillation() {
    let mut s = fixture(&[Archetype::Marid]);
    s.combat.actors[4].view.pos = Vec2::new(480., 450.);
    s.hero_ai();
    assert!(s.combat.actors[..4]
        .iter()
        .all(|a| a.target == Some(s.combat.actors[4].view.id)));
    s.combat.marid_teleport(4);
    assert_eq!(s.combat.actors[4].view.teleport_steps, MARID_TELEPORT_STEPS);
    let held = s.combat.actors[..4]
        .iter()
        .map(|a| a.view.pos)
        .collect::<Vec<_>>();
    for _ in 0..MARID_TELEPORT_STEPS - 1 {
        s.combat.timers();
        s.hero_ai();
        assert_no_return(&s);
        for (a, pos) in s.combat.actors[..4].iter().zip(&held) {
            assert_eq!(a.view.pos, *pos);
            assert_eq!(a.destination, *pos);
            assert!(a.target.is_none());
        }
    }
    // Reacquisition bypasses the normal decision interval on the first tangible tick.
    for a in &mut s.combat.actors[..4] {
        a.ai_cd = AI_INTERVAL;
    }
    let mut distances = [0.; 4];
    for (k, d) in distances.iter_mut().enumerate() {
        *d = s.combat.actors[k]
            .view
            .pos
            .distance(s.combat.actors[4].view.pos);
    }
    for _ in 0..30 {
        s.combat.timers();
        s.hero_ai();
        assert_no_return(&s);
        for (k, d) in distances.iter_mut().enumerate() {
            let a = &s.combat.actors[k];
            assert_eq!(a.target, Some(s.combat.actors[4].view.id));
            let distance = a.view.pos.distance(s.combat.actors[4].view.pos);
            assert!(distance < *d, "hero {k} stopped closing: {distance} >= {d}");
            *d = distance;
        }
    }
}

#[test]
fn distant_enemy_uses_existing_pursuit_instead_of_centre_return() {
    let mut s = fixture(&[Archetype::Gobloc]);
    s.combat.actors[4].view.pos = Vec2::new(480., 100.);
    for a in &s.combat.actors[..4] {
        assert!(a.view.pos.distance(s.combat.actors[4].view.pos) > 500.);
    }
    s.hero_ai();
    assert_no_return(&s);
    for a in &s.combat.actors[..4] {
        assert_eq!(a.target, Some(s.combat.actors[4].view.id));
        assert_eq!(a.view.ai_intent, AiIntent::MoveToRange);
        assert!(
            a.destination.distance(s.combat.actors[4].view.pos)
                < a.view.pos.distance(s.combat.actors[4].view.pos)
        );
    }
}

#[test]
fn final_enemy_death_restores_centre_travel_and_chest_collection() {
    let mut s = fixture(&[Archetype::Gobloc]);
    s.combat.actors[4].view.hp = 0.;
    s.combat.actors[4].state(ActorState::Dead, 0., 0.);
    s.hero_ai();
    for (k, a) in s.combat.actors[..4].iter().enumerate() {
        assert_eq!(a.view.ai_intent, AiIntent::Regroup);
        assert_eq!(a.destination, ARENA_CENTRE + TRAVEL_SLOTS[k]);
    }
    s.director.chest_due = true;
    s.direct();
    assert_eq!(s.chests.len(), 1);
    assert_eq!(s.chests[0].pos, ARENA_CENTRE);
    s.update_chests();
    assert!(s.chest_opener.is_some());
    assert!(s.chest_goal(0).is_some());
}

#[test]
fn pending_subwave_blocks_centre_travel_and_chest_approach() {
    let mut s = fixture(&[]);
    // The director keeps wave_active through every queued sub-wave, even with no live units.
    s.director.wave_active = true;
    s.director.subwave_count = 1;
    s.director.spawned = 0;
    s.hero_ai();
    assert_no_return(&s);
    // A stale chest must not override the same completion gate.
    s.drop_chest();
    s.update_chests();
    assert!(s.chest_opener.is_none());
    assert!(s.chest_goal(0).is_none());
}

#[test]
fn scheduled_spawn_and_unread_spawn_hold_until_targetable() {
    let mut s = Sim::new(SimConfig::default());
    s.director.clear_age = 10.;
    s.direct();
    assert!(s.combat.hazards.iter().any(|h| h.spawn_kind.is_some()));
    s.director.wave_active = false; // Final sub-wave can finish placement before markers resolve.
    for (k, a) in s.combat.actors[..4].iter_mut().enumerate() {
        a.view.pos = Vec2::new(220. + k as f32 * 80., 1250.);
        a.destination = a.view.pos;
        a.ai_cd = 0.;
    }
    s.hero_ai();
    assert_no_return(&s);

    let mut s = fixture(&[Archetype::Gobloc]);
    s.combat.actors[4].begin_spawn();
    s.hero_ai();
    assert_no_return(&s);
    for a in &s.combat.actors[..4] {
        assert_eq!(a.destination, a.view.pos);
    }
}

#[test]
fn pending_wave_preempts_an_existing_centre_goal_without_waiting_for_ai_timer() {
    let mut s = fixture(&[]);
    s.director.wave_active = true;
    for (k, a) in s.combat.actors[..4].iter_mut().enumerate() {
        a.view.ai_intent = AiIntent::Regroup;
        a.destination = ARENA_CENTRE + TRAVEL_SLOTS[k];
        a.ai_cd = AI_INTERVAL * 0.5;
    }
    s.hero_ai();
    assert_no_return(&s);
    for a in &s.combat.actors[..4] {
        assert_eq!(a.destination, a.view.pos);
        assert_eq!(a.ai_cd, AI_INTERVAL * 0.5);
    }
}
