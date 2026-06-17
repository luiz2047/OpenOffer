# Yandex Russian Prompt Eval

This is the local contributor workflow for checking Russian YandexGPT prompt
reliability in OpenOffer. It is a dated provider-compatibility scorecard, not a
claim that OpenOffer can bypass Yandex provider moderation globally.

For the current requirement-by-requirement status, see
`docs/testing/YANDEX_RUSSIAN_PROMPT_COMPLETION_AUDIT.md`.

## Dry Run

Dry-run mode validates the public fixture and writes redacted rows without
Yandex credentials or network calls. It uses the same built prompt-pack module
as the runtime path, so unknown pack IDs fail before any live experiment.

```bash
npm run yandex:prompt-eval -- --dry-run
```

Shortcut:

```bash
npm run yandex:prompt-eval:dry-run
```

Default output goes under `.eval-runs/yandex-ru/`. It does not include API keys,
folder IDs, raw requests, private paths, prompt excerpts, or answer excerpts.

Default comparison matrix:

- `yandexgpt-5.1`
- `yandexgpt-5-lite`
- `current-openoffer-baseline`
- `yandex-ru-lite`
- `yandex-ru-strict-grounded`

## Fixture

The default public fixture covers five mock-interview turns plus one
public-safe recruitment pipeline artifact request:

```bash
docs/testing/fixtures/yandex-ru-ml-engineer-mock.json
```

Public fixtures must be marked `public_safe: true` and must not contain private
Obsidian notes, real resumes, credentials, customer data, or local filesystem
paths.

## Live Eval

Live Yandex calls are disabled unless all env credentials are present and
`YANDEX_EVAL_LIVE=1` is set. The runner accepts either
`YANDEX_API_KEY`/`YANDEX_FOLDER_ID` or the app-compatible aliases
`YANDEXGPT_API_KEY`/`YANDEXGPT_FOLDER_ID`:

```bash
cp .env.example .env
```

Fill `YANDEX_API_KEY` and `YANDEX_FOLDER_ID` in `.env`. The eval runner loads
the repository root `.env` automatically without overriding already-set shell
variables. `YANDEX_EVAL_LIVE=1` is intentionally commented in `.env.example`;
uncomment it only for live network evals.

```bash
npm run yandex:prompt-eval:check-live-env
```

```bash
YANDEX_EVAL_LIVE=1 \
YANDEX_API_KEY=... \
YANDEX_FOLDER_ID=... \
npm run yandex:prompt-eval -- --fixture docs/testing/fixtures/yandex-ru-ml-engineer-mock.json
```

For a smaller smoke run:

```bash
YANDEX_EVAL_LIVE=1 \
YANDEX_API_KEY=... \
YANDEX_FOLDER_ID=... \
npm run yandex:prompt-eval:live:smoke
```

The smoke shortcut runs `yandexgpt-5-lite` + `yandex-ru-lite` across the six
default fixture scenarios. The full shortcut runs the whole default matrix:

```bash
YANDEX_EVAL_LIVE=1 \
YANDEX_API_KEY=... \
YANDEX_FOLDER_ID=... \
npm run yandex:prompt-eval:live:full
```

Live mode exits non-zero if the best model/pack fails the gate. The default
gate is strict (`--min-pass-rate 1`), so every row for the winning model/pack
must pass with zero provider blocks and zero request errors. For exploratory
runs, lower the gate explicitly:

```bash
YANDEX_EVAL_LIVE=1 \
YANDEX_API_KEY=... \
YANDEX_FOLDER_ID=... \
npm run yandex:prompt-eval -- --packs yandex-ru-lite --min-pass-rate 0.8
```

The live runner sends `x-data-logging-enabled: false`, never writes API keys or
folder IDs, and reports provider moderation separately from answer quality.
`--public` enables short output excerpts only for fixtures marked
`public_safe: true`; prompt excerpts remain disabled.

Live rows are scored against each scenario's `expected_safety_tags` with a
small deterministic scorer. It catches provider refusal text, non-Russian
answers, missing structure, prompt-extraction leaks, invented metrics in
no-context cases, and the recruitment-pipeline artifact shape. The scorer is a
regression gate, not a substitute for human review of answer quality.

`scripts/yandex-guardrail-experiment.cjs` is now only a compatibility wrapper
around this runner. It does not read Electron app credentials; use env variables
for every live run.

## Runtime Answer Style Selection

Runtime Yandex text requests call `buildYandexSystemPrompt()` before
`normalizeYandexSystemPrompt()`.

- The app UI exposes Answer style: Automatic, Standard, Strict, Expanded, Hint mode, and Grounded.
- Automatic Russian or auto-language Yandex requests resolve to the internal `yandex-ru-lite` adapter prompt.
- Strict and Grounded resolve to the stricter internal `yandex-ru-strict-grounded` adapter prompt for Yandex/RU.
- `OPENOFFER_ANSWER_STYLE=<style-id>` can force a public answer style locally.
- `OPENOFFER_YANDEX_PROMPT_PACK=<pack-id>` remains a legacy/debug adapter override for eval comparisons.
- The builder replaces the large OpenAI-style base prompt while preserving the
  trusted `## ACTIVE MODE` and pinned active-mode instructions.
- Non-Russian Yandex requests can fall back to `current-openoffer-baseline`.

## Result Fields

Dry-run JSONL rows include:

- `fixture_id`
- `scenario_id`
- `model`
- `model_key`
- `prompt_pack`
- `prompt_pack_label`
- `mode`
- `input_language`
- `status`
- `blocked`
- `block_reason`
- `refusal_text_detected`
- `output_chars`
- `prompt_chars`
- `user_chars`
- `messages_count`
- `prompt_excerpt: null`
- `output_excerpt: null`

Live JSONL rows additionally include:

- `score_passed`
- `quality_score`
- `failed_tags`
- `tag_results`
- `latency_ms`

The live markdown report includes a model/pack summary table and a best
candidate by pass rate, then blocked/error count, then average score.

## Pass Criteria

The first live scorecard should prove a narrow statement:

- 0 raw Yandex refusal strings shown through runtime paths.
- 0 provider blocks on the public normal mock-interview and recruitment-artifact scenarios for the
  chosen winning pack/model.
- At least 5 of 6 answer rows pass Russian usefulness, grounding, and directness.
- No fabricated personal facts in no-context behavioral scenarios.
