//! The Bag: its icon beside the quest tracker (collection and capacity indicator), the Bag
//! progress bar that slides out of it, and the equipment windows (`lampEquipmentUI.mjs`,
//! `bagUpgradePresentation.mjs`). Equipment arrives as battlefield orbs (`ui/orbs.rs`); the
//! rules and saves are `wf_host::equipment` / `wf_meta::lamp`.
use super::chrome::{self, image, label, rgb, rgba, stroked, Align, Hit};
use super::dom::{el, Node};
use super::orbs::OrbField;
use super::{css, Act};
use crate::assets::Assets;
use crate::game::Game;
use macroquad::prelude::*;
use wf_host::equipment::lamp_hero_roster;
use wf_meta::equipment::{format_compact_count, rarity, slot_label, RARITIES};
use wf_meta::lamp::*;

#[derive(Clone, Debug, PartialEq)]
pub enum LampHit { Bag, Close, Hero(String), Queue(String), Equip, AutoEquip, Disposal, Cache, QueueDisposal, Dismantle, Upgrade(u32) }
#[derive(Clone, Debug)]
struct LHit { rect: Rect, kind: LampHit }
#[derive(Default)]
pub struct LampUi {
    pub open: bool,
    pub upgrade_open: bool,
    selected_item: Option<String>,
    selected_hero: Option<String>,
    disposal_view: bool,
    disposal_preview: Option<DisposalPreview>,
    upgrade_receipt: Option<UpgradeReceipt>,
    notice: String,
    feedbacks: Vec<(String, f64, f64)>,
    hits: Vec<LHit>,
    pub orbs: OrbField,
    bar: BagBar,
    /// The Cascade Fill ceremony advanced this frame: taps, page clicks and keys are ignored.
    locked: bool,
}
// The bag icon keeps the x centre it had in the old strip, at half its size, centred on the
// quest tracker (the 52 px objective box).
const BAG_CX: f32 = 360. * 0.7652 + 360. * 0.228 / 2.;
const BAG_CY: f32 = chrome::QUEST_TOP + 52. / 2.;
const BAG_W: f32 = 360. * 0.228 * 0.5;
const BAG_H: f32 = 92. * 0.83 * 0.9745 * 0.5;
// The Bag progress bar: slides out to the left from behind the icon.
const BAR_W: f32 = 92.; const BAR_H: f32 = 12.;
const SLIDE_SECONDS: f32 = 0.22;
/// The bar rests this long before each fill starts (once it is out, and again after every
/// upgrade), so the player sees there is something to watch.
const BEAT_SECONDS: f32 = 0.5;
/// A whole bar fills in this long; a smaller gain takes its share, but never less than
/// `MIN_FILL_SECONDS`.
const FILL_SECONDS: f32 = 1.2;
const MIN_FILL_SECONDS: f32 = 0.6;
const CELEBRATE_SECONDS: f32 = 0.3;
/// The finished display stays this long after the last fill or upgrade before sliding back.
const HOLD_SECONDS: f32 = 2.5;
#[derive(Clone, Copy, Debug, Default, PartialEq)]
enum BarPhase { #[default] Hidden, SlideOut, Beat, Fill, Celebrate, Hold, SlideIn }
/// The **Cascade Fill** ceremony (owner's name for this kind of progress presentation, 2026-11-05):
/// slide out, beat, fill, and for every full bar a burst, a beat and a refill with the overflow,
/// then a hold and the slide back; input is locked while it plays. It shows the saved progress,
/// never its own: every level is applied through `EquipmentStorage::upgrade` when the fill
/// reaches the end of the bar, and the next bar starts from whatever the save holds after that.
#[derive(Default)]
struct BagBar { phase: BarPhase, t: f32, fraction: f32, synced: bool, wanted: bool,
    /// Bar fractions per second of the fill in progress.
    rate: f32 }
impl BagBar {
    /// The ceremony is on screen.
    fn active(&self) -> bool { self.phase != BarPhase::Hidden }
    fn start_fill(&mut self, target: f32) {
        let gap = (target - self.fraction).max(0.);
        self.rate = if gap > 0. { gap / (FILL_SECONDS * gap).max(MIN_FILL_SECONDS) } else { 1. / FILL_SECONDS };
        self.phase = BarPhase::Fill;
    }
    /// `visible`: the bag icon is on screen and nothing covers it.
    fn update(&mut self, economy: &mut wf_host::equipment::EquipmentStorage, session: &mut wf_host::session::Session, dt: f32, visible: bool) -> Option<String> {
        let data = economy.data()?;
        let progress = data.upgrade_progress();
        let tier = data.lamp.capacity_tier;
        let ready = !progress.max && progress.required.is_some_and(|r| progress.current >= r);
        let target = if ready { 1. } else { progress.fraction as f32 };
        if !self.synced { self.synced = true; self.fraction = progress.fraction as f32; }
        if progress.max { self.wanted = false; }
        if !visible { return None; }
        match self.phase {
            BarPhase::Hidden => {
                // Only a completed dismantle brings the bar out (`request`); it then shows
                // everything earned since it was last out.
                if self.wanted { self.wanted = false; self.phase = BarPhase::SlideOut; self.t = 0.; }
            }
            BarPhase::SlideOut => { self.t += dt; if self.t >= SLIDE_SECONDS { self.phase = BarPhase::Beat; self.t = 0.; } }
            BarPhase::Beat => { self.wanted = false; self.t += dt; if self.t >= BEAT_SECONDS { self.start_fill(target); } }
            BarPhase::Fill => {
                self.wanted = false;
                self.fraction = if self.fraction > target { target } else { (self.fraction + dt * self.rate).min(target) };
                if self.fraction >= target { self.phase = if ready { BarPhase::Celebrate } else { BarPhase::Hold }; self.t = 0.; }
            }
            BarPhase::Celebrate => {
                self.t += dt;
                if self.t >= CELEBRATE_SECONDS {
                    match economy.upgrade(session, Some(tier)) {
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
    /// A dismantle has completed: show the progress once the bag icon is uncovered.
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
        let reveal = self.reveal();
        if reveal <= 0. { return; }
        let right = BAG_CX - 6.;
        let width = BAR_W * reveal;
        let (x, y) = (right - width, BAG_CY - BAR_H / 2.);
        let flash = self.celebration().map_or(0., |c| 1. - c);
        chrome::capsule(x - 1.5, y - 1.5, width + 3., BAR_H + 3., rgb(0xb777d8));
        chrome::capsule(x, y, width, BAR_H, rgb(0x242130));
        let fill = (width - 2.) * self.fraction.clamp(0., 1.);
        if fill > BAR_H - 2. { chrome::capsule(x + 1., y + 1., fill, BAR_H - 2., chrome::mix(rgb(chrome::TIMER_BLUE), WHITE, flash)); }
    }
}
fn roster_of(game: &Game) -> Vec<LampHero> { lamp_hero_roster(&game.session.progress, false).unwrap_or_default() }
impl LampUi {
    pub fn modal_open(&self) -> bool { self.open || self.upgrade_open }
    fn item_of(data: &LampEconomy, id: &str) -> Option<LampItem> { data.item(id).cloned().or_else(|| data.review_hold().map(|h| h.item).filter(|i| i.instance_id == id)) }
    /// Per frame: expires the CP feedback and runs the Bag progress bar. `visible`: the combat
    /// screen shows with nothing over the bag icon.
    pub fn frame(&mut self, game: &mut Game, visible: bool, dt: f32) {
        let now = game.economy.time();
        self.feedbacks.retain(|f| f.2 > now);
        let shown = visible && !self.modal_open();
        if let Some(error) = self.bar.update(&mut game.economy, &mut game.session, dt, shown) { self.notice = error; }
        // Only while the ceremony is actually moving: a paused clock or a covered bag icon
        // must never leave the game locked.
        self.locked = shown && dt > 0. && self.bar.active();
    }
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
        if let Some(tex) = assets.ui.get("lamp-bag") { image(tex, BAG_CX - BAG_W * pop / 2., BAG_CY - BAG_H * pop / 2., BAG_W * pop, BAG_H * pop); }
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
    fn close(&mut self) { self.open = false; self.upgrade_open = false; self.upgrade_receipt = None; self.selected_item = None; self.selected_hero = None; self.disposal_view = false; self.disposal_preview = None; self.notice.clear(); }
    fn open_collection(&mut self, game: &mut Game, id: Option<String>, upgrades: bool) {
        if let Err(e) = game.economy.sync(&mut game.session) { self.notice = e; }
        let Some(data) = game.economy.data().cloned() else { return };
        if !upgrades && data.stored_count() == 0. && data.review_hold().is_none() { return; }
        self.open = true; self.upgrade_open = upgrades; self.upgrade_receipt = None; self.disposal_view = false; self.disposal_preview = None;
        self.selected_item = if upgrades { None } else { id }; self.selected_hero = None; self.notice.clear();
        if !upgrades && self.selected_item.is_none() && !conveyor_review_candidates(&data, &roster_of(game)).iter().any(|c| c.best_gain > 0.) { self.review_disposal(game); }
        let step = if upgrades { "preview" } else { "storage" };
        let bit = if upgrades { GUIDE_PREVIEW } else { GUIDE_STORAGE };
        if data.lamp.guide.unwrap_or(0.) as u32 & bit == 0 { let _ = game.economy.mark_guide(&mut game.session, step); }
    }
    fn review_disposal(&mut self, game: &mut Game) {
        let Some(data) = game.economy.data().cloned() else { return };
        let roster = roster_of(game);
        if conveyor_review_candidates(&data, &roster).iter().any(|c| c.best_gain > 0.) { self.selected_item = None; self.selected_hero = None; self.disposal_view = false; self.disposal_preview = None; self.notice.clear(); return; }
        self.selected_item = None; self.selected_hero = None; self.notice.clear();
        match game.economy.disposal_preview(&mut game.session, None) {
            Ok(p) => { self.disposal_view = !p.ids.is_empty() || data.lamp.salvage.count > 0.; self.disposal_preview = Some(p); if !self.disposal_view { self.close(); } }
            Err(e) => { self.notice = e; }
        }
    }
    pub fn act(&mut self, kind: LampHit, game: &mut Game) {
        self.notice.clear();
        match kind {
            LampHit::Close => self.close(),
            LampHit::Bag => self.open_collection(game, None, false),
            LampHit::Disposal => self.review_disposal(game),
            LampHit::QueueDisposal => {
                if let Some(id) = self.selected_item.clone() {
                    match game.economy.queue_disposal(&mut game.session, &id) {
                        Ok(()) => { self.selected_item = None; self.selected_hero = None; self.disposal_view = true; self.disposal_preview = game.economy.disposal_preview(&mut game.session, None).ok(); }
                        Err(e) => self.notice = e,
                    }
                }
            }
            LampHit::Hero(id) => {
                self.selected_hero = Some(id);
                if game.economy.data().is_some_and(|d| d.lamp.guide.unwrap_or(0.) as u32 & GUIDE_COMPARISON == 0) { let _ = game.economy.mark_guide(&mut game.session, "comparison"); }
            }
            LampHit::Cache => { self.selected_item = None; self.selected_hero = None; self.disposal_view = false; self.disposal_preview = None; }
            LampHit::Queue(id) => { self.selected_item = Some(id); self.selected_hero = None; }
            LampHit::Equip => {
                if let (Some(hero), Some(item)) = (self.selected_hero.clone(), self.selected_item.clone()) {
                    match game.economy.equip(&mut game.session, &hero, &item) { Ok(r) => { self.feedbacks.push((r.hero_id.clone(), r.cp_change, game.economy.time() + 1800.)); self.selected_item = None; self.selected_hero = None; } Err(e) => self.notice = e }
                }
            }
            LampHit::AutoEquip => {
                match game.economy.auto_equip(&mut game.session) {
                    Ok(results) => { let t = game.economy.time(); for r in results { self.feedbacks.push((r.hero_id, r.cp_change, t + 1800.)); } self.selected_item = None; self.selected_hero = None; self.review_disposal(game); }
                    Err(e) => self.notice = e,
                }
            }
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
    /// The cache / review / dismantle / Bag upgrade windows as page elements: main's
    /// `#lamp-overlay` tree (`lampEquipmentUI.mjs` render + `bagUpgradePresentation.mjs`),
    /// styled by `css/lamp.css` and `css/bag_upgrade.css`.
    pub fn view(&mut self, game: &mut Game, scale: f32) -> Option<Node<Act>> {
        if !self.modal_open() { return None; }
        let data = game.economy.data().cloned()?;
        let roster = roster_of(game);
        let candidates = conveyor_review_candidates(&data, &roster);
        let now = game.economy.time();
        let on = |kind: LampHit| Act::Lamp(kind);
        let candidate = self.selected_item.as_ref().and_then(|id| Self::item_of(&data, id));
        if candidate.is_none() { self.selected_item = None; self.selected_hero = None; }
        let view = if self.upgrade_receipt.is_some() { "upgrade-complete" } else if self.upgrade_open { "upgrade" } else if candidate.is_some() { "equip" } else if self.disposal_view { "dismantle" } else { "cache" };
        let label = match view { "upgrade-complete" => "Upgrade Complete", "upgrade" => "Bag upgrades", "equip" => "Choose a hero for lamp equipment", "dismantle" => "Confirm equipment disposal", _ => "Equipment cache" };
        let mut dialog = el("section").id("lamp-dialog").attr("role", "dialog").attr("aria-modal", "true").attr("tabindex", "-1").attr("data-view", view).label(label).on(Act::Stay);
        let notice = |dialog: &mut Node<Act>, text: &str| { if !text.is_empty() { dialog.push(el("p").class("lamp-modal-notice").attr("role", "status").t(text)); } };
        let tile = |c: &Candidate, art_only: bool, selected: bool, disposal: Option<bool>| {
            let item = &c.item;
            let tier = rarity(&item.rarity);
            let mut node = el("button").class("lamp-tile").style(format!("--rarity:#{:06x}", tier.map_or(0xf3f3ee, |r| r.color))).attr("data-action", "queue").attr("data-cp", format!("{}", lamp_gear_cp(item))).attr("data-id", item.instance_id.as_str())
                .attr("data-queue", c.queue).attr("data-best-gain", format!("{}", c.best_gain))
                .label(format!("Inspect {}, {}, level {}", item.name, tier.map_or(item.rarity.as_str(), |r| r.label), item.level))
                .on(on(LampHit::Queue(item.instance_id.clone())))
                .child(atlas(item, c.best_gain > 0., !art_only));
            if selected { node = node.attr("aria-current", "true"); }
            if let Some(marked) = disposal { node = node.attr("data-disposal-selected", marked.to_string()); }
            if !art_only { node.push(el("small").t(format!("CP {}", format_compact_count(lamp_gear_cp(item))))); }
            node
        };
        if self.upgrade_open {
            dialog.push(match &self.upgrade_receipt { Some(receipt) => bag_upgrade_complete(receipt), None => bag_upgrade(&data) });
            if self.upgrade_receipt.is_none() { dialog.push(el("p").class("bag-upgrade-disclaimer").t("Probabilities shown are rounded and may not add up to 100%.")); }
            notice(&mut dialog, &self.notice);
            dialog.push(el("button").class("game-modal-close bag-modal-close").attr("data-action", "close").label("Close bag modal").on(on(LampHit::Close)).child(el("span").attr("aria-hidden", "true").t("×")));
        } else {
            let any_useful = candidates.iter().any(|c| c.best_gain > 0.);
            let mut header = el("header").class("lamp-modal-header").child(el("span").t(if candidate.is_some() { "EQUIPMENT REVIEW" } else if self.disposal_view { "" } else { "EQUIPMENT CACHE" }));
            if !self.disposal_view { header.push(el("button").class("lamp-disposal-link").attr("data-action", "disposal").flag("disabled", any_useful).t("Done / Dismantle").on(on(LampHit::Disposal))); }
            header.push(el("button").attr("data-action", "close").label("Close equipment comparison").t("×").on(on(LampHit::Close)));
            dialog.push(header);
            if let (Some(hold), None, false) = (data.review_hold(), &candidate, self.disposal_view) { dialog.push(el("p").class("lamp-held").attr("role", "status").t(format!("Held: {}. Cache full — equip it or review disposal.", hold.item.name))); }
            let hero_row = |candidate: Option<&LampItem>, selected: Option<&String>| {
                let mut row = el("div").class("lamp-hero-row").label("Choose equipment recipient");
                for h in &roster {
                    let name = h.definition.name;
                    let gain = match candidate { Some(c) => lamp_item_cp_gain(&data, c, h), None => candidates.iter().map(|c| lamp_item_cp_gain(&data, &c.item, h)).fold(0., f64::max) };
                    let position = match name { "Fara" => "54% 7%", "Hondo" => "57% 7%", "Runa" => "50% 6%", _ => "53% 6%" };
                    let mut button = el("button").flag("disabled", candidate.is_none()).class("lamp-hero lamp-portrait").attr("data-action", "hero").attr("data-id", h.instance_key.as_str()).attr("data-cp-change", format!("{gain}"))
                        .attr("aria-pressed", (selected == Some(&h.instance_key)).to_string()).label(format!("Choose {name}")).attr("aria-description", format!("{name} CP change {}{gain}", if gain > 0. { "+" } else { "" }))
                        .style(format!("--portrait-position:{position}")).on(on(LampHit::Hero(h.instance_key.clone())))
                        .child(el("img").attr("decoding", "sync").attr("src", css::asset(&format!("images/{name}.png"))).attr("alt", ""))
                        .child(el("span").class("lamp-hero-current-cp").child(el("span").t("CP")).t(" ").child(el("b").t(format!("{}", lamp_hero_cp(&data, h)))));
                    if candidate.is_some() || !candidates.is_empty() { button.push(el("span").class(if gain > 0. { "lamp-cp-direction up" } else { "lamp-cp-direction down" }).attr("aria-hidden", "true")); }
                    row.push(button);
                }
                row
            };
            if let Some(c) = &candidate {
                let comparison = self.selected_hero.as_ref().map(|h| compare_lamp_item(&data, c, h));
                let tier = rarity(&c.rarity);
                let upgrade = roster.iter().any(|h| lamp_item_cp_gain(&data, c, h) > 0.);
                let mut body = el("div").class("lamp-review-body");
                if data.review_hold().is_some() { body.push(el("p").class("lamp-held").attr("role", "status").t("Cache full · one item held for review")); }
                body.push(hero_row(Some(c), self.selected_hero.as_ref()));
                let mut stats = el("dl").class("lamp-item-stats");
                for k in ["HP", "ATK", "DEF", "MAG", "RES"] {
                    if !c.stats.contains_key(k) { continue; }
                    let delta = comparison.as_ref().and_then(|cmp| cmp.deltas.get(k)).copied().unwrap_or(0.);
                    let mut value = el("span").class("lamp-stat-value").child(el("span").class("lamp-stat-number").attr("aria-hidden", "true").t(format!("{}", c.stat(k))));
                    if delta != 0. { value.push(el("span").class(if delta > 0. { "lamp-stat-arrow up" } else { "lamp-stat-arrow down" }).attr("aria-hidden", "true")); }
                    let spoken = if self.selected_hero.is_some() { format!(", {}{}", if delta > 0. { "increase " } else if delta < 0. { "decrease " } else { "no change " }, delta.abs()) } else { String::new() };
                    stats.push(el("div").child(el("dt").t(k)).child(el("dd").attr("data-delta", format!("{delta}")).label(format!("{k} {}{spoken}", c.stat(k))).child(value)));
                }
                body.push(el("div").class("lamp-candidate").style(format!("--rarity:#{:06x}", tier.map_or(0xf3f3ee, |r| r.color)))
                    .child(atlas(c, upgrade, true))
                    .child(el("div")
                        .child(el("div").class("lamp-quality-band")
                            .child(el("small").t(format!("{} · {} · Lv. {}", tier.map_or("", |r| r.label), slot_label(&c.kind).unwrap_or(""), c.level)))
                            .child(el("h2").t(c.name.as_str()))
                            .child(el("p").class("lamp-item-cp").t(format!("CP {}", lamp_gear_cp(c)))))
                        .child(stats)));
                body.push(el("div").class("lamp-queue").label("Actionable upgrades").children(candidates.iter().filter(|q| q.best_gain > 0. && !data.disposal_requested().contains(&q.item.instance_id)).map(|q| tile(q, false, q.item.instance_id == c.instance_id, None))));
                body.push(el("button").class("lamp-disposal-link lamp-item-disposal").attr("data-action", "queue-disposal").flag("disabled", upgrade).t("Send selected item to disposal").on(on(LampHit::QueueDisposal)));
                dialog.push(body);
                notice(&mut dialog, &self.notice);
                let can_equip = self.selected_hero.as_ref().is_some_and(|id| roster.iter().any(|h| &h.instance_key == id && lamp_item_cp_gain(&data, c, h) > 0.));
                dialog.push(el("div").class("lamp-actions lamp-review-actions")
                    .child(el("button").class("primary").attr("data-action", "equip").flag("disabled", !can_equip).t("Equip").on(on(LampHit::Equip)))
                    .child(el("button").attr("data-action", "cache").t("Back to cache").on(on(LampHit::Cache))));
            } else if self.disposal_view {
                let preview = self.disposal_preview.clone().or_else(|| game.economy.disposal_preview(&mut game.session, None).ok());
                self.disposal_preview = preview.clone();
                let ids = preview.map(|p| p.ids).unwrap_or_default();
                dialog.push(el("div").class("lamp-disposal-body").child(el("div").class("lamp-queue").label("Disposal candidates").children(candidates.iter().map(|q| tile(q, false, false, Some(ids.contains(&q.item.instance_id)))))));
                dialog.push(el("div").class("lamp-actions").child(el("button").class("primary").attr("data-action", "dismantle").flag("disabled", ids.is_empty() && data.lamp.salvage.count <= 0.).t("Dismantle all").on(on(LampHit::Dismantle))));
                notice(&mut dialog, &self.notice);
            } else {
                dialog.push(hero_row(None, None));
                dialog.push(el("p").t(format!("{} / {} stored", data.stored_count(), data.capacity())));
                dialog.push(el("div").class("lamp-queue").label("Actionable upgrades").children(candidates.iter().filter(|q| q.best_gain > 0. && !data.disposal_requested().contains(&q.item.instance_id)).map(|q| tile(q, false, false, None))));
                dialog.push(el("div").class("lamp-actions")
                    .child(el("button").attr("data-action", "equip").flag("disabled", true).t("Equip"))
                    .child(el("button").class("primary").attr("data-action", "auto-equip").flag("disabled", !any_useful).t("Auto-Equip").on(on(LampHit::AutoEquip))));
                notice(&mut dialog, &self.notice);
            }
        }
        // The overlay is the frame rectangle; a cache window stops above the nav.
        let height = if self.upgrade_open { 640. } else { 580. } * scale;
        let mut overlay = el("div").key("lamp").id("lamp-overlay").attr("data-boss-fallback", "false").style(format!("height:{height:.2}px;--bag-scale:{scale:.4};--modal-close-scale:{scale:.4};--boss-fallback-reserve:0px")).on(on(LampHit::Close)).child(dialog);
        // showEquipFeedback: "CP +n" rising from the hero's portrait for 1.8 s (the portrait row sits
        // about 92 px down in the review window and 124 px in the cache window).
        for (hero_id, change, until) in &self.feedbacks {
            if *until <= now { continue; }
            let column = roster.iter().position(|h| &h.instance_key == hero_id).unwrap_or(0) as f32;
            let left = (20. + (column + 0.5) / roster.len().max(1) as f32 * (360. * scale - 40.)).round();
            overlay.push(el("div").class(if *change > 0. { "lamp-cp-feedback positive" } else if *change < 0. { "lamp-cp-feedback negative" } else { "lamp-cp-feedback neutral" }).attr("role", "status").attr("data-hero", hero_id.as_str())
                .style(format!("width:48px;left:{left}px;top:{}px", (if candidate.is_some() { 92. } else { 124. } * scale).round())).t(format!("CP {}{change}", if *change > 0. { "+" } else { "" })));
        }
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
    /// Runs the bar at 60 fps until it is hidden again; returns the levels it celebrated.
    fn play(bar: &mut BagBar, economy: &mut wf_host::equipment::EquipmentStorage, run: &mut crate::testing::HostRun) -> (Vec<u32>, Vec<BarPhase>) {
        let (mut levels, mut phases) = (Vec::new(), vec![bar.phase]);
        for _ in 0..3000 {
            let tier = economy.data().unwrap().lamp.capacity_tier;
            assert!(bar.update(economy, &mut run.session, 1. / 60., true).is_none());
            let now = economy.data().unwrap().lamp.capacity_tier;
            if now != tier { assert_eq!(now, tier + 1); assert_eq!(bar.fraction, 0., "the bar resets after an upgrade"); levels.push(now + 1); }
            if phases.last() != Some(&bar.phase) { phases.push(bar.phase); }
            if bar.phase == BarPhase::Hidden && phases.len() > 1 { break; }
        }
        (levels, phases)
    }
    #[test]
    fn a_completed_dismantle_slides_the_bar_out_and_successive_upgrades_carry_the_overflow() {
        use BarPhase::*;
        let mut run = crate::testing::HostRun::new(1);
        let mut economy = super::super::orbs::tests::economy(&mut run);
        let mut bar = BagBar::default();
        assert!(bar.update(&mut economy, &mut run.session, 1. / 60., true).is_none());
        assert_eq!((bar.phase, bar.reveal()), (Hidden, 0.));
        // Essence alone (a quest reward, combat-time points) never brings the bar out.
        economy.award_combat_essence(&mut run.session, "test:small", 40.).unwrap();
        for _ in 0..300 { bar.update(&mut economy, &mut run.session, 1. / 60., true); }
        assert_eq!((bar.phase, bar.fraction), (Hidden, 0.));
        // A dismantle completed: out, fill from the last shown value to the saved one, hold, in.
        bar.request();
        let (levels, phases) = play(&mut bar, &mut economy, &mut run);
        assert!(levels.is_empty());
        assert_eq!(phases, [Hidden, SlideOut, Beat, Fill, Hold, SlideIn, Hidden]);
        assert_eq!(bar.fraction, 0.4);
        // 1000 more Essence crosses three thresholds (100, 300, 525) without closing the bar.
        economy.award_combat_essence(&mut run.session, "test:large", 1000.).unwrap();
        bar.request();
        let (levels, phases) = play(&mut bar, &mut economy, &mut run);
        assert_eq!(levels, [2, 3, 4]);
        assert_eq!(phases, [Hidden, SlideOut, Beat, Fill, Celebrate, Beat, Fill, Celebrate, Beat, Fill, Celebrate, Beat, Fill, Hold, SlideIn, Hidden]);
        let data = economy.data().unwrap();
        assert_eq!((data.lamp.capacity_tier, data.lamp.essence, data.capacity()), (3, 115., 72.));
        assert!((bar.fraction - 115. / 775.).abs() < 1e-6);
    }
    #[test]
    fn the_hold_lasts_two_and_a_half_seconds_from_the_last_fill() {
        let mut run = crate::testing::HostRun::new(1);
        let mut economy = super::super::orbs::tests::economy(&mut run);
        let mut bar = BagBar::default();
        bar.update(&mut economy, &mut run.session, 1. / 60., true);
        economy.award_combat_essence(&mut run.session, "test:two", 430.).unwrap();
        bar.request();
        // Time each phase at 1 ms steps.
        let (mut clock, mut entered) = (0.0f32, Vec::new());
        let mut last = bar.phase;
        for _ in 0..20000 {
            bar.update(&mut economy, &mut run.session, 0.001, true);
            clock += 0.001;
            if bar.phase != last { entered.push((bar.phase, clock)); last = bar.phase; }
            if bar.phase == BarPhase::Hidden && !entered.is_empty() { break; }
        }
        let at = |phase: BarPhase| entered.iter().rev().find(|(p, _)| *p == phase).map(|(_, t)| *t).unwrap();
        // Two upgrades (100, 300) then the 30/525 overflow; the hold starts when that last fill ends.
        assert_eq!(entered.iter().filter(|(p, _)| *p == BarPhase::Celebrate).count(), 2);
        assert_eq!(entered.iter().filter(|(p, _)| *p == BarPhase::Hold).count(), 1, "one hold, after everything");
        let hold = at(BarPhase::SlideIn) - at(BarPhase::Hold);
        assert!((hold - 2.5).abs() < 0.005, "hold lasted {hold} s");
        assert!(at(BarPhase::Hold) > entered.iter().rev().find(|(p, _)| *p == BarPhase::Celebrate).unwrap().1, "the hold starts after the final upgrade and fill");
        assert_eq!(economy.data().unwrap().lamp.capacity_tier, 2);
    }
    #[test]
    fn every_fill_waits_half_a_second_and_is_slow_enough_to_follow() {
        let mut run = crate::testing::HostRun::new(1);
        let mut economy = super::super::orbs::tests::economy(&mut run);
        let mut bar = BagBar::default();
        bar.update(&mut economy, &mut run.session, 1. / 60., true);
        assert!(!bar.active());
        // 110 Essence: a whole first bar (100), then 10 of 300 on the second.
        economy.award_combat_essence(&mut run.session, "test:pace", 110.).unwrap();
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
        assert!((span(4) - 0.5).abs() < 0.005, "the beat after the upgrade lasted {} s", span(4));
        assert!((span(5) - 0.6).abs() < 0.005, "a small gain still took {} s", span(5));
        assert!(!bar.active(), "the ceremony is over once the bar is back in the bag");
    }
    #[test]
    fn the_bar_waits_while_a_window_covers_the_bag() {
        let mut run = crate::testing::HostRun::new(1);
        let mut economy = super::super::orbs::tests::economy(&mut run);
        let mut bar = BagBar::default();
        bar.update(&mut economy, &mut run.session, 1. / 60., true);
        economy.award_combat_essence(&mut run.session, "test:hidden", 100.).unwrap();
        bar.request();
        for _ in 0..600 { bar.update(&mut economy, &mut run.session, 1. / 60., false); }
        assert_eq!((bar.phase, economy.data().unwrap().lamp.capacity_tier), (BarPhase::Hidden, 0), "no upgrade is applied unseen");
        let (levels, _) = play(&mut bar, &mut economy, &mut run);
        assert_eq!(levels, [2]);
        for _ in 0..120 { bar.update(&mut economy, &mut run.session, 1. / 60., true); }
        assert_eq!(bar.phase, BarPhase::Hidden);
    }
}
