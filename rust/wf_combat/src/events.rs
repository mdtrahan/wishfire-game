//! Keep step-time events flat; materialize owned public payloads at the drain boundary.
use crate::{Event, HazardKind, Vec2};
pub enum Pending {
    Event(Event),
    Hit { event: Event, hp_loss: f32 },
    Split {
        hero: u32,
        center: Vec2,
        start: usize,
        end: usize,
    },
    Taunt {
        hero: u32,
        start: usize,
        end: usize,
    },
    Resolved {
        id: u32,
        kind: HazardKind,
        start: usize,
        end: usize,
    },
}
pub struct Events {
    pub pending: Vec<Pending>,
    pub victims: Vec<u32>,
}
impl Events {
    pub fn new() -> Self {
        Self {
            pending: Vec::with_capacity(512),
            victims: Vec::with_capacity(128),
        }
    }
    pub fn push(&mut self, event: Event) {
        self.pending.push(Pending::Event(event));
    }
    // Presentation telemetry accompanies the original event without changing
    // the frozen public Event shape, RNG, gameplay hashes or damage order.
    pub fn hit(&mut self, event: Event, hp_loss: f32) {
        self.pending.push(Pending::Hit { event, hp_loss });
    }
    pub fn hp_losses(&self) -> std::collections::BTreeMap<usize, f32> {
        self.pending.iter().enumerate().filter_map(|(index, entry)| {
            if let Pending::Hit { hp_loss, .. } = entry { Some((index, *hp_loss)) } else { None }
        }).collect()
    }
    pub fn victim_start(&self) -> usize {
        self.victims.len()
    }
    pub fn victim(&mut self, id: u32) {
        self.victims.push(id);
    }
    pub fn resolved(&mut self, id: u32, kind: HazardKind, start: usize) {
        self.pending.push(Pending::Resolved {
            id,
            kind,
            start,
            end: self.victims.len(),
        });
    }
    pub fn split(&mut self, hero: u32, center: Vec2, start: usize) {
        self.pending.push(Pending::Split {
            hero,
            center,
            start,
            end: self.victims.len(),
        });
    }
    pub fn taunt(&mut self, hero: u32, start: usize) {
        self.pending.push(Pending::Taunt {
            hero,
            start,
            end: self.victims.len(),
        });
    }
    pub fn resolved_empty(&mut self, id: u32, kind: HazardKind) {
        self.resolved(id, kind, self.victims.len());
    }
    #[cfg(any(test, feature = "reference-diagnostics"))]
    pub fn clear(&mut self) {
        self.pending.clear();
        self.victims.clear();
    }
    pub fn drain(&mut self) -> Vec<Event> {
        let result = self
            .pending
            .drain(..)
            .map(|e| match e {
                Pending::Event(e) => e,
                Pending::Hit { event, .. } => event,
                Pending::Taunt { hero, start, end } => Event::Taunt {
                    hero,
                    radius: crate::tuning::TAUNT_RADIUS,
                    enemies: self.victims[start..end].to_vec(),
                    seconds: crate::tuning::TAUNT_DURATION,
                },
                Pending::Split {
                    hero,
                    center,
                    start,
                    end,
                } => Event::SplitStrike {
                    hero,
                    center,
                    targets: self.victims[start..end].to_vec(),
                },
                Pending::Resolved {
                    id,
                    kind,
                    start,
                    end,
                } => Event::HazardResolved {
                    id,
                    kind,
                    victims: self.victims[start..end].to_vec(),
                },
            })
            .collect();
        self.victims.clear();
        result
    }
}
