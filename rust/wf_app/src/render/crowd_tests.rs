use super::*;
use crate::{
    assets::{Clip, Frame},
    clips,
};
use macroquad::prelude::Image;
use nanoserde::DeJson;
use wf_combat::{ActorState, Facing, Sim, SimConfig};

struct Masks {
    manifest: Manifest,
    pages: Vec<Image>,
}
impl Masks {
    fn load() -> Self {
        let manifest =
            Manifest::deserialize_json(include_str!("../../gen/assets.json")).unwrap();
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("gen");
        let pages = manifest
            .pages
            .iter()
            .map(|p| {
                Image::from_file_with_format(&std::fs::read(root.join(&p.file)).unwrap(), None)
                    .unwrap()
            })
            .collect();
        Self { manifest, pages }
    }
    fn sprite<'a>(&'a self, a: &ActorView, idle: bool) -> (&'a Clip, &'a Frame, bool) {
        let art = &self.manifest.actors[&format!("{:?}", a.archetype)];
        let clip = &art.clips[if idle { "idle" } else { clips::name(a.state) }];
        let f = if idle {
            clips::sample(&clip.frames, 200., true)
        } else {
            clips::actor(clip, a)
        }
        .unwrap();
        (
            clip,
            f,
            (art.facing == "left") != (a.facing == Facing::Left),
        )
    }
    fn opaque(&self, f: &Frame, x: usize, y: usize) -> bool {
        let p = &self.pages[f.page];
        p.bytes[4 * ((f.y as usize + y) * p.width as usize + f.x as usize + x) + 3] > 0
    }
    // Count actual occupied Fara idle texels against the union of front enemy alpha masks.
    // Inverse transform matches Assets::frame, including scale, packed offsets and facing.
    fn visible(&self, s: &Snapshot, moved: bool) -> f32 {
        let h = s
            .actors
            .iter()
            .find(|a| a.archetype == Archetype::Fara)
            .unwrap();
        let (hc, hf, flip) = self.sprite(h, true);
        let os = offsets(s, |a| body_size(&self.manifest, a));
        let front: Vec<_> = s
            .actors
            .iter()
            .filter(|a| {
                a.team == Team::Enemy
                    && a.hp > 0.
                    && a.state != ActorState::Spawn
                    && (a.pos.y > h.pos.y || (a.pos.y == h.pos.y && a.id > h.id))
            })
            .map(|a| {
                let (c, f, flip) = self.sprite(a, false);
                let offset = if moved {
                    os.iter().find(|o| o.0 == a.id).unwrap().1
                } else {
                    Vec2::ZERO
                };
                let foot = vec2(a.pos.x - h.pos.x, (a.pos.y - h.pos.y) * SQUASH) + offset;
                (c, f, flip, foot, super::super::actors::visual_scale(a))
            })
            .collect();
        let mut all = 0;
        let mut clear = 0;
        for y in 0..hf.h as usize {
            for x in 0..hf.w as usize {
                if !self.opaque(hf, x, y) {
                    continue;
                }
                all += 1;
                let u = hf.offset_x + x as f32 + 0.5 - hc.foot_origin[0];
                let point = vec2(
                    if flip { -u } else { u },
                    hf.offset_y + y as f32 + 0.5 - hc.foot_origin[1],
                ) * super::super::actors::visual_scale(h);
                let covered = front.iter().any(|&(c, f, flip, foot, scale)| {
                    let q = (point - foot) / scale;
                    let x = (if flip { -q.x } else { q.x }) + c.foot_origin[0] - f.offset_x;
                    let y = q.y + c.foot_origin[1] - f.offset_y;
                    x >= 0.
                        && y >= 0.
                        && x < f.w
                        && y < f.h
                        && self.opaque(f, x as usize, y as usize)
                });
                if !covered {
                    clear += 1;
                }
            }
        }
        100. * clear as f32 / all as f32
    }
}

#[test]
#[ignore = "bounded five-seed Slice search; prints reproducible failure seed/step"]
fn find_failure_scene() {
    let m = Masks::load();
    let mut best = (101f32, 0, 0, 0);
    let mut peak = 0;
    for seed in [1, 7, 42, 123, 999] {
        let mut sim = crate::testing::sim_with(SimConfig {
            seed,
            ..Default::default()
        });
        sim.drain_events();
        for step in 1..=18000 {
            sim.step();
            sim.drain_events();
            let s = sim.snapshot();
            let h = s
                .actors
                .iter()
                .find(|a| a.archetype == Archetype::Fara)
                .unwrap();
            if h.hp <= 0. {
                continue;
            }
            let n = s
                .actors
                .iter()
                .filter(|a| {
                    a.team == Team::Enemy
                        && a.hp > 0.
                        && a.state != ActorState::Spawn
                        && (a.pos.x - h.pos.x).hypot(a.pos.y - h.pos.y) <= 120.
                })
                .count();
            peak = peak.max(n);
            if n >= 8 {
                let before = m.visible(s, false);
                if before < best.0 {
                    best = (before, seed, step, n);
                    eprintln!(
                        "best seed={seed} step={step} nearby={n} before={before:.2}% after={:.2}%",
                        m.visible(s, true)
                    );
                }
            }
        }
    }
    eprintln!("SEARCH best={best:?}, peak_nearby={peak}");
}

#[test]
#[ignore = "bounded constructed fallback at the live elliptical moat minimum"]
fn find_packed_scene() {
    let m = Masks::load();
    let mut best = (101f32, 0);
    for degree in 0..360 {
        let s = crate::crowd_proof::packed(degree as f32);
        let before = m.visible(&s, false);
        if before < best.0 {
            best = (before, degree);
        }
    }
    let s = crate::crowd_proof::packed(best.1 as f32);
    eprintln!("PACKED best={best:?} after={:.2}%", m.visible(&s, true));
}


// crowded_sixty_real_snapshots_have_bounded_display_motion retired (ORKA-63bf.12): a 32-High-Orc slice stress
// composition the WFM host never spawns; live crowd bounds are covered by the host-loop scenarios.
#[test]
fn enemy_bars_follow_displayed_feet_in_full_frame_crowds() {
    let m = Masks::load();
    let s = crate::crowd_proof::packed(28.);
    let mut camera = crate::camera::WorldCamera::new(&s);
    camera.actor_offsets = offsets(&s, |a| body_size(&m.manifest, a));
    for a in s.actors.iter().filter(|a| a.team == Team::Enemy) {
        let foot = camera.actor_foot(a);
        let r = super::super::actors::enemy_bar_bounds(foot, camera.zoom, a.scale);
        assert_eq!(r.x + r.w / 2., foot.x);
        assert!((r.y - foot.y - 8. * camera.zoom / 0.5 * a.scale).abs() < 0.0001);
        assert!(r.y > foot.y);
    }
}
#[test]
fn offsets_keep_sim_anchors_cap_and_reset_contracts() {
    let m = Masks::load();
    let mut s = crate::crowd_proof::packed(28.);
    let expected = offsets(&s, |a| body_size(&m.manifest, a));
    assert_eq!(expected[0].1, Vec2::ZERO);
    assert!(expected.iter().all(|o| o.1.length() <= MAX_OFFSET + 0.001));
    s.actors.reverse();
    for (id, offset) in offsets(&s, |a| body_size(&m.manifest, a)) {
        assert_eq!(expected.iter().find(|o| o.0 == id).unwrap().1, offset);
    }
    for a in &mut s.actors {
        if a.team == Team::Hero {
            a.hp = 0.;
        }
    }
    assert!(offsets(&s, |a| body_size(&m.manifest, a))
        .iter()
        .all(|o| o.1 == Vec2::ZERO));
    s.actors
        .iter_mut()
        .find(|a| a.team == Team::Hero)
        .unwrap()
        .hp = 1.;
    for kind in [
        Archetype::Boss,
        Archetype::BossBomber,
        Archetype::BossMarksman,
    ] {
        for a in &mut s.actors {
            if a.team == Team::Enemy {
                a.archetype = kind;
            }
        }
        assert!(offsets(&s, |a| body_size(&m.manifest, a))
            .iter()
            .all(|o| o.1 == Vec2::ZERO));
    }
}
