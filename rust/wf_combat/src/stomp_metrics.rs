//! Test-only, exact pre-resolution feet contact and matched encounter measurements.
use crate::*;
use std::cell::RefCell;
thread_local! {pub static CONTACTS:RefCell<Option<Vec<(u32,u32,u32,u8,u8)>>> = const{RefCell::new(None)};}
pub fn resolving(s: &Sim, h: &crate::hazards::Hazard) {
    CONTACTS.with(|c| {
        if let Some(c) = c.borrow_mut().as_mut() {
            if h.view.kind != HazardKind::BossSlam
                && format!("{:?}", h.view.kind) != "BossStompStep"
            {
                return;
            }
            let mut risk = 0;
            let mut contact = 0;
            let mut alive_mask = 0u8;
            let mut contact_mask = 0u8;
            for a in &s.actors {
                if a.alive() && a.view.team == Team::Hero {
                    risk += 1;
                    let bit = 1u8 << crate::actors::hero_index(a.view.archetype).unwrap();
                    alive_mask |= bit;
                    if h.hits(a.view.pos, 0.) {
                        contact += 1;
                        contact_mask |= bit;
                    }
                }
            }
            c.push((h.view.id, risk, contact, alive_mask, contact_mask));
        }
    });
}
