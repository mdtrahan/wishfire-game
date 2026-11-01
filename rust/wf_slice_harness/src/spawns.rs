//! Authored offsets with deterministic floor containment and hero clearance.
use crate::{
    math::direction,
    stage_script::{Spawn, MAX_SPAWNS},
    tuning::*,
    Vec2,
};

pub(crate) fn seeded_points(
    spawns: &[Spawn],
    anchor: Vec2,
    party: Vec2,
    forward: Vec2,
    arena_min: Vec2,
    arena_max: Vec2,
    heroes: &[(Vec2, f32)],
    rng: &mut crate::rng::Rng,
) -> [Option<Vec2>; MAX_SPAWNS] {
    let layout = crate::formations::Layout::seeded(rng);
    let raw = layout.points(spawns.len(), anchor, forward, arena_min, arena_max, heroes);
    let mut slots: [usize; MAX_SPAWNS] = core::array::from_fn(|i| i);
    let mut units = slots;
    slots[..spawns.len()].sort_unstable_by(|a, b| {
        raw[*a]
            .distance(party)
            .total_cmp(&raw[*b].distance(party))
            .then(a.cmp(b))
    });
    units[..spawns.len()].sort_unstable_by_key(|i| (role(spawns[*i].archetype), *i));
    let mut placed = [Spawn {
        archetype: crate::Archetype::Gobloc,
        offset: Vec2::default(),
        delay_s: 0.,
    }; MAX_SPAWNS];
    for (unit, slot) in units[..spawns.len()].iter().zip(&slots[..spawns.len()]) {
        placed[*unit] = spawns[*unit];
        placed[*unit].offset = raw[*slot] - anchor;
    }
    points(
        &placed[..spawns.len()],
        anchor,
        arena_min,
        arena_max,
        heroes,
    )
}

fn role(kind: crate::Archetype) -> u8 {
    use crate::Archetype::*;
    match kind {
        Boss | BossBomber | BossMarksman | HighOrc => 0,
        Orc => 1,
        Bastorto => 2,
        Gobloc => 3,
        Gloamink => 4,
        Fizzmite => 5,
        _ => 6,
    }
}

pub(crate) fn points(
    spawns: &[Spawn],
    anchor: Vec2,
    arena_min: Vec2,
    arena_max: Vec2,
    heroes: &[(Vec2, f32)],
) -> [Option<Vec2>; MAX_SPAWNS] {
    assert!(spawns.len() <= MAX_SPAWNS);
    let mut points = [None; MAX_SPAWNS];
    for (i, spawn) in spawns.iter().enumerate() {
        let radius = if is_boss(spawn.archetype) {
            BOSS_BODY_RADIUS
        } else {
            SPAWN_MARKER_RADIUS
        };
        let pad = Vec2::new(radius, radius);
        let lo = arena_min + pad;
        let hi = arena_max - pad - Vec2::new(0.001, 0.001);
        points[i] = clear_point(
            (anchor + spawn.offset).clamp(lo, hi),
            anchor,
            lo,
            hi,
            radius,
            hero_buffer(spawn.archetype),
            heroes,
            &points[..i],
        );
    }
    points
}

/// Owner (2026-10-26): spawns keep a role buffer from every hero so the party has to move.
/// Ranged units always appear far away; bosses keep their direct entrance spot.
pub(crate) fn hero_buffer(kind: crate::Archetype) -> f32 {
    use crate::Archetype::*;
    match kind {
        Sniper | Lizardo | Mirewing | Marid => SPAWN_RANGED_BUFFER,
        Boss | BossBomber | BossMarksman => 0.,
        _ => SPAWN_MELEE_BUFFER,
    }
}

fn clear_point(
    desired: Vec2,
    party: Vec2,
    lo: Vec2,
    hi: Vec2,
    radius: f32,
    buffer: f32,
    heroes: &[(Vec2, f32)],
    previous: &[Option<Vec2>],
) -> Option<Vec2> {
    let spot_gap = BODY_RADIUS * 2. + SPAWN_CLEARANCE;
    let hero_gap = |body: f32| (radius + body + SPAWN_CLEARANCE).max(buffer);
    let valid = |p: Vec2| {
        heroes
            .iter()
            .all(|(h, body)| p.distance(*h) + 0.001 >= hero_gap(*body))
            && previous
                .iter()
                .flatten()
                .all(|q| p.distance(*q) + 0.001 >= spot_gap)
    };
    let mut p = desired;
    for _ in 0..8 {
        if valid(p) {
            return Some(p);
        }
        for (h, body) in heroes {
            let gap = hero_gap(*body);
            if p.distance(*h) < gap {
                let away = if p.distance(*h) > 0.001 {
                    p - *h
                } else {
                    desired - party
                };
                p = (*h + away.normalized() * gap).clamp(lo, hi);
            }
        }
        for q in previous.iter().flatten() {
            if p.distance(*q) < spot_gap {
                p = (*q + (p - *q).normalized() * spot_gap).clamp(lo, hi);
            }
        }
    }
    // Blocked authored spots move outward first. Unplaced members remain queued.
    let angle = libm::atan2f(desired.y - party.y, desired.x - party.x);
    for ring in 1..=16 {
        for ray in 0..16 {
            let p = (desired
                + direction(angle + TAU * ray as f32 / 16.) * (spot_gap * ring as f32))
                .clamp(lo, hi);
            if valid(p) {
                return Some(p);
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
                return Some(p);
            }
            x += spot_gap;
        }
        y += spot_gap;
    }
    // Include the inset walls and corners that the grid's final stride can miss.
    let mut x = lo.x;
    loop {
        for y in [lo.y, hi.y] {
            let p = Vec2::new(x, y);
            if valid(p) {
                return Some(p);
            }
        }
        if x == hi.x {
            break;
        }
        x = (x + spot_gap).min(hi.x);
    }
    let mut y = lo.y;
    loop {
        for x in [lo.x, hi.x] {
            let p = Vec2::new(x, y);
            if valid(p) {
                return Some(p);
            }
        }
        if y == hi.y {
            break;
        }
        y = (y + spot_gap).min(hi.y);
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn boundary_candidate_finds_the_wall_sliver_missed_by_the_grid() {
        // Seed 4 with 1.25x boss HP, stage 2 / wave 5 / subwave 2, last Mirewing.
        let heroes = [
            (Vec2::new(358.76025, 752.1671), BODY_RADIUS),
            (Vec2::new(417.11206, 486.29208), BODY_RADIUS),
            (Vec2::new(421.8571, 1060.7667), BODY_RADIUS),
            (Vec2::new(397.0896, 1009.85266), BODY_RADIUS),
        ];
        let previous = [
            Some(Vec2::new(729.6588, 554.95435)),
            Some(Vec2::new(131., 1240.3634)),
            Some(Vec2::new(719.0683, 942.16864)),
            Some(Vec2::new(150.79208, 281.25375)),
            Some(Vec2::new(811., 1537.)),
        ];
        let p = clear_point(
            Vec2::new(597.96246, 793.8823),
            Vec2::new(398.70474, 827.26965),
            ARENA_MIN + Vec2::new(SPAWN_MARKER_RADIUS, SPAWN_MARKER_RADIUS),
            ARENA_MAX - Vec2::new(SPAWN_MARKER_RADIUS + 0.001, SPAWN_MARKER_RADIUS + 0.001),
            SPAWN_MARKER_RADIUS,
            SPAWN_RANGED_BUFFER,
            &heroes,
            &previous,
        )
        .unwrap();
        assert!(p.distance(Vec2::new(777., 1556.999)) < 0.001, "{p:?}");
        assert!(heroes
            .iter()
            .all(|(h, _)| p.distance(*h) >= SPAWN_RANGED_BUFFER));
    }
}
