//! Renewal-calibrated binary rolls. Categorical choices keep their original RNG path.
use crate::rng::Rng;

#[derive(Clone, Copy, Debug)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[cfg_attr(feature = "serde", serde(transparent))]
pub struct Counter {
    /// Consecutive eligible failures + 1. This is the entire persistent state.
    pub next: u64,
    #[cfg_attr(feature = "serde", serde(skip))]
    nominal: f32,
    #[cfg_attr(feature = "serde", serde(skip))]
    coefficient: f64,
}
impl Default for Counter {
    fn default() -> Self {
        Self {
            next: 1,
            nominal: 0.,
            coefficient: 0.,
        }
    }
}
impl PartialEq for Counter {
    fn eq(&self, other: &Self) -> bool {
        self.next == other.next
    }
}
impl Counter {
    pub fn roll(&mut self, rng: &mut Rng, p: f32) -> bool {
        if self.nominal != p {
            self.nominal = p;
            self.coefficient = constant(p as f64);
        }
        // Consume exactly one draw, including the 0% and 100% endpoints.
        let success = (rng.unit() as f64) < (self.coefficient * self.next as f64).min(1.);
        self.next = if success {
            1
        } else {
            self.next.saturating_add(1)
        };
        success
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct State {
    pub damage_crit: Counter,
    pub evade: Counter,
    pub encase: Counter,
    pub push_resist: Counter,
    pub heal_crit: Counter,
}
impl State {
    pub fn counters(self) -> [u64; 5] {
        [
            self.damage_crit.next,
            self.evade.next,
            self.encase.next,
            self.push_resist.next,
            self.heal_crit.next,
        ]
    }
}

/// Same renewal equation as the ORKA-nspw.10 audit solver:
/// E[T] = sum(k >= 0, product(j = 1..k, 1 - min(1, C*j))), rate = 1/E[T].
/// Sum survival down to 1e-18; 80 f64 bisections resolve C to f64 precision.
/// Actors cache C until the nominal stat changes; changing p retains earned N.
pub fn constant(p: f64) -> f64 {
    if !(p > 0.) {
        return 0.;
    }
    if p >= 1. {
        return 1.;
    }
    let (mut low, mut high) = (0., p);
    for _ in 0..80 {
        let c = (low + high) / 2.;
        let (mut survival, mut expected, mut n) = (1., 0., 1u64);
        loop {
            expected += survival;
            survival *= 1. - (c * n as f64).min(1.);
            if survival < 1e-18 {
                break;
            }
            n += 1;
        }
        if 1. / expected < p {
            low = c;
        } else {
            high = c;
        }
    }
    (low + high) / 2.
}

/// Actor ids increase at spawn; sorted lookup also supports ownerless fixture contacts.
pub fn state(history: &mut Vec<(u32, State)>, id: u32) -> &mut State {
    let index = history
        .binary_search_by_key(&id, |(actor, _)| *actor)
        .unwrap_or_else(|index| {
            history.insert(index, (id, State::default()));
            index
        });
    &mut history[index].1
}

impl crate::Sim {
    /// A removed actor needs history only while an owned attack can still resolve.
    pub fn prune_prd(&mut self) {
        self.prd.retain(|(id, _)| {
            self.actors.iter().any(|a| a.view.id == *id)
                || self.projectiles.iter().any(|p| p.source == *id)
                || self.hazards.iter().any(|h| h.view.owner == *id)
        });
    }
}
