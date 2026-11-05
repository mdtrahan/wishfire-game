//! Meta screens reached from the nav, translated from `renderHeroScreen.js` + `heroGearUI.mjs`
//! (Hero), `createTrainingGroundUI` in `combatProgressionUI.mjs` (Power Up) and `renderChests.js`
//! (Vault). The routing is the JS one (`storyEntryFlow.navigate`): leaving combat pauses it,
//! Quests shows the pause gate until bead ORKA-63bf.10 lands the real page.
use super::chrome::{self, rgb, rgba, rounded_outline, Align, Hit, HitKind, Weight, NAV_TOP};
use super::dom::{el, Node};
use super::{css, Act, Screen};
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

pub fn draw(assets: &Assets, screen: Screen, game: &Game, training_ui: &TrainingUi, vault_ui: &VaultUi, hits: &mut Vec<Hit>) {
    match screen {
        Screen::Hero => {}
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
fn canvas_button(text: &str, x: f32, y: f32, w: f32, h: f32, size: f32, fill: Color, stroke: Color, ink: Color, enabled: bool, kind: HitKind, hits: &mut Vec<Hit>) {
    let (fill, ink, stroke) = if enabled { (fill, ink, stroke) } else { (rgb(0xe3e6ea), rgb(0x7d8794), rgb(0xb8bfc8)) };
    rounded_outline(x, y, w, h, 6., fill, stroke);
    chrome::label(text, x + w / 2., y + h / 2., size, ink, Align::Center);
    if enabled { hits.push(Hit { rect: Rect::new(x, y, w, h), kind }); }
}
// ---------------------------------------------------------------- Hero (renderHeroScreen.js)
// The element tree is main's (`renderHeroScreen` + `heroGearUI.mjs`), styled by `css/hero.css`.
type N = Node<Act>;
/// JS `String(number)`.
fn num(value: f64) -> String { format!("{value}") }
/// `pct`: `Math.round(value*1000)/10` percent.
fn pct(value: f64) -> String { format!("{}%", num((value * 1000.).round() / 10.)) }
fn button(text: &str, kind: HitKind) -> N { el("button").attr("type", "button").t(text).on(Act::Hit(kind)) }
/// `starMeter`.
fn star_meter(stars: u32) -> N {
    el("div").class("stars").attr("role", "img").label(if stars > 0 { format!("{stars} of {STAR_MAX} stars") } else { "No stars yet".into() })
        .children((0..STAR_MAX).map(|slot| { let star = el("span").t("★"); if slot < stars { star.attr("data-tier", "bronze") } else { star } }))
}
/// `modalSheet`: the dialog shell, its panel and the shared close control.
fn modal_sheet(label: &str, panel: N, dismiss: HitKind) -> N {
    el("div").class("hero-modal").attr("role", "dialog").attr("aria-modal", "true").label(label).style("--modal-close-scale:var(--s)")
        .child(panel)
        .child(el("button").attr("type", "button").class("game-modal-close").label(format!("Close {label}")).on(Act::Hit(dismiss)).child(el("span").attr("aria-hidden", "true").t("×")))
}
pub fn hero_view(game: &Game, ui: &mut HeroUi) -> Option<N> {
    use HitKind as K;
    let roster = roster(game);
    if roster.is_empty() { return None; }
    let index = hero_index(ui, roster.len());
    if ui.seen_index != Some(index) { ui.seen_index = Some(index); ui.skill = 4; ui.ticket_notice.clear(); ui.sheet_notice.clear(); }
    ui.skill = ui.skill.min(4);
    let hero = roster[index];
    let definition = hero.definition();
    let (key, name) = (definition.key, definition.name);
    let stars = game.progression.state.hero_stars(&hero.hero_instance_key);
    let tickets = game.progression.ticket_count(&hero.hero_instance_key);
    let tab = match ui.tab { 0 => "heroes", 1 => "gear", _ => "resonance" };
    let sheet_open = ui.sheet && ui.tab == 0;
    let portrait = |hero_name: &str| el("img").attr("src", css::asset(&format!("images/{hero_name}.png"))).attr("alt", hero_name);

    // .identity: portrait, hero arrows, name plate + stars, skill panel.
    let entries: [Option<SkillText>; 5] = { let r = hero::resonance_texts(key).unwrap(); [hero::special_text(key), hero::passive_text(key), Some(r[0]), Some(r[1]), None] };
    let locked = matches!(ui.skill, 2 | 3);
    let (skill_id, display, tag) = match &entries[ui.skill] {
        Some(t) => (t.id, t.name, if locked { "Late-game resonance · Not yet available" } else if ui.skill == 1 { "Passive" } else { "Special" }),
        None => ("basic_attack", "Basic Attack", "Always available"),
    };
    let copy = hero::skill_copy(skill_id, key);
    let mut detail = el("article").attr("data-skill", skill_id).attr("data-locked", locked.to_string()).child(el("h2").t(display)).child(el("small").t(tag));
    for line in &copy.lines { detail.push(el("p").t(line.as_str())); }
    if ui.skill == 0 || ui.skill == 4 {
        let seconds = if ui.skill == 4 { "0".to_string() } else { hero::format_special_cooldown(key, stars) };
        let range = if ui.skill == 4 { "Screen width".to_string() } else { hero::special_range_text(skill_id) };
        let provisional = ui.skill == 0 && hero::PROVISIONAL_SPECIAL_COOLDOWNS.contains(&skill_id);
        detail.push(el("p").class("skill-meta").t(format!("Range: {range} · Cooldown: {seconds}s{}", if provisional { " (provisional)" } else { "" })));
    }
    for rule in &copy.rules { detail.push(el("p").t(*rule)); }
    let panel = el("aside").class("skill-panel").label("Hero skills").child(detail).child(el("footer")
        .child(button("‹", K::SkillPrev).label("Previous skill"))
        .child(el("small").label("Skill index").t(format!("{} / {}", ui.skill + 1, entries.len())))
        .child(button("›", K::SkillNext).label("Next skill")));
    let identity = el("header").class("identity").flag("inert", sheet_open)
        .child(portrait(name).class("hero-portrait"))
        .child(el("nav").class("hero-arrows").label("Choose hero").child(button("‹", K::HeroPrev).label("Previous hero")).child(button("›", K::HeroNext).label("Next hero")))
        .child(el("div").class("hero-name").child(el("h1").t(name)).child(star_meter(stars)))
        .child(panel);

    let tabs = el("nav").class("tabs").label("Hero management").flag("inert", sheet_open)
        .children([("heroes", "Heroes"), ("gear", "Gear"), ("resonance", "Resonance")].into_iter().enumerate().map(|(i, (id, label))| button(label, K::HeroTab(i as u8)).attr("aria-pressed", (tab == id).to_string())));
    let mut pane = el("div").class("pane").attr("data-view", tab).label(format!("{tab} view")).flag("inert", sheet_open);
    let mut modal = None;
    match ui.tab {
        0 if sheet_open => {
            // renderStarSheet
            let maxed = stars >= STAR_MAX;
            let cost = hero::star_up_cost(stars);
            let own = hero::growth_own(stars);
            let special = hero::special_text(key).map_or("", |t| t.name);
            let passive = hero::passive_text(key).map_or("", |t| t.name);
            let res = hero::resonance_texts(key).unwrap();
            let effects = el("ol").class("star-effects").label("Star effects").children((1..=STAR_MAX).map(|i| {
                let (slot, bonus, text) = hero::star_effect(i);
                let skill = match slot { "special" => special, "passive" => passive, "resonance1" => res[0].name, _ => res[1].name };
                el("li").attr("data-skill", slot).attr("data-earned", (i <= stars).to_string()).t(format!("★{i} · {skill} · +{} stats · {text}", pct(bonus)))
            }));
            let action = button("Star Up", K::StarUp).class("sheet-action star-up").flag("disabled", maxed || tickets < cost)
                .label(if maxed { "Maximum stars".to_string() } else { format!("Star Up · {} tickets", num(cost)) });
            let mut sheet = el("section").class("sub-panel star-sheet").attr("data-panel", "star")
                .child(el("header").child(el("h2").t("Star Up")))
                .child(el("div").class("sheet-row").child(star_meter(stars)).child(el("span").t(format!("{stars} / {STAR_MAX}"))))
                .child(el("dl").class("growth-lines")
                    .child(el("dt").t("Now")).child(el("dd").t(format!("+{} HP ATK DEF MATK RES", pct(own))))
                    .child(el("dt").t("Next")).child(el("dd").t(if maxed { "All stars earned".to_string() } else { format!("+{} hero stats", pct(own + hero::STAR_STAT_BONUS)) })))
                .child(effects)
                .child(el("div").class("sheet-row").child(el("span").class("star-cost").t(if maxed { "Max stars".to_string() } else { format!("{}/{} {name} tickets", num(tickets), num(cost)) })).child(action));
            if !ui.sheet_notice.is_empty() { sheet.push(el("p").class("sheet-note").t(ui.sheet_notice.as_str())); }
            modal = Some(modal_sheet("Star Up", sheet, K::SheetClose));
        }
        0 => {
            let mut grid = el("div").class("roster").label("Party roster");
            for (i, member) in roster.iter().enumerate() {
                let d = member.definition();
                let selected = i == index;
                let balance = game.progression.ticket_count(&member.hero_instance_key);
                let cost = hero_ticket_level_cost(member.current_level as f64);
                let maxed = member.current_level >= member.max_level;
                let quadrant = match d.name { "Fara" => "12% 12%", "Hondo" => "94% 12%", "Kaja" => "12% 89%", "Runa" => "94% 89%", _ => "0% 0%" };
                let fill = if maxed { 100. } else { (100. * balance / cost).min(100.) };
                grid.push(el("div").class("roster-card").attr("data-hero", member.hero_instance_key.as_str()).attr("data-selected", selected.to_string())
                    .child(el("button").attr("type", "button").class("card-select").label(format!("Select {}, level {}", d.name, member.current_level)).attr("aria-pressed", selected.to_string()).on(Act::Hit(K::Roster(i))).child(portrait(d.name)))
                    .child(el("div").class("ticket-strip")
                        .child(el("span").class("hero-ticket-art").style(format!("background-position:{quadrant}")))
                        .child(el("div").class("ticket-bar").attr("role", "img")
                            .label(if maxed { format!("{} at maximum level", d.name) } else { format!("{} of {} {} tickets for the next level", num(balance), num(cost), d.name) })
                            .child(el("i").style(format!("width:{}%", num(fill))))
                            .child(el("span").t(if maxed { "MAX".to_string() } else { format!("{}/{}", num(balance), num(cost)) })))));
            }
            pane.push(grid);
            let cost = hero_ticket_level_cost(hero.current_level as f64);
            let maxed = hero.current_level >= hero.max_level;
            pane.push(el("div").class("hero-actions").label(format!("{name} actions"))
                .child(button("Level Up", K::LevelUp).class("hero-level-up").flag("disabled", maxed || tickets < cost).label(if maxed { "Maximum level".to_string() } else { format!("Level Up · {} tickets", num(cost)) }))
                .child(button("Star Up", K::StarOpen)));
            if !ui.ticket_notice.is_empty() { pane.push(el("small").class("hero-ticket-notice").t(ui.ticket_notice.as_str())); }
        }
        1 => {
            // heroGearUI.mjs: Hat, Body, Boots + Accessory (no source yet), then the detail card.
            let mut detail = el("div").class("gear-detail");
            match game.economy.data() {
                None => detail.push(el("p").t("Loading equipment…")),
                Some(economy) => {
                    let mut slots = el("div").class("gear-slots").label("Equipped gear");
                    for i in 0..4u8 {
                        let (slot, slot_label) = if i < 3 { SLOTS[i as usize] } else { ("accessory", "Accessory") };
                        let item = if i < 3 { economy.loadouts.get(&hero.hero_instance_key).and_then(|l| l.get(slot)).and_then(|id| economy.item(id)) } else { None };
                        let tier = item.and_then(|it| rarity(&it.rarity));
                        let mut card = el("button").attr("type", "button").class("gear-slot").attr("data-slot", slot).attr("aria-pressed", (ui.gear_slot == i).to_string()).on(Act::Hit(K::GearSlot(i)))
                            .style(format!("--rarity:#{:06x}", tier.map_or(0x758597, |r| r.color)))
                            .label(format!("Inspect {slot_label}: {}", item.map_or("Empty".to_string(), |it| format!("{}, {}, level {}", it.name, tier.map_or(it.rarity.as_str(), |r| r.label), num(it.level)))));
                        match item {
                            Some(it) => card.push(el("span").class("lamp-art").attr("aria-hidden", "true").style(format!("--col:{};--row:{}", it.art % 3, it.art / 3)).child(el("span").class("lamp-level").t(format!("Lv.{}", num(it.level))))),
                            None => { card.push(el("small").t(slot_label)); card.push(el("span").class("gear-empty").t("Empty")); }
                        }
                        slots.push(card);
                        if ui.gear_slot == i {
                            match item {
                                Some(it) => {
                                    detail.push(el("h2").t(it.name.as_str()));
                                    detail.push(el("small").t(format!("{} · Lv. {}", tier.map_or(it.rarity.as_str(), |r| r.label), num(it.level))));
                                    detail.push(el("p").t(it.stats.iter().map(|(k, v)| format!("{} +{}", if k == "MAG" { "MATK" } else { k }, v.as_f64().map_or(v.to_string(), num))).collect::<Vec<_>>().join(" · ")));
                                }
                                None => {
                                    detail.push(el("h2").t(format!("{slot_label} · Empty")));
                                    detail.push(el("p").t(if i == 3 { "Orb · No source available yet." } else { "Inspect lamp results to equip this slot." }));
                                }
                            }
                        }
                    }
                    pane.push(slots);
                }
            }
            pane.push(detail);
            let cp = compute_combat_power(CpActor::new(hero.current_level as f64, hero.stats.atk, hero.stats.mag, hero.stats.def, hero.stats.res, hero.max_hp, hero.stats.spd));
            let mut grid = el("dl").class("stat-grid").label("Hero stats");
            for (label, value, icon) in [("HP", hero.max_hp, None), ("ATK", hero.stats.atk, Some("stat-atk")), ("DEF", hero.stats.def, Some("stat-def")), ("MAG", hero.stats.mag, Some("stat-matk")), ("RES", hero.stats.res, Some("stat-res")), ("SPD", hero.stats.spd, None)] {
                let mark = match icon { Some(n) => el("img").attr("src", css::asset(&format!("images/progression/{n}.png"))).attr("alt", ""), None => el("b").attr("aria-hidden", "true").t(&label[..2]) };
                grid.push(el("div").child(mark).child(el("dt").t(if label == "MAG" { "MATK" } else { label })).child(el("dd").t(num(value))));
            }
            pane.push(el("section").class("stat-block")
                .child(el("div").class("stat-head").child(el("span").t(format!("Lv. {}", hero.current_level))).child(el("span").class("hero-cp").t(format!("CP {}", num(cp)))))
                .child(grid));
        }
        _ => {
            let mut slots = el("div").class("resonance-slots");
            for i in 0..2 {
                let locked = i == 1 && stars < 5;
                let text = format!("Slot {} · {}", i + 1, if locked { "Unlocks at ★5" } else { "Empty" });
                slots.push(el("div").class("resonance-slot").attr("data-locked", locked.to_string()).attr("aria-disabled", "true").label(format!("Resonance slot {}: {text}", i + 1)).child(el("i").class("slot-face")).child(el("span").t(text)));
            }
            pane.push(el("section").class("resonance-panel").label("Resonance crystals")
                .child(el("header").child(el("h2").t("Resonance")))
                .child(el("p").t("Socket Resonance crystals to empower this hero."))
                .child(slots)
                .child(el("p").class("sheet-note").t("Slot 2 opens at ★5. Crystals are coming soon.")));
        }
    }
    let mut root = el("section").key("hero").id("hero-details").label("Hero details").attr("data-tab", tab);
    if sheet_open { root = root.attr("data-modal", "star"); }
    Some(root.child(el("div").child(identity).maybe(modal).child(tabs).child(pane)))
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
            canvas_button(&format!("Train - {}", super::model::format_number(cost)), x + 6., y + 156. - 6. - 24., 68., 24., 8., rgb(0xead2a1), rgb(0xa98b5a), rgb(0x5d513c), enabled, HitKind::Train(stat_static), hits);
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
