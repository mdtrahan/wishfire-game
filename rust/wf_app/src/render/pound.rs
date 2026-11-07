//! Approved v4g broad brown stones, drifting gas, opaque sink and one closing thump.
use super::vfx3d::*;
use crate::{
    assets::{Assets, DrawStats},
    camera::WorldCamera,
};
use macroquad::prelude::*;
use wf_combat::api::{Event, HazardKind, HazardPhase, HazardView, Shape, Snapshot};
const RATE: f32 = 13. / 6.;
const TAIL: f64 = (2.92 - 1.30) * 6. / 13.;
struct Burst {
    hazard: HazardView,
    born: f64,
}
#[derive(Default)]
pub struct GroundPound {
    bursts: Vec<Burst>,
}
// The approved round has no anticipation camera dip.
pub fn camera_dip(_: &Snapshot) -> f32 {
    0.
}
impl GroundPound {
    pub(super) fn take_combo(&mut self, from: &mut Self, delta: f64) {
        super::spotlight::transfer(
            &mut from.bursts,
            &mut self.bursts,
            |_| true,
            |x| x.born += delta,
        );
    }
    pub(super) fn shift(&mut self, delta: f64) {
        for x in &mut self.bursts {
            x.born += delta;
        }
    }
    pub fn ingest(&mut self, events: &[Event], s: &Snapshot, previous: &Snapshot) {
        self.bursts.retain(|x| s.time - x.born < TAIL);
        for e in events {
            if let Event::HazardResolved {
                id,
                kind: HazardKind::GroundPound,
                ..
            } = e
            {
                if self.bursts.iter().any(|b| b.hazard.id == *id) {
                    continue;
                }
                if let Some(h) = s
                    .hazards
                    .iter()
                    .chain(&previous.hazards)
                    .find(|h| h.id == *id && matches!(h.shape, Shape::Line { .. }))
                {
                    self.bursts.push(Burst {
                        hazard: h.clone(),
                        born: s.time,
                    });
                }
            }
        }
    }
    pub fn busy(&self, time: f64) -> bool {
        self.bursts
            .iter()
            .any(|x| (0. ..TAIL).contains(&(time - x.born)))
    }
    pub fn records(&self) -> usize {
        self.bursts.len()
    }
    #[cfg(target_arch = "wasm32")]
    pub fn probe(&self, time: f64) -> [f32; 2] {
        self.bursts
            .iter()
            .find(|x| (0. ..TAIL).contains(&(time - x.born)))
            .map_or([0., -1.], |x| [1., (time - x.born) as f32])
    }
    pub fn shake(&self, time: f64) -> Vec2 {
        self.bursts
            .iter()
            .map(|b| closing_shake((time - b.born) as f32 - (1.75 - 1.30) / RATE))
            .fold(Vec2::ZERO, |a, b| a + b)
    }
    pub fn ground(
        &self,
        assets: &Assets,
        camera: &WorldCamera,
        s: &Snapshot,
        stats: &mut DrawStats,
    ) {
        self.draw(assets, camera, s, false, stats);
    }
    pub fn impacts(
        &self,
        assets: &Assets,
        camera: &WorldCamera,
        s: &Snapshot,
        _reduced: bool,
        stats: &mut DrawStats,
    ) {
        self.draw(assets, camera, s, true, stats);
    }
    fn draw(
        &self,
        assets: &Assets,
        camera: &WorldCamera,
        s: &Snapshot,
        front: bool,
        stats: &mut DrawStats,
    ) {
        let mut f = Frame::default();
        for h in s
            .hazards
            .iter()
            .filter(|h| h.kind == HazardKind::GroundPound && h.phase != HazardPhase::Resolved)
        {
            draw(&mut f, h, camera, h.progress * 1.3, front);
        }
        for b in &self.bursts {
            draw(
                &mut f,
                &b.hazard,
                camera,
                1.3 + (s.time - b.born) as f32 * RATE,
                front,
            );
        }
        if front {
            f.draw_masked(assets, camera, s, stats);
        } else {
            f.draw(stats);
        }
    }
}
fn closing_shake(age: f32) -> Vec2 {
    if !(0. ..0.22).contains(&age) {
        return Vec2::ZERO;
    }
    let u = age / 0.22;
    let p = (u * TAU * 2.5).sin() * (-1.6 * u).exp();
    vec2((1.5 * p / 2.).round() * 2., (6. * p / 2.).round() * 2.)
}
#[derive(Clone, Copy)]
struct Rock {
    base: Vec3,
    h: f32,
    r: f32,
    lx: f32,
    lz: f32,
    born: f32,
    end: bool,
    closing: bool,
    rotation: f32,
    study: Vec2,
}
fn draw(f: &mut Frame, h: &HazardView, camera: &WorldCamera, a: f32, front: bool) {
    let Shape::Line { length, .. } = h.shape else {
        return;
    };
    if a < 0. || a >= 2.92 {
        return;
    }
    let z = zscale(camera);
    let start = camera.project(h.origin);
    let end = camera.project(h.origin + h.dir * length);
    record(1, [1., a, 0., 8., end.x, end.y, start.x, start.y]);
    let delta = end - start;
    let rocks: Vec<Rock> = (0..8)
        .map(|i| {
            if i < 4 {
                let q = i as f32 / 3.;
                let p = delta * (0.15 + i as f32 * 0.21);
                Rock {
                    base: vec3(p.x, 0., p.y / 0.75),
                    h: 18. + 27. * q,
                    r: 8. + 10. * q,
                    lx: -8. - 8. * q,
                    lz: 0.,
                    born: 0.73 + i as f32 * 0.14,
                    end: false,
                    closing: false,
                    rotation: 0.58,
                    study: vec2(-100., 100.).lerp(vec2(20., 10.), 0.15 + i as f32 * 0.21),
                }
            } else {
                let (x, d, height, r, lx, lz, born, rot) = match i {
                    4 => (-25., -5., 86., 25., -39., -6., 1.30, 0.42),
                    5 => (27., -8., 94., 26., 31., -9., 1.34, 0.72),
                    6 => (-1., 11., 78., 26., -15., 7., 1.39, 0.42),
                    _ => (1., 27., 69., 25., 0., 0., 1.73, -0.38),
                };
                Rock {
                    base: vec3(delta.x + x * z, 0., delta.y / 0.75 + d * z),
                    h: height,
                    r,
                    lx,
                    lz,
                    born,
                    end: true,
                    closing: i == 7,
                    rotation: rot,
                    study: vec2(20. + x, 10. + d),
                }
            }
        })
        .collect();
    f.time = a;
    if !front {
        let fade = s(a / 0.08) * (1. - s((a - 0.67) / 0.10));
        let pulse = 0.72 + 0.28 * (a * 45.).sin();
        f.quad(
            start,
            vec2(106., 79.5) * z,
            0.,
            0xffb653,
            fade * 0.75,
            Kind::Soft,
            Blend::Add,
            0.,
        );
        f.glow(
            start + vec2(12., -31.) * z,
            (28. + 8. * pulse) * z,
            0xffcc64,
            fade * pulse,
        );
        f.glow(
            start + vec2(12., -31.) * z,
            (13. + 5. * pulse) * z,
            0xffffff,
            fade,
        );
    }
    for (i, r) in rocks.iter().enumerate() {
        let foreground = r.end && (i >= 6);
        if front != foreground {
            continue;
        }
        rock(f, start, *r, a, z);
    }
    if !front {
        return;
    }
    let u = c((a - 0.70) / 0.60);
    if (0.68..1.39).contains(&a) {
        let p = start + delta * u - vec2(0., 5. * z);
        let fade = s((a - 0.68) / 0.05) * (1. - s((a - 1.30) / 0.09));
        f.quad(
            p,
            vec2(48. + 20. * u, 23. + 8. * u) * z,
            0.,
            0xffffff,
            fade,
            Kind::Fire,
            Blend::Add,
            0.,
        );
        f.quad(
            p,
            vec2(28. + 10. * u, 14.) * z,
            0.,
            0xffffff,
            fade,
            Kind::Soft,
            Blend::Add,
            0.,
        );
    }
    for j in 0..5 {
        let last = j == 4;
        let q = j as f32 / 3.;
        let born = if last { 1.28 } else { 0.73 + j as f32 * 0.14 };
        let p = if last {
            end
        } else {
            start + delta * (0.15 + j as f32 * 0.21)
        };
        let age = a - born;
        let bloom = s(age / 0.04) * (1. - s((age - if last { 0.30 } else { 0.08 }) / 0.20));
        let close = if last {
            s((a - 1.75) / 0.04) * (1. - s((a - 1.87) / 0.20))
        } else {
            0.
        };
        let p = p + if close > 0. {
            vec2(0., 27. * 0.75 * z)
        } else {
            Vec2::ZERO
        };
        let bloom = bloom.max(close);
        let size = if last {
            vec2(105., 59.)
        } else {
            vec2(39. + q * 31., 23. + q * 20.)
        };
        f.quad(
            p - vec2(0., 7. * z),
            size * z,
            0.,
            0xffffff,
            bloom * 0.95,
            Kind::Fire,
            Blend::Add,
            0.,
        );
        let size = if last {
            vec2(68., 32.)
        } else {
            vec2(23. + q * 22., 14. + q * 15.)
        };
        f.quad(
            p - vec2(0., 6. * z),
            size * z,
            0.,
            0xffffff,
            bloom * 0.89,
            Kind::Soft,
            Blend::Add,
            0.,
        );
        for k in 0..if last { 2 } else { 1 } {
            let u = (age - k as f32 * 0.06) / 0.45;
            if (0. ..1.).contains(&u) {
                let radius = if last { 31.5 } else { 15.5 + q * 8. };
                let rx = radius * (0.55 + u * 1.7) * z;
                f.ring(p, vec2(rx, rx * 0.75), z, 0xffe9b2, (1. - u) * 0.32, 32);
            }
        }
    }
    gas(f, start, &rocks, a, z);
}
fn rock(f: &mut Frame, origin: Vec2, r: Rock, a: f32, z: f32) {
    if a < r.born {
        return;
    }
    let rise = s((a - r.born) / if r.end { 0.15 } else { 0.12 });
    let release = if r.end {
        0.
    } else {
        s((a - r.born - 0.34) / 0.5)
    };
    let sink_at = if r.end {
        if r.closing {
            2.11
        } else {
            1.90
        }
    } else {
        r.born + 0.48
    };
    let sink = if r.end {
        1. - (1. - c((a - sink_at) / 0.25)).powi(3)
    } else {
        s((a - sink_at) / 0.38)
    };
    if sink >= 1. {
        return;
    }
    // Approved study camera, local to each sim-owned ground anchor.
    let pitch = 42_f32.to_radians();
    let distance = 320. / 20_f32.to_radians().tan();
    let ground = |p: Vec2| {
        let depth = distance / (1. + p.y * 0.75 / distance / pitch.tan());
        vec3(
            p.x * depth / distance,
            0.,
            p.y * 0.75 * depth / distance / pitch.sin(),
        )
    };
    let base = ground(r.study);
    let cluster = ground(if r.end { vec2(20., 10.) } else { r.study });
    let d = (distance - cluster.z * pitch.cos()) / distance;
    let depth = distance - base.z * pitch.cos();
    let height = r.h * depth / (distance * pitch.cos() + (r.h - r.study.y * 0.75) * pitch.sin());
    let radius = r.r * d;
    let lx = r.lx * d;
    let lz = r.lz * d;
    let perspective = |p: Vec3| {
        let scale = distance / (distance - p.y * pitch.sin() - p.z * pitch.cos());
        vec2(p.x, p.z * pitch.sin() - p.y * pitch.cos()) * scale
    };
    let v = [
        vec3(0., -height * 0.15, 0.),
        vec3(-radius, height * 0.34, -radius * 0.65),
        vec3(radius * 0.85, height * 0.40, -radius * 0.65),
        vec3(radius, height * 0.45, radius * 0.65),
        vec3(-radius * 0.85, height * 0.38, radius * 0.65),
        vec3(-radius * 0.54 + lx, height * 0.91, -radius * 0.35 + lz),
        vec3(radius * 0.48 + lx, height, -radius * 0.35 + lz),
        vec3(radius * 0.50 + lx, height * 0.88, radius * 0.34 + lz),
        vec3(-radius * 0.51 + lx, height * 0.83, radius * 0.34 + lz),
    ];
    let faces = [
        [0, 2, 1],
        [0, 3, 2],
        [0, 4, 3],
        [0, 1, 4],
        [1, 5, 2],
        [2, 5, 6],
        [2, 6, 3],
        [3, 6, 7],
        [3, 7, 4],
        [4, 7, 8],
        [4, 8, 1],
        [1, 8, 5],
        [5, 8, 6],
        [6, 8, 7],
    ];
    let rotation = Quat::from_rotation_x(0.035) * Quat::from_rotation_y(r.rotation);
    let shift = height * (1. - rise) + height * sink;
    let transform =
        |p: Vec3| rotation * (p * vec3(1., 0.72 + 0.28 * rise, 1.)) - vec3(0., shift, 0.);
    f.quad(
        origin + project(r.base),
        vec2(r.r * 2.1, r.r * 1.45 * 0.75) * z,
        0.,
        0x161310,
        0.72 * rise * (1. - sink) * (1. - release),
        Kind::Soft,
        Blend::Alpha,
        0.,
    );
    for face in faces {
        let p = face.map(|i| v[i]);
        let normal = Quat::from_rotation_x(pitch)
            * (rotation * ((p[1] - p[0]).cross(p[2] - p[0]) / vec3(1., 0.72 + 0.28 * rise, 1.)))
                .normalize_or_zero();
        let toward_camera = Quat::from_rotation_x(pitch)
            * (vec3(0., distance * pitch.sin(), distance * pitch.cos())
                - base
                - transform((p[0] + p[1] + p[2]) / 3.));
        if normal.dot(toward_camera) <= 0. {
            continue; // The approved material draws front faces only.
        }
        let light = normal.dot(vec3(-0.65, 0.8, 0.55).normalize());
        let shade = if light < 0.32 {
            stone_linear(0x3a3d3c).lerp(stone_linear(0x7a7c78), c((light + 0.25) / 0.57))
        } else {
            stone_linear(0x7a7c78).lerp(stone_linear(0xb8b8b0), c((light - 0.32) / 0.48))
        };
        let tangent = (p[1] - p[0]).normalize_or_zero();
        let bitangent = (p[1] - p[0])
            .cross(p[2] - p[0])
            .normalize_or_zero()
            .cross(tangent);
        let mut poly: Vec<_> = p.iter().map(|p| (*p, transform(*p))).collect(); // Clip the opaque sink at the floor, never fade climax rocks.
        let input = poly.clone();
        poly.clear();
        for j in 0..3 {
            let (la, wa) = input[j];
            let (lb, wb) = input[(j + 1) % 3];
            if wa.y >= 0. {
                poly.push((la, wa));
            }
            if (wa.y >= 0.) != (wb.y >= 0.) {
                let t = wa.y / (wa.y - wb.y);
                poly.push((la.lerp(lb, t), wa.lerp(wb, t)));
            }
        }
        for k in 1..poly.len().saturating_sub(1) {
            let verts = [poly[0], poly[k], poly[k + 1]];
            let pos = verts.map(|(_, w)| {
                let xy = origin + project(r.base) + (perspective(base + w) - perspective(base)) * z;
                vec3(
                    xy.x,
                    xy.y,
                    -w.y * z * 0.00001 - (r.base.z + w.z * z) * 0.000001,
                )
            });
            let uv = verts.map(|(p, _)| {
                vec2(
                    (p - v[face[0]]).dot(tangent),
                    (p - v[face[0]]).dot(bitangent),
                ) / (2. * radius)
            });
            let colors = verts.map(|(p, _)| {
                let g = 0.67 + 0.43 * c(p.y / height);
                Color::new(shade.x * g, shade.y * g, shade.z * g, 0.99 * (1. - release))
            });
            let age = a - if r.end { 1.28 } else { r.born };
            let heat = s(age / 0.04) * (1. - s((age - if r.end { 0.3 } else { 0.08 }) / 0.2));
            let aux = verts.map(|(_, w)| {
                let close = s((a - 1.75) / 0.04) * (1. - s((a - 1.87) / 0.20));
                let fire =
                    cluster + vec3(0., 7. * d, if r.end && close > 0. { 27. * d } else { 0. });
                let dist = (base + w - fire).length();
                vec4(
                    (1. - dist / (88. * d)).max(0.).powi(2)
                        * heat.max(if r.end { close } else { 0. }),
                    0.,
                    0.,
                    1.,
                )
            });
            f.tri(pos, uv, colors, aux, Kind::Stone, Blend::Solid);
        }
    }
}
fn stone_linear(hex: u32) -> Vec3 {
    let decode = |v: f32| {
        if v <= 0.04045 {
            v / 12.92
        } else {
            ((v + 0.055) / 1.055).powf(2.4)
        }
    };
    let p = rgb(hex, 1.);
    vec3(decode(p.r), decode(p.g), decode(p.b))
}
fn gas(f: &mut Frame, origin: Vec2, rocks: &[Rock], a: f32, z: f32) {
    let mut puffs = Vec::with_capacity(92);
    for i in 0..92 {
        let retreat = i >= 40;
        let j = if retreat { i - 40 } else { i % 10 };
        let (
            base,
            born,
            life,
            width,
            height,
            radius,
            drift,
            lift,
            low,
            angle,
            seed,
            spin,
            layer,
            shade,
        ) = if !retreat {
            let rock = rocks[i / 10];
            let q = (i / 10) as f32 / 3.;
            let offset = rock.born;
            let born = offset + 0.03 + (j as f32 - 3.).max(0.) * 0.015;
            (
                rock.base,
                born,
                0.90 + (j % 5) as f32 * 0.07,
                50. + q * 70.,
                38. + q * 28.,
                2. + (j % 4) as f32 * 1.8,
                10. + (j % 5) as f32 * 2.,
                5. + (j % 3) as f32 * 2.,
                j >= 8,
                j as f32 * 2.399963 + offset * 0.7,
                j as f32 * 1.73 + offset * 13.,
                (if j % 2 == 1 { 1. } else { -1. }) * (0.24 + (j % 5) as f32 * 0.11),
                0,
                1.,
            )
        } else {
            let ring = j < 8;
            let body = (8..48).contains(&j);
            let wisp = j >= 48;
            let k = if body { j - 8 } else { j };
            let rock = rocks[4 + if body {
                if k >= 20 {
                    3
                } else {
                    k / 7
                }
            } else {
                j % 4
            }];
            let low = ring || body && k % 10 < 5;
            let born = if wisp {
                2.02 + (j - 48) as f32 * 0.035
            } else {
                1.60 + (j % 5) as f32 * 0.012
            };
            (
                rock.base,
                born,
                2.92 - born,
                if ring {
                    50.
                } else if wisp {
                    38.
                } else if low {
                    64.
                } else {
                    50. + (k % 4) as f32 * 4.
                },
                if ring {
                    34.
                } else if wisp {
                    42.
                } else if low {
                    53.
                } else {
                    48. + (k % 3) as f32 * 4.
                },
                if ring { 12. } else { 3. + (k % 5) as f32 * 2. },
                if ring {
                    37.
                } else if wisp {
                    30.
                } else {
                    22. + (k % 4) as f32 * 3.
                },
                if low {
                    8.
                } else if wisp {
                    35.
                } else {
                    20. + (k % 4) as f32 * 3.
                },
                low,
                j as f32 * 2.399963,
                j as f32 * 1.73 + 1.28 * 13.,
                (if j % 2 == 1 { 1. } else { -1. }) * (0.80 + (j % 5) as f32 * 0.23),
                k % 5,
                0.83 + (j % 5) as f32 * 0.09,
            )
        };
        let u = (a - born) / life;
        if !(0. ..1.).contains(&u) {
            continue;
        }
        let slowed = (1. - (-2.6 * u).exp()) / (1. - (-2.6_f32).exp());
        let r = (radius + drift * slowed) * z;
        let mut center = base
            + vec3(
                angle.cos() * r + (u * 5.4 + seed).sin() * 2.2 * z,
                (if low { 13. } else { 18. }) * z + lift * slowed * z,
                angle.sin() * r + 12. * z + (u * 4.7 + seed).cos() * 1.7 * z,
            );
        if retreat {
            center = base
                + vec3(
                    angle.cos() * r + (u * 9. + seed).sin() * 4. * z,
                    ((if low { 7. } else { 17. + layer as f32 * 5. })
                        + lift * (1. - (-8. * u).exp())
                        + (u * 7. + seed).sin() * 3.)
                        * z,
                    angle.sin() * r + (if low { 38. } else { -12. }) * z,
                );
        }
        let growth = if retreat {
            0.35 + 0.75 * s(u / 0.22) + 0.28 * s((u - 0.22) / 0.78)
        } else if u < 0.55 {
            0.2 + 0.8 * s(u / 0.55)
        } else {
            1. + 0.1 * s((u - 0.55) / 0.45)
        };
        let alpha = if retreat {
            0.36 * s(u / 0.13) * (1. - s((u - 0.43) / 0.57))
        } else if u < 0.15 {
            0.36 * s(u / 0.15)
        } else if u < 0.55 {
            0.36 - 0.08 * s((u - 0.15) / 0.40)
        } else {
            0.28 * (1. - s((u - 0.55) / 0.45))
        };
        let birth = if retreat {
            if low {
                0xa57b4c
            } else {
                0xd1ad73
            }
        } else if low {
            0x92704e
        } else {
            0x9a7650
        };
        let color = rgb(birth, 1.).to_vec().truncate().lerp(
            rgb(0xd7bd8d, 1.).to_vec().truncate(),
            s(if retreat { u } else { (u - 0.15) / 0.85 }),
        ) * shade;
        let tint = ((c(color.x) * 255.) as u32) << 16
            | ((c(color.y) * 255.) as u32) << 8
            | (c(color.z) * 255.) as u32;
        puffs.push((
            center,
            vec2(width, height) * growth * z,
            j as f32 * 0.71 + spin * (a - born),
            tint,
            alpha,
            seed,
            retreat,
        ));
    }
    puffs.sort_by(|a, b| {
        (b.0.z * 0.6614378 + b.0.y * 0.75).total_cmp(&(a.0.z * 0.6614378 + a.0.y * 0.75))
    });
    for (center, size, rotation, tint, alpha, seed, retreat) in puffs {
        f.puff(
            origin + project(center),
            size,
            rotation,
            tint,
            alpha,
            seed,
            retreat,
        );
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn closing_thump_is_single_bounded_and_returns_exactly() {
        assert_eq!(closing_shake(-0.001), Vec2::ZERO);
        assert_eq!(closing_shake(0.22), Vec2::ZERO);
        assert_eq!(closing_shake(2.), Vec2::ZERO);
        for i in 0..220 {
            let p = closing_shake(i as f32 / 1000.);
            assert!(p.y.abs() <= 6. && p.x.abs() <= 2.);
            assert_eq!(p.x % 2., 0.);
            assert_eq!(p.y % 2., 0.);
        }
    }
    #[test]
    fn tail_retires_after_gas() {
        assert!((TAIL - (2.92 - 1.3) * 6. / 13.).abs() < 1e-6);
    }
}
