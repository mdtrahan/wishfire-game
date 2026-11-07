//! Browser/native platform seams: durable key-value storage (localStorage in the browser, a
//! file beside the executable natively) and wall-clock milliseconds.
#[cfg(target_arch = "wasm32")]
#[link(wasm_import_module = "env")]
extern "C" {
    fn wf_storage_get(key_ptr: *const u8, key_len: u32, out_ptr: *mut u8, out_cap: u32) -> i32;
    fn wf_storage_set(key_ptr: *const u8, key_len: u32, val_ptr: *const u8, val_len: u32) -> i32;
    fn wf_storage_remove(key_ptr: *const u8, key_len: u32) -> i32;
    fn wf_session_get(key_ptr: *const u8, key_len: u32, out_ptr: *mut u8, out_cap: u32) -> i32;
    fn wf_session_set(key_ptr: *const u8, key_len: u32, val_ptr: *const u8, val_len: u32) -> i32;
    fn wf_session_remove(key_ptr: *const u8, key_len: u32) -> i32;
    fn wf_random_u32() -> u32;
}
#[cfg(target_arch = "wasm32")]
pub fn storage_get(key: &str) -> Option<String> {
    unsafe {
        let needed = wf_storage_get(key.as_ptr(), key.len() as u32, std::ptr::null_mut(), 0);
        if needed < 0 { return None; }
        let mut buffer = vec![0u8; needed as usize];
        let written = wf_storage_get(key.as_ptr(), key.len() as u32, buffer.as_mut_ptr(), buffer.len() as u32);
        if written < 0 { return None; }
        buffer.truncate(written as usize);
        String::from_utf8(buffer).ok()
    }
}
#[cfg(target_arch = "wasm32")]
pub fn storage_set(key: &str, value: &str) -> bool { unsafe { wf_storage_set(key.as_ptr(), key.len() as u32, value.as_ptr(), value.len() as u32) == 1 } }
#[cfg(target_arch = "wasm32")]
pub fn storage_remove(key: &str) -> bool { unsafe { wf_storage_remove(key.as_ptr(), key.len() as u32) == 1 } }
#[cfg(target_arch = "wasm32")]
pub fn session_get(key: &str) -> Option<String> {
    unsafe {
        let needed = wf_session_get(key.as_ptr(), key.len() as u32, std::ptr::null_mut(), 0);
        if needed < 0 { return None; }
        let mut buffer = vec![0u8; needed as usize];
        let written = wf_session_get(key.as_ptr(), key.len() as u32, buffer.as_mut_ptr(), buffer.len() as u32);
        if written < 0 { return None; }
        buffer.truncate(written as usize);
        String::from_utf8(buffer).ok()
    }
}
#[cfg(target_arch = "wasm32")]
pub fn session_set(key: &str, value: &str) -> bool { unsafe { wf_session_set(key.as_ptr(), key.len() as u32, value.as_ptr(), value.len() as u32) == 1 } }
#[cfg(target_arch = "wasm32")]
pub fn session_remove(key: &str) -> bool { unsafe { wf_session_remove(key.as_ptr(), key.len() as u32) == 1 } }
/// `crypto.getRandomValues`: lamp seeds.
#[cfg(target_arch = "wasm32")]
pub fn random_u32() -> u32 { unsafe { wf_random_u32() } }

#[cfg(not(target_arch = "wasm32"))]
fn storage_path(key: &str) -> std::path::PathBuf {
    let dir = std::env::var_os("WF_SAVE_DIR").map(std::path::PathBuf::from).unwrap_or_else(|| std::path::PathBuf::from(".wf-save"));
    let _ = std::fs::create_dir_all(&dir);
    dir.join(format!("{}.json", key.replace(['/', '\\'], "_")))
}
#[cfg(not(target_arch = "wasm32"))]
pub fn storage_get(key: &str) -> Option<String> { std::fs::read_to_string(storage_path(key)).ok() }
#[cfg(not(target_arch = "wasm32"))]
pub fn storage_set(key: &str, value: &str) -> bool { std::fs::write(storage_path(key), value).is_ok() }
#[cfg(not(target_arch = "wasm32"))]
pub fn storage_remove(key: &str) -> bool { std::fs::remove_file(storage_path(key)).is_ok() }
#[cfg(not(target_arch = "wasm32"))]
pub fn session_get(key: &str) -> Option<String> { std::fs::read_to_string(storage_path(&format!("session.{key}"))).ok() }
#[cfg(not(target_arch = "wasm32"))]
pub fn session_set(key: &str, value: &str) -> bool { std::fs::write(storage_path(&format!("session.{key}")), value).is_ok() }
#[cfg(not(target_arch = "wasm32"))]
pub fn session_remove(key: &str) -> bool { std::fs::remove_file(storage_path(&format!("session.{key}"))).is_ok() }
#[cfg(not(target_arch = "wasm32"))]
pub fn random_u32() -> u32 { let t = (macroquad::miniquad::date::now() * 1e6) as u64; ((t ^ (t >> 31)).wrapping_mul(0x9E37_79B9_7F4A_7C15) >> 32) as u32 }

/// Wall-clock milliseconds for host pacing (performance.now lineage).
pub fn now_ms() -> f64 { macroquad::time::get_time() * 1000. }
/// `Date.now()`: epoch milliseconds for saves that stamp real time (lamp activations).
pub fn epoch_ms() -> f64 { (macroquad::miniquad::date::now() * 1000.).floor() }
