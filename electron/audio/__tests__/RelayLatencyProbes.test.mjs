// Relay latency helpers are now inert compatibility stubs.
//
// The public baseline should not block on hosted relay health checks or keep a
// relay latency cache alive. These tests pin the no-op behavior so the helper
// stays harmless if older code still imports it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.resolve(__dirname, '../../../dist-electron/electron/audio');
const rs = await import(path.join(distRoot, 'relaySession.js'));
const {
  deriveHealthUrl,
  getRelayLatencyProbes,
  refreshRelayLatencyProbes,
  clearRelayLatencyProbes,
} = rs;

test('deriveHealthUrl still maps ws/wss URLs to /healthz', () => {
  assert.equal(deriveHealthUrl('wss://example.com/v1/transcribe'), 'https://example.com/healthz');
  assert.equal(deriveHealthUrl('ws://localhost:8080/v1/transcribe'), 'http://localhost:8080/healthz');
  assert.equal(deriveHealthUrl('not a url'), null);
});

test('relay latency helpers are non-blocking no-ops', async () => {
  clearRelayLatencyProbes();
  assert.equal(getRelayLatencyProbes(() => { throw new Error('should not run'); }), null);
  assert.deepEqual(await refreshRelayLatencyProbes(() => { throw new Error('should not run'); }), {});
});
