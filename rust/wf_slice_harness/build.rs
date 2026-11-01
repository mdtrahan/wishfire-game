use serde_json::Value;
use std::fmt::Write;

pub fn compile(source: &str) -> Result<String, String> {
    let root: Value =
        serde_json::from_str(source).map_err(|e| format!("invalid waves JSON: {e}"))?;
    if root["version"].as_u64() != Some(2) {
        return Err("waves.version must be 2".into());
    }
    let stages = array(&root["stages"], "stages")?;
    if stages.len() != 3 {
        return Err("stages must contain Troll, Chimerilass, Djinn in tier order".into());
    }
    let mut rust = String::from("// Generated from data/waves.json.\n");
    for (tier, stage) in stages.iter().enumerate() {
        let path = format!("stages[{tier}]");
        let waves = array(&stage["waves"], &format!("{path}.waves"))?;
        if waves.len() < 2 {
            return Err(format!("{path} needs ordinary waves and a final boss wave"));
        }
        writeln!(
            rust,
            "pub(crate) const STAGE_{}: &[MiniWave] = &[",
            tier + 1
        )
        .unwrap();
        for (index, wave) in waves.iter().enumerate() {
            let path = format!("{path}.waves[{index}]");
            let name = text(&wave["name"], &format!("{path}.name"))?;
            let theme = text(&wave["theme"], &format!("{path}.theme"))?;
            let subwaves = array(&wave["subwaves"], &format!("{path}.subwaves"))?;
            if subwaves.is_empty() {
                return Err(format!("{path}.subwaves cannot be empty"));
            }
            let gap = if index == 0 { "0." } else { "3.5" };
            writeln!(rust, "MiniWave {{ name: {name:?}, theme: {theme:?}, trigger: Trigger::PreviousCleared {{ delay_s: {gap} }}, subwaves: &[").unwrap();
            let mut bosses = 0;
            for (sub_index, sub) in subwaves.iter().enumerate() {
                let path = format!("{path}.subwaves[{sub_index}]");
                let anchor = match sub["placed"].as_str() {
                    Some("party") => "Party",
                    Some("arena") => "Arena",
                    _ => return Err(format!("{path}.placed must be party or arena")),
                };
                let pattern = match sub["pattern"].as_str() {
                    Some("authored") => "Authored",
                    Some("seeded") => "Seeded",
                    _ => return Err(format!("{path}.pattern must be authored or seeded")),
                };
                writeln!(
                    rust,
                    "SubWave {{ placed: Anchor::{anchor}, pattern: Pattern::{pattern}, spawns: &["
                )
                .unwrap();
                let entries = array(
                    &sub[if pattern == "Authored" {
                        "spawns"
                    } else {
                        "units"
                    }],
                    &path,
                )?;
                let mut count = 0usize;
                for (i, spawn) in entries.iter().enumerate() {
                    let path = format!("{path}[{i}]");
                    let kind = enemy(&spawn["type"], tier, &path)?;
                    let is_boss = matches!(kind, "Boss" | "BossBomber" | "BossMarksman");
                    let repetitions = if pattern == "Seeded" {
                        spawn["count"]
                            .as_u64()
                            .filter(|n| *n > 0 && *n <= 32)
                            .ok_or_else(|| format!("{path}.count must be an integer in 1..32"))?
                            as usize
                    } else {
                        1
                    };
                    count += repetitions;
                    if count > 32 {
                        return Err(format!("{path}: a sub-wave supports at most 32 units"));
                    }
                    if is_boss {
                        bosses += repetitions;
                        if index != waves.len() - 1 || anchor != "Arena" {
                            return Err(format!("{path}: bosses belong to the last wave, anchored at the arena centre"));
                        }
                    }
                    let (x, y) = if pattern == "Authored" {
                        (number(&spawn["x"], &path)?, number(&spawn["y"], &path)?)
                    } else {
                        (0., 0.)
                    };
                    let delay = match spawn.get("delay_s") {
                        None => 0.,
                        Some(v) => number(v, &path)?,
                    };
                    if delay < 0. {
                        return Err(format!("{path}.delay_s must be nonnegative"));
                    }
                    for _ in 0..repetitions {
                        writeln!(rust, "Spawn {{ archetype: Archetype::{kind}, offset: Vec2::new(f32::from_bits({}), f32::from_bits({})), delay_s: f32::from_bits({}) }},", x.to_bits(), y.to_bits(), delay.to_bits()).unwrap();
                    }
                }
                if count == 0 {
                    return Err(format!("{path} cannot be empty"));
                }
                rust.push_str("] },\n");
            }
            if bosses != usize::from(index == waves.len() - 1) {
                return Err(format!(
                    "{path}: exactly one boss is required in the final wave, and none earlier"
                ));
            }
            rust.push_str("] },\n");
        }
        rust.push_str("];\n");
    }
    Ok(rust)
}
fn array<'a>(v: &'a Value, path: &str) -> Result<&'a Vec<Value>, String> {
    v.as_array()
        .ok_or_else(|| format!("{path} must be an array"))
}
fn text<'a>(v: &'a Value, path: &str) -> Result<&'a str, String> {
    v.as_str().ok_or_else(|| format!("{path} must be a string"))
}
fn number(v: &Value, path: &str) -> Result<f32, String> {
    v.as_f64()
        .map(|n| n as f32)
        .filter(|n| n.is_finite())
        .ok_or_else(|| format!("{path}: expected a finite f32 number"))
}
fn enemy(v: &Value, tier: usize, path: &str) -> Result<&'static str, String> {
    Ok(match v.as_str() {
        Some("gobloc") => "Gobloc",
        Some("bastorto") if tier == 0 => {
            return Err(format!(
                "{path}: Bastorto is forbidden before the first boss"
            ));
        }
        Some("bastorto") => "Bastorto",
        Some("orc") => "Orc",
        Some("high orc") => "HighOrc",
        Some("gloamink") => "Gloamink",
        Some("marid") => "Marid",
        Some("mirewing") => "Mirewing",
        Some("lizardo") => "Lizardo",
        Some("sniper") => "Sniper",
        Some("fizzmite") => "Fizzmite",
        Some("boss") => ["Boss", "BossBomber", "BossMarksman"][tier],
        other => return Err(format!("{path}: unknown enemy type {other:?}")),
    })
}
#[cfg(not(test))]
fn main() {
    let manifest = std::path::PathBuf::from(std::env::var_os("CARGO_MANIFEST_DIR").unwrap());
    let input = manifest.join("fixtures/waves.json");
    println!("cargo:rerun-if-changed={}", input.display());
    let source = std::fs::read_to_string(input).expect("read data/waves.json");
    let rust = compile(&source).unwrap_or_else(|error| panic!("data/waves.json: {error}"));
    let output = std::path::PathBuf::from(std::env::var_os("OUT_DIR").unwrap()).join("waves.rs");
    std::fs::write(output, rust).expect("write generated wave tables");
}
