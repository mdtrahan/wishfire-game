// Presentation observations only. The authority driver deduplicates events before ingest.
export const SLICE_SOURCE = '9c142b5f73294bd5a783e79d3840d0c3386c90a1';
export const clamp01 = value => Math.max(0, Math.min(1, value));
export const smooth = value => { const t = clamp01(value); return t * t * (3 - 2 * t); };
export const effectSeed = (id, time) => (Math.imul(id, 747796405) ^ Math.imul(Math.round(time * 30000), 2891336453)) >>> 0;
export const actorId = actor => actor.actor_id;
export const sliceChest = actor => 70 * (actor?.scale ?? 1) * (actor?.kind?.startsWith('boss') ? 1 : .6);
export function slicePopupSize(amount, crit, partyHP, miss = false) {
  return miss ? 12 : amount >= 10 && partyHP > 0 && amount > partyHP * .5 ? 18.7 : crit ? 16 : 10.5;
}
export function sliceEvent(record) {
  const body = record.body;
  return body.kind === 'presentation' ? body.data.event : body;
}
export function createRustEffectState() {
  const effects = [], popups = [], groundItems=[], channels=[], phoenixChannel={kind:'resurrect',phase:'active',owner:null,origin:null,shape:{},progress:0}, hazards = new Map(), markers = new Map(), actors = new Map(), projectiles = new Map(), healingBuckets = new Map(), damageBuckets = new Map();
  let snapshot = null, previous = null, encounter = null;
  function clear() { groundItems.length=channels.length=0; healingBuckets.clear(); damageBuckets.clear(); effects.length = 0; popups.length = 0; hazards.clear(); markers.clear(); actors.clear(); projectiles.clear(); snapshot = previous = null; encounter = null; }
  function effect(type, data, born, life) { const item = { type, data, born, life }; effects.push(item); return item; }
  function popup(data, now, tone = 'damage') {
    const target = actors.get(data.target); if (!target || data.amount <= 0) return;
    let count = 0, first = -1;
    for (let i = 0; i < popups.length; i++) if (popups[i].target === data.target) { count++; if (first < 0) first = i; }
    if (count >= 3) popups.splice(first, 1);
    popups.push({ target: data.target, pos: target.pos, amount: data.amount, crit: !!data.crit, blocked: !!data.blocked,
      text: `${tone==='heal'?'+':''}${Math.max(1, Math.round(data.amount))}${data.crit ? '!' : ''}`, born: now, life: .75,
      tone: data.blocked ? 'blocked' : tone, element: data.element });
  }
  function ingest(next, records) {
    if (!next) { clear(); return; }
    if (encounter !== next.encounter_id) { clear(); encounter = next.encounter_id; }
    previous = snapshot; snapshot = next;
    const now = next.time;
    for (const a of next.actors) actors.set(actorId(a), a);
    for (const h of next.hazards) { const entry=hazards.get(h.id);if(entry){entry.hazard=h;entry.seen=now;}else hazards.set(h.id, { hazard: h, seen: now }); }
    for (const [id, entry] of hazards) if (now - entry.seen >= .3) hazards.delete(id);
    for (let i = effects.length - 1; i >= 0; i--) if (now - effects[i].born >= effects[i].life) effects.splice(i, 1);
    for (let i = popups.length - 1; i >= 0; i--) if (now - popups[i].born >= popups[i].life) popups.splice(i, 1);
    for (const [id, marker] of markers) {
      if (marker.ended === null && !next.hazards.some(h => h.id === id && h.phase !== 'resolved')) marker.ended = now;
      if (marker.ended !== null && now - marker.ended >= .15) markers.delete(id);
    }
    for (const h of next.hazards) if (h.kind === 'spawn_marker' && h.phase !== 'resolved' && !markers.has(h.id)) markers.set(h.id, { pos: h.origin, born: now, ended: null });
    for(const [id]of projectiles)if(!next.projectiles?.some(p=>p.id===id))projectiles.delete(id);
    for(const p of next.projectiles??[])if(!projectiles.has(p.id)){
      let source=null,count=0;
      const window=Math.max(0,next.combat_time-(previous?.combat_time??next.combat_time))+1/30+.01;
      for(const a of next.actors)if(a.team===p.team&&(a.kind==='runa'||a.kind==='kaja')&&a.state==='basic'&&a.impact_at>0&&a.state_age>=a.impact_at&&a.state_age-a.impact_at<window&&Math.hypot(a.pos.x-p.pos.x,a.pos.y-p.pos.y)<100){source=a;count++;}
      projectiles.set(p.id,{origin:p.pos,source:count===1?source:null});
    }
    groundItems.length=channels.length=0;for(const h of next.hazards){groundItems.push(h);if(h.kind==='resurrect'&&h.phase!=='resolved')channels.push(h);}
    const phoenix=next.phoenix_channel;if(phoenix&&!(next.phoenix_cooldown>0)&&!next.spotlight&&!next.hit_stop){const a=actors.get(phoenix.hero);if(a){phoenixChannel.origin=a.pos;phoenixChannel.progress=phoenix.progress;groundItems.push(phoenixChannel);for(let i=channels.length-1;i>=0;i--)if(Math.abs(channels[i].origin.x-a.pos.x)<=4&&Math.abs(channels[i].origin.y-a.pos.y)<=4)channels.splice(i,1);for(let i=groundItems.length-1;i>=0;i--){const h=groundItems[i];if(h!==phoenixChannel&&h.kind==='resurrect'&&Math.abs(h.origin.x-a.pos.x)<=4&&Math.abs(h.origin.y-a.pos.y)<=4)groundItems.splice(i,1);}channels.push(phoenixChannel);}}
    // Ownership must precede Hit irrespective of batch order.
    for (const record of records) {
      const { kind, data: d } = sliceEvent(record);
      if (kind === 'blink') effect('shadow', { ...d, caster: actors.get(d.hero), targetActor: actors.get(d.target), before: previous?.actors.find(a=>a.actor_id===d.target) }, now, .75);
      if (kind === 'split_strike') effect('split', { ...d, caster: actors.get(d.hero), targets: d.targets.map(id => ({ actor: actors.get(id), landed: records.some(r => r.body.kind === 'damage' && r.body.data.source === d.hero && r.body.data.target === id && r.body.data.amount > 0) })) }, now, .505);
    }
    for (const record of records) {
      const { kind, data: d } = sliceEvent(record);
      if (kind === 'damage') {
        const shadow = effects.find(f => f.type === 'shadow' && f.data.hero === d.source && f.data.target === d.target && !f.data.hit);
        const split = effects.find(f => f.type === 'split' && f.born === now && f.data.hero === d.source && f.data.targets.some(t => actorId(t.actor ?? {}) === d.target));
        const born = shadow ? shadow.born + .28 : now;
        let continuous=null;
        if(!d.crit&&d.element==='nature'){for(const h of hazards.values())if(h.hazard.owner===d.source&&['kaja_aura','lizardo_drop'].includes(h.hazard.kind)){continuous=h.hazard.kind;break;}const source=actors.get(d.source);continuous??=source?.kind==='marid'?'kaja_aura':source?.kind==='lizardo'?'lizardo_drop':null;}
        if(continuous&&d.amount>0){const key=continuous+':'+d.target,b=damageBuckets.get(key);if(b){b.amount+=d.amount;b.blocked||=d.blocked;b.last=now;}else damageBuckets.set(key,{...d,born:now,last:now});}else popup(d,born);
        if (shadow) { shadow.data.hit = true; shadow.data.impact = born; }
        else if(!split&&d.amount>0){const old=effects.find(f=>f.type==='hit'&&f.data.source===d.source&&f.data.target===d.target&&f.data.element===d.element&&now-f.born<.08);if(old){if(d.crit&&!old.data.crit){old.data.crit=true;old.data.spriteId=undefined;old.born=now;old.life=.22;}}else effect('hit',{...d,actor:actors.get(d.target),sourceActor:actors.get(d.source)},now,d.crit?.22:.18);}
      } else if (kind === 'healed' && d.amount > 0) {
        if(d.amount>=1)popup(d, now, 'heal');else{const b=healingBuckets.get(d.target);if(b){b.amount+=d.amount;b.last=now;}else healingBuckets.set(d.target,{target:d.target,amount:d.amount,born:now,last:now});}
        if (d.source?.kind === 'healing_spring') effect('healing', { ...d, seed: effectSeed(d.target, now) }, now, 3.2);
        else if (d.source && ['mend','breather','revive','phoenix','spring_tick'].includes(d.source.kind)) effect('green_aura', { ...d }, next.combat_time, .45);
      }
      else if (kind === 'evaded') {
        const target = actors.get(d.target);
        if (target) popups.push({ target: d.target, pos: target.pos, text: 'Miss', amount: 0, crit: false, born: now, life: .65, tone: 'miss' });
      } else if (kind === 'hazard_resolved') {
        const h = hazards.get(d.id)?.hazard;
        if (h) effect('resolved', { hazard: h, victims: d.victims }, now, .08);
        if (h && ['bubble_pop', 'ground_pound', 'arcane_pulse'].includes(d.kind)) effect(d.kind, { hazard: h, victims: d.victims, seed: effectSeed(d.id, now) }, now, d.kind === 'arcane_pulse' ? 2.6 : d.kind === 'bubble_pop' ? .94 : .748);
      } else if (kind === 'hazard_cancelled') {
        const h = hazards.get(d.id)?.hazard;
        for (let i = effects.length - 1; i >= 0; i--) if (effects[i].type === 'resolved' && effects[i].data.hazard.id === d.id) effects.splice(i, 1);
        if (h) effect('cancelled', { hazard: h, shell: {...h,shape:{kind:'ring',inner:0,outer:0}}, rim:{...h,shape:{kind:'circle',radius:0}} }, now, .12);
      } else if(kind==='knockback_resisted'||kind==='boss_staggered')effect('boss_push',{...d,resisted:kind==='knockback_resisted'},now,.18);
      else if(kind==='revive_burst') effect('phoenix_burst',{...d,combatBorn:next.combat_time},now,.5);
      else if (kind === 'revived') effect('revive', { actor: actors.get(d.hero) }, now, .75);
      else if (kind === 'resurrect_interrupted' || kind === 'phoenix_cancelled') effect('revive_cancel', { actor: actors.get(d.target ?? d.hero) }, now, .28);
      else if (kind === 'skill_started') effect('cast', { ...d, actor: actors.get(d.id), seed: effectSeed(d.id, now) }, now, (actors.get(d.id)?.state_duration??.5)+2.6);
      else if (kind === 'hazard_spawned' && d.kind === 'faze_pool') {
        const h = hazards.get(d.id)?.hazard; if (h) effect('faze_splash', { hazard: h }, now, .3);
      }
    }
    for(const [id,b]of healingBuckets)if(now-b.born>=.75||now-b.last>=.2||!(actors.get(id)?.hp>0)){if(b.amount>=1)popup(b,now,'heal');healingBuckets.delete(id);}
    for(const [key,b]of damageBuckets)if(now-b.born>=.75||now-b.last>=.2||!(actors.get(b.target)?.hp>0)){popup(b,now);damageBuckets.delete(key);}
  }
  return { effects, popups, groundItems, channels, hazards, markers, actors, projectiles, ingest, clear, get snapshot() { return snapshot; }, get previous() { return previous; } };
}
