//! Participant framing in ground-projected world units; HUD remains screen-space.
use crate::{
    assets::Manifest,
    camera::{WorldCamera, HEIGHT, SQUASH, WIDTH, ZOOM},
    clips,
    render::actors,
};
use macroquad::prelude::*;
use wf_combat::api::{Shape, Snapshot, SpotlightView};
pub const SAFE: Rect = Rect::new(14., 58., 332., 508.);
const MAX_ZOOM: f32 = 0.8;
#[derive(Clone, Copy, Debug)]
pub struct Framing {
    pub centre: Vec2,
    pub zoom: f32,
}
impl Framing {
    fn from_camera(c: &WorldCamera) -> Self {
        Self {
            centre: c.centre,
            zoom: c.zoom,
        }
    }
    fn mix(self, to: Self, t: f32) -> Self {
        Self {
            centre: self.centre.lerp(to.centre, t),
            zoom: self.zoom + (to.zoom - self.zoom) * t,
        }
    }
}
fn union(a: Rect, b: Rect) -> Rect {
    let lo = vec2(a.x.min(b.x), a.y.min(b.y));
    let hi = vec2(a.right().max(b.right()), a.bottom().max(b.bottom()));
    Rect::new(lo.x, lo.y, hi.x - lo.x, hi.y - lo.y)
}
fn point(p: wf_combat::Vec2) -> Vec2 {
    vec2(p.x, p.y * SQUASH)
}
fn pad(r:Rect)->Rect {Rect::new(r.x-12.,r.y-12.,r.w+24.,r.h+24.)}
/// Include every frame of the current clip and idle art, including facing changes.
fn actor_box(manifest:&Manifest,a:&wf_combat::ActorView)->Rect {
    let p=point(a.pos);let scale=actors::visual_scale(a);
    let mut body=Rect::new(p.x-55.*scale,p.y-110.*scale,110.*scale,115.*scale);
    if let Some(art)=manifest.actors.get(&format!("{:?}",a.archetype)) {
        for name in ["idle",clips::name(a.state)] {
            if let Some(clip)=art.clips.get(name) {
                for f in &clip.frames {
                    let half=(f.offset_x-clip.foot_origin[0]).abs().max((f.offset_x+f.w-clip.foot_origin[0]).abs())*scale;
                    body=union(body,Rect::new(p.x-half,p.y+(f.offset_y-clip.foot_origin[1])*scale,2.*half,f.h*scale));
                }
            }
        }
    }
    pad(body)
}
fn hazard_box(h:&wf_combat::HazardView)->Rect {
    let p=point(h.origin);
    let radius=match h.shape {
        Shape::Circle{radius}=>radius,Shape::Ring{outer,..}=>outer,Shape::Cone{length,..}=>length,
        Shape::Line{length,width}=> {
            let end=point(h.origin+h.dir*length);
            return pad(Rect::new(p.x.min(end.x)-width*0.5,p.y.min(end.y)-width*SQUASH*0.5,
                (end.x-p.x).abs()+width,(end.y-p.y).abs()+width*SQUASH));
        }
    };
    pad(Rect::new(p.x-radius,p.y-radius*SQUASH,radius*2.,radius*2.*SQUASH))
}
fn core_bounds(manifest:&Manifest,s:&Snapshot,view:&SpotlightView)->Option<Rect> {
    s.actors.iter().filter(|a|a.id==view.caster || (a.team==wf_combat::Team::Enemy && view.participants.contains(&a.id)))
        .map(|a|actor_box(manifest,a))
        .chain(s.hazards.iter().filter(|h|view.hazards.contains(&h.id) && !view.co_casters.contains(&h.owner)).map(hazard_box))
        .reduce(union)
}
fn include_nearby(mut core:Rect,manifest:&Manifest,s:&Snapshot,view:&SpotlightView)->Rect {
    if !contained(core,fit(core)) {return core;}
    let centre=vec2(core.x+core.w*0.5,core.y+core.h*0.5);
    let mut extras:Vec<_>=s.actors.iter().filter(|a|a.team==wf_combat::Team::Hero && view.co_casters.contains(&a.id))
        .map(|a|actor_box(manifest,a))
        .chain(s.hazards.iter().filter(|h|view.hazards.contains(&h.id) && view.co_casters.contains(&h.owner)).map(hazard_box))
        .chain(s.projectiles.iter().filter(|p|view.projectiles.contains(&p.id)).map(|p| {
            let pos=point(p.pos)-vec2(0.,p.height);pad(Rect::new(pos.x-24.,pos.y-24.,48.,48.))
        })).collect();
    extras.sort_by(|a,b| {
        let distance=|r:&Rect|vec2(r.x+r.w*0.5,r.y+r.h*0.5).distance_squared(centre);
        distance(a).total_cmp(&distance(b))
    });
    for extra in extras {let candidate=union(core,extra);if contained(candidate,fit(candidate)) {core=candidate;}}
    core
}
/// Featured actors/footprint are mandatory; optional combo bounds must fit at normal zoom.
pub fn bounds(manifest:&Manifest,s:&Snapshot,view:&SpotlightView)->Option<Rect> {
    core_bounds(manifest,s,view).map(|core|include_nearby(core,manifest,s,view))
}
pub fn fit(b: Rect) -> Framing {
    let zoom = (SAFE.w / b.w.max(1.))
        .min(SAFE.h / b.h.max(1.))
        .clamp(ZOOM, MAX_ZOOM);
    let safe_mid = vec2(SAFE.x + SAFE.w / 2., SAFE.y + SAFE.h / 2.);
    let centre =
        vec2(b.x + b.w / 2., b.y + b.h / 2.) - (safe_mid - vec2(WIDTH / 2., HEIGHT / 2.)) / zoom;
    Framing {
        centre: vec2(centre.x, centre.y / SQUASH),
        zoom,
    }
}
pub fn contained(b: Rect, f: Framing) -> bool {
    let origin = vec2(f.centre.x, f.centre.y * SQUASH);
    let lo = (vec2(b.x, b.y) - origin) * f.zoom + vec2(WIDTH / 2., HEIGHT / 2.);
    let hi = (vec2(b.right(), b.bottom()) - origin) * f.zoom + vec2(WIDTH / 2., HEIGHT / 2.);
    lo.x >= SAFE.x - 0.01
        && lo.y >= SAFE.y - 0.01
        && hi.x <= SAFE.right() + 0.01
        && hi.y <= SAFE.bottom() + 0.01
}
fn constrain(mut f: Framing, b: Rect) -> Framing {
    // Keep easing inside the set of centres that fully frame a feasible group.
    let mut p = vec2(f.centre.x, f.centre.y * SQUASH);
    for (value, min, max) in [
        (
            &mut p.x,
            b.right() - (SAFE.right() - WIDTH / 2.) / f.zoom,
            b.x - (SAFE.x - WIDTH / 2.) / f.zoom,
        ),
        (
            &mut p.y,
            b.bottom() - (SAFE.bottom() - HEIGHT / 2.) / f.zoom,
            b.y - (SAFE.y - HEIGHT / 2.) / f.zoom,
        ),
    ] {
        if min <= max {
            *value = value.clamp(min, max);
        }
    }
    f.centre = vec2(p.x, p.y / SQUASH);
    f
}
#[derive(Default)]
pub struct SpotlightCamera {
    current: Option<Framing>,
    from: Option<Framing>,
    key: Option<(u32, f64)>,
    born: f64,
    return_age: f32,
    held_bounds: Option<Rect>,
    last_time: Option<f64>,
}
impl SpotlightCamera {
    pub fn frame(
        &mut self,
        normal: &WorldCamera,
        manifest: &Manifest,
        s: &Snapshot,
        reduced: bool,
        wall_dt: f32,
        charge: f32,
    ) -> WorldCamera {
        let live_dt = self
            .last_time
            .map_or(0., |old| (s.time - old).max(0.) as f32);
        self.last_time = Some(s.time);
        let return_dt = if live_dt > 0. {
            live_dt
        } else {
            wall_dt.max(0.)
        };
        let normal_frame = Framing::from_camera(normal);
        let frame = if let Some(view) = &s.spotlight {
            let key = (view.caster, view.started);
            if self.key != Some(key) {
                self.from = Some(self.current.unwrap_or(normal_frame));
                self.born = s.time;
                self.held_bounds = None;
            }
            self.key = Some(key);
            self.return_age = 0.;
            let core=core_bounds(manifest,s,view).map(|b|self.held_bounds.map_or(b,|old|union(old,b)));
            self.held_bounds=core;
            let b=core.map(|core|include_nearby(core,manifest,s,view));
            let target = b.map(fit).unwrap_or(normal_frame);
            let t = if reduced {
                1.
            } else {
                ((s.time - self.born) as f32 / charge.max(0.01)).clamp(0., 1.)
            };
            let blend = self
                .from
                .unwrap_or(normal_frame)
                .mix(target, t * t * (3. - 2. * t));
            b.map_or(blend, |b| constrain(blend, b))
        } else if let Some(current) = self.current {
            if self.key.take().is_some() {
                self.from = Some(current);
                self.return_age = 0.;
            }
            self.return_age += return_dt;
            let t = if reduced {
                1.
            } else {
                (self.return_age / crate::render::spotlight::CAMERA_RETURN).clamp(0., 1.)
            };
            let f = self
                .from
                .unwrap_or(current)
                .mix(normal_frame, t * t * (3. - 2. * t));
            if t >= 1. {
                self.current = None;
                self.from = None;
                return normal.clone();
            }
            f
        } else {
            return normal.clone();
        };
        self.current = Some(frame);
        let mut camera = normal.clone();
        camera.centre = frame.centre;
        camera.zoom = frame.zoom;
        camera.offset = Vec2::ZERO;
        camera
    }
}
#[cfg(target_arch = "wasm32")]
std::thread_local! { static PROBE: std::cell::Cell<[f32; 8]> = const { std::cell::Cell::new([0.; 8]) }; }
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_spotlight_camera_probe(index: u32) -> f32 {
    PROBE.with(|p| p.get().get(index as usize).copied().unwrap_or(f32::NAN))
}
#[cfg(target_arch = "wasm32")]
pub fn record(camera: &WorldCamera, manifest: &Manifest, s: &Snapshot) {
    let view = s.spotlight.as_ref();
    let b = view.and_then(|v| bounds(manifest, s, v));
    PROBE.with(|p| {
        p.set([
            view.map_or(0., |v| (v.skill.index() + 1) as f32),
            camera.zoom,
            b.is_none_or(|b| contained(b, Framing::from_camera(camera))) as u8 as f32,
            view.map_or(0., |v| {
                s.actors
                    .iter()
                    .filter(|a| {
                        crate::render::spotlight::highlighted(a, v) && actors::is_boss(a.archetype)
                    })
                    .count() as f32
            }),
            camera.centre.x,
            camera.centre.y,
            view.map_or(0., |v| v.participants.len() as f32),
            b.is_none_or(|b| b.w * ZOOM <= SAFE.w && b.h * ZOOM <= SAFE.h) as u8 as f32,
        ])
    });
}
#[cfg(test)]
mod tests {
    #[test]
    fn nearby_combo_fits_but_far_co_caster_cannot_pull_primary_frame_away() {
        let m=Manifest{pages:vec![],actors:Default::default(),arenas:vec![]};
        let mut s=crate::testing::sim().snapshot().clone();
        s.actors[0].pos=wf_combat::Vec2::new(450.,600.);s.actors[3].pos=wf_combat::Vec2::new(650.,600.);
        let mut enemy=s.actors[0].clone();enemy.id=999;enemy.team=wf_combat::Team::Enemy;enemy.pos=wf_combat::Vec2::new(550.,600.);s.actors.push(enemy);
        let mut v=SpotlightView{caster:s.actors[0].id,skill:wf_combat::Skill::BubblePop,phase:wf_combat::SpotlightPhase::Performing,
            started:0.,participants:vec![999],co_casters:vec![s.actors[3].id],hazards:vec![],projectiles:vec![]};
        let core=core_bounds(&m,&s,&v).unwrap();let near=bounds(&m,&s,&v).unwrap();
        assert_eq!(union(near,actor_box(&m,&s.actors[3])),near);assert!(contained(near,fit(near)));
        s.actors[3].pos.x=4000.;assert_eq!(bounds(&m,&s,&v),Some(core));
        s.projectiles.push(wf_combat::ProjectileView{id:800,kind:wf_combat::ProjectileKind::Orb,pos:wf_combat::Vec2::new(730.,580.),
            height:25.,team:wf_combat::Team::Hero,dir:wf_combat::Vec2::new(-1.,0.)});
        v.projectiles=vec![800];let with_bolt=bounds(&m,&s,&v).unwrap();
        assert!(with_bolt.right()>core.right());assert!(with_bolt.right()<1000.);
        assert!(contained(with_bolt,fit(with_bolt)));assert_eq!(union(with_bolt,core),with_bolt);
        let mut unlisted=s.projectiles[0].clone();unlisted.id=801;unlisted.pos.x=10000.;s.projectiles.push(unlisted);
        assert_eq!(bounds(&m,&s,&v),Some(with_bolt),"unlisted basics cannot affect framing");
        s.projectiles[0].pos.x=4000.;assert_eq!(bounds(&m,&s,&v),Some(core));
    }

    use super::*;
    #[test]
    fn full_boss_clip_height_counts_and_defensive_ally_does_not() {
        use crate::assets::{ActorArt, Clip, Frame};
        let mut m = Manifest {
            arenas: vec![],
            pages: vec![],
            actors: Default::default(),
        };
        m.actors.insert(
            "Boss".into(),
            ActorArt {
                facing: "right".into(),
                clips: std::collections::BTreeMap::from([(
                    "idle".into(),
                    Clip {
                        frames: vec![Frame {
                            page: 0,
                            x: 0.,
                            y: 0.,
                            w: 200.,
                            h: 300.,
                            offset_x: 0.,
                            offset_y: 0.,
                            hold_ms: 100.,
                        }],
                        looping: true,
                        foot_origin: [100., 300.],
                        impact_ms: None,
                        release_ms: None,
                    },
                )]),
            },
        );
        let mut s = crate::testing::sim()
            .snapshot()
            .clone();
        s.actors[0].pos = wf_combat::Vec2::new(850., 100.);
        let mut boss = s.actors[0].clone();
        boss.id = 999;
        boss.team = wf_combat::Team::Enemy;
        boss.archetype = wf_combat::Archetype::Boss;
        boss.scale = 2.2;
        s.actors.push(boss);
        let mut v = SpotlightView {
            caster: s.actors[0].id,
            skill: wf_combat::Skill::GroundPound,
            phase: wf_combat::SpotlightPhase::Performing,
            started: 0.,
            participants: vec![s.actors[0].id, 999],
            hazards: vec![], co_casters: vec![], projectiles: vec![],
        };
        let b = bounds(&m, &s, &v).unwrap();
        assert!(b.h >= 660.);
        assert!(contained(b, fit(b)));
        assert!(fit(b).zoom < MAX_ZOOM);
        s.actors[1].pos = wf_combat::Vec2::new(-10000., -10000.);
        v.participants.push(s.actors[1].id);
        assert_eq!(bounds(&m, &s, &v).unwrap(), b);
    }
    #[test]
    fn fit_keeps_full_group_and_skill_bounds_inside_safe_view() {
        for b in [
            Rect::new(100., 200., 220., 330.),
            Rect::new(-200., -350., 500., 700.),
            Rect::new(850., 1450., 250., 510.),
        ] {
            let f = fit(b);
            assert!(contained(b, f));
            assert!((ZOOM..=MAX_ZOOM).contains(&f.zoom));
            assert!(contained(
                b,
                constrain(
                    Framing {
                        centre: Vec2::ZERO,
                        zoom: ZOOM
                    },
                    b
                )
            ));
        }
    }
    #[test]
    fn tiny_groups_cap_zoom_and_oversized_groups_keep_normal_zoom() {
        assert_eq!(fit(Rect::new(0., 0., 5., 5.)).zoom, MAX_ZOOM);
        assert_eq!(fit(Rect::new(0., 0., 3000., 3000.)).zoom, ZOOM);
    }
    #[test]
    fn edge_boss_full_art_and_hazard_are_framed_beyond_arena_clamp() {
        let manifest = Manifest {
            arenas: vec![],
            pages: vec![],
            actors: Default::default(),
        };
        let mut s = crate::testing::sim()
            .snapshot()
            .clone();
        s.actors[0].pos = wf_combat::Vec2::new(845., 100.);
        let mut boss = s.actors[0].clone();
        boss.id = 999;
        boss.archetype = wf_combat::Archetype::Boss;
        boss.team = wf_combat::Team::Enemy;
        boss.scale = 2.2;
        boss.pos = wf_combat::Vec2::new(890., 30.);
        s.actors.push(boss);
        let view = SpotlightView {
            caster: s.actors[0].id,
            skill: wf_combat::Skill::GroundPound,
            phase: wf_combat::SpotlightPhase::Performing,
            started: 0.,
            participants: vec![s.actors[0].id, 999],
            hazards: vec![], co_casters: vec![], projectiles: vec![],
        };
        let b = bounds(&manifest, &s, &view).unwrap();
        let f = fit(b);
        assert!(contained(b, f));
        assert!(f.centre.x > s.arena_max.x - WIDTH / (2. * f.zoom));
        assert!(f.centre.y < s.arena_min.y);
    }
    #[test]
    fn cancellation_returns_and_reduced_motion_cuts_without_changing_follow_camera() {
        let m = Manifest {
            arenas: vec![],
            pages: vec![],
            actors: Default::default(),
        };
        let mut s = crate::testing::sim()
            .snapshot()
            .clone();
        let normal = WorldCamera::new(&s);
        let mut c = SpotlightCamera::default();
        s.spotlight = Some(SpotlightView {
            caster: s.actors[0].id,
            skill: wf_combat::Skill::ArcanePulse,
            phase: wf_combat::SpotlightPhase::Performing,
            started: 0.,
            participants: vec![s.actors[0].id],
            hazards: vec![], co_casters: vec![], projectiles: vec![],
        });
        let close = c.frame(&normal, &m, &s, true, 0., 1.2);
        assert_eq!(close.zoom, MAX_ZOOM);
        assert_eq!(normal.zoom, ZOOM);
        s.spotlight = None;
        let back = c.frame(&normal, &m, &s, false, 0.51, 1.2);
        assert_eq!(back.zoom, ZOOM);
        assert_eq!(back.centre, normal.centre);
    }
}
