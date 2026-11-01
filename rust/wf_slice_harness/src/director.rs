use crate::{
    api::*,
    stage_script::{mini_waves, script, Anchor, MiniWave, Pattern, SubWave, MAX_SPAWNS},
    tuning::*,
    Sim,
};
#[derive(Default, Debug)]
pub(crate) struct Director {
    pub last_fall: Vec2,
    pub chest_due: bool,
    /// 0 combat, 1 boss KO hold, 2 victory fade out, 3 wipe fade out, 4 fade in.
    pub transition: u8,
    pub transition_age: f32,
    pub ticks: u64,
    pub clear_age: f32,
    pub entry: usize,
    pub spawned: usize,
    pub subwave: usize,
    pub subwave_count: usize,
    pub subwave_age: f32,
    pub subwave_markers: [u32; MAX_SPAWNS],
    pub subwave_units: [u32; MAX_SPAWNS],
    pub wave_age: f32,
    pub wave_origin: Vec2,
    pub boss_spawn_pos: Vec2,
    pub wave_active: bool,
    pub boss: Option<u32>,
    pub boss_started: f32,
    pub wipe_ticks: u32,
    pub victory_ticks: u32,
}
impl Sim {
    /// Completion is independent of targetability: transit, unread spawns and queued
    /// sub-waves all keep combat open. Derive it so deaths/spawns cannot leave a stale flag.
    pub(crate) fn wave_combat_complete(&self) -> bool {
        !self.director.wave_active && self.pacing_observation().0 == 0
    }
    /// Read-only pacing evidence: living enemies plus reserved markers, queued units, subwave.
    pub fn pacing_observation(&self) -> (usize, usize, usize) {
        let active = self
            .combat
            .actors
            .iter()
            .filter(|a| a.view.team == Team::Enemy && a.alive())
            .count()
            + self
                .combat
                .hazards
                .iter()
                .filter(|h| h.spawn_kind.is_some() && h.view.phase != HazardPhase::Resolved)
                .count();
        let queued = if self.director.wave_active {
            self.director
                .subwave_count
                .saturating_sub(self.director.spawned)
        } else {
            0
        };
        (active, queued, self.director.subwave + 1)
    }
    pub(crate) fn enemy_capacity(&self) -> usize {
        ACTIVE_ENEMY_CAP.saturating_sub(self.pacing_observation().0)
    }
    pub(crate) fn spawn_party(&mut self) {
        for (i, kind) in HEROES.into_iter().enumerate() {
            let p = TRAVEL_SLOTS[i];
            self.spawn_actor(kind, self.combat.formation_origin + p);
        }
        self.spawn_party_auras();
    }
    fn spawn_party_auras(&mut self) {
        for (kind, aura) in [(Archetype::Runa, HazardKind::BubbleAura)] {
            if let Some((id, pos)) = self
                .combat
                .actors
                .iter()
                .find(|a| a.view.archetype == kind && a.alive())
                .map(|a| (a.view.id, a.view.pos))
            {
                self.hazard(aura, id, None, pos, Vec2::new(1., 0.));
            }
        }
    }
    #[cfg(test)]
    fn ahead_point(&mut self) -> Vec2 {
        let c = self.combat.centroid();
        Vec2::new(
            (c.x + self.combat.spawn_rng.range(-190., 190.)).clamp(
                self.snapshot.arena_min.x + 80.,
                self.snapshot.arena_max.x - 80.,
            ),
            (c.y - self.combat.spawn_rng.range(350., 420.)).max(self.snapshot.arena_min.y + 80.),
        )
    }
    #[cfg(test)]
    pub(crate) fn spawn_enemy(&mut self, kind: Archetype) -> u32 {
        let p = self.ahead_point();
        let id = self.spawn_actor(kind, p);
        self.combat.actors.last_mut().unwrap().begin_spawn();
        id
    }
    fn start_wave(&mut self, wave: &MiniWave) {
        let total = mini_waves(self.stage.tier);
        self.director.chest_due = self.director.entry < total as usize;
        self.director.wave_active = true;
        self.director.subwave = 0;
        self.announce_subwave(&wave.subwaves[0]);
        self.stage.mini_waves_total = total;
        self.stage.mini_wave = (self.director.entry as u32 + 1).min(total);
        if self.director.entry < total as usize {
            self.combat.events.push(
                (Event::WaveIncoming {
                    mini_wave: self.stage.mini_wave,
                    count: wave.subwaves.iter().map(|s| s.spawns.len() as u32).sum(),
                })
                .into(),
            );
        }
    }
    fn prepare_boss_arrival(&mut self) {
        for i in 0..self.combat.actors.len() {
            if self.combat.actors[i].action_revive {
                self.combat.cancel_revive(i);
            }
        }
        self.combat
            .hazards
            .retain(|h| h.view.kind == HazardKind::SpawnMarker);
        self.combat.projectiles.clear();
        for a in &mut self.combat.actors {
            if let Some(k) = crate::actors::hero_index(a.view.archetype) {
                a.view.pos = BOSS_ENTRY_ORIGIN + TRAVEL_SLOTS[k];
                a.destination = a.view.pos;
                a.velocity = Vec2::default();
                a.target = None;
                a.spring_camp = None;
                a.clear_ailments();
                a.revive_immunity_steps = 0;
                a.burst_slow_steps = 0;
                a.dodge_hazard = None;
                a.goal_cd = 0.;
                a.ai_cd = 0.;
                a.view.ai_intent = AiIntent::None;
                a.action_done = true;
                a.action_revive = false;
                if a.alive() {
                    a.state(ActorState::Idle, 0., 0.);
                }
            }
        }
        // Passive auras belong to the party on every new screen.
        self.spawn_party_auras();
    }
    fn announce_subwave(&mut self, sub: &SubWave) {
        for a in &mut self.combat.actors {
            a.aoe_ready_steps = 0;
        }
        self.director.wave_age = 0.;
        self.director.spawned = 0;
        self.director.subwave_age = 0.;
        self.director.subwave_count = sub.spawns.len();
        self.director.subwave_markers.fill(0);
        self.director.subwave_units.fill(0);
        if sub.spawns.iter().any(|s| is_boss(s.archetype)) {
            // Keep the authored direct entrance anchored before the party is staged.
            self.director.wave_origin = match sub.placed {
                Anchor::Party => self.combat.centroid(),
                Anchor::Arena => ARENA_CENTRE,
            };
            self.prepare_boss_arrival();
        }
        self.place_pending_spawns(sub);
    }
    fn place_pending_spawns(&mut self, sub: &SubWave) -> Option<Vec2> {
        let capacity = self.enemy_capacity();
        if capacity == 0 || self.director.spawned == sub.spawns.len() {
            return None;
        }
        // Zero marker/unit IDs are the fixed-size queue. Recompute geometry only when a
        // slot is free, retrying blocked geometry each tick against the living party.
        if !sub.spawns.iter().any(|s| is_boss(s.archetype)) {
            self.director.wave_origin = match sub.placed {
                Anchor::Party => self.combat.centroid(),
                Anchor::Arena => ARENA_CENTRE,
            };
        }
        let mut heroes = [(Vec2::default(), 0.); 4];
        let mut count = 0;
        let mut forward = Vec2::default();
        for a in self
            .combat
            .actors
            .iter()
            .filter(|a| a.view.team == Team::Hero && a.alive())
        {
            heroes[count] = (a.view.pos, a.view.radius);
            count += 1;
            forward = forward + a.heading;
        }
        if forward.length() < 0.001 {
            forward = Vec2::new(0., -1.);
        }
        let points = match sub.pattern {
            Pattern::Authored => crate::spawns::points(
                sub.spawns,
                self.director.wave_origin,
                self.snapshot.arena_min,
                self.snapshot.arena_max,
                &heroes[..count],
            ),
            Pattern::Seeded => crate::spawns::seeded_points(
                sub.spawns,
                self.director.wave_origin,
                self.combat.centroid(),
                forward,
                self.snapshot.arena_min,
                self.snapshot.arena_max,
                &heroes[..count],
                &mut self.combat.spawn_rng,
            ),
        };
        let mut boss_point = None;
        let mut free = capacity;
        // Reserve the direct boss entrance before placing its escort markers.
        let boss_pending = sub
            .spawns
            .iter()
            .enumerate()
            .any(|(i, s)| is_boss(s.archetype) && self.director.subwave_units[i] == 0);
        free = free.saturating_sub(usize::from(boss_pending));
        for (i, spawn) in sub.spawns.iter().enumerate() {
            if self.director.subwave_markers[i] != 0 || self.director.subwave_units[i] != 0 {
                continue;
            }
            let Some(point) = points[i] else {
                continue;
            };
            if is_boss(spawn.archetype) {
                self.director.boss_spawn_pos = point;
                boss_point = Some(point);
            } else if free > 0 {
                self.hazard(HazardKind::SpawnMarker, 0, None, point, Vec2::new(0., -1.));
                let marker = self.combat.hazards.last_mut().unwrap();
                marker.spawn_kind = Some(spawn.archetype);
                marker.phase_age = -spawn.delay_s;
                self.director.subwave_markers[i] = marker.view.id;
                self.director.spawned += 1;
                free -= 1;
            }
        }
        boss_point
    }
    pub(crate) fn record_script_spawn(&mut self, marker: u32, actor: u32) {
        if let Some(i) = self.director.subwave_markers[..self.director.subwave_count]
            .iter()
            .position(|id| *id == marker)
        {
            self.director.subwave_units[i] = actor;
        }
    }
    fn execute_subwave(&mut self, sub: &SubWave) {
        let boss_point = self.place_pending_spawns(sub);
        if let Some((i, boss)) = sub.spawns.iter().enumerate().find(|(_, s)| {
            is_boss(s.archetype)
                && self.director.boss.is_none()
                && boss_point.is_some()
                && self.enemy_capacity() > 0
                && self.director.wave_age + 0.00001 >= s.delay_s
        }) {
            let id = self.spawn_actor(boss.archetype, self.director.boss_spawn_pos);
            self.combat.actors.last_mut().unwrap().begin_spawn();
            self.director.boss = Some(id);
            self.director.boss_started = self.stage.elapsed;
            self.stage.phase = StagePhase::Boss;
            self.director.subwave_units[i] = id;
            for a in &mut self.combat.actors {
                a.aoe_ready_steps = 0;
            }
            self.combat.events.push((Event::BossArrived { id }).into());
            self.director.spawned += 1;
        }
        self.director.wave_age += SIM_DT;
    }
    fn execute_spawns(&mut self, wave: &MiniWave) {
        self.execute_subwave(&wave.subwaves[self.director.subwave]);
        let units = &self.director.subwave_units[..self.director.subwave_count];
        let emerged = units.iter().any(|id| *id != 0);
        let all_emerged = units.iter().all(|id| *id != 0);
        let living = units
            .iter()
            .filter(|id| {
                self.combat
                    .actor_index(**id)
                    .is_some_and(|i| self.combat.actors[i].alive())
            })
            .count();
        // Queued entries have no unit ID: both the follow-up and chest wait for them.
        // Reinforcements follow six seconds after full emergence, or at once when beaten.
        self.director.subwave_age = if emerged && all_emerged {
            self.director.subwave_age + SIM_DT
        } else {
            0.
        };
        if self.director.subwave + 1 < wave.subwaves.len()
            && all_emerged
            && (living == 0 || self.director.subwave_age + 0.00001 >= SUBWAVE_FOLLOW_SECONDS)
        {
            self.director.subwave += 1;
            self.announce_subwave(&wave.subwaves[self.director.subwave]);
            self.execute_subwave(&wave.subwaves[self.director.subwave]);
        }
        if self.director.subwave + 1 == wave.subwaves.len()
            && self.director.spawned == wave.subwaves[self.director.subwave].spawns.len()
        {
            self.director.wave_active = false;
            self.director.entry += 1;
            self.director.clear_age = 0.;
        }
    }
    pub(crate) fn direct(&mut self) {
        if self.stage.phase == StagePhase::Victory {
            return;
        }
        self.director.ticks += 1;
        self.stage.elapsed = self.director.ticks as f32 / SIM_HZ as f32;
        self.stage.boss_eta = 0.;
        if self.director.wave_active {
            self.execute_spawns(&script(self.stage.tier)[self.director.entry]);
        }
        if self.director.boss.is_none() {
            let occupied = !self.wave_combat_complete();
            if !occupied && self.director.chest_due {
                self.director.chest_due = false;
                self.drop_chest();
            }
            // The wave rest starts once the chest is open and its reward banner has finished.
            let occupied = occupied
                || self.chests.iter().any(|c| {
                    c.state != ChestState::Open || c.state_age + 0.00001 < REWARD_BANNER_SECONDS
                });
            self.stage.phase = if occupied {
                StagePhase::Spike
            } else {
                StagePhase::Lull
            };
            if let Some(wave) = script(self.stage.tier).get(self.director.entry) {
                if self.director.wave_active {
                    return;
                }
                let recovering = self.combat.party_recovering();
                self.director.clear_age = if occupied || recovering {
                    0.
                } else {
                    self.director.clear_age + SIM_DT
                };
                let ready = wave.trigger.ready(self.director.clear_age, occupied);
                if ready && !occupied && !recovering {
                    self.start_wave(wave);
                    self.execute_spawns(wave);
                }
            }
        } else {
            let level = (((self.stage.elapsed - self.director.boss_started) / ESCALATION_INTERVAL)
                as u32)
                .min(ESCALATION_CAP);
            if level > self.stage.escalation_level {
                self.stage.escalation_level = level;
                self.combat.events.push((Event::Escalated { level }).into());
            }
            self.stage.phase = if level > 0 {
                StagePhase::BossEscalation
            } else {
                StagePhase::Boss
            };
        }
    }
    pub(crate) fn finish_stage(&mut self) {
        if self.combat.spotlight.active.is_some() {
            return;
        }
        if self.director.transition != 0 {
            return;
        }
        if !self
            .combat
            .actors
            .iter()
            .any(|a| a.view.team == Team::Hero && a.alive())
        {
            self.director.transition = 3;
            self.director.transition_age = 0.;
            return;
        }
        if self.director.boss.is_some_and(|id| {
            self.combat
                .actor_index(id)
                .is_none_or(|i| !self.combat.actors[i].alive())
        }) {
            self.stage.phase = StagePhase::Victory;
            self.combat.events.push((Event::StageCleared).into());
            self.director.transition = 1;
            self.director.transition_age = 0.;
        }
    }
    /// Transition clocks advance while combat clocks remain frozen. Reset only at full dark.
    pub(crate) fn transition_step(&mut self) -> bool {
        let phase = self.director.transition;
        if phase == 0 {
            return false;
        }
        self.combat.end_spotlight(true);
        self.director.transition_age += SIM_DT;
        let age = self.director.transition_age;
        match phase {
            1 => {
                // Keep the defeated boss available for the client's KO/fade playback.
                for a in &mut self.combat.actors {
                    if a.view.state == ActorState::Dead {
                        a.view.state_age += SIM_DT;
                    }
                }
                if age + 0.00001 >= VICTORY_HOLD {
                    self.director.transition = 2;
                    self.director.transition_age = 0.;
                }
            }
            2 | 3 => {
                let duration = if phase == 2 { VICTORY_FADE } else { WIPE_FADE };
                self.stage.fade = (age / duration).min(1.);
                if age + 0.00001 >= duration {
                    self.reset_stage(phase == 2);
                    self.stage.fade = 1.;
                    self.director.transition = 4;
                    self.combat.events.push((Event::SceneReset).into());
                }
            }
            4 => {
                self.stage.fade = (1. - age / FADE_IN).max(0.);
                if age + 0.00001 >= FADE_IN {
                    self.stage.fade = 0.;
                    self.director.transition = 0;
                    self.director.transition_age = 0.;
                }
            }
            _ => unreachable!(),
        }
        true
    }
    fn restore_party(&mut self, cleared: bool) {
        self.combat.cancel_phoenix();
        let mut revived = [None; 4];
        let mut revived_count = 0;
        // Heroes revived by a stage clear rejoin beside the living party, not where they fell.
        let rejoin = self.combat.centroid();
        for a in &mut self.combat.actors {
            if a.view.team == Team::Hero {
                if !a.alive() {
                    revived[revived_count] = Some(a.view.id);
                    revived_count += 1;
                    self.combat
                        .events
                        .push((Event::Revived { id: a.view.id }).into());
                    if let Some(k) = crate::actors::hero_index(a.view.archetype) {
                        a.view.pos =
                            crate::math::floor_point(rejoin + TRAVEL_SLOTS[k], a.view.radius);
                    }
                }
                if !cleared {
                    let k = crate::actors::hero_index(a.view.archetype).unwrap();
                    a.view.max_hp = HERO_STATS[k].hp;
                }
                let amount = a.view.max_hp - a.view.hp;
                a.view.hp = a.view.max_hp;
                if !cleared {
                    a.view.ward = 0.;
                    a.self_ward_steps = 0;
                    a.view.warcry_shield = false;
                }
                a.state(ActorState::Idle, 0., 0.);
                a.action_done = true;
                a.action_revive = false;
                a.action_special = false;
                a.action_extra = false;
                a.action_pulse = false;
                a.action_pound = false;
                a.action_target_pos = a.view.pos;
                a.action_target_teleported = false;
                a.action_target_radius = 0.;
                a.spring_camp = None;
                a.clear_ailments();

                a.target = None;
                a.destination = self.combat.formation_origin;
                a.velocity = Vec2::default();
                a.goal_cd = 0.;
                a.dodge_hazard = None;
                a.mend_cd = MEND_INTERVAL;
                a.basic_cd = 0.;
                a.reset_groove(self.combat.cfg.seed);
                a.revive_cd = 0.;
                a.revive_progress = 0.;
                a.revive_grace = 0.;
                a.undamaged = 0.;
                a.ai_cd = 0.;
                a.view.ai_intent = AiIntent::None;
                if amount > 0. {
                    self.combat.events.push(
                        (Event::Healed {
                            target: a.view.id,
                            amount,
                            source: crate::HealSource::PartyRestore,
                        })
                        .into(),
                    );
                }
            }
        }
        for hero in revived.into_iter().flatten() {
            if let Some(i) = self.combat.actor_index(hero) {
                self.combat.revive_burst(i);
            }
        }
    }
    pub(crate) fn reset_stage(&mut self, next: bool) {
        self.combat.hit_stop = None;
        self.combat.hit_stop_steps = 0;
        self.combat.cancel_phoenix();
        self.combat.end_spotlight(true);
        self.combat.spotlight.reset_waits(self.combat.combat_steps);
        if next {
            self.stage.wave += 1;
        } else {
            self.stage.buffs = empty_buffs();
            self.stage.wipes += 1;
            self.combat.events.push((Event::WaveReset).into());
        }
        self.stage.tier = ((self.stage.wave - 1) % 3 + 1) as u8;
        self.apply_party_buffs();
        self.chests.clear();
        self.chest_opener = None;
        self.chest_approach = None;
        self.combat.actors.retain(|a| a.view.team == Team::Hero);
        self.restore_party(next);
        for a in &mut self.combat.actors {
            let k = crate::actors::hero_index(a.view.archetype).unwrap();
            a.view.pos = self.combat.formation_origin + TRAVEL_SLOTS[k];
        }
        self.combat.hazards.clear();
        self.combat.projectiles.clear();
        self.director = Director::default();
        self.stage.phase = StagePhase::Lull;
        self.stage.elapsed = 0.;
        self.stage.kills = 0;
        self.stage.escalation_level = 0;
        self.stage.boss_eta = 0.;
        self.stage.mini_wave = 0;
        self.stage.mini_waves_total = mini_waves(self.stage.tier);
        self.spawn_party_auras();
    }
}

#[cfg(test)]
mod fara_ward_restore_tests {
    use super::*;
    #[test]
    fn party_restoration_tags_full_heals_without_changing_numbers_or_revives() {
        for cleared in [false, true] {
            let mut s = Sim::new(SimConfig::default());
            s.combat.actors[0].view.hp = 0.;
            s.combat.actors[0].view.state = ActorState::Downed;
            s.combat.actors[1].view.hp -= 7.;
            s.combat.events.clear();
            s.restore_party(cleared);
            let events = s.drain_events();
            let heals: Vec<_> = events
                .iter()
                .filter_map(|e| match *e {
                    Event::Healed {
                        target,
                        amount,
                        source,
                    } => Some((target, amount, source)),
                    _ => None,
                })
                .collect();
            assert_eq!(
                heals,
                vec![
                    (1, s.combat.actors[0].view.max_hp, HealSource::PartyRestore),
                    (2, 7., HealSource::PartyRestore)
                ]
            );
            assert!(events.iter().any(|e| matches!(e, Event::Revived { id: 1 })));
            assert!(s
                .combat
                .actors
                .iter()
                .filter(|a| a.view.team == Team::Hero)
                .all(|a| a.view.hp == a.view.max_hp));
        }
    }
    #[test]
    fn ward_survives_stage_clear_and_resets_on_wipe() {
        let mut s = Sim::new(SimConfig::default());
        s.combat.grant_ward(0);
        let ward = s.combat.actors[0].view.ward;
        s.reset_stage(true);
        assert_eq!(s.combat.actors[0].view.ward, ward);
        s.reset_stage(false);
        assert_eq!(s.combat.actors[0].view.ward, 0.);
    }
}

#[cfg(test)]
#[path = "wave_tests.rs"]
mod tests;
