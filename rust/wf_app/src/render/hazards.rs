//! Exact simulation footprints, textured source-out fill, then every exposed boundary.
use crate::{
    assets::{Assets, DrawStats},
    camera::{WorldCamera, SQUASH},
};
use macroquad::prelude::*;
use wf_combat::api::{HazardKind, HazardPhase, HazardView, Shape, Snapshot, Team};
fn vertex(p: Vec2, uv: Vec2, c: Color) -> Vertex {
    Vertex::new(p.x, p.y, 0., uv.x, uv.y, c)
}
fn submit(
    assets: &Assets,
    id: &str,
    vertices: Vec<Vertex>,
    indices: Vec<u16>,
    stats: &mut DrawStats,
) {
    let Some(a) = assets.vfx.get(id) else {
        stats.missing(format!("vfx:{id}"));
        return;
    };
    draw_mesh(&Mesh {
        vertices,
        indices,
        texture: Some(a.texture.clone()),
    });
    stats.calls += 1;
}
fn segments(radius: f32) -> usize {
    // <= 1 logical pixel chord error, with an upper bound for large boss circles.
    (std::f32::consts::PI / (1. - 1. / radius.max(2.)).acos())
        .ceil()
        .clamp(12., 128.) as usize
}
fn points(camera: &WorldCamera, h: &HazardView, progress: f32) -> Vec<Vec2> {
    let p = camera.project(h.origin);
    let z = camera.zoom;
    let project = |v: Vec2| p + vec2(v.x, v.y * SQUASH) * z;
    let dir = vec2(h.dir.x, h.dir.y).normalize_or_zero();
    match h.shape {
        Shape::Circle { radius } => {
            let r = radius * progress;
            let n = segments(r * z);
            (0..n)
                .map(|i| {
                    let a = i as f32 / n as f32 * std::f32::consts::TAU;
                    project(vec2(a.cos(), a.sin()) * r)
                })
                .collect()
        }
        Shape::Cone {
            length,
            half_angle_rad,
        } => {
            let n = segments(length * z).max(16);
            let side = vec2(-dir.y, dir.x);
            let mut v = vec![p];
            v.extend((0..=n).map(|i| {
                let a = (2. * i as f32 / n as f32 - 1.) * half_angle_rad;
                project((dir * a.cos() + side * a.sin()) * length * progress)
            }));
            v
        }
        Shape::Line { length, width } => {
            let width = if h.kind == HazardKind::BossCharge {
                width
            } else {
                width * h.width_scale.clamp(1. / 3., 1.)
            };
            let side = vec2(-dir.y, dir.x) * width * 0.5;
            [
                -side,
                dir * length * progress - side,
                dir * length * progress + side,
                side,
            ]
            .into_iter()
            .map(project)
            .collect()
        }
        Shape::Ring { .. } => Vec::new(),
    }
}
fn fill(
    assets: &Assets,
    camera: &WorldCamera,
    h: &HazardView,
    p: f32,
    c: Color,
    stats: &mut DrawStats,
) {
    if p <= 0. || c.a <= 0. {
        return;
    }
    if let Shape::Ring { inner, outer } = h.shape {
        let outer = inner + (outer - inner) * p;
        let n = segments(outer * camera.zoom);
        let mut vertices = Vec::new();
        let mut indices = Vec::new();
        let centre = camera.project(h.origin);
        for i in 0..=n {
            let a = i as f32 / n as f32 * std::f32::consts::TAU;
            let d = vec2(a.cos(), a.sin());
            for r in [inner, outer] {
                let q = centre + vec2(d.x, d.y * SQUASH) * r * camera.zoom;
                vertices.push(vertex(q, vec2(0.5, 0.5) + d * 0.08, c));
            }
            if i < n {
                let b = (i * 2) as u16;
                indices.extend([b, b + 1, b + 2, b + 1, b + 3, b + 2]);
            }
        }
        submit(assets, "telegraph-fill", vertices, indices, stats);
        return;
    }
    let shape = points(camera, h, p);
    if shape.len() < 3 {
        return;
    }
    // Sample the occupied center of the authored mask; geometry owns the exact footprint.
    // This avoids stretching the mask's circular alpha boundary into a cone or rectangle.
    let centre = shape.iter().copied().sum::<Vec2>() / shape.len() as f32;
    let span = shape.iter().map(|v| v.distance(centre)).fold(1., f32::max);
    let mut vertices = vec![vertex(centre, vec2(0.5, 0.5), c)];
    let mut indices = Vec::new();
    for (i, q) in shape.iter().enumerate() {
        vertices.push(vertex(*q, vec2(0.5, 0.5) + (*q - centre) / span * 0.12, c));
        indices.extend([0, (i + 1) as u16, ((i + 1) % shape.len() + 1) as u16]);
    }
    submit(assets, "telegraph-fill", vertices, indices, stats);
}
/// Original charge-lane arrows: chevrons every 70 world units pointing along the charge.
fn chevrons(
    camera: &WorldCamera,
    p: Vec2,
    dir: Vec2,
    length: f32,
    width: f32,
    c: Color,
    stats: &mut DrawStats,
) {
    let projected = |offset: Vec2| p + vec2(offset.x, offset.y * SQUASH) * camera.zoom;
    let side = vec2(-dir.y, dir.x);
    let size = (width * 0.25).min(18.);
    for i in 1..=(length / 70.) as usize {
        let tip = dir * (i as f32 * 70.);
        let a = projected(tip - dir * size - side * size);
        let b = projected(tip);
        let d = projected(tip - dir * size + side * size);
        draw_line(a.x, a.y, b.x, b.y, 1.2, c);
        draw_line(b.x, b.y, d.x, d.y, 1.2, c);
        stats.calls += 2;
    }
}
/// A single textured strip mesh, with normals measured after ground projection.
pub fn boundary(
    assets: &Assets,
    points: &[Vec2],
    closed: bool,
    width: f32,
    c: Color,
    stats: &mut DrawStats,
) {
    let Some(art) = assets.vfx.get("telegraph-edge") else {
        stats.missing("vfx:telegraph-edge");
        return;
    };
    if points.len() < 2 {
        return;
    }
    let mut vertices = Vec::new();
    let mut indices = Vec::new();
    let b = art.bounds;
    let tw = art.texture.width();
    let th = art.texture.height();
    let uv0 = vec2(b.x / tw, b.y / th);
    let uv1 = vec2((b.x + b.w) / tw, (b.y + b.h) / th);
    let count = if closed {
        points.len()
    } else {
        points.len() - 1
    };
    for i in 0..count {
        let a = points[i];
        let b = points[(i + 1) % points.len()];
        let d = (b - a).normalize_or_zero();
        let normal = vec2(-d.y, d.x) * width * 0.5;
        let base = vertices.len() as u16;
        vertices.extend([
            vertex(a - normal, uv0, c),
            vertex(b - normal, vec2(uv1.x, uv0.y), c),
            vertex(b + normal, uv1, c),
            vertex(a + normal, vec2(uv0.x, uv1.y), c),
        ]);
        indices.extend([base, base + 1, base + 2, base, base + 2, base + 3]);
    }
    submit(assets, "telegraph-edge", vertices, indices, stats);
}
fn eligible(h: &HazardView) -> bool {
    h.hostile
        && h.team == Team::Enemy
        && !matches!(
            h.kind,
            HazardKind::SpawnMarker
                | HazardKind::KajaAura
                | HazardKind::BubbleAura
                | HazardKind::GroundPound
                | HazardKind::ArcanePulse
                | HazardKind::FazePool
                | HazardKind::HealingSpring
                | HazardKind::Resurrect
        )
        // Owner: sniper lines keep their original (pre-r12) look; drawn by `sniper_line`.
        && !matches!(h.kind, HazardKind::SniperLine | HazardKind::BossSnipe)
        && h.phase != HazardPhase::Resolved
}
fn pulse(h: &HazardView, s: &Snapshot, previous: &Snapshot) -> f32 {
    if h.phase != HazardPhase::Locked {
        return 0.;
    }
    let Some(old) = previous
        .hazards
        .iter()
        .find(|old| old.id == h.id && old.phase == h.phase)
    else {
        return 0.;
    };
    let delta = s.time - previous.time;
    if delta <= 0. || h.progress <= old.progress {
        return 0.;
    }
    let rate = (h.progress - old.progress) / delta as f32;
    let remaining = (1. - h.progress) / rate;
    if remaining > 0.15 {
        return 0.;
    }
    (std::f32::consts::PI * (1. - remaining / 0.15).clamp(0., 1.)).sin()
}
pub fn draw(
    assets: &Assets,
    camera: &WorldCamera,
    s: &Snapshot,
    previous: &Snapshot,
    flashes: &[(&HazardView, f32)],
    cancellations: &[(&HazardView, f32)],
    stats: &mut DrawStats,
) {
    let density = ((screen_width() / crate::camera::WIDTH)
        .min(screen_height() / crate::camera::HEIGHT)
        * screen_dpi_scale())
    .clamp(1., 4.);
    let lo = camera.project(s.arena_min);
    let hi = camera.project(s.arena_max);
    unsafe {
        get_internal_gl().quad_gl.scissor(Some((
            (lo.x.max(0.) * density).floor() as i32,
            (lo.y.max(0.) * density).floor() as i32,
            ((hi.x.min(360.) - lo.x.max(0.)).max(0.) * density).ceil() as i32,
            ((hi.y.min(640.) - lo.y.max(0.)).max(0.) * density).ceil() as i32,
        )));
    }
    let mut live: Vec<_> = s.hazards.iter().filter(|h| eligible(h)).collect();
    live.sort_by_key(|h| h.id);
    for h in &live {
        let p = pulse(h, s, previous);
        let c = Color::from_rgba(255, 55, 75, 255);
        fill(
            assets,
            camera,
            h,
            1.,
            Color::new(c.r, c.g, c.b, 0.12),
            stats,
        );
        if h.phase != HazardPhase::Tracking {
            fill(
                assets,
                camera,
                h,
                h.progress.clamp(0., 1.),
                Color::new(c.r, c.g, c.b, 0.34 + 0.05 * p),
                stats,
            );
        }
    }
    // Only real enemy telegraphs get the red resolution flash. Friendly/neutral zones (Ward,
    // Elevate, Bubble Pop, Arcane Pulse, Faze, resurrect, spawn markers) ending must never flash hostile red.
    let flashes: Vec<(&HazardView, f32)> = flashes
        .iter()
        .copied()
        .filter(|(h, _)| {
            h.hostile
                && h.team == Team::Enemy
                && !matches!(
                    h.kind,
                    HazardKind::SpawnMarker
                        | HazardKind::KajaAura
                        | HazardKind::BubbleAura
                        | HazardKind::GroundPound
                        | HazardKind::ArcanePulse
                        | HazardKind::FazePool
                        | HazardKind::HealingSpring
                        | HazardKind::Resurrect
                        | HazardKind::SniperLine
                        | HazardKind::BossSnipe
                )
        })
        .collect();
    for (h, opacity) in &flashes {
        let (h, opacity) = (*h, *opacity);
        // Resolution is fully filled even when the final Locked snapshot sampled below one.
        fill(
            assets,
            camera,
            h,
            1.,
            Color::new(1., 55. / 255., 75. / 255., 0.18 * opacity),
            stats,
        );
    }
    // All boundaries follow all fills, in stable id order.
    let mut boundaries: Vec<_> = live
        .into_iter()
        .map(|h| (h, 1.))
        .chain(flashes.iter().copied())
        .collect();
    boundaries.sort_by_key(|(h, _)| h.id);
    for (h, opacity) in boundaries {
        let p = pulse(h, s, previous);
        let c = Color::new(
            1.,
            (55. + 90. * p) / 255.,
            (75. + 75. * p) / 255.,
            if h.phase == HazardPhase::Resolved {
                0.18 * opacity
            } else {
                0.9
            },
        );
        if let Shape::Ring { inner, outer } = h.shape {
            // Both safe-center and outside edges share one submission.
            let mut contours = Vec::new();
            for r in [inner, outer] {
                let n = segments(r * camera.zoom);
                let centre = camera.project(h.origin);
                contours.push(
                    (0..n)
                        .map(|i| {
                            let a = i as f32 / n as f32 * std::f32::consts::TAU;
                            centre + vec2(a.cos(), a.sin() * SQUASH) * r * camera.zoom
                        })
                        .collect::<Vec<_>>(),
                );
            }
            for contour in contours {
                boundary(assets, &contour, true, 1.5 * camera.zoom / 0.5, c, stats);
            }
        } else {
            boundary(
                assets,
                &points(camera, h, 1.),
                true,
                1.5 * camera.zoom / 0.5,
                c,
                stats,
            );
        }
    }
    // Owner: restore the original boss-charge direction chevrons (removed in 831b967b).
    for h in s
        .hazards
        .iter()
        .filter(|h| h.kind == HazardKind::BossCharge && h.phase != HazardPhase::Resolved)
    {
        if let Shape::Line { length, width } = h.shape {
            let p = pulse(h, s, previous);
            let c = Color::new(1., (55. + 90. * p) / 255., (75. + 75. * p) / 255., 0.5);
            let dir = vec2(h.dir.x, h.dir.y).normalize_or_zero();
            chevrons(camera, camera.project(h.origin), dir, length, width, c, stats);
        }
    }
    for h in s.hazards.iter().filter(|h| {
        matches!(h.kind, HazardKind::SniperLine | HazardKind::BossSnipe)
            && matches!(h.phase, HazardPhase::Tracking | HazardPhase::Locked)
    }) {
        let enraged = s
            .actors
            .iter()
            .chain(previous.actors.iter())
            .find(|a| a.id == h.owner)
            .is_some_and(|a| a.enraged);
        sniper_line(camera, h, pulse(h, s, previous), enraged, stats);
    }
    for (hazard,t) in cancellations {draw_cancelled(assets,camera,hazard,*t,stats);}
    unsafe {
        get_internal_gl().quad_gl.scissor(None);
    }
}
/// Clip an existing footprint away from its source. This preserves the far edge while the
/// boss-side portion disappears, rather than sliding the warning along with the boss.
fn clip_from_source(polygon:&[Vec2],origin:Vec2,axis:Vec2,cut:f32)->Vec<Vec2> {
    let mut out=Vec::new();
    for i in 0..polygon.len() {
        let a=polygon[i];let b=polygon[(i+1)%polygon.len()];
        let da=(a-origin).dot(axis)-cut;let db=(b-origin).dot(axis)-cut;
        if da>=0. {out.push(a);}
        if (da>=0.)!=(db>=0.) {out.push(a+(b-a)*(da/(da-db)));}
    }
    out
}
fn cancelled_polygon(camera:&WorldCamera,h:&HazardView,progress:f32,t:f32)->Vec<Vec2> {
    let polygon=points(camera,h,progress);
    let origin=camera.project(h.origin);let axis=vec2(h.dir.x,h.dir.y*SQUASH).normalize_or_zero();
    let far=points(camera,h,1.).iter().map(|p|(*p-origin).dot(axis)).fold(0.,f32::max);
    clip_from_source(&polygon,origin,axis,far*t)
}
fn polygon_fill(assets:&Assets,polygon:&[Vec2],c:Color,stats:&mut DrawStats) {
    if polygon.len()<3 {return;}
    let centre=polygon.iter().copied().sum::<Vec2>()/polygon.len() as f32;
    let mut vertices=vec![vertex(centre,vec2(0.5,0.5),c)];let mut indices=Vec::new();
    for (i,p) in polygon.iter().enumerate() {
        vertices.push(vertex(*p,vec2(0.5,0.5),c));
        indices.extend([0,(i+1) as u16,((i+1)%polygon.len()+1) as u16]);
    }
    submit(assets,"telegraph-fill",vertices,indices,stats);
}
fn draw_cancelled(assets:&Assets,camera:&WorldCamera,h:&HazardView,t:f32,stats:&mut DrawStats) {
    if !(0. ..1.).contains(&t) {return;}
    let alpha=(1.-t).powi(2);let colour=|a|Color::new(1.,55./255.,75./255.,a*alpha);
    match h.shape {
        Shape::Circle{radius}|Shape::Ring{outer:radius,..} => {
            let inner=match h.shape {Shape::Ring{inner,..}=>inner,_=>0.};
            let cut=inner+(radius-inner)*t;let mut shell=h.clone();shell.shape=Shape::Ring{inner:cut,outer:radius};
            fill(assets,camera,&shell,1.,colour(0.12),stats);
            let occupied=inner+(radius-inner)*h.progress.clamp(0.,1.);
            if h.phase!=HazardPhase::Tracking && occupied>cut {shell.shape=Shape::Ring{inner:cut,outer:occupied};fill(assets,camera,&shell,1.,colour(0.34),stats);}
            let mut rim=h.clone();rim.shape=Shape::Circle{radius};
            boundary(assets,&points(camera,&rim,1.),true,1.5*camera.zoom/0.5,colour(0.9),stats);
        }
        _=>{
            let outline=cancelled_polygon(camera,h,1.,t);
            polygon_fill(assets,&outline,colour(0.12),stats);
            if h.phase!=HazardPhase::Tracking {polygon_fill(assets,&cancelled_polygon(camera,h,h.progress,t),colour(0.34),stats);}
            boundary(assets,&outline,true,1.5*camera.zoom/0.5,colour(0.9),stats);
        }
    }
}
/// Original sniper telegraph: thin tracking line, then a lane that widens and fills from the
/// sniper to the far wall; the release streak and bolt are drawn with projectiles.
fn sniper_line(camera: &WorldCamera, h: &HazardView, pulse: f32, enraged: bool, stats: &mut DrawStats) {
    let Shape::Line { length, width } = h.shape else {
        return;
    };
    let zoom = camera.zoom;
    let p = camera.project(h.origin);
    let dir = vec2(h.dir.x, h.dir.y).normalize_or_zero();
    let at = |o: Vec2| p + vec2(o.x, o.y * SQUASH) * zoom;
    let base = Color::from_rgba(255, 65, 82, 255);
    let c = Color::new(
        base.r + (1. - base.r) * pulse * 0.6,
        base.g + (1. - base.g) * pulse * 0.6,
        base.b + (1. - base.b) * pulse * 0.6,
        1.,
    );
    let rim = if enraged {
        Color::new(0.82, 0.015, 0.055, 1.)
    } else {
        c
    };
    let with = |c: Color, a: f32| Color::new(c.r, c.g, c.b, c.a * a);
    if h.phase == HazardPhase::Tracking {
        let end = at(dir * length);
        draw_line(p.x, p.y, end.x, end.y, 1.2, with(c, 0.8));
        stats.calls += 1;
        return;
    }
    let width = width * h.width_scale.clamp(1. / 3., 1.);
    let side = vec2(-dir.y, dir.x) * width * 0.5;
    let quad = |len: f32, c: Color| {
        let corners = [-side, side, dir * len + side, dir * len - side].map(&at);
        draw_mesh(&Mesh {
            vertices: corners.into_iter().map(|v| vertex(v, Vec2::ZERO, c)).collect(),
            indices: vec![0, 1, 2, 0, 2, 3],
            texture: None,
        });
    };
    quad(length, with(c, 0.12));
    quad(length * h.progress.clamp(0., 1.), with(c, 0.34 + pulse * 0.14));
    let corners = [-side, side, dir * length + side, dir * length - side].map(&at);
    for i in 0..4 {
        let (a, b) = (corners[i], corners[(i + 1) % 4]);
        draw_line(a.x, a.y, b.x, b.y, 1.2, with(rim, 0.9));
    }
    stats.calls += 6;
}
pub(super) fn pool_quad(radius:f32,zoom:f32)->Vec2 {vec2(2.*radius*zoom,2.*radius*zoom*SQUASH)}
pub fn ground(assets: &Assets, camera: &WorldCamera, s: &Snapshot, stats: &mut DrawStats) {
    let z = camera.zoom / 0.5;
    for h in s.hazards.iter().filter(|h|h.kind!=HazardKind::HealingSpring) {
        let p = camera.project(h.origin);
        if h.phase == HazardPhase::Resolved {
            continue;
        }
        match h.kind {
            HazardKind::SpawnMarker => {}
            HazardKind::WardRing | HazardKind::ElevateRing => {
                let duration = if h.kind == HazardKind::WardRing {
                    5.
                } else {
                    6.
                };
                let age = (1. - h.progress) * duration;
                if h.phase == HazardPhase::Active && age < 0.3 {
                    let tint = if h.kind == HazardKind::WardRing {
                        Color::new(0.35, 0.7, 1., 1. - age / 0.3)
                    } else {
                        Color::new(0.35, 1., 0.65, 1. - age / 0.3)
                    };
                    assets.vfx_frame(
                        "support-cast-pulse",
                        ((age / 0.3) * 3.).min(2.) as usize,
                        p,
                        vec2(42., 31.5) * z,
                        0.,
                        tint,
                        stats,
                    );
                }
            }
            HazardKind::FazePool => {
                let Shape::Circle { radius } = h.shape else {
                    continue;
                };
                let age = (1. - h.progress.clamp(0., 1.)) * 5.;
                let fade = (age / 0.1).min(1.) * ((5. - age) / 0.35).clamp(0., 1.);
                assets.vfx_frame(
                    "faze-pool",
                    0,
                    p,
                    pool_quad(radius,camera.zoom),
                    0.,
                    Color::new(1., 1., 1., fade),
                    stats,
                );
                for i in 0..5 {
                    let phase = (age + i as f32 * 0.173) % (2. / 3. + 0.15 + i as f32 * 0.125);
                    let birth = age - phase;
                    if phase >= 2. / 3. || birth >= 4.3 {
                        continue;
                    }
                    let angle = i as f32 * 2.399 + 0.4;
                    let r = (0.3 + i as f32 * 0.11) * radius * camera.zoom;
                    let q = p + vec2(angle.cos() * r, angle.sin() * r * SQUASH);
                    assets.vfx_frame(
                        "faze-bubbles",
                        (phase * 12.) as usize,
                        q,
                        Vec2::splat(9. + i as f32 * 0.75) * z,
                        0.,
                        Color::new(1., 1., 1., fade),
                        stats,
                    );
                }
                for i in 0..3 {
                    let phase = (age + i as f32 * 0.37) % (1.25 + i as f32 * 0.225);
                    if phase >= 1. || age - phase >= 4. {
                        continue;
                    }
                    let angle = 0.8 + i as f32 * 2.2;
                    let r = radius * camera.zoom * 0.85;
                    let q = p + vec2(angle.cos() * r, angle.sin() * r * SQUASH);
                    assets.vfx_frame(
                        "faze-fumes",
                        (phase * 8.) as usize,
                        q,
                        vec2(14., 21.) * z,
                        0.,
                        Color::new(1., 1., 1., fade),
                        stats,
                    );
                }
            }
            _ => {}
        }
    }

}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn hostile_circles_keep_existing_warning_but_rally_aura_never_does() {
        let mut h=HazardView{id:909,kind:HazardKind::BossSlam,team:Team::Enemy,hostile:true,
            shape:Shape::Circle{radius:75.},origin:wf_combat::Vec2::new(200.,200.),dir:wf_combat::Vec2::new(1.,0.),
            fill:wf_combat::FillMode::Countdown,phase:HazardPhase::Locked,progress:0.5,width_scale:1.,owner:900,tier:1};
        assert!(eligible(&h));h.kind=HazardKind::RallyAura;h.hostile=false;assert!(!eligible(&h));
    }
    #[test]
    fn marching_stomp_reuses_the_boss_circle_footprint_and_staggered_fill() {
        let s = crate::testing::sim().snapshot().clone();
        let camera = WorldCamera::new(&s);
        for i in 0..4 {
            let mut h = HazardView { id: 900+i, kind: HazardKind::BossStompStep,
                team: Team::Enemy, hostile: true, shape: Shape::Circle { radius: 90. },
                origin: wf_combat::Vec2::new(400., 400.+i as f32*100.), dir: wf_combat::Vec2::new(0., 1.),
                fill: wf_combat::FillMode::Countdown, phase: HazardPhase::Locked,
                progress: 0.8-i as f32*0.2, width_scale: 1., owner: 999, tier: 2 };
            assert!(eligible(&h));
            let full = points(&camera, &h, 1.);
            let sweep = points(&camera, &h, h.progress);
            let centre = camera.project(h.origin);
            assert!((sweep[0].distance(centre)-full[0].distance(centre)*h.progress).abs()<0.001);
            h.kind = HazardKind::BossSlam;
            assert_eq!(full, points(&camera, &h, 1.));
            assert_eq!(sweep, points(&camera, &h, h.progress));
            h.kind = HazardKind::BossStompStep;
            h.phase = HazardPhase::Resolved;
            assert!(!eligible(&h));
        }
    }
    #[test]
    fn spring_uses_the_faze_quad_and_cannot_enter_hostile_drawing() {
        assert_eq!(pool_quad(138.,0.5),vec2(138.,103.5));
        assert_eq!(pool_quad(138.,0.8),vec2(220.8,165.6));
        let s=crate::testing::sim().snapshot().clone();
        let h=HazardView{id:900,kind:HazardKind::HealingSpring,team:Team::Enemy,hostile:true,shape:Shape::Circle{radius:138.},origin:s.actors[0].pos,dir:wf_combat::Vec2::new(1.,0.),fill:wf_combat::FillMode::Drain,phase:HazardPhase::Active,progress:1.,width_scale:1.,owner:0,tier:1};
        assert!(!eligible(&h));
        for config in [wf_combat::SpotlightConfig::OFF,wf_combat::SpotlightConfig::CONSERVATIVE,wf_combat::SpotlightConfig::DEFAULT,wf_combat::SpotlightConfig::AGGRESSIVE] {
            assert_eq!(config.skills.len(),10);assert!(!config.skills[wf_combat::Skill::HealingSpring.index()]);
        }
        assert!(!wf_combat::Skill::HealingSpring.offensive());
    }
    #[test]
    fn cancellation_wipes_from_boss_side_and_keeps_far_edge_in_place() {
        let s=crate::testing::sim().snapshot().clone();let camera=WorldCamera::new(&s);
        let mut h=HazardView{id:900,kind:HazardKind::BossCharge,team:Team::Enemy,hostile:true,shape:Shape::Line{length:300.,width:60.},origin:wf_combat::Vec2::new(500.,500.),dir:wf_combat::Vec2::new(1.,0.),fill:wf_combat::FillMode::Countdown,phase:HazardPhase::Locked,progress:0.5,width_scale:1.,owner:999,tier:1};
        for direction in [wf_combat::Vec2::new(1.,0.),wf_combat::Vec2::new(-1.,0.),wf_combat::Vec2::new(0.,1.)] {
            h.dir=direction;
            for shape in [Shape::Line{length:300.,width:60.},Shape::Cone{length:200.,half_angle_rad:0.7}] {
                h.shape=shape;let original=points(&camera,&h,1.);let origin=camera.project(h.origin);let axis=vec2(h.dir.x,h.dir.y*SQUASH).normalize();
                let far=original.iter().map(|p|(*p-origin).dot(axis)).fold(0.,f32::max);
                for t in [0.1,0.5,0.9] {
                    let clipped=cancelled_polygon(&camera,&h,1.,t);assert!(clipped.len()>=3);
                    assert!(clipped.iter().all(|p|(*p-origin).dot(axis)>=far*t-0.001));
                    let end=clipped.iter().map(|p|(*p-origin).dot(axis)).fold(0.,f32::max);assert!((end-far).abs()<0.001);
                }
            }
        }
    }
    #[test]
    fn arcane_pulse_never_uses_hostile_telegraphs_even_with_enemy_metadata() {
        let h = HazardView { id: 1, kind: HazardKind::ArcanePulse, team: Team::Enemy, hostile: true,
            shape: Shape::Circle { radius: 95. }, origin: wf_combat::Vec2::new(0., 0.), dir: wf_combat::Vec2::new(1., 0.),
            fill: wf_combat::FillMode::Countdown, phase: HazardPhase::Locked, progress: 0.5, width_scale: 1., owner: 4, tier: 1 };
        assert!(!eligible(&h));
    }
}
