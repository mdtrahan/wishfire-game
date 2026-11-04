//! `storyEntryFlow.mjs` + `questLadderUI.mjs` + `renderStoryChapterMap` / `renderNarrativeScene`
//! (`renderNarrativeScene.js`) + `combatEntryTransition.mjs`: the Quests layout (`storyMock`).
//! Phases: map (Chapter 1 entry), ladder (quest cards), opening (the narrative scene), combat,
//! combat-paused (the pause gate over the map). The JS `defeat` phase and `victory()` card
//! completion are unreachable in the continuous-combat game and are not translated.
use super::chrome::{self, rgb, rgba, rounded, rounded_outline, Align, Hit, HitKind};
use super::Screen;
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
    /// The hero screen's close control sends the player to the quest ladder.
    pub fn open_ladder(&mut self) { if !self.pending() && self.modal.is_none() && self.phase != Phase::Opening { self.phase = Phase::Ladder; } }
    /// Entry transition bookkeeping: true when the frame loop must switch to a fresh combat scene now.
    pub fn transition_tick(&mut self, now_ms: f64) -> bool {
        let Some(mut t) = self.transition else { return false };
        let switch = t.wants_switch(now_ms);
        if switch { t.switched = true; }
        if t.done(now_ms) && t.switched { self.transition = None; } else { self.transition = Some(t); }
        switch
    }
    pub fn draw_transition(&self, now_ms: f64) {
        if let Some(t) = &self.transition { let a = t.alpha(now_ms); if a > 0. { draw_rectangle(0., 0., WIDTH, HEIGHT, Color::new(0., 0., 0., a)); } }
    }
    /// Developer scenario (`skip()` in storyEntryFlow): the map opens the quest ladder.
    pub fn dev_ladder(&mut self) { if self.phase == Phase::Map && !self.pending() && self.modal.is_none() { self.phase = Phase::Ladder; } }
    pub fn qa_direct_combat(&mut self) { self.active_card = Some(0); self.content = self.cards[0].content; self.combat_unlocked = true; self.phase = Phase::Combat; }

    // ------------------------------------------------------------------ drawing
    pub fn draw(&mut self, assets: &Assets, gold: f64, now_sec: f64, hits: &mut Vec<Hit>) {
        match self.phase {
            Phase::Opening => self.draw_opening(assets, now_sec, hits),
            _ => {
                self.draw_map(assets, hits);
                if matches!(self.phase, Phase::Map | Phase::Ladder) { resource_strip(gold, &self.progress); }
                if self.phase == Phase::Ladder { self.draw_ladder(hits); }
            }
        }
        match self.modal {
            Some(Modal::Skip) => modal("Skip story?", "Are you sure you want to skip this story?", ("Cancel", HitKind::SkipCancel, false), ("Skip", HitKind::SkipConfirm, true), hits),
            Some(Modal::CombatPause) => modal("Battle paused", "Your battle is saved at this moment. Continue when you are ready.", ("Quit Battle", HitKind::PauseQuit, false), ("Continue Battle", HitKind::PauseContinue, true), hits),
            None => {}
        }
    }
    /// `renderStoryChapterMap`: CHAPTER_ONE_MAP overlays in the 360x640 frame.
    fn draw_map(&self, assets: &Assets, hits: &mut Vec<Hit>) {
        draw_rectangle(0., 0., WIDTH, HEIGHT, rgb(0x243d3c));
        let is_map = self.phase == Phase::Map;
        match assets.ui.get("story-map") {
            Some(tex) => draw_texture_ex(tex, 0., 0., WHITE, DrawTextureParams { dest_size: Some(vec2(WIDTH, HEIGHT)), ..Default::default() }),
            None => { chrome::label("Loading map...", 180., 320., 16., WHITE, Align::Center); return; }
        }
        if let Some(tex) = assets.ui.get("story-token") { draw_texture_ex(tex, 115., 270., WHITE, DrawTextureParams { dest_size: Some(vec2(139., 129.)), ..Default::default() }); }
        page_banner("QUESTS", 0., 48., 112., 24.);
        if is_map {
            draw_line(64.5, 236., 304.5, 236., 1., rgb(0xdbc17c));
            let c = 184.5;
            for (a, b) in [((c, 232.), (c + 4., 236.)), ((c + 4., 236.), (c, 240.)), ((c, 240.), (c - 4., 236.)), ((c - 4., 236.), (c, 232.))] { draw_line(a.0, a.1, b.0, b.1, 1., rgb(0xdbc17c)); }
            draw_triangle(vec2(c, 232.), vec2(c + 4., 236.), vec2(c - 4., 236.), rgb(0x685536));
            draw_triangle(vec2(c, 240.), vec2(c + 4., 236.), vec2(c - 4., 236.), rgb(0x685536));
            chrome::stroked("Chapter 1", 184.5, 254., 17., rgb(0xfff0b9), rgb(0x514021), Align::Center);
            let (x, y, w, h) = (111.4, 405., 146.2, 44.);
            rounded(x - 3., y - 3., w + 6., h + 6., 8., rgb(0x514021));
            rounded(x - 1.5, y - 1.5, w + 3., h + 3., 6., rgb(0xe2c775));
            for i in 0..3 { let col = [0x747cff, 0x4546bc, 0x242164][i]; rounded(x, y + i as f32 * h / 3., w, h / 3. + 1., if i == 1 { 0. } else { 5. }, rgb(col)); }
            chrome::stroked("START", x + w / 2., y + h / 2. + 1., 22., WHITE, rgb(0x242146), Align::Center);
            if !self.combat_paused {
                hits.push(Hit { rect: Rect::new(115., 270., 139., 129.), kind: HitKind::StoryTown });
                hits.push(Hit { rect: Rect::new(x, y, w, h), kind: HitKind::StoryStart });
            }
        }
    }
    /// `questLadderUI` ladder screen (HTML over the map).
    fn draw_ladder(&self, hits: &mut Vec<Hit>) {
        let (sx, sy, sw, bottom) = (20., 92., 320., HEIGHT - 78.);
        rounded_outline(sx, sy, sw, 140., 4., rgb(0xefddb5), rgb(0xcfb16a));
        chrome::label("Chapter 1", sx + sw / 2., sy + 24., 18., rgb(0x513e26), Align::Center);
        let (bw, bx, by) = (sw * 0.9, sx + sw * 0.05, sy + 140. - 12. - 24.);
        draw_rectangle(bx, by, bw, 8., rgb(0xe3d7bc));
        let done = self.progress.completed.len();
        if done > 0 { draw_rectangle(bx, by, bw * done as f32 / self.cards.len() as f32, 8., rgb(0xd8ab35)); }
        chrome::label(&format!("{done}/{}", self.cards.len()), sx + sw / 2., by + 18., 11., rgb(0x48371e), Align::Center);
        let mut y = sy + 140. + 12.;
        for i in (0..self.progress.revealed.min(self.cards.len())).rev() {
            let c = &self.cards[i];
            let completed = self.progress.completed.contains(&c.id);
            rounded_outline(sx, y, sw, 56., 4., rgb(0xf3e6c8), rgb(0xc6ab65));
            rounded(sx + 8., y + 6., 44., 44., 3., rgb(0xdeca9f));
            draw_rectangle(sx + 15., y + 14., 13., 26., rgb(0x967342)); draw_rectangle(sx + 32., y + 14., 13., 26., rgb(0x967342)); draw_rectangle_lines(sx + 13., y + 12., 34., 30., 2., rgb(0x967342));
            chrome::stroked(if completed { "COMPLETE" } else { "NEW" }, sx + 2., y - 2., 9., rgb(0xfff0af), rgb(0x4c381b), Align::Left);
            chrome::label(c.title, sx + 64., y + 28., 15., rgb(0x513e26), Align::Left);
            let (rx, ry) = (sx + sw - 8. - 44., y + 6.);
            rounded_outline(rx, ry, 44., 44., 3., if completed { rgb(0xaba596) } else { rgb(0xefe5cc) }, rgb(0xa18a5e));
            diamond(rx + 22., ry + 12., 8., rgb(0xef76ba));
            chrome::label(&format!("x{}", c.reward), rx + 22., ry + 26., 10., rgb(0x463717), Align::Center);
            rounded_outline(rx + 2., ry + 35., 40., 11., 2., rgb(0xefd181), rgb(0x9f8045));
            chrome::label("1st Clear", rx + 22., ry + 40.5, 8., rgb(0x463717), Align::Center);
            if completed { chrome::label("v", rx + 36., ry + 12., 20., rgb(0xd52224), Align::Center); }
            hits.push(Hit { rect: Rect::new(sx, y, sw, 56.), kind: HitKind::StoryCard(i) });
            y += 66.;
        }
        if let Some(error) = &self.error { chrome::label(error, sx, y + 8., 12., rgb(0x9c3424), Align::Left); }
        let (kx, ky, kw, kh) = (sx, bottom - 8. - 38., 54., 38.);
        draw_rectangle(kx, ky, kw / 2., kh, rgb(0x5f4535));
        rounded(kx, ky, kw, kh, 15., rgb(0x5f4535));
        draw_rectangle_lines(kx, ky, kw, kh, 1., rgb(0xc3a679));
        draw_triangle(vec2(kx + 8., ky + kh / 2.), vec2(kx + 20., ky + 8.), vec2(kx + 20., ky + kh - 8.), rgb(0xf6dc80));
        draw_rectangle(kx + 18., ky + kh / 2. - 4., 22., 8., rgb(0xf6dc80));
        hits.push(Hit { rect: Rect::new(kx, ky, kw, kh), kind: HitKind::StoryBack });
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
        if line.is_empty() || chrome::measure(&candidate, size, chrome::Weight::Regular) <= width { line = candidate; } else { lines.push(line); line = word.to_string(); }
    }
    if !line.is_empty() { lines.push(line); }
    lines
}
fn button(r: nar::Rect, label: &str, active: bool, alpha: f32) {
    let (x, y, w, h) = (r.x as f32, r.y as f32, r.w as f32, r.h as f32);
    rounded_outline(x, y, w, h, 6., if active { rgba(0xe6b74d, alpha) } else { Color::new(1., 1., 1., 0.12 * alpha) }, if active { rgba(0xfff0b5, alpha) } else { Color::new(1., 1., 1., 0.28 * alpha) });
    chrome::label(label, x + w / 2., y + h / 2. + 0.5, 12., if active { rgba(0x17171b, alpha) } else { rgba(0xf4efe4, alpha) }, Align::Center);
}
fn diamond(cx: f32, cy: f32, r: f32, color: Color) { draw_triangle(vec2(cx, cy - r), vec2(cx + r * 0.7, cy), vec2(cx - r * 0.7, cy), color); draw_triangle(vec2(cx, cy + r), vec2(cx + r * 0.7, cy), vec2(cx - r * 0.7, cy), color); }
fn page_banner(text: &str, x: f32, y: f32, w: f32, h: f32) {
    draw_rectangle(x, y, w - 12., h, rgb(0x79643b));
    draw_triangle(vec2(x + w - 12., y), vec2(x + w, y + h / 2.), vec2(x + w - 12., y + h), rgb(0x79643b));
    draw_rectangle(x, y, w - 12., h / 2., rgba(0xa88d50, 0.6));
    for (a, b) in [((x, y), (x + w - 12., y)), ((x + w - 12., y), (x + w, y + h / 2.)), ((x + w, y + h / 2.), (x + w - 12., y + h)), ((x + w - 12., y + h), (x, y + h)), ((x, y + h), (x, y))] { draw_line(a.0, a.1, b.0, b.1, 2., rgb(0xe2c775)); }
    chrome::stroked(text, x + (w - 8.) / 2., y + h / 2., 13., rgb(0xfff4dc), rgb(0x514021), Align::Center);
}
/// `resourceStrip({gold, resources, energy})` at (122, 48): Gold, resources, energy/200.
fn resource_strip(gold: f64, progress: &Progress) {
    let (x0, y, w, h) = (122., 50., (230. - 8.) / 3., 20.);
    for (i, (symbol, value)) in [("gold", super::model::format_number(gold)), ("resources", super::model::format_number(progress.resources)), ("energy", format!("{}/{}", progress.energy, MAX_ENERGY))].iter().enumerate() {
        let x = x0 + i as f32 * (w + 4.);
        rounded_outline(x, y, w, h, 10., rgb(0x30343c), rgb(0xae9661));
        let tw = chrome::measure(value, 10., chrome::Weight::Regular);
        let cx = x + w / 2. - (tw + 16.) / 2.;
        match *symbol {
            "gold" => { draw_circle(cx + 6., y + 10., 6.5, rgb(0xffe18a)); draw_circle(cx + 6., y + 10., 5., rgb(0xe8b53a)); chrome::label("G", cx + 6., y + 10., 9., rgb(0x8b5919), Align::Center); }
            "resources" => diamond(cx + 6., y + 10., 7., rgb(0xef76ba)),
            _ => { draw_triangle(vec2(cx + 8., y + 3.), vec2(cx + 2., y + 11.), vec2(cx + 7., y + 11.), rgb(0xffe057)); draw_triangle(vec2(cx + 5., y + 17.), vec2(cx + 11., y + 9.), vec2(cx + 6., y + 9.), rgb(0xffe057)); }
        }
        chrome::label(value, cx + 16., y + 10., 10., WHITE, Align::Left);
    }
}
fn modal(title: &str, body: &str, secondary: (&str, HitKind, bool), primary: (&str, HitKind, bool), hits: &mut Vec<Hit>) {
    draw_rectangle(0., 0., WIDTH, HEIGHT, rgba(0x070917, 0.66));
    let (mx, mw) = (22., WIDTH - 44.);
    let body_lines = wrap(body, mw - 40., 15.);
    let mh = 24. + 38. + 18. + body_lines.len() as f32 * 21. + 24. + 42. + 24.;
    let my = (HEIGHT - mh) / 2.;
    rounded_outline(mx, my, mw, mh, 18., rgb(0xfff4db), rgb(0xbb995a));
    hits.push(Hit { rect: Rect::new(mx, my, mw, mh), kind: HitKind::PanelBody });
    chrome::label(title, mx + 20., my + 24. + 19., 27., rgb(0x574222), Align::Left);
    for (i, line) in body_lines.iter().enumerate() { chrome::label(line, mx + 20., my + 24. + 38. + 18. + 10. + i as f32 * 21., 15., rgb(0x423821), Align::Left); }
    let by = my + mh - 24. - 42.;
    let bw = (mw - 40. - 12.) / 2.;
    for (i, (label, kind, is_primary)) in [secondary, primary].into_iter().enumerate() {
        let x = mx + 20. + i as f32 * (bw + 12.);
        rounded_outline(x, by, bw, 42., 10., if is_primary { rgb(0xa8d1c3) } else { rgb(0xf2e4c2) }, if is_primary { rgb(0x497e6e) } else { rgb(0xb59456) });
        chrome::label(label, x + bw / 2., by + 21., 15., rgb(0x423821), Align::Center);
        hits.push(Hit { rect: Rect::new(x, by, bw, 42.), kind });
    }
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
