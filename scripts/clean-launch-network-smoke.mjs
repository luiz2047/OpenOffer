#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import process from 'node:process';

const executable = process.argv[2];
if (!executable) throw new Error('Usage: clean-launch-network-smoke.mjs <app-executable>');
if (!fs.existsSync(executable)) throw new Error(`Packaged executable not found: ${executable}`);

const isWindows = process.platform === 'win32';
if (!isWindows) {
  try {
    execFileSync('lsof', ['-v'], { stdio: 'ignore' });
  } catch {
    if (process.env.OPENOFFER_REQUIRE_NETWORK_CAPTURE === '1') throw new Error('lsof is required for clean-launch network smoke');
    console.log('Clean-launch network smoke skipped: lsof is unavailable.');
    process.exit(0);
  }
}

const child = spawn(executable, [], {
  env: { ...process.env, OPENOFFER_PACKAGED_SMOKE: '1' },
  stdio: 'ignore',
  detached: !isWindows,
});
const startedAt = Date.now();
const timeoutMs = 15_000;
const observed = new Set();
let exited = false;
child.once('exit', () => { exited = true; });

function remoteConnections(pid) {
  if (isWindows) {
    try {
      const command = `Get-NetTCPConnection -OwningProcess ${Number(pid)} -State Established -ErrorAction SilentlyContinue | ForEach-Object { \"$($_.RemoteAddress):$($_.RemotePort)\" }`;
      const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8' });
      return output.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }
  let output = '';
  try {
    output = execFileSync('lsof', ['-nP', '-a', '-p', String(pid), '-iTCP', '-sTCP:ESTABLISHED', '-Fn'], { encoding: 'utf8' });
  } catch {
    return [];
  }
  return output.split('\n')
    .filter(line => line.startsWith('n') && line.includes('->'))
    .map(line => line.slice(1).split('->')[1])
    .filter(Boolean);
}

try {
  while (!exited && Date.now() - startedAt < timeoutMs) {
    for (const remote of remoteConnections(child.pid)) observed.add(remote);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  if (!exited) throw new Error(`Packaged clean launch timed out after ${timeoutMs}ms`);
  if (observed.size > 0) throw new Error(`Unexpected clean-launch outbound connections: ${[...observed].join(', ')}`);
  console.log('Clean-launch network smoke passed: no established outbound connections observed.');
} finally {
  if (!exited) {
    try {
      if (isWindows) child.kill('SIGTERM');
      else process.kill(-child.pid, 'SIGTERM');
    } catch { /* already exited */ }
  }
}
