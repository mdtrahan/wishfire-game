use crate::{
    actors::hero_index,
    api::*,
    math::{contains, direction},
    tuning::*,
    Sim,
};

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum HitPolicy {
    Snapshot,
    Continuous,
    Front,
}
#[derive(Clone, Debug)]
pub struct Hazard {
    pub view: HazardView,
    pub age: f32,
    pub action_epoch: u64,
    pub tracking: f32,
    pub duration: f32,
    pub phase_age: f32,
    pub pulse: f32,
    pub damage: f32,
    pub phase_rule: Option<PhaseRule>,
    pub base_duration: f32,
    pub base_damage: f32,
    pub target: Option<u32>,
    /// Fixed unclamped landing point, for a clamped pool’s locked recipient only.
    pub landing_target_pos: Option<Vec2>,
    /// Observation only: feet contact immediately before Ground Pound resolution/push.
    pub target_contact: Option<bool>,
    pub target_alive_at_resolve: bool,
    pub target_distance_at_resolve: f32,
    pub cancelled: bool,
    pub aim_offset: f32,
    pub policy: HitPolicy,
    pub delay: [f32; 4],
    pub perception_pending: bool,
    pub known: [bool; 4],
    pub revive_target: Option<u32>,
    pub spawn_kind: Option<Archetype>,
    pub front_hit: [bool; 4],
    pub front_damaged: [bool; 4],
}
impl Hazard {
    /// Ground warnings hit feet; physical sniper bolts retain body contact.
    pub fn hit_radius(&self, body: f32) -> f32 {
        if self.view.kind == HazardKind::GroundPound {
            return 0.;
        }
        if self.view.team == Team::Enemy
            && !matches!(
                self.view.kind,
                HazardKind::SniperLine | HazardKind::BossSnipe | HazardKind::KajaAura
            )
        {
            0.
        } else {
            body
        }
    }

    pub fn hits(&self, p: Vec2, body: f32) -> bool {
        contains(self.view.shape, self.view.origin, self.view.dir, p, body)
            || self.burst_hits(p, body)
    }
    pub fn burst_hits(&self, p: Vec2, body: f32) -> bool {
        self.view.kind == HazardKind::GroundPound
            && match self.view.shape {
                Shape::Line { length, .. } => {
                    p.distance(self.view.origin + self.view.dir * length)
                        <= GROUND_POUND_BURST_RADIUS + body
                }
                _ => false,
            }
    }
    pub fn affects(&self, id: u32, pos: Vec2, body: f32) -> bool {
        self.hits(pos, self.hit_radius(body))
            || (self.target == Some(id)
                && match self.view.kind {
                    HazardKind::BubblePop | HazardKind::ArcanePulse => true,
                    HazardKind::FazePool | HazardKind::HealingSpring => self
                        .landing_target_pos
                        .is_some_and(|point| match self.view.shape {
                            Shape::Circle { radius } => pos.distance(point) <= radius,
                            _ => false,
                        }),
                    _ => false,
                })
    }
    pub fn remaining(&self) -> f32 {
        (self.duration - self.phase_age).max(0.)
    }
}
impl Sim {
    pub fn sync_hero_areas(&mut self) {
        for i in 0..self.hazards.len() {
            if matches!(
                self.hazards[i].view.kind,
                HazardKind::BubblePop | HazardKind::ArcanePulse | HazardKind::GroundPound
            ) && self.spotlight_advances_hazard(&self.hazards[i])
                && self.hazards[i].view.phase == HazardPhase::Locked
            {
                let mut h = self.hazards[i].clone();
                self.track_hero_area(&mut h);
                self.hazards[i] = h;
            }
        }
    }
    pub fn track_hero_area(&self, h: &mut Hazard) {
        if !matches!(
            h.view.kind,
            HazardKind::GroundPound | HazardKind::BubblePop | HazardKind::ArcanePulse
        ) || h.view.phase != HazardPhase::Locked
        {
            return;
        }
        // A lost target freezes the last complete geometry, including the caster origin.
        let Some(t) = h
            .target
            .and_then(|id| self.actor_index(id))
            .filter(|&t| self.actors[t].alive())
        else {
            return;
        };
        if let Shape::Circle { radius } = h.view.shape {
            h.view.origin = self.floor.point(self.actors[t].view.pos, radius);
            return;
        }
        if let Some(s) = self
            .actor_index(h.view.owner)
            .filter(|&s| self.actors[s].alive())
        {
            h.view.origin = self.actors[s].view.pos;
        }
        let delta = self.actors[t].view.pos - h.view.origin;
        if delta.length() > 0.00001 {
            h.view.dir = delta.normalized();
        }
        h.view.shape = Shape::Line {
            length: delta.length() + self.actors[t].view.radius,
            width: GROUND_POUND_WIDTH,
        };
    }
    pub fn resolve_front_event(&mut self, h: &Hazard) {
        let victims = self.events.victim_start();
        for a in &self.actors {
            if hero_index(a.view.archetype).is_some_and(|k| h.front_damaged[k]) {
                self.events.victim(a.view.id);
            }
        }
        self.events.resolved(h.view.id, h.view.kind, victims);
    }
    pub fn hazard_spec(
        &self,
        kind: HazardKind,
        target: Option<u32>,
        origin: Vec2,
        dir: Vec2,
    ) -> (Shape, f32, f32, FillMode, bool, u8, HitPolicy) {
        match kind {
            HazardKind::RallyAura => (
                Shape::Circle {
                    radius: RALLY_RADIUS,
                },
                0.,
                1e6,
                FillMode::Drain,
                false,
                1,
                HitPolicy::Continuous,
            ),
            HazardKind::SniperLine | HazardKind::BossSnipe => (
                Shape::Line {
                    length: f32::INFINITY,
                    width: if kind == HazardKind::BossSnipe {
                        DJINN_BEAM_WIDTH
                    } else {
                        SNIPER_WIDTH
                    },
                },
                SNIPER_TRACK,
                SNIPER_LOCK,
                FillMode::Countdown,
                true,
                1,
                HitPolicy::Snapshot,
            ),
            HazardKind::LizardoDrop => (
                Shape::Circle {
                    radius: BOMB_RADIUS,
                },
                0.,
                BOMB_TIME,
                FillMode::Countdown,
                true,
                1,
                HitPolicy::Snapshot,
            ),
            HazardKind::FizzmiteBlast => (
                Shape::Circle {
                    radius: FIZZMITE_RADIUS,
                },
                0.,
                FIZZMITE_FUSE,
                FillMode::Countdown,
                true,
                2,
                HitPolicy::Snapshot,
            ),
            HazardKind::BossNova => (
                Shape::Circle {
                    radius: NOVA_RADIUS,
                },
                0.,
                NOVA_LOCK,
                FillMode::TwoWay,
                true,
                2,
                HitPolicy::Snapshot,
            ),
            HazardKind::Resurrect => (
                Shape::Circle {
                    radius: REVIVE_RANGE,
                },
                0.,
                REVIVE_CHANNEL,
                FillMode::Countdown,
                false,
                0,
                HitPolicy::Snapshot,
            ),
            HazardKind::BossStompStep => (
                Shape::Circle {
                    radius: STOMP_RADIUS,
                },
                0.,
                STOMP_FILL,
                FillMode::Countdown,
                true,
                2,
                HitPolicy::Snapshot,
            ),
            HazardKind::BossSlam => (
                Shape::Circle {
                    radius: SLAM_RADIUS + self.modifiers.slam_radius_bonus,
                },
                0.,
                SLAM_LOCK,
                FillMode::Countdown,
                true,
                2,
                HitPolicy::Snapshot,
            ),
            HazardKind::BossCone => (
                Shape::Cone {
                    length: CONE_LENGTH,
                    half_angle_rad: CONE_HALF_ANGLE,
                },
                CONE_TRACK,
                CONE_LOCK,
                FillMode::Countdown,
                true,
                1,
                HitPolicy::Snapshot,
            ),
            HazardKind::BossCharge => (
                Shape::Line {
                    length: self.floor.ray(
                        origin,
                        dir,
                        target
                            .and_then(|id| self.actor_index(id))
                            .map(|t| origin.distance(self.actors[t].view.pos))
                            .unwrap_or(350.)
                            .clamp(180., 600.)
                            + BOSS_BODY_RADIUS,
                    ),
                    width: CHARGE_WIDTH,
                },
                CHARGE_TRACK,
                CHARGE_LOCK,
                FillMode::Countdown,
                true,
                2,
                HitPolicy::Front,
            ),
            HazardKind::SpawnMarker => (
                Shape::Circle {
                    radius: SPAWN_MARKER_RADIUS,
                },
                0.,
                SPAWN_COUNTDOWN,
                FillMode::Countdown,
                false,
                0,
                HitPolicy::Snapshot,
            ),
            // Retained frozen API variant; Crimson Ward never creates a hazard.
            HazardKind::WardRing => (
                Shape::Circle { radius: 0. },
                0.,
                0.,
                FillMode::Drain,
                false,
                0,
                HitPolicy::Continuous,
            ),
            HazardKind::ElevateRing => (
                Shape::Circle {
                    radius: ELEVATE_RADIUS,
                },
                0.,
                ELEVATE_DURATION,
                FillMode::Drain,
                false,
                0,
                HitPolicy::Continuous,
            ),
            HazardKind::FazePool => (
                Shape::Circle {
                    radius: FAZE_RADIUS,
                },
                0.,
                FAZE_DURATION,
                FillMode::Drain,
                true,
                1,
                HitPolicy::Continuous,
            ),
            HazardKind::HealingSpring => (
                Shape::Circle {
                    radius: FAZE_RADIUS,
                },
                0.,
                HEALING_SPRING_SECONDS,
                FillMode::Drain,
                false,
                1,
                HitPolicy::Continuous,
            ),
            HazardKind::BubbleAura => (
                Shape::Circle {
                    radius: BUBBLE_AURA_RADIUS,
                },
                0.,
                f32::MAX,
                FillMode::Loop,
                true,
                0,
                HitPolicy::Continuous,
            ),
            HazardKind::KajaAura => (
                Shape::Circle {
                    radius: AURA_RADIUS,
                },
                0.,
                f32::MAX,
                FillMode::Loop,
                true,
                0,
                HitPolicy::Continuous,
            ),
            HazardKind::GroundPound => (
                Shape::Line {
                    length: target
                        .and_then(|id| self.actor_index(id))
                        .map_or(GROUND_POUND_LENGTH, |t| {
                            origin.distance(self.actors[t].view.pos) + self.actors[t].view.radius
                        }),
                    width: GROUND_POUND_WIDTH,
                },
                0.,
                GROUND_POUND_COUNTDOWN,
                FillMode::Countdown,
                true,
                1,
                HitPolicy::Snapshot,
            ),
            HazardKind::ArcanePulse => (
                Shape::Circle {
                    radius: ARCANE_PULSE_RADIUS,
                },
                0.,
                ARCANE_PULSE_COUNTDOWN,
                FillMode::Countdown,
                true,
                1,
                HitPolicy::Snapshot,
            ),
            HazardKind::BubblePop => (
                Shape::Circle {
                    radius: BUBBLE_RADIUS,
                },
                0.,
                CAST_IMPACT,
                FillMode::Countdown,
                true,
                1,
                HitPolicy::Snapshot,
            ),
        }
    }
    pub fn cone_shape(&self, owner: u32) -> Shape {
        let djinn = self
            .actor_index(owner)
            .is_some_and(|i| self.actors[i].view.archetype == Archetype::BossMarksman);
        Shape::Cone {
            length: if djinn { f32::INFINITY } else { CONE_LENGTH },
            half_angle_rad: CONE_HALF_ANGLE
                - if djinn {
                    MARKSMAN_CONE_HALF_REDUCTION
                } else {
                    0.
                },
        }
    }
    pub fn attack_footprint(
        &self,
        kind: HazardKind,
        owner: usize,
        target: u32,
        origin: Vec2,
        dir: Vec2,
    ) -> Shape {
        let a = &self.actors[owner];
        let shape = if kind == HazardKind::BossCone {
            self.cone_shape(a.view.id)
        } else {
            self.hazard_spec(kind, Some(target), origin, dir).0
        };
        let mut rule = if a.view.enraged { a.phase_rule } else { None };
        if matches!(kind, HazardKind::SniperLine | HazardKind::BossSnipe) {
            if let Some(r) = &mut rule {
                r.length_scale = 1.;
                r.width_scale = 1.5;
            }
        }
        scaled_shape_in(self.floor, shape, rule, origin, dir)
    }
    pub fn attack_covers_hero(
        &self,
        kind: HazardKind,
        owner: usize,
        target: u32,
        origin: Vec2,
        dir: Vec2,
    ) -> bool {
        if kind == HazardKind::BossStompStep {
            return self
                .actor_index(target)
                .is_some_and(|t| self.stomp_covers(owner, t));
        }
        let shape = self.attack_footprint(kind, owner, target, origin, dir);
        self.actors.iter().any(|h| {
            h.view.team == Team::Hero
                && h.alive()
                && self
                    .taunt_target(owner)
                    .is_none_or(|t| h.view.id == self.actors[t].view.id)
                && contains(shape, origin, dir, h.view.pos, h.view.radius)
        })
    }
    pub fn hazard(
        &mut self,
        kind: HazardKind,
        owner: u32,
        target: Option<u32>,
        origin: Vec2,
        dir: Vec2,
    ) -> u32 {
        let origin = self.floor.point(origin, 0.);
        let dir = dir.normalized();
        let id = self.next_id;
        self.next_id += 1;
        let (mut shape, tracking, duration, fill, hostile, tier, policy) =
            self.hazard_spec(kind, target, origin, dir);
        if kind == HazardKind::BossCone {
            shape = self.cone_shape(owner);
        }
        let boss_hazard = matches!(
            kind,
            HazardKind::BossCharge
                | HazardKind::BossSlam
                | HazardKind::BossStompStep
                | HazardKind::BossCone
                | HazardKind::BossNova
        );
        let scale = if boss_hazard {
            self.boss_time_scale()
        } else {
            1.
        };
        let tracking = tracking * scale;
        let source = self.actor_index(owner);
        if kind == HazardKind::FizzmiteBlast {
            if let Some(i) = source {
                self.actors[i].basic_cd = f32::MAX;
            }
        }
        let team = source
            .map(|i| self.actors[i].view.team)
            .unwrap_or(Team::Enemy);
        let mut phase_rule = source
            .filter(|&i| self.actors[i].view.enraged && hostile)
            .and_then(|i| self.actors[i].phase_rule);
        if kind == HazardKind::BossSnipe {
            if let Some(r) = &mut phase_rule {
                r.length_scale = 1.;
                r.width_scale = 1.5;
            }
        }
        shape = scaled_shape_in(self.floor, shape, phase_rule, origin, dir);
        if kind == HazardKind::GroundPound
            && (target.is_some_and(|id| self.actor_index(id).is_none())
                || source.is_some_and(|s| self.actors[s].action_target_teleported))
        {
            if let Some(s) = source {
                // Keep the cast gate at 300; a committed eruption reaches even a lost target’s last point.
                shape = Shape::Line {
                    length: origin.distance(self.actors[s].action_target_pos)
                        + self.actors[s].action_target_radius,
                    width: GROUND_POUND_WIDTH,
                };
            }
        }
        let base_duration = duration;
        let duration = countdown(kind, shape, base_duration);
        let damage = source.map(|i| self.actors[i].stats.atk).unwrap_or(0.)
            * if matches!(
                kind,
                HazardKind::BubbleAura | HazardKind::HealingSpring | HazardKind::RallyAura
            ) {
                0.
            } else if kind == HazardKind::BossStompStep {
                STOMP_DAMAGE
            } else if kind == HazardKind::BubblePop {
                BUBBLE_POTENCY
            } else if kind == HazardKind::GroundPound {
                GROUND_POUND_POTENCY
            } else if matches!(kind, HazardKind::FazePool | HazardKind::ArcanePulse) {
                (if kind == HazardKind::ArcanePulse {
                    ARCANE_PULSE_POTENCY
                } else {
                    FAZE_POTENCY
                }) * if source
                    .is_some_and(|i| self.actors[i].view.elevate == Some(ElevateVariant::Sword))
                {
                    1. + ELEVATE_BONUS
                } else {
                    1.
                }
            } else {
                1.
            };
        let base_damage = damage;
        let damage = damage * (duration / base_duration).max(1.);
        let phase = if tracking > 0. {
            HazardPhase::Tracking
        } else if policy == HitPolicy::Continuous {
            HazardPhase::Active
        } else {
            HazardPhase::Locked
        };
        let mut h = Hazard {
            view: HazardView {
                id,
                kind,
                team,
                hostile,
                shape,
                origin,
                dir: dir.normalized(),
                fill,
                phase,
                progress: if fill == FillMode::Drain { 1. } else { 0. },
                width_scale: if matches!(kind, HazardKind::SniperLine | HazardKind::BossSnipe) {
                    1. / SNIPER_WIDEN
                } else {
                    1.
                },
                owner,
                tier,
            },
            age: 0.,
            action_epoch: self
                .actor_index(owner)
                .map_or(0, |i| self.actors[i].action_epoch),
            tracking,
            duration,
            phase_age: 0.,
            pulse: 0.,
            damage,
            phase_rule,
            base_duration,
            base_damage,
            target,
            landing_target_pos: None,
            aim_offset: 0.,
            policy,
            delay: [0.; 4],
            perception_pending: self.spotlight.active.is_some(),
            known: [false; 4],
            revive_target: None,
            spawn_kind: None,
            front_hit: [false; 4],
            front_damaged: [false; 4],
            target_contact: None,
            target_alive_at_resolve: false,
            target_distance_at_resolve: 0.,
            cancelled: false,
        };
        if !h.perception_pending {
            self.start_perception(&mut h);
        }
        self.spotlight_hazard(&h);
        #[cfg(feature = "reference-diagnostics")]
        crate::target_lock_metrics::hazard_created(self, &h);
        self.hazards.push(h);
        self.events.push(Event::HazardSpawned { id, kind });
        id
    }
    pub fn start_perception(&mut self, h: &mut Hazard) {
        for a in &mut self.actors {
            if let Some(i) = hero_index(a.view.archetype) {
                let behind = if a.view.facing == Facing::Right {
                    h.view.origin.x < a.view.pos.x
                } else {
                    h.view.origin.x > a.view.pos.x
                };
                h.delay[i] = a.ai_rng.range(REACTION_MIN, REACTION_MAX)
                    + if behind { BEHIND_DELAY } else { 0. };
            }
        }
    }
    pub fn update_hazards(&mut self) {
        self.cancel_dead_boss_moves();
        if self.spotlight.active.is_none() {
            // Even a one-shot resolved during Performing owes its deferred perception draws.
            // Initialize before pruning so every other actor RNG stays frozen until resume.
            for i in 0..self.hazards.len() {
                if self.hazards[i].perception_pending {
                    let mut h = self.hazards[i].clone();
                    self.start_perception(&mut h);
                    h.perception_pending = false;
                    self.hazards[i] = h;
                }
            }
            self.hazards
                .retain(|h| h.view.phase != HazardPhase::Resolved);
        }
        for i in 0..self.hazards.len() {
            if !self.spotlight_advances_hazard(&self.hazards[i]) {
                continue;
            }
            let mut h = self.hazards[i].clone();
            self.track_hero_area(&mut h);
            h.age += SIM_DT;
            let movement_scale =
                if h.view.kind == HazardKind::BossCharge && h.view.phase == HazardPhase::Active {
                    self.actor_index(h.view.owner)
                        .map_or(1., |s| self.actors[s].movement_scale())
                } else {
                    1.
                };
            h.phase_age += SIM_DT * movement_scale;
            let source = self
                .actor_index(h.view.owner)
                .filter(|i| self.actors[*i].alive());
            if h.view.phase == HazardPhase::Tracking {
                if source.is_none() {
                    h.view.phase = HazardPhase::Resolved;
                    self.events.resolved_empty(h.view.id, h.view.kind);
                    #[cfg(feature = "reference-diagnostics")]
                    if self.trial_hazard == Some(h.view.id) {
                        self.finish_trial();
                    }
                    self.hazards[i] = h;
                    continue;
                }
                let tracked = h.target.and_then(|id| self.actor_index(id)).filter(|&t| {
                    !source.is_some_and(|s| is_boss(self.actors[s].view.archetype))
                        || self.actors[t].alive()
                });
                if h.view.kind != HazardKind::BossCharge || tracked.is_some() {
                    if let Some(s) = source {
                        let pos = self.actors[s].view.pos;
                        if let Some(t) = tracked {
                            let aim = (self.actors[t].view.pos - pos).normalized();
                            let angle = libm::atan2f(aim.y, aim.x) + h.aim_offset;
                            h.view.dir = direction(angle);
                        }
                        h.view.origin = if h.view.kind == HazardKind::BossCone && self.autonomous()
                        {
                            self.actors[s].cone_origin(h.view.dir)
                        } else {
                            pos
                        };
                    }
                    // Tracking changes aim/target distance; freeze geometry and its clock at lock.
                    let shape = match h.view.shape {
                        Shape::Line { .. } if h.view.kind == HazardKind::BossCharge => {
                            Shape::Line {
                                length: h
                                    .target
                                    .and_then(|id| self.actor_index(id))
                                    .map(|t| h.view.origin.distance(self.actors[t].view.pos))
                                    .unwrap()
                                    .clamp(180., 600.)
                                    + BOSS_BODY_RADIUS,
                                width: CHARGE_WIDTH,
                            }
                        }
                        Shape::Line { .. } => Shape::Line {
                            length: f32::INFINITY,
                            width: if h.view.kind == HazardKind::BossSnipe {
                                DJINN_BEAM_WIDTH
                            } else {
                                SNIPER_WIDTH
                            },
                        },
                        Shape::Cone { .. } => self.cone_shape(h.view.owner),
                        shape => shape,
                    };
                    h.view.origin = self.floor.point(h.view.origin, 0.);
                    h.view.shape =
                        scaled_shape_in(self.floor, shape, h.phase_rule, h.view.origin, h.view.dir);
                    h.duration = countdown(h.view.kind, h.view.shape, h.base_duration);
                    h.damage = h.base_damage * (h.duration / h.base_duration).max(1.);
                }
                if h.phase_age + 0.00001 >= h.tracking {
                    h.view.phase = HazardPhase::Locked;
                    h.phase_age = 0.;
                    #[cfg(feature = "reference-diagnostics")]
                    if self.trial_hazard == Some(h.view.id) {
                        if let Some(k) = self
                            .actors
                            .first()
                            .and_then(|a| hero_index(a.view.archetype))
                        {
                            self.trial_delay = h.delay[k];
                        }
                    }
                }
            }
            if matches!(
                h.view.kind,
                HazardKind::WardRing
                    | HazardKind::ElevateRing
                    | HazardKind::KajaAura
                    | HazardKind::BubbleAura
                    | HazardKind::RallyAura
            ) && h.revive_target.is_none()
            {
                if let Some(s) = source {
                    h.view.origin = self.actors[s].view.pos;
                } else if matches!(
                    h.view.kind,
                    HazardKind::KajaAura | HazardKind::BubbleAura | HazardKind::RallyAura
                ) {
                    h.view.phase = HazardPhase::Resolved;
                    self.events.resolved_empty(h.view.id, h.view.kind);
                }
            }
            if h.revive_target.is_some() && source.is_none() {
                h.view.phase = HazardPhase::Resolved;
                self.events.resolved_empty(h.view.id, h.view.kind);
            }
            if matches!(h.view.phase, HazardPhase::Tracking | HazardPhase::Locked)
                && h.view.team == Team::Enemy
                && h.view.hostile
            {
                for a in &self.actors {
                    if let Some(k) = hero_index(a.view.archetype) {
                        if a.alive() && !h.known[k] && h.age + 0.00001 >= h.delay[k] {
                            h.known[k] = true;
                            self.events.push(Event::Noticed {
                                id: a.view.id,
                                hazard: h.view.id,
                            });
                        }
                    }
                }
            }
            if h.view.kind == HazardKind::ElevateRing && source.is_none() {
                h.view.phase = HazardPhase::Resolved;
            }
            let fraction = if h.phase_age + 0.00001 >= h.duration {
                1.
            } else {
                (h.phase_age / h.duration).clamp(0., 1.)
            };
            h.view.progress = match h.view.fill {
                FillMode::Countdown | FillMode::TwoWay => {
                    if h.view.phase == HazardPhase::Tracking {
                        0.
                    } else if h.policy == HitPolicy::Front && h.view.phase == HazardPhase::Active {
                        1.
                    } else {
                        fraction
                    }
                }
                FillMode::Drain => 1. - fraction,
                FillMode::Loop => h.age.fract(),
            };
            if matches!(h.view.kind, HazardKind::SniperLine | HazardKind::BossSnipe) {
                h.view.width_scale = if h.view.phase == HazardPhase::Tracking {
                    1. / SNIPER_WIDEN
                } else {
                    1. / SNIPER_WIDEN + (1. - 1. / SNIPER_WIDEN) * fraction
                };
            }
            self.hazards[i] = h;
        }
    }
    pub fn resolve_hazards(&mut self) {
        let n = self.hazards.len();
        for i in 0..n {
            if let Some(owner) = self
                .actor_index(self.hazards[i].view.owner)
                .filter(|&owner| {
                    is_boss(self.actors[owner].view.archetype) && !self.actors[owner].alive()
                })
            {
                self.cancel_boss_moves_on_death(self.actors[owner].view.id);
            }
            if self.hazards[i].cancelled {
                continue;
            }
            if !self.spotlight_advances_hazard(&self.hazards[i]) {
                continue;
            }
            let mut h = self.hazards[i].clone();
            #[cfg(feature = "reference-diagnostics")]
            crate::target_lock_metrics::scope(h.view.id, false);
            #[cfg(feature = "reference-diagnostics")]
            crate::enmity_attribution::hazard(h.view.kind);
            // Enemy movement occurs after update_hazards; aim again at the resolve instant.
            self.track_hero_area(&mut h);
            if matches!(h.view.phase, HazardPhase::Tracking | HazardPhase::Resolved) {
                continue;
            }
            if matches!(h.view.kind, HazardKind::SniperLine | HazardKind::BossSnipe) {
                if h.view.phase == HazardPhase::Locked && h.phase_age + 0.00001 >= h.duration {
                    // The locked warning ends at launch. Only the travelling front can hit.
                    h.view.phase = HazardPhase::Active;
                    h.phase_age = 0.;
                    h.duration = shape_size(h.view.shape) / SNIPER_BOLT_SPEED;
                    h.view.progress = 0.;
                    self.sniper_bolt(&h);
                } else if h.view.phase == HazardPhase::Active {
                    if h.phase_age + 0.00001 >= h.duration {
                        h.view.phase = HazardPhase::Resolved;
                        self.resolve_front_event(&h);
                        #[cfg(feature = "reference-diagnostics")]
                        if self.trial_hazard == Some(h.view.id) {
                            self.finish_trial();
                        }
                    }
                }
                self.hazards[i] = h;
                continue;
            }
            if h.policy == HitPolicy::Front {
                let source = self
                    .actor_index(h.view.owner)
                    .filter(|s| self.actors[*s].alive());
                if source.is_none() {
                    h.view.phase = HazardPhase::Resolved;
                    self.resolve_front_event(&h);
                } else if h.view.phase == HazardPhase::Locked && h.phase_age + 0.00001 >= h.duration
                {
                    h.view.phase = HazardPhase::Active;
                    h.phase_age = 0.;
                    let length = match h.view.shape {
                        Shape::Line { length, .. } => length,
                        _ => 0.,
                    };
                    h.duration = (length - BOSS_BODY_RADIUS).max(0.) / CHARGE_SPEED;
                } else if h.view.phase == HazardPhase::Active {
                    let s = source.unwrap();
                    let start = self.actors[s].view.pos;
                    let dt = SIM_DT * self.actors[s].movement_scale();
                    let travel = CHARGE_SPEED * dt.min(h.remaining() + dt);
                    let end = (start + h.view.dir * travel).clamp(
                        self.snapshot.arena_min + Vec2::new(BOSS_BODY_RADIUS, BOSS_BODY_RADIUS),
                        self.snapshot.arena_max - Vec2::new(BOSS_BODY_RADIUS, BOSS_BODY_RADIUS),
                    );
                    self.actors[s].view.pos = end;
                    self.actors[s].velocity =
                        h.view.dir * (CHARGE_SPEED * self.actors[s].movement_scale());
                    self.actors[s].heading = h.view.dir;
                    self.actors[s].state(ActorState::Walk, 0., 0.);
                    for j in 0..self.actors.len() {
                        if let Some(k) = hero_index(self.actors[j].view.archetype) {
                            let front = start + h.view.dir * self.actors[s].view.radius;
                            if self.actors[j].tangible()
                                && !h.front_hit[k]
                                && contains(
                                    Shape::Line {
                                        length: travel,
                                        width: line_width(h.view.shape),
                                    },
                                    front,
                                    h.view.dir,
                                    self.actors[j].view.pos,
                                    0.,
                                )
                            {
                                #[cfg(feature = "bound-diagnostics")]
                                crate::bound::caught(self, &h, j);
                                h.front_hit[k] = true;
                                #[cfg(feature = "reference-diagnostics")]
                                if self.trial_hazard == Some(h.view.id) {
                                    self.trial_landed = true;
                                }
                                if self.damage_limited(
                                    h.view.owner,
                                    j,
                                    h.damage,
                                    true,
                                    true,
                                    Element::Physical,
                                    None,
                                    true,
                                ) > 0.
                                {
                                    h.front_damaged[k] = true;
                                }
                            }
                        }
                    }
                    if h.phase_age + 0.00001 >= h.duration {
                        h.view.phase = HazardPhase::Resolved;
                        self.resolve_front_event(&h);
                    }
                }
                #[cfg(feature = "reference-diagnostics")]
                if h.view.phase == HazardPhase::Resolved && self.trial_hazard == Some(h.view.id) {
                    self.finish_trial();
                }
                self.hazards[i] = h;
                continue;
            }
            if h.policy == HitPolicy::Continuous {
                if !matches!(
                    h.view.kind,
                    HazardKind::FazePool | HazardKind::HealingSpring
                ) {
                    h.pulse += SIM_DT;
                }
                if h.view.kind == HazardKind::HealingSpring
                    && h.phase_age - h.pulse + 0.00001 >= HEALING_SPRING_TICK
                {
                    h.pulse += HEALING_SPRING_TICK;
                    let mut total_healed = 0.;
                    for a in &mut self.actors {
                        if a.alive()
                            && a.view.team == Team::Hero
                            && h.affects(a.view.id, a.view.pos, 0.)
                        {
                            let amount = (a.view.max_hp * HEALING_SPRING_FRACTION)
                                .min((a.view.max_hp - a.view.hp).max(0.));
                            if amount > 0. {
                                a.view.hp += amount;
                                self.spring_healing += amount as f64;
                                total_healed += amount;
                                #[cfg(feature = "reference-diagnostics")]
                                crate::target_lock_metrics::healed(a.view.id, amount);
                                self.events.push(Event::Healed {
                                    target: a.view.id,
                                    amount,
                                    source: crate::HealSource::SpringTick,
                                });
                            }
                        }
                    }
                    self.healing_enmity(h.view.owner, total_healed);
                }
                if h.view.kind == HazardKind::FazePool
                    && h.phase_age - h.pulse + 0.00001 >= FAZE_PULSE
                {
                    h.pulse += FAZE_PULSE;
                    for j in 0..self.actors.len() {
                        if self.actors[j].tangible()
                            && self.actors[j].view.team != h.view.team
                            && h.affects(self.actors[j].view.id, self.actors[j].view.pos, 0.)
                        {
                            self.damage(h.view.owner, j, h.damage, false, true, Element::Poison);
                        }
                    }
                }
                if h.view.kind == HazardKind::KajaAura
                    && self.actor_index(h.view.owner).is_some_and(|i| {
                        self.actors[i].tangible() && self.actors[i].view.state != ActorState::Spawn
                    })
                {
                    let dps = AURA_DPS
                        * if self.actor_index(h.view.owner).is_some_and(|i| {
                            self.actors[i].view.elevate == Some(ElevateVariant::Sword)
                        }) {
                            1. + ELEVATE_BONUS
                        } else {
                            1.
                        };
                    for j in 0..self.actors.len() {
                        if self.actors[j].tangible()
                            && self.actors[j].view.team != h.view.team
                            && h.hits(
                                self.actors[j].view.pos,
                                h.hit_radius(self.actors[j].view.radius),
                            )
                        {
                            self.damage(
                                h.view.owner,
                                j,
                                dps * SIM_DT,
                                false,
                                false,
                                Element::Nature,
                            );
                        }
                    }
                }
                if h.phase_age + 0.00001 >= h.duration {
                    h.view.phase = HazardPhase::Resolved;
                    self.events.resolved_empty(h.view.id, h.view.kind);
                }
            } else if h.phase_age + 0.00001 >= h.duration {
                // Preserve authored units: a full healer roster defers this marker, never drops it.
                if h.spawn_kind == Some(Archetype::Marid)
                    && self
                        .actors
                        .iter()
                        .filter(|a| a.alive() && a.view.archetype == Archetype::Marid)
                        .count()
                        >= MARID_MAX_ALIVE
                {
                    self.hazards[i] = h;
                    continue;
                }
                #[cfg(feature = "reference-diagnostics")]
                crate::stomp_metrics::resolving(self, &h);
                if h.view.kind == HazardKind::GroundPound {
                    let t = h.target.and_then(|id| self.actor_index(id));
                    h.target_alive_at_resolve = t.is_some_and(|t| self.actors[t].alive());
                    h.target_distance_at_resolve =
                        t.map_or(0., |t| h.view.origin.distance(self.actors[t].view.pos));
                    h.target_contact = Some(t.is_some_and(|t| {
                        self.actors[t].alive() && h.hits(self.actors[t].view.pos, 0.)
                    }));
                }
                let pulse = h.view.kind == HazardKind::ArcanePulse;
                let range_mult = if pulse {
                    let aim = h
                        .target
                        .and_then(|id| self.actor_index(id))
                        .filter(|&t| self.actors[t].alive())
                        .map_or(h.view.origin, |t| self.actors[t].view.pos);
                    let distance = self
                        .actor_index(h.view.owner)
                        .filter(|&c| self.actors[c].alive())
                        .map_or(0., |c| self.actors[c].view.pos.distance(aim));
                    1. + ((distance - ARCANE_PULSE_RANGE_NEAR)
                        / (ARCANE_PULSE_RANGE_FAR - ARCANE_PULSE_RANGE_NEAR))
                        .clamp(0., 1.)
                        * (ARCANE_PULSE_RANGE_MAX_MULT - 1.)
                } else {
                    1.
                };
                let victims = self.events.victim_start();
                for j in 0..self.actors.len() {
                    if h.view.hostile
                        && self.actors[j].tangible()
                        && self.actors[j].view.team != h.view.team
                        && h.affects(
                            self.actors[j].view.id,
                            self.actors[j].view.pos,
                            self.actors[j].view.radius,
                        )
                    {
                        #[cfg(feature = "bound-diagnostics")]
                        crate::bound::caught(self, &h, j);
                        #[cfg(feature = "reference-diagnostics")]
                        if self.trial_hazard == Some(h.view.id) {
                            self.trial_landed = true;
                        }
                        let element = if matches!(h.view.kind, HazardKind::ArcanePulse) {
                            Element::Arcane
                        } else {
                            Element::Physical
                        };
                        // Both contacts are decided before this skill's push displaces the victim.
                        let hits = 1 + usize::from(
                            h.burst_hits(self.actors[j].view.pos, 0.)
                                && contains(
                                    h.view.shape,
                                    h.view.origin,
                                    h.view.dir,
                                    self.actors[j].view.pos,
                                    0.,
                                ),
                        );
                        let mut landed = false;
                        for _ in 0..hits {
                            landed |= self.damage_limited(
                                h.view.owner,
                                j,
                                h.damage * range_mult,
                                true,
                                true,
                                element,
                                None,
                                pulse || h.view.team == Team::Enemy,
                            ) > 0.;
                        }
                        if landed {
                            self.events.victim(self.actors[j].view.id);
                            if h.view.kind == HazardKind::BubblePop {
                                self.bubble_interrupt(j);
                                self.encase(j);
                            }
                        }
                        if matches!(h.view.kind, HazardKind::BubblePop | HazardKind::GroundPound) {
                            self.spotlight_affected(h.view.owner, self.actors[j].view.id);
                            let away = if h.view.kind == HazardKind::GroundPound {
                                h.view.dir
                            } else {
                                (self.actors[j].view.pos - h.view.origin).normalized()
                            };
                            let push = if h.view.kind == HazardKind::GroundPound {
                                GROUND_POUND_PUSH
                            } else {
                                BUBBLE_PUSH
                            };
                            // Pop cannot interrupt a boss through the shared push/stagger path.
                            if h.view.kind != HazardKind::BubblePop
                                || !is_boss(self.actors[j].view.archetype)
                            {
                                self.hero_push(j, away, push);
                            }
                        }
                    }
                }
                self.events.resolved(h.view.id, h.view.kind, victims);
                if let Some(kind) = h.spawn_kind.take() {
                    let actor = self.spawn_profile(kind, h.view.origin);
                    self.actors.last_mut().unwrap().begin_spawn();
                    self.materialized.push((h.view.id, actor));
                }
                #[cfg(feature = "reference-diagnostics")]
                if self.trial_hazard == Some(h.view.id) {
                    self.finish_trial();
                }
                h.view.phase = HazardPhase::Resolved;
                h.view.progress = 1.;
                if h.view.kind == HazardKind::FizzmiteBlast {
                    if let Some(s) = self.actor_index(h.view.owner) {
                        // Reassert before death even if a wind-up interrupt reset the cooldown.
                        self.actors[s].basic_cd = f32::MAX;
                        self.actors[s].view.hp = 0.;
                    }
                }
            }
            self.hazards[i] = h;
        }
        #[cfg(feature = "reference-diagnostics")]
        crate::target_lock_metrics::clear_scope();
        self.hazards.retain(|h| !h.cancelled);
    }
    /// Countdown seconds, reference fill speed (u/s), raw pre-mitigation damage.
    pub fn telegraph_measure(&self, id: u32) -> Option<(f32, f32, f32)> {
        self.hazards
            .iter()
            .find(|h| h.view.id == id)
            .and_then(|h| Some((h.duration, fill_speed(h.view.kind)?, h.damage)))
    }
    /// Read-only warning clock for presentation: (elapsed, full) seconds across the whole
    /// warning, i.e. tracking + countdown for tracked telegraphs (Djinn beam, snipers).
    /// `full` follows the live countdown, which can still change while tracking.
    pub fn warning_timing(&self, id: u32) -> Option<(f32, f32)> {
        let h = self.hazards.iter().find(|h| h.view.id == id)?;
        let track = h.tracking.max(0.);
        let full = track + h.duration;
        match h.view.phase {
            HazardPhase::Locked => Some(((track + h.phase_age).min(full), full)),
            HazardPhase::Tracking => Some((h.phase_age.min(track), full)),
            _ => None,
        }
    }
    /// Read-only geometry probe for benchmark warning-resolution coverage.
    pub fn telegraph_covers(&self, id: u32, position: Vec2, body: f32) -> bool {
        self.hazards
            .iter()
            .any(|h| h.view.id == id && h.hits(position, body))
    }
    #[cfg(feature = "reference-diagnostics")]
    pub fn finish_trial(&mut self) {
        if let Some(a) = self.actors.first() {
            let damage = (self.trial_hp - a.view.hp).max(0.);
            self.outcome = Some(TrialOutcome {
                dodged: !self.trial_landed,
                reaction_delay: self.trial_delay,
                damage_taken: damage,
            });
        }
    }
}

pub fn line_width(shape: Shape) -> f32 {
    match shape {
        Shape::Line { width, .. } => width,
        _ => 0.,
    }
}
pub fn shape_size(shape: Shape) -> f32 {
    match shape {
        Shape::Circle { radius } => radius,
        Shape::Ring { outer, .. } => outer,
        Shape::Line { length, .. } | Shape::Cone { length, .. } => length,
    }
}
/// Tuned spatial speed; short/clipped shapes keep the base warning and fill slower.
pub fn fill_speed(kind: HazardKind) -> Option<f32> {
    Some(match kind {
        HazardKind::SniperLine | HazardKind::BossSnipe => SNIPER_LENGTH / SNIPER_LOCK,
        HazardKind::BossNova => NOVA_RADIUS / NOVA_LOCK,
        HazardKind::LizardoDrop => BOMB_RADIUS / BOMB_TIME,
        HazardKind::FizzmiteBlast => FIZZMITE_FILL_SPEED,
        HazardKind::BossSlam | HazardKind::BossStompStep => SLAM_RADIUS / SLAM_LOCK,
        HazardKind::BossCone => CONE_LENGTH / CONE_LOCK,
        HazardKind::BossCharge => CHARGE_BASE_LENGTH / CHARGE_LOCK,
        HazardKind::SpawnMarker => SPAWN_MARKER_RADIUS / SPAWN_COUNTDOWN,
        HazardKind::BubblePop => BUBBLE_RADIUS / CAST_IMPACT,
        HazardKind::ArcanePulse => ARCANE_PULSE_RADIUS / ARCANE_PULSE_COUNTDOWN,
        HazardKind::GroundPound => GROUND_POUND_LENGTH / GROUND_POUND_COUNTDOWN,
        _ => return None,
    })
}
/// Owner rule: the fill travels at a fixed speed, so a bigger telegraph takes proportionally
/// longer (COUNTDOWN_GROWTH = 1.0 is linear); the base countdown is always the floor.
pub fn countdown(kind: HazardKind, shape: Shape, base: f32) -> f32 {
    if kind == HazardKind::SniperLine {
        return base;
    }
    fill_speed(kind).map_or(base, |speed| {
        let mut growth = shape_size(shape) / (speed * base);
        if kind == HazardKind::BossSnipe {
            if let Shape::Line { width, .. } = shape {
                // Preserve both the original longitudinal and lateral fill speeds.
                let width_speed = DJINN_BEAM_REFERENCE_WIDTH / SNIPER_LOCK;
                growth = growth.max(width / (width_speed * base));
            }
        }
        base * libm::powf(growth.max(1.), COUNTDOWN_GROWTH)
    })
}
pub fn scaled_shape(shape: Shape, rule: Option<PhaseRule>, origin: Vec2, dir: Vec2) -> Shape {
    scaled_shape_in(crate::math::Floor::default(), shape, rule, origin, dir)
}
pub fn scaled_shape_in(
    floor: crate::math::Floor,
    shape: Shape,
    rule: Option<PhaseRule>,
    origin: Vec2,
    dir: Vec2,
) -> Shape {
    let (length_scale, width_scale, radius_scale) = rule.map_or((1., 1., 1.), |r| {
        (r.length_scale, r.width_scale, r.radius_scale)
    });
    match shape {
        Shape::Circle { radius } => Shape::Circle {
            radius: radius * radius_scale,
        },
        Shape::Ring { inner, outer } => Shape::Ring {
            inner: inner * radius_scale,
            outer: outer * radius_scale,
        },
        Shape::Line { length, width } => Shape::Line {
            length: floor.ray(origin, dir, length * length_scale),
            width: width * width_scale,
        },
        Shape::Cone {
            length,
            half_angle_rad,
        } => Shape::Cone {
            length: floor.ray(origin, dir, length * length_scale),
            half_angle_rad: half_angle_rad * width_scale,
        },
    }
}

use super::*;

#[cfg(test)]
mod geometry_tests {
    use super::*;
    #[test]
    fn independent_dimension_rules_apply_to_every_shape() {
        let rule = Some(PhaseRule {
            hp_below: 0.35,
            length_scale: 2.,
            width_scale: 1.1,
            radius_scale: 1.5,
        });
        let scale = |shape| scaled_shape(shape, rule, TRIAL_ORIGIN, Vec2::new(0., -1.));
        assert_eq!(
            scale(Shape::Line {
                length: 100.,
                width: 40.
            }),
            Shape::Line {
                length: 200.,
                width: 44.
            }
        );
        assert_eq!(
            scale(Shape::Cone {
                length: 100.,
                half_angle_rad: 0.5
            }),
            Shape::Cone {
                length: 200.,
                half_angle_rad: 0.55
            }
        );
        assert_eq!(
            scale(Shape::Circle { radius: 100. }),
            Shape::Circle { radius: 150. }
        );
        assert_eq!(
            scale(Shape::Ring {
                inner: 20.,
                outer: 100.
            }),
            Shape::Ring {
                inner: 30.,
                outer: 150.
            }
        );
    }
}
