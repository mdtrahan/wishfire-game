//! Runa's passive uses the soap family. The sim owns slow, capture and release.
use super::{
    actors,
};
const DROPLETS:&str="bubble-droplets";
const POP:&str="bubble-pop";
const SUDS:&str="bubble-suds";
const SWELL:&str="bubble-swell";
use crate::{
    assets::{Assets, DrawStats},
    camera::WorldCamera,
};
use macroquad::prelude::*;
use std::collections::BTreeMap;
use wf_combat::api::{ActorView, Event, Snapshot, Team};
const SWELL_SECONDS: f64 = 0.18;
const POP_SECONDS: f64 = 0.32;
#[derive(Clone)]
struct Encase {
    pose: ActorView,
    born: f64,
}
struct Release {
    actor: ActorView,
    born: f64,
}
#[derive(Default)]
pub struct BubbleAura {
    encases: BTreeMap<u32, Encase>,
    releases: Vec<Release>,
}

pub fn visible(a: &ActorView) -> bool {
    a.team == Team::Enemy && a.hp > 0. && a.encased > 0.
}
pub fn actor_tint(a: &ActorView, opacity: f32) -> Color {
    if a.team == Team::Enemy && a.hp > 0. && a.slowed > 0. {
        Color::new(0.87, 0.98, 1., opacity)
    } else {
        Color::new(1., 1., 1., opacity)
    }
}
fn swell_frame(age: f64, reduced: bool) -> usize {
    if reduced {
        5
    } else {
        ((age.max(0.) / SWELL_SECONDS * 6.) as usize).min(5)
    }
}
/// The film is 180 px across in its 192 px cell; its pivot is at the film's bottom.
fn bubble_geometry(foot: Vec2, height: f32, time: f64, reduced: bool) -> (Vec2, Vec2) {
    let wobble = if reduced {
        0.
    } else {
        (time as f32 * 5.).sin() * 0.02
    };
    (
        foot + vec2(0., height * 0.15),
        Vec2::splat(height * 1.3 * 192. / 180.) * vec2(1. + wobble, 1. - wobble),
    )
}
impl BubbleAura {
    pub fn ingest(&mut self, events: &[Event], s: &Snapshot, previous: &Snapshot) {
        if events.iter().any(|e| {
            matches!(
                e,
                Event::SceneReset | Event::WaveReset | Event::StageCleared
            )
        }) {
            *self = Self::default();
            return;
        }
        self.releases.retain(|p| s.time - p.born < POP_SECONDS);
        for a in s.actors.iter().filter(|a| visible(a)) {
            self.encases.entry(a.id).or_insert_with(|| {
                let fresh = events
                    .iter()
                    .any(|e| matches!(e,Event::Encased{id,seconds} if *id==a.id && *seconds>0.))
                    || previous
                        .actors
                        .iter()
                        .find(|old| old.id == a.id)
                        .is_some_and(|old| old.encased <= 0.);
                Encase {
                    // The sim cancels attacks to Idle when capture lands. Keep the frame
                    // that was on screen before that mechanical state change.
                    pose: previous
                        .actors
                        .iter()
                        .find(|old| old.id == a.id && old.encased <= 0. && old.hp > 0.)
                        .unwrap_or(a)
                        .clone(),
                    born: if fresh {
                        s.time
                    } else {
                        s.time - SWELL_SECONDS
                    },
                }
            });
        }
        // Only an observed transition releases film. A missing actor can belong to the other
        // presentation layer; retaining its frozen pose avoids false pops at spotlight entry.
        for a in &s.actors {
            if !visible(a) {
                let old = previous.actors.iter().find(|old| old.id == a.id);
                if old.is_some_and(|old| visible(old)) {
                    self.releases.push(Release {
                        actor: a.clone(),
                        born: s.time,
                    });
                }
                self.encases.remove(&a.id);
            }
        }
        for e in events {
            if let Event::Died { id } = e {
                if !s.actors.iter().any(|a| a.id == *id) {
                    if let Some(held) = self.encases.remove(id) {
                        self.releases.push(Release {
                            actor: held.pose,
                            born: s.time,
                        });
                    }
                }
            }
        }
    }
    pub fn inherit(&mut self, other: &Self, source_time: f64, target: &Snapshot) {
        for a in target.actors.iter().filter(|a| visible(a)) {
            if let Some(held) = other.encases.get(&a.id) {
                self.encases.entry(a.id).or_insert_with(|| Encase {
                    pose: held.pose.clone(),
                    born: target.time - (source_time - held.born).max(0.),
                });
            }
        }
    }
    pub fn busy(&self, time: f64) -> bool {
        self.releases.iter().any(|p| time - p.born < POP_SECONDS)
    }
    pub fn pose(&self, frame: &mut Snapshot) {
        for a in frame.actors.iter_mut().filter(|a| visible(a)) {
            if let Some(held) = self.encases.get(&a.id) {
                a.state = held.pose.state;
                a.state_age = held.pose.state_age;
                a.state_duration = held.pose.state_duration;
                a.impact_at = held.pose.impact_at;
                a.facing = held.pose.facing;
            }
        }
    }
    pub fn impacts(
        &self,
        assets: &Assets,
        camera: &WorldCamera,
        s: &Snapshot,
        reduced: bool,
        stats: &mut DrawStats,
    ) {
        let z = camera.zoom / 0.5;
        for a in s
            .actors
            .iter()
            .filter(|a| a.hp > 0. && a.team == Team::Enemy)
        {
            let foot = camera.actor_foot(a);
            let height = actors::body_height(assets, a, camera.zoom);
            if a.slowed>0. {
                for k in 0..3 {
                    let t = if reduced {
                        0.3 + k as f32 * 0.2
                    } else {
                        (s.time as f32 * 0.65 + a.id as f32 * 0.17 + k as f32 * 0.32).fract()
                    };
                    let q =
                        foot + vec2((k as f32 - 1.) * height * 0.20, -height * (0.82 - 0.48 * t));
                    assets.vfx_frame(
                        DROPLETS,
                        k,
                        q,
                        Vec2::splat((4. + k as f32 * 0.5) * z),
                        0.,
                        Color::new(0.90, 1., 1., 0.65 * (1. - t * 0.45)),
                        stats,
                    );
                }
            }
            if visible(a) {
                let age = self
                    .encases
                    .get(&a.id)
                    .map_or(SWELL_SECONDS, |h| s.time - h.born);
                let (anchor, size) = bubble_geometry(foot, height, s.time + a.id as f64, reduced);
                assets.vfx_frame(
                    SWELL,
                    swell_frame(age, reduced),
                    anchor,
                    size,
                    0.,
                    Color::new(1., 1., 1., 0.86),
                    stats,
                );
            }
        }
        for pop in &self.releases {
            let age = s.time - pop.born;
            if !(0. ..POP_SECONDS).contains(&age) {
                continue;
            }
            let a = s
                .actors
                .iter()
                .find(|a| a.id == pop.actor.id)
                .unwrap_or(&pop.actor);
            let foot = camera.actor_foot(a);
            let height = actors::body_height(assets, a, camera.zoom);
            let (anchor, size) = bubble_geometry(foot, height, 0., true);
            assets.vfx_once(
                POP,
                age,
                anchor,
                size * (256. / 192.),
                0.,
                Color::new(1., 1., 1., 0.8),
                stats,
            );
            assets.vfx_once(
                SUDS,
                age,
                foot - vec2(0., height * 0.5),
                Vec2::splat(height * 0.65),
                0.,
                WHITE,
                stats,
            );
        }
    }
    #[cfg(target_arch = "wasm32")]
    pub fn record(&self, assets: &Assets, camera: &WorldCamera, s: &Snapshot) {
        let in_view = |a: &&ActorView| {
            let p = camera.actor_foot(a);
            p.x > 35. && p.x < 325. && p.y > 100. && p.y < 520.
        };
        let encased = s.actors.iter().filter(|a| visible(a)).find(in_view);
        let slow = s
            .actors
            .iter()
            .filter(|a| a.team == Team::Enemy && a.hp > 0. && a.slowed > 0. && a.encased <= 0.)
            .find(in_view);
        let point = |a: Option<&ActorView>| a.map_or(Vec2::ZERO, |a| camera.actor_foot(a));
        let e = point(encased);
        let d = point(slow);
        PROBE.with(|p| {
            p.set([
                s.time as f32,
                slow.map_or(0., |a| a.id as f32),
                slow.map_or(0., |a| a.slowed),
                d.x,
                d.y,
                encased.map_or(0., |a| a.id as f32),
                encased.map_or(0., |a| a.encased),
                e.x,
                e.y,
                encased.map_or(0., |a| actors::body_height(assets, a, camera.zoom)),
                encased.map_or(0., |a| a.state_age),
                self.releases
                    .iter()
                    .filter(|r| (0. ..POP_SECONDS).contains(&(s.time - r.born)))
                    .count() as f32,
            ])
        });
    }
}
#[cfg(target_arch = "wasm32")]
std::thread_local! {static PROBE:std::cell::Cell<[f32;12]>=const{std::cell::Cell::new([0.;12])};}
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_bubble_aura_probe(index: u32) -> f32 {
    PROBE.with(|p| p.get().get(index as usize).copied().unwrap_or(f32::NAN))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn scene() -> Snapshot {
        let mut s = crate::testing::sim()
            .snapshot()
            .clone();
        let mut a = s.actors[0].clone();
        a.id = 999;
        a.team = Team::Enemy;
        a.encased = 0.;
        a.slowed = 0.;
        s.actors.push(a);
        s
    }
    #[test]
    fn only_living_slowed_enemies_receive_the_existing_aqua_tint() {
        let mut a=crate::testing::sim().snapshot().actors[0].clone();
        a.slowed=0.3;assert_eq!(actor_tint(&a,1.),WHITE);
        a.team=Team::Enemy;assert_ne!(actor_tint(&a,1.),WHITE);
        a.hp=0.;assert_eq!(actor_tint(&a,1.),WHITE);
    }
    #[test]
    fn capture_is_state_driven_freezes_pose_and_only_release_is_busy() {
        let mut old = scene();
        old.actors.last_mut().unwrap().state = wf_combat::ActorState::Walk;
        old.actors.last_mut().unwrap().state_age = 0.31;
        let mut s = old.clone();
        let a = s.actors.last_mut().unwrap();
        a.encased = 1.5;
        a.state = wf_combat::ActorState::Idle;
        a.state_age = 0.;
        let mut fx = BubbleAura::default();
        fx.ingest(
            &[Event::Encased {
                id: 999,
                seconds: 1.5,
            }],
            &s,
            &old,
        );
        assert!(visible(s.actors.last().unwrap()));
        assert_eq!(swell_frame(0., false), 0);
        assert_eq!(swell_frame(0.2, false), 5);
        assert!(!fx.busy(s.time));
        old = s.clone();
        s.time += 0.5;
        s.actors.last_mut().unwrap().state_age = 0.81;
        fx.ingest(&[], &s, &old);
        let mut display = s.clone();
        fx.pose(&mut display);
        assert_eq!(display.actors.last().unwrap().state_age, 0.31);
        assert_eq!(
            display.actors.last().unwrap().state,
            wf_combat::ActorState::Walk
        );
        let mut foreground = BubbleAura::default();
        let mut live = s.clone();
        live.time += 10.;
        foreground.inherit(&fx, s.time, &live);
        foreground.ingest(&[], &live, &live);
        foreground.pose(&mut live);
        assert_eq!(live.actors.last().unwrap().state_age, 0.31);
        assert!((live.time - foreground.encases[&999].born - 0.5).abs() < 0.001);
        let mut resumed = BubbleAura::default();
        resumed.inherit(&foreground, live.time, &s);
        resumed.pose(&mut display);
        assert_eq!(display.actors.last().unwrap().state_age, 0.31);
        old = s.clone();
        s.time += 1.;
        s.actors.last_mut().unwrap().encased = 0.;
        fx.ingest(&[], &s, &old);
        assert!(!visible(s.actors.last().unwrap()));
        assert_eq!(fx.releases.len(), 1);
        assert!(fx.busy(s.time + 0.2));
        assert!(!fx.busy(s.time + 0.33));
        old = s.clone();
        s.time += 0.1;
        fx.ingest(&[], &s, &old);
        assert_eq!(fx.releases.len(), 1);
    }
    #[test]
    fn layer_transfer_reset_and_reduced_motion_do_not_replay_capture() {
        let mut s = scene();
        s.actors.last_mut().unwrap().encased = 1.;
        let mut fx = BubbleAura::default();
        fx.ingest(&[], &s, &s);
        assert_eq!(swell_frame(s.time - fx.encases[&999].born, false), 5);
        let mut partition = s.clone();
        partition.actors.retain(|a| a.id != 999);
        fx.ingest(&[], &partition, &partition);
        assert!(fx.releases.is_empty());
        let mut released = s.clone();
        released.actors.last_mut().unwrap().encased = 0.;
        fx.ingest(&[], &released, &released);
        assert!(fx.releases.is_empty());
        fx.ingest(&[Event::SceneReset], &s, &s);
        assert!(fx.encases.is_empty());
        assert_eq!(swell_frame(0., true), 5);
        let (anchor, size) = bubble_geometry(vec2(100., 200.), 40., 0., true);
        assert_eq!(anchor, vec2(100., 206.));
        assert_eq!(size.x, size.y);
        let a = s.actors.last_mut().unwrap();
        assert_eq!(actor_tint(a, 1.), WHITE);
        a.slowed = 0.3;
        assert!(actor_tint(a, 1.).r < 1.);
    }
}
