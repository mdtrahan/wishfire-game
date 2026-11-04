//! Soft Fara bubble and unchanged painted enemy defense shell. The sim owns Rally coverage and Warcry shielding.
use crate::{assets::{Assets,DrawStats},camera::WorldCamera};
use macroquad::prelude::*;
use wf_combat::{ActorView,Archetype,Snapshot,Team};
pub fn defended(a:&ActorView)->bool {
    a.hp>0. && ((a.team==Team::Enemy && a.rallied)
        || (a.team==Team::Hero && a.archetype==Archetype::Fara && a.warcry_shield && a.ward>0.))
}
/// One Fara, observed before snapshot partitioning so spotlight transfers never restart fades.
#[derive(Default)]
pub struct WarcryShell {
    id: u32,
    active: bool,
    ward: f32,
    changed: f64,
    from: f32,
    refresh: Option<f64>,
    time: f64,
}
const FADE: f64 = 0.25;
fn fara(a: &ActorView) -> bool { a.team == Team::Hero && a.archetype == Archetype::Fara }
pub fn warcry(a: &ActorView) -> bool { fara(a) && a.warcry_shield }
fn pulse(time: f64) -> f32 { 0.78 + 0.22 * (time as f32 * std::f32::consts::TAU / 1.35).sin() }
impl WarcryShell {
    fn opacity(&self) -> f32 {
        let t = ((self.time - self.changed) / FADE).clamp(0., 1.) as f32;
        let t = t * t * (3. - 2. * t);
        self.from + (if self.active {1.} else {0.} - self.from) * t
    }
    pub fn observe(&mut self, s: &Snapshot) {
        self.time = s.time;
        let Some(a) = s.actors.iter().find(|a| fara(a)) else { *self = Self::default(); return; };
        if self.id != a.id { *self = Self {id:a.id, time:s.time, ..Self::default()}; }
        let active = defended(a);
        if active != self.active {
            self.from = self.opacity();
            self.active = active;
            self.changed = s.time;
            self.refresh = None;
        } else if active && a.ward > self.ward + 0.01 {
            self.refresh = Some(s.time);
        }
        self.ward = a.ward;
    }
    fn gain(&self, a: &ActorView) -> f32 {
        if !fara(a) || a.id != self.id { return 0.; }
        self.opacity()
    }
    fn flare(&self) -> f32 {
        let age = (self.time - self.changed).max(0.) as f32;
        let transition = if age < FADE as f32 { (std::f32::consts::PI * age / FADE as f32).sin() * 0.6 } else {0.};
        let refresh = self.refresh.map_or(0., |t| (1. - ((self.time-t)/FADE) as f32).clamp(0.,1.) * 0.25);
        transition + refresh
    }
}
// Rally keeps its original material, art, tint and clock.
fn shell_layer(a:&ActorView,time:f64,front:bool)->Option<(&'static str,Color)> {
    if a.team != Team::Enemy || !defended(a) || front { return None; }
    let alpha=0.36+0.04*(time as f32*2.4+a.id as f32*0.7).sin();
    Some(("ward-shell",Color::new(0.68,0.83,1.,alpha)))
}
fn shell_size(a: &ActorView, height: f32) -> Vec2 {
    vec2(height * if fara(a) {0.943} else {0.82}, height * 1.18)
}
fn draw_layer(assets:&Assets,camera:&WorldCamera,a:&ActorView,time:f64,front:bool,shell:&WarcryShell,stats:&mut DrawStats) {
    let height=super::actors::body_height(assets,a,camera.zoom);
    let centre=camera.project(a.pos)-vec2(0.,height*0.48);
    let size=shell_size(a,height);
    if let Some((art,tint))=shell_layer(a,time,front) {
        assets.vfx_frame(art,0,centre,size,0.,tint,stats);
        return;
    }
    let gain=shell.gain(a);
    if gain<=0. || stats.fx_quads>=111 {return;}
    let art=if front {"warcry-shell-front"}else{"warcry-shell-back"};
    let depth=if front {0.78}else{1.};
    let density=(pulse(shell.time)+shell.flare()*0.12).min(1.)*gain*depth;
    // Authored sky-blue colour and broad alpha gradient stay readable on sand.
    assets.vfx_frame(art,0,centre,size,0.,Color::new(1.,1.,1.,density),stats);
    if front {motes(assets,centre,size,shell.time,a.id,gain,stats);}
}
// Fixed five soft bitmap motes: no random source, allocation, trails or particle emitter.
fn mote(time:f64,id:u32,i:usize)->(Vec2,f32,f32) {
    let p=(time as f32/2.8+i as f32*0.2+id as f32*0.137).fract();
    let y=0.72-p*1.44;
    let side=if i%2==0 {-1.}else{1.};
    let x=side*0.42*(1.-y*y).sqrt();
    (vec2(x,y*0.46), (std::f32::consts::PI*p).sin().powi(2), 2.0+(i%2) as f32*0.3)
}
fn motes(assets:&Assets,centre:Vec2,size:Vec2,time:f64,id:u32,gain:f32,stats:&mut DrawStats) {
    gl_use_material(&assets.additive);
    for i in 0..5 {
        let (offset,alpha,diameter)=mote(time,id,i);
        let point=centre+offset*size;
        // Keep the core's phone size despite the wider shell; halo stays rim-local.
        let core=diameter*size.y/(26.*1.18/0.82);
        assets.decal("resurrect/channel-glow",point,Vec2::splat(core*1.65),0.,Color::new(0.2,0.65,1.,alpha*gain*0.32),stats);
        assets.decal("resurrect/channel-glow",point,Vec2::splat(core),0.,Color::new(0.68,0.94,1.,alpha*gain),stats);
    }
    gl_use_default_material();
}
pub fn under_actors(assets:&Assets,camera:&WorldCamera,s:&Snapshot,shell:&WarcryShell,stats:&mut DrawStats) {
    for a in &s.actors {draw_layer(assets,camera,a,s.time,false,shell,stats);}
}
/// Called immediately after each sprite in normal combat and spotlight packages.
pub fn over_actor(assets:&Assets,camera:&WorldCamera,a:&ActorView,time:f64,shell:&WarcryShell,stats:&mut DrawStats) {
    draw_layer(assets,camera,a,time,true,shell,stats);
}
#[cfg(test)]mod tests {
    use super::*;
    #[test]fn fara_width_grows_fifteen_percent_without_changing_height_or_rally() {
        let mut a=crate::testing::sim().snapshot().actors[0].clone();
        let size=shell_size(&a,32.1);
        assert!((size.x/(32.1*0.82)-1.15).abs()<0.00001);
        assert_eq!(size.y,32.1*1.18);
        a.team=Team::Enemy;a.rallied=true;
        assert_eq!(shell_size(&a,32.1),vec2(32.1*0.82,32.1*1.18));
    }
    #[test]fn warcry_fades_on_gain_break_death_and_interrupted_transition() {
        let mut s=crate::testing::sim().snapshot().clone();
        let mut shell=WarcryShell::default();shell.observe(&s);
        s.actors[0].warcry_shield=true;s.actors[0].ward=126.;s.time=1.;shell.observe(&s);
        assert_eq!(shell.gain(&s.actors[0]),0.);
        s.time=1.125;shell.observe(&s);assert!((shell.gain(&s.actors[0])-0.5).abs()<0.001);
        s.time=1.25;shell.observe(&s);assert_eq!(shell.gain(&s.actors[0]),1.);
        s.actors[0].ward=0.;shell.observe(&s);assert_eq!(shell.gain(&s.actors[0]),1.);
        s.time=1.375;shell.observe(&s);assert!((shell.gain(&s.actors[0])-0.5).abs()<0.001);
        s.actors[0].ward=100.;shell.observe(&s);assert!((shell.gain(&s.actors[0])-0.5).abs()<0.001);
        s.time=1.625;shell.observe(&s);assert_eq!(shell.gain(&s.actors[0]),1.);
        s.actors[0].hp=0.;shell.observe(&s);
        s.time=1.875;shell.observe(&s);assert_eq!(shell.gain(&s.actors[0]),0.);
    }
    #[test]fn transition_is_fara_only_and_refresh_does_not_restart_opacity() {
        let mut s=crate::testing::sim().snapshot().clone();
        s.actors[0].warcry_shield=true;s.actors[0].ward=50.;
        let mut shell=WarcryShell::default();shell.observe(&s);s.time=1.;shell.observe(&s);
        s.actors[0].ward=100.;shell.observe(&s);
        assert_eq!(shell.gain(&s.actors[0]),1.);assert!(shell.flare()>0.);
        for team in [Team::Enemy,Team::Hero] {let mut a=s.actors[0].clone();a.team=team;a.archetype=Archetype::Hondo;assert_eq!(shell.gain(&a),0.);}
        let mut a=s.actors[0].clone();a.id+=1;assert_eq!(shell.gain(&a),0.);
        let frozen=shell.gain(&s.actors[0]);shell.observe(&s);assert_eq!(shell.gain(&s.actors[0]),frozen);
    }
    #[test]fn enemy_rally_preserves_original_art_tint_pulse_and_back_only() {
        let mut a=crate::testing::sim().snapshot().actors[0].clone();
        a.team=Team::Enemy;a.rallied=true;
        for time in [0.,0.3,1.35,8.] {
            let (id,c)=shell_layer(&a,time,false).unwrap();
            assert_eq!(id,"ward-shell");assert_eq!((c.r,c.g,c.b),(0.68,0.83,1.));
            assert_eq!(c.a,0.36+0.04*(time as f32*2.4+a.id as f32*0.7).sin());
            assert!(shell_layer(&a,time,true).is_none());
        }
    }
    #[test]fn glow_and_motes_are_bounded_periodic_and_rim_local() {
        for i in 0..100 {
            let time=i as f64*1.35/100.;let glow=pulse(time);
            assert!((0.5599..=1.0001).contains(&glow));assert!((glow-pulse(time+1.35)).abs()<0.00001);
            for n in 0..5 {let (p,a,d)=mote(time,1,n);assert!(p.x.abs()<=0.42&&p.y.abs()<=0.34);assert!((0. ..=1.).contains(&a));assert!(d<=2.3);}
        }
        let json=include_str!("../../../../web-runner/assets/rust-combat/manifest.json");

        for id in ["warcry-shell-back","warcry-shell-front"] {let entry=json.split(&format!("\"{id}\": {{")).nth(1).unwrap().split("}").next().unwrap();assert!(entry.contains("\"blend\": \"alpha\""));}
    }
    #[test]fn warcry_gradient_layers_are_registered_for_the_existing_loader() {
        let json=include_str!("../../../../web-runner/assets/rust-combat/manifest.json");
        for id in ["warcry-shell-back","warcry-shell-front"] {
            assert!(json.contains(&format!("\"{id}\": {{")));
            let path=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(format!("../../web-runner/assets/rust-combat/vfx-astra/{id}.png"));
            assert_eq!(&std::fs::read(path).unwrap()[..8],b"\x89PNG\r\n\x1a\n");
        }
    }

    #[test]fn defense_shell_requires_a_living_buffed_enemy() {
        let mut a=crate::testing::sim().snapshot().actors[0].clone();
        a.rallied=true;assert!(!defended(&a));a.team=Team::Enemy;assert!(defended(&a));
        a.rallied=false;assert!(!defended(&a));a.rallied=true;a.hp=0.;assert!(!defended(&a));
    }
    #[test]fn fara_shell_tracks_only_a_living_warcry_shield() {
        let mut a=crate::testing::sim().snapshot().actors[0].clone();
        a.ward=126.;assert!(!defended(&a));
        a.warcry_shield=true;assert!(defended(&a));
        a.ward=0.;assert!(!defended(&a));a.ward=126.;
        a.hp=0.;assert!(!defended(&a));a.hp=a.max_hp;
        a.archetype=Archetype::Hondo;assert!(!defended(&a));
    }
}
#[cfg(target_arch="wasm32")]
std::thread_local! {static PROBE:std::cell::RefCell<Vec<[f32;12]>>=const{std::cell::RefCell::new(Vec::new())};}
#[cfg(target_arch="wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_roster_count()->u32 {PROBE.with(|p|p.borrow().len()as u32)}
#[cfg(target_arch="wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_roster_probe(slot:u32,index:u32)->f32 {PROBE.with(|p|p.borrow().get(slot as usize).and_then(|r|r.get(index as usize)).copied().unwrap_or(f32::NAN))}
#[cfg(target_arch="wasm32")]
pub fn record(assets:&Assets,camera:&WorldCamera,s:&Snapshot) {
    use wf_combat::Archetype::*;
    PROBE.with(|p| {let mut rows=p.borrow_mut();rows.clear();for a in &s.actors {
        if a.hp<=0. {continue;}
        let kind=match a.archetype {HighOrc=>1.,Marid=>2.,Gloamink=>3.,Mirewing=>4.,Bastorto=>5.,Fizzmite=>6.,Fara=>7.,_=>0.};
        if kind==0.&&a.poisoned<=0.&&!a.rallied {continue;}
        let q=camera.actor_foot(a);let height=super::actors::body_height(assets,a,camera.zoom);
        rows.push([a.id as f32,kind,q.x,q.y,height,if a.state==wf_combat::ActorState::Cast{1.}else{0.},a.hp/a.max_hp.max(1.),a.poisoned,if a.rallied{1.}else{0.},
            if assets.manifest.actors.contains_key(&format!("{:?}",a.archetype)){1.}else{0.},s.step as f32,a.state_age]);
    }});
}
