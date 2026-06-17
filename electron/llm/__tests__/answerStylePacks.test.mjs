import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packsPath = path.resolve(__dirname, '../../../dist-electron/electron/llm/answerStylePacks.js');
const plannerPath = path.resolve(__dirname, '../../../dist-electron/electron/llm/AnswerPlanner.js');
const packs = await import(pathToFileURL(packsPath).href);
const planner = await import(pathToFileURL(plannerPath).href);

test('answer style registry exposes user-facing behaviors without Yandex raw ids', () => {
  const all = packs.listAnswerStylePacks();
  const ids = all.map(pack => pack.id);

  assert.deepEqual(ids, ['automatic', 'standard', 'strict', 'expanded', 'hint', 'grounded']);
  assert.ok(all.every(pack => pack.label && pack.description && pack.sample));
  assert.equal(ids.some(id => id.includes('yandex-ru')), false);
  assert.equal(ids.includes('current-openoffer-baseline'), false);
});

test('legacy Yandex prompt pack ids migrate to answer style preferences', () => {
  assert.equal(packs.normalizeAnswerStylePackId('yandex-ru-strict-grounded'), 'grounded');
  assert.equal(packs.normalizeAnswerStylePackId('yandex-ru-lite'), undefined);
  assert.equal(packs.normalizeAnswerStylePackId('current-openoffer-baseline'), undefined);
  assert.equal(packs.normalizeAnswerStylePackId('automatic'), undefined);
  assert.equal(packs.normalizeAnswerStylePackId('strict'), 'strict');
});

test('Yandex adapter maps public answer styles to provider prompt packs', () => {
  assert.equal(
    packs.resolveYandexAdapterPromptPackId({ provider: 'yandex', inputLanguage: 'ru', requestedPackId: 'strict' }),
    'yandex-ru-strict-grounded',
  );
  assert.equal(
    packs.resolveYandexAdapterPromptPackId({ provider: 'yandex', inputLanguage: 'ru', requestedPackId: 'expanded' }),
    'yandex-ru-lite',
  );
  assert.equal(
    packs.resolveYandexAdapterPromptPackId({ provider: 'yandex', inputLanguage: 'English', requestedPackId: 'expanded' }),
    'current-openoffer-baseline',
  );
});

test('answer style override changes only format contract, not routing policy', () => {
  const base = planner.planAnswer({
    question: 'Tell me about your strongest project',
    source: 'manual_input',
    speakerPerspective: 'user',
  });
  const hinted = planner.planAnswer({
    question: 'Tell me about your strongest project',
    source: 'manual_input',
    speakerPerspective: 'user',
    answerStyleOverride: 'hint',
  });
  const contract = planner.formatAnswerPlanForPrompt(hinted, false);

  assert.equal(hinted.answerType, base.answerType);
  assert.equal(hinted.voicePerspective, base.voicePerspective);
  assert.equal(hinted.profileContextPolicy, base.profileContextPolicy);
  assert.equal(hinted.answerStyle, 'hint');
  assert.match(contract, /HINT MODE/);
});
