use crate::{api::*, math::contains, tuning::*, Sim};

impl Sim {
    /// Only the normal combat step dispatches this passive. Exposure, trap duration and RNG
    /// therefore freeze together during every spotlight phase.
    pub fn bubble_aura(&mut self) {
        let aura = self.hazards.iter().find_map(|h| {
            if h.view.kind != HazardKind::BubbleAura || h.view.phase == HazardPhase::Resolved {
                return None;
            }
            self.actor_index(h.view.owner)
                .filter(|i| self.actors[*i].tangible())
                .map(|i| (self.actors[i].view.pos, h.view.shape))
        });
        for i in 0..self.actors.len() {
            let a = &mut self.actors[i];
            a.encase_steps = a.encase_steps.saturating_sub(1);
            a.view.encased = a.encase_steps as f32 / SIM_HZ as f32;
            a.burst_slow_steps = a.burst_slow_steps.saturating_sub(1);
            a.view.slowed = if a.burst_slow_steps > 0 {
                REVIVE_BURST_SLOW
            } else {
                0.
            };
            let inside = a.tangible()
                && a.view.team == Team::Enemy
                && aura.is_some_and(|(origin, shape)| {
                    contains(shape, origin, Vec2::new(1., 0.), a.view.pos, a.view.radius)
                });
            if !inside {
                a.bubble_steps = 0;
                continue;
            }
            a.view.slowed = a.view.slowed.max(if is_boss(a.view.archetype) {
                BUBBLE_AURA_BOSS_SLOW
            } else {
                BUBBLE_AURA_SLOW
            });
            if is_boss(a.view.archetype) || a.view.encased > 0. {
                continue;
            }
            a.bubble_steps += 1;
            if a.bubble_steps >= SIM_HZ {
                a.bubble_steps = 0;
                if crate::prd::state(&mut self.prd, a.view.id).encase.roll(&mut a.bubble_rng, BUBBLE_AURA_ENCASE_CHANCE) {
                    self.encase(i);
                }
            }
        }
    }

    pub fn encase(&mut self, i: usize) {
        let a = &mut self.actors[i];
        if !a.tangible() || a.view.team != Team::Enemy || is_boss(a.view.archetype) {
            return;
        }
        a.encase_steps = a
            .encase_steps
            .max((BUBBLE_AURA_ENCASE_SECONDS * SIM_HZ as f32) as u32);
        a.view.encased = a.encase_steps as f32 / SIM_HZ as f32;
        a.velocity = Vec2::default();
        if matches!(
            a.view.state,
            ActorState::Basic | ActorState::Cast | ActorState::Walk
        ) {
            a.state(ActorState::Idle, 0., 0.);
            a.action_done = true;
            if a.action_heal {
                a.extra_cd = 0.;
                a.action_heal = false;
            }
            a.action_special = false;
            a.action_extra = false;
            a.action_pulse = false;
            a.action_pound = false;
        }
        self.events.push(Event::Encased {
            id: a.view.id,
            seconds: a.view.encased,
        });
    }
}
