// Compatibility tests for the retired relaySession shim.
//
// The public baseline should not resolve hosted relay sessions, build a hosted
// fallback ladder, or block on latency probes. These tests pin the inert
// surface that remains for compatibility while preserving the generic cache
// helpers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.resolve(__dirname, '../../../dist-electron/electron/audio');
const rs = await import(path.join(distRoot, 'relaySession.js'));
const {
  resolveRelaySession,
  buildFallbackChain,
  getCachedSession,
  setCachedSession,
  clearCachedSession,
  clearAllCachedSessions,
  getRelayLatencyProbes,
  refreshRelayLatencyProbes,
} = rs;

test('resolveRelaySession is inert and never calls fetch', async () => {
  let called = false;
  const config = await resolveRelaySession({
    apiKey: 'natively_sk_test',
    channel: 'system',
    language: 'en-US',
    languageAlternates: ['en-GB'],
    sampleRate: 16000,
    audioChannels: 1,
    appVersion: '2.7.0',
    platform: 'mac',
    controlPlaneBaseUrl: 'https://example.invalid',
    fetchImpl: async () => { called = true; return { ok: true, status: 200, json: async () => ({}) }; },
  });
  assert.equal(config, null);
  assert.equal(called, false, 'compatibility shim must not perform a hosted session-create request');
});

test('buildFallbackChain only preserves caller-provided relay URLs', () => {
  assert.deepEqual(buildFallbackChain(null), []);
  assert.deepEqual(
    buildFallbackChain({
      sessionId: 'st_1',
      sessionToken: 'token',
      relayWsUrl: 'wss://us-relay.example/ws',
      fallbackRelayWsUrl: 'wss://asia-relay.example/ws',
      railwayFallbackWsUrl: 'wss://legacy.example/ws',
      selectedRegion: 'us',
      sttConfig: { sampleRate: 16000, audioChannels: 1, language: 'en-US', languageAlternates: [], channel: 'system' },
      limits: { maxSampleRate: 16000, maxChannels: 1, allowDualStream: false, maxSessionSeconds: 14400, maxBytesPerSession: 0 },
      quotaRemaining: 1,
      expiresAt: Date.now() + 60_000,
    }),
    ['wss://us-relay.example/ws', 'wss://asia-relay.example/ws'],
  );
});

test('cache helpers still behave like a plain per-channel cache', () => {
  clearAllCachedSessions();
  const cfg = {
    sessionId: 'st_x',
    sessionToken: 'token',
    relayWsUrl: 'wss://us/ws',
    fallbackRelayWsUrl: null,
    railwayFallbackWsUrl: 'wss://legacy/ws',
    selectedRegion: 'us',
    sttConfig: { sampleRate: 16000, audioChannels: 1, language: 'en-US', languageAlternates: [], channel: 'system' },
    limits: { maxSampleRate: 16000, maxChannels: 1, allowDualStream: false, maxSessionSeconds: 14400, maxBytesPerSession: 0 },
    quotaRemaining: 1,
    expiresAt: Date.now() + 180_000,
  };
  setCachedSession('system', cfg);
  assert.equal(getCachedSession('system'), cfg);
  assert.equal(getCachedSession('mic'), null);
  clearCachedSession('system');
  assert.equal(getCachedSession('system'), null);
});

test('latency probe helpers are non-blocking no-ops', async () => {
  clearAllCachedSessions();
  assert.equal(getRelayLatencyProbes(), null);
  assert.deepEqual(await refreshRelayLatencyProbes(), {});
});
