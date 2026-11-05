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
    set_spotlight: Option<usize>,
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
            set_spotlight: None,
        }
    }
    /// A Dev Tools button (`ui::dev`): pause, speed and diagnostics apply at once; a restart,
    /// a single step and the spotlight preset wait for the next `read`.
    pub fn dev(&mut self, hit: crate::ui::dev::DevHit) {
        use crate::ui::dev::DevHit as D;
        match hit {
            D::Pause => self.paused = !self.paused,
            D::Speed(speed) => self.speed = speed,
            D::Diagnostics => self.debug = !self.debug,
            D::Restart => self.restart = true,
            D::Step => self.step = true,
            D::Spotlight(preset) => self.set_spotlight = Some(preset.min(3)),
            _ => {}
        }
    }
    /// The developer keys (ignored when `keys` is false: an input-locked ceremony is playing)
    /// and any pending modal requests (combat screen only).
    pub fn read(&mut self, keys: bool) -> Action {
        let pressed = |key: KeyCode| keys && is_key_pressed(key);
        if pressed(KeyCode::D) { self.debug = !self.debug; }
        if pressed(KeyCode::P) { self.paused = !self.paused; }
        if pressed(KeyCode::Key1) { self.speed = 1.; }
        if pressed(KeyCode::Key2) { self.speed = 2.; }
        if pressed(KeyCode::Key4) { self.speed = 4.; }
        let restart = pressed(KeyCode::R) || std::mem::take(&mut self.restart);
        if restart { self.seed = self.seed.wrapping_add(1); }
        let chosen = self.set_spotlight.take();
        let spotlight_changed = pressed(KeyCode::S) || chosen.is_some();
        if let Some(preset) = chosen { self.spotlight = preset; } else if spotlight_changed { self.spotlight = (self.spotlight + 1) % 4; }
        let step = std::mem::take(&mut self.step) || pressed(KeyCode::N);
        Action { restart, summon_boss: pressed(KeyCode::B), step: self.paused && step, spotlight_changed }
    }
    pub fn draw(&self) {
        if self.paused { draw_text("PAUSED", 242., 38., 11., YELLOW); }
    }
}
