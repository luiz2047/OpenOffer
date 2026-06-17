#!/usr/bin/env node
/* eslint-disable no-console */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

console.warn('[yandex-guardrail-experiment] Deprecated. Use scripts/yandex-prompt-eval.cjs instead.');
console.warn('[yandex-guardrail-experiment] This wrapper no longer reads Electron app credentials.');

const script = path.join(__dirname, 'yandex-prompt-eval.cjs');
const args = process.argv.slice(2);
const forwardedArgs = args.length > 0 ? args : ['--dry-run'];
const result = spawnSync(process.execPath, [script, ...forwardedArgs], {
  cwd: path.resolve(__dirname, '..'),
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`[yandex-guardrail-experiment] ${result.error.message}`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 0;
}
