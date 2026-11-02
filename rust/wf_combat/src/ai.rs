use crate::{actors::hero_index, api::*, hazards::Hazard, math::direction, tuning::*, Sim};

impl Sim {
    pub fn safe_revive_spot(&self, i: usize, spot: Vec2, target: usize) -> bool {
        let a = &self.actors[i];
        a.view.hp > a.view.max_hp * REVIVE_SAFE_HP
            && !self.hazards.iter().any(|h| {
                h.view.hostile
                    && h.view.team != a.view.team
                    && h.view.phase != HazardPhase::Resolved
                    && h.hits(spot, a.view.radius + if matches!(h.view.phase, HazardPhase::Tracking | HazardPhase::Locked) { REVIVE_DANGER_MARGIN } else { 0. })
            })
            // A planted hero who is the next ranged/boss target cannot finish before
            // that enemy's next warning. Wait for the aim to commit elsewhere.
            && !self.actors.iter().enumerate().any(|(e, enemy)| {
                if !enemy.tangible() || enemy.view.team == a.view.team {
                    return false;
                }
                let remaining = REVIVE_CHANNEL - self.actors[target].revive_progress;
                let next_target = self.enemy_target(e).is_some_and(|t| {
                    let p = self.actors[t].view.pos;
                    let body = a.view.radius + REVIVE_DANGER_MARGIN;
                    match enemy.view.archetype {
                        kind if is_boss(kind) => self.boss_forecast_hits(e, t, spot, body),
                        Archetype::Sniper => {
                            let width = SNIPER_WIDTH * if enemy.view.enraged { 1.5 } else { 1. };
                            let aim = (p - enemy.view.pos).normalized();
                            crate::math::contains(Shape::Line { length: f32::INFINITY, width }, enemy.view.pos, aim, spot, body)
                        }
                        Archetype::Lizardo => p.distance(spot) <= BOMB_RADIUS + BOMB_SCATTER + body,
                        _ => p.distance(spot) <= body,
                    }
                });
                let heavy_melee = enemy.stats.reach <= 100.
                    && enemy.stats.atk * CRIT_MULTIPLIER * crate::formulas::mitigation_multiplier(a.defense() as f64) as f32 > a.view.max_hp * REVIVE_INTERRUPT_HP
                    && enemy.view.pos.distance(spot) <= enemy.attack_range(a) + REVIVE_DANGER_MARGIN;
                if heavy_melee { return true; }
                let wait = if is_boss(enemy.view.archetype) {
                    enemy.recharge_left.max(enemy.relocate_left)
                        + if enemy.enemy_phase == 2 {
                            self.hazards.iter().filter(|h| h.view.owner == enemy.view.id && h.view.hostile && h.view.phase != HazardPhase::Resolved)
                                .map(|h| h.remaining()).fold(0., f32::max) + BOSS_RECHARGE_FLOOR
                        } else { 0. }
                } else if matches!(enemy.view.archetype, Archetype::Sniper | Archetype::Lizardo) {
                    enemy.basic_cd.max((enemy.view.state_duration - enemy.view.state_age).max(0.))
                } else {
                    return false;
                };
                wait < remaining && next_target
            })
    }
    pub fn best_reviver(&self, target: usize) -> Option<usize> {
        let id = self.actors[target].view.id;
        if let Some((i, _)) = self
            .actors
            .iter()
            .enumerate()
            .find(|(_, a)| a.alive() && a.action_revive && a.target == Some(id))
        {
            return Some(i);
        }
        self.actors
            .iter()
            .enumerate()
            .filter(|(i, a)| {
                a.view.team == Team::Hero
                    && a.alive()
                    && a.revive_cd <= 0.
                    && !a.action_revive
                    && !a.committed()
                    && self.safe_revive_spot(*i, a.view.pos, target)
            })
            .max_by(|(i, a), (j, b)| {
                let score = |i: usize, a: &crate::actors::Actor| {
                    let safety = self
                        .nearest(i, Team::Enemy, false)
                        .map_or(400., |e| a.view.pos.distance(self.actors[e].view.pos))
                        .min(400.);
                    200. * a.view.hp / a.view.max_hp + safety
                        - a.view.pos.distance(self.actors[target].view.pos)
                };
                score(*i, a).total_cmp(&score(*j, b)).then_with(|| j.cmp(i))
            })
            .map(|(i, _)| i)
    }
    // Share the exact selection, destination and path gates with revive intent.
    pub fn revive_target(&self, i: usize) -> Option<usize> {
        let a = &self.actors[i];
        if !a.alive() || a.committed() || a.revive_cd > 0. {
            return None;
        }
        let t = self
            .actors
            .iter()
            .enumerate()
            .filter(|(_, h)| h.view.state == ActorState::Downed)
            .filter(|(t, _)| self.best_reviver(*t) == Some(i))
            .min_by(|(_, x), (_, y)| {
                a.view
                    .pos
                    .distance(x.view.pos)
                    .total_cmp(&a.view.pos.distance(y.view.pos))
            })
            .map(|(t, _)| t)?;
        let p = self.actors[t].view.pos;
        let spot = self.actor_floor(i).point(
            p + (a.view.pos - p).normalized() * REVIVE_APPROACH_RANGE,
            a.view.radius,
        );
        (self.safe_revive_spot(
            i,
            if a.view.pos.distance(p) <= REVIVE_APPROACH_RANGE + 5. {
                a.view.pos
            } else {
                spot
            },
            t,
        ) && self.safe_support_path(i, spot))
        .then_some(t)
    }
    pub fn recovery_holds_approach(&self) -> bool {
        self.actors
            .iter()
            .filter(|a| a.view.team == Team::Hero && a.alive())
            .count()
            > 1
            && self.actors.iter().enumerate().any(|(i, a)| {
                a.view.team == Team::Hero
                    && a.alive()
                    && (a.action_revive
                        || (self.mage_threat(i, false).is_none()
                            && self.revive_target(i).is_some()))
            })
    }
    // Support navigation must keep the whole segment clear of melee danger.
    pub fn safe_support_path(&self, i: usize, destination: Vec2) -> bool {
        let a = &self.actors[i];
        if self.mage(i) {
            return self.mage_path_safe(i, destination);
        }
        if !matches!(a.view.archetype, Archetype::Runa | Archetype::Kaja) {
            return true;
        }
        let delta = destination - a.view.pos;
        self.actors
            .iter()
            .filter(|e| {
                e.tangible()
                    && e.view.team == Team::Enemy
                    && !matches!(e.view.archetype, Archetype::Sniper | Archetype::Lizardo)
            })
            .all(|e| {
                let t = ((e.view.pos - a.view.pos).dot(delta) / delta.dot(delta).max(0.001))
                    .clamp(0., 1.);
                (a.view.pos + delta * t).distance(e.view.pos) > e.attack_range(a) + 40.
            })
    }
    pub fn known_threat(&self, i: usize, h: &Hazard) -> bool {
        let a = &self.actors[i];
        // Marid's body aura (80 u, 4 dps) outranges melee reach (73 u). Treating it as a threat
        // left Fara/Hondo frozen beside a lone Marid with no safe fight spot (owner, 2026-10-27);
        // melee heroes accept its trickle damage to engage. Mages keep their standoff.
        if h.view.kind == HazardKind::KajaAura && !self.mage(i) {
            return false;
        }
        h.view.hostile
            // Persistent aura damage is accepted to reach and attack its owner.
            && h.view.kind != HazardKind::KajaAura
            && h.view.team != a.view.team
            && h.view.phase != HazardPhase::Resolved
            && (h.known[hero_index(a.view.archetype).unwrap_or(0)]
                || h.view.phase == HazardPhase::Active)
    }
    pub fn needs_dodge(&self, i: usize, h: &Hazard) -> bool {
        let a = &self.actors[i];
        self.known_threat(i, h)
            && if h.view.phase == HazardPhase::Tracking {
                h.target == Some(a.view.id)
                    || h.hits(a.view.pos, h.hit_radius(a.view.radius) + TRACKING_MARGIN)
            } else {
                h.hits(a.view.pos, h.hit_radius(a.view.radius))
            }
    }
    pub fn standoff(&self, i: usize) -> f32 {
        let a = &self.actors[i];
        STANDOFF[hero_index(a.view.archetype).unwrap_or(0)]
            + LOW_HP_STANDOFF * (1. - a.view.hp / a.view.max_hp).clamp(0., 1.)
    }
    pub fn fight_spot_safe(&self, i: usize, p: Vec2) -> bool {
        !self.hazards.iter().any(|h| {
            self.known_threat(i, h)
                && (h.view.phase == HazardPhase::Tracking
                    && h.target == Some(self.actors[i].view.id)
                    || h.hits(
                        p,
                        h.hit_radius(self.actors[i].view.radius)
                            + if h.view.phase == HazardPhase::Tracking {
                                self.standoff(i).max(TRACKING_MARGIN)
                            } else {
                                self.standoff(i)
                            },
                    ))
        })
    }
    // Count covered length along the whole segment, including the destination. This
    // makes every clear route beat every overlapping route regardless of distance.
    pub fn path_overlap(&self, i: usize, end: Vec2, ignored: Option<u32>) -> f32 {
        let a = &self.actors[i];
        let delta = end - a.view.pos;
        let steps = libm::ceilf(delta.length() / 4.).max(1.) as u32;
        let mut overlap = 0.;
        for h in &self.hazards {
            if Some(h.view.id) == ignored || !self.known_threat(i, h) {
                continue;
            }
            let mut exited = !h.hits(a.view.pos, h.hit_radius(a.view.radius));
            for n in 1..=steps {
                let covered = h.hits(
                    a.view.pos + delta * (n as f32 / steps as f32),
                    h.hit_radius(a.view.radius),
                );
                // When already in two hazards, permit leaving their shared coverage;
                // never permit re-entry after the body has cleared either one.
                if covered {
                    overlap +=
                        (delta.length() / steps as f32).max(0.001) * if exited { 2. } else { 1. };
                } else {
                    exited = true;
                }
            }
        }
        overlap
    }
    // Covered travel out of an existing warning is legal. Only entry/re-entry
    // into another warning should deflect a step or invalidate an escape route.
    pub fn path_enters_threat(&self, i: usize, end: Vec2, ignored: Option<u32>) -> bool {
        let a = &self.actors[i];
        let delta = end - a.view.pos;
        let steps = libm::ceilf(delta.length() / 4.).max(1.) as u32;
        self.hazards.iter().any(|h| {
            if Some(h.view.id) == ignored || !self.known_threat(i, h) {
                return false;
            }
            let mut exited = !h.hits(a.view.pos, h.hit_radius(a.view.radius));
            for n in 1..=steps {
                let covered = h.hits(
                    a.view.pos + delta * (n as f32 / steps as f32),
                    h.hit_radius(a.view.radius),
                );
                if covered && exited {
                    return true;
                }
                exited |= !covered;
            }
            false
        })
    }
    // Physical containment may yield while escaping, and may never re-enter a
    // warning the hero already cleared. Floor bounds remain unconditional.
    pub fn containment_safe(&self, i: usize, point: Vec2) -> bool {
        !self.hazards.iter().any(|h| {
            self.known_threat(i, h)
                && (self.needs_dodge(i, h)
                    || h.hits(point, h.hit_radius(self.actors[i].view.radius)))
        })
    }
    pub fn escape_time_to(&self, i: usize, h: &Hazard, goal: Vec2) -> f32 {
        let a = &self.actors[i];
        let mut pos = a.view.pos;
        let mut velocity = a.velocity;
        let mut heading = a.heading;
        for step in 0..180 {
            let delta = goal - pos;
            let desired = delta.normalized() * a.speed().min(delta.length() * 5.);
            (velocity, heading) = crate::math::steer(desired, velocity, heading, a.speed());
            pos = self
                .actor_floor(i)
                .point(pos + velocity * SIM_DT, a.view.radius);
            if !h.hits(pos, h.hit_radius(a.view.radius)) {
                return (step + 1) as f32 * SIM_DT;
            }
        }
        f32::INFINITY
    }
    /// Project onto each shape's nearest boundaries. Both sides of a line are legal,
    /// including the far side; source distance never rewards a retreat.
    pub fn dodge_destination(&self, i: usize, h: &Hazard) -> Vec2 {
        if h.view.phase == HazardPhase::Tracking {
            return self.tracking_destination(i, h);
        }
        let a = &self.actors[i];
        if h.view.kind != HazardKind::LizardoDrop {
            return self.dodge_exit(i, h, h.hit_radius(a.view.radius) + ESCAPE_MARGIN);
        }
        // Bomb damage tests feet. Prefer clearance from the whole body, with the
        // usual arrival margin beyond the requested buffer. Keep actual threats
        // ahead of comfort so a narrow safe pocket still permits an escape.
        let buffered = self.dodge_exit(i, h, a.view.radius + BOMB_AVOID_BUFFER + ESCAPE_MARGIN);
        let safety = |point: Vec2| {
            (
                self.hazards
                    .iter()
                    .filter(|other| {
                        self.known_threat(i, other)
                            && other.hits(point, other.hit_radius(a.view.radius))
                    })
                    .count(),
                self.path_enters_threat(i, point, Some(h.view.id)),
            )
        };
        let has_buffer = !h.hits(buffered, a.view.radius + BOMB_AVOID_BUFFER);
        if has_buffer && safety(buffered) == (0, false) {
            return buffered;
        }
        let fallback = self.dodge_exit(i, h, ESCAPE_MARGIN);
        if has_buffer && safety(buffered) <= safety(fallback) {
            buffered
        } else {
            fallback
        }
    }
    pub fn dodge_exit(&self, i: usize, h: &Hazard, padding: f32) -> Vec2 {
        let a = &self.actors[i];
        let p = a.view.pos;
        let q = p - h.view.origin;
        let d = h.view.dir;
        let side = Vec2::new(-d.y, d.x);
        let mut points = [p; 40];
        match h.view.shape {
            Shape::Line { length, width } => {
                points[0] = p + side * (width * 0.5 + padding - q.dot(side));
                points[1] = p + side * (-width * 0.5 - padding - q.dot(side));
                points[2] = p + d * (-padding - q.dot(d));
                points[3] = p + d * (length + padding - q.dot(d));
            }
            Shape::Circle { radius } => {
                points[0] = h.view.origin + q.normalized() * (radius + padding);
                for (n, point) in points[..8].iter_mut().enumerate().skip(1) {
                    *point = h.view.origin + direction(n as f32 * TAU / 7.) * (radius + padding);
                }
            }
            Shape::Cone {
                length,
                half_angle_rad,
            } => {
                let angle = libm::atan2f(d.y, d.x);
                for (n, sign) in [-1., 1.].into_iter().enumerate() {
                    let edge = direction(angle + half_angle_rad * sign);
                    let normal = Vec2::new(-edge.y * sign, edge.x * sign);
                    points[n] = p + normal * (padding - q.dot(normal));
                }
                points[2] = p + d * (-padding - q.dot(d));
                points[3] = h.view.origin + q.normalized() * (length + padding);
            }
            Shape::Ring { inner, outer } => {
                points[0] = h.view.origin + q.normalized() * (inner - padding).max(0.);
                points[1] = h.view.origin + q.normalized() * (outer + padding);
            }
        }
        // Additional radial exits let a route go around another warning or a wall.
        for (n, point) in points.iter_mut().enumerate().skip(8) {
            let ray = direction((n - 8) as f32 * TAU / 32.);
            let mut distance = 8.;
            while distance <= 2400. {
                let next = p + ray * distance;
                if next != self.actor_floor(i).point(next, a.view.radius) {
                    break;
                }
                if !h.hits(next, padding)
                    && !self.hazards.iter().any(|other| {
                        self.known_threat(i, other)
                            && other.hits(next, other.hit_radius(a.view.radius) + ESCAPE_MARGIN)
                    })
                {
                    *point = next;
                    break;
                }
                distance += 8.;
            }
        }
        let centre = self.centroid();
        let target = a
            .target
            .and_then(|id| self.actor_index(id))
            .map(|t| self.actors[t].view.pos)
            .unwrap_or(a.destination);
        let mut best = f32::INFINITY;
        let mut best_overlap = f32::INFINITY;
        let mut best_time = f32::INFINITY;
        let mut best_entry = true;
        let mut best_covered = usize::MAX;
        let mut result = p;
        for point in points {
            // A bomb exit may shorten at a wall. Reject actual coverage while
            // allowing less than the full comfort/arrival margin when boxed in.
            let bomb = h.view.kind == HazardKind::LizardoDrop;
            let point = if bomb {
                self.actor_floor(i).point(point, a.view.radius)
            } else {
                point
            };
            // Other hazards retain their existing wall and rim rejection.
            if point != self.actor_floor(i).point(point, a.view.radius)
                || h.hits(
                    point,
                    if bomb {
                        padding - ESCAPE_MARGIN
                    } else {
                        padding
                    },
                )
            {
                continue;
            }
            let turn = libm::acosf(a.heading.dot((point - p).normalized()).clamp(-1., 1.));
            let cost = p.distance(point)
                + turn / STEER_TURN * a.speed()
                + point.distance(target) * 0.035
                + point.distance(centre) * 0.015
                + self.boss_standoff_cost(i, point);
            let overlap = self.path_overlap(i, point, Some(h.view.id));
            let covered = self
                .hazards
                .iter()
                .filter(|other| {
                    self.known_threat(i, other)
                        && other.hits(point, other.hit_radius(a.view.radius))
                })
                .count();
            let entry = self.path_enters_threat(i, point, Some(h.view.id));
            let time = self.escape_time_to(i, h, point);
            if (covered, entry, time, overlap, cost)
                < (best_covered, best_entry, best_time, best_overlap, best)
            {
                best_time = time;
                best_entry = entry;
                best_covered = covered;
                best_overlap = overlap;
                best = cost;
                result = point;
            }
        }
        result
    }
    pub fn boss_standoff_cost(&self, i: usize, point: Vec2) -> f32 {
        let a = &self.actors[i];
        self.actors
            .iter()
            .filter(|b| b.alive() && is_boss(b.view.archetype))
            .map(|b| {
                let preferred =
                    (a.attack_range(b) - self.standoff(i)).max(a.view.radius + b.view.radius);
                let floor = a.view.pos.distance(b.view.pos).min(preferred);
                let delta = point - a.view.pos;
                let t = ((b.view.pos - a.view.pos).dot(delta) / delta.dot(delta).max(0.001))
                    .clamp(0., 1.);
                let closest = a.view.pos + delta * t;
                (floor - closest.distance(b.view.pos)).max(0.) * DODGE_BOSS_STANDOFF_COST
            })
            .sum()
    }
    /// Follow the live aim laterally; the target must keep moving even outside twin rays.
    pub fn tracking_destination(&self, i: usize, h: &Hazard) -> Vec2 {
        let a = &self.actors[i];
        let p = a.view.pos;
        let side = Vec2::new(-h.view.dir.y, h.view.dir.x);
        let targeted = h.target == Some(a.view.id);
        let mut best = (true, usize::MAX, f32::INFINITY, f32::INFINITY);
        let mut result = p;
        for sign in [-1., 1.] {
            let ray = side * sign;
            let mut distance = if targeted { a.speed().max(60.) } else { 1. };
            if targeted {
                // A shorter perpendicular goal still builds momentum beside a corner.
                for (pos, dir, lo, hi) in [
                    (
                        p.x,
                        ray.x,
                        self.floor.min.x + a.view.radius,
                        self.floor.max.x - a.view.radius - 0.001,
                    ),
                    (
                        p.y,
                        ray.y,
                        self.floor.min.y + a.view.radius,
                        self.floor.max.y - a.view.radius - 0.001,
                    ),
                ] {
                    if dir > 0. {
                        distance = distance.min(((hi - pos) / dir - 0.01).max(0.));
                    } else if dir < 0. {
                        distance = distance.min(((lo - pos) / dir - 0.01).max(0.));
                    }
                }
                if distance < 3. {
                    continue;
                }
            }
            // Bystanders take the shortest perpendicular exit from the current full footprint.
            if !targeted {
                while distance < 2400.
                    && h.hits(
                        p + ray * distance,
                        h.hit_radius(a.view.radius) + TRACKING_MARGIN + 1.,
                    )
                {
                    distance += 1.;
                }
            }
            let point = p + ray * distance;
            if point != self.actor_floor(i).point(point, a.view.radius) {
                continue;
            }
            let overlap = self.path_overlap(i, point, Some(h.view.id));
            // Preserve lateral momentum as tracking turns. At rest prefer the party/open floor.
            let continuity = if targeted && a.dodge_hazard == Some(h.view.id) {
                (a.destination - p).normalized().dot(ray) * a.speed()
            } else {
                0.
            };
            let cost = if targeted { -distance } else { distance } - continuity
                + point.distance(self.centroid()) * 0.015
                - self.floor.ray(point, ray, 500.) * 0.01
                + self.boss_standoff_cost(i, point);
            let covered = self
                .hazards
                .iter()
                .filter(|other| {
                    self.known_threat(i, other)
                        && other.view.id != h.view.id
                        && other.hits(point, other.hit_radius(a.view.radius))
                })
                .count();
            let score = (
                self.path_enters_threat(i, point, Some(h.view.id)),
                covered,
                cost,
                overlap,
            );
            if score < best {
                best = score;
                result = point;
            }
        }
        result
    }
    pub fn attack_has_time(&self, i: usize, shadow: bool) -> bool {
        let a = &self.actors[i];
        if !self.mage_attack_window(
            i,
            if shadow {
                CAST_DURATION
            } else {
                BASIC_DURATION
            },
        ) || !self.fight_spot_safe(i, a.view.pos)
        {
            return false;
        }
        true
    }
    /// Generic targetability/read gate; an unavailable actor still belongs to its living wave.
    pub fn can_engage(&self, hero: usize, enemy: usize) -> bool {
        let e = &self.actors[enemy];
        if !e.tangible() || e.view.team != Team::Enemy || e.view.state == ActorState::Spawn {
            return false;
        }
        // Every hero reads the same seeded delay distribution, at every HP level.
        let mut rng = crate::rng::Rng(
            self.cfg.seed
                ^ (self.actors[hero].view.id as u64).wrapping_mul(0x9e3779b97f4a7c15)
                ^ e.view.id as u64,
        );
        e.formed_age + 0.00001 >= rng.range(ENGAGE_READ_MIN, ENGAGE_READ_MAX)
    }

    pub fn incoming(&self, hero: usize) -> Option<Vec2> {
        self.actors
            .iter()
            .enumerate()
            .find(|(i, _)| self.can_engage(hero, *i))
            .map(|(_, a)| a.view.pos)
    }
    pub fn choose_hero_intent(&mut self, i: usize) {
        let a = self.actors[i].clone();
        let k = hero_index(a.view.archetype).unwrap_or(0);
        let centre = self.centroid();
        let nearest = self
            .actors
            .iter()
            .enumerate()
            .filter(|(t, _)| self.can_engage(i, *t))
            .min_by(|(_, x), (_, y)| {
                a.view
                    .pos
                    .distance(x.view.pos)
                    .total_cmp(&a.view.pos.distance(y.view.pos))
            })
            .map(|(t, _)| t);
        let target = a
            .target
            .and_then(|id| self.actor_index(id))
            .filter(|t| self.can_engage(i, *t))
            .filter(|t| {
                nearest.is_none_or(|n| {
                    a.view.pos.distance(self.actors[*t].view.pos)
                        <= a.attack_range(&self.actors[*t])
                        || a.view.pos.distance(self.actors[n].view.pos)
                            > a.attack_range(&self.actors[n])
                })
            })
            .filter(|t| {
                nearest.is_none_or(|n| {
                    a.view.pos.distance(self.actors[*t].view.pos)
                        <= a.view.pos.distance(self.actors[n].view.pos) + 70.
                })
            })
            .or(nearest);
        let target = self.priority_healer(i).or(target);
        let mut threat = None;
        let mut urgency = f32::INFINITY;
        for (n, h) in self.hazards.iter().enumerate() {
            if !self.needs_dodge(i, h) {
                continue;
            }
            let slack = if h.view.phase == HazardPhase::Active {
                -1.
            } else {
                h.remaining()
            };
            if slack < urgency {
                threat = Some(n);
                urgency = slack;
            }
        }
        if a.committed() {
            if a.action_special {
                return;
            }
            if a.action_revive {
                if threat.is_none() && self.mage_threat(i, true).is_none() {
                    return;
                }
                self.cancel_revive(i);
            } else if a.view.state_age < a.view.impact_at || !a.action_done {
                return;
            }
            self.actors[i].action_done = true;
            self.actors[i].action_revive = false;
            self.actors[i].state(ActorState::Idle, 0., 0.);
        }
        if let Some(n) = threat {
            let h = &self.hazards[n];
            let id = h.view.id;
            // Retain the selected exit until it becomes unsafe or the hazard changes.
            if h.view.phase == HazardPhase::Tracking
                || a.dodge_hazard != Some(id)
                || h.hits(a.destination, h.hit_radius(a.view.radius))
                || a.view.pos.distance(a.destination) < 3.
                || a.destination != self.actor_floor(i).point(a.destination, a.view.radius)
                || self.hazards.iter().any(|other| {
                    self.known_threat(i, other)
                        && other.hits(a.destination, other.hit_radius(a.view.radius))
                })
                || self.path_enters_threat(i, a.destination, Some(id))
            {
                self.actors[i].destination = self.dodge_destination(i, h);
            }
            self.actors[i].dodge_hazard = Some(id);
            self.actors[i].view.ai_intent = AiIntent::Dodge;
            return;
        }
        if a.view.ai_intent == AiIntent::Dodge
            && a.view.pos.distance(a.destination) > 3.
            && a.dodge_hazard.is_some_and(|id| {
                self.hazards
                    .iter()
                    .any(|h| h.view.id == id && h.view.phase != HazardPhase::Resolved)
            })
        {
            // Complete the crossing, then choose a fighting spot with standoff.
            return;
        }
        self.actors[i].dodge_hazard = None;
        if let Some(e) = self.mage_threat(i, false) {
            self.actors[i].target = target.map(|t| self.actors[t].view.id);
            self.actors[i].destination = self.mage_goal(i, e, true);
            self.actors[i].view.ai_intent = AiIntent::Retreat;
            return;
        }
        if let Some(p) = self.chest_goal(i) {
            self.actors[i].target = None;
            self.actors[i].destination = p;
            self.actors[i].view.ai_intent = AiIntent::Regroup;
            return;
        }
        if let Some(p) = self
            .interest_points
            .iter()
            .find(|(id, _)| *id == self.actors[i].view.id)
            .map(|(_, p)| *p)
        {
            self.actors[i].target = None;
            self.actors[i].destination = p;
            self.actors[i].view.ai_intent = AiIntent::Regroup;
            return;
        }
        if let Some(t) = self.revive_target(i) {
            let p = self.actors[t].view.pos;
            self.actors[i].view.ai_intent = AiIntent::Revive;
            self.actors[i].destination = if a.view.pos.distance(p) <= REVIVE_APPROACH_RANGE + 5. {
                a.view.pos
            } else {
                self.actor_floor(i).point(
                    p + (a.view.pos - p).normalized() * REVIVE_APPROACH_RANGE,
                    a.view.radius,
                )
            };
            self.actors[i].target = Some(self.actors[t].view.id);
            return;
        }
        if let Some(t) = target {
            let enemy = self.actors[t].clone();
            let p = enemy.view.pos;
            let reach = if self.autonomous() {
                a.attack_range(&enemy)
            } else {
                a.stats.reach
            };
            let distance = a.view.pos.distance(p);
            self.actors[i].target = Some(enemy.view.id);
            let shadow_spot = (a.view.archetype == Archetype::Hondo
                && self.autonomous()
                && a.combo_phase == 0
                && a.view.meter + 0.00001 >= 1. - COMBO_BASIC_GAIN
                && !crate::groove::shadow_line_aligned(a.view.pos, p))
            .then(|| self.shadow_approach(i, t))
            .flatten();
            if self.mage(i) {
                self.mage_position(i, t);
            } else if let Some(spot) = shadow_spot {
                self.actors[i].destination = spot;
                self.actors[i].view.ai_intent = AiIntent::MoveToRange;
            } else if distance <= reach
                && (k < 2 || distance >= reach * RANGED_CROWDED)
                && self.fight_spot_safe(i, a.view.pos)
            {
                self.actors[i].view.ai_intent = AiIntent::Attack;
                self.actors[i].destination = a.view.pos;
            } else {
                let intent = AiIntent::MoveToRange;
                if a.target != Some(enemy.view.id)
                    || a.view.ai_intent != intent
                    || (a.goal_cd <= 0. && p.distance(a.goal_target_pos) > GOAL_REPLAN)
                    || a.view.pos.distance(a.destination) < 8.
                {
                    let radial = (if k < 2 { centre } else { a.view.pos }) - p;
                    let angle = libm::atan2f(radial.y, radial.x)
                        + if k < 2 {
                            if k == 0 {
                                -0.4
                            } else {
                                0.4
                            }
                        } else {
                            let strafe = if distance < reach * RANGED_CROWDED {
                                0.65
                            } else {
                                0.12
                            };
                            if k == 2 {
                                -strafe
                            } else {
                                strafe
                            }
                        };
                    self.actors[i].destination = self
                        .floor
                        .point(p + direction(angle) * reach * 0.8, a.view.radius);
                    self.actors[i].goal_target_pos = p;
                    self.actors[i].goal_cd = GOAL_HOLD;
                }
                if !self.fight_spot_safe(i, self.actors[i].destination)
                    || self.path_enters_threat(i, self.actors[i].destination, None)
                {
                    self.actors[i].destination = a.view.pos;
                    let mut best = f32::INFINITY;
                    for n in 0..32 {
                        let candidate = self.actor_floor(i).point(
                            p + direction(n as f32 * TAU / 32.) * reach * 0.9,
                            a.view.radius,
                        );
                        if !self.fight_spot_safe(i, candidate)
                            || self.path_enters_threat(i, candidate, None)
                        {
                            continue;
                        }
                        let cost = a.view.pos.distance(candidate)
                            + self.path_overlap(i, candidate, None) * 100000.;
                        if cost < best {
                            best = cost;
                            self.actors[i].destination = candidate;
                        }
                    }
                }
                self.actors[i].view.ai_intent = intent;
            }
            if a.view.hp < a.view.max_hp * 0.6 && self.actors[i].view.ai_intent != AiIntent::Retreat
            {
                if let Some(h) = self.hazards.iter().find(|h| {
                    h.view.team == Team::Hero
                        && !h.view.hostile
                        && h.view.phase == HazardPhase::Active
                        && h.remaining() > 1.
                        && !h.hits(a.view.pos, 0.)
                        && a.view.pos.distance(h.view.origin) < 400.
                        && h.view.kind == HazardKind::ElevateRing
                        && self.safe_support_path(i, h.view.origin)
                }) {
                    self.actors[i].view.ai_intent = AiIntent::SeekZone;
                    self.actors[i].destination = h.view.origin;
                }
            }
        } else {
            self.actors[i].target = None;
            self.actors[i].view.ai_intent = AiIntent::Regroup;
            if let Some(p) = self.incoming(i) {
                self.actors[i].destination = a.view.pos;
                self.actors[i].velocity = Vec2::default();
                self.actors[i].view.ai_intent = AiIntent::None;
                if (p.x - a.view.pos.x).abs() > 1. {
                    self.actors[i].view.facing = if p.x < a.view.pos.x {
                        Facing::Left
                    } else {
                        Facing::Right
                    };
                }
            } else if !self.encounter.complete
                || self.encounter.hold_position
                || self.party_recovering()
            {
                self.actors[i].destination = a.view.pos;
                self.actors[i].velocity = Vec2::default();
                self.actors[i].view.ai_intent = AiIntent::None;
            } else {
                let advance = (self.floor.min + self.floor.max) * 0.5;
                self.actors[i].destination = self
                    .actor_floor(i)
                    .point(advance + TRAVEL_SLOTS[k], a.view.radius);
                self.actors[i].goal_cd = GOAL_HOLD;
            }
        }
    }
    pub fn hero_ai(&mut self) {
        let count = self.actors.len();
        let recovering = self.party_recovering();
        for i in 0..count {
            self.hero_ai_actor(i, recovering);
        }
    }
    pub fn hero_ai_actor(&mut self, i: usize, recovering: bool) {
        let count = self.actors.len();
        for _once in 0..1 {
            if self.actors[i].view.team != Team::Hero || !self.actors[i].alive() {
                continue;
            }
            let covered = self.hazards.iter().any(|h| self.needs_dodge(i, h));
            let lost_target = self.actors[i].target.is_some_and(|id| {
                self.actor_index(id).is_none_or(|t| {
                    self.actors[t].view.team == Team::Enemy && !self.can_engage(i, t)
                })
            });
            if covered
                || lost_target
                || self.actors[i].ai_cd <= 0.
                || (recovering && self.actors[i].view.ai_intent == AiIntent::Regroup)
                || (!recovering
                    && self.incoming(i).is_some()
                    && self.actors[i].view.ai_intent == AiIntent::None
                    && self.actors[i].target.is_none())
            {
                self.actors[i].ai_cd = self.actors[i].ai_cd.min(0.) + AI_INTERVAL;
                self.choose_hero_intent(i);
            }
            // A new wave invalidates an old travel goal without resetting the decision clock.
            if self.actors[i].view.ai_intent == AiIntent::Regroup && !self.encounter.complete {
                self.actors[i].destination = self.actors[i].view.pos;
                self.actors[i].velocity = Vec2::default();
                self.actors[i].view.ai_intent = AiIntent::None;
            }
            if self.actors[i].committed() {
                continue;
            }
            if self.autonomous() && self.groove_action(i) {
                continue;
            }
            // Hold travel throughout recovery, but pursuit only while a teammate can revive.
            // A mage may still clear a nearby enemy guarding a downed ally.
            if recovering
                && !self.mage_clearing_revive(i)
                && (self.actors[i].view.ai_intent == AiIntent::Regroup
                    || (self.actors[i].view.ai_intent == AiIntent::MoveToRange
                        && self.recovery_holds_approach()))
            {
                self.actors[i].destination = self.actors[i].view.pos;
                self.actors[i].velocity = Vec2::default();
                self.actors[i].view.ai_intent = AiIntent::None;
            }
            let a = self.actors[i].clone();
            let target = a.target.and_then(|id| self.actor_index(id));
            if self.autonomous() {
                if a.view.ai_intent == AiIntent::Revive
                    && a.revive_cd <= 0.
                    && target.is_some_and(|t| {
                        self.safe_revive_spot(i, a.view.pos, t)
                            && self.actors[t].view.state == ActorState::Downed
                            && a.view.pos.distance(self.actors[t].view.pos)
                                <= REVIVE_APPROACH_RANGE + 5.
                    })
                {
                    self.start_action(i, a.target, false, true);
                    continue;
                }
                if !matches!(
                    a.view.ai_intent,
                    AiIntent::Dodge | AiIntent::Revive | AiIntent::None
                ) {
                    let in_range = target.is_some_and(|t| {
                        self.can_engage(i, t)
                            && a.view.pos.distance(self.actors[t].view.pos)
                                <= a.attack_range(&self.actors[t])
                    });
                    if in_range && a.basic_cd <= 0. && self.attack_has_time(i, false) {
                        self.start_action(i, a.target, false, false);
                        continue;
                    }
                }
            }
            let delta = a.destination - a.view.pos;
            let mut desired = Vec2::default();
            if !matches!(a.view.ai_intent, AiIntent::Attack | AiIntent::None)
                && delta.length() > 0.75
            {
                desired = delta.normalized() * a.speed().min(delta.length() * 5.);
            }
            if self.autonomous()
                && !matches!(a.view.ai_intent, AiIntent::Dodge | AiIntent::Attack)
                && (a.view.ai_intent != AiIntent::None || self.incoming(i).is_none())
            {
                let separation = if matches!(a.view.ai_intent, AiIntent::Regroup | AiIntent::None) {
                    IDLE_SEPARATION
                } else {
                    SEPARATION
                };
                for j in 0..count {
                    if i == j || self.actors[j].view.team != Team::Hero || !self.actors[j].alive() {
                        continue;
                    }
                    let q = a.view.pos - self.actors[j].view.pos;
                    if q.length() < separation {
                        let away = if q.length() > 0.001 {
                            q.normalized()
                        } else {
                            (TRAVEL_SLOTS[crate::actors::hero_index(a.view.archetype).unwrap()]
                                - TRAVEL_SLOTS[crate::actors::hero_index(
                                    self.actors[j].view.archetype,
                                )
                                .unwrap()])
                            .normalized()
                        };
                        desired = desired
                            + away
                                * ((separation - q.length())
                                    * if separation == IDLE_SEPARATION {
                                        1.5
                                    } else {
                                        0.65
                                    });
                    }
                }
            }
            let (mut movement, heading) =
                crate::math::steer(desired, a.velocity, a.heading, a.speed());
            self.actors[i].heading = heading;
            #[cfg(feature = "bound-diagnostics")]
            let before_deflection = movement;
            // Every moving intent checks warning entry. Already-covered travel may
            // leave overlapping warnings without either warning cancelling the exit.
            let next = a.view.pos + movement * SIM_DT;
            let body_safe =
                |point| a.view.ai_intent == AiIntent::Dodge || self.mage_path_safe(i, point);
            if self.path_enters_threat(i, next, None) || !body_safe(next) {
                let mut best = f32::INFINITY;
                let speed = movement.length();
                movement = Vec2::default();
                for n in 0..32 {
                    let candidate = direction(n as f32 * TAU / 32.) * speed;
                    let next = a.view.pos + candidate * SIM_DT;
                    if next != self.actor_floor(i).point(next, a.view.radius)
                        || self.path_enters_threat(i, next, None)
                        || !body_safe(next)
                    {
                        continue;
                    }
                    let cost = next.distance(a.destination);
                    if cost < best {
                        best = cost;
                        movement = candidate;
                    }
                }
            }
            #[cfg(feature = "bound-diagnostics")]
            crate::bound::deflection(i, (movement - before_deflection) * SIM_DT);
            #[cfg(feature = "bound-diagnostics")]
            crate::bound::movement(
                i,
                movement * SIM_DT,
                self.floor
                    .point(a.view.pos + movement * SIM_DT, a.view.radius)
                    - (a.view.pos + movement * SIM_DT),
            );
            self.actors[i].velocity = movement;
            self.actors[i].view.pos = self
                .floor
                .point(a.view.pos + movement * SIM_DT, a.view.radius);
            if movement.length() > 1. {
                if movement.x.abs() > 18. {
                    self.actors[i].view.facing = if movement.x < 0. {
                        Facing::Left
                    } else {
                        Facing::Right
                    };
                }
                self.actors[i].state(ActorState::Walk, 0., 0.);
            } else {
                self.actors[i].state(ActorState::Idle, 0., 0.);
            }
        }
    }
    pub fn constrain_party(&mut self) {
        // The boss occupies its body disc even during a cast or a hero blink.
        for b in 0..self.actors.len() {
            if !self.autonomous() {
                break;
            }
            if !is_boss(self.actors[b].view.archetype) || !self.actors[b].alive() {
                continue;
            }
            let pos = self.actors[b].view.pos;
            let radius = self.actors[b].view.radius;
            for i in 0..self.actors.len() {
                if i == b || self.actors[i].view.team != Team::Hero || !self.actors[i].alive() {
                    continue;
                }
                let delta = self.actors[i].view.pos - pos;
                let minimum = radius + self.actors[i].view.radius;
                if delta.length() < minimum {
                    let dir = if delta.length() > 0.00001 {
                        delta.normalized()
                    } else {
                        Vec2::new(-1., 0.)
                    };
                    if !self.containment_safe(i, pos + dir * minimum) {
                        continue;
                    }
                    #[cfg(feature = "bound-diagnostics")]
                    crate::bound::correction(i, 1, pos + dir * minimum - self.actors[i].view.pos);
                    self.actors[i].view.pos = pos + dir * minimum;
                }
            }
        }
        // Free roaming retains only the floor/body constraints. A wide-arena
        // screen bound clamps each hero independently around the current camera.
        for i in 0..self.actors.len() {
            let floor = self.actor_floor(i);
            let a = &mut self.actors[i];
            let before = a.view.pos;
            a.view.pos = floor.point(a.view.pos, a.view.radius);
            #[cfg(feature = "bound-diagnostics")]
            crate::bound::correction(a.view.id as usize - 1, 2, a.view.pos - before);
            #[cfg(not(feature = "bound-diagnostics"))]
            let _ = before;
        }
        if self.cfg.cohesion == Cohesion::ScreenBound {
            // Recompute after each independent clamp so the published living-centroid
            // camera also contains the extremes. Y and in-screen heroes stay untouched.
            for _ in 0..32 {
                let focus = self.centroid();
                let mut changed = false;
                for a in &mut self.actors {
                    if a.view.team != Team::Hero || !a.alive() {
                        continue;
                    }
                    let half = (self.cfg.visible_width * 0.5 - a.view.radius).max(0.);
                    let x = a.view.pos.x.clamp(focus.x - half, focus.x + half);
                    changed |= (x - a.view.pos.x).abs() > 0.0001;
                    a.view.pos.x = x;
                }
                if !changed {
                    break;
                }
            }
        }
        // Resolve residual overlap by moving the boss, preserving safe hero positions.
        if self.autonomous() {
            for b in 0..self.actors.len() {
                if !is_boss(self.actors[b].view.archetype) || !self.actors[b].alive() {
                    continue;
                }
                for _ in 0..32 {
                    let mut changed = false;
                    for i in 0..self.actors.len() {
                        if i == b
                            || self.actors[i].view.team != Team::Hero
                            || !self.actors[i].alive()
                        {
                            continue;
                        }
                        let delta = self.actors[b].view.pos - self.actors[i].view.pos;
                        let minimum = self.actors[b].view.radius + self.actors[i].view.radius;
                        if delta.length() < minimum - 0.0001 {
                            if self.actors[b].fortress {
                                // Fortress holds its floor position; body separation yields the hero.
                                let old = self.actors[i].view.pos;
                                let mut point = old;
                                let mut cost = f32::INFINITY;
                                for n in 0..64 {
                                    let p = self.actors[b].view.pos
                                        + direction(n as f32 * TAU / 64.) * (minimum + 0.01);
                                    if p != self.actor_floor(i).point(p, self.actors[i].view.radius)
                                        || self.actors.iter().enumerate().any(|(j, a)| {
                                            j != i
                                                && a.view.team == Team::Hero
                                                && a.alive()
                                                && p.distance(a.view.pos)
                                                    < a.view.radius + self.actors[i].view.radius
                                        })
                                    {
                                        continue;
                                    }
                                    let score = p.distance(old)
                                        + if self.containment_safe(i, p) {
                                            0.
                                        } else {
                                            1000000.
                                        };
                                    if score < cost {
                                        cost = score;
                                        point = p;
                                    }
                                }
                                changed |= point != old;
                                self.actors[i].view.pos = point;
                                continue;
                            }
                            let dir = if delta.length() > 0.00001 {
                                delta.normalized()
                            } else {
                                Vec2::new(1., 0.)
                            };
                            let raw = self.actors[i].view.pos + dir * minimum;
                            let mut point =
                                self.actor_floor(b).point(raw, self.actors[b].view.radius);
                            if point != raw
                                || self.actors.iter().any(|a| {
                                    a.view.team == Team::Hero
                                        && a.alive()
                                        && point.distance(a.view.pos)
                                            < a.view.radius + self.actors[b].view.radius - 0.0001
                                })
                            {
                                let mut best = f32::INFINITY;
                                for n in 0..32 {
                                    let candidate = self.actors[i].view.pos
                                        + direction(n as f32 * TAU / 32.) * (minimum + 0.01);
                                    if candidate
                                        != self
                                            .actor_floor(b)
                                            .point(candidate, self.actors[b].view.radius)
                                    {
                                        continue;
                                    }
                                    let overlap: f32 = self
                                        .actors
                                        .iter()
                                        .filter(|a| a.view.team == Team::Hero && a.alive())
                                        .map(|a| {
                                            (a.view.radius + self.actors[b].view.radius
                                                - candidate.distance(a.view.pos))
                                            .max(0.)
                                        })
                                        .sum();
                                    let cost = if overlap > 0.0001 {
                                        1000000. + overlap * 10000.
                                    } else {
                                        candidate.distance(self.actors[b].view.pos)
                                    };
                                    if cost < best {
                                        best = cost;
                                        point = candidate;
                                    }
                                }
                            }
                            self.actors[b].view.pos = point;
                            changed = true;
                        }
                    }
                    if !changed {
                        break;
                    }
                }
            }
        }
        self.sync_boss_anchors();
        self.sync_hero_areas();
        for i in 0..self.actors.len() {
            if self.actors[i].view.team == Team::Hero
                && self.actors[i].alive()
                && self.actors[i].committed()
                && !self.actors[i].action_revive
            {
                self.face_target(i);
            }
        }
    }
}
