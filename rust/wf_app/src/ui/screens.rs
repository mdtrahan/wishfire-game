//! Meta screens reached from the nav, translated from `renderHeroScreen.js` + `heroGearUI.mjs`
//! (Hero), `createTrainingGroundUI` in `combatProgressionUI.mjs` (Power Up) and `renderChests.js`
//! (Vault). The routing is the JS one (`storyEntryFlow.navigate`): leaving combat pauses it,
//! Quests shows the pause gate until bead ORKA-63bf.10 lands the real page.
use super::chrome::{self, rgb, rgba, rounded, rounded_outline, Align, Hit, HitKind, Weight, NAV_TOP};
use super::Screen;
use crate::assets::Assets;
use crate::camera::WIDTH;
use crate::game::Game;
use macroquad::prelude::*;
use wf_host::progress::HeroProgress;
use wf_meta::combat_power::{compute_combat_power, CpActor};
use wf_meta::equipment::{rarity, SLOTS};
use wf_meta::hero::{self, SkillText, STAR_MAX};
use wf_meta::progression::{hero_ticket_level_cost, training_cost, TRAINING_BONUS_PER_LEVEL, TRAINING_STATS};

/// `renderHeroScreen` module state.
pub struct HeroUi { pub index: usize, pub tab: u8, pub sheet: bool, pub skill: usize, pub ticket_notice: String, pub sheet_notice: String, pub gear_slot: u8, seen_index: Option<usize> }
impl Default for HeroUi { fn default() -> Self { Self { index: 0, tab: 0, sheet: false, skill: 4, ticket_notice: String::new(), sheet_notice: String::new(), gear_slot: 0, seen_index: None } } }
/// `createTrainingGroundUI` state: tab (0 Training Ground, 1 Party Skills) and the status line.
#[derive(Default)]
pub struct TrainingUi { pub tab: u8, pub status: String }
/// `gameState.chestsLayout` state: the active tier tab.
#[derive(Default)]
pub struct VaultUi { pub tab: u8 }

/// Canonical records in `HERO_DEFINITIONS` order (`roster` in renderHeroScreen).
pub fn roster(game: &Game) -> Vec<&HeroProgress> { hero::HERO_DEFINITIONS.iter().filter_map(|d| game.session.progress.heroes.get(d.key)).collect() }
pub fn hero_index(ui: &HeroUi, len: usize) -> usize { if len == 0 { 0 } else { ui.index % len } }

pub fn draw(assets: &Assets, screen: Screen, game: &Game, hero_ui: &mut HeroUi, training_ui: &TrainingUi, vault_ui: &VaultUi, hits: &mut Vec<Hit>) {
    match screen {
        Screen::Hero => hero_screen(assets, game, hero_ui, hits),
        Screen::PowerUp => training_ground(assets, game, training_ui, hits),
        Screen::Vault => vault(assets, vault_ui, hits),
        Screen::Quests => {
            draw_rectangle(0., 0., WIDTH, NAV_TOP, rgb(0x241c17));
            chrome::label("Quests", WIDTH / 2., 28., 20., rgb(0xfff9ed), Align::Center);
            draw_line(20., 46., WIDTH - 20., 46., 1., rgb(0xaa8960));
            chrome::paragraph("Combat is paused. The quest map, ladder and opening narrative arrive with bead ORKA-63bf.10.", 24., 70., WIDTH - 48., 13., rgba(0xfff9ed, 0.8));
            let (bx, by, bw, bh) = ((WIDTH - 160.) / 2., 160., 160., 44.);
            draw_rectangle(bx, by, bw, bh, rgb(0x25454a));
            draw_rectangle_lines(bx, by, bw, bh, 2., rgb(0xd0a45b));
            chrome::label("Continue battle", bx + bw / 2., by + bh / 2., 14., rgb(0xfff9ed), Align::Center);
            hits.push(Hit { rect: Rect::new(bx, by, bw, bh), kind: HitKind::Continue });
        }
        Screen::Combat => {}
    }
}
fn button(text: &str, x: f32, y: f32, w: f32, h: f32, size: f32, fill: Color, stroke: Color, ink: Color, enabled: bool, kind: HitKind, hits: &mut Vec<Hit>) {
    let (fill, ink, stroke) = if enabled { (fill, ink, stroke) } else { (rgb(0xe3e6ea), rgb(0x7d8794), rgb(0xb8bfc8)) };
    rounded_outline(x, y, w, h, 6., fill, stroke);
    chrome::label(text, x + w / 2., y + h / 2., size, ink, Align::Center);
    if enabled { hits.push(Hit { rect: Rect::new(x, y, w, h), kind }); }
}
fn contain_bottom(tex: &Texture2D, x: f32, y: f32, w: f32, h: f32) { contain_bottom_tinted(tex, x, y, w, h, WHITE); }
/// `object-fit: contain; object-position: 50% 100%`.
fn contain_bottom_tinted(tex: &Texture2D, x: f32, y: f32, w: f32, h: f32, tint: Color) {
    let (tw, th) = (tex.width(), tex.height());
    let s = (w / tw).min(h / th);
    draw_texture_ex(tex, x + (w - tw * s) / 2., y + h - th * s, tint, DrawTextureParams { dest_size: Some(vec2(tw * s, th * s)), ..Default::default() });
}

// ---------------------------------------------------------------- Hero (renderHeroScreen.js)
// Geometry is main's live DOM at 360x640 (font-size 14px => 1em = 14px); see output/fable-reference.
const PAD_X: f32 = 12.; const PAD_TOP: f32 = 14.; const PAD_BOTTOM: f32 = 66.;
const IDENTITY_H: f32 = 294.;
/// `.hero-actions button` / `.sheet-action`: cream gradient, 1px #b99c66 border, solid 1.38px shadow.
fn action_button(text: &str, x: f32, y: f32, w: f32, h: f32, enabled: bool, kind: HitKind, hits: &mut Vec<Hit>) {
    let r = 5.74;
    if enabled {
        rounded(x, y + 1.38, w, h, r, rgb(0xb99c66));
        rounded(x, y, w, h, r, rgb(0xb99c66));
        let face = chrome::baked("action-face", w - 2., h - 2., [r - 1.; 4], &|_, v| chrome::stops(&[(0., rgb(0xfffaf0)), (1., rgb(0xf1e2bf))], v));
        chrome::draw_baked(&face, x + 1., y + 1., w - 2., h - 2.);
        chrome::label_w(text, x + w / 2., y + h / 2., 11.48, Weight::ExtraBold, rgb(0x1d3150), Align::Center);
        hits.push(Hit { rect: Rect::new(x, y, w, h), kind });
    } else {
        rounded_outline(x, y, w, h, r, rgb(0xe3e6ea), rgb(0xb8bfc8));
        chrome::label_w(text, x + w / 2., y + h / 2., 11.48, Weight::ExtraBold, rgb(0x7d8794), Align::Center);
    }
}
/// `.stars`: eight ★ glyphs (1.15em = 16.1px) in 16px spans with a .1em gap, centred on `cx`.
fn stars_row(cx: f32, cy: f32, count: u32, size: f32) {
    let step = size / 16.1 * 17.42;
    for slot in 0..STAR_MAX {
        let x = cx + (slot as f32 - (STAR_MAX as f32 - 1.) / 2.) * step;
        let color = if slot < count { rgb(0xd0884a) } else { rgb(0x59667a) };
        super::text::draw_shadowed("★", x, cy, size, Weight::Regular, color, Align::Center, (0., 1., rgba(0x0b1626, 0.9)));
    }
}
fn pct(value: f64) -> String { let v = (value * 1000.).round() / 10.; let t = format!("{v:.1}"); format!("{}%", t.trim_end_matches('0').trim_end_matches('.')) }
/// `.hero-ticket-art`: `background-size 240%` quadrant of hero-tickets.png at `TICKET_QUADRANT`.
fn ticket_art(assets: &Assets, hero_name: &str, x: f32, y: f32, w: f32, h: f32) {
    let Some(tex) = assets.ui.get("prog-hero-tickets") else { return };
    // background-position p% => offset p * (box - 2.4 box) = -1.4 p box; the box shows 1/2.4 of the image.
    let (px, py) = match hero_name { "Hondo" => (0.94, 0.12), "Kaja" => (0.12, 0.89), "Runa" => (0.94, 0.89), _ => (0.12, 0.12) };
    let frac = |p: f32| 1.4 * p / 2.4;
    let src = Rect::new(frac(px) * tex.width(), frac(py) * tex.height(), tex.width() / 2.4, tex.height() / 2.4);
    let params = || DrawTextureParams { dest_size: Some(vec2(w, h)), source: Some(src), ..Default::default() };
    draw_texture_ex(tex, x, y + 1., rgba(0x14213a, 0.6), params());
    draw_texture_ex(tex, x, y, WHITE, params());
}
fn hero_screen(assets: &Assets, game: &Game, ui: &mut HeroUi, hits: &mut Vec<Hit>) {
    // #hero-details: linear-gradient(#20385c, #1a2840 60%, #121c2c) over the whole 640px stage.
    let page = chrome::baked("hero-page", WIDTH, NAV_TOP, [0.; 4], &|_, v| chrome::stops(&[(0., rgb(0x20385c)), (0.6, rgb(0x1a2840)), (1., rgb(0x121c2c))], v * NAV_TOP / 640.));
    chrome::draw_baked(&page, 0., 0., WIDTH, NAV_TOP);
    let roster = roster(game);
    if roster.is_empty() { return; }
    let index = hero_index(ui, roster.len());
    if ui.seen_index != Some(index) { ui.seen_index = Some(index); ui.skill = 4; ui.ticket_notice.clear(); ui.sheet_notice.clear(); }
    let hero = roster[index];
    let definition = hero.definition();
    let key = definition.key;
    let name = definition.name;
    let stars = game.progression.state.hero_stars(&hero.hero_instance_key);
    let tickets = game.progression.ticket_count(&hero.hero_instance_key);
    let (cw, bottom) = (WIDTH - 2. * PAD_X, 640. - PAD_BOTTOM);
    // .identity (12,14,336,294): radial light at 28% 52% plus the ::after ground ellipse.
    let (ix, iy, iw, ih) = (PAD_X, PAD_TOP, cw, IDENTITY_H);
    let identity = chrome::baked("identity", iw, ih, [8.4; 4], &|u, v| {
        let t = (((u - 0.28) / 0.6).powi(2) + ((v - 0.52) / 0.55).powi(2)).sqrt();
        let base = chrome::stops(&[(0., rgb(0x4f7fa8)), (0.45, rgb(0x2d5079)), (1., rgb(0x1b3150))], t);
        // ::after: left 4%, width 48%, bottom 5.3em, height 1.6em; radial(#0b1626aa, transparent 70%).
        let (gu, gv) = ((u - 0.28) / 0.24, (v - (ih - 74.2 - 11.2) / ih) / (11.2 / ih));
        let g = (gu * gu + gv * gv).sqrt();
        let a = (1. - g / 0.7).clamp(0., 1.) * 0.667;
        chrome::mix(base, rgb(0x0b1626), a)
    });
    chrome::draw_baked(&identity, ix, iy, iw, ih);
    // .hero-portrait: left 2%, width 52%, top .6em, height 100% - 6.2em, contain at 50% 100%,
    // drop-shadow(0 .3em .25em #07172a80).
    let (ppx, ppy, ppw, pph) = (ix + iw * 0.02, iy + 8.4, iw * 0.52, ih - 86.8);
    if let Some(tex) = assets.ui.get(super::model::hero_art(key)) {
        for (dx, dy) in [(-1.5, 4.2), (1.5, 4.2), (0., 2.7), (0., 5.7)] { contain_bottom_tinted(tex, ppx + dx, ppy + dy, ppw, pph, rgba(0x07172a, 0.16)); }
        contain_bottom(tex, ppx, ppy, ppw, pph);
    }
    // .hero-arrows: top 38%, 2em 800 glyphs with text-shadow 0 1px 4px #07172a.
    let ay = iy + ih * 0.38 + 14.;
    super::text::draw_shadowed("‹", ix + 13.06, ay, 28., Weight::ExtraBold, rgb(0xcfe9ff), Align::Center, (0., 1., rgba(0x07172a, 0.8)));
    hits.push(Hit { rect: Rect::new(ix, ay - 20., 36., 40.), kind: HitKind::HeroPrev });
    super::text::draw_shadowed("›", ix + iw * 0.56 - 13.06, ay, 28., Weight::ExtraBold, rgb(0xcfe9ff), Align::Center, (0., 1., rgba(0x07172a, 0.8)));
    hits.push(Hit { rect: Rect::new(ix + iw * 0.56 - 36., ay - 20., 36., 40.), kind: HitKind::HeroNext });
    // .hero-name h1 (18.72,247.125,174.72,32.9): gradient plate, 2px #b88e3c border, radius .6em.
    let (nx, nw, nh) = (ix + iw * 0.02, iw * 0.52, 32.9);
    let ny = iy + ih - 7.7 - 16.1 - 4.2 - nh;
    chrome::box_shadow(nx, ny, nw, nh, 10.92, 0., 2.73, 5.46, rgba(0x07172a, 0.5));
    rounded(nx, ny, nw, nh, 10.92, rgb(0xb88e3c));
    let plate = chrome::baked("nameplate", nw - 4., nh - 4., [8.92; 4], &|_, v| chrome::stops(&[(0., rgb(0xfff8e4)), (1., rgb(0xecd7a4))], v));
    chrome::draw_baked(&plate, nx + 2., ny + 2., nw - 4., nh - 4.);
    chrome::label_w(name, nx + nw / 2., ny + nh / 2., 18.2, Weight::Bold, rgb(0x2a2010), Align::Center);
    stars_row(nx + nw / 2., ny + nh + 4.2 + 8.05, stars, 16.1);
    // .skill-panel (197.23,52.5,144.47,249.2): 2px #f2c75c border, 2px #1b2a42 ring, soft shadow.
    let (px, py, pw, ph) = (ix + iw - 6.3 - iw * 0.43, iy + 38.5, iw * 0.43, ih - 38.5 - 6.3);
    chrome::box_shadow(px - 2., py - 2., pw + 4., ph + 4., 9.7, 0., 4.9, 11.2, rgba(0x050b16, 0.69));
    rounded(px - 2., py - 2., pw + 4., ph + 4., 9.7, rgb(0x1b2a42));
    rounded(px, py, pw, ph, 7.7, rgb(0xf2c75c));
    let (bx, by, bw, bh) = (px + 2., py + 2., pw - 4., ph - 4.);
    rounded(bx, by, bw, bh, 5.7, rgb(0xfffdf7));
    let entries: [Option<SkillText>; 5] = { let r = hero::resonance_texts(key).unwrap(); [hero::special_text(key), hero::passive_text(key), Some(r[0]), Some(r[1]), None] };
    ui.skill = ui.skill.min(4);
    // footer (199.23,272.84,140.47,26.86)
    let footer_h = 26.86;
    let fy0 = by + bh - footer_h;
    chrome::rounded_corners(bx, fy0, bw, footer_h, [0., 0., 5.7, 5.7], rgb(0x1b2a42));
    let fy = fy0 + footer_h / 2.;
    chrome::label_w("‹", bx + 4.9 + 8.02, fy, 15.4, Weight::ExtraBold, rgb(0xffd56e), Align::Center); hits.push(Hit { rect: Rect::new(bx, fy0, 30., footer_h), kind: HitKind::SkillPrev });
    chrome::label_w("›", bx + bw - 4.9 - 8.02, fy, 15.4, Weight::ExtraBold, rgb(0xffd56e), Align::Center); hits.push(Hit { rect: Rect::new(bx + bw - 30., fy0, 30., footer_h), kind: HitKind::SkillNext });
    chrome::label(&format!("{} / 5", ui.skill + 1), bx + bw / 2., fy, 10.08, rgb(0xc9d6e6), Align::Center);
    // article: padding .4em .5em at .74em (10.36px); h2 1.3em/1.15; small .25em margins; p .3em margins (collapsed).
    let locked = matches!(ui.skill, 2 | 3);
    let (skill_id, display, tag) = match &entries[ui.skill] {
        Some(t) => (t.id, t.name, if locked { "Late-game resonance · Not yet available" } else if ui.skill == 1 { "Passive" } else { "Special" }),
        None => ("basic_attack", "Basic Attack", "Always available"),
    };
    let (tx, tw) = (bx + 5.18, bw - 2. * 5.18);
    let mut ty = by + 4.144;
    chrome::label_w(display, tx, ty + 15.49 / 2., 13.468, Weight::Bold, rgb(0x13213a), Align::Left); ty += 15.49;
    ty += 2.16;
    let tag_w = (chrome::measure(tag, 8.633, Weight::Bold) + 2. * 3.885).min(tw);
    rounded(tx, ty, tag_w, 12.5, 5.18, if locked { rgb(0xeceff3) } else { rgb(0xdff3ea) });
    chrome::label_w(tag, tx + 3.885, ty + 6.25, 8.633, Weight::Bold, if locked { rgb(0x5b6678) } else { rgb(0x1f6a4f) }, Align::Left);
    ty += 12.5 + 2.16;
    let copy = hero::skill_copy(skill_id, key);
    let mut first = true;
    let mut p = |text: &str, weight: Weight, color: Color, ty: &mut f32| {
        let (size, line_h) = if first { (10.36, 13.986) } else { (9.5312, 12.8671) };
        first = false;
        *ty += 3.108;
        *ty += chrome::paragraph_w(text, tx, *ty, tw, size, line_h, weight, color);
    };
    for line in &copy.lines { p(line, Weight::Regular, rgb(0x1b2a42), &mut ty); }
    if ui.skill == 0 || ui.skill == 4 {
        let seconds = if ui.skill == 4 { "0".to_string() } else { hero::format_special_cooldown(key, stars) };
        let range = if ui.skill == 4 { "Screen width".to_string() } else { hero::special_range_text(skill_id) };
        let provisional = ui.skill == 0 && hero::PROVISIONAL_SPECIAL_COOLDOWNS.contains(&skill_id);
        p(&format!("Range: {range} · Cooldown: {seconds}s{}", if provisional { " (provisional)" } else { "" }), Weight::SemiBold, rgb(0x3a4d6a), &mut ty);
    }
    for rule in &copy.rules { if ty > fy0 - 14. { break; } p(rule, Weight::Regular, rgb(0x1b2a42), &mut ty); }
    // .tabs (12,313.6,336,32.2): three buttons, gap .3em, min-height 2.3em, 700 14px.
    let tabs_y = iy + ih + 5.6;
    let tab_w = (cw - 2. * 4.2) / 3.;
    for (i, label) in ["Heroes", "Gear", "Resonance"].iter().enumerate() {
        let x = ix + i as f32 * (tab_w + 4.2);
        let selected = ui.tab == i as u8;
        rounded_outline(x, tabs_y, tab_w, 32.2, 6.3, if selected { rgb(0xfff3d8) } else { rgb(0x1d3150) }, if selected { rgb(0xfff3d8) } else { rgb(0x3f5675) });
        chrome::label_w(label, x + tab_w / 2., tabs_y + 16.1, 14., Weight::Bold, if selected { rgb(0x163052) } else { rgb(0xc8d5e6) }, Align::Center);
        hits.push(Hit { rect: Rect::new(x, tabs_y, tab_w, 32.2), kind: HitKind::HeroTab(i as u8) });
    }
    // .pane (12,351.4,336,222.6): padding .55em .6em.
    let (vx, vy, vw, vh) = (ix, tabs_y + 32.2 + 5.6, cw, bottom - (tabs_y + 32.2 + 5.6));
    rounded(vx, vy, vw, vh, 6.3, rgb(0xfff4df));
    let (qx, qy, qw) = (vx + 8.4, vy + 7.7, vw - 16.8);
    match ui.tab {
        0 => {
            // .roster: 4 columns, gap .45em; .card-select aspect 1/1.05, 2px border, radius .4em.
            let gap = 6.3;
            let card_w = (qw - 3. * gap) / 4.;
            let card_h = card_w * 1.05;
            let strip_h = 49.67;
            for (i, member) in roster.iter().enumerate() {
                let x = qx + i as f32 * (card_w + gap);
                let d = member.definition();
                let selected = i == index;
                // .ticket-strip sits under the card (margin-top -1.1em, z below the card-select).
                let (sx, sy, sw) = (x + 0.98, qy + card_h - 15.4, card_w - 1.96);
                chrome::box_shadow(sx, sy, sw, strip_h, 7., 0., 1.4, 2.8, rgba(0x0b1626, 0.33));
                let strip = chrome::baked("ticket-strip", sw, strip_h, [0., 0., 7., 7.], &|_, v| chrome::stops(&[(0., rgb(0x2a3446)), (1., rgb(0x1c2433))], v));
                chrome::draw_baked(&strip, sx, sy, sw, strip_h);
                let border = if selected { rgb(0x2fb3a6) } else { rgb(0x6b8590) };
                if selected { rounded(x - 2., qy - 2., card_w + 4., card_h + 4., 7.6, rgba(0x2fb3a6, 0.33)); }
                rounded(x, qy, card_w, card_h, 5.6, border);
                let face = chrome::baked("roster-face", card_w - 4., card_h - 4., [3.6; 4], &|u, v| {
                    let t = (((u - 0.5) / 0.75).powi(2) + ((v - 0.38) / 0.65).powi(2)).sqrt();
                    chrome::stops(&[(0., WHITE), (0.55, rgb(0xeef2f6)), (1., rgb(0xd5dce5))], t)
                });
                chrome::draw_baked(&face, x + 2., qy + 2., card_w - 4., card_h - 4.);
                if let Some(tex) = assets.ui.get(super::model::hero_art(d.key)) {
                    // img: left -40%, top -2%, width 180% of the content box, height auto, clipped.
                    let (cx, cy, ccw, cch) = (x + 2., qy + 2., card_w - 4., card_h - 4.);
                    let img_w = 1.8 * ccw;
                    let img_h = img_w * tex.height() / tex.width();
                    let (off_x, off_y) = (0.4 * ccw, 0.02 * ccw);
                    let src = Rect::new(off_x / img_w * tex.width(), off_y / img_h * tex.height(), ccw / img_w * tex.width(), (cch / img_h * tex.height()).min(tex.height() - off_y / img_h * tex.height()));
                    let dest_h = src.h / tex.height() * img_h;
                    draw_texture_ex(tex, cx, cy, WHITE, DrawTextureParams { dest_size: Some(vec2(ccw, dest_h)), source: Some(src), ..Default::default() });
                    chrome::clip_corners(cx, cy, ccw, cch, 3.6, border);
                }
                hits.push(Hit { rect: Rect::new(x, qy, card_w, card_h), kind: HitKind::Roster(i) });
                // .ticket-bar: 86% of the strip content, 1.3em tall, radius 1em, inset top shadow.
                let balance = game.progression.ticket_count(&member.hero_instance_key);
                let cost = hero_ticket_level_cost(member.current_level as f64);
                let maxed = member.current_level >= member.max_level;
                let (bar_w, bar_h) = ((sw - 7.) * 0.86, 18.2);
                let (bx, by) = (sx + 3.5 + (sw - 7. - bar_w) / 2., sy + 23.1);
                let bar = chrome::baked("ticket-bar", bar_w, bar_h, [9.1; 4], &|_, v| chrome::mix(rgb(0x0a0e15), BLACK, 0.8 * (1. - v * bar_h / 3.5).clamp(0., 1.)));
                chrome::draw_baked(&bar, bx, by, bar_w, bar_h);
                let fill = if maxed { 1. } else { (balance / cost).min(1.) as f32 };
                if fill > 0. {
                    let fw = ((bar_w * fill * 2.).round() / 2.).max(bar_h);
                    let fill_tex = chrome::baked("ticket-fill", fw, bar_h, [9.1; 4], &|_, v| {
                        let c = chrome::stops(&[(0., rgb(0x9cecff)), (0.4, rgb(0x38b8ff)), (1., rgb(0x1a8cff))], v);
                        chrome::mix(c, WHITE, 0.7 * (1. - v * bar_h / 1.68).clamp(0., 1.))
                    });
                    chrome::draw_baked(&fill_tex, bx, by, fw, bar_h);
                }
                ticket_art(assets, d.name, sx - 5.6, sy + strip_h - 10.78 - 13.58, 20.3, 13.58);
                let text = if maxed { "MAX".to_string() } else { format!("{}/{}", super::model::format_number(balance), super::model::format_number(cost)) };
                chrome::stroked_w(&text, bx + 3.85 + (bar_w - 3.85) / 2., by + bar_h / 2., 7.7, Weight::ExtraBold, WHITE, rgb(0x14213a), Align::Center);
            }
            // .hero-actions: margin-top .6em after the roster, 3 columns, gap .4em, 2.2em tall at .82em.
            let ay = qy + card_h - 15.4 + strip_h + 8.4;
            let bw = (qw - 2. * 5.6) / 3.;
            let cost = hero_ticket_level_cost(hero.current_level as f64);
            let maxed = hero.current_level >= hero.max_level;
            action_button("Level Up", qx, ay, bw, 25.25, !maxed && tickets >= cost, HitKind::LevelUp, hits);
            action_button("Star Up", qx + bw + 5.6, ay, bw, 25.25, true, HitKind::StarOpen, hits);
            if !ui.ticket_notice.is_empty() { chrome::paragraph_w(&ui.ticket_notice, qx, ay + 25.25 + 7., qw, 11.2, 15.12, Weight::Regular, rgb(0x36465c)); }
        }
        1 => {
            // heroGearUI.mjs: Hat, Body, Boots + Accessory (no source yet)
            let (slot_size, gap) = (57.4, 6.3);
            let total = 4. * slot_size + 3. * gap;
            let sx0 = qx + (qw - total) / 2.;
            let economy = game.economy.data();
            let mut detail: Option<(String, String, String)> = None;
            for i in 0..4u8 {
                let x = sx0 + i as f32 * (slot_size + gap);
                let (slot, slot_label) = if i < 3 { SLOTS[i as usize] } else { ("accessory", "Accessory") };
                let item = economy.and_then(|e| if i < 3 { e.loadouts.get(&hero.hero_instance_key).and_then(|l| l.get(slot)).and_then(|id| e.item(id)) } else { None });
                let color = item.map_or(rgb(0x758597), |it| rgb(rarity(&it.rarity).map_or(0xf3f3ee, |r| r.color)));
                rounded_outline(x, qy, slot_size, slot_size, 7., rgb(0x182843), color);
                if ui.gear_slot == i { draw_rectangle_lines(x - 3., qy - 3., slot_size + 6., slot_size + 6., 2., rgb(0xe2a92c)); }
                match item {
                    Some(it) => { super::lamp::gear_art(assets, it, x + 4., qy + 4., slot_size - 8.); chrome::stroked(&format!("Lv.{}", it.level), x + slot_size / 2., qy + 8., 9., WHITE, rgb(0x000000), Align::Center); }
                    None => { chrome::label(slot_label, x + slot_size / 2., qy + 9., 9., WHITE, Align::Center); chrome::label("Empty", x + slot_size / 2., qy + slot_size / 2. + 4., 9., rgb(0xc3cbd8), Align::Center); }
                }
                hits.push(Hit { rect: Rect::new(x, qy, slot_size, slot_size), kind: HitKind::GearSlot(i) });
                if ui.gear_slot == i {
                    detail = Some(match item {
                        Some(it) => (it.name.clone(), format!("{} - Lv. {}", rarity(&it.rarity).map_or(it.rarity.as_str(), |r| r.label), it.level), it.stats.iter().map(|(k, v)| format!("{} +{}", if k == "MAG" { "MATK" } else { k }, v)).collect::<Vec<_>>().join(" - ")),
                        None => (format!("{slot_label} - Empty"), String::new(), if i == 3 { "Orb - No source available yet.".into() } else { "Inspect lamp results to equip this slot.".into() }),
                    });
                }
            }
            if economy.is_none() { detail = Some(("Loading equipment...".into(), String::new(), String::new())); }
            let dy = qy + slot_size + 4.2;
            rounded(qx, dy, qw, 52., 7., rgb(0x1b2a42));
            if let Some((title, sub, body)) = &detail {
                chrome::label(title, qx + qw / 2., dy + 12., 12., rgb(0xfff4d6), Align::Center);
                if !sub.is_empty() { chrome::label(sub, qx + qw / 2., dy + 27., 10., rgb(0xb9c8da), Align::Center); }
                chrome::label(body, qx + qw / 2., dy + 42., 10., rgb(0xfff4d6), Align::Center);
            }
            // stat block at the pane bottom
            let cp = compute_combat_power(CpActor::new(hero.current_level as f64, hero.stats.atk, hero.stats.mag, hero.stats.def, hero.stats.res, hero.max_hp, hero.stats.spd));
            let cell_h = 28.;
            let grid_y = vy + vh - 7.7 - 2. * cell_h - 4.2;
            chrome::label(&format!("Lv. {}", hero.current_level), qx, grid_y - 12., 11., rgb(0x36465c), Align::Left);
            chrome::label(&format!("CP {}", super::model::format_number(cp)), qx + qw, grid_y - 12., 11., rgb(0x36465c), Align::Right);
            let cell_w = (qw - 2. * 4.2) / 3.;
            for (i, (label, value, icon)) in [("HP", hero.max_hp, None), ("ATK", hero.stats.atk, Some("prog-stat-atk")), ("DEF", hero.stats.def, Some("prog-stat-def")), ("MATK", hero.stats.mag, Some("prog-stat-matk")), ("RES", hero.stats.res, Some("prog-stat-res")), ("SPD", hero.stats.spd, None)].iter().enumerate() {
                let x = qx + (i % 3) as f32 * (cell_w + 4.2);
                let y = grid_y + (i / 3) as f32 * (cell_h + 4.2);
                rounded(x, y, cell_w, cell_h, 5., rgb(0x1b2a42));
                match icon.and_then(|n| assets.ui.get(n)) {
                    Some(tex) => chrome::image(tex, x + 5., y + 4., 20., 20.),
                    None => { draw_circle(x + 15., y + 14., 10., rgb(0x3d5677)); chrome::label(&label[..2], x + 15., y + 14., 8., WHITE, Align::Center); }
                }
                chrome::label(label, x + 30., y + 14., 9., rgb(0xb9c8da), Align::Left);
                chrome::label(&super::model::format_number(*value), x + cell_w - 6., y + 14., 12., rgb(0xfff4d6), Align::Right);
            }
        }
        _ => {
            rounded(qx, qy, 100., 18., 9., rgb(0x1b2a42));
            chrome::label("Resonance", qx + 50., qy + 9., 12., rgb(0xfff4d6), Align::Center);
            chrome::paragraph("Socket Resonance crystals to empower this hero.", qx, qy + 26., qw, 11., rgb(0x20304a));
            let slot_w = (qw - 5.6) / 2.;
            for i in 0..2 {
                let locked = i == 1 && stars < 5;
                let x = qx + i as f32 * (slot_w + 5.6);
                let y = qy + 50.;
                let tint = if locked { 0.45 } else { 1. };
                rounded_outline(x, y, slot_w, 42., 7., rgba(0xf7f8fa, tint), rgba(0xb9c1cc, tint));
                rounded(x + 5., y + 5., 32., 32., 4., rgba(0xeef2f6, tint));
                chrome::label(&format!("Slot {} - {}", i + 1, if locked { "Unlocks at *5" } else { "Empty" }), x + 42., y + 21., 10., rgba(0x36465c, tint), Align::Left);
            }
            chrome::paragraph("Slot 2 opens at *5. Crystals are coming soon.", qx, qy + 104., qw, 11., rgb(0x36465c));
        }
    }
    // getHeroStyleCloseRect: the canvas close control at (180, 608), under the nav like the JS DOM nav.
    hits.push(Hit { rect: Rect::new(165., 593., 30., 30.), kind: HitKind::HeroClose });
    // Star Up sheet (hero-modal over the whole content)
    if ui.sheet {
        draw_rectangle(PAD_X, PAD_TOP, cw, bottom - PAD_TOP, rgba(0x10213a, 0.92));
        let (sx, sw) = (PAD_X + 12., cw - 24.);
        let maxed = stars >= STAR_MAX;
        let cost = hero::star_up_cost(stars);
        let own = hero::growth_own(stars);
        let sh = 300.;
        let sy = PAD_TOP + (bottom - PAD_TOP - sh) / 2.;
        rounded(sx, sy, sw, sh, 6., rgb(0xfff4df));
        rounded(sx + 8., sy + 8., 72., 18., 9., rgb(0x1b2a42));
        chrome::label("Star Up", sx + 44., sy + 17., 12., rgb(0xfff4d6), Align::Center);
        rounded(sx + sw - 34., sy + 6., 26., 22., 5., rgb(0x5b6678));
        chrome::label("X", sx + sw - 21., sy + 17., 13., WHITE, Align::Center);
        hits.push(Hit { rect: Rect::new(sx + sw - 40., sy, 40., 34.), kind: HitKind::SheetClose });
        stars_row(sx + 90., sy + 46., stars, 18.);
        chrome::label(&format!("{stars} / {STAR_MAX}"), sx + sw - 12., sy + 46., 13., rgb(0x20304a), Align::Right);
        chrome::label("Now", sx + 10., sy + 70., 11., rgb(0x36465c), Align::Left); chrome::label(&format!("+{} HP ATK DEF MATK RES", pct(own)), sx + 50., sy + 70., 11., rgb(0x20304a), Align::Left);
        chrome::label("Next", sx + 10., sy + 86., 11., rgb(0x36465c), Align::Left); chrome::label(&if maxed { "All stars earned".to_string() } else { format!("+{} hero stats", pct(own + hero::STAR_STAT_BONUS)) }, sx + 50., sy + 86., 11., rgb(0x20304a), Align::Left);
        let special = hero::special_text(key).map_or("", |t| t.name);
        let passive = hero::passive_text(key).map_or("", |t| t.name);
        let res = hero::resonance_texts(key).unwrap();
        for i in 1..=STAR_MAX {
            let (slot, bonus, text) = hero::star_effect(i);
            let skill = match slot { "special" => special, "passive" => passive, "resonance1" => res[0].name, _ => res[1].name };
            let earned = i <= stars;
            let (col, row) = (((i - 1) % 2) as f32, ((i - 1) / 2) as f32);
            let line = format!("*{i} - {skill} - +{} stats - {text}", pct(bonus));
            let mut clipped = line.clone();
            while chrome::measure(&clipped, 8., Weight::Regular) > sw / 2. - 14. && clipped.len() > 4 { clipped.truncate(clipped.len() - 4); clipped.push_str("..."); }
            chrome::label(&clipped, sx + 10. + col * (sw / 2.), sy + 106. + row * 14., 8., if earned { rgb(0x744016) } else { rgb(0x354b66) }, Align::Left);
        }
        let ry = sy + sh - 44.;
        chrome::label(&if maxed { "Max stars".to_string() } else { format!("{}/{} {name} tickets", super::model::format_number(tickets), super::model::format_number(cost)) }, sx + 10., ry + 14., 12., rgb(0x20304a), Align::Left);
        button("Star Up", sx + sw - 100., ry, 90., 28., 12., rgb(0xf8ecd4), rgb(0xb99c66), rgb(0x1d3150), !maxed && tickets >= cost, HitKind::StarUp, hits);
        if !ui.sheet_notice.is_empty() { chrome::paragraph(&ui.sheet_notice, sx + 10., ry + 30., sw - 20., 10., rgb(0x36465c)); }
    }
}

// ---------------------------------------------------------------- Power Up (Training Ground)
/// `#training-ground`: the 360x515 stage centred in the frame; content offsets from the CSS cqw values.
fn training_ground(assets: &Assets, game: &Game, ui: &TrainingUi, hits: &mut Vec<Hit>) {
    draw_rectangle(0., 0., WIDTH, NAV_TOP, rgba(0x08070c, 1.));
    let s = 62.;
    let state = &game.progression.state;
    // sheet, scene, ribbon
    rounded_outline(6., s + 14., 348., 386., 2., rgb(0xe6d2ac), rgb(0xbd8749));
    if let Some(tex) = assets.ui.get("prog-training-scene") { draw_texture_ex(tex, 16., s + 24., WHITE, DrawTextureParams { dest_size: Some(vec2(328., 164.)), ..Default::default() }); }
    draw_rectangle_lines(16., s + 24., 328., 164., 1., rgb(0x8f6436));
    rounded_outline(64., s, 232., 28., 2., rgb(0x25454a), rgb(0xd0a45b));
    chrome::label("Training Ground", 180., s + 14., 14., rgb(0xffe0a0), Align::Center);
    if ui.tab == 0 {
        // balance + status
        chrome::resource_icon(assets, "incense", 18., s + 189., 16.);
        chrome::label(&super::model::format_number(state.wallet.incense), 38., s + 197., 10., rgb(0x2b2116), Align::Left);
        if !ui.status.is_empty() { chrome::label(&ui.status, 342., s + 197., 8., rgb(0x513d24), Align::Right); }
        // four stat cards
        for (i, stat) in TRAINING_STATS.iter().enumerate() {
            let x = 14. + i as f32 * 84.;
            let y = s + 206.;
            rounded_outline(x, y, 80., 156., 12., rgb(0xf6ead0), rgb(0x866a44));
            if let Some(tex) = assets.ui.get(&format!("prog-stat-{}", stat.to_lowercase())) { chrome::image(tex, x + 25., y + 20., 28., 28.); }
            chrome::label(stat, x + 40., y + 55., 10., rgb(0x2b1e12), Align::Center);
            let level = state.training.get(stat);
            let cost = training_cost(state, stat);
            chrome::label("Permanent party bonus", x + 40., y + 70., 7., rgb(0x6c5a3d), Align::Center);
            chrome::label(&format!("+{}%", (level as f64 * TRAINING_BONUS_PER_LEVEL * 100.).round()), x + 40., y + 80., 7., rgb(0x6c5a3d), Align::Center);
            let enabled = state.wallet.incense >= cost && level < 100;
            let stat_static: &'static str = TRAINING_STATS[i];
            button(&format!("Train - {}", super::model::format_number(cost)), x + 6., y + 156. - 6. - 24., 68., 24., 8., rgb(0xead2a1), rgb(0xa98b5a), rgb(0x5d513c), enabled, HitKind::Train(stat_static), hits);
        }
    } else {
        // Party Skills list (tg-party)
        let (lx, ly, lw) = (14., s + 191.5, 332.);
        let mut y = ly;
        for entry in hero::PARTY_SKILLS.iter() {
            let h = 58.;
            if y + h > ly + 203. { break; }
            rounded_outline(lx, y, lw, h, 8., rgb(0xf6ead0), rgb(0x866a44));
            let mut ix = lx + 8.;
            for icon in entry.icons { chrome::buff_icon(assets, icon, ix, y + 8., 20.); ix += 22.; }
            chrome::label(&format!("{}   {} - Lv. 1", entry.name, entry.hero), lx + 48., y + 12., 11., rgb(0x2b2116), Align::Left);
            let mut t = entry.effect.to_string();
            while chrome::measure(&t, 8., Weight::Regular) > lw - 56. && t.len() > 4 { t.truncate(t.len() - 4); t.push_str("..."); }
            chrome::label(&t, lx + 48., y + 27., 8., rgb(0x3e3020), Align::Left);
            let stars = game.progression.state.hero_stars(hero::hero_key(entry.hero));
            let clock = format!("{} {}s", entry.clock_label, hero::format_special_cooldown(entry.hero, stars));
            let mut vx = lx + 48.;
            for value in entry.values.iter().copied().chain(std::iter::once(clock.as_str())) {
                let w = chrome::measure(value, 8., Weight::Regular) + 10.;
                if vx + w > lx + lw - 4. { break; }
                rounded_outline(vx, y + 38., w, 14., 5., rgb(0xf4dfb5), rgb(0xa98b5a));
                chrome::label(value, vx + 5., y + 45., 8., rgb(0x5d513c), Align::Left);
                vx += w + 4.;
            }
            y += h + 6.;
        }
    }
    // tabs
    let ty = s + 406.;
    rounded_outline(8., ty, 344., 30., 2., rgb(0x142f3a), rgb(0x8b7047));
    for (i, (label, live)) in [("Training Ground", true), ("Party Skills", true), ("Aquafarm", false), ("Hatchery", false)].iter().enumerate() {
        let x = 11. + i as f32 * 85.;
        let selected = ui.tab == i as u8;
        rounded_outline(x, ty + 3., 81., 24., 2., if selected { rgb(0xe8c276) } else { rgb(0x17313b) }, if selected { rgb(0xfff0bc) } else { rgb(0x62634f) });
        chrome::label(label, x + 40.5, ty + 15., 8., if selected { rgb(0x2e2417) } else { rgb(0xb9ae94) }, Align::Center);
        if *live { hits.push(Hit { rect: Rect::new(x, ty, 85., 30.), kind: HitKind::TgTab(i as u8) }); }
    }
    // close (returns to combat like the modal's dismiss)
    let cy = s + 460. + 14.;
    draw_circle(180., cy, 14., rgb(0xf0dfbb)); draw_circle_lines(180., cy, 14., 2., rgb(0x8f6436));
    chrome::label("X", 180., cy, 14., rgb(0x2b2116), Align::Center);
    hits.push(Hit { rect: Rect::new(160., cy - 20., 40., 40.), kind: HitKind::Continue });
}

// ---------------------------------------------------------------- Vault (renderChests.js)
const VAULT_TABS: [&str; 4] = ["Common", "Rare", "Epic", "Legendary"];
const RETENTION: [(&str, &str, u32, u32, u32); 8] = [
    ("Enter Homestead", "Map Locale", 0xf4efcf, 0xa08f41, 0x5a4d17), ("Enter Collectibles", "Map Locale", 0xf1e0f7, 0x8e61a4, 0x4a275d), ("Enter Relics", "Map Locale", 0xf1e0f7, 0x8e61a4, 0x4a275d), ("Enter Pets", "Map Locale", 0xe7f2d5, 0x7e9e54, 0x324819),
    ("Enter Evolution", "Soft Currency", 0xe3ecfb, 0x5a79b8, 0x20385f), ("Enter Mounts", "Map Locale", 0xd9f2da, 0x4a8b4f, 0x1f4a24), ("Enter Artifacts", "Map Locale", 0xd7e7f8, 0x3c6f9f, 0x17324a), ("Enter Tomes", "Map Locale", 0xf3ddaa, 0x8d6d2a, 0x2f2412),
];
fn vault_rewards(tab: u8) -> [&'static str; 3] {
    match tab { 0 => ["Pet Fragment x5", "Relic Scrap x8", "Coins x250"], 1 => ["Pet Fragment x10", "Relic Token x2", "Coins x600"], 2 => ["Pet Core x1", "Relic Token x4", "Coins x1200"], _ => ["Pet Core x2", "Ancient Relic x1", "Coins x3000"] }
}
fn vault(_assets: &Assets, ui: &VaultUi, hits: &mut Vec<Hit>) {
    for i in 0..29 { let t = i as f32 / 29.; let c = Color::new(0.165 + t * 0.125, 0.122 + t * 0.098, 0.055 + t * 0.07, 1.); draw_rectangle(0., i as f32 * 20., WIDTH, 20., c); }
    let (px, py, pw, ph) = (14., 16., WIDTH - 28., NAV_TOP - 16. - 6.);
    rounded_outline(px, py, pw, ph, 14., rgb(0xf4ecd6), rgb(0xc7b489));
    let (bx, by, bw, bh) = (px + pw - 120., py + 12., 108., 28.);
    rounded_outline(bx, by, bw, bh, 9., rgb(0xefe3c4), rgb(0xb89f6f));
    chrome::label("Back To Combat", bx + bw / 2., by + 14., 11., rgb(0x3c2a12), Align::Center);
    hits.push(Hit { rect: Rect::new(bx, by, bw, bh), kind: HitKind::VaultBack });
    chrome::label("Vault", px + 14., py + 52., 18., rgb(0x3c2a12), Align::Left);
    chrome::label("Tier tabs and dopamine-progress reward shell.", px + 14., py + 72., 11., rgb(0x7b6641), Align::Left);
    let mut y = py + 88.;
    for (title, subtitle, fill, stroke, ink) in RETENTION {
        rounded_outline(px + 12., y, pw - 24., 36., 8., rgb(fill), rgb(stroke));
        chrome::label(title, px + 22., y + 12., 12., rgb(ink), Align::Left);
        chrome::label(subtitle, px + 22., y + 27., 10., rgb(ink), Align::Left);
        y += 44.;
    }
    let tab_y = y + 4.;
    let tab_w = ((pw - 24. - 3. * 8.) / 4.).floor().max(62.);
    for (i, tab) in VAULT_TABS.iter().enumerate() {
        let x = px + 12. + i as f32 * (tab_w + 8.);
        rounded_outline(x, tab_y, tab_w, 28., 8., if ui.tab == i as u8 { rgb(0xf1ddad) } else { rgb(0xf8f1dd) }, rgb(0xccb88d));
        chrome::label(tab, x + tab_w / 2., tab_y + 14., 10., rgb(0x3c2a12), Align::Center);
        hits.push(Hit { rect: Rect::new(x, tab_y, tab_w, 28.), kind: HitKind::VaultTab(i as u8) });
    }
    let (wx, wy, ww, wh) = (px + 12., tab_y + 40., pw - 24., 44.);
    rounded_outline(wx, wy, ww, wh, 10., rgb(0xf8f1dd), rgb(0xccb88d));
    let (mx, my, mw, mh) = (wx + 10., wy + 24., ww - 20., 12.);
    draw_rectangle(mx, my, mw, mh, rgb(0xe0d5bb)); draw_rectangle(mx, my, mw * 0.36, mh, rgb(0xd2a739)); draw_rectangle_lines(mx, my, mw, mh, 1., rgb(0xa98a45));
    chrome::label("Progress 36/100 - Milestone: Tier Chest", wx + 10., wy + 12., 10., rgb(0x3c2a12), Align::Left);
    let mut ry = wy + wh + 10.;
    for reward in vault_rewards(ui.tab) {
        if ry + 36. > NAV_TOP { break; }
        rounded_outline(px + 12., ry, pw - 24., 36., 8., rgb(0xfff8e8), rgb(0xd7c7a2));
        chrome::label(reward, px + 22., ry + 18., 11., rgb(0x3c2a12), Align::Left);
        ry += 44.;
    }
}
