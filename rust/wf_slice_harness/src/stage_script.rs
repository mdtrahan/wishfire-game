//! Build-time compiled designer waves; no JSON parsing occurs in the simulation.
use crate::{Archetype, Vec2};

pub(crate) const MAX_SPAWNS: usize = 32;

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) enum Anchor {
    Party,
    Arena,
}

#[derive(Clone, Copy, Debug)]
pub(crate) enum Trigger {
    PreviousCleared { delay_s: f32 },
}
impl Trigger {
    pub fn ready(self, clear_age: f32, occupied: bool) -> bool {
        match self {
            Self::PreviousCleared { delay_s } => !occupied && clear_age + 0.00001 >= delay_s,
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct Spawn {
    pub archetype: Archetype,
    pub offset: Vec2,
    pub delay_s: f32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) enum Pattern {
    Authored,
    Seeded,
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct SubWave {
    pub placed: Anchor,
    pub pattern: Pattern,
    pub spawns: &'static [Spawn],
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct MiniWave {
    pub trigger: Trigger,
    pub subwaves: &'static [SubWave],
    #[allow(dead_code)] // Designer metadata, retained in generated tables for consumers.
    pub name: &'static str,
    #[allow(dead_code)]
    pub theme: &'static str,
}

include!(concat!(env!("OUT_DIR"), "/waves.rs"));

pub(crate) fn script(tier: u8) -> &'static [MiniWave] {
    match tier {
        2 => STAGE_2,
        3 => STAGE_3,
        _ => STAGE_1,
    }
}
pub(crate) fn mini_waves(tier: u8) -> u32 {
    script(tier).len() as u32 - 1
}
