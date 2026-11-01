use crate::{actors::hero_index, api::*, math::*, tuning::*, Sim};
use wf_combat::hazards::*;
impl Sim {
    /// Paired dodge fixture with unchanged starting geometry and explicit health/phase.
    /// These conditions affect trial setup only; Slice always uses authored tuning.
    pub fn dodge_trial(
        cfg: SimConfig,
        kind: HazardKind,
        hero: Archetype,
        hp_fraction: f32,
        phase_scale: f32,
    ) -> Self {
        assert!(hp_fraction.is_finite() && hp_fraction > 0. && hp_fraction <= 1.);
        assert!(phase_scale.is_finite() && (1. ..=2.).contains(&phase_scale));
        let mut s = Self::with_scenario(cfg, Scenario::DodgeTrial { hazard: kind, hero });
        let a = &mut s.combat.actors[0];
        a.view.hp = a.view.max_hp * hp_fraction;
        // Paired HP trials preserve their starting HP until impact.
        a.undamaged = -100.;
        s.combat.trial_hp = a.view.hp;
        if phase_scale > 1. {
            let source = s.combat.hazards[0].view.owner;
            let i = s.combat.actor_index(source).unwrap();
            s.combat.actors[i].view.enraged = true;
            s.combat.actors[i].phase_rule = Some(PhaseRule {
                radius_scale: phase_scale,
                ..BOSS_PHASE
            });
            let h = &mut s.combat.hazards[0];
            h.phase_rule = s.combat.actors[i].phase_rule;
            if kind == HazardKind::BossSnipe {
                if let Some(r) = &mut h.phase_rule {
                    r.length_scale = 1.;
                    r.width_scale = phase_scale;
                }
            }
            h.view.shape = scaled_shape(h.view.shape, h.phase_rule, h.view.origin, h.view.dir);
            h.duration = countdown(kind, h.view.shape, h.base_duration);
            h.damage = h.base_damage * (h.duration / h.base_duration).max(1.);
        }
        s.refresh_snapshot();
        s
    }
    pub(crate) fn setup_trial(&mut self, kind: HazardKind, hero: Archetype) {
        let hero = if hero_index(hero).is_some() {
            hero
        } else {
            Archetype::Fara
        };
        let id = self.spawn_actor(hero, TRIAL_ORIGIN);
        self.combat.trial_hp = self.combat.actors[0].view.hp;
        let angle = self.combat.spawn_rng.range(0., TAU);
        let dir = direction(angle);
        let source_kind = match kind {
            HazardKind::SniperLine => Archetype::Sniper,
            HazardKind::BossSnipe => Archetype::BossMarksman,
            HazardKind::BossNova => Archetype::BossBomber,
            HazardKind::LizardoDrop => Archetype::Lizardo,
            HazardKind::FizzmiteBlast => Archetype::Fizzmite,
            _ => Archetype::Boss,
        };
        let (origin, aim) = match kind {
            HazardKind::SniperLine | HazardKind::BossSnipe => (dir * -220., dir),
            HazardKind::BossNova => (
                dir * self.combat.spawn_rng.range(0., NOVA_RADIUS * 0.95),
                dir,
            ),
            HazardKind::BossCharge => (dir * -self.combat.spawn_rng.range(180., 350.), dir),
            HazardKind::BossCone => {
                let d = self.combat.spawn_rng.range(35., CONE_LENGTH);
                (dir * -d, dir)
            }
            HazardKind::FizzmiteBlast => {
                (dir * self.combat.spawn_rng.range(0., FIZZMITE_TRIGGER), dir)
            }
            HazardKind::BossSlam => (
                dir * self.combat.spawn_rng.range(0., SLAM_RADIUS * 0.95),
                dir,
            ),
            _ => (
                dir * self.combat.spawn_rng.range(0., BOMB_RADIUS * 0.95),
                dir,
            ),
        };
        let origin = TRIAL_ORIGIN + origin;
        // Trials place hazards directly, with enemy movement/body physics disabled.
        let source = self.spawn_actor(source_kind, origin);
        // Trials sample an ongoing basic, rather than granting every hero an idle start.
        let a = &mut self.combat.actors[0];
        a.view.facing = if a.ai_rng.chance(0.5) {
            Facing::Left
        } else {
            Facing::Right
        };
        a.state(ActorState::Basic, BASIC_DURATION, BASIC_IMPACT);
        a.view.state_age = a.ai_rng.range(0., BASIC_DURATION);
        a.action_done = a.view.state_age >= BASIC_IMPACT;
        let hid = self.hazard(kind, source, Some(id), origin, aim);
        self.combat.trial_hazard = Some(hid);
        if let Some(h) = self.combat.hazards.last() {
            if let Some(i) = hero_index(hero) {
                self.combat.trial_delay = h.delay[i];
            }
        }
    }
}
