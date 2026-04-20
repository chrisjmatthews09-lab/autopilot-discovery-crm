#!/usr/bin/env node
// scripts/test-extraction.js
//
// Runs the Sprint 3 entity-extraction service against the sample transcripts
// in scripts/sample-transcripts/. Prints the extracted JSON per sample.
//
// Usage:
//   ANTHROPIC_API_KEY=sk-ant-...  node scripts/test-extraction.js
//   node scripts/test-extraction.js transcript-1
//   node scripts/test-extraction.js --model=claude-opus-4-7
//
// Or with .env.local (this script auto-loads VITE_CLAUDE_API_KEY from there):
//   node scripts/test-extraction.js
//
// The extraction service itself lives in src/services/claudeService.js —
// this harness is only glue.

import { readFile, readdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { extractEntity } from '../src/services/claudeService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const SAMPLES_DIR = join(__dirname, 'sample-transcripts');

function loadDotEnvLocal() {
  const envPath = join(PROJECT_ROOT, '.env.local');
  if (!existsSync(envPath)) return;
  try {
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (err) {
    console.warn(`[test-extraction] Could not read .env.local: ${err.message}`);
  }
}

function parseArgs(argv) {
  const args = { files: [], model: undefined };
  for (const a of argv) {
    if (a.startsWith('--model=')) args.model = a.slice('--model='.length);
    else if (a.startsWith('--')) continue;
    else args.files.push(a);
  }
  return args;
}

async function pickFiles(requested) {
  const all = (await readdir(SAMPLES_DIR))
    .filter((f) => f.endsWith('.txt'))
    .sort();
  if (requested.length === 0) return all;
  return requested.map((r) => {
    const match = all.find((f) => f === r || f === `${r}.txt` || f.startsWith(r));
    if (!match) throw new Error(`No sample transcript matches "${r}". Available: ${all.join(', ')}`);
    return match;
  });
}

function colorize(s, code) {
  if (!process.stdout.isTTY) return s;
  return `\x1b[${code}m${s}\x1b[0m`;
}

const BOLD = (s) => colorize(s, '1');
const DIM = (s) => colorize(s, '2');
const GREEN = (s) => colorize(s, '32');
const RED = (s) => colorize(s, '31');
const YELLOW = (s) => colorize(s, '33');

async function runOne(fileName, options) {
  const filePath = join(SAMPLES_DIR, fileName);
  const transcript = await readFile(filePath, 'utf8');

  console.log('\n' + BOLD(`━━ ${fileName} ━━`));
  console.log(DIM(`  ${transcript.length} chars`));

  const t0 = Date.now();
  try {
    const entity = await extractEntity(
      { transcript, summary: '' },
      { model: options.model },
    );
    const ms = Date.now() - t0;
    console.log(GREEN(`  ✓ extracted in ${ms}ms`));
    console.log(JSON.stringify(entity, null, 2));
    return { ok: true, entity };
  } catch (err) {
    const ms = Date.now() - t0;
    console.log(RED(`  ✗ failed in ${ms}ms: ${err.message}`));
    if (err.firstResponse) {
      console.log(YELLOW('  first raw response:'));
      console.log(err.firstResponse.slice(0, 400));
    }
    if (err.secondResponse) {
      console.log(YELLOW('  second raw response:'));
      console.log(err.secondResponse.slice(0, 400));
    }
    return { ok: false, error: err };
  }
}

async function main() {
  loadDotEnvLocal();
  const args = parseArgs(process.argv.slice(2));

  if (!process.env.ANTHROPIC_API_KEY && !process.env.VITE_CLAUDE_API_KEY) {
    console.error(RED('No API key found.') + ' Set ANTHROPIC_API_KEY in your env, or VITE_CLAUDE_API_KEY in .env.local.');
    process.exitCode = 1;
    return;
  }

  const files = await pickFiles(args.files);
  console.log(BOLD(`Running extraction on ${files.length} transcript(s)`) + DIM(` · model=${args.model || 'claude-sonnet-4-6 (default)'}`));

  const results = [];
  for (const f of files) {
    // eslint-disable-next-line no-await-in-loop -- sequential is fine for 3 files
    results.push({ file: f, ...(await runOne(f, { model: args.model })) });
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log('\n' + BOLD('━━ Summary ━━'));
  console.log(`  ${GREEN(`${passed} passed`)}` + (failed > 0 ? ` · ${RED(`${failed} failed`)}` : ''));
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(RED('Fatal:'), err);
  process.exitCode = 1;
});
