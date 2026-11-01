use crate::{actors::hero_index, api::*, tuning::*, Sim};
impl Sim {
    pub(crate) fn apply_party_buffs(&mut self) {
        let b = self.stage.buffs;
        let (hp_scale, atk_scale) = stage_scales(self.stage.wave, self.stage.tier);
        let attack = b.attack.min(hp_scale * ATTACK_BOON_RELATIVE_CAP);
        let armor = b.defense.min(atk_scale * DEFENSE_BOON_RELATIVE_CAP);
        for a in &mut self.combat.actors {
            if let Some(k) = hero_index(a.view.archetype) {
                let base = HERO_STATS[k];
                a.stats.atk = base.atk * attack;
                a.stats.def = ((DEF_BASE + base.def) * armor - DEF_BASE).max(0.);
                a.stats.reach = base.reach * b.range;
                a.stats.interval = base.interval / b.attack_speed;
                a.stats.special = base.special / b.attack_speed;
            }
        }
    }
    pub(crate) fn drop_chest(&mut self) {
        let id = self.combat.next_id;
        self.combat.next_id += 1;
        self.chests.clear();
        self.chests.push(ChestView {
            id,
            // Owner: exact arena centre, independent of camera and party position.
            pos: ARENA_CENTRE,
            state: ChestState::Closed,
            state_age: 0.,
            reward: None,
        });
        self.chest_opener = None;
        self.chest_approach = None;
        self.combat.events.push((Event::ChestDropped { id }).into());
    }
    pub(crate) fn update_chests(&mut self) {
        let combat_complete = self.wave_combat_complete();
        let Some(c) = self.chests.first_mut() else {
            return;
        };
        c.state_age += SIM_DT;
        if c.state == ChestState::Open {
            return;
        }
        if !combat_complete {
            return;
        }
        let pos = c.pos;
        let chosen = self
            .chest_opener
            .and_then(|id| self.combat.actor_index(id))
            .filter(|&i| self.combat.actors[i].alive())
            .or_else(|| {
                self.combat
                    .actors
                    .iter()
                    .enumerate()
                    .filter(|(_, a)| a.view.team == Team::Hero && a.alive())
                    .min_by(|(_, a), (_, b)| {
                        a.view
                            .pos
                            .distance(pos)
                            .total_cmp(&b.view.pos.distance(pos))
                    })
                    .map(|(i, _)| i)
            });
        let Some(i) = chosen else {
            return;
        };
        if self.chest_opener != Some(self.combat.actors[i].view.id)
            || !self.chest_approach.is_some_and(|(p, _)| {
                self.chest_side_clear(i, pos, p)
                    && !self
                        .combat
                        .path_enters_threat(i, self.chest_waypoint(i, pos, p), None)
            })
        {
            self.chest_approach = self
                .chest_stand_point(i, pos)
                .map(|point| (point, self.combat.actors[i].view.facing));
            if self.chests[0].state == ChestState::Opening {
                self.chests[0].state = ChestState::Closed;
                self.chests[0].state_age = 0.;
            }
            self.combat.actors[i].ai_cd = 0.;
        }
        self.chest_opener = Some(self.combat.actors[i].view.id);
        let Some((point, _)) = self.chest_approach else {
            return;
        };
        if self.combat.actors[i].view.pos.distance(point) > CHEST_STAND_TOLERANCE {
            self.chests[0].state = ChestState::Closed;
            self.chests[0].state_age = 0.;
            return;
        }
        if self.chests[0].state == ChestState::Closed {
            self.chest_approach = Some((point, self.combat.actors[i].view.facing));
        }
        self.align_chest_opener(i, pos);
        let c = &mut self.chests[0];
        if c.state == ChestState::Closed {
            c.state = ChestState::Opening;
            c.state_age = 0.;
            return;
        }
        if c.state_age + 0.00001 < CHEST_OPEN {
            return;
        }
        // Out of 20: FullHeal 2, Attack/Defense/Range/AttackSpeed 3 each, MaxHp 6.
        let reward = match self.reward_rng.next() % 20 {
            0..=1 => Reward::FullHeal,
            2..=4 => Reward::Attack,
            5..=7 => Reward::Defense,
            8..=10 => Reward::Range,
            11..=13 => Reward::AttackSpeed,
            _ => Reward::MaxHp,
        };
        c.state = ChestState::Open;
        c.state_age = 0.;
        c.reward = Some(reward);
        self.combat.events.push(
            (Event::ChestOpened {
                id: c.id,
                opener: self.combat.actors[i].view.id,
                reward,
                tier: self.stage.tier,
            })
            .into(),
        );
        for a in &mut self.combat.actors {
            if a.view.team == Team::Hero && a.alive() {
                a.ai_cd = 0.;
                a.goal_cd = 0.;
            }
        }
        let k = (self.stage.tier - 1) as usize;
        let (hp_scale, atk_scale) = stage_scales(self.stage.wave, self.stage.tier);
        let b = &mut self.stage.buffs;
        match reward {
            Reward::FullHeal => {
                for a in &mut self.combat.actors {
                    if a.view.team == Team::Hero && a.alive() {
                        let amount = a.view.max_hp - a.view.hp;
                        a.view.hp = a.view.max_hp;
                        if amount > 0. {
                            self.combat.events.push(
                                (Event::Healed {
                                    target: a.view.id,
                                    amount,
                                    source: crate::HealSource::FullHealReward,
                                })
                                .into(),
                            );
                        }
                    }
                }
            }
            Reward::MaxHp => {
                for a in &mut self.combat.actors {
                    if let Some(i) = hero_index(a.view.archetype) {
                        let base = HERO_STATS[i].hp;
                        let max_hp =
                            (a.view.max_hp + base * HP_BOON_FRACTION[k]).min(base * HP_BOON_CAP);
                        let gain = (max_hp - a.view.max_hp).max(0.);
                        a.view.max_hp = max_hp;
                        if a.alive() {
                            a.view.hp = (a.view.hp + gain).min(max_hp);
                        }
                    }
                }
            }
            Reward::Attack => b.attack += ([1.2, 1.35, 1.5][k] - 1.) * hp_scale,
            Reward::Defense => b.defense += ([1.2, 1.25, 1.3][k] - 1.) * atk_scale,
            Reward::Range => b.range = (b.range + ([1.2, 1.4, 1.6][k] - 1.)).min(RANGE_BOON_CAP),
            Reward::AttackSpeed => {
                b.attack_speed =
                    (b.attack_speed + ([1.1, 1.15, 1.175][k] - 1.)).min(ATTACK_SPEED_BOON_CAP)
            }
        }
        self.apply_party_buffs();
        self.director.clear_age = 0.;
    }
    pub(crate) fn chest_goal(&self, i: usize) -> Option<Vec2> {
        if self.combat.party_recovering() || !self.wave_combat_complete() {
            return None;
        }
        self.chests
            .first()
            .filter(|c| c.state != ChestState::Open)
            .map(|c| {
                if self.chest_opener == Some(self.combat.actors[i].view.id) {
                    self.chest_approach
                        .map_or(self.combat.actors[i].view.pos, |(point, _)| {
                            self.chest_waypoint(i, c.pos, point)
                        })
                } else {
                    self.chest_slot_point(i, c.pos)
                }
            })
    }
    fn chest_slot_point(&self, i: usize, chest: Vec2) -> Vec2 {
        let a = &self.combat.actors[i];
        let k = crate::actors::hero_index(a.view.archetype).unwrap();
        let offset = TRAVEL_SLOTS[k];
        let edge = chest_edge(offset.normalized(), a.view.radius + 8.);
        let offset = if chest_clearance(offset, a.view.radius + 8.) < 1. {
            edge
        } else {
            offset
        };
        crate::math::floor_point(chest + offset, a.view.radius)
    }
    fn chest_side_clear(&self, i: usize, chest: Vec2, point: Vec2) -> bool {
        let a = &self.combat.actors[i];
        point.y == chest.y
            && ((point.x - chest.x).abs() - (CHEST_HALF_WIDTH + a.view.radius + CHEST_SIDE_GAP))
                .abs()
                < 0.001
            && point == crate::math::floor_point(point, a.view.radius)
            && self.combat.actors.iter().enumerate().all(|(j, other)| {
                let d = point - other.view.pos;
                i == j
                    || !other.alive()
                    || Vec2::new(d.x, d.y / ACTOR_MOAT_DEPTH).length()
                        >= a.view.radius + other.view.radius + 2. * ACTOR_MOAT
            })
            && !self.combat.hazards.iter().any(|h| {
                h.view.hostile
                    && h.view.team != a.view.team
                    && h.view.phase != HazardPhase::Resolved
                    && h.hits(point, a.view.radius)
            })
    }
    fn chest_stand_point(&self, i: usize, chest: Vec2) -> Option<Vec2> {
        let a = &self.combat.actors[i];
        let offset = Vec2::new(CHEST_HALF_WIDTH + a.view.radius + CHEST_SIDE_GAP, 0.);
        [chest - offset, chest + offset]
            .into_iter()
            .filter(|&p| {
                self.chest_side_clear(i, chest, p)
                    && !self
                        .combat
                        .path_enters_threat(i, self.chest_waypoint(i, chest, p), None)
            })
            .min_by(|p, q| p.distance(a.view.pos).total_cmp(&q.distance(a.view.pos)))
    }
    fn chest_waypoint(&self, i: usize, chest: Vec2, point: Vec2) -> Vec2 {
        let a = &self.combat.actors[i];
        let delta = point - a.view.pos;
        let steps = libm::ceilf(delta.length() / 4.).max(1.) as u32;
        if !(1..=steps).any(|n| {
            chest_clearance(
                a.view.pos + delta * (n as f32 / steps as f32) - chest,
                a.view.radius + 8.,
            ) < 1.
        }) {
            return point;
        }
        // Go around the footprint before turning inward, including a switch to the far side.
        let d = a.view.pos - chest;
        let r = chest_radii(d.y, a.view.radius + 8.);
        if d.x * (point.x - chest.x) < 0. && d.y.abs() < r.y {
            crate::math::floor_point(
                Vec2::new(
                    a.view.pos.x,
                    chest.y
                        + if d.y <= 0. {
                            -r.y - CHEST_SIDE_GAP
                        } else {
                            r.y + CHEST_SIDE_GAP
                        },
                ),
                a.view.radius,
            )
        } else {
            Vec2::new(point.x, a.view.pos.y)
        }
    }
    fn align_chest_opener(&mut self, i: usize, chest: Vec2) {
        let (point, _) = self.chest_approach.unwrap();
        let a = &mut self.combat.actors[i];
        a.view.pos = point;
        a.destination = point;
        a.velocity = Vec2::default();
        if a.view.state == ActorState::Walk {
            a.state(ActorState::Idle, 0., 0.);
        }
        a.heading = (chest - point).normalized();
        a.view.facing = if point.x < chest.x {
            Facing::Right
        } else {
            Facing::Left
        };
    }
    fn chest_clear_point(&self, i: usize, chest: Vec2) -> Vec2 {
        let a = &self.combat.actors[i];
        let delta = a.view.pos - chest;
        if chest_clearance(delta, a.view.radius) >= 1. {
            return a.view.pos;
        }
        let away = if delta.length() > 0.00001 {
            delta.normalized()
        } else {
            Vec2::new(if a.view.id % 2 == 0 { -1. } else { 1. }, 0.)
        };
        let point = chest + chest_edge(away, a.view.radius);
        if point == crate::math::floor_point(point, a.view.radius) {
            return point;
        }
        [
            Vec2::new(-1., 0.),
            Vec2::new(1., 0.),
            Vec2::new(0., -1.),
            Vec2::new(0., 1.),
        ]
        .into_iter()
        .map(|dir| chest + chest_edge(dir, a.view.radius))
        .filter(|&p| p == crate::math::floor_point(p, a.view.radius))
        .min_by(|p, q| p.distance(a.view.pos).total_cmp(&q.distance(a.view.pos)))
        .unwrap_or(a.view.pos)
    }
    pub(crate) fn constrain_chests(&mut self) {
        let Some(c) = self.chests.first().filter(|c| c.state != ChestState::Open) else {
            return;
        };
        let (pos, opening) = (c.pos, c.state == ChestState::Opening);
        for i in 0..self.combat.actors.len() {
            if self.combat.actors[i].view.team != Team::Hero || !self.combat.actors[i].alive() {
                continue;
            }
            self.combat.actors[i].view.pos = self.chest_clear_point(i, pos);
            if opening
                && self.chest_opener == Some(self.combat.actors[i].view.id)
                && self
                    .chest_approach
                    .is_some_and(|(point, _)| self.chest_side_clear(i, pos, point))
                && !matches!(
                    self.combat.actors[i].view.ai_intent,
                    AiIntent::Dodge | AiIntent::Retreat | AiIntent::Revive
                )
                && self.chest_approach.is_some_and(|(point, _)| {
                    self.combat.actors[i].view.pos.distance(point) <= CHEST_STAND_TOLERANCE
                })
            {
                self.align_chest_opener(i, pos);
            }
        }
        if opening
            && !self
                .chest_opener
                .and_then(|id| self.combat.actor_index(id))
                .is_some_and(|i| {
                    self.combat.actors[i].alive()
                        && self.chest_approach.is_some_and(|(point, _)| {
                            self.chest_side_clear(i, pos, point)
                                && self.combat.actors[i].view.pos.distance(point)
                                    <= CHEST_STAND_TOLERANCE
                        })
                })
        {
            self.chests[0].state = ChestState::Closed;
            self.chests[0].state_age = 0.;
        }
    }
}

/// Chest footprint: an ellipse around its base that reaches further toward the camera,
/// so a hero in front never stands on the drawn chest (owner, 2026-10-26).
fn chest_radii(dir_y: f32, radius: f32) -> Vec2 {
    let front = if dir_y > 0. { CHEST_FRONT_GAP } else { 0. };
    Vec2::new(
        CHEST_HALF_WIDTH + radius,
        CHEST_HALF_HEIGHT + front + radius,
    )
}
/// Normalised ellipse distance; at least 1 means the hero is clear of the chest.
fn chest_clearance(delta: Vec2, radius: f32) -> f32 {
    let r = chest_radii(delta.y, radius);
    libm::sqrtf((delta.x / r.x) * (delta.x / r.x) + (delta.y / r.y) * (delta.y / r.y))
}
/// Point on the footprint edge in direction `dir`, nudged just outside.
fn chest_edge(dir: Vec2, radius: f32) -> Vec2 {
    let r = chest_radii(dir.y, radius);
    let d = libm::sqrtf((dir.x / r.x) * (dir.x / r.x) + (dir.y / r.y) * (dir.y / r.y));
    dir * (1.0001 / d.max(0.00001))
}

#[cfg(test)]
mod chest_pose_tests {
    use super::*;

    fn scene(from: Vec2) -> Sim {
        let mut s = Sim::new(SimConfig::default());
        s.combat.hazards.clear();
        s.director.entry = MINI_WAVES as usize + 1;
        s.combat.actors[0].view.pos = from;
        s.combat.actors[0].view.facing = Facing::Left;
        s.drop_chest();
        s.chest_opener = Some(s.combat.actors[0].view.id);
        s.update_chests();
        s
    }

    #[test]
    fn bystanders_gather_in_chest_slots_while_opener_keeps_its_committed_stand() {
        let mut s = scene(Vec2::new(330., 1300.));
        let chest = s.chests[0].pos;
        let stand = s.chest_approach.unwrap().0;
        for (k, a) in s.combat.actors.iter_mut().enumerate().skip(1) {
            a.view.pos = chest + TRAVEL_SLOTS[k] + Vec2::new(190., 160.);
            a.ai_cd = 0.;
        }
        for i in 1..4 {
            assert_eq!(s.chest_goal(i), Some(chest + TRAVEL_SLOTS[i]));
        }
        let mut opened = false;
        for _ in 0..600 {
            s.step();
            for a in &s.combat.actors {
                assert!(a.view.pos.distance(chest) + 0.001 >= CHEST_HALF_WIDTH + a.view.radius);
            }
            if s.chests[0].state == ChestState::Open {
                assert_eq!(s.chest_approach.unwrap().0, stand);
                assert!(s
                    .combat
                    .actors
                    .iter()
                    .all(|a| a.view.pos.distance(chest) < 230.));
                opened = true;
                break;
            }
        }
        assert!(opened);
    }

    #[test]
    fn chest_opens_only_from_a_side_with_original_duration_and_clearance() {
        for from in [
            Vec2::new(380., 1250.),
            Vec2::new(580., 1250.),
            Vec2::new(600., 900.),
            ARENA_CENTRE - Vec2::new(0., 150.),
            ARENA_CENTRE + Vec2::new(-100., -150.),
            ARENA_CENTRE + Vec2::new(100., -150.),
        ] {
            let mut s = scene(from);
            let chest = s.chests[0].pos;
            let mut started = None;
            let mut opened = false;
            // Bystanders initially overlap the reward; they must yield without blocking collection.
            for a in s.combat.actors.iter_mut().skip(1) {
                a.view.pos = chest;
                a.destination = chest;
            }
            for _ in 0..600 {
                s.step();
                if s.chests[0].state == ChestState::Opening {
                    started.get_or_insert(s.combat.step_number);
                    let a = &s.combat.actors[0];
                    assert_eq!(a.view.state, ActorState::Idle);
                    assert_eq!(a.velocity, Vec2::default());
                    assert!((a.view.pos.x - chest.x).abs() >= CHEST_HALF_WIDTH + a.view.radius);
                    assert!((a.view.pos.y - chest.y).abs() < 0.001);
                    assert_eq!(
                        a.view.facing,
                        if a.view.pos.x < chest.x {
                            Facing::Right
                        } else {
                            Facing::Left
                        }
                    );
                    assert!(a.heading.dot((chest - a.view.pos).normalized()) > 0.99);
                    for a in &s.combat.actors {
                        assert!(
                            a.view.pos.distance(chest) + 0.001 >= CHEST_HALF_WIDTH + a.view.radius
                        );
                    }
                }
                if s.chests[0].state == ChestState::Open {
                    assert_eq!(
                        s.combat.step_number - started.unwrap(),
                        (CHEST_OPEN * SIM_HZ as f32).round() as u64
                    );
                    opened = true;
                    break;
                }
            }
            assert!(
                opened,
                "approach {from:?}: stand {:?}, actors {:?}",
                s.chest_approach,
                s.combat
                    .actors
                    .iter()
                    .map(|a| (a.view.pos, a.destination))
                    .collect::<Vec<_>>()
            );
        }
    }

    #[test]
    fn chest_approach_is_fixed_once_and_side_falls_back_at_either_wall() {
        let mut s = scene(Vec2::new(380., 1250.));
        let stand = s.chest_approach.unwrap().0;
        s.combat.actors[0].view.pos = Vec2::new(600., 900.);
        s.update_chests();
        assert_eq!(s.chest_approach.unwrap().0, stand);
        for (x, approach_x, side) in [
            (
                ARENA_MIN.x + CHEST_HALF_WIDTH,
                ARENA_MIN.x + BODY_RADIUS,
                1.,
            ),
            (
                ARENA_MAX.x - CHEST_HALF_WIDTH,
                ARENA_MAX.x - BODY_RADIUS - 0.001,
                -1.,
            ),
        ] {
            let mut s = scene(Vec2::new(approach_x, 1250.));
            s.chests[0].pos.x = x;
            s.chest_approach = None;
            s.update_chests();
            let point = s.chest_approach.unwrap().0;
            assert!((point.x - x) * side > 0.);
            assert_eq!(point.y, s.chests[0].pos.y);
            assert_eq!(
                point,
                crate::math::floor_point(point, s.combat.actors[0].view.radius)
            );
        }
    }

    #[test]
    fn nearest_clear_side_wins_from_above_and_below() {
        for y in [-150., 150.] {
            for x in [-100., 100.] {
                let s = scene(ARENA_CENTRE + Vec2::new(x, y));
                let point = s.chest_approach.unwrap().0;
                assert_eq!(point.y, ARENA_CENTRE.y);
                assert!((point.x - ARENA_CENTRE.x) * x > 0.);
            }
        }
    }

    #[test]
    fn occupied_sides_wait_then_retry_without_opening_from_behind() {
        let mut s = scene(ARENA_CENTRE + Vec2::new(-100., -150.));
        let left = s.chest_approach.unwrap().0;
        let right = Vec2::new(2. * ARENA_CENTRE.x - left.x, left.y);
        s.combat.actors[1].view.pos = left;
        s.update_chests();
        assert_eq!(s.chest_approach.unwrap().0, right);
        s.combat.actors[2].view.pos = right;
        for _ in 0..60 {
            s.update_chests();
            assert_eq!(s.chest_approach, None);
            assert_eq!(s.chests[0].state, ChestState::Closed);
        }
        s.combat.actors[2].view.pos.x += 200.;
        s.update_chests();
        assert_eq!(s.chest_approach.unwrap().0, right);
        // Keep the other side occupied while the opener detours across the chest.
        s.combat.actors[1].state(ActorState::Spawn, 100., 0.);
        for _ in 0..600 {
            s.step();
            if s.chests[0].state == ChestState::Opening {
                assert_eq!(s.combat.actors[0].view.pos, right);
            }
            if s.chests[0].state == ChestState::Open {
                return;
            }
        }
        panic!("unblocked side was never reached");
    }

    #[test]
    fn hazardous_sides_and_displacement_cancel_opening_until_safe_arrival() {
        let mut s = scene(ARENA_CENTRE + Vec2::new(-100., -150.));
        let left = s.chest_approach.unwrap().0;
        let right = Vec2::new(2. * ARENA_CENTRE.x - left.x, left.y);
        s.hazard(HazardKind::LizardoDrop, 999, None, left, Vec2::new(1., 0.));
        s.combat.hazards[0].view.shape = Shape::Circle { radius: 12. };
        s.update_chests();
        assert_eq!(s.chest_approach.unwrap().0, right);
        s.hazard(HazardKind::LizardoDrop, 999, None, right, Vec2::new(1., 0.));
        s.combat.hazards[1].view.shape = Shape::Circle { radius: 12. };
        s.update_chests();
        assert_eq!(s.chest_approach, None);
        assert_eq!(s.chests[0].state, ChestState::Closed);
        s.combat.hazards.clear();
        s.combat.actors[0].view.pos = left;
        s.update_chests();
        assert_eq!(s.chests[0].state, ChestState::Opening);
        s.chests[0].state_age = CHEST_OPEN;
        s.combat.actors[0].view.pos = ARENA_CENTRE - Vec2::new(0., 100.);
        s.constrain_chests();
        assert_eq!(s.chests[0].state, ChestState::Closed);
        assert!(s.chests[0].reward.is_none());
        s.combat.actors[0].view.pos = left;
        s.update_chests();
        for _ in 0..(CHEST_OPEN * SIM_HZ as f32).round() as usize - 1 {
            s.update_chests();
            assert_eq!(s.chests[0].state, ChestState::Opening);
        }
        s.update_chests();
        assert_eq!(s.chests[0].state, ChestState::Open);
        assert_eq!(
            s.drain_events()
                .iter()
                .filter(|e| matches!(e, Event::ChestOpened { .. }))
                .count(),
            1
        );
    }

    #[test]
    fn effective_boons_stay_relative_to_enemies_even_with_unbounded_banked_totals() {
        let mut s = Sim::new(SimConfig::default());
        for stage in 1..=90 {
            s.stage.wave = stage;
            s.stage.tier = ((stage - 1) % 3 + 1) as u8;
            let (hp, atk) = stage_scales(stage, s.stage.tier);
            for raw in [1., 1.2, 2., 100., 1e20] {
                s.stage.buffs.attack = raw;
                s.stage.buffs.defense = raw;
                s.apply_party_buffs();
                assert_eq!(s.stage.buffs.attack, raw);
                assert_eq!(s.stage.buffs.defense, raw);
                for (i, a) in s.combat.actors.iter().enumerate() {
                    assert!(
                        a.stats.atk <= HERO_STATS[i].atk * hp * ATTACK_BOON_RELATIVE_CAP * 1.000001
                    );
                    let armor_ratio = (DEF_BASE + a.stats.def) / (DEF_BASE + HERO_STATS[i].def);
                    assert!(armor_ratio <= atk * DEFENSE_BOON_RELATIVE_CAP * 1.000001);
                    if raw == 1. {
                        assert_eq!(a.stats.def, HERO_STATS[i].def);
                    }
                }
            }
        }
        s.stage.wave = 1;
        s.stage.tier = 1;
        s.stage.buffs.attack = 100.;
        s.stage.buffs.defense = 100.;
        s.apply_party_buffs();
        s.reset_stage(true);
        let (hp, atk) = stage_scales(s.stage.wave, s.stage.tier);
        assert_eq!(
            s.combat.actors[0].stats.atk,
            HERO_STATS[0].atk * (hp * ATTACK_BOON_RELATIVE_CAP)
        );
        assert_eq!(
            s.combat.actors[0].stats.def,
            (DEF_BASE + HERO_STATS[0].def) * (atk * DEFENSE_BOON_RELATIVE_CAP) - DEF_BASE
        );
    }
}

#[cfg(test)]
mod hp_reward_tests {
    use super::*;
    use crate::rng::Rng;

    fn grant(s: &mut Sim) {
        // Select the HP slot through the real chest-opening path.
        s.reward_rng = Rng((0..).find(|&seed| Rng(seed).next() % 20 >= 14).unwrap());
        s.drop_chest();
        s.chest_opener = Some(s.combat.actors[0].view.id);
        s.update_chests();
        s.combat.actors[0].view.pos = s.chest_approach.unwrap().0;
        s.update_chests();
        s.chests[0].state_age = CHEST_OPEN;
        s.update_chests();
        assert_eq!(s.chests[0].reward, Some(Reward::MaxHp));
        assert!(s.drain_events().iter().any(|e| matches!(
            e,
            Event::ChestOpened {
                reward: Reward::MaxHp,
                ..
            }
        )));
    }

    #[test]
    fn hp_reward_adds_base_hp_without_erasing_wounds_or_reviving_and_clamps_the_last_gain() {
        for tier in 1..=3 {
            let mut s = Sim::new(SimConfig::default());
            s.stage.tier = tier;
            s.combat.actors[1].view.hp -= 73.;
            s.combat.actors[2].view.hp = 0.;
            s.combat.actors[2].view.state = ActorState::Downed;
            let buffs = s.stage.buffs;
            let mut last_max: [f32; 4] = std::array::from_fn(|i| HERO_STATS[i].hp);
            for n in 1..=20 {
                let old_hp: [f32; 4] = std::array::from_fn(|i| s.combat.actors[i].view.hp);
                grant(&mut s);
                for (i, a) in s.combat.actors.iter().enumerate() {
                    let base = HERO_STATS[i].hp;
                    let expected = base
                        * (1. + n as f32 * HP_BOON_FRACTION[(tier - 1) as usize]).min(HP_BOON_CAP);
                    assert!((a.view.max_hp - expected).abs() < 0.001);
                    if i == 2 {
                        assert_eq!(a.view.hp, 0.);
                        assert_eq!(a.view.state, ActorState::Downed);
                    } else {
                        assert!(
                            (a.view.hp - old_hp[i] - (a.view.max_hp - last_max[i])).abs() < 0.001
                        );
                        assert!(a.view.hp <= a.view.max_hp);
                    }
                    last_max[i] = a.view.max_hp;
                }
                assert_eq!(s.stage.buffs, buffs);
                s.combat.events.clear();
            }
        }
    }

    #[test]
    fn hp_reward_survives_stage_clear_and_revive_but_resets_on_wipe() {
        let mut s = Sim::new(SimConfig::default());
        grant(&mut s);
        let max_hp = s.combat.actors[0].view.max_hp;
        let hash = s.state_hash();
        s.combat.actors[0].view.max_hp -= 1.;
        assert_ne!(s.state_hash(), hash, "existing max-HP field is hashed");
        s.combat.actors[0].view.max_hp = max_hp;
        s.combat.actors[0].view.hp = 0.;
        s.reset_stage(true);
        assert_eq!(s.combat.actors[0].view.max_hp, max_hp);
        assert_eq!(s.combat.actors[0].view.hp, max_hp);
        s.reset_stage(false);
        for (i, a) in s.combat.actors.iter().enumerate() {
            assert_eq!(a.view.max_hp, HERO_STATS[i].hp);
            assert_eq!(a.view.hp, HERO_STATS[i].hp);
        }
    }
}
