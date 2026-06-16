# Hybrid OCR + Vision Screen Analysis Design

**Date:** 2026-06-03  
**Status:** Planning only — no runtime code changes  
**Goal:** Evaluate whether local OCR + structured screen text + raw screenshot can beat direct vision-only for Cluely-like 2–4s interview screen analysis on average M2-class laptops and comparable Windows/Linux machines.

## Executive Summary

Direct screenshot-to-vision-model should remain the correctness baseline. It is the most robust way to understand messy interview screens: code editors, problem statements, examples, tables, diagrams, syntax highlighting, and UI layout. However, a **hybrid local OCR + direct vision** path is likely the best architecture for matching top interview-copilot speed.

The recommended architecture is **not** OCR-only. It is:

1. Capture screenshot locally.
2. Start local OCR immediately in parallel with image compression/upload preparation.
3. Build a compact structured text summary: visible text, code-like regions, tables/examples, error logs, and confidence/provenance.
4. Send both:
   - the raw compressed screenshot, and
   - the structured OCR/context block
   to the LLM.
5. Let the LLM use OCR text for fast grounding and the image for layout/correction.

This can improve first-useful-token latency because the model receives a compact textual anchor instead of needing to visually decode every character from pixels. It can also improve reliability on text-heavy screens. But OCR must be opportunistic, confidence-scored, and bounded. If OCR is slow or low-confidence, the system should continue with vision-only rather than blocking.

Target UX should be measured as **time to first useful answer**, not full final coding solution. A 2–4s Cluely-like target is realistic for a concise first answer from one screenshot. It is not realistic for full code + dry run + complexity + verification in every case.

## Recommended Architecture

Use a **parallel hybrid pipeline**:

```text
shortcut / screen action
  ├─ capture screenshot
  ├─ immediately show UI scaffold / analyzing state
  ├─ branch A: compress image for vision provider
  ├─ branch B: run local OCR + lightweight screen structuring
  └─ merge:
       prompt = short user task
              + structured OCR/context block if ready/confident
              + compressed screenshot always attached
       stream response from fast vision model
```

The key is that OCR should **not sit in front of** the LLM as a required serial step. It should race with image preparation and have a hard deadline, e.g. 250–600ms on M2-class devices. If it misses the deadline, send vision-only and let OCR results be used for later follow-up or correction.

## Why Hybrid Can Be Faster Than Vision-Only

Vision models spend part of their prefill/understanding time reading pixels. For screenshots that are mostly text — LeetCode prompts, error logs, compiler output, browser docs, meeting slides — local OCR can give the model a much cheaper text representation up front.

Potential wins:

- **Lower visual decoding burden:** model can anchor on OCR text and use image for validation/layout.
- **Better exact-symbol recovery:** OCR/code-region extraction can preserve keywords, identifiers, numbers, constraints, and examples.
- **Cheaper prompt reasoning:** text tokens are often cheaper/faster than full-resolution image interpretation.
- **Better context fusion:** structured blocks can explicitly label `problem_statement`, `examples`, `constraints`, `code`, `error`, and `table`.
- **Privacy controls:** text can be redacted or filtered before upload, while still sending the image only when policy allows.

But hybrid only wins if OCR is fast and non-blocking. A slow OCR step that delays upload makes latency worse.

## Why OCR-Only Is Not Recommended

OCR-only would be tempting for speed, but it is weaker for interview-copilot quality.

Failure cases:

- diagrams and architecture drawings;
- whiteboards;
- tables with spatial relationships;
- code indentation and syntax highlighting;
- split panes where question, examples, code, and error output relate by layout;
- low contrast / retina scaling / browser zoom;
- selected text, cursor position, editor diagnostics, underlines, icons.

OCR also loses provenance: it may output plausible wrong text without making the uncertainty obvious. Direct vision is the guardrail. The model should see the screenshot so it can correct OCR mistakes and use layout.

## OCR Engine Strategy

A single OCR engine is unlikely to be best across all OSes.

Recommended provider order:

### macOS

1. **Apple Vision OCR native bridge**
   - Best candidate for speed and OS integration on M-series Macs.
   - Likely lower overhead than JS Tesseract.
   - Good fit for English UI/text/code screenshots.
2. **Tesseract.js or native Tesseract fallback**
   - Acceptable fallback.
   - Existing historical tests showed synthetic fixtures around ~180–290ms, but real screenshots still need benchmarking.

### Windows

1. **Windows OCR / WinRT OCR if available**
   - OS-native, avoids bundling heavy ML runtimes.
2. **PaddleOCR / ONNX fallback**
   - Potentially higher accuracy on complex screenshots, but heavier packaging.

### Linux

1. **Tesseract native or Tesseract.js fallback**
   - Most portable.
2. **PaddleOCR / ONNX optional advanced path**
   - Only if benchmarks justify packaging complexity.

For this product, the first implementation should prefer **native OS OCR where possible**, not a large cross-platform ML stack, unless real benchmarks prove the ML stack wins by a large margin.

## Structuring Layer

Do not pass raw OCR text alone. Add a small deterministic structuring layer.

Suggested output:

```xml
<screen_context source="local_ocr" deadline_ms="500" confidence="0.83">
  <visible_text>...</visible_text>
  <code_blocks>
    <code language="python" confidence="0.78">...</code>
  </code_blocks>
  <tables>
    <table confidence="0.72">...</table>
  </tables>
  <examples>
    <example input="..." output="..." />
  </examples>
  <errors>
    <error>TypeError: ...</error>
  </errors>
  <warnings>
    OCR may have confused 0/O or 1/l in code identifiers.
  </warnings>
</screen_context>
```

Keep this block compact. For live mode, target under ~1,000–1,500 text tokens. If OCR returns a huge page, rank and trim:

1. visible problem/question text;
2. examples and constraints;
3. code/editor content;
4. error output;
5. surrounding UI chrome last or omitted.

## Prompt Strategy

For fast response, avoid asking for full solution JSON first. Use a staged answer contract.

### Stage 1: First useful answer

Goal: 2–4s visible response.

Prompt shape:

```text
You are helping in a live interview. Use the OCR text for exact wording and the screenshot for layout/correction. If they disagree, trust the screenshot.

Return the concise thing the candidate should say first. If this is coding, lead with understanding + approach; do not wait to produce full code before saying anything.
```

### Stage 2: Continue / complete

After first tokens are visible, continue into code, dry run, complexity, or deeper explanation. This can take longer without harming perceived latency.

## Latency Budget

Target for one screenshot on M2-class machine:

| Stage | Target |
|---|---:|
| Screenshot capture | 100–500ms |
| Local OCR deadline | 250–600ms, non-blocking |
| Image compression | 30–200ms |
| Request upload/connect | 100–800ms depending network |
| Provider first token | 1.2–3.5s |
| First visible useful answer | 2–4s |
| Full coding answer | 5–15s depending output |

Important distinction: Cluely-like speed likely means first useful response, not full polished solution.

## Data Flow Variants

### Option A — Vision-only current path

```text
screenshot → compress → vision LLM → answer
```

Pros:
- simplest;
- robust on diagrams/layout;
- fewer local dependencies.

Cons:
- provider must visually decode all text;
- more image-token cost;
- weaker exact text grounding;
- no pre-upload redaction opportunity.

### Option B — OCR-only

```text
screenshot → OCR/structure → text LLM → answer
```

Pros:
- potentially very fast and cheap on clean text;
- can use text-only fast models.

Cons:
- brittle on layout/diagrams/code formatting;
- OCR errors become hidden prompt corruption;
- not competitive for complex real screens.

### Option C — Parallel hybrid, recommended

```text
screenshot → image compression ──────┐
           → local OCR + structure ──┼→ vision LLM with image + structured text → stream answer
                                     ┘
```

Pros:
- best blend of speed and correctness;
- exact text anchor + visual validation;
- graceful fallback to vision-only;
- supports privacy/redaction later.

Cons:
- more engineering complexity;
- must benchmark per OS/device;
- OCR confidence and deadline logic must be disciplined.

## Matching Cluely-like Speed

The biggest speed differentiators are not just OCR vs vision. They are:

1. **Fast path routing:** avoid full multi-provider retry chains before first token.
2. **Streaming:** optimize first visible text, not full completion.
3. **One screenshot / cropped region:** avoid queues of full-screen images in live mode.
4. **Prompt brevity:** first answer should be concise; code can continue afterward.
5. **Prewarm:** model/prompt/provider connection should be warm before the user asks.
6. **Hybrid OCR deadline:** use OCR if ready quickly; never block on it.
7. **Provider choice:** use a fast vision model first; reserve heavy models for fallback/refinement.

If these are done, hybrid OCR can help Natively match 2–4s perceived screen analysis. If not, OCR alone will not fix latency.

## Risks

- **OCR confidence lies:** OCR may produce plausible but wrong identifiers/numbers.
  - Mitigation: include confidence/provenance; instruct LLM to verify against image.
- **Latency regression:** OCR blocks the hot path.
  - Mitigation: hard deadline and race; proceed vision-only if late.
- **Prompt bloat:** OCR text makes prompt longer, hurting TTFT.
  - Mitigation: rank/trim to compact structured block.
- **Packaging complexity:** native OCR bridges differ by OS.
  - Mitigation: OS-native first, optional advanced engine later.
- **Privacy:** hybrid increases available data forms.
  - Mitigation: same scope-gating for both screenshot and OCR text; local-only mode must keep both local.

## Measurement Plan

Before implementation, run benchmarks on M2 Mac and one Windows/Linux laptop:

1. Capture latency: shortcut to screenshot file.
2. Compression latency and output bytes.
3. OCR latency and confidence on real screenshots:
   - LeetCode problem page;
   - code editor with error;
   - terminal stack trace;
   - table/examples;
   - diagram/UI mockup.
4. Vision-only TTFT and full completion.
5. Hybrid TTFT and full completion.
6. Accuracy comparison: exact problem constraints, examples, code identifiers, final answer correctness.

Success criteria:

- p50 first useful answer ≤ 3s;
- p90 first useful answer ≤ 5s;
- hybrid does not reduce answer quality versus vision-only;
- OCR deadline misses degrade to vision-only cleanly;
- no cloud upload of OCR text when screenshot scope is denied.

## Recommendation

Plan toward **parallel hybrid OCR + vision** as the next-generation screen-understanding architecture, but only after instrumentation proves current bottlenecks. The first implementation should be experimental and feature-flagged:

- `vision_only` remains baseline;
- `hybrid_fast` races OCR with vision prep;
- OCR result is compact, structured, confidence-scored;
- the raw screenshot is still attached for correctness;
- the answer path streams a short first response before full solution.

This is the most credible path to Cluely-like 2–4s perceived screen analysis without sacrificing correctness on complex interview screens.
