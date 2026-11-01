//! Test-only decaying credit ledger. Enabled only by the ignored matched diagnostic.
use crate::*;
use std::cell::{Cell, RefCell};
pub const N: usize = 22;
pub struct Bank {
    pub boss: u32,
    pub credit: [[f64; N]; 4],
    pub fallback_from_fara: bool,
}
pub struct Log {
    pub banks: Vec<Bank>,
    pub leaders: [[u64; 4]; 3],
    pub fractions: [[[f64; N]; 4]; 3],
    pub aim_ally: [u64; 3],
    pub fallback: [u64; 3],
    pub max_error: f64,
}
impl Default for Log {
    fn default() -> Self {
        Self {
            banks: Vec::new(),
            leaders: [[0; 4]; 3],
            fractions: [[[0.; N]; 4]; 3],
            aim_ally: [0; 3],
            fallback: [0; 3],
            max_error: 0.,
        }
    }
}
thread_local! {static LOG:RefCell<Option<Log>>=const{RefCell::new(None)};static SCOPE:Cell<usize>=const{Cell::new(0)};}
pub fn start() {
    LOG.with(|l| *l.borrow_mut() = Some(Log::default()));
}
pub fn seed() {
    LOG.with(|l| {
        if let Some(l) = l.borrow_mut().as_mut() {
            l.banks.clear();
        }
    });
}
pub fn bank(l: &mut Log, boss: u32) -> &mut Bank {
    if let Some(i) = l.banks.iter().position(|b| b.boss == boss) {
        return &mut l.banks[i];
    }
    l.banks.push(Bank {
        boss,
        credit: [[0.; N]; 4],
        fallback_from_fara: false,
    });
    l.banks.last_mut().unwrap()
}
pub fn credit(boss: u32, hero: usize, category: usize, amount: f32) {
    LOG.with(|l| {
        if let Some(l) = l.borrow_mut().as_mut() {
            bank(l, boss).credit[hero][category] += amount as f64;
        }
    });
}
pub fn damage(boss: u32, hero: usize, base: f32, spike: bool) {
    let k = SCOPE.with(Cell::get);
    credit(boss, hero, k, base);
    if spike {
        credit(boss, hero, k + 9, base);
    }
}
pub fn decay(boss: u32, hero: usize, factor: f32) {
    LOG.with(|l| {
        if let Some(l) = l.borrow_mut().as_mut() {
            for c in &mut bank(l, boss).credit[hero] {
                *c *= factor as f64;
            }
        }
    });
}
pub fn action(s: &Sim, i: usize) {
    let a = &s.actors[i];
    let k = if a.view.archetype == Archetype::Hondo && a.action_special {
        1
    } else if a.view.archetype == Archetype::Hondo && a.action_extra {
        2
    } else {
        0
    };
    SCOPE.with(|v| v.set(k));
}
pub fn hazard(kind: HazardKind) {
    SCOPE.with(|v| {
        v.set(match kind {
            HazardKind::BubblePop => 3,
            HazardKind::ArcanePulse => 4,
            HazardKind::GroundPound => 5,
            HazardKind::FazePool => 6,
            HazardKind::KajaAura => 7,
            _ => 8,
        })
    });
}
pub fn basic() {
    SCOPE.with(|v| v.set(0));
}
pub fn aim(boss: u32, fallback_from_fara: bool) {
    LOG.with(|l| {
        if let Some(l) = l.borrow_mut().as_mut() {
            bank(l, boss).fallback_from_fara = fallback_from_fara;
        }
    });
}
pub fn observe(s: &Sim) {
    LOG.with(|l| {
        let mut l = l.borrow_mut();
        let Some(l) = l.as_mut() else { return };
        for a in &s.actors {
            let tier = match a.view.archetype {
                Archetype::Boss => 0,
                Archetype::BossBomber => 1,
                Archetype::BossMarksman => 2,
                _ => continue,
            };
            if !a.alive() || a.view.state == ActorState::Spawn {
                continue;
            }
            let Some(row) = s.snapshot.enmity.iter().find(|r| r.boss == a.view.id) else {
                continue;
            };
            let b = bank(l, a.view.id);
            let credit = b.credit;
            let fallback = b.fallback_from_fara;
            for k in 0..4 {
                let actual = a.enmity[k] as f64;
                let mirror: f64 = credit[k].iter().sum();
                l.max_error = l.max_error.max((actual - mirror).abs());
            }
            let top = (0..4)
                .max_by(|&i, &j| {
                    row.values[i]
                        .total_cmp(&row.values[j])
                        .then_with(|| j.cmp(&i))
                })
                .unwrap();
            if row.values[top] > 0. {
                l.leaders[tier][top] += 1;
                let sum: f64 = credit[top].iter().sum();
                if sum > 0. {
                    for k in 0..N {
                        l.fractions[tier][top][k] += credit[top][k] / sum;
                    }
                }
            }
            if a.target.and_then(|id| s.actor_index(id)).is_some_and(|i| {
                s.actors[i].alive() && s.actors[i].view.archetype != Archetype::Fara
            }) {
                l.aim_ally[tier] += 1;
                if fallback {
                    l.fallback[tier] += 1;
                }
            }
        }
    });
}
pub fn finish() {
    LOG.with(|l| {
        if let Some(l) = l.borrow_mut().take() {
            println!(
                "ENMITY_ATTR leaders={:?} aim_ally={:?} fallback_from_fara={:?} max_error={:.6}",
                l.leaders, l.aim_ally, l.fallback, l.max_error
            );
            for t in 0..3 {
                for h in 0..4 {
                    println!(
                        "ENMITY_CREDIT tier={} hero={} frames={} composition={:?}",
                        t + 1,
                        h,
                        l.leaders[t][h],
                        l.fractions[t][h]
                    );
                }
            }
        }
    });
}
