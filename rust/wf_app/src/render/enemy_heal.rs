//! Enemy cast wind-ups retain their painted cue; landed heals use shared Healing.
use crate::{
    assets::{Assets, DrawStats},
    camera::WorldCamera,
};
use macroquad::prelude::*;
use std::collections::BTreeMap;
use wf_combat::{ActorState, ActorView, Archetype, Event, Snapshot, Team};

const LINK_SECONDS: f64 = 0.24;
const GLINT_SECONDS: f64 = 0.6;
const HEAL: Color = Color::new(0.35, 1., 0.48, 1.);
struct Heal {
    healer: ActorView,
    target: ActorView,
    born: f64,
}
struct Cast {
    healer: ActorView,
    target: u32,
    born: f64,
    until: f64,
}
#[derive(Default)]
pub struct EnemyHeals {
    heals: Vec<Heal>,
    casts: BTreeMap<u32, Cast>,
}
fn endpoints(from: Vec2, from_height: f32, to: Vec2, to_height: f32) -> (Vec2, Vec2) {
    (
        from - vec2(0., from_height * 0.55),
        to - vec2(0., to_height * 0.5),
    )
}
impl EnemyHeals {
    pub fn ingest(&mut self, events: &[Event], s: &Snapshot) {
        self.heals.retain(|h| s.time - h.born < GLINT_SECONDS
            && s.actors.iter().any(|a| a.id == h.target.id && a.hp > 0.)
            && s.actors.iter().any(|a| a.id == h.healer.id && a.hp > 0.));
        self.casts.retain(|id, c| {
            s.time < c.until
                && s.actors.iter().any(|a| {
                    a.id == *id && a.hp > 0. && a.state == ActorState::Cast && a.encased <= 0.
                })
        });
        for event in events {
            match *event {
                Event::EnemyHealCast {
                    healer,
                    target,
                    seconds,
                } if seconds > 0. => {
                    if let Some(a) = s.actors.iter().find(|a| {
                        a.id == healer
                            && a.team == Team::Enemy
                            && a.hp > 0.
                            && a.state == ActorState::Cast
                            && a.encased <= 0.
                    }) {
                        self.casts.insert(
                            healer,
                            Cast {
                                healer: a.clone(),
                                target,
                                born: s.time,
                                until: s.time + seconds as f64,
                            },
                        );
                    }
                }
                Event::EnemyHealed {
                    healer,
                    target,
                    amount,
                } => {
                    if self.casts.get(&healer).is_some_and(|c| c.target == target) {
                        self.casts.remove(&healer);
                    }
                    self.heal(healer, target, amount, s);
                }
                Event::Died { id }
                | Event::Downed { id }
                | Event::Encased { id, .. }
                | Event::BossStaggered {
                    id,
                    interrupted: true,
                } => {
                    self.casts.remove(&id);
                }
                Event::ActionStarted { id, state, .. } if state != ActorState::Cast => {
                    self.casts.remove(&id);
                }
                Event::SceneReset | Event::WaveReset => {
                    *self = Self::default();
                }
                _ => {}
            }
        }
    }
    fn heal(&mut self, healer: u32, target: u32, amount: f32, s: &Snapshot) {
        if amount <= 0. {
            return;
        }
        let Some(from) = s
            .actors
            .iter()
            .find(|a| a.id == healer && a.team == Team::Enemy)
        else {
            return;
        };
        let Some(to) = s
            .actors
            .iter()
            .find(|a| a.id == target && a.team == Team::Enemy && a.hp > 0.)
        else {
            return;
        };
        self.heals.push(Heal {
            healer: from.clone(),
            target: to.clone(),
            born: s.time,
        });
    }
    pub fn busy(&self, time: f64) -> bool {
        self.heals
            .iter()
            .any(|h| (0. ..GLINT_SECONDS).contains(&(time - h.born)))
    }
    pub fn records(&self) -> usize {
        self.heals.len() + self.casts.len()
    }
    pub fn draw(&self, assets: &Assets, camera: &WorldCamera, s: &Snapshot, stats: &mut DrawStats) {
        for c in self.casts.values() {
            if s.time >= c.until {
                continue;
            }
            let a = s
                .actors
                .iter()
                .find(|a| a.id == c.healer.id)
                .unwrap_or(&c.healer);
            Self::glint(assets, camera, a, (s.time - c.born) % GLINT_SECONDS, stats);
        }
    }
    pub(super) fn glint(
        assets: &Assets,
        camera: &WorldCamera,
        a: &ActorView,
        age: f64,
        stats: &mut DrawStats,
    ) {
        let height = super::actors::body_height(assets, a, camera.zoom);
        assets.vfx_once(
            "heal-glint",
            age,
            camera.actor_foot(a),
            vec2(height * 0.75, height),
            0.,
            HEAL,
            stats,
        );
    }
    #[cfg(target_arch = "wasm32")]
    pub fn record(&self, assets: &Assets, camera: &WorldCamera, s: &Snapshot) {
        PROBE.with(|p| {
            *p.borrow_mut() = self
                .heals
                .iter()
                .filter_map(|h| {
                    let age = s.time - h.born;
                    if !(0. ..LINK_SECONDS).contains(&age) {
                        return None;
                    }
                    let from = s
                        .actors
                        .iter()
                        .find(|a| a.id == h.healer.id)
                        .unwrap_or(&h.healer);
                    let to = s
                        .actors
                        .iter()
                        .find(|a| a.id == h.target.id)
                        .unwrap_or(&h.target);
                    let (a, b) = endpoints(
                        camera.actor_foot(from),
                        super::actors::body_height(assets, from, camera.zoom),
                        camera.actor_foot(to),
                        super::actors::body_height(assets, to, camera.zoom),
                    );
                    Some([
                        from.id as f32,
                        to.id as f32,
                        match from.archetype {
                            Archetype::Marid => 1.,
                            Archetype::BossBomber => 2.,
                            _ => 0.,
                        },
                        age as f32,
                        a.x,
                        a.y,
                        b.x,
                        b.y,
                    ])
                })
                .collect()
        });
    }
}

#[cfg(target_arch = "wasm32")]
thread_local! {static PROBE:std::cell::RefCell<Vec<[f32;8]>>=const{std::cell::RefCell::new(Vec::new())};}
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_enemy_heal_count() -> u32 {
    PROBE.with(|p| p.borrow().len() as u32)
}
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_enemy_heal_probe(slot: u32, index: u32) -> f32 {
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
    fn scene() -> Snapshot {
        let mut s = crate::testing::sim()
            .snapshot()
            .clone();
        s.actors.truncate(2);
        s.actors[0].id = 90;
        s.actors[0].team = Team::Enemy;
        s.actors[0].archetype = Archetype::Marid;
        s.actors[1].id = 91;
        s.actors[1].team = Team::Enemy;
        s.actors[1].archetype = Archetype::Orc;
        s
    }
    #[test]
    fn only_explicit_heal_casts_show_a_cue_and_interruptions_never_make_a_link() {
        let mut s = scene();
        s.actors[0].state = ActorState::Cast;
        let mut fx = EnemyHeals::default();
        fx.ingest(
            &[Event::ActionStarted {
                id: 90,
                target: Some(91),
                state: ActorState::Cast,
            }],
            &s,
        );
        assert_eq!(fx.records(), 0);
        fx.ingest(
            &[Event::EnemyHealCast {
                healer: 90,
                target: 91,
                seconds: 0.8,
            }],
            &s,
        );
        assert!(fx.casts.contains_key(&90));
        assert!(!fx.busy(s.time));
        assert!(fx.heals.is_empty());
        s.actors[0].state = ActorState::Hurt;
        fx.ingest(&[], &s);
        assert!(fx.casts.is_empty());
        assert!(fx.heals.is_empty());
    }
    #[test]
    fn marid_and_chimerilass_casts_wait_for_heal_event_before_the_link() {
        for kind in [Archetype::Marid, Archetype::BossBomber] {
            let mut s = scene();
            s.actors[0].archetype = kind;
            s.actors[0].state = ActorState::Cast;
            let mut fx = EnemyHeals::default();
            fx.ingest(
                &[Event::EnemyHealCast {
                    healer: 90,
                    target: 91,
                    seconds: 0.8,
                }],
                &s,
            );
            s.time = 0.79;
            fx.ingest(&[], &s);
            assert!(fx.heals.is_empty());
            assert!(fx.casts.contains_key(&90));
            s.time = 0.8;
            fx.ingest(
                &[Event::EnemyHealed {
                    healer: 90,
                    target: 91,
                    amount: 25.,
                }],
                &s,
            );
            assert!(fx.casts.is_empty());
            assert_eq!(fx.heals.len(), 1);
            assert!(fx.busy(0.8));
        }
    }
    #[test]
    fn burst_link_and_glint_age_on_the_owning_clock_and_finish() {
        let mut s = scene();
        s.time = 10.;
        let mut fx = EnemyHeals::default();
        fx.heal(90, 91, 20., &s);
        assert_eq!(fx.records(), 1);
        assert!(fx.busy(10.));
        for _ in 0..40 {
            fx.ingest(&[], &s);
            assert_eq!(fx.records(), 1);
        }
        assert!(fx.busy(10.59));
        assert!(!fx.busy(10.61));
        s.time = 10.61;
        fx.ingest(&[], &s);
        assert_eq!(fx.records(), 0);
    }
    #[test]
    fn zero_heals_missing_actors_and_hero_targets_do_not_make_enemy_links() {
        let mut s = scene();
        let mut fx = EnemyHeals::default();
        fx.heal(90, 91, 0., &s);
        fx.heal(90, 999, 10., &s);
        s.actors[1].team = Team::Hero;
        fx.heal(90, 91, 10., &s);
        assert_eq!(fx.records(), 0);
    }
    #[test]
    fn painted_link_connects_body_centres_for_vertical_and_diagonal_targets() {
        for to in [vec2(10., 300.), vec2(300., 40.), vec2(300., 300.)] {
            let (from, end) = endpoints(vec2(10., 40.), 40., to, 100.);
            assert_eq!(from, vec2(10., 18.));
            assert_eq!(end, to - vec2(0., 50.));
        }
    }
    #[test]
    fn presentation_shows_heal_number_and_package_only_when_the_heal_lands() {
        let mut s = scene();
        s.actors[0].state = ActorState::Cast;
        let mut fx = super::super::vfx::Presentation::default();
        fx.ingest(
            vec![Event::EnemyHealCast {
                healer: 90,
                target: 91,
                seconds: 0.8,
            }],
            &s,
            &s,
        );
        assert!(fx.popups.is_empty());
        assert!(!fx.busy(0.));
        let old = s.clone();
        s.time = 0.8;
        fx.ingest(
            vec![
                Event::EnemyHealed {
                    healer: 90,
                    target: 91,
                    amount: 25.,
                },
                Event::Healed {
                    target: 91,
                    amount: 25.,
                    source: wf_combat::HealSource::EnemyHeal,
                },
            ],
            &s,
            &old,
        );
        assert_eq!(fx.popups.len(), 1);
        assert!(fx.busy(0.8));
        fx.ingest(
            vec![Event::EnemyHealed {
                healer: 90,
                target: 91,
                amount: 0.,
            }],
            &s,
            &s,
        );
        assert_eq!(fx.popups.len(), 1);
    }
}
