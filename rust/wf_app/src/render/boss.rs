//! Frozen Troll pass7 and owner-approved Djinn v8. Simulation owns every hazard.
use crate::{assets::{Assets,DrawStats},camera::{WorldCamera,SQUASH}};
use macroquad::prelude::*;
use std::collections::BTreeMap;
use wf_combat::api::{ActorView,Event,HazardKind,HazardPhase,HazardView,Shape,Snapshot};

pub const ART:[&str;2]=["charge-shell","charge-lines"];
pub const BEAM_SECONDS:f64=super::djinn::RELEASE;
pub type WarningTimings=BTreeMap<u32,(f32,f32)>;
#[derive(Clone)]
struct Charge {hazard:HazardView,born:f64}
#[derive(Clone)]
struct Warning {hazard:HazardView,elapsed:f32,progress:f32,twin:bool}
#[derive(Clone)]
struct Beam {hazard:HazardView,actor:ActorView,born:f64,twin:bool}
#[derive(Default)]
pub struct BossFx {charges:Vec<Charge>,warnings:Vec<Warning>,beams:Vec<Beam>,pub timings:WarningTimings}

/// Mirroring before rotation keeps the painted top upright for left-facing travel.
pub fn charge_orientation(direction:Vec2)->(bool,f32) {
    let mirror=direction.x<0.;
    (mirror,direction.y.atan2(direction.x)-if mirror {std::f32::consts::PI}else{0.})
}
fn projected_direction(h:&HazardView)->Vec2 {vec2(h.dir.x,h.dir.y*SQUASH).normalize_or_zero()}
fn beam_active(born:f64,time:f64)->bool {time>=born && time<born+BEAM_SECONDS}
impl BossFx {
    pub fn take_actors(&mut self,from:&mut Self,_source_time:f64,target:&Snapshot) {
        let owns=|owner|target.actors.iter().any(|a|a.id==owner);
        super::spotlight::transfer(&mut from.charges,&mut self.charges,|x|owns(x.hazard.owner),|_|{});
        super::spotlight::transfer(&mut from.warnings,&mut self.warnings,|x|owns(x.hazard.owner),|_|{});
        super::spotlight::transfer(&mut from.beams,&mut self.beams,|x|owns(x.hazard.owner),|_|{});
    }
    pub fn ingest(&mut self,events:&[Event],s:&Snapshot,previous:&Snapshot,context:&Snapshot,old_context:&Snapshot) {
        if events.iter().any(|e|matches!(e,Event::SceneReset|Event::WaveReset|Event::StageCleared)) {
            self.charges.clear();self.warnings.clear();self.beams.clear();self.timings.clear();return;
        }
        let cancelled:Vec<_>=events.iter().filter_map(|e|if let Event::HazardCancelled{id,..}=e {Some(*id)}else{None}).collect();
        let interrupted:Vec<_>=events.iter().filter_map(|e| match e {
            Event::BossStaggered{id,interrupted:true}|Event::Died{id}=>Some(*id),_=>None}).collect();
        let alive=|id|s.actors.iter().any(|a|a.id==id && a.hp>0. && !matches!(a.state,wf_combat::ActorState::Dead|wf_combat::ActorState::Downed)) && !interrupted.contains(&id);
        let visible=|h:&&HazardView|alive(h.owner) && !cancelled.contains(&h.id);
        let live:Vec<_>=context.hazards.iter().filter(visible).collect();
        self.charges.retain(|x|live.iter().any(|h|h.id==x.hazard.id && h.phase==HazardPhase::Active));
        self.warnings.retain(|x|live.iter().any(|h|h.id==x.hazard.id && matches!(h.phase,HazardPhase::Tracking|HazardPhase::Locked)));
        self.beams.retain(|x|beam_active(x.born,s.combat_time) && alive(x.hazard.owner) && !cancelled.contains(&x.hazard.id));
        for h in live {
            if h.kind==HazardKind::BossCharge && h.phase==HazardPhase::Active {
                let moved=context.actors.iter().find(|a|a.id==h.owner).zip(old_context.actors.iter().find(|a|a.id==h.owner))
                    .is_some_and(|(a,b)|vec2(a.pos.x-b.pos.x,a.pos.y-b.pos.y).length_squared()>0.01);
                if moved {
                    if let Some(x)=self.charges.iter_mut().find(|x|x.hazard.id==h.id) {x.hazard=h.clone();}
                    else {self.charges.push(Charge{hazard:h.clone(),born:context.combat_time});}
                } else if s.combat_time>previous.combat_time {
                    self.charges.retain(|x|x.hazard.id!=h.id);
                }
            }
            if h.kind!=HazardKind::BossSnipe {continue}
            // Twin lanes can resolve on different ticks because their wall distances differ.
            // Preserve cast membership from the warning through each independent release.
            let twin=[context,old_context].iter().any(|s|s.hazards.iter().filter(|other|other.owner==h.owner && other.kind==HazardKind::BossSnipe).count()>1)
                || self.warnings.iter().any(|w|w.hazard.owner==h.owner && w.twin)
                || self.beams.iter().any(|b|b.hazard.owner==h.owner && b.twin);
            if matches!(h.phase,HazardPhase::Tracking|HazardPhase::Locked) {
                if let Some(&(elapsed,full))=self.timings.get(&h.id) {
                    let progress=if full>0. {(elapsed/full).clamp(0.,1.)} else {0.};
                    if let Some(x)=self.warnings.iter_mut().find(|x|x.hazard.id==h.id) {
                        x.hazard=h.clone();x.elapsed=elapsed;x.progress=x.progress.max(progress);x.twin|=twin;
                    } else {self.warnings.push(Warning{hazard:h.clone(),elapsed,progress,twin});}
                }
            } else if h.phase==HazardPhase::Active && !old_context.hazards.iter().any(|old|old.id==h.id && old.phase==HazardPhase::Active)
                && !self.beams.iter().any(|x|x.hazard.id==h.id) {
                if let Some(actor)=context.actors.iter().find(|a|a.id==h.owner) {
                    self.beams.push(Beam{hazard:h.clone(),actor:actor.clone(),born:s.combat_time,twin});
                }
            }
        }
    }
    pub fn draw(&self,assets:&Assets,camera:&WorldCamera,s:&Snapshot,_reduced:bool,stats:&mut DrawStats) {
        for x in &self.charges {
            let Some(a)=s.actors.iter().find(|a|a.id==x.hazard.owner) else {continue};
            let scale=super::actors::body_height(assets,a,camera.zoom)/70.4;
            let anchor=camera.project(a.pos)-vec2(0.,38.*scale);
            let (mirror,rotation)=charge_orientation(projected_direction(&x.hazard));
            let age=(s.combat_time-x.born).max(0.);
            // Owner: streaks under the shell; the shell is the top layer.
            assets.vfx_frame_ex("charge-lines",((age*24.).floor() as usize+2)%6,anchor,vec2(128.,96.)*scale,rotation,WHITE,mirror,stats);
            assets.vfx_frame_ex("charge-shell",(age*18.).floor() as usize%6,anchor,vec2(128.,96.)*scale,rotation,WHITE,mirror,stats);
            probe_frame([1.,a.id as f32,x.hazard.id as f32,age as f32,0.,0.,0.,0.,anchor.x,anchor.y,0.,0.,rotation,mirror as u8 as f32,0.,0.,0.,0.,0.,0.],s,assets);
        }
        for (index,x) in self.warnings.iter().enumerate() {
            let Some(a)=s.actors.iter().find(|a|a.id==x.hazard.owner) else {continue};
            let (lane,globe)=geometry(assets,camera,a,&x.hazard,false);
            // Twin hazards share one charge globe, while their telegraphs remain independent.
            if !self.warnings[..index].iter().any(|w|w.hazard.owner==x.hazard.owner) {
                super::djinn::charge(globe,if self.beams.iter().any(|b|b.hazard.owner==x.hazard.owner){1.}else{x.progress},lane.scale,super::vfx3d::seed(x.hazard.owner,0.),stats);
            }
            probe_frame([2.,a.id as f32,x.hazard.id as f32,x.elapsed,x.progress,0.,0.,lane.width,globe.x,globe.y,lane.end.x,lane.end.y,0.,a.enraged as u8 as f32,0.,0.,0.,0.,0.,0.],s,assets);
        }
        for (index,x) in self.beams.iter().enumerate() {
            let Some(a)=s.actors.iter().find(|a|a.id==x.actor.id && a.hp>0.) else {continue};
            let age=s.combat_time-x.born;
            if !beam_active(x.born,s.combat_time) {continue}
            let twin=x.twin;
            let (lane,globe)=geometry(assets,camera,&x.actor,&x.hazard,twin);
            let globe=if self.warnings.iter().any(|w|w.hazard.owner==x.hazard.owner) || self.beams[..index].iter().any(|b|b.hazard.owner==x.hazard.owner) {None}else{Some(globe)};
            super::djinn::release(lane,globe,age,super::vfx3d::seed(x.hazard.id,x.born),stats);
            probe_frame([3.,a.id as f32,x.hazard.id as f32,age as f32,1.,0.,0.,lane.width,lane.root.x,lane.root.y,lane.end.x,lane.end.y,0.,a.enraged as u8 as f32,twin as u8 as f32,0.,0.,0.,0.,0.],s,assets);
        }
    }
}
fn geometry(assets:&Assets,camera:&WorldCamera,a:&ActorView,h:&HazardView,twin:bool)->(super::djinn::Lane,Vec2) {
    beam_geometry(camera,h,camera.actor_foot(a)-vec2(0.,super::actors::body_height(assets,a,camera.zoom)*0.5),a.facing,twin)
}
fn lane_corners(camera:&WorldCamera,h:&HazardView)->[Vec2;4] {
    let Shape::Line{length,width}=h.shape else {unreachable!()};
    let side=wf_combat::Vec2::new(-h.dir.y,h.dir.x)*(width*0.5);
    [h.origin-side,h.origin+h.dir*length-side,h.origin+h.dir*length+side,h.origin+side].map(|p|camera.project(p))
}
fn beam_geometry(camera:&WorldCamera,h:&HazardView,torso:Vec2,facing:wf_combat::Facing,twin:bool)->(super::djinn::Lane,Vec2) {
    let Shape::Line{length,width}=h.shape else {unreachable!()};
    let scale=super::vfx3d::zscale(camera);
    let (globe,root)=super::djinn::sockets(torso,facing==wf_combat::Facing::Left,scale);
    // Identical elevated endpoints retain the sim's direction, length and perpendicular width.
    let end=root+(camera.project(h.origin+h.dir*length)-camera.project(h.origin));
    (super::djinn::Lane{root,end,width:projected_width(h.dir,width,camera.zoom),scale,twin},globe)
}

/// B is a held proof overlay only. The red footprint remains visible over release art.
pub fn debug_lanes(camera:&WorldCamera,s:&Snapshot,stats:&mut DrawStats) {
    for h in s.hazards.iter().filter(|h|h.kind==HazardKind::BossSnipe) {
        let Shape::Line{length,..}=h.shape else {continue};
        let points=lane_corners(camera,h);
        for i in 0..4 {let a=points[i];let b=points[(i+1)%4];draw_line(a.x,a.y,b.x,b.y,1.5,Color::new(1.,0.12,0.18,1.));}
        let a=camera.project(h.origin);let b=camera.project(h.origin+h.dir*length);
        #[cfg(target_arch="wasm32")] LANES.with(|p| {let side=(points[3]-points[0])*0.5;p.borrow_mut().push([h.id as f32,a.x,a.y,b.x,b.y,side.x,side.y,h.progress,h.width_scale,0.,0.,0.]);});
        draw_line(a.x,a.y,b.x,b.y,0.7,Color::new(1.,0.12,0.18,0.8));stats.calls+=5;
    }
}

fn projected_width(direction:wf_combat::Vec2,width:f32,zoom:f32)->f32 {
    let length=vec2(direction.x,direction.y*SQUASH).length();
    if length>0. {width*zoom*SQUASH/length} else {0.}
}
fn probe_frame(mut values:[f32;20],s:&Snapshot,assets:&Assets) {
    values[16]=s.spotlight.as_ref().is_some_and(|v|s.actors.iter().find(|a|a.id==values[1] as u32).is_some_and(|a|super::spotlight::highlighted(a,v))) as u8 as f32;
    values[17]=s.time as f32;values[18]=s.combat_time as f32;
    values[19]=ART.iter().all(|id|assets.vfx.contains_key(*id)) as u8 as f32;probe(values);
    #[cfg(target_arch="wasm32")] SAMPLES.with(|p|p.borrow_mut().push(values));
}
#[cfg(target_arch="wasm32")]
std::thread_local! {static PROBE:std::cell::Cell<[f32;20]>=const{std::cell::Cell::new([0.;20])};static SAMPLES:std::cell::RefCell<Vec<[f32;20]>>=const{std::cell::RefCell::new(Vec::new())};static LANES:std::cell::RefCell<Vec<[f32;12]>>=const{std::cell::RefCell::new(Vec::new())};}
fn probe(values:[f32;20]) {#[cfg(target_arch="wasm32")] PROBE.with(|p|p.set(values));#[cfg(not(target_arch="wasm32"))] let _=values;}
#[cfg(target_arch="wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_boss_art_probe(index:u32)->f32 {PROBE.with(|p|p.get().get(index as usize).copied().unwrap_or(f32::NAN))}
#[cfg(target_arch="wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_boss_art_count()->u32 {SAMPLES.with(|p|p.borrow().len() as u32)}
#[cfg(target_arch="wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_boss_art_sample(slot:u32,index:u32)->f32 {SAMPLES.with(|p|p.borrow().get(slot as usize).and_then(|v|v.get(index as usize)).copied().unwrap_or(f32::NAN))}
#[cfg(target_arch="wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_boss_lane_count()->u32 {LANES.with(|p|p.borrow().len() as u32)}
#[cfg(target_arch="wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_boss_lane_sample(slot:u32,index:u32)->f32 {LANES.with(|p|p.borrow().get(slot as usize).and_then(|v|v.get(index as usize)).copied().unwrap_or(f32::NAN))}
pub fn reset_probe() {probe([0.;20]);#[cfg(target_arch="wasm32")] {SAMPLES.with(|p|p.borrow_mut().clear());LANES.with(|p|p.borrow_mut().clear());}}

#[cfg(test)]
mod tests {
    use super::*;
    fn scene()->Snapshot {
        let mut s=crate::testing::sim().snapshot().clone();
        let mut boss=s.actors[0].clone();boss.id=999;boss.team=wf_combat::Team::Enemy;boss.archetype=wf_combat::Archetype::BossMarksman;
        s.actors=vec![boss];s.hazards.clear();s.projectiles.clear();s.time=10.;s.combat_time=2.;s
    }
    fn hazard(kind:HazardKind,phase:HazardPhase)->HazardView {HazardView{id:77,kind,team:wf_combat::Team::Enemy,hostile:true,
        shape:Shape::Line{length:500.,width:120.},origin:wf_combat::Vec2::new(0.,0.),dir:wf_combat::Vec2::new(1.,0.),
        fill:wf_combat::FillMode::Countdown,phase,progress:0.,width_scale:1.,owner:999,tier:1}}
    #[test]
    fn charge_mirror_and_rotation_keep_leading_bow_on_travel_side_and_top_upright() {
        for direction in [vec2(1.,0.),vec2(-1.,0.),vec2(1.,0.7).normalize(),vec2(-1.,0.7).normalize(),vec2(-1.,-0.7).normalize()] {
            let (mirror,rotation)=charge_orientation(direction);
            let (sin,cos)=rotation.sin_cos();let native=if mirror {-1.}else{1.};
            let leading=vec2(native*cos,native*sin);let up=vec2(sin,-cos);
            assert!(leading.dot(direction)>0.9999);assert!(up.y<0.,"left-facing art never turns upside-down");
        }
    }
    #[test]
    fn warning_maps_entire_sim_track_and_lock_monotonically() {
        let mut fx=BossFx::default();let mut s=scene();s.hazards.push(hazard(HazardKind::BossSnipe,HazardPhase::Tracking));
        for (elapsed,full,expected) in [(0.,3.,0.),(1.,3.,1./3.),(1.01,4.,1./3.),(2.,4.,0.5),(4.,4.,1.)] {
            fx.timings.insert(77,(elapsed,full));fx.ingest(&[],&s,&s,&s,&s);
            assert!((fx.warnings[0].progress-expected).abs()<1e-6);
        }
    }
    #[test]
    fn active_transition_maps_travel_full_fade_and_450ms_release_on_combat_time() {
        use super::super::djinn::{phase,Phase};
        let mut fx=BossFx::default();let mut old=scene();old.hazards.push(hazard(HazardKind::BossSnipe,HazardPhase::Locked));
        fx.timings.insert(77,(3.,3.));fx.ingest(&[],&old,&old,&old,&old);assert_eq!(fx.warnings.len(),1);
        let mut s=old.clone();s.combat_time+=1./30.;s.hazards[0].phase=HazardPhase::Active;
        fx.ingest(&[],&s,&old,&s,&old);assert!(fx.warnings.is_empty());assert_eq!(fx.beams.len(),1);
        let born=fx.beams[0].born;assert_eq!(born,s.combat_time);
        for (age,expected) in [(0.,Some(Phase::Travel)),(0.119,Some(Phase::Travel)),(0.120,Some(Phase::Full)),(0.389,Some(Phase::Full)),(0.390,Some(Phase::Fade)),(0.449,Some(Phase::Fade)),(0.450,None)] {
            assert_eq!(phase(age),expected);
        }
        s.hazards.clear();s.time+=4.;fx.ingest(&[],&s,&s,&s,&s);assert_eq!(fx.beams[0].born,born,"combat freeze preserves release");
        s.combat_time=born+0.45;fx.ingest(&[],&s,&s,&s,&s);assert!(fx.beams.is_empty());
    }
    #[test]
    fn simultaneous_twin_release_keeps_both_authoritative_18_degree_directions() {
        let mut old=scene();let mut left=hazard(HazardKind::BossSnipe,HazardPhase::Locked);
        let angle=18_f32.to_radians();left.dir=wf_combat::Vec2::new(angle.cos(),-angle.sin());
        let mut right=left.clone();right.id+=1;right.dir.y=-right.dir.y;old.hazards=vec![left,right];
        let mut fx=BossFx::default();for h in &old.hazards {fx.timings.insert(h.id,(2.,3.));}
        fx.ingest(&[],&old,&old,&old,&old);assert_eq!(fx.warnings.len(),2);
        let mut next=old.clone();for h in &mut next.hazards {h.phase=HazardPhase::Active;}
        fx.ingest(&[],&next,&old,&next,&old);assert_eq!(fx.beams.len(),2);assert!(fx.warnings.is_empty());
        for (beam,sign) in fx.beams.iter().zip([-1.,1.]) {
            assert!((beam.hazard.dir.y.atan2(beam.hazard.dir.x)-sign*angle).abs()<1e-6);
            assert_eq!(beam.born,next.combat_time);
        }
        fx.ingest(&[Event::WaveReset],&next,&next,&next,&next);assert!(fx.beams.is_empty());
    }
    #[test]
    fn one_enraged_lane_releasing_does_not_clear_the_other_lanes_warning() {
        let mut fx=BossFx::default();let mut old=scene();let first=hazard(HazardKind::BossSnipe,HazardPhase::Locked);
        let mut second=first.clone();second.id=78;second.dir=wf_combat::Vec2::new(0.8,0.6);
        old.hazards=vec![first,second];fx.timings.insert(77,(3.,3.));fx.timings.insert(78,(3.,4.4));
        fx.ingest(&[],&old,&old,&old,&old);assert_eq!(fx.warnings.len(),2);
        let mut s=old.clone();s.hazards[0].phase=HazardPhase::Active;fx.ingest(&[],&s,&old,&s,&old);
        assert_eq!(fx.beams.len(),1);assert_eq!(fx.beams[0].hazard.id,77);assert!(fx.beams[0].twin);
        assert_eq!(fx.warnings.len(),1);assert_eq!(fx.warnings[0].hazard.id,78);
        assert!((fx.warnings[0].progress-3./4.4).abs()<1e-6);
        let previous=s.clone();s.combat_time+=0.6;s.hazards.remove(0);s.hazards[0].phase=HazardPhase::Active;
        fx.ingest(&[],&s,&previous,&s,&previous);assert_eq!(fx.beams.len(),1);
        assert_eq!(fx.beams[0].hazard.id,78);assert!(fx.beams[0].twin,"late twin retains narrow root after first release expires");
    }
    #[test]
    fn cancellation_never_releases_a_beam_and_movement_layers_exist_only_during_travel() {
        let mut fx=BossFx::default();let mut old=scene();old.hazards.push(hazard(HazardKind::BossCharge,HazardPhase::Locked));
        let mut s=old.clone();s.time+=0.033;s.combat_time+=0.033;s.hazards[0].phase=HazardPhase::Active;s.actors[0].pos.x+=20.;
        fx.ingest(&[],&s,&old,&s,&old);assert_eq!(fx.charges.len(),1);
        let born=fx.charges[0].born;let mut frozen=s.clone();frozen.time+=1.;fx.ingest(&[],&frozen,&s,&frozen,&s);
        assert_eq!(fx.charges[0].born,born,"frozen combat freezes the looping cel");
        s=frozen.clone();s.time+=0.033;s.combat_time+=0.033;fx.ingest(&[],&s,&frozen,&s,&frozen);assert!(fx.charges.is_empty());
        s.hazards[0]=hazard(HazardKind::BossSnipe,HazardPhase::Locked);fx.timings.insert(77,(2.,3.));fx.ingest(&[],&s,&s,&s,&s);
        let old=s.clone();s.hazards.clear();fx.ingest(&[Event::HazardCancelled{id:77,kind:HazardKind::BossSnipe}],&s,&old,&s,&old);
        assert!(fx.warnings.is_empty()&&fx.beams.is_empty());assert!(fx.beams.is_empty());
    }
    #[test]
    fn projected_beam_width_matches_warning_lane_and_enraged_ratio_at_every_angle() {
        for degrees in [0_f32,30.,60.,90.,130.,180.,240.] {
            let r=degrees.to_radians();let d=wf_combat::Vec2::new(r.cos(),r.sin());
            let axis=vec2(d.x,d.y*SQUASH).normalize();let side=vec2(-d.y,d.x*SQUASH)*120.*0.5;
            let width=axis.perp_dot(side).abs();assert!((projected_width(d,120.,0.5)-width).abs()<0.0001);
            assert!((projected_width(d,180.,0.5)/width-1.5).abs()<0.0001);
        }
    }
    #[test]
    fn torso_offsets_and_twin_directions_preserve_sim_width_and_length_at_every_angle() {
        let s=scene();let mut camera=WorldCamera::new(&s);let mut h=hazard(HazardKind::BossSnipe,HazardPhase::Active);
        for zoom in [0.5,0.8] {camera.zoom=zoom;for centre in [0_f32,45.,90.,180.,270.] {for offset in [-18_f32,18.] {for width in [120.,180.] {for facing in [wf_combat::Facing::Left,wf_combat::Facing::Right] {
            let r=(centre+offset).to_radians();h.dir=wf_combat::Vec2::new(r.cos(),r.sin());h.shape=Shape::Line{length:500.,width};
            let torso=vec2(31.,291.);let (g,globe)=beam_geometry(&camera,&h,torso,facing,true);
            let delta=camera.project(h.origin+h.dir*500.)-camera.project(h.origin);
            assert!((g.end-g.root-delta).length()<0.0002);
            assert!((g.width-projected_width(h.dir,width,zoom)).abs()<0.0001);
            assert_eq!(g.twin,true);
            let sign=if facing==wf_combat::Facing::Left {-1.}else{1.};
            assert!((globe-(torso+vec2(7.*sign,26.)*(zoom/0.5))).length()<0.0001);
            assert!((g.root-(torso+vec2(14.*sign,29.)*(zoom/0.5))).length()<0.0001);
        }}}}}
        assert!((projected_width(wf_combat::Vec2::new(1.,0.),120.,0.5)-45.).abs()<1e-5);
        let r=18_f32.to_radians();assert!((projected_width(wf_combat::Vec2::new(r.cos(),r.sin()),120.,0.5)-45.97).abs()<0.01);
    }
    #[test]
    fn interruption_death_missing_owner_and_resets_clear_charge_and_active_release() {
        for active in [false,true] {for reason in 0..8 {
            let mut fx=BossFx::default();let mut old=scene();old.hazards.push(hazard(HazardKind::BossSnipe,HazardPhase::Locked));
            fx.timings.insert(77,(2.,3.));fx.ingest(&[],&old,&old,&old,&old);
            let mut s=old.clone();if active {s.hazards[0].phase=HazardPhase::Active;fx.ingest(&[],&s,&old,&s,&old);assert_eq!(fx.beams.len(),1);}
            let events=match reason {
                0=>vec![Event::HazardCancelled{id:77,kind:HazardKind::BossSnipe}],
                1=>vec![Event::BossStaggered{id:999,interrupted:true}],
                2=>{s.actors[0].hp=0.;vec![]},
                3=>{s.actors.clear();vec![]},
                4=>vec![Event::SceneReset],5=>vec![Event::WaveReset],6=>vec![Event::StageCleared],_=>vec![Event::Died{id:999}],
            };
            fx.ingest(&events,&s,&s,&s,&s);assert!(fx.warnings.is_empty()&&fx.beams.is_empty(),"active={active} reason={reason}");
        }}
    }
    #[test]
    fn spotlight_transfers_only_owning_boss_and_freezes_enemy_beam_on_combat_time() {
        let mut bg=BossFx::default();let mut fg=BossFx::default();let mut old=scene();old.hazards.push(hazard(HazardKind::BossSnipe,HazardPhase::Locked));
        let mut s=old.clone();s.time+=0.033;s.hazards[0].phase=HazardPhase::Active;bg.ingest(&[],&s,&old,&s,&old);
        let mut spot=s.clone();spot.time=50.1;fg.take_actors(&mut bg,s.time+0.1,&spot);
        assert!(bg.beams.is_empty());assert!(beam_active(fg.beams[0].born,spot.combat_time));assert_eq!(fg.beams[0].born,s.combat_time);
        let mut empty=spot.clone();empty.actors.clear();bg.take_actors(&mut fg,spot.time,&empty);assert!(bg.beams.is_empty());
    }
}
