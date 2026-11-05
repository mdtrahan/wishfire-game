//! Meta screens reached from the nav, as page elements (`ui/dom.rs`): `renderHeroScreen.js` +
//! `heroGearUI.mjs` (Hero), `createTrainingGroundUI` in `combatProgressionUI.mjs` (Power Up, a
//! dialog over the current screen) and `renderChests.js` (Vault). Element trees and class names
//! are main's; the rules are in `css/`.
use super::chrome::{self, HitKind};
use super::dom::{el, Node};
use super::{css, Act};
use crate::game::Game;
use wf_host::progress::HeroProgress;
use wf_meta::combat_power::{compute_combat_power, CpActor};
use wf_meta::equipment::{rarity, SLOTS};
use wf_meta::hero::{self, SkillText, STAR_MAX};
use wf_meta::progression::{hero_ticket_level_cost, training_cost, TRAINING_BONUS_PER_LEVEL, TRAINING_STATS};

/// `renderHeroScreen` module state.
pub struct HeroUi { pub index: usize, pub tab: u8, pub sheet: bool, pub skill: usize, pub ticket_notice: String, pub sheet_notice: String, pub gear_slot: u8, seen_index: Option<usize> }
impl HeroUi {
    /// `focusHeroSpecial`: land on the Heroes tab with this hero's Special showing.
    pub fn focus_special(&mut self, index: usize) { self.index = index; self.seen_index = Some(index); self.tab = 0; self.sheet = false; self.skill = 0; self.ticket_notice.clear(); self.sheet_notice.clear(); }
}
impl Default for HeroUi { fn default() -> Self { Self { index: 0, tab: 0, sheet: false, skill: 4, ticket_notice: String::new(), sheet_notice: String::new(), gear_slot: 0, seen_index: None } } }
/// `createTrainingGroundUI` state: tab (0 Training Ground, 1 Party Skills) and the status line.
#[derive(Default)]
pub struct TrainingUi { pub open: bool, pub tab: u8, pub status: String, /// The Party Skills entry a HUD party icon opened (`data-focused`).
    pub focus: Option<&'static str> }
/// `gameState.chestsLayout` state: the active tier tab.
#[derive(Default)]
pub struct VaultUi { pub tab: u8 }

/// Canonical records in `HERO_DEFINITIONS` order (`roster` in renderHeroScreen).
pub fn roster(game: &Game) -> Vec<&HeroProgress> { hero::HERO_DEFINITIONS.iter().filter_map(|d| game.session.progress.heroes.get(d.key)).collect() }
pub fn hero_index(ui: &HeroUi, len: usize) -> usize { if len == 0 { 0 } else { ui.index % len } }

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
                            Some(it) => card.push(el("span").class("lamp-art").attr("aria-hidden", "true").style(super::lamp::art_style(it.art)).child(el("span").class("lamp-level").t(format!("Lv.{}", num(it.level))))),
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
/// `createTrainingGroundUI` (`combatProgressionUI.mjs`): the Growth dialog over the current
/// screen, styled by `css/progression.css`. `viewport` is the window size in CSS px: the stage
/// is main's `min(100vw - 24px, 56.25dvh)` wide and ends at the close mark (`layoutClose`).
pub fn training_view(game: &Game, ui: &TrainingUi, viewport: (f32, f32)) -> N {
    let state = &game.progression.state;
    let k = (viewport.0 - 24.).min(0.5625 * viewport.1) / 360.;
    // .tg-close sits at 127.7778cqw (460/360 of the width) with no margin; its mark is centred in it.
    let height = 460. * k + ((66. * k).max(44.) + 44. * k) / 2.;
    let asset = |path: &str, alt: &str, size: u32| el("img").attr("src", css::asset(path)).attr("alt", alt).attr("width", size.to_string()).attr("height", size.to_string()).attr("draggable", "false");
    let party = ui.tab == 1;
    let mut tabs = el("nav").class("tg-tabs").attr("role", "tablist").label("Growth sections");
    for (i, (label, live)) in [("Training Ground", true), ("Party Skills", true), ("Aquafarm", false), ("Hatchery", false)].into_iter().enumerate() {
        let tab = el("button").class("tg-tab").attr("type", "button").attr("role", "tab").flag("disabled", !live).attr("aria-selected", (live && ui.tab == i as u8).to_string()).t(label);
        tabs.push(if live { tab.on(Act::Hit(HitKind::TgTab(i as u8))) } else { tab });
    }
    // One scroll list built from the shared party-skill catalog (same source as the HUD icons).
    let sheet_url = css::asset("images/ui/buff-signals.png");
    let mut list = el("ul").class("tg-party").label("Party skills");
    for entry in hero::PARTY_SKILLS.iter() {
        let mut icons = el("span").class("tg-skill-icons").attr("aria-hidden", "true");
        for id in entry.icons {
            let index = chrome::BUFF_FRAMES.iter().position(|f| f == id).unwrap_or(0);
            icons.push(el("i").style(format!("background-image:url('{sheet_url}');background-size:600% 300%;background-position:{}% {}%", (index % 6) as f32 / 5. * 100., (index / 6) as f32 / 2. * 100.)));
        }
        let stars = state.hero_stars(hero::hero_key(entry.hero));
        let mut values = el("ul").label(format!("{} values", entry.name)).children(entry.values.iter().map(|v| el("li").t(*v)));
        values.push(el("li").t(format!("{} {}s", entry.clock_label, hero::format_special_cooldown(entry.hero, stars))));
        let mut card = el("li").class("tg-skill").attr("data-party-skill", entry.id).attr("tabindex", "-1")
            .child(icons)
            .child(el("h3").t(entry.name).child(el("small").t(format!("{} · Lv. 1", entry.hero))))
            .child(el("p").t(entry.effect))
            .child(values);
        if ui.focus == Some(entry.id) { card = card.attr("data-focused", "true"); }
        list.push(card);
    }
    let mut stats = el("div").class("tg-stats").label("Party stat upgrades");
    for stat in TRAINING_STATS.iter().copied() {
        let level = state.training.get(stat);
        let cost = training_cost(state, stat);
        stats.push(el("article").class("tg-stat").label(format!("{stat} party upgrade"))
            .child(asset(&format!("images/progression/stat-{}.png", stat.to_lowercase()), &format!("{stat} icon"), 28))
            .child(el("b").t(stat))
            .child(el("small").t(format!("Permanent party bonus +{:.0}%", level as f64 * TRAINING_BONUS_PER_LEVEL * 100.)))
            .child(el("button").class("tg-train").attr("type", "button").flag("disabled", state.wallet.incense < cost || level >= 100).t(format!("Train · {}", num(cost))).on(Act::Hit(HitKind::Train(stat)))));
    }
    let content = el("div").class("tg-content")
        .child(el("h1").class("tg-ribbon").id("training-ground-title").t("Training Ground"))
        .child(el("section").class("tg-sheet").label("Training Ground"))
        .child(asset("images/progression/training-scene.png", "Approved training courtyard with four training stations", 328).class("tg-scene"))
        .child(tabs)
        .child(list)
        .child(el("div").class("tg-balance").child(asset("images/progression/incense.png", "Incense", 22)).child(el("span").label("Incense balance").t(num(state.wallet.incense))))
        .child(el("p").class("tg-status").attr("role", "status").t(ui.status.as_str()))
        .child(stats);
    el("section").key("training").id("training-ground").attr("role", "dialog").attr("aria-modal", "true").attr("aria-labelledby", "training-ground-title").attr("data-tab", if party { "party" } else { "training" })
        .child(el("div").class("tg-stage").style(format!("--modal-close-scale:{k:.4};height:{height:.2}px"))
            .child(content)
            .child(el("button").class("game-modal-close tg-close").attr("type", "button").label("Close Growth").on(Act::Hit(HitKind::TgClose)).child(el("span").attr("aria-hidden", "true").t("×"))))
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
/// The Vault shell: locale rows, tier tabs, the milestone meter and the tier's rewards (`css/vault.css`).
pub fn vault_view(ui: &VaultUi) -> N {
    let mut rows = el("div").class("rows");
    for (title, subtitle, fill, stroke, ink) in RETENTION {
        rows.push(el("div").class("entry").style(format!("background:#{fill:06x};--ring:#{stroke:06x};color:#{ink:06x}")).child(el("b").t(title)).child(el("small").t(subtitle)));
    }
    rows.push(el("nav").class("tabs").label("Vault tiers").children(VAULT_TABS.iter().enumerate().map(|(i, tab)| button(tab, HitKind::VaultTab(i as u8)).attr("aria-pressed", (ui.tab == i as u8).to_string()))));
    rows.push(el("div").class("progress").child(el("span").t("Progress 36/100 · Milestone: Tier Chest")).child(el("i")));
    for reward in vault_rewards(ui.tab) { rows.push(el("div").class("reward").child(el("span").t(reward))); }
    el("section").key("vault").id("vault").label("Vault").child(el("div").class("panel")
        .child(button("Back To Combat", HitKind::VaultBack).class("back"))
        .child(el("h1").t("Vault"))
        .child(el("p").class("sub").t("Tier tabs and dopamine-progress reward shell."))
        .child(rows))
}
