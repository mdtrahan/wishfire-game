//! Healing Spring retains its skill identity as a committed, target-locked heal.
use crate::{tuning::*, *};
impl Sim {
    pub fn super_heal_target(&self) -> Option<usize> {
        self.actors
            .iter()
            .enumerate()
            .filter(|(_, a)| {
                a.alive()
                    && a.view.team == Team::Hero
                    && a.view.hp < a.view.max_hp * SUPER_HEAL_THRESHOLD
            })
            .min_by(|(_, a), (_, b)| {
                (a.view.hp / a.view.max_hp)
                    .total_cmp(&(b.view.hp / b.view.max_hp))
                    .then_with(|| a.view.id.cmp(&b.view.id))
            })
            .map(|(i, _)| i)
    }
    pub fn super_heal(&mut self, caster: usize, target: usize) {
        if !self.actors[target].alive() || self.actors[target].view.team != Team::Hero {
            return;
        }
        let potency = self.actors[caster].committed_potency();
        let source = &self.actors[caster];
        let max_hp = if source.target == Some(self.actors[target].view.id)
            && source.view.state == ActorState::Cast
            && (source.revised_action() || source.action_target_revision != self.actors[target].permanent_revision) {
            source.action_target_max_hp
        } else { self.actors[target].view.max_hp };
        let a = &mut self.actors[target];
        let amount = (max_hp * SUPER_HEAL_FRACTION * potency).min((a.view.max_hp - a.view.hp).max(0.));
        if amount <= 0. {
            return;
        }
        a.view.hp += amount;
        self.spring_healing += amount as f64;
        self.events.push(Event::Healed {
            target: a.view.id,
            amount,
            source: crate::HealSource::HealingSpring,
        });
        self.healing_enmity(self.actors[caster].view.id, amount);
    }
}
