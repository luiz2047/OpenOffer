<div align="center">

<img src="assets/brand/openoffer-mark.png" alt="OpenOffer logo" width="96" />

# OpenOffer

Local-first, free, open-source assistant for interviews, career work, meetings, and work notes.

[![License](https://img.shields.io/badge/License-AGPL--3.0-blue?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-blueviolet?style=flat-square)](#system-requirements)
[![Status](https://img.shields.io/badge/Status-public%20source-success?style=flat-square)](#project-status)

</div>

OpenOffer is a desktop AI assistant you can run from source, inspect, and adapt. It is built for sensitive live workflows: technical interviews, job-search preparation, professional calls, lectures, and follow-up notes.

You choose which model and speech providers to connect. Local providers are the preferred privacy path; bring-your-own-key cloud providers are optional compatibility.

## Table of Contents

- [Why OpenOffer](#why-openoffer)
- [What Works Today](#what-works-today)
- [Privacy Model](#privacy-model)
- [For Russian-Speaking Developers](#for-russian-speaking-developers)
- [Quick Start](#quick-start)
- [Local and BYOK Providers](#local-and-byok-providers)
- [Development](#development)
- [Project Status](#project-status)
- [Responsible Use](#responsible-use)
- [Roadmap](#roadmap)
- [Attribution](#attribution)
- [Contributing](#contributing)
- [License](#license)
- [FAQ](#faq)

## Why OpenOffer

Interview transcripts, resumes, job descriptions, screenshots, meeting notes, and negotiation context are private. Most AI assistants make those workflows convenient by making a vendor the center of the system.

OpenOffer takes the opposite starting point:

- **Local-first by default:** sessions, notes, settings, reference files, and local history live on your device.
- **Open source:** the public project is inspectable and licensed under AGPL-3.0.
- **Provider choice:** use local models, self-hosted endpoints, or BYOK cloud APIs.
- **Career-work focus:** technical interviews, live calls, meeting notes, follow-ups, and preparation contexts are first-class workflows.
- **No paid OpenOffer gate:** no subscription tier or license check is required by the public build.

OpenOffer v1.1 adds the first job-search operating-system slice: a local interview command center for tracking active processes, scheduled interviews, prep context, questions, retros, and linked meeting recordings.

## What Works Today

OpenOffer is an Electron desktop app with live capture, model routing, local storage, and mode-based assistance.

### Interview Command Center

- Open into an Interview OS workspace instead of a product landing page.
- Track active job-search processes with status, priority, company, role, stage, source, and scheduled time.
- Keep a vacancy dossier, prep brief, readiness checklist, question bank, and post-interview retro for each process.
- Create interviews from pasted HH/Getmatch/Telegram/calendar text and keep the original source locally.
- Link existing meeting recordings to an interview so prep, live context, and follow-up stay together.
- Create scheduled interview events in Google Calendar or macOS Calendar from OpenOffer when calendar access is configured.

### Live Interview and Meeting Assistance

- Capture microphone and system audio during live sessions.
- Stream speech-to-text into the desktop interface.
- Keep rolling conversational context while the session is active.
- Ask for concise suggestions, summaries, follow-up questions, or draft responses.

### Technical Interview Support

- Capture coding problems or technical prompts from the screen.
- Use screen capture with vision-capable providers where configured.
- Generate hints, explanations, code reasoning, and complexity notes.
- Use technical-interview modes and reference files to keep answers grounded in the role and context.

### Career and Work Modes

- Use built-in modes for technical interviews, behavioral interviews, recruiting, sales, lectures, team meetings, and general work.
- Add reference files such as resumes, job descriptions, notes, scorecards, syllabi, or project context.
- Keep mode-specific notes and answer style separate across workflows.

### Local History and Recall

- Store meeting/session data locally.
- Use local SQLite-backed history and retrieval where configured.
- Search or revisit prior notes without relying on an OpenOffer cloud account.

### Local and BYOK Model Routing

- Run local models through Ollama or compatible local endpoints.
- Connect cloud providers with your own keys when you choose to send data to them.
- Use provider routing for text, vision/screenshot, and speech workflows.

## Privacy Model

OpenOffer's privacy model is simple: local first, explicit provider use when you opt in.

### Stays on your device by default

- Audio captures
- Screen captures
- Transcripts
- Meeting notes
- Reference files
- Settings
- Local SQLite data
- Local embeddings and retrieval state

### Can leave your device only when configured

Data can be sent to providers you configure, such as:

- AI providers: OpenAI, Anthropic, Google Gemini, Groq, DeepSeek, Yandex AI Studio, Ollama-compatible endpoints, or OpenAI-compatible/self-hosted endpoints.
- Speech providers: Local Whisper, GigaSTT, OpenAI Whisper, Deepgram, ElevenLabs, Google, Azure, IBM Watson, Soniox, or Groq Whisper.
- Search providers such as Tavily when web research is enabled.
- GitHub release infrastructure for update checks.

Each provider has its own privacy policy and retention behavior. Review provider terms before sending sensitive material.

Read more:

- [Privacy Policy](PRIVACY.md)
- [Security Policy](SECURITY.md)
- [Notice and upstream attribution](NOTICE.md)

## For Russian-Speaking Developers

OpenOffer is especially useful if you want an inspectable interview assistant that can run with local or self-hosted speech infrastructure.

Коротко: OpenOffer задуман как локальный open-source помощник для собеседований, подготовки, рабочих звонков и заметок. Главная идея v0.1 - не отправлять резюме, JD, экран, аудио и историю разговоров в неизвестный сервис по умолчанию. Вы сами выбираете: локальные модели и локальное STT, self-hosted endpoint или BYOK cloud provider.

Recommended local path:

1. Run OpenOffer from source.
2. Configure a local speech provider such as Local Whisper or GigaSTT.
3. Use Ollama or another local/OpenAI-compatible endpoint for private model responses.
4. Add resume, job description, and interview notes as local reference files.

The dedicated local-STT guide is being refreshed for the standalone OpenOffer repo. Until then, treat Local Whisper and GigaSTT as the current local speech-provider paths in the app.

For the shipped interview workspace architecture, see [Interview Command Center](docs/engineering/interview-command-center.md).

OpenOffer includes built-in English and Russian interface locales plus data-only
custom translation packs from the app-data translations folder. Interface
language is independent of transcription language and AI response language. See
[Interface Translations](docs/translations.md) for pack rules and the current
localization boundary.

## Quick Start

### System Requirements

- Node.js 22 LTS recommended. Node 20 may work, but Node 22 is the preferred baseline for current local development.
- npm.
- Git.
- Rust toolchain for the native audio module.
- macOS or Windows for the primary desktop path.

Linux packaging exists in the build configuration, but Linux support is not the main tested path yet. Contributions are welcome.

### Clone and Install

```bash
git clone https://github.com/luiz2047/OpenOffer.git
cd OpenOffer
npm install
```

The install step rebuilds native packages, downloads bundled local models where needed, prepares `sqlite-vec`, and patches Electron metadata.

### Run in Development

```bash
npm run app:dev
```

This starts Vite on port 5180 and launches Electron after the dev server is ready.
Use `npm run app:dev:fast` when you only changed renderer code and want to reuse the last Electron build. If you changed `electron/` or `preload`, run `npm run build:electron` first or use `npm run app:dev`.

### Build the App

```bash
npm run app:build
```

This runs the frontend build, Electron typecheck/build, native audio build, Sharp dependency checks, and Electron Builder.

### Useful Checks

```bash
npm run typecheck:electron
npx tsc --noEmit
npm run build
npm run build:electron
npm run test
```

For a focused Electron smoke, run:

```bash
npm run test:e2e:openoffer
```

## Local and BYOK Providers

You only need one speech provider and one model provider to get started.

### Recommended Local Stack

| Need | Recommended path |
| :--- | :--------------- |
| Private model responses | Ollama or local OpenAI-compatible endpoint |
| Private English STT | Local Whisper |
| Private Russian STT | GigaSTT or compatible local STT setup |
| Local history and recall | SQLite + local retrieval |
| Private screen analysis | Local vision-capable model where available |

### Optional BYOK Cloud Providers

| Provider type | Examples |
| :------------ | :------- |
| LLMs | OpenAI, Anthropic, Google Gemini, Groq, DeepSeek, Yandex AI Studio, OpenAI-compatible endpoints |
| Speech-to-text | OpenAI Whisper, Deepgram, ElevenLabs, Google, Azure, IBM Watson, Soniox |
| Search | Tavily |
| Local models | Ollama, LocalAI, LM Studio, vLLM, other OpenAI-compatible endpoints |

Cloud providers are compatibility options, not the core requirement. The public OpenOffer build does not meter, proxy, resell, or bill for provider usage.

Yandex AI Studio needs both an API key and folder ID. See [Yandex AI Studio setup](docs/YANDEX_AI_STUDIO_SETUP.md).

For contributor-side Russian prompt reliability checks, see [Yandex Russian prompt eval](docs/testing/YANDEX_RUSSIAN_PROMPT_EVAL.md).

## Development

### Common Commands

```bash
npm run app:dev          # run Vite + Electron in development
npm run app:dev:fast     # run without rebuilding Electron; requires an existing dist-electron build
npm run build            # clean, typecheck frontend, and build Vite output
npm run build:electron   # build Electron main/preload code
npm run typecheck:electron
npm run build:native     # build native audio module
npm run test:answer-style-yandex
npm run test             # node/electron test gate through repo script
npm run app:build        # production package build
```

### Project Layout

| Path | Purpose |
| :--- | :------ |
| `src/` | React renderer UI |
| `electron/` | Electron main process, services, audio, model routing, persistence |
| `native-module/` | Rust/native audio support |
| `docs/` | Current docs plus archived engineering notes |
| `openoffer-browser/` | Companion browser extension |
| `tests/` | E2E and fixture-based tests |
| `assets/` | App icons and package resources |

### Current Docs

- [Documentation index](docs/README.md)
- [Browser companion README](openoffer-browser/README.md)
- [Release notes guide](docs/RELEASE.md)

## Project Status

OpenOffer is public source at version `1.0.0`.

Current baseline:

- Free and open-source public build.
- No OpenOffer-hosted account, license server, trial, or subscription gate.
- Local-first data model.
- Local and BYOK provider support.
- macOS and Windows are the primary desktop targets.
- Old Natively-era engineering documents are preserved under `docs/engineering/` for provenance, not as current product guidance.

OpenOffer-native screenshots and release artifacts should be refreshed from the standalone project. Old Natively-branded demos are intentionally not used as current product proof.

## Responsible Use

OpenOffer is intended for:

- Learning and interview preparation.
- Accessibility and note-taking.
- Professional meeting support.
- Personal productivity.
- Local experimentation with AI-assisted career workflows.

Users are responsible for complying with workplace policies, academic rules, interview guidelines, and local laws. OpenOffer is not positioned as a bypass tool for proctoring, recording, or policy enforcement systems.

## Roadmap

OpenOffer's long-term direction is an open-source job-search operating system. The current v0.1 wedge is the local-first interview and work assistant.

Near-term:

- Refresh OpenOffer-native screenshots and demo material.
- Improve first-run local provider setup.
- Harden Russian local STT setup and diagnostics.
- Keep removing stale Natively-era public surfaces.
- Improve OpenOffer-focused E2E coverage.

Next product slices:

- Better resume/JD preparation flows.
- More explicit interview-stage tracking.
- Follow-up drafting and offer/negotiation workflows.
- Job-search monitoring and application pipeline tools.
- Cleaner release packaging and update metadata for the standalone repository.

## Attribution

OpenOffer is a forked and rebranded continuation of earlier Natively-era work. Historical references remain in the repository for attribution, provenance, and license continuity only. They do not indicate an active Natively product tier, hosted OpenOffer service, subscription, trial, or paid gate in this public build.

See [NOTICE.md](NOTICE.md) for the current attribution statement.

## Contributing

Contributions are welcome, especially in:

- Local speech providers and Russian transcription support.
- Local model setup.
- Privacy and security hardening.
- Electron reliability.
- Documentation and onboarding.
- OpenOffer-native screenshots, release QA, and E2E coverage.

Start with [CONTRIBUTING.md](CONTRIBUTING.md). For security reports, use [SECURITY.md](SECURITY.md).

## License

OpenOffer is licensed under the GNU Affero General Public License v3.0.

See [LICENSE](LICENSE) for the full license text.

## FAQ

### Is OpenOffer free?

Yes. The public build is free and open source. You may still pay third-party providers directly if you choose to connect BYOK cloud APIs.

### Does OpenOffer require an OpenOffer cloud account?

No. The public build does not create an OpenOffer account, validate licenses, meter hosted quota, or require a subscription.

### Can I run it fully locally?

That is the preferred privacy path. Use a local speech provider and a local model provider such as Ollama or a self-hosted OpenAI-compatible endpoint. Some workflows, especially vision or high-quality model responses, depend on the local models you have available.

### Does OpenOffer work with Zoom, Teams, Google Meet, and other apps?

OpenOffer captures desktop audio and microphone input through the local desktop app. The exact behavior depends on OS permissions, audio device routing, and the providers you configure.

### Can I use it for technical interviews?

OpenOffer includes technical-interview and screen-context workflows. You are responsible for following the rules of the interview, assessment platform, employer, school, or event.

### Is OpenOffer a Cluely clone?

No. OpenOffer overlaps with the broad category of live AI assistants, but the project goal is different: local-first, open-source, inspectable career and work assistance with no OpenOffer paid gate.

### Where are the old Natively docs?

Archived engineering notes are under `docs/engineering/`. Treat them as historical background, not current OpenOffer product guidance.

### Where should I ask questions?

Use GitHub issues or discussions in the OpenOffer repository.
