use crate::{Shape, Vec2};
use core::ops::{Add, Mul, Sub};
impl Add for Vec2 {
    type Output = Self;
    fn add(self, b: Self) -> Self {
        Self::new(self.x + b.x, self.y + b.y)
    }
}
impl Sub for Vec2 {
    type Output = Self;
    fn sub(self, b: Self) -> Self {
        Self::new(self.x - b.x, self.y - b.y)
    }
}
impl Mul<f32> for Vec2 {
    type Output = Self;
    fn mul(self, k: f32) -> Self {
        Self::new(self.x * k, self.y * k)
    }
}
impl Vec2 {
    pub fn dot(self, b: Self) -> f32 {
        self.x * b.x + self.y * b.y
    }
    pub fn length(self) -> f32 {
        libm::sqrtf(self.dot(self))
    }
    pub fn normalized(self) -> Self {
        let l = self.length();
        if l > 0.00001 {
            self * (1. / l)
        } else {
            Self::new(1., 0.)
        }
    }
    pub fn distance(self, b: Self) -> f32 {
        (self - b).length()
    }
    pub fn clamp(self, lo: Self, hi: Self) -> Self {
        Self::new(self.x.clamp(lo.x, hi.x), self.y.clamp(lo.y, hi.y))
    }
}
pub fn direction(a: f32) -> Vec2 {
    Vec2::new(libm::cosf(a), libm::sinf(a))
}
/// First distance along a unit ray entering an up-screen vertical capsule.
/// The union of its two round caps and central rectangle preserves entry order.
pub fn projectile_entry(origin: Vec2, dir: Vec2, foot: Vec2, radius: f32, height: f32) -> f32 {
    let top = foot - Vec2::new(0., height);
    let mut first = f32::INFINITY;
    for centre in [foot, top] {
        let q = centre - origin;
        let along = q.dot(dir);
        let disc = radius * radius - (q.dot(q) - along * along);
        if q.dot(q) <= radius * radius {
            return 0.;
        }
        if disc >= 0. {
            let entry = along - libm::sqrtf(disc);
            if entry >= 0. {
                first = first.min(entry);
            }
        }
    }
    if height > 0. {
        let mut enter: f32 = 0.;
        let mut exit = f32::INFINITY;
        for (p, d, lo, hi) in [
            (origin.x, dir.x, foot.x - radius, foot.x + radius),
            (origin.y, dir.y, top.y, foot.y),
        ] {
            if d.abs() < 0.000001 {
                if p < lo || p > hi {
                    return first;
                }
            } else {
                let a = (lo - p) / d;
                let b = (hi - p) / d;
                enter = enter.max(a.min(b));
                exit = exit.min(a.max(b));
            }
        }
        if enter <= exit {
            first = first.min(enter);
        }
    }
    first
}
/// Shared acceleration/turn/arrival budget for movement and escape prediction.
pub fn steer(desired: Vec2, velocity: Vec2, mut heading: Vec2, speed: f32) -> (Vec2, Vec2) {
    use crate::{
        tuning::{STEER_ACCEL, STEER_TURN, TAU},
        SIM_DT,
    };
    let mut wanted = Vec2::default();
    if desired.length() > 0.1 {
        let angle = libm::atan2f(desired.y, desired.x);
        let old = libm::atan2f(heading.y, heading.x);
        let diff = (angle - old + core::f32::consts::PI).rem_euclid(TAU) - core::f32::consts::PI;
        heading = direction(old + diff.clamp(-STEER_TURN * SIM_DT, STEER_TURN * SIM_DT));
        wanted = heading * desired.length().min(speed) * libm::cosf(diff).max(0.15);
    }
    let change = wanted - velocity;
    let mut movement = velocity + change.normalized() * change.length().min(STEER_ACCEL * SIM_DT);
    if movement.length() <= 0.1 {
        movement = Vec2::default();
    } else {
        heading = movement.normalized();
    }
    (movement, heading)
}
pub fn contains(shape: Shape, origin: Vec2, dir: Vec2, point: Vec2, body: f32) -> bool {
    let d = point - origin;
    match shape {
        Shape::Circle { radius } => d.length() <= radius + body,
        Shape::Ring { inner, outer } => {
            let l = d.length();
            l + body >= inner && l <= outer + body
        }
        Shape::Line { length, width } => {
            let along = d.dot(dir);
            along >= -body
                && along <= length + body
                && (d.x * dir.y - d.y * dir.x).abs() <= width * 0.5 + body
        }
        Shape::Cone {
            length,
            half_angle_rad,
        } => {
            let l = d.length();
            l <= length + body
                && (l <= body
                    || d.dot(dir) / l >= libm::cosf(half_angle_rad + libm::atan2f(body, l)))
        }
    }
}

/// Keep the entire body on the painted floor, including its half-open upper edges.
pub fn floor_point(p: Vec2, radius: f32) -> Vec2 {
    let pad = Vec2::new(radius, radius);
    p.clamp(
        crate::tuning::ARENA_MIN + pad,
        crate::tuning::ARENA_MAX - pad - Vec2::new(0.001, 0.001),
    )
}

/// Length along a locked ray before its end reaches the walkable wall.
pub fn floor_ray(origin: Vec2, dir: Vec2, length: f32) -> f32 {
    let mut result = length;
    for (p, d, lo, hi) in [
        (
            origin.x,
            dir.x,
            crate::tuning::ARENA_MIN.x,
            crate::tuning::ARENA_MAX.x,
        ),
        (
            origin.y,
            dir.y,
            crate::tuning::ARENA_MIN.y,
            crate::tuning::ARENA_MAX.y,
        ),
    ] {
        if d > 0. {
            result = result.min((hi - 0.001 - p) / d);
        } else if d < 0. {
            result = result.min((lo - p) / d);
        }
    }
    result.max(0.)
}

/// Closest interior destination with a body/edge margin. Zone AI depends on this
/// geometry seam rather than assuming every friendly footprint is a circle.
pub fn nearest_inside(
    shape: Shape,
    origin: Vec2,
    dir: Vec2,
    point: Vec2,
    margin: f32,
) -> Option<Vec2> {
    let margin = margin.max(0.);
    if contains(shape, origin, dir, point, -margin) {
        return Some(point);
    }
    let pad = margin + 0.001;
    let axis = dir.normalized();
    let side = Vec2::new(-axis.y, axis.x);
    let d = point - origin;
    let result = match shape {
        Shape::Circle { radius } => {
            if radius < pad {
                return None;
            }
            origin + d.normalized() * d.length().min(radius - pad)
        }
        Shape::Ring { inner, outer } => {
            if inner + pad > outer - pad {
                return None;
            }
            origin + d.normalized() * d.length().clamp(inner + pad, outer - pad)
        }
        Shape::Line { length, width } => {
            if length < pad * 2. || width < pad * 2. {
                return None;
            }
            origin
                + axis * d.dot(axis).clamp(pad, length - pad)
                + side * d.dot(side).clamp(-width * 0.5 + pad, width * 0.5 - pad)
        }
        Shape::Cone {
            length,
            half_angle_rad,
        } => {
            let outer = length - pad;
            let sin = libm::sinf(half_angle_rad);
            if outer <= pad || sin <= 0. {
                return None;
            }
            let apex = pad / sin;
            if apex > outer {
                return None;
            }
            let mut best = origin + axis * apex;
            let mut cost = point.distance(best);
            // Orthogonal projection onto either inset straight edge.
            for sign in [-1., 1.] {
                let edge = axis * libm::cosf(half_angle_rad) + side * (sign * sin);
                let inward = axis * sin - side * (sign * libm::cosf(half_angle_rad));
                let lo = apex * libm::cosf(half_angle_rad);
                let hi = libm::sqrtf((outer * outer - pad * pad).max(0.));
                if lo > hi {
                    continue;
                }
                let p = origin + inward * pad + edge * (d - inward * pad).dot(edge).clamp(lo, hi);
                if contains(shape, origin, axis, p, -margin) && point.distance(p) < cost {
                    best = p;
                    cost = point.distance(p);
                }
            }
            let angle = libm::atan2f(d.dot(side), d.dot(axis));
            let limit = (half_angle_rad - libm::asinf((pad / outer).clamp(0., 1.))).max(0.);
            let angle = angle.clamp(-limit, limit);
            let p = origin + (axis * libm::cosf(angle) + side * libm::sinf(angle)) * outer;
            if point.distance(p) < cost {
                best = p;
            }
            best
        }
    };
    contains(shape, origin, axis, result, -margin).then_some(result)
}
