//! Page-entry flag and client-owned repetition; no normal-mode sim state.
use wf_combat::{Snapshot, Team};

#[cfg(target_arch = "wasm32")]
std::thread_local! {
    static ENABLED: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_qa(value: u32) {
    ENABLED.with(|flag| flag.set(value != 0));
}
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_crate_version() -> u32 {
    1
}

#[cfg(target_arch="wasm32")]
std::thread_local! {static SEED:std::cell::Cell<u64>=const{std::cell::Cell::new(1)};}
#[cfg(target_arch="wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_qa_seed(seed:u32) {SEED.with(|s|s.set(seed.max(1) as u64));}
pub fn seed()->u64 {
    #[cfg(target_arch="wasm32")] {SEED.with(|s|s.get())}
    #[cfg(not(target_arch="wasm32"))] {1}
}

pub fn enabled() -> bool {
    #[cfg(target_arch = "wasm32")]
    {
        ENABLED.with(|flag| flag.get())
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        false
    }
}

/// Repeat after 1.5 simulation seconds with an empty field; recover immediately on wipe.
/// Snapshot time respects pause/speed and still advances during hit-stop.
pub fn restart_due(snapshot: &Snapshot, cleared_at: &mut Option<f64>) -> bool {
    let living = |team| snapshot.actors.iter().any(|a| a.team == team && a.hp > 0.);
    if !living(Team::Hero) {
        return true;
    }
    if living(Team::Enemy) {
        *cleared_at = None;
        return false;
    }
    snapshot.time - *cleared_at.get_or_insert(snapshot.time) >= 1.5
}

#[cfg(test)]
mod tests {
    use super::*;
    use wf_combat::{Sim, SimConfig};


}
