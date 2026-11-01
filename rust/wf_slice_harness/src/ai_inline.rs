use crate::{api::*, tuning::*, Sim};
#[cfg(test)]
mod tests {
    use super::*;
    fn marid_aura_fixture() -> Sim {
        let mut s = Sim::composition_trial(SimConfig::default(), &[Archetype::Marid]);
        for (i, a) in s.combat.actors.iter_mut().enumerate() {
            a.view.pos = match i {
                1 => Vec2::new(380., 200.),
                4 => Vec2::new(520., 200.),
                _ => Vec2::new(300. + i as f32 * 100., 500.),
            };
            a.destination = a.view.pos;
            a.state(ActorState::Idle, 0., 0.);
            a.formed_age = 10.;
            a.action_done = true;
            a.stats.evade = 0.;
            a.ai_cd = if i == 1 || i == 4 { 0. } else { 1000. };
            a.basic_cd = if i == 1 { 0. } else { 1000. };
            a.special_cd = 1000.;
            a.extra_cd = 1000.;
            a.pulse_cd = 1000.;
            a.pound_cd = 1000.;
            a.mend_cd = 1000.;
        }
        s.combat.update_hazards();
        s.combat.events.clear();
        s
    }
    #[test]
    fn hondo_reaches_melee_and_hits_lone_marid_through_aura_within_twenty_seconds() {
        let mut s = marid_aura_fixture();
        let hondo = s.combat.actors[1].view.id;
        let marid = s.combat.actors[4].view.id;
        let mut hits = 0;
        let mut took_aura_damage = false;
        let mut reached_melee = false;
        for _ in 0..600 {
            s.step();
            if let Some(t) = s.combat.actor_index(marid) {
                reached_melee |= s.combat.actors[1]
                    .view
                    .pos
                    .distance(s.combat.actors[t].view.pos)
                    <= s.combat.actors[1].attack_range(&s.combat.actors[t]);
            }
            for event in s.drain_events() {
                if let Event::Hit {
                    source,
                    target,
                    element,
                    ..
                } = event
                {
                    if source == hondo && target == marid {
                        hits += 1;
                    }
                    took_aura_damage |=
                        source == marid && target == hondo && element == Element::Nature;
                }
            }
        }
        assert!(
            reached_melee,
            "Hondo never reached melee range: {:?}, {:?}, hits={hits}",
            s.combat.actors[1].view,
            s.combat
                .actors
                .iter()
                .find(|a| a.view.id == marid)
                .map(|a| &a.view)
        );
        assert!(hits >= 2, "Hondo landed only {hits} hits in twenty seconds");
        assert!(
            took_aura_damage,
            "Aura damage must remain active during engagement"
        );
    }
    #[test]
    fn marid_aura_allows_destinations_but_locked_and_active_attacks_still_veto_them() {
        let mut s = marid_aura_fixture();
        let spot = s.combat.actors[4].view.pos + Vec2::new(-65., 0.);
        assert!(s.combat.fight_spot_safe(1, spot));
        assert!(!s.combat.path_enters_threat(1, spot, None));
        assert!(s.combat.shadow_approach(1, 4).is_some());
        assert!(s
            .combat
            .combo_landing(1, 4, s.combat.actors[1].view.pos)
            .is_some());
        let owner = s.combat.actors[4].view.id;
        s.combat.actors[1].view.pos = spot - Vec2::new(300., 0.);
        for (kind, phase) in [
            (HazardKind::BossSlam, HazardPhase::Locked),
            (HazardKind::BossCharge, HazardPhase::Locked),
            (HazardKind::SniperLine, HazardPhase::Locked),
            (HazardKind::LizardoDrop, HazardPhase::Locked),
            (HazardKind::LizardoDrop, HazardPhase::Active),
        ] {
            s.hazard(kind, owner, None, spot, Vec2::new(1., 0.));
            let h = s.combat.hazards.last_mut().unwrap();
            h.view.phase = phase;
            h.known = [true; 4];
            assert!(!s.combat.fight_spot_safe(1, spot), "{kind:?}");
            assert!(s.combat.path_enters_threat(1, spot, None), "{kind:?}");
            s.combat.hazards.pop();
        }
    }
    #[test]
    fn mages_keep_standoff_from_lone_marid_with_aura() {
        let mut s = marid_aura_fixture();
        for i in [2, 3] {
            s.combat.actors[i].view.pos = s.combat.actors[4].view.pos + Vec2::new(0., 230.);
            s.choose_hero_intent(i);
            let a = &s.combat.actors[i];
            assert!(
                a.destination.distance(s.combat.actors[4].view.pos) > AURA_RADIUS + a.view.radius
            );
            assert!(!s.combat.path_enters_threat(i, a.destination, None));
        }
    }
    #[test]
    fn fighting_buffer_rises_with_fragility_and_missing_health() {
        let mut s = Sim::new(SimConfig::default());
        let origin = Vec2::new(480., 1000.);
        let owner = s.spawn_actor(Archetype::Lizardo, origin);
        s.hazard(
            HazardKind::LizardoDrop,
            owner,
            None,
            origin,
            Vec2::new(1., 0.),
        );
        s.combat.hazards.last_mut().unwrap().known = [true; 4];
        for i in 0..4 {
            s.combat.actors[i].view.pos = Vec2::new(480., 1081.);
        }
        assert!(s.combat.fight_spot_safe(0, s.combat.actors[0].view.pos));
        assert!(!s.combat.fight_spot_safe(1, s.combat.actors[1].view.pos));
        assert!(s.combat.attack_has_time(0, false));
        assert!(!s.combat.attack_has_time(1, false));
        assert!(!s.combat.fight_spot_safe(2, s.combat.actors[2].view.pos));
        assert_eq!(s.combat.standoff(2), s.combat.standoff(3));
        s.combat.actors[0].view.hp *= 0.2;
        assert!(!s.combat.fight_spot_safe(0, s.combat.actors[0].view.pos));
    }
}

#[cfg(test)]
mod bound_regressions {
    use super::*;
    fn fixture() -> Sim {
        let mut s = Sim::new(SimConfig::default());
        s.combat.hazards.clear();
        for a in s.combat.actors.iter_mut().take(4) {
            a.view.pos = Vec2::new(300., 1000.);
            a.basic_cd = 100.;
            a.special_cd = 100.;
            a.view.state = ActorState::Idle;
        }
        s
    }
    fn warning(s: &mut Sim, p: Vec2) -> usize {
        let id = s.spawn_actor(Archetype::Lizardo, Vec2::new(480., 700.));
        s.hazard(HazardKind::LizardoDrop, id, None, p, Vec2::new(1., 0.));
        let n = s.combat.hazards.len() - 1;
        s.combat.hazards[n].known = [true; 4];
        n
    }
    #[test]
    fn fizzmite_self_blast_keeps_its_existing_escape_margin() {
        let mut s = fixture();
        let origin = Vec2::new(480., 1000.);
        let n = warning(&mut s, origin);
        s.combat.hazards[n].view.kind = HazardKind::FizzmiteBlast;
        s.combat.hazards[n].view.shape = Shape::Circle {
            radius: FIZZMITE_RADIUS,
        };
        s.combat.actors[0].view.pos = origin + Vec2::new(30., 0.);
        s.combat.actors[0].heading = Vec2::new(1., 0.);
        let goal = s.combat.dodge_destination(0, &s.combat.hazards[n]);
        assert!(!s.combat.hazards[n].hits(goal, 0.));
        assert!(goal.distance(origin) < FIZZMITE_RADIUS + 15., "{goal:?}");
    }
    #[test]
    fn bomb_escape_keeps_fifteen_units_beyond_the_hero_body() {
        // Ordinary, aimed and enraged snapshot radii share the same avoidance.
        for radius in [
            BOMB_RADIUS,
            CHIMERA_TARGETED_BOMB_RADIUS,
            CHIMERA_TARGETED_BOMB_RADIUS * 1.5,
        ] {
            for hero in 0..4 {
                let mut s = fixture();
                let origin = Vec2::new(480., 1000.);
                let n = warning(&mut s, origin);
                s.combat.hazards[n].view.shape = Shape::Circle { radius };
                for (i, a) in s.combat.actors.iter_mut().take(4).enumerate() {
                    a.view.hp = if i == hero { a.view.max_hp } else { 0. };
                    a.view.pos = origin + Vec2::new(30., 0.);
                    a.heading = Vec2::new(1., 0.);
                }
                for _ in 0..90 {
                    s.hero_ai();
                    let a = &s.combat.actors[hero];
                    if a.view.ai_intent == AiIntent::Dodge
                        && a.view.pos.distance(a.destination) < 3.
                    {
                        break;
                    }
                }
                let a = &s.combat.actors[hero];
                assert!(
                    a.view.pos.distance(origin) - a.view.radius >= radius + 15.,
                    "hero {hero}, radius {radius}, position {:?}, goal {:?}",
                    a.view.pos,
                    a.destination
                );
            }
        }
    }
    #[test]
    fn bomb_escape_uses_a_wall_pocket_when_the_buffer_cannot_fit() {
        let mut s = fixture();
        let origin = ARENA_MIN + Vec2::new(74., 60.);
        let n = warning(&mut s, origin);
        // Two other warnings and the floor walls leave only a 20x20 safe pocket.
        for (offset, dir) in [
            (Vec2::new(534., 0.), Vec2::new(0., 1.)),
            (Vec2::new(0., 534.), Vec2::new(1., 0.)),
        ] {
            let m = warning(&mut s, ARENA_MIN + offset);
            s.combat.hazards[m].view.kind = HazardKind::BossCharge;
            s.combat.hazards[m].view.shape = Shape::Line {
                length: 2400.,
                width: 1000.,
            };
            s.combat.hazards[m].view.dir = dir;
        }
        for (i, a) in s.combat.actors.iter_mut().take(4).enumerate() {
            a.view.hp = if i == 0 { a.view.max_hp } else { 0. };
        }
        s.combat.actors[0].view.pos = ARENA_MIN + Vec2::new(32., 32.);
        s.combat.actors[0].heading = Vec2::new(-1., -1.).normalized();
        assert!(s.combat.hazards[n].hits(s.combat.actors[0].view.pos, 0.));
        for _ in 0..60 {
            s.hero_ai();
        }
        let a = &s.combat.actors[0];
        assert!(
            !s.combat.hazards.iter().any(|h| h.hits(a.view.pos, 0.)),
            "{:?}",
            a.view.pos
        );
        assert!(a.view.pos.distance(origin) - a.view.radius < BOMB_RADIUS + 15.);
        assert_eq!(
            a.view.pos,
            crate::math::floor_point(a.view.pos, a.view.radius)
        );
    }
    #[test]
    fn dodge_outranks_cohesion_with_downed_anchor() {
        let mut s = fixture();
        let n = warning(&mut s, Vec2::new(690., 1000.));
        s.combat.actors[0].view.pos = Vec2::new(710., 1000.);
        s.combat.actors[0].view.ai_intent = AiIntent::Dodge;
        s.combat.actors[0].destination = Vec2::new(800., 1000.);
        s.combat.actors[1].view.state = ActorState::Downed;
        s.combat.actors[1].view.hp = 0.;
        assert!(s.combat.needs_dodge(0, &s.combat.hazards[n]));
        s.combat.constrain_party();
        assert_eq!(
            s.combat.actors[0].view.pos,
            Vec2::new(710., 1000.),
            "cohesion undid escape movement"
        );
    }
    #[test]
    fn cohesion_never_reenters_known_warning() {
        let mut s = fixture();
        let n = warning(&mut s, Vec2::new(600., 1000.));
        s.combat.actors[0].view.pos = Vec2::new(720., 1000.);
        assert!(!s.combat.hazards[n].hits(s.combat.actors[0].view.pos, 0.));
        s.combat.constrain_party();
        assert!(
            !s.combat.hazards[n].hits(s.combat.actors[0].view.pos, 0.),
            "cohesion pulled safe hero back into warning"
        );
    }
    #[test]
    fn body_separation_never_pushes_hero_into_warning() {
        let mut s = fixture();
        let n = warning(&mut s, Vec2::new(620., 1000.));
        s.combat.actors[0].view.pos = Vec2::new(500., 1000.);
        let id = s.spawn_actor(Archetype::Boss, Vec2::new(480., 1000.));
        let b = s.combat.actor_index(id).unwrap();
        assert!(!s.combat.hazards[n].hits(s.combat.actors[0].view.pos, 0.));
        s.combat.constrain_party();
        assert!(
            !s.combat.hazards[n].hits(s.combat.actors[0].view.pos, 0.),
            "body separation pushed hero into warning"
        );
        assert!(
            s.combat.actors[0]
                .view
                .pos
                .distance(s.combat.actors[b].view.pos)
                >= s.combat.actors[0].view.radius + s.combat.actors[b].view.radius - 0.01
        );
    }
    #[test]
    fn overlapping_warnings_allow_a_shared_exit() {
        let mut s = fixture();
        warning(&mut s, Vec2::new(480., 1000.));
        warning(&mut s, Vec2::new(480., 1000.));
        s.combat.actors[0].view.pos = Vec2::new(510., 1000.);
        s.combat.actors[0].heading = Vec2::new(1., 0.);
        for _ in 0..24 {
            s.hero_ai();
        }
        assert!(
            !s.combat.hazards[0].hits(s.combat.actors[0].view.pos, 0.),
            "overlap deflection trapped hero: {:?}",
            s.combat.actors[0].view.pos
        );
    }
    #[test]
    fn escape_goal_clears_all_overlapping_warnings() {
        let mut s = fixture();
        let n = warning(&mut s, Vec2::new(480., 1000.));
        let m = warning(&mut s, Vec2::new(480., 1000.));
        s.combat.hazards[m].view.shape = Shape::Circle { radius: 150. };
        s.combat.actors[0].view.pos = Vec2::new(510., 1000.);
        let goal = s.combat.dodge_destination(0, &s.combat.hazards[n]);
        assert!(!s.combat.hazards[n].hits(goal, 0.));
        assert!(
            !s.combat.hazards[m].hits(goal, 0.),
            "escape endpoint remains inside second warning: {goal:?}"
        );
    }
    #[test]
    fn ordinary_movement_cannot_reenter_a_warning() {
        for intent in [
            AiIntent::MoveToRange,
            AiIntent::SeekZone,
            AiIntent::Revive,
            AiIntent::Regroup,
        ] {
            let mut s = fixture();
            let n = warning(&mut s, Vec2::new(480., 1000.));
            let a = &mut s.combat.actors[0];
            a.view.pos = Vec2::new(580., 1000.);
            a.view.ai_intent = intent;
            a.destination = Vec2::new(360., 1000.);
            a.heading = Vec2::new(-1., 0.);
            a.velocity = Vec2::new(-a.speed(), 0.);
            // Hold the existing route through normal AI ticks; steering still must
            // prevent entry into already-known coverage on every fixed step.
            for _ in 0..12 {
                s.combat.actors[0].ai_cd = 100.;
                s.hero_ai();
                assert!(
                    !s.combat.hazards[n].hits(s.combat.actors[0].view.pos, 0.),
                    "safe hero reentered known warning: {:?}",
                    s.combat.actors[0].view.pos
                );
            }
        }
    }
}

#[cfg(test)]
mod recovery_regressions {
    use super::*;

    // Seed 4, step 41086: original positions/HP from the accepted stall trace.
    fn seed_four_recovery_fixture(standing: &[usize]) -> Sim {
        let mut s = Sim::composition_trial(
            SimConfig {
                seed: 4,
                ..Default::default()
            },
            &[Archetype::Lizardo],
        );
        s.combat.hazards.clear();
        let positions = [
            Vec2::new(462.473, 923.325),
            Vec2::new(503.839, 1074.197),
            Vec2::new(421.395, 942.094),
            Vec2::new(525.863, 734.544),
        ];
        for (i, a) in s.combat.actors.iter_mut().enumerate() {
            a.state(ActorState::Idle, 0., 0.);
            a.formed_age = 100.;
            a.ai_cd = 0.;
            a.basic_cd = 0.;
            a.action_done = true;
            if i < 4 {
                a.view.pos = positions[i];
                if !standing.contains(&i) {
                    a.view.hp = 0.;
                    a.state(ActorState::Downed, 0., 0.);
                }
            } else {
                a.view.pos = Vec2::new(291.310, 582.791);
                a.view.hp = 411.6;
                a.view.max_hp = 411.6;
            }
            a.destination = a.view.pos;
        }
        s.combat.events.clear();
        s
    }
    fn assert_recovery_engages(mut s: Sim, hero: usize, seconds: usize) {
        let id = s.combat.actors[hero].view.id;
        let enemy = s.combat.actors[4].view.id;
        let mut reached = false;
        let mut hits = 0;
        for _ in 0..seconds * SIM_HZ as usize {
            s.step();
            if let Some(e) = s.combat.actor_index(enemy) {
                reached |= s.combat.actors[hero]
                    .view
                    .pos
                    .distance(s.combat.actors[e].view.pos)
                    <= s.combat.actors[hero].attack_range(&s.combat.actors[e]);
            }
            hits += s.drain_events().iter().filter(|e|
                matches!(e, Event::Hit { source, target, .. } if *source == id && *target == enemy)).count();
            if reached && hits > 0 {
                return;
            }
        }
        panic!("hero {hero} failed to engage in {seconds}s: range={reached}, hits={hits}");
    }
    #[test]
    fn seed_four_recovery_survivor_reaches_range_and_hits_within_thirty_seconds() {
        let s = seed_four_recovery_fixture(&[0]);
        assert!(s.combat.revive_target(0).is_none());
        assert!(!s.combat.recovery_holds_approach());
        assert_recovery_engages(s, 0, 30);
    }
    #[test]
    fn two_standing_without_safe_revive_both_engage() {
        for hero in [0, 1] {
            let mut s = seed_four_recovery_fixture(&[0, 1]);
            // Both healthy heroes lie in the next Sniper lane, so neither can channel safely.
            s.combat.actors[0].view.pos = Vec2::new(480., 400.);
            s.combat.actors[1].view.pos = Vec2::new(520., 400.);
            s.combat.actors[4] = crate::actors::Actor::new(
                s.combat.actors[4].view.id,
                Archetype::Sniper,
                Vec2::new(480., 900.),
                crate::tuning::stats(Archetype::Sniper),
                4,
            );
            s.combat.actors[4].state(ActorState::Idle, 0., 0.);
            s.combat.actors[4].formed_age = 100.;
            assert!(s.combat.revive_target(0).is_none() && s.combat.revive_target(1).is_none());
            assert!(!s.combat.recovery_holds_approach());
            s.hero_ai();
            for i in 0..2 {
                assert_eq!(s.combat.actors[i].view.ai_intent, AiIntent::MoveToRange);
                // Keep revival unavailable as the Sniper's aim changes during this attack proof.
                s.combat.actors[i].revive_cd = 1000.;
            }
            s.combat.actors[4].view.hp = 100000.;
            s.combat.actors[4].view.max_hp = 100000.;
            assert_recovery_engages(s, hero, 30);
        }
    }
    #[test]
    fn every_sole_survivor_engages_when_revive_is_unavailable() {
        for hero in 0..4 {
            let mut s = seed_four_recovery_fixture(&[hero]);
            s.combat.actors[hero].revive_cd = 1000.;
            assert!(!s.combat.recovery_holds_approach());
            assert_recovery_engages(s, hero, 30);
        }
    }
    #[test]
    fn recovery_hold_requires_available_or_active_hero_revive() {
        let mut s = seed_four_recovery_fixture(&[0, 1]);
        s.combat.actors.truncate(4);
        assert!(s.combat.recovery_holds_approach());
        s.combat.actors[0].revive_cd = 10.;
        s.combat.actors[1].revive_cd = 10.;
        assert!(!s.combat.recovery_holds_approach());
        let target = s.combat.actors[2].view.id;
        s.combat.start_action(1, Some(target), false, true);
        assert!(s.combat.recovery_holds_approach());
    }
    #[test]
    fn retreating_mage_does_not_hold_the_other_survivors_approach() {
        let mut s = Sim::composition_trial(SimConfig::default(), &[Archetype::Gobloc]);
        s.combat.hazards.clear();
        for (i, a) in s.combat.actors.iter_mut().enumerate() {
            a.state(ActorState::Idle, 0., 0.);
            a.formed_age = 100.;
            a.ai_cd = 0.;
            a.view.pos = Vec2::new(480., 1200.);
            if i == 1 || i == 3 {
                a.view.hp = 0.;
                a.state(ActorState::Downed, 0., 0.);
            }
        }
        s.combat.actors[0].view.pos = Vec2::new(480., 1400.);
        s.combat.actors[0].view.hp = s.combat.actors[0].view.max_hp * REVIVE_SAFE_HP;
        s.combat.actors[4].view.pos = Vec2::new(480., 1000.);
        s.combat.actors[2].view.pos =
            Vec2::new(480., 1000. + s.combat.mage_danger_radius(2, 4) - 5.);
        assert!(s.combat.revive_target(0).is_none());
        assert!(s.combat.revive_target(2).is_some());
        assert!(s.combat.mage_threat(2, false).is_some());
        assert!(!s.combat.recovery_holds_approach());
        s.hero_ai();
        assert_eq!(s.combat.actors[0].view.ai_intent, AiIntent::MoveToRange);
        assert_eq!(s.combat.actors[2].view.ai_intent, AiIntent::Retreat);
    }
    #[test]
    fn seed_four_has_no_recovery_idle_stall_through_eighteen_hundred_seconds() {
        let mut s = Sim::new(SimConfig {
            seed: 4,
            ..Default::default()
        });
        let mut idle = [0; 4];
        let mut max_idle = 0;
        let mut hits = 0;
        for _ in 0..1800 * SIM_HZ {
            s.step();
            for (i, held) in idle.iter_mut().enumerate() {
                let a = &s.combat.actors[i];
                let target = a.target.and_then(|id| s.combat.actor_index(id));
                let stalled = a.alive()
                    && !a.committed()
                    && s.combat.party_recovering()
                    && a.view.ai_intent == AiIntent::None
                    && target.is_some_and(|e| {
                        s.combat.can_engage(i, e)
                            && a.view.pos.distance(s.combat.actors[e].view.pos)
                                > a.attack_range(&s.combat.actors[e])
                    })
                    && !s.combat.recovery_holds_approach();
                *held = if stalled { *held + 1 } else { 0 };
                max_idle = max_idle.max(*held);
                assert!(
                    *held <= 90,
                    "seed 4 recovery stall at step {}, hero {i}",
                    s.combat.step_number
                );
            }
            hits += s
                .drain_events()
                .iter()
                .filter(|e| matches!(e, Event::Hit { source: 1..=4, .. }))
                .count();
        }
        assert!(hits > 0);
        eprintln!("seed 4: 1800s, max unassisted recovery idle={max_idle} ticks, hero hits={hits}");
    }
}
