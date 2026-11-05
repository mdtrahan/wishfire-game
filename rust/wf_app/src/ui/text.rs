//! Canvas typography for the in-fight HUD and the narrative scene (the menus are page elements
//! with the browser's own `system-ui`). The wasm build cannot load a system font, so the canvas
//! text uses bundled Inter Regular (OFL, `web-runner/assets/fonts/`, Latin subset). Glyphs are
//! rasterized at device density (`Portrait::density`) and drawn at 1:1 target pixels, so text
//! is not pixelated at DPR 2.
use macroquad::prelude::*;
use std::cell::RefCell;
use std::collections::HashSet;

thread_local! {
    static FONT: RefCell<Option<Font>> = const { RefCell::new(None) };
    static WARM: RefCell<HashSet<u16>> = RefCell::new(HashSet::new());
}
/// Each size is pre-rasterized with printable ASCII plus these: growing the atlas mid-frame
/// invalidates draws already queued, so every size is warmed before its first draw.
const WARM_EXTRA: &str = "×·‹›★☆•…–—’";
/// Sizes the canvas text uses (logical px), warmed at install time.
const WARM_SIZES: &[f32] = &[6., 7., 8., 9., 10., 11., 12., 13., 14., 15., 16., 18., 20., 22., 24.];

pub fn install(font: Font) {
    FONT.with(|f| *f.borrow_mut() = Some(font));
    WARM.with(|w| w.borrow_mut().clear());
    for size in WARM_SIZES { ensure(px(*size)); }
}
fn density() -> f32 { crate::camera::Portrait::density() }
fn px(size: f32) -> u16 { (size * density()).round().max(1.) as u16 }
fn ensure(px: u16) {
    let fresh = WARM.with(|w| w.borrow_mut().insert(px));
    if !fresh { return; }
    FONT.with(|f| {
        if let Some(font) = f.borrow().as_ref() {
            let chars: Vec<char> = (' '..='~').chain(WARM_EXTRA.chars()).collect();
            font.populate_font_cache(&chars, px);
        }
    });
}
fn with_font<R>(f: impl FnOnce(Option<&Font>) -> R) -> R { FONT.with(|font| f(font.borrow().as_ref())) }
/// Advance width in logical px.
pub fn measure(text: &str, size: f32) -> f32 {
    let p = px(size);
    ensure(p);
    with_font(|font| measure_text(text, font, p, size / p as f32).width)
}
/// Cap height in logical px (Inter's cap centre coincides with the CSS content-area centre).
pub fn cap(size: f32) -> f32 {
    let p = px(size);
    ensure(p);
    with_font(|font| measure_text("H", font, p, size / p as f32).offset_y)
}
#[derive(Clone, Copy, PartialEq)]
pub enum Align { Left, Center, Right }
/// Draw vertically centred on `cy` the way CSS centres a single line (cap-height centre);
/// returns the advance width.
pub fn draw(text: &str, x: f32, cy: f32, size: f32, color: Color, align: Align) -> f32 {
    let p = px(size);
    ensure(p);
    let scale = size / p as f32;
    let baseline = cy + cap(size) / 2.;
    with_font(|font| {
        let width = measure_text(text, font, p, scale).width;
        let x = match align { Align::Left => x, Align::Center => x - width / 2., Align::Right => x - width };
        draw_text_ex(text, x, baseline, TextParams { font, font_size: p, font_scale: scale, color, ..Default::default() });
        width
    })
}
/// Word-wrap into lines no wider than `width`.
pub fn wrap(text: &str, width: f32, size: f32) -> Vec<String> {
    let mut lines = Vec::new();
    let mut line = String::new();
    for word in text.split_whitespace() {
        let candidate = if line.is_empty() { word.to_string() } else { format!("{line} {word}") };
        if line.is_empty() || measure(&candidate, size) <= width { line = candidate; } else { lines.push(line); line = word.to_string(); }
    }
    if !line.is_empty() { lines.push(line); }
    lines
}
/// A block of wrapped lines with CSS `line-height` boxes; returns the height used.
pub fn paragraph(text: &str, x: f32, top: f32, width: f32, size: f32, line_h: f32, color: Color) -> f32 {
    let lines = wrap(text, width, size);
    for (i, line) in lines.iter().enumerate() { draw(line, x, top + line_h * (i as f32 + 0.5), size, color, Align::Left); }
    lines.len() as f32 * line_h
}
