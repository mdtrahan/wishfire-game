use crate::{tuning::*, *};
fn fixture(kinds: &[Archetype]) -> Sim {
    let mut s = Sim::composition_trial(SimConfig::default(), kinds);
    s.combat.hazards.clear();
    for (i, a) in s.combat.actors.iter_mut().enumerate() {
        a.view.pos = Vec2::new(480. + (i as f32 - 1.) * 55., 1100.);
        a.destination = a.view.pos;
        a.formed_age = 100.;
        a.stats.evade = 0.;
        a.basic_cd = 100.;
        a.mend_cd = 100.;
        a.ai_cd = 100.;
        a.view.ai_intent = AiIntent::Attack;
    }
    let target = s.combat.actors[4].view.id;
    for a in &mut s.combat.actors[..4] {
        a.target = Some(target);
    }
    s.combat.actors[3].elevate_choice = Some(ElevateVariant::Sword);
    s.combat.events.clear();
    s
}
#[test]
fn fara_rage_hit_gain_uses_landed_hp_and_ward_damage_with_cap() {
    let mut s = fixture(&[Archetype::Orc]);
    let source = s.combat.actors[4].view.id;
    let hp = s.combat.actors[0].view.max_hp;
    let taken = s
        .combat
        .damage(source, 0, 20., false, true, Element::Physical);
    assert!((s.combat.actors[0].view.meter - (RAGE_HIT_FLAT + taken / hp)).abs() < 0.00001);
    s.combat.actors[0].view.meter = 0.;
    s.combat
        .damage(source, 0, hp, false, false, Element::Physical);
    assert_eq!(s.combat.actors[0].view.meter, RAGE_HIT_CAP);
    s.combat.actors[0].view.hp = hp;
    s.combat.actors[0].view.meter = 0.;
    s.combat.actors[0].stats.evade = 1.;
    s.combat
        .damage(source, 0, 20., true, true, Element::Physical);
    assert_eq!(s.combat.actors[0].view.meter, 0.);
    s.combat.actors[0].stats.evade = 0.;
    for (ward, raw) in [(hp, 20.), (10., 20.), (hp, hp)] {
        s.combat.actors[0].view.ward = ward;
        s.combat.actors[0].view.meter = 0.;
        let before_hp = s.combat.actors[0].view.hp;
        let taken = s
            .combat
            .damage(source, 0, raw, false, false, Element::Physical);
        let expected = (RAGE_HIT_FLAT + taken / hp).min(RAGE_HIT_CAP);
        assert!((s.combat.actors[0].view.meter - expected).abs() < 0.00001);
        if ward >= raw {
            assert_eq!(s.combat.actors[0].view.hp, before_hp);
        }
    }
    s.combat.actors[0].view.meter = 0.;
    s.combat.basic_groove(s.combat.actors[0].view.id);
    s.combat.taunt(0);
    s.combat.timers();
    assert_eq!(s.combat.actors[0].view.meter, 0.);
}
#[test]
fn fara_rage_fills_from_time_alone_caps_and_pauses_while_downed() {
    let mut s = fixture(&[Archetype::Orc]);
    let steps = (RAGE_FILL_SECONDS / SIM_DT).round() as usize;
    for _ in 0..steps - 1 {
        s.combat.groove_timers();
    }
    assert!(s.combat.actors[0].view.meter < 1.);
    s.combat.groove_timers();
    assert!((s.combat.actors[0].view.meter - 1.).abs() < 0.00001);
    for _ in 0..steps {
        s.combat.groove_timers();
    }
    assert!((s.combat.actors[0].view.meter - 2.).abs() < 0.00002);
    for _ in 0..steps {
        s.combat.groove_timers();
    }
    assert!((s.combat.actors[0].view.meter - 3.).abs() < 0.0001);
    // Float accumulation may need one extra fixed step to reach the exact cap.
    s.combat.groove_timers();
    assert_eq!(s.combat.actors[0].view.meter, 3.);
    s.combat.groove_timers();
    assert_eq!(s.combat.actors[0].view.meter, 3.);
    s.combat.actors[0].view.hp = 0.;
    s.deaths();
    let meter = s.combat.actors[0].view.meter;
    for _ in 0..steps {
        s.combat.groove_timers();
    }
    assert_eq!(s.combat.actors[0].view.meter, meter);
}
#[test]
fn passive_fill_preserves_independent_rage_and_basic_gains() {
    let mut s = fixture(&[Archetype::Orc]);
    s.combat.actors[1].view.meter = 0.2;
    s.combat.actors[2].view.meter = 0.5;
    s.combat.actors[3].view.meter = 0.75;
    let source = s.combat.actors[4].view.id;
    for i in 0..4 {
        s.combat.actors[i].view.ward = 20.;
        s.combat
            .damage(source, i, 10., false, false, Element::Physical);
    }
    assert_eq!(s.combat.actors[1].view.meter, 0.2);
    assert_eq!(s.combat.actors[2].view.meter, 0.5);
    assert_eq!(s.combat.actors[3].view.meter, 0.75);
    for _ in 0..30 {
        s.combat.groove_timers();
    }
    assert!(
        (s.combat.actors[1].view.meter - (0.2 + 30. * SIM_DT / COMBO_FILL_SECONDS)).abs() < 0.00001
    );
    assert!(
        (s.combat.actors[2].view.meter - (0.5 + 30. * SIM_DT / SUPER_FILL_SECONDS)).abs() < 0.00001
    );
    assert!(
        (s.combat.actors[3].view.meter - (0.75 + 30. * SIM_DT / POWER_STOCK_SECONDS)).abs()
            < 0.00001
    );
    let hondo = s.combat.actors[1].view.meter;
    let runa = s.combat.actors[2].view.meter;
    s.combat.basic_groove(s.combat.actors[1].view.id);
    s.combat.basic_groove(s.combat.actors[2].view.id);
    assert_eq!(s.combat.actors[1].view.meter, hondo + COMBO_BASIC_GAIN);
    assert_eq!(s.combat.actors[2].view.meter, runa + SUPER_BASIC_GAIN);
}
#[test]
fn passive_fill_reaches_each_stock_and_caps_for_every_hero() {
    for (i, seconds, cap) in [
        (0, RAGE_FILL_SECONDS, 3),
        (1, COMBO_FILL_SECONDS, 1),
        (2, SUPER_FILL_SECONDS, 3),
        (3, POWER_STOCK_SECONDS, 3),
    ] {
        let mut s = fixture(&[Archetype::Orc]);
        let steps = (seconds / SIM_DT).round() as usize;
        for stock in 1..=cap {
            for _ in 0..steps {
                s.combat.groove_timers();
            }
            let expected = (stock as f32 * steps as f32 * SIM_DT / seconds).min(cap as f32);
            assert!((s.combat.actors[i].view.meter - expected).abs() < 0.0001);
        }
        for _ in 0..steps {
            s.combat.groove_timers();
        }
        s.combat.basic_groove(s.combat.actors[i].view.id);
        assert_eq!(s.combat.actors[i].view.meter, cap as f32);
        assert_eq!(s.combat.actors[4].view.meter, 0.);
    }
}
#[test]
fn new_passive_fill_pauses_when_downed_or_combo_committed() {
    let mut s = fixture(&[Archetype::Orc]);
    for i in [1, 2] {
        s.combat.actors[i].view.hp = 0.;
    }
    s.deaths();
    s.combat.groove_timers();
    assert_eq!(s.combat.actors[1].view.meter, 0.);
    assert_eq!(s.combat.actors[2].view.meter, 0.);
    s.combat.actors[1].view.hp = 100.;
    for phase in 1..=4 {
        s.combat.actors[1].combo_phase = phase;
        s.combat.actors[1].view.meter = 0.5;
        s.combat.actors[1].view.groove_active = COMBO_SECONDS * 0.5;
        s.combat.groove_timers();
        let expected = if phase == 2 {
            0.5 - SIM_DT / COMBO_SECONDS
        } else {
            0.5
        };
        assert!((s.combat.actors[1].view.meter - expected).abs() < 0.00001);
    }
}
#[test]
fn runa_spends_passively_earned_stocks_on_bubble_and_heal() {
    for heal in [false, true] {
        let mut s = fixture(&[Archetype::Orc]);
        if heal {
            s.combat.actors[2].view.hp = s.combat.actors[2].view.max_hp * 0.5;
        }
        for _ in 0..(SUPER_FILL_SECONDS / SIM_DT).round() as usize + MAGE_AOE_HOLD_STEPS as usize {
            s.combat.groove_timers();
        }
        let meter = s.combat.actors[2].view.meter;
        assert!(s.combat.groove_action(2), "heal={heal}");
        assert!(s.combat.actors[2].view.special_casting);
        assert_eq!(s.combat.actors[2].action_extra, heal);
        assert_eq!(s.combat.actors[2].view.meter, meter - 1.);
    }
}
#[test]
fn fara_holds_stocks_without_target_and_pound_needs_and_spends_one() {
    let mut s = fixture(&[Archetype::Orc]);
    s.combat.actors[0].view.meter = 2.;
    s.combat.actors[4].view.pos = Vec2::new(480., ARENA_MIN.y + 100.);
    assert!(!s.combat.groove_action(0));
    assert_eq!(s.combat.actors[0].view.meter, 2.);
    s.combat.actors[4].view.pos = Vec2::new(480., 1100.);
    s.combat.actors[4].target = Some(s.combat.actors[0].view.id);
    s.combat.actors[2].view.pos.y = ARENA_MAX.y - 50.;
    s.combat.actors[3].view.pos.y = ARENA_MAX.y - 50.;
    for meter in [0., 0.5, 0.999] {
        s.combat.actors[0].view.meter = meter;
        assert!(!s.combat.groove_action(0));
        assert_eq!(s.combat.actors[0].view.meter, meter);
    }
    s.combat.actors[0].view.meter = 1.;
    assert!(s.combat.groove_action(0));
    assert!(s.combat.actors[0].action_pound);
    assert_eq!(s.combat.actors[0].view.meter, 0.);
    s.combat.actors[0].view.state_age = CAST_IMPACT;
    s.combat.action(0);
    for _ in 0..(GROUND_POUND_COUNTDOWN * SIM_HZ as f32).ceil() as u32 {
        s.combat.update_hazards();
        s.resolve_hazards();
    }
    assert_eq!(s.combat.actors[0].view.ward, 0.);
    assert!(!s.combat.actors[0].view.warcry_shield);
    assert!(!s
        .drain_events()
        .iter()
        .any(|e| matches!(e, Event::WardGained { .. })));
}
#[test]
fn ground_pound_can_spend_each_remaining_stock_without_refilling() {
    let mut s = fixture(&[Archetype::Orc]);
    s.combat.actors[4].target = Some(s.combat.actors[0].view.id);
    s.combat.actors[2].view.pos.y = ARENA_MAX.y - 50.;
    s.combat.actors[3].view.pos.y = ARENA_MAX.y - 50.;
    s.combat.actors[0].view.meter = 3.;
    for remaining in [2., 1., 0.] {
        assert!(s.combat.groove_action(0));
        assert!(s.combat.actors[0].action_pound);
        assert_eq!(s.combat.actors[0].view.meter, remaining);
        assert!(s.drain_events().iter().any(|e| matches!(
            e,
            Event::GrooveSpent {
                skill: Skill::GroundPound,
                bars: 1.,
                ..
            }
        )));
        assert!(!s.combat.groove_action(0)); // Committed cast still blocks chaining.
        for _ in 0..(CAST_DURATION / SIM_DT).ceil() as usize + 1 {
            s.combat.timers();
            s.combat.action(0);
        }
    }
    assert!(!s.combat.groove_action(0));
    assert_eq!(s.combat.actors[0].view.meter, 0.);
}
#[test]
fn crowd_ally_threat_prioritizes_warcry_taunts_and_grants_self_shield() {
    let mut s = fixture(&[Archetype::Orc, Archetype::Orc]);
    let fara = s.combat.actors[0].view.id;
    let ally = s.combat.actors[1].view.id;
    for i in 4..6 {
        s.combat.actors[i].view.pos =
            s.combat.actors[0].view.pos + Vec2::new(100. + (i - 4) as f32 * 50., 0.);
        s.combat.actors[i].target = Some(ally);
        assert!(s.combat.can_engage(0, i));
        assert!(
            s.combat.actors[0]
                .view
                .pos
                .distance(s.combat.actors[i].view.pos)
                <= GROUND_POUND_LENGTH
        );
    }
    s.combat.actors[0].view.meter = 2.;
    assert!(s.combat.groove_action(0));
    assert!(s.combat.actors[0].action_extra && !s.combat.actors[0].action_pound);
    assert_eq!(s.combat.actors[0].view.meter, 1.);
    assert_eq!(s.combat.actors[0].view.ward, 0.);
    s.combat.actors[0].view.state_age = WARCRY_WINDUP;
    s.combat.action(0);
    let events = s.drain_events();
    let enemies = [s.combat.actors[4].view.id, s.combat.actors[5].view.id];
    assert!(events
        .iter()
        .any(|e| matches!(e, Event::Taunt { hero, enemies: ids, .. }
        if *hero == fara && ids.as_slice() == enemies)));
    let shield = s.combat.actors[0].view.max_hp * WARCRY_WARD_FRACTION;
    assert!(events
        .iter()
        .any(|e| matches!(e, Event::WardGained { target, amount }
        if *target == fara && *amount == shield)));
    assert_eq!(s.combat.actors[0].view.ward, shield);
    assert!(s.combat.actors[0].view.warcry_shield);
    assert_eq!(s.combat.actors[0].self_ward_steps, 0);
    for i in 4..6 {
        assert_eq!(s.combat.actors[i].taunted_by, Some(fara));
    }
}
#[test]
fn warcry_spends_one_and_preempts_pound_for_any_living_ally_and_enemy_kind() {
    for kind in [
        Archetype::Orc,
        Archetype::Sniper,
        Archetype::Boss,
        Archetype::BossBomber,
        Archetype::BossMarksman,
    ] {
        for ally in 1..4 {
            for meter in [1., 1.5, 2.] {
                let mut s = fixture(&[kind]);
                // No mage proximity reason: even a full-health Hondo warrants Warcry.
                s.combat.actors[2].view.pos.y = ARENA_MAX.y - 50.;
                s.combat.actors[3].view.pos.y = ARENA_MAX.y - 50.;
                s.combat.actors[4].view.pos = s.combat.actors[0].view.pos + Vec2::new(150., 0.);
                s.combat.actors[4].target = Some(s.combat.actors[ally].view.id);
                s.combat.actors[0].view.meter = meter;
                assert!(
                    s.combat.groove_action(0),
                    "{kind:?}, ally {ally}, meter {meter}"
                );
                assert!(s.combat.actors[0].action_extra && !s.combat.actors[0].action_pound);
                assert_eq!(s.combat.actors[0].view.meter, meter - 1.);
            }
        }
    }
}
#[test]
fn warcry_retains_backline_proximity_reason_and_rejects_unavailable_enemies() {
    let mut s = fixture(&[Archetype::Orc]);
    s.combat.actors[4].target = Some(s.combat.actors[0].view.id);
    s.combat.actors[2].view.pos = s.combat.actors[4].view.pos;
    s.combat.actors[0].view.meter = 2.;
    assert!(s.combat.groove_action(0));
    assert!(s.combat.actors[0].action_extra);
    for case in 0..4 {
        let mut s = fixture(&[Archetype::Sniper]);
        s.combat.actors[0].view.meter = 1.;
        s.combat.actors[4].target = Some(s.combat.actors[1].view.id);
        match case {
            0 => s.combat.actors[1].view.hp = 0.,
            1 => s.combat.actors[4].begin_spawn(),
            2 => s.combat.actors[4].formed_age = 0.,
            _ => {
                s.combat.actors[4].view.pos =
                    s.combat.actors[0].view.pos + Vec2::new(TAUNT_RADIUS + 1., 0.)
            }
        }
        // A dead ally removes the Warcry reason; the living foe still permits Pound.
        assert_eq!(s.combat.groove_action(0), case == 0, "case {case}");
        assert!(!s.combat.actors[0].action_extra);
        assert_eq!(s.combat.actors[0].action_pound, case == 0);
        assert_eq!(
            s.combat.actors[0].view.meter,
            if case == 0 { 0. } else { 1. }
        );
    }
}
#[test]
fn rage_hit_gain_caps_at_three_stocks() {
    let mut s = fixture(&[Archetype::Orc]);
    s.combat.actors[0].view.meter = 2.99;
    s.combat.damage(
        s.combat.actors[4].view.id,
        0,
        10.,
        false,
        false,
        Element::Physical,
    );
    assert_eq!(s.combat.actors[0].view.meter, 3.);
    s.combat.damage(
        s.combat.actors[4].view.id,
        0,
        10.,
        false,
        false,
        Element::Physical,
    );
    assert_eq!(s.combat.actors[0].view.meter, 3.);
}
#[test]
fn landed_basics_fill_hondo_and_runa_but_misses_splash_and_other_heroes_do_not() {
    let mut s = fixture(&[Archetype::Orc, Archetype::Orc]);
    // Hondo's real claw hit and stat miss.
    s.combat
        .start_action(1, Some(s.combat.actors[4].view.id), false, false);
    s.combat.actors[1].view.state_age = BASIC_IMPACT;
    s.combat.action(1);
    assert_eq!(s.combat.actors[1].view.meter, COMBO_BASIC_GAIN);
    s.combat.actors[1].view.state_age = BASIC_DURATION;
    s.combat.actors[4].stats.evade = 1.;
    s.combat
        .start_action(1, Some(s.combat.actors[4].view.id), false, false);
    s.combat.actors[1].view.state_age = BASIC_IMPACT;
    s.combat.action(1);
    assert_eq!(s.combat.actors[1].view.meter, COMBO_BASIC_GAIN);
    s.combat.actors[4].stats.evade = 0.;
    s.combat.actors[4].view.pos = Vec2::new(500., 1200.);
    s.combat.actors[5].view.pos = s.combat.actors[4].view.pos + Vec2::new(20., 0.);
    s.combat.actors[4].view.hp = 10000.;
    s.combat.actors[5].view.hp = 10000.;
    s.combat
        .start_action(2, Some(s.combat.actors[4].view.id), false, false);
    s.combat.actors[2].view.state_age = BASIC_IMPACT;
    s.combat.action(2);
    for _ in 0..30 {
        s.combat.move_projectiles();
    }
    assert!((s.combat.actors[2].view.meter - SUPER_BASIC_GAIN).abs() < 0.00001);
    assert!(s.combat.actors[5].view.hp < 10000.);
    assert_eq!(s.combat.actors[3].view.meter, 0.);
}
fn combo_fixture(boss: bool) -> Sim {
    let mut s = fixture(&[
        if boss {
            Archetype::Boss
        } else {
            Archetype::Orc
        },
        Archetype::Orc,
    ]);
    for a in &mut s.combat.actors {
        a.view.hp = 100000.;
    }
    s.combat.actors[0].view.pos = Vec2::new(200., ARENA_MIN.y + 100.);
    s.combat.actors[2].view.pos = Vec2::new(300., ARENA_MIN.y + 100.);
    s.combat.actors[3].view.pos = Vec2::new(400., ARENA_MIN.y + 100.);
    s.combat.actors[1].view.pos = Vec2::new(480., 1100.);
    s.combat.actors[4].view.pos = Vec2::new(570., 1100.);
    s.combat.actors[5].view.pos = Vec2::new(570., 1200.);
    s.combat.actors[1].view.meter = 1.;
    s
}
#[test]
fn combo_chains_full_cast_shadows_safe_long_hops_then_split_and_no_basic_gain() {
    for boss in [false, true] {
        let mut s = combo_fixture(boss);
        s.combat.actors[1].view.meter = 0.;
        for _ in 0..=(COMBO_FILL_SECONDS / SIM_DT).round() as usize {
            s.combat.groove_timers();
        }
        assert!(s.combat.groove_action(1));
        let origin = s.combat.actors[1].view.pos;
        for _ in 0..9 {
            s.combat.timers();
            s.combat.groove_timers();
            s.combat.action(1);
        }
        assert_eq!(s.combat.actors[1].view.groove_active, 0.);
        assert!(s.combat.actors[1].view.special_casting);
        let mut hops = 0;
        let mut last_hop_step = None;
        let mut split = false;
        for step in 0..240 {
            s.combat.timers();
            s.combat.groove_timers();
            if !s.combat.actors[1].committed() {
                s.combat.groove_action(1);
            }
            s.combat.action(1);
            for event in s.drain_events() {
                match event {
                    Event::Blink {
                        from, to, target, ..
                    } => {
                        assert!(from.distance(to) + 0.001 >= COMBO_MIN_HOP);
                        assert!(to.distance(origin) <= COMBO_RADIUS + 0.001);
                        assert_eq!(to, crate::math::floor_point(to, BODY_RADIUS));
                        let t = s.combat.actor_index(target).unwrap();
                        assert!(
                            to.distance(s.combat.actors[t].view.pos)
                                >= BODY_RADIUS + s.combat.actors[t].view.radius
                        );
                        let center = s.combat.actors[t].view.pos;
                        assert!(crate::groove::shadow_line_aligned(from, center));
                        assert!(crate::groove::shadow_line_aligned(to, center));
                        assert!(crate::groove::shadow_line_aligned(from, to));
                        assert!((from.x - center.x) * (to.x - center.x) < 0.);
                        if let Some(before) = last_hop_step {
                            assert!((step - before) as f32 * SIM_DT >= CAST_DURATION - 0.001);
                        }
                        last_hop_step = Some(step);
                        hops += 1;
                    }
                    Event::SplitStrike { .. } => split = true,
                    Event::GrooveSpent { bars, .. } => assert_eq!(bars, 0.),
                    _ => {}
                }
            }
            let meter = s.combat.actors[1].view.meter;
            if s.combat.actors[1].combo_phase != 0 {
                s.combat.basic_groove(s.combat.actors[1].view.id);
                assert_eq!(s.combat.actors[1].view.meter, meter);
            } else {
                break;
            }
        }
        assert!(hops >= 5, "hops={hops}");
        assert!(split);
        assert_eq!(s.combat.actors[1].combo_phase, 0);
        assert_eq!(s.combat.actors[1].view.meter, 0.);
        assert!(!s.combat.actors[1].view.special_casting);
    }
}
#[test]
fn spotlight_solo_combo_keeps_120_to_150_degree_turns_and_rejects_hostile_warnings() {
    let mut s = combo_fixture(true);
    s.combat.actors[5].view.hp = 0.;
    let origin = s.combat.actors[1].view.pos;
    stage_shadow(&mut s);
    let mut previous = origin;
    for _ in 0..6 {
        let landing = s.combat.combo_landing(1, 4, origin).unwrap();
        let center = s.combat.actors[4].view.pos;
        let x = (previous - center).normalized();
        let y = (landing - center).normalized();
        let angle = libm::acosf((x.x * y.x + x.y * y.y).clamp(-1., 1.)) * 360. / TAU;
        assert!((119.9..=150.1).contains(&angle));
        s.combat.actors[1].view.pos = landing;
        previous = landing;
    }
    let unsafe_spot = s.combat.combo_landing(1, 4, origin).unwrap();
    let id = s.hazard(
        HazardKind::LizardoDrop,
        s.combat.actors[4].view.id,
        None,
        unsafe_spot,
        Vec2::new(1., 0.),
    );
    let h = s.combat.hazards.iter().find(|h| h.view.id == id).unwrap();
    if let Some(safe) = s.combat.combo_landing(1, 4, origin) {
        assert!(!h.hits(safe, BODY_RADIUS));
    }
}
#[test]
fn power_refills_between_waves_during_elevate_and_down_and_caps_at_three() {
    let mut s = fixture(&[Archetype::Orc]);
    for _ in 0..195 {
        s.combat.groove_timers();
    }
    assert!((s.combat.actors[3].view.meter - 1.15).abs() < 0.00001);
    s.combat.actors[3].view.groove_active = ELEVATE_DURATION;
    for _ in 0..195 {
        s.combat.groove_timers();
    }
    assert!((s.combat.actors[3].view.meter - 2.3).abs() < 0.00002);
    s.combat.actors[3].view.hp = 0.;
    s.deaths();
    assert_eq!(s.combat.actors[3].view.groove_active, 0.);
    for _ in 0..400 {
        s.combat.groove_timers();
    }
    assert_eq!(s.combat.actors[3].view.meter, 3.);
}
#[test]
fn elevate_costs_two_lasts_eight_seconds_and_buffs_every_hero_at_any_distance() {
    let mut s = fixture(&[Archetype::Orc]);
    s.combat.actors[3].power_choice = Some(true);
    s.combat.actors[3].view.meter = 3.;
    assert!(s.combat.groove_action(3));
    assert_eq!(s.combat.actors[3].view.meter, 1.);
    s.combat.actors[3].view.state_age = ELEVATE_WINDUP;
    s.combat.action(3);
    assert_eq!(s.combat.actors[3].view.groove_active, 8.);
    assert_eq!(ELEVATE_BONUS, 0.25);
    s.combat.actors[0].view.pos = ARENA_MIN + Vec2::new(BODY_RADIUS, BODY_RADIUS);
    s.combat.groove_timers();
    assert!(s.combat.actors[..4]
        .iter()
        .all(|a| a.view.elevate.is_some()));
    assert!(s.drain_events().iter().any(|e| matches!(
        e,
        Event::GrooveActivated {
            groove: Groove::Power,
            seconds: 8.,
            ..
        }
    )));
    for _ in 0..240 {
        s.combat.groove_timers();
    }
    assert_eq!(s.combat.actors[3].view.groove_active, 0.);
    assert!(s.combat.actors[..4]
        .iter()
        .all(|a| a.view.elevate.is_none()));
}
#[test]
fn kaja_holds_stocks_until_an_enemy_has_finished_spawning() {
    let mut s = fixture(&[Archetype::Orc]);
    s.combat.actors[3].view.meter = 3.;
    s.combat.actors[3].power_choice = Some(true);
    s.combat.actors[4].view.state = ActorState::Spawn;
    assert!(!s.combat.groove_action(3));
    s.combat.actors[4].view.hp = 0.;
    assert!(!s.combat.groove_action(3));
    assert_eq!(s.combat.actors[3].view.meter, 3.);
    s.combat.actors[4].view.hp = s.combat.actors[4].view.max_hp;
    s.combat.actors[4].view.state = ActorState::Idle;
    assert!(s.combat.groove_action(3));
}
#[test]
fn seeded_power_choice_is_deterministic_and_committed_until_affordable() {
    let mut elevate_seeds = 0;
    for seed in 1..=40 {
        let mut s = fixture(&[Archetype::Orc]);
        s.combat.actors[3].groove_rng = crate::rng::Rng(seed);
        s.combat.actors[3].view.meter = 0.;
        assert!(!s.combat.groove_action(3));
        let choice = s.combat.actors[3].power_choice;
        let rng = s.combat.actors[3].groove_rng.0;
        for _ in 0..10 {
            assert!(!s.combat.groove_action(3));
        }
        assert_eq!(s.combat.actors[3].power_choice, choice);
        assert_eq!(s.combat.actors[3].groove_rng.0, rng);
        s.combat.actors[3].view.meter = 1.;
        if choice == Some(true) {
            elevate_seeds += 1;
            assert!(!s.combat.groove_action(3));
            s.combat.actors[3].view.meter = 2.;
            assert!(s.combat.groove_action(3));
            assert!(!s.combat.actors[3].action_pulse);
        } else {
            assert!(!s.combat.groove_action(3));
            s.combat.actors[3].aoe_ready_steps = MAGE_AOE_HOLD_STEPS;
            assert!(s.combat.groove_action(3));
            assert!(s.combat.actors[3].action_pulse);
        }
        assert_eq!(s.combat.actors[3].view.meter, 0.);
        assert_eq!(s.combat.actors[3].power_choice, None);
    }
    assert!((12..=28).contains(&elevate_seeds));
}
// Check every frozen step, including the one that releases the window.
fn hondo_spotlight_step(s: &mut Sim) -> bool {
    let meter = s.combat.actors[1].view.meter;
    let running = s.combat.offensive_action(1).is_some() && s.combat.actors[1].committed();
    let clock = s.combat.combat_steps;
    let enemies = s
        .combat
        .actors
        .iter()
        .any(|a| a.alive() && a.view.team == Team::Enemy);
    s.step();
    assert_eq!(s.combat.combat_steps, clock);
    if enemies {
        let after = s.combat.actors[1].view.meter;
        assert!(
            (after - meter).abs() < 0.00001
                || (after - (meter - SIM_DT / COMBO_SECONDS).max(0.)).abs() < 0.00001,
            "spotlight changed meter beyond one universal drain step: {meter} -> {after}"
        );
    }
    if s.combat.actors[1].view.meter < meter {
        assert!(running, "spotlight drained an idle Hondo");
    }
    if !s.combat.actors[1].committed() || s.combat.offensive_action(1).is_none() {
        if let Some(window) = s.combat.spotlight.active {
            assert_ne!(
                window.caster, s.combat.actors[1].view.id,
                "idle featured Hondo held the spotlight"
            );
            assert!(
                !window.performer_running(s.combat.actors[1].view.id),
                "idle co-performer Hondo kept advancing"
            );
        }
    }
    s.combat.spotlight.active.is_none()
}
#[test]
fn combo_spotlight_drains_during_attacks_chains_and_closes_at_idle() {
    for co_performer in [false, true] {
        for auto_release in [false, true] {
            for charge in [0., 0.3] {
                for tail_cap in [0., 0.6] {
                    let mut s = combo_fixture(true);
                    s.set_spotlight(SpotlightConfig {
                        enabled: true,
                        charge,
                        tail_cap,
                        auto_release,
                        global_gap: 0.,
                        hero_gap: 0.,
                        fairness: 0.,
                        ..SpotlightConfig::DEFAULT
                    });
                    assert!(s.combat.groove_action(1));
                    if co_performer {
                        s.combat.spotlight.candidates.fill(None);
                        s.combat.start_arcane_pulse(3, s.combat.actors[4].view.id);
                    }
                    s.combat.select_spotlight();
                    let window = s.combat.spotlight.active.unwrap();
                    assert_eq!(
                        window.caster,
                        s.combat.actors[if co_performer { 3 } else { 1 }].view.id
                    );
                    assert!(window.has_performer(s.combat.actors[1].view.id));
                    let power = s.combat.actors[3].view.meter;
                    let mut hops = 0;
                    let mut drained = false;
                    s.drain_events();
                    for _ in 0..240 {
                        let meter = s.combat.actors[1].view.meter;
                        let ended = hondo_spotlight_step(&mut s);
                        drained |= s.combat.actors[1].view.meter < meter;
                        assert_eq!(s.combat.actors[3].view.meter, power);
                        for e in s.drain_events() {
                            hops += usize::from(matches!(e, Event::Blink { .. }));
                        }
                        if ended {
                            break;
                        }
                    }
                    assert!(s.combat.spotlight.active.is_none());
                    assert!(
                        drained && hops >= 2,
                        "drain and chained hops run in spotlight"
                    );
                    let clock = s.combat.combat_steps;
                    s.step();
                    assert_eq!(s.combat.combat_steps, clock + 1, "normal combat resumes");
                }
            }
        }
    }
}
#[test]
fn wave_changes_preserve_meters_but_down_ends_only_active_effects() {
    let mut wave = Sim::new(SimConfig::default());
    for a in &mut wave.actors {
        a.view.meter = 0.75;
    }
    wave.director.entry = 1;
    wave.director.clear_age = 100.;
    wave.direct();
    assert_eq!(wave.stage.mini_wave, 2);
    assert!(wave.actors[..4].iter().all(|a| a.view.meter == 0.75));
    let mut s = combo_fixture(false);
    s.combat.actors[0].view.meter = 0.4;
    s.combat.actors[2].view.meter = 2.5;
    s.combat.actors[3].view.meter = 1.5;
    assert!(s.combat.groove_action(1));
    s.combat.actors[3].view.groove_active = 8.;
    for i in 0..4 {
        s.combat.actors[i].view.hp = 0.;
    }
    s.deaths();
    assert_eq!(s.combat.actors[0].view.meter, 0.4);
    assert_eq!(s.combat.actors[1].view.meter, 0.);
    assert_eq!(s.combat.actors[2].view.meter, 2.5);
    assert_eq!(s.combat.actors[3].view.meter, 1.5);
    assert!(s.combat.actors[..4]
        .iter()
        .all(|a| a.view.groove_active == 0. && !a.view.special_casting));
}
#[test]
fn combo_landing_rechecks_every_hero_against_the_post_hop_centroid() {
    let mut s = combo_fixture(false);
    s.combat.actors[0].view.pos.x = ARENA_MIN.x + BODY_RADIUS;
    s.combat.actors[2].view.pos.x = 480.;
    s.combat.actors[3].view.pos.x = 480.;
    s.combat.actors[4].view.pos = Vec2::new(720., 1100.);
    s.combat.actors[5].view.hp = 0.;
    let origin = s.combat.actors[1].view.pos;
    assert!(
        s.combat.combo_landing(1, 4, origin).is_none(),
        "all straight hops fail containment"
    );
    stage_shadow(&mut s);
    let landing = s.combat.combo_landing(1, 4, origin).unwrap();
    let before = s.combat.actors[4].view.pos
        + crate::math::direction(core::f32::consts::PI + COMBO_TURN)
            * (BODY_RADIUS * 2. + s.combat.actors[1].stats.reach * 0.6);
    assert_ne!(
        landing, before,
        "the preferred angle pushes Fara outside the new screen bound"
    );
    s.combat.actors[1].view.pos = landing;
    let center = s.combat.centroid();
    for a in &s.combat.actors[..4] {
        assert!(
            (a.view.pos.x - center.x).abs() <= s.combat.cfg.visible_width * 0.5 - a.view.radius
        );
    }
    assert!(origin.distance(landing) >= COMBO_MIN_HOP);
    assert!(origin.distance(landing) <= COMBO_RADIUS);
}
#[test]
fn elevate_multiplies_party_basics_and_specials_by_25_percent() {
    for hero in 0..4 {
        let damage = |buffed| {
            let mut s = fixture(&[Archetype::Orc]);
            s.combat.actors[4].view.hp = 100000.;
            s.combat.actors[4].stats.def = 0.;
            s.combat.actors[hero].view.elevate = if buffed {
                Some(ElevateVariant::Sword)
            } else {
                None
            };
            s.combat
                .start_action(hero, Some(s.combat.actors[4].view.id), false, false);
            s.combat.actors[hero].view.state_age = BASIC_IMPACT;
            s.combat.action(hero);
            for _ in 0..30 {
                s.combat.move_projectiles();
            }
            s.drain_events()
                .iter()
                .filter_map(|e| match e {
                    Event::Hit { amount, .. } => Some(*amount),
                    _ => None,
                })
                .sum::<f32>()
        };
        assert!((damage(true) - damage(false) * 1.25).abs() < 0.001);
    }
    let damage = |buffed| {
        let mut s = fixture(&[Archetype::Orc]);
        s.combat.actors[4].view.pos = s.combat.actors[3].view.pos;
        s.combat.actors[4].view.hp = 100000.;
        s.combat.actors[4].stats.def = 0.;
        s.combat.actors[3].view.elevate = if buffed {
            Some(ElevateVariant::Sword)
        } else {
            None
        };
        s.hazard(
            HazardKind::ArcanePulse,
            s.combat.actors[3].view.id,
            Some(s.combat.actors[4].view.id),
            s.combat.actors[4].view.pos,
            Vec2::new(1., 0.),
        );
        s.combat.hazards[0].phase_age = s.combat.hazards[0].duration;
        s.resolve_hazards();
        s.drain_events()
            .iter()
            .filter_map(|e| match e {
                Event::Hit { amount, .. } => Some(*amount),
                _ => None,
            })
            .sum::<f32>()
    };
    let base = damage(false);
    assert!(base > 0.);
    assert!((damage(true) - base * 1.25).abs() < 0.001);
}
#[test]
fn empty_enemy_roster_loses_remaining_combo_drain_without_refunding_the_cast() {
    let mut s = combo_fixture(false);
    assert!(s.combat.groove_action(1));
    s.combat.actors[1].view.state_age = CAST_IMPACT;
    s.combat.action(1);
    assert_eq!(s.combat.actors[1].view.groove_active, COMBO_SECONDS);
    let epoch = s.combat.actors[1].action_epoch;
    s.combat.actors[4].view.hp = 0.;
    s.combat.actors[5].view.hp = 0.;
    s.combat.groove_timers();
    assert_eq!(s.combat.actors[1].view.meter, 0.);
    assert_eq!(s.combat.actors[1].view.groove_active, 0.);
    assert_eq!(s.combat.actors[1].combo_phase, 4);
    assert_eq!(s.combat.actors[1].action_epoch, epoch);
    assert!(s.combat.actors[1].view.special_casting && s.combat.actors[1].committed());
    s.combat.actors[1].view.state_age = CAST_DURATION;
    s.combat.combo_next(1);
    assert_eq!(s.combat.actors[1].combo_phase, 0);
    assert!(!s.combat.actors[1].view.special_casting);
}
#[test]
fn lost_first_hop_landings_cannot_deadlock_a_spotlight_or_refund_the_bar() {
    for drained_burst in [false, true] {
        for co_performer in [false, true] {
            let mut s = combo_fixture(false);
            s.combat.actors[4].view.archetype = Archetype::Boss;
            s.set_spotlight(SpotlightConfig {
                enabled: true,
                charge: 0.,
                global_gap: 0.,
                hero_gap: 0.,
                fairness: 0.,
                auto_release: true,
                ..SpotlightConfig::DEFAULT
            });
            assert!(s.combat.groove_action(1));
            if co_performer {
                s.combat.spotlight.candidates.fill(None);
                s.combat.start_arcane_pulse(3, s.combat.actors[4].view.id);
            }
            s.combat.select_spotlight();
            let featured = if co_performer { 3 } else { 1 };
            assert_eq!(
                s.combat.spotlight.active.unwrap().caster,
                s.combat.actors[featured].view.id
            );
            let combat_steps = s.combat.combat_steps;
            let mut ended = false;
            if drained_burst {
                for _ in 0..30 {
                    s.step();
                    if s.combat.actors[1].combo_phase == 2 {
                        break;
                    }
                }
                assert_eq!(s.combat.actors[1].combo_phase, 2);
                for a in &mut s.combat.actors[4..] {
                    a.view.pos.y += 600.;
                }
            }
            let warning = s.hazard(
                HazardKind::LizardoDrop,
                s.combat.actors[4].view.id,
                None,
                s.combat.actors[4].view.pos,
                Vec2::new(1., 0.),
            );
            s.combat
                .hazards
                .iter_mut()
                .find(|h| h.view.id == warning)
                .unwrap()
                .view
                .shape = Shape::Circle { radius: 500. };
            let mut split = false;
            let mut split_cast = false;
            for _ in 0..300 {
                if s.combat.spotlight.active.is_none() {
                    break;
                }
                let meter = s.combat.actors[1].view.meter;
                hondo_spotlight_step(&mut s);
                assert!(
                    s.combat.actors[1].view.meter > 0.,
                    "blocked landing must not spend the bar in spotlight"
                );
                assert!(s.combat.actors[1].view.meter <= meter);
                for e in s.drain_events() {
                    if let Event::SpotlightEnded { cancelled, .. } = e {
                        assert!(!cancelled);
                        ended = true;
                    }
                    split |= matches!(e, Event::SplitStrike { .. });
                    split_cast |= matches!(
                        e,
                        Event::SkillStarted {
                            skill: Skill::Split,
                            ..
                        }
                    );
                }
            }
            assert!(
                s.combat.spotlight.active.is_none(),
                "targetless Combo held Performing forever"
            );
            assert!(ended);
            assert_eq!(s.combat.combat_steps, combat_steps);
            assert!(!split && !split_cast);
            assert!(
                s.combat.actors[1].view.meter > 0.,
                "spotlight leaves blocked Combo cleanup to combat"
            );
            for _ in 0..180 {
                s.step();
                assert!(s.combat.spotlight.active.is_none());
                for e in s.drain_events() {
                    assert!(!matches!(e, Event::SplitStrike { .. }));
                    assert!(!matches!(
                        e,
                        Event::SkillStarted {
                            skill: Skill::Split,
                            ..
                        }
                    ));
                }
                if s.combat.actors[1].combo_phase == 0 {
                    break;
                }
            }
            assert_eq!(s.combat.actors[1].view.groove_active, 0.);
            assert!(!s.combat.actors[1].view.special_casting);
            assert_eq!(s.combat.actors[1].view.meter, 0.);
            assert_eq!(s.combat.actors[1].combo_phase, 0);
        }
    }
}
#[test]
fn co_performing_combo_respects_extra_cap_and_resumes_its_captured_cast_in_combat() {
    let mut s = combo_fixture(true);
    s.set_spotlight(SpotlightConfig {
        enabled: true,
        charge: 0.,
        global_gap: 0.,
        hero_gap: 0.,
        fairness: 0.,
        auto_release: true,
        ..SpotlightConfig::DEFAULT
    });
    assert!(s.combat.groove_action(1));
    s.combat.spotlight.candidates.fill(None);
    s.combat.start_arcane_pulse(3, s.combat.actors[4].view.id);
    s.combat.select_spotlight();
    assert_eq!(
        s.combat.spotlight.active.unwrap().caster,
        s.combat.actors[3].view.id
    );
    assert!(s
        .combat
        .spotlight
        .active
        .unwrap()
        .co_casters
        .slice()
        .contains(&s.combat.actors[1].view.id));
    // A long captured cast must not bypass the co-performer cap.
    s.combat.actors[1].view.state_duration = CAST_DURATION + SPOTLIGHT_COMBO_EXTRA + 2.;
    let mut ended = false;
    for _ in 0..120 {
        if s.combat.spotlight.active.is_none() {
            break;
        }
        hondo_spotlight_step(&mut s);
        for e in s.drain_events() {
            assert!(!matches!(e, Event::SplitStrike { .. }));
            ended |= matches!(
                e,
                Event::SpotlightEnded {
                    cancelled: false,
                    ..
                }
            );
        }
    }
    assert!(ended && s.combat.spotlight.active.is_none());
    assert!(
        s.combat.actors[1].committed(),
        "cap must preserve unfinished cast"
    );
    assert_eq!(s.combat.actors[1].combo_phase, 2);
    let age = s.combat.actors[1].view.state_age;
    s.step();
    assert!(s.combat.actors[1].view.meter < 1.);
    assert!(s.combat.actors[1].view.state_age > age);
}
#[test]
fn active_clocks_end_on_exactly_120_and_240_steps_without_a_float_residue_frame() {
    let mut s = combo_fixture(false);
    s.combat.actors[1].combo_phase = 2;
    s.combat.actors[1].view.groove_active = COMBO_SECONDS;
    for _ in 0..119 {
        s.combat.combo_drain(1);
    }
    assert!(s.combat.actors[1].view.groove_active > 0.);
    s.combat.combo_drain(1);
    assert_eq!(s.combat.actors[1].view.groove_active, 0.);
    assert_eq!(s.combat.actors[1].view.meter, 0.);
    s.combat.actors[3].view.meter = 2.;
    s.combat.start_action(3, None, true, false);
    s.combat.actors[3].view.state_age = ELEVATE_WINDUP;
    s.combat.action(3);
    for _ in 0..239 {
        s.combat.groove_timers();
        s.combat.update_hazards();
        s.resolve_hazards();
    }
    assert!(s.combat.actors[3].view.groove_active > 0.);
    s.combat.groove_timers();
    s.combat.update_hazards();
    s.resolve_hazards();
    assert_eq!(s.combat.actors[3].view.groove_active, 0.);
    assert!(s.combat.actors[..4]
        .iter()
        .all(|a| a.view.elevate.is_none()));
}

#[test]
#[ignore = "short before/after Shadow sanity measurement"]
fn shadow_short_slice_counts() {
    for seed in 1..=5 {
        let mut s = Sim::new(SimConfig {
            seed,
            ..Default::default()
        });
        let mut starts = 0;
        let mut casts = 0;
        for _ in 0..180 * SIM_HZ {
            s.step();
            for event in s.drain_events() {
                match event {
                    Event::GrooveActivated {
                        groove: Groove::Combo,
                        ..
                    } => starts += 1,
                    Event::SkillStarted {
                        skill: Skill::Shadow,
                        ..
                    } => casts += 1,
                    _ => {}
                }
            }
        }
        println!("seed {seed}: Shadow burst starts={starts}, Shadow casts={casts}");
        assert!(starts > 0);
    }
}

fn stage_shadow(s: &mut Sim) {
    s.combat.actors[4].view.archetype = Archetype::Boss;
    s.set_spotlight(SpotlightConfig {
        enabled: true,
        charge: 0.,
        global_gap: 0.,
        hero_gap: 0.,
        fairness: 0.,
        ..SpotlightConfig::DEFAULT
    });
    s.combat
        .start_action(1, Some(s.combat.actors[4].view.id), true, false);
    s.combat.select_spotlight();
    assert_eq!(
        s.combat.spotlight.active.unwrap().caster,
        s.combat.actors[1].view.id
    );
}
fn shadow_fixture(offset: Vec2) -> Sim {
    let mut s = combo_fixture(false);
    s.combat.actors[5].view.hp = 0.;
    s.combat.actors[4].view.pos = Vec2::new(480., 1100.);
    s.combat.actors[1].view.pos = s.combat.actors[4].view.pos + offset;
    s.combat.actors[1].destination = s.combat.actors[1].view.pos;
    s.combat.actors[1].ai_cd = 0.;
    s
}
#[test]
fn shadow_starts_only_with_horizontal_feet_alignment_on_both_sides() {
    for side in [-1., 1.] {
        for (offset, starts) in [
            (Vec2::new(side * 60., 50.), false),
            (Vec2::new(side * 60., 0.), true),
            (Vec2::new(side * 60., 18.), true),
            (Vec2::new(side * 60., 21.), false),
            (Vec2::new(0., 60.), false),
        ] {
            let mut s = shadow_fixture(offset);
            assert_eq!(s.combat.groove_action(1), starts, "offset {offset:?}");
            assert_eq!(s.combat.actors[1].combo_phase == 1, starts);
            assert_eq!(s.combat.actors[1].view.state == ActorState::Cast, starts);
        }
    }
}
#[test]
fn ready_or_nearly_ready_diagonal_shadow_approaches_a_safe_level_slot() {
    for meter in [1., 1. - COMBO_BASIC_GAIN] {
        for side in [-1., 1.] {
            let mut s = shadow_fixture(Vec2::new(side * 130., 100.));
            s.combat.actors[1].view.meter = meter;
            let target = s.combat.actors[4].view.pos;
            s.hero_ai();
            assert_eq!(s.combat.actors[1].view.ai_intent, AiIntent::MoveToRange);
            assert_eq!(s.combat.actors[1].destination.y, target.y);
            assert!((s.combat.actors[1].destination.x - target.x) * side > 0.);
            if meter < 1. {
                continue;
            }
            for _ in 0..120 {
                s.combat.timers();
                s.hero_ai();
                s.combat.constrain_party();
                if s.combat.actors[1].view.state == ActorState::Cast {
                    break;
                }
            }
            assert_eq!(
                s.combat.actors[1].combo_phase, 1,
                "never reached Shadow alignment"
            );
            assert!(crate::groove::shadow_line_aligned(
                s.combat.actors[1].view.pos,
                target
            ));
        }
    }
}
#[test]
fn blocked_level_slots_keep_basics_and_full_bar_without_diagonal_shadow() {
    let mut s = shadow_fixture(Vec2::new(-50., 40.));
    let reach = s.combat.actors[1].attack_range(&s.combat.actors[4]) * 0.9;
    let center = s.combat.actors[4].view.pos;
    s.combat.actors[0].view.pos = center + Vec2::new(-reach, 0.);
    s.combat.actors[2].view.pos = center + Vec2::new(reach, 0.);
    assert!(s.combat.shadow_approach(1, 4).is_none());
    s.combat.actors[1].basic_cd = 0.;
    s.hero_ai();
    assert_eq!(s.combat.actors[1].view.state, ActorState::Basic);
    assert_eq!(s.combat.actors[1].combo_phase, 0);
    assert_eq!(s.combat.actors[1].view.meter, 1.);
}
#[test]
fn shadow_level_slots_respect_floor_and_occupied_destinations() {
    let mut s = shadow_fixture(Vec2::new(100., 80.));
    let center = Vec2::new(ARENA_MIN.x + s.combat.actors[4].view.radius, 1100.);
    s.combat.actors[4].view.pos = center;
    s.combat.actors[1].view.pos = center + Vec2::new(100., 80.);
    let spot = s.combat.shadow_approach(1, 4).unwrap();
    assert!(spot.x > center.x);
    assert_eq!(spot, crate::math::floor_point(spot, BODY_RADIUS));
    s.combat.actors[0].view.pos = spot;
    assert!(s.combat.shadow_approach(1, 4).is_none());
}
#[test]
fn ordinary_shadow_prefers_opposite_180_and_limits_safe_fallback_angles() {
    for side in [-1., 1.] {
        let mut s = shadow_fixture(Vec2::new(side * 90., 0.));
        let origin = s.combat.actors[1].view.pos;
        let center = s.combat.actors[4].view.pos;
        let landing = s.combat.combo_landing(1, 4, origin).unwrap();
        assert!((landing.y - center.y).abs() < 0.001);
        assert!((landing.x - center.x) * side < 0.);
        // A small warning blocks the exact opposite spot and permits a shallow fallback.
        let warning = s.hazard(
            HazardKind::LizardoDrop,
            s.combat.actors[4].view.id,
            None,
            landing,
            Vec2::new(1., 0.),
        );
        s.combat
            .hazards
            .iter_mut()
            .find(|h| h.view.id == warning)
            .unwrap()
            .view
            .shape = Shape::Circle { radius: 0.1 };
        let fallback = s.combat.combo_landing(1, 4, origin).unwrap();
        assert_ne!(fallback, landing);
        assert!(!s
            .combat
            .hazards
            .iter()
            .find(|h| h.view.id == warning)
            .unwrap()
            .hits(fallback, BODY_RADIUS));
        assert!(crate::groove::shadow_line_aligned(fallback, center));
        assert!(crate::groove::shadow_line_aligned(origin, fallback));
        assert!((fallback.x - center.x) * side < 0.);
    }
}
#[test]
fn lost_straight_landing_without_reachable_target_ends_without_split() {
    let mut s = shadow_fixture(Vec2::new(-90., 0.));
    assert!(s.combat.groove_action(1));
    s.combat.actors[4].view.pos.y += 100.;
    s.combat.actors[1].view.state_age = CAST_IMPACT;
    s.combat.action(1);
    assert!(!s
        .drain_events()
        .iter()
        .any(|e| matches!(e, Event::Blink { .. })));
    s.combat.actors[1].view.state_age = CAST_DURATION;
    s.combat.combo_next(1);
    assert_eq!(s.combat.actors[1].combo_phase, 0);
    assert!(!s.combat.actors[1].action_extra);
    assert!(!s.combat.actors[1].view.special_casting);
    assert_eq!(s.combat.actors[1].view.meter, 0.);
    assert_eq!(s.combat.actors[1].view.groove_active, 0.);
    assert!(!s.drain_events().iter().any(|e| matches!(
        e,
        Event::SkillStarted {
            skill: Skill::Split,
            ..
        } | Event::SplitStrike { .. }
    )));
}
#[test]
fn staged_diagonal_shadow_preserves_original_landing_and_hits() {
    let mut s = shadow_fixture(Vec2::new(-60., 50.));
    let from = s.combat.actors[1].view.pos;
    assert!(!s.combat.groove_action(1));
    stage_shadow(&mut s);
    let center = s.combat.actors[4].view.pos;
    let angle = libm::atan2f(from.y - center.y, from.x - center.x);
    let radius = s.combat.actors[1].view.radius
        + s.combat.actors[4].view.radius
        + s.combat.actors[1].stats.reach * 0.6;
    let expected = center + crate::math::direction(angle + COMBO_TURN) * radius;
    assert_eq!(s.combat.combo_landing(1, 4, from), Some(expected));
    s.combat.actors[1].view.state_age = CAST_IMPACT;
    s.combat.action(1);
    assert!(s
        .drain_events()
        .iter()
        .any(|e| matches!(e, Event::Blink { from: f, to, .. }
        if *f == from && *to == expected)));
}

#[test]
fn blocked_chained_straight_hops_wait_for_drain_then_end_without_split() {
    let mut s = shadow_fixture(Vec2::new(-90., 0.));
    assert!(s.combat.groove_action(1));
    s.combat.actors[1].view.state_age = CAST_IMPACT;
    s.combat.action(1);
    assert_eq!(s.combat.actors[1].combo_phase, 2);
    s.drain_events();
    s.combat.actors[4].view.pos.y += 200.;
    s.combat.actors[1].view.state_age = CAST_DURATION;
    for step in 0..120 {
        s.combat.combo_drain(1);
        s.combat.combo_next(1);
        if step < 119 {
            assert_eq!(s.combat.actors[1].combo_phase, 2);
        }
    }
    assert_eq!(s.combat.actors[1].combo_phase, 0);
    assert!(!s.combat.actors[1].action_extra);
    assert!(!s.combat.actors[1].view.special_casting);
    assert_eq!(s.combat.actors[1].view.meter, 0.);
    assert_eq!(s.combat.actors[1].view.groove_active, 0.);
    assert!(!s.drain_events().iter().any(|e| matches!(
        e,
        Event::Blink { .. }
            | Event::SplitStrike { .. }
            | Event::SkillStarted {
                skill: Skill::Shadow | Skill::Split,
                ..
            }
    )));
}

#[test]
fn combo_finisher_hits_a_living_target_at_exact_weapon_reach() {
    for phase in [1, 2] {
        let mut s = shadow_fixture(Vec2::new(-90., 0.));
        let reach = s.combat.actors[1].attack_range(&s.combat.actors[4]);
        s.combat.actors[4].view.pos = s.combat.actors[1].view.pos + Vec2::new(reach, 0.);
        // No Shadow landing in the original circle, including the lost-first-hop path.
        s.combat.actors[1].combo_origin = Vec2::new(480., ARENA_MIN.y + 100.);
        s.combat.actors[1].combo_phase = phase;
        s.combat.actors[1].view.meter = 1.;
        s.combat.combo_next(1);
        assert_eq!(s.combat.actors[1].combo_phase, 3);
        assert!(s.combat.actors[1].action_extra);
        assert!(s.drain_events().iter().any(|e| matches!(
            e,
            Event::SkillStarted {
                skill: Skill::Split,
                ..
            }
        )));
        let target = s.combat.actors[4].view.id;
        let hp = s.combat.actors[4].view.hp;
        s.combat.actors[1].view.state_age = CAST_IMPACT;
        s.combat.action(1);
        assert!(s.drain_events().iter().any(|e| matches!(e,
            Event::SplitStrike { targets, .. } if targets.contains(&target))));
        assert!(s.combat.actors[4].view.hp < hp);
        s.combat.actors[1].view.state_age = CAST_DURATION;
        s.combat.combo_next(1);
        assert_eq!(s.combat.actors[1].combo_phase, 0);
        assert_eq!(s.combat.actors[1].view.meter, 0.);
    }
}
#[test]
fn combo_finisher_rejects_out_of_reach_dead_and_unengageable_targets() {
    for phase in [1, 2] {
        for unavailable in 0..4 {
            let mut s = shadow_fixture(Vec2::new(-90., 0.));
            let reach = s.combat.actors[1].attack_range(&s.combat.actors[4]);
            s.combat.actors[4].view.pos = s.combat.actors[1].view.pos + Vec2::new(reach, 0.);
            match unavailable {
                0 => s.combat.actors[4].view.pos.x += 0.01,
                1 => s.combat.actors[4].view.hp = 0.,
                2 => s.combat.actors[4].view.state = ActorState::Spawn,
                _ => s.combat.actors[4].formed_age = 0.,
            }
            s.combat.actors[1].combo_origin = Vec2::new(480., ARENA_MIN.y + 100.);
            s.combat.actors[1].combo_phase = phase;
            s.combat.actors[1].view.meter = 1.;
            s.combat.combo_next(1);
            assert_eq!(s.combat.actors[1].combo_phase, 0);
            assert_eq!(s.combat.actors[1].view.meter, 0.);
            assert!(!s.combat.actors[1].view.special_casting);
            assert!(!s.drain_events().iter().any(|e| matches!(
                e,
                Event::SkillStarted {
                    skill: Skill::Split,
                    ..
                }
            )));
        }
    }
}

#[test]
fn empty_burst_disposal_uses_the_universal_combat_rule() {
    let mut s = combo_fixture(false);
    s.combat.actors[4].view.archetype = Archetype::Boss;
    s.set_spotlight(SpotlightConfig {
        enabled: true,
        charge: 0.,
        auto_release: true,
        global_gap: 0.,
        hero_gap: 0.,
        fairness: 0.,
        ..SpotlightConfig::DEFAULT
    });
    assert!(s.combat.groove_action(1));
    s.combat.select_spotlight();
    for a in &mut s.combat.actors[4..] {
        a.view.hp = 0.;
    }
    let mut normal = combo_fixture(false);
    normal.actors[4].view.archetype = Archetype::Boss;
    assert!(normal.groove_action(1));
    for a in &mut normal.actors[4..] {
        a.view.hp = 0.;
    }
    normal.combo_drain(1);
    hondo_spotlight_step(&mut s);
    assert_eq!(s.combat.actors[1].view.meter, normal.actors[1].view.meter);
    assert_eq!(s.combat.actors[1].combo_phase, normal.actors[1].combo_phase);
}

#[test]
fn idle_hondo_closes_only_his_own_spotlight_without_spending() {
    for co_performer in [false, true] {
        for phase in [
            SpotlightPhase::Charge,
            SpotlightPhase::Performing,
            SpotlightPhase::Tail,
        ] {
            for finished in [false, true] {
                let mut s = combo_fixture(true);
                s.set_spotlight(SpotlightConfig {
                    enabled: true,
                    charge: 1.2,
                    tail_cap: 10.,
                    auto_release: false,
                    global_gap: 0.,
                    hero_gap: 0.,
                    fairness: 0.,
                    ..SpotlightConfig::DEFAULT
                });
                assert!(s.combat.groove_action(1));
                if co_performer {
                    s.combat.spotlight.candidates.fill(None);
                    s.combat.start_arcane_pulse(3, s.combat.actors[4].view.id);
                }
                s.combat.select_spotlight();
                let hondo = s.combat.actors[1].view.id;
                let window = s.combat.spotlight.active.as_mut().unwrap();
                window.phase = phase;
                window.extra_steps = 1;
                window
                    .performers
                    .iter_mut()
                    .flatten()
                    .find(|p| p.actor == hondo)
                    .unwrap()
                    .finished = finished;
                s.combat.actors[1].combo_phase = 2;
                s.combat.actors[1].view.meter = 0.7;
                s.combat.actors[1].view.groove_active = COMBO_SECONDS * 0.7;
                s.combat.actors[1].state(ActorState::Idle, 0., 0.);
                let frozen = format!("{:?}", s.combat.actors[1]);
                assert_eq!(hondo_spotlight_step(&mut s), !co_performer);
                if co_performer {
                    assert_eq!(s.combat.spotlight.active.unwrap().phase, phase);
                    assert_eq!(format!("{:?}", s.combat.actors[1]), frozen);
                }
                assert_eq!(s.combat.actors[1].view.meter, 0.7);
                assert_eq!(s.combat.actors[1].view.groove_active, COMBO_SECONDS * 0.7);
            }
        }
    }
}

#[test]
fn idle_co_performer_hondo_freezes_until_kajas_featured_action_finishes() {
    let mut s = combo_fixture(false);
    s.set_spotlight(SpotlightConfig {
        enabled: true,
        charge: 0.,
        auto_release: true,
        global_gap: 0.,
        hero_gap: 0.,
        fairness: 0.,
        ..SpotlightConfig::DEFAULT
    });
    assert!(s.combat.groove_action(1));
    // Resolve the first real hop, then block further landings during its recovery.
    s.combat.actors[1].view.state_age = s.combat.actors[1].view.impact_at;
    s.combat.action(1);
    assert_eq!(s.combat.actors[1].combo_phase, 2);
    s.combat.actors[1].view.state_age = s.combat.actors[1].view.state_duration - SIM_DT;
    let warning = s.hazard(
        HazardKind::LizardoDrop,
        s.combat.actors[4].view.id,
        None,
        s.combat.actors[4].view.pos,
        Vec2::new(1., 0.),
    );
    s.combat
        .hazards
        .iter_mut()
        .find(|h| h.view.id == warning)
        .unwrap()
        .view
        .shape = Shape::Circle { radius: 500. };
    s.combat.spotlight.candidates.fill(None);
    for dx in [-5., 5.] {
        s.spawn_actor(
            Archetype::Orc,
            s.combat.actors[4].view.pos + Vec2::new(dx, 0.),
        );
    }
    s.combat.start_arcane_pulse(3, s.combat.actors[4].view.id);
    s.combat.select_spotlight();
    assert_eq!(
        s.combat.spotlight.active.unwrap().caster,
        s.combat.actors[3].view.id
    );
    assert!(s
        .combat
        .spotlight
        .active
        .unwrap()
        .performer_running(s.combat.actors[1].view.id));
    hondo_spotlight_step(&mut s);
    assert!(!s.combat.actors[1].committed());
    assert!(
        s.combat.actors[3].committed(),
        "featured action must outlast Hondo's hop"
    );
    assert!(
        s.combat.spotlight.active.is_some(),
        "Hondo cut Kaja's spotlight short"
    );
    assert_eq!(
        s.combat.actors[1].combo_phase, 2,
        "idle burst remains for normal combat"
    );
    let frozen = format!("{:?}", s.combat.actors[1]);
    let meter = s.combat.actors[1].view.meter;
    assert!(meter > 0.);
    let mut idle_steps = 0;
    while s.combat.spotlight.active.is_some() {
        hondo_spotlight_step(&mut s);
        assert_eq!(s.combat.actors[1].view.meter, meter);
        assert_eq!(
            format!("{:?}", s.combat.actors[1]),
            frozen,
            "finished Hondo's action or combat timers advanced"
        );
        idle_steps += 1;
        assert!(idle_steps < 300);
    }
    assert!(idle_steps > 1);
    assert!(s.combat.actors[3].action_done);
    assert!(
        !s.combat.actors[3].committed(),
        "Kaja must finish before release"
    );
    assert!(s.drain_events().iter().any(|e| matches!(e,
        Event::HazardResolved { id, .. } if s.combat.hazards.iter().any(|h|
            h.view.id == *id && h.view.kind == HazardKind::ArcanePulse))));
}

#[test]
fn approved_buff_windups_apply_only_at_release_and_keep_recovery() {
    for (index, windup) in [(0, WARCRY_WINDUP), (3, ELEVATE_WINDUP)] {
        let mut s = fixture(&[Archetype::Orc]);
        let target = s.combat.actors[4].view.id;
        if index == 0 {
            s.combat.start_extra(0, target);
        } else {
            s.combat.start_action(3, Some(target), true, false);
        }
        assert_eq!(s.combat.actors[index].view.impact_at, windup);
        assert!(
            (s.combat.actors[index].view.state_duration - windup - (CAST_DURATION - CAST_IMPACT))
                .abs()
                < 0.00001
        );
        assert_eq!(windup, if index == 0 { 1.5 } else { 1.875 });
        s.combat.events.clear();
        let ticks = (windup / SIM_DT).ceil() as u32;
        for tick in 0..=ticks {
            s.combat.actors[index].view.state_age = tick as f32 * SIM_DT;
            s.combat.action(index);
            let released = if index == 0 {
                s.combat.actors[0].view.warcry_shield
            } else {
                s.combat.actors[3].view.groove_active > 0.
            };
            assert_eq!(released, tick == ticks, "cast {index}, tick {tick}");
        }
        if index == 0 {
            assert!(s
                .drain_events()
                .iter()
                .any(|e| matches!(e, Event::WardGained { .. })));
        } else {
            assert!(s.combat.actors[..4]
                .iter()
                .all(|a| a.view.elevate.is_some()));
        }
    }
    // Ground Pound and offensive casts retain their original wind-up and duration.
    let mut s = fixture(&[Archetype::Orc]);
    let target = s.combat.actors[4].view.id;
    s.combat.actors[0].view.meter = 2.;
    s.combat.actors[4].target = Some(s.combat.actors[0].view.id);
    s.combat.actors[2].view.pos.y = ARENA_MAX.y - 50.;
    s.combat.actors[3].view.pos.y = ARENA_MAX.y - 50.;
    assert!(s.combat.groove_action(0));
    assert!(s.combat.actors[0].action_pound);
    assert_eq!(s.combat.actors[0].view.impact_at, CAST_IMPACT);
    assert_eq!(s.combat.actors[0].view.state_duration, CAST_DURATION);
    s.combat.start_action(2, Some(target), true, false);
    assert_eq!(s.combat.actors[2].view.impact_at, CAST_IMPACT);
    assert_eq!(s.combat.actors[2].view.state_duration, CAST_DURATION);
}

#[test]
fn elevate_variants_roll_uniformly_when_power_choice_locks() {
    let mut counts = [0; 3];
    for seed in 1..=1800 {
        let mut s = fixture(&[Archetype::Orc]);
        s.combat.actors[3].groove_rng = crate::rng::Rng(seed);
        s.combat.actors[3].elevate_choice = None;
        s.combat.actors[3].view.meter = 0.;
        assert!(!s.combat.groove_action(3));
        if let Some(variant) = s.combat.actors[3].elevate_choice {
            assert_eq!(s.combat.actors[3].power_choice, Some(true));
            counts[variant as usize] += 1;
            let rng = s.combat.actors[3].groove_rng.0;
            for _ in 0..3 {
                assert!(!s.combat.groove_action(3));
            }
            assert_eq!(s.combat.actors[3].elevate_choice, Some(variant));
            assert_eq!(s.combat.actors[3].groove_rng.0, rng);
            let mut replay = fixture(&[Archetype::Orc]);
            replay.actors[3].groove_rng = crate::rng::Rng(seed);
            assert!(!replay.groove_action(3));
            assert_eq!(replay.actors[3].elevate_choice, Some(variant));
        }
    }
    let total = counts.iter().sum::<usize>() as f32;
    for count in counts {
        assert!((count as f32 / total - 1. / 3.).abs() < 0.06, "{counts:?}");
    }
}

#[test]
fn elevate_variant_stats_and_actual_defense_do_not_stack() {
    for variant in [
        ElevateVariant::Sword,
        ElevateVariant::Wings,
        ElevateVariant::WingedBoots,
    ] {
        let mut s = fixture(&[Archetype::Orc]);
        s.combat.actors[3].view.groove_active = ELEVATE_DURATION;
        s.combat.actors[3].view.elevate = Some(variant);
        s.combat.refresh_elevate();
        for hero in 0..4 {
            let a = &s.combat.actors[hero];
            let boots = variant == ElevateVariant::WingedBoots;
            let wings = variant == ElevateVariant::Wings;
            let speed_bonus = if boots {
                ELEVATE_BOOTS_MOVE_BONUS
            } else if variant == ElevateVariant::Sword {
                ELEVATE_MOVE_BONUS
            } else {
                0.
            };
            assert_eq!(a.speed(), a.stats.speed * (1. + speed_bonus));
            assert_eq!(a.evade(), if wings { ELEVATE_EVADE_BONUS } else { 0. });
            assert_eq!(
                a.reach(),
                a.stats.reach * if wings { 1. + ELEVATE_RANGE_BONUS } else { 1. }
            );
            assert_eq!(
                a.attack_range(&s.combat.actors[4]),
                a.reach() + a.view.radius + s.combat.actors[4].view.radius
            );
            let defense = a.stats.def * if boots { 1. + ELEVATE_DEF_BONUS } else { 1. };
            let expected = 50. * DEF_BASE / (DEF_BASE + defense);
            let damage = s
                .combat
                .damage(999, hero, 50., false, true, Element::Physical);
            assert!((damage - expected).abs() < 0.00001);
        }
        assert!(s.combat.actors[4].view.elevate.is_none());
        s.combat.actors[0].stats.evade = 0.9;
        if variant == ElevateVariant::Wings {
            assert_eq!(s.combat.actors[0].evade(), ELEVATE_EVADE_CAP);
        }
        s.refresh_snapshot();
        assert!(s.snapshot.actors[..4]
            .iter()
            .all(|a| a.elevate == Some(variant)));
    }
}

#[test]
fn elevate_recast_replaces_every_variant_at_release_and_restarts_timer() {
    for old in [
        ElevateVariant::Sword,
        ElevateVariant::Wings,
        ElevateVariant::WingedBoots,
    ] {
        for new in [
            ElevateVariant::Sword,
            ElevateVariant::Wings,
            ElevateVariant::WingedBoots,
        ] {
            let mut s = fixture(&[Archetype::Orc]);
            s.combat.actors[3].view.elevate = Some(old);
            s.combat.actors[3].view.groove_active = 3.;
            s.combat.refresh_elevate();
            s.combat.actors[3].power_choice = Some(true);
            s.combat.actors[3].elevate_choice = Some(new);
            s.combat.actors[3].view.meter = 3.;
            assert!(
                s.combat.groove_action(3),
                "active Elevate must permit recasting"
            );
            assert_eq!(s.combat.actors[3].view.meter, 1.);
            assert!(s.combat.actors[..4]
                .iter()
                .all(|a| a.view.elevate == Some(old)));
            s.combat.actors[3].view.state_age = ELEVATE_WINDUP;
            s.combat.action(3);
            assert_eq!(s.combat.actors[3].view.groove_active, ELEVATE_DURATION);
            assert!(s.combat.actors[..4]
                .iter()
                .all(|a| a.view.elevate == Some(new)));
            assert_eq!(s.combat.actors[3].elevate_choice, None);
            s.combat.groove_timers();
            assert!(
                (s.combat.actors[3].view.groove_active - (ELEVATE_DURATION - SIM_DT)).abs()
                    < 0.00001
            );
            for _ in 1..240 {
                s.combat.groove_timers();
            }
            assert!(s.combat.actors[..4]
                .iter()
                .all(|a| a.view.elevate.is_none()));
        }
    }
}

#[test]
fn elevate_pending_and_active_variants_are_hashed_and_clear_on_caster_loss() {
    let mut s = fixture(&[Archetype::Orc]);
    let hash = s.state_hash();
    s.combat.actors[3].elevate_choice = Some(ElevateVariant::Wings);
    assert_ne!(s.state_hash(), hash);
    s.combat.actors[3].view.elevate = Some(ElevateVariant::WingedBoots);
    s.combat.actors[3].view.groove_active = 8.;
    s.combat.refresh_elevate();
    let hash = s.state_hash();
    s.combat.actors[3].view.elevate = Some(ElevateVariant::Wings);
    assert_ne!(s.state_hash(), hash);
    s.combat.actors[3].view.hp = 0.;
    s.deaths();
    assert!(s.combat.actors[..4]
        .iter()
        .all(|a| a.view.elevate.is_none()));
}

#[test]
fn wings_changes_landed_evade_rolls_and_special_reach() {
    let mut misses = [0; 2];
    for (mode, variant) in [None, Some(ElevateVariant::Wings)].into_iter().enumerate() {
        let mut s = fixture(&[Archetype::Orc]);
        s.combat.actors[0].view.elevate = variant;
        for _ in 0..600 {
            if s.combat.damage(999, 0, 0., true, true, Element::Physical) == 0. {
                misses[mode] += s
                    .drain_events()
                    .iter()
                    .filter(|e| matches!(e, Event::Evaded { .. }))
                    .count();
            }
        }
        // A target beyond the original 300-u Special gate is reachable only with Wings.
        s.combat.actors[4].view.pos =
            s.combat.actors[0].view.pos + Vec2::new(GROUND_POUND_LENGTH * 1.1, 0.);
        s.combat.actors[4].target = Some(s.combat.actors[0].view.id); // No Warcry reason.
        s.combat.actors[0].view.meter = 1.;
        assert_eq!(s.combat.groove_action(0), variant.is_some());
        if variant.is_some() {
            assert!(s.combat.actors[0].action_pound);
        }
    }
    assert_eq!(misses[0], 0);
    assert!((95..=170).contains(&misses[1]), "{misses:?}");
}
