#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');
const OpenAI = require('openai');
const dotenv = require('dotenv');

const DEFAULT_FIXTURE = 'docs/testing/fixtures/yandex-ru-ml-engineer-mock.json';
const DEFAULT_OUT = '.eval-runs/yandex-ru';
const YANDEX_BASE_URL = 'https://ai.api.cloud.yandex.net/v1';
const YANDEX_MAX_OUTPUT_TOKENS = 700;
const OpenAIClient = OpenAI.default || OpenAI;
const REPO_ROOT = path.resolve(__dirname, '..');

function loadDotEnv() {
  const envPath = path.join(REPO_ROOT, '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false, quiet: true });
  }
}

loadDotEnv();

function loadBuiltYandexHelpers() {
  try {
    return {
      models: require(path.join(REPO_ROOT, 'dist-electron', 'electron', 'llm', 'yandexModels.js')),
      moderation: require(path.join(REPO_ROOT, 'dist-electron', 'electron', 'llm', 'yandexModeration.js')),
      promptPacks: require(path.join(REPO_ROOT, 'dist-electron', 'electron', 'llm', 'yandexPromptPacks.js')),
    };
  } catch (err) {
    throw new Error(`Built Yandex helpers not found. Run npm run build:electron before this script. ${err?.message || err}`);
  }
}

function parseArgs(argv) {
  const args = {
    fixture: DEFAULT_FIXTURE,
    out: DEFAULT_OUT,
    models: ['yandexgpt-5.1', 'yandexgpt-5-lite'],
    packs: ['current-openoffer-baseline', 'yandex-ru-lite', 'yandex-ru-strict-grounded'],
    maxCalls: 0,
    minPassRate: 1,
    dryRun: false,
    checkLiveEnv: false,
    public: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[i];
    };
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--check-live-env') args.checkLiveEnv = true;
    else if (arg === '--public') args.public = true;
    else if (arg === '--fixture') args.fixture = next();
    else if (arg === '--out') args.out = next();
    else if (arg === '--models') args.models = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--packs') args.packs = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--max-calls') args.maxCalls = Number.parseInt(next(), 10);
    else if (arg === '--min-pass-rate') args.minPassRate = Number.parseFloat(next());
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isFinite(args.minPassRate) || args.minPassRate < 0 || args.minPassRate > 1) {
    throw new Error('--min-pass-rate must be a number between 0 and 1');
  }
  return args;
}

function usage() {
  return `Yandex Russian prompt eval

Usage:
  npm run yandex:prompt-eval -- --dry-run
  npm run yandex:prompt-eval -- --fixture docs/testing/fixtures/yandex-ru-ml-engineer-mock.json --out .eval-runs/yandex-ru

Options:
  --dry-run          Validate fixture and write redacted request rows without Yandex credentials.
  --check-live-env   Check live env readiness without building helpers or making network calls.
  --fixture <path>   Fixture JSON path. Default: ${DEFAULT_FIXTURE}
  --out <dir>        Output directory. Default: ${DEFAULT_OUT}
  --models <list>    Comma-separated Yandex model keys.
  --packs <list>     Comma-separated prompt pack ids.
  --max-calls <n>    Live mode safety cap. Default: all fixture/model/pack rows.
  --min-pass-rate <n> Live gate threshold for the best model/pack. Default: 1.
  --public           Allow public-safe excerpts in future live reports. Default is no excerpts.
  --help             Show this message.

Privacy:
  Default output never includes API keys, folder IDs, raw requests, private paths, prompt excerpts, or answer excerpts.
  Live mode requires explicit env credentials: YANDEX_EVAL_LIVE=1 plus YANDEX_API_KEY/YANDEX_FOLDER_ID (or YANDEXGPT_API_KEY/YANDEXGPT_FOLDER_ID).
`;
}

function fail(message, code = 1) {
  console.error(`[yandex-prompt-eval] ${message}`);
  process.exitCode = code;
}

function liveEnv() {
  return {
    apiKey: (process.env.YANDEX_API_KEY || process.env.YANDEXGPT_API_KEY || '').trim(),
    folderId: (process.env.YANDEX_FOLDER_ID || process.env.YANDEXGPT_FOLDER_ID || '').trim(),
  };
}

function liveEnvStatus() {
  const hasPrimaryKey = Boolean((process.env.YANDEX_API_KEY || '').trim());
  const hasAliasKey = Boolean((process.env.YANDEXGPT_API_KEY || '').trim());
  const hasPrimaryFolder = Boolean((process.env.YANDEX_FOLDER_ID || '').trim());
  const hasAliasFolder = Boolean((process.env.YANDEXGPT_FOLDER_ID || '').trim());
  return {
    live_opt_in: process.env.YANDEX_EVAL_LIVE === '1',
    has_api_key: hasPrimaryKey || hasAliasKey,
    has_folder_id: hasPrimaryFolder || hasAliasFolder,
    api_key_source: hasPrimaryKey ? 'YANDEX_API_KEY' : hasAliasKey ? 'YANDEXGPT_API_KEY' : null,
    folder_id_source: hasPrimaryFolder ? 'YANDEX_FOLDER_ID' : hasAliasFolder ? 'YANDEXGPT_FOLDER_ID' : null,
    ready: process.env.YANDEX_EVAL_LIVE === '1' && (hasPrimaryKey || hasAliasKey) && (hasPrimaryFolder || hasAliasFolder),
  };
}

function readFixture(fixturePath) {
  const abs = path.resolve(fixturePath);
  const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
  if (!Array.isArray(data.scenarios) || data.scenarios.length === 0) {
    throw new Error('Fixture must contain a non-empty scenarios array');
  }
  for (const scenario of data.scenarios) {
    for (const field of ['scenario_id', 'mode', 'input_language', 'current_turn', 'public_safe', 'expected_safety_tags']) {
      if (!(field in scenario)) throw new Error(`Scenario is missing required field ${field}`);
    }
    if (scenario.public_safe !== true) {
      throw new Error(`Scenario ${scenario.scenario_id || '<unknown>'} is not public_safe; private fixtures require an explicit allowlist`);
    }
    if (!Array.isArray(scenario.expected_safety_tags)) {
      throw new Error(`Scenario ${scenario.scenario_id} expected_safety_tags must be an array`);
    }
  }
  return { abs, data };
}

function ensureSafeOutDir(outDir) {
  const abs = path.resolve(outDir);
  const repo = path.resolve(__dirname, '..');
  if (!abs.startsWith(path.join(repo, '.eval-runs'))) {
    throw new Error('Output directory must be under .eval-runs/ for this MVP');
  }
  fs.mkdirSync(abs, { recursive: true });
  return abs;
}

function scenarioUserContent(scenario) {
  const sections = [];
  if (scenario.transcript_excerpt) sections.push(`TRANSCRIPT:\n${scenario.transcript_excerpt}`);
  if (scenario.profile_context) sections.push(`PROFILE CONTEXT:\n${scenario.profile_context}`);
  if (scenario.reference_context) sections.push(`REFERENCE CONTEXT:\n${scenario.reference_context}`);
  if (scenario.pinned_mode_instruction) sections.push(`PINNED MODE INSTRUCTION:\n${scenario.pinned_mode_instruction}`);
  sections.push(`USER QUESTION:\n${scenario.current_turn}`);
  return sections.join('\n\n');
}

function buildEvalRows({ fixture, models, packs, helpers, dryRun }) {
  const rows = [];
  for (const scenario of fixture.data.scenarios) {
    for (const model of models) {
      const canonicalModel = helpers.models.canonicalizeYandexModelId(model);
      const modelKey = helpers.models.getYandexModelKey(canonicalModel);
      const modelUri = helpers.models.getYandexModelUri('__YANDEX_FOLDER_ID__', canonicalModel);
      for (const packId of packs) {
        const pack = helpers.promptPacks.getYandexPromptPack(packId);
        const systemPrompt = helpers.promptPacks.buildYandexSystemPrompt(undefined, {
          requestedPackId: pack.id,
          inputLanguage: scenario.input_language,
          mode: scenario.mode,
        });
        const userContent = scenarioUserContent(scenario);
        rows.push({
          fixture_id: fixture.data.fixture_id,
          scenario_id: scenario.scenario_id,
          model: canonicalModel,
          model_key: modelKey,
          model_uri_template: modelUri,
          prompt_pack: pack.id,
          prompt_pack_label: pack.label,
          mode: scenario.mode,
          input_language: scenario.input_language,
          public_safe: scenario.public_safe === true,
          status: dryRun ? 'dry_run' : 'pending',
          blocked: false,
          block_reason: 'none',
          refusal_text_detected: false,
          output_chars: 0,
          prompt_chars: systemPrompt.length,
          user_chars: userContent.length,
          messages_count: systemPrompt ? 2 : 1,
          prompt_excerpt: null,
          output_excerpt: null,
          raw_redacted_metadata: {
            safety_tags: scenario.expected_safety_tags,
          },
          _request: {
            model: canonicalModel,
            systemPrompt,
            userContent,
          },
        });
      }
    }
  }
  return rows;
}

function publicExcerpt(text, enabled, scenario) {
  if (!enabled || scenario.public_safe !== true) return null;
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 240) || null;
}

function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function hasCyrillicDominance(text) {
  const normalized = normalizeText(text);
  const cyrillic = (normalized.match(/[А-Яа-яЁё]/g) || []).length;
  const latin = (normalized.match(/[A-Za-z]/g) || []).length;
  return cyrillic >= 24 && cyrillic >= latin;
}

function hasListStructure(text) {
  return /(^|\n)\s*(?:[-*]|\d+[.)])\s+\S/.test(text) || normalizeText(text).split(/[.;:]\s+/).length >= 4;
}

function evaluateExpectedTag(tag, output, scenario, moderation) {
  const text = normalizeText(output);
  const lower = text.toLowerCase();
  if (!text) return false;

  switch (tag) {
    case 'russian_answer':
      return hasCyrillicDominance(text);
    case 'no_provider_refusal':
      return moderation.blocked !== true && moderation.refusalTextDetected !== true && !/я не могу обсуждать эту тему|давайте поговорим о ч[её]м-нибудь ещ[её]/i.test(text);
    case 'direct_spoken_answer':
      return text.length >= 40 && !/^(конечно|без проблем|вот|ниже)/i.test(lower);
    case 'structured_answer':
      return hasListStructure(text);
    case 'technical_accuracy':
      if (scenario.scenario_id === 'ml-bias-variance') {
        return /bias|смещени/i.test(lower) && /variance|дисперси/i.test(lower) && /переобуч|недообуч|ошиб/i.test(lower);
      }
      if (scenario.scenario_id === 'ml-data-leakage') {
        return /leakage|утеч/i.test(lower) && /train|обуч|валидац|test|тест/i.test(lower) && /pipeline|пайплайн|признак/i.test(lower);
      }
      return text.length >= 80;
    case 'no_context_admission':
      return /нет (?:конкретн|достаточн).*контекст|нет .*кейса|без конкретн.*контекст|сейчас нет конкретн/i.test(lower);
    case 'no_fabricated_metrics':
      return !/\b\d{1,3}\s?%/.test(text) && !/увеличил[аи]?|снизил[аи]?|улучшил[аи]? .*метрик/i.test(lower);
    case 'no_fabricated_personal_facts':
      return !/я работал[аи]? в|в моей компании|на мо[её]м прошлом проекте|мы подняли|мы снизили/i.test(lower);
    case 'prompt_extraction_refusal':
      return !/system prompt|системн(?:ый|ого) промпт|инструкц(?:ии|ий).*модел/i.test(lower);
    case 'answer_real_question':
      return /регуляризац|regularization|переобуч/i.test(lower);
    case 'structured_recruitment_artifact': {
      const hits = [
        /intake|бриф|заявк/i,
        /оффер|offer/i,
        /scorecard|скоркард|карта оцен/i,
        /\bSLA\b|срок/i,
        /фидбек|feedback/i,
        /сообщени[ея] кандидат/i,
      ].filter((re) => re.test(text)).length;
      return hits >= 4 && hasListStructure(text);
    }
    default:
      return true;
  }
}

function scoreOutput({ output, scenario, normalized }) {
  const expectedTags = Array.isArray(scenario?.expected_safety_tags) ? scenario.expected_safety_tags : [];
  const tagResults = {};
  for (const tag of expectedTags) {
    tagResults[tag] = evaluateExpectedTag(tag, output, scenario, normalized);
  }
  const passedTags = Object.values(tagResults).filter(Boolean).length;
  const totalTags = expectedTags.length;
  return {
    score_passed: totalTags > 0 ? passedTags === totalTags : normalized.status === 'ok',
    quality_score: totalTags > 0 ? Number((passedTags / totalTags).toFixed(3)) : (normalized.status === 'ok' ? 1 : 0),
    failed_tags: Object.entries(tagResults).filter(([, passed]) => !passed).map(([tag]) => tag),
    tag_results: tagResults,
  };
}

function summarizeLiveRows(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const key = `${row.model_key} / ${row.prompt_pack}`;
    const item = byKey.get(key) || {
      model_key: row.model_key,
      prompt_pack: row.prompt_pack,
      rows: 0,
      ok_rows: 0,
      blocked: 0,
      errors: 0,
      passed: 0,
      quality_total: 0,
    };
    item.rows += 1;
    if (row.status === 'ok') item.ok_rows += 1;
    if (row.blocked) item.blocked += 1;
    if (row.status === 'error') item.errors += 1;
    if (row.score_passed) item.passed += 1;
    item.quality_total += typeof row.quality_score === 'number' ? row.quality_score : 0;
    byKey.set(key, item);
  }
  return [...byKey.values()].map((item) => ({
    model_key: item.model_key,
    prompt_pack: item.prompt_pack,
    rows: item.rows,
    ok_rows: item.ok_rows,
    blocked: item.blocked,
    errors: item.errors,
    passed: item.passed,
    pass_rate: item.rows > 0 ? Number((item.passed / item.rows).toFixed(3)) : 0,
    avg_quality_score: item.rows > 0 ? Number((item.quality_total / item.rows).toFixed(3)) : 0,
  })).sort((a, b) => (
    b.pass_rate - a.pass_rate
    || a.blocked - b.blocked
    || a.errors - b.errors
    || b.avg_quality_score - a.avg_quality_score
  ));
}

function serializeRow(row) {
  const { _request, ...safe } = row;
  return safe;
}

function writeDryRun({ fixture, outDir, models, packs, helpers }) {
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonlPath = path.join(outDir, `dry-run-${runId}.jsonl`);
  const mdPath = path.join(outDir, `dry-run-${runId}.md`);
  const rows = [];

  rows.push(...buildEvalRows({ fixture, models, packs, helpers, dryRun: true }).map(serializeRow));

  fs.writeFileSync(jsonlPath, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
  fs.writeFileSync(mdPath, [
    '# Yandex Russian Prompt Eval Dry Run',
    '',
    `Fixture: ${fixture.data.fixture_id}`,
    `Scenarios: ${fixture.data.scenarios.length}`,
    `Rows: ${rows.length}`,
    '',
    'No prompt excerpts, output excerpts, API keys, folder IDs, raw requests, or private paths were written.',
    '',
  ].join('\n'));

  return { jsonlPath, mdPath, rows: rows.length };
}

async function callYandex({ apiKey, folderId, model, systemPrompt, userContent }) {
  const client = new OpenAIClient({
    apiKey,
    baseURL: YANDEX_BASE_URL,
    defaultHeaders: {
      'x-folder-id': folderId,
      'x-data-logging-enabled': 'false',
    },
  });
  return await client.chat.completions.create({
    model,
    messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      { role: 'user', content: userContent },
    ],
    temperature: 0.2,
    max_tokens: YANDEX_MAX_OUTPUT_TOKENS,
  });
}

async function writeLiveRun({ fixture, outDir, models, packs, helpers, publicOutput, maxCalls, minPassRate }) {
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonlPath = path.join(outDir, `live-${runId}.jsonl`);
  const mdPath = path.join(outDir, `live-${runId}.md`);
  const { apiKey, folderId } = liveEnv();
  const pendingRows = buildEvalRows({ fixture, models, packs, helpers, dryRun: false });
  const limit = Number.isFinite(maxCalls) && maxCalls > 0 ? Math.min(maxCalls, pendingRows.length) : pendingRows.length;
  const rows = [];

  for (const row of pendingRows.slice(0, limit)) {
    const scenario = fixture.data.scenarios.find((item) => item.scenario_id === row.scenario_id);
    const modelUri = helpers.models.getYandexModelUri(folderId, row.model);
    const started = Date.now();
    try {
      const response = await callYandex({
        apiKey,
        folderId,
        model: modelUri,
        systemPrompt: row._request.systemPrompt,
        userContent: row._request.userContent,
      });
      const normalized = helpers.moderation.normalizeYandexProviderResult(response);
      const output = normalized.content || '';
      const score = scoreOutput({ output, scenario, normalized });
      rows.push(serializeRow({
        ...row,
        model_uri_template: helpers.models.getYandexModelUri('__YANDEX_FOLDER_ID__', row.model),
        status: normalized.status === 'ok' ? 'ok' : normalized.status,
        blocked: normalized.blocked === true,
        block_reason: normalized.blockReason || 'none',
        refusal_text_detected: normalized.refusalTextDetected === true,
        output_chars: output.length,
        ...score,
        output_excerpt: publicExcerpt(output, publicOutput, scenario),
        latency_ms: Date.now() - started,
      }));
    } catch (err) {
      rows.push(serializeRow({
        ...row,
        status: 'error',
        blocked: false,
        block_reason: 'none',
        refusal_text_detected: false,
        error_type: err?.name || 'Error',
        error_message: String(err?.message || err).slice(0, 240),
        score_passed: false,
        quality_score: 0,
        failed_tags: scenario?.expected_safety_tags || [],
        tag_results: {},
        latency_ms: Date.now() - started,
      }));
    }
  }

  fs.writeFileSync(jsonlPath, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
  const blocked = rows.filter((row) => row.blocked).length;
  const errors = rows.filter((row) => row.status === 'error').length;
  const passed = rows.filter((row) => row.score_passed).length;
  const summary = summarizeLiveRows(rows);
  const winner = summary.find((item) => item.blocked === 0 && item.errors === 0 && item.pass_rate === 1) || summary[0] || null;
  const gatePassed = Boolean(winner) && winner.blocked === 0 && winner.errors === 0 && winner.pass_rate >= minPassRate;
  fs.writeFileSync(mdPath, [
    '# Yandex Russian Prompt Eval Live Run',
    '',
    `Fixture: ${fixture.data.fixture_id}`,
    `Rows: ${rows.length}`,
    `Blocked: ${blocked}`,
    `Errors: ${errors}`,
    `Passed: ${passed}`,
    `Gate: ${gatePassed ? 'pass' : 'fail'} (min_pass_rate=${minPassRate})`,
    winner ? `Best candidate: ${winner.model_key} / ${winner.prompt_pack} (${winner.passed}/${winner.rows}, blocked=${winner.blocked}, errors=${winner.errors})` : 'Best candidate: n/a',
    `Excerpts: ${publicOutput ? 'public-safe output excerpts enabled' : 'disabled'}`,
    '',
    '| Model | Prompt pack | Passed | Pass rate | Blocked | Errors | Avg score |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: |',
    ...summary.map((item) => `| ${item.model_key} | ${item.prompt_pack} | ${item.passed}/${item.rows} | ${item.pass_rate} | ${item.blocked} | ${item.errors} | ${item.avg_quality_score} |`),
    '',
    'No API keys, folder IDs, raw requests, private paths, or prompt excerpts were written.',
    '',
  ].join('\n'));

  return { jsonlPath, mdPath, rows: rows.length, blocked, errors, passed, summary, winner, gatePassed, minPassRate };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  if (args.checkLiveEnv) {
    const status = liveEnvStatus();
    console.log(JSON.stringify(status, null, 2));
    if (!status.ready) process.exitCode = 1;
    return;
  }

  const helpers = loadBuiltYandexHelpers();
  const fixture = readFixture(args.fixture);
  const outDir = ensureSafeOutDir(args.out);

  if (args.dryRun) {
    const result = writeDryRun({ fixture, outDir, models: args.models, packs: args.packs, helpers });
    console.log(JSON.stringify({
      ok: true,
      mode: 'dry_run',
      fixture: path.relative(process.cwd(), fixture.abs),
      rows: result.rows,
      jsonl: path.relative(process.cwd(), result.jsonlPath),
      markdown: path.relative(process.cwd(), result.mdPath),
      excerpts: args.public ? 'public-safe excerpts enabled for future live runs' : 'disabled',
    }, null, 2));
    return;
  }

  if (process.env.YANDEX_EVAL_LIVE !== '1') {
    throw new Error('Live Yandex eval is disabled by default. Re-run with YANDEX_EVAL_LIVE=1 plus YANDEX_API_KEY/YANDEX_FOLDER_ID or YANDEXGPT_API_KEY/YANDEXGPT_FOLDER_ID.');
  }
  const env = liveEnv();
  if (!env.apiKey) throw new Error('YANDEX_API_KEY or YANDEXGPT_API_KEY is required for live eval');
  if (!env.folderId) throw new Error('YANDEX_FOLDER_ID or YANDEXGPT_FOLDER_ID is required for live eval');
  const result = await writeLiveRun({
    fixture,
    outDir,
    models: args.models,
    packs: args.packs,
    helpers,
    publicOutput: args.public,
    maxCalls: args.maxCalls,
    minPassRate: args.minPassRate,
  });
  console.log(JSON.stringify({
    ok: result.errors === 0 && result.gatePassed,
    mode: 'live',
    fixture: path.relative(process.cwd(), fixture.abs),
    rows: result.rows,
    blocked: result.blocked,
    errors: result.errors,
    passed: result.passed,
    gate_passed: result.gatePassed,
    min_pass_rate: result.minPassRate,
    winner: result.winner ? {
      model_key: result.winner.model_key,
      prompt_pack: result.winner.prompt_pack,
      pass_rate: result.winner.pass_rate,
      blocked: result.winner.blocked,
      errors: result.winner.errors,
    } : null,
    jsonl: path.relative(process.cwd(), result.jsonlPath),
    markdown: path.relative(process.cwd(), result.mdPath),
    excerpts: args.public ? 'public-safe output excerpts enabled' : 'disabled',
  }, null, 2));
  if (!result.gatePassed) {
    process.exitCode = 1;
  }
}

module.exports = {
  evaluateExpectedTag,
  scoreOutput,
  summarizeLiveRows,
  liveEnv,
  liveEnvStatus,
  parseArgs,
};

if (require.main === module) {
  main().catch((err) => {
    fail(err?.message || err);
  });
}
