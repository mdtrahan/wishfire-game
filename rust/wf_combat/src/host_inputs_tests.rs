use crate::{tuning::*, *};

#[test]
fn resolved_spawn_stats_are_applied_once() {
    let mut sim = Sim::new(SimConfig::default());
    let mut resolved = stats(Archetype::BossMarksman);
    resolved.hp = 1234.5;
    resolved.atk = 37.25;
    sim.spawn_actor(Archetype::BossMarksman, ARENA_CENTRE, resolved);
    assert_eq!(sim.actors[0].stats.hp.to_bits(), resolved.hp.to_bits());
    assert_eq!(sim.actors[0].view.max_hp.to_bits(), resolved.hp.to_bits());
    assert_eq!(sim.actors[0].stats.atk.to_bits(), resolved.atk.to_bits());
}

#[test]
fn inputs_change_combat_hash_without_host_state() {
    let mut sim = Sim::new(SimConfig::default());
    let original = sim.state_hash();
    sim.modifiers.cooldown_multiplier = 0.9;
    assert_ne!(original, sim.state_hash());
    sim.modifiers = EncounterModifiers::default();
    assert_eq!(original, sim.state_hash());
    sim.encounter.transitioning = true;
    assert_ne!(original, sim.state_hash());
    sim.encounter = EncounterState::default();
    sim.interest_points.push((1, ARENA_CENTRE));
    assert_ne!(original, sim.state_hash());
    sim.interest_points.clear();
    sim.spawn_profiles
        .push((Archetype::Orc, stats(Archetype::Orc)));
    assert_ne!(original, sim.state_hash());
    sim.spawn_profiles.clear();
    sim.formation_origin.x += 1.;
    assert_ne!(original, sim.state_hash());
}

#[test]
fn transition_input_holds_mechanics_and_cancels_channel() {
    let mut sim = Sim::new(SimConfig::default());
    sim.spawn_actor(Archetype::Fara, ARENA_CENTRE, stats(Archetype::Fara));
    sim.actors[0].basic_cd = 7.;
    sim.encounter.transitioning = true;
    sim.step();
    assert_eq!(sim.step_number, 1);
    assert_eq!(sim.actors[0].basic_cd, 7.);
    assert!(sim.phoenix.hero.is_none());
}

#[test]
fn modifiers_have_neutral_defaults_and_drive_boss_abilities() {
    let mut sim = Sim::new(SimConfig::default());
    sim.spawn_actor(Archetype::Boss, ARENA_CENTRE, stats(Archetype::Boss));
    assert_eq!(sim.boss_time_scale(), 1.);
    let base_recharge = sim.boss_recharge_duration(0);
    let base_shape = sim
        .hazard_spec(HazardKind::BossSlam, None, ARENA_CENTRE, Vec2::new(1., 0.))
        .0;
    sim.modifiers = EncounterModifiers {
        cooldown_multiplier: 0.81,
        slam_radius_bonus: 20.,
        recharge_reduction: 1.,
    };
    assert_eq!(sim.boss_time_scale(), 0.81);
    assert_eq!(sim.boss_recharge_duration(0), base_recharge - 1.);
    let modified = sim
        .hazard_spec(HazardKind::BossSlam, None, ARENA_CENTRE, Vec2::new(1., 0.))
        .0;
    match (base_shape, modified) {
        (Shape::Circle { radius: a }, Shape::Circle { radius: b }) => assert_eq!(b, a + 20.),
        _ => panic!("slam must remain circular"),
    }
}

#[test]
fn summon_spawn_uses_host_resolved_profile() {
    let mut sim = Sim::new(SimConfig::default());
    let mut profile = stats(Archetype::Sniper);
    profile.hp = 432.;
    sim.spawn_profiles.push((Archetype::Sniper, profile));
    let id = sim.spawn_enemy(Archetype::Sniper);
    let actor = &sim.actors[sim.actor_index(id).unwrap()];
    assert_eq!(actor.view.max_hp, 432.);
    assert_eq!(actor.view.state, ActorState::Spawn);
}

#[test]
fn death_reports_position_once_and_does_not_orchestrate() {
    let mut sim = Sim::new(SimConfig::default());
    sim.spawn_actor(Archetype::Orc, ARENA_CENTRE, stats(Archetype::Orc));
    sim.actors[0].view.hp = 0.;
    sim.deaths();
    sim.deaths();
    assert_eq!(sim.defeats, [ARENA_CENTRE]);
    assert!(matches!(
        sim.drain_events().last(),
        Some(Event::Died { .. })
    ));
}

#[test]
fn default_step_runs_enemy_ai_without_orchestration() {
    let mut sim = Sim::new(SimConfig::default());
    sim.spawn_actor(Archetype::Fara, ARENA_CENTRE, stats(Archetype::Fara));
    let enemy = sim.spawn_actor(
        Archetype::Orc,
        ARENA_CENTRE + Vec2::new(50., 0.),
        stats(Archetype::Orc),
    );
    sim.actors[1].basic_cd = 0.;
    sim.step();
    assert!(sim
        .drain_events()
        .iter()
        .any(|event| matches!(event, Event::ActionStarted { id, .. } if *id == enemy)));
}

#[test]
fn host_interest_point_is_optional_and_has_no_object_identity() {
    let mut sim = Sim::new(SimConfig::default());
    let hero = sim.spawn_actor(Archetype::Fara, ARENA_CENTRE, stats(Archetype::Fara));
    sim.encounter.complete = true;
    let goal = ARENA_CENTRE + Vec2::new(100., 50.);
    sim.interest_points.push((hero, goal));
    sim.choose_hero_intent(0);
    assert_eq!(sim.actors[0].destination, goal);
    sim.interest_points.clear();
    sim.choose_hero_intent(0);
    assert_ne!(sim.actors[0].destination, goal);
}
