//! `web-runner/src/core/seededRngRules.mjs` (previewSeededRng).
use crate::jsnum::{imul, to_uint32};

pub fn normalize_seed(seed: f64) -> u32 {
    let normalized = to_uint32(if seed.is_finite() { seed } else { 1. }.floor());
    if normalized == 0 { 1 } else { normalized }
}
/// Copy of the LCG at draw index `draws` without advancing the combat owner.
pub fn preview_seeded_rng(seed: f64, draws: f64) -> f64 {
    let mut count = (if draws.is_finite() { draws } else { 0. }).floor().max(0.) + 1.;
    let mut multiplier: u32 = 1664525;
    let mut increment: u32 = 1013904223;
    let mut state = normalize_seed(seed);
    while count > 0. {
        if count % 2. != 0. { state = (imul(multiplier as f64, state as f64) as u32).wrapping_add(increment); }
        increment = (imul(multiplier as f64, increment as f64) as u32).wrapping_add(increment);
        multiplier = imul(multiplier as f64, multiplier as f64) as u32;
        count = (count / 2.).floor();
    }
    state as f64 / 4294967296.
}
pub fn preview_u32(seed: u32, draws: f64) -> f64 { preview_seeded_rng(seed as f64, draws) }
