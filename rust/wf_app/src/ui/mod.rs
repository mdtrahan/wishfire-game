//! Combat chrome and meta screens in the 360x640 frame, translated from the JS DOM/canvas
//! overlays: `renderCombatBossControl.mjs` (progress HUD, Summon Boss), `renderBossBattleHud.mjs`,
//! `heroCooldownStrip.mjs` + `src/core/buffSignalRules.mjs`, `renderExistingNavigation.mjs`.
//! Placement and purpose match the JS; pixels are placeholder-grade.
pub mod chrome;
pub mod lamp;
pub mod model;
pub mod screens;
use crate::assets::Assets;
use crate::game::Game;
use macroquad::prelude::*;
pub use model::CombatModel;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Screen { Combat, Hero, Vault, PowerUp, Quests }
impl Screen {
    pub fn nav_label(self) -> &'static str { match self { Screen::Combat | Screen::Quests => "Quests", Screen::Hero => "Hero", Screen::Vault => "Vault", Screen::PowerUp => "Power Up" } }
}
/// What the frame loop must do after a tap.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum UiAction { None, SummonBoss }
#[derive(Clone, Debug, PartialEq)]
pub enum Panel { BossInfo, HeroSpecial(&'static str), PartySkill(&'static str) }
/// `showRewardReceipt`: (title, resource, amount, hero name, hide-at ms).
pub struct Toast { pub title: String, pub resource: String, pub amount: f64, pub hero_name: String, pub until: f64 }
pub struct Ui {
    pub screen: Screen,
    pub panel: Option<Panel>,
    pub model: CombatModel,
    pub lamp: lamp::LampUi,
    pub hero: screens::HeroUi,
    pub training: screens::TrainingUi,
    pub vault: screens::VaultUi,
    pub toast: Option<Toast>,
    hits: Vec<chrome::Hit>,
}
impl Ui {
    pub fn new() -> Self { Self { screen: Screen::Combat, panel: None, model: CombatModel::default(), lamp: lamp::LampUi::default(), hero: screens::HeroUi::default(), training: screens::TrainingUi::default(), vault: screens::VaultUi::default(), toast: None, hits: Vec::new() } }
    fn now_ms() -> f64 { macroquad::time::get_time() * 1000. }
    fn show_receipt(&mut self, title: &str, receipt: &wf_meta::progression::Receipt, ms: f64) {
        self.toast = Some(Toast { title: title.into(), resource: receipt.resource.clone(), amount: receipt.amount, hero_name: receipt.hero_name.clone().unwrap_or_default(), until: Self::now_ms() + ms });
    }
    /// `claimObjectiveWithReceipt`.
    fn claim(&mut self, game: &mut Game) {
        let id = self.model.quest.claim_id.clone();
        if id.is_empty() { return; }
        let result = game.claim_objective(&id);
        if let (true, Some(receipt)) = (result.ok, result.receipt.as_ref()) { self.show_receipt("Reward Obtained", receipt, 1500.); }
    }
    pub fn in_combat(&self) -> bool { self.screen == Screen::Combat }
    /// Hero and party-skill panels pause combat (JS navigates to the Hero screen / opens the
    /// Training Ground modal); the boss stats popover does not.
    pub fn pauses(&self) -> bool { matches!(self.panel, Some(Panel::HeroSpecial(_)) | Some(Panel::PartySkill(_))) || self.lamp.modal_open() }
    /// `isBagProgressBlocked`: any dialog blocks Bag progress time.
    pub fn blocks_bag_progress(&self) -> bool { self.panel.is_some() || self.lamp.modal_open() }
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
        use chrome::HitKind as K;
        let roster_len = screens::roster(game).len().max(1);
        let hero_key = |ui: &Ui| screens::roster(game).get(screens::hero_index(&ui.hero, roster_len)).map(|h| (h.hero_instance_key.clone(), h.definition().name));
        Some(match hit {
            K::Nav(screen) => { if screen != self.screen { self.screen = screen; } UiAction::None }
            K::Summon => UiAction::SummonBoss,
            K::Inspect => { self.panel = Some(Panel::BossInfo); UiAction::None }
            K::Hero(key) => { self.panel = Some(Panel::HeroSpecial(key)); UiAction::None }
            K::Party(id) => { self.panel = Some(Panel::PartySkill(id)); UiAction::None }
            K::Continue | K::VaultBack => { self.screen = Screen::Combat; UiAction::None }
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
                    self.hero.ticket_notice = if result.ok { format!("{name} reached level {}.", result.level) } else { match result.reason { Some("insufficient_tickets") => format!("Need {} {name} tickets.", model::format_number(result.cost)), Some("max_level") => "This hero is at the current level cap.".into(), _ => "Ticket spend could not be saved.".into() } };
                }
                UiAction::None
            }
            K::StarOpen => { self.hero.sheet = true; self.hero.sheet_notice.clear(); UiAction::None }
            K::SheetClose => { self.hero.sheet = false; self.hero.sheet_notice.clear(); UiAction::None }
            K::StarUp => {
                if let Some((id, name)) = hero_key(self) {
                    let result = game.star_up(&id);
                    self.hero.sheet_notice = if result.ok { format!("{name} reached *{}.", result.stars) } else { match result.reason { Some("insufficient_tickets") => "Not enough tickets yet.".into(), Some("max_stars") => "All stars earned.".into(), _ => "The change could not be saved.".into() } };
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
        })
    }
    /// Combat chrome over the arena frame.
    pub fn draw_combat(&mut self, assets: &Assets, game: &mut Game) {
        self.hits.clear();
        chrome::draw(assets, &self.model, self.panel.as_ref(), &mut self.hits);
        self.lamp.draw_strip(assets, game, &mut self.hits);
        chrome::nav(assets, self.screen, &mut self.hits);
        if let Some(panel) = &self.panel { chrome::panel(assets, panel, &self.model, &mut self.hits); }
        self.lamp.draw_modal(assets, game, &mut self.hits);
        if let Some(t) = &self.toast { chrome::toast(assets, &t.title, &t.resource, t.amount, &t.hero_name); }
    }
    /// A meta screen (combat paused underneath).
    pub fn draw_screen(&mut self, assets: &Assets, game: &Game) {
        self.hits.clear();
        screens::draw(assets, self.screen, game, &mut self.hero, &self.training, &self.vault, &mut self.hits);
        chrome::nav(assets, self.screen, &mut self.hits);
        if self.toast.as_ref().is_some_and(|t| t.until <= Self::now_ms()) { self.toast = None; }
        if let Some(t) = &self.toast { chrome::toast(assets, &t.title, &t.resource, t.amount, &t.hero_name); }
    }
}
