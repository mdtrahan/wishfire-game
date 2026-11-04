//! Flat world-space hero bars and cast emission, independent of spotlight packages.
use std::collections::BTreeMap;
use macroquad::prelude::*;
use wf_combat::{ActorState, ActorView, Archetype, Event, Groove, Skill, Snapshot, SpotlightView, Team};
use crate::assets::DrawStats;

#[derive(Debug)]
pub struct Meter {
    pub segments: usize,
    pub full: usize,
    pub partial: f32,
    pub glow: bool,
}
pub fn meter(groove: Groove, value: f32) -> Meter {
    let segments = match groove { Groove::Rage | Groove::Super | Groove::Power => 3, Groove::Combo => 1 };
    let value = if value.is_finite() { value.clamp(0., segments as f32) } else { 0. };
    let full = value.floor() as usize;
    Meter { segments, full, partial: value - full as f32, glow: value >= segments as f32 }
}
// Idle alpha>=24 max widths: Hondo/Fara/Runa/Kaja 56/56/65/56 px (>=1: 56/56/70/56).
// round(min * hero scale 1 * ACTOR_SCALE 0.6 * default zoom 0.5) = 17 screen px.
pub(super) const BAR_WIDTH: f32 = 17.;
pub fn bar_anchor(foot: Vec2, zoom: f32, body_scale: f32) -> Vec2 {
    foot + vec2(0., 8. * (zoom / 0.5) * body_scale)
}
pub fn bar_rects(foot: Vec2, zoom: f32) -> (Rect, Rect) {
    let z = zoom / 0.5;
    let x = foot.x - BAR_WIDTH * z / 2.;
    (Rect::new(x, bar_anchor(foot, zoom, 1.).y, BAR_WIDTH * z, 1.5 * z),
     Rect::new(x, foot.y + 10.5 * z, BAR_WIDTH * z, 1. * z))
}
pub fn bars(a: &ActorView, foot: Vec2, zoom: f32, opacity: f32, stats: &mut DrawStats) {
    if a.team != Team::Hero || a.hp <= 0. || a.state == ActorState::Downed { return; }
    let (hp, gold) = bar_rects(foot, zoom);
    let track = Color::new(0.035, 0.055, 0.07, opacity);
    draw_rectangle(hp.x, hp.y, hp.w, hp.h, track);
    draw_rectangle(hp.x, hp.y, hp.w * (a.hp / a.max_hp.max(1.)).clamp(0., 1.), hp.h,
        Color::new(0.27, 0.83, 0.53, opacity));
    stats.calls += 2;
    let Some(groove) = a.groove else { return; };
    let m = meter(groove, a.meter);
    let z = zoom / 0.5;
    if m.glow {
        for (pad, alpha) in [(2., 0.07), (1., 0.14)] {
            draw_rectangle(gold.x-pad*z, gold.y-pad*z, gold.w+2.*pad*z, gold.h+2.*pad*z,
                Color::new(1., 0.72, 0.2, alpha*opacity));
            stats.calls += 1;
        }
    }
    draw_rectangle(gold.x, gold.y, gold.w, gold.h, track);
    let unit = gold.w / m.segments as f32;
    if m.full > 0 {
        draw_rectangle(gold.x, gold.y, unit*m.full as f32, gold.h, Color::new(1., 0.78, 0.27, opacity));
        stats.calls += 1;
    }
    if m.partial > 0. {
        draw_rectangle(gold.x+unit*m.full as f32, gold.y, unit*m.partial, gold.h, Color::new(1., 0.78, 0.27, opacity));
        stats.calls += 1;
    }
    stats.calls += 1;
}

const FADE: f32 = 0.3;
#[derive(Default)]
struct Fade {
    on: bool,
    from: f32,
    age: f32,
}
impl Fade {
    fn level(&self) -> f32 {
        let t = (self.age / FADE).clamp(0., 1.);
        self.from + ((if self.on { 1. } else { 0. }) - self.from) * t*t*(3.-2.*t)
    }
    fn advance(&mut self, on: bool, dt: f32) {
        if self.on != on {
            self.from = self.level();
            self.on = on;
            self.age = 0.;
        } else {
            self.age += dt.max(0.);
        }
    }
}
#[derive(Default)]
pub struct CastGlows {
    actors: BTreeMap<u32, Fade>,
    healing: BTreeMap<u32, f64>,
    clocks: Option<(f64, f64)>,
}
impl CastGlows {
    pub fn update(&mut self, s: &Snapshot, view: Option<&SpotlightView>, events: &[Event]) {
        let events = if let Some(i) = events.iter().rposition(|e| matches!(e, Event::SceneReset)) {
            *self = Self::default(); &events[i+1..]
        } else { events };
        for e in events {
            if matches!(e, Event::WaveReset | Event::StageCleared) { self.healing.clear(); }
            if let Event::SkillStarted { id, skill, .. } = e {
                self.healing.remove(id);
                if *skill == Skill::HealingSpring {
                    if let Some(a) = s.actors.iter().find(|a| a.id == *id && a.state == ActorState::Cast) {
                        self.healing.insert(*id, s.combat_time - a.state_age as f64 + 2. * a.state_duration as f64);
                    }
                }
            }
        }
        self.healing.retain(|id, until| s.combat_time < *until + FADE as f64
            && s.actors.iter().any(|a| a.id == *id && a.archetype == Archetype::Runa
                && a.hp > 0. && !matches!(a.state, ActorState::Downed | ActorState::Dead) && a.encased <= 0.));
        let (live, combat) = self.clocks.map_or((0., 0.), |(t,c)|
            ((s.time-t).max(0.) as f32, (s.combat_time-c).max(0.) as f32));
        self.clocks = Some((s.time, s.combat_time));
        self.actors.retain(|id,_|s.actors.iter().any(|a|a.id==*id && a.team==Team::Hero && a.hp>0.
            && (a.archetype != Archetype::Runa || self.healing.contains_key(id))));
        for a in s.actors.iter().filter(|a|a.team==Team::Hero && a.hp>0.) {
            if a.archetype == Archetype::Hondo { self.actors.remove(&a.id); continue; }
            if a.archetype == Archetype::Runa {
                if let Some(until) = self.healing.get(&a.id) {
                    self.actors.insert(a.id, Fade { on: false, from: 1., age: (s.combat_time - until).max(0.) as f32 });
                }
                continue;
            }
            let dt = if view.is_some_and(|v|!super::spotlight::highlighted(a,v)) {combat} else {live};
            self.actors.entry(a.id).or_default().advance(a.special_casting, dt);
        }
    }
    pub fn level(&self, id: u32) -> f32 { self.actors.get(&id).map_or(0., Fade::level) }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "slice director scenario; re-enable on the WFM host loop (ORKA-63bf.6)"]
    fn real_slice_healing_spring_glow_lasts_twice_cast_then_fades() {
        use wf_combat::{Sim, SimConfig, SpotlightConfig};
        for spotlight in [SpotlightConfig::OFF, SpotlightConfig::DEFAULT] {
            let mut sim = crate::testing::sim_with(SimConfig { spotlight, ..SimConfig::default() });
            let mut motion = crate::motion::Motion::new(sim.snapshot());
            let runa = sim.snapshot().actors.iter().find(|a| a.archetype == Archetype::Runa).unwrap().id;
            let hondo = sim.snapshot().actors.iter().find(|a| a.archetype == Archetype::Hondo).unwrap().id;
            let mut glows = CastGlows::default();
            let mut until = None;
            let mut first_heal = None;
            let (mut heals, mut bubbles, mut exits, mut tails, mut freezes) = (0, 0, 0, 0, 0);
            for frame in 0..36_000 {
                motion.advance_with_hold(&mut sim, 1. / 60., None);
                let events = sim.drain_events();
                if events.iter().any(|e| matches!(e, Event::SceneReset)) {
                    motion = crate::motion::Motion::new(sim.snapshot());
                    glows = CastGlows::default();
                    until = None;
                }
                let snapshot = motion.presentation(sim.snapshot());
                let actor = snapshot.actors.iter().find(|a| a.id == runa).unwrap();
                for event in &events {
                    if matches!(event, Event::WaveReset | Event::StageCleared) { until = None; }
                    if let Event::SkillStarted { id, skill: started, .. } = event {
                        if *id == runa {
                            until = None;
                            match started {
                                Skill::HealingSpring => {
                                    heals += 1;
                                    until = Some(snapshot.combat_time - actor.state_age as f64 + 2. * actor.state_duration as f64);
                                    first_heal.get_or_insert(snapshot.time);
                                }
                                Skill::BubblePop => bubbles += 1,
                                _ => panic!("unexpected Runa special: {started:?}"),
                            }
                        }
                    }
                }
                let was_healing = glows.level(runa) > 0.;
                glows.update(&snapshot, snapshot.spotlight.as_ref(), &events);
                if actor.hp <= 0. || matches!(actor.state, ActorState::Downed | ActorState::Dead) || actor.encased > 0. {
                    until = None;
                }
                let expected = until.map_or(0., |end| {
                    let t = ((snapshot.combat_time - end).max(0.) as f32 / FADE).clamp(0., 1.);
                    1. - t*t*(3.-2.*t)
                });
                assert!((glows.level(runa) - expected).abs() < 0.00001, "frame {frame}");
                assert_eq!(glows.level(hondo), 0., "Hondo frame {frame}");
                if expected > 0. && actor.state != ActorState::Cast { tails += 1; }
                if snapshot.hit_stop.is_some_and(|h| h.cause == wf_combat::HitStopCause::HealingSpring) {
                    assert_eq!(glows.level(runa), 1., "aura must already be visible during cast-start freeze");
                    assert!(snapshot.spotlight.is_none());
                    freezes += 1;
                }
                if was_healing && expected == 0. { exits += 1; }
            }
            eprintln!("seed=1 spotlight={} 600s: HealingSpring={heals}, first={first_heal:?}, BubblePop={bubbles}, heal exits={exits}", spotlight.enabled);
            assert!(heals > 0 && bubbles > 0 && exits > 0 && tails > 0 && freezes > 0);
        }
    }
    #[test]
    fn runa_heal_glows_for_twice_cast_then_fades_and_hondo_never_glows() {
        let mut s=crate::testing::sim().snapshot().clone();
        let runa=s.actors.iter().position(|a|a.archetype==Archetype::Runa).unwrap();
        let hondo=s.actors.iter().position(|a|a.archetype==Archetype::Hondo).unwrap();
        let id=s.actors[runa].id;let hid=s.actors[hondo].id;
        let cast=Event::SkillStarted{id,skill:Skill::HealingSpring,target:Some(s.actors[0].id)};
        s.actors[runa].state=ActorState::Cast;s.actors[runa].state_duration=0.8;
        s.actors[hondo].state=ActorState::Cast;s.actors[hondo].special_casting=true;
        let mut g=CastGlows::default();g.update(&s,None,&[cast.clone()]);
        for frame in 0..48 {
            s.time=frame as f64/30.;s.combat_time=s.time;
            s.actors[runa].state_age=frame as f32/30.;
            if frame >= 24 { s.actors[runa].state=ActorState::Idle; }
            g.update(&s,None,&[]);assert_eq!(g.level(id),1.);assert_eq!(g.level(hid),0.);
        }
        // Both the hold and quick fade use combat time, excluding hit-stop and spotlight time.
        for time in [10., 11.] { s.time=time;g.update(&s,None,&[]);assert_eq!(g.level(id),1.); }
        s.combat_time=1.75;g.update(&s,None,&[]);assert!((g.level(id)-0.5).abs()<0.00001);
        s.time+=1.;g.update(&s,None,&[]);assert!((g.level(id)-0.5).abs()<0.00001);
        s.combat_time=1.91;g.update(&s,None,&[]);assert_eq!(g.level(id),0.);
        // A groove special must never reuse or restart the healing aura.
        s.actors[runa].state=ActorState::Cast;s.actors[runa].state_age=0.;s.actors[runa].special_casting=true;
        g.update(&s,None,&[cast.clone()]);assert_eq!(g.level(id),1.);
        g.update(&s,None,&[Event::SkillStarted{id,skill:Skill::BubblePop,target:None}]);
        assert_eq!(g.level(id),0.);
        for reset in [Event::SceneReset,Event::WaveReset,Event::StageCleared] {
            g.update(&s,None,&[cast.clone()]);assert_eq!(g.level(id),1.);
            g.update(&s,None,&[reset]);assert_eq!(g.level(id),0.);
        }
        for state in [ActorState::Downed,ActorState::Dead] {
            s.actors[runa].state=ActorState::Cast;g.update(&s,None,&[cast.clone()]);assert_eq!(g.level(id),1.);
            s.actors[runa].state=state;g.update(&s,None,&[]);assert_eq!(g.level(id),0.);
        }
        s.actors[runa].state=ActorState::Cast;g.update(&s,None,&[cast.clone()]);
        s.actors[runa].hp=0.;g.update(&s,None,&[]);assert_eq!(g.level(id),0.);
        s.actors[runa].hp=1.;g.update(&s,None,&[cast]);
        s.actors[runa].encased=1.;g.update(&s,None,&[]);assert_eq!(g.level(id),0.);
    }
    #[test]
    fn meter_partitions_three_stocks_and_single_bars() {
        for groove in [Groove::Rage, Groove::Super, Groove::Power] {
            let m=meter(groove,2.4);assert_eq!(m.segments-1,2);assert_eq!(m.full,2);
            assert!((m.partial-0.4).abs()<0.00001);assert!(!m.glow);
            let full=meter(groove,3.);assert_eq!(full.full,3);assert_eq!(full.partial,0.);assert!(full.glow);
        }
        for groove in [Groove::Combo] {
            let m=meter(groove,0.7);assert_eq!(m.segments-1,0);assert_eq!(m.full,0);assert_eq!(m.partial,0.7);
            assert!(meter(groove,1.).glow);assert!(meter(groove,-1.).partial==0.);
            assert_eq!(meter(groove,f32::NAN).partial,0.);
        }
        let rage = meter(Groove::Rage, 1.7);
        assert_eq!(rage.segments, 3);assert_eq!(rage.full, 1);
        assert!((rage.partial - 0.7).abs() < 0.00001);assert!(!rage.glow);
        let full = meter(Groove::Rage, 3.);
        assert_eq!(full.full, 3);assert_eq!(full.partial, 0.);assert!(full.glow);
        assert_eq!(meter(Groove::Rage, f32::NAN).partial, 0.);
        assert_eq!(meter(Groove::Rage, -1.).partial, 0.);
        assert!(meter(Groove::Combo,0.3).partial<meter(Groove::Combo,0.7).partial);
    }
    #[test]
    fn bars_stay_below_ring_and_scale_with_world_zoom() {
        let (hp,m)=bar_rects(vec2(100.,100.),0.5);
        assert_eq!(hp,Rect::new(91.5,108.,17.,1.5));assert_eq!(m,Rect::new(91.5,110.5,17.,1.));
        let (large,gold)=bar_rects(vec2(100.,100.),0.8);
        assert!((large.w/hp.w-1.6).abs()<0.00001);assert!(gold.y>large.y+large.h);
        assert!((large.h/hp.h-1.6).abs()<0.00001);assert!((gold.h/m.h-1.6).abs()<0.00001);
    }
    #[test]
    fn glow_smoothly_enters_leaves_and_resumes_at_current_level() {
        let mut f=Fade::default();f.advance(true,0.);assert_eq!(f.level(),0.);
        f.advance(true,0.001);assert!(f.level()<0.0001);
        f.advance(true,0.149);assert!((f.level()-0.5).abs()<0.0001);
        f.advance(true,0.15);assert_eq!(f.level(),1.);
        f.advance(false,0.);assert_eq!(f.level(),1.);
        f.advance(false,0.15);let level=f.level();assert!((level-0.5).abs()<0.0001);
        f.advance(true,0.);assert_eq!(f.level(),level);
        f.advance(true,0.15);assert!((f.level()-0.75).abs()<0.0001);
        f.advance(true,0.15);assert_eq!(f.level(),1.);
        f.advance(false,0.);f.advance(false,0.3);assert_eq!(f.level(),0.);
    }
    #[test]
    fn glows_keep_levels_through_layer_handoffs_and_freeze_with_combat() {
        let mut s=crate::testing::sim().snapshot().clone();
        let id=s.actors[0].id;s.actors[0].special_casting=true;
        let mut g=CastGlows::default();g.update(&s,None,&[]);s.time+=0.15;s.combat_time+=0.15;g.update(&s,None,&[]);
        let level=g.level(id);assert!((level-0.5).abs()<0.0001);
        let mut v=SpotlightView{caster:s.actors[1].id,skill:wf_combat::Skill::Shadow,phase:wf_combat::SpotlightPhase::Charge,
            started:s.time,participants:vec![],co_casters:vec![],hazards:vec![],projectiles:vec![]};
        s.time+=1.;g.update(&s,Some(&v),&[]);assert_eq!(g.level(id),level);
        v.co_casters.push(id);g.update(&s,Some(&v),&[]);assert_eq!(g.level(id),level);
        s.time+=0.15;g.update(&s,Some(&v),&[]);assert_eq!(g.level(id),1.);
        s.actors[0].hp=0.;g.update(&s,None,&[]);assert_eq!(g.level(id),0.);
    }
}
