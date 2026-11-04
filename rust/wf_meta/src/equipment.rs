//! `web-runner/src/core/equipment.mjs`: slots, rarities, the retired v1 catalog (migration only),
//! `equipmentStats` and `isEquipmentUpgrade`.
use std::collections::BTreeMap;

pub const SLOTS: [(&str, &str); 3] = [("hat", "Hat"), ("body", "Body"), ("boots", "Boots")];
pub fn slot_label(slot: &str) -> Option<&'static str> { SLOTS.iter().find(|(k, _)| *k == slot).map(|(_, l)| *l) }
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rarity { pub key: &'static str, pub label: &'static str, pub color: u32, pub weight: f64, pub price_multiplier: f64 }
/// `RARITIES` in object order (the order rarity weights roll and sort by).
pub const RARITIES: [Rarity; 5] = [
    Rarity { key: "common", label: "Common", color: 0xf3f3ee, weight: 60., price_multiplier: 1. },
    Rarity { key: "uncommon", label: "Uncommon", color: 0x60bd76, weight: 25., price_multiplier: 2. },
    Rarity { key: "rare", label: "Rare", color: 0x58a7ff, weight: 10., price_multiplier: 5. },
    Rarity { key: "epic", label: "Epic", color: 0xc078f2, weight: 4., price_multiplier: 12. },
    Rarity { key: "legendary", label: "Legendary", color: 0xf0bd55, weight: 1., price_multiplier: 30. },
];
pub fn rarity_index(key: &str) -> Option<usize> { RARITIES.iter().position(|r| r.key == key) }
pub fn rarity(key: &str) -> Option<&'static Rarity> { RARITIES.iter().find(|r| r.key == key) }
/// Retired v1 catalog item (`EQUIPMENT`): `type` is the v1 slot (weapon/head/armor/boots/accessory).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct CatalogItem { pub id: &'static str, pub name: &'static str, pub kind: &'static str, pub rarity: &'static str, pub stats: &'static [(&'static str, f64)] }
pub const EQUIPMENT: [CatalogItem; 16] = [
    CatalogItem { id: "iron-sword", name: "Iron Sword", kind: "weapon", rarity: "common", stats: &[("ATK", 2.)] },
    CatalogItem { id: "apprentice-staff", name: "Apprentice Staff", kind: "weapon", rarity: "common", stats: &[("MAG", 2.)] },
    CatalogItem { id: "linen-hood", name: "Linen Hood", kind: "head", rarity: "common", stats: &[("RES", 1.)] },
    CatalogItem { id: "leather-vest", name: "Leather Vest", kind: "armor", rarity: "common", stats: &[("DEF", 2.)] },
    CatalogItem { id: "trail-boots", name: "Trail Boots", kind: "boots", rarity: "common", stats: &[("SPD", 1.)] },
    CatalogItem { id: "copper-ring", name: "Copper Ring", kind: "accessory", rarity: "common", stats: &[("HP", 5.)] },
    CatalogItem { id: "warden-helm", name: "Warden Helm", kind: "head", rarity: "uncommon", stats: &[("DEF", 3.), ("RES", 1.)] },
    CatalogItem { id: "chain-mail", name: "Chain Mail", kind: "armor", rarity: "uncommon", stats: &[("DEF", 4.)] },
    CatalogItem { id: "swift-boots", name: "Swift Boots", kind: "boots", rarity: "uncommon", stats: &[("SPD", 2.)] },
    CatalogItem { id: "ember-blade", name: "Ember Blade", kind: "weapon", rarity: "rare", stats: &[("ATK", 6.)] },
    CatalogItem { id: "moon-staff", name: "Moon Staff", kind: "weapon", rarity: "rare", stats: &[("MAG", 6.)] },
    CatalogItem { id: "sapphire-ring", name: "Sapphire Ring", kind: "accessory", rarity: "rare", stats: &[("RES", 3.), ("HP", 10.)] },
    CatalogItem { id: "astral-mantle", name: "Astral Mantle", kind: "armor", rarity: "epic", stats: &[("DEF", 5.), ("RES", 5.)] },
    CatalogItem { id: "star-pendant", name: "Star Pendant", kind: "accessory", rarity: "epic", stats: &[("MAG", 5.), ("HP", 15.)] },
    CatalogItem { id: "dawnbringer", name: "Dawnbringer", kind: "weapon", rarity: "legendary", stats: &[("ATK", 10.), ("MAG", 6.)] },
    CatalogItem { id: "sunward-crown", name: "Sunward Crown", kind: "head", rarity: "legendary", stats: &[("DEF", 8.), ("RES", 8.)] },
];
pub fn catalog(id: &str) -> Option<&'static CatalogItem> { EQUIPMENT.iter().find(|i| i.id == id) }
/// Anything with `stats` and a slot `type`: a lamp item or a resolved catalog entry.
#[derive(Clone, Debug, PartialEq)]
pub struct Gear { pub kind: String, pub stats: BTreeMap<String, f64> }
/// `equipmentStats(items, loadout)`: sums each slot's assigned item once; mismatched slots skip.
pub fn equipment_stats<'a>(find: impl Fn(&str) -> Option<Gear>, loadout: impl IntoIterator<Item = (&'a str, &'a str)>) -> BTreeMap<String, f64> {
    let mut stats = BTreeMap::new();
    let mut used = Vec::new();
    for (slot, id) in loadout {
        let Some(d) = find(id) else { continue };
        if slot_label(slot).is_none() || d.kind != slot || used.contains(&id) { continue; }
        used.push(id);
        for (stat, value) in d.stats { *stats.entry(stat).or_insert(0.) += value; }
    }
    stats
}
/// `isEquipmentUpgrade(candidate, current)`: no stat may drop and at least one must rise.
pub fn is_equipment_upgrade(candidate: &Gear, current: Option<&Gear>) -> bool {
    if current.is_some_and(|c| c.kind != candidate.kind) { return false; }
    let mut keys: Vec<&String> = candidate.stats.keys().collect();
    if let Some(c) = current { for k in c.stats.keys() { if !keys.contains(&k) { keys.push(k); } } }
    let value = |g: Option<&Gear>, k: &str| g.and_then(|g| g.stats.get(k)).copied().unwrap_or(0.);
    keys.iter().all(|k| value(Some(candidate), k) >= value(current, k)) && keys.iter().any(|k| value(Some(candidate), k) > value(current, k))
}
/// `formatCompactCount`: exact below 1,000; K/M/B with at most one floored decimal above.
pub fn format_compact_count(value: f64) -> String {
    if !value.is_finite() || value <= 0. { return "0".into(); }
    let count = value.floor();
    if count < 1000. { return format!("{count}"); }
    let (unit, suffix) = if count >= 1e9 { (1e9, "B") } else if count >= 1e6 { (1e6, "M") } else { (1e3, "K") };
    let tenths = (count / (unit / 10.)).floor();
    let whole = (tenths / 10.).floor();
    let rest = tenths % 10.;
    if rest != 0. { format!("{whole}.{rest}{suffix}") } else { format!("{whole}{suffix}") }
}
