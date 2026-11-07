//! Authoritative push outcomes: brace, stagger and cancelled telegraph decay.
use crate::{
    assets::{Assets, DrawStats},
    camera::WorldCamera,
};
use macroquad::prelude::*;
use wf_combat::api::{Event, HazardView, Snapshot, Vec2 as WorldPos};
const CUE_SECONDS: f64 = 0.18;
pub const CANCEL_SECONDS: f64 = 0.12;
struct Cue {
    id: u32,
    pos: WorldPos,
    born: f64,
    resisted: bool,
    interrupted: bool,
}
struct Cancel {
    hazard: HazardView,
    born: f64,
}
#[derive(Default)]
pub struct BossPush {
    cues: Vec<Cue>,
    cancelled: Vec<Cancel>,
}
impl BossPush {
    pub(super) fn take_combo(&mut self,from:&mut Self,hits:&[(u32,f64)],delta:f64) {
        super::spotlight::transfer(&mut from.cues,&mut self.cues,
            |x|hits.iter().any(|(id,born)|*id==x.id && (*born-x.born).abs()<0.0001),|x|x.born+=delta);
        super::spotlight::transfer(&mut from.cancelled,&mut self.cancelled,
            |x|hits.iter().any(|(id,born)|*id==x.hazard.owner && (*born-x.born).abs()<0.0001),|x|x.born+=delta);
    }
    pub(super) fn pause_combo(&mut self,delta:f64) {for x in &mut self.cues {x.born+=delta;}}

    pub fn ingest(
        &mut self,
        events: &[Event],
        s: &Snapshot,
        previous: &Snapshot,
        hazard: impl Fn(u32) -> Option<HazardView>,
    ) {
        if events.iter().any(|e| {
            matches!(
                e,
                Event::SceneReset | Event::WaveReset | Event::StageCleared
            )
        }) {
            *self = Self::default();
            return;
        }
        self.cues.retain(|x| s.time - x.born < CUE_SECONDS);
        self.cancelled.retain(|x| s.time - x.born < CANCEL_SECONDS);
        for e in events {
            match *e {
                Event::KnockbackResisted { id } | Event::BossStaggered { id, .. } => {
                    if let Some(a) =
                        s.actors.iter().chain(&previous.actors).find(|a| {
                            a.id == id && a.hp > 0. && super::actors::is_boss(a.archetype)
                        })
                    {
                        self.cues.push(Cue {
                            id,
                            pos: a.pos,
                            born: s.time,
                            resisted: matches!(e, Event::KnockbackResisted { .. }),
                            interrupted: matches!(
                                e,
                                Event::BossStaggered {
                                    interrupted: true,
                                    ..
                                }
                            ),
                        });
                    }
                }
                Event::HazardCancelled { id, .. } => {
                    if !self.cancelled.iter().any(|x| x.hazard.id == id) {
                        if let Some(h) = hazard(id) {
                            self.cancelled.push(Cancel {
                                hazard: h,
                                born: s.time,
                            });
                        }
                    }
                }
                _ => {}
            }
        }
    }
    pub fn busy(&self, time: f64) -> bool {
        self.cues.iter().any(|x| time - x.born < CUE_SECONDS)
            || self
                .cancelled
                .iter()
                .any(|x| time - x.born < CANCEL_SECONDS)
    }
    pub fn pose(&self, s: &mut Snapshot, reduced: bool) {
        if reduced {
            return;
        }
        for cue in self.cues.iter().filter(|x| !x.resisted) {
            let t = ((s.time - cue.born) / 0.10) as f32;
            if !(0. ..1.).contains(&t) {
                continue;
            }
            if let Some(a) = s.actors.iter_mut().find(|a| a.id == cue.id && a.hp > 0.) {
                a.pos.x += (t * std::f32::consts::TAU * 2.).sin() * (1. - t) * 3.;
            }
        }
    }
    pub fn cancellations(&self, time: f64) -> Vec<(&HazardView, f32)> {
        self.cancelled
            .iter()
            .filter_map(|x| {
                let t = ((time - x.born) / CANCEL_SECONDS) as f32;
                (0. ..1.).contains(&t).then_some((&x.hazard, t))
            })
            .collect()
    }
    pub fn impacts(
        &self,
        assets: &Assets,
        camera: &WorldCamera,
        s: &Snapshot,
        stats: &mut DrawStats,
    ) {
        let z = camera.zoom / 0.5;
        for x in &self.cues {
            let age = s.time - x.born;
            if !(0. ..CUE_SECONDS).contains(&age) {
                continue;
            }
            let a = s.actors.iter().find(|a| a.id == x.id);
            let p = camera.project(a.map_or(x.pos, |a| a.pos));
            if x.resisted {
                // Retimed authored dust; no position offset or shake for a resisted push.
                assets.vfx_once(
                    "blast-smoke",
                    age * 0.48 / CUE_SECONDS,
                    p,
                    vec2(42., 22.) * z,
                    0.,
                    Color::new(1., 1., 1., 0.65 * (1. - age as f32 / CUE_SECONDS as f32)),
                    stats,
                );
            } else {
                let chest = a.map_or(65., super::wishfire::chest);
                assets.vfx_once(
                    "hit-physical",
                    age,
                    p - vec2(0., chest * camera.zoom),
                    Vec2::splat(if x.interrupted { 48. } else { 36. }) * z,
                    0.,
                    WHITE,
                    stats,
                );
            }
        }
    }
    #[cfg(target_arch = "wasm32")]
    pub fn record(&self, time: f64) {
        let cue = self
            .cues
            .iter()
            .rev()
            .find(|x| (0. ..CUE_SECONDS).contains(&(time - x.born)));
        let cancel = self
            .cancelled
            .iter()
            .rev()
            .find(|x| (0. ..CANCEL_SECONDS).contains(&(time - x.born)));
        PROBE.with(|p| {
            p.set([
                cue.map_or(0., |x| if x.resisted { 1. } else { 2. }),
                cue.map_or(-1., |x| (time - x.born) as f32),
                cue.map_or(0., |x| x.id as f32),
                cue.is_some_and(|x| x.interrupted) as u8 as f32,
                cancel.map_or(-1., |x| (time - x.born) as f32),
            ])
        });
    }
}
#[cfg(target_arch = "wasm32")]
std::thread_local! {static PROBE:std::cell::Cell<[f32;5]>=const{std::cell::Cell::new([0.;5])};}
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_boss_push_probe(index: u32) -> f32 {
    PROBE.with(|p| p.get().get(index as usize).copied().unwrap_or(f32::NAN))
}
