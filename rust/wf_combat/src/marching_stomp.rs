//! Locked, forward-marching Troll circles. All geometry decisions use fixed storage.
use crate::{api::*, tuning::*, Sim};
impl Sim {
    pub fn stomp_radius(&self, i: usize) -> f32 {
        let a = &self.actors[i];
        STOMP_RADIUS
            * if a.view.enraged {
                a.phase_rule.map_or(1., |r| r.radius_scale)
            } else {
                1.
            }
    }
    pub fn stomp_plan(&self, i: usize, t: usize) -> Option<([Vec2; STOMP_COUNT], usize, Vec2)> {
        let a = &self.actors[i];
        let target = &self.actors[t];
        if !target.alive() || target.view.team != Team::Hero {
            return None;
        }
        let delta = target.view.pos - a.view.pos;
        let distance = delta.length();
        let radius = self.stomp_radius(i);
        let first = a.view.radius + STOMP_FIRST_GAP;
        if distance <= 0.0001
            || distance > first + STOMP_SPACING * (STOMP_COUNT - 1) as f32 + radius
        {
            return None;
        }
        let aim = delta.normalized();
        let mut centres = [Vec2::default(); STOMP_COUNT];
        let mut count = 0;
        for (k, centre) in centres.iter_mut().enumerate() {
            let p = a.view.pos + aim * (first + STOMP_SPACING * k as f32);
            if self.floor.point(p, radius) != p {
                break;
            }
            *centre = p;
            count += 1;
        }
        (count >= STOMP_MIN_COUNT).then_some((centres, count, aim))
    }
    pub fn stomp_covers(&self, i: usize, t: usize) -> bool {
        let Some((centres, count, _)) = self.stomp_plan(i, t) else {
            return false;
        };
        let radius = self.stomp_radius(i);
        self.actors.iter().enumerate().any(|(j, a)| {
            a.alive()
                && a.view.team == Team::Hero
                && self.taunt_target(i).is_none_or(|forced| j == forced)
                && centres[..count]
                    .iter()
                    .any(|p| p.distance(a.view.pos) <= radius)
        })
    }
    pub fn spawn_marching_stomp(&mut self, i: usize, t: usize) -> f32 {
        let Some((centres, count, aim)) = self.stomp_plan(i, t) else {
            return 0.;
        };
        let owner = self.actors[i].view.id;
        let target = self.actors[t].view.id;
        let mut total: f32 = 0.;
        for (k, &centre) in centres[..count].iter().enumerate() {
            self.hazard(HazardKind::BossStompStep, owner, Some(target), centre, aim);
            let h = self.hazards.last_mut().unwrap();
            let delay = k as f32 * STOMP_STAGGER;
            // Negative action age holds an already-visible locked rim at zero fill.
            h.phase_age = -delay;
            total = total.max(h.duration + delay);
        }
        total
    }
}
