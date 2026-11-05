use crate::{
    assets::{Assets, DrawStats},
    camera::WorldCamera,
};
use macroquad::prelude::*;
use wf_combat::api::*;

#[derive(Default)]
pub struct Rewards {
    drops: Vec<(u32, f64)>,
    opens: Vec<(wf_combat::Vec2, f64)>,
    pickups: Vec<(u32, f64)>,
    banner: Option<(Reward, String, f64)>,
}
pub fn icon(reward: Reward) -> &'static str {
    match reward {
        Reward::FullHeal | Reward::MaxHp => "buff-heal",
        Reward::Attack => "buff-attack",
        Reward::Defense => "buff-defense",
        Reward::Range => "buff-range",
        Reward::AttackSpeed => "buff-attack-speed",
    }
}
/// Floating chest: resting height and bob amplitude (screen px) and bob period (s).
const CHEST_FLOAT_BASE: f32 = 6.;
const CHEST_FLOAT_BOB: f32 = 3.;
const CHEST_FLOAT_PERIOD: f32 = 1.8;
/// Height of the floating chest above its shadow; `ease_in` (0..1) lifts it smoothly after landing.
fn float_lift(time: f32, id: u32, ease_in: f32) -> f32 {
    let e = ease_in.clamp(0., 1.);
    let e = e * e * (3. - 2. * e);
    let phase = time * std::f32::consts::TAU / CHEST_FLOAT_PERIOD + id as f32 * 0.7;
    e * (CHEST_FLOAT_BASE + CHEST_FLOAT_BOB * (0.5 + 0.5 * phase.sin()))
}
/// Reward banner timing: holds 1.4 s, then fades over 0.6 s. Opened chests share it.
const BANNER_HOLD: f32 = 1.4;
const BANNER_FADE: f32 = 0.6;
fn banner_opacity(age: f32) -> f32 {
    ((BANNER_HOLD + BANNER_FADE - age) / BANNER_FADE).clamp(0., 1.)
}
fn multiplier_text(multiplier: f32) -> String {
    format!("{multiplier:.3}")
        .trim_end_matches('0')
        .trim_end_matches('.')
        .to_owned()
}
fn value(reward: Reward, b: PartyBuffs) -> Option<(&'static str, f32)> {
    Some(match reward {
        Reward::FullHeal | Reward::MaxHp => return None,
        Reward::Attack => ("Attack", b.attack),
        Reward::Defense => ("Defense", b.defense),
        Reward::Range => ("Range", b.range),
        Reward::AttackSpeed => ("Attack Speed", b.attack_speed),
    })
}
impl Rewards {
    pub fn ingest(&mut self, event: &Event, s: &Snapshot, previous: &Snapshot) {
        self.expire(s.time);
        self.pickups.retain(|(_, born)| s.time - *born < 0.6);
        match *event {
            Event::ChestDropped { id } => self.drops.push((id, s.time)),
            Event::ChestOpened { id, reward, .. } => {
                let label = value(reward, s.stage.buffs)
                    .map(|(label, multiplier)| format!("{label} ×{}", multiplier_text(multiplier)))
                    .unwrap_or_else(|| match reward {
                        Reward::MaxHp => "Max HP (cap ×1.5)",
                        _ => "Full Heal",
                    }.into());
                self.banner = Some((reward, label, s.time));
                self.pickups.clear();
                for (i, a) in s
                    .actors
                    .iter()
                    .filter(|a| a.team == Team::Hero && a.hp > 0.)
                    .enumerate()
                {
                    self.pickups.push((a.id, s.time + i as f64 * 0.035));
                }
                if let Some(chest) = s
                    .chests
                    .iter()
                    .chain(previous.chests.iter())
                    .find(|c| c.id == id)
                {
                    self.opens.push((chest.pos, s.time));
                }
            }
            _ => {}
        }
    }
    /// The wave chest sends no events (the host only asks combat to drop it), so its landing
    /// bounce and its opening sparkle are read off the snapshots: a chest that was not there
    /// lands, and a chest that turns `Open` sparkles (owner 2026-11-05: the sparkle was missing).
    pub fn observe(&mut self, s: &Snapshot, previous: &Snapshot) {
        self.expire(s.time);
        for chest in &s.chests {
            let before = previous.chests.iter().find(|c| c.id == chest.id);
            if before.is_none() && chest.age < 0.5 && !self.drops.iter().any(|(id, _)| *id == chest.id) {
                self.drops.push((chest.id, s.time - chest.age as f64));
            }
            if chest.state == ChestState::Open && before.is_some_and(|c| c.state != ChestState::Open) && !self.opens.iter().any(|(pos, _)| *pos == chest.pos) {
                self.opens.push((chest.pos, s.time - chest.state_age as f64));
            }
        }
    }
    /// A landing record lasts until the chest floats at full height (1 s), so the lift never jumps.
    fn expire(&mut self, time: f64) {
        self.drops.retain(|(_, born)| time - born < 1.);
        self.opens.retain(|(_, born)| time - born < 0.6);
    }
    pub fn records(&self) -> usize {
        self.drops.len() + self.opens.len() + self.pickups.len()
    }
    pub fn drop_decoration(&mut self) -> bool {
        if self.pickups.is_empty() {
            false
        } else {
            self.pickups.remove(0);
            true
        }
    }
    /// World y of the chest, for depth sorting among characters.
    pub fn chest_depth(s: &Snapshot) -> Option<f32> {
        s.chests.first().map(|c| c.pos.y)
    }
    /// Chest body and its opening sparkle; drawn in depth order with the characters.
    pub fn draw_chests(&self, assets: &Assets, camera: &WorldCamera, s: &Snapshot, stats: &mut DrawStats) {
        for chest in &s.chests {
            // An opened chest fades out with the reward banner and is gone when it completes.
            let opacity = if chest.state == ChestState::Open {
                banner_opacity(chest.state_age)
            } else {
                1.
            };
            if opacity <= 0. {
                continue;
            }
            let p = camera.project(chest.pos);
            let age = self
                .drops
                .iter()
                .find(|(id, _)| *id == chest.id)
                .map(|(_, born)| (s.time - born) as f32)
                .unwrap_or(1.);
            let t = (age / 0.35).clamp(0., 1.);
            let bounce = (t * std::f32::consts::PI).sin();
            // Owner: the chest floats, bobbing gently above the ground once it has landed. The
            // shadow stays on the floor and shrinks and fades as the chest rises.
            let float = float_lift(s.time as f32, chest.id, (age - 0.41).max(0.) / 0.4);
            let rise = (bounce * 12. + float) / (12. + CHEST_FLOAT_BASE + CHEST_FLOAT_BOB);
            assets.decal(
                "shadow",
                p,
                vec2(31., 10.) * (1. - rise * 0.3),
                0.,
                Color::new(0.10, 0.07, 0.03, 0.55 * opacity * (1. - rise * 0.35)),
                stats,
            );
            let name = if chest.state == ChestState::Open {
                "chest-open"
            } else {
                "chest-closed"
            };
            if let Some(tex) = assets.decals.get(name) {
                let scale = 32. / tex.height();
                let squash = if (0.35..0.41).contains(&age) {
                    1. - 0.08 * (std::f32::consts::PI * (age - 0.35) / 0.06).sin()
                } else {
                    1.
                };
                let sx = scale / squash;
                let sy = scale * squash;
                let pivot = assets
                    .pivots
                    .get(name)
                    .copied()
                    .unwrap_or([tex.width() * 0.5, tex.height()]);
                let shake = if chest.state == ChestState::Opening {
                    (chest.state_age * 35.).sin() * 0.025
                } else {
                    0.
                };
                draw_texture_ex(
                    tex,
                    p.x - pivot[0] * sx,
                    p.y - pivot[1] * sy - bounce * 12. - float,
                    Color::new(1., 1., 1., opacity),
                    DrawTextureParams {
                        dest_size: Some(vec2(tex.width() * sx, tex.height() * sy)),
                        rotation: shake,
                        pivot: Some(p),
                        ..Default::default()
                    },
                );
                stats.calls += 1;
            }
        }
        for &(pos, born) in &self.opens {
            assets.vfx_once(
                "chest-sparkle",
                s.time - born,
                camera.project(pos) - vec2(0., 16. + CHEST_FLOAT_BASE + CHEST_FLOAT_BOB * 0.5),
                vec2(44., 44.) * camera.zoom / 0.5,
                0.,
                WHITE,
                stats,
            );
            let age = (s.time - born) as f32;
            if age < 0.15 {
                assets.vfx_frame(
                    "shadow",
                    0,
                    camera.project(pos),
                    vec2(30., 10.),
                    0.,
                    Color::new(1., 0.8, 0.3, 0.25 * (1. - age / 0.15)),
                    stats,
                );
            }
        }
    }
    pub fn draw(&self, assets: &Assets, camera: &WorldCamera, s: &Snapshot, stats: &mut DrawStats) {
        for &(id, born) in &self.pickups {
            if let Some(a) = s.actors.iter().find(|a| a.id == id && a.hp > 0.) {
                assets.vfx_once(
                    "buff-ribbons",
                    s.time - born,
                    camera.project(a.pos),
                    vec2(22., 38.) * camera.zoom / 0.5,
                    0.,
                    WHITE,
                    stats,
                );
            }
        }
    }
    pub fn banner(&self, assets: &Assets, s: &Snapshot, stats: &mut DrawStats) {
        let Some((reward, label, born)) = &self.banner else {
            return;
        };
        let opacity = banner_opacity((s.time - born) as f32);
        if opacity <= 0. {
            return;
        }
        let width = measure_text(label, None, 20, 1.).width;
        let left = 180. - (width + 42.) * 0.5;
        draw_rectangle(
            left - 14.,
            172.,
            width + 70.,
            52.,
            Color::new(0.09, 0.065, 0.035, 0.9 * opacity),
        );
        draw_rectangle(
            left - 14.,
            172.,
            width + 70.,
            1.,
            Color::new(1., 0.78, 0.36, 0.8 * opacity),
        );
        assets.decal(
            icon(*reward),
            vec2(left + 13., 198.),
            vec2(30., 30.),
            0.,
            Color::new(1., 1., 1., opacity),
            stats,
        );
        draw_text(
            label,
            left + 38.,
            205.,
            20.,
            Color::new(1., 0.91, 0.68, opacity),
        );
        stats.calls += 3;
    }
    #[cfg(target_arch = "wasm32")]
    pub fn banner_active(&self, time: f64) -> bool {
        self.banner
            .as_ref()
            .is_some_and(|(_, _, born)| time - born < 2.)
    }
}
pub fn buffs(assets: &Assets, s: &Snapshot, stats: &mut DrawStats) {
    let active: Vec<_> = [
        Reward::Attack,
        Reward::Defense,
        Reward::Range,
        Reward::AttackSpeed,
    ]
    .into_iter()
    .filter_map(|reward| {
        value(reward, s.stage.buffs)
            .filter(|(_, multiplier)| *multiplier > 1.001)
            .map(|(_, m)| (reward, m))
    })
    .collect();
    if active.is_empty() {
        return;
    }
    let width = active.len() as f32 * 66. + 8.;
    let left = (360. - width) * 0.5;
    draw_rectangle(left, 608., width, 24., Color::new(0.06, 0.08, 0.12, 0.78));
    for (i, (reward, multiplier)) in active.into_iter().enumerate() {
        let x = left + 5. + i as f32 * 66.;
        assets.decal(
            icon(reward),
            vec2(x + 10., 620.),
            vec2(20., 20.),
            0.,
            WHITE,
            stats,
        );
        draw_text(
            &format!("×{}", multiplier_text(multiplier)),
            x + 22.,
            624.,
            11.,
            Color::new(1., 0.90, 0.65, 1.),
        );
        stats.calls += 1;
    }
}

#[cfg(test)]
mod float_tests {
    use super::*;
    #[test]
    fn the_wave_chest_lands_and_sparkles_once_when_it_opens_without_any_event() {
        let chest = |state, state_age, age| wf_combat::ChestView { id: 7, pos: wf_combat::Vec2::new(360., 520.), state, state_age, age, reward: None };
        let base = crate::testing::sim().snapshot().clone();
        let frame = |time: f64, chests: Vec<wf_combat::ChestView>| { let mut s = base.clone(); s.time = time; s.chests = chests; s };
        let mut rewards = Rewards::default();
        let empty = frame(10., vec![]);
        let landed = frame(10.033, vec![chest(ChestState::Closed, 0.033, 0.033)]);
        rewards.observe(&landed, &empty);
        assert_eq!(rewards.drops.len(), 1, "a new chest lands with its bounce");
        assert!((rewards.drops[0].1 - 10.).abs() < 0.001);
        let opening = frame(12., vec![chest(ChestState::Opening, 0.5, 2.)]);
        rewards.observe(&opening, &landed);
        assert!(rewards.opens.is_empty(), "no sparkle before the lid opens");
        let open = frame(12.1, vec![chest(ChestState::Open, 0.033, 2.1)]);
        rewards.observe(&open, &opening);
        assert_eq!(rewards.opens.len(), 1, "the sparkle plays when the chest opens");
        let still = frame(12.2, vec![chest(ChestState::Open, 0.133, 2.2)]);
        rewards.observe(&still, &open);
        assert_eq!(rewards.opens.len(), 1, "once per opening");
        rewards.observe(&frame(13., vec![chest(ChestState::Open, 0.933, 3.)]), &still);
        assert!(rewards.opens.is_empty() && rewards.drops.is_empty(), "records end with their animations");
    }
    #[test]
    fn chest_rises_smoothly_after_landing_then_bobs_within_its_band() {
        assert_eq!(float_lift(3., 1, 0.), 0.);
        let (mut lo, mut hi) = (f32::MAX, f32::MIN);
        for i in 0..200 {
            let h = float_lift(i as f32 * 0.02, 1, 1.);
            lo = lo.min(h);
            hi = hi.max(h);
        }
        assert!(lo >= CHEST_FLOAT_BASE - 0.01 && hi <= CHEST_FLOAT_BASE + CHEST_FLOAT_BOB + 0.01);
        assert!(hi - lo > CHEST_FLOAT_BOB * 0.9, "visible bob");
    }
}
