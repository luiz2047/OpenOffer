// Regression test for the legacy auth frame shape.
//
// The public baseline no longer emits a hosted relay auth frame. Even when a
// relay-like target object is present, connect() should keep using the legacy
// direct STT auth payload.

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

test('buildAuthFrame always returns the legacy key-based shape', () => {
  const stt = new NativelyProSTT('natively_sk_paid', 'system');
  const frame = stt.buildAuthFrame('wss://anything.example/ws');

  assert.equal(frame.key, 'natively_sk_paid');
  assert.equal(frame.session_token, undefined);
  assert.equal(frame.trial_token, undefined);
  assert.equal(frame.app_version, undefined);
  assert.equal(frame.platform, undefined);
  assert.equal(frame.channel, 'system');

  stt.removeAllListeners();
});
