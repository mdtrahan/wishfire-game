use crate::{tests::ALLOCATIONS, tuning::*, *};
fn fixture(kind: Archetype) -> Sim {
    let mut s = Sim::composition_trial(SimConfig::default(), &[kind]);
    s.combat.hazards.clear();
    s.combat.projectiles.clear();
    for (i, a) in s.combat.actors.iter_mut().enumerate() {
        a.view.pos = Vec2::new(480. + i as f32 * 30., 1100.);
        a.destination = a.view.pos;
        a.target = None;
        a.basic_cd = 1000.;
        a.special_cd = 1000.;
        a.extra_cd = 1000.;
        a.pulse_cd = 1000.;
        a.pound_cd = 1000.;
        a.mend_cd = 1000.;
        a.summon_cd = 1000.;
        a.enmity = [0.; 4];
        a.enmity_seeded = true;
        a.aggro_target = None;
    }
    s.combat.actors[4].view.hp = 10000.;
    s.combat.actors[4].view.max_hp = 10000.;
    s.combat.events.clear();
    s
}
fn close(a: f32, b: f32) {
    assert!((a - b).abs() < 0.003, "{a} != {b}");
}
#[test]
fn damage_multipliers_and_single_hit_spike_are_boss_only() {
    let mut s = fixture(Archetype::Boss);
    for k in 0..4 {
        let id = s.combat.actors[k].view.id;
        s.combat.damage(id, 4, 20., false, false, Element::Physical);
    }
    assert_eq!(s.combat.actors[4].enmity, ENMITY_DAMAGE.map(|m| 20. * m));
    s.combat.actors[4].enmity = [0.; 4];
    let spike = s.combat.actors[4].view.max_hp * ENMITY_SPIKE_HP;
    s.combat.damage(
        s.combat.actors[2].view.id,
        4,
        spike,
        false,
        false,
        Element::Arcane,
    );
    assert_eq!(s.combat.actors[4].enmity, [0., 0., spike * 2., 0.]);
    let id = s.spawn_actor(Archetype::Orc, Vec2::new(500., 1100.));
    let i = s.combat.actor_index(id).unwrap();
    s.combat.damage(
        s.combat.actors[0].view.id,
        i,
        20.,
        false,
        false,
        Element::Physical,
    );
    assert_eq!(s.combat.actors[i].enmity, [0.; 4]);
}
#[test]
fn spotlight_attack_doubles_even_small_hits_without_quadrupling_spikes() {
    let mut s = fixture(Archetype::Boss);
    s.combat.cfg.spotlight = SpotlightConfig {
        global_gap: 0.,
        hero_gap: 0.,
        fairness: 0.,
        charge: 0.,
        ..SpotlightConfig::DEFAULT
    };
    s.combat.start_ground_pound(0, s.combat.actors[4].view.id);
    s.combat.select_spotlight();
    assert!(s.combat.spotlight.active.is_some());
    s.combat.damage(
        s.combat.actors[0].view.id,
        4,
        10.,
        false,
        false,
        Element::Physical,
    );
    close(s.combat.actors[4].enmity[0], 10. * ENMITY_DAMAGE[0] * 2.);
    let spike = s.combat.actors[4].view.max_hp * ENMITY_SPIKE_HP;
    s.combat.damage(
        s.combat.actors[0].view.id,
        4,
        spike,
        false,
        false,
        Element::Physical,
    );
    close(
        s.combat.actors[4].enmity[0],
        (10. + spike) * ENMITY_DAMAGE[0] * 2.,
    );
}
#[test]
fn healing_splits_across_living_bosses_ward_is_per_boss_and_zero_heal_adds_nothing() {
    let mut s = fixture(Archetype::Boss);
    let id = s.spawn_actor(Archetype::BossBomber, Vec2::new(500., 1000.));
    let j = s.combat.actor_index(id).unwrap();
    s.combat.actors[j].enmity = [0.; 4];
    s.combat.healing_enmity(s.combat.actors[2].view.id, 100.);
    close(s.combat.actors[4].enmity[2], 100. * ENMITY_HEAL / 2.);
    close(s.combat.actors[j].enmity[2], 100. * ENMITY_HEAL / 2.);
    s.combat.healing_enmity(s.combat.actors[2].view.id, 0.);
    close(s.combat.actors[4].enmity[2], 100. * ENMITY_HEAL / 2.);
    s.combat.grant_ward(0);
    let expected = s.combat.actors[0].view.ward * ENMITY_WARD;
    close(s.combat.actors[4].enmity[0], expected);
    close(s.combat.actors[j].enmity[0], expected);
    s.combat.actors[j].view.hp = 0.;
    s.combat.healing_enmity(s.combat.actors[2].view.id, 100.);
    close(s.combat.actors[4].enmity[2], 150. * ENMITY_HEAL);
}
#[test]
fn actual_spring_heal_and_mend_credit_the_caster_for_actual_hp() {
    let mut s = fixture(Archetype::Boss);
    for a in &mut s.combat.actors[..4] {
        a.view.hp = a.view.max_hp * 0.5;
    }
    s.combat.super_heal(2, 0);
    let healed: f32 = s
        .drain_events()
        .iter()
        .filter_map(|e| match e {
            Event::Healed { amount, .. } => Some(*amount),
            _ => None,
        })
        .sum();
    assert!(healed > 0.);
    close(s.combat.actors[4].enmity[2], healed * ENMITY_HEAL);
    assert_eq!(s.combat.actors[4].enmity[0], 0.);
    s.combat.hazards.clear();
    s.combat.actors[3].mend_cd = 0.;
    s.combat.actions();
    let healed: f32 = s
        .drain_events()
        .iter()
        .filter_map(|e| match e {
            Event::Healed { amount, .. } => Some(*amount),
            _ => None,
        })
        .sum();
    assert!(healed > 0.);
    close(s.combat.actors[4].enmity[3], healed * ENMITY_HEAL);
}
#[test]
fn combat_decay_and_fade_apply_exact_rates_and_zero_downed_rows() {
    let mut s = fixture(Archetype::Boss);
    s.combat.actors[4].enmity = [100.; 4];
    s.combat.enmity_step();
    close(s.combat.actors[4].enmity[0], 100. * (1. - 0.02 * SIM_DT));
    close(s.combat.actors[4].enmity[1], 100. * (1. - 0.22 * SIM_DT));
    s.combat.actors[1].view.hp = 0.;
    s.combat.enmity_step();
    assert_eq!(s.combat.actors[4].enmity[1], 0.);
    s.combat.actors[1].view.hp = 100.;
    assert_eq!(
        s.combat.actors[4].enmity[1], 0.,
        "revival does not restore old threat"
    );
}
#[test]
fn arrival_seed_is_small_proximity_ordered_and_excludes_downed() {
    let mut s = fixture(Archetype::Boss);
    s.combat.actors[4].enmity_seeded = false;
    s.combat.actors[4].view.pos = s.combat.actors[0].view.pos + Vec2::new(-100., 0.);
    s.combat.actors[3].view.hp = 0.;
    s.combat.seed_enmity(4);
    let v = s.combat.actors[4].enmity;
    assert!(v[0] > v[1] && v[1] > v[2]);
    assert_eq!(v[3], 0.);
    assert!(v[0] <= ENMITY_SEED);
    s.combat.actors[0].view.pos.x += 500.;
    s.combat.seed_enmity(4);
    assert_eq!(s.combat.actors[4].enmity, v);
}
#[test]
fn target_hysteresis_is_ten_percent_and_djinn_basics_thirty_percent() {
    for kind in [
        Archetype::Boss,
        Archetype::BossBomber,
        Archetype::BossMarksman,
    ] {
        let mut s = fixture(kind);
        s.combat.actors[4].enmity = [100., 109., 0., 0.];
        s.combat.actors[4].aggro_target = Some(s.combat.actors[0].view.id);
        assert_eq!(s.combat.enmity_target(4, false), Some(0));
        s.combat.actors[4].enmity[1] = 111.;
        assert_eq!(s.combat.enmity_target(4, false), Some(1));
        if kind == Archetype::BossMarksman {
            assert_eq!(s.combat.enmity_target(4, true), Some(0));
            s.combat.actors[4].enmity[1] = 131.;
            assert_eq!(s.combat.enmity_target(4, true), Some(1));
        }
        s.combat.actors[0].view.hp = 0.;
        assert_eq!(s.combat.enmity_target(4, true), Some(1));
    }
}
#[test]
fn regular_enemies_keep_proximity_and_committed_attack_targets_stay_locked() {
    let mut s = fixture(Archetype::Boss);
    s.combat.actors[4].enmity = [100., 0., 0., 0.];
    s.combat.choose_boss_aggro(4);
    s.combat
        .start_action(4, Some(s.combat.actors[0].view.id), false, false);
    let target = s.combat.actors[4].target;
    s.combat.actors[4].enmity[2] = 500.;
    s.combat.enmity_step();
    assert_eq!(
        s.combat.actors[4].aggro_target,
        Some(s.combat.actors[2].view.id)
    );
    assert_eq!(s.combat.actors[4].target, target);
    let id = s.spawn_actor(Archetype::Orc, s.combat.actors[1].view.pos);
    let i = s.combat.actor_index(id).unwrap();
    s.combat.actors[i].enmity = [1000., 0., 0., 0.];
    assert_eq!(s.combat.enemy_target(i), Some(1));
}
#[test]
fn aggro_event_emits_once_per_switch_and_snapshot_publishes_all_targets_and_rows() {
    let mut s = fixture(Archetype::Boss);
    s.combat.actors[4].enmity = [100., 0., 0., 0.];
    s.combat.choose_boss_aggro(4);
    s.combat.choose_boss_aggro(4);
    assert_eq!(
        s.drain_events()
            .iter()
            .filter(|e| matches!(e, Event::AggroChanged { from: None, .. }))
            .count(),
        1
    );
    s.combat.actors[4].enmity[1] = 111.;
    s.combat.choose_boss_aggro(4);
    let es = s.drain_events();
    assert!(es.iter().any(|e| matches!(
        e,
        Event::AggroChanged {
            from: Some(1),
            to: 2,
            ..
        }
    )));
    s.combat.actors[4].target = Some(2);
    s.combat.actors[0].target = Some(s.combat.actors[4].view.id);
    s.combat.actors[1].view.hp = 0.;
    s.refresh_snapshot();
    assert_eq!(
        s.snapshot.actors[0].target,
        Some(s.combat.actors[4].view.id)
    );
    assert_eq!(s.snapshot.actors[4].target, Some(2));
    assert_eq!(s.snapshot.enmity.len(), 1);
    assert_eq!(s.snapshot.enmity[0].values, [100., 0., 0., 0.]);
    s.combat.actors[4].view.hp = 0.;
    s.refresh_snapshot();
    assert!(s.snapshot.enmity.is_empty());
}
#[test]
fn protective_taunt_gate_boost_and_forced_duration() {
    let mut s = fixture(Archetype::Boss);
    s.combat.actors[4].enmity = [100., 0., 0., 0.];
    s.combat.choose_boss_aggro(4);
    assert_eq!(s.combat.protective_taunt(0), None);
    s.combat.actors[4].enmity[1] = 120.;
    assert_eq!(s.combat.protective_taunt(0), Some((4, 0)));
    s.combat.choose_boss_aggro(4);
    s.combat.taunt(0);
    close(s.combat.actors[4].enmity[0], 120. * ENMITY_TAUNT_MULTIPLIER);
    assert_eq!(s.combat.taunt_target(4), Some(0));
    close(s.combat.actors[4].taunt_left, TAUNT_DURATION);
    assert!(s.drain_events().iter().any(|e| matches!(
        e,
        Event::AggroChanged {
            from: Some(2),
            to: 1,
            ..
        }
    )));
    s.combat.actors[4].taunt_left = 0.;
    s.combat.actors[4].enmity = [100., 95., 0., 0.];
    s.combat.actors[4].aggro_target = Some(2);
    s.combat.actors[1].view.hp = s.combat.actors[1].view.max_hp * 0.49;
    assert_eq!(s.combat.protective_taunt(0), Some((4, 1)));
    s.combat.actors[4].view.pos.x += TAUNT_RADIUS * 2.;
    assert_eq!(s.combat.protective_taunt(0), None);
}
#[test]
fn telegraphs_try_highest_enmity_then_next_coverable_hero() {
    let mut s = fixture(Archetype::BossBomber);
    s.combat.actors[4].boss_attack = crate::enmity::BossAttack::Nova;
    s.combat.actors[4].view.pos = Vec2::new(480., 1100.);
    for a in &mut s.combat.actors[..4] {
        a.view.pos = Vec2::new(480., 1500.);
    }
    s.combat.actors[0].view.pos = Vec2::new(480., 1150.);
    s.combat.actors[4].enmity = [10., 100., 0., 0.];
    assert_eq!(s.combat.boss_attack_kind(4), HazardKind::BossNova);
    assert_eq!(
        s.combat
            .boss_attack_target(4, 1, crate::enmity::BossAttack::Nova)
            .unwrap_or(1),
        0
    );
    s.combat.actors[1].view.pos = Vec2::new(480., 1140.);
    assert_eq!(
        s.combat
            .boss_attack_target(4, 1, crate::enmity::BossAttack::Nova)
            .unwrap_or(1),
        1
    );
    s.combat.actors[4].taunted_by = Some(2);
    s.combat.actors[4].taunt_left = 4.;
    s.combat.actors[1].view.pos = Vec2::new(480., 1500.);
    assert_eq!(
        s.combat
            .boss_attack_target(4, 1, crate::enmity::BossAttack::Nova)
            .unwrap_or(1),
        1,
        "forced target closes instead of bypassing taunt"
    );
}
#[test]
fn breather_is_fara_only_and_cannot_revive() {
    let mut s = fixture(Archetype::Boss);
    for a in &mut s.combat.actors[..4] {
        a.view.hp = 100.;
        a.undamaged = 10.;
    }
    s.combat.timers();
    assert!(s.combat.actors[0].view.hp > 100.);
    assert_eq!(s.combat.actors[1].view.hp, 100.);
    assert_eq!(s.combat.actors[2].view.hp, 100.);
    assert_eq!(s.combat.actors[3].view.hp, 100.);
    s.combat.actors[0].view.hp = 0.;
    s.combat.timers();
    assert_eq!(s.combat.actors[0].view.hp, 0.);
}
#[test]
fn charge_and_tail_freeze_threat_and_performing_only_adds_skill_threat() {
    let mut s = fixture(Archetype::Boss);
    s.combat.actors[4].enmity = [100.; 4];
    s.combat.cfg.spotlight = SpotlightConfig {
        global_gap: 0.,
        hero_gap: 0.,
        fairness: 0.,
        charge: 0.2,
        auto_release: false,
        tail_cap: 2.,
        ..SpotlightConfig::DEFAULT
    };
    s.combat.start_ground_pound(0, s.combat.actors[4].view.id);
    s.combat.select_spotlight();
    assert!(s.combat.spotlight.active.is_some());
    let values = s.combat.actors[4].enmity;
    let combat = s.combat.combat_steps;
    let target = s.combat.actors[4].aggro_target;
    for _ in 0..6 {
        s.step();
        assert_eq!(s.combat.actors[4].enmity, values);
        assert_eq!(s.combat.actors[4].aggro_target, target);
        assert_eq!(s.combat.combat_steps, combat);
        s.drain_events();
    }
    for _ in 0..100 {
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
    let after = s.combat.actors[4].enmity;
    assert!(after[0] > values[0]);
    assert_eq!(&after[1..], &values[1..]);
    for _ in 0..10 {
        s.step();
        assert_eq!(s.combat.actors[4].enmity, after);
        assert_eq!(s.combat.combat_steps, combat);
        s.drain_events();
    }
    s.release_spotlight();
    s.step();
    assert!(s.combat.combat_steps > combat);
}
#[test]
fn deterministic_boss_tables_and_snapshots_allocate_nothing_off_and_on() {
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
