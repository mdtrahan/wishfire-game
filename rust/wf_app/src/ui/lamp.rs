//! The Bag: its icon beside the quest tracker (collection and capacity indicator), the Bag
//! progress bar that slides out of it, and the equipment windows (`lampEquipmentUI.mjs`,
//! `bagUpgradePresentation.mjs`). Equipment arrives as battlefield orbs (`ui/orbs.rs`); the
//! rules and saves are `wf_host::equipment` / `wf_meta::lamp`.
//! The player makes no equipment choices (owner 2026-11-05, ORKA-63bf.34): orbs are judged at
//! pickup, so the Bag holds only items that raised a hero's CP when they were picked up. Tapping
//! the bag runs Auto-Equip at once and shows what was equipped. The window then stays until the
//! player moves on (owner 2026-11-05, ORKA-63bf.45: never advance by itself; the player may
//! want to study the heroes' CP, the items, or just leave it open): Done goes to the dismantle
//! screen for items that stopped being upgrades, or closes; when the Bag is empty the Essence
//! held since the last time fills the bar.
use super::chrome::{self, rgb, stroked, Align, Hit};
use super::dom::{el, Node};
use super::orbs::OrbField;
use super::{css, Act};
use crate::assets::Assets;
use crate::game::Game;
use macroquad::prelude::*;
use wf_host::equipment::lamp_hero_roster;
use wf_meta::equipment::{format_compact_count, rarity, RARITIES};
use wf_meta::lamp::*;

#[derive(Clone, Debug, PartialEq)]
pub enum LampHit { Bag, Close, Done, Dismantle, Upgrade(u32) }
#[derive(Clone, Debug)]
struct LHit { rect: Rect, kind: LampHit }
#[derive(Default)]
pub struct LampUi {
    pub open: bool,
    pub upgrade_open: bool,
    /// What Auto-Equip put on the heroes when this window opened: shown while the CP floats rise.
    equipped: Vec<LampItem>,
    disposal_view: bool,
    disposal_preview: Option<DisposalPreview>,
    upgrade_receipt: Option<UpgradeReceipt>,
    notice: String,
    feedbacks: Vec<(String, f64, f64)>,
    /// The player pressed Done while CP floats are rising: the dismantle screen (or the close,
    /// when nothing is left to dismantle) waits until the last float has finished (owner
    /// 2026-11-05). Nothing sets this but the player's press.
    disposal_waiting: bool,
    hits: Vec<LHit>,
    pub orbs: OrbField,
    bar: BagBar,
    /// The Cascade Fill ceremony advanced this frame: taps, page clicks and keys are ignored.
    locked: bool,
    /// Seconds left of the bounce an item going into the bag started (owner 2026-11-05).
    bounce: f32,
    /// Sparks splashed by items going into the bag.
    splash: Vec<Spark>,
    splash_seed: u32,
    /// Runs while the bag holds items to process: the bag jiggles at intervals on this clock.
    agitated: f32,
}
/// An item going into the bag: the bag hops and swells for this long.
const BOUNCE_SECONDS: f32 = 0.28;
const SPLASH_SPARKS: usize = 7;
/// The agitated jiggle: a short shake at the start of every period while items wait.
const JIGGLE_PERIOD: f32 = 2.2;
const JIGGLE_SECONDS: f32 = 0.55;
/// Scale and upward hop (px) of the bag `left` seconds before its bounce ends.
fn bag_bounce(left: f32) -> (f32, f32) {
    if left <= 0. { return (1., 0.); }
    let arc = (std::f32::consts::PI * (1. - left / BOUNCE_SECONDS).clamp(0., 1.)).sin();
    (1. + 0.24 * arc, 3. * arc)
}
/// Rotation (radians) and scale of the agitated bag at `clock` seconds of waiting: a decaying
/// shake for `JIGGLE_SECONDS`, then rest until the next period.
fn bag_jiggle(clock: f32) -> (f32, f32) {
    if clock <= 0. { return (0., 1.); }
    let t = clock % JIGGLE_PERIOD;
    if t >= JIGGLE_SECONDS { return (0., 1.); }
    let decay = 1. - t / JIGGLE_SECONDS;
    ((t * std::f32::consts::TAU * 6.).sin() * 0.16 * decay, 1. + 0.06 * decay)
}
// The bag icon keeps the x centre it had in the old strip, at half its size, centred on the
// quest tracker (the 52 px objective box).
const BAG_CX: f32 = 360. * 0.7652 + 360. * 0.228 / 2.;
const BAG_CY: f32 = chrome::QUEST_TOP + 52. / 2.;
const BAG_W: f32 = 360. * 0.228 * 0.5;
const BAG_H: f32 = 92. * 0.83 * 0.9745 * 0.5;
// The Bag progress bar: slides out to the left from behind the icon. Its bag-side end stays
// under the bag's painted silhouette (owner 2026-11-05): the rounded cap never shows, only the
// straight body leaves the bag. `BAR_TUCK` is how much of the bar's length lies under the bag.
const BAR_TUCK: f32 = 10.;
// Height: 9 (owner 2026-11-05: a quarter thinner than the first 12).
// Length out of the bag: 55.2 (owner 2026-11-05: 40% shorter than the first 92; the bag-side
// end stays where it was, so the bar reaches less far to the left).
const BAR_REACH: f32 = 92. * 0.6;
const BAR_W: f32 = BAR_REACH + BAR_TUCK; const BAR_H: f32 = 9.;
const BAR_RIGHT: f32 = BAG_CX - 6. + BAR_TUCK;
const SLIDE_SECONDS: f32 = 0.22;
/// The bar rests this long before each fill starts (once it is out, and again after every
/// upgrade), so the player sees there is something to watch.
const BEAT_SECONDS: f32 = 0.5;
/// A whole bar fills in this long; a smaller gain takes its share, but never less than
/// `MIN_FILL_SECONDS`.
const FILL_SECONDS: f32 = 1.2;
const MIN_FILL_SECONDS: f32 = 0.6;
const CELEBRATE_SECONDS: f32 = 0.3;
/// The finished display stays this long after the last fill or upgrade before sliding back
/// (owner 2026-11-05: 0.4 s; was 0.6 s, first 2.5 s).
const HOLD_SECONDS: f32 = 0.4;
/// Small round sparks thrown from the bar's far end the moment the slide-out completes
/// (owner 2026-11-05).
const SPARKS: usize = 14;
const SPARK_TINTS: [u32; 4] = [0xb777d8, 0xffffff, chrome::TIMER_BLUE, 0xe3c4f5];
#[derive(Clone, Copy, Debug)]
struct Spark { pos: Vec2, vel: Vec2, radius: f32, age: f32, life: f32, tint: u32 }
#[derive(Clone, Copy, Debug, Default, PartialEq)]
enum BarPhase { #[default] Hidden, SlideOut, Beat, Fill, Celebrate, Hold, SlideIn }
/// The **Cascade Fill** ceremony (owner's name for this kind of progress presentation, 2026-11-05):
/// slide out, beat, fill, and for every full bar a burst, a beat and a refill with the overflow,
/// then a hold and the slide back; input is locked while it plays. It shows the saved progress,
/// never its own: every full bar is settled through `EquipmentStorage::complete_fill` when the
/// fill reaches the end, and the next bar starts from whatever the save holds after that. Bag
/// levels are frozen until hero EXP exists (owner 2026-11-05), so a full bar banks a fill and
/// leaves capacity and rarity odds alone.
#[derive(Default)]
struct BagBar { phase: BarPhase, t: f32, fraction: f32, wanted: bool,
    /// Bar fractions per second of the fill in progress.
    rate: f32,
    sparks: Vec<Spark>, spark_seed: u32 }
impl BagBar {
    /// The ceremony is on screen.
    fn active(&self) -> bool { self.phase != BarPhase::Hidden }
    fn start_fill(&mut self, target: f32) {
        let gap = (target - self.fraction).max(0.);
        self.rate = if gap > 0. { gap / (FILL_SECONDS * gap).max(MIN_FILL_SECONDS) } else { 1. / FILL_SECONDS };
        self.phase = BarPhase::Fill;
    }
    /// The slide-out has just completed: a burst of various-sized sparks leaves the bar's far end.
    fn burst(&mut self) {
        let mut seed = self.spark_seed.wrapping_add(0x9e37_79b9);
        let mut unit = || { seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223); (seed >> 8) as f32 / 16_777_216. };
        for _ in 0..SPARKS {
            let angle = (unit() - 0.5) * 2.8;
            let speed = 30. + 60. * unit();
            let spark = Spark { pos: vec2(BAR_RIGHT - BAR_W + 2., BAG_CY + (unit() - 0.5) * BAR_H), vel: vec2(-angle.cos(), angle.sin()) * speed,
                radius: 1. + 2.2 * unit(), age: 0., life: 0.35 + 0.35 * unit(), tint: SPARK_TINTS[(unit() * SPARK_TINTS.len() as f32) as usize % SPARK_TINTS.len()] };
            self.sparks.push(spark);
        }
        self.spark_seed = seed;
    }
    /// `visible`: the bag icon is on screen and nothing covers it.
    fn update(&mut self, economy: &mut wf_host::equipment::EquipmentStorage, session: &mut wf_host::session::Session, dt: f32, visible: bool) -> Option<String> {
        for spark in &mut self.sparks { spark.age += dt; spark.pos += spark.vel * dt; spark.vel *= (1. - 3. * dt).max(0.); }
        self.sparks.retain(|spark| spark.age < spark.life);
        let data = economy.data()?;
        let progress = data.fill_progress();
        let fills = data.bag_fills();
        let ready = !progress.max && progress.required.is_some_and(|r| progress.current >= r);
        let target = if ready { 1. } else { progress.fraction as f32 };
        if progress.max { self.wanted = false; }
        if !visible { return None; }
        match self.phase {
            BarPhase::Hidden => {
                // Only a cleared Bag brings the bar out (`request`). It always comes out
                // empty and fills up to what the save holds (owner 2026-11-05): a bar that came
                // out part-filled read as a right-to-left fill while it slid.
                if self.wanted { self.wanted = false; self.fraction = 0.; self.phase = BarPhase::SlideOut; self.t = 0.; }
            }
            BarPhase::SlideOut => { self.t += dt; if self.t >= SLIDE_SECONDS { self.phase = BarPhase::Beat; self.t = 0.; self.burst(); } }
            BarPhase::Beat => { self.wanted = false; self.t += dt; if self.t >= BEAT_SECONDS { self.start_fill(target); } }
            BarPhase::Fill => {
                self.wanted = false;
                self.fraction = if self.fraction > target { target } else { (self.fraction + dt * self.rate).min(target) };
                if self.fraction >= target {
                    self.phase = if ready { BarPhase::Celebrate } else { BarPhase::Hold }; self.t = 0.;
                    // The count is satisfied: what is left of the Essence now lives in the bar.
                    if !ready { if let Err(error) = economy.bank_essence(session) { return Some(error); } }
                }
            }
            BarPhase::Celebrate => {
                self.t += dt;
                if self.t >= CELEBRATE_SECONDS {
                    match economy.complete_fill(session, fills) {
                        // The emptied bar rests a beat, then fills with the overflow.
                        Ok(_) => { self.fraction = 0.; self.phase = BarPhase::Beat; self.t = 0.; }
                        Err(error) => { self.phase = BarPhase::Hold; self.t = 0.; return Some(error); }
                    }
                }
            }
            BarPhase::Hold => {
                self.t += dt;
                if self.wanted || ready { self.start_fill(target); } else if self.t >= HOLD_SECONDS { self.phase = BarPhase::SlideIn; self.t = 0.; }
            }
            BarPhase::SlideIn => { self.t += dt; if self.t >= SLIDE_SECONDS { self.phase = BarPhase::Hidden; } }
        }
        None
    }
    /// The Bag has been cleared (a dismantle completed, or nothing is stored and Essence is
    /// held): show the progress once the bag icon is uncovered.
    fn request(&mut self) { self.wanted = true; }
    /// How far the bar is out of the icon, 0..1.
    fn reveal(&self) -> f32 {
        let ease = |t: f32| { let t = t.clamp(0., 1.); 1. - (1. - t) * (1. - t) };
        match self.phase { BarPhase::Hidden => 0., BarPhase::SlideOut => ease(self.t / SLIDE_SECONDS), BarPhase::SlideIn => 1. - ease(self.t / SLIDE_SECONDS), _ => 1. }
    }
    /// 0..1 through the upgrade celebration, else `None`.
    fn celebration(&self) -> Option<f32> { (self.phase == BarPhase::Celebrate).then(|| (self.t / CELEBRATE_SECONDS).clamp(0., 1.)) }
    /// The bar alone: no numbers on it (owner 2026-11-05). The fill is the boss timer's blue
    /// and flashes white on an upgrade.
    fn draw(&self) {
        for spark in &self.sparks {
            let left = 1. - spark.age / spark.life;
            draw_circle(spark.pos.x, spark.pos.y, spark.radius * (0.4 + 0.6 * left), chrome::rgba(spark.tint, left));
        }
        let reveal = self.reveal();
        if reveal <= 0. { return; }
        let right = BAR_RIGHT;
        let width = BAR_W * reveal;
        let (x, y) = (right - width, BAG_CY - BAR_H / 2.);
        let flash = self.celebration().map_or(0., |c| 1. - c);
        chrome::capsule(x - 1.5, y - 1.5, width + 3., BAR_H + 3., rgb(0xb777d8));
        chrome::capsule(x, y, width, BAR_H, rgb(0x242130));
        // A full fill ends where it always did, just inside the bag's edge; the tucked length
        // beyond it is never seen.
        let fill = (width - 2. - BAR_TUCK).max(0.) * self.fraction.clamp(0., 1.);
        let color = chrome::mix(rgb(chrome::TIMER_BLUE), WHITE, flash);
        let (cap, (rx, ry, rw, rh)) = fill_shape(fill, BAR_H - 2.);
        if let Some(radius) = cap { draw_circle(x + 1. + radius, y + 1. + radius, radius, color); }
        if rw > 0. { draw_rectangle(x + 1. + rx, y + 1. + ry, rw, rh, color); }
    }
}
/// The blue fill's shape for a fill `length` in a track `height` high (owner 2026-11-05,
/// ORKA-63bf.44): its far end follows the track's round cap, and its leading edge is a straight
/// vertical line exactly `length` along the bar, so the length can be judged. Returns the cap's
/// radius (once the fill is past the cap) and one rectangle (x, y, w, h) from the fill's origin.
/// Inside the cap the rectangle is only as tall as the cap is there.
fn fill_shape(length: f32, height: f32) -> (Option<f32>, (f32, f32, f32, f32)) {
    let radius = height / 2.;
    if length <= 0. { return (None, (0., 0., 0., 0.)); }
    if length >= radius { return (Some(radius), (radius, 0., length - radius, height)); }
    let half = (radius * radius - (radius - length) * (radius - length)).sqrt();
    (None, (0., radius - half, length, half * 2.))
}
fn roster_of(game: &Game) -> Vec<LampHero> { lamp_hero_roster(&game.session.progress, false).unwrap_or_default() }
impl LampUi {
    pub fn modal_open(&self) -> bool { self.open || self.upgrade_open }
    /// Per frame: expires the CP feedback and runs the Bag progress bar. `visible`: the combat
    /// screen shows with nothing over the bag icon.
    pub fn frame(&mut self, game: &mut Game, visible: bool, dt: f32) {
        let now = game.economy.time();
        self.feedbacks.retain(|f| f.2 > now);
        if self.disposal_waiting && self.feedbacks.is_empty() { self.disposal_waiting = false; if self.open { self.review_disposal(game); } }
        let shown = visible && !self.modal_open();
        // Items going into the bag: one bounce and a splash of sparks in the item's colour.
        for color in std::mem::take(&mut self.orbs.arrived) { self.bounce = BOUNCE_SECONDS; self.splash_from_bag(color); }
        self.bounce = (self.bounce - dt).max(0.);
        for spark in &mut self.splash { spark.age += dt; spark.pos += spark.vel * dt; spark.vel.y += 160. * dt; }
        self.splash.retain(|spark| spark.age < spark.life);
        // Agitated while items wait to be processed, and only where the player can see it.
        let waiting = game.economy.data().is_some_and(|d| (d.stored_count() - self.orbs.flying() as f64) > 0. || d.review_hold().is_some());
        self.agitated = if waiting && shown && !self.bar.active() { self.agitated + dt } else { 0. };
        if let Some(error) = self.bar.update(&mut game.economy, &mut game.session, dt, shown) { self.notice = error; }
        // Only while the ceremony is actually moving: a paused clock or a covered bag icon
        // must never leave the game locked.
        self.locked = shown && dt > 0. && self.bar.active();
    }
    /// Read-only probe for browser checks: items shown on the bag (stored minus those still
    /// flying), the agitated clock, and seconds left of the bounce.
    pub fn bag_probe(&self, game: &Game) -> (f64, f64, f64) {
        (game.economy.data().map_or(0., |d| (d.stored_count() - self.orbs.flying() as f64).max(0.)), self.agitated as f64, self.bounce as f64)
    }
    /// A few round sparks thrown up and out of the bag, tinted like the item that went in.
    fn splash_from_bag(&mut self, color: Color) {
        let mut seed = self.splash_seed.wrapping_add(0x9e37_79b9);
        let mut unit = || { seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223); (seed >> 8) as f32 / 16_777_216. };
        for i in 0..SPLASH_SPARKS {
            let angle = -std::f32::consts::FRAC_PI_2 + (unit() - 0.5) * 2.4;
            let speed = 45. + 55. * unit();
            let tint = if i % 3 == 0 { 0xffffff } else { ((color.r * 255.) as u32) << 16 | ((color.g * 255.) as u32) << 8 | (color.b * 255.) as u32 };
            self.splash.push(Spark { pos: vec2(BAG_CX + (unit() - 0.5) * BAG_W * 0.5, BAG_CY - BAG_H * 0.2), vel: vec2(angle.cos(), angle.sin()) * speed, radius: 1. + 1.8 * unit(), age: 0., life: 0.3 + 0.3 * unit(), tint });
        }
        self.splash_seed = seed;
        if self.splash.len() > 60 { let extra = self.splash.len() - 60; self.splash.drain(..extra); }
    }
    /// Dev Tools: play the Cascade Fill ceremony now with whatever progress the save holds.
    pub fn dev_ceremony(&mut self) { self.bar.request(); }
    /// The Bag progress ceremony is playing: ignore taps, page clicks and keys until it ends.
    pub fn locks_input(&self) -> bool { self.locked }
    /// The bag icon: opens the equipment screen and shows stored / capacity. The count waits for
    /// orbs still flying, so it rises as they arrive.
    pub fn draw_bag(&mut self, assets: &Assets, game: &mut Game, hits: &mut Vec<Hit>) {
        self.hits.clear();
        let _ = hits;
        let trouble = game.economy.error.clone().or_else(|| self.orbs.notice.clone());
        if let Some(e) = &trouble { stroked(e, 4., chrome::QUEST_TOP - 10., 10., rgb(0xfff1d1), rgb(0x502c25), Align::Left); }
        let Some(data) = game.economy.data() else { return };
        self.bar.draw();
        let pop = 1. + 0.22 * self.bar.celebration().map_or(0., |c| (std::f32::consts::PI * c).sin());
        // The bag hops and swells when an item goes in, and shakes while items wait in it.
        let (bounce, hop) = bag_bounce(self.bounce);
        let (tilt, swell) = bag_jiggle(self.agitated);
        let scale = pop * bounce * swell;
        if let Some(tex) = assets.ui.get("lamp-bag") {
            // object-fit: contain, then scaled about the bag's centre and tilted.
            let fit = (BAG_W / tex.width()).min(BAG_H / tex.height()) * scale;
            let (w, h) = (tex.width() * fit, tex.height() * fit);
            draw_texture_ex(tex, BAG_CX - w / 2., BAG_CY - hop - h / 2., WHITE, DrawTextureParams { dest_size: Some(vec2(w, h)), rotation: tilt, ..Default::default() });
        }
        for spark in &self.splash {
            let left = 1. - spark.age / spark.life;
            draw_circle(spark.pos.x, spark.pos.y, spark.radius * (0.4 + 0.6 * left), chrome::rgba(spark.tint, left));
        }
        let capacity = data.capacity();
        let stored = (data.stored_count() - self.orbs.flying() as f64).max(0.);
        stroked(&format!("{}/{}", stored, capacity), BAG_CX, BAG_CY + BAG_H / 2. + 3., 9., WHITE, rgb(0x000000), Align::Center);
        self.hits.push(LHit { rect: Rect::new(BAG_CX - BAG_W / 2. - 4., BAG_CY - BAG_H / 2. - 4., BAG_W + 8., BAG_H + 16.), kind: LampHit::Bag });
    }
    /// Route a canvas tap on the bag icon. The windows are page elements.
    pub fn tap(&mut self, p: Vec2, game: &mut Game) -> bool {
        if self.modal_open() { return true; }
        let Some(hit) = self.hits.iter().rev().find(|h| h.rect.contains(p)).map(|h| h.kind.clone()) else { return false };
        self.act(hit, game);
        true
    }
    fn close(&mut self) { self.open = false; self.upgrade_open = false; self.upgrade_receipt = None; self.equipped.clear(); self.disposal_view = false; self.disposal_preview = None; self.disposal_waiting = false; self.notice.clear(); }
    /// The Bag holds nothing more to equip or dismantle: the Essence held since the last Cascade
    /// Fill (orbs dismantled at pickup, Essence drops, quest rewards) now fills the bar.
    fn settle(&mut self, game: &Game) {
        if game.economy.data().is_some_and(|d| d.stored_count() == 0. && d.review_hold().is_none() && d.lamp.essence > 0.) { self.bar.request(); }
    }
    /// A tap on the bag. Everything in it was an upgrade when it was picked up, so there is
    /// nothing to choose: Auto-Equip runs at once and the window shows what was equipped, with
    /// the CP floats rising, for as long as the player likes. With nothing to equip it opens on
    /// the dismantle screen. An empty Bag opens no window.
    fn open_bag(&mut self, game: &mut Game) {
        self.close();
        if let Err(e) = game.economy.sync(&mut game.session) { self.notice = e; }
        let Some(data) = game.economy.data().cloned() else { return };
        if data.stored_count() == 0. && data.review_hold().is_none() { self.settle(game); return; }
        self.open = true;
        if data.lamp.guide.unwrap_or(0.) as u32 & GUIDE_STORAGE == 0 { let _ = game.economy.mark_guide(&mut game.session, "storage"); }
        match game.economy.auto_equip(&mut game.session) {
            Ok(results) => {
                let until = game.economy.time() + 1800.;
                for r in results { self.feedbacks.push((r.hero_id, r.cp_change, until)); self.equipped.extend(r.items); }
            }
            Err(e) => self.notice = e,
        }
        // Nothing was equipped and nothing went wrong: only leftovers are stored.
        if self.equipped.is_empty() && self.notice.is_empty() { self.review_disposal(game); }
    }
    /// The dismantle screen never takes the window over while a CP float is still playing.
    fn review_disposal_after_floats(&mut self, game: &mut Game) {
        let now = game.economy.time();
        if self.feedbacks.iter().any(|f| f.2 > now) { self.disposal_waiting = true; } else { self.review_disposal(game); }
    }
    /// After Auto-Equip: the dismantle screen for what is left in the Bag, or, with nothing
    /// left, the window closes and the held Essence fills the bar.
    fn review_disposal(&mut self, game: &mut Game) {
        let Some(data) = game.economy.data().cloned() else { return };
        // Auto-Equip failed and upgrades remain: the window keeps showing them with the notice.
        if conveyor_review_candidates(&data, &roster_of(game)).iter().any(|c| c.best_gain > 0.) { return; }
        match game.economy.disposal_preview(&mut game.session, None) {
            Ok(p) if p.ids.is_empty() && data.lamp.salvage.count <= 0. => { self.close(); self.settle(game); }
            Ok(p) => { self.equipped.clear(); self.disposal_view = true; self.disposal_preview = Some(p); }
            Err(e) => { self.notice = e; }
        }
    }
    pub fn act(&mut self, kind: LampHit, game: &mut Game) {
        self.notice.clear();
        // Anything the player does replaces a dismantle screen that was waiting for a float.
        self.disposal_waiting = false;
        match kind {
            LampHit::Close => { self.close(); self.settle(game); }
            LampHit::Bag => self.open_bag(game),
            // The player is done looking at what was equipped.
            LampHit::Done => self.review_disposal_after_floats(game),
            LampHit::Upgrade(tier) => match game.economy.upgrade(&mut game.session, Some(tier)) { Ok(r) => self.upgrade_receipt = Some(r), Err(e) => self.notice = e },
            LampHit::Dismantle => {
                let Some(preview) = self.disposal_preview.clone() else { return };
                match game.economy.dismantle(&mut game.session, &preview) {
                    // The Essence shows on the Bag progress bar once the window is gone.
                    Ok(_) => { self.close(); self.bar.request(); }
                    Err(e) => self.notice = e,
                }
            }
        }
    }
    /// The cache / dismantle / Bag upgrade windows as page elements: main's `#lamp-overlay`
    /// tree (`lampEquipmentUI.mjs` render + `bagUpgradePresentation.mjs`), styled by
    /// `css/lamp.css` and `css/bag_upgrade.css`. Main's review window (choose a hero, Equip,
    /// send to disposal) and the cache's Equip / Auto-Equip buttons are not built, and the tiles
    /// are not buttons to press; the cache keeps one button, Done.
    pub fn view(&mut self, game: &mut Game, scale: f32) -> Option<Node<Act>> {
        if !self.modal_open() { return None; }
        let data = game.economy.data().cloned()?;
        let roster = roster_of(game);
        let candidates = conveyor_review_candidates(&data, &roster);
        let now = game.economy.time();
        let on = |kind: LampHit| Act::Lamp(kind);
        let view = if self.upgrade_receipt.is_some() { "upgrade-complete" } else if self.upgrade_open { "upgrade" } else if self.disposal_view { "dismantle" } else { "cache" };
        let label = match view { "upgrade-complete" => "Upgrade Complete", "upgrade" => "Bag upgrades", "dismantle" => "Confirm equipment disposal", _ => "Equipment cache" };
        let mut dialog = el("section").id("lamp-dialog").attr("role", "dialog").attr("aria-modal", "true").attr("tabindex", "-1").attr("data-view", view).label(label).on(Act::Stay);
        let notice = |dialog: &mut Node<Act>, text: &str| { if !text.is_empty() { dialog.push(el("p").class("lamp-modal-notice").attr("role", "status").t(text)); } };
        let tile = |item: &LampItem, upgrade: bool, disposal: Option<bool>| {
            let tier = rarity(&item.rarity);
            let mut node = el("button").class("lamp-tile").style(format!("--rarity:#{:06x}", tier.map_or(0xf3f3ee, |r| r.color))).attr("data-cp", format!("{}", lamp_gear_cp(item))).attr("data-id", item.instance_id.as_str())
                .label(format!("{}, {}, level {}", item.name, tier.map_or(item.rarity.as_str(), |r| r.label), item.level))
                .child(atlas(item, upgrade, true));
            if let Some(marked) = disposal { node = node.attr("data-disposal-selected", marked.to_string()); }
            node.push(el("small").t(format!("CP {}", format_compact_count(lamp_gear_cp(item)))));
            node
        };
        if self.upgrade_open {
            dialog.push(match &self.upgrade_receipt { Some(receipt) => bag_upgrade_complete(receipt), None => bag_upgrade(&data) });
            if self.upgrade_receipt.is_none() { dialog.push(el("p").class("bag-upgrade-disclaimer").t("Probabilities shown are rounded and may not add up to 100%.")); }
            notice(&mut dialog, &self.notice);
            dialog.push(el("button").class("game-modal-close bag-modal-close").attr("data-action", "close").label("Close bag modal").on(on(LampHit::Close)).child(el("span").attr("aria-hidden", "true").t("×")));
        } else {
            dialog.push(el("header").class("lamp-modal-header").child(el("span").t(if self.disposal_view { "" } else { "EQUIPMENT CACHE" }))
                .child(el("button").attr("data-action", "close").label("Close equipment cache").t("×").on(on(LampHit::Close))));
            if self.disposal_view {
                let preview = self.disposal_preview.clone().or_else(|| game.economy.disposal_preview(&mut game.session, None).ok());
                self.disposal_preview = preview.clone();
                let ids = preview.map(|p| p.ids).unwrap_or_default();
                dialog.push(el("div").class("lamp-disposal-body").child(el("div").class("lamp-queue").label("Disposal candidates").children(candidates.iter().map(|q| tile(&q.item, q.best_gain > 0., Some(ids.contains(&q.item.instance_id)))))));
                dialog.push(el("div").class("lamp-actions").child(el("button").class("primary").attr("data-action", "dismantle").flag("disabled", ids.is_empty() && data.lamp.salvage.count <= 0.).t("Dismantle all").on(on(LampHit::Dismantle))));
                notice(&mut dialog, &self.notice);
            } else {
                // The heroes with their CP (the floats rise from these portraits) and what
                // Auto-Equip just put on them; upgrades still stored appear only if it failed.
                let mut row = el("div").class("lamp-hero-row").label("Heroes");
                for h in &roster {
                    let name = h.definition.name;
                    let position = match name { "Fara" => "54% 7%", "Hondo" => "57% 7%", "Runa" => "50% 6%", _ => "53% 6%" };
                    let mut portrait = el("button").flag("disabled", true).class("lamp-hero lamp-portrait").attr("data-id", h.instance_key.as_str()).label(name)
                        .style(format!("--portrait-position:{position}"))
                        .child(el("img").attr("decoding", "sync").attr("src", css::asset(&format!("images/{name}.png"))).attr("alt", ""))
                        .child(el("span").class("lamp-hero-current-cp").child(el("span").t("CP")).t(" ").child(el("b").t(format!("{}", lamp_hero_cp(&data, h)))));
                    // showEquipFeedback: "CP +n" for 1.8 s. It is a child of its hero's portrait
                    // (owner 2026-11-05, ORKA-63bf.38), so it starts on that hero wherever the
                    // window puts the row, and rises from there.
                    for (_, change, _) in self.feedbacks.iter().filter(|f| f.0 == h.instance_key && f.2 > now) {
                        portrait.push(el("div").class(if *change > 0. { "lamp-cp-feedback positive" } else if *change < 0. { "lamp-cp-feedback negative" } else { "lamp-cp-feedback neutral" }).attr("role", "status").attr("data-hero", h.instance_key.as_str())
                            .style("width:48px;left:50%;top:calc(50% - 21px)").t(format!("CP {}{change}", if *change > 0. { "+" } else { "" })));
                    }
                    row.push(portrait);
                }
                dialog.push(row);
                dialog.push(el("p").t(format!("{} / {} stored", data.stored_count(), data.capacity())));
                dialog.push(el("div").class("lamp-queue").label("Equipped just now")
                    .children(self.equipped.iter().map(|item| tile(item, true, None)))
                    .children(candidates.iter().filter(|q| q.best_gain > 0.).map(|q| tile(&q.item, true, None))));
                // The only way forward is the player's: nothing here advances on a timer.
                dialog.push(el("div").class("lamp-actions").child(el("button").class("primary").attr("data-action", "done").t("Done").on(on(LampHit::Done))));
                notice(&mut dialog, &self.notice);
            }
        }
        // The overlay is the frame rectangle; a cache window stops above the nav.
        let height = if self.upgrade_open { 640. } else { 580. } * scale;
        let overlay = el("div").key("lamp").id("lamp-overlay").attr("data-boss-fallback", "false").style(format!("height:{height:.2}px;--bag-scale:{scale:.4};--modal-close-scale:{scale:.4};--boss-fallback-reserve:0px")).on(on(LampHit::Close)).child(dialog);
        Some(overlay)
    }
}
/// `atlas(item)`: the gear sprite cell, vertically centred like main's re-centred atlas.
pub fn atlas(item: &LampItem, upgrade: bool, labels: bool) -> Node<Act> {
    let mut art = el("span").class("lamp-art ").attr("aria-hidden", "true").style(art_style(item.art));
    if labels { art.push(el("span").class("lamp-level").t(format!("Lv.{}", item.level))); }
    if upgrade { art.push(el("span").class("lamp-review-arrow").child(el("span").class("lamp-cp-direction up"))); }
    art
}
thread_local! { static GEAR_CELLS: std::cell::Cell<[(f32, f32); 9]> = const { std::cell::Cell::new([(0., 50.); 9]) }; }
/// Per atlas cell: how far (in cell heights) the visible piece sits above the cell centre, and
/// its midpoint in percent. Main measures the same from the atlas pixels at boot.
pub fn set_gear_cells(cells: [(f32, f32); 9]) { GEAR_CELLS.with(|c| c.set(cells)); }
pub fn art_style(art: u32) -> String {
    let (offset, midpoint) = GEAR_CELLS.with(|c| c.get())[(art % 9) as usize];
    format!("--col:{};--row:{:.4};--gear-midpoint:{midpoint:.3}%", art % 3, (art / 3) as f32 - offset)
}
/// `renderBagUpgrade`.
fn bag_upgrade(data: &LampEconomy) -> Node<Act> {
    let level = data.lamp.capacity_tier + 1;
    let tier = capacity_tier(data.lamp.capacity_tier);
    let next = (data.lamp.capacity_tier as usize + 1 < LAMP_LEVELS).then(|| capacity_tier(data.lamp.capacity_tier + 1));
    let progress = data.upgrade_progress();
    let rate = |n: f64| format!("{:.1}%", (n * 10.).ceil() / 10.);
    let exact = |n: f64| super::model::format_number(n);
    let weight = |t: &CapacityTier, key: &str| t.rarity_weights.iter().find(|(k, _)| *k == key).map_or(0., |(_, v)| *v);
    let arrow = || el("span").class("bag-comparison-arrow").attr("aria-hidden", "true");
    let total = if progress.max { "MAX".to_string() } else { format!("({}/{})", format_compact_count(progress.current), format_compact_count(progress.required.unwrap_or(0.))) };
    let rows = RARITIES.iter().map(|r| el("tr").style(format!("--bag-pill:#{:06x}", r.color))
        .child(el("th").attr("scope", "row").t(r.label)).child(el("td").t(rate(weight(&tier, r.key))))
        .child(el("td").class("bag-odds-arrow").attr("aria-hidden", "true").child(el("span").class("bag-comparison-arrow")))
        .child(el("td").t(next.as_ref().map_or("—".to_string(), |n| rate(weight(n, r.key))))));
    let can = !progress.max && progress.required.is_some_and(|r| progress.current >= r);
    let required = progress.required.unwrap_or(1.);
    el("section").class("bag-upgrade-panel")
        .child(el("header").class("bag-window-header").t(format!("Bag Upgrade Lv.{level}")))
        .child(el("div").class("bag-upgrade-main")
            .child(el("div").class("bag-level-transition")
                .child(el("span").class("bag-tier-emblem").child(el("img").attr("src", css::asset("images/ui/bag-tier-medallion.png")).attr("alt", "")))
                .child(el("b").t(format!("Lv. {level}"))).child(arrow()).child(el("b").t(next.as_ref().map_or("MAX".to_string(), |_| format!("Lv. {}", level + 1)))))
            .child(el("div").class("lamp-odds-scroll").child(el("table").class("lamp-odds").label("Current and next equipment drop rates")
                .child(el("colgroup").child(el("col").style("width:38%")).child(el("col").style("width:27.5%")).child(el("col").style("width:7%")).child(el("col").style("width:27.5%")))
                .child(el("thead").class("bag-sr-only").child(el("tr").child(el("th").t("Quality")).child(el("th").t("Current")).child(el("th")).child(el("th").t("Next"))))
                .child(el("tbody").children(rows))))
            .child(el("section").class("bag-upgrade-controls")
                .child(el("p").class("bag-next-capacity").t(format!("Bag Capacity {} {}", exact(tier.capacity), next.as_ref().map_or("(MAX)".to_string(), |n| format!("> {}", exact(n.capacity))))))
                .child(el("div").class("bag-upgrade-actions")
                    .child(el("div").class("bag-progress-group")
                        .child(el("span").class(if level >= 100 { "bag-progress-level long" } else { "bag-progress-level " }).child(el("b").t(level.to_string())))
                        .child(el("div").class("bag-upgrade-progress").attr("role", "progressbar").label("Bag progress").attr("aria-valuemin", "0").attr("aria-valuenow", format!("{}", if progress.max { 1. } else { progress.current.min(required) })).attr("aria-valuemax", format!("{required}"))
                            .attr("title", if progress.max { "MAX".to_string() } else { format!("{} / {}", exact(progress.current), exact(required)) })
                            .child(el("span").style(format!("width:{}%", progress.fraction * 100.))).child(el("b").t(total)))
                        .child(el("span").class(if level >= 99 { "bag-progress-level next long" } else { "bag-progress-level next " }).child(el("b").t(next.as_ref().map_or("MAX".to_string(), |_| (level + 1).to_string())))))
                    .child(el("button").class("bag-level-up").attr("data-action", "upgrade").attr("data-tier", data.lamp.capacity_tier.to_string()).flag("disabled", !can).t(if progress.max { "MAX" } else { "Level Up" }).on(Act::Lamp(LampHit::Upgrade(data.lamp.capacity_tier)))))))
}
/// `renderBagUpgradeComplete`.
fn bag_upgrade_complete(receipt: &UpgradeReceipt) -> Node<Act> {
    el("section").class("bag-upgrade-complete").label("Bag upgrade reward")
        .child(el("h2").class("bag-reward-banner").t("Upgrade Complete"))
        .child(el("div").class("bag-reward-art").child(el("img").attr("src", css::asset("images/lamp/equipment-bag.png")).attr("alt", "Bag")))
        .child(el("p").class("bag-reward-level").t(format!("Bag Lv. {}", receipt.level_after)))
        .child(el("p").class("bag-reward-capacity").t(format!("Bag Capacity {} > {}", super::model::format_number(receipt.capacity_before), super::model::format_number(receipt.capacity_after))))
}

#[cfg(test)]
mod tests {
    use super::*;
    /// Runs the bar at 60 fps until it is hidden again; returns the fill counts it celebrated.
    fn play(bar: &mut BagBar, economy: &mut wf_host::equipment::EquipmentStorage, run: &mut crate::testing::HostRun) -> (Vec<u32>, Vec<BarPhase>) {
        let (mut levels, mut phases) = (Vec::new(), vec![bar.phase]);
        for _ in 0..3000 {
            let fills = economy.data().unwrap().bag_fills();
            assert!(bar.update(economy, &mut run.session, 1. / 60., true).is_none());
            let now = economy.data().unwrap().bag_fills();
            if now != fills { assert_eq!(now, fills + 1.); assert_eq!(bar.fraction, 0., "the bar resets after a full bar"); levels.push(now as u32); }
            if phases.last() != Some(&bar.phase) { phases.push(bar.phase); }
            if bar.phase == BarPhase::Hidden && phases.len() > 1 { break; }
        }
        (levels, phases)
    }
    #[test]
    fn a_completed_dismantle_slides_the_bar_out_and_successive_full_bars_carry_the_overflow() {
        use BarPhase::*;
        let mut run = crate::testing::HostRun::new(1);
        let mut economy = super::super::orbs::tests::economy(&mut run);
        let mut bar = BagBar::default();
        assert!(bar.update(&mut economy, &mut run.session, 1. / 60., true).is_none());
        assert_eq!((bar.phase, bar.reveal()), (Hidden, 0.));
        // Essence alone (a quest reward, combat-time points) never brings the bar out.
        economy.award_combat_essence(&mut run.session, "test:small", 20.).unwrap();
        for _ in 0..300 { bar.update(&mut economy, &mut run.session, 1. / 60., true); }
        assert_eq!((bar.phase, bar.fraction), (Hidden, 0.));
        // A dismantle completed: out, fill from the last shown value to the saved one, hold, in.
        bar.request();
        let (levels, phases) = play(&mut bar, &mut economy, &mut run);
        assert!(levels.is_empty());
        assert_eq!(phases, [Hidden, SlideOut, Beat, Fill, Hold, SlideIn, Hidden]);
        assert_eq!(bar.fraction, 0.4);
        // The count is satisfied: the leftover Essence now lives in the bar, the counter reads zero.
        assert_eq!((economy.data().unwrap().lamp.essence, economy.data().unwrap().kill_points()), (0., 20.));
        // 255 more Essence completes three bars (50, 75, 100) without closing the bar.
        economy.award_combat_essence(&mut run.session, "test:large", 255.).unwrap();
        bar.request();
        let (levels, phases) = play(&mut bar, &mut economy, &mut run);
        assert_eq!(levels, [1, 2, 3]);
        assert_eq!(phases, [Hidden, SlideOut, Beat, Fill, Celebrate, Beat, Fill, Celebrate, Beat, Fill, Celebrate, Beat, Fill, Hold, SlideIn, Hidden]);
        let data = economy.data().unwrap();
        // Bag levels are frozen: the fills are banked, the level and capacity stay.
        assert_eq!((data.bag_fills(), data.lamp.capacity_tier, data.lamp.essence, data.kill_points(), data.capacity()), (3., 0, 0., 50., 20.));
        assert!((bar.fraction - 50. / 125.).abs() < 1e-6);
    }
    #[test]
    fn the_hold_lasts_four_tenths_of_a_second_from_the_last_fill_and_the_slide_out_throws_sparks() {
        let mut run = crate::testing::HostRun::new(1);
        let mut economy = super::super::orbs::tests::economy(&mut run);
        let mut bar = BagBar::default();
        bar.update(&mut economy, &mut run.session, 1. / 60., true);
        economy.award_combat_essence(&mut run.session, "test:two", 140.).unwrap();
        bar.request();
        // Time each phase at 1 ms steps.
        let (mut clock, mut entered) = (0.0f32, Vec::new());
        let mut last = bar.phase;
        let mut sparks_at_beat = None;
        for _ in 0..20000 {
            bar.update(&mut economy, &mut run.session, 0.001, true);
            clock += 0.001;
            if bar.phase != last {
                // The burst appears with the first beat only (the slide-out's end), in several sizes.
                if bar.phase == BarPhase::Beat && sparks_at_beat.is_none() { sparks_at_beat = Some(bar.sparks.clone()); }
                entered.push((bar.phase, clock)); last = bar.phase;
            }
            if bar.phase == BarPhase::Hidden && !entered.is_empty() { break; }
        }
        let at = |phase: BarPhase| entered.iter().rev().find(|(p, _)| *p == phase).map(|(_, t)| *t).unwrap();
        // Two full bars (50, 75) then the 15/100 overflow; the hold starts when that last fill ends.
        assert_eq!(entered.iter().filter(|(p, _)| *p == BarPhase::Celebrate).count(), 2);
        assert_eq!(entered.iter().filter(|(p, _)| *p == BarPhase::Hold).count(), 1, "one hold, after everything");
        let hold = at(BarPhase::SlideIn) - at(BarPhase::Hold);
        assert!((hold - 0.4).abs() < 0.005, "hold lasted {hold} s");
        let sparks = sparks_at_beat.unwrap();
        assert_eq!(sparks.len(), SPARKS);
        let (small, large) = sparks.iter().fold((f32::MAX, 0.0f32), |(lo, hi), s| (lo.min(s.radius), hi.max(s.radius)));
        assert!(small >= 1. && large <= 3.2 && large - small > 0.8, "small round sparks of various sizes: {small}..{large}");
        assert!(sparks.iter().all(|s| s.vel.x < 0.), "they fly away from the bag");
        assert!(bar.sparks.is_empty(), "all gone by the end of the ceremony");
        assert!(at(BarPhase::Hold) > entered.iter().rev().find(|(p, _)| *p == BarPhase::Celebrate).unwrap().1, "the hold starts after the final full bar and fill");
        assert_eq!((economy.data().unwrap().bag_fills(), economy.data().unwrap().lamp.capacity_tier), (2., 0));
    }
    /// Owner 2026-11-05: never right-to-left. The bar comes out empty however much it showed
    /// last time, and its fill only ever grows, except the reset to empty after a full bar.
    #[test]
    fn the_bar_always_comes_out_empty_and_its_fill_only_grows() {
        let mut run = crate::testing::HostRun::new(1);
        let mut economy = super::super::orbs::tests::economy(&mut run);
        let mut bar = BagBar::default();
        for (round, essence) in [40., 90., 10.].into_iter().enumerate() {
            economy.award_combat_essence(&mut run.session, &format!("test:round{round}"), essence).unwrap();
            bar.request();
            let (mut last, mut before, mut resets, mut peak) = (bar.phase, 0.0f32, 0, 0.0f32);
            for _ in 0..20000 {
                bar.update(&mut economy, &mut run.session, 0.001, true);
                if bar.phase != last && last == BarPhase::Hidden { assert_eq!(bar.fraction, 0., "round {round}: the bar slides out empty"); before = 0.; }
                if matches!(bar.phase, BarPhase::SlideOut) { assert_eq!(bar.fraction, 0., "round {round}: nothing fills while it slides out"); }
                if bar.fraction < before { assert_eq!((bar.fraction, last), (0., BarPhase::Celebrate), "round {round}: the fill went backwards"); resets += 1; }
                before = bar.fraction; peak = peak.max(bar.fraction); last = bar.phase;
                if bar.phase == BarPhase::Hidden { break; }
            }
            let data = economy.data().unwrap();
            assert_eq!(data.lamp.essence, 0., "round {round}: the Essence is all in the bar");
            // 40 of 50; then 130 fills the 50 and the 75 bars and leaves 5; then 15 of 100.
            assert_eq!(resets, [0, 2, 0][round], "round {round}");
            assert!((bar.fraction as f64 - data.fill_progress().fraction).abs() < 1e-6 && peak > 0.);
        }
    }
    /// Owner 2026-11-05 (ORKA-63bf.46): an item going in makes the bag hop and swell once; items
    /// waiting in it make it shake briefly at intervals.
    #[test]
    fn the_bag_bounces_once_per_item_and_jiggles_at_intervals_while_items_wait() {
        assert_eq!((bag_bounce(0.), bag_bounce(BOUNCE_SECONDS)), ((1., 0.), (1., 0.)), "at rest before and after");
        let (peak, hop) = bag_bounce(BOUNCE_SECONDS / 2.);
        assert!((peak - 1.24).abs() < 1e-4 && (hop - 3.).abs() < 1e-4, "swells by a quarter and hops 3 px at the middle");
        // Idle bag: never moves.
        assert_eq!(bag_jiggle(0.), (0., 1.));
        // Waiting bag: shakes both ways during the first 0.55 s of every 2.2 s, then rests.
        let shake: Vec<f32> = (1..55).map(|i| bag_jiggle(i as f32 * 0.01).0).collect();
        let (lo, hi) = shake.iter().fold((0.0f32, 0.0f32), |(lo, hi), a| (lo.min(*a), hi.max(*a)));
        assert!(hi > 0.1 && lo < -0.1 && hi < 0.17, "about nine degrees each way: {lo}..{hi}");
        assert!(shake.iter().rev().take(5).all(|a| a.abs() < 0.03), "it settles before it rests");
        for rest in [0.56, 1., 2.19] { assert_eq!(bag_jiggle(rest), (0., 1.)); }
        assert!(bag_jiggle(JIGGLE_PERIOD + 0.1).0.abs() > 0.05, "and shakes again in the next period");
        // The splash: a handful of sparks leaving the bag upwards, gone within 0.6 s.
        let mut ui = LampUi::default();
        ui.splash_from_bag(Color::new(0.2, 0.6, 1., 1.));
        assert_eq!(ui.splash.len(), SPLASH_SPARKS);
        assert!(ui.splash.iter().all(|s| s.vel.y < 0. && s.life <= 0.6 && (s.pos.x - BAG_CX).abs() <= BAG_W / 2.));
        for _ in 0..40 { ui.splash_from_bag(WHITE); }
        assert!(ui.splash.len() <= 60, "a pile of arrivals stays bounded");
    }
    /// Owner 2026-11-05 (ORKA-63bf.44): the fill's leading edge is a straight line at its length.
    #[test]
    fn the_blue_fill_ends_in_a_straight_edge_exactly_at_its_length() {
        let height = BAR_H - 2.;
        for length in [3.5, 4., 10., 21.6, 43.2] {
            let (cap, (x, y, w, h)) = fill_shape(length, height);
            assert_eq!(cap, Some(height / 2.), "the far end keeps the track's round cap");
            assert_eq!((x + w, y, h), (length, 0., height), "a full-height straight edge at {length}");
        }
        // Shorter than the cap: still a straight edge at its length, as tall as the cap is there.
        let (cap, (x, y, w, h)) = fill_shape(1., height);
        assert!(cap.is_none() && x == 0. && w == 1. && h > 0. && h < height && (y + h / 2. - height / 2.).abs() < 1e-5);
        assert_eq!(fill_shape(0., height), (None, (0., 0., 0., 0.)), "nothing at zero");
        // Any progress shows: the old capsule drew nothing below 7 px (16% of the bar).
        assert!(fill_shape(0.5, height).1 .2 > 0.);
    }
    /// Owner 2026-11-05: 40% shorter, the right (bag-side) edge anchored.
    #[test]
    fn the_bar_is_forty_percent_shorter_and_still_ends_at_the_bag() {
        assert!((BAR_REACH - 55.2).abs() < 1e-4 && (BAR_W - (55.2 + BAR_TUCK)).abs() < 1e-4);
        assert_eq!(BAR_RIGHT, BAG_CX - 6. + BAR_TUCK, "the bag-side end has not moved");
        let was_left = BAR_RIGHT - (92. + BAR_TUCK);
        assert!((BAR_RIGHT - BAR_W - was_left - 36.8).abs() < 1e-3, "the far end comes 36.8 px closer to the bag");
    }
    #[test]
    fn every_fill_waits_half_a_second_and_is_slow_enough_to_follow() {
        let mut run = crate::testing::HostRun::new(1);
        let mut economy = super::super::orbs::tests::economy(&mut run);
        let mut bar = BagBar::default();
        bar.update(&mut economy, &mut run.session, 1. / 60., true);
        assert!(!bar.active());
        // 55 Essence: a whole first bar (50), then 5 of 75 on the second.
        economy.award_combat_essence(&mut run.session, "test:pace", 55.).unwrap();
        bar.request();
        let (mut clock, mut entered, mut last) = (0.0f32, Vec::new(), bar.phase);
        for _ in 0..20000 {
            bar.update(&mut economy, &mut run.session, 0.001, true);
            clock += 0.001;
            if bar.phase != last { entered.push((bar.phase, clock)); last = bar.phase; }
            assert_eq!(bar.active(), bar.phase != BarPhase::Hidden);
            if bar.phase == BarPhase::Hidden { break; }
        }
        use BarPhase::*;
        assert_eq!(entered.iter().map(|(p, _)| *p).collect::<Vec<_>>(), [SlideOut, Beat, Fill, Celebrate, Beat, Fill, Hold, SlideIn, Hidden]);
        let span = |i: usize| entered[i + 1].1 - entered[i].1;
        assert!((span(1) - 0.5).abs() < 0.005, "the first beat lasted {} s", span(1));
        assert!((span(2) - 1.2).abs() < 0.005, "a whole bar filled in {} s", span(2));
        assert!((span(4) - 0.5).abs() < 0.005, "the beat after the full bar lasted {} s", span(4));
        assert!((span(5) - 0.6).abs() < 0.005, "a small gain still took {} s", span(5));
        assert!(!bar.active(), "the ceremony is over once the bar is back in the bag");
    }
    #[test]
    fn the_bar_waits_while_a_window_covers_the_bag() {
        let mut run = crate::testing::HostRun::new(1);
        let mut economy = super::super::orbs::tests::economy(&mut run);
        let mut bar = BagBar::default();
        bar.update(&mut economy, &mut run.session, 1. / 60., true);
        economy.award_combat_essence(&mut run.session, "test:hidden", 50.).unwrap();
        bar.request();
        for _ in 0..600 { bar.update(&mut economy, &mut run.session, 1. / 60., false); }
        assert_eq!((bar.phase, economy.data().unwrap().bag_fills()), (BarPhase::Hidden, 0.), "no full bar is settled unseen");
        let (levels, _) = play(&mut bar, &mut economy, &mut run);
        assert_eq!(levels, [1]);
        for _ in 0..120 { bar.update(&mut economy, &mut run.session, 1. / 60., true); }
        assert_eq!(bar.phase, BarPhase::Hidden);
    }
}
