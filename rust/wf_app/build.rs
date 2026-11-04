use std::{env, path::PathBuf};
fn fingerprint(bytes: &[u8], mut hash: u64) -> u64 {
    for &byte in bytes { hash = (hash ^ byte as u64).wrapping_mul(0x100000001b3); }
    hash
}
fn walk(dir: &std::path::Path, out: &mut Vec<std::path::PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for e in entries.filter_map(Result::ok) {
        let path = e.path();
        if path.is_dir() { walk(&path, out) } else { out.push(path) }
    }
}
fn main() {
    let app = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let repo = app.join("../..");
    // A new binary must never request a cached manifest/atlas from another packing run.
    let manifest_path = app.join("gen/assets.json");
    println!("cargo:rerun-if-changed={}", manifest_path.display());
    let manifest = std::fs::read(&manifest_path).expect("run tools/build_wf_app.sh (wf_pack) before building wf_app");
    let manifest_hash = fingerprint(&manifest, 0xcbf29ce484222325);
    let mut pages: Vec<_> = std::fs::read_dir(app.join("gen")).unwrap().filter_map(Result::ok)
        .filter(|p| p.file_name().to_string_lossy().starts_with("atlas-") && p.path().extension().is_some_and(|e| e == "png"))
        .map(|p| p.path()).collect();
    pages.sort();
    let mut bundle_hash = manifest_hash;
    for page in pages {
        println!("cargo:rerun-if-changed={}", page.display());
        bundle_hash = fingerprint(page.file_name().unwrap().to_string_lossy().as_bytes(), bundle_hash);
        bundle_hash = fingerprint(&std::fs::read(page).unwrap(), bundle_hash);
    }
    println!("cargo:rustc-env=WF_PACKED_MANIFEST_HASH={manifest_hash:016x}");
    println!("cargo:rustc-env=WF_PACKED_ART_REV={bundle_hash:016x}");
    // Every runtime art fetch carries this content revision so a browser never shows stale art.
    let art_root = repo.join("web-runner/assets/rust-combat");
    println!("cargo:rerun-if-changed={}", art_root.display());
    let mut files = Vec::new();
    walk(&art_root, &mut files);
    files.sort();
    let mut art_hash = bundle_hash;
    for file in files {
        art_hash = fingerprint(file.strip_prefix(&art_root).unwrap().to_string_lossy().as_bytes(), art_hash);
        art_hash = fingerprint(&std::fs::read(&file).unwrap(), art_hash);
    }
    println!("cargo:rustc-env=WF_ART_REV={art_hash:016x}");
}
