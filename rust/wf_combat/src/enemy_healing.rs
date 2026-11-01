//! Enemy support uses the same interruptible Cast and combat-clock cooldowns as attacks.
use crate::{api::*, tuning::*, Sim};

impl Sim {
    pub fn priority_healer(&self, i: usize) -> Option<usize> {
        let hero = &self.actors[i];
        // Reachable healers outrank ordinary victims without granting extra perception.
        self.actors
            .iter()
            .enumerate()
            .filter(|(t, e)| {
                self.can_engage(i, *t)
                    && e.view.archetype == Archetype::Marid
                    && hero.view.pos.distance(e.view.pos)
                        <= hero.attack_range(e)
                            * if hero.view.archetype == Archetype::Hondo {
                                2.
                            } else {
                                1.
                            }
            })
            .min_by(|(_, x), (_, y)| {
                hero.view
                    .pos
                    .distance(x.view.pos)
                    .total_cmp(&hero.view.pos.distance(y.view.pos))
                    .then_with(|| x.view.id.cmp(&y.view.id))
            })
            .map(|(t, _)| t)
    }
    pub fn enemy_heal_target(&self, healer: usize) -> Option<usize> {
        let boss = self.actors[healer].view.archetype == Archetype::BossBomber;
        let eligible = |j: usize| {
            let a = &self.actors[j];
            a.tangible()
                && a.view.team == Team::Enemy
                && a.view.state != ActorState::Spawn
                && a.view.hp < a.view.max_hp
                && (!boss || (!is_boss(a.view.archetype) && j != healer))
        };
        // A hurt companion always takes precedence over a Marid's own wounds.
        let other = (0..self.actors.len()).any(|j| j != healer && eligible(j));
        (0..self.actors.len())
            .filter(|&j| eligible(j) && (!other || j != healer))
            .min_by(|&x, &y| {
                let a = &self.actors[x].view;
                let b = &self.actors[y].view;
                (a.hp / a.max_hp)
                    .total_cmp(&(b.hp / b.max_hp))
                    .then_with(|| a.id.cmp(&b.id))
            })
    }
    pub fn try_enemy_heal(&mut self, i: usize) -> bool {
        let a = &self.actors[i];
        let boss = a.view.archetype == Archetype::BossBomber;
        if !matches!(a.view.archetype, Archetype::Marid | Archetype::BossBomber)
            || !a.tangible()
            || a.extra_cd > 0.
            || a.boss_retry_basic
            || a.boss_retry_special
        {
            return false;
        }
        // A boss never abandons an accepted attack package to heal.
        if boss
            && !a.fortress
            && self.hazards.iter().any(|h| {
                h.view.owner == a.view.id && h.view.hostile && h.view.phase != HazardPhase::Resolved
            })
        {
            return false;
        }
        let Some(t) = self.enemy_heal_target(i) else {
            return false;
        };
        let target = self.actors[t].view.id;
        let a = &mut self.actors[i];
        a.target = Some(target);
        a.action_heal = true;
        a.action_done = false;
        a.action_special = false;
        a.action_extra = false;
        a.action_revive = false;
        a.action_epoch += 1;
        a.velocity = Vec2::default();
        a.state(ActorState::Cast, ENEMY_HEAL_CAST, ENEMY_HEAL_CAST);
        a.extra_cd = if boss {
            CHIMERA_HEAL_INTERVAL
        } else {
            MARID_HEAL_INTERVAL
        };
        self.events.push(Event::ActionStarted {
            id: a.view.id,
            target: Some(target),
            state: ActorState::Cast,
        });
        self.events.push(Event::EnemyHealCast {
            healer: a.view.id,
            target,
            seconds: ENEMY_HEAL_CAST,
        });
        true
    }
    pub fn enemy_heal_impact(&mut self, i: usize) {
        let locked = self.actors[i]
            .target
            .and_then(|id| self.actor_index(id))
            .filter(|&t| self.actors[t].tangible() && self.actors[t].view.team == Team::Enemy);
        let Some(t) = locked.or_else(|| self.enemy_heal_target(i)) else {
            return;
        };
        self.actors[i].target = Some(self.actors[t].view.id);
        let healer = self.actors[i].view.id;
        let fraction = if self.actors[i].view.archetype == Archetype::BossBomber {
            CHIMERA_HEAL_FRACTION
        } else {
            let (min, max) = if is_boss(self.actors[t].view.archetype) {
                (MARID_BOSS_HEAL_MIN, MARID_BOSS_HEAL_MAX)
            } else {
                (MARID_HEAL_MIN, MARID_HEAL_MAX)
            };
            self.actors[i].ai_rng.range(min, max)
        };
        let target = &mut self.actors[t].view;
        let amount = (target.max_hp * fraction).min(target.max_hp - target.hp);
        if amount > 0. {
            target.hp += amount;
            self.events.push(Event::EnemyHealed {
                healer,
                target: target.id,
                amount,
            });
            self.events.push(Event::Healed {
                target: target.id,
                amount,
                source: crate::HealSource::EnemyHeal,
            });
        }
    }
}
