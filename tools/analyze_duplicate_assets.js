#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const IMAGE_EXTENSIONS = new Set([
  '.avif',
  '.bmp',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.webp',
]);

const DEFAULT_TARGET = 'web-runner/assets';
const DEFAULT_SKIP_DIRS = new Set([
  '.git',
  '.worktrees',
  'node_modules',
]);

function usage() {
  return [
    'Usage: node tools/analyze_duplicate_assets.js [--target <dir>] [--json <path>] [--markdown <path>]',
    '',
    'Reports duplicate asset candidates only. It never deletes files.',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    target: DEFAULT_TARGET,
    json: '',
    markdown: '',
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--target' || arg === '--json' || arg === '--markdown') {
      const value = argv[i + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      options[arg.slice(2)] = value;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function normalizeSlash(value) {
  return value.split(path.sep).join('/');
}

function toRepoRelative(root, filePath) {
  return normalizeSlash(path.relative(root, filePath));
}

function ensureInsideRoot(root, target) {
  const rel = path.relative(root, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Target must stay inside repo root: ${target}`);
  }
}

function walkFiles(dir, root, skipDirs = DEFAULT_SKIP_DIRS) {
  const files = [];
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        visit(fullPath);
      } else if (entry.isFile()) {
        files.push(toRepoRelative(root, fullPath));
      }
    }
  }
  visit(dir);
  return files.sort();
}

function hashFile(root, repoPath) {
  const fullPath = path.join(root, repoPath);
  const bytes = fs.readFileSync(fullPath);
  return {
    bytes: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  };
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, files: group.map(item => item.path || item).sort() }));
}

function isBinaryBuffer(buffer) {
  const limit = Math.min(buffer.length, 4096);
  for (let i = 0; i < limit; i += 1) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

function repoTextFiles(root) {
  return walkFiles(root, root)
    .filter((repoPath) => {
      if (repoPath.startsWith('test-results/')) return false;
      if (repoPath.startsWith('reports/')) return false;
      return true;
    })
    .filter((repoPath) => {
      const buffer = fs.readFileSync(path.join(root, repoPath));
      return !isBinaryBuffer(buffer);
    });
}

function buildReferencePatterns(root, targetRoot, filePath) {
  const targetRel = normalizeSlash(path.relative(targetRoot, path.join(root, filePath)));
  const parts = [filePath];
  if (targetRel && !targetRel.startsWith('..')) {
    parts.push(targetRel);
    parts.push(`/${targetRel}`);
  }
  if (filePath.startsWith('web-runner/assets/')) {
    const assetRel = filePath.slice('web-runner/assets/'.length);
    parts.push(assetRel);
    parts.push(`/${assetRel}`);
  }
  return [...new Set(parts)];
}

function scanReferences(root, targetRoot, duplicateFiles, outputPaths) {
  const outputSet = new Set(outputPaths.filter(Boolean).map(p => normalizeSlash(path.relative(root, path.resolve(root, p)))));
  const textFiles = repoTextFiles(root).filter(repoPath => !outputSet.has(repoPath));
  const references = {};
  for (const filePath of duplicateFiles) references[filePath] = [];

  const patternMap = new Map();
  for (const filePath of duplicateFiles) {
    patternMap.set(filePath, buildReferencePatterns(root, targetRoot, filePath));
  }

  for (const repoPath of textFiles) {
    const text = fs.readFileSync(path.join(root, repoPath), 'utf8');
    const lines = text.split(/\r?\n/);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      for (const [filePath, patterns] of patternMap.entries()) {
        if (!patterns.some(pattern => line.includes(pattern))) continue;
        references[filePath].push({
          file: repoPath,
          line: lineIndex + 1,
          text: line.trim().slice(0, 220),
        });
      }
    }
  }
  return references;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

function buildReport(root, target, outputPaths) {
  const targetRoot = path.resolve(root, target);
  ensureInsideRoot(root, targetRoot);
  if (!fs.existsSync(targetRoot) || !fs.statSync(targetRoot).isDirectory()) {
    throw new Error(`Target directory not found: ${target}`);
  }

  const files = walkFiles(targetRoot, root);
  const records = files.map((filePath) => {
    const hash = hashFile(root, filePath);
    const ext = path.extname(filePath).toLowerCase();
    return {
      path: filePath,
      basename: path.basename(filePath),
      extension: ext || '<none>',
      isImage: IMAGE_EXTENSIONS.has(ext),
      ...hash,
    };
  });

  const contentDuplicateGroups = groupBy(records, r => `${r.bytes}:${r.sha256}`)
    .map((group) => {
      const first = records.find(r => r.path === group.files[0]);
      return {
        bytes: first.bytes,
        sha256: first.sha256,
        reclaimableBytesIfOneKept: first.bytes * (group.files.length - 1),
        files: group.files,
      };
    })
    .sort((a, b) => b.reclaimableBytesIfOneKept - a.reclaimableBytesIfOneKept || a.files[0].localeCompare(b.files[0]));

  const imageDuplicateGroups = contentDuplicateGroups
    .map(group => ({
      ...group,
      files: group.files.filter(filePath => records.find(r => r.path === filePath).isImage),
    }))
    .filter(group => group.files.length > 1);

  const duplicateFilenameGroups = groupBy(records, r => r.basename)
    .map((group) => ({
      basename: group.key,
      files: group.files,
    }))
    .sort((a, b) => a.basename.localeCompare(b.basename));

  const duplicateFiles = [...new Set(contentDuplicateGroups.flatMap(group => group.files))].sort();
  const references = scanReferences(root, targetRoot, duplicateFiles, outputPaths);

  const extensionCounts = records.reduce((counts, record) => {
    counts[record.extension] = (counts[record.extension] || 0) + 1;
    return counts;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    repoRoot: root,
    target: toRepoRelative(root, targetRoot),
    safety: {
      deleteMode: false,
      note: 'Report only. Missing exact path references are not proof that dynamic runtime references do not exist.',
    },
    counts: {
      filesScanned: records.length,
      imageFilesScanned: records.filter(r => r.isImage).length,
      uniqueContentHashes: new Set(records.map(r => `${r.bytes}:${r.sha256}`)).size,
      contentDuplicateGroups: contentDuplicateGroups.length,
      imageDuplicateGroups: imageDuplicateGroups.length,
      duplicateFilenameGroups: duplicateFilenameGroups.length,
      totalFilesInContentDuplicateGroups: contentDuplicateGroups.reduce((sum, group) => sum + group.files.length, 0),
      reclaimableBytesIfOneKeptPerContentGroup: contentDuplicateGroups.reduce((sum, group) => sum + group.reclaimableBytesIfOneKept, 0),
    },
    extensionCounts: Object.fromEntries(Object.entries(extensionCounts).sort(([a], [b]) => a.localeCompare(b))),
    contentDuplicateGroups,
    imageDuplicateGroups,
    duplicateFilenameGroups,
    exactPathReferences: references,
  };
}

function markdownList(items) {
  if (!items.length) return '- None';
  return items.map(item => `- ${item}`).join('\n');
}

function renderMarkdown(report) {
  const lines = [];
  lines.push(`# Duplicate Asset Analysis Report`);
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Target: \`${report.target}\``);
  lines.push('');
  lines.push('## Safety');
  lines.push('- Report-only tool. It has no delete mode.');
  lines.push('- Duplicate content means exact byte size plus exact SHA-256 match.');
  lines.push('- Duplicate filenames are reported separately from duplicate content.');
  lines.push('- Exact path reference hits are review hints only. Dynamic runtime references still require human review.');
  lines.push('');
  lines.push('## Summary');
  for (const [key, value] of Object.entries(report.counts)) {
    const rendered = key.toLowerCase().includes('bytes') ? `${value} (${formatBytes(value)})` : value;
    lines.push(`- ${key}: ${rendered}`);
  }
  lines.push('');
  lines.push('## Extension Counts');
  for (const [ext, count] of Object.entries(report.extensionCounts)) {
    lines.push(`- \`${ext}\`: ${count}`);
  }
  lines.push('');
  lines.push('## Content Duplicate Groups');
  if (!report.contentDuplicateGroups.length) {
    lines.push('- None');
  } else {
    report.contentDuplicateGroups.forEach((group, index) => {
      lines.push(`### Group ${index + 1}`);
      lines.push(`- bytes: ${group.bytes} (${formatBytes(group.bytes)})`);
      lines.push(`- sha256: \`${group.sha256}\``);
      lines.push(`- reclaimable if one kept: ${group.reclaimableBytesIfOneKept} (${formatBytes(group.reclaimableBytesIfOneKept)})`);
      lines.push('- files:');
      lines.push(markdownList(group.files.map(filePath => `\`${filePath}\``)));
      lines.push('- exact path reference hints:');
      const refLines = group.files.flatMap((filePath) => {
        const refs = report.exactPathReferences[filePath] || [];
        if (!refs.length) return [`  - \`${filePath}\`: none`];
        return refs.map(ref => `  - \`${filePath}\`: \`${ref.file}:${ref.line}\` ${ref.text}`);
      });
      lines.push(refLines.join('\n'));
      lines.push('');
    });
  }
  lines.push('## Image Duplicate Groups');
  if (!report.imageDuplicateGroups.length) {
    lines.push('- None');
  } else {
    report.imageDuplicateGroups.forEach((group, index) => {
      lines.push(`- Group ${index + 1}: ${group.files.map(filePath => `\`${filePath}\``).join(', ')}`);
    });
  }
  lines.push('');
  lines.push('## Duplicate Filename Groups');
  if (!report.duplicateFilenameGroups.length) {
    lines.push('- None');
  } else {
    report.duplicateFilenameGroups.forEach((group) => {
      lines.push(`- \`${group.basename}\`: ${group.files.map(filePath => `\`${filePath}\``).join(', ')}`);
    });
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function writeOutput(filePath, body) {
  if (!filePath) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body);
}

function main() {
  const root = path.resolve(__dirname, '..');
  const options = parseArgs(process.argv);
  if (options.help) {
    console.log(usage());
    return;
  }
  const outputPaths = [options.json, options.markdown].filter(Boolean);
  const report = buildReport(root, options.target, outputPaths);
  if (options.json) writeOutput(path.resolve(root, options.json), `${JSON.stringify(report, null, 2)}\n`);
  if (options.markdown) writeOutput(path.resolve(root, options.markdown), renderMarkdown(report));
  if (!options.json && !options.markdown) console.log(JSON.stringify(report, null, 2));
  console.error(`Scanned ${report.counts.filesScanned} files under ${report.target}; found ${report.counts.contentDuplicateGroups} content duplicate groups.`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
