import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadPolicy() {
  const policyPath = path.resolve(__dirname, '../../../dist-electron/electron/services/TaskModelPolicy.js');
  return import(pathToFileURL(policyPath).href);
}

test('task model policy seeds default from existing stored default model', async () => {
  const { createInitialTaskModelPolicy } = await loadPolicy();

  const policy = createInitialTaskModelPolicy({
    defaultModel: 'yandex/yandexgpt-5-lite',
    yandexPreferredModel: 'yandex/yandexgpt-5-pro',
  }, '2026-06-18T00:00:00.000Z');

  assert.equal(policy.defaultModelId, 'yandex/yandexgpt-5-lite');
  assert.equal(policy.seededFromProviderPreferred, undefined);
  assert.deepEqual(policy.tasks, {});
});

test('task model policy seeds from exactly one provider preferred model', async () => {
  const { createInitialTaskModelPolicy } = await loadPolicy();

  const policy = createInitialTaskModelPolicy({
    yandexPreferredModel: 'yandex/yandexgpt-5-lite',
  }, '2026-06-18T00:00:00.000Z');

  assert.equal(policy.defaultModelId, 'yandex/yandexgpt-5-lite');
  assert.equal(policy.seededFromProviderPreferred, true);
});

test('task model policy leaves default empty when multiple preferred models exist', async () => {
  const { createInitialTaskModelPolicy } = await loadPolicy();

  const policy = createInitialTaskModelPolicy({
    geminiPreferredModel: 'gemini-3.1-flash-lite',
    yandexPreferredModel: 'yandex/yandexgpt-5-lite',
  }, '2026-06-18T00:00:00.000Z');

  assert.equal(policy.defaultModelId, null);
  assert.equal(policy.seededFromProviderPreferred, undefined);
});

test('resolver falls back when pinned task model has no credentials', async () => {
  const { resolveTaskModel } = await loadPolicy();
  const policy = {
    version: 1,
    defaultModelId: 'gemini-3.1-flash-lite',
    tasks: {
      vacancy_intake: { mode: 'pinned', modelId: 'gpt-5.4' },
    },
    updatedAt: '2026-06-18T00:00:00.000Z',
  };

  const resolution = resolveTaskModel('vacancy_intake', policy, {
    geminiApiKey: 'gemini-key',
  });

  assert.equal(resolution.resolvedModelId, 'gemini-3.1-flash-lite');
  assert.equal(resolution.availability, 'available');
  assert.equal(resolution.fallbackUsed, true);
  assert.match(resolution.warnings.join('\n'), /gpt-5\.4 is not available/);
});

test('resolver auto quality prefers higher-quality configured providers for retro tasks', async () => {
  const { resolveTaskModel } = await loadPolicy();

  const resolution = resolveTaskModel('retro', {
    version: 1,
    defaultModelId: null,
    tasks: {
      retro: { mode: 'auto', quality: 'quality' },
    },
    updatedAt: '2026-06-18T00:00:00.000Z',
  }, {
    geminiApiKey: 'gemini-key',
    openaiApiKey: 'openai-key',
  });

  assert.equal(resolution.requestedMode, 'auto');
  assert.equal(resolution.resolvedModelId, 'gpt-5.4');
  assert.equal(resolution.availability, 'available');
  assert.equal(resolution.fallbackUsed, false);
});

test('resolver honors explicit override model before policy defaults', async () => {
  const { resolveTaskModel } = await loadPolicy();

  const resolution = resolveTaskModel('agent_actions', {
    version: 1,
    defaultModelId: 'gemini-3.1-flash-lite',
    tasks: {
      agent_actions: { mode: 'pinned', modelId: 'yandex/yandexgpt-5-lite' },
    },
    updatedAt: '2026-06-18T00:00:00.000Z',
  }, {
    geminiApiKey: 'gemini-key',
    yandexApiKey: 'yandex-key',
    yandexFolderId: 'folder-id',
  }, {
    overrideModelId: 'codex-cli:gpt-5.4',
  });

  assert.equal(resolution.requestedMode, 'pinned');
  assert.equal(resolution.resolvedModelId, 'codex-cli:gpt-5.4');
  assert.equal(resolution.fallbackUsed, false);
});

test('resolver supports custom and litellm model availability boundaries', async () => {
  const { resolveTaskModel } = await loadPolicy();

  const custom = resolveTaskModel('scraping', {
    version: 1,
    defaultModelId: null,
    tasks: {
      scraping: { mode: 'pinned', modelId: 'custom-scraper' },
    },
    updatedAt: '2026-06-18T00:00:00.000Z',
  }, {
    customProviders: [{ id: 'custom-scraper' }],
  });
  assert.equal(custom.resolvedModelId, 'custom-scraper');
  assert.equal(custom.availability, 'available');

  const litellm = resolveTaskModel('scraping', {
    version: 1,
    defaultModelId: null,
    tasks: {
      scraping: { mode: 'pinned', modelId: 'litellm/team-router' },
    },
    updatedAt: '2026-06-18T00:00:00.000Z',
  }, {});
  assert.equal(litellm.resolvedModelId, null);
  assert.equal(litellm.availability, 'provider_disabled');
});

test('resolver reports honest unavailable state when no configured model can run', async () => {
  const { resolveTaskModel } = await loadPolicy();

  const resolution = resolveTaskModel('vacancy_intake', {
    version: 1,
    defaultModelId: 'yandex/yandexgpt-5-lite',
    tasks: {},
    updatedAt: '2026-06-18T00:00:00.000Z',
  }, {});

  assert.equal(resolution.resolvedModelId, null);
  assert.equal(resolution.availability, 'missing_credentials');
  assert.equal(resolution.fallbackUsed, true);
  assert.match(resolution.warnings.join('\n'), /No configured AI model is available/);
});
