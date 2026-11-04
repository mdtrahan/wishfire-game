//! UI typography. Main's menus use CSS `system-ui`; the wasm build cannot load a system font, so
//! the client bundles Inter (OFL, `web-runner/assets/fonts/Inter-*.ttf`, Latin subset) at main's
//! computed sizes and weights. Glyphs are rasterized at device density (`Portrait::density`) and
//! drawn at 1:1 target pixels, so text is not pixelated at DPR 2.
use macroquad::prelude::*;
use std::cell::RefCell;
use std::collections::HashSet;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Weight { Regular, SemiBold, Bold, ExtraBold }
pub struct Fonts { pub regular: Font, pub semibold: Font, pub bold: Font, pub extrabold: Font }
impl Fonts {
    fn get(&self, weight: Weight) -> &Font { match weight { Weight::Regular => &self.regular, Weight::SemiBold => &self.semibold, Weight::Bold => &self.bold, Weight::ExtraBold => &self.extrabold } }
}
thread_local! {
    static FONTS: RefCell<Option<Fonts>> = const { RefCell::new(None) };
    static WARM: RefCell<HashSet<(Weight, u16)>> = RefCell::new(HashSet::new());
}
/// The character set each (weight, size) pair is pre-rasterized with: growing the atlas mid-frame
/// invalidates draws already queued, so every size is warmed before its first draw.
const WARM_CHARS: &str = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 !?:;.,/+-_=()|~<>%^#'\"*×·‹›★☆•…–—’";
/// Sizes main's menus use (CSS px), warmed at install time.
const WARM_SIZES: &[f32] = &[7.7, 8., 8.63, 9., 9.53, 10., 10.08, 10.36, 11., 11.48, 12., 13., 13.47, 14., 15.4, 16., 16.1, 18., 18.2, 20., 22., 24., 28.];

pub fn install(fonts: Fonts) {
    FONTS.with(|f| *f.borrow_mut() = Some(fonts));
    WARM.with(|w| w.borrow_mut().clear());
    warm();
}
/// Pre-rasterize the warm set at the current density.
pub fn warm() {
    for weight in [Weight::Regular, Weight::SemiBold, Weight::Bold, Weight::ExtraBold] {
        for size in WARM_SIZES { ensure(weight, px(*size)); }
    }
}
fn density() -> f32 { crate::camera::Portrait::density() }
fn px(size: f32) -> u16 { (size * density()).round().max(1.) as u16 }
fn ensure(weight: Weight, px: u16) {
    let fresh = WARM.with(|w| w.borrow_mut().insert((weight, px)));
    if !fresh { return; }
    FONTS.with(|f| {
        if let Some(fonts) = f.borrow().as_ref() {
            let chars: Vec<char> = WARM_CHARS.chars().collect();
            fonts.get(weight).populate_font_cache(&chars, px);
        }
    });
}
fn with_font<R>(weight: Weight, f: impl FnOnce(Option<&Font>) -> R) -> R {
    FONTS.with(|fonts| { let fonts = fonts.borrow(); f(fonts.as_ref().map(|x| x.get(weight))) })
}
/// Advance width in logical px.
pub fn measure(text: &str, size: f32, weight: Weight) -> f32 {
    let p = px(size);
    ensure(weight, p);
    with_font(weight, |font| measure_text(text, font, p, size / p as f32).width)
}
/// Cap height in logical px (Inter's cap centre coincides with the CSS content-area centre).
pub fn cap(size: f32, weight: Weight) -> f32 {
    let p = px(size);
    ensure(weight, p);
    with_font(weight, |font| measure_text("H", font, p, size / p as f32).offset_y)
}
#[derive(Clone, Copy, PartialEq)]
pub enum Align { Left, Center, Right }
/// Draw with the baseline at `baseline`; returns the advance width.
pub fn draw_baseline(text: &str, x: f32, baseline: f32, size: f32, weight: Weight, color: Color, align: Align) -> f32 {
    let p = px(size);
    ensure(weight, p);
    let scale = size / p as f32;
    with_font(weight, |font| {
        let width = measure_text(text, font, p, scale).width;
        let x = match align { Align::Left => x, Align::Center => x - width / 2., Align::Right => x - width };
        draw_text_ex(text, x, baseline, TextParams { font, font_size: p, font_scale: scale, color, ..Default::default() });
        width
    })
}
/// Draw vertically centred on `cy` the way CSS centres a single line (cap-height centre).
pub fn draw(text: &str, x: f32, cy: f32, size: f32, weight: Weight, color: Color, align: Align) -> f32 {
    let c = cap(size, weight);
    draw_baseline(text, x, cy + c / 2., size, weight, color, align)
}
/// `text-shadow`: the shadow copy first, then the text.
pub fn draw_shadowed(text: &str, x: f32, cy: f32, size: f32, weight: Weight, color: Color, align: Align, shadow: (f32, f32, Color)) -> f32 {
    draw(text, x + shadow.0, cy + shadow.1, size, weight, shadow.2, align);
    draw(text, x, cy, size, weight, color, align)
}
/// Word-wrap into lines no wider than `width` (`overflow-wrap: anywhere` is not needed by the copy).
pub fn wrap(text: &str, width: f32, size: f32, weight: Weight) -> Vec<String> {
    let mut lines = Vec::new();
    let mut line = String::new();
    for word in text.split_whitespace() {
        let candidate = if line.is_empty() { word.to_string() } else { format!("{line} {word}") };
        if line.is_empty() || measure(&candidate, size, weight) <= width { line = candidate; } else { lines.push(line); line = word.to_string(); }
    }
    if !line.is_empty() { lines.push(line); }
    lines
}
/// A block of wrapped lines with CSS `line-height` boxes; returns the height used.
pub fn paragraph(text: &str, x: f32, top: f32, width: f32, size: f32, line_h: f32, weight: Weight, color: Color) -> f32 {
    let lines = wrap(text, width, size, weight);
    for (i, line) in lines.iter().enumerate() { draw(line, x, top + line_h * (i as f32 + 0.5), size, weight, color, Align::Left); }
    lines.len() as f32 * line_h
}
