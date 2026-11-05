//! Menu styling. `css/hero.css`, `css/nav.css` and `css/modal_close.css` are main's rules, copied
//! verbatim from the files named in their first line; `css/stage.css` adapts main's
//! `position:fixed` overlays to the `#wf-ui` frame element. Art paths are main's
//! (`assets/images/...`), staged by `tools/build_wf_app.sh` and versioned with the art revision.
use std::cell::RefCell;
const SHEETS: &[&str] = &[include_str!("css/stage.css"), include_str!("css/nav.css"), include_str!("css/modal_close.css"), include_str!("css/hero.css"), include_str!("css/progression.css"), include_str!("css/vault.css"), include_str!("css/quest.css"), include_str!("css/quest_map.css"), include_str!("css/lamp.css"), include_str!("css/bag_upgrade.css"), include_str!("css/lamp_adapter.css"), include_str!("css/receipt.css"), include_str!("css/dev.css")];
thread_local! { static SHEET: RefCell<Option<String>> = const { RefCell::new(None) }; }
/// `assets/<path>` with the art revision, so a browser never shows stale art.
pub fn asset(path: &str) -> String { format!("assets/{path}?v={}", env!("WF_ART_REV")) }
/// An SVG drawing as an `<img>` source (the element bridge creates HTML elements only).
pub fn svg_uri(svg: &str) -> String {
    let mut out = String::from("data:image/svg+xml,");
    for c in svg.chars() { match c { '#' => out.push_str("%23"), '%' => out.push_str("%25"), '<' => out.push_str("%3C"), '>' => out.push_str("%3E"), '"' => out.push('\''), _ => out.push(c) } }
    out
}
/// Every rule, with `url(...)` art versioned like [`asset`].
pub fn sheet() -> String {
    SHEET.with(|s| s.borrow_mut().get_or_insert_with(|| {
        let rev = format!(".png?v={}", env!("WF_ART_REV"));
        // The lamp sheets are files under assets/ on main; their url()s are relative to that folder.
        SHEETS.concat().replace("url('images/", "url('assets/images/").replace(".png'", &format!("{rev}'")).replace(".png\"", &format!("{rev}\"")).replace(".png)", &format!("{rev})"))
    }).clone())
}
#[cfg(test)]
mod tests {
    #[test]
    fn sheet_versions_art_urls_and_keeps_main_rules() {
        let sheet = super::sheet();
        assert!(sheet.contains("url('assets/images/progression/hero-tickets.png?v="));
        assert!(sheet.contains("#hero-details .card-select img{position:absolute;left:-40%;top:-2%;width:180%;height:auto;max-width:none}"));
        assert!(sheet.contains("#game-meta-nav{position:fixed;display:flex;width:360px;height:60px"));
    }
}
