//! Combat chrome drawing + hit zones. Geometry is the JS layout (360x640 frame).
use super::model::{CombatModel, SlotStatus, SLOTS};
use super::{Panel, Screen};
use crate::assets::Assets;
use crate::camera::{BAND_BOTTOM, BAND_TOP, HEIGHT, WIDTH};
use macroquad::prelude::*;
use wf_meta::hero;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum HitKind { Nav(Screen), Summon, Inspect, Hero(&'static str), Party(&'static str), Continue, PanelBody }
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
#[derive(Clone, Copy, PartialEq)]
pub enum Align { Left, Center, Right }
/// Text with its vertical centre at `cy`.
pub fn label(text: &str, x: f32, cy: f32, size: f32, color: Color, align: Align) -> f32 {
    let d = measure_text(text, None, size as u16, 1.);
    let x = match align { Align::Left => x, Align::Center => x - d.width / 2., Align::Right => x - d.width };
    draw_text(text, x, cy + d.offset_y - d.height / 2., size, color);
    d.width
}
pub fn stroked(text: &str, x: f32, cy: f32, size: f32, fill: Color, stroke: Color, align: Align) {
    for (dx, dy) in [(-1., 0.), (1., 0.), (0., -1.), (0., 1.), (0., 2.)] { label(text, x + dx, cy + dy, size, stroke, align); }
    label(text, x, cy, size, fill, align);
}
/// Word-wrapped paragraph; returns the height used.
pub fn paragraph(text: &str, x: f32, top: f32, width: f32, size: f32, color: Color) -> f32 {
    let line_h = size * 1.3;
    let mut y = top + line_h * 0.5;
    let mut line = String::new();
    for word in text.split_whitespace() {
        let candidate = if line.is_empty() { word.to_string() } else { format!("{line} {word}") };
        if measure_text(&candidate, None, size as u16, 1.).width > width && !line.is_empty() {
            label(&line, x, y, size, color, Align::Left);
            y += line_h;
            line = word.to_string();
        } else { line = candidate; }
    }
    if !line.is_empty() { label(&line, x, y, size, color, Align::Left); y += line_h; }
    y - top
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
const BUFF_FRAMES: [&str; 17] = ["party-spd", "party-atk", "party-mag", "party-def", "party-res", "party-hp", "party-cr", "party-cd", "party-range", "party-dr", "party-ward", "party-heal", "party-special", "party-reflect", "hero-tempo", "hero-offense", "hero-defense"];
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
/// `renderExistingNavigation`: DAILY / HERO / QUESTS / VAULT / POWER UP.
pub fn nav(assets: &Assets, screen: Screen, hits: &mut Vec<Hit>) {
    draw_rectangle(0., NAV_TOP, WIDTH, NAV_H, rgb(0x2e3133));
    draw_rectangle(0., NAV_TOP, WIDTH, 3., rgb(0xc9a359));
    let items: [(&str, &str, Option<Screen>); 5] = [("DAILY", "nav-daily", None), ("HERO", "nav-hero", Some(Screen::Hero)), ("QUESTS", "nav-quests", Some(Screen::Quests)), ("VAULT", "nav-vault", Some(Screen::Vault)), ("POWER UP", "nav-power-up", Some(Screen::PowerUp))];
    let w = (WIDTH - 8. - 2. * 4.) / 5.;
    for (i, (text, icon, target)) in items.iter().enumerate() {
        let x = 4. + i as f32 * (w + 2.);
        let active = target.is_some_and(|t| t.nav_label() == screen.nav_label());
        if active { draw_rectangle(x, NAV_TOP + 3., w, NAV_H - 5., rgba(0xc9a359, 0.18)); }
        let tint = if target.is_none() { rgba(0xffffff, 0.45) } else { WHITE };
        if let Some(tex) = assets.ui.get(*icon) { image_tinted(tex, x + (w - 43.) / 2., NAV_TOP + 6., 43., 40., tint); }
        label(text, x + w / 2., NAV_TOP + 52., 9., if target.is_none() { rgb(0xbfbcb4) } else { rgb(0xfff7e6) }, Align::Center);
        if let Some(t) = target { hits.push(Hit { rect: Rect::new(x, NAV_TOP, w, NAV_H), kind: HitKind::Nav(*t) }); }
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
        Panel::HeroSpecial(key) => {
            let Some(special) = hero::special_text(key) else { return };
            let passive = hero::passive_text(key);
            let name = hero::hero_definition(key).map_or(*key, |d| d.name);
            card(&format!("{name} - {}", special.name), &[("Special", special.condition, special.description), ("Passive", passive.map_or("", |p| p.condition), passive.map_or("", |p| p.description))], hits);
        }
        Panel::PartySkill(id) => {
            let Some(entry) = hero::PARTY_SKILLS.iter().find(|p| p.id == *id || p.skill_id == *id) else { return card("Party buff", &[("", "", "No catalog entry for this buff.")], hits) };
            card(&format!("{} - {}", entry.hero, entry.name), &[("Party Skill", entry.values.join(" / ").leak(), entry.effect)], hits);
        }
    }
}
fn card(title: &str, sections: &[(&str, &str, &str)], hits: &mut Vec<Hit>) {
    draw_rectangle(0., 0., WIDTH, HEIGHT, rgba(0x000000, 0.45));
    let (x, w) = (20., WIDTH - 40.);
    let mut h = 48.;
    let body: Vec<f32> = sections.iter().map(|(_, _, d)| paragraph_height(d, w - 26., 12.) + 34.).collect();
    h += body.iter().sum::<f32>();
    let y = 140.;
    draw_rectangle(x - 2., y - 2., w + 4., h + 4., rgb(0x302218));
    draw_rectangle(x, y, w, h, rgb(0x3d2b21));
    draw_rectangle_lines(x, y, w, h, 3., rgb(0xaa8960));
    label(title, x + w / 2., y + 20., 15., rgb(0xfff9ed), Align::Center);
    let mut cy = y + 42.;
    for ((heading, condition, description), bh) in sections.iter().zip(body) {
        let head = if condition.is_empty() { heading.to_string() } else { format!("{heading}: {condition}") };
        label(&head, x + 13., cy + 8., 11., rgb(0xffd45c), Align::Left);
        paragraph(description, x + 13., cy + 20., w - 26., 12., rgb(0xfff9ed));
        cy += bh;
    }
    label("tap to close", x + w / 2., y + h - 10., 10., rgba(0xfff9ed, 0.6), Align::Center);
    hits.push(Hit { rect: Rect::new(x, y, w, h), kind: HitKind::PanelBody });
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
