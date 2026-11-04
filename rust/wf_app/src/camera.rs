use macroquad::prelude::*;
use wf_combat::api::{ActorState, Event, Snapshot, Team};
pub const WIDTH: f32 = 360.;
pub const HEIGHT: f32 = 640.;
pub const ZOOM: f32 = 0.5;
pub const SQUASH: f32 = 0.75;
/// The arena band inside the 360x640 frame (`rustCombatCamera.mjs` COMBAT_VIEW): the HUD owns
/// the top strip and the strip/nav own the bottom.
pub const BAND_TOP: f32 = 42.;
pub const BAND_BOTTOM: f32 = 430.;
pub const BAND_CENTRE: f32 = (BAND_TOP + BAND_BOTTOM) * 0.5;
#[derive(Clone)]
pub struct WorldCamera {
    pub centre: Vec2,
    pub zoom: f32,
    pub offset: Vec2,
    velocity: Vec2,
    pub actor_offsets: Vec<(u32, Vec2)>,
    pub hero_bodies: Vec<macroquad::prelude::Rect>,
}
fn damp(position: &mut f32, velocity: &mut f32, target: f32, omega: f32, dt: f32) {
    let offset = *position - target;
    let decay = (-omega * dt).exp();
    let change = (*velocity + omega * offset) * dt;
    *position = target + (offset + change) * decay;
    *velocity = (*velocity - omega * change) * decay;
}
impl WorldCamera {
    pub fn new(s: &Snapshot) -> Self {
        let mut c = Self {
            centre: vec2(s.camera_focus.x, s.camera_focus.y),
            zoom: ZOOM,
            offset: Vec2::ZERO,
            velocity: Vec2::ZERO,
            actor_offsets: Vec::new(),
            hero_bodies: Vec::new(),
        };
        c.update(s, 1.);
        c
    }
    fn clamp(&mut self, s: &Snapshot) {
        let half = vec2(WIDTH / (2. * self.zoom), HEIGHT / (2. * self.zoom * SQUASH));
        for (value, min, max, h) in [
            (&mut self.centre.x, s.arena_min.x, s.arena_max.x, half.x),
            (&mut self.centre.y, s.arena_min.y, s.arena_max.y, half.y),
        ] {
            *value = if max - min < 2. * h {
                (min + max) / 2.
            } else {
                value.clamp(min + h, max - h)
            };
        }
    }
    pub fn events(&mut self, events: &[Event], s: &Snapshot) {
        // The WFM host starts the boss attempt as a new world: its scene reset and the boss arrival
        // land in one batch, so the reset applies first and the arrival cut wins.
        if events
            .iter()
            .any(|e| matches!(e, Event::WaveReset | Event::SceneReset))
        {
            *self = Self::new(s);
        }
        if let Some(id) = events.iter().find_map(|e| match e {
            Event::BossArrived { id } => Some(*id),
            _ => None,
        }) {
            if let Some(boss) = s.actors.iter().find(|a| a.id == id) {
                self.centre = vec2(boss.pos.x, boss.pos.y + 540.);
                self.zoom = ZOOM;
                self.velocity = Vec2::ZERO;
            }
        }
    }
    pub fn update(&mut self, s: &Snapshot, dt: f32) {
        if dt <= 0. {
            return;
        }
        let heroes: Vec<_> = s
            .actors
            .iter()
            .filter(|a| {
                a.team == Team::Hero
                    && a.hp > 0.
                    && !matches!(a.state, ActorState::Downed | ActorState::Dead)
            })
            .collect();
        if heroes.is_empty() {
            self.velocity = Vec2::ZERO;
            return;
        }
        let centroid = heroes
            .iter()
            .fold(Vec2::ZERO, |sum, a| sum + vec2(a.pos.x, a.pos.y))
            / heroes.len() as f32;
        let nearest = s
            .actors
            .iter()
            .filter(|a| a.team == Team::Enemy && a.hp > 0.)
            .map(|a| vec2(a.pos.x, a.pos.y))
            .chain(
                s.hazards
                    .iter()
                    .filter(|h| h.kind == wf_combat::api::HazardKind::SpawnMarker)
                    .map(|h| vec2(h.origin.x, h.origin.y)),
            )
            .min_by(|a, b| {
                a.distance_squared(centroid)
                    .total_cmp(&b.distance_squared(centroid))
            });
        if let Some(boss) = s.actors.iter().find(|a| {
            crate::render::actors::is_boss(a.archetype) && a.state == ActorState::Spawn && a.hp > 0.
        }) {
            self.centre = vec2(boss.pos.x, boss.pos.y + 540.);
            self.zoom = ZOOM;
            self.velocity = Vec2::ZERO;
            return;
        }
        let look = nearest.map(|p| (p - centroid) * 0.3).unwrap_or(Vec2::ZERO);
        let target = centroid + vec2(look.x.clamp(-40., 40.), look.y.clamp(-180., 180.) - 50.);
        damp(&mut self.centre.x, &mut self.velocity.x, target.x, 3.5, dt);
        damp(&mut self.centre.y, &mut self.velocity.y, target.y, 7., dt);
        self.clamp(s);
        // Body bounds include sprite height; the translucent HUD remains clear of living actors.
        let mut min = vec2(f32::INFINITY, f32::INFINITY);
        let mut max = vec2(f32::NEG_INFINITY, f32::NEG_INFINITY);
        for a in heroes {
            min = min.min(vec2(a.pos.x - 96., a.pos.y - 210.));
            max = max.max(vec2(a.pos.x + 96., a.pos.y + 30.));
        }
        let hero_min = min;
        let hero_max = max;
        if let Some(boss) = s
            .actors
            .iter()
            .find(|a| crate::render::actors::is_boss(a.archetype) && a.hp > 0.)
        {
            let low = min.min(vec2(boss.pos.x - 160., boss.pos.y - 370.));
            let high = max.max(vec2(boss.pos.x + 160., boss.pos.y + 40.));
            // Owner: telegraph sizes must read the same in every fight, so the boss fight keeps
            // the standard zoom and frames the boss and party by camera position only.
            self.zoom = ZOOM;
            min = low;
            max = high;
        }
        // Only constrain spring lag when an actor would otherwise leave the useful view.
        for (value, velocity, low, high, hero_low, hero_high) in [
            (
                &mut self.centre.x,
                &mut self.velocity.x,
                max.x - (WIDTH / 2. - 8.) / self.zoom,
                min.x + (WIDTH / 2. - 8.) / self.zoom,
                hero_max.x - (WIDTH / 2. - 8.) / self.zoom,
                hero_min.x + (WIDTH / 2. - 8.) / self.zoom,
            ),
            (
                &mut self.centre.y,
                &mut self.velocity.y,
                max.y - (BAND_BOTTOM - BAND_CENTRE) / (self.zoom * SQUASH),
                min.y + (BAND_CENTRE - BAND_TOP) / (self.zoom * SQUASH),
                hero_max.y - (BAND_BOTTOM - BAND_CENTRE) / (self.zoom * SQUASH),
                hero_min.y + (BAND_CENTRE - BAND_TOP) / (self.zoom * SQUASH),
            ),
        ] {
            let fitted = if low <= high {
                value.clamp(low, high)
            } else if hero_low <= hero_high {
                // A distant boss can exceed the fixed view. Keep the living party fully
                // visible while showing the largest possible portion of the boss.
                ((low + high) * 0.5).clamp(hero_low, hero_high)
            } else {
                // The party alone is wider than the view: centre on the party so any overflow
                // is split evenly between its outermost heroes, never biased toward the boss.
                (hero_low + hero_high) * 0.5
            };
            if fitted != *value {
                *value = fitted;
                *velocity = 0.;
            }
        }
    }
    /// Actor art follows the full-frame crowd offset; gameplay ground points use project().
    pub fn actor_foot(&self, a: &wf_combat::ActorView) -> Vec2 {
        self.project(a.pos) + self.actor_offsets.iter().find(|o| o.0 == a.id)
            .map_or(Vec2::ZERO, |o| o.1 * self.zoom)
    }
    pub fn project(&self, p: wf_combat::api::Vec2) -> Vec2 {
        vec2(
            (p.x - self.centre.x) * self.zoom + WIDTH / 2. + self.offset.x,
            (p.y - self.centre.y) * self.zoom * SQUASH + BAND_CENTRE + self.offset.y,
        )
    }
    fn arena_image_rect(&self, image_pixels: Vec2) -> (Vec2, Vec2) {
        // Artwork pixel (0,0) is world (0,0); the walkable floor is an inset.
        (
            self.project(wf_combat::Vec2::new(0., 0.)),
            vec2(
                image_pixels.x * self.zoom,
                image_pixels.y * self.zoom * SQUASH,
            ),
        )
    }
    pub fn ground(&self, assets: &crate::assets::Assets, _s: &Snapshot) {
        let (p, size) = self.arena_image_rect(vec2(assets.arena.width(), assets.arena.height()));
        // The camera may frame a tall sprite beyond an arena edge. Mirrored overscan
        // continues the artwork into that margin with full texture detail.
        let left = (-p.x / size.x).floor() as i32;
        let right = ((WIDTH - p.x) / size.x).floor() as i32;
        let top = (-p.y / size.y).floor() as i32;
        let bottom = ((HEIGHT - p.y) / size.y).floor() as i32;
        for y in top..=bottom {
            for x in left..=right {
                draw_texture_ex(
                    &assets.arena,
                    p.x + x as f32 * size.x,
                    p.y + y as f32 * size.y,
                    WHITE,
                    DrawTextureParams {
                        dest_size: Some(size),
                        flip_x: x % 2 != 0,
                        flip_y: y % 2 != 0,
                        ..Default::default()
                    },
                );
            }
        }
        draw_rectangle(
            0.,
            BAND_TOP,
            WIDTH,
            BAND_BOTTOM - BAND_TOP,
            Color::new(0.05, 0.07, 0.09, 0.12),
        );
    }
}
// Logical geometry stays fixed; the target follows the physical pixel density.
pub struct Portrait {
    pub target: RenderTarget,
}
impl Portrait {
    pub fn new() -> Self {
        let (w, h) = Self::target_size();
        let target = render_target(w, h);
        target.texture.set_filter(FilterMode::Linear);
        Self { target }
    }
    /// Target pixels per logical pixel.
    pub fn density() -> f32 {
        ((screen_width() / WIDTH).min(screen_height() / HEIGHT) * screen_dpi_scale()).clamp(1., 4.)
    }
    fn target_size() -> (u32, u32) {
        let density = Self::density();
        (
            (WIDTH * density).round() as u32,
            (HEIGHT * density).round() as u32,
        )
    }
    pub fn resize(&mut self) {
        let (w, h) = Self::target_size();
        if self.target.texture.width() as u32 != w || self.target.texture.height() as u32 != h {
            self.target = render_target(w, h);
            self.target.texture.set_filter(FilterMode::Linear);
        }
    }
    pub fn layout(&self) -> (f32, Vec2) {
        let scale = (screen_width() / WIDTH).min(screen_height() / HEIGHT);
        (
            scale,
            vec2(
                (screen_width() - WIDTH * scale) * 0.5,
                (screen_height() - HEIGHT * scale) * 0.5,
            ),
        )
    }
    pub fn pointer(&self) -> Option<Vec2> {
        let (s, offset) = self.layout();
        let (x, y) = mouse_position();
        let p = (vec2(x, y) - offset) / s;
        if (0. ..WIDTH).contains(&p.x) && (0. ..HEIGHT).contains(&p.y) {
            Some(p)
        } else {
            None
        }
    }
    pub fn begin(&self) {
        let mut c = Camera2D::from_display_rect(Rect::new(0., 0., WIDTH, HEIGHT));
        c.render_target = Some(self.target.clone());
        set_camera(&c);
        clear_background(Color::from_rgba(17, 22, 32, 255));
    }
    pub fn present(&self) {
        set_default_camera();
        clear_background(BLACK);
        let (s, p) = self.layout();
        draw_texture_ex(
            &self.target.texture,
            p.x,
            p.y,
            WHITE,
            DrawTextureParams {
                dest_size: Some(vec2(WIDTH * s, HEIGHT * s)),
                flip_y: true,
                ..Default::default()
            },
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use wf_combat::{Sim, SimConfig};
    #[test]
    fn compact_arena_height_exceeds_useful_view_by_about_ten_percent() {
        let sim = crate::testing::sim();
        let snapshot = sim.snapshot();
        let height = snapshot.arena_max.y - snapshot.arena_min.y;
        let useful_height = (BAND_BOTTOM - BAND_TOP) / (ZOOM * SQUASH);
        assert_eq!(height, 1552.);
        // The WFM band (42..430) shows less of the arena than the slice's full frame did.
        assert!(height > useful_height);
    }
    #[test]
    fn arena_pixels_and_walkable_outline_share_world_registration() {
        let sim = crate::testing::sim();
        let camera = WorldCamera::new(sim.snapshot());
        let (origin, size) = camera.arena_image_rect(vec2(960., 2200.));
        assert_eq!(size, vec2(960. * camera.zoom, 2200. * camera.zoom * SQUASH));
        for p in [sim.snapshot().arena_min, sim.snapshot().arena_max] {
            let pixel = origin + vec2(p.x * camera.zoom, p.y * camera.zoom * SQUASH);
            assert!(pixel.distance(camera.project(p)) < 0.0001);
        }
    }
    #[test]
    fn defeat_holds_last_camera_until_wave_reset_then_cuts() {
        let sim = crate::testing::sim();
        let mut snapshot = sim.snapshot().clone();
        for a in &mut snapshot.actors {
            a.pos.y -= 800.;
        }
        let mut camera = WorldCamera::new(&snapshot);
        let held = camera.centre;
        for a in &mut snapshot.actors {
            a.hp = 0.;
            a.state = ActorState::Downed;
        }
        snapshot.camera_focus = wf_combat::Vec2::new(480., 1900.);
        for _ in 0..90 {
            camera.update(&snapshot, 1. / 30.);
        }
        assert_eq!(camera.centre, held);
        let reset = sim.snapshot();
        camera.events(&[Event::WaveReset], reset);
        assert_eq!(camera.centre, WorldCamera::new(reset).centre);
        assert_ne!(camera.centre, held);
    }
    #[test]
    fn four_speed_camera_keeps_living_heroes_inside_combat_through_boss() {
        // WFM host loop (ORKA-63bf.12): Chapter 1 at 4x client speed through the boss arrival.
        let mut run = crate::testing::HostRun::new(1);
        let mut camera = WorldCamera::new(run.snapshot());
        let mut boss_frames = 0;
        let mut boss_visible = 0;
        for _ in 0..6000 {
            for _ in 0..4 { run.step(); }
            let events = run.drain_events();
            let s = run.snapshot().clone();
            if events.iter().any(|e| matches!(e, Event::SceneReset | Event::WaveReset)) { camera = WorldCamera::new(&s); }
            camera.update(&s, 1. / 60.);
            // No tether in the vertical arena: a party wider than the view (opposite boss dodges)
            // may overflow, but only by an even split of the excess, never one-sided.
            let (lo, hi) = s.actors.iter().filter(|a| a.team == Team::Hero && a.hp > 0.).fold((f32::MAX, f32::MIN), |(lo, hi), a| (lo.min(a.pos.x), hi.max(a.pos.x)));
            let excess = ((hi - lo + 80.) * camera.zoom - WIDTH).max(0.);
            let slack = excess * 0.5 + 0.1;
            for a in s.actors.iter().filter(|a| a.team == Team::Hero && a.hp > 0.) {
                let p = camera.project(a.pos);
                assert!(p.x - 40. * camera.zoom >= -slack && p.x + 40. * camera.zoom <= WIDTH + slack, "hero {:?} horizontally clipped at t={} p={:?}", a.archetype, s.time, p);
                assert!(p.y - 156. * camera.zoom * SQUASH >= BAND_TOP - 0.1 && p.y + 24. * camera.zoom * SQUASH <= BAND_BOTTOM + 0.1,
                    "hero {:?} vertically clipped at t={} p={:?} centre={:?}", a.archetype, s.time, p, camera.centre);
            }
            if let Some(boss) = s.actors.iter().find(|a| crate::render::actors::is_boss(a.archetype) && a.hp > 0.) {
                boss_frames += 1;
                let p = camera.project(boss.pos);
                if p.x > 0. && p.x < WIDTH && p.y > BAND_TOP && p.y < BAND_BOTTOM { boss_visible += 1; }
            }
            if boss_frames > 600 { break; }
        }
        assert!(boss_frames > 0, "seed 1 did not reach boss arrival");
        assert!(boss_visible as f32 / boss_frames as f32 > 0.8, "boss centre visible for {boss_visible}/{boss_frames} frames");
    }
}

// boss_entry_tests::boss_arrival_cuts_instead_of_panning_and_holds_intro_framing retired (ORKA-63bf.12): the slice
// scrolled a tall arena and cut to the boss intro; the WFM arena fits the view, so the clamp returns the camera to the
// party on the next update and the intro framing cannot hold. The reset-before-cut order in `events` is kept.
