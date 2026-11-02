//! WFM-only definitions (R7). No slice boss or appearance aliases.
use crate::{api::*, Sim};

pub fn is_wfm(kind: Archetype) -> bool {
    matches!(
        kind,
        Archetype::WfmHighGobloc
            | Archetype::WfmSkeleton
            | Archetype::WfmChimerilass
            | Archetype::WfmDjinn
    )
}
impl Sim {
    pub fn wfm_start_action(&mut self, i: usize, t: usize) {
        let a = &self.actors[i];
        let mut action = 0; // physical single target
        let mut target = self.actors[t].view.id;
        if a.view.archetype == Archetype::WfmChimerilass
            && a.view.hp <= libm::floorf(a.view.max_hp * 0.5)
        {
            let allies: Vec<_> = self
                .actors
                .iter()
                .enumerate()
                .filter(|(j, a)| {
                    *j != i && a.alive() && a.view.team == Team::Enemy && a.view.hp < a.view.max_hp
                })
                .map(|(j, _)| j)
                .collect();
            let group = if allies.len() > 1 { 20. } else { 0. };
            let single = if !allies.is_empty() { 15. } else { 0. };
            let pick = self.actors[i].ai_rng.range(0., group + single + 65.);
            if pick <= group && group > 0. {
                action = 4;
            } else if pick <= group + single && single > 0. {
                action = 3;
                let j = (self.actors[i].ai_rng.range(0., allies.len() as f32) as usize)
                    .min(allies.len() - 1);
                target = self.actors[allies[j]].view.id;
            } else {
                action = 2;
                target = self.actors[i].view.id;
            }
        } else if matches!(
            a.view.archetype,
            Archetype::WfmChimerilass | Archetype::WfmDjinn
        ) {
            // An absent board converts Djinn's Scathe to its regular magic attack.
            let roll = self.actors[i].ai_rng.range(0., 1.);
            if roll
                < if self.actors[i].view.archetype == Archetype::WfmDjinn {
                    0.85
                } else {
                    0.49
                }
            {
                action = 1;
            }
        }
        self.start_action(i, Some(target), false, false);
        let a = &mut self.actors[i];
        a.wfm_action = action;
        let state = if matches!(
            a.view.archetype,
            Archetype::WfmChimerilass | Archetype::WfmDjinn
        ) {
            ActorState::Cast
        } else {
            ActorState::Basic
        };
        // WFM's stationary anticipation + forward timing, then recovery.
        a.state(state, 1.09, 0.89);
        a.basic_cd = a.stats.interval;
    }

    pub fn wfm_impact(&mut self, i: usize, target: Option<usize>) {
        let a = self.actors[i].clone();
        if a.wfm_action < 2 {
            if let Some(t) = target.filter(|t| self.actors[*t].alive()) {
                let magic = a.wfm_action == 1;
                self.damage(
                    a.view.id,
                    t,
                    a.committed_stats().attack(if magic { DamageChannel::Magic } else { DamageChannel::Physical }),
                    true,
                    true,
                    if magic {
                        Element::Arcane
                    } else {
                        Element::Physical
                    },
                );
            }
            return;
        }
        let (floor, low, high) = match a.wfm_action {
            4 => (9., -1., 2.),
            3 => (5., -2., 3.),
            _ => (6., -3., 4.),
        };
        let base = libm::floorf(a.committed_stats().mag * 0.5).max(1.);
        let min = (base + low).max(floor);
        let max = (base + high).max(min);
        let rolled = min + libm::floorf(self.actors[i].ai_rng.range(0., 1.) * (max - min + 1.));
        let crit = self.actors[i].ai_rng.range(0., 1.) <= 0.1;
        let multiplier = if a.committed_stats().mag > 0. {
            (1. + a.committed_stats().mag / 10.).min(3.)
        } else {
            1.1
        };
        let heal = libm::floorf(
            rolled
                * if crit {
                    1. + (multiplier - 1.) * 0.1
                } else {
                    1.
                },
        )
        .max(1.);
        let targets: Vec<_> = if a.wfm_action == 4 {
            self.actors
                .iter()
                .enumerate()
                .filter(|(_, a)| a.alive() && a.view.team == Team::Enemy)
                .map(|(j, _)| j)
                .collect()
        } else {
            vec![target
                .filter(|t| self.actors[*t].alive() && self.actors[*t].view.team == Team::Enemy)
                .unwrap_or(i)]
        };
        for t in targets {
            let v = &mut self.actors[t].view;
            let amount = heal.min(v.max_hp - v.hp);
            if amount > 0. {
                v.hp += amount;
                self.events.push(Event::Healed {
                    target: v.id,
                    amount,
                    source: HealSource::EnemyHeal,
                });
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{tuning, SimConfig};
    fn world(kind: Archetype) -> Sim {
        let mut sim = Sim::new(SimConfig::default());
        sim.spawn_actor(
            Archetype::Fara,
            Vec2::new(480., 1000.),
            tuning::stats(Archetype::Fara),
        );
        sim.spawn_actor(kind, Vec2::new(480., 1050.), tuning::stats(kind));
        sim.actors[1].stats.mag = 26.;
        sim
    }
    #[test]
    fn wfm_melee_has_no_slice_rally_or_boss_package() {
        for kind in [Archetype::WfmHighGobloc, Archetype::WfmSkeleton] {
            let mut sim = world(kind);
            sim.wfm_start_action(1, 0);
            assert_eq!(sim.actors[1].view.state, ActorState::Basic);
            assert_eq!(sim.actors[1].wfm_action, 0);
            assert!(sim.hazards.is_empty());
        }
    }
    #[test]
    fn ordinary_chimerilass_heals_only_below_half_and_never_bombs() {
        let mut sim = world(Archetype::WfmChimerilass);
        for _ in 0..100 {
            sim.wfm_start_action(1, 0);
            assert!(sim.actors[1].wfm_action < 2);
        }
        sim.actors[1].view.hp = 30.;
        sim.wfm_start_action(1, 0);
        assert_eq!(sim.actors[1].wfm_action, 2);
        sim.wfm_impact(1, Some(1));
        assert!(sim.actors[1].view.hp > 30.);
        assert!(sim.hazards.is_empty());
    }
    #[test]
    fn ordinary_djinn_keeps_magic_and_physical_single_target_choices() {
        let mut sim = world(Archetype::WfmDjinn);
        let mut choices = [false; 2];
        for _ in 0..100 {
            sim.wfm_start_action(1, 0);
            choices[sim.actors[1].wfm_action as usize] = true;
            assert_eq!(sim.actors[1].view.state, ActorState::Cast);
        }
        assert_eq!(choices, [true, true]);
        assert!(sim.hazards.is_empty());
    }
    #[test]
    fn djinn_selects_offence_and_defence_by_each_actions_channel() {
        for action in [0, 1] {
            let mut sim = world(Archetype::WfmDjinn);
            sim.actors[0].stats.def = 100.;
            sim.actors[0].stats.res = 300.;
            sim.actors[0].stats.evade = 0.;
            sim.actors[1].stats.atk = 8.;
            sim.actors[1].stats.mag = 80.;
            sim.wfm_start_action(1, 0);
            sim.actors[1].wfm_action = action;
            let before = sim.actors[0].view.hp;
            sim.wfm_impact(1, Some(0));
            let loss = before - sim.actors[0].view.hp;
            let expected = if action == 0 { 4. } else { 20. };
            assert!(loss == expected || loss == expected * crate::tuning::CRIT_MULTIPLIER);
        }
    }

    #[test]
    fn ported_enemy_magic_and_resistance_retain_authored_wfm_values() {
        for (kind, mag, res) in [
            (Archetype::WfmHighGobloc, 8., 12.),
            (Archetype::WfmSkeleton, 4., 4.),
            (Archetype::WfmChimerilass, 26., 16.),
            (Archetype::WfmDjinn, 28., 14.),
        ] {
            let stats = tuning::stats(kind);
            assert_eq!((stats.mag, stats.res), (mag, res));
        }
    }

}
