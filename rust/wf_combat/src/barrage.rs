//! Chimerilass's committed bomb packages; all positions are locked before the first throw.
use crate::{api::*, math::direction, tuning::*, Sim};
impl Sim {
    pub fn boss_recharge_duration(&self, i: usize) -> f32 {
        let a = &self.actors[i];
        ((BOSS_RECHARGE - self.modifiers.recharge_reduction)
            * if a.view.enraged { ENRAGE_RECHARGE } else { 1. })
        .max(BOSS_RECHARGE_FLOOR)
            / if a.view.archetype == Archetype::BossBomber {
                CHIMERA_ATTACK_RATE
            } else {
                1.
            }
    }
    pub fn bomb_radius(&self, i: usize) -> f32 {
        BOMB_RADIUS
            * if self.actors[i].view.enraged {
                self.actors[i].phase_rule.map_or(1., |r| r.radius_scale)
            } else {
                1.
            }
    }
    pub fn bomb_spot_open(
        &self,
        p: Vec2,
        radius: f32,
        planned: &[Vec2],
        planned_radius: f32,
    ) -> bool {
        self.floor.point(p, radius) == p
            && self
                .actors
                .iter()
                .filter(|a| a.alive())
                .all(|a| p.distance(a.view.pos) >= radius + a.view.radius + BOMB_OPEN_MARGIN)
            && self
                .hazards
                .iter()
                .filter(|h| {
                    h.view.kind == HazardKind::LizardoDrop && h.view.phase != HazardPhase::Resolved
                })
                .all(|h| {
                    let old = match h.view.shape {
                        Shape::Circle { radius } => radius,
                        _ => BOMB_RADIUS,
                    };
                    p.distance(h.view.origin) >= radius + old + BOMB_OPEN_MARGIN
                })
            && planned
                .iter()
                .all(|q| p.distance(*q) >= radius + planned_radius + BOMB_OPEN_MARGIN)
    }
    pub fn open_bomb_spot(
        &mut self,
        radius: f32,
        planned: &[Vec2],
        planned_radius: f32,
    ) -> Option<Vec2> {
        for _ in 0..64 {
            let p = self.floor.point(
                Vec2::new(
                    self.spawn_rng
                        .range(self.floor.min.x + radius, self.floor.max.x - radius - 0.001),
                    self.spawn_rng
                        .range(self.floor.min.y + radius, self.floor.max.y - radius - 0.001),
                ),
                radius,
            );
            if self.bomb_spot_open(p, radius, planned, planned_radius) {
                return Some(p);
            }
        }
        // Crowded floors still get a deterministic search, before accepting any part of the package.
        let mut y = self.floor.min.y + radius;
        while y < self.floor.max.y - radius - 0.001 {
            let mut x = self.floor.min.x + radius;
            while x < self.floor.max.x - radius - 0.001 {
                let p = Vec2::new(x, y);
                if self.bomb_spot_open(p, radius, planned, planned_radius) {
                    return Some(p);
                }
                x += radius;
            }
            y += radius;
        }
        None
    }
    pub fn prepare_fortress(&mut self, i: usize) -> bool {
        let a = &self.actors[i];
        let pad = a.view.radius + CHIMERA_FORTRESS_GAP + self.bomb_radius(i);
        let goal = self.floor.point(a.view.pos, pad);
        let delta = goal - a.view.pos;
        if delta.length() <= 0.00001 {
            return false;
        }
        let travel = (a.speed() * SIM_DT).min(delta.length());
        let a = &mut self.actors[i];
        a.velocity = delta.normalized() * (travel / SIM_DT);
        a.view.pos = self
            .floor
            .point(a.view.pos + a.velocity * SIM_DT, a.view.radius);
        a.heading = delta.normalized();
        a.state(ActorState::Walk, 0., 0.);
        true
    }
    pub fn spawn_chimera_barrage(&mut self, i: usize, t: usize, mode: u32) -> Option<f32> {
        if self.actors[i].barrage_cd > 0. {
            return None;
        }
        let mut points = [Vec2::default(); CHIMERA_FORTRESS_BOMBS];
        let mut targets = [None; CHIMERA_FORTRESS_BOMBS];
        let count = if mode == 2 { CHIMERA_FORTRESS_BOMBS } else { 4 };
        let radius = self.bomb_radius(i);
        let targeted_radius = radius * (CHIMERA_TARGETED_BOMB_RADIUS / BOMB_RADIUS);
        let a = &self.actors[i];
        let owner = a.view.id;
        let origin = a.view.pos;
        let ring = a.view.radius + CHIMERA_FORTRESS_GAP;
        // Make room before committing; the accepted ring is never compressed at a wall.
        if mode == 2 && self.floor.point(origin, ring + radius) != origin {
            return None;
        }
        let aim = (self.actors[t].view.pos - origin).normalized();
        let ranked = self.boss_barrage_targets(i, t);
        let heroes: [usize; 4] = core::array::from_fn(|k| ranked[k].unwrap_or(t));
        for b in 0..count {
            if mode == 2 {
                points[b] = self
                    .floor
                    .point(origin + direction(TAU * b as f32 / count as f32) * ring, 0.);
            } else if mode == 0 && b < count - 1 {
                let victim = heroes[b];
                points[b] = self.floor.point(
                    self.actors[victim].view.pos
                        + direction(self.spawn_rng.range(0., TAU))
                            * self.spawn_rng.range(0., BOMB_SCATTER),
                    0.,
                );
                targets[b] = Some(self.actors[victim].view.id);
            } else {
                let planned_radius = if mode == 0 { targeted_radius } else { radius };
                points[b] = self.open_bomb_spot(radius, &points[..b], planned_radius)?;
            }
        }
        let mut duration = 0.0f32;
        for b in 0..count {
            let hid = self.hazard(HazardKind::LizardoDrop, owner, targets[b], points[b], aim);
            let h = self.hazards.last_mut().unwrap();
            h.duration += b as f32 * (0.4 / (count - 1) as f32);
            h.damage = h.base_damage * h.duration / h.base_duration;
            // Keep the old damage budget and aimed clocks independent of the new footprint/fuse.
            if targets[b].is_some() {
                h.view.shape = Shape::Circle {
                    radius: targeted_radius,
                };
            } else {
                h.duration = BOMB_FLIGHT + CHIMERA_BOMB_FUSE;
            }
            duration = duration.max(h.duration);
            self.projectile(i, None, points[b], true, 0., Some(hid));
        }
        let cooldown = self.boss_recharge_duration(i) * CHIMERA_BARRAGE_COOLDOWN_SCALE;
        let a = &mut self.actors[i];
        a.barrage_cd = duration + cooldown;
        a.barrage_recharge = true;
        a.fortress = mode == 2;
        Some(duration)
    }
    pub fn try_fortress(&mut self, i: usize) -> bool {
        let a = &self.actors[i];
        if a.view.archetype != Archetype::BossBomber
            || a.boss_retry_basic
            || a.boss_retry_special
            || a.barrage_cd > 0.
            || self.hazards.iter().any(|h| {
                h.view.owner == a.view.id && h.view.hostile && h.view.phase != HazardPhase::Resolved
            })
        {
            return false;
        }
        let melee = self
            .actors
            .iter()
            .enumerate()
            .filter(|(_, h)| {
                h.alive()
                    && h.view.team == Team::Hero
                    && a.view.pos.distance(h.view.pos) <= a.attack_range(h)
            })
            .take(2)
            .count();
        if melee < 2 {
            return false;
        }
        let Some(t) = self.enemy_target(i) else {
            return false;
        };
        if self.prepare_fortress(i) {
            return true;
        }
        let Some(duration) = self.spawn_chimera_barrage(i, t, 2) else {
            return false;
        };
        self.actors[i].boss_attack = crate::enmity::BossAttack::Fortress;
        self.record_boss_attack(i);
        self.enemy_cast(i, duration);
        self.actors[i].view.energy = 0.;
        self.actors[i].enemy_phase = 2;
        true
    }
    /// Fortress holds the body even while a separate heal cast completes inside its warning.
    pub fn fortress_step(&mut self, i: usize) -> bool {
        if !self.actors[i].fortress {
            return false;
        }
        let owner = self.actors[i].view.id;
        let active = self.hazards.iter().any(|h| {
            h.view.owner == owner
                && h.view.kind == HazardKind::LizardoDrop
                && h.view.phase != HazardPhase::Resolved
        });
        if !active {
            self.actors[i].fortress = false;
            return false;
        }
        self.actors[i].velocity = Vec2::default();
        if !self.actors[i].action_heal || self.actors[i].action_done {
            self.try_enemy_heal(i);
        }
        true
    }
}
