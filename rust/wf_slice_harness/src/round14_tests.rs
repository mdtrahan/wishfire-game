use crate::tuning::*;
use crate::*;
pub use wf_combat::round14_tests::*;
#[test]
fn boss_projectile_capsule_hits_torso_and_preserves_body_entry_order() {
    for kind in [
        Archetype::Boss,
        Archetype::BossBomber,
        Archetype::BossMarksman,
    ] {
        for (x, hit) in [(480., true), (480. + BOSS_BODY_RADIUS + 2., false)] {
            let mut s = Sim::new(SimConfig::default());
            s.combat.actors.clear();
            s.combat.projectiles.clear();
            s.spawn_actor(Archetype::Kaja, Vec2::new(x, 400.));
            let boss = s.spawn_actor(kind, Vec2::new(480., 1000.));
            let farther = s.spawn_actor(Archetype::Gobloc, Vec2::new(x, 800.));
            s.combat.actors[1].stats.evade = 0.;
            s.combat.actors[2].stats.evade = 0.;
            s.drain_events();
            // Orphan flight retains physical first-body capsule interception.
            s.combat
                .projectile(0, None, Vec2::new(x, 800.), false, 30., None);
            s.combat.projectiles[0].speed = 12000.;
            s.combat.move_projectiles();
            let events = s.drain_events();
            assert_eq!(
                events
                    .iter()
                    .any(|e| matches!(e, Event::Hit { target, .. } if *target == boss)),
                hit,
                "{kind:?} x={x}"
            );
            assert_eq!(
                events
                    .iter()
                    .any(|e| matches!(e, Event::Hit { target, .. } if *target == farther)),
                !hit
            );
        }
    }
    // Horizontal crossing through the rectangle, tangent cap, inside, away, miss.
    let foot = Vec2::new(480., 1000.);
    for (p, dir, expected) in [
        (Vec2::new(280., 850.), Vec2::new(1., 0.), 134.),
        (Vec2::new(280., 634.), Vec2::new(1., 0.), 200.),
        (Vec2::new(480., 850.), Vec2::new(1., 0.), 0.),
        (Vec2::new(280., 850.), Vec2::new(-1., 0.), f32::INFINITY),
        (Vec2::new(280., 633.), Vec2::new(1., 0.), f32::INFINITY),
    ] {
        let entry = crate::math::projectile_entry(p, dir, foot, BOSS_BODY_RADIUS, BOSS_HURT_HEIGHT);
        assert!(
            entry == expected || (entry - expected).abs() < 0.001,
            "{entry} != {expected}"
        );
    }
}

#[test]
fn seeded_wave_formations_keep_composition_and_hero_clearance() {
    let mut opening = Vec::new();
    for seed in 1..=20 {
        for entry in 0..crate::stage_script::mini_waves(1) as usize {
            let mut s = Sim::new(SimConfig {
                seed,
                ..Default::default()
            });
            s.director.entry = entry;
            s.director.clear_age = 6.5;
            for a in &mut s.combat.actors {
                a.view.pos.y = 1000.;
            }
            for _ in 0..40 {
                s.direct();
            }
            let markers: Vec<_> = s
                .combat
                .hazards
                .iter()
                .filter(|h| h.spawn_kind.is_some())
                .collect();
            assert!(!markers.is_empty());
            for h in &markers {
                let p = h.view.origin;
                assert_eq!(p, crate::math::floor_point(p, BODY_RADIUS));
                assert!(s
                    .combat
                    .actors
                    .iter()
                    .all(|a| p.distance(a.view.pos) >= 35. + a.view.radius));
            }
            if entry == 0 {
                opening.push(markers[0].view.origin);
            }
            let wave = &crate::stage_script::script(s.stage.tier)[entry];
            assert_eq!(markers.len(), wave.subwaves[0].spawns.len());
            for (marker, spawn) in markers.iter().zip(wave.subwaves[0].spawns) {
                assert_eq!(marker.spawn_kind, Some(spawn.archetype));
                assert_eq!(marker.phase_age, -spawn.delay_s);
            }
        }
    }
    assert!(
        opening.windows(2).all(|p| p[0] == p[1]),
        "authored opening is seed-independent"
    );
}

#[test]
fn variety_state_changes_hash() {
    let mut s = Sim::new(SimConfig::default());
    let hash = s.state_hash();
    s.director.wave_origin.x += 1.;
    assert_ne!(hash, s.state_hash());
    let hash = s.state_hash();
    s.combat.actors[0].formation_offset.x += 1.;
    assert_ne!(hash, s.state_hash());
}

#[test]
#[ignore = "matched round-14 measurement; emits evidence only"]
fn round14_measurements() {
    let mut kills: [Vec<Vec2>; 18] = core::array::from_fn(|_| Vec::new());
    let (mut contacts, mut past, mut intercepted, mut censored) = (0, 0, 0, 0);
    let (mut miss_distances, mut miss_movement) = (Vec::new(), Vec::new());
    let mut taller_catches = [0; 2];
    for seed in 1..=20 {
        let mut s = Sim::new(SimConfig {
            seed,
            ..Default::default()
        });
        let mut seen = [false; 18];
        let mut wave = 0;
        if seed <= 10 {
            FLIGHTS.with_borrow_mut(|log| *log = Some(Flights::default()));
        }
        for step in 0..900 * 30 {
            let tier = s.stage.tier;
            let positions: Vec<_> = s
                .combat
                .actors
                .iter()
                .map(|a| (a.view.id, a.view.pos))
                .collect();
            s.step();
            let events = s.drain_events();
            for e in &events {
                match *e {
                    Event::WaveIncoming { mini_wave, .. } => {
                        wave = (tier as usize - 1) * 6 + mini_wave as usize - 1
                    }
                    Event::Died { id }
                        if s.stage.wave <= 3
                            && wave < 18
                            && !seen[wave]
                            && s.director.boss.is_none() =>
                    {
                        if let Some((_, p)) = positions.iter().find(|(a, _)| *a == id) {
                            kills[wave].push(*p);
                            seen[wave] = true;
                        }
                    }
                    _ => {}
                }
            }
            if seed <= 10 && step + 1 == 600 * 30 {
                flight_retired(&s);
                let log = FLIGHTS.with_borrow_mut(|log| log.take().unwrap());
                contacts += log.body;
                past += log.past;
                intercepted += log.intercepted;
                censored += log.censored + log.pending.len();
                miss_distances.extend(log.miss_distances);
                miss_movement.extend(log.miss_movement);
                for i in 0..2 {
                    taller_catches[i] += log.taller_catches[i];
                }
            }
        }
    }
    println!("Boss flights: body {contacts}, fly-past {past}, intercepted {intercepted}, censored {censored}; fly-past {:.2}% of resolved", 100. * past as f32 / (contacts + past + intercepted) as f32);
    println!("Flights: seeds 1-10 x 600 s; every boss-targeted hero projectile at launch. Swept body entry counts before evade; other bodies intercept; live-boss expiry/boundary exits fly past; target death, scene clears and in-flight at timeout are censored. Test-only taps compile out of production.");
    println!("Counterfactual same-path catches among fly-past shots: height 330={} / {past}; height 360={} / {past}. Later combat trajectories are held fixed for this diagnostic.", taller_catches[0], taller_catches[1]);
    miss_distances.sort_by(f32::total_cmp);
    miss_movement.sort_by(f32::total_cmp);
    if !miss_distances.is_empty() {
        println!("Fly-past closest spine distance: min {:.2}, median {:.2} u (capsule radius {BOSS_BODY_RADIUS}); boss displacement from launch at closest approach median {:.2} u", miss_distances[0], miss_distances[miss_distances.len()/2], miss_movement[miss_movement.len()/2]);
    }
    let mut all_sum = 0.;
    let mut all_n = 0;
    for (w, points) in kills.iter().enumerate() {
        let mut sum = 0.;
        let mut n = 0;
        for (i, a) in points.iter().enumerate() {
            for b in &points[i + 1..] {
                sum += a.distance(*b);
                n += 1;
            }
        }
        println!(
            "T{} W{}: n={} first-kill pairwise mean {:.2} u",
            w / 6 + 1,
            w % 6 + 1,
            points.len(),
            sum / n.max(1) as f32
        );
        all_sum += sum;
        all_n += n;
    }
    println!(
        "Pooled first-kill pairwise mean {:.2} u; seeds 1-20 x 900 s, first cycle only",
        all_sum / all_n as f32
    );
}
