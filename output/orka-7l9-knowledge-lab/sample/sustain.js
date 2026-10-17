import { evaluateSustainCase, gradeSustainCase } from './sustain-model.mjs';

const $ = id => document.getElementById(id);
const inputs = ['mitigation', 'evasion', 'drain', 'interval', 'regen', 'pressure'];
let cases = [];
let observed = [];
let selected = null;
let active = null;
let cursor = 0;
let elapsed = 0;
let playing = false;
let lastFrame = 0;
let playedMin = null;
let playedHits = 0;
let playedHealing = 0;

async function readGzip(path) {
  const response = await fetch(path);
  if (!response.ok || !response.body) throw new Error(`${path}: HTTP ${response.status}`);
  const decoded = response.body.pipeThrough(new DecompressionStream('gzip'));
  return (await new Response(decoded).text()).trim().split('\n').filter(Boolean).map(JSON.parse);
}

function clock(seconds) {
  const ms = Math.round(Math.max(0, seconds) * 1000);
  const min = Math.floor(ms / 60000);
  return `${String(min).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}

function nice(value) { return Number(value).toFixed(1).replace(/\.0$/, ''); }
function badge(status) { return `<span class="badge ${status.toLowerCase()}">${status}</span>`; }
function ruleText(expectation) {
  const parts = [];
  if (expectation.maxHeroKOs != null) parts.push(`Hero KOs ≤ ${expectation.maxHeroKOs}`);
  if (expectation.minHeroKOs != null) parts.push(`Hero KOs ≥ ${expectation.minHeroKOs}`);
  if (expectation.minHpFractionAtLeast != null) parts.push(`min HP ≥ ${nice(expectation.minHpFractionAtLeast * 100)}%`);
  return parts.join(' · ');
}

function modelFromInputs() {
  return {
    mitigationFraction: Number($('mitigation').value) / 100,
    evasionFraction: Number($('evasion').value) / 100,
    drainHpPerStrike: Number($('drain').value),
    attackIntervalSeconds: $('interval').value === '' ? null : Number($('interval').value),
    regenHpPerSecond: Number($('regen').value),
    pressureMultiplier: Number($('pressure').value),
    evadeSeed: selected?.model.evadeSeed ?? 0,
  };
}

function sameModel(a, b) {
  return ['mitigationFraction', 'evasionFraction', 'drainHpPerStrike', 'regenHpPerSecond', 'pressureMultiplier', 'evadeSeed']
    .every(key => Number(a[key] ?? 0) === Number(b[key] ?? 0)) &&
    (a.attackIntervalSeconds == null ? b.attackIntervalSeconds == null : Number(a.attackIntervalSeconds) === Number(b.attackIntervalSeconds));
}

function fillInputs(model) {
  $('mitigation').value = nice(model.mitigationFraction * 100);
  $('evasion').value = nice(model.evasionFraction * 100);
  $('drain').value = model.drainHpPerStrike;
  $('interval').value = model.attackIntervalSeconds ?? '';
  $('regen').value = model.regenHpPerSecond;
  $('pressure').value = model.pressureMultiplier;
}

function renderTracker() {
  const body = $('cases');
  body.replaceChildren();
  const primary = item => /^S(?:19|2[0-5])-/.test(item.id);
  const ordered = [...cases].sort((a, b) => Number(primary(b)) - Number(primary(a)));
  for (const item of ordered) {
    const result = evaluateSustainCase(observed, item);
    const grade = gradeSustainCase(result.summary, item.expectation);
    const row = document.createElement('tr');
    row.tabIndex = 0;
    row.setAttribute('aria-label', `Select ${item.id}: ${item.title}`);
    row.dataset.caseId = item.id;
    const cells = [item.id, item.title, ruleText(item.expectation), grade.status,
      result.summary.minHpFraction == null ? '?' : `${nice(result.summary.minHpFraction * 100)}%`,
      String(result.summary.heroKoCount + result.summary.observedOtherHeroKoCount)];
    cells.forEach((value, index) => {
      const cell = document.createElement('td');
      if (index === 3) cell.innerHTML = badge(value);
      else cell.textContent = value;
      row.append(cell);
    });
    row.addEventListener('click', () => selectCase(item.id));
    row.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectCase(item.id); } });
    body.append(row);
  }
}

function pause() { playing = false; $('play').textContent = 'Play'; $('activity').textContent = 'PAUSED'; }

function resetPlayback() {
  pause();
  cursor = 0;
  elapsed = 0;
  playedMin = active?.summary.initialHp ?? null;
  playedHits = 0;
  playedHealing = 0;
  $('stream').replaceChildren();
  $('hp').textContent = active ? `${nice(active.summary.initialHp)} / ${nice(active.summary.maxHp)}` : '—';
  $('minimum').textContent = active ? `${nice(active.summary.initialHp)} (${nice(active.summary.initialHp / active.summary.maxHp * 100)}%)` : '—';
  $('hits').textContent = '0';
  $('healing').textContent = '0';
  $('clock').textContent = clock(0);
}

function appendStep() {
  if (!active || cursor >= active.steps.length) return;
  const step = active.steps[cursor++];
  const line = document.createElement('div');
  line.className = `line ${step.kind.toLowerCase()}`;
  line.textContent = `${clock(step.elapsed)}  ${step.label.padEnd(5)} ${step.kind.padEnd(9)} ${step.detail}  · HP ${nice(step.hpBefore)} → ${nice(step.hpAfter)}`;
  $('stream').append(line);
  $('stream').scrollTop = $('stream').scrollHeight;
  playedMin = Math.min(playedMin, step.hpAfter);
  if (step.kind === 'HIT' || step.kind === 'EVADE') playedHits += 1;
  if (step.kind === 'REGEN' || step.kind === 'DRAIN') playedHealing += step.amount;
  $('hp').textContent = `${nice(step.hpAfter)} / ${nice(active.summary.maxHp)}`;
  $('minimum').textContent = `${nice(playedMin)} (${nice(playedMin / active.summary.maxHp * 100)}%)`;
  $('hits').textContent = String(playedHits);
  $('healing').textContent = nice(playedHealing);
  $('clock').textContent = clock(step.elapsed);
  if (cursor >= active.steps.length) { pause(); $('activity').textContent = 'END'; }
}

function frame(now) {
  if (!playing) return;
  elapsed += Math.max(0, now - lastFrame) / 1000 * Number($('speed').value);
  lastFrame = now;
  while (cursor < active.steps.length && active.steps[cursor].elapsed <= elapsed) appendStep();
  if (playing) requestAnimationFrame(frame);
}

function runSettings() {
  if (!selected) return;
  const model = modelFromInputs();
  const tracked = sameModel(model, selected.model);
  active = evaluateSustainCase(observed, { ...selected, id: tracked ? selected.id : `${selected.id}:custom`, model });
  const grade = gradeSustainCase(active.summary, selected.expectation);
  resetPlayback();
  $('result').textContent = tracked ? grade.status : `${grade.status}*`;
  $('rule').textContent = `${selected.id} · ${ruleText(selected.expectation)}${tracked ? ' · tracked MODEL case' : ' · *exploratory edit; no saved tracker result'}`;
  $('source').textContent = `${active.source.scenario} session ${active.source.session}, seed ${active.source.seed ?? '?'} · ${active.source.hero} · ${active.source.wave == null ? 'boss' : `ordinary wave ${active.source.wave}`} · ${clock(active.source.endTime - active.source.startTime)} observed window · ${active.summary.sourceIncomingHitCount} incoming hits · ${active.summary.enemyKoCount} observed enemy KOs`;
  $('interpretation').textContent = active.summary.invalidReasons.length ? active.summary.invalidReasons.join('; ') :
    `ONE-HERO MODEL ${grade.status}: minimum ${nice(active.summary.minHpFraction * 100)}% HP; ${active.summary.heroKoCount + active.summary.observedOtherHeroKoCount} Hero KO; ${active.summary.evadedHits} avoided hits; ${nice(active.summary.preventedByDefense)} HP shielded; ${nice(active.summary.regenHealing)} HP regenerated; ${nice(active.summary.drainHealing)} HP drained. ${grade.reasons.join('; ')}. Full-party 20-wave result remains separate.`;
  $('activity').textContent = 'READY';
}

function selectCase(id) {
  selected = cases.find(item => item.id === id);
  if (!selected) return;
  $('case').value = id;
  fillInputs(selected.model);
  document.querySelectorAll('#cases tr').forEach(row => row.classList.toggle('selected', row.dataset.caseId === id));
  runSettings();
}

$('case').addEventListener('change', event => selectCase(event.target.value));
$('run').addEventListener('click', runSettings);
$('play').addEventListener('click', () => {
  if (!active) return;
  if (playing) { pause(); return; }
  if (cursor >= active.steps.length) resetPlayback();
  playing = true;
  lastFrame = performance.now();
  $('play').textContent = 'Pause';
  $('activity').textContent = 'STREAMING';
  requestAnimationFrame(frame);
});
$('step').addEventListener('click', () => { pause(); appendStep(); });
$('restart').addEventListener('click', resetPlayback);

try {
  const [caseResponse, rows] = await Promise.all([fetch('../sustain-cases.json'), readGzip('observed.ndjson.gz')]);
  if (!caseResponse.ok) throw new Error(`sustain-cases.json: HTTP ${caseResponse.status}`);
  const book = await caseResponse.json();
  cases = book.cases || [];
  observed = rows;
  for (const item of cases) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.id} · ${item.title}`;
    $('case').append(option);
  }
  renderTracker();
  selectCase(cases.find(item => item.id === 'S21-def-regen-95')?.id ?? cases[0]?.id);
} catch (error) {
  $('activity').textContent = 'LOAD ERROR';
  $('stream').textContent = error.message;
}
