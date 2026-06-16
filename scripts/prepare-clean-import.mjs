#!/usr/bin/env node
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');

function parseArgs(argv) {
  const out = { dest: '', init: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dest') out.dest = argv[++i] ?? '';
    else if (arg === '--init') out.init = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/prepare-clean-import.mjs [--dest /tmp/openoffer-import] [--init]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return out;
}

function git(args, cwd = root) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function shouldSkip(file) {
  return (
    file === '.git' ||
    file.startsWith('.git/') ||
    file === 'natively-api' ||
    file.startsWith('natively-api/') ||
    file === 'premium' ||
    file.startsWith('premium/') ||
    file === 'node_modules' ||
    file.startsWith('node_modules/') ||
    file.includes('/node_modules/') ||
    file === 'dist' ||
    file.startsWith('dist/') ||
    file.includes('/dist/') ||
    file === 'dist-electron' ||
    file.startsWith('dist-electron/') ||
    file === 'resources/models' ||
    file.startsWith('resources/models/') ||
    file === 'assets/openoffer-ai-assistant-demo.gif' ||
    file === 'assets/openoffer.icns' ||
    file === 'src/assets/hero.mp4' ||
    file === 'src/assets/hero.webm' ||
    file === 'src/font/Inter-4.1' ||
    file.startsWith('src/font/Inter-4.1/') ||
    file === 'test-results' ||
    file.startsWith('test-results/') ||
    file.includes('/dist-test/') ||
    file.startsWith('native-module/target/') ||
    file === 'release' ||
    file.startsWith('release/') ||
    file.endsWith('.log') ||
    file.startsWith('.env') ||
    file.includes('/.env')
  );
}

const args = parseArgs(process.argv.slice(2));
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const dest = resolve(args.dest || join(tmpdir(), `openoffer-clean-import-${stamp}`));

if (existsSync(dest)) {
  const existing = statSync(dest);
  if (!existing.isDirectory()) throw new Error(`Destination exists and is not a directory: ${dest}`);
  rmSync(dest, { recursive: true, force: true });
}
mkdirSync(dest, { recursive: true });

const files = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
  .split('\0')
  .filter(Boolean)
  .filter((file) => !shouldSkip(file))
  .filter((file) => existsSync(join(root, file)));

for (const file of files) {
  const from = join(root, file);
  const to = join(dest, file);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

for (const optional of ['NOTICE']) {
  const from = join(root, optional);
  if (existsSync(from) && !files.includes(optional)) {
    cpSync(from, join(dest, optional), { recursive: true });
  }
}

if (args.init) {
  git(['init', '-b', 'main'], dest);
  git(['add', '-A'], dest);
}

console.log(JSON.stringify({
  dest,
  files: files.length,
  initialized: args.init,
  next: args.init
    ? 'Review git status, run the full gate, then commit once.'
    : 'Run the full gate from this directory; rerun with --init only after it passes.',
}, null, 2));
