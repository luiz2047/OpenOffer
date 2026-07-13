# Real Interview Loop Demo

This is the second canonical OpenOffer demo. It starts where [Recruiter Chat to Process](recruiter-chat-to-process.md) ends: the ExampleAI vacancy already exists, and OpenOffer stays attached to the technical interview before, during, and after the call.

All names, links, transcript turns, and outcomes below are fictional. Use this file as the source of truth for screenshots, GIFs, videos, release notes, and launch posts.

## Scenario

- Company: `ExampleAI`
- Role: `Senior / Lead ML Engineer`
- Stage: `Technical interview`
- Format: remote video call
- Meeting link: `[redacted]`
- Recording: `ExampleAI technical interview`
- Topic: operating an OCR system after launch

## Interview Questions and Live Hints

1. **Interviewer:** How would you measure OCR model quality after release?
   **OpenOffer hint:** Track field-level accuracy, confidence calibration, manual-review rate, latency, and regressions by document type. Tie each metric to a rollout gate.
2. **Interviewer:** What would you do if confidence drops only for one new document type?
   **OpenOffer hint:** Slice traffic by document type, inspect low-confidence samples, compare with the frozen baseline, and trigger targeted relabeling or retraining.
3. **Interviewer:** How would you roll out the fix without hurting users?
   **OpenOffer hint:** Start with a canary, route low-confidence cases to manual review, keep a rollback threshold, and trace the affected document slice end to end.

The hints should remain short enough to scan while speaking. They are prompts for the candidate, not scripts to read verbatim.

## Canonical Transcript

Use exactly these five speaker turns in transcript media:

1. **Interviewer, 13:02:** How would you measure OCR model quality after release?
2. **Me, 13:03:** I would combine field-level accuracy with confidence calibration, manual-review rate, latency, and regression slices by document type. Each metric needs an alert and a rollout gate.
3. **Interviewer, 13:05:** What would you do if confidence drops only for one new document type?
4. **Me, 13:06:** I would isolate that traffic slice, inspect low-confidence samples, compare it with the frozen baseline, and use the findings for targeted relabeling or retraining.
5. **Interviewer, 13:08:** How would you roll out the fix without hurting users?

## Stage Overview

> The technical interview focused on operating an OCR system after launch. The candidate defined quality as a mix of field accuracy, calibration, manual-review rate, latency, and document-level regression slices. The strongest signal was connecting metrics to rollout gates and a concrete drift investigation. The next round should test system-design depth, SLO ownership, and cost trade-offs.

Key points:

- Strong production ML signal: metrics were tied to alerts and rollout decisions.
- Good failure analysis: isolate the affected document type before retraining.
- Open question: quantify SLOs, traffic volume, and manual-review cost.

Next steps:

- Prepare the system-design round around OCR serving and feedback loops.
- Ask ExampleAI about document volume, latency SLOs, and review capacity.
- Send a short follow-up confirming the next round.

## Retro

- Pass probability: `72%`
- Main signal: Strong production reasoning, with the clearest answers around monitoring, drift slices, and guarded rollout.
- Strong moments:
  - Connected offline model metrics to online review rate, latency, alerts, and rollout gates.
  - Started the drift investigation with a narrow document-type slice instead of proposing immediate full retraining.
- Weak moments:
  - Did not quantify target latency, accuracy, or rollback thresholds.
  - The cost and ownership model for manual review stayed too abstract.
- New facts:
  - ExampleAI evaluates OCR quality per field and document type.
  - The next round includes OCR serving architecture and feedback-loop design.
- Follow-up actions:
  - Prepare concrete SLO numbers and a canary rollback policy.
  - Draw the OCR inference, review, labeling, and retraining loop.
  - Ask who owns manual-review capacity and production alerts.

The current public UI shows this retro through the meeting summary's coaching and structured sections. Do not force hidden or experimental Interview Command Center tabs into public media.

## Capture Path

1. Open the ExampleAI vacancy in the Interview Command Center.
2. Open `Stages` and show the `Technical interview` card with its schedule, `Start recording`, and linked recording.
3. Start the interview and show a live answer hint for one canonical question.
4. Open `ExampleAI technical interview` from the stage.
5. Capture the `Transcript` tab with the five canonical turns.
6. Capture the `Summary` tab with the overview, next steps, and interview signals.
7. Scroll the same summary to coaching and the structured retro sections.

For deterministic local capture:

```bash
CI=true OPENOFFER_E2E_CI_SMOKE=1 OPENOFFER_CAPTURE_DEMO=1 \
  ELECTRON_APP_PORT=5173 \
  npx playwright test tests/e2e/interview-command-center.spec.ts \
  --project=electron-chrome --grep "captures canonical real interview media"
```

## Asset Map

| File | Proof |
| :--- | :---- |
| `assets/demo/openoffer-15-stage-recording.png` | Recording stays attached to the technical stage. |
| `assets/demo/openoffer-16-live-answer.png` | A concise answer hint appears during the interview. |
| `assets/demo/openoffer-17-transcript.png` | The saved recording becomes a readable speaker transcript. |
| `assets/demo/openoffer-18-stage-overview.png` | The transcript becomes an overview, signals, and next steps. |
| `assets/demo/openoffer-19-retro.png` | Coaching, strong moments, weak moments, new facts, and follow-up actions remain reviewable. |
| `assets/demo/openoffer-real-interview-loop-poster.png` | Static README fallback for the full loop. |
| `assets/demo/openoffer-real-interview-loop.gif` | Short README-safe walkthrough. |
| `assets/demo/openoffer-real-interview-loop.mp4` | Higher-quality walkthrough for release notes and launch posts. |

## Privacy and Responsible Use

- Use only this fictional ExampleAI scenario or equally synthetic data.
- Keep recruiter names, meeting URLs, compensation, resumes, private calendars, and real transcripts out of public media.
- Do not present OpenOffer as a way to bypass interview rules, recording consent, proctoring, or employer policy.
- Describe live hints as optional support for interviews where assistance is permitted.
- Keep the local-first wording precise: data leaves the device only when a configured provider needs it.

## Recapture Checklist

- The app is using the current public theme and visible release surfaces.
- All five static frames come from the same scenario and viewport.
- Text is readable at GitHub README width.
- The poster has a static fallback even when animation is disabled.
- The GIF stays short and reasonably sized.
- No private data or real meeting link appears in any frame.
- README links and asset names still match this map.
