//! Boss-only fixed-capacity threat tables. Committed targets remain attack-owned.
use crate::{actors::hero_index, api::*, tuning::*, Sim};
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BossAttack {
    Stomp,
    Charge,
    Snipe,
    Cone,
    Twin,
    Targeted,
    Scatter,
    Fortress,
    Nova,
}
impl BossAttack {
    pub fn choices(kind: Archetype) -> &'static [Self] {
        use BossAttack::*;
        match kind {
            Archetype::Boss => &[Stomp, Charge],
            Archetype::BossMarksman => &[Snipe, Cone, Twin],
            Archetype::BossBomber => &[Targeted, Scatter, Fortress, Nova],
            _ => &[],
        }
    }
    pub fn kind(self) -> HazardKind {
        use BossAttack::*;
        match self {
            Stomp => HazardKind::BossStompStep,
            Charge => HazardKind::BossCharge,
            Snipe | Twin => HazardKind::BossSnipe,
            Cone => HazardKind::BossCone,
            Targeted | Scatter | Fortress => HazardKind::LizardoDrop,
            Nova => HazardKind::BossNova,
        }
    }
    pub fn barrage_mode(self) -> u32 {
        match self {
            Self::Scatter => 1,
            Self::Fortress => 2,
            _ => 0,
        }
    }
}
impl Sim {
    pub fn seed_enmity(&mut self, boss: usize) {
        if !is_boss(self.actors[boss].view.archetype) || self.actors[boss].enmity_seeded {
            return;
        }
        let pos = self.actors[boss].view.pos;
        let mut values = [0.; 4];
        for a in &self.actors {
            if let Some(k) = hero_index(a.view.archetype).filter(|_| a.alive()) {
                values[k] = ENMITY_SEED / (1. + pos.distance(a.view.pos) / ENMITY_SEED_DISTANCE);
            }
        }
        #[cfg(feature = "reference-diagnostics")]
        for (k, v) in values.iter().enumerate() {
            crate::enmity_attribution::credit(self.actors[boss].view.id, k, 20, *v);
        }
        self.actors[boss].enmity = values;
        self.actors[boss].enmity_seeded = true;
    }
    pub fn boss_basic_next(&self, i: usize) -> bool {
        let a = &self.actors[i];
        a.boss_retry_basic || a.enemy_phase == 3 || a.view.energy < 1.
    }
    pub fn enmity_rank(&self, i: usize) -> [Option<usize>; 4] {
        let mut heroes = [None; 4];
        for (j, a) in self.actors.iter().enumerate() {
            if let Some(k) = hero_index(a.view.archetype).filter(|_| a.alive()) {
                heroes[k] = Some(j);
            }
        }
        heroes.sort_by(|a, b| match (a, b) {
            (Some(a), Some(b)) => {
                let ka = hero_index(self.actors[*a].view.archetype).unwrap();
                let kb = hero_index(self.actors[*b].view.archetype).unwrap();
                self.actors[i].enmity[kb]
                    .total_cmp(&self.actors[i].enmity[ka])
                    .then_with(|| self.actors[*a].view.id.cmp(&self.actors[*b].view.id))
            }
            (None, Some(_)) => core::cmp::Ordering::Greater,
            (Some(_), None) => core::cmp::Ordering::Less,
            _ => core::cmp::Ordering::Equal,
        });
        heroes
    }
    pub fn enmity_target(&self, i: usize, basic: bool) -> Option<usize> {
        if let Some(t) = self.taunt_target(i) {
            return Some(t);
        }
        let best = self.enmity_rank(i)[0]?;
        let current = self.actors[i]
            .aggro_target
            .and_then(|id| self.actor_index(id))
            .filter(|&j| self.actors[j].alive() && self.actors[j].view.team == Team::Hero);
        let Some(current) = current else {
            return Some(best);
        };
        let key = |j: usize| hero_index(self.actors[j].view.archetype).unwrap();
        let margin = if basic && self.actors[i].view.archetype == Archetype::BossMarksman {
            ENMITY_RANGED_MARGIN
        } else {
            ENMITY_SWITCH_MARGIN
        };
        if self.actors[i].enmity[key(best)] > self.actors[i].enmity[key(current)] * (1. + margin) {
            Some(best)
        } else {
            Some(current)
        }
    }
    pub fn choose_boss_aggro(&mut self, i: usize) {
        let Some(t) = self.enmity_target(i, self.boss_basic_next(i)) else {
            self.actors[i].aggro_target = None;
            return;
        };
        let to = self.actors[t].view.id;
        if self.actors[i].aggro_target != Some(to) {
            let from = self.actors[i].aggro_target;
            self.actors[i].aggro_target = Some(to);
            self.events.push(Event::AggroChanged {
                enemy: self.actors[i].view.id,
                from,
                to,
            });
        }
    }
    pub fn enmity_step(&mut self) {
        let mut living = [false; 4];
        for a in &self.actors {
            if let Some(k) = hero_index(a.view.archetype) {
                living[k] = a.alive();
            }
        }
        for i in 0..self.actors.len() {
            if !self.actors[i].alive() || !is_boss(self.actors[i].view.archetype) {
                continue;
            }
            self.seed_enmity(i);
            for (k, alive) in living.iter().enumerate() {
                self.actors[i].enmity[k] = if *alive {
                    self.actors[i].enmity[k]
                        * (1.
                            - (ENMITY_DECAY + if k == 1 { HONDO_FADE_DECAY } else { 0. }) * SIM_DT)
                } else {
                    0.
                };
            }
            #[cfg(feature = "reference-diagnostics")]
            for (k, alive) in living.iter().enumerate() {
                crate::enmity_attribution::decay(
                    self.actors[i].view.id,
                    k,
                    if *alive {
                        1. - (ENMITY_DECAY + if k == 1 { HONDO_FADE_DECAY } else { 0. }) * SIM_DT
                    } else {
                        0.
                    },
                );
            }
            self.choose_boss_aggro(i);
        }
    }
    pub fn damage_enmity(&mut self, source: u32, boss: usize, amount: f32) {
        if !is_boss(self.actors[boss].view.archetype) || amount <= 0. {
            return;
        }
        let Some(hero) = self.actor_index(source).filter(|&i| self.actors[i].alive()) else {
            return;
        };
        let Some(k) = hero_index(self.actors[hero].view.archetype) else {
            return;
        };
        self.seed_enmity(boss);
        let spike = amount >= self.actors[boss].view.max_hp * ENMITY_SPIKE_HP
            || self
                .spotlight
                .active
                .as_ref()
                .is_some_and(|s| s.has_performer(source));
        self.actors[boss].enmity[k] +=
            amount * ENMITY_DAMAGE[k] * if spike { ENMITY_SPIKE_MULTIPLIER } else { 1. };
        #[cfg(feature = "reference-diagnostics")]
        crate::enmity_attribution::damage(
            self.actors[boss].view.id,
            k,
            amount * ENMITY_DAMAGE[k],
            spike,
        );
    }
    pub fn healing_enmity(&mut self, source: u32, amount: f32) {
        self.support_enmity(source, amount, ENMITY_HEAL, true);
    }
    pub fn ward_enmity(&mut self, source: u32, amount: f32) {
        self.support_enmity(source, amount, ENMITY_WARD, false);
    }
    pub fn support_enmity(&mut self, source: u32, amount: f32, multiplier: f32, split: bool) {
        if amount <= 0. {
            return;
        }
        let Some(hero) = self.actor_index(source).filter(|&i| self.actors[i].alive()) else {
            return;
        };
        let Some(k) = hero_index(self.actors[hero].view.archetype) else {
            return;
        };
        let count = self
            .actors
            .iter()
            .filter(|a| a.alive() && is_boss(a.view.archetype))
            .count();
        if count == 0 {
            return;
        }
        for i in 0..self.actors.len() {
            if self.actors[i].alive() && is_boss(self.actors[i].view.archetype) {
                self.seed_enmity(i);
                self.actors[i].enmity[k] +=
                    amount * multiplier / if split { count as f32 } else { 1. };
                #[cfg(feature = "reference-diagnostics")]
                crate::enmity_attribution::credit(
                    self.actors[i].view.id,
                    k,
                    if split { 18 } else { 19 },
                    amount * multiplier / if split { count as f32 } else { 1. },
                );
            }
        }
    }
    /// Reason precedence: boss ally top, endangered target, regular enemy on an ally.
    pub fn protective_taunt(&self, caster: usize) -> Option<(usize, u8)> {
        let fara = self.actors[caster].view.id;
        let mut result = None;
        for (j, a) in self.actors.iter().enumerate() {
            if !self.taunt_recipient(caster, j) || !self.can_engage(caster, j) {
                continue;
            }
            let committed = a.committed() || a.enemy_phase == 2;
            let target = if committed {
                a.target
                    .and_then(|id| self.actor_index(id))
                    .filter(|&t| self.actors[t].alive())
            } else {
                self.enemy_target(j)
            }
            .filter(|&t| self.actors[t].view.id != fara);
            let reason = if is_boss(a.view.archetype) {
                let ally_top =
                    self.enmity_rank(j)[0].is_some_and(|t| self.actors[t].view.id != fara);
                if ally_top {
                    Some(0)
                } else if target
                    .is_some_and(|t| self.actors[t].view.hp < self.actors[t].view.max_hp * 0.5)
                {
                    Some(1)
                } else {
                    None
                }
            } else if target.is_some() {
                Some(2)
            } else {
                None
            };
            if let Some(reason) = reason {
                if result.is_none_or(|(_, r)| reason < r) {
                    result = Some((j, reason));
                }
            }
        }
        result
    }
    pub fn boss_attack_kind(&self, i: usize) -> HazardKind {
        self.actors[i].boss_attack.kind()
    }
    pub fn boss_attack_target(
        &self,
        i: usize,
        preferred: usize,
        attack: BossAttack,
    ) -> Option<usize> {
        let a = &self.actors[i];
        let eligible = |t: usize| {
            a.view.pos.distance(self.actors[t].view.pos) <= BOSS_CAST_REACH
                && self.boss_covers_target(i, t, attack)
                && (attack.kind() != HazardKind::LizardoDrop
                    || (a.barrage_cd <= 0.
                        && (attack != BossAttack::Fortress || {
                            let pad = a.view.radius
                                + CHIMERA_FORTRESS_GAP
                                + BOMB_RADIUS
                                    * if a.view.enraged {
                                        a.phase_rule.map_or(1., |r| r.radius_scale)
                                    } else {
                                        1.
                                    };
                            self.floor.point(a.view.pos, pad) == a.view.pos
                        })))
        };
        if eligible(preferred) {
            return Some(preferred);
        }
        if self.taunt_target(i).is_some() || attack == BossAttack::Stomp {
            return None;
        }
        self.enmity_rank(i)
            .into_iter()
            .flatten()
            .find(|&t| eligible(t))
    }
    /// Draw only at an open bank. A pushed special retries its accepted choice.
    pub fn select_boss_attack(&mut self, i: usize, preferred: usize) -> Option<usize> {
        let a = &self.actors[i];
        if a.boss_retry_special {
            return self.boss_attack_target(i, preferred, a.boss_attack);
        }
        let mut candidates = [(BossAttack::Charge, 0); 4];
        let mut count = 0;
        for &attack in BossAttack::choices(a.view.archetype) {
            if let Some(t) = self.boss_attack_target(i, preferred, attack) {
                candidates[count] = (attack, t);
                count += 1;
            }
        }
        if count == 0 {
            return None;
        }
        if count > 1 && a.boss_attack_streak >= 2 {
            let last = a.boss_last_attack;
            let mut kept = 0;
            for n in 0..count {
                if Some(candidates[n].0) != last {
                    candidates[kept] = candidates[n];
                    kept += 1;
                }
            }
            count = kept;
        }
        let n = (self.actors[i].ai_rng.next() % count as u64) as usize;
        let (attack, target) = candidates[n];
        self.actors[i].boss_attack = attack;
        Some(target)
    }
    pub fn record_boss_attack(&mut self, i: usize) {
        let a = &mut self.actors[i];
        // An interrupted/refunded package is still the same choice.
        if a.boss_retry_special {
            return;
        }
        a.boss_attack_streak = if a.boss_last_attack == Some(a.boss_attack) {
            a.boss_attack_streak.saturating_add(1)
        } else {
            1
        };
        a.boss_last_attack = Some(a.boss_attack);
    }
    /// Before a draw, revival must budget every possible next footprint.
    pub fn boss_forecast_hits(&self, i: usize, t: usize, spot: Vec2, body: f32) -> bool {
        let a = &self.actors[i];
        BossAttack::choices(a.view.archetype).iter().any(|&attack| {
            if a.boss_retry_special && attack != a.boss_attack {
                return false;
            }
            if attack.kind() == HazardKind::LizardoDrop {
                return true;
            }
            if attack == BossAttack::Stomp {
                return self.stomp_plan(i, t).is_some_and(|(centres, count, _)| {
                    centres[..count]
                        .iter()
                        .any(|p| p.distance(spot) <= self.stomp_radius(i) + body)
                });
            }
            let aim = (self.actors[t].view.pos - a.view.pos).normalized();
            let origin = if attack == BossAttack::Cone {
                a.cone_origin(aim)
            } else {
                a.view.pos
            };
            let spread = if attack == BossAttack::Twin {
                18. * core::f32::consts::PI / 180.
            } else {
                0.
            };
            let angle = libm::atan2f(aim.y, aim.x);
            [-spread, spread].iter().any(|offset| {
                let dir = crate::math::direction(angle + offset);
                let shape =
                    self.attack_footprint(attack.kind(), i, self.actors[t].view.id, origin, dir);
                crate::math::contains(shape, origin, dir, spot, body)
            })
        })
    }
    pub fn boss_covers_target(&self, i: usize, t: usize, attack: BossAttack) -> bool {
        let kind = attack.kind();
        if kind == HazardKind::BossStompStep {
            return self.stomp_covers(i, t);
        }
        if matches!(attack, BossAttack::Scatter | BossAttack::Fortress) {
            return true;
        }
        let a = &self.actors[i];
        let p = self.actors[t].view.pos;
        let aim = (p - a.view.pos).normalized();
        let origin = match kind {
            HazardKind::BossCone => a.cone_origin(aim),
            HazardKind::LizardoDrop => p,
            _ => a.view.pos,
        };
        let shape = self.attack_footprint(kind, i, self.actors[t].view.id, origin, aim);
        if !crate::math::contains(shape, origin, aim, p, self.actors[t].view.radius) {
            return false;
        }
        if attack == BossAttack::Twin {
            let angle = libm::atan2f(aim.y, aim.x);
            let spread = 18. * core::f32::consts::PI / 180.;
            return [-spread, spread].iter().all(|&offset| {
                self.attack_covers_hero(
                    kind,
                    i,
                    self.actors[t].view.id,
                    origin,
                    crate::math::direction(angle + offset),
                )
            });
        }
        self.attack_covers_hero(kind, i, self.actors[t].view.id, origin, aim)
    }
    pub fn boss_barrage_targets(&self, i: usize, preferred: usize) -> [Option<usize>; 4] {
        let mut order = self.enmity_rank(i);
        if self.taunt_target(i).is_some() {
            return [Some(preferred), None, None, None];
        }
        if let Some(n) = order.iter().position(|&t| t == Some(preferred)) {
            order.swap(0, n);
        }
        order
    }
}
