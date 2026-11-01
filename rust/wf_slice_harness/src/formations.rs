//! Party-relative spawn geometry; arena dimensions and facing are caller-owned.
use crate::{math::direction, rng::Rng, tuning::*, Vec2};

pub(crate) const CAPACITY: usize = 32;

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) enum Formation {
    Ring,
    Grid,
    RowsAhead,
    RowsBehind,
    Pincer,
    Chevron,
    Line,
}

impl Formation {
    pub const ALL: [Self; 7] = [
        Self::Ring,
        Self::Grid,
        Self::RowsAhead,
        Self::RowsBehind,
        Self::Pincer,
        Self::Chevron,
        Self::Line,
    ];
}

pub(crate) struct Layout {
    pub kind: Formation,
    pub radius: f32,
    pub behind: bool,
    pub angle: f32,
}

impl Layout {
    pub fn seeded(rng: &mut Rng) -> Self {
        Self {
            kind: Formation::ALL[(rng.unit() * Formation::ALL.len() as f32) as usize],
            radius: rng.range(FORMATION_RADIUS_MIN, FORMATION_RADIUS_MAX),
            behind: rng.chance(0.5),
            angle: rng.range(0., TAU),
        }
    }

    pub fn points(
        &self,
        count: usize,
        party: Vec2,
        forward: Vec2,
        arena_min: Vec2,
        arena_max: Vec2,
        heroes: &[(Vec2, f32)],
    ) -> [Vec2; CAPACITY] {
        assert!(count > 0 && count <= CAPACITY);
        let pad = Vec2::new(SPAWN_MARKER_RADIUS, SPAWN_MARKER_RADIUS);
        let lo = arena_min + pad;
        let hi = arena_max - pad - Vec2::new(0.001, 0.001);
        let forward = forward.normalized();
        let right = Vec2::new(-forward.y, forward.x);
        let sign = if self.behind { -1. } else { 1. };
        let size = hi - lo;
        let span = (size.x / right.x.abs().max(0.00001)).min(size.y / right.y.abs().max(0.00001));
        let mut points = [Vec2::default(); CAPACITY];
        let mut min = Vec2::new(f32::INFINITY, f32::INFINITY);
        let mut max = Vec2::new(f32::NEG_INFINITY, f32::NEG_INFINITY);
        for (i, p) in points[..count].iter_mut().enumerate() {
            let fraction = if count > 1 {
                i as f32 / (count - 1) as f32
            } else {
                0.5
            };
            let local = match self.kind {
                Formation::Ring => {
                    direction(self.angle + TAU * i as f32 / count as f32) * self.radius
                }
                Formation::Grid => {
                    let cols = (libm::ceilf(libm::sqrtf(count as f32)) as usize).min(3);
                    let rows = count.div_ceil(cols);
                    let row = i / cols;
                    let row_count = cols.min(count - row * cols);
                    Vec2::new(
                        (i % cols) as f32 - (row_count - 1) as f32 * 0.5,
                        row as f32 - (rows - 1) as f32 * 0.5,
                    ) * FORMATION_SPACING
                }
                Formation::RowsAhead | Formation::RowsBehind => {
                    let rows = if count > 6 { 3 } else { count.min(2) };
                    let row = i % rows;
                    let cols = (count - row).div_ceil(rows);
                    let side = ((i / rows) as f32 - (cols - 1) as f32 * 0.5
                        + if row % 2 == 0 { -0.15 } else { 0.15 })
                        * FORMATION_SPACING;
                    let ahead = self.radius + row as f32 * FORMATION_SPACING * 0.8;
                    Vec2::new(
                        side,
                        ahead
                            * if self.kind == Formation::RowsBehind {
                                -1.
                            } else {
                                1.
                            },
                    )
                }
                Formation::Pincer => {
                    let left = count.div_ceil(2);
                    let (row, rows, side) = if i < left {
                        (i, left, -1.)
                    } else {
                        (i - left, count - left, 1.)
                    };
                    Vec2::new(
                        side * self.radius,
                        (row as f32 - (rows - 1) as f32 * 0.5) * FORMATION_SPACING,
                    )
                }
                Formation::Chevron => {
                    let side = (fraction - 0.5) * (count - 1) as f32 * FORMATION_SPACING;
                    Vec2::new(
                        side,
                        (self.radius
                            + ((count - 1) as f32 * FORMATION_SPACING * 0.5 - side.abs()) * 0.45)
                            * sign,
                    )
                }
                Formation::Line => Vec2::new((fraction - 0.5) * span, self.radius * sign),
            };
            *p = right * local.x + forward * local.y;
            min = Vec2::new(min.x.min(p.x), min.y.min(p.y));
            max = Vec2::new(max.x.max(p.x), max.y.max(p.y));
        }
        // Fit the whole pattern uniformly instead of collapsing edge spots onto a wall.
        let extent = max - min;
        let scale = 1f32
            .min(size.x / extent.x.max(0.00001))
            .min(size.y / extent.y.max(0.00001));
        let anchor = Vec2::new(
            party.x.max(lo.x - min.x * scale).min(hi.x - max.x * scale),
            party.y.max(lo.y - min.y * scale).min(hi.y - max.y * scale),
        );
        for i in 0..count {
            let desired = (anchor + points[i] * scale).clamp(lo, hi);
            points[i] = clear_point(desired, party, lo, hi, heroes, &points[..i]);
        }
        points
    }
}

fn clear_point(
    desired: Vec2,
    party: Vec2,
    lo: Vec2,
    hi: Vec2,
    heroes: &[(Vec2, f32)],
    previous: &[Vec2],
) -> Vec2 {
    let spot_gap = BODY_RADIUS * 2. + SPAWN_CLEARANCE;
    let valid = |p: Vec2| {
        heroes
            .iter()
            .all(|(h, body)| p.distance(*h) + 0.001 >= SPAWN_MARKER_RADIUS + body + SPAWN_CLEARANCE)
            && previous.iter().all(|q| p.distance(*q) + 0.001 >= spot_gap)
    };
    let mut p = desired;
    for _ in 0..8 {
        if valid(p) {
            return p;
        }
        for (h, body) in heroes {
            let gap = SPAWN_MARKER_RADIUS + body + SPAWN_CLEARANCE;
            if p.distance(*h) < gap {
                let away = if p.distance(*h) > 0.001 {
                    p - *h
                } else {
                    desired - party
                };
                p = (*h + away.normalized() * gap).clamp(lo, hi);
            }
        }
        for q in previous {
            if p.distance(*q) < spot_gap {
                p = (*q + (p - *q).normalized() * spot_gap).clamp(lo, hi);
            }
        }
    }
    // Blocked ring/grid cells move outward first; never omit a member of the wave.
    let angle = libm::atan2f(desired.y - party.y, desired.x - party.x);
    for ring in 1..=16 {
        for ray in 0..16 {
            let p = (desired
                + direction(angle + TAU * ray as f32 / 16.) * (spot_gap * ring as f32))
                .clamp(lo, hi);
            if valid(p) {
                return p;
            }
        }
    }
    // A floor-wide grid also handles corners with several overlapping heroes.
    let mut y = lo.y;
    while y <= hi.y {
        let mut x = lo.x;
        while x <= hi.x {
            let p = Vec2::new(x, y);
            if valid(p) {
                return p;
            }
            x += spot_gap;
        }
        y += spot_gap;
    }
    panic!("arena cannot fit the requested spawn formation with hero clearance");
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{stage_script::script, *};

    fn layout(kind: Formation) -> Layout {
        Layout {
            kind,
            radius: 195.,
            behind: false,
            angle: 0.,
        }
    }

    #[test]
    fn every_formation_fits_all_members_with_clearance_on_tall_and_wide_floors() {
        for size in [Vec2::new(900., 2200.), Vec2::new(2400., 900.)] {
            let min = Vec2::new(20., 30.);
            let max = min + size;
            for party in [
                min + size * 0.5,
                min + Vec2::new(25., 25.),
                max - Vec2::new(25., 25.),
            ] {
                let heroes = TRAVEL_SLOTS.map(|p| {
                    (
                        (party + p * 0.3)
                            .clamp(min + Vec2::new(18., 18.), max - Vec2::new(18., 18.)),
                        18.,
                    )
                });
                for forward in [Vec2::new(0., -1.), Vec2::new(1., 0.), Vec2::new(1., 1.)] {
                    for kind in Formation::ALL {
                        for count in 1..=CAPACITY {
                            let points =
                                layout(kind).points(count, party, forward, min, max, &heroes);
                            for (i, p) in points[..count].iter().enumerate() {
                                assert!(
                                    p.x >= min.x + SPAWN_MARKER_RADIUS
                                        && p.x <= max.x - SPAWN_MARKER_RADIUS
                                );
                                assert!(
                                    p.y >= min.y + SPAWN_MARKER_RADIUS
                                        && p.y <= max.y - SPAWN_MARKER_RADIUS
                                );
                                for (h, body) in heroes {
                                    assert!(
                                        p.distance(h) + 0.001
                                            >= SPAWN_MARKER_RADIUS + body + SPAWN_CLEARANCE,
                                        "{kind:?}, count={count}, point={p:?}, hero={h:?}"
                                    );
                                }
                                for q in &points[..i] {
                                    assert!(
                                        p.distance(*q) + 0.001
                                            >= BODY_RADIUS * 2. + SPAWN_CLEARANCE
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    #[test]
    fn formations_keep_their_authored_shapes_and_rotate_with_the_party() {
        let min = Vec2::new(0., 0.);
        let max = Vec2::new(2200., 2200.);
        let party = max * 0.5;
        for kind in Formation::ALL {
            let up = layout(kind).points(9, party, Vec2::new(0., -1.), min, max, &[]);
            let right = layout(kind).points(9, party, Vec2::new(1., 0.), min, max, &[]);
            for (a, b) in up[..9].iter().zip(&right[..9]) {
                let q = *a - party;
                assert!((party + Vec2::new(-q.y, q.x)).distance(*b) < 0.01);
            }
            match kind {
                Formation::Ring => assert!(up[..9]
                    .iter()
                    .all(|p| (p.distance(party) - 195.).abs() < 0.01)),
                Formation::Grid => {
                    assert!(up[..9].contains(&party));
                    assert_eq!(up[0].distance(up[1]), FORMATION_SPACING);
                }
                Formation::RowsAhead => assert!(up[..9].iter().all(|p| p.y < party.y)),
                Formation::RowsBehind => assert!(up[..9].iter().all(|p| p.y > party.y)),
                Formation::Pincer => {
                    assert_eq!(up[..9].iter().filter(|p| p.x < party.x).count(), 5)
                }
                Formation::Chevron => {
                    assert!(up[4].y < up[0].y && up[4].y < up[8].y);
                    let mut behind = layout(kind);
                    behind.behind = true;
                    assert!(
                        behind.points(9, party, Vec2::new(0., -1.), min, max, &[])[..9]
                            .iter()
                            .all(|p| p.y > party.y)
                    );
                }
                Formation::Line => {
                    assert_eq!(up[0].x, SPAWN_MARKER_RADIUS);
                    assert!((up[8].x - (max.x - SPAWN_MARKER_RADIUS - 0.001)).abs() < 0.01);
                }
            }
        }
    }

    #[test]
    fn seeded_selection_covers_the_library_and_is_deterministic() {
        let mut seen = [false; 7];
        for seed in 1..=256 {
            let a = Layout::seeded(&mut Rng(seed));
            let b = Layout::seeded(&mut Rng(seed));
            seen[Formation::ALL.iter().position(|k| *k == a.kind).unwrap()] = true;
            assert_eq!(a.kind, b.kind);
            assert_eq!(a.radius, b.radius);
            assert_eq!(a.behind, b.behind);
            assert_eq!(a.angle, b.angle);
        }
        assert!(seen.into_iter().all(|v| v));
        for tier in 1..=3 {
            assert!(script(tier)
                .iter()
                .all(|wave| wave.subwaves.iter().all(|sub| sub.spawns.len() <= CAPACITY)));
        }
    }
}
