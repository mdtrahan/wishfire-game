//! Spawn points never overlap (owner 2026-11-05, ORKA-63bf.47). The stage plan's seeded pack
//! positions are squeezed and clamped onto the slice floor, so two enemies of a batch could be
//! given the same point or points closer than their bodies. They then emerged inside each
//! other, stood still while spawning (a spawning enemy cannot be moved), and were pushed apart
//! by the body moat the moment they joined combat: one portal that split in two.
//! Before a batch is sent to combat its points are spread so every pair keeps the moat's own
//! distance, also against markers still counting down and enemies still spawning. Nothing has
//! to move afterwards; once an enemy has spawned in it moves freely as before.
use wf_combat::tuning::{ACTOR_MOAT, ACTOR_MOAT_DEPTH, BODY_RADIUS};

/// Centre distance two ordinary enemies keep (the moat's metric: depth counts 1/1.4), plus a
/// unit of slack so rounding never leaves them touching.
pub const SPAWN_SPACING: f32 = 2. * (BODY_RADIUS + ACTOR_MOAT) + 1.;
const RINGS: usize = 14;
const RING_STEP: f32 = SPAWN_SPACING / 2.;
const ANGLES: usize = 16;

/// Distance in the body moat's metric (an ellipse stretched in depth).
pub fn moat_distance(a: (f32, f32), b: (f32, f32)) -> f32 {
    let (dx, dy) = (b.0 - a.0, (b.1 - a.1) / ACTOR_MOAT_DEPTH);
    (dx * dx + dy * dy).sqrt()
}
/// Moves the points that stand too close to an earlier point of the batch or to an `occupied`
/// point, each to the nearest free place around where it was planned (rings outward, a fixed
/// order of directions, so the result is deterministic). `valid` says whether a point is a legal
/// spawn point; a point that is not valid to begin with is left alone and not spaced against.
/// Returns how many points moved; a point with no free place within reach keeps its plan.
pub fn spread(points: &mut [(f32, f32)], occupied: &[(f32, f32)], valid: &dyn Fn((f32, f32)) -> bool) -> usize {
    let mut taken: Vec<(f32, f32)> = occupied.to_vec();
    let mut moved = 0;
    for point in points.iter_mut() {
        if !valid(*point) { continue; }
        let free = |p: (f32, f32), taken: &[(f32, f32)]| taken.iter().all(|t| moat_distance(p, *t) >= SPAWN_SPACING);
        if !free(*point, &taken) {
            let found = (1..=RINGS).find_map(|ring| {
                let reach = RING_STEP * ring as f32;
                (0..ANGLES).find_map(|k| {
                    let angle = k as f32 / ANGLES as f32 * std::f32::consts::TAU;
                    let candidate = (point.0 + angle.cos() * reach, point.1 + angle.sin() * reach * ACTOR_MOAT_DEPTH);
                    (valid(candidate) && free(candidate, &taken)).then_some(candidate)
                })
            });
            if let Some(place) = found { *point = place; moved += 1; }
        }
        taken.push(*point);
    }
    moved
}

/// `spread` over a batch of combat inputs. A legal point is one the stage's own clamp leaves
/// where it is (`clamp_slice_spawn` for an ordinary enemy); a boss's place is never touched.
pub fn spread_inputs(enemies: &mut [simulation_core::combat_abi::EnemyInput], occupied: &[(f32, f32)]) -> usize {
    use wf_meta::geometry::{clamp_slice_spawn, Point};
    let legal = |p: (f32, f32)| { let q = clamp_slice_spawn(Point { x: p.0 as f64, y: p.1 as f64 }, false); q.x as f32 == p.0 && q.y as f32 == p.1 };
    let mut points: Vec<(f32, f32)> = enemies.iter().map(|e| (e.position.x, e.position.y)).collect();
    let moved = spread(&mut points, occupied, &legal);
    for (enemy, point) in enemies.iter_mut().zip(points) { enemy.position.x = point.0; enemy.position.y = point.1; }
    moved
}

#[cfg(test)]
mod tests {
    use super::*;
    fn floor(p: (f32, f32)) -> bool { (100. ..=600.).contains(&p.0) && (200. ..=500.).contains(&p.1) }
    fn all_apart(points: &[(f32, f32)]) -> bool {
        points.iter().enumerate().all(|(i, a)| points[i + 1..].iter().all(|b| moat_distance(*a, *b) >= SPAWN_SPACING))
    }
    #[test]
    fn enemies_given_the_same_or_overlapping_points_are_spread_before_they_spawn() {
        assert_eq!(SPAWN_SPACING, 45.);
        // Four on one point, one touching them, one well clear.
        let planned = [(300., 300.), (300., 300.), (300., 300.), (300., 300.), (320., 310.), (480., 420.)];
        let mut points = planned;
        let moved = spread(&mut points, &[], &floor);
        assert_eq!(moved, 4, "the first keeps its point, the clear one is untouched");
        assert_eq!((points[0], points[5]), (planned[0], planned[5]));
        assert!(all_apart(&points), "{points:?}");
        assert!(points.iter().all(|p| floor(*p)));
        // Each moved point went to the nearest free place, never across the floor.
        for (now, before) in points.iter().zip(&planned) { assert!(moat_distance(*now, *before) <= SPAWN_SPACING * 2., "{before:?} -> {now:?}"); }
        // Deterministic.
        let mut again = planned;
        spread(&mut again, &[], &floor);
        assert_eq!(again, points);
        // Already apart: nothing moves.
        let mut clear = [(200., 300.), (260., 300.), (200., 380.)];
        assert_eq!(spread(&mut clear, &[], &floor), 0);
        assert_eq!(clear, [(200., 300.), (260., 300.), (200., 380.)]);
    }
    #[test]
    fn a_new_batch_keeps_clear_of_markers_and_enemies_that_are_still_spawning() {
        let waiting = [(300., 300.), (345., 300.)];
        let mut points = [(300., 300.), (322., 300.)];
        assert_eq!(spread(&mut points, &waiting, &floor), 2);
        let mut everyone = waiting.to_vec();
        everyone.extend(points);
        assert!(all_apart(&everyone), "{everyone:?}");
    }
    #[test]
    fn points_squeezed_into_a_corner_spread_along_the_floor_and_stay_on_it() {
        // Twelve clamped onto the floor's corner, as the squeezed plan can do.
        let mut points = [(100., 200.); 12];
        assert_eq!(spread(&mut points, &[], &floor), 11);
        assert!(all_apart(&points) && points.iter().all(|p| floor(*p)), "{points:?}");
        // A point that is not a legal spawn point (a boss's own place) is left alone.
        let mut odd = [(50., 50.), (50., 50.)];
        assert_eq!(spread(&mut odd, &[], &floor), 0);
        assert_eq!(odd, [(50., 50.), (50., 50.)]);
    }
}
