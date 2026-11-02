//! Fixed-step, headless autonomous combat. All gameplay randomness is seed-owned.
pub mod api;
pub use api::*;
pub mod actors;
pub mod permanent;
pub mod ai;
pub mod barrage;
pub mod boss_commit;
pub mod bubble_aura;
pub mod combat;
pub mod chest;
pub mod combo;
pub mod enemies;
pub mod enemy_healing;
pub mod enemy_status;
pub mod enmity;
pub mod events;
pub mod formulas;
pub mod groove;
pub mod hazards;
pub mod healing_spring;
pub mod kiting;
pub mod knockback;
pub mod marching_stomp;
pub mod marid;
pub mod math;
pub mod revival;
pub mod rng;
pub mod separation;
pub mod snapshot;
pub mod spotlight;
pub mod tuning;
pub mod wfm;

use actors::Actor;
use combat::Projectile;
use hazards::Hazard;
use rng::Rng;

#[derive(Clone, Copy, Debug, Default)]
pub struct EncounterState {
    pub transitioning: bool,
    pub complete: bool,
    pub hold_position: bool,
}
#[derive(Clone, Copy, Debug)]
pub struct EncounterModifiers {
    pub cooldown_multiplier: f32,
    pub slam_radius_bonus: f32,
    pub recharge_reduction: f32,
}
impl Default for EncounterModifiers {
    fn default() -> Self {
        Self {
            cooldown_multiplier: 1.,
            slam_radius_bonus: 0.,
            recharge_reduction: 0.,
        }
    }
}
pub struct Sim {
    pub cfg: SimConfig,
    pub floor: math::Floor,
    pub contain_bodies: bool,
    pub accumulator: f64,
    pub step_number: u64,
    pub combat_steps: u64,
    pub hit_stop: Option<HitStopView>,
    pub hit_stop_steps: u32,
    pub phoenix: revival::Phoenix,
    pub spotlight: spotlight::Scheduler,
    pub spotlight_view_cache: Option<SpotlightView>,
    pub next_id: u32,
    pub actors: Vec<Actor>,
    pub hazards: Vec<Hazard>,
    pub projectiles: Vec<Projectile>,
    pub spring_healing: f64,
    pub spawn_rng: Rng,
    pub combat_rng: Rng,
    pub snapshot: Snapshot,
    pub events: events::Events,
    #[cfg(feature = "reference-diagnostics")]
    pub outcome: Option<TrialOutcome>,
    #[cfg(feature = "reference-diagnostics")]
    pub trial_hazard: Option<u32>,
    #[cfg(feature = "reference-diagnostics")]
    pub trial_hp: f32,
    #[cfg(feature = "reference-diagnostics")]
    pub trial_delay: f32,
    #[cfg(feature = "reference-diagnostics")]
    pub trial_landed: bool,
    pub encounter: EncounterState,
    pub modifiers: EncounterModifiers,
    pub formation_origin: Vec2,
    pub chests: Vec<chest::ChestView>,
    pub chest_opener: Option<u32>,
    pub chest_approach: Option<(Vec2, Facing)>,
    pub interest_points: Vec<(u32, Vec2)>,
    pub spawn_profiles: Vec<(Archetype, tuning::Stats)>,
    pub defeats: Vec<Vec2>,
    pub materialized: Vec<(u32, u32)>,
    pub finish_requested: bool,
    #[cfg(feature = "reference-diagnostics")]
    pub diagnostic_trial: bool,
    #[cfg(feature = "bound-diagnostics")]
    pub diagnostic_tier: u8,
}
impl Sim {
    pub fn new(mut cfg: SimConfig) -> Self {
        if !cfg.arena_size.x.is_finite() || cfg.arena_size.x < 1. {
            cfg.arena_size.x = 960.;
        }
        if !cfg.arena_size.y.is_finite() || cfg.arena_size.y < 1. {
            cfg.arena_size.y = 2200.;
        }
        if !cfg.visible_width.is_finite() || cfg.visible_width < 1. {
            cfg.visible_width = 720.;
        }
        if !cfg.visible_height.is_finite() || cfg.visible_height < 1. {
            cfg.visible_height = 1700.;
        }
        cfg.spotlight = spotlight::validated(cfg.spotlight);
        let snapshot = Snapshot {
            time: 0.,
            combat_time: 0.,
            spotlight: None,
            hit_stop: None,
            phoenix_cooldown: 0.,
            phoenix_channel: None,
            enmity: Vec::with_capacity(128),
            step: 0,
            actors: Vec::with_capacity(64),
            hazards: Vec::with_capacity(64),
            projectiles: Vec::with_capacity(64),
            arena_min: tuning::ARENA_MIN,
            arena_max: tuning::ARENA_MAX,
            camera_focus: Vec2::default(),
        };
        let seed = cfg.seed;
        let spotlight_enabled = cfg.spotlight.enabled;
        let mut sim = Self {
            floor: math::Floor::default(),
            contain_bodies: false,
            cfg,
            accumulator: 0.,
            step_number: 0,
            combat_steps: 0,
            hit_stop: None,
            hit_stop_steps: 0,
            phoenix: revival::Phoenix::default(),
            spotlight: spotlight::Scheduler::new(spotlight_enabled),
            spotlight_view_cache: Some(SpotlightView {
                caster: 0,
                skill: Skill::CrimsonWard,
                phase: SpotlightPhase::Performing,
                started: 0.,
                participants: Vec::with_capacity(128),
                hazards: Vec::with_capacity(128),
                co_casters: Vec::with_capacity(4),
                projectiles: Vec::with_capacity(128),
            }),
            next_id: 1,
            actors: Vec::with_capacity(128),
            hazards: Vec::with_capacity(128),
            projectiles: Vec::with_capacity(128),
            spring_healing: 0.,
            formation_origin: tuning::ARENA_CENTRE,
            encounter: EncounterState::default(),
            modifiers: EncounterModifiers::default(),
            chests: Vec::new(),
            chest_opener: None,
            chest_approach: None,
            interest_points: Vec::with_capacity(4),
            spawn_profiles: Vec::with_capacity(16),
            defeats: Vec::with_capacity(64),
            materialized: Vec::with_capacity(64),
            finish_requested: false,
            #[cfg(feature = "reference-diagnostics")]
            diagnostic_trial: false,
            #[cfg(feature = "bound-diagnostics")]
            diagnostic_tier: 1,
            spawn_rng: Rng(seed ^ 0x6a09e667f3bcc909),
            combat_rng: Rng(seed ^ 0xbb67ae8584caa73b),
            snapshot,
            events: events::Events::new(),
            #[cfg(feature = "reference-diagnostics")]
            outcome: None,
            #[cfg(feature = "reference-diagnostics")]
            trial_hazard: None,
            #[cfg(feature = "reference-diagnostics")]
            trial_hp: 0.,
            #[cfg(feature = "reference-diagnostics")]
            trial_delay: 0.,
            #[cfg(feature = "reference-diagnostics")]
            trial_landed: false,
        };
        sim.refresh_snapshot();
        sim
    }
    fn diagnostic_finished(&self) -> bool {
        #[cfg(feature = "reference-diagnostics")]
        {
            self.outcome.is_some()
        }
        #[cfg(not(feature = "reference-diagnostics"))]
        {
            false
        }
    }
    pub fn autonomous(&self) -> bool {
        #[cfg(feature = "reference-diagnostics")]
        {
            !self.diagnostic_trial
        }
        #[cfg(not(feature = "reference-diagnostics"))]
        {
            true
        }
    }
    pub fn spawn_profile(&mut self, kind: Archetype, pos: Vec2) -> u32 {
        let stats = self
            .spawn_profiles
            .iter()
            .find(|(k, _)| *k == kind)
            .map(|(_, s)| *s)
            .unwrap_or_else(|| tuning::stats(kind));
        self.spawn_actor(kind, pos, stats)
    }
    /// Current weapon reach, exposed read-only for headless spacing measurements.
    pub fn actor_reach(&self, id: u32) -> Option<f32> {
        self.actor_index(id).map(|i| self.actors[i].reach())
    }
    /// Frozen countdown and raw damage for headless telegraph trade-off measurements.
    pub fn hazard_countdown_damage(&self, id: u32) -> Option<(f32, f32)> {
        self.hazards
            .iter()
            .find(|h| h.view.id == id)
            .map(|h| (h.duration, h.damage))
    }
    /// Diagnostic contact at resolution, before knockback and body separation.
    pub fn ground_pound_target_contact(&self, id: u32) -> Option<bool> {
        self.hazards
            .iter()
            .find(|h| h.view.id == id)
            .and_then(|h| h.target_contact)
    }
    /// (alive, feet contact, distance from line origin), sampled before resolve damage/push.
    pub fn ground_pound_target_status(&self, id: u32) -> Option<(bool, bool, f32)> {
        self.hazards.iter().find(|h| h.view.id == id).and_then(|h| {
            h.target_contact.map(|contact| {
                (
                    h.target_alive_at_resolve,
                    contact,
                    h.target_distance_at_resolve,
                )
            })
        })
    }
    /// Observation only: cumulative actual spring HP restoration; excluded from gameplay hash.
    pub fn healing_spring_healing(&self) -> f64 {
        self.spring_healing
    }
    pub fn config(&self) -> &SimConfig {
        &self.cfg
    }
    #[cfg(feature = "reference-diagnostics")]
    pub fn trial_outcome(&self) -> Option<TrialOutcome> {
        self.outcome
    }
    pub fn step(&mut self) {
        if self.diagnostic_finished() {
            return;
        }
        self.step_number += 1;
        if self.hit_stop_steps > 0 {
            self.phoenix.held = None;
            self.hit_stop_steps -= 1;
            if self.hit_stop_steps == 0 {
                self.hit_stop = None;
            }
            self.refresh_snapshot();
            return;
        }
        if self.spotlight.active.is_some() {
            self.phoenix.held = None;
            self.spotlight_step();
            self.refresh_snapshot();
            return;
        }
        self.combat_steps += 1;
        self.spotlight.candidates.fill(None);
        if self.encounter.transitioning {
            self.cancel_phoenix();
            self.refresh_snapshot();
            return;
        }
        self.actors.retain(|a| a.view.state != ActorState::Dead);
        self.deaths();
        self.enemy_statuses();
        self.bubble_aura();
        self.timers();
        self.groove_timers();
        self.phoenix_step();
        self.update_hazards();
        self.sync_boss_casts();
        self.enmity_step();
        self.update_chests();
        self.hero_ai();
        self.enemy_ai();
        self.sync_hero_areas();
        self.actions();
        self.move_projectiles();
        self.resolve_hazards();
        self.prune_bombs();
        self.deaths();
        self.separate_bodies();
        self.constrain_party();
        self.constrain_chests();
        self.select_spotlight();
        if self.spotlight.active.is_none() {
            self.finish_requested = true;
        }
        self.refresh_snapshot();
    }
    /// Frame input is transport state and deliberately excluded from the gameplay hash.
    pub fn advance(&mut self, dt_seconds: f32) -> u32 {
        if !dt_seconds.is_finite() || dt_seconds <= 0. || self.diagnostic_finished() {
            return 0;
        }
        self.accumulator += (dt_seconds.min(0.25)) as f64;
        let mut n = 0;
        // Use exact 30 Hz in f64; f32 SIM_DT chunks are slightly longer than 1/30.
        while self.accumulator + 1e-12 >= 1. / SIM_HZ as f64 && !self.diagnostic_finished() {
            self.accumulator -= 1. / SIM_HZ as f64;
            self.step();
            n += 1;
        }
        n
    }
    pub fn alpha(&self) -> f32 {
        (self.accumulator * SIM_HZ as f64).clamp(0., 1.) as f32
    }
    /// Runtime spotlight preset change (presentation toggle). Disabling cancels an active spotlight.
    pub fn set_spotlight(&mut self, config: SpotlightConfig) {
        self.cfg.spotlight = spotlight::validated(config);
        self.spotlight.touched |= config.enabled;
        if !config.enabled {
            self.end_spotlight(true);
        } else if config.auto_release
            && self
                .spotlight
                .active
                .as_ref()
                .is_some_and(|s| s.phase == SpotlightPhase::Tail)
        {
            self.end_spotlight(false);
        }
        self.refresh_snapshot();
    }
    /// Presentation signals that the spotlight's VFX package finished (ends the Tail phase).
    pub fn release_spotlight(&mut self) {
        if self
            .spotlight
            .active
            .as_ref()
            .is_some_and(|s| s.phase == SpotlightPhase::Tail)
        {
            self.end_spotlight(false);
            self.refresh_snapshot();
        }
    }
    pub fn snapshot(&self) -> &Snapshot {
        &self.snapshot
    }
    pub fn drain_events(&mut self) -> Vec<Event> {
        self.events.drain()
    }
    pub fn state_hash(&self) -> u64 {
        self.hash_with_host(|section, h| {
            if section == 0 {
                h.v(self.formation_origin);
                h.b(self.encounter.transitioning);
                h.b(self.encounter.complete);
                h.b(self.encounter.hold_position);
                h.f(self.modifiers.cooldown_multiplier);
                h.f(self.modifiers.slam_radius_bonus);
                h.f(self.modifiers.recharge_reduction);
                if !self.chests.is_empty() {
                    h.u(0x4348455354);
                    for c in &self.chests { h.u(c.id as u64); h.v(c.pos); h.u(c.state as u64); h.f(c.state_age); h.f(c.age); }
                    h.u(self.chest_opener.unwrap_or(0) as u64);
                    if let Some((point, facing)) = self.chest_approach { h.v(point); h.u(facing as u64); }
                }
                // Production-only mechanical extension; the reference harness retains its frozen byte stream.
                h.u(0x4348414e4e454c53);
                for p in &self.projectiles { h.u(p.channel as u64); }
                h.u(self.interest_points.len() as u64);
                for (id, p) in &self.interest_points {
                    h.u(*id as u64);
                    h.v(*p);
                }
                h.u(self.spawn_profiles.len() as u64);
                for (kind, s) in &self.spawn_profiles {
                    h.u(*kind as u64);
                    for v in [
                        s.hp, s.atk, s.def, s.mag, s.res, s.speed, s.reach, s.interval, s.evade, s.special,
                    ] {
                        h.f(v);
                    }
                }
            }
        })
    }
}

#[cfg(feature = "reference-diagnostics")]
pub mod enmity_attribution;
#[cfg(feature = "reference-diagnostics")]
pub mod target_lock_metrics;

#[cfg(feature = "reference-diagnostics")]
pub mod beam_metrics;

#[cfg(feature = "reference-diagnostics")]
pub mod stomp_metrics;

#[cfg(feature = "reference-diagnostics")]
pub mod round14_tests;

impl Sim {
    pub fn ahead_point(&mut self) -> Vec2 {
        let c = self.centroid();
        Vec2::new(
            (c.x + self.spawn_rng.range(-190., 190.)).clamp(
                self.snapshot.arena_min.x + 80.,
                self.snapshot.arena_max.x - 80.,
            ),
            (c.y - self.spawn_rng.range(350., 420.)).max(self.snapshot.arena_min.y + 80.),
        )
    }
    pub fn spawn_enemy(&mut self, kind: Archetype) -> u32 {
        let p = self.ahead_point();
        let id = self.spawn_profile(kind, p);
        self.actors.last_mut().unwrap().begin_spawn();
        id
    }
    pub fn enemy_capacity(&self) -> usize {
        tuning::ACTIVE_ENEMY_CAP.saturating_sub(
            self.actors
                .iter()
                .filter(|a| a.view.team == Team::Enemy && a.alive())
                .count()
                + self
                    .hazards
                    .iter()
                    .filter(|h| h.spawn_kind.is_some() && h.view.phase != HazardPhase::Resolved)
                    .count(),
        )
    }
}

#[cfg(test)]
mod host_inputs_tests;
#[cfg(test)]
mod kaja_mend_tests;

#[cfg(feature = "bound-diagnostics")]
pub mod bound;
