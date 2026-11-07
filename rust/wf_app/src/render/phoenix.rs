//! Body-only Phoenix Touch input and the shared revival burst/immunity shimmer.
use crate::{assets::{Assets,DrawStats},camera::{Portrait,WorldCamera,SQUASH}};
use macroquad::prelude::*;
use wf_combat::{ActorState,ActorView,Event,Snapshot,Team};
#[cfg(target_arch="wasm32")]
const HEROES:[wf_combat::Archetype;4]=[wf_combat::Archetype::Fara,wf_combat::Archetype::Hondo,wf_combat::Archetype::Runa,wf_combat::Archetype::Kaja];
const BURST:f64=0.5;
const IMMUNITY:f64=2.;
#[derive(Default)]
pub struct PhoenixTouch { selected:Option<u32>, touch:Option<u64> }
fn downed(a:&ActorView)->bool {a.team==Team::Hero && a.state==ActorState::Downed}
fn available(s:&Snapshot)->bool {s.phoenix_cooldown<=0.}
fn recipient(s:&Snapshot,camera:&WorldCamera,p:Vec2)->Option<u32> {
    s.actors.iter().filter(|a|downed(a)).find(|a| {
        let foot=camera.project(a.pos);
        Rect::new(foot.x-28.,foot.y-28.,56.,48.).contains(p)
    }).map(|a|a.id)
}
impl PhoenixTouch {
    fn update(&mut self,s:&Snapshot,camera:&WorldCamera,p:Option<Vec2>,pressed:bool,held:bool)->Option<u32> {
        if !held || !available(s) || s.spotlight.is_some() || s.hit_stop.is_some() {self.selected=None;return None;}
        if pressed {self.selected=p.and_then(|p|recipient(s,camera,p));}
        if !self.selected.is_some_and(|id|s.actors.iter().any(|a|a.id==id&&downed(a))) {self.selected=None;}
        self.selected
    }
    pub fn read(&mut self,portrait:&Portrait,s:&Snapshot,camera:&WorldCamera)->Option<u32> {
        let touches=touches();
        // Own one finger until release; mouse emulation never creates a second channel.
        let touch=self.touch.and_then(|id|touches.iter().find(|t|t.id==id))
            .or_else(||touches.iter().find(|t|t.phase==TouchPhase::Started));
        if let Some(t)=touch {
            let pressed=t.phase==TouchPhase::Started;
            let held=!matches!(t.phase,TouchPhase::Ended|TouchPhase::Cancelled);
            self.touch=held.then_some(t.id);
            let (scale,offset)=portrait.layout();
            return self.update(s,camera,Some((t.position-offset)/scale),pressed,held);
        }
        if self.touch.take().is_some() {self.selected=None;return None;}
        self.update(s,camera,portrait.pointer(),is_mouse_button_pressed(MouseButton::Left),is_mouse_button_down(MouseButton::Left))
    }
}
struct Burst {hero:u32,pos:wf_combat::Vec2,radius:f32,born:f64}
#[derive(Default)]
pub struct Revival {bursts:Vec<Burst>,immune:Vec<(u32,f64)>}
impl Revival {
    pub fn ingest(&mut self,events:&[Event],s:&Snapshot) {
        let events=if let Some(i)=events.iter().rposition(|e|matches!(e,Event::SceneReset|Event::WaveReset)) {*self=Self::default();&events[i+1..]}else{events};
        for e in events {if let Event::ReviveBurst{hero,pos,radius}=*e {
            self.bursts.push(Burst{hero,pos,radius,born:s.combat_time});
            self.immune.retain(|(id,_)|*id!=hero);self.immune.push((hero,s.combat_time));
        }}
        self.bursts.retain(|b|s.combat_time-b.born<BURST);
        self.immune.retain(|(id,born)|s.combat_time-born<IMMUNITY&&s.actors.iter().any(|a|a.id==*id&&a.hp>0.));
    }
    pub fn effects(&self,assets:&Assets,camera:&WorldCamera,s:&Snapshot,reduced:bool,stats:&mut DrawStats) {
        gl_use_material(&assets.additive);
        for b in &self.bursts {if !s.actors.iter().any(|a|a.id==b.hero) {continue;}
            let t=((s.combat_time-b.born)/BURST).clamp(0.,1.)as f32;
            let radius=b.radius*camera.zoom*(1.-(1.-t).powi(3));
            assets.decal("wave_band",camera.project(b.pos),vec2(radius*2.,radius*2.*SQUASH),0.,Color::new(1.,0.8,0.267,(1.-t)*0.85),stats);
        }
        gl_use_default_material();
        for (id,born) in &self.immune {let Some(a)=s.actors.iter().find(|a|a.id==*id&&a.hp>0.)else{continue;};
            let Some(art)=assets.manifest.actors.get(&format!("{:?}",a.archetype))else{continue;};
            let Some(clip)=art.clips.get(crate::clips::name(a.state))else{continue;};
            let Some(frame)=crate::clips::actor(clip,a)else{continue;};
            let age=(s.combat_time-born)as f32;
            let alpha=if reduced {0.12}else{0.12+0.16*(age*22.).sin().max(0.)};
            let flip=(art.facing=="left")!=(a.facing==wf_combat::Facing::Left);
            gl_use_material(&assets.additive);
            for (i,offset) in [vec2(-1.,0.),vec2(1.,0.),vec2(0.,-1.),vec2(0.,1.)].into_iter().enumerate() {
                if stats.fx_quads>=112 {break;}
                // Alternating offset copies produce the approved broken outline flicker.
                if !reduced && ((age*14.)as usize+i)%3==0 {continue;}
                assets.frame(frame,clip.foot_origin,camera.project(a.pos)+offset,super::actors::visual_scale(a)*camera.zoom,flip,Color::new(1.,0.84,0.43,alpha),stats);stats.fx_quads+=1;
            }
            gl_use_default_material();
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn scene()->Snapshot {crate::testing::sim().snapshot().clone()}
    #[test] fn hold_requires_press_on_body_and_cancels_without_cooldown() {
        let mut s=scene();s.actors[3].state=ActorState::Downed;s.actors[3].hp=0.;
        let camera=WorldCamera::new(&s);let id=s.actors[3].id;let mut input=PhoenixTouch::default();
        assert_eq!(input.update(&s,&camera,Some(camera.project(s.actors[3].pos)),true,true),Some(id));
        assert_eq!(input.update(&s,&camera,None,false,true),Some(id));
        assert_eq!(input.update(&s,&camera,None,false,false),None);assert_eq!(s.phoenix_cooldown,0.);
        assert_eq!(recipient(&s,&camera,camera.project(s.actors[3].pos)),Some(id));
        assert_eq!(recipient(&s,&camera,vec2(310.,595.)),None,"card input is unsupported");
        assert_eq!(input.update(&s,&camera,Some(vec2(10.,590.)),true,true),None);
    }
    #[test] fn frozen_and_cooldown_input_is_ignored() {
        let mut s=scene();s.actors[0].state=ActorState::Downed;let camera=WorldCamera::new(&s);let mut input=PhoenixTouch::default();
        let id=s.actors[0].id;let p=Some(camera.project(s.actors[0].pos));
        s.hit_stop=Some(wf_combat::HitStopView{actor:id,cause:wf_combat::HitStopCause::HeroDowned,remaining:0.1});
        assert_eq!(input.update(&s,&camera,p,true,true),None);
        s.hit_stop=None;s.spotlight=Some(wf_combat::SpotlightView{caster:s.actors[1].id,skill:wf_combat::Skill::Shadow,phase:wf_combat::SpotlightPhase::Charge,started:s.time,participants:vec![],co_casters:vec![],hazards:vec![],projectiles:vec![]});
        assert_eq!(input.update(&s,&camera,p,true,true),None);
        s.spotlight=None;s.phoenix_cooldown=15.;assert_eq!(input.update(&s,&camera,p,true,true),None);
    }
    #[test] fn every_revive_bursts_and_only_immunity_lasts_two_combat_seconds() {
        let mut s=scene();let a=&s.actors[0];let event=Event::ReviveBurst{hero:a.id,pos:a.pos,radius:180.};let mut fx=Revival::default();
        fx.ingest(&[event],&s);assert_eq!(fx.bursts.len(),1);assert_eq!(fx.immune.len(),1);
        s.time+=10.;fx.ingest(&[],&s);assert_eq!(fx.bursts.len(),1);
        s.combat_time+=0.6;fx.ingest(&[],&s);assert!(fx.bursts.is_empty());assert_eq!(fx.immune.len(),1);
        s.combat_time+=1.5;fx.ingest(&[],&s);assert!(fx.immune.is_empty());
    }
}

#[cfg(target_arch="wasm32")]
std::thread_local! {static PROBE:std::cell::Cell<[f32;36]>=const{std::cell::Cell::new([0.;36])};}
#[cfg(target_arch="wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_phoenix_probe(index:u32)->f32 {PROBE.with(|p|p.get().get(index as usize).copied().unwrap_or(f32::NAN))}
#[cfg(target_arch="wasm32")]
pub fn record(s:&Snapshot,camera:&WorldCamera,fx:&Revival) {
    let mut v=[0.;36];v[0]=s.step as f32;v[1]=s.phoenix_cooldown;
    v[2]=s.phoenix_channel.map_or(0.,|c|c.hero as f32);v[3]=s.phoenix_channel.map_or(0.,|c|c.progress);
    v[4]=s.actors.iter().filter(|a|downed(a)).count()as f32;
    v[5]=fx.bursts.last().map_or(-1.,|b|(s.combat_time-b.born)as f32);v[6]=fx.immune.len()as f32;
    v[7]=if s.hit_stop.is_some(){1.}else{0.};v[8]=s.hit_stop.map_or(0.,|h|h.remaining);
    v[9]=s.time as f32;v[10]=s.combat_time as f32;
    v[11]=s.hit_stop.map_or(0.,|h|if h.cause==wf_combat::HitStopCause::BossDied {2.}else{1.});
    for (i,kind) in HEROES.iter().enumerate() {if let Some(a)=s.actors.iter().find(|a|a.archetype==*kind&&a.team==Team::Hero) {
        let p=camera.project(a.pos);let o=12+i*6;v[o]=a.id as f32;v[o+1]=if downed(a){1.}else{0.};v[o+2]=p.x;v[o+3]=p.y;v[o+4]=a.hp;v[o+5]=a.slowed;
    }}
    PROBE.with(|p|p.set(v));
}
