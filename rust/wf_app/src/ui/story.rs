//! `storyEntryFlow.mjs` + `questLadderUI.mjs` + `renderStoryChapterMap` / `renderNarrativeScene`
//! (`renderNarrativeScene.js`) + `combatEntryTransition.mjs`: the Quests layout (`storyMock`).
//! Phases: map (Chapter 1 entry), ladder (quest cards), opening (the narrative scene), combat,
//! combat-paused (the pause gate over the map). The JS `defeat` phase and `victory()` card
//! completion are unreachable in the continuous-combat game and are not translated.
use super::chrome::{self, rgba, rounded_outline, Align, Hit, HitKind};
use super::dom::{el, Node};
use super::{css, Act, Screen};
use crate::assets::Assets;
use crate::camera::{HEIGHT, WIDTH};
use macroquad::prelude::*;
use wf_meta::narrative::{self as nar, Content, NarrativeState, Presentation, ShotKind};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Phase { Map, Ladder, Opening, Combat, CombatPaused }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Modal { Skip, CombatPause }
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Card { pub id: &'static str, pub title: &'static str, pub kind: &'static str, pub cost: f64, pub reward: f64, pub combat: bool, pub content: Content }
/// `entry.progress`: energy (Player_Energy), resources, completed card ids, revealed count.
#[derive(Clone, Debug, PartialEq)]
pub struct Progress { pub energy: f64, pub resources: f64, pub completed: Vec<&'static str>, pub revealed: usize }
pub const MAX_ENERGY: f64 = 200.;
/// `createCombatEntryTransition`: fade to black 250 ms, hold 500 ms, switch, fade in 1000 ms.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Transition { pub started_ms: f64, pub switched: bool }
impl Transition {
    pub fn alpha(&self, now_ms: f64) -> f32 {
        let t = now_ms - self.started_ms;
        if t < 250. { (t / 250.) as f32 } else if t < 750. { 1. } else { (1. - (t - 750.) / 1000.).max(0.) as f32 }
    }
    pub fn wants_switch(&self, now_ms: f64) -> bool { !self.switched && now_ms - self.started_ms >= 750. }
    pub fn done(&self, now_ms: f64) -> bool { now_ms - self.started_ms >= 1750. }
}
/// What the frame loop must do after a flow decision.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Request { None, DepartCombat(Screen), ResumeCombat, QuitCombat }
pub struct StoryFlow {
    pub phase: Phase,
    pub modal: Option<Modal>,
    pub combat_paused: bool,
    pub combat_unlocked: bool,
    pub active_card: Option<usize>,
    pub error: Option<String>,
    pub cards: Vec<Card>,
    pub progress: Progress,
    pub content: Content,
    pub narrative: NarrativeState,
    pub presentation: Presentation,
    saved_auto: bool,
    pub transition: Option<Transition>,
    /// The frame loop recreates the combat scene when the entry transition reaches its switch.
    pub fresh_combat_pending: bool,
}
impl Default for StoryFlow { fn default() -> Self { Self::new() } }
impl StoryFlow {
    pub fn new() -> Self {
        let cards = vec![
            Card { id: "warp-crossing", title: "Main Story 1", kind: "Story + combat", cost: 0., reward: 50., combat: true, content: Content::before_handoff() },
            Card { id: "after-the-crossing", title: "Main Story 2", kind: "Story", cost: 0., reward: 50., combat: false, content: Content::after_handoff() },
        ];
        Self { phase: Phase::Map, modal: None, combat_paused: false, combat_unlocked: false, active_card: None, error: None, content: cards[0].content, cards, progress: Progress { energy: MAX_ENERGY, resources: 150., completed: Vec::new(), revealed: 1 },
            narrative: NarrativeState::default(), presentation: Presentation::new(0.), saved_auto: false, transition: None, fresh_combat_pending: false }
    }
    pub fn pending(&self) -> bool { self.transition.is_some() }
    pub fn in_opening(&self) -> bool { self.phase == Phase::Opening }
    /// `go('combat', reason, { freshStart: true })` through the entry transition.
    fn enter_fresh_combat(&mut self, now_ms: f64) {
        self.phase = Phase::Combat;
        self.transition = Some(Transition { started_ms: now_ms, switched: false });
    }
    /// `startCombat('player-start')` from the map (START button or the town token).
    pub fn start_combat(&mut self, now_ms: f64) -> bool {
        if self.pending() { return false; }
        let card = self.cards[0];
        if !card.combat { return false; }
        if self.phase == Phase::Combat { return true; }
        self.active_card = Some(0);
        self.content = card.content;
        self.combat_unlocked = true;
        self.combat_paused = false;
        self.modal = None;
        self.error = None;
        self.enter_fresh_combat(now_ms);
        true
    }
    /// `startCard(index)` from the ladder.
    pub fn start_card(&mut self, index: usize, now_sec: f64) -> bool {
        if self.pending() || self.phase != Phase::Ladder || index >= self.progress.revealed || index >= self.cards.len() { return false; }
        let card = self.cards[index];
        if self.progress.energy < card.cost { self.error = Some("Not enough energy for this card.".into()); return false; }
        self.progress.energy -= card.cost;
        self.active_card = Some(index);
        self.content = card.content;
        self.combat_paused = false;
        self.phase = Phase::Opening;
        self.error = None;
        nar::restart(&mut self.narrative, &mut self.presentation, now_sec);
        true
    }
    fn complete(&mut self) {
        let Some(index) = self.active_card else { return };
        let card = self.cards[index];
        if !self.progress.completed.contains(&card.id) {
            self.progress.completed.push(card.id);
            self.progress.resources += card.reward;
            self.progress.revealed = self.progress.revealed.max((index + 2).min(self.cards.len()));
        }
        self.active_card = None;
        self.combat_unlocked = false;
        self.combat_paused = false;
        self.phase = Phase::Ladder;
        self.modal = None;
    }
    /// `finishStory()`: a combat card hands off to a fresh encounter; a story card completes.
    fn finish_story(&mut self, now_ms: f64) {
        let Some(index) = self.active_card else { return };
        if self.cards[index].combat { self.combat_unlocked = true; self.enter_fresh_combat(now_ms); } else { self.complete(); }
    }
    /// `update(nowSec)`: auto-advance and scene completion while the opening plays.
    pub fn update(&mut self, now_sec: f64, now_ms: f64) {
        if self.phase != Phase::Opening || self.pending() || self.modal.is_some() { return; }
        nar::update_auto(&mut self.narrative, &mut self.presentation, self.content, now_sec);
        if self.presentation.completed { self.finish_story(now_ms); }
    }
    pub fn request_skip(&mut self) -> bool {
        if self.phase != Phase::Opening || self.pending() || self.modal.is_some() { return false; }
        self.modal = Some(Modal::Skip);
        self.saved_auto = self.presentation.auto;
        self.presentation.auto = false;
        true
    }
    pub fn confirm_skip(&mut self, now_sec: f64, now_ms: f64) -> bool {
        if self.modal != Some(Modal::Skip) || self.pending() { return false; }
        self.modal = None;
        nar::skip(&mut self.narrative, &mut self.presentation, now_sec);
        self.finish_story(now_ms);
        true
    }
    pub fn cancel_skip(&mut self, now_sec: f64) {
        if self.modal != Some(Modal::Skip) { return; }
        self.modal = None;
        self.presentation.auto = self.saved_auto;
        self.presentation.page_started_at = now_sec;
    }
    /// `handlePointer(point)` on the opening scene (the map taps are hit zones).
    pub fn narrative_tap(&mut self, x: f64, y: f64, now_sec: f64, now_ms: f64) -> bool {
        if self.pending() || self.modal.is_some() || self.phase != Phase::Opening { return false; }
        if self.presentation.hit_zones.skip.is_some_and(|r| r.contains(x, y)) { return self.request_skip(); }
        nar::pointer(&mut self.narrative, &mut self.presentation, self.content, x, y, now_sec);
        self.update(now_sec, now_ms);
        true
    }
    /// `navigate(label)` for a nav tap while `from` is showing.
    pub fn navigate(&mut self, target: Screen, from: Screen) -> Request {
        if self.pending() || self.modal.is_some() || matches!(self.phase, Phase::Opening) { return Request::None; }
        if (self.phase == Phase::Combat || self.combat_paused) && target == Screen::Quests {
            // Coming back from another screen goes straight into the battle, like the Vault's
            // back-to-combat button (owner 2026-11-05, ORKA-63bf.35). The Battle paused choice
            // is skipped here, not removed: it still opens from the combat screen itself.
            if from != Screen::Combat {
                self.phase = Phase::Combat;
                self.combat_paused = false;
                return Request::ResumeCombat;
            }
            self.combat_paused = true;
            self.phase = Phase::CombatPaused;
            self.modal = Some(Modal::CombatPause);
            return Request::DepartCombat(Screen::Quests);
        }
        if target == Screen::Quests {
            if !self.combat_paused { self.phase = Phase::Map; }
            return if from == Screen::Combat { Request::DepartCombat(Screen::Quests) } else { Request::DepartCombat(Screen::Quests) };
        }
        if self.phase == Phase::Combat { self.combat_paused = true; }
        Request::DepartCombat(target)
    }
    /// The ladder's Back control (`nav:Map`).
    pub fn back_to_map(&mut self) {
        if self.pending() || self.modal.is_some() || self.phase == Phase::Opening { return; }
        if self.phase == Phase::Combat && !self.combat_paused { self.combat_paused = true; }
        self.phase = Phase::Map;
    }
    pub fn continue_paused_combat(&mut self) -> Request {
        if self.phase != Phase::CombatPaused || self.modal != Some(Modal::CombatPause) || self.pending() { return Request::None; }
        self.modal = None;
        self.phase = Phase::Combat;
        self.combat_paused = false;
        Request::ResumeCombat
    }
    pub fn quit_paused_combat(&mut self) -> Request {
        if self.phase != Phase::CombatPaused || self.modal != Some(Modal::CombatPause) || self.pending() { return Request::None; }
        self.phase = Phase::Map;
        self.modal = None;
        self.combat_paused = false;
        self.active_card = None;
        self.combat_unlocked = false;
        self.error = None;
        Request::QuitCombat
    }
    /// Entry transition bookkeeping: true when the frame loop must switch to a fresh combat scene now.
    pub fn transition_tick(&mut self, now_ms: f64) -> bool {
        let Some(mut t) = self.transition else { return false };
        let switch = t.wants_switch(now_ms);
        if switch { t.switched = true; }
        if t.done(now_ms) && t.switched { self.transition = None; } else { self.transition = Some(t); }
        switch
    }
    /// Developer scenario (`skip()` in storyEntryFlow): the map opens the quest ladder.
    pub fn dev_ladder(&mut self) { if self.phase == Phase::Map && !self.pending() && self.modal.is_none() { self.phase = Phase::Ladder; } }
    pub fn qa_direct_combat(&mut self) { self.active_card = Some(0); self.content = self.cards[0].content; self.combat_unlocked = true; self.phase = Phase::Combat; }

    // ------------------------------------------------------------------ page elements
    /// The Quests layout as page elements: the chapter map (`renderStoryChapterMap`, canvas on
    /// main, `css/quest_map.css`) and main's `#quest-ui` (`questLadderUI.mjs`, `css/quest.css`):
    /// wallet, quest ladder, and the skip / paused-battle dialogs. `on_quests` is the storyMock
    /// layout; the dialogs show on any layout like main's.
    pub fn view(&self, gold: f64, on_quests: bool) -> Vec<Node<Act>> {
        use HitKind as K;
        let mut out = Vec::new();
        let pending = self.pending();
        let button = |text: &str, class: &str, kind: K| el("button").class(class).flag("disabled", pending).t(text).on(Act::Hit(kind));
        if on_quests && self.phase != Phase::Opening {
            let is_map = self.phase == Phase::Map;
            let live = is_map && !self.combat_paused && !pending;
            let mut map = el("section").key("quest-map").id("quest-map").label("Chapter map")
                .child(el("img").class("bg").attr("src", css::asset("narrative/chapter-1-map.png")).attr("alt", "").attr("draggable", "false"))
                .child(el("button").class("town").attr("type", "button").label("Chapter 1 town").flag("disabled", !live).on(Act::Hit(K::StoryTown)).child(el("img").attr("src", css::asset("narrative/chapter-town-token.png")).attr("alt", "").attr("draggable", "false")))
                // drawPageBanner: gradient pennant with a 2px #e2c775 outline.
                .child(el("img").class("banner").attr("alt", "").attr("src", css::svg_uri("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"-2 -2 116 28\"><defs><linearGradient id=\"g\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#a88d50\"/><stop offset=\".5\" stop-color=\"#79643b\"/><stop offset=\"1\" stop-color=\"#54452d\"/></linearGradient></defs><path d=\"M0 0H100L112 12L100 24H0Z\" fill=\"url(#g)\" stroke=\"#e2c775\" stroke-width=\"2\" stroke-linejoin=\"round\"/></svg>")))
                .child(el("h1").class("heading").t("QUESTS"));
            if is_map {
                map.push(el("img").class("divider").attr("alt", "").attr("src", css::svg_uri("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"-2 -6 244 12\"><path d=\"M0 0H240\" stroke=\"#dbc17c\" stroke-width=\"1\"/><path d=\"M120 -4L124 0L120 4L116 0Z\" fill=\"#685536\" stroke=\"#dbc17c\" stroke-width=\"1\"/></svg>")));
                map.push(el("p").class("chapter").t("Chapter 1"));
                map.push(el("button").class("start").attr("type", "button").flag("disabled", !live).on(Act::Hit(K::StoryStart)).t("START"));
            }
            out.push(map);
        }
        let mut ui = el("div").key("quest-ui").id("quest-ui");
        if on_quests && matches!(self.phase, Phase::Map | Phase::Ladder) {
            // resourceStrip({gold, resources, energy})
            ui.push(el("div").class("quest-wallet").label("Resources")
                .child(el("span").class("balance").label(format!("Gold {gold}")).attr("title", "Gold").child(el("span").class("coin-symbol").attr("aria-hidden", "true").t("G")).t(super::model::format_number(gold)))
                .child(el("span").class("balance").label(format!("Resources {}", self.progress.resources)).child(el("span").class("resource-symbol").attr("aria-hidden", "true").t("◆")).t(format!("{}", self.progress.resources)))
                .child(el("span").class("balance").label(format!("Energy {} of 200", self.progress.energy)).child(el("span").class("energy-symbol").attr("aria-hidden", "true").t("ϟ")).t(format!("{}/200", self.progress.energy))));
        }
        if on_quests && self.phase == Phase::Ladder {
            let done = self.progress.completed.len();
            let mut cards = el("div").class("cards");
            for i in (0..self.progress.revealed.min(self.cards.len())).rev() {
                let c = &self.cards[i];
                let completed = self.progress.completed.contains(&c.id);
                let mut copy = el("span").class("card-copy").child(el("strong").t(c.title));
                if c.cost > 0. { copy.push(el("small").child(el("span").class("energy-symbol").attr("aria-hidden", "true").t("ϟ")).t(format!(" {}", c.cost))); }
                let mut reward = el("span").class(if completed { "reward claimed" } else { "reward " }).label(if completed { "Reward claimed".to_string() } else { format!("First clear +{}", c.reward) })
                    .child(el("span").class("resource-symbol").attr("aria-hidden", "true").t("◆"))
                    .child(el("span").class("quantity").t(format!("×{}", c.reward)));
                if completed { reward.push(el("b").attr("aria-hidden", "true").t("✓")); }
                cards.push(el("button").class("card").flag("disabled", pending).on(Act::Hit(K::StoryCard(i)))
                    .child(el("span").class("story-book").attr("aria-hidden", "true").child(el("img").attr("alt", "").attr("src", css::svg_uri("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\"><path d=\"M3 7Q12 4 19 10V34Q12 28 3 31ZM37 7Q28 4 21 10V34Q28 28 37 31Z\" fill=\"#967342\"/><path d=\"M1 10V34Q11 31 20 37Q29 31 39 34V10\" fill=\"none\" stroke=\"#967342\" stroke-width=\"2\"/></svg>"))))
                    .child(el("span").class("eyebrow").t(if completed { "Complete" } else { "New" }))
                    .child(copy)
                    .child(reward.child(el("small").t("1st Clear"))));
            }
            ui.push(el("section").class("screen").label("Quests")
                .child(el("header").class("chapter").child(el("h1").t("Chapter 1")).child(el("div").class("chapter-progress").child(el("progress").attr("value", done.to_string()).attr("max", self.cards.len().to_string()).label("Completed sub-chapters")).t(format!("{done}/{}", self.cards.len()))))
                .child(cards)
                .child(el("p").class("error").attr("role", "status").t(self.error.clone().unwrap_or_default()))
                .child(el("button").class("back").label("Back").flag("disabled", pending).on(Act::Hit(K::StoryBack)).child(el("img").attr("alt", "").attr("src", css::svg_uri("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 48 32\" width=\"34\" height=\"26\"><path d=\"M19 5 5 15l14 9v-6h12c9 0 9 9 0 9H18v4h14C50 31 49 11 32 11H19Z\" fill=\"#f6dc80\" stroke=\"#7b5826\" stroke-width=\"1.5\"/></svg>")))));
        }
        let dialog = |label: &str, title: &str, body: &str, secondary: (&str, K), primary: (&str, K)| el("div").class("shade").child(el("section").class("modal").attr("role", "dialog").attr("aria-modal", "true").label(label)
            .child(el("h2").t(title)).child(el("p").t(body))
            .child(el("div").class("actions").child(button(secondary.0, "", secondary.1)).child(button(primary.0, "primary", primary.1))));
        if self.modal == Some(Modal::Skip) { ui.push(dialog("Skip story", "Skip story?", "Are you sure you want to skip this story?", ("Cancel", K::SkipCancel), ("Skip", K::SkipConfirm))); }
        if self.phase == Phase::CombatPaused { ui.push(dialog("Paused battle", "Battle paused", "Your battle is saved at this moment. Continue when you are ready.", ("Quit Battle", K::PauseQuit), ("Continue Battle", K::PauseContinue))); }
        out.push(ui);
        out
    }
    /// The opening narrative stays a canvas scene (`renderNarrativeScene`).
    pub fn draw(&mut self, assets: &Assets, now_sec: f64, hits: &mut Vec<Hit>) {
        if self.phase == Phase::Opening { self.draw_opening(assets, now_sec, hits); }
    }
    /// `renderNarrativeScene`: background, cast or item, dialogue panel, cover, completion.
    fn draw_opening(&mut self, assets: &Assets, now_sec: f64, hits: &mut Vec<Hit>) {
        let model = nar::render_sync(&self.narrative, &mut self.presentation, self.content, now_sec);
        draw_rectangle(0., 0., WIDTH, HEIGHT, BLACK);
        if model.completed {
            let fade = model.completion_fade as f32;
            draw_rectangle(0., 0., WIDTH, HEIGHT, rgba(0x0b0d12, fade));
            let message = if self.presentation.completion_message.is_empty() { "End of Scene" } else { &self.presentation.completion_message };
            chrome::label(message, WIDTH / 2., HEIGHT * 0.43, 18., rgba(0xf4efe4, fade), Align::Center);
            let r = nar::restart_button();
            button(r, "Restart Scene", false, fade);
            hits.push(Hit { rect: Rect::new(0., 0., WIDTH, HEIGHT), kind: HitKind::NarrativeTap });
            return;
        }
        let Some(line) = model.line else { return };
        let tr = &model.transition;
        if line.shot.kind != ShotKind::Dark {
            warpfall_background(tr.background_alpha as f32);
            match line.shot.kind {
                ShotKind::Characters => {
                    let mut cast: Vec<(&str, &str, bool)> = line.shot.cast.iter().map(|(id, slot)| (*id, *slot, line.speaker.is_some_and(|s| s.id == *id))).collect();
                    cast.sort_by_key(|c| c.2);
                    for (id, slot, active) in cast {
                        let r = nar::slot_rect(slot);
                        let tint = if active { Color::new(1., 1., 1., tr.subject_alpha as f32) } else { Color::new(0.42, 0.42, 0.47, tr.subject_alpha as f32) };
                        match assets.ui.get(&format!("story-{id}")) {
                            Some(tex) => { let (dw, dh) = (tex.width() * 0.38, tex.height() * 0.38); draw_texture_ex(tex, r.x as f32 + (r.w as f32 - dw) / 2., (r.y + r.h) as f32 - dh, tint, DrawTextureParams { dest_size: Some(vec2(dw, dh)), ..Default::default() }); }
                            None => { draw_circle(r.x as f32 + r.w as f32 / 2., r.y as f32 + r.h as f32 * 0.3, r.w as f32 * 0.18, rgba(0x3f5360, tr.subject_alpha as f32)); draw_rectangle(r.x as f32 + r.w as f32 * 0.28, r.y as f32 + r.h as f32 * 0.44, r.w as f32 * 0.44, r.h as f32 * 0.5, rgba(0x3f5360, tr.subject_alpha as f32)); }
                        }
                    }
                }
                ShotKind::Item => { if let Some(item) = line.item { draw_item(item.visual, nar::item_rect(), tr.subject_alpha as f32); } }
                _ => {}
            }
        }
        if tr.dialogue_alpha > 0. {
            let a = tr.dialogue_alpha as f32;
            let p = nar::panel_rect();
            let (px, py, pw, ph) = (p.x as f32, p.y as f32, p.w as f32, p.h as f32);
            rounded_outline(px, py, pw, ph, 8., Color::new(0.06, 0.07, 0.09, 0.94 * a), rgba(0xf4efe4, 0.3 * a));
            if let Some(speaker) = line.speaker { chrome::label(speaker.name, px + 16., py + 29., 15., rgba(0xf4efe4, a), Align::Left); }
            button(nar::auto_button(), "Auto", self.presentation.auto, a);
            button(nar::skip_button(), "Skip", false, a);
            let max_w = pw - 32.;
            let mut size = 16.;
            let mut lines: Vec<String> = Vec::new();
            while size >= 13. { lines = wrap(&model.visible_text, max_w, size); if lines.len() <= 6 { break; } size -= 1.; }
            for (i, text) in lines.iter().enumerate() { chrome::label(text, px + 16., py + 67. - size * 0.35 + i as f32 * (size + 6.), size, rgba(0xf4efe4, a), Align::Left); }
            if model.fully_visible { let (gx, gy) = (px + pw - 31., py + ph - 25.); draw_triangle(vec2(gx, gy), vec2(gx + 10., gy), vec2(gx + 5., gy + 7.), rgba(0xf4efe4, 0.76 * a)); }
        }
        if tr.cover_alpha > 0. { draw_rectangle(0., 0., WIDTH, HEIGHT, Color::new(0., 0., 0., tr.cover_alpha as f32)); }
        hits.push(Hit { rect: Rect::new(0., 0., WIDTH, HEIGHT), kind: HitKind::NarrativeTap });
    }
}
/// The default font lacks the typographic apostrophe and ellipsis: draw ASCII stand-ins.
fn ascii(text: &str) -> String { text.replace('\u{2019}', "'").replace('\u{2018}', "'").replace('\u{201c}', "\"").replace('\u{201d}', "\"").replace('\u{2026}', "...") }
fn wrap(text: &str, width: f32, size: f32) -> Vec<String> {
    let text = ascii(text);
    let mut lines = Vec::new();
    let mut line = String::new();
    for word in text.split_whitespace() {
        let candidate = if line.is_empty() { word.to_string() } else { format!("{line} {word}") };
        if line.is_empty() || chrome::measure(&candidate, size) <= width { line = candidate; } else { lines.push(line); line = word.to_string(); }
    }
    if !line.is_empty() { lines.push(line); }
    lines
}
fn button(r: nar::Rect, label: &str, active: bool, alpha: f32) {
    let (x, y, w, h) = (r.x as f32, r.y as f32, r.w as f32, r.h as f32);
    rounded_outline(x, y, w, h, 6., if active { rgba(0xe6b74d, alpha) } else { Color::new(1., 1., 1., 0.12 * alpha) }, if active { rgba(0xfff0b5, alpha) } else { Color::new(1., 1., 1., 0.28 * alpha) });
    chrome::label(label, x + w / 2., y + h / 2. + 0.5, 12., if active { rgba(0x17171b, alpha) } else { rgba(0xf4efe4, alpha) }, Align::Center);
}
fn fill_under(points: &[(f32, f32)], bottom: f32, color: Color) {
    for pair in points.windows(2) {
        let (a, b) = (pair[0], pair[1]);
        draw_triangle(vec2(a.0, a.1), vec2(b.0, b.1), vec2(a.0, bottom), color);
        draw_triangle(vec2(b.0, b.1), vec2(b.0, bottom), vec2(a.0, bottom), color);
    }
}
fn quad(p0: (f32, f32), c: (f32, f32), p1: (f32, f32), steps: usize) -> Vec<(f32, f32)> {
    (0..=steps).map(|i| { let t = i as f32 / steps as f32; let u = 1. - t; (u * u * p0.0 + 2. * u * t * c.0 + t * t * p1.0, u * u * p0.1 + 2. * u * t * c.1 + t * t * p1.1) }).collect()
}
/// `drawWarpfallBackground`: sky bands, grey ridges, green hills, crystal shards, dark ground.
fn warpfall_background(alpha: f32) {
    let (w, h) = (WIDTH, HEIGHT);
    let mix = |a: u32, b: u32, t: f32| { let (ar, ag, ab) = ((a >> 16) as f32, (a >> 8 & 255) as f32, (a & 255) as f32); let (br, bg, bb) = ((b >> 16) as f32, (b >> 8 & 255) as f32, (b & 255) as f32); Color::new((ar + (br - ar) * t) / 255., (ag + (bg - ag) * t) / 255., (ab + (bb - ab) * t) / 255., alpha) };
    for i in 0..32 { let t = i as f32 / 32.; let c = if t < 0.52 { mix(0x14243a, 0x334153, t / 0.52) } else { mix(0x334153, 0x17211c, (t - 0.52) / 0.48) }; draw_rectangle(0., t * h, w, h / 32. + 1., c); }
    let ridge = rgba(0x657488, alpha);
    draw_rectangle(0., h * 0.44, w, h * 0.24, ridge);
    fill_under(&[(0., h * 0.42), (w * 0.18, h * 0.25), (w * 0.35, h * 0.43), (w * 0.55, h * 0.22), (w * 0.75, h * 0.44), (w, h * 0.29)], h * 0.45, ridge);
    let hills = rgba(0x24392f, alpha);
    let mut pts = quad((0., h * 0.56), (w * 0.24, h * 0.47), (w * 0.46, h * 0.61), 12);
    pts.extend(quad((w * 0.46, h * 0.61), (w * 0.72, h * 0.72), (w, h * 0.52), 12));
    fill_under(&pts, h, hills);
    for (x, y, color) in [(0.12, 0.17, 0x71d6d0), (0.84, 0.2, 0xe6b74d), (0.68, 0.34, 0xb48adb), (0.28, 0.31, 0xdf6d61)] {
        let (cx, cy) = (w * x, h * y);
        let c = rgba(color, 0.72 * alpha);
        draw_triangle(vec2(cx, cy - 16.), vec2(cx + 6., cy), vec2(cx - 5., cy + 1.), c);
        draw_triangle(vec2(cx + 6., cy), vec2(cx, cy + 18.), vec2(cx - 5., cy + 1.), c);
    }
    fill_under(&quad((0., h * 0.78), (w * 0.46, h * 0.7), (w, h * 0.8), 16), h, rgba(0x111817, alpha));
}
fn draw_orb(x: f32, y: f32, r: f32, color: u32, alpha: f32) {
    draw_circle(x, y, r * 1.6, rgba(color, 0.18 * alpha));
    draw_circle(x, y, r * 1.2, rgba(color, 0.45 * alpha));
    draw_circle(x, y, r, rgba(color, alpha));
    draw_circle(x - r * 0.3, y - r * 0.32, r * 0.2, Color::new(1., 1., 1., 0.78 * alpha));
}
/// `drawItem`: procedural orbs or the paper map in the item rectangle.
fn draw_item(visual: &str, r: nar::Rect, alpha: f32) {
    let (x, y, w, h) = (r.x as f32, r.y as f32, r.w as f32, r.h as f32);
    if visual == "procedural:paper-map" {
        let (mx, my, mw, mh) = (x + w * 0.08, y + h * 0.12, w * 0.84, h * 0.76);
        rounded_outline(mx, my, mw, mh, 5., rgba(0xe4d4a7, alpha), rgba(0x765f3c, alpha));
        draw_line(mx + mw * 0.34, my, mx + mw * 0.31, my + mh, 1., rgba(0x6f522d, 0.38 * alpha));
        draw_line(mx + mw * 0.68, my, mx + mw * 0.72, my + mh, 1., rgba(0x6f522d, 0.38 * alpha));
        let route = [(mx + 18., my + mh * 0.72), (mx + mw * 0.3, my + mh * 0.38), (mx + mw * 0.55, my + mh * 0.7), (mx + mw - 18., my + mh * 0.28)];
        for pair in route.windows(2) { draw_line(pair[0].0, pair[0].1, pair[1].0, pair[1].1, 4., rgba(0x4e775f, alpha)); }
        draw_circle(mx + mw * 0.69, my + mh * 0.51, 6., rgba(0xb54d43, alpha));
        return;
    }
    let colors = if visual == "procedural:red-orbs" { [0xdc4b4b, 0xef6660, 0xb9293e, 0xff7b62] } else { [0xdc4b4b, 0x58b7d8, 0xe0b23f, 0x62ba73] };
    for (i, (ox, oy)) in [(0.22, 0.56), (0.42, 0.37), (0.62, 0.58), (0.79, 0.36)].iter().enumerate() { draw_orb(x + w * ox, y + h * oy, 24., colors[i], alpha); }
}

#[cfg(test)]
mod tests {
    use super::*;
    /// Owner 2026-11-05 (ORKA-63bf.35): re-entry only.
    #[test]
    fn the_quests_button_re_enters_a_left_battle_directly_and_first_entry_is_unchanged() {
        // No battle yet: Quests shows the map, as before.
        let mut flow = StoryFlow::new();
        assert_eq!(flow.navigate(Screen::Quests, Screen::Hero), Request::DepartCombat(Screen::Quests));
        assert_eq!((flow.phase, flow.modal, flow.combat_paused), (Phase::Map, None, false));
        // A battle is running; the player leaves it for the Hero screen, then the Vault.
        for other in [Screen::Hero, Screen::Vault] {
            let mut flow = StoryFlow::new();
            flow.qa_direct_combat();
            assert_eq!(flow.navigate(other, Screen::Combat), Request::DepartCombat(other));
            assert!(flow.combat_paused);
            // Quests goes straight back in: no Battle paused choice.
            assert_eq!(flow.navigate(Screen::Quests, other), Request::ResumeCombat);
            assert_eq!((flow.phase, flow.modal, flow.combat_paused), (Phase::Combat, None, false));
            // And again after a second trip away.
            assert_eq!(flow.navigate(other, Screen::Combat), Request::DepartCombat(other));
            assert_eq!(flow.navigate(Screen::Quests, other), Request::ResumeCombat);
        }
        // The choice is kept: Quests pressed on the combat screen itself still opens it.
        let mut flow = StoryFlow::new();
        flow.qa_direct_combat();
        assert_eq!(flow.navigate(Screen::Quests, Screen::Combat), Request::DepartCombat(Screen::Quests));
        assert_eq!((flow.phase, flow.modal), (Phase::CombatPaused, Some(Modal::CombatPause)));
        assert_eq!(flow.navigate(Screen::Hero, Screen::Quests), Request::None, "the choice must be answered first");
        assert_eq!(flow.continue_paused_combat(), Request::ResumeCombat);
        assert_eq!((flow.phase, flow.modal, flow.combat_paused), (Phase::Combat, None, false));
        assert_eq!(flow.navigate(Screen::Quests, Screen::Combat), Request::DepartCombat(Screen::Quests));
        assert_eq!(flow.quit_paused_combat(), Request::QuitCombat);
        assert_eq!((flow.phase, flow.modal, flow.combat_paused), (Phase::Map, None, false));
    }
}
