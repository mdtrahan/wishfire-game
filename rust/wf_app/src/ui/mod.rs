//! Combat chrome and meta screens in the 360x640 frame, translated from the JS DOM/canvas
//! overlays: `renderCombatBossControl.mjs` (progress HUD, Summon Boss), `renderBossBattleHud.mjs`,
//! `heroCooldownStrip.mjs` + `src/core/buffSignalRules.mjs`, `renderExistingNavigation.mjs`.
//! Placement and purpose match the JS; pixels are placeholder-grade.
pub mod chrome;
pub mod css;
pub mod dev;
pub mod dom;
pub mod lamp;
pub mod model;
pub mod orbs;
pub mod screens;
pub mod story;
pub mod text;
use self::dom::{el, Node};
use crate::assets::Assets;
use crate::game::Game;
use macroquad::prelude::*;
pub use model::CombatModel;
fn platform_now() -> f64 { crate::platform::now_ms() }

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Screen { Combat, Hero, Vault, Quests }
impl Screen {
    pub fn nav_label(self) -> &'static str { match self { Screen::Combat | Screen::Quests => "Quests", Screen::Hero => "Hero", Screen::Vault => "Vault" } }
}
/// What a page element does when clicked: a chrome action, a lamp window action, or nothing
/// (`Stay` keeps a click on a panel from reaching the backdrop behind it).
#[derive(Clone, Debug, PartialEq)]
pub enum Act { Hit(chrome::HitKind), Lamp(lamp::LampHit), Dev(dev::DevHit), Stay }
/// What the frame loop must do after a tap.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum UiAction { None, SummonBoss }
#[derive(Clone, Debug, PartialEq)]
pub enum Panel { BossInfo }
/// `showRewardReceipt`: (title, resource, amount, hero name, hide-at ms).
pub struct Toast { pub title: String, pub resource: String, pub amount: f64, pub hero_name: String, pub until: f64, pub duration_ms: f64,
    /// Alternates per receipt so each one is a fresh element (its fade and fanfare restart).
    pub flip: bool }
pub struct Ui {
    pub screen: Screen,
    pub panel: Option<Panel>,
    pub model: CombatModel,
    pub lamp: lamp::LampUi,
    pub hero: screens::HeroUi,
    pub training: screens::TrainingUi,
    pub vault: screens::VaultUi,
    pub story: story::StoryFlow,
    pub toast: Option<Toast>,
    pub dev: dev::DevUi,
    hits: Vec<chrome::Hit>,
    dom: dom::Dom<Act>,
}
impl Ui {
    pub fn new() -> Self { Self { screen: Screen::Combat, panel: None, model: CombatModel::default(), lamp: lamp::LampUi::default(), hero: screens::HeroUi::default(), training: screens::TrainingUi::default(), vault: screens::VaultUi::default(), story: story::StoryFlow::default(), toast: None, dev: dev::DevUi::default(), hits: Vec::new(), dom: dom::Dom::new() } }
    /// A fresh menu state over the same page elements (RESET GAME, a restored snapshot). The
    /// page layer must survive: a new `Dom` would leave the old elements on the page, dead.
    pub fn reset(&mut self) {
        let dom = std::mem::take(&mut self.dom);
        let mut old = std::mem::replace(self, Self::new());
        self.lamp.orbs.adopt_art(&mut old.lamp.orbs);
        self.dom = dom;
    }
    /// Boot lands on the Quests map (`activateInitialLayout('storyMock')`).
    pub fn boot(&mut self, qa_direct_combat: bool) { if qa_direct_combat { self.story.qa_direct_combat(); self.screen = Screen::Combat; } else { self.screen = Screen::Quests; } }
    fn now_ms() -> f64 { macroquad::time::get_time() * 1000. }
    fn show_receipt(&mut self, title: &str, receipt: &wf_meta::progression::Receipt, ms: f64) {
        let flip = !self.toast.as_ref().is_some_and(|t| t.flip);
        self.toast = Some(Toast { title: title.into(), resource: receipt.resource.clone(), amount: receipt.amount, hero_name: receipt.hero_name.clone().unwrap_or_default(), until: Self::now_ms() + ms, duration_ms: ms, flip });
    }
    /// `claimObjectiveWithReceipt`.
    fn claim(&mut self, game: &mut Game) {
        let id = self.model.quest.claim_id.clone();
        if id.is_empty() { return; }
        let result = game.claim_objective(&id);
        if let (true, Some(receipt)) = (result.ok, result.receipt.as_ref()) { self.show_receipt("Reward Obtained", receipt, 1500.); }
    }
    pub fn in_combat(&self) -> bool { self.screen == Screen::Combat }
    /// The Growth dialog, the lamp windows and the Dev Tooling Modal pause combat; the boss stats
    /// popover does not.
    pub fn pauses(&self) -> bool { self.training.open || self.lamp.modal_open() || self.dev.open }
    /// `isBagProgressBlocked`: any dialog blocks Bag progress time.
    pub fn blocks_bag_progress(&self) -> bool { self.panel.is_some() || self.training.open || self.lamp.modal_open() || self.dev.open }
    /// Refresh the frame model from the live session (combat screen only).
    pub fn update(&mut self, game: &Game, snapshot: &wf_combat::Snapshot) {
        self.model = CombatModel::build(&game.session, snapshot, &self.model);
        self.model.quest = model::quest_view(game);
        if self.toast.as_ref().is_some_and(|t| t.until <= Self::now_ms()) { self.toast = None; }
        if matches!(self.panel, Some(Panel::BossInfo)) && self.model.boss.is_none() { self.panel = None; }
    }
    /// Routes a tap. Returns `None` when the chrome did not own it (the debug controls may).
    pub fn tap(&mut self, p: Vec2, game: &mut Game) -> Option<UiAction> {
        if self.lamp.modal_open() { self.lamp.tap(p, game); return Some(UiAction::None); }
        if self.panel.is_some() {
            // Any tap outside the panel dismisses it; the inspect button toggles.
            let hit = self.hits.iter().rev().find(|h| h.rect.contains(p)).map(|h| h.kind);
            if hit != Some(chrome::HitKind::PanelBody) { self.panel = None; }
            return Some(UiAction::None);
        }
        if self.screen == Screen::Combat && self.lamp.tap(p, game) { return Some(UiAction::None); }
        let hit = self.hits.iter().rev().find(|h| h.rect.contains(p)).map(|h| h.kind)?;
        Some(self.perform(hit, p, game))
    }
    /// Clicks on page elements since the last frame, applied in order.
    pub fn web_clicks(&mut self, game: &mut Game) -> Option<UiAction> {
        let mut result = None;
        for act in self.dom.take_clicks() {
            match act {
                Act::Hit(kind) => { let action = self.perform(kind, Vec2::ZERO, game); if result.is_none() || action != UiAction::None { result = Some(action); } }
                Act::Lamp(kind) => { self.lamp.act(kind, game); result.get_or_insert(UiAction::None); }
                Act::Dev(kind) => { self.dev.act(kind); result.get_or_insert(UiAction::None); }
                Act::Stay => { result.get_or_insert(UiAction::None); }
            }
        }
        result
    }
    /// Forget the page clicks since the last frame (an input-locked ceremony is playing).
    pub fn drop_clicks(&mut self) { let _ = self.dom.take_clicks(); }
    /// One chrome action (from a canvas hit zone or a page element).
    fn perform(&mut self, hit: chrome::HitKind, p: Vec2, game: &mut Game) -> UiAction {
        use chrome::HitKind as K;
        let now_ms = platform_now();
        let now_sec = now_ms / 1000.;
        if self.story.pending() { return UiAction::None; }
        if self.story.modal.is_some() {
            match hit {
                K::SkipCancel => self.story.cancel_skip(now_sec),
                K::SkipConfirm => { self.story.confirm_skip(now_sec, now_ms); }
                K::PauseContinue => { if self.story.continue_paused_combat() == story::Request::ResumeCombat { self.screen = Screen::Combat; } }
                K::PauseQuit => { if self.story.quit_paused_combat() == story::Request::QuitCombat { let _ = game.session.surrender_for_departure(); game.session.dispose(); } }
                _ => {}
            }
            return UiAction::None;
        }
        match hit {
            K::Nav(screen) => {
                let from = self.screen;
                if screen == from { return UiAction::None; }
                match self.story.navigate(screen, from) {
                    story::Request::DepartCombat(target) => { if from == Screen::Combat { if let Err(e) = game.session.surrender_for_departure() { self.model.host_error = Some(e); } } self.screen = target; }
                    _ => {}
                }
                return UiAction::None;
            }
            K::StoryStart | K::StoryTown => { self.story.start_combat(now_ms); return UiAction::None; }
            K::StoryCard(i) => { self.story.start_card(i, now_sec); return UiAction::None; }
            K::StoryBack => { self.story.back_to_map(); return UiAction::None; }
            K::NarrativeTap => { self.story.narrative_tap(p.x as f64, p.y as f64, now_sec, now_ms); return UiAction::None; }
            _ => {}
        }
        let roster_len = screens::roster(game).len().max(1);
        let hero_key = |ui: &Ui| screens::roster(game).get(screens::hero_index(&ui.hero, roster_len)).map(|h| (h.hero_instance_key.clone(), h.definition().name));
        match hit {
            K::Summon => UiAction::SummonBoss,
            K::Inspect => { self.panel = Some(Panel::BossInfo); UiAction::None }
            // A hero clock opens that hero's Special on the Hero screen (`focusHeroSpecial`).
            K::Hero(key) => {
                if let Some(index) = screens::roster(game).iter().position(|h| h.definition().key == key) { self.hero.focus_special(index); return self.perform(K::Nav(Screen::Hero), p, game); }
                UiAction::None
            }
            // A party icon opens its Party Skills entry in the Growth dialog.
            K::Party(id) => { self.training.open = true; self.training.tab = 1; self.training.focus = wf_meta::hero::PARTY_SKILLS.iter().find(|s| s.id == id || s.skill_id == id).map(|s| s.id); UiAction::None }
            K::Growth => { self.training.open = true; self.training.tab = 0; self.training.focus = None; UiAction::None }
            K::TgClose => { self.training.open = false; UiAction::None }
            K::VaultBack => { if self.story.continue_paused_combat() == story::Request::ResumeCombat || self.story.phase == story::Phase::Combat { self.screen = Screen::Combat; } UiAction::None }
            K::PanelBody => UiAction::None,
            K::Claim => { self.claim(game); UiAction::None }
            K::HeroPrev => { self.hero.index = (screens::hero_index(&self.hero, roster_len) + roster_len - 1) % roster_len; UiAction::None }
            K::HeroNext => { self.hero.index = (screens::hero_index(&self.hero, roster_len) + 1) % roster_len; UiAction::None }
            K::Roster(i) => { self.hero.index = i % roster_len; UiAction::None }
            K::SkillPrev => { self.hero.skill = (self.hero.skill + 4) % 5; UiAction::None }
            K::SkillNext => { self.hero.skill = (self.hero.skill + 1) % 5; UiAction::None }
            K::HeroTab(tab) => { self.hero.tab = tab; self.hero.sheet = false; UiAction::None }
            K::GearSlot(slot) => { self.hero.gear_slot = slot; UiAction::None }
            K::LevelUp => {
                if let Some((id, name)) = hero_key(self) {
                    let result = game.spend_level_up(&id);
                    self.hero.ticket_notice = if result.ok { format!("{name} reached level {}.", result.level) } else { match result.reason { Some("insufficient_tickets") => format!("Need {} {name} tickets.", result.cost), Some("max_level") => "This hero is at the current level cap.".into(), _ => "Ticket spend could not be saved.".into() } };
                }
                UiAction::None
            }
            K::StarOpen => { self.hero.sheet = true; self.hero.sheet_notice.clear(); UiAction::None }
            K::SheetClose => { self.hero.sheet = false; self.hero.sheet_notice.clear(); UiAction::None }
            K::StarUp => {
                if let Some((id, name)) = hero_key(self) {
                    let result = game.star_up(&id);
                    self.hero.sheet_notice = if result.ok { format!("{name} reached ★{}.", result.stars) } else { match result.reason { Some("insufficient_tickets") => "Not enough tickets yet.".into(), Some("max_stars") => "All stars earned.".into(), _ => "The change could not be saved.".into() } };
                }
                UiAction::None
            }
            K::TgTab(tab) => { self.training.tab = tab; UiAction::None }
            K::Train(stat) => {
                let result = game.train(stat);
                self.training.status = if result.ok { format!("{stat} training increased.") } else if result.reason == Some("insufficient_incense") { "Not enough Incense.".into() } else { "Training is at its current limit.".into() };
                UiAction::None
            }
            K::VaultTab(tab) => { self.vault.tab = tab; UiAction::None }
            K::Nav(_) | K::StoryStart | K::StoryTown | K::StoryCard(_) | K::StoryBack | K::NarrativeTap | K::SkipCancel | K::SkipConfirm | K::PauseQuit | K::PauseContinue => UiAction::None,
        }
    }
    /// The page elements for this frame: the stage at the frame rectangle, the nav, the entry
    /// fade and the open menu. Called once per frame after input and state updates.
    pub fn web(&mut self, game: &mut Game) {
        let (scale, offset) = crate::camera::Portrait::frame();
        // --cs: main's control scale for the developer pills and panel (never above 1).
        let mut stage: Node<Act> = el("div").id("wf-ui").style(format!("left:{:.2}px;top:{:.2}px;width:{:.2}px;height:{:.2}px;--s:{:.4};--cs:{:.4}", offset.x, offset.y, crate::camera::WIDTH * scale, crate::camera::HEIGHT * scale, scale, scale.min(1.)))
            .child(el("style").t(css::sheet()))
            .child(self.nav_view());
        let fade = self.story.transition.map_or(0., |t| t.alpha(platform_now()));
        stage.push(el("div").id("wf-fade").flag("hidden", fade <= 0.).style(format!("opacity:{fade:.3}")));
        match self.screen {
            Screen::Hero => { if let Some(view) = screens::hero_view(game, &mut self.hero) { stage.push(view); } }
            Screen::Vault => stage.push(screens::vault_view(&self.vault)),
            Screen::Combat | Screen::Quests => {}
        }
        stage.kids.extend(self.story.view(game.session.gold_total, self.screen == Screen::Quests));
        if let Some(view) = self.lamp.view(game, scale) { stage.push(view); }
        if let Some(t) = &self.toast { if let Some(view) = receipt_view(if t.flip { "receipt-a" } else { "receipt-b" }, &t.title, &t.resource, t.amount, &t.hero_name, t.duration_ms, scale) { stage.push(view); } }
        if self.training.open { stage.push(screens::training_view(game, &self.training, (macroquad::window::screen_width(), macroquad::window::screen_height()))); }
        // Last, so nothing before them shifts when a menu opens: the developer pills and modal.
        stage.kids.extend(self.dev.launchers());
        if let Some(view) = self.dev.view(crate::camera::HEIGHT * scale / scale.min(1.)) { stage.push(view); }
        // Over everything while the Bag progress ceremony plays, so nothing under it reacts.
        if self.lamp.locks_input() { stage.push(el("div").key("lock").id("wf-input-lock").on(Act::Stay)); }
        self.dom.render(vec![stage]);
    }
    /// `renderExistingNavigation`: DAILY / HERO / QUESTS / VAULT / POWER UP.
    fn nav_view(&self) -> Node<Act> {
        let hidden = self.story.in_opening();
        let inert = hidden || self.story.pending() || self.story.modal.is_some();
        let active = self.screen.nav_label();
        use chrome::HitKind as K;
        let items: [(&str, &str, &str, Option<K>); 5] = [("DAILY", "Daily", "daily", None), ("HERO", "Hero", "hero", Some(K::Nav(Screen::Hero))), ("QUESTS", "Quests", "quests", Some(K::Nav(Screen::Quests))), ("VAULT", "Vault", "vault", Some(K::Nav(Screen::Vault))), ("POWER UP", "Power Up", "power-up", Some(K::Growth))];
        // Hero details fills the stage at z-index 30; the nav rises above it only there.
        let mut nav = el("nav").id("game-meta-nav").label("Game navigation").flag("hidden", hidden).flag("inert", inert).style(format!("z-index:{}", if self.screen == Screen::Hero { 32 } else { 19 }));
        for (text, label, asset, target) in items {
            let mut button = el("button").attr("type", "button").flag("disabled", inert || target.is_none())
                .child(el("img").attr("src", css::asset(&format!("images/navigation/{asset}.png"))).attr("alt", "").attr("draggable", "false"))
                .child(el("span").t(text));
            if label == active { button = button.attr("aria-current", "page"); }
            if target.is_none() { button = button.attr("title", format!("{text} is not available yet")); }
            if let Some(kind) = target { button = button.on(Act::Hit(kind)); }
            nav.push(button);
        }
        nav
    }
    /// Combat chrome over the arena frame.
    pub fn draw_combat(&mut self, assets: &Assets, game: &mut Game) {
        self.hits.clear();
        chrome::draw(assets, &self.model, self.panel.as_ref(), &mut self.hits);
        self.lamp.draw_bag(assets, game, &mut self.hits);
        if let Some(panel) = &self.panel { chrome::panel(assets, panel, &self.model, &mut self.hits); }
    }
    /// A meta screen (combat paused underneath).
    pub fn draw_screen(&mut self, assets: &Assets) {
        self.hits.clear();
        if self.screen == Screen::Quests {
            let now = platform_now();
            self.story.update(now / 1000., now);
            self.story.draw(assets, now / 1000., &mut self.hits);
            return;
        }
        if self.toast.as_ref().is_some_and(|t| t.until <= Self::now_ms()) { self.toast = None; }
    }
}

/// `showRewardReceipt` (`rewardReceiptUI.mjs`, `css/receipt.css`): the banner across the frame
/// with the reward icon, its amount and the star fanfare around the icon.
fn receipt_view(key: &'static str, title: &str, resource: &str, amount: f64, hero_name: &str, duration_ms: f64, scale: f32) -> Option<Node<Act>> {
    let label = match resource { "incense" => "Incense".to_string(), "essence" => "Essence".to_string(), "hero_ticket" if !hero_name.is_empty() => format!("{hero_name} Hero tickets"), "hero_ticket" => "Hero tickets".to_string(), _ => return None };
    let amount = amount.floor().max(0.);
    let em = (18. * scale).max(12.);
    let (icon, icon_w, icon_h, icon_top) = if resource == "hero_ticket" {
        let quadrant = match hero_name { "Hondo" => "100% 0%", "Kaja" => "0% 100%", "Runa" => "100% 100%", _ => "0% 0%" };
        (el("span").class("lamp-reward-ticket-art").attr("aria-hidden", "true").style(format!("background-position:{quadrant}")), 3. * em, 2. * em, 0.5 * em)
    } else {
        (el("img").attr("src", css::asset(if resource == "incense" { "images/progression/incense.png" } else { "images/lamp/essence-orb.png" })).attr("alt", label.as_str()), 3. * em, 3. * em, 0.)
    };
    // showFanfare: twelve particles sweep out from the icon; offsets scale with the icon box.
    const PARTICLES: [(&str, f32, f32, f32, f32, f32, u32); 12] = [
        ("star", -0.66, -0.24, -0.98, -0.82, 12., 780), ("star", -0.25, -0.66, -0.48, -1.05, 10., 840), ("star", 0.22, -0.66, 0.55, -1.04, 14., 900), ("star", 0.66, -0.24, 0.98, -0.78, 11., 800),
        ("star", 0.66, 0.08, 1.04, -0.32, 13., 880), ("star", 0.62, 0.50, 0.98, 0.12, 10., 820), ("star", -0.66, 0.08, -0.98, -0.34, 11., 860), ("star", -0.62, 0.50, -0.96, 0.14, 10., 760),
        ("speck", -0.42, -0.68, -0.74, -1.06, 4., 790), ("speck", 0.40, -0.68, 0.78, -1.08, 5., 870), ("speck", -0.68, 0.26, -1.04, -0.04, 4., 830), ("speck", 0.68, 0.28, 1.05, -0.06, 5., 890),
    ];
    let size_scale = (icon_w / 48.).clamp(0.85, 1.25);
    let mut fanfare = el("span").class("reward-fanfare").attr("aria-hidden", "true").style(format!("left:{:.2}px;top:{:.2}px", (3.5 * em + 2.) / 2., 1. + icon_top + icon_h / 2.));
    for (kind, sx, sy, ex, ey, size, duration) in PARTICLES {
        let (x, y) = ((ex - sx) * icon_w * 1.15, (ey - sy) * icon_h * 1.15);
        fanfare.push(el("i").class(format!("reward-fanfare-particle reward-fanfare-{kind}")).attr("aria-hidden", "true").style(format!(
            "--fanfare-start-x:{:.2}px;--fanfare-start-y:{:.2}px;--fanfare-x:{x:.2}px;--fanfare-y:{y:.2}px;--fanfare-mid-x:{:.2}px;--fanfare-mid-y:{:.2}px;--fanfare-size:{:.2}px;--fanfare-duration:{duration}ms",
            sx * icon_w * 1.15, sy * icon_h * 1.15, x * 0.82, y * 0.82, size * size_scale)));
    }
    Some(el("section").key(key).class("lamp-reward-banner").attr("role", "status").label(format!("{title}: {amount} {label}")).attr("aria-live", "polite").style(format!("--reward-duration:{duration_ms}ms"))
        .child(el("strong").t(title))
        .child(el("div").child(icon).child(el("b").t(model::format_number(amount))).child(fanfare)))
}

#[cfg(test)]
mod tests {
    use super::chrome::HitKind as K;
    use super::*;
    fn buttons(node: &Node<Act>) -> Vec<&Node<Act>> { let mut out = Vec::new(); node.all(&|n| n.tag == "button", &mut out); out }
    fn by_text<'a>(node: &'a Node<Act>, text: &str) -> &'a Node<Act> { buttons(node).into_iter().find(|b| b.inner_text() == text).unwrap_or_else(|| panic!("no button {text}")) }
    #[test]
    fn nav_is_mains_five_buttons_and_power_up_opens_growth() {
        let mut ui = Ui::new();
        ui.boot(false);
        let nav = ui.nav_view();
        assert_eq!(nav.get("id"), Some("game-meta-nav"));
        assert_eq!(buttons(&nav).iter().map(|b| b.inner_text()).collect::<Vec<_>>(), ["DAILY", "HERO", "QUESTS", "VAULT", "POWER UP"]);
        assert!(by_text(&nav, "DAILY").get("disabled").is_some() && by_text(&nav, "DAILY").click.is_none());
        assert_eq!(by_text(&nav, "QUESTS").get("aria-current"), Some("page"));
        assert_eq!(by_text(&nav, "HERO").click, Some(Act::Hit(K::Nav(Screen::Hero))));
        assert_eq!(by_text(&nav, "POWER UP").click, Some(Act::Hit(K::Growth)));
        // The Hero screen fills the stage at z-index 30; the nav rises above it only there.
        ui.screen = Screen::Hero;
        assert_eq!(ui.nav_view().get("style"), Some("z-index:32"));
    }
    #[test]
    fn nav_hides_in_the_opening_and_goes_inert_under_a_dialog() {
        let mut ui = Ui::new();
        ui.boot(false);
        ui.story.dev_ladder();
        assert!(ui.story.start_card(0, 0.));
        assert!(ui.nav_view().get("hidden").is_some());
        assert!(ui.story.request_skip());
        let nav = ui.nav_view();
        assert!(nav.get("inert").is_some() && buttons(&nav).iter().all(|b| b.get("disabled").is_some()));
    }
    #[test]
    fn quests_layout_is_map_then_ladder_then_dialogs() {
        let mut ui = Ui::new();
        ui.boot(false);
        let view = ui.story.view(1234., true);
        let map = view.iter().find(|n| n.get("id") == Some("quest-map")).expect("map");
        assert_eq!(by_text(map, "START").click, Some(Act::Hit(K::StoryStart)));
        let quest = view.iter().find(|n| n.get("id") == Some("quest-ui")).unwrap();
        assert_eq!(quest.find(&|n| n.has_class("quest-wallet")).unwrap().inner_text(), "G1,234◆150ϟ200/200");
        ui.story.dev_ladder();
        let view = ui.story.view(0., true);
        let quest = view.iter().find(|n| n.get("id") == Some("quest-ui")).unwrap();
        let card = quest.find(&|n| n.has_class("card")).expect("card");
        assert_eq!(card.click, Some(Act::Hit(K::StoryCard(0))));
        assert_eq!(card.find(&|n| n.tag == "strong").unwrap().inner_text(), "Main Story 1");
        assert!(view.iter().find(|n| n.get("id") == Some("quest-map")).unwrap().find(&|n| n.has_class("start")).is_none());
        // The skip dialog shows over the canvas narrative on any layout.
        assert!(ui.story.start_card(0, 0.) && ui.story.request_skip());
        let view = ui.story.view(0., true);
        assert!(view.iter().all(|n| n.get("id") != Some("quest-map")));
        let quest = view.iter().find(|n| n.get("id") == Some("quest-ui")).unwrap();
        assert_eq!(by_text(quest, "Cancel").click, Some(Act::Hit(K::SkipCancel)));
        assert_eq!(by_text(quest, "Skip").click, Some(Act::Hit(K::SkipConfirm)));
        assert!(by_text(quest, "Skip").has_class("primary"));
    }
    #[test]
    fn vault_and_receipt_views_carry_their_state() {
        let vault = screens::vault_view(&screens::VaultUi { tab: 2 });
        assert_eq!(by_text(&vault, "Epic").get("aria-pressed"), Some("true"));
        assert_eq!(by_text(&vault, "Rare").click, Some(Act::Hit(K::VaultTab(1))));
        assert_eq!(by_text(&vault, "Back To Combat").click, Some(Act::Hit(K::VaultBack)));
        assert!(vault.inner_text().contains("Pet Core x1"));
        let receipt = receipt_view("receipt-a", "Reward Obtained", "hero_ticket", 12.9, "Runa", 1500., 1.).unwrap();
        assert_eq!(receipt.get("aria-label"), Some("Reward Obtained: 12 Runa Hero tickets"));
        assert_eq!(receipt.find(&|n| n.has_class("lamp-reward-ticket-art")).unwrap().get("style"), Some("background-position:100% 100%"));
        assert_eq!(receipt.find(&|n| n.tag == "b").unwrap().inner_text(), "12");
        let mut particles = Vec::new();
        receipt.all(&|n| n.has_class("reward-fanfare-particle"), &mut particles);
        assert_eq!(particles.len(), 12);
        assert!(receipt_view("receipt-a", "Reward Obtained", "gold", 5., "", 1500., 1.).is_none());
    }
}
