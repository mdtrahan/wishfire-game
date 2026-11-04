//! Approved v4c-f: five immutable projected paths; every arrival is cosmetic.
use super::vfx3d::*;
use crate::{
    assets::{Assets, DrawStats},
    camera::WorldCamera,
};
use macroquad::prelude::*;
use wf_combat::api::{Event, HazardKind, HazardPhase, Shape, Skill, Snapshot, Vec2 as WorldPos};
pub const IMPACT_ART: &str = "arcane-pulse-impact"; // Existing read-only asset availability probe.
pub const BURST_SECONDS: f64 = 1.50;
const CAST_SECONDS: f64 = 0.50;
#[derive(Clone)]
struct Beam {
    path: usize,
    width: f32,
    flight: f32,
    history: f32,
    lines: usize,
    behind: bool,
    angle: f32,
    launch: f32,
    arrival: f32,
}
#[derive(Clone)]
struct Model {
    seed: u32,
    beams: Vec<Beam>,
    end: f32,
}
impl Model {
    fn new(seed: u32) -> Self {
        let mut r = Rng(seed);
        let count = 8 + (r.next() * 5.) as usize;
        let mut guaranteed = vec![0, 1, 2, 3, 4];
        for i in (1..5).rev() {
            let j = (r.next() * (i + 1) as f32) as usize;
            guaranteed.swap(i, j);
        }
        let chosen = loop {
            let mut paths = guaranteed.clone();
            paths.extend((5..count).map(|_| (r.next() * 5.) as usize));
            let mut counts = [0; 5];
            for p in &paths {
                counts[*p] += 1;
            }
            if counts.iter().max().unwrap() - counts.iter().min().unwrap() >= 2 {
                break paths;
            }
        };
        let mut beams: Vec<_> = chosen
            .into_iter()
            .map(|path| {
                let jitter = if path == 2 {
                    0.
                } else {
                    let sign = if r.next() < 0.5 { -1. } else { 1. };
                    sign * (0.03 + r.next() * 0.03)
                };
                Beam {
                    path,
                    width: 1. + jitter,
                    flight: (0.35 + (r.next() - 0.5) * 0.025) * 2.,
                    history: (0.16 + r.next() * 0.025) * 2.,
                    lines: 10 + (r.next() * 7.) as usize,
                    behind: r.next() < 0.5,
                    angle: r.next() * TAU,
                    launch: 0.,
                    arrival: 0.,
                }
            })
            .collect();
        for path in 0..5 {
            let mut group: Vec<_> = (0..count).filter(|i| beams[*i].path == path).collect();
            for i in (1..group.len()).rev() {
                let j = (r.next() * (i + 1) as f32) as usize;
                group.swap(i, j);
            }
            let window = 1. - 0.08 * (group.len() - 1) as f32;
            let mut launches: Vec<_> = group.iter().map(|_| r.next() * window).collect();
            launches.sort_by(f32::total_cmp);
            for (i, index) in group.iter().enumerate() {
                beams[*index].launch = launches[i] + i as f32 * 0.08;
                beams[*index].arrival = beams[*index].launch + beams[*index].flight;
            }
        }
        let shift = 0.9
            - beams
                .iter()
                .map(|b| b.arrival)
                .fold(f32::INFINITY, f32::min);
        for b in &mut beams {
            b.launch += shift;
            b.arrival += shift;
        }
        let end = beams.iter().map(|b| b.arrival).fold(0., f32::max) + 0.44;
        Self { seed, beams, end }
    }
}
struct Cast {
    caster: u32,
    born: f64,
    model: Model,
}
struct Burst {
    id: u32,
    origin: WorldPos,
    born: f64,
    victims: Vec<u32>,
    source: WorldPos,
    model: Model,
}
#[derive(Default)]
pub struct ArcanePulse {
    casts: Vec<Cast>,
    bursts: Vec<Burst>,
}
impl ArcanePulse {
    pub(super) fn take_combo(&mut self, from: &mut Self, delta: f64) {
        super::spotlight::transfer(
            &mut from.casts,
            &mut self.casts,
            |_| true,
            |x| x.born += delta,
        );
        super::spotlight::transfer(
            &mut from.bursts,
            &mut self.bursts,
            |_| true,
            |x| x.born += delta,
        );
    }
    pub(super) fn shift(&mut self, delta: f64) {
        for x in &mut self.casts {
            x.born += delta;
        }
        for x in &mut self.bursts {
            x.born += delta;
        }
    }
    pub fn ingest(&mut self, events: &[Event], s: &Snapshot, previous: &Snapshot) {
        self.casts.retain(|x| {
            s.time - x.born < CAST_SECONDS
                || s.hazards.iter().any(|h| {
                    h.owner == x.caster
                        && h.kind == HazardKind::ArcanePulse
                        && h.phase != HazardPhase::Resolved
                })
        });
        self.bursts
            .retain(|x| s.time - x.born < (x.model.end - 0.9) as f64);
        for e in events {
            match *e {
                Event::SkillStarted {
                    id,
                    skill: Skill::ArcanePulse,
                    ..
                } => {
                    self.casts.retain(|x| x.caster != id);
                    self.casts.push(Cast {
                        caster: id,
                        born: s.time,
                        model: Model::new(seed(id, s.time)),
                    });
                }
                Event::HazardResolved {
                    id,
                    kind: HazardKind::ArcanePulse,
                    ref victims,
                } => {
                    if self.bursts.iter().any(|b| b.id == id) {
                        continue;
                    }
                    if let Some(h) = s
                        .hazards
                        .iter()
                        .chain(&previous.hazards)
                        .find(|h| h.id == id)
                    {
                        let model = self
                            .casts
                            .iter()
                            .find(|x| x.caster == h.owner)
                            .map_or_else(|| Model::new(seed(id, s.time)), |x| x.model.clone());
                        let source = s
                            .actors
                            .iter()
                            .chain(&previous.actors)
                            .find(|a| a.id == h.owner)
                            .map_or(h.origin, |a| a.pos);
                        self.bursts.push(Burst {
                            id,
                            origin: h.origin,
                            born: s.time,
                            victims: victims.clone(),
                            source,
                            model,
                        });
                    }
                }
                _ => {}
            }
        }
    }
    pub fn busy(&self, time: f64) -> bool {
        self.casts
            .iter()
            .any(|x| (0. ..CAST_SECONDS).contains(&(time - x.born)))
            || self
                .bursts
                .iter()
                .any(|x| (0. ..(x.model.end - 0.9) as f64).contains(&(time - x.born)))
    }
    pub fn records(&self) -> usize {
        self.casts.len() + self.bursts.len()
    }
    #[cfg(any(target_arch = "wasm32", test))]
    pub fn probe(&self, s: &Snapshot) -> [f32; 4] {
        [
            s.hazards
                .iter()
                .filter(|h| h.kind == HazardKind::ArcanePulse && h.phase != HazardPhase::Resolved)
                .count() as f32,
            self.bursts.len() as f32,
            self.bursts.last().map_or(-1., |x| (s.time - x.born) as f32),
            self.casts.len() as f32,
        ]
    }
    pub fn ground(&self, assets: &Assets, camera: &WorldCamera, s: &Snapshot, stats: &mut DrawStats) {
        self.draw(assets, camera, s, stats, true);
    }
    pub fn impacts(&self, assets: &Assets, camera: &WorldCamera, s: &Snapshot, stats: &mut DrawStats) {
        self.draw(assets, camera, s, stats, false);
    }
    fn draw(
        &self,
        assets: &Assets,
        camera: &WorldCamera,
        s: &Snapshot,
        stats: &mut DrawStats,
        back: bool,
    ) {
        let mut f = Frame::default();
        let z = zscale(camera);
        for h in s
            .hazards
            .iter()
            .filter(|h| h.kind == HazardKind::ArcanePulse && h.phase != HazardPhase::Resolved)
        {
            if !matches!(h.shape, Shape::Circle { .. }) {
                continue;
            }
            let source = s
                .actors
                .iter()
                .find(|a| a.id == h.owner)
                .map_or(h.origin, |a| a.pos);
            let model = self
                .casts
                .iter()
                .find(|x| x.caster == h.owner)
                .map(|x| &x.model);
            let fallback = Model::new(seed(h.id, 0.));
            draw_model(
                &mut f,
                model.unwrap_or(&fallback),
                anchor(camera, s, h.owner, source) - vec2(0., 58. * 0.72 * z),
                camera.project(h.origin),
                h.progress * 0.9,
                z,
                back,
            );
        }
        for b in &self.bursts {
            draw_model(
                &mut f,
                &b.model,
                camera.project(b.source) - vec2(0., 58. * 0.72 * z),
                camera.project(b.origin),
                0.9 + (s.time - b.born) as f32,
                z,
                back,
            );
        }
        f.draw(stats);
        if !back {
            for b in &self.bursts {
                let time = 0.9 + (s.time - b.born) as f32;
                let lift = b
                    .model
                    .beams
                    .iter()
                    .filter_map(|beam| {
                        let a = time - beam.arrival;
                        (0. ..0.2).contains(&a).then_some(0.38 * (1. - c(a / 0.2)))
                    })
                    .fold(0., f32::max);
                for id in &b.victims {
                    if let Some(a) = s
                        .actors
                        .iter()
                        .find(|a| a.id == *id && a.team == wf_combat::Team::Enemy)
                    {
                        target_light(assets, camera, a, lift, stats);
                    }
                }
            }
        }
    }
}
fn cubic(a: Vec2, b: Vec2, d: Vec2, e: Vec2, t: f32) -> Vec2 {
    let q = 1. - t;
    a * q * q * q + b * 3. * q * q * t + d * 3. * q * t * t + e * t * t * t
}
fn path(b: &Beam, a: Vec2, end: Vec2, t: f32) -> Vec2 {
    let outer = [[0.25226775, -0.8622257], [0.6319342, -0.15905246]];
    let inner = [[0.23252791, -0.40975136], [0.63529396, -0.07321865]];
    let controls = if b.path == 0 || b.path == 4 {
        outer
    } else {
        inner
    };
    let side = if b.path < 2 {
        1.
    } else if b.path > 2 {
        -1.
    } else {
        0.
    };
    let d = end - a;
    let p = controls.map(|q| a + d * q[0] + vec2(-d.y, d.x) * q[1] * side * b.width);
    cubic(a, p[0], p[1], end, t)
}
fn along(b: &Beam, a: Vec2, end: Vec2, t: f32) -> Vec2 {
    if t < 0.5 {
        path(b, a, end, t * 1.2)
    } else {
        let q = (t - 0.5) * 2.;
        path(b, a, end, 0.6).lerp(end, 0.25 * q + 0.75 * q * q)
    }
}
fn draw_model(f: &mut Frame, model: &Model, hand: Vec2, foot: Vec2, time: f32, z: f32, back: bool) {
    let hit = foot - vec2(0., 58. * 0.48 * z);
    record(
        0,
        [
            1.,
            time,
            model.seed as f32,
            model.beams.len() as f32,
            foot.x,
            foot.y,
            hand.x,
            hand.y,
        ],
    );
    if !back && time > 0. && time < 0.5 {
        let q = (time / 0.5 * std::f32::consts::PI).sin();
        for (size, col, a) in [
            (25., 0x8a12ff, 0.8),
            (12., 0xe299ff, 1.4),
            (6., 0xffffff, 2.),
        ] {
            f.glow(hand, size * z, col, q * a);
        }
        for i in 0..7 {
            let a = i as f32 * TAU / 7. + time * 0.5 * 12.;
            let r = (8. + 5. * (time * 0.5 * 25. + i as f32).sin()) * z;
            let v = vec2(a.cos(), a.sin());
            f.line(hand + v * r, hand + v * (r + 3. * z), 0.9 * z, 0xe8c8ff, q);
        }
    }
    record_seed(0, model.seed);
    let latest = model.beams.iter().map(|b| b.arrival).fold(0., f32::max);
    for b in &model.beams {
        let age = time - b.launch;
        if age >= 0. && age < b.flight {
            let p = c(age / b.flight);
            if back != (b.behind && p < 0.48) {
                continue;
            }
            let dart = p >= 0.5;
            let tail = if dart {
                0.5_f32.max(c((age - b.history * 0.45) / b.flight))
            } else {
                c((age - b.history * 0.65) / b.flight)
            };
            let head = along(b, hand, hit, p);
            let tp = along(b, hand, hit, tail);
            let mut limit = 1.;
            if dart {
                let old = c((age - b.history) / b.flight);
                let mut prev = path(b, hand, hit, old);
                let mut length = 0.;
                for i in 1..=12 {
                    let next = path(b, hand, hit, old + (p - old) * i as f32 / 12.);
                    length += (next - prev).length();
                    prev = next;
                }
                limit = (0.45 * length / (head - tp).length().max(0.001)).min(1.);
            }
            let pair = |u: f32| {
                let t = tail + (p - tail) * u;
                let point = if dart {
                    head.lerp(tp, (1. - u) * limit)
                } else {
                    along(b, hand, hit, t)
                };
                let d = if dart {
                    hit - path(b, hand, hit, 0.6)
                } else {
                    path(b, hand, hit, (t * 1.2 + 0.001).min(1.))
                        - path(b, hand, hit, (t * 1.2 - 0.001).max(0.))
                };
                let n = vec2(-d.y, d.x).normalize_or_zero() * (0.12 + 0.88 * u.powf(0.7)) * 6. * z;
                [point + n, point - n]
            };
            for i in 0..28 {
                let u = i as f32 / 28.;
                let v = (i + 1) as f32 / 28.;
                let [a, c] = pair(u);
                let [d, e] = pair(v);
                let aux = [vec4(0., 0., 0., 1.); 3];
                f.tri(
                    [a.extend(0.), c.extend(0.), d.extend(0.)],
                    [vec2(u, 0.), vec2(u, 1.), vec2(v, 0.)],
                    [WHITE; 3],
                    aux,
                    Kind::Ribbon,
                    Blend::Add,
                );
                f.tri(
                    [d.extend(0.), c.extend(0.), e.extend(0.)],
                    [vec2(v, 0.), vec2(u, 1.), vec2(v, 1.)],
                    [WHITE; 3],
                    aux,
                    Kind::Ribbon,
                    Blend::Add,
                );
            }
            f.glow(head, 18. * z, 0x008aff, 0.8);
            f.glow(head, 11. * z, 0x60eaff, 1.5);
            let d = hit - path(b, hand, hit, 0.6);
            f.quad(
                head,
                vec2(
                    if dart {
                        5. * (1.2 + 1.1 * (p - 0.5))
                    } else {
                        5.
                    },
                    if dart { 4.25 } else { 5. },
                ) * z,
                d.y.atan2(d.x),
                0xffffff,
                if dart { 2.6 } else { 2. },
                Kind::Soft,
                Blend::Add,
                0.,
            );
        }
        let a = time - b.arrival;
        if back || !(0. ..0.44).contains(&a) {
            continue;
        }
        let q = a / 0.44;
        let fade = (1. - q).powf(1.7);
        let g = if b.arrival == latest { 1.12 } else { 1. };
        let rx = (17. + 10. * q) * z * g;
        f.ring(
            foot,
            vec2(rx, rx * 0.47),
            1.1 * z,
            0xffd83c,
            fade * 0.85,
            40,
        );
        for j in 0..4 {
            let a = j as f32 * TAU / 4.;
            let v = vec2(a.cos(), a.sin());
            f.line(
                foot + v * vec2(rx - 3. * z, rx * 0.47 - 2. * z),
                foot + v * vec2(rx + 4. * z, rx * 0.47 + 4. * z),
                1.1 * z,
                0xfff4a0,
                fade,
            );
        }
        for (size, col, alpha) in [
            ((28. + 15. * q) * g, 0xffc92e, 0.75),
            ((15. + 9. * q) * g, 0xfff1b4, 1.5),
            (7. + 4. * q, 0xffffff, 2.),
        ] {
            f.glow(hit, size * z, col, fade * alpha);
        }
        for j in 0..b.lines {
            let a = b.angle + j as f32 / b.lines as f32 * TAU;
            let v = vec2(a.cos(), a.sin());
            let inner = (5. + 18. * q) * z;
            let outer = inner + (23. + 10. * (j as f32 * 4.3).sin()) * (1. - q) * z * g;
            f.line(hit + v * inner, hit + v * outer, 1.05 * z, 0xffe36a, fade);
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn five_paths_count_spread_and_first_arrival() {
        for seed in 0..10000 {
            let m = Model::new(seed);
            assert!((8..=12).contains(&m.beams.len()));
            let mut counts = [0; 5];
            for b in &m.beams {
                counts[b.path] += 1;
                assert!((0.675..=0.725).contains(&b.flight));
                for other in &m.beams {
                    if !std::ptr::eq(b, other) && b.path == other.path {
                        assert!((b.launch - other.launch).abs() >= 0.07999);
                    }
                }
            }
            assert!(counts.iter().all(|n| *n > 0));
            assert!(counts.iter().max().unwrap() - counts.iter().min().unwrap() >= 2);
            assert!(
                (m.beams
                    .iter()
                    .map(|b| b.arrival)
                    .fold(f32::INFINITY, f32::min)
                    - 0.9)
                    .abs()
                    < 0.00001
            );
            assert!(m.end <= 2.39001);
        }
    }
    #[test]
    fn models_replay_and_paths_ignore_count() {
        let a = Model::new(1456);
        let b = Model::new(1456);
        assert_eq!(a.beams.len(), b.beams.len());
        for (a, b) in a.beams.iter().zip(&b.beams) {
            assert_eq!(a.launch, b.launch);
            assert_eq!(a.path, b.path);
        }
    }
}
