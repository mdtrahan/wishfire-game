use crate::{tests::ALLOCATIONS, tuning::*, *};
fn fixture() -> Sim {
    let mut s = Sim::composition_trial(
        SimConfig {
            spotlight: SpotlightConfig {
                charge: 0.,
                global_gap: 0.,
                hero_gap: 0.,
                fairness: 0.,
                auto_release: true,
                ..SpotlightConfig::DEFAULT
            },
            ..Default::default()
        },
        &[Archetype::Boss, Archetype::Orc],
    );
    s.combat.hazards.clear();
    s.combat.projectiles.clear();
    s.combat.events.clear();
    for a in &mut s.combat.actors {
        a.view.pos = Vec2::new(480., 900.);
        a.destination = a.view.pos;
        a.view.hp = 100000.;
        a.view.max_hp = 100000.;
        a.stats.evade = 0.;
        a.basic_cd = 100.;
        a.special_cd = 100.;
        a.extra_cd = 100.;
        a.pulse_cd = 100.;
        a.pound_cd = 100.;
    }
    s.combat.actors[4].view.pos = Vec2::new(480., 1100.);
    s.combat.actors[5].view.pos = Vec2::new(750., ARENA_MAX.y - 100.);
    s
}
fn begin(s: &mut Sim) {
    s.combat.spotlight.candidates.fill(None);
    s.combat.start_arcane_pulse(3, s.combat.actors[4].view.id);
    s.combat.select_spotlight();
    s.refresh_snapshot();
    assert_eq!(
        s.combat.spotlight.active.unwrap().caster,
        s.combat.actors[3].view.id
    );
}
fn complete(s: &mut Sim) -> usize {
    let mut steps = 0;
    while s.combat.spotlight.active.is_some() {
        s.step();
        s.drain_events();
        steps += 1;
        assert!(steps < 300);
    }
    steps
}
#[test]
fn casts_admit_only_offensive_actions_aimed_at_featured_targets() {
    let mut s = fixture();
    s.combat
        .start_action(1, Some(s.combat.actors[4].view.id), true, false);
    begin(&mut s);
    assert_eq!(
        s.snapshot.spotlight.as_ref().unwrap().co_casters,
        vec![s.combat.actors[1].view.id]
    );
    let mut s = fixture();
    s.combat
        .start_action(1, Some(s.combat.actors[5].view.id), true, false);
    s.combat
        .start_action(0, Some(s.combat.actors[4].view.id), true, false);
    s.combat
        .start_action(2, Some(s.combat.actors[4].view.id), false, false);
    begin(&mut s);
    assert!(s.snapshot.spotlight.as_ref().unwrap().co_casters.is_empty());
}
#[test]
fn support_revive_basics_and_enemy_attacks_never_join_even_with_forced_masks() {
    let mut s = fixture();
    s.combat.cfg.spotlight.skills.fill(true);
    s.combat.start_extra(0, s.combat.actors[4].view.id);
    s.combat
        .start_action(1, Some(s.combat.actors[4].view.id), false, false);
    s.combat.start_extra(2, s.combat.actors[0].view.id);
    s.combat
        .start_action(5, Some(s.combat.actors[3].view.id), true, false);
    // Healing Spring's cast-start freeze must finish before a new spotlight can begin.
    while s.combat.hit_stop.is_some() {
        s.step();
    }
    begin(&mut s);
    assert!(s
        .combat
        .spotlight
        .active
        .unwrap()
        .co_casters
        .slice()
        .is_empty());
    let mut s = fixture();
    s.combat
        .start_action(1, Some(s.combat.actors[0].view.id), true, true);
    begin(&mut s);
    assert!(s
        .combat
        .spotlight
        .active
        .unwrap()
        .co_casters
        .slice()
        .is_empty());
}
#[test]
fn area_footprints_admit_shared_targets_without_growing_the_target_set_transitively() {
    let mut s = fixture();
    s.combat.actors[5].view.pos = Vec2::new(625., 1100.);
    // Split reaches the primary enemy, though its locked target lies outside Pulse's area.
    s.combat.start_extra(1, s.combat.actors[5].view.id);
    s.combat.start_ground_pound(0, s.combat.actors[5].view.id);
    // Put Fara on the far side: her line reaches only the secondary enemy.
    s.combat.actors[0].view.pos = Vec2::new(750., 1100.);
    begin(&mut s);
    let v = s.snapshot.spotlight.as_ref().unwrap();
    assert_eq!(v.co_casters, vec![s.combat.actors[1].view.id]);
    assert!(v.participants.contains(&s.combat.actors[5].view.id));
    assert!(!v.participants.contains(&s.combat.actors[0].view.id));
    assert!(!v.participants.contains(&s.combat.actors[2].view.id));
}
#[test]
fn a_live_special_hazard_joins_after_cast_recovery_while_its_owners_basic_freezes() {
    let mut s = fixture();
    s.combat.start_ground_pound(0, s.combat.actors[4].view.id);
    s.combat.actors[0].view.state_age = CAST_IMPACT;
    s.combat.action(0);
    let id = s.combat.hazards[0].view.id;
    s.combat.actors[0].view.state_age = CAST_DURATION;
    s.combat
        .start_action(0, Some(s.combat.actors[4].view.id), false, false);
    let frozen = s.combat.actors[0].clone();
    begin(&mut s);
    assert_eq!(
        s.combat.spotlight.active.unwrap().co_casters.slice(),
        &[s.combat.actors[0].view.id]
    );
    assert!(s.snapshot.spotlight.as_ref().unwrap().hazards.contains(&id));
    // Ground Pound shoves targets, but must not advance its owner's unrelated Basic.
    complete(&mut s);
    assert_eq!(s.combat.actors[0].view.ward, 0.);
    assert_eq!(s.combat.actors[0].self_ward_steps, 0);
    assert!(!s.combat.actors[0].view.warcry_shield);
    // Ground Pound changes no owner state; the unrelated Basic stays frozen.
    assert_eq!(format!("{:?}", s.combat.actors[0]), format!("{frozen:?}"));
    assert!(
        s.combat
            .hazards
            .iter()
            .find(|h| h.view.id == id)
            .unwrap()
            .view
            .phase
            == HazardPhase::Resolved
    );
}
#[test]
fn travelling_specials_join_but_basic_projectiles_stay_bit_identical() {
    let mut s = fixture();
    let target = s.combat.actors[4].view.id;
    s.combat.start_action(2, Some(target), true, false);
    s.combat.projectile(
        2,
        Some(target),
        s.combat.actors[4].view.pos,
        false,
        1.,
        None,
    );
    let id = s.combat.projectiles[0].view.id;
    s.combat.actors[2].state(ActorState::Idle, 0., 0.);
    s.combat.start_action(0, Some(target), false, false);
    s.combat.projectile(
        0,
        Some(target),
        s.combat.actors[4].view.pos,
        false,
        1.,
        None,
    );
    let basic = s.combat.projectiles[1].clone();
    begin(&mut s);
    assert_eq!(s.snapshot.spotlight.as_ref().unwrap().projectiles, vec![id]);
    assert_eq!(
        s.combat.spotlight.active.unwrap().co_casters.slice(),
        &[s.combat.actors[2].view.id]
    );
    complete(&mut s);
    assert!(!s.combat.projectiles.iter().any(|p| p.view.id == id));
    assert_eq!(
        format!(
            "{:?}",
            s.combat
                .projectiles
                .iter()
                .find(|p| p.view.id == basic.view.id)
                .unwrap()
        ),
        format!("{basic:?}")
    );
}
#[test]
fn featured_projectiles_are_published_and_advance_to_completion() {
    let mut s = fixture();
    let target = s.combat.actors[4].view.id;
    s.combat.start_arcane_pulse(3, target);
    s.combat.projectile(
        3,
        Some(target),
        s.combat.actors[4].view.pos,
        false,
        1.,
        None,
    );
    let id = s.combat.projectiles[0].view.id;
    s.combat.select_spotlight();
    s.refresh_snapshot();
    assert_eq!(s.snapshot.spotlight.as_ref().unwrap().projectiles, vec![id]);
    complete(&mut s);
    assert!(!s.combat.projectiles.iter().any(|p| p.view.id == id));
}
#[test]
fn late_activations_never_join_and_a_replacement_action_cannot_reuse_membership() {
    let mut s = fixture();
    s.combat
        .start_action(1, Some(s.combat.actors[4].view.id), true, false);
    begin(&mut s);
    let members = s.combat.spotlight.active.unwrap().co_casters;
    s.combat
        .start_action(2, Some(s.combat.actors[4].view.id), true, false);
    let late_age = s.combat.actors[2].view.state_age;
    s.combat.start_extra(1, s.combat.actors[4].view.id);
    let replacement_age = s.combat.actors[1].view.state_age;
    complete(&mut s);
    assert_eq!(s.combat.actors[2].view.state_age, late_age);
    assert_eq!(s.combat.actors[1].view.state_age, replacement_age);
    assert_eq!(members.slice(), &[s.combat.actors[1].view.id]);
}
#[test]
fn window_waits_for_last_co_cast_then_freezes_it_without_followup() {
    let mut s = fixture();
    s.combat
        .start_action(1, Some(s.combat.actors[4].view.id), true, false);
    s.combat.actors[1].view.state_duration = 1.5;
    begin(&mut s);
    let combat = s.combat.combat_steps;
    let steps = complete(&mut s);
    assert!(steps >= 45);
    assert_eq!(s.combat.combat_steps, combat);
    assert_eq!(s.combat.actors[1].view.state, ActorState::Idle);
    assert_eq!(s.combat.actors[1].special_cd, 100.);
}
#[test]
fn combo_cap_freezes_outstanding_work_without_refund_cancel_or_forced_damage() {
    let mut s = fixture();
    s.combat
        .start_action(2, Some(s.combat.actors[4].view.id), true, false);
    let id = s.combat.hazards[0].view.id;
    s.combat.hazards[0].duration = 100.;
    let damage = s.combat.hazards[0].damage;
    begin(&mut s);
    let mut featured_done = None;
    let mut ticks = 0;
    while s.combat.spotlight.active.is_some() {
        s.step();
        ticks += 1;
        if s.combat
            .spotlight
            .active
            .as_ref()
            .is_some_and(|a| !a.performer_running(a.caster))
            && featured_done.is_none()
        {
            featured_done = Some(ticks);
        }
        assert!(ticks < 200);
    }
    assert_eq!(
        ticks - featured_done.unwrap(),
        (SPOTLIGHT_COMBO_EXTRA * 30.) as usize
    );
    let h = s.combat.hazards.iter().find(|h| h.view.id == id).unwrap();
    let age = h.phase_age;
    assert!(age < 5.);
    assert_eq!(h.damage, damage);
    assert_ne!(h.view.phase, HazardPhase::Resolved);
    assert!(s.drain_events().iter().any(|e| matches!(
        e,
        Event::SpotlightEnded {
            cancelled: false,
            ..
        }
    )));
    s.combat.update_hazards();
    let h = s.combat.hazards.iter().find(|h| h.view.id == id).unwrap();
    assert!(h.phase_age > age);
    assert_eq!(h.damage, damage);
}
#[test]
fn co_death_stops_holding_and_a_dead_target_keeps_normal_flight_rules() {
    let mut s = fixture();
    s.combat
        .start_action(2, Some(s.combat.actors[4].view.id), true, false);
    s.combat.hazards[0].duration = 100.;
    begin(&mut s);
    s.combat.actors[2].view.hp = 0.;
    assert!(complete(&mut s) < 40);
    assert_eq!(s.combat.hazards[0].phase_age, 0.);
    let mut s = fixture();
    s.combat.actors[5].view.pos = Vec2::new(480., 1200.);
    let target = s.combat.actors[4].view.id;
    s.combat.start_action(1, Some(target), true, false);
    s.combat.projectile(
        1,
        Some(target),
        s.combat.actors[4].view.pos,
        false,
        10.,
        None,
    );
    begin(&mut s);
    s.combat.actors[4].view.hp = 0.;
    let mut hit = false;
    while s.combat.spotlight.active.is_some() {
        s.step();
        hit|=s.drain_events().iter().any(|e|matches!(e,Event::Hit{source,target,..}if *source==s.combat.actors[1].view.id&&*target==s.combat.actors[5].view.id));
    }
    assert!(hit);
}
#[test]
fn combo_preserves_every_cooldown_and_unrelated_actor_and_enemy_hazard() {
    let mut s = fixture();
    let target = s.combat.actors[4].view.id;
    s.combat.start_action(1, Some(target), true, false);
    let e = s.combat.actors[5].view.id;
    s.hazard(
        HazardKind::SniperLine,
        e,
        Some(s.combat.actors[2].view.id),
        s.combat.actors[5].view.pos,
        Vec2::new(0., -1.),
    );
    begin(&mut s);
    let actor = format!("{:?}", s.combat.actors[5]);
    let hazard = format!("{:?}", s.combat.hazards[0]);
    let cooldowns: Vec<_> = s
        .combat
        .actors
        .iter()
        .map(|a| {
            (
                a.basic_cd,
                a.special_cd,
                a.extra_cd,
                a.pulse_cd,
                a.pound_cd,
                a.skill_lockout,
            )
        })
        .collect();
    complete(&mut s);
    assert_eq!(format!("{:?}", s.combat.actors[5]), actor);
    assert_eq!(format!("{:?}", s.combat.hazards[0]), hazard);
    assert_eq!(
        s.combat
            .actors
            .iter()
            .map(|a| (
                a.basic_cd,
                a.special_cd,
                a.extra_cd,
                a.pulse_cd,
                a.pound_cd,
                a.skill_lockout
            ))
            .collect::<Vec<_>>(),
        cooldowns
    );
}
#[test]
fn combo_membership_and_effects_are_deterministic_and_zero_allocation() {
    let mut a = fixture();
    a.combat
        .start_action(1, Some(a.combat.actors[4].view.id), true, false);
    a.combat
        .start_action(2, Some(a.combat.actors[4].view.id), true, false);
    begin(&mut a);
    let mut b = fixture();
    b.combat
        .start_action(1, Some(b.combat.actors[4].view.id), true, false);
    b.combat
        .start_action(2, Some(b.combat.actors[4].view.id), true, false);
    begin(&mut b);
    assert_eq!(
        a.combat.spotlight.active.unwrap().co_casters.slice().len(),
        2
    );
    while a.combat.spotlight.active.is_some() {
        ALLOCATIONS.with(|n| n.set(Some(0)));
        a.step();
        let count = ALLOCATIONS.with(|n| n.replace(None));
        assert_eq!(count, Some(0));
        b.step();
        assert_eq!(a.state_hash(), b.state_hash());
        a.drain_events();
        b.drain_events();
    }
}

#[test]
fn charge_and_tail_freeze_the_entire_combo_and_use_the_config_clock() {
    let mut s = fixture();
    s.combat.cfg.spotlight.charge = SpotlightConfig::DEFAULT.charge;
    s.combat.cfg.spotlight.auto_release = false;
    s.combat.cfg.spotlight.tail_cap = 3.;
    s.combat
        .start_action(2, Some(s.combat.actors[4].view.id), true, false);
    begin(&mut s);
    let frozen = format!(
        "{:?}{:?}{:?}",
        s.combat.actors, s.combat.hazards, s.combat.projectiles
    );
    let combat = s.combat.combat_steps;
    for _ in 0..(s.combat.cfg.spotlight.charge * 30.).ceil() as usize {
        s.step();
        assert_eq!(
            format!(
                "{:?}{:?}{:?}",
                s.combat.actors, s.combat.hazards, s.combat.projectiles
            ),
            frozen
        );
        assert_eq!(s.combat.combat_steps, combat);
    }
    assert_eq!(
        s.combat.spotlight.active.unwrap().phase,
        SpotlightPhase::Performing
    );
    while s.combat.spotlight.active.unwrap().phase != SpotlightPhase::Tail {
        s.step();
    }
    let frozen = format!(
        "{:?}{:?}{:?}",
        s.combat.actors, s.combat.hazards, s.combat.projectiles
    );
    for _ in 0..10 {
        s.step();
        assert_eq!(
            format!(
                "{:?}{:?}{:?}",
                s.combat.actors, s.combat.hazards, s.combat.projectiles
            ),
            frozen
        );
        assert_eq!(s.combat.combat_steps, combat);
    }
    s.release_spotlight();
    assert!(s.combat.spotlight.active.is_none());
}
#[test]
fn hondo_co_performer_finishes_without_closing_window_and_old_featured_hazards_do_not_join() {
    let mut s = fixture();
    s.combat
        .start_action(1, Some(s.combat.actors[4].view.id), true, false);
    s.combat.actors[1].view.state_duration = 0.4;
    begin(&mut s);
    while s.combat.actors[1].view.state == ActorState::Cast {
        s.step();
    }
    assert!(
        s.combat.spotlight.active.is_some(),
        "Kaja's action continues after Hondo finishes"
    );
    assert!(!s
        .combat
        .spotlight
        .active
        .unwrap()
        .performer_running(s.combat.actors[1].view.id));
    complete(&mut s);
    let mut s = fixture();
    let target = s.combat.actors[4].view.id;
    s.combat.start_arcane_pulse(3, target);
    s.combat.actors[3].view.state_age = CAST_IMPACT;
    s.combat.action(3);
    let old = s.combat.hazards[0].view.id;
    s.combat.actors[3].view.state_age = CAST_DURATION;
    begin(&mut s);
    let frozen = format!("{:?}", s.combat.hazards[0]);
    assert!(!s
        .combat
        .spotlight
        .active
        .unwrap()
        .hazards
        .slice()
        .contains(&old));
    complete(&mut s);
    assert_eq!(
        format!(
            "{:?}",
            s.combat.hazards.iter().find(|h| h.view.id == old).unwrap()
        ),
        frozen
    );
}
