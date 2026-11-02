//! Meter sources, committed choices and Hondo's continuous Combo package.
use crate::{tuning::*, *};
pub fn shadow_line_aligned(from: Vec2, target: Vec2) -> bool {
    let delta = target - from;
    delta.x.abs() > 0.001
        && delta.y.abs()
            <= delta.x.abs()
                * libm::tanf(SHADOW_MAX_LINE_ANGLE_DEGREES * core::f32::consts::PI / 180.)
}
impl Sim {
    pub fn shadow_approach(&self, i: usize, target: usize) -> Option<Vec2> {
        let a = &self.actors[i];
        let e = &self.actors[target];
        [-1., 1.]
            .into_iter()
            .map(|side| e.view.pos + Vec2::new(side * a.attack_range(e) * 0.9, 0.))
            .filter(|&p| {
                p == self.actor_floor(i).point(p, a.view.radius)
                    && self.fight_spot_safe(i, p)
                    && !self.path_enters_threat(i, p, None)
                    && !self.actors.iter().enumerate().any(|(j, other)| {
                        j != i
                            && other.alive()
                            && p.distance(other.view.pos) < a.view.radius + other.view.radius
                    })
            })
            .min_by(|x, y| a.view.pos.distance(*x).total_cmp(&a.view.pos.distance(*y)))
    }
    pub fn groove_timers(&mut self) {
        for i in 0..self.actors.len() {
            let a = &mut self.actors[i];
            let passive = match a.view.archetype {
                Archetype::Fara if a.alive() => Some((RAGE_FILL_SECONDS, RAGE_STOCK_CAP)),
                Archetype::Hondo if a.alive() && a.combo_phase == 0 => {
                    Some((COMBO_FILL_SECONDS, 1.))
                }
                Archetype::Runa if a.alive() => Some((SUPER_FILL_SECONDS, 3.)),
                Archetype::Kaja => Some((POWER_STOCK_SECONDS, 3.)),
                _ => None,
            };
            if let Some((seconds, cap)) = passive {
                a.view.meter = (a.view.meter + SIM_DT * a.meter_rate / seconds).min(cap);
            }
            if a.alive() && a.view.archetype == Archetype::Kaja {
                a.view.groove_active = if a.view.groove_active <= SIM_DT + 0.00001 {
                    0.
                } else {
                    a.view.groove_active - SIM_DT
                };
            }
            let ready = a.alive()
                && a.view.meter + 0.00001 >= 1.
                && match a.view.archetype {
                    Archetype::Runa => true,
                    Archetype::Kaja => a.power_choice != Some(true),
                    _ => false,
                };
            let eligible = ready
                && !a.committed()
                && a.view.encased <= 0.
                && !matches!(a.view.state, ActorState::Spawn | ActorState::Hurt)
                && !matches!(a.view.ai_intent, AiIntent::Dodge | AiIntent::Revive)
                && self.attack_has_time(i, true)
                && self.actors.iter().enumerate().any(|(t, enemy)| {
                    self.can_engage(i, t)
                        && self.actors[i].view.pos.distance(enemy.view.pos)
                            <= self.actors[i].attack_range(enemy)
                });
            if eligible {
                let a = &mut self.actors[i];
                a.aoe_ready_steps = (a.aoe_ready_steps + 1).min(MAGE_AOE_HOLD_STEPS);
            }
            self.combo_drain(i);
        }
        self.refresh_elevate();
    }
    pub fn refresh_elevate(&mut self) {
        let variant = self
            .actors
            .iter()
            .find(|a| a.alive() && a.view.archetype == Archetype::Kaja && a.view.groove_active > 0.)
            .and_then(|a| a.view.elevate);
        for a in &mut self.actors {
            if a.view.team == Team::Hero {
                a.view.elevate = if a.alive() { variant } else { None };
            }
        }
    }
    pub fn combo_drain(&mut self, i: usize) {
        if self.actors[i].combo_phase != 0
            && !self
                .actors
                .iter()
                .any(|a| a.alive() && a.view.team == Team::Enemy)
        {
            let a = &mut self.actors[i];
            a.combo_phase = 4; // Empty burst: discard drain, finish the committed cast recovery.
            a.view.meter = 0.;
            a.view.groove_active = 0.;
            return;
        }
        let a = &mut self.actors[i];
        if a.combo_phase == 2 {
            a.view.groove_active = if a.view.groove_active <= SIM_DT + 0.00001 {
                0.
            } else {
                a.view.groove_active - SIM_DT
            };
            a.view.meter = a.view.groove_active / COMBO_SECONDS;
        }
    }
    pub fn basic_groove(&mut self, source: u32) {
        let Some(i) = self.actor_index(source) else {
            return;
        };
        let a = &mut self.actors[i];
        if !a.alive() {
            return;
        }
        match a.view.archetype {
            Archetype::Hondo if a.combo_phase == 0 => {
                a.view.meter = (a.view.meter + COMBO_BASIC_GAIN).min(1.);
            }
            Archetype::Runa => {
                a.view.meter = (a.view.meter + SUPER_BASIC_GAIN).min(3.);
            }
            _ => {}
        }
    }
    pub fn backline_threat(&self, i: usize) -> Option<usize> {
        self.actors
            .iter()
            .enumerate()
            .find(|(j, e)| {
                self.can_engage(i, *j)
                    && self.taunt_recipient(i, *j)
                    && e.stats.reach <= 100.
                    && self.actors.iter().any(|m| {
                        m.alive()
                            && matches!(m.view.archetype, Archetype::Runa | Archetype::Kaja)
                            && (e.target == Some(m.view.id)
                                || e.view.pos.distance(m.view.pos) <= e.attack_range(m))
                    })
            })
            .map(|(j, _)| j)
    }
    pub fn warcry_reason(&self, i: usize) -> Option<usize> {
        self.backline_threat(i).or_else(|| {
            self.actors
                .iter()
                .enumerate()
                .find(|(j, e)| {
                    self.can_engage(i, *j)
                        && self.taunt_recipient(i, *j)
                        && self.actors.iter().enumerate().any(|(k, ally)| {
                            k != i
                                && ally.alive()
                                && ally.view.team == Team::Hero
                                && e.target == Some(ally.view.id)
                        })
                })
                .map(|(j, _)| j)
        })
    }
    /// Rank legal target-centred placements using the same floor clamp and body
    /// overlap as the one-shot. Preserve the current target on equal coverage.
    pub fn mage_aoe_target(&self, i: usize, radius: f32) -> Option<usize> {
        let a = &self.actors[i];
        let mut best = None;
        let mut coverage = 0;
        for (t, enemy) in self.actors.iter().enumerate() {
            if !self.can_engage(i, t) || a.view.pos.distance(enemy.view.pos) > a.attack_range(enemy)
            {
                continue;
            }
            let center = self.floor.point(enemy.view.pos, radius);
            let count = self
                .actors
                .iter()
                .enumerate()
                .filter(|(j, e)| {
                    self.can_engage(i, *j)
                        && (*j == t || e.view.pos.distance(center) <= radius + e.view.radius)
                })
                .count();
            if count > coverage || (count == coverage && a.target == Some(enemy.view.id)) {
                best = Some(t);
                coverage = count;
            }
        }
        best.filter(|_| coverage >= 2 || a.aoe_ready_steps >= MAGE_AOE_HOLD_STEPS)
    }
    pub fn groove_action(&mut self, i: usize) -> bool {
        if self.actors[i].combo_phase != 0 {
            self.combo_next(i);
            return true;
        }
        let a = &self.actors[i];
        if !a.alive() || a.committed() {
            return false;
        }
        if matches!(a.view.ai_intent, AiIntent::Dodge | AiIntent::Revive)
            || !self.attack_has_time(i, true)
        {
            return false;
        }
        let target = a
            .target
            .and_then(|id| self.actor_index(id))
            .filter(|&t| self.can_engage(i, t));
        match a.view.archetype {
            Archetype::Fara if a.view.meter >= 1. => {
                if let Some(t) = self.warcry_reason(i) {
                    self.start_extra(i, self.actors[t].view.id);
                    return true;
                }
                if let Some(t) = target.filter(|&t| {
                    a.view.pos.distance(self.actors[t].view.pos)
                        <= GROUND_POUND_LENGTH * a.reach_scale()
                }) {
                    self.start_ground_pound(i, self.actors[t].view.id);
                    return true;
                }
            }
            Archetype::Hondo if a.view.meter >= 1. => {
                let t = (0..self.actors.len()).find(|&t| {
                    self.can_engage(i, t)
                        && a.view.pos.distance(self.actors[t].view.pos)
                            <= a.attack_range(&self.actors[t]) * SHADOW_RANGE_SCALE
                        && self.combo_landing(i, t, a.view.pos).is_some()
                });
                if let Some(t) = t {
                    let a = &mut self.actors[i];
                    a.combo_phase = 1;
                    a.combo_origin = a.view.pos;
                    a.combo_previous = None;
                    self.start_action(i, Some(self.actors[t].view.id), true, false);
                    return true;
                }
            }
            Archetype::Runa if a.view.meter + 0.00001 >= 1. => {
                if let Some(t) = self.super_heal_target() {
                    self.start_extra(i, self.actors[t].view.id);
                    return true;
                }
                if let Some(t) = self.mage_aoe_target(i, BUBBLE_RADIUS) {
                    self.start_action(i, Some(self.actors[t].view.id), true, false);
                    return true;
                }
            }
            Archetype::Kaja => {
                // Owner 2026-10-27: hold every stock until a foe has fully formed.
                let enemies = self.actors.iter().any(|e| {
                    e.alive() && e.view.team == Team::Enemy && e.view.state != ActorState::Spawn
                });
                if enemies {
                    if self.actors[i].power_choice.is_none() {
                        let elevate = self.actors[i].groove_rng.chance(0.5);
                        self.actors[i].power_choice = Some(elevate);
                        self.actors[i].elevate_choice = if elevate {
                            Some(roll_elevate(&mut self.actors[i].groove_rng))
                        } else {
                            None
                        };
                    }
                    let a = &self.actors[i];
                    if a.power_choice == Some(true) {
                        if a.view.meter + 0.00001 >= 2. {
                            self.start_action(i, a.target, true, false);
                            return true;
                        }
                    } else if a.view.meter + 0.00001 >= 1. {
                        if let Some(t) = self.mage_aoe_target(i, ARCANE_PULSE_RADIUS) {
                            self.start_arcane_pulse(i, self.actors[t].view.id);
                            return true;
                        }
                    }
                }
            }
            _ => {}
        }
        false
    }
    pub fn combo_on_screen(&self, i: usize, landing: Vec2) -> bool {
        let mut sum = 0.;
        let mut count = 0;
        for (j, a) in self.actors.iter().enumerate() {
            if a.alive() && a.view.team == Team::Hero {
                sum += if j == i { landing.x } else { a.view.pos.x };
                count += 1;
            }
        }
        let center = sum / count as f32;
        self.actors.iter().enumerate().all(|(j, a)| {
            !a.alive()
                || a.view.team != Team::Hero
                || ((if j == i { landing.x } else { a.view.pos.x }) - center).abs()
                    <= (self.cfg.visible_width * 0.5 - a.view.radius).max(0.)
        })
    }
    pub fn combo_landing(&self, i: usize, t: usize, origin: Vec2) -> Option<Vec2> {
        let a = &self.actors[i];
        let e = &self.actors[t];
        let staged = self
            .spotlight
            .active
            .as_ref()
            .is_some_and(|s| s.performer_running(a.view.id));
        if !staged && !shadow_line_aligned(a.view.pos, e.view.pos) {
            return None;
        }
        let angle = libm::atan2f(a.view.pos.y - e.view.pos.y, a.view.pos.x - e.view.pos.x);
        let radius = a.view.radius + e.view.radius + a.committed_reach() * 0.6;
        let turns: &[f32] = if staged {
            &[
                COMBO_TURN,
                COMBO_TURN - TAU / 24.,
                COMBO_TURN + TAU / 24.,
                -COMBO_TURN,
                -COMBO_TURN + TAU / 24.,
                -COMBO_TURN - TAU / 24.,
            ]
        } else {
            &[
                core::f32::consts::PI,
                core::f32::consts::PI - TAU / 48.,
                core::f32::consts::PI + TAU / 48.,
                core::f32::consts::PI - TAU / 24.,
                core::f32::consts::PI + TAU / 24.,
            ]
        };
        for &turn in turns {
            let p = e.view.pos + crate::math::direction(angle + turn) * radius;
            if !staged
                && (!shadow_line_aligned(p, e.view.pos)
                    || !shadow_line_aligned(a.view.pos, p)
                    || (p.x - e.view.pos.x) * (a.view.pos.x - e.view.pos.x) >= 0.)
            {
                continue;
            }
            if p.distance(a.view.pos) + 0.00001 < COMBO_MIN_HOP
                || p.distance(origin) > COMBO_RADIUS
                || !self.combo_on_screen(i, p)
                || p != self.actor_floor(i).point(p, a.view.radius)
                || self.hazards.iter().any(|h| {
                    h.view.hostile
                        && h.view.kind != HazardKind::KajaAura
                        && h.view.team != a.view.team
                        && h.view.phase != HazardPhase::Resolved
                        && h.hits(p, a.view.radius)
                })
                || self.actors.iter().enumerate().any(|(j, b)| {
                    j != i
                        && b.tangible()
                        && p.distance(b.view.pos) < a.view.radius + b.view.radius + 1.
                })
            {
                continue;
            }
            return Some(p);
        }
        None
    }
    pub fn combo_target(&self, i: usize) -> Option<usize> {
        let a = &self.actors[i];
        // Stable ID order, with the previous recipient considered last.
        (0..self.actors.len())
            .filter(|&t| {
                self.can_engage(i, t)
                    && self.actors[t].view.pos.distance(a.combo_origin) <= COMBO_RADIUS
                    && self.combo_landing(i, t, a.combo_origin).is_some()
            })
            .min_by_key(|&t| {
                (
                    Some(self.actors[t].view.id) == a.combo_previous,
                    self.actors[t].view.id,
                )
            })
    }
    /// Exact body-edge weapon reach matches melee admission without an extra margin.
    /// The living centre target is itself inside SPLIT_RADIUS, guaranteeing coverage at commitment.
    pub fn split_target(&self, i: usize) -> Option<u32> {
        let a = &self.actors[i];
        let in_reach = |t: usize| {
            self.can_engage(i, t)
                && a.view.pos.distance(self.actors[t].view.pos) <= a.attack_range(&self.actors[t])
        };
        self.combo_target(i)
            .filter(|&t| in_reach(t))
            .or_else(|| {
                a.target
                    .and_then(|id| self.actor_index(id))
                    .filter(|&t| in_reach(t))
            })
            .or_else(|| (0..self.actors.len()).find(|&t| in_reach(t)))
            .map(|t| self.actors[t].view.id)
    }
    pub fn combo_next(&mut self, i: usize) {
        if self.actors[i].committed() {
            return;
        }
        let phase = self.actors[i].combo_phase;
        if phase == 3 || phase == 4 {
            self.end_combo(i);
            return;
        }
        if !self
            .actors
            .iter()
            .any(|a| a.alive() && a.view.team == Team::Enemy)
        {
            self.end_combo(i);
            return;
        }
        if phase == 2 && self.actors[i].view.groove_active <= 0. {
            // Split finishes only on a living engageable enemy; otherwise the burst just ends.
            let Some(target) = self.split_target(i) else {
                self.end_combo(i);
                return;
            };
            self.actors[i].combo_phase = 3;
            self.start_extra(i, target);
        } else if let Some(t) = self.combo_target(i) {
            self.start_action(i, Some(self.actors[t].view.id), true, false);
        } else if phase == 1 {
            // The committed first Shadow lost every safe landing. Spend its bar and
            // finish only with a reachable victim; frozen warnings must never deadlock Performing.
            let Some(target) = self.split_target(i) else {
                self.end_combo(i);
                return;
            };
            self.actors[i].combo_phase = 3;
            self.actors[i].view.meter = 0.;
            self.start_extra(i, target);
        }
        // A temporarily blocked landing waits safely while the earned drain continues.
    }
    pub fn end_combo(&mut self, i: usize) {
        let a = &mut self.actors[i];
        a.combo_phase = 0;
        a.view.meter = 0.;
        a.view.groove_active = 0.;
        a.view.special_casting =
            a.view.state == ActorState::Cast && a.committed() && !a.action_revive;
    }
}

/// Rejection sampling gives each variant exactly one third of the u64 stream.
pub fn roll_elevate(rng: &mut crate::rng::Rng) -> ElevateVariant {
    let mut roll = rng.next();
    while roll == u64::MAX {
        roll = rng.next();
    }
    match roll % 3 {
        0 => ElevateVariant::Sword,
        1 => ElevateVariant::Wings,
        _ => ElevateVariant::WingedBoots,
    }
}
