//! Impact camera accents use the same paused presentation clock as the battlefield.
use crate::{camera::WorldCamera,render::actors::is_boss};
use macroquad::prelude::*;
use wf_combat::{Event,HitStopCause,Snapshot};
#[derive(Default)]
pub struct ImpactStop { effect:Option<(HitStopCause,f64)> }
pub fn boss_punch(age:f32)->f32 {1.+0.07*(1.-age/0.32).clamp(0.,1.).powi(2)}
impl ImpactStop {
    pub fn ingest(&mut self,events:&[Event],s:&Snapshot,previous:&Snapshot,spotlight:bool) {
        if spotlight || events.iter().any(|e|matches!(e,Event::SceneReset|Event::WaveReset)) {self.effect=None;return;}
        if s.hit_stop.is_some_and(|h|h.cause==HitStopCause::HealingSpring) {self.effect=None;return;}
        let boss=events.iter().any(|e|matches!(e,Event::Died{id} if s.actors.iter().chain(previous.actors.iter()).any(|a|a.id==*id&&is_boss(a.archetype))));
        let down=events.iter().any(|e|matches!(e,Event::Downed{..}));
        if boss || down {self.effect=Some((if boss{HitStopCause::BossDied}else{HitStopCause::HeroDowned},s.time));}
    }
    pub fn apply(&self,camera:&mut WorldCamera,s:&Snapshot,spotlight:bool,reduced:bool) {
        if spotlight||reduced {return;}
        if let Some((cause,born))=self.effect {let age=(s.time-born).max(0.)as f32;
            match cause {
                HitStopCause::HealingSpring=>{},
                HitStopCause::BossDied=>camera.zoom*=boss_punch(age),
                HitStopCause::HeroDowned=> {let fade=(1.-age/0.16).clamp(0.,1.);camera.offset+=vec2((age*140.+1.).sin()*1.5,(age*90.).cos()*0.5)*fade;}
            }
        }
    }
}
#[cfg(test)] mod tests {
    use super::*;
    #[test] fn healing_spring_is_a_pure_freeze_with_or_without_reduced_motion() {
        let mut s=crate::testing::sim().snapshot().clone();
        let previous=s.clone();
        s.hit_stop=Some(wf_combat::HitStopView{cause:HitStopCause::HealingSpring,actor:s.actors[2].id,remaining:4./30.});
        let mut fx=ImpactStop{effect:Some((HitStopCause::BossDied,s.time))};
        fx.ingest(&[],&s,&previous,false);
        for reduced in [false,true] {
            let mut camera=WorldCamera::new(&s);let zoom=camera.zoom;let offset=camera.offset;
            fx.apply(&mut camera,&s,false,reduced);
            assert_eq!(camera.zoom,zoom);assert_eq!(camera.offset,offset);
        }
    }
    #[test] fn punch_stays_within_owner_cap_and_returns_and_never_overlaps_spotlight() {
        assert!((boss_punch(0.)-1.07).abs()<0.0001);assert_eq!(boss_punch(0.4),1.);
        let s=crate::testing::sim().snapshot().clone();
        let fx=ImpactStop{effect:Some((HitStopCause::BossDied,s.time))};let mut c=WorldCamera::new(&s);
        let zoom=c.zoom;fx.apply(&mut c,&s,true,false);assert_eq!(c.zoom,zoom);
        fx.apply(&mut c,&s,false,true);assert_eq!(c.zoom,zoom);
        fx.apply(&mut c,&s,false,false);assert!((c.zoom/zoom-1.07).abs()<0.0001);
    }
}
