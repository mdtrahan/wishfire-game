//! Approved B2/A3 body colour and foot-anchored motion. Release remains sim-owned.
use std::collections::BTreeMap;
use macroquad::prelude::*;
use wf_combat::{ActorState, ActorView, Archetype, Event, Facing, Groove, Skill, Snapshot, SpotlightPhase, Team};
use crate::{assets::{Assets, Clip, DrawStats}, camera::WorldCamera};

// output/ORKA-6jh1.32/src/render.py and src/assets/manifest.json.
const PURPLE: [f32; 3] = [168. / 255., 36. / 255., 249. / 255.];
const BLUE: [f32; 3] = [174. / 255., 229. / 255., 251. / 255.];
const CASTER: f32 = 0.55;
const PARTY: f32 = 0.40;
pub(super) const ELEVATE_FADE_SECONDS: f32 = 1.875;
fn smooth(t: f32) -> f32 { let t = t.clamp(0., 1.); t*t*(3.-2.*t) }
fn decay(t: f32) -> f32 { (1.-t.clamp(0., 1.)).powi(3) }
fn curve(age: f32, windup: f32) -> f32 {
    if age < 0. { 0. } else if age < windup { smooth(age/windup) }
    else { 1.-smooth((age-windup)/windup) }
}
fn approved(a: &ActorView, skill: Skill) -> bool {
    a.team == Team::Hero && matches!((a.archetype, skill),
        (Archetype::Kaja, Skill::Elevate) | (Archetype::Fara, Skill::Taunt))
}
fn living(a: &ActorView) -> bool {
    a.hp > 0. && !matches!(a.state, ActorState::Downed | ActorState::Dead)
}
struct Cast { skill: Skill, age: f32, windup: f32, released: bool }
#[derive(Default)]
pub struct CastHue {
    casts: BTreeMap<u32, Cast>,
    flashes: BTreeMap<u32, f32>,
    clocks: Option<(f64, f64)>,
}
impl CastHue {
    /// Observe once before spotlight partitions; both draw paths share these records.
    pub fn observe(&mut self, s: &Snapshot, events: &[Event]) {
        let events = if let Some(i) = events.iter().rposition(|e| matches!(e, Event::SceneReset)) {
            *self = Self::default(); &events[i+1..]
        } else { events };
        let (live, combat) = self.clocks.map_or((0., 0.), |(t,c)|
            ((s.time-t).max(0.) as f32, (s.combat_time-c).max(0.) as f32));
        self.clocks = Some((s.time, s.combat_time));
        let dt = |id| s.spotlight.as_ref().filter(|v| v.caster == id || v.co_casters.contains(&id))
            .map_or(combat, |v| if v.phase == SpotlightPhase::Performing { live } else { 0. });
        self.casts.retain(|id,c| {
            let Some(a) = s.actors.iter().find(|a| a.id == *id && living(a)) else { return false };
            c.age += dt(*id);
            if !c.released && a.state == ActorState::Cast { c.age = a.state_age; }
            c.age < c.windup*2. && (c.released || a.state == ActorState::Cast)
        });
        self.flashes.retain(|id,age| {
            *age += combat;
            *age < ELEVATE_FADE_SECONDS && s.actors.iter().any(|a| a.id == *id && living(a))
        });
        for e in events {
            match *e {
                Event::SkillStarted { id, skill, .. } => {
                    // A later offensive cast must not inherit the previous utility cast's body hue.
                    self.casts.remove(&id);
                    if let Some(a) = s.actors.iter().find(|a| a.id == id && living(a) && approved(a, skill)) {
                        self.casts.insert(id, Cast { skill, age: a.state_age,
                            windup: a.impact_at, released: false });
                    }
                }
                Event::GrooveActivated { hero, groove: Groove::Power, .. } => {
                    if let Some(c) = self.casts.get_mut(&hero).filter(|c| c.skill == Skill::Elevate) {
                        c.released = true; c.age = c.windup;
                        // Sim::action buffs every living hero, including out-of-range allies.
                        for a in s.actors.iter().filter(|a| a.team == Team::Hero && living(a) && a.id != hero) {
                            self.flashes.insert(a.id, 0.);
                        }
                    }
                }
                Event::WardGained { target, .. } => {
                    if let Some(c) = self.casts.get_mut(&target).filter(|c| c.skill == Skill::Taunt && !c.released) {
                        c.released = true; c.age = c.windup;
                    }
                }
                _ => {}
            }
        }
    }
    fn tint(&self, a: &ActorView) -> ([f32; 3], f32) {
        if !living(a) { return (PURPLE, 0.) }
        let flash = self.flashes.get(&a.id).map_or(0., |age| PARTY*(1.-smooth(*age/ELEVATE_FADE_SECONDS)));
        if let Some(c) = self.casts.get(&a.id) {
            let strength = CASTER*curve(c.age, c.windup);
            if strength >= flash { return (if c.skill == Skill::Elevate { PURPLE } else { BLUE }, strength) }
        }
        (PURPLE, flash)
    }
    pub fn active(&self, a: &ActorView) -> bool { self.tint(a).1 > 0. }
    fn pose(&self, a: &ActorView) -> Option<Pose> {
        let c = self.casts.get(&a.id).filter(|_| living(a))?;
        let stretch = if c.skill == Skill::Elevate { 1.25 } else { 1. };
        let age = if c.released { 1.5 + (c.age-c.windup)/stretch } else { c.age/stretch };
        (age < 1.82).then(|| puppet(c.skill, age, c.released, a.facing))
    }
    pub fn posing(&self, a: &ActorView) -> bool { self.pose(a).is_some() }
    pub fn draw(&self, assets: &Assets, camera: &WorldCamera, a: &ActorView, clip: &Clip,
        frame: &crate::assets::Frame, foot: Vec2, tint: Color, stats: &mut DrawStats) {
        if !self.active(a) && !self.posing(a) {
            let flip = (assets.manifest.actors[&format!("{:?}",a.archetype)].facing == "left") != (a.facing == Facing::Left);
            assets.frame(frame, clip.foot_origin, foot, super::actors::visual_scale(a)*camera.zoom, flip, tint, stats);
            return;
        }
        let pose = self.pose(a).unwrap_or_default();
        let frame = pose.frame.and_then(|i| clip.frames.get(i)).unwrap_or(frame);
        let Some(page) = assets.pages.get(frame.page) else { stats.missing(format!("atlas:{}",frame.page)); return };
        let flip = (assets.manifest.actors[&format!("{:?}",a.archetype)].facing == "left") != (a.facing == Facing::Left);
        let scale = super::actors::visual_scale(a)*camera.zoom;
        // Study offsets are authored against a 58-pixel-tall painted body.
        let unit = super::actors::body_height(assets,a,camera.zoom)/58.;
        let foot = foot + vec2(pose.dx, -pose.lift)*unit;
        let x = if flip { clip.foot_origin[0]-frame.offset_x-frame.w } else { frame.offset_x-clip.foot_origin[0] };
        let (hue, strength) = self.tint(a);
        if strength > 0. {
            assets.cast_hue.set_uniform("HueStrength", (hue[0],hue[1],hue[2],strength));
            gl_use_material(&assets.cast_hue);
        }
        draw_texture_ex(page, foot.x+x*scale, foot.y+(frame.offset_y-clip.foot_origin[1])*scale*pose.sy,
            tint, DrawTextureParams { source: Some(Rect::new(frame.x,frame.y,frame.w,frame.h)),
                dest_size: Some(vec2(frame.w*scale,frame.h*scale*pose.sy)), flip_x: flip,
                rotation: pose.angle, pivot: Some(foot), ..Default::default() });
        if strength > 0. { gl_use_default_material(); }
        stats.calls += 1;
    }
}
struct Pose { sy: f32, lift: f32, dx: f32, angle: f32, frame: Option<usize> }
impl Default for Pose {
    fn default() -> Self { Self { sy: 1., lift: 0., dx: 0., angle: 0., frame: None } }
}
fn puppet(skill: Skill, age: f32, released: bool, facing: Facing) -> Pose {
    let mut p = Pose::default();
    if !released {
        if skill == Skill::Elevate {
            if age < 0.25 { p.sy=1.-0.08*smooth(age/0.25); p.frame=Some(0); }
            else {
                let up=smooth((age-0.25)/0.30);
                p.sy=0.92+0.08*up; p.lift=6.*up; p.frame=Some((up*6.) as usize);
                if age >= 1.1 { p.dx=1.5*((age-1.1)*std::f32::consts::TAU*18.).sin(); }
            }
        } else {
            let plant=smooth(age/0.25); p.sy=1.-0.10*plant;
            // Pillow rotates counterclockwise; GPU screen rotation is clockwise.
            let direction=if facing == Facing::Left { 1. } else { -1. };
            p.angle=(6_f32*plant*direction).to_radians();
            p.frame=Some(((age/0.35*5.) as usize).min(5));
        }
    } else {
        let r=(age-1.5).max(0.);
        p.frame=Some((6+(r/0.32*5.) as usize).min(11));
        let tail=if r < 0.1 { 1. } else { decay((r-0.1)/0.22) };
        if skill == Skill::Elevate { p.sy=1.+0.08*tail; p.lift=6.*decay(r/0.2); }
        else { p.sy=1.+0.10*tail; p.dx=if facing == Facing::Left { -5.*tail } else { 5.*tail }; }
    }
    p
}

// Exact study colour blend + 35% saturated additive lift, retaining texture alpha.
// Gamut compression preserves source luminance before the additive light.
pub const FRAGMENT: &str = "#version 100
precision highp float;
varying lowp vec2 uv; varying lowp vec4 color;
uniform sampler2D Texture; uniform vec4 HueStrength;
void main() {
    vec4 tex = texture2D(Texture, uv);
    vec3 weights = vec3(0.2126, 0.7152, 0.0722);
    vec3 hue = HueStrength.rgb;
    float strength = HueStrength.a;
    float lum = dot(tex.rgb, weights);
    vec3 target = hue + lum - dot(hue, weights);
    float low = min(target.r, min(target.g, target.b));
    target = lum + (target-lum)*min(1.0, lum/max(lum-low, 0.000001));
    float high = max(target.r, max(target.g, target.b));
    target = lum + (target-lum)*min(1.0, (1.0-lum)/max(high-lum, 0.000001));
    float floorHue = min(hue.r, min(hue.g, hue.b));
    float rangeHue = max(hue.r, max(hue.g, hue.b))-floorHue;
    vec3 light = (hue-floorHue)/max(rangeHue, 0.000001);
    vec3 rgb = clamp(mix(tex.rgb, target, strength)+light*(0.35*strength), 0.0, 1.0);
    gl_FragColor = vec4(rgb*color.rgb, tex.a*color.a);
}";

#[cfg(test)]
mod tests {
    use super::*;
    use wf_combat::{Sim, SimConfig, SpotlightView};
    fn snapshot() -> Snapshot { crate::testing::sim().snapshot().clone() }
    fn close(a: f32, b: f32) { assert!((a-b).abs()<0.00001,"{a} != {b}"); }
    fn start(s: &mut Snapshot, tint: &mut CastHue, index: usize, skill: Skill, windup: f32) {
        let a=&mut s.actors[index];
        a.state=ActorState::Cast; a.state_age=0.; a.impact_at=windup;
        let id=a.id;
        tint.observe(s,&[Event::SkillStarted{id,skill,target:None}]);
    }
    #[test]
    fn study_curves_zero_before_peak_at_release_half_mid_fade_and_zero_after() {
        for windup in [1.875,1.5] {
            close(curve(-0.01,windup),0.); close(curve(0.,windup),0.);
            close(curve(windup*0.5,windup),0.5);
            close(curve(windup,windup),1.);
            close(curve(windup*1.5,windup),0.5);
            close(curve(windup*2.,windup),0.); close(curve(windup*3.,windup),0.);
        }
    }
    #[test]
    fn elevate_flashes_only_release_buffed_living_heroes_with_study_strengths() {
        let mut s=snapshot(); let mut tint=CastHue::default();
        // Sim buffs all living allies at any distance; downed/enemy actors get none.
        s.actors[0].pos.x=-1000.;
        s.actors[1].hp=0.; s.actors[1].state=ActorState::Downed;
        let mut enemy=s.actors[0].clone(); enemy.id=99; enemy.team=Team::Enemy;
        s.actors.push(enemy);
        start(&mut s,&mut tint,3,Skill::Elevate,1.875);
        assert!(s.actors.iter().all(|a|tint.tint(a).1==0.));
        s.time=1.9; s.combat_time=1.9; s.actors[3].state_age=1.9;
        let hero=s.actors[3].id;
        for variant in [wf_combat::api::ElevateVariant::Sword, wf_combat::api::ElevateVariant::Wings, wf_combat::api::ElevateVariant::WingedBoots] {
            s.actors[3].elevate=Some(variant);
            tint.observe(&s,&[Event::GrooveActivated{hero,groove:Groove::Power,seconds:8.}]);
            close(tint.tint(&s.actors[0]).1,PARTY);
        }
        close(tint.tint(&s.actors[3]).1,CASTER);
        for i in [0,2] { assert_eq!(tint.tint(&s.actors[i]).0,PURPLE); close(tint.tint(&s.actors[i]).1,PARTY); }
        for i in [1,4] { close(tint.tint(&s.actors[i]).1,0.); }
        s.actors[1].hp=100.; s.actors[1].state=ActorState::Idle;
        s.time+=0.9375; s.combat_time+=0.9375; tint.observe(&s,&[]);
        close(tint.tint(&s.actors[0]).1,PARTY*0.5); close(tint.tint(&s.actors[3]).1,CASTER*0.5);
        close(tint.tint(&s.actors[1]).1,0.); // Revived after release was not a recipient.
        s.actors[0].hp=0.; tint.observe(&s,&[]); close(tint.tint(&s.actors[0]).1,0.);
        s.time+=0.9375; s.combat_time+=0.9375; tint.observe(&s,&[]);
        assert!(s.actors.iter().all(|a|tint.tint(a).1==0.));
    }
    #[test]
    fn warcry_blue_tracks_taunt_release_and_never_ground_pound_or_other_casts() {
        for skill in [Skill::Taunt,Skill::GroundPound,Skill::CrimsonWard] {
            let mut s=snapshot(); let mut tint=CastHue::default();
            start(&mut s,&mut tint,0,skill,1.5);
            s.time=1.5; s.combat_time=1.5; s.actors[0].state_age=1.5;
            let target=s.actors[0].id;
            tint.observe(&s,&[Event::WardGained{target,amount:100.}]);
            if skill==Skill::Taunt {
                assert_eq!(tint.tint(&s.actors[0]).0,BLUE); close(tint.tint(&s.actors[0]).1,CASTER);
                assert!(s.actors[1..].iter().all(|a|tint.tint(a).1==0.));
                s.time+=0.75; s.combat_time+=0.75; tint.observe(&s,&[]);
                close(tint.tint(&s.actors[0]).1,CASTER*0.5);
                s.time+=0.75; s.combat_time+=0.75; tint.observe(&s,&[]);
                close(tint.tint(&s.actors[0]).1,0.);
            } else { assert!(tint.casts.is_empty()); assert!(!tint.active(&s.actors[0])); }
        }
    }
    #[test]
    fn ground_pound_started_during_warcry_fade_never_inherits_blue() {
        let mut s=snapshot(); let mut tint=CastHue::default();
        start(&mut s,&mut tint,0,Skill::Taunt,1.5);
        s.actors[0].state_age=1.5;
        let target=s.actors[0].id;
        tint.observe(&s,&[Event::WardGained{target,amount:100.}]);
        close(tint.tint(&s.actors[0]).1,CASTER);
        start(&mut s,&mut tint,0,Skill::GroundPound,0.35);
        assert!(!tint.active(&s.actors[0])); assert!(!tint.posing(&s.actors[0]));
    }
    #[test]
    fn spotlight_layer_handoffs_share_hue_and_freeze_background_on_combat_clock() {
        let mut s=snapshot(); let mut tint=CastHue::default();
        start(&mut s,&mut tint,0,Skill::Taunt,1.5);
        s.actors[0].state_age=0.75; s.time=0.75; s.combat_time=0.75; tint.observe(&s,&[]);
        let before=tint.tint(&s.actors[0]); close(before.1,CASTER*0.5);
        let mut view=SpotlightView{caster:s.actors[1].id,skill:Skill::Shadow,phase:SpotlightPhase::Performing,
            started:s.time,participants:vec![],co_casters:vec![],hazards:vec![],projectiles:vec![]};
        s.spotlight=Some(view.clone()); s.time+=2.; tint.observe(&s,&[]);
        assert_eq!(tint.tint(&s.actors[0]),before);
        view.caster=s.actors[0].id; view.skill=Skill::Taunt;
        s.spotlight=Some(view.clone());
        let (_,spot)=super::super::spotlight::frames(&s,Some(&view));
        assert_eq!(tint.tint(&spot.actors[0]),before);
        s.actors[0].state_age=1.5; s.time+=0.75;
        let target=s.actors[0].id; tint.observe(&s,&[Event::WardGained{target,amount:100.}]);
        close(tint.tint(&s.actors[0]).1,CASTER);
        s.spotlight.as_mut().unwrap().phase=SpotlightPhase::Tail; s.time+=1.; tint.observe(&s,&[]);
        close(tint.tint(&s.actors[0]).1,CASTER);
        s.spotlight=None; s.time+=0.75; s.combat_time+=0.75; tint.observe(&s,&[]);
        close(tint.tint(&s.actors[0]).1,CASTER*0.5);
        tint.observe(&s,&[Event::SceneReset]); assert!(tint.casts.is_empty());
    }
    #[test]
    fn approved_puppet_beats_stretch_kaja_and_mirror_fara_about_the_feet() {
        let crouch=puppet(Skill::Elevate,0.25,false,Facing::Left); close(crouch.sy,0.92);
        let lift=puppet(Skill::Elevate,0.55,false,Facing::Left); close(lift.sy,1.); close(lift.lift,6.);
        let mut s=snapshot(); let mut tint=CastHue::default(); start(&mut s,&mut tint,3,Skill::Elevate,1.875);
        s.actors[3].state_age=0.3125; tint.observe(&s,&[]); close(tint.pose(&s.actors[3]).unwrap().sy,0.92);
        let left=puppet(Skill::Taunt,1.4,false,Facing::Left);
        let right=puppet(Skill::Taunt,1.4,false,Facing::Right);
        close(left.sy,0.9); close(left.angle,6_f32.to_radians()); close(left.angle,-right.angle);
        let release=puppet(Skill::Taunt,1.5,true,Facing::Left); close(release.sy,1.1); close(release.dx,-5.);
    }
}
