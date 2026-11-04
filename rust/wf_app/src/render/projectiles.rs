use crate::{
    assets::{Assets, DrawStats, Manifest},
    camera::{WorldCamera, SQUASH},
};
use macroquad::prelude::Vec2;
use macroquad::prelude::*;
use std::{cell::Cell, collections::BTreeMap};
use wf_combat::api::*;
#[derive(Clone)]
struct Observation {
    origin: wf_combat::Vec2,
    born: f64,
    source: Option<u32>,
    marid: bool,
    target: Option<u32>,
    drawn: Cell<Option<Vec2>>,
    sniper: Option<SniperLaunch>,
    muzzle_offset: Vec2,
}
struct Release {
    source: u32,
    skill: Option<Skill>,
    pos: wf_combat::Vec2,
    height: f32,
    dir: Vec2,
    born: f64,
    muzzle: bool,
    enemy: bool,
}
struct Cast {
    skill: Option<Skill>,
    id: u32,
    state: ActorState,
    target: Option<u32>,
    last_age: f32,
}
// World-space length: 36 px horizontally at the normal phone zoom. Speed and lifetime
// come exclusively from the live sim projectile; a consumed projectile has no segment.
const SNIPER_DISCHARGE_LENGTH: f32 = 72.;
#[derive(Clone)]
struct SniperLaunch {
    hazard: u32,
    origin: wf_combat::Vec2,
    dir: wf_combat::Vec2,
    length: f32,
}
#[derive(Debug, PartialEq)]
enum SniperProjectile {
    Unrelated,
    Visible(wf_combat::Vec2, wf_combat::Vec2),
    Hidden,
}
// Leave one tick of headroom: a 30 Hz sampled flight finishes within the 80 ms budget.
const TERMINAL_CAP: f64 = 2. * wf_combat::SIM_DT as f64 - 0.000001;
// Coordinates are world units after ground squash and vertical lift, before camera projection.
fn distance(a:wf_combat::Vec2,b:wf_combat::Vec2)->f32 {vec2(a.x-b.x,a.y-b.y).length()}
fn visual(p: &ProjectileView) -> Vec2 { vec2(p.pos.x, p.pos.y*SQUASH-p.height) }
fn project(camera: &WorldCamera, p: Vec2) -> Vec2 {
    camera.project(wf_combat::Vec2::new(p.x, p.y/SQUASH))
}
// Mouth centres measured in the authored 128px cast frames (the hover bob is baked in).
fn mirewing_muzzle(manifest: &Manifest, a: &ActorView) -> Vec2 {
    const MOUTH: [(f32, f32); 12] = [(20.,73.),(19.,72.),(19.,71.),(18.,70.),
        (18.,70.),(18.,71.),(18.,72.),(19.,73.),(20.,74.),(19.,74.),(20.,74.),(20.,73.)];
    let art = &manifest.actors["Mirewing"];
    let clip = &art.clips["cast"];
    let Some(frame) = crate::clips::actor(clip, a) else { return Vec2::ZERO };
    let index = clip.frames.iter().position(|f| std::ptr::eq(f, frame)).unwrap();
    let (x, y) = MOUTH[index];
    let x = x - clip.foot_origin[0];
    vec2(if (art.facing == "left") != (a.facing == Facing::Left) { -x } else { x },
        y - clip.foot_origin[1]) * super::actors::visual_scale(a)
}
fn enemy_orb_source<'a>(p: &ProjectileView, s: &'a Snapshot) -> Option<&'a ActorView> {
    if p.team != Team::Enemy || p.kind != ProjectileKind::Orb { return None; }
    s.actors.iter().filter(|a| a.team == Team::Enemy && a.hp > 0.)
        .filter(|a| {
            let d = p.pos - a.pos;
            d.x*p.dir.x + d.y*p.dir.y >= -1. && (d.x*p.dir.y-d.y*p.dir.x).abs() < 1.
                && distance(p.pos,a.pos) < 150.
        })
        .min_by(|a,b| distance(p.pos,a.pos).total_cmp(&distance(p.pos,b.pos)))
}
fn muzzle_offset(manifest: Option<&Manifest>, p: &ProjectileView, s: &Snapshot) -> Vec2 {
    // Bind once at observation; later facing, bob or death cannot bend flight.
    match (manifest, enemy_orb_source(p, s)) {
        (Some(m), Some(a)) if a.archetype == Archetype::Mirewing => mirewing_muzzle(m, a),
        _ => Vec2::ZERO,
    }
}
pub(super) fn body_contact(manifest: Option<&Manifest>, a: &ActorView) -> Vec2 {
    let foot = vec2(a.pos.x, a.pos.y*SQUASH);
    let scale = super::actors::visual_scale(a);
    let Some(art) = manifest.and_then(|m|m.actors.get(&format!("{:?}",a.archetype))) else {
        return foot-vec2(0.,70.*scale);
    };
    let Some(clip) = art.clips.get("idle") else {return foot-vec2(0.,70.*scale)};
    let flip = (art.facing=="left") != (a.facing==Facing::Left);
    if a.archetype == Archetype::Mirewing {
        // Authored torso (50,60), foot (64,125): opaque throughout every live clip.
        let offset = vec2(-14. * clip.foot_origin[0] / 64., -65. * clip.foot_origin[1] / 125.);
        return foot + vec2(if flip { -offset.x } else { offset.x }, offset.y) * scale;
    }
    let Some(f) = crate::clips::sample(&clip.frames,a.state_age*1000.,true) else {return foot};
    let x = if flip {clip.foot_origin[0]-f.offset_x-f.w} else {f.offset_x-clip.foot_origin[0]};
    let top = (f.offset_y-clip.foot_origin[1])*scale;
    let bottom = top+f.h*scale;
    let y = (top*0.45).clamp(top+f.h*scale*0.2,bottom-f.h*scale*0.2);
    foot+vec2((x+f.w*0.5)*scale,y)
}
#[derive(Clone)]
struct Terminal {
    #[cfg_attr(not(target_arch="wasm32"),allow(dead_code))]
    id: u32,
    kind: ProjectileKind,
    source: u32,
    target: u32,
    element: Option<Element>,
    #[cfg_attr(not(target_arch="wasm32"),allow(dead_code))]
    boss: bool,
    #[cfg_attr(not(target_arch="wasm32"),allow(dead_code))]
    foot: Vec2,
    from: Vec2,
    to: Vec2,
    born: f64,
    duration: f64,
}
impl Terminal {
    fn position(&self, time: f64) -> Vec2 {
        self.from.lerp(self.to,((time-self.born)/self.duration).clamp(0.,1.) as f32)
    }
    fn arrival(&self) -> f64 {self.born+self.duration}
}
#[derive(Default)]
pub struct Projectiles {
    seen: BTreeMap<u32, Observation>,
    releases: Vec<Release>,
    casts: Vec<Cast>,
    terminals: Vec<Terminal>,
    boss_bolts: BTreeMap<u32,u32>,
}
fn orb_tint(enemy: bool, marid: bool) -> Color {
    if enemy && !marid { Color::from_rgba(255, 175, 194, 255) }
    else { WHITE }
}
// Rotate the coloured source, retaining HSV saturation/value and the original alpha.
pub const MARID_HUE_TURNS: f32 = 150. / 360.;
pub const ORB_HUE_FRAGMENT: &str = "#version 100
precision highp float;
varying lowp vec2 uv; varying lowp vec4 color;
uniform sampler2D Texture; uniform float HueTurns;
void main() {
    vec4 tex = texture2D(Texture, uv);
    float hi = max(tex.r, max(tex.g, tex.b));
    float lo = min(tex.r, min(tex.g, tex.b));
    float chroma = hi-lo;
    float h = 0.0;
    if (chroma > 0.0) {
        if (hi == tex.r) h = (tex.g-tex.b)/chroma;
        else if (hi == tex.g) h = (tex.b-tex.r)/chroma+2.0;
        else h = (tex.r-tex.g)/chroma+4.0;
    }
    vec3 ramp = abs(fract(h/6.0+HueTurns+vec3(0.0, 2.0/3.0, 1.0/3.0))*6.0-3.0);
    vec3 rgb = lo+chroma*clamp(ramp-1.0, 0.0, 1.0);
    gl_FragColor = vec4(rgb*color.rgb, tex.a*color.a);
}";
/// Kaja and Marid reuse Runa's shape, frames and delivery with hue-only variants.
fn orb_art(kaja: bool, marid: bool) -> (&'static str, &'static str) {
    if marid { ("orb-head-marid", "orb-trail-marid") }
    else if kaja { ("orb-head-kaja", "orb-trail-kaja") } else { ("orb-head", "orb-trail") }
}
fn kaja_source(s: &Snapshot, id: u32) -> bool {
    s.actors.iter().any(|a| a.id == id && a.archetype == Archetype::Kaja)
}
#[cfg(target_arch="wasm32")]
std::thread_local! {static BOLT_PROBE:Cell<[f32;18]>=const{Cell::new([0.;18])};}
#[cfg(target_arch="wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_bolt_probe(index:u32)->f32 {
    BOLT_PROBE.with(|p|p.get().get(index as usize).copied().unwrap_or(f32::NAN))
}
impl Projectiles {
    pub(super) fn take_combo(&mut self,from:&mut Self,view:&SpotlightView,delta:f64) {
        let ids:Vec<_>=from.seen.keys().filter(|id|view.projectiles.contains(id)).copied().collect();
        for id in ids {if let Some(mut x)=from.seen.remove(&id) {x.born+=delta;self.seen.insert(id,x);}}
        super::spotlight::transfer(&mut from.terminals,&mut self.terminals, |x|view.projectiles.contains(&x.id),|x|x.born+=delta);
        super::spotlight::transfer(&mut from.releases,&mut self.releases,
            |x|view.co_casters.contains(&x.source) && x.skill.is_some_and(Skill::offensive),|x|x.born+=delta);
        super::spotlight::transfer(&mut from.casts,&mut self.casts,
            |x|view.co_casters.contains(&x.id) && x.skill.is_some_and(Skill::offensive),|_|{});
    }
    pub(super) fn pause_combo(&mut self,view:&SpotlightView,delta:f64) {
        for (id,x) in &mut self.seen {if view.projectiles.contains(id) {x.born+=delta;}}
        for x in &mut self.terminals {if view.projectiles.contains(&x.id) {x.born+=delta;}}
        for x in &mut self.releases {if view.co_casters.contains(&x.source) {x.born+=delta;}}
    }
    pub fn inherit_observations(&mut self, other:&Self,delta:f64, target:&Snapshot) {
        for (id,o) in &other.seen {if target.projectiles.iter().any(|p|p.id==*id) {self.seen.entry(*id).or_insert_with(||{let mut x=o.clone();x.born+=delta;x});}}
    }
    fn sniper_segment(&self, s: &Snapshot, p: &ProjectileView) -> SniperProjectile {
        if p.team != Team::Enemy || p.kind != ProjectileKind::Bolt
            || self.boss_bolts.values().any(|id| *id == p.id) {
            return SniperProjectile::Unrelated;
        }
        let Some(launch) = self.seen.get(&p.id).and_then(|o| o.sniper.as_ref()) else {
            return SniperProjectile::Unrelated;
        };
        if !s.hazards.iter().any(|h| h.id == launch.hazard && h.phase == HazardPhase::Active) {
            return SniperProjectile::Hidden;
        }
        let offset = p.pos - launch.origin;
        let head = offset.x*launch.dir.x + offset.y*launch.dir.y;
        if head <= 0. || head >= launch.length { return SniperProjectile::Hidden; }
        let tail = (head - SNIPER_DISCHARGE_LENGTH).max(0.);
        SniperProjectile::Visible(launch.origin + launch.dir*tail, launch.origin + launch.dir*head)
    }
    pub fn busy(&self, time: f64) -> bool {
        self.terminals.iter().any(|x| time < x.arrival())
            || self.releases.iter().any(|x| time - x.born < 0.16)
    }

    #[cfg(test)]
    pub fn ingest(&mut self, events: &[Event], s: &Snapshot, previous: &Snapshot) {
        self.ingest_context(events,s,previous,s,previous,None);
    }
    pub fn ingest_context(&mut self, events: &[Event], s: &Snapshot, previous: &Snapshot,
        context: &Snapshot, old_context: &Snapshot, manifest: Option<&Manifest>) {
        self.terminals.retain(|x|s.time-x.arrival()<0.25);
        self.boss_bolts.retain(|hazard,id|context.projectiles.iter().any(|p|p.id==*id)||context.hazards.iter().any(|h|h.id==*hazard));
        // Identify the sim bolt once at BossSnipe release. Ordinary sniper bolts keep their art.
        for h in context.hazards.iter().filter(|h|h.kind==HazardKind::BossSnipe && h.phase==HazardPhase::Active) {
            if self.boss_bolts.contains_key(&h.id) {continue}
            if let Some(p)=context.projectiles.iter().filter(|p|p.team==Team::Enemy && p.kind==ProjectileKind::Bolt
                && !self.seen.contains_key(&p.id)
                && p.dir.x*h.dir.x+p.dir.y*h.dir.y>0.999
                && ((p.pos.x-h.origin.x)*h.dir.y-(p.pos.y-h.origin.y)*h.dir.x).abs()<1.)
                .min_by(|a,b|distance(a.pos,h.origin).total_cmp(&distance(b.pos,h.origin))) {self.boss_bolts.insert(h.id,p.id);}
        }
        if events.iter().any(|e|matches!(e,Event::SceneReset|Event::WaveReset|Event::StageCleared)) {
            *self=Self::default();return;
        }
        for p in previous.projectiles.iter().filter(|p|p.team==Team::Hero && p.kind!=ProjectileKind::Bomb
            && !context.projectiles.iter().any(|n|n.id==p.id)) {
            let observed=self.seen.get(&p.id);
            let direction=vec2(p.dir.x,p.dir.y).normalize_or_zero();
            let hit=events.iter().filter_map(|e|match e {
                Event::Hit{source,target,..}|Event::Evaded{source,target}=>Some((*source,*target)),
                _=>None,
            }).filter(|(source,_)|observed.and_then(|o|o.source).is_none_or(|id|id==*source))
              .filter(|(source,_)|context.actors.iter().chain(old_context.actors.iter()).any(|a|a.id==*source && a.team==Team::Hero))
              .filter_map(|(source,target)|context.actors.iter().chain(old_context.actors.iter()).find(|a|a.id==target && a.team==Team::Enemy).map(|a|(source,a)))
              .filter_map(|(source,a)| {
                  let delta=vec2(a.pos.x-p.pos.x,a.pos.y-p.pos.y);
                  let along=delta.dot(direction);let across=delta.perp_dot(direction).abs();
                  (along>=-a.radius && across<=a.radius+20. && delta.length()<=a.radius+45.)
                      .then_some((source,a,along-(a.radius*a.radius-across.min(a.radius).powi(2)).sqrt()))
              }).min_by(|a,b| {
                  let preferred=|source:u32,id:u32|observed.and_then(|o|o.target)
                      .or_else(||old_context.actors.iter().find(|a|a.id==source).and_then(|a|a.target))==Some(id);
                  preferred(b.0,b.1.id).cmp(&preferred(a.0,a.1.id)).then_with(||a.2.total_cmp(&b.2))
              });
            if let Some((source,target,_))=hit {
                let from=observed.and_then(|o|o.drawn.get()).unwrap_or_else(||visual(p));
                let to=body_contact(manifest,target);
                let element=events.iter().find_map(|e|if let Event::Hit{source:who,target:id,element,..}=e {
                    (*who==source && *id==target.id).then_some(*element)
                } else {None});
                self.terminals.push(Terminal{id:p.id,kind:p.kind,source,target:target.id,element,
                    boss:super::actors::is_boss(target.archetype),foot:vec2(target.pos.x,target.pos.y*SQUASH),from,to,born:s.time,
                    duration:((to-from).length() as f64/2400.).clamp(1./120.,TERMINAL_CAP)});
            }
        }
        self.seen
            .retain(|id, _| s.projectiles.iter().any(|p| p.id == *id));
        self.releases.retain(|x| s.time - x.born < 0.16);
        for p in &s.projectiles {
            if let std::collections::btree_map::Entry::Vacant(e) = self.seen.entry(p.id) {
                let source=if p.team == Team::Enemy { enemy_orb_source(p, context).map(|a| a.id) } else {
                        let window=(context.combat_time-old_context.combat_time).max(0.) as f32+wf_combat::SIM_DT+0.01;
                        let mut released=context.actors.iter().filter(|a|a.team==Team::Hero
                            && matches!(a.archetype,Archetype::Runa|Archetype::Kaja)
                            && a.state==ActorState::Basic && a.impact_at>0. && a.state_age>=a.impact_at
                            && a.state_age-a.impact_at<window && distance(a.pos,p.pos)<100.);
                        let first=released.next().map(|a|a.id);
                        if released.next().is_none() {first} else {None}
                    };
                let target=source.and_then(|id|self.casts.iter().find(|c|c.id==id).and_then(|c|c.target)
                    .or_else(||events.iter().find_map(|e|if let Event::ActionStarted{id:actor,target,..}=e {(*actor==id).then_some(*target).flatten()}else{None}))
                    .or_else(||context.actors.iter().find(|a|a.id==id).and_then(|a|a.target)));
                e.insert(Observation {
                    origin: p.pos,
                    born: s.time,
                    marid: source.and_then(|id| context.actors.iter().find(|a|a.id==id))
                        .is_some_and(|a| a.archetype==Archetype::Marid),
                    source, target,
                    drawn: Cell::new(None),
                    muzzle_offset: muzzle_offset(manifest, p, context),
                    sniper: if p.team == Team::Enemy && p.kind == ProjectileKind::Bolt
                        && !self.boss_bolts.values().any(|id| *id == p.id) {
                        context.hazards.iter().filter(|h| h.kind == HazardKind::SniperLine
                            && h.phase == HazardPhase::Active
                            && p.dir.x*h.dir.x + p.dir.y*h.dir.y > 0.999
                            && ((p.pos.x-h.origin.x)*h.dir.y-(p.pos.y-h.origin.y)*h.dir.x).abs() < 1.)
                            .filter_map(|h| match h.shape {
                                Shape::Line { length, .. } => Some(SniperLaunch {
                                    hazard: h.id, origin: h.origin, dir: h.dir, length,
                                }),
                                _ => None,
                            })
                            .min_by(|a,b| distance(p.pos,a.origin).total_cmp(&distance(p.pos,b.origin)))
                    } else { None },
                });
            }
        }
        for event in events {
            if let Event::ActionStarted { id, target, state } = *event {
                self.casts.retain(|c| c.id != id);
                if context.actors
                    .iter()
                    .chain(old_context.actors.iter())
                    .any(|a| a.id == id && matches!(a.archetype, Archetype::Runa | Archetype::Kaja))
                {
                    self.casts.push(Cast {
                        skill: events.iter().find_map(|e|if let Event::SkillStarted{id:who,skill,..}=e {(*who==id).then_some(*skill)}else{None}),
                        id,
                        target,
                        state,
                        last_age: 0.,
                    });
                }
            }
        }
        self.casts.retain_mut(|c| {
            let Some(a) = context.actors.iter().find(|a| a.id == c.id) else {
                return false;
            };
            if a.state != c.state || a.state_age < c.last_age {
                return false;
            }
            if a.state_age >= a.impact_at && a.impact_at > 0. {
                let dir = c
                    .target
                    .and_then(|id| {
                        context.actors
                            .iter()
                            .chain(old_context.actors.iter())
                            .find(|b| b.id == id)
                    })
                    .map(|b| vec2(b.pos.x - a.pos.x, (b.pos.y - a.pos.y) * SQUASH))
                    .unwrap_or(Vec2::X);
                self.releases.push(Release {
                    source: c.id, skill: c.skill,
                    pos: a.pos,
                    height: super::wishfire::chest(a),
                    dir,
                    born: s.time,
                    muzzle: false,
                    enemy: false,
                });
                return false;
            }
            c.last_age = a.state_age;
            true
        });
        if self.releases.len() > 8 {
            self.releases.drain(..self.releases.len() - 8);
        }
    }
    pub fn arrival(&self, source:u32, event_time:f64, element:Element) -> Option<f64> {
        self.terminals.iter().filter(|x|x.source==source && x.element==Some(element) && (x.born-event_time).abs()<0.00001)
            .map(Terminal::arrival).max_by(f64::total_cmp)
    }
    pub fn records(&self) -> usize {
        self.releases.len()+self.terminals.len()
    }
    /// Bomb bodies share actor depth; height changes only the painted position.
    pub fn draw_bomb(&self, assets: &Assets, camera: &WorldCamera, s: &Snapshot, p: &ProjectileView, stats: &mut DrawStats) {
        let z = camera.zoom / 0.5;
        if let Some(o) = self.seen.get(&p.id) { o.drawn.set(Some(visual(p))); }
        let offset = self.seen.get(&p.id).map_or(Vec2::ZERO, |o| o.muzzle_offset);
        let centre = camera.project(p.pos) + (offset - vec2(0., p.height)) * camera.zoom;
        const BOMB_SPHERE_LIFT: f32 = 7. / 48. * 17.;
        let centre = centre - vec2(0., BOMB_SPHERE_LIFT) * z;
        assets.decal("bomb", centre, vec2(17., 17.) * z, 0., WHITE, stats);
        let fuse = s.hazards.iter().find(|h| {
            h.kind == HazardKind::LizardoDrop
                && h.phase == HazardPhase::Locked
                && ((h.origin.x - p.pos.x).powi(2) + (h.origin.y - p.pos.y).powi(2)).sqrt()
                    < 4.
        });
        if p.height > 0.5 || fuse.is_some() {
            let fast = fuse.is_some_and(|h| h.progress >= 0.7);
            let age = self.seen.get(&p.id).map(|o| s.time - o.born).unwrap_or(0.);
            let frame = (age / if fast { 0.035 } else { 0.06 }) as usize % 4;
            let alpha = if fast {
                0.65 + 0.35 * (age as f32 * 65.).sin().abs()
            } else {
                1.
            };
            assets.vfx_frame(
                "fuse-spark",
                frame,
                centre + vec2(3., -7.) * z,
                vec2(8., 8.) * z,
                0.,
                Color::new(1., 1., 1., alpha),
                stats,
            );
        }
    }
    pub fn ground(&self, assets: &Assets, camera: &WorldCamera, s: &Snapshot, stats: &mut DrawStats) {
        let z = camera.zoom / 0.5;
        for p in s.projectiles.iter().filter(|p| p.kind == ProjectileKind::Bomb && p.height > 0.5) {
            let ground = camera.project(p.pos);
            assets.vfx_frame("shadow", 0, ground, vec2(12., 6.) * z, 0., Color::new(1., 1., 1., 0.5), stats);
        }
    }
    pub fn draw(&self, assets: &Assets, camera: &WorldCamera, s: &Snapshot, stats: &mut DrawStats) {
        let z = camera.zoom / 0.5;
        #[cfg(target_arch="wasm32")]
        if let Some(t)=self.terminals.first() {
            let from=project(camera,t.from);let to=project(camera,t.to);
            let now=project(camera,t.position(s.time));let foot=project(camera,t.foot);
            BOLT_PROBE.with(|p|p.set([s.time as f32,t.id as f32,(s.time-t.born) as f32,t.duration as f32,
                from.x,from.y,to.x,to.y,if s.time<t.arrival(){1.}else{0.},now.x,now.y,t.source as f32,
                t.target as f32,if t.boss{1.}else{0.},s.projectiles.iter().filter(|p|p.team==Team::Hero).count() as f32,
                (s.time-t.arrival()) as f32,foot.x,foot.y]));
        }

        for p in s.projectiles.iter().filter(|p| p.kind != ProjectileKind::Bomb) {
            if self.boss_bolts.values().any(|id|*id==p.id) {continue}
            match self.sniper_segment(s, p) {
                SniperProjectile::Unrelated => {},
                SniperProjectile::Hidden => continue,
                SniperProjectile::Visible(tail, head) => {
                    let tail = camera.project(tail);
                    let head = camera.project(head);
                    let dir = (head-tail).normalize_or_zero();
                    gl_use_material(&assets.additive);
                    draw_line(tail.x,tail.y,head.x,head.y,3.*z,Color::new(0.24,0.57,1.,0.38));
                    draw_line(tail.x,tail.y,head.x,head.y,1.25*z,WHITE);
                    // Blue belongs to the tail, with its rear edge clamped to the muzzle.
                    let marker = tail + dir*((head-tail).length().min(3.*z));
                    draw_line(tail.x,tail.y,marker.x,marker.y,2.*z,Color::new(0.35,0.68,1.,0.85));
                    gl_use_default_material();
                    stats.calls += 3;
                    continue;
                }
            }
            if let Some(o)=self.seen.get(&p.id) {o.drawn.set(Some(visual(p)));}
            let ground = camera.project(p.pos);
            let offset = self.seen.get(&p.id).map_or(Vec2::ZERO, |o| o.muzzle_offset);
            let centre = ground + (offset - vec2(0., p.height)) * camera.zoom;
            let dir = vec2(p.dir.x, p.dir.y * SQUASH).normalize_or_zero();
            let angle = dir.y.atan2(dir.x);
            let bolt = p.kind == ProjectileKind::Bolt;
            if bolt {
                // Original sniper bolt sprite, rotated to its travel direction.
                if !assets.decal("bolt", centre, vec2(23., 6.) * z, angle, WHITE, stats) {
                    draw_circle(centre.x, centre.y, 3., WHITE);
                    stats.calls += 1;
                }
                continue;
            }
            let enemy = p.team == Team::Enemy;
            let kaja = self.seen.get(&p.id).and_then(|o| o.source).is_some_and(|id| kaja_source(s, id));
            let marid = self.seen.get(&p.id).is_some_and(|o| o.marid);
            let (head, trail) = match (bolt, enemy && !marid) {
                (true, true) => ("bolt-head-neutral", "bolt-trail-neutral"),
                (true, false) => ("bolt-head", "bolt-trail"),
                (false, true) => ("orb-head-neutral", "orb-trail-neutral"),
                (false, false) => orb_art(kaja, marid),
            };
            let tint = orb_tint(enemy, marid);
            if dir.length_squared() > 0. {
                let travelled = self
                    .seen
                    .get(&p.id)
                    .map(|o| camera.project(p.pos).distance(camera.project(o.origin)))
                    .unwrap_or(0.);
                let behind = if bolt { 7. } else { 4. } * z;
                let length = (travelled - behind).clamp(0., if bolt { 34. } else { 24. } * z);
                if length > 0. {
                    let tip = centre - dir * behind;
                    assets.vfx_strip(
                        trail,
                        0,
                        tip - dir * length,
                        tip,
                        if bolt { 4. } else { 6. } * z,
                        tint,
                        stats,
                    );
                }
            }
            // Shot heads are authoritative cues and remain visible if the decoration pool fills.
            let saved = stats.fx_quads;
            stats.fx_quads = stats.fx_quads.min(111);
            assets.vfx_frame(
                head,
                1,
                centre,
                if bolt { vec2(23., 8.) } else { vec2(12., 12.) } * z,
                angle,
                tint,
                stats,
            );
            stats.fx_quads = stats.fx_quads.max(saved + 1);
        }
        for t in &self.terminals {
            if s.time<t.born || s.time>=t.arrival() {continue;}
            let centre=project(camera,t.position(s.time));
            let d=(t.to-t.from).normalize_or_zero();let angle=d.y.atan2(d.x);
            if t.kind==ProjectileKind::Bolt {
                assets.decal("bolt",centre,vec2(23.,6.)*z,angle,WHITE,stats);
            } else {
                let saved=stats.fx_quads;stats.fx_quads=stats.fx_quads.min(111);
                assets.vfx_frame(orb_art(kaja_source(s,t.source), false).0,1,centre,vec2(12.,12.)*z,angle,WHITE,stats);
                stats.fx_quads=stats.fx_quads.max(saved+1);
            }
        }
        for r in &self.releases {
            let p = camera.project(r.pos) - vec2(0., r.height * camera.zoom);
            let id = if r.muzzle {
                "muzzle-flash"
            } else {
                "cast-flash"
            };
            let tint = if r.enemy {
                Color::from_rgba(255, 175, 194, 255)
            } else {
                WHITE
            };
            assets.vfx_once(
                id,
                s.time - r.born,
                p,
                if r.muzzle {
                    vec2(16., 10.)
                } else {
                    vec2(20., 20.)
                } * z,
                r.dir.y.atan2(r.dir.x),
                tint,
                stats,
            );
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn marid_orb_reuses_coloured_runa_art_with_cached_hue_rotation() {
        let mut s = crate::testing::sim().snapshot().clone();
        let mut a = s.actors[0].clone();
        a.id = 900; a.archetype = Archetype::Marid; a.team = Team::Enemy;
        a.state = ActorState::Basic; a.impact_at = 0.3; a.state_age = 0.31;
        s.projectiles.push(ProjectileView { id:901, kind:ProjectileKind::Orb, team:Team::Enemy,
            pos:a.pos + wf_combat::Vec2::new(14.,0.), dir:wf_combat::Vec2::new(1.,0.), height:0. });
        s.actors.push(a);
        let mut fx = Projectiles::default();
        fx.ingest_context(&[], &s, &s, &s, &s, None);
        assert_eq!(fx.seen[&901].source, Some(900));
        assert!(fx.seen[&901].marid);
        s.actors.retain(|a| a.id != 900);
        fx.ingest_context(&[], &s, &s, &s, &s, None);
        let tint = orb_tint(true, fx.seen[&901].marid);
        assert_eq!(tint, WHITE);
        assert_eq!(orb_art(false, fx.seen[&901].marid), ("orb-head-marid", "orb-trail-marid"));
        // Source blue (210 degrees) rotates to red without changing saturation/value.
        assert!(((210./360.+MARID_HUE_TURNS)-1.).abs() < 0.000001);
        assert_eq!(orb_tint(true, false), Color::from_rgba(255,175,194,255));
    }
    #[test]
    fn only_kaja_source_uses_purple_orb_art() {
        let s = crate::testing::sim().snapshot().clone();
        let kaja = s.actors.iter().find(|a| a.archetype == Archetype::Kaja).unwrap();
        assert_eq!(orb_art(kaja_source(&s, kaja.id), false), ("orb-head-kaja", "orb-trail-kaja"));
        for actor in s.actors.iter().filter(|a| a.archetype != Archetype::Kaja) {
            assert_eq!(orb_art(kaja_source(&s, actor.id), false), ("orb-head", "orb-trail"));
        }
        assert_eq!(orb_art(kaja_source(&s, u32::MAX), false), ("orb-head", "orb-trail"));
    }
    #[test]
    fn sniper_discharge_advances_clamps_and_terminates_with_the_sim_bolt() {
        let mut s = crate::testing::sim().snapshot().clone();
        s.hazards.clear(); s.projectiles.clear();
        let origin = wf_combat::Vec2::new(50., 80.);
        let dir = wf_combat::Vec2::new(0.6, 0.8);
        s.hazards.push(HazardView { id: 900, kind: HazardKind::SniperLine,
            team: Team::Enemy, hostile: true, shape: Shape::Line { length: 600., width: 36. },
            origin, dir, fill: FillMode::Countdown, phase: HazardPhase::Active,
            progress: 0., width_scale: 1., owner: 999, tier: 1 });
        s.projectiles.push(ProjectileView { id: 901, kind: ProjectileKind::Bolt,
            pos: origin, dir, height: 0., team: Team::Enemy });
        let mut fx = Projectiles::default();
        fx.ingest(&[], &s, &s);
        assert_eq!(fx.sniper_segment(&s, &s.projectiles[0]), SniperProjectile::Hidden);
        let mut previous = (0., 0.);
        for tick in 1..13 {
            let distance = 1400. * tick as f32 * wf_combat::SIM_DT;
            s.projectiles[0].pos = origin + dir*distance;
            let SniperProjectile::Visible(tail, head) = fx.sniper_segment(&s, &s.projectiles[0]) else {
                panic!("live sniper bolt must have a segment");
            };
            let along = |p: wf_combat::Vec2| (p.x-origin.x)*dir.x + (p.y-origin.y)*dir.y;
            let (tail, head) = (along(tail), along(head));
            assert!((head-distance).abs() < 0.001);
            assert!((tail-(distance-72.).max(0.)).abs() < 0.001);
            assert!(tail >= 0. && head > previous.1 && tail >= previous.0);
            if tick > 2 { assert!(tail > previous.0); }
            previous = (tail, head);
        }
        s.projectiles[0].pos = origin + dir*600.;
        assert_eq!(fx.sniper_segment(&s, &s.projectiles[0]), SniperProjectile::Hidden, "ends without a stationary fade");
        s.projectiles[0].pos = origin + dir*650.;
        assert_eq!(fx.sniper_segment(&s, &s.projectiles[0]), SniperProjectile::Hidden);
        s.projectiles[0].pos = origin + dir*200.;
        assert!(matches!(fx.sniper_segment(&s, &s.projectiles[0]), SniperProjectile::Visible(..)));
        let previous = s.clone();
        s.projectiles.clear();
        fx.ingest(&[], &s, &previous);
        assert!(!fx.seen.contains_key(&901), "impact consumes the segment immediately");
    }
    #[test]
    fn collinear_snipers_keep_their_launch_muzzles_and_full_ranges() {
        let mut s = crate::testing::sim().snapshot().clone();
        s.hazards.clear(); s.projectiles.clear();
        for (hazard, bolt, x) in [(900, 901, 0.), (902, 903, 100.)] {
            let origin = wf_combat::Vec2::new(x, 0.);
            let dir = wf_combat::Vec2::new(1., 0.);
            s.hazards.push(HazardView { id: hazard, kind: HazardKind::SniperLine,
                team: Team::Enemy, hostile: true, shape: Shape::Line { length: 600., width: 36. },
                origin, dir, fill: FillMode::Countdown, phase: HazardPhase::Active,
                progress: 0., width_scale: 1., owner: 999, tier: 1 });
            s.projectiles.push(ProjectileView { id: bolt, kind: ProjectileKind::Bolt,
                pos: origin, dir, height: 0., team: Team::Enemy });
        }
        let mut fx = Projectiles::default();
        fx.ingest(&[], &s, &s);
        assert_eq!(fx.seen[&901].sniper.as_ref().unwrap().hazard, 900);
        assert_eq!(fx.seen[&903].sniper.as_ref().unwrap().hazard, 902);
        for travel in [20., 520., 599.] {
            let previous = s.clone();
            for (p, origin) in s.projectiles.iter_mut().zip([0., 100.]) {
                p.pos.x = origin + travel;
            }
            s.hazards.reverse();
            fx.ingest(&[], &s, &previous);
            for (p, origin) in s.projectiles.iter().zip([0., 100.]) {
                assert_eq!(fx.sniper_segment(&s, p), SniperProjectile::Visible(
                    wf_combat::Vec2::new(origin + (travel - 72.).max(0.), 0.),
                    wf_combat::Vec2::new(origin + travel, 0.)));
            }
        }
        s.projectiles[1].pos.x = 700.;
        assert_eq!(fx.sniper_segment(&s, &s.projectiles[1]), SniperProjectile::Hidden);
        // The cached muzzle/direction/length survive later snapshot geometry changes.
        let lane = s.hazards.iter_mut().find(|h| h.id == 902).unwrap();
        lane.origin.x = 500.; lane.dir = wf_combat::Vec2::new(0., 1.);
        lane.shape = Shape::Line { length: 50., width: 36. };
        s.projectiles[1].pos.x = 620.;
        assert_eq!(fx.sniper_segment(&s, &s.projectiles[1]), SniperProjectile::Visible(
            wf_combat::Vec2::new(548., 0.), wf_combat::Vec2::new(620., 0.)));
        s.hazards.retain(|h| h.id != 902);
        assert_eq!(fx.sniper_segment(&s, &s.projectiles[1]), SniperProjectile::Hidden);
    }
    #[test]
    fn aligned_orbs_bombs_and_hero_bolts_use_the_normal_path() {
        let mut s = crate::testing::sim().snapshot().clone();
        s.hazards.clear(); s.projectiles.clear();
        s.hazards.push(HazardView { id: 900, kind: HazardKind::SniperLine,
            team: Team::Enemy, hostile: true, shape: Shape::Line { length: 600., width: 36. },
            origin: wf_combat::Vec2::new(0., 0.), dir: wf_combat::Vec2::new(1., 0.),
            fill: FillMode::Countdown, phase: HazardPhase::Active,
            progress: 0., width_scale: 1., owner: 999, tier: 1 });
        for (id, kind, team) in [(901, ProjectileKind::Orb, Team::Enemy),
            (902, ProjectileKind::Bomb, Team::Enemy), (903, ProjectileKind::Bolt, Team::Hero)] {
            s.projectiles.push(ProjectileView { id, kind, team,
                pos: wf_combat::Vec2::new(20., 0.), dir: wf_combat::Vec2::new(1., 0.), height: 0. });
        }
        let mut fx = Projectiles::default(); fx.ingest(&[], &s, &s);
        for p in &s.projectiles {
            assert!(fx.seen[&p.id].sniper.is_none());
            assert_eq!(fx.sniper_segment(&s, p), SniperProjectile::Unrelated);
        }
    }
    #[test]
    fn listed_projectile_handoff_keeps_drawn_point_and_leaves_basics_below() {
        let (mut s,_,_,source)=flight_scene();let mut bg=Projectiles::default();
        for id in [800,801] {bg.seen.insert(id,Observation{origin:wf_combat::Vec2::new(0.,0.),born:1.,source:Some(source),marid:false,target:None,drawn:Cell::new(Some(vec2(42.,43.))),sniper:None,muzzle_offset:Vec2::ZERO});}
        for skill in [None,Some(Skill::ArcanePulse)] {
            bg.releases.push(Release{source,skill,pos:wf_combat::Vec2::new(0.,0.),height:20.,dir:Vec2::X,born:1.,muzzle:true,enemy:false});
            bg.casts.push(Cast{id:source,skill,state:if skill.is_some(){ActorState::Cast}else{ActorState::Basic},target:None,last_age:0.15});
        }
        let v=SpotlightView{caster:99,skill:Skill::BubblePop,phase:SpotlightPhase::Charge,started:20.,participants:vec![],
            co_casters:vec![source],hazards:vec![],projectiles:vec![800]};
        let mut fg=Projectiles::default();fg.take_combo(&mut bg,&v,19.);
        assert_eq!(fg.seen.keys().copied().collect::<Vec<_>>(),vec![800]);assert!(bg.seen.contains_key(&801));
        assert_eq!(fg.seen[&800].born,20.);assert_eq!(fg.seen[&800].drawn.get(),Some(vec2(42.,43.)));
        assert_eq!(bg.releases.len(),1);assert!(bg.releases[0].skill.is_none());assert_eq!(bg.casts[0].state,ActorState::Basic);
        assert_eq!(fg.releases.len(),1);assert_eq!(fg.casts.len(),1);assert_eq!(fg.casts[0].last_age,0.15);
        s.projectiles.clear();bg.inherit_observations(&fg,-19.,&s);assert!(!bg.seen.contains_key(&800));
        let mut p=wf_combat::ProjectileView{id:800,kind:ProjectileKind::Orb,pos:wf_combat::Vec2::new(0.,0.),height:20.,team:Team::Hero,dir:wf_combat::Vec2::new(1.,0.)};
        s.projectiles.push(p.clone());fg.seen[&800].drawn.set(Some(vec2(50.,51.)));
        bg.inherit_observations(&fg,-19.,&s);assert_eq!(bg.seen[&800].drawn.get(),Some(vec2(50.,51.)));
        p.id=801;s.projectiles=vec![p];fg.pause_combo(&v,1.2);assert!((fg.seen[&800].born-21.2).abs()<1e-8);
    }

    use super::*;
    fn manifest() -> Manifest {
        use nanoserde::DeJson;
        Manifest::deserialize_json(include_str!("../../gen/assets.json")).unwrap()
    }
    fn flight_scene() -> (Snapshot,Snapshot,ActorView,u32) {
        let mut old=crate::testing::sim().snapshot().clone();
        old.projectiles.clear();old.hazards.clear();
        old.actors[0].archetype=Archetype::Runa;old.actors[0].pos=wf_combat::Vec2::new(500.,700.);
        let source=old.actors[0].id;
        let mut target=old.actors[0].clone();target.id=900;target.team=Team::Enemy;target.archetype=Archetype::Boss;
        target.scale=2.2;target.radius=66.;target.pos=wf_combat::Vec2::new(500.,500.);target.state=ActorState::Idle;
        old.actors.push(target.clone());
        old.projectiles.push(ProjectileView{id:800,kind:ProjectileKind::Orb,team:Team::Hero,
            pos:wf_combat::Vec2::new(500.,580.),dir:wf_combat::Vec2::new(0.,-1.),height:0.});
        let mut now=old.clone();now.time+=wf_combat::SIM_DT as f64;now.projectiles.clear();
        (old,now,target,source)
    }
    // mirewing_rounds_leave_painted_mouth_both_facings_and_keep_launch_offset retired (ORKA-63bf.12): Mirewing is not in the live Wishfire roster.
    #[test]
    fn terminal_endpoint_is_on_opaque_painted_boss_body_from_every_approach() {
        let m=manifest();let (_,_,mut boss,source)=flight_scene();
        let art=&m.actors["Boss"];let clip=&art.clips["idle"];let frame=&clip.frames[0];
        let root=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("gen");
        let pixels=Image::from_file_with_format(&std::fs::read(root.join(&m.pages[frame.page].file)).unwrap(),None).unwrap();
        for facing in [Facing::Left,Facing::Right] {
            boss.facing=facing;boss.state_age=0.;let endpoint=body_contact(Some(&m),&boss);
            let relative=(endpoint-vec2(boss.pos.x,boss.pos.y*SQUASH))/super::super::actors::visual_scale(&boss);
            let flip=(art.facing=="left")!=(facing==Facing::Left);
            let x=if flip {clip.foot_origin[0]-frame.offset_x-frame.w} else {frame.offset_x-clip.foot_origin[0]};
            let top=frame.offset_y-clip.foot_origin[1];
            assert!(Rect::new(x,top,frame.w,frame.h).contains(relative));
            let sx=if flip {frame.w-(relative.x-x)}else{relative.x-x};let sy=relative.y-top;
            assert!(pixels.get_pixel((frame.x+sx) as u32,(frame.y+sy) as u32).a>0.9,"contact must land on painted pixels");
            for approach in [vec2(0.,100.),vec2(100.,60.),vec2(-100.,60.),vec2(0.,-150.)] {
                let from=vec2(boss.pos.x,boss.pos.y*SQUASH)+approach;
                let t=Terminal{id:1,kind:ProjectileKind::Orb,source,target:boss.id,element:Some(Element::Arcane),boss:true,
                    foot:vec2(boss.pos.x,boss.pos.y*SQUASH),from,to:endpoint,born:1.,duration:((from-endpoint).length() as f64/2400.).clamp(1./120.,TERMINAL_CAP)};
                assert_eq!(t.position(t.born),from);assert_eq!(t.position(t.arrival()),endpoint);
                assert!(t.duration<=0.08);
            }
        }
    }
    #[test]
    fn hit_only_terminal_uses_last_drawn_position_survives_death_and_ages_on_its_clock() {
        let m=manifest();let (old,mut now,target,source)=flight_scene();
        let event=Event::Hit{source,target:target.id,amount:10.,crit:false,element:Element::Arcane, blocked: false};
        let mut fx=Projectiles::default();fx.ingest_context(&[],&old,&old,&old,&old,Some(&m));
        let drawn=vec2(501.,440.);fx.seen.get(&800).unwrap().drawn.set(Some(drawn));
        now.actors.retain(|a|a.id!=target.id); // fatal hit removed target: use previous/corpse position
        fx.ingest_context(&[event.clone(),Event::Died{id:target.id}],&now,&old,&now,&old,Some(&m));
        assert_eq!(fx.terminals.len(),1);let t=&fx.terminals[0];assert_eq!(t.from,drawn);
        assert_eq!(t.to,body_contact(Some(&m),&target));assert_eq!(t.target,target.id);
        let arrival=t.arrival();assert_eq!(fx.arrival(source,now.time,Element::Poison),None);assert!(fx.busy(now.time));assert!(!fx.busy(arrival+0.001));
        let mut frozen=now.clone();frozen.time=now.time;fx.ingest_context(&[],&frozen,&now,&frozen,&now,Some(&m));
        assert_eq!(fx.terminals[0].position(frozen.time),drawn);
        let mut late=now.clone();late.time=arrival+0.3;fx.ingest_context(&[],&late,&now,&late,&now,Some(&m));assert!(fx.terminals.is_empty());
        for reset in [Event::SceneReset,Event::WaveReset,Event::StageCleared] {
            fx.ingest_context(&[reset,event.clone()],&now,&old,&now,&old,Some(&m));assert!(fx.terminals.is_empty());
        }
        fx.ingest_context(&[],&now,&old,&now,&old,Some(&m));assert!(fx.terminals.is_empty(),"expiry without a hit cannot create a tail");
    }
    #[test]
    fn runa_splash_does_not_redirect_the_terminal_to_a_secondary_victim() {
        let m=manifest();let (mut old,mut now,target,source)=flight_scene();
        old.actors[0].target=Some(target.id);
        let mut splash=target.clone();splash.id=901;splash.radius=20.;splash.archetype=Archetype::Gobloc;splash.scale=1.;
        splash.pos=wf_combat::Vec2::new(500.,550.);old.actors.push(splash.clone());now.actors.push(splash.clone());
        let hits=[splash.id,target.id].map(|target|Event::Hit{source,target,amount:10.,crit:false,element:Element::Arcane, blocked: false});
        let mut fx=Projectiles::default();fx.ingest_context(&hits,&now,&old,&now,&old,Some(&m));
        assert_eq!(fx.terminals.len(),1);assert_eq!(fx.terminals[0].target,target.id);
    }
    #[test]
    fn terminal_uses_full_actor_context_but_only_the_owning_projectile_layer() {
        let m=manifest();let (old,mut now,target,source)=flight_scene();now.combat_time=old.combat_time;
        now.time=old.time+1.2;
        let event=Event::Hit{source,target:target.id,amount:10.,crit:false,element:Element::Arcane, blocked: false};
        let mut filtered=now.clone();filtered.projectiles.clear();let mut old_filtered=old.clone();old_filtered.actors.clear();
        let mut fx=Projectiles::default();fx.ingest_context(&[event],&filtered,&old_filtered,&now,&old,Some(&m));
        assert_eq!(fx.terminals.len(),1);assert_eq!(fx.terminals[0].born,now.time);
        assert!(fx.busy(now.time));assert!(!fx.busy(now.time+0.081));
        old_filtered.projectiles.clear();let mut background=Projectiles::default();
        background.ingest_context(&[Event::Hit{source,target:target.id,amount:10.,crit:false,element:Element::Arcane, blocked: false}],&filtered,&old_filtered,&now,&old,Some(&m));
        assert!(background.terminals.is_empty(),"the other layer cannot duplicate the terminal");
    }
    #[test]
    fn cancelled_sniper_warning_cannot_create_or_retain_a_release_record() {
        for phase in [HazardPhase::Tracking,HazardPhase::Locked,HazardPhase::Active] {
            let mut old=crate::testing::sim().snapshot().clone();
            old.hazards.push(HazardView{id:900,kind:HazardKind::SniperLine,team:Team::Enemy,hostile:true,shape:Shape::Line{length:300.,width:36.},
                origin:old.actors[0].pos,dir:wf_combat::Vec2::new(1.,0.),fill:FillMode::Countdown,phase,progress:0.5,width_scale:1.,owner:999,tier:1});
            let mut fx=Projectiles::default();fx.ingest(&[],&old,&old);
            let mut s=old.clone();s.time+=wf_combat::SIM_DT as f64;s.hazards.retain(|h|h.id!=900);
            fx.ingest(&[Event::HazardCancelled{id:900,kind:HazardKind::SniperLine}],&s,&old);
            assert!(fx.releases.is_empty());assert!(fx.seen.is_empty());assert!(!fx.busy(s.time));
            // Client discharges are snapshot-driven; cancellation manufactures no projectile or release.
            assert!(s.projectiles.is_empty());
            let old=s.clone();s.time+=wf_combat::SIM_DT as f64;fx.ingest(&[],&s,&old);assert_eq!(fx.records(),0);
        }
    }
}

#[cfg(test)]
mod boss_art_tests {
    use super::*;
    #[test]
    fn painted_djinn_beam_replaces_only_its_own_legacy_bolt() {
        let mut old=crate::testing::sim().snapshot().clone();old.hazards.clear();old.projectiles.clear();
        old.hazards.push(HazardView{id:900,kind:HazardKind::BossSnipe,team:Team::Enemy,hostile:true,shape:Shape::Line{length:500.,width:120.},
            origin:wf_combat::Vec2::new(0.,0.),dir:wf_combat::Vec2::new(1.,0.),fill:wf_combat::FillMode::Countdown,phase:HazardPhase::Locked,progress:1.,width_scale:1.,owner:999,tier:1});
        let mut s=old.clone();s.time+=wf_combat::SIM_DT as f64;s.hazards[0].phase=HazardPhase::Active;
        s.projectiles.push(wf_combat::ProjectileView{id:901,kind:ProjectileKind::Bolt,pos:wf_combat::Vec2::new(0.,0.),dir:wf_combat::Vec2::new(1.,0.),height:0.,team:Team::Enemy});
        let mut sniper=s.projectiles[0].clone();sniper.id=902;sniper.pos.y=150.;s.projectiles.push(sniper);
        let mut lane = s.hazards[0].clone(); lane.id = 903; lane.kind = HazardKind::SniperLine;
        s.hazards.push(lane);
        let mut fx=Projectiles::default();fx.ingest(&[],&s,&old);
        assert!(fx.seen[&901].sniper.is_none());
        assert_eq!(fx.boss_bolts.get(&900),Some(&901));assert!(!fx.boss_bolts.values().any(|id|*id==902));
        let mut late=Projectiles::default();late.ingest(&[],&s,&s);
        assert_eq!(late.boss_bolts.get(&900),Some(&901),"a background frame skipped at spotlight begin still identifies the boss bolt");
        let previous=s.clone();s.hazards.retain(|h| h.kind != HazardKind::BossSnipe);fx.ingest(&[],&s,&previous);
        assert_eq!(fx.sniper_segment(&s, &s.projectiles[0]), SniperProjectile::Unrelated,
            "boss bolt must never become a sniper discharge, even in a collinear sniper lane");
        assert_eq!(fx.sniper_segment(&s, &s.projectiles[1]), SniperProjectile::Unrelated);
    }
}
