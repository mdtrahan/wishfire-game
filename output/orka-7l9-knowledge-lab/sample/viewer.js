const $ = id => document.getElementById(id);
const groups = new Map();
const modelChecks = new Map();
let report, claimFile, manifest, run = [], state, cursor = 0, simTime = 0, duration = 0;
let playing = false, lastFrame = 0;

async function readGzip(name) {
  const response = await fetch(name);
  if (!response.ok || !response.body) throw new Error(`${name}: HTTP ${response.status}`);
  const decoded = response.body.pipeThrough(new DecompressionStream('gzip'));
  return (await new Response(decoded).text()).trim().split('\n').filter(Boolean).map(JSON.parse);
}

function clock(seconds) {
  const ms = Math.round(Math.max(0, seconds) * 1000);
  const minutes = Math.floor(ms / 60000);
  return `${String(minutes).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}
function name(actor) { return actor?.name || (actor?.kind === 'system' ? 'system' : '?'); }
function key(record) { return `${record.scenario}|${record.session}`; }
function resetState() {
  state = { heroes: new Map(), region: '?', stage: '?', wave: '?', clears: 0, kos: 0, recoveries: 0, enemyKOs: 0, boss: null, bossResult: '' };
}
function setHero(hero) {
  if (!hero?.uid) return;
  const previous = state.heroes.get(hero.uid) || {};
  state.heroes.set(hero.uid, { ...previous, ...hero });
}
function apply(record) {
  const p = record.progression;
  if (p) {
    state.region = p.region ?? state.region;
    state.stage = p.stage ?? state.stage;
    state.wave = p.wave ?? state.wave;
    if (Number.isFinite(p.ordinaryWaveClears)) state.clears = p.ordinaryWaveClears;
  }
  switch (record.kind) {
    case 'SESSION_START':
      record.heroes?.forEach(setHero);
      break;
    case 'HERO_STATE':
      setHero(record.hero);
      break;
    case 'HIT': case 'HEAL': case 'RECOVER': case 'KO':
      if (record.target?.kind === 'hero') {
        const prior = state.heroes.get(record.target.uid) || record.target;
        setHero({ ...prior, hp: record.hpAfter ?? (record.kind === 'KO' ? 0 : prior.hp), maxHp: record.maxHp ?? prior.maxHp });
      }
      if (record.kind === 'KO') state.kos += 1;
      if (record.kind === 'RECOVER') state.recoveries = Math.max(state.recoveries, record.recoveryIndex || 0);
      break;
    case 'ENEMY_KO':
      state.enemyKOs += 1;
      break;
    case 'WAVE_CLEAR':
      state.clears = record.completedOrdinaryWaves ?? state.clears + 1;
      break;
    case 'RECOVERY_TRANSITION':
      state.region = record.after?.region ?? state.region;
      state.stage = record.after?.stage ?? state.stage;
      state.wave = record.after?.wave ?? state.wave;
      state.recoveries = record.after?.counters?.defeatRecoveries ?? state.recoveries;
      record.heroes?.forEach(setHero);
      break;
    case 'BOSS_START':
      state.boss = record.boss;
      state.bossResult = '';
      record.heroes?.forEach(setHero);
      break;
    case 'BOSS_CLEAR': case 'BOSS_TIMEOUT': case 'BOSS_EXIT':
      state.bossResult = record.kind.replace('BOSS_', '');
      state.boss = null;
      (record.kind === 'BOSS_TIMEOUT' ? record.timeoutHeroes || record.heroes : record.heroes)?.forEach(setHero);
      break;
    case 'SESSION_END':
      record.heroes?.forEach(setHero);
      break;
  }
}

function format(record) {
  const t = `${record.timeSource === 'poll' ? '≈' : ' '}${clock(record.t || 0)}`;
  const wave = record.wave == null ? '' : ` W${record.wave}`;
  const left = `${t}${wave}  `;
  switch (record.kind) {
    case 'SESSION_START': return [left + `START seed ${record.seed} · ${record.heroes?.map(h => `${h.name} ${h.hp}/${h.maxHp}`).join(' · ') || 'party unknown'}`, 'wave'];
    case 'HERO_STATE': return [left + `${record.hero?.name || '?'} gear/state → ${record.hero?.hp ?? '?'}/${record.hero?.maxHp ?? '?'} HP, CP ${record.hero?.combatPower ?? '?'}`, ''];
    case 'HIT': return [left + `${name(record.source)} → ${name(record.target)} HIT −${record.applied ?? '?'} HP (${record.hpBefore ?? '?'}→${record.hpAfter ?? '?'}/${record.maxHp ?? '?'}) raw=? cap=?`, 'hit'];
    case 'HEAL': return [left + `${name(record.source)} → ${name(record.target)} HEAL +${record.applied ?? '?'} HP (${record.hpBefore ?? '?'}→${record.hpAfter ?? '?'}/${record.maxHp ?? '?'}) ${record.healSource || ''}`, 'heal'];
    case 'KO': return [left + `${name(record.target)} HERO KO · ${record.hpBefore ?? '?'}→0 HP · ${name(record.source)} caused it`, 'ko'];
    case 'RECOVER': return [left + `${name(record.target)} RECOVER ${record.hpBefore ?? '?'}→${record.hpAfter ?? '?'}/${record.maxHp ?? '?'} HP`, 'recover'];
    case 'RECOVERY_TRANSITION': return [left + `RECOVERY transition Stage ${record.before?.region ?? '?'}-${record.before?.stage ?? '?'} W${record.before?.wave ?? '?'} → Stage ${record.after?.region ?? '?'}-${record.after?.stage ?? '?'} W${record.after?.wave ?? '?'}`, 'recover'];
    case 'ENEMY_KO': return [left + `${name(record.source)} → ${name(record.target)} ENEMY KO (${record.hpBefore ?? '?'}→0 HP)`, ''];
    case 'WAVE_CLEAR': return [left + `WAVE CLEAR #${record.completedOrdinaryWaves ?? '?'} · next W${record.progression?.wave ?? '?'}`, 'wave'];
    case 'PROGRESSION': return [left + `PROGRESSION Stage ${record.progression?.region ?? '?'}-${record.progression?.stage ?? '?'} W${record.progression?.wave ?? '?'}`, ''];
    case 'BOSS_START': return [left + `BOSS START ${record.boss?.name || '?'} ${record.boss?.hp ?? '?'}/${record.boss?.maxHp ?? '?'} HP · game limit ${record.gameTimeLimitSec ?? '?'}s`, 'boss'];
    case 'BOSS_CLEAR': return [left + `BOSS CLEAR · ${record.boss?.lastSampledHp ?? '?'} last sampled HP before clear; exact finishing time/HP unknown`, 'boss'];
    case 'BOSS_TIMEOUT': return [left + `BOSS TIMEOUT · ${record.boss?.timeoutHp ?? '?'} HP left · game elapsed ${record.gameElapsedSec?.toFixed(1) ?? '?'}s · survivors ${record.timeoutHeroes?.map(h => `${h.name} ${h.hp}/${h.maxHp}`).join(', ') || 'unknown'}`, 'timeout'];
    case 'BOSS_EXIT': return [left + `BOSS EXIT ${record.outcome || ''}`, 'boss'];
    case 'SUMMON': return [left + `BOSS SUMMON ${record.policy || ''}`, 'boss'];
    case 'EQUIPMENT': return [left + `EQUIPMENT ${record.action || 'change'}`, ''];
    case 'SESSION_END': return [left + `END ${record.endReason || '?'} · clears ${record.completedOrdinaryWaves ?? '?'} · recoveries ${record.defeatRecoveries ?? '?'} · event gaps ${record.missingCombatEvents ?? '?'}`, 'end'];
    default: return [left + record.kind, ''];
  }
}
function modelLine(check) {
  const ref = check.refId == null ? '' : ` #${check.refId}`;
  if (check.kind === 'HIT_CHECK') return `       MODEL${ref}: HP ${check.predictedHpBefore ?? '?'} observed ${check.observedHpBefore ?? '?'} · assumed cap bound ≤${check.capBound ?? '?'}; raw/cap activation unknown`;
  if (check.kind === 'WAVE_HEAL_CHECK') return `       MODEL${ref}: wave heal predicted ${check.predicted?.join('–') ?? '?'} observed ${check.observed ?? '?'} · ${check.result || '?'}`;
  if (check.kind === 'RECOVERY_CHECK') return `       MODEL${ref}: recovery ${check.result || 'checked'}`;
  return `       MODEL${ref}: ${check.kind}`;
}
function addLine(message, tone, trim = true) {
  const line = document.createElement('div');
  line.className = `line ${tone}`;
  line.textContent = message;
  $('stream').append(line);
  if (trim) while ($('stream').childElementCount > 240) $('stream').firstElementChild.remove();
  $('stream').scrollTop = $('stream').scrollHeight;
}
function emit(record) {
  const [message, tone] = format(record);
  addLine(message, tone);
  if ($('models').checked && record.id != null) {
    const matchingKind = { HIT: 'HIT_CHECK', HEAL: 'WAVE_HEAL_CHECK', RECOVER: 'RECOVERY_CHECK' }[record.kind];
    for (const check of modelChecks.get(`${key(record)}|${record.id}`) || []) if (check.kind === matchingKind) addLine(modelLine(check), 'model');
  }
}
function renderState() {
  $('stage').textContent = `${state.region}-${state.stage} / W${state.wave}`;
  $('clears').textContent = String(state.clears);
  $('kos').textContent = `${state.kos} / ${state.recoveries}`;
  $('enemies').textContent = String(state.enemyKOs);
  $('clock').textContent = clock(simTime);
  $('seek').value = duration ? String(Math.round(1000 * simTime / duration)) : '0';
  const holder = $('heroes'); holder.replaceChildren();
  for (const hero of [...state.heroes.values()].sort((a, b) => a.uid - b.uid)) {
    const hp = Number(hero.hp), maxHp = Number(hero.maxHp), fraction = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    const card = document.createElement('div'); card.className = `hero ${hp <= 0 ? 'down' : fraction < .3 ? 'low' : ''}`;
    const top = document.createElement('div'); top.className = 'hero-top';
    const label = document.createElement('strong'); label.textContent = `${hero.name || '?'} L${hero.level ?? '?'}`;
    const value = document.createElement('span'); value.textContent = `${hero.hp ?? '?'}/${hero.maxHp ?? '?'} HP`;
    top.append(label, value);
    const bar = document.createElement('div'); bar.className = 'bar';
    const fill = document.createElement('span'); fill.style.width = `${fraction * 100}%`; bar.append(fill);
    card.append(top, bar); holder.append(card);
  }
  $('boss').textContent = state.boss ? `Boss active: ${state.boss.name || '?'} started at ${state.boss.hp ?? '?'}/${state.boss.maxHp ?? '?'} HP. Intermediate HP was not logged.` : state.bossResult ? `Last boss result: ${state.bossResult}` : 'No active boss in the observed record.';
}
function updateActivity() {
  $('play').textContent = playing ? 'Pause' : 'Play';
  $('activity').textContent = playing ? 'PLAYING OBSERVED RUN' : cursor >= run.length ? 'RUN ENDED' : 'PAUSED';
  $('activity').classList.toggle('paused', !playing);
}
function pause() { playing = false; updateActivity(); }
function play() {
  if (cursor >= run.length) rebuild(0);
  playing = true; lastFrame = performance.now(); updateActivity();
}
function rebuild(target) {
  resetState(); cursor = 0; simTime = Math.min(duration, Math.max(0, target));
  $('stream').replaceChildren();
  const tail = [];
  while (cursor < run.length && Number(run[cursor].t || 0) <= simTime) {
    const record = run[cursor++]; apply(record); tail.push(record);
    if (tail.length > 90) tail.shift();
  }
  tail.forEach(emit); renderState(); updateActivity();
}
function selectRun(autoplay = true) {
  pause();
  const scenario = $('scenario').value;
  const sessions = [...groups.get(scenario).keys()].sort((a, b) => a - b);
  const old = Number($('session').value);
  $('session').replaceChildren();
  for (const number of sessions) {
    const option = document.createElement('option');
    option.value = number;
    option.textContent = `Seed ${groups.get(scenario).get(number)[0].seed} · session ${number}`;
    $('session').append(option);
  }
  $('session').value = sessions.includes(old) ? String(old) : String(sessions[0]);
  chooseSession(autoplay);
}
function chooseSession(autoplay = true) {
  pause();
  run = groups.get($('scenario').value).get(Number($('session').value)) || [];
  duration = Math.max(0, Number(run.at(-1)?.t || 0));
  $('duration').textContent = clock(duration);
  const scenario = $('scenario').value;
  const claim = claimFile.claims.find(item => Object.values(item.scenarios || {}).flatMap(x => Array.isArray(x) ? x : Object.values(x || {}).flat()).includes(scenario));
  const verdict = report.results.find(item => item.id === claim?.id);
  $('verdict').textContent = verdict ? `${claim.id} ${verdict.verdict}` : 'NO CLAIM';
  $('verdict').className = `badge ${verdict?.verdict?.toLowerCase() || ''}`;
  $('expectation').textContent = claim ? `Expected: ${claim.expectation} Saved verdict covers the claim's full seed set.` : 'Exploratory scenario; see the detailed report for evidence limits.';
  rebuild(0);
  if (autoplay) play();
}
function frame(now) {
  if (playing) {
    simTime = Math.min(duration, simTime + Math.min(.1, (now - lastFrame) / 1000) * Number($('speed').value));
    while (cursor < run.length && Number(run[cursor].t || 0) <= simTime) emitAndApply(run[cursor++]);
    renderState();
    if (cursor >= run.length) pause();
  }
  lastFrame = now;
  requestAnimationFrame(frame);
}
function emitAndApply(record) { apply(record); emit(record); }
function fail(error) {
  pause();
  $('activity').textContent = 'LOAD ERROR';
  $('stream').replaceChildren();
  addLine(`Could not load combat evidence: ${error.message}. Serve this folder over localhost.`, 'ko');
}
async function load() {
  try {
    const [observed, model, verdict, claims, source] = await Promise.all([
      readGzip('observed.ndjson.gz'), readGzip('model.ndjson.gz'),
      fetch('verdict.json').then(r => r.json()), fetch('claims.json').then(r => r.json()), fetch('manifest.json').then(r => r.json())
    ]);
    report = verdict; claimFile = claims; manifest = source;
    for (const record of observed) {
      if (!groups.has(record.scenario)) groups.set(record.scenario, new Map());
      const sessions = groups.get(record.scenario);
      if (!sessions.has(record.session)) sessions.set(record.session, []);
      sessions.get(record.session).push(record);
    }
    for (const check of model) if (check.refId != null) {
      const id = `${key(check)}|${check.refId}`;
      if (!modelChecks.has(id)) modelChecks.set(id, []);
      modelChecks.get(id).push(check);
    }
    const sameTimeOrder = { SESSION_START: 0, HIT: 10, ENEMY_KO: 10, KO: 11, BOSS_TIMEOUT: 11.5, RECOVER: 12, RECOVERY_TRANSITION: 13, BOSS_START: 14, WAVE_CLEAR: 15, HEAL: 16, BOSS_CLEAR: 17, BOSS_EXIT: 17, SESSION_END: 99 };
    for (const sessions of groups.values()) for (const records of sessions.values()) records.sort((a, b) => Number(a.t || 0) - Number(b.t || 0) || (sameTimeOrder[a.kind] ?? 50) - (sameTimeOrder[b.kind] ?? 50));
    for (const id of groups.keys()) { const option = document.createElement('option'); option.value = id; option.textContent = id; $('scenario').append(option); }
    $('scenario').value = groups.has('recovery-onehp') ? 'recovery-onehp' : groups.keys().next().value;
    $('source').textContent = `${observed.length.toLocaleString()} OBS records · ${groups.size} scenarios · candidate ${manifest.candidate?.sha?.slice(0, 12) || '?'} · saved evidence, not a new run`;
    selectRun();
    requestAnimationFrame(frame);
  } catch (error) { fail(error); }
}
$('scenario').addEventListener('change', () => selectRun());
$('session').addEventListener('change', () => chooseSession());
$('play').addEventListener('click', () => playing ? pause() : play());
$('step').addEventListener('click', () => { pause(); if (cursor < run.length) { const record = run[cursor++]; simTime = Number(record.t || 0); emitAndApply(record); renderState(); updateActivity(); } });
$('key').addEventListener('click', () => { pause(); const next = run.slice(cursor).find(r => ['KO', 'RECOVER', 'WAVE_CLEAR', 'BOSS_CLEAR', 'BOSS_TIMEOUT', 'SESSION_END'].includes(r.kind)); if (next) rebuild(Number(next.t || 0)); });
$('restart').addEventListener('click', () => { rebuild(0); play(); });
$('seek').addEventListener('input', () => { pause(); rebuild(Number($('seek').value) * duration / 1000); });
$('models').addEventListener('change', () => rebuild(simTime));
load();
