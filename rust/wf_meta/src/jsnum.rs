//! JavaScript number semantics used by the translated rules.

/// `ToUint32(x)`: truncate toward zero, then modulo 2^32 (NaN/Infinity become 0).
pub fn to_uint32(x: f64) -> u32 {
    if !x.is_finite() { return 0; }
    x.trunc().rem_euclid(4294967296.0) as u32
}
/// `ToInt32(x)` for bitwise operators.
pub fn to_int32(x: f64) -> i32 { to_uint32(x) as i32 }
/// `Math.imul(a, b)`.
pub fn imul(a: f64, b: f64) -> i32 { to_int32(a).wrapping_mul(to_int32(b)) }
/// `Math.round(x)`: half rounds toward +infinity.
pub fn round(x: f64) -> f64 {
    if !x.is_finite() { return x; }
    let f = x.floor();
    if x - f >= 0.5 { f + 1. } else { f }
}
/// `Number(value)` for a possibly-missing number: NaN-safe `|| 0` is left to callers.
pub fn or0(x: Option<f64>) -> f64 { x.filter(|v| v.is_finite()).unwrap_or(0.) }
/// `Math.hypot(a, b)` as V8 computes it: max-normalized Kahan sum, then `sqrt(sum) * max`.
pub fn hypot(a: f64, b: f64) -> f64 {
    let (x, y) = (a.abs(), b.abs());
    if x.is_infinite() || y.is_infinite() { return f64::INFINITY; }
    if x.is_nan() || y.is_nan() { return f64::NAN; }
    let max = x.max(y);
    if max == 0. { return 0.; }
    let mut sum = 0.;
    let mut compensation = 0.;
    for v in [x, y] {
        let n = v / max;
        let summand = n * n - compensation;
        let preliminary = sum + summand;
        compensation = (preliminary - sum) - summand;
        sum = preliminary;
    }
    sum.sqrt() * max
}
pub fn clamp(value: f64, min: f64, max: f64) -> f64 { max.min(min.max(value)) }
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn uint32_and_imul_follow_js() {
        assert_eq!(to_uint32(-1.), 4294967295);
        assert_eq!(to_uint32(4294967296.5), 0);
        assert_eq!(imul(2654435761., 3.), (2654435761u32 as i32).wrapping_mul(3));
        assert_eq!(round(2.5), 3.);
        assert_eq!(round(-2.5), -2.);
        assert_eq!(hypot(3., 4.), 5.);
    }
}

/// `Number(value)` for a JSON value: numbers, booleans, null and numeric strings; anything else is NaN.
pub fn number(value: Option<&serde_json::Value>) -> f64 {
    use serde_json::Value;
    match value {
        None | Some(Value::Null) => if value.is_none() { f64::NAN } else { 0. },
        Some(Value::Number(n)) => n.as_f64().unwrap_or(f64::NAN),
        Some(Value::Bool(b)) => if *b { 1. } else { 0. },
        Some(Value::String(s)) => { let t = s.trim(); if t.is_empty() { 0. } else { t.parse::<f64>().unwrap_or(f64::NAN) } }
        Some(_) => f64::NAN,
    }
}
/// `Number(value) || fallback`: NaN and 0 fall back.
pub fn number_or(value: Option<&serde_json::Value>, fallback: f64) -> f64 { let n = number(value); if n.is_nan() || n == 0. { fallback } else { n } }
/// `Number.isSafeInteger(value)` for a JSON value (numbers only).
pub fn is_safe_integer(value: Option<&serde_json::Value>) -> bool {
    match value { Some(serde_json::Value::Number(n)) => n.as_f64().is_some_and(|f| f.is_finite() && f.fract() == 0. && f.abs() <= 9007199254740991.), _ => false }
}
