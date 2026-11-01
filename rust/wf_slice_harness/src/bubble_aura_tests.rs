use crate::{tests::ALLOCATIONS, tuning::*, *};
fn fixture(kind: Archetype) -> Sim {
    let mut s = Sim::composition_trial(SimConfig::default(), &[kind]);
    s.combat
        .hazards
        .retain(|h| h.view.kind == HazardKind::BubbleAura);
    for a in &mut s.combat.actors {
        a.basic_cd = 1000.;
        a.special_cd = 1000.;
        a.extra_cd = 1000.;
        a.pulse_cd = 1000.;
        a.pound_cd = 1000.;
        a.mend_cd = 1000.;
        a.summon_cd = 1000.;
        a.view.pos = Vec2::new(700., 1500.);
        a.destination = a.view.pos;
    }
    s.combat.actors[2].view.pos = Vec2::new(480., 1100.);
    s.combat.actors[4].view.pos = Vec2::new(530., 1100.);
    s.combat.events.clear();
    s
}
#[test]
fn bubble_aura_lifecycle_follows_runa_resolves_on_loss_and_rebuilds_on_screens() {
    let mut s = fixture(Archetype::Gobloc);
    s.combat.actors[2].view.pos.x += 10.;
    s.combat.update_hazards();
    assert_eq!(s.combat.hazards[0].view.origin, s.combat.actors[2].view.pos);
    s.combat.actors[2].view.hp = 0.;
    s.deaths();
    s.combat.update_hazards();
    s.combat.bubble_aura();
    assert_eq!(s.combat.hazards[0].view.phase, HazardPhase::Resolved);
    assert_eq!(s.combat.actors[4].view.slowed, 0.);
    for next in [true, false] {
        s.reset_stage(next);
        assert_eq!(
            s.combat
                .hazards
                .iter()
                .filter(|h| h.view.kind == HazardKind::BubbleAura)
                .count(),
            1
        );
        assert_eq!(
            s.combat
                .hazards
                .iter()
                .filter(|h| h.view.kind == HazardKind::KajaAura)
                .count(),
            0
        );
    }
}
#[test]
fn bubble_aura_returns_when_runa_is_revived() {
    let mut s = fixture(Archetype::Gobloc);
    s.combat.actors[4].view.pos = Vec2::new(800., ARENA_MAX.y - 100.);
    s.combat.actors[2].view.hp = 0.;
    s.deaths();
    s.combat.update_hazards();
    s.combat.actors[0].view.pos = s.combat.actors[2].view.pos + Vec2::new(30., 0.);
    let runa = s.combat.actors[2].view.id;
    s.combat.start_action(0, Some(runa), false, true);
    s.combat.actors[0].view.state_age = REVIVE_CHANNEL;
    s.combat.action(0);
    s.combat.update_hazards();
    assert!(s.combat.actors[2].alive());
    assert_eq!(
        s.combat
            .hazards
            .iter()
            .filter(
                |h| h.view.kind == HazardKind::BubbleAura && h.view.phase != HazardPhase::Resolved
            )
            .count(),
        1
    );
}
#[test]
fn bubble_encase_blocks_every_ordinary_enemy_cast_start() {
    for kind in [
        Archetype::Gobloc,
        Archetype::Orc,
        Archetype::Sniper,
        Archetype::Lizardo,
        Archetype::Fizzmite,
    ] {
        let mut s = fixture(kind);
        s.combat.actors[4].basic_cd = 0.;
        s.combat.actors[4].special_cd = 0.;
        s.combat.encase(4);
        s.combat.events.clear();
        let before = format!("{:?}", s.combat.actors[4]);
        let hazards = s.combat.hazards.len();
        s.enemy_ai();
        s.combat.actions();
        assert_eq!(format!("{:?}", s.combat.actors[4]), before);
        assert_eq!(s.combat.hazards.len(), hazards);
        assert!(s.drain_events().is_empty());
    }
}
#[test]
fn bubble_aura_slows_body_edge_contacts_only_enemies_and_clears_outside() {
    for kind in [
        Archetype::Gobloc,
        Archetype::Boss,
        Archetype::BossBomber,
        Archetype::BossMarksman,
    ] {
        let mut s = fixture(kind);
        s.combat.actors[4].view.pos.x = 480. + BUBBLE_AURA_RADIUS + s.combat.actors[4].view.radius;
        let hp = s.combat.actors[4].view.hp;
        s.combat.bubble_aura();
        let slow = if is_boss(kind) { 0.15 } else { 0.30 };
        assert_eq!(s.combat.actors[4].view.slowed, slow);
        assert_eq!(
            s.combat.actors[4].speed(),
            s.combat.actors[4].stats.speed * (1. - slow)
        );
        assert_eq!(s.combat.actors[4].view.hp, hp);
        assert!(s.combat.actors[..4]
            .iter()
            .all(|a| a.view.slowed == 0. && a.view.encased == 0.));
        s.combat.actors[4].view.pos.x += 0.01;
        s.combat.bubble_aura();
        assert_eq!(s.combat.actors[4].view.slowed, 0.);
        assert_eq!(s.combat.actors[4].bubble_steps, 0);
    }
}
#[test]
fn bubble_aura_five_percent_per_eligible_enemy_second_and_boss_immunity() {
    let mut s = fixture(Archetype::Gobloc);
    let boss = s.spawn_actor(Archetype::Boss, s.combat.actors[4].view.pos);
    let boss_rng = s.combat.actors[5].bubble_rng.0;
    let (mut trials, mut trapped) = (0, 0);
    while trials < 20000 {
        let before = s.combat.actors[4].bubble_rng.0;
        s.combat.bubble_aura();
        trials += u32::from(s.combat.actors[4].bubble_rng.0 != before);
        trapped += s
            .drain_events()
            .iter()
            .filter(|e| matches!(e, Event::Encased {id,seconds} if *id != boss && *seconds == 1.5))
            .count();
        assert_eq!(s.combat.actors[5].view.encased, 0.);
    }
    let rate = trapped as f32 / trials as f32;
    println!(
        "Bubble Aura eligible rolls: {trapped}/{trials} ({:.3}%)",
        rate * 100.
    );
    assert!(
        (0.045..0.055).contains(&rate),
        "{trapped}/{trials} = {rate}"
    );
    assert_eq!(s.combat.actors[5].bubble_rng.0, boss_rng);
}
#[test]
fn bubble_encase_cancels_windup_pauses_all_actor_work_and_expires_exactly() {
    let mut s = fixture(Archetype::Gobloc);
    s.combat.start_action(4, Some(1), false, false);
    s.combat.encase(4);
    assert_eq!(s.combat.actors[4].view.state, ActorState::Idle);
    assert!(s.combat.actors[4].action_done);
    let before = format!("{:?}", s.combat.actors[4]);
    s.combat.timers();
    s.enemy_ai();
    s.combat.actions();
    assert_eq!(format!("{:?}", s.combat.actors[4]), before);
    assert!(!s
        .drain_events()
        .iter()
        .any(|e| matches!(e, Event::Hit {source,..} if *source == s.combat.actors[4].view.id)));
    // Leaving clears the slow but an existing trap lasts the entire 45 combat steps.
    s.combat.actors[4].view.pos.x += 500.;
    for remaining in (0..45).rev() {
        s.combat.bubble_aura();
        assert_eq!(s.combat.actors[4].view.encased, remaining as f32 / 30.);
    }
    let age = s.combat.actors[4].view.state_age;
    s.combat.timers();
    assert_eq!(s.combat.actors[4].view.state_age, age + SIM_DT);
}
#[test]
fn bubble_encase_keeps_spawned_shots_and_hazards_running_and_takes_damage() {
    let mut s = fixture(Archetype::Gobloc);
    let id = s.combat.actors[4].view.id;
    s.combat
        .projectile(4, Some(1), s.combat.actors[0].view.pos, false, 10., None);
    s.hazard(
        HazardKind::LizardoDrop,
        id,
        Some(1),
        s.combat.actors[0].view.pos,
        Vec2::new(1., 0.),
    );
    let h = s.combat.hazards.last_mut().unwrap();
    h.duration = 2. * SIM_DT;
    s.combat.encase(4);
    let hp = s.combat.actors[4].view.hp;
    s.combat.damage(1, 4, 1., false, false, Element::Physical);
    assert!(s.combat.actors[4].view.hp < hp);
    let p = s.combat.projectiles[0].view.pos;
    s.combat.move_projectiles();
    assert_ne!(s.combat.projectiles[0].view.pos, p);
    for _ in 0..3 {
        s.combat.update_hazards();
        s.resolve_hazards();
    }
    assert!(s.drain_events().iter().any(|e| matches!(
        e,
        Event::HazardResolved {
            kind: HazardKind::LizardoDrop,
            ..
        }
    )));
    assert!(s.combat.actors[4].view.encased > 0.);
}
#[test]
fn bubble_slow_scales_relocation_and_charge_travel_without_warning_changes() {
    let mut moved = [0.; 2];
    let mut charge = [Vec2::default(); 2];
    let mut frames = [0; 2];
    for (k, slow) in [0., 0.15].into_iter().enumerate() {
        let mut s = fixture(Archetype::Boss);
        s.combat.actors[4].view.slowed = slow;
        s.combat.actors[4].enemy_phase = 3;
        s.combat.actors[4].relocate_left = 2.;
        s.combat.actors[4].destination = s.combat.actors[4].view.pos + Vec2::new(100., 0.);
        let start = s.combat.actors[4].view.pos;
        s.enemy_ai();
        moved[k] = s.combat.actors[4].view.pos.distance(start);
        s.combat.actors[4].view.pos = start;
        let owner = s.combat.actors[4].view.id;
        s.hazard(
            HazardKind::BossCharge,
            owner,
            Some(1),
            start,
            Vec2::new(0., 1.),
        );
        let h = s.combat.hazards.last_mut().unwrap();
        let Shape::Line { length, .. } = h.view.shape else {
            panic!("line")
        };
        assert_eq!(h.base_duration, CHARGE_LOCK);
        h.view.phase = HazardPhase::Active;
        h.phase_age = 0.;
        h.duration = (length - BOSS_BODY_RADIUS) / CHARGE_SPEED;
        while s.combat.hazards.last().unwrap().view.phase != HazardPhase::Resolved {
            s.combat.update_hazards();
            s.resolve_hazards();
            frames[k] += 1;
        }
        charge[k] = s.combat.actors[4].view.pos;
    }
    assert!((moved[1] / moved[0] - 0.85).abs() < 0.0001);
    // Existing charge resolution samples the final movement quantum before ending.
    assert!(
        charge[0].distance(charge[1]) <= CHARGE_SPEED * SIM_DT + 0.001,
        "{charge:?}, frames={frames:?}"
    );
    assert!(frames[1] > frames[0]);
}
#[test]
fn bubble_encase_mage_window_budgets_release_instead_of_permanent_zero_speed() {
    let mut s = fixture(Archetype::Gobloc);
    s.combat.actors[4].basic_cd = 0.;
    s.combat.encase(4);
    assert!(s.combat.mage_attack_window(2, CAST_DURATION));
    s.combat.actors[4].view.encased = SIM_DT;
    // Just outside the enemy's reach: it can close after release, despite current speed zero.
    s.combat.actors[2].view.pos.x =
        s.combat.actors[4].view.pos.x - s.combat.actors[4].attack_range(&s.combat.actors[2]) - 1.;
    assert!(!s.combat.mage_attack_window(2, CAST_DURATION));
}
#[test]
fn bubble_aura_status_rng_and_exposure_are_hashed() {
    let mut s = fixture(Archetype::Gobloc);
    let hash = s.state_hash();
    for field in 0..5 {
        let old = s.combat.actors[4].clone();
        match field {
            0 => s.combat.actors[4].bubble_rng.0 += 1,
            1 => s.combat.actors[4].bubble_steps += 1,
            2 => s.combat.actors[4].encase_steps += 1,
            3 => s.combat.actors[4].view.slowed = 0.3,
            _ => s.combat.actors[4].view.encased = 1.5,
        }
        assert_ne!(hash, s.state_hash());
        s.combat.actors[4] = old;
    }
}
#[test]
fn bubble_aura_encase_and_slow_freeze_during_charge_performing_tail_without_allocations() {
    let mut s = fixture(Archetype::Orc);
    let target = s.spawn_actor(Archetype::Boss, Vec2::new(700., ARENA_MAX.y - 100.));
    s.combat.actors[5].view.hp = 100000.;
    s.combat.bubble_aura();
    s.combat.encase(4);
    s.combat.actors[4].bubble_steps = 12;
    s.set_spotlight(SpotlightConfig {
        charge: 0.1,
        global_gap: 0.,
        hero_gap: 0.,
        fairness: 0.,
        auto_release: false,
        ..SpotlightConfig::DEFAULT
    });
    s.combat.start_ground_pound(0, target);
    s.combat.select_spotlight();
    let actor = format!("{:?}", s.combat.actors[4]);
    let aura = format!("{:?}", s.combat.hazards[0]);
    let combat = s.combat.combat_steps;
    let mut phases = [false; 3];
    let mut allocations = 0;
    for _ in 0..100 {
        let phase = s.combat.spotlight.active.as_ref().unwrap().phase;
        phases[phase as usize] = true;
        ALLOCATIONS.with(|n| n.set(Some(0)));
        s.step();
        allocations += ALLOCATIONS.with(|n| n.replace(None)).unwrap();
        s.combat.events.clear();
        assert_eq!(format!("{:?}", s.combat.actors[4]), actor);
        assert_eq!(format!("{:?}", s.combat.hazards[0]), aura);
        assert_eq!(s.combat.combat_steps, combat);
        if phase == SpotlightPhase::Tail {
            break;
        }
    }
    assert_eq!(phases, [true; 3]);
    assert_eq!(allocations, 0);
    let remaining = s.combat.actors[4].encase_steps;
    s.release_spotlight();
    s.step();
    assert_eq!(s.combat.actors[4].encase_steps, remaining - 1);
}
#[test]
fn bubble_aura_normal_steps_are_deterministic_and_allocate_nothing() {
    let mut a = Sim::new(SimConfig::default());
    let mut b = Sim::new(SimConfig::default());
    let mut allocations = 0;
    for _ in 0..900 {
        ALLOCATIONS.with(|n| n.set(Some(0)));
        a.step();
        allocations += ALLOCATIONS.with(|n| n.replace(None)).unwrap();
        a.combat.events.clear();
        b.advance(1. / 30.);
        b.combat.events.clear();
    }
    assert_eq!(allocations, 0);
    assert_eq!(a.state_hash(), b.state_hash());
}

fn pop(s: &mut Sim) {
    let id = s.combat.actors[4].view.id;
    let origin = s.combat.actors[4].view.pos - Vec2::new(10., 0.);
    s.hazard(
        HazardKind::BubblePop,
        s.combat.actors[2].view.id,
        Some(id),
        origin,
        Vec2::new(1., 0.),
    );
    let h = s.combat.hazards.last_mut().unwrap();
    h.phase_age = h.duration;
    s.resolve_hazards();
}
fn pop_fixture(kind: Archetype) -> Sim {
    let mut s = fixture(kind);
    s.combat.hazards.clear(); // Isolate the guaranteed Pop stun from passive aura rolls.
    s.combat.actors[4].view.hp = 100000.;
    s.combat.actors[4].view.max_hp = 100000.;
    s.combat.actors[4].stats.evade = 0.;
    s
}
#[test]
fn bubble_pop_cannot_hit_encase_push_or_emit_hit_floats_during_marid_teleport() {
    for steps in [60, 43, 42, 19, 18, 1] {
        let mut s = pop_fixture(Archetype::Marid);
        s.combat.actors[4].view.teleport_steps = steps;
        s.combat.actors[4].view.ward = 100.;
        let before = s.combat.actors[4].view.clone();
        pop(&mut s);
        let after = &s.combat.actors[4].view;
        assert_eq!(after.hp, before.hp);
        assert_eq!(after.ward, before.ward);
        assert_eq!(after.pos, before.pos);
        assert_eq!(after.encased, 0.);
        assert!(!s.drain_events().iter().any(|e| matches!(e,
            Event::Hit { target, .. } | Event::Evaded { target, .. } if *target == before.id)
            || matches!(e, Event::Encased { id, .. } if *id == before.id)));
        s.combat.encase(4); // The passive's shared entry point also rejects every phase.
        assert_eq!(s.combat.actors[4].view.encased, 0.);
    }
}
#[test]
fn bubble_pop_encased_marid_waits_until_stun_expires_before_teleporting() {
    let mut s = pop_fixture(Archetype::Marid);
    pop(&mut s);
    assert_eq!(s.combat.actors[4].encase_steps, 45);
    s.combat.actors[4].relocate_left = 0.; // A hop is already due when the stun lands.
    let pos = s.combat.actors[4].view.pos;
    for remaining in (1..45).rev() {
        s.combat.bubble_aura();
        s.combat.timers();
        s.enemy_ai();
        s.combat.action(4);
        assert_eq!(s.combat.actors[4].encase_steps, remaining);
        assert_eq!(s.combat.actors[4].view.teleport_steps, 0);
        assert_eq!(s.combat.actors[4].relocate_left, 0.);
        assert_eq!(s.combat.actors[4].view.pos, pos);
    }
    s.combat.bubble_aura();
    s.combat.timers();
    s.enemy_ai();
    assert_eq!(s.combat.actors[4].encase_steps, 0);
    assert_eq!(s.combat.actors[4].view.teleport_steps, MARID_TELEPORT_STEPS);
}
#[test]
fn bubble_pop_stuns_for_exactly_45_ticks_then_retargets_and_attacks() {
    for lose_target in [false, true] {
        let mut s = pop_fixture(Archetype::Gobloc);
        let target = s.combat.actors[0].view.id;
        s.combat.start_action(4, Some(target), false, false);
        pop(&mut s);
        assert_eq!(s.combat.actors[4].view.state, ActorState::Idle);
        assert!(s.combat.actors[4].action_done);
        assert_eq!(s.combat.actors[4].view.encased, 1.5);
        let pos = s.combat.actors[4].view.pos;
        // Keep one living replacement in melee reach while the old target dies.
        s.combat.actors[0].view.pos = pos + Vec2::new(60., 0.);
        s.combat.actors[1].view.pos = pos + Vec2::new(0., 60.);
        if lose_target {
            s.combat.actors[0].view.hp = 0.;
        }
        s.combat.events.clear();
        for remaining in (1..45).rev() {
            let combat = s.combat.combat_steps;
            // Hero death triggers global hit-stop; stun uses the shared combat clock.
            for _ in 0..60 {
                s.step();
                if s.combat.combat_steps > combat {
                    break;
                }
                assert_eq!(s.combat.actors[4].encase_steps, remaining + 1);
            }
            assert_eq!(s.combat.combat_steps, combat + 1);
            assert_eq!(s.combat.actors[4].encase_steps, remaining);
            assert_eq!(
                s.combat.actors[4].view.encased,
                remaining as f32 / SIM_HZ as f32
            );
            assert_eq!(s.combat.actors[4].view.pos, pos);
            assert_eq!(s.combat.actors[4].view.state, ActorState::Idle);
            assert!(!s.drain_events().iter().any(|e| matches!(e,
                Event::Hit { source, .. } if *source == s.combat.actors[4].view.id)));
        }
        s.step();
        assert_eq!(s.combat.actors[4].encase_steps, 0);
        assert_eq!(s.combat.actors[4].view.encased, 0.);
        assert_eq!(s.combat.actors[4].view.state, ActorState::Basic);
        if lose_target {
            assert_eq!(s.combat.actors[4].target, Some(s.combat.actors[1].view.id));
        }
        let id = s.combat.actors[4].view.id;
        for _ in 0..30 {
            s.step();
        }
        assert!(s.drain_events().iter().any(|e| matches!(e,
            Event::Hit { source, .. } if *source == id)));
    }
}
#[test]
fn bubble_pop_refreshes_shared_encase_without_stacking_or_shortening() {
    let mut s = pop_fixture(Archetype::Orc);
    s.combat.encase(4); // Existing passive control effect.
    for _ in 0..15 {
        s.combat.bubble_aura();
    }
    pop(&mut s);
    assert_eq!(s.combat.actors[4].encase_steps, 45);
    pop(&mut s);
    assert_eq!(s.combat.actors[4].encase_steps, 45);
    s.combat.actors[4].encase_steps = 60;
    s.combat.actors[4].view.encased = 2.;
    pop(&mut s);
    assert_eq!(s.combat.actors[4].encase_steps, 60);
    assert_eq!(s.combat.actors[4].view.encased, 2.);
}
#[test]
fn bubble_pop_cancels_normal_warning_but_no_stunned_enemy_starts_one() {
    for kind in [
        Archetype::Gobloc,
        Archetype::Orc,
        Archetype::HighOrc,
        Archetype::Gloamink,
        Archetype::Sniper,
        Archetype::Lizardo,
        Archetype::Fizzmite,
        Archetype::Mirewing,
        Archetype::Marid,
        Archetype::Bastorto,
    ] {
        let mut s = pop_fixture(kind);
        let owner = s.combat.actors[4].view.id;
        s.combat
            .start_action(4, Some(s.combat.actors[0].view.id), false, false);
        let warning = s.hazard(
            HazardKind::SniperLine,
            owner,
            Some(s.combat.actors[0].view.id),
            s.combat.actors[4].view.pos,
            Vec2::new(0., 1.),
        );
        pop(&mut s);
        assert_eq!(s.combat.actors[4].encase_steps, 45, "{kind:?}");
        assert!(s
            .drain_events()
            .iter()
            .any(|e| matches!(e, Event::HazardCancelled { id, .. } if *id == warning)));
        let before = format!("{:?}", s.combat.actors[4]);
        let hazards = s.combat.hazards.len();
        s.combat.timers();
        s.enemy_ai();
        s.combat.actions();
        assert_eq!(format!("{:?}", s.combat.actors[4]), before, "{kind:?}");
        assert_eq!(s.combat.hazards.len(), hazards);
    }
}
#[test]
fn bubble_pop_never_stuns_pushes_or_interrupts_started_boss_moves() {
    for (kind, attack) in [
        (Archetype::Boss, HazardKind::BossStompStep),
        (Archetype::Boss, HazardKind::BossCharge),
        (Archetype::BossBomber, HazardKind::BossNova),
        (Archetype::BossMarksman, HazardKind::BossSnipe),
    ] {
        for seed in 0..8 {
            let mut s = pop_fixture(kind);
            s.combat.actors[4].push_rng = crate::rng::Rng(seed);
            s.combat
                .start_action(4, Some(s.combat.actors[0].view.id), false, false);
            s.hazard(
                attack,
                s.combat.actors[4].view.id,
                Some(s.combat.actors[0].view.id),
                s.combat.actors[4].view.pos,
                Vec2::new(0., 1.),
            );
            let warning = format!("{:?}", s.combat.hazards[0]);
            let before = s.combat.actors[4].clone();
            pop(&mut s);
            let a = &s.combat.actors[4];
            assert!(a.view.hp < before.view.hp);
            assert_eq!(a.encase_steps, 0);
            assert_eq!(a.view.encased, 0.);
            assert_eq!(a.view.pos, before.view.pos);
            assert_eq!(a.view.state, before.view.state);
            assert_eq!(a.action_done, before.action_done);
            assert_eq!(a.push_rng.0, before.push_rng.0);
            assert_eq!(format!("{:?}", s.combat.hazards[0]), warning);
            assert!(!s.drain_events().iter().any(|e| matches!(
                e,
                Event::BossStaggered { .. } | Event::HazardCancelled { .. } | Event::Encased { .. }
            )));
        }
    }
}
#[test]
fn bubble_pop_stuns_each_landed_victim_and_skips_evades_and_outside_enemies() {
    let mut s = pop_fixture(Archetype::Orc);
    let origin = s.combat.actors[4].view.pos;
    for (offset, evade) in [
        (Vec2::new(0., 50.), 0.),
        (Vec2::new(0., -50.), 1.),
        (Vec2::new(400., 0.), 0.),
    ] {
        s.spawn_actor(Archetype::Orc, origin + offset);
        let a = s.combat.actors.last_mut().unwrap();
        a.view.hp = 100000.;
        a.stats.evade = evade;
    }
    pop(&mut s);
    assert_eq!(s.combat.actors[4].encase_steps, 45);
    assert_eq!(s.combat.actors[5].encase_steps, 45);
    assert_eq!(s.combat.actors[6].encase_steps, 0);
    assert_eq!(s.combat.actors[7].encase_steps, 0);
}
