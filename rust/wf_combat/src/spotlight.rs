//! Event-driven cinematics. All scheduling uses combat steps; no delayed activation queue.
use crate::{
    actors::hero_index,
    hazards::{Hazard, HitPolicy},
    tuning::{is_boss, SPLIT_RADIUS},
    *,
};

pub const PARTICIPANTS: usize = 128;
pub const SKILL_HAZARDS: usize = 128;

#[derive(Clone, Copy, Debug)]
pub struct Ids<const N: usize> {
    values: [u32; N],
    len: usize,
}
impl<const N: usize> Ids<N> {
    pub fn new() -> Self {
        Self {
            values: [0; N],
            len: 0,
        }
    }
    pub fn slice(&self) -> &[u32] {
        &self.values[..self.len]
    }
    pub fn add(&mut self, id: u32) {
        if !self.slice().contains(&id) {
            assert!(self.len < N, "spotlight fixed-capacity storage exhausted");
            self.values[self.len] = id;
            self.len += 1;
        }
    }
}
#[derive(Clone, Copy, Debug)]
pub struct Spotlight {
    pub caster: u32,
    pub skill: Skill,
    pub phase: SpotlightPhase,
    pub started_step: u64,
    pub tail_steps: u64,
    pub charge_steps: u64,
    pub participants: Ids<PARTICIPANTS>,
    pub hazards: Ids<SKILL_HAZARDS>,
    pub co_casters: Ids<4>,
    pub projectiles: Ids<128>,
    pub performers: [Option<crate::combo::Performer>; 4],
    pub extra_steps: u64,
}
impl Spotlight {
    pub fn new(caster: u32, skill: Skill, target: Option<u32>) -> Self {
        let mut s = Self {
            caster,
            skill,
            phase: SpotlightPhase::Performing,
            started_step: 0,
            tail_steps: 0,
            charge_steps: 0,
            participants: Ids::new(),
            hazards: Ids::new(),
            co_casters: Ids::new(),
            projectiles: Ids::new(),
            performers: [None; 4],
            extra_steps: 0,
        };
        s.participants.add(caster);
        if let Some(id) = target {
            s.participants.add(id);
        }
        s
    }
    pub fn owns_kind(&self, kind: HazardKind) -> bool {
        matches!(
            (self.skill, kind),
            (Skill::BubblePop, HazardKind::BubblePop)
                | (Skill::Elevate, HazardKind::ElevateRing)
                | (Skill::Faze, HazardKind::FazePool)
                | (Skill::ArcanePulse, HazardKind::ArcanePulse)
                | (Skill::GroundPound, HazardKind::GroundPound)
        )
    }
}
pub struct Scheduler {
    pub active: Option<Spotlight>,
    pub candidates: [Option<Spotlight>; 4],
    pub last_end: u64,
    pub last_hero: [u64; 4],
    // Retain scheduling history in the hash after a runtime toggle, while preserving OFF hashes.
    pub touched: bool,
}
impl Scheduler {
    pub fn new(enabled: bool) -> Self {
        Self {
            active: None,
            candidates: [None; 4],
            last_end: 0,
            last_hero: [0; 4],
            touched: enabled,
        }
    }
    pub fn reset_waits(&mut self, step: u64) {
        self.last_end = step;
        self.last_hero.fill(step);
        self.candidates.fill(None);
    }
}
pub fn validated(mut c: SpotlightConfig) -> SpotlightConfig {
    let finite = |v: f32, default: f32| if v.is_finite() { v.max(0.) } else { default };
    c.global_gap = finite(c.global_gap, SpotlightConfig::DEFAULT.global_gap);
    c.hero_gap = finite(c.hero_gap, SpotlightConfig::DEFAULT.hero_gap);
    c.fairness = finite(c.fairness, SpotlightConfig::DEFAULT.fairness).min(1.);
    c.drought = finite(c.drought, SpotlightConfig::DEFAULT.drought);
    c.tail_cap = finite(c.tail_cap, SpotlightConfig::DEFAULT.tail_cap);
    c.charge = finite(c.charge, SpotlightConfig::DEFAULT.charge);
    c
}
impl Sim {
    pub fn skill_started(&mut self, id: u32, skill: Skill, target: Option<u32>) {
        self.events.push(Event::SkillStarted { id, skill, target });
        if skill == Skill::HealingSpring {
            self.begin_hit_stop(HitStopCause::HealingSpring, id);
        }
        if self.cfg.spotlight.enabled
            && skill.offensive()
            && target
                .and_then(|id| self.actor_index(id))
                .is_some_and(|i| self.actors[i].view.team == Team::Enemy && self.actors[i].alive())
            && self.cfg.spotlight.skills[skill.index()]
            && self.spotlight.active.is_none()
        {
            if let Some(k) = self
                .actor_index(id)
                .filter(|&i| self.actors[i].alive())
                .and_then(|i| hero_index(self.actors[i].view.archetype))
            {
                let i = self.actor_index(id).unwrap();
                let boss_target = target
                    .and_then(|id| self.actor_index(id))
                    .is_some_and(|t| is_boss(self.actors[t].view.archetype));
                // Observe the committed attack only; never feed this gate back into combat.
                if boss_target
                    || self
                        .actors
                        .iter()
                        .filter(|a| {
                            a.alive()
                                && a.view.team == Team::Enemy
                                && if skill == Skill::Split {
                                    // Split hits feet; presentation membership allows body overlap.
                                    a.view.pos.distance(self.actors[i].action_target_pos)
                                        <= SPLIT_RADIUS
                                } else {
                                    self.action_covers(i, skill, a.view.id, false)
                                }
                        })
                        .take(3)
                        .count()
                        == 3
                {
                    self.spotlight.candidates[k] = Some(Spotlight::new(id, skill, target));
                }
            }
        }
    }
    pub fn spotlight_affected(&mut self, source: u32, target: u32) {
        if !self
            .actor_index(target)
            .is_some_and(|i| self.actors[i].view.team == Team::Enemy)
        {
            return;
        }
        if let Some(s) = &mut self.spotlight.active {
            if s.has_performer(source) {
                s.participants.add(target);
            }
        }
    }
    pub fn spotlight_hazard(&mut self, h: &Hazard) {
        // BubblePop is created at activation, before end-of-step selection. Capture its initial
        // occupants now, retaining only this step's candidate if the scheduler skips it.
        let destination = if self
            .spotlight
            .active
            .as_ref()
            .is_some_and(|s| self.combo_creates_hazard(s, h))
        {
            self.spotlight.active.as_mut()
        } else {
            self.spotlight
                .candidates
                .iter_mut()
                .flatten()
                .find(|s| s.caster == h.view.owner && s.owns_kind(h.view.kind))
        };
        if let Some(s) = destination {
            s.hazards.add(h.view.id);
            for a in &self.actors {
                if a.alive()
                    && a.view.team == Team::Enemy
                    && h.hits(a.view.pos, h.hit_radius(a.view.radius))
                {
                    s.participants.add(a.view.id);
                }
            }
        }
    }
    pub fn select_spotlight(&mut self) {
        if !self.cfg.spotlight.enabled
            || self.spotlight.active.is_some()
            || self.hit_stop_steps > 0
            || self.encounter.transitioning
            || self.actors.iter().any(|a| {
                a.alive()
                    && is_boss(a.view.archetype)
                    && ((a.view.state == ActorState::Cast && a.committed())
                        || a.regen_ticks_left > 0
                        || self.hazards.iter().any(|h| {
                            h.view.owner == a.view.id
                                && h.view.hostile
                                && h.view.phase != HazardPhase::Resolved
                        }))
            })
        {
            self.spotlight.candidates.fill(None);
            return;
        }
        let mut max_wait = 0;
        for a in &self.actors {
            if a.alive() {
                if let Some(k) = hero_index(a.view.archetype) {
                    max_wait = max_wait.max(self.combat_steps - self.spotlight.last_hero[k]);
                }
            }
        }
        // Stable hero/id ordering breaks equal waits. Select once, then test every gate;
        // a rejected candidate never becomes queued work and cannot alter skill priorities.
        let mut chosen = None;
        for (k, c) in self.spotlight.candidates.iter().enumerate() {
            if let Some(c) = c {
                if self
                    .actor_index(c.caster)
                    .is_some_and(|i| self.actors[i].alive())
                    && c.participants
                        .slice()
                        .get(1)
                        .and_then(|id| self.actor_index(*id))
                        .is_some_and(|i| {
                            self.actors[i].view.team == Team::Enemy && self.actors[i].alive()
                        })
                {
                    let wait = self.combat_steps - self.spotlight.last_hero[k];
                    if chosen.is_none_or(|(_, best)| wait > best) {
                        chosen = Some((k, wait));
                    }
                }
            }
        }
        if let Some((k, wait)) = chosen {
            let cfg = self.cfg.spotlight;
            let since_end = (self.combat_steps - self.spotlight.last_end) as f64;
            let waited = wait as f64;
            let fair = wait as f64 >= (cfg.fairness * max_wait as f32) as f64;
            if since_end >= (cfg.global_gap * SIM_HZ as f32) as f64
                && waited >= (cfg.hero_gap * SIM_HZ as f32) as f64
                && (fair || since_end >= (cfg.drought * cfg.global_gap * SIM_HZ as f32) as f64)
            {
                let mut s = self.spotlight.candidates[k].unwrap();
                self.capture_combo(&mut s);
                s.started_step = self.step_number;
                if cfg.charge > 0. {
                    s.phase = SpotlightPhase::Charge;
                }
                self.spotlight.last_hero[k] = self.combat_steps;
                self.events.push(Event::SpotlightBegan {
                    caster: s.caster,
                    skill: s.skill,
                });
                self.spotlight.active = Some(s);
                self.refresh_spotlight_participants();
            }
        }
        self.spotlight.candidates.fill(None);
    }
    pub fn spotlight_advances_hazard(&self, h: &Hazard) -> bool {
        self.spotlight.active.as_ref().is_none_or(|s| {
            s.phase == SpotlightPhase::Performing
                && s.hazards.slice().contains(&h.view.id)
                && s.performer_running(h.view.owner)
                && h.view.fill == FillMode::Countdown
                && h.policy == HitPolicy::Snapshot
                && h.view.phase != HazardPhase::Resolved
        })
    }
    pub fn spotlight_step(&mut self) {
        self.refresh_spotlight_participants();
        let s = self.spotlight.active.unwrap();
        let caster = self
            .actor_index(s.caster)
            .filter(|&i| self.actors[i].alive());
        if caster.is_none() || !self.cfg.spotlight.enabled || self.encounter.transitioning {
            self.deaths();
            self.end_spotlight(true);
            return;
        }
        let i = caster.unwrap();
        if self.finish_idle_hondo_performers() {
            self.end_spotlight(false);
            return;
        }
        if s.phase == SpotlightPhase::Charge {
            let s = self.spotlight.active.as_mut().unwrap();
            s.charge_steps += 1;
            if s.charge_steps as f64 >= (self.cfg.spotlight.charge * SIM_HZ as f32) as f64 {
                s.phase = SpotlightPhase::Performing;
            }
            return;
        }
        if s.phase == SpotlightPhase::Tail {
            let s = self.spotlight.active.as_mut().unwrap();
            s.tail_steps += 1;
            if self.cfg.spotlight.auto_release
                || s.tail_steps as f64 >= (self.cfg.spotlight.tail_cap * SIM_HZ as f32) as f64
            {
                self.end_spotlight(false);
            }
            return;
        }
        self.combo_step(i);
    }
    pub fn end_spotlight(&mut self, cancelled: bool) {
        if let Some(s) = self.spotlight.active.take() {
            self.spotlight.last_end = self.combat_steps;
            self.events.push(Event::SpotlightEnded {
                caster: s.caster,
                cancelled,
            });
            // In particular, a boss killed by this skill cannot enter a transition until now.
            if self.autonomous() {
                self.finish_requested = true;
            }
        }
    }
}
