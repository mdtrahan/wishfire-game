//! Per-frame read model of the combat chrome: `drawCombatProgressHud`, `bossFallbackPresentation`,
//! `activeBossReadout`, `heroCooldownSlots`, `heroBuffSignalInput` + `projectBuffSignals`.
use std::collections::BTreeMap;
use wf_combat::{ActorView, Archetype, Groove, Snapshot, Team};
use wf_host::session::Session;
use wf_meta::stage::{self, BOSS_TIME_LIMIT_SEC};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SlotStatus { Ready, Cooldown, Ko }
#[derive(Clone, Debug, PartialEq)]
pub struct HeroSlot {
    pub key: &'static str,
    pub name: &'static str,
    pub art: &'static str,
    pub status: SlotStatus,
    /// Dark wedge fraction (`--cooldown`): 1 - special meter.
    pub fraction: f32,
    /// Hero badge groups in arrival order: "tempo", "offense", "defense".
    pub badges: Vec<&'static str>,
}
#[derive(Clone, Debug, PartialEq, Default)]
pub struct BossReadout {
    pub name: String,
    pub hp_fraction: f32,
    pub time_fraction: f32,
    pub remaining: f64,
    pub rows: Vec<(String, String)>,
}
/// Party icon with the first buff behind it (`partyRefs`): effect id and Elevate set.
#[derive(Clone, Debug, PartialEq)]
pub struct PartyIcon { pub icon: &'static str, pub skill_id: &'static str }
/// `combatProgressionUI.update`: resources row + objective box read model.
#[derive(Clone, Debug, PartialEq, Default)]
pub struct QuestView {
    pub category: String,
    pub challenge: String,
    pub count: String,
    pub ready: bool,
    pub claim_id: String,
    /// (resource, amount, hero name) from `combatObjectiveReward`.
    pub reward: Option<(String, f64, String)>,
    pub incense: f64,
    pub essence: f64,
    /// The party's real Gold (main showed a fixed 999,999,999 here; Gold drops made it live).
    pub gold: f64,
}
pub fn quest_view(game: &crate::game::Game) -> QuestView {
    use wf_meta::progression::{objective_presentation, objective_reward};
    let state = &game.progression.state;
    let view = objective_presentation(state.objective.as_ref());
    let ready = state.objective.as_ref().is_some_and(|o| o.progress >= o.target);
    QuestView {
        category: if ready { "Claim reward".into() } else { view.category },
        challenge: view.challenge, count: view.count, ready,
        claim_id: if ready { state.objective.as_ref().map(|o| o.id.clone()).unwrap_or_default() } else { String::new() },
        reward: objective_reward(state.objective.as_ref()).map(|r| (r.resource, r.amount, r.hero_name.unwrap_or_default())),
        incense: state.wallet.incense,
        essence: game.economy.data().map_or(0., |d| d.lamp.essence),
        gold: game.session.gold_total,
    }
}
#[derive(Clone, Debug, PartialEq, Default)]
pub struct CombatModel {
    pub quest: QuestView,
    pub chapter: u32,
    pub wave_count: u32,
    pub completed_waves: u32,
    pub progress_position: f64,
    pub boss_ready: bool,
    pub summon_visible: bool,
    pub summon_enabled: bool,
    pub boss: Option<BossReadout>,
    pub slots: Vec<Option<HeroSlot>>,
    pub party: Vec<PartyIcon>,
    /// `session.failed`: the combat host stopped with this error.
    pub host_error: Option<String>,
    /// `previous.heroes`: badge arrival order per hero instance key.
    hero_groups: BTreeMap<String, Vec<&'static str>>,
}
pub const SLOTS: usize = 8;
const PARTY_ICON_ORDER: [&str; 14] = ["party-spd", "party-range", "party-atk", "party-mag", "party-cr", "party-cd", "party-special", "party-def", "party-res", "party-hp", "party-dr", "party-ward", "party-reflect", "party-heal"];
const HERO_BUFF_GROUPS: [&str; 3] = ["tempo", "offense", "defense"];
/// Modifier channel -> (party icon, hero group) (`BUFF_SIGNAL_CHANNELS`).
fn channel(channel: &str) -> Option<(&'static str, &'static str)> {
    Some(match channel {
        "SPD" | "basicRate" => ("party-spd", "tempo"), "range" => ("party-range", "tempo"),
        "ATK" | "damageAmp" => ("party-atk", "offense"), "MAG" => ("party-mag", "offense"), "critRate" => ("party-cr", "offense"), "critDamage" => ("party-cd", "offense"), "specialDamage" => ("party-special", "offense"),
        "DEF" => ("party-def", "defense"), "RES" => ("party-res", "defense"), "HP" => ("party-hp", "defense"), "damageReduction" => ("party-dr", "defense"), "ward" => ("party-ward", "defense"), "reflect" => ("party-reflect", "defense"), "heal" => ("party-heal", "defense"),
        _ => return None,
    })
}
struct Buff { key: String, channels: Vec<&'static str>, skill_id: &'static str }
fn arrival_order<'a>(previous: &[&'a str], active: &[&'a str], canonical: &[&'a str]) -> Vec<&'a str> {
    let mut kept: Vec<&str> = previous.iter().copied().filter(|id| active.contains(id)).collect();
    for id in canonical { if active.contains(id) && !kept.contains(id) { kept.push(id); } }
    kept
}
/// `toLocaleString('en-US', { maximumFractionDigits: 1 })`.
pub fn format_number(value: f64) -> String {
    if !value.is_finite() { return "-".into(); }
    let rounded = (value * 10.).round() / 10.;
    let negative = rounded < 0.;
    let whole = rounded.abs().trunc() as u64;
    let tenth = ((rounded.abs() - whole as f64) * 10.).round() as u64;
    let digits = whole.to_string();
    let mut grouped = String::new();
    for (i, c) in digits.chars().enumerate() { if i > 0 && (digits.len() - i) % 3 == 0 { grouped.push(','); } grouped.push(c); }
    let mut out = if negative { format!("-{grouped}") } else { grouped };
    if tenth > 0 { out.push_str(&format!(".{tenth}")); }
    out
}
pub fn hero_art(key: &str) -> &'static str { match wf_meta::hero::hero_key(key) { "Falie" => "hero-Fara", "Huun" => "hero-Hondo", "Runa" => "hero-Runa", _ => "hero-Kaja" } }
impl CombatModel {
    pub fn build(session: &Session, snapshot: &Snapshot, previous: &CombatModel) -> CombatModel {
        let s = &session.stage;
        let boss_ready = s.boss_active || s.boss_available;
        let wave_count = stage::waves_for_stage(s.region);
        let wave = s.wave.max(1).min(wave_count);
        let completed = if boss_ready { wave_count } else { wave - 1 };
        let fraction = if boss_ready { 0. } else { let (cleared, packs) = session.pack_progress(); if packs > 0 { cleared as f64 / packs as f64 } else { 0. } };
        let summon_visible = boss_ready && s.boss_summon_required && !s.boss_active;
        let boss = s.boss_active.then(|| s.boss_uid).flatten().and_then(|uid| {
            let entity = session.enemies.iter().find(|e| e.uid == uid)?;
            let view = entity.rust_actor_id.and_then(|id| snapshot.actors.iter().find(|a| a.id == id));
            let (hp, max_hp) = view.map_or((entity.hp, entity.max_hp), |v| (v.hp as f64, v.max_hp as f64));
            let remaining = session.boss_time_remaining().unwrap_or(BOSS_TIME_LIMIT_SEC);
            let r = &entity.row;
            Some(BossReadout {
                name: r.name.clone(),
                hp_fraction: (hp / max_hp.max(1.)).clamp(0., 1.) as f32,
                time_fraction: (remaining / BOSS_TIME_LIMIT_SEC).clamp(0., 1.) as f32,
                remaining,
                rows: vec![
                    ("HP".into(), format!("{} / {}", format_number(hp), format_number(max_hp))),
                    ("ATK".into(), format_number(r.atk)), ("MATK".into(), format_number(r.mag)),
                    ("DEF".into(), format_number(r.def)), ("RES".into(), format_number(r.res)), ("SPD".into(), format_number(r.spd)),
                    ("Combat Power".into(), format_number(r.combat_power)),
                ],
            })
        });
        // heroCooldownSlots + heroBuffSignalInput
        let elevate_caster = snapshot.actors.iter().find(|a| a.archetype == Archetype::Kaja && a.hp > 0. && a.groove == Some(Groove::Power) && a.groove_active > 0. && a.elevate.is_some());
        let mut heroes: Vec<(String, Option<HeroSlot>, bool, Vec<Buff>)> = Vec::new();
        for h in &session.heroes {
            let view: Option<&ActorView> = h.rust_actor_id.and_then(|id| snapshot.actors.iter().find(|a| a.id == id && a.team == Team::Hero));
            let meter = view.map_or(0., |v| v.meter).clamp(0., 1.);
            let downed = view.is_some_and(|v| v.hp <= 0. || v.state == wf_combat::ActorState::Downed) || h.hp <= 0.;
            // Hondo's burst opens on COMBO_START_METER of his bar (ORKA-63bf.51); the overlay still shows the bar itself.
            let needed = if view.is_some_and(|v| v.archetype == Archetype::Hondo) { wf_combat::tuning::COMBO_START_METER } else { 1. };
            let status = if downed { SlotStatus::Ko } else if meter + 0.00001 >= needed { SlotStatus::Ready } else { SlotStatus::Cooldown };
            let mut buffs = Vec::new();
            if let Some(v) = view {
                if v.ward > 0. || v.warcry_shield { buffs.push(Buff { key: "ward".into(), channels: vec!["ward"], skill_id: "crimson_ward" }); }
                if let Some(caster) = elevate_caster { if !downed { buffs.push(Buff { key: format!("elevate:{}:{}", caster.id, v.id), channels: vec!["ATK"], skill_id: "elevate" }); } }
            }
            heroes.push((h.instance_key.clone(), Some(HeroSlot { key: h.definition.key, name: h.definition.name, art: hero_art(h.definition.key), status, fraction: 1. - meter, badges: Vec::new() }), !downed, buffs));
        }
        // projectBuffSignals
        let living: Vec<&(String, Option<HeroSlot>, bool, Vec<Buff>)> = heroes.iter().filter(|h| h.2).collect();
        let keys_of = |h: &(String, Option<HeroSlot>, bool, Vec<Buff>)| -> Vec<String> { h.3.iter().filter(|b| b.channels.iter().any(|c| channel(c).is_some())).map(|b| b.key.clone()).collect() };
        let party_keys: Vec<String> = if living.len() < 2 { Vec::new() } else { keys_of(living[0]).into_iter().filter(|k| living.iter().all(|h| keys_of(h).contains(k))).collect() };
        let mut party_icons: Vec<&'static str> = Vec::new();
        let mut party_refs: BTreeMap<&'static str, &'static str> = BTreeMap::new();
        let mut groups_by_key: BTreeMap<String, Vec<&'static str>> = BTreeMap::new();
        for h in &living {
            let mut groups: Vec<&'static str> = Vec::new();
            for buff in &h.3 {
                let party = party_keys.contains(&buff.key);
                for c in &buff.channels {
                    let Some((icon, group)) = channel(c) else { continue };
                    if !party { if !groups.contains(&group) { groups.push(group); } continue; }
                    if !party_icons.contains(&icon) { party_icons.push(icon); }
                    party_refs.entry(icon).or_insert(buff.skill_id);
                }
            }
            groups_by_key.insert(h.0.clone(), groups);
        }
        let previous_party: Vec<&str> = previous.party.iter().map(|p| p.icon).collect();
        let party: Vec<PartyIcon> = arrival_order(&previous_party, &party_icons, &PARTY_ICON_ORDER).into_iter().map(|icon| PartyIcon { icon, skill_id: party_refs.get(icon).copied().unwrap_or("") }).collect();
        let mut hero_groups = BTreeMap::new();
        let mut slots: Vec<Option<HeroSlot>> = Vec::new();
        for (key, slot, _, _) in heroes.into_iter() {
            let active = groups_by_key.get(&key).cloned().unwrap_or_default();
            let ordered = arrival_order(previous.hero_groups.get(&key).map(|v| v.as_slice()).unwrap_or(&[]), &active, &HERO_BUFF_GROUPS);
            hero_groups.insert(key, ordered.clone());
            slots.push(slot.map(|mut s| { s.badges = ordered; s }));
        }
        slots.resize_with(SLOTS, || None);
        CombatModel { quest: previous.quest.clone(), chapter: s.region.max(1), wave_count, completed_waves: completed, progress_position: (completed as f64 + fraction).min(wave_count as f64), boss_ready, summon_visible, summon_enabled: summon_visible, boss, slots, party, host_error: session.failed.clone(), hero_groups }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn numbers_format_like_en_us() {
        assert_eq!(format_number(1234.56), "1,234.6");
        assert_eq!(format_number(75.), "75");
        assert_eq!(format_number(0.04), "0");
        assert_eq!(format_number(f64::NAN), "-");
    }
    #[test]
    fn arrival_order_keeps_earlier_icons_in_place() {
        assert_eq!(arrival_order(&["b", "a"], &["a", "c"], &["a", "b", "c"]), vec!["a", "c"]);
        assert_eq!(arrival_order(&[], &["c", "a"], &["a", "b", "c"]), vec!["a", "c"]);
    }
}
