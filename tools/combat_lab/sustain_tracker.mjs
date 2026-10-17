// Run predeclared MODEL sustain cases against the pinned, unchanged OBS stream.
// One case report per source/spec/model hash lets parallel agents skip duplicate work.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { evaluateSustainCase, gradeSustainCase } from '../../output/orka-7l9-knowledge-lab/sample/sustain-model.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const DEFAULT_SPEC = 'output/orka-7l9-knowledge-lab/sustain-cases.json';
const DEFAULT_OUT = 'output/orka-7l9-knowledge-lab/sustain-runs';
const MODEL = 'output/orka-7l9-knowledge-lab/sample/sustain-model.mjs';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fileHash = file => fs.existsSync(file) ? hash(fs.readFileSync(file)) : null;
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const withinRepo = name => {
  const resolved = path.resolve(REPO, name);
  if (resolved !== REPO && !resolved.startsWith(REPO + path.sep)) throw new Error(`path escapes repository: ${name}`);
  return resolved;
};
const outputPath = name => {
  const resolved = path.resolve(REPO, name);
  if (resolved === '/private/tmp' || resolved.startsWith('/private/tmp/')) return resolved;
  return withinRepo(name);
};

export function loadSustainCases(file = DEFAULT_SPEC) {
  const full = withinRepo(file);
  const spec = JSON.parse(fs.readFileSync(full, 'utf8'));
  if (spec.version !== 'orka.sustain-cases.v1' || !spec.source?.path || !Array.isArray(spec.cases)) throw new Error('unsupported sustain case declaration');
  const ids = new Set();
  for (const item of spec.cases) {
    if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(item.id || '') || ids.has(item.id)) throw new Error(`invalid or duplicate case ID: ${item.id}`);
    if (!item.trace || !item.model || !item.expectation) throw new Error(`incomplete case: ${item.id}`);
    ids.add(item.id);
  }
  return { spec, file: full, sha256: fileHash(full) };
}

function evidenceState(spec) {
  const source = withinRepo(spec.source.path);
  const manifest = withinRepo(spec.source.manifest);
  const actualSource = fileHash(source);
  const actualManifest = fileHash(manifest);
  const issues = [];
  if (actualSource !== spec.source.sha256) issues.push('pinned OBS stream SHA-256 mismatch or missing file');
  if (actualManifest !== spec.source.manifestSha256) issues.push('pinned provenance manifest SHA-256 mismatch or missing file');
  return {
    path: spec.source.path, sha256: actualSource, expectedSha256: spec.source.sha256,
    manifest: spec.source.manifest, manifestSha256: actualManifest,
    expectedManifestSha256: spec.source.manifestSha256, issues,
  };
}

function readObserved(file) {
  return zlib.gunzipSync(fs.readFileSync(file)).toString('utf8').split('\n')
    .filter(Boolean).map((line, index) => {
      try { return JSON.parse(line); }
      catch (error) { throw new Error(`invalid OBS stream line ${index + 1}: ${error.message}`); }
    });
}

function identity(item, source, modelSha, runnerSha) {
  const caseSha256 = hash(JSON.stringify(item));
  return {
    caseSha256, sourceSha256: source.sha256, manifestSha256: source.manifestSha256,
    modelSha256: modelSha, runnerSha256: runnerSha,
    digest: hash(JSON.stringify({ caseSha256, sourceSha256: source.sha256,
      manifestSha256: source.manifestSha256, modelSha256: modelSha, runnerSha256: runnerSha })),
  };
}

function reportPath(outDir, item, key) {
  return path.join(outDir, `${item.id}.${key.digest.slice(0, 16)}.json`);
}

function writeImmutable(file, object) {
  const body = JSON.stringify(object, null, 2) + '\n';
  const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temp, body);
    try { fs.linkSync(temp, file); return 'CREATED'; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (fs.readFileSync(file, 'utf8') !== body) throw new Error(`hash collision or changed deterministic result: ${file}`);
      return 'SKIPPED';
    }
  } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}

function atomicWrite(file, body) {
  const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try { fs.writeFileSync(temp, body); fs.renameSync(temp, file); }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}

function withIndexLock(outDir, action) {
  const lock = path.join(outDir, '.index.lock');
  let acquired = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { fs.mkdirSync(lock); acquired = true; break; }
    catch (error) { if (error.code !== 'EEXIST') throw error; sleep(50); }
  }
  if (!acquired) throw new Error(`tracker index locked for >5 seconds: ${lock}; check active runners before removing it`);
  try { return action(); }
  finally { fs.rmdirSync(lock); }
}

function indexMarkdown(index) {
  const rows = index.cases.map(item => {
    const hp = item.minHpPct == null ? '?' : `${item.minHpPct.toFixed(1)}%`;
    const ko = item.heroKOs ?? '?';
    const artifact = item.report ? `[record](${item.report})` : 'pending';
    return `| ${item.id} | ${item.status} | ${hp} | ${ko} | ${artifact} |`;
  });
  return `| Case | Result | Min HP | Hero KOs | Evidence |\n| --- | --- | ---: | ---: | --- |\n${rows.join('\n')}\n`;
}

function buildIndex(outDir, declaration, source, modelSha, runnerSha) {
  const cases = declaration.spec.cases.map(item => {
    const key = identity(item, source, modelSha, runnerSha);
    const file = reportPath(outDir, item, key);
    const report = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    return { id: item.id, status: report?.status ?? 'UNKNOWN',
      minHpPct: report?.minHpPct ?? null, heroKOs: report?.heroKOs ?? null,
      report: report ? path.basename(file) : null };
  });
  return {
    version: 'orka.sustain-tracker.v2', label: 'MODEL',
    casebookSha256: declaration.sha256, sourceSha256: source.sha256,
    modelSha256: modelSha, runnerSha256: runnerSha, cases,
  };
}

export function runSustainTracker({ caseId = null, indexOnly = false, specFile = DEFAULT_SPEC, outDir = DEFAULT_OUT } = {}) {
  const declaration = loadSustainCases(specFile);
  const source = evidenceState(declaration.spec);
  const modelSha = fileHash(withinRepo(MODEL));
  const runnerSha = fileHash(fileURLToPath(import.meta.url));
  const out = outputPath(outDir);
  fs.mkdirSync(out, { recursive: true });
  const chosen = caseId ? declaration.spec.cases.filter(item => item.id === caseId) : declaration.spec.cases;
  if (caseId && !chosen.length) throw new Error(`unknown case ID ${caseId}`);
  const lines = [];
  let observed = null;
  if (!indexOnly && !source.issues.length) observed = readObserved(withinRepo(source.path));
  for (const item of indexOnly ? [] : chosen) {
    const key = identity(item, source, modelSha, runnerSha);
    const file = reportPath(out, item, key);
    if (fs.existsSync(file)) { lines.push({ id: item.id, action: 'SKIPPED', report: path.basename(file) }); continue; }
    const result = source.issues.length ? {
      caseId: item.id, source: null,
      summary: { traceComplete: false, invalidReasons: source.issues }, steps: [],
    } : evaluateSustainCase(observed, item);
    const verdict = gradeSustainCase(result.summary, item.expectation);
    const report = {
      version: 'orka.sustain-case-run.v2', caseId: item.id, digest: key.digest,
      status: verdict.status,
      minHpPct: result.summary.minHpFraction == null ? null : Math.round(result.summary.minHpFraction * 1000) / 10,
      heroKOs: (result.summary.heroKoCount ?? 0) + (result.summary.observedOtherHeroKoCount ?? 0),
      reason: verdict.reasons[0],
    };
    lines.push({ id: item.id, action: writeImmutable(file, report), report: path.basename(file) });
  }
  const index = withIndexLock(out, () => {
    const latest = buildIndex(out, declaration, source, modelSha, runnerSha);
    atomicWrite(path.join(out, 'latest.json'), JSON.stringify(latest, null, 2) + '\n');
    atomicWrite(path.join(out, 'tracker.md'), indexMarkdown(latest));
    return latest;
  });
  return { lines, index, outputDirectory: out };
}

function main(argv) {
  let caseId = null;
  let indexOnly = false;
  let specFile = DEFAULT_SPEC;
  let outDir = DEFAULT_OUT;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--case') caseId = argv[++i];
    else if (arg === '--all') caseId = null;
    else if (arg === '--index') indexOnly = true;
    else if (arg === '--cases') specFile = argv[++i];
    else if (arg === '--out') outDir = argv[++i];
    else throw new Error(`unknown argument: ${arg}`);
  }
  const run = runSustainTracker({ caseId, indexOnly, specFile, outDir });
  for (const line of run.lines) {
    const current = run.index.cases.find(item => item.id === line.id);
    console.log(`${line.id} ${line.action} ${current.status} minHP=${current.minHpPct == null ? '?' : `${current.minHpPct.toFixed(1)}%`} KOs=${current.heroKOs ?? '?'} ${current.report || ''}`);
  }
  console.log(`TRACKER ${path.relative(REPO, path.join(run.outputDirectory, 'latest.json'))}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`SUSTAIN TRACKER ERROR: ${error.message}`); process.exitCode = 1; }
}
