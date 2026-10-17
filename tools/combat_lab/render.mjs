// Text rendering for timelines and verdicts. Unknown values print as `?`; MODEL lines are always
// prefixed MODEL and placed beside, never instead of, the OBS line they discuss.

export const LEGEND = [
  '`OBS` unchanged-game observation · `MODEL` shadow prediction (never an observation) · `REQ` owner acceptance rule · `REF` direct StoneAge observation · `?` unmeasured or not exposed',
  '`HIT` applied hostile damage · `HEAL` effective healing · `KO` Hero reached 0 HP · `WAVE_CLEAR` ordinary clear from the runtime counter · `BOSS_START`/`BOSS_CLEAR`/`BOSS_TIMEOUT` boss attempt · `RECOVER` full-party restore event · `GAP` missing event ids · `DEADLOCK` no progress',
  '`t=` simulation seconds from session start for runtime events; `t≈… (poll)` marks harness-poll time for transitions the runtime does not timestamp',
  '`W1` event-time wave; `W~1` wave sampled at the poll that read the event',
  '`raw=?` pre-cap damage is not exposed; `cap=?` whether the cap bound is not exposed. MODEL lines may state a cap bound under declared assumptions A1/A2.',
  'Enemy KOs are counted per session but omitted from timelines unless requested.',
];

const fmt = value => (value == null ? '?' : value);
const waveLabel = record => (record.wave == null ? 'W?' : `W${record.waveSource === 'poll' ? '~' : ''}${record.wave}`);
const pollT = record => `t≈${fmt(record.t)} (poll)`;

export function obsLine(record) {
  switch (record.kind) {
    case 'HIT':
      return `OBS t=${fmt(record.t)} ${waveLabel(record)} ${fmt(record.source?.name)} → ${fmt(record.target?.name)} HIT ${record.damageType || 'unknown'} HP ${fmt(record.hpBefore)}→${fmt(record.hpAfter)} applied=${fmt(record.applied)} raw=${record.raw == null ? '?' : record.raw} cap=${record.cap == null ? '?' : record.cap}`;
    case 'HEAL':
      return `OBS t=${fmt(record.t)} ${waveLabel(record)} ${record.healSource === 'ordinary_wave_clear' ? 'wave-clear respite' : fmt(record.healerName)} → ${fmt(record.target?.name)} HEAL ${record.healSource} HP ${fmt(record.hpBefore)}→${fmt(record.hpAfter)} applied=${fmt(record.applied)}`;
    case 'KO':
      return `OBS t=${fmt(record.t)} ${waveLabel(record)} ${fmt(record.target?.name)} KO (event #${fmt(record.id)})`;
    case 'RECOVER':
      return `OBS t=${fmt(record.t)} ${fmt(record.target?.name)} RECOVER ${fmt(record.reason)} #${fmt(record.recoveryIndex)} HP ${fmt(record.hpBefore)}→${fmt(record.hpAfter)}`;
    case 'ENEMY_KO':
      return `OBS t=${fmt(record.t)} ${waveLabel(record)} ${fmt(record.source?.name)} → ${fmt(record.target?.name)} ENEMY_KO`;
    case 'WAVE_CLEAR':
    case 'WAVE_CLEAR_AMBIGUOUS':
      return `OBS ${pollT(record)} ${record.kind} stage ${fmt(record.progression?.region)}-${fmt(record.progression?.stage)} next W${fmt(record.progression?.wave)} clears=${fmt(record.completedOrdinaryWaves)}${record.kind === 'WAVE_CLEAR_AMBIGUOUS' ? ` delta=${fmt(record.delta)} (order vs events unknown)` : ''}`;
    case 'BOSS_START':
      return `OBS ${pollT(record)} BOSS_START ${fmt(record.boss?.name)} HP ${fmt(record.boss?.hp)}/${fmt(record.boss?.maxHp)} limit=${fmt(record.gameTimeLimitSec)}s party ${(record.heroes || []).map(hero => `${hero.name} L${hero.level} ${hero.hp}/${hero.maxHp}`).join(', ')}`;
    case 'BOSS_CLEAR':
      return `OBS ${pollT(record)} BOSS_CLEAR last sampled boss HP ${fmt(record.boss?.lastSampledHp)} (sample precedes the clear; not settlement HP)`;
    case 'BOSS_TIMEOUT':
      return `OBS ${pollT(record)} BOSS_TIMEOUT boss ${fmt(record.boss?.timeoutHp)}/${fmt(record.boss?.maxHp)} elapsed=${fmt(record.gameElapsedSec)}s living=${record.timeoutHeroes ? record.timeoutHeroes.filter(hero => hero.hp > 0).length : '?'}`;
    case 'BOSS_KO_RECOVERY':
    case 'BOSS_EXIT':
      return `OBS ${pollT(record)} ${record.kind} outcome=${fmt(record.outcome)}`;
    case 'SUMMON':
      return `OBS ${pollT(record)} SUMMON boss (policy ${fmt(record.policy)})`;
    case 'GAP':
      return `OBS ${pollT(record)} GAP ids ${record.afterId + 1}..${record.nextId - 1} missing=${record.missing} → later state UNKNOWN`;
    case 'DEADLOCK':
      return `OBS ${pollT(record)} DEADLOCK`;
    case 'HERO_STATE':
      return `OBS ${pollT(record)} ${record.hero.name} state L${record.hero.level} maxHP ${record.hero.maxHp} CP ${record.hero.combatPower}`;
    case 'RECOVERY_TRANSITION':
      return `OBS ${pollT(record)} RECOVERY_TRANSITION ${record.transition} stage ${fmt(record.before?.region)}-${fmt(record.before?.stage)} W${fmt(record.before?.wave)} → ${fmt(record.after?.region)}-${fmt(record.after?.stage)} W${fmt(record.after?.wave)}`;
    case 'SESSION_START':
      return `OBS t=0 SESSION_START seed ${record.seed} party ${(record.heroes || []).map(hero => `${hero.name} L${hero.level} ${hero.hp}/${hero.maxHp}`).join(', ')} autoEquip=${record.autoEquip} bossPolicy=${record.bossPolicy}`;
    case 'SESSION_END':
      return `OBS ${pollT(record)} SESSION_END ${record.endReason} clears=${record.completedOrdinaryWaves} recoveries=${fmt(record.defeatRecoveries)} gaps=${record.missingCombatEvents} deadlocks=${record.deadlockCount}`;
    default:
      return null;
  }
}

export function modelLine(record) {
  switch (record.kind) {
    case 'HIT_CHECK': {
      const relation = { at_bound: 'applied equals bound (capped or raw=bound; unknown which)', at_bound_or_hp_floor: 'at bound or HP floor', below_bound: 'below bound → cap did not bind', hp_floor: 'HP floor', above_bound: 'ABOVE bound → model rule disagrees', unknown: `cap bound unknown (${record.reason})` }[record.capRelation];
      return `MODEL t=${record.t} #${record.refId} cap≤${record.capBound == null ? '?' : record.capBound} (${record.capTier || '?'} tier, maxHP ${record.maxHpUsed.join('|')}; A1/A2) ${relation}; HP before predicted ${record.predictedHpBefore}${record.predictedHpBefore === record.observedHpBefore ? ' ✓' : ` ✗ observed ${record.observedHpBefore}`}`;
    }
    case 'WAVE_HEAL_CHECK':
      return `MODEL t=${record.t} #${record.refId} wave heal predicted ${record.predicted.join('|')} ${record.result === 'consistent' ? '✓' : `✗ observed ${record.observed}`} (A3)`;
    case 'RECOVERY_CHECK':
      return `MODEL t=${record.t} #${record.refId} recovery predicted full ${record.predictedHpAfter} ${record.result === 'consistent' ? '✓' : `✗ observed ${record.observedHpAfter}`} (A4)`;
    case 'BOSS_TIMER_CHECK':
      return `MODEL t=${record.t} boss timer ${record.result}${record.elapsed != null ? ` elapsed ${record.elapsed}s ≥ ${record.limit}s` : ''} (A7)`;
    case 'BOSS_CLEAR_RESTORE':
      return `MODEL t=${record.t} boss-clear restore applied (unlogged; A5)`;
    case 'DIVERGENCE':
      return `MODEL t=${record.t} #${fmt(record.refId)} DIVERGENCE ${record.code}: ${record.detail}`;
    case 'STOP':
      return `MODEL t=${record.t} STOP ${record.reason}`;
    default:
      return null;
  }
}

// Interleave OBS records with the MODEL lines that reference them.
export function renderTimeline(session, replay, { includeEnemyKOs = false, includeHeroState = true, maxLines = Infinity } = {}) {
  const byRef = new Map();
  const unbound = [];
  for (const record of replay?.records || []) {
    if (record.refId != null) {
      if (!byRef.has(record.refId)) byRef.set(record.refId, []);
      byRef.get(record.refId).push(record);
    } else unbound.push(record);
  }
  const lines = [];
  const records = session.records.slice().sort((a, b) => (a.evidence?.line ?? 0) - (b.evidence?.line ?? 0));
  let enemyKOs = 0;
  for (const record of records) {
    if (record.kind === 'ENEMY_KO') { enemyKOs += 1; if (!includeEnemyKOs) continue; }
    if (record.kind === 'HERO_STATE' && !includeHeroState) continue;
    const line = obsLine(record);
    if (line) lines.push(line);
    if (record.kind !== 'KO' && record.id != null) for (const model of byRef.get(record.id) || []) { const text = modelLine(model); if (text) lines.push(text); }
    if (['BOSS_TIMEOUT', 'BOSS_CLEAR', 'GAP'].includes(record.kind)) for (const model of unbound.filter(entry => entry.t === record.t)) { const text = modelLine(model); if (text) lines.push(text); }
  }
  const truncated = lines.length > maxLines;
  return { lines: truncated ? lines.slice(0, maxLines) : lines, truncated, totalLines: lines.length, enemyKOs };
}

const link = evidence => (evidence?.path ? `[${evidence.path.split('/').slice(-2).join('/')}](${evidence.path})${evidence.sha256 ? ` \`${evidence.sha256.slice(0, 12)}\`` : ''}${evidence.status && evidence.status !== 'present' ? ` (${evidence.status})` : ''}` : '—');

function table(header, rows) {
  return [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`, ...rows.map(row => `| ${row.map(cell => String(cell ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`)].join('\n');
}

function perSeedTable(rows, columns) {
  return table(['seed', 'verdict', ...columns.map(([label]) => label), 'reasons'], rows.map(row => [row.seed, row.verdict, ...columns.map(([, get]) => get(row)), (row.reasons || [row.reason]).filter(Boolean).join('; ')]));
}

function sourceList(doc, ids, kind) {
  const list = doc.sources?.[kind] || [];
  return ids.map(id => list.find(source => source.id === id)).filter(Boolean).map(source => `${kind} ${source.id}: ${source.text} (${source.ref})`);
}

export function renderVerdict({ doc, evaluation, manifest, timelineFile }) {
  const out = [];
  out.push(`# ORKA-7l9 combat knowledge lab verdict`, '');
  out.push(`Generated ${manifest.generatedAt}. Claims \`${manifest.claims.path}\` SHA-256 \`${manifest.claims.sha256?.slice(0, 16)}\`, declaration: **${manifest.claims.declaration.status}**${manifest.claims.declaration.commit ? ` at commit \`${manifest.claims.declaration.commit.slice(0, 12)}\` (${manifest.claims.declaration.committedAt})` : ''}. Candidate runtime baseline \`${doc.candidate.sha.slice(0, 12)}\`. Lab HEAD \`${manifest.repo.head?.slice(0, 12)}\` patch \`${manifest.repo.patchSha256?.slice(0, 8)}\`. Shadow model \`${evaluation.model.version}\`.`, '');
  out.push('A passing parser or shadow model is not proof of good combat design. PASS below certifies only the stated fixture and observable.', '');
  out.push('## Legend', '', ...LEGEND.map(line => `- ${line}`), '');
  out.push('## Design verdict', '', `**${evaluation.design.verdict}**`, '', table(['pillar', 'claim', 'verdict'], evaluation.design.pillars.map(pillar => [pillar.pillar, pillar.claim, pillar.verdict])), '');
  out.push('## Claims', '', table(['claim', 'verdict', 'tests', 'REQ', 'REF', 'OBS summary', 'MODEL summary', 'UNKNOWN'], evaluation.results.map(result => [result.id, result.verdict, result.tests, result.requirements.join(', '), result.references.join(', '), obsSummary(result), modelSummaryText(result), result.unknowns.join('; ')])), '');
  for (const result of evaluation.results) {
    out.push(`## ${result.id}: ${result.title}`, '');
    out.push(`Verdict **${result.verdict}**. Tests: ${result.tests}. Expectation (declared before prospective runs): ${result.expectation}`, '');
    const sources = [...sourceList(doc, result.requirements, 'REQ'), ...sourceList(doc, result.references, 'REF')];
    if (sources.length) out.push(...sources.map(line => `- ${line}`), '');
    out.push(...detail(result), '');
  }
  out.push('## Scenario provenance', '', table(['scenario', 'timing', 'fixture class', 'evidence', 'game source', 'admissible', 'problems'], [...evaluation.loaded.values()].map(loaded => [loaded.scenario.id, loaded.scenario.timing, loaded.scenario.fixtureClass, link(loaded.evidence.eventLog.status === 'present' ? loaded.evidence.eventLog : loaded.evidence.report.path ? loaded.evidence.report : loaded.evidence.eventLog), loaded.gameSource?.status ?? 'unknown', loaded.admissible ? 'yes' : 'no', loaded.problems.join('; ')])), '');
  out.push('## Model assumptions', '', table(['id', 'name', 'statement', 'basis'], evaluation.model.assumptions.map(entry => [entry.id, entry.name, entry.statement, entry.basis])), '');
  if (timelineFile) out.push(`Timeline: [${timelineFile.split('/').pop()}](${timelineFile.split('/').pop()})`, '');
  return `${out.join('\n')}\n`;
}

function obsSummary(result) {
  switch (result.kind) {
    case 'starter_farming':
    case 'recovery':
      return result.rows.map(row => `${row.scenario}: ${row.verdict} (${row.perSeed.filter(seed => seed.verdict === 'PASS').length}/${row.perSeed.length} seeds)`).join('; ');
    case 'pressure':
      return `outcome sensitivity ${result.subResults.defensiveUpgradeChangesOutcome}, margin sensitivity ${result.subResults.defensiveUpgradeChangesMargin}`;
    case 'cap_share':
      return `${result.observed.hits} hits; capped share ${result.observed.cappedHitShare}`;
    case 'kaja_healing':
      return `L1 zero ${result.subResults.level1SkillHealingZero}; L15 occurs ${result.subResults.level15SkillHealingOccurs}`;
    case 'first_boss':
      return `underprepared ${result.subResults.underpreparedTimeoutsWithLivingParty}; progressed ${result.subResults.progressedWins}; earned ${result.subResults.earnedArrivalClears}; synthetic threshold all-clear L${result.threshold.lowestLevelAllSeedsClear ?? '?'}`;
    default:
      return '';
  }
}

function modelSummaryText(result) {
  if (result.kind === 'cap_share') return result.model.cappedShareInterval ? `capped share ∈ [${result.model.cappedShareInterval.join(', ')}] under A1/A2` : 'no replay';
  if (result.rows) return result.rows.map(row => `${row.scenario}: ${row.model.status}`).join('; ');
  if (result.kind === 'pressure') return 'survival envelope + no-heal counterfactual (see detail)';
  if (result.kind === 'kaja_healing') return 'remove-healer counterfactual (see detail)';
  return '—';
}

function detail(result) {
  const out = [];
  if (result.kind === 'starter_farming' || result.kind === 'recovery') {
    for (const row of result.rows) {
      out.push(`### ${row.scenario} (${row.timing}) — ${row.verdict}`, '', `Evidence: ${link(row.evidence)}${row.reason ? `. ${row.reason}` : ''}`, '');
      if (row.perSeed.length) out.push(result.kind === 'starter_farming'
        ? perSeedTable(row.perSeed, [['clears', r => r.clears], ['Hero KOs', r => r.heroKOs], ['gaps', r => r.gaps], ['deadlocks', r => r.deadlocks], ['end', r => r.endReason]])
        : perSeedTable(row.perSeed, [['initial KO', r => r.initialKO ? `${r.initialKO.name} t=${r.initialKO.t}` : '?'], ['restored', r => (r.restored || []).map(hero => `${hero.name} ${hero.hpAfter}/${hero.maxHp ?? '?'}`).join(', ')], ['same stage/wave', r => r.sameStageWave], ['post-recovery clears', r => r.postRecoveryClears], ['extra KOs', r => r.additionalKOs], ['boss attempts', r => (r.bossAttempts || []).join(' ')], ['end', r => r.endReason]]), '');
      out.push(`MODEL control replay: ${row.model.status}${row.model.checks != null ? ` over ${row.model.checks} checks` : ''}${row.model.reason ? ` (${row.model.reason})` : ''}.`);
      for (const session of row.model.sessionsDiverged || []) if (session.firstDivergence) out.push(`- first divergence t=${session.firstDivergence.t} #${session.firstDivergence.refId ?? '?'} ${session.firstDivergence.code}: ${session.firstDivergence.detail} (${session.divergences} total)`);
      out.push('');
    }
  } else if (result.kind === 'pressure') {
    out.push(result.reason, '');
    for (const scenario of result.margins) {
      out.push(`### HP margins — ${scenario.scenario}`, '', `Evidence: ${link(scenario.evidence)}${scenario.admissible ? '' : ` — inadmissible: ${scenario.problems.join('; ')}`}`, '');
      out.push(table(['seed', 'Hero', 'start', 'min event HP / max HP at min', 'min ratio', 'hits', 'applied', 'applied amounts', 'healing by source', 'max hits in a wave', 'MODEL max survivable uniform hits/wave (no heal)'], scenario.sessions.flatMap(session => session.heroes.map(hero => [session.seed, hero.name, `${hero.startHp}/${hero.startMaxHp}`, `${hero.minEventHp}/${hero.maxHpAtMin ?? '?'}${hero.maxHpAtMinUncertain ? ' (max HP changed within poll window)' : ''}`, hero.minHpRatio ?? '?', hero.hits, hero.appliedDamage, JSON.stringify(hero.appliedByAmount), JSON.stringify(hero.healing), hero.hitsPerWave?.maxHitsInWave ?? '?', `${hero.model.envelope.maxSurvivableUniformHitsPerWave ?? '?'} (${hero.model.envelope.maxSurvivableWithoutHeal ?? '?'})`]))), '');
      out.push('MODEL no-heal counterfactual over the frozen trace (stops when altered HP could change later events):', '');
      out.push(table(['seed', 'complete', 'cutoff', 'Hero altered min HP before cutoff'], scenario.sessions.map(session => [session.seed, session.noHealCounterfactual.complete, session.noHealCounterfactual.cutoff ? `t=${session.noHealCounterfactual.cutoff.t} ${session.noHealCounterfactual.cutoff.reason}: ${session.noHealCounterfactual.cutoff.detail}` : 'none (trace end)', session.noHealCounterfactual.heroes.map(hero => `${hero.name} ${hero.alteredMinHpBeforeCutoff} (obs ${hero.observedMinHp})`).join(', ')])), '');
    }
    out.push('### Matched defensive-gear sensitivity (OBS)', '');
    for (const entry of result.sensitivity) {
      out.push(`- ${entry.variant}${entry.change ? ` (${entry.change})` : ''}: outcome change **${entry.outcome}**, margin change **${entry.margin}**${entry.reason ? ` — ${entry.reason}` : ''}`);
      for (const pair of entry.pairs || []) if (pair.status !== 'missing') out.push(`  - seed ${pair.seed}: base ${JSON.stringify(pair.base.outcome)} hits=${pair.base.margin.hits} applied=${pair.base.margin.applied} min ratios ${JSON.stringify(pair.base.margin.minRatio)} | variant ${JSON.stringify(pair.variant.outcome)} hits=${pair.variant.margin.hits} applied=${pair.variant.margin.applied} min ratios ${JSON.stringify(pair.variant.margin.minRatio)}`);
    }
  } else if (result.kind === 'cap_share') {
    out.push(`OBS: ${result.observed.hits} Hero hits; pre-cap values observed: ${result.observed.preCapValuesObserved}. Capped-hit share: **${result.observed.cappedHitShare}** — ${result.observed.reason}.`, '');
    out.push(`OBS actor tier → EnemyData (cap input) tier: ${JSON.stringify(result.observed.actorTierToCapTier)}`, '');
    out.push(`MODEL (${result.model.assumptions.join(', ')}): ${JSON.stringify(result.model.relations)}; capped share interval ${JSON.stringify(result.model.cappedShareInterval)}; definitely uncapped share ${result.model.definitelyUncappedShare}. ${result.model.note}`, '');
    if (result.sampleLines.length) out.push('Retained maximum-hit samples from pinned aggregate reports:', '', ...result.sampleLines.map(line => `- \`OBS t=${line.t} W${line.wave} ${line.source.name} → ${line.target.name} HIT ${line.damageType} HP ${line.hpBefore}→${line.hpAfter} applied=${line.applied} raw=? cap=?\``), '');
  } else if (result.kind === 'kaja_healing') {
    for (const [key, entry] of Object.entries(result.scenarios)) {
      if (!entry) { out.push(`- ${key}: not declared`); continue; }
      out.push(`- ${key} (${entry.scenario}, healer level ${entry.level ?? '?'}): ${entry.admissible ? '' : `inadmissible: ${entry.problems.join('; ')} `}${link(entry.evidence)}`);
      for (const session of entry.sessions) out.push(`  - seed ${session.seed}: healer skill healing ${session.healerSkillHealing}, wave-clear healing ${session.waveClearHealing}, Hero KOs ${session.heroKOs}, clears ${session.clears}${session.removeHealerCounterfactual ? `; MODEL remove-healer cutoff ${session.removeHealerCounterfactual.cutoff ? `t=${session.removeHealerCounterfactual.cutoff.t} ${session.removeHealerCounterfactual.cutoff.reason}` : 'none'}, altered mins ${session.removeHealerCounterfactual.heroes.map(hero => `${hero.name} ${hero.alteredMinHpBeforeCutoff}`).join(', ')}` : ''}`);
    }
    out.push('', `Outcome change (OBS, confounded by party size): L1 ${result.outcomeChange.level1.result}; L15 ${result.outcomeChange.level15.result}.`);
  } else if (result.kind === 'first_boss') {
    out.push(table(['scenario', 'level', 'class', 'timing', 'first-attempt clears', 'timeouts', 'seeds', 'attempt detail', 'admissible'], result.sweep.map(entry => [entry.scenario, entry.level, entry.fixtureClass, entry.timing, entry.clears, entry.timeouts, entry.seeds, entry.attempts.map(attempt => `${attempt.seed}:${attempt.outcome}${attempt.timeoutBossHp != null ? ` ${attempt.timeoutBossHp}/${attempt.bossMaxHp ?? '?'}` : ''}${attempt.livingAtTimeout != null ? ` living ${attempt.livingAtTimeout}` : ''}`).join('; '), entry.admissible ? 'yes' : `no: ${entry.problems.join('; ')}`])), '');
    out.push(`Synthetic fixed-gear threshold (OBS): lowest level with any first-attempt clear L${result.threshold.lowestLevelWithAnyClear ?? '?'}; all seeds clear L${result.threshold.lowestLevelAllSeedsClear ?? '?'}; levels measured ${result.threshold.levelsMeasured.join(', ') || 'none'}.`, '');
    out.push(`Earned arrival: **${result.earned.verdict}**${result.earned.reason ? ` — ${result.earned.reason}` : ''} ${link(result.earned.evidence)}`);
    for (const session of result.earned.sessions || []) out.push(`- seed ${session.seed}: ${session.verdict}; ordinary clears before first boss ${session.ordinaryClearsBeforeFirstBoss}; arrival ${session.arrival ? session.arrival.heroes.map(hero => `${hero.name} L${hero.level} ${hero.hp}/${hero.maxHp} CP ${hero.combatPower}`).join(', ') : '?'}; outcomes ${session.outcomes.join(' ') || 'none'}; end ${session.endReason}`);
  }
  return out;
}
