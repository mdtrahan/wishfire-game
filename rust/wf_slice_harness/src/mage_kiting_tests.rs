use crate::{tests::ALLOCATIONS, tuning::*, *};
fn fixture(mage: usize, distance: f32) -> Sim {
    let mut s = Sim::composition_trial(SimConfig::default(), &[Archetype::Boss]);
    s.combat.hazards.clear();
    for a in &mut s.combat.actors {
        a.view.pos = Vec2::new(700., 1500.);
        a.destination = a.view.pos;
        a.formed_age = 100.;
        a.ai_cd = 100.;
        a.basic_cd = 1000.;
        a.special_cd = 1000.;
        a.extra_cd = 1000.;
        a.pulse_cd = 1000.;
        a.pound_cd = 1000.;
        a.mend_cd = 1000.;
        a.summon_cd = 1000.;
    }
    s.combat.actors[4].view.pos = Vec2::new(480., 1000.);
    s.combat.actors[4].basic_cd = 0.;
    s.combat.actors[4].view.energy = 0.;
    s.combat.actors[4].recharge_left = 1000.;
    let id = s.combat.actors[4].view.id;
    let a = &mut s.combat.actors[mage];
    a.view.pos = Vec2::new(480., 1000. + distance);
    a.destination = a.view.pos;
    a.target = Some(id);
    a.ai_cd = 0.;
    a.view.ai_intent = AiIntent::Attack;
    a.power_choice = Some(false);
    s.combat.events.clear();
    s
}
#[test]
fn mages_retreat_from_known_boss_and_do_not_plant_without_time() {
    for mage in [2, 3] {
        let mut s = fixture(mage, 200.);
        s.combat.actors[mage].basic_cd = 0.;
        s.combat.actors[mage].special_cd = 0.;
        s.combat.actors[mage].extra_cd = 0.;
        s.combat.actors[mage].pulse_cd = 0.;
        let distance = s.combat.actors[mage]
            .view
            .pos
            .distance(s.combat.actors[4].view.pos);
        s.hero_ai();
        assert_eq!(s.combat.actors[mage].view.ai_intent, AiIntent::Retreat);
        assert!(
            s.combat.actors[mage]
                .view
                .pos
                .distance(s.combat.actors[4].view.pos)
                > distance
        );
        assert!(!matches!(
            s.combat.actors[mage].view.state,
            ActorState::Basic | ActorState::Cast
        ));
        assert!(!s.drain_events().iter().any(|e| matches!(e,Event::ActionStarted{id,state:ActorState::Basic|ActorState::Cast,..} if *id==mage as u32+1)));
    }
}
#[test]
fn mages_can_finish_an_attack_during_a_long_enemy_commitment() {
    for mage in [2, 3] {
        let mut s = fixture(mage, 200.);
        s.combat.actors[4].state(ActorState::Cast, 2., 2.);
        s.combat.actors[mage].special_cd = 0.;
        s.combat.actors[mage].pulse_cd = 0.;
        s.combat.actors[mage].view.meter = 1.;
        s.combat.actors[mage].aoe_ready_steps = MAGE_AOE_HOLD_STEPS; // Isolate cast safety after the hold.
        assert!(s.combat.mage_attack_window(mage, CAST_DURATION));
        s.hero_ai();
        assert_eq!(s.combat.actors[mage].view.state, ActorState::Cast);
    }
}
#[test]
fn mage_can_use_enemy_recovery_without_changing_any_cooldown() {
    let mut s = fixture(2, 170.);
    assert!(!s.combat.mage_attack_window(2, CAST_DURATION));
    s.combat.actors[4].basic_cd = 2.;
    let cooldown = s.combat.actors[4].basic_cd;
    assert!(s.combat.mage_attack_window(2, CAST_DURATION));
    s.combat.actors[2].special_cd = 0.;
    s.combat.actors[2].view.meter = 1.;
    s.combat.actors[2].aoe_ready_steps = MAGE_AOE_HOLD_STEPS; // Isolate enemy recovery.
    s.hero_ai();
    assert_eq!(s.combat.actors[2].view.state, ActorState::Cast);
    assert_eq!(s.combat.actors[4].basic_cd, cooldown);
    s.combat.actors[4].state(ActorState::Basic, BASIC_DURATION, BASIC_IMPACT);
    s.combat.actors[4].action_done = false;
    assert!(!s.combat.mage_attack_window(2, CAST_DURATION));
}
#[test]
fn mage_escapes_wall_encirclement_toward_party_instead_of_stalling() {
    let mut s = fixture(2, 500.);
    s.combat.actors[2].view.pos = Vec2::new(ARENA_MIN.x + BODY_RADIUS, 1100.);
    s.combat.actors[0].view.pos = Vec2::new(480., 1400.);
    for y in [1040., 1160.] {
        s.spawn_actor(Archetype::Orc, Vec2::new(180., y));
        s.combat.actors.last_mut().unwrap().formed_age = 100.;
    }
    let start = s.combat.actors[2].view.pos;
    for _ in 0..90 {
        s.combat.actors[2].ai_cd = 0.;
        s.hero_ai();
    }
    assert!(s.combat.actors[2].view.pos.x > start.x + 50.);
    assert!(
        s.combat.actors[2]
            .view
            .pos
            .distance(s.combat.actors[0].view.pos)
            < start.distance(s.combat.actors[0].view.pos)
    );
}
#[test]
fn mage_holds_body_edge_standoff_band_and_recovers_after_attack_when_melee_closes() {
    for mage in [2, 3] {
        let mut s = fixture(mage, 300.);
        let bodies = s.combat.actors[mage].view.radius + s.combat.actors[4].view.radius;
        s.combat.actors[mage].view.pos.y =
            1000. + bodies + s.combat.actors[mage].stats.reach * 0.85;
        let p = s.combat.actors[mage].view.pos;
        s.hero_ai();
        assert_eq!(s.combat.actors[mage].view.ai_intent, AiIntent::Attack);
        assert_eq!(s.combat.actors[mage].view.pos, p);
        let id = s.combat.actors[4].view.id;
        s.combat.start_action(mage, Some(id), false, false);
        s.combat.actors[mage].view.state_age = BASIC_DURATION;
        s.combat.actors[mage].action_done = true;
        s.combat.actors[mage].basic_cd = 1.; // Normal post-impact cooldown leaves a recovery step.
        s.combat.actors[mage].ai_cd = 0.;
        s.combat.actors[4].velocity = Vec2::new(0., 40.);
        s.combat.events.clear();
        s.hero_ai();
        assert_eq!(s.combat.actors[mage].view.ai_intent, AiIntent::Retreat);
        // A safe shot can use the explicit finish-before-contact exception;
        // positioning must still select recovery toward the outer band.
        assert!(
            s.combat.actors[mage]
                .destination
                .distance(s.combat.actors[4].view.pos)
                > p.distance(s.combat.actors[4].view.pos)
        );
    }
}
#[test]
fn mage_route_avoids_other_enemies_warnings_and_wall_traps() {
    let mut s = fixture(2, 500.);
    s.spawn_actor(Archetype::Orc, Vec2::new(480., 1330.));
    s.combat.actors.last_mut().unwrap().formed_age = 100.;
    s.hero_ai();
    assert!(s.combat.mage_path_safe(2, s.combat.actors[2].destination));
    let mut s = fixture(2, 200.);
    let p = s.combat.actors[2].view.pos;
    s.hazard(
        HazardKind::LizardoDrop,
        s.combat.actors[4].view.id,
        None,
        p + Vec2::new(0., 125.),
        Vec2::new(0., 1.),
    );
    s.combat.hazards[0].known[2] = true;
    s.hero_ai();
    assert!(!s
        .combat
        .path_enters_threat(2, s.combat.actors[2].destination, None));
    assert!(!s.combat.hazards[0].hits(s.combat.actors[2].destination, 0.));
    let mut s = fixture(2, 200.);
    s.combat.actors[2].view.pos = Vec2::new(ARENA_MIN.x + BODY_RADIUS, 1100.);
    s.combat.actors[4].view.pos = Vec2::new(290., 1100.);
    let p = s.combat.actors[2].view.pos;
    let distance = p.distance(s.combat.actors[4].view.pos);
    s.hero_ai();
    assert!(s.combat.actors[2].view.pos.distance(p) > 0.);
    for _ in 0..30 {
        s.combat.actors[2].ai_cd = 0.;
        s.hero_ai();
    }
    assert!(
        s.combat.actors[2]
            .view
            .pos
            .distance(s.combat.actors[4].view.pos)
            > distance
    );
    assert_eq!(
        s.combat.actors[2].destination,
        crate::math::floor_point(s.combat.actors[2].destination, BODY_RADIUS)
    );
}
#[test]
fn mage_boss_intrusion_pauses_revive_without_discarding_earned_work() {
    let mut s = fixture(2, 200.);
    s.combat.actors[1].view.hp = 0.;
    s.deaths();
    let ally = s.combat.actors[1].view.id;
    s.combat.start_action(2, Some(ally), false, true);
    s.combat.actors[2].view.state_age = 1.;
    s.combat.actors[2].ai_cd = 0.;
    s.hero_ai();
    assert!(!s.combat.actors[2].action_revive);
    assert_eq!(s.combat.actors[1].revive_progress, 1.);
    assert_eq!(s.combat.actors[1].revive_grace, REVIVE_GRACE);
    assert_eq!(s.combat.actors[2].view.ai_intent, AiIntent::Retreat);
}
#[test]
fn mage_uses_shared_enemy_read_clock_and_dodge_keeps_priority() {
    for kind in [HazardKind::LizardoDrop, HazardKind::SniperLine] {
        let mut s = fixture(2, 200.);
        s.combat.actors[4].formed_age = 0.;
        assert!(s.combat.mage_threat(2, false).is_none());
        s.combat.actors[4].formed_age = 100.;
        assert_eq!(s.combat.mage_threat(2, false), Some(4));
        let p = s.combat.actors[2].view.pos;
        s.hazard(
            kind,
            s.combat.actors[4].view.id,
            Some(s.combat.actors[2].view.id),
            p,
            Vec2::new(0., 1.),
        );
        s.combat.hazards[0].known[2] = true;
        s.hero_ai();
        assert_eq!(s.combat.actors[2].view.ai_intent, AiIntent::Dodge);
    }
}

#[test]
fn frontliners_keep_their_existing_close_attack_behaviour() {
    for hero in [0, 1] {
        let mut s = fixture(hero, 100.);
        s.combat.actors[hero].basic_cd = 0.;
        s.hero_ai();
        assert_eq!(s.combat.actors[hero].view.state, ActorState::Basic);
        assert!(!s.combat.mage(hero));
    }
}
#[test]
fn mage_kiting_steps_allocate_nothing_and_are_deterministic() {
    let mut a = fixture(2, 200.);
    let mut b = fixture(2, 200.);
    let mut allocations = 0;
    for _ in 0..120 {
        ALLOCATIONS.with(|n| n.set(Some(0)));
        a.step();
        allocations += ALLOCATIONS.with(|n| n.replace(None)).unwrap();
        a.combat.events.clear();
        b.advance(SIM_DT);
        b.combat.events.clear();
        assert_eq!(a.state_hash(), b.state_hash());
    }
    assert_eq!(allocations, 0);
}

#[test]
fn mages_attack_lone_ranged_enemies_and_marid_without_retreat_loop() {
    for seed in [1, 7, 42] {
        for kind in [Archetype::Sniper, Archetype::Mirewing, Archetype::Marid] {
            for mage in [2, 3] {
                let mut s = Sim::composition_trial(
                    SimConfig {
                        seed,
                        ..Default::default()
                    },
                    &[kind],
                );
                s.combat.hazards.clear();
                let id = s.combat.actors[mage].view.id;
                let target = s.combat.actors[4].view.id;
                s.combat.actors[4].view.pos = Vec2::new(480., 1060.);
                s.combat.actors[4].view.hp = 10000.;
                s.combat.actors[4].view.max_hp = 10000.;
                s.combat.actors[mage].view.pos = Vec2::new(480., 1300.);
                s.combat
                    .actors
                    .retain(|a| a.view.id == id || a.view.id == target);
                for a in &mut s.combat.actors {
                    a.formed_age = 100.;
                    a.destination = a.view.pos;
                }
                assert!(
                    s.combat.mage_threat(0, false).is_none(),
                    "{seed} {kind:?} {id}"
                );
                assert!(s.combat.mage_attack_window(0, BASIC_DURATION));
                let (mut basics, mut hits, mut retreat, mut longest) = (0, 0, 0, 0);
                for _ in 0..360 {
                    s.step();
                    retreat = if s.combat.actors[0].view.ai_intent == AiIntent::Retreat {
                        retreat + 1
                    } else {
                        0
                    };
                    longest = longest.max(retreat);
                    for e in s.drain_events() {
                        match e {
                            Event::ActionStarted {
                                id: source,
                                state: ActorState::Basic,
                                ..
                            } if source == id => basics += 1,
                            Event::Hit {
                                source,
                                target: victim,
                                amount,
                                ..
                            } if source == id && victim == target && amount > 0. => hits += 1,
                            _ => {}
                        }
                    }
                }
                assert!(
                    basics >= 2 && hits >= 2,
                    "{seed} {kind:?} {id}: basics={basics} hits={hits}"
                );
                assert!(longest < 90, "{seed} {kind:?} {id}: retreat={longest}");
            }
        }
    }
}

#[test]
fn recovering_mages_clear_enemies_guarding_downed_allies() {
    for mage in [2, 3] {
        let mut s = Sim::composition_trial(SimConfig::default(), &[Archetype::Orc]);
        s.combat.hazards.clear();
        for a in &mut s.combat.actors {
            a.state(ActorState::Idle, 0., 0.);
            a.formed_age = 100.;
            a.view.pos = Vec2::new(700., 1500.);
            a.destination = a.view.pos;
            a.revive_cd = 1000.;
            a.basic_cd = 1000.;
            a.special_cd = 1000.;
            a.extra_cd = 1000.;
            a.view.meter = 0.;
        }
        let enemy_pos = Vec2::new(480., 1000.);
        s.combat.actors[4].view.pos = enemy_pos;
        let reach = s.combat.actors[mage].attack_range(&s.combat.actors[4]);
        let pos = Vec2::new(480., 1000. + reach + 7.);
        s.combat.actors[mage].view.pos = pos;
        s.combat.actors[mage].destination = pos;
        s.combat.actors[mage].basic_cd = 0.;
        s.combat.actors[mage].ai_cd = 0.;
        s.combat.actors[0].view.pos = enemy_pos + Vec2::new(0., 60.);
        s.combat.actors[0].view.hp = 0.;
        s.combat.actors[0].view.state = ActorState::Downed;
        s.hero_ai();
        assert_eq!(s.combat.actors[mage].view.ai_intent, AiIntent::MoveToRange);
        assert!(s.combat.actors[mage].view.pos.distance(enemy_pos) < pos.distance(enemy_pos));
        for _ in 0..120 {
            s.hero_ai();
        }
        assert_eq!(s.combat.actors[mage].view.state, ActorState::Basic);
        // Losing the local rescue reason restores the pause while another hero can revive.
        s.combat.actors[1].revive_cd = 0.;
        s.combat.actors[0].view.pos = Vec2::new(700., 1800.);
        s.combat.actors[mage].state(ActorState::Idle, 0., 0.);
        s.combat.actors[mage].view.pos = pos;
        s.combat.actors[mage].ai_cd = 0.;
        s.hero_ai();
        assert_eq!(s.combat.actors[mage].view.pos, pos);
        assert_eq!(s.combat.actors[mage].view.ai_intent, AiIntent::None);
    }
}
