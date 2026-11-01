use crate::{api::*, Sim};
impl Sim {
    pub(crate) fn refresh_snapshot(&mut self) {
        self.combat.refresh_snapshot();
        let src = self.combat.snapshot();
        let dst = &mut self.snapshot;
        dst.step = src.step;
        dst.time = src.time;
        dst.combat_time = src.combat_time;
        dst.hit_stop = src.hit_stop;
        dst.phoenix_cooldown = src.phoenix_cooldown;
        dst.phoenix_channel = src.phoenix_channel;
        dst.camera_focus = src.camera_focus;
        dst.arena_min = src.arena_min;
        dst.arena_max = src.arena_max;
        dst.actors.clone_from(&src.actors);
        dst.hazards.clone_from(&src.hazards);
        dst.projectiles.clone_from(&src.projectiles);
        dst.enmity.clone_from(&src.enmity);
        if let Some(v) = &src.spotlight {
            let out = dst
                .spotlight
                .get_or_insert_with(|| self.snapshot_spotlight_cache.take().unwrap());
            out.caster = v.caster;
            out.skill = v.skill;
            out.phase = v.phase;
            out.started = v.started;
            out.participants.clone_from(&v.participants);
            out.hazards.clone_from(&v.hazards);
            out.co_casters.clone_from(&v.co_casters);
            out.projectiles.clone_from(&v.projectiles);
        } else if let Some(v) = dst.spotlight.take() {
            self.snapshot_spotlight_cache = Some(v);
        }
        self.snapshot.stage.clone_from(&self.stage);
        self.snapshot.chests.clone_from(&self.chests);
    }
    pub(crate) fn hash_state(&self) -> u64 {
        self.combat.hash_with_host(|section, h| match section {
            0 => match self.scenario {
                Scenario::Slice => h.u(0),
                Scenario::DodgeTrial { hazard, hero } => {
                    h.u(1);
                    h.u(hazard as u64);
                    h.u(hero as u64);
                }
            },
            1 => {
                h.u(self.reward_rng.0);
                h.id(self.chest_opener);
                h.b(self.chest_approach.is_some());
                if let Some((point, facing)) = self.chest_approach {
                    h.v(point);
                    h.u(facing as u64);
                }
                h.v(self.combat.formation_origin);
                h.u(self.stage.phase as u64);
                h.u(self.stage.wave as u64);
                h.f(self.stage.elapsed);
                h.f(self.stage.boss_eta);
                h.u(self.stage.escalation_level as u64);
                h.u(self.stage.wipes as u64);
                h.u(self.stage.kills as u64);
                h.u(self.stage.mini_wave as u64);
                h.u(self.stage.mini_waves_total as u64);
                h.u(self.stage.tier as u64);
                h.f(self.stage.fade);
                h.f(self.stage.buffs.attack);
                h.f(self.stage.buffs.defense);
                h.f(self.stage.buffs.range);
                h.f(self.stage.buffs.attack_speed);
                h.u(self.chests.len() as u64);
                for c in &self.chests {
                    h.u(c.id as u64);
                    h.v(c.pos);
                    h.u(c.state as u64);
                    h.f(c.state_age);
                    h.b(c.reward.is_some());
                    if let Some(r) = c.reward {
                        h.u(r as u64);
                    }
                }
                let d = &self.director;
                h.v(d.last_fall);
                h.b(d.chest_due);
                h.u(d.transition as u64);
                h.f(d.transition_age);
                h.u(d.ticks);
                h.f(d.clear_age);
                h.u(d.entry as u64);
                h.u(d.spawned as u64);
                h.u(d.subwave as u64);
                h.u(d.subwave_count as u64);
                h.f(d.subwave_age);
                for i in 0..d.subwave_count {
                    h.u(d.subwave_markers[i] as u64);
                    h.u(d.subwave_units[i] as u64);
                }
                h.f(d.wave_age);
                h.v(d.wave_origin);
                h.v(d.boss_spawn_pos);
                h.b(d.wave_active);
                h.b(self.wave_combat_complete());
                h.id(d.boss);
                h.f(d.boss_started);
                h.u(d.wipe_ticks as u64);
                h.u(d.victory_ticks as u64);
            }
            _ => unreachable!(),
        })
    }
}
