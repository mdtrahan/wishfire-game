//! Opt-in investigator classifier. Inactive outside an explicit benchmark run.
use super::*;
use std::{
    cell::RefCell,
    collections::BTreeMap,
    fs::File,
    io::{BufWriter, Write},
};
use tuning::*;
#[derive(Clone, Default)]
pub struct Frame {
    pub step: u64,
    pub pos: Vec2,
    pub goal: Vec2,
    pub d: [Vec2; 4],
    pub other: Vec2,
    pub intent: String,
    pub planted: f32,
    pub invalid: bool,
    pub other_hazard: bool,
    pub inside: bool,
    pub remaining: f32,
    pub caught: bool,
    pub deflection: Vec2,
}
pub struct Track {
    pub seed: u64,
    pub tier: u8,
    pub hero: u32,
    pub kind: HazardKind,
    pub notice: u64,
    pub origin: Vec2,
    pub shape: Shape,
    pub pos: Vec2,
    pub speed: f32,
    pub delay: f32,
    pub required: f32,
    pub planned: f32,
    pub planted: f32,
    pub frames: Vec<Frame>,
    pub initial: Actor,
    pub live: Hazard,
    pub impact: Option<Hazard>,
    pub contact: Vec2,
    pub caught: bool,
}
pub struct Run {
    pub seed: u64,
    pub before: [Vec2; 4],
    pub d: [[Vec2; 4]; 4],
    pub deflection: [Vec2; 4],
    pub tracks: BTreeMap<(u32, u32), Track>,
    pub summary: BufWriter<File>,
    pub trace: BufWriter<File>,
    pub counts: [u32; 3],
    pub tiers: [u32; 3],
    pub untracked: u32,
}
thread_local! { pub static RUN:RefCell<Option<Run>>=const {RefCell::new(None)}; }
pub fn mutate(f: impl FnOnce(&mut Run)) {
    RUN.with(|r| {
        if let Some(r) = r.borrow_mut().as_mut() {
            f(r)
        }
    });
}
pub fn begin(s: &Sim) {
    mutate(|r| {
        r.d = [[Vec2::default(); 4]; 4];
        r.deflection = [Vec2::default(); 4];
        for (i, a) in s.actors.iter().take(4).enumerate() {
            r.before[i] = a.view.pos;
        }
    });
}
pub fn deflection(i: usize, d: Vec2) {
    mutate(|r| {
        if i < 4 {
            r.deflection[i] = d;
        }
    });
}
pub fn movement(i: usize, steering: Vec2, wall: Vec2) {
    mutate(|r| {
        if i < 4 {
            r.d[i][0] = r.d[i][0] + steering;
            r.d[i][3] = r.d[i][3] + wall;
        }
    });
}
pub fn correction(i: usize, mechanism: usize, delta: Vec2) {
    mutate(|r| {
        if i < 4 {
            let k = match mechanism {
                0 => 1,
                1 => 2,
                _ => 3,
            };
            r.d[i][k] = r.d[i][k] + delta;
        }
    });
}
pub fn escape(h: &Hazard, p: Vec2, body: f32) -> f32 {
    if !h.hits(p, h.hit_radius(body)) {
        return 0.;
    }
    let mut best = f32::INFINITY;
    // Conservative upper bound on the shortest wall-valid body-clear displacement.
    for n in 0..128 {
        let ray = math::direction(n as f32 * TAU / 128.);
        let mut d = 2.;
        while d < best.min(2400.) {
            let q = p + ray * d;
            if q != math::floor_point(q, body) {
                break;
            }
            if !h.hits(q, h.hit_radius(body)) {
                best = d;
                break;
            }
            d += 2.;
        }
    }
    best
}
pub fn planted(a: &Actor) -> f32 {
    if a.committed() && !a.action_revive {
        (a.view.impact_at - a.view.state_age).max(0.)
    } else {
        0.
    }
}
// Counterfactual with the production acceleration/turn/arrival rules, but no
// cohesion, boss displacement, other-warning deflection or AI replanning. Search
// 128 wall-valid radial exits; report a sampled estimate, not an optimality proof.
pub fn free_escape(initial: &Actor, h: &Hazard, hold: f32) -> f32 {
    let p = initial.view.pos;
    let body = initial.view.radius;
    let hit_body = h.hit_radius(body);
    if !h.hits(p, hit_body) {
        return 0.;
    }
    let mut best = 20_f32;
    for n in 0..128 {
        let ray = math::direction(n as f32 * TAU / 128.);
        let mut distance = 2.;
        let mut goal = None;
        while distance < 2400. {
            let q = p + ray * distance;
            if q != math::floor_point(q, body) {
                break;
            }
            if !h.hits(q, hit_body + ESCAPE_MARGIN) {
                goal = Some(q);
                break;
            }
            distance += 4.;
        }
        let Some(goal) = goal else {
            continue;
        };
        let mut pos = p;
        let mut velocity = initial.velocity;
        let mut heading = initial.heading;
        for step in 0..libm::ceilf(best / SIM_DT) as u32 {
            if step as f32 * SIM_DT + 0.00001 < hold {
                continue;
            }
            let delta = goal - pos;
            let desired = delta.normalized() * initial.speed().min(delta.length() * 5.);
            (velocity, heading) = math::steer(desired, velocity, heading, initial.speed());
            pos = math::floor_point(pos + velocity * SIM_DT, body);
            if !h.hits(pos, hit_body) {
                best = best.min((step + 1) as f32 * SIM_DT);
                break;
            }
        }
    }
    best
}
pub fn notice(s: &Sim) {
    mutate(|r| {
        for h in s.hazards.iter().filter(|h| {
            h.view.hostile && h.view.team == Team::Enemy && h.view.phase != HazardPhase::Resolved
        }) {
            for (i, a) in s
                .actors
                .iter()
                .take(4)
                .enumerate()
                .filter(|(_, a)| a.alive())
            {
                if !h.known[i] && h.view.phase != HazardPhase::Active {
                    continue;
                }
                let key = (h.view.id, a.view.id);
                if r.tracks.contains_key(&key) {
                    continue;
                }
                r.tracks.insert(
                    key,
                    Track {
                        seed: r.seed,
                        tier: s.diagnostic_tier,
                        hero: a.view.id,
                        kind: h.view.kind,
                        notice: s.step_number,
                        origin: h.view.origin,
                        shape: h.view.shape,
                        pos: a.view.pos,
                        speed: a.speed(),
                        delay: h.delay[i],
                        required: escape(h, a.view.pos, a.view.radius),
                        planned: a.view.pos.distance(s.dodge_destination(i, h)),
                        planted: planted(a),
                        frames: Vec::new(),
                        initial: a.clone(),
                        live: h.clone(),
                        impact: None,
                        contact: Vec2::default(),
                        caught: false,
                    },
                );
            }
        }
    });
}
pub fn caught(s: &Sim, h: &Hazard, i: usize) {
    if i >= 4 {
        return;
    }
    mutate(|r| {
        if let Some(t) = r.tracks.get_mut(&(h.view.id, s.actors[i].view.id)) {
            t.caught = true;
            t.impact = Some(h.clone());
            t.contact = s.actors[i].view.pos;
        } else {
            r.untracked += 1;
        }
    });
}
pub fn caught_projectile(s: &Sim, hid: u32, i: usize) {
    if i >= 4 {
        return;
    }
    mutate(|r| {
        if let Some(t) = r.tracks.get_mut(&(hid, s.actors[i].view.id)) {
            t.caught = true;
            t.impact = Some(t.live.clone());
            t.contact = s.actors[i].view.pos;
        } else {
            r.untracked += 1;
        }
    });
}
pub fn finish(s: &Sim) {
    mutate(|r| {
        for (&(hid, hero), t) in &mut r.tracks {
            let i = hero as usize - 1;
            let Some(a) = s.actors.get(i) else {
                continue;
            };
            if let Some(h) = s.hazards.iter().find(|h| h.view.id == hid) {
                t.live = h.clone();
            }
            let h = &t.live;
            let d = r.d[i];
            let sum = d.iter().copied().fold(Vec2::default(), |a, b| a + b);
            t.frames.push(Frame {
                step: s.step_number,
                pos: a.view.pos,
                goal: a.destination,
                d,
                other: a.view.pos - r.before[i] - sum,
                intent: format!("{:?}", a.view.ai_intent),
                planted: planted(a),
                invalid: a.destination != math::floor_point(a.destination, a.view.radius),
                other_hazard: s.hazards.iter().any(|x| {
                    x.view.id != hid
                        && x.view.hostile
                        && x.view.team == Team::Enemy
                        && x.view.phase != HazardPhase::Resolved
                        && x.known[i]
                        && x.hits(a.destination, x.hit_radius(a.view.radius))
                }),
                inside: h.hits(a.view.pos, h.hit_radius(a.view.radius)),
                remaining: h.remaining(),
                caught: t.caught,
                deflection: r.deflection[i],
            });
        }
        let done: Vec<_> = r
            .tracks
            .iter()
            .filter(|((hid, _), t)| {
                t.caught
                    || (!s
                        .hazards
                        .iter()
                        .any(|h| h.view.id == *hid && h.view.phase != HazardPhase::Resolved)
                        && !s.projectiles.iter().any(|p| p.hit_hazard == Some(*hid)))
            })
            .map(|(key, _)| *key)
            .collect();
        for key in done {
            let t = r.tracks.remove(&key).unwrap();
            if !t.caught {
                continue;
            }
            let last = t.frames.last().unwrap();
            let available = (last.step - t.notice + 1) as f32 * SIM_DT;
            let impact = t.impact.as_ref().unwrap();
            let final_required = escape(impact, t.pos, t.initial.view.radius);
            let free = free_escape(&t.initial, impact, 0.);
            let free_planted = free_escape(&t.initial, impact, t.planted);
            let class = if free > available + 0.0001 {
                0
            } else if free_planted > available + 0.0001 {
                1
            } else {
                2
            };
            r.counts[class] += 1;
            r.tiers[(t.tier - 1) as usize] += 1;
            let mut lengths = [0.; 4];
            let mut net = [Vec2::default(); 4];
            let mut other = Vec2::default();
            let (mut actual, mut changes, mut bad, mut walls) = (0., 0, 0, 0);
            let mut prev = t.pos;
            let mut goal = t.frames[0].goal;
            for f in &t.frames {
                actual += prev.distance(f.pos);
                prev = f.pos;
                for k in 0..4 {
                    lengths[k] += f.d[k].length();
                    net[k] = net[k] + f.d[k];
                }
                other = other + f.other;
                if f.goal.distance(goal) > 0.1 {
                    changes += 1;
                    goal = f.goal;
                }
                bad += u32::from(f.other_hazard);
                walls += u32::from(f.invalid);
            }
            writeln!(r.summary,"{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}",t.seed,t.tier,key.0,t.hero,format!("{:?}",t.kind),['a','b','c'][class],t.notice,t.delay,available,t.required,t.planned,t.planted,t.speed,actual,t.pos.distance(last.pos),lengths[0],lengths[1],lengths[2],lengths[3],other.x,other.y,net[1].length(),changes,bad,walls,format!("\"{:?}\"",t.shape),t.origin.x,t.origin.y,final_required,free,free_planted,t.pos.x,t.pos.y,t.initial.velocity.x,t.initial.velocity.y,t.initial.heading.x,t.initial.heading.y,t.initial.view.radius,t.contact.x,t.contact.y).unwrap();
            for f in &t.frames {
                writeln!(r.trace,"{},{},{},{},{},{:.4},{:.3},{:.3},{:.3},{:.3},{},{:.4},{:.4},{},{},{},{},{:.4},{:.4},{:.4},{:.4},{:.4},{:.4},{:.4},{:.4},{:.4},{:.4},{:.4},{:.4}",t.seed,t.tier,key.0,t.hero,f.step,f.step as f32*SIM_DT,f.pos.x,f.pos.y,f.goal.x,f.goal.y,f.intent,f.planted,f.remaining,f.inside,f.other_hazard,f.invalid,f.caught,f.d[0].x,f.d[0].y,f.d[1].x,f.d[1].y,f.d[2].x,f.d[2].y,f.d[3].x,f.d[3].y,f.other.x,f.other.y,f.deflection.x,f.deflection.y).unwrap();
            }
        }
    });
}
