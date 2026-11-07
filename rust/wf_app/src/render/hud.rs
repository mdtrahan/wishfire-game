use crate::assets::{Assets, DrawStats};
use macroquad::prelude::*;
use wf_combat::api::*;
pub fn boss_name(kind: Archetype) -> &'static str {
    match kind {
        Archetype::BossBomber => "CHIMERILASS",
        Archetype::BossMarksman => "DJINN MARKSMAN",
        _ => "TROLL BRUTE",
    }
}
pub fn bar(x: f32, y: f32, w: f32, h: f32, value: f32, color: Color) {
    draw_rectangle(x, y, w, h, Color::from_rgba(12, 19, 29, 205));
    draw_rectangle(x, y, w * value.clamp(0., 1.), h, color);
}
/// Owner: the boss bar must stay visible for testing; when the control menu covers the top
/// strip, it is redrawn just below the menu.
pub fn boss_bar_below_menu(s: &Snapshot) {
    if let Some(boss) = s
        .actors
        .iter()
        .find(|a| super::actors::is_boss(a.archetype) && a.hp > 0.)
    {
        draw_rectangle(0., 44., 324., 22., Color::from_rgba(17, 24, 36, 200));
        draw_text(boss_name(boss.archetype), 10., 56., 11., Color::from_rgba(255, 196, 160, 255));
        bar(110., 50., 200., 7., boss.hp / boss.max_hp, Color::from_rgba(244, 79, 94, 255));
        let hp = format!("{:.0}/{:.0}", boss.hp, boss.max_hp);
        draw_text(&hp, 210. - measure_text(&hp, None, 10, 1.).width / 2., 63., 10., WHITE);
    }
}
pub fn draw(assets: &Assets, s: &Snapshot, stats: &mut DrawStats) {
    draw_rectangle(0., 0., 360., 44., Color::from_rgba(17, 24, 36, 165));
    draw_text(&format!("STAGE {}", s.stage.wave), 9., 18., 14., WHITE);
    draw_text(
        &format!(
            "{:02}:{:02}",
            s.stage.elapsed as u32 / 60,
            s.stage.elapsed as u32 % 60
        ),
        272.,
        18.,
        13.,
        LIGHTGRAY,
    );
    if let Some(boss) = s
        .actors
        .iter()
        .find(|a| super::actors::is_boss(a.archetype) && a.hp > 0.)
    {
        draw_text(
            boss_name(boss.archetype),
            95.,
            17.,
            12.,
            Color::from_rgba(255, 196, 160, 255),
        );
        bar(
            10.,
            27.,
            300.,
            8.,
            boss.hp / boss.max_hp,
            Color::from_rgba(244, 79, 94, 255),
        );
        let hp = format!("{:.0}/{:.0}", boss.hp, boss.max_hp);
        draw_text(
            &hp,
            160. - measure_text(&hp, None, 10, 1.).width / 2.,
            34.,
            10.,
            WHITE,
        );
    } else {
        let label = if s.stage.phase == StagePhase::Victory {
            "CLEARED".into()
        } else {
            format!("WAVE {}/{}", s.stage.mini_wave, s.stage.mini_waves_total)
        };
        draw_text(&label, 95., 18., 12., Color::from_rgba(236, 214, 170, 255));
        for i in 0..s.stage.mini_waves_total.min(12) {
            draw_circle(
                103. + i as f32 * 15.,
                32.,
                3.,
                if i < s.stage.mini_wave {
                    Color::from_rgba(242, 209, 135, 255)
                } else {
                    Color::from_rgba(180, 185, 195, 100)
                },
            );
        }
    }
    super::rewards::buffs(assets, s, stats);
    stats.calls += if s.actors.iter().any(|a|super::actors::is_boss(a.archetype) && a.hp>0.) {7} else {4+s.stage.mini_waves_total.min(12) as u32};
}
