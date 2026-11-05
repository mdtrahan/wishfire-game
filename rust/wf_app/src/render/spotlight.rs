//! Cinematic ownership and clocks. The sim alone owns damage and combat suspension.
use super::{actors::Corpses, vfx::Presentation};
use crate::{
    assets::{Assets, DrawStats, Manifest},
    camera::{WorldCamera, HEIGHT, WIDTH},
    clips,
};
use macroquad::prelude::*;
use wf_combat::api::{ActorState, Archetype, Event, Snapshot, SpotlightPhase, SpotlightView};

pub const CHARGE_SCRIM_IN: f64 = 0.15;
pub const SETTLE_HOLD: f64 = 0.25;
pub const SCRIM_OUT: f64 = 0.45;
pub const CAMERA_RETURN: f32 = 0.5;
const LAYER_DROP_ALPHA: f32 = 0.2;
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Phase {
    #[default]
    Idle,
    Charge,
    Performing,
    Tail,
    Settle,
    Release,
}
#[derive(Default)]
pub struct Director {
    pub phase: Phase,
    pub alpha: f32,
    pub count: u32,
    pub heroes: [u32; 4],
    pub wall_time: f64,
    pub view: Option<SpotlightView>,
    release_alpha: f32,
    release_age: f64,
    settle_started: Option<f64>,
    last_time: Option<f64>,
    cancelled: bool,
}
impl Director {
    pub fn update(&mut self, s: &Snapshot, wall_dt: f64) -> bool {
        let live_dt=self.last_time.map_or(0.,|old|(s.time-old).max(0.));
        self.last_time=Some(s.time);
        let fresh = s.spotlight.as_ref().is_some_and(|v| {
            self.view
                .as_ref()
                .is_none_or(|old| old.started != v.started || old.caster != v.caster)
        });
        if let Some(v) = &s.spotlight {
            if fresh {
                self.count += 1;
                self.settle_started = None;
                if let Some(a) = s.actors.iter().find(|a| a.id == v.caster) {
                    if let Some(i) = [
                        Archetype::Fara,
                        Archetype::Hondo,
                        Archetype::Runa,
                        Archetype::Kaja,
                    ]
                    .iter()
                    .position(|k| *k == a.archetype)
                    {
                        self.heroes[i] += 1;
                    }
                }
            }
            self.view = Some(v.clone());
            let t = ((s.time - v.started) / CHARGE_SCRIM_IN).clamp(0., 1.) as f32;
            self.alpha = 0.8 * (1. - (1. - t).powi(3));
            self.phase = match v.phase {
                SpotlightPhase::Charge => Phase::Charge,
                SpotlightPhase::Performing => Phase::Performing,
                SpotlightPhase::Tail if self.settle_started.is_some() => Phase::Settle,
                SpotlightPhase::Tail => Phase::Tail,
            };
            self.wall_time += wall_dt.max(0.);
        } else if self.phase != Phase::Idle {
            if self.phase != Phase::Release {
                self.begin_release();
                self.cancelled=true;
            }
            // OFF/cancel must clear darkness even while the game is paused.
            self.release_age += if self.cancelled {wall_dt.max(0.)} else {live_dt};
            self.alpha =
                self.release_alpha * (1. - ease((self.release_age / SCRIM_OUT).clamp(0., 1.) as f32));
            if self.alpha < LAYER_DROP_ALPHA { self.view = None; }
            if self.alpha <= 0. {
                self.phase = Phase::Idle;
                self.view = None;
            }
        }
        fresh
    }
    pub fn begin_release(&mut self) {
        self.release_alpha = self.alpha; self.release_age = 0.; self.phase = Phase::Release; self.cancelled=false;
    }
    pub fn scrim(&self) {
        if self.alpha > 0. {
            draw_rectangle(0., 0., WIDTH, HEIGHT, Color::new(0., 0., 0., self.alpha));
        }
    }
}
fn ease(t: f32) -> f32 {
    t * t * (3. - 2. * t)
}

/// Only explicit performers and enemy recipients join the attack spotlight.
pub fn highlighted(a: &wf_combat::ActorView, v: &SpotlightView) -> bool {
    a.id == v.caster || (a.team == wf_combat::Team::Hero && v.co_casters.contains(&a.id))
        || (a.team == wf_combat::Team::Enemy && v.participants.contains(&a.id))
}

/// Partition snapshot-owned items exactly once. Released skill hazards rejoin combat immediately.
pub fn frames(s: &Snapshot, elevated: Option<&SpotlightView>) -> (Snapshot, Snapshot) {
    let mut bg = s.clone();
    let mut spot = s.clone();
    bg.time = s.combat_time;
    bg.actors
        .retain(|a| !elevated.is_some_and(|v| highlighted(a, v)));
    spot.actors
        .retain(|a| elevated.is_some_and(|v| highlighted(a, v)));
    bg.hazards.retain(|h| {
        !s.spotlight
            .as_ref()
            .is_some_and(|v| v.hazards.contains(&h.id))
    });
    spot.hazards.retain(|h| {
        s.spotlight
            .as_ref()
            .is_some_and(|v| v.hazards.contains(&h.id))
    });
    bg.projectiles.retain(|p| !s.spotlight.as_ref().is_some_and(|v|v.projectiles.contains(&p.id)));
    spot.projectiles.retain(|p| s.spotlight.as_ref().is_some_and(|v|v.projectiles.contains(&p.id)));
    spot.chests.clear();
    (bg, spot)
}

/// Move records once, preserving order and their existing animation age.
pub(super) fn transfer<T>(from:&mut Vec<T>,to:&mut Vec<T>,mut select:impl FnMut(&T)->bool,mut retime:impl FnMut(&mut T)) {
    let mut i=0;
    while i<from.len() {
        if select(&from[i]) {let mut item=from.remove(i);retime(&mut item);to.push(item);} else {i+=1;}
    }
}
#[derive(Default)]
struct Package {
    charge: super::charge::Charge,
    pending: Vec<Event>,
    charge_hazards: std::collections::BTreeSet<u32>,
    hazard_starts: std::collections::BTreeMap<u32,f32>,
    performing: bool,
    view: Option<SpotlightView>,
    previous: Option<Snapshot>,
    effects: Presentation,
    corpses: Corpses,
    // Hurt is a client clip; actor clocks in the sim remain frozen in Tail.
    reactions: Vec<(u32, f64)>,
}
impl Package {
    fn observe_hazards(&mut self,s: &Snapshot,spot: &Snapshot) {
        if s.spotlight.as_ref().is_some_and(|v|v.phase==SpotlightPhase::Charge) {
            self.charge_hazards.extend(spot.hazards.iter().filter(|h|s.spotlight.as_ref().is_some_and(|v|h.owner==v.caster)).map(|h|h.id));
        } else if !self.performing && s.spotlight.is_some() {
            self.performing=true;
            for h in &spot.hazards {
                if self.charge_hazards.contains(&h.id) { self.hazard_starts.insert(h.id,h.progress); }
            }
        }
    }
    fn visual_hazards(&self,frame: &mut Snapshot) {
        if frame.spotlight.as_ref().is_some_and(|v|v.phase==SpotlightPhase::Charge) {
            frame.hazards.retain(|h|!frame.spotlight.as_ref().is_some_and(|v|h.owner==v.caster));
        } else {
            for h in &mut frame.hazards {
                if let Some(start)=self.hazard_starts.get(&h.id) {
                    h.progress=((h.progress-start)/(1.-start).max(f32::EPSILON)).clamp(0.,1.);
                }
            }
        }
    }
    fn react(&mut self, events: &[Event], time: f64) {
        self.reactions.retain(|(_, born)| time - born < 0.18);
        for e in events {
            if let Event::Hit { source, target, amount, .. } = e {
                if *amount > 0. {
                    self.reactions.retain(|(id, _)| id != target);
                    self.reactions.push((*target, self.effects.reaction_time(*source,*target,time).unwrap_or(time)));
                }
            }
        }
    }
    fn pose(&self, frame: &mut Snapshot) {
        for (id, born) in &self.reactions {
            if frame.time < *born {continue;}
            if let Some(a) = frame.actors.iter_mut().find(|a| a.id == *id && a.hp > 0.) {
                a.state = ActorState::Hurt;
                a.state_age = (frame.time - born) as f32;
                a.state_duration = 0.18;
                a.impact_at = 0.;
            }
        }
        self.effects.displace(frame);
        self.charge.pose(frame);
    }
    fn idle(&self, time: f64) -> bool {
        self.effects.idle(time) && self.corpses.idle() && self.reactions.is_empty()
    }
}
#[derive(Default)]
pub struct Spotlight {
    pub config: wf_combat::SpotlightConfig,
    pub director: Director,
    pub warning_timings: super::boss::WarningTimings,
    pub background_previous: Option<Snapshot>,
    current: Option<Package>,
    lingering: Vec<Package>,
}
impl Spotlight {
    pub fn ingest(
        &mut self,
        manifest: &Manifest,
        events: Vec<Event>,
        s: &Snapshot,
        previous: &Snapshot,
        background: &mut Presentation,
        bodies: &mut Corpses,
        wall_dt: f64,
    ) {
        let events = if let Some(i) = events.iter().rposition(|e| matches!(e, Event::SceneReset)) {
            let config=self.config; *self = Self::default(); self.config=config;
            *background = Presentation::default();
            *bodies = Corpses::default();
            events.into_iter().skip(i + 1).collect::<Vec<_>>()
        } else {
            events
        };
        let was_active = previous.spotlight.is_some();
        let fresh = self.director.update(s, wall_dt);
        if fresh {
            if let Some(mut old) = self.current.take() {
                let mut combat=s.clone();combat.time=s.combat_time;
                background.take_regen(&mut old.effects,s.time,&combat);
                background.take_boss(&mut old.effects,s.time,&combat);
                self.lingering.push(old);
            }
            self.current = Some(Package::default());
        }
        let (bg, mut spot) = frames(s, self.director.view.as_ref());
        let (old_bg, mut old_spot) = frames(previous, self.director.view.as_ref());
        if bg.time > old_bg.time || self.background_previous.is_none() {
            self.background_previous = Some(old_bg.clone());
        }
        // Include the initiating cast event, which can precede SpotlightBegan in its tick.
        let begin = events
            .iter()
            .position(|e| matches!(e, Event::SpotlightBegan { .. }));
        let caster = self.director.view.as_ref().map(|v| v.caster);
        let mut bg_events = Vec::new();
        let mut spot_events = Vec::new();
        let runa=s.actors.iter().find(|a|a.archetype==Archetype::Runa);
        let runa_foreground=runa.is_some_and(|a|self.director.view.as_ref().is_some_and(|v|highlighted(a,v)));
        let new_heal_targets: Vec<_>=events.iter().filter_map(|e| match e {
            Event::SkillStarted{id,skill:wf_combat::Skill::HealingSpring,target:Some(target)}
            | Event::ActionStarted{id,state:ActorState::Cast,target:Some(target)}
                if runa.is_some_and(|a|a.id==*id) && s.actors.iter().any(|a|a.id==*target && a.team==wf_combat::Team::Hero) => Some(*target),
            _ => None,
        }).collect();
        let mut routing = was_active;
        for (i, e) in events.into_iter().enumerate() {
            if begin == Some(i) {
                routing = true;
            }
            let initiating = begin.is_some_and(|b| i < b)
                && (matches!(&e,
                Event::ActionStarted { id, state: ActorState::Cast, .. } | Event::SkillStarted { id, .. } if Some(*id) == caster)
                || matches!(&e,Event::HazardSpawned{id,..} if self.director.view.as_ref().is_some_and(|v|v.hazards.contains(id)))
                || matches!(&e,Event::HazardCancelled{..}));
            let ended = matches!(e, Event::SpotlightEnded { .. });
            // Spring never starts a spotlight. Its cast and heal keep the caster's clock;
            // finished target effects move to the recipient's draw layer below.
            let heal_layer=match &e {
                Event::SkillStarted{skill:wf_combat::Skill::HealingSpring,..} => Some(runa_foreground),
                Event::ActionStarted{id,state:ActorState::Cast,target:Some(target)}
                    if runa.is_some_and(|a|a.id==*id) && new_heal_targets.contains(target) => Some(runa_foreground),
                Event::Healed{target,..} if new_heal_targets.contains(target) || background.heals_target(*target)
                    || self.current.as_ref().is_some_and(|p|p.effects.heals_target(*target)) => Some(runa_foreground),
                Event::Healed { target, .. } | Event::EnemyHealed { target, .. }
                | Event::Revived { id: target } => Some(s.actors.iter().any(|a| a.id == *target
                    && self.director.view.as_ref().is_some_and(|v| highlighted(a,v)))),
                _ => None,
            };
            if heal_layer.unwrap_or(routing || initiating) && self.current.is_some() {
                spot_events.push(e);
            } else {
                bg_events.push(e);
            }
            if ended {
                routing = false;
            }
        }
        let mut corpse_bg = s.clone();
        corpse_bg.time = s.combat_time;
        let mut corpse_old = previous.clone();
        corpse_old.time = previous.combat_time;
        bodies.ingest(&bg_events, &corpse_bg, &corpse_old);
        if let Some(p)=&mut self.current {
            background.take_regen(&mut p.effects,s.time,&bg);
            background.take_boss(&mut p.effects,s.time,&bg);
            p.effects.take_boss(background,bg.time,&spot);
            background.inherit_actor_effects(&p.effects,s.time,&bg);
            p.effects.inherit_actor_effects(background,bg.time,&spot);
        }
        background.boss_timings(&self.warning_timings);
        if let Some(p)=&mut self.current {p.effects.boss_timings(&self.warning_timings);}
        if bg.time > old_bg.time || !bg_events.is_empty() {
            background.ingest_context(bg_events, &bg, &old_bg, s, previous, Some(manifest));
        }
        bodies.delay(background);
        if let Some(p) = &mut self.current {
            p.effects.take_regen(background,bg.time,&spot);
            if let Some(view)=&s.spotlight {
                if fresh {
                    p.reactions.extend(p.effects.take_combo(background,view,s,bg.time,s.time));
                    p.corpses.take_combo(bodies,view,s.time-bg.time);
                }
                else if view.phase==SpotlightPhase::Charge {
                    let delta=(s.time-previous.time).max(0.);
                    p.effects.pause_combo(view,s,delta);p.corpses.pause(delta);
                    for (_,born) in &mut p.reactions {*born+=delta;}
                }
            }
            p.observe_hazards(s,&spot);
            p.visual_hazards(&mut spot);
            p.visual_hazards(&mut old_spot);
            p.previous = Some(old_spot.clone());
            p.charge.observe(s, s.spotlight.as_ref(), self.config.charge);
            if s.spotlight.as_ref().is_some_and(|v|v.phase==SpotlightPhase::Charge) {
                let (immediate,mut pending): (Vec<_>,Vec<_>)=spot_events.into_iter().partition(|e|matches!(e,Event::HazardCancelled{..}));
                p.pending.append(&mut pending);spot_events=immediate;
            } else if s.spotlight.is_some() {
                let mut pending=std::mem::take(&mut p.pending);pending.append(&mut spot_events);spot_events=pending;
            } else { p.pending.clear(); }

            if s.spotlight.is_some() { p.view = s.spotlight.clone(); }
            // A cancelled boss warning belongs to combat, but its decay must use live time.
            // Cache its old footprint for ingestion only; it never joins the foreground snapshot.
            for e in &spot_events {
                if let Event::HazardCancelled{id,..}=e {
                    if !old_spot.hazards.iter().any(|h|h.id==*id) {
                        if let Some(h)=background.cached_hazard(*id).or_else(||previous.hazards.iter().find(|h|h.id==*id).cloned()) {old_spot.hazards.push(h);}
                    }
                }
            }
            p.corpses.ingest(&spot_events, s, previous);
            p.effects.ingest_context(spot_events.clone(), &spot, &old_spot, s, previous, Some(manifest));
            p.corpses.delay(&p.effects);
            p.corpses.update(manifest, &spot);
            p.react(&spot_events, s.time);
            p.corpses.displace(&p.effects, s.time);
        }
        let mut empty = s.clone();
        empty.actors.clear();
        empty.hazards.clear();
        empty.projectiles.clear();
        empty.chests.clear();
        for p in &mut self.lingering {
            p.effects.ingest(Vec::new(), &empty, &empty);
            p.react(&[], s.time);
            p.corpses.update(manifest, &empty);
        }
        if let Some(p)=&mut self.current {
            background.take_heals(&mut p.effects,s.time,&bg);
            p.effects.take_heals(background,bg.time,&spot);
        }
        self.lingering.retain(|p| !p.idle(s.time));
        if self.director.phase == Phase::Idle
            && self.current.as_ref().is_some_and(|p| p.idle(s.time))
        {
            self.current = None;
        }
    }
    pub fn ready(&mut self, manifest: &Manifest, s: &Snapshot) -> bool {
        let Some(v) = s
            .spotlight
            .as_ref()
            .filter(|v| v.phase == SpotlightPhase::Tail)
        else {
            self.director.settle_started = None;
            return false;
        };
        let casting = s.actors.iter().find(|a| a.id == v.caster).is_some_and(|a| {
            if a.state != ActorState::Cast {
                return false;
            }
            let duration = if a.state_duration > 0. {
                a.state_duration
            } else {
                manifest
                    .actors
                    .get(&format!("{:?}", a.archetype))
                    .and_then(|art| art.clips.get("cast"))
                    .map(|c| clips::duration(&c.frames) / 1000.)
                    .unwrap_or(0.4)
            };
            a.state_age < duration
        });
        let complete = !casting && self.current.as_ref().is_none_or(|p| {
            !p.effects.busy(s.time) && !p.charge.busy(s.time)
                && !p.corpses.busy(manifest, s.time) && p.reactions.is_empty()
        });
        if !complete { self.director.settle_started=None; self.director.phase=Phase::Tail; return false; }
        let began=*self.director.settle_started.get_or_insert(s.time);
        self.director.phase=Phase::Settle;
        s.time-began>=SETTLE_HOLD
    }

    #[cfg(target_arch="wasm32")]
    pub fn boss_push_record(&self,time:f64) {
        if self.director.view.is_some() {if let Some(p)=&self.current {p.effects.boss_push_record(time);}}
    }
    pub fn camera_dip(&self,s:&Snapshot)->f32 {
        self.current.as_ref().map_or(0.,|p| {
            let (_,mut spot)=frames(s,p.view.as_ref());p.visual_hazards(&mut spot);
            super::pound::camera_dip(&spot)
        })
    }
    pub fn pound_shake(&self,time:f64)->Vec2 {self.current.as_ref().map_or(Vec2::ZERO,|p|p.effects.pound_shake(time))}
    pub fn shake(&self) -> Option<(f64, f32, f32)> {
        self.current.as_ref().and_then(|p| p.effects.shake)
    }
    /// Merge only visible ground bodies for the background actor pass. Package clocks stay intact.
    pub fn ground_bodies(&self, frame: &Snapshot, background: &Corpses) -> Corpses {
        let mut bodies = background.clone();
        if let Some(p) = &self.current {
            let (_, mut spot) = frames(frame, p.view.as_ref());
            p.pose(&mut spot);
            if self.director.view.is_none() { spot.actors.clear(); }
            bodies.include_ground(&spot, &p.corpses, frame.combat_time);
        }
        let mut residual = frame.clone();
        residual.actors.clear();
        for p in &self.lingering {
            bodies.include_ground(&residual, &p.corpses, frame.combat_time);
        }
        bodies
    }
    /// Each team joins the global bar pass, including lingering package corpses.
    pub fn bars(&self, assets: &Assets, camera: &WorldCamera, frame: &Snapshot, team: wf_combat::Team, stats: &mut DrawStats) {
        if let Some(p) = &self.current {
            let (_, mut spot) = frames(frame, p.view.as_ref());
            p.pose(&mut spot);
            if self.director.view.is_none() { spot.actors.clear(); }
            super::actors::bars(assets, camera, &spot, &p.corpses, &p.effects.held, team, stats);
        }
        for p in &self.lingering {
            let (_, mut residual) = frames(frame, p.view.as_ref());
            residual.actors.clear();
            super::actors::bars(assets, camera, &residual, &p.corpses, &p.effects.held, team, stats);
        }
    }
    pub fn draw(
        &self,
        assets: &Assets,
        camera: &WorldCamera,
        frame: &Snapshot,
        reduced: bool,
        revival: &super::phoenix::Revival,
        cast_glows: &super::groove::CastGlows,
        heal_auras: &super::healing::TargetAuras,
        shell: &super::enemy_status::WarcryShell,
        poison: &super::poison::PoisonTint,
        cast_hue: &super::cast_hue::CastHue,
        stats: &mut DrawStats,
    ) {
        self.director.scrim();
        if let Some(p) = &self.current {
            let (_, mut spot) = frames(frame, p.view.as_ref());
            p.visual_hazards(&mut spot);
            p.pose(&mut spot);
            if self.director.phase == Phase::Settle {
                if let Some(v)=&self.director.view { if let Some(a)=spot.actors.iter_mut().find(|a|a.id==v.caster&&a.state==ActorState::Idle) {
                    a.state_age += (spot.time-self.director.settle_started.unwrap_or(spot.time)).max(0.) as f32;
                }}
            }
            draw_package(p, assets, camera, &spot, self.director.view.is_some(), reduced, cast_glows, heal_auras, super::elevate::Elevate::from_snapshot(frame), shell, poison, cast_hue, stats);
            if self.director.view.is_some() {revival.effects(assets,camera,&spot,reduced,stats);}
        }
        for p in &self.lingering {
            let (_, mut residual) = frames(frame, p.view.as_ref());
            residual.hazards.clear();
            draw_package(p, assets, camera, &residual, false, reduced, cast_glows, heal_auras, super::elevate::Elevate::from_snapshot(frame), shell, poison, cast_hue, stats);
        }
    }
}
fn draw_package(
    p: &Package,
    assets: &Assets,
    camera: &WorldCamera,
    s: &Snapshot,
    elevated: bool,
    reduced: bool,
    cast_glows: &super::groove::CastGlows,
    heal_auras: &super::healing::TargetAuras,
    elevate: super::elevate::Elevate,
    shell: &super::enemy_status::WarcryShell,
    poison: &super::poison::PoisonTint,
    cast_hue: &super::cast_hue::CastHue,
    stats: &mut DrawStats,
) {
    p.effects
        .ground(assets, camera, s, p.previous.as_ref().unwrap_or(s), stats);
    p.effects
        .hostile(assets, camera, s, p.previous.as_ref().unwrap_or(s), stats);
    p.effects.under_actors(assets, camera, s, shell, stats);
    p.charge.ground(assets, camera, s, stats);
    super::actors::ornaments(assets, camera, s, &p.corpses, stats);
    if elevated {p.charge.draw_under(assets,camera,s,reduced,stats);}
    // Package corpses draw exactly once in the background ground-body pass.
    let mut standing = s.clone();
    standing.actors.retain(|a| elevated && !super::actors::ground_actor(a));
    super::actors::draw(assets, camera, &standing, &Corpses::default(), &p.effects.held, &p.effects.projectiles, cast_glows, heal_auras, shell, elevate, poison, cast_hue, None, stats);
    if elevated { p.charge.draw_flash(assets, camera, s, reduced, stats); }
    p.effects.impacts(assets, camera, s, elevated, reduced, stats);
    p.effects.labels(assets, camera, s, stats);
}

#[cfg(test)]
mod tests {
    use super::*;
    use wf_combat::{Sim, SimConfig, Skill};
    fn scene() -> Snapshot {
        crate::testing::sim().snapshot().clone()
    }
    fn start(s: &mut Snapshot) {
        s.spotlight = Some(SpotlightView {
            caster: s.actors[0].id,
            skill: Skill::CrimsonWard,
            phase: SpotlightPhase::Performing,
            started: s.time,
            participants: vec![s.actors[0].id, s.actors[1].id],
            hazards: vec![], co_casters: vec![], projectiles: vec![],
        });
    }
    #[test]
    fn spotlight_and_lingering_bodies_draw_below_background_heroes() {
        let mut s = scene();
        s.time = 20.; s.combat_time = 1.;
        start(&mut s);
        let mut body = s.actors[0].clone();
        body.id = 999; body.team = wf_combat::Team::Enemy; body.archetype = Archetype::Gobloc;
        body.state = ActorState::Dead; body.hp = 0.; body.pos.y = 200.;
        s.actors.push(body);
        s.spotlight.as_mut().unwrap().participants.push(999);
        s.actors[0].state = ActorState::Downed; s.actors[0].hp = 0.; s.actors[0].pos.y = 150.;
        s.actors[1].pos.y = 100.;
        let mut p = Package { view: s.spotlight.clone(), ..Default::default() };
        p.corpses.ingest(&[Event::Died { id: 999 }], &s, &s);
        let mut spotlight = Spotlight::default();
        spotlight.director.view = s.spotlight.clone();
        spotlight.current = Some(p);
        let bodies = spotlight.ground_bodies(&s, &Corpses::default());
        let (bg, _) = frames(&s, spotlight.director.view.as_ref());
        let ids: Vec<_> = super::super::actors::ordered_actors(&bg, &bodies).iter().map(|a| a.id).collect();
        assert_eq!(&ids[..2], &[s.actors[0].id, 999]);
        assert_eq!(ids.iter().filter(|&&id| id == 999).count(), 1);
        assert_eq!(ids.iter().filter(|&&id| id == s.actors[0].id).count(), 1);
        assert!(ids.iter().position(|&id| id == 999) < ids.iter().position(|&id| id == s.actors[1].id));
        spotlight.lingering.push(spotlight.current.take().unwrap());
        spotlight.director.view = None;
        let bodies = spotlight.ground_bodies(&s, &Corpses::default());
        let ids: Vec<_> = super::super::actors::ordered_actors(&bg, &bodies).iter().map(|a| a.id).collect();
        assert_eq!(ids[0], 999);
        assert_eq!(ids.iter().filter(|&&id| id == 999).count(), 1);
        s.time = 19.; // Future-born Shadow corpses must stay hidden on their owning clock.
        let bodies = spotlight.ground_bodies(&s, &Corpses::default());
        assert!(bodies.idle());
    }
    fn manifest() -> Manifest {
        Manifest {
            arenas: vec![],
            pages: vec![],
            actors: Default::default(),
        }
    }
    fn combo_scene() -> Snapshot {
        let mut s=scene();start(&mut s);
        let caster=s.actors[0].id;let co=s.actors[3].id;
        let mut enemy=s.actors[0].clone();enemy.id=999;enemy.team=wf_combat::Team::Enemy;s.actors.push(enemy);
        let v=s.spotlight.as_mut().unwrap();v.caster=caster;v.co_casters=vec![co];
        v.participants=vec![caster,999,s.actors[1].id];v.projectiles=vec![800];v.hazards=vec![900,901];
        s.projectiles=(800..802).map(|id|wf_combat::ProjectileView{id,kind:wf_combat::ProjectileKind::Orb,
            pos:s.actors[0].pos,height:25.,team:wf_combat::Team::Hero,dir:wf_combat::Vec2::new(1.,0.)}).collect();
        s.hazards=(900..903).map(|id|wf_combat::HazardView{id,kind:wf_combat::HazardKind::ArcanePulse,
            team:wf_combat::Team::Hero,hostile:false,shape:wf_combat::Shape::Circle{radius:95.},origin:s.actors[0].pos,
            dir:wf_combat::Vec2::new(1.,0.),fill:wf_combat::FillMode::Countdown,phase:wf_combat::HazardPhase::Locked,
            progress:0.4,width_scale:1.,owner:if id==900{caster}else{co},tier:1}).collect();s
    }
    #[test]
    fn combo_lifts_only_explicit_actors_projectiles_and_hazards_exactly_once() {
        let s=combo_scene();let v=s.spotlight.as_ref().unwrap();let (bg,fg)=frames(&s,Some(v));
        assert_eq!(fg.actors.iter().map(|a|a.id).collect::<Vec<_>>(),vec![v.caster,v.co_casters[0],999]);
        assert!(bg.actors.iter().any(|a|a.id==s.actors[1].id),"an ally in participants stays below");
        assert_eq!(fg.projectiles.iter().map(|p|p.id).collect::<Vec<_>>(),vec![800]);
        assert_eq!(bg.projectiles.iter().map(|p|p.id).collect::<Vec<_>>(),vec![801]);
        assert_eq!(fg.hazards.iter().map(|h|h.id).collect::<Vec<_>>(),vec![900,901]);
        assert_eq!(bg.hazards.iter().map(|h|h.id).collect::<Vec<_>>(),vec![902]);
        for a in &s.actors {assert_eq!(bg.actors.iter().chain(&fg.actors).filter(|x|x.id==a.id).count(),1);}
        for p in &s.projectiles {assert_eq!(bg.projectiles.iter().chain(&fg.projectiles).filter(|x|x.id==p.id).count(),1);}
        for h in &s.hazards {assert_eq!(bg.hazards.iter().chain(&fg.hazards).filter(|x|x.id==h.id).count(),1);}
    }
    #[test]
    fn charge_preserves_prior_combo_progress_and_frozen_basic_but_echoes_only_featured() {
        let mut s=combo_scene();s.spotlight.as_mut().unwrap().phase=SpotlightPhase::Charge;
        let co=s.spotlight.as_ref().unwrap().co_casters[0];
        let a=s.actors.iter_mut().find(|a|a.id==co).unwrap();a.state=ActorState::Basic;a.state_age=0.17;
        let mut p=Package::default();let (_,mut fg)=frames(&s,s.spotlight.as_ref());
        p.observe_hazards(&s,&fg);p.visual_hazards(&mut fg);p.charge.observe(&s,s.spotlight.as_ref(),1.2);p.pose(&mut fg);
        assert_eq!(fg.hazards.iter().map(|h|(h.id,h.progress)).collect::<Vec<_>>(),vec![(901,0.4)]);
        assert_eq!(fg.actors.iter().find(|a|a.id==co).map(|a|(a.state,a.state_age)),Some((ActorState::Basic,0.17)));
        assert_eq!(fg.actors.iter().find(|a|a.id==s.spotlight.as_ref().unwrap().caster).unwrap().state_age,0.);
        s.time+=1.2;s.spotlight.as_mut().unwrap().phase=SpotlightPhase::Performing;
        let (_,mut fg)=frames(&s,s.spotlight.as_ref());p.observe_hazards(&s,&fg);p.visual_hazards(&mut fg);
        p.charge.observe(&s,s.spotlight.as_ref(),1.2);p.pose(&mut fg);
        assert_eq!(fg.hazards.iter().map(|h|(h.id,h.progress)).collect::<Vec<_>>(),vec![(900,0.),(901,0.4)]);
        assert_eq!(fg.actors.iter().find(|a|a.id==co).unwrap().state_age,0.17);
    }
    #[test]
    fn calm_exit_uses_sim_tail_with_paused_hondo_bar_and_releases_when_sim_ends() {
        let mut s=combo_scene();let mut live=Spotlight::default();
        for a in &mut s.actors {a.state=ActorState::Idle;}
        let hondo=s.actors.iter().position(|a|a.archetype==Archetype::Hondo).unwrap();
        s.actors[hondo].meter=1.;s.actors[hondo].groove_active=4.;
        s.time=10.;assert!(!live.ready(&manifest(),&s));s.time+=10.;assert!(!live.ready(&manifest(),&s));
        assert!(live.director.settle_started.is_none(),"captured attacks still own Performing");
        s.spotlight.as_mut().unwrap().phase=SpotlightPhase::Tail;
        assert!(!live.ready(&manifest(),&s));assert_eq!(live.director.phase,Phase::Settle);
        s.time+=SETTLE_HOLD+0.001;assert!(live.ready(&manifest(),&s));
        live.director.update(&s,0.);
        s.spotlight=None;s.actors[hondo].meter=0.9;s.actors[hondo].groove_active=3.6;
        s.time+=0.033;s.combat_time+=0.033;
        live.director.update(&s,0.033);
        assert_eq!(live.director.phase,Phase::Release);
        assert!(!live.ready(&manifest(),&s));
        assert!(live.director.settle_started.is_none());
    }
    #[test]
    fn cancelled_background_warning_decays_live_even_during_charge() {
        use wf_combat::{HazardView,HazardKind,HazardPhase,Shape,Team,FillMode,Vec2};
        let m=manifest();let mut old=scene();
        old.hazards.push(HazardView{id:900,kind:HazardKind::BossSlam,team:Team::Enemy,hostile:true,shape:Shape::Circle{radius:100.},origin:Vec2::new(500.,500.),dir:Vec2::new(1.,0.),fill:FillMode::Countdown,phase:HazardPhase::Locked,progress:0.5,width_scale:1.,owner:999,tier:1});
        let mut s=old.clone();s.time+=1.;start(&mut s);s.spotlight.as_mut().unwrap().phase=SpotlightPhase::Charge;s.hazards.retain(|h|h.id!=900);
        let caster=s.spotlight.as_ref().unwrap().caster;let mut live=Spotlight::default();let mut bg=Presentation::default();let mut bodies=Corpses::default();
        live.ingest(&m,vec![Event::HazardCancelled{id:900,kind:HazardKind::BossSlam},Event::SpotlightBegan{caster,skill:Skill::GroundPound}],&s,&old,&mut bg,&mut bodies,0.);
        assert!(live.current.as_ref().unwrap().effects.busy(s.time));assert!(!bg.busy(s.combat_time));
        let previous=s.clone();s.time+=0.13;live.ingest(&m,vec![],&s,&previous,&mut bg,&mut bodies,0.13);
        assert_eq!(s.combat_time,previous.combat_time);assert_eq!(live.director.phase,Phase::Charge);
        assert!(!live.current.as_ref().unwrap().effects.busy(s.time));
    }
    #[test]
    fn triggering_cast_and_hazard_are_hidden_through_charge_and_start_fresh() {
        use wf_combat::{HazardView,HazardKind,HazardPhase,Shape,Team,FillMode,Vec2};
        let m=manifest();let mut old=scene();old.time=2.;old.combat_time=2.;let caster=old.actors[0].id;
        let mut s=old.clone();start(&mut s);let v=s.spotlight.as_mut().unwrap();v.skill=Skill::BubblePop;v.phase=SpotlightPhase::Charge;v.hazards=vec![900];
        s.hazards.push(HazardView{id:900,kind:HazardKind::BubblePop,team:Team::Hero,hostile:false,shape:Shape::Circle{radius:140.},origin:Vec2::new(450.,400.),dir:Vec2::new(1.,0.),fill:FillMode::Countdown,phase:HazardPhase::Locked,progress:0.2,width_scale:1.,owner:caster,tier:1});
        let mut live=Spotlight::default();let mut bg=Presentation::default();let mut bodies=Corpses::default();
        live.ingest(&m,vec![Event::SkillStarted{id:caster,skill:Skill::BubblePop,target:None},Event::HazardSpawned{id:900,kind:HazardKind::BubblePop},Event::SpotlightBegan{caster,skill:Skill::BubblePop}],&s,&old,&mut bg,&mut bodies,0.);
        assert_eq!(bg.bubble_records(),0);let p=live.current.as_ref().unwrap();assert_eq!(p.effects.bubble_records(),0);assert_eq!(p.pending.len(),3);
        let (background,mut foreground)=frames(&s,s.spotlight.as_ref());p.visual_hazards(&mut foreground);
        assert!(!background.hazards.iter().any(|h|h.id==900));assert!(foreground.hazards.is_empty());
        old=s.clone();s.time+=1.2;s.spotlight.as_mut().unwrap().phase=SpotlightPhase::Performing;
        live.ingest(&m,vec![],&s,&old,&mut bg,&mut bodies,1.2);
        let p=live.current.as_ref().unwrap();let (_,mut foreground)=frames(&s,s.spotlight.as_ref());p.visual_hazards(&mut foreground);
        assert_eq!(foreground.hazards.iter().find(|h|h.id==900).unwrap().progress,0.);
        assert_eq!(p.effects.bubble_records(),1);assert_eq!(bg.bubble_records(),0);
        let h=s.hazards.iter_mut().find(|h|h.id==900).unwrap();h.progress=0.6;
        let (_,mut foreground)=frames(&s,s.spotlight.as_ref());p.visual_hazards(&mut foreground);
        assert!((foreground.hazards.iter().find(|h|h.id==900).unwrap().progress-0.5).abs()<0.001);
        // Ordinary play keeps the authoritative progress unchanged.
        s.spotlight=None;assert_eq!(frames(&s,None).0.hazards.iter().find(|h|h.id==900).unwrap().progress,0.6);
    }
    #[test]
    fn charge_perform_settle_release_timeline_and_late_layer_drop() {
        let m=manifest();let mut s=scene();start(&mut s);s.spotlight.as_mut().unwrap().phase=SpotlightPhase::Charge;
        let mut live=Spotlight::default();let mut bg=Presentation::default();let mut bodies=Corpses::default();let old=s.clone();
        live.ingest(&m,vec![Event::SkillStarted {id:s.actors[0].id,skill:Skill::ArcanePulse,target:None}],&s,&old,&mut bg,&mut bodies,0.);
        assert_eq!(live.director.phase,Phase::Charge);assert_eq!(live.current.as_ref().unwrap().pending.len(),1);
        assert!(!live.ready(&m,&s));s.time+=0.6;s.spotlight.as_mut().unwrap().phase=SpotlightPhase::Performing;
        live.ingest(&m,vec![],&s,&old,&mut bg,&mut bodies,0.6);assert_eq!(live.director.phase,Phase::Performing);assert!(live.current.as_ref().unwrap().pending.is_empty());
        s.time+=0.5;s.spotlight.as_mut().unwrap().phase=SpotlightPhase::Tail;
        live.ingest(&m,vec![],&s,&old,&mut bg,&mut bodies,0.5);assert!(!live.ready(&m,&s));assert_eq!(live.director.phase,Phase::Settle);
        s.time+=SETTLE_HOLD-0.01;assert!(!live.ready(&m,&s));s.time+=0.02;assert!(live.ready(&m,&s));
        live.director.update(&s,0.);s.spotlight=None;live.director.begin_release();
        live.director.update(&s,0.1);assert_eq!(live.director.alpha,0.8); // A paused normal release holds presentation.
        s.time+=SCRIM_OUT*0.5;live.director.update(&s,0.001);
        assert!(live.director.alpha>0.2&&live.director.view.is_some());
        s.time+=SCRIM_OUT*0.3;live.director.update(&s,0.001);assert!(live.director.alpha<0.2&&live.director.view.is_none());
        s.time+=SCRIM_OUT;live.director.update(&s,0.001);assert_eq!(live.director.phase,Phase::Idle);
    }
    #[test]
    fn defensive_ally_participant_stays_under_scrim() {
        let mut s = scene(); start(&mut s);
        let caster = s.actors[0].id; let ally = s.actors[1].id;
        let mut enemy = s.actors[0].clone(); enemy.id = 999; enemy.team = wf_combat::Team::Enemy;
        s.actors.push(enemy); s.spotlight.as_mut().unwrap().participants.push(999);
        let (bg, spot) = frames(&s, s.spotlight.as_ref());
        assert!(bg.actors.iter().any(|a| a.id == ally));
        assert!(!spot.actors.iter().any(|a| a.id == ally));
        assert_eq!(spot.actors.iter().map(|a| a.id).collect::<Vec<_>>(), vec![caster, 999]);
    }
    #[test]
    fn runa_heal_follows_the_recipient_across_spotlight_layers() {
        let m=manifest();let mut s=scene();s.time=10.;s.combat_time=4.;
        let mut old=s.clone();let runa=s.actors[2].id;let target=s.actors[0].id;
        let mut live=Spotlight::default();let mut bg=Presentation::default();let mut bodies=Corpses::default();
        let cast=Event::SkillStarted{id:runa,skill:Skill::HealingSpring,target:Some(target)};
        live.ingest(&m,vec![cast],&s,&old,&mut bg,&mut bodies,0.);
        assert!(bg.heals_target(target));
        old=s.clone();s.time+=0.05;s.combat_time+=0.05;start(&mut s);
        live.ingest(&m,vec![Event::Healed {target,amount:10., source: wf_combat::HealSource::HealingSpring }],&s,&old,&mut bg,&mut bodies,0.05);
        assert!(!bg.heals_target(target));
        assert!(!bg.busy(s.combat_time));assert!(live.current.as_ref().unwrap().effects.busy(s.time));
        old=s.clone();s.spotlight=None;
        live.ingest(&m,vec![],&s,&old,&mut bg,&mut bodies,0.);
        s.time+=1.;live.ingest(&m,vec![],&s,&old,&mut bg,&mut bodies,1.);
        assert!(bg.busy(s.combat_time),"recipient's one-shots return to the frozen combat clock");
    }
    #[test]
    fn enemy_and_passive_heals_use_the_recipient_layer_and_survive_clock_handoffs() {
        for foreground in [false, true] {
            let m = manifest(); let mut s = scene(); s.time = 10.; s.combat_time = 4.;
            let old = s.clone(); start(&mut s);
            let mut healer = s.actors[0].clone(); healer.id = 90;
            healer.team = wf_combat::Team::Enemy; healer.archetype = Archetype::Marid;
            let mut target = healer.clone(); target.id = 91; target.archetype = Archetype::Orc;
            s.actors.extend([healer, target]);
            if foreground { s.spotlight.as_mut().unwrap().participants.push(91); }
            let mut live = Spotlight::default(); let mut bg = Presentation::default(); let mut bodies = Corpses::default();
            live.ingest(&m, vec![Event::EnemyHealed { healer:90, target:91, amount:10. },
                Event::Healed { target:91, amount:10., source: wf_combat::HealSource::EnemyHeal }], &s, &old, &mut bg, &mut bodies, 0.);
            assert_eq!(bg.popups.len(), usize::from(!foreground));
            assert_eq!(live.current.as_ref().unwrap().effects.popups.len(), usize::from(foreground));
            assert_eq!(bg.busy(s.combat_time), !foreground);
            assert_eq!(live.current.as_ref().unwrap().effects.busy(s.time), foreground);
            let old = s.clone(); s.time += 0.5;
            live.ingest(&m, vec![], &s, &old, &mut bg, &mut bodies, 0.5);
            assert_eq!(bg.busy(s.combat_time), !foreground);
            let old = s.clone(); s.spotlight = None;
            live.ingest(&m, vec![], &s, &old, &mut bg, &mut bodies, 0.);
            s.time += 1.; live.ingest(&m, vec![], &s, &old, &mut bg, &mut bodies, 1.);
            assert!(bg.busy(s.combat_time));
            let old = s.clone(); s.combat_time += 3.21; s.time += 3.21;
            live.ingest(&m, vec![], &s, &old, &mut bg, &mut bodies, 0.);
            assert!(!bg.busy(s.combat_time));
        }
    }
    #[test]
    fn arcane_pulse_tail_waits_for_the_live_burst_and_releases() {
        let m = manifest();
        let mut s=scene();let previous=s.clone();
        let caster=s.actors.iter().find(|a|a.archetype==Archetype::Kaja).unwrap().id;
        s.spotlight=Some(SpotlightView{caster,skill:Skill::ArcanePulse,phase:SpotlightPhase::Performing,
            started:s.time,participants:vec![],co_casters:vec![],hazards:vec![900],projectiles:vec![]});
        s.hazards.push(wf_combat::HazardView{id:900,kind:wf_combat::HazardKind::ArcanePulse,
            team:wf_combat::Team::Hero,hostile:true,shape:wf_combat::Shape::Circle{radius:100.},origin:s.actors[3].pos,
            dir:wf_combat::Vec2::new(1.,0.),fill:wf_combat::FillMode::Countdown,phase:wf_combat::HazardPhase::Locked,
            progress:0.4,width_scale:1.,owner:caster,tier:1});
        let mut live=Spotlight::default();let mut bg=Presentation::default();let mut bodies=Corpses::default();
        live.ingest(&m,vec![Event::SkillStarted{id:caster,skill:Skill::ArcanePulse,target:None}],
            &s,&previous,&mut bg,&mut bodies,1./30.);
        let (_,foreground)=frames(&s,s.spotlight.as_ref());assert_eq!(foreground.hazards.len(),1);
        assert!(!live.ready(&m,&s));
        let previous=s.clone();s.time+=1.;s.spotlight.as_mut().unwrap().phase=SpotlightPhase::Tail;
        s.hazards[0].phase=wf_combat::HazardPhase::Resolved;
        live.ingest(&m,vec![Event::HazardResolved{id:900,kind:wf_combat::HazardKind::ArcanePulse,victims:vec![]}],
            &s,&previous,&mut bg,&mut bodies,1./30.);
        assert!(live.current.as_ref().unwrap().effects.busy(s.time));assert!(!live.ready(&m,&s));
        let previous=s.clone();s.time+=crate::render::arcane::BURST_SECONDS+0.01;
        live.ingest(&m,vec![],&s,&previous,&mut bg,&mut bodies,1./30.);
        assert!(!live.current.as_ref().unwrap().effects.busy(s.time));assert!(!live.ready(&m,&s));
        s.time+=SETTLE_HOLD+0.01;assert!(live.ready(&m,&s));
        let previous=s.clone();s.spotlight=None;live.director.begin_release();
        live.ingest(&m,vec![],&s,&previous,&mut bg,&mut bodies,1./30.);
        assert_eq!(live.director.phase,Phase::Release);
    }
    #[test]
    fn off_fades_while_presentation_clock_is_paused() {
        let mut s = scene();
        start(&mut s);
        let mut d = Director::default();
        d.update(&s, 0.);
        s.time += 0.2;
        d.update(&s, 0.2);
        assert_eq!(d.alpha, 0.8);
        s.spotlight = None;
        d.update(&s, 0.05);
        assert!(d.alpha < 0.8);
        d.update(&s, SCRIM_OUT);
        assert_eq!(d.alpha, 0.);
        assert_eq!(d.phase, Phase::Idle);
    }
    #[test]
    fn hazards_partition_once_and_persistent_hazards_return_after_release() {
        use wf_combat::{FillMode, HazardKind, HazardPhase, HazardView, Shape, Team, Vec2};
        let mut s = scene();
        start(&mut s);
        let h = HazardView {
            id: 500,
            kind: HazardKind::FazePool,
            team: Team::Hero,
            hostile: true,
            shape: Shape::Circle { radius: 100. },
            origin: Vec2::new(0., 0.),
            dir: Vec2::new(1., 0.),
            fill: FillMode::Drain,
            phase: HazardPhase::Active,
            progress: 0.5,
            width_scale: 1.,
            owner: s.actors[0].id,
            tier: 0,
        };
        let mut other = h.clone();
        other.id = 501;
        s.hazards = vec![h, other];
        s.spotlight.as_mut().unwrap().hazards.push(500);
        let (bg, spot) = frames(&s, s.spotlight.as_ref());
        assert_eq!(
            bg.hazards.iter().map(|h| h.id).collect::<Vec<_>>(),
            vec![501]
        );
        assert_eq!(
            spot.hazards.iter().map(|h| h.id).collect::<Vec<_>>(),
            vec![500]
        );
        let retained = s.spotlight.take();
        let (bg, spot) = frames(&s, retained.as_ref());
        assert_eq!(bg.hazards.len(), 2);
        assert!(spot.hazards.is_empty());
        for a in &s.actors {
            assert_eq!(
                bg.actors
                    .iter()
                    .chain(&spot.actors)
                    .filter(|b| b.id == a.id)
                    .count(),
                1
            );
        }
    }
    #[test]
    fn tail_waits_for_package_and_ko_then_releases_without_waiting_for_labels() {
        let mut s = scene();
        start(&mut s);
        s.spotlight.as_mut().unwrap().phase = SpotlightPhase::Tail;
        let mut live = Spotlight::default();
        let mut bg = Presentation::default();
        let mut bodies = Corpses::default();
        let m = manifest();
        let old = s.clone();
        live.ingest(
            &m,
            vec![
                Event::SpotlightBegan {
                    caster: s.actors[0].id,
                    skill: Skill::CrimsonWard,
                },
                Event::WardGained {
                    target: s.actors[0].id,
                    amount: 10.,
                },
            ],
            &s,
            &old,
            &mut bg,
            &mut bodies,
            0.,
        );
        assert!(!live.ready(&m, &s));
        s.time += 0.3;
        live.ingest(&m, vec![], &s, &old, &mut bg, &mut bodies, 0.3);
        assert!(!live.ready(&m, &s));
        assert_eq!(live.director.phase, Phase::Settle);
        s.time += SETTLE_HOLD + 0.01;
        live.ingest(&m, vec![], &s, &old, &mut bg, &mut bodies, SETTLE_HOLD + 0.01);
        assert!(live.ready(&m, &s));
        let mut enemy = s.actors[0].clone();
        enemy.id = 500;
        enemy.team = wf_combat::Team::Enemy;
        enemy.archetype = Archetype::Gobloc;
        enemy.hp = 0.;
        enemy.state = ActorState::Dead;
        s.actors.push(enemy);
        s.spotlight.as_mut().unwrap().participants.push(500);
        let old = s.clone();
        live.ingest(
            &m,
            vec![Event::Died { id: 500 }],
            &s,
            &old,
            &mut bg,
            &mut bodies,
            0.,
        );
        assert!(!live.ready(&m, &s));
        s.time += 0.41;
        live.ingest(&m, vec![], &s, &old, &mut bg, &mut bodies, 0.41);
        assert!(!live.ready(&m, &s));
        assert_eq!(live.director.phase, Phase::Settle);
        s.time += SETTLE_HOLD + 0.01;
        live.ingest(&m, vec![], &s, &old, &mut bg, &mut bodies, SETTLE_HOLD + 0.01);
        assert!(live.ready(&m, &s));
        s.spotlight = None;
        s.time += SCRIM_OUT + 0.01;
        live.ingest(&m, vec![], &s, &old, &mut bg, &mut bodies, SCRIM_OUT + 0.01);
        assert_eq!(live.director.alpha, 0.);
        live.ingest(
            &m,
            vec![Event::SceneReset],
            &s,
            &old,
            &mut bg,
            &mut bodies,
            0.,
        );
        assert!(live.current.is_none());
        assert!(live.lingering.is_empty());
        assert_eq!(live.director.count, 0);
    }
    // real_sim_playback_releases_packages_and_off_cancels: slice sim-spotlight scenario retired (ORKA-63bf.12);
    // WFM combat runs with SpotlightConfig::OFF and the client director owns spotlight presentation.
    #[test]
    fn phases_cancel_reset_and_missing_end_never_stick() {
        let mut d = Director::default();
        let mut s = scene();
        assert_eq!(d.phase, Phase::Idle);
        start(&mut s);
        assert!(d.update(&s, 0.));
        assert_eq!(d.phase, Phase::Performing);
        s.time += CHARGE_SCRIM_IN;
        d.update(&s, CHARGE_SCRIM_IN);
        assert_eq!(d.phase, Phase::Performing);
        assert!((d.alpha - 0.8).abs() < 0.001);
        s.spotlight.as_mut().unwrap().phase = SpotlightPhase::Tail;
        d.update(&s, 0.);
        assert_eq!(d.phase, Phase::Tail);
        s.spotlight = None;
        d.update(&s, 0.);
        assert_eq!(d.phase, Phase::Release);
        s.time += SCRIM_OUT + 0.01;
        d.update(&s, SCRIM_OUT + 0.01);
        assert_eq!(d.phase, Phase::Idle);
        assert_eq!(d.alpha, 0.);
        assert_eq!(d.count, 1);
        assert_eq!(d.heroes[0], 1);
        start(&mut s);
        d.update(&s, 0.);
        d = Director::default();
        assert_eq!(d.alpha, 0.);
        assert!(d.view.is_none());
    }
    #[test]
    fn partition_draws_each_actor_once_and_keeps_combat_clock() {
        let mut s = scene();
        start(&mut s);
        s.time = 15.;
        s.combat_time = 4.;
        let (bg, spot) = frames(&s, s.spotlight.as_ref());
        for a in &s.actors {
            assert_eq!(
                bg.actors
                    .iter()
                    .chain(&spot.actors)
                    .filter(|b| b.id == a.id)
                    .count(),
                1
            );
        }
        assert!(spot.projectiles.is_empty() && spot.chests.is_empty());
        assert_eq!(bg.time, 4.);
        assert_eq!(spot.time, 15.);
        s.time += 1.;
        let (later, _) = frames(&s, s.spotlight.as_ref());
        assert_eq!(bg, later);
        s.spotlight = None;
        let (bg, spot) = frames(&s, None);
        assert_eq!(bg.actors.len(), s.actors.len());
        assert!(spot.actors.is_empty());
    }
}

#[cfg(target_arch = "wasm32")]
std::thread_local! { static PROBE: std::cell::Cell<[f32; 38]> = const { std::cell::Cell::new([0.; 38]) }; }
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_spotlight_probe(index: u32) -> f32 {
    PROBE.with(|p| p.get().get(index as usize).copied().unwrap_or(f32::NAN))
}
#[cfg(target_arch="wasm32")]
std::thread_local! {static COMBO_PROBE:std::cell::Cell<[f32;27]>=const{std::cell::Cell::new([0.;27])};}
#[cfg(target_arch="wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_combo_probe(index:u32)->f32 {
    COMBO_PROBE.with(|p|p.get().get(index as usize).copied().unwrap_or(f32::NAN))
}
#[cfg(target_arch = "wasm32")]
impl Spotlight {
    pub fn record(&self, s: &Snapshot, preset: usize, arcane_art_loaded: bool) {
        let arcane = self.current.as_ref().map_or([0., 0., -1., 0.], |p| p.effects.arcane_probe(s));
        let view=s.spotlight.as_ref();let (bg,fg)=frames(s,view);
        let co=view.and_then(|v|v.co_casters.first()).and_then(|id|s.actors.iter().find(|a|a.id==*id));
        let hondo=s.actors.iter().find(|a|a.archetype==Archetype::Hondo);
        COMBO_PROBE.with(|p|p.set([
            s.time as f32,s.combat_time as f32,self.director.count as f32,self.director.phase as u8 as f32,
            view.map_or(-1.,|v|v.phase as u8 as f32),self.director.alpha,
            view.map_or(0.,|v|v.caster as f32),view.map_or(-1.,|v|v.skill.index() as f32),
            view.map_or(0.,|v|v.co_casters.len() as f32),co.map_or(0.,|a|a.id as f32),
            co.map_or(-1.,|a|a.state as u8 as f32),co.map_or(-1.,|a|a.state_age),
            co.map_or(0.,|a|fg.actors.iter().filter(|x|x.id==a.id).count() as f32),
            co.map_or(0.,|a|bg.actors.iter().filter(|x|x.id==a.id).count() as f32),
            view.map_or(0.,|v|v.projectiles.len() as f32),fg.projectiles.len() as f32,
            view.map_or(0.,|v|bg.projectiles.iter().filter(|x|v.projectiles.contains(&x.id)).count() as f32),
            view.map_or(0.,|v|v.hazards.len() as f32),fg.hazards.len() as f32,
            view.map_or(0.,|v|bg.hazards.iter().filter(|x|v.hazards.contains(&x.id)).count() as f32),
            arcane[0],arcane[1],arcane[2],arcane[3],
            view.and_then(|v|s.actors.iter().find(|a|a.id==v.caster)).map_or(-1.,|a|a.state_age),
            hondo.map_or(0.,|a|a.meter),hondo.map_or(0.,|a|a.groove_active),
        ]));
        PROBE.with(|p| {
            p.set([
                self.director.phase as u8 as f32,
                self.director.alpha,
                self.director.count as f32,
                self.director.wall_time as f32,
                s.time as f32,
                s.combat_time as f32,
                preset as f32,
                s.spotlight.as_ref().map_or(0., |v| v.caster as f32),
                self.current
                    .as_ref()
                    .map_or(0., |p| (p.effects.busy(s.time)||p.charge.busy(s.time)) as u8 as f32),
                self.director.heroes[0] as f32,
                self.director.heroes[1] as f32,
                self.director.heroes[2] as f32,
                self.director.heroes[3] as f32,
                s.spotlight.as_ref().is_some_and(|v| v.skill == wf_combat::Skill::ArcanePulse) as u8 as f32,
                arcane[0], arcane[1], arcane[2], arcane[3],
                arcane_art_loaded as u8 as f32,
                self.current.as_ref().map_or(0., |p| p.effects.split_active(s.time)),
                self.current.as_ref().map_or(0., |p| p.effects.pound_active(s.time)),
                self.director.view.as_ref().map_or(0.,|v|(s.time-v.started) as f32),
                self.director.settle_started.map_or(-1.,|began|(s.time-began) as f32),
                self.director.release_age as f32,
                self.current.as_ref().map_or(0.,|p|p.effects.split_facing(s.time)),
                s.hazards.iter().filter(|h|h.kind==wf_combat::HazardKind::GroundPound&&h.phase!=wf_combat::HazardPhase::Resolved).count() as f32,
                s.hazards.iter().find(|h|h.kind==wf_combat::HazardKind::GroundPound).map_or(0.,|h|h.progress),
                self.current.as_ref().map_or(0.,|p|p.effects.shadow_active(s.time)),
                s.hazards.iter().filter(|h|h.kind==wf_combat::HazardKind::BubblePop&&h.phase!=wf_combat::HazardPhase::Resolved).count() as f32,
                s.hazards.iter().find(|h|h.kind==wf_combat::HazardKind::BubblePop).map_or(0.,|h|h.progress),
                self.config.charge,
                self.current.as_ref().map_or(-1.,|p|p.effects.pound_age(s.time)),
                self.current.as_ref().map_or(-1.,|p|p.effects.bubble_age(s.time)),
                self.current.as_ref().map_or(-1.,|p|p.effects.shadow_age(s.time)),
                self.current.as_ref().map_or(-1.,|p|{let (_,mut spot)=frames(s,p.view.as_ref());p.visual_hazards(&mut spot);spot.hazards.iter().find(|h|h.kind==wf_combat::HazardKind::BubblePop).map_or(-1.,|h|h.progress)}),
                self.current.as_ref().map_or(0.,|p|p.effects.bubble_records() as f32),
                self.current.as_ref().map_or(0.,|p|p.effects.visible_popups(s.time)),
                s.spotlight.as_ref().map_or(-1.,|v|v.skill as u8 as f32),
            ])
        });
    }
}

#[cfg(test)]
mod host_loop_tests {
    use wf_combat::{SpotlightConfig, SpotlightPhase, Team};
    /// ORKA-63bf.21: on the real host loop with the default preset, a featured special freezes
    /// the combat clock, only the caster and its targets take part, and combat resumes as soon
    /// as the presentation releases the Tail phase.
    #[test]
    fn a_spotlight_freezes_combat_around_the_special_and_resumes_on_release() {
        let mut run = crate::testing::HostRun::new(1);
        run.session.set_spotlight(SpotlightConfig::DEFAULT);
        let (mut seen, mut frozen_steps, mut resumed_after) = (0u32, 0u32, 0u32);
        let mut active: Option<(f64, f64, u32)> = None; // (combat time, presentation time, steps) at start
        let mut tail_steps = 0;
        let mut last_combat = run.snapshot().combat_time;
        let mut last_end: Option<f64> = None;
        for _ in 0..12000 {
            run.step();
            let s = run.snapshot().clone();
            match (&s.spotlight, active) {
                (Some(view), None) => {
                    seen += 1;
                    active = Some((s.combat_time, s.time, 0));
                    tail_steps = 0;
                    let caster = s.actors.iter().find(|a| a.id == view.caster).expect("the caster is on the field");
                    assert_eq!(caster.team, Team::Hero);
                    assert!(view.participants.iter().any(|id| s.actors.iter().any(|a| a.id == *id && a.team == Team::Enemy)), "a spotlight features a struck enemy");
                    if let Some(end) = last_end { assert!(s.combat_time - end >= SpotlightConfig::DEFAULT.global_gap as f64 - 0.05, "spotlights keep their gap"); }
                }
                (Some(view), Some((combat_start, time_start, steps))) => {
                    active = Some((combat_start, time_start, steps + 1));
                    frozen_steps += 1;
                    // Other combat is suspended: the combat clock barely moves while the
                    // presentation clock runs on.
                    assert!(s.combat_time - combat_start < 0.5, "combat advanced {} s inside a spotlight", s.combat_time - combat_start);
                    if view.phase == SpotlightPhase::Tail {
                        tail_steps += 1;
                        // The client releases once its effects have settled (a quarter second here).
                        if tail_steps == 8 { run.session.release_spotlight(); }
                    }
                }
                (None, Some((combat_start, time_start, steps))) => {
                    assert!(steps >= 10, "a spotlight lasts long enough to read ({steps} steps)");
                    assert!(s.time - time_start > s.combat_time - combat_start + 0.3, "the presentation clock ran while combat held");
                    assert!(tail_steps <= 9, "combat resumed right after the release, not at the tail cap");
                    active = None;
                    last_end = Some(s.combat_time);
                    resumed_after = 0;
                }
                (None, None) => {
                    if last_end.is_some() { resumed_after += 1; if resumed_after == 30 { assert!(s.combat_time > last_combat, "combat runs again after the spotlight"); } }
                }
            }
            last_combat = s.combat_time;
            if seen >= 2 && active.is_none() && resumed_after > 60 { break; }
        }
        assert!(seen >= 1, "the host loop produced a spotlight");
        assert!(frozen_steps >= 10);
    }
    /// The JS-parity host (traces, oracle fixtures) never opts in: no spotlight is ever scheduled.
    #[test]
    fn the_scheduler_stays_off_unless_the_client_turns_it_on() {
        let mut run = crate::testing::HostRun::new(1);
        for _ in 0..3000 { run.step(); assert!(run.snapshot().spotlight.is_none()); }
    }
}
