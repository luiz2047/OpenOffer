# Verified Code Execution — Design

> Make Natively's coding answers **verified-correct**: the model's code is run
> against test cases in the background after the answer streams, and a corrected
> answer is posted if it fails. **First priority: never present wrong code as the
> final answer.** Branch `fix/overlay-startup-slide`. Date 2026-06-03.

## Why

Two real production bugs showed the model can emit broken code:
- A streamed Java answer was uncompilable (`nums[i] - 1` → `nums[i], 1` — a
  post-processing corruption, now fixed) and the model couldn't self-diagnose it.
- Coding answers are not *executed*, so a logically-wrong-but-compiling solution
  ships silently.

Prompt obedience + static checks (`CodeSanityCheck`, which already flags the
`subtraction_as_tuple` shape) are necessary but insufficient. The only way to
*know* code is right is to **run it**.

## Principles

1. **Strictly additive.** Verification fires AFTER `response_completed`, never
   awaited — the first streamed answer has zero added latency.
2. **Never claim "verified" unless code actually ran and passed.** No false badges.
3. **Code that fails a problem example is never the final answer** — corrected or
   flagged.
4. **The harness is templated, never model-generated** — it cannot add bugs.
5. **Privacy:** only code + the structured test spec ever leave the device (cloud
   path), gated by a `code_execution` provider-data-scope. Never resume/JD/
   transcript/persona.

## Flow

```
coding answer streams to UI (unchanged, instant)
        │  after response_completed, un-awaited:
        ▼
1. extract  → code block + language + <verification_spec> + problem examples
2. plan     → detect language; local (py/js) | cloud (java/c++/sql) | skip
3. execute  → run code+driver against each test case in a sandbox (timeout+limits)
4. judge    → all pass → ✓ badge ; any fail/error → correction
5. correct  → ONE bounded model fix (problem+code+failing case+actual/expected),
              re-verify; pass → new corrected message; still-fail → flag
              "⚠ couldn't fully verify — review before using"
```

## Latency

- **First answer: zero added latency** (verification is post-stream, un-awaited).
- Passing local (py/js): ✓ badge ~0.1–0.5s after stream ends (proc spawn + run).
- Passing cloud (java/c++): ✓ badge ~0.3–1.5s after (network + Piston).
- A **correction** is a 2nd model call (~1–3s) shown as a new follow-up — only
  when the first answer was actually broken. Bounded to ONE attempt (no loops).
- **Skip when pointless:** no extractable tests + unsupported language → skip
  execution, fall back to the instant static `CodeSanityCheck`.

## Sandbox (local)

Model code is UNTRUSTED. Short-lived subprocess with hard limits (mirrors the
existing `CodexCliService` spawn-with-timeout pattern):

- `child_process.spawn('python3'|'node', [scriptPath])` — fresh OS process per
  run. **Never** `eval`/`vm` in-process (shares Electron heap + APIs).
- **3s wall-clock timeout → SIGKILL** (catches infinite loops).
- **Scrubbed env** (no API keys / minimal PATH), `cwd` = throwaway temp dir,
  **stdin closed**, no extra args.
- **Output cap** ~256KB → kill (catches runaway prints).
- Temp file written under OS temp dir, deleted after.
- **Concurrency semaphore** (max 2) so verification can't storm the machine.

Honest limit: subprocess+timeout is *isolation*, not a hardened jail. Proportionate
because the code originates from OUR model answering the USER's own coding question,
not arbitrary third-party input. Container/seccomp jailing is the cloud (Piston)
path's job; noted as future hardening.

## Structured test contract

`codingContract.ts` gains a hidden block the renderer never sees (stash-and-strip
before display, stream-safe):

```
<verification_spec>
{ "entry": "firstMissingPositive", "language": "java",
  "cases": [ { "input": [[1,2,0]], "expected": 1 },
             { "input": [[3,4,-1,1]], "expected": 2 } ] }
</verification_spec>
```

Three sources, merged & deduped:
1. **Problem examples** (parsed from problem text / screen OCR) — ground truth.
2. **Model-emitted cases** — edge cases the model reasons about.
3. **Fallback** — none available → compile/run smoke test (still catches syntax).

If model code disagrees with a **problem** example → regenerate (problem wins). If
it only fails a **model-authored** case → regenerate, lower confidence.

## Harness, judging, correction

- **Driver** (templated per language, NEVER model-generated): wraps the model's
  function in a `__main__`/`Main` that loads each case input, calls `entry`, prints
  `JSON`. Python/JS now; Java/C++ strings ready for cloud.
- **Judge** (`compareResults`): parse stdout JSON, compare to `expected`. Exact
  match by default; safe normalization (`1`==`1.0`); order-insensitive only when
  the spec flags it. Outcomes: `pass` | `fail` (ran, wrong) | `error` (compile/
  runtime/timeout).
- **Correction:** one bounded model call with problem+code+failing case+actual/
  expected → "fix only the bug, keep structure." Re-verify. Pass → corrected
  message ("Corrected: returned X for input Y"). Still-fail → flag, don't loop.

## Files

`electron/llm/codeVerification/`
- `types.ts` — VerificationSpec, TestCase, RunResult, Verdict
- `extractTests.ts` — pure: parse spec + problem examples, merge/dedupe
- `drivers.ts` — pure: templated per-language driver wrappers
- `localRunner.ts` — sandboxed spawn (limits, semaphore, cleanup)
- `cloudRunner.ts` — Piston client (gated by `code_execution` scope)
- `judge.ts` — pure compareResults
- `verifyCodingAnswer.ts` — orchestrator + one-shot correction
- `__tests__/` — extraction, drivers, judge, real end-to-end local run (py/js)

Wiring: `IntelligenceEngine` fires `verifyCodingAnswer()` un-awaited after
`validateAnswerStructure`; emits `coding_verified` (badge) + correction as new
`suggested_answer`. Same for `gemini-chat-stream`. Renderer: `✓ verified (N
cases)` badge + correction message.

## Correctness guarantees

1. Code that fails a problem example is never the final answer.
2. Syntax/compile errors caught even with zero test cases (smoke-run).
3. Harness/driver templated, never model-generated.
4. Never claim "verified" unless code ran and passed; unverifiable → no badge.

## Gap-closure update (2026-06-03, later)

Two gaps from the first pass were closed:

**Pointer structures (ListNode / TreeNode) — now verified in C++, Python, JS.**
- Encoding contract: linked list = JSON array `[1,2,3]`; binary tree = LeetCode
  level-order `[1,2,3,null,null,4,5]`. Empty/`null` → empty structure.
- **C++** (`cppDriver.ts`): the signature parser now ACCEPTS `ListNode*`/`TreeNode*`
  (a `*` on any other type is still rejected → skip). A harness preamble defines
  the structs + `__nat_build_*`/`__nat_emit_*` helpers; struct defs are emitted
  only when the model didn't define its own (no redefinition error), and helpers
  are emitted AFTER the model code so they see whichever struct exists.
- **Python / JS** (`drivers.ts`): dynamically typed, so the spec carries optional
  `argTypes`/`retType` hints (`'list'|'tree'|'value'`). Drivers define ListNode/
  TreeNode only if absent, then decode args / encode the result per hint. Absent
  hints = plain JSON values (fully backward compatible). `CODING_VERIFICATION_INSTRUCTION`
  now tells the model to emit these hints for list/tree problems.
- Skip boundary (still no false verdict): graphs with arbitrary adjacency,
  doubly-linked lists, and custom classes are NOT supported → clean skip.

**Go + SQL gap closure (2026-06-03, final):**
- **Go** — now LOCAL via `go run` (when a `go` toolchain is installed).
  `goDriver.ts` mirrors C++/Java: parse `func entry(name type, …) ret` (Go's
  name-first params + the `a, b int` shared-type shorthand), build typed literals,
  `package main` + `main()`, one `go run` spawn (compile+run). Supports
  int/int64/float64/bool/string/[]int/[][]int/[]string + *ListNode/*TreeNode;
  multi-return/maps/generics/byte → skip. nil-slice result normalized to `[]`.
  Gated on `go` (absent here → `runtime_unavailable` skip; driver-gen unit-tested,
  real-exec gated-skip).
- **SQL** — now LOCAL via `sqlite3 -safe -bail :memory:` (installed here, fully
  tested). Structurally different: the spec carries `{schema[], seeds[],
  expected[rows], ordered?}` and OMITS entry/cases; the model's query is the Code
  block. `sqlRunner.ts` (`isReadOnlySelect`/`buildSqlScript`/`parseSqlRows`) +
  `runSqlCase` (stdin-fed script, `.mode json`). `judge.compareResultSet`:
  column-name match, **order-insensitive multiset by default** (the key
  false-fail guard), `ordered:true` positional, cardinality, NULL/numeric
  normalization. **DIALECT FIREWALL:** a SQL answer is `fail` ONLY when it ran
  cleanly on sqlite AND rows differ; any sqlite error (MySQL-only constructs like
  `DATE_FORMAT`/`NOW`, bad columns) → `error`/skip, never a false fail.
  Non-SELECT/side-effecting queries → skip. `-safe` blocks ATTACH/.read/.output/
  extension-load (no filesystem escape).
- `CLOUD_LANGUAGES` is now just `['c']`. Everything else runs locally.
- Tests: 569 total (559 pass, 10 gated-skip without Go/Java toolchains). SQL fully
  runs here (21 SQL tests incl. 6 real sqlite3 executions).

### Unsupported-language safety (2026-06-03)
A language NOT in the verified set (c, rust, kotlin, ruby, php, swift, c#, …) is a
CLEAN SKIP — no execution, no badge, never a false verdict. Fixed a bug where an
unknown declared language was coerced to `python` and run in the wrong
interpreter; now an explicitly-declared unsupported language skips immediately
(`unsupported_language`) without falling through to inference. See the unsupported
regression tests in `Orchestrator.test.mjs`.

### DEFERRED to 2.7+ — expand verified-execution language coverage
Adding MORE languages is a post-2.7 follow-up (intentionally out of the initial
release; clean-skip is safe in the meantime). Priority + toolchain reality
(dev machine, 2026-06-03): **Ruby first** (dynamic → cheapest, reuses py/js
pattern, `ruby` present), then **Rust / Swift** (static, `rustc`/`swiftc`
present, cppDriver-style), then **C** (static; fiddly array+returnSize out-params;
currently the lone cloud entry). **PHP / Kotlin / C#** last — toolchains absent on
the dev box, so they'd ship unproven; add behind their toolchain gate. Code-level
marker: `drivers.ts` `LOCAL_LANGUAGES` `TODO(2.7+)`.

**Java — a LOCAL compiled language (when a JDK is installed).**
- `javaDriver.ts` mirrors the C++ approach: parse the `class Solution` method
  signature, build typed Java literals, wrap in a `Main`, `javac` + `java`.
  Supports int/long/double/boolean/String/int[]/int[][]/String[] + ListNode/
  TreeNode; anything else skips. Gated on `javac`+`java` availability →
  `runtime_unavailable` skip when absent (verified — no JDK in this env, so its
  real-execution tests are gated-skip; driver generation is unit-tested).
- `CLOUD_LANGUAGES` is now `go`/`c`/`sql` (the remainder). Go/SQL still skip
  cleanly; a self-hosted Piston or local Go toolchain remains future work.

Tests: 533 total (528 pass, 5 gated-skip without a JDK). C++ pointer + Python/JS
hint + Java driver suites added.

## Phasing

- **Done (this session):** full vertical slice for **Python + JS + C++ local**
  (extract → sandbox → judge → correction → badge), all with real-execution
  tests. C++ uses a signature-aware per-case driver compiled with `g++`
  (`cppDriver.ts`); supports int/long/double/bool/string + vector<int>/
  vector<vector<int>>/vector<string>/vector<bool>; **pointer/unknown signatures
  SKIP** (never a false verdict). Two adversarial review rounds.
- **Gated/ready:** Java/Go via cloud (Piston) — `cloudRunner.ts`, OFF by default,
  scope-gated, against a configurable `NATIVELY_PISTON_URL`.
- **Real-world constraints found:** the PUBLIC Piston API is whitelist-only as
  of 2026-02-15 (must self-host); Apple clang has no `<bits/stdc++.h>` (drivers
  use a portable header set). Java/Go therefore can't be live-tested without a
  configured Piston instance + the respective toolchains.
- **Not implemented:** SQL — `sqlite3` is present but query-vs-schema/data
  verification doesn't fit the `entry(args)→return` contract; needs its own
  design. Skipped cleanly today (no false badge).
- **Next:** SQL contract design; self-hosted Piston for Java/Go; container/seccomp
  hardening of the local sandbox.

## Telemetry (PII-free, via PiLatencyTrace)

`code_verify_started`, `tests_extracted` (count), `code_executed` (lang, backend,
ms), `code_verify_passed`/`failed`, `code_correction_used`. Measures how often the
model is wrong and how often correction saves it.
