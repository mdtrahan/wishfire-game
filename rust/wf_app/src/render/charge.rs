//! Frozen-sprite echoes and white inward streaks sell the sim-owned charge beat.
use super::actors::{self, EchoParams};
use crate::{
    assets::{Assets, DrawStats},
    camera::WorldCamera,
    clips,
};
use macroquad::prelude::*;
use wf_combat::api::{ActorState, ActorView, Archetype, Snapshot, SpotlightPhase, SpotlightView};
const ECHO_TAIL: f64 = 0.15;
#[derive(Clone, Copy)]
struct PulsePlan {
    count: usize,
    interval: f64,
    life: f64,
    scale: f32,
    stretch: f32,
    alpha: f32,
}
fn pulse_plan(duration: f64, reduced: bool) -> PulsePlan {
    let interval = if reduced {
        duration.max(0.001) / 2.
    } else {
        0.15
    };
    PulsePlan {
        count: ((duration.max(0.) / interval - 0.000001).ceil().max(0.)) as usize,
        interval,
        life: 0.55,
        scale: if reduced { 1.3 } else { 2.4 },
        stretch: if reduced { 1. } else { 1.2 },
        alpha: if reduced { 0.3 } else { 0.9 },
    }
}
fn random(mut seed: u64) -> f32 {
    seed ^= seed >> 30;
    seed = seed.wrapping_mul(0xbf58476d1ce4e5b9);
    seed ^= seed >> 27;
    seed = seed.wrapping_mul(0x94d049bb133111eb);
    seed ^= seed >> 31;
    (seed >> 40) as f32 / 16777215.
}
#[derive(Clone, Copy, Debug)]
struct RadialLine {
    direction: Vec2,
    radius: f32,
    length: f32,
    alpha: f32,
}
fn radial_sample(seed: u64, t: f32) -> RadialLine {
    let angle = random(seed) * std::f32::consts::TAU;
    let start = 3.5 + 1.5 * random(seed.wrapping_add(1));
    let eased = 1. - (1. - t).powi(2);
    RadialLine {
        direction: vec2(angle.cos(), angle.sin()),
        radius: start + (0.3 - start) * eased,
        length: 1.2 + 0.8 * random(seed.wrapping_add(2)),
        alpha: (std::f32::consts::PI * t).sin().max(0.) * 0.95,
    }
}
fn radial_line(seed: u64, index: usize, age: f64) -> Option<RadialLine> {
    let local = age - index as f64 * 0.04;
    if local < 0. {
        return None;
    }
    let cycle = (local / 0.48).floor() as u64;
    let seed = seed
        .wrapping_add((index as u64 + 1).wrapping_mul(0x9e3779b97f4a7c15))
        .wrapping_add(cycle.wrapping_mul(0x517cc1b727220a95));
    let life = 0.12 + 0.06 * random(seed.wrapping_add(3)) as f64;
    let t = (local % 0.48) / life;
    if !(0. ..1.).contains(&t) {
        return None;
    }
    Some(radial_sample(seed, t as f32))
}
fn supporting(
    assets: &Assets,
    id: &str,
    age: f64,
    anchor: Vec2,
    h: f32,
    tint: Color,
    stats: &mut DrawStats,
) {
    if let Some(art) = assets.vfx.get(id) {
        let size = vec2(art.entry.screen_size_px[0], art.entry.screen_size_px[1]) * h / 32.;
        let anchor = if id == "charge-ground" {
            anchor + vec2(0., size.y * 0.5)
        } else {
            anchor
        };
        if id == "charge-gather" {
            let frame = (age * 1000. / art.entry.frame_ms[0].max(1.) as f64) as usize
                % art.entry.frame_count;
            assets.vfx_frame(id, frame, anchor, size, 0., tint, stats);
        } else {
            assets.vfx_once(id, age, anchor, size, 0., tint, stats);
        }
    }
}
#[derive(Default)]
pub struct Charge {
    actor: Option<ActorView>,
    started: f64,
    ended: Option<f64>,
    duration: f64,
}
pub fn hero_colour(kind: Archetype) -> Color {
    match kind {
        Archetype::Fara => Color::new(0.9, 0.15, 0.2, 1.),
        Archetype::Hondo => Color::new(0.85, 0.2, 0.55, 1.),
        Archetype::Runa => Color::new(0.55, 0.85, 1., 1.),
        _ => Color::new(0.62, 0.38, 1., 1.),
    }
}
impl Charge {
    pub fn observe(&mut self, s: &Snapshot, view: Option<&SpotlightView>, duration: f32) {
        self.duration = duration.max(0.) as f64;
        let Some(v) = view else {
            self.actor = None;
            return;
        };
        if v.phase == SpotlightPhase::Charge {
            if self.actor.is_none() {
                self.actor = s.actors.iter().find(|a| a.id == v.caster).cloned();
                self.started = v.started;
                self.ended = None;
                if let Some(a) = &mut self.actor {
                    a.state = ActorState::Cast;
                    a.state_age = 0.;
                }
            }
        } else if self.actor.is_some() && self.ended.is_none() {
            self.ended = Some(s.time);
        }
    }
    pub fn busy(&self, time: f64) -> bool {
        self.actor.is_some() && self.ended.is_none_or(|end| time - end < ECHO_TAIL)
    }
    fn shown(&self, s: &Snapshot) -> Option<ActorView> {
        let mut a = self.actor.clone()?;
        if let Some(shown) = s.actors.iter().find(|x| x.id == a.id) {
            a.pos = shown.pos;
            a.facing = shown.facing;
        }
        Some(a)
    }
    pub fn pose(&self, s: &mut Snapshot) {
        if self.ended.is_none() {
            if let Some(frozen) = &self.actor {
                if let Some(a) = s.actors.iter_mut().find(|a| a.id == frozen.id) {
                    a.state = ActorState::Cast;
                    a.state_age = 0.;
                }
            }
        }
    }
    pub fn ground(
        &self,
        assets: &Assets,
        camera: &WorldCamera,
        s: &Snapshot,
        stats: &mut DrawStats,
    ) {
        if !self.busy(s.time) {
            return;
        }
        let Some(a) = self.shown(s) else {
            return;
        };
        let h = actors::body_height(assets, &a, camera.zoom);
        let p = camera.project(a.pos);
        let colour = hero_colour(a.archetype);
        let age = (s.time - self.started).max(0.);
        let art_duration = assets
            .vfx
            .get("charge-ground")
            .map_or(self.duration, |art| {
                art.entry.frame_ms.iter().sum::<f32>() as f64 / 1000.
            });
        let art_age = age / self.duration.max(0.001) * art_duration;
        supporting(
            assets,
            "charge-ground",
            art_age,
            p,
            h,
            Color::new(colour.r, colour.g, colour.b, 0.5),
            stats,
        );
    }
    pub fn draw_under(
        &self,
        assets: &Assets,
        camera: &WorldCamera,
        s: &Snapshot,
        reduced: bool,
        stats: &mut DrawStats,
    ) {
        if !self.busy(s.time) {
            return;
        }
        let Some(a) = self.shown(s) else {
            return;
        };
        let Some(art) = assets.manifest.actors.get(&format!("{:?}", a.archetype)) else {
            return;
        };
        let Some(clip) = art.clips.get(clips::name(a.state)) else {
            return;
        };
        let Some(frame) = clips::actor(clip, &a) else {
            return;
        };
        let age = (s.time - self.started).max(0.);
        let tail = self.ended.map_or(1., |end| {
            (1. - (s.time - end) / ECHO_TAIL).clamp(0., 1.) as f32
        });
        let colour = hero_colour(a.archetype);
        let warm = Color::new(
            colour.r + (1. - colour.r) * 0.5,
            colour.g + (0.92 - colour.g) * 0.5,
            colour.b + (0.75 - colour.b) * 0.5,
            1.,
        );
        let plan = pulse_plan(self.duration, reduced);
        for i in 0..plan.count {
            let t = (age - i as f64 * plan.interval) / plan.life;
            if (0. ..1.).contains(&t) {
                actors::sprite_echo(
                    assets,
                    camera,
                    &a,
                    clip,
                    frame,
                    EchoParams {
                        scale_from: 1.,
                        tint: warm,
                        scale_to: plan.scale,
                        stretch: plan.stretch,
                        alpha: plan.alpha * tail,
                    },
                    t as f32,
                    stats,
                );
            }
        }
        let breath = (0.475 + 0.125 * (age as f32 * 9.).sin()) * 1.25;
        actors::sprite_echo(
            assets,
            camera,
            &a,
            clip,
            frame,
            EchoParams {
                scale_from: if reduced { 1.05 } else { 1.12 },
                tint: colour,
                scale_to: 1.12,
                stretch: 1.,
                alpha: if reduced { 0.22 * tail } else { breath * tail },
            },
            0.,
            stats,
        );
        let p = camera.project(a.pos);
        let h = actors::body_height(assets, &a, camera.zoom);
        let chest = p - vec2(0., h * 19. / 32.);
        if !reduced {
            if self.ended.is_none() {
                let pale = Color::new(
                    1. + (colour.r - 1.) * 0.4,
                    1. + (colour.g - 1.) * 0.4,
                    1. + (colour.b - 1.) * 0.4,
                    1.,
                );
                supporting(assets, "charge-gather", age, chest, h * 2., pale, stats);
            }
            // Start just before the handoff so the 250 ms echo ends within Performing +150 ms.
            let flare = (age - (self.duration - 0.1).max(0.)) / 0.25;
            if (0. ..1.).contains(&flare) {
                supporting(assets, "charge-flare", flare * 0.2, p, h, colour, stats);
                actors::sprite_echo(
                    assets,
                    camera,
                    &a,
                    clip,
                    frame,
                    EchoParams {
                        scale_from: 1.,
                        tint: warm,
                        scale_to: 3.2,
                        stretch: 1.2,
                        alpha: tail,
                    },
                    flare as f32,
                    stats,
                );
            }
            // These strips always accompany the gather art, above the echoes and below the caster.
            if self.ended.is_none() {
                let seed = a.id as u64 ^ self.started.to_bits();
                for i in 0..12 {
                    if let Some(line) = radial_line(seed, i, age) {
                        let head = chest + line.direction * line.radius * h;
                        assets.vfx_strip(
                            "bolt-trail-neutral",
                            0,
                            head + line.direction * line.length * h,
                            head,
                            1.8 * camera.zoom / 0.5,
                            Color::new(1., 1., 1., line.alpha),
                            stats,
                        );
                    }
                }
            }
        }
    }
    pub fn draw_flash(
        &self,
        assets: &Assets,
        camera: &WorldCamera,
        s: &Snapshot,
        reduced: bool,
        stats: &mut DrawStats,
    ) {
        if reduced || !self.busy(s.time) {
            return;
        }
        let Some(end) = self.ended else {
            return;
        };
        let t = (s.time - end) / 0.1;
        if !(0. ..1.).contains(&t) {
            return;
        }
        let Some(a) = self
            .actor
            .as_ref()
            .and_then(|x| s.actors.iter().find(|a| a.id == x.id))
        else {
            return;
        };
        let Some(art) = assets.manifest.actors.get(&format!("{:?}", a.archetype)) else {
            return;
        };
        let Some(c) = art.clips.get(clips::name(a.state)) else {
            return;
        };
        let Some(f) = clips::actor(c, a) else {
            return;
        };
        actors::sprite_echo(
            assets,
            camera,
            a,
            c,
            f,
            EchoParams {
                scale_from: 1.,
                tint: Color::new(1., 0.95, 0.85, 1.),
                scale_to: 1.,
                stretch: 1.,
                alpha: 1.,
            },
            t as f32,
            stats,
        );
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pulse_plan_fills_live_duration_and_reduced_motion_stays_small() {
        for (duration, count) in [(0., 0), (0.6, 4), (1.2, 8), (1.8, 12), (2.4, 16)] {
            assert_eq!(pulse_plan(duration, false).count, count);
        }
        let full = pulse_plan(1.2, false);
        let reduced = pulse_plan(1.2, true);
        assert_eq!(reduced.count, 2);
        assert_eq!(full.life, 0.55);
        assert_eq!(full.scale, 2.4);
        assert_eq!(full.stretch, 1.2);
        assert_eq!(full.alpha, 0.9);
        assert!(reduced.scale < full.scale && reduced.alpha < full.alpha);
    }
    #[test]
    fn radial_lines_spawn_far_out_and_converge_on_chest() {
        for seed in 1..50 {
            let start = radial_sample(seed, 0.);
            let end = radial_sample(seed, 1.);
            assert!((3.5..=5.).contains(&start.radius));
            assert!((end.radius - 0.3).abs() < 0.0001);
            assert!((1.2..=2.).contains(&start.length));
            assert!((start.direction.length() - 1.).abs() < 0.0001);
            assert_eq!(start.direction, end.direction);
        }
        for age in [0.3, 0.6, 0.9, 1.1] {
            let count = (0..12)
                .filter(|i| radial_line(45, *i, age).is_some())
                .count();
            assert!((3..=5).contains(&count), "{age}: {count}");
        }
    }
    #[test]
    fn live_config_sets_charge_and_frozen_pose_ends_with_short_tail() {
        let mut s = crate::testing::sim()
            .snapshot()
            .clone();
        let mut fx = Charge::default();
        let mut v = SpotlightView {
            caster: s.actors[0].id,
            skill: wf_combat::Skill::GroundPound,
            phase: SpotlightPhase::Charge,
            started: s.time,
            participants: vec![s.actors[0].id],
            hazards: vec![], co_casters: vec![], projectiles: vec![],
        };
        fx.observe(&s, Some(&v), 2.4);
        assert!((fx.duration - 2.4).abs() < 0.00001);
        assert_eq!(pulse_plan(fx.duration, false).count, 16);
        let mut frame = s.clone();
        frame.actors[0].state_age = 0.4;
        fx.pose(&mut frame);
        assert_eq!(frame.actors[0].state_age, 0.);
        s.time += 2.4;
        v.phase = SpotlightPhase::Performing;
        fx.observe(&s, Some(&v), 2.4);
        assert!(fx.busy(s.time + 0.14));
        assert!(!fx.busy(s.time + 0.16));
        fx.observe(&s, None, 2.4);
        assert!(!fx.busy(s.time));
    }
}
