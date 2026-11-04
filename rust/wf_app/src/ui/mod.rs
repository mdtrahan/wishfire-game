//! Combat chrome and meta screens in the 360x640 frame, translated from the JS DOM/canvas
//! overlays: `renderCombatBossControl.mjs` (progress HUD, Summon Boss), `renderBossBattleHud.mjs`,
//! `heroCooldownStrip.mjs` + `src/core/buffSignalRules.mjs`, `renderExistingNavigation.mjs`.
//! Placement and purpose match the JS; pixels are placeholder-grade.
pub mod chrome;
pub mod model;
pub mod screens;
use crate::assets::Assets;
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
pub struct Ui {
    pub screen: Screen,
    pub panel: Option<Panel>,
    pub model: CombatModel,
    hits: Vec<chrome::Hit>,
}
impl Ui {
    pub fn new() -> Self { Self { screen: Screen::Combat, panel: None, model: CombatModel::default(), hits: Vec::new() } }
    pub fn in_combat(&self) -> bool { self.screen == Screen::Combat }
    /// Hero and party-skill panels pause combat (JS navigates to the Hero screen / opens the
    /// Training Ground modal); the boss stats popover does not.
    pub fn pauses(&self) -> bool { matches!(self.panel, Some(Panel::HeroSpecial(_)) | Some(Panel::PartySkill(_))) }
    /// Refresh the frame model from the live session (combat screen only).
    pub fn update(&mut self, session: &wf_host::session::Session, snapshot: &wf_combat::Snapshot) {
        self.model = CombatModel::build(session, snapshot, &self.model);
        if matches!(self.panel, Some(Panel::BossInfo)) && self.model.boss.is_none() { self.panel = None; }
    }
    /// Routes a tap. Returns `None` when the chrome did not own it (the debug controls may).
    pub fn tap(&mut self, p: Vec2) -> Option<UiAction> {
        if self.panel.is_some() {
            // Any tap outside the panel dismisses it; the inspect button toggles.
            let hit = self.hits.iter().find(|h| h.rect.contains(p)).map(|h| h.kind);
            if hit != Some(chrome::HitKind::PanelBody) { self.panel = None; }
            return Some(UiAction::None);
        }
        let hit = self.hits.iter().find(|h| h.rect.contains(p)).map(|h| h.kind)?;
        Some(match hit {
            chrome::HitKind::Nav(screen) => { if screen != self.screen { self.screen = screen; } UiAction::None }
            chrome::HitKind::Summon => UiAction::SummonBoss,
            chrome::HitKind::Inspect => { self.panel = Some(Panel::BossInfo); UiAction::None }
            chrome::HitKind::Hero(key) => { self.panel = Some(Panel::HeroSpecial(key)); UiAction::None }
            chrome::HitKind::Party(id) => { self.panel = Some(Panel::PartySkill(id)); UiAction::None }
            chrome::HitKind::Continue => { self.screen = Screen::Combat; UiAction::None }
            chrome::HitKind::PanelBody => UiAction::None,
        })
    }
    /// Combat chrome over the arena frame.
    pub fn draw_combat(&mut self, assets: &Assets) {
        self.hits.clear();
        chrome::draw(assets, &self.model, self.panel.as_ref(), &mut self.hits);
        chrome::nav(assets, self.screen, &mut self.hits);
        if let Some(panel) = &self.panel { chrome::panel(assets, panel, &self.model, &mut self.hits); }
    }
    /// A meta screen (combat paused underneath).
    pub fn draw_screen(&mut self, assets: &Assets, session: &wf_host::session::Session) {
        self.hits.clear();
        screens::draw(assets, self.screen, session, &self.model, &mut self.hits);
        chrome::nav(assets, self.screen, &mut self.hits);
    }
}
