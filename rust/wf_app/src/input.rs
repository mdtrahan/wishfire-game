use crate::camera::Portrait;
use macroquad::prelude::*;
use wf_combat::SpotlightConfig;
pub struct Controls {
    pub paused: bool,
    pub speed: f32,
    pub debug: bool,
    pub seed: u64,
    pub menu_open: bool,
    pub spotlight: usize,
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
    fn spotlight_label(&self) -> &'static str {
        ["Spot: Off", "Spot: Con", "Spot: Def", "Spot: Agg"][self.spotlight]
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
            menu_open: false,
            spotlight: 2,
        }
    }
    pub fn read(&mut self, portrait: &Portrait) -> Action {
        let click = is_mouse_button_pressed(MouseButton::Left)
            .then(|| portrait.pointer())
            .flatten();
        let menu_hit = click.is_some_and(|p| p.x >= 324. && p.y < 44.);
        let button = if self.menu_open && !menu_hit {
            click.filter(|p| p.x < 324. && p.y < 44.).map(|p| {
                if p.x < 252. {
                    (p.x / 42.) as usize
                } else {
                    6
                }
            })
        } else {
            None
        };
        if is_key_pressed(KeyCode::D)
            || (!self.menu_open && !menu_hit && click.is_some_and(|p| p.x < 36. && p.y < 44.))
        {
            self.debug = !self.debug;
        }
        if menu_hit {
            self.menu_open = !self.menu_open;
        }
        if click.is_some_and(|p| p.y >= 44.) {
            self.menu_open = false;
        }
        if is_key_pressed(KeyCode::P) || button == Some(0) {
            self.paused = !self.paused;
        }
        if is_key_pressed(KeyCode::Key1) || button == Some(2) {
            self.speed = 1.;
        }
        if is_key_pressed(KeyCode::Key2) || button == Some(3) {
            self.speed = 2.;
        }
        if is_key_pressed(KeyCode::Key4) || button == Some(4) {
            self.speed = 4.;
        }
        let restart = is_key_pressed(KeyCode::R) || button == Some(5);
        if restart {
            self.seed = self.seed.wrapping_add(1);
        }
        let spotlight_changed = is_key_pressed(KeyCode::S) || button == Some(6);
        if spotlight_changed {
            self.spotlight = (self.spotlight + 1) % 4;
        }
        Action {
            restart,
            summon_boss: is_key_pressed(KeyCode::B),
            step: self.paused && (is_key_pressed(KeyCode::N) || button == Some(1)),
            spotlight_changed,
        }
    }
    pub fn draw(&self) {
        if self.menu_open {
            // Replace the existing top overlay so controls add no occlusion below 44px.
            draw_rectangle(0., 0., 324., 44., Color::from_rgba(15, 24, 38, 245));
            for (i, label) in [
                if self.paused { "Play" } else { "Pause" },
                "Step",
                "1x",
                "2x",
                "4x",
                "New",
                self.spotlight_label(),
            ]
            .iter()
            .enumerate()
            {
                let active = (i == 2 && self.speed == 1.)
                    || (i == 3 && self.speed == 2.)
                    || (i == 4 && self.speed == 4.);
                let x = i as f32 * 42.;
                let width = if i == 6 { 72. } else { 42. };
                if active {
                    draw_rectangle(x + 2., 3., 38., 38., Color::from_rgba(44, 97, 126, 220));
                }
                draw_text(
                    label,
                    x + (width - measure_text(label, None, 12, 1.).width) / 2.,
                    27.,
                    12.,
                    if i == 1 && !self.paused { GRAY } else { WHITE },
                );
            }
        } else if self.paused {
            draw_text("PAUSED", 242., 38., 11., YELLOW);
        }
        draw_rectangle(324., 0., 36., 44., Color::from_rgba(15, 24, 38, 165));
        // Three strokes avoid relying on a font's Unicode coverage for the menu glyph.
        for y in [15., 21., 27.] {
            draw_line(334., y, 350., y, 1.6, WHITE);
        }
    }
}
