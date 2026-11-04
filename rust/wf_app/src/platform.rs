//! Browser/native platform seams: durable key-value storage (localStorage in the browser, a
//! file beside the executable natively) and wall-clock milliseconds.
#[cfg(target_arch = "wasm32")]
#[link(wasm_import_module = "env")]
extern "C" {
    fn wf_storage_get(key_ptr: *const u8, key_len: u32, out_ptr: *mut u8, out_cap: u32) -> i32;
    fn wf_storage_set(key_ptr: *const u8, key_len: u32, val_ptr: *const u8, val_len: u32) -> i32;
    fn wf_storage_remove(key_ptr: *const u8, key_len: u32) -> i32;
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

/// Wall-clock milliseconds for host pacing (performance.now lineage).
pub fn now_ms() -> f64 { macroquad::time::get_time() * 1000. }
