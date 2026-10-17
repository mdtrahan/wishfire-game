#!/usr/bin/env node
// ORKA-7l9 combat knowledge lab. Commands:
//   evaluate --claims <file> --out <dir> [--timelineLines 400] [--fullTimelines] [--gzipStreams]
//   commands --claims <file>            print exact harness commands for prospective scenarios
//   fixtures --out <dir>                synthetic level-sweep and matched gear fixtures
// The lab reads harness evidence and Git objects. It never edits Wishfire runtime code or values.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { evaluateClaims } from './combat_lab/claims.mjs';
import { claimDeclaration, fileEvidence, sha256Bytes, EMPTY_PATCH_SHA256 } from './combat_lab/provenance.mjs';
import { renderTimeline, renderVerdict, LEGEND } from './combat_lab/render.mjs';
import { aggregateSampleHit } from './combat_lab/observed.mjs';

const REPO = process.cwd();
const LAB_FILES = ['tools/combat_knowledge_lab.mjs', 'tools/combat_lab/provenance.mjs', 'tools/combat_lab/observed.mjs', 'tools/combat_lab/metrics.mjs', 'tools/combat_lab/model.mjs', 'tools/combat_lab/claims.mjs', 'tools/combat_lab/render.mjs', 'tools/balance_harness.js'];

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    if (!rest[index].startsWith('--')) continue;
    const key = rest[index].slice(2);
    const next = rest[index + 1];
    if (next !== undefined && !next.startsWith('--')) { options[key] = next; index += 1; } else options[key] = true;
  }
  return { command, options };
}

function repoFingerprint(repo) {
  const run = args => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  const head = run(['rev-parse', 'HEAD']).trim();
  const diff = execFileSync('git', ['diff', '--binary', 'HEAD'], { cwd: repo });
  const untracked = run(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean).sort()
    .map(file => ({ path: file, sha256: sha256Bytes(fs.readFileSync(path.join(repo, file))) }));
  return { head, patchSha256: sha256Bytes(Buffer.concat([diff, Buffer.from(JSON.stringify(untracked))])), clean: diff.length === 0 && untracked.length === 0, emptyPatchSha256: EMPTY_PATCH_SHA256 };
}

// gzip output has no timestamp or name, so identical records give identical bytes.
function writeNdjson(file, records, gzip = false) {
  const text = records.map(record => JSON.stringify(record, (key, value) => (key === '__line' ? undefined : value))).join('\n') + (records.length ? '\n' : '');
  if (gzip) fs.writeFileSync(`${file}.gz`, gzipSync(Buffer.from(text, 'utf8'), { level: 9 }));
  else fs.writeFileSync(file, text, 'utf8');
}

export function harnessCommand(scenario, claimsDir = REPO) {
  const run = scenario.run;
  if (!run) return null;
  const args = ['node', 'tools/balance_harness.js'];
  for (const [key, value] of Object.entries(run)) args.push(`--${key}`, String(value));
  args.push('--eventLog', scenario.evidence.eventLog);
  if (!run.outputDir && scenario.evidence.report) args.push('--outputDir', path.dirname(scenario.evidence.report));
  return args.map(part => (/[\s,]/.test(part) || part === '' ? `'${part}'` : part)).join(' ');
}

async function evaluate(options) {
  if (!options.claims || !options.out) throw new Error('evaluate requires --claims and --out');
  const claimsPath = path.resolve(options.claims);
  const out = path.resolve(options.out);
  const claimsBytes = fs.readFileSync(claimsPath);
  const doc = JSON.parse(claimsBytes.toString('utf8'));
  const declaration = claimDeclaration(REPO, claimsPath);
  const evaluation = evaluateClaims(doc, { repo: REPO, declaration });
  fs.mkdirSync(out, { recursive: true });
  const manifest = {
    schema: 'orka.combat-lab-manifest.v1',
    generatedAt: new Date().toISOString(),
    repo: repoFingerprint(REPO),
    lab: Object.fromEntries(LAB_FILES.map(file => [file, fileEvidence(path.join(REPO, file)).sha256 ?? null])),
    claims: { path: path.relative(REPO, claimsPath), sha256: sha256Bytes(claimsBytes), declaration },
    candidate: doc.candidate,
    model: { version: evaluation.model.version, assumptions: evaluation.model.assumptions.map(entry => entry.id) },
    scenarios: [...evaluation.loaded.values()].map(loaded => ({
      id: loaded.scenario.id, timing: loaded.scenario.timing, fixtureClass: loaded.scenario.fixtureClass, kind: loaded.kind, admissible: loaded.admissible, problems: loaded.problems,
      evidence: loaded.evidence, startedAt: loaded.startedAt ?? null, gameSource: loaded.gameSource ?? null,
      runSource: loaded.log?.header?.source ?? loaded.report?.run?.source ?? null, harnessSource: loaded.log?.header?.harnessSource ?? loaded.report?.run?.harnessSource ?? null,
      expect: loaded.scenario.expect || null, command: harnessCommand(loaded.scenario),
      sessions: loaded.facts.map(facts => ({ session: facts.session, seed: facts.seed, endReason: facts.endReason, issues: facts.issues })),
    })),
  };
  fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(out, 'claims.json'), claimsBytes);
  const observed = [];
  const model = [];
  const timeline = ['# ORKA-7l9 combat timeline', '', ...LEGEND.map(line => `- ${line}`), ''];
  const timelineLines = Number(options.timelineLines || 400);
  for (const loaded of evaluation.loaded.values()) {
    if (loaded.log) {
      loaded.log.sessions.forEach((session, index) => {
        observed.push(...session.records);
        const replay = loaded.replays[index];
        model.push(...replay.records, { label: 'MODEL', kind: 'REPLAY_SUMMARY', scenario: loaded.scenario.id, session: session.session, seed: session.seed, status: replay.status, checks: replay.checks, divergences: replay.divergences.length, firstDivergence: replay.firstDivergence, stoppedAt: replay.stoppedAt });
        const rendered = renderTimeline(session, replay, { maxLines: options.fullTimelines ? Infinity : timelineLines });
        if (index === 0 || options.fullTimelines) {
          timeline.push(`## ${loaded.scenario.id} session ${session.session} seed ${session.seed}`, '', `Evidence: ${loaded.evidence.eventLog.path} (SHA-256 ${loaded.evidence.eventLog.sha256}). Enemy KOs omitted: ${rendered.enemyKOs}. Lines ${rendered.lines.length}/${rendered.totalLines}${rendered.truncated ? ' (truncated; rerun with --fullTimelines)' : ''}.`, '', '```text', ...rendered.lines, '```', '');
        }
      });
    } else if (loaded.report) {
      for (const session of loaded.report.sessions) {
        const line = aggregateSampleHit(session, loaded.scenario.id, loaded.scenario.evidence.report);
        if (line) observed.push({ ...line, coverage: 'aggregate_only_sample' });
      }
    }
  }
  for (const result of evaluation.results) {
    if (result.kind === 'pressure') for (const scenario of result.margins) for (const session of scenario.sessions) {
      for (const hero of session.heroes) model.push({ label: 'MODEL', kind: 'SURVIVAL_ENVELOPE', scenario: scenario.scenario, seed: session.seed, hero: hero.name, ...hero.model.envelope, observedMaxHitsPerWave: hero.model.observedMaxHitsPerWave });
      const { steps, ...summary } = session.noHealCounterfactual;
      model.push({ kind: 'COUNTERFACTUAL', scenario: scenario.scenario, seed: session.seed, ...summary });
    }
    if (result.kind === 'cap_share') model.push({ ...result.model, kind: 'CAP_SHARE_ESTIMATE' });
  }
  writeNdjson(path.join(out, 'observed.ndjson'), observed, !!options.gzipStreams);
  writeNdjson(path.join(out, 'model.ndjson'), model, !!options.gzipStreams);
  fs.writeFileSync(path.join(out, 'timeline.md'), `${timeline.join('\n').trimEnd()}\n`);
  const strip = value => JSON.parse(JSON.stringify(value, (key, entry) => (key === 'steps' || key === 'records' || key === '__line' ? undefined : entry)));
  fs.writeFileSync(path.join(out, 'verdict.json'), `${JSON.stringify({ design: evaluation.design, results: strip(evaluation.results), model: evaluation.model }, null, 2)}\n`);
  fs.writeFileSync(path.join(out, 'verdict.md'), `${renderVerdict({ doc, evaluation, manifest, timelineFile: path.join(out, 'timeline.md') }).trimEnd()}\n`);
  console.log(JSON.stringify({ design: evaluation.design.verdict, claims: evaluation.results.map(result => [result.id, result.verdict]), out }, null, 2));
}

function commands(options) {
  const doc = JSON.parse(fs.readFileSync(path.resolve(options.claims), 'utf8'));
  for (const scenario of doc.scenarios.filter(entry => entry.timing === 'prospective' && entry.run)) console.log(`# ${scenario.id}\n${harnessCommand(scenario)}`);
}

// Synthetic fixtures built with the game's own save constructors (data generation, not a model
// oracle). The level preset must reproduce the tracked level-5 fixture byte for byte first.
async function fixtures(options) {
  if (!options.out) throw new Error('fixtures requires --out');
  const out = path.resolve(options.out);
  const source = path.join(REPO, 'output/orka-7l9-fixtures');
  const { createHeroProgressStore, setHeroProgressLevel } = await import(pathToFileURL(path.join(REPO, 'web-runner/src/core/heroProgression.mjs')).href);
  const { validateConveyorState } = await import(pathToFileURL(path.join(REPO, 'web-runner/src/core/lampConveyor.mjs')).href);
  const level1 = JSON.parse(fs.readFileSync(path.join(source, 'level1-manual-ready-heroes.json'), 'utf8'));
  const atLevel = level => `${JSON.stringify({ ...level1, heroes: setHeroProgressLevel(createHeroProgressStore(JSON.parse(JSON.stringify(level1))), level).heroes }, null, 2)}\n`;
  const control = fs.readFileSync(path.join(source, 'level5-manual-ready-heroes.json'), 'utf8');
  if (atLevel(5) !== control) throw new Error('Level preset no longer reproduces level5-manual-ready-heroes.json; refusing to generate sweep fixtures');
  fs.mkdirSync(out, { recursive: true });
  const written = { levelPresetControl: { reproduced: 'level5-manual-ready-heroes.json', sha256: sha256Bytes(Buffer.from(control)) } };
  for (const level of [2, 3, 4]) {
    const file = path.join(out, `level${level}-manual-ready-heroes.json`);
    fs.writeFileSync(file, atLevel(level));
    written[path.basename(file)] = fileEvidence(file).sha256;
  }
  const baseLamp = JSON.parse(fs.readFileSync(path.join(source, 'ui-equipped-lamp.json'), 'utf8'));
  const variant = (name, edit) => {
    const lamp = JSON.parse(JSON.stringify(baseLamp));
    lamp.loadouts.Huun = { body: 'lamp:4242:3' };
    lamp.lamp.pending = lamp.lamp.pending.filter(id => id !== 'lamp:4242:3');
    for (const id of ['lamp:4242:0', 'lamp:4242:2', 'lamp:4242:3']) edit(lamp.items.find(item => item.instanceId === id).stats);
    validateConveyorState(lamp);
    const file = path.join(out, `gear-${name}-lamp.json`);
    fs.writeFileSync(file, `${JSON.stringify(lamp)}\n`);
    written[path.basename(file)] = fileEvidence(file).sha256;
  };
  variant('base', () => {});
  variant('def10', stats => { stats.DEF += 10; });
  variant('hp30', stats => { stats.HP += 30; });
  fs.writeFileSync(path.join(out, 'fixtures-manifest.json'), `${JSON.stringify(written, null, 2)}\n`);
  console.log(JSON.stringify(written, null, 2));
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === 'evaluate') return evaluate(options);
  if (command === 'commands') return commands(options);
  if (command === 'fixtures') return fixtures(options);
  throw new Error('usage: combat_knowledge_lab.mjs evaluate|commands|fixtures [options]');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(`[combat-lab] ${error.message}`); process.exitCode = 1; });
}
