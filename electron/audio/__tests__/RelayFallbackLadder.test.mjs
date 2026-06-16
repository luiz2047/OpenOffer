// Regression tests for the retired relay ladder.
//
// The public baseline should not resolve a hosted relay session, install a
// relay target, or advance through relay/alternate/railway fallback rungs.
// These tests pin the direct legacy path instead.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.resolve(__dirname, '../../../dist-electron/electron/audio');

const origLoad = Module._load;
Module._load = function patched(request, _p, _m) {
  if (request === 'electron') {
    return { app: { getAppPath: () => '/tmp/x', isPackaged: false, isReady: () => false } };
  }
  return origLoad.apply(this, arguments);
};

const { NativelyProSTT } = await import(path.join(distRoot, 'NativelyProSTT.js'));

function flagsOn(overrides = {}) {
  return {
    isRelayEnabled: () => true,
    getForceRegion: () => null,
    isRailwayFallbackEnabled: () => true,
    getMaxSampleRate: () => 16000,
    getMaxChannels: () => 1,
    getAllowDualStream: () => false,
    ...overrides,
  };
}

test('maybeResolveRelayTarget is inert even when relay flags are injected', () => {
  let resolverCalls = 0;
  const stt = new NativelyProSTT('natively_sk_paid', 'system', {
    appVersion: '2.7.0',
    platform: 'mac',
    flags: flagsOn(),
    resolveSession: async () => { resolverCalls++; return null; },
  });

  const started = stt.maybeResolveRelayTarget();
  assert.equal(started, false, 'relay pre-flight must not start in the public baseline');
  assert.equal(resolverCalls, 0, 'compatibility shim must not invoke the hosted relay resolver');
  assert.equal(stt.target, null, 'no relay target should be installed');
  assert.equal(stt.connectUrl(), stt.BACKEND_URL, 'legacy direct path remains the active STT endpoint');
  stt.removeAllListeners();
});

test('connect() keeps the legacy auth frame shape', () => {
  const stt = new NativelyProSTT('natively_sk_paid', 'system', { flags: flagsOn() });
  const frame = stt.buildAuthFrame(stt.connectUrl());
  assert.equal(frame.key, 'natively_sk_paid');
  assert.equal(frame.session_token, undefined);
  assert.equal(frame.app_version, undefined);
  assert.equal(frame.channel, 'system');
  stt.removeAllListeners();
});
