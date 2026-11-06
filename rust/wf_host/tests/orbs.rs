//! Battlefield orbs (ORKA-63bf.20): kills drop equipment as uncollected orbs, collection moves
//! the oldest into the Bag up to its capacity, blocked orbs wait, and Bag upgrades chain.
use std::cell::{Cell, RefCell};
use std::collections::{BTreeMap, BTreeSet};
use std::rc::Rc;
use wf_host::equipment::{EquipmentStorage, LampHost, Storage, EQUIPMENT_SAVE_KEY};
use wf_host::progress::HeroProgressStore;

#[derive(Default)]
struct MemStore { values: Rc<RefCell<BTreeMap<String, String>>> }
impl Storage for MemStore {
    fn get(&self, key: &str) -> Option<String> { self.values.borrow().get(key).cloned() }
    fn set(&mut self, key: &str, value: &str) -> Result<(), String> { self.values.borrow_mut().insert(key.into(), value.into()); Ok(()) }
    fn remove(&mut self, key: &str) { self.values.borrow_mut().remove(key); }
}
struct Host { progress: HeroProgressStore, gold: f64, pending_gold: BTreeMap<String, f64> }
impl LampHost for Host {
    fn progress(&mut self) -> &mut HeroProgressStore { &mut self.progress }
    fn gold_total(&self) -> f64 { self.gold }
    fn set_gold_total(&mut self, gold: f64) { self.gold = gold; }
    fn pending_gold_settlements(&mut self) -> &mut BTreeMap<String, f64> { &mut self.pending_gold }
    fn progress_storage_error(&self) -> bool { false }
    fn persist_progress(&mut self) -> bool { true }
    fn live_hero_keys(&self) -> Vec<String> { Vec::new() }
    fn revise_hero(&mut self, _: &str) {}
    fn stage_context(&self) -> (f64, f64) { (1., 1.) }
}
struct Bench { store: EquipmentStorage, host: Host, values: Rc<RefCell<BTreeMap<String, String>>>, now: Rc<Cell<f64>> }
fn bench() -> Bench {
    let values = Rc::new(RefCell::new(BTreeMap::new()));
    let now = Rc::new(Cell::new(1000.));
    let read = now.clone();
    let mut store = EquipmentStorage::new(Box::new(MemStore { values: values.clone() }), None, Box::new(move || read.get()), Box::new(|| 42));
    let mut host = Host { progress: HeroProgressStore::fresh(), gold: 0., pending_gold: BTreeMap::new() };
    store.sync(&mut host).unwrap();
    Bench { store, host, values, now }
}
impl Bench {
    fn stored(&self) -> f64 { self.store.data().unwrap().stored_count() }
    fn orbs(&self) -> usize { self.store.data().unwrap().orb_count() }
    /// Ids of the oldest `n` orbs on the field.
    fn oldest(&self, n: usize) -> Vec<String> { self.store.data().unwrap().orbs().into_iter().take(n).map(|o| o.instance_id).collect() }
    fn collect(&mut self, n: usize) -> Vec<wf_meta::lamp::LampItem> { let ids = self.oldest(n); self.store.collect_orbs(&mut self.host, &ids).unwrap().stored }
    /// Every equipment id the save knows, with where it lives; an id in two places is a duplicate.
    fn ledger(&self) -> BTreeMap<String, &'static str> {
        let data = self.store.data().unwrap();
        let mut out = BTreeMap::new();
        for orb in data.orbs() { assert!(out.insert(orb.instance_id, "orb").is_none(), "duplicate orb"); }
        for item in &data.items { assert!(out.insert(item.instance_id.clone(), "item").is_none(), "an id is both an orb and an item"); }
        out
    }
}

#[test]
fn every_kill_drops_one_orb_and_nothing_enters_the_bag_by_itself() {
    let mut b = bench();
    let first = b.store.drop_orbs(&mut b.host, 1., 1., 3).unwrap();
    let second = b.store.drop_orbs(&mut b.host, 1., 1., 4).unwrap();
    assert_eq!((first.len(), second.len()), (3, 4));
    assert_eq!(b.orbs(), 7);
    assert_eq!(b.stored(), 0.);
    assert!(b.store.data().unwrap().items.is_empty());
    let ids: BTreeSet<String> = first.iter().chain(&second).map(|i| i.instance_id.clone()).collect();
    assert_eq!(ids.len(), 7, "each drop is a distinct item");
    assert_eq!(b.store.data().unwrap().lamp.sequence, 7.);
    // The drops survive a reload: a fresh storage over the same save sees them.
    let mut reloaded = EquipmentStorage::new(Box::new(MemStore { values: b.values.clone() }), None, Box::new(|| 2000.), Box::new(|| 7));
    reloaded.sync(&mut b.host).unwrap();
    assert_eq!(reloaded.data().unwrap().orbs().len(), 7);
}
#[test]
fn collection_fills_only_free_slots_and_blocked_orbs_stay() {
    let mut b = bench();
    let dropped = b.store.drop_orbs(&mut b.host, 1., 1., 26).unwrap();
    assert_eq!(dropped.len(), 26);
    let capacity = b.store.data().unwrap().capacity();
    assert_eq!(capacity, 20.);
    // A partial event: only three orbs are eligible.
    let some = b.collect(3);
    assert_eq!(some.iter().map(|i| i.instance_id.as_str()).collect::<Vec<_>>(), dropped[..3].iter().map(|i| i.instance_id.as_str()).collect::<Vec<_>>(), "oldest first");
    assert_eq!((b.stored(), b.orbs()), (3., 23));
    // Everything eligible: the Bag takes 17 more and stops at its capacity.
    let more = b.collect(100);
    assert_eq!(more.len(), 17);
    assert_eq!((b.stored(), b.orbs()), (20., 6));
    // Full Bag: further collection events take nothing and discard nothing.
    for _ in 0..3 { assert!(b.collect(100).is_empty()); }
    assert_eq!((b.stored(), b.orbs()), (20., 6));
    assert_eq!(b.ledger().len(), 26, "no orb was lost or duplicated");
    // More kills while full keep dropping.
    assert_eq!(b.store.drop_orbs(&mut b.host, 1., 1., 2).unwrap().len(), 2);
    assert_eq!((b.stored(), b.orbs()), (20., 8));
}
#[test]
fn freed_capacity_resumes_collection_and_dismantling_pays_essence() {
    let mut b = bench();
    b.store.drop_orbs(&mut b.host, 1., 1., 30).unwrap();
    b.collect(100);
    assert_eq!((b.stored(), b.orbs()), (20., 10));
    // Equipping moves pieces out of the Bag's stored count; the leftovers dismantle for Essence.
    let equipped = b.store.auto_equip(&mut b.host).unwrap();
    assert!(!equipped.is_empty());
    let preview = b.store.disposal_preview(&mut b.host, None).unwrap();
    assert!(!preview.ids.is_empty());
    let essence_before = b.store.data().unwrap().lamp.essence;
    let receipt = b.store.dismantle(&mut b.host, &preview).unwrap();
    assert!(receipt.essence > 0.);
    assert_eq!(b.store.data().unwrap().lamp.essence, essence_before + receipt.essence);
    let free = b.store.data().unwrap().free_slots();
    assert!(free > 0);
    // The ten waiting orbs are judged against what the heroes wear now: upgrades take the free
    // slots, the others are dismantled at once, and only an upgrade without a slot stays.
    let ids = b.oldest(100);
    let resumed = b.store.collect_orbs(&mut b.host, &ids).unwrap();
    assert!(resumed.stored.len() <= free);
    assert_eq!(b.orbs(), 10 - resumed.stored.len() - resumed.dismantled.len());
    assert!(b.orbs() == 0 || b.store.data().unwrap().free_slots() == 0);
    assert!(b.stored() <= b.store.data().unwrap().capacity());
    b.ledger();
}
#[test]
fn bag_upgrades_chain_and_carry_the_overflow() {
    let mut b = bench();
    // Level costs: 100, 300, 525, 775.
    b.store.award_combat_essence(&mut b.host, "test:1", 100.).unwrap();
    let first = b.store.upgrade(&mut b.host, None).unwrap();
    assert_eq!((first.level_before, first.level_after, first.capacity_before, first.capacity_after), (1, 2, 20., 30.));
    assert_eq!(b.store.data().unwrap().lamp.essence, 0.);
    assert!(b.store.upgrade(&mut b.host, None).is_err(), "no upgrade below the threshold");
    b.store.award_combat_essence(&mut b.host, "test:2", 1000.).unwrap();
    let mut levels = Vec::new();
    loop {
        let progress = b.store.data().unwrap().upgrade_progress();
        if progress.max || progress.required.is_none_or(|r| progress.current < r) { break; }
        levels.push(b.store.upgrade(&mut b.host, None).unwrap().level_after);
    }
    assert_eq!(levels, [3, 4], "1000 Essence pays 300 then 525");
    let data = b.store.data().unwrap();
    assert_eq!((data.lamp.capacity_tier, data.lamp.essence), (3, 175.));
    assert_eq!(data.upgrade_progress().fraction, 175. / 775.);
    // A stale request cannot spend twice.
    assert!(b.store.upgrade(&mut b.host, Some(1)).is_err());
    assert_eq!(b.store.data().unwrap().lamp.essence, 175.);
}
#[test]
fn conveyor_leftovers_from_an_older_save_become_orbs() {
    let mut b = bench();
    b.now.set(6000.);
    let emitted = b.store.tick_conveyor(&mut b.host, 1., 1., true, true).unwrap().expect("emission");
    b.now.set(9000.);
    assert_eq!(b.orbs(), 0);
    let dropped = b.store.drop_orbs(&mut b.host, 1., 1., 1).unwrap();
    let data = b.store.data().unwrap();
    assert!(data.emissions().is_empty());
    assert_eq!(data.orbs().iter().map(|o| o.instance_id.clone()).collect::<Vec<_>>(), [emitted.instance_id.clone(), dropped[0].instance_id.clone()]);
    assert!(b.values.borrow().get(EQUIPMENT_SAVE_KEY).unwrap().contains("\"orbs\""));
}

#[test]
fn only_the_named_orbs_are_collected_whatever_their_age() {
    let mut b = bench();
    let dropped = b.store.drop_orbs(&mut b.host, 1., 1., 6).unwrap();
    // A hero stands near the fourth and second drops only.
    let near = vec![dropped[3].instance_id.clone(), dropped[1].instance_id.clone(), "lamp:42:999".to_string()];
    let stored = b.store.collect_orbs(&mut b.host, &near).unwrap().stored;
    assert_eq!(stored.iter().map(|i| i.instance_id.clone()).collect::<Vec<_>>(), [dropped[1].instance_id.clone(), dropped[3].instance_id.clone()], "drop order, unknown ids ignored");
    assert_eq!((b.stored(), b.orbs()), (2., 4));
    assert_eq!(b.store.collect_orbs(&mut b.host, &near).unwrap(), wf_meta::lamp::OrbPickup::default(), "an orb is stored once");
    b.ledger();
}

#[test]
fn the_field_is_bounded_and_an_oversized_older_save_loads_trimmed() {
    use wf_meta::lamp::{drop_orb_item, LampEconomy, ORB_LIMIT};
    // An idle party: kills keep dropping, the field and the save stay bounded.
    let mut b = bench();
    for _ in 0..30 { assert_eq!(b.store.drop_orbs(&mut b.host, 1., 1., 25).unwrap().len(), 25, "every drop lands"); }
    assert_eq!(b.orbs(), ORB_LIMIT);
    assert_eq!(b.store.data().unwrap().lamp.sequence, 750.);
    let bytes = b.values.borrow().get(EQUIPMENT_SAVE_KEY).unwrap().len();
    assert!(bytes < 16_000, "the save stays small ({bytes} bytes)");
    b.ledger();
    // A save written before the limit, holding 2,488 orbs, loads as a bounded field and saves small.
    let mut old = LampEconomy::create(42, 0.);
    let pile: Vec<_> = (0..2488).map(|_| { let item = drop_orb_item(&mut old, 1., 1.); item }).collect();
    old.set_orbs(pile);
    let values = Rc::new(RefCell::new(BTreeMap::new()));
    values.borrow_mut().insert(EQUIPMENT_SAVE_KEY.to_string(), serde_json::to_string(&old.to_value()).unwrap());
    let mut store = EquipmentStorage::new(Box::new(MemStore { values: values.clone() }), None, Box::new(|| 1000.), Box::new(|| 42));
    let mut host = Host { progress: HeroProgressStore::fresh(), gold: 0., pending_gold: BTreeMap::new() };
    store.sync(&mut host).expect("the oversized save still loads");
    assert_eq!(store.data().unwrap().orb_count(), ORB_LIMIT);
    assert!(values.borrow().get(EQUIPMENT_SAVE_KEY).unwrap().len() < 16_000);
    assert_eq!(store.collect_orbs(&mut host, &store.data().unwrap().orbs().into_iter().map(|o| o.instance_id).collect::<Vec<_>>()).unwrap().stored.len(), 20, "and collects into the Bag as usual");
}

/// Owner 2026-11-05 (ORKA-63bf.34): orbs are judged when they are picked up.
#[test]
fn once_the_party_is_equipped_weaker_orbs_are_dismantled_at_pickup_and_pay_essence() {
    use wf_meta::lamp::salvage_value;
    let mut b = bench();
    let reported = Rc::new(RefCell::new(Vec::<String>::new()));
    let sink = reported.clone();
    b.store.on_gear_collected = Some(Box::new(move |item| { sink.borrow_mut().push(item.instance_id.clone()); true }));
    // A bare party: every drop raises somebody's CP, so all twelve enter the Bag.
    b.store.drop_orbs(&mut b.host, 1., 1., 12).unwrap();
    assert_eq!((b.collect(100).len(), b.stored(), b.store.data().unwrap().lamp.essence), (12, 12., 0.));
    // The Bag is opened: Auto-Equip, then the leftovers are dismantled.
    assert!(!b.store.auto_equip(&mut b.host).unwrap().is_empty());
    let preview = b.store.disposal_preview(&mut b.host, None).unwrap();
    if !preview.ids.is_empty() { b.store.dismantle(&mut b.host, &preview).unwrap(); }
    assert_eq!(b.stored(), 0.);
    let essence = b.store.data().unwrap().lamp.essence;
    // Forty more drops picked up in one go.
    b.store.drop_orbs(&mut b.host, 1., 1., 40).unwrap();
    let ids = b.oldest(40);
    let pickup = b.store.collect_orbs(&mut b.host, &ids).unwrap();
    assert!(!pickup.stored.is_empty() && !pickup.dismantled.is_empty(), "{} stored, {} dismantled", pickup.stored.len(), pickup.dismantled.len());
    assert_eq!(pickup.stored.len() + pickup.dismantled.len() + b.orbs(), 40);
    assert_eq!(b.stored(), pickup.stored.len() as f64, "only upgrades use Bag slots");
    assert_eq!(pickup.essence, pickup.dismantled.iter().map(|i| salvage_value(&i.rarity)).sum::<f64>());
    assert_eq!(b.store.data().unwrap().lamp.essence, essence + pickup.essence, "the Essence is saved with the pickup");
    let ledger = b.ledger();
    assert!(pickup.dismantled.iter().all(|i| !ledger.contains_key(&i.instance_id)), "a dismantled orb is neither an orb nor an item");
    // Everything stored is still an upgrade: nothing in the Bag waits to be dismantled.
    assert!(b.store.disposal_preview(&mut b.host, None).unwrap().ids.is_empty());
    // Every picked-up orb counts as collected equipment for the quest system, stored or not.
    assert_eq!(reported.borrow().len(), 12 + pickup.stored.len() + pickup.dismantled.len());
    // The same pickup again settles nothing twice.
    let again = b.store.collect_orbs(&mut b.host, &ids).unwrap();
    assert_eq!((again.dismantled.len(), again.essence), (0, 0.));
    assert_eq!(b.store.data().unwrap().lamp.essence, essence + pickup.essence);
}
