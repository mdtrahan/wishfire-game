//! Owner 2026-11-05 (ORKA-63bf.47): on the real stage loop no two enemies emerge inside each
//! other, so none has to be pushed to a new place when it finishes spawning in.
use wf_combat::{ActorState, HazardKind, HazardPhase, Team};
use wf_host::progress::HeroProgressStore;
use wf_host::session::Session;
use wf_host::spawn_spacing::{moat_distance, SPAWN_SPACING};
use wf_meta::enemy::parse_c2_table;

#[test]
fn enemies_never_share_a_spawn_point_or_overlap_while_they_spawn_in() {
    let rows = parse_c2_table(&std::fs::read_to_string(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../web-runner/assets/enemies.json")).unwrap()).unwrap();
    for seed in [7, 42, 20261105] {
        let mut store = HeroProgressStore::fresh();
        store.set_level(7, 0.).unwrap();
        let mut s = Session::new(seed, rows.clone(), store, &[("Falie", "falie#1"), ("Huun", "huun#1"), ("Runa", "runa#1"), ("Kojonn", "kojonn#1")], "spawn", 90, Box::new(|_| true), Box::new(|_, _| {}));
        // The body moat's own distance: what `separate_bodies` would enforce by pushing.
        let touching = SPAWN_SPACING - 1. - 0.01;
        let (mut spawned, mut markers_seen, mut closest) = (0u32, 0u32, f32::MAX);
        let mut shifted: Vec<String> = Vec::new();
        for n in 0..9000 {
            s.tick(n as f64 * 1000. / 30.);
            assert!(s.failed.is_none(), "seed {seed}: {:?}", s.failed);
            for (before, after) in std::mem::take(&mut s.step_observations) {
                let pos = |a: &wf_combat::ActorView| (a.pos.x, a.pos.y);
                // Every place an enemy is about to emerge or is emerging right now.
                let mut places: Vec<(f32, f32)> = after.hazards.iter().filter(|h| h.kind == HazardKind::SpawnMarker && h.phase != HazardPhase::Resolved).map(|h| (h.origin.x, h.origin.y)).collect();
                markers_seen = markers_seen.max(places.len() as u32);
                places.extend(after.actors.iter().filter(|a| a.team == Team::Enemy && a.state == ActorState::Spawn).map(pos));
                for (i, a) in places.iter().enumerate() {
                    for b in &places[i + 1..] {
                        let gap = moat_distance(*a, *b);
                        closest = closest.min(gap);
                        assert!(gap >= touching, "seed {seed} step {}: two spawn places {gap} apart at {a:?} and {b:?}", after.step);
                    }
                }
                // The step an enemy finishes spawning in: no other enemy that spawned with it
                // overlaps it, so the body moat has nothing to push apart.
                for a in after.actors.iter().filter(|a| a.team == Team::Enemy && a.state != ActorState::Spawn) {
                    let Some(was) = before.actors.iter().find(|b| b.id == a.id && b.state == ActorState::Spawn) else { continue };
                    spawned += 1;
                    // A hero's push (Bubble Pop, Ground Pound) may land on it in that very step;
                    // that is combat, not the spawn.
                    let pushed = after.hazards.iter().chain(&before.hazards).any(|h| matches!(h.kind, HazardKind::BubblePop | HazardKind::GroundPound) && h.phase == HazardPhase::Resolved);
                    if pushed || matches!(a.state, ActorState::Dead | ActorState::Hurt) { continue; }
                    let shift = moat_distance(pos(was), pos(a));
                    if shift >= 6. {
                        shifted.push(format!("step {} {:?} shifted {shift:.1}; nearest {:?}", after.step, a.archetype,
                            before.actors.iter().filter(|b| b.id != a.id).map(|b| (moat_distance(pos(was), pos(b)), b.archetype, b.state, b.team)).min_by(|x, y| x.0.total_cmp(&y.0))));
                    }
                    for other in before.actors.iter().filter(|b| b.team == Team::Enemy && b.id != a.id && b.state == ActorState::Spawn) {
                        assert!(moat_distance(pos(was), pos(other)) >= touching, "seed {seed}: joined combat inside enemy {}", other.id);
                    }
                }
            }
        }
        println!("seed {seed}: {} of {spawned} shifted as they joined: {:#?}", shifted.len(), shifted.iter().take(6).collect::<Vec<_>>());
        assert!(shifted.is_empty(), "seed {seed}: enemies pushed off their spot as they joined combat");
        assert!(spawned >= 60, "seed {seed}: plenty of enemies spawned in ({spawned})");
        println!("seed {seed}: {spawned} enemies spawned in, up to {markers_seen} markers at once, closest pair {closest:.1} apart, {} planned points were spread", s.spawn_points_spread);
        assert!(s.spawn_points_spread > 0, "seed {seed}: the stage plan did hand out overlapping points");
    }
}
