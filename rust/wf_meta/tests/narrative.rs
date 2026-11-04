//! Replays `tests/fixtures/rust-oracle/narrative.json` (JS narrative runtime + scene controller + render sync).
use serde_json::{json, Value};
use wf_meta::narrative::*;

fn fixture() -> Value { serde_json::from_str(&std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/../../tests/fixtures/rust-oracle/narrative.json")).unwrap()).unwrap() }
fn canon(v: &Value) -> Value {
    match v {
        Value::Number(n) => n.as_f64().map_or(v.clone(), |f| if f.fract() == 0. && f.abs() < 1e15 { json!(f as i64) } else { json!((f * 1e9).round() / 1e9) }),
        Value::Array(a) => Value::Array(a.iter().map(canon).collect()),
        Value::Object(o) => Value::Object(o.iter().filter(|(_, v)| !v.is_null()).map(|(k, v)| (k.clone(), canon(v))).collect()),
        other => other.clone(),
    }
}
fn first_diff(path: &str, a: &Value, b: &Value) -> Option<String> {
    match (a, b) {
        (Value::Object(x), Value::Object(y)) => { for k in x.keys().chain(y.keys()) { if let Some(d) = first_diff(&format!("{path}.{k}"), x.get(k).unwrap_or(&Value::Null), y.get(k).unwrap_or(&Value::Null)) { return Some(d); } } None }
        (Value::Array(x), Value::Array(y)) => { if x.len() != y.len() { return Some(format!("{path}: len {} vs {}", x.len(), y.len())); } for (i, (p, q)) in x.iter().zip(y).enumerate() { if let Some(d) = first_diff(&format!("{path}[{i}]"), p, q) { return Some(d); } } None }
        _ => (a != b).then(|| format!("{path}: rust {a} vs js {b}")),
    }
}
fn assert_same(label: &str, rust: &Value, js: &Value) { if let Some(d) = first_diff(label, &canon(rust), &canon(js)) { panic!("{d}"); } }
fn rect(r: Option<Rect>) -> Value { r.map_or(Value::Null, |r| json!({ "x": r.x, "y": r.y, "w": r.w, "h": r.h })) }
fn zones(z: &HitZones) -> Value { let mut m = serde_json::Map::new(); for (k, r) in [("restart", z.restart), ("auto", z.auto), ("skip", z.skip), ("panel", z.panel)] { if r.is_some() { m.insert(k.into(), rect(r)); } } Value::Object(m) }

#[test]
fn pages_match_intl_segmenter() {
    let f = fixture();
    for row in f["pages"].as_array().unwrap() {
        let text = row["text"].as_str().unwrap();
        let step = STEPS.iter().find(|s| s.id == row["id"].as_str().unwrap()).unwrap();
        assert_eq!(step.text, text, "content text {}", step.id);
        let pages = pages(text);
        assert_same(&format!("pages {}", step.id), &json!(pages), &row["pages"]);
        assert_same(&format!("read {}", step.id), &json!(pages.iter().map(|p| read_seconds(p)).collect::<Vec<_>>()), &row["readSeconds"]);
    }
    assert_eq!(handoff_index() as u64, f["handoff"].as_u64().unwrap());
}

#[test]
fn scene_playback_matches() {
    let f = fixture();
    let content = Content::before_handoff();
    let mut state = NarrativeState::default();
    let mut p = Presentation::new(0.);
    let mut last_render: Option<RenderModel> = None;
    for (index, step) in f["steps"].as_array().unwrap().iter().enumerate() {
        let t = step["t"].as_f64().unwrap();
        let label = format!("step {index} {} t={t}", step["op"]);
        let mut result = Value::Null;
        match step["op"].as_str().unwrap() {
            "restart" => { restart(&mut state, &mut p, t); last_render = None; }
            "render" => { let r = render_sync(&state, &mut p, content, t); if r.completed { result = json!({ "completed": true }); } last_render = Some(r); }
            "tap" => { let action = pointer(&mut state, &mut p, content, step["args"]["x"].as_f64().unwrap(), step["args"]["y"].as_f64().unwrap(), t); if action == "restart" { last_render = None; } result = json!(action); }
            "auto" => { result = json!(update_auto(&mut state, &mut p, content, t)); }
            other => panic!("unknown op {other}"),
        }
        assert_same(&format!("{label} result"), &result, &step["result"]);
        assert_same(&format!("{label} narrative"), &json!({ "active": state.active, "stepIndex": state.step_index, "completedScene": state.completed_scene, "lastEvent": state.last_event.as_deref().map(|e| e.split(':').next().unwrap()) }), &step["narrative"]);
        let pres = json!({ "auto": p.auto, "completed": p.completed, "completionStartedAtSec": p.completion_started_at, "lineId": p.line_id, "lineStartedAtSec": p.line_started_at, "pageIndex": p.page_index, "pageStartedAtSec": p.page_started_at,
            "forcedCompleteLineId": p.forced_complete.map(|f| f.0), "forcedCompletePageIndex": p.forced_complete.map(|f| f.1), "stageInitialized": p.stage_initialized,
            "shotTransitionLineId": p.shot_transition.map(|s| s.0), "shotTransitionStartedAtSec": p.shot_transition.map_or(0., |s| s.1), "shotTransitionMode": p.shot_transition.map(|s| s.2.js()), "playedAudioLineIds": p.played_audio, "hitZones": zones(&p.hit_zones) });
        assert_same(&format!("{label} presentation"), &pres, &step["presentation"]);
        if let Some(r) = &last_render {
            let render = if r.completed { json!({ "completed": true, "lineId": null }) } else {
                let line = r.line.unwrap(); let pg = r.page.as_ref().unwrap(); let tr = &r.transition;
                json!({ "lineId": line.id, "pageIndex": pg.index, "pageCount": pg.count, "speakerId": line.speaker.map(|s| s.id), "shotId": line.shot.id, "shotKind": line.shot.kind.js(), "itemId": line.item.map(|i| i.id),
                    "transitionMode": tr.mode.map(|m| m.js()), "transitionPhase": tr.phase, "backgroundAlpha": tr.background_alpha, "subjectAlpha": tr.subject_alpha, "dialogueAlpha": tr.dialogue_alpha, "coverAlpha": tr.cover_alpha, "actorsVisible": r.actors_visible, "completed": false })
            };
            assert_same(&format!("{label} render"), &render, &step["render"]);
        }
    }
}
