import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(import.meta.url);
const { runStageProviderPreflight } = require(path.join(root, 'dist-electron/electron/services/interviews/StageProviderPreflight.js'));

test('provider preflight is explicit, bounded to two concurrent probes, and does not expose credentials', async () => {
  const originalFetch = globalThis.fetch;
  let active = 0;
  let peak = 0;
  const urls = [];
  globalThis.fetch = async (url, init) => {
    active += 1;
    peak = Math.max(peak, active);
    urls.push(String(url));
    assert.equal(init.redirect, 'error');
    assert.ok(init.headers.Authorization || init.headers['x-api-key']);
    assert.doesNotMatch(JSON.stringify(urls), /secret-key/);
    await new Promise(resolve => setTimeout(resolve, 5));
    active -= 1;
    return { ok: true, status: 200 };
  };
  try {
    const results = await runStageProviderPreflight([
      { id: 'stt', provider: 'openai', configured: true, apiKey: 'secret-key' },
      { id: 'ai', provider: 'groq', configured: true, apiKey: 'secret-key' },
      { id: 'ai', provider: 'claude', configured: true, apiKey: 'secret-key' },
    ]);
    assert.equal(results.length, 3);
    assert.equal(peak, 2);
    assert.deepEqual(results.map(result => result.status), ['ready', 'ready', 'ready']);
    assert.ok(results.every(result => !JSON.stringify(result).includes('secret-key')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('provider preflight supports cancellation without claiming readiness', async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  globalThis.fetch = async (_url, init) => {
    await new Promise(resolve => setTimeout(resolve, 20));
    if (init.signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    return { ok: true, status: 200 };
  };
  try {
    const pending = runStageProviderPreflight([{ id: 'stt', provider: 'openai', configured: true, apiKey: 'x' }], controller.signal);
    controller.abort();
    const [result] = await pending;
    assert.equal(result.status, 'unknown');
    assert.equal(result.errorCode, 'provider_probe_timeout');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
