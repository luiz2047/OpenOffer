import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

async function loadModelFetcher() {
  const p = path.resolve(__dirname, '../../../dist-electron/electron/utils/modelFetcher.js');
  return import(pathToFileURL(p).href);
}

async function loadRouter() {
  const p = path.resolve(__dirname, '../../../dist-electron/electron/llm/ProviderRouter.js');
  return import(pathToFileURL(p).href);
}

test('Yandex model discovery returns stable text model ids without exposing folder URIs', async () => {
  const { fetchProviderModels } = await loadModelFetcher();
  const models = await fetchProviderModels('yandex', 'test-key');

  assert.ok(models.length >= 3);
  assert.ok(models.some(model => model.id === 'yandex/yandexgpt-5-lite'));
  assert.equal(models.some(model => model.id.startsWith('gpt://')), false);
});

test('Yandex is a text-only fallback provider and omitted from multimodal routing', async () => {
  const { routeLLMProviders } = await loadRouter();

  const textAttempts = routeLLMProviders({
    capability: 'chat',
    multimodal: false,
    availability: { hasYandex: true },
  });
  const yandex = textAttempts.find(attempt => attempt.provider === 'yandex');
  assert.equal(yandex?.status, 'available');

  const multimodalAttempts = routeLLMProviders({
    capability: 'chat',
    multimodal: true,
    availability: { hasYandex: true },
  });
  assert.equal(multimodalAttempts.find(attempt => attempt.provider === 'yandex'), undefined);
});

test('Yandex requests keep folder URI expansion and data logging header in runtime only', () => {
  const llmHelper = fs.readFileSync(path.join(repoRoot, 'electron/LLMHelper.ts'), 'utf8');
  const ipcHandlers = fs.readFileSync(path.join(repoRoot, 'electron/ipcHandlers.ts'), 'utf8');
  const settings = fs.readFileSync(path.join(repoRoot, 'src/components/settings/AIProvidersSettings.tsx'), 'utf8');

  assert.match(llmHelper, /getYandexModelUri\(this\.yandexFolderId/);
  assert.match(ipcHandlers, /getYandexModelUri\(folderId/);
  assert.match(ipcHandlers, /testYandexChatCompletion/);
  assert.doesNotMatch(ipcHandlers, /axios\.post\(\s*['"]https:\/\/ai\.api\.cloud\.yandex\.net\/v1\/chat\/completions/);
  assert.match(llmHelper, /"x-data-logging-enabled"\]\s*=\s*"false"/);
  assert.doesNotMatch(settings, /gpt:\/\//);
});

test('Yandex settings and model selector surface user-facing answer styles', () => {
  const settings = fs.readFileSync(path.join(repoRoot, 'src/components/settings/AIProvidersSettings.tsx'), 'utf8');
  const modelSelector = fs.readFileSync(path.join(repoRoot, 'src/components/ui/ModelSelector.tsx'), 'utf8');
  const preload = fs.readFileSync(path.join(repoRoot, 'electron/preload.ts'), 'utf8');

  assert.match(settings, /Answer styles/);
  assert.match(settings, /Answer style/);
  assert.match(settings, /getAnswerStylePacks/);
  assert.match(settings, /setAnswerStylePack/);
  assert.doesNotMatch(settings, /RU prompt pack/);
  assert.doesNotMatch(settings, /Prompt pack/);
  assert.doesNotMatch(settings, /lg:min-w-\[210px\]/);
  assert.match(modelSelector, /Answer style/);
  assert.match(modelSelector, /getAnswerStylePacks/);
  assert.match(modelSelector, /setAnswerStylePack/);
  assert.doesNotMatch(modelSelector, /currentModel\.startsWith\('yandex\/'\)\s*&&\s*\(/);
  assert.doesNotMatch(modelSelector, /setYandexPromptPack/);
  assert.match(preload, /get-answer-style-packs/);
  assert.match(preload, /set-answer-style-pack/);
});

test('Yandex answer styles resolve with provider and model scope across runtime paths', () => {
  const processingHelper = fs.readFileSync(path.join(repoRoot, 'electron/ProcessingHelper.ts'), 'utf8');
  const ipcHandlers = fs.readFileSync(path.join(repoRoot, 'electron/ipcHandlers.ts'), 'utf8');

  assert.match(processingHelper, /const yandexPreferredModel = credManager\.getYandexPreferredModel\(\)/);
  assert.match(processingHelper, /getAnswerStylePreference\('yandex', yandexPreferredModel\)/);
  assert.match(ipcHandlers, /function getYandexAnswerStylePreference\(modelId\?: string\)/);
  assert.match(ipcHandlers, /getAnswerStylePreference\('yandex', modelId\)/);
  assert.match(ipcHandlers, /getYandexAnswerStylePreference\(modelId\)/);
  assert.match(ipcHandlers, /setAnswerStylePreference\(undefined, 'yandex'\)/);
});

test('OPENOFFER_ANSWER_STYLE forces planner and Yandex runtime style locally', () => {
  const answerStylePacks = fs.readFileSync(path.join(repoRoot, 'electron/llm/answerStylePacks.ts'), 'utf8');
  const llmHelper = fs.readFileSync(path.join(repoRoot, 'electron/LLMHelper.ts'), 'utf8');
  const intelligenceEngine = fs.readFileSync(path.join(repoRoot, 'electron/IntelligenceEngine.ts'), 'utf8');
  const ipcHandlers = fs.readFileSync(path.join(repoRoot, 'electron/ipcHandlers.ts'), 'utf8');

  assert.match(answerStylePacks, /OPENOFFER_ANSWER_STYLE/);
  assert.match(answerStylePacks, /export function getEnvYandexPromptPackOverride/);
  assert.match(llmHelper, /getEnvYandexPromptPackOverride\(\) \|\| this\.answerStylePackId/);
  assert.match(intelligenceEngine, /getEnvAnswerStylePackId\(\)\s*\|\|/);
  assert.match(ipcHandlers, /getEnvAnswerStylePackId\(\)\s*\|\|/);
});

test('Yandex adapter strips duplicated active-mode prelude before sending system prompts', () => {
  const llmHelper = fs.readFileSync(path.join(repoRoot, 'electron/LLMHelper.ts'), 'utf8');
  const moderation = fs.readFileSync(path.join(repoRoot, 'electron/llm/yandexModeration.ts'), 'utf8');

  assert.match(moderation, /SHARED_MODE_PREFIX,\s*SHARED_MODE_PREFIX_SHORT/);
  assert.match(moderation, /export function normalizeYandexSystemPrompt/);
  assert.match(moderation, /const marker = "## ACTIVE MODE\\n"/);
  assert.match(moderation, /for \(const prefix of \[SHARED_MODE_PREFIX,\s*SHARED_MODE_PREFIX_SHORT\]\)/);
  assert.match(llmHelper, /buildFinalYandexSystemPrompt/);
  assert.match(llmHelper, /this\.answerStylePackId/);
  assert.match(llmHelper, /normalizeYandexSystemPrompt\(yandexPrompt\)/);
});

test('Yandex adapter treats content_filter/refusal as provider moderation, not normal output', () => {
  const llmHelper = fs.readFileSync(path.join(repoRoot, 'electron/LLMHelper.ts'), 'utf8');
  const moderation = fs.readFileSync(path.join(repoRoot, 'electron/llm/yandexModeration.ts'), 'utf8');

  assert.match(moderation, /export function detectYandexProviderModeration/);
  assert.match(moderation, /finishReason === "content_filter"/);
  assert.match(moderation, /messageRefusal\.length > 0/);
  assert.match(moderation, /Я не могу обсуждать эту тему/);
  assert.match(llmHelper, /normalizeYandexProviderResult\(response\)/);
  assert.match(llmHelper, /YANDEX_PROVIDER_MODERATION_MESSAGE/);
});

test('DeepSeek path does not use Yandex-specific moderation or prompt normalization', () => {
  const llmHelper = fs.readFileSync(path.join(repoRoot, 'electron/LLMHelper.ts'), 'utf8');
  const deepseekStart = llmHelper.indexOf('private async generateWithDeepseek');
  const yandexStart = llmHelper.indexOf('private async generateWithYandex');
  const deepseekBlock = llmHelper.slice(deepseekStart, yandexStart);

  assert.doesNotMatch(deepseekBlock, /normalizeYandexSystemPrompt/);
  assert.doesNotMatch(deepseekBlock, /normalizeYandexProviderResult/);
  assert.doesNotMatch(deepseekBlock, /YANDEX_PROVIDER_MODERATION_MESSAGE/);
});
