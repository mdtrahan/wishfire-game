use crate::{
    assets::{Assets, DrawStats},
    camera::WorldCamera,
    input::Controls,
};
use macroquad::prelude::*;
use wf_combat::api::{Snapshot, Team};
#[derive(Default)]
pub struct Timing {
    pub steps: u32,
    pub advance_ms: f64,
}
pub fn draw(
    assets: &Assets,
    camera: &WorldCamera,
    s: &Snapshot,
    controls: &Controls,
    timing: &Timing,
    spotlight: &crate::render::spotlight::Director,
    stats: &DrawStats,
    hash: u64,
) {
    if !controls.debug {
        return;
    }
    let lo = camera.project(s.arena_min);
    let hi = camera.project(s.arena_max);
    draw_rectangle_lines(lo.x, lo.y, hi.x - lo.x, hi.y - lo.y, 1.5, GREEN);
    draw_text(
        &format!("WALKABLE [{},{}) x [{},{})", s.arena_min.x, s.arena_max.x, s.arena_min.y, s.arena_max.y),
        lo.x + 4., 90., 10., GREEN,
    );
    for actor in s.actors.iter().filter(|a| a.team == Team::Hero) {
        let p = camera.project(actor.pos);
        let text = format!("{:?}", actor.ai_intent);
        let w = measure_text(&text, None, 11, 1.).width;
        draw_rectangle(
            p.x - w / 2. - 2.,
            p.y - 83.,
            w + 4.,
            14.,
            Color::new(0., 0., 0., 0.75),
        );
        draw_text(&text, p.x - w / 2., p.y - 72., 11., YELLOW);
    }
    draw_rectangle(5., 99., 334., 185., Color::from_rgba(8, 14, 24, 237));
    let per_step = if timing.steps > 0 {
        timing.advance_ms / timing.steps as f64
    } else {
        0.
    };
    let rows = [
        format!(
            "{} fps | {:.2} ms/frame | {:.0}x",
            get_fps(),
            get_frame_time() * 1000.,
            controls.speed
        ),
        format!("sim {:.3} ms/step | {} steps/frame", per_step, timing.steps),
        format!(
            "actors {}  hazards {}  shots {}",
            s.actors.len(),
            s.hazards.len(),
            s.projectiles.len()
        ),
        format!("seed {}  step {}  t {:.2}", controls.seed, s.step, s.time),
        format!("hash {hash:016x}"),
        format!(
            "PLACEHOLDER {} | ~{} draws",
            stats.placeholders, stats.calls
        ),
        format!(
            "assets {:.0}ms | VFX {:.2}MiB",
            assets.load_ms,
            assets.vfx_bytes as f64 / 1048576.
        ),
        format!(
            "Spot {} | {:.1}s wall | {:?}",
            spotlight.count, spotlight.wall_time, spotlight.phase
        ),
        format!(
            "Fara {} Hondo {} Runa {} Kaja {}",
            spotlight.heroes[0], spotlight.heroes[1], spotlight.heroes[2], spotlight.heroes[3]
        ),
    ];
    for (i, text) in rows.iter().enumerate() {
        draw_text(
            text,
            12.,
            117. + i as f32 * 19.,
            13.,
            if i == 5 && stats.placeholders > 0 {
                ORANGE
            } else {
                LIGHTGRAY
            },
        );
    }
}

// Read-only browser QA metrics. No sim mutation or extra progression path.
#[cfg(target_arch = "wasm32")]
std::thread_local! {
    static PROBE: std::cell::Cell<[f32; 21]> = const { std::cell::Cell::new([0.; 21]) };
}
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_probe(index: u32) -> f32 {
    PROBE.with(|p| p.get().get(index as usize).copied().unwrap_or(f32::NAN))
}
#[cfg(target_arch = "wasm32")]
pub fn record(assets: &Assets, camera: &WorldCamera, s: &Snapshot, controls: &Controls) {
    use crate::camera::{BAND_BOTTOM, BAND_TOP, WIDTH};
    use wf_combat::api::{HazardKind, HazardPhase, StagePhase};
    let mut living = 0;
    let mut clipped = 0;
    let mut boss_hp = 0.;
    let mut boss_coverage = 0.;
    let band = Rect::new(0., BAND_TOP, WIDTH, BAND_BOTTOM - BAND_TOP);
    for a in &s.actors {
        if a.hp <= 0. {
            continue;
        }
        let Some(art) = assets.manifest.actors.get(&format!("{:?}", a.archetype)) else {
            continue;
        };
        let Some(clip) = art.clips.get(crate::clips::name(a.state)) else {
            continue;
        };
        let Some(frame) = crate::clips::actor(clip, a) else {
            continue;
        };
        let p = camera.project(a.pos);
        let flip = (art.facing == "left") != (a.facing == wf_combat::api::Facing::Left);
        let x = if flip {
            clip.foot_origin[0] - frame.offset_x - frame.w
        } else {
            frame.offset_x - clip.foot_origin[0]
        };
        let scale = camera.zoom * crate::render::actors::visual_scale(a);
        let body = Rect::new(
            p.x + x * scale,
            p.y + (frame.offset_y - clip.foot_origin[1]) * scale,
            frame.w * scale,
            frame.h * scale,
        );
        let visible_w = (body.right().min(band.right()) - body.left().max(band.left())).max(0.);
        let visible_h = (body.bottom().min(band.bottom()) - body.top().max(band.top())).max(0.);
        let coverage = visible_w * visible_h / (body.w * body.h).max(1.);
        if a.team == Team::Hero {
            living += 1;
            if coverage < 0.999 {
                clipped += 1;
            }
        }
        if crate::render::actors::is_boss(a.archetype) {
            boss_hp = a.hp;
            boss_coverage = coverage;
        }
    }
    let hostile_countdowns = s
        .hazards
        .iter()
        .filter(|h| {
            h.hostile && h.team == Team::Enemy && h.phase == HazardPhase::Locked && {
                let p = camera.project(h.origin);
                p.x > -70. && p.x < WIDTH + 70. && p.y > BAND_TOP && p.y < BAND_BOTTOM
            }
        })
        .count();
    PROBE.with(|p| {
        p.set([
            s.time as f32,
            s.stage.elapsed,
            match s.stage.phase {
                StagePhase::Lull => 0.,
                StagePhase::Spike => 1.,
                StagePhase::Boss => 2.,
                StagePhase::BossEscalation => 3.,
                StagePhase::Victory => 4.,
            },
            hostile_countdowns as f32,
            living as f32,
            clipped as f32,
            boss_hp,
            boss_coverage,
            controls.speed,
            if controls.paused { 1. } else { 0. },
            s.stage.wipes as f32,
            camera.zoom,
            s.hazards
                .iter()
                .filter(|h| h.kind == HazardKind::SpawnMarker)
                .count() as f32,
            s.stage.mini_wave as f32,
            s.hazards
                .iter()
                .filter(|h| matches!(h.kind, HazardKind::SniperLine | HazardKind::LizardoDrop))
                .count() as f32,
            s.hazards
                .iter()
                .filter(|h| {
                    matches!(h.kind, HazardKind::BossCharge | HazardKind::BossSlam)
                        && h.phase == HazardPhase::Locked
                })
                .count() as f32,
            if controls.menu_open { 1. } else { 0. },
            s.actors
                .iter()
                .filter(|a| a.state == wf_combat::api::ActorState::Spawn)
                .count() as f32,
            s.hazards
                .iter()
                .filter(|h| {
                    matches!(h.kind, HazardKind::SniperLine | HazardKind::LizardoDrop)
                        && h.phase == HazardPhase::Locked
                })
                .map(|h| h.progress)
                .fold(0., f32::max),
            s.hazards
                .iter()
                .filter(|h| {
                    matches!(h.kind, HazardKind::BossCharge | HazardKind::BossSlam)
                        && h.phase == HazardPhase::Locked
                })
                .map(|h| h.progress)
                .fold(0., f32::max),
            s.hazards
                .iter()
                .filter(|h| h.kind == HazardKind::SpawnMarker)
                .map(|h| h.progress)
                .fold(0., f32::max),
        ])
    });
}

#[cfg(target_arch = "wasm32")]
std::thread_local! {
    static R9_PROBE: std::cell::Cell<[f32; 12]> = const { std::cell::Cell::new([0.; 12]) };
}
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_r9_probe(index: u32) -> f32 {
    R9_PROBE.with(|p| p.get().get(index as usize).copied().unwrap_or(f32::NAN))
}
#[cfg(target_arch = "wasm32")]
pub fn record_r9(s: &Snapshot, reward_banner: bool) {
    use wf_combat::api::*;
    let progress = |kind: Archetype| {
        s.hazards
            .iter()
            .filter(|h| {
                h.phase == HazardPhase::Locked
                    && s.actors
                        .iter()
                        .any(|a| a.id == h.owner && a.archetype == kind)
            })
            .map(|h| h.progress)
            .fold(-1., f32::max)
    };
    R9_PROBE.with(|p| {
        p.set([
            s.time as f32,
            s.chests
                .iter()
                .filter(|c| c.state == ChestState::Open)
                .map(|c| c.state_age)
                .fold(-1., f32::max),
            if reward_banner { 1. } else { 0. },
            s.hazards
                .iter()
                .filter(|h| h.kind == HazardKind::Resurrect)
                .map(|h| h.progress)
                .fold(-1., f32::max),
            progress(Archetype::BossBomber),
            progress(Archetype::BossMarksman),
            s.stage.fade,
            s.stage.tier as f32,
            s.stage.wave as f32,
            s.stage.wipes as f32,
            s.chests.len() as f32,
            s.actors
                .iter()
                .filter(|a| a.team == Team::Hero && a.hp <= 0.)
                .count() as f32,
        ])
    });
}

#[cfg(target_arch = "wasm32")]
std::thread_local! {static VFX_PROBE:std::cell::Cell<[f32;8]>=const{std::cell::Cell::new([0.;8])};}
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_vfx_probe(index: u32) -> f32 {
    VFX_PROBE.with(|p| p.get().get(index as usize).copied().unwrap_or(f32::NAN))
}
#[cfg(target_arch = "wasm32")]
pub fn record_vfx(assets: &Assets, stats: &DrawStats) {
    MISSING_DRAWS.with(|p|*p.borrow_mut()=stats.missing_assets.clone());
    // Calls approximate submissions; count real GL draws separately in the capture harness.
    VFX_PROBE.with(|p| {
        p.set([
            stats.calls as f32,
            stats.fx_quads as f32,
            stats.placeholders as f32,
            get_frame_time() * 1000.,
            assets.vfx_bytes as f32,
            assets.load_ms as f32,
            assets.vfx.len() as f32,
            0.,
        ])
    });
}

#[cfg(target_arch="wasm32")]
std::thread_local! {static MISSING_DRAWS:std::cell::RefCell<Vec<String>>=const{std::cell::RefCell::new(Vec::new())};}
#[cfg(target_arch="wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_missing_draw_count()->u32 {MISSING_DRAWS.with(|p|p.borrow().len()as u32)}
#[cfg(target_arch="wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_missing_draw_byte(slot:u32,index:u32)->u32 {MISSING_DRAWS.with(|p|p.borrow().get(slot as usize).and_then(|s|s.as_bytes().get(index as usize)).copied().unwrap_or(0)as u32)}

// Fara-only, read-only browser proof: current snapshot, cast counts, last resolve snapshots.
#[cfg(target_arch = "wasm32")]
std::thread_local! {
    static FARA_PROBE: std::cell::Cell<[f32; 15]> = const { std::cell::Cell::new([0.; 15]) };
}
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_fara_probe(index: u32) -> f32 {
    FARA_PROBE.with(|p| p.get().get(index as usize).copied().unwrap_or(f32::NAN))
}
#[cfg(target_arch = "wasm32")]
pub fn record_fara(s: &Snapshot, events: &[wf_combat::Event]) {
    use wf_combat::{Archetype, Event, HazardKind};
    let Some(a) = s.actors.iter().find(|a| a.archetype == Archetype::Fara) else { return; };
    FARA_PROBE.with(|p| {
        let mut row = p.get();
        row[..5].copy_from_slice(&[s.step as f32, s.combat_time as f32, a.ward, a.max_hp,
            u8::from(a.warcry_shield) as f32]);
        let grants = events.iter().filter(|e| matches!(e, Event::WardGained { target, .. } if *target == a.id)).count();
        let (step, shield) = (row[0], row[4]);
        for e in events {
            match e {
                Event::WardGained { target, amount } if *target == a.id => {
                    row[5] += 1.;
                    row[7..11].copy_from_slice(&[step, a.ward, shield, *amount]);
                }
                Event::HazardResolved { kind: HazardKind::GroundPound, .. } => {
                    row[6] += 1.;
                    row[11..15].copy_from_slice(&[step, a.ward, shield, grants as f32]);
                }
                _ => {}
            }
        }
        p.set(row);
    });
}
