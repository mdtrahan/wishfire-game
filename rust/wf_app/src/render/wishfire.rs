//! Event-owned Split, ground zones and Shadow. Presentation clocks never schedule damage.
use crate::{
    assets::{Assets, DrawStats},
    camera::WorldCamera,
};
use macroquad::prelude::*;
use wf_combat::api::{ActorView, Element, Event, HazardKind, Snapshot, Vec2 as WorldPos};
struct Effect {
    texture: &'static str,
    pos: WorldPos,
    follow: Option<u32>,
    chest: f32,
    size: Vec2,
    born: f64,
    life: f64,
    rotation: f32,
}
impl Effect {
    fn position(&self,s:&Snapshot)->WorldPos {self.follow.and_then(|id|s.actors.iter().find(|a|a.id==id)).map_or(self.pos,|a|a.pos)}
}
struct Split {
    pos: WorldPos,
    chest: f32,
    targets: Vec<(WorldPos, f32, bool, bool)>,
    arc_origin: WorldPos,
    arc_chest: f32,
    arc_dir: WorldPos,
    born: f64,
}
pub(super) const SHADOW_DASH: f64 = 0.18;
pub(super) const SHADOW_IMPACT: f64 = 0.28;
const SHADOW_END: f64 = 0.75;
struct Shadow {
    hero: u32,
    target: u32,
    from: WorldPos,
    to: WorldPos,
    chest: f32,
    born: f64,
    impact: Option<f64>,
    facing: f32,
    victim: Option<ActorView>,
}
#[derive(Default)]
pub(super) struct Wishfire {
    effects: Vec<Effect>,
    splits: Vec<Split>,
    shadows: Vec<Shadow>,
    pub owned: Vec<(u32, u32)>,
    pub strike: Option<(u32, u32, f64)>,
    healing: super::healing::Healing,
}
pub fn chest(a: &ActorView) -> f32 {
    70. * super::actors::visual_scale(a)
}
/// Reflect geometry for left-facing attacks, then rotate within the upright half-plane.
/// The authored crescent is always mirrored inside its frame, as approved by the owner.
pub fn split_arc_geometry(direction: Vec2, zoom: f32) -> (Vec2,f32) {
    let sign=if direction.x<0. {-1.} else {1.};
    (vec2(84.*sign,72.)*zoom/0.5,(direction.y*sign).atan2(direction.x.abs()))
}
impl Wishfire {
    pub(super) fn heals_target(&self, target: u32) -> bool {
        self.healing.owns(target)
    }
    pub(super) fn take_heals(&mut self, from: &mut Self, source_time: f64, target: &Snapshot) {
        self.healing.take(&mut from.healing,source_time,target);
    }
    pub(super) fn take_combo(&mut self,from:&mut Self,delta:f64) {
        super::spotlight::transfer(&mut from.splits,&mut self.splits, |_|true,|x|x.born+=delta);
        super::spotlight::transfer(&mut from.shadows,&mut self.shadows, |_|true,|x| {
            x.born+=delta;if let Some(at)=&mut x.impact {*at+=delta;}
        });
        super::spotlight::transfer(&mut from.effects,&mut self.effects, |x|x.texture.starts_with("shadow-") || x.texture=="cast-flash-neutral",|x|x.born+=delta);
    }
    pub(super) fn shift_combo(&mut self,delta:f64) {
        for x in &mut self.splits {x.born+=delta;}
        for x in &mut self.shadows {x.born+=delta;if let Some(at)=&mut x.impact {*at+=delta;}}
        for x in &mut self.effects {if x.texture.starts_with("shadow-") || x.texture=="cast-flash-neutral" {x.born+=delta;}}
    }

    pub fn busy(&self, time: f64) -> bool {
        if self.healing.busy(time) {return true;}
        self.effects.iter().any(|x| time - x.born < x.life)
            || self.splits.iter().any(|x| time - x.born < 0.505)
            || self.shadows.iter().any(|x| time - x.born < SHADOW_END)
    }

    pub fn reaction_time(&self, source: u32, target: u32, event_time: f64) -> Option<f64> {
        self.shadows.iter().find(|x| x.hero==source && x.target==target && (event_time-x.born).abs()<0.04)
            .and_then(|x|x.impact)
    }
    pub fn death_time(&self, id: u32) -> Option<f64> {
        self.shadows.iter().filter(|x|x.target==id && x.victim.as_ref().is_some_and(|a|a.hp>0.))
            .filter_map(|x|x.impact).max_by(f64::total_cmp)
    }
    pub fn pose(&self, frame: &mut Snapshot, reduced: bool) {
        for x in &self.shadows {
            let age=frame.time-x.born;
            if !(0. ..SHADOW_END).contains(&age) {continue;}
            if let Some(a)=frame.actors.iter_mut().find(|a|a.id==x.hero) {
                if age<SHADOW_DASH {
                    let t=(age/SHADOW_DASH).clamp(0.,1.) as f32;
                    let t=if reduced {1.} else {1.-(1.-t).powi(3)};
                    a.pos=x.from+(x.to-x.from)*t;
                    a.state=wf_combat::ActorState::Cast;a.state_age=0.;a.state_duration=0.4;
                } else if age<0.52 {
                    a.state=wf_combat::ActorState::Basic;
                    a.state_age=0.18+(age-0.30).max(0.) as f32;a.impact_at=0.18;a.state_duration=0.4;
                } else if a.state==wf_combat::ActorState::Cast {
                    a.state=wf_combat::ActorState::Idle;a.state_age=(age-0.52) as f32;
                }
            }
            if let Some(impact)=x.impact {
                if frame.time<impact {
                    if let Some(before)=&x.victim {
                        if let Some(a)=frame.actors.iter_mut().find(|a|a.id==x.target) {
                            // Preserve a living target until the authored impact beat, including lethal hits.
                            a.hp=before.hp;a.state=before.state;a.state_age=before.state_age;
                        } else if frame.actors.iter().any(|a|a.id==x.hero)
                            && frame.spotlight.as_ref().is_none_or(|v|(v.caster==x.hero || v.co_casters.contains(&x.hero)) && v.participants.contains(&before.id)) {
                            frame.actors.push(before.clone());
                        }
                    }
                } else if let Some(a)=frame.actors.iter_mut().find(|a|a.id==x.target && a.hp<=0.) {
                    a.state_age=(frame.time-impact) as f32;
                }
            }
        }
    }
    #[cfg(target_arch="wasm32")]
    pub fn shadow_age(&self,time:f64)->f32 {
        self.shadows.iter().find(|x|(0. ..SHADOW_END).contains(&(time-x.born))).map_or(-1.,|x|(time-x.born) as f32)
    }
    fn emit(
        &mut self,
        texture: &'static str,
        pos: WorldPos,
        chest: f32,
        size: Vec2,
        born: f64,
        life: f64,
    ) {
        self.effects.push(Effect {
            texture,
            pos,
            follow: None,
            chest,
            size,
            born,
            life,
            rotation: 0.,
        });
    }
    pub fn ingest(&mut self, events: &[Event], s: &Snapshot, previous: &Snapshot) {
        self.healing.ingest(events,s);
        self.owned.clear();
        self.strike = None;
        let actor = |id| {
            s.actors
                .iter()
                .chain(previous.actors.iter())
                .find(|a| a.id == id)
        };
        let anchor = |id| actor(id).map(|a| (a.pos, chest(a)));
        // Establish ownership before processing Hit, regardless of event order within a batch.
        for event in events {
            if let Event::Blink {
                hero,
                from,
                to,
                target,
            } = *event
            {
                self.shadows.retain(|x| x.hero != hero);
                self.shadows.push(Shadow {
                    hero,
                    target,
                    from,
                    to,
                    chest: actor(hero).map(chest).unwrap_or(42.),
                    born: s.time,
                    impact: None,
                    victim: previous.actors.iter().find(|a|a.id==target).cloned(),
                    facing: actor(hero)
                        .map(|a| {
                            if a.facing == wf_combat::Facing::Left {
                                -1.
                            } else {
                                1.
                            }
                        })
                        .unwrap_or(1.),
                });
            }
        }
        for event in events {
            match event {
                Event::SceneReset | Event::WaveReset | Event::StageCleared => {
                    self.effects.clear();
                    self.splits.clear();
                    self.shadows.clear();
                }
                Event::SplitStrike {
                    hero,
                    center,
                    targets,
                } => {
                    let primary = targets.iter().filter_map(|id| actor(*id)).min_by(|a, b| {
                        ((a.pos.x - center.x).powi(2) + (a.pos.y - center.y).powi(2)).total_cmp(
                            &((b.pos.x - center.x).powi(2) + (b.pos.y - center.y).powi(2)),
                        )
                    });
                    let h = primary.map(chest).unwrap_or(42.);
                    let mut shares = Vec::new();
                    for id in targets {
                        self.owned.push((*hero, *id));
                        if let Some((to, k)) = anchor(*id) {
                            let landed=events.iter().any(|e|matches!(e,Event::Hit{source,target,amount,..} if source==hero && target==id && *amount>0.));
                            shares.push((to, k, primary.is_some_and(|a| a.id == *id), landed));
                        }
                    }
                    self.splits.push(Split {
                        pos: *center,
                        chest: h,
                        arc_origin: actor(*hero).map_or(*center,|a|a.pos),
                        arc_chest: actor(*hero).map_or(42.,chest),
                        arc_dir: actor(*hero).map_or(WorldPos::new(1.,0.),|a| {
                            let d=*center-a.pos;
                            if d.x*d.x+d.y*d.y>0.01 {d} else {WorldPos::new(if a.facing==wf_combat::Facing::Left {-1.} else {1.},0.)}
                        }),
                        targets: shares,
                        born: s.time,
                    });
                }
                Event::HazardSpawned {
                    id,
                    kind: HazardKind::FazePool,
                } => {
                    if let Some(h) = s
                        .hazards
                        .iter()
                        .chain(previous.hazards.iter())
                        .find(|h| h.id == *id)
                    {
                        let diameter = match h.shape {
                            wf_combat::Shape::Circle { radius } => radius,
                            _ => 138.,
                        };
                        self.emit(
                            "faze-splash",
                            h.origin,
                            0.,
                            super::hazards::pool_quad(diameter, 0.5),
                            s.time,
                            0.3,
                        );
                    }
                }
                Event::Evaded { source, target } => {
                    if let Some(shadow) = self
                        .shadows
                        .iter_mut()
                        .find(|x| x.hero == *source && x.target == *target && x.impact.is_none())
                    {
                        shadow.impact = Some(shadow.born + SHADOW_IMPACT);
                        let to = shadow.to;
                        let at = shadow.born + 0.30;
                        self.emit("shadow-dissipate", to, 0., vec2(48., 48.), at, 0.3);
                    }
                }
                Event::Hit {
                    source,
                    target,
                    amount,
                    crit,
                    element,
                    ..
                } if *amount > 0. => {
                    if *element == Element::Poison {
                        self.owned.push((*source, *target));
                        if let Some((p, h)) = anchor(*target) {
                            self.emit(
                                if *crit { "crit-poison" } else { "faze-tick" },
                                p,
                                if *crit { h } else { 16. },
                                Vec2::splat(if *crit { 38. } else { 12. }),
                                s.time,
                                if *crit { 0.22 } else { 5. / 24. },
                            );
                        }
                    }
                    if let Some(shadow) = self
                        .shadows
                        .iter_mut()
                        .find(|x| x.hero == *source && x.target == *target && x.impact.is_none())
                    {
                        let impact = shadow.born + SHADOW_IMPACT;
                        let slash = shadow.born + SHADOW_DASH;
                        shadow.impact = Some(impact);
                        let to = shadow.to;
                        self.owned.push((*source, *target));
                        self.strike = Some((*source, *target, impact));
                        if let Some((p, h)) = anchor(*target) {
                            // Warm-white backing first so the dark burst pops off emerald pools.
                            self.emit("cast-flash-neutral", p, h, vec2(84., 84.), impact, 0.2);
                            self.emit("shadow-impact", p, h, vec2(96., 96.), impact, 0.259);
                            self.emit("shadow-crack", p, 0., vec2(64., 32.), slash, 0.45);
                        }
                        self.emit("shadow-dissipate", to, 0., vec2(48., 48.), impact + 0.02, 0.3);
                    }
                }
                _ => {}
            }
        }
        self.effects.retain(|x| s.time - x.born < x.life);
        self.splits.retain(|x| s.time - x.born < 0.505);
        if self.splits.len() > 4 {
            self.splits.remove(0);
        }
        self.shadows.retain(|x| s.time - x.born < 1.5);
        // Keep Shadow contact ahead of poison decoration.
        if self.effects.len() > 8 {
            self.effects.sort_by_key(|x| {
                if x.texture.starts_with("shadow-") || x.texture=="cast-flash-neutral" {
                    1
                } else {
                    0
                }
            });
            self.effects.drain(..self.effects.len() - 8);
        }
    }
    pub fn records(&self) -> usize {
        self.effects.len() + self.splits.len() + self.shadows.len() + self.healing.records()
    }
    pub fn draw(&self, assets: &Assets, camera: &WorldCamera, s: &Snapshot, reduced: bool, stats: &mut DrawStats) {
        self.healing.front(assets,camera,s,stats);
        let z = camera.zoom / 0.5;
        for fx in &self.effects {
            let age = s.time - fx.born;
            if !(0. ..fx.life).contains(&age) {continue;}
            let p = camera.project(fx.position(s)) - vec2(0., fx.chest * camera.zoom);
            let mut tint = WHITE;
            if fx.texture == "shadow-crack" {
                tint.a = if age < 0.1 {0.72 - 1.2 * age as f32}
                    else {0.6 * (1. - (age as f32 - 0.1) / 0.35).max(0.)};
            }
            assets.vfx_once(fx.texture, age, p, fx.size * z, fx.rotation, tint, stats);
        }
        for split in &self.splits {
            let age = s.time - split.born;
            let p = camera.project(split.pos) - vec2(0., split.chest * camera.zoom);
            let origin=camera.project(split.arc_origin)-vec2(0.,split.arc_chest*camera.zoom);
            let (size,rotation)=split_arc_geometry(vec2(split.arc_dir.x,split.arc_dir.y*crate::camera::SQUASH),camera.zoom);
            assets.vfx_once_mirrored("crimson-sweep-arc",age,origin,size,rotation,WHITE,stats);
            for &(pos, chest, local, landed) in &split.targets {
                let q = camera.project(pos) - vec2(0., chest * camera.zoom);
                let arrival = if local { 0.125 } else { 0.305 };
                let flight = age - 0.125;
                if !local && (0. ..0.18).contains(&flight) {
                    let d = q - p;
                    let direction = d.normalize_or_zero();
                    for (back, alpha) in [(9., 0.13), (5., 0.22), (0., 1.)] {
                        assets.vfx_frame(
                            "split-shard",
                            0,
                            p + d * (flight as f32 / 0.18) - direction * back * z,
                            vec2(28., 28.) * z,
                            d.y.atan2(d.x),
                            Color::new(1., 1., 1., alpha),
                            stats,
                        );
                    }
                }
                if landed {
                    assets.vfx_once(
                        "crimson-sweep-impact",
                        age - arrival,
                        q,
                        vec2(28., 28.) * z,
                        0.,
                        WHITE,
                        stats,
                    );
                }
            }
        }
        for x in &self.shadows {
            let age = s.time - x.born;
            let p = camera.project(x.from) - vec2(0., x.chest * camera.zoom);
            let q = camera.project(x.to) - vec2(0., x.chest * camera.zoom);
            if age < 0.1 {
                assets.vfx_once("shadow-coil", age, p, vec2(48., 48.) * z, 0., WHITE, stats);
            }
            if reduced { continue; }
            let dash = age;
            // Dash lines: thin white speed lines parallel to the jump, trailing behind Hondo
            // toward his origin, lingering briefly after he lands.
            if (0. ..0.24).contains(&dash) {
                let delta = q - p;
                let dir = delta.normalize_or_zero();
                let side = vec2(-dir.y, dir.x);
                let travel = (dash / SHADOW_DASH).min(1.) as f32;
                let fade = if dash < SHADOW_DASH { 1. } else { 1. - ((dash - SHADOW_DASH) / 0.06) as f32 };
                let head = p + delta * travel;
                let span = (delta.length() * 0.75).max(36. * z);
                for (k, (offset, scale)) in [(-11., 0.55), (-5.5, 0.85), (0., 1.), (5.5, 0.8), (11., 0.5)]
                    .into_iter()
                    .enumerate()
                {
                    let lag = 6. * z * k as f32 % (12. * z);
                    let a = head - dir * (lag + 6. * z) + side * offset * z;
                    let b = a - dir * span * scale * travel.max(0.2);
                    assets.vfx_strip(
                        "bolt-trail-neutral",
                        0,
                        b,
                        a,
                        3. * z,
                        Color::new(1., 0.98, 0.94, 0.8 * fade),
                        stats,
                    );
                }
            }
            if (0. ..SHADOW_DASH).contains(&dash) {
                let streak_age=dash * 0.12 / SHADOW_DASH;
                let opacity = if streak_age < 0.012 {
                    streak_age / 0.012
                } else if streak_age < 0.08 {
                    1. - (streak_age - 0.012) / 0.068 * 0.1
                } else {
                    0.9 * (1. - (streak_age - 0.08) / 0.04)
                };
                let delta = q - p;
                let width = delta.length() * 256. / 245.;
                // Bright edge under the dark streak: separates it from emerald/dark ground.
                assets.vfx_frame(
                    "shadow-streak",
                    0,
                    p,
                    vec2(width, 22. * z),
                    delta.y.atan2(delta.x),
                    Color::new(1., 0.95, 0.85, 0.55 * opacity as f32),
                    stats,
                );
                assets.vfx_frame(
                    "shadow-streak",
                    0,
                    p,
                    vec2(width, 12. * z),
                    delta.y.atan2(delta.x),
                    Color::new(1., 1., 1., opacity as f32),
                    stats,
                );
            }
            for (fraction, born) in [(0.20, 0.024), (0.45, 0.054), (0.70, 0.084)] {
                let t = (dash - born) / 0.11;
                if (0. ..1.).contains(&t) {
                    let anchor = p + (q - p) * fraction;
                    // Stamps stay upright; the authored neutral silhouette receives violet tint.
                    let mut size = vec2(40., 40.) * z;
                    if x.facing < 0. {
                        size.x = -size.x;
                    }
                    // Light halo behind each afterimage, then the violet silhouette.
                    assets.vfx_frame(
                        "shadow-afterimage",
                        0,
                        anchor,
                        size * 1.18,
                        0.,
                        Color::new(1., 0.93, 0.85, 0.35 * (1. - t as f32)),
                        stats,
                    );
                    assets.vfx_frame(
                        "shadow-afterimage",
                        0,
                        anchor,
                        size,
                        0.,
                        Color::new(0.25, 0.19, 0.42, 0.45 * (1. - t as f32)),
                        stats,
                    );
                }
            }
        }
    }
    pub fn spring_landing(&self,assets:&Assets,camera:&WorldCamera,s:&Snapshot,stats:&mut DrawStats) {
        self.healing.ground(assets,camera,s,stats);
    }
    #[cfg(target_arch = "wasm32")]
    pub fn spring_probe(&self,assets:&Assets,camera:&WorldCamera,s:&Snapshot)->[f32;18] {
        let pools:Vec<_>=s.hazards.iter().filter(|h|h.kind==HazardKind::HealingSpring && h.phase==wf_combat::HazardPhase::Active).collect();
        let pool=pools.first();
        let pos=pool.map_or(Vec2::ZERO,|h|camera.project(h.origin));
        let size=pool.map_or(Vec2::ZERO,|h|if let wf_combat::Shape::Circle{radius}=h.shape {super::hazards::pool_quad(radius,camera.zoom)}else{Vec2::ZERO});
        [s.time as f32,pools.len() as f32,pool.map_or(0.,|h|h.id as f32),pool.map_or(0.,|h|h.progress),pos.x,pos.y,size.x,size.y,
            -1.,self.healing.age(s.time),0.,0.,self.healing.records() as f32,1.,
            ["chain-strike","chain-bolt","chain-jolt","chain-spark"].iter().any(|id|assets.vfx.contains_key(*id)) as u8 as f32,0.,0.,0.]
    }
    #[cfg(target_arch = "wasm32")]
    pub fn active(&self, now: f64, texture: &str) -> f32 {
        if texture == "healing" { return self.healing.records() as f32; }
        if texture == "split-facing" {
            return self.splits.iter().find(|x|now-x.born>=0.08&&now-x.born<0.25).map_or(0.,|x|if x.arc_dir.x<0. {-1.}else{1.});
        }
        if texture == "split-slash" {
            return self
                .splits
                .iter()
                .filter(|x| now - x.born >= 0.12 && now - x.born < 0.25)
                .count() as f32;
        }
        if texture == "shadow" {
            return self
                .shadows
                .iter()
                .filter(|x| now - x.born >= 0.04 && now - x.born < 0.22)
                .count() as f32;
        }
        self.effects
            .iter()
            .filter(|x| x.texture == texture && now - x.born >= 0.04 && now - x.born < x.life)
            .count() as f32
    }
}
#[cfg(test)]
mod tests {
    #[test]
    fn repeated_spring_heals_share_one_blessing_and_keep_the_existing_number() {
        let s = crate::testing::sim().snapshot().clone();
        let id = s.actors[3].id;
        let mut fx = Wishfire::default();
        fx.ingest(&[Event::Healed { target:id, amount:8.4, source: wf_combat::HealSource::HealingSpring }], &s, &s);
        assert_eq!(fx.healing.recipients(), vec![(id, s.actors[3].pos)]);
        fx.ingest(&[Event::Healed { target:id, amount:1., source: wf_combat::HealSource::HealingSpring }], &s, &s);
        assert_eq!(fx.healing.records(), 1);
        let mut later = s.clone(); later.time += 0.61;
        fx.ingest(&[Event::Healed { target:id, amount:8.4, source: wf_combat::HealSource::HealingSpring }], &later, &s);
        assert_eq!(fx.healing.age(later.time), 0.61_f32);
        let mut foreground = Wishfire::default();
        foreground.take_heals(&mut fx, later.time, &later);
        assert_eq!(fx.healing.records(), 0);
        assert_eq!(foreground.healing.recipients(), vec![(id, s.actors[3].pos)]);
        assert!(!foreground.busy(s.time+3.21));
        let mut presentation = super::super::vfx::Presentation::default();
        presentation.ingest(vec![Event::Healed { target:id, amount:8.4, source: wf_combat::HealSource::HealingSpring }], &s, &s);
        assert_eq!(presentation.popups.len(), 1);
        assert!(presentation.busy(s.time));
    }
    #[test]
    fn split_crescent_bulges_toward_target_and_stays_upright_for_both_facings(){
        use super::*;
        for d in [vec2(1.,0.),vec2(-1.,0.),vec2(1.,0.7),vec2(-1.,0.7),vec2(-1.,-0.7)] {
            let (size,rotation)=split_arc_geometry(d,0.5);
            let forward=vec2(rotation.cos(),rotation.sin())*size.x.signum();
            assert!(forward.dot(d.normalize())>0.999);
            assert!(rotation.abs()<=std::f32::consts::FRAC_PI_2);
            assert!(size.y>0.);assert_eq!(size.x.signum(),d.x.signum());
        }
    }
    use super::*;
    use wf_combat::Archetype;
    fn heal_cast(s: &Snapshot, target: u32) -> Event {
        Event::SkillStarted{id:s.actors.iter().find(|a|a.archetype==Archetype::Runa).unwrap().id,
            skill:wf_combat::Skill::HealingSpring,target:Some(target)}
    }
    #[test]
    fn runa_heal_lands_on_target_only_without_a_pool_and_follows_the_ally() {
        let mut s=crate::testing::sim().snapshot().clone();
        let id=s.actors[0].id;let old=s.clone();let mut fx=Wishfire::default();
        fx.ingest(&[heal_cast(&s,id)],&s,&old);assert!(fx.effects.is_empty());assert!(!fx.busy(s.time));
        s.time+=0.1;
        fx.ingest(&[Event::Healed {target:id,amount:10., source: wf_combat::HealSource::HealingSpring }],&s,&old);
        assert!(fx.effects.is_empty());
        assert_eq!(fx.healing.recipients(),vec![(id,s.actors[0].pos)]);
        assert!(fx.busy(s.time+3.19));assert!(!fx.busy(s.time+3.21));
        s.actors[0].pos.x+=30.;
        fx.ingest(&[],&s,&s);assert_eq!(fx.healing.recipients(),vec![(id,s.actors[0].pos)]);
        fx.ingest(&[Event::SceneReset],&s,&s);assert!(!fx.busy(s.time));assert_eq!(fx.healing.records(),0);
    }
    #[test]
    fn heal_source_pairing_handles_batched_order_without_replaying_a_blessing() {
        let s=crate::testing::sim().snapshot().clone();
        let id=s.actors[0].id;let other=s.actors[1].id;let mut fx=Wishfire::default();
        fx.ingest(&[Event::Healed {target:id,amount:10., source: wf_combat::HealSource::HealingSpring },heal_cast(&s,id)],&s,&s);
        assert_eq!(fx.healing.recipients(),vec![(id,s.actors[0].pos)]);
        assert_eq!(fx.healing.records(),1);
        let events=vec![Event::Hit{source:other,target:id,amount:1.,crit:false,element:Element::Poison, blocked: false};12];
        fx.ingest(&events,&s,&s);
        assert_eq!(fx.healing.recipients(),vec![(id,s.actors[0].pos)]);
        assert_eq!(fx.effects.len(),8);assert!(fx.healing.busy(s.time));
    }
    #[test]
    fn runa_cast_action_pairs_heal_without_skill_event_and_resets_cancel_it() {
        let mut s=crate::testing::sim().snapshot().clone();
        let id=s.actors[0].id;let runa=s.actors.iter().find(|a|a.archetype==Archetype::Runa).unwrap().id;
        let mut fx=Wishfire::default();
        fx.ingest(&[Event::ActionStarted{id:runa,state:wf_combat::ActorState::Cast,target:Some(id)},Event::Healed {target:id,amount:10., source: wf_combat::HealSource::HealingSpring }],&s,&s);
        assert_eq!(fx.healing.recipients(),vec![(id,s.actors[0].pos)]);
        fx.ingest(&[heal_cast(&s,id),Event::SceneReset],&s,&s);assert_eq!(fx.healing.records(),0);
        fx.ingest(&[Event::Healed {target:id,amount:10., source: wf_combat::HealSource::HealingSpring }],&s,&s);assert!(fx.effects.is_empty());
        s.actors[0].hp=0.;fx.ingest(&[heal_cast(&s,id),Event::Healed {target:id,amount:10., source: wf_combat::HealSource::HealingSpring }],&s,&s);assert!(fx.effects.is_empty());
    }
    #[test]
    fn runa_splash_keeps_arcane_hits_and_split_uses_struck_center() {
        let mut s = crate::testing::sim()
            .snapshot()
            .clone();
        s.actors[0].archetype = Archetype::Runa;
        let a = s.actors[0].id;
        let b = s.actors[1].id;
        let center = WorldPos::new(100., 200.);
        let mut v = Wishfire::default();
        v.ingest(
            &[
                Event::Hit {
                    source: a,
                    target: b,
                    amount: 2.,
                    crit: true,
                    element: Element::Arcane,
                    blocked: false,
                },
                Event::SplitStrike {
                    hero: a,
                    center,
                    targets: vec![a, b],
                },
            ],
            &s,
            &s,
        );
        assert!(v.effects.is_empty());
        assert_eq!(v.splits[0].pos, center);
        assert!(v.owned.contains(&(a, b)));
        v.ingest(&[Event::SceneReset], &s, &s);
        assert!(v.effects.is_empty() && v.splits.is_empty());
    }
    #[test]
    fn shadow_combo_moves_its_full_package_and_retains_a_removed_victim_until_contact() {
        let mut s=crate::testing::sim().snapshot().clone();
        let hero=s.actors[1].id;let caster=s.actors[2].id;
        let mut victim=s.actors[0].clone();victim.id=999;victim.team=wf_combat::Team::Enemy;s.actors.push(victim.clone());
        let mut bg=Wishfire::default();bg.ingest(&[Event::Blink{hero,from:s.actors[1].pos,to:victim.pos,target:999},
            Event::Hit{source:hero,target:999,amount:10.,crit:false,element:Element::Physical, blocked: false},
            Event::Hit{source:s.actors[3].id,target:999,amount:1.,crit:false,element:Element::Poison, blocked: false}],&s,&s);
        let mut fg=Wishfire::default();fg.take_combo(&mut bg,20.);
        assert_eq!(bg.effects.len(),1);assert_eq!(bg.effects[0].texture,"faze-tick");
        assert!(fg.effects.iter().any(|e|e.texture=="cast-flash-neutral"));assert_eq!(fg.shadows.len(),1);
        fg.shift_combo(1.2);assert!(fg.busy(21.3));
        let mut frame=s.clone();frame.time=21.3;frame.actors.retain(|a|a.id!=999);
        frame.spotlight=Some(wf_combat::SpotlightView{caster,skill:wf_combat::Skill::BubblePop,phase:wf_combat::SpotlightPhase::Performing,
            started:20.,participants:vec![999],co_casters:vec![hero],hazards:vec![],projectiles:vec![]});
        fg.pose(&mut frame,false);assert_eq!(frame.actors.iter().filter(|a|a.id==999).count(),1);
        frame.actors.retain(|a|a.id!=999);frame.spotlight.as_mut().unwrap().co_casters.clear();
        fg.pose(&mut frame,false);assert!(!frame.actors.iter().any(|a|a.id==999),"an unadmitted Shadow cannot restore its victim above the scrim");
    }
    #[test]
    fn shadow_records_have_distinct_dash_slash_and_contact_beats() {
        let s=crate::testing::sim().snapshot().clone();
        let hero=s.actors[0].id;let target=s.actors[1].id;let mut fx=Wishfire::default();
        fx.ingest(&[Event::Blink{hero,from:s.actors[0].pos,to:s.actors[1].pos,target},Event::Hit{source:hero,target,amount:10.,crit:true,element:Element::Arcane, blocked: false}],&s,&s);
        let born=|id|fx.effects.iter().find(|e|e.texture==id).unwrap().born-s.time;
        assert_eq!(born("shadow-crack"),SHADOW_DASH);
        assert_eq!(born("shadow-impact"),SHADOW_IMPACT);
        assert_eq!(born("cast-flash-neutral"),SHADOW_IMPACT);
        assert!(fx.effects.iter().all(|e|e.born-s.time>=SHADOW_DASH));
        assert!(fx.busy(s.time+0.70));assert!(!fx.busy(s.time+0.76));
    }
    #[test]
    fn misses_keep_travel_and_dissipation_without_contact_sparks() {
        let s = crate::testing::sim()
            .snapshot()
            .clone();
        let a = s.actors[0].id;
        let b = s.actors[1].id;
        let mut v = Wishfire::default();
        v.ingest(
            &[
                Event::Blink {
                    hero: a,
                    from: s.actors[0].pos,
                    to: s.actors[1].pos,
                    target: b,
                },
                Event::Evaded {
                    source: a,
                    target: b,
                },
                Event::SplitStrike {
                    hero: a,
                    center: s.actors[1].pos,
                    targets: vec![b],
                },
            ],
            &s,
            &s,
        );
        assert!(v.effects.iter().any(|e| e.texture == "shadow-dissipate"));
        assert!(!v.effects.iter().any(|e| e.texture == "shadow-impact"));
        assert!(!v.splits[0].targets[0].3);
        assert!(v.strike.is_none());
    }
}
