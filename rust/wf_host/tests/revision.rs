//! Live permanent-input revisions (#229): equipping mid-combat reaches the Rust world.
use std::collections::BTreeMap;
use wf_host::progress::HeroProgressStore;
use wf_host::session::Session;
use wf_meta::enemy::parse_c2_table;

fn session() -> Session {
    let rows = parse_c2_table(&std::fs::read_to_string(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../web-runner/assets/enemies.json")).unwrap()).unwrap();
    let mut session = Session::new(7, rows, HeroProgressStore::fresh(), &[("Falie", "falie#1"), ("Huun", "huun#1"), ("Runa", "runa#1"), ("Kojonn", "kojonn#1")], "revision", 90, Box::new(|_| true), Box::new(|_, _| {}));
    session.stage.next_emission_at = 3.;
    session
}
#[test]
fn equipment_change_revises_the_live_hero() {
    let mut s = session();
    for n in 0..60 { s.tick(n as f64 * 1000. / 30.); assert!(s.failed.is_none(), "tick {n}: {:?}", s.failed); }
    let before = s.world().unwrap().snapshot().actors.iter().find(|a| a.team == wf_combat::Team::Hero).map(|a| (a.id, a.max_hp)).unwrap();
    {
        let record = s.progress.heroes.get_mut("falie#1").unwrap();
        record.equipment_stats = Some(BTreeMap::from([("ATK".to_string(), 3.), ("HP".to_string(), 25.)]));
        record.refresh();
    }
    s.queue_permanent_inputs(Some("falie#1")).unwrap();
    for n in 60..70 { s.tick(n as f64 * 1000. / 30.); assert!(s.failed.is_none(), "tick {n} after revision: {:?}", s.failed); }
    let after = s.world().unwrap().snapshot().actors.iter().find(|a| a.id == before.0).map(|a| a.max_hp).unwrap();
    assert!(after > before.1, "max hp should grow with +25 HP gear: {} -> {after}", before.1);
    // A second revision for the same hero (another equip) must also apply.
    { let record = s.progress.heroes.get_mut("falie#1").unwrap(); record.equipment_stats = Some(BTreeMap::from([("ATK".to_string(), 3.), ("HP".to_string(), 40.)])); record.refresh(); }
    s.queue_permanent_inputs(Some("falie#1")).unwrap();
    for n in 70..80 { s.tick(n as f64 * 1000. / 30.); assert!(s.failed.is_none(), "tick {n} after second revision: {:?}", s.failed); }
    let third = s.world().unwrap().snapshot().actors.iter().find(|a| a.id == before.0).map(|a| a.max_hp).unwrap();
    assert!(third > after, "second revision: {after} -> {third}");
}
