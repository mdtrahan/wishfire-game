#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');

function usage() {
  console.log('Usage: node tools/convert_c3.js --input <inputDir> --output <outputDir> [--format simple|factory|class]');
}

function safeVarName(name) {
  // create a safe JS identifier from a filename
  const base = name.replace(/[^a-zA-Z0-9_]/g, '_');
  if (/^[0-9]/.test(base)) return '_' + base;
  if (!base) return 'data';
  return base;
}

function isProbablyJSON(buf, filePath) {
  const s = buf.toString('utf8', 0, Math.min(buf.length, 200)).trim();
  return s.startsWith('{') || s.startsWith('[');
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const sub = await walk(full);
      results.push(...sub);
    } else {
      results.push(full);
    }
  }
  return results;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    usage();
    return;
  }
  let input = 'project_C3_conversion';
  let output = 'src/data';
  let format = 'simple';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--input' && argv[i+1]) { input = argv[++i]; }
    else if (a === '--output' && argv[i+1]) { output = argv[++i]; }
    else if (a === '--format' && argv[i+1]) { format = argv[++i]; }
    else if (a === '--help' || a === '-h') { usage(); return; }
  }

  console.log(`Scanning ${input} → ${output} (format=${format})`);
  const absInput = path.resolve(input);
  const absOutput = path.resolve(output);
  await ensureDir(absOutput);

  let files;
  try {
    files = await walk(absInput);
  } catch (err) {
    console.error('Error reading input folder:', err.message);
    process.exit(1);
  }

  const summary = { converted: 0, skipped: 0, warnings: [] };

  for (const f of files) {
    const rel = path.relative(absInput, f);
    const ext = path.extname(f).toLowerCase();
    // Only process json and .c3proj (treat c3proj as text to export)
    if (ext !== '.json' && ext !== '.c3proj') { summary.skipped++; continue; }

    try {
      const buf = await fs.readFile(f);
      const size = buf.length;
      if (size > 5 * 1024 * 1024) {
        summary.warnings.push(`${rel}: file >5MB — skipping by default`);
        summary.skipped++;
        continue;
      }

      const destRel = rel.replace(/\\/g, '/').replace(/\.c3proj$/i, '.c3proj.json') + '.js';
      const destPath = path.join(absOutput, destRel);
      await ensureDir(path.dirname(destPath));

      let jsContent = '';
      if (ext === '.c3proj') {
        // export as string
        const text = buf.toString('utf8');
        const varName = safeVarName(path.basename(rel));
        jsContent = `export const ${varName} = ${JSON.stringify(text, null, 2)};\n`;
      } else {
        // .json — try parse
        let parsed = null;
        let parsedOk = false;
        if (isProbablyJSON(buf, f)) {
          try {
            parsed = JSON.parse(buf.toString('utf8'));
            parsedOk = true;
          } catch (e) {
            // fall through — treat as raw
            parsed = buf.toString('utf8');
          }
        } else {
          parsed = buf.toString('utf8');
        }

        // sanitize top-level secrets if object
        if (parsedOk && typeof parsed === 'object' && parsed !== null) {
          if ('access_token' in parsed) {
            delete parsed.access_token;
            summary.warnings.push(`${rel}: removed top-level access_token`);
          }
          if ('client_secret' in parsed) {
            delete parsed.client_secret;
            summary.warnings.push(`${rel}: removed top-level client_secret`);
          }
        }

        const base = path.basename(rel, '.json');
        const varName = safeVarName(base);

          // Allow per-file overrides: prefer factory for objectTypes to aid runtime construction
          const isObjectType = /(^|\\/)objectTypes(\\/|$)/i.test(rel);
          const effectiveFormat = isObjectType ? 'factory' : format;

          if (effectiveFormat === 'simple') {
            jsContent = `export const ${varName} = ${JSON.stringify(parsed, null, 2)};\n`;
          } else if (effectiveFormat === 'factory') {
            jsContent = `// factory for ${rel}\nexport function create_${varName}() {\n  return ${JSON.stringify(parsed, null, 2)};\n}\n`;
          } else if (effectiveFormat === 'class') {
            jsContent = `// class wrapper for ${rel}\nexport class ${varName.charAt(0).toUpperCase()+varName.slice(1)} {\n  constructor() {\n    this.data = ${JSON.stringify(parsed, null, 2)};\n  }\n}\n`;
          } else {
            jsContent = `export const ${varName} = ${JSON.stringify(parsed, null, 2)};\n`;
          }
      }

      await fs.writeFile(destPath, jsContent, 'utf8');
      console.log(`Wrote ${path.relative(process.cwd(), destPath)}`);
      summary.converted++;
    } catch (err) {
      console.error(`Error processing ${f}:`, err.message);
      summary.skipped++;
    }
  }

  console.log(`Done — converted ${summary.converted}, skipped ${summary.skipped}`);
  if (summary.warnings.length) {
    console.log('Warnings:');
    for (const w of summary.warnings) console.log(' -', w);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
