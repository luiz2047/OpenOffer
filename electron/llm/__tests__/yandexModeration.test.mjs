import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.resolve(__dirname, '../../../dist-electron/electron/llm/yandexModeration.js');
const moderation = await import(pathToFileURL(p).href);

test('content_filter finish reason is provider moderation', () => {
  const result = moderation.normalizeYandexProviderResult({
    choices: [{ finish_reason: 'content_filter', message: { content: '' } }],
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.blockReason, 'content_filter');
});

test('message.refusal is provider moderation', () => {
  const result = moderation.normalizeYandexProviderResult({
    choices: [{ finish_reason: 'stop', message: { content: '', refusal: 'refused' } }],
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.blockReason, 'refusal_field');
});

test('canonical Yandex refusal text is provider moderation', () => {
  const result = moderation.normalizeYandexProviderResult({
    choices: [{ finish_reason: 'stop', message: { content: 'Я не могу обсуждать эту тему. Давайте поговорим о чём-нибудь ещё.' } }],
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.blockReason, 'refusal_text');
  assert.equal(result.refusalTextDetected, true);
});

test('empty and malformed responses have explicit statuses', () => {
  assert.equal(moderation.normalizeYandexProviderResult({ choices: [{ finish_reason: 'stop', message: { content: '' } }] }).status, 'empty_output');
  assert.equal(moderation.normalizeYandexProviderResult({}).status, 'provider_malformed');
});

test('normal content passes as ok', () => {
  const result = moderation.normalizeYandexProviderResult({
    choices: [{ finish_reason: 'stop', message: { content: 'Короткий полезный ответ.' } }],
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.blocked, false);
  assert.equal(result.content, 'Короткий полезный ответ.');
});
