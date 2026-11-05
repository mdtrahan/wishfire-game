use macroquad::prelude::*;
use wf_combat::SpotlightConfig;
pub struct Controls {
    pub paused: bool,
    pub speed: f32,
    pub debug: bool,
    pub seed: u64,
    pub spotlight: usize,
    /// Requests from the Dev Tooling Modal, applied by the next `read`.
    restart: bool,
    step: bool,
    cycle_spotlight: bool,
}
pub struct Action {
    pub restart: bool,
    /// Placeholder for the boss control button (bead .7): B summons the available boss.
    pub summon_boss: bool,
    pub step: bool,
    pub spotlight_changed: bool,
}
impl Controls {
    pub fn spotlight_config(&self) -> SpotlightConfig {
        [
            SpotlightConfig::OFF,
            SpotlightConfig::CONSERVATIVE,
            SpotlightConfig::DEFAULT,
            SpotlightConfig::AGGRESSIVE,
        ][self.spotlight]
    }

    pub fn new() -> Self {
        Self {
            paused: false,
            speed: 1.,
            debug: false,
            // Owner: every page load should play out differently. The sim stays deterministic
            // for a given seed (shown in the debug overlay); only the starting seed varies.
            seed: {
                let t = (macroquad::miniquad::date::now() * 1000.) as u64;
                (t ^ (t >> 29)).wrapping_mul(0x9E37_79B9_7F4A_7C15) % 1_000_000 + 1
            },
            spotlight: 2,
            restart: false,
            step: false,
            cycle_spotlight: false,
        }
    }
    pub fn spotlight_label(&self) -> &'static str {
        ["Spot: Off", "Spot: Con", "Spot: Def", "Spot: Agg"][self.spotlight]
    }
    /// A Dev Tooling Modal button (`ui::dev`): pause, speed and diagnostics apply at once; a
    /// restart, a single step and the spotlight preset wait for the next `read`.
    pub fn dev(&mut self, hit: crate::ui::dev::DevHit) {
        use crate::ui::dev::DevHit as D;
        match hit {
            D::Pause => self.paused = !self.paused,
            D::Speed(speed) => self.speed = speed as f32,
            D::Diagnostics => self.debug = !self.debug,
            D::Restart => self.restart = true,
            D::Step => self.step = true,
            D::Spotlight => self.cycle_spotlight = true,
            D::Open | D::Close | D::ResetGame | D::Level(_) => {}
        }
    }
    /// The developer keys and any pending modal requests (combat screen only).
    pub fn read(&mut self) -> Action {
        if is_key_pressed(KeyCode::D) { self.debug = !self.debug; }
        if is_key_pressed(KeyCode::P) { self.paused = !self.paused; }
        if is_key_pressed(KeyCode::Key1) { self.speed = 1.; }
        if is_key_pressed(KeyCode::Key2) { self.speed = 2.; }
        if is_key_pressed(KeyCode::Key4) { self.speed = 4.; }
        let restart = is_key_pressed(KeyCode::R) || std::mem::take(&mut self.restart);
        if restart { self.seed = self.seed.wrapping_add(1); }
        let spotlight_changed = is_key_pressed(KeyCode::S) || std::mem::take(&mut self.cycle_spotlight);
        if spotlight_changed { self.spotlight = (self.spotlight + 1) % 4; }
        let step = std::mem::take(&mut self.step) || is_key_pressed(KeyCode::N);
        Action { restart, summon_boss: is_key_pressed(KeyCode::B), step: self.paused && step, spotlight_changed }
    }
    pub fn draw(&self) {
        if self.paused { draw_text("PAUSED", 242., 38., 11., YELLOW); }
    }
}
