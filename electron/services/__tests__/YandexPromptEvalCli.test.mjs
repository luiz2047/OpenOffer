import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const repoRoot = path.resolve(__dirname, '../../..');
const script = fs.readFileSync(path.join(repoRoot, 'scripts/yandex-prompt-eval.cjs'), 'utf8');
const legacyScript = fs.readFileSync(path.join(repoRoot, 'scripts/yandex-guardrail-experiment.cjs'), 'utf8');
const envExample = fs.readFileSync(path.join(repoRoot, '.env.example'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const defaultFixture = JSON.parse(fs.readFileSync(path.join(repoRoot, 'docs/testing/fixtures/yandex-ru-ml-engineer-mock.json'), 'utf8'));
const evalCli = require(path.join(repoRoot, 'scripts/yandex-prompt-eval.cjs'));

test('Yandex prompt eval CLI does not read app credentials or Electron safeStorage', () => {
  assert.doesNotMatch(script, /require\(['"]electron['"]\)/);
  assert.doesNotMatch(script, /safeStorage/);
  assert.doesNotMatch(script, /credentials\.enc/);
});

test('Yandex prompt eval live mode requires explicit env opt-in', () => {
  assert.match(script, /dotenv/);
  assert.match(script, /loadDotEnv/);
  assert.match(script, /\.env/);
  assert.match(script, /YANDEX_EVAL_LIVE/);
  assert.match(script, /YANDEX_API_KEY/);
  assert.match(script, /YANDEX_FOLDER_ID/);
  assert.match(script, /YANDEXGPT_API_KEY/);
  assert.match(script, /YANDEXGPT_FOLDER_ID/);
  assert.match(script, /Live Yandex eval is disabled by default/);
});

test('Yandex prompt eval has a safe .env example', () => {
  assert.match(envExample, /YANDEX_EVAL_LIVE=1/);
  assert.match(envExample, /YANDEX_API_KEY=/);
  assert.match(envExample, /YANDEX_FOLDER_ID=/);
  assert.match(envExample, /OPENOFFER_YANDEX_PROMPT_PACK/);
  assert.doesNotMatch(envExample, /y0_[A-Za-z0-9_-]{8,}/);
  assert.doesNotMatch(envExample, /gpt:\/\/[^<]/);
});

test('Yandex prompt eval can check live env readiness without network calls', () => {
  assert.match(script, /--check-live-env/);
  assert.match(script, /function liveEnvStatus/);
  assert.match(script, /api_key_source/);
  assert.match(script, /folder_id_source/);
  assert.match(script, /if \(args\.checkLiveEnv\)/);
});

test('Yandex prompt eval CLI defaults to no prompt or output excerpts', () => {
  assert.match(script, /prompt_excerpt: null/);
  assert.match(script, /output_excerpt: null/);
  assert.match(script, /Default output never includes API keys/);
});

test('Yandex prompt eval CLI reuses built runtime helper modules', () => {
  assert.match(script, /yandexModels\.js/);
  assert.match(script, /yandexModeration\.js/);
  assert.match(script, /yandexPromptPacks\.js/);
  assert.match(script, /canonicalizeYandexModelId/);
  assert.match(script, /buildYandexSystemPrompt/);
});

test('Yandex prompt eval CLI has an implemented env-only live path', () => {
  assert.match(script, /YANDEX_BASE_URL/);
  assert.match(script, /callYandex/);
  assert.match(script, /OpenAIClient/);
  assert.match(script, /chat\.completions\.create/);
  assert.match(script, /x-data-logging-enabled/);
  assert.doesNotMatch(script, /Live Yandex eval is not implemented yet/);
});

test('Yandex prompt eval CLI scores live rows against fixture tags', () => {
  assert.match(script, /function scoreOutput/);
  assert.match(script, /module\.exports/);
  assert.match(script, /evaluateExpectedTag/);
  assert.match(script, /score_passed/);
  assert.match(script, /quality_score/);
  assert.match(script, /failed_tags/);
  assert.match(script, /tag_results/);
  assert.match(script, /summarizeLiveRows/);
  assert.match(script, /Best candidate/);
});

test('Yandex prompt eval CLI can fail live runs by pass-rate gate', () => {
  assert.match(script, /--min-pass-rate/);
  assert.match(script, /minPassRate/);
  assert.match(script, /gatePassed/);
  assert.match(script, /process\.exitCode = 1/);
});

test('package exposes Yandex prompt eval dry-run, env-check, smoke, and full scripts', () => {
  assert.equal(packageJson.scripts['yandex:prompt-eval:dry-run'], 'npm run yandex:prompt-eval -- --dry-run');
  assert.match(packageJson.scripts['yandex:prompt-eval:check-live-env'], /--check-live-env/);
  assert.match(packageJson.scripts['yandex:prompt-eval:live:smoke'], /--packs yandex-ru-lite/);
  assert.match(packageJson.scripts['yandex:prompt-eval:live:smoke'], /--max-calls 6/);
  assert.equal(packageJson.scripts['yandex:prompt-eval:live:full'], 'npm run yandex:prompt-eval');
});

test('legacy Yandex guardrail experiment wrapper cannot read app credentials', () => {
  assert.doesNotMatch(legacyScript, /require\(['"]electron['"]\)/);
  assert.doesNotMatch(legacyScript, /safeStorage/);
  assert.doesNotMatch(legacyScript, /credentials\.enc/);
  assert.match(legacyScript, /yandex-prompt-eval\.cjs/);
});

test('default Yandex fixture includes the recruitment pipeline guardrail regression case', () => {
  const scenario = defaultFixture.scenarios.find((item) => item.scenario_id === 'recruitment-pipeline-public');

  assert.ok(scenario);
  assert.equal(scenario.public_safe, true);
  assert.match(scenario.current_turn, /recruitment pipeline/);
  assert.ok(scenario.expected_safety_tags.includes('no_provider_refusal'));
});

test('Yandex scorer fails canonical provider refusal text', () => {
  const scenario = defaultFixture.scenarios.find((item) => item.scenario_id === 'recruitment-pipeline-public');
  const result = evalCli.scoreOutput({
    output: 'Я не могу обсуждать эту тему. Давайте поговорим о чём-нибудь ещё.',
    scenario,
    normalized: { status: 'blocked', blocked: true, refusalTextDetected: true },
  });

  assert.equal(result.score_passed, false);
  assert.ok(result.failed_tags.includes('no_provider_refusal'));
});

test('Yandex scorer passes a structured Russian recruitment pipeline artifact', () => {
  const scenario = defaultFixture.scenarios.find((item) => item.scenario_id === 'recruitment-pipeline-public');
  const output = [
    '1. Intake: согласовать роль, вилку, must-have навыки и процесс.',
    '2. Сообщение кандидату: коротко описать продукт, роль и следующий шаг.',
    '3. Scorecard: React, TypeScript, архитектура фронтенда, коммуникация.',
    '4. SLA: recruiter отвечает за 24 часа, hiring manager за 48 часов, interviewer за 24 часа.',
    '5. Фидбек после интервью: сильные стороны, риски и решение по следующему этапу до оффера.',
  ].join('\n');
  const result = evalCli.scoreOutput({
    output,
    scenario,
    normalized: { status: 'ok', blocked: false, refusalTextDetected: false },
  });

  assert.equal(result.score_passed, true);
  assert.deepEqual(result.failed_tags, []);
});

test('Yandex scorer catches fabricated metrics in no-context behavioral answers', () => {
  const scenario = defaultFixture.scenarios.find((item) => item.scenario_id === 'ml-missing-context-behavioral');
  const output = 'В прошлом проекте я улучшил метрику модели на 25% и снизил latency на 40%, поэтому хорошо подхожу на роль.';
  const result = evalCli.scoreOutput({
    output,
    scenario,
    normalized: { status: 'ok', blocked: false, refusalTextDetected: false },
  });

  assert.equal(result.score_passed, false);
  assert.ok(result.failed_tags.includes('no_context_admission'));
  assert.ok(result.failed_tags.includes('no_fabricated_metrics'));
});

test('Yandex scorer summary ranks zero-block full-pass pack first', () => {
  const summary = evalCli.summarizeLiveRows([
    { model_key: 'yandexgpt-5-lite', prompt_pack: 'baseline', status: 'ok', blocked: true, score_passed: false, quality_score: 0.5 },
    { model_key: 'yandexgpt-5-lite', prompt_pack: 'yandex-ru-lite', status: 'ok', blocked: false, score_passed: true, quality_score: 1 },
    { model_key: 'yandexgpt-5-lite', prompt_pack: 'yandex-ru-lite', status: 'ok', blocked: false, score_passed: true, quality_score: 1 },
  ]);

  assert.equal(summary[0].prompt_pack, 'yandex-ru-lite');
  assert.equal(summary[0].pass_rate, 1);
  assert.equal(summary[0].blocked, 0);
});

test('Yandex live env status reports readiness from aliases without exposing secrets', () => {
  const old = {
    YANDEX_EVAL_LIVE: process.env.YANDEX_EVAL_LIVE,
    YANDEX_API_KEY: process.env.YANDEX_API_KEY,
    YANDEX_FOLDER_ID: process.env.YANDEX_FOLDER_ID,
    YANDEXGPT_API_KEY: process.env.YANDEXGPT_API_KEY,
    YANDEXGPT_FOLDER_ID: process.env.YANDEXGPT_FOLDER_ID,
  };
  try {
    delete process.env.YANDEX_API_KEY;
    delete process.env.YANDEX_FOLDER_ID;
    process.env.YANDEX_EVAL_LIVE = '1';
    process.env.YANDEXGPT_API_KEY = 'secret-key-value';
    process.env.YANDEXGPT_FOLDER_ID = 'secret-folder-value';

    const status = evalCli.liveEnvStatus();
    assert.equal(status.ready, true);
    assert.equal(status.api_key_source, 'YANDEXGPT_API_KEY');
    assert.equal(status.folder_id_source, 'YANDEXGPT_FOLDER_ID');
    assert.deepEqual(Object.values(status).includes('secret-key-value'), false);
    assert.deepEqual(Object.values(status).includes('secret-folder-value'), false);
  } finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
