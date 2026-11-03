use super::*;
use crate::{tests::ALLOCATIONS, tuning::*};

fn open_config() -> SpotlightConfig {
    SpotlightConfig {
        global_gap: 0.,
        hero_gap: 0.,
        fairness: 0.,
        skills: [true; Skill::ALL.len()], // Even explicit masks cannot make utility skills eligible.
        auto_release: true,
        charge: 0.,
        ..SpotlightConfig::DEFAULT
    }
}
fn fixture(config: SpotlightConfig) -> Sim {
    let mut s = Sim::composition_trial(
        SimConfig {
            spotlight: config,
            ..Default::default()
        },
        &[Archetype::Orc],
    );
    for a in &mut s.combat.actors {
        a.view.pos = Vec2::new(480., 1100.);
        a.destination = a.view.pos;
    }
    s.combat.actors[0].view.pos.y += 200.;
    s.combat.actors[2].view.pos.y += 200.;
    s.combat.actors[3].view.pos.y += 200.;
    s.combat.actors[4].view.pos.x += 50.;
    s.combat.actors[4].view.hp = 100000.;
    // Scheduling/lifecycle probes qualify through the boss-target branch, retaining Orc stats.
    s.combat.actors[4].view.archetype = Archetype::Boss;
    s.combat.events.clear();
    s
}
fn activate(s: &mut Sim, hero: usize, extra: bool) {
    // These scheduling probes explicitly advance past the previous package's recovery.
    s.combat.actors[hero].view.state_age = s.combat.actors[hero].view.state_duration;
    s.combat.actors[hero].action_done = true;
    let target = s.combat.actors[4].view.id;
    if extra {
        s.combat.start_extra(hero, target);
    } else if hero == 0 {
        s.combat.start_ground_pound(hero, target);
    } else if hero == 3 {
        s.combat.start_arcane_pulse(hero, target);
    } else {
        s.combat.start_action(hero, Some(target), true, false);
    }
    s.combat.select_spotlight();
    s.refresh_snapshot();
}
fn complete(s: &mut Sim) -> usize {
    let mut steps = 0;
    while s.combat.spotlight.active.is_some() && steps < 300 {
        s.step();
        steps += 1;
    }
    assert!(s.combat.spotlight.active.is_none(), "spotlight stuck");
    steps
}
fn tail(s: &mut Sim) {
    for _ in 0..150 {
        if s.combat
            .spotlight
            .active
            .as_ref()
            .is_some_and(|s| s.phase == SpotlightPhase::Tail)
        {
            return;
        }
        s.step();
    }
    panic!("Tail never began");
}
fn ended(s: &mut Sim, cancelled: bool) {
    let events = s.drain_events();
    assert_eq!(
        events
            .iter()
            .filter(|e| matches!(e, Event::SpotlightEnded { .. }))
            .count(),
        1
    );
    assert!(events
        .iter()
        .any(|e| matches!(e, Event::SpotlightEnded { cancelled: c, .. } if *c == cancelled)));
    assert!(s.snapshot.spotlight.is_none());
}

#[test]
fn spotlight_requires_boss_target_or_three_enemies_in_committed_hit_area() {
    for (hero, extra) in [(0, false), (1, false), (1, true), (2, false), (3, false)] {
        for (count, boss, expected) in [
            (1, false, false),
            (2, false, false),
            (3, false, hero != 1 || extra),
            (1, true, true),
        ] {
            let mut s = fixture(open_config());
            s.combat.actors[4].view.archetype = if boss {
                Archetype::Boss
            } else {
                Archetype::Orc
            };
            let center = s.combat.actors[4].view.pos;
            for n in 1..count {
                s.spawn_actor(Archetype::Orc, center + Vec2::new(n as f32, 0.));
            }
            activate(&mut s, hero, extra);
            assert_eq!(
                s.combat.spotlight.active.is_some(),
                expected,
                "hero={hero}, extra={extra}, count={count}, boss={boss}"
            );
            assert!(s
                .drain_events()
                .iter()
                .any(|e| matches!(e, Event::SkillStarted { .. })));
        }
        // Three on the field, only two in the actual hit area.
        let mut s = fixture(open_config());
        s.combat.actors[4].view.archetype = Archetype::Orc;
        let center = s.combat.actors[4].view.pos;
        s.spawn_actor(Archetype::Orc, center + Vec2::new(1., 0.));
        let outside = s.spawn_actor(Archetype::Orc, Vec2::new(800., 500.));
        activate(&mut s, hero, extra);
        assert!(
            s.combat.spotlight.active.is_none(),
            "hero={hero}, extra={extra}"
        );
        // Moving the third enemy into the area after commitment cannot queue a spotlight.
        let t = s.combat.actor_index(outside).unwrap();
        s.combat.actors[t].view.pos = center;
        s.combat.select_spotlight();
        assert!(s.combat.spotlight.active.is_none());
    }
}

#[test]
fn spotlight_eligibility_is_captured_at_commit_before_selection() {
    let mut s = fixture(open_config());
    s.combat.actors[4].view.archetype = Archetype::Orc;
    for dx in [-5., 5.] {
        s.spawn_actor(
            Archetype::Orc,
            s.combat.actors[4].view.pos + Vec2::new(dx, 0.),
        );
    }
    s.combat.start_arcane_pulse(3, s.combat.actors[4].view.id);
    s.combat.actors[6].view.pos = Vec2::new(800., 500.);
    s.combat.select_spotlight();
    assert!(s.combat.spotlight.active.is_some());
}

#[test]
fn denied_spotlights_leave_attack_outcomes_timing_meters_and_rng_unchanged() {
    for (hero, extra) in [(0, false), (1, false), (1, true), (2, false), (3, false)] {
        for count in [1, 2] {
            let mut results = Vec::new();
            for enabled in [false, true] {
                let mut s = fixture(SpotlightConfig {
                    enabled,
                    ..open_config()
                });
                s.combat.actors[4].view.archetype = Archetype::Orc;
                if count == 2 {
                    s.spawn_actor(Archetype::Orc, s.combat.actors[4].view.pos);
                }
                s.combat.actors[hero].view.meter = 3.;
                activate(&mut s, hero, extra);
                let mut events = s.drain_events();
                for _ in 0..60 {
                    s.step();
                    assert!(s.combat.spotlight.active.is_none());
                    events.extend(s.drain_events());
                }
                results.push(format!(
                    "{:?}{:?}{:?}{:?}{:?}",
                    s.combat.actors,
                    s.combat.hazards,
                    s.combat.projectiles,
                    s.combat.combat_rng.0,
                    events
                ));
            }
            assert_eq!(
                results[0], results[1],
                "hero={hero}, extra={extra}, count={count}"
            );
        }
    }
}

#[test]
fn spotlight_gate_matches_circle_body_split_feet_and_line_burst_contacts() {
    for (hero, extra, case, expected) in [
        (1, true, 0, false),
        (2, false, 0, true),
        (3, false, 0, true),
        (0, false, 1, false),
        (0, false, 2, true),
        (0, false, 3, false),
    ] {
        let mut s = fixture(open_config());
        s.combat.actors[4].view.archetype = Archetype::Orc;
        let center = s.combat.actors[4].view.pos;
        s.spawn_actor(Archetype::Orc, center);
        let origin = s.combat.actors[hero].view.pos;
        let dir = (center - origin).normalized();
        let side = Vec2::new(-dir.y, dir.x);
        let end = center + dir * s.combat.actors[4].view.radius;
        let pos = match case {
            0 => {
                center
                    + Vec2::new(
                        0.,
                        match hero {
                            1 => SPLIT_RADIUS,
                            2 => BUBBLE_RADIUS,
                            _ => ARCANE_PULSE_RADIUS,
                        } + 7.,
                    )
            }
            1 => origin + dir * 80. + side * (GROUND_POUND_WIDTH * 0.5 + 7.),
            2 => end + side * (GROUND_POUND_BURST_RADIUS - 7.),
            _ => end + side * (GROUND_POUND_BURST_RADIUS + 7.),
        };
        let third = s.spawn_actor(Archetype::Orc, pos);
        activate(&mut s, hero, extra);
        assert_eq!(
            s.combat.spotlight.active.is_some(),
            expected,
            "hero={hero}, case={case}"
        );
        s.combat.actors[hero].view.state_age = s.combat.actors[hero].view.impact_at;
        s.combat.action(hero);
        let t = s.combat.actor_index(third).unwrap();
        let hit = if extra {
            pos.distance(center) <= SPLIT_RADIUS
        } else {
            let h = s
                .combat
                .hazards
                .iter()
                .find(|h| {
                    h.view.owner == s.combat.actors[hero].view.id
                        && matches!(
                            h.view.kind,
                            HazardKind::BubblePop
                                | HazardKind::ArcanePulse
                                | HazardKind::GroundPound
                        )
                })
                .unwrap();
            h.hits(pos, h.hit_radius(s.combat.actors[t].view.radius))
        };
        assert_eq!(
            hit, expected,
            "resolution geometry: hero={hero}, case={case}"
        );
    }
}

#[test]
fn spotlight_aoe_body_overlap_is_included_before_damage() {
    for (hero, kind, offset) in [
        (2, HazardKind::BubblePop, Vec2::new(0., BUBBLE_RADIUS + 7.)),
        (
            3,
            HazardKind::ArcanePulse,
            Vec2::new(0., ARCANE_PULSE_RADIUS + 7.),
        ),
        (
            0,
            HazardKind::GroundPound,
            Vec2::new(-25., GROUND_POUND_WIDTH * 0.5 + 7.),
        ),
        (0, HazardKind::GroundPound, Vec2::new(30., 70.)),
    ] {
        let mut s = fixture(open_config());
        let enemy = s.spawn_actor(Archetype::Orc, s.combat.actors[4].view.pos + offset);
        let hp = s.combat.actors[s.combat.actor_index(enemy).unwrap()]
            .view
            .hp;
        activate(&mut s, hero, false);
        assert!(s
            .combat
            .spotlight
            .active
            .unwrap()
            .participants
            .slice()
            .contains(&enemy));
        for _ in 0..20 {
            if s.combat.hazards.iter().any(|h| h.view.kind == kind) {
                break;
            }
            s.step();
        }
        let h = s
            .combat
            .hazards
            .iter()
            .find(|h| h.view.kind == kind)
            .unwrap();
        assert_eq!(h.view.phase, HazardPhase::Locked);
        assert!(h.view.progress < 1.);
        assert_eq!(
            s.combat.actors[s.combat.actor_index(enemy).unwrap()]
                .view
                .hp,
            hp
        );
        let spotlight = s.combat.spotlight.active.unwrap();
        for &id in spotlight.participants.slice() {
            assert!(
                id == spotlight.caster
                    || s.combat.actors[s.combat.actor_index(id).unwrap()].view.team == Team::Enemy
            );
        }
    }
}

#[test]
fn spotlight_tracking_footprints_add_entrants_before_resolve_and_never_shrink() {
    for (hero, kind) in [
        (2, HazardKind::BubblePop),
        (3, HazardKind::ArcanePulse),
        (0, HazardKind::GroundPound),
    ] {
        let mut s = fixture(open_config());
        let original = s.spawn_actor(Archetype::Orc, Vec2::new(530., 1060.));
        let entrant = s.spawn_actor(Archetype::Orc, Vec2::new(740., 1300.));
        let hp = s.combat.actors[s.combat.actor_index(entrant).unwrap()]
            .view
            .hp;
        activate(&mut s, hero, false);
        assert!(s
            .combat
            .spotlight
            .active
            .unwrap()
            .participants
            .slice()
            .contains(&original));
        assert!(!s
            .combat
            .spotlight
            .active
            .unwrap()
            .participants
            .slice()
            .contains(&entrant));
        for _ in 0..20 {
            if s.combat.hazards.iter().any(|h| h.view.kind == kind) {
                break;
            }
            s.step();
        }
        assert!(s.combat.hazards.iter().any(|h| h.view.kind == kind));
        s.combat.actors[4].view.pos = Vec2::new(760., 1300.);
        s.step();
        let spotlight = s.combat.spotlight.active.unwrap();
        assert!(
            spotlight.participants.slice().contains(&entrant),
            "{kind:?}"
        );
        assert!(spotlight.participants.slice().contains(&original));
        assert_eq!(
            s.combat.actors[s.combat.actor_index(entrant).unwrap()]
                .view
                .hp,
            hp
        );
        assert!(s
            .combat
            .hazards
            .iter()
            .any(|h| h.view.kind == kind && h.view.phase == HazardPhase::Locked));
    }
}

#[test]
fn combo_footprints_include_bystanders_and_grow_before_impact() {
    let mut s = fixture(open_config());
    let target = s.combat.actors[4].view.id;
    let bystander = s.spawn_actor(Archetype::Orc, Vec2::new(530., 1200.));
    let entrant = s.spawn_actor(Archetype::Orc, Vec2::new(740., 1300.));
    s.combat.start_arcane_pulse(3, target);
    s.combat.start_action(1, Some(target), true, false);
    s.combat.select_spotlight();
    let spotlight = s.combat.spotlight.active.unwrap();
    assert_eq!(spotlight.caster, s.combat.actors[1].view.id);
    assert!(spotlight
        .co_casters
        .slice()
        .contains(&s.combat.actors[3].view.id));
    assert!(spotlight.participants.slice().contains(&bystander));
    assert!(!spotlight.participants.slice().contains(&entrant));
    s.combat.actors[4].view.pos = Vec2::new(760., 1300.);
    s.step();
    let updated = s.combat.spotlight.active.unwrap();
    assert_eq!(updated.co_casters.slice(), spotlight.co_casters.slice());
    assert!(updated.participants.slice().contains(&entrant));
    assert!(updated.participants.slice().contains(&bystander));
    assert_eq!(s.combat.actors[3].view.state_age, SIM_DT);
}

#[test]
fn spotlight_current_skills_emit_once_and_basics_revive_are_ineligible() {
    let cases = [
        (0, true, Skill::Taunt),
        (1, false, Skill::Shadow),
        (1, true, Skill::Split),
        (2, false, Skill::BubblePop),
        (3, false, Skill::Elevate),
        (3, false, Skill::ArcanePulse),
        (0, false, Skill::GroundPound),
        (2, true, Skill::HealingSpring),
    ];
    for (hero, extra, skill) in cases {
        let mut s = fixture(open_config());
        let target = s.combat.actors[4].view.id;
        match skill {
            Skill::ArcanePulse => s.combat.start_arcane_pulse(hero, target),
            Skill::GroundPound => s.combat.start_ground_pound(hero, target),
            _ if extra => s.combat.start_extra(hero, target),
            _ => s.combat.start_action(hero, Some(target), true, false),
        }
        s.combat.select_spotlight();
        s.refresh_snapshot();
        let events = s.drain_events();
        assert_eq!(
            events
                .iter()
                .filter(|e| matches!(e, Event::SkillStarted { .. }))
                .count(),
            1
        );
        assert!(events
            .iter()
            .any(|e| matches!(e, Event::SkillStarted { skill: k, .. } if *k == skill)));
        assert_eq!(s.snapshot.spotlight.is_some(), skill.offensive());
        if skill.offensive() {
            assert_eq!(s.snapshot.spotlight.as_ref().unwrap().skill, skill);
            complete(&mut s);
            ended(&mut s, false);
        }
    }
    for revive in [false, true] {
        let mut s = fixture(open_config());
        let target = s.combat.actors[1].view.id;
        if revive {
            s.combat.actors[1].view.hp = 0.;
            s.deaths();
        }
        s.combat.start_action(0, Some(target), false, revive);
        s.combat.select_spotlight();
        assert!(s.combat.spotlight.active.is_none());
        assert!(!s
            .drain_events()
            .iter()
            .any(|e| matches!(e, Event::SkillStarted { .. })));
    }
}
#[test]
fn spotlight_disabled_skills_and_skipped_candidates_never_queue() {
    let mut cfg = open_config();
    cfg.skills[Skill::Shadow.index()] = false;
    let mut s = fixture(cfg);
    activate(&mut s, 1, false);
    assert!(s.combat.spotlight.active.is_none());
    cfg.skills.fill(true);
    cfg.global_gap = 10.;
    s.set_spotlight(cfg);
    activate(&mut s, 0, false);
    assert!(s.combat.spotlight.active.is_none());
    s.combat.combat_steps = 1000;
    s.combat.select_spotlight();
    assert!(s.combat.spotlight.active.is_none());
    // An otherwise eligible activation collected while active cannot become a later candidate.
    s.set_spotlight(open_config());
    activate(&mut s, 0, false);
    let id = s.combat.actors[1].view.id;
    s.combat.skill_started(id, Skill::Shadow, None);
    complete(&mut s);
    s.combat.select_spotlight();
    assert!(s.combat.spotlight.active.is_none());
}
#[test]
fn spotlight_longest_wait_wins_with_stable_equal_wait_order() {
    let mut s = fixture(open_config());
    s.combat.combat_steps = 300;
    s.combat.spotlight.last_hero = [250, 100, 0, 0];
    let target = s.combat.actors[4].view.id;
    s.combat.start_ground_pound(0, target);
    s.combat.start_action(1, Some(target), true, false);
    s.combat.select_spotlight();
    assert_eq!(
        s.combat.spotlight.active.unwrap().caster,
        s.combat.actors[1].view.id
    );
    let mut s = fixture(open_config());
    s.combat.start_action(1, Some(target), true, false);
    s.combat.start_ground_pound(0, target);
    s.combat.select_spotlight();
    assert_eq!(
        s.combat.spotlight.active.unwrap().caster,
        s.combat.actors[0].view.id
    );
}
#[test]
fn spotlight_combat_gaps_fairness_and_drought() {
    let mut cfg = open_config();
    cfg.global_gap = 10.;
    cfg.hero_gap = 20.;
    let mut s = fixture(cfg);
    s.combat.combat_steps = 599;
    activate(&mut s, 0, false);
    assert!(s.combat.spotlight.active.is_none());
    s.combat.combat_steps = 600;
    activate(&mut s, 0, false);
    assert!(s.combat.spotlight.active.is_some());
    let clock = s.combat.combat_steps;
    complete(&mut s);
    assert_eq!(s.combat.combat_steps, clock);
    s.combat.combat_steps = 899;
    activate(&mut s, 1, false); // global gap fails although hero has waited enough
    assert!(s.combat.spotlight.active.is_none());
    s.combat.combat_steps = 900;
    activate(&mut s, 1, false);
    assert!(s.combat.spotlight.active.is_some());
    let mut cfg = open_config();
    cfg.global_gap = 10.;
    cfg.fairness = 0.6;
    cfg.drought = 2.;
    let mut s = fixture(cfg);
    s.combat.combat_steps = 1000;
    s.combat.spotlight.last_end = 500;
    s.combat.spotlight.last_hero[0] = 900;
    activate(&mut s, 0, false);
    assert!(s.combat.spotlight.active.is_none());
    s.combat.combat_steps = 1100;
    activate(&mut s, 0, false); // drought bypasses fairness
    assert!(s.combat.spotlight.active.is_some());
    let mut s = fixture(cfg);
    s.combat.combat_steps = 1000;
    s.combat.spotlight.last_end = 500;
    s.combat.spotlight.last_hero[0] = 400; // exactly 60% of longest living wait
    activate(&mut s, 0, false);
    assert!(s.combat.spotlight.active.is_some());
    let mut s = fixture(cfg);
    s.combat.combat_steps = 1000;
    s.combat.spotlight.last_end = 500;
    s.combat.spotlight.last_hero = [600, 600, 600, 0];
    s.combat.actors[3].view.hp = 0.;
    s.combat.actors[3].state(ActorState::Downed, 0., 0.); // Pre-existing down: no new hit-stop.
    activate(&mut s, 0, false);
    assert!(s.combat.spotlight.active.is_some());
}
#[test]
fn spotlight_tail_release_cap_and_early_release() {
    let mut cfg = open_config();
    cfg.auto_release = false;
    cfg.tail_cap = 0.2;
    let mut s = fixture(cfg);
    activate(&mut s, 0, false);
    s.release_spotlight(); // release is presentation-only after mechanics finish
    assert!(s.combat.spotlight.active.is_some());
    tail(&mut s);
    let hash = format!("{:?}", s.combat.actors);
    let clock = s.combat.combat_steps;
    for _ in 0..5 {
        s.step();
        assert!(s.combat.spotlight.active.is_some());
    }
    assert_eq!(format!("{:?}", s.combat.actors), hash);
    s.step();
    assert!(s.combat.spotlight.active.is_none());
    assert_eq!(s.combat.combat_steps, clock);
    ended(&mut s, false);
    activate(&mut s, 0, false);
    tail(&mut s);
    s.release_spotlight();
    ended(&mut s, false);
    activate(&mut s, 0, false);
    tail(&mut s);
    cfg.auto_release = true;
    s.set_spotlight(cfg);
    ended(&mut s, false);
}
#[test]
fn spotlight_cancellation_missing_dead_downed_disable_transition_and_scene_reset() {
    for case in 0..7 {
        let mut s = fixture(open_config());
        activate(&mut s, 0, false);
        match case {
            0 => {
                s.combat.actors.remove(0);
                s.step();
            }
            1 => {
                s.combat.actors[0].view.hp = 0.;
                s.step();
            }
            2 => {
                s.combat.actors[0].state(ActorState::Downed, 0., 0.);
                s.step();
            }
            3 => s.set_spotlight(SpotlightConfig::OFF),
            4 => {
                s.director.transition = 1;
                s.step();
            }
            5 => {
                s.reset_stage(false);
                s.refresh_snapshot();
            }
            6 => {
                s.reset_stage(true);
                s.refresh_snapshot();
            }
            _ => unreachable!(),
        }
        ended(&mut s, true);
        let clock = s.combat.combat_steps;
        s.step();
        assert_eq!(s.combat.combat_steps, clock + 1);
    }
}
#[test]
fn spotlight_boss_kill_waits_for_tail_then_finishes_stage() {
    let mut cfg = open_config();
    cfg.auto_release = false;
    let mut s = fixture(cfg);
    s.combat.actors[4].view.hp = 1.;
    s.combat.actors[4].stats.evade = 0.;
    s.director.boss = Some(s.combat.actors[4].view.id);
    activate(&mut s, 3, false);
    tail(&mut s);
    assert_eq!(s.combat.actors[4].view.state, ActorState::Dead);
    assert_eq!(s.director.transition, 0);
    assert!(!s
        .drain_events()
        .iter()
        .any(|e| matches!(e, Event::StageCleared)));
    s.release_spotlight();
    assert_eq!(s.director.transition, 1);
    let events = s.drain_events();
    assert!(matches!(
        events[0],
        Event::SpotlightEnded {
            cancelled: false,
            ..
        }
    ));
    assert!(matches!(events[1], Event::StageCleared));
}
#[test]
fn spotlight_unrelated_actor_hazard_projectile_and_every_cooldown_freeze() {
    let mut s = fixture(open_config());
    let owner = s.combat.actors[4].view.id;
    s.hazard(
        HazardKind::LizardoDrop,
        999999, // unrelated warning must not become a boss-special veto
        Some(s.combat.actors[0].view.id),
        Vec2::new(700., 700.),
        Vec2::new(1., 0.),
    );
    s.hazard(
        HazardKind::FazePool,
        s.combat.actors[3].view.id,
        None,
        s.combat.actors[4].view.pos,
        Vec2::new(1., 0.),
    );
    s.combat.projectile(
        3,
        Some(owner),
        s.combat.actors[4].view.pos,
        false,
        15.,
        None,
    );
    s.combat.actors[1].revive_progress = 2.;
    s.combat.actors[1].revive_grace = 1.;
    activate(&mut s, 0, false);
    let actors_before = s.combat.actors[1..].to_vec();
    let hazards = format!("{:?}", s.combat.hazards);
    let hazard_count = s.combat.hazards.len();
    let projectiles = format!("{:?}", s.combat.projectiles);
    let director = format!("{:?}", s.director);
    let stage = format!("{:?}", s.stage);
    let cds = (
        s.combat.actors[0].basic_cd,
        s.combat.actors[0].special_cd,
        s.combat.actors[0].extra_cd,
        s.combat.actors[0].revive_cd,
        s.combat.actors[0].mend_cd,
        s.combat.actors[0].ai_cd,
    );
    let clock = s.combat.combat_steps;
    let steps = complete(&mut s);
    assert_eq!(s.combat.combat_steps, clock);
    assert_eq!(s.combat.step_number, steps as u64);
    let mut after = s.combat.actors[1..].to_vec();
    after[3].view.hp = actors_before[3].view.hp;
    after[3].view.ward = actors_before[3].view.ward;
    after[3].view.pos = actors_before[3].view.pos;
    after[3].undamaged = actors_before[3].undamaged;
    assert!(after[3].enmity[0] > actors_before[3].enmity[0]);
    after[3].enmity = actors_before[3].enmity;
    after[3].enmity_seeded = actors_before[3].enmity_seeded;
    assert_ne!(after[3].push_rng.0, actors_before[3].push_rng.0);
    after[3].push_rng.0 = actors_before[3].push_rng.0;
    assert_eq!(format!("{after:?}"), format!("{actors_before:?}"));
    assert_eq!(format!("{:?}", &s.combat.hazards[..hazard_count]), hazards);
    assert_eq!(format!("{:?}", s.combat.projectiles), projectiles);
    assert_eq!(format!("{:?}", s.director), director);
    assert_eq!(format!("{:?}", s.stage), stage);
    assert_eq!(
        (
            s.combat.actors[0].basic_cd,
            s.combat.actors[0].special_cd,
            s.combat.actors[0].extra_cd,
            s.combat.actors[0].revive_cd,
            s.combat.actors[0].mend_cd,
            s.combat.actors[0].ai_cd
        ),
        cds
    );
    assert!(s.combat.actors[4].view.hp < 100000.);
}
#[test]
fn spotlight_bubble_pop_resolves_knockback_and_full_cast_before_release() {
    let mut s = fixture(open_config());
    s.combat.actors[4].view.archetype = Archetype::Orc;
    let pos = s.combat.actors[4].view.pos;
    for dx in [-5., 5.] {
        s.spawn_actor(Archetype::Orc, pos + Vec2::new(dx, 0.));
    }
    activate(&mut s, 2, false);
    let bubble = s.snapshot.spotlight.as_ref().unwrap().hazards[0];
    let participants = &s.snapshot.spotlight.as_ref().unwrap().participants;
    assert_eq!(
        &participants[..2],
        &[s.combat.actors[2].view.id, s.combat.actors[4].view.id]
    );
    assert_eq!(participants.len(), 4); // caster + three enemies; friendly bystanders cannot be hit
    let steps = complete(&mut s);
    assert!(steps as f32 * SIM_DT >= CAST_DURATION);
    assert!(s
        .combat
        .hazards
        .iter()
        .any(|h| h.view.id == bubble && h.view.phase == HazardPhase::Resolved));
    assert!(s.combat.actors[4].view.hp < 100000.);
    assert!(s.combat.actors[4].view.pos.distance(pos) > 60.);
}
#[test]
fn spotlight_defensive_control_support_never_qualify_even_with_explicit_masks() {
    for preset in [
        SpotlightConfig::OFF,
        SpotlightConfig::CONSERVATIVE,
        SpotlightConfig::DEFAULT,
        SpotlightConfig::AGGRESSIVE,
        open_config(),
    ] {
        for (hero, extra, skill) in [
            (0, true, Skill::Taunt),
            (3, false, Skill::Elevate),
            (2, true, Skill::HealingSpring),
        ] {
            let mut cfg = preset;
            cfg.global_gap = 0.;
            cfg.hero_gap = 0.;
            cfg.fairness = 0.;
            cfg.skills[skill.index()] = true;
            let mut s = fixture(cfg);
            let target = s.combat.actors[4].view.id;
            if extra {
                s.combat.start_extra(hero, target);
            } else {
                s.combat.start_action(hero, Some(target), true, false);
            }
            s.combat.select_spotlight();
            assert!(s.combat.spotlight.active.is_none(), "{skill:?}");
        }
    }
}
#[test]
fn spotlight_split_adds_all_affected_participants() {
    for hero in [1] {
        let mut cfg = open_config();
        cfg.auto_release = false;
        let mut s = fixture(cfg);
        let extra = s.spawn_actor(Archetype::Gobloc, Vec2::new(520., 1100.));
        s.combat.actors[5].view.hp = 10000.;
        activate(&mut s, hero, true);
        for _ in 0..30 {
            s.step();
            if s.combat.actors[hero].action_done {
                break;
            }
        }
        assert!(s.combat.actors[hero].action_done);
        assert!(s
            .snapshot
            .spotlight
            .as_ref()
            .unwrap()
            .participants
            .contains(&extra));
    }
}
#[test]
fn spotlight_off_clocks_and_hashes_match_current_baseline() {
    // Owner groove meters, locked heals, safe Combo hops and party-wide Elevate.
    // Includes waves.json healer content, burst-healer action state, retired curse state,
    // healer-priority targets and Chimerilass's authored 70% attack frequency.
    // Also hashes barrage mode/cooldown/Fortress/retry state; heal casts resolve before AI re-plans.
    // ORKA-6jh1.41: Marid teleports, fires hostile orbs and breaks old spatial locks; native/Wasm parity passes.
    // Owner pacing: different-type reinforcements follow 6 s after emergence; waves rest 3.5 s after the chest banner.
    // Chest footprint ellipse extends toward the camera; spawns keep role buffers from heroes.
    // Actor moats keep heroes and enemies from stacking; Marid owns the former Kaja aura.
    // Ordinary Shadow now seeks horizontal starts and uses straight-across Combo hops.
    // Combo ends without Split when no living engageable target is within exact weapon reach.
    // Rage now auto-fills over 10 combat seconds and credits ward-absorbed hits.
    // Owner three-stock Rage and Warcry priority; Warcry and Ground Pound cost one stock.
    // Combined Hondo straight-line and Fara Rage lanes (Marid avoidance reverted).
    // Kaja holds Power stocks until an enemy has finished spawning.
    // ORKA-4kxc: 1552-u playable height, centre-derived staging/rewards and fixed upper boss court.
    // Kaja Mend pulses every3 combat seconds to all heroes within live weapon reach.
    // Mage AoE preference, offensive-eligibility hold, wave/boss resets and Kaja basic splash.
    // Combined Mirewing AI/separation and enemy tuning, including Gloamink ATK 10.
    // Warcry owns the persistent shield; Ground Pound retains damage/push and costs one.
    // Mage kiting uses contact reach for Sniper/Mirewing; native/Wasm parity verified.
    // ORKA-6jh1.20: shared cap/queued placement and introductory stage-1 script.
    // ORKA-6jh1.23: ordinary enemies ramp by the announced outer wave.
    // ORKA-6jh1.34: approved Elevate/Warcry wind-ups; behavior and native/Wasm parity pass.
    // ORKA-6jh1.53: Hondo/Runa passive fill; groove behavior and native/Wasm parity pass.
    // ORKA-6jh1.44: seeded boss selection/history and forecast; native/Wasm parity pass.
    // ORKA-6jh1.39: one-stock Ground Pound and three-stock Rage; combined native/Wasm parity passes.
    // ORKA-6jh1.52: Gloamink HP +15% and landed-hit poison; native/Wasm parity passes.
    // ORKA-6jh1.47: Mirewing hover halved and HP +45%; combined native/Wasm parity passes.
    // ORKA-6jh1.51: weighted MaxHp reward stream; behavior guards and native/Wasm parity pass.
    // ORKA-6jh1.54: side-only chest paths; 500 behavior tests and native/Wasm parity pass.
    // ORKA-6jh1.57: sixty-step Marid phases; behavior and native/Wasm parity pass.
    // Combined .57/.58/.60 behavior guards and native/Wasm parity at3600 steps pass.
    // ORKA-6jh1.62: hashed roster completion and generic no-target hold; native/Wasm parity passes.
    // ORKA-6jh1.67: Elevate pending/active variants and choice RNG; behavior proof and native/Wasm parity pass.
    // ORKA-6jh1.68: owner 30/15/15/15/15/10 chest retune; native/Wasm parity passes.
    // ORKA-6jh1.79: unevadable Pulse and live distance scaling; native/Wasm parity passes.
    // ORKA-6jh1.80: Power auto-fill +15%; native/Wasm parity passes.
    // ORKA-nspw.10: binary-combat PRD plus actor/check counter hashing.
    let cases = [
        (1, 0xe957f91cd9cc7b23),
        (7, 0x7ddcfc29bcd02044),
        (42, 0x498164b3743cf168),
    ];
    let actual = cases.map(|(seed, _)| {
        let mut s = Sim::new(SimConfig {
            seed,
            ..Default::default()
        });
        for _ in 0..3600 {
            s.step();
            s.combat.events.clear();
            assert!(s.snapshot.combat_time <= s.snapshot.time);
        }
        s.state_hash()
    });
    assert_eq!(actual, cases.map(|(_, hash)| hash));
}
#[test]
fn spotlight_auto_release_deterministic_across_frame_chunkings() {
    for seed in [1, 7, 42] {
        let config = SimConfig {
            seed,
            spotlight: SpotlightConfig {
                auto_release: true,
                ..SpotlightConfig::DEFAULT
            },
            ..Default::default()
        };
        let mut reference = Sim::new(config.clone());
        for _ in 0..5400 {
            reference.step();
            reference.combat.events.clear();
        }
        assert!(reference.snapshot.time > reference.snapshot.combat_time);
        for dt in [1_f32 / 30., 1. / 60., 1. / 120., 0.173] {
            let mut s = Sim::new(config.clone());
            while s.combat.step_number < reference.combat.step_number {
                let cap = ((reference.combat.step_number - s.combat.step_number) as f64 / 30.
                    - s.combat.accumulator)
                    .max(0.) as f32;
                s.advance(dt.min(cap));
                s.combat.events.clear();
            }
            assert_eq!(
                s.state_hash(),
                reference.state_hash(),
                "seed={seed} dt={dt}"
            );
        }
    }
}
#[test]
fn spotlight_auto_release_zero_allocations_twenty_seeds_nine_hundred_seconds() {
    let mut frozen = 0;
    let mut allocations = 0;
    for seed in 1..=20 {
        let mut s = Sim::new(SimConfig {
            seed,
            spotlight: SpotlightConfig {
                auto_release: true,
                ..SpotlightConfig::DEFAULT
            },
            ..Default::default()
        });
        s.combat.events.clear();
        for _ in 0..900 * SIM_HZ {
            frozen += usize::from(s.combat.spotlight.active.is_some());
            ALLOCATIONS.with(|n| n.set(Some(0)));
            s.step();
            allocations += ALLOCATIONS.with(|n| n.replace(None)).unwrap();
            s.combat.events.clear();
        }
    }
    assert!(frozen > 1000);
    assert_eq!(allocations, 0, "allocations during 540000 ON steps");
}

// Attribution-only runner. Scheduler-only removes the active spotlight around each ordinary
// step, suppresses selection during that window, then restores just its scheduling history.
// The production API and normal freeze path remain unchanged.
#[derive(Default, Clone)]
struct AttributionTier {
    reached: u32,
    resolved: u32,
    first: u32,
    wiped: u32,
    fights: u32,
    downed: u32,
}
#[derive(Default)]
struct AttributionRun {
    tiers: [AttributionTier; 3],
    windows: Vec<(u64, u32, u64, usize)>,
    hits: Vec<(u64, u32, f32)>,
    hashes: Vec<u64>,
}
fn attribution_run(seed: u64, config: SpotlightConfig, scheduler_only: bool) -> AttributionRun {
    let mut s = Sim::new(SimConfig {
        seed,
        spotlight: config,
        ..Default::default()
    });
    let mut result = AttributionRun::default();
    let (mut seen, mut decided, mut wiped) = ([false; 3], [false; 3], [false; 3]);
    let (mut fight, mut down) = (None, false);
    let mut ghost: Option<crate::spotlight::Spotlight> = None;
    let mut window: Option<(u64, u32, u64, usize)> = None;
    s.combat.events.clear();
    while s.combat.combat_steps < 900 * SIM_HZ as u64 {
        if scheduler_only && ghost.is_some() {
            s.combat.cfg.spotlight.enabled = false;
        }
        s.step();
        s.combat.cfg.spotlight = config;
        if scheduler_only {
            if let Some(g) = ghost {
                let caster = s
                    .combat
                    .actor_index(g.caster)
                    .filter(|&i| s.combat.actors[i].alive());
                let cancelled = caster.is_none() || s.director.transition != 0;
                let complete = caster
                    .is_some_and(|i| s.combat.actors[i].view.state != ActorState::Cast)
                    && !s.combat.hazards.iter().any(|h| {
                        g.hazards.slice().contains(&h.view.id)
                            && h.view.phase != HazardPhase::Resolved
                    });
                if cancelled || complete {
                    s.combat.spotlight.active = Some(g);
                    s.combat.end_spotlight(cancelled);
                    ghost = None;
                }
            } else if let Some(active) = s.combat.spotlight.active.take() {
                ghost = Some(active);
                // Full-step ablation keeps the normal stage-completion call even on a
                // selection step; the production freeze deliberately defers that call.
                s.finish_stage();
            }
            // Compare the underlying gameplay hash to OFF at every ordinary step. Scheduler
            // history/config are intentionally omitted from this diagnostic comparison.
            let touched = s.combat.spotlight.touched;
            s.combat.spotlight.touched = false;
            result.hashes.push(s.state_hash());
            s.combat.spotlight.touched = touched;
        } else if !config.enabled {
            result.hashes.push(s.state_hash());
        }
        let tier = (s.stage.wave - 1) as usize;
        if tier < 3 {
            seen[tier] = true;
        }
        for e in s.drain_events() {
            if tier < 3 {
                if matches!(e, Event::StageCleared | Event::WaveReset) && !decided[tier] {
                    result.tiers[tier].resolved += 1;
                    result.tiers[tier].first += u32::from(matches!(e, Event::StageCleared));
                    decided[tier] = true;
                }
                wiped[tier] |= matches!(e, Event::WaveReset);
            }
            match e {
                Event::SpotlightBegan { caster, .. } => {
                    window = Some((s.combat.combat_steps, caster, s.combat.step_number, tier))
                }
                Event::SpotlightEnded { .. } => {
                    if let Some((start, caster, step, tier)) = window.take() {
                        result
                            .windows
                            .push((start, caster, s.combat.step_number - step, tier));
                    }
                }
                Event::Hit { target, amount, .. } if target <= 4 => {
                    result.hits.push((s.combat.combat_steps, target, amount))
                }
                Event::BossArrived { .. } => {
                    fight = (tier < 3).then_some(tier);
                    down = s
                        .combat
                        .actors
                        .iter()
                        .any(|a| a.view.team == Team::Hero && !a.alive());
                    if let Some(k) = fight {
                        result.tiers[k].fights += 1;
                        result.tiers[k].downed += u32::from(down);
                    }
                }
                Event::Downed { .. } if !down => {
                    if let Some(k) = fight {
                        result.tiers[k].downed += 1;
                        down = true;
                    }
                }
                Event::StageCleared | Event::WaveReset => fight = None,
                _ => {}
            }
        }
    }
    for k in 0..3 {
        result.tiers[k].reached = u32::from(seen[k]);
        result.tiers[k].wiped = u32::from(wiped[k]);
    }
    result
}
#[test]
#[ignore = "20-seed equal-combat-time spotlight attribution report"]
fn spotlight_attribution_twenty_seeds() {
    let default = SpotlightConfig {
        auto_release: true,
        ..SpotlightConfig::DEFAULT
    };
    let mut utility = default;
    for skill in [
        Skill::BubblePop,
        Skill::Split,
        Skill::Shadow,
        Skill::ArcanePulse,
    ] {
        utility.skills[skill.index()] = false;
    }
    let mut damage = default;
    for skill in [
        Skill::CrimsonWard,
        Skill::Taunt,
        Skill::Elevate,
        Skill::Faze,
    ] {
        damage.skills[skill.index()] = false;
    }
    let cases = [
        ("OFF", SpotlightConfig::OFF, false),
        ("A scheduler only", default, true),
        ("B DEFAULT freeze", default, false),
        ("D utility-only freeze", utility, false),
        ("D damage-only freeze", damage, false),
    ];
    let mut totals: Vec<[AttributionTier; 3]> = vec![Default::default(); cases.len()];
    let (mut windows, mut hit_windows, mut prevented, mut max_damage) =
        (0usize, 0usize, 0f32, 0f32);
    let mut tier_windows = [(0usize, 0usize, 0f32); 3];
    let mut hero_windows = [(0usize, 0usize, 0f32); 4];
    let mut window_rows =
        String::from("seed,tier,combat_start,caster,performing_seconds,off_caster_damage\n");
    for seed in 1..=20 {
        let mut runs = Vec::new();
        for (i, &(_, config, scheduler_only)) in cases.iter().enumerate() {
            let r = attribution_run(seed, config, scheduler_only);
            for k in 0..3 {
                let a = &mut totals[i][k];
                let b = &r.tiers[k];
                a.reached += b.reached;
                a.resolved += b.resolved;
                a.first += b.first;
                a.wiped += b.wiped;
                a.fights += b.fights;
                a.downed += b.downed;
            }
            runs.push(r);
        }
        for (step, (&off, &scheduler)) in runs[0].hashes.iter().zip(&runs[1].hashes).enumerate() {
            assert_eq!(
                off,
                scheduler,
                "scheduler-only changes combat, seed {seed} step {}",
                step + 1
            );
        }
        for &(start, caster, duration, tier) in &runs[2].windows {
            let damage: f32 = runs[0]
                .hits
                .iter()
                .filter(|&&(at, target, _)| {
                    target == caster && at >= start && at < start + duration
                })
                .map(|&(_, _, d)| d)
                .sum();
            windows += 1;
            hit_windows += usize::from(damage > 0.);
            prevented += damage;
            max_damage = max_damage.max(damage);
            if tier < 3 {
                tier_windows[tier].0 += 1;
                tier_windows[tier].1 += usize::from(damage > 0.);
                tier_windows[tier].2 += damage;
            }
            let h = &mut hero_windows[(caster - 1) as usize];
            h.0 += 1;
            h.1 += usize::from(damage > 0.);
            h.2 += damage;
            use std::fmt::Write;
            writeln!(
                window_rows,
                "{seed},{},{:.6},{caster},{:.6},{damage:.6}",
                tier + 1,
                start as f64 / 30.,
                duration as f64 / 30.
            )
            .unwrap();
        }
    }
    println!("\n## Spotlight attribution\n\n20 seeds x900 combat seconds. Scheduler-only follows normal full steps during its selected windows; 540000 underlying gameplay hashes match OFF step-for-step.\n\n| Ablation | Tier | First / resolved | Wiped / reached | Downed / boss fights | Censored |\n|---|---:|---:|---:|---:|---:|");
    for (i, &(name, _, _)) in cases.iter().enumerate() {
        for (k, r) in totals[i].iter().enumerate() {
            println!(
                "| {name} | {} | {}/{} ({:.1}%) | {}/{} ({:.1}%) | {}/{} ({:.1}%) | {} |",
                k + 1,
                r.first,
                r.resolved,
                r.first as f32 * 100. / r.resolved.max(1) as f32,
                r.wiped,
                r.reached,
                r.wiped as f32 * 100. / r.reached.max(1) as f32,
                r.downed,
                r.fights,
                r.downed as f32 * 100. / r.fights.max(1) as f32,
                r.reached - r.resolved
            );
        }
    }
    println!("\nC: OFF time-window estimate over {windows} DEFAULT spotlights (all stages): {hit_windows} windows with caster hits, total {prevented:.2} absorbed+HP damage, mean {:.3}/spotlight, max {max_damage:.2}. Timestamp matching is an estimate: divergent trajectories mean it is not a causal counterfactual. Windows use [combat start, start+Performing duration), frozen duration including full cast wind-down. Ward absorption is included.\n", prevented / windows.max(1) as f32);
    println!("| Tier | Windows | Windows with hits | OFF caster damage | Mean/window |\n|---|---:|---:|---:|---:|");
    for (i, &(n, h, d)) in tier_windows.iter().enumerate() {
        println!(
            "| {} | {n} | {h} | {d:.2} | {:.3} |",
            i + 1,
            d / n.max(1) as f32
        );
    }
    println!("\n| Hero | Windows | Windows with hits | OFF caster damage | Mean/window |\n|---|---:|---:|---:|---:|");
    for (i, &(n, h, d)) in hero_windows.iter().enumerate() {
        println!(
            "| {:?} | {n} | {h} | {d:.2} | {:.3} |",
            HEROES[i],
            d / n.max(1) as f32
        );
    }
    std::fs::write(
        concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../wf_bench/evidence/arcane-off-caster-windows.csv"
        ),
        window_rows,
    )
    .unwrap();
}

#[test]
fn spotlight_full_freeze_audit_all_skills_excludes_only_action_and_documented_effects() {
    for (hero, extra, skill) in [
        (1, false, Skill::Shadow),
        (1, true, Skill::Split),
        (2, false, Skill::BubblePop),
        (3, false, Skill::ArcanePulse),
        (0, false, Skill::GroundPound),
    ] {
        let mut cfg = open_config();
        cfg.auto_release = false;
        let mut s = fixture(cfg);
        let enemy = s.combat.actors[4].view.id;
        s.combat.actors[4].phase_rule = Some(PhaseRule {
            hp_below: 0.35,
            length_scale: 1.,
            width_scale: 1.,
            radius_scale: 1.,
        });
        s.combat.actors[4].view.hp = 10.;
        s.combat.actors[4].view.max_hp = 100000.;
        s.combat.actors[4].view.ward = 10000.; // effect hits ward, while enrage would trigger if timers ran
        s.combat.actors[4].recharge_left = 3.;
        s.combat.actors[4].recharge_duration = 5.;
        s.combat.actors[4].view.energy = 0.4;
        s.combat.actors[4].taunted_by = Some(s.combat.actors[0].view.id);
        s.combat.actors[4].taunt_left = 1.25;
        for a in &mut s.combat.actors {
            a.basic_cd = 0.5;
            a.special_cd = 5.;
            a.extra_cd = 2.;
            a.pulse_cd = 7.;
            a.pound_cd = 8.;
            a.skill_lockout = 1.5;
            a.revive_cd = 3.;
            a.revive_progress = 2.;
            a.revive_grace = 0.2;
            a.mend_cd = 1.;
            a.undamaged = 5.;
            a.summon_cd = 4.;
        }
        s.hazard(
            HazardKind::LizardoDrop,
            999999, // unrelated owner: Bubble Pop may cancel its actual victim’s warnings
            None,
            Vec2::new(700., 700.),
            Vec2::new(1., 0.),
        );
        // A pre-existing hazard from this same caster must also stay frozen.
        s.hazard(
            HazardKind::FazePool,
            s.combat.actors[hero].view.id,
            None,
            s.combat.actors[4].view.pos,
            Vec2::new(1., 0.),
        );
        s.combat.projectile(
            3,
            Some(enemy),
            s.combat.actors[4].view.pos,
            false,
            15.,
            None,
        );
        let hazard_count = s.combat.hazards.len();
        let hazards = format!("{:?}", s.combat.hazards);
        if skill == Skill::ArcanePulse {
            let target = s.combat.actors[4].view.id;
            s.combat.start_arcane_pulse(hero, target);
            s.combat.select_spotlight();
            s.refresh_snapshot();
        } else {
            activate(&mut s, hero, extra);
        }
        s.combat.seed_enmity(4);
        let before = s.combat.actors.clone();
        let projectiles = format!("{:?}", s.combat.projectiles);
        let director = format!("{:?}", s.director);
        let stage = format!("{:?}", s.stage);
        if hero == 1 {
            complete(&mut s); // Hondo closes at recovery end, without entering Tail.
        } else {
            tail(&mut s);
        }
        let mut after = s.combat.actors.clone();
        // Normalize only the caster's animation/action lifecycle, never its cooldowns/timers.
        after[hero].view.state = before[hero].view.state;
        after[hero].view.state_age = before[hero].view.state_age;
        after[hero].view.state_duration = before[hero].view.state_duration;
        after[hero].view.impact_at = before[hero].view.impact_at;
        after[hero].action_done = before[hero].action_done;
        after[hero].view.special_casting = before[hero].view.special_casting;
        match skill {
            Skill::CrimsonWard => after[hero].view.ward = before[hero].view.ward,
            Skill::Taunt => {
                assert_eq!(
                    after[hero].view.ward,
                    before[hero]
                        .view
                        .ward
                        .max(after[hero].view.max_hp * WARCRY_WARD_FRACTION)
                );
                assert_eq!(after[hero].self_ward_steps, 0);
                assert!(after[hero].view.warcry_shield);
                after[hero].view.warcry_shield = before[hero].view.warcry_shield;
                after[hero].view.ward = before[hero].view.ward;
                after[hero].self_ward_steps = before[hero].self_ward_steps;
                after[4].target = before[4].target;
                after[4].taunted_by = before[4].taunted_by;
                after[4].taunt_left = before[4].taunt_left;
            }
            Skill::Shadow
            | Skill::Split
            | Skill::BubblePop
            | Skill::ArcanePulse
            | Skill::GroundPound => {
                // Boss-target fixtures now earn normal threat from damage/Shadow ward.
                assert!(after[4].enmity[hero] > before[4].enmity[hero]);
                after[4].enmity = before[4].enmity;
                after[4].view.hp = before[4].view.hp;
                after[4].view.ward = before[4].view.ward;
                after[4].undamaged = before[4].undamaged;
                if skill == Skill::GroundPound {
                    after[4].view.pos = before[4].view.pos;
                    assert_ne!(after[4].push_rng.0, before[4].push_rng.0);
                    after[4].push_rng.0 = before[4].push_rng.0;
                } else if skill == Skill::BubblePop {
                    assert_eq!(after[4].view.pos, before[4].view.pos);
                    assert_eq!(after[4].push_rng.0, before[4].push_rng.0);
                    assert_eq!(after[4].encase_steps, 0);
                }
                if skill == Skill::GroundPound {
                    assert_eq!(after[hero].view.ward, before[hero].view.ward);
                    assert_eq!(
                        after[hero].view.warcry_shield,
                        before[hero].view.warcry_shield
                    );
                    assert_eq!(after[hero].self_ward_steps, before[hero].self_ward_steps);
                }
                if skill == Skill::Shadow {
                    after[hero].view.pos = before[hero].view.pos;
                    after[hero].view.facing = before[hero].view.facing;
                    assert_eq!(
                        after[hero].view.ward,
                        after[hero].view.max_hp * SHADOW_WARD_FRACTION
                    );
                    assert_eq!(
                        after[hero].self_ward_steps,
                        (SHADOW_WARD_SECONDS * SIM_HZ as f32) as u32
                    );
                    // The strike creates this ward and its full, frozen expiry timer.
                    after[hero].view.ward = before[hero].view.ward;
                    after[hero].self_ward_steps = before[hero].self_ward_steps;
                }
            }
            _ => {}
        }
        assert_eq!(
            format!("{after:?}"),
            format!("{before:?}"),
            "{skill:?}: unrelated actor state advanced"
        );
        assert_eq!(
            format!("{:?}", &s.combat.hazards[..hazard_count]),
            hazards,
            "{skill:?}: old hazards advanced"
        );
        assert_eq!(format!("{:?}", s.combat.projectiles), projectiles);
        assert_eq!(format!("{:?}", s.director), director);
        assert_eq!(format!("{:?}", s.stage), stage);
        s.release_spotlight();
    }
}

#[test]
fn spotlight_attacks_require_living_enemy_target_and_never_include_other_heroes() {
    for target_case in 0..5 {
        let mut s = fixture(open_config());
        let caster = s.combat.actors[0].view.id;
        let enemy = s.combat.actors[4].view.id;
        let target = match target_case {
            0 => None,
            1 => Some(caster),
            2 => Some(s.combat.actors[1].view.id),
            3 => {
                s.combat.actors[4].view.hp = 0.;
                Some(enemy)
            }
            _ => Some(enemy),
        };
        s.combat.skill_started(caster, Skill::GroundPound, target);
        s.combat.select_spotlight();
        s.refresh_snapshot();
        assert_eq!(s.combat.spotlight.active.is_some(), target_case == 4);
        if target_case == 4 {
            let ally = s.combat.actors[1].view.id;
            s.combat.spotlight_affected(caster, ally);
            s.combat.spotlight_affected(caster, caster);
            s.refresh_snapshot();
            assert_eq!(
                s.snapshot.spotlight.as_ref().unwrap().participants,
                vec![caster, enemy]
            );
        }
    }
    let mut s = fixture(open_config());
    let target = s.combat.actors[4].view.id;
    s.combat.start_ground_pound(0, target);
    s.combat.actors[4].view.hp = 0.;
    s.combat.select_spotlight();
    assert!(s.combat.spotlight.active.is_none()); // target died elsewhere in the normal activation step
}
#[test]
fn spotlight_whiff_ends_cleanly_without_damage() {
    let mut s = fixture(open_config());
    s.combat.actors[4].stats.evade = 1.;
    activate(&mut s, 0, false);
    complete(&mut s);
    let events = s.drain_events();
    assert!(!events
        .iter()
        .any(|e| matches!(e, Event::Hit { source: 1, .. })));
    assert!(events.iter().any(|e| matches!(
        e,
        Event::SpotlightEnded {
            cancelled: false,
            ..
        }
    )));
    assert!(s.snapshot.spotlight.is_none());
}

#[test]
fn spotlight_charge_freezes_all_state_for_exact_length_and_auto_release_keeps_it() {
    let mut cfg = open_config();
    cfg.charge = SpotlightConfig::DEFAULT.charge;
    cfg.auto_release = true;
    let mut s = fixture(cfg);
    s.combat.actors[1].view.hp = 0.;
    s.combat.actors[1].state(ActorState::Downed, 0., 0.); // Prepare an existing down before admission.
    s.combat.actors[1].revive_progress = 2.;
    s.combat.actors[1].revive_grace = 0.1;
    let target = s.combat.actors[4].view.id;
    s.hazard(
        HazardKind::LizardoDrop,
        999999, // unrelated warning must not become a boss-special veto
        None,
        Vec2::new(700., 700.),
        Vec2::new(1., 0.),
    );
    s.combat.projectile(
        3,
        Some(target),
        s.combat.actors[4].view.pos,
        false,
        15.,
        None,
    );
    activate(&mut s, 2, false);
    assert_eq!(
        s.snapshot.spotlight.as_ref().unwrap().phase,
        SpotlightPhase::Charge
    );
    let state = |s: &Sim| {
        format!(
            "{:?}{:?}{:?}{:?}{:?}{:?}{:?}",
            s.combat.actors,
            s.combat.hazards,
            s.combat.projectiles,
            s.director,
            s.stage,
            s.chests,
            (
                s.combat.spawn_rng.0,
                s.combat.combat_rng.0,
                s.reward_rng.0,
                s.combat.next_id,
                s.chest_opener
            )
        )
    };
    let before = state(&s);
    let combat = s.combat.combat_steps;
    let step = s.combat.step_number;
    s.combat.events.clear();
    let charge_steps = (cfg.charge * SIM_HZ as f32).ceil() as u64;
    for n in 1..=charge_steps {
        s.step();
        assert_eq!(state(&s), before, "Charge advanced game state at step {n}");
        assert_eq!(s.combat.combat_steps, combat);
        assert_eq!(s.combat.step_number, step + n);
        assert_eq!(s.snapshot.time, s.combat.step_number as f64 / 30.);
        assert_eq!(
            s.snapshot.spotlight.as_ref().unwrap().phase,
            if n == charge_steps {
                SpotlightPhase::Performing
            } else {
                SpotlightPhase::Charge
            }
        );
    }
    assert!(s.drain_events().is_empty());
    s.step();
    assert_eq!(s.combat.actors[2].view.state_age, SIM_DT);
    complete(&mut s);
    ended(&mut s, false);
}
#[test]
fn spotlight_zero_charge_skips_and_charge_rounds_to_fixed_steps() {
    let preset = SpotlightConfig::DEFAULT.charge;
    let preset_steps = (preset * SIM_HZ as f32).ceil() as u64;
    for (charge, steps) in [
        (0., 0),
        (0.1, 3),
        (preset, preset_steps),
        (preset + 0.01, preset_steps + 1),
    ] {
        let mut cfg = open_config();
        cfg.charge = charge;
        let mut s = fixture(cfg);
        activate(&mut s, 0, false);
        let start = s.combat.step_number;
        while s.snapshot.spotlight.as_ref().unwrap().phase == SpotlightPhase::Charge {
            s.step();
            assert!(s.combat.step_number - start <= steps);
        }
        assert_eq!(s.combat.step_number - start, steps);
        assert_eq!(s.combat.actors[0].view.state_age, 0.);
        assert_eq!(s.combat.combat_steps, 0);
    }
}
#[test]
fn spotlight_charge_cancellation_resumes_cleanly() {
    for case in 0..6 {
        let mut cfg = open_config();
        cfg.charge = SpotlightConfig::DEFAULT.charge;
        let mut s = fixture(cfg);
        activate(&mut s, 0, false);
        s.step();
        assert_eq!(
            s.snapshot.spotlight.as_ref().unwrap().phase,
            SpotlightPhase::Charge
        );
        match case {
            0 => {
                s.combat.actors.remove(0);
                s.step();
            }
            1 => {
                s.combat.actors[0].view.hp = 0.;
                s.step();
            }
            2 => s.set_spotlight(SpotlightConfig::OFF),
            3 => {
                s.reset_stage(false);
                s.refresh_snapshot();
            }
            4 => {
                s.reset_stage(true);
                s.refresh_snapshot();
            }
            _ => {
                s.director.transition = 3;
                s.step();
            }
        }
        ended(&mut s, true);
        let combat = s.combat.combat_steps;
        s.step();
        assert_eq!(s.combat.combat_steps, combat + 1);
    }
}

#[test]
fn spotlight_skips_boss_specials_until_full_resolution_without_queueing_or_cutting_active_windows()
{
    let warnings = [
        (HazardKind::BossCharge, HazardPhase::Locked),
        (HazardKind::BossCharge, HazardPhase::Active),
        (HazardKind::BossStompStep, HazardPhase::Locked),
        (HazardKind::BossSnipe, HazardPhase::Tracking),
        (HazardKind::BossSnipe, HazardPhase::Locked),
        (HazardKind::BossSnipe, HazardPhase::Active),
        (HazardKind::BossCone, HazardPhase::Locked),
        (HazardKind::BossNova, HazardPhase::Locked),
        (HazardKind::LizardoDrop, HazardPhase::Locked),
    ];
    for mode in 0..warnings.len() + 2 {
        let mut s = fixture(open_config());
        // The blocking boss need not be the featured attack's target.
        let boss = s.spawn_actor(Archetype::BossBomber, Vec2::new(480., 800.));
        let b = s.combat.actor_index(boss).unwrap();
        s.combat.actors[b].state(ActorState::Idle, 0., 0.);
        if mode == 0 {
            s.combat.actors[b].state(ActorState::Cast, 1., 1.);
        } else if mode == 1 {
            s.combat.actors[b].regen_ticks_left = 1;
        } else {
            let (kind, phase) = warnings[mode - 2];
            s.hazard(
                kind,
                boss,
                Some(s.combat.actors[0].view.id),
                s.combat.actors[b].view.pos,
                Vec2::new(0., 1.),
            );
            s.combat.hazards.last_mut().unwrap().view.phase = phase;
        }
        activate(&mut s, 1, false);
        assert!(s.combat.spotlight.active.is_none(), "mode {mode}");
        assert!(!s
            .drain_events()
            .iter()
            .any(|e| matches!(e, Event::SpotlightBegan { .. })));
        s.combat.actors[b].state(ActorState::Idle, 0., 0.);
        s.combat.actors[b].regen_ticks_left = 0;
        for h in &mut s.combat.hazards {
            h.view.phase = HazardPhase::Resolved;
        }
        s.combat.select_spotlight();
        assert!(
            s.combat.spotlight.active.is_none(),
            "skipped candidate must never queue"
        );
        activate(&mut s, 1, false);
        assert!(
            s.combat.spotlight.active.is_some(),
            "resolved move must release gate"
        );
    }
    for dead in [false, true] {
        let mut s = fixture(open_config());
        let boss = s.spawn_actor(Archetype::Boss, Vec2::new(480., 800.));
        let b = s.combat.actor_index(boss).unwrap();
        s.combat.actors[b].state(
            if dead {
                ActorState::Cast
            } else {
                ActorState::Basic
            },
            1.,
            1.,
        );
        if dead {
            s.combat.actors[b].view.hp = 0.;
        }
        activate(&mut s, 1, false);
        assert!(
            s.combat.spotlight.active.is_some(),
            "basics and dead bosses do not block"
        );
        s.combat.actors[b].view.hp = s.combat.actors[b].view.max_hp;
        s.combat.actors[b].state(ActorState::Cast, 1., 1.);
        s.step();
        assert!(
            s.combat.spotlight.active.is_some(),
            "a running spotlight is never cut short"
        );
    }
}
