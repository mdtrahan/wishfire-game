//! Slice rewards.rs chest approach and opening, with no rewards or director.
use crate::{api::*, tuning::*, Sim};
pub const CHEST_OPEN: f32 = 0.6;
pub const CHEST_POST_OPEN: f32 = 2.;
const CHEST_HALF_WIDTH: f32 = 24.;
const CHEST_HALF_HEIGHT: f32 = 16.;
const CHEST_SIDE_GAP: f32 = 24.;
const CHEST_FRONT_GAP: f32 = 24.;
const CHEST_STAND_TOLERANCE: f32 = 2.;
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ChestState { Closed, Opening, Open }
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ChestView { pub id: u32, pub pos: Vec2, pub state: ChestState, pub state_age: f32, pub age: f32, pub reward: Option<Reward> }
impl Sim {
    pub fn drop_wave_chest(&mut self) {
        self.encounter.complete = true;
        let id = self.next_id; self.next_id += 1;
        self.chests.clear();
        self.chests.push(ChestView { id, pos: (self.floor.min + self.floor.max) * 0.5, state: ChestState::Closed, state_age: 0., age: 0., reward: None });
        self.chest_opener = None; self.chest_approach = None;
    }
    pub fn wave_chest_ready(&self) -> bool {
        self.chests.first().is_some_and(|c| c.state == ChestState::Open && c.state_age + 0.00001 >= CHEST_POST_OPEN)
    }
    pub(crate) fn update_chests(&mut self) {
        let combat_complete = !self.actors.iter().any(|a| a.view.team == Team::Enemy && a.alive());
        let Some(c) = self.chests.first_mut() else {
            return;
        };
        c.state_age += SIM_DT;
        c.age += SIM_DT;
        if c.state == ChestState::Open {
            return;
        }
        if !combat_complete {
            return;
        }
        let pos = c.pos;
        let chosen = self
            .chest_opener
            .and_then(|id| self.actor_index(id))
            .filter(|&i| self.actors[i].alive())
            .or_else(|| {
                self.actors
                    .iter()
                    .enumerate()
                    .filter(|(_, a)| a.view.team == Team::Hero && a.alive())
                    .min_by(|(_, a), (_, b)| {
                        a.view
                            .pos
                            .distance(pos)
                            .total_cmp(&b.view.pos.distance(pos))
                    })
                    .map(|(i, _)| i)
            });
        let Some(i) = chosen else {
            return;
        };
        if self.chest_opener != Some(self.actors[i].view.id)
            || !self.chest_approach.is_some_and(|(p, _)| {
                self.chest_side_clear(i, pos, p)
                    && !self.path_enters_threat(i, self.chest_waypoint(i, pos, p), None)
            })
        {
            self.chest_approach = self
                .chest_stand_point(i, pos)
                .map(|point| (point, self.actors[i].view.facing));
            if self.chests[0].state == ChestState::Opening {
                self.chests[0].state = ChestState::Closed;
                self.chests[0].state_age = 0.;
            }
            self.actors[i].ai_cd = 0.;
        }
        self.chest_opener = Some(self.actors[i].view.id);
        let Some((point, _)) = self.chest_approach else {
            return;
        };
        if self.actors[i].view.pos.distance(point) > CHEST_STAND_TOLERANCE {
            self.chests[0].state = ChestState::Closed;
            self.chests[0].state_age = 0.;
            return;
        }
        if self.chests[0].state == ChestState::Closed {
            self.chest_approach = Some((point, self.actors[i].view.facing));
        }
        self.align_chest_opener(i, pos);
        let c = &mut self.chests[0];
        if c.state == ChestState::Closed {
            c.state = ChestState::Opening;
            c.state_age = 0.;
            return;
        }
        if c.state_age + 0.00001 < CHEST_OPEN {
            return;
        }
        let c = &mut self.chests[0];
        c.state = ChestState::Open;
        c.state_age = 0.;
        for a in &mut self.actors {
            if a.view.team == Team::Hero && a.alive() { a.ai_cd = 0.; }
        }
    }
    pub(crate) fn chest_goal(&self, i: usize) -> Option<Vec2> {
        if self.party_recovering() || self.actors.iter().any(|a| a.view.team == Team::Enemy && a.alive()) {
            return None;
        }
        self.chests
            .first()
            .filter(|c| c.state != ChestState::Open)
            .map(|c| {
                if self.chest_opener == Some(self.actors[i].view.id) {
                    self.chest_approach
                        .map_or(self.actors[i].view.pos, |(point, _)| {
                            self.chest_waypoint(i, c.pos, point)
                        })
                } else {
                    self.chest_slot_point(i, c.pos)
                }
            })
    }
    fn chest_slot_point(&self, i: usize, chest: Vec2) -> Vec2 {
        let a = &self.actors[i];
        let k = crate::actors::hero_index(a.view.archetype).unwrap();
        let offset = TRAVEL_SLOTS[k];
        let edge = chest_edge(offset.normalized(), a.view.radius + 8.);
        let offset = if chest_clearance(offset, a.view.radius + 8.) < 1. {
            edge
        } else {
            offset
        };
        self.actor_floor(i).point(chest + offset, a.view.radius)
    }
    fn chest_side_clear(&self, i: usize, chest: Vec2, point: Vec2) -> bool {
        let a = &self.actors[i];
        point.y == chest.y
            && ((point.x - chest.x).abs() - (CHEST_HALF_WIDTH + a.view.radius + CHEST_SIDE_GAP))
                .abs()
                < 0.001
            && point == self.actor_floor(i).point(point, a.view.radius)
            && self.actors.iter().enumerate().all(|(j, other)| {
                let d = point - other.view.pos;
                i == j
                    || !other.alive()
                    || Vec2::new(d.x, d.y / ACTOR_MOAT_DEPTH).length()
                        >= a.view.radius + other.view.radius + 2. * ACTOR_MOAT
            })
            && !self.hazards.iter().any(|h| {
                h.view.hostile
                    && h.view.team != a.view.team
                    && h.view.phase != HazardPhase::Resolved
                    && h.hits(point, a.view.radius)
            })
    }
    fn chest_stand_point(&self, i: usize, chest: Vec2) -> Option<Vec2> {
        let a = &self.actors[i];
        let offset = Vec2::new(CHEST_HALF_WIDTH + a.view.radius + CHEST_SIDE_GAP, 0.);
        [chest - offset, chest + offset]
            .into_iter()
            .filter(|&p| {
                self.chest_side_clear(i, chest, p)
                    && !self.path_enters_threat(i, self.chest_waypoint(i, chest, p), None)
            })
            .min_by(|p, q| p.distance(a.view.pos).total_cmp(&q.distance(a.view.pos)))
    }
    fn chest_waypoint(&self, i: usize, chest: Vec2, point: Vec2) -> Vec2 {
        let a = &self.actors[i];
        let delta = point - a.view.pos;
        let steps = libm::ceilf(delta.length() / 4.).max(1.) as u32;
        if !(1..=steps).any(|n| {
            chest_clearance(
                a.view.pos + delta * (n as f32 / steps as f32) - chest,
                a.view.radius + 8.,
            ) < 1.
        }) {
            return point;
        }
        // Go around the footprint before turning inward, including a switch to the far side.
        let d = a.view.pos - chest;
        let r = chest_radii(d.y, a.view.radius + 8.);
        if d.x * (point.x - chest.x) < 0. && d.y.abs() < r.y {
            self.actor_floor(i).point(
                Vec2::new(
                    a.view.pos.x,
                    chest.y
                        + if d.y <= 0. {
                            -r.y - CHEST_SIDE_GAP
                        } else {
                            r.y + CHEST_SIDE_GAP
                        },
                ),
                a.view.radius,
            )
        } else {
            Vec2::new(point.x, a.view.pos.y)
        }
    }
    fn align_chest_opener(&mut self, i: usize, chest: Vec2) {
        let (point, _) = self.chest_approach.unwrap();
        let a = &mut self.actors[i];
        a.view.pos = point;
        a.destination = point;
        a.velocity = Vec2::default();
        if a.view.state == ActorState::Walk {
            a.state(ActorState::Idle, 0., 0.);
        }
        a.heading = (chest - point).normalized();
        a.view.facing = if point.x < chest.x {
            Facing::Right
        } else {
            Facing::Left
        };
    }
    fn chest_clear_point(&self, i: usize, chest: Vec2) -> Vec2 {
        let a = &self.actors[i];
        let delta = a.view.pos - chest;
        if chest_clearance(delta, a.view.radius) >= 1. {
            return a.view.pos;
        }
        let away = if delta.length() > 0.00001 {
            delta.normalized()
        } else {
            Vec2::new(if a.view.id % 2 == 0 { -1. } else { 1. }, 0.)
        };
        let point = chest + chest_edge(away, a.view.radius);
        if point == self.actor_floor(i).point(point, a.view.radius) {
            return point;
        }
        [
            Vec2::new(-1., 0.),
            Vec2::new(1., 0.),
            Vec2::new(0., -1.),
            Vec2::new(0., 1.),
        ]
        .into_iter()
        .map(|dir| chest + chest_edge(dir, a.view.radius))
        .filter(|&p| p == self.actor_floor(i).point(p, a.view.radius))
        .min_by(|p, q| p.distance(a.view.pos).total_cmp(&q.distance(a.view.pos)))
        .unwrap_or(a.view.pos)
    }
    pub(crate) fn constrain_chests(&mut self) {
        // The footprint blocks heroes for as long as the chest exists, the opened chest's
        // fade included: they walk around it until the host removes it (owner 2026-11-05).
        let Some(c) = self.chests.first() else {
            return;
        };
        let (pos, opening) = (c.pos, c.state == ChestState::Opening);
        for i in 0..self.actors.len() {
            if self.actors[i].view.team != Team::Hero || !self.actors[i].alive() {
                continue;
            }
            self.actors[i].view.pos = self.chest_clear_point(i, pos);
            if opening
                && self.chest_opener == Some(self.actors[i].view.id)
                && self
                    .chest_approach
                    .is_some_and(|(point, _)| self.chest_side_clear(i, pos, point))
                && !matches!(
                    self.actors[i].view.ai_intent,
                    AiIntent::Dodge | AiIntent::Retreat | AiIntent::Revive
                )
                && self.chest_approach.is_some_and(|(point, _)| {
                    self.actors[i].view.pos.distance(point) <= CHEST_STAND_TOLERANCE
                })
            {
                self.align_chest_opener(i, pos);
            }
        }
        if opening
            && !self
                .chest_opener
                .and_then(|id| self.actor_index(id))
                .is_some_and(|i| {
                    self.actors[i].alive()
                        && self.chest_approach.is_some_and(|(point, _)| {
                            self.chest_side_clear(i, pos, point)
                                && self.actors[i].view.pos.distance(point) <= CHEST_STAND_TOLERANCE
                        })
                })
        {
            self.chests[0].state = ChestState::Closed;
            self.chests[0].state_age = 0.;
        }
    }
}

/// Chest footprint: an ellipse around its base that reaches further toward the camera,
/// so a hero in front never stands on the drawn chest (owner, 2026-10-26).
fn chest_radii(dir_y: f32, radius: f32) -> Vec2 {
    let front = if dir_y > 0. { CHEST_FRONT_GAP } else { 0. };
    Vec2::new(CHEST_HALF_WIDTH + radius, CHEST_HALF_HEIGHT + front + radius)
}
/// Normalised ellipse distance; at least 1 means the hero is clear of the chest.
fn chest_clearance(delta: Vec2, radius: f32) -> f32 {
    let r = chest_radii(delta.y, radius);
    libm::sqrtf((delta.x / r.x) * (delta.x / r.x) + (delta.y / r.y) * (delta.y / r.y))
}
/// Point on the footprint edge in direction `dir`, nudged just outside.
fn chest_edge(dir: Vec2, radius: f32) -> Vec2 {
    let r = chest_radii(dir.y, radius);
    let d = libm::sqrtf((dir.x / r.x) * (dir.x / r.x) + (dir.y / r.y) * (dir.y / r.y));
    dir * (1.0001 / d.max(0.00001))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn chest_walks_to_side_times_open_and_grants_nothing() {
        let mut sim = Sim::new(SimConfig::default());
        let center = (sim.floor.min + sim.floor.max) * 0.5;
        let id = sim.spawn_actor(Archetype::Fara, center + Vec2::new(-180., 0.), HERO_STATS[0]);
        let before = sim.actors[0].view.clone();
        sim.drop_wave_chest();
        let mut opening_steps = 0;
        let mut opening_pos = Vec2::default();
        for _ in 0..1800 {
            if sim.chests[0].state == ChestState::Opening { opening_steps += 1; opening_pos = sim.actors[0].view.pos; }
            sim.step();
            if sim.chests[0].state == ChestState::Open { break; }
            assert!(!sim.wave_chest_ready());
        }
        assert_eq!(sim.chests[0].state, ChestState::Open);
        assert_eq!(opening_steps, 18);
        let actor = sim.actors.iter().find(|a| a.view.id == id).unwrap();
        assert_eq!(opening_pos.y, center.y);
        assert!((opening_pos.x-center.x).abs() >= CHEST_HALF_WIDTH + actor.view.radius + CHEST_SIDE_GAP - 0.001);
        assert_eq!(actor.view.facing, Facing::Right);
        assert_eq!(actor.view.hp, before.hp);
        assert_eq!(actor.view.max_hp, before.max_hp);
        assert_eq!(actor.stats.atk, HERO_STATS[0].atk);
        assert!(!sim.wave_chest_ready());
        // The opened chest keeps its footprint while it fades: a hero sent straight across it
        // goes around and never stands inside.
        let across = center + Vec2::new(180., 2.);
        sim.interest_points.push((id, across));
        for _ in 0..59 {
            sim.step(); assert!(!sim.wave_chest_ready());
            let a = sim.actors.iter().find(|a| a.view.id == id).unwrap();
            assert!(chest_clearance(a.view.pos - center, a.view.radius) >= 0.999, "inside the open chest at {:?}", a.view.pos);
        }
        sim.step(); assert!(sim.wave_chest_ready());
        let a = sim.actors.iter().find(|a| a.view.id == id).unwrap();
        assert!(a.view.pos.distance(opening_pos) > 20., "the hero did move: {:?}", a.view.pos);
        assert!(!sim.drain_events().iter().any(|e| matches!(e, Event::Healed { .. })));
    }
}
