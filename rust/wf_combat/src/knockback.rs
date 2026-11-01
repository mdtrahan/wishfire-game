use crate::{api::*, tuning::*, Sim};

pub fn self_anchored(kind: HazardKind, phase: HazardPhase) -> bool {
    matches!(phase, HazardPhase::Tracking | HazardPhase::Locked)
        && matches!(
            kind,
            HazardKind::BossSlam
                | HazardKind::BossStompStep
                | HazardKind::BossNova
                | HazardKind::BossCone
                | HazardKind::BossCharge
                | HazardKind::BossSnipe
        )
}
impl Sim {
    /// Bubble Pop disrupts ordinary wind-ups, never a launched bomb/bolt or body fuse.
    pub fn bubble_interrupt(&mut self, target: usize) {
        let id = self.actors[target].view.id;
        if self.actors[target].view.team != Team::Enemy
            || is_boss(self.actors[target].view.archetype)
        {
            return;
        }
        let mut warning = false;
        for h in &mut self.hazards {
            let thrown = self
                .projectiles
                .iter()
                .any(|p| p.fuse_hazard == Some(h.view.id));
            if h.view.owner == id
                && matches!(h.view.phase, HazardPhase::Tracking | HazardPhase::Locked)
                && h.view.kind != HazardKind::FizzmiteBlast
                && !thrown
            {
                h.cancelled = true;
                h.view.phase = HazardPhase::Resolved;
                warning = true;
                self.events.push(Event::HazardCancelled {
                    id: h.view.id,
                    kind: h.view.kind,
                });
            }
        }
        #[cfg(feature = "reference-diagnostics")]
        let boss_phase = self
            .actors
            .iter()
            .any(|a| a.alive() && is_boss(a.view.archetype));
        let a = &mut self.actors[target];
        let windup = !a.action_done
            && matches!(a.view.state, ActorState::Basic | ActorState::Cast)
            && (a.view.state_age + 0.00001 < a.view.impact_at
                || (a.view.archetype == Archetype::Mirewing && a.action_special));
        if warning || windup {
            #[cfg(feature = "reference-diagnostics")]
            crate::target_lock_metrics::interrupted(a.view.archetype, boss_phase);
            a.state(ActorState::Idle, 0., 0.);
            a.velocity = Vec2::default();
            a.action_done = true;
            if a.action_heal {
                a.extra_cd = 0.;
                a.action_heal = false;
            }
            a.basic_cd = 0.;
            a.special_cd = 0.;
            a.enemy_phase = 0;
            a.relocate_left = 0.;
        }
    }

    /// All hero pushes share the boss roll and interruption policy.
    pub fn hero_push(&mut self, target: usize, direction: Vec2, distance: f32) {
        let boss = is_boss(self.actors[target].view.archetype);
        let id = self.actors[target].view.id;
        if self.actors[target].view.teleport_steps > 0 {
            return;
        }
        if boss && !self.actors[target].alive() {
            self.cancel_boss_moves_on_death(id);
            return;
        }
        if boss && self.actors[target].push_rng.chance(0.5) {
            self.events.push(Event::KnockbackResisted { id });
            return;
        }
        self.actors[target].view.pos = self.floor.point(
            self.actors[target].view.pos + direction * distance,
            self.actors[target].view.radius,
        );
        if !boss {
            if self.actors[target].view.archetype == Archetype::Mirewing {
                self.bubble_interrupt(target);
            }
            return;
        }
        let mut hazard_interrupted = false;
        for h in &mut self.hazards {
            if h.view.owner == id && self_anchored(h.view.kind, h.view.phase) {
                h.cancelled = true;
                h.view.phase = HazardPhase::Resolved;
                hazard_interrupted = true;
                self.events.push(Event::HazardCancelled {
                    id: h.view.id,
                    kind: h.view.kind,
                });
            }
        }
        let a = &mut self.actors[target];
        let basic = a.view.state == ActorState::Basic && !a.action_done;
        let windup = !a.action_done
            && matches!(a.view.state, ActorState::Basic | ActorState::Cast)
            && a.view.state_age + 0.00001 < a.view.impact_at;
        let interrupted = hazard_interrupted || windup;
        if interrupted {
            a.state(ActorState::Idle, 0., 0.);
            a.velocity = Vec2::default();
            a.action_done = true;
            if a.action_heal {
                a.extra_cd = 0.;
                a.action_heal = false;
            }
            if hazard_interrupted {
                a.boss_retry_special = true;
                // The normal rotation already advanced when this charge was spent.
                a.serial = a.serial.saturating_sub(1);
                a.view.energy = 1.;
                a.enemy_phase = 0;
                a.recharge_left = -SIM_DT;
                a.recharge_duration = 0.;
            }
            if basic {
                a.boss_retry_basic = true;
                a.basic_cd = 0.;
                a.special_cd = 0.;
            }
        }
        self.events.push(Event::BossStaggered { id, interrupted });
    }

    /// Body separation is allowed to move a boss. Its pending ground warning follows
    /// that correction without changing the locked aim, countdown or damage budget.
    pub fn sync_boss_anchors(&mut self) {
        let autonomous = self.autonomous();
        for h in &mut self.hazards {
            if !self_anchored(h.view.kind, h.view.phase) || h.view.kind == HazardKind::BossStompStep
            {
                continue;
            }
            if let Some(a) = self
                .actors
                .iter()
                .find(|a| a.view.id == h.view.owner && a.alive() && is_boss(a.view.archetype))
            {
                h.view.origin = if h.view.kind == HazardKind::BossCone && autonomous {
                    a.cone_origin(h.view.dir)
                } else {
                    a.view.pos
                };
                if let Shape::Line { length, .. } = &mut h.view.shape {
                    *length = self.floor.ray(h.view.origin, h.view.dir, *length);
                }
                // Wall-reaching locked footprints keep ending at the wall after the shift.
                if h.view.phase == HazardPhase::Locked
                    && h.phase_rule.is_some_and(|r| r.length_scale.is_infinite())
                {
                    match &mut h.view.shape {
                        Shape::Line { length, .. } | Shape::Cone { length, .. } => {
                            *length = self.floor.ray(h.view.origin, h.view.dir, f32::INFINITY);
                        }
                        _ => {}
                    }
                }
            }
        }
    }
}
