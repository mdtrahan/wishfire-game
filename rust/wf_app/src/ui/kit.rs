//! What each hero does in combat, for the Hero screen's skill panel (owner 2026-11-05,
//! ORKA-63bf.40). The panel used to list the accepted kit of 2026-10-23 (`wf_meta::hero`:
//! Crimson Ward, Smoke Form, Royalty, Boast, Ethereal Aura and the late-game resonances), which
//! combat does not run. These entries describe the skills `wf_combat` actually dispatches
//! (`groove.rs`), and every number is formatted from `wf_combat::tuning`, so the text follows a
//! tuning change by itself. Rust-only: there is no JS source for this text.
use wf_combat::tuning::*;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum KitSlot { Special, Passive, Basic }
#[derive(Clone, Debug, PartialEq)]
pub struct KitEntry {
    pub id: &'static str,
    pub name: &'static str,
    pub slot: KitSlot,
    /// The line under the name: slot and what it costs.
    pub tag: String,
    /// Where it reaches (specials and the basic attack).
    pub range: Option<String>,
    pub lines: Vec<String>,
    pub rules: Vec<String>,
}
/// `0.3` as `30%`; `2.094` as `209%`.
fn pct(fraction: f32) -> String { format!("{}%", (fraction * 100.).round()) }
/// `440.` as `440`, `1.5` as `1.5`.
fn num(value: f32) -> String { if value.fract() == 0. { format!("{value:.0}") } else { format!("{value}") } }
fn special(id: &'static str, name: &'static str, cost: &str, range: String, lines: Vec<String>, rules: Vec<String>) -> KitEntry {
    KitEntry { id, name, slot: KitSlot::Special, tag: format!("Special · {cost}"), range: Some(range), lines, rules }
}
fn passive(id: &'static str, name: &'static str, lines: Vec<String>) -> KitEntry {
    KitEntry { id, name, slot: KitSlot::Passive, tag: "Passive · always on".into(), range: None, lines, rules: Vec::new() }
}
/// How the hero's special bar works: stocks and what fills them. `refill` is the seconds one
/// stock (Hondo: the whole bar) takes for this hero at its stars.
pub fn bar_text(key: &str, refill: &str) -> String {
    match wf_meta::hero::hero_key(key) {
        "Falie" => format!("Special bar: {} stocks · {refill}s per stock, faster when Fara is hit", num(RAGE_STOCK_CAP)),
        "Huun" => format!("Special bar: fills in {refill}s, +{} per basic hit", pct(COMBO_BASIC_GAIN)),
        "Runa" => format!("Special bar: 3 stocks · {refill}s per stock, faster with basic hits"),
        _ => format!("Special bar: {} stocks · {refill}s per stock", num(POWER_STOCK_CAP)),
    }
}
/// The hero's combat skills in the order the panel shows them: specials, passive, basic attack.
pub fn combat_kit(key: &str) -> Vec<KitEntry> {
    let key = wf_meta::hero::hero_key(key);
    let mut kit = match key {
        "Falie" => vec![
            special("warcry", "Warcry", "1 stock", format!("{} units around Fara", num(TAUNT_RADIUS)), vec![
                format!("Taunts every foe within {} units for {}s.", num(TAUNT_RADIUS), num(TAUNT_DURATION)),
                format!("Fara gains a ward of {} of her max HP that lasts until it breaks.", pct(WARCRY_WARD_FRACTION)),
            ], vec!["Used when a foe threatens another hero.".into()]),
            special("ground_pound", "Ground Pound", "1 stock", format!("{}-unit line", num(GROUND_POUND_LENGTH)), vec![
                format!("Deals {} ATK to every foe on a line up to {} units long.", pct(GROUND_POUND_POTENCY), num(GROUND_POUND_LENGTH)),
                "Pushes them back.".into(),
            ], Vec::new()),
        ],
        "Huun" => vec![
            special("shadow", "Shadow", "a full bar", format!("Foes within {} units", num(COMBO_RADIUS)), vec![
                format!("Blinks behind a foe and strikes for {} ATK.", pct(SHADOW_POTENCY)),
                format!("Keeps striking foes within {} units for {}s.", num(COMBO_RADIUS), num(COMBO_SECONDS)),
                format!("Each strike wards Hondo for {} of his max HP for {}s.", pct(SHADOW_WARD_FRACTION), num(SHADOW_WARD_SECONDS)),
            ], Vec::new()),
            special("split", "Split", "ends the Shadow burst", format!("{} units around the last foe", num(SPLIT_RADIUS)), vec![
                format!("Finishes the burst with {} ATK to every foe within {} units.", pct(SPLIT_POTENCY), num(SPLIT_RADIUS)),
            ], Vec::new()),
        ],
        "Runa" => vec![
            special("bubble_pop", "Bubble Pop", "1 stock", format!("{} units around the target", num(BUBBLE_RADIUS)), vec![
                format!("Deals {} MAG to every foe within {} units of the target.", pct(BUBBLE_POTENCY), num(BUBBLE_RADIUS)),
                format!("Pushes them back and traps them in a bubble for {}s.", num(BUBBLE_AURA_ENCASE_SECONDS)),
            ], vec!["Bosses are not pushed or trapped.".into()]),
            special("healing_spring", "Healing Spring", "1 stock", "Any hero".into(), vec![
                format!("Heals the most hurt hero for {} of max HP.", pct(SUPER_HEAL_FRACTION)),
            ], vec![format!("Used when a hero is below {} HP.", pct(SUPER_HEAL_THRESHOLD))]),
            passive("bubble_aura", "Bubble Aura", vec![
                format!("Foes within {} units of Runa move {} slower (bosses {}).", num(BUBBLE_AURA_RADIUS), pct(BUBBLE_AURA_SLOW), pct(BUBBLE_AURA_BOSS_SLOW)),
                format!("Each has a {} chance to be trapped in a bubble for {}s.", pct(BUBBLE_AURA_ENCASE_CHANCE), num(BUBBLE_AURA_ENCASE_SECONDS)),
            ]),
        ],
        "Kojonn" => vec![
            special("arcane_pulse", "Arcane Pulse", "drains the bar", "Kaja's distance to the target".into(), vec![
                format!("Blasts every foe around the target for {} MAG, up to {} from afar.", pct(ARCANE_PULSE_POTENCY), pct(ARCANE_PULSE_POTENCY * ARCANE_PULSE_RANGE_MAX_MULT)),
                format!("Leaves a light totem: foes inside take {} MAG every {}s.", pct(ARCANE_TOTEM_POTENCY), num(ARCANE_TOTEM_PULSE)),
            ], vec![
                format!("The totem drains the bar: a full bar lasts {}s. One at a time, and no other special meanwhile.", num(ARCANE_TOTEM_FULL_BAR_SECONDS)),
                format!("The blast is as wide as Kaja stands from the target, at least {} units.", num(ARCANE_PULSE_RADIUS)),
            ]),
            special("elevate", "Elevate", "2 stocks", "Whole party".into(), vec![
                format!("For {}s every hero gains one set, chosen at random:", num(ELEVATE_DURATION)),
            ], vec![
                format!("Sword: damage +{}, move speed +{}.", pct(ELEVATE_BONUS), pct(ELEVATE_MOVE_BONUS)),
                format!("Wings: attack range +{}, evade +{}.", pct(ELEVATE_RANGE_BONUS), pct(ELEVATE_EVADE_BONUS)),
                format!("Winged Boots: move speed +{}, DEF and RES +{}.", pct(ELEVATE_BOOTS_MOVE_BONUS), pct(ELEVATE_DEF_BONUS)),
                "Ends if Kaja falls.".into(),
            ]),
            passive("mend", "Mend", vec![
                format!("Every {}s, heals every hero within Kaja's attack range for {} of max HP.", num(MEND_INTERVAL), pct(MEND_FRACTION)),
            ]),
        ],
        _ => Vec::new(),
    };
    let stat = if wf_meta::hero::basic_is_magic(key) { "MAG" } else { "ATK" };
    kit.push(KitEntry { id: "basic_attack", name: "Basic Attack", slot: KitSlot::Basic, tag: "Always available".into(), range: Some("Attack range".into()), lines: vec![format!("Deals 100% of {stat} to the current target.")], rules: Vec::new() });
    kit
}
/// Names for the star sheet: the hero's specials and its passive (if it has one).
pub fn slot_names(key: &str) -> (String, String) {
    let kit = combat_kit(key);
    let join = |slot: KitSlot| kit.iter().filter(|e| e.slot == slot).map(|e| e.name).collect::<Vec<_>>().join(" / ");
    (join(KitSlot::Special), join(KitSlot::Passive))
}

#[cfg(test)]
mod tests {
    use super::*;
    /// The panel lists what combat dispatches, with the numbers combat uses.
    #[test]
    fn the_kit_is_the_combat_kit_with_live_tuning_numbers() {
        let names = |key: &str| combat_kit(key).iter().map(|e| (e.name, e.slot)).collect::<Vec<_>>();
        use KitSlot::*;
        assert_eq!(names("Falie"), [("Warcry", Special), ("Ground Pound", Special), ("Basic Attack", Basic)]);
        assert_eq!(names("Huun"), [("Shadow", Special), ("Split", Special), ("Basic Attack", Basic)]);
        assert_eq!(names("Runa"), [("Bubble Pop", Special), ("Healing Spring", Special), ("Bubble Aura", Passive), ("Basic Attack", Basic)]);
        assert_eq!(names("Kojonn"), [("Arcane Pulse", Special), ("Elevate", Special), ("Mend", Passive), ("Basic Attack", Basic)]);
        // Display names resolve to the same kits; an unknown hero has only a basic attack.
        assert_eq!(combat_kit("Fara"), combat_kit("Falie"));
        assert_eq!(combat_kit("Kaja"), combat_kit("Kojonn"));
        assert_eq!(combat_kit("Nobody").len(), 1);
        // None of the retired kit is listed.
        let retired = ["Crimson Ward", "Smoke Form", "Royalty", "Boast", "Ethereal Aura", "Phoenix Soul", "Chastise", "Chase", "Weaken", "Vengeance", "Stare", "Cornered", "Timeless"];
        for key in ["Falie", "Huun", "Runa", "Kojonn"] { assert!(combat_kit(key).iter().all(|e| !retired.contains(&e.name)), "{key}"); }
        // Numbers come from the combat tuning.
        let text = |key: &str, id: &str| { let e = combat_kit(key).into_iter().find(|e| e.id == id).unwrap(); [e.lines, e.rules].concat().join(" ") };
        assert_eq!(text("Falie", "warcry"), "Taunts every foe within 440 units for 6s. Fara gains a ward of 30% of her max HP that lasts until it breaks. Used when a foe threatens another hero.");
        assert_eq!(text("Falie", "ground_pound"), "Deals 240% ATK to every foe on a line up to 300 units long. Pushes them back.");
        assert_eq!(text("Huun", "shadow"), "Blinks behind a foe and strikes for 240% ATK. Keeps striking foes within 300 units for 4s. Each strike wards Hondo for 20% of his max HP for 3s.");
        assert_eq!(text("Huun", "split"), "Finishes the burst with 300% ATK to every foe within 140 units.");
        assert_eq!(text("Runa", "bubble_pop"), "Deals 209% MAG to every foe within 140 units of the target. Pushes them back and traps them in a bubble for 1.5s. Bosses are not pushed or trapped.");
        assert_eq!(text("Runa", "healing_spring"), "Heals the most hurt hero for 35% of max HP. Used when a hero is below 60% HP.");
        assert_eq!(text("Runa", "bubble_aura"), "Foes within 90 units of Runa move 30% slower (bosses 15%). Each has a 5% chance to be trapped in a bubble for 1.5s.");
        assert_eq!(text("Kojonn", "arcane_pulse"), "Blasts every foe around the target for 220% MAG, up to 473% from afar. Leaves a light totem: foes inside take 35% MAG every 1s. The totem drains the bar: a full bar lasts 8s. One at a time, and no other special meanwhile. The blast is as wide as Kaja stands from the target, at least 95 units.");
        assert_eq!(text("Kojonn", "elevate"), "For 8s every hero gains one set, chosen at random: Sword: damage +25%, move speed +15%. Wings: attack range +22%, evade +22%. Winged Boots: move speed +12%, DEF and RES +12%. Ends if Kaja falls.");
        assert_eq!(text("Kojonn", "mend"), "Every 3s, heals every hero within Kaja's attack range for 3% of max HP.");
        assert_eq!(text("Runa", "basic_attack"), "Deals 100% of MAG to the current target.");
        assert_eq!(text("Huun", "basic_attack"), "Deals 100% of ATK to the current target.");
        assert_eq!(bar_text("Falie", "10"), "Special bar: 3 stocks · 10s per stock, faster when Fara is hit");
        assert_eq!(bar_text("Huun", "20"), "Special bar: fills in 20s, +10% per basic hit");
        assert_eq!(bar_text("Kojonn", "5.65"), "Special bar: 3 stocks · 5.65s per stock");
        assert_eq!(slot_names("Kojonn"), ("Arcane Pulse / Elevate".to_string(), "Mend".to_string()));
        assert_eq!(slot_names("Falie"), ("Warcry / Ground Pound".to_string(), String::new()));
    }
}
