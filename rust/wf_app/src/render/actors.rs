use crate::{
    assets::{Assets, DrawStats},
    camera::WorldCamera,
    clips,
};
use macroquad::prelude::Vec2;
use macroquad::prelude::*;
use wf_combat::api::*;
/// On-screen size of heroes and regular enemies relative to their 128 px puppet frames.
/// The boss is deliberately exempt and keeps his full, comically large size.
pub const ACTOR_SCALE: f32 = 0.6;
fn ward_strength(a: &ActorView) -> f32 {
    if a.team == Team::Hero && a.ward > 0. && a.hp > 0. && !a.warcry_shield {
        (a.ward / (0.4 * a.max_hp)).clamp(0.3, 1.)
    } else { 0. }
}
pub fn is_boss(kind: Archetype) -> bool {
    matches!(
        kind,
        Archetype::Boss | Archetype::BossBomber | Archetype::BossMarksman
    )
}
pub fn visual_scale(a: &ActorView) -> f32 {
    if is_boss(a.archetype) {
        a.scale
    } else {
        a.scale * ACTOR_SCALE
    }
}
/// Fallen enemies leave the sim one step after dying. The client keeps a short-lived copy so
/// the KO clip plays and the body fades out instead of blinking away.
#[derive(Clone, Default)]
pub struct Corpses {
    bodies: Vec<(ActorView, f64)>,
}
const CORPSE_FADE: f32 = 0.42;
impl Corpses {
    pub(super) fn include_ground(&mut self, s: &Snapshot, corpses: &Self, draw_time: f64) {
        self.bodies.extend(ordered_actors(s, corpses).into_iter()
            .filter(|a| ground_actor(a)).map(|a| (a.clone(), draw_time)));
    }

    pub(super) fn take_combo(&mut self,from:&mut Self,view:&wf_combat::SpotlightView,delta:f64) {
        super::spotlight::transfer(&mut from.bodies,&mut self.bodies,
            |(a,_)|super::spotlight::highlighted(a,view),|(_,born)|*born+=delta);
    }
    pub(super) fn pause(&mut self,delta:f64) {for (_,born) in &mut self.bodies {*born+=delta;}}
    pub fn busy(&self, manifest: &crate::assets::Manifest, time: f64) -> bool {
        self.bodies.iter().any(|(body, born)| {
            let duration = manifest
                .actors
                .get(&format!("{:?}", body.archetype))
                .and_then(|art| art.clips.get("ko"))
                .map(|c| clips::duration(&c.frames) / 1000.)
                .unwrap_or(0.4);
            time - born < duration as f64
        })
    }
    pub fn idle(&self) -> bool {
        self.bodies.is_empty()
    }
    pub fn displace(&mut self, effects: &super::vfx::Presentation, time: f64) {
        for (body, _) in &mut self.bodies {
            effects.displace_actor(body, time);
        }
    }

    pub fn delay(&mut self, effects: &super::vfx::Presentation) {
        for (body,born) in &mut self.bodies {
            if let Some(at)=effects.death_time(body.id) {*born=born.max(at);}
        }
    }
    pub fn ingest(&mut self, events: &[Event], current: &Snapshot, previous: &Snapshot) {
        let events =
            if let Some(reset) = events.iter().rposition(|e| matches!(e, Event::SceneReset)) {
                self.bodies.clear();
                &events[reset + 1..]
            } else {
                events
            };
        // Wipe cleanup removes living enemies; it must never play their death clips.
        if current.actors.iter().any(|a| a.team == Team::Hero)
            && current
                .actors
                .iter()
                .filter(|a| a.team == Team::Hero)
                .all(|a| a.hp <= 0.)
            || events
                .iter()
                .any(|e| matches!(e, Event::WaveReset | Event::StageCleared))
        {
            self.bodies.clear();
            return;
        }
        for event in events {
            let Event::Died { id } = *event else { continue };
            if self.bodies.iter().any(|(b, _)| b.id == id) {
                continue;
            }
            let last = current
                .actors
                .iter()
                .chain(previous.actors.iter())
                .find(|a| a.id == id && a.team == Team::Enemy);
            if let Some(a) = last.filter(|a| !is_boss(a.archetype)) {
                let mut body = a.clone();
                body.state = ActorState::Dead;
                body.state_age = 0.;
                body.state_duration = 0.;
                self.bodies.push((body, current.time));
            }
        }
    }
    /// Advance on sim time (pause freezes the fade) and drop fully faded bodies.
    pub fn update(&mut self, manifest: &crate::assets::Manifest, s: &Snapshot) {
        for (body, born) in &mut self.bodies {
            body.state_age = (s.time - *born).max(0.) as f32;
        }
        self.bodies.retain(|(body, _)| {
            let ko = manifest
                .actors
                .get(&format!("{:?}", body.archetype))
                .and_then(|art| art.clips.get(clips::name(ActorState::Dead)))
                .map(|c| clips::duration(&c.frames) / 1000.)
                .unwrap_or(0.4);
            body.state_age < ko + CORPSE_FADE
        });
    }
}
/// Visible idle artwork bounds, independent of cast/KO canvas padding.
pub fn body_height(assets: &Assets, a: &ActorView, zoom: f32) -> f32 {
    assets
        .manifest
        .actors
        .get(&format!("{:?}", a.archetype))
        .and_then(|a| a.clips.get("idle"))
        .map(|c| {
            c.frames
                .iter()
                .map(|f| (c.foot_origin[1] - f.offset_y).max(0.))
                .fold(0., f32::max)
                * visual_scale(a)
                * zoom
        })
        .unwrap_or(110. * visual_scale(a) * zoom)
}
pub fn ornaments(
    assets: &Assets,
    camera: &WorldCamera,
    _s: &Snapshot,
    corpses: &Corpses,
    stats: &mut DrawStats,
) {
    for (a, _) in &corpses.bodies {
        let ko = assets
            .manifest
            .actors
            .get(&format!("{:?}", a.archetype))
            .and_then(|x| x.clips.get("ko"))
            .map(|c| clips::duration(&c.frames) / 1000.)
            .unwrap_or(0.4);
        let age = a.state_age - ko;
        if age >= 0. {
            let size = (0.70 * body_height(assets, a, camera.zoom)).min(if is_boss(a.archetype) {
                42.
            } else {
                30.
            });
            assets.vfx_once(
                "ko-puff",
                age as f64,
                camera.actor_foot(a),
                Vec2::splat(size),
                0.,
                WHITE,
                stats,
            );
        }
    }
}
/// Ward emission reused for special casts: back glow, front shimmer and rising motes.
fn ward_aura(
    assets: &Assets,
    camera: &WorldCamera,
    foot: Vec2,
    a: &ActorView,
    time: f64,
    strength: f32,
    palette: [Color; 4],
    front: bool,
    motes: u32,
    stats: &mut DrawStats,
) {
    let required = if front { 1 + motes } else { 2 };
    if stats.fx_quads + required > 112 { return; }
    stats.fx_quads += required;
    let tint = |i: usize, alpha| Color::new(palette[i].r, palette[i].g, palette[i].b, alpha * strength);
    let t = time as f32;
    let seed = a.id as f32 * 1.37;
    let h = body_height(assets, a, camera.zoom);
    let centre = foot - vec2(0., 0.48 * h);
    let breath = 0.5 + 0.5 * (t * 2.4 + seed).sin();
    let shimmer = ((t * 17. + seed * 3.).sin() * (t * 11.3 + seed).sin()).abs();
    gl_use_material(&assets.additive);
    if !front {
        // Behind the hero: a breathing crimson emission that clearly extends past the body.
        assets.decal(
            "flash",
            centre,
            vec2(1.7 * h, 2.0 * h) * (1. + 0.05 * breath),
            0.,
            tint(0, 0.42 + 0.14 * breath),
            stats,
        );
        assets.decal(
            "flash",
            centre,
            vec2(1.25 * h, 1.55 * h),
            0.,
            tint(1, 0.20 + 0.22 * shimmer),
            stats,
        );
    } else {
        // Over the hero: a light warm-pink shimmer, plus rising light motes.
        assets.decal(
            "flash",
            centre,
            vec2(0.8 * h, 1.05 * h),
            0.,
            tint(2, 0.05 + 0.10 * shimmer),
            stats,
        );
        for i in 0..motes {
            let u = (t * 0.7 + i as f32 * 0.2 + seed * 0.13).fract();
            let sway = ((i as f32) * 2.1 + t * 1.3 + seed).sin() * 0.36 * h;
            let pos = centre + vec2(sway, 0.4 * h - u * 1.0 * h);
            let size = 8. * camera.zoom / 0.5 * (1. - 0.4 * u);
            assets.decal(
                "flash",
                pos,
                vec2(size, size),
                0.,
                tint(3, (std::f32::consts::PI * u).sin() * 0.85),
                stats,
            );
        }
    }
    gl_use_default_material();
}
fn aura_palette(kind: Archetype) -> [Color; 4] {
    match kind {
        Archetype::Runa => [Color::new(1.,0.62,0.08,1.), Color::new(1.,0.83,0.35,1.), Color::new(1.,0.9,0.55,1.), Color::new(1.,0.94,0.65,1.)],
        Archetype::Kaja => [Color::new(0.63,0.12,1.,1.), Color::new(0.8,0.38,1.,1.), Color::new(0.88,0.55,1.,1.), Color::new(0.94,0.68,1.,1.)],
        _ => [Color::new(0.95,0.08,0.22,1.), Color::new(1.,0.38,0.55,1.), Color::new(1.,0.5,0.65,1.), Color::new(1.,0.55,0.68,1.)],
    }
}
fn cast_palette(kind: Archetype, level: f32) -> [Color; 4] {
    let ward=aura_palette(Archetype::Fara);let special=aura_palette(kind);
    std::array::from_fn(|i|Color::new(
        ward[i].r+(special[i].r-ward[i].r)*level,
        ward[i].g+(special[i].g-ward[i].g)*level,
        ward[i].b+(special[i].b-ward[i].b)*level,1.))
}
fn groove_tint(a: &ActorView, mut tint: Color) -> Color {
    if a.hp > 0. && a.groove_active > 0. {
        let mode = match (a.archetype, a.groove) {
            (Archetype::Hondo, Some(Groove::Combo)) => Color::new(1., 0.91, 0.69, 1.),
            _ => WHITE,
        };
        tint.r *= mode.r; tint.g *= mode.g; tint.b *= mode.b;
    }
    tint
}
/// Reusable silhouette echo; the caller supplies the exact sampled clip frame and facing.
#[derive(Clone, Copy)]
pub struct EchoParams { pub scale_from: f32, pub tint: Color, pub scale_to: f32, pub stretch: f32, pub alpha: f32 }
pub fn echo_curve(progress: f32, p: EchoParams) -> (Vec2, f32) {
    let t = progress.clamp(0., 1.); let ease = 1. - (1. - t).powi(3);
    let x = p.scale_from + (p.scale_to - p.scale_from) * ease;
    (vec2(x, x * (1. + (p.stretch - 1.) * ease)), p.alpha * (1. - t).powi(2))
}
pub fn echo_rect(foot: Vec2, height: f32, top: Vec2, size: Vec2, scale: Vec2) -> Rect {
    let mid = foot - vec2(0., height * 0.5);
    let top = mid + (top - mid) * scale;
    Rect::new(top.x, top.y, size.x * scale.x, size.y * scale.y)
}
pub fn sprite_echo(assets: &Assets, camera: &WorldCamera, actor: &ActorView, clip: &crate::assets::Clip,
    frame: &crate::assets::Frame, params: EchoParams, progress: f32, stats: &mut DrawStats) {
    if stats.fx_quads >= 112 { return; }
    let Some(page) = assets.pages.get(frame.page) else { return; };
    let (scale, alpha) = echo_curve(progress, params);
    if alpha <= 0. { return; }
    let source_left=assets.manifest.actors.get(&format!("{:?}",actor.archetype)).is_some_and(|a|a.facing=="left");
    let flip = source_left != (actor.facing == Facing::Left);
    let x = if flip { clip.foot_origin[0] - frame.offset_x - frame.w } else { frame.offset_x - clip.foot_origin[0] };
    let foot = camera.project(actor.pos); let base = visual_scale(actor) * camera.zoom;
    let top = foot + vec2(x, frame.offset_y - clip.foot_origin[1]) * base;
    let r = echo_rect(foot, body_height(assets, actor, camera.zoom), top, vec2(frame.w, frame.h) * base, scale);
    gl_use_material(&assets.additive);
    draw_texture_ex(page, r.x, r.y, Color::new(params.tint.r, params.tint.g, params.tint.b, alpha), DrawTextureParams {
        source: Some(Rect::new(frame.x, frame.y, frame.w, frame.h)), dest_size: Some(vec2(r.w, r.h)), flip_x: flip, ..Default::default()
    });
    gl_use_default_material(); stats.calls += 1; stats.fx_quads += 1;
}

pub(super) fn ground_actor(a: &ActorView) -> bool {
    matches!(a.state, ActorState::Dead | ActorState::Downed)
}
pub(super) fn ordered_actors<'a>(s: &'a Snapshot, corpses: &'a Corpses) -> Vec<&'a ActorView> {
    let mut actors: Vec<_> = s
        .actors
        .iter()
        .filter(|a| {
            // Owner: a felled boss stays in the sim through the victory hold — show it falling.
            !(a.team == Team::Enemy && a.state == ActorState::Dead) || is_boss(a.archetype)
        })
        .chain(corpses.bodies.iter().filter(|(_,born)|s.time>=*born).map(|(body, _)| body))
        .collect();
    // Ground bodies precede every standing actor, with the original y/id order within each layer.
    actors.sort_by(|a, b| ground_actor(b).cmp(&ground_actor(a))
        .then(a.pos.y.total_cmp(&b.pos.y)).then(a.id.cmp(&b.id)));
    actors
}
enum Body<'a> {
    Actor(&'a ActorView),
    Bomb(&'a ProjectileView),
}
impl Body<'_> {
    fn ground(&self) -> bool {
        matches!(self, Self::Actor(a) if ground_actor(a))
    }
    fn y(&self) -> f32 {
        match self { Self::Actor(a) => a.pos.y, Self::Bomb(p) => p.pos.y }
    }
    fn id(&self) -> u32 {
        match self { Self::Actor(a) => a.id, Self::Bomb(p) => p.id }
    }
}
fn ordered_bodies<'a>(s: &'a Snapshot, corpses: &'a Corpses) -> Vec<Body<'a>> {
    let mut bodies: Vec<_> = ordered_actors(s, corpses).into_iter().map(Body::Actor)
        .chain(s.projectiles.iter().filter(|p| p.kind == ProjectileKind::Bomb).map(Body::Bomb))
        .collect();
    // Keep corpses below standing actors/bombs. Airborne height never changes depth.
    bodies.sort_by(|a, b| b.ground().cmp(&a.ground())
        .then(a.y().total_cmp(&b.y())).then(a.id().cmp(&b.id())));
    bodies
}
fn actor_opacity(a: &ActorView, clip: Option<&crate::assets::Clip>) -> f32 {
    if a.archetype == Archetype::Marid && a.hp > 0. && a.teleport_steps > 0 {
        match a.teleport_steps {
            43..=60 => (a.teleport_steps - 42) as f32 / 18.,
            1..=18 => 1. - a.teleport_steps as f32 / 18.,
            _ => 0.,
        }
    } else if a.state == ActorState::Dead && is_boss(a.archetype) {
        // The boss body lies still; the scene fade takes it away.
        1.
    } else if a.state == ActorState::Dead {
        let duration = clip
            .map(|c| clips::duration(&c.frames) / 1000.)
            .unwrap_or(0.4);
        (1. - (a.state_age - duration).max(0.) / CORPSE_FADE).clamp(0., 1.)
    } else if a.state == ActorState::Spawn {
        (a.state_age / 0.22).clamp(0., 1.)
    } else {
        1.
    }
}
/// Global passes include background and spotlight actors before advancing to the next team.
pub const BAR_PASSES: [Team; 2] = [Team::Enemy, Team::Hero];
pub(super) fn enemy_bar_bounds(foot: Vec2, zoom: f32, body_scale: f32) -> Rect {
    let anchor = super::groove::bar_anchor(foot, zoom, body_scale);
    Rect::new(anchor.x - super::groove::BAR_WIDTH / 2., anchor.y, super::groove::BAR_WIDTH, 1.5)
}
/// World bars draw above bodies, with every enemy pass before every hero pass.
pub fn bars(
    assets: &Assets,
    camera: &WorldCamera,
    s: &Snapshot,
    corpses: &Corpses,
    held: &[(ActorView, f64)],
    team: Team,
    stats: &mut DrawStats,
) {
    for a in ordered_actors(s, corpses).into_iter().filter(|a| a.team == team) {
        let p = camera.actor_foot(a);
        let art = assets.manifest.actors.get(&format!("{:?}", a.archetype));
        let pose = held
            .iter()
            .find(|(h, until)| h.id == a.id && s.time >= *until - 0.032 && s.time < *until)
            .map(|(h, _)| h)
            .unwrap_or(a);
        let clip = art.and_then(|art| art.clips.get(clips::name(pose.state)));
        let opacity = actor_opacity(a, clip);
        if opacity <= 0. { continue; }
        if a.team == Team::Hero && a.hp > 0. {
            super::groove::bars(a, p, camera.zoom, opacity, stats);
        }
        if a.team == Team::Enemy && !is_boss(a.archetype) && a.hp > 0. && a.hp < a.max_hp {
            let width = super::groove::BAR_WIDTH;
            let bounds = enemy_bar_bounds(p, camera.zoom, a.scale);
            super::hud::bar(
                bounds.x,
                bounds.y,
                width,
                1.5,
                a.hp / a.max_hp,
                Color::new(1., 0.3, 0.4, opacity),
            );
            stats.calls += 2;
        }
    }
}
pub fn draw(
    assets: &Assets,
    camera: &WorldCamera,
    s: &Snapshot,
    corpses: &Corpses,
    held: &[(ActorView, f64)],
    projectiles: &super::projectiles::Projectiles,
    cast_glows: &super::groove::CastGlows,
    heal_auras: &super::healing::TargetAuras,
    shell: &super::enemy_status::WarcryShell,
    elevate: super::elevate::Elevate,
    poison: &super::poison::PoisonTint,
    cast_hue: &super::cast_hue::CastHue,
    mut chest: Option<(f32, &dyn Fn(&mut DrawStats))>,
    stats: &mut DrawStats,
) {
    for body in ordered_bodies(s, corpses) {
        // Owner: a hero behind the chest is hidden by it; one in front covers it.
        if let Some((_, draw_chest)) = chest.take_if(|(y, _)| !body.ground() && body.y() > *y) {
            draw_chest(stats);
        }
        let a = match body {
            Body::Actor(a) => a,
            Body::Bomb(p) => { projectiles.draw_bomb(assets, camera, s, p, stats); continue; }
        };
        let p = camera.actor_foot(a);
        let art = assets.manifest.actors.get(&format!("{:?}", a.archetype));
        let pose = held
            .iter()
            .find(|(h, until)| h.id == a.id && s.time >= *until - 0.032 && s.time < *until)
            .map(|(h, _)| h)
            .unwrap_or(a);
        let hover = a.archetype == Archetype::Marid && a.hp > 0.;
        let clip = art.and_then(|art| art.clips.get(if hover && a.state == ActorState::Walk { "idle" } else if cast_hue.posing(a) { "cast" } else { clips::name(pose.state) }));
        let opacity = actor_opacity(a, clip);
        // Reuse painted portal shimmer and particles at each endpoint. Transit draws nothing.
        if a.archetype == Archetype::Marid && a.hp > 0. {
            if let Some(progress) = match a.teleport_steps {
                43..=60 => Some((60 - a.teleport_steps) as f32 / 18.),
                1..=18 => Some((18 - a.teleport_steps) as f32 / 18.),
                _ => None,
            } {
                let tint = Color::new(0.55, 0.85, 1., ((progress * std::f32::consts::PI).sin() * 1.5).min(1.));
                assets.vfx_once("support-cast-pulse", progress as f64 * 0.6,
                    p, vec2(62., 46.5) * camera.zoom / 0.5, 0., tint, stats);
                assets.vfx_once("heal-glint", progress as f64 * 0.6,
                    p - vec2(0., 7.) * camera.zoom / 0.5,
                    vec2(48., 64.) * camera.zoom / 0.5, 0., tint, stats);
            }
        }
        if opacity <= 0. {
            continue;
        }
        // Mirewing's root-parented shadow is already painted into every clip.
        if a.archetype != Archetype::Mirewing && !assets.decal(
            "shadow",
            p,
            vec2(31., 12.) * visual_scale(a) * camera.zoom / 0.5,
            0.,
            Color::new(0.08, 0.07, 0.06, 0.65 * opacity),
            stats,
        ) {
            draw_ellipse(
                p.x,
                p.y,
                13. * visual_scale(a),
                4. * visual_scale(a),
                0.,
                Color::new(0., 0., 0., 0.3 * opacity),
            );
            stats.calls += 1;
        }
        if a.team == Team::Hero {
            draw_ellipse_lines(
                p.x,
                p.y,
                15. * camera.zoom / 0.5,
                5. * camera.zoom / 0.5,
                0.,
                0.8,
                Color::new(0.35, 0.78, 1., 0.25 * opacity),
            );
            stats.calls += 1;
        }
        let cast = if a.team == Team::Hero && a.hp > 0. { cast_glows.level(a.id) } else { 0. };
        let ward = ward_strength(a);
        let strength = cast + ward * (1. - cast);
        let palette = cast_palette(a.archetype, if strength > 0. { cast / strength } else { 0. });
        let glow = strength * opacity;
        if glow > 0. {
            ward_aura(assets, camera, p, a, s.time, glow, palette, false, 5, stats);
        }
        let heal = heal_auras.level(a.id) * opacity;
        if heal > 0. {
            ward_aura(assets, camera, p, a, s.time, heal, super::healing::TargetAuras::palette(), false, 0, stats);
        }
        super::elevate::draw(assets, camera, a, p, elevate, false, stats);
        if let (Some(art), Some(clip)) = (art, clip) {
            if let Some(frame) = clips::actor(clip, pose) {
                let flip = (art.facing == "left") != (a.facing == Facing::Left);
                // Original boss energy glow: a soft outline that brightens as his charge fills.
                if is_boss(a.archetype) && a.hp > 0. {
                    gl_use_material(&assets.additive);
                    for (radius, strength) in [(8., 0.045), (5., 0.10), (2., 0.20)] {
                        for direction in [
                            vec2(-1., 0.),
                            vec2(1., 0.),
                            vec2(0., -1.),
                            vec2(0., 1.),
                            vec2(-0.707, -0.707),
                            vec2(0.707, -0.707),
                            vec2(-0.707, 0.707),
                            vec2(0.707, 0.707),
                        ] {
                            assets.frame(
                                frame,
                                clip.foot_origin,
                                p + direction * radius * camera.zoom / 0.5,
                                visual_scale(a) * camera.zoom,
                                flip,
                                Color::new(1., 0.34, 0.06, opacity * strength * (0.03 + a.energy * a.energy)),
                                stats,
                            );
                        }
                    }
                    gl_use_default_material();
                }
                let tint = super::bubble_aura::actor_tint(a, opacity);
                // Study blend starts from the painted sprite, before the old mode multiplier.
                let tint = if cast_hue.active(a) { tint } else { groove_tint(a, tint) };
                let sprite = if hover {
                    p + vec2(0., -(6. + 2. * (s.combat_time as f32 * 3. + a.id as f32).sin()) * camera.zoom / 0.5)
                } else { p };
                cast_hue.draw(assets, camera, a, clip, frame, sprite, poison.tint(a, tint), stats);
                if glow > 0. {
                    ward_aura(assets, camera, p, a, s.time, glow, palette, true, 5, stats);
                }
                if heal > 0. {
                    ward_aura(assets, camera, p, a, s.time, heal, super::healing::TargetAuras::palette(), true, 0, stats);
                }
            }
        } else {
            stats.missing(format!("actor:{:?}/{}",a.archetype,clips::name(pose.state)));
            stats.calls += 1;
            draw_circle(
                p.x,
                p.y - 16.,
                12. * visual_scale(a),
                if a.team == Team::Hero { SKYBLUE } else { PINK },
            );
        }
        super::enemy_status::over_actor(assets, camera, a, s.time, shell, stats);
        super::elevate::draw(assets, camera, a, p, elevate, true, stats);
    }
    if let Some((_, draw_chest)) = chest {
        draw_chest(stats);
    }
}

#[cfg(test)]
mod scene_tests {
    use super::*;
    #[test]
    fn enemy_bars_share_hero_foot_anchor_scaled_by_body_and_zoom() {
        let foot = vec2(100., 200.);
        for zoom in [0.5, 0.8] {
            let enemy = enemy_bar_bounds(foot, zoom, 1.);
            let hero = super::super::groove::bar_rects(foot, zoom).0;
            assert_eq!(enemy.y, hero.y);
            assert!(enemy.y > foot.y);
            assert_eq!(enemy.w, 17.);
            assert_eq!(enemy.h, 1.5);
            for scale in [0.6, 1., 2.2] {
                let large = enemy_bar_bounds(foot, zoom, scale);
                assert!((large.y - foot.y - (hero.y - foot.y) * scale).abs() < 0.0001);
            }
        }
    }
    #[test]
    fn enemy_bar_pass_precedes_hero_bar_pass() {
        assert_eq!(BAR_PASSES, [Team::Enemy, Team::Hero]);
    }
    fn sorted_ids(s: &Snapshot, corpses: &Corpses) -> Vec<u32> {
        ordered_actors(s, corpses).iter().map(|a| a.id).collect()
    }
    fn bomb_scene(archetype: Archetype) -> Snapshot {
        let mut s = crate::testing::sim().snapshot().clone();
        s.actors.truncate(1);
        s.actors[0].archetype = archetype;
        s.actors[0].team = if archetype == Archetype::Fara { Team::Hero } else { Team::Enemy };
        s.actors[0].pos.y = 100.;
        s.projectiles = vec![ProjectileView { id: 900, kind: ProjectileKind::Bomb,
            team: Team::Enemy, pos: wf_combat::Vec2::new(s.actors[0].pos.x, 99.),
            dir: wf_combat::Vec2::new(0., 1.), height: 0. }];
        s
    }
    fn body_ids(s: &Snapshot, corpses: &Corpses) -> Vec<u32> {
        ordered_bodies(s, corpses).iter().map(Body::id).collect()
    }
    #[test]
    fn bomb_behind_boss_hero_or_minion_draws_before_body() {
        for kind in [Archetype::BossBomber, Archetype::Fara, Archetype::Gobloc] {
            let s = bomb_scene(kind);
            assert_eq!(body_ids(&s, &Corpses::default()), vec![900, s.actors[0].id], "{kind:?}");
        }
    }
    #[test]
    fn bomb_in_front_of_boss_hero_or_minion_draws_after_body() {
        for kind in [Archetype::BossBomber, Archetype::Fara, Archetype::Gobloc] {
            let mut s = bomb_scene(kind);
            s.projectiles[0].pos.y = 101.;
            assert_eq!(body_ids(&s, &Corpses::default()), vec![s.actors[0].id, 900], "{kind:?}");
        }
    }
    #[test]
    fn airborne_bomb_depth_uses_ground_y_at_every_arc_height() {
        let mut s = bomb_scene(Archetype::BossBomber);
        for height in [0., 0.5, 20., 200.] {
            s.projectiles[0].height = height;
            s.projectiles[0].pos.y = 99.;
            assert_eq!(body_ids(&s, &Corpses::default()), vec![900, s.actors[0].id]);
            s.projectiles[0].pos.y = 101.;
            assert_eq!(body_ids(&s, &Corpses::default()), vec![s.actors[0].id, 900]);
        }
    }
    #[test]
    fn bomb_depth_preserves_corpse_layer_actor_ties_and_excludes_other_projectiles() {
        let mut s = bomb_scene(Archetype::Fara);
        s.projectiles[0].pos.y = 100.;
        let mut other = s.projectiles[0].clone();
        other.id = 901; other.kind = ProjectileKind::Orb;
        s.projectiles.push(other);
        let mut actor = s.actors[0].clone();
        actor.id = 800;
        s.actors.push(actor.clone());
        actor.id = 999; actor.pos.y = 500.; actor.state = ActorState::Dead; actor.hp = 0.;
        let corpses = Corpses { bodies: vec![(actor, s.time)] };
        assert_eq!(body_ids(&s, &corpses), vec![999, s.actors[0].id, 800, 900]);
        // Lingering spotlight packages retain projectiles even when standing actors are omitted.
        s.actors.clear();
        assert_eq!(body_ids(&s, &Corpses::default()), vec![900]);
    }
    #[test]
    fn living_hero_draws_above_a_lower_enemy_corpse() {
        let mut s = crate::testing::sim().snapshot().clone();
        s.actors.truncate(1);
        s.actors[0].pos.y = 100.;
        let mut body = s.actors[0].clone();
        body.id = 999; body.team = Team::Enemy; body.archetype = Archetype::Gobloc;
        body.state = ActorState::Dead; body.pos.y = 200.;
        let corpses = Corpses { bodies: vec![(body, s.time)] };
        assert_eq!(sorted_ids(&s, &corpses), vec![999, s.actors[0].id]);
    }
    #[test]
    fn ground_bodies_keep_y_order_and_id_ties() {
        let mut s = crate::testing::sim().snapshot().clone();
        s.actors.truncate(3);
        let mut corpses = Corpses::default();
        for (a, y) in s.actors.iter_mut().zip([200., 100., 100.]) {
            a.state = ActorState::Dead; a.hp = 0.; a.pos.y = y;
            a.team = Team::Enemy; a.archetype = Archetype::Gobloc;
            corpses.bodies.push((a.clone(), s.time));
        }
        let expected = vec![s.actors[1].id, s.actors[2].id, s.actors[0].id];
        s.actors.clear();
        assert_eq!(sorted_ids(&s, &corpses), expected);
    }
    #[test]
    fn downed_hero_draws_below_standing_actors() {
        let mut s = crate::testing::sim().snapshot().clone();
        s.actors.truncate(2);
        s.actors[0].pos.y = 100.;
        s.actors[1].state = ActorState::Downed; s.actors[1].hp = 0.; s.actors[1].pos.y = 200.;
        assert_eq!(sorted_ids(&s, &Corpses::default()), vec![s.actors[1].id, s.actors[0].id]);
    }
    #[test]
    fn standing_actors_keep_y_order_and_id_ties() {
        let mut s = crate::testing::sim().snapshot().clone();
        for (a, y) in s.actors.iter_mut().zip([200., 100., 100., 300.]) { a.pos.y = y; }
        s.actors[2].team = Team::Enemy;
        assert_eq!(sorted_ids(&s, &Corpses::default()), vec![s.actors[1].id, s.actors[2].id, s.actors[0].id, s.actors[3].id]);
    }
    #[test]
    fn ground_pound_uses_painted_shell_without_procedural_ward_glow() {
        let mut a=crate::testing::sim().snapshot().actors[0].clone();
        a.ward=a.max_hp*0.3;
        assert!(ward_strength(&a)>0.);
        a.warcry_shield=true;
        assert_eq!(ward_strength(&a),0.);
        a.archetype=Archetype::Hondo;a.warcry_shield=false;
        assert!(ward_strength(&a)>0.);
    }
    #[test]
    fn warcry_uses_painted_shell_without_procedural_ward_glow() {
        let mut a=crate::testing::sim().snapshot().actors[0].clone();
        a.ward=a.max_hp*0.3;
        assert!(ward_strength(&a)>0.);
        a.warcry_shield=true;
        assert_eq!(ward_strength(&a),0.);
        a.archetype=Archetype::Hondo;a.warcry_shield=false;
        assert!(ward_strength(&a)>0.);
    }
    #[test]
    fn cast_colour_returns_smoothly_to_a_remaining_self_ward() {
        let gold=cast_palette(Archetype::Runa,1.);let middle=cast_palette(Archetype::Runa,0.5);
        let ward=cast_palette(Archetype::Runa,0.);
        assert_eq!(gold,aura_palette(Archetype::Runa));
        assert_eq!(gold[0],Color::new(1.,0.62,0.08,1.));
        assert_eq!(aura_palette(Archetype::Hondo),ward);assert_eq!(ward,aura_palette(Archetype::Fara));
        assert!((middle[0].g-(gold[0].g+ward[0].g)*0.5).abs()<0.00001);
    }
    #[test]
    fn legacy_mode_tint_keeps_combo_hondo_and_elevate_returns_to_painted_sprite() {
        let mut a=crate::testing::sim().snapshot().actors[1].clone();
        a.archetype=Archetype::Hondo;a.groove=Some(Groove::Combo);a.groove_active=1.;
        let gold=groove_tint(&a,WHITE);assert_eq!(gold.r,1.);assert!(gold.b<gold.g);
        a.groove_active=0.;assert_eq!(groove_tint(&a,WHITE),WHITE);
        a.archetype=Archetype::Kaja;a.groove=Some(Groove::Power);a.groove_active=8.;
        assert_eq!(groove_tint(&a,WHITE),WHITE);
        a.hp=0.;assert_eq!(groove_tint(&a,WHITE),WHITE);
        assert!(aura_palette(Archetype::Fara)[0].r>aura_palette(Archetype::Fara)[0].b);
        assert!(aura_palette(Archetype::Runa)[0].r>aura_palette(Archetype::Runa)[0].b);
    }
    #[test]
    fn echo_eases_out_fades_and_scales_about_body_midpoint() {
        let p=EchoParams { scale_from:1., tint:WHITE,scale_to:1.55,stretch:1.1,alpha:0.8 };
        let (start,a)=echo_curve(0.,p);assert_eq!(start,Vec2::ONE);assert_eq!(a,0.8);
        let (mid,a)=echo_curve(0.5,p);assert!(mid.x>1.275&&mid.x<1.55);assert!(a>0.&&a<0.8);
        let (end,a)=echo_curve(1.,p);assert!((end.x-1.55).abs()<0.001);assert_eq!(a,0.);
        let r=echo_rect(vec2(20.,100.),40.,vec2(10.,60.),vec2(20.,40.),vec2(1.5,1.65));
        assert_eq!(r,Rect::new(5.,47.,30.,66.));assert_eq!(vec2(r.x+r.w/2.,r.y+r.h/2.),vec2(20.,80.));
    }
    #[test]
    fn combo_corpse_moves_once_with_its_ko_age_and_pauses_through_charge() {
        let s=crate::testing::sim().snapshot().clone();
        let mut victim=s.actors[0].clone();victim.id=999;victim.team=Team::Enemy;victim.archetype=wf_combat::Archetype::Gobloc;
        victim.state=ActorState::Dead;victim.state_age=0.1;
        let mut other=victim.clone();other.id=998;
        let mut bg=Corpses{bodies:vec![(victim,1.),(other,1.)]};let mut fg=Corpses::default();
        let v=wf_combat::SpotlightView{caster:s.actors[0].id,skill:wf_combat::Skill::BubblePop,phase:wf_combat::SpotlightPhase::Charge,
            started:20.,participants:vec![999],co_casters:vec![],hazards:vec![],projectiles:vec![]};
        fg.take_combo(&mut bg,&v,19.);assert_eq!(bg.bodies[0].0.id,998);assert_eq!(fg.bodies[0].0.id,999);
        assert_eq!(fg.bodies[0].1,20.);assert_eq!(fg.bodies[0].0.state_age,0.1);
        fg.pause(1.2);let mut live=s.clone();live.time=21.3;
        let m=crate::assets::Manifest{pages:vec![],actors:Default::default(),arenas:vec![]};fg.update(&m,&live);
        assert!((fg.bodies[0].0.state_age-0.1).abs()<0.0001);assert!(fg.busy(&m,live.time));
        fg.take_combo(&mut bg,&v,19.);assert_eq!(fg.bodies.len(),1,"handoff cannot duplicate a body");
    }
    #[test]
    fn wipe_cleanup_never_makes_boss_corpse_and_reset_discards_old_deaths() {
        let mut s = crate::testing::sim()
            .snapshot()
            .clone();
        let mut boss = s.actors[0].clone();
        boss.id = 999;
        boss.team = Team::Enemy;
        boss.archetype = Archetype::BossBomber;
        let mut orc = boss.clone();
        orc.id = 998;
        orc.archetype = Archetype::Orc;
        s.actors.push(boss);
        let previous = s.clone();
        let mut corpses = Corpses::default();
        // The felled boss is drawn from the sim during the victory hold, never as a corpse copy.
        corpses.ingest(&[Event::Died { id: 999 }], &s, &previous);
        assert!(corpses.bodies.is_empty());
        s.actors.push(orc);
        let previous = s.clone();
        corpses.ingest(&[Event::Died { id: 998 }], &s, &previous);
        assert_eq!(corpses.bodies.len(), 1);
        corpses.ingest(&[Event::Died { id: 998 }, Event::SceneReset], &s, &previous);
        assert!(corpses.bodies.is_empty());
        for a in &mut s.actors {
            if a.team == Team::Hero {
                a.hp = 0.;
            }
        }
        corpses.ingest(&[Event::Died { id: 998 }], &s, &previous);
        assert!(corpses.bodies.is_empty());
    }
}

#[cfg(test)]
mod teleport_tests {
    use super::*;
    #[test]
    fn marid_opacity_has_departure_transit_and_arrival() {
        let mut a = crate::testing::sim().snapshot().actors[0].clone();
        a.archetype = Archetype::Marid;
        for (steps, alpha) in [(60,1.),(51,0.5),(42,0.),(30,0.),(18,0.),(9,0.5),(0,1.)] {
            a.teleport_steps = steps;
            assert!((actor_opacity(&a, None) - alpha).abs() < 0.001);
        }
    }
}
