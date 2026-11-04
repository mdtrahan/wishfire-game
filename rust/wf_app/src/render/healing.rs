//! Source-tagged recipient effects; cast glows and heal numbers remain independent.
use super::vfx3d::*;
use crate::{
    assets::{Assets, DrawStats},
    camera::WorldCamera,
};
use macroquad::prelude::*;
use wf_combat::{ActorState, Archetype, Event, HealSource, Snapshot, Team, Vec2 as WorldPos};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum HeroVisual { Blessing, GreenAura, None }

fn hero_visual(source: HealSource) -> HeroVisual {
    match source {
        HealSource::HealingSpring => HeroVisual::Blessing,
        HealSource::Mend | HealSource::Breather | HealSource::Revive
        | HealSource::Phoenix | HealSource::SpringTick => HeroVisual::GreenAura,
        HealSource::PartyRestore | HealSource::EnemyHeal | HealSource::EnemyRegen => HeroVisual::None,
        #[allow(unreachable_patterns)]
        _ => HeroVisual::Blessing,
    }
}

const AURA_HOLD: f64 = 0.15;
const AURA_FADE: f64 = 0.30;

/// Full-snapshot observation keeps target glows identical across actor/spotlight layers.
#[derive(Default)]
pub struct TargetAuras {
    landed: std::collections::BTreeMap<u32, f64>,
    time: f64,
}
impl TargetAuras {
    pub fn update(&mut self, s: &Snapshot, events: &[Event]) {
        self.time = s.combat_time;
        let events = if let Some(i) = events.iter().rposition(|e|
            matches!(e, Event::SceneReset | Event::WaveReset | Event::StageCleared)) {
            self.landed.clear();
            &events[i + 1..]
        } else { events };
        for event in events {
            match *event {
                Event::Healed { target, amount, source }
                    if amount > 0. && hero_visual(source) == HeroVisual::GreenAura => {
                    self.landed.insert(target, self.time);
                }
                Event::Downed { id } | Event::Died { id } => { self.landed.remove(&id); }
                _ => {}
            }
        }
        self.landed.retain(|id, at| self.time - *at < AURA_HOLD + AURA_FADE
            && s.actors.iter().any(|a| a.id == *id && a.team == Team::Hero && a.hp > 0.));
    }
    pub fn level(&self, id: u32) -> f32 {
        self.landed.get(&id).map_or(0., |at|
            1. - s(((self.time - at - AURA_HOLD) / AURA_FADE) as f32))
    }
    pub fn palette() -> [Color; 4] {
        [Color::from_hex(super::vfx::HEAL_GREEN); 4]
    }
}
struct Riser {
    x: f32,
    z: f32,
    h: f32,
    w: f32,
    phase: f32,
    speed: f32,
}
struct Shaft {
    x: f32,
    h: f32,
    w: f32,
    phase: f32,
}
struct Mote {
    x: f32,
    y: f32,
    z: f32,
    size: f32,
    phase: f32,
    end: f32,
    start: f32,
    freq: f32,
    life: f32,
    peak: f32,
    hero: bool,
    star: bool,
}
struct Model {
    seed: u32,
    risers: Vec<Riser>,
    wisps: [f32; 6],
    shafts: Vec<Shaft>,
    motes: Vec<Mote>,
}
impl Model {
    fn new(seed: u32) -> Self {
        let mut r = Rng(seed);
        let risers = (0..56)
            .map(|_| {
                let angle = r.next() * TAU;
                let radius = 8. + r.next() * 36.;
                Riser {
                    x: angle.cos() * radius,
                    z: angle.sin() * radius,
                    h: 110. + r.next() * 130.,
                    w: 0.55 + r.next() * 0.8,
                    phase: r.next(),
                    speed: 0.7 + r.next() * 0.7,
                }
            })
            .collect();
        let wisps = std::array::from_fn(|_| r.next() * TAU);
        let shafts = (0..6)
            .map(|i| Shaft {
                x: ((i as f32 / 5. - 0.5) * 2. + (r.next() - 0.5) * 0.09) * 17.,
                h: 137. + r.next() * 54.,
                w: 9. + r.next() * 6.,
                phase: r.next(),
            })
            .collect();
        let motes = (0..32)
            .map(|i| {
                let phase = r.next();
                let end = 3.5 + phase * 0.65;
                let star = i < 28;
                let hero = i < 2;
                let size_seed = if i < 4 { phase } else { r.next() };
                let size = if hero {
                    16. + size_seed * 6.
                } else if i < 8 {
                    8. + size_seed * 4.
                } else {
                    3. + size_seed * 2.
                };
                let x = (i as f32 % 7. / 6. - 0.5) * 66.;
                let y = 8. + (i / 7) as f32 * 24. + r.next() * 13.;
                let z = (r.next() - 0.5) * 8.;
                let start = 1.35 + r.next() * 0.6;
                let freq = 1.4 + r.next() * 2.;
                Mote {
                    x,
                    y,
                    z,
                    size,
                    phase,
                    end,
                    start: if hero {
                        1.2 + phase * 0.1 + i as f32 * 0.2
                    } else {
                        start
                    },
                    freq,
                    life: if hero {
                        0.32 + phase * 0.15
                    } else {
                        end - start
                    },
                    peak: if hero {
                        0.85 + phase * 0.15
                    } else if star {
                        0.5 + phase * 0.5
                    } else {
                        1.
                    },
                    hero,
                    star,
                }
            })
            .collect();
        Self {
            seed,
            risers,
            wisps,
            shafts,
            motes,
        }
    }
}
struct Blessing {
    caster: u32,
    target: u32,
    source: WorldPos,
    position: WorldPos,
    born: f64,
    windup: f32,
    healed: Option<f64>,
    model: Model,
}
#[derive(Default)]
pub struct Healing {
    casts: Vec<Blessing>,
}
impl Healing {
    pub fn start(&mut self, caster: u32, target: u32, s: &Snapshot) {
        if self
            .casts
            .iter()
            .any(|x| x.caster == caster && x.target == target && x.born == s.time)
        {
            return;
        }
        let Some(a) = s.actors.iter().find(|a| a.id == caster) else {
            return;
        };
        let Some(b) = s.actors.iter().find(|a| a.id == target) else {
            return;
        };
        self.casts.retain(|x| x.caster != caster || x.healed.is_some());
        self.casts.push(Blessing {
            caster,
            target,
            source: a.pos,
            position: b.pos,
            born: s.time,
            windup: (a.state_duration - a.state_age).max(0.001),
            healed: None,
            model: Model::new(seed(caster, s.time)),
        });
    }
    fn land(&mut self, caster: Option<u32>, target: u32, source: HealSource, s: &Snapshot) {
        let Some(recipient) = s.actors.iter().find(|a| a.id == target && a.hp > 0.) else {
            return;
        };
        if let Some(cast) = self.casts.iter_mut().rev().find(|x| {
            source == HealSource::HealingSpring && x.target == target && x.healed.is_none()
                && caster.is_none_or(|id| x.caster == id)
                && s.time + wf_combat::SIM_DT as f64 >= x.born + x.windup as f64
        }) {
            cast.healed = Some(s.time);
            cast.position = recipient.pos;
            return;
        }
        // Repeated full restores share the playing blessing; never restart its retreat.
        // Explicit enemy actions can overlap, but their paired Healed event cannot duplicate them.
        if self.casts.iter().any(|x| x.target == target && x.healed.is_some_and(|at| {
            at == s.time || caster.is_none() && (0. ..3.2).contains(&(s.time - at))
        })) {
            return;
        }
        self.casts.push(Blessing {
            caster: caster.unwrap_or(target), target,
            source: recipient.pos, position: recipient.pos,
            born: s.time, windup: 0., healed: Some(s.time),
            model: Model::new(seed(caster.unwrap_or(target), s.time)),
        });
    }
    pub fn ingest(&mut self, events: &[Event], s: &Snapshot) {
        let events = if let Some(reset) = events.iter().rposition(|e|
            matches!(e, Event::SceneReset | Event::WaveReset | Event::StageCleared)) {
            self.casts.clear();
            &events[reset + 1..]
        } else { events };
        self.casts.retain(|x| {
            let alive = |id| s.actors.iter().any(|a| a.id == id && a.hp > 0.);
            alive(x.target) && alive(x.caster) && x.healed.map_or_else(|| {
                let landing = s.time + wf_combat::SIM_DT as f64 >= x.born + x.windup as f64
                    && events.iter().any(|e| matches!(e, Event::Healed { target, amount, source: HealSource::HealingSpring } if *target == x.target && *amount > 0.));
                s.time - x.born < (x.windup + 0.3) as f64 && s.actors.iter().any(|a|
                    a.id == x.caster && (a.state == ActorState::Cast || landing) && a.encased <= 0.)
            }, |at| s.time - at < 3.2)
        });
        // Capture casts first so batched start/landing events share one record.
        for event in events {
            match *event {
                Event::SkillStarted { id, skill: wf_combat::Skill::HealingSpring, target: Some(target) }
                | Event::ActionStarted { id, state: ActorState::Cast, target: Some(target) }
                    if s.actors.iter().any(|a| a.id == id && a.archetype == Archetype::Runa && a.hp > 0.)
                    && s.actors.iter().any(|a| a.id == target && a.team == Team::Hero && a.hp > 0.) => {
                    self.start(id, target, s);
                }
                _ => {}
            }
        }
        // Source-bearing enemy events win over the paired, source-free Healed event.
        for event in events {
            if let Event::EnemyHealed { healer, target, amount } = *event {
                if amount > 0. && s.actors.iter().any(|a| a.id == healer && a.hp > 0. && a.team == Team::Enemy)
                    && s.actors.iter().any(|a| a.id == target && a.team == Team::Enemy) {
                    self.land(Some(healer), target, HealSource::EnemyHeal, s);
                }
            }
        }
        for event in events {
            match *event {
                Event::Healed { target, amount, source } if amount > 0.
                    && !events.iter().any(|e| matches!(e, Event::EnemyHealed { target: id, amount, .. } if *id == target && *amount > 0.))
                    // Chimerilass self-regen is passive: its approved aura/tick stays separate.
                    && s.actors.iter().any(|a| a.id == target && if a.team == Team::Hero {
                        hero_visual(source) == HeroVisual::Blessing
                    } else { a.archetype != Archetype::BossBomber }) => {
                    self.land(None, target, source, s);
                }
                Event::Died { id } | Event::Downed { id } => {
                    self.casts.retain(|x| x.target != id && x.caster != id);
                }
                Event::Encased { id, .. } | Event::BossStaggered { id, interrupted: true } => {
                    self.casts.retain(|x| x.caster != id || x.healed.is_some());
                }
                Event::ActionStarted { id, state, .. } if state != ActorState::Cast => {
                    self.casts.retain(|x| x.caster != id || x.healed.is_some());
                }
                _ => {}
            }
        }
        for x in &mut self.casts {
            if let Some(a) = s.actors.iter().find(|a| a.id == x.target) { x.position = a.pos; }
        }
    }
    pub fn take(&mut self, from: &mut Self, source_time: f64, target: &Snapshot) {
        let delta = target.time - source_time;
        super::spotlight::transfer(
            &mut from.casts,
            &mut self.casts,
            |x| {
                target.actors.iter().any(|a| {
                    a.id == if x.healed.is_some() {
                        x.target
                    } else {
                        x.caster
                    }
                })
            },
            |x| {
                x.born += delta;
                if let Some(at) = &mut x.healed {
                    *at += delta;
                }
            },
        );
    }
    pub fn busy(&self, time: f64) -> bool {
        self.casts
            .iter()
            .any(|x| x.healed.is_some_and(|at| (0. ..3.2).contains(&(time - at))))
    }
    pub fn owns(&self, id: u32) -> bool {
        self.casts.iter().any(|x| x.target == id && x.healed.is_none())
    }
    pub fn records(&self) -> usize {
        self.casts.len()
    }
    #[cfg(test)]
    pub fn recipients(&self) -> Vec<(u32, WorldPos)> {
        self.casts
            .iter()
            .filter(|x| x.healed.is_some())
            .map(|x| (x.target, x.position))
            .collect()
    }
    pub fn age(&self, time: f64) -> f32 {
        self.casts
            .iter()
            .rev()
            .find_map(|x| x.healed.map(|at| (time - at) as f32))
            .unwrap_or(-1.)
    }
    pub fn ground(
        &self,
        _: &Assets,
        camera: &WorldCamera,
        snapshot: &Snapshot,
        stats: &mut DrawStats,
    ) {
        self.draw(camera, snapshot, stats, false);
    }
    pub fn front(
        &self,
        assets: &Assets,
        camera: &WorldCamera,
        snapshot: &Snapshot,
        stats: &mut DrawStats,
    ) {
        self.draw(camera, snapshot, stats, true);
        for x in &self.casts {
            if let Some(at) = x.healed {
                let q = 1.2 + (snapshot.time - at) as f32;
                let lift = heal_lift(q);
                if lift > 0. {
                    if let Some(a) = snapshot
                        .actors
                        .iter()
                        .find(|a| a.id == x.target && a.hp > 0.)
                    {
                        illuminate(assets, camera, a, lift, stats);
                    }
                }
            }
        }
    }
    fn draw(&self, camera: &WorldCamera, snapshot: &Snapshot, stats: &mut DrawStats, front: bool) {
        let mut f = Frame::default();
        let mut smooth = Frame::default();
        let z = zscale(camera);
        for x in &self.casts {
            if !snapshot.actors.iter().any(|a| a.id == if x.healed.is_some() { x.target } else { x.caster } && a.hp > 0.) {
                continue;
            }
            let t = if let Some(at) = x.healed {
                1.2 + (snapshot.time - at) as f32
            } else {
                1.2 * c((snapshot.time - x.born) as f32 / x.windup)
            };
            let caster = anchor(camera, snapshot, x.caster, x.source);
            let recipient = anchor(camera, snapshot, x.target, x.position);
            // Pending Runa casts retain target pairing only; their caster package is retired.
            // Direct landed blessings keep their existing target decoration unchanged.
            if !front && x.windup == 0. {
                let envelope = s(t / 0.5) * (1. - s((t - 0.65) / 0.55));
                disc(&mut f, caster, 45. * z, envelope, t);
                for r in &x.model.risers {
                    let rise = (t * r.speed + r.phase).rem_euclid(1.);
                    let h = r.h * (0.4 + 0.6 * (rise * std::f32::consts::PI).sin());
                    let p = caster + project(vec3(r.x, rise * 0.22 * r.h + h * 0.5, r.z) * z);
                    f.quad(
                        p,
                        vec2(r.w, h) * z,
                        0.,
                        0xffef94,
                        envelope * s((t - r.phase * 0.3) / 0.45) * 0.85,
                        Kind::Streak,
                        Blend::Add,
                        r.phase * 6.,
                    );
                }
                for (i, angle) in x.model.wisps.iter().enumerate() {
                    let age = t - i as f32 / 6. * 0.5;
                    let q = c(age / 1.2);
                    let p = caster
                        + project(vec3(angle.cos() * 27., 8. + q * 190., angle.sin() * 10.) * z);
                    f.ring(
                        p,
                        Vec2::splat(4.45 * z),
                        1.3 * z,
                        0x9470e2,
                        0.82 * s(age / 0.32) * (1. - s((age - 0.75) / 0.35)),
                        12,
                    );
                }
            }
            record(
                3,
                [
                    1.,
                    t,
                    x.model.seed as f32,
                    32.,
                    recipient.x,
                    recipient.y,
                    caster.x,
                    caster.y,
                ],
            );
            record_seed(3, x.model.seed);
            if x.healed.is_none() {
                continue;
            }
            let q = t;
            record(
                3,
                [1., q, 0., 32., recipient.x, recipient.y, caster.x, caster.y],
            );
            let on = s((q - 1.2) / 0.5);
            let ret = s((q - 2.6) / 1.2);
            let energy = on * (1. - ret);
            if !front {
                disc(
                    &mut f,
                    recipient,
                    23. * z,
                    on * (1. - s((q - 2.6) / 1.1)) * 0.7,
                    q - 1.2,
                );
                f.quad(
                    recipient - vec2(0., 70. * z),
                    vec2(47., 195.) * z,
                    0.,
                    0xffd77b,
                    0.18 * energy * (1. - ret),
                    Kind::Soft,
                    Blend::Add,
                    0.,
                );
                f.time = q;
                for r in &x.model.shafts {
                    let retreat = s((q - 2.6 - r.phase * 0.15) / 1.);
                    let lower = (1. - on) * 80. + 220. * retreat;
                    let h = r.h * (1. - 0.56 * retreat);
                    let p = recipient + project(vec3(r.x, lower + h * 0.5, 0.) * z);
                    let alpha = on
                        * (1. - retreat)
                        * (0.64 + 0.20 * (q * (2.2 + 3. * r.phase) + r.phase * TAU).sin());
                    f.quad(
                        p,
                        vec2((r.w * (1. - 0.97 * retreat)).max(0.005), h) * z,
                        0.,
                        0xffffff,
                        alpha,
                        Kind::Shaft,
                        Blend::Alpha,
                        r.phase * 6.,
                    );
                }
            } else {
                for m in &x.model.motes {
                    let tw = (0.5 + 0.5 * (q * m.freq * TAU + m.phase * TAU).sin()).powf(1.2);
                    let birth = s((q - m.start) / 0.3);
                    let tail = 1. - s((q - (m.end - 0.35)) / 0.35);
                    let age = (q - m.start).rem_euclid(0.8 + m.freq * 0.015);
                    let hero = if q >= m.start && q < 3.65 && age < m.life {
                        (age / m.life * std::f32::consts::PI).sin().powf(1.5)
                    } else {
                        0.
                    };
                    let alpha = m.peak
                        * if m.hero {
                            hero
                        } else {
                            birth * tail * (0.06 + 0.94 * tw)
                        };
                    let p = recipient + project(vec3(m.x, m.y + c(q - 2.6) * 7., m.z) * z);
                    if m.star {
                        f.quad(
                            p,
                            Vec2::splat(m.size * z),
                            0.,
                            0xfffef2,
                            alpha,
                            Kind::Star,
                            Blend::Add,
                            0.,
                        );
                    } else {
                        smooth.quad(
                            p,
                            Vec2::splat(m.size * (0.58 + tw * 0.42) * z),
                            0.,
                            0xfff5b0,
                            alpha,
                            Kind::Orb,
                            Blend::Add,
                            0.,
                        );
                    }
                }
            }
        }
        f.draw(stats);
        smooth.draw_full(stats);
    }
}
fn disc(f: &mut Frame, p: Vec2, r: f32, a: f32, t: f32) {
    f.time = t;
    f.quad(
        p,
        vec2(r * 2., r * 1.5),
        0.,
        0xffffff,
        a * 0.78,
        Kind::Rings,
        Blend::Add,
        0.,
    );
    f.quad(
        p,
        vec2(r * 2.25, r * 2.25 * 0.75),
        0.,
        0xffd77b,
        a * 0.62,
        Kind::Soft,
        Blend::Add,
        0.,
    );
}
pub fn heal_lift(q: f32) -> f32 {
    0.2 * s((q - 1.2) / 0.5) * (1. - s((q - 2.6) / 1.2))
}
#[cfg(test)]
mod tests {
    use super::*;
    fn scene() -> Snapshot {
        let mut s = crate::testing::sim().snapshot().clone();
        let mut healer = s.actors[0].clone();
        healer.id = 90; healer.team = Team::Enemy; healer.archetype = Archetype::Marid;
        healer.pos = WorldPos { x: 400., y: 600. };
        let mut target = healer.clone(); target.id = 91; target.archetype = Archetype::Orc;
        target.pos.x += 100.;
        s.actors.extend([healer, target]); s
    }
    #[test]
    fn enemy_actions_keep_one_blessing_and_chimerilass_regen_keeps_none() {
        for kind in [Archetype::Marid, Archetype::BossBomber] {
            let mut s = scene(); s.actors.iter_mut().find(|a|a.id == 90).unwrap().archetype = kind;
            let mut fx = Healing::default(); let mut aura = TargetAuras::default();
            fx.ingest(&[Event::EnemyHealCast { healer:90, target:91, seconds:0.8 }], &s);
            assert_eq!(fx.records(), 0);
            s.time += 0.8;
            let events = [Event::Healed { target:91, amount:25., source:HealSource::EnemyHeal },
                Event::EnemyHealed { healer:90, target:91, amount:25. }];
            fx.ingest(&events, &s); aura.update(&s, &events);
            assert_eq!(fx.recipients(), vec![(91, s.actors.last().unwrap().pos)]);
            assert_eq!(fx.records(), 1); assert!(fx.busy(s.time));
            assert_eq!(fx.casts[0].caster, 90); assert_eq!(aura.level(91), 0.);
            s.time += 3.21; fx.ingest(&[], &s); assert_eq!(fx.records(), 0);
        }
    }
    #[test]
    fn green_aura_holds_fades_refreshes_and_freezes_on_combat_time() {
        let mut s = scene(); let target = s.actors[0].id;
        let heal = Event::Healed { target, amount:0.42, source:HealSource::Breather };
        let mut aura = TargetAuras::default(); aura.update(&s, &[heal.clone()]);
        assert_eq!(aura.level(target), 1.);
        s.combat_time = 0.15; aura.update(&s, &[]); assert_eq!(aura.level(target), 1.);
        s.combat_time = 0.30; aura.update(&s, &[]); assert!((aura.level(target) - 0.5).abs() < 1e-6);
        s.time = 10.; aura.update(&s, &[]); assert!((aura.level(target) - 0.5).abs() < 1e-6);
        s.combat_time = 0.45; aura.update(&s, &[]); assert_eq!(aura.level(target), 0.);
        for i in 1..=90 {
            s.combat_time = 1. + i as f64 / 30.; aura.update(&s, &[heal.clone()]);
            assert_eq!(aura.level(target), 1.); assert_eq!(aura.landed.len(), 1);
        }
        s.combat_time += 0.30; aura.update(&s, &[]); assert!((aura.level(target) - 0.5).abs() < 1e-6);
        s.combat_time += 0.16; aura.update(&s, &[]); assert_eq!(aura.level(target), 0.);
        for event in [Event::Downed { id:target }, Event::Died { id:target },
            Event::SceneReset, Event::WaveReset, Event::StageCleared] {
            aura.update(&s, &[heal.clone()]); aura.update(&s, &[event]); assert_eq!(aura.level(target), 0.);
        }
        aura.update(&s, &[Event::Healed { target, amount:0., source:HealSource::Mend }]);
        assert_eq!(aura.level(target), 0.);
        s.actors[0].hp = 0.; aura.update(&s, &[heal.clone()]); assert_eq!(aura.level(target), 0.);
        s.actors.remove(0); aura.update(&s, &[heal]); assert_eq!(aura.level(target), 0.);
    }
    #[test]
    fn scene_restores_and_bare_revives_cannot_create_recipient_effects() {
        let s = scene(); let target = s.actors[0].id;
        for reset in [Event::SceneReset, Event::WaveReset, Event::StageCleared] {
            let minor = Event::Healed { target, amount:3., source:HealSource::Mend };
            let events = [minor, reset, Event::Revived { id:target },
                Event::Healed { target, amount:100., source:HealSource::PartyRestore }];
            let mut fx = Healing::default(); let mut aura = TargetAuras::default();
            fx.ingest(&events, &s); aura.update(&s, &events);
            assert_eq!(fx.records(), 0); assert_eq!(aura.level(target), 0.);
        }
    }
    #[test]
    fn continuous_healing_never_restarts_the_tail_and_zero_heals_do_nothing() {
        let mut s = scene(); let id = s.actors[0].id; let mut fx = Healing::default();
        fx.ingest(&[Event::Healed { target:id, amount:0., source: wf_combat::HealSource::HealingSpring }, Event::Healed { target:999, amount:5., source: wf_combat::HealSource::HealingSpring }], &s);
        assert_eq!(fx.records(), 0);
        let heal = Event::Healed { target:id, amount:1., source: wf_combat::HealSource::HealingSpring };
        fx.ingest(&[heal.clone()], &s);
        for i in 1..96 {
            s.time = i as f64 / 30.; fx.ingest(&[heal.clone()], &s);
            assert_eq!(fx.records(), 1); assert_eq!(fx.casts[0].healed, Some(0.));
        }
        s.time = 3.21; fx.ingest(&[], &s); assert_eq!(fx.records(), 0);
        fx.ingest(&[heal], &s); assert_eq!(fx.casts[0].healed, Some(3.21));
    }
    #[test]
    fn early_passive_heal_cannot_release_runas_committed_prelude() {
        let mut s = scene(); let caster = s.actors[2].id; let target = s.actors[0].id;
        s.actors[2].state = ActorState::Cast; s.actors[2].state_duration = 0.8;
        let mut fx = Healing::default();
        fx.ingest(&[Event::SkillStarted { id:caster, skill:wf_combat::Skill::HealingSpring, target:Some(target) }], &s);
        s.time = 0.1; fx.ingest(&[Event::Healed { target, amount:1., source:HealSource::Breather }], &s);
        assert!(fx.owns(target)); assert!(fx.recipients().is_empty());
        s.time = 0.8;
        fx.ingest(&[Event::Healed { target, amount:10., source:HealSource::Mend }], &s);
        assert!(fx.owns(target)); assert!(fx.recipients().is_empty());
        s.time = 0.8; s.actors[2].state = ActorState::Idle;
        fx.ingest(&[Event::Healed { target, amount:30., source: wf_combat::HealSource::HealingSpring }], &s);
        assert!(!fx.owns(target)); assert_eq!(fx.recipients().len(), 1);
        assert_eq!(fx.casts[0].healed, Some(0.8));
    }
    #[test]
    fn passive_chimerilass_regen_keeps_v6_but_an_explicit_heal_still_blesses_it() {
        let mut s = scene(); s.actors.last_mut().unwrap().archetype = Archetype::BossBomber;
        let mut fx = Healing::default();
        fx.ingest(&[Event::RegenStarted { id:91, total:30., seconds:5. }, Event::Healed { target:91, amount:3., source: HealSource::EnemyRegen }], &s);
        assert_eq!(fx.records(), 0);
        fx.ingest(&[Event::EnemyHealed { healer:90, target:91, amount:30. }, Event::Healed { target:91, amount:30., source: HealSource::EnemyHeal }], &s);
        assert_eq!(fx.recipients(), vec![(91, s.actors.last().unwrap().pos)]);
        assert_eq!(fx.records(), 1);
    }
    #[test]
    fn interrupted_cast_death_removal_and_resets_discard_instances() {
        let mut s = scene(); let caster = s.actors[2].id; let target = s.actors[0].id;
        s.actors[2].state = ActorState::Cast; s.actors[2].state_duration = 0.8;
        let cast = Event::SkillStarted { id:caster, skill:wf_combat::Skill::HealingSpring, target:Some(target) };
        for interruption in [Event::Encased { id:caster, seconds:1. },
            Event::ActionStarted { id:caster, state:ActorState::Hurt, target:None },
            Event::Downed { id:caster }, Event::Died { id:target },
            Event::SceneReset, Event::WaveReset, Event::StageCleared] {
            let mut fx = Healing::default(); fx.ingest(&[cast.clone()], &s);
            assert_eq!(fx.records(), 1); assert!(!fx.busy(s.time));
            fx.ingest(&[interruption], &s); assert_eq!(fx.records(), 0);
        }
        let mut fx = Healing::default(); fx.ingest(&[cast], &s);
        s.actors[2].state = ActorState::Idle;
        fx.ingest(&[], &s); assert_eq!(fx.records(), 0);
        for event in [Event::Downed { id:target }, Event::SceneReset, Event::WaveReset, Event::StageCleared] {
            fx.ingest(&[Event::Healed { target, amount:10., source: wf_combat::HealSource::HealingSpring }], &s); assert!(fx.busy(s.time));
            fx.ingest(&[event], &s); assert_eq!(fx.records(), 0); assert!(!fx.busy(s.time));
        }
        fx.ingest(&[Event::EnemyHealed { healer:90, target:91, amount:10. }], &s);
        s.actors.retain(|a| a.id != 90); fx.ingest(&[], &s); assert_eq!(fx.records(), 0);
        fx.ingest(&[Event::Healed { target, amount:10., source: wf_combat::HealSource::HealingSpring }], &s);
        s.actors[0].hp = 0.; fx.ingest(&[], &s); assert_eq!(fx.records(), 0);
    }
    #[test]
    fn blessing_follows_recipient_and_rebases_once_between_clocks() {
        let mut s = scene(); s.time = 4.; let id = s.actors[0].id;
        let mut bg = Healing::default(); let mut fg = Healing::default();
        bg.ingest(&[Event::Healed { target:id, amount:10., source: wf_combat::HealSource::HealingSpring }], &s);
        s.actors[0].pos.x += 50.; s.time = 10.;
        let mut target = s.clone(); target.actors.truncate(1);
        fg.take(&mut bg, 4., &target); fg.ingest(&[], &s);
        assert_eq!(bg.records(), 0); assert_eq!(fg.records(), 1);
        assert_eq!(fg.recipients(), vec![(id, s.actors[0].pos)]);
        for _ in 0..40 { fg.ingest(&[], &s); assert!(fg.busy(s.time)); }
        s.time += 1.; target.time = 4.;
        bg.take(&mut fg, s.time, &target); bg.ingest(&[], &target);
        assert_eq!(fg.records(), 0); assert!((bg.age(target.time) - 1.).abs() < 1e-5);
        target.time += 2.21; bg.ingest(&[], &target); assert_eq!(bg.records(), 0);
    }
    #[test]
    fn release_is_exact_and_motes_have_independent_lifetimes() {
        assert_eq!(heal_lift(3.8), 0.);
        assert_eq!(heal_lift(4.4), 0.);
        assert!(heal_lift(2.) > 0.);
        let m = Model::new(137);
        assert_eq!(m.risers.len(), 56);
        assert_eq!(m.shafts.len(), 6);
        assert_eq!(m.motes.iter().filter(|m| m.hero).count(), 2);
        assert_eq!(m.motes.iter().filter(|m| m.star).count(), 28);
        assert_ne!(m.motes[8].end, m.motes[9].end);
    }
}
