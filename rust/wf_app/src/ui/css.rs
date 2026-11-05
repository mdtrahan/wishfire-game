//! Menu styling. `css/hero.css`, `css/nav.css` and `css/modal_close.css` are main's rules, copied
//! verbatim from the files named in their first line; `css/stage.css` adapts main's
//! `position:fixed` overlays to the `#wf-ui` frame element. Art paths are main's
//! (`assets/images/...`), staged by `tools/build_wf_app.sh` and versioned with the art revision.
use std::cell::RefCell;
const SHEETS: &[&str] = &[include_str!("css/stage.css"), include_str!("css/nav.css"), include_str!("css/modal_close.css"), include_str!("css/hero.css")];
thread_local! { static SHEET: RefCell<Option<String>> = const { RefCell::new(None) }; }
/// `assets/<path>` with the art revision, so a browser never shows stale art.
pub fn asset(path: &str) -> String { format!("assets/{path}?v={}", env!("WF_ART_REV")) }
/// Every rule, with `url(...)` art versioned like [`asset`].
pub fn sheet() -> String {
    SHEET.with(|s| s.borrow_mut().get_or_insert_with(|| {
        let rev = format!(".png?v={}", env!("WF_ART_REV"));
        SHEETS.concat().replace(".png'", &format!("{rev}'")).replace(".png\"", &format!("{rev}\"")).replace(".png)", &format!("{rev})"))
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
