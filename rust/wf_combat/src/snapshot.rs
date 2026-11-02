use crate::{api::*, Sim};
pub struct Hash(pub u64);
impl Hash {
    pub fn u(&mut self, x: u64) {
        for b in x.to_le_bytes() {
            self.0 = (self.0 ^ b as u64).wrapping_mul(0x100000001b3);
        }
    }
    pub fn f(&mut self, x: f32) {
        self.u(x.to_bits() as u64);
    }
    pub fn v(&mut self, p: Vec2) {
        self.f(p.x);
        self.f(p.y);
    }
    pub fn b(&mut self, b: bool) {
        self.u(b as u64);
    }
    pub fn id(&mut self, id: Option<u32>) {
        self.b(id.is_some());
        if let Some(id) = id {
            self.u(id as u64);
        }
    }
    pub fn shape(&mut self, s: Shape) {
        match s {
            Shape::Circle { radius } => {
                self.u(0);
                self.f(radius);
            }
            Shape::Ring { inner, outer } => {
                self.u(1);
                self.f(inner);
                self.f(outer);
            }
            Shape::Cone {
                length,
                half_angle_rad,
            } => {
                self.u(2);
                self.f(length);
                self.f(half_angle_rad);
            }
            Shape::Line { length, width } => {
                self.u(3);
                self.f(length);
                self.f(width);
            }
        }
    }
}
impl Sim {
    pub fn refresh_snapshot(&mut self) {
        self.snapshot.arena_min = self.floor.min;
        self.snapshot.arena_max = self.floor.max;
        self.snapshot.step = self.step_number;
        self.snapshot.time = self.step_number as f64 / SIM_HZ as f64;
        self.snapshot.combat_time = self.combat_steps as f64 / SIM_HZ as f64;
        if let Some(s) = &self.spotlight.active {
            let v = self
                .snapshot
                .spotlight
                .get_or_insert_with(|| self.spotlight_view_cache.take().unwrap());
            v.caster = s.caster;
            v.skill = s.skill;
            v.phase = s.phase;
            v.started = s.started_step as f64 / SIM_HZ as f64;
            v.participants.clear();
            v.participants.extend_from_slice(s.participants.slice());
            v.hazards.clear();
            v.hazards.extend_from_slice(s.hazards.slice());
            v.co_casters.clear();
            v.co_casters.extend_from_slice(s.co_casters.slice());
            v.projectiles.clear();
            v.projectiles.extend_from_slice(s.projectiles.slice());
        } else if let Some(v) = self.snapshot.spotlight.take() {
            self.spotlight_view_cache = Some(v);
        }
        self.snapshot.hit_stop = self.hit_stop.map(|mut v| {
            v.remaining = self.hit_stop_steps as f32 / SIM_HZ as f32;
            v
        });
        self.snapshot.phoenix_cooldown = self.phoenix.cooldown as f32 / SIM_HZ as f32;
        self.snapshot.phoenix_channel = self.phoenix.hero.map(|hero| PhoenixChannelView {
            hero,
            progress: self.phoenix.steps as f32 / (crate::tuning::REVIVE_CHANNEL * SIM_HZ as f32),
        });
        self.snapshot.camera_focus = self.centroid();
        self.snapshot.enmity.clear();
        for a in &self.actors {
            if a.alive() && crate::tuning::is_boss(a.view.archetype) {
                let mut values = a.enmity;
                for (k, v) in values.iter_mut().enumerate() {
                    if !self.actors.iter().any(|hero| {
                        hero.alive() && crate::actors::hero_index(hero.view.archetype) == Some(k)
                    }) {
                        *v = 0.;
                    }
                }
                self.snapshot.enmity.push(EnmityRow {
                    boss: a.view.id,
                    values,
                });
            }
        }
        self.snapshot.actors.clear();
        self.snapshot.hazards.clear();
        self.snapshot.projectiles.clear();
        for i in 0..self.actors.len() {
            let mut view = self.actors[i].view.clone();
            view.target = self.actors[i].target;
            view.taunted_by = self.taunt_target(i).map(|t| self.actors[t].view.id);
            view.rallied = self.enemy_rallied(i);
            self.snapshot.actors.push(view);
        }
        self.snapshot
            .hazards
            .extend(self.hazards.iter().map(|h| h.view.clone()));
        self.snapshot
            .projectiles
            .extend(self.projectiles.iter().map(|p| p.view.clone()));
    }
    pub fn hash_with_host(&self, mut host: impl FnMut(u8, &mut Hash)) -> u64 {
        let mut h = Hash(0xcbf29ce484222325);
        h.u(self.cfg.seed);
        // Preserve the reference hash for its unchanged floor.
        if self.floor.min != crate::tuning::ARENA_MIN || self.floor.max != crate::tuning::ARENA_MAX
        {
            h.u(0x464c4f4f52);
            h.v(self.floor.min);
            h.v(self.floor.max);
        }
        if self.contain_bodies {
            h.u(0x424f4459424f554e);
        }
        h.v(self.cfg.arena_size);
        h.f(self.cfg.visible_width);
        h.f(self.cfg.visible_height);
        h.u(self.cfg.cohesion as u64);
        host(0, &mut h);
        h.u(self.combat_steps);
        h.u(self.hit_stop_steps as u64);
        if let Some(v) = self.hit_stop {
            h.u(v.cause as u64 + 1);
            h.u(v.actor as u64);
        } else {
            h.u(0);
        }
        h.id(self.phoenix.held);
        h.id(self.phoenix.hero);
        h.u(self.phoenix.steps as u64);
        h.u(self.phoenix.cooldown as u64);
        // Spotlight-only provenance remains excluded when spotlights were never enabled. Once enabled, hash all future-affecting
        // configuration/history, including frozen time and fixed-capacity active contents.
        if self.spotlight.touched {
            let c = self.cfg.spotlight;
            h.u(0x53504f544c494748);
            h.u(self.combat_steps);
            h.b(c.enabled);
            h.f(c.global_gap);
            h.f(c.hero_gap);
            h.f(c.fairness);
            h.f(c.drought);
            for enabled in c.skills {
                h.b(enabled);
            }
            h.f(c.tail_cap);
            h.f(c.charge);
            h.b(c.auto_release);
            for a in &self.actors {
                h.u(a.action_epoch);
            }
            for hazard in &self.hazards {
                h.u(hazard.action_epoch);
            }
            for p in &self.projectiles {
                h.u(p.action_epoch);
                h.u(p.skill.map_or(0, |s| s as u64 + 1));
            }
            h.u(self.spotlight.last_end);
            for step in self.spotlight.last_hero {
                h.u(step);
            }
            h.b(self.spotlight.active.is_some());
            if let Some(s) = &self.spotlight.active {
                h.u(s.caster as u64);
                h.u(s.skill as u64);
                h.u(s.phase as u64);
                h.u(s.started_step);
                h.u(s.extra_steps);
                for p in s.performers {
                    h.b(p.is_some());
                    if let Some(p) = p {
                        h.u(p.actor as u64);
                        h.b(p.finished);
                        h.u(p.action_epoch.unwrap_or(0));
                        h.u(p.skill.map_or(0, |s| s as u64 + 1));
                    }
                }
                for ids in [s.co_casters.slice(), s.projectiles.slice()] {
                    h.u(ids.len() as u64);
                    for &id in ids {
                        h.u(id as u64);
                    }
                }
                h.u(s.tail_steps);
                h.u(s.charge_steps);
                h.u(s.participants.slice().len() as u64);
                for &id in s.participants.slice() {
                    h.u(id as u64);
                }
                h.u(s.hazards.slice().len() as u64);
                for &id in s.hazards.slice() {
                    h.u(id as u64);
                }
            }
        }
        h.u(self.step_number);
        h.u(self.next_id as u64);
        h.u(self.spawn_rng.0);
        h.u(self.combat_rng.0);
        host(1, &mut h);
        #[cfg(feature = "reference-diagnostics")]
        {
            h.id(self.trial_hazard);
            h.f(self.trial_hp);
            h.f(self.trial_delay);
            h.b(self.trial_landed);
            h.b(self.outcome.is_some());
            if let Some(o) = self.outcome {
                h.b(o.dodged);
                h.f(o.reaction_delay);
                h.f(o.damage_taken);
            }
        }
        h.u(self.actors.len() as u64);
        let permanent_revised = self.actors.iter().any(|actor| actor.permanent_revision > 0);
        if self.phoenix.hero.and_then(|id| self.actor_index(id)).is_some_and(|i| self.phoenix.target_max_hp != self.actors[i].view.max_hp) {
            h.u(0x50484f454e49584d); h.f(self.phoenix.target_max_hp);
        }
        for a in &self.actors {
            let v = &a.view;
            h.u(v.id as u64);
            h.u(v.team as u64);
            h.u(v.archetype as u64);
            if crate::wfm::is_wfm(v.archetype) {
                h.f(a.stats.mag);
                h.u(a.wfm_action as u64);
            }
            h.v(v.pos);
            h.u(v.facing as u64);
            h.f(v.hp);
            h.f(v.max_hp);
            h.f(v.ward);
            h.f(v.energy);
            h.b(v.enraged);
            h.u(v.state as u64);
            h.f(v.state_age);
            h.f(v.state_duration);
            h.f(v.impact_at);
            h.f(v.radius);
            h.f(v.scale);
            h.u(v.ai_intent as u64);
            if permanent_revised || a.special_potency != 1. || a.meter_rate != 1. {
                h.u(0x5245564953494f4e); h.u(a.permanent_revision);
                h.f(a.special_potency); h.f(a.meter_rate); h.u(a.action_revision);
                h.u(a.action_target_revision); h.f(a.action_target_max_hp);
                for v in [a.action_stats.hp,a.action_stats.atk,a.action_stats.def,a.action_stats.mag,a.action_stats.res,a.action_stats.speed,
                    a.action_stats.reach,a.action_stats.interval,a.action_stats.evade,a.action_stats.special,
                    a.action_max_hp,a.action_potency] { h.f(v); }
            }
            let s = a.stats;
            h.f(s.hp);
            h.f(s.atk);
            h.f(s.def);
            h.f(s.speed);
            h.f(s.reach);
            h.f(s.interval);
            h.f(s.evade);
            h.f(s.special);
            if s.mag != s.atk || s.res != s.def {
                h.u(0x4348414e4e454c53); h.f(s.mag); h.f(s.res);
            }
            h.v(a.velocity);
            h.f(a.formed_age);
            h.id(a.target);
            h.id(a.aggro_target);
            h.b(a.enmity_seeded);
            for value in a.enmity {
                h.f(value);
            }

            h.v(a.destination);
            h.f(a.goal_cd);
            h.v(a.goal_target_pos);
            h.id(a.dodge_hazard);
            h.f(a.mend_cd);
            h.u(a.enemy_phase as u64);
            h.f(a.relocate_left);
            if a.view.archetype == Archetype::Marid {
                h.u(a.view.teleport_steps as u64);
            }
            h.f(a.recharge_left);
            h.f(a.recharge_duration);
            h.b(a.phase_rule.is_some());
            if let Some(rule) = a.phase_rule {
                h.f(rule.hp_below);
                h.f(rule.length_scale);
                h.f(rule.width_scale);
                h.f(rule.radius_scale);
            }
            h.v(a.heading);
            h.f(a.basic_cd);
            h.f(a.special_cd);
            h.f(a.extra_cd);
            h.f(a.barrage_cd);
            h.u(a.barrage_serial as u64);
            h.u(a.boss_attack as u64);
            h.u(a.boss_last_attack.map_or(0, |attack| attack as u64 + 1));
            h.u(a.boss_attack_streak as u64);
            h.b(a.barrage_recharge);
            h.b(a.fortress);
            h.f(a.pulse_cd);
            h.f(a.pound_cd);
            h.f(a.skill_lockout);
            h.u(a.view.groove.map_or(0, |g| g as u64 + 1));
            h.f(a.view.meter);
            h.f(a.view.groove_active);
            h.b(a.view.special_casting);
            h.u(a.combo_phase as u64);
            h.v(a.combo_origin);
            h.id(a.combo_previous);
            h.u(a.power_choice.map_or(0, |v| if v { 2 } else { 1 }));
            h.u(a.aoe_ready_steps as u64);
            h.u(a.groove_rng.0);
            h.u(a.self_ward_steps as u64);
            h.b(a.view.warcry_shield);
            h.id(a.spring_camp);
            h.u(a.regen_wait_steps as u64);
            h.u(a.regen_tick_steps as u64);
            h.u(a.regen_ticks_left as u64);
            h.f(a.regen_remaining);
            h.u(a.taunted_by.unwrap_or(0) as u64);
            h.f(a.taunt_left);
            h.f(a.revive_cd);
            h.u(a.revive_immunity_steps as u64);
            h.u(a.burst_slow_steps as u64);
            h.f(a.poison_potency);
            h.u(a.poison_steps as u64);
            h.u(a.poison_tick_steps as u64);
            h.f(a.poison_damage);
            h.id(a.poison_source);
            h.f(a.revive_progress);
            h.f(a.revive_grace);
            h.f(a.summon_cd);
            h.f(a.undamaged);
            h.f(a.ai_cd);
            h.v(a.action_target_pos);
            h.b(a.action_target_teleported);
            if crate::tuning::is_boss(a.view.archetype) {
                h.v(a.action_aim);
            }
            h.f(a.action_target_radius);
            h.b(a.action_done);
            h.b(a.action_heal);
            h.b(a.action_special);
            h.b(a.action_extra);
            h.b(a.action_pulse);
            h.b(a.action_pound);
            h.b(a.action_revive);
            h.u(a.ai_rng.0);
            h.u(a.bubble_rng.0);
            h.u(a.push_rng.0);
            h.b(a.boss_retry_basic);
            h.b(a.boss_retry_special);
            h.u(a.bubble_steps as u64);
            h.u(a.encase_steps as u64);
            h.f(a.view.slowed);
            h.f(a.view.encased);
            h.v(a.formation_offset);
            h.u(a.serial as u64);
            h.u(a.view.elevate.map_or(0, |v| v as u64 + 1));
            h.u(a.elevate_choice.map_or(0, |v| v as u64 + 1));
        }
        h.u(self.hazards.len() as u64);
        for a in &self.hazards {
            if a.perception_pending {
                h.u(0x5045524345505449);
            }
            let v = &a.view;
            h.u(v.id as u64);
            h.u(v.kind as u64);
            h.u(v.team as u64);
            h.b(v.hostile);
            h.shape(v.shape);
            h.v(v.origin);
            h.v(v.dir);
            h.u(v.fill as u64);
            h.u(v.phase as u64);
            h.f(v.progress);
            h.f(v.width_scale);
            h.u(v.owner as u64);
            h.u(v.tier as u64);
            h.f(a.age);
            h.f(a.tracking);
            h.f(a.duration);
            h.f(a.phase_age);
            h.f(a.pulse);
            h.f(a.damage);
            h.b(a.phase_rule.is_some());
            if let Some(rule) = a.phase_rule {
                h.f(rule.hp_below);
                h.f(rule.length_scale);
                h.f(rule.width_scale);
                h.f(rule.radius_scale);
            }
            h.f(a.base_duration);
            h.f(a.base_damage);
            h.id(a.target);
            h.b(a.landing_target_pos.is_some());
            if let Some(point) = a.landing_target_pos {
                h.v(point);
            }
            h.f(a.aim_offset);
            h.u(a.policy as u64);
            for d in a.delay {
                h.f(d);
            }
            for k in a.known {
                h.b(k);
            }
            h.id(a.revive_target);
            h.b(a.spawn_kind.is_some());
            if let Some(kind) = a.spawn_kind {
                h.u(kind as u64);
            }
            for hit in a.front_hit {
                h.b(hit);
            }
            for hit in a.front_damaged {
                h.b(hit);
            }
        }
        h.u(self.projectiles.len() as u64);
        for p in &self.projectiles {
            h.u(p.view.id as u64);
            h.u(p.view.kind as u64);
            h.v(p.view.pos);
            h.v(p.view.dir);
            h.f(p.view.height);
            h.u(p.view.team as u64);
            h.u(p.source as u64);
            h.id(p.target);
            h.v(p.start);
            h.v(p.end);
            h.f(p.age);
            h.f(p.duration);
            h.f(p.damage);
            h.f(p.speed);
            h.id(p.fuse_hazard);
            h.id(p.hit_hazard);
            h.b(p.visual_only);
            h.b(p.boss_basic);
            h.f(p.poison_damage);
        }
        h.0
    }
}
