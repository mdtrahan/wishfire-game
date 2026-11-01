//! Fixed-distance teleports, weighted by open travel and the existing retreat/range intent.
use crate::{
    api::*,
    math::{direction, projectile_entry},
    tuning::*,
    Sim,
};

impl Sim {
    pub fn marid_hop_distance(&self) -> f32 {
        (self.snapshot.arena_max.x - self.snapshot.arena_min.x) * MARID_HOP_WIDTH
    }

    /// Return destination and unobstructed forward distance for this direction.
    pub fn marid_candidate(&self, i: usize, dir: Vec2) -> Option<(Vec2, f32)> {
        let a = &self.actors[i];
        let pos = a.view.pos;
        let hop = self.marid_hop_distance();
        let end = pos + dir * hop;
        if self.actor_floor(i).point(end, a.view.radius).distance(end) > 0.001 {
            return None;
        }
        let mut clear = f32::INFINITY;
        for (p, d, lo, hi) in [
            (
                pos.x,
                dir.x,
                self.snapshot.arena_min.x + a.view.radius,
                self.snapshot.arena_max.x - a.view.radius,
            ),
            (
                pos.y,
                dir.y,
                self.snapshot.arena_min.y + a.view.radius,
                self.snapshot.arena_max.y - a.view.radius,
            ),
        ] {
            if d.abs() > 0.00001 {
                clear = clear.min((if d > 0. { hi - p } else { lo - p }) / d.abs());
            }
        }
        for (j, other) in self.actors.iter().enumerate() {
            if i == j || !other.tangible() {
                continue;
            }
            let radius = a.view.radius
                + ACTOR_MOAT
                + other.view.radius
                + if is_boss(other.view.archetype) {
                    0.
                } else {
                    ACTOR_MOAT
                };
            let delta = end - other.view.pos;
            if Vec2::new(delta.x, delta.y / ACTOR_MOAT_DEPTH).length() < radius + 0.01 {
                return None;
            }
            // Conservative enclosing circle measures open travel beyond the landing.
            let entry = projectile_entry(pos, dir, other.view.pos, radius * ACTOR_MOAT_DEPTH, 0.);
            if entry >= 0. {
                clear = clear.min(entry);
            }
        }
        Some((end, clear.max(0.)))
    }

    pub fn marid_weights(&self, i: usize, weighted: bool) -> [(Vec2, f32); 32] {
        let a = &self.actors[i];
        let nearest = |p: Vec2| {
            self.actors
                .iter()
                .filter(|h| h.alive() && h.view.team == Team::Hero)
                .map(|h| p.distance(h.view.pos) - h.view.radius - a.view.radius)
                .fold(f32::INFINITY, f32::min)
        };
        let distance = nearest(a.view.pos);
        let desired = MARID_BOLT_REACH * 0.85;
        let mut choices = [(a.view.pos, 0.); 32];
        for (n, choice) in choices.iter_mut().enumerate() {
            let dir = direction(TAU * n as f32 / 32.);
            if let Some((end, clear)) = self.marid_candidate(i, dir) {
                // Preserve retreat while close; approach firing range if stranded far away.
                let progress = if distance < desired {
                    nearest(end) - distance
                } else {
                    (distance - desired).abs() - (nearest(end) - desired).abs()
                };
                let intent = (1. + progress / self.marid_hop_distance()).max(0.05);
                let open = (clear / self.marid_hop_distance()).clamp(0.05, 8.);
                *choice = (end, if weighted { intent * open * open } else { 1. });
            }
        }
        choices
    }

    pub fn marid_teleport(&mut self, i: usize) {
        self.actors[i].velocity = Vec2::default();
        self.actors[i].state(ActorState::Idle, 0., 0.);
        if self.actors[i].relocate_left > 0. || self.actors[i].view.teleport_steps > 0 {
            return;
        }
        let choices = self.marid_weights(i, true);
        let total: f32 = choices.iter().map(|c| c.1).sum();
        if total <= 0. {
            return;
        } // Occupied floor: retry, never shorten a hop.
        let mut roll = self.actors[i].ai_rng.range(0., total);
        let mut destination = self.actors[i].view.pos;
        for (end, weight) in choices {
            if weight <= 0. {
                continue;
            }
            destination = end;
            roll -= weight;
            if roll <= 0. {
                break;
            }
        }
        let id = self.actors[i].view.id;
        let from = self.actors[i].view.pos;
        // Freeze only attacks committed before this discontinuity. Reacquisition is ordinary AI.
        for a in &mut self.actors {
            if a.view.team == Team::Hero
                && a.target == Some(id)
                && a.committed()
                && !a.action_done
                && !a.action_revive
                && !a.action_target_teleported
            {
                a.action_target_pos = from;
                a.action_target_teleported = true;
            }
            if a.view.team == Team::Hero && a.target == Some(id) && !a.committed() {
                a.target = None;
                a.view.target = None;
                a.destination = a.view.pos;
                a.velocity = Vec2::default();
                a.goal_cd = 0.;
                a.ai_cd = 0.;
                a.view.ai_intent = AiIntent::None;
                a.state(ActorState::Idle, 0., 0.);
            }
        }
        for h in &mut self.hazards {
            if h.view.team == Team::Hero
                && h.target == Some(id)
                && matches!(
                    h.view.kind,
                    HazardKind::GroundPound | HazardKind::BubblePop | HazardKind::ArcanePulse
                )
            {
                h.target = None;
            }
        }
        for p in &mut self.projectiles {
            if p.view.team == Team::Hero && p.target == Some(id) {
                p.target = None;
            }
        }
        let budget = (self.marid_hop_distance() / MARID_TRAVEL_SCALE)
            .max(self.actors[i].speed() * MARID_VISIBLE_SECONDS);
        let a = &mut self.actors[i];
        a.view.teleport_steps = MARID_TELEPORT_STEPS;
        a.action_done = true;
        a.target = None;
        a.view.target = None;
        a.destination = destination;
        a.heading = (destination - from).normalized();
        a.view.facing = if a.heading.x < 0. {
            Facing::Left
        } else {
            Facing::Right
        };
        // Distance budget preserves sub-tick remainder and follows live slow/speed modifiers.
        a.relocate_left = a.relocate_left.min(0.).max(-a.speed() * SIM_DT) + budget;
    }
}
