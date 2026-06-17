# Yandex Russian Prompt Reliability Completion Audit

Date: 2026-06-17
Branch: `feat/yandex-ru-prompt-reliability`

This audit tracks the current evidence for the Yandex/Russian prompt reliability
task. It is intentionally strict: the provider claim is complete only when a
live Yandex eval passes with real credentials and no provider guardrail blocks.

## Requirements

| Requirement | Current evidence | Status |
| --- | --- | --- |
| Yandex AI Studio can be configured as a BYOK text provider | Runtime config in `electron/LLMHelper.ts`, credentials plumbing in `electron/ProcessingHelper.ts`, Settings UI in `src/components/settings/AIProvidersSettings.tsx`, setup doc in `docs/YANDEX_AI_STUDIO_SETUP.md` | Implemented |
| Yandex model IDs are stable in app state and expand to folder-scoped `gpt://` URIs only at request time | `electron/llm/yandexModels.ts`, runtime/tests in `electron/llm/__tests__/yandexModels.test.mjs` and `electron/services/__tests__/YandexProvider.test.mjs` | Implemented |
| Russian/auto Yandex requests use a Russian interview prompt by default | `electron/llm/yandexPromptPacks.ts`; runtime calls `buildYandexSystemPrompt()` before `normalizeYandexSystemPrompt()`; Settings shows user-facing `Answer style` | Implemented |
| Prompt pack preserves active mode and pinned instructions | `buildYandexSystemPrompt()` keeps trusted active-mode tail; covered by `electron/llm/__tests__/yandexPromptPacks.test.mjs` | Implemented |
| Normal mock interview and recruitment pipeline cases are covered | `docs/testing/fixtures/yandex-ru-ml-engineer-mock.json` has 6 public-safe scenarios, including the recruitment pipeline guardrail regression | Implemented |
| Raw Yandex provider refusals are normalized and not shown as ordinary answers | `electron/llm/yandexModeration.ts`; runtime returns `YANDEX_PROVIDER_MODERATION_MESSAGE`; covered by moderation/provider tests | Implemented |
| DeepSeek/OpenAI-compatible providers are not accidentally routed through Yandex-specific moderation | `electron/services/__tests__/YandexProvider.test.mjs` checks the DeepSeek path | Implemented |
| Contributor eval is dry-run-first and does not read Electron app credentials | `scripts/yandex-prompt-eval.cjs`; legacy `scripts/yandex-guardrail-experiment.cjs` is only a wrapper; covered by `YandexPromptEvalCli.test.mjs` | Implemented |
| Live eval uses the same OpenAI-compatible semantics as runtime | `scripts/yandex-prompt-eval.cjs` uses OpenAI SDK, Yandex base URL, folder header, data logging off, and model URI helpers | Implemented |
| Live eval has a pass/fail gate | `--min-pass-rate`, scorer fields, winner summary, non-zero exit on gate failure; behavior-tested in `YandexPromptEvalCli.test.mjs` | Implemented |
| Live eval proves no provider guardrail blocks on real Yandex models | Live smoke and full matrix passed with `YANDEX_EVAL_LIVE=1`, `blocked=0`, and `errors=0`; artifacts listed below | Verified |

## Verified Commands

These commands passed in the current worktree:

```bash
node --check scripts/yandex-prompt-eval.cjs
npm run build:electron
npm run typecheck:electron
node --test electron/llm/__tests__/answerStylePacks.test.mjs electron/llm/__tests__/yandexModels.test.mjs electron/llm/__tests__/yandexModeration.test.mjs electron/llm/__tests__/yandexPromptPacks.test.mjs electron/services/__tests__/YandexProvider.test.mjs electron/services/__tests__/YandexPromptEvalCli.test.mjs
npm run yandex:prompt-eval:dry-run
npm run yandex:prompt-eval:check-live-env
npm run yandex:prompt-eval -- --models yandexgpt-5-lite --packs yandex-ru-strict-grounded --max-calls 6
npm run yandex:prompt-eval:live:smoke
npm run yandex:prompt-eval:live:full
```

Dry-run output:

- Fixture: `docs/testing/fixtures/yandex-ru-ml-engineer-mock.json`
- Rows: `36`
- Excerpts: disabled
- Output directory: `.eval-runs/yandex-ru/` (git-ignored)

## Live Gate Evidence

The live environment check passed without printing secrets:

```json
{
  "live_opt_in": true,
  "has_api_key": true,
  "has_folder_id": true,
  "api_key_source": "YANDEX_API_KEY",
  "folder_id_source": "YANDEX_FOLDER_ID",
  "ready": true
}
```

Live smoke, strict grounded pack:

```json
{
  "mode": "live",
  "rows": 6,
  "blocked": 0,
  "errors": 0,
  "passed": 6,
  "gate_passed": true,
  "winner": {
    "model_key": "yandexgpt-5-lite",
    "prompt_pack": "yandex-ru-strict-grounded",
    "pass_rate": 1
  },
  "jsonl": ".eval-runs/yandex-ru/live-2026-06-17T11-38-47-339Z.jsonl",
  "markdown": ".eval-runs/yandex-ru/live-2026-06-17T11-38-47-339Z.md"
}
```

Live smoke, default Yandex/Russian pack:

```json
{
  "mode": "live",
  "rows": 6,
  "blocked": 0,
  "errors": 0,
  "passed": 6,
  "gate_passed": true,
  "winner": {
    "model_key": "yandexgpt-5-lite",
    "prompt_pack": "yandex-ru-lite",
    "pass_rate": 1
  },
  "jsonl": ".eval-runs/yandex-ru/live-2026-06-17T11-39-09-034Z.jsonl",
  "markdown": ".eval-runs/yandex-ru/live-2026-06-17T11-39-09-034Z.md"
}
```

Live full matrix:

```json
{
  "mode": "live",
  "rows": 36,
  "blocked": 0,
  "errors": 0,
  "passed": 27,
  "gate_passed": true,
  "winner": {
    "model_key": "yandexgpt-5.1",
    "prompt_pack": "yandex-ru-lite",
    "pass_rate": 1
  },
  "jsonl": ".eval-runs/yandex-ru/live-2026-06-17T11-39-26-820Z.jsonl",
  "markdown": ".eval-runs/yandex-ru/live-2026-06-17T11-39-26-820Z.md"
}
```

Full matrix per-pack result:

| Model | Prompt pack | Passed | Pass rate | Blocked | Errors |
| --- | --- | ---: | ---: | ---: | ---: |
| `yandexgpt-5.1` | `yandex-ru-lite` | 6/6 | 1 | 0 | 0 |
| `yandexgpt-5.1` | `yandex-ru-strict-grounded` | 6/6 | 1 | 0 | 0 |
| `yandexgpt-5-lite` | `yandex-ru-lite` | 6/6 | 1 | 0 | 0 |
| `yandexgpt-5-lite` | `yandex-ru-strict-grounded` | 6/6 | 1 | 0 | 0 |
| `yandexgpt-5.1` | `current-openoffer-baseline` | 3/6 | 0.5 | 0 | 0 |
| `yandexgpt-5-lite` | `current-openoffer-baseline` | 0/6 | 0 | 0 | 0 |

The full matrix confirms the design-doc assumption: raw baseline prompting is
not reliable for this Russian interview flow, while both Yandex-specific Russian
prompt packs pass on both Yandex models without triggering provider refusals.
