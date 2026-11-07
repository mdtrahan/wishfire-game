use crate::{
    assets::{Assets, DrawStats},
    camera::{WorldCamera, SQUASH},
};
use macroquad::prelude::*;
use wf_combat::api::{
    Archetype, Element, Event, HazardKind, HazardPhase, HazardView, Shape, Snapshot,
};
const DAMAGE_WINDOW: f64 = 0.75;
pub(super) const HEAL_GREEN: u32 = 0x86eb2e;
const POPUP_LIFE: f64 = 0.75;
pub struct Popup {
    combo_owner: Option<u32>,
    target: u32,
    crit: bool,
    pos: wf_combat::api::Vec2,
    text: String,
    tone: PopupTone,
    amount: f32,
    born: f64,
}
/// Wishfire damage-number kinds; each owns a top/bottom gradient stop.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum PopupTone {
    Damage,
    Heal,
    Dot,
    Miss,
    /// Any damage landing on a hero: owner-approved Salmon (2026-10-27).
    HeroHit,
    Blocked,
}
impl PopupTone {
    fn on(self, team: Option<wf_combat::Team>) -> Self {
        match (self, team) {
            (Self::Damage | Self::Dot, Some(wf_combat::Team::Hero)) => Self::HeroHit,
            _ => self,
        }
    }
    fn stops(self, crit: bool) -> (Color, Color) {
        match self {
            Self::Blocked => (Color::from_hex(0x8fd3ff), Color::from_hex(0x8fd3ff)),
            Self::Damage | Self::HeroHit | Self::Dot if crit =>
                (Color::from_hex(0xffd84a), Color::from_hex(0xffd84a)),
            Self::HeroHit => (Color::from_hex(0xff9488), Color::from_hex(0xff6458)),
            Self::Damage => (Color::from_hex(0xfbfdce), Color::from_hex(0xf7f8d4)),
            Self::Heal => (Color::from_hex(HEAL_GREEN), Color::from_hex(0x9fdfff)),
            Self::Dot => (Color::from_hex(0xe4c3ff), Color::from_hex(0x8d37ff)),
            Self::Miss => (Color::from_hex(0xa8adb4), Color::from_hex(0xa8adb4)),
        }
    }
}
/// Popup sizes at layout scale 1 (shared 360x640 stage).
fn popup_font_size(pop: &Popup, party_max_hp: f32) -> f32 {
    match pop.tone {
        PopupTone::Miss => 12.,
        _ if pop.amount < 10. => if pop.crit { 16. } else { 10.5 },
        _ if party_max_hp > 0. && pop.amount > party_max_hp * 0.5 => 18.7,
        _ => if pop.crit { 16. } else { 10.5 },
    }
}
struct ContinuousDamage {
    blocked: bool,
    kind: HazardKind,
    target: u32,
    pos: wf_combat::api::Vec2,
    amount: f32,
    born: f64,
    last: f64,
}
struct ContinuousHeal {
    target: u32,
    pos: wf_combat::api::Vec2,
    amount: f32,
    born: f64,
    last: f64,
}
struct Impact {
    combo_owner: Option<u32>,
    source: u32,
    target: u32,
    pos: wf_combat::Vec2,
    chest: f32,
    contact: Option<Vec2>,
    direction: Vec2,
    element: Element,
    crit: bool,
    born: f64,
}
/// Authoritative blast with separate fire, smoke and a bounded scorch lifetime.
struct Explosion {
    boss: bool,
    fizzmite: bool,
    pos: wf_combat::api::Vec2,
    radius: f32,
    born: f64,
}
const EXPLOSION_SECONDS: f64 = 0.55;
/// Upright painted cells use the authored (64,122) pivot. Fitting affects art only.
fn explosion_sizes(fx: &Explosion, zoom: f32, anchor: Vec2) -> (Vec2, Vec2) {
    let z = zoom / 0.5;
    let d = fx.radius * 2. * zoom;
    let d = if fx.fizzmite { d.min(160. * z) } else { d };
    let fire = (1.12 * d).min(if fx.boss { f32::INFINITY } else { 112. * z });
    let fit = |size: Vec2| {
        if !fx.fizzmite { return size; }
        // Preserve the impact anchor; shrink the whole padded quad inside the portrait.
        let room = vec2((anchor.x - 4.).min(crate::camera::WIDTH - 4. - anchor.x).max(0.) * 2.,
            ((anchor.y - 4.) / (122./128.)).min((crate::camera::HEIGHT - 4. - anchor.y) / (6./128.)).max(0.));
        size * (room.x / size.x).min(room.y / size.y).clamp(0., 1.)
    };
    (fit(Vec2::splat(fire)), fit(vec2(0.90 * d, 0.64 * d)))
}

/// Fara's Taunt: a gold-orange war-cry shockwave, a flash on every taunted enemy and a soft
/// lingering mark while they are forced onto her. Hero colours only — never hostile red.
/// Knockback (Bubble Pop, Ground Pound): a short visible slide for each shoved enemy.
struct Shove {
    combo_owner: Option<u32>,
    id: u32,
    from: wf_combat::Vec2,
    to: wf_combat::Vec2,
    born: f64,
}
const SHOVE_SECONDS: f64 = 0.2;
struct TauntMark {
    enemy: u32,
    born: f64,
}
const TAUNT_GOLD: (f32, f32, f32) = (1., 0.68, 0.22);
/// Scorch left on the sand after a blast; fades slowly so the blast leaves a trace.
const SCORCH_SECONDS: f64 = 2.2;
struct Flash {
    hazard: HazardView,
    born: f64,
}
#[derive(Default)]
pub struct Presentation {
    pub rewards: super::rewards::Rewards,
    wishfire: super::wishfire::Wishfire,
    arcane: super::arcane::ArcanePulse,
    pound: super::pound::GroundPound,
    regen: super::regen::BossRegen,
    enemy_heals: super::enemy_heal::EnemyHeals,
    boss: super::boss::BossFx,
    resurrect: super::resurrect::Resurrect,
    pub popups: Vec<Popup>,
    continuous: Vec<ContinuousDamage>,
    continuous_heals: Vec<ContinuousHeal>,
    impacts: Vec<Impact>,
    pub(crate) projectiles: super::projectiles::Projectiles,
    hazards: std::collections::BTreeMap<u32, (HazardView, f64)>,
    pub missing_hazards: u32,
    wards: Vec<(u32, f64)>,
    spawn: super::spawn::SpawnVortex,
    pub shake: Option<(f64, f32, f32)>,
    shake_owner: Option<u32>,
    pub held: Vec<(wf_combat::ActorView, f64)>,
    flashes: Vec<Flash>,
    explosions: Vec<Explosion>,
    bubble: super::bubble::BubbleFx,
    bubble_aura: super::bubble_aura::BubbleAura,
    boss_push: super::boss_push::BossPush,
    shoves: Vec<Shove>,
    taunt_marks: Vec<TauntMark>,
    boss_flashes: Vec<(u32, f64, bool)>,
}
fn family(e: Element, crit: bool) -> &'static str {
    match (e, crit) {
        (Element::Physical, false) => "hit-physical",
        (Element::Physical, true) => "crit-physical",
        (Element::Fire, false) => "hit-fire",
        (Element::Fire, true) => "crit-fire",
        (Element::Ice, false) => "hit-ice",
        (Element::Ice, true) => "crit-ice",
        (Element::Arcane, false) => "hit-arcane",
        (Element::Arcane, true) => "crit-arcane",
        (Element::Nature, false) => "hit-nature",
        (Element::Nature, true) => "crit-nature",
        (Element::Poison, false) => "faze-tick",
        (Element::Poison, true) => "crit-poison",
    }
}
fn damage_text(amount: f32, crit: bool) -> String {
    format!(
        "{:.0}{}",
        amount.round().max(1.),
        if crit { "!" } else { "" }
    )
}
fn continuous_kind(
    source: u32,
    element: Element,
    s: &Snapshot,
    previous: &Snapshot,
) -> Option<HazardKind> {
    if element != Element::Nature {
        return None;
    }
    // Frozen API: continuous ticks use Nature and their actor owner, not a hazard id.
    s.hazards
        .iter()
        .chain(previous.hazards.iter())
        .find(|h| {
            h.owner == source && matches!(h.kind, HazardKind::KajaAura | HazardKind::LizardoDrop)
        })
        .map(|h| h.kind)
        .or_else(|| {
            s.actors
                .iter()
                .chain(previous.actors.iter())
                .find(|a| a.id == source)
                .and_then(|a| match a.archetype {
                    Archetype::Marid => Some(HazardKind::KajaAura),
                    Archetype::Lizardo => Some(HazardKind::LizardoDrop),
                    _ => None,
                })
        })
}
impl Presentation {
    /// One-shot packages gate release; persistent marks and labels do not.
    fn co_kind(view:&wf_combat::SpotlightView,s:&Snapshot,kind:Archetype)->bool {
        s.actors.iter().any(|a|a.archetype==kind && a.team==wf_combat::Team::Hero && view.co_casters.contains(&a.id))
    }
    pub fn take_combo(&mut self,from:&mut Self,view:&wf_combat::SpotlightView,s:&Snapshot,from_time:f64,to_time:f64) -> Vec<(u32,f64)> {
        let delta=to_time-from_time;
        let owns=|owner:Option<u32>|owner.is_some_and(|id|view.co_casters.contains(&id));
        let hits:Vec<_>=from.impacts.iter().filter(|x|owns(x.combo_owner)).map(|x|(x.target,x.born)).collect();
        let reactions=hits.iter().copied().chain(from.wishfire.owned.iter()
            .filter(|(owner,_)|view.co_casters.contains(owner) && s.actors.iter().any(|a|a.id==*owner && a.archetype==Archetype::Hondo))
            .map(|(owner,target)|(*target,from.reaction_time(*owner,*target,from_time).unwrap_or(from_time))))
            .map(|(target,born)|(target,born+delta)).collect();
        self.boss_push.take_combo(&mut from.boss_push,&hits,delta);
        super::spotlight::transfer(&mut from.impacts,&mut self.impacts, |x|owns(x.combo_owner),|x|x.born+=delta);
        super::spotlight::transfer(&mut from.popups,&mut self.popups, |x|owns(x.combo_owner),|x|x.born+=delta);
        super::spotlight::transfer(&mut from.shoves,&mut self.shoves, |x|owns(x.combo_owner),|x|x.born+=delta);
        if Self::co_kind(view,s,Archetype::Kaja) {self.arcane.take_combo(&mut from.arcane,delta);}
        if Self::co_kind(view,s,Archetype::Runa) {self.bubble.take_combo(&mut from.bubble,delta);}
        if Self::co_kind(view,s,Archetype::Fara) {self.pound.take_combo(&mut from.pound,delta);}
        if Self::co_kind(view,s,Archetype::Hondo) {self.wishfire.take_combo(&mut from.wishfire,delta);}
        self.projectiles.take_combo(&mut from.projectiles,view,delta);
        if owns(from.shake_owner) {self.shake=from.shake.take().map(|(born,power,life)|(born+delta,power,life));self.shake_owner=from.shake_owner.take();}
        reactions
    }
    pub fn pause_combo(&mut self,view:&wf_combat::SpotlightView,s:&Snapshot,delta:f64) {
        for x in &mut self.impacts {if x.combo_owner.is_some_and(|id|view.co_casters.contains(&id)) {x.born+=delta;}}
        for x in &mut self.popups {if x.combo_owner.is_some_and(|id|view.co_casters.contains(&id)) {x.born+=delta;}}
        for x in &mut self.shoves {if x.combo_owner.is_some_and(|id|view.co_casters.contains(&id)) {x.born+=delta;}}
        if Self::co_kind(view,s,Archetype::Kaja) {self.arcane.shift(delta);}
        if Self::co_kind(view,s,Archetype::Runa) {self.bubble.shift(delta);}
        if Self::co_kind(view,s,Archetype::Fara) {self.pound.shift(delta);}
        if Self::co_kind(view,s,Archetype::Hondo) {self.wishfire.shift_combo(delta);}
        self.boss_push.pause_combo(delta);
        self.projectiles.pause_combo(view,delta);
        if self.shake_owner.is_some_and(|id|view.co_casters.contains(&id)) {if let Some((born,_,_))=&mut self.shake {*born+=delta;}}
    }
    pub fn busy(&self, time: f64) -> bool {
        self.impacts
            .iter()
            .any(|x| time - x.born < if x.crit { 0.22 } else { 0.18 })
            || self.flashes.iter().any(|x| time - x.born < 0.08)
            || self
                .explosions
                .iter()
                .any(|x| time - x.born < EXPLOSION_SECONDS)
            || self.bubble.busy(time)
            || self.bubble_aura.busy(time)
            || self.boss_push.busy(time)
            || self.shoves.iter().any(|x| time - x.born < SHOVE_SECONDS)
            || self.wards.iter().any(|(_, born)| time - born < 0.25)
            || self.spawn.busy(time)
            || self.pound.busy(time)
            || self.regen.busy(time)
            || self.enemy_heals.busy(time)
            || self.arcane.busy(time)
            || self.wishfire.busy(time)
            || self.resurrect.busy(time)
            || self.projectiles.busy(time)
    }
    pub fn idle(&self, time: f64) -> bool {
        !self.busy(time)
            && self.popups.iter().all(|x| time - x.born >= POPUP_LIFE)
            && self
                .explosions
                .iter()
                .all(|x| time - x.born >= SCORCH_SECONDS)
            && self.taunt_marks.is_empty()
            && self.held.iter().all(|(_, until)| time >= *until)
    }

    fn popup(&mut self, popup: Popup) {
        if self
            .popups
            .iter()
            .filter(|p| p.target == popup.target)
            .count()
            >= 3
        {
            if let Some(index) = self.popups.iter().position(|p| p.target == popup.target) {
                self.popups.remove(index);
            }
        }
        self.popups.push(popup);
    }
    fn damage(&mut self, target: u32, pos: wf_combat::api::Vec2, amount: f32, crit: bool, blocked: bool, time: f64, combo_owner: Option<u32>) {
        if amount <= 0. {
            return;
        }
        self.popup(Popup {
            combo_owner,
            target,
            crit,
            pos,
            text: damage_text(amount, crit),
            tone: if blocked { PopupTone::Blocked } else { PopupTone::Damage },
            amount,
            born: time,
        });
    }
    fn continuous_damage(
        &mut self,
        kind: HazardKind,
        target: u32,
        pos: wf_combat::api::Vec2,
        amount: f32,
        blocked: bool,
        time: f64,
    ) {
        if amount <= 0. {
            return;
        }
        if let Some(bucket) = self
            .continuous
            .iter_mut()
            .find(|p| p.kind == kind && p.target == target)
        {
            bucket.amount += amount;
            bucket.blocked |= blocked;
            bucket.pos = pos;
            bucket.last = time;
        } else {
            self.continuous.push(ContinuousDamage {
                blocked,
                kind,
                target,
                pos,
                amount,
                born: time,
                last: time,
            });
        }
    }
    fn flush_continuous(&mut self, time: f64, s: &Snapshot) {
        let mut i = 0;
        while i < self.continuous.len() {
            let bucket = &self.continuous[i];
            if time - bucket.born >= DAMAGE_WINDOW
                || time - bucket.last >= 0.2
                || !s.actors.iter().any(|a| a.id == bucket.target && a.hp > 0.)
            {
                let bucket = self.continuous.remove(i);
                self.damage(bucket.target, bucket.pos, bucket.amount, false, bucket.blocked, time, None);
            } else {
                i += 1;
            }
        }
    }
    fn heal(&mut self, target: u32, pos: wf_combat::api::Vec2, amount: f32, time: f64) {
        if amount < 1. {
            return;
        }
        self.popup(Popup {
            combo_owner: None,
            target,
            crit: false,
            pos,
            text: format!("+{amount:.0}"),
            tone: PopupTone::Heal,
            amount,
            born: time,
        });
    }
    fn continuous_heal(&mut self, target: u32, pos: wf_combat::api::Vec2, amount: f32, time: f64) {
        if let Some(bucket) = self.continuous_heals.iter_mut().find(|p| p.target == target) {
            bucket.amount += amount;
            bucket.pos = pos;
            bucket.last = time;
        } else {
            self.continuous_heals.push(ContinuousHeal {
                target, pos, amount, born: time, last: time,
            });
        }
    }
    fn flush_heals(&mut self, time: f64, s: &Snapshot) {
        let mut i = 0;
        while i < self.continuous_heals.len() {
            let bucket = &self.continuous_heals[i];
            if time - bucket.born >= DAMAGE_WINDOW
                || time - bucket.last >= 0.2
                || !s.actors.iter().any(|a| a.id == bucket.target && a.hp > 0.)
            {
                let bucket = self.continuous_heals.remove(i);
                self.heal(bucket.target, bucket.pos, bucket.amount, time);
            } else {
                i += 1;
            }
        }
    }
    pub fn ingest(&mut self, events: Vec<Event>, s: &Snapshot, previous: &Snapshot) {
        self.ingest_context(events, s, previous, s, previous, None);
    }
    pub fn ingest_context(&mut self, events: Vec<Event>, s: &Snapshot, previous: &Snapshot, context: &Snapshot, old_context: &Snapshot, manifest: Option<&crate::assets::Manifest>) {
        let events =
            if let Some(reset) = events.iter().rposition(|e| matches!(e, Event::SceneReset)) {
                *self = Self::default();
                events.into_iter().skip(reset + 1).collect()
            } else {
                events
            };
        // Event records need the full actor/hazard context even when their draw layer is filtered.
        let mut event_frame=context.clone();event_frame.time=s.time;
        let mut event_previous=old_context.clone();event_previous.time=previous.time;
        for h in old_context.hazards.iter().chain(context.hazards.iter()) {
            self.hazards.insert(h.id, (h.clone(), s.time));
        }
        self.hazards.retain(|_, (_, seen)| s.time - *seen < 0.3);
        let cancellations:Vec<_>=events.iter().filter_map(|e|if let Event::HazardCancelled{id,..}=e {Some(*id)}else{None}).collect();
        self.flashes.retain(|f|!cancellations.contains(&f.hazard.id));
        let hazards=&self.hazards;
        self.boss_push.ingest(&events,s,previous,|id|hazards.get(&id).map(|(h,_)|h.clone()));
        self.wishfire.ingest(&events, &event_frame, &event_previous);
        self.arcane.ingest(&events, &event_frame, &event_previous);
        self.pound.ingest(&events, &event_frame, &event_previous);
        self.regen.ingest(&events, s);
        self.enemy_heals.ingest(&events, &event_frame);
        self.boss.ingest(&events,s,previous,context,old_context);
        self.bubble_aura.ingest(&events, s, previous);
        self.spawn.ingest(s.time, &s.hazards);
        let hazards = &self.hazards;
        self.bubble.ingest(&events, &event_frame, &event_previous, |id| {
            hazards.get(&id).map(|(h, _)| (h.origin, h.shape))
        });
        self.projectiles.ingest_context(&events, s, previous, context, old_context, manifest);
        self.held.retain(|(_, until)| s.time < *until);
        if let Some((source, _, born)) = self.wishfire.strike {
            self.shake = Some((born, 1.5, 0.09));self.shake_owner=Some(source);
        }
        self.wards.retain(|(_, born)| s.time - *born < 0.25);
        self.popups
            .retain(|x| s.time - x.born < if x.text == "Miss" { 0.65 } else { POPUP_LIFE });
        self.boss_flashes
            .retain(|(_, born, rage)| s.time - born < if *rage { 0.48 } else { 0.22 });
        for a in &s.actors {
            if super::actors::is_boss(a.archetype)
                && a.hp > 0.
                && a.energy >= 1.
                && previous
                    .actors
                    .iter()
                    .any(|p| p.id == a.id && p.energy < 1.)
            {
                self.boss_flashes.push((a.id, s.time, false));
            }
        }
        let pos = |id| {
            context.actors
                .iter()
                .chain(old_context.actors.iter())
                .find(|a| a.id == id)
                .map(|a| a.pos)
        };
        let mut special_hits:Vec<_>=self.wishfire.owned.iter()
            .filter(|(owner,_)|context.actors.iter().any(|a|a.id==*owner && a.archetype==Archetype::Hondo))
            .map(|(a,b)|(*a,*b,Element::Physical)).collect();
        for event in &events {
            if let Event::HazardResolved{id,kind,victims}=event {
                let element=match kind {HazardKind::GroundPound=>Some(Element::Physical),
                    HazardKind::BubblePop|HazardKind::ArcanePulse=>Some(Element::Arcane),_=>None};
                if let (Some(element),Some((h,_)))=(element,self.hazards.get(id)) {
                    special_hits.extend(victims.iter().map(|target|(h.owner,*target,element)));
                }
            }
        }
        self.rewards.observe(&event_frame, &event_previous);
        for event in &events {
            self.rewards.ingest(event, s, previous);
            self.resurrect.ingest(event, s, previous);
            match *event {
                Event::WaveReset | Event::StageCleared => *self = Self::default(),
                Event::HazardResolved {
                    id,
                    kind: kind @ (HazardKind::BubblePop | HazardKind::GroundPound),
                    ref victims,
                } => {
                    let _ = (id, kind);
                    for &victim in victims {
                        let resisted=events.iter().any(|e|matches!(e,Event::KnockbackResisted{id} if *id==victim));
                        let pushed=events.iter().any(|e|matches!(e,Event::BossStaggered{id,..} if *id==victim));
                        if resisted && !pushed {continue;}
                        let from = previous.actors.iter().find(|a| a.id == victim);
                        let to = s.actors.iter().find(|a| a.id == victim);
                        if let (Some(from), Some(to)) = (from, to) {
                            if from.pos==to.pos {continue;}
                            self.shoves.retain(|x| x.id != victim);
                            self.shoves.push(Shove {
                                combo_owner: self.hazards.get(&id).map(|(h,_)|h.owner),
                                id: victim,
                                from: from.pos,
                                to: to.pos,
                                born: s.time,
                            });
                        }
                    }
                }
                Event::ReviveBurst { pos, radius, .. } => {
                    for to in &s.actors {
                        if to.team!=wf_combat::Team::Enemy || to.hp<=0. {continue;}
                        let Some(from)=previous.actors.iter().find(|a|a.id==to.id)else{continue;};
                        let delta=from.pos-pos;
                        if from.pos==to.pos || delta.x*delta.x+delta.y*delta.y>(radius+from.radius).powi(2) {continue;}
                        if events.iter().any(|e|matches!(e,Event::KnockbackResisted{id} if *id==to.id)) {continue;}
                        self.shoves.retain(|x|x.id!=to.id);
                        self.shoves.push(Shove{combo_owner:None,id:to.id,from:from.pos,to:to.pos,born:s.time});
                    }
                }
                Event::Taunt { ref enemies, .. } => {
                    // Refresh the impact flash; snapshot state alone owns mark lifetime.
                    for mark in &mut self.taunt_marks {
                        if enemies.contains(&mark.enemy) { mark.born = s.time; }
                    }
                }
                // Enrage is witnessed, not read: a roar flash plus a lasting red aura.
                Event::Enraged { id } => {
                    self.boss_flashes.push((id, s.time, true));
                    self.shake = Some((s.time, 2., 0.12));self.shake_owner=None;
                }
                Event::WardGained { target, amount } if amount > 0. => {
                    if !s.actors.iter().any(|a|a.id==target && super::enemy_status::warcry(a))
                        && !self.wards.iter().any(|(id, _)| *id == target) {
                        self.wards.push((target, s.time));
                    }
                }
                Event::Hit {
                    source,
                    target,
                    amount,
                    crit,
                    element,
                    blocked,
                } => {
                    if let Some(pos) = pos(target) {
                        if let Some(kind) =
                            continuous_kind(source, element, s, previous).filter(|_| !crit)
                        {
                            self.continuous_damage(kind, target, pos, amount, blocked, s.time);
                        } else {
                            let born=self.reaction_time(source,target,s.time).unwrap_or(s.time);
                            self.damage(target, pos, amount, crit, blocked, born, special_hits.contains(&(source,target,element)).then_some(source));
                        }
                        if element == Element::Poison && amount > 0. && !blocked {
                            if let Some(popup) = self.popups.last_mut() {
                                popup.tone = PopupTone::Dot;
                            }
                        }
                        if self.wishfire.owned.contains(&(source, target)) {
                            continue;
                        }
                        if amount > 0. {
                            let old = self.impacts.iter_mut().find(|fx| {
                                fx.source == source
                                    && fx.target == target
                                    && fx.element == element
                                    && s.time - fx.born < 0.08
                            });
                            if let Some(fx) = old {
                                if crit && !fx.crit {
                                    fx.crit = true;
                                    fx.born = self.projectiles.arrival(source,s.time,element).unwrap_or(s.time);
                                }
                            } else {
                                let target_actor = context
                                    .actors
                                    .iter()
                                    .chain(old_context.actors.iter())
                                    .find(|a| a.id == target);
                                let source_pos = context
                                    .actors
                                    .iter()
                                    .chain(old_context.actors.iter())
                                    .find(|a| a.id == source)
                                    .map(|a| a.pos)
                                    .unwrap_or(pos);
                                let direction =
                                    vec2(source_pos.x - pos.x, (source_pos.y - pos.y) * SQUASH)
                                        .normalize_or_zero();
                                self.impacts.push(Impact {
                                    combo_owner: special_hits.contains(&(source,target,element)).then_some(source),
                                    source,
                                    target,
                                    pos,
                                    chest: target_actor.map(super::wishfire::chest).unwrap_or(42.),
                                    contact: target_actor.filter(|a| a.archetype == Archetype::Mirewing
                                        || self.projectiles.arrival(source,s.time,element).is_some())
                                        .map(|a|super::projectiles::body_contact(manifest,a)),
                                    direction,
                                    element,
                                    crit,
                                    born: self.projectiles.arrival(source,s.time,element).unwrap_or(s.time),
                                });
                            }
                        }
                    }
                }
                Event::Evaded { source, target } => {
                    if let Some(pos) = pos(target) {
                        self.popup(Popup {
                            combo_owner: None,
                            target,
                            crit: false,
                            pos,
                            text: "Miss".into(),
                            tone: PopupTone::Miss,
                            amount: 0.,
                            born: self.reaction_time(source,target,s.time).unwrap_or(s.time),
                        });
                    }
                }
                Event::Healed { target, amount, .. } if amount > 0. => {
                    if let Some(pos) = pos(target) {
                        if amount < 1. {
                            self.continuous_heal(target, pos, amount, s.time);
                        } else {
                            self.heal(target, pos, amount, s.time);
                        }
                    }
                }
                Event::HazardResolved { id, kind, .. } => {
                    if cancellations.contains(&id) {continue;}
                    if matches!(
                        kind,
                        HazardKind::ArcanePulse
                            | HazardKind::BossSnipe
                            | HazardKind::BossCharge
                            | HazardKind::GroundPound
                            | HazardKind::FazePool
                            | HazardKind::HealingSpring
                            | HazardKind::KajaAura
                            | HazardKind::BubbleAura
                            | HazardKind::WardRing
                            | HazardKind::ElevateRing
                            | HazardKind::Resurrect
                            | HazardKind::SpawnMarker
                    ) {
                        continue;
                    }
                    if let Some((h, _)) = self.hazards.get(&id) {
                        if let (
                            HazardKind::LizardoDrop | HazardKind::FizzmiteBlast,
                            Shape::Circle { radius },
                        ) = (h.kind, h.shape)
                        {
                            let boss = h.kind == HazardKind::FizzmiteBlast
                                || s.actors.iter().chain(previous.actors.iter()).any(|a| {
                                    a.id == h.owner && super::actors::is_boss(a.archetype)
                                });
                            self.explosions.push(Explosion {
                                boss,
                                fizzmite: h.kind == HazardKind::FizzmiteBlast,
                                pos: h.origin,
                                radius,
                                born: s.time,
                            });
                            if boss {
                                self.shake = Some((s.time, 2., 0.12));self.shake_owner=None;
                            }
                        }
                        let mut hazard = h.clone();
                        hazard.phase = HazardPhase::Resolved;
                        hazard.progress = 1.;
                        self.flashes.push(Flash {
                            hazard,
                            born: s.time,
                        });
                    } else {
                        self.missing_hazards += 1;
                    }
                }
                _ => {}
            }
        }
        self.flush_continuous(s.time, s);
        self.flush_heals(s.time, s);
        self.impacts
            .retain(|x| s.time - x.born < if x.crit { 0.22 } else { 0.18 });
        self.flashes.retain(|x| s.time - x.born < 0.08);
        if self.impacts.len() > 16 {
            self.impacts.sort_by_key(|x| x.crit);
            self.impacts.drain(..self.impacts.len() - 16);
        }
        if self.explosions.len() > 8 {
            self.explosions.drain(..self.explosions.len() - 8);
        }
        if self.wards.len() > 4 {
            self.wards.drain(..self.wards.len() - 4);
        }
        while self.records() > 48 {
            if let Some(i) = self
                .explosions
                .iter()
                .position(|x| s.time - x.born > EXPLOSION_SECONDS)
            {
                self.explosions.remove(i);
            } else if self.rewards.drop_decoration() {
            } else if let Some(i) = self.impacts.iter().position(|x| !x.crit) {
                self.impacts.remove(i);
            } else {
                break;
            }
        }
        self.explosions.retain(|x| s.time - x.born < SCORCH_SECONDS);
        self.shoves.retain(|x| s.time - x.born < SHOVE_SECONDS);
        self.taunt_marks.retain(|m| s.actors.iter().any(|a|
            a.id == m.enemy && a.hp > 0. && a.taunted_by.is_some()));
        for a in s.actors.iter().filter(|a| a.hp > 0. && a.taunted_by.is_some()) {
            if !self.taunt_marks.iter().any(|m| m.enemy == a.id) {
                self.taunt_marks.push(TauntMark { enemy: a.id, born: s.time });
            }
        }
    }
    #[cfg(target_arch = "wasm32")]
    pub fn pound_active(&self, time: f64) -> f32 { self.pound.probe(time)[0] }
    #[cfg(target_arch = "wasm32")]
    pub fn pound_age(&self,time:f64)->f32 {self.pound.probe(time)[1]}
    #[cfg(target_arch = "wasm32")]
    pub fn bubble_age(&self,time:f64)->f32 {self.bubble.pop_age(time)}
    #[cfg(target_arch = "wasm32")]
    pub fn split_active(&self, time: f64) -> f32 { self.wishfire.active(time, "split-slash") }
    #[cfg(target_arch = "wasm32")]
    pub fn split_facing(&self,time:f64)->f32 {self.wishfire.active(time,"split-facing")}
    #[cfg(target_arch = "wasm32")]
    pub fn shadow_active(&self,time:f64)->f32 {self.wishfire.active(time,"shadow")}
    #[cfg(target_arch = "wasm32")]
    pub fn arcane_probe(&self, s: &Snapshot) -> [f32; 4] { self.arcane.probe(s) }
    #[cfg(target_arch="wasm32")]
    fn body_flash_age(&self,_time:f64)->f32 {-1.}
    pub fn records(&self) -> usize {
        self.impacts.len()
            + self.explosions.len()
            + self.flashes.len()
            + self.boss_flashes.len()
            + self.wards.len()
            + self.spawn.records()
            + self.enemy_heals.records()
            + self.wishfire.records()
            + self.projectiles.records()
            + self.rewards.records()
            + self.resurrect.records()
            + self.arcane.records()
            + self.pound.records()
    }
    #[cfg(target_arch="wasm32")]
    pub fn enemy_heal_record(&self, assets:&Assets, camera:&WorldCamera, s:&Snapshot) { self.enemy_heals.record(assets,camera,s); }
    #[cfg(target_arch="wasm32")]
    pub fn spawn_record(&self, camera:&WorldCamera, time:f64) { self.spawn.record(camera,time); }
    #[cfg(target_arch = "wasm32")]
    pub fn record(&self, s: &Snapshot) {
        #[cfg(target_arch = "wasm32")]
        SKILL_PROBE.with(|p| {
            p.set([
                self.wishfire.active(s.time, "healing"),
                self.wishfire.active(s.time, "split-slash"),
                self.wishfire.active(s.time, "faze-tick"),
                s.hazards
                    .iter()
                    .filter(|h| h.kind == HazardKind::FazePool)
                    .count() as f32,
                self.popups.len() as f32,
                self.popups
                    .iter()
                    .filter(|p| p.tone == PopupTone::Dot)
                    .count() as f32,
                s.time as f32,
                self.wishfire.active(s.time, "shadow"),
                self.explosions
                    .iter()
                    .filter(|x| s.time - x.born >= 0.04 && s.time - x.born < 0.25)
                    .count() as f32,
                self.boss_flashes
                    .iter()
                    .filter(|(_, _, rage)| *rage)
                    .count() as f32,
                self.missing_hazards as f32,
                self.records() as f32,
                self.body_flash_age(s.time),
            ])
        });
    }
    pub fn pound_shake(&self,time:f64)->Vec2 {self.pound.shake(time)}
    pub fn ground(
        &self,
        assets: &Assets,
        camera: &WorldCamera,
        s: &Snapshot,
        _previous: &Snapshot,
        stats: &mut DrawStats,
    ) {
        for fx in &self.explosions {
            let t = (s.time - fx.born) as f32;
            if t < 0.07 {
                continue;
            }
            let d = fx.radius * 2. * camera.zoom;
            assets.vfx_frame(
                "scorch",
                0,
                camera.project(fx.pos),
                vec2(d, d * SQUASH) * 0.85,
                0.,
                Color::new(
                    75. / 255.,
                    52. / 255.,
                    38. / 255.,
                    0.30 * if t < 0.4 {
                        1.
                    } else {
                        (1. - (t - 0.4) / 1.8).max(0.)
                    },
                ),
                stats,
            );
        }
        super::hazards::ground(assets, camera, s, stats);
        self.projectiles.ground(assets, camera, s, stats);
        self.spawn.draw(assets, camera, s.time, stats);
        self.resurrect.ground(assets, camera, s, stats);
        self.arcane.ground(assets, camera, s, stats);
        self.pound.ground(assets, camera, s, stats);
    }
    pub fn hostile(
        &self,
        assets: &Assets,
        camera: &WorldCamera,
        s: &Snapshot,
        previous: &Snapshot,
        stats: &mut DrawStats,
    ) {
        let flashes: Vec<_> = self
            .flashes
            .iter()
            .map(|f| (&f.hazard, (1. - (s.time - f.born) / 0.08).max(0.) as f32))
            .collect();
        super::hazards::draw(assets, camera, s, previous, &flashes, &self.boss_push.cancellations(s.time), stats);
    }
    /// Ground objects that characters stand in front of (chests).
    pub fn under_actors(&self, assets: &Assets, camera: &WorldCamera, s: &Snapshot, shell: &super::enemy_status::WarcryShell, stats: &mut DrawStats) {
        super::enemy_status::under_actors(assets,camera,s,shell,stats);
        self.rewards.draw(assets, camera, s, stats);
        self.wishfire.spring_landing(assets,camera,s,stats);
    }
    /// Everything that must read on top of telegraphs and characters: non-bomb projectiles,
    /// skill effects (e.g. Hondo's Shadow impact), hit sparks, blasts, auras.
    /// The sim shoves Bubble Pop victims in one step; show the push as a quick eased slide.
    pub fn displace_actor(&self, actor: &mut wf_combat::ActorView, time: f64) {
        if let Some(shove) = self.shoves.iter().find(|x| x.id == actor.id) {
            let t = (((time - shove.born) / SHOVE_SECONDS) as f32).clamp(0., 1.);
            actor.pos = shove.to + (shove.from - shove.to) * (1. - t).powi(3);
        }
    }
    pub fn displace(&self, frame: &mut Snapshot) {
        for actor in &mut frame.actors {
            self.displace_actor(actor, frame.time);
        }
        self.wishfire.pose(frame,crate::reduced_motion());
        self.bubble_aura.pose(frame);
        self.boss_push.pose(frame,crate::reduced_motion());
    }
    pub fn reaction_time(&self, source:u32,target:u32,time:f64)->Option<f64> {self.wishfire.reaction_time(source,target,time)}
    pub fn death_time(&self,id:u32)->Option<f64> {self.wishfire.death_time(id)}
    pub fn cached_hazard(&self,id:u32)->Option<HazardView> {self.hazards.get(&id).map(|(h,_)|h.clone())}
    #[cfg(target_arch="wasm32")]
    pub fn boss_push_record(&self,time:f64) {self.boss_push.record(time);}
    pub fn boss_timings(&mut self,timings:&super::boss::WarningTimings) {self.boss.timings=timings.clone();}
    pub fn take_boss(&mut self,other:&mut Self,source_time:f64,target:&Snapshot) {self.boss.take_actors(&mut other.boss,source_time,target);}
    pub fn take_regen(&mut self,other:&mut Self,source_time:f64,target:&Snapshot) {
        self.take_heals(other,source_time,target);
        self.regen.take_actors(&mut other.regen,source_time,target);

    }
    pub fn heals_target(&self,target:u32)->bool {self.wishfire.heals_target(target)}
    pub fn take_heals(&mut self,other:&mut Self,source_time:f64,target:&Snapshot) {
        self.wishfire.take_heals(&mut other.wishfire,source_time,target);
    }
    pub fn inherit_actor_effects(&mut self,other:&Self,source_time:f64,target:&Snapshot) {
        self.projectiles.inherit_observations(&other.projectiles,target.time-source_time,target);
        self.bubble_aura.inherit(&other.bubble_aura,source_time,target);
    }
    #[cfg(target_arch="wasm32")]
    pub fn aura_record(&self,assets:&Assets,camera:&WorldCamera,s:&Snapshot) {self.bubble_aura.record(assets,camera,s);}
    #[cfg(target_arch="wasm32")]
    pub fn spring_record(&self,assets:&Assets,camera:&WorldCamera,s:&Snapshot) {
        let mut values=self.wishfire.spring_probe(assets,camera,s);
        let runa=s.actors.iter().find(|a|a.archetype==Archetype::Runa);
        values[15]=self.impacts.iter().filter(|fx|s.time-fx.born>=0. && s.time-fx.born<0.18 && fx.element==Element::Arcane && runa.is_some_and(|a|a.id==fx.source && a.state==wf_combat::ActorState::Basic)).count() as f32;
        values[16]=s.projectiles.iter().filter(|p|p.team==wf_combat::Team::Hero && p.kind==wf_combat::ProjectileKind::Orb).count() as f32;
        values[17]=runa.map_or(0.,|a|a.id as f32);
        SPRING_PROBE.with(|p|p.set(values));
    }
    #[cfg(target_arch="wasm32")]
    pub fn shadow_age(&self,time:f64)->f32 {self.wishfire.shadow_age(time)}
    #[cfg(any(test,target_arch="wasm32"))]
    pub fn bubble_records(&self)->usize {self.bubble.records()}
    #[cfg(target_arch="wasm32")]
    pub fn visible_popups(&self,time:f64)->f32 {self.popups.iter().filter(|p|time>=p.born && time-p.born<POPUP_LIFE).count() as f32}
    pub fn impacts(
        &self,
        assets: &Assets,
        camera: &WorldCamera,
        s: &Snapshot,
        include_state: bool,
        reduced: bool,
        stats: &mut DrawStats,
    ) {
        let z = camera.zoom / 0.5;
        self.wishfire.draw(assets, camera, s, reduced, stats);
        self.arcane.impacts(assets, camera, s, stats);
        self.pound.impacts(assets, camera, s, reduced, stats);
        self.regen.impacts(assets, camera, s, stats);
        self.enemy_heals.draw(assets, camera, s, stats);
        self.boss.draw(assets,camera,s,reduced,stats);
        self.bubble.impacts(assets, camera, s, stats);
        self.bubble_aura.impacts(assets, camera, s, reduced, stats);
        self.boss_push.impacts(assets,camera,s,stats);
        self.resurrect.draw(assets, camera, s, stats);
        // Owner: keep the original boss auras (the Astra "energy lobes"/roar wings were rejected).
        gl_use_material(&assets.additive);
        for a in s.actors.iter().filter(|a| include_state && a.enraged && a.hp > 0.) {
            // Lasting, slowly breathing red aura for the rest of the fight.
            let pulse = 0.5 + 0.5 * (s.time as f32 * std::f32::consts::TAU * 0.9).sin();
            let p = camera.project(a.pos) - vec2(0., 62. * a.scale * camera.zoom);
            assets.decal(
                "flash",
                p,
                vec2(120., 150.) * a.scale * camera.zoom * (1. + 0.06 * pulse),
                0.,
                Color::new(1., 0.08, 0.06, 0.16 + 0.12 * pulse),
                stats,
            );
        }
        for &(id, born, enraged) in &self.boss_flashes {
            if let Some(a) = s.actors.iter().find(|a| a.id == id && a.hp > 0.) {
                let age = (s.time - born) as f32;
                let p = camera.project(a.pos) - vec2(0., 70. * a.scale * camera.zoom);
                assets.decal(
                    "flash",
                    p,
                    vec2(100., 120.) * a.scale * camera.zoom * (1. + age),
                    0.,
                    Color::new(
                        1.,
                        if enraged { 0.08 } else { 0.65 },
                        0.1,
                        (1. - age / 0.55).max(0.) * 0.65,
                    ),
                    stats,
                );
            }
        }
        let (gr, gg, gb) = TAUNT_GOLD;
        gl_use_material(&assets.additive);
        for m in &self.taunt_marks {
            if let Some(a) = s.actors.iter().find(|a| a.id == m.enemy && a.hp > 0. && a.taunted_by.is_some()) {
                let age = (s.time - m.born) as f32;
                let h = super::actors::body_height(assets, a, camera.zoom);
                let chest = camera.project(a.pos) - vec2(0., 0.55 * h);
                // Initial hit flash, then a soft breathing gold mark for the taunt's duration.
                let pop = (1. - age / 0.25).max(0.);
                let breath = 0.5 + 0.5 * (s.time as f32 * 6.).sin();
                assets.decal(
                    "flash",
                    chest,
                    vec2(0.9 * h, 0.9 * h) * (1. + 0.3 * pop),
                    0.,
                    Color::new(gr, gg, gb, 0.55 * pop + 0.12 + 0.06 * breath),
                    stats,
                );
                // Owner: the "eye" icon over each taunted enemy — forced to look at Fara.
                // Owner: no fade — the icon holds at full strength for the whole taunt.
                let fade = 1.;
                let grow = 1. + 0.35 * (std::f32::consts::PI * (age / 0.2).min(1.)).sin();
                let bob = (s.time as f32 * 4.).sin() * 1.5 * camera.zoom / 0.5;
                let head = camera.project(a.pos) - vec2(0., h + 8. * camera.zoom / 0.5 - bob);
                gl_use_default_material();
                assets.decal(
                    "warn",
                    head,
                    vec2(20., 20.) * (camera.zoom / 0.5) * grow, // owner, 2026-10-25: eye +25%
                    0.,
                    Color::new(1., 0.86, 0.5, fade),
                    stats,
                );
                gl_use_material(&assets.additive);
            }
        }
        gl_use_default_material();
        for &(id, born) in &self.wards {
            let age = s.time - born;
            if age < 0.2 {
                if let Some(a) = s.actors.iter().find(|a| a.id == id && !super::enemy_status::warcry(a)) {
                    assets.vfx_frame(
                        "ward-shell",
                        0,
                        camera.project(a.pos) - vec2(0., 17. * z),
                        vec2(24., 35.) * z,
                        0.,
                        Color::new(1., 1., 1., (1. - age / 0.2) as f32),
                        stats,
                    );
                }
            }
        }
        let blasts: Vec<_> = self
            .explosions
            .iter()
            .rev()
            .filter(|x| s.time - x.born < EXPLOSION_SECONDS)
            .take(4)
            .collect();
        let crowd = blasts.len() >= 4;
        for fx in blasts {
            let age = s.time - fx.born;
            let p = camera.project(fx.pos);
            let (fireball, smoke) = explosion_sizes(fx, camera.zoom, p);
            assets.vfx_once(
                "bomb-fireball",
                age,
                p,
                fireball,
                0.,
                Color::new(1., 1., 1., if crowd { 0.8 } else { 1. }),
                stats,
            );
            assets.vfx_once(
                "blast-smoke",
                age - 0.07,
                p,
                smoke,
                0.,
                Color::new(1., 1., 1., if crowd { 0.28 } else { 0.38 }),
                stats,
            );
        }
        for fx in &self.impacts {
            if s.time<fx.born {continue;}
            let p = fx.contact.map(|p|camera.project(wf_combat::Vec2::new(p.x,p.y/SQUASH))).unwrap_or_else(||
                camera.project(fx.pos)-vec2(0.,fx.chest*camera.zoom)+fx.direction*6.*z);
            assets.vfx_once(
                family(fx.element, fx.crit),
                s.time - fx.born,
                p,
                Vec2::splat(if fx.crit { 38. } else { 24. }) * z,
                (-fx.direction.y).atan2(-fx.direction.x),
                WHITE,
                stats,
            );
        }
        self.projectiles.draw(assets, camera, s, stats);
    }
    pub fn labels(
        &self,
        assets: &Assets,
        camera: &WorldCamera,
        s: &Snapshot,
        stats: &mut DrawStats,
    ) {
        let density = crate::camera::Portrait::density();
        let party_max_hp: f32 = s.actors.iter().filter(|a| a.team == wf_combat::Team::Hero).map(|a| a.max_hp).sum();
        for (i, pop) in self.popups.iter().enumerate() {
            let age = (s.time - pop.born) as f32;
            if age < 0. {continue;}
            let above = self.popups[i + 1..]
                .iter()
                .filter(|p| p.target == pop.target)
                .count();
            let actor = s.actors.iter().find(|a| a.id == pop.target);
            let scale = actor.map(crate::render::actors::visual_scale).unwrap_or(1.);
            let p = camera.project(actor.map(|a| a.pos).unwrap_or(pop.pos));
            let height = actor
                .map(|a| super::actors::body_height(assets, a, camera.zoom))
                .unwrap_or(126. * scale * camera.zoom);
            let life = if pop.text == "Miss" {
                0.65
            } else {
                POPUP_LIFE as f32
            };
            let t = (age / life).clamp(0., 1.);
            // Wishfire anchors at body centre, nudged 10 px forward (enemies right, heroes left);
            // the slice keeps its own stack spacing, eased rise and fade.
            let side = match actor.map(|a| a.team) {
                Some(wf_combat::Team::Hero) => -10.,
                Some(_) => 10.,
                None => 0.,
            };
            let cy = (p.y - height * 0.5 - above as f32 * 12. - 18. * (1. - (1. - t).powi(2)))
                .clamp(60., 552.);
            let alpha = ((life - age) / 0.25).clamp(0., 1.);
            let size = popup_font_size(pop, party_max_hp);
            let font = Some(&assets.label_font);
            // macroquad rasterises at font_size x DPI, but the portrait target is denser whenever the
            // window exceeds 360x640; raster at the target's own density and snap to its pixel grid.
            let raster = ((size * density / screen_dpi_scale()).round() as u16).max(1);
            let font_scale = size / raster as f32;
            let snap = |v: f32| (v * density).round() / density;
            let dims = measure_text(&pop.text, font, raster, font_scale);
            let x = snap((p.x + side).clamp(dims.width / 2. + 3., 357. - dims.width / 2.) - dims.width / 2.);
            let y = snap(cy + dims.offset_y * 0.5);
            let params = |color| TextParams { font, font_size: raster, font_scale, color, ..Default::default() };
            // Canvas strokeText centres a max(1.5, 0.18em) #0f0f0f line on the glyph edge.
            let r = (size * 0.18).max(1.5) * 0.5;
            let ink = Color::new(15. / 255., 15. / 255., 15. / 255., alpha);
            for (dx, dy) in [(1., 0.), (-1., 0.), (0., 1.), (0., -1.), (0.71, 0.71), (-0.71, 0.71), (0.71, -0.71), (-0.71, -0.71)] {
                draw_text_ex(&pop.text, x + dx * r, y + dy * r, params(ink));
            }
            let (top, bottom) = pop.tone.on(actor.map(|a| a.team)).stops(pop.crit);
            let half = size * 1.3;
            let gradient = &assets.label_gradient;
            gradient.set_uniform("Top", vec4(top.r, top.g, top.b, 1.));
            gradient.set_uniform("Bottom", vec4(bottom.r, bottom.g, bottom.b, 1.));
            gradient.set_uniform("Span", vec2(cy - half, cy + half));
            gl_use_material(gradient);
            draw_text_ex(&pop.text, x, y, params(Color::new(1., 1., 1., alpha)));
            gl_use_default_material();
            stats.calls += 9;
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn warcry_owns_its_gain_transition_while_other_wards_keep_their_cue() {
        let mut s=crate::testing::sim().snapshot().clone();
        let fara=s.actors[0].id;let other=s.actors[1].id;
        s.actors[0].warcry_shield=true;s.actors[0].ward=126.;
        let mut p=Presentation::default();
        p.ingest(vec![Event::WardGained{target:fara,amount:126.},Event::WardGained{target:other,amount:30.}],&s,&s);
        assert!(!p.wards.iter().any(|(id,_)|*id==fara));
        assert!(p.wards.iter().any(|(id,_)|*id==other));
        s.actors[0].warcry_shield=false;
        p.ingest(vec![Event::WardGained{target:fara,amount:30.}],&s,&s);
        assert!(p.wards.iter().any(|(id,_)|*id==fara));
    }

    #[test]
    fn fizzmite_explosion_quads_fit_phone_at_all_client_zooms() {
        let fx = Explosion { boss: true, fizzmite: true, pos: wf_combat::Vec2::new(0.,0.), radius: 210., born: 0. };
        for step in 50..=80 {
            let zoom = step as f32 / 100.;
            for anchor in [vec2(180.,320.), vec2(96.,320.), vec2(264.,320.), vec2(180.,80.), vec2(180.,620.)] {
                let (fire, smoke) = explosion_sizes(&fx, zoom, anchor);
                for size in [fire, smoke] {
                    let min = anchor - size * vec2(0.5,122./128.);
                    let max = min + size;
                    assert!(min.x >= 4.-0.001 && min.y >= 4.-0.001 && max.x <= 356.+0.001 && max.y <= 636.+0.001,
                        "zoom={zoom}, anchor={anchor:?}, quad={min:?}..{max:?}");
                }
            }
        }
    }


    /// Owner 2026-11-05 (ORKA-63bf.48): a bomb blast is its fire plume and then its smoke. The
    /// fire sheet was never brought over from the slice, so only the smoke drew.
    #[test]
    fn a_bomb_blast_has_its_fire_sheet_as_well_as_its_smoke() {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../web-runner/assets/rust-combat");
        let manifest: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(root.join("manifest.json")).unwrap()).unwrap();
        for (id, sheet) in [("bomb-fireball", "vfx-astra/bomb-fireball.png"), ("blast-smoke", "vfx-astra/blast-smoke.png")] {
            let effect = &manifest["effects"][id];
            assert_eq!(effect["file"], sheet, "{id} is in the effect manifest");
            assert_eq!((effect["frame_count"].as_u64(), effect["frame_size"][0].as_u64(), effect["pivot"][1].as_u64()), (Some(4), Some(128), Some(122)));
            assert!(manifest["sha256"][sheet].is_string(), "{sheet} is fingerprinted");
            let image = Image::from_file_with_format(&std::fs::read(root.join(sheet)).unwrap(), None).unwrap();
            assert_eq!((image.width, image.height), (512, 128));
            for frame in 0..4 {
                let painted = (0..128).any(|y| (0..128).any(|x| image.bytes[(y * 512 + frame * 128 + x) * 4 + 3] >= 64));
                assert!(painted, "{sheet} frame {frame}: empty painting");
            }
        }
        // The fire leads and the smoke follows 70 ms later: over the blast's 0.55 s both play.
        let fire: u64 = manifest["effects"]["bomb-fireball"]["frame_ms"].as_array().unwrap().iter().map(|v| v.as_u64().unwrap()).sum();
        let smoke: u64 = manifest["effects"]["blast-smoke"]["frame_ms"].as_array().unwrap().iter().map(|v| v.as_u64().unwrap()).sum();
        assert_eq!((fire, smoke), (340, 480));
        assert!((smoke + 70) as f64 / 1000. <= EXPLOSION_SECONDS);
    }
    #[test]
    fn other_explosion_sizes_preserve_original_formula() {
        for boss in [false, true] {
            for zoom in [0.5, 0.8] {
                let fx=Explosion {boss, fizzmite:false, pos:wf_combat::Vec2::new(0.,0.), radius:210., born:0.};
                let d=2.*fx.radius*zoom;
                let (fire,smoke)=explosion_sizes(&fx,zoom,vec2(96.,80.));
                assert_eq!(fire,Vec2::splat((1.12*d).min(if boss {f32::INFINITY}else{112.*zoom/0.5})));
                assert_eq!(smoke,vec2(0.90*d,0.64*d));
            }
        }
    }
    #[test]
    fn fizzmite_resolve_without_owner_uses_one_boss_explosion_and_shake() {
        let mut previous = crate::testing::sim().snapshot().clone();
        previous.hazards.clear();
        previous.hazards.push(HazardView {
            id: 900, kind: HazardKind::FizzmiteBlast, owner: 999,
            team: wf_combat::Team::Enemy, hostile: true,
            shape: Shape::Circle { radius: 210. }, origin: wf_combat::Vec2::new(480., 1100.),
            dir: wf_combat::Vec2::new(0., 1.), fill: wf_combat::FillMode::Countdown,
            phase: HazardPhase::Locked, progress: 0.99, width_scale: 1., tier: 2,
        });
        let mut now = previous.clone();
        now.time += wf_combat::SIM_DT as f64;
        now.hazards.clear();
        assert!(previous.actors.iter().chain(now.actors.iter()).all(|a| a.id != 999));
        let mut p = Presentation::default();
        p.ingest(vec![Event::HazardResolved {
            id: 900, kind: HazardKind::FizzmiteBlast, victims: vec![],
        }], &now, &previous);
        assert_eq!(p.explosions.len(), 1);
        assert!(p.explosions[0].boss);
        assert!(p.explosions[0].fizzmite);
        assert_eq!(p.explosions[0].radius, 210.);
        assert_eq!(p.explosions[0].pos, previous.hazards[0].origin);
        assert_eq!(p.shake, Some((now.time, 2., 0.12)));
        assert_eq!(p.shake_owner, None);
        p.ingest(vec![], &now, &now);
        assert_eq!(p.explosions.len(), 1);
    }
    #[test]
    fn mirewing_poison_uses_existing_green_ticks_and_floats_on_a_hero() {
        let mut s=crate::testing::sim().snapshot().clone();let target=s.actors[0].id;
        let mut mirewing=s.actors[0].clone();mirewing.id=900;mirewing.team=wf_combat::Team::Enemy;mirewing.archetype=Archetype::Mirewing;
        s.actors.push(mirewing);let mut p=Presentation::default();
        p.ingest(vec![Event::Hit{source:900,target,amount:4.,crit:false,element:Element::Poison, blocked: false}],&s,&s);
        assert_eq!(p.popups.len(),1);assert_eq!(p.popups[0].tone,PopupTone::Dot);
        assert!(p.wishfire.busy(s.time));assert!(p.busy(s.time));assert!(!p.busy(s.time+0.5));
    }
    #[test]
    fn revive_burst_reuses_shove_and_keeps_a_resisting_boss_in_place() {
        let mut old=crate::testing::sim().snapshot().clone();
        let hero=old.actors[0].clone();let mut enemy=hero.clone();enemy.id=900;enemy.team=wf_combat::Team::Enemy;
        enemy.archetype=Archetype::Boss;enemy.pos.x+=70.;old.actors.push(enemy);
        let mut s=old.clone();s.actors.last_mut().unwrap().pos.x+=35.;
        let event=Event::ReviveBurst{hero:hero.id,pos:hero.pos,radius:140.};let mut fx=Presentation::default();
        fx.ingest(vec![event.clone()],&s,&old);assert_eq!(fx.shoves.len(),1);
        let mut displayed=s.clone();fx.displace(&mut displayed);assert_eq!(displayed.actors.last().unwrap().pos,old.actors.last().unwrap().pos);
        let mut resisted=Presentation::default();resisted.ingest(vec![event,Event::KnockbackResisted{id:900}],&s,&old);
        assert!(resisted.shoves.is_empty());
    }
    #[test]
    fn combo_handoff_rebases_special_packages_but_leaves_basic_hits_on_combat_clock() {
        let mut s=crate::testing::sim().snapshot().clone();s.time=1.;s.combat_time=1.;
        let co=s.actors.iter().find(|a|a.archetype==Archetype::Kaja).unwrap().id;
        let caster=s.actors[2].id;
        let mut enemy=s.actors[0].clone();enemy.id=999;enemy.team=wf_combat::Team::Enemy;s.actors.push(enemy);
        s.hazards.push(HazardView{id:900,kind:HazardKind::ArcanePulse,team:wf_combat::Team::Hero,hostile:false,
            shape:Shape::Circle{radius:95.},origin:s.actors[0].pos,dir:wf_combat::Vec2::new(1.,0.),fill:wf_combat::FillMode::Countdown,
            phase:wf_combat::HazardPhase::Locked,progress:1.,width_scale:1.,owner:co,tier:1});
        let mut bg=Presentation::default();let mut prior=s.clone();prior.time=0.9;
        bg.ingest(vec![Event::Hit{source:co,target:999,amount:10.,crit:false,element:Element::Arcane, blocked: false}],&prior,&prior);
        bg.ingest(vec![Event::SkillStarted{id:co,skill:wf_combat::Skill::ArcanePulse,target:Some(999)},
            Event::HazardResolved{id:900,kind:HazardKind::ArcanePulse,victims:vec![999]},
            Event::Hit{source:co,target:999,amount:20.,crit:false,element:Element::Arcane, blocked: false}],&s,&prior);
        let view=wf_combat::SpotlightView{caster,skill:wf_combat::Skill::BubblePop,phase:wf_combat::SpotlightPhase::Charge,
            started:20.,participants:vec![caster,999],co_casters:vec![co],hazards:vec![],projectiles:vec![]};
        let mut fg=Presentation::default();fg.take_combo(&mut bg,&view,&s,1.1,20.1);
        assert_eq!(bg.arcane.records(),0);assert_eq!(fg.arcane.records(),2);
        assert_eq!(bg.impacts.len(),1);assert_eq!(bg.impacts[0].combo_owner,None);
        assert_eq!(bg.impacts[0].born,0.9);assert_eq!(bg.popups.len(),1);
        assert_eq!(fg.impacts.len(),1);assert_eq!(fg.impacts[0].combo_owner,Some(co));assert_eq!(fg.impacts[0].born,20.);
        assert_eq!(fg.popups.len(),1);assert_eq!(fg.popups[0].born,20.);
        fg.pause_combo(&view,&s,1.2);assert!((fg.impacts[0].born-21.2).abs()<1e-8);
        assert!(fg.busy(21.3));assert!(!fg.busy(22.8),"a moved package must finish on live time");
        assert_eq!(bg.impacts[0].born,0.9,"the co-caster's prior Basic stays on combat time");
    }

    #[test]
    fn projectile_impacts_wait_for_painted_contact_on_bosses_and_small_enemies() {
        use nanoserde::DeJson;
        let manifest=crate::assets::Manifest::deserialize_json(include_str!("../../gen/assets.json")).unwrap();
        for archetype in [Archetype::Boss,Archetype::Gobloc,Archetype::Orc,Archetype::Mirewing,Archetype::Gloamink,Archetype::Fizzmite] {
            for kind in [wf_combat::ProjectileKind::Orb,wf_combat::ProjectileKind::Bolt] {
                let mut old=crate::testing::sim().snapshot().clone();old.projectiles.clear();old.hazards.clear();
                old.actors[0].archetype=Archetype::Runa;let source=old.actors[0].id;
                let mut target=old.actors[0].clone();target.id=900;target.team=wf_combat::Team::Enemy;target.archetype=archetype;
                target.scale=if archetype==Archetype::Boss {2.2}else{1.};target.radius=if archetype==Archetype::Boss {66.}else{20.};target.pos=wf_combat::Vec2::new(500.,500.);
                old.actors.push(target.clone());old.projectiles.push(wf_combat::ProjectileView{id:800,kind,team:wf_combat::Team::Hero,
                    pos:wf_combat::Vec2::new(500.,535.),dir:wf_combat::Vec2::new(0.,-1.),height:0.});
                let mut now=old.clone();now.time+=wf_combat::SIM_DT as f64;now.projectiles.clear();
                let mut p=Presentation::default();p.ingest_context(vec![Event::Hit{source,target:target.id,amount:10.,crit:false,element:Element::Arcane, blocked: false}],&now,&old,&now,&old,Some(&manifest));
                assert_eq!(p.impacts.len(),1);let hit=&p.impacts[0];
                assert_eq!(hit.contact,Some(super::super::projectiles::body_contact(Some(&manifest),&target)));
                assert!(hit.born>now.time && hit.born-now.time<=0.08);
                assert_eq!(p.popups[0].born,now.time,"damage timing stays authoritative");
                assert!(p.busy(now.time));assert!(!p.busy(hit.born+0.181));
            }
        }
    }
    #[test]
    fn mirewing_melee_impacts_use_the_same_hovering_torso_as_projectiles() {
        use nanoserde::DeJson;
        let manifest=crate::assets::Manifest::deserialize_json(include_str!("../../gen/assets.json")).unwrap();
        let mut s=crate::testing::sim().snapshot().clone();
        let source=s.actors[0].id;
        let mut target=s.actors[0].clone();target.id=900;target.team=wf_combat::Team::Enemy;
        target.archetype=Archetype::Mirewing;s.actors.push(target.clone());
        let mut p=Presentation::default();
        p.ingest_context(vec![Event::Hit{source,target:900,amount:10.,crit:false,element:Element::Physical, blocked: false}],&s,&s,&s,&s,Some(&manifest));
        assert_eq!(p.impacts[0].contact,Some(super::super::projectiles::body_contact(Some(&manifest),&target)));
        assert_eq!(p.impacts[0].born,s.time);
    }
    #[test]
    fn marching_stomp_resolves_each_circle_with_only_the_existing_hostile_flash() {
        let mut s = crate::testing::sim().snapshot().clone();
        s.hazards.clear();
        for i in 0..4 {
            s.hazards.push(HazardView { id: 900+i, kind: HazardKind::BossStompStep,
                team: wf_combat::Team::Enemy, hostile: true, shape: Shape::Circle { radius: 90. },
                origin: wf_combat::Vec2::new(400., 400.+i as f32*100.), dir: wf_combat::Vec2::new(0., 1.),
                fill: wf_combat::FillMode::Countdown, phase: HazardPhase::Locked,
                progress: 0.8-i as f32*0.2, width_scale: 1., owner: 999, tier: 2 });
        }
        let mut p = Presentation::default();
        p.ingest(vec![], &s, &s);
        for id in 900..904 {
            let old = s.clone();
            s.time += 0.3;
            s.hazards.retain(|h| h.id != id);
            p.ingest(vec![Event::HazardResolved { id, kind: HazardKind::BossStompStep, victims: vec![] }], &s, &old);
            assert_eq!(p.flashes.len(), 1);
            let f = &p.flashes[0];
            assert_eq!(f.hazard.id, id);
            assert_eq!(f.hazard.phase, HazardPhase::Resolved);
            assert_eq!(f.hazard.progress, 1.);
            assert!(p.explosions.is_empty() && p.impacts.is_empty() && p.popups.is_empty());
            assert!(p.wishfire.owned.is_empty() && p.shake.is_none());
            assert!(p.busy(s.time));
            assert!(!p.busy(s.time+0.081));
        }
    }
    use super::*;
    use wf_combat::{Sim, SimConfig,ActorState};
    #[test]
    fn runa_basic_splash_hits_keep_arcane_impacts_and_spring_never_flashes_red() {
        let mut s=crate::testing::sim().snapshot().clone();let old=s.clone();s.actors[0].archetype=Archetype::Runa;let source=s.actors[0].id;
        let mut events=vec![];
        for id in [901,902] {let mut target=s.actors[0].clone();target.id=id;target.team=wf_combat::Team::Enemy;s.actors.push(target);events.push(Event::Hit{source,target:id,amount:10.,crit:false,element:Element::Arcane, blocked: false});}
        let mut p=Presentation::default();p.ingest(events,&s,&old);
        assert_eq!(p.impacts.len(),2);assert!(p.impacts.iter().all(|fx|fx.element==Element::Arcane));assert_eq!(p.popups.len(),2);assert!(p.wishfire.owned.is_empty());
        p.ingest(vec![Event::HazardResolved{id:900,kind:HazardKind::HealingSpring,victims:vec![]}],&s,&s);assert!(p.flashes.is_empty());
    }
    #[test]
    fn boss_push_slides_resist_braces_and_cancel_never_resolves() {
        for archetype in [Archetype::Boss,Archetype::BossBomber,Archetype::BossMarksman] {
            for kind in [HazardKind::BubblePop,HazardKind::GroundPound] {
                let mut old=crate::testing::sim().snapshot().clone();
                let mut boss=old.actors[0].clone();boss.id=999;boss.team=wf_combat::Team::Enemy;boss.archetype=archetype;boss.pos=wf_combat::Vec2::new(500.,500.);old.actors.push(boss);
                old.hazards.push(HazardView{id:900,kind:HazardKind::BossSlam,team:wf_combat::Team::Enemy,hostile:true,shape:Shape::Circle{radius:100.},origin:wf_combat::Vec2::new(500.,500.),dir:wf_combat::Vec2::new(1.,0.),fill:wf_combat::FillMode::Countdown,phase:HazardPhase::Locked,progress:0.5,width_scale:1.,owner:999,tier:1});
                let mut s=old.clone();s.actors.last_mut().unwrap().pos.x+=35.;s.hazards.retain(|h|h.id!=900);
                let push=Event::HazardResolved{id:901,kind,victims:vec![999]};
                let mut p=Presentation::default();p.ingest(vec![push.clone(),Event::BossStaggered{id:999,interrupted:true},Event::HazardCancelled{id:900,kind:HazardKind::BossSlam},Event::HazardResolved{id:900,kind:HazardKind::BossSlam,victims:vec![]}],&s,&old);
                assert_eq!(p.shoves.len(),1);assert!(p.flashes.is_empty());assert_eq!(p.boss_push.cancellations(s.time).len(),1);
                let mut display=s.clone();p.displace(&mut display);assert_eq!(display.actors.last().unwrap().pos,old.actors.last().unwrap().pos);
                display=s.clone();display.time+=SHOVE_SECONDS*0.5;p.displace(&mut display);
                assert!(display.actors.last().unwrap().pos.x>500. && display.actors.last().unwrap().pos.x<535.);
                assert!(p.boss_push.cancellations(s.time+0.121).is_empty());
                let mut reduced=s.clone();reduced.time+=0.03;p.boss_push.pose(&mut reduced,true);assert_eq!(reduced.actors.last().unwrap().pos,s.actors.last().unwrap().pos);
                let mut resisted=Presentation::default();resisted.ingest(vec![push,Event::KnockbackResisted{id:999}],&s,&old);
                assert!(resisted.shoves.is_empty());let mut display=s.clone();display.time+=0.03;resisted.displace(&mut display);assert_eq!(display.actors.last().unwrap().pos,s.actors.last().unwrap().pos);
                assert!(resisted.boss_push.busy(s.time+0.17));assert!(!resisted.boss_push.busy(s.time+0.19));
                // Two hero push hazards can resolve together with different boss rolls.
                let mut mixed=Presentation::default();mixed.ingest(vec![Event::HazardResolved{id:902,kind,victims:vec![999]},Event::KnockbackResisted{id:999},Event::BossStaggered{id:999,interrupted:false}],&s,&old);
                assert_eq!(mixed.shoves.len(),1);let mut display=s.clone();mixed.displace(&mut display);assert_eq!(display.actors.last().unwrap().pos,old.actors.last().unwrap().pos);
            }
        }
    }
    #[test]
    fn bubble_aura_state_is_quiet_but_release_pop_gates_completion() {
        let mut old=crate::testing::sim().snapshot().clone();
        let mut enemy=old.actors[0].clone();enemy.id=999;enemy.team=wf_combat::Team::Enemy;old.actors.push(enemy);
        let mut s=old.clone();s.actors.last_mut().unwrap().encased=1.5;
        let mut p=Presentation::default();p.ingest(vec![Event::Encased{id:999,seconds:1.5}],&s,&old);
        assert!(!p.busy(s.time));assert!(p.flashes.is_empty());
        old=s.clone();s.time+=1.5;s.actors.last_mut().unwrap().encased=0.;
        p.ingest(vec![Event::HazardResolved{id:900,kind:HazardKind::BubbleAura,victims:vec![]}],&s,&old);
        assert!(p.busy(s.time+0.2));assert!(!p.busy(s.time+0.33));assert!(p.flashes.is_empty());
    }
    #[test]
    fn shadow_travel_precedes_slash_impact_popup_and_lethal_reaction() {
        let mut old=crate::testing::sim().snapshot().clone();
        let hero=old.actors[0].id;let mut enemy=old.actors[0].clone();enemy.id=999;enemy.team=wf_combat::Team::Enemy;
        enemy.pos=wf_combat::Vec2::new(600.,400.);old.actors.push(enemy.clone());
        let from=old.actors[0].pos;let to=enemy.pos-wf_combat::Vec2::new(45.,0.);
        let mut s=old.clone();s.time=10.;s.actors[0].pos=to;s.actors.last_mut().unwrap().hp=0.;s.actors.last_mut().unwrap().state=ActorState::Dead;
        let mut p=Presentation::default();
        p.ingest(vec![Event::Blink{hero,from,to,target:999},Event::Hit{source:hero,target:999,amount:100.,crit:true,element:Element::Physical, blocked: false}],&s,&old);
        assert!(p.impacts.is_empty());assert_eq!(p.popups[0].born,10.28);
        assert_eq!(p.reaction_time(hero,999,10.),Some(10.28));
        let mut frame=s.clone();p.wishfire.pose(&mut frame,false);assert_eq!(frame.actors[0].pos,from);assert_eq!(frame.actors.last().unwrap().hp,enemy.hp);
        frame=s.clone();frame.time=10.1;p.wishfire.pose(&mut frame,false);
        assert!(frame.actors[0].pos.x>from.x && frame.actors[0].pos.x<to.x);
        frame=s.clone();frame.time=10.2;p.wishfire.pose(&mut frame,false);assert_eq!(frame.actors[0].state,ActorState::Basic);
        assert!(frame.time<p.popups[0].born);assert!(p.busy(frame.time));
        frame=s.clone();frame.time=10.29;p.wishfire.pose(&mut frame,false);assert_eq!(frame.actors.last().unwrap().hp,0.);
        assert!(frame.time>=p.popups[0].born);assert!(!p.busy(10.76));
        frame=s.clone();p.wishfire.pose(&mut frame,true);assert_eq!(frame.actors[0].pos,to);
        // A later basic attack on the same victim must use its own event time.
        assert_eq!(p.reaction_time(hero,999,10.5),None);
    }
    #[test]
    fn ground_pound_uses_existing_shove_without_bubbles_or_hostile_flash() {
        let mut s = crate::testing::sim().snapshot().clone();
        let mut enemy=s.actors[0].clone();enemy.id=999;enemy.team=wf_combat::Team::Enemy;enemy.pos=wf_combat::Vec2::new(500.,500.);
        s.actors.push(enemy);let previous=s.clone();s.actors.last_mut().unwrap().pos.x+=35.;
        s.hazards.push(HazardView { id:900,kind:HazardKind::GroundPound,team:wf_combat::Team::Hero,hostile:true,
            shape:Shape::Line { length:300.,width:80. },origin:s.actors[0].pos,dir:wf_combat::Vec2::new(1.,0.),fill:wf_combat::FillMode::Countdown,
            phase:HazardPhase::Resolved,progress:1.,width_scale:1.,owner:s.actors[0].id,tier:1 });
        let mut p=Presentation::default();p.ingest(vec![Event::HazardResolved { id:900,kind:HazardKind::GroundPound,victims:vec![999] }],&s,&previous);
        assert_eq!(p.shoves.len(),1);assert_eq!(p.bubble.records(),0);assert!(p.flashes.is_empty());
        assert!(p.busy(s.time+0.63));assert!(!p.busy(s.time+0.76));
        p.displace(&mut s);assert_eq!(s.actors.last().unwrap().pos,previous.actors.last().unwrap().pos);
    }
    #[test]
    fn arcane_pulse_waits_for_burst_keeps_arcane_hits_and_never_flashes_hostile() {
        let mut s = crate::testing::sim().snapshot().clone();
        let caster = s.actors[3].id;
        let target = s.actors[0].id;
        s.hazards.push(HazardView { id: 999, kind: HazardKind::ArcanePulse, team: wf_combat::Team::Hero, hostile: true,
            shape: Shape::Circle { radius: 95. }, origin: s.actors[0].pos, dir: wf_combat::Vec2::new(1., 0.),
            fill: wf_combat::FillMode::Countdown, phase: HazardPhase::Resolved, progress: 1., width_scale: 1., owner: caster, tier: 1 });
        let mut p = Presentation::default();
        p.ingest(vec![Event::SkillStarted { id: caster, skill: wf_combat::Skill::ArcanePulse, target: Some(target) },
            Event::Hit { source: caster, target, amount: 30., crit: false, element: Element::Arcane, blocked: false},
            Event::Hit { source: caster, target, amount: 45., crit: true, element: Element::Arcane, blocked: false},
            Event::HazardResolved { id: 999, kind: HazardKind::ArcanePulse, victims: vec![target] }], &s, &s);
        assert_eq!(p.arcane.records(), 2);
        assert!(p.flashes.is_empty()); assert!(p.explosions.is_empty());
        assert_eq!(p.impacts.len(), 1); assert!(p.impacts[0].crit);
        assert_eq!(family(p.impacts[0].element, true), "crit-arcane");
        assert_eq!(family(Element::Arcane, false), "hit-arcane");
        assert!(p.busy(s.time + 0.43));
        assert!(!p.busy(s.time + super::super::arcane::BURST_SECONDS + 0.01));
        s.time += super::super::arcane::BURST_SECONDS; p.ingest(Vec::new(), &s, &s); assert_eq!(p.arcane.records(), 0);
        p.ingest(vec![Event::SceneReset], &s, &s); assert!(!p.busy(s.time));
    }
    #[test]
    fn ground_pound_retires_legacy_body_flash_and_shake() {
        let mut s=crate::testing::sim().snapshot().clone();s.time=5.;let hero=s.actors[0].id;
        s.hazards.push(HazardView{id:900,kind:HazardKind::GroundPound,owner:hero,team:wf_combat::Team::Hero,hostile:false,origin:s.actors[0].pos,dir:wf_combat::Vec2::new(1.,0.),shape:Shape::Line{length:100.,width:48.},fill:wf_combat::FillMode::Countdown,phase:HazardPhase::Locked,progress:0.,width_scale:1.,tier:1});
        let mut p=Presentation::default();p.ingest(vec![Event::HazardSpawned{id:900,kind:HazardKind::GroundPound}],&s,&s);
        assert!(!p.busy(s.time));assert!(p.shake.is_none());
        p.ingest(vec![Event::HazardResolved{id:900,kind:HazardKind::GroundPound,victims:vec![]}],&s,&s);assert_eq!(p.pound.records(),1);assert!(p.shake.is_none());
        assert_eq!(p.pound_shake(s.time),Vec2::ZERO);assert_ne!(p.pound_shake(s.time+0.23),Vec2::ZERO);
        let view=wf_combat::SpotlightView{caster:s.actors[1].id,skill:wf_combat::Skill::Shadow,phase:wf_combat::SpotlightPhase::Charge,started:5.,participants:vec![],co_casters:vec![hero],hazards:vec![900],projectiles:vec![]};
        let mut fg=Presentation::default();fg.take_combo(&mut p,&view,&s,5.,10.);assert_eq!(p.pound.records(),0);assert_eq!(fg.pound.records(),1);assert!(fg.busy(10.1));assert!(!fg.busy(10.8));
    }
    #[test]
    fn one_shots_gate_release_but_popups_and_marks_do_not() {
        let mut p = Presentation::default();
        p.wards.push((1,5.));
        p.taunt_marks.push(TauntMark {
            enemy: 2,
            born: 5.,
        });
        p.damage(2, wf_combat::Vec2::new(0., 0.), 12., false, false, 5., None);
        assert!(p.busy(5.1));
        assert!(!p.busy(5.46));
        assert!(!p.idle(5.46));
        let mut s = crate::testing::sim().snapshot().clone();
        s.time = 12.;
        p.ingest(Vec::new(), &s, &s);
        assert!(p.idle(12.));
        p.wards.push((1, 15.));
        assert!(p.busy(15.1));
        assert!(!p.busy(15.3));
        p.explosions.push(Explosion {
            boss: false,
            fizzmite: false,
            pos: wf_combat::Vec2::new(0., 0.),
            radius: 100.,
            born: 25.,
        });
        assert!(p.busy(25.5));
        assert!(!p.busy(25.56));
        assert!(!p.idle(25.56));
        assert!(p.idle(27.3));
    }
    #[test]
    fn combat_clock_freezes_existing_background_effects_and_knockback() {
        let mut s = crate::testing::sim().snapshot().clone();
        s.combat_time = 4.;
        s.time = 20.;
        let mut p = Presentation::default();
        let id = s.actors[0].id;
        p.shoves.push(Shove {
            combo_owner: None,
            id,
            from: wf_combat::Vec2::new(0., 0.),
            to: wf_combat::Vec2::new(100., 0.),
            born: 3.9,
        });
        p.damage(id, s.actors[0].pos, 12., false, false, 3.9, None);
        let (mut bg, _) = super::super::spotlight::frames(&s, None);
        p.displace(&mut bg);
        let pos = bg.actors[0].pos;
        s.time += 1.;
        let (mut later, _) = super::super::spotlight::frames(&s, None);
        p.ingest(Vec::new(), &later, &bg);
        p.displace(&mut later);
        assert_eq!(later.actors[0].pos, pos);
        assert_eq!(p.popups.len(), 1);
        assert!(p.busy(later.time));
        s.combat_time += 1.;
        let (later, _) = super::super::spotlight::frames(&s, None);
        p.ingest(Vec::new(), &later, &bg);
        assert!(p.popups.is_empty());
        assert!(!p.busy(later.time));
    }
    #[test]
    fn continuous_damage_keeps_source_kind_and_target_separate_from_direct_hits() {
        let mut p = Presentation::default();
        let pos = wf_combat::api::Vec2::new(0., 0.);
        let mut s = crate::testing::sim().snapshot().clone();
        let target = s.actors[0].id;
        for i in 0..22 {
            p.continuous_damage(HazardKind::KajaAura, target, pos, 0.4, false, i as f64 / 30.);
        }
        p.continuous_damage(HazardKind::LizardoDrop, target, pos, 0.5, false, 0.7);
        p.continuous_damage(HazardKind::KajaAura, target + 1, pos, 0.5, false, 0.7);
        p.damage(target, pos, 12., true, false, 0.7, None);
        assert!((p.continuous[0].amount - 8.8).abs() < 0.0001);
        p.flush_continuous(0.76, &s);
        assert_eq!(p.continuous.len(), 2);
        assert_eq!(p.popups.len(), 2);
        assert_eq!(p.popups[0].text, "12!");
        assert_eq!(p.popups[1].text, "9");
        // Tail damage flushes when a target dies, even before the next display window.
        s.actors.iter_mut().find(|a| a.id == target).unwrap().hp = 0.;
        p.flush_continuous(0.8, &s);
        assert_eq!(p.popups.last().unwrap().text, "1");
    }
    #[test]
    fn hero_damage_and_poison_use_salmon_while_heals_and_enemy_hits_keep_their_tones() {
        use wf_combat::Team;
        assert_eq!(PopupTone::Damage.on(Some(Team::Hero)), PopupTone::HeroHit);
        assert_eq!(PopupTone::Dot.on(Some(Team::Hero)), PopupTone::HeroHit);
        assert_eq!(PopupTone::Heal.on(Some(Team::Hero)), PopupTone::Heal);
        assert_eq!(PopupTone::Miss.on(Some(Team::Hero)), PopupTone::Miss);
        assert_eq!(PopupTone::Damage.on(Some(Team::Enemy)), PopupTone::Damage);
        assert_eq!(PopupTone::HeroHit.stops(false).0, Color::from_hex(0xff9488));
    }
    #[test]
    fn popup_colour_selection_keeps_miss_grey_and_preserves_other_tones() {
        use wf_combat::Team;
        let blue = (Color::from_hex(0x8fd3ff), Color::from_hex(0x8fd3ff));
        let yellow = (Color::from_hex(0xffd84a), Color::from_hex(0xffd84a));
        let grey = (Color::from_hex(0xa8adb4), Color::from_hex(0xa8adb4));
        for team in [Team::Hero, Team::Enemy] {
            assert_eq!(PopupTone::Miss.on(Some(team)).stops(false), grey);
            assert_eq!(PopupTone::Blocked.on(Some(team)).stops(false), blue);
            assert_eq!(PopupTone::Blocked.on(Some(team)).stops(true), blue);
            for tone in [PopupTone::Damage, PopupTone::Dot] {
                assert_eq!(tone.on(Some(team)).stops(true), yellow);
            }
        }
        assert_eq!(PopupTone::Damage.stops(false),
            (Color::from_hex(0xfbfdce), Color::from_hex(0xf7f8d4)));
        assert_eq!(PopupTone::HeroHit.stops(false),
            (Color::from_hex(0xff9488), Color::from_hex(0xff6458)));
        for tint in super::super::healing::TargetAuras::palette() {
            assert_eq!(tint, PopupTone::Heal.stops(false).0);
        }
        assert_eq!(PopupTone::Heal.stops(false),
            (Color::from_hex(0x86eb2e), Color::from_hex(0x9fdfff)));
        assert_eq!(PopupTone::Dot.stops(false),
            (Color::from_hex(0xe4c3ff), Color::from_hex(0x8d37ff)));
        let s = crate::testing::sim().snapshot().clone();
        let target = s.actors[0].id;
        let mut p = Presentation::default();
        p.ingest(vec![Event::Evaded { source: 900, target }], &s, &s);
        assert_eq!(p.popups.len(), 1);
        assert_eq!(p.popups[0].tone, PopupTone::Miss);
        assert_eq!(p.popups[0].text, "Miss");
        assert_eq!(p.popups[0].tone.stops(p.popups[0].crit), grey);
    }
    #[test]
    fn blocked_hit_colour_survives_poison_and_continuous_aggregation() {
        let s = crate::testing::sim().snapshot().clone();
        let target = s.actors[0].id;
        let mut p = Presentation::default();
        p.ingest(vec![Event::Hit { source: 900, target, amount: 12., crit: true,
            element: Element::Poison, blocked: true }], &s, &s);
        assert_eq!(p.popups[0].tone, PopupTone::Blocked);
        assert_eq!(p.popups[0].text, "12!");
        assert!(p.popups[0].crit);
        let pos = s.actors[0].pos;
        p.continuous_damage(HazardKind::KajaAura, target, pos, 2., true, 0.);
        p.continuous_damage(HazardKind::KajaAura, target, pos, 3., false, 0.1);
        assert_eq!(p.continuous.len(), 1);
        p.flush_continuous(DAMAGE_WINDOW, &s);
        assert_eq!(p.popups.len(), 2);
        assert_eq!(p.popups[1].tone, PopupTone::Blocked);
        assert_eq!(p.popups[1].text, "5");
        assert_eq!(p.popups[1].born, DAMAGE_WINDOW);
    }
    #[test]
    fn heal_popup_sizes_match_damage_thresholds_and_preserve_colours() {
        for (amount, party_max_hp, regular, crit) in [
            (1., 100., 10.5, 16.),
            (9.99, 10., 10.5, 16.),
            (10., 100., 10.5, 16.),
            (50., 100., 10.5, 16.),
            (50.01, 100., 18.7, 18.7),
            (100., 0., 10.5, 16.),
        ] {
            let mut p = Presentation::default();
            p.heal(1, wf_combat::api::Vec2::new(0., 0.), amount, 0.);
            let pop = &mut p.popups[0];
            for (is_crit, expected) in [(false, regular), (true, crit)] {
                pop.crit = is_crit;
                pop.tone = PopupTone::Heal;
                assert_eq!(popup_font_size(pop, party_max_hp), expected);
                assert_eq!(pop.tone.stops(is_crit),
                    (Color::from_hex(0x86eb2e), Color::from_hex(0x9fdfff)));
                pop.tone = PopupTone::Damage;
                assert_eq!(popup_font_size(pop, party_max_hp), expected);
                pop.tone = PopupTone::Miss;
                assert_eq!(popup_font_size(pop, party_max_hp), 12.);
            }
        }
    }
    #[test]
    fn heal_popups_sum_breather_and_mend_ticks_and_keep_discrete_restored_amount() {
        for source in [wf_combat::HealSource::Breather, wf_combat::HealSource::Mend] {
            let mut s = crate::testing::sim().snapshot().clone();
            let target = s.actors[0].id;
            let mut p = Presentation::default();
            let mut sum = 0.;
            for i in 0..24 {
                s.time = i as f64 / 30.;
                sum += 0.42;
                p.ingest(vec![Event::Healed { target, amount: 0.42, source }], &s, &s);
                if i < 23 {
                    assert!(p.popups.is_empty());
                }
                assert!(p.popups.iter().all(|p| p.text != "+0"));
            }
            s.time = 1.;
            p.ingest(Vec::new(), &s, &s);
            assert_eq!(p.popups.len(), 1);
            assert_eq!(p.popups[0].text, format!("+{sum:.0}"));
            assert_eq!(p.popups[0].amount, sum);
            assert_eq!(popup_font_size(&p.popups[0], 100.), 10.5);
            assert_eq!(popup_font_size(&p.popups[0], sum * 2. - 0.01), 18.7);
            assert!(p.continuous_heals.is_empty());
            for amount in [7., 7.25] {
                p.ingest(vec![Event::Healed { target, amount, source }], &s, &s);
                assert_eq!(p.popups.last().unwrap().text, "+7");
                assert_eq!(p.popups.last().unwrap().amount, amount);
                assert_eq!(popup_font_size(p.popups.last().unwrap(), 100.), 10.5);
            }
        }
    }
    #[test]
    fn heal_buckets_flush_idle_targets_and_discard_sub_one_tails() {
        let mut s = crate::testing::sim().snapshot().clone();
        let target = s.actors[0].id;
        let other = s.actors[1].id;
        let mut p = Presentation::default();
        for amount in [0., -1.] {
            p.ingest(vec![Event::Healed { target, amount, source: wf_combat::HealSource::Breather }], &s, &s);
        }
        assert!(p.continuous_heals.is_empty());
        for _ in 0..3 {
            p.ingest(vec![Event::Healed { target, amount: 0.42, source: wf_combat::HealSource::Breather }], &s, &s);
        }
        p.ingest(vec![Event::Healed { target: other, amount: 0.84, source: wf_combat::HealSource::Breather }], &s, &s);
        s.time += 0.19;
        p.ingest(Vec::new(), &s, &s);
        assert!(p.popups.is_empty());
        s.time += 0.02;
        p.ingest(Vec::new(), &s, &s);
        assert!(p.continuous_heals.is_empty());
        assert_eq!(p.popups.len(), 1);
        assert_eq!(p.popups[0].target, target);
        assert_eq!(p.popups[0].text, "+1");
        assert!((p.popups[0].amount - 1.26).abs() < 0.0001);
    }
    #[test]
    fn popups_cap_each_target_at_three_and_keep_integers() {
        let mut p = Presentation::default();
        let pos = wf_combat::api::Vec2::new(0., 0.);
        for i in 0..8 {
            p.damage(1, pos, 10. + i as f32, i == 7, false, i as f64 / 30., None);
        }
        p.damage(2, pos, 0.4, false, false, 0.3, None);
        assert_eq!(p.popups.iter().filter(|p| p.target == 1).count(), 3);
        assert_eq!(p.popups.len(), 4);
        assert!(p.popups.iter().all(|p| !p.text.contains('.')));
        assert!(p.popups[2].crit);
    }
}

// Read-only effect metrics for capturing real event-driven frames at standard zoom.
#[cfg(target_arch = "wasm32")]
std::thread_local! {
    static SKILL_PROBE: std::cell::Cell<[f32; 13]> = const { std::cell::Cell::new([0.; 13]) };
}
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_skill_probe(index: u32) -> f32 {
    SKILL_PROBE.with(|p| p.get().get(index as usize).copied().unwrap_or(f32::NAN))
}
#[cfg(target_arch = "wasm32")]
std::thread_local! {static SPRING_PROBE:std::cell::Cell<[f32;18]>=const{std::cell::Cell::new([0.;18])};}
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn wf_client_spring_probe(index:u32)->f32 {SPRING_PROBE.with(|p|p.get().get(index as usize).copied().unwrap_or(f32::NAN))}

#[cfg(test)]
mod non_boss_cancel_tests {
    use super::*;
    use wf_combat::{Sim,SimConfig};
    #[test]
    fn non_boss_cancelled_warnings_use_the_same_fast_fade_without_resolving() {
        for kind in [HazardKind::SniperLine,HazardKind::LizardoDrop] {
            let mut old=crate::testing::sim().snapshot().clone();let mut enemy=old.actors[0].clone();enemy.id=999;enemy.team=wf_combat::Team::Enemy;
            enemy.archetype=if kind==HazardKind::SniperLine {Archetype::Sniper}else{Archetype::Lizardo};old.actors.push(enemy);
            old.hazards.push(HazardView{id:900,kind,team:wf_combat::Team::Enemy,hostile:true,shape:if kind==HazardKind::SniperLine {Shape::Line{length:300.,width:36.}}else{Shape::Circle{radius:69.}},
                origin:old.actors[0].pos,dir:wf_combat::Vec2::new(1.,0.),fill:wf_combat::FillMode::Countdown,phase:HazardPhase::Locked,progress:0.5,width_scale:1.,owner:999,tier:1});
            let mut s=old.clone();s.hazards.retain(|h|h.id!=900);s.time+=wf_combat::SIM_DT as f64;
            let mut p=Presentation::default();p.ingest(vec![Event::HazardCancelled{id:900,kind}],&s,&old);
            assert_eq!(p.boss_push.cancellations(s.time).len(),1);assert!(p.flashes.is_empty());assert!(!p.projectiles.busy(s.time));
            assert!(p.busy(s.time+0.11));assert!(!p.busy(s.time+0.13));
        }
    }
}
