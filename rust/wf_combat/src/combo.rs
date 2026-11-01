//! Fixed-at-begin offensive combo membership; no combat-clock work or new AI entries.
use crate::{
    combat::Projectile,
    hazards::Hazard,
    spotlight::{Ids, Spotlight},
    tuning::*,
    *,
};
#[derive(Clone, Copy, Debug)]
pub struct Performer {
    pub actor: u32,
    pub action_epoch: Option<u64>,
    pub skill: Option<Skill>,
    pub finished: bool,
}
pub fn hazard_skill(kind: HazardKind) -> Option<Skill> {
    let skill = match kind {
        HazardKind::BubblePop => Skill::BubblePop,
        HazardKind::ArcanePulse => Skill::ArcanePulse,
        HazardKind::GroundPound => Skill::GroundPound,
        _ => return None,
    };
    skill.offensive().then_some(skill)
}
impl Spotlight {
    pub fn has_performer(&self, id: u32) -> bool {
        self.performers.iter().flatten().any(|p| p.actor == id)
    }
    pub fn performer_running(&self, id: u32) -> bool {
        self.performers
            .iter()
            .flatten()
            .any(|p| p.actor == id && !p.finished)
    }
    pub fn advances_projectile(&self, p: &Projectile) -> bool {
        self.phase == SpotlightPhase::Performing
            && self.projectiles.slice().contains(&p.view.id)
            && self.performer_running(p.source)
    }
}
impl Sim {
    pub fn offensive_action(&self, i: usize) -> Option<Skill> {
        let a = &self.actors[i];
        if a.view.team != Team::Hero
            || a.view.state != ActorState::Cast
            || a.action_revive
            || !a.action_special
        {
            return None;
        }
        let skill = if a.action_pound {
            Skill::GroundPound
        } else if a.action_pulse {
            Skill::ArcanePulse
        } else {
            match (a.view.archetype, a.action_extra) {
                (Archetype::Hondo, false) => Skill::Shadow,
                (Archetype::Hondo, true) => Skill::Split,
                (Archetype::Runa, false) => Skill::BubblePop,
                _ => return None,
            }
        };
        skill.offensive().then_some(skill)
    }
    pub fn action_covers(&self, i: usize, skill: Skill, target: u32, presentation: bool) -> bool {
        let a = &self.actors[i];
        if a.target == Some(target)
            && self
                .actor_index(target)
                .is_none_or(|t| self.actors[t].view.teleport_steps == 0)
        {
            return true;
        }
        let Some(t) = self
            .actor_index(target)
            .filter(|&t| self.actors[t].tangible() && self.actors[t].view.team == Team::Enemy)
        else {
            return false;
        };
        let center = a
            .target
            .and_then(|id| self.actor_index(id))
            .filter(|&t| self.actors[t].tangible())
            .map_or(a.action_target_pos, |t| self.actors[t].view.pos);
        let (shape, origin, dir, body) = match skill {
            Skill::Split => (
                Shape::Circle {
                    radius: SPLIT_RADIUS,
                },
                center,
                Vec2::new(1., 0.),
                self.actors[t].view.radius,
            ),
            Skill::BubblePop => (
                Shape::Circle {
                    radius: BUBBLE_RADIUS,
                },
                crate::math::floor_point(center, BUBBLE_RADIUS),
                Vec2::new(1., 0.),
                self.actors[t].view.radius,
            ),
            Skill::ArcanePulse => (
                Shape::Circle {
                    radius: ARCANE_PULSE_RADIUS,
                },
                crate::math::floor_point(center, ARCANE_PULSE_RADIUS),
                Vec2::new(1., 0.),
                self.actors[t].view.radius,
            ),
            Skill::GroundPound => (
                Shape::Line {
                    length: a.view.pos.distance(center) + a.action_target_radius,
                    width: GROUND_POUND_WIDTH,
                },
                a.view.pos,
                (center - a.view.pos).normalized(),
                if presentation {
                    self.actors[t].view.radius
                } else {
                    0.
                },
            ),
            _ => return false,
        };
        crate::math::contains(shape, origin, dir, self.actors[t].view.pos, body)
            || (skill == Skill::GroundPound
                && match shape {
                    Shape::Line { length, .. } => {
                        self.actors[t].view.pos.distance(origin + dir * length)
                            <= GROUND_POUND_BURST_RADIUS + body
                    }
                    _ => false,
                })
    }
    pub fn hazard_covers(&self, h: &Hazard, targets: &Ids<128>) -> bool {
        targets.slice().iter().any(|&id| {
            h.target == Some(id)
                || self.actor_index(id).is_some_and(|t| {
                    h.hits(
                        self.actors[t].view.pos,
                        h.hit_radius(self.actors[t].view.radius),
                    )
                })
        })
    }
    pub fn capture_combo(&self, s: &mut Spotlight) {
        let featured = self.actor_index(s.caster).unwrap();
        // Include the featured package's known area targets before selecting anyone else.
        for a in &self.actors {
            if a.alive()
                && a.view.team == Team::Enemy
                && self.action_covers(featured, s.skill, a.view.id, false)
            {
                s.participants.add(a.view.id);
            }
        }
        let mut targets = Ids::<128>::new();
        for &id in s.participants.slice() {
            if self.actor_index(id).is_some_and(|t| {
                self.actors[t].tangible() && self.actors[t].view.team == Team::Enemy
            }) {
                targets.add(id);
            }
        }
        for (i, a) in self.actors.iter().enumerate() {
            let Some(k) = crate::actors::hero_index(a.view.archetype).filter(|_| a.alive()) else {
                continue;
            };
            let featured = a.view.id == s.caster;
            let action = self.offensive_action(i).filter(|&skill| {
                featured
                    || targets
                        .slice()
                        .iter()
                        .any(|&t| self.action_covers(i, skill, t, false))
            });
            let mut admitted = featured || action.is_some();
            for h in &self.hazards {
                if h.view.owner == a.view.id
                    && h.view.phase != HazardPhase::Resolved
                    && hazard_skill(h.view.kind).is_some()
                    && (if featured {
                        hazard_skill(h.view.kind) == Some(s.skill)
                            && h.action_epoch == a.action_epoch
                    } else {
                        self.hazard_covers(h, &targets)
                    })
                {
                    admitted = true;
                    s.hazards.add(h.view.id);
                    for t in &self.actors {
                        if t.tangible()
                            && t.view.team == Team::Enemy
                            && (h.target == Some(t.view.id)
                                || h.hits(t.view.pos, h.hit_radius(t.view.radius)))
                        {
                            s.participants.add(t.view.id);
                        }
                    }
                }
            }
            for p in &self.projectiles {
                if p.source == a.view.id
                    && p.skill.is_some_and(Skill::offensive)
                    && (if featured {
                        p.skill == Some(s.skill) && p.action_epoch == a.action_epoch
                    } else {
                        p.target.is_some_and(|t| targets.slice().contains(&t))
                    })
                {
                    admitted = true;
                    s.projectiles.add(p.view.id);
                    if let Some(t) = p.target.filter(|t| {
                        self.actor_index(*t)
                            .is_some_and(|t| self.actors[t].view.team == Team::Enemy)
                    }) {
                        s.participants.add(t);
                    }
                }
            }
            if admitted {
                s.performers[k] = Some(Performer {
                    actor: a.view.id,
                    action_epoch: action.map(|_| a.action_epoch),
                    skill: action,
                    finished: false,
                });
                if !featured {
                    s.co_casters.add(a.view.id);
                }
                if action.is_some() {
                    for t in &self.actors {
                        if t.tangible()
                            && t.view.team == Team::Enemy
                            && self.action_covers(i, action.unwrap(), t.view.id, false)
                        {
                            s.participants.add(t.view.id);
                        }
                    }
                }
            }
        }
    }
    pub fn combo_creates_hazard(&self, s: &Spotlight, h: &Hazard) -> bool {
        let Some(i) = self.actor_index(h.view.owner) else {
            return false;
        };
        s.performers.iter().flatten().any(|p| {
            p.actor == h.view.owner
                && !p.finished
                && p.action_epoch == Some(self.actors[i].action_epoch)
                && p.skill == hazard_skill(h.view.kind)
                && p.skill.is_some()
        })
    }
    pub fn spotlight_projectile(&mut self, p: &Projectile) {
        if let Some(s) = &mut self.spotlight.active {
            if s.performers.iter().flatten().any(|a| {
                a.actor == p.source
                    && !a.finished
                    && a.action_epoch == Some(p.action_epoch)
                    && a.skill == p.skill
                    && p.skill.is_some()
            }) {
                s.projectiles.add(p.view.id);
            }
        }
    }
    pub fn spotlight_advances_projectile(&self, p: &Projectile) -> bool {
        self.spotlight
            .active
            .as_ref()
            .is_none_or(|s| s.advances_projectile(p))
    }
    pub fn combo_action_running(&self, p: Performer) -> Option<usize> {
        self.actor_index(p.actor).filter(|&i| {
            self.actors[i].combo_phase != 0 && matches!(p.skill, Some(Skill::Shadow | Skill::Split))
                || (p.action_epoch == Some(self.actors[i].action_epoch)
                    && self.offensive_action(i) == p.skill
                    && p.skill.is_some())
        })
    }
    /// Idle co-performers freeze; only idle featured Hondo releases the window.
    pub fn finish_idle_hondo_performers(&mut self) -> bool {
        let Some(mut s) = self.spotlight.active else {
            return false;
        };
        let mut featured_idle = false;
        for p in s.performers.iter_mut().flatten() {
            if self.actor_index(p.actor).is_some_and(|i| {
                self.actors[i].view.archetype == Archetype::Hondo
                    && (self.offensive_action(i).is_none() || !self.actors[i].committed())
            }) {
                if p.actor == s.caster {
                    featured_idle = true;
                } else {
                    p.finished = true;
                }
            }
        }
        self.spotlight.active = Some(s);
        featured_idle
    }
    pub fn refresh_spotlight_participants(&mut self) {
        let Some(mut s) = self.spotlight.active else {
            return;
        };
        for p in s.performers.into_iter().flatten().filter(|p| !p.finished) {
            if let Some(i) = self.combo_action_running(p) {
                for a in &self.actors {
                    if a.alive()
                        && a.view.team == Team::Enemy
                        && self.action_covers(i, p.skill.unwrap(), a.view.id, true)
                    {
                        s.participants.add(a.view.id);
                    }
                }
            }
        }
        for h in &self.hazards {
            if s.hazards.slice().contains(&h.view.id) && h.view.phase != HazardPhase::Resolved {
                for a in &self.actors {
                    if a.alive()
                        && a.view.team == Team::Enemy
                        && (h.target == Some(a.view.id) || h.hits(a.view.pos, a.view.radius))
                    {
                        s.participants.add(a.view.id);
                    }
                }
            }
        }
        self.spotlight.active = Some(s);
    }
    pub fn combo_step(&mut self, featured: usize) {
        let initial = self.spotlight.active.unwrap();
        // Cache targets before an earlier performer can kill or shove them.
        for p in initial.performers.iter().flatten().filter(|p| !p.finished) {
            if let Some(i) = self.combo_action_running(*p) {
                self.track_action_target(i);
            }
        }
        for (k, p) in initial
            .performers
            .iter()
            .enumerate()
            .filter_map(|(k, p)| p.map(|p| (k, p)))
        {
            if p.finished {
                continue;
            }
            if !self
                .actor_index(p.actor)
                .is_some_and(|i| self.actors[i].alive() && self.actors[i].view.encased <= 0.)
            {
                self.spotlight.active.as_mut().unwrap().performers[k]
                    .as_mut()
                    .unwrap()
                    .finished = true;
                continue;
            }
            if let Some(i) = self.combo_action_running(p) {
                self.combo_drain(i);
                self.actors[i].view.state_age += SIM_DT;
                self.action(i);
                // Continue landed hops normally; failed first hops and finished bursts
                // leave their cleanup to combat after the sidecar closes.
                if self.actors[i].combo_phase == 2 {
                    self.combo_next(i);
                }
                let a = &mut self.actors[i];
                if a.action_done && !a.committed() {
                    a.state(ActorState::Idle, 0., 0.);
                    a.view.special_casting = a.combo_phase != 0;
                }
            }
        }
        self.update_hazards();
        self.refresh_spotlight_participants();
        self.move_projectiles();
        self.resolve_hazards();
        self.deaths();
        // Owner: heroes face their target for the whole attack window, spotlight included.
        for p in initial.performers.iter().flatten() {
            if let Some(i) = self.actor_index(p.actor) {
                let a = &self.actors[i];
                if a.view.team == Team::Hero && a.alive() && a.committed() && !a.action_revive {
                    self.face_target(i);
                }
            }
        }
        if !self.actors[featured].alive() {
            self.end_spotlight(true);
            return;
        }
        if self.finish_idle_hondo_performers() {
            self.end_spotlight(false);
            return;
        }
        let current = self.spotlight.active.unwrap();
        for (k, p) in current
            .performers
            .iter()
            .enumerate()
            .filter_map(|(k, p)| p.map(|p| (k, p)))
        {
            if p.finished {
                continue;
            }
            let action = self.combo_action_running(p).is_some();
            let hazards = self
                .hazards
                .iter()
                .any(|h| h.view.owner == p.actor && self.spotlight_advances_hazard(h));
            let projectiles = self
                .projectiles
                .iter()
                .any(|b| b.source == p.actor && current.advances_projectile(b));
            if !action && !hazards && !projectiles {
                self.spotlight.active.as_mut().unwrap().performers[k]
                    .as_mut()
                    .unwrap()
                    .finished = true;
            }
        }
        let s = self.spotlight.active.as_mut().unwrap();
        if !s.performer_running(s.caster) {
            if s.performers.iter().flatten().any(|p| !p.finished) {
                if !initial.performer_running(initial.caster) {
                    s.extra_steps += 1;
                }
                if s.extra_steps < (SPOTLIGHT_COMBO_EXTRA * SIM_HZ as f32) as u64 {
                    return;
                }
                // Cap freezes remaining work exactly here, without damage/cooldown changes.
                // Normal combat resumes it next step. No forced resolve or cancellation.
                for p in s.performers.iter_mut().flatten() {
                    p.finished = true;
                }
            }
            if self.cfg.spotlight.auto_release || self.cfg.spotlight.tail_cap <= 0. {
                self.end_spotlight(false);
            } else {
                s.phase = SpotlightPhase::Tail;
            }
        }
    }
}
