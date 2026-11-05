//! The Bag/lamp strip, equipment cache and Bag upgrade windows: `lampEquipmentUI.mjs`,
//! `lampConveyorPresentation.mjs`, `bagUpgradePresentation.mjs`, `rewardReceiptUI.mjs`.
//! Placement follows the JS CSS (strip 360x92 at y 488; cache overlay 480 tall; upgrade window
//! full height); the rules and saves are `wf_host::equipment` / `wf_meta::lamp`.
use super::chrome::{self, image, label, paragraph, rgb, rgba, stroked, Align, Hit, HitKind, LAMP_H, LAMP_TOP, NAV_TOP};
use crate::assets::Assets;
use crate::camera::WIDTH;
use crate::game::Game;
use macroquad::prelude::*;
use std::collections::BTreeSet;
use wf_host::equipment::{lamp_hero_roster, EquipReceipt};
use wf_meta::equipment::{format_compact_count, rarity, slot_label, RARITIES};
use wf_meta::hero;
use wf_meta::lamp::*;

#[derive(Clone, Debug, PartialEq)]
pub enum LampHit { Tile(String), Bag, Tier, Close, Hero(String), Queue(String), Equip, AutoEquip, Disposal, Cache, QueueDisposal, Dismantle, Upgrade(u32), Body }
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
const CACHE_H: f32 = 480.;
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
fn rarity_color(key: &str) -> Color { rgb(rarity(key).map_or(0xf3f3ee, |r| r.color)) }
fn tile(assets: &Assets, item: &LampItem, x: f32, y: f32, size: f32, upgrade: bool, selected: bool, cp: bool) {
    draw_rectangle(x, y, size, size, rgb(0x2a2b2d));
    gear_art(assets, item, x, y, size);
    draw_rectangle_lines(x, y, size, size, 2., if selected { rgb(0xfff2a0) } else { rarity_color(&item.rarity) });
    stroked(&format!("Lv.{}", item.level as u32), x + 3., y + size - 7., 9., rgb(0xfff1d1), rgb(0x000000), Align::Left);
    if upgrade { stroked("^", x + size - 8., y + size - 8., 14., rgb(0x6fe07a), rgb(0x000000), Align::Center); }
    if cp { label(&format!("CP {}", format_compact_count(lamp_gear_cp(item))), x + size - 2., y + 7., 8., rgb(0xfff1d1), Align::Right); }
}
fn button(text: &str, x: f32, y: f32, w: f32, h: f32, enabled: bool, primary: bool) {
    draw_rectangle(x, y, w, h, if primary { rgb(0x25454a) } else { rgb(0x3a3a3c) });
    draw_rectangle_lines(x, y, w, h, 2., if enabled { rgb(0xd0a45b) } else { rgba(0xd0a45b, 0.4) });
    label(text, x + w / 2., y + h / 2., 13., if enabled { rgb(0xfff9ed) } else { rgba(0xfff9ed, 0.45) }, Align::Center);
}
fn roster_of(game: &Game) -> Vec<LampHero> { lamp_hero_roster(&game.session.progress, false).unwrap_or_default() }
impl LampUi {
    pub fn modal_open(&self) -> bool { self.open || self.upgrade_open }
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
        let cw = chrome::measure(&count, 12., chrome::Weight::Regular) + 10.;
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
        if let Some((title, amount, _)) = &self.banner {
            let y = 640. * 0.38;
            draw_rectangle(0., y, WIDTH, 70., rgba(0x80602c, 0.85));
            draw_rectangle(0., y, WIDTH, 2., rgb(0xd6b770)); draw_rectangle(0., y + 68., WIDTH, 2., rgb(0xd6b770));
            label(title, WIDTH / 2., y + 14., 14., rgb(0xfff1bf), Align::Center);
            if let Some(tex) = assets.ui.get("lamp-essence") { image(tex, WIDTH / 2. - 32., y + 24., 28., 28.); }
            label(&format!("{}", *amount as u64), WIDTH / 2. + 10., y + 40., 16., rgb(0xfff1bf), Align::Left);
        }
        let _ = hits;
    }
    /// Route a tap: modals first, then the strip. Returns true when handled.
    pub fn tap(&mut self, p: Vec2, game: &mut Game) -> bool {
        // Topmost first: the window body is pushed before the controls drawn over it.
        if self.modal_open() {
            let hit = self.hits.iter().rev().find(|h| h.rect.contains(p)).map(|h| h.kind.clone());
            match hit {
                None => { if !self.upgrade_open || p.y < 20. || p.y > NAV_TOP { self.close(); } }
                Some(kind) => self.act(kind, game),
            }
            return true;
        }
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
    fn show_feedback(&mut self, game: &Game, r: &EquipReceipt) { let until = game.economy.data().map_or(0., |d| d.lamp.last_activation_at).max(0.); let _ = until; self.feedbacks.push((r.hero_id.clone(), r.cp_change, macroquad::time::get_time() * 1000. + 1800.)); }
    pub fn act(&mut self, kind: LampHit, game: &mut Game) {
        self.notice.clear();
        match kind {
            LampHit::Close => self.close(),
            LampHit::Body => {}
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
    /// The cache / review / disposal / upgrade windows.
    pub fn draw_modal(&mut self, assets: &Assets, game: &mut Game, hits: &mut Vec<Hit>) {
        if !self.modal_open() { return; }
        self.hits.clear();
        let Some(data) = game.economy.data().cloned() else { return };
        let roster = roster_of(game);
        let candidates = conveyor_review_candidates(&data, &roster);
        let now = game.economy.time();
        draw_rectangle(0., 0., WIDTH, 640., rgba(0x000000, 0.55));
        let h = if self.upgrade_open { NAV_TOP } else { CACHE_H };
        draw_rectangle(8., 8., WIDTH - 16., h - 16., rgb(0x2b2622));
        draw_rectangle_lines(8., 8., WIDTH - 16., h - 16., 2., rgb(0xaa8960));
        self.hits.push(LHit { rect: Rect::new(8., 8., WIDTH - 16., h - 16.), kind: LampHit::Body });
        hits.push(Hit { rect: Rect::new(0., 0., WIDTH, 640.), kind: HitKind::PanelBody });
        let close = |hits: &mut Vec<LHit>, y: f32| { let r = Rect::new(WIDTH - 40., y, 28., 24.); draw_rectangle_lines(r.x, r.y, r.w, r.h, 1., rgb(0xaa8960)); label("X", r.x + 14., r.y + 12., 14., rgb(0xfff9ed), Align::Center); hits.push(LHit { rect: r, kind: LampHit::Close }); };
        if self.upgrade_open { self.draw_upgrade(assets, &data, close); return; }
        let candidate = self.selected_item.as_ref().and_then(|id| Self::item_of(&data, id));
        if candidate.is_none() { self.selected_item = None; }
        let title = if candidate.is_some() { "EQUIPMENT REVIEW" } else if self.disposal_view { "DISMANTLE" } else { "EQUIPMENT CACHE" };
        label(title, 20., 24., 13., rgb(0xffd45c), Align::Left);
        if !self.disposal_view {
            let enabled = !candidates.iter().any(|c| c.best_gain > 0.);
            let r = Rect::new(190., 12., 120., 24.);
            label("Done / Dismantle", r.x + r.w / 2., r.y + 12., 10., if enabled { rgb(0xfff9ed) } else { rgba(0xfff9ed, 0.4) }, Align::Center);
            if enabled { self.hits.push(LHit { rect: r, kind: LampHit::Disposal }); }
        }
        close(&mut self.hits, 12.);
        let useful: Vec<&Candidate> = candidates.iter().filter(|c| c.best_gain > 0. && !data.disposal_requested().contains(&c.item.instance_id)).collect();
        // Hero row: portraits with current CP and the comparison arrow.
        let hero_row = |hits: &mut Vec<LHit>, y: f32, candidate: Option<&LampItem>, selected: Option<&String>| {
            for (i, h) in roster.iter().enumerate() {
                let x = 14. + i as f32 * 86.;
                let gain = match candidate { Some(c) => lamp_item_cp_gain(&data, c, h), None => candidates.iter().map(|c| lamp_item_cp_gain(&data, &c.item, h)).fold(0., f64::max) };
                let cp = lamp_hero_cp(&data, h);
                let chosen = selected == Some(&h.instance_key);
                draw_rectangle(x, y, 64., 64., rgb(0x253039));
                if let Some(tex) = assets.ui.get(super::model::hero_art(h.definition.key)) { chrome::portrait(tex, x, y, 64., WHITE); }
                draw_rectangle_lines(x, y, 64., 64., 2., if chosen { rgb(0xfff2a0) } else { rgb(0xc4a775) });
                stroked(&format!("CP {}", cp as u64), x + 32., y + 56., 9., rgb(0xfff9ed), rgb(0x000000), Align::Center);
                if candidate.is_some() || !candidates.is_empty() { stroked(if gain > 0. { "^" } else { "v" }, x + 56., y + 10., 14., if gain > 0. { rgb(0x6fe07a) } else { rgb(0xe05a5a) }, rgb(0x000000), Align::Center); }
                if candidate.is_some() { hits.push(LHit { rect: Rect::new(x, y, 64., 64.), kind: LampHit::Hero(h.instance_key.clone()) }); }
                if let Some((_, change, _)) = self.feedbacks.iter().find(|f| f.0 == h.instance_key && f.2 > now) {
                    stroked(&format!("CP {}{}", if *change > 0. { "+" } else { "" }, change), x + 32., y - 10., 11., if *change > 0. { rgb(0x6fe07a) } else { rgb(0xe05a5a) }, rgb(0x000000), Align::Center);
                }
            }
        };
        let queue = |hits: &mut Vec<LHit>, y: f32, rows: usize, items: Vec<(&LampItem, bool, bool)>, action: fn(String) -> LampHit| {
            let size = 72.;
            for (n, (item, upgrade, marked)) in items.iter().enumerate().take(rows * 4) {
                let (col, row) = (n % 4, n / 4);
                let (x, ty) = (14. + col as f32 * 84., y + row as f32 * 84.);
                tile(assets, item, x, ty, size, *upgrade, self.selected_item.as_deref() == Some(item.instance_id.as_str()), true);
                if *marked { draw_rectangle(x + size - 16., ty + 2., 14., 14., rgb(0xe05a5a)); }
                hits.push(LHit { rect: Rect::new(x, ty, size, size), kind: action(item.instance_id.clone()) });
            }
        };
        if let Some(c) = &candidate {
            hero_row(&mut self.hits, 44., Some(c), self.selected_hero.as_ref());
            if data.review_hold().is_some() { label("Cache full - one item held for review", WIDTH / 2., 118., 10., rgb(0xffd45c), Align::Center); }
            let cy = 126.;
            tile(assets, c, 14., cy, 58., roster.iter().any(|h| lamp_item_cp_gain(&data, c, h) > 0.), false, false);
            label(&format!("{} | {} | Lv. {}", rarity(&c.rarity).map_or("", |r| r.label), slot_label(&c.kind).unwrap_or(""), c.level as u32), 82., cy + 8., 9., rarity_color(&c.rarity), Align::Left);
            label(&c.name, 82., cy + 24., 14., rgb(0xfff9ed), Align::Left);
            label(&format!("CP {}", lamp_gear_cp(c)), 82., cy + 40., 11., rgb(0xd9b88c), Align::Left);
            let comparison = self.selected_hero.as_ref().map(|h| compare_lamp_item(&data, c, h));
            let mut sx = 82.;
            for k in ["HP", "ATK", "DEF", "MAG", "RES"] {
                if !c.stats.contains_key(k) { continue; }
                let delta = comparison.as_ref().and_then(|cmp| cmp.deltas.get(k)).copied().unwrap_or(0.);
                label(k, sx, cy + 54., 8., rgb(0xd9b88c), Align::Left);
                label(&format!("{}", c.stat(k) as i64), sx, cy + 66., 11., rgb(0xfff9ed), Align::Left);
                if delta != 0. { label(if delta > 0. { "^" } else { "v" }, sx + 22., cy + 66., 11., if delta > 0. { rgb(0x6fe07a) } else { rgb(0xe05a5a) }, Align::Left); }
                sx += 52.;
            }
            let items: Vec<(&LampItem, bool, bool)> = candidates.iter().filter(|q| self.disposal_view || (q.best_gain > 0. && !data.disposal_requested().contains(&q.item.instance_id))).map(|q| (&q.item, q.best_gain > 0., false)).collect();
            queue(&mut self.hits, 206., 2, items, LampHit::Queue);
            let can_dispose = !roster.iter().any(|h| lamp_item_cp_gain(&data, c, h) > 0.);
            let r = Rect::new(14., 378., 220., 20.);
            label("Send selected item to disposal", r.x, r.y + 10., 10., if can_dispose { rgb(0xfff9ed) } else { rgba(0xfff9ed, 0.4) }, Align::Left);
            if can_dispose { self.hits.push(LHit { rect: r, kind: LampHit::QueueDisposal }); }
            let can_equip = self.selected_hero.as_ref().is_some_and(|hid| roster.iter().any(|h| &h.instance_key == hid && lamp_item_cp_gain(&data, c, h) > 0.));
            button("Equip", 14., 420., 160., 36., can_equip, true);
            if can_equip { self.hits.push(LHit { rect: Rect::new(14., 420., 160., 36.), kind: LampHit::Equip }); }
            button("Back to cache", 186., 420., 160., 36., true, false);
            self.hits.push(LHit { rect: Rect::new(186., 420., 160., 36.), kind: LampHit::Cache });
        } else if self.disposal_view {
            let preview = self.disposal_preview.clone().or_else(|| game.economy.disposal_preview(&mut game.session, None).ok());
            self.disposal_preview = preview.clone();
            let ids = preview.as_ref().map(|p| p.ids.clone()).unwrap_or_default();
            let items: Vec<(&LampItem, bool, bool)> = candidates.iter().map(|q| (&q.item, q.best_gain > 0., ids.contains(&q.item.instance_id))).collect();
            queue(&mut self.hits, 44., 4, items, LampHit::Queue);
            let essence = preview.as_ref().map_or(0., |p| p.essence);
            label(&format!("Dismantle {} pieces for {} Essence", ids.len() as f64 + data.lamp.salvage.count, essence), WIDTH / 2., 400., 11., rgb(0xd9b88c), Align::Center);
            let enabled = !ids.is_empty() || data.lamp.salvage.count > 0.;
            button("Dismantle all", 100., 420., 160., 36., enabled, true);
            if enabled { self.hits.push(LHit { rect: Rect::new(100., 420., 160., 36.), kind: LampHit::Dismantle }); }
        } else {
            hero_row(&mut self.hits, 44., None, None);
            if let Some(h) = data.review_hold() { label(&format!("Held: {}. Cache full - equip it or review disposal.", h.item.name), WIDTH / 2., 116., 9., rgb(0xffd45c), Align::Center); }
            label(&format!("{} / {} stored", data.stored_count() as u32, data.capacity() as u32), 14., 130., 11., rgb(0xd9b88c), Align::Left);
            let items: Vec<(&LampItem, bool, bool)> = useful.iter().map(|q| (&q.item, true, false)).collect();
            queue(&mut self.hits, 142., 3, items, LampHit::Queue);
            button("Equip", 14., 420., 160., 36., false, false);
            let can_auto = !useful.is_empty();
            button("Auto-Equip", 186., 420., 160., 36., can_auto, true);
            if can_auto { self.hits.push(LHit { rect: Rect::new(186., 420., 160., 36.), kind: LampHit::AutoEquip }); }
        }
        if !self.notice.is_empty() { paragraph(&self.notice, 14., 456., WIDTH - 28., 10., rgb(0xffb0a0)); }
    }
    fn draw_upgrade(&mut self, assets: &Assets, data: &LampEconomy, close: impl Fn(&mut Vec<LHit>, f32)) {
        let level = data.lamp.capacity_tier + 1;
        let tier = capacity_tier(data.lamp.capacity_tier);
        let next = (data.lamp.capacity_tier as usize + 1 < LAMP_LEVELS).then(|| capacity_tier(data.lamp.capacity_tier + 1));
        if let Some(r) = &self.upgrade_receipt {
            label("Upgrade Complete", WIDTH / 2., 120., 20., rgb(0xffd45c), Align::Center);
            if let Some(tex) = assets.ui.get("lamp-bag") { image(tex, WIDTH / 2. - 60., 150., 120., 120.); }
            label(&format!("Bag Lv. {}", r.level_after), WIDTH / 2., 300., 16., rgb(0xfff9ed), Align::Center);
            label(&format!("Bag Capacity {} > {}", r.capacity_before as u64, r.capacity_after as u64), WIDTH / 2., 330., 13., rgb(0xd9b88c), Align::Center);
            close(&mut self.hits, 380.);
            return;
        }
        label(&format!("Bag Upgrade Lv.{level}"), WIDTH / 2., 28., 16., rgb(0xfff9ed), Align::Center);
        if let Some(tex) = assets.ui.get("bag-medallion") { image(tex, 60., 48., 36., 36.); }
        label(&format!("Lv. {level}"), 130., 66., 14., rgb(0xfff9ed), Align::Center);
        label(">", 180., 66., 14., rgb(0xd9b88c), Align::Center);
        label(&next.as_ref().map_or("MAX".to_string(), |_| format!("Lv. {}", level + 1)), 230., 66., 14., rgb(0xfff9ed), Align::Center);
        let rate = |n: f64| format!("{:.1}%", (n * 10.).ceil() / 10.);
        for (i, r) in RARITIES.iter().enumerate() {
            let y = 100. + i as f32 * 30.;
            draw_rectangle(20., y, WIDTH - 40., 26., rgba(r.color, 0.25));
            draw_rectangle_lines(20., y, WIDTH - 40., 26., 1., rgb(r.color));
            label(r.label, 30., y + 13., 11., rgb(0xfff9ed), Align::Left);
            label(&rate(tier.rarity_weights.iter().find(|(k, _)| *k == r.key).map_or(0., |(_, v)| *v)), 190., y + 13., 11., rgb(0xfff9ed), Align::Right);
            label(">", 212., y + 13., 11., rgb(0xd9b88c), Align::Center);
            label(&next.as_ref().map_or("-".to_string(), |n| rate(n.rarity_weights.iter().find(|(k, _)| *k == r.key).map_or(0., |(_, v)| *v))), 330., y + 13., 11., rgb(0xfff9ed), Align::Right);
        }
        label(&format!("Bag Capacity {} {}", tier.capacity as u64, next.as_ref().map_or("(MAX)".to_string(), |n| format!("> {}", n.capacity as u64))), WIDTH / 2., 270., 12., rgb(0xd9b88c), Align::Center);
        let progress = data.upgrade_progress();
        draw_circle(36., 306., 14., rgb(0x4a167e)); draw_circle_lines(36., 306., 14., 1.5, rgb(0xdba7f5));
        label(&format!("{level}"), 36., 306., 12., WHITE, Align::Center);
        draw_rectangle(58., 296., 244., 20., rgb(0x242130));
        draw_rectangle(59., 297., 242. * progress.fraction as f32, 18., rgb(0xa829e0));
        draw_rectangle_lines(58., 296., 244., 20., 1.5, rgb(0xb777d8));
        let total = if progress.max { "MAX".to_string() } else { format!("({}/{})", format_compact_count(progress.current), format_compact_count(progress.required.unwrap_or(0.))) };
        label(&total, 180., 306., 11., WHITE, Align::Center);
        draw_circle(324., 306., 14., rgb(0x4a167e)); draw_circle_lines(324., 306., 14., 1.5, rgb(0xdba7f5));
        label(&next.as_ref().map_or("MAX".to_string(), |_| format!("{}", level + 1)), 324., 306., 11., WHITE, Align::Center);
        let can = !progress.max && progress.required.is_some_and(|r| progress.current >= r);
        button(if progress.max { "MAX" } else { "Level Up" }, 105., 340., 150., 40., can, true);
        if can { self.hits.push(LHit { rect: Rect::new(105., 340., 150., 40.), kind: LampHit::Upgrade(data.lamp.capacity_tier) }); }
        paragraph("Probabilities shown are rounded and may not add up to 100%.", 30., 396., WIDTH - 60., 9., rgba(0xfff9ed, 0.6));
        if !self.notice.is_empty() { paragraph(&self.notice, 14., 430., WIDTH - 28., 10., rgb(0xffb0a0)); }
        close(&mut self.hits, 470.);
        let _ = hero::MAX_LEVEL;
    }
}
