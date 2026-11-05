mod assets;
mod camera;
mod clips;
mod debug;
#[cfg(any(test, feature = "crowd-proof"))]
mod crowd_proof;
mod game;
mod input;
mod platform;
mod ui;
mod impact_stop;
mod motion;
mod qa;
mod render;
mod spotlight_camera;
#[cfg(any(test, feature = "crowd-proof"))]
mod testing;
use macroquad::prelude::*;
use wf_combat::SIM_DT;
#[cfg(target_arch = "wasm32")]
std::thread_local! {static REDUCED_MOTION:std::cell::Cell<bool>=const{std::cell::Cell::new(false)};}
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_reduced_motion(value: u32) {
    REDUCED_MOTION.with(|p| p.set(value != 0));
}
#[cfg(target_arch="wasm32")]
std::thread_local! {static ASSET_STATUS:std::cell::Cell<i32>=const{std::cell::Cell::new(0)};}
#[cfg(target_arch="wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_asset_status()->i32 {ASSET_STATUS.with(|s|s.get())}
// Read-only live probe: step, wave, sim seconds, hash low bits, live enemies, fps.
#[cfg(target_arch = "wasm32")]
std::thread_local! { static PROBE: std::cell::Cell<[f64; 9]> = const { std::cell::Cell::new([0.; 9]) }; }
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn wf_app_probe(index: u32) -> f64 {
    PROBE.with(|p| p.get().get(index as usize).copied().unwrap_or(f64::NAN))
}
fn reduced_motion() -> bool {
    #[cfg(target_arch = "wasm32")]
    {
        REDUCED_MOTION.with(|p| p.get())
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        std::env::var_os("WF_REDUCED_MOTION").is_some()
    }
}
fn conf() -> Conf {
    Conf {
        window_title: "Wishfire".into(),
        window_width: 360,
        window_height: 640,
        high_dpi: true,
        ..Default::default()
    }
}
/// Fatal boot/host errors stay on screen instead of a silent panic in the browser.
async fn fatal(portrait: &mut camera::Portrait, title: &str, error: &str) -> ! {
    loop {
        portrait.begin();
        draw_text(title, 20., 240., 24., PINK);
        for (i, chunk) in error.as_bytes().chunks(44).enumerate() {
            draw_text(&String::from_utf8_lossy(chunk), 12., 270. + i as f32 * 18., 13., WHITE);
        }
        portrait.present();
        next_frame().await;
    }
}
fn warm_text() {
    // Allocate glyphs before queuing text draws: atlas growth can invalidate queued textures.
    for size in [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24] {
        measure_text(
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ×!?:;.,/+-_=()|~<>%^#'\"*",
            None,
            size,
            1.,
        );
    }
}
struct Scene {
    game: game::Game,
    camera: camera::WorldCamera,
    presentation: render::vfx::Presentation,
    corpses: render::actors::Corpses,
    warcry_shell: render::enemy_status::WarcryShell,
    cast_hue: render::cast_hue::CastHue,
    poison_tint: render::poison::PoisonTint,
    crowd_buffer: render::crowd::CrowdBuffer,
    cast_glows: render::groove::CastGlows,
    heal_auras: render::healing::TargetAuras,
    motion: motion::Motion,
    spotlight: render::spotlight::Spotlight,
    cinematic_camera: spotlight_camera::SpotlightCamera,
    phoenix: render::phoenix::PhoenixTouch,
    revival: render::phoenix::Revival,
    impact_stop: impact_stop::ImpactStop,
    interaction_camera: camera::WorldCamera,
}
impl Scene {
    fn new(rows: Vec<wf_meta::enemy::RawRow>, seed: Option<u32>) -> Result<Self, String> {
        let mut game = game::Game::new(rows, seed);
        // One host frame creates the first encounter so the client has a snapshot to frame.
        // Skill Spotlight: the sim freezes combat around a featured special; default preset.
        game.session.spotlight = wf_combat::SpotlightConfig::DEFAULT;
        game.tick(platform::now_ms());
        if let Some(error) = &game.session.failed { return Err(error.clone()); }
        let snapshot = game.snapshot().cloned().ok_or("combat host produced no snapshot")?;
        let camera = camera::WorldCamera::new(&snapshot);
        let motion = motion::Motion::new(&snapshot);
        Ok(Self {
            interaction_camera: camera.clone(),
            camera,
            motion,
            game,
            presentation: Default::default(),
            corpses: Default::default(),
            warcry_shell: Default::default(),
            cast_hue: Default::default(),
            poison_tint: Default::default(),
            crowd_buffer: Default::default(),
            cast_glows: Default::default(),
            heal_auras: Default::default(),
            spotlight: Default::default(),
            cinematic_camera: Default::default(),
            phoenix: Default::default(),
            revival: Default::default(),
            impact_stop: Default::default(),
        })
    }
}
#[macroquad::main(conf)]
async fn main() {
    warm_text();
    let mut portrait = camera::Portrait::new();
    portrait.begin();
    draw_text("Loading Wishfire...", 54., 310., 24., WHITE);
    portrait.present();
    next_frame().await;
    let assets = match assets::Assets::load().await {
        Ok(assets) => {
            #[cfg(target_arch="wasm32")]ASSET_STATUS.with(|s|s.set(1));
            assets
        },
        Err(error) => {
            #[cfg(target_arch="wasm32")]ASSET_STATUS.with(|s|s.set(-1));
            loop {
            portrait.begin();
            draw_text("Asset load failed", 20., 240., 24., PINK);
            for (i, chunk) in error.as_bytes().chunks(44).enumerate() {
                draw_text(
                    &String::from_utf8_lossy(chunk),
                    12.,
                    270. + i as f32 * 18.,
                    13.,
                    WHITE,
                );
            }
            draw_text("Run tools/build_wf_app.sh", 12., 440., 16., WHITE);
            portrait.present();
            next_frame().await;
            }
        },
    };
    warm_text();
    render::vfx3d::warmup();
    let rows = match game::load_enemy_rows().await { Ok(rows) => rows, Err(error) => fatal(&mut portrait, "Enemy data failed", &error).await };
    let mut controls = input::Controls::new();
    let mut ui = ui::Ui::new();
    if qa::enabled() { controls.seed = qa::seed(); }
    let boot_seed = if qa::enabled() { Some(controls.seed as u32) } else { None };
    let mut scene = match Scene::new(rows.clone(), boot_seed) { Ok(scene) => scene, Err(error) => fatal(&mut portrait, "Combat host failed", &error).await };
    ui.boot(qa::enabled());
    loop {
        // combatEntryTransition: at the hold's end the fresh combat session replaces the scene.
        if ui.story.transition_tick(platform::now_ms()) {
            scene.game.session.dispose();
            scene = match Scene::new(rows.clone(), boot_seed) { Ok(scene) => scene, Err(error) => fatal(&mut portrait, "Combat host failed", &error).await };
            ui.screen = ui::Screen::Combat;
        }
        portrait.resize();
        render::vfx3d::sampling_controls();
        let click = is_mouse_button_pressed(MouseButton::Left).then(|| portrait.pointer()).flatten();
        // Page-element clicks (menus, nav) arrive between frames; the canvas owns the rest.
        let web_action = ui.web_clicks(&mut scene.game);
        // Dev Tooling Modal requests: the clock controls go to `controls`; a level preset or
        // RESET GAME changes the saves and the session is rebuilt from them.
        for hit in ui.dev.take() {
            use ui::dev::DevHit as D;
            match hit {
                D::Level(level) => match scene.game.dev_level(level) {
                    Ok(()) => {
                        scene.game.session.dispose();
                        scene = match Scene::new(rows.clone(), boot_seed) { Ok(scene) => scene, Err(error) => fatal(&mut portrait, "Combat host failed", &error).await };
                        ui.dev.status = format!("All heroes set to Lv. {level} with EXP 0 and matching skills.");
                    }
                    Err(error) => ui.dev.status = error,
                },
                D::ResetGame => match game::reset_saves() {
                    Ok(_) => {
                        scene.game.session.dispose();
                        scene = match Scene::new(rows.clone(), boot_seed) { Ok(scene) => scene, Err(error) => fatal(&mut portrait, "Combat host failed", &error).await };
                        ui = ui::Ui::new();
                        ui.boot(qa::enabled());
                    }
                    Err(error) => ui.dev.status = error,
                },
                other => controls.dev(other),
            }
        }
        ui.dev.state = ui::dev::DevState { paused: controls.paused, speed: controls.speed as u8, spotlight: controls.spotlight_label(), diagnostics: controls.debug };
        // Meta screens: combat pauses underneath (storyEntryFlow.navigate departure).
        if !ui.in_combat() {
            // Dev scenario key: L opens the quest ladder from the map (JS storyEntry.skip() first step).
            if is_key_pressed(KeyCode::L) { ui.story.dev_ladder(); }
            if let Some(p) = click { ui.tap(p, &mut scene.game); }
            ui.lamp.frame(&mut scene.game, false, 0.);
            scene.game.session.pause();
            portrait.begin();
            ui.draw_screen(&assets);
            ui.web(&mut scene.game);
            portrait.present();
            next_frame().await;
            continue;
        }
        let ui_action = click.and_then(|p| ui.tap(p, &mut scene.game)).or(web_action);
        // The strip's conveyor clock, arrivals and timed emissions run while the combat screen shows.
        scene.game.session.bag_blocked = ui.blocks_bag_progress();
        let bag_visible = !ui.pauses() && ui.panel.is_none() && !ui.story.pending();
        ui.lamp.frame(&mut scene.game, bag_visible, if controls.paused { 0. } else { get_frame_time().min(0.0625) });
        if ui_action == Some(ui::UiAction::SummonBoss) {
            if let Err(error) = scene.game.session.summon_boss(platform::now_ms()) { fatal(&mut portrait, "Combat host failed", &error).await; }
        }
        let action = controls.read();
        if action.restart {
            scene.game.restart(Some(controls.seed as u32));
            scene = match Scene::new(rows.clone(), Some(controls.seed as u32)) { Ok(scene) => scene, Err(error) => fatal(&mut portrait, "Combat host failed", &error).await };
        }
        let dt = if action.step {
            SIM_DT
        } else if controls.paused {
            0.
        } else {
            get_frame_time().min(0.0625) * controls.speed
        };
        let Scene { game, camera, presentation, corpses, warcry_shell, cast_hue, poison_tint, crowd_buffer, cast_glows, heal_auras,
            motion, spotlight, cinematic_camera, phoenix, revival, impact_stop, interaction_camera } = &mut scene;
        if action.spotlight_changed { game.session.set_spotlight(controls.spotlight_config()); }
        let previous_snapshot = game.snapshot().cloned().unwrap_or_else(|| motion.previous.clone());
        let _hold = phoenix.read(&portrait, &previous_snapshot, interaction_camera); // Phoenix is autonomous in WFM encounters.
        let event_previous = motion.presentation(&previous_snapshot);
        let start = get_time();
        // Host pacing: the fixed-step debt uses wall time scaled by the dev speed; pause stops it.
        game.session.dev_speed = controls.speed as f64;
        if action.summon_boss {
            if let Err(error) = game.session.summon_boss(platform::now_ms()) { fatal(&mut portrait, "Combat host failed", &error).await; }
        }
        // A chrome panel pauses combat like the JS hero/party-skill surfaces do.
        if !action.step && (controls.paused || ui.pauses()) { game.session.pause(); } else { let _ = dt; game.tick(platform::now_ms()); }
        let observations = game.drain_steps();
        let steps = observations.len() as u32;
        for (before, after) in &observations { motion.observe_step(before, after); }
        let timing = debug::Timing {
            steps,
            advance_ms: (get_time() - start) * 1000.,
        };
        let events = game.drain_events();
        let live_snapshot = game.snapshot().cloned().unwrap_or(previous_snapshot);
        // Equipment orbs: kills drop them, completed subwaves send them to a hero and into the Bag.
        ui.lamp.orbs.ingest(&events, &live_snapshot, &event_previous);
        let can_collect = !ui.pauses();
        ui.lamp.orbs.update(&mut game.economy, &mut game.session, &live_snapshot, if controls.paused { 0. } else { get_frame_time().min(0.0625) }, can_collect, &|hero| render::crowd::body_size(&assets.manifest, hero).y);
        ui.update(game, &live_snapshot);
        #[cfg(target_arch = "wasm32")]
        PROBE.with(|p| {
            let s = &live_snapshot;
            p.set([s.step as f64, game.session.stage.wave as f64, s.combat_time, (game.session.gameplay_hash().unwrap_or(0) & 0xffff_ffff) as f64,
                game.session.world().map_or(0., |w| w.live_enemies() as f64), get_fps() as f64,
                match game.session.boss_control_state() { "locked" => 0., "available" => 1., "armed" => 2., _ => 3. },
                game.session.boss_time_remaining().unwrap_or(f64::NAN), game.session.stage.cleared_bosses as f64]);
        });
        if events.iter().any(|e| matches!(e, wf_combat::Event::SceneReset | wf_combat::Event::WaveReset)) {
            *warcry_shell = Default::default();
            *poison_tint = Default::default();
            *cast_hue = Default::default();
            *motion = motion::Motion::new(&live_snapshot);
            *cast_glows = Default::default();
            *heal_auras = Default::default();
            *cinematic_camera = Default::default();
        }
        let snapshot = motion.presentation(&live_snapshot);
        cast_hue.observe(&snapshot, &events);
        cast_glows.update(&snapshot, snapshot.spotlight.as_ref().or(spotlight.director.view.as_ref()), &events);
        heal_auras.update(&snapshot, &events);
        let active_spot = snapshot.spotlight.is_some() || spotlight.director.view.is_some();
        revival.ingest(&events, &snapshot);
        impact_stop.ingest(&events, &snapshot, &event_previous, active_spot);
        camera.events(&events, &snapshot);
        spotlight.config = controls.spotlight_config();
        spotlight.warning_timings = game.session.world().map(|w| live_snapshot.hazards.iter().filter(|h| h.kind == wf_combat::HazardKind::BossSnipe)
            .filter_map(|h| w.sim().warning_timing(h.id).map(|timing| (h.id, timing))).collect()).unwrap_or_default();
        spotlight.ingest(
            &assets.manifest,
            events,
            &snapshot,
            &event_previous,
            presentation,
            corpses,
            if snapshot.hit_stop.is_some() { 0. } else { get_frame_time() as f64 },
        );
        // The spotlight ends with its attack: once the featured effects have played out and
        // settled, the sim leaves the Tail phase and combat resumes.
        if spotlight.ready(&assets.manifest, &snapshot) { game.session.release_spotlight(); }
        let mut frame = motion.snapshot(&snapshot, if controls.paused { 1. } else { game.alpha() });
        frame.time = snapshot.time;
        #[cfg(feature = "crowd-proof")]
        crowd_proof::apply(&mut frame);
        let (mut background, _) = render::spotlight::frames(&frame, spotlight.director.view.as_ref());
        presentation.displace(&mut background);
        warcry_shell.observe(&frame);
        poison_tint.observe(&frame);
        let s = &frame;
        let bg = &background;
        let bg_previous = spotlight.background_previous.as_ref().unwrap_or(bg);
        camera.update(
            s,
            if s.hit_stop.is_some() || s.spotlight.is_some() || (controls.paused && !action.step) {
                0.
            } else {
                get_frame_time().min(0.05)
            },
        );
        let mut camera = cinematic_camera.frame(camera, &assets.manifest, s, reduced_motion(), if s.hit_stop.is_none() && controls.paused && controls.spotlight == 0 { get_frame_time() } else { 0. }, controls.spotlight_config().charge);
        camera.actor_offsets = crowd_buffer.update(s, |a| render::crowd::body_size(&assets.manifest, a), get_frame_time());
        camera.offset = Vec2::ZERO;
        if !reduced_motion() {
            let (shake, clock) = if spotlight.director.view.is_some() {
                (spotlight.shake(), s.time)
            } else {
                (presentation.shake, bg.time)
            };
            if let Some((born, amplitude, duration)) = shake {
                let t = ((clock - born) as f32 / duration).clamp(0., 1.);
                camera.offset = vec2(
                    amplitude * (1. - t).powi(2) * (std::f32::consts::TAU * 3. * t).sin(),
                    amplitude * 0.3 * (1. - t).powi(2) * (std::f32::consts::TAU * 2. * t).sin(),
                );
            }
            camera.offset += if spotlight.director.view.is_some() { spotlight.pound_shake(s.time) } else { presentation.pound_shake(bg.time) };
            camera.offset.y += if spotlight.director.view.is_some() { spotlight.camera_dip(s) } else { render::pound::camera_dip(bg) };
        }
        impact_stop.apply(&mut camera, s, active_spot, reduced_motion());
        camera.hero_bodies = render::crowd::hero_boxes(&assets.manifest, &camera, s);
        #[cfg(feature = "crowd-proof")]
        if !crowd_proof::spacing_enabled() { camera.actor_offsets.clear(); camera.hero_bodies.clear(); }
        *interaction_camera = camera.clone();
        render::boss::reset_probe();
        render::vfx3d::reset_probe();
        let mut stats = assets::DrawStats::default();
        let charge_reserve = if spotlight.director.phase == render::spotlight::Phase::Charge { 32 } else { 0 };
        stats.fx_quads = charge_reserve;

        portrait.begin();
        camera.ground(&assets, bg);
        stats.calls += 2;
        presentation.ground(&assets, &camera, bg, bg_previous, &mut stats);
        corpses.update(&assets.manifest, bg);
        corpses.displace(presentation, bg.time);
        render::actors::ornaments(&assets, &camera, bg, corpses, &mut stats);
        presentation.hostile(&assets, &camera, bg, bg_previous, &mut stats);
        presentation.under_actors(&assets, &camera, bg, warcry_shell, &mut stats);
        ui.lamp.orbs.draw(&camera, false);
        let ground_bodies = spotlight.ground_bodies(s, corpses);
        let draw_chests = |stats: &mut assets::DrawStats| {
            presentation.rewards.draw_chests(&assets, &camera, bg, stats)
        };
        render::actors::draw(
            &assets,
            &camera,
            bg,
            &ground_bodies,
            &presentation.held,
            &presentation.projectiles,
            cast_glows,
            heal_auras,
            warcry_shell,
            render::elevate::Elevate::from_snapshot(s),
            poison_tint,
            cast_hue,
            render::rewards::Rewards::chest_depth(bg).map(|y| (y, &draw_chests as &dyn Fn(&mut assets::DrawStats))),
            &mut stats,
        );
        ui.lamp.orbs.draw(&camera, true);
        presentation.impacts(&assets, &camera, bg, true, reduced_motion(), &mut stats);
        presentation.labels(&assets, &camera, bg, &mut stats);
        stats.fx_quads -= charge_reserve;
        revival.effects(&assets, &camera, bg, reduced_motion(), &mut stats);
        spotlight.draw(&assets, &camera, s, reduced_motion(), revival, cast_glows, heal_auras, warcry_shell, poison_tint, cast_hue, &mut stats);
        for team in render::actors::BAR_PASSES {
            render::actors::bars(&assets, &camera, bg, corpses, &presentation.held, team, &mut stats);
            spotlight.bars(&assets, &camera, s, team, &mut stats);
        }
        render::rewards::buffs(&assets, s, &mut stats);
        ui.draw_combat(&assets, game);
        ui.web(game);
        controls.draw();
        presentation.rewards.banner(&assets, bg, &mut stats);
        stats.calls += 20;
        debug::draw(
            &assets,
            &camera,
            s,
            &controls,
            &timing,
            &spotlight.director,
            &stats,
            if controls.debug { game.session.gameplay_hash().unwrap_or(0) } else { 0 },
        );
        draw_rectangle(
            0.,
            0.,
            camera::WIDTH,
            camera::HEIGHT,
            Color::new(0., 0., 0., s.stage.fade.clamp(0., 1.)),
        );
        portrait.present();
        next_frame().await;
    }
}
