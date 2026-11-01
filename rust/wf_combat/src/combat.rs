use crate::{api::*, tuning::*, Sim};
#[derive(Clone, Debug)]
pub struct Projectile {
    pub view: ProjectileView,
    pub source: u32,
    pub target: Option<u32>,
    pub start: Vec2,
    pub end: Vec2,
    pub age: f32,
    pub duration: f32,
    pub damage: f32,
    pub speed: f32,
    pub visual_only: bool,
    /// Bombs stay on the ground until this hazard resolves, then disappear with the blast.
    pub fuse_hazard: Option<u32>,
    /// Sniper warning that owns this physical shot, for resolution/trial evidence.
    pub hit_hazard: Option<u32>,
    /// Provenance distinguishes in-flight specials from basic bolts.
    pub skill: Option<Skill>,
    pub action_epoch: u64,
    pub boss_basic: bool,
    pub poison_damage: f32,
}
impl Sim {
    pub fn damage(
        &mut self,
        source: u32,
        target: usize,
        raw: f32,
        roll: bool,
        mitigate: bool,
        element: Element,
    ) -> f32 {
        self.damage_limited(source, target, raw, roll, mitigate, element, None, false)
    }
    pub fn damage_limited(
        &mut self,
        source: u32,
        target: usize,
        raw: f32,
        roll: bool,
        mitigate: bool,
        element: Element,
        max_hp_fraction: Option<f32>,
        skip_evade: bool,
    ) -> f32 {
        if !self.actors[target].tangible() || self.actors[target].revive_immunity_steps > 0 {
            return 0.;
        }
        let crit = roll && self.combat_rng.chance(CRIT_CHANCE);
        // Unevadable contacts retain crits and all protection.
        if roll && !skip_evade && self.combat_rng.chance(self.actors[target].evade()) {
            self.events.push(Event::Evaded {
                source,
                target: self.actors[target].view.id,
            });
            return 0.;
        }
        let rallied = self.enemy_rallied(target);
        let a = &mut self.actors[target];
        let damage =
            raw * if mitigate {
                DEF_BASE
                    / ((DEF_BASE + a.defense()) * if rallied { RALLY_DEF_MULTIPLIER } else { 1. })
            } else {
                1.
            } * if crit { CRIT_MULTIPLIER } else { 1. };
        let damage =
            max_hp_fraction.map_or(damage, |fraction| damage.min(a.view.max_hp * fraction));
        let absorbed = damage.min(a.view.ward);
        a.view.ward -= absorbed;
        if a.view.ward == 0. {
            a.view.warcry_shield = false;
        }
        let loss = (damage - absorbed).min(a.view.hp);
        a.view.hp -= loss;
        if a.view.archetype == Archetype::Fara && damage > 0. {
            a.view.meter = (a.view.meter
                + (RAGE_HIT_FLAT + (absorbed + loss) / a.view.max_hp).min(RAGE_HIT_CAP))
            .min(RAGE_STOCK_CAP);
        }
        if damage > 0. {
            a.undamaged = 0.;
        }
        let interrupt = a.action_revive
            && a.committed()
            && absorbed + loss > a.view.max_hp * REVIVE_INTERRUPT_HP;
        self.events.push(Event::Hit {
            source,
            target: a.view.id,
            amount: absorbed + loss,
            crit,
            element,
            blocked: absorbed > 0.,
        });
        self.damage_enmity(source, target, absorbed + loss);
        if absorbed + loss > 0. {
            self.spotlight_affected(source, self.actors[target].view.id);
        }
        if interrupt {
            self.cancel_revive(target);
        }
        #[cfg(feature = "reference-diagnostics")]
        crate::target_lock_metrics::hit(source, self.actors[target].view.id, absorbed + loss);
        absorbed + loss
    }
    pub fn cancel_revive(&mut self, index: usize) {
        let a = &self.actors[index];
        if a.action_revive {
            if let Some(t) = a.target.and_then(|id| self.actor_index(id)) {
                self.actors[t].revive_progress = a.view.state_age.min(REVIVE_CHANNEL);
                self.actors[t].revive_grace = REVIVE_GRACE;
            }
        }
        let a = &mut self.actors[index];
        if a.action_revive {
            if let Some(target) = a.target {
                self.events.push(Event::ResurrectInterrupted {
                    reviver: a.view.id,
                    target,
                });
            }
        }
        a.action_revive = false;
        a.action_done = true;
        a.revive_cd = REVIVE_COOLDOWN * (1. - REVIVE_REFUND);
        a.view.ai_intent = AiIntent::None;
        a.ai_cd = 0.;
        a.state(ActorState::Idle, 0., 0.);
        for h in &mut self.hazards {
            if h.view.owner == a.view.id
                && h.revive_target.is_some()
                && h.view.phase != HazardPhase::Resolved
            {
                h.view.phase = HazardPhase::Resolved;
                self.events.resolved_empty(h.view.id, h.view.kind);
            }
        }
    }
    pub fn start_extra(&mut self, i: usize, target: u32) {
        self.start_action_kind(i, Some(target), true, false, true, false, false);
    }
    pub fn start_arcane_pulse(&mut self, i: usize, target: u32) {
        self.start_action_kind(i, Some(target), true, false, false, true, false);
    }
    pub fn start_ground_pound(&mut self, i: usize, target: u32) {
        self.start_action_kind(i, Some(target), true, false, false, false, true);
    }
    pub fn grant_ward(&mut self, i: usize) {
        let a = &mut self.actors[i];
        let amount =
            (a.view.max_hp * WARD_FRACTION).min((a.view.max_hp * WARD_CAP - a.view.ward).max(0.));
        a.view.ward += amount;
        self.events.push(Event::WardGained {
            target: a.view.id,
            amount,
        });
        let id = a.view.id;
        self.ward_enmity(id, amount);
        self.spotlight_affected(id, id);
    }
    pub fn taunt_recipient(&self, caster: usize, target: usize) -> bool {
        let a = &self.actors[target];
        a.tangible()
            && a.view.team == Team::Enemy
            && a.view.state != ActorState::Spawn
            && self.actors[caster].view.pos.distance(a.view.pos) <= TAUNT_RADIUS
    }
    pub fn taunt(&mut self, i: usize) {
        if !(0..self.actors.len()).any(|t| self.taunt_recipient(i, t)) {
            self.actors[i].extra_cd = 0.;
            self.actors[i].skill_lockout = 0.;
            return;
        }
        let hero = self.actors[i].view.id;
        let pos = self.actors[i].view.pos;
        let start = self.events.victim_start();
        for a in &mut self.actors {
            if a.tangible()
                && a.view.team == Team::Enemy
                && a.view.state != ActorState::Spawn
                && a.view.pos.distance(pos) <= TAUNT_RADIUS
            {
                a.taunted_by = Some(hero);
                a.taunt_left = TAUNT_DURATION;
                if is_boss(a.view.archetype) {
                    #[cfg(feature = "reference-diagnostics")]
                    let before = a.enmity[0];
                    a.enmity[0] =
                        a.enmity.iter().copied().fold(0., f32::max) * ENMITY_TAUNT_MULTIPLIER;
                    #[cfg(feature = "reference-diagnostics")]
                    crate::enmity_attribution::credit(a.view.id, 0, 21, a.enmity[0] - before);
                }
                if !a.action_heal
                    && !((is_boss(a.view.archetype) && a.view.state == ActorState::Basic
                        || a.view.archetype == Archetype::Mirewing)
                        && a.committed())
                {
                    a.target = Some(hero);
                }
                self.events.victim(a.view.id);
            }
        }
        for j in 0..self.actors.len() {
            if self.actors[j].tangible()
                && is_boss(self.actors[j].view.archetype)
                && self.actors[j].taunted_by == Some(hero)
            {
                self.choose_boss_aggro(j);
            }
        }
        // Tracking follows the new target; locked footprints and launched shots stay planted.
        for h in &mut self.hazards {
            if h.view.hostile
                && h.view.phase == HazardPhase::Tracking
                && self
                    .actors
                    .iter()
                    .any(|a| a.view.id == h.view.owner && a.taunted_by == Some(hero))
            {
                h.target = Some(hero);
            }
        }
        for j in 0..self.actors.len() {
            if self.actors[j].tangible()
                && self.actors[j].taunted_by == Some(hero)
                && self.actors[j].view.pos.distance(pos) <= TAUNT_RADIUS
            {
                self.spotlight_affected(hero, self.actors[j].view.id);
            }
        }
        self.events.taunt(hero, start);
    }
    #[cfg(feature = "reference-diagnostics")]
    pub fn split_strike(&mut self, i: usize, t: usize) {
        self.split_at(i, self.actors[t].view.pos);
    }
    pub fn split_at(&mut self, i: usize, center: Vec2) {
        let hero = self.actors[i].view.id;
        let start = self.events.victim_start();
        let mut count = 0;
        for a in &self.actors {
            if a.tangible()
                && a.view.team == Team::Enemy
                && a.view.pos.distance(center) <= SPLIT_RADIUS
            {
                self.events.victim(a.view.id);
                count += 1;
            }
        }
        if count == 0 {
            return;
        }
        self.events.split(hero, center, start);
        let a = &self.actors[i];
        let raw = a.stats.atk
            * SPLIT_POTENCY
            * if a.view.elevate == Some(ElevateVariant::Sword) {
                1. + ELEVATE_BONUS
            } else {
                1.
            }
            / count as f32;
        for j in 0..self.actors.len() {
            if self.actors[j].tangible()
                && self.actors[j].view.team == Team::Enemy
                && self.actors[j].view.pos.distance(center) <= SPLIT_RADIUS
            {
                self.damage(hero, j, raw, true, true, Element::Physical);
            }
        }
    }
    pub fn place_faze(&mut self, i: usize, target: Vec2) {
        let a = &self.actors[i];
        let center = crate::math::floor_point(target, FAZE_RADIUS);
        self.hazard(
            HazardKind::FazePool,
            a.view.id,
            None,
            center,
            Vec2::new(1., 0.),
        );
    }
    pub fn face_target(&mut self, index: usize) {
        let Some(target) = self.actors[index]
            .target
            .and_then(|id| self.actor_index(id))
        else {
            return;
        };
        let dx = self.actors[target].view.pos.x - self.actors[index].view.pos.x;
        if dx.abs() > 1. {
            self.actors[index].view.facing = if dx < 0. { Facing::Left } else { Facing::Right };
        }
    }
    pub fn start_action(&mut self, index: usize, target: Option<u32>, special: bool, revive: bool) {
        self.start_action_kind(index, target, special, revive, false, false, false);
    }
    pub fn start_action_kind(
        &mut self,
        index: usize,
        target: Option<u32>,
        special: bool,
        revive: bool,
        extra: bool,
        pulse: bool,
        pound: bool,
    ) {
        if self.actors[index].view.team == Team::Hero && self.actors[index].committed() {
            return;
        }
        let kind = self.actors[index].view.archetype;
        if special
            && !revive
            && ((kind == Archetype::Fara && !extra && !pound) || (kind == Archetype::Kaja && extra))
        {
            return;
        }
        let progress = if revive {
            target
                .and_then(|id| self.actor_index(id))
                .map_or(0., |t| self.actors[t].revive_progress)
        } else {
            0.
        };
        if let Some(t) = target.and_then(|id| self.actor_index(id)) {
            self.actors[index].action_target_pos = self.actors[t].view.pos;
            self.actors[index].action_target_radius = self.actors[t].view.radius;
        }
        self.actors[index].action_target_teleported = false;
        self.actors[index].target = target;
        self.face_target(index);
        let a = &mut self.actors[index];
        if is_boss(a.view.archetype) && !special && !revive {
            a.action_aim = (a.action_target_pos - a.view.pos).normalized();
        }
        a.action_done = false;
        a.action_heal = false;
        a.action_epoch += 1;
        a.action_special = special;
        a.action_extra = extra;
        a.action_pulse = pulse;
        a.action_pound = pound;
        a.action_revive = revive;
        a.view.special_casting =
            a.view.team == Team::Hero && ((special && !revive) || a.combo_phase != 0);
        a.velocity = Vec2::default();
        let (state, duration, impact) = if revive {
            (ActorState::Cast, REVIVE_CHANNEL, REVIVE_CHANNEL)
        } else if special {
            let (duration, impact) = match (kind, extra, pulse, pound) {
                (Archetype::Kaja, false, false, false) => (
                    ELEVATE_WINDUP + (CAST_DURATION - CAST_IMPACT),
                    ELEVATE_WINDUP,
                ),
                (Archetype::Fara, true, false, false) => {
                    (WARCRY_WINDUP + (CAST_DURATION - CAST_IMPACT), WARCRY_WINDUP)
                }
                _ => (CAST_DURATION, CAST_IMPACT),
            };
            (ActorState::Cast, duration, impact)
        } else {
            (ActorState::Basic, BASIC_DURATION, BASIC_IMPACT)
        };
        a.state(state, duration, impact);
        if revive {
            a.view.state_age = progress;
            a.view.ai_intent = AiIntent::Revive;
            a.revive_cd = REVIVE_COOLDOWN;
        } else if special {
            if a.view.team == Team::Hero {
                a.skill_lockout = 0.;
                a.view.special_casting = true;
                if a.view.archetype == Archetype::Runa && extra {
                    a.view.impact_at = CAST_DURATION;
                }
            }
            a.view.ai_intent = AiIntent::Attack;
            if a.view.team == Team::Enemy {
                a.special_cd = a.stats.special;
            }
        } else {
            a.boss_retry_basic = false;
            a.view.ai_intent = AiIntent::Attack;
            a.basic_cd = a.stats.interval * crate::tuning::basic_interval_scale(a.view.archetype);
        }
        let id = a.view.id;
        let kind = a.view.archetype;
        self.events.push(Event::ActionStarted { id, target, state });
        if special && !revive && self.actors[index].view.team == Team::Hero {
            let skill = if pound {
                Some(Skill::GroundPound)
            } else if pulse {
                Some(Skill::ArcanePulse)
            } else {
                match (kind, extra) {
                    (Archetype::Fara, false) => Some(Skill::CrimsonWard),
                    (Archetype::Fara, true) => Some(Skill::Taunt),
                    (Archetype::Hondo, false) => Some(Skill::Shadow),
                    (Archetype::Hondo, true) => Some(Skill::Split),
                    (Archetype::Runa, false) => Some(Skill::BubblePop),
                    (Archetype::Runa, true) => Some(Skill::HealingSpring),
                    (Archetype::Kaja, false) => Some(Skill::Elevate),
                    (Archetype::Kaja, true) => Some(Skill::Faze),
                    _ => None,
                }
            };
            if let Some(skill) = skill {
                let bars = match kind {
                    Archetype::Hondo => 0.,
                    Archetype::Kaja if !pulse => 2.,
                    _ => 1.,
                };
                // Combo displays its remaining drain after the one-bar commitment.
                if kind != Archetype::Hondo {
                    self.actors[index].view.meter = (self.actors[index].view.meter - bars).max(0.);
                }
                self.actors[index].aoe_ready_steps = 0;
                if kind == Archetype::Kaja {
                    let a = &mut self.actors[index];
                    if skill == Skill::Elevate && a.elevate_choice.is_none() {
                        a.elevate_choice = Some(crate::groove::roll_elevate(&mut a.groove_rng));
                    }
                    a.power_choice = None;
                }
                self.events.push(Event::GrooveSpent {
                    hero: id,
                    skill,
                    bars,
                });
                self.skill_started(id, skill, target);
            }
        }
        #[cfg(feature = "reference-diagnostics")]
        crate::target_lock_metrics::started(self, index);
        if special && !revive && !extra && kind == Archetype::Runa {
            if let Some(t) = target
                .and_then(|id| self.actor_index(id))
                .filter(|&i| self.actors[i].tangible() && self.actors[i].view.team == Team::Enemy)
            {
                let center = crate::math::floor_point(self.actors[t].view.pos, BUBBLE_RADIUS);
                self.hazard(HazardKind::BubblePop, id, target, center, Vec2::new(1., 0.));
            }
        }
        if revive {
            if let Some(t) = target.and_then(|t| self.actor_index(t)) {
                let p = self.actors[t].view.pos;
                self.events.push(Event::ResurrectStarted {
                    reviver: id,
                    target: self.actors[t].view.id,
                });
                self.hazard(HazardKind::Resurrect, id, target, p, Vec2::new(1., 0.));
                if let Some(h) = self.hazards.last_mut() {
                    h.revive_target = target;
                    h.view.fill = FillMode::Countdown;
                    h.view.phase = HazardPhase::Locked;
                    h.view.shape = Shape::Circle {
                        radius: REVIVE_RANGE,
                    };
                    h.duration = REVIVE_CHANNEL;
                    h.phase_age = progress;
                    h.view.progress = progress / REVIVE_CHANNEL;
                    h.policy = crate::hazards::HitPolicy::Snapshot;
                }
            }
        }
    }
    pub fn projectile(
        &mut self,
        source: usize,
        target: Option<u32>,
        end: Vec2,
        bomb: bool,
        damage: f32,
        fuse_hazard: Option<u32>,
    ) {
        let a = &self.actors[source];
        let start = a.view.pos;
        let id = self.next_id;
        self.next_id += 1;
        self.projectiles.push(Projectile {
            view: ProjectileView {
                id,
                kind: if bomb {
                    ProjectileKind::Bomb
                } else if a.view.archetype == Archetype::Sniper {
                    ProjectileKind::Bolt
                } else {
                    ProjectileKind::Orb
                },
                pos: start,
                dir: (end - start).normalized(),
                height: 0.,
                team: a.view.team,
            },
            source: a.view.id,
            target,
            start,
            end,
            age: 0.,
            duration: if bomb {
                BOMB_FLIGHT
            } else {
                (start.distance(end) / PROJECTILE_SPEED).max(SIM_DT)
            },
            damage,
            speed: PROJECTILE_SPEED,
            visual_only: bomb,
            fuse_hazard,
            hit_hazard: None,
            skill: self.offensive_action(source),
            action_epoch: a.action_epoch,
            boss_basic: is_boss(a.view.archetype) && a.view.state == ActorState::Basic && !bomb,
            poison_damage: if a.view.archetype == Archetype::Mirewing {
                a.enemy_poison_damage()
            } else {
                0.
            },
        });
        let p = self.projectiles.last().unwrap().clone();
        self.spotlight_projectile(&p);
        #[cfg(feature = "reference-diagnostics")]
        crate::target_lock_metrics::shot_created(self.projectiles.last().unwrap());
    }
    pub fn sniper_bolt(&mut self, h: &crate::hazards::Hazard) {
        let id = self.next_id;
        self.next_id += 1;
        self.projectiles.push(Projectile {
            view: ProjectileView {
                id,
                kind: ProjectileKind::Bolt,
                pos: h.view.origin,
                dir: h.view.dir,
                height: 0.,
                team: Team::Enemy,
            },
            source: h.view.owner,
            target: None,
            start: h.view.origin,
            end: h.view.origin
                + h.view.dir
                    * match h.view.shape {
                        Shape::Line { length, .. } => length,
                        _ => 0.,
                    },
            age: 0.,
            duration: match h.view.shape {
                Shape::Line { length, .. } => length / SNIPER_BOLT_SPEED,
                _ => 0.,
            },
            damage: h.damage,
            speed: SNIPER_BOLT_SPEED,
            visual_only: false,
            fuse_hazard: None,
            hit_hazard: Some(h.view.id),
            skill: None,
            boss_basic: false,
            poison_damage: 0.,
            action_epoch: 0,
        });
    }
    pub fn track_action_target(&mut self, i: usize) {
        let a = &self.actors[i];
        if a.view.team != Team::Hero
            || a.action_revive
            || a.action_done
            || a.action_target_teleported
            || !a.committed()
        {
            return;
        }
        if let Some(t) = a
            .target
            .and_then(|id| self.actor_index(id))
            .filter(|&t| self.actors[t].tangible())
        {
            self.actors[i].action_target_pos = self.actors[t].view.pos;
            self.actors[i].action_target_radius = self.actors[t].view.radius;
        }
    }
    pub fn actions(&mut self) {
        // Cache every committed target before another actor can kill it this step.
        for i in 0..self.actors.len() {
            self.track_action_target(i);
        }
        for i in 0..self.actors.len() {
            let a = &self.actors[i];
            if !a.tangible()
                || a.view.state == ActorState::Spawn
                || a.view.archetype != Archetype::Kaja
                || a.mend_cd > 0.
            {
                continue;
            }
            let (owner, pos, reach) = (a.view.id, a.view.pos, a.stats.reach);
            self.actors[i].mend_cd = MEND_INTERVAL;
            for t in 0..self.actors.len() {
                let a = &mut self.actors[t];
                if !a.tangible()
                    || a.view.team != Team::Hero
                    || a.view.state == ActorState::Spawn
                    || pos.distance(a.view.pos) > reach
                {
                    continue;
                }
                let amount = (a.view.max_hp * MEND_FRACTION).min(a.view.max_hp - a.view.hp);
                if amount > 0. {
                    a.view.hp += amount;
                    self.events.push(Event::Healed {
                        target: a.view.id,
                        amount,
                        source: crate::HealSource::Mend,
                    });
                    self.healing_enmity(owner, amount);
                }
            }
        }
        for i in 0..self.actors.len() {
            self.action(i);
        }
    }
    pub fn action(&mut self, i: usize) {
        if !self.actors[i].tangible()
            || self.actors[i].view.encased > 0.
            || self.actors[i].action_done
            || !matches!(
                self.actors[i].view.state,
                ActorState::Basic | ActorState::Cast
            )
        {
            return;
        }
        let target = (if self.actors[i].view.team == Team::Enemy
            && !self.actors[i].action_heal
            && !is_boss(self.actors[i].view.archetype)
        {
            self.taunt_target(i)
        } else {
            None
        })
        .or_else(|| self.actors[i].target.and_then(|id| self.actor_index(id)));
        self.track_action_target(i);
        if self.actors[i].action_revive {
            let valid = target.is_some_and(|t| {
                self.actors[t].view.state == ActorState::Downed
                    && self.actors[i].view.pos.distance(self.actors[t].view.pos) <= REVIVE_RANGE
            });
            if !valid {
                self.cancel_revive(i);
                return;
            }
        }
        if self.actors[i].view.state_age + 0.00001 < self.actors[i].view.impact_at {
            return;
        }
        self.actors[i].action_done = true;
        if !self.autonomous() {
            return;
        }
        #[cfg(feature = "reference-diagnostics")]
        crate::target_lock_metrics::action_scope(i);
        #[cfg(feature = "reference-diagnostics")]
        crate::enmity_attribution::action(self, i);
        let a = self.actors[i].clone();
        if a.action_heal {
            self.actors[i].action_heal = false;
            self.enemy_heal_impact(i);
        } else if a.action_revive {
            if let Some(t) = target {
                let hp = self.actors[t].view.max_hp * REVIVE_HP;
                self.revive_hero(t);
                self.events.push(Event::Healed {
                    target: self.actors[t].view.id,
                    amount: hp,
                    source: crate::HealSource::Revive,
                });
                self.healing_enmity(self.actors[i].view.id, hp);
                self.actors[i].revive_cd = REVIVE_COOLDOWN;
                self.actors[i].action_revive = false;
            }
        } else if a.view.archetype == Archetype::Mirewing && a.action_special {
            self.actors[i].action_done = self.mirewing_fire(i);
        } else if a.view.archetype == Archetype::Lizardo && a.action_special {
            self.lizardo_throw(i, target);
        } else if a.action_pound {
            self.hazard(
                HazardKind::GroundPound,
                a.view.id,
                if a.action_target_teleported {
                    None
                } else {
                    a.target
                },
                a.view.pos,
                (a.action_target_pos - a.view.pos).normalized(),
            );
        } else if a.action_pulse {
            self.hazard(
                HazardKind::ArcanePulse,
                a.view.id,
                if a.action_target_teleported {
                    None
                } else {
                    a.target
                },
                crate::math::floor_point(a.action_target_pos, ARCANE_PULSE_RADIUS),
                Vec2::new(1., 0.),
            );
        } else if a.action_extra && a.view.archetype == Archetype::Fara {
            self.taunt(i);
            let a = &mut self.actors[i];
            let ward = a.view.ward.max(a.view.max_hp * WARCRY_WARD_FRACTION);
            let amount = ward - a.view.ward;
            a.view.ward = ward;
            a.self_ward_steps = 0;
            a.view.warcry_shield = true;
            let id = a.view.id;
            self.events.push(Event::WardGained { target: id, amount });
            self.ward_enmity(id, amount);
        } else if a.action_extra {
            match a.view.archetype {
                Archetype::Hondo => self.split_at(i, a.action_target_pos),
                Archetype::Runa => {
                    if let Some(t) = target {
                        self.super_heal(i, t);
                    }
                }
                _ => {}
            }
        } else if a.action_special {
            match a.view.archetype {
                Archetype::Fara => self.grant_ward(i),
                Archetype::Kaja => {
                    self.actors[i].view.groove_active = ELEVATE_DURATION;
                    self.actors[i].view.elevate = self.actors[i].elevate_choice.take();
                    self.refresh_elevate();
                    self.events.push(Event::GrooveActivated {
                        hero: a.view.id,
                        groove: Groove::Power,
                        seconds: ELEVATE_DURATION,
                    });
                    self.hazard(
                        HazardKind::ElevateRing,
                        a.view.id,
                        None,
                        a.view.pos,
                        Vec2::new(1., 0.),
                    );
                }
                Archetype::Hondo => {
                    if let Some(t) = target.filter(|t| self.actors[*t].tangible()) {
                        if a.action_target_teleported
                            && self.actors[t].view.pos.distance(a.action_target_pos)
                                > a.action_target_radius + self.actors[t].view.radius
                        {
                            return;
                        }
                        let landing = if a.combo_phase != 0 {
                            self.combo_landing(i, t, a.combo_origin)
                        } else {
                            self.combo_landing(i, t, a.view.pos)
                        };
                        let Some(landing) = landing else {
                            return;
                        };
                        self.actors[i].view.pos = landing;
                        self.face_target(i);
                        if a.combo_phase == 1 {
                            self.actors[i].combo_phase = 2;
                            self.actors[i].view.groove_active = COMBO_SECONDS;
                            self.events.push(Event::GrooveActivated {
                                hero: a.view.id,
                                groove: Groove::Combo,
                                seconds: COMBO_SECONDS,
                            });
                        }
                        if a.combo_phase != 0 {
                            self.actors[i].combo_previous = Some(self.actors[t].view.id);
                        }
                        self.events.push(Event::Blink {
                            hero: a.view.id,
                            from: a.view.pos,
                            to: self.actors[i].view.pos,
                            target: self.actors[t].view.id,
                        });
                        let landed = self.damage(
                            a.view.id,
                            t,
                            a.stats.atk
                                * SHADOW_POTENCY
                                * if a.view.elevate == Some(ElevateVariant::Sword) {
                                    1. + ELEVATE_BONUS
                                } else {
                                    1.
                                },
                            true,
                            true,
                            Element::Arcane,
                        );
                        if landed > 0. {
                            let hondo = &mut self.actors[i];
                            let amount = hondo.view.max_hp * SHADOW_WARD_FRACTION;
                            hondo.view.ward = amount;
                            hondo.self_ward_steps = (SHADOW_WARD_SECONDS * SIM_HZ as f32) as u32;
                            self.events.push(Event::WardGained {
                                target: a.view.id,
                                amount,
                            });
                        }
                    }
                }
                _ => {}
            }
        } else if is_boss(a.view.archetype) {
            self.boss_basic_impact(i);
        } else if let Some(t) = target.filter(|t| self.actors[*t].alive()) {
            let raw = a.stats.atk
                * if a.view.elevate == Some(ElevateVariant::Sword) {
                    1. + ELEVATE_BONUS
                } else {
                    1.
                };
            if matches!(a.view.archetype, Archetype::Runa | Archetype::Kaja)
                || (a.view.team == Team::Enemy && a.stats.reach > 100.)
            {
                self.projectile(
                    i,
                    (!a.action_target_teleported).then_some(self.actors[t].view.id),
                    if a.action_target_teleported {
                        a.action_target_pos
                    } else {
                        self.actors[t].view.pos
                    },
                    false,
                    raw,
                    None,
                );
            } else if (a.view.team == Team::Hero
                && (!a.action_target_teleported
                    || self.actors[t].view.pos.distance(a.action_target_pos)
                        <= a.action_target_radius + self.actors[t].view.radius))
                || (a.view.team == Team::Enemy
                    && a.view.pos.distance(self.actors[t].view.pos)
                        <= a.attack_range(&self.actors[t]))
            {
                let landed = self.damage(a.view.id, t, raw, true, true, Element::Physical);
                if landed > 0. {
                    self.basic_groove(a.view.id);
                    if a.view.archetype == Archetype::Gloamink {
                        self.apply_poison(t, a.view.id, a.enemy_poison_damage());
                    }
                }
            }
        }
        #[cfg(feature = "reference-diagnostics")]
        crate::target_lock_metrics::action_end(self);
    }
    pub fn move_projectiles(&mut self) {
        for i in 0..self.projectiles.len() {
            if self
                .actor_index(self.projectiles[i].source)
                .is_some_and(|owner| {
                    is_boss(self.actors[owner].view.archetype) && !self.actors[owner].alive()
                })
            {
                continue;
            }
            if !self.spotlight_advances_projectile(&self.projectiles[i]) {
                continue;
            }
            let mut p = self.projectiles[i].clone();
            #[cfg(feature = "reference-diagnostics")]
            crate::target_lock_metrics::scope(p.view.id, true);
            #[cfg(feature = "reference-diagnostics")]
            crate::enmity_attribution::basic();
            #[cfg(feature = "reference-diagnostics")]
            crate::round14_tests::flight_launched(self, &p);
            p.age += SIM_DT;
            if p.visual_only {
                let f = (p.age / p.duration).clamp(0., 1.);
                p.view.pos = p.start + (p.end - p.start) * f;
                p.view.height = 4. * BOMB_HEIGHT * f * (1. - f);
                self.projectiles[i] = p;
                continue;
            }
            let target = p
                .target
                .and_then(|id| self.actor_index(id))
                .filter(|t| self.actors[*t].tangible());
            // Only hero mage bolts home. Enemy shots retain their launch vector.
            if target.is_none() {
                p.target = None;
            }
            let homing = p.view.team == Team::Hero
                && self.actor_index(p.source).is_some_and(|s| {
                    matches!(
                        self.actors[s].view.archetype,
                        Archetype::Runa | Archetype::Kaja
                    )
                });
            if homing {
                if let Some(t) = target {
                    p.end = self.actors[t].view.pos;
                    p.view.dir = (p.end - p.view.pos).normalized();
                }
            }
            if homing && target.is_some() {
                p.age = p.age.min(PROJECTILE_LIFETIME - SIM_DT);
            }
            let travel = if p.hit_hazard.is_some() {
                (p.speed * SIM_DT).min(p.view.pos.distance(p.end))
            } else {
                p.speed * SIM_DT
            };
            // Swept ray/body contact, ordered by entry distance, never target identity.
            let mut hit = None;
            let mut first = f32::INFINITY;
            for (j, a) in self.actors.iter().enumerate() {
                if !a.tangible()
                    || a.view.team == p.view.team
                    || (homing && target.is_some_and(|t| j != t))
                {
                    continue;
                }
                let width = p
                    .hit_hazard
                    .and_then(|id| self.hazards.iter().find(|h| h.view.id == id))
                    .map_or(0., |h| {
                        if h.view.kind == HazardKind::BossSnipe {
                            match h.view.shape {
                                Shape::Line { width, .. } => width * 0.5,
                                _ => 0.,
                            }
                        } else {
                            0.
                        }
                    });
                let entry = crate::math::projectile_entry(
                    p.view.pos,
                    p.view.dir,
                    a.view.pos,
                    a.view.radius + width,
                    if is_boss(a.view.archetype) && !(homing && target.is_some()) {
                        BOSS_HURT_HEIGHT
                    } else {
                        0.
                    },
                );
                if entry >= 0. && entry <= travel && entry < first {
                    hit = Some(j);
                    first = entry;
                }
            }
            p.view.pos = p.view.pos + p.view.dir * travel;
            if p.hit_hazard.is_some() && p.view.pos.distance(p.end) < 0.001 {
                p.age = PROJECTILE_LIFETIME;
            }
            if let Some(t) = hit {
                #[cfg(feature = "reference-diagnostics")]
                crate::round14_tests::flight_contact(p.view.id, self.actors[t].view.id);
                #[cfg(feature = "bound-diagnostics")]
                if let Some(id) = p.hit_hazard {
                    crate::bound::caught_projectile(self, id, t);
                }
                p.age = PROJECTILE_LIFETIME;
                let loss = self.damage_limited(
                    p.source,
                    t,
                    p.damage,
                    true,
                    true,
                    if p.hit_hazard.is_some() {
                        Element::Physical
                    } else if p.poison_damage > 0. {
                        Element::Poison
                    } else {
                        Element::Arcane
                    },
                    p.boss_basic.then_some(BOSS_BASIC_MAX_HP),
                    p.hit_hazard.is_some(),
                );
                if loss > 0. && p.skill.is_none() && p.view.team == Team::Hero {
                    self.basic_groove(p.source);
                }
                if loss > 0. && p.poison_damage > 0. {
                    self.apply_poison(t, p.source, p.poison_damage);
                }
                if let Some(id) = p.hit_hazard {
                    #[cfg(feature = "reference-diagnostics")]
                    crate::beam_metrics::damaged(id, loss);
                    if let Some(h) = self.hazards.iter_mut().find(|h| h.view.id == id) {
                        if let Some(k) = crate::actors::hero_index(self.actors[t].view.archetype) {
                            h.front_hit[k] = true;
                            h.front_damaged[k] = loss > 0.;
                        }
                        h.phase_age = h.duration;
                    }
                    #[cfg(feature = "reference-diagnostics")]
                    if self.trial_hazard == Some(id) {
                        self.trial_landed = true;
                    }
                }
                if loss > 0.
                    && self.actor_index(p.source).is_some_and(|s| {
                        matches!(
                            self.actors[s].view.archetype,
                            Archetype::Runa | Archetype::Kaja
                        )
                    })
                {
                    let impact = self.actors[t].view.pos;
                    for j in 0..self.actors.len() {
                        if j != t
                            && self.actors[j].tangible()
                            && self.actors[j].view.team == Team::Enemy
                            && self.actors[j].view.pos.distance(impact)
                                <= SPLASH_RADIUS + self.actors[j].view.radius
                        {
                            self.damage(
                                p.source,
                                j,
                                p.damage * SPLASH_POTENCY,
                                true,
                                true,
                                Element::Arcane,
                            );
                        }
                    }
                }
            }
            self.projectiles[i] = p;
        }
        #[cfg(feature = "reference-diagnostics")]
        crate::target_lock_metrics::clear_scope();
        #[cfg(feature = "reference-diagnostics")]
        crate::round14_tests::flight_retired(self);
        let spotlight = self.spotlight.active;
        self.projectiles.retain(|p| {
            spotlight.is_some_and(|s| !s.advances_projectile(p))
                || p.fuse_hazard.is_some()
                || (p.age < PROJECTILE_LIFETIME
                    && p.view.pos.x >= ARENA_MIN.x - PROJECTILE_MARGIN
                    && p.view.pos.x <= ARENA_MAX.x + PROJECTILE_MARGIN
                    && p.view.pos.y >= ARENA_MIN.y - PROJECTILE_MARGIN
                    && p.view.pos.y <= ARENA_MAX.y + PROJECTILE_MARGIN)
        });
    }
    /// A landed bomb lies on the ground while its drop counts down; it vanishes in the
    /// same step the drop resolves (call after `resolve_hazards`).
    pub fn prune_bombs(&mut self) {
        let hazards = &self.hazards;
        self.projectiles.retain(|p| {
            p.fuse_hazard.is_none_or(|id| {
                hazards
                    .iter()
                    .any(|h| h.view.id == id && h.view.phase == HazardPhase::Locked)
            })
        });
    }
}
