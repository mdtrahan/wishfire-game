//! Main's developer launchers as page elements: the DEV pill opens the Dev Tooling Modal
//! (`devToolingRuntime.js`), the DEV2 pill shows the diagnostics (`index.html` `#dev2-toggle`;
//! here the Rust diagnostics overlay). They replace the slice's canvas menu. The modal carries
//! the controls this build has: Restart, the Progression QA presets (RESET GAME, LV 1/5/25/100)
//! and the combat clock (pause, step, speed, Skill Spotlight preset). Main's number and select
//! fields (boss chapter, hero and enemy slots, gold, orientation) are not here: the element
//! bridge reports clicks only.
use super::dom::{el, Node};
use super::Act;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum DevHit { Open, Close, Diagnostics, Restart, ResetGame, Level(u32), Speed(u8), Pause, Step, Spotlight }
/// What the modal shows of the frame loop's state (set by the frame loop each frame).
#[derive(Clone, Debug, Default, PartialEq)]
pub struct DevState { pub paused: bool, pub speed: u8, pub spotlight: &'static str, pub diagnostics: bool }
#[derive(Default)]
pub struct DevUi {
    pub open: bool,
    /// The Progression QA status line.
    pub status: String,
    pub state: DevState,
    requests: Vec<DevHit>,
}
pub const LEVEL_PRESETS: [u32; 4] = [1, 5, 25, 100];
impl DevUi {
    /// A click: the modal opens and closes here; everything else is for the frame loop.
    pub fn act(&mut self, hit: DevHit) {
        match hit {
            DevHit::Open => { self.open = true; self.status.clear(); }
            DevHit::Close => self.open = false,
            // Main closes the modal before it restarts.
            DevHit::Restart => { self.open = false; self.requests.push(hit); }
            other => self.requests.push(other),
        }
    }
    pub fn take(&mut self) -> Vec<DevHit> { std::mem::take(&mut self.requests) }
    /// The two pills at the frame's top right, on every screen.
    pub fn launchers(&self) -> [Node<Act>; 2] {
        [
            el("button").class("dev-launcher").attr("type", "button").label("Open developer tooling modal").t("DEV").on(Act::Dev(DevHit::Open)),
            el("button").id("dev2-toggle").class("dev2-launcher").attr("type", "button").attr("aria-pressed", self.state.diagnostics.to_string()).label("Toggle diagnostics").t("DEV2").on(Act::Dev(DevHit::Diagnostics)),
        ]
    }
    pub fn view(&self) -> Option<Node<Act>> {
        if !self.open { return None; }
        let button = |text: &str, hit: DevHit| el("button").attr("type", "button").t(text).on(Act::Dev(hit));
        let pressed = |node: Node<Act>, on: bool| node.attr("aria-pressed", on.to_string());
        let mut presets = el("div").child(button("RESET GAME", DevHit::ResetGame).attr("data-devtool-level", "RESET GAME"));
        for level in LEVEL_PRESETS { presets.push(button(&format!("LV {level}"), DevHit::Level(level)).attr("data-devtool-level", level.to_string())); }
        let status = if self.status.is_empty() { "Level presets save real stats and unlocks. Reset saves a recovery snapshot." } else { self.status.as_str() };
        let mut clock = el("div")
            .child(pressed(button(if self.state.paused { "Play" } else { "Pause" }, DevHit::Pause), self.state.paused))
            .child(button("Step", DevHit::Step).flag("disabled", !self.state.paused));
        for speed in [1u8, 2, 4] { clock.push(pressed(button(&format!("{speed}x"), DevHit::Speed(speed)), self.state.speed == speed)); }
        clock.push(button(self.state.spotlight, DevHit::Spotlight));
        let panel = el("div").class("dev-panel").on(Act::Stay)
            .child(el("div").class("dev-head")
                .child(el("div").child(el("div").class("dev-title").attr("data-devtool-title", "").t("Dev Tooling Modal")))
                .child(button("Close", DevHit::Close).class("dev-close").attr("data-devtool-close", "")))
            .child(el("div").class("dev-row").attr("data-devtool-button-row", "")
                .child(button("Restart", DevHit::Restart).class("dev-restart").attr("data-devtool-restart", "")))
            .child(el("fieldset").attr("data-devtool-progression", "")
                .child(el("legend").t("Developer only · Progression QA"))
                .child(presets)
                .child(el("small").attr("data-devtool-progression-status", "").attr("role", "status").t(status)))
            .child(el("fieldset")
                .child(el("legend").t("Combat clock"))
                .child(clock)
                .child(el("small").t("Keys: P pause · N step · 1 2 4 speed · R restart · B boss · S spotlight · D diagnostics")));
        Some(el("div").key("dev").id("orka-dev-tooling-modal").on(Act::Dev(DevHit::Close)).child(panel))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn buttons(node: &Node<Act>) -> Vec<&Node<Act>> { let mut out = Vec::new(); node.all(&|n| n.tag == "button", &mut out); out }
    #[test]
    fn launchers_are_mains_two_pills_and_the_modal_routes_every_button() {
        let mut dev = DevUi::default();
        let [first, second] = dev.launchers();
        assert_eq!((first.inner_text(), first.click.clone()), ("DEV".to_string(), Some(Act::Dev(DevHit::Open))));
        assert_eq!((second.inner_text(), second.click.clone(), second.get("id")), ("DEV2".to_string(), Some(Act::Dev(DevHit::Diagnostics)), Some("dev2-toggle")));
        assert!(dev.view().is_none());
        dev.act(DevHit::Open);
        dev.state = DevState { paused: false, speed: 2, spotlight: "Spot: Def", diagnostics: false };
        let view = dev.view().expect("modal");
        assert_eq!(view.get("id"), Some("orka-dev-tooling-modal"));
        assert_eq!(view.click, Some(Act::Dev(DevHit::Close)), "the backdrop closes it");
        assert_eq!(view.kids[0].click, Some(Act::Stay), "a click on the panel stays");
        let labels: Vec<String> = buttons(&view).iter().map(|b| b.inner_text()).collect();
        assert_eq!(labels, ["Close", "Restart", "RESET GAME", "LV 1", "LV 5", "LV 25", "LV 100", "Pause", "Step", "1x", "2x", "4x", "Spot: Def"]);
        let by = |text: &str| *buttons(&view).iter().find(|b| b.inner_text() == text).unwrap();
        assert_eq!(by("LV 25").click, Some(Act::Dev(DevHit::Level(25))));
        assert_eq!(by("2x").get("aria-pressed"), Some("true"));
        assert!(by("Step").get("disabled").is_some(), "Step needs a paused clock");
        // Requests reach the frame loop once; Restart closes the modal like main.
        dev.act(DevHit::Speed(4));
        dev.act(DevHit::Restart);
        assert_eq!(dev.take(), [DevHit::Speed(4), DevHit::Restart]);
        assert!(dev.take().is_empty() && !dev.open);
    }
}
