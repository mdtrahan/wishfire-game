//! Approved v3e soap volume and full-resolution Gaussian release.
use super::vfx3d::*;
use crate::{
    assets::{Assets, DrawStats},
    camera::WorldCamera,
};
use macroquad::prelude::*;
use std::rc::Rc;
use wf_combat::api::{Event, HazardKind, HazardPhase, Shape, Skill, Snapshot, Vec2 as WorldPos};
const RELEASE: f64 = 0.94;
#[derive(Clone)]
struct Particle {
    p: Vec3,
    v: Vec3,
    life: f32,
    delay: f32,
    size: f32,
    phase: f32,
    color: u32,
    drag: f32,
    rate: f32,
    amplitude: f32,
}
struct Model {
    seed: u32,
    origins: [Vec3; 10],
    velocities: [Vec3; 10],
    particles: Vec<Particle>,
}
fn surface(n: Vec3) -> Vec3 {
    let p = n * 83.;
    p + n * (p.y * 0.12 + 0.35 * 14. + p.x * 0.04).sin() * 1.8 + vec3(0., 108., 0.)
}
fn orb_position(p: Vec3, v: Vec3, a: f32) -> Vec3 {
    p + v * (1. - (-6. * a).exp()) / 6. - vec3(0., 48. * a + 13. * a * a, 0.)
}
impl Model {
    fn new(seed: u32) -> Self {
        let varied = seed != 91731;
        let mut motion = Rng(seed);
        let bias = if varied {
            motion.sphere() * 0.075
        } else {
            Vec3::ZERO
        };
        let turn = if varied { motion.next() * TAU } else { 0. };
        let directions = std::array::from_fn::<_, 10, _>(|i| {
            let a = i as f32 / 10. * TAU
                + 0.24
                + turn
                + if varied {
                    (motion.next() - 0.5) * 0.45
                } else {
                    0.
                };
            (vec3(
                a.cos(),
                0.24 + (i as f32 * 2.3).sin() * 0.56
                    + if varied {
                        (motion.next() - 0.5) * 0.2
                    } else {
                        0.
                    },
                a.sin() * 0.8,
            ) + bias)
                .normalize()
        });
        let origins = directions.map(surface);
        let velocities = std::array::from_fn(|i| {
            directions[i]
                * if varied {
                    300. + motion.next() * 80.
                } else {
                    300. + (i % 3) as f32 * 40.
                }
        });
        let mut style = Rng(91731);
        let particles = (0..1000)
            .map(|i| {
                let n = style.sphere();
                let (mut p, mut v, delay, mut life) = if i < 760 {
                    (
                        surface(n),
                        n * (260. + style.next() * 200.),
                        0.,
                        0.60 + style.next() * 0.32,
                    )
                } else {
                    let orb = i % 10;
                    let emission = 0.02 + style.next() * 0.24;
                    (
                        orb_position(origins[orb], velocities[orb], emission)
                            + n * style.next() * 5.,
                        velocities[orb] * (-6. * emission).exp() * 0.55
                            + n * (40. + style.next() * 70.),
                        emission,
                        0.60 + style.next() * 0.18,
                    )
                };
                let drag = if varied {
                    5.4 + motion.next() * 1.2
                } else {
                    6.
                };
                let rate = if varied {
                    0.85 + motion.next() * 0.3
                } else {
                    1.
                };
                let amplitude = if varied {
                    0.85 + motion.next() * 0.3
                } else {
                    1.
                };
                if varied {
                    let direction = motion.sphere();
                    let outward = (direction + motion.sphere() * 0.18 + bias).normalize();
                    if i < 760 {
                        p = surface(direction);
                        v = outward * (260. + motion.next() * 200.);
                        life = 0.60 + motion.next() * 0.32;
                    } else {
                        let orb = i % 10;
                        p = orb_position(origins[orb], velocities[orb], delay)
                            + direction * motion.next() * 5.;
                        v = velocities[orb] * (-6. * delay).exp() * 0.55
                            + outward * (40. + motion.next() * 70.);
                        life = 0.60 + motion.next() * 0.18;
                    }
                }
                let size = if i % 37 == 0 { 2.6 } else { 1. + style.next() };
                let phase = style.next() * TAU;
                let phase = if varied { motion.next() * TAU } else { phase };
                let base = rgb(
                    if i % 17 == 0 {
                        0xf3b6ed
                    } else if i % 5 == 0 {
                        0xffffff
                    } else {
                        0x92eaf6
                    },
                    1.,
                )
                .to_vec()
                .truncate()
                .lerp(Vec3::ONE, style.next() * 0.4);
                let color = ((base.x * 255.) as u32) << 16
                    | ((base.y * 255.) as u32) << 8
                    | (base.z * 255.) as u32;
                Particle {
                    p,
                    v,
                    life,
                    delay,
                    size,
                    phase,
                    color,
                    drag,
                    rate,
                    amplitude,
                }
            })
            .collect();
        Self {
            seed,
            origins,
            velocities,
            particles,
        }
    }
}
struct Cast {
    caster: u32,
    born: f64,
    model: Rc<Model>,
}
struct Pop {
    origin: WorldPos,
    radius: f32,
    born: f64,
    model: Rc<Model>,
}
#[derive(Default)]
pub struct BubbleFx {
    pops: Vec<Pop>,
    casts: Vec<Cast>,
}
impl BubbleFx {
    pub(super) fn take_combo(&mut self, from: &mut Self, delta: f64) {
        super::spotlight::transfer(
            &mut from.casts,
            &mut self.casts,
            |_| true,
            |x| x.born += delta,
        );
        super::spotlight::transfer(
            &mut from.pops,
            &mut self.pops,
            |_| true,
            |x| x.born += delta,
        );
    }
    pub(super) fn shift(&mut self, delta: f64) {
        for x in &mut self.casts {
            x.born += delta;
        }
        for x in &mut self.pops {
            x.born += delta;
        }
    }
    pub fn ingest(
        &mut self,
        events: &[Event],
        s: &Snapshot,
        previous: &Snapshot,
        hazard: impl Fn(u32) -> Option<(WorldPos, Shape)>,
    ) {
        self.pops.retain(|x| s.time - x.born < RELEASE);
        self.casts.retain(|x| s.time - x.born < 1.);
        for e in events {
            match *e {
                Event::SkillStarted {
                    id,
                    skill: Skill::BubblePop,
                    ..
                } => self.casts.push(Cast {
                    caster: id,
                    born: s.time,
                    model: Rc::new(Model::new(seed(id, s.time))),
                }),
                Event::HazardResolved {
                    id,
                    kind: HazardKind::BubblePop,
                    ..
                } => {
                    if let Some((origin, Shape::Circle { radius })) = hazard(id) {
                        let owner = s
                            .hazards
                            .iter()
                            .chain(&previous.hazards)
                            .find(|h| h.id == id)
                            .map(|h| h.owner);
                        let model = self
                            .casts
                            .iter()
                            .rev()
                            .find(|x| Some(x.caster) == owner)
                            .map_or_else(
                                || Rc::new(Model::new(seed(id, s.time))),
                                |x| x.model.clone(),
                            );
                        self.pops.push(Pop {
                            origin,
                            radius,
                            born: s.time,
                            model,
                        });
                    }
                }
                _ => {}
            }
        }
    }
    pub fn busy(&self, time: f64) -> bool {
        self.pops
            .iter()
            .any(|x| (0. ..RELEASE).contains(&(time - x.born)))
            || self
                .casts
                .iter()
                .any(|x| (0. ..0.35).contains(&(time - x.born)))
    }
    #[cfg(target_arch = "wasm32")]
    pub fn pop_age(&self, time: f64) -> f32 {
        self.pops.last().map_or(-1., |x| (time - x.born) as f32)
    }
    #[cfg(any(test, target_arch = "wasm32"))]
    pub fn records(&self) -> usize {
        self.pops.len() + self.casts.len()
    }
    pub fn impacts(&self, _: &Assets, camera: &WorldCamera, s: &Snapshot, stats: &mut DrawStats) {
        let mut base = Frame::default();
        for h in s
            .hazards
            .iter()
            .filter(|h| h.kind == HazardKind::BubblePop && h.phase != HazardPhase::Resolved)
        {
            let Shape::Circle { radius } = h.shape else {
                continue;
            };
            let scale = radius / 140. * zscale(camera);
            let foot = camera.project(h.origin);
            record(2, [1., h.progress * 0.35, 0., 180., foot.x, foot.y, 0., 0.]);
            shell(
                &mut base,
                camera.project(h.origin),
                h.progress * 0.35,
                scale,
            );
        }
        base.draw(stats);
        let mut airy = Frame::default();
        for pop in &self.pops {
            release(
                &mut airy,
                &pop.model,
                camera.project(pop.origin),
                (s.time - pop.born) as f32,
                pop.radius / 140. * zscale(camera),
            );
        }
        airy.draw_full(stats);
    }
}
fn screen(p: Vec3) -> Vec2 {
    vec2(p.x, p.z * 0.75 - p.y * 0.6614378)
}
fn shell(f: &mut Frame, foot: Vec2, t: f32, z: f32) {
    let scale = (0.32 + 0.68 * c(t / 0.35)) * z;
    f.time = t;
    let mut triangles: Vec<_> = icosahedron(2)
        .into_iter()
        .map(|normals| {
            normals.map(|n| {
                vec3(
                    n.x,
                    n.y * 0.6614378 - n.z * 0.75,
                    n.y * 0.75 + n.z * 0.6614378,
                )
            })
        })
        .collect();
    // Transparent far wall first, then the near film; no screen-plane outline.
    triangles.sort_by(|a, b| {
        let depth = |ns: &[Vec3; 3]| ns.iter().map(|n| n.z).sum::<f32>();
        depth(a).total_cmp(&depth(b))
    });
    for normals in triangles {
        let opacity = if normals.iter().map(|n| n.z).sum::<f32>() < 0. {
            0.28
        } else {
            1.
        };
        let vertices = normals.map(|n| {
            let world = vec3(
                n.x,
                n.y * 0.6614378 + n.z * 0.75,
                -n.y * 0.75 + n.z * 0.6614378,
            );
            let p = world * 83.;
            let p =
                (p + world * (p.y * 0.12 + t * 14. + p.x * 0.04).sin() * 1.8 + vec3(0., 108., 0.))
                    * scale;
            let xy = foot + screen(p);
            (
                vec3(xy.x, xy.y, -p.z * 0.00001),
                vec2(
                    world.x.atan2(world.z) / TAU + 0.5,
                    world.y.asin() / std::f32::consts::PI + 0.5,
                ),
            )
        });
        f.tri(
            vertices.map(|v| v.0),
            vertices.map(|v| v.1),
            [WHITE; 3],
            normals.map(|n| n.extend(opacity)),
            Kind::Soap,
            Blend::Alpha,
        );
    }
    f.quad(
        foot,
        vec2(157., 117.75) * z,
        0.,
        0x19dbff,
        0.5,
        Kind::Soft,
        Blend::Add,
        0.,
    );
}
fn release(f: &mut Frame, m: &Model, foot: Vec2, a: f32, z: f32) {
    if !(0. ..0.94).contains(&a) {
        return;
    }
    record(
        2,
        [1., a + 0.35, m.seed as f32, 1000., foot.x, foot.y, 0., 0.],
    );
    record_seed(2, m.seed);
    let center = foot + screen(vec3(0., 108., 0.) * z);
    if a < 0.075 {
        let q = (1. - a / 0.075).powi(2);
        f.glow(center, 250. * (1. + a * 3.) * z, 0x48dfee, 0.50 * q);
        f.glow(center, 130. * z, 0xc0faff, 0.28 * q);
    }
    let haze = foot + screen(vec3(0., 108. - 48. * a - 13. * a * a, 0.) * z);
    f.glow(
        haze,
        325. * (1. + a * 0.26) * z,
        0x61e3f7,
        0.12 * (1. - s((a - 0.2) / 0.68)),
    );
    for i in 0..10 {
        let duration = 0.44 + (i % 3) as f32 * 0.035;
        if a >= duration {
            continue;
        }
        let u = c(a / duration);
        let p = foot + screen(orb_position(m.origins[i], m.velocities[i], a) * z);
        f.quad(
            p,
            Vec2::splat((19. + (i % 3) as f32 * 3.) * (1. + u * 0.65) * z),
            0.,
            0x0db3e0,
            0.95 * (1. - u * u).powf(1.5),
            Kind::BlueOrb,
            Blend::Add,
            0.,
        );
    }
    for p in &m.particles {
        let b = a - p.delay;
        if b < 0. || b >= p.life {
            continue;
        }
        let u = c(b / p.life);
        let mut q =
            p.p + p.v * (1. - (-p.drag * b).exp()) / p.drag - vec3(0., 48. * b + 13. * b * b, 0.);
        q.x += (b * 11. * p.rate + p.phase).sin() * 2. * b * p.amplitude;
        q.y += ((b * 9. * p.rate + p.phase).sin() - p.phase.sin()) * 1.8 * b * p.amplitude;
        let core = (-(q.x * q.x + (q.y - (108. - 48. * a - 13. * a * a)).powi(2)) / 16000.).exp();
        let alpha = (1. - s((u - 0.38) / 0.62))
            * (0.75 + core * 0.25)
            * (0.88 + 0.12 * (b * 17. + p.phase).sin());
        f.quad(
            foot + screen(q * z),
            Vec2::splat(p.size * z),
            0.,
            p.color,
            alpha,
            Kind::Orb,
            Blend::Add,
            0.,
        );
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn two_streams_preserve_style_and_change_motion() {
        let a = Model::new(1);
        let b = Model::new(2);
        assert_eq!(a.particles.len(), 1000);
        assert_eq!(a.particles.iter().filter(|p| p.delay == 0.).count(), 760);
        for (a, b) in a.particles.iter().zip(&b.particles) {
            assert_eq!(a.size, b.size);
            assert_eq!(a.color, b.color);
            assert_eq!(a.delay, b.delay);
        }
        assert_ne!(a.origins, b.origins);
        let replay = Model::new(1);
        for (a, b) in a.particles.iter().zip(&replay.particles) {
            assert_eq!(a.p, b.p);
            assert_eq!(a.v, b.v);
        }
    }
}
