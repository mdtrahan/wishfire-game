use super::*;
use crate::tuning::*;
#[derive(Default)]
pub struct Flights {
    pub pending: std::collections::BTreeMap<u32, Flight>,
    pub body: usize,
    pub past: usize,
    pub intercepted: usize,
    pub censored: usize,
    pub miss_distances: Vec<f32>,
    pub miss_movement: Vec<f32>,
    pub taller_catches: [usize; 2],
}
pub struct Flight {
    pub boss: u32,
    pub launch_foot: Vec2,
    pub closest: f32,
    pub moved_at_closest: f32,
    pub taller_contact: [bool; 2],
}
fn on_segment(p: Vec2, a: Vec2, b: Vec2) -> Vec2 {
    let d = b - a;
    a + d * ((p - a).dot(d) / d.dot(d).max(0.000001)).clamp(0., 1.)
}
std::thread_local! {
    pub static FLIGHTS: std::cell::RefCell<Option<Flights>> = const { std::cell::RefCell::new(None) };
}
// Test-only taps count launch-step contacts as well as later swept entries.
pub fn flight_launched(s: &Sim, p: &crate::combat::Projectile) {
    FLIGHTS.with_borrow_mut(|log| {
        if let Some(log) = log {
            if p.view.team == Team::Hero && p.fuse_hazard.is_none() {
                if let Some(boss) = p.target.filter(|id| {
                    s.actor_index(*id)
                        .is_some_and(|i| is_boss(s.actors[i].view.archetype))
                }) {
                    let foot = s.actors[s.actor_index(boss).unwrap()].view.pos;
                    let f = log.pending.entry(p.view.id).or_insert(Flight {
                        boss,
                        launch_foot: foot,
                        closest: f32::INFINITY,
                        moved_at_closest: 0.,
                        taller_contact: [false; 2],
                    });
                    let top = foot - Vec2::new(0., BOSS_HURT_HEIGHT);
                    let end = p.view.pos + p.view.dir * (p.speed * SIM_DT);
                    for (i, height) in [330., 360.].into_iter().enumerate() {
                        f.taller_contact[i] |= crate::math::projectile_entry(
                            p.view.pos,
                            p.view.dir,
                            foot,
                            BOSS_BODY_RADIUS,
                            height,
                        ) <= p.speed * SIM_DT;
                    }
                    let gap = [
                        p.view.pos.distance(on_segment(p.view.pos, foot, top)),
                        end.distance(on_segment(end, foot, top)),
                        foot.distance(on_segment(foot, p.view.pos, end)),
                        top.distance(on_segment(top, p.view.pos, end)),
                    ]
                    .into_iter()
                    .fold(f32::INFINITY, f32::min);
                    if gap < f.closest {
                        f.closest = gap;
                        f.moved_at_closest = foot.distance(f.launch_foot);
                    }
                }
            }
        }
    });
}
pub fn flight_contact(id: u32, target: u32) {
    FLIGHTS.with_borrow_mut(|log| {
        if let Some(log) = log {
            if let Some(f) = log.pending.remove(&id) {
                if f.boss == target {
                    log.body += 1;
                } else {
                    log.intercepted += 1;
                }
            }
        }
    });
}
pub fn flight_retired(s: &Sim) {
    FLIGHTS.with_borrow_mut(|log| {
        if let Some(log) = log {
            log.pending.retain(|id, f| {
                if let Some(p) = s.projectiles.iter().find(|p| p.view.id == *id) {
                    if p.age < PROJECTILE_LIFETIME
                        && p.view.pos.x >= ARENA_MIN.x - PROJECTILE_MARGIN
                        && p.view.pos.x <= ARENA_MAX.x + PROJECTILE_MARGIN
                        && p.view.pos.y >= ARENA_MIN.y - PROJECTILE_MARGIN
                        && p.view.pos.y <= ARENA_MAX.y + PROJECTILE_MARGIN
                    {
                        return true;
                    }
                    if s.actor_index(f.boss).is_some_and(|i| s.actors[i].alive()) {
                        log.past += 1;
                        log.miss_distances.push(f.closest);
                        log.miss_movement.push(f.moved_at_closest);
                        for i in 0..2 {
                            log.taller_catches[i] += usize::from(f.taller_contact[i]);
                        }
                    } else {
                        log.censored += 1;
                    }
                } else {
                    log.censored += 1;
                }
                false
            });
        }
    });
}
