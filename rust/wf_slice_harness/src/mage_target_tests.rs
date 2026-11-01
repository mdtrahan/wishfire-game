use crate::{tuning::*, *};

fn fixture(hero: usize) -> Sim {
    let mut s = Sim::composition_trial(SimConfig::default(), &[Archetype::Orc]);
    s.combat.hazards.clear();
    for a in &mut s.combat.actors {
        a.view.pos = Vec2::new(480., 1100.);
        a.formed_age = 100.;
        a.basic_cd = 100.;
        a.stats.evade = 0.;
    }
    s.combat.actors[4].view.pos = Vec2::new(370., 1100.);
    s.combat.actors[4].view.hp = 10000.;
    s.combat.actors[hero].view.meter = 1.;
    s.combat.actors[hero].power_choice = Some(false);
    s.combat.actors[hero].target = Some(s.combat.actors[4].view.id);
    s.combat.actors[hero].view.ai_intent = AiIntent::Attack;
    s.combat.events.clear();
    s
}
fn enemy(s: &mut Sim, pos: Vec2) -> usize {
    s.spawn_actor(Archetype::Orc, pos);
    let i = s.combat.actors.len() - 1;
    s.combat.actors[i].formed_age = 100.;
    s.combat.actors[i].view.hp = 10000.;
    s.combat.actors[i].stats.evade = 0.;
    i
}
fn resolve(s: &mut Sim, hero: usize) {
    s.combat.actors[hero].view.state_age = CAST_IMPACT;
    s.combat.action(hero);
    for _ in 0..40 {
        s.combat.update_hazards();
        s.resolve_hazards();
    }
}

#[test]
fn mage_single_target_casts_at_ready_hold_bound() {
    for hero in [2, 3] {
        let mut s = fixture(hero);
        for _ in 0..MAGE_AOE_HOLD_STEPS - 1 {
            s.combat.groove_timers();
            assert!(!s.combat.groove_action(hero));
        }
        s.combat.groove_timers();
        assert!(s.combat.groove_action(hero));
        assert_eq!(s.combat.actors[hero].aoe_ready_steps, 0);
        resolve(&mut s, hero);
        assert!(s.combat.actors[4].view.hp < 10000.);
    }
}

#[test]
fn mage_cluster_casts_immediately_and_hits_both_once() {
    for hero in [2, 3] {
        let mut s = fixture(hero);
        let pos = s.combat.actors[4].view.pos + Vec2::new(0., 50.);
        let neighbour = enemy(&mut s, pos);
        assert!(s.combat.groove_action(hero));
        resolve(&mut s, hero);
        let events = s.drain_events();
        for t in [4, neighbour] {
            let id = s.combat.actors[t].view.id;
            assert_eq!(
                events
                    .iter()
                    .filter(|e| matches!(e, Event::Hit { target, .. } if *target == id))
                    .count(),
                1
            );
        }
    }
}

#[test]
fn mage_prefers_cluster_over_nearer_lone_enemy_and_locks_cast() {
    for hero in [2, 3] {
        let mut s = fixture(hero);
        let pair = enemy(&mut s, Vec2::new(700., 1100.));
        let neighbour = enemy(&mut s, Vec2::new(730., 1100.));
        assert!(s.combat.groove_action(hero));
        let target = s.combat.actors[pair].view.id;
        assert_eq!(s.combat.actors[hero].target, Some(target));
        assert!(!s.combat.groove_action(hero)); // The chosen cast cannot thrash.
        assert_eq!(s.combat.actors[hero].target, Some(target));
        resolve(&mut s, hero);
        assert_eq!(s.combat.actors[4].view.hp, 10000.);
        assert!(s.combat.actors[pair].view.hp < 10000.);
        assert!(s.combat.actors[neighbour].view.hp < 10000.);
    }
}

#[test]
fn mage_ties_retain_current_target_and_invalid_targets_cannot_cast() {
    for hero in [2, 3] {
        let mut s = fixture(hero);
        let near = enemy(&mut s, Vec2::new(350., 1100.));
        s.combat.actors[hero].target = Some(s.combat.actors[near].view.id);
        assert!(s.combat.groove_action(hero));
        assert_eq!(
            s.combat.actors[hero].target,
            Some(s.combat.actors[near].view.id)
        );
        for invalid in 0..4 {
            let mut s = fixture(hero);
            s.combat.actors[hero].aoe_ready_steps = MAGE_AOE_HOLD_STEPS;
            match invalid {
                0 => s.combat.actors[4].view.hp = 0.,
                1 => s.combat.actors[4].view.state = ActorState::Spawn,
                2 => s.combat.actors[4].formed_age = 0.,
                _ => s.combat.actors[4].view.pos.x = 900.,
            }
            assert!(!s.combat.groove_action(hero));
        }
    }
}

#[test]
fn mage_hold_survives_target_changes_and_resets_with_scene() {
    for hero in [2, 3] {
        let mut s = fixture(hero);
        s.combat.groove_timers();
        s.combat.actors[hero].target = None;
        s.combat.groove_timers();
        assert_eq!(s.combat.actors[hero].aoe_ready_steps, 2);
        s.combat.actors[hero].aoe_ready_steps = 12;
        let hash = s.state_hash();
        s.combat.actors[hero].aoe_ready_steps += 1;
        assert_ne!(hash, s.state_hash());
        s.reset_stage(false);
        assert_eq!(s.combat.actors[hero].aoe_ready_steps, 0);
    }
}

#[test]
fn mage_hold_pauses_in_every_offensively_blocked_state() {
    for hero in [2, 3] {
        for blocked in [
            "absent",
            "dead",
            "spawning",
            "unread",
            "range",
            "dodge",
            "revive",
            "basic",
            "cast",
            "revive_cast",
            "hurt",
            "encased",
            "hero_spawn",
            "downed",
            "unsafe_cast",
            "no_meter",
            "elevate",
        ] {
            if blocked == "elevate" && hero != 3 {
                continue;
            }
            let mut s = fixture(hero);
            s.combat.actors[hero].aoe_ready_steps = 12;
            match blocked {
                "absent" => {
                    s.combat.actors.pop();
                }
                "dead" => s.combat.actors[4].view.hp = 0.,
                "spawning" => s.combat.actors[4].view.state = ActorState::Spawn,
                "unread" => s.combat.actors[4].formed_age = 0.,
                "range" => s.combat.actors[4].view.pos.x = 900.,
                "dodge" => s.combat.actors[hero].view.ai_intent = AiIntent::Dodge,
                "revive" => s.combat.actors[hero].view.ai_intent = AiIntent::Revive,
                "basic" => s.combat.actors[hero].state(ActorState::Basic, 10., 1.),
                "cast" => s.combat.actors[hero].state(ActorState::Cast, 10., 1.),
                "revive_cast" => {
                    s.combat.actors[hero].state(ActorState::Cast, 0., 0.);
                    s.combat.actors[hero].action_revive = true;
                    s.combat.actors[hero].action_done = false;
                }
                "hurt" => s.combat.actors[hero].state(ActorState::Hurt, 10., 0.),
                "encased" => s.combat.actors[hero].view.encased = 10.,
                "hero_spawn" => s.combat.actors[hero].begin_spawn(),
                "downed" => s.combat.actors[hero].view.hp = 0.,
                "unsafe_cast" => {
                    s.combat.actors[4].view.pos = s.combat.actors[hero].view.pos;
                    s.combat.actors[4].state(ActorState::Basic, BASIC_DURATION, BASIC_IMPACT);
                    s.combat.actors[4].action_done = false;
                    assert!(!s.combat.attack_has_time(hero, true));
                }
                "no_meter" => s.combat.actors[hero].view.meter = 0.,
                "elevate" => s.combat.actors[hero].power_choice = Some(true),
                _ => unreachable!(),
            }
            for _ in 0..MAGE_AOE_HOLD_STEPS {
                s.combat.groove_timers();
                assert_eq!(
                    s.combat.actors[hero].aoe_ready_steps, 12,
                    "hero {hero}: {blocked}"
                );
            }
            // Restore eligibility without discarding the earned portion of the hold.
            let hold = s.combat.actors[hero].aoe_ready_steps;
            s = fixture(hero);
            s.combat.actors[hero].aoe_ready_steps = hold;
            for _ in hold..MAGE_AOE_HOLD_STEPS - 1 {
                s.combat.groove_timers();
                assert!(!s.combat.groove_action(hero), "hero {hero}: {blocked}");
            }
            s.combat.groove_timers();
            assert!(s.combat.groove_action(hero), "hero {hero}: {blocked}");
        }
    }
}

fn projectile_hits(hero: usize, miss: bool, lost_target: bool) -> Vec<(u32, f32)> {
    let mut s = fixture(hero);
    s.combat.actors[4].view.pos = Vec2::new(650., 1100.);
    let radius = SPLASH_RADIUS + BODY_RADIUS;
    enemy(&mut s, Vec2::new(650., 1100. + radius - 0.01));
    enemy(&mut s, Vec2::new(650., 1100. - radius));
    let outside = enemy(&mut s, Vec2::new(650., 1100. + radius + 0.01));
    let blocker = enemy(&mut s, Vec2::new(550., 1100.));
    if miss {
        s.combat.actors[4].stats.evade = 1.;
    }
    let target = s.combat.actors[4].view.id;
    s.combat.projectile(
        hero,
        Some(target),
        s.combat.actors[4].view.pos,
        false,
        20.,
        None,
    );
    if lost_target {
        s.combat.actors[4].view.hp = 0.;
    }
    for _ in 0..30 {
        s.combat.move_projectiles();
    }
    assert!(s.combat.projectiles.is_empty());
    let hits: Vec<_> = s
        .drain_events()
        .iter()
        .filter_map(|e| match e {
            Event::Hit { target, amount, .. } => Some((*target, *amount)),
            _ => None,
        })
        .collect();
    assert!(!hits
        .iter()
        .any(|(id, _)| *id == s.combat.actors[outside].view.id));
    if !lost_target {
        assert!(!hits
            .iter()
            .any(|(id, _)| *id == s.combat.actors[blocker].view.id));
        assert_eq!(hits.len(), if miss { 0 } else { 3 });
        for t in [4, 5, 6] {
            assert_eq!(
                hits.iter()
                    .filter(|(id, _)| *id == s.combat.actors[t].view.id)
                    .count(),
                usize::from(!miss)
            );
        }
    } else {
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].0, s.combat.actors[blocker].view.id);
    }
    hits
}

#[test]
fn mage_projectile_splash_shares_radius_selection_and_single_hit_damage_path() {
    assert_eq!(
        projectile_hits(2, false, false),
        projectile_hits(3, false, false)
    );
}
#[test]
fn mage_projectile_evade_does_not_trigger_splash() {
    assert_eq!(
        projectile_hits(2, true, false),
        projectile_hits(3, true, false)
    );
}
#[test]
fn mage_projectile_target_loss_shares_swept_first_contact_fallback() {
    assert_eq!(
        projectile_hits(2, false, true),
        projectile_hits(3, false, true)
    );
}

#[test]
fn mage_ranks_three_victims_above_two() {
    for hero in [2, 3] {
        let mut s = fixture(hero);
        enemy(&mut s, Vec2::new(350., 1100.));
        let group = enemy(&mut s, Vec2::new(700., 1100.));
        enemy(&mut s, Vec2::new(730., 1100.));
        enemy(&mut s, Vec2::new(740., 1100.));
        assert!(s.combat.groove_action(hero));
        assert_eq!(
            s.combat.actors[hero].target,
            Some(s.combat.actors[group].view.id)
        );
    }
}

#[test]
fn mage_coverage_uses_floor_clamp_and_locked_recipient_exception() {
    for hero in [2, 3] {
        let mut s = fixture(hero);
        let corner = ARENA_MIN + Vec2::new(BODY_RADIUS, BODY_RADIUS);
        s.combat.actors[hero].view.pos = corner + Vec2::new(220., 0.);
        s.combat.actors[4].view.pos = corner;
        let neighbour = enemy(&mut s, corner);
        // Both bodies are outside the clamped drawing; only the locked recipient hits.
        assert!(!s.combat.groove_action(hero));
        s.combat.actors[hero].aoe_ready_steps = MAGE_AOE_HOLD_STEPS;
        assert!(s.combat.groove_action(hero));
        resolve(&mut s, hero);
        assert!(s.combat.actors[4].view.hp < 10000.);
        assert_eq!(s.combat.actors[neighbour].view.hp, 10000.);
    }
}

#[test]
fn mage_single_target_full_steps_keep_basics_running_and_eventually_cast() {
    for hero in [2, 3] {
        let mut s = fixture(hero);
        s.combat.actors[hero].basic_cd = 0.;
        s.combat.actors[hero].ai_cd = 100.;
        s.combat.actors[4].stats.speed = 0.;
        let skill = if hero == 2 {
            Skill::BubblePop
        } else {
            Skill::ArcanePulse
        };
        let id = s.combat.actors[hero].view.id;
        let mut basic = false;
        let mut cast = false;
        for _ in 0..MAGE_AOE_HOLD_STEPS * 4 {
            s.step();
            for event in s.drain_events() {
                basic |= matches!(event, Event::ActionStarted { id: actor, state: ActorState::Basic, .. } if actor == id);
                cast |=
                    matches!(event, Event::SkillStarted { skill: started, .. } if started == skill);
            }
        }
        assert!(basic, "hero {hero} should keep attacking during the hold");
        assert!(
            cast,
            "hero {hero} should cast after the eligible hold and basic recovery"
        );
    }
}
