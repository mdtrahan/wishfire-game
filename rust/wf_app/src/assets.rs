use macroquad::prelude::*;
/// Shared dark emerald for Kaja poison. Arcane effects keep their violet palette.
pub const POISON: Color = Color::new(0.12, 0.72, 0.43, 1.);
fn vfx_tint(id: &str, tint: Color) -> Color {
    if matches!(id, "hit-poison" | "crit-poison") { Color { a: tint.a, ..POISON } } else { tint }
}
fn orb_source(id: &str) -> &str {
    match id {
        "orb-head-marid" => "orb-head",
        "orb-trail-marid" => "orb-trail",
        _ => id,
    }
}
use nanoserde::DeJson;
use std::collections::BTreeMap;

#[derive(DeJson, Debug)]
pub struct Frame {
    pub page: usize,
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
    pub offset_x: f32,
    pub offset_y: f32,
    pub hold_ms: f32,
}
#[derive(DeJson, Debug)]
pub struct Clip {
    pub frames: Vec<Frame>,
    #[nserde(rename = "loop")]
    pub looping: bool,
    pub foot_origin: [f32; 2],
    pub impact_ms: Option<f32>,
    pub release_ms: Option<f32>,
}
#[derive(DeJson, Debug)]
pub struct ActorArt {
    pub facing: String,
    pub clips: BTreeMap<String, Clip>,
}
#[derive(DeJson)]
pub struct Page {
    pub file: String,
    pub w: u32,
    pub h: u32,
}
#[derive(DeJson)]
pub struct Arena {
    pub region: u32,
    pub file: String,
    pub w: u32,
    pub h: u32,
}
#[derive(DeJson)]
pub struct Manifest {
    pub pages: Vec<Page>,
    pub actors: BTreeMap<String, ActorArt>,
    pub arenas: Vec<Arena>,
}
/// Chrome art staged by tools/build_wf_app.sh from web-runner/assets/images.
pub const UI_ART: &[&str] = &["nav-daily", "nav-hero", "nav-quests", "nav-vault", "nav-power-up", "boss-boss", "boss-clock", "boss-inspect", "hero-Fara", "hero-Hondo", "hero-Runa", "hero-Kaja", "buff-signals", "lamp-gear-atlas", "lamp-bag", "lamp-essence", "bag-medallion", "prog-incense", "prog-stat-atk", "prog-stat-def", "prog-stat-matk", "prog-stat-res", "prog-hero-tickets", "prog-training-scene", "coin"];
/// Archetypes the live game can spawn; each owns one packed puppet (wf_pack::ACTORS).
const ACTOR_ART:&[&str]=&["Fara","Hondo","Runa","Kaja","Gobloc","Orc","Lizardo","Boss","HighOrc","Marid",
    "WfmHighGobloc","WfmSkeleton","WfmChimerilass","WfmDjinn"];
/// Runtime art fetches carry the art content revision (build.rs) so browsers never reuse a stale
/// file; these shadow macroquad's loaders for every load in this module.
fn art_url(path:&str)->String {
    if cfg!(target_arch="wasm32") && !path.contains('?') {format!("{path}?v={}",env!("WF_ART_REV"))} else {path.into()}
}
async fn load_texture(path:&str)->Result<Texture2D,macroquad::Error> {
    macroquad::texture::load_texture(&art_url(path)).await
}
async fn load_image(path:&str)->Result<Image,macroquad::Error> {
    macroquad::texture::load_image(&art_url(path)).await
}
async fn load_string(path:&str)->Result<String,macroquad::Error> {
    macroquad::file::load_string(&art_url(path)).await
}
fn packed_url(path:&str)->String {
    if cfg!(target_arch="wasm32") {format!("{path}?v={}",env!("WF_PACKED_ART_REV"))}else{path.into()}
}
fn manifest_fingerprint(json:&str)->String {
    let mut hash=0xcbf29ce484222325u64;
    for byte in json.bytes() {hash=(hash^byte as u64).wrapping_mul(0x100000001b3);}
    format!("{hash:016x}")
}
fn validate_manifest(manifest:&Manifest)->Result<(),String> {
    if manifest.pages.is_empty() {return Err("assets.json has no atlas pages".into());}
    for name in ACTOR_ART {
        let art=manifest.actors.get(*name).ok_or_else(||format!("Packed assets missing actor {name}; rebuild wf_assets and web"))?;
        if !matches!(art.facing.as_str(),"left"|"right") {return Err(format!("Invalid facing: {name}"));}
        for state in ["idle","walk","basic","cast","hurt","ko","spawn"] {
            let clip=art.clips.get(state).filter(|c|!c.frames.is_empty()).ok_or_else(||format!("Packed assets missing {name}/{state}"))?;
            for f in &clip.frames {
                let page=manifest.pages.get(f.page).ok_or_else(||format!("Unloaded atlas page {}: {name}/{state}",f.page))?;
                if ![f.x,f.y,f.w,f.h,f.offset_x,f.offset_y,f.hold_ms].iter().all(|n|n.is_finite())
                    || f.x<0. || f.y<0. || f.w<=0. || f.h<=0. || f.hold_ms<=0.
                    || f.x+f.w>page.w as f32 || f.y+f.h>page.h as f32 {
                    return Err(format!("Invalid atlas frame: {name}/{state}"));
                }
            }
        }
    }
    Ok(())
}
#[derive(DeJson, Debug)]
pub struct VfxEntry {
    pub id: String,
    pub file: Option<String>,
    pub frame_size: [f32; 2],
    pub frame_count: usize,
    pub frame_ms: Vec<f32>,
    pub pivot: [f32; 2],
    pub blend: String,
    pub screen_size_px: [f32; 2],
}
/// `web-runner/assets/rust-combat/manifest.json`: one effect per id, files relative to that bundle.
#[derive(DeJson)]
struct BundleEntry {
    file: String,
    frame_size: [f32; 2],
    frame_count: usize,
    frame_ms: Vec<f32>,
    pivot: [f32; 2],
    blend: String,
    screen_size_px: [f32; 2],
}
#[derive(DeJson)]
struct BundleManifest {
    font: String,
    effects: std::collections::HashMap<String, BundleEntry>,
}
pub struct VfxTexture {
    pub entry: VfxEntry,
    pub texture: Texture2D,
    /// Occupied alpha bounds of the first cell, in source pixels.
    pub bounds: Rect,
}
impl VfxTexture {
    pub fn cell(&self, index: usize) -> (&Texture2D, Rect) {
        let index=index.min(self.entry.frame_count-1);
        (&self.texture,Rect::new(index as f32*self.entry.frame_size[0],0.,self.entry.frame_size[0],self.entry.frame_size[1]))
    }
    pub fn sample(&self, age: f64) -> Option<(usize, f32)> {
        if age < 0. {
            return None;
        }
        if self.entry.frame_count == 1 {
            return Some((0, 1.));
        }
        let mut ms = age as f32 * 1000.;
        for (i, hold) in self.entry.frame_ms.iter().enumerate() {
            if ms < *hold {
                return Some((
                    i,
                    if i + 1 == self.entry.frame_count {
                        1. - ms / hold
                    } else {
                        1.
                    },
                ));
            }
            ms -= hold;
        }
        None
    }
}
pub struct Assets {
    pub manifest: Manifest,
    pub pages: Vec<Texture2D>,
    /// Chapter arenas by region order (`manifest.arenas`); `arena` is the active one.
    pub arenas: Vec<Texture2D>,
    pub arena: Texture2D,
    pub decals: BTreeMap<String, Texture2D>,
    /// Chrome images (`art/ui/*.png`): nav icons, boss HUD icons, hero portraits, the buff sheet.
    pub ui: BTreeMap<String, Texture2D>,
    pub pivots: BTreeMap<String, [f32; 2]>,
    pub vfx: BTreeMap<String, VfxTexture>,
    pub vfx_bytes: u64,
    pub load_ms: f64,
    pub additive: Material,
    bubble_alpha: Material,
    charge_tint: Material,
    pub cast_hue: Material,
    orb_hue: Material,
    /// Wishfire's Bungee damage-number face and its vertical two-stop gradient fill.
    pub label_font: Font,
    pub label_gradient: Material,
}
#[derive(Default)]
pub struct DrawStats {
    pub placeholders: u32,
    pub missing_assets: Vec<String>,
    pub calls: u32,
    pub fx_quads: u32,
}
impl DrawStats {
    pub fn missing(&mut self,id:impl Into<String>) {self.placeholders+=1;self.missing_assets.push(id.into());}
}
impl Assets {
    pub async fn load() -> Result<Self, String> {
        let start = get_time();
        let json = load_string(&packed_url("gen/assets.json"))
            .await
            .map_err(|e| format!("assets.json: {e}"))?;
        if manifest_fingerprint(&json)!=env!("WF_PACKED_MANIFEST_HASH") {
            return Err("Packed assets do not match this client; run tools/build_wf_app.sh".into());
        }
        let manifest=Manifest::deserialize_json(&json).map_err(|e|format!("assets.json: {e}"))?;
        validate_manifest(&manifest)?;
        let mut pages = Vec::new();
        for page in &manifest.pages {
            let texture = load_texture(&packed_url(&format!("gen/{}", page.file)))
                .await
                .map_err(|e| e.to_string())?;
            if texture.width()!=page.w as f32 || texture.height()!=page.h as f32 {
                return Err(format!("Atlas size mismatch: {}",page.file));
            }
            texture.set_filter(FilterMode::Linear);
            pages.push(texture);
        }
        let mut arenas = Vec::new();
        for arena in &manifest.arenas {
            let texture = load_texture(&packed_url(&format!("gen/{}", arena.file)))
                .await
                .map_err(|e| format!("{}: {e}", arena.file))?;
            texture.set_filter(FilterMode::Linear);
            arenas.push(texture);
        }
        let Some(arena) = arenas.first().cloned() else { return Err("assets.json has no arenas".into()) };
        let mut ui = BTreeMap::new();
        for name in UI_ART {
            let texture = load_texture(&format!("art/ui/{name}.png")).await.map_err(|e| format!("art/ui/{name}.png: {e}"))?;
            texture.set_filter(FilterMode::Linear);
            ui.insert(name.to_string(), texture);
        }
        let bundle_json = load_string("art/manifest.json")
            .await
            .map_err(|e| format!("art/manifest.json: {e}"))?;
        let bundle = BundleManifest::deserialize_json(&bundle_json)
            .map_err(|e| format!("art/manifest.json: {e}"))?;
        let font_bytes = macroquad::file::load_file(&art_url(&format!("art/{}", bundle.font)))
            .await
            .map_err(|e| format!("label font: {e}"))?;
        let mut entries: Vec<(String, VfxEntry)> = bundle
            .effects
            .into_iter()
            .map(|(id, raw)| ("art".to_string(), VfxEntry {
                id,
                file: Some(raw.file),
                frame_size: raw.frame_size,
                frame_count: raw.frame_count,
                frame_ms: raw.frame_ms,
                pivot: raw.pivot,
                // Straight alpha unless the bundle marks the sheet additive.
                blend: if raw.blend == "additive" { "additive".into() } else { "alpha".into() },
                screen_size_px: raw.screen_size_px,
            }))
            .collect();
        entries.sort_by(|a, b| a.1.id.cmp(&b.1.id));
        // Explicit registration validates the source dimensions of the purple impact.
        entries.push(("art".into(), arcane_pulse_art()));
        // Poll independent image requests together; sequential loads cost a browser frame each.
        let mut paths = std::collections::BTreeSet::new();
        for (root, entry) in &entries {
            let file = entry.file.as_ref().unwrap();
            if !file.ends_with(".png")
                || file.starts_with('/')
                || file.contains('\\')
                || file.split('/').any(|p| p == ".." || p.is_empty())
            {
                return Err(format!("invalid VFX path {file}"));
            }
            paths.insert(format!("{root}/{file}"));
        }
        let paths: Vec<_> = paths.into_iter().collect();
        let mut requests: Vec<_> = paths
            .iter()
            .map(|path| Box::pin(load_image(path)))
            .collect();
        let mut results: Vec<_> = (0..requests.len()).map(|_| None).collect();
        // Four requests fit the static server's connection queue and the browser's
        // per-origin connection limit, while avoiding one full frame per texture.
        for (batch, requests) in requests.chunks_mut(4).enumerate() {
            std::future::poll_fn(|cx| {
                use std::{future::Future, task::Poll};
                for (j, request) in requests.iter_mut().enumerate() {
                    let i = batch * 4 + j;
                    if results[i].is_none() {
                        if let Poll::Ready(result) = request.as_mut().poll(cx) {
                            results[i] = Some(result);
                        }
                    }
                }
                if results[batch * 4..batch * 4 + requests.len()]
                    .iter()
                    .all(Option::is_some)
                {
                    Poll::Ready(())
                } else {
                    Poll::Pending
                }
            })
            .await;
        }
        let mut textures = BTreeMap::new();
        let mut vfx_bytes = 0;
        for (path, result) in paths.iter().zip(results) {
            let image = result.unwrap().map_err(|e| format!("{path}: {e}"))?;
            vfx_bytes += image.width as u64 * image.height as u64 * 4;
            let texture=Texture2D::from_image(&image);texture.set_filter(FilterMode::Linear);
            textures.insert(path,texture);
        }
        let mut vfx = BTreeMap::new();
        for (root, entry) in entries {
            let path = format!("{root}/{}", entry.file.as_ref().unwrap());
            let texture = textures[&path].clone();
            if texture.width() != entry.frame_size[0] * entry.frame_count as f32
                || texture.height() != entry.frame_size[1]
            {
                return Err(format!("VFX sheet dimensions: {}", entry.id));
            }
            let mut bounds =
                Rect::new(0.5, 0.5, entry.frame_size[0] - 1., entry.frame_size[1] - 1.);
            if matches!(
                entry.id.as_str(),
                "telegraph-edge"
                    | "telegraph-fill"
                    | "orb-trail"
                    | "orb-trail-kaja"
                    | "bolt-trail"
                    | "sniper-beam-neutral"
            ) {
                let data = texture.get_texture_data();
                let (mut x0, mut y0, mut x1, mut y1) = (
                    entry.frame_size[0] as usize,
                    entry.frame_size[1] as usize,
                    0usize,
                    0usize,
                );
                for y in 0..entry.frame_size[1] as usize {
                    for x in 0..entry.frame_size[0] as usize {
                        if data.bytes[(y * data.width as usize + x) * 4 + 3] > 12 {
                            x0 = x0.min(x);
                            y0 = y0.min(y);
                            x1 = x1.max(x);
                            y1 = y1.max(y);
                        }
                    }
                }
                if entry.id == "telegraph-edge" {
                    // The sheet contains two separate strokes. Extract the long lower stroke,
                    // rather than including the empty gap between both occupied bands.
                    let width = entry.frame_size[0] as usize;
                    let height = entry.frame_size[1] as usize;
                    let rows: Vec<usize> = (0..height)
                        .map(|y| {
                            (0..width)
                                .filter(|x| data.bytes[(y * data.width as usize + x) * 4 + 3] > 12)
                                .count()
                        })
                        .collect();
                    if let Some((peak, count)) = rows.iter().enumerate().max_by_key(|(_, n)| **n) {
                        let threshold = (*count / 4).max(1);
                        y0 = peak;
                        y1 = peak;
                        while y0 > 0 && rows[y0 - 1] >= threshold {
                            y0 -= 1;
                        }
                        while y1 + 1 < height && rows[y1 + 1] >= threshold {
                            y1 += 1;
                        }
                    }
                }
                if x1 >= x0 && y1 >= y0 {
                    bounds = Rect::new(
                        x0 as f32 + 0.5,
                        y0 as f32 + 0.5,
                        (x1 - x0) as f32,
                        (y1 - y0) as f32,
                    );
                }
            }
            vfx.insert(
                entry.id.clone(),
                VfxTexture {
                    entry,
                    texture,
                    bounds,
                },
            );
        }
        // Decals are whole single-cell sheets drawn by name; their pivots come from the bundle.
        let mut decals = BTreeMap::new();
        let mut pivots = BTreeMap::new();
        for (id, art) in &vfx {
            let kit = matches!(id.as_str(), "bomb" | "bolt" | "flash" | "warn" | "wave_band" | "shadow" | "sword" | "wings" | "winged_boots");
            if kit || id.starts_with("resurrect/") || matches!(id.as_str(), "chest-closed" | "chest-open") {
                decals.insert(id.clone(), art.texture.clone());
                if kit || id.starts_with("chest-") { pivots.insert(id.clone(), art.entry.pivot); }
            }
        }
        let additive = load_material(
            ShaderSource::Glsl {
                vertex: "#version 100\nattribute vec3 position; attribute vec2 texcoord; attribute vec4 color0; varying lowp vec2 uv; varying lowp vec4 color; uniform mat4 Model; uniform mat4 Projection; void main() { gl_Position = Projection * Model * vec4(position, 1.0); uv = texcoord; color = color0 / 255.0; }",
                fragment: "#version 100\nprecision lowp float; varying vec2 uv; varying vec4 color; uniform sampler2D Texture; void main() { gl_FragColor = texture2D(Texture, uv) * color; }",
            },
            MaterialParams {
                pipeline_params: macroquad::miniquad::PipelineParams {
                    color_blend: Some(macroquad::miniquad::BlendState::new(
                        macroquad::miniquad::Equation::Add,
                        macroquad::miniquad::BlendFactor::Value(macroquad::miniquad::BlendValue::SourceAlpha),
                        macroquad::miniquad::BlendFactor::One,
                    )),
                    ..Default::default()
                },
                ..Default::default()
            },
        ).map_err(|e| format!("impact shader: {e}"))?;
        let bubble_alpha = load_material(
            ShaderSource::Glsl {
                vertex: "#version 100\nattribute vec3 position; attribute vec2 texcoord; attribute vec4 color0; varying lowp vec2 uv; varying lowp vec4 color; uniform mat4 Model; uniform mat4 Projection; void main() { gl_Position = Projection * Model * vec4(position, 1.0); uv = texcoord; color = color0 / 255.0; }",
                fragment: "#version 100\nprecision lowp float; varying vec2 uv; varying vec4 color; uniform sampler2D Texture; void main() { gl_FragColor = texture2D(Texture, uv) * color; }",
            },
            MaterialParams {
                pipeline_params: macroquad::miniquad::PipelineParams {
                    color_blend: Some(macroquad::miniquad::BlendState::new(
                        macroquad::miniquad::Equation::Add,
                        macroquad::miniquad::BlendFactor::Value(macroquad::miniquad::BlendValue::SourceAlpha),
                        macroquad::miniquad::BlendFactor::OneMinusValue(macroquad::miniquad::BlendValue::SourceAlpha),
                    )),
                    // Keep the opaque arena opaque in the browser canvas compositor.
                    alpha_blend: Some(macroquad::miniquad::BlendState::new(
                        macroquad::miniquad::Equation::Add,
                        macroquad::miniquad::BlendFactor::One,
                        macroquad::miniquad::BlendFactor::OneMinusValue(macroquad::miniquad::BlendValue::SourceAlpha),
                    )),
                    ..Default::default()
                },
                ..Default::default()
            },
        ).map_err(|e| format!("bubble alpha shader: {e}"))?;
        let cast_hue = load_material(
            ShaderSource::Glsl {
                vertex: "#version 100\nattribute vec3 position; attribute vec2 texcoord; attribute vec4 color0; varying lowp vec2 uv; varying lowp vec4 color; uniform mat4 Model; uniform mat4 Projection; void main() { gl_Position = Projection * Model * vec4(position, 1.0); uv = texcoord; color = color0 / 255.0; }",
                fragment: crate::render::cast_hue::FRAGMENT,
            },
            MaterialParams {
                pipeline_params: macroquad::miniquad::PipelineParams {
                    color_blend: Some(macroquad::miniquad::BlendState::new(
                        macroquad::miniquad::Equation::Add,
                        macroquad::miniquad::BlendFactor::Value(macroquad::miniquad::BlendValue::SourceAlpha),
                        macroquad::miniquad::BlendFactor::OneMinusValue(macroquad::miniquad::BlendValue::SourceAlpha),
                    )),
                    // Keep the opaque arena opaque in the browser canvas compositor.
                    alpha_blend: Some(macroquad::miniquad::BlendState::new(
                        macroquad::miniquad::Equation::Add,
                        macroquad::miniquad::BlendFactor::One,
                        macroquad::miniquad::BlendFactor::OneMinusValue(macroquad::miniquad::BlendValue::SourceAlpha),
                    )),
                    ..Default::default()
                },
                uniforms: vec![UniformDesc::new("HueStrength", UniformType::Float4)],
                ..Default::default()
            },
        ).map_err(|e| format!("cast hue shader: {e}"))?;
        let orb_hue = load_material(
            ShaderSource::Glsl {
                vertex: "#version 100\nattribute vec3 position; attribute vec2 texcoord; attribute vec4 color0; varying lowp vec2 uv; varying lowp vec4 color; uniform mat4 Model; uniform mat4 Projection; void main() { gl_Position = Projection * Model * vec4(position, 1.0); uv = texcoord; color = color0 / 255.0; }",
                fragment: crate::render::projectiles::ORB_HUE_FRAGMENT,
            },
            MaterialParams {
                pipeline_params: macroquad::miniquad::PipelineParams {
                    color_blend: Some(macroquad::miniquad::BlendState::new(
                        macroquad::miniquad::Equation::Add,
                        macroquad::miniquad::BlendFactor::Value(macroquad::miniquad::BlendValue::SourceAlpha),
                        macroquad::miniquad::BlendFactor::OneMinusValue(macroquad::miniquad::BlendValue::SourceAlpha),
                    )),
                    ..Default::default()
                },
                uniforms: vec![UniformDesc::new("HueTurns", UniformType::Float1)],
                ..Default::default()
            },
        ).map_err(|e| format!("orb hue shader: {e}"))?;
        orb_hue.set_uniform("HueTurns", crate::render::projectiles::MARID_HUE_TURNS);
        // Preserve luminous white cores while colouring the softer charge artwork.
        let charge_tint = load_material(
            ShaderSource::Glsl {
                vertex: "#version 100\nattribute vec3 position; attribute vec2 texcoord; attribute vec4 color0; varying lowp vec2 uv; varying lowp vec4 color; uniform mat4 Model; uniform mat4 Projection; void main() { gl_Position = Projection * Model * vec4(position, 1.0); uv = texcoord; color = color0 / 255.0; }",
                fragment: "#version 100\nprecision mediump float; varying vec2 uv; varying vec4 color; uniform sampler2D Texture; void main() { vec4 tex = texture2D(Texture, uv); float L = dot(tex.rgb, vec3(0.2126, 0.7152, 0.0722)); float h = smoothstep(0.82, 0.98, L); gl_FragColor = vec4(L * mix(color.rgb, vec3(1.0), h), tex.a * color.a); }",
            },
            MaterialParams {
                pipeline_params: macroquad::miniquad::PipelineParams {
                    color_blend: Some(macroquad::miniquad::BlendState::new(
                        macroquad::miniquad::Equation::Add,
                        macroquad::miniquad::BlendFactor::Value(macroquad::miniquad::BlendValue::SourceAlpha),
                        macroquad::miniquad::BlendFactor::One,
                    )),
                    ..Default::default()
                },
                ..Default::default()
            },
        ).map_err(|e| format!("charge tint shader: {e}"))?;
        let label_font = load_ttf_font_from_bytes(&font_bytes)
            .map_err(|e| format!("label font: {e}"))?;
        let label_gradient = load_material(
            ShaderSource::Glsl {
                vertex: "#version 100\nattribute vec3 position; attribute vec2 texcoord; attribute vec4 color0; varying lowp vec2 uv; varying lowp vec4 color; varying highp float wy; uniform mat4 Model; uniform mat4 Projection; void main() { gl_Position = Projection * Model * vec4(position, 1.0); uv = texcoord; color = color0 / 255.0; wy = position.y; }",
                fragment: "#version 100\nprecision mediump float; varying vec2 uv; varying vec4 color; varying highp float wy; uniform sampler2D Texture; uniform vec4 Top; uniform vec4 Bottom; uniform vec2 Span; void main() { float t = clamp((wy - Span.x) / max(Span.y - Span.x, 0.001), 0.0, 1.0); gl_FragColor = vec4(mix(Top.rgb, Bottom.rgb, t), texture2D(Texture, uv).a * color.a); }",
            },
            MaterialParams {
                uniforms: vec![
                    UniformDesc::new("Top", UniformType::Float4),
                    UniformDesc::new("Bottom", UniformType::Float4),
                    UniformDesc::new("Span", UniformType::Float2),
                ],
                pipeline_params: macroquad::miniquad::PipelineParams {
                    color_blend: Some(macroquad::miniquad::BlendState::new(
                        macroquad::miniquad::Equation::Add,
                        macroquad::miniquad::BlendFactor::Value(macroquad::miniquad::BlendValue::SourceAlpha),
                        macroquad::miniquad::BlendFactor::OneMinusValue(macroquad::miniquad::BlendValue::SourceAlpha),
                    )),
                    ..Default::default()
                },
                ..Default::default()
            },
        ).map_err(|e| format!("label gradient shader: {e}"))?;
        Ok(Self {
            label_font,
            label_gradient,
            charge_tint,
            cast_hue,
            orb_hue,
            additive,
            bubble_alpha,
            vfx,
            vfx_bytes,
            manifest,
            pages,
            arenas,
            arena,
            decals,
            ui,
            pivots,
            load_ms: (get_time() - start) * 1000.,
        })
    }
    /// Draw one authored cell about its frame-local pivot. All sizes are logical pixels.
    #[allow(clippy::too_many_arguments)]
    pub fn vfx_frame(
        &self,
        id: &str,
        index: usize,
        anchor: Vec2,
        size: Vec2,
        rotation: f32,
        tint: Color,
        stats: &mut DrawStats,
    ) {
        self.vfx_frame_ex(id, index, anchor, size, rotation, tint, false, stats);
    }
    #[allow(clippy::too_many_arguments)]
    pub fn vfx_frame_ex(
        &self,
        id: &str,
        index: usize,
        anchor: Vec2,
        size: Vec2,
        rotation: f32,
        tint: Color,
        mirror: bool,
        stats: &mut DrawStats,
    ) {
        let source = orb_source(id);
        let Some(art) = self.vfx.get(source) else {
            stats.missing(format!("vfx:{id}"));
            return;
        };
        if stats.fx_quads >= 112 {
            return;
        }
        let e = &art.entry;
        let size = if size.x == 0. && size.y == 0. {
            vec2(e.screen_size_px[0], e.screen_size_px[1])
        } else {
            size
        };
        let pivot = vec2(e.pivot[0] / e.frame_size[0], e.pivot[1] / e.frame_size[1]) * size;
        if source != id {
            gl_use_material(&self.orb_hue);
        } else if matches!(id,"charge-gather"|"charge-ground"|"charge-flare"|"hit-poison"|"crit-poison") {
            // Reuse the luminance/white-core tint shader so purple source pixels cannot leak.
            gl_use_material(&self.charge_tint);
        } else if matches!(id,"warcry-shell-back"|"warcry-shell-front") {
            gl_use_material(&self.bubble_alpha);
        } else if e.blend == "additive" {
            gl_use_material(&self.additive);
        } else {
            gl_use_default_material();
        }
        let (texture,cell)=art.cell(index);
        draw_texture_ex(
            texture,
            anchor.x - pivot.x,
            anchor.y - pivot.y,
            vfx_tint(id, tint),
            DrawTextureParams {
                source: Some(Rect::new(
                    cell.x + 0.5,
                    cell.y + 0.5,
                    e.frame_size[0] - 1.,
                    e.frame_size[1] - 1.,
                )),
                dest_size: Some(size),
                flip_x: mirror,
                rotation,
                pivot: Some(anchor),
                ..Default::default()
            },
        );
        gl_use_default_material();
        stats.calls += 1;
        stats.fx_quads += 1;
    }
    pub fn vfx_once(
        &self,
        id: &str,
        age: f64,
        anchor: Vec2,
        size: Vec2,
        rotation: f32,
        mut tint: Color,
        stats: &mut DrawStats,
    ) {
        if let Some((frame, fade)) = self.vfx.get(id).and_then(|a| a.sample(age)) {
            tint.a *= fade;
            self.vfx_frame(id, frame, anchor, size, rotation, tint, stats);
        }
    }
    /// `vfx_once` with the frame mirrored horizontally inside its own rectangle (the pivot and
    /// placement are unchanged), for art authored with the opposite handedness.
    #[allow(clippy::too_many_arguments)]
    pub fn vfx_once_mirrored(
        &self,
        id: &str,
        age: f64,
        anchor: Vec2,
        size: Vec2,
        rotation: f32,
        mut tint: Color,
        stats: &mut DrawStats,
    ) {
        if let Some((frame, fade)) = self.vfx.get(id).and_then(|a| a.sample(age)) {
            tint.a *= fade;
            self.vfx_frame_ex(id, frame, anchor, size, rotation, tint, true, stats);
        }
    }
    /// A strip's occupied horizontal span connects both anchors without transparent gutters.
    pub fn vfx_strip(
        &self,
        id: &str,
        frame: usize,
        from: Vec2,
        to: Vec2,
        height: f32,
        tint: Color,
        stats: &mut DrawStats,
    ) {
        let Some(a) = self.vfx.get(orb_source(id)) else {
            stats.missing(format!("vfx:{id}"));
            return;
        };
        let d = to - from;
        if d.length_squared() < 0.001 {
            return;
        }
        let e = &a.entry;
        let width = d.length() * e.frame_size[0] / a.bounds.w;
        let direction = d.normalize();
        let anchor = from + direction * ((e.pivot[0] - a.bounds.x) / e.frame_size[0] * width);
        self.vfx_frame(
            id,
            frame,
            anchor,
            vec2(width, height),
            d.y.atan2(d.x),
            tint,
            stats,
        );
    }
    pub fn frame(
        &self,
        frame: &Frame,
        origin: [f32; 2],
        foot: Vec2,
        scale: f32,
        flip: bool,
        tint: Color,
        stats: &mut DrawStats,
    ) {
        let Some(page) = self.pages.get(frame.page) else {
            stats.missing(format!("atlas:{}",frame.page));
            return;
        };
        let x = if flip {
            origin[0] - frame.offset_x - frame.w
        } else {
            frame.offset_x - origin[0]
        };
        draw_texture_ex(
            page,
            foot.x + x * scale,
            foot.y + (frame.offset_y - origin[1]) * scale,
            tint,
            DrawTextureParams {
                source: Some(Rect::new(frame.x, frame.y, frame.w, frame.h)),
                dest_size: Some(vec2(frame.w * scale, frame.h * scale)),
                flip_x: flip,
                ..Default::default()
            },
        );
        stats.calls += 1;
    }
    pub fn decal(
        &self,
        name: &str,
        centre: Vec2,
        size: Vec2,
        rotation: f32,
        tint: Color,
        stats: &mut DrawStats,
    ) -> bool {
        if let Some(tex) = self.decals.get(name) {
            draw_texture_ex(
                tex,
                centre.x - size.x / 2.,
                centre.y - size.y / 2.,
                tint,
                DrawTextureParams {
                    dest_size: Some(size),
                    rotation,
                    ..Default::default()
                },
            );
            stats.calls += 1;
            true
        } else {
            stats.missing(format!("decal:{name}"));
            false
        }
    }
}

fn arcane_pulse_art() -> VfxEntry {
    VfxEntry {
        id: crate::render::arcane::IMPACT_ART.into(),
        file: Some("wishfire-skills/vfx_impact_g03_purple.png".into()),
        frame_size: [307., 321.], frame_count: 1,
        frame_ms: vec![(crate::render::arcane::BURST_SECONDS * 1000.) as f32],
        pivot: [153.5, 160.5], blend: "additive".into(), screen_size_px: [96., 96.],
    }
}
#[cfg(test)]
mod poison_tests {
    use super::*;
    #[test]
    fn marid_orb_aliases_reuse_coloured_cells_and_trail_bounds() {
        assert_eq!(orb_source("orb-head-marid"), "orb-head");
        assert_eq!(orb_source("orb-trail-marid"), "orb-trail");
        for id in ["orb-head", "orb-trail", "orb-head-kaja", "orb-trail-kaja",
            "orb-head-neutral", "orb-trail-neutral", "hit-poison"] {
            assert_eq!(orb_source(id), id);
        }
    }
    #[test]
    fn poison_hits_use_emerald_and_preserve_alpha_while_arcane_and_painted_faze_stay_original() {
        let tint=Color::new(1.,1.,1.,0.4);
        for id in ["hit-poison","crit-poison"] {
            let color=vfx_tint(id,tint);
            assert_eq!(color,Color{a:0.4,..POISON});
            assert!(color.g>color.b && color.b>color.r);
        }
        for id in ["hit-arcane","crit-arcane","arcane-pulse-impact","faze-pool","faze-tick"] {
            assert_eq!(vfx_tint(id,tint),tint);
        }
    }
}

#[cfg(test)]mod roster_assets_tests {
    use super::*;
    #[test]fn all_enemies_have_unique_packed_puppet_clips() {
        let root=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(".");
        let manifest:Manifest=nanoserde::DeJson::deserialize_json(&std::fs::read_to_string(root.join("gen/assets.json")).unwrap()).unwrap();
        for name in ["HighOrc","Marid","Lizardo","Gobloc","Orc","Boss","WfmHighGobloc","WfmSkeleton","WfmChimerilass","WfmDjinn"] {
            let art=&manifest.actors[name];assert_eq!(art.facing,"left");
            for state in ["idle","walk","basic","cast","hurt","ko","spawn"] {
                let clip=&art.clips[state];assert!(!clip.frames.is_empty(),"{name}/{state}");
                for f in &clip.frames {assert!(f.page<manifest.pages.len());assert!(f.w>0.&&f.h>0.&&f.hold_ms>0.);}
            }
        }
        let mut rectangles = std::collections::BTreeSet::new();
        for (name, art) in &manifest.actors {
            let f = &art.clips["idle"].frames[0];
            assert!(rectangles.insert((f.page, f.x as u32, f.y as u32)), "{name} shares a puppet");
        }
    }
}

#[cfg(test)]mod packed_bundle_tests {
    use super::*;
    fn json()->String {std::fs::read_to_string(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("gen/assets.json")).unwrap()}
    fn manifest()->Manifest {Manifest::deserialize_json(&json()).unwrap()}
    #[test]fn packed_manifest_identity_matches_the_compiled_client_and_all_actor_draws_resolve() {
        assert_eq!(manifest_fingerprint(&json()),env!("WF_PACKED_MANIFEST_HASH"));
        assert!(validate_manifest(&manifest()).is_ok());
    }
    #[test]fn every_missing_actor_or_clip_is_rejected_before_pink_fallback_can_draw() {
        for &name in ACTOR_ART {let mut m=manifest();m.actors.remove(name);
            assert!(validate_manifest(&m).unwrap_err().contains(name));
        }
        for state in ["idle","walk","basic","cast","hurt","ko","spawn"] {
            let mut m=manifest();m.actors.get_mut("HighOrc").unwrap().clips.remove(state);
            assert!(validate_manifest(&m).unwrap_err().contains(&format!("HighOrc/{state}")));
        }
    }
    #[test]fn actor_frame_cannot_reference_unloaded_or_out_of_bounds_atlas_data() {
        let mut m=manifest();m.actors.get_mut("HighOrc").unwrap().clips.get_mut("basic").unwrap().frames[0].page=m.pages.len();
        assert!(validate_manifest(&m).unwrap_err().contains("Unloaded atlas page"));
        let mut m=manifest();m.actors.get_mut("HighOrc").unwrap().clips.get_mut("cast").unwrap().frames[0].x=99999.;
        assert!(validate_manifest(&m).unwrap_err().contains("Invalid atlas frame"));
    }
}
