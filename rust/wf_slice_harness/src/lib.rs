//! Fixed-step, headless autonomous combat. All gameplay randomness is seed-owned.
pub mod api;
pub use api::*;
pub use wf_combat::actors;
pub use wf_combat::ai;
#[cfg(feature = "bound-diagnostics")]
pub mod bound;
pub use wf_combat::bubble_aura;
pub use wf_combat::combat;
mod director;
pub use wf_combat::enemies;
#[cfg(test)]
mod mirewing_tests;
pub use wf_combat::barrage;
pub use wf_combat::enemy_healing;
pub use wf_combat::enemy_status;
pub use wf_combat::enmity;
pub use wf_combat::events;
pub use wf_combat::marid;
mod formations;
mod spawns;
#[cfg(test)]
#[path = "../build.rs"]
mod wave_build;
pub use wf_combat::groove;
pub use wf_combat::hazards;
pub use wf_combat::healing_spring;
pub use wf_combat::kiting;
pub use wf_combat::knockback;
pub use wf_combat::marching_stomp;
pub use wf_combat::math;
mod rewards;
pub use wf_combat::revival;
pub use wf_combat::rng;
pub use wf_combat::separation;
mod snapshot;
pub use wf_combat::boss_commit;
pub use wf_combat::combo;
pub use wf_combat::spotlight;
mod qa_showcase;
mod stage_script;
mod tuning;

use director::Director;
use rng::Rng;
pub struct Sim {
    pub combat: wf_combat::Sim,
    scenario: Scenario,
    stage: StageView,
    chests: Vec<ChestView>,
    chest_opener: Option<u32>,
    chest_approach: Option<(Vec2, Facing)>,
    reward_rng: Rng,
    director: Director,
    snapshot: Snapshot,
    snapshot_spotlight_cache: Option<SpotlightView>,
}
impl std::ops::Deref for Sim {
    type Target = wf_combat::Sim;
    fn deref(&self) -> &Self::Target {
        &self.combat
    }
}
impl std::ops::DerefMut for Sim {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.combat
    }
}
impl Sim {
    pub fn new(cfg: SimConfig) -> Self {
        Self::with_scenario(cfg, Scenario::Slice)
    }
    pub fn with_scenario(cfg: SimConfig, scenario: Scenario) -> Self {
        let stage = StageView {
            phase: StagePhase::Lull,
            wave: 1,
            elapsed: 0.,
            boss_eta: 0.,
            escalation_level: 0,
            wipes: 0,
            kills: 0,
            mini_wave: 0,
            mini_waves_total: tuning::MINI_WAVES,
            tier: 1,
            buffs: tuning::empty_buffs(),
            fade: 0.,
        };
        let seed = cfg.seed;
        let mut combat = wf_combat::Sim::new(cfg);
        combat.diagnostic_trial = scenario != Scenario::Slice;
        combat.formation_origin = if scenario == Scenario::Slice {
            tuning::ARENA_CENTRE
        } else {
            tuning::STAGE_ORIGIN
        };
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
            chests: Vec::with_capacity(8),
            stage: stage.clone(),
            arena_min: tuning::ARENA_MIN,
            arena_max: tuning::ARENA_MAX,
            camera_focus: Vec2::default(),
        };
        let mut sim = Self {
            combat,
            scenario,
            stage,
            chests: Vec::with_capacity(8),
            chest_opener: None,
            chest_approach: None,
            reward_rng: Rng(seed ^ 0x3c6ef372fe94f82b),
            director: Director::default(),
            snapshot,
            snapshot_spotlight_cache: Some(SpotlightView {
                caster: 0,
                skill: Skill::CrimsonWard,
                phase: SpotlightPhase::Performing,
                started: 0.,
                participants: Vec::with_capacity(128),
                hazards: Vec::with_capacity(128),
                co_casters: Vec::with_capacity(4),
                projectiles: Vec::with_capacity(128),
            }),
        };
        match scenario {
            Scenario::Slice => sim.spawn_party(),
            Scenario::DodgeTrial { hazard, hero } => sim.setup_trial(hazard, hero),
        }
        sim.refresh_snapshot();
        sim
    }
    /// Headless composition fixture for density comparisons. Same party/stats/AI for every sample.
    /// No director spawns, rewards or stage progression; boss summon abilities remain active.
    pub fn composition_trial(cfg: SimConfig, enemies: &[Archetype]) -> Self {
        let mut sim = Self::new(cfg);
        sim.director.entry = stage_script::STAGE_1.len();
        for (i, a) in sim.combat.actors.iter_mut().enumerate() {
            a.view.pos = tuning::TRIAL_ORIGIN + tuning::TRAVEL_SLOTS[i];
            a.destination = a.view.pos;
        }
        for (i, &kind) in enemies.iter().enumerate() {
            let pos = Vec2::new(210. + (i % 4) as f32 * 180., 640. - (i / 4) as f32 * 120.);
            sim.spawn_actor(kind, pos);
        }
        sim.refresh_snapshot();
        sim
    }
    /// Read-only authored spawn stats for bench reports: HP, armor divisor, ATK, interval.
    /// `outer_wave` is zero-based; stage starts at one. No gameplay state is mutated.
    pub fn enemy_spawn_stats(
        stage: u32,
        outer_wave: usize,
        kind: Archetype,
    ) -> (f32, f32, f32, f32) {
        assert!(stage > 0);
        let tier = ((stage - 1) % 3 + 1) as u8;
        let base = tuning::stats(kind);
        let (mut hp, atk) = tuning::spawn_scales(stage, tier, outer_wave, kind);
        if tuning::is_boss(kind) {
            hp *= tuning::BOSS_TIER_HP[(tier - 1) as usize];
        }
        (
            base.hp * hp,
            (tuning::DEF_BASE + base.def) / tuning::DEF_BASE,
            base.atk * atk,
            base.interval,
        )
    }
    pub fn trial_outcome(&self) -> Option<TrialOutcome> {
        self.combat.outcome
    }
    pub fn step(&mut self) {
        if self.combat.outcome.is_some() {
            return;
        }
        self.combat.step_number += 1;
        if self.combat.hit_stop_steps > 0 {
            self.combat.phoenix.held = None;
            self.combat.hit_stop_steps -= 1;
            if self.combat.hit_stop_steps == 0 {
                self.combat.hit_stop = None;
            }
            self.refresh_snapshot();
            return;
        }
        if self.combat.spotlight.active.is_some() {
            self.combat.phoenix.held = None;
            self.spotlight_step();
            self.refresh_snapshot();
            return;
        }
        self.combat.combat_steps += 1;
        self.combat.spotlight.candidates.fill(None);
        if self.scenario == Scenario::Slice && self.transition_step() {
            self.combat.cancel_phoenix();
            self.refresh_snapshot();
            return;
        }
        self.combat
            .actors
            .retain(|a| a.view.state != ActorState::Dead);
        self.deaths();
        self.combat.enemy_statuses();
        self.combat.bubble_aura();
        self.combat.timers();
        self.combat.groove_timers();
        self.combat.phoenix_step();
        if self.scenario == Scenario::Slice {
            self.update_chests();
            self.direct();
        }
        #[cfg(feature = "bound-diagnostics")]
        bound::begin(self);
        self.combat.update_hazards();
        self.combat.sync_boss_casts();
        #[cfg(feature = "bound-diagnostics")]
        bound::notice(self);
        self.combat.enmity_step();
        self.hero_ai();
        if self.scenario == Scenario::Slice {
            self.enemy_ai();
        }
        self.combat.sync_hero_areas();
        self.combat.actions();
        self.combat.move_projectiles();
        self.resolve_hazards();
        self.combat.prune_bombs();
        self.deaths();
        self.combat.separate_bodies();
        self.combat.constrain_party();
        self.constrain_chests();
        self.combat.select_spotlight();
        if self.scenario == Scenario::Slice && self.combat.spotlight.active.is_none() {
            self.finish_stage();
        }
        #[cfg(feature = "bound-diagnostics")]
        bound::finish(self);
        self.refresh_snapshot();
    }
    /// Frame input is transport state and deliberately excluded from the gameplay hash.
    pub fn advance(&mut self, dt_seconds: f32) -> u32 {
        if !dt_seconds.is_finite() || dt_seconds <= 0. || self.combat.outcome.is_some() {
            return 0;
        }
        self.combat.accumulator += (dt_seconds.min(0.25)) as f64;
        let mut n = 0;
        // Use exact 30 Hz in f64; f32 SIM_DT chunks are slightly longer than 1/30.
        while self.combat.accumulator + 1e-12 >= 1. / SIM_HZ as f64 && self.combat.outcome.is_none()
        {
            self.combat.accumulator -= 1. / SIM_HZ as f64;
            self.step();
            n += 1;
        }
        n
    }
    pub fn alpha(&self) -> f32 {
        (self.combat.accumulator * SIM_HZ as f64).clamp(0., 1.) as f32
    }
    /// Runtime spotlight preset change (presentation toggle). Disabling cancels an active spotlight.
    pub fn set_spotlight(&mut self, config: SpotlightConfig) {
        self.combat.cfg.spotlight = spotlight::validated(config);
        self.combat.spotlight.touched |= config.enabled;
        if !config.enabled {
            self.combat.end_spotlight(true);
            self.collect_outputs();
        } else if config.auto_release
            && self
                .combat
                .spotlight
                .active
                .as_ref()
                .is_some_and(|s| s.phase == SpotlightPhase::Tail)
        {
            self.combat.end_spotlight(false);
            self.collect_outputs();
        }
        self.refresh_snapshot();
    }
    /// Presentation signals that the spotlight's VFX package finished (ends the Tail phase).
    pub fn release_spotlight(&mut self) {
        if self
            .combat
            .spotlight
            .active
            .as_ref()
            .is_some_and(|s| s.phase == SpotlightPhase::Tail)
        {
            self.combat.end_spotlight(false);
            self.collect_outputs();
            self.refresh_snapshot();
        }
    }
    pub fn snapshot(&self) -> &Snapshot {
        &self.snapshot
    }
    pub fn drain_events(&mut self) -> Vec<Event> {
        self.combat
            .events
            .drain()
            .into_iter()
            .map(Event::from)
            .collect()
    }
    pub fn state_hash(&self) -> u64 {
        self.hash_state()
    }

    fn sync_inputs(&mut self) {
        self.combat.diagnostic_trial = self.scenario != Scenario::Slice;
        #[cfg(feature = "bound-diagnostics")]
        {
            self.combat.diagnostic_tier = self.stage.tier;
        }
        self.combat.encounter = wf_combat::EncounterState {
            transitioning: self.director.transition != 0,
            complete: self.wave_combat_complete(),
            hold_position: self.director.boss.is_some(),
        };
        self.combat.modifiers = wf_combat::EncounterModifiers {
            cooldown_multiplier: (0..self.stage.escalation_level)
                .fold(1., |v, _| v * tuning::ESCALATION_COOLDOWN),
            slam_radius_bonus: self.stage.escalation_level as f32 * tuning::ESCALATION_RADIUS,
            recharge_reduction: self.stage.escalation_level as f32
                * tuning::BOSS_RECHARGE_PER_LEVEL,
        };
        self.combat.spawn_profiles.clear();
        for kind in [
            Archetype::Gobloc,
            Archetype::Orc,
            Archetype::Sniper,
            Archetype::Lizardo,
            Archetype::HighOrc,
            Archetype::Marid,
            Archetype::Fizzmite,
            Archetype::Bastorto,
            Archetype::Mirewing,
            Archetype::Gloamink,
            Archetype::Boss,
            Archetype::BossBomber,
            Archetype::BossMarksman,
        ] {
            let stats = self.resolved_stats(kind);
            self.combat.spawn_profiles.push((kind, stats));
        }
    }
    fn resolved_stats(&self, kind: Archetype) -> tuning::Stats {
        let outer = if self.director.boss.is_some() {
            stage_script::mini_waves(self.stage.tier) as usize
        } else {
            self.stage.mini_wave.saturating_sub(1) as usize
        };
        let (mut hp, atk) = tuning::spawn_scales(self.stage.wave, self.stage.tier, outer, kind);
        if tuning::is_boss(kind) {
            hp *= tuning::BOSS_TIER_HP[(self.stage.tier - 1) as usize];
        }
        let mut stats = tuning::stats(kind);
        if actors::hero_index(kind).is_none() {
            stats.hp *= hp;
            stats.atk *= atk;
            stats.mag = stats.atk;
        }
        stats
    }
    fn spawn_actor(&mut self, kind: Archetype, pos: Vec2) -> u32 {
        let stats = self.resolved_stats(kind);
        self.combat.spawn_actor(kind, pos, stats)
    }
    fn collect_outputs(&mut self) {
        for pos in self.combat.defeats.drain(..) {
            self.director.last_fall = pos;
            self.stage.kills += 1;
        }
        while let Some((marker, actor)) = self.combat.materialized.pop() {
            self.record_script_spawn(marker, actor);
        }
        if std::mem::take(&mut self.combat.finish_requested) && self.scenario == Scenario::Slice {
            self.finish_stage();
        }
    }
    fn deaths(&mut self) {
        self.combat.deaths();
        self.collect_outputs();
    }
    fn spotlight_step(&mut self) {
        self.sync_inputs();
        self.combat.spotlight_step();
        self.collect_outputs();
    }
    fn resolve_hazards(&mut self) {
        self.sync_inputs();
        self.combat.resolve_hazards();
        self.collect_outputs();
    }
    fn hero_ai(&mut self) {
        self.sync_inputs();
        let recovering = self.combat.party_recovering();
        for i in 0..self.combat.actors.len() {
            self.combat.interest_points.clear();
            if self.combat.actors[i].view.team == Team::Hero && self.combat.actors[i].alive() {
                if let Some(p) = self.chest_goal(i) {
                    self.combat
                        .interest_points
                        .push((self.combat.actors[i].view.id, p));
                }
            }
            self.combat.hero_ai_actor(i, recovering);
        }
    }
    #[cfg(test)]
    fn choose_hero_intent(&mut self, i: usize) {
        self.sync_inputs();
        self.combat.interest_points.clear();
        if let Some(p) = self.chest_goal(i) {
            self.combat
                .interest_points
                .push((self.combat.actors[i].view.id, p));
        }
        self.combat.choose_hero_intent(i);
    }
    fn hazard(
        &mut self,
        kind: HazardKind,
        owner: u32,
        target: Option<u32>,
        origin: Vec2,
        dir: Vec2,
    ) -> u32 {
        self.sync_inputs();
        self.combat.hazard(kind, owner, target, origin, dir)
    }
    fn enemy_ai(&mut self) {
        self.sync_inputs();
        self.combat.enemy_ai();
    }
}

#[cfg(test)]
mod target_lock_metrics;
#[cfg(test)]
mod tests;

#[cfg(test)]
mod fara_tests;
#[cfg(test)]
mod round14_tests;

#[cfg(test)]
mod spotlight_tests;

#[cfg(test)]
mod arcane_pulse_tests;

#[cfg(test)]
mod ground_pound_tests;

#[cfg(test)]
mod djinn_summon_tests;

#[cfg(test)]
mod bubble_target_tests;
#[cfg(test)]
mod mage_target_tests;

#[cfg(test)]
mod skill_spacing_tests;

#[cfg(test)]
mod boss_identity_tests;

#[cfg(test)]
mod boss_hp_tests;

#[cfg(test)]
mod mage_kiting_tests;

#[cfg(test)]
mod bubble_aura_tests;

#[cfg(test)]
mod healing_spring_tests;
#[cfg(test)]
mod knockback_tests;
#[cfg(test)]
mod taunt_floor_tests;

#[cfg(test)]
mod target_lock_tests;

#[cfg(test)]
mod spring_behavior_metrics;
#[cfg(test)]
mod spring_behavior_tests;

#[cfg(test)]
mod enmity_metrics;

#[cfg(test)]
mod enmity_tests;

#[cfg(test)]
mod enmity_attribution;

#[cfg(test)]
mod stomp_metrics;

#[cfg(test)]
mod marching_stomp_tests;

#[cfg(test)]
mod beam_metrics;

#[cfg(test)]
mod beam_tests;

#[cfg(test)]
mod combo_metrics;

#[cfg(test)]
mod combo_tests;

#[cfg(test)]
mod boss_commit_tests;

#[cfg(test)]
mod survival_tests;

#[cfg(test)]
mod roster_tests;

#[cfg(test)]
mod groove_tests;

#[cfg(test)]
mod fizzmite_death_tests;

#[cfg(test)]
mod spatial_hit_tests;
#[cfg(test)]
mod wave_clear_tests;

#[cfg(test)]
mod enemy_healing_inline;

#[cfg(test)]
mod combat_inline;

#[cfg(test)]
mod ai_inline;

#[cfg(test)]
mod marid_inline;

#[cfg(test)]
mod barrage_inline;

mod trials;

#[cfg(test)]
mod baseline_trace_tests;
