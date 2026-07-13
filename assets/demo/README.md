# OpenOffer Demo Assets

This folder is reserved for public demo media.

OpenOffer has two canonical public demos:

1. `recruiter-chat-to-process`: a fictional recruiter chat becomes a local vacancy process with an editable stage timeline, meeting link, and prep context.
2. `real-interview-loop`: the same ExampleAI process continues through stage recording, a live answer hint, transcript, overview, coaching, and retro.

Recruiter-chat assets:

- `recruiter-chat-to-process.mp4` for GitHub and launch posts.
- `recruiter-chat-to-process.gif` for README embedding if the GIF stays small and readable.
- `recruiter-chat-to-process.png` as a static fallback.

Real-interview assets:

- `openoffer-real-interview-loop-poster.png` for the first README viewport.
- `openoffer-real-interview-loop.gif` for the embedded 18-second loop.
- `openoffer-real-interview-loop.mp4` for release notes and launch posts.
- `openoffer-15-stage-recording.png` through `openoffer-19-retro.png` for the five proof states.

The exact ExampleAI questions, transcript, overview, retro, asset map, and manual capture path live in [Real Interview Loop](../../docs/demo/real-interview-loop.md).

To recapture the real UI frames:

```bash
CI=true OPENOFFER_E2E_CI_SMOKE=1 OPENOFFER_CAPTURE_DEMO=1 \
  ELECTRON_APP_PORT=5173 \
  npx playwright test tests/e2e/interview-command-center.spec.ts \
  --project=electron-chrome --grep "captures canonical real interview media"
```

Capture rules:

- Use only fictional or heavily redacted data.
- Do not include real recruiter names, meeting links, resumes, transcripts, employers, salary details, or private calendar content.
- Keep each demo attached to one scenario instead of mixing unrelated UI states.
- Do not force hidden or experimental product surfaces into public media.
- Keep text readable at GitHub README width and provide a static fallback for animation.
- Recapture from `docs/demo/recruiter-chat-to-process.md` and `docs/demo/real-interview-loop.md` so README, docs, and release notes stay aligned.
