//! Golden traces originated at pristine 9c142b5f; owner-authorized formula
//! updates and exact old/new values are recorded in FORMULA_REPINS.md.
use crate::*;
fn fold(hash: &mut u64, bytes: &[u8]) {
    for byte in bytes {
        *hash = (*hash ^ *byte as u64).wrapping_mul(0x100000001b3);
    }
}
#[test]
fn pinned_every_step_hash_and_ordered_events_match() {
    let mut actual = String::new();
    for enabled in [false, true] {
        for seed in [1, 7, 42] {
            let mut spotlight = SpotlightConfig::DEFAULT;
            spotlight.enabled = enabled;
            spotlight.auto_release = true;
            let mut sim = Sim::new(SimConfig {
                seed,
                spotlight,
                ..Default::default()
            });
            let mut trace = 0xcbf29ce484222325;
            let mut events = trace;
            for step in 0..=27000 {
                if step > 0 {
                    sim.step();
                }
                fold(&mut trace, &sim.state_hash().to_le_bytes());
                for event in sim.drain_events() {
                    fold(&mut events, format!("{event:?}").as_bytes());
                }
                if [0, 1, 30, 300, 3600, 9000, 27000].contains(&step) {
                    use std::fmt::Write;
                    writeln!(
                        &mut actual,
                        "{seed} {enabled} {step} {:016x} {trace:016x} {events:016x}",
                        sim.state_hash()
                    )
                    .unwrap();
                }
            }
        }
    }
    assert_eq!(actual, include_str!("../fixtures/baseline-trace.tsv"));
}
