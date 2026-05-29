fn number_or_zero(value: f64) -> f64 {
    if value.is_nan() {
        0.0
    } else {
        value
    }
}

fn round_like_js(value: f64) -> f64 {
    if value.is_finite() {
        (value + 0.5).floor()
    } else {
        value
    }
}

pub fn combat_power(atk: f64, def: f64, hp: f64) -> f64 {
    let a = number_or_zero(atk);
    let d = number_or_zero(def);
    let h = number_or_zero(hp);

    round_like_js((a + d + (h / 10.0)) * 100.0) / 100.0
}
