use crate::{api::*, rng::Rng, tuning::*};
#[derive(Clone, Debug)]
pub struct Actor {
    pub permanent_revision: u64,
    pub special_potency: f32,
    pub meter_rate: f32,
    pub action_revision: u64,
    pub action_target_revision: u64,
    pub action_target_max_hp: f32,
    pub action_stats: Stats,
    pub action_max_hp: f32,
    pub action_potency: f32,
    pub view: ActorView,
    pub stats: Stats,
    pub wfm_action: u8,
    pub velocity: Vec2,
    pub formed_age: f32,
    pub target: Option<u32>,
    pub enmity: [f32; 4],
    pub enmity_seeded: bool,
    pub aggro_target: Option<u32>,
    pub taunted_by: Option<u32>,
    pub taunt_left: f32,
    pub destination: Vec2,
    pub goal_cd: f32,
    pub goal_target_pos: Vec2,
    pub dodge_hazard: Option<u32>,
    pub mend_cd: f32,
    /// 0 ready/recharging, 2 waiting for telegraph resolution, 3 relocating.
    pub enemy_phase: u8,
    pub relocate_left: f32,
    pub recharge_left: f32,
    pub recharge_duration: f32,
    pub phase_rule: Option<PhaseRule>,
    pub heading: Vec2,
    pub basic_cd: f32,
    pub special_cd: f32,
    pub extra_cd: f32,
    pub barrage_cd: f32,
    pub barrage_serial: u32,
    pub barrage_recharge: bool,
    pub fortress: bool,
    pub pulse_cd: f32,
    pub pound_cd: f32,
    pub skill_lockout: f32,
    /// 0 idle, 1 first-hop charge, 2 draining, 3 Split, 4 empty-burst cast recovery.
    pub combo_phase: u8,
    pub combo_origin: Vec2,
    pub combo_previous: Option<u32>,
    pub power_choice: Option<bool>,
    pub aoe_ready_steps: u32,
    pub groove_rng: Rng,
    pub self_ward_steps: u32,
    pub spring_camp: Option<u32>,
    pub regen_wait_steps: u32,
    pub regen_tick_steps: u32,
    pub regen_ticks_left: u32,
    pub regen_remaining: f32,
    pub revive_cd: f32,
    pub revive_immunity_steps: u32,
    pub burst_slow_steps: u32,
    /// Outgoing enemy poison multiplier, independent of ordinary combat strength.
    pub poison_potency: f32,
    pub poison_steps: u32,
    pub poison_tick_steps: u32,
    pub poison_damage: f32,
    pub poison_source: Option<u32>,
    /// Earned channel seconds belong to the downed ally and can be resumed by anyone.
    pub revive_progress: f32,
    pub revive_grace: f32,
    pub summon_cd: f32,
    pub undamaged: f32,
    pub ai_cd: f32,
    /// Last living locked target position survives target removal during a wind-up.
    pub action_target_pos: Vec2,
    pub action_target_teleported: bool,
    pub action_aim: Vec2,
    pub action_target_radius: f32,
    pub action_done: bool,
    pub action_heal: bool,
    pub action_epoch: u64,
    pub action_special: bool,
    pub action_extra: bool,
    pub action_pulse: bool,
    pub action_pound: bool,
    pub action_revive: bool,
    pub ai_rng: Rng,
    pub bubble_rng: Rng,
    pub push_rng: Rng,
    pub boss_retry_basic: bool,
    pub boss_retry_special: bool,
    pub bubble_steps: u32,
    pub encase_steps: u32,
    pub formation_offset: Vec2,
    pub serial: u32,
    pub boss_attack: crate::enmity::BossAttack,
    pub boss_last_attack: Option<crate::enmity::BossAttack>,
    pub boss_attack_streak: u8,
    /// Pending Power choice, retained through affordability wait and committed wind-up.
    pub elevate_choice: Option<ElevateVariant>,
}
impl Actor {
    pub fn has_committed_inputs(&self) -> bool {
        self.action_epoch > 0 && matches!(self.view.state, ActorState::Basic | ActorState::Cast)
    }
    pub fn committed_stats(&self) -> Stats { if self.has_committed_inputs() { self.action_stats } else { self.stats } }
    pub fn committed_max_hp(&self) -> f32 { if self.has_committed_inputs() { self.action_max_hp } else { self.view.max_hp } }
    pub fn committed_potency(&self) -> f32 { if self.has_committed_inputs() { self.action_potency } else { self.special_potency } }

    pub fn enemy_poison_damage(&self) -> f32 {
        ENEMY_POISON_TICK_DAMAGE * self.poison_potency
    }

    pub fn new(id: u32, kind: Archetype, pos: Vec2, resolved: Stats, seed: u64) -> Self {
        let stats = resolved;
        let hero = hero_index(kind);
        let mut formation_rng = Rng(seed ^ (id as u64).wrapping_mul(0xa0761d6478bd642f));
        let formation_offset = if hero.is_none() {
            Vec2::new(
                formation_rng.range(-ENEMY_FORMATION_OFFSET, ENEMY_FORMATION_OFFSET),
                formation_rng.range(-ENEMY_FORMATION_OFFSET, ENEMY_FORMATION_OFFSET),
            )
        } else {
            Vec2::default()
        };
        let mut actor = Self {
            permanent_revision: 0, special_potency: 1., meter_rate: 1., action_revision: 0,
            action_target_revision: 0, action_target_max_hp: 0., action_stats: stats, action_max_hp: stats.hp, action_potency: 1.,
            wfm_action: 0,
            view: ActorView {
                id,
                team: if hero.is_some() {
                    Team::Hero
                } else {
                    Team::Enemy
                },
                archetype: kind,
                pos,
                facing: Facing::Right,
                hp: stats.hp,
                max_hp: stats.hp,
                ward: 0.,
                energy: if is_boss(kind) { 1. } else { 0. },
                enraged: false,
                state: ActorState::Idle,
                state_age: 0.,
                state_duration: 0.,
                impact_at: 0.,
                radius: if is_boss(kind) {
                    BOSS_BODY_RADIUS
                } else {
                    BODY_RADIUS
                },
                scale: if is_boss(kind) { BOSS_SCALE } else { 1. },
                ai_intent: AiIntent::None,
                slowed: 0.,
                encased: 0.,
                target: None,
                poisoned: 0.,
                rallied: false,
                warcry_shield: false,
                groove: match kind {
                    Archetype::Fara => Some(Groove::Rage),
                    Archetype::Hondo => Some(Groove::Combo),
                    Archetype::Runa => Some(Groove::Super),
                    Archetype::Kaja => Some(Groove::Power),
                    _ => None,
                },
                meter: GROOVE_START_METER,
                groove_active: 0.,
                elevate: None,
                special_casting: false,
                teleport_steps: 0,
                taunted_by: None,
            },
            stats,
            velocity: Vec2::default(),
            formed_age: 10.,
            target: None,
            enmity: [0.; 4],
            enmity_seeded: false,
            aggro_target: None,
            taunted_by: None,
            taunt_left: 0.,
            destination: pos,
            goal_cd: 0.,
            goal_target_pos: pos,
            dodge_hazard: None,
            mend_cd: MEND_INTERVAL,
            enemy_phase: 0,
            relocate_left: 0.,
            recharge_left: 0.,
            recharge_duration: BOSS_RECHARGE,
            phase_rule: (is_boss(kind)).then_some(BOSS_PHASE),
            heading: Vec2::new(0., -1.),
            basic_cd: 0.,
            special_cd: stats.special,
            extra_cd: 0.,
            barrage_cd: 0.,
            barrage_serial: 0,
            barrage_recharge: false,
            fortress: false,
            pulse_cd: 0.,
            pound_cd: 0.,
            skill_lockout: 0.,
            combo_phase: 0,
            combo_origin: pos,
            combo_previous: None,
            power_choice: None,
            aoe_ready_steps: 0,
            groove_rng: Rng(seed ^ (id as u64).wrapping_mul(0x47524f4f564531)),
            self_ward_steps: 0,
            spring_camp: None,
            regen_wait_steps: if kind == Archetype::BossBomber {
                (CHIMERA_REGEN_INTERVAL * SIM_HZ as f32) as u32
            } else {
                0
            },
            regen_tick_steps: 0,
            regen_ticks_left: 0,
            regen_remaining: 0.,
            revive_cd: 0.,
            revive_immunity_steps: 0,
            burst_slow_steps: 0,
            poison_potency: 1.,
            poison_steps: 0,
            poison_tick_steps: 0,
            poison_damage: 0.,
            poison_source: None,
            revive_progress: 0.,
            revive_grace: 0.,
            summon_cd: SUMMON_INTERVAL,
            undamaged: 0.,
            ai_cd: hero.unwrap_or(0) as f32 * AI_INTERVAL / 4.,
            action_target_pos: pos,
            action_target_teleported: false,
            action_aim: Vec2::new(1., 0.),
            action_target_radius: 0.,
            action_done: false,
            action_heal: false,
            action_epoch: 0,
            action_special: false,
            action_extra: false,
            action_pulse: false,
            action_pound: false,
            action_revive: false,
            ai_rng: Rng(seed ^ (id as u64).wrapping_mul(0xd6e8feb86659fd93)),
            boss_retry_basic: false,
            boss_retry_special: false,
            push_rng: Rng(seed ^ (id as u64).wrapping_mul(0x50555348424f5353)),
            bubble_rng: Rng(seed ^ (id as u64).wrapping_mul(0x42425542424c4531)),
            bubble_steps: 0,
            encase_steps: 0,
            formation_offset,
            serial: 0,
            boss_attack: crate::enmity::BossAttack::choices(kind)
                .first()
                .copied()
                .unwrap_or(crate::enmity::BossAttack::Charge),
            boss_last_attack: None,
            boss_attack_streak: 0,
            elevate_choice: None,
        };
        if hero.is_some() {
            actor.reset_groove(seed);
        }
        actor
    }
    /// Scene restoration clears groove commitments and their meters.
    pub fn reset_groove(&mut self, _seed: u64) {
        self.skill_lockout = 0.;
        self.special_cd = 0.;
        self.extra_cd = 0.;
        self.pulse_cd = 0.;
        self.pound_cd = 0.;
        self.view.meter = GROOVE_START_METER;
        self.view.groove_active = 0.;
        self.view.special_casting = false;
        self.combo_phase = 0;
        self.combo_origin = self.view.pos;
        self.combo_previous = None;
        self.power_choice = None;
        self.elevate_choice = None;
        self.view.elevate = None;
        self.aoe_ready_steps = 0;
    }

    pub fn begin_spawn(&mut self) {
        self.formed_age = 0.;
        self.velocity = Vec2::default();
        self.state(ActorState::Spawn, SPAWN_CLIP, 0.);
    }
    pub fn alive(&self) -> bool {
        self.view.hp > 0. && !matches!(self.view.state, ActorState::Dead | ActorState::Downed)
    }
    /// Combat presence excludes every teleport phase, including fade-in.
    pub fn tangible(&self) -> bool {
        self.alive() && self.view.teleport_steps == 0
    }
    pub fn committed(&self) -> bool {
        matches!(self.view.state, ActorState::Basic | ActorState::Cast)
            && (self.view.state_age < self.view.state_duration
                || ((self.action_revive || self.action_heal || self.action_special)
                    && !self.action_done))
    }
    pub fn state(&mut self, state: ActorState, duration: f32, impact: f32) {
        if self.view.state != state || duration > 0. {
            self.view.state = state;
            self.view.state_age = 0.;
        }
        self.view.state_duration = duration;
        self.view.impact_at = impact;
    }
    /// Weapon reach is measured from body edge to body edge.
    pub fn attack_range(&self, target: &Actor) -> f32 {
        self.reach() + self.view.radius + target.view.radius
    }
    pub fn reach(&self) -> f32 {
        self.stats.reach * self.reach_scale()
    }
    pub fn committed_reach(&self) -> f32 {
        self.committed_stats().reach * if self.view.elevate == Some(ElevateVariant::Wings) { 1. + ELEVATE_RANGE_BONUS } else { 1. }
    }
    pub fn reach_scale(&self) -> f32 {
        if self.view.elevate == Some(ElevateVariant::Wings) {
            1. + ELEVATE_RANGE_BONUS
        } else {
            1.
        }
    }
    pub fn evade(&self) -> f32 {
        if self.view.elevate == Some(ElevateVariant::Wings) {
            (self.stats.evade + ELEVATE_EVADE_BONUS).min(ELEVATE_EVADE_CAP)
        } else {
            self.stats.evade
        }
    }
    pub fn defense(&self) -> f32 { self.defense_for(DamageChannel::Physical) }
    pub fn defense_for(&self, channel: DamageChannel) -> f32 {
        (match channel { DamageChannel::Physical => self.stats.def, DamageChannel::Magic => self.stats.res })
            * if self.view.elevate == Some(ElevateVariant::WingedBoots) {
                1. + ELEVATE_DEF_BONUS
            } else {
                1.
            }
    }
    pub fn cone_origin(&self, dir: Vec2) -> Vec2 {
        self.view.pos + dir * self.view.radius
    }
    pub fn movement_scale(&self) -> f32 {
        if self.view.encased > 0. {
            0.
        } else {
            1. - self.view.slowed
        }
    }
    pub fn speed(&self) -> f32 {
        let bonus = match self.view.elevate {
            Some(ElevateVariant::Sword) => ELEVATE_MOVE_BONUS,
            Some(ElevateVariant::WingedBoots) => ELEVATE_BOOTS_MOVE_BONUS,
            _ => 0.,
        };
        self.stats.speed * self.movement_scale() * (1. + bonus)
    }
}
pub fn hero_index(kind: Archetype) -> Option<usize> {
    HEROES.iter().position(|k| *k == kind)
}
impl crate::Sim {
    pub fn actor_index(&self, id: u32) -> Option<usize> {
        self.actors.iter().position(|a| a.view.id == id)
    }
    pub fn centroid(&self) -> Vec2 {
        let mut sum = Vec2::default();
        let mut n = 0;
        for a in &self.actors {
            if a.view.team == Team::Hero && a.alive() {
                sum = sum + a.view.pos;
                n += 1;
            }
        }
        if n > 0 {
            sum * (1. / n as f32)
        } else {
            self.formation_origin
        }
    }
    pub fn spawn_floor(&self, kind: Archetype, radius: f32) -> crate::math::Floor {
        if !self.contain_bodies {
            return self.floor;
        }
        let (half, top, bottom) = if is_boss(kind) {
            (176., 370., 40.)
        } else {
            (112., 210., 30.)
        };
        crate::math::Floor {
            min: self.floor.min + Vec2::new(half - radius, top - radius),
            max: self.floor.max - Vec2::new(half - radius, bottom - radius),
        }
    }
    pub fn actor_floor(&self, i: usize) -> crate::math::Floor {
        let a = &self.actors[i].view;
        self.spawn_floor(a.archetype, a.radius)
    }
    pub fn spawn_actor(&mut self, kind: Archetype, pos: Vec2, resolved: Stats) -> u32 {
        let id = self.next_id;
        self.next_id += 1;
        self.prd.push((id, crate::prd::State::default()));
        self.actors.push(Actor::new(
            id,
            kind,
            self.spawn_floor(
                kind,
                if is_boss(kind) {
                    BOSS_BODY_RADIUS
                } else {
                    BODY_RADIUS
                },
            )
            .point(
                pos,
                if is_boss(kind) {
                    BOSS_BODY_RADIUS
                } else {
                    BODY_RADIUS
                },
            ),
            resolved,
            self.cfg.seed,
        ));
        self.seed_enmity(self.actors.len() - 1);
        if matches!(kind, Archetype::Bastorto | Archetype::Marid) {
            self.hazard(
                if kind == Archetype::Marid {
                    HazardKind::KajaAura
                } else {
                    HazardKind::RallyAura
                },
                id,
                None,
                self.actors.last().unwrap().view.pos,
                Vec2::new(1., 0.),
            );
        }
        self.events.push(Event::Spawned {
            id,
            archetype: kind,
        });
        id
    }
    pub fn taunt_target(&self, index: usize) -> Option<usize> {
        let a = &self.actors[index];
        a.taunted_by
            .filter(|_| a.taunt_left > 0.)
            .and_then(|id| self.actor_index(id))
            .filter(|&t| self.actors[t].alive())
    }
    pub fn enemy_target(&self, index: usize) -> Option<usize> {
        if is_boss(self.actors[index].view.archetype) {
            self.enmity_target(index, self.boss_basic_next(index))
        } else {
            self.taunt_target(index)
                .or_else(|| {
                    if self.actors[index].view.archetype == Archetype::Gloamink {
                        self.gloamink_target(index)
                    } else {
                        None
                    }
                })
                .or_else(|| self.nearest(index, Team::Hero, false))
        }
    }
    pub fn nearest(&self, index: usize, team: Team, downed: bool) -> Option<usize> {
        let p = self.actors[index].view.pos;
        self.actors
            .iter()
            .enumerate()
            .filter(|(_, a)| {
                a.view.team == team
                    && if downed {
                        a.view.state == ActorState::Downed
                    } else {
                        a.tangible()
                    }
            })
            .min_by(|(_, a), (_, b)| p.distance(a.view.pos).total_cmp(&p.distance(b.view.pos)))
            .map(|(i, _)| i)
    }
    pub fn deaths(&mut self) {
        for i in 0..self.actors.len() {
            if self.actors[i].taunted_by.is_some() && self.taunt_target(i).is_none() {
                self.actors[i].taunted_by = None;
                self.actors[i].taunt_left = 0.;
            }
        }
        for i in 0..self.actors.len() {
            if self.actors[i].view.hp <= 0.
                && !matches!(
                    self.actors[i].view.state,
                    ActorState::Dead | ActorState::Downed
                )
            {
                if self.actors[i].view.team == Team::Hero {
                    self.begin_hit_stop(HitStopCause::HeroDowned, self.actors[i].view.id);
                } else if is_boss(self.actors[i].view.archetype) {
                    self.begin_hit_stop(HitStopCause::BossDied, self.actors[i].view.id);
                }
                if self.actors[i].view.archetype == Archetype::Fizzmite
                    // MAX is the existing, hashed lifetime fuse latch; timers cannot decrement it.
                    && self.actors[i].basic_cd != f32::MAX
                    && !self.hazards.iter().any(|h| {
                        h.view.owner == self.actors[i].view.id
                            && h.view.kind == HazardKind::FizzmiteBlast
                            && h.view.phase == HazardPhase::Locked
                    })
                {
                    let a = &self.actors[i];
                    let target = a.target;
                    let aim = target
                        .and_then(|id| self.actor_index(id))
                        .map_or(a.heading, |t| self.actors[t].view.pos - a.view.pos);
                    self.hazard(
                        HazardKind::FizzmiteBlast,
                        a.view.id,
                        target,
                        a.view.pos,
                        aim,
                    );
                }
                if self.actors[i].view.archetype == Archetype::Bastorto {
                    let owner = self.actors[i].view.id;
                    for h in &mut self.hazards {
                        if h.view.owner == owner
                            && h.view.kind == HazardKind::RallyAura
                            && h.view.phase != HazardPhase::Resolved
                        {
                            h.view.phase = HazardPhase::Resolved;
                            self.events.resolved_empty(h.view.id, h.view.kind);
                        }
                    }
                }
            }
            if self.actors[i].view.hp <= 0. && self.actors[i].action_revive {
                self.cancel_revive(i);
            }
            if self.actors[i].view.hp <= 0. && is_boss(self.actors[i].view.archetype) {
                self.cancel_boss_moves_on_death(self.actors[i].view.id);
            }
            let a = &mut self.actors[i];
            if a.view.hp <= 0. && !matches!(a.view.state, ActorState::Dead | ActorState::Downed) {
                if a.self_ward_steps > 0 || a.view.warcry_shield {
                    a.self_ward_steps = 0;
                    a.view.ward = 0.;
                    a.view.warcry_shield = false;
                }
                a.spring_camp = None;
                a.clear_ailments();
                a.regen_ticks_left = 0;
                a.regen_tick_steps = 0;
                a.regen_remaining = 0.;
                a.view.hp = 0.;
                a.velocity = Vec2::default();
                if a.view.team == Team::Hero {
                    if a.view.archetype == Archetype::Hondo && a.combo_phase != 0 {
                        a.view.meter = 0.;
                    }
                    a.combo_phase = 0;
                    a.view.groove_active = 0.;
                    a.view.special_casting = false;
                    a.state(ActorState::Downed, 0., 0.);
                    self.events.push(Event::Downed { id: a.view.id });
                } else {
                    a.state(ActorState::Dead, 0., 0.);
                    self.defeats.push(a.view.pos);
                    self.events.push(Event::Died { id: a.view.id });
                }
            }
        }
        self.refresh_elevate();
    }
    pub fn timers(&mut self) {
        let mut breather = None;
        for i in 0..self.actors.len() {
            let id = self.actors[i].view.id;
            if self.actors[i].view.state == ActorState::Downed
                && self.actors[i].revive_progress > 0.
                && !self
                    .actors
                    .iter()
                    .any(|a| a.alive() && a.action_revive && a.target == Some(id))
            {
                let a = &mut self.actors[i];
                let decay_time = (SIM_DT - a.revive_grace).max(0.);
                a.revive_grace = (a.revive_grace - SIM_DT).max(0.);
                a.revive_progress *= libm::powf(1. - REVIVE_DECAY, decay_time);
            }
        }
        for a in &mut self.actors {
            if a.self_ward_steps > 0 {
                a.self_ward_steps -= 1;
                if a.self_ward_steps == 0 {
                    a.view.ward = 0.;
                    a.view.warcry_shield = false;
                }
            }
            a.revive_immunity_steps = a.revive_immunity_steps.saturating_sub(1);
            if a.view.encased > 0. {
                continue;
            }
            if a.view.archetype == Archetype::BossBomber {
                if !a.alive() {
                    a.regen_ticks_left = 0;
                    a.regen_tick_steps = 0;
                    a.regen_remaining = 0.;
                } else {
                    a.regen_wait_steps = a.regen_wait_steps.saturating_sub(1);
                    if a.regen_ticks_left > 0 {
                        a.regen_tick_steps += 1;
                        if a.regen_tick_steps >= (CHIMERA_REGEN_TICK_SECONDS * SIM_HZ as f32) as u32
                        {
                            let budget = a.regen_remaining / a.regen_ticks_left as f32;
                            let amount = budget.min((a.view.max_hp - a.view.hp).max(0.));
                            a.view.hp = (a.view.hp + amount).min(a.view.max_hp);
                            a.regen_remaining -= budget;
                            a.regen_ticks_left -= 1;
                            a.regen_tick_steps = 0;
                            self.events.push(Event::Healed {
                                target: a.view.id,
                                amount,
                                source: crate::HealSource::EnemyRegen,
                            });
                        }
                    }
                    if a.regen_wait_steps == 0
                        && a.regen_ticks_left == 0
                        && a.view.hp < a.view.max_hp
                    {
                        a.regen_remaining = a.view.max_hp * CHIMERA_REGEN_FRACTION;
                        a.regen_ticks_left =
                            (CHIMERA_REGEN_SECONDS / CHIMERA_REGEN_TICK_SECONDS) as u32;
                        a.regen_tick_steps = 0;
                        a.regen_wait_steps = (CHIMERA_REGEN_INTERVAL * SIM_HZ as f32) as u32;
                        self.events.push(Event::RegenStarted {
                            id: a.view.id,
                            total: a.regen_remaining,
                            seconds: CHIMERA_REGEN_SECONDS,
                        });
                    }
                }
            }
            a.view.state_age += SIM_DT;
            if is_boss(a.view.archetype) && a.view.state == ActorState::Cast {
                if let Some(left) = crate::boss_commit::warning_left(&self.hazards, a.view.id) {
                    a.view.state_duration = a.view.state_age + left;
                }
            }
            if a.view.state == ActorState::Spawn {
                if a.view.state_age + 0.00001 >= a.view.state_duration {
                    a.state(ActorState::Idle, 0., 0.);
                }
            } else {
                a.formed_age += SIM_DT;
            }
            if a.alive() {
                if let Some(rule) = a.phase_rule {
                    if !a.view.enraged && a.view.hp < a.view.max_hp * rule.hp_below {
                        a.view.enraged = true;
                        if a.recharge_left > 0. {
                            let base = crate::barrage::boss_recharge_seconds(a.view.archetype, self.modifiers.recharge_haste, false);
                            let enraged = crate::barrage::boss_recharge_seconds(a.view.archetype, self.modifiers.recharge_haste, true);
                            let duration = a.recharge_duration * (enraged / base);
                            a.recharge_left *= duration / a.recharge_duration;
                            a.recharge_duration = duration;
                        }
                        self.events.push(Event::Enraged { id: a.view.id });
                    }
                }
                if a.recharge_left > 0. {
                    a.recharge_left = (a.recharge_left - SIM_DT).max(0.);
                    a.view.energy = (1. - a.recharge_left / a.recharge_duration).clamp(0., 1.);
                } else if is_boss(a.view.archetype) && a.view.energy >= 1. {
                    // Publish the full bank for one snapshot before it can be spent.
                    a.recharge_left = -SIM_DT;
                }
            }
            if a.view.archetype == Archetype::Marid {
                if a.view.teleport_steps > 0 {
                    a.view.teleport_steps -= 1;
                    if a.view.teleport_steps == MARID_TELEPORT_STEPS - MARID_FADE_STEPS {
                        a.view.pos = a.destination;
                    }
                } else {
                    a.relocate_left -= SIM_DT * a.speed();
                }
            }
            a.basic_cd = (a.basic_cd - SIM_DT).max(0.);
            a.taunt_left = if a.taunt_left <= SIM_DT + 0.00001 {
                0.
            } else {
                a.taunt_left - SIM_DT
            };
            if a.taunt_left <= 0. {
                a.taunted_by = None;
            }
            a.extra_cd = (a.extra_cd - SIM_DT).max(0.);
            a.barrage_cd = (a.barrage_cd - SIM_DT).max(0.);
            a.pulse_cd = (a.pulse_cd - SIM_DT).max(0.);
            a.pound_cd = (a.pound_cd - SIM_DT).max(0.);
            a.skill_lockout = (a.skill_lockout - SIM_DT).max(0.);
            a.special_cd = (a.special_cd - SIM_DT).max(0.);
            a.revive_cd = (a.revive_cd - SIM_DT).max(0.);
            a.summon_cd = (a.summon_cd - SIM_DT).max(0.);
            a.ai_cd -= SIM_DT;
            a.goal_cd = (a.goal_cd - SIM_DT).max(0.);
            a.mend_cd = if !a.alive() || a.view.state == ActorState::Spawn {
                MEND_INTERVAL
            } else if a.mend_cd <= SIM_DT + 0.00001 {
                0.
            } else {
                a.mend_cd - SIM_DT
            };
            a.undamaged += SIM_DT;
            if a.view.archetype == Archetype::Fara
                && a.alive()
                && a.undamaged + 0.00001 >= BREATHER_DELAY
            {
                let amount = (a.view.max_hp * BREATHER_HP_PER_SECOND * SIM_DT)
                    .min(a.view.max_hp - a.view.hp);
                if amount > 0. {
                    a.view.hp += amount;
                    breather = Some((a.view.id, amount));
                    self.events.push(Event::Healed {
                        target: a.view.id,
                        amount,
                        source: crate::HealSource::Breather,
                    });
                }
            }
            if a.committed() {
                a.velocity = Vec2::default();
            } else if matches!(a.view.state, ActorState::Basic | ActorState::Cast) && a.action_done
            {
                a.state(ActorState::Idle, 0., 0.);
                a.view.special_casting = a.combo_phase != 0;
            }
        }
        if let Some((id, amount)) = breather {
            self.healing_enmity(id, amount);
        }
    }
}
