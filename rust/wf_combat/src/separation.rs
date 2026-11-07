//! Owner (2026-10-27): actors never stack or hide behind one another. Every living hero and
//! enemy keeps a small moat around its body, resolved like ground collision in a 3D game.
//! It runs after movement and actions, so moves that cross bodies (Hondo's Shadow warp) still
//! pass through; only where an actor ends up is spaced.
use crate::{api::*, tuning::*, Sim};

impl Sim {
    pub fn moat_radius(&self, i: usize) -> f32 {
        let a = &self.actors[i];
        if is_boss(a.view.archetype) {
            a.view.radius
        } else {
            a.view.radius + ACTOR_MOAT
        }
    }
    /// 0 = free to move, 1 = holding (committed action), 2 = immovable (boss, encased, spawning).
    pub fn anchor(&self, i: usize) -> u8 {
        let a = &self.actors[i];
        if is_boss(a.view.archetype)
            || a.view.encased > 0.
            || a.view.state == ActorState::Spawn
            || (a.view.archetype == Archetype::Mirewing
                && a.view.state == ActorState::Cast
                && a.committed())
        {
            2
        } else if a.committed() || (a.view.team == Team::Enemy && a.formed_age < SPAWN_SETTLE_SECONDS) {
            // Holding: a committed action, or an enemy that has only just spawned in.
            1
        } else {
            0
        }
    }
    pub fn moat_point_ok(&self, i: usize, p: Vec2, yielding_to_hover: bool) -> bool {
        let a = &self.actors[i];
        if p != self.actor_floor(i).point(p, a.view.radius) {
            return false;
        }
        if a.view.team != Team::Hero {
            return true;
        }
        // Heroes stay inside the screen-wide party bound and out of known warnings.
        let screen_ok = self.cfg.cohesion != Cohesion::ScreenBound || {
            let half = (self.cfg.visible_width * 0.5 - a.view.radius).max(0.);
            let focus = self.centroid();
            (p.x - focus.x).abs() <= half
        };
        screen_ok
            && if yielding_to_hover {
                !self.path_enters_threat(i, p, None)
            } else {
                self.containment_safe(i, p)
            }
    }
    pub fn separate_bodies(&mut self) {
        // Hazard trials place actors directly with body physics disabled.
        if !self.autonomous() {
            return;
        }
        let n = self.actors.len();
        for _ in 0..ACTOR_MOAT_PASSES {
            let mut moved = false;
            for i in 0..n {
                if !self.actors[i].tangible() {
                    continue;
                }
                for j in i + 1..n {
                    if !self.actors[j].tangible() {
                        continue;
                    }
                    // Bosses vs heroes are resolved by constrain_party.
                    let (bi, bj) = (
                        is_boss(self.actors[i].view.archetype),
                        is_boss(self.actors[j].view.archetype),
                    );
                    if (bi && self.actors[j].view.team == Team::Hero)
                        || (bj && self.actors[i].view.team == Team::Hero)
                    {
                        continue;
                    }
                    // The moat is an ellipse stretched in depth (y): tall sprites standing one
                    // behind another need more floor distance than side by side to stay legible.
                    let world = self.actors[j].view.pos - self.actors[i].view.pos;
                    let delta = Vec2::new(world.x, world.y / ACTOR_MOAT_DEPTH);
                    let minimum = self.moat_radius(i) + self.moat_radius(j);
                    let distance = delta.length();
                    if distance + 0.0001 >= minimum {
                        continue;
                    }
                    let unit = if distance > 0.0001 {
                        delta * (1. / distance)
                    } else {
                        // Deterministic split for exact stacks.
                        Vec2::new(if (i + j) % 2 == 0 { 1. } else { -1. }, 0.)
                    };
                    let push = minimum - distance;
                    let dir = Vec2::new(unit.x, unit.y * ACTOR_MOAT_DEPTH);
                    let (ai, aj) = (self.anchor(i), self.anchor(j));
                    let (wi, wj) = match ai.cmp(&aj) {
                        core::cmp::Ordering::Less => (1., 0.),
                        core::cmp::Ordering::Greater => (0., 1.),
                        core::cmp::Ordering::Equal if ai == 2 => (0., 0.),
                        core::cmp::Ordering::Equal => (0.5, 0.5),
                    };
                    for (k, w, sign) in [(i, wi, -1.), (j, wj, 1.)] {
                        if w <= 0. {
                            continue;
                        }
                        let target = self.actors[k].view.pos + dir * (push * w * sign);
                        let target = self
                            .actor_floor(k)
                            .point(target, self.actors[k].view.radius);
                        let other = &self.actors[if k == i { j } else { i }];
                        // A planted moth cannot yield: allow the hero's full escape-safe
                        // correction even while it is still inside the warning it is leaving.
                        let yielding_to_hover = other.view.archetype == Archetype::Mirewing
                            && other.view.state == ActorState::Cast
                            && other.committed()
                            && other.view.encased <= 0.;
                        if self.moat_point_ok(k, target, yielding_to_hover) {
                            self.actors[k].view.pos = target;
                            moved = true;
                        }
                    }
                }
            }
            if !moved {
                break;
            }
        }
    }
}
