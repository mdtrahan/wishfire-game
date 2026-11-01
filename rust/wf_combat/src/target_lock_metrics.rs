//! Test-only scoped attribution; production builds contain no counters or allocations.
use super::*;
use std::{
    cell::RefCell,
    collections::{BTreeMap, BTreeSet},
};
#[derive(Default)]
pub struct Attempt {
    pub name: String,
    pub target: Option<u32>,
    pub hit: bool,
    pub others: BTreeSet<u32>,
    pub closed: bool,
    pub cancelled: bool,
    pub died: bool,
    pub linked: bool,
}
#[derive(Default)]
pub struct Log {
    pub casts: Vec<Attempt>,
    pub current: [Option<usize>; 4],
    pub hazards: BTreeMap<u32, usize>,
    pub shots: BTreeMap<u32, usize>,
    pub scope: Option<usize>,
    pub damage: [f64; 4],
    pub downs: [u32; 4],
    pub throws: u32,
    pub boss_throws: u32,
    pub boss_interrupts: BTreeMap<String, u32>,
    pub active_steps: u64,
    pub interrupts: BTreeMap<String, u32>,
    pub fights: [u32; 3],
    pub kills: [u32; 3],
    pub wipes: [u32; 3],
    pub duration: [f64; 3],
}
thread_local! { pub static LOG: RefCell<Option<Log>> = const { RefCell::new(None) }; }
pub fn started(s: &Sim, i: usize) {
    LOG.with_borrow_mut(|l| {
        let Some(l) = l else { return };
        let a = &s.actors[i];
        if a.view.team != Team::Hero || a.action_revive {
            return;
        }
        let name = if !a.action_special {
            format!("{:?}Basic", a.view.archetype)
        } else if a.action_pound {
            "GroundPound".into()
        } else if a.action_pulse {
            "ArcanePulse".into()
        } else {
            match (a.view.archetype, a.action_extra) {
                (Archetype::Hondo, false) => "Shadow",
                (Archetype::Hondo, true) => "Split",
                (Archetype::Runa, false) => "BubblePop",
                (Archetype::Runa, true) => "HealingSpring",
                (Archetype::Kaja, true) => "Faze",
                _ => return,
            }
            .into()
        };
        l.current[i] = Some(l.casts.len());
        l.casts.push(Attempt {
            name,
            target: a.target,
            ..Default::default()
        });
    });
}
pub fn action_scope(i: usize) {
    LOG.with_borrow_mut(|l| {
        if let Some(l) = l {
            l.scope = l.current.get(i).copied().flatten();
        }
    });
}
pub fn action_end(s: &Sim) {
    LOG.with_borrow_mut(|l| {
        if let Some(l) = l {
            if let Some(k) = l.scope {
                if !l.casts[k].linked {
                    close(l, k, s);
                }
            }
            l.scope = None;
        }
    });
}
pub fn close(l: &mut Log, k: usize, s: &Sim) {
    let c = &mut l.casts[k];
    if !c.closed {
        c.closed = true;
        c.died = c
            .target
            .is_none_or(|id| s.actor_index(id).is_none_or(|i| !s.actors[i].alive()))
            && !c.hit;
    }
}
pub fn hazard_created(s: &Sim, h: &crate::hazards::Hazard) {
    LOG.with_borrow_mut(|l| {
        if let Some(l) = l {
            if h.view.kind == HazardKind::LizardoDrop
                && s.actor_index(h.view.owner)
                    .is_some_and(|i| s.actors[i].view.archetype == Archetype::Lizardo)
            {
                l.throws += 1;
                l.boss_throws += u32::from(
                    s.actors
                        .iter()
                        .any(|a| a.alive() && crate::tuning::is_boss(a.view.archetype)),
                );
            }
            if matches!(
                h.view.kind,
                HazardKind::BubblePop
                    | HazardKind::GroundPound
                    | HazardKind::ArcanePulse
                    | HazardKind::FazePool
                    | HazardKind::HealingSpring
            ) {
                if let Some(k) = h
                    .view
                    .owner
                    .checked_sub(1)
                    .and_then(|i| l.current.get(i as usize))
                    .copied()
                    .flatten()
                {
                    l.hazards.insert(h.view.id, k);
                    l.casts[k].linked = true;
                }
            }
        }
    });
}
pub fn shot_created(p: &crate::combat::Projectile) {
    LOG.with_borrow_mut(|l| {
        if let Some(l) = l {
            if p.view.team == Team::Hero {
                if let Some(k) = p
                    .source
                    .checked_sub(1)
                    .and_then(|i| l.current.get(i as usize))
                    .copied()
                    .flatten()
                {
                    l.shots.insert(p.view.id, k);
                    l.casts[k].linked = true;
                }
            }
        }
    });
}
pub fn scope(id: u32, shot: bool) {
    LOG.with_borrow_mut(|l| {
        if let Some(l) = l {
            l.scope = if shot {
                l.shots.get(&id)
            } else {
                l.hazards.get(&id)
            }
            .copied();
        }
    });
}
pub fn clear_scope() {
    LOG.with_borrow_mut(|l| {
        if let Some(l) = l {
            l.scope = None;
        }
    });
}
pub fn hit(source: u32, target: u32, amount: f32) {
    LOG.with_borrow_mut(|l| {
        if let Some(l) = l {
            if (1..=4).contains(&source) && target > 4 {
                l.damage[source as usize - 1] += amount as f64;
            }
            if amount > 0. {
                if let Some(k) = l.scope {
                    let c = &mut l.casts[k];
                    if c.target == Some(target) {
                        c.hit = true;
                    } else {
                        c.others.insert(target);
                    }
                }
            }
        }
    });
}
pub fn healed(target: u32, amount: f32) {
    LOG.with_borrow_mut(|l| {
        if let Some(l) = l {
            if amount > 0. {
                if let Some(k) = l.scope {
                    let c = &mut l.casts[k];
                    if c.name == "HealingSpring" {
                        if c.target == Some(target) {
                            c.hit = true;
                        } else {
                            c.others.insert(target);
                        }
                    }
                }
            }
        }
    });
}
pub fn interrupted(kind: Archetype, boss: bool) {
    LOG.with_borrow_mut(|l| {
        if let Some(l) = l {
            *l.interrupts.entry(format!("{kind:?}")).or_default() += 1;
            if boss {
                *l.boss_interrupts.entry(format!("{kind:?}")).or_default() += 1;
            }
        }
    });
}
