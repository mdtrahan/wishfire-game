use super::*;
use crate::api::Event;
use crate::{
    stage_script::{Pattern, Spawn},
    *,
};

fn json() -> serde_json::Value {
    serde_json::from_str(include_str!("../fixtures/waves.json")).unwrap()
}
fn enemy(name: &str, tier: usize) -> Archetype {
    use Archetype::*;
    match name {
        "gobloc" => Gobloc,
        "bastorto" => Bastorto,
        "orc" => Orc,
        "high orc" => HighOrc,
        "gloamink" => Gloamink,
        "marid" => Marid,
        "mirewing" => Mirewing,
        "lizardo" => Lizardo,
        "sniper" => Sniper,
        "fizzmite" => Fizzmite,
        "boss" => [Boss, BossBomber, BossMarksman][tier],
        _ => panic!("unknown test type"),
    }
}
fn scene(entry: usize) -> Sim {
    let mut s = Sim::new(SimConfig::default());
    s.director.entry = entry;
    s.director.clear_age = 6.5;
    s.direct();
    s
}
fn tick(s: &mut Sim) {
    s.direct();
    s.combat.timers();
    s.combat.update_hazards();
    s.resolve_hazards();
    s.combat.events.clear();
}
fn emerge(s: &mut Sim) {
    for _ in 0..100 {
        if s.director.subwave_units[..s.director.subwave_count]
            .iter()
            .all(|id| *id != 0)
        {
            return;
        }
        tick(s);
    }
    panic!("sub-wave did not emerge");
}

#[test]
fn generated_v2_tables_match_every_authored_field_and_expanded_unit_count() {
    let data = json();
    assert!(crate::wave_build::compile(&data.to_string()).is_ok());
    for (tier, stage) in data["stages"].as_array().unwrap().iter().enumerate() {
        let waves = stage["waves"].as_array().unwrap();
        let compiled = script(tier as u8 + 1);
        assert_eq!(compiled.len(), waves.len());
        for (wave, source) in compiled.iter().zip(waves) {
            assert_eq!(wave.name, source["name"].as_str().unwrap());
            assert_eq!(wave.theme, source["theme"].as_str().unwrap());
            let subs = source["subwaves"].as_array().unwrap();
            assert_eq!(wave.subwaves.len(), subs.len());
            for (sub, source) in wave.subwaves.iter().zip(subs) {
                assert_eq!(
                    sub.placed,
                    if source["placed"] == "party" {
                        Anchor::Party
                    } else {
                        Anchor::Arena
                    }
                );
                let seeded = source["pattern"] == "seeded";
                assert_eq!(
                    sub.pattern,
                    if seeded {
                        Pattern::Seeded
                    } else {
                        Pattern::Authored
                    }
                );
                let entries = source[if seeded { "units" } else { "spawns" }]
                    .as_array()
                    .unwrap();
                let mut expected = Vec::new();
                for entry in entries {
                    let count = if seeded {
                        entry["count"].as_u64().unwrap() as usize
                    } else {
                        1
                    };
                    for _ in 0..count {
                        expected.push((
                            enemy(entry["type"].as_str().unwrap(), tier),
                            if seeded {
                                Vec2::default()
                            } else {
                                Vec2::new(
                                    entry["x"].as_f64().unwrap() as f32,
                                    entry["y"].as_f64().unwrap() as f32,
                                )
                            },
                            entry
                                .get("delay_s")
                                .map_or(0., |n| n.as_f64().unwrap() as f32),
                        ));
                    }
                }
                assert_eq!(sub.spawns.len(), expected.len());
                for (actual, expected) in sub.spawns.iter().zip(expected) {
                    assert_eq!((actual.archetype, actual.offset, actual.delay_s), expected);
                }
            }
        }
    }
}

#[test]
fn malformed_json_unknown_units_bad_counts_and_missing_boss_fail_compilation() {
    assert!(crate::wave_build::compile("{invalid").is_err());
    for mutation in 0..7 {
        let mut data = json();
        match mutation {
            0 => data["version"] = 1.into(),
            1 => {
                data["stages"][0]["waves"][0]["subwaves"][0]["spawns"][0]["type"] = "unknown".into()
            }
            2 => data["stages"][0]["waves"][0]["subwaves"][1]["units"][0]["count"] = 33.into(),
            3 => data["stages"][0]["waves"][5]["subwaves"][0]["spawns"][0]["type"] = "orc".into(),
            4 => data["stages"][0]["waves"][0]["subwaves"][0]["placed"] = "elsewhere".into(),
            5 => {
                data["stages"][0]["waves"][0]["subwaves"][0]["spawns"][0]["x"] =
                    serde_json::json!(1e100)
            }
            _ => data["stages"][0]["waves"][0]["subwaves"][0]["spawns"][0]["delay_s"] = (-1).into(),
        }
        assert!(
            crate::wave_build::compile(&data.to_string()).is_err(),
            "mutation {mutation}"
        );
    }
}

#[test]
fn authored_anchor_modes_and_offsets_are_seed_independent() {
    for entry in [0, 3] {
        let mut first = None;
        for seed in 1..=20 {
            let mut s = Sim::new(SimConfig {
                seed,
                ..Default::default()
            });
            s.director.entry = entry;
            s.director.clear_age = 6.5;
            for (k, a) in s.combat.actors.iter_mut().enumerate() {
                a.view.pos = (ARENA_CENTRE + Vec2::new(0., 200.)) + TRAVEL_SLOTS[k];
            }
            s.direct();
            let sub = &script(1)[entry].subwaves[0];
            let origin = if sub.placed == Anchor::Party {
                ARENA_CENTRE + Vec2::new(0., 200.)
            } else {
                ARENA_CENTRE
            };
            assert_eq!(s.director.wave_origin, origin);
            let markers: Vec<_> = s
                .combat
                .hazards
                .iter()
                .filter(|h| h.spawn_kind.is_some())
                .map(|h| h.view.origin)
                .collect();
            assert_eq!(markers.len(), sub.spawns.len());
            let heroes: Vec<_> = s
                .combat
                .actors
                .iter()
                .filter(|a| a.view.team == Team::Hero)
                .map(|a| a.view.pos)
                .collect();
            for (point, spawn) in markers.iter().zip(sub.spawns) {
                let buffer = match spawn.archetype {
                    Archetype::Sniper
                    | Archetype::Lizardo
                    | Archetype::Mirewing
                    | Archetype::Marid => SPAWN_RANGED_BUFFER,
                    _ => SPAWN_MELEE_BUFFER,
                };
                let authored = crate::math::floor_point(origin + spawn.offset, SPAWN_MARKER_RADIUS);
                // Authored spots stay exact unless they break the hero buffer.
                if heroes.iter().all(|h| authored.distance(*h) >= buffer) {
                    assert_eq!(*point, authored);
                }
                assert!(heroes.iter().all(|h| point.distance(*h) + 0.01 >= buffer));
            }
            if let Some(first) = &first {
                assert_eq!(first, &markers);
            } else {
                first = Some(markers);
            }
        }
    }
}

#[test]
fn seeded_role_fill_keeps_tough_melee_inside_and_all_ranged_units_outside() {
    let types = [
        Archetype::Sniper,
        Archetype::Lizardo,
        Archetype::HighOrc,
        Archetype::Marid,
        Archetype::Orc,
        Archetype::Bastorto,
        Archetype::Gobloc,
        Archetype::Gloamink,
        Archetype::Mirewing,
        Archetype::Fizzmite,
    ];
    let spawns = types.map(|archetype| Spawn {
        archetype,
        offset: Vec2::default(),
        delay_s: 0.,
    });
    let party = TRIAL_ORIGIN;
    for seed in 1..=100 {
        let points = crate::spawns::seeded_points(
            &spawns,
            party,
            party,
            Vec2::new(0., -1.),
            ARENA_MIN,
            ARENA_MAX,
            &[],
            &mut crate::rng::Rng(seed),
        );
        for melee in [2, 4, 5, 6, 7, 9] {
            for ranged in [0, 1, 3, 8] {
                assert!(
                    points[melee].unwrap().distance(party)
                        <= points[ranged].unwrap().distance(party) + 0.01,
                    "seed {seed}"
                );
            }
        }
        let again = crate::spawns::seeded_points(
            &spawns,
            party,
            party,
            Vec2::new(0., -1.),
            ARENA_MIN,
            ARENA_MAX,
            &[],
            &mut crate::rng::Rng(seed),
        );
        assert_eq!(points, again);
    }
}

#[test]
fn compact_arena_keeps_scripted_role_buffers_at_centre_and_walls() {
    for tier in 1..=3 {
        for wave in script(tier) {
            for sub in wave.subwaves {
                for y in [ARENA_MIN.y + 160., ARENA_CENTRE.y, ARENA_MAX.y - 160.] {
                    let party = Vec2::new(ARENA_CENTRE.x, y);
                    let heroes = TRAVEL_SLOTS.map(|slot| (party + slot, BODY_RADIUS));
                    let anchor = if sub.placed == Anchor::Party {
                        party
                    } else {
                        ARENA_CENTRE
                    };
                    for seed in 1..=10 {
                        let points = if sub.pattern == Pattern::Authored {
                            crate::spawns::points(sub.spawns, anchor, ARENA_MIN, ARENA_MAX, &heroes)
                        } else {
                            crate::spawns::seeded_points(
                                sub.spawns,
                                anchor,
                                party,
                                Vec2::new(0., -1.),
                                ARENA_MIN,
                                ARENA_MAX,
                                &heroes,
                                &mut crate::rng::Rng(seed),
                            )
                        };
                        for (i, spawn) in sub.spawns.iter().enumerate() {
                            let point = points[i].expect("fixture fits");
                            let boss = is_boss(spawn.archetype);
                            let radius = if boss {
                                BOSS_BODY_RADIUS
                            } else {
                                SPAWN_MARKER_RADIUS
                            };
                            assert_eq!(point, crate::math::floor_point(point, radius));
                            let buffer = match spawn.archetype {
                                Archetype::Sniper
                                | Archetype::Lizardo
                                | Archetype::Mirewing
                                | Archetype::Marid => SPAWN_RANGED_BUFFER,
                                _ if boss => 0.,
                                _ => SPAWN_MELEE_BUFFER,
                            };
                            assert!(heroes
                                .iter()
                                .all(|(h, _)| point.distance(*h) + 0.01 >= buffer));
                        }
                    }
                }
            }
        }
    }
}

#[test]
fn compact_arena_metadata_and_boss_court_match_simulation() {
    let art: serde_json::Value =
        serde_json::from_str(include_str!("../fixtures/arena.json")).unwrap();
    assert_eq!(ARENA_MIN, Vec2::new(96., 40.));
    assert_eq!(ARENA_MAX, Vec2::new(864., 1592.));
    for (key, expected) in [
        ("x0", ARENA_MIN.x),
        ("y0", ARENA_MIN.y),
        ("x1", ARENA_MAX.x),
        ("y1", ARENA_MAX.y),
    ] {
        assert_eq!(art["walkable"][key].as_f64().unwrap() as f32, expected);
    }
    assert_eq!(art["size"], serde_json::json!([960, 2200]));
    assert_eq!(art["boss_court_center"], serde_json::json!([480, 320]));
    for tier in 1..=3 {
        let mut s = Sim::new(SimConfig::default());
        s.stage.tier = tier;
        s.director.entry = script(tier).len() - 1;
        s.director.clear_age = 10.;
        s.direct();
        let boss = s
            .combat
            .actors
            .iter()
            .find(|a| is_boss(a.view.archetype))
            .unwrap();
        assert_eq!(boss.view.pos, Vec2::new(480., ARENA_MIN.y + 280.));
        for a in &s.combat.actors {
            assert_eq!(
                a.view.pos,
                crate::math::floor_point(a.view.pos, a.view.radius)
            );
        }
    }
}

#[test]
fn reinforcements_follow_soon_after_emergence_or_at_once_when_beaten() {
    // Alive: the follow-up arrives SUBWAVE_FOLLOW_SECONDS after full emergence.
    let mut s = scene(0);
    emerge(&mut s);
    for a in s
        .combat
        .actors
        .iter_mut()
        .filter(|a| a.view.team == Team::Enemy)
    {
        a.view.hp = 1e9;
        a.view.max_hp = 1e9;
    }
    let follow = (SUBWAVE_FOLLOW_SECONDS * SIM_HZ as f32) as u32;
    for _ in 0..follow - 2 {
        tick(&mut s);
        assert_eq!(s.director.subwave, 0);
    }
    for _ in 0..3 {
        tick(&mut s);
    }
    assert_eq!(s.director.subwave, 1);
    assert!(s.chests.is_empty());
    assert_eq!(
        s.combat
            .hazards
            .iter()
            .filter(|h| h.spawn_kind.is_some())
            .count(),
        script(1)[0].subwaves[1].spawns.len()
    );
    // Beaten: the follow-up is announced on the next director step.
    let mut s = scene(0);
    emerge(&mut s);
    for a in s
        .combat
        .actors
        .iter_mut()
        .filter(|a| a.view.team == Team::Enemy)
    {
        a.view.hp = 0.;
    }
    s.direct();
    assert_eq!(s.director.subwave, 1);
}

#[test]
fn follow_up_subwaves_bring_a_different_enemy_type() {
    for tier in 1..=3 {
        for wave in script(tier) {
            for pair in wave.subwaves.windows(2) {
                assert!(
                    pair[1]
                        .spawns
                        .iter()
                        .all(|n| pair[0].spawns.iter().all(|p| p.archetype != n.archetype)),
                    "{} repeats a type in its follow-up",
                    wave.name
                );
            }
        }
    }
}

#[test]
fn chest_waits_for_the_last_subwave() {
    let mut s = scene(0);
    let last = script(1)[0].subwaves.len() - 1;
    while s.director.subwave < last {
        emerge(&mut s);
        for a in s
            .combat
            .actors
            .iter_mut()
            .filter(|a| a.view.team == Team::Enemy)
        {
            a.view.hp = 0.;
        }
        for _ in 0..((SUBWAVE_FOLLOW_SECONDS + 1.) * SIM_HZ as f32) as u32 {
            s.direct();
            assert!(s.chests.is_empty());
        }
    }
    emerge(&mut s);
    let survivor = s.director.subwave_units[0];
    for a in s
        .combat
        .actors
        .iter_mut()
        .filter(|a| a.view.team == Team::Enemy && a.view.id != survivor)
    {
        a.view.hp = 0.;
    }
    s.direct();
    assert!(s.chests.is_empty(), "a living enemy still holds the chest");
    let i = s.combat.actor_index(survivor).unwrap();
    s.combat.actors[i].view.hp = 0.;
    s.direct();
    assert_eq!(s.chests.len(), 1);
    assert_eq!(s.chests[0].state, ChestState::Closed);
    assert_eq!(s.stage.mini_wave, 1);
}

#[test]
fn boss_wave_keeps_direct_entrance_and_all_authored_escorts() {
    for tier in 1..=3 {
        let mut s = Sim::new(SimConfig::default());
        s.stage.tier = tier;
        s.director.entry = script(tier).len() - 1;
        s.director.clear_age = 6.5;
        s.direct();
        let id = s.director.boss.unwrap();
        let boss = &s.combat.actors[s.combat.actor_index(id).unwrap()];
        assert_eq!(
            boss.view.archetype,
            [
                Archetype::Boss,
                Archetype::BossBomber,
                Archetype::BossMarksman
            ][tier as usize - 1]
        );
        assert_eq!(boss.view.pos, s.director.boss_spawn_pos);
        assert_eq!(boss.view.state, ActorState::Spawn);
        let sub = &script(tier).last().unwrap().subwaves[0];
        assert_eq!(
            s.combat
                .hazards
                .iter()
                .filter(|h| h.spawn_kind.is_some())
                .count(),
            sub.spawns.len() - 1
        );
        assert!(s
            .drain_events()
            .iter()
            .any(|e| matches!(e, Event::BossArrived { id: b } if *b == id)));
    }
}

#[test]
fn announcing_authored_and_seeded_subwaves_allocates_nothing() {
    for seed in 1..=100 {
        let mut s = Sim::new(SimConfig {
            seed,
            ..Default::default()
        });
        crate::tests::ALLOCATIONS.with(|a| a.set(Some(0)));
        s.start_wave(&script(1)[0]);
        s.announce_subwave(&script(1)[0].subwaves[1]);
        let allocations = crate::tests::ALLOCATIONS.with(|a| a.replace(None).unwrap());
        assert_eq!(allocations, 0, "seed {seed}");
    }
}

#[test]
fn wave_rest_starts_after_chest_banner_and_respects_recovery() {
    let rest = ((REWARD_BANNER_SECONDS + 3.5) * SIM_HZ as f32) as u32;
    for recovering in [false, true] {
        for entry in [1, mini_waves(1) as usize] {
            let mut s = Sim::new(SimConfig::default());
            s.director.entry = entry;
            s.drop_chest();
            if recovering {
                s.combat.actors[0].view.state = ActorState::Downed;
                s.combat.actors[0].view.hp = 0.;
            }
            for _ in 0..600 {
                s.direct();
            }
            assert_eq!(s.stage.mini_wave, 0, "closed chest holds the next wave");
            s.chests[0].state = ChestState::Open;
            s.chests[0].state_age = 0.;
            // Heroes far from the centre do not gate the wave.
            s.combat.actors[3].view.pos.y += 350.;
            for _ in 0..rest - 2 {
                s.chests[0].state_age += SIM_DT;
                s.direct();
            }
            assert_eq!(s.stage.mini_wave, 0);
            for _ in 0..2 {
                s.chests[0].state_age += SIM_DT;
                s.direct();
            }
            assert_eq!(s.stage.mini_wave > 0, !recovering);
            if entry == mini_waves(1) as usize {
                assert_eq!(s.director.boss.is_some(), !recovering);
            }
        }
    }
}

#[test]
fn optional_non_sorted_delays_preserve_marker_fill_and_enemy_emergence() {
    const WAVE: MiniWave = MiniWave {
        name: "Delay fixture",
        theme: "test",
        trigger: crate::stage_script::Trigger::PreviousCleared { delay_s: 0. },
        subwaves: &[SubWave {
            placed: Anchor::Arena,
            pattern: Pattern::Authored,
            spawns: &[
                Spawn {
                    archetype: Archetype::Gobloc,
                    offset: Vec2::new(200., -200.),
                    delay_s: 0.5,
                },
                Spawn {
                    archetype: Archetype::Orc,
                    offset: Vec2::new(-200., -200.),
                    delay_s: 0.,
                },
            ],
        }],
    };
    let wave = WAVE;
    let mut s = Sim::new(SimConfig::default());
    s.start_wave(&wave);
    s.execute_spawns(&wave);
    let markers: Vec<_> = s
        .combat
        .hazards
        .iter()
        .filter(|h| h.spawn_kind.is_some())
        .map(|h| (h.view.origin, h.spawn_kind.unwrap(), -h.phase_age))
        .collect();
    assert_eq!(markers.len(), 2);
    assert!(s
        .combat
        .hazards
        .iter()
        .filter(|h| h.spawn_kind.is_some())
        .all(|h| h.view.progress == 0.));
    for step in 1..=60 {
        s.combat.update_hazards();
        s.resolve_hazards();
        for (pos, kind, delay) in &markers {
            let actor = s
                .combat
                .actors
                .iter()
                .find(|a| a.view.team == Team::Enemy && a.view.pos == *pos);
            assert_eq!(
                actor.is_some(),
                step as f32 * SIM_DT + 0.00001 >= SPAWN_COUNTDOWN + delay
            );
            if let Some(a) = actor {
                assert_eq!(a.view.archetype, *kind);
                assert_eq!(a.view.state, ActorState::Spawn);
            }
        }
    }
    let mut data = json();
    data["stages"][0]["waves"][0]["subwaves"][0]["spawns"][0]["delay_s"] = 0.5.into();
    assert!(crate::wave_build::compile(&data.to_string())
        .unwrap()
        .contains(&format!("delay_s: f32::from_bits({})", 0.5f32.to_bits())));
}

#[test]
fn late_authored_unit_emerges_before_the_next_subwave() {
    const WAVE: MiniWave = MiniWave {
        name: "Late unit",
        theme: "test",
        trigger: crate::stage_script::Trigger::PreviousCleared { delay_s: 0. },
        subwaves: &[
            SubWave {
                placed: Anchor::Arena,
                pattern: Pattern::Authored,
                spawns: &[
                    Spawn {
                        archetype: Archetype::Gobloc,
                        offset: Vec2::new(-200., -300.),
                        delay_s: 0.,
                    },
                    Spawn {
                        archetype: Archetype::Gobloc,
                        offset: Vec2::new(200., -300.),
                        delay_s: 0.,
                    },
                    Spawn {
                        archetype: Archetype::Orc,
                        offset: Vec2::new(200., 300.),
                        delay_s: 10.,
                    },
                ],
            },
            SubWave {
                placed: Anchor::Party,
                pattern: Pattern::Seeded,
                spawns: &[
                    Spawn {
                        archetype: Archetype::Gloamink,
                        offset: Vec2::new(0., 0.),
                        delay_s: 0.,
                    },
                    Spawn {
                        archetype: Archetype::Gloamink,
                        offset: Vec2::new(0., 0.),
                        delay_s: 0.,
                    },
                ],
            },
        ],
    };
    let mut s = Sim::new(SimConfig::default());
    s.start_wave(&WAVE);
    let mut escalated = false;
    for _ in 0..900 {
        if s.director.wave_active {
            s.execute_spawns(&WAVE);
        }
        if s.director.subwave == 1 && !escalated {
            assert!(s
                .combat
                .actors
                .iter()
                .any(|a| a.view.archetype == Archetype::Orc));
            escalated = true;
        }
        s.combat.update_hazards();
        s.resolve_hazards();
        if !escalated {
            for a in s
                .combat
                .actors
                .iter_mut()
                .filter(|a| a.view.team == Team::Enemy)
            {
                a.view.hp = 0.;
            }
        }
    }
    assert!(escalated);
    assert_eq!(
        s.combat
            .actors
            .iter()
            .filter(|a| a.view.team == Team::Enemy)
            .count(),
        5
    );
    assert_eq!(
        s.combat
            .actors
            .iter()
            .filter(|a| a.view.archetype == Archetype::Orc)
            .count(),
        1
    );
}

#[test]
fn mage_aoe_hold_clears_at_every_wave_and_boss_boundary_preserving_meter() {
    for tier in 1..=3 {
        let mut s = Sim::new(SimConfig::default());
        s.stage.tier = tier;
        for (entry, wave) in script(tier).iter().enumerate() {
            // Ordinary wave boundaries start on a clear field.
            s.combat.actors.retain(|a| a.view.team == Team::Hero);
            s.combat.hazards.clear();
            s.director.entry = entry;
            for a in &mut s.combat.actors[..4] {
                a.view.meter = 1.5;
                a.aoe_ready_steps = 12;
            }
            s.start_wave(wave);
            assert!(s.combat.actors[..4]
                .iter()
                .all(|a| a.aoe_ready_steps == 0 && a.view.meter == 1.5));
            for sub in wave.subwaves {
                for a in &mut s.combat.actors[..4] {
                    a.aoe_ready_steps = MAGE_AOE_HOLD_STEPS;
                }
                s.announce_subwave(sub);
                assert!(s.combat.actors[..4]
                    .iter()
                    .all(|a| a.aoe_ready_steps == 0 && a.view.meter == 1.5));
                if sub.spawns.iter().any(|spawn| is_boss(spawn.archetype)) {
                    for a in &mut s.combat.actors[..4] {
                        a.aoe_ready_steps = 12;
                    }
                    s.director.wave_age = 100.;
                    s.execute_subwave(sub);
                    assert!(s.director.boss.is_some());
                    assert!(s.combat.actors[..4]
                        .iter()
                        .all(|a| a.aoe_ready_steps == 0 && a.view.meter == 1.5));
                }
            }
        }
        s.combat.actors[2].aoe_ready_steps = 12;
        s.combat.actors[3].aoe_ready_steps = MAGE_AOE_HOLD_STEPS;
        s.reset_stage(true);
        assert!(s.combat.actors[..4].iter().all(|a| a.aoe_ready_steps == 0));
    }
}

#[test]
fn global_enemy_cap_holds_every_tick_through_all_three_stages() {
    for seed in [1, 7, 42, 123, 999] {
        let mut s = Sim::new(SimConfig {
            seed,
            ..Default::default()
        });
        let (mut peak, mut max_queue, mut summons) = (0, 0, 0);
        let mut seen = [[[false; 8]; 8]; 3];
        for _ in 0..1800 * SIM_HZ {
            s.step();
            let (active, queued, sub) = s.pacing_observation();
            assert!(
                active <= ACTIVE_ENEMY_CAP,
                "seed {seed} tick {}: {active}",
                s.snapshot.step
            );
            peak = peak.max(active);
            max_queue = max_queue.max(queued);
            if s.stage.wave <= 3 && s.director.subwave_count > 0 {
                let entry = s
                    .director
                    .entry
                    .saturating_sub(usize::from(!s.director.wave_active));
                seen[s.stage.wave as usize - 1][entry][sub - 1] = true;
            }
            for event in s.drain_events() {
                if let Event::Spawned { id, archetype } = event {
                    if s.director.boss.is_some()
                        && !is_boss(archetype)
                        && !s.director.subwave_units.contains(&id)
                    {
                        summons += 1;
                    }
                }
            }
            if s.stage.wave > 3 {
                break;
            }
        }
        eprintln!("cap seed {seed}: peak {peak}, max queue {max_queue}, summons {summons}");
        assert!(
            s.stage.wave > 3,
            "seed {seed} did not finish all three stages"
        );
        assert!(summons > 0, "seed {seed} never reached boss summons");
        for tier in 1..=3 {
            for (entry, wave) in script(tier).iter().enumerate() {
                for sub in 0..wave.subwaves.len() {
                    assert!(
                        seen[tier as usize - 1][entry][sub],
                        "seed {seed} missed {tier}/{entry}/{sub}"
                    );
                }
            }
        }
    }
}

#[test]
fn queued_units_drain_without_allocating_and_use_current_party_buffers_and_delays() {
    const SPAWNS: [Spawn; 16] = {
        let mut a = [Spawn {
            archetype: Archetype::Gobloc,
            offset: Vec2::new(0., 0.),
            delay_s: 0.,
        }; 16];
        let mut i = 12;
        while i < 16 {
            a[i].archetype = if i % 2 == 0 {
                Archetype::Sniper
            } else {
                Archetype::Gobloc
            };
            a[i].delay_s = 0.5;
            i += 1;
        }
        a
    };
    const WAVE: MiniWave = MiniWave {
        name: "capacity fixture",
        theme: "queue",
        trigger: crate::stage_script::Trigger::PreviousCleared { delay_s: 0. },
        subwaves: &[SubWave {
            placed: Anchor::Party,
            pattern: Pattern::Seeded,
            spawns: &SPAWNS,
        }],
    };
    let mut s = Sim::new(SimConfig::default());
    // The queue fits the existing arrays; neither announce nor deferred placement allocates.
    crate::tests::ALLOCATIONS.with(|a| a.set(Some(0)));
    s.start_wave(&WAVE);
    let allocations = crate::tests::ALLOCATIONS.with(|a| a.replace(None).unwrap());
    assert_eq!(allocations, 0);
    assert_eq!(s.pacing_observation().0, 12);
    assert_eq!(s.pacing_observation().1, 4);
    assert!(s.director.wave_active);
    for _ in 0..60 {
        s.combat.timers();
        s.combat.update_hazards();
        s.resolve_hazards();
        s.combat.events.clear();
    }
    // Party moves while the queue waits. New markers must use these positions.
    for (i, a) in s
        .combat
        .actors
        .iter_mut()
        .filter(|a| a.view.team == Team::Hero)
        .enumerate()
    {
        a.view.pos = Vec2::new(400. + i as f32 * 55., 1800.);
    }
    for index in 12..16 {
        let victim = s
            .combat
            .actors
            .iter_mut()
            .find(|a| a.view.team == Team::Enemy && a.alive())
            .unwrap();
        victim.view.hp = 0.;
        crate::tests::ALLOCATIONS.with(|a| a.set(Some(0)));
        s.execute_spawns(&WAVE);
        let allocations = crate::tests::ALLOCATIONS.with(|a| a.replace(None).unwrap());
        assert_eq!(allocations, 0);
        let marker_id = s.director.subwave_markers[index];
        let marker = s
            .combat
            .hazards
            .iter()
            .find(|h| h.view.id == marker_id)
            .unwrap();
        assert_eq!(marker.phase_age, -SPAWNS[index].delay_s);
        assert!(s.chests.is_empty());
        for step in 0..100 {
            s.combat.timers();
            s.combat.update_hazards();
            s.resolve_hazards();
            s.combat.events.clear();
            assert!(s.pacing_observation().0 <= ACTIVE_ENEMY_CAP);
            let id = s.director.subwave_units[index];
            if id != 0 {
                assert!(
                    (step + 1) as f32 * SIM_DT + 0.0001 >= SPAWN_COUNTDOWN + SPAWNS[index].delay_s
                );
                let actor = &s.combat.actors[s.combat.actor_index(id).unwrap()];
                let buffer = crate::spawns::hero_buffer(actor.view.archetype);
                for hero in s
                    .combat
                    .actors
                    .iter()
                    .filter(|a| a.view.team == Team::Hero && a.alive())
                {
                    assert!(actor.view.pos.distance(hero.view.pos) + 0.01 >= buffer);
                }
                break;
            }
        }
        assert_ne!(
            s.director.subwave_units[index], 0,
            "queued unit {index} lost"
        );
    }
    assert_eq!(s.pacing_observation().1, 0);
    assert!(s.director.subwave_units[..16].iter().all(|id| *id != 0));
    for actor in s
        .combat
        .actors
        .iter_mut()
        .filter(|a| a.view.team == Team::Enemy)
    {
        actor.view.hp = 0.;
    }
    s.direct();
    assert_eq!(s.chests.len(), 1);
}

#[test]
fn boss_summons_share_slots_with_living_enemies_and_reserved_markers() {
    for boss in [Archetype::Boss, Archetype::BossMarksman] {
        let mut s = Sim::composition_trial(SimConfig::default(), &[boss]);
        for _ in 0..10 {
            s.spawn_enemy(Archetype::Gobloc);
        }
        // One unresolved marker consumes the last slot, even before it materializes.
        s.hazard(
            HazardKind::SpawnMarker,
            0,
            None,
            Vec2::new(480., 300.),
            Vec2::new(0., -1.),
        );
        s.combat.hazards.last_mut().unwrap().spawn_kind = Some(Archetype::Orc);
        let i = s
            .combat
            .actors
            .iter()
            .position(|a| a.view.archetype == boss)
            .unwrap();
        s.combat.actors[i].summon_cd = 0.;
        s.combat.actors[i].state(ActorState::Idle, 0., 0.);
        s.enemy_ai();
        assert_eq!(s.pacing_observation().0, 12);
        // Free exactly one slot: even a multi-unit summon is clipped to one.
        let j = s
            .combat
            .actors
            .iter()
            .position(|a| a.view.archetype == Archetype::Gobloc)
            .unwrap();
        s.combat.actors[j].view.hp = 0.;
        s.combat.actors[i].summon_cd = 0.;
        s.enemy_ai();
        assert_eq!(s.pacing_observation().0, 12);
    }
}

// Freeze the pre-.23 compositions and captured party geometry so later wave edits
// keep exercising blocked/boundary placement; enemy stats and boss HP stay live.
fn spawn_fit_repro(
    seed: u64,
    tier: u8,
    entry: usize,
    sub: &'static SubWave,
    rng_after_layout: u64,
    positions: [Vec2; 4],
    headings: [Vec2; 4],
    formation: crate::formations::Formation,
    expected_queued: usize,
) {
    let mut s = Sim::new(SimConfig {
        seed,
        ..Default::default()
    });
    s.stage.tier = tier;
    s.director.entry = entry;
    s.stage.mini_wave = entry as u32 + 1;
    s.director.subwave = 0;
    s.director.wave_active = true;
    s.director.chest_due = true;
    for i in 0..4 {
        s.combat.actors[i].view.pos = positions[i];
        s.combat.actors[i].heading = headings[i];
    }
    s.combat.spawn_rng.0 = rng_after_layout.wrapping_sub(4_u64.wrapping_mul(0x9e3779b97f4a7c15));
    assert_eq!(
        crate::formations::Layout::seeded(&mut s.combat.spawn_rng.clone()).kind,
        formation
    );
    let wave = &MiniWave {
        name: "captured spawn fit",
        theme: "queue",
        trigger: crate::stage_script::Trigger::PreviousCleared { delay_s: 0. },
        subwaves: core::slice::from_ref(sub),
    };
    assert_eq!(sub.spawns.len(), 6);
    crate::tests::ALLOCATIONS.with(|a| a.set(Some(0)));
    s.announce_subwave(sub);
    let allocations = crate::tests::ALLOCATIONS.with(|a| a.replace(None).unwrap());
    assert_eq!(allocations, 0);
    assert_eq!(s.pacing_observation().1, expected_queued);
    let mut emerged = [false; 6];
    for tick in 0..150 {
        // Seed 54 has no room for its last ranged unit until the party moves.
        // Let all existing markers emerge first so each emergence checks its live party.
        if tick == 60 && expected_queued > 0 {
            assert!(s.director.wave_active);
            assert!(s.chests.is_empty());
            for i in 0..4 {
                s.combat.actors[i].view.pos = Vec2::new(350. + i as f32 * 60., 150.);
            }
        }
        crate::tests::ALLOCATIONS.with(|a| a.set(Some(0)));
        s.execute_spawns(wave);
        s.combat.timers();
        s.combat.update_hazards();
        s.resolve_hazards();
        let allocations = crate::tests::ALLOCATIONS.with(|a| a.replace(None).unwrap());
        assert_eq!(allocations, 0);
        assert!(s.pacing_observation().0 <= ACTIVE_ENEMY_CAP);
        for i in 0..6 {
            let id = s.director.subwave_units[i];
            if id == 0 || emerged[i] {
                continue;
            }
            let actor = &s.combat.actors[s.combat.actor_index(id).unwrap()];
            assert_eq!(actor.view.archetype, sub.spawns[i].archetype);
            for hero in s
                .combat
                .actors
                .iter()
                .filter(|a| a.view.team == Team::Hero && a.alive())
            {
                assert!(
                    actor.view.pos.distance(hero.view.pos) + 0.001
                        >= crate::spawns::hero_buffer(actor.view.archetype)
                );
            }
            emerged[i] = true;
        }
        s.combat.events.clear();
        if emerged.iter().all(|v| *v) {
            break;
        }
    }
    assert!(emerged.iter().all(|v| *v), "seed {seed}: {emerged:?}");
    assert_eq!(s.pacing_observation().1, 0);
    // Every unit remains accounted for and the final wave can now award its chest.
    for actor in s
        .combat
        .actors
        .iter_mut()
        .filter(|a| a.view.team == Team::Enemy)
    {
        actor.view.hp = 0.;
    }
    s.direct();
    assert_eq!(s.chests.len(), 1);
}

#[test]
fn spawn_fit_seed_54_rows_behind_retries_until_every_unit_emerges() {
    const SUB: SubWave = SubWave {
        placed: Anchor::Arena,
        pattern: Pattern::Seeded,
        spawns: &[
            Spawn {
                archetype: Archetype::Fizzmite,
                offset: Vec2::new(0., 0.),
                delay_s: 0.,
            },
            Spawn {
                archetype: Archetype::Fizzmite,
                offset: Vec2::new(0., 0.),
                delay_s: 0.,
            },
            Spawn {
                archetype: Archetype::Sniper,
                offset: Vec2::new(0., 0.),
                delay_s: 0.,
            },
            Spawn {
                archetype: Archetype::Sniper,
                offset: Vec2::new(0., 0.),
                delay_s: 0.,
            },
            Spawn {
                archetype: Archetype::Sniper,
                offset: Vec2::new(0., 0.),
                delay_s: 0.,
            },
            Spawn {
                archetype: Archetype::Sniper,
                offset: Vec2::new(0., 0.),
                delay_s: 0.,
            },
        ],
    };
    spawn_fit_repro(
        54,
        3,
        5,
        &SUB,
        13694325305510010095,
        [
            Vec2::new(405.77704, 712.5578),
            Vec2::new(557.713, 543.45337),
            Vec2::new(430.41995, 1147.9761),
            Vec2::new(425.63953, 744.6123),
        ],
        [
            Vec2::new(0.5124875, -0.85869473),
            Vec2::new(0.61652756, 0.7873333),
            Vec2::new(-0.18768646, 0.98222893),
            Vec2::new(0.7510479, -0.6602477),
        ],
        crate::formations::Formation::RowsBehind,
        1,
    );
}

#[test]
fn spawn_fit_seed_4_ring_forced_scene_finds_wall_space_without_changing_boss_hp() {
    const SUB: SubWave = SubWave {
        placed: Anchor::Party,
        pattern: Pattern::Seeded,
        spawns: &[
            Spawn {
                archetype: Archetype::Gloamink,
                offset: Vec2::new(0., 0.),
                delay_s: 0.,
            },
            Spawn {
                archetype: Archetype::Gloamink,
                offset: Vec2::new(0., 0.),
                delay_s: 0.,
            },
            Spawn {
                archetype: Archetype::Gloamink,
                offset: Vec2::new(0., 0.),
                delay_s: 0.,
            },
            Spawn {
                archetype: Archetype::Gloamink,
                offset: Vec2::new(0., 0.),
                delay_s: 0.,
            },
            Spawn {
                archetype: Archetype::Mirewing,
                offset: Vec2::new(0., 0.),
                delay_s: 0.,
            },
            Spawn {
                archetype: Archetype::Mirewing,
                offset: Vec2::new(0., 0.),
                delay_s: 0.,
            },
        ],
    };
    spawn_fit_repro(
        4,
        2,
        4,
        &SUB,
        16835619325006032629,
        [
            Vec2::new(358.76025, 752.1671),
            Vec2::new(417.11206, 486.29208),
            Vec2::new(421.8571, 1060.7667),
            Vec2::new(397.0896, 1009.85266),
        ],
        [
            Vec2::new(-0.9180051, 0.39656845),
            Vec2::new(0.68890655, 0.7248501),
            Vec2::new(-0.97687244, -0.21382336),
            Vec2::new(0.45439962, 0.890798),
        ],
        crate::formations::Formation::Ring,
        0,
    );
}

#[test]
fn all_blocked_spawns_retry_each_tick_and_hold_followup_and_chest() {
    const WAVE: MiniWave = MiniWave {
        name: "blocked fixture",
        theme: "queue",
        trigger: crate::stage_script::Trigger::PreviousCleared { delay_s: 0. },
        subwaves: &[
            SubWave {
                placed: Anchor::Arena,
                pattern: Pattern::Authored,
                spawns: &[Spawn {
                    archetype: Archetype::Sniper,
                    offset: Vec2::new(0., 0.),
                    delay_s: 0.,
                }],
            },
            SubWave {
                placed: Anchor::Arena,
                pattern: Pattern::Authored,
                spawns: &[Spawn {
                    archetype: Archetype::Gobloc,
                    offset: Vec2::new(0., 0.),
                    delay_s: 0.,
                }],
            },
        ],
    };
    let mut s = Sim::new(SimConfig::default());
    for (i, pos) in [
        Vec2::new(280., 350.),
        Vec2::new(680., 350.),
        Vec2::new(280., 1250.),
        Vec2::new(680., 1250.),
    ]
    .into_iter()
    .enumerate()
    {
        s.combat.actors[i].view.pos = pos;
    }
    s.start_wave(&WAVE);
    for _ in 0..240 {
        crate::tests::ALLOCATIONS.with(|a| a.set(Some(0)));
        s.execute_spawns(&WAVE);
        let allocations = crate::tests::ALLOCATIONS.with(|a| a.replace(None).unwrap());
        assert_eq!(allocations, 0);
        assert_eq!(s.director.subwave, 0);
        assert_eq!(s.director.subwave_markers[0], 0);
        assert_eq!(s.director.subwave_units[0], 0);
        assert!(s.director.wave_active);
        assert!(s.chests.is_empty());
    }
    for i in 0..4 {
        s.combat.actors[i].view.pos = Vec2::new(350. + i as f32 * 60., 150.);
    }
    s.execute_spawns(&WAVE);
    assert_ne!(
        s.director.subwave_markers[0], 0,
        "retry on first clear tick"
    );
    for _ in 0..60 {
        s.combat.timers();
        s.combat.update_hazards();
        s.resolve_hazards();
        s.combat.events.clear();
    }
    let id = s.director.subwave_units[0];
    assert_ne!(id, 0);
    let enemy = s.combat.actor_index(id).unwrap();
    assert!(s.combat.actors[..4].iter().all(|h| s.combat.actors[enemy]
        .view
        .pos
        .distance(h.view.pos)
        >= SPAWN_RANGED_BUFFER));
    s.combat.actors[enemy].view.hp = 0.;
    s.execute_spawns(&WAVE);
    assert_eq!(s.director.subwave, 1);
    for _ in 0..60 {
        s.combat.timers();
        s.combat.update_hazards();
        s.resolve_hazards();
        s.combat.events.clear();
    }
    for actor in s
        .combat
        .actors
        .iter_mut()
        .filter(|a| a.view.team == Team::Enemy)
    {
        actor.view.hp = 0.;
    }
    s.execute_spawns(&WAVE);
    s.direct();
    assert_eq!(s.chests.len(), 1);
}

#[test]
fn blocked_boss_never_uses_a_stale_position_and_retries_when_heroes_move() {
    const WAVE: MiniWave = MiniWave {
        name: "blocked boss",
        theme: "queue",
        trigger: crate::stage_script::Trigger::PreviousCleared { delay_s: 0. },
        subwaves: &[SubWave {
            placed: Anchor::Arena,
            pattern: Pattern::Authored,
            spawns: &[Spawn {
                archetype: Archetype::Boss,
                offset: Vec2::new(0., 0.),
                delay_s: 0.,
            }],
        }],
    };
    let mut s = Sim::new(SimConfig::default());
    s.start_wave(&WAVE);
    s.snapshot.arena_min = Vec2::new(300., 600.);
    s.snapshot.arena_max = Vec2::new(500., 800.);
    for hero in &mut s.combat.actors[..4] {
        hero.view.pos = Vec2::new(400., 700.);
    }
    let stale = s.director.boss_spawn_pos;
    for _ in 0..30 {
        s.execute_spawns(&WAVE);
        assert!(s.director.boss.is_none());
        assert_eq!(s.director.subwave_units[0], 0);
        assert!(s.director.wave_active);
        assert!(s.chests.is_empty());
    }
    for hero in &mut s.combat.actors[..4] {
        hero.view.pos = Vec2::new(314., 614.);
    }
    s.execute_spawns(&WAVE);
    let id = s.director.boss.expect("boss retries on first clear tick");
    let boss = &s.combat.actors[s.combat.actor_index(id).unwrap()];
    assert_ne!(boss.view.pos, stale);
    assert!(s.combat.actors[..4]
        .iter()
        .all(|h| boss.view.pos.distance(h.view.pos) + 0.001
            >= BOSS_BODY_RADIUS + BODY_RADIUS + SPAWN_CLEARANCE));
    assert_eq!(s.director.subwave_units[0], id);
    assert!(!s.director.wave_active);
    assert!(s.pacing_observation().0 <= ACTIVE_ENEMY_CAP);
}

#[test]
fn stage_one_bastorto_fails_compilation() {
    let mut data = json();
    data["stages"][0]["waves"][0]["subwaves"][0]["spawns"][0]["type"] = "bastorto".into();
    assert!(crate::wave_build::compile(&data.to_string())
        .unwrap_err()
        .contains("Bastorto is forbidden before the first boss"));
}

#[test]
fn real_slice_has_no_bastorto_or_rally_before_first_boss() {
    for seed in [1, 7, 42, 123, 999] {
        let mut sim = Sim::new(SimConfig {
            seed,
            ..Default::default()
        });
        let mut arrived = false;
        for _ in 0..900 * SIM_HZ {
            sim.step();
            let events = sim.drain_events();
            for event in events {
                match event {
                    Event::BossArrived { .. } => arrived = true,
                    Event::Spawned {
                        archetype: Archetype::Bastorto,
                        ..
                    } if !arrived => {
                        panic!("seed {seed}: Bastorto spawned before first boss");
                    }
                    _ => {}
                }
            }
            if arrived {
                break;
            }
            for actor in sim
                .snapshot()
                .actors
                .iter()
                .filter(|a| a.team == Team::Enemy)
            {
                assert_ne!(actor.archetype, Archetype::Bastorto, "seed {seed}");
                assert!(!actor.rallied, "seed {seed}: rallied before first boss");
            }
        }
        assert!(arrived, "seed {seed}: first-boss proof censored at 900 s");
    }
}
