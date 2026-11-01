//! Read-only 20-seed beam warning, physical-front and first-Djinn-fight measurements.
use crate::*;
use std::{cell::RefCell, collections::BTreeMap};
thread_local! {pub static DAMAGE:RefCell<Option<BTreeMap<u32,f64>>>=const{RefCell::new(None)};}
pub fn damaged(id: u32, amount: f32) {
    DAMAGE.with(|d| {
        if let Some(d) = d.borrow_mut().as_mut() {
            *d.entry(id).or_default() += amount as f64;
        }
    });
}
#[derive(Clone)]
pub struct Line {
    pub kind: usize,
    pub initial: u8,
    pub locked: bool,
    pub launched: bool,
}
pub fn mask(s: &Sim, h: &crate::hazards::Hazard) -> u8 {
    let mut m = 0;
    for a in &s.actors {
        if a.alive() && a.view.team == Team::Hero && h.hits(a.view.pos, a.view.radius) {
            m |= 1 << crate::actors::hero_index(a.view.archetype).unwrap();
        }
    }
    m
}
pub fn quantile(v: &mut [f32], q: f32) -> f32 {
    v.sort_by(f32::total_cmp);
    if v.is_empty() {
        0.
    } else {
        v[((v.len() - 1) as f32 * q).round() as usize]
    }
}
