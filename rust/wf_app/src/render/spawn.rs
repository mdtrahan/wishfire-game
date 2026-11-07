//! Painted floor vortices. The owning presentation clock freezes these with the battlefield.
use crate::{
    assets::{Assets, DrawStats},
    camera::WorldCamera,
};
use macroquad::prelude::*;
use std::collections::BTreeMap;
use wf_combat::api::{HazardKind, HazardPhase, HazardView, Vec2 as GroundPos};

pub const APPEAR: &str = "spawn-marker-appear";
pub const LOOP: &str = "spawn-marker";
const APPEAR_SECONDS: f64 = 0.2;
const FADE_SECONDS: f64 = 0.15;

struct Marker {
    pos: GroundPos,
    born: f64,
    ended: Option<f64>,
}
#[derive(Default)]
pub struct SpawnVortex {
    markers: BTreeMap<u32, Marker>,
}
#[derive(Debug, PartialEq)]
struct Sample {
    art: &'static str,
    frame: usize,
    alpha: f32,
}
fn sample(age: f64, fade_age: Option<f64>) -> Sample {
    let age = age.max(0.);
    let (art, frame) = if age < APPEAR_SECONDS {
        (APPEAR, (age * 20.).floor() as usize)
    } else {
        (
            LOOP,
            (((age - APPEAR_SECONDS) * 10. + 1e-9).floor() as usize) % 6,
        )
    };
    Sample {
        art,
        frame,
        alpha: fade_age.map_or(1., |t| (1. - t / FADE_SECONDS).clamp(0., 1.) as f32),
    }
}
impl SpawnVortex {
    pub fn ingest(&mut self, time: f64, hazards: &[HazardView]) {
        let live =
            |h: &&HazardView| h.kind == HazardKind::SpawnMarker && h.phase != HazardPhase::Resolved;
        for (&id, marker) in &mut self.markers {
            if marker.ended.is_none() && !hazards.iter().filter(live).any(|h| h.id == id) {
                marker.ended = Some(time);
            }
        }
        for h in hazards.iter().filter(live) {
            self.markers
                .entry(h.id)
                .or_insert(Marker {
                    pos: h.origin,
                    born: time,
                    ended: None,
                })
                .pos = h.origin;
        }
        self.markers
            .retain(|_, m| m.ended.is_none_or(|t| time - t < FADE_SECONDS));
    }
    pub fn busy(&self, time: f64) -> bool {
        self.markers
            .values()
            .any(|m| m.ended.is_some_and(|t| time - t < FADE_SECONDS))
    }
    pub fn records(&self) -> usize {
        self.markers.len()
    }
    pub fn draw(&self, assets: &Assets, camera: &WorldCamera, time: f64, stats: &mut DrawStats) {
        for m in self.markers.values() {
            let sample = sample(time - m.born, m.ended.map(|t| time - t));
            if sample.alpha <= 0. {
                continue;
            }
            let Some(art) = assets.vfx.get(sample.art) else {
                stats.missing(format!("vfx:{}", sample.art));
                continue;
            };
            // Authored quad includes padding and the floor projection. Never apply SQUASH again.
            let size = vec2(art.entry.screen_size_px[0], art.entry.screen_size_px[1])
                * (camera.zoom / 0.5);
            let pos = camera.project(m.pos);
            assets.vfx_frame(
                sample.art,
                sample.frame,
                pos,
                size,
                0.,
                Color::new(1., 1., 1., sample.alpha),
                stats,
            );
        }
    }
    #[cfg(target_arch = "wasm32")]
    pub fn record(&self, camera: &WorldCamera, time: f64) {
        PROBE.with(|p| {
            *p.borrow_mut() = self
                .markers
                .values()
                .filter_map(|m| {
                    let s = sample(time - m.born, m.ended.map(|t| time - t));
                    let pos = camera.project(m.pos);
                    let z = camera.zoom / 0.5;
                    (s.alpha > 0.).then_some([
                        pos.x,
                        pos.y,
                        (time - m.born) as f32,
                        s.frame as f32,
                        s.alpha,
                        if s.art == APPEAR { 0. } else { 1. },
                        72. * z,
                        52. * z,
                    ])
                })
                .collect()
        });
    }
}
#[cfg(target_arch = "wasm32")]
thread_local! { static PROBE: std::cell::RefCell<Vec<[f32;8]>> = const {std::cell::RefCell::new(Vec::new())}; }
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_spawn_count() -> u32 {
    PROBE.with(|p| p.borrow().len() as u32)
}
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_spawn_probe(slot: u32, index: u32) -> f32 {
    PROBE.with(|p| {
        p.borrow()
            .get(slot as usize)
            .and_then(|r| r.get(index as usize))
            .copied()
            .unwrap_or(f32::NAN)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use wf_combat::api::{FillMode, Shape, Team};
    fn hazard(id: u32) -> HazardView {
        HazardView {
            id,
            kind: HazardKind::SpawnMarker,
            team: Team::Enemy,
            hostile: false,
            shape: Shape::Circle { radius: 24. },
            origin: GroundPos::new(100., 100.),
            dir: GroundPos::new(1., 0.),
            fill: FillMode::Countdown,
            phase: HazardPhase::Locked,
            progress: 0.,
            width_scale: 1.,
            owner: 0,
            tier: 0,
        }
    }
    #[test]
    fn four_appear_cels_then_six_loop_cels_without_duplicate_endpoint() {
        for i in 0..4 {
            let s = sample(i as f64 * 0.05 + 0.001, None);
            assert_eq!((s.art, s.frame), (APPEAR, i));
        }
        for i in 0..12 {
            let s = sample(0.2 + i as f64 * 0.1 + 0.001, None);
            assert_eq!((s.art, s.frame), (LOOP, i % 6));
        }
    }
    #[test]
    fn actual_removal_starts_quick_floor_fade_and_persistent_marker_is_not_busy() {
        let mut fx = SpawnVortex::default();
        let h = hazard(7);
        fx.ingest(10., &[h.clone()]);
        fx.ingest(15., &[h.clone()]);
        assert_eq!(fx.records(), 1);
        assert!(!fx.busy(15.));
        fx.ingest(15.1, &[]);
        assert!(fx.busy(15.1));
        let m = &fx.markers[&7];
        assert!((sample(5.175, Some(0.075)).alpha - 0.5).abs() < 0.001);
        assert_eq!(m.ended, Some(15.1));
        fx.ingest(15.3, &[]);
        assert_eq!(fx.records(), 0);
    }
    #[test]
    fn frozen_combat_clock_holds_cel_and_fade_and_reset_clears_every_marker() {
        let mut fx = SpawnVortex::default();
        let h = hazard(9);
        fx.ingest(20., &[h.clone()]);
        fx.ingest(20.35, &[h.clone()]);
        let before = sample(20.35 - fx.markers[&9].born, None);
        for _ in 0..50 {
            fx.ingest(20.35, &[h.clone()]);
        }
        assert_eq!(sample(20.35 - fx.markers[&9].born, None), before);
        fx.ingest(20.4, &[]);
        for _ in 0..50 {
            fx.ingest(20.4, &[]);
        }
        assert!(fx.busy(20.4));
        fx = SpawnVortex::default();
        assert_eq!(fx.records(), 0);
    }
    #[test]
    fn full_formation_keeps_every_marker_and_resolved_hazard_fades_without_a_spawn_event() {
        let mut fx = SpawnVortex::default();
        let mut hazards: Vec<_> = (1..=9).map(hazard).collect();
        fx.ingest(0., &hazards);
        fx.ingest(1.2, &hazards);
        assert_eq!(fx.records(), 9);
        hazards[0].phase = HazardPhase::Resolved;
        fx.ingest(1.3, &hazards);
        assert_eq!(fx.markers[&1].ended, Some(1.3));
        assert!(fx.busy(1.3));
        fx.ingest(1.5, &hazards);
        assert_eq!(fx.records(), 8);
        assert!(!fx.busy(1.5));
    }
}
