//! The Bag/lamp strip, equipment cache and Bag upgrade windows: `lampEquipmentUI.mjs`,
//! `lampConveyorPresentation.mjs`, `bagUpgradePresentation.mjs`, `rewardReceiptUI.mjs`.
//! Placement follows the JS CSS (strip 360x92 at y 488; cache overlay 480 tall; upgrade window
//! full height); the rules and saves are `wf_host::equipment` / `wf_meta::lamp`.
use super::chrome::{self, image, label, rgb, rgba, stroked, Align, Hit, LAMP_H, LAMP_TOP};
use super::dom::{el, Node};
use super::{css, Act};
use crate::assets::Assets;
use crate::camera::WIDTH;
use crate::game::Game;
use macroquad::prelude::*;
use std::collections::BTreeSet;
use wf_host::equipment::lamp_hero_roster;
use wf_meta::equipment::{format_compact_count, rarity, slot_label, RARITIES};
use wf_meta::lamp::*;

#[derive(Clone, Debug, PartialEq)]
pub enum LampHit { Tile(String), Bag, Tier, Close, Hero(String), Queue(String), Equip, AutoEquip, Disposal, Cache, QueueDisposal, Dismantle, Upgrade(u32) }
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
    banner: Option<(String, f64, f64)>,
    last_emission_frame: Option<f64>,
    emission_elapsed: f64,
    creation_active: bool,
    arrival_attempted: BTreeSet<String>,
    hits: Vec<LHit>,
}
// Conveyor geometry at the 360-wide reference (lampConveyorPresentation.updateLampConveyor).
const TILE_W: f32 = (360. * 0.7275 - 4.2 * 11.) * 0.228;
const ENTRY_W: f32 = TILE_W * 1.121;
const LANE_TOP: f32 = LAMP_TOP + LAMP_H * 0.14;
const BAG_LEFT: f32 = 360. * 0.7652; const BAG_TOP: f32 = LAMP_TOP + LAMP_H * 0.174; const BAG_W: f32 = 360. * 0.228; const BAG_H: f32 = LAMP_H * 0.83;
fn conveyor_duration_ms() -> f64 {
    let gap = (30. * 5. - ENTRY_W) * 0.6 * 0.7;
    let pitch = ENTRY_W + gap * 0.6;
    let speed = pitch / 5.;
    let destination = BAG_LEFT + BAG_W / 2. - TILE_W / 2.;
    ((destination + ENTRY_W) / speed) as f64 * 1000.
}
fn conveyor_x(age_ms: f64) -> f32 {
    let destination = BAG_LEFT + BAG_W / 2. - TILE_W / 2.;
    -ENTRY_W + (age_ms / conveyor_duration_ms()) as f32 * (destination + ENTRY_W)
}
pub fn gear_art(assets: &Assets, item: &LampItem, x: f32, y: f32, size: f32) {
    let Some(tex) = assets.ui.get("lamp-gear-atlas") else { return };
    let cell = tex.width() / 3.;
    let src = Rect::new((item.art % 3) as f32 * cell, (item.art / 3) as f32 * cell, cell, cell);
    draw_texture_ex(tex, x, y, WHITE, DrawTextureParams { dest_size: Some(vec2(size, size)), source: Some(src), ..Default::default() });
}
fn roster_of(game: &Game) -> Vec<LampHero> { lamp_hero_roster(&game.session.progress, false).unwrap_or_default() }
impl LampUi {
    pub fn modal_open(&self) -> bool { self.open || self.upgrade_open }
    /// The DISMANTLED receipt while it shows: title and Essence amount.
    pub fn banner(&self) -> Option<(&str, f64)> { self.banner.as_ref().map(|(title, amount, _)| (title.as_str(), *amount)) }
    fn item_of(data: &LampEconomy, id: &str) -> Option<LampItem> { data.item(id).cloned().or_else(|| data.review_hold().map(|h| h.item).filter(|i| i.instance_id == id)) }
    /// `draw()` per frame: conveyor clock, arrivals and timed emissions (combat screen only).
    pub fn frame(&mut self, game: &mut Game, visible: bool, paused: bool) {
        let now = game.economy.time();
        self.feedbacks.retain(|f| f.2 > now);
        if self.banner.as_ref().is_some_and(|b| b.2 <= now) { self.banner = None; }
        let Some(data) = game.economy.data().cloned() else { return };
        let can_convey = |d: &LampEconomy| visible && !self.open && !self.upgrade_open && !paused && d.stored_count() < d.capacity();
        self.creation_active = can_convey(&data);
        if let Err(e) = game.economy.set_conveyor_active(self.creation_active, &mut game.session) { self.notice = e; }
        let Some(data) = game.economy.data().cloned() else { return };
        if self.creation_active {
            let active_ms = game.economy.conveyor_time();
            let duration = conveyor_duration_ms();
            let arrivals: Vec<String> = data.emissions().iter().filter(|e| !e.collected && conveyor_item_age(&data.lamp, e, now, Some(active_ms)) >= duration && !self.arrival_attempted.contains(&e.item.instance_id)).map(|e| e.item.instance_id.clone()).collect();
            if !arrivals.is_empty() {
                for id in &arrivals { self.arrival_attempted.insert(id.clone()); }
                match game.economy.collect_available(&mut game.session, &arrivals, true) {
                    Ok(_) => {}
                    Err(e) => { self.notice = e; for id in &arrivals { self.arrival_attempted.remove(id); } }
                }
            }
        }
        let Some(data) = game.economy.data().cloned() else { return };
        self.creation_active = can_convey(&data);
        if !self.creation_active { self.last_emission_frame = None; return; }
        if let Some(last) = self.last_emission_frame { self.emission_elapsed += (now - last).max(0.); }
        self.last_emission_frame = Some(now);
        if let Some(issued) = data.emissions().last().and_then(|e| e.issued_active_ms) { self.emission_elapsed = (game.economy.conveyor_time() - issued).max(0.); }
        if self.emission_elapsed >= AUTO_INTERVAL_MS && now - data.lamp.last_activation_at >= AUTO_INTERVAL_MS {
            self.emission_elapsed = 0.;
            let (region, stage) = (game.session.stage.region as f64, game.session.stage.stage as f64);
            if let Err(e) = game.economy.tick_conveyor(&mut game.session, region, stage, true, true) { self.notice = e; }
        }
    }
    /// The strip: conveyor lane, bag with count, tier badge with progress.
    pub fn draw_strip(&mut self, assets: &Assets, game: &mut Game, hits: &mut Vec<Hit>) {
        self.hits.clear();
        draw_rectangle(0., LAMP_TOP, WIDTH, LAMP_H, rgb(0x353336));
        draw_rectangle(0., LAMP_TOP, WIDTH, 2., rgb(0xd8b46c));
        draw_rectangle(0., LAMP_TOP + LAMP_H - 2., WIDTH, 2., rgb(0x8b6835));
        let Some(data) = game.economy.data().cloned() else {
            label(game.economy.error.as_deref().unwrap_or("Preparing the lamp..."), WIDTH / 2., LAMP_TOP + LAMP_H / 2., 11., rgb(0xfff1d1), Align::Center);
            return;
        };
        let now = game.economy.time();
        let active_ms = game.economy.conveyor_time();
        let duration = conveyor_duration_ms();
        let roster = roster_of(game);
        for e in data.emissions() {
            let age = conveyor_item_age(&data.lamp, &e, now, Some(active_ms));
            if age >= CONVEYOR_TRAVEL_MS || age >= duration { continue; }
            let x = conveyor_x(age);
            if x + TILE_W < 0. { continue; }
            let best = roster.iter().map(|h| lamp_item_cp_gain(&data, &e.item, h)).fold(0., f64::max);
            // Rarity glow under the piece, then the atlas art.
            draw_rectangle(x + TILE_W * 0.09, LANE_TOP + TILE_W * 0.86, TILE_W * 0.82, TILE_W * 0.14, rgba(rarity(&e.item.rarity).map_or(0xf3f3ee, |r| r.color), 0.6));
            gear_art(assets, &e.item, x, LANE_TOP, TILE_W);
            stroked(&format!("Lv.{}", e.item.level as u32), x + 2., LANE_TOP + TILE_W - 5., 9., rgb(0xfff1d1), rgb(0x000000), Align::Left);
            if best > 0. { stroked("^", x + TILE_W - 6., LANE_TOP + TILE_W - 8., 14., rgb(0x6fe07a), rgb(0x000000), Align::Center); }
            if !e.collected { self.hits.push(LHit { rect: Rect::new(x, LANE_TOP, TILE_W, TILE_W), kind: LampHit::Tile(e.item.instance_id.clone()) }); }
        }
        // Bag (collect button) with the stored count.
        if let Some(tex) = assets.ui.get("lamp-bag") { image(tex, BAG_LEFT, BAG_TOP - BAG_H * 0.1067, BAG_W, BAG_H * 0.9745); }
        let stored = data.stored_count();
        let count = format!("{}{}", stored as u32, if data.review_hold().is_some() { "+1" } else { "" });
        let cw = chrome::measure(&count, 12.) + 10.;
        draw_rectangle(BAG_LEFT + BAG_W - cw, BAG_TOP + 2., cw, 16., rgb(0x7a2fb0));
        draw_rectangle_lines(BAG_LEFT + BAG_W - cw, BAG_TOP + 2., cw, 16., 2., rgb(0xdba7f5));
        label(&count, BAG_LEFT + BAG_W - cw / 2., BAG_TOP + 10., 12., WHITE, Align::Center);
        self.hits.push(LHit { rect: Rect::new(BAG_LEFT, BAG_TOP, BAG_W, BAG_H), kind: LampHit::Bag });
        // Tier badge: level disc + progress bar.
        let (bx, by, bw, bh) = (360. * 0.805, LAMP_TOP + LAMP_H * 0.74, 360. * 0.175, LAMP_H * 0.225);
        let progress = data.upgrade_progress();
        let (px, py, pw, ph) = (bx + bw * 0.05, by + bh * 0.26, bw * 0.95, bh * 0.52);
        draw_rectangle(px, py, pw, ph, rgb(0x242130));
        draw_rectangle(px + 1., py + 1., (pw - 2.) * progress.fraction as f32, ph - 2., rgb(0xa829e0));
        draw_rectangle_lines(px, py, pw, ph, 1.5, rgb(0xb777d8));
        let pct = if progress.max { "MAX".to_string() } else { format!("{}%", format_compact_count((progress.fraction * 100.).floor())) };
        label(&pct, px + pw * 0.62, py + ph / 2., 7., WHITE, Align::Center);
        let disc_r = bh * 0.5;
        draw_circle(bx + disc_r, by + bh * 0.5, disc_r, rgb(0x4a167e));
        draw_circle_lines(bx + disc_r, by + bh * 0.5, disc_r, 1.5, rgb(0xdba7f5));
        label(&format!("{}", data.lamp.capacity_tier + 1), bx + disc_r, by + bh * 0.42, 12., WHITE, Align::Center);
        label("Bag", bx + disc_r, by + bh * 0.82, 6., rgb(0xffe38e), Align::Center);
        self.hits.push(LHit { rect: Rect::new(bx - 4., by - 4., bw + 8., bh + 8.), kind: LampHit::Tier });
        if let Some(e) = &game.economy.error { stroked(e, 4., LAMP_TOP - 8., 10., rgb(0xfff1d1), rgb(0x502c25), Align::Left); }
        let _ = hits;
    }
    /// Route a canvas tap on the strip (tiles, bag, tier badge). The windows are page elements.
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
            LampHit::Tile(id) => {
                if !self.creation_active { return; }
                match game.economy.collect(&mut game.session, &id, true) { Ok(Some(_)) => self.open_collection(game, Some(id), false), Ok(None) => {}, Err(e) => self.notice = e }
            }
            LampHit::Bag => self.open_collection(game, None, false),
            LampHit::Tier => self.open_collection(game, None, true),
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
                    Ok(r) => { self.close(); self.banner = Some(("DISMANTLED".into(), r.essence, game.economy.time() + 2000.)); }
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
                dialog.push(el("div").class("lamp-disposal-body").child(el("div").class("lamp-queue").label("Disposal candidates").children(candidates.iter().map(|q| tile(q, true, false, Some(ids.contains(&q.item.instance_id)))))));
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
        // The overlay is the frame rectangle; a cache window stops at 480 logical px.
        let height = if self.upgrade_open { 640. } else { 480. } * scale;
        let mut overlay = el("div").key("lamp").id("lamp-overlay").attr("data-boss-fallback", "false").style(format!("height:{height:.2}px;--bag-scale:{scale:.4};--modal-close-scale:{scale:.4};--boss-fallback-reserve:0px")).on(on(LampHit::Close)).child(dialog);
        // showEquipFeedback: "CP +n" rising over the hero's portrait for 1.8 s.
        for (hero_id, change, until) in &self.feedbacks {
            if *until <= now { continue; }
            let column = roster.iter().position(|h| &h.instance_key == hero_id).unwrap_or(0) as f32;
            let left = (20. + (column + 0.5) / roster.len().max(1) as f32 * (360. * scale - 40.)).round();
            overlay.push(el("div").class(if *change > 0. { "lamp-cp-feedback positive" } else if *change < 0. { "lamp-cp-feedback negative" } else { "lamp-cp-feedback neutral" }).attr("role", "status").attr("data-hero", hero_id.as_str())
                .style(format!("width:48px;left:{left}px;top:{}px", (64. * scale).round())).t(format!("CP {}{change}", if *change > 0. { "+" } else { "" })));
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
