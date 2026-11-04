//! Owner-approved Astra v6 regeneration. Combat owns its duration; presentation owns tick playback.
use crate::{assets::{Assets,DrawStats},camera::WorldCamera};
use macroquad::prelude::*;
use wf_combat::api::{Archetype,Event,Snapshot};

pub const ART:[&str;2]=["regen-v6-aura","regen-v6-tick"];
pub const TICK_SECONDS:f64=0.5;
const TICK_FPS:f64=24.;
const QUAD:Vec2=vec2(240.,224.);
// Approved v6: Chimerilass scale 2.2, camera zoom 0.5, source foot (104,186).
// Export adds 16 transparent columns at left so the new foot pivot (120,186) mirrors centrally.
const REFERENCE_SCALE:f32=1.1;
struct Regen {id:u32,until:f64}
#[derive(Clone,Copy,Debug,PartialEq)]
struct Sample {tick:bool,frame:usize,age:f64}
#[derive(Default)]
pub struct BossRegen {active:Vec<Regen>,ticks:Vec<(u32,f64)>}
impl BossRegen {
    pub fn ingest(&mut self,events:&[Event],s:&Snapshot) {
        self.ticks.retain(|(_,born)|s.time-born<TICK_SECONDS);
        for event in events {
            match *event {
                Event::SceneReset|Event::WaveReset|Event::StageCleared=>*self=Self::default(),
                Event::RegenStarted{id,seconds,..} if seconds>0.=>{
                    self.active.retain(|r|r.id!=id);
                    self.active.push(Regen{id,until:s.combat_time+seconds as f64});
                }
                Event::Healed {target,amount, .. } if amount>0.=>{
                    // The final tick can arrive exactly at the duration boundary.
                    if self.active.iter().any(|r|r.id==target && s.combat_time<=r.until+1e-6) {
                        self.ticks.retain(|(id,_)|*id!=target);self.ticks.push((target,s.time));
                    }
                }
                Event::Died{id}=>{self.active.retain(|r|r.id!=id);self.ticks.retain(|(who,_)|*who!=id);}
                _=>{}
            }
        }
        self.active.retain(|r|s.combat_time<r.until);
    }
    /// Move state with its actor so a finished foreground flare cannot replay on the background clock.
    pub fn take_actors(&mut self,from:&mut Self,source_time:f64,target:&Snapshot) {
        let visible=|id:u32|target.actors.iter().any(|a|a.id==id);
        super::spotlight::transfer(&mut from.active,&mut self.active,|r|visible(r.id),|_|{});
        super::spotlight::transfer(&mut from.ticks,&mut self.ticks,|(id,_)|visible(*id),|(_,born)|*born+=target.time-source_time);
    }
    pub fn busy(&self,time:f64)->bool {self.ticks.iter().any(|(_,born)|time>=*born && time-born<TICK_SECONDS)}
    fn sample(&self,id:u32,s:&Snapshot)->Option<Sample> {
        if let Some((_,born))=self.ticks.iter().find(|(who,born)|*who==id && s.time>=*born && s.time-born<TICK_SECONDS) {
            return Some(Sample{tick:true,frame:((s.time-born)*TICK_FPS+1e-6).floor().min(11.) as usize,age:s.time-born});
        }
        self.active.iter().any(|r|r.id==id && s.combat_time<r.until).then_some(Sample{tick:false,frame:0,age:-1.})
    }
    pub fn impacts(&self,assets:&Assets,camera:&WorldCamera,s:&Snapshot,stats:&mut DrawStats) {
        for a in s.actors.iter().filter(|a|a.archetype==Archetype::BossBomber && a.hp>0.) {
            let Some(sample)=self.sample(a.id,s) else {continue};
            let size=QUAD*(super::actors::visual_scale(a)*camera.zoom/REFERENCE_SCALE);
            let foot=camera.actor_foot(a);
            let authored_left=assets.manifest.actors.get("BossBomber").is_none_or(|art|art.facing=="left");
            let mirror=authored_left!=(a.facing==wf_combat::Facing::Left);
            // One authoritative body cue survives decoration trimming.
            let saved=stats.fx_quads;stats.fx_quads=stats.fx_quads.min(111);
            assets.vfx_frame_ex(ART[sample.tick as usize],sample.frame,foot,size,0.,WHITE,mirror,stats);
            stats.fx_quads=stats.fx_quads.max(saved+1);
            #[cfg(target_arch="wasm32")]
            PROBE.with(|p|p.set([s.time as f32,s.combat_time as f32,a.id as f32,sample.tick as u8 as f32,sample.age as f32,
                sample.frame as f32,foot.x,foot.y,size.x,size.y,camera.zoom,super::actors::visual_scale(a),
                self.active.iter().find(|r|r.id==a.id).map_or(0.,|r|(r.until-s.combat_time) as f32),
                s.spotlight.as_ref().is_some_and(|v|super::spotlight::highlighted(a,v)) as u8 as f32,
                ART.iter().all(|id|assets.vfx.contains_key(*id)) as u8 as f32,mirror as u8 as f32,stats.fx_quads as f32]));
        }
    }
}
#[cfg(target_arch="wasm32")]
std::thread_local! {static PROBE:std::cell::Cell<[f32;17]>=const{std::cell::Cell::new([0.;17])};}
#[cfg(target_arch="wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_regen_probe(index:u32)->f32 {PROBE.with(|p|p.get().get(index as usize).copied().unwrap_or(f32::NAN))}
#[cfg(test)]
mod tests {
    use super::*;
    fn scene()->Snapshot {crate::testing::sim().snapshot().clone()}
    #[test]
    fn duration_is_combat_timed_and_last_heal_gets_the_full_500_ms_flare() {
        let mut s=scene();let mut fx=BossRegen::default();
        fx.ingest(&[Event::RegenStarted{id:9,total:30.,seconds:5.}],&s);
        assert_eq!(fx.sample(9,&s),Some(Sample{tick:false,frame:0,age:-1.}));assert!(!fx.busy(s.time));
        s.time+=8.;fx.ingest(&[],&s);assert!(fx.sample(9,&s).is_some(),"time stop cannot expire regeneration");
        s.combat_time=5.;fx.ingest(&[Event::Healed {target:9,amount:3., source: wf_combat::HealSource::EnemyRegen },Event::Healed {target:4,amount:3., source: wf_combat::HealSource::EnemyRegen }],&s);
        assert!(fx.active.is_empty());assert_eq!(fx.ticks.len(),1);assert!(fx.busy(s.time));
        s.time+=1./6.;assert_eq!(fx.sample(9,&s).unwrap().frame,4);
        s.time+=0.334;fx.ingest(&[],&s);assert!(!fx.busy(s.time));assert!(fx.sample(9,&s).is_none());
    }
    #[test]
    fn tick_replaces_steady_sample_and_death_or_reset_removes_both() {
        let mut s=scene();let mut fx=BossRegen::default();
        fx.ingest(&[Event::RegenStarted{id:9,total:30.,seconds:5.},Event::Healed {target:9,amount:0., source: wf_combat::HealSource::EnemyRegen }],&s);
        assert!(!fx.sample(9,&s).unwrap().tick);fx.ingest(&[Event::Healed {target:9,amount:3., source: wf_combat::HealSource::EnemyRegen }],&s);
        assert!(fx.sample(9,&s).unwrap().tick);s.time+=0.5;fx.ingest(&[],&s);assert!(!fx.sample(9,&s).unwrap().tick);
        for reset in [Event::Died{id:9},Event::SceneReset,Event::WaveReset,Event::StageCleared] {
            fx.ingest(&[Event::RegenStarted{id:9,total:30.,seconds:5.},Event::Healed {target:9,amount:3., source: wf_combat::HealSource::EnemyRegen },reset],&s);
            assert!(fx.sample(9,&s).is_none());assert!(!fx.busy(s.time));
        }
    }
    #[test]
    fn director_moves_regen_through_charge_and_cancel_without_replaying_the_old_tick() {
        use crate::{assets::Manifest,render::{actors::Corpses,spotlight::Spotlight,vfx::Presentation}};
        let mut old=scene();old.time=10.;old.combat_time=1.;let caster=old.actors[0].id;
        let mut boss=old.actors[0].clone();boss.id=999;boss.archetype=Archetype::BossBomber;boss.team=wf_combat::Team::Enemy;old.actors.push(boss);
        let mut clock=old.clone();clock.time=clock.combat_time;
        let mut bg=Presentation::default();bg.ingest(vec![Event::RegenStarted{id:999,total:30.,seconds:5.}],&clock,&clock);
        let m=Manifest{pages:vec![],actors:Default::default(),arenas:vec![]};let mut live=Spotlight::default();let mut corpses=Corpses::default();
        let mut s=old.clone();s.time+=wf_combat::SIM_DT as f64;
        s.spotlight=Some(wf_combat::SpotlightView{caster,skill:wf_combat::Skill::GroundPound,phase:wf_combat::SpotlightPhase::Charge,
            started:s.time,participants:vec![999],co_casters:vec![],hazards:vec![],projectiles:vec![]});
        live.ingest(&m,vec![Event::Healed {target:999,amount:3., source: wf_combat::HealSource::EnemyRegen },Event::SpotlightBegan{caster,skill:wf_combat::Skill::GroundPound}],&s,&old,&mut bg,&mut corpses,1./30.);
        assert!(!bg.busy(s.combat_time),"the lifted tick leaves the background");
        old=s.clone();s.time+=0.7;live.ingest(&m,vec![],&s,&old,&mut bg,&mut corpses,0.7);
        old=s.clone();s.time+=0.5;s.spotlight=None;
        live.ingest(&m,vec![Event::SpotlightEnded{caster,cancelled:true}],&s,&old,&mut bg,&mut corpses,0.5);
        assert!(!bg.busy(s.combat_time),"the completed foreground tick cannot replay after cancellation");
        old=s.clone();s.time+=wf_combat::SIM_DT as f64;s.combat_time+=0.1;
        live.ingest(&m,vec![Event::Healed {target:999,amount:3., source: wf_combat::HealSource::EnemyRegen }],&s,&old,&mut bg,&mut corpses,1./30.);
        assert!(bg.busy(s.combat_time),"regeneration remains active when combat resumes");
    }
    #[test]
    fn spotlight_handoff_preserves_tick_age_and_cannot_replay_a_completed_flare() {
        let mut s=scene();let id=s.actors[0].id;let mut bg=BossRegen::default();let mut fg=BossRegen::default();
        bg.ingest(&[Event::RegenStarted{id,total:30.,seconds:5.},Event::Healed {target:id,amount:3., source: wf_combat::HealSource::EnemyRegen }],&s);
        s.time=10.1;fg.take_actors(&mut bg,0.1,&s);assert!(bg.active.is_empty() && bg.ticks.is_empty());
        assert!((fg.sample(id,&s).unwrap().age-0.1).abs()<1e-6);
        s.time+=1.2;fg.ingest(&[],&s);assert!(fg.sample(id,&s).is_some());assert!(!fg.busy(s.time));
        let mut combat=s.clone();combat.time=0.1;bg.take_actors(&mut fg,s.time,&combat);
        assert!(!bg.sample(id,&combat).unwrap().tick);assert!(bg.ticks.is_empty());assert!(fg.active.is_empty());
    }
}
