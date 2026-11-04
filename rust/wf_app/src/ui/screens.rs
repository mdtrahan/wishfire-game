//! Meta screens reached from the nav. Placeholder content until ORKA-63bf.9/.10 translate the
//! real Hero, Vault, Power Up (Training Ground) and Quests screens; the routing is the JS one
//! (`storyEntryFlow.navigate`): leaving combat pauses it, Quests shows the pause gate.
use super::chrome::{self, rgb, rgba, Align, Hit, HitKind, NAV_TOP};
use super::{CombatModel, Screen};
use crate::assets::Assets;
use crate::camera::WIDTH;
use macroquad::prelude::*;
use wf_host::session::Session;
use wf_meta::hero;

pub fn draw(assets: &Assets, screen: Screen, session: &Session, _model: &CombatModel, hits: &mut Vec<Hit>) {
    draw_rectangle(0., 0., WIDTH, NAV_TOP, rgb(0x241c17));
    let title = match screen { Screen::Hero => "Hero", Screen::Vault => "Vault", Screen::PowerUp => "Power Up", Screen::Quests => "Quests", Screen::Combat => "" };
    chrome::label(title, WIDTH / 2., 28., 20., rgb(0xfff9ed), Align::Center);
    draw_line(20., 46., WIDTH - 20., 46., 1., rgb(0xaa8960));
    match screen {
        Screen::Hero => hero_screen(assets, session),
        Screen::PowerUp => power_up(assets),
        Screen::Vault => { chrome::paragraph("The Vault (chests, tickets, equipment review) arrives with bead ORKA-63bf.9.", 24., 70., WIDTH - 48., 13., rgba(0xfff9ed, 0.8)); }
        Screen::Quests => {
            chrome::paragraph("Combat is paused. The quest map, ladder and opening narrative arrive with bead ORKA-63bf.10.", 24., 70., WIDTH - 48., 13., rgba(0xfff9ed, 0.8));
            let (bx, by, bw, bh) = ((WIDTH - 160.) / 2., 160., 160., 44.);
            draw_rectangle(bx, by, bw, bh, rgb(0x25454a));
            draw_rectangle_lines(bx, by, bw, bh, 2., rgb(0xd0a45b));
            chrome::label("Continue battle", bx + bw / 2., by + bh / 2., 14., rgb(0xfff9ed), Align::Center);
            hits.push(Hit { rect: Rect::new(bx, by, bw, bh), kind: HitKind::Continue });
        }
        Screen::Combat => {}
    }
}
fn hero_screen(assets: &Assets, session: &Session) {
    let mut y = 60.;
    for h in &session.heroes {
        let record = session.progress.heroes.get(&h.instance_key);
        draw_rectangle(12., y, WIDTH - 24., 92., rgb(0x3d2b21));
        draw_rectangle_lines(12., y, WIDTH - 24., 92., 2., rgb(0xaa8960));
        if let Some(tex) = assets.ui.get(super::model::hero_art(h.definition.key)) { chrome::portrait(tex, 20., y + 8., 76., WHITE); }
        chrome::label(&format!("{}  Lv {}", h.definition.name, h.level), 108., y + 16., 15., rgb(0xfff9ed), Align::Left);
        let exp = record.map_or(0., |r| r.current_exp);
        let to_next = record.map_or(0., |r| r.exp_to_next_level);
        // The hero screen reads the saved progression record (level stats), not combat shadow stats.
        let (hp, max_hp, stats) = record.map_or((h.hp, h.max_hp, h.stats), |r| (r.hp, r.max_hp, r.stats));
        chrome::label(&format!("HP {:.0}/{:.0}   EXP {:.0}/{:.0}", hp, max_hp, exp, to_next), 108., y + 34., 11., rgb(0xd9b88c), Align::Left);
        chrome::label(&format!("ATK {:.0}  DEF {:.0}  MAG {:.0}  RES {:.0}  SPD {:.0}", stats.atk, stats.def, stats.mag, stats.res, stats.spd), 108., y + 50., 11., rgb(0xd9b88c), Align::Left);
        let clip = |text: &str| -> String { let mut t = text.to_string(); while measure_text(&t, None, 11, 1.).width > WIDTH - 120. && t.len() > 4 { t.truncate(t.len() - 4); t.push_str("..."); } t };
        if let Some(sp) = hero::special_text(h.definition.key) { chrome::label(&clip(&format!("Special: {}  |  {}", sp.name, sp.condition)), 108., y + 68., 11., rgb(0xffd45c), Align::Left); }
        if let Some(pa) = hero::passive_text(h.definition.key) { chrome::label(&clip(&format!("Passive: {}  |  {}", pa.name, pa.condition)), 108., y + 82., 11., rgb(0xffd45c), Align::Left); }
        y += 100.;
    }
    chrome::paragraph("Full hero details, equipment and resonances arrive with bead ORKA-63bf.9.", 24., y + 6., WIDTH - 48., 11., rgba(0xfff9ed, 0.6));
}
fn power_up(assets: &Assets) {
    chrome::label("Party Skills", 24., 64., 13., rgb(0xffd45c), Align::Left);
    let mut y = 78.;
    for entry in hero::PARTY_SKILLS.iter() {
        draw_rectangle(12., y, WIDTH - 24., 64., rgb(0x3d2b21));
        draw_rectangle_lines(12., y, WIDTH - 24., 64., 1., rgb(0xaa8960));
        let mut ix = 20.;
        for icon in entry.icons { chrome::buff_icon(assets, icon, ix, y + 8., 16.); ix += 18.; }
        chrome::label(&format!("{}  |  {}", entry.name, entry.hero), 60., y + 16., 13., rgb(0xfff9ed), Align::Left);
        chrome::paragraph(entry.values.join(" / ").as_str(), 20., y + 28., WIDTH - 56., 11., rgb(0xd9b88c));
        y += 70.;
    }
    chrome::paragraph("Training Ground (stat training, star-ups, tickets) arrives with bead ORKA-63bf.9.", 24., y + 6., WIDTH - 48., 11., rgba(0xfff9ed, 0.6));
}
