//! Combat chrome and meta screens in the 360x640 frame, translated from the JS DOM/canvas
//! overlays: `renderCombatBossControl.mjs` (progress HUD, Summon Boss), `renderBossBattleHud.mjs`,
//! `heroCooldownStrip.mjs` + `src/core/buffSignalRules.mjs`, `renderExistingNavigation.mjs`.
//! Placement and purpose match the JS; pixels are placeholder-grade.
pub mod chrome;
pub mod lamp;
pub mod model;
pub mod screens;
pub mod story;
use crate::assets::Assets;
use crate::game::Game;
use macroquad::prelude::*;
pub use model::CombatModel;
fn platform_now() -> f64 { crate::platform::now_ms() }

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
    pub story: story::StoryFlow,
    pub toast: Option<Toast>,
    hits: Vec<chrome::Hit>,
}
impl Ui {
    pub fn new() -> Self { Self { screen: Screen::Combat, panel: None, model: CombatModel::default(), lamp: lamp::LampUi::default(), hero: screens::HeroUi::default(), training: screens::TrainingUi::default(), vault: screens::VaultUi::default(), story: story::StoryFlow::default(), toast: None, hits: Vec::new() } }
    /// Boot lands on the Quests map (`activateInitialLayout('storyMock')`).
    pub fn boot(&mut self, qa_direct_combat: bool) { if qa_direct_combat { self.story.qa_direct_combat(); self.screen = Screen::Combat; } else { self.screen = Screen::Quests; } }
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
        let now_ms = platform_now();
        let now_sec = now_ms / 1000.;
        if self.story.pending() { return Some(UiAction::None); }
        if self.story.modal.is_some() {
            match hit {
                K::SkipCancel => self.story.cancel_skip(now_sec),
                K::SkipConfirm => { self.story.confirm_skip(now_sec, now_ms); }
                K::PauseContinue => { if self.story.continue_paused_combat() == story::Request::ResumeCombat { self.screen = Screen::Combat; } }
                K::PauseQuit => { if self.story.quit_paused_combat() == story::Request::QuitCombat { let _ = game.session.surrender_for_departure(); game.session.dispose(); } }
                _ => {}
            }
            return Some(UiAction::None);
        }
        match hit {
            K::Nav(screen) => {
                let from = self.screen;
                if screen == from { return Some(UiAction::None); }
                match self.story.navigate(screen, from) {
                    story::Request::DepartCombat(target) => { if from == Screen::Combat { if let Err(e) = game.session.surrender_for_departure() { self.model.host_error = Some(e); } } self.screen = target; }
                    _ => {}
                }
                return Some(UiAction::None);
            }
            K::StoryStart | K::StoryTown => { self.story.start_combat(now_ms); return Some(UiAction::None); }
            K::StoryCard(i) => { self.story.start_card(i, now_sec); return Some(UiAction::None); }
            K::StoryBack => { self.story.back_to_map(); return Some(UiAction::None); }
            K::NarrativeTap => { self.story.narrative_tap(p.x as f64, p.y as f64, now_sec, now_ms); return Some(UiAction::None); }
            K::HeroClose => { self.story.open_ladder(); self.screen = Screen::Quests; return Some(UiAction::None); }
            _ => {}
        }
        let roster_len = screens::roster(game).len().max(1);
        let hero_key = |ui: &Ui| screens::roster(game).get(screens::hero_index(&ui.hero, roster_len)).map(|h| (h.hero_instance_key.clone(), h.definition().name));
        Some(match hit {
            K::Summon => UiAction::SummonBoss,
            K::Inspect => { self.panel = Some(Panel::BossInfo); UiAction::None }
            K::Hero(key) => { self.panel = Some(Panel::HeroSpecial(key)); UiAction::None }
            K::Party(id) => { self.panel = Some(Panel::PartySkill(id)); UiAction::None }
            K::Continue | K::VaultBack => { if self.story.continue_paused_combat() == story::Request::ResumeCombat || self.story.phase == story::Phase::Combat { self.screen = Screen::Combat; } UiAction::None }
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
            K::Nav(_) | K::StoryStart | K::StoryTown | K::StoryCard(_) | K::StoryBack | K::NarrativeTap | K::SkipCancel | K::SkipConfirm | K::PauseQuit | K::PauseContinue | K::HeroClose => UiAction::None,
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
        self.story.draw_transition(platform_now());
    }
    /// A meta screen (combat paused underneath).
    pub fn draw_screen(&mut self, assets: &Assets, game: &Game) {
        self.hits.clear();
        if self.screen == Screen::Quests {
            let now = platform_now();
            self.story.update(now / 1000., now);
            self.story.draw(assets, game.session.gold_total, now / 1000., &mut self.hits);
            if !self.story.in_opening() { chrome::nav(assets, self.screen, &mut self.hits); }
            self.story.draw_transition(now);
            return;
        }
        screens::draw(assets, self.screen, game, &mut self.hero, &self.training, &self.vault, &mut self.hits);
        chrome::nav(assets, self.screen, &mut self.hits);
        if self.toast.as_ref().is_some_and(|t| t.until <= Self::now_ms()) { self.toast = None; }
        if let Some(t) = &self.toast { chrome::toast(assets, &t.title, &t.resource, t.amount, &t.hero_name); }
    }
}
