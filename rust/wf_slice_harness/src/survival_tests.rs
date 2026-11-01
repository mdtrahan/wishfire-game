use crate::{rng::Rng, tests::ALLOCATIONS, tuning::*, *};

fn fixture() -> Sim {
    let mut s = Sim::composition_trial(SimConfig::default(), &[Archetype::Boss, Archetype::Orc]);
    s.scenario = Scenario::DodgeTrial {
        hazard: HazardKind::LizardoDrop,
        hero: Archetype::Fara,
    };
    s.combat.hazards.clear();
    s.combat.projectiles.clear();
    for (i, a) in s.combat.actors.iter_mut().enumerate() {
        a.state(ActorState::Idle, 0., 0.);
        a.view.pos = Vec2::new(300. + i as f32 * 50., 1100.);
        a.destination = a.view.pos;
        a.ai_cd = 100000.;
        a.basic_cd = 100000.;
        a.special_cd = 100000.;
        a.extra_cd = 100000.;
        a.pulse_cd = 100000.;
        a.pound_cd = 100000.;
        a.mend_cd = 100000.;
        a.action_done = true;
        a.stats.evade = 0.;
        a.stats.speed = 0.;
        a.view.hp = a.view.max_hp;
    }
    s.combat.events.clear();
    s
}
fn down(s: &mut Sim, i: usize) -> u32 {
    s.combat.actors[i].view.hp = 0.;
    s.combat.actors[i].state(ActorState::Downed, 0., 0.);
    s.combat.actors[i].view.id
}
fn spotlight(s: &mut Sim) {
    s.set_spotlight(SpotlightConfig {
        global_gap: 0.,
        hero_gap: 0.,
        fairness: 0.,
        charge: 1.2,
        ..SpotlightConfig::DEFAULT
    });
    let target = s.combat.actors[4].view.id;
    s.combat.start_arcane_pulse(3, target);
    s.combat.select_spotlight();
    assert!(s.combat.spotlight.active.is_some());
}

#[test]
fn every_boss_basic_caps_after_defense_and_crits_including_ranged_interceptors() {
    for kind in [
        Archetype::Boss,
        Archetype::BossBomber,
        Archetype::BossMarksman,
    ] {
        for ranged in [false, true] {
            let mut s = fixture();
            s.scenario = Scenario::Slice;
            s.combat.diagnostic_trial = false;
            s.combat.actors[4].view.archetype = kind;
            s.combat.actors[4].stats.atk = 1e8;
            s.combat.actors[4].stats.mag = s.combat.actors[4].stats.atk;
            s.combat.actors[4].stats.reach = if ranged { 400. } else { 100. };
            s.combat.actors[4].view.pos = Vec2::new(480., 900.);
            s.combat.actors[0].view.pos = Vec2::new(480., 1000.);
            s.combat.actors[1].view.pos = Vec2::new(480., 1050.);
            for n in 0..30 {
                s.combat.actors[0].view.hp = s.combat.actors[0].view.max_hp;
                let hp = s.combat.actors[0].view.hp;
                s.combat.start_action(
                    4,
                    Some(s.combat.actors[if ranged { 1 } else { 0 }].view.id),
                    false,
                    false,
                );
                s.combat.actors[4].view.state_age = s.combat.actors[4].view.impact_at;
                s.combat.action(4);
                if ranged {
                    assert!(s.combat.projectiles[0].boss_basic);
                    // Attribution survives a new actor state and physical first-body interception.
                    s.combat.actors[4].state(ActorState::Idle, 0., 0.);
                    for _ in 0..30 {
                        s.combat.move_projectiles();
                    }
                    s.combat.projectiles.clear();
                }
                assert!(
                    (hp - s.combat.actors[0].view.hp - hp * BOSS_BASIC_MAX_HP).abs() < 0.001,
                    "{kind:?} ranged={ranged} n={n} hp={hp} after={} ward={}",
                    s.combat.actors[0].view.hp,
                    s.combat.actors[0].view.ward
                );
            }
            let hp = s.combat.actors[0].view.max_hp;
            s.combat.actors[0].view.hp = hp;
            let damage = s.combat.damage(
                s.combat.actors[4].view.id,
                0,
                hp * 0.8,
                false,
                false,
                Element::Physical,
            );
            assert!(
                (damage - hp * 0.8).abs() < 0.001,
                "special damage is uncapped"
            );
        }
    }
}

#[test]
fn hit_stop_freezes_all_combat_for_exact_fixed_steps_and_prioritizes_boss_death() {
    for (actor, cause, seconds) in [
        (1, HitStopCause::HeroDowned, HERO_DOWN_HIT_STOP),
        (4, HitStopCause::BossDied, BOSS_DEATH_HIT_STOP),
    ] {
        let mut s = fixture();
        s.combat.actors[actor].view.hp = 0.;
        s.deaths();
        s.refresh_snapshot();
        assert_eq!(s.snapshot.hit_stop.unwrap().cause, cause);
        let before = format!(
            "{:?}{:?}{:?}",
            s.combat.actors, s.combat.hazards, s.combat.projectiles
        );
        let clock = s.combat.combat_steps;
        let step = s.combat.step_number;
        let n = (seconds * SIM_HZ as f32).ceil() as u32;
        for i in 0..n {
            ALLOCATIONS.with(|a| a.set(Some(0)));
            s.step();
            assert_eq!(ALLOCATIONS.with(|a| a.replace(None)), Some(0));
            assert_eq!(s.combat.combat_steps, clock);
            assert_eq!(
                format!(
                    "{:?}{:?}{:?}",
                    s.combat.actors, s.combat.hazards, s.combat.projectiles
                ),
                before
            );
            assert_eq!(s.combat.hit_stop.is_some(), i + 1 < n);
        }
        assert_eq!(s.combat.step_number, step + n as u64);
        s.step();
        assert_eq!(s.combat.combat_steps, clock + 1);
    }
    let mut s = fixture();
    s.combat.actors[0].view.hp = 0.;
    s.combat.actors[4].view.hp = 0.;
    s.deaths();
    assert_eq!(s.combat.hit_stop.unwrap().cause, HitStopCause::BossDied);
    assert_eq!(s.combat.hit_stop_steps, 12);
}

#[test]
fn hit_stop_and_spotlights_never_overlap_or_queue_and_reset_clears_freeze() {
    let mut s = fixture();
    spotlight(&mut s);
    s.combat.actors[1].view.hp = 0.;
    s.deaths();
    assert!(s.combat.hit_stop.is_none());
    assert!(s.combat.spotlight.active.is_some());
    s.combat.end_spotlight(false);
    s.combat
        .begin_hit_stop(HitStopCause::HeroDowned, s.combat.actors[1].view.id);
    s.combat.start_arcane_pulse(3, s.combat.actors[5].view.id);
    s.combat.select_spotlight();
    assert!(s.combat.spotlight.active.is_none());
    for _ in 0..5 {
        s.step();
    }
    s.combat.select_spotlight();
    assert!(s.combat.spotlight.active.is_none());
    s.combat
        .begin_hit_stop(HitStopCause::BossDied, s.combat.actors[4].view.id);
    s.reset_stage(false);
    assert!(s.combat.hit_stop.is_none());
}

#[test]
fn phoenix_input_applies_at_boundaries_completes_at_five_seconds_and_spends_thirty_second_cooldown()
{
    let mut s = fixture();
    let hero = down(&mut s, 1);
    for n in 1..=150 {
        s.combat.phoenix_hold(hero);
        if n == 1 {
            assert!(s.combat.phoenix.hero.is_none());
        }
        s.step();
        if n < 150 {
            assert_eq!(s.combat.actors[1].view.state, ActorState::Downed);
            assert_eq!(
                s.snapshot.phoenix_channel.unwrap().progress,
                n as f32 / 150.
            );
        }
    }
    assert!(s.combat.actors[1].alive());
    assert_eq!(
        s.combat.actors[1].view.hp,
        s.combat.actors[1].view.max_hp * REVIVE_HP
    );
    assert_eq!(s.snapshot.phoenix_cooldown, PHOENIX_COOLDOWN);
    assert!(s.snapshot.phoenix_channel.is_none());
    let events = s.drain_events();
    assert!(events.iter().any(|e| matches!(e,
        Event::Healed { target, amount, source:HealSource::Phoenix }
            if *target == hero && *amount == s.combat.actors[1].view.max_hp * REVIVE_HP)));
    assert_eq!(
        events
            .iter()
            .filter(|e| matches!(e, Event::PhoenixBegan { .. }))
            .count(),
        1
    );
    assert_eq!(
        events
            .iter()
            .filter(|e| matches!(e, Event::PhoenixCompleted { .. }))
            .count(),
        1
    );
    assert!(events
        .iter()
        .any(|e| matches!(e, Event::Revived{id} if *id==hero)));
    assert!(events
        .iter()
        .any(|e| matches!(e, Event::ReviveBurst{hero:id,..} if *id==hero)));
    down(&mut s, 1);
    for _ in 0..899 {
        s.combat.phoenix_hold(hero);
        s.step();
        assert!(s.combat.phoenix.hero.is_none());
    }
    s.combat.phoenix_hold(hero);
    s.step();
    assert_eq!(s.combat.phoenix.hero, Some(hero));
    assert_eq!(s.combat.phoenix.steps, 1);
}

#[test]
fn phoenix_release_missing_hold_invalid_target_switch_and_external_revive_cancel_without_cooldown()
{
    for mode in 0..4 {
        let mut s = fixture();
        let hero = down(&mut s, 1);
        s.combat.phoenix_hold(hero);
        s.step();
        match mode {
            0 => s.combat.phoenix_release(),
            1 => {}
            2 => s.combat.phoenix_hold(999999),
            _ => {
                s.combat.revive_hero(1);
            }
        }
        s.step();
        assert!(s.combat.phoenix.hero.is_none());
        assert_eq!(s.combat.phoenix.cooldown, 0);
        assert!(s
            .drain_events()
            .iter()
            .any(|e| matches!(e, Event::PhoenixCancelled{hero:id} if *id==hero)));
    }
    let mut s = fixture();
    let first = down(&mut s, 1);
    let second = down(&mut s, 2);
    s.combat.phoenix_hold(first);
    s.step();
    s.combat.phoenix_hold(second);
    s.step();
    assert_eq!(s.combat.phoenix.hero, Some(second));
    assert_eq!(s.combat.phoenix.steps, 1);
}

#[test]
fn phoenix_input_is_ignored_and_active_progress_and_cooldown_freeze_in_both_freezes() {
    for hit_stop in [false, true] {
        let mut s = fixture();
        let hero = down(&mut s, 1);
        s.combat.phoenix_hold(hero);
        s.step();
        if hit_stop {
            s.combat.begin_hit_stop(HitStopCause::HeroDowned, hero);
        } else {
            spotlight(&mut s);
        }
        s.combat.phoenix_hold(s.combat.actors[2].view.id);
        s.combat.phoenix_release();
        s.combat.actors[2].revive_immunity_steps = 60;
        s.combat.actors[5].burst_slow_steps = 60;
        let before = (
            s.combat.phoenix.hero,
            s.combat.phoenix.steps,
            s.combat.phoenix.cooldown,
        );
        for _ in 0..3 {
            s.step();
            assert_eq!(
                (
                    s.combat.phoenix.hero,
                    s.combat.phoenix.steps,
                    s.combat.phoenix.cooldown
                ),
                before
            );
            assert_eq!(s.combat.actors[2].revive_immunity_steps, 60);
            assert_eq!(s.combat.actors[5].burst_slow_steps, 60);
        }
        assert!(s.combat.phoenix.held.is_none());
    }
}

#[test]
fn normal_and_player_revives_share_burst_slow_immunity_and_existing_boss_push_roll() {
    for normal in [false, true] {
        for resist in [false, true] {
            let mut s = fixture();
            s.scenario = Scenario::Slice;
            s.combat.diagnostic_trial = false;
            let hero = down(&mut s, 1);
            let pos = s.combat.actors[1].view.pos;
            s.combat.actors[4].view.pos = pos + Vec2::new(80., 0.);
            s.combat.actors[5].view.pos = pos + Vec2::new(0., 90.);
            s.combat.actors[4].push_rng = (0..100)
                .map(Rng)
                .find(|r| {
                    let mut r = *r;
                    r.chance(0.5) == resist
                })
                .unwrap();
            s.combat.actors[4].view.energy = 0.;
            s.combat.actors[4].serial = 1;
            let boss_pos = s.combat.actors[4].view.pos;
            s.hazard(
                HazardKind::BossSlam,
                s.combat.actors[4].view.id,
                Some(hero),
                boss_pos,
                Vec2::new(1., 0.),
            );
            if normal {
                s.combat.actors[0].view.pos = pos;
                s.combat.start_action(0, Some(hero), false, true);
                s.combat.actors[0].view.state_age = REVIVE_CHANNEL;
                s.combat.action(0);
            } else {
                s.combat.revive_hero(1);
            }
            assert_eq!(s.combat.actors[4].view.pos == boss_pos, resist);
            assert!(s.combat.actors[5].view.pos.y > pos.y + 90.);
            assert_eq!(s.combat.actors[5].view.slowed, REVIVE_BURST_SLOW);
            assert_eq!(s.combat.actors[4].view.slowed, REVIVE_BURST_SLOW);
            assert_eq!(s.combat.hazards[0].cancelled, !resist);
            assert_eq!(s.combat.actors[4].view.energy == 1., !resist);
            let hp = s.combat.actors[1].view.hp;
            assert_eq!(
                s.combat.damage(
                    s.combat.actors[4].view.id,
                    1,
                    1e9,
                    true,
                    true,
                    Element::Physical
                ),
                0.
            );
            assert_eq!(s.combat.actors[1].view.hp, hp);
            s.combat.hazards.clear();
            for _ in 0..60 {
                s.combat.bubble_aura();
                s.combat.timers();
            }
            assert_eq!(s.combat.actors[5].view.slowed, 0.);
            assert_eq!(s.combat.actors[1].revive_immunity_steps, 0);
            assert!(
                s.combat.damage(
                    s.combat.actors[4].view.id,
                    1,
                    1.,
                    false,
                    false,
                    Element::Physical
                ) > 0.
            );
        }
    }
}

#[test]
fn phoenix_and_revive_effects_are_deterministic_hashed_and_allocation_free() {
    let mut a = fixture();
    let mut b = fixture();
    let hero = down(&mut a, 1);
    down(&mut b, 1);
    a.combat.phoenix_hold(hero);
    assert_ne!(a.state_hash(), b.state_hash());
    b.combat.phoenix_hold(hero);
    for n in 0..240 {
        if n < 150 {
            a.combat.phoenix_hold(hero);
            b.combat.phoenix_hold(hero);
        }
        ALLOCATIONS.with(|v| v.set(Some(0)));
        a.step();
        assert_eq!(ALLOCATIONS.with(|v| v.replace(None)), Some(0));
        b.step();
        assert_eq!(a.state_hash(), b.state_hash());
        assert_eq!(a.drain_events(), b.drain_events());
    }
}
