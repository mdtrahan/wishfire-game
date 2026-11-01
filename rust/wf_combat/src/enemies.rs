use crate::{api::*, math::direction, tuning::*, Sim};
// Mirewing owns these phases; it never enters the shared boss relocation/Marid escape path.
pub const MIREWING_REPOSITION: u8 = 0;
pub const MIREWING_HOVERING: u8 = 1;
pub const MIREWING_FIRE: u8 = 2; // Burst phases count released rounds from here.
impl Sim {
    /// Reject a step into any hero's melee clearance, including a bystander or Taunt target.
    /// An already-close hero may be escaped, but never approached further.
    pub fn mirewing_step_clear(&self, i: usize, end: Vec2) -> bool {
        let a = &self.actors[i];
        let start = a.view.pos;
        let step = end - start;
        let length2 = step.dot(step);
        self.actors
            .iter()
            .filter(|h| h.alive() && h.view.team == Team::Hero)
            .all(|h| {
                let reach = HERO_STATS[0].reach.max(HERO_STATS[1].reach);
                let clearance = a.view.radius + h.view.radius + reach + MIREWING_ARRIVAL;
                let required = clearance.min(start.distance(h.view.pos));
                let t = if length2 > 0. {
                    ((h.view.pos - start).dot(step) / length2).clamp(0., 1.)
                } else {
                    0.
                };
                (start + step * t).distance(h.view.pos) + 0.001 >= required
            })
    }

    pub fn mirewing_ai(&mut self, i: usize) {
        if self.actors[i].committed() {
            return;
        }
        // A completed burst or an interrupted cast starts a fresh bounded move.
        if self.actors[i].enemy_phase != MIREWING_REPOSITION {
            self.actors[i].enemy_phase = MIREWING_REPOSITION;
            self.actors[i].relocate_left = 0.;
        }
        let Some(t) = self.enemy_target(i) else {
            let a = &mut self.actors[i];
            let center = self
                .floor
                .point((self.floor.min + self.floor.max) * 0.5, a.view.radius);
            a.destination = center;
            let delta = center - a.view.pos;
            a.velocity = delta.normalized() * a.speed().min(delta.length() / SIM_DT);
            a.view.pos = self
                .floor
                .point(a.view.pos + a.velocity * SIM_DT, a.view.radius);
            a.target = None;
            a.view.ai_intent = AiIntent::Regroup;
            a.relocate_left = 0.;
            a.state(
                if delta.length() > MIREWING_ARRIVAL {
                    ActorState::Walk
                } else {
                    ActorState::Idle
                },
                0.,
                0.,
            );
            return;
        };
        let p = self.actors[t].view.pos;
        let target_id = self.actors[t].view.id;
        let start = self.actors[i].view.pos;
        if self.actors[i].relocate_left <= 0. {
            // Sample a fixed ring once per move. Prefer a short lateral hop with a clear
            // route and range from EVERY hero, so a farther Taunt cannot cause a melee dive.
            let radial = start - p;
            let angle = libm::atan2f(radial.y, radial.x);
            let side = if self.actors[i].formation_offset.y < 0. {
                -1.
            } else {
                1.
            };
            let radius = (MIREWING_MIN + MIREWING_MAX) * 0.5;
            let mut best = None;
            let mut score = f32::INFINITY;
            for k in 0..16 {
                let candidate = self.floor.point(
                    p + direction(angle + side * (MIREWING_SIDESTEP + k as f32 * TAU / 16.))
                        * radius,
                    self.actors[i].view.radius,
                );
                let nearest = self
                    .actors
                    .iter()
                    .filter(|h| h.alive() && h.view.team == Team::Hero)
                    .map(|h| candidate.distance(h.view.pos))
                    .fold(f32::INFINITY, f32::min);
                if !(MIREWING_MIN..=MIREWING_MAX).contains(&nearest)
                    || candidate.distance(p) > MIREWING_MAX
                    || !self.mirewing_step_clear(i, candidate)
                {
                    continue;
                }
                let cost = start.distance(candidate);
                if cost < score {
                    score = cost;
                    best = Some(candidate);
                }
            }
            let a = &mut self.actors[i];
            // If surrounded, hold rather than chase or run an unbounded escape search.
            a.destination = best.unwrap_or(start);
            a.relocate_left = MIREWING_REPOSITION_MAX;
        }
        let a = &self.actors[i];
        let delta = a.destination - start;
        let next = self.floor.point(
            start + delta.normalized() * (a.speed() * SIM_DT).min(delta.length()),
            a.view.radius,
        );
        let next = if self.mirewing_step_clear(i, next) {
            next
        } else {
            start
        };
        let a = &mut self.actors[i];
        a.target = Some(target_id);
        a.velocity = (next - start) * (1. / SIM_DT);
        if a.velocity.x.abs() > 0.001 {
            a.view.facing = if a.velocity.x < 0. {
                Facing::Left
            } else {
                Facing::Right
            };
        }
        a.view.ai_intent = AiIntent::MoveToRange;
        a.view.pos = next;
        a.relocate_left -= SIM_DT;
        a.state(ActorState::Walk, 0., 0.);
        let distance = next.distance(p);
        let arrived = next.distance(a.destination) <= MIREWING_ARRIVAL
            && (MIREWING_MIN..=MIREWING_MAX).contains(&distance)
            && a.relocate_left <= MIREWING_REPOSITION_MAX - MIREWING_REPOSITION_MIN;
        if distance <= MIREWING_MAX && (arrived || a.relocate_left <= 0.) {
            a.action_target_pos = p;
            a.view.facing = if p.x < next.x {
                Facing::Left
            } else {
                Facing::Right
            };
            self.enemy_cast(i, MIREWING_HOVER);
            let a = &mut self.actors[i];
            a.enemy_phase = MIREWING_HOVERING;
            a.view.ai_intent = AiIntent::Attack;
            a.action_done = false;
            // Keep each release boundary committed until the burst finishes or cancels.
            a.action_special = true;
        }
    }

    pub fn mirewing_fire(&mut self, i: usize) -> bool {
        if self.actors[i].enemy_phase == MIREWING_HOVERING {
            if let Some(t) = self.actors[i]
                .target
                .and_then(|id| self.actor_index(id))
                .filter(|&t| self.actors[t].alive())
            {
                self.actors[i].action_target_pos = self.actors[t].view.pos;
            }
            self.actors[i].view.state_duration =
                MIREWING_HOVER + (MIREWING_BURST_ROUNDS - 1) as f32 * MIREWING_BURST_GAP;
        }
        let a = &self.actors[i];
        self.projectile(
            i,
            a.target,
            a.action_target_pos,
            false,
            a.stats.atk * MIREWING_ROUND_DAMAGE,
            None,
        );
        self.actors[i].enemy_phase += 1;
        let done = self.actors[i].enemy_phase == MIREWING_FIRE + MIREWING_BURST_ROUNDS - 1;
        if done {
            self.actors[i].target = self.enemy_target(i).map(|t| self.actors[t].view.id);
        } else {
            // Absolute deadlines retain the 0.12-s cadence on the 30-Hz sim clock.
            self.actors[i].view.impact_at += MIREWING_BURST_GAP;
        }
        done
    }
    pub fn boss_time_scale(&self) -> f32 {
        self.modifiers.cooldown_multiplier
    }
    pub fn relocate_enemy(&mut self, i: usize, target: Vec2) {
        let scale = if is_boss(self.actors[i].view.archetype) {
            self.boss_time_scale()
        } else {
            1.
        };
        let a = &mut self.actors[i];
        let delta = a.view.pos - target;
        let turn = a.ai_rng.range(0.8, 1.4);
        let angle =
            libm::atan2f(delta.y, delta.x) + if a.ai_rng.chance(0.5) { turn } else { -turn };
        let distance = a.ai_rng.range(200., 350.);
        a.destination = (a.view.pos + direction(angle) * distance).clamp(
            self.snapshot.arena_min + Vec2::new(80., 80.),
            self.snapshot.arena_max - Vec2::new(80., 80.),
        );
        a.relocate_left = a.ai_rng.range(1.5, 2.5) * scale;
        a.enemy_phase = 3;
        a.velocity = Vec2::default();
    }
    pub fn enemy_ai(&mut self) {
        let n = self.actors.len();
        for i in 0..n {
            if self.actors[i].view.team != Team::Enemy
                || !self.actors[i].tangible()
                || self.actors[i].view.encased > 0.
                || self.actors[i].view.state == ActorState::Spawn
            {
                continue;
            }
            if self.actors[i].view.archetype == Archetype::Mirewing {
                self.mirewing_ai(i);
                continue;
            }
            if is_boss(self.actors[i].view.archetype) && self.actors[i].summon_cd <= 0. {
                self.actors[i].summon_cd = SUMMON_INTERVAL;
                match self.actors[i].view.archetype {
                    // Owner: Chimerilass's threat is bombs and regeneration, never summons.
                    Archetype::BossBomber => {}
                    // Owner: the Djinn's court holds at most 4 snipers and a few bomb lizardos.
                    // Summons top up to those caps instead of stacking without limit.
                    Archetype::BossMarksman => {
                        let living = |kind| {
                            self.actors
                                .iter()
                                .filter(|a| a.view.archetype == kind && a.alive())
                                .count() as u32
                        };
                        if living(Archetype::Sniper) < MARKSMAN_MAX_SNIPERS {
                            for _ in 0..MARKSMAN_SUMMON_SNIPERS
                                .min(MARKSMAN_MAX_SNIPERS - living(Archetype::Sniper))
                                .min(self.enemy_capacity() as u32)
                            {
                                self.spawn_enemy(Archetype::Sniper);
                            }
                        } else if living(Archetype::Lizardo) < MARKSMAN_MAX_LIZARDOS
                            && self.enemy_capacity() > 0
                        {
                            self.spawn_enemy(Archetype::Lizardo);
                        }
                    }
                    _ => {
                        for _ in 0..(SUMMON_COUNT as usize).min(self.enemy_capacity()) {
                            self.spawn_enemy(Archetype::Gobloc);
                        }
                    }
                }
            }
            if self.fortress_step(i) {
                continue;
            }
            if self.actors[i].committed()
                || (self.actors[i].view.archetype == Archetype::Lizardo
                    && self.actors[i].view.state == ActorState::Cast
                    && self.actors[i].action_special
                    && !self.actors[i].action_done)
            {
                continue;
            }
            if self.try_fortress(i) || self.try_enemy_heal(i) {
                continue;
            }
            let Some(mut t) = self.enemy_target(i) else {
                continue;
            };
            #[cfg(feature = "reference-diagnostics")]
            let preferred = t;
            let mut attack_ready = false;
            if is_boss(self.actors[i].view.archetype)
                && !self.boss_basic_next(i)
                && self.actors[i].enemy_phase == 0
                && self.actors[i].recharge_left < 0.
                && !self.hazards.iter().any(|h| {
                    h.view.owner == self.actors[i].view.id
                        && h.view.hostile
                        && h.view.phase != HazardPhase::Resolved
                })
            {
                if let Some(target) = self.select_boss_attack(i, t) {
                    t = target;
                    attack_ready = true;
                }
            }
            #[cfg(feature = "reference-diagnostics")]
            if is_boss(self.actors[i].view.archetype) {
                crate::enmity_attribution::aim(
                    self.actors[i].view.id,
                    preferred != t
                        && self.actors[preferred].view.archetype == Archetype::Fara
                        && self.actors[t].view.archetype != Archetype::Fara,
                );
            }
            let p = self.actors[t].view.pos;
            let id = self.actors[i].view.id;
            let boss = is_boss(self.actors[i].view.archetype);
            if self.actors[i].boss_retry_basic {
                if self.actors[i].view.pos.distance(p)
                    <= self.actors[i].attack_range(&self.actors[t])
                {
                    self.start_action(i, Some(self.actors[t].view.id), false, false);
                    self.actors[i].special_cd =
                        3. * basic_interval_scale(self.actors[i].view.archetype);
                } else {
                    let a = &mut self.actors[i];
                    a.velocity = (p - a.view.pos).normalized() * a.speed();
                    a.view.pos = self
                        .floor
                        .point(a.view.pos + a.velocity * SIM_DT, a.view.radius);
                    a.state(ActorState::Walk, 0., 0.);
                }
                continue;
            }
            if boss
                && self.hazards.iter().any(|h| {
                    h.view.owner == id && h.view.hostile && h.view.phase != HazardPhase::Resolved
                })
            {
                continue;
            }
            if self.actors[i].enemy_phase == 2 {
                if boss {
                    let recharge = self.boss_recharge_duration(i);
                    self.actors[i].recharge_left = recharge
                        * if self.actors[i].barrage_recharge {
                            CHIMERA_BARRAGE_COOLDOWN_SCALE
                        } else {
                            1.
                        };
                    self.actors[i].barrage_recharge = false;
                    self.actors[i].recharge_duration = self.actors[i].recharge_left;
                }
                self.relocate_enemy(i, p);
            }
            if self.actors[i].enemy_phase == 3 {
                if boss
                    && self.actors[i].special_cd <= 0.
                    && self.actors[i].view.pos.distance(p)
                        <= self.actors[i].attack_range(&self.actors[t])
                {
                    self.start_action(i, Some(self.actors[t].view.id), false, false);
                    self.actors[i].special_cd =
                        3. * basic_interval_scale(self.actors[i].view.archetype);
                    continue;
                }
                let a = &mut self.actors[i];
                let delta = a.destination - a.view.pos;
                let time = a.relocate_left.max(SIM_DT);
                a.velocity = delta * (a.movement_scale() / time);
                a.view.pos = self
                    .floor
                    .point(a.view.pos + a.velocity * SIM_DT, a.view.radius);
                a.relocate_left -= SIM_DT * a.movement_scale();
                a.state(ActorState::Walk, 0., 0.);
                if a.relocate_left <= 0. {
                    a.enemy_phase = 0;
                    a.basic_cd = a.basic_cd.max(0.4);
                }
                continue;
            }
            let a = self.actors[i].clone();
            let delta = p - a.view.pos;
            let distance = delta.length();
            let aim = delta.normalized();
            self.actors[i].target = Some(self.actors[t].view.id);
            if delta.x.abs() > 12. {
                self.actors[i].view.facing = if delta.x < 0. {
                    Facing::Left
                } else {
                    Facing::Right
                };
            }
            let mut movement = Vec2::default();
            match a.view.archetype {
                Archetype::Marid => {
                    self.marid_teleport(i);
                    if !self.actors[i].tangible() {
                        continue;
                    }
                    if self.actors[i].basic_cd <= 0.
                        && self.actors[i].view.pos.distance(p)
                            <= self.actors[i].attack_range(&self.actors[t])
                    {
                        self.start_action(i, Some(self.actors[t].view.id), false, false);
                    }
                    continue;
                }
                Archetype::Sniper | Archetype::Lizardo => {
                    let sniper = a.view.archetype == Archetype::Sniper;
                    let (min, max) = if sniper {
                        (SNIPER_MIN, SNIPER_MAX)
                    } else {
                        (LIZARDO_MIN, LIZARDO_MAX)
                    };
                    let min = min + a.formation_offset.x;
                    let max = max + a.formation_offset.x;
                    if distance < min {
                        movement = Vec2::new(-aim.y, aim.x)
                            * a.speed()
                            * if a.formation_offset.y < 0. { -1. } else { 1. };
                    } else if distance > max {
                        movement = aim * a.speed();
                    }
                    if a.basic_cd <= 0. && distance <= max {
                        if !sniper {
                            // Owner-authored pre-throw commitment; the drop/fuse start at release.
                            let origin = p + self.actors[t].velocity * PREDICTION_TIME;
                            if !self.attack_covers_hero(
                                HazardKind::LizardoDrop,
                                i,
                                self.actors[t].view.id,
                                origin,
                                aim,
                            ) {
                                self.actors[i].velocity = aim * a.speed();
                                self.actors[i].view.pos = self
                                    .floor
                                    .point(a.view.pos + aim * a.speed() * SIM_DT, a.view.radius);
                                self.actors[i].state(ActorState::Walk, 0., 0.);
                                continue;
                            }
                            self.enemy_cast(i, LIZARDO_WINDUP);
                            self.actors[i].action_done = false;
                            self.actors[i].action_special = true;
                            self.actors[i].view.impact_at = LIZARDO_WINDUP;
                            self.actors[i].target = Some(self.actors[t].view.id);
                            self.actors[i].view.facing = if aim.x < 0. {
                                Facing::Left
                            } else {
                                Facing::Right
                            };
                            continue;
                        }
                        let origin = a.view.pos;
                        if !self.attack_covers_hero(
                            HazardKind::SniperLine,
                            i,
                            self.actors[t].view.id,
                            origin,
                            aim,
                        ) {
                            self.actors[i].velocity = aim * a.speed();
                            self.actors[i].view.pos = self
                                .floor
                                .point(a.view.pos + aim * a.speed() * SIM_DT, a.view.radius);
                            self.actors[i].state(ActorState::Walk, 0., 0.);
                            continue;
                        }
                        self.hazard(
                            HazardKind::SniperLine,
                            id,
                            Some(self.actors[t].view.id),
                            origin,
                            aim,
                        );
                        self.enemy_cast(i, SNIPER_TRACK + SNIPER_LOCK);
                        self.actors[i].enemy_phase = 2;
                        continue;
                    }
                }
                Archetype::Fizzmite => {
                    // Encase can end the Cast pose while its independent body fuse is live.
                    if a.basic_cd == f32::MAX {
                        continue;
                    }
                    if distance <= FIZZMITE_TRIGGER {
                        self.hazard(
                            HazardKind::FizzmiteBlast,
                            id,
                            Some(self.actors[t].view.id),
                            a.view.pos,
                            aim,
                        );
                        self.enemy_cast(i, FIZZMITE_COUNTDOWN);
                        self.actors[i].basic_cd = f32::MAX;
                        continue;
                    }
                    movement = aim * a.speed();
                }
                Archetype::Boss | Archetype::BossBomber | Archetype::BossMarksman => {
                    let mut forced_approach = false;
                    if attack_ready {
                        let kind = self.boss_attack_kind(i);
                        let origin = if kind == HazardKind::BossCone {
                            a.cone_origin(aim)
                        } else if kind == HazardKind::LizardoDrop {
                            p
                        } else {
                            a.view.pos
                        };
                        let target = self.actors[t].view.id;
                        forced_approach = self.taunt_target(i).is_some();
                        let area_denial =
                            kind == HazardKind::LizardoDrop && a.boss_attack.barrage_mode() != 0;
                        if area_denial || self.attack_covers_hero(kind, i, target, origin, aim) {
                            let mut duration = 0.0f32;
                            if kind == HazardKind::BossStompStep {
                                duration = self.spawn_marching_stomp(i, t);
                            } else if kind == HazardKind::LizardoDrop {
                                let Some(fill) =
                                    self.spawn_chimera_barrage(i, t, a.boss_attack.barrage_mode())
                                else {
                                    if a.boss_attack == crate::enmity::BossAttack::Fortress {
                                        self.prepare_fortress(i);
                                    }
                                    continue;
                                };
                                duration = fill;
                                self.actors[i].barrage_serial += 1;
                            } else if a.boss_attack == crate::enmity::BossAttack::Twin {
                                let angle = libm::atan2f(aim.y, aim.x);
                                let spread = 18. * core::f32::consts::PI / 180.;
                                // Both diverging lines must cover a living hero before either starts.
                                let left = direction(angle - spread);
                                let right = direction(angle + spread);
                                if !self.attack_covers_hero(kind, i, target, origin, left)
                                    || !self.attack_covers_hero(kind, i, target, origin, right)
                                {
                                    // Retain the bank; a taunted boss closes until Fara is coverable.
                                    if distance <= a.attack_range(&self.actors[t])
                                        && !forced_approach
                                    {
                                        if a.special_cd <= 0. {
                                            self.start_action(i, Some(target), false, false);
                                            self.actors[i].special_cd = 3.
                                                * basic_interval_scale(
                                                    self.actors[i].view.archetype,
                                                );
                                        }
                                    } else {
                                        self.actors[i].velocity = aim * a.speed();
                                        self.actors[i].view.pos = self.floor.point(
                                            a.view.pos + aim * a.speed() * SIM_DT,
                                            a.view.radius,
                                        );
                                        self.actors[i].state(ActorState::Walk, 0., 0.);
                                    }
                                    continue;
                                }
                                for offset in [-spread, spread] {
                                    self.hazard(
                                        kind,
                                        id,
                                        Some(target),
                                        origin,
                                        direction(angle + offset),
                                    );
                                    let h = self.hazards.last_mut().unwrap();
                                    h.aim_offset = offset;
                                    duration = h.tracking + h.duration;
                                }
                            } else {
                                self.hazard(kind, id, Some(target), origin, aim);
                                let h = self.hazards.last().unwrap();
                                duration = h.tracking + h.duration;
                            }
                            if kind != HazardKind::LizardoDrop {
                                self.actors[i].barrage_recharge = false;
                            }
                            self.record_boss_attack(i);
                            self.actors[i].boss_retry_special = false;
                            self.actors[i].serial += 1;
                            self.enemy_cast(i, duration);
                            self.actors[i].view.energy = 0.;
                            self.actors[i].enemy_phase = 2;
                            continue;
                        }
                    }
                    if distance > a.attack_range(&self.actors[t]) || forced_approach {
                        movement = aim * a.speed();
                    }
                    // Regular melee remains dangerous throughout recharge.
                    else if a.special_cd <= 0. {
                        self.start_action(i, Some(self.actors[t].view.id), false, false);
                        self.actors[i].special_cd =
                            3. * basic_interval_scale(self.actors[i].view.archetype);
                        continue;
                    }
                }
                kind if crate::wfm::is_wfm(kind) => {
                    if distance > a.attack_range(&self.actors[t]) {
                        movement = aim * a.speed();
                    } else if a.basic_cd <= 0. {
                        self.wfm_start_action(i, t);
                        continue;
                    }
                }
                _ => {
                    if distance > a.attack_range(&self.actors[t]) {
                        movement = (delta + a.formation_offset).normalized() * a.speed();
                    } else if a.basic_cd <= 0. {
                        self.start_action(i, Some(self.actors[t].view.id), false, false);
                        continue;
                    }
                }
            }
            self.actors[i].velocity = movement;
            self.actors[i].view.pos = self
                .floor
                .point(a.view.pos + movement * SIM_DT, a.view.radius);
            self.actors[i].state(
                if movement.length() > 0. {
                    ActorState::Walk
                } else {
                    ActorState::Idle
                },
                0.,
                0.,
            );
        }
    }
    pub fn lizardo_throw(&mut self, i: usize, target: Option<usize>) {
        let valid = target.filter(|&t| self.actors[t].alive());
        if let Some(t) = valid {
            let a = &self.actors[i];
            let origin = self.actors[t].view.pos
                + self.actors[t].velocity * PREDICTION_TIME
                + direction(self.spawn_rng.range(0., TAU)) * self.spawn_rng.range(0., BOMB_SCATTER);
            let aim = (self.actors[t].view.pos - a.view.pos).normalized();
            if self.attack_covers_hero(
                HazardKind::LizardoDrop,
                i,
                self.actors[t].view.id,
                origin,
                aim,
            ) {
                let hazard = self.hazard(
                    HazardKind::LizardoDrop,
                    a.view.id,
                    Some(self.actors[t].view.id),
                    origin,
                    aim,
                );
                self.projectile(i, None, origin, true, 0., Some(hazard));
                self.enemy_cast(i, BOMB_TIME);
                self.actors[i].enemy_phase = 2;
                return;
            }
        }
        let a = &mut self.actors[i];
        a.basic_cd = 0.;
        a.action_done = true;
        a.action_heal = false;
        a.action_special = false;
        a.enemy_phase = 0;
        a.state(ActorState::Idle, 0., 0.);
    }
    pub fn enemy_cast(&mut self, i: usize, duration: f32) {
        let scale = if is_boss(self.actors[i].view.archetype) {
            self.boss_time_scale()
        } else {
            1.
        };
        let a = &mut self.actors[i];
        a.state(ActorState::Cast, duration, duration);
        a.action_done = true;
        a.action_heal = false;
        a.action_special = false;
        a.action_revive = false;
        a.velocity = Vec2::default();
        a.basic_cd = a.stats.interval * scale;
        self.events.push(Event::ActionStarted {
            id: a.view.id,
            target: a.target,
            state: ActorState::Cast,
        });
    }
}
