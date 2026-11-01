use wf_slice_harness::*;
fn fold(h: &mut u64, bytes: &[u8]) {
    for b in bytes {
        *h = (*h ^ *b as u64).wrapping_mul(0x100000001b3);
    }
}
fn main() {
    for enabled in [false, true] {
        for seed in [1, 7, 42] {
            let mut spotlight = SpotlightConfig::DEFAULT;
            spotlight.enabled = enabled;
            spotlight.auto_release = true;
            let mut s = Sim::new(SimConfig {
                seed,
                spotlight,
                ..Default::default()
            });
            let mut trace = 0xcbf29ce484222325u64;
            let mut events = trace;
            for step in 0..=27000 {
                if step > 0 {
                    s.step();
                }
                fold(&mut trace, &s.state_hash().to_le_bytes());
                for e in s.drain_events() {
                    fold(&mut events, format!("{e:?}").as_bytes());
                }
                if [0, 1, 30, 300, 3600, 9000, 27000].contains(&step) {
                    println!(
                        "{seed} {enabled} {step} {:016x} {trace:016x} {events:016x}",
                        s.state_hash()
                    );
                }
            }
        }
    }
}
