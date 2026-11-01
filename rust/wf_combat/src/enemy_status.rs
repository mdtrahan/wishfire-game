//! Enemy identities share normal perception, combat clocks and fixed actor storage.
use crate::{actors::Actor, tuning::*, *};

impl Actor {
    pub fn clear_ailments(&mut self) {
        self.poison_steps = 0;
        self.poison_tick_steps = 0;
        self.poison_damage = 0.;
        self.poison_source = None;
        self.view.poisoned = 0.;
    }
}
impl Sim {
    pub fn gloamink_target(&self, i: usize) -> Option<usize> {
        let a = &self.actors[i];
        let mage = self
            .actors
            .iter()
            .enumerate()
            .filter(|(_, t)| {
                t.alive() && matches!(t.view.archetype, Archetype::Runa | Archetype::Kaja)
            })
            .min_by(|(_, x), (_, y)| {
                a.view
                    .pos
                    .distance(x.view.pos)
                    .total_cmp(&a.view.pos.distance(y.view.pos))
                    .then_with(|| x.view.id.cmp(&y.view.id))
            })
            .map(|(j, _)| j)?;
        let delta = self.actors[mage].view.pos - a.view.pos;
        let length2 = delta.dot(delta);
        self.actors
            .iter()
            .enumerate()
            .filter(|(j, t)| {
                if *j == mage || !t.alive() || t.view.team != Team::Hero || length2 <= 0. {
                    return false;
                }
                let along = (t.view.pos - a.view.pos).dot(delta) / length2;
                along > 0.
                    && along < 1.
                    && t.view.pos.distance(a.view.pos + delta * along)
                        < a.view.radius + t.view.radius + 2.
            })
            .min_by(|(_, x), (_, y)| {
                a.view
                    .pos
                    .distance(x.view.pos)
                    .total_cmp(&a.view.pos.distance(y.view.pos))
                    .then_with(|| x.view.id.cmp(&y.view.id))
            })
            .map(|(j, _)| j)
            .or(Some(mage))
    }

    pub fn enemy_rallied(&self, i: usize) -> bool {
        let target = &self.actors[i];
        target.alive()
            && target.view.team == Team::Enemy
            && self.actors.iter().any(|a| {
                a.alive()
                    && a.view.archetype == Archetype::Bastorto
                    && a.view.state != ActorState::Spawn
                    && a.view.pos.distance(target.view.pos) <= RALLY_RADIUS + target.view.radius
            })
    }

    pub fn apply_poison(&mut self, i: usize, source: u32, damage: f32) {
        if self.actors[i].alive() && self.actors[i].revive_immunity_steps == 0 {
            let a = &mut self.actors[i];
            if a.poison_steps == 0 || damage >= a.poison_damage {
                a.poison_damage = damage;
                a.poison_source = Some(source);
            }
            a.poison_steps = (ENEMY_POISON_SECONDS * SIM_HZ as f32).round() as u32;
            a.view.poisoned = ENEMY_POISON_SECONDS;
        }
    }
    pub fn enemy_statuses(&mut self) {
        for i in 0..self.actors.len() {
            let a = &mut self.actors[i];
            if !a.alive() {
                a.clear_ailments();
                continue;
            }
            let mut poison = None;
            if a.poison_steps > 0 {
                a.poison_steps -= 1;
                a.poison_tick_steps += 1;
                if a.poison_tick_steps >= SIM_HZ {
                    a.poison_tick_steps = 0;
                    poison = a.poison_source.map(|source| (source, a.poison_damage));
                }
            }
            a.view.poisoned = a.poison_steps as f32 / SIM_HZ as f32;
            if let Some((source, damage)) = poison {
                self.damage(source, i, damage, false, false, Element::Poison);
            }
            if self.actors[i].poison_steps == 0 {
                let a = &mut self.actors[i];
                a.poison_tick_steps = 0;
                a.poison_damage = 0.;
                a.poison_source = None;
            }
        }
    }
}
