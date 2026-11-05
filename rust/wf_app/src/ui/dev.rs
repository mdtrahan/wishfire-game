//! Developer controls as page elements. Main's two pills sit at the frame's top right on every
//! screen (`devToolingRuntime.js` DEV, `index.html` `#dev2-toggle`): DEV opens Dev Tools, DEV2
//! toggles the diagnostics overlay. They replace the slice's canvas menu.
//!
//! Dev Tools (owner 2026-11-05) is laid out for tuning an idle combat game, one section per
//! thing a developer changes: the run (clock, speed, Skill Spotlight), the stage (chapter, wave,
//! boss), the party (who fights, at what level), the economy (currencies, orbs, drop rate, the
//! Bag ceremony), the view (overlays) and the saves. Every control is a button: the element
//! bridge reports clicks only, so values move by steps and presets instead of typed fields.
//! The sections read the live game each frame (`DevState`), so a roster with more heroes or a
//! chapter with a different wave count shows up here without changes.
use super::dom::{el, Node};
use super::Act;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum DevHit {
    Open, Close, Diagnostics, Circles,
    Pause, Step, Speed(f32), Restart, Spotlight(usize),
    /// Chapter and wave move by a signed step; `WaveFirst` / `WaveLast` / `Boss` jump.
    Chapter(i32), Wave(i32), WaveFirst, WaveLast, Boss,
    /// Roster index in or out of the party.
    Member(usize), Level(u32), LevelStep(i32),
    Gold(u32), Essence(u32), Incense(u32), DropOrbs(u32), ClearOrbs,
    /// Orb drop chance in percent, for this page session.
    DropRate(u32), CascadeFill,
    ResetGame, RestoreSnapshot,
}
/// What the panel shows of the game (filled by the frame loop while the panel is open).
#[derive(Clone, Debug, Default, PartialEq)]
pub struct DevState {
    pub paused: bool, pub speed: f32, pub spotlight: usize,
    pub seed: u64, pub fps: i32,
    pub chapter: u32, pub wave: u32, pub waves: u32,
    /// `locked`, `available`, `armed` or `active`.
    pub boss: &'static str,
    pub live_enemies: u32, pub enemy_names: String,
    /// The roster: display name, in the party.
    pub party: Vec<(String, bool)>,
    pub level: u32,
    pub gold: f64, pub essence: f64, pub incense: f64,
    pub bag_stored: f64, pub bag_capacity: f64, pub bag_level: u32,
    pub orbs: usize, pub drop_percent: u32,
    pub snapshot: bool,
}
#[derive(Default)]
pub struct DevUi {
    pub open: bool,
    /// The result of the last action, shown under the title.
    pub status: String,
    pub state: DevState,
    /// The diagnostics overlay is showing (DEV2).
    pub diagnostics: bool,
    /// Draw each hero's orb pickup circle on the battlefield.
    pub circles: bool,
    requests: Vec<DevHit>,
}
/// The host paces 0.25x to 4x (`Session::driver_advance`, the JS driver's range).
pub const SPEEDS: [f32; 5] = [0.25, 0.5, 1., 2., 4.];
pub const SPOTLIGHTS: [&str; 4] = ["Off", "Rare", "Default", "Often"];
pub const LEVEL_PRESETS: [u32; 5] = [1, 5, 25, 50, 100];
pub const DROP_RATES: [u32; 3] = [10, 50, 100];
fn count(n: f64) -> String { super::model::format_number(n.floor()) }
impl DevUi {
    /// A click: the panel opens and closes here and owns its own toggles; everything else is
    /// for the frame loop.
    pub fn act(&mut self, hit: DevHit) {
        match hit {
            DevHit::Open => { self.open = true; self.status.clear(); }
            DevHit::Close => self.open = false,
            DevHit::Circles => self.circles = !self.circles,
            // These are watched on the battlefield: the panel gets out of the way.
            DevHit::Restart | DevHit::CascadeFill => { self.open = false; self.requests.push(hit); }
            other => self.requests.push(other),
        }
    }
    pub fn take(&mut self) -> Vec<DevHit> { std::mem::take(&mut self.requests) }
    /// The two pills at the frame's top right, on every screen.
    pub fn launchers(&self) -> [Node<Act>; 2] {
        [
            el("button").class("dev-launcher").attr("type", "button").label("Open Dev Tools").t("DEV").on(Act::Dev(DevHit::Open)),
            el("button").id("dev2-toggle").class("dev2-launcher").attr("type", "button").attr("aria-pressed", self.diagnostics.to_string()).label("Toggle diagnostics").t("DEV2").on(Act::Dev(DevHit::Diagnostics)),
        ]
    }
    /// `room`: the frame's height in the panel's own (unscaled) pixels.
    pub fn view(&self, room: f32) -> Option<Node<Act>> {
        if !self.open { return None; }
        let s = &self.state;
        let button = |text: &str, hit: DevHit| el("button").attr("type", "button").t(text).on(Act::Dev(hit));
        let toggle = |text: &str, hit: DevHit, on: bool| el("button").attr("type", "button").attr("aria-pressed", on.to_string()).t(text).on(Act::Dev(hit));
        let value = |text: String| el("b").class("dev-value").t(text);
        let row = |label: &str, controls: Vec<Node<Act>>| el("div").class("dev-row").child(el("span").class("dev-label").t(label)).child(el("div").class("dev-controls").children(controls));
        let section = |title: &str, note: String, rows: Vec<Node<Act>>| {
            let mut head = el("h3").t(title);
            if !note.is_empty() { head.push(el("small").t(note)); }
            el("section").attr("data-dev", title.to_lowercase()).child(head).children(rows)
        };
        let run = section("Run", format!("seed {} · {} fps", s.seed, s.fps), vec![
            row("Clock", vec![toggle(if s.paused { "Play" } else { "Pause" }, DevHit::Pause, s.paused), button("Step", DevHit::Step).flag("disabled", !s.paused), button("Restart run", DevHit::Restart).class("dev-warn")]),
            row("Speed", SPEEDS.iter().map(|speed| toggle(&format!("{speed}x"), DevHit::Speed(*speed), s.speed == *speed)).collect()),
            row("Spotlight", SPOTLIGHTS.iter().enumerate().map(|(i, name)| toggle(name, DevHit::Spotlight(i), s.spotlight == i)).collect()),
        ]);
        let enemies = if s.enemy_names.is_empty() { format!("{} enemies", s.live_enemies) } else { format!("{} enemies · {}", s.live_enemies, s.enemy_names) };
        let stage = section("Stage", format!("boss {} · {enemies}", s.boss), vec![
            row("Chapter", vec![button("−", DevHit::Chapter(-1)).flag("disabled", s.chapter <= 1), value(s.chapter.to_string()), button("+", DevHit::Chapter(1))]),
            row("Wave", vec![button("−", DevHit::Wave(-1)).flag("disabled", s.wave <= 1), value(format!("{} / {}", s.wave, s.waves)), button("+", DevHit::Wave(1)).flag("disabled", s.wave >= s.waves),
                button("First", DevHit::WaveFirst), button("Last", DevHit::WaveLast), button("Boss", DevHit::Boss).class("dev-warn")]),
        ]);
        let members = s.party.iter().filter(|m| m.1).count();
        let party = section("Party", format!("{members} of {} fighting", s.party.len()), vec![
            row("Members", s.party.iter().enumerate().map(|(i, (name, on))| toggle(name, DevHit::Member(i), *on)).collect()),
            row("Level", vec![button("−10", DevHit::LevelStep(-10)), button("−1", DevHit::LevelStep(-1)), value(s.level.to_string()), button("+1", DevHit::LevelStep(1)), button("+10", DevHit::LevelStep(10))]),
            row("Presets", LEVEL_PRESETS.iter().map(|level| toggle(&format!("Lv {level}"), DevHit::Level(*level), s.level == *level)).collect()),
        ]);
        let economy = section("Economy", String::new(), vec![
            row("Gold", vec![value(count(s.gold)), button("+1K", DevHit::Gold(1_000)), button("+100K", DevHit::Gold(100_000))]),
            row("Essence", vec![value(count(s.essence)), button("+100", DevHit::Essence(100)), button("+1K", DevHit::Essence(1_000))]),
            row("Incense", vec![value(count(s.incense)), button("+100", DevHit::Incense(100)), button("+1K", DevHit::Incense(1_000))]),
            row("Orbs", vec![value(format!("{} on field", s.orbs)), button("Drop 10", DevHit::DropOrbs(10)), button("Clear", DevHit::ClearOrbs)]),
            row("Drop rate", DROP_RATES.iter().map(|rate| toggle(&format!("{rate}%"), DevHit::DropRate(*rate), s.drop_percent == *rate)).collect()),
            row("Bag", vec![value(format!("Lv {} · {} / {}", s.bag_level, s.bag_stored, s.bag_capacity)), button("Play Cascade Fill", DevHit::CascadeFill)]),
        ]);
        let view = section("View", String::new(), vec![
            row("Overlays", vec![toggle("Diagnostics", DevHit::Diagnostics, self.diagnostics), toggle("Pickup circles", DevHit::Circles, self.circles)]),
        ]);
        let saves = section("Saves", "Reset keeps a recovery snapshot".into(), vec![
            row("Game", vec![button("Reset game", DevHit::ResetGame).class("dev-warn"), button("Restore snapshot", DevHit::RestoreSnapshot).flag("disabled", !s.snapshot)]),
        ]);
        let mut panel = el("div").class("dev-panel").attr("role", "dialog").label("Dev Tools").style(format!("max-height:{:.0}px", (room - 24.).max(200.))).on(Act::Stay)
            .child(el("header").child(el("strong").t("Dev Tools")).child(button("Close", DevHit::Close).class("dev-close").label("Close Dev Tools")));
        if !self.status.is_empty() { panel.push(el("p").class("dev-status").attr("role", "status").t(self.status.as_str())); }
        Some(el("div").key("dev").id("dev-tools").on(Act::Dev(DevHit::Close)).child(panel.children([run, stage, party, economy, view, saves])))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn buttons(node: &Node<Act>) -> Vec<&Node<Act>> { let mut out = Vec::new(); node.all(&|n| n.tag == "button", &mut out); out }
    fn state() -> DevState {
        DevState { paused: false, speed: 2., spotlight: 2, seed: 77, fps: 60, chapter: 1, wave: 3, waves: 10, boss: "locked", live_enemies: 12, enemy_names: "Imp, Marid".into(),
            party: vec![("Fara".into(), true), ("Hondo".into(), true), ("Runa".into(), false), ("Kaja".into(), true)], level: 25, gold: 1234., essence: 40., incense: 10.,
            bag_stored: 12., bag_capacity: 20., bag_level: 2, orbs: 7, drop_percent: 10, snapshot: false }
    }
    #[test]
    fn launchers_are_mains_two_pills() {
        let dev = DevUi::default();
        let [first, second] = dev.launchers();
        assert_eq!((first.inner_text(), first.click.clone()), ("DEV".to_string(), Some(Act::Dev(DevHit::Open))));
        assert_eq!((second.inner_text(), second.click.clone(), second.get("id")), ("DEV2".to_string(), Some(Act::Dev(DevHit::Diagnostics)), Some("dev2-toggle")));
        assert!(dev.view(640.).is_none());
    }
    #[test]
    fn the_panel_shows_the_live_game_and_routes_every_control() {
        let mut dev = DevUi::default();
        dev.act(DevHit::Open);
        dev.state = state();
        let view = dev.view(640.).expect("panel");
        assert_eq!((view.get("id"), view.click.clone()), (Some("dev-tools"), Some(Act::Dev(DevHit::Close))), "the backdrop closes it");
        assert_eq!(view.kids[0].click, Some(Act::Stay), "a click on the panel stays");
        let by = |text: &str| *buttons(&view).iter().find(|b| b.inner_text() == text).unwrap_or_else(|| panic!("no button {text}"));
        assert_eq!(by("Close").click, Some(Act::Dev(DevHit::Close)));
        // Run
        assert_eq!((by("2x").get("aria-pressed"), by("0.25x").click.clone()), (Some("true"), Some(Act::Dev(DevHit::Speed(0.25)))));
        assert!(by("Step").get("disabled").is_some(), "Step needs a paused clock");
        assert_eq!((by("Default").get("aria-pressed"), by("Often").click.clone()), (Some("true"), Some(Act::Dev(DevHit::Spotlight(3)))));
        // Stage: the wave count comes from the game, not from the panel
        assert!(view.inner_text().contains("3 / 10") && view.inner_text().contains("boss locked · 12 enemies · Imp, Marid"));
        assert_eq!((by("Boss").click.clone(), by("Last").click.clone()), (Some(Act::Dev(DevHit::Boss)), Some(Act::Dev(DevHit::WaveLast))));
        // Party: one toggle per roster member, whatever the roster is
        assert_eq!(["Fara", "Hondo", "Runa", "Kaja"].map(|name| by(name).get("aria-pressed").unwrap().to_string()), ["true", "true", "false", "true"]);
        assert_eq!(by("Runa").click, Some(Act::Dev(DevHit::Member(2))));
        assert_eq!((by("Lv 25").get("aria-pressed"), by("+10").click.clone()), (Some("true"), Some(Act::Dev(DevHit::LevelStep(10)))));
        // Economy
        assert_eq!((by("+100K").click.clone(), by("Drop 10").click.clone(), by("10%").get("aria-pressed")), (Some(Act::Dev(DevHit::Gold(100_000))), Some(Act::Dev(DevHit::DropOrbs(10))), Some("true")));
        assert!(by("Restore snapshot").get("disabled").is_some());
        // Requests reach the frame loop once; Restart and the ceremony close the panel.
        dev.act(DevHit::Speed(4.));
        dev.act(DevHit::Circles);
        dev.act(DevHit::CascadeFill);
        assert_eq!(dev.take(), [DevHit::Speed(4.), DevHit::CascadeFill]);
        assert!(dev.take().is_empty() && !dev.open && dev.circles);
    }
    #[test]
    fn a_bigger_roster_gets_its_own_toggles() {
        let mut dev = DevUi { open: true, state: state(), ..Default::default() };
        dev.state.party.push(("Sixth".into(), false));
        let view = dev.view(640.).unwrap();
        assert_eq!(buttons(&view).iter().find(|b| b.inner_text() == "Sixth").unwrap().click, Some(Act::Dev(DevHit::Member(4))));
        assert!(view.inner_text().contains("3 of 5 fighting"));
    }
}
