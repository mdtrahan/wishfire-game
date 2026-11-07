//! Render-only keep-out, in projected world units (multiply by camera zoom).
//! Feet, sort order, collision and attacks remain authoritative sim coordinates.
use crate::{assets::Manifest, camera::SQUASH};
use macroquad::prelude::{vec2, Vec2};
use wf_combat::{ActorView, Archetype, Snapshot, Team};

// At normal 0.5 zoom: cap 48 px, edge feather 20 px, clearance 1 px.
pub const MAX_OFFSET: f32 = 96.;
const FEATHER: f32 = 40.;
const GAP: f32 = 2.;

fn smooth(t: f32) -> f32 {
    let t = t.clamp(0., 1.);
    t * t * (3. - 2. * t)
}

/// Stable idle bounds prevent animation frames from moving the keep-out boundary.
/// Symmetric width covers both facings, including off-centre packed sprites.
pub fn body_size(manifest: &Manifest, a: &ActorView) -> Vec2 {
    use Archetype::*;
    let name = match a.archetype {
        Fara => "Fara",
        Hondo => "Hondo",
        Runa => "Runa",
        Kaja => "Kaja",
        Gobloc => "Gobloc",
        Orc => "Orc",
        Sniper => "Sniper",
        Lizardo => "Lizardo",
        Fizzmite => "Fizzmite",
        Boss => "Boss",
        BossBomber => "BossBomber",
        BossMarksman => "BossMarksman",
        HighOrc => "HighOrc",
        Marid => "Marid",
        Gloamink => "Gloamink",
        Mirewing => "Mirewing",
        Bastorto => "Bastorto",
        WfmHighGobloc => "WfmHighGobloc",
        WfmSkeleton => "WfmSkeleton",
        WfmChimerilass => "WfmChimerilass",
        WfmDjinn => "WfmDjinn",
    };
    let scale = super::actors::visual_scale(a);
    manifest
        .actors
        .get(name)
        .and_then(|art| art.clips.get("idle"))
        .map_or(vec2(128., 128.) * scale, |clip| {
            clip.frames.iter().fold(Vec2::ZERO, |size, f| {
                vec2(
                    size.x.max(
                        2. * (f.offset_x - clip.foot_origin[0])
                            .abs()
                            .max((f.offset_x + f.w - clip.foot_origin[0]).abs()),
                    ),
                    size.y.max(clip.foot_origin[1] - f.offset_y),
                )
            }) * scale
        })
}

/// Ray out of the hero's body box: centre occluders move down, flanks fan sideways.
/// Work in the projected plane, retaining sim depth for sorting. The feather starts
/// behind the depth boundary so entering the foreground cannot switch the offset on.
pub fn offsets(s: &Snapshot, size: impl Fn(&ActorView) -> Vec2) -> Vec<(u32, Vec2)> {
    s.actors
        .iter()
        .map(|a| {
            let mut offset = Vec2::ZERO;
            if a.team == Team::Enemy && !super::actors::is_boss(a.archetype) {
                let body = size(a);
                for hero in s
                    .actors
                    .iter()
                    .filter(|h| h.team == Team::Hero && h.hp > 0.)
                {
                    let torso = size(hero);
                    let dx = a.pos.x - hero.pos.x;
                    let dy = (a.pos.y - hero.pos.y) * SQUASH;
                    let side = (body.x + torso.x) * 0.5 + GAP - dx.abs();
                    let down = body.y + GAP - dy;
                    if side <= 0. || down <= 0. || dy <= -FEATHER {
                        continue;
                    }
                    let direction = vec2(dx, (dy + torso.y * 0.6).max(FEATHER)).normalize();
                    let distance = (side / direction.x.abs().max(0.0001)).min(down / direction.y);
                    let push = direction
                        * distance
                        * smooth(distance / FEATHER)
                        * smooth((dy + FEATHER) / FEATHER);
                    // Strongest constraint wins without averaging away its clearance.
                    if push.length_squared() > offset.length_squared() {
                        offset = push;
                    }
                }
            }
            (a.id, offset.clamp_length_max(MAX_OFFSET))
        })
        .collect()
}

/// Rate-limit only the display offset. Frame-rate independent; sim never sees this cache.
/// New actors start at their target while spawn art is appearing; resets discard old ids.
#[derive(Default)]
pub struct CrowdBuffer {
    positions: Vec<(u32, Vec2)>,
    step: u64,
}
pub const OFFSET_SPEED: f32 = 180.; // 3 px per 30 Hz snapshot at normal zoom.
impl CrowdBuffer {
    pub fn update(
        &mut self,
        s: &Snapshot,
        size: impl Fn(&ActorView) -> Vec2,
        dt: f32,
    ) -> Vec<(u32, Vec2)> {
        if s.step < self.step {
            self.positions.clear();
        }
        self.step = s.step;
        let mut next = offsets(s, size);
        for (id, target) in &mut next {
            if let Some((_, old)) = self.positions.iter().find(|o| o.0 == *id) {
                *target = *old + (*target - *old).clamp_length_max(OFFSET_SPEED * dt.max(0.));
            }
        }
        self.positions.clone_from(&next);
        next
    }
}

/// Shared full-frame reserve for bars, including heroes in another spotlight layer.
pub fn hero_boxes(
    m: &Manifest,
    camera: &crate::camera::WorldCamera,
    s: &Snapshot,
) -> Vec<macroquad::prelude::Rect> {
    s.actors
        .iter()
        .filter(|a| a.team == Team::Hero && a.hp > 0.)
        .map(|a| {
            let size = body_size(m, a) * camera.zoom;
            let p = camera.project(a.pos);
            macroquad::prelude::Rect::new(
                p.x - size.x * 0.5 - 1.,
                p.y - size.y - 1.,
                size.x + 2.,
                size.y + 2.,
            )
        })
        .collect()
}

#[cfg(test)]
#[path = "crowd_tests.rs"]
mod tests;
