//! `web-runner/src/core/narrativeRuntime.mjs` + `web-runner/systems/narrativeSceneController.mjs`
//! + the render model of `renderNarrativeScene.js`, over the live opening scene
//! (`wishfireWarpCrossingContent.mjs`). The dialogue framework branch stays untouched: only the
//! Chapter 1 warp-crossing scene content lives here.
pub const READING_SPEED_WORDS_PER_SECOND: f64 = 3.;
pub const TYPEWRITER_CHARS_PER_SECOND: f64 = 16.;
pub const SHOT_BLACK_SECONDS: f64 = 0.25;
pub const BACKGROUND_FADE_SECONDS: f64 = 0.45;
pub const ACTOR_FADE_SECONDS: f64 = 0.18;
pub const BLACK_COVER_FADE_SECONDS: f64 = 0.45;
pub const SENTENCES_PER_PAGE: usize = 2;
pub const SCENE_ID: &str = "wishfire-warp-crossing-arrival";
pub const COMBAT_HANDOFF_STEP_ID: &str = "warp-017";
pub const COMPLETE_MESSAGE: &str = "End of Scene Preview";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Character { pub id: &'static str, pub name: &'static str, pub art: &'static str }
pub const CHARACTERS: [Character; 4] = [
    Character { id: "hondo", name: "Hondo", art: "assets/narrative/characters/hondo.png" },
    Character { id: "fara", name: "Fara", art: "assets/narrative/characters/fara.png" },
    Character { id: "kaja", name: "Kaja", art: "assets/narrative/characters/kaja.png" },
    Character { id: "runa", name: "Runa", art: "assets/narrative/characters/runa.png" },
];
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Item { pub id: &'static str, pub visual: &'static str, pub width: f64, pub height: f64 }
pub const ITEMS: [Item; 3] = [
    Item { id: "four-colorful-orbs", visual: "procedural:four-colorful-orbs", width: 250., height: 150. },
    Item { id: "red-orbs", visual: "procedural:red-orbs", width: 250., height: 150. },
    Item { id: "paper-map", visual: "procedural:paper-map", width: 245., height: 170. },
];
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ShotKind { Characters, Item, BackgroundOnly, Dark }
impl ShotKind { pub fn js(self) -> &'static str { match self { ShotKind::Characters => "characters", ShotKind::Item => "item", ShotKind::BackgroundOnly => "background-only", ShotKind::Dark => "dark" } } }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Shot { pub id: &'static str, pub kind: ShotKind, pub cast: &'static [(&'static str, &'static str)], pub item: Option<&'static str> }
pub const SHOTS: [Shot; 7] = [
    Shot { id: "hondo-fara-pair", kind: ShotKind::Characters, cast: &[("hondo", "left"), ("fara", "right")], item: None },
    Shot { id: "kaja-runa-pair", kind: ShotKind::Characters, cast: &[("kaja", "left"), ("runa", "right")], item: None },
    Shot { id: "four-orbs-focus", kind: ShotKind::Item, cast: &[], item: Some("four-colorful-orbs") },
    Shot { id: "red-orbs-tutorial", kind: ShotKind::Item, cast: &[], item: Some("red-orbs") },
    Shot { id: "paper-map-focus", kind: ShotKind::Item, cast: &[], item: Some("paper-map") },
    Shot { id: "creature-roar", kind: ShotKind::BackgroundOnly, cast: &[], item: None },
    Shot { id: "dark-ellipsis", kind: ShotKind::Dark, cast: &[], item: None },
];
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Step { pub id: &'static str, pub speaker: Option<&'static str>, pub text: &'static str, pub shot: &'static str, pub audio: Option<&'static str> }
const ELLIPSIS: &str = "...";
pub const STEPS: [Step; 36] = [
    Step { id: "warp-001", speaker: Some("hondo"), text: "What the...? What\u{2019}s the meaning of this?", shot: "hondo-fara-pair", audio: None },
    Step { id: "warp-002", speaker: Some("fara"), text: "Speak up, you two. Who are you? What are you up to?", shot: "hondo-fara-pair", audio: None },
    Step { id: "warp-003", speaker: Some("kaja"), text: "Hey, we didn\u{2019}t do anything!", shot: "kaja-runa-pair", audio: None },
    Step { id: "warp-004", speaker: Some("runa"), text: "Right, notice that we fell down hard too, you know!", shot: "kaja-runa-pair", audio: None },
    Step { id: "warp-005", speaker: None, text: ELLIPSIS, shot: "dark-ellipsis", audio: None },
    Step { id: "warp-006", speaker: Some("hondo"), text: "So, you two were warping south and wound up here just like us? That\u{2019}s odd. We were warping north. Never heard of warp tunnels crossing together like that.", shot: "hondo-fara-pair", audio: None },
    Step { id: "warp-007", speaker: Some("runa"), text: "Right, we were headed to go investigate some ruins, but... come to think of it... where are we?", shot: "kaja-runa-pair", audio: None },
    Step { id: "warp-008", speaker: Some("fara"), text: "And what are these weird orbs everywhere?", shot: "four-orbs-focus", audio: None },
    Step { id: "warp-009", speaker: None, text: ELLIPSIS, shot: "dark-ellipsis", audio: None },
    Step { id: "warp-010", speaker: Some("runa"), text: "I can\u{2019}t feel any magic... What is this place?", shot: "kaja-runa-pair", audio: None },
    Step { id: "warp-011", speaker: Some("kaja"), text: "Spells aren\u{2019}t doing anything.", shot: "kaja-runa-pair", audio: Some("failed-spells") },
    Step { id: "warp-012", speaker: Some("hondo"), text: "Same here... Nothing. Our magic is not answering...", shot: "hondo-fara-pair", audio: None },
    Step { id: "warp-013", speaker: Some("hondo"), text: "Hmmm... I wonder... Some years back, I heard a rumor about someone trying to crystallize magic, but that experiment was thousands of years ago...", shot: "hondo-fara-pair", audio: None },
    Step { id: "warp-014", speaker: Some("fara"), text: "You think that\u{2019}s what these orbs are? But they\u{2019}re everywhere... Wait!... What\u{2019}s that!?", shot: "hondo-fara-pair", audio: None },
    Step { id: "warp-015", speaker: None, text: ELLIPSIS, shot: "dark-ellipsis", audio: None },
    Step { id: "warp-016", speaker: None, text: "RAWR!!", shot: "creature-roar", audio: Some("creature-roar") },
    Step { id: "warp-017", speaker: None, text: "COMBAT TUTORIAL: RED ORBS", shot: "red-orbs-tutorial", audio: None },
    Step { id: "warp-018", speaker: Some("kaja"), text: "Hey, you two look like you\u{2019}ve seen things. What was that creature?", shot: "kaja-runa-pair", audio: None },
    Step { id: "warp-019", speaker: Some("hondo"), text: "No idea, but we can cast during battle it seems.", shot: "hondo-fara-pair", audio: None },
    Step { id: "warp-020", speaker: Some("fara"), text: "Good thing, too. These orbs helped us when we needed to fight...", shot: "hondo-fara-pair", audio: None },
    Step { id: "warp-021", speaker: Some("kaja"), text: "Yeah, that saved our skins!", shot: "kaja-runa-pair", audio: None },
    Step { id: "warp-022", speaker: Some("runa"), text: "These orbs have a warmth when you hold them. Is that feeling the magic inside? Maybe that weird experiment worked.", shot: "kaja-runa-pair", audio: None },
    Step { id: "warp-023", speaker: Some("hondo"), text: "No, if they are a form of magic then we genies would have collected them. Ha! ...and you can bet merchants and bandits would have gathered them up to sell, too. No, this is unique somehow. But whatever magic they hold they were useful in a fight.", shot: "hondo-fara-pair", audio: None },
    Step { id: "warp-023-runa", speaker: Some("runa"), text: "When I thought of what to do the orbs responded, but I couldn\u{2019}t feel magic like normal.", shot: "kaja-runa-pair", audio: None },
    Step { id: "warp-024", speaker: Some("fara"), text: "Thank goodness they did something! Without magic we are just like humans. But let\u{2019}s think about this later. Now, we need to find some shelter and some answers.", shot: "hondo-fara-pair", audio: None },
    Step { id: "warp-025", speaker: Some("runa"), text: "Kaja, where\u{2019}s that raggedy map you\u{2019}ve been working on? Maybe it can help.", shot: "kaja-runa-pair", audio: None },
    Step { id: "warp-026", speaker: Some("fara"), text: "A map? How? Maps normally need magic to conjure up. Is this a trick?", shot: "hondo-fara-pair", audio: None },
    Step { id: "warp-027", speaker: Some("kaja"), text: "It\u{2019}s not a normal map. I made it myself.", shot: "kaja-runa-pair", audio: None },
    Step { id: "warp-028", speaker: Some("runa"), text: "Right, so where are we?", shot: "kaja-runa-pair", audio: None },
    Step { id: "warp-029", speaker: Some("fara"), text: "Let me take a look.", shot: "paper-map-focus", audio: None },
    Step { id: "warp-030", speaker: Some("fara"), text: "Looks like we\u{2019}re in the Goldrin Wilds, but a lot of the map is empty. Guess you\u{2019}re pretty new to exploring, huh?", shot: "paper-map-focus", audio: None },
    Step { id: "warp-031", speaker: None, text: ELLIPSIS, shot: "dark-ellipsis", audio: None },
    Step { id: "warp-032", speaker: Some("kaja"), text: "Yeah, we\u{2019}ve only just started our expedition. Anyway, what\u{2019}s the plan? Where to?", shot: "kaja-runa-pair", audio: None },
    Step { id: "warp-033", speaker: Some("fara"), text: "If what you\u{2019}re calling a map is correct, we need to head east. There should be a town near there. Let\u{2019}s go.", shot: "hondo-fara-pair", audio: None },
    Step { id: "warp-034", speaker: Some("runa"), text: "Wait! We should grab some orbs to show the townsfolk.", shot: "kaja-runa-pair", audio: None },
    Step { id: "warp-035", speaker: Some("hondo"), text: "Good idea! Maybe someone there knows what\u{2019}s going on. And we can ask what these orbs are too.", shot: "hondo-fara-pair", audio: None },
];
pub fn handoff_index() -> usize { STEPS.iter().position(|s| s.id == COMBAT_HANDOFF_STEP_ID).expect("authored combat handoff step") }
/// A scene segment (`segment(steps)` in storyEntryFlow): the quest cards play slices of the scene.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Content { pub steps: &'static [Step] }
impl Content {
    pub fn full() -> Self { Content { steps: &STEPS } }
    /// Main Story 1: steps before the combat handoff.
    pub fn before_handoff() -> Self { Content { steps: &STEPS[..handoff_index()] } }
    /// Main Story 2: steps after the combat handoff.
    pub fn after_handoff() -> Self { Content { steps: &STEPS[handoff_index() + 1..] } }
}
pub fn character(id: &str) -> Option<&'static Character> { CHARACTERS.iter().find(|c| c.id == id) }
pub fn shot(id: &str) -> Option<&'static Shot> { SHOTS.iter().find(|s| s.id == id) }
pub fn item(id: &str) -> Option<&'static Item> { ITEMS.iter().find(|i| i.id == id) }

/// `createNarrativeState`: the scene cursor (`gameState.narrative`).
#[derive(Clone, Debug, PartialEq, Default)]
pub struct NarrativeState { pub active: bool, pub step_index: usize, pub completed_scene: bool, pub last_event: Option<String>, pub source: Option<String> }
/// A resolved line (`resolveNarrativeLine`).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Line { pub index: usize, pub id: &'static str, pub speaker: Option<&'static Character>, pub text: &'static str, pub shot: &'static Shot, pub item: Option<&'static Item>, pub audio: Option<&'static str> }
pub fn current_line(state: &NarrativeState, content: Content) -> Option<Line> {
    if !state.active || content.steps.is_empty() { return None; }
    let index = state.step_index.min(content.steps.len() - 1);
    let step = &content.steps[index];
    let shot = shot(step.shot)?;
    Some(Line { index, id: step.id, speaker: step.speaker.and_then(character), text: step.text, shot, item: shot.item.and_then(item), audio: step.audio })
}
/// `startNarrativeScene(state, content, sceneId, {source})`.
pub fn start_scene(state: &mut NarrativeState, source: &str) { state.active = true; state.step_index = 0; state.source = Some(source.into()); state.last_event = Some("scene-started".into()); }
/// `advanceNarrativeScene` → done?
pub fn advance_scene(state: &mut NarrativeState, content: Content) -> bool {
    if !state.active { return true; }
    if state.step_index + 1 < content.steps.len() { state.step_index += 1; state.last_event = Some("line-advanced".into()); return false; }
    state.completed_scene = true; state.active = false; state.step_index = 0; state.last_event = Some("scene-preview-complete".into());
    true
}
/// `completeActiveNarrativeScene(state, content, {skipped: true})`.
pub fn complete_scene(state: &mut NarrativeState, skipped: bool) -> bool {
    if !state.active { return true; }
    state.completed_scene = true; state.active = false; state.step_index = 0; state.last_event = Some(if skipped { "scene-preview-complete:skipped".into() } else { "scene-preview-complete".into() });
    true
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TransitionMode { Ordered, BlackCover }
impl TransitionMode { pub fn js(self) -> &'static str { match self { TransitionMode::Ordered => "ordered", TransitionMode::BlackCover => "black-cover" } } }
/// `createNarrativeScenePresentation` (`gameState.narrativeScene`), seconds on the frame clock.
#[derive(Clone, Debug, PartialEq)]
pub struct Presentation {
    pub auto: bool,
    pub completed: bool,
    pub completion_started_at: f64,
    pub line_id: Option<&'static str>,
    pub line_started_at: f64,
    pub page_index: usize,
    pub page_started_at: f64,
    pub forced_complete: Option<(&'static str, usize)>,
    pub stage_initialized: bool,
    pub shot_transition: Option<(&'static str, f64, TransitionMode)>,
    pub played_audio: Vec<&'static str>,
    pub completion_message: String,
    /// `presentation.hitZones`: what the last render exposed to the pointer.
    pub hit_zones: HitZones,
}
impl Presentation {
    pub fn new(now: f64) -> Self { Self { auto: false, completed: false, completion_started_at: 0., line_id: None, line_started_at: now, page_index: 0, page_started_at: now, forced_complete: None, stage_initialized: false, shot_transition: None, played_audio: Vec::new(), completion_message: String::new(), hit_zones: HitZones::default() } }
}
/// `syncNarrativeSceneLine`.
pub fn sync_line(p: &mut Presentation, line_id: Option<&'static str>, now: f64) {
    if p.line_id != line_id { p.line_id = line_id; p.line_started_at = now; p.page_index = 0; p.page_started_at = now; p.forced_complete = None; }
}
fn is_lower(c: char) -> bool { c.is_lowercase() }
/// `getNarrativeScenePages`: sentence segmentation (ICU rules as `Intl.Segmenter` applies them to
/// this content: a period run only ends a sentence when the next word is not lowercase), two
/// sentences per page.
pub fn sentences(text: &str) -> Vec<String> {
    let text = text.trim();
    if text.is_empty() { return vec![String::new()]; }
    let chars: Vec<char> = text.chars().collect();
    let mut out = Vec::new();
    let mut start = 0;
    let mut i = 0;
    while i < chars.len() {
        if matches!(chars[i], '.' | '!' | '?') {
            let mut j = i;
            while j < chars.len() && matches!(chars[j], '.' | '!' | '?') { j += 1; }
            let ends_with_period = chars[j - 1] == '.';
            let mut k = j;
            while k < chars.len() && chars[k].is_whitespace() { k += 1; }
            // SB8: a period run before a lowercase word continues; SB8a: a run before another terminator continues.
            let suppressed = k < chars.len() && ((ends_with_period && is_lower(chars[k])) || matches!(chars[k], '.' | '!' | '?'));
            if !suppressed {
                let s: String = chars[start..j].iter().collect();
                let s = s.trim().to_string();
                if !s.is_empty() { out.push(s); }
                start = k;
            }
            i = j;
        } else { i += 1; }
    }
    if start < chars.len() { let s: String = chars[start..].iter().collect(); let s = s.trim().to_string(); if !s.is_empty() { out.push(s); } }
    if out.is_empty() { vec![text.to_string()] } else { out }
}
pub fn pages(text: &str) -> Vec<String> {
    let s = sentences(text);
    if s.len() == 1 && s[0].is_empty() { return vec![String::new()]; }
    s.chunks(SENTENCES_PER_PAGE).map(|c| c.join(" ")).collect()
}
#[derive(Clone, Debug, PartialEq)]
pub struct Page { pub index: usize, pub count: usize, pub text: String }
pub fn page(text: &str, p: &Presentation) -> Page {
    let pages = pages(text);
    let index = p.page_index.min(pages.len() - 1);
    Page { index, count: pages.len(), text: pages[index].clone() }
}
#[derive(Clone, Debug, PartialEq)]
pub struct Transition { pub active: bool, pub mode: Option<TransitionMode>, pub phase: &'static str, pub background_alpha: f64, pub subject_alpha: f64, pub dialogue_alpha: f64, pub dialogue_ready: bool, pub cover_alpha: f64 }
pub fn begin_shot_transition(p: &mut Presentation, line_id: &'static str, now: f64, mode: TransitionMode) { p.stage_initialized = true; p.shot_transition = Some((line_id, now, mode)); }
/// `getNarrativeShotTransition`.
pub fn shot_transition(p: &Presentation, line_id: Option<&str>, now: f64) -> Transition {
    let Some((id, started, mode)) = p.shot_transition else { return Transition { active: false, mode: None, phase: "dialogue", background_alpha: 1., subject_alpha: 1., dialogue_alpha: 1., dialogue_ready: true, cover_alpha: 0. } };
    if line_id != Some(id) { return Transition { active: false, mode: None, phase: "dialogue", background_alpha: 1., subject_alpha: 1., dialogue_alpha: 1., dialogue_ready: true, cover_alpha: 0. }; }
    let elapsed = (now - started).max(0.);
    if mode == TransitionMode::BlackCover {
        let cover_alpha = 1. - (elapsed / BLACK_COVER_FADE_SECONDS).clamp(0., 1.);
        let dialogue_ready = cover_alpha <= 0.;
        return Transition { active: !dialogue_ready, mode: Some(mode), phase: if dialogue_ready { "dialogue" } else { "cover" }, background_alpha: 1., subject_alpha: 1., dialogue_alpha: 1., dialogue_ready, cover_alpha };
    }
    let background_elapsed = elapsed - SHOT_BLACK_SECONDS;
    let actor_elapsed = background_elapsed - BACKGROUND_FADE_SECONDS;
    let background_alpha = (background_elapsed / BACKGROUND_FADE_SECONDS).clamp(0., 1.);
    let subject_alpha = (actor_elapsed / ACTOR_FADE_SECONDS).clamp(0., 1.);
    let dialogue_alpha = if actor_elapsed >= ACTOR_FADE_SECONDS { 1. } else { 0. };
    let phase = if background_elapsed < 0. { "black" } else if actor_elapsed < 0. { "background" } else if dialogue_alpha < 1. { "actors" } else { "dialogue" };
    Transition { active: dialogue_alpha < 1., mode: Some(mode), phase, background_alpha, subject_alpha, dialogue_alpha, dialogue_ready: dialogue_alpha >= 1., cover_alpha: 0. }
}
fn text_start_seconds(p: &Presentation, now: f64) -> f64 {
    if p.page_index > 0 { return p.page_started_at; }
    match p.shot_transition {
        Some((id, started, mode)) if Some(id) == p.line_id => match mode { TransitionMode::BlackCover => started + BLACK_COVER_FADE_SECONDS, TransitionMode::Ordered => started + SHOT_BLACK_SECONDS + BACKGROUND_FADE_SECONDS + ACTOR_FADE_SECONDS },
        _ => { let _ = now; p.line_started_at }
    }
}
/// `getNarrativeSceneVisibleText`: the typewriter slice.
pub fn visible_text(text: &str, p: &Presentation, now: f64) -> String {
    if text.is_empty() { return String::new(); }
    if p.forced_complete.is_some_and(|(id, page)| Some(id) == p.line_id && page == p.page_index) { return text.into(); }
    let elapsed = (now - text_start_seconds(p, now)).max(0.);
    let count = ((elapsed * TYPEWRITER_CHARS_PER_SECOND).floor() as usize).min(text.chars().count());
    text.chars().take(count).collect()
}
pub fn fully_visible(text: &str, p: &Presentation, now: f64) -> bool { visible_text(text, p, now).chars().count() >= text.chars().count() }
pub fn read_seconds(text: &str) -> f64 { let words = text.split_whitespace().count() as f64; (words / READING_SPEED_WORDS_PER_SECOND + 0.55).max(1.45) }
/// `completeNarrativeScenePresentation`.
pub fn complete_presentation(p: &mut Presentation, now: f64) {
    p.completed = true; p.completion_started_at = now; p.auto = false; p.forced_complete = None; p.completion_message = COMPLETE_MESSAGE.into();
}
#[derive(Clone, Debug, PartialEq)]
pub struct Advance { pub completed: bool, pub advanced: bool, pub page_advanced: bool }
/// `advanceNarrativeScenePresentation`.
pub fn advance(state: &mut NarrativeState, p: &mut Presentation, content: Content, force_complete_text_first: bool, now: f64) -> Advance {
    let line = current_line(state, content);
    sync_line(p, line.map(|l| l.id), now);
    let page = line.map(|l| page(l.text, p));
    if let (Some(l), Some(pg)) = (line, &page) {
        if force_complete_text_first && !fully_visible(&pg.text, p, now) { p.forced_complete = Some((l.id, pg.index)); return Advance { completed: false, advanced: false, page_advanced: false }; }
        if pg.index + 1 < pg.count { p.page_index = pg.index + 1; p.page_started_at = now; p.forced_complete = None; return Advance { completed: false, advanced: false, page_advanced: true }; }
    }
    let previous_shot = line.map(|l| l.shot.id);
    let previous_kind = line.map(|l| l.shot.kind);
    let done = advance_scene(state, content);
    if done { complete_presentation(p, now); return Advance { completed: true, advanced: true, page_advanced: false }; }
    if let Some(next) = current_line(state, content) {
        p.line_id = None; p.line_started_at = 0.; p.page_index = 0; p.page_started_at = 0.; p.forced_complete = None;
        let shot_changed = Some(next.shot.id) != previous_shot;
        let restores_dark = previous_kind == Some(ShotKind::Dark) && next.shot.kind != ShotKind::Dark;
        let object_focus = next.shot.kind == ShotKind::Item || previous_kind == Some(ShotKind::Item);
        if shot_changed && restores_dark { begin_shot_transition(p, next.id, now, TransitionMode::BlackCover); }
        else if shot_changed && next.shot.kind != ShotKind::Dark && object_focus { begin_shot_transition(p, next.id, now, TransitionMode::Ordered); }
        else { p.stage_initialized = true; p.shot_transition = None; }
    }
    Advance { completed: false, advanced: true, page_advanced: false }
}
/// `updateNarrativeSceneAuto`.
pub fn update_auto(state: &mut NarrativeState, p: &mut Presentation, content: Content, now: f64) -> bool {
    if !p.auto || p.completed { return false; }
    let Some(line) = current_line(state, content) else { return false };
    sync_line(p, Some(line.id), now);
    let pg = page(line.text, p);
    if !fully_visible(&pg.text, p, now) { return false; }
    let elapsed = (now - text_start_seconds(p, now)).max(0.);
    if elapsed < read_seconds(&pg.text) { return false; }
    advance(state, p, content, false, now);
    true
}
/// `skipNarrativeScene`.
pub fn skip(state: &mut NarrativeState, p: &mut Presentation, now: f64) { complete_scene(state, true); complete_presentation(p, now); }
/// `restartNarrativeScene`.
pub fn restart(state: &mut NarrativeState, p: &mut Presentation, now: f64) { start_scene(state, "scene-restart"); *p = Presentation::new(now); }
/// Logical 360x640 rectangles.
#[derive(Clone, Copy, Debug, PartialEq, Default)]
pub struct Rect { pub x: f64, pub y: f64, pub w: f64, pub h: f64 }
impl Rect { pub fn contains(&self, x: f64, y: f64) -> bool { x >= self.x && x <= self.x + self.w && y >= self.y && y <= self.y + self.h } }
#[derive(Clone, Copy, Debug, PartialEq, Default)]
pub struct HitZones { pub restart: Option<Rect>, pub auto: Option<Rect>, pub skip: Option<Rect>, pub panel: Option<Rect> }
pub const WIDTH: f64 = 360.;
pub const HEIGHT: f64 = 640.;
pub const PANEL_H: f64 = 204.;
pub fn panel_rect() -> Rect { Rect { x: 16., y: HEIGHT - PANEL_H - 12., w: WIDTH - 32., h: PANEL_H } }
pub fn stage_rect() -> Rect { let p = panel_rect(); Rect { x: 0., y: 34., w: WIDTH, h: p.y - 12. } }
pub fn auto_button() -> Rect { let p = panel_rect(); Rect { x: p.x + p.w - 132., y: p.y + 13., w: 60., h: 30. } }
pub fn skip_button() -> Rect { let p = panel_rect(); Rect { x: p.x + p.w - 66., y: p.y + 13., w: 54., h: 30. } }
pub fn restart_button() -> Rect { Rect { x: 78., y: HEIGHT * 0.58, w: WIDTH - 156., h: 44. } }
pub fn item_rect() -> Rect { Rect { x: 48., y: 135., w: WIDTH - 96., h: 180. } }
/// Character stage rectangles by cast slot (`stageRects`).
pub fn slot_rect(slot: &str) -> Rect {
    let s = stage_rect();
    match slot { "left" => Rect { x: -28., y: s.y + 10., w: 220., h: s.h }, "right" => Rect { x: WIDTH - 192., y: s.y, w: 220., h: s.h }, _ => Rect { x: 70., y: s.y, w: 220., h: s.h } }
}
/// What `renderNarrativeScene` resolves for a frame (its `lastRender` plus the draw inputs).
#[derive(Clone, Debug, PartialEq)]
pub struct RenderModel {
    pub completed: bool,
    pub completion_fade: f64,
    pub line: Option<Line>,
    pub page: Option<Page>,
    pub visible_text: String,
    pub fully_visible: bool,
    pub transition: Transition,
    pub audio_cue: Option<&'static str>,
    pub hit_zones: HitZones,
    pub actors_visible: bool,
}
/// The per-frame sync `renderNarrativeScene` performs before drawing (side effects on `p`).
pub fn render_sync(state: &NarrativeState, p: &mut Presentation, content: Content, now: f64) -> RenderModel {
    let none = Transition { active: false, mode: None, phase: "dialogue", background_alpha: 1., subject_alpha: 1., dialogue_alpha: 1., dialogue_ready: true, cover_alpha: 0. };
    if p.completed || !state.active {
        let fade = if p.completion_started_at > 0. { ((now - p.completion_started_at) / 0.45).clamp(0., 1.) } else { 1. };
        p.hit_zones = HitZones { restart: Some(restart_button()), ..Default::default() };
        return RenderModel { completed: true, completion_fade: fade, line: None, page: None, visible_text: String::new(), fully_visible: true, transition: none, audio_cue: None, hit_zones: p.hit_zones, actors_visible: false };
    }
    let Some(line) = current_line(state, content) else { return RenderModel { completed: false, completion_fade: 1., line: None, page: None, visible_text: String::new(), fully_visible: false, transition: none, audio_cue: None, hit_zones: HitZones::default(), actors_visible: false } };
    sync_line(p, Some(line.id), now);
    if !p.stage_initialized {
        if line.shot.kind != ShotKind::Dark { begin_shot_transition(p, line.id, now, TransitionMode::BlackCover); } else { p.stage_initialized = true; }
    }
    let transition = if line.shot.kind == ShotKind::Dark { Transition { active: false, mode: None, phase: "dark", background_alpha: 0., subject_alpha: 0., dialogue_alpha: 1., dialogue_ready: true, cover_alpha: 0. } } else { shot_transition(p, Some(line.id), now) };
    let pg = page(line.text, p);
    let visible = visible_text(&pg.text, p, now);
    let full = fully_visible(&pg.text, p, now);
    let audio_cue = if transition.dialogue_ready { line.audio.filter(|_| !p.played_audio.contains(&line.id)) } else { None };
    if audio_cue.is_some() { p.played_audio.push(line.id); }
    let panel = if transition.dialogue_alpha > 0. { HitZones { panel: Some(panel_rect()), auto: Some(auto_button()), skip: Some(skip_button()), restart: None } } else { HitZones::default() };
    let hit_zones = if transition.dialogue_ready { panel } else { HitZones::default() };
    p.hit_zones = hit_zones;
    let actors_visible = line.shot.kind == ShotKind::Characters && transition.subject_alpha > 0. && transition.cover_alpha < 1.;
    RenderModel { completed: false, completion_fade: 1., line: Some(line), page: Some(pg), visible_text: visible, fully_visible: full, transition, audio_cue, hit_zones, actors_visible }
}
/// `handleNarrativeScenePointer` with the zones the last render set.
pub fn pointer(state: &mut NarrativeState, p: &mut Presentation, content: Content, x: f64, y: f64, now: f64) -> &'static str {
    let zones = p.hit_zones;
    if p.completed {
        if zones.restart.is_some_and(|r| r.contains(x, y)) { restart(state, p, now); return "restart"; }
        return "completed-idle";
    }
    if shot_transition(p, p.line_id, now).active { return "shot-transition"; }
    if zones.auto.is_some_and(|r| r.contains(x, y)) { p.auto = !p.auto; return if p.auto { "auto-on" } else { "auto-off" }; }
    if zones.skip.is_some_and(|r| r.contains(x, y)) { skip(state, p, now); return "skip"; }
    advance(state, p, content, true, now);
    "advance"
}
