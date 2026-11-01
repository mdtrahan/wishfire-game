//! Fixed-step player input, hit-stop and the common revival effect.
use crate::{tuning::*, *};

#[derive(Default)]
pub struct Phoenix {
    pub held: Option<u32>,
    pub hero: Option<u32>,
    pub steps: u32,
    pub cooldown: u32,
}

impl Sim {
    pub fn party_recovering(&self) -> bool {
        self.phoenix.hero.is_some()
            || self.actors.iter().any(|a| {
                a.view.team == Team::Hero
                    && (a.view.state == ActorState::Downed
                        || (a.alive() && a.action_revive && a.committed()))
            })
    }

    /// Submit one held combat step on a downed hero. Re-submit before each `step` while pressed.
    /// Frozen/transition input is ignored rather than deferred; the active channel pauses.
    pub fn phoenix_hold(&mut self, hero_id: u32) {
        if self.spotlight.active.is_none()
            && self.hit_stop_steps == 0
            && !self.encounter.transitioning
        {
            self.phoenix.held = Some(hero_id);
        }
    }

    /// Cancel the player hold at the next combat-step boundary, spending no cooldown.
    pub fn phoenix_release(&mut self) {
        if self.spotlight.active.is_none()
            && self.hit_stop_steps == 0
            && !self.encounter.transitioning
        {
            self.phoenix.held = None;
        }
    }

    pub fn cancel_phoenix(&mut self) {
        if let Some(hero) = self.phoenix.hero.take() {
            self.events.push(Event::PhoenixCancelled { hero });
        }
        self.phoenix.steps = 0;
        self.phoenix.held = None;
    }

    pub fn phoenix_step(&mut self) {
        self.phoenix.cooldown = self.phoenix.cooldown.saturating_sub(1);
        let held = self.phoenix.held.take().filter(|id| {
            self.phoenix.cooldown == 0
                && self.actor_index(*id).is_some_and(|i| {
                    self.actors[i].view.team == Team::Hero
                        && self.actors[i].view.state == ActorState::Downed
                })
        });
        if held != self.phoenix.hero {
            self.cancel_phoenix();
            if let Some(hero) = held {
                self.phoenix.hero = Some(hero);
                self.events.push(Event::PhoenixBegan { hero });
            }
        }
        if let Some(hero) = self.phoenix.hero {
            self.phoenix.steps += 1;
            if self.phoenix.steps >= (REVIVE_CHANNEL * SIM_HZ as f32).round() as u32 {
                let i = self.actor_index(hero).unwrap();
                self.phoenix.hero = None;
                self.revive_hero(i);
                self.events.push(Event::Healed {
                    target: hero,
                    amount: self.actors[i].view.max_hp * REVIVE_HP,
                    source: crate::HealSource::Phoenix,
                });
                self.events.push(Event::PhoenixCompleted { hero });
                self.phoenix.hero = None;
                self.phoenix.steps = 0;
                self.phoenix.cooldown = (PHOENIX_COOLDOWN * SIM_HZ as f32).round() as u32;
            }
        }
    }

    pub fn begin_hit_stop(&mut self, cause: HitStopCause, actor: u32) {
        if self.spotlight.active.is_some() {
            return;
        }
        // Simultaneous causes never accumulate; keep the highest-priority freeze.
        let priority = |cause| match cause {
            HitStopCause::HealingSpring => 0,
            HitStopCause::HeroDowned => 1,
            HitStopCause::BossDied => 2,
        };
        if self
            .hit_stop
            .is_some_and(|v| priority(v.cause) >= priority(cause))
        {
            return;
        }
        self.hit_stop_steps = ((match cause {
            HitStopCause::HeroDowned => HERO_DOWN_HIT_STOP,
            HitStopCause::BossDied => BOSS_DEATH_HIT_STOP,
            HitStopCause::HealingSpring => HEALING_SPRING_HIT_STOP,
        }) * SIM_HZ as f32)
            .ceil() as u32;
        self.hit_stop = Some(HitStopView {
            cause,
            actor,
            remaining: self.hit_stop_steps as f32 / SIM_HZ as f32,
        });
    }

    pub fn revive_hero(&mut self, i: usize) {
        if self.phoenix.hero == Some(self.actors[i].view.id) {
            self.cancel_phoenix();
        }
        let a = &mut self.actors[i];
        a.clear_ailments();
        a.view.hp = a.view.max_hp * REVIVE_HP;
        a.undamaged = 0.;
        a.revive_progress = 0.;
        a.revive_grace = 0.;
        a.action_done = true;
        a.action_revive = false;
        a.velocity = Vec2::default();
        a.state(ActorState::Idle, 0., 0.);
        let hero = a.view.id;
        self.events.push(Event::Revived { id: hero });
        if a.view.archetype == Archetype::Runa
            && !self.hazards.iter().any(|h| {
                h.view.kind == HazardKind::BubbleAura
                    && h.view.owner == hero
                    && h.view.phase != HazardPhase::Resolved
            })
        {
            self.hazard(
                HazardKind::BubbleAura,
                hero,
                None,
                self.actors[i].view.pos,
                Vec2::new(1., 0.),
            );
        }
        self.revive_burst(i);
    }

    pub fn revive_burst(&mut self, i: usize) {
        self.actors[i].revive_immunity_steps =
            (REVIVE_BURST_SECONDS * SIM_HZ as f32).round() as u32;
        let pos = self.actors[i].view.pos;
        let hero = self.actors[i].view.id;
        self.events.push(Event::ReviveBurst {
            hero,
            pos,
            radius: REVIVE_BURST_RADIUS,
        });
        for t in 0..self.actors.len() {
            if self.actors[t].alive()
                && self.actors[t].view.team == Team::Enemy
                && self.actors[t].view.pos.distance(pos)
                    <= REVIVE_BURST_RADIUS + self.actors[t].view.radius
            {
                self.actors[t].burst_slow_steps =
                    (REVIVE_BURST_SECONDS * SIM_HZ as f32).round() as u32;
                self.actors[t].view.slowed = self.actors[t].view.slowed.max(REVIVE_BURST_SLOW);
                self.hero_push(
                    t,
                    (self.actors[t].view.pos - pos).normalized(),
                    REVIVE_BURST_PUSH,
                );
            }
        }
    }
}
