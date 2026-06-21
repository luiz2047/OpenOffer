# Contributing to OpenOffer

OpenOffer is a local-first desktop assistant for job-search processes, interviews, recruiter chats, meetings, and notes. Contributions are most useful when they improve a concrete workflow without weakening the privacy boundary.

## Start in 30 Minutes

1. Fork the repo and create a branch from `main`.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the app:

   ```bash
   npm run app:dev
   ```

4. Try the [Recruiter Chat to Process demo](docs/demo/recruiter-chat-to-process.md).
5. Pick a small issue or open a focused report with redacted reproduction data.

## Good First Lanes

| Lane | Useful work |
| :--- | :---------- |
| Demo and docs | Better screenshots, redacted workflow examples, README clarity, release QA notes |
| Russian job-search flows | HH/Getmatch/Telegram examples, Russian copy, local STT setup, prompt eval cases |
| Interview workspace | Vacancy dossier, stage timeline, prep brief, question bank, retros, recording links |
| Provider setup | Ollama, Local Whisper, GigaSTT, Yandex AI Studio, OpenAI-compatible endpoint diagnostics |
| Privacy and security | Log redaction, provider boundary review, Electron IPC hardening, safe issue templates |
| Reliability | Focused tests, Electron boot checks, native audio diagnostics, packaging smoke tests |
| Localization | English/Russian i18n keys, custom pack validation, missing-copy tests |

## Project Map

| Path | Purpose |
| :--- | :------ |
| `src/` | React renderer UI and i18n resources |
| `electron/` | Electron main process, services, audio, model routing, persistence |
| `electron/services/` | Interview workspace, repositories, providers, storage, diagnostics |
| `electron/llm/` | Prompt assembly, provider routing, answer policies, guardrails |
| `native-module/` | Rust native audio support |
| `tests/` | Playwright and fixture-based tests |
| `docs/` | Current docs and historical engineering archive |
| `openoffer-browser/` | Browser companion extension |
| `.github/` | Issue templates, PR template, CI, release notes |

When changing Electron behavior, be explicit about which side is affected: renderer, preload, main process, service layer, or native module.

## Development Commands

```bash
npm run app:dev
npm run build
npm run build:electron
npm run typecheck:electron
npm run i18n:check
npm run test:i18n
npm run test
npm run public-docs:check
```

Use the smallest check set that covers your change, then list the exact commands in the PR.

## Interface Copy and Localization

If you add or change user-facing copy:

- Update English and Russian entries in `src/i18n/resources.ts`.
- Run `npm run i18n:check`.
- Run `npm run test:i18n` when changing interpolation, plural rules, or custom-pack behavior.
- Keep transcription language, response language, and UI language separate in wording.

See [Interface Translations](docs/translations.md).

## Bug Reports

Please include:

- OpenOffer version or commit.
- OS and install path.
- Source build or release build.
- Provider/STT/model configuration, without secrets.
- Locale and transcription language.
- Reproduction steps.
- Redacted sample input if parsing is involved.
- Redacted logs.

Do not paste private transcripts, resumes, API keys, provider tokens, meeting links, or unreduced recruiter chats into public issues.

## Feature Requests

Lead with the workflow:

- What are you trying to do?
- What is the current workaround?
- What data should stay local?
- Which provider path is affected?
- What would a minimal useful version look like?

Implementation suggestions are welcome, but the workflow is the contract.

## Pull Requests

Before opening a PR:

- Keep the diff focused.
- Avoid unrelated refactors.
- Add or update tests when behavior changes.
- Update docs when user-facing behavior, setup, provider configuration, or release process changes.
- Redact screenshots and logs.
- Fill out the PR template with exact checks run.

Maintainers may ask to split broad PRs into smaller slices if review risk is high.

## Release and Packaging Work

Packaging changes should say whether they affect:

- Source development.
- Unsigned local package builds.
- Signed macOS release builds.
- Auto-update metadata.
- Windows/Linux packaging.

Signed macOS releases depend on Apple Developer ID credentials and GitHub secrets. See [docs/RELEASE.md](docs/RELEASE.md).

## Code of Conduct

This project follows the [OpenOffer Code of Conduct](CODE_OF_CONDUCT.md). For security issues, use [SECURITY.md](SECURITY.md) instead of public issues.
