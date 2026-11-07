//! P1-dark sprite multiply only; infection and ticks remain sim-owned.
use macroquad::prelude::Color;
use std::collections::BTreeMap;
use wf_combat::{ActorState, ActorView, Snapshot};

// output/ORKA-6jh1.32/src/render.py: poison(), darken(), smooth(), decay().
// The study deepens assets::POISON to this authored multiply colour.
const DARK: [f32; 3] = [0.12, 0.88, 0.18];
const BASE: f32 = 0.45;
const TICK: f32 = 0.65;
const WIDTH: f64 = 0.105;
const FADE: f64 = 1.5;

struct Infection {
    since: f64,
    ended: Option<f64>,
    from: f32,
}
impl Infection {
    fn strength(&self, now: f64) -> f32 {
        if let Some(end) = self.ended {
            return TICK * (1. - ((now - end) / FADE).clamp(0., 1.) as f32).powi(3);
        }
        let age = (now - self.since).max(0.);
        // Same Gaussian as the study, centred on each one-second poison tick.
        // Refreshes extend infection without resetting the sim's tick phase.
        let tick = age.round().max(1.);
        let pulse = (-((age - tick) / WIDTH).powi(2)).exp() as f32;
        // The study switches on immediately. Requested ease-in uses its existing
        // 1.5-second smoothstep, while the tick and exit curves stay unchanged.
        let t = (age / FADE).clamp(0., 1.) as f32;
        let base = self.from + (BASE - self.from) * t * t * (3. - 2. * t);
        base + (TICK - BASE) * pulse
    }
}
fn living(a: &ActorView) -> bool {
    a.hp > 0. && !matches!(a.state, ActorState::Downed | ActorState::Dead)
}
/// Observe the full snapshot once, before spotlight partitioning; both sprite paths
/// share these records and the combat clock (poison pauses during spotlight).
#[derive(Default)]
pub struct PoisonTint {
    infections: BTreeMap<u32, Infection>,
    now: f64,
}
impl PoisonTint {
    pub fn observe(&mut self, s: &Snapshot) {
        self.now = s.combat_time;
        self.infections.retain(|id, infection| {
            s.actors.iter().any(|a| a.id == *id && living(a))
                && infection.ended.is_none_or(|end| self.now - end < FADE)
        });
        for a in s.actors.iter().filter(|a| living(a)) {
            if a.poisoned > 0. {
                let infection = self.infections.entry(a.id).or_insert(Infection {
                    since: self.now, ended: None, from: 0.,
                });
                if infection.ended.is_some() {
                    *infection = Infection { since: self.now, ended: None, from: infection.strength(self.now) };
                }
            } else if let Some(infection) = self.infections.get_mut(&a.id) {
                infection.ended.get_or_insert(self.now);
            }
        }
    }
    fn strength(&self, a: &ActorView) -> f32 {
        if !living(a) { return 0.; }
        self.infections.get(&a.id).map_or(0., |i| i.strength(self.now))
    }
    pub fn tint(&self, a: &ActorView, mut color: Color) -> Color {
        let strength = self.strength(a);
        color.r *= 1. - strength + strength * DARK[0];
        color.g *= 1. - strength + strength * DARK[1];
        color.b *= 1. - strength + strength * DARK[2];
        color
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use macroquad::prelude::WHITE;
    use wf_combat::{Sim, SimConfig, Team, Skill, SpotlightView, SpotlightPhase};
    fn frame() -> Snapshot { crate::testing::sim().snapshot().clone() }
    fn close(a: f32, b: f32) { assert!((a-b).abs() < 0.00001, "{a} != {b}"); }
    #[test]
    fn poison_study_multiply_steady_tick_and_gaussian_preserve_alpha() {
        let mut s = frame();
        let mut tint = PoisonTint::default();
        tint.observe(&s);
        assert_eq!(tint.strength(&s.actors[0]), 0.);
        assert_eq!(tint.tint(&s.actors[0], WHITE), WHITE);
        s.actors[0].poisoned = 5.;
        tint.observe(&s);
        close(tint.strength(&s.actors[0]), 0.);
        s.combat_time = 2.5;
        tint.observe(&s);
        close(tint.strength(&s.actors[0]), BASE);
        let base = tint.tint(&s.actors[0], Color::new(1., 1., 1., 0.4));
        close(base.r, 0.604); close(base.g, 0.946); close(base.b, 0.631);
        assert_eq!(base.a, 0.4);
        s.combat_time = 3. - WIDTH;
        tint.observe(&s);
        close(tint.strength(&s.actors[0]), BASE + (TICK-BASE) * (-1_f32).exp());
        s.combat_time = 3.;
        tint.observe(&s);
        close(tint.strength(&s.actors[0]), TICK);
        let tick = tint.tint(&s.actors[0], WHITE);
        assert!(tick.r < base.r && tick.g < base.g && tick.b < base.b);
    }
    #[test]
    fn poison_study_cubic_exit_and_smoothstep_infection() {
        let mut s = frame();
        let mut tint = PoisonTint::default();
        s.actors[0].poisoned = 5.; tint.observe(&s);
        s.combat_time = 0.75; tint.observe(&s);
        let pulse = (TICK-BASE) * (-((0.75_f64-1.)/WIDTH).powi(2)).exp() as f32;
        close(tint.strength(&s.actors[0]), BASE*0.5 + pulse);
        s.combat_time = 5.; s.actors[0].poisoned = 0.; tint.observe(&s);
        close(tint.strength(&s.actors[0]), TICK);
        s.combat_time = 5.75; tint.observe(&s);
        close(tint.strength(&s.actors[0]), TICK*0.125);
        s.combat_time = 6.5; tint.observe(&s);
        close(tint.strength(&s.actors[0]), 0.);
        assert!(tint.infections.is_empty());
    }
    #[test]
    fn poison_both_teams_share_records_across_spotlight_and_combat_freezes() {
        let mut s = frame();
        s.actors[1].team = Team::Enemy;
        s.actors[0].poisoned = 5.; s.actors[1].poisoned = 5.;
        let mut tint = PoisonTint::default(); tint.observe(&s);
        s.combat_time = 2.5; tint.observe(&s);
        for a in &s.actors[..2] { close(tint.strength(a), BASE); }
        let view = SpotlightView {
            caster: s.actors[0].id, skill: Skill::CrimsonWard,
            phase: SpotlightPhase::Performing, started: s.time,
            participants: vec![s.actors[0].id, s.actors[1].id],
            hazards: vec![], co_casters: vec![], projectiles: vec![],
        };
        let (bg, spot) = super::super::spotlight::frames(&s, Some(&view));
        assert!(!bg.actors.iter().any(|a| a.id == s.actors[0].id));
        assert_eq!(spot.actors.len(), 2);
        for a in &spot.actors {
            assert_eq!(tint.tint(a, WHITE), tint.tint(&s.actors.iter().find(|b| b.id == a.id).unwrap(), WHITE));
            close(tint.strength(a), BASE);
        }
        let (returned, _) = super::super::spotlight::frames(&s, None);
        close(tint.strength(&returned.actors[0]), BASE);
        s.time += 10.; tint.observe(&s);
        close(tint.strength(&s.actors[0]), BASE);
        s.actors[0].poisoned = 5.; s.combat_time = 3.; tint.observe(&s);
        close(tint.strength(&s.actors[0]), TICK);
    }
    #[test]
    fn poison_downed_dead_and_removed_actors_drop_tint_immediately() {
        for state in [ActorState::Downed, ActorState::Dead] {
            let mut s = frame(); s.actors[0].poisoned = 5.;
            let mut tint = PoisonTint::default(); tint.observe(&s);
            s.combat_time = 2.; tint.observe(&s);
            assert!(tint.strength(&s.actors[0]) > 0.);
            s.actors[0].state = state;
            assert_eq!(tint.tint(&s.actors[0], WHITE), WHITE);
            tint.observe(&s); assert!(tint.infections.is_empty());
        }
        let mut s = frame(); s.actors[0].poisoned = 5.;
        let mut tint = PoisonTint::default(); tint.observe(&s);
        s.actors[0].hp = 0.; tint.observe(&s); assert!(tint.infections.is_empty());
        s.actors[0].hp = 1.; tint.observe(&s);
        s.actors.clear(); tint.observe(&s); assert!(tint.infections.is_empty());
    }
}
