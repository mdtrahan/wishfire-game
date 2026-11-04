use std::collections::BTreeMap;
use wf_combat::{api::*, Sim, SIM_DT};

// Resolve against the chosen target, including frozen attacks whose target was shoved.
fn attack_facing(actor: &ActorView, s: &Snapshot) -> Option<Facing> {
    if actor.team != Team::Hero || !(matches!(actor.state, ActorState::Basic | ActorState::Cast)
        || actor.special_casting
        || s.spotlight.as_ref().is_some_and(|v| v.caster == actor.id
            || v.co_casters.contains(&actor.id) || v.participants.contains(&actor.id))) {
        return None;
    }
    let target = s.actors.iter().find(|a| Some(a.id) == actor.target)?;
    let dx = target.pos.x - actor.pos.x;
    (dx.abs() > 1.).then_some(if dx < 0. { Facing::Left } else { Facing::Right })
}

struct FacingHold {
    shown: Facing,
    candidate: Facing,
    since: f64,
    born: f64,
}
/// Presentation state only. The previous snapshot is always exactly one sim tick behind.
pub struct Motion {
    pub previous: Snapshot,
    facings: BTreeMap<u32, FacingHold>,
    stopped_time: f64,
}
impl Motion {
    pub fn new(s: &Snapshot) -> Self {
        let mut this = Self {
            previous: s.clone(),
            facings: BTreeMap::new(),
            stopped_time: 0.,
        };
        this.observe(s);
        this
    }
    fn observe(&mut self, s: &Snapshot) {
        self.facings
            .retain(|id, _| s.actors.iter().any(|a| a.id == *id));
        let time = s.time - self.stopped_time;
        for actor in &s.actors {
            let hold = self.facings.entry(actor.id).or_insert(FacingHold {
                shown: actor.facing,
                candidate: actor.facing,
                since: time,
                born: s.combat_time,
            });
            if let Some(facing) = attack_facing(actor, s) {
                hold.shown = facing;
                hold.candidate = facing;
                hold.since = time;
                continue;
            }
            if hold.candidate != actor.facing {
                hold.candidate = actor.facing;
                hold.since = time;
            }
            if time - hold.since >= 0.15 {
                hold.shown = hold.candidate;
            }
        }
    }
    pub fn observe_step(&mut self,before:&Snapshot,after:&Snapshot) {
        self.previous=self.presentation(before);
        if before.hit_stop.is_some() {self.stopped_time+=after.time-before.time;}
        self.observe(after);
    }
    /// Sim time includes hit-stop ticks; presentation time excludes them everywhere.
    pub fn presentation(&self, s: &Snapshot) -> Snapshot {
        let mut frame=s.clone();
        frame.time-=self.stopped_time;
        if let Some(view)=&mut frame.spotlight {view.started-=self.stopped_time;}
        frame
    }
    #[cfg(test)]
    pub fn advance(&mut self, sim: &mut Sim, dt: f32) -> u32 {
        self.advance_with_hold(sim,dt,None)
    }
    /// Test/reference stepping over a bare sim (no host). Mirrors the slice chunked advance.
    #[cfg(test)]
    pub fn advance_with_hold(&mut self, sim: &mut Sim, dt: f32, held: Option<u32>) -> u32 {
        let mut remaining = dt.clamp(0., 0.25);
        let mut steps = 0;
        while remaining > 0. {
            let chunk = remaining.min(SIM_DT * 0.5);
            let before = sim.snapshot().clone();
            if before.spotlight.is_none() && before.hit_stop.is_none() {
                if let Some(id)=held {sim.phoenix_hold(id);} else {sim.phoenix_release();}
            }
            let n = sim.advance(chunk);
            if n > 0 {
                self.observe_step(&before,sim.snapshot());
            }
            steps += n;
            remaining = (remaining - chunk).max(0.);
        }
        steps
    }
    pub fn snapshot(&self, s: &Snapshot, alpha: f32) -> Snapshot {
        let mut frame = s.clone();
        let alpha = alpha.clamp(0., 1.);
        for actor in &mut frame.actors {
            if let Some(old) = self.previous.actors.iter().find(|a| a.id == actor.id) {
                let dx = actor.pos.x - old.pos.x;
                let dy = actor.pos.y - old.pos.y;
                // Preserve instantaneous teleports such as Hondo's blink.
                let frozen = s
                    .spotlight
                    .as_ref()
                    .is_some_and(|v| v.phase!=SpotlightPhase::Performing || !crate::render::spotlight::highlighted(actor,v));
                let hop = actor.archetype == Archetype::Marid
                    && dx * dx + dy * dy > ((s.arena_max.x - s.arena_min.x) * 0.1).powi(2);
                if s.hit_stop.is_none() && !frozen && !hop && dx * dx + dy * dy < 200. * 200. {
                    actor.pos.x = old.pos.x + dx * alpha;
                    actor.pos.y = old.pos.y + dy * alpha;
                }
            }
            if let Some(hold) = self.facings.get(&actor.id) {
                actor.facing = hold.shown;
                // Spawn is a visual transition even when the sim immediately starts walking.
                let age = (s.combat_time - hold.born) as f32;
                if actor.team == Team::Enemy
                    && age < 0.75
                    && matches!(
                        actor.state,
                        ActorState::Idle | ActorState::Walk | ActorState::Spawn
                    )
                {
                    actor.state = ActorState::Spawn;
                    actor.state_age = age;
                    actor.state_duration = 0.75;
                    actor.impact_at = 0.;
                }
            }
        }
        // Both feet positions must be interpolated before choosing the visible side.
        for i in 0..frame.actors.len() {
            if let Some(facing) = attack_facing(&frame.actors[i], &frame) {
                frame.actors[i].facing = facing;
            }
        }
        for projectile in &mut frame.projectiles {
            if s.hit_stop.is_some() || s.spotlight.as_ref().is_some_and(|v|v.phase!=SpotlightPhase::Performing || !v.projectiles.contains(&projectile.id)) {
                continue;
            }
            if let Some(old) = self
                .previous
                .projectiles
                .iter()
                .find(|p| p.id == projectile.id)
            {
                projectile.pos.x = old.pos.x + (projectile.pos.x - old.pos.x) * alpha;
                projectile.pos.y = old.pos.y + (projectile.pos.y - old.pos.y) * alpha;
                projectile.height = old.height + (projectile.height - old.height) * alpha;
            }
        }
        frame
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn marid_hop_swaps_instantly_while_ordinary_motion_interpolates() {
        let mut s = crate::testing::sim().snapshot().clone();
        s.combat_time = 10.;
        s.actors[0].archetype = Archetype::Marid;
        let mut motion = Motion::new(&s);
        motion.previous.actors[0].pos.x -= (s.arena_max.x-s.arena_min.x)*0.2;
        motion.previous.actors[1].pos.x -= 10.;
        let frame = motion.snapshot(&s, 0.5);
        assert_eq!(frame.actors[0].pos, s.actors[0].pos);
        assert_eq!(frame.actors[1].pos.x, s.actors[1].pos.x-5.);
    }
    #[test]
    fn hit_stop_freezes_presentation_time_and_resumes_continuously_before_a_spotlight() {
        let mut before=crate::testing::sim().snapshot().clone();
        before.hit_stop=Some(HitStopView{actor:before.actors[0].id,cause:HitStopCause::HeroDowned,remaining:0.1});
        let mut motion=Motion::new(&before);
        for _ in 0..3 {
            let mut after=before.clone();after.step+=1;after.time+=1./30.;
            motion.observe_step(&before,&after);
            let frame=motion.snapshot(&motion.presentation(&after),0.5);
            assert!(frame.time.abs()<0.000001);assert_eq!(frame.actors,before.actors);
            assert_eq!(frame.combat_time,before.combat_time);before=after;
        }
        before.hit_stop=None;let mut after=before.clone();after.time+=1./30.;after.combat_time+=1./30.;
        motion.observe_step(&before,&after);assert!((motion.presentation(&after).time-1./30.).abs()<0.000001);
        after.spotlight=Some(SpotlightView{caster:after.actors[0].id,skill:Skill::GroundPound,phase:SpotlightPhase::Charge,
            started:after.time,participants:vec![],co_casters:vec![],hazards:vec![],projectiles:vec![]});
        let presented=motion.presentation(&after);
        assert!((presented.spotlight.unwrap().started-presented.time).abs()<0.000001);
    }
    #[test]
    fn combo_interpolates_only_listed_flights_and_keeps_frozen_basic_age() {
        let mut s=crate::testing::sim().snapshot().clone();
        let co=s.actors[3].id;s.actors[3].state=ActorState::Basic;s.actors[3].state_age=0.17;
        s.projectiles=(800..802).map(|id|ProjectileView{id,kind:ProjectileKind::Orb,pos:Vec2::new(100.,100.),height:20.,
            team:Team::Hero,dir:Vec2::new(1.,0.)}).collect();
        s.spotlight=Some(SpotlightView{caster:s.actors[0].id,skill:Skill::BubblePop,phase:SpotlightPhase::Performing,
            started:0.,participants:vec![],co_casters:vec![co],hazards:vec![],projectiles:vec![800]});
        let mut motion=Motion::new(&s);for p in &mut motion.previous.projectiles {p.pos.x=80.;}
        motion.previous.actors[3].pos.x-=20.;let frame=motion.snapshot(&s,0.5);
        assert_eq!(frame.projectiles[0].pos.x,90.);assert_eq!(frame.projectiles[1].pos.x,100.);
        assert_eq!(frame.actors[3].state_age,0.17);assert_eq!(frame.actors[3].pos.x,s.actors[3].pos.x-10.);
        s.spotlight.as_mut().unwrap().phase=SpotlightPhase::Charge;let frame=motion.snapshot(&s,0.5);
        assert_eq!(frame.projectiles[0].pos.x,100.);assert_eq!(frame.actors[3].pos,s.actors[3].pos);
    }
    #[test]
    fn spotlight_freezes_background_at_authoritative_positions_and_spawn_age() {
        let mut s = crate::testing::sim().snapshot().clone();
        let mut enemy = s.actors[0].clone(); enemy.id = 500; enemy.team = Team::Enemy;
        enemy.state = ActorState::Walk; enemy.pos = Vec2::new(100., 100.);
        s.actors.push(enemy);
        let mut motion = Motion::new(&s);
        motion.previous.actors.last_mut().unwrap().pos = Vec2::new(90., 90.);
        s.spotlight = Some(SpotlightView { caster:s.actors[0].id, skill:Skill::CrimsonWard,
            phase:SpotlightPhase::Performing, started:s.time, participants:vec![s.actors[0].id], hazards:vec![], co_casters:vec![], projectiles:vec![] });
        s.time += 1.; motion.observe(&s);
        let frame = motion.snapshot(&s, 0.5);
        let shown = frame.actors.last().unwrap();
        assert_eq!(shown.pos, Vec2::new(100., 100.));
        assert_eq!(shown.state, ActorState::Spawn);
        assert_eq!(shown.state_age, 0.);
    }
    #[test]
    fn four_speed_retains_adjacent_ticks_and_interpolates_midpoint() {
        let mut sim = crate::testing::sim();
        let mut motion = Motion::new(sim.snapshot());
        for _ in 0..120 {
            motion.advance(&mut sim, 4. / 60.);
            assert!((sim.snapshot().time - motion.previous.time - 1. / 30.).abs() < 0.000001);
        }
        let mut s = sim.snapshot().clone();
        let id = s.actors[0].id;
        let old = motion
            .previous
            .actors
            .iter_mut()
            .find(|a| a.id == id)
            .unwrap();
        old.pos = Vec2::new(100., 100.);
        s.actors[0].pos = Vec2::new(110., 120.);
        let frame = motion.snapshot(&s, 0.5);
        assert_eq!(frame.actors[0].pos, Vec2::new(105., 110.));
    }
    #[test]
    fn new_enemies_play_spawn_without_changing_authoritative_state() {
        let sim = crate::testing::sim();
        let mut s = sim.snapshot().clone();
        let mut motion = Motion::new(&s);
        let mut enemy = s.actors[0].clone();
        enemy.id = 999;
        enemy.team = Team::Enemy;
        enemy.state = ActorState::Walk;
        s.actors.push(enemy);
        motion.observe(&s);
        s.time += 0.2;
        s.combat_time += 0.2;
        let rendered = motion.snapshot(&s, 1.);
        assert_eq!(rendered.actors.last().unwrap().state, ActorState::Spawn);
        assert_eq!(s.actors.last().unwrap().state, ActorState::Walk);
        s.time += 0.6;
        s.combat_time += 0.6;
        assert_eq!(
            motion.snapshot(&s, 1.).actors.last().unwrap().state,
            ActorState::Walk
        );
    }
    #[test]
    #[ignore = "slice director scenario; re-enable on the WFM host loop (ORKA-63bf.6)"]
    fn attacking_heroes_show_target_facing_in_seeded_combat_and_spotlights() {
        // ORKA-6jh1.76: flat enemy poison uses seed1 for all four Performing within the same18000 steps.
        let kinds = [Archetype::Hondo, Archetype::Fara, Archetype::Runa, Archetype::Kaja];
        let mut failed = false;
        for enabled in [false, true] {
            let mut sim = crate::testing::sim_with(SimConfig {
                seed: 1,
                spotlight: SpotlightConfig { enabled, auto_release: true, ..SpotlightConfig::DEFAULT },
                ..SimConfig::default()
            });
            let mut motion = Motion::new(sim.snapshot());
            let mut checked = [[0usize; 4]; 2];
            let mut performing_frames = [0usize; 4];
            let mut mismatches = [[0usize; 4]; 2];
            let mut sim_mismatches = [[0usize; 4]; 2];
            for _ in 0..18000 {
                motion.advance(&mut sim, SIM_DT);
                let s = sim.snapshot();
                let frame = motion.snapshot(&motion.presentation(s), 0.5);
                for (hero, kind) in kinds.iter().enumerate() {
                    let a = frame.actors.iter().find(|a| a.archetype == *kind).unwrap();
                    let performing = s.spotlight.as_ref().is_some_and(|v|
                        v.phase == SpotlightPhase::Performing && (v.caster == a.id || v.co_casters.contains(&a.id)));
                    if !matches!(a.state, ActorState::Basic | ActorState::Cast) && !a.special_casting && !performing { continue; }
                    let Some(target) = a.target.and_then(|id| frame.actors.iter().find(|t| t.id == id)) else { continue; };
                    let dx = target.pos.x - a.pos.x;
                    if dx.abs() <= 1. { continue; }
                    let mode = usize::from(s.spotlight.is_some());
                    checked[mode][hero] += 1;
                    performing_frames[hero] += usize::from(performing);
                    let expected = if dx < 0. { Facing::Left } else { Facing::Right };
                    if a.facing != expected {
                        mismatches[mode][hero] += 1;
                        if mismatches[mode][hero] <= 2 {
                            eprintln!("facing sample enabled={enabled} mode={mode} hero={kind:?} step={} state={:?} dx={dx:.2} shown={:?}",s.step,a.state,a.facing);
                        }
                    }
                    let raw = s.actors.iter().find(|raw| raw.id == a.id).unwrap();
                    let raw_target = s.actors.iter().find(|t| t.id == target.id).unwrap();
                    let raw_dx = raw_target.pos.x - raw.pos.x;
                    if raw_dx.abs() > 1. && raw.facing != if raw_dx < 0. { Facing::Left } else { Facing::Right } {
                        sim_mismatches[mode][hero] += 1;
                        if sim_mismatches[mode][hero] <= 3 {
                            eprintln!("SIM sample enabled={enabled} mode={mode} hero={kind:?} step={} state={:?} age={:.3}/{:.3} special={} hp={} target_hp={} dx={raw_dx:.2} facing={:?}",s.step,raw.state,raw.state_age,raw.state_duration,raw.special_casting,raw.hp,raw_target.hp,raw.facing);
                        }
                    }
                }
                sim.drain_events();
            }
            eprintln!("FACING enabled={enabled} heroes=Hondo,Fara,Runa,Kaja checked={checked:?} performing={performing_frames:?} shown_mismatches={mismatches:?} sim_mismatches={sim_mismatches:?}");
            assert!(checked[0].iter().all(|n| *n > 0));
            if enabled { assert!(performing_frames.iter().all(|n| *n > 0)); }
            failed |= mismatches != [[0; 4]; 2];
        }
        assert!(!failed, "shown facing disagrees with attack targets");
    }
    #[test]
    fn locomotion_facing_hold_advances_during_spotlight() {
        let mut s = crate::testing::sim().snapshot().clone();
        s.actors[0].state = ActorState::Walk;
        s.actors[0].facing = Facing::Left;
        s.spotlight = Some(SpotlightView {
            caster: s.actors[1].id, skill: Skill::Split, phase: SpotlightPhase::Performing,
            started: s.time, participants: vec![], co_casters: vec![],
            hazards: vec![], projectiles: vec![],
        });
        let mut motion = Motion::new(&s);
        s.actors[0].facing = Facing::Right;
        motion.observe(&s);
        s.time += 0.14;
        motion.observe(&s);
        assert_eq!(motion.snapshot(&s, 1.).actors[0].facing, Facing::Left);
        s.time += 0.02;
        motion.observe(&s);
        assert_eq!(motion.snapshot(&s, 1.).actors[0].facing, Facing::Right);
        assert_eq!(s.combat_time, 0.);
    }
    #[test]
    fn facing_requires_a_stable_candidate_for_150ms() {
        let sim = crate::testing::sim();
        let mut s = sim.snapshot().clone();
        let initial = s.actors[0].facing;
        let other = if initial == Facing::Left {
            Facing::Right
        } else {
            Facing::Left
        };
        let mut motion = Motion::new(&s);
        s.actors[0].facing = other;
        motion.observe(&s);
        s.time += 0.14;
        s.combat_time += 0.14;
        motion.observe(&s);
        assert_eq!(motion.snapshot(&s, 1.).actors[0].facing, initial);
        s.time += 0.02;
        s.combat_time += 0.02;
        motion.observe(&s);
        assert_eq!(motion.snapshot(&s, 1.).actors[0].facing, other);
    }
}
