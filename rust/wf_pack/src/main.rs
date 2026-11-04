mod pack;

use image::{imageops::FilterType, RgbaImage};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    error::Error,
    fs,
    path::{Component, Path, PathBuf},
    time::Instant,
};

type Result<T> = std::result::Result<T, Box<dyn Error>>;
/// Wishfire puppet source -> wf_combat archetype art name. One form, one identity:
/// every archetype the live game can spawn owns exactly one source puppet.
pub const ACTORS: [(&str, &str); 14] = [
    ("fara", "Fara"),
    ("hondo", "Hondo"),
    ("runa", "Runa"),
    ("kaja", "Kaja"),
    ("gobloc", "Gobloc"),
    ("orc", "Orc"),
    ("highorc", "HighOrc"),
    ("marid", "Marid"),
    ("lizardo", "Lizardo"),
    ("troll", "Boss"),
    ("highgobloc", "WfmHighGobloc"),
    ("skeleton", "WfmSkeleton"),
    ("chimerilass", "WfmChimerilass"),
    ("djinn", "WfmDjinn"),
];
const STATES: [&str; 7] = ["idle", "walk", "basic", "cast", "hurt", "ko", "spawn"];
/// Chapter arenas, in region order; the client picks by the stage region.
const ARENAS: [&str; 4] = [
    "arenas/chapter-01-oasis-court.webp",
    "arenas/chapter-02-garden-ruins.webp",
    "arenas/chapter-03-caravan-court.webp",
    "arenas/chapter-04-moonlit-terrace.webp",
];

struct Args {
    src: PathBuf,
    out: PathBuf,
    scale: f64,
    page: u32,
}

impl Args {
    fn parse() -> Result<Option<Self>> {
        let mut args = Self {
            src: "../../web-runner/assets".into(),
            out: "../wf_app/gen".into(),
            scale: 1.0,
            page: 2048,
        };
        let mut input = std::env::args().skip(1);
        while let Some(key) = input.next() {
            if key == "--help" || key == "-h" {
                println!("wf_pack --src <web-runner/assets> --out <directory> [--frame-scale 1.0|0.5] [--page 2048]\nFrame scale applies to puppet canvases; arena max width stays 2048.");
                return Ok(None);
            }
            if !["--src", "--out", "--frame-scale", "--page"].contains(&key.as_str()) {
                return Err(format!("unknown argument: {key}").into());
            }
            let value = input
                .next()
                .ok_or_else(|| format!("missing value for {key}"))?;
            match key.as_str() {
                "--src" => args.src = value.into(),
                "--out" => args.out = value.into(),
                "--frame-scale" => args.scale = value.parse()?,
                "--page" => args.page = value.parse()?,
                _ => unreachable!(),
            }
        }
        if args.scale != 1.0 && args.scale != 0.5 {
            return Err("frame scale must be 1.0 or 0.5".into());
        }
        if !args.page.is_power_of_two() || !(8..=16384).contains(&args.page) {
            return Err("page must be a power of two from 8 to 16384".into());
        }
        args.src = fs::canonicalize(&args.src)?;
        args.out = resolved_output(&args.out)?;
        let repo = fs::canonicalize(Path::new(env!("CARGO_MANIFEST_DIR")).join("../.."))?;
        if !args.out.starts_with(&repo) || args.out == repo {
            return Err("output must be a subdirectory of this repository".into());
        }
        if args.src.starts_with(&args.out) || args.out.starts_with(&args.src) {
            return Err("source and output directories must not overlap".into());
        }
        Ok(Some(args))
    }
}

// Resolve existing symlinks before checking the output boundary, without creating anything.
fn resolved_output(path: &Path) -> Result<PathBuf> {
    if path.exists() {
        return Ok(fs::canonicalize(path)?);
    }
    let name = path
        .file_name()
        .ok_or("output path needs a directory name")?;
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    Ok(resolved_output(parent)?.join(name))
}

#[derive(Deserialize)]
struct PuppetManifest {
    actors: BTreeMap<String, SourceActor>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SourceActor {
    source_facing: String,
    clips: BTreeMap<String, BTreeMap<String, SourceClip>>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SourceClip {
    frames: Vec<String>,
    frame_hold_ms: Vec<f64>,
    r#loop: bool,
    canvas: Canvas,
    foot_origin: Point,
    impact_time_ms: Option<f64>,
    release_time_ms: Option<f64>,
}
#[derive(Deserialize)]
struct Canvas {
    width: u32,
    height: u32,
}
#[derive(Deserialize)]
struct Point {
    x: f64,
    y: f64,
}
#[derive(Serialize)]
struct Assets {
    pages: Vec<Page>,
    actors: BTreeMap<String, Actor>,
    arenas: Vec<Arena>,
}
#[derive(Serialize)]
struct Page {
    file: String,
    w: u32,
    h: u32,
}
#[derive(Clone, Serialize)]
struct Actor {
    source_actor: String,
    facing: String,
    clips: BTreeMap<String, Clip>,
}
#[derive(Clone, Serialize)]
struct Clip {
    frames: Vec<Frame>,
    r#loop: bool,
    foot_origin: [f64; 2],
    canvas: [u32; 2],
    #[serde(skip_serializing_if = "Option::is_none")]
    impact_ms: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    release_ms: Option<f64>,
}
#[derive(Clone, Serialize)]
struct Frame {
    page: usize,
    x: u32,
    y: u32,
    w: u32,
    h: u32,
    offset_x: u32,
    offset_y: u32,
    hold_ms: f64,
}
#[derive(Serialize)]
struct Arena {
    region: u32,
    file: String,
    w: u32,
    h: u32,
}

#[derive(Clone, Default, Serialize)]
struct FrameReport {
    frames: usize,
    decoded_bytes: u64,
    source_decoded_bytes: u64,
}
#[derive(Serialize)]
struct Report {
    frame_scale: f64,
    page_limit: u32,
    actors: BTreeMap<String, FrameReport>,
    page_count: usize,
    pages_decoded_rgba_bytes: u64,
    atlas_png_bytes: u64,
    arena_decoded_rgba_bytes: u64,
    arena_png_bytes: u64,
    total_texture_decoded_rgba_bytes: u64,
    build_ms: f64,
}

fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T> {
    serde_json::from_slice(&fs::read(path)?).map_err(|e| format!("{}: {e}", path.display()).into())
}

fn source_image(root: &Path, relative: &str) -> Result<RgbaImage> {
    let rel = Path::new(relative);
    if rel.is_absolute() || rel.components().any(|c| !matches!(c, Component::Normal(_))) {
        return Err(format!("invalid manifest image path: {relative}").into());
    }
    let path = root.join(rel);
    image::open(&path)
        .map(|i| i.to_rgba8())
        .map_err(|e| format!("{}: {e}", path.display()).into())
}

fn validate_timing(frames: &[String], holds: &[f64], label: &str) -> Result<()> {
    if frames.is_empty()
        || frames.len() != holds.len()
        || holds.iter().any(|h| !h.is_finite() || *h <= 0.0)
    {
        return Err(
            format!("{label}: nonempty frames need matching positive finite frame holds").into(),
        );
    }
    Ok(())
}

fn add_frame(
    image: RgbaImage,
    expected: [u32; 2],
    target: [u32; 2],
    hold_ms: f64,
    sprites: &mut Vec<RgbaImage>,
    report: &mut FrameReport,
) -> Result<Frame> {
    if image.dimensions() != (expected[0], expected[1]) {
        return Err(format!(
            "frame dimensions {:?} differ from manifest {expected:?}",
            image.dimensions()
        )
        .into());
    }
    report.source_decoded_bytes += image.width() as u64 * image.height() as u64 * 4;
    let resized = if expected == target {
        image
    } else {
        image::imageops::resize(&image, target[0], target[1], FilterType::Lanczos3)
    };
    let (trimmed, [offset_x, offset_y]) = pack::trim(&resized);
    let (w, h) = trimmed.dimensions();
    report.frames += 1;
    report.decoded_bytes += w as u64 * h as u64 * 4;
    // Temporary sprite index; replaced by atlas page/x/y after the single pack pass.
    let frame = Frame {
        page: sprites.len(),
        x: 0,
        y: 0,
        w,
        h,
        offset_x,
        offset_y,
        hold_ms,
    };
    sprites.push(trimmed);
    Ok(frame)
}

fn load_actors(
    src: &Path,
    scale: f64,
    sprites: &mut Vec<RgbaImage>,
) -> Result<(BTreeMap<String, Actor>, BTreeMap<String, FrameReport>)> {
    let root = &src.join("puppets");
    let manifest: PuppetManifest = read_json(&root.join("manifest.json"))?;
    let mut actors = BTreeMap::new();
    let mut reports = BTreeMap::new();
    for (source, archetype) in ACTORS {
        let a = manifest.actors.get(source).ok_or_else(|| format!("missing actor {source}"))?;
        if !["left", "right"].contains(&a.source_facing.as_str()) {
            return Err(format!("invalid facing on {source}").into());
        }
        let mut actor = Actor {
            source_actor: source.into(),
            facing: a.source_facing.clone(),
            clips: BTreeMap::new(),
        };
        let mut report = FrameReport::default();
        for state in STATES {
            let label = format!("{source}/{state}/{}", a.source_facing);
            let c = a
                .clips
                .get(state)
                .and_then(|faces| faces.get(&a.source_facing))
                .ok_or_else(|| format!("missing clip {label}"))?;
            validate_timing(&c.frames, &c.frame_hold_ms, &label)?;
            let duration: f64 = c.frame_hold_ms.iter().sum();
            if (state == "basic" && c.impact_time_ms.is_none())
                || (state == "cast" && c.release_time_ms.is_none())
            {
                return Err(format!("{label}: required timing marker missing").into());
            }
            if c.impact_time_ms
                .iter()
                .chain(&c.release_time_ms)
                .any(|m| !m.is_finite() || *m < 0.0 || *m > duration)
            {
                return Err(format!("{label}: timing marker outside clip duration").into());
            }
            let canvas = [
                (c.canvas.width as f64 * scale).round() as u32,
                (c.canvas.height as f64 * scale).round() as u32,
            ];
            if canvas.contains(&0) || !c.foot_origin.x.is_finite() || !c.foot_origin.y.is_finite() {
                return Err(format!("{label}: invalid canvas or foot origin").into());
            }
            let mut clip = Clip {
                frames: Vec::new(),
                r#loop: c.r#loop,
                canvas,
                foot_origin: [
                    c.foot_origin.x * canvas[0] as f64 / c.canvas.width as f64,
                    c.foot_origin.y * canvas[1] as f64 / c.canvas.height as f64,
                ],
                impact_ms: c.impact_time_ms,
                release_ms: c.release_time_ms,
            };
            for (file, &hold) in c.frames.iter().zip(&c.frame_hold_ms) {
                clip.frames.push(
                    add_frame(
                        source_image(root, file)?,
                        [c.canvas.width, c.canvas.height],
                        canvas,
                        hold,
                        sprites,
                        &mut report,
                    )
                    .map_err(|e| format!("{label}/{file}: {e}"))?,
                );
            }
            actor.clips.insert(state.into(), clip);
        }
        actors.insert(archetype.into(), actor);
        reports.insert(archetype.into(), report);
    }
    Ok((actors, reports))
}

#[cfg(test)]
mod actor_tests {
    use super::*;

    #[test]
    fn every_archetype_resolves_to_its_own_source_puppet() {
        let src = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../web-runner/assets");
        let (actors, _) = load_actors(&src, 1.0, &mut Vec::new()).unwrap();
        assert_eq!(actors.len(), 14);
        let mut owners = BTreeMap::new();
        for (name, actor) in &actors {
            assert!(owners.insert(&actor.source_actor, name).is_none(),
                "{name} reuses source puppet {}", actor.source_actor);
        }
        for (source, name) in ACTORS {
            assert_eq!(actors[name].source_actor, source);
            for state in STATES {
                assert!(!actors[name].clips[state].frames.is_empty(), "{name}/{state}");
            }
        }
    }
}

fn write_json(path: &Path, value: &impl Serialize) -> Result<()> {
    let mut bytes = serde_json::to_vec_pretty(value)?;
    bytes.push(b'\n');
    fs::write(path, bytes)?;
    Ok(())
}

fn run(args: Args) -> Result<()> {
    let start = Instant::now();
    let mut sprites = Vec::new();
    let (mut actors, actor_reports) = load_actors(&args.src, args.scale, &mut sprites)?;
    let sizes: Vec<_> = sprites.iter().map(|s| s.dimensions()).collect();
    let (placements, dimensions) = pack::pack(&sizes, args.page)?;
    for frames in actors
        .values_mut()
        .flat_map(|a| a.clips.values_mut().map(|c| &mut c.frames))
    {
        for f in frames {
            let at = placements[f.page];
            f.page = at.page;
            f.x = at.x;
            f.y = at.y;
        }
    }
    let mut arena_images = Vec::new();
    for (index, relative) in ARENAS.iter().enumerate() {
        let mut image = source_image(&args.src, relative)?;
        if image.width() > 2048 {
            let height = (image.height() as f64 * 2048.0 / image.width() as f64).round().max(1.0) as u32;
            image = image::imageops::resize(&image, 2048, height, FilterType::Lanczos3);
        }
        let region = index as u32 + 1;
        arena_images.push((Arena { region, file: format!("arena-{region:02}.png"), w: image.width(), h: image.height() }, image));
    }
    // All source loading and packing succeeds before touching the output directory.
    fs::create_dir_all(&args.out)?;
    let mut pages = Vec::new();
    let mut atlas_png_bytes = 0;
    for (index, &(w, h)) in dimensions.iter().enumerate() {
        let mut image = RgbaImage::new(w, h);
        for (sprite, &at) in sprites.iter().zip(&placements) {
            if at.page == index {
                pack::extrude(&mut image, sprite, at);
            }
        }
        let file = format!("atlas-{index:03}.png");
        let path = args.out.join(&file);
        image.save(&path)?;
        atlas_png_bytes += fs::metadata(path)?.len();
        pages.push(Page { file, w, h });
    }
    let mut arena_png_bytes = 0;
    let mut arena_decoded_rgba_bytes = 0;
    let mut arenas = Vec::new();
    for (arena, image) in arena_images {
        image.save(args.out.join(&arena.file))?;
        arena_png_bytes += fs::metadata(args.out.join(&arena.file))?.len();
        arena_decoded_rgba_bytes += arena.w as u64 * arena.h as u64 * 4;
        arenas.push(arena);
    }
    let pages_decoded_rgba_bytes = pages
        .iter()
        .map(|p| p.w as u64 * p.h as u64 * 4)
        .sum::<u64>();
    let assets = Assets { pages, actors, arenas };
    write_json(&args.out.join("assets.json"), &assets)?;
    let report = Report {
        frame_scale: args.scale,
        page_limit: args.page,
        actors: actor_reports,
        page_count: assets.pages.len(),
        pages_decoded_rgba_bytes,
        atlas_png_bytes,
        arena_decoded_rgba_bytes,
        arena_png_bytes,
        total_texture_decoded_rgba_bytes: pages_decoded_rgba_bytes + arena_decoded_rgba_bytes,
        build_ms: start.elapsed().as_secs_f64() * 1000.0,
    };
    write_json(&args.out.join("report.json"), &report)?;
    println!("scale={} pages={} atlas={} bytes ({:.3} MiB) arenas={} bytes total={} bytes build={:.1}ms",
        args.scale, report.page_count, report.pages_decoded_rgba_bytes, report.pages_decoded_rgba_bytes as f64 / 1048576.0,
        report.arena_decoded_rgba_bytes, report.total_texture_decoded_rgba_bytes, report.build_ms);
    for (name, a) in &report.actors {
        println!(
            "  {name}: {} frames, {} decoded bytes (trimmed)",
            a.frames, a.decoded_bytes
        );
    }
    println!(
        "PNG: atlas={} bytes arena={} bytes; report={}",
        report.atlas_png_bytes,
        report.arena_png_bytes,
        args.out.join("report.json").display()
    );
    Ok(())
}

fn main() {
    let result = Args::parse().and_then(|args| match args {
        Some(a) => run(a),
        None => Ok(()),
    });
    if let Err(error) = result {
        eprintln!("wf_pack: {error}");
        std::process::exit(1);
    }
}
