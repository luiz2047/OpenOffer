import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.resolve(__dirname, '../../../dist-electron/electron/llm/yandexModels.js');
const models = await import(pathToFileURL(p).href);

test('canonicalizeYandexModelId normalizes stable stored ids and bare ids', () => {
  assert.equal(models.canonicalizeYandexModelId('yandex/yandexgpt-5-lite'), 'yandex/yandexgpt-5-lite');
  assert.equal(models.canonicalizeYandexModelId('yandexgpt-5.1'), 'yandex/yandexgpt-5.1');
});

test('canonicalizeYandexModelId normalizes folder URIs without exposing folder id', () => {
  assert.equal(models.canonicalizeYandexModelId('gpt://folder-123/yandexgpt-5-pro'), 'yandex/yandexgpt-5-pro');
});

test('getYandexModelUri expands stable ids into provider URI', () => {
  assert.equal(models.getYandexModelUri('folder-123', 'yandex/yandexgpt-5.1'), 'gpt://folder-123/yandexgpt-5.1');
});

test('unsupported Yandex model ids are rejected before network calls', () => {
  assert.throws(() => models.canonicalizeYandexModelId('yandex/not-a-model'), /Unsupported Yandex model id/);
});
