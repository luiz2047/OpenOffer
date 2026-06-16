import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routerPath = path.resolve(__dirname, '../../../dist-electron/electron/llm/ProviderRouter.js');

const { routeLLMProviders, ProviderRouter } = await import(pathToFileURL(routerPath).href);

describe('Hosted provider removal', () => {
  test('runtime provider registry stays on supported providers', () => {
    const attempts = routeLLMProviders({
      capability: 'chat',
      multimodal: false,
      availability: {
        hasGroq: true,
        hasCodex: true,
        hasGemini: true,
        hasOpenAI: true,
        hasClaude: true,
        hasDeepseek: true,
      },
      models: {
        groq: 'groq-text',
        codex: 'codex-model',
        geminiFlash: 'gemini-flash',
        geminiPro: 'gemini-pro',
        openai: 'openai-text',
        claude: 'claude-text',
        deepseek: 'deepseek-v4-flash',
      },
    });

    assert.deepEqual(attempts.map(attempt => attempt.provider), [
      'groq',
      'codex',
      'gemini_flash',
      'gemini_pro',
      'openai',
      'claude',
      'deepseek',
    ]);
  });

  test('local-only routing resolves to Ollama', () => {
    const router = new ProviderRouter();
    const choice = router.selectProvider({ privacySetting: 'local-only', needsVision: true, preferLowLatency: true });

    assert.equal(choice.provider, 'ollama');
    assert.equal(choice.model, 'local');
    assert.match(choice.reason, /local-only/);
  });
});
