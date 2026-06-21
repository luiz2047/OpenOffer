<div align="center">

<img src="assets/brand/openoffer-mark.png" alt="OpenOffer logo" width="96" />

# OpenOffer

Local-first, open-source workspace for recruiter chats, job-search processes, interviews, and meeting notes.

[![License](https://img.shields.io/badge/License-AGPL--3.0-blue?style=flat-square)](LICENSE)
[![Community Quality](https://github.com/luiz2047/OpenOffer/actions/workflows/community-quality.yml/badge.svg)](https://github.com/luiz2047/OpenOffer/actions/workflows/community-quality.yml)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-blueviolet?style=flat-square)](#system-requirements)
[![Version](https://img.shields.io/badge/Version-1.4.0-success?style=flat-square)](#project-status)

</div>

OpenOffer helps you turn messy career context into a local process you control. Paste a recruiter chat, vacancy text, calendar note, or interview transcript, and keep the resulting vacancy dossier, stage timeline, prep brief, questions, retro, and recordings together on your machine.

The project is built for sensitive workflows: technical interviews, job-search preparation, recruiter conversations, professional calls, lectures, and follow-up notes. Local providers are the preferred privacy path; bring-your-own-key cloud providers are optional.

## First Demo

OpenOffer's current wedge is simple:

1. Paste a redacted recruiter message or vacancy text.
2. Let OpenOffer propose the vacancy, stage, schedule, meeting link, prep context, and follow-up tasks.
3. Keep transcripts, notes, questions, retros, and recordings attached to the right process locally.

See the full walkthrough in [Recruiter Chat to Process](docs/demo/recruiter-chat-to-process.md).
Demo media belongs under [`assets/demo/`](assets/demo/README.md); the README should embed it only after a real screenshot, GIF, or video has been captured from fictional data.

## What Works Today

- Interview Command Center for active vacancies, interview stages, prep briefs, questions, retros, and linked recordings.
- Recruiter/vacancy text parsing into either a new vacancy or a stage on an existing process.
- Live microphone and system-audio capture for interviews and meetings.
- Speech-to-text provider routing, including local and BYOK cloud options.
- LLM provider routing for text, vision/screenshot, and meeting assistance.
- Local SQLite-backed session history and retrieval.
- English and Russian interface locales plus custom translation packs.
- Electron desktop builds for macOS and Windows development paths.

## Who It Is For

OpenOffer is especially useful for developers who are actively interviewing and want an inspectable assistant instead of a hosted black box.

It is intentionally friendly to Russian-speaking job-search workflows: Telegram/HH/Getmatch-style recruiter text, mixed Russian/English interviews, local STT experiments, and BYOK provider setups are first-class contribution areas.

## Privacy Model

OpenOffer starts local-first:

- Audio captures
- Screen captures
- Transcripts
- Meeting notes
- Reference files
- Settings
- Local SQLite data
- Local embeddings and retrieval state

Data leaves your device only when you configure a provider that needs it.

Examples:

| Provider type | Examples |
| :------------ | :------- |
| Local model | Ollama, LM Studio, LocalAI, vLLM, OpenAI-compatible local endpoints |
| Cloud LLM | OpenAI, Anthropic, Google Gemini, Groq, DeepSeek, Yandex AI Studio, OpenAI-compatible endpoints |
| Speech-to-text | Local Whisper, GigaSTT, OpenAI Whisper, Deepgram, ElevenLabs, Google, Azure, IBM Watson, Soniox, Groq Whisper |
| Search | Tavily, when web research is enabled |

Read more:

- [Privacy Policy](PRIVACY.md)
- [Security Policy](SECURITY.md)
- [AGPL FAQ](docs/AGPL_FAQ.md)
- [Notice and upstream attribution](NOTICE.md)

## Quick Start

### System Requirements

- Node.js 22 LTS recommended.
- npm.
- Git.
- Rust toolchain for the native audio module.
- macOS or Windows for the primary desktop path.

Linux packaging exists in the build configuration, but Linux is not the main tested path yet.

### Run From Source

```bash
git clone https://github.com/luiz2047/OpenOffer.git
cd OpenOffer
npm install
npm run app:dev
```

The install step rebuilds native packages, downloads bundled local models where needed, prepares `sqlite-vec`, and patches Electron metadata.

### Useful Development Commands

```bash
npm run app:dev              # Vite + Electron
npm run app:dev:fast         # reuse the last Electron build
npm run build                # renderer typecheck + Vite build
npm run build:electron       # Electron main/preload build
npm run typecheck:electron
npm run i18n:check
npm run test:i18n
npm run test
npm run public-docs:check
```

### Build the Desktop App

```bash
npm run app:build
```

This runs the frontend build, Electron build, native audio build, Sharp checks, and Electron Builder.

Signed macOS release builds need Apple Developer ID credentials and GitHub release secrets. See [OpenOffer release process](docs/RELEASE.md).

## Local and BYOK Providers

You only need one speech provider and one model provider to start.

| Need | Recommended path |
| :--- | :--------------- |
| Private model responses | Ollama or local OpenAI-compatible endpoint |
| Private English STT | Local Whisper |
| Private Russian STT | GigaSTT or compatible local STT setup |
| Local history and recall | SQLite + local retrieval |
| Private screen analysis | Local vision-capable model where available |

Yandex AI Studio needs both an API key and folder ID. See [Yandex AI Studio setup](docs/YANDEX_AI_STUDIO_SETUP.md).

For local speech setup, see [Local STT setup](docs/LOCAL_STT_OPENOFFER_SETUP.md).

## Project Layout

| Path | Purpose |
| :--- | :------ |
| `src/` | React renderer UI |
| `electron/` | Electron main process, services, audio, model routing, persistence |
| `native-module/` | Rust/native audio support |
| `docs/` | Current docs plus archived engineering notes |
| `openoffer-browser/` | Companion browser extension |
| `tests/` | E2E and fixture-based tests |
| `assets/` | App icons and package resources |

## Project Status

Current public version: `1.4.0`.

OpenOffer is a source-first public beta:

- Free and open-source under AGPL-3.0.
- No OpenOffer-hosted account, license server, trial, subscription gate, or metered hosted quota.
- macOS and Windows are the primary desktop targets.
- GitHub Release automation for signed macOS artifacts is wired, but the first official binary release still depends on configured Apple signing/notarization secrets and a release run.
- Historical Natively-era documents are kept under `docs/engineering/` and `.github/releases/` for provenance only.

## Roadmap

The near-term roadmap is community-launch focused:

- Make the recruiter-chat-to-process demo impossible to miss.
- Improve first-run local provider setup.
- Harden Russian local STT diagnostics.
- Expand focused E2E and contract tests around Interview Command Center.
- Publish signed macOS release artifacts once release secrets are configured.
- Add more good-first-issue lanes for docs, localization, provider setup, release QA, and privacy hardening.

See [ROADMAP.md](ROADMAP.md) for details.

## Contributing

The best first contributions are small and concrete:

- Try the recruiter-chat demo and report where the process feels unclear.
- Add redacted workflow examples for HH, Getmatch, Telegram, or calendar text.
- Improve Russian copy, i18n coverage, or local STT setup docs.
- Tighten provider setup diagnostics.
- Add focused smoke tests for existing workflows.
- Improve release QA and screenshots.

Start with [CONTRIBUTING.md](CONTRIBUTING.md). Maintainer expectations are in [MAINTAINERS.md](MAINTAINERS.md).

## Responsible Use

OpenOffer is intended for learning, interview preparation, accessibility, note-taking, professional meeting support, and local experimentation with AI-assisted career workflows.

Users are responsible for following workplace policies, academic rules, interview guidelines, recording-consent rules, and local laws. OpenOffer is not positioned as a bypass tool for proctoring, recording, or policy enforcement systems.

## Attribution

OpenOffer is a forked and rebranded continuation of earlier Natively-era work. Historical references remain for attribution, provenance, and license continuity only. They do not indicate an active Natively product tier, hosted OpenOffer service, subscription, trial, or paid gate in this public build.

See [NOTICE.md](NOTICE.md) for the current attribution statement.

## License

OpenOffer is licensed under the GNU Affero General Public License v3.0. See [LICENSE](LICENSE) and [AGPL FAQ](docs/AGPL_FAQ.md).

## FAQ

### Is OpenOffer free?

Yes. The public build is free and open source. You may still pay third-party providers directly if you choose to connect BYOK cloud APIs.

### Does OpenOffer require an OpenOffer cloud account?

No. The public build does not create an OpenOffer account, validate licenses, meter hosted quota, or require a subscription.

### Can I run it fully locally?

That is the preferred privacy path. Use a local speech provider and a local model provider such as Ollama or a self-hosted OpenAI-compatible endpoint. Some workflows, especially vision or high-quality model responses, depend on the local models you have available.

### Can I use it for technical interviews?

OpenOffer includes technical-interview and screen-context workflows. You are responsible for following the rules of the interview, assessment platform, employer, school, or event.

### Where should I ask questions?

Use GitHub Discussions for questions and GitHub Issues for reproducible bugs or scoped feature requests.
