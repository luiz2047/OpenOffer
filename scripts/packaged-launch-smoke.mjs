#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import process from 'node:process';

const candidate = process.argv[2];
if (!candidate) throw new Error('Usage: packaged-launch-smoke.mjs <app-executable>');
const executable = path.resolve(candidate);
if (!fs.existsSync(executable)) throw new Error(`Packaged executable not found: ${executable}`);

const child = spawn(executable, [], {
  env: { ...process.env, OPENOFFER_PACKAGED_SMOKE: '1' },
  stdio: 'ignore',
  detached: process.platform !== 'win32',
});
const timeout = setTimeout(() => {
  try {
    if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGTERM');
    else child.kill('SIGTERM');
  } catch { /* process already exited */ }
  console.error(`Packaged smoke timed out after 15s: ${executable}`);
  process.exitCode = 1;
}, 15_000);
child.once('error', error => {
  clearTimeout(timeout);
  throw error;
});
child.once('exit', (code, signal) => {
  clearTimeout(timeout);
  if (code !== 0) {
    console.error(`Packaged smoke failed: exit=${code ?? 'null'} signal=${signal ?? 'none'}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Packaged smoke passed: ${executable}`);
});
