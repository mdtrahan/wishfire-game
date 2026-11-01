//! Once committed, a boss finishes its move; hero interrupts and death/reset own cancellation.
use crate::{actors::Actor, hazards::Hazard, tuning::*, *};
pub fn warning_left(hazards: &[Hazard], owner: u32) -> Option<f32> {
    hazards
        .iter()
        .filter(|h| {
            h.view.owner == owner
                && h.view.hostile
                && matches!(h.view.phase, HazardPhase::Tracking | HazardPhase::Locked)
        })
        .map(|h| {
            if h.view.phase == HazardPhase::Tracking {
                (h.tracking - h.phase_age).max(0.) + h.duration
            } else {
                // Resolution follows AI dispatch; keep the cast committed through that step.
                h.remaining().max(SIM_DT)
            }
        })
        .reduce(f32::max)
}
impl Sim {
    pub fn sync_boss_casts(&mut self) {
        for a in &mut self.actors {
            if is_boss(a.view.archetype) && a.alive() && a.view.state == ActorState::Cast {
                if let Some(left) = warning_left(&self.hazards, a.view.id) {
                    a.view.state_duration = a.view.state_age + left;
                }
            }
        }
    }
    pub fn cancel_boss_moves_on_death(&mut self, owner: u32) {
        for h in &mut self.hazards {
            if h.view.owner == owner && h.view.phase != HazardPhase::Resolved {
                h.cancelled = true;
                h.view.phase = HazardPhase::Resolved;
                self.events.push(Event::HazardCancelled {
                    id: h.view.id,
                    kind: h.view.kind,
                });
            }
        }
        self.projectiles.retain(|p| p.source != owner);
    }
    pub fn cancel_dead_boss_moves(&mut self) {
        for i in 0..self.actors.len() {
            if is_boss(self.actors[i].view.archetype) && !self.actors[i].alive() {
                let id = self.actors[i].view.id;
                self.cancel_boss_moves_on_death(id);
            }
        }
    }
    pub fn swing_contains(a: &Actor, target: &Actor) -> bool {
        target.alive()
            && target.view.team == Team::Hero
            && crate::math::contains(
                Shape::Cone {
                    length: a.stats.reach + a.view.radius,
                    half_angle_rad: BOSS_BASIC_HALF_ANGLE,
                },
                a.view.pos,
                a.action_aim,
                target.view.pos,
                target.view.radius,
            )
    }
    pub fn boss_basic_impact(&mut self, i: usize) {
        let a = self.actors[i].clone();
        let raw = a.stats.atk
            * if a.view.elevate == Some(ElevateVariant::Sword) {
                1. + ELEVATE_BONUS
            } else {
                1.
            }
            * match a.view.archetype {
                Archetype::BossBomber => BOMBER_BASIC_SCALE,
                Archetype::BossMarksman => MARKSMAN_BASIC_POWER,
                _ => 1.,
            };
        if a.stats.reach > 100. {
            let end = a.view.pos
                + a.action_aim * crate::math::floor_ray(a.view.pos, a.action_aim, f32::INFINITY);
            self.projectile(i, a.target, end, false, raw, None);
        } else {
            let victim = a
                .target
                .and_then(|id| self.actor_index(id))
                .filter(|&t| Self::swing_contains(&a, &self.actors[t]))
                .or_else(|| {
                    self.actors
                        .iter()
                        .enumerate()
                        .filter(|(_, t)| Self::swing_contains(&a, t))
                        .min_by(|(_, x), (_, y)| {
                            a.view
                                .pos
                                .distance(x.view.pos)
                                .total_cmp(&a.view.pos.distance(y.view.pos))
                                .then_with(|| x.view.id.cmp(&y.view.id))
                        })
                        .map(|(i, _)| i)
                });
            if let Some(t) = victim {
                self.damage_limited(
                    a.view.id,
                    t,
                    raw,
                    true,
                    true,
                    Element::Physical,
                    Some(BOSS_BASIC_MAX_HP),
                    false,
                );
            }
        }
    }
}
