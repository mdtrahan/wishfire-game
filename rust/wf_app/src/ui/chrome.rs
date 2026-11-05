//! Combat chrome drawing + hit zones. Geometry is the JS layout (360x640 frame).
use super::model::{format_number, CombatModel, SlotStatus, SLOTS};
use super::{text, Panel, Screen};
use crate::assets::Assets;
use crate::camera::{BAND_BOTTOM, BAND_TOP, HEIGHT, WIDTH};
use macroquad::prelude::*;
use std::cell::RefCell;
use std::collections::HashMap;
use wf_meta::hero;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum HitKind {
    Nav(Screen), Summon, Inspect, Hero(&'static str), Party(&'static str), PanelBody,
    /// POWER UP: the Growth dialog (`growth:open`).
    Growth,
    /// Quest objective box when the reward is ready.
    Claim,
    // renderHeroScreen.js
    HeroPrev, HeroNext, SkillPrev, SkillNext, HeroTab(u8), Roster(usize), LevelUp, StarOpen, StarUp, SheetClose, GearSlot(u8),
    // createTrainingGroundUI
    TgTab(u8), Train(&'static str), TgClose,
    // renderChests.js
    VaultTab(u8), VaultBack,
    // storyEntryFlow / questLadderUI / renderNarrativeScene
    StoryStart, StoryTown, StoryCard(usize), StoryBack, NarrativeTap, SkipCancel, SkipConfirm, PauseQuit, PauseContinue, HeroClose,
}
#[derive(Clone, Copy, Debug)]
pub struct Hit { pub rect: Rect, pub kind: HitKind }

// renderCombatBossControl.mjs
const HUD_LEFT: f32 = 127.5; const HUD_TOP: f32 = 44.; const HUD_RIGHT: f32 = 232.5; const HUD_BOTTOM: f32 = 84.;
const FALLBACK_W: f32 = 360.; const FALLBACK_H: f32 = 82.;
// renderBossBattleHud.mjs
const BOSS_HUD_W: f32 = 248.; const BOSS_HUD_TOP: f32 = 86.;
// heroCooldownStrip.mjs
pub const STRIP_W: f32 = 344.; pub const STRIP_H: f32 = 41.28; pub const STRIP_TOP: f32 = 441.6; pub const STRIP_LEFT: f32 = 8.;
const BUFF_ICON: f32 = 12.; const BUFF_GAP: f32 = 2.;
// lampEquipmentUI.mjs (bead ORKA-63bf.8 fills it)
pub const LAMP_TOP: f32 = 488.; pub const LAMP_H: f32 = 92.;
// renderExistingNavigation.mjs
pub const NAV_TOP: f32 = 580.; pub const NAV_H: f32 = 60.;

pub fn rgb(hex: u32) -> Color { Color::from_rgba((hex >> 16) as u8, (hex >> 8 & 255) as u8, (hex & 255) as u8, 255) }
pub fn rgba(hex: u32, a: f32) -> Color { Color::new((hex >> 16) as f32 / 255., (hex >> 8 & 255) as f32 / 255., (hex & 255) as f32 / 255., a) }
pub use super::text::{Align, Weight};
/// Text with its vertical centre at `cy` (regular weight).
pub fn label(text: &str, x: f32, cy: f32, size: f32, color: Color, align: Align) -> f32 { text::draw(text, x, cy, size, Weight::Regular, color, align) }
/// Text with its vertical centre at `cy` at a CSS weight.
pub fn label_w(text: &str, x: f32, cy: f32, size: f32, weight: Weight, color: Color, align: Align) -> f32 { text::draw(text, x, cy, size, weight, color, align) }
pub fn measure(text: &str, size: f32, weight: Weight) -> f32 { text::measure(text, size, weight) }
pub fn stroked(text: &str, x: f32, cy: f32, size: f32, fill: Color, stroke: Color, align: Align) { stroked_w(text, x, cy, size, Weight::Regular, fill, stroke, align) }
/// Four-way 1px `text-shadow` outline.
pub fn stroked_w(text: &str, x: f32, cy: f32, size: f32, weight: Weight, fill: Color, stroke: Color, align: Align) {
    for (dx, dy) in [(-1., -1.), (1., -1.), (-1., 1.), (1., 1.)] { label_w(text, x + dx, cy + dy, size, weight, stroke, align); }
    label_w(text, x, cy, size, weight, fill, align);
}
/// Word-wrapped paragraph (regular, line-height 1.3); returns the height used.
pub fn paragraph(text: &str, x: f32, top: f32, width: f32, size: f32, color: Color) -> f32 { text::paragraph(text, x, top, width, size, size * 1.3, Weight::Regular, color) }
pub fn paragraph_w(text: &str, x: f32, top: f32, width: f32, size: f32, line_h: f32, weight: Weight, color: Color) -> f32 { text::paragraph(text, x, top, width, size, line_h, weight, color) }

// ---------------------------------------------------------------- baked CSS surfaces
thread_local! { static BAKED: RefCell<HashMap<String, Texture2D>> = RefCell::new(HashMap::new()); }
pub fn mix(a: Color, b: Color, t: f32) -> Color { let t = t.clamp(0., 1.); Color::new(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t, a.a + (b.a - a.a) * t) }
/// CSS gradient stops `(position 0..1, color)` sampled at `t`.
pub fn stops(stops: &[(f32, Color)], t: f32) -> Color {
    if t <= stops[0].0 { return stops[0].1; }
    for pair in stops.windows(2) { if t <= pair[1].0 { return mix(pair[0].1, pair[1].1, (t - pair[0].0) / (pair[1].0 - pair[0].0).max(1e-6)); } }
    stops[stops.len() - 1].1
}
/// Signed distance from a point to a rounded rectangle of size `w`x`h` at the origin with
/// per-corner radii `[tl, tr, br, bl]` (negative inside).
fn rounded_sdf(x: f32, y: f32, w: f32, h: f32, r: [f32; 4]) -> f32 {
    let r = if x < w / 2. { if y < h / 2. { r[0] } else { r[3] } } else if y < h / 2. { r[1] } else { r[2] };
    let (qx, qy) = ((x - w / 2.).abs() - (w / 2. - r), (y - h / 2.).abs() - (h / 2. - r));
    vec2(qx.max(0.), qy.max(0.)).length() + qx.max(qy).min(0.) - r
}
/// A surface rasterized once at device density: `shade(u, v)` gives the colour at a relative
/// position, the per-corner radii cut the corners with 1px anti-aliasing. Cached by `key`.
pub fn baked(key: &str, w: f32, h: f32, radii: [f32; 4], shade: &dyn Fn(f32, f32) -> Color) -> Texture2D {
    let d = crate::camera::Portrait::density();
    let full = format!("{key}:{w:.2}x{h:.2}@{d:.2}");
    if let Some(t) = BAKED.with(|b| b.borrow().get(&full).cloned()) { return t; }
    let (pw, ph) = ((w * d).ceil().max(1.) as u16, (h * d).ceil().max(1.) as u16);
    let mut image = Image::gen_image_color(pw, ph, Color::new(0., 0., 0., 0.));
    for py in 0..ph as u32 {
        for px in 0..pw as u32 {
            let (lx, ly) = ((px as f32 + 0.5) / d, (py as f32 + 0.5) / d);
            let mut c = shade(lx / w, ly / h);
            c.a *= (0.5 - rounded_sdf(lx, ly, w, h, radii) * d).clamp(0., 1.);
            image.set_pixel(px, py, c);
        }
    }
    let texture = Texture2D::from_image(&image);
    texture.set_filter(FilterMode::Linear);
    BAKED.with(|b| b.borrow_mut().insert(full, texture.clone()));
    texture
}
/// `overflow: hidden` on a rounded box: after content was drawn over the square box, paints the
/// four corner slivers outside radius `r` with `color` (the surface behind the content).
pub fn clip_corners(x: f32, y: f32, w: f32, h: f32, r: f32, color: Color) {
    if r <= 0. { return; }
    let d = crate::camera::Portrait::density();
    let tex = baked(&format!("corner:{:.3},{:.3},{:.3},{:.3}", color.r, color.g, color.b, color.a), r, r, [0.; 4], &|u, v| {
        let dist = ((u - 1.).powi(2) + (v - 1.).powi(2)).sqrt() * r;
        Color::new(color.r, color.g, color.b, color.a * ((dist - r) * d + 0.5).clamp(0., 1.))
    });
    for (px, py, fx, fy) in [(x, y, false, false), (x + w - r, y, true, false), (x, y + h - r, false, true), (x + w - r, y + h - r, true, true)] {
        draw_texture_ex(&tex, px, py, WHITE, DrawTextureParams { dest_size: Some(vec2(r, r)), flip_x: fx, flip_y: fy, ..Default::default() });
    }
}
pub fn draw_baked(tex: &Texture2D, x: f32, y: f32, w: f32, h: f32) { draw_texture_ex(tex, x, y, WHITE, DrawTextureParams { dest_size: Some(vec2(w, h)), ..Default::default() }); }
/// `box-shadow <dx> <dy> <blur> <color>` under a rounded box (no spread).
pub fn box_shadow(x: f32, y: f32, w: f32, h: f32, r: f32, dx: f32, dy: f32, blur: f32, color: Color) {
    let pad = blur.max(0.5);
    let (sw, sh) = (w + 2. * pad, h + 2. * pad);
    let tex = baked(&format!("shadow:{r:.2}:{blur:.2}:{:.3}", color.a), sw, sh, [0.; 4], &|u, v| {
        let sdf = rounded_sdf(u * sw - pad, v * sh - pad, w, h, [r; 4]);
        let t = (0.5 - sdf / (2. * pad)).clamp(0., 1.);
        Color::new(color.r, color.g, color.b, color.a * t * t * (3. - 2. * t))
    });
    draw_baked(&tex, x + dx - pad, y + dy - pad, sw, sh);
}
pub fn image(tex: &Texture2D, x: f32, y: f32, w: f32, h: f32) {
    // object-fit: contain
    let (tw, th) = (tex.width(), tex.height());
    let s = (w / tw).min(h / th);
    let (dw, dh) = (tw * s, th * s);
    draw_texture_ex(tex, x + (w - dw) / 2., y + (h - dh) / 2., WHITE, DrawTextureParams { dest_size: Some(vec2(dw, dh)), ..Default::default() });
}
pub fn image_tinted(tex: &Texture2D, x: f32, y: f32, w: f32, h: f32, tint: Color) {
    let (tw, th) = (tex.width(), tex.height());
    let s = (w / tw).min(h / th);
    let (dw, dh) = (tw * s, th * s);
    draw_texture_ex(tex, x + (w - dw) / 2., y + (h - dh) / 2., tint, DrawTextureParams { dest_size: Some(vec2(dw, dh)), ..Default::default() });
}
/// Hero portrait as the strip crops it: 235% width, left -67.5%, top -22% of a square slot.
pub fn portrait(tex: &Texture2D, x: f32, y: f32, size: f32, tint: Color) {
    let (tw, th) = (tex.width(), tex.height());
    let scale = 1. / 2.35;
    let src = Rect::new(tw * 0.675 * scale, th * 0.22 * scale, tw * scale, th * scale);
    draw_texture_ex(tex, x, y, tint, DrawTextureParams { dest_size: Some(vec2(size, size)), source: Some(src), ..Default::default() });
}
pub const BUFF_FRAMES: [&str; 17] = ["party-spd", "party-atk", "party-mag", "party-def", "party-res", "party-hp", "party-cr", "party-cd", "party-range", "party-dr", "party-ward", "party-heal", "party-special", "party-reflect", "hero-tempo", "hero-offense", "hero-defense"];
pub fn buff_icon(assets: &Assets, id: &str, x: f32, y: f32, size: f32) {
    let Some(tex) = assets.ui.get("buff-signals") else { return };
    let Some(index) = BUFF_FRAMES.iter().position(|f| *f == id) else { return };
    let cell = tex.width() / 6.;
    let src = Rect::new((index % 6) as f32 * cell, (index / 6) as f32 * cell, cell, cell);
    draw_texture_ex(tex, x, y, WHITE, DrawTextureParams { dest_size: Some(vec2(size, size)), source: Some(src), ..Default::default() });
}
/// The clock overlay: a dark wedge covering the last `fraction` of a turn, clockwise from 12
/// o'clock, clipped to the slot square (`conic-gradient(from 0deg, ...)` in CSS).
pub fn wedge(cx: f32, cy: f32, half: f32, fraction: f32, color: Color) {
    if fraction <= 0. { return; }
    let start = (1. - fraction.min(1.)) * std::f32::consts::TAU;
    let edge = |t: f32| { let d = vec2(t.sin(), -t.cos()); let k = half / d.x.abs().max(d.y.abs()); vec2(cx, cy) + d * k };
    let steps = ((fraction * 72.).ceil() as usize).max(1);
    let mut prev = edge(start);
    for i in 1..=steps {
        let t = start + (std::f32::consts::TAU - start) * i as f32 / steps as f32;
        let next = edge(t);
        draw_triangle(vec2(cx, cy), prev, next, color);
        prev = next;
    }
}
/// `border-radius` box: a rectangle with rounded corners.
pub fn rounded(x: f32, y: f32, w: f32, h: f32, r: f32, fill: Color) { rounded_corners(x, y, w, h, [r; 4], fill); }
/// `border-radius` box with per-corner radii `[tl, tr, br, bl]`.
pub fn rounded_corners(x: f32, y: f32, w: f32, h: f32, r: [f32; 4], fill: Color) {
    let r = r.map(|r| r.min(w / 2.).min(h / 2.).max(0.));
    let (top, bottom) = (r[0].max(r[1]), r[2].max(r[3]));
    draw_rectangle(x, y + top, w, h - top - bottom, fill);
    draw_rectangle(x + r[0], y, w - r[0] - r[1], top, fill);
    draw_rectangle(x + r[3], y + h - bottom, w - r[3] - r[2], bottom, fill);
    for (i, (cx, cy)) in [(x + r[0], y + r[0]), (x + w - r[1], y + r[1]), (x + w - r[2], y + h - r[2]), (x + r[3], y + h - r[3])].into_iter().enumerate() {
        if r[i] > 0. { draw_circle(cx, cy, r[i], fill); }
        // Fill the sliver a smaller corner leaves beside a larger one on the same edge.
        let (side_x, side_w) = if i == 0 || i == 3 { (x, r[i]) } else { (x + w - r[i], r[i]) };
        let (side_y, side_h) = if i < 2 { (y + r[i], top - r[i]) } else { (y + h - bottom, bottom - r[i]) };
        if side_h > 0. && side_w > 0. { draw_rectangle(side_x, side_y, side_w, side_h, fill); }
    }
}
pub fn rounded_outline(x: f32, y: f32, w: f32, h: f32, r: f32, fill: Color, stroke: Color) { rounded(x, y, w, h, r, stroke); rounded(x + 1., y + 1., w - 2., h - 2., (r - 1.).max(0.), fill); }
/// Resource icon by COT resource key.
pub fn resource_icon(assets: &Assets, resource: &str, x: f32, y: f32, size: f32) {
    let name = match resource { "incense" => "prog-incense", "essence" => "lamp-essence", "gold" => "coin", _ => return };
    if let Some(tex) = assets.ui.get(name) { image(tex, x, y, size, size); }
}
/// `hero-tickets.png` quadrant for a hero name (`TICKET_QUADRANT`).
pub fn ticket_art(assets: &Assets, hero_name: &str, x: f32, y: f32, w: f32, h: f32) {
    let Some(tex) = assets.ui.get("prog-hero-tickets") else { return };
    let (col, row) = match hero_name { "Hondo" => (1., 0.), "Kaja" => (0., 1.), "Runa" => (1., 1.), _ => (0., 0.) };
    let (cw, ch) = (tex.width() / 2., tex.height() / 2.);
    let src = Rect::new(col * cw, row * ch, cw, ch);
    let s = (w / cw).min(h / ch);
    draw_texture_ex(tex, x + (w - cw * s) / 2., y + (h - ch * s) / 2., WHITE, DrawTextureParams { dest_size: Some(vec2(cw * s, ch * s)), source: Some(src), ..Default::default() });
}
/// `.cot-resources`: Incense, Essence and the Gold display fixture (three 112x22 pills at the top).
fn resources(assets: &Assets, m: &CombatModel) {
    let q = &m.quest;
    for (i, (key, value)) in [("incense", format_number(q.incense)), ("essence", format_number(q.essence)), ("gold", "999,999,999".into())].iter().enumerate() {
        let x = 8. + i as f32 * 116.;
        capsule(x, 8., 112., 22., rgba(0x0e0c14, 0.72));
        let size = if *key == "gold" { 22. } else { 26. };
        resource_icon(assets, key, x + if *key == "gold" { 0. } else { -4. }, 8. + (22. - size) / 2., size);
        label(value, x + 104., 19., 12., rgb(0xf6eedc), Align::Right);
    }
}
/// `.cot-objective`: 270x52 box at the quest top (370) with the reward plate and the challenge text.
fn objective(assets: &Assets, m: &CombatModel, hits: &mut Vec<Hit>) {
    let q = &m.quest;
    let (x, y) = (8., 370.);
    // ::before gradient backer from the plate's right edge.
    for i in 0..25 { let t = i as f32 / 25.; draw_rectangle(x + 20. + t * 250., y + 2., 10., 34., rgba(0x808080, (0.52 - 0.5 * t).max(0.))); }
    if q.reward.is_some() {
        draw_circle(x + 19., y + 19., 19., rgb(0x41443f));
        draw_circle(x + 19., y + 19., 17., rgb(0xd6d5cb));
        draw_circle(x + 19., y + 19., 15., rgb(0x9a9b96));
    }
    if let Some((resource, amount, hero_name)) = &q.reward {
        if resource == "hero_ticket" { ticket_art(assets, hero_name, x + 2.5, y + 8., 33., 22.); } else { resource_icon(assets, resource, x + 4., y + 4., 30.); }
        stroked(&format_number(*amount), x + 19., y + 40., 14., rgb(0xffffff), rgb(0x171208), Align::Center);
    }
    stroked(&q.category.to_uppercase(), x + 48., y + 9., 11., rgb(0xffd45c), rgb(0x171208), Align::Left);
    let text = format!("{} {}", q.challenge, q.count);
    let mut line = text.clone();
    while measure_text(&line, None, 13, 1.).width > 220. && line.len() > 4 { line.truncate(line.len() - 4); line.push_str("..."); }
    stroked(&line, x + 48., y + 25., 13., rgb(0xffffff), rgb(0x171208), Align::Left);
    if q.ready { hits.push(Hit { rect: Rect::new(x, y, 270., 52.), kind: HitKind::Claim }); }
}
/// `showRewardReceipt(canvas, receipt, 'Reward Obtained', 1500)`: a centred receipt card.
pub fn toast(assets: &Assets, title: &str, resource: &str, amount: f64, hero_name: &str) {
    let (w, h) = (200., 72.);
    let (x, y) = ((WIDTH - w) / 2., 250.);
    rounded_outline(x, y, w, h, 12., rgba(0x1b1410, 0.94), rgb(0xd0a45b));
    label(title, x + w / 2., y + 16., 13., rgb(0xffd45c), Align::Center);
    if resource == "hero_ticket" { ticket_art(assets, hero_name, x + 54., y + 32., 33., 22.); } else { resource_icon(assets, resource, x + 56., y + 28., 30.); }
    let name = match resource { "hero_ticket" => format!("{} tickets", if hero_name.is_empty() { "Hero" } else { hero_name }), "essence" => "Essence".into(), "incense" => "Incense".into(), other => other.to_string() };
    label(&format!("+{} {name}", format_number(amount)), x + 96., y + 44., 14., rgb(0xfff9ed), Align::Left);
}
fn capsule(x: f32, y: f32, w: f32, h: f32, color: Color) {
    let r = (h / 2.).min(w / 2.);
    if w <= 0. { return; }
    draw_rectangle(x + r, y, (w - 2. * r).max(0.), h, color);
    draw_circle(x + r, y + h / 2., r, color);
    draw_circle(x + w - r, y + h / 2., r, color);
}

pub fn draw(assets: &Assets, m: &CombatModel, panel: Option<&Panel>, hits: &mut Vec<Hit>) {
    // Bands the arena never shows through (top strip, strip/nav area).
    draw_rectangle(0., 0., WIDTH, BAND_TOP, rgb(0x16181c));
    draw_rectangle(0., BAND_BOTTOM, WIDTH, HEIGHT - BAND_BOTTOM, rgb(0x1d1f23));
    if let Some(error) = &m.host_error { stroked("Combat host failed", 8., 12., 12., rgb(0xff8fa0), rgb(0x000000), Align::Left); paragraph(error, 8., 20., WIDTH - 60., 9., rgb(0xffd0d0)); }
    if m.summon_visible { summon(assets, m, hits); } else { progress(assets, m); }
    resources(assets, m);
    objective(assets, m, hits);
    if let Some(boss) = &m.boss { boss_hud(assets, boss, matches!(panel, Some(Panel::BossInfo)), hits); }
    party_row(assets, m, hits);
    strip(assets, m, hits);
}
/// `drawCombatProgressHud`: chapter label, wave rail with notches, party marker, boss head.
fn progress(assets: &Assets, m: &CombatModel) {
    let (x, y, w) = (HUD_LEFT, HUD_TOP, HUD_RIGHT - HUD_LEFT);
    let _ = HUD_BOTTOM;
    stroked(&format!("Chapter {}", m.chapter), x + w / 2., y + 11., 11., rgb(0xffd957), rgb(0x2d281d), Align::Center);
    let (track_x, track_y, boss_x) = (x + 11., y + 31., x + w - 11.);
    let track_w = boss_x - track_x;
    let rail_h = 5.;
    capsule(track_x, track_y - rail_h / 2., track_w, rail_h, rgb(0x253338));
    let fill = (m.progress_position / m.wave_count.max(1) as f64) as f32;
    if fill > 0. { capsule(track_x, track_y - rail_h / 2., track_w * fill, rail_h, rgb(0x55d4be)); }
    draw_rectangle_lines(track_x, track_y - rail_h / 2., track_w, rail_h, 1., rgb(0xf6ecd0));
    let notch_w = (20. / m.wave_count.max(1) as f32).max(1.);
    for notch in 1..m.wave_count.max(1) {
        let nx = track_x + track_w * notch as f32 / m.wave_count as f32;
        let reached = m.progress_position >= notch as f64;
        draw_line(nx, track_y - rail_h * 0.75, nx, track_y + rail_h * 0.75, notch_w, if reached { rgb(0x55d4be) } else { rgb(0x243237) });
    }
    let head = 16.;
    let marker_x = (track_x + track_w * fill).min(boss_x - head - 2.);
    draw_circle(marker_x, track_y, head * 0.57, rgb(0xf4d55d));
    if let Some(tex) = assets.ui.get("hero-Hondo") { portrait(tex, marker_x - head * 0.47, track_y - head * 0.47, head * 0.94, WHITE); }
    if let Some(tex) = assets.ui.get("boss-boss") { image(tex, boss_x - head / 2., track_y - head / 2., head, head); }
}
/// `updateBossSummonFallback`: chapter label and the Summon Boss button.
fn summon(assets: &Assets, m: &CombatModel, hits: &mut Vec<Hit>) {
    let (x, y) = (0., HUD_TOP - 2.);
    stroked(&format!("Chapter {}", m.chapter), x + FALLBACK_W / 2., y + 9., 13., rgb(0xffd957), rgb(0x17120b), Align::Center);
    let (bw, bh) = (150., 64.);
    let bx = x + (FALLBACK_W - bw) / 2.;
    let by = y + 18.;
    let tint = if m.summon_enabled { WHITE } else { rgba(0xffffff, 0.5) };
    if let Some(tex) = assets.ui.get("boss-boss") { image_tinted(tex, bx + (bw - 44.) / 2., by, 44., 44., tint); }
    stroked("Summon Boss", bx + bw / 2., by + 52., 12., if m.summon_enabled { rgb(0xfff5d7) } else { rgb(0xbfbcb4) }, rgb(0x17120b), Align::Center);
    if m.summon_enabled { hits.push(Hit { rect: Rect::new(bx, by, bw, bh), kind: HitKind::Summon }); }
    let _ = FALLBACK_H;
}
/// `updateBossBattleHud`: name, inspect button, HP meter, timer meter.
fn boss_hud(assets: &Assets, boss: &super::model::BossReadout, open: bool, hits: &mut Vec<Hit>) {
    let x = (WIDTH - BOSS_HUD_W) / 2.;
    let y = BOSS_HUD_TOP;
    stroked(&boss.name, x + BOSS_HUD_W / 2., y + 12.5, 16., rgb(0xfff7e1), rgb(0x21160e), Align::Center);
    let (ix, iy, isz) = (x + BOSS_HUD_W + 5. - 36., y - 7., 36.);
    if let Some(tex) = assets.ui.get("boss-inspect") { image_tinted(tex, ix + 3., iy + 3., isz - 6., isz - 6., if open { rgb(0xffe29d) } else { WHITE }); }
    hits.push(Hit { rect: Rect::new(ix, iy, isz, isz), kind: HitKind::Inspect });
    let meter = |top: f32, fraction: f32, fill: Color, icon: &str, text: Option<&str>| {
        let h = 12.;
        draw_rectangle(x - 1., top - 1., BOSS_HUD_W + 2., h + 2., rgb(0xd1ba8e));
        draw_rectangle(x, top, BOSS_HUD_W, h, rgb(0x281c15));
        draw_rectangle(x + 2., top + 2., BOSS_HUD_W - 4., h - 4., rgb(0x181a16));
        draw_rectangle(x + 2., top + 2., (BOSS_HUD_W - 4.) * fraction.clamp(0., 1.), h - 4., fill);
        if let Some(tex) = assets.ui.get(icon) { image(tex, x - 19., top - 10., 26., 26.); }
        if let Some(t) = text { stroked(t, x + BOSS_HUD_W / 2., top + h / 2. - 1., 12., rgb(0xfff7e1), rgb(0x21160e), Align::Center); }
    };
    let percent = format!("{}%", (boss.hp_fraction * 100.).ceil() as u32);
    meter(y + 30., boss.hp_fraction, rgb(0xed3455), "boss-boss", Some(&percent));
    meter(y + 52., boss.time_fraction, rgb(0x00b6d6), "boss-clock", None);
}
/// Party-wide buff icons centred above the strip (`hero-buff-party`).
fn party_row(assets: &Assets, m: &CombatModel, hits: &mut Vec<Hit>) {
    if m.party.is_empty() { return; }
    let top = STRIP_TOP - BUFF_ICON - BUFF_GAP;
    let total = m.party.len() as f32 * BUFF_ICON + (m.party.len() as f32 - 1.) * BUFF_GAP;
    let mut x = (WIDTH - total) / 2.;
    for icon in &m.party {
        buff_icon(assets, icon.icon, x, top, BUFF_ICON);
        hits.push(Hit { rect: Rect::new(x - 2., top - 2., BUFF_ICON + 4., BUFF_ICON + 4.), kind: HitKind::Party(icon.skill_id) });
        x += BUFF_ICON + BUFF_GAP;
    }
}
/// The eight hero clocks (`hero-cooldowns`).
fn strip(assets: &Assets, m: &CombatModel, hits: &mut Vec<Hit>) {
    let gap = 4.;
    let size = (STRIP_W - gap * (SLOTS as f32 - 1.)) / SLOTS as f32;
    let top = STRIP_TOP + (STRIP_H - size) / 2.;
    for (i, slot) in m.slots.iter().enumerate() {
        let x = STRIP_LEFT + i as f32 * (size + gap);
        match slot {
            None => {
                draw_rectangle(x, top, size, size, rgba(0x2a2a26, 0.7));
                draw_rectangle_lines(x, top, size, size, 1., rgb(0xa58d66));
            }
            Some(hero) => {
                draw_rectangle(x, top, size, size, rgb(0x253039));
                draw_circle(x + size / 2., top + size / 2., size * 0.55, rgb(0x667277));
                let dim = hero.status == SlotStatus::Ko;
                if let Some(tex) = assets.ui.get(hero.art) { portrait(tex, x, top, size, if dim { rgba(0x8c8c8c, 0.45) } else { WHITE }); }
                wedge(x + size / 2., top + size / 2., size / 2., hero.fraction, rgba(0x101010, 0.56));
                draw_rectangle_lines(x, top, size, size, 1., rgb(0xc4a775));
                if hero.status == SlotStatus::Ready { draw_rectangle_lines(x + 1., top + 1., size - 2., size - 2., 1., rgb(0xffd971)); }
                let badge = size * 0.3;
                let mut bx = x + size * 0.04;
                for group in &hero.badges { buff_icon(assets, &format!("hero-{group}"), bx, top + size * 0.97 - badge, badge, ); bx += badge + size * 0.02; }
                hits.push(Hit { rect: Rect::new(x, top, size, size), kind: HitKind::Hero(hero.key) });
            }
        }
    }
}
/// Modal panels: boss stats, a hero's Special, a Party Skill entry.
pub fn panel(assets: &Assets, panel: &Panel, m: &CombatModel, hits: &mut Vec<Hit>) {
    let _ = assets;
    match panel {
        Panel::BossInfo => {
            let Some(boss) = &m.boss else { return };
            let (x, y, w) = ((WIDTH - 250.) / 2., BOSS_HUD_TOP + 77., 250.);
            let row_h = 31.;
            let h = 24. + row_h * boss.rows.len() as f32;
            draw_rectangle(x - 2., y - 2., w + 4., h + 4., rgb(0x302218));
            draw_rectangle(x, y, w, h, rgb(0x3d2b21));
            draw_rectangle_lines(x, y, w, h, 3., rgb(0xaa8960));
            for (i, (name, value)) in boss.rows.iter().enumerate() {
                let cy = y + 12. + row_h * (i as f32 + 0.5);
                label(name, x + 13., cy, 13., rgb(0xd9b88c), Align::Left);
                label(value, x + w - 13., cy, 13., rgb(0xfff9ed), Align::Right);
                if i == 0 { draw_line(x + 13., y + 12. + row_h, x + w - 13., y + 12. + row_h, 1., rgb(0x72553b)); }
            }
            hits.push(Hit { rect: Rect::new(x, y, w, h), kind: HitKind::PanelBody });
        }
    }
}
fn paragraph_height(text: &str, width: f32, size: f32) -> f32 {
    let line_h = size * 1.3;
    let mut lines = 0.;
    let mut line = String::new();
    for word in text.split_whitespace() {
        let candidate = if line.is_empty() { word.to_string() } else { format!("{line} {word}") };
        if measure_text(&candidate, None, size as u16, 1.).width > width && !line.is_empty() { lines += 1.; line = word.to_string(); } else { line = candidate; }
    }
    if !line.is_empty() { lines += 1.; }
    lines * line_h
}
