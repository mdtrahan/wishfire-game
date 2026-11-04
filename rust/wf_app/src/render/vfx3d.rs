//! Projected 3D spell primitives. The sim owns events; this module owns only pixels.
use crate::{
    assets::{Assets, DrawStats},
    camera::WorldCamera,
};
use macroquad::{
    miniquad::{BlendFactor as F, BlendState, BlendValue, Comparison, Equation, PipelineParams},
    prelude::*,
};
use std::cell::{Cell, RefCell};
/// Sampling only. Geometry, animation and all RNG streams remain independent.
#[derive(Clone, Copy, Debug, PartialEq)]
struct Sampling {
    dpi: f32,
    level: u32,
    ps1: bool,
}
impl Default for Sampling {
    fn default() -> Self { Self { dpi: 1., level: 3, ps1: true } }
}
impl Sampling {
    fn size(self, framebuffer: (u32, u32)) -> (u32, u32) {
        let divisor = match self.level { 0 => 6., 1 => 3., 2 => 1.5, _ => 1. };
        (((framebuffer.0 as f32 / divisor).round() as u32).max(1),
         ((framebuffer.1 as f32 / divisor).round() as u32).max(1))
    }
    fn stylized(self) -> bool { self.level != 3 || self.ps1 }
}
thread_local! { static SAMPLING: Cell<Sampling> = Cell::new(Sampling::default()); }
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_vfx_resolution(level: u32, ps1: u32) {
    SAMPLING.set(Sampling { level: level.min(3), ps1: ps1 != 0, ..SAMPLING.get() });
}
// Miniquad caches startup DPR on web; the browser supplies live DPR explicitly.
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_vfx_dpi(dpi: f32) {
    if dpi.is_finite() && dpi > 0. {
        SAMPLING.set(Sampling { dpi, ..SAMPLING.get() });
    }
}
fn sampling_dpi() -> f32 {
    #[cfg(target_arch = "wasm32")]
    { SAMPLING.get().dpi }
    #[cfg(not(target_arch = "wasm32"))]
    { screen_dpi_scale() }
}
/// V cycles L0/L1/L2/L3; Shift+V toggles native snap/dither.
pub fn sampling_controls() {
    if is_key_pressed(KeyCode::V) {
        SAMPLING.with(|s| {
            let mut value = s.get();
            if is_key_down(KeyCode::LeftShift) || is_key_down(KeyCode::RightShift) {
                value.ps1 = !value.ps1;
            } else { value.level = (value.level + 1) % 4; }
            s.set(value);
            info!("VFX L{} PS1 {}", value.level, value.stylized());
        });
    }
    GPU.with(|cell| {
        if let Some(gpu) = cell.borrow_mut().as_mut() { gpu.resize(); }
    });
}
fn portrait_viewport(size: (u32,u32)) -> (i32,i32,i32,i32) {
    let scale=(size.0 as f32 / crate::camera::WIDTH).min(size.1 as f32 / crate::camera::HEIGHT);
    let w=(crate::camera::WIDTH*scale).round().max(1.) as i32;
    let h=(crate::camera::HEIGHT*scale).round().max(1.) as i32;
    ((size.0 as i32-w)/2,(size.1 as i32-h)/2,w,h)
}
/// Macroquad's camera stack omits viewport state. Every caller draws in the
/// full portrait target; restore that viewport together with its camera.
fn pop_portrait_camera() {
    pop_camera_state();
    unsafe { get_internal_gl().quad_gl.viewport(None); }
}
fn framebuffer_size() -> (u32, u32) {
    let (w, h) = miniquad::window::screen_size();
    (w.round().max(1.) as u32, h.round().max(1.) as u32)
}
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_vfx_sampling_probe(index: u32) -> f32 {
    let s = SAMPLING.get();
    let (w, h) = s.size(framebuffer_size());
    [s.level as f32, w as f32, h as f32, s.stylized() as u32 as f32]
        .get(index as usize).copied().unwrap_or(f32::NAN)
}
pub const TAU: f32 = std::f32::consts::TAU;
pub fn c(x: f32) -> f32 {
    x.clamp(0., 1.)
}
pub fn s(x: f32) -> f32 {
    let x = c(x);
    x * x * (3. - 2. * x)
}
pub fn rgb(hex: u32, a: f32) -> Color {
    Color::new(
        (hex >> 16) as u8 as f32 / 255.,
        (hex >> 8) as u8 as f32 / 255.,
        hex as u8 as f32 / 255.,
        a.min(1.),
    )
}
#[derive(Clone, Copy)]
pub struct Rng(pub u32);
impl Rng {
    pub fn next(&mut self) -> f32 {
        self.0 = self.0.wrapping_mul(1664525).wrapping_add(1013904223);
        ((self.0 as f64 / 4294967296.) as f32).min(f32::from_bits(0x3f7fffff))
    }
    pub fn sphere(&mut self) -> Vec3 {
        let y = self.next() * 2. - 1.;
        let a = self.next() * TAU;
        vec3(
            (1. - y * y).sqrt() * a.cos(),
            y,
            (1. - y * y).sqrt() * a.sin(),
        )
    }
}
/// Stable event identity, never a read or draw from the simulation RNG.
pub fn seed(id: u32, time: f64) -> u32 {
    id.wrapping_mul(747796405) ^ ((time * 30000.).round() as u32).wrapping_mul(2891336453)
}
pub fn project(p: Vec3) -> Vec2 {
    vec2(p.x, p.z * 0.75 - p.y)
}
pub fn anchor(
    camera: &WorldCamera,
    snapshot: &wf_combat::Snapshot,
    id: u32,
    fallback: wf_combat::Vec2,
) -> Vec2 {
    snapshot
        .actors
        .iter()
        .find(|a| a.id == id)
        .map_or_else(|| camera.project(fallback), |a| camera.actor_foot(a))
}
pub fn zscale(camera: &WorldCamera) -> f32 {
    camera.zoom / 0.5
}
#[derive(Clone, Copy, PartialEq)]
pub enum Kind {
    Soft,
    Ribbon,
    Gas,
    Stone,
    Soap,
    Shaft,
    Star,
    Orb,
    Fire,
    Rings,
    BlueOrb,
    Streak,
    Shell,
    DjinnBody,
    DjinnShell,
    DjinnInk,
    DjinnGlobe,
    DjinnCap,
    DjinnHot,
    DjinnBillow,
    DjinnVein,
    DjinnSpark,
    DjinnGlow,
    DjinnArc,
}
#[derive(Clone, Copy, PartialEq)]
pub enum Blend {
    Add,
    Alpha,
    Solid,
    Gas,
}
struct Batch {
    mesh: Mesh,
    kind: Kind,
    blend: Blend,
}
#[derive(Default)]
pub struct Frame {
    batches: Vec<Batch>,
    pub time: f32,
    pub seed: f32,
}
impl Frame {
    fn batch(&mut self, kind: Kind, blend: Blend, n: usize) -> &mut Mesh {
        if !self.batches.last().is_some_and(|b| {
            b.kind == kind
                && b.blend == blend
                && b.mesh.vertices.len() + n < 10000
                && b.mesh.indices.len() + n * 3 < 4900
        }) {
            self.batches.push(Batch {
                mesh: Mesh {
                    vertices: Vec::new(),
                    indices: Vec::new(),
                    texture: None,
                },
                kind,
                blend,
            });
        }
        &mut self.batches.last_mut().unwrap().mesh
    }
    pub fn tri(
        &mut self,
        p: [Vec3; 3],
        uv: [Vec2; 3],
        color: [Color; 3],
        data: [Vec4; 3],
        kind: Kind,
        blend: Blend,
    ) {
        let m = self.batch(kind, blend, 3);
        let i = m.vertices.len() as u16;
        for j in 0..3 {
            let mut v = Vertex::new2(p[j], uv[j], color[j]);
            v.normal = data[j];
            m.vertices.push(v);
        }
        m.indices.extend_from_slice(&[i, i + 1, i + 2]);
    }
    pub fn quad(
        &mut self,
        p: Vec2,
        size: Vec2,
        angle: f32,
        color: u32,
        alpha: f32,
        kind: Kind,
        blend: Blend,
        seed: f32,
    ) {
        if alpha <= 0.0001 {
            return;
        }
        let color = rgb(color, alpha);
        let gain = alpha.max(1.);
        let (sn, cs) = angle.sin_cos();
        let points = [
            vec2(-0.5, -0.5),
            vec2(0.5, -0.5),
            vec2(0.5, 0.5),
            vec2(-0.5, 0.5),
        ];
        let m = self.batch(kind, blend, 4);
        let i = m.vertices.len() as u16;
        for q in points {
            let d = q * size;
            let xy = p + vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs);
            let mut v = Vertex::new2(xy.extend(0.), q + vec2(0.5, 0.5), color);
            v.normal = vec4(seed, 0., 0., gain);
            m.vertices.push(v);
        }
        m.indices
            .extend_from_slice(&[i, i + 1, i + 2, i, i + 2, i + 3]);
    }
    pub fn puff(
        &mut self,
        p: Vec2,
        size: Vec2,
        angle: f32,
        color: u32,
        alpha: f32,
        seed: f32,
        retreat: bool,
    ) {
        self.quad(p, size, angle, color, alpha, Kind::Gas, Blend::Gas, seed);
        if alpha > 0.0001 {
            let m = &mut self.batches.last_mut().unwrap().mesh;
            let n = m.vertices.len();
            for v in &mut m.vertices[n - 4..] {
                v.normal.y = if retreat { 1. } else { 0. };
            }
        }
    }
    pub fn draw_masked(
        &self,
        assets: &Assets,
        camera: &WorldCamera,
        s: &wf_combat::Snapshot,
        stats: &mut DrawStats,
    ) {
        if self.batches.is_empty() {
            return;
        }
        GPU.with(|cell| {
            let mut cell = cell.borrow_mut();
            let gpu = cell.get_or_insert_with(Gpu::new);
            push_camera_state();
            let mut cam = Camera2D::from_display_rect(Rect::new(0., 0., 360., 640.));
            cam.render_target = Some(gpu.mask.clone());
            cam.viewport = Some(gpu.viewport());
            set_camera(&cam);
            clear_background(Color::new(0., 0., 0., 0.));
            for a in s.actors.iter().filter(|a| a.hp > 0.) {
                if let Some(art) = assets.manifest.actors.get(&format!("{:?}", a.archetype)) {
                    if let Some(clip) = art.clips.get(crate::clips::name(a.state)) {
                        if let Some(frame) = crate::clips::actor(clip, a) {
                            assets.frame(
                                frame,
                                clip.foot_origin,
                                camera.actor_foot(a),
                                super::actors::visual_scale(a) * camera.zoom,
                                (art.facing == "left") != (a.facing == wf_combat::Facing::Left),
                                WHITE,
                                stats,
                            );
                        }
                    }
                }
            }
            pop_portrait_camera();
        });
        self.draw(stats);
    }
    pub fn glow(&mut self, p: Vec2, size: f32, color: u32, alpha: f32) {
        self.quad(
            p,
            Vec2::splat(size),
            0.,
            color,
            alpha,
            Kind::Soft,
            Blend::Add,
            0.,
        );
    }
    pub fn line(&mut self, a: Vec2, b: Vec2, width: f32, color: u32, alpha: f32) {
        let d = b - a;
        self.quad(
            (a + b) * 0.5,
            vec2(d.length(), width),
            d.y.atan2(d.x),
            color,
            alpha,
            Kind::Soft,
            Blend::Add,
            0.,
        );
    }
    pub fn ring(&mut self, p: Vec2, r: Vec2, width: f32, color: u32, alpha: f32, n: usize) {
        let m = self.batch(Kind::Soft, Blend::Add, (n + 1) * 2);
        let base = m.vertices.len() as u16;
        for i in 0..=n {
            let a = i as f32 / n as f32 * TAU;
            for k in [-1., 1.] {
                let xy = p + vec2(a.cos(), a.sin()) * (r + Vec2::splat(k * width * 0.5));
                let mut v = Vertex::new2(xy.extend(0.), vec2(0.5, 0.5), rgb(color, alpha));
                v.normal.w = 1.;
                m.vertices.push(v);
            }
            if i < n {
                let j = base + i as u16 * 2;
                m.indices
                    .extend_from_slice(&[j, j + 1, j + 2, j + 1, j + 3, j + 2]);
            }
        }
    }
    pub fn draw(&self, stats: &mut DrawStats) {
        if self.batches.is_empty() {
            return;
        }
        GPU.with(|cell| {
            let mut cell = cell.borrow_mut();
            let gpu = cell.get_or_insert_with(Gpu::new);
            push_camera_state();
            let mut cam = Camera2D::from_display_rect(Rect::new(0., 0., 360., 640.));
            cam.render_target = Some(gpu.target.clone());
            cam.viewport = Some(gpu.viewport());
            set_camera(&cam);
            clear_background(Color::new(0., 0., 0., 0.));
            self.draw_batches(gpu, stats, false);
            pop_portrait_camera();
            gpu.post.set_uniform("sampleSize", vec2(gpu.size.0 as f32, gpu.size.1 as f32));
            gpu.post.set_uniform("dither", if SAMPLING.get().stylized() { 1_f32 } else { 0_f32 });
            gl_use_material(&gpu.post);
            draw_texture_ex(
                &gpu.target.texture,
                0.,
                0.,
                WHITE,
                DrawTextureParams {
                    dest_size: Some(vec2(360., 640.)),
                    source: Some({ let (x,y,w,h)=gpu.viewport(); Rect::new(x as f32,y as f32,w as f32,h as f32) }),
                    flip_y: true,
                    ..Default::default()
                },
            );
            gl_use_default_material();
            stats.calls += 1;
        });
    }
    /// Djinn-only linear radiance and multi-scale bloom. Shared spell post remains unchanged.
    pub fn draw_bloom(&self, stats: &mut DrawStats) {
        if self.batches.is_empty() {return}
        GPU.with(|cell| {
            let mut cell=cell.borrow_mut();
            let gpu=cell.get_or_insert_with(Gpu::new);
            let bloom=&gpu.bloom;
            push_camera_state();
            let mut cam=Camera2D::from_display_rect(Rect::new(0.,0.,360.,640.));
            cam.render_target=Some(gpu.target.clone());cam.viewport=Some(gpu.viewport());
            set_camera(&cam);clear_background(Color::new(0.,0.,0.,0.));
            self.draw_batches(gpu,stats,false);
            let pass=|source:&Texture2D,target:&RenderTarget,mode:f32,dir:Vec2| {
                let mut cam=Camera2D::from_display_rect(Rect::new(0.,0.,source.width(),source.height()));
                cam.render_target=Some(target.clone());set_camera(&cam);
                clear_background(Color::new(0.,0.,0.,0.));
                bloom.filter.set_uniform("mode",mode);bloom.filter.set_uniform("dir",dir);
                gl_use_material(&bloom.filter);
                draw_texture_ex(source,0.,0.,WHITE,DrawTextureParams{dest_size:Some(vec2(source.width(),source.height())),flip_y:true,..Default::default()});
                gl_use_default_material();
            };
            pass(&gpu.target.texture,&bloom.bright,0.,Vec2::ZERO);
            let mut source=&bloom.bright.texture;
            let (_,_,portrait_w,_)=gpu.viewport();
            let radius_scale=portrait_w as f32/720.;
            for radius in [1_f32,3.,6.].map(|r|r*radius_scale) {
                pass(source,&bloom.a,1.,vec2(radius/bloom.a.texture.width(),0.));
                pass(&bloom.a.texture,&bloom.b,1.,vec2(0.,radius/bloom.a.texture.height()));
                source=&bloom.b.texture;
            }
            pop_portrait_camera();
            bloom.compose.set_texture("Bloom",bloom.b.texture.clone());
            bloom.compose.set_uniform("sampleSize",vec2(gpu.size.0 as f32,gpu.size.1 as f32));
            bloom.compose.set_uniform("dither",if SAMPLING.get().stylized(){1_f32}else{0_f32});
            gl_use_material(&bloom.compose);
            let (x,y,w,h)=gpu.viewport();
            draw_texture_ex(&gpu.target.texture,0.,0.,WHITE,DrawTextureParams{dest_size:Some(vec2(360.,640.)),source:Some(Rect::new(x as f32,y as f32,w as f32,h as f32)),flip_y:true,..Default::default()});
            gl_use_default_material();stats.calls+=8;
        });
    }
    pub fn draw_full(&self, stats: &mut DrawStats) {
        if self.batches.is_empty() {
            return;
        }
        GPU.with(|cell| {
            let mut cell = cell.borrow_mut();
            let gpu = cell.get_or_insert_with(Gpu::new);
            self.draw_batches(gpu, stats, true);
        });
    }
    fn draw_batches(&self, gpu: &Gpu, stats: &mut DrawStats, full: bool) {
        for b in &self.batches {
            let djinn=(b.kind as u32)>=Kind::DjinnBody as u32;
            let material = if djinn { &gpu.djinn_materials[if b.blend==Blend::Add {0}else{1}] } else { &gpu.materials[match b.blend {
                Blend::Add => 0,
                Blend::Alpha => 1,
                Blend::Solid => 2,
                Blend::Gas => 3,
            }] };
            material.set_uniform("mode", if djinn {(b.kind as u32-Kind::DjinnBody as u32) as f32}else{b.kind as u32 as f32});
            if djinn {material.set_uniform("seed",self.seed);}
            material.set_uniform("clock", self.time);
            material.set_uniform("snap", if !full && SAMPLING.get().stylized() { 1_f32 } else { 0_f32 });
            if !djinn {material.set_uniform("sampleSize", vec2(gpu.size.0 as f32, gpu.size.1 as f32));}
            let (_,_,w,h)=gpu.viewport();
            material.set_uniform("snapSize", vec2(w as f32,h as f32));
            if !djinn {
                material.set_texture("Mask", gpu.mask.texture.clone());
                material.set_texture("Pattern", gpu.pattern.clone());
                material.set_texture("Stone", gpu.stone.clone());
            }
            gl_use_material(material);
            draw_mesh(&b.mesh);
            stats.calls += 1;
        }
        gl_use_default_material();
    }
}
thread_local! {static GPU:RefCell<Option<Gpu>>=const{RefCell::new(None)};}
struct Gpu {
    dpi: f32,
    size: (u32, u32),
    target: RenderTarget,
    mask: RenderTarget,
    pattern: Texture2D,
    stone: Texture2D,
    materials: [Material; 4],
    djinn_materials: [Material; 2],
    bloom: Bloom,
    post: Material,
    light: Material,
}
impl Gpu {
    fn new() -> Self {
        let size = SAMPLING.get().size(framebuffer_size());
        let target = render_target_ex(
            size.0,
            size.1,
            RenderTargetParams {
                depth: true,
                ..Default::default()
            },
        );
        target.texture.set_filter(FilterMode::Nearest);
        let mask = render_target(size.0, size.1);
        mask.texture.set_filter(FilterMode::Nearest);
        let mut rng = Rng(471);
        let bands: Vec<_> = (0..64).map(|_| rng.next()).collect();
        let mut pixels = Vec::with_capacity(64 * 64 * 4);
        for y in 0..64 {
            for x in 0..64 {
                let n = rng.next();
                let a = c(0.08
                    + n * 0.24
                    + bands[x].powi(3) * 0.7
                    + if (y + x * 3) % 23 < 2 { 0.32 } else { 0. });
                pixels.extend_from_slice(&[255, 255, 255, (a * 255.) as u8]);
            }
        }
        let pattern = Texture2D::from_rgba8(64, 64, &pixels);
        pattern.set_filter(FilterMode::Nearest);
        let stone = stone_texture();
        let materials = [Blend::Add, Blend::Alpha, Blend::Solid, Blend::Gas].map(|blend| {
            let add = blend == Blend::Add;
            let params = PipelineParams {
                depth_test: if matches!(blend, Blend::Solid | Blend::Gas) {
                    Comparison::LessOrEqual
                } else {
                    Comparison::Always
                },
                depth_write: blend == Blend::Solid,
                color_blend: Some(BlendState::new(
                    Equation::Add,
                    F::Value(BlendValue::SourceAlpha),
                    if add {
                        F::One
                    } else {
                        F::OneMinusValue(BlendValue::SourceAlpha)
                    },
                )),
                alpha_blend: Some(BlendState::new(
                    Equation::Add,
                    if add { F::Zero } else { F::One },
                    if add {
                        F::One
                    } else {
                        F::OneMinusValue(BlendValue::SourceAlpha)
                    },
                )),
                ..Default::default()
            };
            load_material(
                ShaderSource::Glsl {
                    vertex: VERTEX,
                    fragment: FRAGMENT,
                },
                MaterialParams {
                    pipeline_params: params,
                    textures: vec!["Mask".into(), "Pattern".into(), "Stone".into()],
                    uniforms: vec![
                        UniformDesc::new("mode", UniformType::Float1),
                        UniformDesc::new("clock", UniformType::Float1),
                        UniformDesc::new("snap", UniformType::Float1),
                        UniformDesc::new("sampleSize", UniformType::Float2),
                        UniformDesc::new("snapSize", UniformType::Float2),
                    ],
                    ..Default::default()
                },
            )
            .expect("approved VFX GLSL ES")
        });
        let djinn_materials=[true,false].map(|add| load_material(
            ShaderSource::Glsl{vertex:VERTEX,fragment:include_str!("djinn.glsl")},
            MaterialParams{
                pipeline_params:PipelineParams{
                    color_blend:Some(BlendState::new(Equation::Add,F::Value(BlendValue::SourceAlpha),if add{F::One}else{F::OneMinusValue(BlendValue::SourceAlpha)})),
                    alpha_blend:Some(BlendState::new(Equation::Add,if add{F::Zero}else{F::One},if add{F::One}else{F::OneMinusValue(BlendValue::SourceAlpha)})),
                    ..Default::default()
                },
                uniforms:vec![UniformDesc::new("mode",UniformType::Float1),UniformDesc::new("clock",UniformType::Float1),UniformDesc::new("seed",UniformType::Float1),UniformDesc::new("snap",UniformType::Float1),UniformDesc::new("snapSize",UniformType::Float2)],
                ..Default::default()
            }).expect("Djinn v8 GLSL ES"));
        let post = load_material(
            ShaderSource::Glsl {
                vertex: POST_VERTEX,
                fragment: POST,
            },
            MaterialParams {
                pipeline_params: PipelineParams {
                    color_blend: Some(BlendState::new(
                        Equation::Add,
                        F::One,
                        F::OneMinusValue(BlendValue::SourceAlpha),
                    )),
                    alpha_blend: Some(BlendState::new(Equation::Add, F::Zero, F::One)),
                    ..Default::default()
                },
                uniforms: vec![
                    UniformDesc::new("sampleSize", UniformType::Float2),
                    UniformDesc::new("dither", UniformType::Float1),
                ],
                ..Default::default()
            },
        )
        .expect("VFX PS1 composite");
        let light = load_material(
            ShaderSource::Glsl {
                vertex: POST_VERTEX,
                fragment: LIGHT,
            },
            MaterialParams {
                pipeline_params: PipelineParams {
                    color_blend: Some(BlendState::new(
                        Equation::Add,
                        F::Value(BlendValue::SourceAlpha),
                        F::One,
                    )),
                    alpha_blend: Some(BlendState::new(Equation::Add, F::Zero, F::One)),
                    ..Default::default()
                },
                uniforms: vec![
                    UniformDesc::new("lift", UniformType::Float1),
                    UniformDesc::new("bounds", UniformType::Float4),
                    UniformDesc::new("delta", UniformType::Float2),
                    UniformDesc::new("lightMode", UniformType::Float1),
                ],
                ..Default::default()
            },
        )
        .expect("source-chroma light");
        Self {
            dpi: sampling_dpi(),
            size,
            target,
            mask,
            pattern,
            stone,
            materials,
            djinn_materials,
            bloom: Bloom::new(size),
            post,
            light,
        }
    }
    /// Sample the same portrait viewport as the game, preserving native 1:1 pixels
    /// even when the canvas has letterboxes. The remaining target pixels stay clear.
    fn viewport(&self) -> (i32,i32,i32,i32) {
        portrait_viewport(self.size)
    }
    fn resize(&mut self) {
        let size = SAMPLING.get().size(framebuffer_size());
        let dpi = sampling_dpi();
        if self.size == size && self.dpi == dpi { return; }
        self.target = render_target_ex(size.0, size.1, RenderTargetParams { depth: true, ..Default::default() });
        self.target.texture.set_filter(FilterMode::Nearest);
        self.mask = render_target(size.0, size.1);
        self.mask.texture.set_filter(FilterMode::Nearest);
        self.bloom.resize(size);
        self.size = size;
        self.dpi = dpi;
    }
}
struct Bloom {bright:RenderTarget,a:RenderTarget,b:RenderTarget,filter:Material,compose:Material}
impl Bloom {
    fn resize(&mut self,size:(u32,u32)) {
        for target in [&mut self.bright,&mut self.a,&mut self.b] {
            *target=render_target((size.0/2).max(1),(size.1/2).max(1));
            target.texture.set_filter(FilterMode::Linear);
        }
    }
    fn new(size:(u32,u32))->Self {
        let target=||{let t=render_target((size.0/2).max(1),(size.1/2).max(1));t.texture.set_filter(FilterMode::Linear);t};
        let filter=load_material(ShaderSource::Glsl{vertex:POST_VERTEX,fragment:DJINN_BLUR},MaterialParams{uniforms:vec![UniformDesc::new("mode",UniformType::Float1),UniformDesc::new("dir",UniformType::Float2)],..Default::default()}).expect("Djinn bloom filter");
        let compose=load_material(ShaderSource::Glsl{vertex:POST_VERTEX,fragment:DJINN_POST},MaterialParams{
            textures:vec!["Bloom".into()],uniforms:vec![UniformDesc::new("sampleSize",UniformType::Float2),UniformDesc::new("dither",UniformType::Float1)],
            pipeline_params:PipelineParams{color_blend:Some(BlendState::new(Equation::Add,F::One,F::OneMinusValue(BlendValue::SourceAlpha))),alpha_blend:Some(BlendState::new(Equation::Add,F::Zero,F::One)),..Default::default()},..Default::default()}).expect("Djinn bloom composite");
        Self{bright:target(),a:target(),b:target(),filter,compose}
    }
}
const DJINN_BLUR:&str=r#"#version 100
precision highp float;varying vec2 uv;uniform sampler2D Texture;uniform vec2 dir;uniform float mode;
void main(){vec3 c=texture2D(Texture,uv).rgb;if(mode<0.5){c*=smoothstep(0.70,1.15,max(c.r,max(c.g,c.b))*16.);}else{c*=0.227;c+=(texture2D(Texture,uv+dir*1.3846).rgb+texture2D(Texture,uv-dir*1.3846).rgb)*0.3162;c+=(texture2D(Texture,uv+dir*3.2307).rgb+texture2D(Texture,uv-dir*3.2307).rgb)*0.0703;}gl_FragColor=vec4(c,1.);}
"#;
const DJINN_POST:&str=r#"#version 100
precision highp float;varying vec2 uv;uniform sampler2D Texture,Bloom;uniform vec2 sampleSize;uniform float dither;
void main(){vec4 c=texture2D(Texture,uv);vec3 bloom=texture2D(Bloom,uv).rgb*16.*0.44;vec3 rgb=pow(vec3(1)-exp(-(c.rgb*16.+bloom)*1.05),vec3(1./2.2));float a=clamp(c.a+max(bloom.r,max(bloom.g,bloom.b)),0.,1.);vec2 cell=floor(uv*sampleSize);float b=mix(0.5,mod(cell.x+mod(cell.y,2.)*2.,4.)/4.,dither);gl_FragColor=vec4(floor(rgb*31.+b)/31.,a);}
"#;
// Ground Pound only: approved JS f64 noise, baked once for nearest sampling.
fn stone_texture() -> Texture2D {
    let hash = |x: f64, y: f64| {
        let v = (x * 127.1 + y * 311.7 + 19.17).sin() * 43758.5453;
        v - v.floor()
    };
    let noise = |x: f64, y: f64| {
        let (ix, iy) = (x.floor(), y.floor());
        let (u, v) = (x - ix, y - iy);
        let (u, v) = (u * u * (3. - 2. * u), v * v * (3. - 2. * v));
        (hash(ix, iy) * (1. - u) + hash(ix + 1., iy) * u) * (1. - v)
            + (hash(ix, iy + 1.) * (1. - u) + hash(ix + 1., iy + 1.) * u) * v
    };
    let palette = [
        0x4a3020_u32,
        0x634027,
        0x7d502e,
        0xa07040,
        0xb3844d,
        0xbf965c,
        0xc9a46a,
    ];
    let mut pixels = Vec::with_capacity(64 * 64 * 4);
    for y in 0..64 {
        for x in 0..64 {
            let (x, y) = (x as f64, y as f64);
            let n = 0.65 * noise(x / 15., y / 15.)
                + 0.25 * noise(x / 7. + 13., y / 7. + 9.)
                + 0.10 * noise(x / 3. + 27., y / 3. + 31.);
            let p = palette[(((n - 0.25) / 0.50).clamp(0., 1.) * 6.).round() as usize];
            pixels.extend_from_slice(&[(p >> 16) as u8, (p >> 8) as u8, p as u8, 255]);
        }
    }
    let texture = Texture2D::from_rgba8(64, 64, &pixels);
    texture.set_filter(FilterMode::Nearest);
    texture
}
const POST_VERTEX:&str="#version 100\nattribute vec3 position;attribute vec2 texcoord;uniform mat4 Model,Projection;varying vec2 uv;void main(){uv=texcoord;gl_Position=Projection*Model*vec4(position,1.);}";
const VERTEX:&str="#version 100\nattribute vec3 position;attribute vec2 texcoord;attribute vec4 color0,normal;uniform mat4 Model,Projection;uniform float snap;uniform vec2 snapSize;varying vec2 uv;varying vec4 col,aux;void main(){uv=texcoord;col=color0/255.;aux=normal;gl_Position=Projection*Model*vec4(position,1.);if(snap>0.5){vec2 g=snapSize;gl_Position.xy=((floor((gl_Position.xy/gl_Position.w*0.5+0.5)*g)+0.5)/g*2.-1.)*gl_Position.w;}}";
const POST: &str = r#"#version 100
precision highp float;varying vec2 uv;uniform sampler2D Texture;uniform vec2 sampleSize;uniform float dither;
void main(){vec4 c=texture2D(Texture,uv);vec2 cell=floor(uv*sampleSize);float b=mix(0.5,mod(cell.x+mod(cell.y,2.)*2.,4.)/4.,dither);c.rgb=floor(c.rgb*31.+b)/31.;gl_FragColor=c;}
"#;
const FRAGMENT: &str = r#"#version 100
precision mediump float;varying vec2 uv;varying vec4 col,aux;uniform float mode,clock;uniform highp vec2 sampleSize;uniform sampler2D Mask,Pattern,Stone;
float hash(vec2 p){float offset=mode>2.5&&mode<3.5?19.17:8.4;return fract(sin(dot(p,vec2(127.1,311.7))+offset)*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
float fbm(vec2 p){return 0.65*noise(p)+0.35*noise(p*2.03+7.1);}
void main(){vec2 q=(uv-0.5)*2.;float r=length(q);vec3 color=col.rgb;float a=1.;
if(mode<0.5){a=pow(max(0.,1.-r),1.8);}
else if(mode<1.5){float v=abs(uv.y-0.5)*2.;a=clamp((1.-v)/0.6,0.,1.)*pow(uv.x,0.65);vec3 c=uv.x<0.48?mix(vec3(0.55,0.07,1.),vec3(0.05,0.25,1.),uv.x/0.48):mix(vec3(0.05,0.25,1.),vec3(0.03,1.,1.),(uv.x-0.48)/0.52);color=mix(c,vec3(1.,0.98,1.),pow(1.-v,12.)*0.98);}
else if(mode<2.5){vec2 p=uv*3.2+aux.x;vec2 warp=vec2(fbm(p+vec2(clock*0.72,-clock*0.38)),fbm(p+vec2(-clock*0.43,clock*0.61)+13.7))-0.5;vec2 w=uv+warp*0.18;float rad=length((w-0.5)*2.);float n=0.7*noise(w*64./18.)+0.3*noise(w*64./8.+vec2(9.,5.));a=min(1.,1.20*exp(-rad*rad*2.)*(1.-smoothstep(0.16,1.,rad))*(0.68+0.32*n));a*=0.84+0.16*fbm(p*1.4+vec2(clock*0.83,clock*0.46));if(aux.y>0.5){a=min(1.,a*2.1);vec3 normal=normalize(vec3(q,sqrt(max(0.,1.-dot(q,q)))));color*=mix(0.42,1.48,max(0.,dot(normal,normalize(vec3(-0.5,0.75,0.6)))))*mix(0.85,1.05,uv.y);}if(aux.y>0.5){a*=mix(1.,0.015,step(0.15,texture2D(Mask,gl_FragCoord.xy/sampleSize).a));}a*=smoothstep(0.,0.18,uv.y)*(1.-smoothstep(0.72,1.,max(abs(q.x),abs(q.y))));}
else if(mode<3.5){vec3 p=texture2D(Stone,fract(uv)).rgb;p=mix(p/12.92,pow((p+.055)/1.055,vec3(2.4)),step(vec3(.04045),p));color*=p*2.;color+=vec3(.75,.32,.055)*aux.x;color=mix(color*12.92,1.055*pow(max(color,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),color));}
else if(mode<4.5){
    vec3 n=normalize(aux.xyz),view=vec3(0.,0.,1.);
    vec3 light=normalize(vec3(-0.55,0.85,0.8));
    float facing=abs(dot(n,view)),rim=pow(1.-facing,2.);
    float lit=max(0.,dot(n,light));
    // Film thickness flows over the surface; view angle shifts its interference colours.
    float thickness=0.55+0.12*sin(n.y*4.+n.x*2.+clock*0.65+sin(n.z*3.-n.x*2.));
    vec3 film=0.62+0.38*cos(vec3(0.,2.1,4.2)+thickness*19.*(0.45+0.55*facing));
    color=mix(vec3(0.77,0.94,1.),film,0.22+0.50*rim)*(0.78+0.22*lit);
    vec3 reflection=reflect(-view,n);
    float spec=pow(max(0.,dot(reflection,light)),48.);
    float gloss=pow(max(0.,dot(reflection,light)),8.);
    float bounce=pow(max(0.,dot(reflection,normalize(vec3(0.65,-0.65,0.65)))),64.);
    // A reflected horizon bends with the sphere, including the quieter far wall.
    float band=exp(-pow(abs(reflection.y-0.22-0.12*sin(reflection.x*2.5))*9.,2.));
    band*=0.25+0.75*smoothstep(-0.8,0.6,reflection.x);
    float window=exp(-pow(abs(reflection.x+0.82)*9.,2.)-pow(abs(reflection.y-0.48)*3.8,4.));
    window*=smoothstep(0.,0.2,n.z);
    float shine=clamp(spec+0.18*gloss+0.52*bounce+0.32*band+0.95*window,0.,1.);
    color=mix(color,vec3(1.,0.99,1.),shine);
    a=0.045+0.16*lit+0.40*rim+0.72*spec+0.10*gloss+0.38*bounce+0.20*band+0.82*window;
}
else if(mode<5.5){float v=1.-uv.y;float time=clock+aux.x;vec2 st=floor(vec2(uv.x,fract(v+time*.16))*63.)/63.;float core=exp(-pow((uv.x-.5)*3.8,2.));float grain=exp(-pow((st.x-.5)*4.2,2.))*(.62+.38*pow(cos(st.x*42.+st.y*63.*.065),12.));float flow=.64+.24*grain+.12*sin(v*29.+time*8.+uv.x*17.);color=mix(vec3(1.,.58,.045),vec3(.96,.99,1.),pow(core,1.7));a=core*flow*smoothstep(0.,.1,v)*(1.-smoothstep(.72,1.,v));}
else if(mode<6.5){float cross=min(abs(q.x),abs(q.y));a=max(exp(-r*r*5.)*0.6,(1.-smoothstep(0.04,0.15,cross))*(1.-r));color=mix(vec3(1.,0.76,0.16),vec3(1.,0.996,0.95),a);}
else if(mode<7.5){a=exp(-4.5*r*r)*(1.-smoothstep(0.72,1.,r));color=mix(color,vec3(1.),exp(-dot(uv-0.5,uv-0.5)*180.)*0.28);}
else if(mode<8.5){float x=q.x;float core=exp(-dot(vec2(x,q.y-0.42),vec2(x,q.y-0.42))*4.);float tongues=0.;for(int i=0;i<7;i++){float f=float(i);float cx=-0.72+f*0.24;float h=0.5+mod(f*19.,32.)/64.;float width=0.12+0.07*(q.y+1.);tongues+=exp(-pow((x-cx-0.08*sin(q.y*4.+f))/width,2.))*smoothstep(-h,-h+0.3,q.y)*(1.-smoothstep(0.55,1.,q.y));}a=clamp(core+tongues*0.48,0.,1.)*(1.-smoothstep(0.8,1.,abs(x)));color=mix(vec3(1.,0.48,0.08),vec3(1.,0.94,0.60),clamp(core+q.y*0.3,0.,1.));color=mix(color,vec3(1.),core*core);}
else if(mode<9.5){float e=1.-exp(-max(0.,clock)*0.55);float outer=0.425+0.035*e,inner=0.29+0.045*e;float dist=min(abs(r*0.5-outer),abs(r*0.5-inner));a=1.-smoothstep(0.005,0.013,dist);color=mix(vec3(1.,0.66,0.13),vec3(1.,0.98,0.87),1.-smoothstep(0.001,0.009,min(abs(r*0.5-(outer-0.004)),abs(r*0.5-(inner-0.004)))));}
else if(mode<10.5){float core=exp(-65.*r*r);color=mix(vec3(0.05,0.70,0.88),vec3(1.),core);a=(exp(-7.*r*r)*0.95+0.42*exp(-2.5*r*r))*(1.-smoothstep(0.72,1.,r));}
else if(mode<11.5){float v=1.-uv.y;vec2 st=floor(vec2(uv.x,fract(v+(clock+aux.x)*.16))*63.)/63.;float core=exp(-pow((st.x-.5)*4.2,2.));float stripe=.62+.38*pow(cos(st.x*42.+st.y*63.*.065),12.);color=vec3(1.,(239.+16.*core)/255.,(148.+107.*core)/255.);a=core*stripe*smoothstep(0.,.1,v)*(1.-smoothstep(.72,1.,v));}
else{float grain=texture2D(Pattern,fract(uv*vec2(2.,1.)+vec2(0.,-clock*.72))).a;float lit=.32+.68*max(0.,dot(normalize(aux.xyz),normalize(vec3(-.5,.8,.6))));float edge=pow(abs(uv.y-.5)*2.,4.);color=mix(col.rgb*lit,vec3(1.),step(.83,grain)*.82);a=(grain*.85+edge*.25)*.8;}
gl_FragColor=vec4(color,a*col.a*aux.w);}
"#;
/// Add source-chroma light without editing the source sprite, its transform or alpha.
/// A zero lift skips the draw entirely, including the fringes.
pub fn illuminate(
    assets: &Assets,
    camera: &WorldCamera,
    a: &wf_combat::ActorView,
    lift: f32,
    stats: &mut DrawStats,
) {
    illuminate_style(assets, camera, a, lift, 0., stats)
}
pub fn target_light(
    assets: &Assets,
    camera: &WorldCamera,
    a: &wf_combat::ActorView,
    lift: f32,
    stats: &mut DrawStats,
) {
    illuminate_style(assets, camera, a, lift, 1., stats)
}
fn illuminate_style(
    assets: &Assets,
    camera: &WorldCamera,
    a: &wf_combat::ActorView,
    lift: f32,
    mode: f32,
    stats: &mut DrawStats,
) {
    if lift <= 0. {
        return;
    }
    let Some(art) = assets.manifest.actors.get(&format!("{:?}", a.archetype)) else {
        return;
    };
    let Some(clip) = art.clips.get(crate::clips::name(a.state)) else {
        return;
    };
    let Some(frame) = crate::clips::actor(clip, a) else {
        return;
    };
    GPU.with(|cell| {
        let mut cell = cell.borrow_mut();
        let gpu = cell.get_or_insert_with(Gpu::new);
        gpu.light.set_uniform("lift", lift);
        gpu.light.set_uniform("lightMode", mode);
        let page = &assets.pages[frame.page];
        gpu.light.set_uniform(
            "bounds",
            vec4(
                frame.x / page.width(),
                frame.y / page.height(),
                (frame.x + frame.w) / page.width(),
                (frame.y + frame.h) / page.height(),
            ),
        );
        gpu.light.set_uniform(
            "delta",
            vec2(
                frame.w * 0.013 / page.width(),
                frame.h * 0.006 / page.height(),
            ),
        );
        gl_use_material(&gpu.light);
        assets.frame(
            frame,
            clip.foot_origin,
            camera.actor_foot(a),
            super::actors::visual_scale(a) * camera.zoom,
            (art.facing == "left") != (a.facing == wf_combat::Facing::Left),
            WHITE,
            stats,
        );
        gl_use_default_material();
    });
}
const LIGHT: &str = r#"#version 100
precision mediump float;varying vec2 uv;uniform sampler2D Texture;uniform float lift,lightMode;uniform vec4 bounds;uniform vec2 delta;float alpha(vec2 p){return texture2D(Texture,clamp(p,bounds.xy,bounds.zw)).a;}
void main(){vec4 c=texture2D(Texture,uv);float hi=max(c.r,max(c.g,c.b)),lo=min(c.r,min(c.g,c.b));vec3 chroma=hi>lo?(c.rgb-lo)/(hi-lo):vec3(1.);float n=max(max(alpha(uv+vec2(delta.x,0.)),alpha(uv-vec2(delta.x,0.))),max(alpha(uv+vec2(0.,delta.y)),alpha(uv-vec2(0.,delta.y))));vec3 rim=vec3(1.,.88,.53)*max(0.,n-c.a)*lift/0.2*0.85;gl_FragColor=lightMode>.5?vec4(c.rgb*lift,c.a):vec4(chroma*lift*(1.-hi)*c.a+rim,1.);}
"#;
// Read-only per-frame evidence: active, study age, cast seed, count, target x/y, source x/y.
#[cfg(target_arch = "wasm32")]
thread_local! {static PROBE:std::cell::Cell<[f32;64]>=const{std::cell::Cell::new([0.;64])};}
pub fn reset_probe() {
    #[cfg(target_arch = "wasm32")]
    PROBE.with(|p| p.set([0.; 64]));
}
pub fn record(spell: usize, values: [f32; 8]) {
    #[cfg(target_arch = "wasm32")]
    PROBE.with(|p| {
        let mut a = p.get();
        a[spell * 16..spell * 16 + 8].copy_from_slice(&values);
        p.set(a);
    });
    #[cfg(not(target_arch = "wasm32"))]
    let _ = (spell, values);
}
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_vfx3d_probe(index: u32) -> f32 {
    PROBE.with(|p| p.get().get(index as usize).copied().unwrap_or(f32::NAN))
}
pub fn record_seed(spell: usize, seed: u32) {
    #[cfg(target_arch = "wasm32")]
    PROBE.with(|p| {
        let mut a = p.get();
        a[spell * 16 + 8] = (seed & 65535) as f32;
        a[spell * 16 + 9] = (seed >> 16) as f32;
        p.set(a);
    });
    #[cfg(not(target_arch = "wasm32"))]
    let _ = (spell, seed);
}
/// Three.js IcosahedronGeometry subdivides each face into (detail+1)^2 triangles.
pub fn icosahedron(detail: usize) -> Vec<[Vec3; 3]> {
    let g = (1. + 5_f32.sqrt()) / 2.;
    let v = [
        vec3(-1., g, 0.),
        vec3(1., g, 0.),
        vec3(-1., -g, 0.),
        vec3(1., -g, 0.),
        vec3(0., -1., g),
        vec3(0., 1., g),
        vec3(0., -1., -g),
        vec3(0., 1., -g),
        vec3(g, 0., -1.),
        vec3(g, 0., 1.),
        vec3(-g, 0., -1.),
        vec3(-g, 0., 1.),
    ]
    .map(|v| v.normalize());
    let faces = [
        [0, 11, 5],
        [0, 5, 1],
        [0, 1, 7],
        [0, 7, 10],
        [0, 10, 11],
        [1, 5, 9],
        [5, 11, 4],
        [11, 10, 2],
        [10, 7, 6],
        [7, 1, 8],
        [3, 9, 4],
        [3, 4, 2],
        [3, 2, 6],
        [3, 6, 8],
        [3, 8, 9],
        [4, 9, 5],
        [2, 4, 11],
        [6, 2, 10],
        [8, 6, 7],
        [9, 8, 1],
    ];
    let n = detail + 1;
    let mut triangles = Vec::with_capacity(20 * n * n);
    for [a, b, c] in faces {
        let point = |i: usize, j: usize| {
            (v[a] * (1. - (i + j) as f32 / n as f32)
                + v[b] * i as f32 / n as f32
                + v[c] * j as f32 / n as f32)
                .normalize()
        };
        for i in 0..n {
            for j in 0..n - i {
                triangles.push([point(i, j), point(i + 1, j), point(i, j + 1)]);
                if i + j < n - 1 {
                    triangles.push([point(i + 1, j), point(i + 1, j + 1), point(i, j + 1)]);
                }
            }
        }
    }
    triangles
}
/// Compile and upload the shared shaders before combat can expose a first-cast hitch.
pub fn warmup() {
    GPU.with(|cell| {
        let mut cell = cell.borrow_mut();
        let gpu = cell.get_or_insert_with(Gpu::new);
        let mut frame = Frame::default();
        for kind in [
            Kind::Soft,
            Kind::Ribbon,
            Kind::Gas,
            Kind::Stone,
            Kind::Soap,
            Kind::Shaft,
            Kind::Star,
            Kind::Orb,
            Kind::Fire,
            Kind::Rings,
            Kind::BlueOrb,
            Kind::Streak,
            Kind::Shell,
        ] {
            frame.quad(
                vec2(-20., -20.),
                Vec2::ONE,
                0.,
                0xffffff,
                0.01,
                kind,
                Blend::Add,
                0.,
            );
        }
        push_camera_state();
        let mut camera = Camera2D::from_display_rect(Rect::new(0., 0., 360., 640.));
        camera.render_target = Some(gpu.target.clone());
        camera.viewport = Some(gpu.viewport());
        set_camera(&camera);
        clear_background(Color::new(0., 0., 0., 0.));
        frame.draw_batches(gpu, &mut DrawStats::default(), false);
        pop_portrait_camera();
    });
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn sampling_uses_device_framebuffer_without_changing_logical_space() {
        for (level, expected) in [(0,(195,422)),(1,(390,844)),(2,(780,1688)),(3,(1170,2532))] {
            let setting = Sampling {level,ps1:true,..Sampling::default()};
            assert_eq!(setting.size((1170,2532)), expected);
            assert!(setting.stylized());
        }
        assert_eq!(Sampling {level:3,ps1:true,..Sampling::default()}.size((2532,1170)), (2532,1170));
        assert!(!Sampling {level:3,ps1:false,..Sampling::default()}.stylized());
        assert!(Sampling {level:0,ps1:false,..Sampling::default()}.stylized());
        assert_eq!(Sampling::default().level, 3);
        for framebuffer in [(720,1280),(1640,2360),(2880,1800),(1,1)] {
            for level in 0..4 {
                let size=Sampling {level,ps1:true,..Sampling::default()}.size(framebuffer);
                assert!(size.0>0 && size.1>0);
                if level==3 { assert_eq!(size,framebuffer); }
            }
        }
    }
    #[test]
    fn sampling_viewport_matches_native_portrait_in_wide_and_tall_windows() {
        assert_eq!(portrait_viewport((1170,2532)),(0,226,1170,2080));
        assert_eq!(portrait_viewport((2880,1800)),(933,0,1013,1800));
        assert_eq!(portrait_viewport((720,1280)),(0,0,720,1280));
    }
    #[test]
    fn approved_polyhedra_have_exact_subdivision_counts() {
        assert_eq!(icosahedron(2).len(), 180);
        assert_eq!(icosahedron(1).len(), 80);
        for triangle in icosahedron(2) {
            for n in triangle {
                assert!((n.length() - 1.).abs() < 1e-6);
            }
        }
    }
    #[test]
    fn rng_high_endpoint_cannot_index_past_a_path() {
        let mut r = Rng(0);
        for _ in 0..10000 {
            let v = r.next();
            assert!((0. ..1.).contains(&v));
        }
    }
}
#[cfg(test)]
mod batch_tests {
    use super::*;
    #[test]
    fn all_thousand_motes_survive_macroquad_index_capacity() {
        let mut f = Frame::default();
        for _ in 0..1000 {
            f.quad(
                Vec2::ZERO,
                Vec2::ONE,
                0.,
                0xffffff,
                1.,
                Kind::Orb,
                Blend::Add,
                0.,
            );
        }
        assert_eq!(
            f.batches
                .iter()
                .map(|b| b.mesh.indices.len())
                .sum::<usize>(),
            6000
        );
        assert!(f
            .batches
            .iter()
            .all(|b| b.mesh.indices.len() < 5000 && b.mesh.vertices.len() < 10000));
        assert!(f.batches.len() > 1);
    }
}
