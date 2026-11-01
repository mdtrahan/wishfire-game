//! Mage-only backline positioning. Enemy knowledge and warning knowledge retain shared clocks.
use crate::{api::*, math::direction, tuning::*, Sim};
impl Sim {
    pub fn mage(&self, i: usize) -> bool {
        self.autonomous()
            && matches!(
                self.actors[i].view.archetype,
                Archetype::Runa | Archetype::Kaja
            )
    }
    pub fn mage_danger_radius(&self, i: usize, e: usize) -> f32 {
        let enemy = &self.actors[e];
        // Ranged weapons threaten through their warnings/projectiles, not a melee circle.
        let reach = match enemy.view.archetype {
            Archetype::Sniper | Archetype::Mirewing | Archetype::Marid => {
                enemy.stats.reach.min(100.)
            }
            _ => enemy.stats.reach,
        };
        reach
            + enemy.view.radius
            + if is_boss(enemy.view.archetype) {
                MAGE_BOSS_MARGIN
            } else {
                self.actors[i].view.radius + MAGE_ENEMY_MARGIN
            }
    }
    pub fn mage_threat(&self, i: usize, boss_only: bool) -> Option<usize> {
        if !self.mage(i) {
            return None;
        }
        self.actors
            .iter()
            .enumerate()
            .filter(|(e, a)| self.can_engage(i, *e) && (!boss_only || is_boss(a.view.archetype)))
            .filter(|(e, a)| {
                self.actors[i].view.pos.distance(a.view.pos) < self.mage_danger_radius(i, *e)
            })
            .min_by(|(e, a), (f, b)| {
                (self.actors[i].view.pos.distance(a.view.pos) - self.mage_danger_radius(i, *e))
                    .total_cmp(
                        &(self.actors[i].view.pos.distance(b.view.pos)
                            - self.mage_danger_radius(i, *f)),
                    )
            })
            .map(|(e, _)| e)
    }
    /// Reject new danger-circle entry. Existing encirclement may clear between bodies.
    pub fn mage_path_safe(&self, i: usize, point: Vec2) -> bool {
        if !self.mage(i) {
            return true;
        }
        let pos = self.actors[i].view.pos;
        let delta = point - pos;
        self.actors
            .iter()
            .enumerate()
            .filter(|(e, _)| self.can_engage(i, *e))
            .all(|(e, a)| {
                let radius = self.mage_danger_radius(i, e);
                let start = pos.distance(a.view.pos);
                let t = ((a.view.pos - pos).dot(delta) / delta.dot(delta).max(0.001)).clamp(0., 1.);
                let closest = (pos + delta * t).distance(a.view.pos);
                let minimum = if start >= radius || is_boss(a.view.archetype) {
                    radius.min(start)
                } else {
                    (self.actors[i].view.radius + a.view.radius + ESCAPE_MARGIN).min(start)
                };
                closest + 0.001 >= minimum
            })
    }
    pub fn mage_attack_window(&self, i: usize, duration: f32) -> bool {
        if !self.mage(i) {
            return true;
        }
        let a = &self.actors[i];
        for (e, b) in self
            .actors
            .iter()
            .enumerate()
            .filter(|(e, _)| self.can_engage(i, *e))
        {
            let distance = a.view.pos.distance(b.view.pos);
            if distance >= self.mage_danger_radius(i, e) {
                continue;
            }
            let busy = if b.committed() {
                (if b.view.state == ActorState::Basic && !b.action_done {
                    b.view.impact_at
                } else {
                    b.view.state_duration
                } - b.view.state_age)
                    .max(0.)
            } else {
                0.
            };
            let ready = if is_boss(b.view.archetype) && b.enemy_phase == 3 {
                b.special_cd
            } else {
                b.basic_cd
            };
            // Encase expires: budget its remaining hold, then movement at the released speed.
            let released_speed = b.stats.speed * (1. - b.view.slowed);
            let travel = (distance - b.attack_range(a)).max(0.) / released_speed.max(0.001);
            // A basic already winding up lands at impact, regardless of its new cooldown.
            let available = if b.committed() && b.view.state == ActorState::Basic && !b.action_done
            {
                busy
            } else {
                busy.max(ready)
            };
            if b.view.encased + available + travel < duration + SIM_DT {
                return false;
            }
        }
        true
    }
    pub fn mage_goal(&self, i: usize, threat: usize, retreat: bool) -> Vec2 {
        let a = &self.actors[i];
        let e = &self.actors[threat];
        let band = a.view.radius + e.view.radius + a.reach() * MAGE_STANDOFF_GOAL;
        let radius = if retreat {
            band.max(self.mage_danger_radius(i, threat) + MAGE_KITE_BUFFER)
        } else {
            band
        };
        let anchor = self
            .actors
            .iter()
            .find(|b| b.tangible() && b.view.archetype == Archetype::Fara)
            .or_else(|| {
                self.actors
                    .iter()
                    .find(|b| b.tangible() && b.view.archetype == Archetype::Hondo)
            })
            .map(|b| b.view.pos)
            .unwrap_or_else(|| self.centroid());
        let mut result = a.view.pos;
        let mut best = f32::INFINITY;
        for n in 0..64 {
            let dir = direction((n % 32) as f32 * TAU / 32.);
            let p = crate::math::floor_point(
                if n < 32 {
                    e.view.pos + dir * radius
                } else {
                    a.view.pos + dir * 96.
                },
                a.view.radius,
            );
            if a.view.pos.distance(p) < 2.
                || !self.mage_path_safe(i, p)
                || !self.fight_spot_safe(i, p)
                || self.path_enters_threat(i, p, None)
            {
                continue;
            }
            let clearance = self
                .actors
                .iter()
                .enumerate()
                .filter(|(j, _)| self.can_engage(i, *j))
                .fold(f32::INFINITY, |d, (j, b)| {
                    d.min(p.distance(b.view.pos) - self.mage_danger_radius(i, j))
                });
            let wall = (p.x - ARENA_MIN.x - a.view.radius)
                .min(ARENA_MAX.x - p.x - a.view.radius)
                .min(p.y - ARENA_MIN.y - a.view.radius)
                .min(ARENA_MAX.y - p.y - a.view.radius);
            let delta = p - a.view.pos;
            let penetration = self
                .actors
                .iter()
                .enumerate()
                .filter(|(j, _)| self.can_engage(i, *j))
                .fold(0., |sum, (_, b)| {
                    let t = ((b.view.pos - a.view.pos).dot(delta) / delta.dot(delta).max(0.001))
                        .clamp(0., 1.);
                    sum + (a.view.pos.distance(b.view.pos)
                        - (a.view.pos + delta * t).distance(b.view.pos))
                    .max(0.)
                });
            let cost = (-clearance).max(0.) * 4.
                + (a.speed() - wall).max(0.) * 4.
                + (p.distance(anchor) - TAUNT_RADIUS * 0.65).max(0.) * 2.
                + penetration * 0.2
                + (p.distance(e.view.pos) - radius).abs() * 0.5
                + a.view.pos.distance(p) * 0.2;
            if cost < best {
                best = cost;
                result = p;
            }
        }
        result
    }
    pub fn mage_closing(&self, i: usize) -> bool {
        let a = &self.actors[i];
        self.actors.iter().enumerate().any(|(j, b)| {
            self.can_engage(i, j)
                && b.stats.reach <= 100.
                && b.velocity.dot((a.view.pos - b.view.pos).normalized()) > 1.
                && a.view.pos.distance(b.view.pos)
                    < b.view.radius + a.view.radius + a.reach() * MAGE_STANDOFF_GOAL
        })
    }
    pub fn mage_clearing_revive(&self, i: usize) -> bool {
        self.mage(i)
            && self.actors[i].view.ai_intent == AiIntent::MoveToRange
            && self.actors[i]
                .target
                .and_then(|id| self.actor_index(id))
                .is_some_and(|e| {
                    self.can_engage(i, e)
                        && self.actors.iter().any(|ally| {
                            ally.view.team == Team::Hero
                                && ally.view.state == ActorState::Downed
                                && ally.view.pos.distance(self.actors[e].view.pos)
                                    <= self.actors[e].attack_range(ally) + REVIVE_DANGER_MARGIN
                        })
                })
    }
    pub fn mage_position(&mut self, i: usize, target: usize) {
        let a = &self.actors[i];
        let e = &self.actors[target];
        let distance = a.view.pos.distance(e.view.pos);
        let bodies = a.view.radius + e.view.radius;
        let low = bodies + a.reach() * MAGE_STANDOFF_MIN;
        let high = bodies + a.reach() * MAGE_STANDOFF_MAX;
        let closing = self.mage_closing(i);
        let recovering = a.view.ai_intent == AiIntent::Retreat && distance < low + MAGE_KITE_BUFFER;
        let hold = distance >= low
            && distance <= high
            && !closing
            && !recovering
            && self.mage_threat(i, false).is_none()
            && self.fight_spot_safe(i, a.view.pos);
        let intent = if hold {
            AiIntent::Attack
        } else if distance < low || closing || recovering {
            AiIntent::Retreat
        } else {
            AiIntent::MoveToRange
        };
        let goal = if hold {
            a.view.pos
        } else {
            self.mage_goal(i, target, false)
        };
        self.actors[i].view.ai_intent = intent;
        self.actors[i].destination = goal;
        self.actors[i].goal_target_pos = self.actors[target].view.pos;
        self.actors[i].goal_cd = GOAL_HOLD;
    }
}
