import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.resolve(__dirname, '../../../dist-electron/electron/llm/yandexPromptPacks.js');
const packs = await import(pathToFileURL(p).href);

test('Yandex Russian selector defaults to the lite interview prompt pack', () => {
  const pack = packs.selectYandexPromptPack({
    provider: 'yandex',
    inputLanguage: 'ru',
    mode: 'technical-interview',
  });

  assert.equal(pack.id, 'yandex-ru-lite');
  assert.match(pack.systemPrompt, /ассистент для технических и поведенческих интервью/);
  assert.match(pack.systemPrompt, /pipeline или follow-up/);
  assert.match(pack.systemPrompt, /data leakage в ML pipeline/);
  assert.match(pack.systemPrompt, /нумерованным списком/);
  assert.match(pack.systemPrompt, /У меня сейчас нет конкретного кейса в контексте/);
  assert.match(pack.systemPrompt, /не пиши "я работал"/);
  assert.doesNotMatch(pack.systemPrompt, /You are the interviewee/);
});

test('Yandex Russian selector accepts locale-shaped Russian language ids', () => {
  const pack = packs.selectYandexPromptPack({
    provider: 'yandex',
    inputLanguage: 'ru-RU',
  });

  assert.equal(pack.id, 'yandex-ru-lite');
});

test('Yandex prompt pack recommendation is shared with UI metadata', () => {
  const all = packs.listYandexPromptPacks();

  assert.ok(all.length >= 3);
  assert.ok(all.every(pack => pack.description));
  assert.equal(packs.getRecommendedYandexPromptPackId({ provider: 'yandex', inputLanguage: 'auto' }), 'yandex-ru-lite');
  assert.equal(packs.getRecommendedYandexPromptPackId({ provider: 'yandex', inputLanguage: 'English' }), 'current-openoffer-baseline');
  assert.equal(packs.getRecommendedYandexPromptPackId({ provider: 'openai', inputLanguage: 'ru' }), 'current-openoffer-baseline');
});

test('Yandex prompt builder preserves trusted active mode suffix', () => {
  const base = [
    'OLD BASE PROMPT',
    '',
    '## ACTIVE MODE',
    'TRUSTED_MODE_SUFFIX_SENTINEL',
    '',
    '## ACTIVE MODE INSTRUCTIONS (user-configured)',
    'PINNED_SENTINEL',
  ].join('\n');

  const prompt = packs.buildYandexSystemPrompt(base, {
    requestedPackId: 'yandex-ru-lite',
    inputLanguage: 'ru',
  });

  assert.match(prompt, /Ты OpenOffer/);
  assert.match(prompt, /TRUSTED_MODE_SUFFIX_SENTINEL/);
  assert.match(prompt, /PINNED_SENTINEL/);
  assert.doesNotMatch(prompt, /OLD BASE PROMPT/);
});

test('strict grounded pack forbids fabricated personal metrics', () => {
  const pack = packs.getYandexPromptPack('yandex-ru-strict-grounded');

  assert.match(pack.systemPrompt, /Не приписывай кандидату/);
  assert.match(pack.systemPrompt, /нет конкретного кейса в контексте/);
});

test('non-Russian Yandex selection can use the baseline pack for comparison', () => {
  const pack = packs.selectYandexPromptPack({
    provider: 'yandex',
    inputLanguage: 'English',
  });

  assert.equal(pack.id, 'current-openoffer-baseline');
});
