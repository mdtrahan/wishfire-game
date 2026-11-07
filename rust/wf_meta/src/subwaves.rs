//! `web-runner/src/core/continuousCombatSubwaves.mjs`: stages -> waves -> subwaves -> {key, count}.
use serde::Serialize;
pub const SUBWAVE_MAX_SECONDS: f64 = 10.;
pub const SUBWAVE_REMAINING: usize = 1;
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct SubwaveEntry { pub key: String, pub count: usize }
/// Splits an ordered key list into `floor((n+1)/4)` groups, keeping first-seen key order per group.
pub fn author_subwaves(keys: &[String]) -> Vec<Vec<SubwaveEntry>> {
    let count = ((keys.len() + 1) / 4).max(1);
    let size = keys.len() / count;
    let extra = keys.len() % count;
    let mut offset = 0;
    let mut groups = Vec::new();
    for i in 0..count {
        let take = size + usize::from(i < extra);
        let mut entries: Vec<SubwaveEntry> = Vec::new();
        for key in &keys[offset..offset + take] {
            match entries.iter_mut().find(|e| &e.key == key) { Some(e) => e.count += 1, None => entries.push(SubwaveEntry { key: key.clone(), count: 1 }) }
        }
        offset += take;
        if !entries.is_empty() { groups.push(entries); }
    }
    groups
}
/// Binds authored groups to actor indices by name, in authored order; every actor must be consumed.
pub fn bind_authored_subwaves(subwaves: &[Vec<SubwaveEntry>], names: &[String]) -> Result<Vec<Vec<usize>>, String> {
    let mut remaining: Vec<usize> = (0..names.len()).collect();
    let mut groups = Vec::new();
    for subwave in subwaves {
        let mut group = Vec::new();
        for entry in subwave {
            if entry.count < 1 { return Err("Invalid subwave count".into()); }
            for _ in 0..entry.count {
                let pos = remaining.iter().position(|&i| names[i] == entry.key).ok_or_else(|| format!("Subwave enemy missing: {}", entry.key))?;
                group.push(remaining.remove(pos));
            }
        }
        groups.push(group);
    }
    if !remaining.is_empty() { return Err("Subwave authoring omitted enemies".into()); }
    Ok(groups)
}
pub fn subwave_ready(previous_living: usize, elapsed: f64) -> bool { previous_living <= SUBWAVE_REMAINING || elapsed + 1e-6 >= SUBWAVE_MAX_SECONDS }
