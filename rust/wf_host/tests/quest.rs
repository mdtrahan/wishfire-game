//! combatProgression.mjs glue over the real session: objectives advance from combat, Incense trains
//! the party into the Rust world, tickets level the saved hero, Essence reaches the lamp save.
use std::cell::{Cell, RefCell};
use std::collections::BTreeMap;
use std::rc::Rc;
use wf_host::equipment::{EquipmentStorage, Storage};
use wf_host::progress::HeroProgressStore;
use wf_host::progression::CombatProgression;
use wf_host::session::Session;
use wf_meta::enemy::parse_c2_table;

struct MemStore { values: Rc<RefCell<BTreeMap<String, String>>> }
impl Storage for MemStore {
    fn get(&self, key: &str) -> Option<String> { self.values.borrow().get(key).cloned() }
    fn set(&mut self, key: &str, value: &str) -> Result<(), String> { self.values.borrow_mut().insert(key.into(), value.into()); Ok(()) }
    fn remove(&mut self, key: &str) { self.values.borrow_mut().remove(key); }
}
fn world() -> (Session, EquipmentStorage, CombatProgression, Rc<RefCell<BTreeMap<String, String>>>, Rc<Cell<f64>>) {
    let rows = parse_c2_table(&std::fs::read_to_string(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../web-runner/assets/enemies.json")).unwrap()).unwrap();
    let mut session = Session::new(7, rows, HeroProgressStore::fresh(), &[("Falie", "falie#1"), ("Huun", "huun#1"), ("Runa", "runa#1"), ("Kojonn", "kojonn#1")], "quest", 90, Box::new(|_| true), Box::new(|_, _| {}));
    session.stage.next_emission_at = 3.;
    let values = Rc::new(RefCell::new(BTreeMap::new()));
    let now = Rc::new(Cell::new(1000.));
    let (n1, n2) = (now.clone(), now.clone());
    let mut economy = EquipmentStorage::new(Box::new(MemStore { values: values.clone() }), None, Box::new(move || n1.get()), Box::new(|| 42));
    economy.sync(&mut session).unwrap();
    let mut progression = CombatProgression::new(Box::new(MemStore { values: values.clone() }), Box::new(move || n2.get()));
    progression.boot(&mut session, &mut economy);
    (session, economy, progression, values, now)
}
#[test]
fn opening_objectives_and_training_reach_combat() {
    let (mut s, mut economy, mut quest, values, _now) = world();
    assert_eq!(quest.state.objective.as_ref().map(|o| o.kind.as_str()), Some("gear_collect"), "opening objective");
    assert!(values.borrow().contains_key(wf_meta::progression::SAVE_KEY), "boot commits the ensured state");
    // Training applies to the live party through a permanent-input revision.
    let mut raw: serde_json::Value = serde_json::from_str(&values.borrow()[wf_meta::progression::SAVE_KEY]).unwrap();
    raw["wallet"]["incense"] = serde_json::json!(100);
    quest.state = wf_meta::progression::create_state(Some(&raw), quest.state.seed);
    for n in 0..30 { s.tick(n as f64 * 1000. / 30.); }
    let hero_actor = s.world().unwrap().snapshot().actors.iter().find(|a| a.team == wf_combat::Team::Hero).map(|a| a.id).unwrap();
    let before = s.world().unwrap().permanent_revision(hero_actor).unwrap();
    let trained = quest.train("ATK", &mut s, &mut economy);
    assert!(trained.ok, "{:?}", trained.reason);
    assert_eq!(s.training.map(|t| t.atk), Some(1));
    for n in 30..40 { s.tick(n as f64 * 1000. / 30.); assert!(s.failed.is_none(), "{:?}", s.failed); }
    let after = s.world().unwrap().permanent_revision(hero_actor).unwrap();
    assert!(after > before, "training should revise the Rust actor's permanent inputs: {before} -> {after}");
    // Enemy defeats recorded from the battle ledger advance a matching objective and claim Incense.
    let mut raw: serde_json::Value = serde_json::from_str(&values.borrow()[wf_meta::progression::SAVE_KEY]).unwrap();
    raw["objective"] = serde_json::json!({ "id": "cot-test", "type": "enemy_defeat", "target": 2, "progress": 0, "seed": 1 });
    raw["cursor"] = serde_json::json!(5);
    quest.state = wf_meta::progression::create_state(Some(&raw), quest.state.seed);
    s.battle.defeated.insert("11".into(), 1.);
    s.battle.defeated.insert("12".into(), 1.);
    assert_eq!(quest.record_committed_enemy_defeats(&s.battle.clone(), &mut s, &mut economy), 2);
    assert_eq!(quest.record_committed_enemy_defeats(&s.battle.clone(), &mut s, &mut economy), 0, "ledger rows record once");
    assert_eq!(quest.state.objective.as_ref().map(|o| o.progress), Some(2));
    let incense = quest.state.wallet.incense;
    let claim = quest.claim("cot-test", &mut s, &mut economy);
    assert!(claim.ok, "{:?}", claim.reason);
    assert_eq!(quest.state.wallet.incense, incense + 5.);
    assert!(quest.state.objective.is_some(), "a new objective follows the claim");
}
#[test]
fn ticket_level_up_and_essence_settlement() {
    let (mut s, mut economy, mut quest, values, _now) = world();
    let mut raw: serde_json::Value = serde_json::from_str(&values.borrow()[wf_meta::progression::SAVE_KEY]).unwrap();
    raw["wallet"]["ticketsByHero"] = serde_json::json!({ "falie#1": 150 });
    raw["objective"] = serde_json::json!({ "id": "cot-gear", "type": "gear_collect", "target": 1, "progress": 1, "seed": 1 });
    raw["cursor"] = serde_json::json!(4);
    quest.state = wf_meta::progression::create_state(Some(&raw), quest.state.seed);
    for n in 0..30 { s.tick(n as f64 * 1000. / 30.); }
    let spend = quest.spend_level_up("falie#1", &mut s, &mut economy);
    assert!(spend.ok, "{:?}", spend.reason);
    assert_eq!(spend.level, 2);
    assert_eq!(s.progress.heroes["falie#1"].current_level, 2);
    assert_eq!(quest.ticket_count("falie#1"), 50.);
    assert!(quest.state.pending_spends().is_empty(), "spend settled");
    for n in 30..40 { s.tick(n as f64 * 1000. / 30.); assert!(s.failed.is_none(), "{:?}", s.failed); }
    assert_eq!(s.heroes.iter().find(|h| h.instance_key == "falie#1").map(|h| h.level), Some(2), "live hero re-read its saved level");
    let claim = quest.claim("cot-gear", &mut s, &mut economy);
    assert!(claim.ok, "{:?}", claim.reason);
    assert_eq!(claim.receipt.as_ref().map(|r| r.resource.as_str()), Some("essence"));
    assert_eq!(economy.data().map(|d| d.lamp.essence), Some(2.), "Essence reward reached the lamp save");
    assert!(quest.sync(&mut s, &mut economy));
    assert_eq!(economy.data().map(|d| d.lamp.essence), Some(2.), "settled once");
    // The hero's tickets are one pool: the 50 left on the party copy pay the first star on the
    // saved hero, and the star reaches the live hero.
    assert_eq!((quest.ticket_count("Falie"), quest.ticket_count("falie#1")), (50., 50.));
    let star = quest.star_up("Falie", &mut s);
    assert!(star.ok, "{:?}", star.reason);
    assert_eq!((star.stars, star.cost, quest.ticket_count("Falie"), quest.ticket_count("falie#1")), (1, 50., 0., 0.));
    assert_eq!(s.stars.get("Falie").copied(), Some(1));
    assert!(!quest.star_up("Falie", &mut s).ok, "nothing left for a second star");
}

/// Owner 2026-11-05 (ORKA-63bf.39): tickets picked up in combat show on the Hero screen, which
/// looks the hero up by its saved key, and can be spent there.
#[test]
fn tickets_collected_by_the_party_copy_count_for_the_saved_hero_on_the_hero_screen() {
    let (mut s, mut economy, mut quest, values, _now) = world();
    for n in 0..30 { s.tick(n as f64 * 1000. / 30.); }
    // Sixty single-ticket drops for Huun, saved under the party copy as before.
    for _ in 0..60 { quest.grant_hero_ticket("huun#1", &mut s, &economy).unwrap(); }
    assert_eq!((quest.ticket_count("Huun"), quest.ticket_count("huun#1"), quest.ticket_count("Falie")), (60., 60., 0.));
    // Star Up from the Hero screen spends them and keeps the remainder in the pool.
    let star = quest.star_up("Huun", &mut s);
    assert!(star.ok, "{:?}", star.reason);
    assert_eq!((star.stars, quest.ticket_count("Huun"), quest.ticket_count("huun#1")), (1, 10., 10.));
    let saved: serde_json::Value = serde_json::from_str(&values.borrow()[wf_meta::progression::SAVE_KEY]).unwrap();
    let wallet = saved["wallet"]["ticketsByHero"].as_object().unwrap();
    assert_eq!(wallet.iter().filter(|(k, _)| k.to_lowercase().starts_with("huun")).map(|(_, v)| v.as_f64().unwrap()).sum::<f64>(), 10., "saved once, not twice: {wallet:?}");
    // Level Up from the Hero screen: 100 tickets at level 1. Not enough yet, nothing is spent.
    let short = quest.level_up_saved_hero("Huun", &mut s, &mut economy);
    assert_eq!((short.ok, short.reason, quest.ticket_count("Huun")), (false, Some("insufficient_tickets"), 10.));
    for _ in 0..95 { quest.grant_hero_ticket("huun#1", &mut s, &economy).unwrap(); }
    let up = quest.level_up_saved_hero("Huun", &mut s, &mut economy);
    assert!(up.ok, "{:?}", up.reason);
    assert_eq!((up.level, up.cost, quest.ticket_count("Huun")), (2, 100., 5.));
    // The fighting copy and the saved hero the screen shows are both level 2.
    assert_eq!((s.progress.heroes["huun#1"].current_level, s.progress.heroes["Huun"].current_level), (2, 2));
    for n in 30..40 { s.tick(n as f64 * 1000. / 30.); assert!(s.failed.is_none(), "{:?}", s.failed); }
    assert_eq!(s.heroes.iter().find(|h| h.instance_key == "huun#1").map(|h| h.level), Some(2), "the live hero fights at the new level");
    // Another hero's tickets are untouched.
    assert_eq!(quest.ticket_count("Runa"), 0.);
}

#[test]
fn a_ticket_drop_adds_one_ticket_to_that_hero_and_is_saved() {
    let (mut s, economy, mut quest, values, _now) = world();
    assert_eq!(quest.ticket_count("huun#1"), 0.);
    assert_eq!(quest.grant_hero_ticket("huun#1", &mut s, &economy), Ok(1.));
    assert_eq!(quest.grant_hero_ticket("huun#1", &mut s, &economy), Ok(2.));
    assert_eq!((quest.ticket_count("huun#1"), quest.ticket_count("falie#1")), (2., 0.), "singles, for that hero only");
    let saved: serde_json::Value = serde_json::from_str(&values.borrow()[wf_meta::progression::SAVE_KEY]).unwrap();
    assert_eq!(saved["wallet"]["ticketsByHero"]["huun#1"], serde_json::json!(2.0));
    assert!(quest.grant_hero_ticket("nobody#1", &mut s, &economy).is_err());
}
